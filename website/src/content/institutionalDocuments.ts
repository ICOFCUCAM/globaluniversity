// ---------------------------------------------------------------------------
// Institutional documents register.
//
// The university set out fifteen documents an established institution is
// expected to hold, and a development order for producing them. This file is
// that register, kept as data so the hub page at /documents shows real status
// rather than a static wish list, and so each document can be linked the day
// it exists.
//
// THE STATUS FIELD IS THE POINT. An accreditation body, a partner university
// and a prospective student are all better served by a register that says
// plainly what exists and what does not than by a set of impressive-looking
// documents whose contents were invented. Three states:
//
//   published  the document exists on this site and is complete enough to read
//   partial    it exists, and names inside it the sections still to be adopted
//   awaiting   not written, because writing it would mean inventing policy
//
// WHAT CANNOT BE DRAFTED HERE. Statutes, degree classifications, examination
// regulations, assessment moderation, degree award powers and financial
// governance are instruments of governance. They take legal effect when a
// Senate, Academic Board or Board of Trustees adopts them. Drafting plausible
// text for any of these and publishing it would misrepresent the university's
// own rules to the people most entitled to rely on them — students facing an
// examination board, and the Ministry. Each is registered here with the body
// that must adopt it, and left for that body.
// ---------------------------------------------------------------------------

export type DocumentStatus = 'published' | 'partial' | 'awaiting';

export interface InstitutionalDocument {
  /** Position in the university's own recommended development order. */
  order: number;
  title: string;
  /** Route, once the document exists on the site. */
  href?: string;
  /** One line: what the document is for and who reads it. */
  purpose: string;
  status: DocumentStatus;
  /** The sections the university specified for this document. */
  contains: string[];
  /** What must come from the university before this can be completed. */
  needs?: string[];
  /** Which body must adopt it, where adoption is what is missing. */
  adoptedBy?: string;
}

export const institutionalDocuments: InstitutionalDocument[] = [
  {
    order: 1,
    title: 'Academic Catalog',
    href: '/academic-catalog',
    purpose:
      'The university’s official academic handbook — the single document a student downloads before applying, and the first document an accreditation body asks for.',
    status: 'partial',
    contains: [
      'Welcome from the Chancellor',
      'Welcome from the Vice Chancellor',
      'University History',
      'Vision, Mission and Core Values',
      'Governance Structure',
      'Faculties and Schools',
      'Academic Calendar',
      'Admission Requirements',
      'Tuition & Fees',
      'Scholarships',
      'Student Regulations',
      'Examination Regulations',
      'Graduation Requirements',
      'Degree Classifications',
      'Academic Integrity Policy',
      'Research Ethics',
      'Student Services, Library and ICT',
      'Quality Assurance',
      'All programmes and course descriptions',
    ],
    needs: [
      'Academic calendar — term dates, registration windows, examination periods',
      'Examination regulations — entry, conduct, absence, resit and appeal',
      'Graduation requirements — credit minimums and residency by award',
      'Degree classifications — the grade bands and their names',
      'Research ethics procedure and the committee that approves applications',
      'Library and ICT service descriptions',
      'Quality assurance framework',
    ],
    adoptedBy: 'Academic Board / Senate',
  },
  {
    order: 2,
    title: 'Programme Handbooks',
    purpose:
      'One handbook per award — the document a registered student works from all year. Diploma, Bachelor’s, Master’s and Doctoral.',
    status: 'partial',
    contains: [
      'Programme aims and outcomes',
      'Course descriptions with credit values',
      'Assessment scheme and weightings',
      'Progression and award rules',
      'Reading lists',
      'Placement and practicum requirements',
    ],
    needs: [
      'Course lists, credit values and durations for the eleven awards written up in 2026 — see docs/FACULTY-PAGES.md',
      'Assessment weightings per course',
    ],
  },
  {
    order: 3,
    title: 'University Prospectus',
    href: '/prospectus',
    purpose:
      'The recruitment publication — designed to be read online or printed and kept.',
    status: 'partial',
    contains: [
      'Why ICOF?',
      'Campuses',
      'Online Learning',
      'Faculties',
      'Degree Programmes',
      'Student Life',
      'Accommodation',
      'International Students',
      'Admissions',
      'Scholarships',
      'Alumni',
      'Research',
      'Contact Information',
    ],
    needs: [
      'Accommodation detail beyond the monthly rent already published',
      'Alumni profiles the university is willing to name',
      'Current photography for print resolution',
    ],
  },
  {
    order: 4,
    title: 'Student Handbook',
    href: '/student-handbook',
    purpose: 'What a student may expect of the university, and what it expects of them.',
    status: 'partial',
    contains: [
      'Student Rights',
      'Student Responsibilities',
      'Code of Conduct',
      'Attendance Policy',
      'Academic Misconduct',
      'Dress Code',
      'Student Government',
      'Clubs & Societies',
      'Complaint Procedures',
      'Graduation Process',
    ],
    needs: [
      'Attendance policy — minimum attendance and the consequence of falling below it',
      'Whether a dress code applies, and its terms',
      'Whether a student government exists, and its constitution',
      'Complaint procedure — stages, timescales and who hears an appeal',
    ],
    adoptedBy: 'Academic Board',
  },
  {
    order: 5,
    title: 'Quality Assurance Manual',
    purpose:
      'How the university assures the standard of its awards. The document an accreditation body reads most closely.',
    status: 'awaiting',
    contains: [
      'Academic Standards',
      'Programme Approval',
      'Course Review',
      'External Examiners',
      'Student Evaluation',
      'Lecturer Evaluation',
      'Curriculum Review',
      'Graduate Attributes',
      'Assessment Moderation',
      'Continuous Improvement',
    ],
    needs: [
      'The approval route a new programme actually follows, and who signs it off',
      'Whether external examiners are appointed, and their terms of reference',
      'Review cycle length for courses and curricula',
    ],
    adoptedBy: 'Senate / Quality Assurance Committee',
  },
  {
    order: 6,
    title: 'Graduate School Handbook',
    href: '/graduate-school-handbook',
    purpose: 'The rules of research degree study, for Master’s and doctoral candidates.',
    status: 'partial',
    contains: [
      'Admission',
      'Coursework',
      'Thesis Proposal',
      'Research Methods',
      'Supervisor Responsibilities',
      'Viva Voce',
      'Thesis Formatting',
      'Graduation Requirements',
    ],
    needs: [
      'Supervisor responsibilities and the supervision record expected',
      'Viva voce procedure — panel composition and possible outcomes',
      'Thesis formatting standard and word limits by award',
    ],
  },
  {
    order: 7,
    title: 'Research Handbook',
    purpose: 'The university’s research standards, including its position on generative AI.',
    status: 'awaiting',
    contains: [
      'Research Philosophy',
      'Ethics Approval',
      'Thesis Guidelines',
      'Citation Standards',
      'Publication Policy',
      'Plagiarism Policy',
      'AI Use Policy',
      'Open Access Policy',
      'Intellectual Property',
    ],
    needs: [
      'Which citation standard the university requires, by faculty',
      'The ethics approval route and the committee that grants it',
      'The university’s position on generative AI in assessed work',
      'Who owns intellectual property created by staff and by students',
    ],
    adoptedBy: 'Senate / Research Ethics Committee',
  },
  {
    order: 8,
    title: 'University Statutes',
    purpose:
      'The governing instrument — the document from which every other authority in the university derives.',
    status: 'awaiting',
    contains: [
      'Chancellor',
      'Board of Trustees',
      'University Senate',
      'Academic Board',
      'Faculties',
      'Schools',
      'Appointment Procedures',
      'Financial Governance',
      'Degree Award Powers',
    ],
    needs: [
      'The statutes as adopted. These cannot be drafted here: they are a legal instrument, and their authority comes from the Board of Trustees adopting them, not from their wording.',
    ],
    adoptedBy: 'Board of Trustees',
  },
  {
    order: 9,
    title: 'Strategic Plan 2026–2035',
    purpose: 'Where the university intends to be in ten years, and how it will get there.',
    status: 'awaiting',
    contains: [
      'Vision',
      'Growth Targets',
      'New Campuses',
      'Online Expansion',
      'Research Growth',
      'Digital University',
      'International Partnerships',
      'Financial Sustainability',
      'Community Impact',
      'Infrastructure Development',
    ],
    needs: [
      'Current enrolment, staffing and financial baselines — a growth target without a baseline is not a plan',
      'The university’s own targets. These are decisions, not drafting.',
    ],
    adoptedBy: 'Board of Trustees',
  },
  {
    order: 10,
    title: 'Policies and Procedures Manual',
    purpose: 'Every operational policy in one place, each with an owner and a review date.',
    status: 'partial',
    contains: [
      'Code of conduct and disciplinary process',
      'Due process and appeals',
      'Admissions policy',
      'Fees, refunds and financial hardship',
      'Data protection and student records',
      'Safeguarding',
      'Equality and non-discrimination',
    ],
    needs: [
      'Refund policy',
      'Data protection and records retention policy',
      'Safeguarding policy and the designated officer',
    ],
  },
  {
    order: 11,
    title: 'Research Journals',
    purpose:
      'Peer-reviewed journals published by the university, establishing it as a producer of scholarship rather than only a teacher of it.',
    status: 'awaiting',
    contains: [
      'ICOF Journal of Theology and Biblical Studies',
      'ICOF Journal of African Theology and Mission',
      'ICOF Journal of Education',
      'ICOF Journal of Business and Leadership',
      'ICOF Journal of Engineering and Technology',
      'ICOF Journal of Interdisciplinary Research',
    ],
    needs: [
      'An editor and an editorial board per journal — a journal is its board, not its title',
      'ISSN registration',
      'A peer review policy and a submission route',
    ],
  },
  {
    order: 12,
    title: 'ICOF University Press',
    purpose: 'The university’s publishing imprint for books, monographs and proceedings.',
    status: 'awaiting',
    contains: [
      'Textbooks',
      'Academic Journals',
      'Monographs',
      'Conference Proceedings',
      'Student Research',
      'Faculty Books',
    ],
    needs: ['A director, an imprint name registration and an ISBN prefix'],
  },
  {
    order: 13,
    title: 'Research Centres',
    purpose:
      'Named centres giving the university’s research a public profile and a home for postgraduate supervision.',
    status: 'awaiting',
    contains: [
      'Faculty of Theology — eight proposed centres',
      'Faculty of Education — four proposed centres',
      'Engineering & Technology — five proposed centres',
      'Business — four proposed centres',
    ],
    needs: [
      'Confirmation that each centre exists, and who directs it. Twenty-one centre names were proposed; a centre with no director and no researchers is a heading, and publishing it as though it were a research unit would not survive scrutiny.',
    ],
  },
  {
    order: 14,
    title: 'International Office',
    purpose: 'A single office owning international admissions, exchange and partnerships.',
    status: 'awaiting',
    contains: [
      'International Admissions',
      'Student Exchange',
      'Faculty Exchange',
      'Visiting Scholars',
      'Joint Degrees',
      'Erasmus-style Partnerships',
      'Visa Support',
      'Global Recruitment',
    ],
    needs: [
      'The officer responsible and a contact address',
      'Existing partner institutions, if any — an exchange page with no partners deters the applicants it is meant to attract',
    ],
  },
  {
    // Distinct from the programme handbooks at 2: that set is one handbook per
    // award, this is one per faculty, and only this one carries the chapel and
    // practicum requirements.
    order: 15,
    title: 'Faculty Handbooks',
    href: '/faculty/theology-buea/handbook',
    purpose: 'One handbook per faculty, covering what is common to all its awards. Five published.',
    status: 'partial',
    contains: [
      'Dean’s Welcome',
      'Faculty History',
      'Academic Calendar',
      'Programmes',
      'Course Descriptions',
      'Practicum',
      'Ministry Requirements',
      'Chapel Requirements',
      'Research Expectations',
      'Graduation Requirements',
    ],
    needs: [
      'Practicum hours and how placements are approved and supervised',
      'Ministry requirements — what a theology student must do outside class to qualify',
      'Chapel requirements — whether attendance is compulsory, and how it is recorded',
      'Faculty history and founding dates',
    ],
  },
  {
    order: 16,
    title: 'Digital Campus',
    href: '/portal',
    purpose: 'The online platform through which a distance student experiences the university.',
    status: 'partial',
    contains: [
      'Learning Management System (LMS)',
      'Online Library',
      'Student Portal',
      'Faculty Portal',
      'Research Repository',
      'Digital Transcripts',
      'Degree Verification',
      'AI Academic Assistant',
      'Online Examinations',
      'Alumni Portal',
    ],
    needs: [
      'Online library — a catalogue or a subscription the university actually holds',
      'Research repository — where theses are deposited',
      'A decision on whether an AI academic assistant is wanted, and on what terms',
    ],
  },
  {
    order: 17,
    title: 'Alumni Association',
    purpose: 'A constituted alumni body, with officers and a programme.',
    status: 'partial',
    contains: [
      'Career Networking',
      'Mentoring',
      'Continuing Education',
      'Annual Alumni Conference',
      'Alumni Awards',
      'Fundraising',
      'Student Scholarships',
    ],
    needs: ['A constitution and named officers', 'Whether the annual conference has been held'],
  },
];

/**
 * Readable now — a document with a route, whatever its status. This is the
 * figure a visitor actually wants: `published` counts nothing today, because
 * every document that exists still names sections awaiting adoption, and a
 * stat band reading "0 published" would misdescribe work that is on the site
 * and can be read this minute.
 */
export const availableCount = institutionalDocuments.filter((d) => d.href).length;
export const partialCount = institutionalDocuments.filter((d) => d.status === 'partial').length;
export const awaitingCount = institutionalDocuments.filter((d) => d.status === 'awaiting').length;
