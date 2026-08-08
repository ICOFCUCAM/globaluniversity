// ---------------------------------------------------------------------------
// MARKING AND MODERATING AN EXAMINATION SCRIPT.
//
// POST { sessionId, marks: [{ questionId?, questionNumber?, mark, outOf, comment? }] }
// POST { sessionId, moderate: [{ markId, moderatedMark, note? }] }
//
// ---------------------------------------------------------------------------
// THIS DOES NOT REPLACE THE GRADE APPROVAL CHAIN. IT FEEDS IT.
// ---------------------------------------------------------------------------
//
// Migration 009 built the University's four-office chain — lecturer submits,
// Head of Department moderates, Dean approves for the faculty, Registrar
// publishes — and a transcript is produced from the marks that complete it.
//
// An examination mark that stopped here would be a number in a table nobody
// downstream reads: the GPA would not move, the transcript would not show it,
// and no certificate could be issued against it. Everything would appear to
// work. So the examination mark is written into `results` as well, and travels
// the chain that already exists.
//
// ---------------------------------------------------------------------------
// A MODERATOR MAY NOT MODERATE THEIR OWN MARKING
// ---------------------------------------------------------------------------
//
// Checked here, and again by a trigger in 015. Moderation is a second opinion,
// and there is no second opinion in one head.
//
// A moderator who CHANGES a mark must say why; one who agrees need not. The
// asymmetry is deliberate: agreement adds no information, and a required
// justification for it would produce a column full of the word "agreed".
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let g = await guard(request, 'mark-examination');
  let moderating = false;

  if (!g.ok) {
    const mod = await guard(request, 'moderate-examination');
    if (!mod.ok) {
      return NextResponse.json({
        ok: false,
        error: g.error,
        detail: 'Marking is for examiners; moderating is for moderators.',
      }, { status: g.status });
    }
    g = mod;
    moderating = true;
  }
  const { admin, caller } = g;

  let input: {
    sessionId?: string;
    marks?: Array<{ questionId?: string | null; questionNumber?: number; mark: number; outOf: number; comment?: string }>;
    moderate?: Array<{ markId: string; moderatedMark: number; note?: string }>;
  };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  // -------------------------------------------------------------------------
  // MODERATION
  // -------------------------------------------------------------------------
  if (input.moderate?.length) {
    const results = await Promise.all(input.moderate.map(async (m) => {
      const { data: existing } = await admin
        .from('exam_marks')
        .select('id, mark, out_of, marked_by, session_id')
        .eq('id', m.markId)
        .maybeSingle();

      if (!existing) return { id: m.markId, error: 'not found' };

      if (existing.marked_by === caller.id) {
        return {
          id: m.markId,
          error: 'you awarded this mark, so you cannot moderate it — there is no second opinion in one head',
        };
      }

      const changed = Number(m.moderatedMark) !== Number(existing.mark);
      if (changed && !m.note?.trim()) {
        return { id: m.markId, error: 'changing a mark requires a note saying why' };
      }

      const { error } = await admin.from('exam_marks').update({
        moderated_by: caller.id,
        moderated_at: new Date().toISOString(),
        moderated_mark: m.moderatedMark,
        moderation_note: m.note?.trim() || null,
      }).eq('id', m.markId);

      if (error) return { id: m.markId, error: error.message };

      await admin.from('exam_audit_events').insert({
        session_id: existing.session_id,
        action: 'mark.moderated',
        actor_id: caller.id, actor_role: caller.role, actor_email: caller.email,
        // THE SIX-PART RECORD. Before and after are the part most systems omit,
        // and the only part an appeal can use.
        before_state: { mark: existing.mark },
        after_state: { mark: m.moderatedMark },
        reason: m.note?.trim() || 'Moderator agreed with the mark as awarded.',
      });

      return { id: m.markId, ok: true, changed };
    }));

    const refused = results.filter((r) => 'error' in r && r.error);
    return NextResponse.json({
      ok: refused.length === 0,
      moderated: results.filter((r) => 'ok' in r).length,
      refused,
      detail: refused.length ? refused.map((r) => `${r.id}: ${(r as any).error}`).join('; ') : undefined,
      message: refused.length === 0
        ? `Moderated. ${results.filter((r: any) => r.changed).length} mark(s) changed, and every change carries its reason.`
        : undefined,
    }, { status: refused.length ? 422 : 200 });
  }

  // -------------------------------------------------------------------------
  // MARKING
  // -------------------------------------------------------------------------
  if (moderating) {
    return NextResponse.json({
      ok: false,
      error: 'not-permitted',
      detail: 'A moderator second-marks; the first mark is an examiner’s.',
    }, { status: 403 });
  }

  if (!input.sessionId || !input.marks?.length) {
    return NextResponse.json({ ok: false, error: 'incomplete' }, { status: 400 });
  }

  const { data: session } = await admin
    .from('exam_sessions')
    .select('id, status, student_id, examination_id, examinations(course_id, total_marks)')
    .eq('id', input.sessionId)
    .maybeSingle();

  if (!session) return NextResponse.json({ ok: false, error: 'not-found' }, { status: 404 });

  // A SITTING STILL RUNNING CANNOT BE MARKED. Marking a paper the candidate is
  // still writing means marking a snapshot, and the candidate would be graded
  // on work they had not finished.
  if (!['submitted', 'terminated', 'abandoned'].includes(session.status)) {
    return NextResponse.json({
      ok: false,
      error: 'not-finished',
      detail: `This sitting is ${session.status.replace('_', ' ')}. A script is marked after it is submitted.`,
    }, { status: 409 });
  }

  const rows = input.marks.map((m) => ({
    session_id: session.id,
    question_id: m.questionId ?? null,
    question_number: m.questionNumber ?? null,
    mark: m.mark,
    out_of: m.outOf,
    comment: m.comment?.trim() || null,
    marked_by: caller.id,
  }));

  const { error } = await admin.from('exam_marks').upsert(rows, { onConflict: 'session_id,question_id' });

  if (error) {
    return NextResponse.json({
      ok: false,
      error: 'not-marked',
      detail: error.message.includes('exam_marks_range')
        ? 'A mark cannot be negative or above the total for the question.'
        : error.message,
    }, { status: 500 });
  }

  const total = rows.reduce((t, r) => t + Number(r.mark), 0);
  const outOf = rows.reduce((t, r) => t + Number(r.out_of), 0);

  await admin.from('exam_audit_events').insert({
    session_id: session.id,
    examination_id: session.examination_id,
    action: 'script.marked',
    actor_id: caller.id, actor_role: caller.role, actor_email: caller.email,
    after_state: { total, out_of: outOf, questions: rows.length },
    reason: null,
  });

  return NextResponse.json({
    ok: true,
    total,
    outOf,
    message:
      `Marked: ${total} of ${outOf}. It now needs a moderator — someone other than you — and then `
      + 'travels the University’s existing approval chain to publication.',
  });
}
