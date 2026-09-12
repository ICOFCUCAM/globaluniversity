// ---------------------------------------------------------------------------
// THE DOCUMENT AS IT WAS ISSUED — served from the archive, never regenerated.
//
//   GET /api/document/archived?reference=APT-2026-0042           → the HTML
//   GET /api/document/archived?reference=APT-2026-0042&pdf=1     → for printing
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS AT ALL
// ---------------------------------------------------------------------------
//
// The University's instruction: "Do not merely regenerate the letter every time
// the user clicks View. Historical documents must remain unchanged even if the
// template is later redesigned."
//
// Regenerating is the obvious implementation and it is wrong in a way that is
// invisible until it matters. The letter is produced from the record and the
// template; change either — a corrected spelling, a new letterhead, a revised
// standard clause — and the document that comes back is not the document the
// appointee is holding. The register then disagrees with their copy, and the
// register is the one that looks authoritative.
//
// So the bytes are stored at the moment of issue and served back verbatim. The
// template can be redesigned freely. Nothing that happens afterwards can reach
// a document that has gone out.
//
// ---------------------------------------------------------------------------
// AND WHY THE PDF IS MADE FROM THESE BYTES
// ---------------------------------------------------------------------------
//
// `playwright` is a dev dependency and Chromium is not present in the
// deployment, so a server route rendering a PDF would work in development and
// fail on Vercel — discovered by the first officer trying to issue a letter.
//
// The answer is not to add a headless browser. It is that the PDF must be
// produced from the FROZEN archived HTML rather than from the template, and
// once that is true the renderer barely matters: the browser already has one,
// it is the same engine that would run on the server, and it is driven by the
// print CSS the page-count tests measure in Chromium.
//
// `?pdf=1` therefore serves the archived bytes with the print dialogue opened
// over them. What is archived is what prints. A redesign cannot change it, and
// there is no second rendering path to keep in step with the first.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { guard } from '@/lib/adminAuth';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';
import { contentHash } from '@/lib/officialDocument';
import type { Capability } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REFERENCE = /^[A-Z]{2,4}-\d{4}-\d{4,}$/;

// ---------------------------------------------------------------------------
// THE PRINT TRIGGER, AND WHY IT IS THREE LINES RATHER THAN A LIBRARY.
//
// It opens the browser's own print dialogue over the archived document. The
// document itself carries @page and print CSS measured in Chromium by
// appointmentLetterPages.test.mjs, so what comes out of "Save as PDF" is the
// page those tests pin.
// ---------------------------------------------------------------------------
const PRINT_TRIGGER = `
<script>
  // afterprint rather than a timer: a reader who cancels the dialogue keeps the
  // document on screen instead of watching a blank tab.
  window.addEventListener('load', function () { window.print(); });
</script>`;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = (url.searchParams.get('reference') ?? '').trim().toUpperCase();
  const wantsPdf = url.searchParams.get('pdf') === '1';

  if (!REFERENCE.test(reference)) {
    return NextResponse.json({ ok: false, error: 'not-a-reference' }, { status: 400 });
  }

  // ---------------------------------------------------------------------
  // THE WHOLE DOCUMENT IS NOT PUBLIC, and this is the line between the two
  // routes. /api/document tells a stranger whether a letter is genuine and
  // carries nothing confidential. THIS returns the letter itself — the salary,
  // the terms, the recipient of a warning — so it requires a caller.
  // ---------------------------------------------------------------------
  const g = await guard(request, 'view-admitted-students' as Capability);
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ ok: false, error: 'service-role-key-missing' }, { status: 500 });
  }
  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const table = reference.startsWith('APT-') ? 'appointment_letters' : 'correspondence_letters';
  const { data, error } = await admin
    .from(table)
    .select('reference, version, issued_on, html, content_hash, superseded_at')
    .eq('reference', reference)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: `not-read: ${error.message}` }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'not-in-the-archive' }, { status: 404 });
  }

  const row = data as Record<string, unknown>;
  const html = String(row.html ?? '');

  // ---------------------------------------------------------------------
  // THE HASH IS CHECKED ON THE WAY OUT, not trusted because a trigger exists.
  //
  // 041's trigger refuses an edit and 043 stores a SHA-256 over the archived
  // bytes. Those are two independent claims and this is the only place they can
  // be compared — if they ever disagree, the archive has been altered by
  // something that went round the trigger, and serving the document without
  // saying so would put the University's name on it.
  //
  // NOT REFUSED. The reader still gets the document; a letter withheld because
  // of an integrity warning helps nobody. It is served with the warning in the
  // response header and on the page.
  // ---------------------------------------------------------------------
  let integrity = 'unchecked';
  if (row.content_hash) {
    integrity = (await contentHash(html)) === row.content_hash ? 'intact' : 'ALTERED';
  }

  const banner = integrity === 'ALTERED'
    ? '<p style="background:#fee;border:2px solid #c00;color:#900;padding:8px;'
      + 'font:bold 10pt sans-serif">This archived copy does not match the hash recorded when '
      + 'it was issued. Do not rely on it. Report it to the University.</p>'
    : '';

  const superseded = row.superseded_at
    ? '<p style="background:#fff8e1;border:1px solid #e0b000;padding:6px;'
      + 'font:10pt sans-serif">This version has been superseded. It was genuine when issued '
      + 'and a later version is now in force.</p>'
    : '';

  const body = banner + superseded + html + (wantsPdf ? PRINT_TRIGGER : '');

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Document-Reference': reference,
      'X-Document-Version': String(row.version ?? ''),
      'X-Document-Integrity': integrity,
      // NEVER CACHED. A superseded letter that a proxy is still serving as
      // current is the failure the whole versioning scheme exists to prevent.
      'Cache-Control': 'no-store, must-revalidate',
    },
  });
}
