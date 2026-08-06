// ---------------------------------------------------------------------------
// What the university is currently admitting to.
//
// GET   public. The application form calls this to decide what to offer.
// PATCH guarded. The Head of Academic Affairs opens and closes programmes.
//
// WHY THE GET IS PUBLIC. The application form is on the open web and is used by
// people who have no account. A form that cannot find out what is open without
// a session is a form that cannot work.
//
// WHY A MISSING TABLE MEANS "EVERYTHING IS OPEN". Because the alternative
// silently closes the university's front door. If migration 008 has not been
// run, this route reports `configured: false` and the form falls back to
// offering everything — which is exactly what it did before this existed, so
// deploying the feature changes nothing until somebody uses it. A change that
// stops admissions as a side effect of being deployed is not acceptable.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { guard } from '@/lib/adminAuth';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';

export const runtime = 'nodejs';
// Openings change rarely and are read on every application. Cached briefly so a
// campaign does not hammer the database, short enough that closing a programme
// takes effect while the registrar is still watching.
export const revalidate = 60;

export interface Opening {
  kind: 'level' | 'field';
  label: string;
  faculty: string | null;
  open: boolean;
  note: string | null;
}

function anonClient() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

export async function GET() {
  const db = anonClient();
  if (!db) return NextResponse.json({ ok: true, configured: false, openings: [] });

  const { data, error } = await db
    .from('admission_openings')
    .select('kind, label, faculty, open, note')
    .order('kind')
    .order('label');

  if (error) {
    // Table absent, or unreadable. Report it and let the caller fall back to
    // offering everything — see the header.
    return NextResponse.json({ ok: true, configured: false, openings: [], detail: error.message });
  }
  return NextResponse.json({ ok: true, configured: true, openings: (data ?? []) as Opening[] });
}

export async function PATCH(request: Request) {
  // 'set-admission-openings'. The Head of Academic Affairs decides what the
  // university is ready to teach; the Registrar holds it too, because
  // admissions cannot stall because one office is unstaffed.
  const g = await guard(request, 'set-admission-openings');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin, caller } = g;

  let body: { changes?: { kind: string; label: string; open: boolean; note?: string | null }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }
  const changes = body.changes ?? [];
  if (changes.length === 0) {
    return NextResponse.json({ ok: false, error: 'no-changes' }, { status: 400 });
  }

  // Updated one at a time rather than upserted in bulk, ON PURPOSE. An upsert
  // would INSERT a row for a label that does not exist — so a typo in a client
  // would quietly create a programme nobody teaches and offer it to applicants.
  // An update that matches nothing is a no-op, which is the safe failure.
  let changed = 0;
  const missing: string[] = [];
  for (const c of changes) {
    const { data, error } = await admin
      .from('admission_openings')
      .update({
        open: !!c.open,
        note: c.note ?? null,
        updated_by: caller.id,
        updated_at: new Date().toISOString(),
      })
      .eq('kind', c.kind)
      .eq('label', c.label)
      .select('id');
    if (error) {
      return NextResponse.json({ ok: false, error: `update-failed: ${error.message}` }, { status: 500 });
    }
    if (!data || data.length === 0) missing.push(`${c.kind}:${c.label}`);
    else changed += data.length;
  }

  return NextResponse.json({
    ok: true,
    changed,
    // Reported rather than swallowed: a label the table does not know about
    // means the form and the table have drifted apart, and that is worth
    // seeing before an applicant finds it.
    unmatched: missing,
  });
}
