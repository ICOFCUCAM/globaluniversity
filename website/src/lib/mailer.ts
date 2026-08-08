// ---------------------------------------------------------------------------
// THE UNIVERSITY'S OUTBOUND POST.
//
// WHY THIS FILE EXISTS. Four routes had built their own transport — the
// admissions offer, the admissions approval, the application acknowledgement
// and the staff invitation — each with its own copy of the same six lines and
// its own idea of what to do when SMTP is not configured. Two of them reported
// success when the mail had not gone; one returned a 500 and left the record
// written but the applicant uninformed.
//
// A fifth copy was about to be written for credential delivery. So instead:
// one transport, one policy about failure, one place to change the sender.
//
// ---------------------------------------------------------------------------
// THE POLICY ABOUT FAILURE, AND WHY IT IS NOT "THROW"
// ---------------------------------------------------------------------------
//
// Sending mail is the LAST step of every operation that uses it. The student is
// admitted, the credential is issued, the account exists — and then the
// university tries to tell somebody. If the mail fails, the work is still done
// and must not be rolled back; a failed email is not a reason to un-admit a
// student.
//
// But it must not be reported as sent either. So `send` returns a result rather
// than throwing, and every caller is obliged to look at it and tell the
// operator "the record is written, the email did not go, here is what to do".
// That sentence is the whole point of the type.
// ---------------------------------------------------------------------------

import nodemailer from 'nodemailer';
import { UNIVERSITY } from '@/lib/constants';

export interface MailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export interface MailRequest {
  to: string;
  subject: string;
  /** Plain text. Always sent — some clients show nothing else. */
  text: string;
  /** Optional HTML body. When absent, the text is wrapped in a readable pre. */
  html?: string;
  attachments?: MailAttachment[];
  /**
   * The office this comes from, e.g. 'Office of Admissions'. Appears in the
   * From line, because a graduate receiving a certificate should see which part
   * of the university sent it rather than a bare address.
   */
  office?: string | null;
  /**
   * Overrides the display name in the From line.
   *
   * The application acknowledgement sends as "IGUC Online Application" rather
   * than as the University — it goes to the admissions inbox, not to a member
   * of the public, and the distinct name is how that inbox is filtered.
   * Preserved rather than normalised.
   */
  fromName?: string;
  replyTo?: string;
  /**
   * Overrides the SMTP port when SMTP_PORT is not set.
   *
   * WHY THIS EXISTS AND IS NOT SIMPLY 587 EVERYWHERE. Three of the four routes
   * that sent mail before this file defaulted to 587; the application
   * acknowledgement defaulted to 465. On any deployment that sets SMTP_PORT —
   * which is all of them — the two are identical, so the difference has never
   * shown. Consolidating on one value would still have been a silent change to
   * how the admissions inbox is reached on a deployment that does not, and
   * "tidier" is not a good enough reason to alter that without being asked.
   *
   * It is recorded here rather than fixed so that the University can decide.
   */
  fallbackPort?: number;
}

export type MailResult =
  | { sent: true }
  | {
      sent: false;
      /** 'not-configured' | 'refused' */
      reason: string;
      /** A sentence for the operator. Never for the recipient — they got nothing. */
      detail: string;
    };

/** Is outbound mail set up on this deployment at all? */
export function mailConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.SMTP_HOST?.trim() && env.SMTP_USER?.trim() && env.SMTP_PASS?.trim());
}

/**
 * Send one message.
 *
 * NEVER THROWS. See the header — the caller's work is already done by the time
 * this runs, and an exception here would either roll back something that should
 * stand or be swallowed by a catch that reports success.
 */
export async function send(request: MailRequest): Promise<MailResult> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;

  if (!mailConfigured()) {
    return {
      sent: false,
      reason: 'not-configured',
      detail:
        'Outbound mail is not configured on this deployment: SMTP_HOST, SMTP_USER and SMTP_PASS '
        + 'must all be set. The record has been written; nothing has been sent.',
    };
  }

  const port = Number(SMTP_PORT ?? request.fallbackPort ?? 587);

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      // 465 is implicit TLS; 587 upgrades with STARTTLS. Getting this backwards
      // produces a connection that hangs rather than an error, which is why it
      // is derived from the port rather than configured separately.
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"${request.fromName ?? UNIVERSITY.name}${request.office ? ` — ${request.office}` : ''}" <${MAIL_FROM || SMTP_USER}>`,
      to: request.to,
      replyTo: request.replyTo,
      subject: request.subject,
      text: request.text,
      html: request.html ?? asReadableHtml(request.text),
      attachments: request.attachments,
    });

    return { sent: true };
  } catch (e) {
    return {
      sent: false,
      reason: 'refused',
      detail: `The mail server refused the message: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * A plain-text body, made readable in a mail client.
 *
 * ESCAPED, because the text is assembled from names and programme titles that
 * come out of the register. A student called `O'Brien <admin>` is unlikely, and
 * a university that renders unescaped user data into an outbound email has a
 * problem that will eventually find it.
 */
function asReadableHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<pre style="font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.6;white-space:pre-wrap">${escaped}</pre>`;
}
