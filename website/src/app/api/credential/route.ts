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
// WHAT THIS STILL DOES NOT DO. A valid signature proves the payload was signed
// by this institution. It does not prove the credential was ever issued, or
// that it has not since been revoked — there is no issuance record to check
// against. Until there is, /verify should say "correctly signed", not "valid",
// and the page does.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { guard } from '@/lib/adminAuth';

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

  // `signed`, not `valid`. See the header: this proves the institution signed
  // the payload, not that the credential was issued or still stands.
  return NextResponse.json({ ok: true, signed, valid: signed, payload });
}
