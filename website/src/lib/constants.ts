// ============================================
// University Management System - Constants
// ============================================

export const UNIVERSITY = {
  name: 'ICOF Global University',
  shortName: 'IGUC',
  motto: 'Nobility, Professionalism & Godliness',
  address: 'Opposite Bulu Blind Junction, Buea-Cameroon',
  // The seat of the International Circle of Faith, under which the university
  // is constituted. It is what belongs on an identity card: a card is carried
  // across borders and read by people who have never heard of Buea, and it
  // should name the institution behind the holder rather than one of the places
  // it teaches. The campus address stays on correspondence, where it is what
  // the reader actually needs.
  headquarters: 'ICOF Global Headquarters, USA',
  descriptor: 'The Community University',
  phone: '+237 675 133 426',
  email: 'registrar@iguc.net',
  website: 'www.iguc.net',
  established: 2007,
  // One form, everywhere. The About page published 'Prof Lyonga Divine' and
  // the certificate printed 'Dr. Divine Lyonga' — the same person under two
  // names, which is exactly the kind of disagreement a credential evaluator
  // checking a graduate's paperwork against the university's own site will
  // find and hold against the document.
  registrar: 'Dr Divine Lyonga',
  // Signs every admission letter. The office is Head of Academic Affairs; the
  // holder is named here so the letter is signed by a person rather than by
  // whichever account happened to press the button.
  //
  // The post-nominals are affixed to the name because the letter is the
  // university's formal attestation of an academic decision, and the standing
  // of the person making it is part of what the reader — an employer, another
  // university, an immigration officer — is being asked to accept.
  //
  // Both doctorates are named, in the initialled form: "Ph.D. (Fin.), Ph.D.
  // (Syst. Theol.)". Two named fields rather than a bare "Ph.D., Ph.D.", which
  // states less and reads as a typing error; initialled rather than spelt out,
  // so the signature line stays one line under the rule.
  headOfAcademicAffairs: 'Prof Aaron Ndenka',
  headOfAcademicAffairsPostNominals: 'Ph.D. (Fin.), Ph.D. (Syst. Theol.)',
  admissionsEmail: 'admissions@iguc.net',
  // The Head of Academic Affairs' office, created by the University on
  // 12 September 2026. The admission letter is signed by this office, so an
  // admitted student replying to ask about their decision should reach it
  // rather than the inbox that handles applications.
  academicAffairsEmail: 'academicoffice@iguc.net',

  // ---------------------------------------------------------------------
  // THE VICE-CHANCELLOR'S OFFICE.
  //
  // NOT INVENTED. The University publishes this address in its own content —
  // src/content/site.ts carries it in the Vice-Chancellor's entry, three
  // times. It is here so that appointment letters and official correspondence
  // have one place to take a reply, rather than each route choosing.
  //
  // The mailer test found the gap: the appointment-letter route sent from the
  // Office of the Vice-Chancellor and that office was in neither reply-to
  // table, which means an appointee replying to their own letter of
  // appointment would have had the reply go nowhere in particular.
  // ---------------------------------------------------------------------
  viceChancellorEmail: 'vc@iguc.net',
  viceChancellor: 'Prof Chamayah Meyembi',
  // The two offices above the Vice Chancellor, from the university's own first
  // certificate. Both sign a degree certificate; neither was in this system.
  //
  // CORRECTED ON THE UNIVERSITY'S OWN INSTRUCTION. Bishop Bernie L Wade holds
  // the Chancellorship and Dr Raymond L Young the Presidency. This file had
  // them the other way round and invented a President who does not exist, so
  // every certificate the system could produce carried the wrong office under
  // the wrong signature.
  //
  // The published roster in src/content/site.ts was right the whole time. These
  // constants should have been read from it rather than typed again — that is
  // the actual defect, and it is why the names are now taken verbatim from what
  // the About page publishes.
  //
  // The Presiding Bishopric goes with the Chancellorship, not the Presidency:
  // it is Wade who is Presiding Bishop of the International Circle of Faith.
  chancellor: 'Bishop Bernie L Wade, PhD',
  chancellorOffice: 'Chancellor & ICOF International Presiding Bishop',
  president: 'Dr. Raymond L Young',
};

// ---------------------------------------------------------------------------
// WHERE A REPLY TO EACH OFFICE SHOULD GO
// ---------------------------------------------------------------------------
//
// Every email the system sends goes out from ONE address — whatever MAIL_FROM
// or SMTP_USER is set to — because that is the account the mail server
// authenticates. The office only ever appeared as a display name:
//
//   From: "ICOF Global University — Office of Academic Affairs" <admissions@…>
//
// So an admitted student replying to ask about their decision reached the
// inbox that handles applications, and a graduate querying a certificate
// reached it too, though the Registrar signed that one. Five offices send
// through this system and every reply landed in the same place.
//
// The sender cannot be varied without a second set of SMTP credentials, and it
// does not need to be: Reply-To is the field that decides where an answer
// goes, and it costs nothing. The letter still comes from the account with the
// sending history; the reply reaches the office that can answer it.
//
// KEYED BY THE EXACT STRING the sending route passes as `office`, because that
// is what the mailer has to match on. mailer.test.mjs fails if a route names
// an office this table does not know.
// ---------------------------------------------------------------------------
export const OFFICE_REPLY_TO: Record<string, string> = {
  'Office of Academic Affairs': UNIVERSITY.academicAffairsEmail,
  'Office of the Vice-Chancellor': UNIVERSITY.viceChancellorEmail,
  'Office of the Registrar': UNIVERSITY.email,
  'Office of Admissions': UNIVERSITY.admissionsEmail,
  'Admissions Office': UNIVERSITY.admissionsEmail,
};

/**
 * Offices that deliberately have no reply address, and why.
 *
 * Written down so the test can be exhaustive. An office missing from both
 * tables is a reply going to the wrong place, silently.
 */
export const OFFICE_WITHOUT_REPLY_TO: Record<string, string> = {
  'System Administration': 'The mail test sends only to the signed-in operator’s own address, '
    + 'so a reply-to would point them at themselves.',
};

// Portal imagery. Previously eleven URLs on the original template's
// CloudFront bucket — third-party assets of unknown provenance and licence,
// on a live login page, that would break the moment that bucket went away.
// All replaced with the university's own files from /public.
export const IMAGES = {
  logo: '/images/site-icon.png',
  // ---------------------------------------------------------------------
  // THE SIGN-IN SCREEN'S PHOTOGRAPH
  // ---------------------------------------------------------------------
  //
  // The University's own choice, and it replaced the graduation hall here on
  // instruction. It arrived as `ChatGPT Image Aug 9, 2026, 06_56_24 PM.png`
  // and was renamed and re-encoded on the way in: a name carrying spaces and
  // commas becomes a URL carrying %20 and %2C, which works until something
  // along the way does not encode it — and 2,053 KB of PNG for a photograph
  // is about eight times what it needs to be, on a page every student and
  // member of staff loads. The same plate is 247 KB as a JPEG.
  hero: '/images/sign-in-hero.jpg',
  // ---------------------------------------------------------------------
  // THE MANAGEMENT SYSTEM'S PHOTOGRAPH — A DIFFERENT ONE
  // ---------------------------------------------------------------------
  //
  // Separate from `hero` because no image on this site is used twice, and
  // this one was: the administrator's dashboard pasted the sign-in screen's
  // photograph into the right-hand third of its welcome band, so the reader
  // met the same picture twice in four seconds. Signing in should change the
  // scene.
  //
  // It is the graduation hall, which the sign-in screen used until the
  // University replaced it there. Moving it here rather than retiring it is
  // the whole point: it is the university's own photograph of its own
  // congregation, and the one place it is now shown is the system the people
  // in it are recorded by.
  //
  // IF THIS FILE IS NOT PRESENT the masthead renders as the aubergine wash
  // alone and nothing breaks: it is painted as a background layer over a
  // gradient that is always drawn, never as an <img> that could 404 into a
  // broken glyph across the top of every dashboard. See PortalMasthead.tsx.
  portalHero: '/images/hall.jpg',
  seal: '/images/site-icon.png',
  professors: [
    '/images/wp/ndenka.jpg',
    '/images/wp/vc-meyembi.png',
    '/images/wp/samuel-kinge.png',
    '/images/wp/lyonga-divine.png',
  ],
  students: [
    '/images/wp/g-graduates.jpg',
    '/images/wp/g-students.jpg',
    '/images/wp/g-grads.jpg',
    '/images/wp/g-student-celebration.jpg',
  ],
};

export const ACADEMIC_YEARS = [2022, 2023, 2024, 2025, 2026];
export const SEMESTERS = [
  { value: 1, label: 'First Semester' },
  { value: 2, label: 'Second Semester' },
];

/**
 * MOVED TO src/lib/studentStatus.ts, WITH ONE VALUE FEWER.
 *
 * This list had `deferred` in it, which is an ADMISSION outcome — an offer held
 * to a later intake — and it also appears in ADMISSION_STATES. Two lists, one
 * word, two meanings, and both were written to the same database column. That
 * is the whole fault 037 splits apart, so the vocabulary lives beside the
 * functions that read it rather than here among the institutional facts.
 *
 * Re-exported so nothing that imports it from here breaks, and so a search for
 * the name finds the explanation rather than only the new list.
 */
export { STUDENT_STATUSES } from './studentStatus';
export const RESULT_STATUSES = ['pending', 'submitted', 'approved', 'rejected'];
