// ---------------------------------------------------------------------------
// THE UNIVERSITY'S PUBLIC SIGNING KEY.
//
// GET /api/credential/key
//
// ---------------------------------------------------------------------------
// WHY THIS IS PUBLIC, AND WHY THAT IS THE POINT
// ---------------------------------------------------------------------------
//
// A signature nobody can check is decoration. The whole value of signing a
// credential with an asymmetric key rather than an HMAC is that a receiving
// university, a credential evaluator or an immigration officer can verify it
// WITHOUT the University's cooperation — offline, in thirty years, with any
// Ed25519 implementation.
//
// That only works if the public key is published somewhere they can find it and
// quote. This is that place, and the response is deliberately boring: the key,
// its id, the algorithm, and the exact command to run.
//
// PUBLISHING A PUBLIC KEY DISCLOSES NOTHING. It is derived from the private key
// and cannot be used to make a signature, only to check one. The private key is
// in CREDENTIAL_SIGNING_KEY, server-side, and never leaves it.
//
// ---------------------------------------------------------------------------
// AND WHAT IT SAYS WHEN THERE IS NO KEY
// ---------------------------------------------------------------------------
//
// The truth: that this deployment does not sign, that credentials are still
// sealed and verifiable through /verify, and how to turn signing on. A 404
// would leave an enquirer unable to tell "this University does not sign" from
// "I have the wrong URL".
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { signingIdentity } from '@/lib/documentSignature';
import { UNIVERSITY } from '@/lib/constants';

export const runtime = 'nodejs';

export async function GET() {
  const id = signingIdentity();

  if (!id) {
    return NextResponse.json({
      configured: false,
      institution: UNIVERSITY.name,
      note:
        'This deployment does not hold a signing key, so credentials carry the University’s seal '
        + 'but no detached signature. They remain verifiable at /verify, which is the '
        + 'University’s primary record. To enable signing, set CREDENTIAL_SIGNING_KEY.',
    }, { headers: { 'cache-control': 'public, max-age=300' } });
  }

  return NextResponse.json({
    configured: true,
    institution: UNIVERSITY.name,
    algorithm: 'Ed25519',
    keyId: id.keyId,
    publicKey: id.publicKeyPem,
    signedValue:
      'The SHA-256 content hash of the credential, as a lowercase hex string, signed as UTF-8 '
      + 'bytes. The hash is returned by /api/credential?id=<credential number>.',
    howToVerify: [
      'Save the publicKey below as key.pem.',
      'Save the signature (base64url, from the verification response) decoded to sig.bin.',
      'Save the content hash as hash.txt with no trailing newline.',
      'openssl pkeyutl -verify -pubin -inkey key.pem -rawin -in hash.txt -sigfile sig.bin',
    ],
    // SAID HERE TOO, not only in the code. An enquirer who assumes this is a
    // PAdES signature will look for a green tick in Adobe and conclude the
    // document is unsigned when it is not.
    limitations:
      'This is a detached Ed25519 signature, not an X.509 or PAdES signature embedded in a PDF. '
      + 'It does not chain to a public certificate authority: it proves the document was signed '
      + 'by the holder of this key, and it is the University publishing the key here that ties '
      + 'the key to the University.',
  }, { headers: { 'cache-control': 'public, max-age=300' } });
}
