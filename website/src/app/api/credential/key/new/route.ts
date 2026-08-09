// ---------------------------------------------------------------------------
// GENERATING A SIGNING KEY, ON THE UNIVERSITY'S OWN SERVER.
//
// POST /api/credential/key/new   — Superadministrator only
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS, AND WHY IT IS UNCOMFORTABLE
// ---------------------------------------------------------------------------
//
// The correct way to make a private key is to run one command on a machine you
// control and never let it touch a network. That is what DEPLOYMENT.md says and
// it remains the better option.
//
// It also assumes the person setting up the University's credential signing has
// Node installed and a terminal open, and the Registrar of a university does
// not. The realistic alternatives for somebody without them are an online key
// generator — a stranger's server, which has then seen the key — or asking
// somebody else to make one and send it, which puts it in a chat log or an
// email for ever.
//
// So the key is generated HERE: on the University's own deployment, over TLS,
// to an authenticated Superadministrator, and shown once. That is worse than a
// terminal and much better than either alternative, and the screen says so
// rather than pretending it is ideal.
//
// ---------------------------------------------------------------------------
// WHAT IT DOES NOT DO
// ---------------------------------------------------------------------------
//
// STORE THE KEY. Anywhere. It is generated in memory, returned once, and
// forgotten — there is no database write and no log line. If the operator loses
// it before pasting it into the host, it is gone and they generate another;
// nothing has been signed with it yet, so nothing is lost.
//
// It is also POST, not GET, so it cannot be triggered by following a link, and
// nothing in the application ever calls it.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';
import {
  generateSigningKey, publishedKeys, storeSigningKey, resetKeyringCache, type SecretDb,
} from '@/lib/documentSignature';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const g = await guard(request, 'design-credentials');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin } = g;

  let body: { keep?: boolean } = {};
  try { body = await request.json(); } catch { /* an empty body means the default */ }

  const db = admin as unknown as SecretDb;
  const before = await publishedKeys(db);
  const { privateKeyPem, publicKeyPem, keyId } = generateSigningKey();

  // ---------------------------------------------------------------------
  // THE SYSTEM KEEPS IT, unless the caller asked to hold it themselves.
  //
  // The key goes into the University's own sealed store — AES-256-GCM, with
  // row-level security and no policy at all, so it is unreadable through the
  // publishable key by construction. No environment variable, no redeploy.
  //
  // THE EARLIER KEYS ARE KEPT ALONGSIDE IT and their public halves published,
  // so a signature made before a rotation still checks. That is why this can
  // rotate at all without quietly breaking the University's guarantee on every
  // document it has already signed.
  // ---------------------------------------------------------------------
  let kept: { keyId: string; retired: string[] } | null = null;
  let keepError: string | null = null;
  if (body.keep !== false) {
    try {
      kept = await storeSigningKey(db, privateKeyPem);
      resetKeyringCache();
    } catch (e) {
      keepError = e instanceof Error ? e.message : 'The key could not be stored.';
    }
  }

  return NextResponse.json({
    ok: true,
    keyId,
    // KEPT BY THE SYSTEM, AND THAT IS THE HEADLINE. When it is, the private key
    // below is a copy for the University's own records — nothing has to be
    // pasted anywhere and nothing has to be redeployed.
    kept: Boolean(kept),
    keepError,
    retiredKeys: kept?.retired ?? [],
    privateKeyPem,
    publicKeyPem,
    variable: 'CREDENTIAL_SIGNING_KEY',
    // THE WARNING TRAVELS WITH THE KEY, so it cannot be shown without it.
    warning: kept
      ? 'The University is now signing with this key — nothing to paste, nothing to redeploy. It '
        + 'is sealed in the University’s own secret store. The copy below is shown once, for your '
        + 'records; keep it somewhere safe, because if SECRET_STORE_KEY is ever lost this is the '
        + 'only way back to it.'
      : 'This is shown once and is not stored anywhere. Copy the whole private key, including the '
        + 'BEGIN and END lines, into your host as CREDENTIAL_SIGNING_KEY, then redeploy. If you '
        + 'lose it before doing that, generate another — nothing has been signed with this one.',
    // ROTATION IS NOT FREE, and an operator who already has a key must be told
    // before they replace it. Old signatures stay valid — the key id is stored
    // beside each one — but only if the retired public key is kept and
    // published, and nothing in this system does that automatically yet.
    alreadyConfigured: Boolean(before.active),
    // NO LONGER A WARNING TO ACT ON, because the thing it warned about is
    // fixed. Retired keys are kept and published, so a signature made under the
    // old one still checks. It is said anyway, because an operator rotating a
    // key is entitled to know what happens to what came before.
    rotationNote: before.active
      ? `Key ${before.active.keyId} signed before this one. It is retired, not discarded: its `
        + 'public half stays published at /api/credential/key, so every credential signed with it '
        + 'still verifies. Nothing already issued is affected.'
      : null,
    // The environment variable is the one case where a stored key does not
    // take effect, and an operator must not be left wondering why.
    environmentOverrides: before.source === 'environment'
      ? 'CREDENTIAL_SIGNING_KEY is set on this deployment and takes precedence over anything '
        + 'stored, so this new key will not sign anything until that variable is removed.'
      : null,
  }, {
    // Never cached, never stored by an intermediary.
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}
