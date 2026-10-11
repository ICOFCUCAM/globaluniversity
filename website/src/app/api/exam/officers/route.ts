// ---------------------------------------------------------------------------
// WHO IS WATCHING THIS EXAMINATION.
//
//   POST /api/exam/officers  { action: 'assign', examinationId, personId, role }
//   POST /api/exam/officers  { action: 'remove', id }
//
// ---------------------------------------------------------------------------
// THE UNIVERSITY'S DECISION OF 16 SEPTEMBER 2026
// ---------------------------------------------------------------------------
//
//   "`assign-proctor` is kept, not retired, and becomes functional when
//    proctoring is built. `examination_officers` is connected to the
//    examination workflow rather than removed."
//
// This is the door. `assign-proctor` has been in the role matrix since it was
// written and nothing in the system has ever checked it — one of the
// capabilities granted with nothing behind it.
//
// ---------------------------------------------------------------------------
// AND IT IS NOW THE THING THAT DECIDES WHO CAN SEE A LIVE SITTING
// ---------------------------------------------------------------------------
//
// Before 111 the answer was nobody: five examination tables had row security
// enabled and no policy, which is invisible rather than open, and the
// Examiner Console showed an empty room to every invigilator without saying
// why. 111 scopes those reads to `examination_officers` — so an appointment
// made here is not an administrative note, it is the thing that opens the
// room. Removing one closes it again.
//
// WHICH IS WHY REMOVING IS GUARDED THE SAME AS ASSIGNING, and why neither is
// left to a screen: the rule that a candidate cannot be an officer of their
// own examination is a database trigger, because the route is not the only
// thing that will ever write here.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { guard } from '@/lib/adminAuth';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';
import { OFFICER_ROLES } from '@/lib/examOfficers';
import type { Capability } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ASSIGN = 'assign-proctor' as Capability;

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  if (action !== 'assign' && action !== 'remove') {
    return bad('unknown-action', 400, 'They are: assign, remove.');
  }

  const g = await guard(request, ASSIGN);
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: 'Appointing an officer to an examination is the Examination Office’s. It is not '
        + 'an administrative note: it is what decides who can see the live room.',
    }, { status: g.status });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return bad('service-role-key-missing', 500);
  const admin = createClient(
    SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  if (action === 'remove') {
    const id = String(body.id ?? '');
    if (!id) return bad('no-appointment', 400, 'Which appointment?');

    // READ BEFORE REMOVING, so the reply can name what was closed rather than
    // report a uuid. The service key reads past 111's policy, which is the
    // one thing it is for here.
    const { data: was } = await admin.from('examination_officers')
      .select('id, role, examination_id, person_id').eq('id', id).maybeSingle();
    if (!was) return bad('no-such-appointment', 404, 'There is no such appointment.');

    const { error } = await admin.from('examination_officers').delete().eq('id', id);
    if (error) return bad('not-removed', 400, error.message);

    return NextResponse.json({
      ok: true,
      detail: `Removed. That ${was.role} can no longer see the room for this examination.`,
    });
  }

  const examinationId = String(body.examinationId ?? '');
  const personId = String(body.personId ?? '');
  const role = String(body.role ?? '');

  if (!examinationId) return bad('no-examination', 400, 'Which examination?');
  if (!personId) return bad('no-person', 400, 'Who is being appointed?');
  if (!OFFICER_ROLES.some((r) => r.role === role)) {
    return bad('unknown-role', 400,
      `An officer is one of: ${OFFICER_ROLES.map((r) => r.role).join(', ')}.`);
  }

  const { error } = await admin.from('examination_officers').insert({
    examination_id: examinationId,
    person_id: personId,
    role,
    assigned_by: g.caller.id,
  });

  if (error) {
    // THE DATABASE'S OWN SENTENCE. 111's trigger refuses a candidate of this
    // examination, and a student or applicant at all, and it says which
    // person and why — rewriting that here would be a second rule.
    if (/duplicate key/i.test(error.message)) {
      return bad('already-appointed', 409,
        `They are already a ${role} on this examination.`);
    }
    return bad('not-appointed', 400, error.message);
  }

  const watching = role === 'invigilator';
  return NextResponse.json({
    ok: true,
    detail: watching
      ? 'Appointed. They can see the live room for this examination from now, and no other.'
      : `Appointed as ${role}. NOTE: only an invigilator is counted as watching the room — an `
        + 'examiner marks afterwards and a moderator checks the marking, and neither is in '
        + 'the room while the paper is being sat.',
  });
}
