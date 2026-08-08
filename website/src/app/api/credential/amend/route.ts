// ---------------------------------------------------------------------------
// CORRECTING AN ISSUED CREDENTIAL.
//
// POST { credentialId, changes: {holder_name?, award?, classification?,
//        programme?}, reason, correctionRequestId? }
//
//   "the superadmin should have a special privilege to edit any version of the
//    certificates or degrees"
//   "Never destroy the previous certificate."
//
// ---------------------------------------------------------------------------
// THIS ROUTE HAS NO UPDATE STATEMENT AGAINST THE FIELDS OF A CERTIFICATE
// ---------------------------------------------------------------------------
//
// It issues a new version. Version 1 is marked 'replaced' and keeps its own
// number, its own hash, its own date and its own seal; version 2 is inserted
// with the same credential number and a new hash; and an amendment row records
// which fields changed, from what, to what, by whom and why.
//
// The register enforces this rather than trusting the route: 004's
// `guard_credential_register` trigger refuses any UPDATE that touches
// holder_name, award, classification, programme, facts, content_hash,
// seal_code, issued_at or issued_by. So a future version of this file that
// tried to take the shortcut would fail loudly rather than silently rewriting
// what the University appears to have said in 2024.
//
// WHY THE OLD ROW IS MARKED 'replaced' AND NOT 'revoked'. They mean different
// things to whoever is holding the printed copy. Revoked says the University
// withdrew it — that something was wrong with the holder's entitlement.
// Replaced says the University corrected its own document. A graduate whose
// surname was misspelled has done nothing wrong, and their old certificate must
// not verify as though they had.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';
import { needsReason } from '@/lib/credentialAuthority';
import {
  sealAward, contentHash, awardFields, AWARD_FORMAT, type AwardFacts,
} from '@/lib/documentSecurity';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://iguc.net';

export const runtime = 'nodejs';

/** The fields a correction may touch. Everything else about a credential is
 *  structural — its number, its kind, its hash — and is not a "correction". */
const CORRECTABLE = ['holder_name', 'award', 'classification', 'programme'] as const;
type Correctable = (typeof CORRECTABLE)[number];

export async function POST(request: Request) {
  const g = await guard(request, 'amend-issued-credential');
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: g.error?.startsWith('not-permitted')
        ? 'Correcting a sealed credential is held by the Credential Authority — the '
          + 'Superadministrator acting as Vice-Chancellor. The Registrar may print and email.'
        : undefined,
    }, { status: g.status });
  }
  const { admin, caller } = g;

  let input: {
    credentialId?: string;
    changes?: Partial<Record<Correctable, string>>;
    reason?: string;
    correctionRequestId?: string;
  };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  const reason = (input.reason ?? '').trim();
  if (needsReason('corrected') && !reason) {
    return NextResponse.json({
      ok: false,
      error: 'no-reason',
      detail:
        'A correction to a sealed document must state its reason. Without one the amendment is '
        + 'indistinguishable from tampering when it is read back years later.',
    }, { status: 400 });
  }

  if (!input.credentialId) {
    return NextResponse.json({ ok: false, error: 'no-credential' }, { status: 400 });
  }

  // -------------------------------------------------------------------------
  // READ THE CURRENT VERSION.
  // -------------------------------------------------------------------------
  const { data: existing, error: readErr } = await admin
    .from('credentials_issued')
    .select('*')
    .eq('id', input.credentialId)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json({ ok: false, error: 'unreadable', detail: readErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'not-found' }, { status: 404 });
  }

  if (existing.status === 'revoked') {
    return NextResponse.json({
      ok: false,
      error: 'revoked',
      detail:
        'A revoked credential cannot be corrected. Revocation is final by design — un-revoking '
        + 'would let the University quietly restore something it had withdrawn. Issue a new award.',
    }, { status: 409 });
  }

  if (existing.status === 'replaced') {
    return NextResponse.json({
      ok: false,
      error: 'superseded',
      detail:
        'This version has already been superseded. Corrections are made against the current '
        + 'version, so that the history stays a single continuous chain.',
    }, { status: 409 });
  }

  // -------------------------------------------------------------------------
  // WHAT ACTUALLY CHANGED.
  //
  // COMPUTED, NOT TAKEN FROM THE REQUEST. The client sends the new values; this
  // works out the difference against what the register actually holds. A
  // client-supplied "changes" object would record what somebody believed they
  // were changing, which is not the same thing and is exactly the field an
  // audit trail must not take on trust.
  // -------------------------------------------------------------------------
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const next: Record<string, unknown> = {};

  for (const field of CORRECTABLE) {
    const proposed = input.changes?.[field];
    if (proposed === undefined) continue;
    const before = existing[field] ?? null;
    const after = proposed.trim() === '' ? null : proposed.trim();
    if (before === after) continue;
    changes[field] = { from: before, to: after };
    next[field] = after;
  }

  if (Object.keys(changes).length === 0) {
    return NextResponse.json({
      ok: false,
      error: 'nothing-changed',
      detail:
        'Nothing about this credential would change. A version that says exactly what the '
        + 'previous one said is not a correction; it is noise in the history.',
    }, { status: 422 });
  }

  // -------------------------------------------------------------------------
  // SEAL THE NEW VERSION.
  //
  // A new hash over the new facts. The old hash stays on the old row — that is
  // what lets a printed version 1 still be checked against what it actually
  // said, rather than against what the University later corrected it to.
  // -------------------------------------------------------------------------
  const version = (existing.version ?? 1) + 1;

  // SEALED THE SAME WAY /api/credential/issue SEALS. Same format constant, same
  // field order, same helper — because /verify re-derives the hash with those
  // and a corrected certificate that seals differently would verify as
  // tampered. The document was corrected; it is not a forgery, and it must not
  // read as one.
  const facts: AwardFacts = {
    credentialId: existing.credential_id,
    holderName: String(next.holder_name ?? existing.holder_name),
    award: String(next.award ?? existing.award ?? ''),
    classification: (next.classification ?? existing.classification) as string | undefined,
    programme: (next.programme ?? existing.programme) as string | undefined,
    issuedOn: new Date().toISOString().slice(0, 10),
  };

  const seal = sealAward(facts, SITE);
  if (!seal.sealed) {
    // The same refusal /api/credential/issue makes, for the same reason: an
    // unsealed row could never be sealed later without changing what was
    // issued, so it would be permanently unverifiable. Nothing has been written
    // at this point, so the original stands untouched.
    return NextResponse.json({
      ok: false,
      error: 'credential-secret-not-set',
      detail:
        'CREDENTIAL_SECRET is not set on the server, so the corrected certificate cannot be '
        + 'sealed and could never be verified. Nothing has been changed. Set the key and '
        + 'correct again.',
    }, { status: 503 });
  }

  const hash = contentHash(AWARD_FORMAT, 'Degree Certificate', awardFields(facts));

  const { data: created, error: insertErr } = await admin
    .from('credentials_issued')
    .insert({
      credential_id: existing.credential_id, // THE SAME NUMBER. See point 9.
      kind: existing.kind,
      student_id: existing.student_id,
      student_number: existing.student_number,
      holder_name: next.holder_name ?? existing.holder_name,
      award: next.award ?? existing.award,
      classification: next.classification ?? existing.classification,
      programme: next.programme ?? existing.programme,
      facts: awardFields(facts),
      content_hash: hash,
      seal_code: seal.code,
      template_version: existing.template_version,
      template_id: existing.template_id,
      type_id: existing.type_id,
      version,
      supersedes_id: existing.id,
      issued_by: caller.id,
      status: 'issued',
    })
    .select('id, credential_id, version')
    .single();

  if (insertErr || !created) {
    return NextResponse.json({
      ok: false,
      error: 'not-issued',
      detail: insertErr?.message?.includes('duplicate key')
        ? 'The register still constrains credential numbers to be unique on their own, so a '
          + 'second version cannot be written. Run docs/migrations/013_social_and_credential_authority.sql.'
        : insertErr?.message,
    }, { status: 500 });
  }

  // -------------------------------------------------------------------------
  // SUPERSEDE THE OLD ONE.
  //
  // ORDER MATTERS. The new version is written first, so that if anything fails
  // the register is left with a valid current credential rather than with an
  // award whose only version is marked replaced and points at nothing.
  // -------------------------------------------------------------------------
  const { error: supersedeErr } = await admin
    .from('credentials_issued')
    .update({ status: 'replaced', replaced_by: created.id })
    .eq('id', existing.id);

  if (supersedeErr) {
    return NextResponse.json({
      ok: false,
      error: 'not-superseded',
      detail:
        `Version ${version} was issued but version ${existing.version ?? 1} could not be marked `
        + `superseded: ${supersedeErr.message}. Both versions now read as current and this must be `
        + 'corrected before either is relied on.',
    }, { status: 500 });
  }

  // -------------------------------------------------------------------------
  // THE REGISTRY ENTRY. "the changes he make should automatically register in
  // the system" — this, and the audit event below, are what that sentence
  // actually asks for.
  // -------------------------------------------------------------------------
  const { data: amendment } = await admin
    .from('credential_amendments')
    .insert({
      original_id: existing.id,
      replacement_id: created.id,
      changes,
      reason,
      amended_by: caller.id,
    })
    .select('id')
    .single();

  // The append-only trail. This insert cannot be edited or deleted afterwards
  // by anyone, including the caller who just made it.
  await admin.from('credential_audit_events').insert({
    credential_id: created.id,
    credential_ref: existing.credential_id,
    action: 'corrected',
    from_version: existing.version ?? 1,
    to_version: version,
    reason,
    actor_id: caller.id,
    actor_role: caller.role,
    actor_email: caller.email,
    document_hash: hash,
    detail: { changes, amendment_id: amendment?.id ?? null },
  });

  // If this came from a student's correction request, close it against the
  // amendment so the two records point at each other.
  if (input.correctionRequestId) {
    await admin
      .from('credential_correction_requests')
      .update({
        status: 'approved',
        decided_by: caller.id,
        decided_at: new Date().toISOString(),
        decision_note: reason,
        amendment_id: amendment?.id ?? null,
      })
      .eq('id', input.correctionRequestId);

    await admin.from('credential_audit_events').insert({
      credential_id: created.id,
      credential_ref: existing.credential_id,
      action: 'correction_approved',
      reason,
      actor_id: caller.id,
      actor_role: caller.role,
      actor_email: caller.email,
      detail: { request_id: input.correctionRequestId },
    });
  }

  return NextResponse.json({
    ok: true,
    credentialId: created.id,
    reference: existing.credential_id,
    version,
    changes,
    message:
      `${existing.credential_id} corrected. Version ${existing.version ?? 1} is superseded and `
      + `version ${version} is current. Both remain on the register, and a scan of the old `
      + 'document will report the correction rather than reporting the award as invalid.',
  });
}
