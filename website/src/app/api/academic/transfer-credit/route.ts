// ---------------------------------------------------------------------------
// TRANSFER CREDIT: RECORDING A CLAIM, AND DECIDING IT.
//
//   POST /api/academic/transfer-credit  { action: 'record',   studentId, institution, … }
//   POST /api/academic/transfer-credit  { action: 'review',   id }
//   POST /api/academic/transfer-credit  { action: 'accept',   id, creditsAccepted?, courseId? }
//   POST /api/academic/transfer-credit  { action: 'refuse',   id, reason }
//   POST /api/academic/transfer-credit  { action: 'withdraw', id }
//   POST /api/academic/transfer-credit  { action: 'rescind',  id, reason }
//
// ---------------------------------------------------------------------------
// THE UNIVERSITY'S DECISION OF 16 SEPTEMBER 2026
// ---------------------------------------------------------------------------
//
//   "Credit transfer: YES. ICOF accepts transfer credits from other
//    institutions… Approved credits join the authoritative academic record
//    and must reach programme progress, credit totals, graduation eligibility
//    and the transcript. They stay distinguishable from courses completed at
//    ICOF — that distinction is the point, not a detail."
//
// ---------------------------------------------------------------------------
// TWO ACTS, TWO CAPABILITIES
// ---------------------------------------------------------------------------
//
// Recording what a student presented is clerical — the Registry reads another
// institution's transcript and types what it says. Deciding that it stands
// against an ICOF award is an academic judgement about somebody else's
// teaching, and it is the Dean's and the Academic Office's.
//
// ONE CAPABILITY HELD BY BOTH WOULD LET WHOEVER HOLDS IT DO THE WHOLE THING
// ALONE, which is the separation this exists for and the same reasoning 108
// applies to deletions.
//
// ---------------------------------------------------------------------------
// AND THE PATH IS NOT THIS ROUTE'S RULE
// ---------------------------------------------------------------------------
//
// 110 holds it in a database trigger, because 019's table is writable by five
// offices and a rule that lives in one screen is a rule the other four do not
// have. This route asks for a transition and reports what the database says
// when it refuses — it does not re-implement the ladder, which would be a
// second opinion about what order things happen in.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { guard } from '@/lib/adminAuth';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';
import type { Capability } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RECORD = 'record-transfer-credit' as Capability;
const DECIDE = 'approve-transfers' as Capability;

// WHICH HALF EACH ACTION IS. `withdraw` is the Registry's: taking back a claim
// nobody has decided destroys nothing and un-decides nothing.
const CAPABILITY: Record<string, Capability> = {
  record: RECORD,
  review: RECORD,
  withdraw: RECORD,
  accept: DECIDE,
  refuse: DECIDE,
  rescind: DECIDE,
};

const MIN_REASON = 10;

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  const capability = CAPABILITY[action];
  if (!capability) {
    return bad('unknown-action', 400, `They are: ${Object.keys(CAPABILITY).join(', ')}.`);
  }

  const g = await guard(request, capability);
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: capability === DECIDE
        ? 'Deciding that another institution’s teaching counts toward an ICOF award is the '
          + 'Faculty Dean’s and the Academic Office’s. The office that records a claim does '
          + 'not decide it.'
        : 'Recording a transfer credit is the Office of the Registrar’s.',
    }, { status: g.status });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return bad('service-role-key-missing', 500);
  const admin = createClient(
    SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // =========================================================================
  // RECORDING ONE
  // =========================================================================
  if (action === 'record') {
    const studentId = String(body.studentId ?? '');
    const institution = String(body.institution ?? '').trim();
    const courseTitle = String(body.courseTitle ?? '').trim();
    const credits = Number(body.credits ?? 0);

    if (!studentId) return bad('no-student', 400, 'Whose credit is this?');
    // THE INSTITUTION IS NOT OPTIONAL, and 019 says why: "a credit with no
    // source is a credit a receiving institution cannot weigh". It goes on
    // the transcript.
    if (institution.length < 2) {
      return bad('no-institution', 400,
        'Name the institution that taught it. It is printed on the transcript, and a credit '
        + 'with no source is one nobody else can weigh.');
    }
    if (!courseTitle) return bad('no-course', 400, 'What was the course called?');
    if (!Number.isFinite(credits) || credits <= 0) {
      return bad('no-credits', 400, 'How many credits did the other institution give?');
    }

    const { data, error } = await admin.from('transfer_credits').insert({
      student_id: studentId,
      institution,
      course_code: String(body.courseCode ?? '').trim() || null,
      course_title: courseTitle,
      credits,
      source_grade: String(body.sourceGrade ?? '').trim() || null,
      equivalent_course_id: String(body.courseId ?? '') || null,
      note: String(body.note ?? '').trim() || null,
      submitted_by: g.caller.id,
      status: 'submitted',
    }).select('id').single();

    if (error) return bad('not-recorded', 400, error.message);
    return NextResponse.json({
      ok: true,
      id: data?.id,
      detail: `Recorded. ${credits} credits from ${institution}, waiting on the Faculty Dean `
        + 'or the Academic Office. Nothing counts toward the award until it is accepted.',
    });
  }

  // =========================================================================
  // EVERYTHING ELSE ACTS ON ONE CLAIM
  // =========================================================================
  const id = String(body.id ?? '');
  if (!id) return bad('no-claim', 400, 'Which claim?');

  const { data: claim, error: readError } = await admin
    .from('transfer_credits')
    .select('id, student_id, institution, course_title, credits, credits_accepted, status')
    .eq('id', id)
    .maybeSingle();
  if (readError) return bad('read-failed', 500, readError.message);
  if (!claim) return bad('no-such-claim', 404, 'There is no such claim.');

  const patch: Record<string, unknown> = {};

  if (action === 'review') {
    patch.status = 'under_review';
    patch.reviewed_by = g.caller.id;
    patch.reviewed_at = new Date().toISOString();
  } else if (action === 'withdraw') {
    patch.status = 'withdrawn';
    patch.decision_reason = String(body.reason ?? '').trim() || null;
  } else if (action === 'accept') {
    patch.status = 'accepted';
    patch.decided_by = g.caller.id;
    patch.decided_on = new Date().toISOString().slice(0, 10);
    // ACCEPTING LESS THAN WAS OFFERED IS THE ORDINARY CASE, so the figure is
    // taken when it is given and left to the database's own default — the
    // whole of what was offered — when it is not.
    const accepted = Number(body.creditsAccepted ?? NaN);
    if (Number.isFinite(accepted)) {
      if (accepted < 0 || accepted > Number(claim.credits)) {
        return bad('more-than-offered', 400,
          `${claim.institution} gave ${claim.credits} credits. The University cannot accept `
          + `${accepted}.`);
      }
      patch.credits_accepted = accepted;
    }
    if (body.courseId !== undefined) {
      patch.equivalent_course_id = String(body.courseId ?? '') || null;
    }
    patch.decision_reason = String(body.reason ?? '').trim() || null;
  } else if (action === 'refuse' || action === 'rescind') {
    const reason = String(body.reason ?? '').trim();
    if (reason.length < MIN_REASON) {
      return bad('no-reason', 400,
        `Say why — at least ${MIN_REASON} characters. The student is told this, and it is `
        + 'what the file will say in five years.');
    }
    patch.status = action === 'refuse' ? 'refused' : 'rescinded';
    patch.decided_by = g.caller.id;
    patch.decided_on = new Date().toISOString().slice(0, 10);
    patch.decision_reason = reason;
  }

  const { error } = await admin.from('transfer_credits').update(patch).eq('id', id);
  if (error) {
    // THE DATABASE'S OWN SENTENCE, not a reworded one. 110's trigger says
    // exactly what a claim at this status may do next, and rewriting it here
    // would be a second description of a ladder this route does not own.
    return bad('refused', 409, error.message);
  }

  const said: Record<string, string> = {
    review: `${claim.course_title} is with the Dean. Nothing counts yet.`,
    accept: `Accepted. It counts toward the award at once, and is shown apart from credit `
      + `earned at ICOF — it does not touch the GPA.`,
    refuse: `Refused, with the reason on the file. Nothing counts.`,
    withdraw: `Withdrawn. The claim stays on the file saying so.`,
    rescind: `Rescinded. It has come back out of the record and off the progress sheet, and `
      + `the reason is on the file.`,
  };

  return NextResponse.json({ ok: true, detail: said[action] ?? 'Done.' });
}
