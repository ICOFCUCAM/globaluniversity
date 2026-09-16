// ---------------------------------------------------------------------------
// A MIGRATION'S SELF-TEST DOES NOT LEAVE PEOPLE BEHIND.
//
// Run with:  node src/lib/noMigrationLeavesAPerson.test.mjs
//
// ---------------------------------------------------------------------------
// THE FAULT THIS WAS WRITTEN AFTER
// ---------------------------------------------------------------------------
//
// The University read their Accounts list and found two of the fifteen were
// not people:
//
//   selftest-proctor-015@iguc.net    Student   Active
//   selftest-marker-015@iguc.net     Student   Active
//
// Migration 015's self-test needs somebody to raise an examination incident,
// decide a finding and enter a mark. It creates two identities to do it —
// AND IT DOES NOT ROLL BACK.
//
// Every migration from about 040 onwards ends with `raise exception 'ROLLBACK
// NNN'`, so its proof runs and then throws itself away. 015 predates that
// convention: its proof commits. Two accounts, an examination, a sitting, an
// event, an answer, an incident, a finding, a mark and a report have been part
// of the University's live record ever since.
//
// They showed as STUDENTS because `on_auth_user_created` gives every new
// account a profile and `student` is the default. Nobody chose it, and nobody
// could have noticed without opening the Accounts list and reading fifteen
// rows — which is what eventually happened.
//
// ---------------------------------------------------------------------------
// WHAT THIS ASKS
// ---------------------------------------------------------------------------
//
// It reads the AUTHENTICATION REGISTER of a database built by the migrations
// and nothing else, and asserts that the only identities in it are the two
// named below with a reason.
//
// Not the SQL. The first draft of this read the migration files looking for a
// rollback sentinel and reported thirty of them as leaking, on a database that
// had exactly two strays — because every migration does roll its proof back
// and they simply word the sentinel differently, and 014 deletes what it makes
// instead. A test that fails thirty innocent files is a test somebody deletes.
//
// The exemption list is the point: a new leak has to be added to it
// deliberately rather than discovered on an accounts screen a year later.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let failures = 0;
const check = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`ok    ${label}`);
  } else {
    failures++;
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n`
      + `      actual   ${JSON.stringify(actual)}`);
  }
};

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, '..', '..', 'docs', 'migrations');

// ---------------------------------------------------------------------------

console.log('\nEvery migration that creates a person throws them away again\n');

// ---------------------------------------------------------------------------
// MEASURED, NOT REASONED ABOUT.
//
// The first draft of this read the SQL and looked for a rollback sentinel —
// and reported thirty migrations as leaking when the database had exactly two
// stray identities in it. Every migration rolls its proof back; they simply
// word the sentinel differently (`proof-097-rollback`, `rollback 088 proof`,
// `ROLLBACK 103`), and 014 deletes what it made instead of rolling back at
// all. A test that fails thirty innocent files is a test somebody deletes.
//
// So this asks the database what is actually in it. That is the rule this
// codebase keeps having to relearn: measure, do not assume.
// ---------------------------------------------------------------------------

const psql = (db, sql) => execFileSync('psql', ['-d', db, '-Atc', sql], {
  encoding: 'utf8',
  env: { ...process.env, PGHOST: '/var/tmp/pgtest/sock', PGUSER: 'postgres' },
  stdio: ['ignore', 'pipe', 'ignore'],
}).trim();

// The most-migrated database the harness has, discovered rather than named —
// the same approach migrationBundles.test.mjs takes, and for the same reason:
// a fixture pinned by name goes stale the moment a migration is added.
let complete = null;
try {
  complete = psql('postgres',
    "select datname from pg_database where datname ~ '^mall[0-9]+$'")
    .split('\n').map((d) => d.trim()).filter(Boolean)
    .sort((a, b) => Number(b.replace(/\D/g, '')) - Number(a.replace(/\D/g, '')))[0] ?? null;
} catch { /* the harness is not running; handled below */ }

if (!complete) {
  console.log('      (no fully-migrated database was reachable, so the register was not read)');
} else {
  console.log(`      read from ${complete}`);

  // WHO IS IN THE AUTHENTICATION REGISTER AT ALL. On a database built only by
  // the migrations, the answer should be nobody: every proof that needs a
  // person makes one and throws it away.
  const left = psql(complete, "select coalesce(email,'(no email)') from auth.users order by 1")
    .split('\n').map((e) => e.trim()).filter(Boolean);

  // ---- WHAT IS ALLOWED TO SURVIVE, AND WHY ----------------------------
  //
  // An exemption is a claim. This one has to stay true.
  const ALLOWED = {
    'selftest-proctor-015@iguc.net':
      '015\u2019s self-test needs somebody to raise an examination incident and enter a mark, '
      + 'and its proof commits because 015 predates the rollback convention. 106 takes the '
      + 'ACCOUNT off the list; the identity stays because three foreign keys point at it with '
      + 'ON DELETE RESTRICT \u2014 an incident whose author has been erased is an incident '
      + 'nobody raised.',
    'selftest-marker-015@iguc.net': 'The same, for the mark rather than the incident.',
  };

  check('no migration leaves an identity in the register',
    left.filter((e) => !(e in ALLOWED)), []);

  // AND THE EXEMPTION IS STILL AN EXEMPTION.
  check('nothing is excused that is no longer there',
    Object.keys(ALLOWED).filter((e) => !left.includes(e)), []);

  // ---- AND NEITHER OF THE TWO IS AN ACCOUNT AFTER 106 ------------------
  //
  // The identity survives; the account does not. That distinction is the whole
  // of 106, and this is where it is checked against a real database rather
  // than against the migration's own notices.
  const accounts = psql(complete,
    "select email from profiles where email like 'selftest-%-015@iguc.net'")
    .split('\n').map((e) => e.trim()).filter(Boolean);
  check('and neither of 015\u2019s two appears on the accounts list', accounts, []);
}

// ---------------------------------------------------------------------------

console.log('\nAnd the two 015 left behind are dealt with by name\n');

const m106 = readFileSync(
  join(migrations, '106_the_self_test_is_not_two_students.sql'), 'utf8');

// BY IDENTIFIER, NOT BY PATTERN. `email like 'selftest%'` would also catch
// something a member of staff had since created, and a migration is not
// entitled to guess about those.
check('106 removes them by the uuids 015 writes',
  /0000000000e1/.test(m106) && /0000000000e2/.test(m106), true);
check('…and not by a wildcard that could catch somebody real',
  /delete from profiles[\s\S]{0,300}like '/.test(m106), false);

// THE PROFILE, NOT THE ACCOUNT. Deleting the account is refused by the
// evidence that names it, and 106's proof watches that refusal rather than
// asserting it in a comment.
check('it removes the profile, which is what every list of people reads',
  /delete from profiles/.test(m106), true);
check('and never the identity the evidence names',
  /delete from auth\.users[\s\S]{0,80}where id = '00000000-0000-0000-0000-0000000000e1'/
    .test(m106.slice(m106.indexOf('2. THE PROOF'))), true);
check('…which its proof watches being refused',
  /an identity named by an examination incident was deletable/.test(m106), true);

// AND THE EVIDENCE IS ASSERTED TO SURVIVE. A migration asked to tidy a list is
// exactly the kind that takes an examination record with it.
check('the examination record is asserted untouched',
  /the self-test examination record is untouched/.test(m106), true);

// ---------------------------------------------------------------------------

console.log(failures === 0
  ? '\nNo migration leaves a person on the accounts list.\n'
  : `\n${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
