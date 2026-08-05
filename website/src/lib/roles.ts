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
 * Position in the hierarchy. Lower is more senior. 'admin' is a system role
 * outside the hierarchy and 'academic-office' predates it, so both return -1
 * and neither is presented as ranking above or below anyone.
 */
export function rank(role: UserRole): number {
  return HIERARCHY.indexOf(role);
}

export type Capability =
  // Applicant
  | 'apply'
  | 'upload-documents'
  | 'track-application'
  // Finance
  | 'verify-payment'
  | 'approve-refund'
  | 'generate-invoice'
  | 'manage-student-accounts'
  // Registrar
  | 'admit-student'
  | 'reject-application'
  | 'request-documents'
  | 'assign-programme'
  | 'create-student-record'
  // Academic office
  | 'assign-lecturers'
  | 'build-timetable'
  | 'manage-courses'
  // Dean
  | 'view-admitted-students'
  | 'approve-transfers'
  | 'monitor-progress'
  // Lecturer
  | 'view-registered-students'
  | 'upload-grades'
  | 'take-attendance'
  // Executive
  | 'view-executive-dashboard'
  | 'view-all-faculties'
  | 'view-institutional-finance'
  // Department
  | 'assign-lecturers-to-courses'
  | 'approve-course-allocation'
  | 'monitor-teaching'
  | 'department-reports'
  // Admissions / library / student affairs
  | 'process-applications'
  | 'defer-admission'
  | 'transfer-programme'
  | 'manage-library'
  | 'manage-hostel'
  | 'manage-student-welfare'
  // Student
  | 'register-courses'
  | 'pay-fees'
  | 'view-results'
  | 'download-transcript'
  | 'message-lecturers'
  | 'access-lms';

/**
 * What each role may do. Anything absent is forbidden — there is no wildcard
 * except `admin`, which exists so the institution is not locked out of its own
 * system, and which is deliberately the only role with one.
 */
const MATRIX: Record<UserRole, Capability[] | 'all'> = {
  admin: 'all',

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
