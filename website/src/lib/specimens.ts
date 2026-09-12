// ---------------------------------------------------------------------------
// SPECIMEN CERTIFICATES — one per level of award the University confers.
//
// ---------------------------------------------------------------------------
// WHY THESE EXIST
// ---------------------------------------------------------------------------
//
// The Studio previewed exactly one certificate: a Bachelor of Theology. So the
// four decisions that vary BY LEVEL could not be seen without issuing a real
// credential to a real graduate:
//
//   THE CONFERRING VERB. A degree is "conferred upon"; a diploma and a
//   certificate are "awarded to". The University does not confer a diploma, and
//   a certificate that says it does misstates what the holder was given.
//
//   THE LEAD-IN. "the Degree of", "the Diploma of", "the Certificate of".
//
//   THE CLASSIFICATION. A doctorate is not classified — a PhD is passed, or
//   passed with corrections, and "with Second Class Honours" beneath one is
//   meaningless. Nor is a certificate.
//
//   THE THESIS. A research degree is conferred on a piece of work, and its
//   certificate names it. A taught award has no thesis, and the line is absent
//   rather than blank.
//
// Getting any of those wrong is not a styling error. It is the University
// attesting to something other than what it decided.
//
// ---------------------------------------------------------------------------
// EVERY AWARD NAMED HERE IS ONE THE UNIVERSITY ACTUALLY OFFERS
// ---------------------------------------------------------------------------
//
// Taken from src/content/courses.ts, which is the catalogue the public site is
// built from. Nothing here is invented — a specimen carrying an award the
// University does not offer is a picture of a qualification that does not
// exist, and it would circulate as one.
//
// ---------------------------------------------------------------------------
// AND NONE OF THEM CAN BE MISTAKEN FOR AN ISSUED CERTIFICATE
// ---------------------------------------------------------------------------
//
// Three independent things say so, because a convincing blank certificate is a
// forger's starting material and one safeguard is not enough:
//
//   1. SPECIMEN is overprinted across the face. `CertificateDocument` draws it
//      when `specimen` is set, and every specimen here is rendered with it.
//   2. The credential number is literally SPECIMEN, in the position where a
//      real number goes. It is not a plausible-looking number.
//   3. It does not verify. /verify resolves a number against the issuance
//      register; no specimen is in the register, so a scan returns "no such
//      credential" rather than a match. That is the check that actually decides
//      authenticity, and it fails closed.
//
// The holder is the same invented person on all five, and is named as such
// below, so that no specimen can be read as a record of somebody's award.
// ---------------------------------------------------------------------------

import type { CertificateData } from '@/components/certificate/CertificateDocument';

/**
 * The name printed on every specimen.
 *
 * ONE NAME ACROSS ALL FIVE, on purpose. Five specimens bearing five different
 * plausible names read as five graduates; five bearing one name read as one
 * template shown five times, which is what they are.
 */
const SPECIMEN_HOLDER = 'Specimen A. Candidate';

/** In the position a credential number occupies, and unmistakable there. */
const SPECIMEN_ID = 'SPECIMEN — NOT AN ISSUED CREDENTIAL';

export interface Specimen {
  id: string;
  /** The level, as the University's catalogue names it. */
  level: string;
  /** What this specimen exists to show — the decision that varies here. */
  shows: string;
  data: CertificateData;
}

/**
 * One specimen per level, in the order the University's awards ascend.
 *
 * The faculty is set because it drives the emblem on the security device, and a
 * specimen with no faculty would show a plainer document than the real one.
 */
export const SPECIMENS: Specimen[] = [
  {
    id: 'certificate',
    level: 'Certificate',
    shows:
      'Awarded to, not conferred upon — and no classification. A certificate is not '
      + 'classified, so no class is printed rather than a blank where one would go.',
    data: {
      fullName: SPECIMEN_HOLDER,
      programme: 'Theology',
      degree: 'Certificate of Theology',
      classification: '',
      credentialId: SPECIMEN_ID,
      faculty: 'Faculty of Theology and Christian Counselling',
    },
  },
  {
    id: 'diploma',
    level: 'Diploma',
    shows:
      'The Diploma of — not the Degree of. A diploma is not a degree and the '
      + 'certificate must not say it is. Classified, and awarded rather than conferred.',
    data: {
      fullName: SPECIMEN_HOLDER,
      programme: 'Theology',
      degree: 'Diploma in Theology',
      classification: 'with Distinction',
      credentialId: SPECIMEN_ID,
      faculty: 'Faculty of Theology and Christian Counselling',
    },
  },
  {
    id: 'bachelor',
    level: 'Bachelor',
    shows:
      'The first level the University confers rather than awards, and the first '
      + 'to carry honours. The security device steps up a tier.',
    data: {
      fullName: SPECIMEN_HOLDER,
      programme: 'Theology',
      degree: 'Bachelor of Theology',
      classification: 'Second Class Honours (Upper Division)',
      credentialId: SPECIMEN_ID,
      faculty: 'Faculty of Theology and Christian Counselling',
    },
  },
  {
    id: 'master',
    level: 'Master',
    shows:
      'Conferred, classified by distinction rather than by honours division, and '
      + 'the device reaches its full form.',
    data: {
      fullName: SPECIMEN_HOLDER,
      programme: 'Divinity',
      degree: 'Master of Divinity',
      classification: 'with Distinction',
      credentialId: SPECIMEN_ID,
      faculty: 'Faculty of Theology and Christian Counselling',
    },
  },
  {
    id: 'doctorate',
    level: 'Doctorate',
    shows:
      'NAMES THE THESIS and carries no classification — the two things that make a '
      + 'research degree different. A doctorate is conferred on a piece of work, and a '
      + 'certificate that does not name the work omits what distinguishes it from every '
      + 'other doctorate the University has conferred.',
    data: {
      fullName: SPECIMEN_HOLDER,
      programme: 'Theology',
      degree: 'Doctor of Philosophy (Theology)',
      classification: '',
      credentialId: SPECIMEN_ID,
      faculty: 'Faculty of Theology and Christian Counselling',
      thesisTitle: 'A Specimen Thesis Title, Shown Here Because a Research Degree Names Its Work',
    },
  },
];

/** A specimen by id, for the single-specimen view. */
export function specimenById(id: string): Specimen | undefined {
  return SPECIMENS.find((s) => s.id === id);
}
