// ---------------------------------------------------------------------------
// THE TEMPLATE REGISTRY — every document the University issues, and its wording.
//
// ---------------------------------------------------------------------------
// WHY THE CORRESPONDENCE KINDS CARRY A PREFIX
// ---------------------------------------------------------------------------
//
// Three names appear in both vocabularies. 'reappointment', 'promotion' and
// 'appointment' are HR document types AND kinds of official correspondence, and
// they are not the same document: an HR promotion produces a package of four
// documents from a structured record, while the Vice-Chancellor's promotion
// letter is prose on letterhead.
//
// Merged into one list without a prefix, a template written for one would be
// served for the other — and nobody would notice until somebody read the
// document that came out. Two vocabularies that share three words are not one
// vocabulary, so correspondence kinds are `letter-*`. 051 says the same thing
// in the constraint.
//
// ---------------------------------------------------------------------------
// AND WHY A VERSION THAT ISSUED A DOCUMENT CAN NEVER BE DELETED
// ---------------------------------------------------------------------------
//
// `on delete restrict` on every reference to a template. A letter issued in
// 2026 was produced by the wording of 2026, and a University that redesigns its
// letterhead twice must still be able to say what it actually sent. The archive
// holds the bytes; the template reference holds the provenance.
// ---------------------------------------------------------------------------

import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, type DocumentType } from './appointments';
import { LETTER_KINDS, KIND_LABELS, type LetterKind } from './correspondence';

// ---------------------------------------------------------------------------
// 1. THE KINDS
// ---------------------------------------------------------------------------

/**
 * The three documents an appointment package carries besides the letter.
 *
 * THE UNIVERSITY NAMED FOUR AND ONLY THE FIRST HAD A TEMPLATE. A job
 * description, the conditions of service and the acceptance form are each a
 * document the University is held to, and each needs its own wording, its own
 * version and its own approval.
 */
export const PACKAGE_KINDS = [
  'job-description', 'terms-and-conditions', 'acceptance-form',
] as const;

export type PackageKind = (typeof PACKAGE_KINDS)[number];

/** A correspondence kind as it appears in the template registry. */
export function letterTemplateKind(kind: LetterKind): string {
  return `letter-${kind}`;
}

export const TEMPLATE_KINDS: string[] = [
  ...DOCUMENT_TYPES,
  ...PACKAGE_KINDS,
  ...LETTER_KINDS.map(letterTemplateKind),
];

export const TEMPLATE_KIND_LABELS: Record<string, string> = {
  ...DOCUMENT_TYPE_LABELS,
  'job-description': 'Job Description',
  'terms-and-conditions': 'Terms and Conditions of Appointment',
  'acceptance-form': 'Acceptance of Appointment',
  ...Object.fromEntries(
    LETTER_KINDS.map((k) => [letterTemplateKind(k), `Letter — ${KIND_LABELS[k]}`]),
  ),
};

/**
 * The groups the registry screen draws.
 *
 * THIRTY-ONE KINDS IN ONE LIST IS A LIST NOBODY READS. Grouped the way the
 * University thinks about them: the documents that issue from an appointment,
 * the rest of the package, and the letters an office writes itself.
 */
export const TEMPLATE_GROUPS: { label: string; kinds: string[] }[] = [
  { label: 'Appointment documents', kinds: [...DOCUMENT_TYPES] },
  { label: 'The rest of the appointment package', kinds: [...PACKAGE_KINDS] },
  { label: 'Official correspondence', kinds: LETTER_KINDS.map(letterTemplateKind) },
];

export function isTemplateKind(v: unknown): boolean {
  return typeof v === 'string' && TEMPLATE_KINDS.includes(v);
}

// ---------------------------------------------------------------------------
// 2. THE RECORD
// ---------------------------------------------------------------------------

export interface DocumentTemplate {
  id?: string;
  kind?: string | null;
  version?: number | null;
  name?: string | null;
  body?: string | null;
  status?: string | null;
  effective_from?: string | null;
  created_by?: string | null;
  activated_by?: string | null;
  activated_at?: string | null;
  retired_at?: string | null;
}

export interface Coverage {
  kind?: string | null;
  active_template_id?: string | null;
  name?: string | null;
  version?: number | null;
  effective_from?: string | null;
  activated_at?: string | null;
  versions?: number | null;
  appointment_letters_issued?: number | null;
  correspondence_issued?: number | null;
}

export const TEMPLATE_STATES = ['draft', 'active', 'retired'] as const;
export const MIN_TEMPLATE_NAME = 3;
export const MIN_TEMPLATE_BODY = 20;

// ---------------------------------------------------------------------------
// 3. WHO MAY DO WHAT
// ---------------------------------------------------------------------------

/**
 * Whether this person may activate this template.
 *
 * NOBODY ACTIVATES WHAT THEY WROTE. The same rule 005 requires of a certificate
 * design and 048 of a job description. A template decides what every future
 * document of its kind says; one person writing and approving that alone is one
 * person deciding the University's wording.
 */
export function canActivate(t: DocumentTemplate, callerId: string): boolean {
  if (t.status !== 'draft') return false;
  if (t.created_by && t.created_by === callerId) return false;
  return true;
}

export function canEdit(t: DocumentTemplate): boolean {
  // AN ACTIVE TEMPLATE IS NOT EDITED, it is superseded by a new version. 044
  // refuses the edit in the database; this is the screen agreeing rather than
  // the rule itself.
  return t.status === 'draft';
}

/** Whether a version can be retired without stranding a document. */
export function canRetire(c: Coverage): boolean {
  return (c.versions ?? 0) > 1;
}

// ---------------------------------------------------------------------------
// 4. WHAT IS NOT COVERED
// ---------------------------------------------------------------------------

/**
 * The document kinds with no active template.
 *
 * EVERY ONE IS A DOCUMENT THE UNIVERSITY CAN BE ASKED TO PRODUCE AND HAS NO
 * APPROVED WORDING FOR. The list is long today, and showing it is the point:
 * the alternative is discovering it at the moment somebody needs the document.
 */
export function uncovered(rows: Coverage[]): string[] {
  return rows.filter((r) => !r.active_template_id).map((r) => String(r.kind));
}

export function coverageOf(rows: Coverage[]): { covered: number; total: number } {
  return { covered: rows.filter((r) => r.active_template_id).length, total: rows.length };
}

/**
 * Whether a template may be deleted, and why not.
 *
 * THE ANSWER IS USUALLY NO, and the reason matters more than the answer. A
 * template that has produced documents is the provenance of every one of them;
 * the database refuses the delete with `on delete restrict`, and this is what
 * the screen says before the button is pressed.
 */
export function whyNotDeletable(c: Coverage): string | null {
  const issued = (c.appointment_letters_issued ?? 0) + (c.correspondence_issued ?? 0);
  if (issued > 0) {
    return `${issued} document${issued === 1 ? ' has' : 's have'} been issued from this `
      + 'wording. It cannot be deleted — somebody is holding a document made from it, and the '
      + 'University must still be able to say what it sent. Retire it instead: a retired '
      + 'template produces nothing new and still accounts for what it produced.';
  }
  return null;
}
