// ---------------------------------------------------------------------------
// THE APPOINTMENT LETTER, GENERATED FROM THE RECORD.
//
// ---------------------------------------------------------------------------
// NOBODY TYPES ANYTHING
// ---------------------------------------------------------------------------
//
// Every field on this page comes out of `appointments`. Not one of them is
// typed by an administrator at the moment of generating, which is the whole
// point: a name typed into a letter is a name that can differ from the name in
// the register, and then the University has two answers and a signature on the
// wrong one.
//
// The consequence is that the letter cannot be generated until the record is
// complete. `missingFrom` says what is outstanding, on the screen, before
// anybody approves anything — rather than a blank line appearing under
// "Probation" on a signed document.
//
// ---------------------------------------------------------------------------
// GENERATED IS NOT ISSUED
// ---------------------------------------------------------------------------
//
// This function produces a document. It does not send it, does not record it
// as issued and does not make anybody a member of staff. Those are three
// further acts with three further authorities, and collapsing them is how a
// preview becomes an appointment.
//
// ---------------------------------------------------------------------------
// THE SEAL IS NOT A SECOND SCHEME
// ---------------------------------------------------------------------------
//
// `documentSecurity.ts` already produces the verification code, the QR and the
// signature for every sealed document this University issues. An appointment
// letter is one more of those. A second sealing scheme would mean two answers
// to "is this genuine", and the reader of the document cannot be expected to
// know which one they are holding.
// ---------------------------------------------------------------------------

import { UNIVERSITY } from './constants';
import { sealDocument, type DocumentSeal } from './documentSecurity';
// THE PRESS, SHARED. The page, the letterhead, the signature block and the seal
// panel were written here and again for correspondence; the second copy drifted
// within a day of the first being touched. See officialDocument.ts for where
// the line between the shared press and the unshared workflow is drawn.
import {
  PAGE, PRINTABLE, escape, longDate, documentStyles, letterhead, signatureBlock, sealPanel, runningFooter,
  DOCUMENT_FAMILIES,
} from './officialDocument';
import {
  EMPLOYMENT_LABELS, remunerationLine, probationEnds, printedReference,
  missingFrom, blocked,
  type Appointment, type EmploymentType,
} from './appointments';

export interface LetterInput {
  appointment: Appointment & { id?: string };
  /** The stored reference: APT-2026-0042. */
  reference: string;
  /** The date the letter bears, which is what the seal is computed over. */
  issuedOn: string;
  version: number;
  /** The office whose name and signature appear at the foot. */
  signatoryName: string;
  signatoryRole: string;
  siteUrl: string;
  /**
   * A specimen signature to reproduce, where the University has enabled one.
   *
   * EXPLICIT AND CONTROLLED, as the University asked — never an image dropped
   * onto every document. 049 keeps a specimen off until somebody other than its
   * owner enables it with a stated authority, and the archived letter records
   * which mode it was signed in.
   */
  signatureImage?: string | null;
  /** The date the authority approved it, printed under the signature block. */
  authorizedOn?: string | null;
}

export interface GeneratedLetter {
  html: string;
  seal: DocumentSeal | null;
  reference: string;
  printed: string;
}

// THE PAGE AND THE DATE COME FROM THE ENGINE. Re-exported because the page-count
// test imports them from the letter it is measuring, which is the right place to
// ask — a test that reads the geometry from somewhere other than the document
// under test is measuring a number, not a page.
export { PAGE, PRINTABLE, longDate };

/**
 * Seal an appointment letter with the scheme every other IGUC document uses.
 *
 * WHAT IS SEALED IS WHAT A READER CAN CHECK. The name, the position, the
 * reference and the date — the four things on the page a forger would change.
 * Not the salary: it is not printed on the verification page, so sealing it
 * would make the seal depend on something the verifier cannot see, and a seal
 * that cannot be recomputed by the person checking it is decoration.
 */
export function sealAppointment(
  a: Appointment, reference: string, issuedOn: string, siteUrl: string,
): DocumentSeal {
  return sealDocument(
    DOCUMENT_FAMILIES.appointment.scheme,
    DOCUMENT_FAMILIES.appointment.label,
    {
      name: a.full_name ?? '',
      position: a.position_title ?? '',
      unit: a.unit_name ?? '',
      reference,
      issued: issuedOn,
    },
    siteUrl,
  );
}

/**
 * The letter itself.
 *
 * REFUSES AN INCOMPLETE RECORD rather than printing a blank. A letter with an
 * empty line where the start date should be is worse than no letter: it looks
 * finished, it gets signed, and the omission is discovered by the appointee.
 */
export async function appointmentLetterHtml(input: LetterInput): Promise<GeneratedLetter> {
  const a = input.appointment;

  const outstanding = missingFrom(a);
  if (blocked(outstanding)) {
    throw new Error(
      'This appointment is not complete, so no letter can be generated from it: '
      + outstanding.filter((m) => m.blocking).map((m) => m.label).join(', ')
      + '. Complete the record — nothing on the letter is typed by hand, so an incomplete '
      + 'record is an incomplete letter.',
    );
  }

  let seal: DocumentSeal | null = null;
  try {
    seal = sealAppointment(a, input.reference, input.issuedOn, input.siteUrl);
  } catch {
    // UNSEALED RATHER THAN UNISSUED. CREDENTIAL_SECRET may be absent in a
    // deployment that has not been configured, and an appointment held up by a
    // missing environment variable is worse than one that goes out with the
    // seal panel saying plainly that it carries none.
    seal = null;
  }

  const pay = remunerationLine(a);
  const probation = probationEnds(a);

  // EVERY ROW COMES OUT OF THE RECORD. A row whose value is absent is omitted
  // rather than printed empty — a blank beside "Probation" reads as "none",
  // which is a claim the University has not made.
  const rows: [string, string | null][] = [
    ['Position', a.position_title ?? null],
    ['Department or faculty', a.unit_name ?? null],
    ['Employment type',
      EMPLOYMENT_LABELS[a.employment_type as EmploymentType] ?? a.employment_type ?? null],
    ['Date of commencement', longDate(a.start_date) || null],
    ['Effective date', a.effective_date ? longDate(a.effective_date) : null],
    ['Expiry of appointment', a.end_date ? longDate(a.end_date) : null],
    ['Working hours', a.working_hours ?? null],
    ['Probation', a.probation_months
      ? `${a.probation_months} months, to ${longDate(probation)}` : null],
    ['Place of duty', a.place_of_duty ?? null],
    ['Reporting officer', a.reports_to_name ?? null],
    ['Remuneration', pay],
  ];

  const authority = a.appointing_authority
    ? `<p class="auth">This appointment is made on the authority of ${escape(a.appointing_authority)}`
      + `${a.authority_decided_on ? `, ${escape(longDate(a.authority_decided_on))}` : ''}.</p>`
    : '';

  return {
    reference: input.reference,
    printed: printedReference(input.reference),
    seal,
    html: `<!doctype html>
<meta charset="utf-8">
<title>Appointment Letter ${escape(printedReference(input.reference))}</title>
<style>${documentStyles()}</style>

${letterhead()}

<h2>Appointment Letter</h2>

<div class="meta">
  <span>Date: ${escape(longDate(input.issuedOn))}</span>
  <span>Ref: ${escape(printedReference(input.reference))}${
    input.version > 1 ? ` (version ${input.version})` : ''}</span>
</div>

<p>${escape(a.full_name)}</p>
${a.postal_address ? `<p>${escape(a.postal_address)}</p>` : ''}

<p>Dear ${escape(a.full_name)},</p>

<p>We are pleased to formally appoint you as <strong>${escape(a.position_title)}</strong>${
  a.unit_name ? ` in the ${escape(a.unit_name)}` : ''} of ${escape(UNIVERSITY.name)},
on the terms set out below.</p>

<table>
${rows.filter(([, v]) => v).map(([k, v]) =>
  `  <tr><th>${escape(k)}</th><td>${escape(v)}</td></tr>`).join('\n')}
</table>

${a.terms ? `<p class="terms">${escape(a.terms)}</p>` : ''}

${authority}

<p>Please confirm your acceptance of this appointment in writing. This letter may be verified
independently using the reference and code below.</p>

${signatureBlock({
  // THE AUTHORITY IS STATED ON THE PAGE, not inferred from whose name is at the
  // foot. A reader of this letter in five years needs to know it was made by the
  // office that may make it, and a signature alone does not say so.
  byAuthorityOf: 'the Vice-Chancellor',
  name: input.signatoryName,
  role: input.signatoryRole,
  image: input.signatureImage,
  authorizedOn: input.authorizedOn,
})}

${await sealPanel(seal, printedReference(input.reference), input.version)}
${runningFooter(printedReference(input.reference), DOCUMENT_FAMILIES.appointment.label)}
`,
  };
}
