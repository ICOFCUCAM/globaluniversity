// ---------------------------------------------------------------------------
// NOTHING IS DELETED BY ONE PERSON, AND NOTHING FOR THIRTY DAYS.
//
// Run with:  node src/lib/nothingIsDeletedAlone.test.mjs
//
// ---------------------------------------------------------------------------
// THE UNIVERSITY'S RULING
// ---------------------------------------------------------------------------
//
//   "superadmin should be able to delete these files. when he takes delete, it
//    should appear to the VC approval. if the vc accept delete, it is deleted
//    within 30 days. if he says reject, the file is restored. all the records
//    of these processes are kept in the history."
//
// And, asked what it covers and how it behaves: student records, anything with
// a delete today, and uploaded documents; hidden the moment the
// Vice-Chancellor approves and erased thirty days later; a record that cannot
// be deleted refused at REQUEST time with the reason named.
//
// ---------------------------------------------------------------------------
// WHAT HAS TO STAY TRUE
// ---------------------------------------------------------------------------
//
// Two offices, two capabilities. If one capability ever covered both halves,
// whoever held it could delete a record alone — which is the one thing the
// ruling exists to prevent, and it would not look like a bug in any screen.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let failures = 0;
const check = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`ok    ${label}`);
  } else {
    failures++;
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n`
      + `      actual   ${JSON.stringify(actual)}`);
  }
};

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const sql = read('docs/migrations/108_nothing_is_deleted_without_the_vice_chancellor.sql');
const route = read('src/app/api/admin/deletion/route.ts');
const old = read('src/app/api/admissions/delete/route.ts');

const out = join(root, 'node_modules', '.cache', 'iguc-tests', 'deletions.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'deletions.ts'),
  '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error',
  `--alias:@=${join(root, 'src')}`,
]);
const { DELETABLE, DELETION_GRACE_DAYS } = await import(out);

const roles = join(root, 'node_modules', '.cache', 'iguc-tests', 'roles-deletion.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'roles.ts'),
  '--bundle', '--format=esm', '--platform=node', `--outfile=${roles}`, '--log-level=error',
  `--alias:@=${join(root, 'src')}`,
]);
const { can } = await import(roles);

// ---------------------------------------------------------------------------

console.log('\nTwo offices, and neither can do the other’s half\n');

check('asking is the Superadministrator’s',
  /request: 'delete-application'/.test(route), true);
check('deciding is a different capability',
  /approve: 'approve-deletion'/.test(route)
  && /reject: 'approve-deletion'/.test(route), true);

// THE ONE THAT MATTERS. Two names that one role holds is one name wearing a
// disguise, and the Registrar is the test because they are senior enough to
// be plausible and hold neither.
check('the Vice-Chancellor decides', can('vice-chancellor', 'approve-deletion'), true);
check('…and does not also raise the request',
  can('vice-chancellor', 'delete-application'), false);
check('the Registrar can do neither',
  [can('registrar', 'delete-application'), can('registrar', 'approve-deletion')],
  [false, false]);

// ---------------------------------------------------------------------------

console.log('\nThe database refuses a deletion, not just the screen\n');

check('a student cannot be deleted outright',
  /create trigger nothing_is_deleted_without_the_vc_trg\s+before delete on students/.test(sql),
  true);
check('…nor an uploaded document',
  /create trigger nothing_is_deleted_without_the_vc_trg\s+before delete on documents/.test(sql),
  true);
check('and the refusal is lifted only by an approval whose time has run',
  /status = 'approved'\s*\n?\s*and erase_after <= now\(\)/.test(sql), true);

// THE ROUTE THAT USED TO DELETE NOW ASKS. Leaving the delete in place would
// have turned a working button into an error message the day 108 ran.
check('/api/admissions/delete no longer deletes',
  /from\('students'\)\.delete\(\)/.test(old), false);
check('…it raises a request instead',
  /from\('deletion_requests'\)\s*\n?\s*\.insert\(/.test(old), true);
check('…and does not report it as deleted',
  /ok: true, deleted:/.test(old), false);

// ---------------------------------------------------------------------------

console.log('\nWhat cannot be deleted is refused when it is asked for\n');

check('the request asks what holds the record first',
  route.indexOf("rpc('what_holds_this_record'") < route.indexOf("from('deletion_requests')"),
  true);
check('…and names every reason rather than one', /held: reasons/.test(route), true);

// 018'S RULE IS THE STRONGEST AND WAS THE ONE MISSING. The proof found it:
// an admitted student cannot be deleted at all, only an application.
check('an admitted student is named as un-deletable',
  /no longer an application/.test(sql), true);
for (const held of ['credential', 'transcript', 'examination', 'refund']) {
  check(`…and so is a record with a ${held}`,
    new RegExp(held, 'i').test(sql.slice(sql.indexOf('function what_holds_this_record'),
      sql.indexOf('comment on function what_holds_this_record'))), true);
}

// ---------------------------------------------------------------------------

console.log('\nThirty days, and the grace period does what it is for\n');

check('the library and the ruling agree on thirty', DELETION_GRACE_DAYS, 30);
check('the route uses it rather than a number of its own',
  /DELETION_GRACE_DAYS \* 24 \* 60 \* 60 \* 1000/.test(route), true);
check('nothing is erased before its time, in the row as well as the function',
  /nothing_is_erased_before_its_time/.test(sql), true);
check('rejecting an approved request restores it',
  /old\.status = 'approved' and new\.status in \('erased', 'rejected'\)/.test(sql), true);
check('…and the route treats that as a restoration, not a refusal',
  /wasApproved \? 'RESTORED' : 'REFUSED'/.test(route), true);
check('an erased record is not restorable, and says so',
  /That record has been erased\. Nothing brings it back/.test(sql), true);

// ---------------------------------------------------------------------------

console.log('\nThe history outlives the record\n');

check('the history is append-only',
  /a_deletion_history_is_append_only/.test(sql), true);
check('…refusing both update and delete',
  /before update or delete on deletion_request_events/.test(sql), true);

// THE LABEL IS COPIED AT THE MOMENT OF ASKING. The row goes away; a history
// that then reads "deleted 3f2a…" is a history of nothing.
check('what the record was is written down while it still exists',
  /a_deletion_names_what_it_is/.test(sql), true);
check('…and every deletable kind knows how to describe itself',
  Object.values(DELETABLE).filter((d) => typeof d.label !== 'function'), []);

// ---------------------------------------------------------------------------

console.log('\nThe two halves agree on what is deletable\n');

// `entity_type` is free text, so the erasing function chooses its table from
// an `if` chain — text concatenated into a DELETE is how an injected value
// chooses what gets destroyed. The application keeps the same list, and the
// two must not disagree about what can be asked for.
const eraser = sql.slice(sql.indexOf('function erase_what_is_due'));
const knows = [...eraser.matchAll(/r\.entity_type = '([a-z_]+)'/g)].map((m) => m[1]).sort();
check('every kind the application offers, the eraser knows how to erase',
  Object.keys(DELETABLE).sort(), knows);
check('…and the eraser never interpolates the type into a DELETE',
  /delete from %s|format\('delete/i.test(eraser), false);
check('…and says so about a kind it has not been taught',
  /is not a kind this function can erase/.test(eraser), true);

// ---------------------------------------------------------------------------
// MEASURED, NOT READ.
// ---------------------------------------------------------------------------

const psql = (db, q) => execFileSync('psql', ['-d', db, '-Atc', q], {
  encoding: 'utf8',
  env: { ...process.env, PGHOST: '/var/tmp/pgtest/sock', PGUSER: 'postgres' },
  stdio: ['ignore', 'pipe', 'ignore'],
}).trim();

let db = null;
try {
  db = psql('postgres', "select datname from pg_database where datname ~ '^mall[0-9]+$'")
    .split('\n').map((d) => d.trim()).filter(Boolean)
    .sort((a, b) => Number(b.replace(/\D/g, '')) - Number(a.replace(/\D/g, '')))[0] ?? null;
} catch { /* the harness is not running */ }

if (db) {
  console.log(`\nMeasured against ${db}\n`);
  // EVERY TABLE THE APPLICATION WILL ASK TO DELETE MUST CARRY THE TRIGGER.
  // A kind on the list whose table has no trigger is a kind that still
  // deletes outright, and nothing in the source would show it.
  for (const [kindName, d] of Object.entries(DELETABLE)) {
    const n = psql(db, "select count(*) from pg_trigger "
      + `where tgrelid = '${d.table}'::regclass `
      + "and tgname = 'nothing_is_deleted_without_the_vc_trg'");
    check(`${kindName} (${d.table}) carries the refusal`, n, '1');
  }
} else {
  console.log('\n(no fully-migrated database was reachable, so the triggers were not read)');
}

// ---------------------------------------------------------------------------

console.log(failures === 0
  ? '\nThe Superadministrator asks, the Vice-Chancellor decides, and the history keeps both.\n'
  : `\n${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
