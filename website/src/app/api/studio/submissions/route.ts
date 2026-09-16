// ---------------------------------------------------------------------------
// ACCEPTING AND RETURNING A SUBMISSION.
//
//   POST /api/studio/submissions  { action, lectureId, note? }
//
//   accept   the University will pay for the work; a model may now run
//   return   back to the lecturer, with a note they will read
//
// ---------------------------------------------------------------------------
// WHY THIS ROUTE EXISTS WHEN THE DATABASE ALREADY ENFORCES IT
// ---------------------------------------------------------------------------
//
// 095 refuses a transformation on a lecture nobody has accepted, and refuses a
// lecturer to accept their own. Those rules hold whatever calls the database.
//
// This is not a second copy of them. It is the door — there was none — and it
// does the one thing a policy cannot: it answers in sentences. A browser told
// `check_violation` learns nothing; a person told "this is at draft, and an
// office moves it to accepted" knows what happened and who to ask.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard, audit } from '@/lib/adminAuth';
import type { Capability } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

/** 095 refuses a shorter one, and so does this — with words rather than a code. */
const MIN_NOTE = 10;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  if (action !== 'accept' && action !== 'return') {
    return bad('unknown-action', 400, 'A submission is accepted or returned.');
  }

  const lectureId = String(body.lectureId ?? '');
  if (!lectureId) return bad('no-lecture', 400, 'Which submission?');

  // REVIEWING IS PART OF GOVERNING THE CURRICULUM, which is what
  // `publish-course-material` already names — the same capability the offices
  // hold for putting material on a course. A new capability for this would be
  // a fourteenth name for an authority that already exists.
  const g = await guard(request, 'publish-course-material' as Capability);
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: 'Reviewing submissions belongs to the offices that govern the curriculum.',
    }, { status: g.status });
  }
  const { caller, admin } = g;

  const note = String(body.note ?? '').trim();
  if (action === 'return' && note.length < MIN_NOTE) {
    return bad('no-reason', 400,
      `Say why it is going back — at least ${MIN_NOTE} characters. The lecturer reads this, and a `
      + 'decision nobody explained is one nobody can act on.');
  }

  // ---- WHAT IS IT NOW? ----------------------------------------------------
  //
  // Read before writing, so the refusal can say where the submission actually
  // is. "It is already accepted" and "no such lecture" are different facts and
  // a person should be told which.
  const { data: lecture, error: readError } = await admin
    .from('lectures')
    .select('id, owner_id, context, review_state, title')
    .eq('id', lectureId)
    .maybeSingle();

  if (readError) return bad('cannot-read', 500, readError.message);
  if (!lecture) return bad('no-such-lecture', 404, 'There is no submission with that id.');

  if (lecture.context !== 'course') {
    return bad('not-reviewable', 409,
      'That is somebody’s personal recording. It has no cohort and no University money behind '
      + 'it, so it is not reviewed.');
  }
  if (lecture.review_state !== 'submitted') {
    return bad('not-waiting', 409,
      `That submission is at “${lecture.review_state}”, not waiting for a decision.`);
  }

  // A LECTURER MAY NOT DECIDE THEIR OWN, and this says so before the database
  // does. 095 refuses it either way; a person deserves the sentence.
  if (lecture.owner_id === caller.id) {
    return bad('your-own', 403,
      'This is your own lecture. The University reviews it — that is what the step is for.');
  }

  const { error: writeError } = await admin
    .from('lectures')
    .update({
      review_state: action === 'accept' ? 'accepted' : 'returned',
      reviewed_by: caller.id,
      reviewed_at: new Date().toISOString(),
      ...(action === 'return' ? { review_note: note } : {}),
    })
    .eq('id', lectureId)
    // NOT MOVED SINCE IT WAS READ. Two offices with the queue open would
    // otherwise both decide, and the second would overwrite the first without
    // either knowing.
    .eq('review_state', 'submitted');

  if (writeError) return bad('not-recorded', 409, writeError.message);

  await audit(admin, {
    action: action === 'accept' ? 'submission-accepted' : 'submission-returned',
    entityType: 'lecture',
    entityId: lectureId,
    performedBy: caller.id,
    // THE NOTE IS PART OF THE DECISION, so it is part of the record. The
    // lecture's own words are not here and never were — this route has not
    // read them.
    details: { title: lecture.title, ...(action === 'return' ? { note } : {}) },
  });

  return NextResponse.json({ ok: true });
}
