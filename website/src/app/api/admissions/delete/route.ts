// ---------------------------------------------------------------------------
// DELETING AN APPLICATION.
//
// The University's instruction: only the Superadministrator may do this.
//
// ---------------------------------------------------------------------------
// THREE INDEPENDENT REFUSALS
// ---------------------------------------------------------------------------
//
//   1. The screen does not draw the button unless the caller holds
//      'delete-application'. Courtesy, not control.
//   2. THIS ROUTE, which reads the caller's role from their token via `guard`
//      and never from the request body. This is the control.
//   3. Migration 018 — an RLS policy naming the Superadministrator, and a
//      trigger that refuses an admitted student's row no matter who is asking,
//      service role included.
//
// Remove any one and the other two still hold.
//
// ---------------------------------------------------------------------------
// THE AUDIT ENTRY IS WRITTEN BEFORE THE DELETE, NOT AFTER
// ---------------------------------------------------------------------------
//
// This is the whole difficulty with auditing a deletion, and it is why most
// systems have no usable record of one. Write the entry afterwards and a
// failure between the two leaves the row gone and nothing recorded — the exact
// state an abuse would produce, indistinguishable from it.
//
// So the entry goes first, carrying a snapshot of what is about to be
// destroyed, and if it cannot be written the deletion does not happen. An
// application the University cannot record deleting is one it does not delete.
//
// The snapshot matters: after the row is gone, `entity_id` points at nothing.
// A log line reading "application 7f3a… deleted" is unreadable a week later.
// This one carries the name, the email, the programme and the status, so the
// question "who was removed from the queue in August" has an answer.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard, audit } from '@/lib/adminAuth';

export async function POST(request: Request) {
  const g = await guard(request, 'delete-application');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin, caller } = g;

  let body: { studentId?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  const studentId = body.studentId?.trim();
  const reason = body.reason?.trim() ?? '';

  if (!studentId) {
    return NextResponse.json({ ok: false, error: 'no-student-id' }, { status: 400 });
  }

  // A REASON IS REQUIRED, AND A SHORT ONE IS NOT A REASON. "test", "x" and "ok"
  // are what a mandatory field collects when nothing enforces length, and they
  // are worth no more than a blank. Twelve characters is not a guarantee of
  // thought; it is enough to stop the reflex.
  if (reason.length < 12) {
    return NextResponse.json(
      {
        ok: false,
        error: 'reason-required',
        detail: 'Deleting an application destroys the record that it was ever made. '
          + 'Say why, in at least a dozen characters.',
      },
      { status: 400 },
    );
  }

  // Read the row first — both to snapshot it for the audit entry and to refuse
  // an admitted student here, with an explanation, rather than letting the
  // trigger raise a database error at the browser.
  const { data: student, error: readErr } = await admin
    .from('students')
    .select('id, matric_no, first_name, middle_name, last_name, email, program, status, student_number, auth_user_id, created_at')
    .eq('id', studentId)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json(
      { ok: false, error: `could-not-read: ${readErr.message}` },
      { status: 500 },
    );
  }
  if (!student) {
    return NextResponse.json({ ok: false, error: 'no-such-application' }, { status: 404 });
  }

  // An admitted record is not an application. Migration 018 refuses it in the
  // database as well; this is the same rule stated where it can be explained.
  if (student.auth_user_id || student.student_number) {
    return NextResponse.json(
      {
        ok: false,
        error: 'already-admitted',
        detail: `${student.first_name} ${student.last_name} has been admitted`
          + `${student.student_number ? ` as ${student.student_number}` : ''} and is no longer an `
          + 'application. Deleting the row would detach them from their own academic record. '
          + 'Withdraw or suspend the student instead.',
      },
      { status: 409 },
    );
  }

  const snapshot = {
    matric_no: student.matric_no,
    name: [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' '),
    email: student.email,
    programme: student.program,
    status: student.status,
    applied_at: student.created_at,
  };

  // FIRST. See the note at the top: if this fails, nothing is deleted.
  const auditErr = await audit(admin, {
    action: 'admissions.application_deleted',
    entityType: 'student',
    entityId: studentId,
    performedBy: caller.id,
    details: {
      reason,
      by_email: caller.email,
      by_role: caller.role,
      // What was destroyed, because the id will point at nothing.
      deleted_record: snapshot,
    },
  });

  if (auditErr) {
    return NextResponse.json(
      {
        ok: false,
        error: `not-deleted-because-not-recorded: ${auditErr}`,
        detail: 'The deletion was not carried out. An application the University cannot record '
          + 'deleting is one it does not delete.',
      },
      { status: 500 },
    );
  }

  const { error: delErr } = await admin.from('students').delete().eq('id', studentId);

  if (delErr) {
    // The audit entry is already written and cannot be withdrawn — the table is
    // append-only by trigger. So say plainly that it records an attempt rather
    // than a deletion, instead of leaving a reader to infer a row is gone.
    return NextResponse.json(
      {
        ok: false,
        error: `not-deleted: ${delErr.message}`,
        detail: 'The audit trail records this as an attempt. Nothing was deleted.',
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, deleted: snapshot });
}
