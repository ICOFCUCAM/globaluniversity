// ---------------------------------------------------------------------------
// ACCEPTING AND RETURNING A SUBMISSION.
//
//   POST /api/studio/submissions  { action, lectureId, note? }
//
//   submit   the lecturer hands it to the University
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
  if (action !== 'submit' && action !== 'accept' && action !== 'return') {
    return bad('unknown-action', 400, 'A submission is submitted, accepted or returned.');
  }

  const lectureId = String(body.lectureId ?? '');
  if (!lectureId) return bad('no-lecture', 400, 'Which submission?');

  // ---- SUBMITTING IS THE LECTURER'S OWN ACT -------------------------------
  //
  // A different authority from the rest of this route, so it is answered
  // first and separately rather than bent into the office's guard.
  //
  // WITHOUT THIS THE QUEUE CAN NEVER FILL. 095 makes a lecture a draft and
  // refuses every transformation until an office accepts it — and until
  // something moves a draft to `submitted`, no office ever sees one. The stop
  // would be an outage rather than a review, which is exactly what it looked
  // like before this was written.
  if (action === 'submit') return submitOwnLecture(request, lectureId);

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


/**
 * A lecturer hands their own lecture to the University.
 *
 * `studio-submit-lecture` is the capability, which the lecturer holds by role
 * — writing and submitting a lecture is what a lecturer is for, and the
 * University's ruling reserved the AI capabilities, not this one.
 *
 * AND ONLY THEIR OWN. 095 refuses somebody else's in the database; this says
 * so in a sentence first, because a person told `insufficient_privilege`
 * learns nothing about whose lecture it is.
 */
async function submitOwnLecture(request: Request, lectureId: string) {
  const g = await guard(request, 'studio-submit-lecture' as Capability);
  if (!g.ok) {
    return NextResponse.json({
      ok: false, error: g.error,
      detail: 'Submitting a lecture belongs to the person whose lecture it is.',
    }, { status: g.status });
  }
  const { caller, admin } = g;

  const { data: lecture, error: readError } = await admin
    .from('lectures')
    .select('id, owner_id, context, review_state, title')
    .eq('id', lectureId)
    .maybeSingle();

  if (readError) return bad('cannot-read', 500, readError.message);
  if (!lecture) return bad('no-such-lecture', 404, 'There is no lecture with that id.');
  if (lecture.owner_id !== caller.id) {
    return bad('not-yours', 403, 'A lecture is submitted by the person whose it is.');
  }
  if (lecture.context !== 'course') {
    return bad('not-reviewable', 409,
      'This is in your personal library. It has no cohort and nobody reviews it — you can run '
      + 'whatever your account is allowed on it already.');
  }
  // DRAFT OR RETURNED. Returned is the whole point of returned: a lecturer
  // reads the note, fixes what was wrong, and submits the same lecture again.
  if (lecture.review_state !== 'draft' && lecture.review_state !== 'returned') {
    return bad('already-submitted', 409,
      `This is at \u201c${lecture.review_state}\u201d. It is already with the University.`);
  }

  const { error: writeError } = await admin
    .from('lectures')
    .update({ review_state: 'submitted', submitted_at: new Date().toISOString() })
    .eq('id', lectureId)
    .in('review_state', ['draft', 'returned']);

  if (writeError) return bad('not-recorded', 409, writeError.message);

  await audit(admin, {
    action: 'lecture-submitted', entityType: 'lecture', entityId: lectureId,
    performedBy: caller.id,
    // THE TITLE, NOT THE LECTURE. This route has not read a word of it and the
    // audit trail is not where that would start.
    details: { title: lecture.title, resubmitted: lecture.review_state === 'returned' },
  });

  return NextResponse.json({ ok: true });
}
