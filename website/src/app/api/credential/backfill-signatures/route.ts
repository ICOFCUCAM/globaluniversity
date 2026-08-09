// ---------------------------------------------------------------------------
// SIGNING THE CREDENTIALS THAT WERE ISSUED BEFORE THE UNIVERSITY HELD A KEY.
//
// POST { limit?, dryRun? }   — Superadministrator only
//
// ---------------------------------------------------------------------------
// WHY THIS IS SAFE, WHICH IS NOT OBVIOUS
// ---------------------------------------------------------------------------
//
// Adding a signature to a credential issued last year sounds like altering a
// sealed document, and it would be — except that the signature is made over the
// CONTENT HASH, which was computed at issue and has never changed.
//
// So this changes nothing a reader relies on:
//
//   * the hash is untouched, so /verify's comparison against a presented
//     document behaves exactly as before
//   * the HMAC seal is untouched, so a printed document still verifies
//   * the facts, the holder, the award and the classification are untouched
//   * a document already in a graduate's hand still verifies, and now also
//     carries a signature anybody can check against the published key
//
// The one thing that changes is that a credential which previously reported
// 'absent' for its signature now reports 'valid'. That is the point.
//
// ---------------------------------------------------------------------------
// WHY IT IS NOT AUTOMATIC
// ---------------------------------------------------------------------------
//
// Because signing every credential in the register is the University putting
// its name to them all at once, and it should be an act somebody performed on a
// date, not a side effect of a deployment. It is audited per credential.
//
// ---------------------------------------------------------------------------
// WHAT IT REFUSES
// ---------------------------------------------------------------------------
//
// To re-sign anything that already carries a signature — including one made
// with a key that has since been rotated. Overwriting an old signature would
// destroy the only evidence that the earlier key ever signed it, and a document
// in circulation quoting that signature would stop verifying. Rotation is
// handled by publishing the retired public key, not by rewriting history.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';
import { signContentHash, signingIdentity } from '@/lib/documentSignature';

export const runtime = 'nodejs';

/** A batch small enough to stay inside a serverless request. */
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

export async function POST(request: Request) {
  // THE CAPABILITY THAT DESIGNS CREDENTIALS, not the one that issues them.
  // Signing the whole back catalogue is a statement about the register as a
  // whole and belongs with the Superadministrator.
  const g = await guard(request, 'design-credentials');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin, caller } = g;

  const identity = signingIdentity();
  if (!identity) {
    return NextResponse.json({
      ok: false,
      error: 'no-signing-key',
      detail:
        'CREDENTIAL_SIGNING_KEY is not set on this server, so there is nothing to sign with. '
        + 'Set it and try again — the credentials are unaffected and still verify through '
        + '/verify.',
    }, { status: 503 });
  }

  let input: { limit?: number; dryRun?: boolean } = {};
  try {
    input = await request.json();
  } catch {
    // An empty body is a run with the defaults, not an error.
  }

  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(input.limit) || DEFAULT_LIMIT));

  const { data: rows, error, count } = await admin
    .from('credentials_issued')
    .select('id, credential_id, version, content_hash', { count: 'exact' })
    .is('signature', null)
    .not('content_hash', 'is', null)
    .order('issued_at', { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ ok: false, error: 'unreadable', detail: error.message }, { status: 500 });
  }

  const pending = count ?? rows?.length ?? 0;

  if (!rows || rows.length === 0) {
    return NextResponse.json({
      ok: true,
      signed: 0,
      remaining: 0,
      keyId: identity.keyId,
      message: 'Every credential on the register already carries a signature.',
    });
  }

  // A DRY RUN SAYS WHAT WOULD HAPPEN AND CHANGES NOTHING. Signing the whole
  // register is not something to discover the shape of by doing it.
  if (input.dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      wouldSign: rows.length,
      remaining: Math.max(0, pending - rows.length),
      keyId: identity.keyId,
      message:
        `${pending} credential(s) carry no signature. This run would sign ${rows.length} of them `
        + `with key ${identity.keyId}. Nothing has been changed.`,
    });
  }

  let signed = 0;
  const failures: { credentialId: string; reason: string }[] = [];

  for (const row of rows as unknown as {
    id: string; credential_id: string; version: number | null; content_hash: string;
  }[]) {
    const sig = signContentHash(row.content_hash);
    if (!sig.signature) {
      failures.push({ credentialId: row.credential_id, reason: sig.reason ?? 'not signed' });
      continue;
    }

    // THE TRAIL FIRST, per credential — the same order every other act in this
    // register follows. A signature applied with no record of who applied it is
    // the kind of quiet change the trail exists to prevent.
    const { error: auditErr } = await admin.from('credential_audit_events').insert({
      credential_id: row.id,
      credential_ref: row.credential_id,
      action: 'reissued',
      to_version: row.version ?? 1,
      reason: `Signed with key ${identity.keyId}. The content hash, the seal and every fact are `
        + 'unchanged; only the detached signature was added.',
      actor_id: caller.id,
      actor_role: caller.role,
      actor_email: caller.email,
      document_hash: row.content_hash,
      detail: { backfill: true, key_id: identity.keyId },
    });

    if (auditErr) {
      failures.push({ credentialId: row.credential_id, reason: `not audited: ${auditErr.message}` });
      continue;
    }

    // GUARDED ON signature IS NULL, so two operators running this at once
    // cannot overwrite each other's work — and so a key rotated between the
    // read and the write cannot replace a signature already made.
    const { error: updateErr } = await admin
      .from('credentials_issued')
      .update({ signature: sig.signature, signing_key_id: sig.keyId })
      .eq('id', row.id)
      .is('signature', null);

    if (updateErr) {
      failures.push({ credentialId: row.credential_id, reason: updateErr.message });
      continue;
    }
    signed += 1;
  }

  const remaining = Math.max(0, pending - signed);

  return NextResponse.json({
    ok: true,
    signed,
    remaining,
    failures,
    keyId: identity.keyId,
    message:
      `${signed} credential(s) signed with key ${identity.keyId}.`
      + (remaining > 0 ? ` ${remaining} still to do — run it again.` : ' None remaining.')
      + (failures.length > 0 ? ` ${failures.length} could not be signed; see failures.` : '')
      + ' No hash, seal or fact was changed, so every document already in circulation still'
      + ' verifies exactly as it did.',
  });
}
