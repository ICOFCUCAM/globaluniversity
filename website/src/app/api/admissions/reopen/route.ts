// ---------------------------------------------------------------------------
// PUT A DECIDED APPLICATION BACK ON THE DESK.
//
//   POST /api/admissions/reopen  { applicationId, reason }
//
// ---------------------------------------------------------------------------
// WHY
// ---------------------------------------------------------------------------
//
// A decision was final in the only sense the software cared about: once taken,
// the application left every queue and there was no way back. New information
// arriving afterwards — a document reported as forged, a qualification
// misread, an appeal upheld — had nowhere to go.
//
// THE DECISION ALREADY TAKEN IS NOT EDITED. Nothing here alters it.
// admission_decisions has been append-only since 024, so re-evaluation puts
// the application back on the desk and whatever is decided next sits BESIDE
// what was decided before. Both are on the record and the order is legible.
//
// ---------------------------------------------------------------------------
// IT WITHDRAWS NOTHING, AND THAT IS THE PART TO BE CLEAR ABOUT
// ---------------------------------------------------------------------------
//
// Reopening an application whose admission was issued does not revoke the
// letter, close the account or unsend the email. The applicant was told they
// are admitted and still has been. Undoing that is a different act with
// different consequences — and if the new decision differs from the old one,
// somebody has to tell them. The route records what the application was
// reopened FROM precisely so that case is visible rather than inferred.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { guard } from '@/lib/adminAuth';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';
import { isDecided, officeFor, MIN_REOPEN_REASON } from '@/lib/admissionWorkflow';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  // The same authority that decides. Re-evaluation is a decision about a
  // decision, so it belongs to the office that took the first one.
  const g = await guard(request, 'decide-admission');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { caller } = g;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ ok: false, error: 'service-role-key-missing' }, { status: 500 });
  }

  let body: { applicationId?: string; reason?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }
  if (!body.applicationId) {
    return NextResponse.json({ ok: false, error: 'missing-application-id' }, { status: 400 });
  }
  // A DECISION PUT BACK ON THE DESK WITHOUT A STATED REASON is
  // indistinguishable from one somebody simply disagreed with, and it is the
  // only thing the next reader will have to go on.
  const reason = (body.reason ?? '').trim();
  if (reason.length < MIN_REOPEN_REASON) {
    return NextResponse.json({ ok: false, error: 'reopen-needs-a-reason' }, { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: app } = await admin
    .from('students').select('*').eq('id', body.applicationId).maybeSingle();
  if (!app) {
    return NextResponse.json({ ok: false, error: 'application-not-found' }, { status: 404 });
  }
  // ONLY A DECIDED APPLICATION CAN BE REOPENED. One still awaiting a decision
  // is already on the desk, and "reopening" it would overwrite the reason and
  // the timestamp of a re-evaluation that never happened.
  if (!isDecided(app.status) && app.status !== 'returned' && app.status !== 'declined') {
    return NextResponse.json({
      ok: false, error: 'not-decided', status: app.status,
      detail: 'This application has not been decided, so there is nothing to look at again. It is '
        + 'already on the desk.',
    }, { status: 409 });
  }

  const { error: updErr } = await admin.from('students').update({
    status: 'ready_for_academic_review',
    reopened_from: app.status,
    reopened_reason: reason,
    reopened_at: new Date().toISOString(),
    reopened_by: caller.id,
    // Cleared: it is no longer sitting with an upstream office.
    returned_to: null,
  }).eq('id', body.applicationId);
  if (updErr) {
    return NextResponse.json(
      { ok: false, error: `not-reopened: ${updErr.message}` }, { status: 500 },
    );
  }

  const { error: auditErr } = await admin.from('admission_audit_log').insert({
    application_id: body.applicationId,
    event: 'REOPENED_FOR_REEVALUATION',
    actor_id: caller.id,
    actor_email: caller.email ?? null,
    actor_role: caller.role ?? null,
    actor_office: officeFor(caller.role, caller.role === 'superadmin' ? 'academic-office' : undefined),
    previous_state: app.status,
    new_state: 'ready_for_academic_review',
    detail: reason,
    metadata: { reopened_from: app.status, had_been_issued: app.status === 'admission_issued' },
  });
  if (auditErr && !/does not exist|schema cache/i.test(auditErr.message)) {
    // The application HAS moved by this point, so this is reported rather than
    // treated as a refusal — saying it failed would be false.
    return NextResponse.json({
      ok: true, reopenedFrom: app.status, warning: `not-recorded: ${auditErr.message}`,
    });
  }

  return NextResponse.json({
    ok: true,
    reopenedFrom: app.status,
    // The caller needs to know this, and the desk says it out loud: nothing
    // already issued has been withdrawn by reopening.
    hadBeenIssued: app.status === 'admission_issued' || app.status === 'enrolled',
  });
}
