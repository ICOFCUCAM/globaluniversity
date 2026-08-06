// ---------------------------------------------------------------------------
// Accreditation and institutional partnership.
//
// ON THE WORDING, WHICH IS THE WHOLE OF THE RISK ON THIS PAGE.
//
// The university's own instruction, and it is the right one: do NOT describe
// ICOF Global University as an "accreditation body". That phrase, in most
// jurisdictions, names a agency with statutory recognition to confer
// accreditation — and using it without that recognition is a claim a ministry
// of education, a credential evaluator or a court will test.
//
// What is described here instead is what the university actually does:
// institutional accreditation, academic validation, quality assurance and
// academic partnership SERVICES offered to eligible institutions. That is an
// accurate account of a quality-assurance role and it does not collide with
// national accrediting agencies.
//
// If the university holds statutory authority to accredit in a named
// jurisdiction, or does so through a recognised ecclesiastical framework, that
// authority should be stated explicitly and by name — see `statutoryAuthority`
// below, which is deliberately empty until somebody can fill it with a real
// instrument rather than an aspiration.
// ---------------------------------------------------------------------------

/**
 * Where the university's authority to do this comes from, stated explicitly.
 *
 * EMPTY ON PURPOSE. A page that asserts authority without naming its source is
 * asserting nothing a reader can check, and the readers who matter here — a
 * ministry, an evaluator, an institution deciding whether to apply — check.
 * Fill this with the instrument, the jurisdiction and the date, or leave it
 * empty and let the page say plainly what the service is instead.
 */
export const statutoryAuthority: { jurisdiction: string; instrument: string; since: string }[] = [];

export const accreditationPurpose = [
  'Promote excellence in theological and Christian higher education.',
  'Strengthen institutional governance and academic administration.',
  'Improve curriculum quality and learning outcomes.',
  'Encourage continuous institutional development.',
  'Enhance public confidence in Christian educational institutions.',
  'Facilitate academic collaboration and credit recognition.',
  'Support institutions in achieving international standards of higher education.',
];

export const eligibleInstitutions = [
  'Bible colleges',
  'Bible schools',
  'Theological seminaries',
  'Schools of ministry',
  'Christian leadership institutes',
  'Missionary training centres',
  'Christian universities and colleges',
  'Church-based ministerial training programmes',
  'Distance-learning theological institutions',
];

export const accreditationServices: { name: string; what: string }[] = [
  {
    name: 'Institutional accreditation',
    what: 'A comprehensive evaluation of governance, academic programmes, faculty, administration, student services, financial sustainability and quality assurance systems.',
  },
  {
    name: 'Programme accreditation',
    what: 'Evaluation and recognition of individual academic programmes against accepted academic and professional standards.',
  },
  {
    name: 'Curriculum development',
    what: 'Professional assistance in designing, reviewing and modernising theological and ministry curricula to contemporary educational standards.',
  },
  {
    name: 'Academic quality assurance',
    what: 'Development of internal quality assurance systems, academic regulations, assessment policies, examination procedures and programme review mechanisms.',
  },
  {
    name: 'Faculty development',
    what: 'Strengthening academic staff through training, mentorship, research development and professional capacity building.',
  },
  {
    name: 'Institutional consultancy',
    what: 'Advisory services across strategic planning, governance, academic policy, university administration, digital learning and institutional growth.',
  },
];

export const accreditationStandards = [
  'Institutional governance',
  'Academic leadership',
  'Faculty qualifications',
  'Curriculum quality',
  'Teaching and learning',
  'Student assessment',
  'Academic integrity',
  'Research and scholarship',
  'Library and learning resources',
  'Information technology infrastructure',
  'Financial management',
  'Student support services',
  'Quality assurance systems',
  'Ethical and professional standards',
];

export const accreditationProcess: { step: string; title: string; what: string }[] = [
  { step: '1', title: 'Application', what: 'The institution submits a formal application with the required supporting documentation.' },
  { step: '2', title: 'Preliminary review', what: 'The Office of Accreditation conducts an initial review to determine eligibility.' },
  { step: '3', title: 'Institutional self-assessment', what: 'The applicant completes a self-study demonstrating compliance with the standards.' },
  { step: '4', title: 'External evaluation', what: 'A review team evaluates the institution through document analysis, interviews and, where appropriate, an on-site or virtual review.' },
  { step: '5', title: 'Decision', what: 'The Accreditation Council reviews the evaluation report and determines the appropriate status.' },
  { step: '6', title: 'Continuous improvement', what: 'Accredited institutions submit periodic reports and take part in ongoing quality assurance and development.' },
];

export const accreditationBenefits = [
  'Recognition as an accredited academic partner of ICOF Global University.',
  'Enhanced institutional credibility and public confidence.',
  'Access to curriculum development resources.',
  'Academic guidance and quality assurance support.',
  'Faculty development opportunities.',
  'Participation in collaborative research and conferences.',
  'Opportunities for student and faculty exchange.',
  'Pathways for academic progression and credit recognition.',
  'Inclusion within the university’s international academic network.',
];

export const independenceUnaffected = [
  'ownership',
  'governance structure',
  'denominational affiliation',
  'doctrinal position',
  'internal ministry practices',
];

export const ACCREDITATION_EMAIL = 'accreditation@iguc.net';
