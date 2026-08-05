// ---------------------------------------------------------------------------
// The university's role matrix, as code.
//
// The specification does not only say what each role CAN do — it says what each
// role CANNOT do, and the "cannot" lines carry the real weight:
//
//   Finance Administrator   cannot admit students
//   Registrar Administrator cannot edit payments
//
// That is a separation of duties. The officer who confirms the money is not the
// officer who confers the place, and neither can do the other's job. A matrix
// that only listed permissions would leave those two lines as prose in a
// document; here they are the absence of a capability, checked at the desk and
// again on the server.
//
// Read `can(role, capability)` as the single source of truth. Every guard in
// the admissions code goes through it rather than testing `role === 'admin'`,
// so adding a role is one entry in this table and nothing else.
// ---------------------------------------------------------------------------

import type { UserRole } from './types';

/** Order of the hierarchy, as the university states it. Index 0 is the top. */
export const HIERARCHY: UserRole[] = [
  'chancellor',
  'vice-chancellor',
  'registrar',
  'finance-director',
  'dean',
  'hod',
  'programme-coordinator',
  'lecturer',
  'finance',
  'admissions-officer',
  'library-staff',
  'student-affairs',
  'student',
  'applicant',
];

/**
 * Position in the hierarchy. Lower is more senior. 'superadmin' and 'admin' are
 * system roles outside the hierarchy and 'academic-office' predates it, so all
 * three return -1 and none is presented as ranking above or below an office of
 * the university. The Chancellor is not junior to the Superadministrator; they
 * are answerable for different things.
 */
export function rank(role: UserRole): number {
  return HIERARCHY.indexOf(role);
}

/**
 * The system roles, most privileged first. Custody of the system, as distinct
 * from office within the university.
 */
export const SYSTEM_ROLES: UserRole[] = ['superadmin', 'admin'];

export function isSystemRole(role: UserRole | undefined | null): boolean {
  return !!role && SYSTEM_ROLES.includes(role);
}

/**
 * Whether `actor` may act on `target`'s account — suspend it, reset its
 * password, change its role.
 *
 * Two rules, and both matter more than they look:
 *
 *   1. Only a system role may act on anyone. Seniority within the university is
 *      not custody of the system: a Dean does not suspend a lecturer here, the
 *      Superadministrator does, at the Dean's request and in the audit log.
 *   2. You may not act on your own rank or above. A Superadministrator cannot
 *      suspend another Superadministrator, and an administrator cannot touch
 *      one. Without this, two administrators can suspend each other and the
 *      faster click wins — governance decided by network latency.
 *
 * Acting on yourself is refused separately by the routes, so that nobody can
 * lock themselves out with one mis-click.
 */
export function canActOn(actor: UserRole | undefined | null, target: UserRole): boolean {
  if (!isSystemRole(actor)) return false;
  const a = SYSTEM_ROLES.indexOf(actor as UserRole);
  const t = SYSTEM_ROLES.indexOf(target);
  // Target is not a system role: any system role outranks it.
  if (t === -1) return true;
  // Target is a system role: the actor must be strictly more senior.
  return a < t;
}

/**
 * Everything the university's day-to-day work consists of. A role holds some
 * subset of this; `admin` holds all of it.
 */
export const OPERATIONAL_CAPABILITIES = [
  // Applicant
  'apply',
  'upload-documents',
  'track-application',
  // Finance
  'verify-payment',
  'approve-refund',
  'generate-invoice',
  'manage-student-accounts',
  // Registrar
  'admit-student',
  'reject-application',
  'request-documents',
  'assign-programme',
  'create-student-record',
  // Academic office
  'assign-lecturers',
  'build-timetable',
  'manage-courses',
  // Dean
  'view-admitted-students',
  'approve-transfers',
  'monitor-progress',
  // Lecturer
  'view-registered-students',
  'upload-grades',
  'take-attendance',
  // Executive
  'view-executive-dashboard',
  'view-all-faculties',
  'view-institutional-finance',
  // Department
  'assign-lecturers-to-courses',
  'approve-course-allocation',
  'monitor-teaching',
  'department-reports',
  // Admissions / library / student affairs
  'process-applications',
  'defer-admission',
  'transfer-programme',
  'manage-library',
  'manage-hostel',
  'manage-student-welfare',
  // Student
  'register-courses',
  'pay-fees',
  'view-results',
  'download-transcript',
  'message-lecturers',
  'access-lms',
] as const;

/**
 * System custody — the Superadministrator's alone.
 *
 * The test for membership here is not "is this powerful" but "does holding it
 * mean changing the rules rather than acting within them". An administrator who
 * can assign roles can make themselves anything, which ends every other line in
 * this file. One who can redesign a certificate can alter what the university
 * has already attested to. One who can suspend accounts can silence the officer
 * who would have objected. Each of these is a power over the system rather than
 * a power exercised through it, so each sits with the person who answers for
 * the system as a whole.
 *
 * These are absent from `admin`. That absence is the entire point: it is what
 * makes the Superadministrator a distinct office rather than a longer title.
 */
export const SYSTEM_CAPABILITIES = [
  // Who exists, and who may act
  'assign-roles',
  'create-staff-account',
  'suspend-account',
  'reinstate-account',
  'reset-user-password',
  'impersonate-user',
  // What the university's awards look like and whether they stand
  'design-credentials',
  'publish-credential-template',
  'revoke-credential',
  // The system itself
  'configure-system',
  'manage-academic-session',
  'maintenance-mode',
  'export-data',
] as const;

export type Capability =
  | typeof OPERATIONAL_CAPABILITIES[number]
  | typeof SYSTEM_CAPABILITIES[number];

/**
 * What each role may do. Anything absent is forbidden.
 *
 * `superadmin` is the only wildcard. `admin` used to be, and that was the flaw
 * this hierarchy exists to correct: while it was, nothing could be reserved
 * from an administrator, so "only the Superadministrator may redesign a
 * certificate" would have been a sentence in a document contradicted by one
 * line of code. Admin now carries the operational list explicitly — everything
 * the university does, and nothing that changes what the university is.
 */
const MATRIX: Record<UserRole, Capability[] | 'all'> = {
  superadmin: 'all',

  // Every operational capability, no system capability. Derived rather than
  // typed out so a capability added above cannot be quietly withheld from the
  // administrator by forgetting to list it here — and, more importantly, so a
  // capability added to SYSTEM_CAPABILITIES is withheld automatically.
  admin: [...OPERATIONAL_CAPABILITIES],

  // The two executive offices see everything and decide nothing operationally.
  // 'admit-student' and 'verify-payment' are deliberately absent from both: an
  // institution where the Vice Chancellor can personally admit a student has
  // no separation of duties left to speak of, whatever its org chart says.
  chancellor: ['view-executive-dashboard', 'view-all-faculties', 'view-institutional-finance', 'view-admitted-students', 'monitor-progress'],
  'vice-chancellor': ['view-executive-dashboard', 'view-all-faculties', 'view-institutional-finance', 'view-admitted-students', 'monitor-progress', 'department-reports'],

  // Directs Finance. Still cannot admit.
  'finance-director': ['verify-payment', 'approve-refund', 'generate-invoice', 'manage-student-accounts', 'view-institutional-finance'],

  hod: ['assign-lecturers-to-courses', 'approve-course-allocation', 'monitor-teaching', 'department-reports', 'view-registered-students', 'view-admitted-students'],
  'programme-coordinator': ['monitor-teaching', 'department-reports', 'view-registered-students', 'manage-courses'],

  // Prepares applications for the Registrar. Cannot decide one.
  'admissions-officer': ['process-applications', 'request-documents', 'track-application'],

  'library-staff': ['manage-library'],
  'student-affairs': ['manage-hostel', 'manage-student-welfare'],

  applicant: ['apply', 'upload-documents', 'track-application'],

  // Cannot admit students. 'admit-student' is absent, and that absence is the
  // control — not a comment, not a UI condition.
  finance: ['verify-payment', 'approve-refund', 'generate-invoice', 'manage-student-accounts'],

  // Cannot edit payments. 'verify-payment' and 'approve-refund' are absent.
  registrar: [
    'admit-student',
    'reject-application',
    'request-documents',
    'defer-admission',
    'transfer-programme',
    'assign-programme',
    'create-student-record',
    'view-admitted-students',
    'process-applications',
  ],

  'academic-office': ['assign-lecturers', 'build-timetable', 'manage-courses'],

  dean: ['view-admitted-students', 'approve-transfers', 'monitor-progress'],

  lecturer: ['view-registered-students', 'upload-grades', 'take-attendance', 'access-lms'],

  student: [
    'register-courses',
    'pay-fees',
    'view-results',
    'download-transcript',
    'message-lecturers',
    'access-lms',
  ],
};

export function can(role: UserRole | undefined | null, capability: Capability): boolean {
  if (!role) return false;
  const caps = MATRIX[role];
  if (caps === 'all') return true;
  return caps?.includes(capability) ?? false;
}

/** Everything a role may do — used to render the "what you can do here" lists. */
export function capabilitiesOf(role: UserRole): Capability[] | 'all' {
  return MATRIX[role] ?? [];
}

/**
 * An applicant is not a student. This is the check the Student Portal uses to
 * turn one away: the specification is explicit that the Student Portal is
 * exclusively for enrolled students and carries no application forms.
 */
export function isEnrolledRole(role: UserRole | undefined | null): boolean {
  return role !== undefined && role !== null && role !== 'applicant';
}

export const roleLabels: Record<UserRole, string> = {
  superadmin: 'Superadministrator',
  admin: 'System Administrator',
  chancellor: 'Chancellor',
  'vice-chancellor': 'Vice Chancellor',
  'finance-director': 'Finance Director',
  hod: 'Head of Department',
  'programme-coordinator': 'Programme Coordinator',
  'admissions-officer': 'Admissions Officer',
  'library-staff': 'Library Staff',
  'student-affairs': 'Student Affairs',
  applicant: 'Applicant',
  finance: 'Finance Administrator',
  registrar: 'Registrar Administrator',
  'academic-office': 'Academic Office',
  dean: 'Faculty Dean',
  lecturer: 'Lecturer',
  student: 'Student',
};
