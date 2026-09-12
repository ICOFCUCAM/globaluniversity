// ---------------------------------------------------------------------------
// ENROLMENT — the fifth stage, and the end of the journey.
//
//   POST /api/admissions/enrol     { applicationId }
//   POST /api/admissions/enrol     { applicationId, withdraw: true, reason }
//
// ---------------------------------------------------------------------------
// WHY
// ---------------------------------------------------------------------------
//
// `enrolled` has been in the vocabulary since 024 and nothing could produce
// it. An issued admission was the last state a student could reach, so the
// University could say it had admitted somebody and could not say whether they
// had ever taken up the place.
//
// That is not bookkeeping. An admitted applicant who never enrols is a place
// that could have gone to somebody else, and until now they were
// indistinguishable from a student sitting in a lecture.
//
// ---------------------------------------------------------------------------
// AND WITHDRAWAL, WHICH WAS RECORDED AS A REFUSAL
// ---------------------------------------------------------------------------
//
// An applicant who wrote to say they no longer wanted the place was marked
// `declined` — refused, by the Registrar, in the University's own records,
// having been refused by nobody. Wrong about who decided and wrong about what
// happened, on a record somebody may one day have to explain.
//
// It lives in this route rather than its own because it is the same office
// making the same kind of factual record: the Registrar writing down what
// became of an admission, rather than anybody deciding anything.
//
// WITHDRAWAL REVOKES NOTHING. A student who withdraws after an admission was
// issued keeps the letter and the account; the register says they withdrew and
// `withdrawn_from` says what from. Revoking a credential is a different act
// with its own authority, and folding it in here would hide it.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { guard } from '@/lib/adminAuth';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';
import { canEnrol, canWithdraw, officeFor, MIN_WITHDRAW_REASON } from '@/lib/admissionWorkflow';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  // The Registrar's. Enrolment is the Registrar completing the student's
  // academic record, and it is deliberately NOT 'decide-admission': nothing
  // here is an academic judgement.
  const g = await guard(request, 'create-student-record');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { caller } = g;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ ok: false, error: 'service-role-key-missing' }, { status: 500 });
  }

  let body: { applicationId?: string; withdraw?: boolean; reason?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }
  if (!body.applicationId) {
    return NextResponse.json({ ok: false, error: 'missing-application-id' }, { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: app } = await admin
    .from('students').select('*').eq('id', body.applicationId).maybeSingle();
  if (!app) {
    return NextResponse.json({ ok: false, error: 'application-not-found' }, { status: 404 });
  }

  const office = officeFor(caller.role, caller.role === 'superadmin' ? 'registrar' : undefined);
  const audit = async (event: string, detail: string | null, to: string) => {
    const { error } = await admin.from('admission_audit_log').insert({
      application_id: body.applicationId,
      event,
      actor_id: caller.id,
      actor_email: caller.email ?? null,
      actor_role: caller.role ?? null,
      actor_office: office,
      previous_state: app.status,
      new_state: to,
      detail,
      metadata: { from: app.status },
    });
    // 034 not yet run is the one tolerable failure: the record still moves.
    if (error && !/does not exist|schema cache/i.test(error.message)) throw new Error(error.message);
  };

  // =====================================================================
  // WITHDRAWAL
  // =====================================================================
  if (body.withdraw) {
    const reason = (body.reason ?? '').trim();
    if (reason.length < MIN_WITHDRAW_REASON) {
      return NextResponse.json({ ok: false, error: 'withdrawal-needs-a-reason' }, { status: 400 });
    }
    if (!canWithdraw(app.status)) {
      return NextResponse.json({
        ok: false, error: 'nothing-to-withdraw-from', status: app.status,
        detail: 'This application is already closed, so there is nothing to withdraw from.',
      }, { status: 409 });
    }

    const { error } = await admin.from('students').update({
      status: 'withdrawn',
      withdrawn_from: app.status,
      withdrawn_reason: reason,
      withdrawn_at: new Date().toISOString(),
      withdrawn_by: caller.id,
    }).eq('id', body.applicationId);
    if (error) {
      return NextResponse.json({ ok: false, error: `not-withdrawn: ${error.message}` }, { status: 500 });
    }
    try { await audit('WITHDRAWN', reason, 'withdrawn'); } catch { /* recorded above */ }

    return NextResponse.json({
      ok: true, status: 'withdrawn', withdrewFrom: app.status,
      // The caller needs to know what did NOT happen.
      hadBeenIssued: app.status === 'admission_issued' || app.status === 'enrolled',
    });
  }

  // =====================================================================
  // ENROLMENT
  // =====================================================================
  if (!canEnrol(app.status)) {
    return NextResponse.json({
      ok: false, error: 'not-issued', status: app.status,
      detail: 'Only an issued admission can be enrolled. A student cannot take up a place the '
        + 'University has not yet offered them.',
    }, { status: 409 });
  }

  const { error } = await admin.from('students').update({
    status: 'enrolled',
    enrolled_at: new Date().toISOString(),
    enrolled_by: caller.id,
  }).eq('id', body.applicationId);
  if (error) {
    return NextResponse.json({ ok: false, error: `not-enrolled: ${error.message}` }, { status: 500 });
  }
  try { await audit('ENROLLED', null, 'enrolled'); } catch { /* recorded above */ }

  return NextResponse.json({ ok: true, status: 'enrolled', studentNumber: app.student_number });
}
