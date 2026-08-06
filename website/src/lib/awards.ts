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

/**
 * The award's title as it should be printed UNDER the lead-in.
 *
 * WHY. The lead-in already names the instrument — "the Certificate of", "the
 * Diploma of" — and registrars type the instrument into the title as well,
 * because that is how the award is written everywhere else. Printed straight,
 * the certificate read:
 *
 *     THE CERTIFICATE OF
 *     CERTIFICATE IN CHRISTIAN MINISTRY
 *
 * which is the university stammering on its own document. Stripping the
 * repeated word gives "THE CERTIFICATE OF / CHRISTIAN MINISTRY", which is what
 * the sentence was written to say.
 *
 * Only ever strips a leading instrument word, and only for the kinds whose
 * lead-in names one. "Bachelor of Theology" is untouched — the lead-in there is
 * "the Degree of", and "Bachelor" is part of the award's name, not a repeat of
 * the instrument.
 */
export function awardTitleAfterLead(award: string): string {
  const kind = awardKindOf(award);
  if (kind !== 'certificate' && kind !== 'diploma') return award;
  const stripped = (award ?? '')
    .replace(/^\s*(?:the\s+)?(?:postgraduate\s+|higher\s+national\s+|advanced\s+)?(certificate|diploma)\s+(?:of|in)\s+/i, '')
    .trim();
  // If stripping leaves nothing — the award is called just "Diploma" — keep the
  // original rather than printing an empty line where the award should be.
  return stripped.length > 0 ? stripped : award;
}

/* ------------------------------------------------------------------ */
/* How the security device varies by award and faculty                  */
/* ------------------------------------------------------------------ */

/**
 * How elaborate the watermark device is for this award.
 *
 * A diploma and a doctorate should not carry the same figure. The university's
 * highest award ought to be recognisable as its highest award from across a
 * room, before a word of it is read — which is what the tiers do, and it costs
 * nothing because it is the same device throughout. Only the elaboration
 * changes, so the identity holds and the hierarchy shows.
 */
export function deviceTierFor(award: string): 'standard' | 'elaborate' | 'full' | 'supreme' {
  switch (awardKindOf(award)) {
    case 'doctorate': return 'supreme';
    case 'masters': return 'full';
    case 'bachelors': return 'elaborate';
    // A certificate and a diploma START at 'standard', which is what the
    // bachelor's used to get. The lowest award the university confers is still
    // one of its awards, and a plain ring round a globe is what every
    // certificate generator on the internet produces — beginning the ladder
    // there meant the diploma looked like a template and only the doctorate
    // looked like an instrument. The floor moved up; the ceiling moved to meet
    // it.
    default: return 'standard';
  }
}

/**
 * The emblem at the foot of the device, by faculty.
 *
 * Matched on the faculty's own name rather than stored on it, for the same
 * reason the award wording is derived from the award title: a separate field
 * drifts, and the first time it does the certificate says one thing and the
 * record another.
 *
 * A faculty this does not recognise gets no emblem rather than a wrong one. An
 * open book under an engineering degree is worse than a plain device.
 */
export function emblemFor(faculty: string | null | undefined): 'book' | 'gear' | 'compass' | 'torch' | 'none' {
  const f = (faculty ?? '').toLowerCase();
  if (/theolog|divinity|ministr|counsell|bible/.test(f)) return 'book';
  if (/engineer|technolog|comput|science/.test(f)) return 'gear';
  if (/business|management|commerce|econom|account/.test(f)) return 'compass';
  if (/educat|teach|pedagog/.test(f)) return 'torch';
  return 'none';
}
