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
  /**
   * 'programme' is the grain the University governs at: the Director of
   * Academic Affairs ticks the named programmes authorised to accept
   * applications, and one that is not ticked stays closed even though the
   * catalogue still lists it. 'level' and 'field' are migration 008's coarser
   * gates and still apply.
   */
  kind: 'level' | 'field' | 'programme';
  /** For a programme this is the course CODE, which is its stable name. */
  label: string;
  faculty: string | null;
  open: boolean;
  note: string | null;
  /** Who authorised it, and when. Null on anything never ticked. */
  approved_by_email?: string | null;
  approved_at?: string | null;
  /** Who last changed it, which is not always who approved it. */
  updated_by_email?: string | null;
  updated_at?: string | null;
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
    .select('kind, label, faculty, open, note, approved_by_email, approved_at, updated_by_email, updated_at')
    .order('kind')
    .order('label');

  if (error) {
    // MIGRATION 008 RUN BUT NOT 023 is a real state, and it looks identical to
    // "table absent" unless it is asked about: the approval columns are missing
    // so the select above fails, and reporting that as unconfigured would take
    // the LEVEL and FIELD gates out of service too. So it retries without them.
    const retry = await db
      .from('admission_openings')
      .select('kind, label, faculty, open, note')
      .order('kind')
      .order('label');
    if (!retry.error) {
      return NextResponse.json({
        ok: true, configured: true, approvalTrail: false, openings: (retry.data ?? []) as Opening[],
      });
    }
    // Table absent, or unreadable. Report it and let the caller fall back to
    // offering everything — see the header.
    return NextResponse.json({ ok: true, configured: false, openings: [], detail: error.message });
  }
  return NextResponse.json({
    ok: true, configured: true, approvalTrail: true, openings: (data ?? []) as Opening[],
  });
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
  const now = new Date().toISOString();

  for (const c of changes) {
    const open = !!c.open;

    // ---------------------------------------------------------------------
    // WHO APPROVED IT IS NOT THE SAME QUESTION AS WHO TOUCHED IT LAST.
    //
    // `updated_by` answers the second and was the only thing recorded. The
    // University asked for both: who authorised the programme, when, and who
    // changed its status afterwards. So opening it STAMPS THE APPROVAL, and
    // closing it leaves that stamp alone — the record of who opened it in the
    // first place is exactly what an audit is asking for, and wiping it on
    // close would destroy the answer at the moment it becomes interesting.
    // ---------------------------------------------------------------------
    const patch: Record<string, unknown> = {
      open,
      note: c.note ?? null,
      updated_by: caller.id,
      updated_by_email: caller.email ?? null,
      updated_at: now,
    };
    if (open) {
      patch.approved_by = caller.id;
      patch.approved_by_email = caller.email ?? null;
      patch.approved_at = now;
    }

    const { data, error } = await admin
      .from('admission_openings')
      .update(patch)
      .eq('kind', c.kind)
      .eq('label', c.label)
      .select('id, open');
    if (error) {
      return NextResponse.json({ ok: false, error: `update-failed: ${error.message}` }, { status: 500 });
    }
    if (!data || data.length === 0) { missing.push(`${c.kind}:${c.label}`); continue; }
    changed += data.length;

    // The trail. Appended after the row is known to have changed, so it never
    // claims a decision that did not land. A failure to write it is reported
    // rather than swallowed: an approval nobody can account for afterwards is
    // the thing this table exists to prevent.
    const { error: trailError } = await admin.from('admission_opening_events').insert(
      data.map((row: { id: string }) => ({
        opening_id: row.id,
        kind: c.kind,
        label: c.label,
        action: open ? 'opened' : 'closed',
        actor_id: caller.id,
        actor_email: caller.email ?? null,
        actor_role: caller.role ?? null,
        note: c.note ?? null,
      })),
    );
    if (trailError && !/does not exist|schema cache/i.test(trailError.message)) {
      return NextResponse.json(
        { ok: false, error: `trail-failed: ${trailError.message}` }, { status: 500 },
      );
    }
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
