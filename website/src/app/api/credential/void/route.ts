// ---------------------------------------------------------------------------
// VOIDING A DOCUMENT THE UNIVERSITY ISSUED IN ERROR.
//
// POST { credentialId, reason }
//
// ---------------------------------------------------------------------------
// WHY THIS IS NOT REVOCATION, AND WHY THE DIFFERENCE IS THE POINT
// ---------------------------------------------------------------------------
//
// REVOKING says the University has withdrawn the award. It is a finding
// against the holder, /verify reports it to anyone who asks, and it stays on
// the public record for ever. That is right when a degree is withdrawn.
//
// It is badly wrong when a registry clerk issued a transcript against the wrong
// student, or issued the same certificate twice, or issued against a record
// that had not finished the approval chain. The holder did nothing. Recording
// the University's own mistake as a revocation puts a permanent public mark on
// a student who has not earned one, and there is no way to explain it away
// afterwards because /verify does not do nuance.
//
// So voiding is its own state. It says: this DOCUMENT should not exist and
// should not be relied on; any award the holder has is unaffected; and the
// University will issue a correct one.
//
// ---------------------------------------------------------------------------
// WHAT IT DOES NOT DO
// ---------------------------------------------------------------------------
//
// Delete anything. The row stays, with the reason, the person and the time on
// it, and 004's trigger refuses deletion outright. A registry that can make its
// mistakes disappear has no record of its mistakes.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';

export const runtime = 'nodejs';

/** The shortest reason that is a reason rather than a shrug. */
const MIN_REASON = 12;

export async function POST(request: Request) {
  // THE SAME CAPABILITY AS AMENDING AN ISSUED CREDENTIAL. Voiding is a
  // statement about a document the University has already put its seal on, and
  // it belongs with the office that may correct one — not with the office that
  // may issue one, which is everybody in the registry.
  const g = await guard(request, 'amend-issued-credential');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin, caller } = g;

  let input: { credentialId?: string; reason?: string };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  const reason = String(input.reason ?? '').trim();
  if (!input.credentialId) {
    return NextResponse.json({ ok: false, error: 'no-credential' }, { status: 400 });
  }
  if (reason.length < MIN_REASON) {
    return NextResponse.json({
      ok: false,
      error: 'no-reason',
      detail:
        'Say why this document is being voided, in at least a dozen characters. It is printed '
        + 'on the register and shown to anyone who verifies the number, and "voided" with no '
        + 'reason is a document that vanished from use with nobody accountable for it.',
    }, { status: 400 });
  }

  const { data: credential, error } = await admin
    .from('credentials_issued')
    .select('id, credential_id, version, status, content_hash')
    .eq('id', input.credentialId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: 'unreadable', detail: error.message }, { status: 500 });
  }
  if (!credential) {
    return NextResponse.json({ ok: false, error: 'not-found' }, { status: 404 });
  }

  // A REVOKED CREDENTIAL IS NOT DOWNGRADED TO VOID. Revocation is a finding
  // about the award; voiding it afterwards would quietly remove that finding
  // and replace it with "issued in error", which is a materially different and
  // much more favourable statement.
  if (credential.status === 'revoked') {
    return NextResponse.json({
      ok: false,
      error: 'already-revoked',
      detail:
        'This credential has been revoked, which is a finding about the award itself. Voiding it '
        + 'would replace that finding with "issued in error" — a different and far more '
        + 'favourable statement. If the revocation was wrong, reverse the revocation.',
    }, { status: 409 });
  }
  if (credential.status === 'void') {
    return NextResponse.json({
      ok: true,
      message: 'This document was already void. Nothing changed.',
      alreadyVoid: true,
    });
  }

  // THE TRAIL FIRST. If it cannot be written the document is not voided —
  // the same rule the delivery route follows, and for the same reason.
  const { error: auditErr } = await admin.from('credential_audit_events').insert({
    credential_id: credential.id,
    credential_ref: credential.credential_id,
    action: 'voided',
    to_version: credential.version ?? 1,
    reason,
    actor_id: caller.id,
    actor_role: caller.role,
    actor_email: caller.email,
    document_hash: credential.content_hash,
    detail: { from_status: credential.status },
  });

  if (auditErr) {
    return NextResponse.json({
      ok: false,
      error: 'not-audited',
      detail:
        `The void could not be recorded on the audit trail (${auditErr.message}), so nothing has `
        + 'been changed. A document withdrawn from use with no record of who withdrew it is what '
        + 'the trail exists to prevent.',
    }, { status: 500 });
  }

  const { error: updateErr } = await admin
    .from('credentials_issued')
    .update({
      status: 'void',
      void_reason: reason,
      voided_by: caller.id,
      voided_at: new Date().toISOString(),
    })
    .eq('id', credential.id);

  if (updateErr) {
    return NextResponse.json({
      ok: false,
      error: 'not-voided',
      detail: `${updateErr.message} The audit trail records the attempt; the document still stands.`,
    }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message:
      `${credential.credential_id} is void. Anyone verifying the number is told the University `
      + 'issued it in error and that the holder is not at fault.',
  });
}
