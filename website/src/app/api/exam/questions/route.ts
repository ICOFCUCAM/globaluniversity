// ---------------------------------------------------------------------------
// DELIVERING THE PAPER TO ONE CANDIDATE.
//
// POST { sessionId }   -> releases the paper: builds it from the bank, records
//                         it on the session, returns it. Idempotent.
// GET  ?sessionId=…    -> reads the recorded paper back. Writes nothing.
//
// ---------------------------------------------------------------------------
// WHY THIS IS TWO VERBS AND USED TO BE ONE
// ---------------------------------------------------------------------------
//
// The GET built the paper, wrote it to `exam_sessions` and recorded an
// examination event. That is a read creating official academic state, and the
// University ruled against it:
//
//   "A browser, proxy, crawler or prefetcher should never accidentally create
//    an official academic record simply because it requested a page."
//
// Which is not hypothetical. A link prefetcher, a retried request after a
// dropped connection, a scanner following a URL out of a log, or a browser
// restoring tabs would each have built and FROZEN a candidate's paper — and
// migration 016 makes the column set-once, so the paper built by the crawler is
// the paper the candidate sits. The candidate need never have opened the page.
//
// So releasing is a POST and reading is a GET, which is also what makes the
// audit trail honest: `question_viewed` is now recorded when a paper is
// actually released to a candidate, not when something requested a URL.
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

  // READ IT BACK, AND THAT IS ALL A GET DOES.
  if (row.paper) {
    return NextResponse.json({ ok: true, paper: forCandidate(row.paper as DeliveredPaper) });
  }

  // NOT YET RELEASED. A GET will not release it — see the note at the top of
  // this file. The screen posts to release, then reads.
  return NextResponse.json({
    ok: false,
    error: 'not-released',
    detail: 'The paper has not been released yet.',
  }, { status: 409 });
}


// ===========================================================================
// RELEASING THE PAPER — THE MUTATION
// ===========================================================================
//
// IDEMPOTENT ON PURPOSE. A candidate who reconnects, refreshes, or moves to a
// phone posts again and gets the same arrangement back, because the first call
// recorded it and 016 makes the column set-once. So a retry is safe, which is
// the property a POST needs here far more than it needs to fail on a second
// call.
export async function POST(request: Request) {
  const g = await guard(request, 'sit-examination');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin, caller } = g;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { body = {}; }
  const sessionId = String(body.sessionId ?? '');
  if (!sessionId) return NextResponse.json({ ok: false, error: 'no-session' }, { status: 400 });

  const { data, error } = await admin
    .from('exam_sessions')
    .select('id, status, paper, students(auth_user_id), examinations(id, course_code, total_marks, randomise_questions, randomise_options)')
    .eq('id', sessionId)
    .maybeSingle();

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

  // THE CANDIDATE'S OWN SITTING. Every student holds 'sit-examination'.
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

  // ALREADY RELEASED: hand back the same one. This is what makes the retry safe.
  if (row.paper) {
    return NextResponse.json({
      ok: true, paper: forCandidate(row.paper as DeliveredPaper), fresh: false,
    });
  }

  // -------------------------------------------------------------------------
  // BUILD IT.
  // -------------------------------------------------------------------------
  const exam = row.examinations ?? {};

  // -------------------------------------------------------------------------
  // WHERE THE QUESTIONS COME FROM
  // -------------------------------------------------------------------------
  //
  // 089'S BANK FIRST, and the legacy JSON store only if that course has nothing
  // in it yet.
  //
  // THE FALLBACK IS DELIBERATE AND TEMPORARY. Switching outright would empty
  // the paper for every course whose questions have not been moved across —
  // and the failure would land on a candidate sitting an examination, which is
  // the worst possible place to discover a migration is half done. So the new
  // bank wins wherever it has been filled, and the old one keeps working until
  // it has.
  //
  // AND IT IS RECORDED RATHER THAN SILENT. A fallback nobody can see is a
  // fallback that becomes permanent: the event below says which source built
  // this paper, so the University can tell at a glance which courses still have
  // questions in the old store.
  let source = 'question_bank';
  let bank: BankQuestion[] = [];

  if (exam.course_code) {
    const { data: course } = await admin
      .from('courses').select('id').eq('code', exam.course_code).maybeSingle();

    if (course?.id) {
      const { data: projected } = await admin
        .rpc('question_bank_for_paper', { the_course: course.id });

      // ONE ROW PER OPTION comes back, so the rows are folded into questions.
      // The projection carries no answer — `is_correct` is not a column it has
      // — so the key is read separately, here, on the server, and never leaves
      // it: `forCandidate()` strips it from the response.
      // AN ARRAY AND AN INDEX, not a Map's iterator: the build target here is
      // below es2015, so spreading `map.values()` does not compile.
      const items: (BankQuestion & { optionIds: string[] })[] = [];
      const byItem = new Map<string, BankQuestion & { optionIds: string[] }>();
      for (const row of (projected ?? []) as Record<string, any>[]) {
        let q = byItem.get(row.item_id);
        if (!q) {
          q = {
            id: String(row.item_id),
            text: String(row.prompt ?? ''),
            options: [],
            marks: row.points === null ? undefined : Number(row.points),
            optionIds: [],
          };
          byItem.set(row.item_id, q);
          items.push(q);
        }
        if (row.option_id) {
          q.options!.push(String(row.label ?? ''));
          q.optionIds.push(String(row.option_id));
        }
      }

      if (items.length > 0) {
        const { data: keyRows } = await admin
          .from('question_bank_key')
          .select('item_id, option_id, is_correct')
          .in('item_id', items.map((q) => q.id))
          .eq('is_correct', true);

        const correctOf = new Map<string, string>();
        for (const k of (keyRows ?? []) as Record<string, any>[]) {
          if (k.option_id) correctOf.set(String(k.item_id), String(k.option_id));
        }

        bank = items.map(({ optionIds, ...q }) => {
          const at = optionIds.indexOf(correctOf.get(q.id) ?? '');
          return { ...q, answer: at < 0 ? undefined : at };
        }).filter((q) => q.text.trim().length > 0);
      }
    }
  }

  if (bank.length === 0) {
    source = 'module_records';
    const { data: bankRows } = await admin
      .from('module_records')
      .select('id, body')
      .eq('module', 'exams')
      .eq('kind', 'exam-question');

    bank = (bankRows ?? [])
      .map((r: Record<string, any>) => ({ id: String(r.id), ...(r.body ?? {}) }))
      // Only this course's questions when the paper names one. A bank shared
      // across the University would otherwise hand a theology candidate the IT
      // paper.
      .filter((q: BankQuestion & { course?: string }) =>
        !exam.course_code || !q.course || q.course === exam.course_code)
      .filter((q: BankQuestion) => typeof q.text === 'string' && q.text.trim().length > 0);
  }

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
    detail: { built: paper.questions.length, total_marks: paper.totalMarks, source },
  });

  return NextResponse.json({ ok: true, paper: forCandidate(paper), fresh: true });
}
