// ---------------------------------------------------------------------------
// SENDING A PUBLICATION OUT.
//
//   POST /api/publications/forward  { slug, channel, to?, name?, number? }
//
//     channel 'email'     the University's mail server sends it, and knows
//     channel 'whatsapp'  the officer's own WhatsApp sent it, and we do not
//
// ---------------------------------------------------------------------------
// THE TWO CHANNELS ARE NOT THE SAME ACT AND ARE NOT RECORDED AS THOUGH THEY WERE
// ---------------------------------------------------------------------------
//
// 079 ruled on this for letters and the ruling is not softened for a book:
//
//     "Writing 'sent' would be the database asserting a delivery nobody
//      observed — and the first time an appointee said 'I never received it',
//      the record would be evidence against the University that was never
//      true."
//
// EMAIL. The University's own mail server does the sending and reports back.
// `publication-emailed` is written only when it says it went; a refusal is
// recorded as a refusal, with the reason, and the officer is told.
//
// WHATSAPP. The browser opens the officer's own WhatsApp. This route never
// touches WhatsApp and could not. What it records is the only thing anybody
// knows: WHO handed this publication over, WHEN, and to WHICH number — under
// the action name `publication-handed-to-whatsapp`, which does not contain the
// word sent, on purpose.
//
// ---------------------------------------------------------------------------
// WHY IT IS `issue-correspondence`
// ---------------------------------------------------------------------------
//
// Reading the prospectus is open to anybody — see the reading route. This is
// the other thing: the University's name on a message going to a named person
// from the University's own address. That is what `issue-correspondence`
// already means, and inventing a fifteenth capability for the same act would be
// a second name for one authority.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard, audit } from '@/lib/adminAuth';
import type { Capability } from '@/lib/roles';
import { send, mailConfigured } from '@/lib/mailer';
import { UNIVERSITY } from '@/lib/constants';
import { publicationBySlug, publicationUrl } from '@/lib/publications';
import { renderBook, bookAsCoveringLetter } from '@/lib/prospectus';
import { whatsappNumber, whyNotWhatsApp } from '@/lib/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

/** Enough of an address to be one. Deliberately loose — see below. */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const g = await guard(request, 'issue-correspondence' as Capability);
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: 'Sending a publication under the University’s name belongs to the offices that '
        + 'issue its correspondence.',
    }, { status: g.status });
  }
  const { caller, admin } = g;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const publication = publicationBySlug(String(body.slug ?? ''));
  if (!publication) return bad('no-such-publication', 404, 'There is no publication by that name.');

  const channel = String(body.channel ?? '');
  const recipientName = String(body.name ?? '').trim();
  const url = publicationUrl(publication.slug, new URL(request.url).origin);

  // ---- WHATSAPP: RECORDING A HANDOVER, NOT A DELIVERY ---------------------
  if (channel === 'whatsapp') {
    const raw = String(body.number ?? '');
    const number = whatsappNumber(raw);
    if (!number) return bad('not-a-number', 400, whyNotWhatsApp(raw) ?? 'That is not a number.');

    await audit(admin, {
      action: 'publication-handed-to-whatsapp',
      entityType: 'publication',
      entityId: publication.slug,
      performedBy: caller.id,
      details: {
        title: publication.title,
        number,
        ...(recipientName ? { recipient: recipientName } : {}),
      },
    });
    return NextResponse.json({ ok: true, handedOver: true });
  }

  if (channel !== 'email') {
    return bad('unknown-channel', 400,
      'A publication goes out by email or by WhatsApp. A copied link is neither — nothing has '
      + 'happened yet, so there is nothing to record.');
  }

  // ---- EMAIL --------------------------------------------------------------
  const to = String(body.to ?? '').trim();
  // LOOSE ON PURPOSE. This is the same reasoning 079 gives for phone numbers:
  // the University writes abroad, and a pattern tightened to what looks normal
  // here refuses correct addresses from everywhere else. The mail server is the
  // authority on whether an address works, and it will say so.
  if (!LOOKS_LIKE_EMAIL.test(to)) {
    return bad('not-an-address', 400,
      'That does not look like an email address. It needs a name, an @ and a domain.');
  }

  if (!mailConfigured()) {
    return bad('mail-not-configured', 503,
      'Outbound mail is not set up on this deployment, so nothing can be sent from here. '
      + 'Nothing has been recorded and nothing has gone. The address can be copied and sent '
      + 'from your own mail in the meantime.');
  }

  const letter = bookAsCoveringLetter(publication.book, url);

  // THE BOOK TRAVELS TWICE, AND THAT IS NOT REDUNDANCY.
  //
  // The ATTACHMENT is what a recipient with no connection, or on a plane, or in
  // a place where the University's site is slow, actually opens. It is one
  // self-contained file with the crest embedded in it and no network request in
  // it at all.
  //
  // The LINK is what they forward to a colleague, and it is the copy that will
  // be current a year from now. An attachment is a photograph of the book on
  // the day it was sent.
  const html = renderBook(publication.book, {
    toolbar: false,
    sourceUrl: url,
  });

  const result = await send({
    to,
    subject: letter.subject,
    text: (recipientName ? `Dear ${recipientName},\n\n` : '') + letter.body,
    office: 'Office of the Vice-Chancellor',
    replyTo: UNIVERSITY.email,
    attachments: [{
      filename: publication.filename,
      content: html,
      contentType: 'text/html; charset=utf-8',
    }],
  });

  if (!result.sent) {
    // A REFUSAL IS RECORDED AS A REFUSAL. An officer who tries three times and
    // gets nothing needs the register to show three attempts, not silence — and
    // an audit trail that only holds successes cannot answer "did we ever try".
    await audit(admin, {
      action: 'publication-email-refused',
      entityType: 'publication',
      entityId: publication.slug,
      performedBy: caller.id,
      details: { title: publication.title, to, reason: result.reason },
    });
    return bad('not-sent', 502, result.detail);
  }

  await audit(admin, {
    action: 'publication-emailed',
    entityType: 'publication',
    entityId: publication.slug,
    performedBy: caller.id,
    details: {
      title: publication.title,
      to,
      ...(recipientName ? { recipient: recipientName } : {}),
      attached: publication.filename,
    },
  });

  return NextResponse.json({ ok: true, sent: true });
}
