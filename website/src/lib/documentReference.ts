// ---------------------------------------------------------------------------
// THE REFERENCE ON A LETTER: what is stored, and what is printed.
//
// ---------------------------------------------------------------------------
// TWO FORMS, AND THE READER ONLY EVER SEES ONE OF THEM
// ---------------------------------------------------------------------------
//
// The register stores `APT-2026-0042`. The letter prints
// `IGUC/HR/APT/2026/0042` — at the head of the page, in the running footer on
// every page, in the seal panel, and again in the acceptance instructions. The
// printed form is the only form a reader of the document has ever seen.
//
// The verification route accepted the stored form alone, and answered anybody
// typing the printed form with "that is not the shape of an ICOF Global
// University document reference" — followed by a helpful explanation of the
// printed form, to somebody who had just typed the printed form.
//
// ---------------------------------------------------------------------------
// WHY IT IS A FILE AND NOT TWO REGULAR EXPRESSIONS
// ---------------------------------------------------------------------------
//
// Because it was two. The public route had one and the verification page had
// another, and each decided on its own whether a string looked like a
// reference. They already disagreed: the page used its test to choose WHICH
// register to search, so a printed reference was sent to the credential
// register, which has never heard of an appointment letter, and the reader was
// told no such credential had been issued.
//
// A rule that decides which register answers a question belongs in one place.
// ---------------------------------------------------------------------------

/** `APT-2026-0042` — the form the register stores and matches on. */
export const STORED_REFERENCE = /^[A-Z]{2,4}-\d{4}-\d{4,}$/;

/**
 * `IGUC/HR/APT/2026/0042` — the form printed on the document.
 *
 * The middle segments are the University's filing path: the institution, the
 * office, the class of document. None of them is part of the identity, which
 * is why they are matched and discarded rather than parsed.
 */
export const PRINTED_REFERENCE = /^(?:IGUC\/)?(?:[A-Z]{2,4}\/)*([A-Z]{2,4})\/(\d{4})\/(\d{4,})$/;

/**
 * Fold either form into the one the register stores.
 *
 * REJECTS BY RETURNING SOMETHING THAT FAILS `isDocumentReference`, never by
 * throwing. This runs on a public, unauthenticated route against whatever a
 * stranger puts in a query string, and the only correct answer to rubbish is
 * "no document with this reference", in the same words and the same time as
 * for a well-formed reference that does not exist.
 */
export function normaliseReference(raw: string): string {
  const s = (raw ?? '').trim().toUpperCase().replace(/\s+/g, '');
  const printed = PRINTED_REFERENCE.exec(s);
  if (printed) return `${printed[1]}-${printed[2]}-${printed[3]}`;
  return s;
}

/** Whether this is a letter reference at all — in either form. */
export function isDocumentReference(raw: string): boolean {
  return STORED_REFERENCE.test(normaliseReference(raw));
}
