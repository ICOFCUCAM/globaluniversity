// ---------------------------------------------------------------------------
// THE OFFICIAL LETTER, ON THE OFFICE'S LETTERHEAD.
//
// ---------------------------------------------------------------------------
// WHAT IS DIFFERENT ABOUT THIS ONE
// ---------------------------------------------------------------------------
//
// An appointment letter is generated ENTIRELY from a record: not one word of it
// is typed at the moment of generating, because a name typed into a letter is a
// name that can differ from the name in the register.
//
// Correspondence is the opposite. The body IS what the Vice-Chancellor wrote,
// and the engine's job is to put it on the University's letterhead, under the
// right office, over the right signature, with a seal a stranger can check.
// Nothing here validates the prose, and nothing should: the authority's words
// are the authority's words.
//
// WHAT IS STILL CHECKED is everything around the words — that it is addressed to
// somebody, that it says what kind of letter it is, that it is long enough to be
// a letter. `objectionsTo` in correspondence.ts says all of it at once, on the
// screen, before anybody authorises anything.
//
// ---------------------------------------------------------------------------
// AND THE SIGNATURE BLOCK SAYS WHO ISSUED IT
// ---------------------------------------------------------------------------
//
// The University's ruling: a letter prepared by an administrator is still a
// VC-issued document if the VC is the authorising issuer. So the signature is
// the AUTHORITY's, never the preparer's — the preparer appears in the history
// and in the register, and nowhere on the page. A reader holding the letter is
// being told who stands behind it.
//
// There is no "BY AUTHORITY OF" line on a letter the authority signs
// themselves. "By authority of myself" is not a statement of authority; it is a
// formula, and printing it here would make the real ones on appointment letters
// look like formulae too.
// ---------------------------------------------------------------------------

import { UNIVERSITY } from './constants';
import { sealDocument, type DocumentSeal } from './documentSecurity';
import {
  escape, longDate, documentStyles, letterhead, signatureBlock, sealPanel, runningFooter,
  DOCUMENT_FAMILIES,
} from './officialDocument';
import {
  KIND_LABELS, OFFICE_LABELS, printedReference, objectionsTo, blocks,
  type Correspondence, type LetterKind, type Office,
} from './correspondence';
import { isSanitised } from './letterMarkup';

export { PAGE, PRINTABLE, longDate } from './officialDocument';

export interface CorrespondenceLetterInput {
  correspondence: Correspondence;
  /** The stored reference: VC-2026-0042. */
  reference: string;
  issuedOn: string;
  version: number;
  /**
   * The AUTHORITY's name and role — not the preparer's.
   *
   * A letter an administrator typed for the Vice-Chancellor is signed by the
   * Vice-Chancellor, because that is whose letter it is. The administrator is in
   * `prepared_by` and in the history, where the University can see them and the
   * recipient has no business doing so.
   */
  signatoryName: string;
  signatoryRole: string;
  siteUrl: string;
  /**
   * A specimen signature to reproduce, where the University has enabled one for
   * the signatory.
   *
   * EXPLICIT AND CONTROLLED, as the University asked — never an image dropped
   * onto every document. 049 keeps a specimen switched off until somebody OTHER
   * than its owner enables it with a stated authority, and the archived letter
   * records which mode it was signed in.
   */
  signatureImage?: string | null;
  /** The date the authority cleared it, printed under the signature block. */
  authorizedOn?: string | null;
}

export interface GeneratedCorrespondence {
  html: string;
  seal: DocumentSeal | null;
  reference: string;
  printed: string;
}

/**
 * Seal an official letter with the scheme every other IGUC document uses.
 *
 * WHAT IS SEALED IS WHAT A READER CAN CHECK — the recipient, the subject, the
 * reference and the date. Not the body: the verification page does not reprint
 * a letter to a ministry, so sealing the prose would make the seal depend on
 * something the verifier cannot see, and a seal that cannot be recomputed by
 * the person checking it is decoration.
 */
export function sealCorrespondence(
  c: Correspondence, reference: string, issuedOn: string, siteUrl: string,
): DocumentSeal {
  return sealDocument(
    DOCUMENT_FAMILIES.correspondence.scheme,
    DOCUMENT_FAMILIES.correspondence.label,
    {
      recipient: c.recipient_name ?? '',
      subject: c.subject ?? '',
      office: c.originating_office ?? '',
      reference,
      issued: issuedOn,
    },
    siteUrl,
  );
}

/**
 * The letter itself.
 *
 * REFUSES ONE THAT IS NOT READY, for the same reason the appointment letter
 * does: a document that looks finished gets signed, and the omission is then
 * discovered by the person holding it.
 */
export async function correspondenceLetterHtml(
  input: CorrespondenceLetterInput,
): Promise<GeneratedCorrespondence> {
  const c = input.correspondence;

  const outstanding = objectionsTo(c);
  if (blocks(outstanding)) {
    throw new Error(
      'This letter is not ready to be issued: '
      + outstanding.filter((o) => o.blocking).map((o) => o.message).join(' ')
      + ' Nothing on an official letter is added by hand at the moment of issuing.',
    );
  }

  // ---------------------------------------------------------------------
  // AN ASSERTION, NOT A SECOND SANITISER.
  //
  // The body is sanitised on the way IN, so what is stored is already safe and
  // printing it is a copy. If a stored body does not survive `isSanitised`,
  // something wrote to the column without going through the sanitiser — and the
  // right response is to refuse to put the University's seal on it, not to
  // clean it up quietly and print something nobody wrote.
  // ---------------------------------------------------------------------
  if (c.body_format === 'html' && !isSanitised(String(c.body ?? ''), 'html')) {
    throw new Error(
      'The body of this letter is not in the form the editor produces, so it will not be '
      + 'printed. Something wrote to it directly. Open it, check it reads as intended, and '
      + 'save it again before issuing.',
    );
  }

  let seal: DocumentSeal | null = null;
  try {
    seal = sealCorrespondence(c, input.reference, input.issuedOn, input.siteUrl);
  } catch {
    // UNSEALED RATHER THAN UNISSUED. The signing secret may be absent in a
    // deployment nobody has finished configuring, and a letter to a ministry
    // held up by an environment variable is worse than one that goes out
    // saying plainly that it carries no seal.
    seal = null;
  }

  const office = OFFICE_LABELS[c.originating_office as Office] ?? null;
  const kind = KIND_LABELS[c.kind as LetterKind] ?? 'Official Correspondence';

  // THE ADDRESS BLOCK, omitting what is absent rather than printing an empty
  // line. A blank beneath a recipient's name reads as a missing address, which
  // on a letter to a ministry is the impression the University least wants.
  const addressed = [c.recipient_name, c.recipient_org, c.recipient_address]
    .filter((v) => (v ?? '').toString().trim())
    .map((v) => `<p>${escape(v)}</p>`)
    .join('\n');

  return {
    reference: input.reference,
    printed: printedReference(input.reference),
    seal,
    html: `<!doctype html>
<meta charset="utf-8">
<title>${escape(kind)} ${escape(printedReference(input.reference))}</title>
<style>${documentStyles()}</style>

${letterhead(office)}

<h2>${escape(kind)}</h2>

<div class="meta">
  <span>Date: ${escape(longDate(input.issuedOn))}</span>
  <span>Ref: ${escape(printedReference(input.reference))}${
    input.version > 1 ? ` (version ${input.version})` : ''}</span>
</div>

${addressed}

<p>Dear ${escape(c.recipient_name)},</p>

<p><strong>${escape(c.subject)}</strong></p>

<!-- THE AUTHORITY'S OWN WORDS, and NOTHING reflows or "tidies" a letter that
     somebody is about to sign.
     A plain body is escaped and printed with pre-wrap, so the paragraphing they
     typed is the paragraphing that prints. An html body was sanitised against a
     closed allow-list before it was stored, and is emitted as the markup it is —
     asserted above rather than re-cleaned here, so the archived bytes and the
     printed bytes are one document and the hash proves it. -->
${c.body_format === 'html'
  ? `<div class="letterbody rich">${c.body ?? ''}</div>`
  : `<p class="letterbody">${escape(c.body)}</p>`}

${signatureBlock({ name: input.signatoryName, role: input.signatoryRole })}

${await sealPanel(seal, printedReference(input.reference), input.version)}
${runningFooter(printedReference(input.reference), kind)}
`,
  };
}

/** What the register calls this letter, for a list on a screen. */
export function describe(c: Correspondence): string {
  const kind = KIND_LABELS[c.kind as LetterKind] ?? 'Correspondence';
  const office = OFFICE_LABELS[c.originating_office as Office] ?? UNIVERSITY.name;
  return `${kind} — ${office}`;
}
