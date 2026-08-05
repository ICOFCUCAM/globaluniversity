// ---------------------------------------------------------------------------
// The student lifecycle, and the workflows that move a record along it.
//
// THE PRINCIPLE THIS FILE EXISTS TO HOLD: every step updates the same student
// record. Nothing is duplicated.
//
// That single sentence is the whole architecture. It is also the thing that
// quietly stops being true in almost every university system, and it stops
// being true the same way each time — an office finds the master record does
// not hold a field it needs, so it keeps a spreadsheet, and six months later
// two systems disagree about who is enrolled. The defence is not discipline.
// It is that every stage below names the ONE record it writes to, and that
// there is nowhere else for an office to write.
//
// A workflow here is declarative on purpose. `gradeApproval` and
// `graduationAudit` describe who acts, what is checked and what may not be
// skipped, without saying how any screen looks. A developer implementing the
// Examination Office reads the chain from here rather than inferring it from a
// diagram, and an auditor can compare what ran against what was specified.
// ---------------------------------------------------------------------------

import type { UserRole } from './types';
import type { Capability } from './roles';

// --- The lifecycle ---------------------------------------------------------

export interface LifecycleStage {
  n: number;
  key: string;
  label: string;
  /** The office that owns the record at this point. */
  owner: string;
  /** What changes on the master record here. */
  writes: string;
  /** True where the person is not yet, or no longer, an enrolled student. */
  outsideEnrolment?: boolean;
}

export const lifecycle: LifecycleStage[] = [
  { n: 1, key: 'prospective', label: 'Prospective student', owner: 'Admissions Office', writes: 'Nothing yet — an enquiry, not a record.', outsideEnrolment: true },
  { n: 2, key: 'application', label: 'Application', owner: 'Admissions Office', writes: 'The master record is created. Every later stage writes to this same row.', outsideEnrolment: true },
  { n: 3, key: 'payment', label: 'Payment', owner: 'Applicant', writes: 'Payment reference, amount and currency.', outsideEnrolment: true },
  { n: 4, key: 'finance-verification', label: 'Finance verification', owner: 'Finance Office', writes: 'Payment status → verified. This is the gate.', outsideEnrolment: true },
  { n: 5, key: 'registrar-review', label: 'Registrar review', owner: 'Office of the Registrar', writes: 'Decision, decision reason, and any conditions attached.', outsideEnrolment: true },
  { n: 6, key: 'admission', label: 'Admission', owner: 'Office of the Registrar', writes: 'Student number, account, programme, faculty, department, adviser.' },
  { n: 7, key: 'student', label: 'Student', owner: 'Faculty and Department', writes: 'Enrolment status, tutor group, orientation.' },
  { n: 8, key: 'registration', label: 'Course registration', owner: 'Student, checked by the ERP', writes: 'Registered courses for the semester.' },
  { n: 9, key: 'learning', label: 'Learning', owner: 'Lecturer', writes: 'Attendance, assignment submissions, coursework marks.' },
  { n: 10, key: 'assessment', label: 'Assessment', owner: 'Examination Office', writes: 'Grades, once moderated and approved through the chain.' },
  { n: 11, key: 'graduation', label: 'Graduation', owner: 'Senate, on the Registrar’s audit', writes: 'Award, classification, graduation date.' },
  { n: 12, key: 'alumni', label: 'Alumnus', owner: 'Alumni Office', writes: 'Employment, membership, giving. The same record, with a different view.', outsideEnrolment: true },
  { n: 13, key: 'postgraduate', label: 'Postgraduate recruitment', owner: 'Admissions Office', writes: 'A new application against the same person, not a new person.', outsideEnrolment: true },
];

// --- Admission decisions ---------------------------------------------------

/**
 * The Registrar's four outcomes. Conditional admission is the one that carries
 * real weight: the student is admitted and studying, and the conditions stay
 * attached and visible until they are discharged. A condition recorded in an
 * email instead of on the record is a condition nobody will enforce.
 */
export type AdmissionDecision = 'full' | 'conditional' | 'deferred' | 'rejected';

export interface DecisionMeta {
  key: AdmissionDecision;
  label: string;
  createsAccount: boolean;
  description: string;
}

export const admissionDecisions: DecisionMeta[] = [
  {
    key: 'full',
    label: 'Full admission',
    createsAccount: true,
    description: 'Admitted with nothing outstanding. The account is created and the welcome email sent.',
  },
  {
    key: 'conditional',
    label: 'Conditional admission',
    createsAccount: true,
    description:
      'Admitted, and studying, with named conditions that must be met by a stated date. The account is created; the conditions stay on the record and stay visible to the student, the adviser and the Registrar until each is discharged.',
  },
  {
    key: 'deferred',
    label: 'Deferred admission',
    createsAccount: false,
    description: 'Admission held over to a later intake. No account is created yet.',
  },
  {
    key: 'rejected',
    label: 'Rejected',
    createsAccount: false,
    description: 'Not admitted. A reason is always recorded and sent.',
  },
];

export interface AdmissionCondition {
  /** What the student must do. */
  requirement: string;
  /** ISO date by which it must be done. */
  dueBy: string;
  discharged?: boolean;
  dischargedAt?: string;
  dischargedBy?: string;
}

/** Conditions commonly attached, offered as a starting point rather than a fixed list. */
export const commonConditions = [
  'Submit the final certificate',
  'Pay the first semester fees',
  'Complete the English proficiency requirement',
  'Provide a certified transcript from the previous institution',
  'Provide a valid passport or national identity document',
];

// --- Approval chains -------------------------------------------------------

export interface WorkflowStep {
  n: number;
  actor: string;
  role: UserRole;
  capability?: Capability;
  action: string;
  /** What must be true before this step may run. */
  requires?: string[];
  /** Set where a step may not be skipped even by an administrator. */
  mandatory: boolean;
}

export interface Workflow {
  key: string;
  title: string;
  purpose: string;
  steps: WorkflowStep[];
  /** Everything the workflow writes, so nothing is written twice elsewhere. */
  writes: string[];
  notes?: string[];
}

export const gradeApproval: Workflow = {
  key: 'grade-approval',
  title: 'Grade approval',
  purpose:
    'A mark becomes a result only after it has passed moderation and three approvals. Every action is timestamped and attributed.',
  steps: [
    { n: 1, actor: 'Lecturer', role: 'lecturer', capability: 'upload-grades', action: 'Submits marks for the courses they teach.', requires: ['The lecturer is allocated to the course'], mandatory: true },
    { n: 2, actor: 'Head of Department', role: 'hod', capability: 'monitor-teaching', action: 'Moderates the marks.', requires: ['All marks for the course are submitted'], mandatory: true },
    { n: 3, actor: 'Dean', role: 'dean', capability: 'monitor-progress', action: 'Approves the moderated marks for the faculty.', mandatory: true },
    { n: 4, actor: 'Registrar', role: 'registrar', capability: 'create-student-record', action: 'Approves for publication and writes the result to the academic record.', mandatory: true },
    { n: 5, actor: 'System', role: 'admin', action: 'Publishes results to students and recalculates GPA.', mandatory: true },
  ],
  writes: ['Course result', 'Semester GPA', 'Cumulative GPA', 'Audit entry per step'],
  notes: [
    'No step may be skipped, including by an administrator. A result published without moderation is a result the university cannot defend on appeal.',
    'A lecturer may not alter a mark after step 2 without the chain being restarted, and the restart is itself recorded.',
  ],
};

export const graduationAudit: Workflow = {
  key: 'graduation',
  title: 'Graduation',
  purpose:
    'The degree audit is run by the system, not assembled by hand. Three clearances and three approvals stand between completing the credits and being awarded.',
  steps: [
    { n: 1, actor: 'System', role: 'admin', action: 'Runs the degree audit: every required course passed, credit total met, residency met.', mandatory: true },
    { n: 2, actor: 'Finance', role: 'finance', capability: 'manage-student-accounts', action: 'Financial clearance — no outstanding fees.', mandatory: true },
    { n: 3, actor: 'Library', role: 'library-staff', capability: 'manage-library', action: 'Library clearance — nothing on loan, no fines outstanding.', mandatory: true },
    { n: 4, actor: 'Department', role: 'hod', capability: 'department-reports', action: 'Departmental approval.', mandatory: true },
    { n: 5, actor: 'Faculty', role: 'dean', capability: 'monitor-progress', action: 'Faculty approval.', mandatory: true },
    { n: 6, actor: 'Senate', role: 'vice-chancellor', action: 'Senate approval. The award is conferred here and nowhere else.', mandatory: true },
    { n: 7, actor: 'System', role: 'admin', action: 'Adds to the graduation list; issues certificate and transcript; converts the portal to the alumni view.', mandatory: true },
  ],
  writes: ['Award and classification', 'Graduation date', 'Certificate record', 'Transcript record', 'Alumni record'],
  notes: [
    'Classification cannot be computed until the Academic Board adopts the classification bands. Until then the audit can confirm completion but not the class of the award.',
    'The student record is not copied into an alumni record — the same record changes view. That is what keeps a transcript request from an alumnus resolving against the same history the university graded.',
  ],
};

export const courseRegistration: Workflow = {
  key: 'course-registration',
  title: 'Course registration',
  purpose:
    'The student clicks once. The system already knows their faculty, programme, department, level and semester, and checks the rules before accepting.',
  steps: [
    { n: 1, actor: 'Student', role: 'student', capability: 'register-courses', action: 'Requests registration for the semester.', mandatory: true },
    { n: 2, actor: 'System', role: 'admin', action: 'Checks programme and level to build the eligible course list.', mandatory: true },
    { n: 3, actor: 'System', role: 'admin', action: 'Checks prerequisites for each course.', requires: ['Prerequisites are recorded against courses'], mandatory: true },
    { n: 4, actor: 'System', role: 'admin', action: 'Checks outstanding fees and any financial hold.', requires: ['Finance holds a ledger per student'], mandatory: true },
    { n: 5, actor: 'System', role: 'admin', action: 'Checks the maximum credit load for the level.', mandatory: true },
    { n: 6, actor: 'System', role: 'admin', action: 'Registers the courses and notifies each lecturer.', mandatory: true },
  ],
  writes: ['Enrolment rows for the semester', 'Lecturer class list'],
  notes: [
    'Steps 3 and 4 cannot run yet: no course carries prerequisites and Finance holds no per-student ledger. Both are recorded against the modules that must supply them.',
    'Registration is approved automatically when every check passes. An approval queue here would add delay without adding a decision anyone actually makes.',
  ],
};

export const workflows: Workflow[] = [gradeApproval, graduationAudit, courseRegistration];

// --- Offices ---------------------------------------------------------------

export interface Office {
  n: number;
  name: string;
  controls: string;
  responsibilities: string[];
  dashboard: string[];
  /** What this office explicitly may not do. */
  cannot: string[];
  roles: UserRole[];
}

export const offices: Office[] = [
  {
    n: 1,
    name: 'Admissions Office',
    controls: 'Attracting and processing applicants.',
    responsibilities: [
      'Receive applications',
      'Verify completeness',
      'Communicate with applicants',
      'Forward paid applications to Finance',
      'Produce admission statistics',
    ],
    dashboard: [
      'New applications',
      'Draft applications',
      'Incomplete applications',
      'Applications by country',
      'Applications by faculty',
      'Applications by intake',
      'Conversion rate, application to admission',
    ],
    cannot: ['Decide an application', 'Verify a payment'],
    roles: ['admissions-officer'],
  },
  {
    n: 2,
    name: 'Finance Department',
    controls: 'Money. Not admissions.',
    responsibilities: [
      'Verify application fees',
      'Process tuition payments',
      'Manage invoices',
      'Administer scholarships',
      'Process refunds',
      'Financial reports',
    ],
    dashboard: [
      'Today’s payments',
      'Pending verification',
      'Verified payments',
      'Failed payments',
      'Refund requests',
      'Outstanding fees',
      'Revenue',
    ],
    cannot: ['Admit a student', 'Alter an academic record'],
    roles: ['finance', 'finance-director'],
  },
  {
    n: 3,
    name: 'Office of the Registrar',
    controls: 'Academic records.',
    responsibilities: [
      'Review academic qualifications',
      'Verify uploaded documents',
      'Approve admissions',
      'Create student records',
      'Manage enrolment',
      'Issue transcripts',
      'Approve graduation',
    ],
    dashboard: [
      'Pending reviews',
      'Approved today',
      'Rejected',
      'Deferred',
      'Conditional admissions',
      'International students',
      'Transfer students',
    ],
    cannot: ['Edit a payment', 'Verify a fee'],
    roles: ['registrar'],
  },
  {
    n: 4,
    name: 'Faculty Office',
    controls: 'The faculty’s students, once they exist.',
    responsibilities: [
      'See new students arriving in the faculty',
      'Approve transfers',
      'Monitor academic progress',
      'Faculty reporting',
    ],
    dashboard: ['New students', 'By department and programme', 'Advisers assigned', 'Progress and retention'],
    cannot: ['Create a student — the ERP has already done it'],
    roles: ['dean'],
  },
  {
    n: 5,
    name: 'Department',
    controls: 'Teaching allocation and the student’s first contacts.',
    responsibilities: [
      'Receive notification of a new student on a programme',
      'Assign an academic adviser',
      'Assign a tutor group',
      'Assign an orientation session',
      'Allocate lecturers to courses',
    ],
    dashboard: ['New students awaiting an adviser', 'Course allocation', 'Teaching load', 'Research outputs'],
    cannot: ['Admit a student', 'Publish a result without moderation'],
    roles: ['hod', 'programme-coordinator'],
  },
  {
    n: 6,
    name: 'Academic Adviser',
    controls: 'The student’s academic progress. The first academic contact.',
    responsibilities: [
      'Advise on course selection',
      'Monitor grades and attendance',
      'Watch graduation progress',
      'Refer to support services',
    ],
    dashboard: ['Advisees', 'Grades', 'Attendance', 'Financial holds — read only', 'Course registration', 'Graduation progress'],
    cannot: [
      'Alter a fee or clear a financial hold — the adviser sees holds so they can advise around them, and changing one is Finance’s act',
      'Alter a grade',
    ],
    roles: ['lecturer'],
  },
  {
    n: 7,
    name: 'ICT Services',
    controls: 'The system itself.',
    responsibilities: [
      'Accounts and access',
      'Availability and backup',
      'Audit logging',
      'Data protection',
      'Integration between modules',
    ],
    dashboard: ['Uptime', 'Failed logins', 'Audit volume', 'Integration failures'],
    cannot: [
      'Make an academic or financial decision. Administrative access is not authority, and every use of it is logged.',
    ],
    roles: ['admin'],
  },
];
