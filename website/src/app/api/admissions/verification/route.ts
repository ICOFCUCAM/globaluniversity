// ---------------------------------------------------------------------------
// THE VERIFICATION STEPS — the three states nothing could write.
//
//   POST /api/admissions/verification  { applicationId, step, note? }
//
//   step: 'open' | 'request-fee' | 'verify-documents'
//
// ---------------------------------------------------------------------------
// WHY
// ---------------------------------------------------------------------------
//
// `under_review`, `fee_pending` and `documents_verified` were declared in 024,
// seeded into `admission_states`, listed on the desks that were supposed to
// show them, and unreachable. The University had decided those three things
// existed and its system could not produce any of them, so a registrar asking
// "has anyone looked at this?" got the same answer for an application opened
// that morning and one that had sat untouched for a month.
//
// ---------------------------------------------------------------------------
// ONE ROUTE, THREE STEPS, AND NOT THREE ROUTES
// ---------------------------------------------------------------------------
//
// The last time this system had two endpoints doing one job — /admit and
// /approve — which document an admitted student received depended on which
// desk the approver happened to be sitting at. Both are now retired and return
// 410. Three near-identical routes with three copies of the audit write would
// be that fault again, in slow motion.
//
// So the step is a parameter, VERIFICATION_STEPS is the only place that says
// what any of them mean, and this route reads it. The capability is read off
// the step rather than fixed here, which is what keeps Finance's fee request
// out of the Admissions Office's capability and vice versa.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { guard } from '@/lib/adminAuth';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';
import type { Capability } from '@/lib/roles';
import {
  VERIFICATION_STEPS,
  isVerificationStep,
  canTakeVerificationStep,
  officeFor,
  MIN_VERIFICATION_NOTE,
} from '@/lib/admissionWorkflow';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: { applicationId?: string; step?: string; note?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  const stepKey = String(body.step ?? '');
  if (!isVerificationStep(stepKey)) {
    return NextResponse.json({
      ok: false,
      error: 'unknown-step',
      detail: `Not a verification step. The steps are: ${Object.keys(VERIFICATION_STEPS).join(', ')}.`,
    }, { status: 400 });
  }
  const step = VERIFICATION_STEPS[stepKey];

  if (!body.applicationId) {
    return NextResponse.json({ ok: false, error: 'missing-application-id' }, { status: 400 });
  }

  // THE CAPABILITY COMES FROM THE STEP. Checked before anything is read, and
  // checked server-side against the role in the database — the portal hiding a
  // button is courtesy, and this endpoint is reachable with curl.
  const g = await guard(request, step.capability as Capability);
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { caller } = g;

  const note = (body.note ?? '').trim();
  if (step.needsNote && note.length < MIN_VERIFICATION_NOTE) {
    return NextResponse.json({
      ok: false,
      error: 'step-needs-a-note',
      detail: 'Recording documents as verified is a positive statement somebody has to stand '
        + 'behind. Say what was checked.',
    }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ ok: false, error: 'service-role-key-missing' }, { status: 500 });
  }
  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: app } = await admin
    .from('students').select('id, status').eq('id', body.applicationId).maybeSingle();
  if (!app) {
    return NextResponse.json({ ok: false, error: 'application-not-found' }, { status: 404 });
  }

  // REFUSING A STEP THAT WOULD NOT MOVE ANYTHING IS NOT PEDANTRY. Opening an
  // application that is already open appends an event saying a second person
  // opened it later, and the trail then reads as though it had been opened
  // twice by two offices.
  if (!canTakeVerificationStep(stepKey, app.status)) {
    return NextResponse.json({
      ok: false,
      error: 'step-not-available-from-here',
      status: app.status,
      detail: app.status === step.to
        ? `This application is already ${step.to.replace(/_/g, ' ')}.`
        : `“${step.label}” cannot be taken from ${String(app.status).replace(/_/g, ' ')}.`,
      availableFrom: step.from,
    }, { status: 409 });
  }

  const { error: updErr } = await admin
    .from('students').update({ status: step.to }).eq('id', body.applicationId);
  if (updErr) {
    return NextResponse.json({
      ok: false, error: `step-not-recorded: ${updErr.message}`,
    }, { status: 500 });
  }

  // The trail, after the move. A step that took effect must not be reported as
  // failed because the log write failed — but it must not be silent either, so
  // the failure comes back in the response.
  const { error: logErr } = await admin.from('admission_audit_log').insert({
    application_id: body.applicationId,
    event: step.event,
    actor_id: caller.id,
    actor_email: caller.email ?? null,
    actor_role: caller.role ?? null,
    actor_office: officeFor(caller.role),
    previous_state: app.status,
    new_state: step.to,
    detail: note || null,
    metadata: { step: stepKey, from: app.status },
  });

  return NextResponse.json({
    ok: true,
    step: stepKey,
    status: step.to,
    from: app.status,
    trailWritten: !logErr,
    ...(logErr ? { trailError: logErr.message } : {}),
  });
}
