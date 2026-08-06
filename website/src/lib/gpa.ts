// ---------------------------------------------------------------------------
// Recomputing grade point averages from marks.
//
// WHY THIS IS A MODULE AND NOT ONLY A ROUTE. It was the body of
// /api/results/recompute, which a person calls. Publication — the last step of
// the approval chain — also has to recompute, because the whole point of
// approving a class is that the averages it feeds become approved averages, and
// a certificate can then be issued.
//
// Leaving the logic in the route would have meant one of three things, all bad:
// the publish route makes an HTTP call to itself (fragile in a serverless
// deployment, and it has to forge or forward a token); or the arithmetic is
// written a second time (two implementations of a CGPA, drifting); or the
// Registrar publishes a class and is then expected to remember a second button,
// which is the same failure this chain was built to end — a correct approval
// that still cannot produce a certificate.
//
// So the computation lives here, both callers use it, and there is exactly one
// definition of what a cumulative average is.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateGPA, PASS_MARK } from './grading';

/** A result joined to the credit it carries and the term it was taken in. */
export interface Mark {
  student_id: string;
  total_score: number | null;
  grade_point: number | null;
  status: string | null;
  credit_unit: number;
  academic_year: number;
  semester: number;
}

export interface GpaRow {
  student_id: string;
  academic_year: number;
  semester: number;
  gpa: number;
  cgpa: number;
  credits_attempted: number;
  credits_earned: number;
  basis: 'approved' | 'provisional';
  computed_by: string | null;
}

/**
 * Every semester average for one student, and the running cumulative average.
 *
 * THE CUMULATIVE FIGURE IS NOT AN AVERAGE OF THE SEMESTER AVERAGES. That is the
 * mistake this function exists to avoid: averaging the averages weights a
 * three-credit semester the same as a thirty-credit one, and a student who took
 * one course badly in a short term would have it count as heavily as a full
 * year of good work. The CGPA is quality points over credits, cumulatively,
 * from the beginning.
 */
export function computeForStudent(marks: Mark[], computedBy: string | null): GpaRow[] {
  // Group by term, and order terms chronologically so the running total is
  // actually running.
  const byTerm = new Map<string, Mark[]>();
  for (const m of marks) {
    const key = `${m.academic_year}:${m.semester}`;
    const list = byTerm.get(key);
    if (list) list.push(m);
    else byTerm.set(key, [m]);
  }

  const terms = Array.from(byTerm.entries())
    .map(([key, list]) => {
      const [year, sem] = key.split(':').map(Number);
      return { year, sem, list };
    })
    .sort((a, b) => (a.year - b.year) || (a.sem - b.sem));

  let cumQP = 0;
  let cumCU = 0;
  const rows: GpaRow[] = [];

  for (const term of terms) {
    const courses = term.list.map((m) => ({
      gradePoint: Number(m.grade_point ?? 0),
      creditUnit: Number(m.credit_unit ?? 0),
    }));
    const gpa = calculateGPA(courses);

    const attempted = term.list.reduce((s, m) => s + Number(m.credit_unit ?? 0), 0);
    const earned = term.list.reduce(
      (s, m) => s + (Number(m.total_score ?? 0) >= PASS_MARK ? Number(m.credit_unit ?? 0) : 0),
      0,
    );

    cumQP += term.list.reduce(
      (s, m) => s + Number(m.grade_point ?? 0) * Number(m.credit_unit ?? 0),
      0,
    );
    cumCU += attempted;
    const cgpa = cumCU === 0 ? 0 : Number((cumQP / cumCU).toFixed(2));

    rows.push({
      student_id: term.list[0].student_id,
      academic_year: term.year,
      semester: term.sem,
      gpa,
      cgpa,
      credits_attempted: attempted,
      credits_earned: earned,
      // 'approved' only when EVERY mark counted in this term has been through
      // the chain. One unapproved mark makes the whole average provisional —
      // there is no such thing as a mostly-approved average, and a certificate
      // may not rest on one.
      basis: term.list.every((m) => m.status === 'approved') ? 'approved' : 'provisional',
      computed_by: computedBy,
    });
  }

  return rows;
}

export interface RecomputeResult {
  ok: boolean;
  error?: string;
  detail?: string;
  students: number;
  rows: number;
  approved: number;
  provisional: number;
  /** Marks with no enrolment, so no term, so no average can place them. */
  unplaceable: number;
}

/**
 * Read marks, compute averages, write them.
 *
 * `studentIds` empty means every student who has any result.
 *
 * REQUIRES THE SERVICE ROLE. `semester_gpas` has RLS on with no write policy —
 * no browser can write a GPA, deliberately: a GPA that can be written directly
 * is a GPA that can be TYPED, and a classification derived from a typed GPA is
 * a classification somebody chose rather than one the marks produced.
 *
 * It accepts no figures. It accepts students, reads their marks, and computes.
 */
export async function recompute(
  db: SupabaseClient,
  studentIds: string[] | null,
  computedBy: string | null,
): Promise<RecomputeResult> {
  const empty = { students: 0, rows: 0, approved: 0, provisional: 0, unplaceable: 0 };

  // Nothing named is not the same as everyone. An empty array reaching here
  // means "these students" with none in it, and recomputing the whole
  // university because a caller passed an empty list is the kind of helpfulness
  // that rewrites every average on the roll.
  if (studentIds && studentIds.length === 0) {
    return { ok: true, ...empty, detail: 'No students were named, so nothing was recomputed.' };
  }

  // The TERM comes from the enrolment, not the result. A result carries a mark;
  // it does not carry a calendar, and the same course is taught in different
  // years to different cohorts. Reading the year off the course would put every
  // student who ever sat CS101 into the same semester.
  let q = db
    .from('results')
    .select('student_id, total_score, grade_point, status, courses(credit_unit), enrollments(academic_year, semester)');
  if (studentIds) q = q.in('student_id', studentIds);

  const { data, error } = await q;
  if (error) {
    return { ok: false, error: `results-read-failed: ${error.message}`, ...empty };
  }

  // A result with no enrolment has no term, and a GPA is a per-term figure — so
  // it cannot be placed. Counted and reported rather than dropped silently: a
  // mark that vanishes from an average is the worst possible thing to hide.
  const usable: Mark[] = [];
  let unplaceable = 0;
  for (const r of (data ?? []) as unknown as Array<Record<string, unknown>>) {
    const enr = r.enrollments as { academic_year: number | null; semester: number | null } | null;
    const crs = r.courses as { credit_unit: number | null } | null;
    if (!enr || enr.academic_year == null || enr.semester == null) { unplaceable += 1; continue; }
    usable.push({
      student_id: String(r.student_id),
      total_score: r.total_score as number | null,
      grade_point: r.grade_point as number | null,
      status: r.status as string | null,
      credit_unit: Number(crs?.credit_unit ?? 0),
      academic_year: Number(enr.academic_year),
      semester: Number(enr.semester),
    });
  }

  const byStudent = new Map<string, Mark[]>();
  for (const m of usable) {
    const list = byStudent.get(m.student_id);
    if (list) list.push(m);
    else byStudent.set(m.student_id, [m]);
  }

  const rows: GpaRow[] = [];
  for (const marks of Array.from(byStudent.values())) {
    rows.push(...computeForStudent(marks, computedBy));
  }

  if (rows.length === 0) {
    return {
      ok: true,
      ...empty,
      unplaceable,
      detail: unplaceable > 0
        ? `No average could be computed. ${unplaceable} result(s) are not linked to an enrolment, so there is no term to place them in.`
        : 'No results found for the students named, so there was nothing to compute.',
    };
  }

  const { error: writeErr } = await db
    .from('semester_gpas')
    .upsert(rows, { onConflict: 'student_id,academic_year,semester' });

  if (writeErr) {
    return {
      ok: false,
      error: `gpa-write-failed: ${writeErr.message}`,
      detail: writeErr.message.includes('semester_gpas')
        ? 'The semester_gpas table may not exist. Run docs/migrations/007_gpa_engine.sql.'
        : undefined,
      ...empty,
      unplaceable,
    };
  }

  const approved = rows.filter((r) => r.basis === 'approved').length;

  return {
    ok: true,
    students: byStudent.size,
    rows: rows.length,
    approved,
    provisional: rows.length - approved,
    unplaceable,
    // Said plainly, because it is the difference between an average a student
    // may look at and an average a degree may rest on.
    detail: approved === 0
      ? 'Every average is PROVISIONAL: no result counted has been through the approval chain, so '
        + 'no certificate can be issued on these figures. Marks are approved in '
        + 'Records → Result approval: lecturer submits, Head of Department moderates, Dean '
        + 'approves, Registrar publishes.'
      : undefined,
  };
}
