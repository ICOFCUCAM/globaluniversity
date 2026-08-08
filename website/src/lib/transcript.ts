// ---------------------------------------------------------------------------
// BUILDING A TRANSCRIPT FROM A STUDENT'S ACTUAL RECORD.
//
// ---------------------------------------------------------------------------
// WHAT THIS REPLACES
// ---------------------------------------------------------------------------
//
// The transcript screen rendered `sampleTranscriptData` and offered no way to
// choose a student. It could print a beautiful document for a person who does
// not exist and nothing else — the same state the certificate screen was in
// before it was given a candidate picker.
//
// ---------------------------------------------------------------------------
// WHY THE ARITHMETIC LIVES HERE AND NOT IN THE COMPONENT
// ---------------------------------------------------------------------------
//
// A transcript is the document a student is judged on by employers, by other
// universities and by immigration authorities, and every number on it is
// derived. Grade point × credit unit, summed per semester, divided by credits
// attempted — and then again cumulatively. Arithmetic written inline in a
// render function is arithmetic nobody ever tests, and a GPA that is wrong by
// 0.1 changes a classification.
//
// So it is a pure function over rows, and transcript.test.mjs checks it against
// worked examples including the ones that go wrong: a semester with no credits,
// a failed course, a course with no grade recorded yet.
//
// ---------------------------------------------------------------------------
// ONLY APPROVED RESULTS APPEAR
// ---------------------------------------------------------------------------
//
// Migration 009 built an approval chain — lecturer, HOD, dean, academic office
// — precisely so that a mark is not a fact about a student until four offices
// have said so. A transcript assembled from `results` regardless of `status`
// would publish marks still under deliberation, including ones a moderator was
// in the middle of sending back.
//
// `APPROVED_STATES` is the gate, and it is applied here rather than in the
// query so that a caller who forgets the filter still cannot leak a draft.
// ---------------------------------------------------------------------------

import type {
  TranscriptData, TranscriptYear, TranscriptSemester, TranscriptCourse,
  Student, Department,
} from '@/lib/types';
import { getClassification, PASS_MARK } from '@/lib/grading';

/**
 * The result states that may appear on an official transcript.
 *
 * 'published' is the end of the approval chain in migration 009. 'approved' is
 * accepted too because the chain's final office writes one or the other
 * depending on whether the class has been released to students — both mean the
 * mark has cleared every signatory.
 */
export const APPROVED_STATES = ['approved', 'published'] as const;

/** One row as the database returns it, joined to its course. */
export interface ResultRow {
  total_score: number | string | null;
  grade: string | null;
  grade_point: number | string | null;
  status: string | null;
  courses: {
    code: string;
    title: string;
    credit_unit: number | string | null;
    /** Academic year, 1-based. Undefined rows are gathered under year 0. */
    year: number | null;
    semester: number | null;
  } | null;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Whether this row may appear on an official transcript.
 *
 * A row with no course attached is dropped rather than shown as a blank line:
 * the join failed, and a transcript listing an unnamed course with a grade
 * against it is worse than one that omits it and does not add up — because the
 * second is noticed.
 */
export function isTranscriptable(r: ResultRow): boolean {
  return Boolean(r.courses?.code) && APPROVED_STATES.includes(r.status as never);
}

export interface BuildInput {
  student: Student;
  department: Department;
  results: readonly ResultRow[];
}

export interface BuildResult {
  data: TranscriptData;
  /**
   * What was left off, and why — shown to the registrar, never printed.
   *
   * A transcript that silently omits half a student's record is the failure
   * this exists to prevent. The registrar sees "6 results are still awaiting
   * approval and are not on this transcript" and can decide whether to issue.
   */
  omitted: { reason: string; count: number }[];
}

/**
 * Assemble the transcript.
 *
 * GROUPED BY YEAR THEN SEMESTER, in ascending order, because that is how a
 * transcript is read. Courses within a semester keep their code order so two
 * transcripts of the same record are identical — a registrar comparing a
 * reissue against the original must not have to reconcile a reordering.
 */
export function buildTranscript({ student, department, results }: BuildInput): BuildResult {
  const usable = results.filter(isTranscriptable);

  const pendingCount = results.filter(
    (r) => r.courses?.code && !APPROVED_STATES.includes(r.status as never),
  ).length;
  const orphanCount = results.filter((r) => !r.courses?.code).length;

  const omitted: { reason: string; count: number }[] = [];
  if (pendingCount > 0) {
    omitted.push({
      reason: 'still in the approval chain — not yet a mark the University has confirmed',
      count: pendingCount,
    });
  }
  if (orphanCount > 0) {
    omitted.push({
      reason: 'no course record attached, so the line could not be named',
      count: orphanCount,
    });
  }

  // year -> semester -> courses
  const byYear = new Map<number, Map<number, TranscriptCourse[]>>();

  for (const r of usable) {
    const c = r.courses!;
    // A course with no year or semester recorded still belongs on the
    // transcript — it is a mark the student earned. It is gathered under 0,
    // which the component labels rather than hiding.
    const year = num(c.year);
    const semester = num(c.semester);
    const creditUnit = num(c.credit_unit);
    const gradePoint = num(r.grade_point);

    const course: TranscriptCourse = {
      code: c.code,
      title: c.title,
      creditUnit,
      // A row that cleared approval with no letter grade recorded is a data
      // fault, not a pass. Marked so it is visible rather than blank.
      grade: r.grade ?? '—',
      gradePoint,
      qualityPoint: gradePoint * creditUnit,
    };

    if (!byYear.has(year)) byYear.set(year, new Map());
    const sems = byYear.get(year)!;
    if (!sems.has(semester)) sems.set(semester, []);
    sems.get(semester)!.push(course);
  }

  const years: TranscriptYear[] = Array.from(byYear.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, sems]) => ({
      year,
      semesters: Array.from(sems.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([semester, courses]) => {
          const ordered = [...courses].sort((a, b) => a.code.localeCompare(b.code));
          const totalCredits = ordered.reduce((t, c) => t + c.creditUnit, 0);
          const totalGradePoints = ordered.reduce((t, c) => t + c.qualityPoint, 0);
          return {
            semester,
            courses: ordered,
            totalCredits,
            totalGradePoints,
            // DIVIDE BY ZERO IS THE CASE THAT ACTUALLY HAPPENS — a semester of
            // zero-credit courses, or one course with its credit unit unset.
            // NaN renders as "NaN" on a printed transcript.
            gpa: totalCredits > 0 ? round2(totalGradePoints / totalCredits) : 0,
          } satisfies TranscriptSemester;
        }),
    }));

  const allCourses = years.flatMap((y) => y.semesters.flatMap((s) => s.courses));
  const totalCredits = allCourses.reduce((t, c) => t + c.creditUnit, 0);
  const totalQualityPoints = allCourses.reduce((t, c) => t + c.qualityPoint, 0);
  const cgpa = totalCredits > 0 ? round2(totalQualityPoints / totalCredits) : 0;

  return {
    data: {
      student,
      department,
      years,
      totalCredits,
      cgpa,
      // The same function the certificate uses. Two documents about one student
      // disagreeing on their class is the failure that ends up in a complaint.
      classification: getClassification(cgpa),
    },
    omitted,
  };
}

/**
 * Two decimal places, without floating-point noise.
 *
 * 3.665 must not become 3.66 because it is held as 3.6649999999999996 — a
 * classification boundary is exactly where that lands.
 */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Credits earned — passed courses only.
 *
 * Separate from `totalCredits`, which is credits ATTEMPTED. A transcript prints
 * both and they are not the same number for any student who has failed
 * anything; conflating them overstates the record.
 */
export function creditsEarned(results: readonly ResultRow[]): number {
  return results
    .filter(isTranscriptable)
    .filter((r) => num(r.total_score) >= PASS_MARK)
    .reduce((t, r) => t + num(r.courses?.credit_unit), 0);
}

/**
 * Is there enough here to issue a transcript at all?
 *
 * AN EMPTY TRANSCRIPT IS NOT A TRANSCRIPT. Sealing one and putting it on the
 * register creates a permanent, verifiable University document stating that a
 * student has completed nothing — and because the register never overwrites,
 * that document exists for ever even after it is superseded.
 */
export function canIssueTranscript(data: TranscriptData): string | null {
  const courses = data.years.flatMap((y) => y.semesters.flatMap((s) => s.courses));
  if (courses.length === 0) {
    return 'This student has no approved results. A transcript with no courses on it is not a '
      + 'transcript, and issuing one would put a permanent University document on the register '
      + 'stating they have completed nothing.';
  }
  if (data.totalCredits === 0) {
    return 'Every approved course for this student carries zero credits, so the transcript would '
      + 'print a GPA of 0.00 against real marks. Check the courses’ credit units before issuing.';
  }
  return null;
}
