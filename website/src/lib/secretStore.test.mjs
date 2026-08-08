// ---------------------------------------------------------------------------
// The secret store and the OAuth state — can a token be read, and can a
// connection be forged?
//
// Run with:  node src/lib/secretStore.test.mjs
//
// WHY THIS FILE EXISTS. Both failures here are silent and both are serious.
//
// A sealing bug produces ciphertext that decrypts to rubbish, which is then
// sent to Facebook as an access token — a failure nobody diagnoses quickly
// because everything upstream looks correct.
//
// An unverified OAuth state lets an attacker send an administrator a link that
// connects the ATTACKER's account, after which the University publishes to it
// believing it is its own. Nothing about that looks wrong from the inside.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) { failures++; console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`); }
  else console.log(`ok    ${label}`);
}

process.env.SECRET_STORE_KEY = 'a-test-key-long-enough-to-be-accepted-1234567890';

const root = new URL('../..', import.meta.url).pathname;
const out = join(root, '.test-build', 'secrets');
mkdirSync(out, { recursive: true });

const build = (file, name) => {
  const bundle = join(out, `${name}.mjs`);
  execFileSync('npx', [
    'esbuild', new URL(file, import.meta.url).pathname,
    '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`, '--log-level=error',
    `--alias:@=${new URL('..', import.meta.url).pathname.replace(/\/$/, '')}`,
    '--external:node:crypto',
  ]);
  return import(bundle);
};

const S = await build('./secretStore.ts', 'store');
const O = await build('./socialOAuth.ts', 'oauth');

console.log('\nA sealed token comes back exactly, and only exactly\n');

const token = 'EAAG...a-realistic-looking-refresh-token...ZDZD';
const sealed = S.seal(token);

check('it round-trips', S.unseal(sealed), token);
check('the ciphertext does not contain the token', sealed.includes(token), false);
check('it has the three parts the database CHECK requires', sealed.split('.').length, 3);
check('…each base64url', /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(sealed), true);
check('…and long enough to pass the same CHECK', sealed.length > 40, true);

// A FRESH IV EVERY TIME. Without one, two identical tokens produce identical
// ciphertext and the table leaks which accounts share a token.
check('sealing the same value twice gives different ciphertext', S.seal(token) === S.seal(token), false);
check('…and both still decrypt', [S.unseal(S.seal(token)), S.unseal(S.seal(token))], [token, token]);

console.log('\nTampering is an error, not plausible rubbish\n');

const [iv, tag, body] = sealed.split('.');
const flip = (s) => {
  const b = Buffer.from(s, 'base64url'); b[0] ^= 0xff; return b.toString('base64url');
};

let threw = false;
try { S.unseal(`${iv}.${tag}.${flip(body)}`); } catch { threw = true; }
check('a modified payload throws rather than returning rubbish', threw, true);

threw = false;
try { S.unseal(`${flip(iv)}.${tag}.${body}`); } catch { threw = true; }
check('a modified iv throws', threw, true);

threw = false;
try { S.unseal(`${iv}.${flip(tag)}.${body}`); } catch { threw = true; }
check('a modified auth tag throws', threw, true);

threw = false;
try { S.unseal('not-a-sealed-value'); } catch { threw = true; }
check('nonsense throws', threw, true);

console.log('\nA short key is refused, because weak is worse than absent\n');

const original = process.env.SECRET_STORE_KEY;
process.env.SECRET_STORE_KEY = 'short';
check('a five-character key is not accepted', S.secretStoreReady(), false);
threw = false;
try { S.seal('x'); } catch { threw = true; }
check('…and sealing refuses rather than using it', threw, true);
process.env.SECRET_STORE_KEY = '';
check('an empty key is not accepted', S.secretStoreReady(), false);
process.env.SECRET_STORE_KEY = original;
check('a long key is', S.secretStoreReady(), true);

console.log('\nAn OAuth state cannot be forged or reused\n');

const state = { platform: 'linkedin', scope: 'personal', actorId: 'alice', issuedAt: Date.now() };
const signed = O.signState(state);

check('a signed state reads back', O.readState(signed).state.actorId, 'alice');
check('…with its scope intact', O.readState(signed).state.scope, 'personal');

// THE ATTACK. An attacker who can edit the state can turn their own personal
// connection into the University's, or point it at somebody else's account.
const [payload] = signed.split('.');
const forgedBody = Buffer.from(JSON.stringify({ ...state, scope: 'university', actorId: 'attacker' }), 'utf8').toString('base64url');
check(
  'a state with an edited body is refused',
  O.readState(`${forgedBody}.${signed.split('.')[1]}`).state,
  null,
);
check(
  '…and the refusal says the attempt did not begin here',
  /did not begin here/.test(O.readState(`${forgedBody}.${signed.split('.')[1]}`).reason),
  true,
);
check('a state with no signature is refused', O.readState(payload).state, null);
check('an empty state is refused', O.readState('').state, null);

const stale = O.signState({ ...state, issuedAt: Date.now() - 20 * 60 * 1000 });
check('a state older than ten minutes is refused', O.readState(stale).state, null);
check('…and says so rather than blaming the signature', /expired/.test(O.readState(stale).reason), true);

console.log('\nAn unconfigured platform yields no authorize URL\n');

check('no Meta app, no Facebook flow', O.appFor('facebook', {}), null);
check('no X app, no X flow', O.appFor('x', {}), null);

const meta = O.appFor('facebook', { META_APP_ID: 'id', META_APP_SECRET: 'sec', META_REDIRECT_URI: 'https://iguc.net/cb' });
check('with an app, there is one', Boolean(meta), true);
check('…asking for the publishing scope', meta.scopes.includes('pages_manage_posts'), true);

const url = new URL(O.authorizeUrl(meta, signed));
check('the authorize URL carries the state', url.searchParams.get('state'), signed);
check('…and the redirect', url.searchParams.get('redirect_uri'), 'https://iguc.net/cb');
check('…and never the client secret', url.toString().includes('sec'), false);

// Google returns a refresh token only on first consent without these.
const google = O.appFor('youtube', { GOOGLE_CLIENT_ID: 'i', GOOGLE_CLIENT_SECRET: 's', GOOGLE_REDIRECT_URI: 'r' });
check('YouTube asks for offline access', google.extra.access_type, 'offline');
check('…and forces the consent screen, or there is no refresh token', google.extra.prompt, 'consent');

const x = O.appFor('x', { X_CLIENT_ID: 'i', X_CLIENT_SECRET: 's', X_REDIRECT_URI: 'r' });
check('X asks for offline.access, or the connection dies in two hours', x.scopes.includes('offline.access'), true);

console.log(failures === 0
  ? '\nTokens are unreadable and untamperable, and a connection cannot be forged.'
  : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
