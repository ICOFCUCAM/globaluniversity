// ---------------------------------------------------------------------------
// What the university is conferring, and the words it uses to confer it.
//
// WHY THIS EXISTS.
//
// The certificate had one sentence for everything: "the Degree of {award}". On
// a Bachelor of Theology that is correct. On a Diploma in Theology it is false
// on its face — a diploma is not a degree, and a certificate that calls it one
// misstates the award in the one place the university is most formally on the
// record. On a doctorate it is correct but thin: doctorates are conferred, not
// classified, and printing "with Second Class Honours" under a PhD would be
// meaningless.
//
// So the wording follows the kind of award, and the kind is derived from the
// award's own name rather than stored separately — because a separate field
// would need keeping in step with the title, and the first time it drifted the
// certificate would say one thing and the register another.
//
// WHAT IS NOT HERE, and should be: a table of the awards this university
// actually confers, with the credit requirement and minimum CGPA for each. That
// is what turns "issue a certificate" into "issue a certificate the regulations
// permit", and it is listed under Not built yet in the Studio. Until it exists,
// the award title is typed by the issuing office and this module can only make
// sure the sentence around it is true.
// ---------------------------------------------------------------------------

export type AwardKind = 'doctorate' | 'masters' | 'bachelors' | 'diploma' | 'certificate' | 'other';

/**
 * Which kind of award a title names.
 *
 * Matched on the title because that is the thing the registrar types and the
 * thing the certificate prints. Order matters: "Master of Divinity" must not
 * match on "Divinity" before it matches on "Master".
 */
export function awardKindOf(award: string): AwardKind {
  const a = (award ?? '').toLowerCase();
  if (/\b(doctor|doctoral|phd|ph\.d|d\.min|dmin|th\.d|thd)\b/.test(a)) return 'doctorate';
  if (/\bmaster|\bm\.?(a|sc|div|ed|ba)\b|\bmphil\b/.test(a)) return 'masters';
  if (/\bbachelor|\bb\.?(a|sc|th|ed|d)\b/.test(a)) return 'bachelors';
  if (/\bdiploma|\bpgd\b|\bhnd\b/.test(a)) return 'diploma';
  if (/\bcertificate\b/.test(a)) return 'certificate';
  return 'other';
}

export interface AwardWording {
  /** What precedes the award's name: "the Degree of", "the Diploma of". */
  lead: string;
  /** The conferring verb phrase, before the holder's name. */
  confers: string;
  /**
   * Whether a class of award is printed at all.
   *
   * A doctorate is not classified — a PhD is passed, or passed with
   * corrections, and "with Second Class Honours" under one would be
   * meaningless. A certificate of attendance is not classified either.
   */
  classified: boolean;
  /** The recognition clause, which differs for a research degree. */
  recognition: string;
  /**
   * Whether the certificate names a thesis.
   *
   * True only for research degrees. A taught award has no thesis, and a line
   * reserved for one would leave a gap in the middle of the conferral on every
   * bachelor's certificate the university issues.
   */
  namesThesis: boolean;
}

const WORDING: Record<AwardKind, AwardWording> = {
  doctorate: {
    // The older form. A doctorate is not "awarded" like a prize; the candidate
    // is admitted to the degree, which is what the ceremony actually does.
    lead: 'admitted to the Degree of',
    confers: 'has admitted to the said Degree',
    classified: false,
    namesThesis: true,
    recognition:
      'and in recognition of the successful completion of a programme of supervised research ' +
      'and the defence of a thesis before the Dissertation Council',
  },
  masters: {
    lead: 'admitted to the Degree of',
    confers: 'confers upon',
    classified: true,
    namesThesis: false,
    recognition: 'and in recognition of the successful completion of the prescribed course of study',
  },
  bachelors: {
    lead: 'the Degree of',
    confers: 'confers upon',
    classified: true,
    namesThesis: false,
    recognition: 'and in recognition of the successful completion of the prescribed course of study',
  },
  diploma: {
    // Not a degree, and the certificate must not say it is.
    lead: 'the Diploma of',
    confers: 'awards to',
    classified: true,
    namesThesis: false,
    recognition: 'and in recognition of the successful completion of the prescribed course of study',
  },
  certificate: {
    lead: 'the Certificate of',
    confers: 'awards to',
    classified: false,
    namesThesis: false,
    recognition: 'and in recognition of the successful completion of the prescribed course of study',
  },
  other: {
    lead: 'the award of',
    confers: 'confers upon',
    classified: true,
    namesThesis: false,
    recognition: 'and in recognition of the successful completion of the prescribed course of study',
  },
};

export function awardWording(kind: AwardKind): AwardWording {
  return WORDING[kind];
}

/** Convenience: the wording for an award named by title. */
export function wordingForAward(award: string): AwardWording {
  return awardWording(awardKindOf(award));
}
