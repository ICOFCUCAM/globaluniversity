// ---------------------------------------------------------------------------
// THE SIX ACADEMIC DOCUMENTS, AND WHAT EACH ONE IS FOR.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A TABLE AND NOT A BOOLEAN
// ---------------------------------------------------------------------------
//
// The obvious implementation is `official: boolean` and a watermark. It is
// wrong, because the six documents differ in what they may CONTAIN, not only
// in how they are stamped:
//
//   an UNOFFICIAL copy carries no seal, because a seal is the University
//   standing behind the document, and it must not be verifiable against the
//   register — a copy a student printed for themselves that verified as
//   genuine would be an official transcript with the word "unofficial" on it
//
//   an ACADEMIC RECORD is the registry's own working view and carries standing
//   history and internal notes that do not belong on a document a student
//   hands to an employer
//
//   an INTERIM transcript must say on its face that the programme is unfinished,
//   or a reader takes a short record for a complete one
//
// Encoding that as a table means a new document type is a row, and means no
// screen can accidentally produce a sealed unofficial copy.
//
// ---------------------------------------------------------------------------
// WHAT IS NOT DECIDED HERE
// ---------------------------------------------------------------------------
//
// Whether a student may request each kind, and what it costs. That is registry
// policy and it lives with the request, not with the document.
// ---------------------------------------------------------------------------

export type TranscriptKind =
  | 'official'
  | 'unofficial'
  | 'interim'
  | 'graduation'
  | 'academic-record'
  | 'external-evaluation';

export interface TranscriptProfile {
  kind: TranscriptKind;
  /** What the registry calls it. */
  label: string;
  /** Printed across the head of every sheet, under the University's name. */
  title: string;
  /**
   * The band printed across the face, if any.
   *
   * An unofficial copy says so loudly and permanently. A student who can crop
   * it out has forged a document; a student who was never given one has been
   * handed an official transcript by mistake.
   */
  overprint: string | null;
  /**
   * Whether it goes on the credential register and carries a seal, a QR and a
   * credential number.
   *
   * FALSE FOR THE UNOFFICIAL AND INTERNAL COPIES, and that is the whole point:
   * only a document the University stands behind is verifiable, so verifying
   * one means something.
   */
  sealed: boolean;
  /** Whether the conferral block is printed. */
  showsGraduation: boolean;
  /** Whether the standing history — not merely the current standing — appears. */
  showsStandingHistory: boolean;
  /** Whether internal registry notes appear. */
  showsInternalNotes: boolean;
  /**
   * A sentence printed on the face explaining what the reader is holding.
   * Every kind has one; a document that does not say what it is invites the
   * reader to assume the strongest reading.
   */
  statement: string;
}

export const TRANSCRIPT_PROFILES: Record<TranscriptKind, TranscriptProfile> = {
  official: {
    kind: 'official',
    label: 'Official transcript',
    title: 'Official Academic Transcript',
    overprint: null,
    sealed: true,
    showsGraduation: true,
    showsStandingHistory: false,
    showsInternalNotes: false,
    statement:
      'This is an official transcript of the University. It is sealed, entered on the '
      + 'University’s credential register, and may be verified by anyone without contacting the '
      + 'University.',
  },

  unofficial: {
    kind: 'unofficial',
    label: 'Unofficial transcript',
    title: 'Unofficial Academic Transcript',
    overprint: 'UNOFFICIAL',
    // NOT SEALED, DELIBERATELY. See the header.
    sealed: false,
    showsGraduation: true,
    showsStandingHistory: false,
    showsInternalNotes: false,
    statement:
      'UNOFFICIAL — FOR STUDENT USE ONLY. This copy carries no seal and is not entered on the '
      + 'University’s register, so it cannot be verified and is not accepted as evidence of the '
      + 'holder’s record. Request an official transcript for any external purpose.',
  },

  interim: {
    kind: 'interim',
    label: 'Interim transcript',
    title: 'Interim Academic Transcript',
    overprint: null,
    sealed: true,
    // A programme that is not finished has not been conferred, and a conferral
    // block on an interim transcript would print a heading with nothing under
    // it — which reads as a missing value rather than an inapplicable one.
    showsGraduation: false,
    showsStandingHistory: false,
    showsInternalNotes: false,
    statement:
      'INTERIM — the holder is currently enrolled and this programme is not complete. This '
      + 'transcript records results approved to the date of issue and is not evidence that an '
      + 'award has been earned or conferred.',
  },

  graduation: {
    kind: 'graduation',
    label: 'Graduation transcript',
    title: 'Final Academic Transcript',
    overprint: null,
    sealed: true,
    showsGraduation: true,
    showsStandingHistory: false,
    showsInternalNotes: false,
    statement:
      'This is the holder’s final academic record for a completed programme, issued after '
      + 'conferral of the award named below. It is sealed and may be verified.',
  },

  'academic-record': {
    kind: 'academic-record',
    label: 'Academic record (internal)',
    title: 'Academic Record — Internal',
    overprint: 'INTERNAL',
    // NOT SEALED, because it is not a document the University issues to
    // anybody. Sealing it would put registry working notes on the public
    // verification service.
    sealed: false,
    showsGraduation: true,
    showsStandingHistory: true,
    showsInternalNotes: true,
    statement:
      'INTERNAL REGISTRY RECORD. Contains academic standing history and registry notes that are '
      + 'not part of any document issued to the holder. Not to be released outside the '
      + 'University.',
  },

  'external-evaluation': {
    kind: 'external-evaluation',
    label: 'Transcript for credential evaluation',
    title: 'Official Academic Transcript — for Credential Evaluation',
    overprint: null,
    sealed: true,
    showsGraduation: true,
    showsStandingHistory: false,
    showsInternalNotes: false,
    statement:
      'Prepared for a credential evaluation service or a receiving institution. The grading '
      + 'scale, the credit system and the nominal length of the programme are stated on the face '
      + 'so the award can be assessed without reference to the University.',
  },
};

export function profileFor(kind: TranscriptKind | null | undefined): TranscriptProfile {
  return TRANSCRIPT_PROFILES[kind ?? 'official'] ?? TRANSCRIPT_PROFILES.official;
}

/**
 * The kinds a student may ask for themselves.
 *
 * The internal record is not among them, and neither is anything a fee might
 * stand behind — the registry decides those, and this only stops the request
 * screen from offering a document nobody could fulfil.
 */
export const STUDENT_REQUESTABLE: TranscriptKind[] = [
  'official', 'unofficial', 'interim', 'graduation', 'external-evaluation',
];
