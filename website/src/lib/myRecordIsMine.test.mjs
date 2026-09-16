// ---------------------------------------------------------------------------
// A SCREEN CALLED "MY SOMETHING" SHOWS THE PERSON THEIR OWN ROW.
//
// Run with:  node src/lib/myRecordIsMine.test.mjs
//
// ---------------------------------------------------------------------------
// THE BUG THIS EXISTS FOR
// ---------------------------------------------------------------------------
//
// The University signed in as `superadmin@iguc.net`, opened My record, and was
// shown Prof Aaron Ndenka's staff number, his post, his employment type, and a
// button to open HIS letter of appointment.
//
// The query was:
//
//     supabase.from('staff_records').select(RECORD).maybeSingle()
//
// with no filter at all, under a comment explaining that the filter was
// deliberately absent because row-level security decides. That reasoning is
// sound for a lecturer, whose policy admits exactly one row — their own — and
// wrong for every office that may read the whole register. 082 admits the
// Superadministrator, the System Administrator and HR to ALL staff records,
// correctly, because somebody has to maintain them. For those four roles the
// unfiltered query returns the whole table and `maybeSingle()` hands back
// whichever row happens to be in it.
//
// ONE STAFF RECORD EXISTED, so nothing errored. With two it would have started
// throwing instead — a different bad day, from the same cause.
//
// ---------------------------------------------------------------------------
// THE RULE, STATED ONCE
// ---------------------------------------------------------------------------
//
// ROW-LEVEL SECURITY IS A FLOOR, NOT AN IDENTITY. It says who MAY read a row.
// It never says which row is yours. A screen that promises "your own" has to
// name the person, and the promise is in its title.
//
// So: in any component whose name begins with `My`, a read that ends in
// `.maybeSingle()` or `.single()` must be constrained — by `.eq(`, `.in(`,
// `.match(` or an `.rpc(` that takes the caller. A list that is filtered by
// policy alone is a different question and is not what this checks: the
// failure here is specifically "one row, and it is somebody else's".
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync, statSync } from 'node:fs';
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

const here = dirname(fileURLToPath(import.meta.url));
const components = join(here, '../components');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Comments stripped, so the paragraph describing this bug is not the bug. */
const decomment = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1 ');

const screens = walk(components)
  .filter((f) => /\/My[A-Z][A-Za-z]*\.tsx$/.test(f));

console.log('\nEvery "My …" screen names the person whose row it shows\n');

check('there are My… screens to check', screens.length > 4, true);

// ---------------------------------------------------------------------------
// A CHAIN IS `supabase.from(...)` UP TO ITS `.maybeSingle()` / `.single()`.
//
// Matched non-greedily so two reads in one file are two chains rather than one
// run swallowing both — which would let an unfiltered read hide behind a
// filtered one earlier in the file. That is the exact shape of the bug.
// ---------------------------------------------------------------------------
const CHAIN = /supabase[\s\S]{0,40}?\.from\(\s*['"`]([a-z_]+)['"`]\)([\s\S]*?)\.(maybeSingle|single)\(/g;

const CONSTRAINED = /\.eq\(|\.in\(|\.match\(|\.filter\(|\.rpc\(/;

// ---------------------------------------------------------------------------
// A VIEW CALLED `my_…` MAY SCOPE ITSELF, AND THE CONVENTION IS VERIFIED HERE
// RATHER THAN TRUSTED.
//
// `my_journey` ends `where s.auth_user_id = auth.uid()`, so it returns one
// row — the caller's — whoever asks. That is a better place for the scoping
// than a screen, because every reader inherits it.
//
// But "the name starts with my_" is not evidence of anything on its own, and
// exempting a whole prefix on a naming convention is how an exemption list
// stops meaning something. So each one is looked up in the migrations and has
// to actually filter on auth.uid().
const migrations = join(here, '../../docs/migrations');
const migrationSql = readdirSync(migrations)
  .filter((f) => /^\d\d\d_.*\.sql$/.test(f))
  .map((f) => readFileSync(join(migrations, f), 'utf8'))
  .join('\n');

// ---------------------------------------------------------------------------
// SQL COMMENTS COME OFF FIRST, AND THIS IS NOT FUSSINESS.
//
// The first version of this file read the view definition as "everything up to
// the next semicolon". `my_journey` has one in a comment —
//
//     -- year the calendar covers; a left join says so honestly rather than
//
// — 40 lines above `where s.auth_user_id = auth.uid()`. So the definition was
// cut short, the auth.uid() was never in what was searched, and the check
// reported the view as unscoped. A correct view, failed by the check that was
// supposed to confirm it: the same shape as the bug at the top of this file, a
// test passing judgement on something it had not actually looked at.
//
// Quoting has to be tracked to do this, because `--` inside a string literal is
// text, not a comment, and a $$ function body is full of both.
// ---------------------------------------------------------------------------
const stripSqlComments = (sql) => {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];

    if (c === "'") { // a literal, where '' is an escaped quote
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; }
        if (sql[j] === "'") { j += 1; break; }
        j += 1;
      }
      out += sql.slice(i, j); i = j; continue;
    }

    const dollar = c === '$' && /^\$[A-Za-z_]*\$/.exec(sql.slice(i, i + 32));
    if (dollar) { // $$ … $$ or $tag$ … $tag$, kept whole
      const tag = dollar[0];
      const end = sql.indexOf(tag, i + tag.length);
      const j = end === -1 ? sql.length : end + tag.length;
      out += sql.slice(i, j); i = j; continue;
    }

    if (c === '-' && sql[i + 1] === '-') {
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? sql.length : nl;
      out += ' '; continue;
    }

    if (c === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? sql.length : end + 2;
      out += ' '; continue;
    }

    out += c; i += 1;
  }
  return out;
};

const migrationText = stripSqlComments(migrationSql);

// Missing and unscoped are different answers and are kept apart, so that
// "the view is not in the migrations at all" can never read as "it scopes
// itself" — which is how an exemption quietly becomes unconditional.
const definitionOf = (view) => new RegExp(
  `create\\s+or\\s+replace\\s+view\\s+${view}\\b([\\s\\S]*?);`, 'i',
).exec(migrationText);

const unnamed = [];
const selfScoping = [];
const undefinable = [];
for (const file of screens) {
  const text = decomment(readFileSync(file, 'utf8'));
  for (const m of text.matchAll(CHAIN)) {
    const [, table, middle] = m;
    if (CONSTRAINED.test(middle)) continue;
    if (/^my_/.test(table)) {
      const def = definitionOf(table);
      if (!def) { undefinable.push(table); continue; }
      if (/auth\.uid\(\)/.test(def[1])) { selfScoping.push(table); continue; }
    }
    unnamed.push(`${file.slice(components.length + 1)} → ${table}`);
  }
}

check('no "My" screen reads a single row without saying whose', unnamed, []);
check('…and the views that scope themselves really do', selfScoping, ['my_journey']);
check('…and every my_ view relied on was actually found in the migrations', undefinable, []);

// THE COMMENT-STRIPPING IS ITSELF PROVED, because the last thing this file
// should do is trust a reader it wrote five minutes ago.
// Asserted as "what is in the statement", not as a character offset: the
// question is whether the auth.uid() survives into the definition, and an
// index would only be re-derived by counting the fixture.
const upToFirstSemicolon = (sql) => stripSqlComments(sql).split(';')[0];

check('a semicolon in a comment does not end a statement',
  /auth\.uid\(\)/.test(upToFirstSemicolon(
    'create view v as select 1\n -- covers; honestly\n where x = auth.uid();')),
  true);
check('…and the unstripped text is exactly where it went wrong',
  /auth\.uid\(\)/.test(
    'create view v as select 1\n -- covers; honestly\n where x = auth.uid();'.split(';')[0]),
  false);
check('…and a double dash inside a literal is text, not a comment',
  /keep --this/.test(stripSqlComments("select 'keep --this' as a; -- gone")),
  true);
check('…and a $$ body survives whole',
  /begin.*end/s.test(stripSqlComments('do $$ begin\n -- note; here\n raise notice \'x\'; end $$;')),
  true);

// ---------------------------------------------------------------------------
// AND THE DETECTOR WOULD CATCH THE ORIGINAL.
//
// Checked against the text of the query that shipped, rather than against the
// repository — so this keeps meaning something on the day every screen is
// correct, which is the day a check like this quietly stops working.
// ---------------------------------------------------------------------------
const wouldFlag = (src) => {
  const out = [];
  for (const m of decomment(src).matchAll(new RegExp(CHAIN.source, 'g'))) {
    if (!CONSTRAINED.test(m[2])) out.push(m[1]);
  }
  return out;
};

check('…the query that showed the Superadministrator somebody else’s record is caught',
  wouldFlag("const { data } = await supabase.from('staff_records').select(RECORD).maybeSingle();"),
  ['staff_records']);

check('…and the corrected one is not',
  wouldFlag("const { data } = await supabase.from('staff_records').select(RECORD)"
    + ".eq('auth_user_id', me).maybeSingle();"),
  []);

// A COMMENT ABOUT THE BUG IS NOT THE BUG. This file and MyRecord both describe
// the unfiltered query at length.
check('…and a comment describing it is not flagged',
  wouldFlag("// supabase.from('staff_records').select(RECORD).maybeSingle()\nconst x = 1;"),
  []);

console.log(failures
  ? `\n${failures} check(s) failed.\n`
  : '\nEvery "My" screen asks for its own reader.\n');
process.exit(failures ? 1 : 0);
