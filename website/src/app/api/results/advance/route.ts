// ---------------------------------------------------------------------------
// Moving a class through the grade approval chain.
//
// One route for all four steps, and for sending a class back.
//
// WHY ONE ROUTE AND NOT FOUR. Four routes would be four copies of the same
// three questions — is this class at the right step, does the caller hold that
// step, has the caller already signed it — and the first time one of them was
// edited without the others, a step would quietly become skippable. The rules
// live in src/lib/resultsWorkflow.ts, which knows nothing about HTTP and is
// tested exhaustively; this file reads a class, asks that module, and writes.
//
// WHY THE CAPABILITY IS NOT NAMED IN THE REQUEST. The caller says which class,
// never which step. The step is whatever the class is at, and the capability
// required is whatever that step demands. A route that let the caller name the
// step would let it name an easier one.
//
// WHAT PUBLICATION DOES BEYOND SETTING A STATUS. It recomputes the affected
// students' averages, in the same request. Without that the Registrar approves
// a class, the averages stay provisional, /api/credential/issue keeps refusing,
// and the university concludes the certificate system is broken — when what
// actually happened is that a second button nobody mentioned was not pressed.
//
// POST { courseId, action: 'advance' }
// POST { courseId, action: 'return', reason }
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/adminAuth';
import { can, type Capability } from '@/lib/roles';
import type { UserRole } from '@/lib/types';
import {
  mayAdvance, mayReturn, advancePatch, returnPatch, nextStage,
  type MarkState, type ResultStatus,
} from '@/lib/resultsWorkflow';
import { recompute } from '@/lib/gpa';

export const runtime = 'nodejs';

interface ResultRow {
  id: string;
  student_id: string;
  status: ResultStatus;
  submitted_by: string | null;
  moderated_by: string | null;
  faculty_approved_by: string | null;
  approved_by: string | null;
}

export async function POST(request: Request) {
  // ---------------------------------------------------------------------
  // WHO IS CALLING.
  //
  // guard() takes ONE capability and this route does not know which one it
  // needs until it has read the class — the step required is whatever step the
  // class is at. So identity is established the same way guard() does it, and
  // the capability check happens below, against the stage. The token is never
  // trusted for identity beyond being exchanged for a user id by Supabase
  // itself, and the role is read from the database rather than from anything
  // the caller said about itself.
  // ---------------------------------------------------------------------
  const admin = adminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'service-role-key-missing' }, { status: 500 });
  }

  const header = request.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return NextResponse.json({ ok: false, error: 'no-token' }, { status: 401 });

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return NextResponse.json({ ok: false, error: 'invalid-token' }, { status: 401 });
  }

  const { data: prof } = await admin
    .from('profiles')
    .select('role, full_name, suspended_at')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (!prof) return NextResponse.json({ ok: false, error: 'no-profile' }, { status: 403 });
  if (prof.suspended_at) return NextResponse.json({ ok: false, error: 'suspended' }, { status: 403 });

  const actor = {
    id: userData.user.id,
    holds: (c: Capability) => can(prof.role as UserRole, c),
  };

  // ---------------------------------------------------------------------

  let body: { courseId?: string; action?: 'advance' | 'return'; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  const courseId = body.courseId;
  const action = body.action ?? 'advance';
  const reason = body.reason ?? '';
  if (!courseId) return NextResponse.json({ ok: false, error: 'no-course' }, { status: 400 });

  const { data, error } = await admin
    .from('results')
    .select('id, student_id, status, submitted_by, moderated_by, faculty_approved_by, approved_by')
    .eq('course_id', courseId);

  if (error) {
    return NextResponse.json({ ok: false, error: `read-failed: ${error.message}` }, { status: 500 });
  }

  const rows = (data ?? []) as ResultRow[];
  if (rows.length === 0) {
    return NextResponse.json({
      ok: false, error: 'no-marks',
      detail: 'No marks have been entered for this course.',
    }, { status: 404 });
  }

  // ---------------------------------------------------------------------
  // A CLASS MOVES AS A CLASS.
  //
  // Every mark for the course must be at the same step, and they all move
  // together. Moderating half a class is not moderating a class: the question
  // the Head of Department is answering is whether the SPREAD is defensible,
  // and a spread computed from the marks that happened to be ready is not the
  // spread the students will be graded on.
  //
  // A mixed class is therefore refused rather than partially advanced, and the
  // refusal says what the mixture is.
  // ---------------------------------------------------------------------
  const statuses = Array.from(new Set(rows.map((r) => r.status)));
  if (statuses.length > 1) {
    const counts = statuses.map((s) => `${rows.filter((r) => r.status === s).length} ${s}`);
    return NextResponse.json({
      ok: false,
      error: 'class-not-uniform',
      detail:
        `These marks are not all at the same step (${counts.join(', ')}), so they cannot move as a `
        + 'class. This usually means marks were entered after the class was submitted.',
    }, { status: 409 });
  }

  const state: MarkState = {
    status: rows[0].status,
    submitted_by: rows[0].submitted_by,
    moderated_by: rows[0].moderated_by,
    faculty_approved_by: rows[0].faculty_approved_by,
    approved_by: rows[0].approved_by,
  };

  const now = new Date().toISOString();
  const ids = rows.map((r) => r.id);

  // ---------------------------------------------------------------------
  // RETURN
  // ---------------------------------------------------------------------
  if (action === 'return') {
    const decision = mayReturn(actor, state, reason);
    if (!decision.ok) {
      return NextResponse.json({
        ok: false, error: decision.refusal, detail: decision.because,
      }, { status: decision.refusal === 'not-your-step' ? 403 : 409 });
    }

    const { error: wErr } = await admin
      .from('results')
      .update(returnPatch(actor.id, reason, now))
      .in('id', ids);
    if (wErr) {
      return NextResponse.json({ ok: false, error: `write-failed: ${wErr.message}` }, { status: 500 });
    }

    await admin.from('result_transitions').insert(ids.map((id) => ({
      result_id: id,
      from_status: state.status,
      to_status: 'draft',
      action: 'return',
      actor_id: actor.id,
      actor_role: prof.role,
      actor_name: prof.full_name,
      note: reason.trim(),
    })));

    return NextResponse.json({
      ok: true, action: 'return', marks: ids.length, from: state.status, to: 'draft',
    });
  }

  // ---------------------------------------------------------------------
  // ADVANCE
  // ---------------------------------------------------------------------
  const decision = mayAdvance(actor, state);
  if (!decision.ok) {
    const stage = nextStage(state.status);
    return NextResponse.json({
      ok: false,
      error: decision.refusal,
      detail: decision.because,
      // Which office it is waiting for, so the person refused knows who to ask
      // rather than concluding the system is stuck.
      awaiting: stage ? { step: stage.actor, action: stage.verb } : null,
    }, { status: decision.refusal === 'not-your-step' ? 403 : 409 });
  }

  const stage = decision.stage!;
  const { error: wErr } = await admin
    .from('results')
    .update(advancePatch(stage, actor.id, now))
    .in('id', ids);

  if (wErr) {
    return NextResponse.json({
      ok: false,
      error: `write-failed: ${wErr.message}`,
      detail: wErr.message.includes('approval chain')
        // The database trigger from migration 009 refused it. The API rule and
        // the trigger rule are the same rule; if they ever disagree, the
        // trigger is the one that is right, because it cannot be bypassed.
        ? 'The same person may not sign a class twice. Another office must perform this step.'
        : wErr.message.includes('results_status_known')
          ? 'Run docs/migrations/009_results_approval.sql.'
          : undefined,
    }, { status: 409 });
  }

  await admin.from('result_transitions').insert(ids.map((id) => ({
    result_id: id,
    from_status: stage.from,
    to_status: stage.to,
    action: 'advance',
    actor_id: actor.id,
    actor_role: prof.role,
    actor_name: prof.full_name,
  })));

  await admin.from('audit_logs').insert({
    action: `results.${stage.to}`,
    entity_type: 'course',
    entity_id: courseId,
    performed_by: actor.id,
    details: { marks: ids.length, from: stage.from, to: stage.to },
  });

  // ---------------------------------------------------------------------
  // PUBLICATION RECOMPUTES.
  //
  // Only on the last step, and only for the students in this class — not the
  // whole roll. Recomputing every student because one class was published would
  // rewrite thousands of rows to change a handful.
  // ---------------------------------------------------------------------
  let gpa: Awaited<ReturnType<typeof recompute>> | null = null;
  if (stage.to === 'approved') {
    gpa = await recompute(admin, Array.from(new Set(rows.map((r) => r.student_id))), actor.id);
  }

  const upcoming = nextStage(stage.to);

  return NextResponse.json({
    ok: true,
    action: 'advance',
    marks: ids.length,
    from: stage.from,
    to: stage.to,
    awaiting: upcoming ? { step: upcoming.actor, action: upcoming.verb } : null,
    gpa: gpa
      ? {
          ok: gpa.ok,
          students: gpa.students,
          approvedTerms: gpa.approved,
          provisionalTerms: gpa.provisional,
          // A failed recompute after a successful publication is the one thing
          // that must not be silent: the marks ARE on the record, and the
          // averages are not, so a certificate would still be refused and
          // nobody would know why.
          detail: gpa.ok ? gpa.detail : `The marks were published but the averages did not recompute: ${gpa.error}`,
        }
      : null,
  });
}