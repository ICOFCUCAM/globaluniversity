// ---------------------------------------------------------------------------
// WHAT A STRANGER IS TOLD ABOUT A DOCUMENT THEY ARE HOLDING.
//
//   GET /api/document?reference=APT-2026-0042
//   GET /api/document?reference=VC-2026-0042
//
// ---------------------------------------------------------------------------
// PUBLIC ON PURPOSE, AND NARROW FOR THE SAME REASON
// ---------------------------------------------------------------------------
//
// The reader of an appointment letter is a bank, an embassy or another
// university. They have no account here and never will, so this route takes no
// authentication — which makes what it returns the entire security design.
//
// It reads the two verification VIEWS and nothing else. Those views were
// written to be read by strangers: the appointment one carries the holder and
// the post because that is what is being checked, and carries no salary, no
// terms and no contact details. The correspondence one carries no recipient and
// no subject at all, because a warning letter is correspondence and a page that
// printed "To: [name] — Subject: Final written warning" would publish a
// disciplinary record to anybody who scanned a code off a desk.
//
// ---------------------------------------------------------------------------
// IT ANSWERS "IS THIS GENUINE", NOT "IS THIS SIGNED"
// ---------------------------------------------------------------------------
//
// The signature is checked separately, by /api/credential, against the payload
// in the QR code. The two can disagree and the disagreement is the interesting
// part: a correctly sealed document that is not on the register was generated
// with the key and never issued. So this route reports the REGISTER, and the
// page shows both.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** APT-2026-0042 or VC-2026-0042. Nothing else is a reference. */
const REFERENCE = /^[A-Z]{2,4}-\d{4}-\d{4,}$/;

// A SINGLE STRING LITERAL each. Concatenation makes supabase-js collapse the
// inferred row type to GenericStringError[], silently.
// eslint-disable-next-line max-len
const APPOINTMENT_COLUMNS = 'reference, document, holder, position, unit, issued, version, status, current_version, signature_mode';
// eslint-disable-next-line max-len
const CORRESPONDENCE_COLUMNS = 'reference, document, kind, office, issued, version, status, current_version, signature_mode';

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('reference') ?? '';
  const reference = raw.trim().toUpperCase();

  if (!REFERENCE.test(reference)) {
    return NextResponse.json({
      ok: false,
      found: false,
      note: 'That is not the shape of an ICOF Global University document reference. A reference '
        + 'reads like APT-2026-0042, and is printed at the head of the letter as '
        + 'IGUC/HR/APT/2026/0042.',
    }, { status: 400 });
  }

  // ANON, NOT THE SERVICE ROLE. This route is public, and a public route
  // holding the service-role key is one bug away from being a public route that
  // reads the whole database. The two views are granted to `anon` precisely so
  // this can be done with no privilege at all.
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    return NextResponse.json({ ok: false, error: 'not-configured' }, { status: 500 });
  }
  const db = createClient(SUPABASE_URL, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ---- The appointment register ------------------------------------------
  const { data: appointment } = await db
    .from('appointment_letter_verification')
    .select(APPOINTMENT_COLUMNS)
    .eq('reference', reference)
    .maybeSingle();

  if (appointment) {
    const a = appointment as Record<string, unknown>;
    return NextResponse.json({
      ok: true,
      found: true,
      document: 'Appointment Letter',
      reference,
      status: a.status,
      // WHAT THE MOCKUP ASKED FOR AND NOTHING MORE. The holder and the post
      // are the two facts a verifier is checking. There is no salary here and
      // there is no salary in the view behind it.
      holder: a.holder,
      position: a.position,
      unit: a.unit || null,
      issued: a.issued,
      version: a.version,
      currentVersion: a.current_version,
      signatureMode: a.signature_mode,
      ...(a.status === 'Superseded' ? {
        note: `This letter was genuine and has been replaced. Version ${a.current_version} is `
          + 'the one in force. A superseded letter is not a forgery, and the University will '
          + 'confirm the current version on request.',
      } : {}),
    });
  }

  // ---- The correspondence register ---------------------------------------
  const { data: letter } = await db
    .from('correspondence_verification')
    .select(CORRESPONDENCE_COLUMNS)
    .eq('reference', reference)
    .maybeSingle();

  if (letter) {
    const c = letter as Record<string, unknown>;
    return NextResponse.json({
      ok: true,
      found: true,
      document: 'Official Correspondence',
      reference,
      status: c.status,
      // NO RECIPIENT AND NO SUBJECT. See the view's own comment: this is the
      // whole reason correspondence has a different shape from an appointment.
      kind: c.kind,
      office: c.office,
      issued: c.issued,
      version: c.version,
      currentVersion: c.current_version,
      signatureMode: c.signature_mode,
    });
  }

  // ---------------------------------------------------------------------
  // NOT FOUND IS NOT "FORGED", AND THE WORDING MATTERS.
  //
  // A reference the register does not hold is most often a typo, or a document
  // issued before this register existed. Telling a bank that somebody's letter
  // is fraudulent on that evidence would cost somebody a job.
  // ---------------------------------------------------------------------
  return NextResponse.json({
    ok: true,
    found: false,
    reference,
    note: 'No document with this reference is on the University’s register. That may mean '
      + 'the reference was mistyped, or that the document predates the register. It is not by '
      + 'itself evidence that the document is not genuine — write to the University to '
      + 'confirm.',
  });
}
