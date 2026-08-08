// ---------------------------------------------------------------------------
// Signing and verification for the QR code on a transcript or certificate.
//
// TWO FAULTS HERE ALLOWED ANYONE TO FORGE AN ICOF DEGREE.
//
// 1. THE SIGNING ENDPOINT WAS PUBLIC.
//
//    POST /api/credential took an arbitrary string and returned a valid
//    signature for it, to anyone, with no authentication whatsoever. So a
//    stranger could compose a payload — any name, any degree, any
//    classification — ask this endpoint to sign it, and produce a QR code that
//    the university's own /verify page confirms as genuine. The signature was
//    doing no work at all: it certified that someone had called an open URL.
//
//    Signing now requires the service-role key and a caller holding
//    'design-credentials'. A credential is signed by the institution or it is
//    not signed.
//
// 2. THE SECRET FELL BACK TO A LITERAL IN THIS FILE.
//
//    `process.env.CREDENTIAL_SECRET ?? 'iguc-credential-dev-secret'` — so with
//    the variable unset, which is the state of any deployment where nobody has
//    set it, the signing key was a string committed to a public repository.
//    Anyone who read this file could compute signatures offline, forever,
//    without touching the university's servers at all.
//
//    There is no fallback now. Without CREDENTIAL_SECRET both routes refuse.
//    A credential system that works with a published key is worse than one that
//    is switched off, because it produces documents people trust.
//
// WHAT THE SIGNATURE ALONE DOES NOT DO, AND WHAT NOW DOES IT.
//
// A valid signature proves this institution's key was applied to a string. It
// does not prove the credential was ever issued, or that it still stands. For a
// long time nothing could: there was no issuance record, so /verify could only
// honestly say "correctly signed".
//
// 004_credential_register.sql added one. GET now does two checks, and reports
// them separately, because they can disagree and the disagreement is the
// interesting part:
//
//   signature  — was this sealed by the university?
//   register   — was it issued, and does it still stand?
//
// A signed credential that is not on the register was minted with the key but
// never issued. A registered credential whose hash disagrees with the presented
// payload has been altered since — and the register can say what it should have
// said, which a broken signature cannot.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { guard, adminClient } from '@/lib/adminAuth';

export const runtime = 'nodejs';

function secret(): string | null {
  const s = process.env.CREDENTIAL_SECRET;
  // A short secret is not a secret. 32 hex characters is the minimum worth
  // having, and refusing a weak one is better than signing with it.
  if (!s || s.length < 32) return null;
  return s;
}

function sign(data: string, key: string): string {
  // The full digest, not the first 24 characters. Truncating to 96 bits was
  // survivable but pointless — the saving is a few bytes in a QR code, against
  // a permanent reduction in the strength of every credential the university
  // has ever issued.
  return createHmac('sha256', key).update(data).digest('hex');
}

/** Constant-time compare, so the endpoint cannot be used as an oracle. */
function matches(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(request: Request) {
  const key = secret();
  if (!key) {
    return NextResponse.json(
      { ok: false, error: 'credential-secret-not-set' },
      { status: 503 },
    );
  }

  // Only the office that publishes credential designs may sign a credential.
  const g = await guard(request, 'design-credentials');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });

  const { data } = await request.json().catch(() => ({}));
  if (typeof data !== 'string' || !data || data.length > 2000) {
    return NextResponse.json({ ok: false, error: 'bad-payload' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, sig: sign(data, key) });
}

export async function GET(request: Request) {
  const key = secret();
  if (!key) {
    // Not "invalid" — unknown. Reporting a genuine credential as invalid
    // because the university forgot an environment variable would have a
    // graduate accused of forging their own degree.
    return NextResponse.json(
      { ok: false, error: 'credential-secret-not-set', signed: null },
      { status: 503 },
    );
  }

  const url = new URL(request.url);

  // ---------------------------------------------------------------------
  // LOOKUP BY CREDENTIAL NUMBER — how an employer actually verifies.
  //
  // Every certificate prints "VERIFY AT iguc.net/verify" and a credential
  // number beneath it, and until now that instruction could not be followed:
  // this route only accepted the base64 payload and signature out of a QR. An
  // employer holding a printed certificate has a NUMBER. Someone reading one
  // over the telephone has a number. A registrar in another country filing a
  // reference has a number.
  //
  // So a number is now enough. It returns what the register holds, and no
  // signature check is involved because there is no presented payload to check
  // — which is the honest position: this confirms the university issued a
  // credential with that number and states what it says, and the reader
  // compares it against the paper in front of them.
  // ---------------------------------------------------------------------
  const byNumber = (url.searchParams.get('id') ?? '').trim().toUpperCase();
  if (byNumber) {
    return NextResponse.json(await lookUpByNumber(byNumber));
  }

  const data = url.searchParams.get('d') ?? '';
  const sig = url.searchParams.get('s') ?? '';
  const signed = !!data && !!sig && matches(sign(data, key), sig);

  let payload: unknown = null;
  if (signed) {
    try {
      payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    } catch {
      return NextResponse.json({ ok: true, signed: false });
    }
  }

  if (!signed) {
    return NextResponse.json({ ok: true, signed: false, valid: false });
  }

  // The register. A signature says the key was applied; this says the
  // university issued it, and whether it still stands.
  const record = await lookUpRegister(payload as Record<string, unknown> | null);

  // `valid` now means signed AND on the register AND not revoked — all three.
  // It used to mean "signed", which was the strongest claim available at the
  // time and a weaker one than the word implies.
  const valid = signed && record.status === 'issued' && record.hashMatches !== false;

  return NextResponse.json({ ok: true, signed, valid, payload, register: record });
}

export interface RegisterVerdict {
  /** 'issued' | 'revoked' | 'replaced' | 'not-registered' | 'unavailable' */
  status: string;
  issuedOn?: string | null;
  revokedOn?: string | null;
  revocationReason?: string | null;
  templateVersion?: number | null;
  /**
   * Whether the presented payload still hashes to what the register recorded.
   * Undefined when there is nothing to compare against.
   */
  hashMatches?: boolean;
  note: string;
}

/**
 * Look the credential up by its number.
 *
 * Read with the service role, because the register is not readable from the
 * browser — publishing the name, award and classification of every graduate to
 * anyone holding the publishable key is exactly what the RLS in
 * 004_credential_register.sql prevents.
 *
 * A credential with no number in its payload is one of the older document
 * kinds — an admission letter, a student card — which are sealed but not
 * registered. Those report 'not-registered' with a note saying so, rather than
 * being reported as suspect: a document that was never meant to be on the
 * register is not evidence of anything when it is not.
 */
async function lookUpRegister(payload: Record<string, unknown> | null): Promise<RegisterVerdict> {
  const id = typeof payload?.credential_id === 'string' ? payload.credential_id : null;
  if (!id) {
    return {
      status: 'not-registered',
      note: 'This document type is sealed but not entered on the credential register. ' +
        'The signature above is the check that applies to it.',
    };
  }

  const admin = adminClient();
  if (!admin) {
    // Not "invalid" — unknown. Reporting a genuine degree as unregistered
    // because a server variable is missing would have a graduate accused of
    // forging their own certificate.
    return {
      status: 'unavailable',
      note: 'The credential register could not be reached, so this credential can be neither ' +
        'confirmed nor denied against it. That is not a finding about the document.',
    };
  }

  // EVERY VERSION OF THIS AWARD, NOT ONE ROW.
  //
  // This used to be `.maybeSingle()`, which was right while a credential number
  // identified exactly one row. Migration 013 made a corrected award two rows
  // sharing one number — that is what lets a QR printed on version 1 still
  // resolve — and `.maybeSingle()` fails outright when it matches more than
  // one. So the first credential the University ever corrected would have made
  // its own verification page report "the credential register returned an
  // error" to whoever was checking it. A graduate with a corrected certificate
  // would have looked like a forger.
  const { data: versions, error } = await admin
    .from('credentials_issued')
    .select('status, issued_at, revoked_at, revocation_reason, template_version, content_hash, version')
    .eq('credential_id', id)
    .order('version', { ascending: false });

  if (error) {
    return { status: 'unavailable', note: `The credential register returned an error: ${error.message}` };
  }
  if (!versions || versions.length === 0) {
    return {
      status: 'not-registered',
      note: 'This credential number is not on the university\'s register. It was not issued by ' +
        'ICOF Global University, whatever it is signed with.',
    };
  }

  const presented = createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');

  // WHICH VERSION IS IN THE ENQUIRER'S HAND. The hash on the document says so —
  // each version seals its own facts — and that is the whole reason the old
  // hash is never overwritten when a correction is made.
  const scanned = versions.find((v) => v.content_hash === presented) ?? null;
  const current = versions.find((v) => v.status !== 'replaced') ?? versions[0];
  const hashMatches = scanned !== null;

  // Revocation applies to the award, not to a print of it.
  if (current.status === 'revoked') {
    return {
      status: 'revoked',
      issuedOn: current.issued_at,
      revokedOn: current.revoked_at,
      revocationReason: current.revocation_reason,
      templateVersion: current.template_version,
      hashMatches,
      note: 'This credential was issued and has since been REVOKED by the university. It no longer stands.',
    };
  }

  if (scanned && scanned.status === 'replaced') {
    return {
      status: 'replaced',
      issuedOn: scanned.issued_at,
      templateVersion: scanned.template_version,
      hashMatches: true,
      // THE WORDING MATTERS AS MUCH AS THE STATUS. An employer holding a
      // corrected certificate must not be left thinking the degree is in
      // doubt. The award stands; the University corrected its own document.
      note:
        `Credential superseded. This is version ${scanned.version ?? 1}, which the University `
        + `replaced with version ${current.version ?? 1} on `
        + `${String(current.issued_at).slice(0, 10)}. The award itself stands and is valid — ask `
        + 'the holder for the current version, or verify it by number.',
    };
  }

  if (!hashMatches) {
    return {
      status: current.status,
      issuedOn: current.issued_at,
      templateVersion: current.template_version,
      hashMatches: false,
      note: versions.length > 1
        // A document that matches no version at all is different from one that
        // matches an older version, and saying so stops a genuine older print
        // being reported as altered.
        ? 'This credential number is on the register, but the details presented match no version '
          + 'of it that the University has issued. The document has been altered.'
        : 'This credential is on the register, but the details presented do not match what '
          + 'the university recorded. The document has been altered since it was issued.',
    };
  }

  return {
    status: 'issued',
    issuedOn: scanned!.issued_at,
    templateVersion: scanned!.template_version,
    hashMatches: true,
    note: versions.length > 1
      ? `Issued by ICOF Global University and current on its register (version ${scanned!.version ?? 1}).`
      : 'Issued by ICOF Global University and current on its register.',
  };
}

/**
 * Verification by credential number alone.
 *
 * Deliberately returns the substance of the award — holder, award,
 * classification, date, status — because that is what the enquirer is checking
 * against the document in their hand, and withholding it would make the check
 * useless. It does NOT return the student's contact details, date of birth,
 * marks or anything else on the student record: an employer verifying a degree
 * is entitled to know that the degree is real, not to a copy of the file.
 *
 * A number that is not on the register returns a plain negative. There is no
 * timing difference and no hint — a number is either issued or it is not.
 */
async function lookUpByNumber(credentialId: string) {
  const admin = adminClient();
  if (!admin) {
    return {
      ok: false,
      error: 'register-unavailable',
      note: 'The credential register could not be reached, so this number can be neither ' +
        'confirmed nor denied. That is not a finding about the document.',
    };
  }

  // Every version, newest first — see lookUpRegister above for why this cannot
  // be `.maybeSingle()` any more.
  const { data: rows, error } = await admin
    .from('credentials_issued')
    .select('credential_id, kind, holder_name, award, classification, programme, issued_at, status, revoked_at, revocation_reason, template_version, version')
    .eq('credential_id', credentialId)
    .order('version', { ascending: false });

  if (error) {
    return { ok: false, error: 'register-error', note: error.message };
  }

  // WHAT THE UNIVERSITY SAYS NOW. A search by number asks "is this award real
  // and what is it", which is a question about the award rather than about any
  // particular printed copy — so it is answered with the current version.
  const data = (rows ?? []).find((r) => r.status !== 'replaced') ?? (rows ?? [])[0] ?? null;
  const supersededCount = (rows ?? []).filter((r) => r.status === 'replaced').length;

  if (!data) {
    return {
      ok: true,
      found: false,
      note: 'No credential with this number has been issued by ICOF Global University.',
    };
  }

  return {
    ok: true,
    found: true,
    credential: {
      credentialId: data.credential_id,
      kind: data.kind,
      holderName: data.holder_name,
      award: data.award,
      classification: data.classification,
      programme: data.programme,
      issuedOn: data.issued_at,
      templateVersion: data.template_version,
      status: data.status,
      revokedOn: data.revoked_at,
      revocationReason: data.revocation_reason,
      version: data.version ?? 1,
      supersededVersions: supersededCount,
    },
    note:
      data.status === 'revoked'
        ? 'This credential was issued and has since been REVOKED by the university. It no longer stands.'
        : supersededCount > 0
          // NOT A WARNING. The enquirer asked whether the award is real; it is,
          // and the University corrected its own document at some point. Saying
          // so plainly is more useful than either hiding it or implying doubt.
          ? `Issued by ICOF Global University and current on its register. This is version `
            + `${data.version ?? 1}; ${supersededCount === 1 ? 'an earlier version was' : `${supersededCount} earlier versions were`} `
            + 'superseded when the University corrected the document. The award is unaffected.'
          : 'Issued by ICOF Global University and current on its register.',
  };
}
