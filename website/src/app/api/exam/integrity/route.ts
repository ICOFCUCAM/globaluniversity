// ---------------------------------------------------------------------------
// INCIDENTS AND FINDINGS — the two things that are constantly confused.
//
// POST { sessionId, kind: 'incident', category, description, eventIds? }
// POST { sessionId, kind: 'finding', incidentId?, outcome, reasoning, markAdjustment? }
// POST { incidentId, kind: 'withdraw', note }
//
// ---------------------------------------------------------------------------
// AN INCIDENT IS AN OBSERVATION. A FINDING IS A DETERMINATION.
// ---------------------------------------------------------------------------
//
// "The candidate looked off-screen repeatedly between 10:40 and 10:45" is an
// incident. Any proctor may record one; it is the only thing an invigilator can
// write, and it decides nothing.
//
// "This constituted academic misconduct" is a finding. It requires
// 'determine-misconduct', it requires written reasoning, and the person who
// raised the incident may not be the person who determines it — enforced here,
// and again by a trigger in migration 015.
//
// The University asked that automated events be alerts rather than proof, and
// that a human make the academic-integrity decision. Three levels — alert,
// incident, finding — is what that sentence means in practice. Collapsing any
// two of them would let a camera glitch end a degree.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';
import { can, type Capability } from '@/lib/roles';
import {
  canDetermine, INCIDENT_CATEGORIES, FINDING_OUTCOMES,
  type IncidentCategory, type FindingOutcome,
} from '@/lib/examinations';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const g = await guard(request, 'record-exam-incident');
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: g.error?.startsWith('not-permitted')
        ? 'Recording an examination incident is for proctors, examiners and moderators.'
        : undefined,
    }, { status: g.status });
  }
  const { admin, caller } = g;
  const holds = (c: string) => can(caller.role, c as Capability);

  let input: {
    kind?: 'incident' | 'finding' | 'withdraw';
    sessionId?: string;
    incidentId?: string;
    category?: string;
    description?: string;
    eventIds?: string[];
    severity?: 'notice' | 'serious';
    outcome?: string;
    reasoning?: string;
    markAdjustment?: number;
    note?: string;
  };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  // -------------------------------------------------------------------------
  // WITHDRAW AN INCIDENT.
  //
  // Withdrawn, never deleted. A proctor who realises the second face was a
  // reflection in a window should be able to say so — and the record should
  // show both the original observation and the correction, because a record
  // that quietly loses its mistakes cannot be trusted about anything else.
  // -------------------------------------------------------------------------
  if (input.kind === 'withdraw') {
    if (!input.incidentId || !input.note?.trim()) {
      return NextResponse.json({
        ok: false, error: 'incomplete',
        detail: 'Say why it is being withdrawn. The correction is part of the record.',
      }, { status: 400 });
    }

    const { data: incident } = await admin
      .from('exam_incidents')
      .select('id, session_id, raised_by, withdrawn_at')
      .eq('id', input.incidentId)
      .maybeSingle();

    if (!incident) return NextResponse.json({ ok: false, error: 'not-found' }, { status: 404 });
    if (incident.withdrawn_at) {
      return NextResponse.json({ ok: false, error: 'already-withdrawn' }, { status: 409 });
    }

    // A finding may already rest on it. Withdrawing the observation under a
    // determination would leave the finding standing on nothing.
    const { data: finding } = await admin
      .from('exam_findings')
      .select('id')
      .eq('incident_id', incident.id)
      .maybeSingle();

    if (finding) {
      return NextResponse.json({
        ok: false,
        error: 'determined',
        detail:
          'A finding has already been made on this incident. It cannot be withdrawn now — the '
          + 'finding has to be overturned instead, which is a moderator’s decision and stays on '
          + 'the record.',
      }, { status: 409 });
    }

    await admin.from('exam_incidents').update({
      withdrawn_at: new Date().toISOString(),
      withdrawn_by: caller.id,
      withdrawal_note: input.note.trim(),
    }).eq('id', incident.id);

    await admin.from('exam_audit_events').insert({
      session_id: incident.session_id,
      action: 'incident.withdrawn',
      actor_id: caller.id, actor_role: caller.role, actor_email: caller.email,
      before_state: { withdrawn: false }, after_state: { withdrawn: true },
      reason: input.note.trim(),
    });

    return NextResponse.json({ ok: true, message: 'Withdrawn, and the correction is on the record.' });
  }

  if (!input.sessionId) return NextResponse.json({ ok: false, error: 'no-session' }, { status: 400 });

  // -------------------------------------------------------------------------
  // RAISE AN INCIDENT.
  // -------------------------------------------------------------------------
  if (input.kind !== 'finding') {
    if (!input.description?.trim()) {
      return NextResponse.json({
        ok: false, error: 'no-description',
        detail: 'Describe what you observed. An incident with no description cannot be weighed.',
      }, { status: 400 });
    }
    if (!input.category || !(INCIDENT_CATEGORIES as readonly string[]).includes(input.category)) {
      return NextResponse.json({ ok: false, error: 'bad-category' }, { status: 400 });
    }

    const { data: created, error } = await admin.from('exam_incidents').insert({
      session_id: input.sessionId,
      category: input.category as IncidentCategory,
      description: input.description.trim(),
      severity: input.severity === 'serious' ? 'serious' : 'notice',
      event_ids: input.eventIds ?? [],
      raised_by: caller.id,
      raised_role: caller.role,
    }).select('id').single();

    if (error || !created) {
      return NextResponse.json({ ok: false, error: 'not-raised', detail: error?.message }, { status: 500 });
    }

    await admin.from('exam_audit_events').insert({
      session_id: input.sessionId,
      action: 'incident.raised',
      actor_id: caller.id, actor_role: caller.role, actor_email: caller.email,
      after_state: { category: input.category, severity: input.severity ?? 'notice' },
      reason: input.description.trim(),
    });

    return NextResponse.json({
      ok: true,
      incidentId: created.id,
      message:
        'Recorded as an observation. It is not a finding — a moderator decides whether it amounts '
        + 'to misconduct, and it will not be you if you raised it.',
    });
  }

  // -------------------------------------------------------------------------
  // MAKE A FINDING.
  // -------------------------------------------------------------------------
  if (!input.outcome || !(FINDING_OUTCOMES as readonly string[]).includes(input.outcome)) {
    return NextResponse.json({ ok: false, error: 'bad-outcome' }, { status: 400 });
  }

  let raisedBy: string | null = null;
  if (input.incidentId) {
    const { data: incident } = await admin
      .from('exam_incidents')
      .select('raised_by, withdrawn_at')
      .eq('id', input.incidentId)
      .maybeSingle();
    if (!incident) return NextResponse.json({ ok: false, error: 'incident-not-found' }, { status: 404 });
    if (incident.withdrawn_at) {
      return NextResponse.json({
        ok: false, error: 'withdrawn',
        detail: 'That observation has been withdrawn and cannot carry a finding.',
      }, { status: 409 });
    }
    raisedBy = incident.raised_by;
  }

  const verdict = canDetermine({
    raisedBy,
    decidedBy: caller.id,
    holds,
    reasoning: input.reasoning,
  });

  if (!verdict.allowed) {
    return NextResponse.json({ ok: false, error: 'refused', detail: verdict.reason }, { status: 403 });
  }

  const { data: created, error } = await admin.from('exam_findings').insert({
    session_id: input.sessionId,
    incident_id: input.incidentId ?? null,
    outcome: input.outcome as FindingOutcome,
    reasoning: input.reasoning!.trim(),
    mark_adjustment: input.markAdjustment ?? null,
    decided_by: caller.id,
    decided_role: caller.role,
  }).select('id').single();

  if (error || !created) {
    return NextResponse.json({
      ok: false,
      error: 'not-recorded',
      detail: error?.message.includes('second reader')
        // The database refused what this route allowed: the two copies of the
        // rule disagree, which is a fault rather than something to work around.
        ? 'The database refused this finding. The route and the trigger disagree about who may '
          + 'determine an incident — report this rather than retrying.'
        : error?.message,
    }, { status: 500 });
  }

  await admin.from('exam_audit_events').insert({
    session_id: input.sessionId,
    action: `finding.${input.outcome}`,
    actor_id: caller.id, actor_role: caller.role, actor_email: caller.email,
    before_state: { incident: input.incidentId ?? null },
    after_state: { outcome: input.outcome, mark_adjustment: input.markAdjustment ?? null },
    reason: input.reasoning!.trim(),
  });

  return NextResponse.json({
    ok: true,
    findingId: created.id,
    message: input.outcome === 'no_misconduct'
      ? 'Recorded: no misconduct. The observation and this determination both stay on the record.'
      : 'Recorded, with your reasoning. It can be overturned on appeal, and the overturning would '
        + 'be recorded against it rather than replacing it.',
  });
}
