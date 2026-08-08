// ---------------------------------------------------------------------------
// A SIGNATURE ANYONE CAN CHECK — without the University's cooperation.
//
// ---------------------------------------------------------------------------
// WHY THE SEAL WAS NOT ENOUGH
// ---------------------------------------------------------------------------
//
// `documentSecurity.ts` seals every credential with an HMAC over its content
// hash. An HMAC is a SHARED-SECRET construction: the same key both makes and
// checks it. Only the University holds `CREDENTIAL_SECRET`, so only the
// University can perform the check — which is exactly why verification runs
// through /verify.
//
// For most readers that is enough. For the ones who matter most it is not. A
// receiving university, a credential evaluator or an immigration officer
// archiving a document for thirty years is being asked to trust that the
// website they visited was the University's. They cannot check the document on
// their own, ever, and they cannot check it at all once the site is gone.
//
// So the same content hash is ALSO signed with an Ed25519 private key, and the
// PUBLIC key is published. Anyone can verify that signature offline, forever,
// with any Ed25519 implementation and no cooperation from this University.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS NOT, SAID PLAINLY
// ---------------------------------------------------------------------------
//
// It is NOT a PAdES or X.509 signature embedded in a PDF. Adobe Reader will not
// show a green tick, because that requires a certificate issued by a public
// authority the University would have to buy from and be audited by, chaining
// to a trust list Adobe maintains. This chains to nothing: it proves a document
// was signed by whoever holds this key, and the University publishing that key
// is what ties the key to the University.
//
// That is a real and useful guarantee and it is a WEAKER one, and the interface
// says which. A registry that describes this as "digitally signed" without the
// distinction gets its documents rejected the first time somebody checks
// properly — and deserves to.
//
// ---------------------------------------------------------------------------
// KEY HANDLING
// ---------------------------------------------------------------------------
//
// The private key is a PKCS#8 PEM in `CREDENTIAL_SIGNING_KEY`, server-side
// only, never in a NEXT_PUBLIC_ variable and never committed. When it is
// absent, signing returns null and NOTHING BREAKS: the credential is issued,
// sealed and verifiable through /verify exactly as before, and simply carries
// no independent signature. Refusing to issue would make an optional
// improvement into an outage.
//
// `keyId` is the first 16 hex characters of the SHA-256 of the public key, and
// it is stored beside every signature. A key is rotated eventually, and a
// signature with no record of which key made it is unverifiable from the moment
// that happens.
// ---------------------------------------------------------------------------

import {
  createPrivateKey, createPublicKey, sign as nodeSign, verify as nodeVerify,
  createHash, generateKeyPairSync, type KeyObject,
} from 'node:crypto';

export interface SigningIdentity {
  keyId: string;
  /** SPKI PEM, safe to publish and intended to be. */
  publicKeyPem: string;
}

export interface Signed {
  /** base64url over the content hash. Null when no key is configured. */
  signature: string | null;
  keyId: string | null;
  /** Why it is null, for the caller to log rather than guess at. */
  reason?: string;
}

let cached: { key: KeyObject; identity: SigningIdentity } | null | undefined;

/**
 * The University's signing key, or null when none is configured.
 *
 * Cached after the first read. A malformed key is treated as absent rather than
 * thrown: an operator who pastes a truncated PEM should get unsigned
 * credentials and a message, not a registry that cannot issue.
 */
function loadKey(): { key: KeyObject; identity: SigningIdentity } | null {
  if (cached !== undefined) return cached;

  const pem = process.env.CREDENTIAL_SIGNING_KEY;
  if (!pem || pem.trim().length < 40) { cached = null; return cached; }

  try {
    // Newlines survive a .env round trip as the two characters \n far more
    // often than as real newlines, and a PEM without line breaks is invalid.
    const key = createPrivateKey(pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem);
    if (key.asymmetricKeyType !== 'ed25519') { cached = null; return cached; }

    const publicKeyPem = createPublicKey(key).export({ type: 'spki', format: 'pem' }).toString();
    cached = { key, identity: { keyId: keyIdFor(publicKeyPem), publicKeyPem } };
    return cached;
  } catch {
    cached = null;
    return cached;
  }
}

/** Stable, short, and derived from the public key rather than assigned. */
export function keyIdFor(publicKeyPem: string): string {
  return createHash('sha256')
    .update(publicKeyPem.replace(/\s+/g, ''))
    .digest('hex')
    .slice(0, 16);
}

/** True when the University can sign. Used to explain, never to refuse. */
export function signingConfigured(): boolean {
  return loadKey() !== null;
}

/** The public key and its id, for publication. Null when none is configured. */
export function signingIdentity(): SigningIdentity | null {
  return loadKey()?.identity ?? null;
}

/**
 * Sign a content hash.
 *
 * THE HASH, NOT THE DOCUMENT. The hash already covers every field the seal
 * covers, in a canonical order, so signing it signs the same statement the seal
 * makes — and a signature over rendered HTML would break the first time a
 * margin changed.
 */
export function signContentHash(contentHash: string): Signed {
  const loaded = loadKey();
  if (!loaded) {
    return {
      signature: null,
      keyId: null,
      reason: 'CREDENTIAL_SIGNING_KEY is not set, so this credential carries its seal but no '
        + 'independently checkable signature. It verifies normally through /verify.',
    };
  }

  const sig = nodeSign(null, Buffer.from(contentHash, 'utf8'), loaded.key);
  return { signature: sig.toString('base64url'), keyId: loaded.identity.keyId };
}

/**
 * Check a signature against a hash and a public key.
 *
 * TAKES THE PUBLIC KEY AS AN ARGUMENT so it can check a signature made by a
 * key that has since been rotated — the whole reason `keyId` is stored. It also
 * means this function is the one an outside party would write, and the
 * University is running the same code it asks others to.
 */
export function verifySignature(
  contentHash: string,
  signature: string,
  publicKeyPem: string,
): boolean {
  try {
    return nodeVerify(
      null,
      Buffer.from(contentHash, 'utf8'),
      createPublicKey(publicKeyPem),
      Buffer.from(signature, 'base64url'),
    );
  } catch {
    // A malformed signature is a failed verification, not an exception for the
    // caller to handle — every caller would handle it the same way.
    return false;
  }
}

/** Verify against the key this deployment holds. */
export function verifyWithOwnKey(contentHash: string, signature: string): boolean {
  const id = signingIdentity();
  return id ? verifySignature(contentHash, signature, id.publicKeyPem) : false;
}

/**
 * Generate a key pair, for the University to run once and keep.
 *
 * NOT CALLED BY THE APPLICATION. It exists so the instruction in DEPLOYMENT.md
 * is a command rather than a paragraph about openssl, and so the key the
 * University generates is exactly the shape this code expects.
 */
export function generateSigningKey(): { privateKeyPem: string; publicKeyPem: string; keyId: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  return { privateKeyPem, publicKeyPem, keyId: keyIdFor(publicKeyPem) };
}

/** Forget the cached key. Tests only. */
export function resetSigningCache(): void {
  cached = undefined;
}
