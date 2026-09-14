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
  'hr-officer',
  'hr-administrator',
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
  // ---------------------------------------------------------------------
  // THE ACADEMIC ADMISSION DECISION, held apart from 'admit-student'.
  //
  // 'admit-student' is the old capability and it is what the Admissions Office
  // and the Registrar hold: process the file, and in a pinch admit from it.
  // 'decide-admission' is the ACADEMIC act — the decision the Head of Academic
  // Affairs signs page 1 of the letter for — and it is deliberately a
  // different key so the two cannot be granted by accident together.
  //
  // Only 'academic-office' and the Superadministrator hold it. The
  // Superadministrator's use of it is recorded as an administrative override
  // with a stated reason, never as an academic decision.
  // ---------------------------------------------------------------------
  'decide-admission',
  'reject-application',
  'request-documents',
  'assign-programme',
  'create-student-record',
  // Academic office
  'assign-lecturers',
  'build-timetable',
  'manage-courses',
  // ---------------------------------------------------------------------
  // ROLLING THE ACADEMIC YEAR OVER.
  //
  // Narrower than any of the three above, and deliberately so. Marking one
  // year closed and the next current moves the Course Offerings screen, the
  // Timetable and the Academic Overview onto a different year for everybody
  // at once — it is the single most consequential button in the academic
  // section, and it is not a teaching act.
  //
  // `manage-courses` is held by every programme coordinator, and the academic
  // year is not theirs to move either. (This comment used to say
  // "`build-timetable` is held by every lecturer". It is not, and never was —
  // the lecturer array below does not contain it. A lecturer reaches the
  // Attendance screen through `take-attendance` instead.) The academic year is a fact about the
  // RECORD, so it sits with the Registry.
  // ---------------------------------------------------------------------
  'manage-academic-calendar',
  // ---------------------------------------------------------------------
  // THE TOP OF THE TREE: schools, faculties and departments.
  //
  // The University's own ordering — University, then School or Faculty, then
  // Department, then Study Programme — makes this the most structural act in
  // the academic domain. Creating a Faculty is closer to a constitutional
  // change than to running a term, and `manage-courses` is held by every
  // programme coordinator.
  //
  // A department is where a lecturer, a course and a programme all hang from.
  // Archiving one is not a tidy-up; it is a statement about what the
  // University teaches.
  // ---------------------------------------------------------------------
  'manage-academic-structure',
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
  // ---------------------------------------------------------------------
  // ANNOUNCEMENTS — the institution speaking on its own noticeboard.
  //
  // Three, not one, and the split is the same one 005 requires of a
  // certificate design and 014 of a social post. The Announcements page used
  // to check `role === 'admin' || role === 'lecturer'` inline, which meant
  // every lecturer in the University could put a notice on the institution's
  // board alone and instantly, with nobody named.
  //
  // RELEASING OUTWARD IS NOT HERE. Sending an announcement to Facebook
  // requires 'publish-social-post' as well, on purpose: this new door must
  // not become a way round the authority that already governs the
  // University's outward voice.
  // ---------------------------------------------------------------------
  // ---------------------------------------------------------------------
  // APPOINTMENTS. Drafting an appointment and authorising one are two
  // capabilities because they must be two people: an appointment letter
  // commits the University to paying somebody, and 041 refuses an
  // authorisation by the drafter in the database as well as here.
  //
  // 'set-remuneration' is separate again. Who holds which post is ordinary
  // institutional information and what they are paid is not, and an HR
  // assistant who can record an appointment should not thereby be able to
  // decide a salary.
  // ---------------------------------------------------------------------
  'draft-appointment',
  'authorize-appointment',
  'issue-appointment-letter',
  'set-remuneration',
  // ---------------------------------------------------------------------
  // OFFICIAL CORRESPONDENCE — and here the separation is deliberately NOT
  // the same shape.
  //
  // An appointment commits the University's MONEY, so 041 refuses an
  // authorisation by the drafter and 'draft-appointment' and
  // 'authorize-appointment' must land on two people. A letter commits the
  // University's WORDS, and a letter to a ministry IS the Vice-Chancellor
  // speaking. An office that holds all three of these may take a letter from
  // blank page to issued alone, which is the point of them.
  //
  // 'prepare-correspondence' is the one that is held WITHOUT the others: an
  // administrator asked to draft. They write it and hand it back, and the
  // database refuses them to authorise what they prepared even if somebody
  // later grants them the capability by mistake.
  // ---------------------------------------------------------------------
  'compose-correspondence',
  'prepare-correspondence',
  'authorize-correspondence',
  'issue-correspondence',
  'compose-announcement',
  'approve-announcement',
  'publish-announcement',
  // PUBLISHING AN EMERGENCY WITHOUT A SECOND PAIR OF EYES. Its own capability
  // rather than a corner of 'publish-announcement', because an override
  // anybody who can publish may also reach for is not an emergency procedure —
  // it is the fast way to publish, and within a month it is the only way
  // anybody publishes. The database restricts it to the `emergency` category
  // and requires a stated reason; this restricts who may reach for it at all.
  'override-announcement-clearance',
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
  // Sending a sealed credential to an address that is NOT the holder's — a
  // receiving university, an employer's verification desk. Separate from
  // emailing it to the student, because it is the University disclosing
  // somebody's academic record to a third party.
  'forward-credential',
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
  // ---------------------------------------------------------------------
  // PUTTING MATERIAL ON A COURSE, which is not the same as reading it.
  //
  // `access-lms` is held by students — it is how they open the shelf. Writing
  // on a course is the lecturer's and the catalogue office's, and it needs its
  // own name or the two collapse into one and every student can post a
  // reading list.
  //
  // HOLDING IT IS NOT ENOUGH ON ITS OWN. /api/academic/materials also checks
  // that the caller is the lecturer ON THAT COURSE, because a capability
  // cannot express "their own courses and nobody else's" — and without the
  // row-level check, a programme coordinator in Business could publish on a
  // Theology course.
  // ---------------------------------------------------------------------
  'publish-course-material',
  // ---------------------------------------------------------------------
  // RECORDING A CONFERRAL — the end of the chain.
  //
  // NOT the act of conferring. `src/lib/graduation.ts` is explicit: "whether
  // the Senate has resolved to confer is a meeting, not a computation, and no
  // query stands in for it." What this capability permits is WRITING DOWN
  // what the Senate resolved, and 019 makes the resolution date a required
  // field so the record cannot exist without naming its authority.
  //
  // Held by the offices that keep the degree register: the Registry, which
  // keeps the academic record, and the two officers in whose name degrees are
  // conferred. Not by a teaching office — `issue-credential` is a separate
  // capability for a separate act, and a degree exists before its certificate
  // is printed.
  // ---------------------------------------------------------------------
  'confer-award',
  // ---------------------------------------------------------------------
  // WHAT A STUDENT IS CHARGED, AND WHETHER THEY ARE CLEAR.
  //
  // Two capabilities, because they are two acts done by two offices, and
  // neither existed before 075 gave the University a fee schedule at all.
  //
  // 'set-fee-schedule' is deciding what the University charges. The
  // University named the holders itself, in two goes: "the superadmin should
  // be able to fix it and it is recorded in the system", and then "financial
  // director can also set fees". Both hold it; nobody else does.
  //
  // RAISING AN INVOICE IS NOT HERE, deliberately. `generate-invoice` and
  // `manage-student-accounts` already exist and the Finance Director already
  // holds both; charging a student against a schedule somebody else set is
  // exactly what they are for. A third capability over the same act would
  // have been the duplication the University warned about.
  //
  // 'confirm-financial-clearance' gates a degree, which is why it is its own
  // capability rather than part of managing an account. The office that
  // records a payment and the office that says a graduand is clear are the
  // same office here — but the acts are not, and the second one is the one
  // that stops a congregation.
  'set-fee-schedule',
  'confirm-financial-clearance',
  // ---------------------------------------------------------------------
  // ANSWERING A STUDENT.
  //
  // 073 gave a student a way to ask the University for something and gave the
  // request a state anybody could see. Nothing could MOVE it — no office
  // screen, no route, no way off 'submitted'. A student could ask for
  // academic leave, watch the screen say Submitted, and wait for ever, which
  // is worse than the emailing it replaced because an email at least lands in
  // somebody's inbox.
  //
  // Held by the offices a student actually writes to. Not by a lecturer: a
  // request about fees, deferment or an appeal is not their work, and a
  // capability that covers everybody covers nobody.
  'handle-student-request',
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
  // ---------------------------------------------------------------------
  // ERASING AN ANNOUNCEMENT. The Superadministrator alone, and it is a SYSTEM
  // capability rather than an operational one for the reason this list exists:
  // an Administrator runs the University, and destroying a record of something
  // the University said is not running it.
  //
  // 038 made deletion impossible outright and the University has ruled that at
  // least one person must be able to. A notice posted to the wrong audience,
  // or naming somebody who has asked to be removed, is a real thing that has
  // to be able to go. What it leaves behind is a tombstone — the text is
  // destroyed, the fact that it existed is not — because a registry that can
  // make a notice vanish without trace cannot answer "did you ever publish
  // that?", and the answer "no" would be unverifiable even when true.
  // ---------------------------------------------------------------------
  'erase-announcement',
  // Who exists, and who may act
  'assign-roles',
  'create-staff-account',
  // ---------------------------------------------------------------------
  // OPENING A STAFF RECORD IS NOT CREATING AN ACCOUNT FROM NOTHING.
  //
  // `create-staff-account` is the Superadministrator typing somebody into
  // existence: there is no application, no queue and no prior act. THIS is the
  // consequence of an appointment the University has already approved, issued
  // and had accepted — every particular is read from that record and nothing is
  // typed. So it is a different act, held by different offices: the University
  // named the Academic Office, the Registrar and the Vice-Chancellor.
  // ---------------------------------------------------------------------
  'open-staff-record',
  'suspend-account',
  'reinstate-account',
  'reset-user-password',
  'impersonate-user',
  // What the university's awards look like and whether they stand
  'design-credentials',
  'publish-credential-template',
  /**
   * Publishing a design the three approving offices have not signed.
   *
   * THE UNIVERSITY'S OWN AUTHORITY, held by the Superadministrator alone —
   * "he is more of the VC of the university". It is a separate capability from
   * publishing rather than part of it, because the two are different acts: one
   * carries out a decision the Senate has taken, the other takes the decision.
   * A future role that may publish must not inherit the power to publish
   * unapproved simply by holding the first.
   *
   * It is not a way round the control. The database still refuses unless the
   * row says so and carries a reason of at least forty characters, stamps the
   * hour itself, and marks the version permanently — see migration 022. What
   * this capability decides is WHO may take that route.
   */
  'publish-without-senate',
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
  // DESTROYING AN APPLICATION RECORD.
  //
  // Systemic rather than operational, and therefore the Superadministrator's
  // alone, because it is the only act in the admissions pipeline that leaves
  // nothing behind. Rejecting an application is a decision and is recorded;
  // deleting one removes the evidence that the person ever applied — including
  // what Finance saw, what the Registrar verified and why the Admissions
  // Office decided as it did.
  //
  // An Admissions Officer who could do this could erase a candidate they had
  // mishandled. That is exactly the class of act this hierarchy exists to keep
  // out of an operational role.
  'delete-application',
  // TRANSCRIBING A RECORD THE SYSTEM NEVER HELD.
  //
  // A transcript for a year that predates this database cannot be derived from
  // marks — there are none. It has to be typed from a paper register, and the
  // University then seals it and stands behind it.
  //
  // That is a genuinely different act from issuing a transcript, and it is the
  // Superadministrator's alone: everything the approval chain exists to
  // guarantee — that four offices saw each mark — is absent by construction.
  // The safeguard is not a signature; it is that the document says on its face
  // that it was transcribed from an archived record, and the register says so
  // for ever.
  'transcribe-historical-record',
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
 * Every capability there is, as values rather than as a type.
 *
 * WHY THE LIST AND NOT JUST THE TYPE. A capability GRANT (056) names one in a
 * text column — the database deliberately holds no vocabulary for it, because
 * a copy of this list in SQL would go stale the moment a capability is added
 * and would then refuse something the application has. So the check happens in
 * /api/admin/capability-grant, at runtime, against this.
 *
 * A typo stored as a grant is the failure that makes this worth having: it
 * would sit in the table looking exactly like access and match no capability
 * anybody ever asks for.
 */
export const ALL_CAPABILITIES: readonly Capability[] = [
  ...OPERATIONAL_CAPABILITIES,
  ...SYSTEM_CAPABILITIES,
];

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
  // The Chancellor holds the correspondence chain for the same reason the
  // Vice-Chancellor does — it is their own office's letter — and holds none of
  // the appointment capabilities, because the appointing authority is one
  // office and naming two would make "who appoints here" a question.
  chancellor: ['view-executive-dashboard', 'view-all-faculties', 'view-institutional-finance', 'view-admitted-students', 'monitor-progress',
    'compose-correspondence', 'authorize-correspondence', 'issue-correspondence', 'confer-award'],
    // ---------------------------------------------------------------------
    // TWO THAT THE SUPERADMINISTRATOR HOLDS AND THIS OFFICE DELIBERATELY
    // DOES NOT, because giving them would do harm rather than nothing:
    //
    // 'prepare-correspondence' is "somebody asked me to draft this for them".
    // 045 refuses whoever is recorded as `prepared_by` to authorise the same
    // letter — so a Vice-Chancellor who ever appeared as the preparer of
    // their own letter would be locked out of authorising it. The capability
    // would take away the one thing this office most needs.
    //
    // 'create-student-record' is the Registrar's and HR's act. The University
    // has already ruled that a Vice-Chancellor who can personally admit a
    // student has no separation of duties left; the same reasoning holds for
    // creating the record that follows.
    // ---------------------------------------------------------------------
  // ---------------------------------------------------------------------
  // THE VICE-CHANCELLOR IS THE UNIVERSITY'S APPOINTING AUTHORITY.
  //
  // Staff, not students — and the distinction is the reason this is not a
  // contradiction of the note above. A Vice Chancellor who can personally
  // admit a student has no separation of duties left; a Vice Chancellor who
  // appoints the staff is the institution's governance working as stated.
  //
  // AUTHORISING AND ISSUING TOGETHER, and HR holds neither. HR prepares,
  // verifies and submits; the VC approves and issues. That is a cleaner split
  // than a separate HR approval layer, because it puts the two halves in
  // different offices rather than in two desks of the same one.
  // ---------------------------------------------------------------------
  'vice-chancellor': [
    // The University named this office to open a staff record from an
    // accepted appointment.
    'open-staff-record','view-executive-dashboard', 'view-all-faculties', 'view-institutional-finance', 'view-admitted-students', 'monitor-progress', 'department-reports', 'approve-credential-design',
    // ---------------------------------------------------------------------
    // THE VICE-CHANCELLOR CAN DO THEIR OWN WORK.
    //
    // This role held `authorize-appointment` and `issue-appointment-letter`
    // and NOT `draft-appointment` — so the University's own Scenario B, "the
    // VC creates an appointment directly", was impossible: the Draft & submit
    // screen shows its New appointment button only to a drafter, and the VC
    // was not one. They could approve and issue an appointment that they had
    // no way to start.
    //
    // `set-remuneration` for the same reason. A VC drafting an appointment
    // personally could not state what the post pays, which is not a
    // separation of duties — it is half a form.
    //
    // 041 still refuses an approval by whoever drafted it, EVEN FOR THE VC.
    // Drafting and approving remain two people; 045's sole-authority route is
    // how one office does both, marked and permanently visible.
    'draft-appointment', 'set-remuneration',
    'authorize-appointment', 'issue-appointment-letter',
    // ---------------------------------------------------------------------
    // AND THE UNIVERSITY'S VOICE.
    //
    // Announcements sat in the Vice-Chancellor's sidebar and they could do
    // nothing on the page. The institution speaking is the VC's business if it
    // is anybody's.
    //
    // Composing AND approving is not a hole: 038 refuses an approval by the
    // author in the database, so the VC can write one and somebody else
    // clears it, exactly as for everyone else who holds both.
    'compose-announcement', 'approve-announcement', 'publish-announcement',
    // Publishing an emergency with no second pair of eyes. Restricted by 040
    // to the emergency category and to a stated reason that stays on the
    // record — an institutional authority's act, which is what this office is.
    'override-announcement-clearance',
    // THE WHOLE CORRESPONDENCE CHAIN, IN ONE OFFICE. Not an oversight and not
    // a convenience: the University's ruling is that the Vice-Chancellor
    // starts and finishes their own letter, with no artificial loop through
    // HR. See src/lib/correspondence.ts for where that line is drawn and why
    // it does not extend to appointments.
    'compose-correspondence', 'authorize-correspondence', 'issue-correspondence', 'confer-award'],
    // ---------------------------------------------------------------------
    // TWO THAT THE SUPERADMINISTRATOR HOLDS AND THIS OFFICE DELIBERATELY
    // DOES NOT, because giving them would do harm rather than nothing:
    //
    // 'prepare-correspondence' is "somebody asked me to draft this for them".
    // 045 refuses whoever is recorded as `prepared_by` to authorise the same
    // letter — so a Vice-Chancellor who ever appeared as the preparer of
    // their own letter would be locked out of authorising it. The capability
    // would take away the one thing this office most needs.
    //
    // 'create-student-record' is the Registrar's and HR's act. The University
    // has already ruled that a Vice-Chancellor who can personally admit a
    // student has no separation of duties left; the same reasoning holds for
    // creating the record that follows.
    // ---------------------------------------------------------------------

  // Directs Finance. Still cannot admit.
  // ---------------------------------------------------------------------
  // AND THIS OFFICE SETS FEES TOO, ON THE UNIVERSITY'S INSTRUCTION.
  //
  // The note that stood here said 'set-fee-schedule' was the
  // Superadministrator's alone and invited the University to say otherwise.
  // They did: "financial director can also set fees."
  //
  // So both hold it, and that is the whole change — the Superadministrator
  // keeps it, because a system account that cannot correct a fee schedule
  // cannot help when the Finance Director is away.
  //
  // STILL THREE SEPARATE ACTS. Deciding what the University charges
  // ('set-fee-schedule'), charging a particular student ('generate-invoice')
  // and saying a student is square with the University
  // ('confirm-financial-clearance') remain three capabilities. This office now
  // holds all three, which is a statement about this office rather than about
  // the acts: a Registrar or a Dean still holds none of them.
  // ---------------------------------------------------------------------
  'finance-director': ['handle-student-request', 'verify-payment', 'approve-refund', 'generate-invoice', 'manage-student-accounts', 'view-institutional-finance', 'confirm-financial-clearance', 'set-fee-schedule'],

  // Moderates submitted marks — the department's attestation that the marking
  // is consistent and the spread defensible. Cannot enter a mark and cannot
  // publish one.
  hod: ['assign-lecturers-to-courses', 'approve-course-allocation', 'monitor-teaching', 'department-reports', 'view-registered-students', 'view-admitted-students', 'moderate-results', 'publish-course-material'],
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

  // ---------------------------------------------------------------------
  // THE TWO HR OFFICES.
  //
  // NEITHER CAN DRAFT, APPROVE AND ISSUE. That is the whole answer to "nobody
  // should be able to click a button and manufacture an official appointment":
  // the Officer prepares and generates, the Administrator issues and manages
  // the employee record, and the APPROVAL is the Registrar's — a third person
  // again. On top of that the database refuses an approval by whoever drafted
  // it, whatever role they hold.
  //
  // 'set-remuneration' is absent from the Officer and present for neither by
  // default. Deciding what somebody is paid is not the same act as recording
  // that they were appointed, and an HR assistant who may do the second should
  // not thereby do the first.
  // ---------------------------------------------------------------------
  // HR PREPARES, VERIFIES AND SUBMITS. It does not issue, and that is the
  // University's ruling rather than a design preference: the appointing
  // authority is the Vice-Chancellor, so 'issue-appointment-letter' is absent
  // from both HR roles and present on exactly one office.
  'hr-officer': [
    'draft-appointment',
  ],

  'hr-administrator': [
    'draft-appointment',
    // ASKED TO DRAFT, NOT TO DECIDE. This is the capability that exists to be
    // held on its own: HR can write a letter the Vice-Chancellor requested and
    // hand it back, and 045 refuses them to authorise what they prepared.
    'prepare-correspondence',
    // The employee record, which follows the letter and never precedes it —
    // 042 refuses a staff row whose appointment has not been issued. HR
    // creates it AFTER the VC has issued; it cannot create it before.
    'create-student-record',
    'set-remuneration',
  ],

  // ---------------------------------------------------------------------
  // THE LIBRARY, AND WHY THERE IS NO LIBRARY MODULE HERE.
  //
  // This office held `manage-library` and had no screen for it. The obvious
  // reading is that one is missing. It is not.
  //
  // A library runs on a library system — a catalogue, holdings, circulation,
  // reservations, fines, interlibrary loan, and a bibliographic standard this
  // system has no business reimplementing. Universities run those as their own
  // systems and connect them to the student record; they do not build them
  // inside it. A half-built catalogue in a student record system is worse than
  // none: it becomes the place nobody's holdings actually are.
  //
  // What a library genuinely needs FROM the student record is one thing: is
  // this person a current student, and what is their standing. That is what a
  // borrower card is issued against and what a loan is refused on. It is
  // `view-registered-students`, which already exists and which this office
  // should always have held.
  //
  // `manage-library` stays in the vocabulary, named and unenforced, because it
  // describes real work the University does somewhere else. Deleting it would
  // suggest the office has no such duty; enforcing it would suggest this
  // system carries it.
  // ---------------------------------------------------------------------
  'library-staff': ['manage-library', 'view-registered-students'],
  // STUDENT AFFAIRS' REAL WORK IN THIS SYSTEM.
  //
  // This office held `manage-hostel` and `manage-student-welfare` and had no
  // screen for either — four menu entries, all of them the ones every office
  // gets. An audit named it and printed it on every test run.
  //
  // A hostel module is not the answer and neither is a welfare case system:
  // both are substantial subsystems, and inventing half of one is worse than
  // having none. What this office genuinely does in a student record system is
  // ANSWER STUDENTS — academic leave, deferment, welfare, a replacement card —
  // and 073 already built that pipeline with nobody to work it.
  //
  // So they get the queue. `manage-hostel` and `manage-student-welfare` stay
  // named and unenforced, because they describe work this system does not do
  // and pretending otherwise is how a capability comes to mean nothing.
  'student-affairs': ['manage-hostel', 'manage-student-welfare', 'handle-student-request',
    'view-registered-students'],

  applicant: ['apply', 'upload-documents', 'track-application'],

  // Cannot admit students. 'admit-student' is absent, and that absence is the
  // control — not a comment, not a UI condition.
  finance: ['verify-payment', 'approve-refund', 'generate-invoice', 'manage-student-accounts'],

  // Cannot edit payments. 'verify-payment' and 'approve-refund' are absent.
  // The Registry answers most of what a student asks: enrolment
  // confirmations, cards, leave, deferment, a change of programme.
  registrar: [
    // The University named this office to open a staff record from an
    // accepted appointment.
    'open-staff-record',
    'handle-student-request',
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
    'forward-credential',
    'set-admission-openings',
    // The year boundary is a fact about the academic record, and the academic
    // record is the Registry's. See the capability's own note.
    'manage-academic-calendar',
    // And the shape of the tree the record hangs from.
    'manage-academic-structure',
    'confer-award',
  ],

  // The Head of Academic Affairs approves admissions and SIGNS the admission
  // letter — the signature on page 1 is theirs. An office that signs the offer
  // but cannot issue it would mean somebody else pressing the button under
  // their name, which is precisely the arrangement the signature exists to
  // prevent.
  // The Academic Office answers the academic ones — a programme change, a
  // course withdrawal, an appeal.
  'academic-office': [
    // The University named this office to open a staff record from an
    // accepted appointment.
    'open-staff-record',
    'handle-student-request',
    'assign-lecturers', 'build-timetable', 'manage-courses',
    'approve-credential-design', 'recompute-gpa',
    // THE ACADEMIC ADMISSION DECISION. This office signs page 1 of the
    // admission letter, so it is the office that takes the decision the
    // signature attests to. Nobody else holds this except the
    // Superadministrator, whose use of it is recorded as an override.
    'decide-admission',
    'admit-student', 'reject-application', 'request-documents',
    // Publication, alongside the Registrar, for the same reason 'admit-student'
    // is held by two offices: a term's results must not sit unpublished because
    // one desk is unstaffed. It holds ONLY the last step — it cannot moderate
    // or approve for a faculty, so it cannot walk a class through the chain
    // alone.
    'publish-results',
    'issue-credential',
    'forward-credential',
    'set-admission-openings',
    // THE ACADEMIC CALENDAR IS DELIBERATELY NOT HERE.
    //
    // It landed on this office once, by accident: a find-and-replace matched
    // the last three lines of the Registrar's list, which this office's list
    // ends with too, and granted `manage-academic-calendar` to both. Nothing
    // failed, nothing was logged, and the commit message said the capability
    // was the Registry's alone. That is the exact shape of the accidental
    // privilege grant this file exists to make visible.
    //
    // The reasoning stands as written: the year boundary is a fact about the
    // academic RECORD, and the record is the Registry's. This office decides
    // admissions and shapes the curriculum; it does not declare which year the
    // University is in.
    //
    // It does hold `manage-academic-structure` below, because the shape of the
    // academic tree IS its work.
    'manage-academic-structure',
    'publish-course-material',
  ],

  // Approves moderated marks on behalf of the faculty. Third of four.
  dean: ['view-admitted-students', 'approve-transfers', 'monitor-progress', 'approve-results'],

  // Enters marks AND declares a class finished — but cannot approve one, not
  // even their own. 'moderate-results' and everything after it are absent, and
  // that absence is the first link of the chain.
  lecturer: [
    'view-registered-students', 'upload-grades', 'submit-results',
    'take-attendance', 'access-lms',
    'publish-course-material',
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
  'hr-officer': 'HR Officer',
  'hr-administrator': 'HR Administrator',
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
