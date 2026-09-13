// ---------------------------------------------------------------------------
// CONFERRING A DEGREE — the end of the chain.
//
//   POST /api/academic/graduation  { action, ... }
//
//   confer  { studentId, senateApprovedOn, conferredOn, convocationOn,
//             classification, graduationNumber, despite }
//   revise  { graduationId, convocationOn, classification, graduationNumber }
//   rescind { graduationId, reason }
//
// ---------------------------------------------------------------------------
// THIS ROUTE RECORDS AN ACT. IT DOES NOT PERFORM ONE.
// ---------------------------------------------------------------------------
//
// `src/lib/graduation.ts` says it in its own header: "Whether the Senate has
// resolved to confer… is a meeting, not a computation, and no query stands in
// for it — this establishes that a candidate QUALIFIES, and a human still
// confers."
//
// So `senateApprovedOn` is required, and 019's own constraint refuses a
// conferral dated before it. A degree recorded with no resolution date would
// say the University granted it with no record of deciding to.
//
// ---------------------------------------------------------------------------
// THE ASSESSMENT IS RE-RUN HERE, SERVER-SIDE, AND IT MATTERS
// ---------------------------------------------------------------------------
//
// The screen shows a verdict. A screen's verdict is a claim about what the
// browser was holding when somebody pressed a button, and the row it writes
// outlives the browser by fifty years. So the four checks are made again from
// the database before anything is written.
//
// AND THE FEE CHECK CAN NEVER BE MET. The University keeps no per-student fee
// schedule in this system — `payments` records what was received, nothing
// records what was owed — so `assessGraduation` reports fees as UNKNOWN, and
// no candidate ever fully qualifies by computation.
//
// That is deliberate and it is not worked around here by pretending the
// balance is zero. INDETERMINATE IS NOT REFUSED: a check the system could not
// make is the Senate's to make elsewhere, and blocking every graduation in the
// University on it would mean the Registry conferring degrees on paper. A
// check that is positively UNMET — credits short, CGPA below the minimum — is
// refused, and can only be overridden with a reason that is recorded on the
// row for as long as the degree stands.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard, audit } from '@/lib/adminAuth';
import type { Capability } from '@/lib/roles';
import { assessGraduation, type AwardRule } from '@/lib/graduation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status: number, detail?: string, extra?: Record<string, unknown>) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}), ...extra }, { status });

// NOT EXPORTED — Next.js route files export only handlers and runtime flags.
const CAPABILITY: Capability = 'confer-award' as Capability;
const ACTIONS = ['confer', 'revise', 'rescind'];
const MIN_REASON = 12;

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

// eslint-disable-next-line max-len
const CANDIDATE = 'student_id, full_name, matric_no, status, award_id, award_code, award_title, award_kind, award_credits_required, min_cgpa, cgpa_confirmed, credits_earned, cgpa, admission_conditions, graduation_id';

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  if (!ACTIONS.includes(action)) {
    return bad('unknown-action', 400, `They are: ${ACTIONS.join(', ')}.`);
  }

  const g = await guard(request, CAPABILITY);
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: 'Recording a conferral is held by the offices that keep the degree register. The '
        + 'decision itself is the Senate’s, and this records it.',
    }, { status: g.status });
  }
  const { caller, admin } = g;

  // =========================================================================
  // REVISE — the convocation date, the classification, the number
  // =========================================================================
  //
  // WHAT CANNOT BE REVISED: the student, the award, the Senate's resolution
  // date and the date of conferral. Those four ARE the degree; changing any of
  // them is not a correction, it is a different degree, and it goes through
  // rescind-and-record-again so that both acts are in the log.
  if (action === 'revise') {
    const id = String(body.graduationId ?? '');
    if (!id) return bad('no-record', 400);

    const fields: Record<string, unknown> = {};
    if (body.convocationOn !== undefined) {
      const d = body.convocationOn ? String(body.convocationOn) : null;
      if (d && !isDate(d)) return bad('bad-date', 400, 'A date is YYYY-MM-DD.');
      fields.convocation_on = d;
    }
    if (body.classification !== undefined) {
      fields.classification = body.classification ? String(body.classification) : null;
    }
    if (body.graduationNumber !== undefined) {
      fields.graduation_number = body.graduationNumber ? String(body.graduationNumber) : null;
    }
    if (Object.keys(fields).length === 0) {
      return bad('nothing-to-change', 400, 'Nothing was changed.');
    }

    const { error } = await admin.from('graduation_records').update(fields).eq('id', id);
    if (error) return bad('revise-failed', 500, error.message);
    await audit(admin, {
      action: 'graduation-revised', entityType: 'graduation_record', entityId: id,
      performedBy: caller.id, details: fields,
    });
    return NextResponse.json({ ok: true, detail: 'Saved.' });
  }

  // =========================================================================
  // RESCIND — and it is deliberately hard
  // =========================================================================
  //
  // A degree is rescinded when it should not have been conferred: the record
  // was made in error, or the Senate reversed itself. It is a serious act and
  // the reason is not optional — a register with a degree missing and no
  // explanation is a register nobody can verify against.
  if (action === 'rescind') {
    const id = String(body.graduationId ?? '');
    const reason = String(body.reason ?? '').trim();
    if (!id) return bad('no-record', 400);
    if (reason.length < MIN_REASON) {
      return bad('no-reason', 400,
        'Say why the conferral is being rescinded. A degree removed from the register with no '
        + 'explanation is one nobody can answer a question about afterwards.');
    }

    const { data: found } = await admin.from('graduation_records')
      .select('id, student_id, award_id, conferred_on, certificate_credential_id')
      .eq('id', id).maybeSingle();
    const rec = found as Record<string, unknown> | null;
    if (!rec) return bad('record-not-found', 404);

    // A CERTIFICATE ALREADY ISSUED IS A DOCUMENT IN THE WORLD. Rescinding the
    // record does not recall it, and pretending otherwise is worse than
    // refusing — so this refuses, and names the step that has to happen first.
    if (rec.certificate_credential_id) {
      return bad('certificate-issued', 409,
        'A certificate has been issued against this conferral and is on the credential register. '
        + 'Rescinding the record here would leave a document in the world that this system says '
        + 'was never conferred. Revoke the credential first; then this can be rescinded.');
    }

    // THE AUDIT ENTRY IS WRITTEN BEFORE THE DELETE, not after. If the delete
    // succeeds and the audit write then fails, the register has a degree
    // missing and no record of who removed it — which is the one outcome this
    // whole route exists to prevent.
    await audit(admin, {
      action: 'graduation-rescinded', entityType: 'graduation_record', entityId: id,
      performedBy: caller.id,
      details: {
        student: rec.student_id, award: rec.award_id,
        conferred_on: rec.conferred_on, reason,
      },
    });

    const { error } = await admin.from('graduation_records').delete().eq('id', id);
    if (error) return bad('rescind-failed', 500, error.message);

    return NextResponse.json({
      ok: true,
      detail: 'Rescinded. The reason and the whole of the record it removed are in the audit log '
        + '— the register no longer shows the degree, and the log shows why.',
    });
  }

  // =========================================================================
  // CONFER
  // =========================================================================
  const studentId = String(body.studentId ?? '');
  const senateApprovedOn = String(body.senateApprovedOn ?? '');
  const conferredOn = String(body.conferredOn ?? '');
  if (!studentId) return bad('no-student', 400);
  if (!isDate(senateApprovedOn)) {
    return bad('no-senate-date', 400,
      'The day the Senate resolved to confer is required. Without it the record says the '
      + 'University granted a degree with no record of deciding to.');
  }
  if (!isDate(conferredOn)) {
    return bad('no-conferral-date', 400, 'The day the degree is conferred is required.');
  }
  if (conferredOn < senateApprovedOn) {
    // 019 refuses this with a constraint; this refuses it with a sentence.
    return bad('before-the-senate', 409,
      `The conferral is dated ${conferredOn}, which is before the Senate resolved on `
      + `${senateApprovedOn}. A degree cannot be conferred before it was decided.`);
  }

  const { data: found } = await admin.from('graduation_candidate')
    .select(CANDIDATE).eq('student_id', studentId).maybeSingle();
  const c = found as Record<string, unknown> | null;
  if (!c) {
    return bad('candidate-not-found', 404,
      'No academic record for this student. If migration 067 has not been run, the view this '
      + 'reads does not exist yet.');
  }
  if (c.graduation_id) {
    return bad('already-conferred', 409,
      `${c.award_title ?? 'This award'} has already been conferred on ${c.full_name}. A second `
      + 'is a reissue of the certificate, not a second degree.');
  }

  // ---- THE FOUR CHECKS, MADE AGAIN FROM THE DATABASE ----------------------
  const award: AwardRule | null = c.award_id ? {
    id: String(c.award_id),
    code: String(c.award_code ?? ''),
    title: String(c.award_title ?? ''),
    kind: String(c.award_kind ?? ''),
    creditsRequired: Number(c.award_credits_required ?? 0),
    minCgpa: Number(c.min_cgpa ?? 0),
    cgpaConfirmed: c.cgpa_confirmed === true,
  } : null;

  // UNPARSEABLE CONDITIONS ARE NOT "NONE". Reported as one outstanding item so
  // the case is looked at rather than waved through — the same rule the
  // Certificate Generator applies, and for the same reason.
  let conditions: { requirement: string; dueBy?: string }[] = [];
  try {
    const parsed = c.admission_conditions ? JSON.parse(String(c.admission_conditions)) : [];
    if (Array.isArray(parsed)) conditions = parsed;
  } catch {
    conditions = [{ requirement: 'The recorded admission conditions could not be read' }];
  }

  const verdict = assessGraduation({
    award,
    creditsEarned: Number(c.credits_earned ?? 0),
    cgpa: c.cgpa === null || c.cgpa === undefined ? null : Number(c.cgpa),
    outstandingConditions: conditions,
    // See the header: no per-student fee schedule exists, so this is unknown
    // rather than zero, and unknown does not block a conferral.
    feeBalance: null,
    status: String(c.status ?? ''),
  });

  const unmet = verdict.checks.filter((x) => x.state === 'unmet');
  const despite = String(body.despite ?? '').trim();

  if (unmet.length > 0 && despite.length < MIN_REASON) {
    return bad('does-not-qualify', 409,
      `${c.full_name} does not meet ${unmet.length === 1 ? 'a requirement' : `${unmet.length} requirements`} `
      + `for the ${award?.title ?? 'award'}: `
      + `${unmet.map((x) => `${x.label} — ${x.found} (${x.required})`).join('; ')}. `
      + 'The Senate may still confer, but the reason has to be recorded and it stays on the '
      + 'record for as long as the degree stands.',
      { unmet: unmet.map((x) => ({ label: x.label, required: x.required, found: x.found })) });
  }

  const { data: written, error } = await admin.from('graduation_records').insert({
    student_id: studentId,
    award_id: c.award_id,
    senate_approved_on: senateApprovedOn,
    conferred_on: conferredOn,
    convocation_on: body.convocationOn ? String(body.convocationOn) : null,
    classification: body.classification ? String(body.classification) : null,
    graduation_number: body.graduationNumber ? String(body.graduationNumber) : null,
    conferred_despite: unmet.length > 0 ? despite : null,
    recorded_by: caller.id,
  }).select('id').single();

  if (error) {
    return bad('confer-failed', 409, /duplicate|unique/i.test(error.message)
      ? 'This award has already been conferred on this student.'
      : error.message);
  }

  await audit(admin, {
    action: 'degree-conferred', entityType: 'graduation_record',
    entityId: written.id as string, performedBy: caller.id,
    details: {
      student: studentId,
      award: c.award_code,
      senate_approved_on: senateApprovedOn,
      conferred_on: conferredOn,
      ...(unmet.length > 0 ? { despite, unmet: unmet.map((x) => x.label) } : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    id: written.id,
    detail: unmet.length > 0
      ? `Conferred, over ${unmet.length === 1 ? 'an unmet requirement' : `${unmet.length} unmet requirements`}. `
        + 'The reason is on the record and will appear beside this degree whenever it is read.'
      : `The ${award?.title ?? 'award'} is conferred on ${c.full_name}, resolved `
        + `${senateApprovedOn} and conferred ${conferredOn}. The certificate is issued from the `
        + 'Credentials screen, against this record.',
    // THE INDETERMINATE CHECKS ARE RETURNED, ALWAYS. Fees cannot be
    // established by this system, and a conferral that says nothing about that
    // lets the reader assume it was checked.
    indeterminate: verdict.checks
      .filter((x) => x.state === 'unknown')
      .map((x) => ({ label: x.label, found: x.found, remedy: x.remedy ?? null })),
  });
}
