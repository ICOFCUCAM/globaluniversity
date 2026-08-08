// ---------------------------------------------------------------------------
// DOES THE CODE NAME COLUMNS THAT ACTUALLY EXIST?
//
// Run with:  node src/lib/schemaContract.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
//
// Because three separate faults of exactly the same shape shipped in one day,
// and every one of them was invisible to typechecking, to the build, and to
// every other test in this repository:
//
//   /api/social/publish inserted `state: 'queued'` into social_post_targets.
//   The column is `status` and 'queued' is not one of its five permitted
//   values. The fan-out insert would have failed on every single publication —
//   the Social Media Command Centre could never have posted anything, ever.
//
//   The same route inserted `url`, `kind` and `position` into
//   social_post_media, whose columns are `storage_path`, `alt_text` and
//   `ordinal`. Every post carrying a photograph would have failed.
//
//   The publication log and the dashboard read `t.state`, got undefined, and
//   would have reported every post in the University's history as still
//   publishing.
//
// None of this is catchable by TypeScript: `supabase.from('x').insert({...})`
// takes an untyped object, and a `.select('a, b')` string is just a string. The
// compiler is happy, the build is green, and the failure arrives at runtime in
// front of whoever pressed the button.
//
// ---------------------------------------------------------------------------
// WHAT THIS DOES
// ---------------------------------------------------------------------------
//
// Reads the migrations as the definition of truth — every `create table` and
// every `alter table ... add column` — and then reads the application for every
// `.from('table')` followed by `.insert({...})`, `.update({...})` or
// `.select('...')`, and reports any column named in the code that the schema
// does not have.
//
// IT IS A LINTER, NOT A TYPE SYSTEM. It parses text, so it can be fooled by
// dynamic column names, and it deliberately says nothing about columns that
// exist but are never used. Both are acceptable: the failure it catches is the
// one that takes a subsystem down completely and silently.
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;
const problems = [];

function fail(where, message) {
  failures++;
  problems.push(`${where}\n      ${message}`);
}

const root = new URL('../..', import.meta.url).pathname;

// ---------------------------------------------------------------------------
// 1. THE SCHEMA, FROM THE MIGRATIONS.
// ---------------------------------------------------------------------------

const migrationDir = join(root, 'docs/migrations');
const migrations = readdirSync(migrationDir)
  .filter((f) => /^\d{3}_.*\.sql$/.test(f))
  .sort();

/** table -> Set(column) */
const schema = new Map();

const add = (table, column) => {
  if (!schema.has(table)) schema.set(table, new Set());
  schema.get(table).add(column);
};

for (const file of migrations) {
  // 001 and 002 are superseded by 000_complete.sql and describe an older shape;
  // including them would let a column that no longer exists satisfy a check.
  if (file.startsWith('001_') || file.startsWith('002_')) continue;

  const sql = readFileSync(join(migrationDir, file), 'utf8')
    // Strip line comments so a column name inside prose is never counted.
    .replace(/^\s*--.*$/gm, '');

  // create table [if not exists] NAME ( ... );
  const createRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_.]*)\s*\(/gi;
  let m;
  while ((m = createRe.exec(sql)) !== null) {
    const table = m[1].replace(/^public\./, '');
    // Walk to the matching close paren.
    let depth = 1;
    let i = createRe.lastIndex;
    while (i < sql.length && depth > 0) {
      if (sql[i] === '(') depth++;
      else if (sql[i] === ')') depth--;
      i++;
    }
    const body = sql.slice(createRe.lastIndex, i - 1);

    // Split on top-level commas only — a CHECK (x in ('a','b')) contains commas.
    let d = 0, current = '';
    const parts = [];
    for (const ch of body) {
      if (ch === '(') d++;
      else if (ch === ')') d--;
      if (ch === ',' && d === 0) { parts.push(current); current = ''; continue; }
      current += ch;
    }
    parts.push(current);

    for (const part of parts) {
      const t = part.trim();
      if (!t) continue;
      // Skip table-level constraints.
      if (/^(constraint|primary\s+key|unique|check|foreign\s+key|exclude)\b/i.test(t)) continue;
      const name = t.match(/^([a-z_][a-z0-9_]*)/i);
      if (name) add(table, name[1]);
    }
  }

  // alter table NAME add column [if not exists] COL [, add column ...];
  //
  // THE COMMA FORM MATTERS. 000_complete.sql widens `students` with a single
  // statement carrying twenty `add column` clauses. Reading only the first
  // clause made this test report nineteen real columns as missing, which is the
  // fastest way to teach somebody to ignore it.
  const alterRe = /alter\s+table\s+(?:only\s+)?([a-z_][a-z0-9_.]*)\b([\s\S]*?);/gi;
  while ((m = alterRe.exec(sql)) !== null) {
    const table = m[1].replace(/^public\./, '');
    const clauseRe = /add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi;
    let c;
    while ((c = clauseRe.exec(m[2])) !== null) add(table, c[1]);
  }
}

console.log(`Read ${schema.size} tables from ${migrations.length} migrations.\n`);

// Tables that live outside the migrations in this repository. Supabase provides
// auth.users; profiles is created in 000 but is also written through the admin
// API, and storage buckets are not SQL at all.
const EXTERNAL = new Set(['auth.users', 'storage.objects']);

// ---------------------------------------------------------------------------
// 2. WHAT THE CODE NAMES.
// ---------------------------------------------------------------------------

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = walk(join(root, 'src'));

/**
 * Columns named in a PostgREST select string.
 *
 * Handles the embedded form — `id, name, other_table(a, b)` — by attributing
 * the nested names to the nested table rather than to the parent, which is
 * where the CommandCentrePanel's `social_post_targets(status)` lives.
 */
function columnsFromSelect(select) {
  const out = [];               // [table|null, column]
  let depth = 0, current = '', nestedName = '';
  const flush = (chunk) => {
    const c = chunk.trim();
    if (!c || c === '*') return;
    const nested = c.match(/^([a-z_][a-z0-9_]*)\s*(?:!\w+)?\s*\(([\s\S]*)\)$/i);
    if (nested) {
      // KEEP THE INNERMOST TABLE. `a(b, c(d))` means d belongs to c, not to a —
      // and re-attributing it reported social_accounts(handle) as a missing
      // column of social_post_targets.
      for (const [inner, col] of columnsFromSelect(nested[2])) {
        out.push([inner ?? nested[1], col]);
      }
      return;
    }
    // `alias:column` and `column::cast` both appear in PostgREST selects.
    const name = c.split(':').pop().trim().split('.').pop().trim();
    if (/^[a-z_][a-z0-9_]*$/i.test(name)) out.push([null, name]);
  };
  for (const ch of select) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { flush(current); current = ''; continue; }
    current += ch;
  }
  flush(current);
  return out;
}

/** Top-level keys of the object literal starting at `start` (the '{'). */
function objectKeys(source, start) {
  let depth = 0, i = start, body = '';
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    if (ch === '}') { depth--; if (depth === 0) break; }
    body += ch;
  }
  body = body.slice(1);

  const keys = [];
  let d = 0, current = '';
  let inString = null;
  for (let j = 0; j < body.length; j++) {
    const ch = body[j];
    if (inString) { if (ch === inString && body[j - 1] !== '\\') inString = null; current += ch; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { inString = ch; current += ch; continue; }
    if ('({['.includes(ch)) d++;
    if (')}]'.includes(ch)) d--;
    if (ch === ',' && d === 0) { keys.push(current); current = ''; continue; }
    current += ch;
  }
  keys.push(current);

  return keys
    .map((k) => k.trim())
    .filter(Boolean)
    // `key: value` at the top level. Spreads and shorthand are skipped — a
    // spread's keys cannot be read from here without evaluating it.
    .map((k) => (k.match(/^([a-z_][a-z0-9_]*)\s*:/i) ?? [])[1])
    .filter(Boolean);
}

const checked = { selects: 0, writes: 0 };

for (const file of files) {
  if (file.endsWith('.test.mjs')) continue;
  const src = readFileSync(file, 'utf8');
  const rel = file.slice(root.length);

  // .from('table') ... up to the end of the statement
  const fromRe = /\.from\(\s*['"]([a-z_][a-z0-9_]*)['"]\s*\)/g;
  let m;
  while ((m = fromRe.exec(src)) !== null) {
    const table = m[1];
    if (!schema.has(table) || EXTERNAL.has(table)) continue;
    const columns = schema.get(table);

    // THE CHAIN, AND ONLY THE CHAIN.
    //
    // This used to take a fixed 1400 characters, which swept up whatever
    // statement came next: the amend route's `credential_amendments` insert was
    // reported as naming columns of `credentials_issued`, and every audit_logs
    // insert was attributed to whatever table was queried above it. Roughly a
    // hundred of the first run's findings were that, not real drift.
    //
    // So the window ends at the next `.from(`, which is where the next
    // statement's chain begins.
    const rest = src.slice(m.index + m[0].length);
    const nextFrom = rest.search(/\.from\(\s*['"]/);
    const tail = m[0] + (nextFrom < 0 ? rest.slice(0, 2000) : rest.slice(0, nextFrom));

    const sel = tail.match(/\.select\(\s*(['"`])([\s\S]*?)\1/);
    if (sel) {
      checked.selects++;
      for (const [nestedTable, column] of columnsFromSelect(sel[2])) {
        const target = nestedTable ?? table;
        if (!schema.has(target)) continue;   // an embed this parser cannot resolve
        if (!schema.get(target).has(column)) {
          fail(`${rel}`, `select names ${target}.${column}, which the migrations do not define.`);
        }
      }
    }

    for (const verb of ['insert', 'update', 'upsert']) {
      const at = tail.indexOf(`.${verb}(`);
      if (at < 0) continue;
      // ONLY THE FIRST ARGUMENT, and only when it is an object literal.
      // `.upsert({...}, { onConflict: 'x' })` takes options second — reading
      // those reported `onConflict` as a missing column of every table it was
      // used on. `.insert(rows.map(...))` is a call, not a literal, and is
      // skipped rather than guessed at.
      const open = at + verb.length + 2;             // just past `.verb(`
      let k = open;
      while (k < tail.length && /\s/.test(tail[k])) k++;
      if (tail[k] !== '{') continue;
      checked.writes++;
      for (const key of objectKeys(tail, k)) {
        if (!columns.has(key)) {
          fail(`${rel}`, `${verb} names ${table}.${key}, which the migrations do not define.`);
        }
      }
    }
  }
}

console.log(`Checked ${checked.selects} selects and ${checked.writes} writes against the schema.\n`);

// ---------------------------------------------------------------------------
// 3. THE VOCABULARIES THAT MUST MATCH A CHECK CONSTRAINT.
//
// A column can exist and still reject every value the code puts in it, which is
// how `state: 'queued'` would have failed even against a `state` column. So the
// enumerations shared with the database are compared to their CHECK lists.
// ---------------------------------------------------------------------------

const allSql = migrations
  .filter((f) => !f.startsWith('001_') && !f.startsWith('002_'))
  .map((f) => readFileSync(join(migrationDir, f), 'utf8'))
  .join('\n');

/**
 * The values a CHECK constraint permits for `table.column`.
 *
 * SCOPED TO THE TABLE, and the first version of this was not — it searched the
 * whole concatenated schema for the first `status ... check (status in (...))`
 * and found `credentials_issued`, so it reported that the fan-out states must
 * be one of issued/replaced/revoked. Half a dozen tables in this schema have a
 * column called `status`; an unscoped match is guaranteed to find the wrong one.
 */
function permitted(table, column) {
  // The table's own definition — its create block, plus any alter that adds
  // this column to it.
  const create = allSql.match(
    new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?${table}\\s*\\(([\\s\\S]*?)\\n\\);`, 'i'),
  );
  const alter = allSql.match(
    new RegExp(`alter\\s+table\\s+${table}\\s+add\\s+column\\s+(?:if\\s+not\\s+exists\\s+)?${column}[\\s\\S]*?;`, 'i'),
  );

  for (const scope of [create?.[1], alter?.[0]]) {
    if (!scope) continue;
    const m = scope.match(
      new RegExp(`\\b${column}\\b[\\s\\S]{0,120}?check\\s*\\(\\s*${column}\\s+in\\s*\\(([^)]*)\\)`, 'i'),
    );
    if (m) {
      return m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean).sort();
    }
  }
  return null;
}

function checkVocabulary(label, table, column, values) {
  const allowed = permitted(table, column);
  if (!allowed) {
    fail(label, `no CHECK constraint found for ${table}.${column} — this test cannot verify it.`);
    return;
  }
  const rejected = [...values].filter((v) => !allowed.includes(v));
  if (rejected.length > 0) {
    fail(label, `the database would reject ${rejected.map((v) => `'${v}'`).join(', ')}. It permits: ${allowed.join(', ')}.`);
  } else {
    console.log(`ok    ${label}`);
  }
}

const out = join(root, '.test-build', 'contract');
const { execFileSync } = await import('node:child_process');
const { mkdirSync } = await import('node:fs');
mkdirSync(out, { recursive: true });
const bundle = join(out, 'social.mjs');
execFileSync('npx', [
  'esbuild', join(root, 'src/lib/social.ts'),
  '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`, '--log-level=error',
  `--alias:@=${join(root, 'src')}`,
]);
const S = await import(bundle);

const authorityBundle = join(out, 'authority.mjs');
execFileSync('npx', [
  'esbuild', join(root, 'src/lib/credentialAuthority.ts'),
  '--bundle', '--format=esm', '--platform=node', `--outfile=${authorityBundle}`, '--log-level=error',
  `--alias:@=${join(root, 'src')}`,
]);
const A = await import(authorityBundle);

console.log('Vocabularies shared with the database\n');

checkVocabulary('the fan-out states', 'social_post_targets', 'status', S.TARGET_STATES);
checkVocabulary('the networks the composer offers', 'social_accounts', 'platform', S.PLATFORMS);
checkVocabulary('university and personal accounts', 'social_accounts', 'scope', ['university', 'personal']);
checkVocabulary('the post approval states', 'social_posts', 'approval_state', ['draft', 'submitted', 'approved', 'rejected']);
checkVocabulary('what kinds of credential exist', 'credential_types', 'category', A.CREDENTIAL_CATEGORIES);
checkVocabulary('every audited credential action', 'credential_audit_events', 'action', A.AUDIT_ACTIONS);
checkVocabulary('the correction workflow', 'credential_correction_requests', 'status', A.CORRECTION_STATES);
checkVocabulary('the variant authorship record', 'social_post_variants', 'source', ['human', 'assistant']);

// ---------------------------------------------------------------------------

console.log('');
if (failures === 0) {
  console.log('Every column and value the application names exists in the schema.');
  process.exit(0);
}
for (const p of problems) console.error(`FAIL  ${p}`);
console.error(`\n${failures} mismatch${failures === 1 ? '' : 'es'} between the code and the migrations.`);
process.exit(1);
