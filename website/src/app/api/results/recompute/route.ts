// ---------------------------------------------------------------------------
// Recomputing a student's grade point averages from their marks.
//
// WHY THIS ROUTE EXISTS. The classification engine was built and wired before
// it. src/lib/grading.ts computes grades, quality points, GPA, CGPA and the
// class of award from the university's published scale, and
// /api/credential/issue calls getClassification() and REFUSES to issue when it
// cannot, because the class of a degree is not a field a caller may state.
//
// Both read the cumulative GPA from semester_gpas — and nothing in this system
// ever wrote a row to it. Two readers, no writer. So the calculator was right,
// the refusal was right, and the input was empty: every issue attempt returned
// "no-cgpa" and the engine never fired once. From outside that is
// indistinguishable from there being no engine at all.
//
// WHERE THE ARITHMETIC WENT. Into src/lib/gpa.ts, because publication — the
// last step of the grade approval chain — has to recompute too, and the
// alternatives were a route calling itself over HTTP, the same CGPA implemented
// twice, or a Registrar expected to remember a second button. This route is now
// the manual entry point to a computation that also runs automatically when a
// class is published.
//
// POST { studentId }  recompute one student
// POST { all: true }  recompute every student who has any result
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';
import { recompute } from '@/lib/gpa';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  // 'recompute-gpa', which is the Registry's and the Academic Office's — NOT
  // the lecturer's 'upload-grades'. Posting a mark for one class and recomputing
  // every average in the university are different acts with different blast
  // radii, and one capability covering both would let any lecturer rewrite the
  // cumulative record of every student on the roll.
  const g = await guard(request, 'recompute-gpa');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin, caller } = g;

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

  const out = await recompute(
    admin,
    body.studentId ? [body.studentId] : null,
    caller?.id ?? null,
  );

  return NextResponse.json(out, { status: out.ok ? 200 : 500 });
}
