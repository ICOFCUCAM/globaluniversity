// ---------------------------------------------------------------------------
// THE ADAPTER CANNOT NAME A TABLE OR A COLUMN THE DATABASE DOES NOT HAVE.
//
// Run with:  node src/lib/data/schemaAgreement.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
//
// `supabase.ts` opened with an admission:
//
//     NOT VERIFIED AGAINST A DATABASE. This environment cannot reach one, so
//     every query below is written from the schema in that migration and has
//     never returned a row.
//
// It was honest and it was not enough. Written from a schema and never run,
// the adapter had accumulated exactly the faults you would expect:
//
//   · every table it named was `ls_*`, and this University's are not
//   · `person()` read `row.name ?? row.fullName` from `lecturers`, which has
//     `first_name` and `last_name` — so every name on every screen was the
//     empty string
//   · `savePerson` wrote `personId` into `profiles`, whose key is `id`, so
//     nothing it saved would ever have been found again
//
// None of those is subtle. All three survive code review, because reading
// `.eq('person_id', …)` tells you nothing about whether that column exists.
// Only a schema does.
//
// ---------------------------------------------------------------------------
// WHAT IT DOES
// ---------------------------------------------------------------------------
//
// Reads the adapter, extracts every table it names and every column it filters
// or writes, and asks a real Postgres — the local harness, loaded from the
// University's own RUN-ALL — whether each one is there.
//
// It cannot check that a QUERY returns the right rows; only a live project can
// do that, and `supabase.conformance.mjs` is the suite for it. It can check
// that every name is real, which is the half that was wrong.
//
// ---------------------------------------------------------------------------
// AND IT REFUSES TO REPORT ON A RUN IT DID NOT PERFORM
// ---------------------------------------------------------------------------
//
// Twice while writing migrations 092–094, a harness reported "the guard held"
// for runs that never happened — once because psql could not read the file it
// was given, once because a break renamed a trigger instead of removing it.
// Both times the output looked like a pass.
//
// So: no harness, no result. Not a pass, not a skip that scrolls past — a
// FAILURE that says the check did not run, because a suite that vouches for
// things it never examined is worse than one that is missing.
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let failures = 0;
const check = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`ok    ${label}`);
  } else {
    failures++;
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
  }
};

// `fileURLToPath`, NOT `new URL(...).pathname` — the latter percent-encodes,
// and this repository's own folder name has a space in it. That fault cost
// twenty-three checks once already.
const here = dirname(fileURLToPath(import.meta.url));

const SOCKET = '/var/tmp/pgtest/sock';

console.log('\nEvery table and column the adapter names is one the database has\n');

// ---------------------------------------------------------------------------
// WHAT THE ADAPTER NAMES
// ---------------------------------------------------------------------------

const bare = (p) => readFileSync(p, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

const tablesSrc = bare(join(here, 'tables.ts'));
const adapterSrc = bare(join(here, 'supabase.ts'));

/** key -> real table name, from the one file that is allowed to know. */
const TABLES = Object.fromEntries(
  [...tablesSrc.matchAll(/^\s{2}([A-Za-z]+):\s*'([a-z_]+)',/gm)].map((m) => [m[1], m[2]]),
);

check('tables.ts names some tables', Object.keys(TABLES).length > 10, true);

// EVERY KEY THE ADAPTER USES IS ONE tables.ts DEFINES. A typo here is a
// `undefined` table name, which PostgREST reports as a schema-cache miss —
// indistinguishable, in a log, from a migration nobody ran.
const usedKeys = [...new Set([...adapterSrc.matchAll(/TABLES\.([A-Za-z]+)/g)].map((m) => m[1]))];
check('the adapter uses no table key tables.ts does not define',
  usedKeys.filter((k) => !TABLES[k]), []);

// AND THE ADAPTER NAMES NO TABLE DIRECTLY. The whole point of tables.ts is
// that repointing is one edit; a string slipped back into the adapter defeats
// it silently.
const inlineTables = [...adapterSrc.matchAll(/(?:rows|one|upsert)\(\s*'([a-z_]+)'/g)].map((m) => m[1]);
check('the adapter names no table as a bare string', inlineTables, []);
check('…and no ls_ table remains anywhere in it', /\bls_[a-z_]+/.test(adapterSrc), false);

// ---------------------------------------------------------------------------
// WHICH COLUMNS, AND OF WHICH TABLE
//
// For each call that names a table, scan forward to the end of the statement
// and collect the columns it filters on. Crude, and right for this file: every
// query here is one chained expression.
// ---------------------------------------------------------------------------
const columnUses = [];
const callPattern = /(?:rows|one|upsert)\(\s*TABLES\.([A-Za-z]+)|client\.from\(\s*TABLES\.([A-Za-z]+)\s*\)/g;
for (const match of adapterSrc.matchAll(callPattern)) {
  const key = match[1] ?? match[2];
  const table = TABLES[key];
  if (!table) continue;
  // TO THE END OF THE STATEMENT, NOT A FIXED NUMBER OF CHARACTERS. The first
  // version took 400 characters and reported fourteen missing columns, of
  // which one was real and thirteen were the NEXT query's filters read as
  // this one's. A check that cries wolf thirteen times out of fourteen is one
  // the next person turns off.
  const tail = adapterSrc.slice(match.index);
  const ends = tail.indexOf(';');
  const window = tail.slice(0, ends === -1 ? 400 : ends);
  for (const col of window.matchAll(/\.(?:eq|is|order|neq|gt|lt|gte|lte)\(\s*'([a-z_]+)'/g)) {
    columnUses.push({ table, column: col[1] });
  }
}

// AND WHAT `upsert` WRITES. The keys are camelCase in the source and the
// adapter's own `snake()` converts them, so the same conversion runs here —
// this is precisely where `personId` became `person_id` and vanished.
const snake = (k) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
for (const match of adapterSrc.matchAll(/upsert\(\s*TABLES\.([A-Za-z]+),\s*\{([\s\S]{0,600}?)\n\s*\}\)/g)) {
  const table = TABLES[match[1]];
  if (!table) continue;
  for (const key of match[2].matchAll(/^\s*([a-zA-Z][A-Za-z0-9]*)\s*:/gm)) {
    columnUses.push({ table, column: snake(key[1]) });
  }
}

check('columns were found to check', columnUses.length > 15, true);

// ---------------------------------------------------------------------------
// ASK A REAL DATABASE
// ---------------------------------------------------------------------------

if (!existsSync(SOCKET)) {
  console.error('\nFAIL  the Postgres harness at /var/tmp/pgtest is not running, so NOTHING '
    + 'below was checked. Start it, then run this again. This is not a skip: an adapter that '
    + 'has never been compared with a schema is exactly the state this file exists to end.');
  process.exit(1);
}

const query = (db, sql) => execFileSync('sh', ['-c',
  `psql -h ${SOCKET} -U postgres -d ${db} -Atc "${sql.replace(/"/g, '\\"')}" 2>&1`,
], { encoding: 'utf8' }).trim();

// NEWEST FIRST, and discovered rather than listed — a named fixture goes stale
// the moment the next migration lands, which is the fault the appointment
// scenarios already met.
let database = null;
try {
  const candidates = query('postgres',
    "select datname from pg_database where datname ~ '^mall[0-9]+$'")
    .split('\n').map((d) => d.trim()).filter(Boolean)
    .sort((a, b) => Number(b.replace(/\D/g, '')) - Number(a.replace(/\D/g, '')));
  for (const candidate of candidates) {
    const landed = query(candidate, "select to_regclass('public.lecture_artefacts') is not null");
    if (landed === 't') { database = candidate; break; }
  }
} catch { /* reported below */ }

if (!database) {
  console.error('\nFAIL  no database with migrations 092-094 in it was reachable, so NOTHING was '
    + 'checked. Build one: create a database, load docs/migrations/tests/supabase-stub.sql, then '
    + 'docs/migrations/RUN-ALL.sql.');
  process.exit(1);
}

console.log(`Checked against ${database}\n`);

const present = new Set(
  query(database,
    "select table_name || '.' || column_name from information_schema.columns "
    + "where table_schema = 'public'").split('\n').map((r) => r.trim()).filter(Boolean),
);
const relations = new Set(
  query(database,
    "select table_name from information_schema.tables where table_schema = 'public' "
    + "union select table_name from information_schema.views where table_schema = 'public'")
    .split('\n').map((r) => r.trim()).filter(Boolean),
);

const missingTables = [...new Set(usedKeys.map((k) => TABLES[k]))]
  .filter((t) => !relations.has(t)).sort();
check('every table the adapter reads exists', missingTables, []);

const missingColumns = [...new Set(columnUses.map((u) => `${u.table}.${u.column}`))]
  .filter((ref) => !present.has(ref)).sort();
check('every column the adapter filters or writes exists', missingColumns, []);

// ---------------------------------------------------------------------------
// AND THE ONES THAT ARE NOT WIRED SAY SO RATHER THAN READING THE WRONG THING
//
// Six ideas the University already had a table for need a column-by-column
// mapping, not a rename. Until that is written the adapter throws. This checks
// it still throws — because the failure mode being guarded against is somebody
// "finishing" the integration by pointing the old code at the new name, which
// compiles, runs, and reads nothing.
// ---------------------------------------------------------------------------
const merged = [...tablesSrc.matchAll(/^\s{2}([a-z]+):\s*\{ into:/gm)].map((m) => m[1]);

// FIVE, DOWN FROM SIX, AND THE ONE THAT LEFT DID SO BY BEING FINISHED.
//
// `readings` was to fold into `course_lessons` where kind = 'reading', which
// was right when the reconciliation was written: 084's lesson already carried
// author, publisher, ISBN and DOI.
//
// The University then ruled, on 16 September 2026, that an e-book is a
// first-class course resource with a cover, a licence, and READING and
// DOWNLOADING as separate rights. None of that fits a lesson. 096 gives it its
// own table and the adapter reads it, so it is no longer unmapped.
//
// THE NUMBER IS PINNED ON PURPOSE. It came down because work was done; it must
// not come down because somebody deleted a line they found inconvenient, and a
// count that moves silently would not tell the difference.
check('five merges are still unmapped, and named', merged.length, 5);
check('…and readings is no longer one of them', merged.includes('readings'), false);

for (const key of merged) {
  const refuses = new RegExp(String.raw`notYetMapped\('${key}'\)`).test(adapterSrc);
  check(`${key} refuses rather than guessing`, refuses, true);
}

console.log(failures ? `\n${failures} check(s) failed.\n` : '\nThe adapter and the schema agree.\n');
process.exit(failures ? 1 : 0);
