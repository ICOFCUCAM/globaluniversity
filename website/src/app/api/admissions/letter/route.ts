// ---------------------------------------------------------------------------
// THE ADMISSION LETTER, AFTER IT HAS BEEN ISSUED.
//
//   GET  /api/admissions/letter?applicationId=…   render it
//   POST /api/admissions/letter  { applicationId } send it again
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
//
// The University asked where to check the QR code in a letter it had just
// issued, and the honest answer was: nowhere. The package was generated,
// emailed and discarded. It was never written to the database and nodemailer
// does not leave a copy in a Sent folder, so the only copy in existence was in
// the applicant's inbox.
//
// That is a bad position for a university to be in. "What exactly did we send
// this student?" is a question that comes up when a document is queried, when
// an applicant says they never received it, and when somebody checks a seal
// against a letter held by an embassy. It should not be answerable only by
// asking the applicant to forward their email.
//
// ---------------------------------------------------------------------------
// THE ARCHIVED COPY FIRST, A REBUILD ONLY AS A FALLBACK
// ---------------------------------------------------------------------------
//
// Since 031 the letter is kept, and the kept copy is what this route serves.
// It is the document the applicant received, which is the only thing worth
// showing somebody who is checking a letter against the University's record.
//
// A rebuild is the fallback, for the letters issued before 031 that have no
// copy. It is exact WHILE THE TEMPLATE IS UNCHANGED: the seal is an HMAC over
// the particulars, so the same inputs give the same seal, the same QR and the
// same printed check code — which is why the issue date comes from the
// application's `decided_at` and never from today. Edit the template, though,
// and a rebuild shows this year's wording under last year's seal. That is the
// discrepancy the archive exists to prevent.
//
// The rebuild goes through the same admissionPackageInputFor() the decision
// route uses, so the two cannot drift about what the letter says.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { guard } from '@/lib/adminAuth';
import { send, mailConfigured } from '@/lib/mailer';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';
import {
  admissionPackageHtml, admissionCoveringText, admissionPackageInputFor,
} from '@/lib/admissionPackage';
import { courses, MODE_LABEL } from '@/content/courses';
import { UNIVERSITY } from '@/lib/constants';
import { officeFor } from '@/lib/admissionWorkflow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Readable, unambiguous initial password — no l/1/O/0. */
function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from(randomBytes(14), (b) => alphabet[b % alphabet.length]).join('');
}

// ---------------------------------------------------------------------------
// WHICH STATES HAVE A LETTER, AND WHY `approved` IS AMONG THEM.
//
// `approved` and `conditional` are what the OLDER route left behind. Before
// 026 split the decision from the issuance, that route created the account,
// emailed the package and stopped at `approved` — so a student admitted in
// August is fully admitted and merely wears the old label.
//
// Excluding them meant the University could not produce a letter for anybody
// admitted before the split, which is every student admitted until this month.
//
// The student number is the real test and it is checked separately: the new
// route reaches `admission_issued` only once one is reserved, and the old one
// only reaches `approved` the same way. A row in either state without a number
// was never actually issued anything, and gets refused.
// ---------------------------------------------------------------------------
const HAS_A_LETTER = ['admission_issued', 'enrolled', 'approved', 'conditional'];

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Rebuild the letter exactly as it was issued.
 *
 * `temporaryPassword` is passed only on a resend, and only because a new one
 * has just been set. The original was never stored — deliberately — so there
 * is nothing here that could reveal it.
 */
async function rebuild(
  app: Record<string, unknown>,
  temporaryPassword?: string,
): Promise<string> {
  const programmeCode = String(app.program ?? '');
  const programme = courses.find(
    (c) => c.code.toLowerCase() === programmeCode.toLowerCase()
      || c.title.toLowerCase() === programmeCode.toLowerCase(),
  );
  const conditions = (() => {
    try {
      const raw = app.admission_conditions;
      return typeof raw === 'string' ? JSON.parse(raw) : undefined;
    } catch { return undefined; }
  })();

  return admissionPackageHtml(admissionPackageInputFor(app, {
    studentNumber: String(app.student_number ?? ''),
    portalUrl: `${process.env.SITE_URL ?? 'https://iguc.net'}/portal`,
    programme: programme
      ? { faculty: programme.faculty, level: programme.level, modeLabel: MODE_LABEL[programme.mode] }
      : undefined,
    conditions,
    // THE ORIGINAL DATE, WHICH IS WHAT MAKES THE SEAL MATCH. Today's date here
    // would produce a different seal and a different QR — a document that
    // disagrees with the one the applicant is holding.
    issuedOn: app.decided_at ? new Date(String(app.decided_at)) : undefined,
    temporaryPassword,
  }));
}

// ===========================================================================
// VIEW
// ===========================================================================

export async function GET(request: Request) {
  const g = await guard(request, 'decide-admission');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });

  const applicationId = new URL(request.url).searchParams.get('applicationId');
  if (!applicationId) {
    return NextResponse.json({ ok: false, error: 'missing-application-id' }, { status: 400 });
  }

  const admin = adminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'service-role-key-missing' }, { status: 500 });
  }

  const { data: app } = await admin
    .from('students').select('*').eq('id', applicationId).maybeSingle();
  if (!app) {
    return NextResponse.json({ ok: false, error: 'application-not-found' }, { status: 404 });
  }
  if (!HAS_A_LETTER.includes(String(app.status)) || !app.student_number) {
    // Not a failure to explain away: there is genuinely no letter, because the
    // admission was never issued. Saying so is more use than an empty page.
    return NextResponse.json({
      ok: false,
      error: 'no-letter-issued',
      detail: 'No admission package has been issued for this application, so there is nothing to '
        + 'show. A letter exists only once the issuance has completed.',
      status: app.status,
    }, { status: 409 });
  }

  // ---------------------------------------------------------------------
  // THE COPY THAT WAS KEPT, IN PREFERENCE TO A REBUILD.
  //
  // A rebuild is exact only while the template is unchanged: the seal is an
  // HMAC over the particulars, so the same inputs give the same seal — but the
  // wording around it is whatever the code says today. Showing a rebuild for a
  // letter issued last year would show this year's document under last year's
  // seal, which is precisely the discrepancy somebody checking a letter
  // against the University's own copy would find.
  //
  // The rebuild remains for letters issued before 031, which have no copy.
  // ---------------------------------------------------------------------
  const { data: kept } = await admin
    .from('admission_letters')
    .select('html')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const html = kept?.html ?? await rebuild(app);
  // Rendered rather than downloaded: the point is to look at it, and a
  // browser prints to PDF perfectly well from here.
  return new NextResponse(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      // Says which one you are looking at, without altering the document.
      'x-icof-letter-source': kept?.html ? 'archived' : 'rebuilt',
    },
  });
}

// ===========================================================================
// SEND IT AGAIN
// ===========================================================================

export async function POST(request: Request) {
  const g = await guard(request, 'decide-admission');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { caller } = g;

  let body: { applicationId?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }
  if (!body.applicationId) {
    return NextResponse.json({ ok: false, error: 'missing-application-id' }, { status: 400 });
  }

  const admin = adminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'service-role-key-missing' }, { status: 500 });
  }

  const { data: app } = await admin
    .from('students').select('*').eq('id', body.applicationId).maybeSingle();
  if (!app) {
    return NextResponse.json({ ok: false, error: 'application-not-found' }, { status: 404 });
  }
  if (!HAS_A_LETTER.includes(String(app.status)) || !app.student_number) {
    return NextResponse.json({
      ok: false, error: 'no-letter-issued', status: app.status,
      detail: 'No admission package has been issued for this application, so there is nothing to '
        + 'resend. Issue the admission first.',
    }, { status: 409 });
  }
  if (!app.email) {
    return NextResponse.json({
      ok: false, error: 'no-email',
      detail: 'This record carries no email address, so there is nowhere to send it.',
    }, { status: 422 });
  }
  if (!mailConfigured()) {
    return NextResponse.json({
      ok: false, error: 'smtp-not-configured',
      detail: 'Outbound mail is not configured on this deployment, so nothing can be sent. The '
        + 'letter can still be viewed and printed.',
    }, { status: 409 });
  }

  // -----------------------------------------------------------------------
  // A NEW TEMPORARY PASSWORD, BECAUSE THE OLD ONE CANNOT BE RECOVERED.
  //
  // The original was generated, emailed and never stored — which is correct,
  // and it means a resend carrying the old credentials is impossible rather
  // than merely unimplemented. An applicant who lost the first email needs a
  // password that works, so one is issued and the previous one stops working.
  //
  // That is a real consequence and the desk says so before the button is
  // pressed. It is recorded here too.
  // -----------------------------------------------------------------------
  const password = generatePassword();
  if (app.auth_user_id) {
    const { error: pwErr } = await admin.auth.admin.updateUserById(
      String(app.auth_user_id), { password },
    );
    if (pwErr) {
      return NextResponse.json({
        ok: false, error: 'password-not-reset', detail: pwErr.message,
      }, { status: 500 });
    }
  }

  // THE ARCHIVED COPY IS WHAT GOES OUT, where there is one. The applicant
  // receives the document the University issued, not a fresh render of it.
  // The password is not in the letter — only in the covering text — so the
  // stored copy needs no alteration to carry a new one.
  const { data: kept } = await admin
    .from('admission_letters')
    .select('id, html, attempts')
    .eq('application_id', body.applicationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const html = kept?.html ?? await rebuild(app, app.auth_user_id ? password : undefined);
  const input = admissionPackageInputFor(app, {
    studentNumber: String(app.student_number),
    portalUrl: `${process.env.SITE_URL ?? 'https://iguc.net'}/portal`,
    issuedOn: app.decided_at ? new Date(String(app.decided_at)) : undefined,
    temporaryPassword: app.auth_user_id ? password : undefined,
  });

  const delivery = await send({
    to: String(app.email),
    office: 'Office of Academic Affairs',
    subject: `${UNIVERSITY.name} — your admission package`,
    text: admissionCoveringText(input),
    html,
  });

  // Recorded against the office, not only the person. Reusing the existing
  // event rather than inventing one keeps this off the migration path: the
  // detail and the metadata say it was a resend.
  await admin.from('admission_audit_log').insert({
    application_id: body.applicationId,
    event: delivery.sent ? 'WELCOME_EMAIL_SENT' : 'WELCOME_EMAIL_FAILED',
    actor_id: caller.id,
    actor_email: caller.email ?? null,
    actor_role: caller.role ?? null,
    actor_office: officeFor(caller.role, caller.role === 'superadmin' ? 'academic-office' : undefined),
    detail: delivery.sent
      ? 'the admission package was sent again, with a new temporary password'
      : `resend failed: ${delivery.sent ? '' : delivery.detail}`,
    metadata: { resent: true, password_reset: Boolean(app.auth_user_id) },
  });

  // THE OUTBOX ROW FOLLOWS WHAT HAPPENED. A letter that failed and has now
  // been sent must stop showing as undelivered, and one that failed again must
  // show a second attempt rather than looking untouched.
  if (kept?.id) {
    await admin.from('admission_letters').update({
      delivery: delivery.sent ? 'sent' : 'failed',
      delivery_detail: delivery.sent ? null : (delivery.detail ?? null),
      attempts: (kept.attempts ?? 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq('id', kept.id);
  }

  if (!delivery.sent) {
    return NextResponse.json({
      ok: false, error: 'email-failed',
      detail: delivery.sent ? undefined : delivery.detail,
      // The password HAS been changed by this point, so it must come back —
      // otherwise the reset has locked the student out of an account whose new
      // password nobody knows.
      email: app.email, password: app.auth_user_id ? password : undefined,
    }, { status: 200 });
  }

  return NextResponse.json({
    ok: true, email: app.email, studentNumber: app.student_number,
    passwordReset: Boolean(app.auth_user_id),
  });
}
