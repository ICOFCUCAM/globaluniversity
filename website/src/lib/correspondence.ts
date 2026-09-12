// ---------------------------------------------------------------------------
// OFFICIAL CORRESPONDENCE — the letters an office starts and finishes itself.
//
// ---------------------------------------------------------------------------
// TWO KINDS OF INSTITUTIONAL LETTER, AND THEY ARE NOT THE SAME
// ---------------------------------------------------------------------------
//
// WORKFLOW-GENERATED. Another office prepares it and the authority signs it:
// HR prepares an appointment, the Vice-Chancellor approves and issues. Those
// live in `appointments` and `appointment_letters`, and the separation between
// preparer and authority is the whole point of them.
//
// ORIGINATED BY THE AUTHORITY. A letter to a ministry, a commendation, an
// invitation, a directive. The Vice-Chancellor writes it and the
// Vice-Chancellor sends it, and forcing that through HR would be inventing an
// approver for the person whose letter it is.
//
// THIS FILE IS THE SECOND KIND. The VC starts and finishes, with nobody else in
// the chain — and that is permitted, deliberately, because a letter to a
// government ministry IS the Vice-Chancellor speaking.
//
// ---------------------------------------------------------------------------
// WHERE THE LINE IS, AND WHY IT IS THERE
// ---------------------------------------------------------------------------
//
// Correspondence commits the University's WORDS. An appointment commits its
// MONEY, and 041 refuses an approval by whoever drafted it for that reason.
// The rule is not relaxed here; it simply does not apply to a letter, because
// there is nothing for a second person to be checking that the author does not
// already know.
//
// What IS enforced: if somebody else prepared the letter, that person cannot
// also authorise it — otherwise asking an administrator to draft would quietly
// move the authority along with the typing.
// ---------------------------------------------------------------------------

import { letterPlainText } from './letterMarkup';

// ---------------------------------------------------------------------------
// 1. THE KINDS
// ---------------------------------------------------------------------------

export const LETTER_KINDS = [
  'general', 'appointment', 'reappointment', 'promotion', 'invitation',
  'commendation', 'recommendation', 'government', 'university', 'partnership',
  'directive', 'warning', 'authorization', 'official-response',
  'special-assignment', 'special', 'other',
] as const;

export type LetterKind = (typeof LETTER_KINDS)[number];

export const KIND_LABELS: Record<LetterKind, string> = {
  general: 'General correspondence',
  appointment: 'Appointment',
  reappointment: 'Reappointment',
  promotion: 'Promotion',
  invitation: 'Invitation',
  commendation: 'Commendation',
  recommendation: 'Recommendation',
  government: 'Government correspondence',
  university: 'University correspondence',
  partnership: 'Partnership',
  directive: 'Directive',
  warning: 'Warning',
  authorization: 'Authorization',
  'official-response': 'Official response',
  'special-assignment': 'Special assignment',
  special: 'Special letter',
  other: 'Other',
};

/**
 * The kinds that go outside the University, to people who are not its members.
 *
 * NOT A RESTRICTION — A PROMPT. A letter to a ministry or another university is
 * read by somebody with no context and no way to ask a follow-up question, and
 * it is the one the composer should be reminded to read back as a stranger. A
 * directive to staff is read by people who know what it is about.
 */
export const OUTWARD_KINDS: LetterKind[] = [
  'government', 'university', 'partnership', 'invitation', 'recommendation',
];

/**
 * The kinds that carry consequences for the person receiving them.
 *
 * A warning and a directive are the two where the University is doing
 * something TO somebody rather than telling them something, and both are
 * likely to be produced in an appeal. Flagged so the composer knows.
 */
export const CONSEQUENTIAL_KINDS: LetterKind[] = ['warning', 'directive'];

export function isLetterKind(v: unknown): v is LetterKind {
  return typeof v === 'string' && (LETTER_KINDS as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// 2. THE OFFICES AND THE STATES
// ---------------------------------------------------------------------------

export const OFFICES = [
  'vice-chancellor', 'chancellor', 'registrar', 'academic-office',
  'hr', 'admissions', 'finance',
] as const;

export type Office = (typeof OFFICES)[number];

export const OFFICE_LABELS: Record<Office, string> = {
  'vice-chancellor': 'Office of the Vice-Chancellor',
  chancellor: 'Office of the Chancellor',
  registrar: 'Office of the Registrar',
  'academic-office': 'Office of Academic Affairs',
  hr: 'Human Resources',
  admissions: 'Office of Admissions',
  finance: 'Finance Office',
};

export const CORRESPONDENCE_STATES = [
  /** Being written by whoever will send it. */
  'draft',
  /** Handed to somebody to prepare. The authority is still the authority. */
  'preparing',
  /** Prepared by somebody else and waiting for the authority to look at it. */
  'awaiting_authority',
  /** Cleared to go. Not gone. */
  'authorized',
  /** Cleared, and waiting for its own time. */
  'scheduled',
  /** Gone. */
  'issued',
  /** Stopped before it went. */
  'withdrawn',
] as const;

export type CorrespondenceState = (typeof CORRESPONDENCE_STATES)[number];

export const STATE_LABELS: Record<CorrespondenceState, string> = {
  draft: 'Draft',
  preparing: 'With a preparer',
  awaiting_authority: 'Awaiting the authority',
  authorized: 'Authorised',
  scheduled: 'Scheduled',
  issued: 'Issued',
  withdrawn: 'Withdrawn',
};

// ---------------------------------------------------------------------------
// 3. THE RECORD
// ---------------------------------------------------------------------------

export interface Correspondence {
  id?: string;
  kind?: string | null;
  originating_office?: string | null;
  subject?: string | null;
  body?: string | null;
  recipient_name?: string | null;
  recipient_org?: string | null;
  recipient_email?: string | null;
  /** A postal address, because a letter to a ministry is often posted. */
  recipient_address?: string | null;
  /**
   * 'plain' or 'html'.
   *
   * HTML is what the rich-text editor produced, sanitised against a closed
   * allow-list BEFORE it was stored — so the archived bytes and the printed
   * bytes are one document and the hash proves the one that went out. See
   * letterMarkup.ts.
   */
  body_format?: string | null;
  status?: string | null;
  initiated_by?: string | null;
  prepared_by?: string | null;
  authorized_by?: string | null;
  scheduled_for?: string | null;
}

export const MIN_SUBJECT = 4;
export const MIN_BODY = 40;
export const MIN_WITHDRAWAL_REASON = 10;

// ---------------------------------------------------------------------------
// 4. WHO MAY DO WHAT
// ---------------------------------------------------------------------------

/**
 * Whether this person may authorise this letter.
 *
 * THE VICE-CHANCELLOR MAY AUTHORISE THEIR OWN. That is the whole distinction
 * this file exists for, and it is not an oversight: a letter to a ministry is
 * the Vice-Chancellor speaking, and requiring somebody else to approve the
 * Vice-Chancellor's own words would be inventing an authority above the one the
 * University has.
 *
 * WHAT IS REFUSED is authorising something SOMEBODY ELSE prepared for you and
 * that you are also recorded as having prepared — the case where delegation
 * would quietly move the authority along with the typing. The database says the
 * same thing.
 */
export function canAuthorize(c: Correspondence, callerId: string): boolean {
  if (c.status !== 'draft' && c.status !== 'awaiting_authority') return false;
  if (c.prepared_by && c.prepared_by === callerId) return false;
  return true;
}

/**
 * Whether the authority can take this letter from start to finish alone.
 *
 * Stated as its own function because it is the University's ruling rather than
 * a consequence somebody has to work out from three others, and because a
 * screen needs to be able to say so.
 */
export function canBeIssuedByOneOffice(c: Correspondence): boolean {
  return !c.prepared_by || c.prepared_by === c.initiated_by;
}

export function canEdit(c: Correspondence): boolean {
  return c.status === 'draft' || c.status === 'preparing'
    || c.status === 'awaiting_authority';
}

export function canIssue(c: Correspondence): boolean {
  return c.status === 'authorized' || c.status === 'scheduled';
}

export function canWithdraw(c: Correspondence): boolean {
  return c.status !== 'issued' && c.status !== 'withdrawn';
}

// ---------------------------------------------------------------------------
// 5. WHAT IS WRONG WITH IT, SAID BEFORE IT GOES
// ---------------------------------------------------------------------------

export interface Objection {
  code: string;
  blocking: boolean;
  message: string;
}

export function objectionsTo(c: Correspondence): Objection[] {
  const out: Objection[] = [];
  const subject = (c.subject ?? '').trim();
  // MEASURED AS PROSE, NOT AS MARKUP. A rich-text body of `<p></p><p></p><p></p>`
  // is forty characters of nothing, and a minimum-length check that counted the
  // tags would pass it — then the Vice-Chancellor would authorise an empty
  // letter that the screen had told them was long enough.
  const body = letterPlainText(c.body ?? '', c.body_format).trim();

  if (!isLetterKind(c.kind)) {
    out.push({
      code: 'no-kind',
      blocking: true,
      message: 'Choose what kind of letter this is. It decides the letterhead, the register it '
        + 'appears in and which template is loaded.',
    });
  }
  if (subject.length < MIN_SUBJECT) {
    out.push({
      code: 'no-subject',
      blocking: true,
      message: 'Give it a subject. It is what the recipient sees first and what the register '
        + 'is searched on.',
    });
  }
  if (body.length < MIN_BODY) {
    out.push({
      code: 'body-too-short',
      blocking: true,
      message: 'A few words on University letterhead tends to raise more questions than it '
        + 'answers.',
    });
  }
  if (!(c.recipient_name ?? '').trim()) {
    out.push({
      code: 'no-recipient',
      blocking: true,
      message: 'Say who it is to. A letter addressed to nobody cannot be sent or filed.',
    });
  }

  // NOT BLOCKING. Each of these is a judgement the author may genuinely have
  // made, said out loud because it is the kind of thing that is obvious
  // afterwards and invisible at the time.
  if (isLetterKind(c.kind) && OUTWARD_KINDS.includes(c.kind)) {
    out.push({
      code: 'goes-outside-the-university',
      blocking: false,
      message: 'This goes to somebody outside the University, who has no context and no easy '
        + 'way to ask a follow-up question. Read it back as a stranger would.',
    });
  }
  if (isLetterKind(c.kind) && CONSEQUENTIAL_KINDS.includes(c.kind)) {
    out.push({
      code: 'carries-consequences',
      blocking: false,
      message: 'A letter like this is the one most likely to be produced in an appeal. Say '
        + 'what happened, what is required and by when — and nothing else.',
    });
  }
  if (!(c.recipient_email ?? '').trim()) {
    out.push({
      code: 'no-email',
      blocking: false,
      message: 'No email address, so this cannot be delivered by the system. It will be issued '
        + 'and archived, and somebody has to send or post it.',
    });
  }

  return out;
}

export function blocks(objections: Objection[]): boolean {
  return objections.some((o) => o.blocking);
}

// ---------------------------------------------------------------------------
// 6. THE REFERENCE
// ---------------------------------------------------------------------------

/** The prefix each office files its correspondence under. */
export const OFFICE_PREFIX: Record<Office, string> = {
  'vice-chancellor': 'VC',
  chancellor: 'CH',
  registrar: 'REG',
  'academic-office': 'ACA',
  hr: 'HR',
  admissions: 'ADM',
  finance: 'FIN',
};

/**
 * VC-2026-0042, filed. IGUC/VC/2026/0042, printed.
 *
 * The same split as an appointment letter and for the same measured reason: a
 * reference with slashes cannot go in a URL path without escaping, and the
 * verification link is exactly where it ends up.
 */
export function reference(office: Office, year: number, sequence: number): string {
  return `${OFFICE_PREFIX[office]}-${year}-${String(sequence).padStart(4, '0')}`;
}

// ---------------------------------------------------------------------------
// 7. THE BOARD
// ---------------------------------------------------------------------------

/**
 * The tabs of the Correspondence Center, and which letters fall under each.
 *
 * COMPUTED HERE RATHER THAN ON THE SCREEN. A component working this out inline
 * would state the rules a second time, differently, and the two would disagree
 * the first time a state was added — which is exactly how the Announcements
 * board came to show a scheduled post under both "Scheduled" and "Drafts".
 */
export const TABS = [
  'drafts', 'awaiting-action', 'scheduled', 'issued', 'archive',
] as const;

export type Tab = (typeof TABS)[number];

export const TAB_LABELS: Record<Tab, string> = {
  drafts: 'Drafts',
  'awaiting-action': 'Awaiting Action',
  scheduled: 'Scheduled',
  issued: 'Issued',
  archive: 'Archive',
};

/**
 * Which tab a letter belongs on. Exactly one, always.
 *
 * 'awaiting-action' IS THE ONE THAT EARNS ITS PLACE. It holds both halves of
 * the waiting: a letter an administrator is preparing, and one that has come
 * back and is sitting on the authority's desk. Somebody asking "what is waiting
 * on me" wants both, and splitting them into two tabs means the second one is
 * never opened.
 */
export function tabFor(c: Correspondence): Tab {
  switch (c.status) {
    case 'draft': return 'drafts';
    case 'preparing':
    case 'awaiting_authority':
    case 'authorized': return 'awaiting-action';
    case 'scheduled': return 'scheduled';
    case 'issued': return 'issued';
    default: return 'archive';
  }
}

export function countersFor(list: Correspondence[]): Record<Tab, number> {
  const out = { drafts: 0, 'awaiting-action': 0, scheduled: 0, issued: 0, archive: 0 };
  for (const c of list) out[tabFor(c)] += 1;
  return out;
}

/**
 * What the screen should offer for this letter, given who is looking.
 *
 * A BUTTON THAT APPEARS AND THEN REFUSES is worse than one never offered: the
 * person clicking it has already decided to do the thing, and the refusal reads
 * as a fault in the system rather than as the rule it is.
 */
export function actionsFor(
  c: Correspondence, callerId: string,
  holds: { authorize?: boolean; issue?: boolean; compose?: boolean },
): string[] {
  const out: string[] = [];
  if (canEdit(c) && (holds.compose || c.prepared_by === callerId)) out.push('edit');
  if (holds.compose && canEdit(c) && !c.prepared_by) out.push('delegate');
  if (c.status === 'preparing' && c.prepared_by === callerId) out.push('handback');
  if (holds.authorize && canAuthorize(c, callerId)) out.push('authorize', 'schedule');
  if (holds.authorize && c.status === 'awaiting_authority'
      && c.prepared_by && c.prepared_by !== callerId) out.push('return');
  if (holds.issue && canIssue(c)) out.push('issue');
  if (canWithdraw(c) && (holds.authorize || holds.compose)) out.push('withdraw');
  return out;
}

export function printedReference(ref: string): string {
  const m = /^([A-Z]{2,4})-(\d{4})-(\d{4,})$/.exec(ref.trim());
  if (!m) return ref;
  return `IGUC/${m[1]}/${m[2]}/${m[3]}`;
}
