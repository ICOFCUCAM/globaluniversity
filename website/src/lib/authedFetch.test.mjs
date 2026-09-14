// ---------------------------------------------------------------------------
// AN EXPIRED TOKEN IS NOT AN ERROR TO SHOW SOMEBODY.
//
// Run with:  node src/lib/authedFetch.test.mjs
//
// ---------------------------------------------------------------------------
// WHAT THIS GUARDS
// ---------------------------------------------------------------------------
//
// The Vice-Chancellor opened Draft & submit — signed in, name in the sidebar —
// and the screen said:
//
//     invalid-token
//
// Not a database fault and not a permission. The ACCESS TOKEN HAD EXPIRED.
// `getSession()` returns whatever is in storage without checking whether it is
// still good, and supabase-js refreshes on a timer that does not run while a
// tab is in the background. A tab left open overnight — and this University
// works with twenty of them — wakes holding a token Supabase will not accept,
// and the first call from it is refused before the refresh timer fires.
//
// ---------------------------------------------------------------------------
// WHY THIS RUNS THE CODE INSTEAD OF READING IT
// ---------------------------------------------------------------------------
//
// A test that grepped for `refreshSession` would pass on a call that refreshed
// and then sent the old token anyway. What matters is the SEQUENCE — which
// token went out, whether a second attempt was made, and what the officer is
// handed when the session is genuinely gone — so the module is compiled with a
// stub session and a stub `fetch`, and the calls are counted.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;
const check = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`ok    ${label}`);
  } else {
    failures++;
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
  }
};

const here = new URL('.', import.meta.url).pathname;
const cache = join(here, '../../node_modules/.cache/icof/authed');
mkdirSync(cache, { recursive: true });

// ---------------------------------------------------------------------------
// THE STUB SESSION. It stands in for supabase-js and records what was asked of
// it, so "did it refresh?" is a fact rather than an inference.
// ---------------------------------------------------------------------------
writeFileSync(join(cache, 'supabase.mjs'), `
export const state = {
  session: null,
  refreshed: 0,
  refreshTo: null,
  refreshFails: false,
};
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: state.session } }),
    refreshSession: async () => {
      state.refreshed += 1;
      if (state.refreshFails) return { data: { session: null }, error: new Error('gone') };
      state.session = state.refreshTo;
      return { data: { session: state.refreshTo }, error: null };
    },
  },
};
`);

// The real module, with only its import of supabase redirected.
const src = readFileSync(join(here, 'authedFetch.ts'), 'utf8')
  .replace(/from '\.\/supabase'/, "from './supabase.mjs'");
writeFileSync(join(cache, 'authedFetch.ts'), src);

const out = join(cache, 'authedFetch.mjs');
execFileSync('npx', [
  'esbuild', join(cache, 'authedFetch.ts'), '--bundle', '--format=esm',
  '--platform=node', `--outfile=${out}`, '--log-level=error',
  // THE STUB STAYS OUTSIDE THE BUNDLE. Bundled, esbuild inlines a COPY of it,
  // and the `state` this file imports is then a different object from the one
  // the code under test mutates — every assertion reads zeros and the test
  // looks like a catastrophic failure of working code. External, both sides
  // hold the same module.
  '--external:./supabase.mjs',
]);

const { authedFetch } = await import(out);
const { state } = await import(join(cache, 'supabase.mjs'));

const now = () => Math.floor(Date.now() / 1000);

/** Record every token the code actually put on the wire, in order. */
let seen = [];
let replies = [];
globalThis.fetch = async (_url, init) => {
  seen.push(String(init.headers.authorization).replace('Bearer ', ''));
  const body = replies.shift() ?? { ok: true };
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => body,
  };
};

const reset = (session, answers) => {
  seen = [];
  replies = answers;
  state.session = session;
  state.refreshed = 0;
  state.refreshTo = null;
  state.refreshFails = false;
};

console.log('\nA screen never sends a token it knows is stale\n');

// --- A healthy session is used as it is ------------------------------------
{
  reset({ access_token: 'good', expires_at: now() + 3600 }, [{ ok: true, rows: 2 }]);
  const r = await authedFetch('/api/anything', { method: 'POST', body: '{}' });
  check('a token with an hour left is sent unchanged', seen, ['good']);
  check('…nothing is refreshed', state.refreshed, 0);
  check('…and the answer comes back', r.rows, 2);
}

// --- A token about to expire is refreshed BEFORE it is sent ----------------
{
  reset({ access_token: 'nearly', expires_at: now() + 10 }, [{ ok: true }]);
  state.refreshTo = { access_token: 'renewed', expires_at: now() + 3600 };
  await authedFetch('/api/anything', { method: 'POST', body: '{}' });
  check('a token with ten seconds left is refreshed first', state.refreshed, 1);
  check('…and it is the NEW token that goes out', seen, ['renewed']);
}

// --- An already-expired token, same ----------------------------------------
{
  reset({ access_token: 'stale', expires_at: now() - 5 }, [{ ok: true }]);
  state.refreshTo = { access_token: 'renewed', expires_at: now() + 3600 };
  await authedFetch('/api/anything', { method: 'POST', body: '{}' });
  check('an expired token is never sent', seen.includes('stale'), false);
  check('…the refreshed one is', seen, ['renewed']);
}

console.log('\nAnd when the server refuses it anyway, it tries once more\n');

// --- THE ACTUAL FAULT. The token looks fine; the server disagrees. ---------
//
// A clock a minute out, a session revoked elsewhere, or simply the gap between
// checking the expiry and the request arriving. This is the case that put
// `invalid-token` on the Vice-Chancellor's screen.
{
  reset(
    { access_token: 'looksfine', expires_at: now() + 3600 },
    [{ ok: false, error: 'invalid-token' }, { ok: true, rows: 7 }],
  );
  state.refreshTo = { access_token: 'renewed', expires_at: now() + 3600 };
  const r = await authedFetch('/api/anything', { method: 'POST', body: '{}' });
  check('the refusal forces a refresh', state.refreshed, 1);
  check('…and the call is made again with the new token', seen, ['looksfine', 'renewed']);
  check('…and the officer gets the answer, not the error', [r.ok, r.rows], [true, 7]);
}

// `no-token` is the same class of refusal and gets the same treatment.
{
  reset(
    { access_token: 'looksfine', expires_at: now() + 3600 },
    [{ ok: false, error: 'no-token' }, { ok: true, rows: 1 }],
  );
  state.refreshTo = { access_token: 'renewed', expires_at: now() + 3600 };
  const r = await authedFetch('/api/anything', { method: 'POST', body: '{}' });
  check('no-token is retried too', [seen.length, r.ok], [2, true]);
}

// --- ONCE, NOT FOREVER -----------------------------------------------------
{
  reset(
    { access_token: 'looksfine', expires_at: now() + 3600 },
    [{ ok: false, error: 'invalid-token' }, { ok: false, error: 'invalid-token' }],
  );
  state.refreshTo = { access_token: 'renewed', expires_at: now() + 3600 };
  const r = await authedFetch('/api/anything', { method: 'POST', body: '{}' });
  check('it retries exactly once, never in a loop', seen.length, 2);
  // AND THE CODE NEVER REACHES THE OFFICER. This is the whole point: the
  // session really is gone, and "invalid-token" tells them nothing they can act
  // on. They need the sentence.
  check('…and the officer is told what to do, not shown the code',
    [r.ok, r.error], [false, 'not-signed-in']);
  check('…in words', /session has expired/.test(String(r.detail)), true);
}

// --- A REFUSAL THAT IS NOT ABOUT THE SESSION IS LEFT ALONE ----------------
//
// A route refusing on the University's own rules is telling the officer
// something true, and retrying it would be wrong.
{
  reset(
    { access_token: 'good', expires_at: now() + 3600 },
    [{ ok: false, error: 'cannot-enable-your-own', detail: 'You cannot switch on your own.' }],
  );
  const r = await authedFetch('/api/anything', { method: 'POST', body: '{}' });
  check('a rule refusal is not retried', seen.length, 1);
  check('…and reaches the screen unchanged', r.error, 'cannot-enable-your-own');
  check('…with its own sentence', r.detail, 'You cannot switch on your own.');
}

// --- SIGNED OUT IS SIGNED OUT ---------------------------------------------
{
  reset(null, []);
  const r = await authedFetch('/api/anything', { method: 'POST', body: '{}' });
  check('with no session at all, nothing is sent', seen.length, 0);
  check('…and the answer is a sentence', [r.ok, r.error], [false, 'not-signed-in']);
}

{
  reset({ access_token: 'stale', expires_at: now() - 5 }, []);
  state.refreshFails = true;
  const r = await authedFetch('/api/anything', { method: 'POST', body: '{}' });
  check('when the refresh itself fails, nothing is sent', seen.length, 0);
  check('…and the officer is told to sign in', r.error, 'not-signed-in');
}

console.log(failures ? `\n${failures} check(s) failed.\n` : '\nAll session checks passed.\n');
process.exit(failures ? 1 : 0);
