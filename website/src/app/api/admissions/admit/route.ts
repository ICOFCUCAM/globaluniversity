// ---------------------------------------------------------------------------
// The Admissions Office admits, and the package goes out.
//
// This is the final gate of the pipeline. Three offices touch an application
// and none of them can do another's work:
//
//   Finance            registers the fee              → fee_paid
//   Registrar          verifies the record, forwards  → registrar_approved
//   Admissions Office  assesses, admits               → approved / conditional
//
// This route is the third step. It refuses anything not in registrar_approved,
// so an application that skipped the Registrar cannot be admitted here even by
// a caller who constructs the request by hand.
//
// WHAT IT DOES, IN ORDER, AND WHY THE ORDER MATTERS:
//
//   1. Issue the student number.
//   2. Create the auth account and its profile.
//   3. Mark the record admitted and link it to the account.
//   4. Build the admission package and email it.
//
// The status is written only after the account exists, so an admitted record
// always has an account behind it. The email goes last because it is the only
// step that cannot be undone — once the applicant has been told they are
// admitted, they have been told.
//
// The package is attached as an HTML file rather than embedded, so the
// applicant keeps a document they can save, print and take to an embassy,
// rather than a message body that renders differently in every client.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { guard, audit, generatePassword } from '@/lib/adminAuth';
import { admissionPackageHtml, admissionCoveringText } from '@/lib/admissionPackage';
import { UNIVERSITY } from '@/lib/constants';

export const runtime = 'nodejs';

/** ICOF + intake year + a five-digit sequence, e.g. ICOF202600451. */
async function nextStudentNumber(admin: { from: (t: string) => any }, year: number): Promise<string> {
  const prefix = `ICOF${year}`;
  const { data } = await admin
    .from('students')
    .select('student_number')
    .like('student_number', `${prefix}%`)
    .order('student_number', { ascending: false })
    .limit(1);
  const last = (data?.[0] as { student_number?: string } | undefined)?.student_number;
  const seq = last ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(5, '0')}`;
}

export async function POST(request: Request) {
  // 'admit-student' is the Registrar's capability in roles.ts and the
  // Admissions Office's here; both offices legitimately hold it, and which of
  // them may act is decided by the record's status rather than by the role.
  const g = await guard(request, 'admit-student');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin, caller } = g;

  let body: {
    studentId?: string;
    note?: string;
    conditions?: { requirement: string; dueBy: string }[];
    headOfAdmissions?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  const { studentId, note, conditions, headOfAdmissions } = body;
  const isConditional = Array.isArray(conditions) && conditions.length > 0;
  if (!studentId) {
    return NextResponse.json({ ok: false, error: 'missing-student-id' }, { status: 400 });
  }

  const { data: student, error: readErr } = await admin
    .from('students')
    .select('*')
    .eq('id', studentId)
    .single();
  if (readErr || !student) {
    return NextResponse.json({ ok: false, error: 'application-not-found' }, { status: 404 });
  }

  // The gate. Only a record the Registrar has verified and forwarded.
  if (student.status !== 'registrar_approved') {
    return NextResponse.json(
      { ok: false, error: `not-forwarded-by-registrar:${student.status}` },
      { status: 409 },
    );
  }
  if (!student.email) {
    return NextResponse.json({ ok: false, error: 'no-email-on-application' }, { status: 422 });
  }

  const password = generatePassword();
  const fullName = [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(' ');
  const intakeYear = Number(student.admission_year) || new Date().getFullYear();
  const studentNumber = await nextStudentNumber(admin, intakeYear);

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: student.email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: 'student',
      student_number: studentNumber,
      matric_no: student.matric_no,
      program: student.program,
    },
  });
  if (authErr) {
    return NextResponse.json(
      { ok: false, error: `account-not-created: ${authErr.message}` },
      { status: 500 },
    );
  }
  const authUserId = created?.user?.id;
  if (!authUserId) {
    return NextResponse.json({ ok: false, error: 'account-created-without-id' }, { status: 500 });
  }

  const { error: profErr } = await admin
    .from('profiles')
    .upsert(
      { id: authUserId, email: student.email, full_name: fullName, role: 'student' },
      { onConflict: 'id' },
    );
  if (profErr) {
    return NextResponse.json(
      { ok: false, error: `account-created-but-profile-not-created: ${profErr.message}` },
      { status: 500 },
    );
  }

  const { error: updErr } = await admin
    .from('students')
    .update({
      status: isConditional ? 'conditional' : 'approved',
      admission_conditions: isConditional ? JSON.stringify(conditions) : null,
      student_number: studentNumber,
      auth_user_id: authUserId,
      decided_by: caller.id,
      decided_at: new Date().toISOString(),
      account_created_at: new Date().toISOString(),
      decision_reason: note ?? null,
    })
    .eq('id', studentId);
  if (updErr) {
    return NextResponse.json(
      { ok: false, error: `account-created-but-status-not-updated: ${updErr.message}` },
      { status: 500 },
    );
  }

  const auditErr = await audit(admin, {
    action: 'admissions.admitted',
    entityType: 'student',
    entityId: studentId,
    performedBy: caller.id,
    details: {
      student_number: studentNumber,
      email: student.email,
      programme: student.program,
      conditional: isConditional,
      by_email: caller.email,
    },
  });

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SITE_URL, MAIL_FROM } = process.env;
  const portalUrl = `${SITE_URL ?? `https://${UNIVERSITY.website.replace(/^www\./, '')}`}/portal`;

  const packageInput = {
    fullName: fullName || 'Student',
    studentNumber,
    programme: [student.degree_type, student.program].filter(Boolean).join(' — ') || 'your programme',
    faculty: student.faculty || UNIVERSITY.name,
    level: student.degree_type || '—',
    campus: (student as any).campus || 'Buea (Main Campus)',
    mode: (student as any).mode || 'On campus',
    intake: student.intake || String(intakeYear),
    applicationNumber: student.matric_no,
    conditions: isConditional ? conditions : undefined,
    // The university signs admission letters as Head of Academic Affairs, and
    // the holder is named in constants. The desk may override it — an office
    // changes hands — but it never falls back to whichever account pressed the
    // button, which would put an administrator's name under a decision they
    // did not make.
    headOfAdmissions: headOfAdmissions?.trim() || UNIVERSITY.headOfAcademicAffairs,
    registrar: UNIVERSITY.registrar,
    portalUrl,
    temporaryPassword: password,
  };

  const html = admissionPackageHtml(packageInput);
  const text = admissionCoveringText(packageInput);

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    // The admission stands; only delivery is unavailable. Return the package
    // and the password so the office can pass them on another way, rather than
    // leaving an admitted student who never hears anything.
    return NextResponse.json({
      ok: true,
      emailSent: false,
      error: 'smtp-not-configured',
      email: student.email,
      password,
      studentNumber,
      packageHtml: html,
      auditWarning: auditErr ?? undefined,
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 587),
      secure: Number(SMTP_PORT ?? 587) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"${UNIVERSITY.name} — Office of Admissions" <${MAIL_FROM || SMTP_USER}>`,
      to: student.email,
      subject: isConditional
        ? `Conditional offer of admission — ${UNIVERSITY.name} — ${studentNumber}`
        : `Offer of admission — ${UNIVERSITY.name} — ${studentNumber}`,
      text,
      html: `<pre style="font-family:Georgia,serif;font-size:14px;white-space:pre-wrap">${text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')}</pre>`,
      attachments: [
        {
          // A file they can keep, print and hand to an embassy — not a message
          // body that renders differently in every client.
          filename: `ICOF-Admission-Package-${studentNumber}.html`,
          content: html,
          contentType: 'text/html; charset=utf-8',
        },
      ],
    });
  } catch (e) {
    return NextResponse.json({
      ok: true,
      emailSent: false,
      error: `email-failed: ${(e as Error).message}`,
      email: student.email,
      password,
      studentNumber,
      packageHtml: html,
      auditWarning: auditErr ?? undefined,
    });
  }

  return NextResponse.json({
    ok: true,
    emailSent: true,
    email: student.email,
    studentNumber,
    conditional: isConditional,
    auditWarning: auditErr ?? undefined,
  });
}
