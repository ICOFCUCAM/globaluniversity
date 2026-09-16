// ---------------------------------------------------------------------------
// THE EXCEPTIONAL PATH — a transcript for somebody the register does not hold.
//
//   POST /api/transcript/validation  { action, ... }
//
//     raise     the Registrar or the Director of Academic Affairs puts the
//               case, with a reason and whatever evidence they hold
//     approve   the Vice-Chancellor or the Superadministrator permits it
//     reject    it will not proceed
//     return    sent back for correction, and the officer may resubmit
//
// ---------------------------------------------------------------------------
// WHAT THIS DOES NOT DO
// ---------------------------------------------------------------------------
//
// It does not create a transcript, and it does not create a student.
//
// The University's §7 reads as though the answer to "a legitimate student is
// not in the system" were a form with a name, a programme and a list of
// courses on it, countersigned by the Vice-Chancellor. That would be the one
// thing the whole ruling exists to stop — "this prevents someone from creating
// an official transcript using information that exists outside the
// university's authoritative records" — with an approval attached to it.
//
// So a validation request carries no academic information at all. There is no
// field here for a course, a credit, a grade or a classification. Approving one
// records that one of the two offices has looked at the case and permits the
// exception; the academic content of any transcript that follows is whatever
// the University puts in the student register, and there is no route around it.
//
// ---------------------------------------------------------------------------
// TWO CAPABILITIES, BECAUSE THE RULING ASKS FOR TWO PEOPLE
// ---------------------------------------------------------------------------
//
// Raising is `issue-credential` — the offices that issue transcripts are the
// offices that meet these cases. Deciding is `validate-transcript-exception`,
// which those offices deliberately do NOT hold: an exception approvable by the
// office asking for it is not an exception.
//
// 100 refuses the same things in the database — an approval by whoever raised
// it, an approval by anybody who is not one of the two offices, and a
// transcript against an approval given for a different student. This route
// adds the sentence. An officer told `insufficient_privilege` learns nothing.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard, audit } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

/** 100's own minimum: long enough to be a case rather than a word. */
const MIN_REASON = 30;
const MIN_NOTE = 10;

const DECISIONS = { approve: 'approved', reject: 'rejected', return: 'returned' } as const;
type Decision = keyof typeof DECISIONS;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  if (action === 'raise') return raise(request, body);
  if (!(action in DECISIONS)) {
    return bad('unknown-action', 400,
      'A validation request is raised, approved, rejected or returned for correction.');
  }
  return decide(request, body, action as Decision);
}


/** The officer puts the case. */
async function raise(request: Request, body: Record<string, unknown>) {
  const g = await guard(request, 'issue-credential');
  if (!g.ok) {
    return NextResponse.json({
      ok: false, error: g.error,
      detail: 'Raising a transcript validation request belongs to the offices that issue '
        + 'transcripts — the Registrar and the Director of Academic Affairs.',
    }, { status: g.status });
  }
  const { caller, admin } = g;

  const claimedStudentNumber = String(body.claimedStudentNumber ?? '').trim();
  const claimedFullName = String(body.claimedFullName ?? '').trim();
  const reason = String(body.reason ?? '').trim();

  if (claimedStudentNumber.length < 3) {
    return bad('no-student-number', 400, 'Which student number is being claimed?');
  }
  if (claimedFullName.length < 3) {
    return bad('no-name', 400, 'Under what name is the student claimed to have studied?');
  }
  if (reason.length < MIN_REASON) {
    return bad('no-case', 400,
      `Say what the evidence is — at least ${MIN_REASON} characters. The Vice-Chancellor reads `
      + 'this and has to decide on it, and "not in system" is not something anybody can decide '
      + 'on.');
  }

  // THE NATION IS READ, NOT ACCEPTED. 097 attaches a national officer to their
  // administration; a form that could name one would let a request be filed
  // against a nation the officer does not serve.
  const { data: me } = await admin
    .from('profiles').select('administration_id').eq('id', caller.id).maybeSingle();

  // ---- AND IF THE STUDENT IS ACTUALLY THERE, SAY SO ----------------------
  //
  // An exception raised for somebody the register does hold is not an
  // exception, and the commonest cause is a mistyped number. Better to hand
  // back the student than to send a case to the Vice-Chancellor.
  const { data: found } = await admin
    .from('students')
    .select('id, student_number, matric_no, first_name, last_name')
    .or(`student_number.eq.${claimedStudentNumber},matric_no.eq.${claimedStudentNumber}`)
    .maybeSingle();

  if (found) {
    return bad('student-exists', 409,
      `${claimedStudentNumber} is in the student register — ${[found.first_name, found.last_name]
        .filter(Boolean).join(' ')}. Generate the transcript from their record instead; no `
      + 'exception is needed.');
  }

  const { data, error } = await admin
    .from('transcript_validation_requests')
    .insert({
      claimed_student_number: claimedStudentNumber,
      claimed_full_name: claimedFullName,
      claimed_programme: String(body.claimedProgramme ?? '').trim() || null,
      claimed_year: String(body.claimedYear ?? '').trim() || null,
      administration_id: me?.administration_id ?? null,
      reason,
      // A list of {name, path} against the University's own storage. Empty is
      // allowed: a case with nothing scanned yet still belongs on the record
      // rather than in somebody's email.
      evidence: Array.isArray(body.evidence) ? body.evidence : [],
      requested_by: caller.id,
      requested_role: caller.role,
    })
    .select('id')
    .maybeSingle();

  if (error) return bad('not-raised', 500, error.message);

  await audit(admin, {
    action: 'transcript-validation-raised',
    entityType: 'transcript_validation_request',
    entityId: data?.id,
    performedBy: caller.id,
    details: { claimedStudentNumber, claimedFullName, reason },
  });

  return NextResponse.json({ ok: true, id: data?.id });
}


/** One of the two offices decides. */
async function decide(request: Request, body: Record<string, unknown>, action: Decision) {
  const g = await guard(request, 'validate-transcript-exception');
  if (!g.ok) {
    return NextResponse.json({
      ok: false, error: g.error,
      detail: 'Only the Vice-Chancellor or the Superadministrator may validate an exceptional '
        + 'transcript. The offices that raise these requests are the offices this validation '
        + 'exists to check.',
    }, { status: g.status });
  }
  const { caller, admin } = g;

  const id = String(body.id ?? '');
  if (!id) return bad('no-request', 400, 'Which validation request?');

  const note = String(body.note ?? '').trim();
  if (action !== 'approve' && note.length < MIN_NOTE) {
    return bad('no-reason', 400,
      `Say why — at least ${MIN_NOTE} characters. The officer who raised this reads it and has `
      + 'to know what to do next; a bare refusal tells them to ask again.');
  }

  const { data: row, error: readError } = await admin
    .from('transcript_validation_requests')
    .select('id, status, claimed_student_number, claimed_full_name, requested_by')
    .eq('id', id)
    .maybeSingle();

  if (readError) return bad('cannot-read', 500, readError.message);
  if (!row) return bad('no-such-request', 404, 'There is no validation request with that id.');
  if (row.status !== 'submitted') {
    return bad('not-waiting', 409, `That request is at “${row.status}”.`);
  }
  // 100 REFUSES THIS TOO. The sentence comes first.
  if (row.requested_by === caller.id) {
    return bad('your-own', 403,
      'You raised this request, so you cannot also decide it. That separation is the whole of '
      + 'what the validation is for.');
  }

  const { error: writeError } = await admin
    .from('transcript_validation_requests')
    .update({
      status: DECISIONS[action],
      decided_by: caller.id,
      decided_at: new Date().toISOString(),
      ...(action === 'approve' ? {} : { decision_note: note }),
    })
    .eq('id', id)
    .eq('status', 'submitted');

  if (writeError) return bad('not-decided', 409, writeError.message);

  await audit(admin, {
    action: `transcript-validation-${DECISIONS[action]}`,
    entityType: 'transcript_validation_request',
    entityId: id,
    performedBy: caller.id,
    details: {
      claimed_student_number: row.claimed_student_number,
      claimed_full_name: row.claimed_full_name,
      ...(action === 'approve' ? {} : { note }),
    },
  });

  return NextResponse.json({
    ok: true,
    ...(action === 'approve' ? {
      // SAID OUT LOUD, because approving is not issuing and the next step is
      // not obvious. An approval permits a transcript for this student number
      // and no other; 100 refuses one generated against a different claim.
      next: `Approved for ${row.claimed_student_number}. A transcript may now be generated `
        + 'for that student number and no other. The approval does not create a student '
        + 'record and does not itself produce a transcript.',
    } : {}),
  });
}
