// ---------------------------------------------------------------------------
// Recomputing a student's grade point averages from their marks.
//
// WHY THIS ROUTE EXISTS, AND WHY IT IS THE ONLY WRITER.
//
// The classification engine was built and wired before this. src/lib/grading.ts
// computes grades, quality points, GPA, CGPA and the class of award from the
// university's published scale. /api/credential/issue calls getClassification()
// and REFUSES to issue when it cannot, because the class of a degree is not a
// field a caller may state.
//
// Both read the cumulative GPA from semester_gpas — and nothing in this system
// ever wrote a row to it. Two readers, no writer. So the calculator was right,
// the refusal was right, and the input was empty: every issue attempt returned
// "no-cgpa" and the engine never fired once. From outside that is
// indistinguishable from there being no engine at all.
//
// This is the writer. It is server-side and holds the service role, because
// semester_gpas has RLS on and no write policy — no browser can write a GPA.
// That is deliberate: a GPA that can be written directly is a GPA that can be
// TYPED, and a classification derived from a typed GPA is a classification
// somebody chose rather than one the marks produced.
//
// It accepts no figures. It accepts a student, reads their marks, and computes.
//
// POST { studentId }  recompute one student
// POST { all: true }  recompute every student who has any result
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';
import { calculateGPA, PASS_MARK } from '@/lib/grading';

export const runtime = 'nodejs';

/** A result joined to the credit and the term it was taken in. */
interface Mark {
  student_id: string;
  total_score: number | null;
  grade_point: number | null;
  status: string | null;
  credit_unit: number;
  academic_year: number;
  semester: number;
}

interface Row {
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
function computeForStudent(marks: Mark[], computedBy: string | null): Row[] {
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
  const rows: Row[] = [];

  for (const term of terms) {
    const courses = term.list.map((m: Mark) => ({
      gradePoint: Number(m.grade_point ?? 0),
      creditUnit: Number(m.credit_unit ?? 0),
    }));
    const gpa = calculateGPA(courses);

    const attempted = term.list.reduce((s: number, m: Mark) => s + Number(m.credit_unit ?? 0), 0);
    const earned = term.list.reduce(
      (s: number, m: Mark) => s + (Number(m.total_score ?? 0) >= PASS_MARK ? Number(m.credit_unit ?? 0) : 0),
      0,
    );

    cumQP += term.list.reduce(
      (s: number, m: Mark) => s + Number(m.grade_point ?? 0) * Number(m.credit_unit ?? 0),
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
      basis: term.list.every((m: Mark) => m.status === 'approved') ? 'approved' : 'provisional',
      computed_by: computedBy,
    });
  }

  return rows;
}

export async function POST(request: Request) {
  // 'recompute-gpa', which is the Registry's and the Academic Office's — NOT
  // the lecturer's 'upload-grades'. Posting a mark for one class and recomputing
  // every average in the university are different acts with different blast
  // radii, and one capability covering both would let any lecturer rewrite the
  // cumulative record of every student on the roll.
  const g = await guard(request, 'recompute-gpa');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin, caller } = g;
  const db = admin;

  let body: { studentId?: string; all?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  if (!body.studentId && !body.all) {
    return NextResponse.json({
      ok: false,
      error: 'nothing-named',
      detail: 'Name a studentId, or pass { "all": true } to recompute everyone who has results.',
    }, { status: 400 });
  }

  // The marks, with the credit they carry and the term they were taken in.
  //
  // The TERM comes from the enrolment, not the result. A result carries a mark;
  // it does not carry a calendar, and the same course is taught in different
  // years to different cohorts. Reading the year off the course would put every
  // student who ever sat CS101 into the same semester.
  let q = db
    .from('results')
    .select('student_id, total_score, grade_point, status, courses(credit_unit), enrollments(academic_year, semester)');
  if (body.studentId) q = q.eq('student_id', body.studentId);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ ok: false, error: `results-read-failed: ${error.message}` }, { status: 500 });
  }

  // A result with no enrolment has no term, and a GPA is a per-term figure —
  // so it cannot be placed. Counted and reported rather than dropped silently:
  // a mark that vanishes from an average is the worst possible thing to hide.
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

  const rows: Row[] = [];
  for (const marks of Array.from(byStudent.values())) {
    rows.push(...computeForStudent(marks, caller?.id ?? null));
  }

  if (rows.length === 0) {
    return NextResponse.json({
      ok: true,
      students: 0,
      rows: 0,
      unplaceable,
      detail: unplaceable > 0
        ? `No average could be computed. ${unplaceable} result(s) are not linked to an enrolment, so there is no term to place them in.`
        : 'No results found for the students named, so there was nothing to compute.',
    });
  }

  const { error: writeErr } = await admin
    .from('semester_gpas')
    .upsert(rows, { onConflict: 'student_id,academic_year,semester' });

  if (writeErr) {
    return NextResponse.json({
      ok: false,
      error: `gpa-write-failed: ${writeErr.message}`,
      detail: writeErr.message.includes('semester_gpas')
        ? 'The semester_gpas table may not exist. Run docs/migrations/007_gpa_engine.sql.'
        : undefined,
    }, { status: 500 });
  }

  const approved = rows.filter((r) => r.basis === 'approved').length;

  return NextResponse.json({
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
        + 'no certificate can be issued on these figures. The approval chain (lecturer → HOD → '
        + 'Dean → Registrar) has no interface yet; marks are saved as drafts and stay there.'
      : undefined,
  });
}
