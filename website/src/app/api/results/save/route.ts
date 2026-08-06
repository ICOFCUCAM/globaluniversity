// ---------------------------------------------------------------------------
// Saving marks.
//
// WHY THIS ROUTE HAD TO EXIST BEFORE ANY APPROVAL CHAIN COULD WORK.
//
// The Grade Book and Result Processing both wrote marks straight from the
// browser: `supabase.from('results').insert(...)`. `results` has RLS enabled
// and, before migration 009, exactly one policy on it — a student may SELECT
// their own rows. There was no staff read policy and no write policy for
// anybody. So every one of those writes was refused, per row, by the database.
// Entering a class of marks failed silently in one component and with a wall of
// per-student errors in the other. The approval chain was not the only thing
// missing; there was nothing to approve.
//
// Migration 009 adds a staff READ policy and deliberately no write policy. All
// writing comes through here.
//
// WHY WRITING IS NOT SIMPLY OPENED UP IN RLS INSTEAD. Because the rule about
// who may change a mark is not expressible as a row predicate. It depends on
// the caller's capability, on which step of the chain the class is at, and on
// who has already signed it. RLS can see none of the first and cannot express
// the last, so the policy would have had to be "staff may update results" —
// which is not the rule and would let a lecturer edit a mark the Dean had
// already approved.
//
// WHAT THIS ROUTE REFUSES. Editing anything that is not a draft. Once a class
// is submitted it is closed; a correction means asking for it to be returned,
// and the return is recorded. That is the university's own rule from
// lifecycle.ts: "A lecturer may not alter a mark after step 2 without the chain
// being restarted, and the restart is itself recorded."
//
// POST { courseId, marks: [{ studentId, ca?, exam?, components?, scheme?,
//        totalScore, grade, gradePoint }] }
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';
import { isEditable, type ResultStatus } from '@/lib/resultsWorkflow';

export const runtime = 'nodejs';

interface Incoming {
  studentId: string;
  ca?: number | null;
  exam?: number | null;
  components?: unknown;
  scheme?: string | null;
  totalScore: number;
  grade: string;
  gradePoint: number;
}

export async function POST(request: Request) {
  const g = await guard(request, 'upload-grades');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin, caller } = g;

  let body: { courseId?: string; marks?: Incoming[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  const courseId = body.courseId;
  const marks = Array.isArray(body.marks) ? body.marks : [];
  if (!courseId) return NextResponse.json({ ok: false, error: 'no-course' }, { status: 400 });
  if (marks.length === 0) {
    return NextResponse.json({
      ok: false,
      error: 'nothing-to-save',
      detail: 'No marks were entered, so there was nothing to save.',
    }, { status: 400 });
  }

  // What already exists for this class, and at what stage. Read first so a
  // closed class is refused BEFORE anything is written — a partial save that
  // updates the drafts and rejects the rest would leave a class half-changed
  // with no way to tell which half.
  const { data: existing, error: readErr } = await admin
    .from('results')
    .select('id, student_id, status')
    .eq('course_id', courseId)
    .in('student_id', marks.map((m) => m.studentId));

  if (readErr) {
    return NextResponse.json({ ok: false, error: `read-failed: ${readErr.message}` }, { status: 500 });
  }

  const byStudent = new Map(
    ((existing ?? []) as Array<{ id: string; student_id: string; status: string }>)
      .map((r) => [r.student_id, r]),
  );

  const closed = marks
    .map((m) => byStudent.get(m.studentId))
    .filter((r): r is { id: string; student_id: string; status: string } =>
      !!r && !isEditable(r.status as ResultStatus));

  if (closed.length > 0) {
    return NextResponse.json({
      ok: false,
      error: 'class-not-editable',
      // Named, not counted. "3 marks are locked" tells a lecturer to go looking;
      // the student ids tell them where.
      locked: closed.map((r) => ({ studentId: r.student_id, status: r.status })),
      detail:
        `${closed.length} of these marks have already been submitted and can no longer be edited. `
        + 'Ask for the class to be returned — the return is recorded, and the chain restarts.',
    }, { status: 409 });
  }

  const rows = marks.map((m) => {
    const prior = byStudent.get(m.studentId);
    return {
      ...(prior ? { id: prior.id } : {}),
      student_id: m.studentId,
      course_id: courseId,
      ca_score: m.ca ?? null,
      exam_score: m.exam ?? null,
      // The components as entered, and the scheme they were entered under.
      // Storing the scheme is what lets a 2026 result still be read correctly
      // after the regulations change — without it a later scheme would
      // re-weight these marks and restate a grade the student never got.
      components: m.components ?? null,
      scheme: m.scheme ?? null,
      total_score: m.totalScore,
      grade: m.grade,
      grade_point: m.gradePoint,
      // Saving is not submitting. A half-entered class must not go forward for
      // moderation because the lecturer saved their work in progress.
      status: 'draft' as const,
      // Clearing these matters: a class that was returned and is being
      // re-entered should not still be carrying the objection that sent it back.
      returned_reason: null,
      submitted_by: null,
      submitted_at: null,
    };
  });

  const { error: writeErr } = await admin
    .from('results')
    .upsert(rows, { onConflict: 'student_id,course_id' });

  if (writeErr) {
    return NextResponse.json({
      ok: false,
      error: `save-failed: ${writeErr.message}`,
      detail: writeErr.message.includes('results_status_known')
        ? 'Run docs/migrations/009_results_approval.sql.'
        : undefined,
    }, { status: 500 });
  }

  await admin.from('audit_logs').insert({
    action: 'results.save',
    entity_type: 'course',
    entity_id: courseId,
    performed_by: caller?.id ?? null,
    details: { marks: rows.length },
  });

  return NextResponse.json({ ok: true, saved: rows.length });
}
