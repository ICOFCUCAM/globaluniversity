// ---------------------------------------------------------------------------
// IS THIS DOCUMENT THE ONE THE UNIVERSITY ISSUED?
//
// POST { credentialId, fields? }   — public, unauthenticated, on purpose
//
// ---------------------------------------------------------------------------
// WHAT THIS ANSWERS THAT /verify DID NOT
// ---------------------------------------------------------------------------
//
// /verify already recomputes a scanned QR payload's hash and compares it with
// the register, so a tampered document detected THROUGH THE QR CODE was always
// caught. But that path needs the QR, and the person holding a suspicious
// document is often holding a photocopy, a scan, or a PDF somebody emailed
// them. They have the credential number and the words printed on the page, and
// nothing to scan.
//
// So this takes the number and, optionally, the particulars as they appear on
// the document, and says which of them disagree with the register — field by
// field, naming the field. "DOCUMENT INVALID" on its own tells an enquirer to
// distrust the whole thing; "the classification on this document reads First
// Class and the University recorded Second Class Honours (Upper Division)"
// tells them what was altered and by whom it matters.
//
// ---------------------------------------------------------------------------
// WHY IT IS PUBLIC, AND WHAT IT WILL NOT DISCLOSE
// ---------------------------------------------------------------------------
//
// The people who most need it — a receiving registry, an employer, a border
// officer — will never have an account here. Requiring one would mean the
// University's tamper check is available to everybody except the people
// checking for tampering.
//
// So it discloses ONLY what the enquirer already claims to be holding. Send a
// name and it says whether that name matches; send nothing and it says nothing
// about the holder at all. It never volunteers a field the caller did not ask
// about, which is what stops it becoming a way to read the register by guessing
// credential numbers.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/adminAuth';
import { signingIdentity, verifySignature } from '@/lib/documentSignature';

export const runtime = 'nodejs';

/** The particulars a reader can copy off a printed document. */
const CHECKABLE = [
  'holderName', 'award', 'classification', 'programme', 'issuedOn', 'studentNumber',
] as const;

type Checkable = (typeof CHECKABLE)[number];

const COLUMN: Record<Checkable, string> = {
  holderName: 'holder_name',
  award: 'award',
  classification: 'classification',
  programme: 'programme',
  issuedOn: 'facts',          // handled specially — it lives in the snapshot
  studentNumber: 'student_number',
};

const LABEL: Record<Checkable, string> = {
  holderName: 'the name of the holder',
  award: 'the award',
  classification: 'the classification',
  programme: 'the programme',
  issuedOn: 'the date of issue',
  studentNumber: 'the student number',
};

/** Loose comparison: case and surrounding space are not tampering. */
const same = (a: unknown, b: unknown) =>
  String(a ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
  === String(b ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

export async function POST(request: Request) {
  const admin = adminClient();
  if (!admin) {
    return NextResponse.json({
      ok: false,
      verdict: 'unavailable',
      note: 'The credential register could not be reached, so this document can be neither '
        + 'confirmed nor denied. That is not a finding about the document.',
    }, { status: 503 });
  }

  let input: { credentialId?: string; fields?: Partial<Record<Checkable, string>> };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  const id = String(input.credentialId ?? '').trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: 'no-credential-number' }, { status: 400 });
  }

  const { data: rows, error } = await admin
    .from('credentials_issued')
    .select('credential_id, version, status, holder_name, award, classification, programme, '
      + 'student_number, facts, content_hash, signature, signing_key_id, issued_at, '
      + 'revoked_at, revocation_reason, void_reason, voided_at')
    .eq('credential_id', id)
    .order('version', { ascending: false });

  if (error) {
    return NextResponse.json({
      ok: false, verdict: 'unavailable', note: `The register returned an error: ${error.message}`,
    }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({
      ok: true,
      verdict: 'not-registered',
      note: 'DOCUMENT INVALID — this credential number is not on the University’s register. '
        + 'No document bearing it was issued by ICOF Global University.',
    });
  }

  // The current version is what a reader is entitled to compare against; an
  // older one is reported as superseded rather than as wrong.
  //
  // The cast is because the generated Supabase types do not know these columns
  // until the project's types are regenerated after migration 020; the select
  // above names every one of them explicitly.
  const all = rows as unknown as Record<string, unknown>[];
  const current = (all.find((r) => r.status !== 'replaced') ?? all[0]);

  const supplied = input.fields ?? {};
  const mismatches: { field: string; onDocument: string; onRegister: string }[] = [];

  for (const field of CHECKABLE) {
    const claim = supplied[field];
    // NEVER VOLUNTEERED. A field the caller did not send is a field this
    // endpoint says nothing about.
    if (claim == null || String(claim).trim() === '') continue;

    const recorded = field === 'issuedOn'
      ? ((current.facts as Record<string, unknown> | null) ?? {}).issued
      : current[COLUMN[field]];

    if (!same(claim, recorded)) {
      mismatches.push({
        field: LABEL[field],
        onDocument: String(claim),
        onRegister: String(recorded ?? '(nothing recorded)'),
      });
    }
  }

  // The signature, checked independently of the fields.
  const identity = signingIdentity();
  const signatureState = !current.signature
    ? 'absent'
    : !identity || (current.signing_key_id && current.signing_key_id !== identity.keyId)
      ? 'unverifiable'
      : verifySignature(
        String(current.content_hash), String(current.signature), identity.publicKeyPem,
      ) ? 'valid' : 'invalid';

  // --- The verdict, in the order that matters to the reader ----------------

  if (mismatches.length > 0) {
    return NextResponse.json({
      ok: true,
      verdict: 'altered',
      credentialId: current.credential_id,
      version: current.version ?? 1,
      mismatches,
      signature: signatureState,
      note: 'DOCUMENT INVALID — this document does not match the University’s official record. '
        + `${mismatches.length} particular${mismatches.length === 1 ? '' : 's'} disagree with the `
        + 'register, listed above. The credential number itself is genuine, so this is an altered '
        + 'copy of a real document rather than an invented one.',
    });
  }

  if (signatureState === 'invalid') {
    return NextResponse.json({
      ok: true,
      verdict: 'signature-failed',
      credentialId: current.credential_id,
      signature: signatureState,
      note: 'DOCUMENT INVALID — the particulars match the register, but the University’s own '
        + 'signature over this credential does not verify. Contact the University before '
        + 'relying on it.',
    });
  }

  if (current.status === 'void') {
    return NextResponse.json({
      ok: true,
      verdict: 'void',
      credentialId: current.credential_id,
      voidedOn: current.voided_at,
      voidReason: current.void_reason,
      signature: signatureState,
      note: 'DO NOT RELY ON THIS DOCUMENT — the University voided it as issued in error. This is '
        + 'not a finding against the holder; any award they hold is unaffected, and the '
        + 'University will issue a correct document on request.',
    });
  }

  if (current.status === 'revoked') {
    return NextResponse.json({
      ok: true,
      verdict: 'revoked',
      credentialId: current.credential_id,
      revokedOn: current.revoked_at,
      revocationReason: current.revocation_reason,
      signature: signatureState,
      note: 'The particulars match the register, but this credential has been REVOKED by the '
        + 'University and no longer stands.',
    });
  }

  return NextResponse.json({
    ok: true,
    verdict: 'matches',
    credentialId: current.credential_id,
    version: current.version ?? 1,
    issuedOn: current.issued_at,
    checked: Object.keys(supplied).filter((k) => String(supplied[k as Checkable] ?? '').trim()),
    signature: signatureState,
    note: (Object.keys(supplied).length === 0
      ? 'This credential number is on the University’s register. No particulars were supplied, '
        + 'so nothing on the document itself has been checked — send the name, award and date as '
        + 'they appear on it to check those too.'
      : 'Every particular supplied matches the University’s official record.')
      + (signatureState === 'valid'
        ? ' The University’s signature over it is valid.'
        : signatureState === 'absent'
          ? ' It carries the University’s seal; it predates the University’s signing key, so it '
            + 'carries no detached signature.'
          : ''),
  });
}
