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

  applicant: ['apply', 'upload-documents', 'track-application'],

  // Cannot admit students. 'admit-student' is absent, and that absence is the
  // control — not a comment, not a UI condition.
  finance: ['verify-payment', 'approve-refund', 'generate-invoice', 'manage-student-accounts'],

  // Cannot edit payments. 'verify-payment' and 'approve-refund' are absent.
  registrar: [
    'admit-student',
    'reject-application',
    'request-documents',
    'assign-programme',
    'create-student-record',
    'view-admitted-students',
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
  applicant: 'Applicant',
  finance: 'Finance Administrator',
  registrar: 'Registrar Administrator',
  'academic-office': 'Academic Office',
  dean: 'Faculty Dean',
  lecturer: 'Lecturer',
  student: 'Student',
};
