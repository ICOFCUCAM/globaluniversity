// ---------------------------------------------------------------------------
// THE OFFICE'S SIDE OF A STUDENT'S REQUEST.
//
//   POST /api/student-services  { action, ... }
//
//   take      { requestId, office? }   put it under review, and say whose desk
//   approve   { requestId, note }      decide it
//   decline   { requestId, note }      decide it the other way
//   complete  { requestId, note? }     the thing was actually done
//   route     { requestId, office }    hand it to another office
//
// ---------------------------------------------------------------------------
// THE GAP THIS CLOSES, WHICH WAS THE WORST ONE LEFT
// ---------------------------------------------------------------------------
//
// 073 built the request: a student raises one, the table refuses a decline
// without a reason and refuses a completion that was never decided, and the
// student's own screen shows them where it has got to.
//
// And NOTHING COULD WORK THE QUEUE. There was no office screen, no route, no
// way to move a request off 'submitted'. A student could ask the University
// for academic leave, watch the screen say "Submitted", and wait for ever —
// which is worse than the emailing the whole thing was built to replace,
// because an email at least lands in somebody's inbox.
//
// 073's own header says a request should have a state "rather than students
// emailing the university for everything". It had a state and no hands.
//
// ---------------------------------------------------------------------------
// WHY 'complete' IS SEPARATE FROM 'approve'
// ---------------------------------------------------------------------------
//
// A deferment approved on Monday is not a deferment granted. Somebody has to
// move the student's record, and until they have, the student is holding an
// approval and no change. The gap between the two is where the work lives, and
// collapsing them would let an office mark something done by deciding to do it.
//
// The table enforces the order: 073 refuses 'completed' on a request that was
// never decided.
//
// ---------------------------------------------------------------------------
// AND THE ROUTE DOES NOT DECIDE WHAT THE DATABASE DECIDES
// ---------------------------------------------------------------------------
//
// The reason-for-a-decline minimum, the decided-together rule and the
// completed-after-decision rule are all CHECK constraints in 073. This checks
// them first only so the caller gets a sentence rather than a constraint name.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard, audit } from '@/lib/adminAuth';
import type { Capability } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

const CAPABILITY: Capability = 'handle-student-request' as Capability;
const ACTIONS = ['take', 'approve', 'decline', 'complete', 'route'];

/** The same minimum 073 enforces on a decline. */
const MIN_REASON = 10;

/** The offices a request can sit with, in the University's own words. */
const OFFICES = ['The Registry', 'The Academic Office', 'The Finance Office',
  'Student Affairs', 'The Library'];

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  if (!ACTIONS.includes(action)) {
    return bad('unknown-action', 400, `They are: ${ACTIONS.join(', ')}.`);
  }

  const g = await guard(request, CAPABILITY);
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: 'Working a student’s request is done by the offices that answer them — the '
        + 'Registry, the Academic Office, Finance and Student Affairs.',
    }, { status: g.status });
  }
  const { caller, admin } = g;

  const id = String(body.requestId ?? '');
  if (!id) return bad('no-request', 400);

  const { data: row } = await admin.from('student_requests')
    .select('id, student_id, kind, subject, status, with_office').eq('id', id).maybeSingle();
  if (!row) return bad('no-such-request', 404);

  const current = String((row as Record<string, unknown>).status);
  const note = String(body.note ?? '').trim();
  const now = new Date().toISOString();

  // A REQUEST THE STUDENT HAS WITHDRAWN IS NOT WORK. Deciding one would be the
  // University answering a question nobody is asking any more, and the student
  // would see a decision on something they took back.
  if (current === 'withdrawn') {
    return bad('withdrawn', 409,
      'The student withdrew this request. There is nothing left to decide.');
  }

  // ---- TAKE IT, OR HAND IT ON ---------------------------------------------
  if (action === 'take' || action === 'route') {
    const office = body.office === undefined ? null : String(body.office);
    if (office !== null && !OFFICES.includes(office)) {
      return bad('bad-office', 400, `They are: ${OFFICES.join(', ')}.`);
    }
    if (action === 'route' && !office) {
      return bad('no-office', 400, 'Say which office this is going to.');
    }
    if (current !== 'submitted' && current !== 'under-review') {
      return bad('already-decided', 409,
        `This request is ${current.replace('-', ' ')}. Only one that is still open can be `
        + 'taken up or handed on.');
    }

    const { error } = await admin.from('student_requests').update({
      status: 'under-review',
      ...(office ? { with_office: office } : {}),
    }).eq('id', id);
    if (error) return bad('not-changed', 409, error.message);

    await audit(admin, {
      action: action === 'route' ? 'student-request-routed' : 'student-request-taken',
      entityType: 'student_request', entityId: id, performedBy: caller.id,
      details: { office, from: current },
    });
    return NextResponse.json({
      ok: true,
      detail: action === 'route'
        ? `Handed to ${office}. The student can see that it has moved.`
        : 'Under review. The student can see somebody has it.',
    });
  }

  // ---- DECIDE IT -----------------------------------------------------------
  if (action === 'approve' || action === 'decline') {
    if (current === 'approved' || current === 'declined' || current === 'completed') {
      return bad('already-decided', 409,
        `This request is already ${current}. A decision is taken once.`);
    }

    // A DECLINE WITHOUT A REASON IS NOT AN ANSWER. 073 refuses it at the
    // table; this says so in words first, because a student refused with no
    // explanation cannot do anything about it.
    if (action === 'decline' && note.length < MIN_REASON) {
      return bad('decline-needs-a-reason', 400,
        'Say why. A student told only "declined" has been given nothing they can act on — not '
        + 'whether to ask again, not what would change the answer, not who to talk to.');
    }

    const { error } = await admin.from('student_requests').update({
      status: action === 'approve' ? 'approved' : 'declined',
      decided_by: caller.id,
      decided_at: now,
      decision_note: note || null,
    }).eq('id', id);
    if (error) {
      return bad('not-decided', 409, /decline_has_a_reason/i.test(error.message)
        ? 'A declined request must carry a reason of at least ten characters.'
        : error.message);
    }

    await audit(admin, {
      action: `student-request-${action}d`, entityType: 'student_request', entityId: id,
      performedBy: caller.id, details: { note: note || null },
    });
    return NextResponse.json({
      ok: true,
      detail: action === 'approve'
        ? 'Approved. It is not finished until somebody does the thing and marks it completed — '
          + 'the student is holding an approval, not a change to their record.'
        : 'Declined, with your reason, which the student can read.',
    });
  }

  // ---- AND SAY IT WAS ACTUALLY DONE ---------------------------------------
  if (action === 'complete') {
    if (current !== 'approved') {
      return bad('not-approved', 409,
        current === 'declined'
          ? 'This request was declined. There is nothing to complete.'
          : 'Only an approved request can be completed. Approve it first — the University does '
            + 'not do things it has not decided to do.');
    }

    const { error } = await admin.from('student_requests').update({
      status: 'completed',
      completed_by: caller.id,
      completed_at: now,
      ...(note ? { decision_note: note } : {}),
    }).eq('id', id);
    if (error) return bad('not-completed', 409, error.message);

    await audit(admin, {
      action: 'student-request-completed', entityType: 'student_request', entityId: id,
      performedBy: caller.id, details: { note: note || null },
    });
    return NextResponse.json({
      ok: true,
      detail: 'Completed. The student can see it is done.',
    });
  }

  return bad('unhandled-action', 500,
    `"${action}" is a known action with no handler. That is a bug in this route.`);
}
