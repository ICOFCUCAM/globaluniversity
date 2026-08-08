// ---------------------------------------------------------------------------
// WHERE THE UNIVERSITY'S TOKENS ACTUALLY LIVE.
//
// ---------------------------------------------------------------------------
// THE PROMISE THIS FILE HAS TO KEEP
// ---------------------------------------------------------------------------
//
// Migration 013 named the column `token_ref` rather than `token`, and every
// file that touches it says the same thing: an OAuth refresh token is a
// standing permission to speak as the University, and putting one in an
// application table makes every future SELECT bug, every over-broad policy and
// every database export a credential leak.
//
// That promise was easy to keep while nothing could connect. Now that the OAuth
// flow exists, the tokens are real and they have to go somewhere.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS, AND WHAT IT IS NOT
// ---------------------------------------------------------------------------
//
// IT IS: AES-256-GCM ciphertext in a table with row-level security enabled and
// NO POLICY AT ALL — so it is unreadable through the publishable key by
// construction, not by a rule somebody could widen. The key lives in the
// environment, never in the database, so a database dump is ciphertext and a
// leaked dump is not a leaked token.
//
// IT IS NOT a hardware security module, and it is not Vault. If an attacker
// gets both the database AND the deployment's environment, they have the
// tokens. That is a real limitation and it is written here rather than implied
// away, because the University should know what it has bought: this defends
// against the failure that actually happens — a database export, a backup on a
// laptop, an over-broad policy, a SELECT in a debug endpoint — and not against
// a total compromise of the running server.
//
// ---------------------------------------------------------------------------
// GCM, NOT CBC, AND THE REASON MATTERS
// ---------------------------------------------------------------------------
//
// GCM authenticates as well as encrypts. Without that, an attacker who could
// write to the table could flip bits in the ciphertext and the decryption would
// return plausible rubbish rather than failing — and "plausible rubbish sent to
// Facebook as an access token" is a failure nobody would diagnose quickly. The
// auth tag makes tampering an error.
// ---------------------------------------------------------------------------

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * The key, derived from the environment.
 *
 * HASHED TO 32 BYTES rather than requiring the University to produce exactly
 * 32 bytes of base64. A passphrase that has to be a precise length is a
 * passphrase somebody pads with spaces.
 *
 * SEPARATE FROM CREDENTIAL_SECRET on purpose. That key seals certificates and
 * must never be rotated casually — rotating it would invalidate every
 * credential's verification. This key can be rotated whenever the University
 * likes, at the cost of every social connection needing to be re-authorised,
 * which is an afternoon's work rather than a catastrophe. Sharing one key
 * between the two would tie those two very different decisions together.
 */
function key(): Buffer | null {
  const raw = process.env.SECRET_STORE_KEY?.trim();
  // Short enough to be guessable is worse than absent, because absent is
  // visible and weak is not.
  if (!raw || raw.length < 24) return null;
  return createHash('sha256').update(raw).digest();
}

export function secretStoreReady(): boolean {
  return key() !== null;
}

export const SECRET_STORE_MISSING =
  'SECRET_STORE_KEY is not set, or is shorter than 24 characters. Access tokens cannot be '
  + 'stored safely without it, and this system will not store them any other way. Generate one '
  + 'with `openssl rand -base64 48` and set it in the deployment environment.';

/** Ciphertext, as it is written to the row. iv:tag:payload, all base64url. */
export function seal(plaintext: string): string {
  const k = key();
  if (!k) throw new Error(SECRET_STORE_MISSING);

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, k, iv);
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, body].map((b) => b.toString('base64url')).join('.');
}

/**
 * Back to plaintext.
 *
 * THROWS ON TAMPERING, and the caller must let it. A catch that returned null
 * here would turn a modified token into "no token", which reads as an ordinary
 * disconnected account — and the one thing the University should be told loudly
 * is that somebody has been writing to this table.
 */
export function unseal(sealed: string): string {
  const k = key();
  if (!k) throw new Error(SECRET_STORE_MISSING);

  const [iv, tag, body] = sealed.split('.').map((p) => Buffer.from(p, 'base64url'));
  if (!iv || !tag || !body) throw new Error('The stored secret is not in the expected form.');

  const decipher = createDecipheriv(ALGORITHM, k, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

// ---------------------------------------------------------------------------
// THE STORE ITSELF
// ---------------------------------------------------------------------------

export interface StoredTokens {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  scopes?: string[];
  /** Anything the provider returns that is needed to publish — page ids, etc. */
  meta?: Record<string, unknown>;
}

/**
 * Minimal shape of the Supabase client, so this file does not import one.
 *
 * WRITTEN AS A PARAMETER rather than importing the admin client, because that
 * import would let this module be pulled into a browser bundle by accident —
 * and a browser bundle containing the sealing key's shape is a bundle somebody
 * will eventually put the key into.
 */
interface Db {
  from(table: string): {
    upsert(values: Record<string, unknown>, options?: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      };
    };
    delete(): { eq(column: string, value: string): PromiseLike<{ error: { message: string } | null }> };
  };
}

/**
 * Put tokens away, and return the REFERENCE that goes in social_accounts.
 *
 * The reference is the account's own id. It is not a secret and does not need
 * to be — knowing which row holds a token is not knowing the token, and a
 * random reference would only add a lookup.
 */
export async function putTokens(db: Db, accountId: string, tokens: StoredTokens): Promise<string> {
  const { error } = await db.from('secret_store').upsert({
    ref: accountId,
    kind: 'social_tokens',
    sealed: seal(JSON.stringify(tokens)),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'ref' });

  if (error) throw new Error(`The token could not be stored: ${error.message}`);
  return accountId;
}

export async function getTokens(db: Db, ref: string): Promise<StoredTokens | null> {
  const { data, error } = await db.from('secret_store').select('sealed').eq('ref', ref).maybeSingle();
  if (error) throw new Error(`The token could not be read: ${error.message}`);
  if (!data?.sealed) return null;
  return JSON.parse(unseal(String(data.sealed))) as StoredTokens;
}

/**
 * Destroy a stored token.
 *
 * A DELETE, NOT A FLAG. This is the one place in this system where deletion is
 * right: the row's whole purpose is to hold a secret, and a revoked
 * connection's secret should stop existing. The AUDIT of the disconnection
 * lives in audit_logs and the connection's history lives in social_accounts —
 * neither needs the token to remain in order to be complete.
 */
export async function forgetTokens(db: Db, ref: string): Promise<void> {
  const { error } = await db.from('secret_store').delete().eq('ref', ref);
  if (error) throw new Error(`The token could not be removed: ${error.message}`);
}
