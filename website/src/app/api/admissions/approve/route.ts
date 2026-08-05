// ---------------------------------------------------------------------------
// Registrar approval — the only route by which a student account is created.
//
// Why this is server-side and not in the browser:
//
//   * Creating an auth user requires the service-role key. That key can read
//     and write every row in the database regardless of RLS. It must never be
//     sent to a browser, so the call cannot live in the portal client.
//   * The initial password is generated here with crypto.randomBytes. A
//     password generated client-side is visible to anyone with the page open,
//     and a predictable one is worse than none.
//   * The email is sent from here so that the credentials never round-trip
//     through the approving user's browser.
//
// If SUPABASE_SERVICE_ROLE_KEY is absent the route refuses rather than falling
// back to the anon key. Falling back would appear to work — the status would
// update — while silently creating no account, so the applicant would receive
// a welcome email for credentials that do not exist.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';

const SUPABASE_URL = 'https://djotoapomhlavxknwsxw.databasepad.com';

/** Readable, unambiguous initial password — no l/1/O/0. */
function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(14);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function welcomeEmail(opts: {
  firstName: string;
  matricNo: string;
  programme: string;
  degreeType: string;
  email: string;
  password: string;
  portalUrl: string;
  note?: string;
}) {
  const { firstName, matricNo, programme, degreeType, email, password, portalUrl, note } = opts;
  const text = `Dear ${firstName},

Congratulations. Your application to ICOF Global University has been examined by the Office of the Registrar and approved.

You have been admitted to:
  ${degreeType ? `${degreeType} — ` : ''}${programme}

Your student account has been created. These are your login details for the Student Management System:

  Portal:      ${portalUrl}
  Matriculation number: ${matricNo}
  Username:    ${email}
  Password:    ${password}

Please sign in and change your password immediately. Your password is personal to you and should not be shared with anyone, including university staff.

Inside the portal you can register for courses, see your results and GPA, download your transcript, access course materials and assignments, sit online examinations, and view your fee statement.
${note ? `\nA note from the Registrar:\n${note}\n` : ''}
If anything here is wrong — your name, your programme, your campus — reply to this email before you register for courses, and the Registrar's office will correct it.

Welcome to ICOF Global University. We are glad you are here.

Office of the Registrar
ICOF Global University
The Community University of Africa
info@iguc.net`;

  const html = `<div style="font-family:Georgia,serif;max-width:620px;margin:0 auto;color:#3f3350">
  <div style="background:#422e59;padding:28px 32px">
    <p style="margin:0;color:#f3d27a;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase">Office of the Registrar</p>
    <h1 style="margin:8px 0 0;color:#fff;font-size:24px">Your application has been approved</h1>
  </div>
  <div style="padding:32px">
    <p>Dear ${firstName},</p>
    <p>Congratulations. Your application to ICOF Global University has been examined by the Office of the Registrar and approved.</p>
    <p style="margin:24px 0;padding:16px 20px;background:#faf6ee;border-left:3px solid #c9a227">
      <strong style="display:block;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8a6d1f;font-family:Helvetica,Arial,sans-serif">You have been admitted to</strong>
      <span style="font-size:18px;font-weight:bold">${degreeType ? `${degreeType} — ` : ''}${programme}</span>
    </p>
    <p>Your student account has been created. These are your login details for the Student Management System.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-family:Helvetica,Arial,sans-serif;font-size:14px">
      <tr><td style="padding:8px 0;color:#6b6076">Portal</td><td style="padding:8px 0"><a href="${portalUrl}" style="color:#422e59">${portalUrl}</a></td></tr>
      <tr><td style="padding:8px 0;color:#6b6076">Matriculation number</td><td style="padding:8px 0"><strong>${matricNo}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#6b6076">Username</td><td style="padding:8px 0"><strong>${email}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#6b6076">Password</td><td style="padding:8px 0"><strong style="font-family:monospace;font-size:15px">${password}</strong></td></tr>
    </table>
    <p style="padding:12px 16px;background:#fdf2f2;border-left:3px solid #dc2626;font-size:14px">
      Please sign in and change your password immediately. Your password is personal to you and should not be shared with anyone, including university staff.
    </p>
    <p>Inside the portal you can register for courses, see your results and GPA, download your transcript, access course materials and assignments, sit online examinations, and view your fee statement.</p>
    ${note ? `<p style="padding:12px 16px;background:#faf6ee"><strong>A note from the Registrar:</strong><br>${note}</p>` : ''}
    <p>If anything here is wrong — your name, your programme, your campus — reply to this email before you register for courses, and the Registrar’s office will correct it.</p>
    <p style="margin-top:28px">Welcome to ICOF Global University. We are glad you are here.</p>
    <p style="color:#6b6076;font-size:14px;margin-top:24px">
      Office of the Registrar<br>ICOF Global University<br><em>The Community University of Africa</em>
    </p>
  </div>
</div>`;
  return { text, html };
}

export async function POST(request: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    // Refuse loudly. See the header comment: a silent fallback would email
    // credentials for an account that was never created.
    return NextResponse.json(
      { ok: false, error: 'service-role-key-missing' },
      { status: 500 },
    );
  }

  let body: { studentId?: string; byUserId?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }
  const { studentId, byUserId, note } = body;
  if (!studentId) {
    return NextResponse.json({ ok: false, error: 'missing-student-id' }, { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Re-read the record server-side. The client sends only an id, so the fee
  // gate is checked here against the database rather than against whatever the
  // browser believed when the page was last loaded.
  const { data: student, error: readErr } = await admin
    .from('students')
    .select('*')
    .eq('id', studentId)
    .single();
  if (readErr || !student) {
    return NextResponse.json({ ok: false, error: 'application-not-found' }, { status: 404 });
  }
  if (student.status !== 'fee_paid') {
    return NextResponse.json(
      { ok: false, error: `wrong-stage:${student.status}` },
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

  const { error: authErr } = await admin.auth.admin.createUser({
    email: student.email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: 'student',
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

  // Only now mark it approved. If the account creation above failed we did not
  // reach here, so an approved record always has an account behind it.
  const { error: updErr } = await admin
    .from('students')
    .update({
      status: 'approved',
      decided_by: byUserId ?? null,
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

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SITE_URL } = process.env;
  const portalUrl = `${SITE_URL ?? 'https://iguc.net'}/portal`;
  const mail = welcomeEmail({
    firstName: student.first_name || 'Student',
    matricNo: student.matric_no,
    programme: student.program || 'your programme',
    degreeType: student.degree_type || '',
    email: student.email,
    password,
    portalUrl,
    note,
  });

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    // The account exists and the status is correct; only delivery failed.
    // Return the password so the Registrar can pass it on by another route,
    // rather than leaving an approved applicant who never hears anything.
    return NextResponse.json({
      ok: true,
      emailSent: false,
      error: 'smtp-not-configured',
      email: student.email,
      password,
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
      from: `"ICOF Global University — Office of the Registrar" <${SMTP_USER}>`,
      to: student.email,
      subject: `Your application to ICOF Global University has been approved — ${student.matric_no}`,
      text: mail.text,
      html: mail.html,
    });
  } catch (e) {
    return NextResponse.json({
      ok: true,
      emailSent: false,
      error: `email-failed: ${(e as Error).message}`,
      email: student.email,
      password,
    });
  }

  return NextResponse.json({ ok: true, emailSent: true, email: student.email });
}
