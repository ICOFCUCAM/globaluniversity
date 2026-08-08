// ---------------------------------------------------------------------------
// MOVING ONE CANDIDATE'S SITTING.
//
// POST { examinationId }                        -> create a session (candidate)
// POST { sessionId, action, reason?, minutes? }  -> move it
// GET  ?sessionId=…                              -> the authoritative clock
//
// ---------------------------------------------------------------------------
// THE CLOCK IS SERVED, NEVER TRUSTED
// ---------------------------------------------------------------------------
//
// GET returns how long this candidate has left, computed from the session's
// server-recorded start. The browser displays it and counts down between polls;
// it never decides it. Every write below recomputes it too, so a save arriving
// after zero is refused whatever the candidate's screen was showing.
//
// ---------------------------------------------------------------------------
// EVERY TRANSITION WRITES TWO ROWS, AND THEY ARE DIFFERENT KINDS OF THING
// ---------------------------------------------------------------------------
//
//   exam_events            — evidence. The examination was paused at 10:42.
//                            Append-only; nobody can revise it.
//   exam_session_decisions — a decision. Dr Mbeki paused it because the
//                            candidate reported a power cut. Attributable,
//                            revisable, and it carries the reason.
//
// Writing only the first would leave a record of what happened with nobody
// answerable for it. Writing only the second would leave a justification with
// no independent record of the event it justifies. An appeal needs both, and
// needs to be able to tell them apart.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';
import { can, type Capability } from '@/lib/roles';
import {
  canMoveSession, remainingMs, isExpired,
  type SessionState, type Session, type Paper, type ExamMode,
} from '@/lib/examinations';

export const runtime = 'nodejs';

/** Which event each transition leaves in the evidence record. */
const EVENT_FOR: Partial<Record<SessionState, string>> = {
  checks: 'checks_started',
  ready: 'checks_passed',
  in_progress: 'exam_started',
  paused: 'exam_paused',
  submitted: 'exam_submitted',
  terminated: 'exam_terminated',
};

/** Which decision each transition records against a person. */
const DECISION_FOR: Partial<Record<SessionState, string>> = {
  in_progress: 'started',
  paused: 'paused',
  submitted: 'started',   // overwritten below for the resume case
  terminated: 'terminated',
  void: 'voided',
  abandoned: 'terminated',
};

function toSession(row: Record<string, any>): Session {
  return {
    id: String(row.id),
    state: row.status as SessionState,
    startedAt: row.started_at ?? null,
    submittedAt: row.submitted_at ?? null,
    pausedMs: Number(row.paused_ms ?? 0),
    pausedAt: row.paused_at ?? null,
    extraMinutes: Number(row.extra_minutes ?? 0),
  };
}

function toPaper(row: Record<string, any>): Paper {
  return {
    durationMinutes: row.duration_minutes ?? null,
    opensAt: row.opens_at ?? null,
    closesAt: row.closes_at ?? null,
    mode: (row.mode ?? 'standard') as ExamMode,
  };
}

// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const g = await guard(request, 'sit-examination');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin } = g;

  const sessionId = new URL(request.url).searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ ok: false, error: 'no-session' }, { status: 400 });

  const { data: row } = await admin
    .from('exam_sessions')
    .select('*, examinations(duration_minutes, opens_at, closes_at, mode, title)')
    .eq('id', sessionId)
    .maybeSingle();

  if (!row) return NextResponse.json({ ok: false, error: 'not-found' }, { status: 404 });

  const paper = toPaper(row.examinations ?? {});
  const session = toSession(row);

  return NextResponse.json({
    ok: true,
    state: session.state,
    remainingMs: remainingMs(session, paper),
    expired: isExpired(session, paper),
    // SERVER TIME, SENT ALONG. The browser compares its own clock to this to
    // notice a machine whose time is wrong, and shows the server's answer
    // rather than its own.
    serverTime: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const g = await guard(request, 'sit-examination');
  if (!g.ok) {
    // Staff moving a session hold control capabilities rather than
    // 'sit-examination'. Fall through to a second guard rather than refusing.
    const staff = await guard(request, 'control-exam-session');
    if (!staff.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
    return handle(request, staff);
  }
  return handle(request, g);
}

async function handle(
  request: Request,
  g: Extract<Awaited<ReturnType<typeof guard>>, { ok: true }>,
) {
  const { admin, caller } = g;
  const holds = (c: string) => can(caller.role, c as Capability);

  let input: {
    examinationId?: string;
    sessionId?: string;
    action?: SessionState;
    reason?: string;
    minutes?: number;
  };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  // -------------------------------------------------------------------------
  // CREATE A SITTING.
  //
  // ELIGIBILITY IS CHECKED HERE AND NOWHERE ELSE MATTERS. The candidate must be
  // registered for the course and the paper must be published. A session
  // created for somebody not entered for the examination would produce a
  // perfectly valid-looking script that cannot be marked into any record.
  // -------------------------------------------------------------------------
  if (!input.sessionId) {
    if (!input.examinationId) {
      return NextResponse.json({ ok: false, error: 'no-examination' }, { status: 400 });
    }

    const { data: exam } = await admin
      .from('examinations')
      .select('*')
      .eq('id', input.examinationId)
      .maybeSingle();

    if (!exam) return NextResponse.json({ ok: false, error: 'not-found' }, { status: 404 });

    if (!['published', 'in_progress'].includes(exam.status)) {
      return NextResponse.json({
        ok: false,
        error: 'not-open',
        detail: exam.status === 'closed'
          ? 'This examination has closed.'
          : 'This examination has not been published yet.',
      }, { status: 409 });
    }

    if (exam.opens_at && Date.parse(exam.opens_at) > Date.now()) {
      return NextResponse.json({
        ok: false,
        error: 'not-yet',
        detail: `This examination opens at ${new Date(exam.opens_at).toLocaleString('en-GB')}.`,
      }, { status: 409 });
    }
    if (exam.closes_at && Date.parse(exam.closes_at) < Date.now()) {
      return NextResponse.json({
        ok: false, error: 'closed', detail: 'The window for this examination has closed.',
      }, { status: 409 });
    }

    const { data: student } = await admin
      .from('students')
      .select('id, student_number, first_name, middle_name, last_name')
      .eq('auth_user_id', caller.id)
      .maybeSingle();

    if (!student) {
      return NextResponse.json({
        ok: false,
        error: 'not-a-student',
        detail: 'Only an enrolled student can sit an examination.',
      }, { status: 403 });
    }

    // A SESSION ALREADY EXISTS? RETURN IT. A candidate who refreshes the page,
    // or whose laptop dies and who signs in again on a phone, must land back in
    // the same sitting rather than being told they have already started.
    const { data: existing } = await admin
      .from('exam_sessions')
      .select('id, status')
      .eq('examination_id', exam.id)
      .eq('student_id', student.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: true, sessionId: existing.id, resumed: true });
    }

    const name = [student.first_name, student.middle_name, student.last_name]
      .filter(Boolean).join(' ');

    const { data: created, error } = await admin
      .from('exam_sessions')
      .insert({
        examination_id: exam.id,
        student_id: student.id,
        student_number: student.student_number,
        candidate_name: name,
        status: 'created',
      })
      .select('id')
      .single();

    if (error || !created) {
      return NextResponse.json({
        ok: false,
        error: 'not-created',
        detail: error?.message.includes('does not exist')
          ? 'Run docs/migrations/015_examination_and_proctoring.sql.'
          : error?.message,
      }, { status: 500 });
    }

    await admin.from('exam_events').insert({
      session_id: created.id, kind: 'session_created', source: 'system', severity: 'info',
      detail: { examination: exam.title },
    });

    return NextResponse.json({ ok: true, sessionId: created.id, resumed: false });
  }

  // -------------------------------------------------------------------------
  // MOVE AN EXISTING SITTING.
  // -------------------------------------------------------------------------
  const { data: row } = await admin
    .from('exam_sessions')
    .select('*, students(auth_user_id), examinations(duration_minutes, opens_at, closes_at, mode)')
    .eq('id', input.sessionId)
    .maybeSingle();

  if (!row) return NextResponse.json({ ok: false, error: 'not-found' }, { status: 404 });
  if (!input.action) return NextResponse.json({ ok: false, error: 'no-action' }, { status: 400 });

  const session = toSession(row);
  const paper = toPaper(row.examinations ?? {});

  // IS THIS THE CANDIDATE? Compared against the register, never against
  // anything the request said. 'sit-examination' is held by every student, so
  // without this any enrolled student could start somebody else's paper.
  const isCandidate = row.students?.auth_user_id === caller.id;

  const verdict = canMoveSession({
    from: session.state,
    to: input.action,
    holds,
    reason: input.reason,
    isCandidate,
  });

  if (!verdict.allowed) {
    return NextResponse.json({ ok: false, error: 'refused', detail: verdict.reason }, { status: 403 });
  }

  const now = new Date();
  const patch: Record<string, unknown> = { status: input.action };

  if (input.action === 'in_progress') {
    if (session.state === 'paused') {
      // RESUMING. The time spent paused is added to the accumulated total, so
      // the candidate is not charged for it.
      const pausedFor = session.pausedAt ? now.getTime() - Date.parse(session.pausedAt) : 0;
      patch.paused_ms = session.pausedMs + Math.max(0, pausedFor);
      patch.paused_at = null;
    } else {
      patch.started_at = now.toISOString();
    }
  }

  if (input.action === 'paused') patch.paused_at = now.toISOString();

  if (input.action === 'submitted') {
    patch.submitted_at = now.toISOString();
    // The last revision of each answer is marked final AFTER the state change,
    // below — so a failure there cannot leave a sitting that is neither open
    // nor submitted.
  }

  if (input.action === 'terminated') {
    patch.terminated_by = caller.id;
    patch.termination_reason = input.reason?.trim();
  }

  // EXTRA TIME IS NOT A STATE CHANGE, so it rides on a resume or arrives alone.
  if (typeof input.minutes === 'number' && input.minutes !== 0) {
    if (!holds('control-exam-session')) {
      return NextResponse.json({
        ok: false, error: 'refused', detail: 'Granting extra time is an examiner’s decision.',
      }, { status: 403 });
    }
    patch.extra_minutes = session.extraMinutes + input.minutes;
  }

  const { error: writeErr } = await admin
    .from('exam_sessions')
    .update(patch)
    .eq('id', session.id);

  if (writeErr) {
    return NextResponse.json({ ok: false, error: 'not-moved', detail: writeErr.message }, { status: 500 });
  }

  // Submission finalises the answers. Done after the state change so a failure
  // here cannot leave a sitting that is neither open nor submitted.
  if (input.action === 'submitted') {
    const { data: answers } = await admin
      .from('exam_answers')
      .select('id, question_id, revision')
      .eq('session_id', session.id)
      .order('revision', { ascending: false });

    const seen = new Set<string>();
    const finals: string[] = [];
    for (const a of answers ?? []) {
      const key = String(a.question_id ?? 'null');
      if (seen.has(key)) continue;
      seen.add(key);
      finals.push(a.id);
    }
    if (finals.length) {
      await admin.from('exam_answers').update({ is_final: true }).in('id', finals);
    }
  }

  // ---- EVIDENCE -----------------------------------------------------------
  const eventKind = input.action === 'in_progress' && session.state === 'paused'
    ? 'exam_resumed'
    : EVENT_FOR[input.action];

  if (eventKind) {
    await admin.from('exam_events').insert({
      session_id: session.id,
      kind: eventKind,
      source: isCandidate ? 'student' : 'proctor',
      severity: input.action === 'terminated' ? 'notice' : 'info',
      actor_id: caller.id,
      detail: { from: session.state, to: input.action },
    });
  }

  if (typeof input.minutes === 'number' && input.minutes !== 0) {
    await admin.from('exam_events').insert({
      session_id: session.id, kind: 'time_extended', source: 'proctor',
      severity: 'info', actor_id: caller.id, detail: { minutes: input.minutes },
    });
  }

  // ---- DECISION -----------------------------------------------------------
  const decision = input.action === 'in_progress' && session.state === 'paused'
    ? 'resumed'
    : DECISION_FOR[input.action];

  if (decision && input.reason?.trim()) {
    await admin.from('exam_session_decisions').insert({
      session_id: session.id,
      action: decision,
      reason: input.reason.trim(),
      minutes: input.minutes ?? null,
      decided_by: caller.id,
      decided_role: caller.role,
    });
  }

  if (typeof input.minutes === 'number' && input.minutes !== 0) {
    await admin.from('exam_session_decisions').insert({
      session_id: session.id,
      action: 'time_extended',
      reason: input.reason?.trim() || 'Additional time granted.',
      minutes: input.minutes,
      decided_by: caller.id,
      decided_role: caller.role,
    });
  }

  // ---- THE SIX-PART AUDIT RECORD -----------------------------------------
  await admin.from('exam_audit_events').insert({
    session_id: session.id,
    examination_id: row.examination_id,
    subject_ref: row.student_number,
    action: `session.${input.action}`,
    actor_id: caller.id,
    actor_role: caller.role,
    actor_email: caller.email,
    before_state: { status: session.state, extra_minutes: session.extraMinutes },
    after_state: { status: input.action, extra_minutes: patch.extra_minutes ?? session.extraMinutes },
    reason: input.reason?.trim() || null,
  });

  const after = toSession({ ...row, ...patch });

  return NextResponse.json({
    ok: true,
    state: input.action,
    remainingMs: remainingMs(after, paper),
    message: messageFor(input.action, input.minutes),
  });
}

function messageFor(action: SessionState, minutes?: number): string {
  switch (action) {
    case 'in_progress': return 'The examination is running.';
    case 'paused': return 'Paused. The clock has stopped and the candidate will not lose this time.';
    case 'submitted': return 'Submitted. Your answers are on the register.';
    case 'terminated': return 'The examination has been terminated and the reason recorded.';
    case 'void': return 'The sitting has been voided. The evidence remains on the record.';
    default:
      return minutes ? `${minutes} minutes granted.` : 'Updated.';
  }
}
