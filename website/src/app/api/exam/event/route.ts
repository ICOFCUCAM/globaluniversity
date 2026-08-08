// ---------------------------------------------------------------------------
// RECORDING WHAT HAPPENED DURING A SITTING.
//
// POST { sessionId, events: [{ kind, detail? }] }
//
// ---------------------------------------------------------------------------
// THE BROWSER REPORTS; IT DOES NOT DECIDE
// ---------------------------------------------------------------------------
//
// The candidate's page reports what it observed — the window lost focus, the
// screen share stopped, the camera went away — and this route decides the
// severity, stamps the server's time and records the source. Three things the
// client is never allowed to set:
//
//   `severity`, because a client that could mark its own events 'info' would
//   make every alert disappear from the proctor's console.
//   `source`, because 'proctor' carries more weight than 'student' and a page
//   claiming to be a proctor is a page claiming to be somebody else.
//   `occurred_at`, because a clock the candidate controls is not a timestamp.
//
// The client's own idea of the time is kept, in `detail.reported_at`, clearly
// labelled — it is genuinely useful for ordering events recorded during a
// disconnection, and useless as a fact about when they happened.
//
// ---------------------------------------------------------------------------
// EVENTS ARE ACCEPTED FROM A SITTING THAT HAS ENDED
// ---------------------------------------------------------------------------
//
// A batch queued while the connection was down arrives after the candidate has
// submitted. Refusing it would discard the record of the very interruption that
// delayed it — which is exactly the evidence an appeal about that interruption
// would need.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';
import { EVENT_KINDS, severityOf, type EventKind } from '@/lib/examinations';

export const runtime = 'nodejs';

/** One batch cannot be unbounded: a faulty page could otherwise fill the table. */
const MAX_BATCH = 50;

export async function POST(request: Request) {
  let g = await guard(request, 'sit-examination');
  let source: 'student' | 'proctor' = 'student';

  if (!g.ok) {
    const staff = await guard(request, 'proctor-examination');
    if (!staff.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
    g = staff;
    source = 'proctor';
  }
  const { admin, caller } = g;

  let input: { sessionId?: string; events?: Array<{ kind?: string; detail?: Record<string, unknown> }> };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  if (!input.sessionId || !Array.isArray(input.events) || input.events.length === 0) {
    return NextResponse.json({ ok: false, error: 'incomplete' }, { status: 400 });
  }

  const { data: session } = await admin
    .from('exam_sessions')
    .select('id, student_id, students(auth_user_id)')
    .eq('id', input.sessionId)
    .maybeSingle();

  if (!session) return NextResponse.json({ ok: false, error: 'not-found' }, { status: 404 });

  // A CANDIDATE MAY ONLY REPORT ON THEIR OWN SITTING. Checked against the
  // register; 'sit-examination' is held by every student.
  const isCandidate = (session as Record<string, any>).students?.auth_user_id === caller.id;
  if (source === 'student' && !isCandidate) {
    return NextResponse.json({
      ok: false, error: 'not-yours', detail: 'That is not your examination.',
    }, { status: 403 });
  }

  const accepted = input.events
    .slice(0, MAX_BATCH)
    .filter((e): e is { kind: EventKind; detail?: Record<string, unknown> } =>
      typeof e.kind === 'string' && (EVENT_KINDS as readonly string[]).includes(e.kind));

  if (accepted.length === 0) {
    return NextResponse.json({
      ok: false,
      error: 'no-known-events',
      detail: 'None of the reported events is one this system records.',
    }, { status: 422 });
  }

  const { error } = await admin.from('exam_events').insert(
    accepted.map((e) => ({
      session_id: session.id,
      kind: e.kind,
      // SET HERE, NEVER BY THE CLIENT. See the header.
      source: isCandidate ? 'student' : source,
      severity: severityOf(e.kind),
      actor_id: caller.id,
      detail: e.detail ?? {},
    })),
  );

  if (error) {
    return NextResponse.json({
      ok: false,
      error: 'not-recorded',
      detail: error.message.includes('does not exist')
        ? 'Run docs/migrations/015_examination_and_proctoring.sql.'
        : error.message,
    }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    recorded: accepted.length,
    dropped: input.events.length - accepted.length,
  });
}
