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
    // TWO TABLES NOW, AND THE CHAIN IS LONGER THAN IT WAS.
    //
    // The profile read is .select().eq().single(); the capability-grant read
    // (056) is .select().eq().eq().maybeSingle(). The first version of this
    // stub returned an object with only .single() after one .eq(), so the
    // second .eq() was not a function and every test after the grant check died
    // — not with a failure, with a TypeError deep in the bundle.
    //
    // So the builder is recursive: each .eq() narrows and returns the same
    // shape, and both terminators are always present. A stub that supports less
    // than the code it stands in for does not test the code, it tests the stub.
    from: (table) => {
      const rows = table === 'capability_grants_in_force'
        ? (world.grants ?? [])
        : Object.values(world.profiles ?? {});
      const build = (matched) => ({
        eq: (col, value) => build(matched.filter((r) => r[col] === value)),
        single: async () => ({ data: matched[0] ?? null, error: null }),
        maybeSingle: async () => ({ data: matched[0] ?? null, error: null }),
      });
      return { select: () => build(rows) };
    },
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

console.log('\nA capability grant lets somebody past, and only that somebody, and only that\n');

{
  // 056's switch. The Superadministrator hands a named person a named
  // capability until a stated date. `guard` honours it — but the whole value of
  // the table is in what it does NOT honour, so most of this section is
  // refusals.
  const live = {
    id: 'grant-1', grantee_id: 'user-1', capability: 'delete-application',
  };

  world('registrar');
  globalThis.__icof.grants = [live];
  const g = await guard(req('Bearer valid-token'), 'delete-application');
  check('a grant admits a caller whose role does not carry the capability', g.ok, true);
  // WHICH GRANT LET THEM IN. A capability held by exception must never be
  // indistinguishable in the record from one held by right.
  check('…and says which grant did it', g.caller.viaGrant, 'grant-1');

  // THE ORDINARY CASE IS STILL THE ROLE. A Superadministrator holds this by
  // right and must not be reported as holding it on somebody's grant.
  world('superadmin');
  globalThis.__icof.grants = [live];
  const byRight = await guard(req('Bearer valid-token'), 'delete-application');
  check('a role that carries it is not recorded as a grant',
    [byRight.ok, byRight.caller.viaGrant], [true, null]);

  // A GRANT OF SOMETHING ELSE IS NOT A GRANT OF THIS.
  world('registrar');
  globalThis.__icof.grants = [{ ...live, capability: 'issue-credential' }];
  const other = await guard(req('Bearer valid-token'), 'delete-application');
  check('a grant of a different capability does not open this door',
    [other.error, other.status], ['not-permitted:delete-application', 403]);

  // SOMEBODY ELSE'S GRANT IS SOMEBODY ELSE'S.
  world('registrar');
  globalThis.__icof.grants = [{ ...live, grantee_id: 'user-2' }];
  const theirs = await guard(req('Bearer valid-token'), 'delete-application');
  check('a grant to another account does not admit this one',
    theirs.ok === true, false);

  // AND AN EXPIRED OR REVOKED ONE IS SIMPLY ABSENT. The view decides that in
  // the database — 056 proves both cases in SQL — so what reaches this code is
  // an empty result, and this is the assertion that it is treated as a refusal
  // rather than as an error to shrug at.
  world('registrar');
  globalThis.__icof.grants = [];
  const spent = await guard(req('Bearer valid-token'), 'delete-application');
  check('a grant that is no longer in force is a refusal',
    [spent.error, spent.status], ['not-permitted:delete-application', 403]);

  // A SUSPENDED ACCOUNT IS REFUSED BEFORE THE GRANT IS EVEN LOOKED AT.
  world('registrar', { suspended_at: '2026-01-01T00:00:00Z' });
  globalThis.__icof.grants = [live];
  const suspended = await guard(req('Bearer valid-token'), 'delete-application');
  check('a grant does not survive the account being suspended',
    [suspended.error, suspended.status], ['caller-suspended', 403]);

  delete globalThis.__icof.grants;
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
