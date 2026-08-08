// ---------------------------------------------------------------------------
// A STUDENT'S REQUEST TO HAVE THEIR CREDENTIAL CORRECTED, AND ITS PROGRESS
// THROUGH THE OFFICES.
//
// POST { credentialId, description, proposed }   -> raise a request (student)
// POST { requestId, to, note }                   -> move it (staff or student)
//
//   "Students should not directly edit their credentials."
//
// ---------------------------------------------------------------------------
// WHY THIS IS A STATE MACHINE AND NOT FOUR BUTTONS
// ---------------------------------------------------------------------------
//
// The route the University drew has four steps — student requests, registrar
// reviews, escalated if required, Authority approves — and the entire value of
// it is that those are four different people. A correction that skips review is
// an edit, and an edit to a sealed document is what the whole Credential
// Authority exists to prevent.
//
// So the transitions live in src/lib/credentialAuthority.ts, which knows nothing
// about HTTP and is tested against every combination of state and role. This
// file reads a request, asks that module, and writes. It does not have its own
// opinion about who may do what, because a second opinion is how the screen and
// the server end up enforcing different rules.
//
// THE CALLER NEVER NAMES THEIR ROLE. It is read from their profile by guard().
// A request body that said `role: 'superadmin'` would be believed by nothing.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';
import { canMove, type CorrectionState } from '@/lib/credentialAuthority';

export const runtime = 'nodejs';

/** The audit action for each destination state. */
const AUDIT_FOR: Partial<Record<CorrectionState, string>> = {
  under_review: 'correction_reviewed',
  escalated: 'correction_reviewed',
  approved: 'correction_approved',
  rejected: 'correction_rejected',
};

export async function POST(request: Request) {
  // 'track-application' is the lowest capability a signed-in student holds. The
  // point here is only to establish WHO is calling; what they may then do comes
  // from canMove() against their actual role.
  const g = await guard(request, 'track-application');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin, caller } = g;

  let input: {
    credentialId?: string; description?: string; proposed?: Record<string, string>;
    requestId?: string; to?: CorrectionState; note?: string;
  };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  // -------------------------------------------------------------------------
  // RAISING A REQUEST
  // -------------------------------------------------------------------------
  if (!input.requestId) {
    if (!input.credentialId || !input.description?.trim()) {
      return NextResponse.json({
        ok: false,
        error: 'incomplete',
        detail: 'Say which credential and what is wrong with it.',
      }, { status: 400 });
    }

    const { data: credential } = await admin
      .from('credentials_issued')
      .select('id, credential_id, student_id, status')
      .eq('id', input.credentialId)
      .maybeSingle();

    if (!credential) return NextResponse.json({ ok: false, error: 'not-found' }, { status: 404 });

    if (credential.status === 'replaced') {
      return NextResponse.json({
        ok: false,
        error: 'superseded',
        detail:
          'This version has already been replaced by a corrected one. Check the current version '
          + 'first — the correction you are asking for may already have been made.',
      }, { status: 409 });
    }

    const { data: created, error } = await admin
      .from('credential_correction_requests')
      .insert({
        credential_id: credential.id,
        student_id: credential.student_id,
        requested_by: caller.id,
        description: input.description.trim(),
        // PROPOSED, NEVER APPLIED. What the student says it should say is
        // recorded so the reviewer can see it; the Authority decides what is
        // actually changed, and the amendment route recomputes the difference
        // from the register rather than trusting this column.
        proposed: input.proposed ?? {},
        status: 'submitted',
      })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({
        ok: false,
        error: 'not-raised',
        detail: error.message.includes('does not exist')
          ? 'Run docs/migrations/013_social_and_credential_authority.sql.'
          : error.message,
      }, { status: 500 });
    }

    await admin.from('credential_audit_events').insert({
      credential_id: credential.id,
      credential_ref: credential.credential_id,
      action: 'correction_requested',
      reason: input.description.trim(),
      actor_id: caller.id,
      actor_role: caller.role,
      actor_email: caller.email,
      detail: { request_id: created.id, proposed: input.proposed ?? {} },
    });

    return NextResponse.json({
      ok: true,
      requestId: created.id,
      message:
        'Your request has been recorded and will be reviewed by the Registry. Your credential is '
        + 'unchanged in the meantime and remains valid.',
    });
  }

  // -------------------------------------------------------------------------
  // MOVING A REQUEST
  // -------------------------------------------------------------------------
  if (!input.to) return NextResponse.json({ ok: false, error: 'no-destination' }, { status: 400 });

  const { data: req } = await admin
    .from('credential_correction_requests')
    .select('id, credential_id, status, requested_by')
    .eq('id', input.requestId)
    .maybeSingle();

  if (!req) return NextResponse.json({ ok: false, error: 'not-found' }, { status: 404 });

  // A STUDENT MAY ONLY MOVE THEIR OWN, and only in the ways the state machine
  // allows them — which is withdrawing, and nothing else.
  if (caller.role === 'student' && req.requested_by !== caller.id) {
    return NextResponse.json({
      ok: false,
      error: 'not-yours',
      detail: 'That request was made by somebody else.',
    }, { status: 403 });
  }

  const check = canMove({
    from: req.status as CorrectionState,
    to: input.to,
    role: caller.role,
    note: input.note,
  });

  if (!check.allowed) {
    return NextResponse.json({ ok: false, error: 'refused', detail: check.reason }, { status: 403 });
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: input.to };

  if (input.to === 'under_review') {
    patch.reviewed_by = caller.id;
    patch.reviewed_at = now;
    patch.review_note = input.note?.trim() || null;
  } else if (input.to === 'escalated') {
    patch.escalated_at = now;
    patch.review_note = input.note?.trim() || null;
  } else if (input.to === 'rejected' || input.to === 'approved') {
    patch.decided_by = caller.id;
    patch.decided_at = now;
    patch.decision_note = input.note?.trim() || null;
  }

  const { error } = await admin
    .from('credential_correction_requests')
    .update(patch)
    .eq('id', req.id);

  if (error) {
    return NextResponse.json({ ok: false, error: 'not-moved', detail: error.message }, { status: 500 });
  }

  const action = AUDIT_FOR[input.to];
  if (action) {
    const { data: credential } = await admin
      .from('credentials_issued')
      .select('credential_id')
      .eq('id', req.credential_id)
      .maybeSingle();

    await admin.from('credential_audit_events').insert({
      credential_id: req.credential_id,
      credential_ref: credential?.credential_id ?? null,
      action,
      reason: input.note?.trim() || null,
      actor_id: caller.id,
      actor_role: caller.role,
      actor_email: caller.email,
      detail: { request_id: req.id, from: req.status, to: input.to },
    });
  }

  return NextResponse.json({
    ok: true,
    message: input.to === 'approved'
      // APPROVED IS NOT CORRECTED. The Authority has decided the request is
      // justified; issuing version 2 is a separate, deliberate act against the
      // register, because that is the one that changes what the University has
      // said. Collapsing the two would mean an approval silently reissued a
      // certificate.
      ? 'Approved. The corrected version is issued from the register — open the credential and '
        + 'press Correct to issue it.'
      : `Request moved to ${input.to.replace('_', ' ')}.`,
  });
}
