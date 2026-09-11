// ---------------------------------------------------------------------------
// PROVE THE MAIL ACTUALLY WORKS, BEFORE IT MATTERS.
//
// POST /api/health/mail-test
//
// ---------------------------------------------------------------------------
// WHY A REPORT OF THE VARIABLES IS NOT ENOUGH
// ---------------------------------------------------------------------------
//
// /api/health/config answers whether SMTP_HOST, SMTP_USER and SMTP_PASS are
// present. That is a useful question and it is not the question anybody
// actually has, which is "will the admission letter arrive?"
//
// A wrong password is configured. A port the host blocks is configured. A
// sender address the provider will not accept on that account is configured.
// Every one of those reports green and then fails at the first real admission
// — after the decision is recorded, the number reserved and the account
// created, so the student exists, is admitted, and is the only person who has
// not been told.
//
// This connects, authenticates, and sends one message, and says exactly what
// the mail server said if any of that fails.
//
// ---------------------------------------------------------------------------
// IT SENDS ONLY TO THE CALLER'S OWN ADDRESS
// ---------------------------------------------------------------------------
//
// Not to an address in the request body, and that is deliberate rather than a
// limitation. An authenticated endpoint that sends arbitrary text to an
// arbitrary address, through the University's own mail server, over the
// University's own domain, is a relay for anybody who ever borrows a
// Superadministrator's session — and the messages would carry the University's
// reputation, not the sender's.
//
// The recipient is read from the caller's profile. There is nothing in the
// body to point somewhere else.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';
import { send, verifyMail, mailConfigured } from '@/lib/mailer';
import { UNIVERSITY } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // The same capability that may read the configuration report. Knowing whether
  // the mail works is the same class of fact as knowing whether it is set up.
  const g = await guard(request, 'design-credentials');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });

  if (!mailConfigured()) {
    return NextResponse.json({
      ok: false,
      stage: 'configuration',
      error: 'not-configured',
      detail:
        'Outbound mail is not configured on this deployment. SMTP_HOST, SMTP_USER and SMTP_PASS '
        + 'must all be set. Until they are, an admission is still recorded and issued — the '
        + 'student number, the account and the letter are all created — but nothing is emailed, '
        + 'and the desk shows the temporary password so it can be passed on by hand.',
    }, { status: 200 });
  }

  if (!g.caller.email) {
    // Refusing rather than falling back to a configured address: the whole
    // point is that the tester receives it and can confirm it arrived.
    return NextResponse.json({
      ok: false,
      stage: 'recipient',
      error: 'caller-has-no-email',
      detail:
        'Your own account carries no email address, so there is nowhere to send the test. This '
        + 'endpoint deliberately sends only to the signed-in user.',
    }, { status: 422 });
  }

  // ---- 1. Connect and authenticate, sending nothing --------------------
  //
  // Separated from the send so a failure names the stage. "Invalid login" and
  // "the recipient was rejected" are different faults with different fixes,
  // and one message covering both sends somebody to check the wrong thing.
  const connection = await verifyMail();
  if (!connection.sent) {
    return NextResponse.json({
      ok: false,
      stage: 'connection',
      error: connection.reason,
      detail: connection.detail,
    }, { status: 200 });
  }

  // ---- 2. Actually send one ---------------------------------------------
  const when = new Date().toISOString();
  const delivery = await send({
    to: g.caller.email,
    office: 'System Administration',
    subject: `${UNIVERSITY.shortName} — outbound mail test`,
    text: [
      'This is a test message from the ICOF Global University management system.',
      '',
      'If you are reading it, outbound mail works on this deployment: the connection,',
      'the authentication and the delivery all succeeded. An admission issued from the',
      'Admissions approval desk will reach the applicant.',
      '',
      `Requested by   ${g.caller.fullName ?? g.caller.email}`,
      `Role           ${g.caller.role}`,
      `Sent at        ${when}`,
      '',
      'Nothing was changed by this test and no record was created for any applicant.',
    ].join('\n'),
  });

  if (!delivery.sent) {
    return NextResponse.json({
      ok: false,
      stage: 'delivery',
      error: delivery.reason,
      detail: delivery.detail,
      to: g.caller.email,
    }, { status: 200 });
  }

  return NextResponse.json({
    ok: true,
    stage: 'delivery',
    to: g.caller.email,
    sentAt: when,
    detail:
      'The connection, the authentication and the send all succeeded. Check the inbox — and the '
      + 'spam folder, because a message that is delivered but filtered is not a message the '
      + 'applicant will read.',
  });
}
