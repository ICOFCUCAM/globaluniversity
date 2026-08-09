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
import { generateSigningKey, signingIdentity } from '@/lib/documentSignature';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const g = await guard(request, 'design-credentials');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });

  const existing = signingIdentity();
  const { privateKeyPem, publicKeyPem, keyId } = generateSigningKey();

  return NextResponse.json({
    ok: true,
    keyId,
    privateKeyPem,
    publicKeyPem,
    variable: 'CREDENTIAL_SIGNING_KEY',
    // THE WARNING TRAVELS WITH THE KEY, so it cannot be shown without it.
    warning:
      'This is shown once and is not stored anywhere. Copy the whole private key, including the '
      + 'BEGIN and END lines, into your host as CREDENTIAL_SIGNING_KEY, then redeploy. If you lose '
      + 'it before doing that, generate another — nothing has been signed with this one.',
    // ROTATION IS NOT FREE, and an operator who already has a key must be told
    // before they replace it. Old signatures stay valid — the key id is stored
    // beside each one — but only if the retired public key is kept and
    // published, and nothing in this system does that automatically yet.
    alreadyConfigured: Boolean(existing),
    rotationWarning: existing
      ? `This deployment already signs with key ${existing.keyId}. Replacing it does NOT break `
        + 'the credentials already signed — each one records the key that signed it — but this '
        + 'system does not yet publish retired public keys, so anyone checking an older signature '
        + 'would have nothing to check it against. Keep the old public key somewhere you can '
        + 'publish it before you replace it.'
      : null,
  }, {
    // Never cached, never stored by an intermediary.
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}
