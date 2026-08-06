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
  descriptor: 'The Community University of Africa',
  phone: '+237 675 133 426',
  email: 'registrar@iguc.net',
  website: 'www.iguc.net',
  established: 2007,
  registrar: 'Prof Lyonga Divine',
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
  viceChancellor: 'Prof Chamayah Meyembi',
  // The two offices above the Vice Chancellor, from the university's own first
  // certificate. Both sign a degree certificate; neither was in this system.
  chancellor: 'Dr. Raymond L. Young',
  chancellorOffice: 'ICOF Chancellor & International Presiding Bishop',
  president: 'Bonnie L. Walo',
};

// Portal imagery. Previously eleven URLs on the original template's
// CloudFront bucket — third-party assets of unknown provenance and licence,
// on a live login page, that would break the moment that bucket went away.
// All replaced with the university's own files from /public.
export const IMAGES = {
  logo: '/images/site-icon.png',
  hero: '/images/hall.jpg',
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

export const STUDENT_STATUSES = ['active', 'graduated', 'suspended', 'withdrawn', 'deferred'];
export const RESULT_STATUSES = ['pending', 'submitted', 'approved', 'rejected'];
