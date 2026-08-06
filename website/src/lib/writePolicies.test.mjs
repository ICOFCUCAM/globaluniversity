// ---------------------------------------------------------------------------
// Can the interface actually write what it tries to write?
//
// Run with:  node src/lib/writePolicies.test.mjs
//
// WHY THIS FILE EXISTS. An audit found that most writes this portal makes from
// the browser could not succeed. Row-level security is on across the schema and
// the policy set was almost entirely SELECT:
//
//   results     no write policy at all — every mark a lecturer entered was
//               refused, so no mark existed, so no average, so no degree
//   courses     no INSERT policy — the top of the whole academic pipeline
//   payments    no INSERT policy — no fee record, no financial clearance
//   documents   no INSERT policy, AND seven modules were writing rows that
//               violated its NOT NULL student_id before RLS was consulted
//
// None of it was visible. supabase-js returns an error object rather than
// throwing, so a screen that does not check it closes its modal, refreshes its
// list, and looks like it saved.
//
// This test is the thing that stops it coming back. It reads every write the
// client makes, reads every policy the migrations declare, and fails when a
// table is written without a policy that permits it.
//
// WHAT IT CANNOT DO. It cannot connect to the database — this sandbox has no
// route to the host — so it checks the migrations as written, not the schema as
// deployed. A migration that has not been run will still pass here. That is a
// real limit and the reason the deployment checklist lists the migrations in
// order.
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync } from 'node:fs';
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

const root = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');

/* ------------------------------------------------------------------ */
/* 1. Every write the browser makes                                    */
/* ------------------------------------------------------------------ */

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

// Client code only. API routes hold the service role, which bypasses RLS
// entirely — a policy is neither required nor consulted there.
const clientFiles = [
  ...walk(join(root, 'src/components')),
  ...walk(join(root, 'src/contexts')),
  ...walk(join(root, 'src/lib')).filter((f) => !/\.test\.mjs$/.test(f)),
].filter((f) => !f.includes('/api/'));

// THE MATCH IS ON THE SINGLETON, not on `.from(...)` in general.
//
// `supabase` is the browser client exported from src/lib/supabase.ts — it
// carries the publishable key and every one of its writes goes through RLS.
// Server-side code receives a service-role client under some other name
// (`admin`, `db`), and that bypasses RLS entirely, so a policy is neither
// required nor consulted. Matching any `.from()` would flag src/lib/gpa.ts,
// which is called only from a route with the service role, and the noise would
// make this test something people learn to ignore.
const WRITE = /\bsupabase\s*\n?\s*\.from\(\s*'([a-z_]+)'\s*\)\s*\n?\s*\.\s*(insert|update|upsert|delete)\b/g;

/**
 * Comments stripped first.
 *
 * Several files now carry a comment describing the write they USED to make —
 * "this was `supabase.from('results').upsert(...)` and it could never have
 * worked". Those comments are worth keeping and they are not code. Scanning
 * the raw text flagged them, which would have meant either deleting useful
 * history or teaching the reader to ignore a failing test.
 */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const clientWrites = new Map(); // table -> Set of ops
for (const f of clientFiles) {
  const src = stripComments(readFileSync(f, 'utf8'));
  for (const m of src.matchAll(WRITE)) {
    const [, table, op] = m;
    if (!clientWrites.has(table)) clientWrites.set(table, new Set());
    clientWrites.get(table).add(op === 'upsert' ? 'insert' : op);
  }
}

/* ------------------------------------------------------------------ */
/* 2. Every policy the migrations declare                              */
/* ------------------------------------------------------------------ */

const migrations = readdirSync(join(root, 'docs/migrations'))
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join(root, 'docs/migrations', f), 'utf8'))
  .join('\n');

const rlsOn = new Set(
  [...migrations.matchAll(/alter table\s+([a-z_]+)\s+enable row level security/gi)]
    .map((m) => m[1]),
);

const policies = new Map(); // table -> Set of cmds
for (const m of migrations.matchAll(
  /create policy\s+[a-z_]+\s+on\s+([a-z_]+)\s*(?:\n\s*)?for\s+(select|insert|update|delete|all)/gi,
)) {
  const table = m[1];
  const cmd = m[2].toLowerCase();
  if (!policies.has(table)) policies.set(table, new Set());
  policies.get(table).add(cmd);
}

const permits = (table, op) => {
  const p = policies.get(table);
  if (!p) return false;
  return p.has('all') || p.has(op);
};

/* ------------------------------------------------------------------ */
/* 3. The check                                                        */
/* ------------------------------------------------------------------ */

check('the scanner found client writes at all — otherwise this test is asleep',
  clientWrites.size > 0, true);
check('the scanner found policies at all', policies.size > 0, true);

// Tables the client writes that RLS will refuse.
const refused = [];
for (const [table, ops] of Array.from(clientWrites.entries()).sort()) {
  if (!rlsOn.has(table)) continue; // no RLS: nothing to refuse it
  for (const op of Array.from(ops).sort()) {
    if (!permits(table, op)) refused.push(`${table}.${op}`);
  }
}

check('every table the browser writes has a policy permitting it', refused, []);

// The reverse, stated positively so the deliberate cases stay deliberate rather
// than becoming an oversight nobody remembers making.
//
//   results     writes go through /api/results/save and /api/results/advance.
//               The rule depends on the caller's capability, the step the class
//               is at and who has already signed — none of which RLS can see,
//               so the policy would have to be "staff may update results",
//               which is not the rule.
//   audit_logs  an audit trail a client can write is one a client can forge,
//               and one it can write selectively is worse than none, because
//               its silence then means nothing.
//
// Most other tables also have no write policy — awards, departments, lecturers,
// enrollments and the credential register are all read-only from a browser.
// That is correct and is not enumerated here: this test asserts what must be
// true, not a snapshot of the schema that fails whenever a table is added.
for (const t of ['results', 'audit_logs']) {
  check(
    `${t} has no write policy, and must not gain one`,
    ['insert', 'update', 'delete', 'all'].some((c) => permits(t, c)),
    false,
  );
  check(`  nothing in the browser writes ${t} directly`, clientWrites.has(t), false);
}

/* ------------------------------------------------------------------ */
/* 4. The documents trap                                               */
/*                                                                     */
/* documents.student_id is NOT NULL with ON DELETE CASCADE. Seven       */
/* modules used to insert rows without it — invalid before RLS was even */
/* consulted — and had one ever succeeded by borrowing a student's id,  */
/* deleting that student would have deleted the university's timetable. */
/* ------------------------------------------------------------------ */

const moduleKinds = [
  'timetable-slot', 'attendance', 'forum-thread', 'forum-reply', 'exam-question',
  'assignment-brief', 'assignment-sub', 'announcement', 'live-class',
];

const stillInDocuments = [];
for (const f of clientFiles) {
  const src = readFileSync(f, 'utf8');
  if (!/from\(\s*'documents'\s*\)/.test(src)) continue;
  // A mention inside a comment is a note about the migration, not a query.
  const code = stripComments(src);
  if (!/from\(\s*'documents'\s*\)/.test(code)) continue;
  for (const k of moduleKinds) {
    if (code.includes(`'${k}'`)) stillInDocuments.push(`${f.replace(root + '/', '')} → ${k}`);
  }
}

check('no module still stores its records in the documents table', stillInDocuments, []);

console.log(failures === 0 ? '\nAll write-policy checks passed.' : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
