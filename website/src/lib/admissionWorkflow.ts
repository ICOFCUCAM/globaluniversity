// ---------------------------------------------------------------------------
// THE ADMISSION WORKFLOW — five stages, one authority each.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
//
// A trace of the old approval path found three things wrong at once, and they
// were the same fault seen from three sides.
//
//   THE OFFICE THAT SIGNS COULD NOT DECIDE. `academic-office` held
//   'admit-student' and its signature is printed on page 1 of every admission
//   letter, and the navigation put it on none of the three admissions screens.
//   The capability was granted and the door was not built.
//
//   TWO ENDPOINTS, TWO OUTCOMES. /api/admissions/approve and
//   /api/admissions/admit both admitted, and only the second generated the
//   admission package. Which document an admitted student received was decided
//   by which desk the approver happened to be sitting at.
//
//   THE DECISION WAS A COLUMN. `decided_by` and `decided_at` hold the LAST
//   decision. Reverse one and its predecessor is gone — so the record could not
//   answer who admitted this student, only who touched the row most recently.
//
// This module is the single vocabulary all three fixes are written against:
// the states an application can be in, the transitions that are legal, who may
// perform each, and the events appended to the trail. The route, the desk, the
// migration and the tests all read it, so none of them can hold a different
// opinion about what "approved" means.
//
// ---------------------------------------------------------------------------
// THE FIVE STAGES
// ---------------------------------------------------------------------------
//
//   APPLICATION → VERIFICATION → ACADEMIC DECISION → ISSUANCE → ENROLMENT
//
//   Application    the applicant, through the public form
//   Verification   the Admissions Office: documents, eligibility, completeness
//   Academic       the Head of Academic Affairs: the decision itself
//   Issuance       the system, under Academic Affairs' authority: the package
//   Enrolment      the Registrar: the student's academic record
//
// FINANCE IS A GATE, NOT AN AUTHORITY. It confirms the fee and nothing about
// the academic merit of the application, which is why 'verify-payment' and
// 'decide-admission' are held by different offices and always will be.
// ---------------------------------------------------------------------------

/**
 * Every state an application can hold.
 *
 * `applicant`, `fee_paid`, `documents_required`, `approved`, `conditional` and
 * `rejected` were already in the database before this existed and are kept
 * under their existing spellings — renaming a live status is a data migration
 * with nothing to gain. The rest are new.
 */
export const ADMISSION_STATES = [
  // ---- Application ----------------------------------------------------
  /** Started and not submitted. */
  'draft',
  /** Submitted. The database's long-standing name for it is `applicant`. */
  'applicant',
  // ---- Verification ---------------------------------------------------
  /** The Admissions Office has it open. */
  'under_review',
  /** Waiting on the applicant for something. */
  'documents_required',
  /** Documents checked and accepted. */
  'documents_verified',
  /** Finance has not yet confirmed the fee. */
  'fee_pending',
  /** Finance has confirmed it. The database's existing name. */
  'fee_paid',
  // ---- Academic decision ----------------------------------------------
  /** Verified and paid: on the Head of Academic Affairs' desk. */
  'ready_for_academic_review',
  /** Admitted outright. */
  'approved',
  /** Admitted with conditions attached. Existing name: `conditional`. */
  'conditional',
  /** Refused. */
  'rejected',
  /** Sent back to the Admissions Office with a reason. */
  'returned',
  // ---- Issuance and enrolment -----------------------------------------
  /** The package exists and the account has been created. */
  'admission_issued',
  /** The Registrar has completed enrolment. */
  'enrolled',
  /** Left before or during study. */
  'withdrawn',
] as const;

export type AdmissionState = (typeof ADMISSION_STATES)[number];

/**
 * The four decisions the Head of Academic Affairs may take, and the state each
 * produces.
 *
 * A decision is NOT the same thing as a status. 'approved' the decision leads
 * to 'admission_issued' the status once the package and the account exist —
 * see the ordering in ISSUANCE_STEPS, which exists precisely so that an
 * applicant is never shown as admitted before the document that admits them.
 */
export const ACADEMIC_DECISIONS = {
  approve: { label: 'Approve & issue admission', becomes: 'approved' },
  conditional: { label: 'Conditional approval', becomes: 'conditional' },
  return: { label: 'Return for correction', becomes: 'returned' },
  reject: { label: 'Reject', becomes: 'rejected' },
} as const;

export type AcademicDecision = keyof typeof ACADEMIC_DECISIONS;

/**
 * The states from which the Head of Academic Affairs may decide.
 *
 * `fee_paid` and `documents_required` are here because they are what the
 * existing pipeline produces and the desk must work on the records the
 * University already has. `ready_for_academic_review` is where new ones land.
 */
export const DECIDABLE_FROM: AdmissionState[] = [
  'ready_for_academic_review',
  'fee_paid',
  'documents_required',
  'documents_verified',
];

/** Terminal, as far as the academic decision is concerned. */
export const ALREADY_DECIDED: AdmissionState[] = [
  'approved', 'conditional', 'rejected', 'admission_issued', 'enrolled',
];

/**
 * Every event appended to the trail.
 *
 * Named for what HAPPENED rather than for the row that changed, because the
 * trail is read by somebody reconstructing a decision years later and
 * `students.status: fee_paid -> approved` does not tell them a letter was
 * issued or an account created.
 */
export const ADMISSION_EVENTS = [
  'APPLICATION_SUBMITTED',
  'DOCUMENT_VERIFIED',
  'FEE_CONFIRMED',
  'ACADEMIC_REVIEW_STARTED',
  'ACADEMIC_APPROVED',
  'ACADEMIC_CONDITIONALLY_APPROVED',
  'ACADEMIC_REJECTED',
  'ACADEMIC_RETURNED',
  'ADMISSION_LETTER_GENERATED',
  'ADMISSION_PACKAGE_ISSUED',
  'ACCOUNT_CREATED',
  'WELCOME_EMAIL_SENT',
  'WELCOME_EMAIL_FAILED',
  'ENROLLED',
  /** The Superadministrator acting in another office's place. Always visible. */
  'ADMINISTRATIVE_OVERRIDE',
] as const;

export type AdmissionEvent = (typeof ADMISSION_EVENTS)[number];

/** The event an academic decision appends. */
export const EVENT_FOR_DECISION: Record<AcademicDecision, AdmissionEvent> = {
  approve: 'ACADEMIC_APPROVED',
  conditional: 'ACADEMIC_CONDITIONALLY_APPROVED',
  reject: 'ACADEMIC_REJECTED',
  return: 'ACADEMIC_RETURNED',
};

/**
 * WHAT THE SERVER RE-VERIFIES BEFORE ACCEPTING A DECISION.
 *
 * Every one of these is checked against the database at the moment the button
 * is pressed, never against what the browser was showing. A queue rendered
 * three minutes ago is a description of the past, and the fee could have been
 * reversed, the programme closed, or the application already decided by
 * somebody else in that time.
 *
 * Exported as data so the desk can explain a refusal in the same words the
 * server used, rather than the two drifting into disagreement.
 */
export const DECISION_CHECKS = {
  'application-not-found': 'The application no longer exists.',
  'wrong-stage': 'The application is not at a stage where an academic decision can be taken.',
  'already-decided': 'A final admission decision has already been issued for this application.',
  'no-email': 'The application carries no email address, so no account or letter could be delivered.',
  'no-programme': 'The application names no programme.',
  'programme-closed': 'That programme is not open for application, so it cannot be admitted to.',
  'fee-not-confirmed': 'Finance has not confirmed the fee for this application.',
} as const;

export type DecisionRefusal = keyof typeof DECISION_CHECKS;

/**
 * THE ORDER ISSUANCE HAPPENS IN, and the reason the order is the design.
 *
 * The rule is that no step may leave the applicant looking more admitted than
 * they are. The decision is recorded first because it is the fact everything
 * else follows from; the status only becomes `admission_issued` at the end,
 * once the document exists and the account behind it does too.
 *
 * A failure part-way leaves a decision on the record and an audit trail saying
 * exactly how far it got — which is recoverable — rather than a student who
 * has been told they are admitted and has no letter and no account.
 */
export const ISSUANCE_STEPS = [
  'record the decision',
  'generate the admission package',
  'reserve the student number',
  'create the account',
  'create the profile',
  'mark the admission issued',
  'send the welcome email',
] as const;

/** Is this a state the Head of Academic Affairs may act on? */
export function canDecide(state: string | null | undefined): boolean {
  return DECIDABLE_FROM.includes(state as AdmissionState);
}

/** Has a final decision already been issued? */
export function isDecided(state: string | null | undefined): boolean {
  return ALREADY_DECIDED.includes(state as AdmissionState);
}

/**
 * What the applicant is shown, which is not what the offices see.
 *
 * Six steps, in the applicant's own terms. The internal states are the
 * University's business; an applicant asking "where is my application?" needs
 * an answer, not an org chart.
 */
export const APPLICANT_STAGES = [
  { key: 'received', label: 'Application received', states: ['draft', 'applicant', 'under_review'] },
  { key: 'documents', label: 'Documents verified', states: ['documents_required', 'documents_verified'] },
  { key: 'review', label: 'Under academic review', states: ['fee_pending', 'fee_paid', 'ready_for_academic_review'] },
  { key: 'decision', label: 'Decision made', states: ['approved', 'conditional', 'rejected', 'returned'] },
  { key: 'documents-issued', label: 'Admission letter available', states: ['admission_issued'] },
  { key: 'enrolment', label: 'Ready for enrolment', states: ['enrolled'] },
] as const;

/** How far along the applicant's own view should read. -1 when unknown. */
export function applicantStageIndex(state: string | null | undefined): number {
  return APPLICANT_STAGES.findIndex((s) => (s.states as readonly string[]).includes(state ?? ''));
}

/**
 * THE OFFICE A ROLE EXERCISES THE AUTHORITY OF.
 *
 * The person, the role and the office are three different facts, and an audit
 * needs all three. `decided_by = 12345` says a user acted; what an audit has to
 * establish is that the Head of Academic Affairs, ACTING UNDER THE ACADEMIC
 * AFFAIRS AUTHORITY, moved this application from one state to another.
 *
 * They come apart exactly where it matters. When the Superadministrator decides
 * an admission, the person is an administrator and the office exercised is
 * Academic Affairs — which is the case the whole override mechanism exists for,
 * and it cannot be read off the role alone.
 */
export const OFFICE_FOR_ROLE: Record<string, string> = {
  'academic-office': 'Office of Academic Affairs',
  registrar: 'Office of the Registrar',
  'admissions-officer': 'Admissions Office',
  finance: 'Finance Office',
  'finance-director': 'Finance Office',
  'vice-chancellor': 'Office of the Vice Chancellor',
  chancellor: 'Office of the Chancellor',
  superadmin: 'System Administration',
  admin: 'System Administration',
};

/**
 * Which office an action is recorded against.
 *
 * `actingFor` is the office whose authority is being exercised, which is NOT
 * the actor's own office during an override. Recording the actor's office there
 * would make an administrative override look like an ordinary administrative
 * act, and it is the opposite: it is an administrator doing Academic Affairs'
 * work, and the record has to say so.
 */
export function officeFor(role: string | null | undefined, actingFor?: string): string {
  if (actingFor) return OFFICE_FOR_ROLE[actingFor] ?? actingFor;
  return OFFICE_FOR_ROLE[role ?? ''] ?? 'Unattributed';
}
