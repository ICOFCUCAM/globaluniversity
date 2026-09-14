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
// ---------------------------------------------------------------------------
// THE PARTS ARE DISCOVERED, NOT LISTED.
//
// This file named RUN-PART-1 to RUN-PART-4 in three places, and when PART-4
// outgrew the editor and had to be split, two of those three would have gone
// on checking four files and reporting a clean sweep. A test that enumerates
// what it guards stops guarding whatever is added next — which is the same
// fault this file exists to catch in the bundles themselves.
// ---------------------------------------------------------------------------
const PART_FILES = readdirSync(migrations)
  .filter((f) => /^RUN-PART-\d+\.sql$/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

if (PART_FILES.length < 2) {
  console.error('FAIL  there are no RUN-PART files to check at all');
  process.exit(1);
}

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
  for (const bundle of ['RUN-OUTSTANDING.sql', 'RUN-ALL.sql',
    ...PART_FILES]) {
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

console.log('\nAnd the standalone check covers every migration the bundles do\n');

// ---------------------------------------------------------------------------
// ARE-THEY-ALL-IN.sql IS THE ANSWER TO "HOW DO I CHECK?", and it is generated
// from the same MARKERS table as the bundles — so the failure worth guarding
// against is not that it is wrong, but that it is STALE. A newer migration
// lands, the bundles are rebuilt, and this file is forgotten; it then reports
// a clean sweep of YESes that stops one short, which is worse than not
// existing, because somebody has now checked and been told everything is fine.
//
// It must also stay READ-ONLY. It is the one file in this directory somebody
// will run on the live database without reading first, precisely because it is
// advertised as safe.
// ---------------------------------------------------------------------------
{
  const report = readFileSync(join(migrations, 'ARE-THEY-ALL-IN.sql'), 'utf8');
  const outstanding = readFileSync(join(migrations, 'RUN-OUTSTANDING.sql'), 'utf8');

  const reported = [...report.matchAll(/select '(\d{3})' as migration/g)].map((m) => m[1]);
  const bundled = [...outstanding.matchAll(/select '(\d{3})' as migration/g)].map((m) => m[1]);
  check('it reports on exactly what RUN-OUTSTANDING reports on', reported, bundled);

  // THE NEWEST MIGRATION, NAMED. The check above passes if BOTH files are a
  // migration behind, which is the state they arrive at together.
  const newest = readdirSync(migrations)
    .filter((f) => /^\d{3}_.*\.sql$/.test(f)).sort().pop().slice(0, 3);
  check(`…and the newest migration (${newest}) is one of them`,
    reported.includes(newest), true);

  check('it changes nothing',
    /^\s*(create|alter|drop|insert|update|delete|truncate|grant|revoke|do)\b/im.test(
      report.replace(/^--.*$/gm, '')), false);
}

console.log('\nAnd the four parts add up to exactly the outstanding bundle\n');

// ---------------------------------------------------------------------------
// WHY THE BUNDLE IS ALSO SHIPPED IN FOUR PIECES
// ---------------------------------------------------------------------------
//
// RUN-OUTSTANDING.sql passed a megabyte and the Supabase SQL editor refused
// it: "Query is too large to be run via the SQL Editor". The University could
// not run the one file the whole hand-over depends on.
//
// So the same migrations are also built as RUN-PART-1 … RUN-PART-4, split at
// migration boundaries and run in order.
//
// AND THE FAILURE TO GUARD AGAINST IS DRIFT. A new migration lands, the
// generator rebuilds RUN-OUTSTANDING, and the parts are forgotten — so the
// University pastes four files, sees four clean runs, and is missing the
// newest migration with nothing anywhere saying so. That is worse than the
// size limit was, because it looks like success.
//
// This asserts the parts are a partition: every migration in the outstanding
// bundle appears in exactly one part, in the same order, with nothing extra.
{
  const numbersIn = (file) =>
    [...readFileSync(join(migrations, file), 'utf8')
      .matchAll(/select '(\d{3})' as migration/g)].map((m) => m[1]);

  const whole = numbersIn('RUN-OUTSTANDING.sql');
  const parts = PART_FILES.map((f) => numbersIn(f));
  const joined = parts.flat();

  check('every migration in RUN-OUTSTANDING is in exactly one part, in order',
    joined, whole);

  // SEPARATELY, because a duplicate and a gap both break the check above and
  // a reader needs to know which. Running one migration twice is harmless —
  // they are idempotent — but a part that repeats another's work is a sign
  // the split was edited by hand.
  check('no migration appears in two parts',
    joined.length, new Set(joined).size);

  // AND NONE OF THEM MAY GROW BACK PAST THE LIMIT. The editor refused a file
  // of 1,039,151 bytes. A quarter of a megabyte is well inside whatever the
  // real threshold is, and leaves room for several more migrations before a
  // part has to be split again.
  const LIMIT = 400_000;
  for (const f of PART_FILES) {
    const size = readFileSync(join(migrations, f), 'utf8').length;
    check(`${f.replace('.sql', '')} is small enough for the SQL editor (${size} bytes)`,
      size < LIMIT, true);
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
