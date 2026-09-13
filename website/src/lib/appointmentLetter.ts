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
  EMPLOYMENT_LABELS, ACTION_LABELS, remunerationLine, probationEnds, printedReference,
  missingFrom, blocked, allowanceLine,
  type Appointment, type EmploymentType, type AppointmentAction, type Allowance,
} from './appointments';
// THE WORDING THAT CHANGES WITH THE OFFICE. A Dean's letter, a Lecturer's and
// the Director of Academic Affairs' are the same document with different things
// to say, and what differs is a register rather than a branch.
import { registerFor, conductFor } from './appointmentRegisters';

/**
 * The job-description sections whose clauses are printed in the letter.
 *
 * DUTIES, AND NOT AUTHORITY. `may-authorize`, `may-recommend` and
 * `must-obtain-approval` are deliberately absent: they are what the post may
 * commit the University to, they live in the job description, and a letter that
 * restated them would give the University two documents that can disagree about
 * what somebody was entitled to decide.
 */
const DUTY_SECTIONS = [
  'key-responsibilities', 'institutional', 'academic', 'administrative',
  'financial', 'people-management', 'student', 'research', 'ict', 'compliance',
];

/**
 * A name that starts a sentence in the record, used inside one here.
 *
 * "You shall report directly to The Vice-Chancellor" is what the letter said
 * before this existed, because the record holds "The Vice-Chancellor" — a
 * correct value for a table cell and wrong in the middle of a sentence. Only
 * the leading article is touched; a name that begins with a real capital keeps
 * it, so "Reports to Prof Meyembi" is not mangled into "prof Meyembi".
 */
const midSentence = (s: string) => s.replace(/^The\s/, 'the ');

/**
 * The four documents of an appointment, and where each is produced.
 *
 * WRITTEN DOWN BECAUSE A LETTER THAT NAMES AN ATTACHMENT IS A PROMISE. The
 * letter listed a job description as Attachment 1 for months while nothing in
 * this system could produce one — the data existed, the screen existed, the
 * document did not. `jobDescriptionDocument.ts` is that document now.
 */
export const PACKAGE_DOCUMENTS = [
  { what: 'The appointment letter', producedBy: 'appointmentLetter.ts' },
  { what: 'The job description and terms of reference', producedBy: 'jobDescriptionDocument.ts' },
  { what: 'The conditions of service', producedBy: 'a document template (051), cited by version' },
  { what: 'The acceptance of appointment', producedBy: '/accept, recorded by 050' },
] as const;

/**
 * What the numbered letter needs on top of the shared press.
 *
 * SMALL ON PURPOSE. Everything structural — the page, the rule under the
 * letterhead, the table, the signature block — is `documentStyles()`, so a
 * change to the University's documents reaches this letter without being
 * reapplied here. These are the four things a numbered multi-page letter needs
 * and the other documents do not.
 */
const LETTER_STYLES = `
  h3 { font: bold 10.5pt/1.3 Georgia, 'Times New Roman', serif; color: #3b2a52;
       margin: 16px 0 6px; text-transform: none; letter-spacing: 0;
       break-after: avoid; page-break-after: avoid; }
  .subject { font-weight: bold; margin-top: 14px; }
  .addr { white-space: pre-line; margin-top: 0; }
  ul { margin: 4px 0 8px; padding-left: 20px; }
  li { margin-bottom: 3px; }
  .attachments { margin-top: 14px; font-size: 9pt; color: #6b6076;
                 break-inside: avoid; page-break-inside: avoid; }
  /* UNMISTAKABLE ON PAPER AS WELL AS ON SCREEN. A preview that prints as an
     ordinary letter is a preview somebody will hand to an appointee. */
  .draftmark { border: 2px solid #a07c12; background: #fdf6e3; color: #6b5410;
               padding: 8px 11px; margin: 10px 0 4px; font-size: 9.5pt;
               line-height: 1.45; break-inside: avoid; page-break-inside: avoid; }
`;

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
  /**
   * The allowances this appointment carries — housing, transport, and the rest.
   *
   * NONE ASSUMED. An appointment with no allowances passes an empty list and the
   * letter says nothing about them, because a nil housing allowance is a
   * statement the University has not made. 047 keeps each one as its own row
   * with its own currency and period precisely so they are not silently added
   * to the salary and printed as one figure.
   */
  allowances?: Allowance[];
  /**
   * The job description this appointment is made against.
   *
   * REFERENCED, NOT REPRINTED. The University asked the letter to carry a
   * "reference to attached Job Description" — the JD is its own institutional
   * record with its own version and its own approval, and inlining it would
   * make the letter say something the JD could later contradict.
   */
  jobDescription?: {
    code?: string | null;
    title?: string | null;
    version?: number | null;
    /**
     * The job description's own duty clauses, printed under "Principal Areas
     * of Responsibility".
     *
     * DUTIES ONLY, AND THE OMISSION IS THE POINT. `may-authorize`,
     * `may-recommend` and `must-obtain-approval` are NOT printed here, however
     * available they are. They are the three sections that say what the holder
     * may commit the University to, and reprinting them in a letter would mean
     * the University had stated a grant of authority in two documents that can
     * later disagree. The letter names the job description; the job
     * description says what the office may do.
     */
    clauses?: { section: string; ordinal: number; body: string }[] | null;
  } | null;
  /** Where the conditions of service are set out. */
  termsReference?: string | null;

  // -------------------------------------------------------------------------
  // WHAT KIND OF LETTER THIS IS
  // -------------------------------------------------------------------------

  /**
   * The family of the post, which selects the register of wording.
   *
   * ABSENT MEANS THE PLAINEST LETTER, not the grandest. See
   * `appointmentRegisters.registerFor`.
   */
  family?: string | null;

  /**
   * Where the office stands, printed only when the University has said so.
   *
   * NEVER DERIVED. There is no rule in this system that computes precedence
   * from a reporting line — "reports to the Vice-Chancellor" is true of
   * several offices and makes none of them the second-ranking officer. It is
   * printed when, and only when, a value reaches this field from the record.
   */
  precedence?: string | null;

  /** The band the office sits in, where the University has recorded one. */
  executiveLevel?: string | null;

  /**
   * The same standing, as a sentence rather than as a rank.
   *
   * SEPARATE FROM `precedence` ON PURPOSE. "Second-ranking officer after the
   * Vice-Chancellor" belongs in a table cell; a paragraph needs "a senior
   * executive office of the University, ranking immediately below the
   * Vice-Chancellor". Lowercasing the first to make the second produced a
   * sentence with no article in it.
   */
  standing?: string | null;

  /**
   * A preview of a letter that has not been approved, and must look like one.
   *
   * ---------------------------------------------------------------------------
   * WHY A DRAFT MUST NOT LOOK LIKE A LETTER
   * ---------------------------------------------------------------------------
   *
   * The Vice-Chancellor asked to see the letter before approving it, which is
   * plainly right — nobody should approve a document they have not read. But
   * the document produced from an unapproved record is not the letter: nothing
   * has been authorised, no reference has been allocated, and if it escapes the
   * screen it is an appointment the University never made, on University
   * letterhead.
   *
   * So a preview says so across the top, carries no seal and no verification
   * code, and prints a reference of zeros. The same rule the job description
   * document follows, for the same reason: a draft that looks like the document
   * in force is how somebody is held to terms nobody approved.
   */
  isDraft?: boolean;

  /** Notice periods, printed in the termination section when recorded. */
  noticeMonths?: number | null;
  probationNoticeMonths?: number | null;

  /**
   * Benefits that are neither the salary nor a numbered allowance.
   *
   * OMITTED WHEN ABSENT, never printed as "None". The University's own draft
   * has "[DETAILS / NONE]" here; "None" is a statement about the terms, and
   * the University should make it deliberately rather than have a template
   * make it by default.
   */
  otherBenefits?: string | null;
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
    // A PREVIEW IS NEVER SEALED. The seal is the University's assertion that it
    // issued this document; an unapproved draft carrying one would verify as
    // genuine against a decision nobody took.
    if (input.isDraft) throw new Error('a draft carries no seal');
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

  // THE REGISTER FOR THIS KIND OF OFFICE. Everything below that varies by post
  // comes from here; nothing below invents wording of its own.
  const reg = registerFor(input.family);
  const title = a.position_title ?? '';
  const reportsTo = midSentence(a.reports_to_name ?? 'the officer named above');

  // EVERY ROW COMES OUT OF THE RECORD. A row whose value is absent is omitted
  // rather than printed empty — a blank beside "Probation" reads as "none",
  // which is a claim the University has not made.
  const rows: [string, string | null][] = [
    ['Appointee', a.full_name ?? null],
    ['Position', title || null],
    // THE TWO STANDING ROWS, PRINTED ONLY WHEN RECORDED. Neither is derived.
    ['Executive level', input.executiveLevel ?? null],
    ['Institutional rank', input.precedence ?? null],
    ['Office', a.unit_name ?? null],
    ['Faculty or school', a.faculty ?? null],
    ['Employment type',
      EMPLOYMENT_LABELS[a.employment_type as EmploymentType] ?? a.employment_type ?? null],
    ['Date of commencement', longDate(a.start_date) || null],
    ['Effective date', a.effective_date ? longDate(a.effective_date) : null],
    ['Expiry of appointment', a.end_date ? longDate(a.end_date) : null],
    ['Working hours', a.working_hours ?? null],
    ['Probation', a.probation_months
      ? `${a.probation_months} months, to ${longDate(probation)}` : null],
    ['Place of duty', a.place_of_duty ?? null],
    ['Reports directly to', a.reports_to_name ?? null],
  ];

  // ---------------------------------------------------------------------
  // THE ALLOWANCES, EACH ON ITS OWN LINE AND NEVER ADDED TOGETHER.
  //
  // A monthly salary and an annual research allowance do not sum, and a letter
  // printing one combined figure would state a number the University never
  // decided. 047 keeps them apart in the database for the same reason; this is
  // the page agreeing rather than a second opinion.
  //
  // An appointment with none prints nothing at all — not "Allowances: none",
  // which is a claim about the terms rather than an absence of one.
  // ---------------------------------------------------------------------
  const payRows: [string, string | null][] = [['Basic remuneration', pay]];
  for (const al of input.allowances ?? []) {
    const line = allowanceLine(al);
    if (line) payRows.push([' ', line]);
  }

  const authority = a.appointing_authority
    ? `<p class="auth">This appointment is made on the authority of ${
      escape(midSentence(a.appointing_authority))}`
      + `${a.authority_decided_on ? `, ${escape(longDate(a.authority_decided_on))}` : ''}.</p>`
    : '';

  // ---------------------------------------------------------------------
  // THE SECTIONS, NUMBERED IN THE ORDER THEY SURVIVE.
  //
  // NUMBERED AFTER FILTERING, never before. A letter that runs 1, 2, 4, 5
  // because section 3 had nothing to print is a letter whose reader goes
  // looking for the missing one — and in a document somebody may later cite by
  // paragraph number, a gap is worse than a renumbering.
  // ---------------------------------------------------------------------
  const sections: { heading: string; html: string }[] = [];
  const add = (heading: string, html: string | null) => {
    if (html && html.trim()) sections.push({ heading, html });
  };

  const paras = (list: string[]) =>
    list.map((p) => `<p>${escape(p)}</p>`).join('\n');

  add('Appointment Details', `<table>
${rows.filter(([, v]) => v).map(([k, v]) =>
    `  <tr><th>${escape(k)}</th><td>${escape(v)}</td></tr>`).join('\n')}
</table>`);

  if (reg.status) add(reg.status.heading, paras(reg.status.paragraphs));

  // ---- The duties, from the job description and from nowhere else ---------
  const dutyClauses = (input.jobDescription?.clauses ?? [])
    .filter((c) => DUTY_SECTIONS.includes(c.section))
    .sort((x, y) =>
      DUTY_SECTIONS.indexOf(x.section) - DUTY_SECTIONS.indexOf(y.section)
      || x.ordinal - y.ordinal);

  if (dutyClauses.length > 0) {
    add(reg.responsibilitiesHeading, `<p>${escape(reg.responsibilitiesLead(title))}</p>
<ul>
${dutyClauses.map((c) => `  <li>${escape(c.body)}</li>`).join('\n')}
</ul>${input.jobDescription?.code ? `
<p>The detailed scope of authority, duties, reporting relationships and performance
expectations is set out in the Job Description and Terms of Reference for ${escape(title)},
which accompanies this letter and forms an integral part of your appointment.</p>` : ''}`);
  }

  add(reg.accountability.heading, paras(reg.accountability.paragraphs(reportsTo)));

  // ---- Remuneration -------------------------------------------------------
  // PRINTED ONLY WHEN THERE IS ONE. An honorary or unpaid appointment carries
  // no salary at all, and a section headed "Remuneration and Benefits" with
  // nothing under it reads as an omission rather than as the terms.
  if (pay) {
    add('Remuneration and Benefits', `<p>Your remuneration shall be provided in accordance with
the terms approved for this appointment.</p>
<table>
${payRows.filter(([, v]) => v).map(([k, v]) =>
      `  <tr><th>${escape(k)}</th><td>${escape(v)}</td></tr>`).join('\n')}${input.otherBenefits
  ? `\n  <tr><th>Other approved benefits</th><td>${escape(input.otherBenefits)}</td></tr>` : ''}
</table>
<p>The amounts stated above are those formally approved by the University for this
appointment.</p>`);
  }

  add('Professional Conduct', `<p>In accepting this appointment, you are expected to uphold the
values, integrity and reputation of ${escape(UNIVERSITY.name)}. You shall:</p>
<ul>
${conductFor(reg).map((c) => `  <li>${escape(c)}</li>`).join('\n')}
</ul>`);

  add('Conditions of Appointment', `<p>This appointment is subject to the University’s
applicable Conditions of Service, policies, regulations and governing instruments as amended
from time to time in accordance with the University’s established procedures.</p>
<p>The appointment is also subject, where applicable, to verification of academic
qualifications, professional credentials, references and other information supplied in
connection with the appointment.</p>
<p>Any probationary period, performance review, renewal or confirmation shall be governed by
the applicable terms of the appointment.</p>${input.termsReference
  ? `\n<p>The Conditions of Service referred to above are those set out in ${
    escape(input.termsReference)}.</p>` : ''}`);

  add('Performance and Review', `<p>Your performance shall be reviewed in accordance with the
University’s applicable performance-management arrangements.</p>
<p>The University may periodically review the responsibilities, objectives and performance
expectations of the office in accordance with institutional requirements.</p>
<p>Any substantial amendment to the terms of your appointment shall be formally
documented.</p>`);

  add('Confidentiality and Conflict of Interest', `<p>You shall maintain the confidentiality of
information obtained through your office and shall not disclose confidential University
information except where authorized or required by law or University policy.</p>
<p>You shall promptly disclose any actual, potential or perceived conflict of interest arising
in connection with your official responsibilities and shall comply with the University’s
applicable conflict-of-interest requirements.</p>`);

  // ---- Termination --------------------------------------------------------
  // THE NOTICE PERIOD IS PRINTED ONLY IF IT IS RECORDED. A letter that states
  // "three months" because three months is usual would be the University
  // stating a term of the contract it had not agreed.
  add('Termination', `<p>Your appointment may be terminated in accordance with the University’s
applicable Conditions of Service and the terms governing your appointment.</p>${
  input.noticeMonths
    ? `\n<p>Where a specific contractual notice period applies, the notice period for this
appointment is ${escape(String(input.noticeMonths))} month${
      input.noticeMonths === 1 ? '' : 's'}.${
      input.probationNoticeMonths
        ? ` During any probationary period, the notice period is ${
          escape(String(input.probationNoticeMonths))} month${
          input.probationNoticeMonths === 1 ? '' : 's'}.` : ''}</p>` : ''}
<p>The applicable Conditions of Service shall govern matters relating to resignation,
termination, disciplinary action and other cessation of appointment.</p>`);

  if (input.jobDescription?.code) {
    // REFERENCED BY CODE AND VERSION. "See the attached job description" is
    // useless in five years; "ACA-DAA, version 1" names the document the
    // University can still produce.
    add('Job Description and Terms of Reference',
      `<p>Your appointment is accompanied by a Job Description and Terms of Reference for
${escape(input.jobDescription.title ?? input.jobDescription.code)} (${
  escape(input.jobDescription.code)}${
  input.jobDescription.version ? `, version ${input.jobDescription.version}` : ''}).</p>
<p>That document sets out the detailed:</p>
<ul>
  <li>purpose of the position;</li>
  <li>duties and responsibilities;</li>
${reg.carriesDelegatedAuthority ? '  <li>delegated authority;</li>\n' : ''}\
  <li>reporting relationships;</li>
  <li>qualifications and experience;</li>
  <li>competencies;</li>
  <li>performance expectations; and</li>
  <li>accountability requirements.</li>
</ul>
<p>The Job Description and Terms of Reference forms part of the official appointment
record.</p>`);
  }

  // ---------------------------------------------------------------------
  // THE ATTACHMENTS, LISTED ONLY IF THEY EXIST.
  //
  // A letter that lists three attachments and travels with one is a letter
  // whose recipient believes two documents were withheld. Each line here is
  // conditional on the thing it names actually being part of this appointment.
  // ---------------------------------------------------------------------
  const attachments = [
    input.jobDescription?.code
      ? `Job description and terms of reference — ${
        input.jobDescription.title ?? input.jobDescription.code} (${input.jobDescription.code}${
        input.jobDescription.version ? `, version ${input.jobDescription.version}` : ''})`
      : null,
    input.termsReference ? `Conditions of service — ${input.termsReference}` : null,
    // ALWAYS PRESENT, because the letter above tells the appointee to use it.
    `Acceptance of appointment — ${UNIVERSITY.website}/accept`,
  ].filter((t): t is string => Boolean(t));

  return {
    reference: input.reference,
    printed: printedReference(input.reference),
    seal,
    html: `<!doctype html>
<meta charset="utf-8">
<title>Appointment Letter ${escape(printedReference(input.reference))}</title>
<style>${documentStyles()}${LETTER_STYLES}</style>

${letterhead('Office of the Vice-Chancellor')}
${input.isDraft ? `
<div class="draftmark">
  <strong>Draft — not approved and not issued.</strong>
  This is how the letter will read. It carries no reference and no seal, nobody has authorised
  it, and it is not a letter of appointment. Approve the appointment and issue it, and the
  document produced then is the one that counts.
</div>` : ''}

<h2>Appointment Letter</h2>

<div class="meta">
  <span>Date: ${escape(longDate(input.issuedOn))}</span>
  <span>Ref: ${escape(printedReference(input.reference))}${
    input.version > 1 ? ` (version ${input.version})` : ''}</span>
</div>

<p>${escape(a.full_name)}</p>
${a.postal_address ? `<p class="addr">${escape(a.postal_address)}</p>` : ''}

<p class="subject">Re: ${escape(reg.subject(title))}</p>

<p>Dear ${escape(a.full_name)},</p>

<p>${escape(reg.opening(title, UNIVERSITY.name))}${
  a.effective_date ? ` This appointment takes effect from ${escape(longDate(a.effective_date))}.` : ''}</p>

<p>This appointment is made under the authority of the Vice-Chancellor and in accordance with
the governing instruments, policies, regulations and applicable conditions of service of
${escape(UNIVERSITY.name)}.</p>
${input.standing ? `
<p>${escape(`The office of ${title} is ${input.standing}. You shall serve as the principal `
  + `officer responsible for the functions of that office, under the authority and direction of `
  + `${reportsTo}.`)}</p>` : ''}

${sections.map((s, i) => `<h3>${i + 1}. ${escape(s.heading)}</h3>\n${s.html}`).join('\n\n')}

${a.terms ? `<h3>${sections.length + 1}. Further Terms</h3>\n<p class="terms">${escape(a.terms)}</p>` : ''}

${authority}

<h3>${sections.length + (a.terms ? 2 : 1)}. Acceptance of Appointment</h3>
<p>Please confirm your acceptance of this appointment. Your acceptance should clearly identify
the appointment reference:</p>
<p class="subject">${escape(printedReference(input.reference))}</p>
<p>You may complete the acceptance electronically at ${escape(UNIVERSITY.website)}/accept using
that reference and the verification code printed below, or in writing to the University. The
completed acceptance is retained as part of your official University personnel and appointment
record.</p>

<div class="closing">
<h3>${sections.length + (a.terms ? 3 : 2)}. Final Statement</h3>
${paras(reg.closing(title, UNIVERSITY.name))}
<p>Please accept our congratulations on your appointment and our best wishes as you assume the
responsibilities of the office.</p>

${signatureBlock({
  // THE AUTHORITY IS STATED ON THE PAGE, not inferred from whose name is at the
  // foot. A reader of this letter in five years needs to know it was made by the
  // office that may make it, and a signature alone does not say so.
  //
  // EXCEPT WHEN THE AUTHORITY IS THE SIGNATORY. This was hard-coded, and the
  // Vice-Chancellor's own appointment letters came out reading "BY AUTHORITY OF
  // THE VICE-CHANCELLOR" above the Vice-Chancellor's signature — "by authority
  // of myself", which is not a statement of authority and makes the real ones
  // read as a formula. signatureBlock's own doc comment had said so since it
  // was written; nothing was passing it anything but the constant.
  byAuthorityOf: /vice[-\s]?chancellor/i.test(input.signatoryRole)
    ? null : 'the Vice-Chancellor',
  name: input.signatoryName,
  role: input.signatoryRole,
  image: input.signatureImage,
  authorizedOn: input.authorizedOn,
})}

${await sealPanel(seal, printedReference(input.reference), input.version, input.siteUrl)}

${attachments.length > 0 ? `<div class="attachments">
  <p><strong>Attachments</strong></p>
  <ol>
${attachments.map((t) => `    <li>${escape(t)}</li>`).join('\n')}
  </ol>
</div>` : ''}
</div>
${runningFooter(printedReference(input.reference), DOCUMENT_FAMILIES.appointment.label)}
`,
  };
}
