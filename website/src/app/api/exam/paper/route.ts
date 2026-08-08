// ---------------------------------------------------------------------------
// SETTING AND RELEASING AN EXAMINATION.
//
// POST { action: 'create', ... }
// POST { action: 'move', examinationId, to }
//
// ---------------------------------------------------------------------------
// THE PAPER IS NOT RELEASED BY THE PERSON WHO SET IT
// ---------------------------------------------------------------------------
//
// draft → questions_approved is a moderator's move; questions_approved →
// published is the Examination Office's. Neither can do both, and this route
// refuses an approval by the paper's own author for the same reason 014 refuses
// a self-approved announcement and 015 refuses a self-moderated mark: one
// reader is not review.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';
import { can, type Capability } from '@/lib/roles';
import { EXAM_TRANSITIONS, EXAM_MODES, type ExamState, type ExamMode } from '@/lib/examinations';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const g = await guard(request, 'schedule-examination');
  const m = g.ok ? g : await guard(request, 'moderate-examination');
  if (!m.ok) {
    return NextResponse.json({
      ok: false,
      error: m.error,
      detail: 'Setting and releasing examinations is for the Examination Office and moderators.',
    }, { status: m.status });
  }
  const { admin, caller } = m;
  const holds = (c: string) => can(caller.role, c as Capability);

  let input: Record<string, any>;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  // -------------------------------------------------------------------------
  if (input.action === 'create') {
    if (!holds('schedule-examination')) {
      return NextResponse.json({
        ok: false, error: 'not-permitted',
        detail: 'Setting a paper is the Examination Office’s. A moderator approves it.',
      }, { status: 403 });
    }
    if (!input.title?.trim()) {
      return NextResponse.json({ ok: false, error: 'no-title' }, { status: 400 });
    }

    const mode = (EXAM_MODES as readonly string[]).includes(input.mode)
      ? (input.mode as ExamMode) : 'standard';

    // A take-home paper has a window rather than a duration. Storing 120
    // minutes on one would give a three-day paper a two-hour countdown.
    const duration = mode === 'take-home' ? null : Number(input.durationMinutes) || null;

    const { data, error } = await admin.from('examinations').insert({
      title: input.title.trim(),
      course_code: input.courseCode?.trim() || null,
      mode,
      duration_minutes: duration,
      total_marks: Number(input.totalMarks) || 100,
      pass_mark: Number(input.passMark) || 50,
      opens_at: input.opensAt || null,
      closes_at: input.closesAt || null,
      status: 'draft',
      created_by: caller.id,
    }).select('id').single();

    if (error || !data) {
      return NextResponse.json({
        ok: false,
        error: 'not-created',
        detail: error?.message.includes('examinations_window')
          ? 'The closing time is before the opening time.'
          : error?.message.includes('examinations_pass_mark')
            ? 'The pass mark cannot be above the total.'
            : error?.message,
      }, { status: 500 });
    }

    await admin.from('exam_audit_events').insert({
      examination_id: data.id,
      action: 'examination.created',
      actor_id: caller.id, actor_role: caller.role, actor_email: caller.email,
      after_state: { title: input.title, mode, status: 'draft' },
    });

    return NextResponse.json({
      ok: true,
      id: data.id,
      message: 'Created as a draft. A moderator approves the questions before it can be published.',
    });
  }

  // -------------------------------------------------------------------------
  if (!input.examinationId || !input.to) {
    return NextResponse.json({ ok: false, error: 'incomplete' }, { status: 400 });
  }

  const { data: exam } = await admin
    .from('examinations')
    .select('id, title, status, created_by')
    .eq('id', input.examinationId)
    .maybeSingle();

  if (!exam) return NextResponse.json({ ok: false, error: 'not-found' }, { status: 404 });

  const transition = (EXAM_TRANSITIONS[exam.status as ExamState] ?? [])
    .find((t) => t.to === input.to);

  if (!transition) {
    return NextResponse.json({
      ok: false, error: 'refused',
      detail: `A ${String(exam.status).replace('_', ' ')} paper cannot go to ${input.to}.`,
    }, { status: 409 });
  }

  if (!holds(transition.capability)) {
    return NextResponse.json({
      ok: false, error: 'refused', detail: `You may not ${transition.label.toLowerCase()}.`,
    }, { status: 403 });
  }

  // THE SECOND-READER RULE.
  if (input.to === 'questions_approved' && exam.created_by === caller.id) {
    return NextResponse.json({
      ok: false,
      error: 'refused',
      detail:
        'You set this paper, so you cannot be the one who approves its questions. The errors an '
        + 'author cannot see in their own questions are the ones that cost a whole cohort marks.',
    }, { status: 403 });
  }

  const patch: Record<string, unknown> = { status: input.to };
  if (input.to === 'questions_approved') {
    patch.approved_by = caller.id;
    patch.approved_at = new Date().toISOString();
  }
  if (input.to === 'published') {
    patch.published_by = caller.id;
    patch.published_at = new Date().toISOString();
  }

  const { error } = await admin.from('examinations').update(patch).eq('id', exam.id);
  if (error) {
    return NextResponse.json({ ok: false, error: 'not-moved', detail: error.message }, { status: 500 });
  }

  await admin.from('exam_audit_events').insert({
    examination_id: exam.id,
    action: `examination.${input.to}`,
    actor_id: caller.id, actor_role: caller.role, actor_email: caller.email,
    before_state: { status: exam.status },
    after_state: { status: input.to },
    reason: input.reason?.trim() || null,
  });

  return NextResponse.json({
    ok: true,
    message: input.to === 'published'
      ? 'Published. Candidates can now begin the checks for it.'
      : input.to === 'questions_approved'
        ? 'Questions approved. The Examination Office can release it.'
        : `Moved to ${String(input.to).replace('_', ' ')}.`,
  });
}
