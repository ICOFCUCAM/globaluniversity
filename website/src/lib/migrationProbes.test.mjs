// ---------------------------------------------------------------------------
// DOES THE READINESS SCREEN ACTUALLY KNOW WHAT IT CLAIMS TO KNOW?
//
// Run with:  node src/lib/migrationProbes.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
//
// The University asked why it always had to ask which migrations were
// outstanding. The answer was that the list lived in a commit message. The fix
// is a screen that reads the database — and a screen like that fails in exactly
// one way that matters: it says a migration has been run when it has not,
// because the thing it looked for was never in that migration.
//
// So every probe is checked against the migration file it names. A probe that
// looks for a column the file does not add is a probe that will report a
// database as ready when it is a version behind, and this is the only place
// that catches it.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
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
const out = join(dir, 'migrationProbes.mjs');
execFileSync('npx', [
  'esbuild', new URL('./migrationProbes.ts', import.meta.url).pathname,
  '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error',
]);
const { MIGRATION_PROBES, stateFromError } = await import(out);

const migrationsDir = new URL('../../docs/migrations/', import.meta.url).pathname;
const read = (file) => readFileSync(join(migrationsDir, file), 'utf8');

console.log('\nEvery probe looks for something its own migration creates\n');

// THE FAILURE THIS CATCHES. A probe naming a column that migration adds nowhere
// reports "run" against a database that has never had it.
for (const probe of MIGRATION_PROBES) {
  // The ones that cannot be seen name no table on purpose; they are asserted
  // at the foot of this file instead.
  if (probe.cannotSee) continue;
  const sql = read(probe.file);
  if (probe.column) {
    const adds = new RegExp(
      `alter table ${probe.table}[\\s\\S]{0,80}?add column if not exists\\s+${probe.column}\\b`, 'i',
    ).test(sql)
      // A column added in the CREATE TABLE of the same migration counts too.
      || new RegExp(`create table if not exists ${probe.table}[\\s\\S]*?\\b${probe.column}\\b`, 'i').test(sql);
    check(`${probe.file} adds ${probe.table}.${probe.column}`, adds, true);
  } else {
    // A VIEW COUNTS. The probe reads through PostgREST, which serves a view
    // exactly as it serves a table — so `admission_status_coverage` is as good
    // a marker as any table, and insisting on CREATE TABLE would have forced
    // 027 to be listed as unverifiable when it is nothing of the kind.
    const creates = new RegExp(`create table if not exists ${probe.table}\\b`, 'i').test(sql)
      || new RegExp(`create (?:or replace )?view ${probe.table}\\b`, 'i').test(sql);
    check(`${probe.file} creates ${probe.table}`, creates, true);
  }
}

console.log('\nAnd every file it names is really there\n');

const present = new Set(readdirSync(migrationsDir));
check('no probe names a migration that does not exist',
  MIGRATION_PROBES.filter((p) => !present.has(p.file)).map((p) => p.file), []);

// A MIGRATION ADDED LATER AND NEVER PROBED is the other way this goes stale, so
// the newest numbered migration must be covered. It is the one most likely to
// be outstanding on a live database, because it is the one written last.
{
  const numbered = readdirSync(migrationsDir)
    .filter((f) => /^\d{3}_.*\.sql$/.test(f))
    .sort();
  const newest = numbered[numbered.length - 1];
  const covered = MIGRATION_PROBES.some((p) => p.file === newest);
  check(`the newest migration (${newest}) is covered by a probe`, covered, true);
}

console.log('\nReading a failure correctly\n');

// SENDING SOMEBODY TO RUN SQL THAT IS ALREADY APPLIED is its own damage, so
// only Postgres's two "it is not there" codes count as outstanding.
check('no error means it is applied', stateFromError(null), 'applied');
check('an undefined table means it is outstanding',
  stateFromError({ code: '42P01', message: 'relation "x" does not exist' }), 'outstanding');
check('an undefined column too',
  stateFromError({ code: '42703', message: 'column x does not exist' }), 'outstanding');
check('and PostgREST’s schema-cache miss, which is the same thing through the API',
  stateFromError({ code: 'PGRST204', message: "Could not find the 'x' column" }), 'outstanding');
// THE CASE THAT MUST NOT BE MISREAD. A policy that refuses the read is not a
// missing migration, and reporting it as one sends the University to the SQL
// editor to fix something that is not broken.
check('a permission failure is not evidence of anything',
  stateFromError({ code: '42501', message: 'permission denied for table x' }), 'unknown');
check('nor is a dropped connection',
  stateFromError({ code: '', message: 'fetch failed' }), 'unknown');

console.log('\nAnd what it cannot see, it says so about\n');

// A migration that only widens a CHECK constraint changes nothing readable.
// Reporting it as applied would be vouching for something never looked at.
{
  const blind = MIGRATION_PROBES.filter((p) => p.cannotSee);
  // PINNED, so a NEW blind spot has to be added here deliberately rather than
  // appearing quietly. 026 seeds two rows into an existing table and 028
  // replaces a function; the probe mechanism checks for tables and columns and
  // cannot see either kind.
  check('the migrations nothing can be read from are named as unverifiable',
    blind.map((p) => p.file),
    [
      '021_signing_key_in_the_store.sql',
      '026_issuance_is_not_the_decision.sql',
      '028_student_numbers_start_above_the_existing_ones.sql',
    ]);
  check('…and carries the check to run by hand',
    blind.every((p) => /select|pg_constraint/i.test(p.cannotSee)), true);
}

process.exit(failures === 0 ? 0 : 1);
