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
//
// ---------------------------------------------------------------------------
// WHERE THE KEY LIVES, AND WHY RETIRED KEYS ARE KEPT
// ---------------------------------------------------------------------------
//
// Either in CREDENTIAL_SIGNING_KEY, or in the University's own sealed store —
// the same AES-256-GCM store that holds the social tokens, with row-level
// security and no policy at all, so it is unreadable through the publishable
// key by construction. The environment variable wins where both exist, because
// an operator who has just set one expects it to take effect.
//
// THE STORE HOLDS A KEYRING, NOT A KEY. Every key the University has ever used,
// with the active one named — because rotation without that is a promise
// quietly broken.
//
// The first version of this warned an operator that rotating would leave older
// signatures uncheckable, since only the current public key was published. That
// warning was the wrong fix. A signature that cannot be checked is not a
// signature, and telling somebody to keep the old public key "somewhere" makes
// the University's guarantee depend on a person remembering a file. Every
// public key the University has held is published, each with its id, and a
// verifier picks the one the signature names.
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
 * Every key the University has held, and which one signs today.
 *
 * `keys` is keyed by key id, so a signature naming a retired key can still be
 * checked and the retired PUBLIC key can still be published.
 */
export interface Keyring {
  active: string;
  keys: Record<string, string>;
}

/** The reference the keyring is stored under. Not a secret; a row name. */
export const KEYRING_REF = 'credential-signing-keyring';

/** The shape of the database client, written out so this file imports none. */
export interface SecretDb {
  from(table: string): {
    upsert(values: Record<string, unknown>, options?: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      };
    };
  };
}

let ringCache: Keyring | null | undefined;

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

/* ------------------------------------------------------------------ */
/* THE KEYRING THE SYSTEM KEEPS FOR ITSELF                             */
/* ------------------------------------------------------------------ */

/**
 * Read the keyring out of the University's sealed store.
 *
 * RETURNS NULL RATHER THAN THROWING for every failure — no store, no sealing
 * key, an unreadable row, a corrupt seal. Signing is optional by design, and a
 * registry that cannot issue a certificate because a keyring could not be
 * decrypted would be a far worse fault than one that issues it unsigned.
 */
export async function loadKeyring(db: SecretDb): Promise<Keyring | null> {
  if (ringCache !== undefined) return ringCache;
  try {
    const { secretStoreReady, unseal } = await import('@/lib/secretStore');
    if (!secretStoreReady()) { ringCache = null; return null; }

    const { data, error } = await db.from('secret_store')
      .select('sealed').eq('ref', KEYRING_REF).maybeSingle();
    if (error || !data?.sealed) { ringCache = null; return null; }

    const ring = JSON.parse(unseal(String(data.sealed))) as Keyring;
    if (!ring?.active || !ring.keys?.[ring.active]) { ringCache = null; return null; }
    ringCache = ring;
    return ring;
  } catch {
    ringCache = null;
    return null;
  }
}

/**
 * Put a newly generated key into the store, keeping every earlier one.
 *
 * THE OLD KEYS ARE NOT DISCARDED. Their public halves are published so a
 * signature made years ago still checks; discarding them would silently void
 * the University's guarantee on every document signed before the rotation.
 */
export async function storeSigningKey(
  db: SecretDb, privateKeyPem: string,
): Promise<{ keyId: string; retired: string[] }> {
  const { secretStoreReady, seal, SECRET_STORE_MISSING } = await import('@/lib/secretStore');
  if (!secretStoreReady()) throw new Error(SECRET_STORE_MISSING);

  const key = createPrivateKey(privateKeyPem);
  if (key.asymmetricKeyType !== 'ed25519') {
    throw new Error('The University publishes Ed25519; this key is not one.');
  }
  const publicKeyPem = createPublicKey(key).export({ type: 'spki', format: 'pem' }).toString();
  const keyId = keyIdFor(publicKeyPem);

  const existing = await loadKeyring(db);
  const ring: Keyring = {
    active: keyId,
    keys: { ...(existing?.keys ?? {}), [keyId]: privateKeyPem },
  };

  const { error } = await db.from('secret_store').upsert({
    ref: KEYRING_REF,
    kind: 'signing_key',
    sealed: seal(JSON.stringify(ring)),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'ref' });
  if (error) throw new Error(`The signing key could not be stored: ${error.message}`);

  ringCache = ring;
  return { keyId, retired: Object.keys(ring.keys).filter((k) => k !== keyId) };
}

/** A private PEM as its public half and id. Null when it will not parse. */
function identityOf(privateKeyPem: string): SigningIdentity | null {
  try {
    const pem = privateKeyPem.includes('\\n')
      ? privateKeyPem.replace(/\\n/g, '\n') : privateKeyPem;
    const publicKeyPem = createPublicKey(createPrivateKey(pem))
      .export({ type: 'spki', format: 'pem' }).toString();
    return { keyId: keyIdFor(publicKeyPem), publicKeyPem };
  } catch {
    return null;
  }
}

export interface Published {
  /** The key signing today, or null when the University signs nothing. */
  active: SigningIdentity | null;
  /**
   * Every key it has held and no longer uses.
   *
   * PUBLISHED, NOT MERELY KEPT. A signature naming a retired key is checkable
   * only if its public half is somewhere a stranger can find it.
   */
  retired: SigningIdentity[];
  /** 'environment' | 'store' | null — where the active key came from. */
  source: 'environment' | 'store' | null;
}

/**
 * Everything the University can publish about its signing keys.
 *
 * THE ENVIRONMENT WINS where both exist: an operator who has just set
 * CREDENTIAL_SIGNING_KEY expects it to take effect, and a stored key silently
 * overriding it would be the kind of surprise that costs an afternoon. The
 * stored keys are still published as retired, because documents were signed
 * with them.
 */
export async function publishedKeys(db?: SecretDb): Promise<Published> {
  const fromEnv = signingIdentity();
  const ring = db ? await loadKeyring(db) : null;

  const stored = ring
    ? Object.entries(ring.keys)
      .map(([, pem]) => identityOf(pem))
      .filter((x): x is SigningIdentity => x !== null)
    : [];

  const active = fromEnv ?? stored.find((k) => k.keyId === ring?.active) ?? null;
  return {
    active,
    retired: stored.filter((k) => k.keyId !== active?.keyId),
    source: fromEnv ? 'environment' : active ? 'store' : null,
  };
}

/**
 * Sign, using the environment key if there is one and the stored key otherwise.
 *
 * The synchronous `signContentHash` is unchanged and still the environment-only
 * path; this is what the issue routes call, because they have a database client
 * and the University may be keeping its key there.
 */
export async function signContentHashWith(
  db: SecretDb | undefined, contentHash: string,
): Promise<Signed> {
  const fromEnv = loadKey();
  if (fromEnv) {
    return {
      signature: nodeSign(null, Buffer.from(contentHash, 'utf8'), fromEnv.key).toString('base64url'),
      keyId: fromEnv.identity.keyId,
    };
  }

  const ring = db ? await loadKeyring(db) : null;
  const pem = ring?.keys[ring.active];
  if (!ring || !pem) {
    return {
      signature: null,
      keyId: null,
      reason: 'No signing key is set and none is stored, so this credential carries its seal but '
        + 'no independently checkable signature. It verifies normally through /verify.',
    };
  }

  try {
    const key = createPrivateKey(pem);
    return {
      signature: nodeSign(null, Buffer.from(contentHash, 'utf8'), key).toString('base64url'),
      keyId: ring.active,
    };
  } catch {
    // A STORED KEY THAT WILL NOT PARSE IS AN ABSENT ONE, never an exception —
    // the credential is issued unsigned rather than not issued at all.
    return {
      signature: null,
      keyId: null,
      reason: 'The stored signing key could not be read, so this credential was issued unsigned. '
        + 'It carries the University’s seal and verifies through /verify.',
    };
  }
}

/**
 * Check a signature against whichever key made it.
 *
 * THE POINT OF KEEPING RETIRED KEYS. A signature naming a key the University
 * has since replaced verifies here exactly as it did the day it was made.
 */
export async function verifyAgainstAnyKey(
  db: SecretDb | undefined, contentHash: string, signature: string, keyId?: string | null,
): Promise<{ valid: boolean; keyId: string | null; retired: boolean }> {
  const { active, retired } = await publishedKeys(db);
  const candidates = [active, ...retired].filter((k): k is SigningIdentity => k !== null);

  // Named key first; it is the only one that should match, and trying it alone
  // means a signature cannot be "verified" against a key it does not claim.
  const named = keyId ? candidates.find((k) => k.keyId === keyId) : null;
  for (const k of named ? [named] : candidates) {
    if (verifySignature(contentHash, signature, k.publicKeyPem)) {
      return { valid: true, keyId: k.keyId, retired: k.keyId !== active?.keyId };
    }
  }
  return { valid: false, keyId: keyId ?? null, retired: false };
}

/** Forget the cached keyring. Tests, and immediately after a rotation. */
export function resetKeyringCache(): void {
  ringCache = undefined;
}
