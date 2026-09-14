// ---------------------------------------------------------------------------
// THE JOB DESCRIPTION, AS A DOCUMENT.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
//
// The appointment letter says, of every appointment it is issued for:
//
//   "This appointment is accompanied by the job description and terms of
//    reference for Director of Academic Affairs (ACA-DAA, version 1). …It
//    forms part of the official appointment record."
//
// and lists it as Attachment 1. Nothing in this system could produce it.
//
// The job description existed as DATA — 048 gives it a table, a version, an
// approval, an inheritance rule and twenty-four sections — and as a SCREEN,
// where it can be written and put in force. It had never been a document. So
// the letter named an attachment that did not exist, the appointee was told to
// read a paper nobody could print, and the sentence "forms part of the official
// appointment record" was a claim about a record with a hole in it.
//
// ---------------------------------------------------------------------------
// THE SAME PRESS, DELIBERATELY
// ---------------------------------------------------------------------------
//
// Letterhead, page geometry, typography and the seal panel come from
// `officialDocument.ts`. A job description that looked like a different
// university's document to the letter it travels with would invite exactly the
// question the seal exists to answer.
//
// IT CARRIES ITS OWN SEAL AND ITS OWN REFERENCE. Separated from the letter in
// an HR file — which is what happens to attachments — it must still be
// identifiable as the University's, and checkable. The seal is computed over
// the post, the version and the date it was put in force, so a job description
// rewritten after somebody was appointed under it does not verify against the
// copy in their file. That is the whole point of versioning it.
//
// ---------------------------------------------------------------------------
// AND IT PRINTS THE THREE SECTIONS THE LETTER'S OWN PROSE WILL NOT
// ---------------------------------------------------------------------------
//
// `may-authorize`, `may-recommend` and `must-obtain-approval` are grants of
// authority, and the University should state them in one document rather than
// two that can drift. THIS is that document. They are printed here, under their
// own headings, because a job description that leaves them out is a list of
// tasks.
//
// THE LETTER NOW ANNEXES THIS DOCUMENT rather than referring to one, because it
// had been naming an attachment it did not carry — the University: "the letter
// does not have the other pages like job description." That is not a second
// statement of the grant: the annex is built by `jobDescriptionSections` below,
// the same function this document uses, from the same resolved rows. What the
// letter still must never do is restate them in ITS OWN WORDS, and
// `appointmentLetter.ts` filters them out of "Principal Areas of
// Responsibility" for that reason.
// ---------------------------------------------------------------------------

import { UNIVERSITY } from './constants';
import { sealDocument, type DocumentSeal } from './documentSecurity';
import {
  escape, longDate, documentStyles, letterhead, signatureBlock, sealPanel, runningFooter,
} from './officialDocument';
import { SECTION_LABELS, order, type JdSection } from './positions';

export interface JdClause {
  section: string;
  ordinal: number;
  body: string;
  /** 'family' when inherited, 'position' when this post restated it. */
  source?: string | null;
}

export interface JobDescriptionInput {
  /** The post: 'ACA-DAA'. */
  code: string;
  /** What the post is called. */
  title: string;
  /** The family it belongs to, printed so a reader knows what it inherits. */
  family?: string | null;
  /** The unit the post sits in. */
  unit?: string | null;
  /** Who the post reports to. */
  reportsTo?: string | null;
  /** Why the post exists. The first question at any review. */
  jobPurpose?: string | null;
  version: number;
  status: string;
  /** When it was put in force. Absent on a draft, and the document says so. */
  activatedOn?: string | null;
  clauses: JdClause[];
  /** Who approved it, for the signature block. */
  approvedByName?: string | null;
  approvedByRole?: string | null;
  siteUrl: string;
  issuedOn: string;
}

export interface GeneratedJobDescription {
  html: string;
  seal: DocumentSeal | null;
  reference: string;
}

/** IGUC/JD/ACA-DAA/1 — the post and the version, which is what identifies it. */
export function jdReference(code: string, version: number): string {
  return `IGUC/JD/${code}/${version}`;
}

export const JD_SEAL_SCHEME = 'ICOFGU-JOBDESCRIPTION-V1';

/**
 * Seal a job description over the four facts that identify it.
 *
 * THE VERSION IS SEALED, and that is the field that matters. A job description
 * is the document produced when somebody's dismissal is challenged, and the
 * question in that room is which version was in force on the day. A seal that
 * did not cover the version would verify a rewritten document against an old
 * appointment.
 */
export function sealJobDescription(
  input: JobDescriptionInput, reference: string,
): DocumentSeal {
  return sealDocument(JD_SEAL_SCHEME, 'Job Description', {
    post: input.code,
    title: input.title,
    version: String(input.version),
    reference,
    activated: input.activatedOn ?? '',
  }, input.siteUrl);
}

const STYLES = `
  h3 { font: bold 10.5pt/1.3 Georgia, 'Times New Roman', serif; color: #3b2a52;
       margin: 14px 0 5px; text-transform: none; letter-spacing: 0;
       break-after: avoid; page-break-after: avoid; }
  ol.clauses { margin: 3px 0 8px; padding-left: 22px; }
  ol.clauses li { margin-bottom: 3px; }
  .inherited { color: #8a8194; font-size: 8pt; font-style: italic; }
  .draft { border: 1px solid #a07c12; background: #fdf6e3; color: #6b5410;
           padding: 7px 10px; margin: 10px 0; font-size: 9pt;
           break-inside: avoid; page-break-inside: avoid; }
  .purpose { margin: 8px 0 4px; }
`;

/**
 * The clauses of a job description, grouped under their section headings.
 *
 * ONE RENDERER, TWO DOCUMENTS. This is used by the standalone job description
 * below AND by the annex the appointment letter carries. It has to be, because
 * the reason the letter never carried the job description was a fear of exactly
 * that: "two documents that can disagree about what somebody was entitled to
 * decide". Two documents rendering the SAME clauses through the SAME function
 * cannot disagree — what each shows is settled by the rows it was given, and
 * both are given the resolved rows of `position_job_description`.
 *
 * IN THE DOCUMENT'S OWN ORDER. `order()` is the same function the screen uses,
 * so the printed document and the screen cannot disagree about what comes first
 * either.
 */
export function jobDescriptionSections(clauses: JdClause[]): string {
  const grouped = new Map<string, JdClause[]>();
  for (const c of order(clauses as never) as unknown as JdClause[]) {
    const list = grouped.get(c.section) ?? [];
    list.push(c);
    grouped.set(c.section, list);
  }

  const sectionsInOrder: [string, JdClause[]][] = [];
  grouped.forEach((list, section) => sectionsInOrder.push([section, list]));

  return sectionsInOrder.map(([section, list]) => {
    const label = SECTION_LABELS[section as JdSection] ?? section;
    return `<h3>${escape(label)}</h3>
<ol class="clauses">
${list.map((c: JdClause) => `  <li>${escape(c.body)}${
      // SAID ON THE PAGE. A clause inherited from the family applies to every
      // post in it, and changing it changes all of them — which whoever is
      // reading this document to decide whether to argue with a clause needs
      // to know before they start.
      c.source === 'family' ? ' <span class="inherited">(from the family profile)</span>' : ''
    }</li>`).join('\n')}
</ol>`;
  }).join('\n\n');
}

/**
 * The styling the clause list needs, so a document that borrows
 * `jobDescriptionSections` can borrow the CSS with it instead of retyping it
 * and drifting.
 */
export const JD_CLAUSE_STYLES = STYLES;

/**
 * The document.
 *
 * A DRAFT SAYS IT IS A DRAFT, IN A BOX, AT THE TOP. 048 will not let an
 * appointment be made against one, but a draft printed for comment will be
 * carried around an office and read by people who did not print it — and a
 * draft that looks like the document in force is how somebody is managed
 * against a rule nobody approved.
 */
export async function jobDescriptionHtml(
  input: JobDescriptionInput,
): Promise<GeneratedJobDescription> {
  const reference = jdReference(input.code, input.version);

  let seal: DocumentSeal | null = null;
  try {
    seal = sealJobDescription(input, reference);
  } catch {
    // UNSEALED RATHER THAN UNPRINTABLE, as everywhere else: the seal panel says
    // plainly that it carries none.
    seal = null;
  }

  const inForce = input.status === 'active';

  const body = jobDescriptionSections(input.clauses);

  const rows: [string, string | null][] = [
    ['Post', input.title],
    ['Post code', input.code],
    ['Family', input.family ?? null],
    ['Unit', input.unit ?? null],
    ['Reports to', input.reportsTo ?? null],
    ['Version', String(input.version)],
    ['Status', inForce ? 'In force' : input.status],
    ['In force from', input.activatedOn ? longDate(input.activatedOn) : null],
  ];

  return {
    reference,
    seal,
    html: `<!doctype html>
<meta charset="utf-8">
<title>Job Description ${escape(reference)}</title>
<style>${documentStyles()}${STYLES}</style>

${letterhead('Office of the Vice-Chancellor')}

<h2>Job Description and Terms of Reference</h2>

<div class="meta">
  <span>Date: ${escape(longDate(input.issuedOn))}</span>
  <span>Ref: ${escape(reference)}</span>
</div>

${inForce ? '' : `<div class="draft"><strong>This is a draft.</strong> It is not in force, no
appointment may be made against it, and it may still change. Do not treat it as the terms of
any post.</div>`}

<table>
${rows.filter(([, v]) => v).map(([k, v]) =>
      `  <tr><th>${escape(k)}</th><td>${escape(v)}</td></tr>`).join('\n')}
</table>

${input.jobPurpose ? `<h3>Purpose of the Post</h3>
<p class="purpose">${escape(input.jobPurpose)}</p>` : ''}

${body}

<div class="closing">
<p>This job description forms part of the official appointment record for the post named above.
It may be amended by the University after consultation with the post-holder; an amended version
is issued as a new version, and the version in force at the date of an appointment remains on
the record.</p>

${input.approvedByName ? signatureBlock({
      // NOT "YOURS SINCERELY". This is not a letter to anybody — it is a
      // schedule of duties, approved for the University, and it is signed to
      // say who approved it rather than to close a correspondence.
      closing: 'Approved for the University:',
      name: input.approvedByName,
      role: input.approvedByRole ?? '',
      authorizedOn: input.activatedOn,
    }) : ''}

${await sealPanel(seal, reference, input.version)}
</div>
${runningFooter(reference, 'Job Description')}
`,
  };
}
