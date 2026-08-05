// ---------------------------------------------------------------------------
// Academic regulations — grading, assessment, progression, fees and refunds.
//
// SOURCE. Everything in this file was supplied by the university: the grading
// scale and special grades from its published grading system, and the course
// loads, seminar requirements, doctoral entry standard, fee terms, withdrawal
// rules and refund schedule from its Student Fees Guide. Figures are
// reproduced exactly. Where the source is internally inconsistent or plainly
// carries an error, the error is recorded in a note rather than silently
// corrected — see `sourceNotes` at the foot of this file.
//
// WHY THIS MATTERS MORE THAN IT LOOKS. A grading scale and a refund schedule
// are the two things a student is most likely to need to rely on in a dispute,
// and the two an accreditation reviewer checks first for internal consistency.
// They are published here verbatim so that what the university operates and
// what the university publishes are the same document.
// ---------------------------------------------------------------------------

export interface GradeBand {
  grade: string;
  descriptor: string;
  range: string;
  points: string;
}

/** The university's grading scale, exactly as published. */
export const gradeScale: GradeBand[] = [
  { grade: 'A', descriptor: 'Excellent', range: '94–100%', points: '4.00' },
  { grade: 'A-', descriptor: 'Very Good', range: '91–93%', points: '3.33' },
  { grade: 'B+', descriptor: 'Good', range: '89–90%', points: '3.00' },
  { grade: 'B', descriptor: 'Above Average', range: '85–88%', points: '2.67' },
  { grade: 'B-', descriptor: 'Average', range: '81–84%', points: '2.33' },
  { grade: 'C+', descriptor: 'Satisfactory', range: '77–80%', points: '2.00' },
  { grade: 'C', descriptor: 'Satisfactory', range: '73–76%', points: '1.67' },
  { grade: 'C-', descriptor: 'Below Satisfactory', range: '70–72%', points: '1.33' },
  { grade: 'D+', descriptor: 'Pass', range: '67–69%', points: '1.00' },
  { grade: 'D', descriptor: 'Pass', range: '65–66%', points: '0.67' },
  { grade: 'F', descriptor: 'Fail', range: '0–64%', points: '0.00' },
];

/** The lowest mark that earns credit, read off the scale above. */
export const passMark = '65%';

export const specialGrades: { code: string; meaning: string }[] = [
  { code: 'W', meaning: 'Withdrawal — the student has officially withdrawn from the course.' },
  { code: 'WA', meaning: 'Withdrawal with Approval — withdrawal approved by the administration.' },
  { code: 'WC', meaning: 'Withdrawal with Course — withdrawal with course-related considerations.' },
  { code: 'I', meaning: 'Incomplete — course requirements were not completed by the end of the semester.' },
  { code: 'NG', meaning: 'No Grade — a grade has not yet been assigned.' },
  { code: 'NC', meaning: 'No Credit — no credit has been awarded for the course.' },
];

export const courseClassification: { code: string; name: string; meaning: string }[] = [
  { code: 'C', name: 'Compulsory', meaning: 'Mandatory for all students, and required to fulfil the degree.' },
  { code: 'E', name: 'Elective', meaning: 'Optional, chosen according to interest and career direction.' },
  { code: 'R', name: 'Required', meaning: 'Required for a specific programme or major within the university.' },
];

export const gpaRule =
  'The Grade Point Average is calculated by dividing the total grade points earned by the total credit hours attempted. It is reported for a semester and cumulatively for the whole programme.';

/** Study load, seminar attendance and entry standards, by level of award. */
export interface LoadRule {
  level: string;
  load: string;
  structure?: string;
  entry?: string;
  seminars?: string;
}

export const loadRules: LoadRule[] = [
  {
    level: 'Certificate',
    load: 'Minimum 10 and maximum 12 subjects per year.',
  },
  {
    level: 'Ordinary Diploma',
    load: 'Minimum 10 and maximum 12 subjects per year.',
  },
  {
    level: 'Bachelor’s Degree (distance learning)',
    load: 'Minimum 10 and maximum 12 subjects per year.',
  },
  {
    level: 'Bachelor’s Honours Degree (distance learning)',
    load: 'One full academic year, to a maximum of eight subjects.',
    structure: 'Coursework based.',
    entry:
      'A three-year Bachelor’s degree, or a diploma with sufficient experience. Honours provision is limited to specific areas of study and is not available for every programme.',
  },
  {
    level: 'Master’s Degree',
    load: 'Coursework and dissertation combined; a small number of degrees may be taken by thesis only.',
    structure: 'MBA applicants additionally complete a Business Project.',
    seminars: 'Two seminars must be attended during the year, each of five days at the campus.',
  },
  {
    level: 'Doctorate and Ph.D.',
    load: 'Mostly by dissertation, with the exception of a few doctorates in the business sciences.',
    entry:
      'An average of 68% or a GPA of 3.25 on a 4.00 scale at Master’s level, in any field. A Research Methods course in the candidate’s field is a prerequisite; candidates without one must complete it before applying.',
    seminars:
      'Four doctoral seminars of one week each, spread across the academic year. Eight doctoral seminars in total are required for the award.',
  },
];

/** Doctoral fields the university states it offers. */
export const doctoralFields = {
  phdAndThD: ['Theology', 'Management', 'Leadership and Administration', 'Counseling and Family Therapy'],
  dMin: ['Practical Theology', 'Divinity'],
};

/** Standard assessment weightings, as published on the programme syllabi. */
export interface AssessmentScheme {
  applies: string;
  components: { name: string; weight: string }[];
}

export const assessmentSchemes: AssessmentScheme[] = [
  {
    applies: 'Diploma and undergraduate courses',
    components: [
      { name: 'Participation — engagement in class discussion and activities', weight: '20%' },
      { name: 'Assignments — written assignments and projects', weight: '30%' },
      { name: 'Examinations — midterm and final', weight: '30%' },
      { name: 'Presentations — preparation and delivery of oral presentations', weight: '20%' },
    ],
  },
  {
    applies: 'Master’s courses',
    components: [
      { name: 'Participation — class discussion and online forums', weight: '20%' },
      { name: 'Research paper — 5,000 words', weight: '30%' },
      { name: 'Presentations', weight: '20%' },
      { name: 'Final examination — comprehensive, covering all modules', weight: '30%' },
    ],
  },
  {
    applies: 'Thesis preparation and research methodology',
    components: [
      { name: 'Research proposal', weight: '40%' },
      { name: 'Research methodology assignment', weight: '30%' },
      { name: 'Final presentation', weight: '30%' },
    ],
  },
];


// --- Fee bands -------------------------------------------------------------
// The two currencies on this site are not an inconsistency: they are two fee
// bands. The university confirmed that the FCFA schedule is a subsidised rate,
// funded as scholarship, for students from Africa and the Global South, and
// that students from Europe and North America pay a higher rate approaching
// European levels.
//
// NOT SET HERE: the exact figures for the international band. The USD amounts
// already published on the tuition page are shown against it as the current
// figures, because they are the only international figures the university has
// published — but the university should confirm they are the international
// band rather than a general rate, and state the per-region schedule.

export interface FeeBand {
  name: string;
  appliesTo: string;
  basis: string;
  figures: string;
  confirmed: boolean;
}

export const feeBands: FeeBand[] = [
  {
    name: 'Africa and the Global South',
    appliesTo:
      'Students who are nationals of, or resident in, countries of Africa and the Global South.',
    basis:
      'A subsidised rate, funded as scholarship. The published FCFA schedule is this band: the university carries the difference so that cost is not what keeps a called student out of higher education.',
    figures:
      'The fee schedule in Part V of these regulations — registration, examination, certificate, transcript and development fees in FCFA — applies to this band.',
    confirmed: true,
  },
  {
    name: 'Europe and North America',
    appliesTo: 'Students who are nationals of, or resident in, Europe and North America.',
    basis:
      'A higher rate, set at approximately European levels and slightly below them. Students in this band are not subsidised, and their fees help fund the scholarship band above.',
    figures:
      'The tuition figures published on the Cost & Tuition page — full-time and part-time annual tuition quoted in US dollars — are the only international figures the university has published, and are shown against this band pending confirmation.',
    confirmed: false,
  },
];

export const feeBandNote =
  'Which band applies is determined by nationality and residence, not by mode of study. A student in either band studying online sits the same assessments and receives the same award.';

/** Fees payable in addition to tuition. */
export const miscellaneousFees: { item: string; amount: string; optional?: boolean }[] = [
  { item: 'Academic record (transcripts)', amount: '2,000 FCFA' },
  { item: 'Additional transcripts', amount: '2,500 FCFA', optional: true },
  { item: 'Late application fee', amount: '5,000 FCFA', optional: true },
  { item: 'Certificate fee', amount: '10,000 FCFA' },
  { item: 'Degree replacement', amount: '25,000 FCFA', optional: true },
  { item: 'Student ID card', amount: '2,000 FCFA' },
  { item: 'ID card replacement', amount: '3,000 FCFA', optional: true },
  { item: 'T-shirt', amount: '5,000 FCFA' },
  { item: 'Official wear batch', amount: '1,500 FCFA' },
  { item: 'Supplementary examinations', amount: '25,000 FCFA' },
  { item: 'Syllabus fee', amount: '5,000 FCFA', optional: true },
  { item: 'Thesis and dissertation fee', amount: '25,000 FCFA and above' },
  { item: 'Development fee', amount: '5,000 FCFA' },
];

export const miscellaneousFeesTotal = '50,500 FCFA';

export const paymentTerms: string[] = [
  'Every programme, undergraduate and postgraduate, requires an Acceptance of Place Fee, an Application Fee and a University Levy before a place is secured.',
  'On acceptance, a student pays 50% of the university fees as an initial deposit, together with the University Levy.',
  'Payment dates are published each semester on the student website and in the university bulletin, and must be honoured.',
  'Payment may be made in cash, by cheque, or by direct deposit into the university account.',
  'A late registration penalty of 10,000 FCFA applies to all late registrations. Registration dates are posted at all university communication centres; not having seen them does not remove the penalty.',
  'A bounced cheque must be made good in cash or by direct deposit, together with a penalty of 20% of its value.',
  'Fee statements are posted quarterly. Signing the Registration Form accepts responsibility for payment by the due date whether or not a statement has been received, and it is the student’s responsibility to keep the university informed of a correct address and to follow up unpaid amounts.',
  'A student carrying an outstanding balance from a previous year may not register until it is paid in full.',
  'A graduating student with outstanding fees will have a hold placed on transcripts, diplomas and degrees until those fees are paid in full.',
  'Surplus money is refunded on request, electronically to the student’s, parent’s or sponsor’s account. No cash or cheque refunds are made, and only one refund per month is considered.',
  'Fees are payable in full even where the academic programme is interrupted by events beyond the university’s control, including boycotts, civil unrest, political protest and violence, and natural disaster.',
  'A student or sponsor in breach of these terms is liable for legal costs the university incurs as a result.',
];

export const sponsorTerms: string[] = [
  'A sponsored student must obtain the Student Sponsorship Verification Form.',
  'Sponsors are liable for the payment commitments they make on a student’s behalf.',
  'Cheques are payable to ICOFGU within the agreed range of payment dates.',
  'A cheque that clears later than the fees payment deadline attracts a charge of 5,000 FCFA or USD $10.',
  'Sponsors must sign the declaration form for their student and are liable to meet the obligations it records.',
  'Meal plans may be purchased in advance through the Residence Office.',
];

/** The refund schedule, by time elapsed since enrolment. */
export const refundSchedule: { window: string; refund: string; covers: string }[] = [
  { window: 'Within 7 days of initial enrolment', refund: '100%', covers: 'Tuition fees, residence fees and book fees' },
  { window: 'After 7 days and within 14 days', refund: '75%', covers: 'Tuition and other fees' },
  { window: 'After 14 days and within 30 days', refund: '50%', covers: 'Tuition fees and other fees' },
  { window: 'After 30 days and within 90 days', refund: '25%', covers: 'All respective fees' },
  { window: 'After 90 days', refund: 'None', covers: '—' },
];

export const withdrawalRules: string[] = [
  'A student who wishes to withdraw must submit a Withdrawal Form and wait for clearance to be granted.',
  'All withdrawals are processed through the faculty responsible for the programme.',
  'A student who leaves without completing a Withdrawal Form remains liable for the fees due for the whole semester of study.',
  'The university is not obliged to refund fees to a student who withdraws after three months in the programme.',
];

export const scholarshipRules: string[] = [
  'Students may apply for bursaries, scholarships and funding in the second semester, subject to the availability of funds.',
  'Selection takes account of the student’s financial need, academic performance and individual character.',
  'Application forms must be obtained and all requirements submitted in good time.',
  'Students in financial difficulty may apply. Work scholarships may also be available to second-year students.',
];

// ---------------------------------------------------------------------------
// Errors and inconsistencies found in the source, recorded rather than fixed.
//
// These are rendered on /academic-regulations as an editorial note, not hidden
// in a comment, because a reader relying on the figures above is entitled to
// know which of them the university has yet to reconcile. Every one of these
// is a question for the university, and none has been resolved by guessing.
// ---------------------------------------------------------------------------
export const sourceNotes: { issue: string; detail: string }[] = [
  {
    issue: 'The Student Fees Guide is marked “Preliminary Copy”.',
    detail:
      'It is published here because it is the only fees policy the university has, and a preliminary policy a student can read beats a final one they cannot. It should be adopted formally and the marking removed.',
  },
  {
    issue: 'Section 1.9 of the Fees Guide is headed “Cost of Doctorates and PhDs at GRU UNIVERSITY”.',
    detail:
      'GRU University is not ICOF Global University. The section appears to have been adapted from another institution’s document and the name left in. The heading is not reproduced on this site; its content is, because it reads as ICOF’s own policy throughout the body. The university should confirm this.',
  },
  {
    issue: 'The special DBA fee is quoted as “450,000 (all inclusive) for the 1st academic year commencing 2016”.',
    detail:
      'The figure carries no currency and the year is long past. It is not published on this site until both are corrected.',
  },
  {
    issue: 'The two currencies are two fee bands — now stated, but only one is costed.',
    detail:
      'The university has confirmed that the FCFA schedule is a subsidised, scholarship-funded rate for students from Africa and the Global South, and that students from Europe and North America pay a higher rate approaching European levels. That resolves what looked like an inconsistency. What is still missing is the international band’s own schedule: the USD tuition already published is shown against it provisionally, and needs confirming or replacing.',
  },
  {
    issue: 'The grading scale has no 3.67 point.',
    detail:
      'The scale runs 4.00, 3.33, 3.00, 2.67, 2.33, 2.00, 1.67, 1.33, 1.00, 0.67, 0.00. It is internally consistent and is published exactly as supplied, but it differs from the common four-point scale, where A- is 3.67 and B is 3.00. This should be stated deliberately in the catalog so that a credential evaluator abroad does not read it as an error.',
  },
  {
    issue: 'B+ spans two percentage points.',
    detail:
      'B+ is 89–90% while neighbouring grades span three or four points each. No marks are lost between bands, so the scale is complete, but the narrowness is unusual and worth confirming.',
  },
  {
    issue: 'Degree classifications have not been supplied.',
    detail:
      'The grading scale gives per-course grades and a GPA. It does not say what final GPA earns a distinction, a merit, or a first, second or third class. This remains the single most important gap in the award regulations.',
  },
  {
    issue: 'Doctoral seminar totals do not reconcile.',
    detail:
      'The Fees Guide requires four doctoral seminars of one week each within an academic year, and eight in total for the award. Read together this implies exactly two years of seminars, which should be stated rather than inferred.',
  },
];
