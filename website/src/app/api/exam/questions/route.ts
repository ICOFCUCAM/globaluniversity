// ---------------------------------------------------------------------------
// DELIVERING THE PAPER TO ONE CANDIDATE.
//
// GET ?sessionId=…  -> the questions, in this candidate's order, without the key
//
// ---------------------------------------------------------------------------
// THE PAPER IS BUILT ONCE AND THEN READ
// ---------------------------------------------------------------------------
//
// The first request builds it from the bank, records it on the session, and
// returns it. Every request after that reads the recorded copy — so a refresh,
// a reconnection or a switch to a phone shows the same paper, and an appeal
// five years later can be shown what was actually asked even if the question
// has since been withdrawn from the bank.
//
// Migration 016 makes the column set-once, so this route cannot rewrite a paper
// even by mistake.
//
// ---------------------------------------------------------------------------
// THE ANSWER KEY NEVER LEAVES THE SERVER
// ---------------------------------------------------------------------------
//
// The recorded paper carries which option is correct — marking needs it. It is
// stripped by forCandidate() before the response is built. That is one line,
// and it is the line between a proctored examination and a page whose network
// tab contains the answers.
//
// The candidate's own RLS view (exam_sessions_mine) omits the paper column
// entirely for the same reason, so this route is not the only thing standing
// between a candidate and the key.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';
import { buildPaper, forCandidate, type BankQuestion, type DeliveredPaper } from '@/lib/examPaper';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const g = await guard(request, 'sit-examination');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin, caller } = g;

  const sessionId = new URL(request.url).searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ ok: false, error: 'no-session' }, { status: 400 });

  const { data, error } = await admin
    .from('exam_sessions')
    .select('id, status, paper, students(auth_user_id), examinations(id, course_code, total_marks, randomise_questions, randomise_options)')
    .eq('id', sessionId)
    .maybeSingle();

  // Cast once. A select with two embedded tables defeats supabase-js's
  // inference, and the alternative — sprinkling assertions down the file — is
  // how a genuine type error gets lost among the noise.
  const row = data as Record<string, any> | null;

  if (error) {
    return NextResponse.json({
      ok: false,
      error: 'unreadable',
      detail: error.message.includes('paper')
        ? 'Run docs/migrations/016_examination_papers.sql.'
        : error.message,
    }, { status: 500 });
  }
  if (!row) return NextResponse.json({ ok: false, error: 'not-found' }, { status: 404 });

  // THE CANDIDATE'S OWN SITTING, CHECKED AGAINST THE REGISTER. Every student
  // holds 'sit-examination'; without this, any of them could read any paper.
  if (row.students?.auth_user_id !== caller.id) {
    return NextResponse.json({
      ok: false, error: 'not-yours', detail: 'That is not your examination.',
    }, { status: 403 });
  }

  // A PAPER IS NOT RELEASED BEFORE THE CHECKS ARE DONE. Delivering it at
  // 'created' would let a candidate read the questions, close the tab, and come
  // back an hour later having prepared — with the clock never having started.
  if (!['ready', 'in_progress', 'paused', 'submitted'].includes(row.status)) {
    return NextResponse.json({
      ok: false,
      error: 'not-ready',
      detail: 'The paper is released once the pre-examination checks have passed.',
    }, { status: 409 });
  }

  // Already built: read it back.
  if (row.paper) {
    return NextResponse.json({ ok: true, paper: forCandidate(row.paper as DeliveredPaper), fresh: false });
  }

  // -------------------------------------------------------------------------
  // BUILD IT.
  // -------------------------------------------------------------------------
  const exam = row.examinations ?? {};

  const { data: bankRows } = await admin
    .from('module_records')
    .select('id, body')
    .eq('module', 'exams')
    .eq('kind', 'exam-question');

  const bank: BankQuestion[] = (bankRows ?? [])
    .map((r: Record<string, any>) => ({ id: String(r.id), ...(r.body ?? {}) }))
    // Only this course's questions when the paper names one. A bank shared
    // across the University would otherwise hand a theology candidate the IT
    // paper.
    .filter((q: BankQuestion & { course?: string }) =>
      !exam.course_code || !q.course || q.course === exam.course_code)
    .filter((q) => typeof q.text === 'string' && q.text.trim().length > 0);

  if (bank.length === 0) {
    // SAID PLAINLY, TO THE PERSON WHO CAN DO NOTHING ABOUT IT. A candidate
    // staring at an empty paper needs to know it is not their fault and that
    // somebody has been told.
    return NextResponse.json({
      ok: false,
      error: 'no-questions',
      detail:
        'This examination has no questions attached to it yet. This is not something you can '
        + 'fix — tell your invigilator. Your sitting and your time are unaffected.',
    }, { status: 409 });
  }

  const paper = buildPaper(
    bank,
    {
      randomiseQuestions: Boolean(exam.randomise_questions),
      randomiseOptions: Boolean(exam.randomise_options),
      totalMarks: Number(exam.total_marks) || 100,
    },
    // THE SEED IS THE SESSION'S ID: unique per candidate per paper, already
    // recorded, stable across refreshes.
    String(row.id),
  );

  const { error: writeErr } = await admin
    .from('exam_sessions')
    .update({ paper })
    .eq('id', row.id);

  if (writeErr) {
    return NextResponse.json({
      ok: false,
      error: 'not-recorded',
      detail:
        `The paper could not be recorded (${writeErr.message}), so it has not been released. `
        + 'A paper delivered without being recorded cannot be produced for an appeal.',
    }, { status: 500 });
  }

  await admin.from('exam_events').insert({
    session_id: row.id,
    kind: 'question_viewed',
    source: 'system',
    severity: 'info',
    detail: { built: paper.questions.length, total_marks: paper.totalMarks },
  });

  return NextResponse.json({ ok: true, paper: forCandidate(paper), fresh: true });
}
