// ---------------------------------------------------------------------------
// APPOINTMENTS — the record, and the letter that issues from it.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
//
// The University had nowhere to record that it had appointed somebody.
// `lecturers` holds a name, a department and a specialisation — who teaches
// what — and `profiles` holds an account. Neither records a position, a start
// date, an employment type, a probation period, a place of duty, a reporting
// officer or a salary.
//
// So every appointment letter was typed by hand into a word processor from
// facts that existed only in the letter. THAT is the fault, and it is not that
// the letters were manual: it is that the LETTER WAS THE RECORD. Ask the system
// who reports to whom, whose probation ends this month, or what somebody was
// actually appointed as, and it could not answer, because the answer was in a
// .docx on somebody's laptop.
//
// ---------------------------------------------------------------------------
// SO THE LETTER IS AN OUTPUT
// ---------------------------------------------------------------------------
//
// It is GENERATED from the record and never edited. A letter that has gone out
// is superseded by a new version generated from the corrected record, and the
// old one stays — because somebody is holding it, and if the University cannot
// produce what it actually sent, the copy in their hand is the only version of
// that fact.
//
// THE SEALING IS NOT REBUILT. `documentSecurity.ts` already produces the
// verification code, the QR and the signature for every sealed document this
// University issues, and an appointment letter is one more of those rather than
// a second scheme with its own idea of what a seal is.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 1. THE WORKFLOW
// ---------------------------------------------------------------------------

/**
 * Every state an appointment can hold.
 *
 * `withdrawn` and `declined` are separate and the difference is whose decision
 * it was. The University withdrawing an offer and the appointee turning it down
 * are not the same event, and a record that calls both the same thing cannot
 * answer why a post is empty.
 */
export const APPOINTMENT_STATES = [
  /** Being drafted by Human Resources. */
  'draft',
  /** Sent for approval. The drafter can no longer edit it. */
  'submitted',
  /** Approved by somebody other than the drafter. No letter yet. */
  'approved',
  // ---------------------------------------------------------------------
  // FOUR STATES WHERE 041 HAD ONE.
  //
  // `issued` was carrying four different facts: the letter exists, the letter
  // was sent, the appointee said yes, and the person is in post. They come
  // apart constantly — a letter generated and never sent, a letter sent and
  // never answered, an acceptance for a post that starts in three months — and
  // one state cannot tell a Head of Department whether anybody is coming.
  // ---------------------------------------------------------------------
  /** The document exists. Nobody has been sent it. */
  'letter_generated',
  /** The letter has gone to the appointee. */
  'issued',
  /** The appointee has said yes. */
  'accepted',
  /** In post. */
  'active',
  /** Something changed after issuance and the letter must be revised. */
  'amendment_requested',
  /** The appointee turned it down. */
  'declined',
  /** The University withdrew it before it was taken up. */
  'withdrawn',
  /** The appointment ran its course, or was ended. */
  'ended',
] as const;

export type AppointmentState = (typeof APPOINTMENT_STATES)[number];

export const STATE_LABELS: Record<AppointmentState, string> = {
  draft: 'Draft',
  submitted: 'Awaiting approval',
  approved: 'Approved',
  letter_generated: 'Letter generated',
  issued: 'Letter issued',
  accepted: 'Accepted',
  active: 'Active',
  amendment_requested: 'Amendment requested',
  declined: 'Declined by appointee',
  withdrawn: 'Withdrawn by the University',
  ended: 'Ended',
};

/**
 * The ordinary path, in order, for a screen that draws it as a chain.
 *
 * THE CLOSURES ARE NOT ON IT. `declined`, `withdrawn` and `ended` are places an
 * appointment leaves the path, not steps along it, and drawing them in a line
 * would suggest every appointment passes through being declined.
 */
export const LIFECYCLE: AppointmentState[] = [
  'draft', 'submitted', 'approved', 'letter_generated', 'issued', 'accepted', 'active',
];

/** States from which an issued appointment can be amended. */
export const AMENDABLE_FROM: AppointmentState[] = ['issued', 'accepted', 'active'];

export function canRequestAmendment(a: Appointment): boolean {
  return AMENDABLE_FROM.includes(a.status as AppointmentState);
}

/**
 * Whether somebody may be made a member of staff from this appointment.
 *
 * THE DOOR 042 CLOSES. A staff record created before the letter was issued is a
 * person the system says works here on nobody's authority — with a department,
 * a portal account and a place in the timetable. The database refuses it; this
 * is the screen agreeing rather than the rule itself.
 */
export function canActivateStaff(a: Appointment & { issued_at?: string | null }): boolean {
  return Boolean(a.issued_at)
    && (a.status === 'issued' || a.status === 'accepted' || a.status === 'active');
}

export const APPOINTMENT_EVENTS = [
  'DRAFTED', 'EDITED', 'SUBMITTED_FOR_AUTHORITY', 'AUTHORIZED', 'RETURNED',
  'LETTER_GENERATED', 'LETTER_ISSUED', 'LETTER_DELIVERY_FAILED', 'LETTER_SUPERSEDED',
  'DECLINED', 'WITHDRAWN', 'ENDED', 'ADMINISTRATIVE_OVERRIDE',
] as const;

export type AppointmentEvent = (typeof APPOINTMENT_EVENTS)[number];

// ---------------------------------------------------------------------------
// 2. THE VOCABULARIES
// ---------------------------------------------------------------------------

/**
 * A CLOSED LIST. "Employment type" written free-hand produces "Full time",
 * "full-time", "FT" and "Permanent (full time)" inside a year, and then nothing
 * can be counted — which matters the first time somebody asks how many
 * permanent staff the University has.
 */
export const EMPLOYMENT_TYPES = [
  'permanent', 'fixed-term', 'part-time', 'visiting',
  'adjunct', 'honorary', 'secondment', 'probationary',
] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  permanent: 'Permanent',
  'fixed-term': 'Fixed term',
  'part-time': 'Part time',
  visiting: 'Visiting',
  adjunct: 'Adjunct',
  honorary: 'Honorary',
  secondment: 'Secondment',
  probationary: 'Probationary',
};

/** The types that must state an end date, because they end. */
export const MUST_END: EmploymentType[] = ['fixed-term'];

/**
 * The types that carry no salary by default.
 *
 * NOT A RULE, A PROMPT. An honorary appointment with a salary is unusual and
 * probably a mistake; it is not impossible, and a system that refused it would
 * be deciding something the University has not.
 */
export const USUALLY_UNPAID: EmploymentType[] = ['honorary'];

export const CURRENCIES = ['FCFA', 'USD', 'EUR', 'GBP', 'NGN'] as const;
export const SALARY_PERIODS = ['hour', 'month', 'year', 'session'] as const;

export type Currency = (typeof CURRENCIES)[number];
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];

export const PERIOD_LABELS: Record<SalaryPeriod, string> = {
  hour: 'per hour',
  month: 'per month',
  year: 'per annum',
  session: 'per session',
};

export function isEmploymentType(v: unknown): v is EmploymentType {
  return typeof v === 'string' && (EMPLOYMENT_TYPES as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// 3. THE RECORD
// ---------------------------------------------------------------------------

export interface Appointment {
  id?: string;
  person_id?: string | null;

  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  postal_address?: string | null;

  position_title?: string | null;
  unit_name?: string | null;
  employment_type?: string | null;

  start_date?: string | null;
  end_date?: string | null;
  effective_date?: string | null;
  probation_months?: number | null;

  place_of_duty?: string | null;
  reports_to_name?: string | null;

  salary_amount?: number | null;
  salary_currency?: string | null;
  salary_period?: string | null;

  terms?: string | null;

  status?: string | null;
  drafted_by?: string | null;
  authorized_by?: string | null;
}

// ---------------------------------------------------------------------------
// 4. WHAT THE LETTER MUST CARRY
// ---------------------------------------------------------------------------
//
// THE UNIVERSITY'S OWN LIST, in the order it gave it. Each entry says how to
// read the field off the record and whether a letter can go out without it.
//
// WHY REQUIRED AND OPTIONAL ARE BOTH HERE. A letter missing the start date is
// not a letter; a letter missing the salary may be an honorary appointment. The
// difference cannot be guessed from whether a column is null, so it is stated —
// and the ones that are merely ABSENT are listed on the review screen, so
// nobody authorises a letter with a blank where a probation period should be
// and finds out when the appointee asks.

export interface LetterField {
  key: string;
  /** What the letter calls it. */
  label: string;
  required: boolean;
  /** Why it is required, or when it is legitimately absent. */
  note: string;
}

export const LETTER_FIELDS: LetterField[] = [
  { key: 'full_name', label: 'Full name', required: true,
    note: 'The letter is addressed to somebody.' },
  { key: 'position_title', label: 'Position', required: true,
    note: 'What they are appointed as. The single fact the letter exists to state.' },
  { key: 'unit_name', label: 'Department or faculty', required: false,
    note: 'Absent for a central post that belongs to no faculty.' },
  { key: 'employment_type', label: 'Employment type', required: true,
    note: 'Permanent and fixed-term carry different obligations on both sides.' },
  { key: 'start_date', label: 'Start date', required: true,
    note: 'The day they are expected. A letter without one is not an appointment.' },
  { key: 'end_date', label: 'End date', required: false,
    note: 'Required for a fixed term; absent for an open-ended appointment.' },
  { key: 'effective_date', label: 'Effective date', required: false,
    note: 'Where it differs from the start date — a promotion effective from the '
      + 'first of the month but taken up later.' },
  { key: 'probation_months', label: 'Probation', required: false,
    note: 'Absent where there is none. A blank on the page reads as "none" and '
      + 'that is a claim, so the letter says so rather than leaving the line empty.' },
  { key: 'salary', label: 'Remuneration', required: false,
    note: 'Absent for an honorary appointment. Where present it is a figure, a '
      + 'currency and a period — never a number on its own.' },
  { key: 'reports_to_name', label: 'Reporting officer', required: false,
    note: 'Absent where the post reports to a body rather than a person.' },
  { key: 'place_of_duty', label: 'Place of duty', required: true,
    note: 'The University is not only online. Somebody appointed without being '
      + 'told where to turn up has not been told the main thing.' },
  { key: 'terms', label: 'Terms and conditions', required: true,
    note: 'What the appointment is subject to. A letter with no terms is an '
      + 'offer the University cannot later rely on.' },
  { key: 'postal_address', label: 'Address', required: false,
    note: 'Printed where held, for a letter that will also be posted.' },
];

export interface Missing {
  key: string;
  label: string;
  blocking: boolean;
  message: string;
}

/**
 * Everything the letter cannot say yet, said before anybody authorises it.
 *
 * RETURNED TOGETHER, not one at a time. Somebody completing an appointment
 * record should be told everything that is outstanding, not sent back for the
 * second thing after fixing the first.
 */
export function missingFrom(a: Appointment): Missing[] {
  const out: Missing[] = [];
  const has = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== '';

  for (const f of LETTER_FIELDS) {
    if (f.key === 'salary') continue;
    if (f.key === 'end_date') continue;
    const value = (a as Record<string, unknown>)[f.key];
    if (!has(value)) {
      out.push({
        key: f.key,
        label: f.label,
        blocking: f.required,
        message: f.required
          ? `${f.label} is missing, and the letter cannot be issued without it. ${f.note}`
          : `${f.label} is not recorded. ${f.note}`,
      });
    }
  }

  // A FIXED TERM HAS A TERM. The database refuses it; this says so on the
  // screen rather than letting somebody meet a constraint violation.
  if (MUST_END.includes(a.employment_type as EmploymentType) && !has(a.end_date)) {
    out.push({
      key: 'end_date',
      label: 'End date',
      blocking: true,
      message: 'A fixed-term appointment must state when it ends. Without one it is a '
        + 'permanent appointment wearing the wrong label, and nobody finds out until '
        + 'somebody asks when it finishes.',
    });
  }

  // A SALARY IS A FIGURE, A CURRENCY AND A PERIOD, OR IT IS NONE OF THEM.
  // "450,000" with no currency and no period is not something anybody can rely
  // on, and each half looks complete on its own — which is how the omission
  // reaches a signature.
  const parts = [a.salary_amount, a.salary_currency, a.salary_period];
  const given = parts.filter((p) => has(p)).length;
  if (given > 0 && given < 3) {
    out.push({
      key: 'salary',
      label: 'Remuneration',
      blocking: true,
      message: 'A salary is an amount, a currency and a period. A figure on its own is not '
        + 'something the appointee or the University can rely on.',
    });
  }
  if (given === 0 && !USUALLY_UNPAID.includes(a.employment_type as EmploymentType)) {
    out.push({
      key: 'salary',
      label: 'Remuneration',
      blocking: false,
      message: 'No remuneration is recorded. The letter will not mention pay at all — which is '
        + 'right for an unpaid post and a serious omission for any other.',
    });
  }

  return out;
}

export function blocked(missing: Missing[]): boolean {
  return missing.some((m) => m.blocking);
}

// ---------------------------------------------------------------------------
// 5. WHO MAY DO WHAT
// ---------------------------------------------------------------------------

export const MIN_CLOSURE_REASON = 10;
export const MIN_RETURN_REASON = 12;

export function canEdit(a: Appointment): boolean {
  return a.status === 'draft';
}

export function canSubmit(a: Appointment): boolean {
  return a.status === 'draft' && !blocked(missingFrom(a));
}

/**
 * Whether this person may authorise this appointment.
 *
 * REFUSES THE DRAFTER BY NAME, not by role. An appointment letter commits the
 * University to paying somebody; one person drafting, authorising and sending
 * it alone is the largest version of the thing 005, 009, 014 and 038 all exist
 * to prevent. A Superadministrator who drafted it is still its drafter.
 */
export function canAuthorize(a: Appointment, callerId: string): boolean {
  // AN AMENDMENT GOES BACK THROUGH APPROVAL, by somebody other than whoever
  // asked for it. A revised letter that one person requested and approved
  // alone is the original rule with an extra step in front of it.
  return (a.status === 'submitted' || a.status === 'amendment_requested')
    && a.drafted_by !== callerId;
}

/** A letter is generated from an authorised appointment, never a draft. */
export function canGenerateLetter(a: Appointment): boolean {
  return (a.status === 'approved' || a.status === 'letter_generated' || a.status === 'issued')
    && !blocked(missingFrom(a));
}

export function canClose(a: Appointment): boolean {
  return a.status !== 'declined' && a.status !== 'withdrawn' && a.status !== 'ended';
}

/** The least an amendment may say about what changed. */
export const MIN_AMENDMENT_REASON = 12;

// ---------------------------------------------------------------------------
// 6. THE REFERENCE ON THE PAGE
// ---------------------------------------------------------------------------

/**
 * The reference a letter carries and somebody quotes on the telephone.
 *
 * SEQUENTIAL WITHIN A YEAR, and the sequence is supplied by the caller after
 * reading the register — not generated here from a timestamp or a random
 * string. A reference nobody can predict is one nobody can file, and a
 * reference that encodes the time of day tells a recipient how long the
 * University took, which is nobody's business.
 */
export function letterReference(year: number, sequence: number): string {
  // APT-2026-0042. No slashes: a reference with them cannot go in a URL path
  // without escaping, and a verification link is exactly where this ends up.
  return `APT-${year}-${String(sequence).padStart(4, '0')}`;
}

/** The parts back out of a reference, for a register lookup. */
export function parseReference(ref: string): { year: number; sequence: number } | null {
  const m = /^APT-(\d{4})-(\d{4,})$/.exec(ref.trim());
  if (!m) return null;
  return { year: Number(m[1]), sequence: Number(m[2]) };
}

/**
 * The salary as the letter prints it.
 *
 * NEVER A BARE NUMBER. Returns null where there is no salary, so a caller has
 * to decide what to print rather than being handed an empty string that quietly
 * becomes a blank line under "Remuneration".
 */
export function remunerationLine(a: Appointment): string | null {
  if (a.salary_amount == null || !a.salary_currency || !a.salary_period) return null;
  const amount = Number(a.salary_amount).toLocaleString('en-GB', { maximumFractionDigits: 2 });
  const period = PERIOD_LABELS[a.salary_period as SalaryPeriod] ?? a.salary_period;
  return `${a.salary_currency} ${amount} ${period}`;
}

/** When probation ends, which is the question the record now exists to answer. */
export function probationEnds(a: Appointment): string | null {
  if (!a.probation_months || !a.start_date) return null;
  const d = new Date(`${a.start_date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCMonth(d.getUTCMonth() + a.probation_months);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// 7. THE LETTER HISTORY, AS THE UNIVERSITY ASKED TO READ IT
// ---------------------------------------------------------------------------
//
//   Version 1 — Issued 12 Sept 2026
//   Version 2 — Amended 20 Sept 2026
//   Version 3 — Re-issued 25 Sept 2026
//
// "Amended" and "re-issued" are not the same thing. The first is a changed
// appointment; the second is the same appointment sent again, because the
// first attempt bounced or the appointee lost it. A history that called both
// "revised" would hide the only interesting difference between them.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---------------------------------------------------------------------------
// THE DOCUMENT TYPES HR ACTUALLY ISSUES
// ---------------------------------------------------------------------------
//
// NOT ONE LETTER. An appointment letter, a promotion letter and a termination
// letter are the same machinery — a structured record, a template, a version, a
// seal, a QR — and hard-coding the first would mean building the second from
// scratch when somebody is promoted.
//
// THE TYPE DECIDES WHAT THE DOCUMENT MUST SAY. A promotion states the previous
// position and the new one; a contract renewal states the term it renews; a
// termination states the last day. Those are not the same required fields, and
// a single template with everything optional produces a promotion letter with a
// blank where the old title should be.
export const DOCUMENT_TYPES = [
  'initial-appointment', 'reappointment', 'contract-renewal', 'promotion',
  'transfer', 'acting-appointment', 'probation-confirmation', 'contract-extension',
  'appointment-amendment', 'termination', 'retirement',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  'initial-appointment': 'Initial Appointment',
  reappointment: 'Reappointment',
  'contract-renewal': 'Contract Renewal',
  promotion: 'Promotion',
  transfer: 'Transfer',
  'acting-appointment': 'Acting Appointment',
  'probation-confirmation': 'Probation Confirmation',
  'contract-extension': 'Contract Extension',
  'appointment-amendment': 'Appointment Amendment',
  termination: 'Termination / End of Appointment',
  retirement: 'Retirement',
};

/**
 * What each type must state beyond the ordinary appointment fields.
 *
 * Empty for an initial appointment, because that is the one the ordinary fields
 * were written for. Everything else is a document ABOUT a change, and a
 * document about a change that does not say what changed is not one.
 */
export const TYPE_REQUIRES: Record<DocumentType, string[]> = {
  'initial-appointment': [],
  reappointment: ['previous_end_date'],
  'contract-renewal': ['previous_end_date', 'end_date'],
  promotion: ['previous_position'],
  transfer: ['previous_unit'],
  'acting-appointment': ['end_date'],
  'probation-confirmation': ['probation_months'],
  'contract-extension': ['previous_end_date', 'end_date'],
  'appointment-amendment': ['amendment_reason'],
  termination: ['end_date', 'closed_reason'],
  retirement: ['end_date'],
};

export function isDocumentType(v: unknown): v is DocumentType {
  return typeof v === 'string' && (DOCUMENT_TYPES as readonly string[]).includes(v);
}

/**
 * What this document type cannot say yet.
 *
 * SEPARATE FROM `missingFrom`, which asks whether the APPOINTMENT is complete.
 * This asks whether the DOCUMENT is: a promotion letter needs the previous
 * position, and the appointment record is perfectly complete without it.
 */
export function missingForType(
  type: string,
  facts: Record<string, unknown>,
): Missing[] {
  if (!isDocumentType(type)) {
    return [{
      key: 'document_type',
      label: 'Document type',
      blocking: true,
      message: 'Choose what kind of letter this is. A promotion and a renewal are not the '
        + 'same document and do not say the same things.',
    }];
  }
  return TYPE_REQUIRES[type]
    .filter((k) => {
      const v = facts[k];
      return v === null || v === undefined || String(v).trim() === '';
    })
    .map((k) => ({
      key: k,
      label: k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
      blocking: true,
      message: `A ${DOCUMENT_TYPE_LABELS[type].toLowerCase()} must state this. A document `
        + 'about a change that does not say what changed is not one.',
    }));
}

export type LetterKind = 'issued' | 'amended' | 'reissued';

export const LETTER_KIND_LABELS: Record<LetterKind, string> = {
  issued: 'Issued',
  amended: 'Amended',
  reissued: 'Re-issued',
};

export interface LetterVersion {
  reference: string;
  version: number;
  kind: LetterKind;
  issued_on: string;
  supersedes_reason?: string | null;
  superseded_at?: string | null;
}

/** One line per version, oldest first, the way a file is read. */
export function letterHistory(versions: LetterVersion[]): string[] {
  return [...versions]
    .sort((a, b) => a.version - b.version)
    .map((v) => {
      // SPELLED OUT RATHER THAN LOCALISED. toLocaleDateString's short month
      // is "Sep" on one ICU build and "Sept" on the next, so the same letter
      // history rendered on the server and in the browser could disagree about
      // the date on a document — and a test written against one of them passes
      // until the runtime is upgraded. A register prints its own months.
      const d = new Date(`${v.issued_on}T00:00:00Z`);
      const when = Number.isNaN(d.getTime())
        ? v.issued_on
        : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
      const why = v.supersedes_reason ? ` — ${v.supersedes_reason}` : '';
      return `Version ${v.version} — ${LETTER_KIND_LABELS[v.kind]} ${when}${why}`;
    });
}

/**
 * What a reader of the document is told when they scan the code.
 *
 * A SUPERSEDED LETTER IS NOT INVALID, and saying so would be wrong in a way
 * that costs somebody a visa. It was genuine and it has been replaced; the
 * reader is told which version is current so they can ask for it.
 */
export function verificationStatus(
  letter: { superseded_at?: string | null },
  appointment: { status?: string | null },
): 'Valid' | 'Superseded' | 'Not in force' | 'Ended' {
  if (letter.superseded_at) return 'Superseded';
  if (appointment.status === 'withdrawn' || appointment.status === 'declined') return 'Not in force';
  if (appointment.status === 'ended') return 'Ended';
  return 'Valid';
}
