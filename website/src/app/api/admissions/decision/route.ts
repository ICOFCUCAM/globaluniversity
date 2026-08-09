// ---------------------------------------------------------------------------
// THE ONE ACADEMIC ADMISSION DECISION.
//
//   POST /api/admissions/decision
//   { applicationId, decision: 'approve'|'conditional'|'reject'|'return',
//     reason?, conditions?, overrideReason? }
//
// ---------------------------------------------------------------------------
// WHY THERE IS ONLY ONE
// ---------------------------------------------------------------------------
//
// There were two. /api/admissions/approve and /api/admissions/admit both
// admitted a student, and only the second generated the admission package — so
// whether an admitted student received the letter that admits them depended on
// which desk the approver happened to be sitting at. Institutional policy
// cannot be a function of which button was reachable.
//
// This is the whole workflow, once. The two older routes remain, so nothing
// in flight breaks, but neither is where the decision belongs.
//
// ---------------------------------------------------------------------------
// THE ORDER, WHICH IS THE DESIGN
// ---------------------------------------------------------------------------
//
//   1  re-verify everything against the database
//   2  record the decision            (immutable, migration 024)
//   3  generate the admission package
//   4  reserve the student number     (concurrency-safe, migration 024)
//   5  create the account
//   6  create the profile
//   7  mark the admission ISSUED
//   8  send the welcome email
//
// The rule the order enforces: NO STEP MAY LEAVE THE APPLICANT LOOKING MORE
// ADMITTED THAN THEY ARE. The status only reaches `admission_issued` at step 7,
// once the document exists and there is an account behind it. A failure part
// way leaves a recorded decision and an audit trail saying exactly how far it
// got — recoverable — rather than a student who has been told they are
// admitted and has neither letter nor account.
//
// Every step appends to admission_audit_log, so "the letter was generated but
// the email never arrived" is a question the database can answer.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { guard } from '@/lib/adminAuth';
import { send, mailConfigured } from '@/lib/mailer';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';
import { admissionPackageHtml, admissionCoveringText } from '@/lib/admissionPackage';
import { courses, MODE_LABEL } from '@/content/courses';
import { UNIVERSITY } from '@/lib/constants';
import {
  ACADEMIC_DECISIONS, EVENT_FOR_DECISION, canDecide, isDecided, officeFor,
  type AcademicDecision, type AdmissionEvent,
} from '@/lib/admissionWorkflow';

export const runtime = 'nodejs';

/** Readable, unambiguous initial password — no l/1/O/0. */
function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from(randomBytes(14), (b) => alphabet[b % alphabet.length]).join('');
}

export async function POST(request: Request) {
  // -----------------------------------------------------------------------
  // WHO MAY DO THIS. 'decide-admission', which only the Head of Academic
  // Affairs and the Superadministrator hold. Deliberately NOT 'admit-student':
  // the Admissions Office prepares and verifies, and the academic decision is
  // a different act by a different office.
  // -----------------------------------------------------------------------
  const g = await guard(request, 'decide-admission');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { caller } = g;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    // Refuse loudly. A silent fallback to the anon key would update the status
    // and create no account, so the applicant would be emailed credentials
    // that do not exist.
    return NextResponse.json({ ok: false, error: 'service-role-key-missing' }, { status: 500 });
  }

  let body: {
    applicationId?: string;
    decision?: AcademicDecision;
    reason?: string;
    conditions?: { requirement: string; dueBy: string }[];
    overrideReason?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  const { applicationId, reason, conditions, overrideReason } = body;
  const decision = body.decision as AcademicDecision;
  if (!applicationId) {
    return NextResponse.json({ ok: false, error: 'missing-application-id' }, { status: 400 });
  }
  if (!decision || !(decision in ACADEMIC_DECISIONS)) {
    return NextResponse.json({ ok: false, error: 'unknown-decision' }, { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Attribution beyond a user id. An academic decision is attributable, and
  // that means more than an account when an account is shared.
  const actorIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = request.headers.get('user-agent') ?? null;

  const audit = async (
    event: AdmissionEvent,
    detail?: string,
    decisionId?: string,
    states?: { from?: string | null; to?: string | null },
    metadata?: Record<string, unknown>,
  ) => {
    const { error } = await admin.from('admission_audit_log').insert({
      application_id: applicationId,
      decision_id: decisionId ?? null,
      event,
      actor_id: caller.id,
      actor_email: caller.email ?? null,
      actor_role: caller.role ?? null,
      // THE OFFICE, WHICH IS NOT THE ROLE. During an override the person is an
      // administrator and the authority exercised is Academic Affairs'; an
      // audit that recorded only the role would make the two look the same.
      actor_office: officeFor(caller.role, caller.role === 'superadmin' ? 'academic-office' : undefined),
      previous_state: states?.from ?? null,
      new_state: states?.to ?? null,
      actor_ip: actorIp,
      user_agent: userAgent,
      detail: detail ?? null,
      metadata: metadata ?? null,
    });
    // Migration 024 not yet run is the one tolerable failure — the workflow
    // still works, it is simply not yet recorded. Anything else is reported.
    if (error && !/does not exist|schema cache/i.test(error.message)) {
      throw new Error(`audit-failed: ${error.message}`);
    }
  };

  // =======================================================================
  // 1. RE-VERIFY. Nothing the browser said is trusted: the queue it rendered
  //    describes the past, and in that time the fee could have been reversed,
  //    the programme closed, or the decision already taken by somebody else.
  // =======================================================================
  const { data: app, error: readErr } = await admin
    .from('students').select('*').eq('id', applicationId).single();
  if (readErr || !app) {
    return NextResponse.json({ ok: false, error: 'application-not-found' }, { status: 404 });
  }
  if (isDecided(app.status)) {
    return NextResponse.json(
      { ok: false, error: 'already-decided', status: app.status }, { status: 409 },
    );
  }
  if (!canDecide(app.status)) {
    return NextResponse.json(
      { ok: false, error: 'wrong-stage', status: app.status }, { status: 409 },
    );
  }

  const admitting = decision === 'approve' || decision === 'conditional';

  // The programme gate from migration 023, applied to the DECISION and not
  // only to the public form. A programme the University has closed must not be
  // admitted to through a desk either, or the gate is decoration.
  let programmeCode: string | null = null;
  if (admitting) {
    if (!app.email) {
      return NextResponse.json({ ok: false, error: 'no-email' }, { status: 422 });
    }
    const match = courses.find(
      (c) => c.title.toLowerCase() === String(app.program ?? '').toLowerCase()
        || c.code.toLowerCase() === String(app.program ?? '').toLowerCase(),
    );
    programmeCode = match?.code ?? null;
    if (programmeCode) {
      const { data: gate } = await admin
        .from('admission_openings')
        .select('open')
        .eq('kind', 'programme').eq('label', programmeCode)
        .maybeSingle();
      // A missing row is the gate not being in service, not a closed
      // programme — the same rule migration 008 argues for.
      if (gate && gate.open === false) {
        return NextResponse.json(
          { ok: false, error: 'programme-closed', programme: programmeCode }, { status: 409 },
        );
      }
    }
  }

  const isOverride = caller.role === 'superadmin';
  if (isOverride && admitting && (!overrideReason || overrideReason.trim().length < 20)) {
    // The University asked that an administrative override be possible and
    // highly visible. Visible starts with the Superadministrator having to say
    // what could not wait, in writing, at the moment they take the decision.
    return NextResponse.json(
      { ok: false, error: 'override-reason-required' }, { status: 400 },
    );
  }

  // =======================================================================
  // 2. RECORD THE DECISION. First, because it is the fact everything below
  //    follows from, and because a decision that was taken and not recorded
  //    is the failure this whole migration exists to prevent.
  // =======================================================================
  const newStatus = ACADEMIC_DECISIONS[decision].becomes;
  let decisionId: string | undefined;
  try {
    const { data: rec, error } = await admin.from('admission_decisions').insert({
      application_id: applicationId,
      decision,
      decision_type: isOverride ? 'administrative-override' : 'academic',
      decided_by: caller.id,
      decided_by_email: caller.email ?? null,
      // The role AT THE TIME, copied. A person's role changes; the office that
      // took the decision does not.
      decided_by_role: caller.role ?? null,
      reason: reason ?? null,
      conditions: conditions?.length ? conditions : null,
      previous_status: app.status,
      new_status: newStatus,
      is_override: isOverride,
      override_of: isOverride ? 'academic-office' : null,
      override_reason: isOverride ? overrideReason ?? null : null,
    }).select('id').single();
    if (error) {
      if (!/does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json(
          { ok: false, error: `decision-not-recorded: ${error.message}` }, { status: 500 },
        );
      }
      // 024 not yet run. The workflow proceeds unrecorded rather than refusing
      // to admit anybody until somebody runs SQL.
    } else {
      decisionId = rec?.id;
    }
    await audit(EVENT_FOR_DECISION[decision], reason ?? undefined, decisionId,
      { from: app.status, to: newStatus });
    if (isOverride) {
      await audit('ADMINISTRATIVE_OVERRIDE', overrideReason ?? undefined, decisionId,
        { from: app.status, to: newStatus }, { override_of: 'academic-office' });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }

  // -----------------------------------------------------------------------
  // A REJECTION OR A RETURN STOPS HERE. No package, no account, no number —
  // and the status is the decision's own, not `admission_issued`.
  // -----------------------------------------------------------------------
  if (!admitting) {
    const { error } = await admin.from('students').update({
      status: newStatus,
      decided_by: caller.id,
      decided_at: new Date().toISOString(),
      decision_reason: reason ?? null,
    }).eq('id', applicationId);
    if (error) {
      return NextResponse.json(
        { ok: false, error: `decision-recorded-but-status-not-updated: ${error.message}` },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, decision, status: newStatus, decisionId });
  }

  // =======================================================================
  // 3. THE ADMISSION PACKAGE, before anything is created for the student.
  // =======================================================================
  const fullName = [app.first_name, app.middle_name, app.last_name].filter(Boolean).join(' ');
  const intakeYear = Number(app.admission_year) || new Date().getFullYear();
  const programme = courses.find((c) => c.code === programmeCode);

  let packageHtml: string;
  let packageInput: Parameters<typeof admissionPackageHtml>[0];
  try {
    packageInput = {
      fullName: fullName || 'Applicant',
      studentNumber: 'PENDING',
      dateOfBirth: app.date_of_birth ?? undefined,
      gender: app.gender ?? undefined,
      nationality: app.nationality ?? undefined,
      programme: [app.degree_type, app.program].filter(Boolean).join(' — ') || 'your programme',
      faculty: app.faculty || programme?.faculty || UNIVERSITY.name,
      level: programme?.level ?? app.degree_type ?? '',
      campus: app.campus || 'Buea',
      // THE DELIVERY MODE THE UNIVERSITY APPROVED, from the catalogue rather
      // than from a default. It was `student.mode || 'On campus'`, so a
      // programme taught at a distance produced a letter telling the holder
      // they were expected in Buea — and the terms annexe followed the same
      // wrong value.
      mode: programme ? MODE_LABEL[programme.mode] : (app.mode || 'Campus'),
      attendance: app.attendance || 'Full time',
      intake: app.intake || String(intakeYear),
      applicationNumber: app.matric_no ?? '',
      conditions: decision === 'conditional' ? conditions : undefined,
      // Signed by the office that took the decision. Never by whichever
      // account pressed the button — that would put an administrator's name
      // under a decision they did not make.
      headOfAdmissions: UNIVERSITY.headOfAcademicAffairs,
      postNominals: UNIVERSITY.headOfAcademicAffairsPostNominals,
      registrar: UNIVERSITY.registrar,
      portalUrl: `${process.env.SITE_URL ?? 'https://iguc.net'}/portal`,
    };
    packageHtml = await admissionPackageHtml(packageInput);
    await audit('ADMISSION_LETTER_GENERATED', undefined, decisionId, undefined,
      { programme: programmeCode, mode: packageInput.mode });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `decision-recorded-but-package-not-generated: ${String(e)}`, decisionId },
      { status: 500 },
    );
  }

  // =======================================================================
  // 4. THE STUDENT NUMBER, reserved by the database.
  //
  //    Was: read the highest existing number and add one — so two approvals a
  //    few milliseconds apart computed the same next number and the loser hit
  //    the unique index, showing an error for a decision already taken.
  // =======================================================================
  let studentNumber: string | null = null;
  {
    const { data, error } = await admin.rpc('reserve_student_number', { p_year: intakeYear });
    if (!error && typeof data === 'string') studentNumber = data;
  }
  if (!studentNumber) {
    // 024 not yet run. Fall back to the old derivation rather than refuse — it
    // is the behaviour the University has today, and it is what the fallback
    // is for.
    const prefix = `ICOF${intakeYear}`;
    const { data } = await admin.from('students').select('student_number')
      .like('student_number', `${prefix}%`).order('student_number', { ascending: false }).limit(1);
    const last = (data?.[0] as { student_number?: string } | undefined)?.student_number;
    studentNumber = `${prefix}${String(last ? Number(last.slice(prefix.length)) + 1 : 1).padStart(5, '0')}`;
  }

  // =======================================================================
  // 5 & 6. THE ACCOUNT, THEN THE PROFILE. The portal reads the role from
  //        `profiles`; an account with no profile row cannot sign in, so it
  //        is not an account.
  // =======================================================================
  const password = generatePassword();
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: app.email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName, role: 'student',
      student_number: studentNumber, matric_no: app.matric_no, program: app.program,
    },
  });
  if (authErr || !created?.user?.id) {
    return NextResponse.json(
      { ok: false, error: `decision-recorded-but-account-not-created: ${authErr?.message ?? 'no id'}`, decisionId },
      { status: 500 },
    );
  }
  const authUserId = created.user.id;

  const { error: profErr } = await admin.from('profiles').upsert(
    { id: authUserId, email: app.email, full_name: fullName, role: 'student' },
    { onConflict: 'id' },
  );
  if (profErr) {
    return NextResponse.json(
      { ok: false, error: `account-created-but-profile-not-created: ${profErr.message}`, decisionId },
      { status: 500 },
    );
  }
  await audit('ACCOUNT_CREATED', studentNumber, decisionId, undefined,
    { student_number: studentNumber });

  // =======================================================================
  // 7. ONLY NOW IS THE ADMISSION ISSUED.
  // =======================================================================
  const { error: updErr } = await admin.from('students').update({
    // The academic decision and the issuance are different facts, and the
    // status carries the later one: the student is not merely approved, the
    // admission has been issued and there is a document and an account to
    // show for it.
    status: 'admission_issued',
    admission_conditions: decision === 'conditional' ? JSON.stringify(conditions) : null,
    student_number: studentNumber,
    auth_user_id: authUserId,
    decided_by: caller.id,
    decided_at: new Date().toISOString(),
    account_created_at: new Date().toISOString(),
    decision_reason: reason ?? null,
  }).eq('id', applicationId);
  if (updErr) {
    return NextResponse.json(
      { ok: false, error: `account-created-but-status-not-updated: ${updErr.message}`, decisionId },
      { status: 500 },
    );
  }
  // THE LETTER IS REBUILT WITH THE REAL NUMBER. It was generated at step 3
  // before the number existed, to prove it COULD be generated before anything
  // was created for the student — but a letter that says PENDING where the
  // student number belongs is not a document anybody can use.
  packageInput = { ...packageInput, studentNumber, temporaryPassword: password };
  packageHtml = await admissionPackageHtml(packageInput);

  await audit('ADMISSION_PACKAGE_ISSUED', studentNumber, decisionId,
    { from: newStatus, to: 'admission_issued' }, { student_number: studentNumber });

  // =======================================================================
  // 8. THE EMAIL, LAST. Delivery is the one step whose failure does not
  //    invalidate anything above it, which is why it is last and why the
  //    password comes back in the response when it fails: an admitted student
  //    who never hears anything is the worst outcome available.
  // =======================================================================
  if (!mailConfigured()) {
    await audit('WELCOME_EMAIL_FAILED', 'smtp-not-configured', decisionId);
    return NextResponse.json({
      ok: true, decision, status: 'admission_issued', decisionId,
      emailSent: false, error: 'smtp-not-configured',
      email: app.email, password, studentNumber,
    });
  }

  const delivery = await send({
    to: app.email,
    office: 'Office of Academic Affairs',
    subject: decision === 'conditional'
      ? 'Welcome to ICOF Global University — conditional admission'
      : 'Congratulations! Welcome to ICOF Global University',
    text: admissionCoveringText({ ...packageInput, studentNumber, temporaryPassword: password }),
    html: packageHtml,
  });

  await audit(
    delivery.sent ? 'WELCOME_EMAIL_SENT' : 'WELCOME_EMAIL_FAILED',
    delivery.sent ? app.email : delivery.detail,
    decisionId,
  );

  return NextResponse.json({
    ok: true, decision, status: 'admission_issued', decisionId,
    emailSent: delivery.sent, studentNumber,
    ...(delivery.sent ? {} : { email: app.email, password, error: `email-failed: ${delivery.detail}` }),
  });
}
