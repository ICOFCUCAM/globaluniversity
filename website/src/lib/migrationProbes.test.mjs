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
  if (probe.rpc) {
    // -----------------------------------------------------------------------
    // A FUNCTION PROBE, WHICH 083 NEEDED AND NOTHING BEFORE IT DID.
    //
    // COMMENTS STRIPPED FIRST, and this file has been caught by that twice
    // already. 083 names `teaches_this_student` in eight comments explaining
    // why it exists, so a bare substring search would pass on a migration that
    // discussed the function at length and never created it.
    // -----------------------------------------------------------------------
    const bare = sql.replace(/--.*$/gm, '');
    check(`${probe.file} creates ${probe.rpc}()`,
      new RegExp(`create (?:or replace )?function\\s+${probe.rpc}\\s*\\(`, 'i').test(bare), true);
    // AND THE ARGUMENTS IT IS CALLED WITH ARE THE ONES IT TAKES. A probe
    // passing `student_id` to a function whose parameter is `the_student` gets
    // "function not found" from PostgREST and reports a migration that HAS run
    // as outstanding — sending the University to the SQL editor for nothing.
    for (const arg of Object.keys(probe.rpcArgs ?? {})) {
      const sig = new RegExp(
        `create (?:or replace )?function\\s+${probe.rpc}\\s*\\(([\\s\\S]*?)\\)`, 'i',
      ).exec(bare);
      check(`…and takes the argument '${arg}' the probe passes it`,
        Boolean(sig) && new RegExp(`\\b${arg}\\b`).test(sig[1]), true);
    }
  } else if (probe.column) {
    // ---------------------------------------------------------------------
    // THE WHOLE STATEMENT, NOT A WINDOW OF EIGHTY CHARACTERS.
    //
    // This used to look for the column within 80 characters of `alter table
    // <name>`, which works only for a migration that adds one column and
    // explains itself afterwards. 053 adds three, with a comment against each
    // saying why it is not the other two — so the column it was probed on sat
    // four hundred characters in, and the test reported that the migration did
    // not add a column it plainly adds.
    //
    // A false failure here is not harmless: the next person makes the test
    // pass by weakening it, and the check stops meaning anything.
    //
    // STILL SCOPED TO THE RIGHT TABLE. Each `alter table <name> … ;` is taken
    // whole and the column looked for inside it, so a column added to a
    // DIFFERENT table in the same migration does not count.
    // ---------------------------------------------------------------------
    const statements = [...sql.matchAll(
      new RegExp(`alter table\\s+${probe.table}\\b[\\s\\S]*?;`, 'gi'),
    )].map((m) => m[0]);

    const adds = statements.some((s) =>
      new RegExp(`add column if not exists\\s+${probe.column}\\b`, 'i').test(s))
      // A column added in the CREATE TABLE of the same migration counts too.
      || new RegExp(`create table if not exists ${probe.table}[\\s\\S]*?\\b${probe.column}\\b`, 'i').test(sql)
      // ---------------------------------------------------------------
      // AND A COLUMN A VIEW GAINS BY BEING REBUILT.
      //
      // This check knew two ways a column can arrive — `add column` and a
      // `create table` — and a third has always existed: a view recreated
      // with a wider select. 081 widens `appointments_without_pay`, and the
      // test reported that it does not add a column it plainly adds.
      //
      // A false failure here is the dangerous kind: the next person makes
      // it pass by weakening the rule, and then it guards nothing.
      //
      // SCOPED TO THE VIEW'S OWN STATEMENT, from `create view <name>` to the
      // `from` that ends its select, so a column named in a different view
      // in the same migration does not count.
      || (() => {
        // COMMENTS STRIPPED FIRST, and this file has now been caught by that
        // more than once. The select carries "-- NEW. The post from the
        // register", and the word `from` inside that comment ended the match
        // three columns early — so the check reported a column missing from a
        // view that plainly has it.
        const bare = sql.replace(/--.*$/gm, '');
        const view = new RegExp(
          `create (?:or replace )?view\\s+${probe.table}\\b[\\s\\S]*?\\bfrom\\b`, 'i',
        ).exec(bare);
        return Boolean(view) && new RegExp(`\\b${probe.column}\\b`, 'i').test(view[0]);
      })();
    check(`${probe.file} adds ${probe.table}.${probe.column}`, adds, true);
  } else if (probe.match) {
    // ---------------------------------------------------------------------
    // A SEED IS NOT A CREATION, and asking whether 103 "creates positions"
    // would fail a probe that is doing its job.
    //
    // 103 creates no table, no column and no function: it puts the National
    // Rector and the National Financial Secretary into the register 048 built.
    // What has to be true of a match probe is the other thing — that the
    // migration actually INSERTS the row it will later look for, or the
    // Readiness panel reports a migration outstanding for ever.
    // ---------------------------------------------------------------------
    const bare = sql.replace(/--.*$/gm, '');
    const inserts = new RegExp(`insert into ${probe.table}\\b`, 'i').test(bare);
    check(`${probe.file} seeds into ${probe.table}`, inserts, true);
    check(`${probe.file} seeds the row it looks for (${probe.match.value})`,
      bare.includes(`'${probe.match.value}'`), true);
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
  //
  // 105 IS THE NEWEST, AND IT IS THE HARDEST KIND TO PROBE. It rewrites one
  // SELECT policy on `students` so that the Vice-Chancellor and the Chancellor
  // can read the register at all. Nothing is created, so `table` would report
  // `students` — there since 001 — as proof that 105 landed; and the probe runs
  // with the SERVICE key, which no policy binds, so reading a row proves
  // nothing about what a signed-in Vice-Chancellor sees.
  //
  // That is exactly the fault 105 fixes, one level up: a read that comes back
  // empty because of a policy looks identical to one that comes back empty
  // because there is nothing there. So it says "check by hand" and gives the
  // query, rather than vouching for something it cannot look at.
  check('the migrations nothing can be read from are named as unverifiable',
    blind.map((p) => p.file),
    [
      '021_signing_key_in_the_store.sql',
      '026_issuance_is_not_the_decision.sql',
      '028_student_numbers_start_above_the_existing_ones.sql',
      '029_the_coverage_view_is_for_operators_only.sql',
      '030_functions_pin_their_search_path.sql',
      // 036 widens the audit trail's event vocabulary. Nothing readable
      // changes, which is exactly the case this list exists for.
      '036_the_steps_nothing_could_write.sql',
      // 052 seeds ROWS into a table 051 already created. The probe mechanism
      // looks for tables and columns and can see neither the presence of a
      // seeded row nor its absence — so it says so, and names the count to run
      // by hand, rather than reporting the drafts as present because the table
      // is.
      '052_a_first_draft_of_every_document.sql',
      // 055 changes what two CHECK constraints PERMIT and adds a trigger. The
      // probe mechanism looks for tables and columns; a relaxed constraint is
      // neither, and 045 had already added the column it turns on.
      '055_the_office_that_needs_no_second_signature.sql',
      // 058 SEEDS ONE ROW into a table 057 created. The probe mechanism looks
      // for tables and columns and can see neither the presence of a seeded row
      // nor its absence — so it names the query to run by hand rather than
      // reporting the requirement as recorded because the table exists.
      '058_the_vice_chancellor_approves_a_curriculum.sql',
      // 060 SEEDS ROWS into tables 057 created — same reason as 052 and 058.
      '060_the_schools_and_programmes.sql',
      '061_a_version_for_every_programme.sql',
          // ---------------------------------------------------------------
      // 091 CREATES NOTHING. It TAKES RIGHTS AWAY — the publishable key's
      // INSERT, UPDATE, DELETE and TRUNCATE across 172 relations, and every
      // signed-in session's TRUNCATE.
      //
      // So there is genuinely nothing for the probe to read, and that is the
      // right answer rather than a gap: the question this migration settles is
      // not "did a table appear" but "can the public key still write", which is
      // a grant and not a row. The check to run by hand is one query and it is
      // on the entry.
      // ---------------------------------------------------------------
      '091_the_public_key_cannot_destroy_the_university.sql',
    '105_the_vice_chancellor_can_see_the_university.sql',
    // 106'S CONTENT IS A DELETION. Every probe form above asks "is it there";
    // asking that about two rows a migration removes reports NO for ever.
    '106_the_self_test_is_not_two_students.sql',
]);
  check('…and carries the check to run by hand',
    blind.every((p) => /select|pg_constraint/i.test(p.cannotSee)), true);
}

process.exit(failures === 0 ? 0 : 1);
