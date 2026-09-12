// ---------------------------------------------------------------------------
// WHAT BECAME OF A STUDENT, WHICH IS NOT WHAT BECAME OF THEIR APPLICATION.
//
// ---------------------------------------------------------------------------
// THE FAULT THIS SPLITS APART
// ---------------------------------------------------------------------------
//
// `students.status` carried two different vocabularies in one column.
//
//   The ADMISSION pipeline    draft, applicant, under_review, fee_paid,
//                             approved, rejected, admission_issued, enrolled …
//   What became of a STUDENT  active, graduated, suspended, withdrawn
//
// One column, no CHECK constraint, and two of the words in both lists:
//
//   `withdrawn`  an applicant who wrote to say they no longer wanted the place,
//                and a student who left in their second year. 034 gave the
//                Registrar a withdrawal action and it wrote this word, so from
//                that day the two were genuinely indistinguishable.
//   `deferred`   an offer held over to a later intake, and — in
//                STUDENT_STATUSES — something meant to describe a student. Only
//                the first of those is real, so the second is gone.
//
// The consequences were not theoretical. Certificate issuance gated on
// `status = 'graduated'`, so a row could not be both graduated and enrolled and
// the enrolment had to be overwritten to confer the degree. The dashboards
// counted students with `status in ('approved','conditional','enrolled','active')`
// — four values meaning four different things, one list, because no single
// value meant "is a student here".
//
// ---------------------------------------------------------------------------
// SO: TWO COLUMNS, EACH WITH ONE JOB
// ---------------------------------------------------------------------------
//
//   students.status          the admission state. Settled once, and then it is
//                            history: an enrolled student stays `enrolled`
//                            forever, because they were.
//   students.student_status  what became of them since. NULL until they enrol,
//                            because somebody who has not enrolled is not yet a
//                            student and pretending otherwise is how `active`
//                            ended up meaning four things.
//
// A student who leaves is `enrolled` / `withdrawn`. An applicant who leaves is
// `withdrawn` / NULL. Those are now different rows rather than the same row.
// ---------------------------------------------------------------------------

/**
 * What became of a student. Closed, and enforced in the database by 037.
 *
 * `deferred` is deliberately absent. It was in the old list and it is an
 * ADMISSION outcome — an offer held to a later intake — which is why it
 * belongs to `status` and appears in ADMISSION_STATES instead. A student on a
 * leave of absence is a thing the University has not asked for and this file
 * does not invent one.
 */
export const STUDENT_STATUSES = ['active', 'graduated', 'suspended', 'withdrawn'] as const;

export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  active: 'Active',
  graduated: 'Graduated',
  suspended: 'Suspended',
  withdrawn: 'Withdrawn',
};

/**
 * The four values that used to live in `students.status` and now do not.
 *
 * READING A DATABASE THAT HAS NOT HAD 037 YET. The migration moves these out of
 * `status`; until it runs, they are still there. Every reader below prefers
 * `student_status` and falls back to this, so a deployment that gets ahead of
 * the SQL shows the right thing rather than an empty column — which is the
 * failure mode that makes people distrust a migration and put off running it.
 */
const LEGACY_IN_STATUS: Record<string, StudentStatus> = {
  active: 'active',
  graduated: 'graduated',
  suspended: 'suspended',
  // NOT `withdrawn`. In the old column it could mean either an applicant or a
  // student, and guessing would be the exact ambiguity this file exists to end.
  // An unmigrated `withdrawn` row reads as "not a student", which is the safe
  // way to be wrong: it under-counts rather than conferring anything.
};

export interface StatusCarrier {
  status?: string | null;
  student_status?: string | null;
}

export function isStudentStatus(v: unknown): v is StudentStatus {
  return typeof v === 'string' && (STUDENT_STATUSES as readonly string[]).includes(v);
}

/** What became of this person, or null if they are not a student yet. */
export function studentStatusOf(row: StatusCarrier | null | undefined): StudentStatus | null {
  if (!row) return null;
  if (isStudentStatus(row.student_status)) return row.student_status;
  return LEGACY_IN_STATUS[String(row.status ?? '')] ?? null;
}

/**
 * Whether this row is a student of the University at all.
 *
 * THE QUESTION THE DASHBOARDS WERE ASKING BADLY. They listed four admission
 * states and hoped. Enrolment is the answer: somebody the Registrar has
 * enrolled is a student, and somebody the Head of Academic Affairs has approved
 * is an applicant holding an offer.
 */
export function isStudent(row: StatusCarrier | null | undefined): boolean {
  return studentStatusOf(row) !== null || row?.status === 'enrolled';
}

/** Whether a certificate may be conferred on this record. */
export function hasGraduated(row: StatusCarrier | null | undefined): boolean {
  return studentStatusOf(row) === 'graduated';
}

/**
 * Whether this row is on the roll — a student the University currently teaches.
 *
 * Graduated is NOT on the roll and neither is withdrawn. Suspended IS: a
 * suspended student is still the University's student, which is the whole
 * difference between a suspension and an expulsion.
 */
export function isOnRoll(row: StatusCarrier | null | undefined): boolean {
  const s = studentStatusOf(row);
  return s === 'active' || s === 'suspended';
}
