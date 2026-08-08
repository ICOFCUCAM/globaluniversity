// ---------------------------------------------------------------------------
// THE SIGNATURE — does it actually sign, and does it actually catch a change?
//
// Run with:  node src/lib/documentSignature.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS IS TESTED BY SIGNING AND TAMPERING, NOT BY CHECKING A FUNCTION EXISTS
// ---------------------------------------------------------------------------
//
// A signature routine that returns a plausible base64 string for every input
// and verifies everything as valid looks exactly like one that works — in the
// interface, in the register, and to the registrar. It looks wrong only to
// somebody who alters a document and finds the signature still passes, and by
// then it is on thirty thousand transcripts.
//
// So every case below signs a real hash with a real key and then asks the
// verifier a question it must get right: a changed hash, a changed signature, a
// different key, a malformed input. Verification that returns true for a
// tampered document is the only failure that matters here, and it is the one
// these cases hunt for.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
  } else {
    console.log(`ok    ${label}`);
  }
}

const dir = join(new URL('../../node_modules/.cache/icof', import.meta.url).pathname);
mkdirSync(dir, { recursive: true });
const outfile = join(dir, 'documentSignature.mjs');
execFileSync('npx', [
  'esbuild', new URL('./documentSignature.ts', import.meta.url).pathname,
  '--bundle', '--format=esm', '--platform=node', `--outfile=${outfile}`, '--log-level=error',
  `--alias:@=${new URL('..', import.meta.url).pathname.replace(/\/$/, '')}`,
]);

const {
  generateSigningKey, signContentHash, verifySignature, keyIdFor,
  signingConfigured, signingIdentity, resetSigningCache,
} = await import(outfile);

const HASH = 'a3f1c0de4b7e2910aa55cc7788ee99001122334455667788990011223344aabb';

const { generateKeyPairSync } = await import('node:crypto');
const rsaKeyPem = generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

console.log('\nWith no key configured\n');

delete process.env.CREDENTIAL_SIGNING_KEY;
resetSigningCache();

check('signing is reported as unconfigured', signingConfigured(), false);
check('there is no identity to publish', signingIdentity(), null);
{
  const s = signContentHash(HASH);
  // NOTHING BREAKS. A credential is still issued and still sealed; it simply
  // carries no detached signature, and the reason says so.
  check('nothing is signed', s.signature, null);
  check('and no key is claimed', s.keyId, null);
  check('and the caller is told why rather than left guessing',
    s.reason.includes('CREDENTIAL_SIGNING_KEY'), true);
}

console.log('\nWith a key\n');

const { privateKeyPem, publicKeyPem, keyId } = generateSigningKey();
process.env.CREDENTIAL_SIGNING_KEY = privateKeyPem;
resetSigningCache();

check('signing is now configured', signingConfigured(), true);
check('the published identity carries the same key id', signingIdentity().keyId, keyId);
check('the key id is derived from the public key, not assigned',
  keyIdFor(publicKeyPem), keyId);
check('…and is stable across whitespace differences in the PEM',
  keyIdFor(publicKeyPem.replace(/\n/g, '\r\n')), keyId);

const signed = signContentHash(HASH);
check('a signature is produced', typeof signed.signature, 'string');
check('and it names the key that made it', signed.keyId, keyId);

console.log('\nAnd does it catch tampering?\n');

check('the genuine hash and signature verify',
  verifySignature(HASH, signed.signature, publicKeyPem), true);

// THE CASE THIS FILE EXISTS FOR. One hex character changed anywhere in the
// content hash — which is what altering any sealed field on the document does.
const tampered = `${HASH.slice(0, -1)}c`;
check('a hash changed by ONE character does not verify',
  verifySignature(tampered, signed.signature, publicKeyPem), false);

// A signature lifted from a genuine document onto a forged one.
const other = signContentHash(`${HASH.slice(0, -2)}ff`);
check('a signature over a different document does not verify against this one',
  verifySignature(HASH, other.signature, publicKeyPem), false);

// A forger with their own key, publishing their own "university".
const impostor = generateSigningKey();
check('a signature made with another key does not verify against the University’s',
  verifySignature(HASH, signed.signature, impostor.publicKeyPem), false);

// Garbage in must be a failed verification, never an exception: every caller
// would handle a throw by reporting "invalid", so this reports it directly.
check('a malformed signature is a failed check, not a crash',
  verifySignature(HASH, 'not-a-signature', publicKeyPem), false);
check('an empty signature is a failed check',
  verifySignature(HASH, '', publicKeyPem), false);
check('a malformed public key is a failed check',
  verifySignature(HASH, signed.signature, 'not-a-key'), false);

console.log('\nAn escaped PEM, as it arrives from an environment variable\n');

// THE FAILURE MODE THAT ACTUALLY HAPPENS. A PEM pasted into a .env file or a
// hosting dashboard usually arrives with literal backslash-n rather than real
// newlines, and a PEM without line breaks does not parse — so signing would be
// silently off on a deployment where the operator had set the key.
process.env.CREDENTIAL_SIGNING_KEY = privateKeyPem.replace(/\n/g, '\\n');
resetSigningCache();
check('an escaped PEM is still loaded', signingConfigured(), true);
check('and yields the same key id', signingIdentity().keyId, keyId);
check('and produces a signature that verifies',
  verifySignature(HASH, signContentHash(HASH).signature, publicKeyPem), true);

console.log('\nA key that is wrong rather than absent\n');

// A CORRUPT OR WRONG-ALGORITHM KEY IS TREATED AS ABSENT, not thrown. An
// operator who pastes a mangled PEM should get unsigned credentials and a
// message, not a registry that cannot issue anything at all.
//
// The first attempt at this case sliced the PEM to 120 characters and asserted
// it would be rejected — and it was NOT, because an Ed25519 PKCS#8 PEM is only
// about 119 characters long, so the slice kept the whole key. The test was
// wrong, not the code. It now corrupts the base64 body, which is what a
// half-pasted key actually looks like.
const corrupted = privateKeyPem.replace(
  /(-----BEGIN PRIVATE KEY-----\n)(.{10})/,
  (_, head) => `${head}!!!!!!!!!!`,
);
process.env.CREDENTIAL_SIGNING_KEY = corrupted;
resetSigningCache();
check('a corrupted key does not enable signing', signingConfigured(), false);
check('and issuing still works, unsigned', signContentHash(HASH).signature, null);

// A REAL KEY OF THE WRONG ALGORITHM IS ALSO REFUSED. Ed25519 is what the
// published verification instructions tell the world to use; an RSA key here
// would sign perfectly well and verify against nothing anybody was told about.
process.env.CREDENTIAL_SIGNING_KEY = rsaKeyPem;
resetSigningCache();
check('an RSA key is refused, because the University publishes Ed25519',
  signingConfigured(), false);

process.env.CREDENTIAL_SIGNING_KEY = 'short';
resetSigningCache();
check('an obviously wrong value does not enable signing', signingConfigured(), false);

process.exit(failures === 0 ? 0 : 1);
