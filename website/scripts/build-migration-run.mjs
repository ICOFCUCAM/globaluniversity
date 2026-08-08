// ---------------------------------------------------------------------------
// BUILD A SINGLE RUNNABLE FILE FROM SEVERAL MIGRATIONS.
//
//   node scripts/build-migration-run.mjs 006 010 011 012
//   -> docs/migrations/RUN.sql
//
//   node scripts/build-migration-run.mjs --out=RUN-ALL.sql 000 003 004 005 \
//        006 007 008 009 010 011 012
//   -> docs/migrations/RUN-ALL.sql   (the whole schema from nothing)
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

const argv = process.argv.slice(2);
const outFlag = argv.find((a) => a.startsWith('--out='));
const OUT = outFlag ? outFlag.slice('--out='.length) : 'RUN.sql';
const wanted = argv.filter((a) => !a.startsWith('--'));
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

// 000 IS 001 AND 002 MERGED, and listing it alongside them would run the same
// DDL twice. Harmless — every statement in all three is idempotent — but it
// wastes minutes on a big schema and, worse, it tells whoever reads the output
// that the file is confused about what it contains. Its own header says: "If
// you run this, you do not need either of those files."
if (wanted.includes('000') && (wanted.includes('001') || wanted.includes('002'))) {
  console.error(
    'Refusing to build: 000_complete.sql IS 001 and 002 merged. List 000 alone, '
    + 'or list 001 and 002 without it — never both.',
  );
  process.exit(1);
}

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
--   Rebuild:   node scripts/build-migration-run.mjs ${outFlag ? outFlag + ' ' : ''}${wanted.join(' ')}
--
-- ---------------------------------------------------------------------------
-- HOW TO RUN IT
--
-- Supabase SQL editor: paste the whole file and run once.
-- psql:                psql "<connection string>" -f docs/migrations/${OUT}
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
${wanted.includes('000') ? `-- ---------------------------------------------------------------------------
-- BEFORE YOU RUN THIS ONE — it starts from an empty database
--
-- 000_complete.sql appoints two administrators, and it can only appoint an
-- account that already exists. Create them first:
--
--   Dashboard -> Authentication -> Users -> Add user   (tick "Auto Confirm User")
--     superadmin@iguc.net   system custody
--     tchamer@aol.com       day-to-day administration
--
-- Running the file before they exist is harmless. It simply appoints nobody,
-- and you re-run that section afterwards.
--
-- AND AFTERWARDS, DO THE SECURITY CHECK at the foot of 000. Until it passes,
-- any signed-in student can make themselves a Superadministrator from the
-- browser console. That is not a formality.
--
` : ''}-- ---------------------------------------------------------------------------
-- AFTERWARDS
--
-- Run docs/migrations/VERIFY.sql to see what landed.
-- ===========================================================================
${parts.join('\n')}
`;

writeFileSync(join(dir, OUT), out);
console.log(`docs/migrations/${OUT}  ${files.length} files, ${(out.length / 1024).toFixed(1)}KB`);
console.log(`  ${files.join('\n  ')}`);
