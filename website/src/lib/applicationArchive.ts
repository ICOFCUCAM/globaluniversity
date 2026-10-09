// ---------------------------------------------------------------------------
// THE APPLICATION ARCHIVE — what left the register, and why.
//
// ---------------------------------------------------------------------------
// THE UNIVERSITY'S REQUEST
// ---------------------------------------------------------------------------
//
//   "STUDENT WHO FAIL IN THE APPLICATION PROCESS AND OR PAY NOT THEIR
//    APPLICATION FEE AND APPLICATION WAS NOT PROCESS, THAT INFORMATION SHOULD
//    SOMEHOW OVER TIME BE DELETED OR REMOVE SOMEWHERE THAN REMAINING ON THE
//    DASHBOARD"
//
// Asked how long and which ones, they said ninety days; the never-paid, the
// refused, the withdrawn, and the paid-but-never-processed; by itself, with the
// Registrar able to bring one back.
//
// ---------------------------------------------------------------------------
// WHY THE NUMBER LIVES HERE AND NOT IN THE SCREEN
// ---------------------------------------------------------------------------
//
// 109 holds it in SQL, in `application_abandoned_after()`, and the database is
// the authority: it is what actually decides which rows a screen can see. This
// file exists so the screen can SAY ninety without a second opinion about it —
// `applicationArchive.test.mjs` reads the migration and fails if the two ever
// disagree.
//
// A screen that says "ninety days" while the database means sixty is worse
// than a screen that says nothing, because somebody will plan around it.
// ---------------------------------------------------------------------------

/**
 * How long an abandoned application stays on the register.
 *
 * MUST MATCH `application_abandoned_after()` in 109. The test holds them
 * together; this is not a default and not a preference.
 */
export const ARCHIVE_AFTER_DAYS = 90;

/**
 * Why an application left the register, in the words `archived_applications.why`
 * answers in.
 *
 * THE DATABASE CHOOSES THE WORD, not this file — the view's CASE expression
 * does, and these five are the five it can produce. They are spelled out here
 * so the screen can group and label them, and so that a word the view starts
 * producing without this file knowing is visible as an unlabelled group rather
 * than silently rendered as blank.
 */
export const ARCHIVE_REASONS = {
  'never-paid': {
    label: 'Never paid for',
    // THE PLAIN CASE, and the six rows that were filling the University's
    // Students screen when they asked for this.
    note: 'The application fee was never registered, and nothing has happened since.',
  },
  'paid-never-processed': {
    label: 'Paid for, never processed',
    // AND THE ONE THAT IS NOT CLUTTER. These also appear on "Paid and never
    // processed", from the day of the payment and with no age limit at all.
    note: 'The University was paid and the application was never carried to a decision.',
  },
  'documents-never-sent': {
    label: 'Documents never sent',
    note: 'The Registrar asked the applicant for further documents and they never arrived.',
  },
  refused: {
    label: 'Refused',
    note: 'The University declined the application. The decision and its reason are kept.',
  },
  withdrawn: {
    label: 'Withdrawn',
    note: 'The applicant took the application back.',
  },
} as const;

export type ArchiveReason = keyof typeof ARCHIVE_REASONS;

/**
 * The label for a reason, and a readable fallback for one this file has not
 * been taught.
 *
 * NOT A BLANK AND NOT A THROW. A view that grows a sixth reason should produce
 * a row somebody can see and ask about, which is how the University found the
 * last three gaps in this system.
 */
export function reasonLabel(why: string | null | undefined): string {
  if (!why) return 'Unclassified';
  const known = (ARCHIVE_REASONS as Record<string, { label: string }>)[why];
  return known ? known.label : why;
}

export function reasonNote(why: string | null | undefined): string | null {
  if (!why) return null;
  const known = (ARCHIVE_REASONS as Record<string, { note: string }>)[why];
  return known ? known.note : null;
}
