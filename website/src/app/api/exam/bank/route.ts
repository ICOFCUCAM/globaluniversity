// ---------------------------------------------------------------------------
// AUTHORING IN THE QUESTION BANK.
//
// POST { action: 'add',    courseId, prompt, topic, difficulty, options[], answerIndex }
// POST { action: 'retire', itemId }
// POST { action: 'remove', itemId }
//
// ---------------------------------------------------------------------------
// WHY THE ANSWER IS WRITTEN HERE AND NOT BY THE SCREEN
// ---------------------------------------------------------------------------
//
// 089 grants a browser session `select, insert, update, delete` on the items
// and the options, and on `question_bank_key` it grants SELECT ALONE. That
// asymmetry is deliberate and this route is the other half of it.
//
// A screen that could write the key could write it against an item in a course
// it had mis-scoped, and the row would land in a bank the author cannot even
// read — invisible to them, and readable by whoever teaches that course. The
// key is small, it is written once per question, and there is no reason for it
// to travel any path but this one.
//
// ---------------------------------------------------------------------------
// AND AUTHORITY IS CHECKED HERE, NOT INHERITED
// ---------------------------------------------------------------------------
//
// This route holds the service key, so `may_curate_course()` — which reads
// `auth.uid()` — would return nothing useful: there is no signed-in user inside
// a service-role connection. The check is therefore made explicitly against the
// caller, in the same terms the SQL function uses: the lecturer the course is
// allocated to, or an office that governs the curriculum.
//
// The University's ruling, September 2026: a lecturer may "create/manage
// question-bank items scoped to assigned courses".
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard, audit } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

const ACTIONS = ['add', 'retire', 'remove'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

/** The offices that govern the curriculum, exactly as 089's SQL names them. */
const CURATING_OFFICES = [
  'superadmin', 'admin', 'registrar', 'academic-office',
  'dean', 'hod', 'programme-coordinator',
];

/**
 * Whether this caller may author in this course's bank.
 *
 * THE SAME QUESTION `may_curate_course()` ANSWERS, asked the only way a
 * service-role connection can ask it. Both ways a course is allocated are
 * read — the offering names the lecturer for a term, and `courses.lecturer_id`
 * names who teaches it when no term has been set up — because 063 and 068
 * established that and a bank that only saw one of them would be empty for a
 * lecturer in week one.
 */
async function mayCurate(
  admin: any, callerId: string, callerRole: string, courseId: string,
): Promise<boolean> {
  if (CURATING_OFFICES.includes(callerRole)) return true;
  if (callerRole !== 'lecturer') return false;

  const { data: me } = await admin
    .from('lecturers').select('id').eq('auth_user_id', callerId).maybeSingle();
  if (!me?.id) return false;

  const { data: course } = await admin
    .from('courses').select('id, lecturer_id').eq('id', courseId).maybeSingle();
  if (!course) return false;
  if (course.lecturer_id === me.id) return true;

  const { count } = await admin
    .from('course_offerings')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId)
    .eq('lecturer_id', me.id);
  return (count ?? 0) > 0;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  if (!ACTIONS.includes(action)) {
    return bad('unknown-action', 400, `They are: ${ACTIONS.join(', ')}.`);
  }

  const g = await guard(request, 'manage-question-bank');
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: 'Writing a question bank belongs to the people who teach the course and the '
        + 'offices that govern the curriculum.',
    }, { status: g.status });
  }
  const { caller, admin } = g;

  // -------------------------------------------------------------------------
  // ADD
  // -------------------------------------------------------------------------
  if (action === 'add') {
    const courseId = String(body.courseId ?? '').trim();
    const prompt = String(body.prompt ?? '').trim();
    const topic = String(body.topic ?? '').trim() || null;
    const difficulty = String(body.difficulty ?? 'medium');
    const options = Array.isArray(body.options)
      ? body.options.map((o) => String(o ?? '').trim()).filter((o) => o.length > 0)
      : [];
    const answerIndex = Number(body.answerIndex);

    if (!courseId) return bad('no-course', 400, 'A question belongs to a course.');
    if (!prompt) return bad('no-prompt', 400, 'A question needs a question.');
    if (!DIFFICULTIES.includes(difficulty)) {
      return bad('bad-difficulty', 400, `They are: ${DIFFICULTIES.join(', ')}.`);
    }
    if (options.length < 2) {
      return bad('too-few-options', 400, 'A multiple-choice question needs at least two options.');
    }
    // THE ANSWER MUST BE ONE OF THE OPTIONS OFFERED. Without this a typo in the
    // index banks a question whose correct answer is nothing — and it fails at
    // marking, months later, in front of a candidate.
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) {
      return bad('answer-not-an-option', 400,
        `Choose which of the ${options.length} options is correct.`);
    }

    if (!await mayCurate(admin, caller.id, caller.role, courseId)) {
      return bad('not-your-course', 403,
        'You may author in the bank of a course you are allocated to teach.');
    }

    const { data: item, error: itemError } = await admin
      .from('question_bank_items')
      .insert({
        course_id: courseId,
        prompt,
        topic,
        difficulty,
        kind: 'single_choice',
        created_by: caller.id,
      })
      .select('id')
      .single();
    if (itemError) return bad('not-saved', 409, itemError.message);

    const { data: saved, error: optionError } = await admin
      .from('question_bank_options')
      .insert(options.map((label, i) => ({ item_id: item.id, label, sort_order: i + 1 })))
      .select('id, sort_order');

    // A QUESTION WITH NO OPTIONS IS UNANSWERABLE, so the item goes with them
    // rather than sitting in the bank looking complete. There is no transaction
    // across three statements here; tidying up is the next best thing.
    if (optionError) {
      await admin.from('question_bank_items').delete().eq('id', item.id);
      return bad('not-saved', 409, optionError.message);
    }

    const correct = (saved ?? []).find((o: any) => o.sort_order === answerIndex + 1);
    const { error: keyError } = await admin.from('question_bank_key').insert(
      (saved ?? []).map((o: any) => ({
        item_id: item.id,
        option_id: o.id,
        is_correct: o.id === correct?.id,
      })),
    );
    if (keyError) {
      await admin.from('question_bank_items').delete().eq('id', item.id);
      return bad('not-saved', 409, keyError.message);
    }

    await audit(admin, {
      action: 'question-banked', entityType: 'question_bank_item',
      entityId: item.id, performedBy: caller.id,
      details: { courseId, options: options.length, difficulty },
    });
    return NextResponse.json({ ok: true, id: item.id });
  }

  // -------------------------------------------------------------------------
  // RETIRE AND REMOVE
  //
  // RETIRING IS THE ORDINARY ONE. An examination sat last year must still be
  // explicable, and a question that has been drawn into a paper should leave
  // circulation rather than the record. Deleting stays available for a question
  // banked by mistake this morning.
  // -------------------------------------------------------------------------
  const itemId = String(body.itemId ?? '').trim();
  if (!itemId) return bad('no-item', 400);

  const { data: item } = await admin
    .from('question_bank_items').select('id, course_id').eq('id', itemId).maybeSingle();
  if (!item) return bad('not-found', 404);

  if (!await mayCurate(admin, caller.id, caller.role, item.course_id)) {
    return bad('not-your-course', 403,
      'That question is in the bank of a course you are not allocated to teach.');
  }

  if (action === 'retire') {
    const { error } = await admin
      .from('question_bank_items').update({ status: 'retired' }).eq('id', itemId);
    if (error) return bad('not-retired', 409, error.message);
    await audit(admin, {
      action: 'question-retired', entityType: 'question_bank_item',
      entityId: itemId, performedBy: caller.id, details: {},
    });
    return NextResponse.json({ ok: true });
  }

  const { error } = await admin.from('question_bank_items').delete().eq('id', itemId);
  if (error) return bad('not-removed', 409, error.message);
  await audit(admin, {
    action: 'question-removed', entityType: 'question_bank_item',
    entityId: itemId, performedBy: caller.id, details: {},
  });
  return NextResponse.json({ ok: true });
}
