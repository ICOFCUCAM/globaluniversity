// ---------------------------------------------------------------------------
// MAY THIS STUDENT REGISTER FOR THIS COURSE?
//
// ===========================================================================
// WHY THIS EXISTS NOW
// ===========================================================================
//
// The Bachelor of Ministry is the first programme this university publishes
// with a prerequisite chain. Thirty-four courses, twenty-three of them gated on
// something a student must already have done.
//
// Before this module the chain lived in exactly one place — a column of prose
// on a web page — and nothing could act on it. `courses` had no column for it
// (migration 011 adds one) and no code read it. A published rule that nothing
// enforces is worse than no rule at all: the university has announced a
// requirement, a student registers for MIN 201 without MIN 101, passes it, and
// finds out at the graduation audit that the credit does not count. The remedy
// at that point is a year.
//
// ===========================================================================
// PURE, AND DELIBERATELY NOT TALKING TO THE DATABASE
// ===========================================================================
//
// This takes a transcript and a course and returns a verdict. It does not query
// Supabase, does not know about sessions, and cannot fail at runtime.
//
// That matters because this rule is needed in three places that have nothing in
// common: the registration screen when a student picks courses (which does not
// exist yet — see below), the registry's bulk enrolment, and the graduation
// audit that asks whether the credit a student holds was validly earned. A rule
// welded to one screen gets reimplemented slightly differently in the other
// two, and then a student's eligibility depends on which door they came in by.
//
// NOTHING CALLS IT FROM A SCREEN YET, AND THAT IS SAID PLAINLY. This portal has
// an `enrollments` table, a results pipeline and a graduation audit, but no
// course-registration interface: enrolments are read everywhere and written
// nowhere. When that screen is built, this is the check it makes. Publishing
// the rule as testable code before the screen exists is the right order — the
// alternative is a screen shipped with the rule inlined and untested.
// ---------------------------------------------------------------------------

/** What a course demands before a student may take it. */
export interface CourseRequirement {
  code: string;
  /** Course codes named as prerequisites. */
  requires: string[];
  /**
   * How to read that list. 'any' means one of them suffices — the framework's
   * "BIB 101 or BIB 102". Defaults to 'all', which is what a comma means.
   */
  requiresMode?: 'all' | 'any';
  /** A credit threshold rather than a named course — "At least 60 ECTS". */
  requiresEcts?: number;
  /**
   * Courses that must be taken ALONGSIDE this one rather than before it.
   *
   * Empty everywhere today. The published framework names two prerequisites
   * that cannot be satisfied as written — FIN 201 → ADM 201 and
   * COM 302 → MIS 301, each naming a course in its own semester — and the
   * School's recommended resolution is to redesignate them here. That is the
   * University's decision to take, so this is ready and unused rather than
   * quietly filled in.
   */
  coRequisites?: string[];
}

/** What the student has actually done. */
export interface StudentRecord {
  /** Course codes passed, in any order. */
  passed: string[];
  /** Credits earned so far, in the same unit the threshold is stated in. */
  creditsEarned: number;
  /** Course codes the student is registering for in the same term. */
  registeringFor?: string[];
}

export interface Eligibility {
  eligible: boolean;
  /**
   * Why not, in words a student can act on.
   *
   * ONE SENTENCE PER REASON, NAMING THE COURSE. "Prerequisites not met" tells a
   * student they cannot proceed and nothing about what to do; "You must first
   * pass MIN 101 Introduction to Christian Ministry" tells them their next
   * step. A registration screen that cannot say what is missing generates a
   * support ticket for every refusal.
   */
  reasons: string[];
  /** Prerequisite codes the student does not hold. */
  missing: string[];
}

/**
 * ELIGIBLE ONLY IF EVERY CONDITION HOLDS, and every failing condition is
 * reported rather than the first.
 *
 * A check that returns on the first failure makes a student re-submit to
 * discover the second, which is the single most common way a registration
 * screen becomes hated. All the reasons come back at once.
 */
export function checkEligibility(
  course: CourseRequirement,
  student: StudentRecord,
): Eligibility {
  const reasons: string[] = [];
  const missing: string[] = [];

  // Case matters nowhere in a course code, and a registry that refuses
  // "min 101" because the catalogue says "MIN 101" is refusing on a keystroke.
  const held = new Set(student.passed.map((c) => c.trim().toUpperCase()));
  const has = (code: string) => held.has(code.trim().toUpperCase());

  const mode = course.requiresMode ?? 'all';
  if (course.requires.length) {
    if (mode === 'any') {
      if (!course.requires.some(has)) {
        missing.push(...course.requires);
        reasons.push(`You must first pass one of ${course.requires.join(' or ')}.`);
      }
    } else {
      const absent = course.requires.filter((c) => !has(c));
      if (absent.length) {
        missing.push(...absent);
        reasons.push(
          absent.length === 1
            ? `You must first pass ${absent[0]}.`
            : `You must first pass ${absent.slice(0, -1).join(', ')} and ${absent[absent.length - 1]}.`,
        );
      }
    }
  }

  if (course.requiresEcts !== undefined && student.creditsEarned < course.requiresEcts) {
    reasons.push(
      `${course.code} requires ${course.requiresEcts} credits; you have ${student.creditsEarned}.`,
    );
  }

  // A CO-REQUISITE IS SATISFIED BY EITHER HAVING DONE IT OR DOING IT NOW.
  // That is the whole difference from a prerequisite, and getting it wrong in
  // the lenient direction — accepting a co-requisite that is neither held nor
  // being taken — would make the field decorative.
  const alongside = new Set((student.registeringFor ?? []).map((c) => c.trim().toUpperCase()));
  for (const co of course.coRequisites ?? []) {
    const key = co.trim().toUpperCase();
    if (!held.has(key) && !alongside.has(key)) {
      missing.push(co);
      reasons.push(`${co} must be taken alongside ${course.code}, or already passed.`);
    }
  }

  return { eligible: reasons.length === 0, reasons, missing };
}

/**
 * The courses a student may register for, out of a catalogue.
 *
 * NOT "the courses they should take". This answers permission, not advice — a
 * student may be eligible for a course three semesters ahead of them. Ordering
 * and recommendation belong to the adviser and to the published plan.
 */
export function eligibleCourses<T extends CourseRequirement>(
  catalogue: T[],
  student: StudentRecord,
): T[] {
  return catalogue.filter((c) => checkEligibility(c, student).eligible);
}

/**
 * Everything still owed against a programme, for the graduation audit.
 *
 * Counted from the catalogue rather than from a stated total, so a course added
 * to the curriculum is owed by every student who has not taken it, without
 * anyone remembering to change a number.
 */
export function outstanding<T extends CourseRequirement & { ects?: number }>(
  catalogue: T[],
  student: StudentRecord,
): { courses: T[]; credits: number } {
  const held = new Set(student.passed.map((c) => c.trim().toUpperCase()));
  const courses = catalogue.filter((c) => !held.has(c.code.trim().toUpperCase()));
  return { courses, credits: courses.reduce((n, c) => n + (c.ects ?? 0), 0) };
}
