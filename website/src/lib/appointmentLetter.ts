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
import { sealDocument, verificationQrSvg, type DocumentSeal } from './documentSecurity';
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
}

export interface GeneratedLetter {
  html: string;
  seal: DocumentSeal | null;
  reference: string;
  printed: string;
}

const escape = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// ---------------------------------------------------------------------------
// THE PAGE, AS ONE SET OF NUMBERS.
//
// The CSS below is written from these and the page-count test measures against
// them. They were two sets for about ten minutes: the margin changed here and
// the test went on dividing by the old printable height, so a letter that had
// just gained 46px of room was reported as fitting more tightly than before.
// A measurement against a stale constant is worse than no measurement, because
// it is believed.
// ---------------------------------------------------------------------------
export const PAGE = {
  /** A4 at 96dpi, in CSS pixels. */
  width: 794,
  height: 1123,
  /** The @page margin, in millimetres, exactly as the stylesheet uses it. */
  marginTopMm: 12,
  marginSideMm: 16,
} as const;

const PX_PER_MM = 96 / 25.4;

/** The text block a letter actually has, derived rather than restated. */
export const PRINTABLE = {
  width: Math.round(PAGE.width - (2 * PAGE.marginSideMm * PX_PER_MM)),
  height: Math.round(PAGE.height - (2 * PAGE.marginTopMm * PX_PER_MM)),
} as const;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * A date as the letter prints it: 12 September 2026.
 *
 * SPELLED OUT RATHER THAN LOCALISED. `toLocaleDateString` renders "Sept" on one
 * ICU build and "Sep" on the next, so the same document generated on the server
 * and previewed in a browser could disagree about its own date. A register
 * prints its own months.
 */
export function longDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

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
    'ICOFGU-APPOINTMENT-V1',
    'Appointment Letter',
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
  let qr = '';
  try {
    seal = sealAppointment(a, input.reference, input.issuedOn, input.siteUrl);
    qr = await verificationQrSvg(seal.verifyUrl, 88);
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
<style>
  /* ---------------------------------------------------------------------
     MEASURED, NOT CHOSEN. With the first set of numbers a letter carrying a
     realistic block of terms came to 1293px against a 987px printable page,
     and the signature landed 40px onto page two — so the appointee turned over
     and found a name, a line and a QR code. The spacing below is what brings a
     full letter onto one page; src/lib/appointmentLetterPages.test.mjs renders
     it in Chromium and refuses a signature that does not share its page with
     the letter.
     --------------------------------------------------------------------- */
  @page { size: A4; margin: ${PAGE.marginTopMm}mm ${PAGE.marginSideMm}mm; }
  body { font: 10.5pt/1.34 Georgia, 'Times New Roman', serif; color: #1c1720; margin: 0; }
  p { margin: 6px 0; }
  /* A PAGE BREAK NEVER STRANDS ONE LINE. Without these a long set of terms can
     leave a single line at the foot of page one or the head of page two, which
     reads as a printing fault on a document somebody is about to sign. */
  p, .terms { orphans: 3; widows: 3; }
  .head { display: flex; gap: 14px; align-items: center;
          border-bottom: 2px solid #422e59; padding-bottom: 10px; }
  .head h1 { font-size: 15pt; margin: 0; letter-spacing: .04em; color: #422e59; }
  .head p { margin: 2px 0 0; font-size: 8.5pt; color: #5c5366; }
  h2 { font-size: 12pt; letter-spacing: .16em; text-align: center;
       margin: 12px 0 3px; text-transform: uppercase; }
  .meta { display: flex; justify-content: space-between; font-size: 9.5pt;
          color: #4a4155; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; margin: 9px 0; }
  th, td { text-align: left; padding: 3px 8px; border-bottom: 1px solid #e6e0ee;
           font-size: 9.5pt; vertical-align: top; }
  th { width: 38%; font-weight: normal; color: #5c5366; }
  .terms { white-space: pre-wrap; font-size: 9.5pt; margin: 8px 0; }
  .auth { font-size: 9.5pt; color: #4a4155; font-style: italic; }
  /* KEPT TOGETHER. Even at this spacing a long set of terms can push the
     signature over, and a signature separated from the letter it signs is the
     failure this whole block exists to prevent. */
  .sign { margin-top: 12px; break-inside: avoid; page-break-inside: avoid; }
  .byauthority { letter-spacing: .1em; font-size: 9pt; font-weight: bold; margin-bottom: 10px; }
  .sign .line { border-top: 1px solid #1c1720; width: 62mm; margin-top: 16px; }
  .seal { margin-top: 8px; border-top: 1px solid #e6e0ee; padding-top: 6px;
          display: flex; gap: 12px; align-items: center; font-size: 8pt; color: #5c5366;
          break-inside: avoid; page-break-inside: avoid; }
  .none { color: #8a8194; font-style: italic; }
</style>

<div class="head">
  <div>
    <h1>${escape(UNIVERSITY.name)}</h1>
    <p>${escape(UNIVERSITY.address)}</p>
    <p>${escape(UNIVERSITY.phone)} · ${escape(UNIVERSITY.email)} · ${escape(UNIVERSITY.website)}</p>
  </div>
</div>

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

<div class="sign">
  <!-- THE AUTHORITY IS STATED ON THE PAGE, not inferred from whose name is at
       the foot. A reader of this letter in five years needs to know it was made
       by the office that may make it, and a signature alone does not say so. -->
  <p class="byauthority">BY AUTHORITY OF THE VICE-CHANCELLOR</p>
  <p>Yours sincerely,</p>
  <div class="line"></div>
  <p><strong>${escape(input.signatoryName)}</strong><br>${escape(input.signatoryRole)}<br>
  ${escape(UNIVERSITY.name)}</p>
</div>

<div class="seal">
  ${qr}
  <div>
    ${seal
      ? `<p><strong>Verification code:</strong> ${escape(seal.code)}</p>
         <p>Check this document at ${escape(UNIVERSITY.website)}/verify</p>`
      // SAID ON THE PAGE, not hidden. A letter that carries no seal must not
      // look like one that does — a reader told to scan a code that is not
      // there learns to distrust the ones that are.
      : `<p class="none">This copy carries no verification seal. The University's signing
         secret was not configured when it was generated.</p>`}
    <p>${escape(printedReference(input.reference))} · version ${input.version}</p>
  </div>
</div>
`,
  };
}
