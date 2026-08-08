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
  // The examination offices sit between the department and the lecturer: an
  // Examination Officer runs a diet across departments, an examiner and a
  // moderator act on one paper, and an invigilator on one sitting.
  'exam-officer',
  'moderator',
  'examiner',
  'lecturer',
  'invigilator',
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
  // The social pipeline. COMPOSING and PUBLISHING are operational — this is
  // the university talking about itself, which is an administrator's job.
  // ---------------------------------------------------------------------
  // THE DIGITAL EXAMINATION & PROCTORING SYSTEM
  //
  // Split finely on purpose. The University's own instruction was that "no
  // single ordinary administrator should be able to alter examination
  // evidence, marks and academic records" — which is a statement about
  // capabilities, not about job titles, and only holds if the powers are
  // separable in the first place.
  //
  // Note what is NOT here and never will be: any capability to edit or delete
  // an examination event, a camera session or a saved answer. Evidence is
  // append-only in the database and there is no permission that unlocks it —
  // not for the Superadministrator, not for anyone. A system where the right
  // account can revise what a camera recorded cannot support an appeal.
  'schedule-examination',
  'publish-examination',
  'assign-proctor',
  // Watching a live sitting, and writing down what you saw. The narrowest
  // examination capability: an invigilator RECORDS, and decides nothing.
  'proctor-examination',
  'record-exam-incident',
  // Pausing, resuming and extending a live sitting. Separate from proctoring
  // because giving a candidate more time changes the assessment.
  'control-exam-session',
  'terminate-examination',
  // Marking, moderating and the finding of misconduct are three different
  // people's work and three different capabilities.
  'mark-examination',
  'moderate-examination',
  'determine-misconduct',
  'sit-examination',
  'compose-social-post',
  'publish-social-post',
  // APPROVING IS NOT PUBLISHING, and they are separate on purpose. Migration
  // 014 refuses to let an author approve their own post — the same separation
  // 005 required of certificate designs and 009 of grades. An announcement is
  // the institution speaking, and one person writing, approving and sending it
  // alone is how an unconsidered sentence ends up on six networks under the
  // University's name.
  'approve-social-post',
  // Connecting YOUR OWN account is operational and personal. It appears in an
  // administrator's own settings and nowhere else: nobody may connect, revoke
  // or post through another person's account, and the database enforces that
  // as well as this matrix does. See migration 013.
  'connect-own-social',
  // The Registry's academic record
  //
  // NOT the lecturer's 'upload-grades'. Posting a mark for one class and
  // recomputing every average in the university are different acts with
  // different blast radii, and a capability that covered both would mean any
  // lecturer could rewrite the cumulative record of every student on the roll.
  'recompute-gpa',
  // ---------------------------------------------------------------------
  // THE GRADE APPROVAL CHAIN — four steps, four capabilities, four people.
  //
  // These could have been one 'approve-results' held by four offices. They are
  // not, and the reason is the whole point of a chain: with a single capability
  // the Dean could perform the moderation step and the Registrar could perform
  // all three, so a class could go from a lecturer's draft to the academic
  // record having been read once. Separate capabilities make skipping a step
  // impossible rather than merely discouraged.
  //
  // The chain is not invented here. lifecycle.ts publishes it — lecturer, Head
  // of Department, Dean, Registrar — and says of it: "No step may be skipped,
  // including by an administrator." These four capabilities are what makes that
  // sentence true of the system and not only of the page it appears on.
  //
  // 'submit-results' is separate from the lecturer's 'upload-grades' for the
  // same reason a save is separate from a signature: entering marks is work in
  // progress and is done many times, whereas submitting declares the class
  // finished and closes it to further editing.
  'submit-results',
  'moderate-results',
  'approve-results',
  'publish-results',
  // ---------------------------------------------------------------------
  // ISSUING A CERTIFICATE TO A GRADUATE.
  //
  // OPERATIONAL, and it was not. /api/credential/issue was guarded by
  // 'publish-credential-template' — a SYSTEM capability, so the
  // Superadministrator alone. The reasoning given was that the office which
  // designs credentials answers for them, and for the DESIGN that is right.
  // For an individual award it is not, and it broke the pipeline: after four
  // offices had approved a class and the Registrar had written the marks to
  // the record, nobody in the university could confer the degree. The person
  // who administers the servers had to.
  //
  // That also contradicts the university's own published governance.
  // lifecycle.ts puts conferral with Senate — "The award is conferred here and
  // nowhere else" — and step 7, issuing the certificate, is administrative
  // work downstream of that decision. And roles.ts already says the
  // Superadministrator is custody of the SYSTEM rather than an office of the
  // university: "The Chancellor is not junior to the Superadministrator; they
  // are answerable for different things." Conferring a degree is the most
  // institutional act there is and cannot be the sysadmin's.
  //
  // 'revoke-credential' stays a system capability, deliberately. Withdrawing a
  // degree already conferred is rarer and graver than issuing one, and the
  // original comment's principle holds: an institution that can withdraw a
  // degree more easily than it can confer one has the balance the wrong way
  // round. This change makes issuing easier, not revoking.
  'issue-credential',
  // Which programmes the university is currently admitting to. An academic
  // decision — what the faculty is ready to teach this year — not an
  // administrative one, which is why it is not in the Admissions Officer's set.
  'set-admission-openings',
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
  // AMENDING AN ALREADY-ISSUED CREDENTIAL. Distinct from designing one, and
  // far graver: it changes what the university is recorded as having said on a
  // date that has passed. The correction supersedes rather than overwrites —
  // migration 013 explains why — but the authority to start that is the
  // Superadministrator's alone. "He is more of the VC of the university."
  'amend-issued-credential',
  // A certificate for something that is not a degree — service, appointment,
  // ordination. Creating a new KIND of instrument the university awards is a
  // decision about what the university is, which is what makes it systemic.
  'create-credential-type',
  // Connecting the INSTITUTION's accounts, so that every administrator can
  // publish through them without ever holding their credentials.
  'connect-university-social',
  // Held by the three approving offices, and deliberately NOT by the
  // Superadministrator who designs. An approval you give to your own work is a
  // countersignature, not a control.
  'approve-credential-design',
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
  'vice-chancellor': ['view-executive-dashboard', 'view-all-faculties', 'view-institutional-finance', 'view-admitted-students', 'monitor-progress', 'department-reports', 'approve-credential-design'],

  // Directs Finance. Still cannot admit.
  'finance-director': ['verify-payment', 'approve-refund', 'generate-invoice', 'manage-student-accounts', 'view-institutional-finance'],

  // Moderates submitted marks — the department's attestation that the marking
  // is consistent and the spread defensible. Cannot enter a mark and cannot
  // publish one.
  hod: ['assign-lecturers-to-courses', 'approve-course-allocation', 'monitor-teaching', 'department-reports', 'view-registered-students', 'view-admitted-students', 'moderate-results'],
  'programme-coordinator': ['monitor-teaching', 'department-reports', 'view-registered-students', 'manage-courses'],

  // The Admissions Office makes the final assessment and admits.
  //
  // It used to only prepare files for the Registrar. The university has since
  // separated the two acts: the Registrar verifies that the record is complete
  // and correct and forwards it; this office assesses it and admits.
  //
  // It still cannot verify a payment, and it cannot forward a record to itself
  // — 'assign-programme' and 'create-student-record' stay with the Registrar,
  // so an application cannot enter this queue except through that office.
  'admissions-officer': [
    'process-applications', 'request-documents', 'track-application',
    'admit-student', 'reject-application', 'defer-admission', 'view-admitted-students',
  ],

  'library-staff': ['manage-library'],
  'student-affairs': ['manage-hostel', 'manage-student-welfare'],

  applicant: ['apply', 'upload-documents', 'track-application'],

  // Cannot admit students. 'admit-student' is absent, and that absence is the
  // control — not a comment, not a UI condition.
  finance: ['verify-payment', 'approve-refund', 'generate-invoice', 'manage-student-accounts'],

  // Cannot edit payments. 'verify-payment' and 'approve-refund' are absent.
  registrar: [
    // Retained: the Registrar's own approve route still holds this, and the
    // university may want a single-office fallback if the Admissions Office is
    // unstaffed. The pipeline gate is the record's status, not this list.
    'admit-student',
    'reject-application',
    'request-documents',
    'defer-admission',
    'transfer-programme',
    'assign-programme',
    'create-student-record',
    'view-admitted-students',
    'process-applications',
    'approve-credential-design',
    'recompute-gpa',
    // The last step: writing approved marks to the academic record. It sits
    // with the Registrar because the academic record is the Registry's, and
    // because publication is what a degree is later conferred on.
    'publish-results',
    // And issuing the certificate itself. The Registry keeps the academic
    // record and produces the instrument that attests to it.
    'issue-credential',
    'set-admission-openings',
  ],

  // The Head of Academic Affairs approves admissions and SIGNS the admission
  // letter — the signature on page 1 is theirs. An office that signs the offer
  // but cannot issue it would mean somebody else pressing the button under
  // their name, which is precisely the arrangement the signature exists to
  // prevent.
  'academic-office': [
    'assign-lecturers', 'build-timetable', 'manage-courses',
    'approve-credential-design', 'recompute-gpa',
    'admit-student', 'reject-application', 'request-documents',
    // Publication, alongside the Registrar, for the same reason 'admit-student'
    // is held by two offices: a term's results must not sit unpublished because
    // one desk is unstaffed. It holds ONLY the last step — it cannot moderate
    // or approve for a faculty, so it cannot walk a class through the chain
    // alone.
    'publish-results',
    'issue-credential',
    'set-admission-openings',
  ],

  // Approves moderated marks on behalf of the faculty. Third of four.
  dean: ['view-admitted-students', 'approve-transfers', 'monitor-progress', 'approve-results'],

  // Enters marks AND declares a class finished — but cannot approve one, not
  // even their own. 'moderate-results' and everything after it are absent, and
  // that absence is the first link of the chain.
  lecturer: [
    'view-registered-students', 'upload-grades', 'submit-results',
    'take-attendance', 'access-lms',
  ],

  // ---------------------------------------------------------------------
  // THE EXAMINATION OFFICES
  // ---------------------------------------------------------------------

  // Runs the diet. Schedules, publishes, assigns proctors, and can stop a
  // sitting that has gone wrong. DOES NOT MARK and cannot find misconduct —
  // the office that arranges an examination must not also grade it.
  'exam-officer': [
    'schedule-examination', 'publish-examination', 'assign-proctor',
    'control-exam-session', 'terminate-examination',
    'view-registered-students', 'department-reports',
  ],

  // Marks, and conducts oral and practical examinations. May record an
  // incident — they are watching a viva — but may not FIND misconduct, which
  // is a determination about a student's academic record rather than an
  // observation about a sitting.
  examiner: [
    'mark-examination', 'proctor-examination', 'record-exam-incident',
    'control-exam-session', 'view-registered-students', 'access-lms',
    'upload-grades', 'submit-results',
  ],

  // THE NARROWEST ROLE IN THE SYSTEM, and deliberately so. An invigilator
  // watches and writes down what they saw. They cannot mark, cannot moderate,
  // cannot terminate a sitting and cannot decide that what they saw was
  // cheating. Their observation is evidence; somebody else weighs it.
  invigilator: ['proctor-examination', 'record-exam-incident'],

  // Second-marks, and determines misconduct — the academic-integrity decision
  // the University said a human must make. Cannot enter a first mark, and
  // migration 015 refuses to let anyone moderate their own marking.
  moderator: [
    'moderate-examination', 'determine-misconduct', 'moderate-results',
    'view-registered-students', 'department-reports',
  ],

  student: [
    'register-courses',
    'pay-fees',
    'sit-examination',
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
  'exam-officer': 'Examination Officer',
  examiner: 'Examiner',
  invigilator: 'Invigilator',
  moderator: 'Moderator',
  student: 'Student',
};
