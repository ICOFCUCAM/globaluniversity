// ---------------------------------------------------------------------------
// AUTOSAVING AN ANSWER.
//
// POST { sessionId, questionId?, questionNumber?, answer }
//
// ---------------------------------------------------------------------------
// EVERY SAVE IS A NEW ROW
// ---------------------------------------------------------------------------
//
// Not an UPDATE to a current answer. "The system crashed and lost my essay" is
// the commonest examination dispute there is, and it is unanswerable if the
// table holds only the final state. With a revision per save the University can
// say what the candidate had written at 10:42 and that nothing arrived after
// 10:47 — which either supports the candidate or settles the matter.
//
// It is also the only honest way to hold "answers are automatically saved" as a
// promise. A promise whose failure leaves no trace is not a promise.
//
// ---------------------------------------------------------------------------
// THE CLOCK IS CHECKED HERE, NOT IN THE BROWSER
// ---------------------------------------------------------------------------
//
// A save arriving after the candidate's time has run out is refused, whatever
// their screen was showing. The countdown they were watching is a display; this
// is the decision.
//
// AND THE REFUSAL IS RECORDED. A candidate who kept typing past the end has
// done nothing wrong — their clock may have been a few seconds behind — but the
// attempt is evidence, and silently discarding it would leave the register
// unable to explain why their last paragraph is missing.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';
import { remainingMs, type Session, type Paper, type ExamMode } from '@/lib/examinations';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const g = await guard(request, 'sit-examination');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin, caller } = g;

  let input: {
    sessionId?: string;
    questionId?: string | null;
    questionNumber?: number;
    answer?: unknown;
  };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  if (!input.sessionId || input.answer === undefined) {
    return NextResponse.json({ ok: false, error: 'incomplete' }, { status: 400 });
  }

  const { data: row } = await admin
    .from('exam_sessions')
    .select('*, students(auth_user_id), examinations(duration_minutes, opens_at, closes_at, mode)')
    .eq('id', input.sessionId)
    .maybeSingle();

  if (!row) return NextResponse.json({ ok: false, error: 'not-found' }, { status: 404 });

  if ((row as Record<string, any>).students?.auth_user_id !== caller.id) {
    return NextResponse.json({
      ok: false, error: 'not-yours', detail: 'That is not your examination.',
    }, { status: 403 });
  }

  if (row.status !== 'in_progress') {
    return NextResponse.json({
      ok: false,
      error: 'not-running',
      detail: row.status === 'paused'
        ? 'The examination is paused. Your work is saved and the clock has stopped.'
        : `This sitting is ${row.status.replace('_', ' ')} and cannot accept answers.`,
    }, { status: 409 });
  }

  const session: Session = {
    id: String(row.id),
    state: row.status,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    pausedMs: Number(row.paused_ms ?? 0),
    pausedAt: row.paused_at,
    extraMinutes: Number(row.extra_minutes ?? 0),
  };
  const ex = (row as Record<string, any>).examinations ?? {};
  const paper: Paper = {
    durationMinutes: ex.duration_minutes ?? null,
    opensAt: ex.opens_at ?? null,
    closesAt: ex.closes_at ?? null,
    mode: (ex.mode ?? 'standard') as ExamMode,
  };

  const left = remainingMs(session, paper);
  if (left !== null && left <= 0) {
    // RECORDED, NOT SILENTLY DROPPED. See the header.
    await admin.from('exam_events').insert({
      session_id: session.id, kind: 'answer_saved', source: 'student', severity: 'notice',
      actor_id: caller.id,
      detail: { refused: 'after time expired', question: input.questionNumber ?? null },
    });
    return NextResponse.json({
      ok: false,
      error: 'time-up',
      detail: 'Your time has run out, so this could not be saved. Everything saved before the '
        + 'end is safely on the register.',
      remainingMs: 0,
    }, { status: 409 });
  }

  // The next revision for this question. Counted from the register rather than
  // sent by the client: a client-supplied revision number could overwrite an
  // earlier save, which is the one thing this design exists to prevent.
  const { data: last } = await admin
    .from('exam_answers')
    .select('revision')
    .eq('session_id', session.id)
    .eq('question_id', input.questionId ?? null)
    .order('revision', { ascending: false })
    .limit(1)
    .maybeSingle();

  const revision = (last?.revision ?? 0) + 1;

  const { error } = await admin.from('exam_answers').insert({
    session_id: session.id,
    question_id: input.questionId ?? null,
    question_number: input.questionNumber ?? null,
    answer: input.answer as Record<string, unknown>,
    revision,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: 'not-saved', detail: error.message }, { status: 500 });
  }

  await admin.from('exam_events').insert({
    session_id: session.id, kind: 'answer_saved', source: 'student', severity: 'info',
    actor_id: caller.id, detail: { question: input.questionNumber ?? null, revision },
  });

  return NextResponse.json({ ok: true, revision, remainingMs: left, savedAt: new Date().toISOString() });
}
