// ---------------------------------------------------------------------------
// THE DOOR EVERY PRIVILEGED ROUTE GOES THROUGH, WATCHED REFUSING THINGS.
//
// Run with:  node src/lib/adminAuth.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
//
// `guard` decides who may delete an application, publish a credential design,
// suspend an administrator, take an admission decision and enrol a student. It
// is the one function in this system where a wrong answer is not a bug on a
// screen — it is somebody doing something they are not allowed to do, and the
// record afterwards saying they were allowed.
//
// It had no test at all. Every other test in this repository reads source and
// asserts about its shape; this one CALLS the function and watches what it
// does, because "the code says it checks the role" and "it checks the role" are
// different claims and only the second one matters.
//
// ---------------------------------------------------------------------------
// HOW IT IS CALLED WITHOUT A DATABASE
// ---------------------------------------------------------------------------
//
// The sandbox cannot reach the University's Supabase project, and a test that
// needed it would never run. So `@supabase/supabase-js` is replaced at bundle
// time with a stub whose `createClient` returns whatever this file tells it to
// — a token that resolves to a user, a profile with a role, a suspension date.
//
// WHAT THAT DOES AND DOES NOT PROVE. It proves the decisions `guard` makes:
// which combinations it refuses, with which status, and in which order it
// checks. It does not prove Supabase returns what the stub returns. That is the
// honest boundary, and it is far inside where this code was before, which was
// untested.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
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

const here = new URL('.', import.meta.url).pathname;
const cache = join(here, '../../node_modules/.cache/icof');
mkdirSync(cache, { recursive: true });

// --- The stub that stands in for Supabase ----------------------------------
//
// `globalThis.__icof` is how the test drives it: the bundle imports the stub,
// the stub reads the global at call time, so each case sets up its own world
// without rebuilding.
const stubPath = join(cache, 'supabase-stub.mjs');
writeFileSync(stubPath, `
export function createClient() {
  const world = globalThis.__icof ?? {};
  return {
    auth: {
      getUser: async (token) => (world.users && world.users[token])
        ? { data: { user: { id: world.users[token] } }, error: null }
        : { data: null, error: { message: 'bad token' } },
    },
    from: () => ({
      select: () => ({
        eq: (_col, id) => ({
          single: async () => ({ data: world.profiles?.[id] ?? null, error: null }),
        }),
      }),
    }),
  };
}
`);

const out = join(cache, 'adminAuth.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'adminAuth.ts'),
  '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error',
  `--alias:@=${join(here, '..')}`,
  `--alias:@supabase/supabase-js=${stubPath}`,
]);
const { guard, mayActOnTarget, generatePassword } = await import(out);

// The service-role key must be present or `guard` refuses before doing
// anything else — which is itself one of the cases below, so it is set here and
// deleted deliberately where that is what is being tested.
process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-real-key-and-never-committed';

const req = (token) => new Request('https://example.test/api/admin/anything', {
  method: 'POST',
  headers: token === null ? {} : { authorization: token },
});

/** A world in which `token` belongs to somebody with this role. */
function world(role, extra = {}) {
  globalThis.__icof = {
    users: { 'valid-token': 'user-1' },
    profiles: {
      'user-1': {
        id: 'user-1', email: 'someone@iguc.net', full_name: 'Someone',
        role, suspended_at: null, ...extra,
      },
    },
  };
}

console.log('\nNothing gets through without a token\n');

{
  world('superadmin');
  check('no Authorization header at all', (await guard(req(null), 'delete-application')).error, 'no-token');
  check('an empty header', (await guard(req(''), 'delete-application')).error, 'no-token');
  // THE SCHEME IS NOT OPTIONAL. A bare token with no "Bearer " would otherwise
  // be sliced at seven characters and sent to Supabase as gibberish, which
  // fails — but for the wrong reason, and a refusal for the wrong reason is one
  // that stops refusing when the reason changes.
  check('a token with no Bearer scheme', (await guard(req('valid-token'), 'delete-application')).error, 'no-token');
  check('…and the status is 401', (await guard(req(null), 'delete-application')).status, 401);

  const bad = await guard(req('Bearer nonsense'), 'delete-application');
  check('a token Supabase does not recognise', [bad.error, bad.status], ['invalid-token', 401]);

  // Case does not matter in an HTTP header scheme, and a client that sends
  // "bearer" lowercase is not an attacker.
  check('bearer in lower case is still a token',
    (await guard(req('bearer valid-token'), 'delete-application')).ok, true);
}

console.log('\nThe role comes from the database, never from the caller\n');

{
  // A VALID TOKEN FOR SOMEBODY WITH NO PROFILE. This is the shape of an account
  // that exists in auth and was never given a role — and defaulting it to
  // anything at all would be granting a capability to a row nobody created.
  globalThis.__icof = { users: { 'valid-token': 'ghost' }, profiles: {} };
  const g = await guard(req('Bearer valid-token'), 'delete-application');
  check('a signed-in account with no profile', [g.error, g.status], ['no-profile', 403]);
}

console.log('\nThe capability is checked, and it is the one that was asked for\n');

{
  // THE CASE THAT MATTERS MOST. A student with a perfectly valid token calling
  // an admin route with curl. The portal hides the button; this is what stops
  // the request.
  world('student');
  const g = await guard(req('Bearer valid-token'), 'delete-application');
  check('a student cannot delete an application',
    [g.error, g.status], ['not-permitted:delete-application', 403]);

  // ONLY THE SUPERADMINISTRATOR MAY DELETE APPLICATIONS — the University's own
  // ruling, watched holding.
  for (const role of ['admin', 'registrar', 'admissions-officer', 'finance', 'academic-office']) {
    world(role);
    const r = await guard(req('Bearer valid-token'), 'delete-application');
    check(`…nor may ${role}`, r.ok === true, false);
  }
  world('superadmin');
  check('the Superadministrator may', (await guard(req('Bearer valid-token'), 'delete-application')).ok, true);

  // FINANCE IS A GATE, NOT AN AUTHORITY. The separation the whole admission
  // workflow rests on, asserted at the door rather than assumed.
  world('finance');
  check('Finance cannot take an admission decision',
    (await guard(req('Bearer valid-token'), 'decide-admission')).ok, false);
  check('…but Finance can verify a payment',
    (await guard(req('Bearer valid-token'), 'verify-payment')).ok, true);
  world('academic-office');
  check('Academic Affairs can take the decision',
    (await guard(req('Bearer valid-token'), 'decide-admission')).ok, true);
  check('…and cannot verify a payment',
    (await guard(req('Bearer valid-token'), 'verify-payment')).ok, false);
}

console.log('\nA suspended account is refused before its role is consulted\n');

{
  // THE ONE THAT WOULD BE EASY TO GET BACKWARDS. A suspended Superadministrator
  // holds every capability there is. If the capability check ran first they
  // would pass it, and a suspended Superadministrator could un-suspend
  // themselves — which is the failure the suspension exists to prevent.
  world('superadmin', { suspended_at: '2026-01-01T00:00:00Z' });
  const g = await guard(req('Bearer valid-token'), 'delete-application');
  check('a suspended Superadministrator is refused',
    [g.error, g.status], ['caller-suspended', 403]);
}

console.log('\nWithout the service-role key it refuses rather than falling back\n');

{
  // A SILENT FALLBACK TO THE ANON KEY WOULD APPEAR TO WORK. It would read no
  // profile, find no role, and refuse everything — which looks like a
  // permissions problem and is actually a missing environment variable, and the
  // difference is a day of somebody's life.
  const keep = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  world('superadmin');
  const g = await guard(req('Bearer valid-token'), 'delete-application');
  check('the key is missing', [g.error, g.status], ['service-role-key-missing', 500]);
  process.env.SUPABASE_SERVICE_ROLE_KEY = keep;
}

console.log('\nWhat it hands back when it does let somebody through\n');

{
  world('registrar');
  const g = await guard(req('Bearer valid-token'), 'create-student-record');
  check('the caller is identified', [g.ok, g.caller.id, g.caller.role], [true, 'user-1', 'registrar']);
  check('…with the address the audit trail records', g.caller.email, 'someone@iguc.net');
  check('…and a client to work with', typeof g.admin, 'object');
}

console.log('\nHolding a capability is not the same as being allowed to use it here\n');

{
  const me = { id: 'user-1', email: null, role: 'superadmin', fullName: null };
  // ACTING ON YOURSELF. A Superadministrator who suspends their own account has
  // locked the University out of its own system with one click and there is
  // nobody left with the standing to undo it.
  check('nobody may act on their own account',
    mayActOnTarget(me, { id: 'user-1', role: 'superadmin' })?.error, 'cannot-act-on-own-account');
  check('…and it is a conflict, not a permission error',
    mayActOnTarget(me, { id: 'user-1', role: 'superadmin' })?.status, 409);
  check('a Superadministrator may act on a registrar',
    mayActOnTarget(me, { id: 'other', role: 'registrar' }), null);

  const registrar = { id: 'user-2', email: null, role: 'registrar', fullName: null };
  const r = mayActOnTarget(registrar, { id: 'other', role: 'superadmin' });
  check('a registrar may not act on a Superadministrator', r?.error, 'outranked:superadmin');
}

console.log('\nThe initial password is not guessable and not confusable\n');

{
  const one = generatePassword();
  check('long enough to matter', one.length >= 14, true);
  // NO l, 1, O OR 0. These are read aloud down a telephone line and typed by
  // somebody who has never seen the account before.
  check('no confusable characters', /[l1O0]/.test(one), false);
  const many = new Set(Array.from({ length: 200 }, () => generatePassword()));
  check('two hundred are two hundred different passwords', many.size, 200);
}

console.log(failures === 0 ? '\nAll adminAuth checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
