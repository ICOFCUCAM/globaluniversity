// ---------------------------------------------------------------------------
// THE INVITATION A NEW MEMBER OF STAFF RECEIVES.
//
// ---------------------------------------------------------------------------
// WHY THE WORDING LIVES HERE AND NOT IN THE ROUTE
// ---------------------------------------------------------------------------
//
// Two things send it — the route that issues it, and the test that reads what
// the route sends — and a message composed in the route is a message the test
// can only assert about by copying it. Copying it is how the two drift.
//
// It is also the only text in this system an appointee reads BEFORE they have
// any account at all, so it has to carry its own proof of being genuine: the
// University's name, the post, and an address on the University's own domain.
// A link alone, arriving on WhatsApp, is indistinguishable from a phishing
// message, and telling somebody to type a password into it would be teaching
// them the habit that gets them robbed.
// ---------------------------------------------------------------------------

import { UNIVERSITY } from '@/lib/constants';

/**
 * How long an invitation is good for.
 *
 * Fourteen days is long enough for somebody travelling and short enough that a
 * link forwarded into a group chat and forgotten stops working within a month.
 * An invitation that never expires is a password.
 */
export const INVITATION_DAYS = 14;

/** The shortest password the claim route accepts. */
export const MIN_PASSWORD = 12;

/** The site the University actually runs on. */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? `https://${UNIVERSITY.website}`;
}

/** Where an invitation is opened. */
export function joinUrl(token: string): string {
  return `${siteUrl()}/join?t=${encodeURIComponent(token)}`;
}

/**
 * What the officer forwards.
 *
 * NO PASSWORD IS EVER IN HERE, and nor is anything about the post beyond its
 * title — the appointee already holds the letter, which is the document that
 * states the terms. This is a message about how to reach the system, not a
 * second letter of appointment with different wording.
 */
export function invitationMessage(opts: {
  name: string;
  positionTitle: string;
  unitName?: string | null;
  university: string;
  url: string;
  days: number;
}): string {
  return [
    `Dear ${opts.name},`,
    '',
    `Your appointment as ${opts.positionTitle}`
    + `${opts.unitName ? ` in the ${opts.unitName}` : ''} has been accepted, and `
    + `${opts.university} is ready to open your staff record.`,
    '',
    'Please open the link below to give us your email address and telephone number and to '
    + 'choose your password. It takes a minute, and it is the only time you will need it.',
    '',
    opts.url,
    '',
    `The link is for you alone and stops working in ${opts.days} days. Nobody at the `
    + 'University can see the password you choose.',
    '',
    opts.university,
  ].join('\n');
}
