// ---------------------------------------------------------------------------
// Create a staff account. Superadministrator only.
//
// This is the manual counterpart to the Registrar's approve route. A student
// account exists because an application was paid for and approved; a staff
// account exists because the Superadministrator decided a person holds an
// office. There is no application, no queue and no fee — so there is also no
// process to audit except this one, which is why every field of the decision is
// written to audit_logs before the response is returned.
//
// Creating a lecturer does two things at once, and both must happen or the
// account is useless:
//
//   * an auth account with role 'lecturer', so the person can sign in, and
//   * a row in `lecturers`, so they can be allocated to a course. A profile
//     without a lecturer row cannot be assigned to teach anything; a lecturer
//     row without an account is a name on a list.
//
// A role may never be granted at or above the granter's own rank — an
// administrator cannot mint a Superadministrator, and a Superadministrator
// cannot mint a second one from here. That is deliberate: adding another holder
// of system custody should be a considered act in the database, not a form.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { guard, audit, generatePassword } from '@/lib/adminAuth';
import { roleLabels, canActOn, capabilitiesOf } from '@/lib/roles';
import type { UserRole } from '@/lib/types';

export const runtime = 'nodejs';

const KNOWN_ROLES = Object.keys(roleLabels) as UserRole[];

/**
 * Staff number, in the same family as the student number (ICOF202600451) but
 * marked for staff: ICOFSTF + year + a three-digit sequence.
 *
 * Derived from the highest existing number for the year rather than a separate
 * counter, so it cannot drift out of step with the table. `staff_id` is unique,
 * so two racing creations fail the second insert rather than issuing the same
 * number twice.
 */
async function nextStaffNumber(admin: { from: (t: string) => any }, year: number): Promise<string> {
  const prefix = `ICOFSTF${year}`;
  const { data } = await admin
    .from('lecturers')
    .select('staff_id')
    .like('staff_id', `${prefix}%`)
    .order('staff_id', { ascending: false })
    .limit(1);
  const last = (data?.[0] as { staff_id?: string } | undefined)?.staff_id;
  const seq = last ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

function staffWelcomeEmail(opts: {
  fullName: string;
  roleLabel: string;
  email: string;
  password: string;
  portalUrl: string;
  staffNumber?: string;
  canDo: string[];
}) {
  const { fullName, roleLabel, email, password, portalUrl, staffNumber, canDo } = opts;

  const text = `Dear ${fullName},

An account has been created for you at ICOF Global University.

  Role              ${roleLabel}
${staffNumber ? `  Staff Number      ${staffNumber}\n` : ''}  Username          ${email}
  Temporary Password ${password}
  Portal            ${portalUrl}

Please sign in and change your password immediately. Your password is personal
to you and must not be shared with anyone, including university staff. No one at
the university will ever ask you for it.

What this account can do:
${canDo.map((c) => `  - ${c}`).join('\n')}

If you were not expecting this email, reply to it and do not sign in.

Office of the Superadministrator
ICOF Global University`;

  const html = `<div style="font-family:Georgia,serif;max-width:620px;margin:0 auto;color:#3f3350">
  <div style="background:#422e59;padding:28px 32px">
    <p style="margin:0;color:#f3d27a;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase">ICOF Global University</p>
    <h1 style="margin:8px 0 0;color:#fff;font-size:24px">Your staff account</h1>
  </div>
  <div style="padding:32px">
    <p>Dear ${fullName},</p>
    <p>An account has been created for you at ICOF Global University.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-family:Helvetica,Arial,sans-serif;font-size:14px">
      <tr><td style="padding:8px 0;color:#6b6076">Role</td><td style="padding:8px 0"><strong>${roleLabel}</strong></td></tr>
      ${staffNumber ? `<tr><td style="padding:8px 0;color:#6b6076">Staff Number</td><td style="padding:8px 0"><strong style="font-family:monospace">${staffNumber}</strong></td></tr>` : ''}
      <tr><td style="padding:8px 0;color:#6b6076">Username</td><td style="padding:8px 0"><strong style="font-family:monospace">${email}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#6b6076">Temporary Password</td><td style="padding:8px 0"><strong style="font-family:monospace;font-size:16px">${password}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#6b6076">Portal</td><td style="padding:8px 0"><a href="${portalUrl}" style="color:#422e59">${portalUrl}</a></td></tr>
    </table>
    <p style="padding:12px 16px;background:#fdf2f2;border-left:3px solid #dc2626;font-size:14px">
      Sign in and change your password immediately. Your password is personal to you and must not be shared with anyone, including university staff. No one at the university will ever ask you for it.
    </p>
    <p style="margin-top:24px"><strong>What this account can do:</strong></p>
    <ul style="padding-left:0;list-style:none">
      ${canDo.map((c) => `<li style="padding:3px 0">&#10003; ${c}</li>`).join('')}
    </ul>
    <p style="color:#6b6076;font-size:13px">If you were not expecting this email, reply to it and do not sign in.</p>
    <p style="color:#6b6076;font-size:14px;margin-top:24px">Office of the Superadministrator<br>ICOF Global University</p>
  </div>
</div>`;

  return { text, html };
}

/** Turn the capability list into something a person can read in an email. */
function describeCapabilities(role: UserRole): string[] {
  const caps = capabilitiesOf(role);
  if (caps === 'all') return ['Full custody of the system'];
  return caps.map((c) =>
    c.replace(/-/g, ' ').replace(/^./, (m) => m.toUpperCase()),
  );
}

export async function POST(request: Request) {
  const g = await guard(request, 'create-staff-account');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin, caller } = g;

  let body: {
    email?: string;
    fullName?: string;
    role?: UserRole;
    title?: string;
    phone?: string;
    specialization?: string;
    departmentId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const fullName = body.fullName?.trim();
  const role = body.role;

  if (!email || !fullName || !role) {
    return NextResponse.json(
      { ok: false, error: 'email-fullname-and-role-required' },
      { status: 400 },
    );
  }
  if (!KNOWN_ROLES.includes(role)) {
    return NextResponse.json({ ok: false, error: `unknown-role:${role}` }, { status: 422 });
  }
  // Cannot create an account of your own rank or above.
  if (!canActOn(caller.role, role)) {
    return NextResponse.json({ ok: false, error: `cannot-grant:${role}` }, { status: 403 });
  }
  // 'student' and 'applicant' accounts come from the admissions pipeline, which
  // records a paid application behind each one. Minting one here would produce
  // a student with no application, no fee and no Registrar decision.
  if (role === 'student' || role === 'applicant') {
    return NextResponse.json(
      { ok: false, error: 'use-admissions-pipeline-for-students' },
      { status: 422 },
    );
  }

  const password = generatePassword();
  const isLecturer = role === 'lecturer';
  const year = new Date().getFullYear();
  const staffNumber = isLecturer ? await nextStaffNumber(admin, year) : undefined;

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role, staff_id: staffNumber },
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

  // The migration's trigger writes this too; written here as well so the route
  // does not depend on the trigger having been installed. An account without a
  // profile cannot sign in, so it is not an account.
  const { error: profErr } = await admin
    .from('profiles')
    .upsert({ id: authUserId, email, full_name: fullName, role }, { onConflict: 'id' });
  if (profErr) {
    return NextResponse.json(
      { ok: false, error: `account-created-but-profile-not-created: ${profErr.message}` },
      { status: 500 },
    );
  }

  // A lecturer also needs a teaching record, or they cannot be allocated a
  // course however correct their role is.
  if (isLecturer) {
    const [first, ...rest] = fullName.split(/\s+/);
    const { error: lecErr } = await admin.from('lecturers').insert({
      staff_id: staffNumber,
      first_name: first,
      last_name: rest.join(' ') || first,
      title: body.title?.trim() || null,
      email,
      phone: body.phone?.trim() || null,
      department_id: body.departmentId || null,
      specialization: body.specialization?.trim() || null,
      status: 'active',
      auth_user_id: authUserId,
    });
    if (lecErr) {
      return NextResponse.json(
        { ok: false, error: `account-created-but-lecturer-record-not-created: ${lecErr.message}` },
        { status: 500 },
      );
    }
  }

  const auditErr = await audit(admin, {
    action: 'account.created',
    entityType: 'profile',
    entityId: authUserId,
    performedBy: caller.id,
    details: {
      email,
      full_name: fullName,
      role,
      staff_number: staffNumber ?? null,
      by_email: caller.email,
    },
  });

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SITE_URL, MAIL_FROM } = process.env;
  const portalUrl = `${SITE_URL ?? 'https://iguc.net'}/portal`;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    // The account is real; only delivery is unavailable. Return the password so
    // it can be handed over another way, rather than leaving a new member of
    // staff with an account they never hear about.
    return NextResponse.json({
      ok: true,
      emailSent: false,
      error: 'smtp-not-configured',
      email,
      password,
      staffNumber,
      auditWarning: auditErr ?? undefined,
    });
  }

  const mail = staffWelcomeEmail({
    fullName,
    roleLabel: roleLabels[role],
    email,
    password,
    portalUrl,
    staffNumber,
    canDo: describeCapabilities(role),
  });

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 587),
      secure: Number(SMTP_PORT ?? 587) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"ICOF Global University" <${MAIL_FROM || SMTP_USER}>`,
      to: email,
      subject: `Your ICOF Global University account — ${roleLabels[role]}`,
      text: mail.text,
      html: mail.html,
    });
  } catch (e) {
    return NextResponse.json({
      ok: true,
      emailSent: false,
      error: `email-failed: ${(e as Error).message}`,
      email,
      password,
      staffNumber,
      auditWarning: auditErr ?? undefined,
    });
  }

  return NextResponse.json({
    ok: true,
    emailSent: true,
    email,
    staffNumber,
    role,
    auditWarning: auditErr ?? undefined,
  });
}
