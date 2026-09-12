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
import { admissionPackageHtml, admissionCoveringText, admissionPackageInputFor } from '@/lib/admissionPackage';
import { courses, MODE_LABEL } from '@/content/courses';
import { UNIVERSITY } from '@/lib/constants';
import {
  ACADEMIC_DECISIONS, EVENT_FOR_DECISION, canDecide, isDecided, canRetryIssuance, officeFor,
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
    /**
     * Resume an issuance that stopped part way, under the decision ALREADY
     * recorded. The decision is not taken again — it was validly taken and it
     * is immutable — so the trail shows one approval and two issuance
     * attempts, which is what happened.
     */
    retry?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  const { applicationId, reason, conditions, overrideReason, retry } = body;
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
  if (retry) {
    // A RETRY IS NOT A DECISION, so the "already decided" check is exactly
    // backwards here: the whole point is that a decision exists and the
    // issuance under it did not finish.
    if (!canRetryIssuance(app.status)) {
      return NextResponse.json(
        { ok: false, error: 'nothing-to-retry', status: app.status }, { status: 409 },
      );
    }
  } else {
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
  // ---------------------------------------------------------------------
  // A RETRY IS NOT A DECISION, SO THERE IS NOTHING TO JUSTIFY AGAIN.
  //
  // This refused every retry a Superadministrator attempted. The retry button
  // sits on the queue row and does not open the decision panel — there is no
  // decision to compose — so the override reason box was never on screen, and
  // the request went up without one and came back 'override-reason-required'.
  // The one role with the override banner was the one role that could not
  // recover a failed issuance.
  //
  // The requirement is right for a DECISION and wrong for a RETRY. The decision
  // was taken earlier, and if it was an override it was justified in writing at
  // that moment and that reason is on the record. Resuming the issuance
  // underneath it is mechanical: it creates no new authority, which is the
  // whole point of 026 keeping the two apart. The retry is still audited as
  // ISSUANCE_RETRIED against the actor and their office, so it is not silent.
  // ---------------------------------------------------------------------
  if (isOverride && admitting && !retry
      && (!overrideReason || overrideReason.trim().length < 20)) {
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

  if (retry) {
    // Resume under the decision that already exists. If none can be found the
    // request is refused rather than quietly inventing one — an issuance with
    // no decision behind it is the thing this architecture exists to prevent.
    const { data: prior } = await admin
      .from('admission_decisions')
      .select('id')
      .eq('application_id', applicationId)
      .in('decision', ['approve', 'conditional'])
      .order('decision_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!prior?.id) {
      return NextResponse.json(
        { ok: false, error: 'no-decision-to-resume', status: app.status }, { status: 409 },
      );
    }
    decisionId = prior.id;
    await audit('ISSUANCE_RETRIED', undefined, decisionId,
      { from: app.status, to: 'admission_processing' });
  } else try {
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
  if (!admitting && !retry) {
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
  // 3. ISSUANCE BEGINS. The status says so from here until it either finishes
  //    or fails, because `approved` cannot mean both "the Head approved" and
  //    "the University issued" — the University's own distinction, and the
  //    reason migration 026 exists.
  // =======================================================================
  await admin.from('students').update({ status: 'admission_processing' }).eq('id', applicationId);
  await audit('ISSUANCE_STARTED', undefined, decisionId,
    { from: app.status, to: 'admission_processing' });

  /**
   * Stop, recording where it stopped.
   *
   * `admission_processing_failed` is a state the desk can see, name and offer a
   * retry for. What it replaces is `approved` — indistinguishable from an
   * issuance that had never started, and recoverable only by editing rows in
   * the SQL editor.
   */
  const failIssuance = async (step: string, detail: string, status = 500) => {
    await admin.from('students')
      .update({ status: 'admission_processing_failed' }).eq('id', applicationId);
    await audit('ISSUANCE_FAILED', `${step}: ${detail}`, decisionId,
      { from: 'admission_processing', to: 'admission_processing_failed' }, { step });
    return NextResponse.json(
      { ok: false, error: `issuance-failed`, step, detail, decisionId, retryable: true },
      { status },
    );
  };

  // =======================================================================
  // 3b. THE ADMISSION PACKAGE, before anything is created for the student.
  // =======================================================================
  const fullName = [app.first_name, app.middle_name, app.last_name].filter(Boolean).join(' ');
  const intakeYear = Number(app.admission_year) || new Date().getFullYear();
  const programme = courses.find((c) => c.code === programmeCode);

  let packageHtml: string;
  let packageInput: Parameters<typeof admissionPackageHtml>[0];
  try {
    // BUILT BY THE SHARED FUNCTION, not composed here. The letter can now be
    // viewed and resent afterwards, and a second place assembling these
    // particulars would be a second opinion about what the letter says.
    packageInput = admissionPackageInputFor(app, {
      studentNumber: 'PENDING',
      portalUrl: `${process.env.SITE_URL ?? 'https://iguc.net'}/portal`,
      programme: programme
        ? { faculty: programme.faculty, level: programme.level, modeLabel: MODE_LABEL[programme.mode] }
        : undefined,
      conditions: decision === 'conditional' ? conditions : undefined,
    });
    packageHtml = await admissionPackageHtml(packageInput);

    // ---------------------------------------------------------------------
    // WHETHER IT CAME OUT SEALED IS RECORDED, because otherwise it is
    // invisible. documentSecurity.ts returns an unsealed document when
    // CREDENTIAL_SECRET is absent or under 32 characters — the letter still
    // generates, still carries the signature, and simply has no seal panel and
    // no QR. Nothing on its face says so.
    //
    // A letter that reaches an embassy without the check code cannot be fixed
    // afterwards without reissuing, so the audit trail says which letters went
    // out sealed and which did not. `sealed` is read from the rendered
    // document rather than from the environment: what matters is what the
    // applicant received, not what the server believed it was configured with.
    // ---------------------------------------------------------------------
    const sealed = /Document seal/.test(packageHtml) && !/not sealed/i.test(packageHtml);
    await audit('ADMISSION_LETTER_GENERATED', sealed ? undefined : 'issued WITHOUT a document seal',
      decisionId, undefined,
      { programme: programmeCode, mode: packageInput.mode, sealed });
  } catch (e) {
    return failIssuance('generate the admission package', String(e));
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
  const metadata = {
    full_name: fullName, role: 'student',
    student_number: studentNumber, matric_no: app.matric_no, program: app.program,
  };

  let authUserId: string | undefined;
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: app.email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (created?.user?.id) {
    authUserId = created.user.id;
  } else if (/already.*registered|email.?exists|already been registered/i.test(authErr?.message ?? '')) {
    // ---------------------------------------------------------------------
    // A RETRY MUST NOT TRIP OVER ITS OWN LAST ATTEMPT.
    //
    // An issuance that created the account and then failed at a later step
    // leaves the account behind. On the next retry `createUser` refuses the
    // address, so the recovery path the University was promised refused every
    // application it was most needed for — the ones that had got furthest.
    //
    // The account is reused rather than duplicated, and its password is reset
    // to the temporary one that goes out with this letter, so the credentials
    // the applicant receives are the credentials that work.
    // ---------------------------------------------------------------------
    const { data: existing } = await admin
      .from('profiles').select('id, role').eq('email', app.email).maybeSingle();

    if (!existing?.id) {
      return failIssuance('create the account',
        'that email address is already registered but no profile could be found for it');
    }
    // NEVER RESET A STAFF PASSWORD. If the address already belongs to somebody
    // who is not a student, reusing it would hand an applicant an account with
    // another person's authority. That is a refusal, not a recovery.
    if (existing.role && existing.role !== 'student') {
      return failIssuance('create the account',
        `that email address already belongs to a ${existing.role} account. An applicant cannot be `
        + 'admitted onto a member of staff’s login; correct the address on the application first.');
    }

    const { error: resetErr } = await admin.auth.admin.updateUserById(existing.id, {
      password, email_confirm: true, user_metadata: metadata,
    });
    if (resetErr) return failIssuance('create the account', resetErr.message);
    authUserId = existing.id;
    await audit('ACCOUNT_CREATED', 'reused the account a previous attempt had created',
      decisionId, undefined, { reused: true });
  }

  if (!authUserId) {
    // THE BOUNDARY THE UNIVERSITY ASKED TO BE PROVED. The decision stands, the
    // letter exists, the number is reserved, and there is no account — so the
    // record says admission_processing_failed and not a word more.
    return failIssuance('create the account', authErr?.message ?? 'no id returned');
  }

  const { error: profErr } = await admin.from('profiles').upsert(
    { id: authUserId, email: app.email, full_name: fullName, role: 'student' },
    { onConflict: 'id' },
  );
  if (profErr) {
    return failIssuance('create the profile', profErr.message);
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
    // ---------------------------------------------------------------------
    // THIS RETURNED WITHOUT MARKING THE FAILURE, and the University found it:
    // an application sat in `admission_processing` — reading as an issuance
    // still in progress — for ever, with no ISSUANCE_FAILED entry in the
    // trail. Every other failure in this function goes through failIssuance
    // and this one did not, which is exactly the state 026 exists to abolish.
    //
    // The decision stands and the account exists; what did not happen is the
    // record being marked issued. That is recoverable, so it is recorded as a
    // failed issuance like any other and the desk offers the retry.
    // ---------------------------------------------------------------------
    return failIssuance('mark the admission issued', updErr.message);
  }
  // THE LETTER IS REBUILT WITH THE REAL NUMBER. It was generated at step 3
  // before the number existed, to prove it COULD be generated before anything
  // was created for the student — but a letter that says PENDING where the
  // student number belongs is not a document anybody can use.
  packageInput = { ...packageInput, studentNumber, temporaryPassword: password };
  packageHtml = await admissionPackageHtml(packageInput);

  // =======================================================================
  // 7b. THE LETTER IS KEPT, BEFORE ANYTHING IS ATTEMPTED WITH IT.
  //
  // The University's own point: a letter that is generated and does not go
  // should still be somewhere. Written BEFORE the send rather than after it,
  // because a copy made only on success is a copy that does not exist in the
  // one case it is needed for — and a crash between generating and sending
  // would lose it entirely.
  //
  // It is the record of what was ISSUED, not a retry buffer. Rebuilding from
  // the application gives today's template; this is what the applicant
  // actually received.
  // =======================================================================
  let letterId: string | undefined;
  {
    const { data: kept, error: keepErr } = await admin.from('admission_letters').insert({
      application_id: applicationId,
      student_number: studentNumber,
      to_email: app.email,
      issued_on: new Date().toISOString().slice(0, 10),
      sealed: /Document seal/.test(packageHtml) && !/not sealed/i.test(packageHtml),
      html: packageHtml,
      delivery: 'pending',
    }).select('id').maybeSingle();
    // 031 not yet run is the one tolerable failure: the admission still
    // completes and the letter still goes, it is simply not archived.
    if (keepErr && !/does not exist|schema cache/i.test(keepErr.message)) {
      await audit('WELCOME_EMAIL_FAILED', `the letter could not be archived: ${keepErr.message}`,
        decisionId);
    }
    letterId = kept?.id;
  }

  /** Record what became of the letter, on the row that holds it. */
  const recordDelivery = async (sent: boolean, detail?: string) => {
    if (!letterId) return;
    await admin.from('admission_letters').update({
      delivery: sent ? 'sent' : 'failed',
      delivery_detail: sent ? null : (detail ?? null),
      attempts: 1,
      updated_at: new Date().toISOString(),
    }).eq('id', letterId);
  };

  await audit('ADMISSION_PACKAGE_ISSUED', studentNumber, decisionId,
    { from: 'admission_processing', to: 'admission_issued' }, { student_number: studentNumber });

  // =======================================================================
  // 8. THE EMAIL, LAST. Delivery is the one step whose failure does not
  //    invalidate anything above it, which is why it is last and why the
  //    password comes back in the response when it fails: an admitted student
  //    who never hears anything is the worst outcome available.
  // =======================================================================
  if (!mailConfigured()) {
    await audit('WELCOME_EMAIL_FAILED', 'smtp-not-configured', decisionId);
    // The letter exists and nothing was attempted with it. It sits in the
    // outbox until somebody sends it.
    await recordDelivery(false, 'outbound mail is not configured on this deployment');
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
  // `detail` exists only on the failure branch of MailResult, which is the
  // union doing its job: there is nothing to explain about a message that went.
  await recordDelivery(delivery.sent, delivery.sent ? undefined : delivery.detail);

  return NextResponse.json({
    ok: true, decision, status: 'admission_issued', decisionId,
    emailSent: delivery.sent, studentNumber,
    ...(delivery.sent ? {} : { email: app.email, password, error: `email-failed: ${delivery.detail}` }),
  });
}
