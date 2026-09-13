// ---------------------------------------------------------------------------
// THE "DID IT LAND?" TABLE TELLS THE TRUTH.
//
// Run with:  node src/lib/migrationBundles.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
//
// Every migration proves itself in plpgsql and reports with RAISE NOTICE — and
// the Supabase SQL editor, which is where the University actually runs them,
// DOES NOT DISPLAY NOTICES. So "expect four OK notices" named output nobody
// could see, and the only signal available was the absence of a red error.
//
// The bundles therefore end with a plain SELECT that says which migrations
// landed. That table is now the University's ONLY visible confirmation, which
// makes a wrong row in it worse than no table at all:
//
//   A FALSE "NO" sends somebody to re-run a migration that is already applied.
//   A FALSE "YES" tells them something landed that did not.
//
// The first one happened immediately. 043's marker was `working_hours`, which
// is a COLUMN on `appointments` — and `to_regclass` looks for a relation, so it
// came back null and the table reported 043 as missing on a database where it
// plainly was not.
//
// This asserts every marker is a real relation that a complete database has.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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
const migrations = join(here, '../../docs/migrations');
const SOCKET = '/var/tmp/pgtest/sock';

// ---------------------------------------------------------------------------
// THE MARKERS, READ OUT OF THE GENERATOR
// ---------------------------------------------------------------------------

const script = readFileSync(join(here, '../../scripts/build-migration-run.mjs'), 'utf8');
const block = script.slice(script.indexOf('const MARKERS = {'), script.indexOf('};',
  script.indexOf('const MARKERS = {')));
const markers = Object.fromEntries(
  [...block.matchAll(/'(\d{3})':\s*'([a-z_]+)'/g)].map((m) => [m[1], m[2]]),
);

console.log('\nEvery marker names a migration that exists\n');

{
  check('the generator declares markers at all', Object.keys(markers).length > 0, true);

  const files = readdirSync(migrations).filter((f) => /^\d{3}_.*\.sql$/.test(f));
  for (const n of Object.keys(markers)) {
    check(`${n} is a migration in docs/migrations`,
      files.some((f) => f.startsWith(`${n}_`)), true);
  }
}

console.log('\nAnd the bundles end with the table rather than with a proof nobody can see\n');

{
  for (const bundle of ['RUN-OUTSTANDING.sql', 'RUN-ALL.sql']) {
    const sql = readFileSync(join(migrations, bundle), 'utf8');
    check(`${bundle} closes with the landed report`,
      /DID IT LAND\?/.test(sql), true);
    // THE ORDER MATTERS. A report in the middle of the file reports on a
    // database half way through being migrated, which is a different question.
    check(`…and it is the last thing in ${bundle}`,
      sql.lastIndexOf('DID IT LAND?') > sql.lastIndexOf('raise notice'), true);
    // AND IT DOES NOT PROMISE NOTICES ANY MORE. The header used to tell the
    // reader to expect output the editor does not print.
    check(`…and ${bundle} says the editor does not show notices`,
      /does not display the NOTICE/.test(sql), true);
  }
}

// ---------------------------------------------------------------------------
// THE PART THAT NEEDS A DATABASE
// ---------------------------------------------------------------------------

if (!existsSync(SOCKET)) {
  console.log('\n(the Postgres harness is not running, so the markers were not resolved '
    + 'against a real schema)');
  console.log(failures === 0 ? '\nAll bundle checks passed.' : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

function psql(db, sql) {
  return execFileSync('sh', ['-c',
    `psql -h ${SOCKET} -U postgres -d ${db} -Atc "${sql.replace(/"/g, '\\"')}" 2>&1`,
  ], { encoding: 'utf8' }).trim();
}

// ---------------------------------------------------------------------------
// A DATABASE THAT HAS HAD EVERYTHING. Without one there is nothing to resolve
// the markers against, and reporting that as a pass is how the 043 bug would
// have survived.
//
// DISCOVERED, NOT LISTED. This named three databases — mall51, mall50, mall49 —
// and took the first that answered. Which meant that the moment a migration
// newer than 51 was written, the test resolved its markers against a schema
// that predated it and reported the newest marker as a relation the database
// does not have. A stale fixture reporting a real file as broken is the kind
// of failure somebody fixes by deleting the check.
//
// So the harness is asked which `mall…` databases it has and the highest one
// wins, which is the most-migrated by construction.
// ---------------------------------------------------------------------------
let complete = null;
try {
  const found = psql('postgres',
    "select datname from pg_database where datname ~ '^mall[0-9]+$'")
    .split('\n').map((d) => d.trim()).filter(Boolean)
    .sort((a, b) => Number(b.replace(/\D/g, '')) - Number(a.replace(/\D/g, '')));
  for (const db of found) {
    try {
      if (psql(db, 'select 1') === '1') { complete = db; break; }
    } catch { /* try the next */ }
  }
} catch { /* the harness is not running; handled below */ }

if (!complete) {
  console.log('\n(no fully-migrated database was reachable, so the markers were not resolved)');
  console.log(failures === 0 ? '\nAll bundle checks passed.' : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

console.log(`\nEvery marker is a real relation, resolved against ${complete}\n`);

{
  for (const [n, marker] of Object.entries(markers)) {
    // to_regclass IS WHAT THE REPORT ITSELF USES. Asking the same way is the
    // point: a marker that is a column rather than a relation resolves to null
    // here exactly as it does there.
    const found = psql(complete, `select to_regclass('public.${marker}') is not null`);
    check(`${n}: '${marker}' is a relation the database has`, found, 't');
  }
}

console.log(failures === 0 ? '\nAll bundle checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
