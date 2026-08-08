// ---------------------------------------------------------------------------
// BUILD A SINGLE RUNNABLE FILE FROM SEVERAL MIGRATIONS.
//
//   node scripts/build-migration-run.mjs 006 010 011 012
//   -> docs/migrations/RUN.sql
//
// ===========================================================================
// WHY
// ===========================================================================
//
// The Supabase SQL editor takes one paste. Running four migrations means four
// pastes in the right order, and the failure mode is silent and expensive: a
// tired person runs 011 before 006, gets an error about a missing table, fixes
// the "wrong" thing, and leaves the database half-migrated.
//
// This concatenates them in the order given, with a banner between each so the
// output can be read, and refuses to build if any file it is given contains
// something that cannot survive concatenation.
//
// ===========================================================================
// WHAT IT REFUSES, AND WHY EACH ONE MATTERS
// ===========================================================================
//
//   psql meta-commands (\i, \copy, \set). They are client instructions, not
//   SQL. Pasted into the Supabase editor they are a syntax error at best; in a
//   concatenated file they can silently change the meaning of everything after
//   them.
//
//   begin / commit / rollback. A file that opens its own transaction and one
//   that does not cannot be safely joined — the second file's statements end up
//   inside the first file's transaction, and a failure in file four rolls back
//   file one. Every migration in this repository is written to run
//   statement-by-statement, and this keeps it that way.
//
// It is a build script, not a runner. It does not connect to anything and it
// cannot damage a database. The output is text somebody reads before pasting.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '../docs/migrations');

const wanted = process.argv.slice(2);
if (!wanted.length) {
  console.error('Usage: node scripts/build-migration-run.mjs 006 010 011 012');
  process.exit(1);
}

const all = readdirSync(dir).filter((f) => f.endsWith('.sql'));

const files = wanted.map((n) => {
  const match = all.filter((f) => f.startsWith(`${n}_`));
  if (match.length !== 1) {
    console.error(
      match.length
        ? `Ambiguous: "${n}" matches ${match.join(', ')}`
        : `No migration numbered "${n}" in docs/migrations`,
    );
    process.exit(1);
  }
  return match[0];
});

// THE ORDER IS THE ORDER GIVEN, and it is checked rather than trusted. Someone
// typing "011 006" means it, or has made exactly the mistake this file exists
// to prevent — so it is refused rather than silently sorted, because silently
// sorting would hide the typo that revealed the misunderstanding.
const numbers = wanted.map(Number);
if (numbers.some((n, i) => i > 0 && n < numbers[i - 1])) {
  console.error(`Out of order: ${wanted.join(' ')}. Migrations must be listed ascending.`);
  process.exit(1);
}

const FORBIDDEN = [
  [/^\s*\\[a-z]/m, 'a psql meta-command (\\i, \\copy, \\set) — client instruction, not SQL'],
  [/^\s*(begin|commit|rollback)\s*;/im, 'an explicit transaction — cannot be safely concatenated'],
];

const parts = files.map((f) => {
  const sql = readFileSync(join(dir, f), 'utf8');
  for (const [re, why] of FORBIDDEN) {
    if (re.test(sql)) {
      console.error(`Refusing to build: ${f} contains ${why}.`);
      process.exit(1);
    }
  }
  const rule = '='.repeat(75);
  return `\n-- ${rule}\n-- ${rule}\n--\n--   ${f}\n--\n-- ${rule}\n-- ${rule}\n\n${sql}`;
});

const out = `-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — MIGRATIONS ${wanted.join(', ')}, IN ORDER
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-migration-run.mjs
--   Rebuild:   node scripts/build-migration-run.mjs ${wanted.join(' ')}
--
-- ---------------------------------------------------------------------------
-- HOW TO RUN IT
--
-- Supabase SQL editor: paste the whole file and run once.
-- psql:                psql "<connection string>" -f docs/migrations/RUN.sql
--
-- Every migration in it is idempotent and destroys nothing, so running it twice
-- is safe. It is NOT wrapped in a transaction: each file is written to run
-- statement by statement, and wrapping them would mean a failure in the last
-- one silently undid the first.
--
-- ---------------------------------------------------------------------------
-- WHAT TO EXPECT IN THE OUTPUT
--
-- Some of these raise NOTICE deliberately — they report on the state they
-- found rather than changing it silently. A notice is information, not a
-- warning. An ERROR is a real failure and stops the run.
--
-- ---------------------------------------------------------------------------
-- AFTERWARDS
--
-- Run docs/migrations/VERIFY.sql to see what landed.
-- ===========================================================================
${parts.join('\n')}
`;

writeFileSync(join(dir, 'RUN.sql'), out);
console.log(`docs/migrations/RUN.sql  ${files.join(' → ')}  (${(out.length / 1024).toFixed(1)}KB)`);
