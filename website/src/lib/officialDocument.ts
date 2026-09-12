// ---------------------------------------------------------------------------
// THE OFFICIAL DOCUMENT ENGINE — the half of it that should be one thing.
//
// ---------------------------------------------------------------------------
// WHAT IS SHARED AND WHAT IS NOT, AND WHY THE LINE IS THERE
// ---------------------------------------------------------------------------
//
// The University asked for one engine behind admission letters, appointment
// letters and the Vice-Chancellor's correspondence. The bottom half of that is
// right and overdue:
//
//     Generate → Sign → Issue → Immutable archive → Verify → Deliver
//
// Every one of those is the same act whatever the document is, and it was
// written three times. The page geometry was measured once and retyped; the
// seal panel exists in two files; "an issued document is superseded, never
// edited" is a trigger in 041 and the same trigger again in 045. Three
// implementations of one rule is three chances to get it wrong and one register
// that cannot answer "what did we send".
//
// THE TOP HALF IS NOT SHARED, AND THAT IS DELIBERATE. An admission is decided
// by the Head of Academic Affairs, an appointment by the Vice-Chancellor with
// HR preparing, and a letter to a ministry by the Vice-Chancellor alone. Those
// are three authorities with three different second-pair-of-eyes rules and
// three different privacy rules — a student's admission file is not readable by
// HR, and a salary is not readable by Admissions. A single workflow over all
// three would need a permission model that is the UNION of what each office
// may see, and a union leaks. The engine is the press, not the editor.
//
// ---------------------------------------------------------------------------
// SO THIS FILE IS THE PRESS
// ---------------------------------------------------------------------------
//
// It holds the page, the letterhead, the signature block, the seal panel and
// the stylesheet — measured once, in one place. It holds no rule about who may
// press the button.
// ---------------------------------------------------------------------------

import { UNIVERSITY } from './constants';
import { verificationQrSvg, type DocumentSeal } from './documentSecurity';

// ---------------------------------------------------------------------------
// 1. THE PAGE, AS ONE SET OF NUMBERS
// ---------------------------------------------------------------------------
//
// The CSS is written from these and the page-count tests measure against them.
// They were two sets for about ten minutes: a margin changed in one place and
// the test went on dividing by the old printable height, so a letter that had
// just gained 46px of room was reported as fitting more tightly than before. A
// measurement against a stale constant is worse than no measurement, because it
// is believed.

export const PAGE = {
  /** A4 at 96dpi, in CSS pixels. */
  width: 794,
  height: 1123,
  /** The @page margin, in millimetres, exactly as the stylesheet uses it. */
  marginTopMm: 12,
  marginSideMm: 16,
} as const;

const PX_PER_MM = 96 / 25.4;

/** The text block a document actually has, derived rather than restated. */
export const PRINTABLE = {
  width: Math.round(PAGE.width - (2 * PAGE.marginSideMm * PX_PER_MM)),
  height: Math.round(PAGE.height - (2 * PAGE.marginTopMm * PX_PER_MM)),
} as const;

// ---------------------------------------------------------------------------
// 2. THE SMALL THINGS THAT WERE WRITTEN TWICE
// ---------------------------------------------------------------------------

export const escape = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * A date as a document prints it: 12 September 2026.
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

// ---------------------------------------------------------------------------
// 3. THE STYLESHEET
// ---------------------------------------------------------------------------
//
// MEASURED, NOT CHOSEN. With the first set of numbers an appointment letter
// carrying a realistic block of terms came to 1293px against a 987px printable
// page, and the signature landed 40px onto page two — so the appointee turned
// over and found a name, a line and a QR code. The spacing below is what brings
// a full letter onto one page, and the page tests render it in Chromium and
// refuse a signature that does not share its page with the letter.
//
// ONE COPY. It was two, and the second one drifted the moment anybody touched
// the first.

export function documentStyles(): string {
  return `
  @page { size: A4; margin: ${PAGE.marginTopMm}mm ${PAGE.marginSideMm}mm; }
  body { font: 10.5pt/1.34 Georgia, 'Times New Roman', serif; color: #1c1720; margin: 0; }
  p { margin: 6px 0; }
  /* A PAGE BREAK NEVER STRANDS ONE LINE. Without these a long body can leave a
     single line at the foot of page one or the head of page two, which reads as
     a printing fault on a document somebody is about to sign. */
  p, .terms, .letterbody { orphans: 3; widows: 3; }
  .head { display: flex; gap: 14px; align-items: center;
          border-bottom: 2px solid #422e59; padding-bottom: 10px; }
  .head h1 { font-size: 15pt; margin: 0; letter-spacing: .04em; color: #422e59; }
  .head p { margin: 2px 0 0; font-size: 8.5pt; color: #5c5366; }
  /* NO text-transform. It was uppercase, and the page-count test read the
     rendered text and found "OFFICE OF THE VICE-CHANCELLOR" where the
     University had asked for "Office of the Vice-Chancellor". A transform is
     invisible in the source and decisive on the page — which is the whole
     argument for measuring rather than reading. */
  .office { font-size: 9.5pt; letter-spacing: .06em; color: #422e59; margin: 6px 0 0; }
  h2 { font-size: 12pt; letter-spacing: .16em; text-align: center;
       margin: 12px 0 3px; text-transform: uppercase; }
  .meta { display: flex; justify-content: space-between; font-size: 9.5pt;
          color: #4a4155; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; margin: 9px 0; }
  th, td { text-align: left; padding: 3px 8px; border-bottom: 1px solid #e6e0ee;
           font-size: 9.5pt; vertical-align: top; }
  th { width: 38%; font-weight: normal; color: #5c5366; }
  .terms, .letterbody { white-space: pre-wrap; font-size: 9.5pt; margin: 8px 0; }
  .auth { font-size: 9.5pt; color: #4a4155; font-style: italic; }
  /* KEPT TOGETHER. Even at this spacing a long body can push the signature
     over, and a signature separated from the letter it signs is the failure
     this whole block exists to prevent. */
  .sign { margin-top: 12px; break-inside: avoid; page-break-inside: avoid; }
  .byauthority { letter-spacing: .1em; font-size: 9pt; font-weight: bold; margin-bottom: 10px; }
  .sign .line { border-top: 1px solid #1c1720; width: 62mm; margin-top: 16px; }
  .seal { margin-top: 8px; border-top: 1px solid #e6e0ee; padding-top: 6px;
          display: flex; gap: 12px; align-items: center; font-size: 8pt; color: #5c5366;
          break-inside: avoid; page-break-inside: avoid; }
  .none { color: #8a8194; font-style: italic; }
`;
}

// ---------------------------------------------------------------------------
// 4. THE LETTERHEAD
// ---------------------------------------------------------------------------

/**
 * The University's letterhead, optionally naming the office the document comes
 * from.
 *
 * THE OFFICE LINE IS WHY THIS TAKES AN ARGUMENT. A letter from the
 * Vice-Chancellor to a ministry says so at the top — the recipient is deciding
 * how seriously to take it partly on that basis. An appointment letter does
 * not, because the office that issued it is stated in the signature block and
 * the authority line, and saying it three times is letterhead, not information.
 */
export function letterhead(office?: string | null): string {
  return `<div class="head">
  <div>
    <h1>${escape(UNIVERSITY.name)}</h1>
    <p>${escape(UNIVERSITY.address)}</p>
    <p>${escape(UNIVERSITY.phone)} · ${escape(UNIVERSITY.email)} · ${escape(UNIVERSITY.website)}</p>
    ${office ? `<p class="office">${escape(office)}</p>` : ''}
  </div>
</div>`;
}

// ---------------------------------------------------------------------------
// 5. THE SIGNATURE BLOCK
// ---------------------------------------------------------------------------

export interface Signature {
  name: string;
  role: string;
  /**
   * The office whose authority the document is issued under, where that is
   * somebody other than the signatory.
   *
   * OMITTED WHEN THE SIGNATORY IS THE AUTHORITY. An appointment letter signed
   * by the Registrar carries "BY AUTHORITY OF THE VICE-CHANCELLOR", because a
   * reader in five years needs to know it was made by the office that may make
   * it and a signature alone does not say so. A letter the Vice-Chancellor
   * signs themselves does not, because "by authority of myself" is not a
   * statement of authority — it is a formula that makes the real ones look like
   * formulae too.
   */
  byAuthorityOf?: string | null;
  /** The closing above the rule. */
  closing?: string;
}

export function signatureBlock(s: Signature): string {
  return `<div class="sign">
  ${s.byAuthorityOf
    ? `<p class="byauthority">BY AUTHORITY OF ${escape(s.byAuthorityOf.toUpperCase())}</p>`
    : ''}
  <p>${escape(s.closing ?? 'Yours sincerely,')}</p>
  <div class="line"></div>
  <p><strong>${escape(s.name)}</strong><br>${escape(s.role)}<br>
  ${escape(UNIVERSITY.name)}</p>
</div>`;
}

// ---------------------------------------------------------------------------
// 6. THE SEAL PANEL
// ---------------------------------------------------------------------------

/**
 * The verification panel at the foot of every sealed document the University
 * issues.
 *
 * A DOCUMENT WITH NO SEAL SAYS SO. It must not look like one that has a seal: a
 * reader told to scan a code that is not there learns to distrust the ones that
 * are. `CREDENTIAL_SECRET` can be absent in a deployment nobody has finished
 * configuring, and a letter held up by a missing environment variable is worse
 * than one that goes out saying plainly what it carries.
 */
export async function sealPanel(
  seal: DocumentSeal | null, printedReference: string, version: number,
): Promise<string> {
  let qr = '';
  if (seal) {
    try { qr = await verificationQrSvg(seal.verifyUrl, 88); } catch { qr = ''; }
  }
  return `<div class="seal">
  ${qr}
  <div>
    ${seal
      ? `<p><strong>Verification code:</strong> ${escape(seal.code)}</p>
         <p>Check this document at ${escape(UNIVERSITY.website)}/verify</p>`
      : `<p class="none">This copy carries no verification seal. The University's signing
         secret was not configured when it was generated.</p>`}
    <p>${escape(printedReference)} · version ${version}</p>
  </div>
</div>`;
}

// ---------------------------------------------------------------------------
// 7. THE FAMILIES, AND WHAT EACH ONE IS FILED IN
// ---------------------------------------------------------------------------
//
// THE ENGINE HAS TO KNOW WHICH REGISTER, and nothing else about the office. The
// three are kept as data rather than as three code paths so that "issue,
// archive, seal, verify, deliver" is written once and reads the row below
// rather than branching on the document's kind.

export interface DocumentFamily {
  /** What the University calls it. */
  label: string;
  /** The archive it is filed in. */
  table: 'admission_letters' | 'appointment_letters' | 'correspondence_letters';
  /** The column joining it back to the act that produced it. */
  parent: string;
  /** The seal scheme, which is versioned so an old code still verifies. */
  scheme: string;
}

export const DOCUMENT_FAMILIES: Record<string, DocumentFamily> = {
  appointment: {
    label: 'Appointment Letter',
    table: 'appointment_letters',
    parent: 'appointment_id',
    scheme: 'ICOFGU-APPOINTMENT-V1',
  },
  correspondence: {
    label: 'Official Correspondence',
    table: 'correspondence_letters',
    parent: 'correspondence_id',
    scheme: 'ICOFGU-CORRESPONDENCE-V1',
  },
};

// ---------------------------------------------------------------------------
// 8. WHAT ISSUING MEANS, IN ONE PLACE
// ---------------------------------------------------------------------------

/**
 * Whether a document already in the archive may be replaced by this one.
 *
 * NEVER OVERWRITTEN, ONLY SUPERSEDED. Somebody is holding the version that went
 * out. A register that says one thing and their copy another is worse than no
 * register — which is why 041 and 045 both refuse the edit in the database, and
 * why this function exists rather than each caller deciding.
 */
export function supersedes(current: { version?: number | null } | null): number {
  return (current?.version ?? 0) + 1;
}

/** SHA-256 over the document as sent, so "this is what we issued" is provable. */
export async function contentHash(html: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(html, 'utf8').digest('hex');
}
