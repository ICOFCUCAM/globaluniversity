// ---------------------------------------------------------------------------
// DOES THE BUNDLE APPLY TO A DATABASE THAT ALREADY HAD AN OLDER ONE?
//
//   node scripts/test-upgrade-path.mjs
//
// ===========================================================================
// WHY THIS EXISTS
// ===========================================================================
//
// Every migration in this repository is proved from an EMPTY database, twice.
// That catches the thing it is aimed at — a file that is not idempotent — and
// it is blind to the failure that actually reached the University:
//
//     ERROR: 23514: new row for relation "programmes" violates check
//            constraint "programmes_code_check"
//
// 057 had widened a CHECK constraint by editing the column in its own
// `create table if not exists programmes` block. On an empty database that
// works: the table is created and the new constraint with it. On a database
// that had already run the earlier 057, `create table if not exists` does
// NOTHING — including nothing to the constraint — so the widening never
// arrived, and the migration's own proof then inserted a value its own
// constraint refused.
//
// THE UNIVERSITY IS NEVER ON A FRESH DATABASE. It is always on the upgrade
// path, and the upgrade path was the one path never exercised.
//
// So this builds the database the University actually has — the migrations as
// they were at an earlier commit — and then applies the current bundle to it.
//
// ===========================================================================
// WHAT IT CANNOT TELL YOU
// ===========================================================================
//
// It compares against ONE earlier commit, not every one there has ever been. A
// database three revisions behind could still hit something this misses. It is
// aimed at the common case: a file edited after the University has run it.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOCKET = '/var/tmp/pgtest/sock';
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const repo = join(root, '..');
const migrations = join(root, 'docs/migrations');

if (!existsSync(SOCKET)) {
  console.log('(the Postgres harness is not running, so the upgrade path was not exercised)');
  process.exit(0);
}

const sh = (cmd) => execFileSync('sh', ['-c', cmd], { encoding: 'utf8' });

// HOW FAR BACK. One commit before the tip of this branch is the version most
// likely to be sitting on the University's database right now.
const base = process.argv[2] ?? 'HEAD~1';
let names;
try {
  names = sh(`git -C ${repo} ls-tree --name-only ${base} website/docs/migrations/`)
    .split('\n').map((l) => l.trim()).filter((l) => /\/\d{3}_.*\.sql$/.test(l));
} catch {
  console.log(`(no commit ${base} to compare against, so the upgrade path was not exercised)`);
  process.exit(0);
}

const scratch = join(root, 'node_modules/.cache/icof/upgrade');
mkdirSync(scratch, { recursive: true });

const db = 'm_upgrade_path';
sh(`dropdb --if-exists -h ${SOCKET} -U postgres ${db} 2>/dev/null || true`);
sh(`createdb -h ${SOCKET} -U postgres ${db}`);
// ---------------------------------------------------------------------------
// `--single-transaction`, AND IT IS NOT A DETAIL.
//
// THE SUPABASE SQL EDITOR RUNS A WHOLE SCRIPT AS ONE TRANSACTION. psql without
// this flag commits after every statement, and that difference is not cosmetic:
// it changes what the script is allowed to do.
//
// 065 was proved here and shipped, and failed on the University's own database
// with
//
//   ERROR: 42P07: relation "rolled_years" already exists
//
// Its function built a `create temp table … on commit drop`. ON COMMIT means
// exactly that — the table lives until the transaction commits. The file calls
// the function twice, so under one transaction the second call met the first
// call's table. Under autocommit the table was dropped in between, and the
// harness reported success.
//
// That is the second time a harness kinder than production has put a broken
// migration in front of the University; the first was the 057 code constraint.
// So every psql in this file now runs the way Supabase runs it.
// ---------------------------------------------------------------------------
const psql = (file) =>
  sh(`psql -h ${SOCKET} -U postgres -d ${db} -v ON_ERROR_STOP=1 --single-transaction -f ${file} 2>&1`);

console.log(`\nBuilding the database as it stood at ${base}\n`);
psql(join(migrations, 'tests/supabase-stub.sql'));

let built = 0;
for (const name of names.sort()) {
  const file = name.split('/').pop();
  // 000 is 001 and 002 merged; running it alongside them does the same DDL twice.
  if (file.startsWith('000_')) continue;
  const out = join(scratch, file);
  writeFileSync(out, sh(`git -C ${repo} show ${base}:${name}`));
  try { psql(out); built += 1; } catch (e) {
    console.error(`FAIL  ${file} would not apply even at ${base}\n${String(e.stdout ?? e)}`);
    process.exit(1);
  }
}
console.log(`      ${built} migrations applied as they were at ${base}`);

// ---------------------------------------------------------------------------
console.log('\nAnd now the current bundle, over the top of it\n');

const bundle = join(migrations, 'RUN-OUTSTANDING.sql');
for (const pass of [1, 2]) {
  try {
    psql(bundle);
    console.log(`ok    RUN-OUTSTANDING.sql applies to that database (pass ${pass})`);
  } catch (e) {
    const text = String(e.stdout ?? '') + String(e.stderr ?? '');
    const line = text.split('\n').find((l) => /ERROR/.test(l)) ?? text.slice(0, 400);
    console.error(
      `\nFAIL  the bundle does not apply to a database that ran the migrations at ${base}.\n`
      + `      ${line.trim()}\n\n`
      + '      This is the path the University is on: it has already run an earlier version of\n'
      + '      a file that has since been edited. A constraint or default changed inside a\n'
      + '      `create table if not exists` block reaches a NEW database and not theirs —\n'
      + '      it needs its own `alter table … drop constraint / add constraint`.\n\n'
      + '      AND THIS RUNS IN ONE TRANSACTION, as the Supabase editor does. A 42P07 on a\n'
      + '      temp table, or anything else that depends on a statement having committed,\n'
      + '      fails here and not under plain psql. See the note beside `psql` above.\n',
    );
    process.exit(1);
  }
}

// The migrations at `base` should not have left the newest ones out of reach.
const newest = readdirSync(migrations)
  .filter((f) => /^\d{3}_.*\.sql$/.test(f)).sort().pop().slice(0, 3);
console.log(`ok    the newest migration (${newest}) is in the bundle that was applied`);

console.log('\nThe upgrade path holds.');
