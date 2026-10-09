// ---------------------------------------------------------------------------
// AN APPLICATION NOBODY FINISHED LEAVES THE REGISTER, AND IS NOT DELETED.
//
// Run with:  node src/lib/anAbandonedApplicationLeaves.test.mjs
//
// ---------------------------------------------------------------------------
// THE UNIVERSITY'S REQUEST
// ---------------------------------------------------------------------------
//
//   "STUDENT WHO FAIL IN THE APPLICATION PROCESS AND OR PAY NOT THEIR
//    APPLICATION FEE AND APPLICATION WAS NOT PROCESS, THAT INFORMATION SHOULD
//    SOMEHOW OVER TIME BE DELETED OR REMOVE SOMEWHERE THAN REMAINING ON THE
//    DASHBOARD"
//
// And, asked how: ninety days; the never-paid, the refused, the withdrawn and
// the paid-but-never-processed; by itself, with the Registrar able to bring
// one back.
//
// ---------------------------------------------------------------------------
// WHAT HAS TO STAY TRUE, AND WHY EACH OF THESE IS HERE
// ---------------------------------------------------------------------------
//
// 1. NINETY IS ONE NUMBER. It lives in SQL, in `application_abandoned_after()`,
//    and the screen says it in prose. A screen reading "90 days" over a
//    database meaning 60 is worse than a screen saying nothing, because
//    somebody plans around it.
//
// 2. AN ADMITTED STUDENT IS NEVER IN THE LIST. The whole difference between
//    tidying a register and losing people is which statuses the predicate
//    names, and it is a POSITIVE list so that a status invented next year is
//    never silently archived.
//
// 3. THE SCREEN'S ROLES AND THE VIEW'S ROLES ARE THE SAME SIX. The view is
//    deliberately not `security_invoker` — it has to read past the policy
//    hiding these rows — so it carries its own list, and a menu entry for an
//    office the view does not name is a menu entry onto an empty screen.
//
// 4. THE ROUTE AND THE DATABASE REFUSE THE SAME PEOPLE. 109's
//    `restore_application()` names three offices and the route guards on a
//    capability; if those two lists ever drift, the button works and the
//    database refuses, or the reverse.
//
// 5. IT IS NOT A DELETION. No path from this screen reaches 108.
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

const sql = read('docs/migrations/109_an_abandoned_application_leaves_the_register.sql');
const route = read('src/app/api/admissions/archive/route.ts');
const screen = read('src/components/admissions/ArchivedApplications.tsx');
const nav = read('src/lib/portalNav.tsx');

const bundle = (name, from) => {
  const out = join(root, 'node_modules', '.cache', 'iguc-tests', name);
  execFileSync('npx', [
    'esbuild', join(here, from),
    '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error',
    `--alias:@=${join(root, 'src')}`,
  ]);
  return out;
};

const { ARCHIVE_AFTER_DAYS, ARCHIVE_REASONS, reasonLabel } =
  await import(bundle('archive.mjs', 'applicationArchive.ts'));
const { can } = await import(bundle('roles-archive.mjs', 'roles.ts'));

// ---------------------------------------------------------------------------
console.log('\nNinety days is one number, and the database owns it\n');

// THE SQL IS THE AUTHORITY: it is what actually decides which rows a screen
// can see. So the number is READ OUT OF THE MIGRATION rather than written
// twice — a test asserting `90 === 90` against two literals it also wrote
// proves only that somebody can type.
const fromSql = /create or replace function application_abandoned_after\(\)[\s\S]*?select interval '(\d+) days'/
  .exec(sql);
check('the migration states an interval', Boolean(fromSql), true);
check('…and the screen says the same number',
  ARCHIVE_AFTER_DAYS, fromSql ? Number(fromSql[1]) : null);
check('…which is the ninety days the University asked for', ARCHIVE_AFTER_DAYS, 90);

// AND NOTHING ELSE SPELLS IT OUT. A second literal somewhere is a second
// number waiting to disagree with this one.
const strayNinety = /\b90\s*(?:\*|days|day\b)/i.test(
  screen.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ''),
);
check('the screen holds no 90 of its own', strayNinety, false);

// ---------------------------------------------------------------------------
console.log('\nAn admitted student is never archived, at any age\n');

const predicate = /create or replace function application_is_abandoned\([\s\S]*?\$\$([\s\S]*?)\$\$;/
  .exec(sql);
check('the predicate is there', Boolean(predicate), true);
const body = predicate ? predicate[1] : '';
const named = [...body.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

// THE FOUR THAT WOULD BE A DISASTER. Each of these is a person the University
// has taken in, and archiving one would take them off the register that says
// so.
for (const status of ['enrolled', 'admission_issued', 'approved', 'conditional']) {
  check(`"${status}" is not in the list`, named.includes(status), false);
}
// AND THE FOUR ON THE UNIVERSITY'S OWN DESK. Ninety days of these is the
// University's backlog, and hiding a backlog is not tidying.
for (const status of ['under_review', 'admission_processing', 'returned', 'deferred']) {
  check(`"${status}" is the University’s own delay, not an abandonment`,
    named.includes(status), false);
}
// AND THE FIVE KINDS THE UNIVERSITY ASKED FOR.
for (const status of ['applicant', 'fee_pending', 'rejected', 'withdrawn', 'fee_paid']) {
  check(`"${status}" does leave the register`, named.includes(status), true);
}

// THE LIST IS POSITIVE, which is what makes a status invented next year safe.
check('the predicate names what IS archived, not what is not',
  / in \(/.test(body) && !/not in \(/.test(body), true);

// ---------------------------------------------------------------------------
console.log('\nEvery reason the view can produce has a label\n');

// THE WORDS COME FROM THE VIEW'S CASE EXPRESSION, read out of the SQL. A
// screen that knows four of five reasons renders the fifth as a blank group
// and nobody ever finds out.
const view = /create view archived_applications[\s\S]*?end as why/.exec(sql);
check('the archive classifies each row', Boolean(view), true);
// BOTH ARMS: four `then` branches and the `else`. Counting only the `then`s
// would have reported four kinds and quietly stopped checking the fifth —
// which is the one the University's six rows were all going to land in.
const produced = [...(view ? view[0] : '').matchAll(/(?:then|else)\s+'([a-z-]+)'/g)]
  .map((m) => m[1]);
check('…into five kinds', produced.length, 5);
for (const why of produced) {
  check(`"${why}" has a label on the screen`,
    Object.keys(ARCHIVE_REASONS).includes(why), true);
}
// AND A WORD NOBODY TAUGHT IT IS SHOWN, NOT SWALLOWED.
check('an unknown reason falls back to itself rather than a blank',
  reasonLabel('something-new-in-2027'), 'something-new-in-2027');

// ---------------------------------------------------------------------------
console.log('\nThe screen’s offices and the view’s offices are the same six\n');

// THE VIEW DOES ITS OWN RESTRICTING because it reads past the policy, so its
// WHERE clause is the real answer to "who may read this".
const viewRoles = /and auth_role\(\) in \(([\s\S]*?)\);/.exec(sql);
check('the view names the offices itself', Boolean(viewRoles), true);
const sqlOffices = [...(viewRoles ? viewRoles[1] : '').matchAll(/'([a-z-]+)'/g)]
  .map((m) => m[1]).sort();

const navEntry = /id: 'archived-applications',[\s\S]*?roles: \[([\s\S]*?)\],\n/.exec(nav);
check('the screen is on the menu', Boolean(navEntry), true);
const navOffices = [...(navEntry ? navEntry[1] : '').matchAll(/'([a-z-]+)'/g)]
  .map((m) => m[1]).sort();

check('…to exactly the offices the view will answer for', navOffices, sqlOffices);

// ---------------------------------------------------------------------------
console.log('\nThe route and the database refuse the same people\n');

const fn = /create or replace function restore_application\([\s\S]*?\$\$;/.exec(sql);
check('the restore function is there', Boolean(fn), true);
const fnRoles = /coalesce\(auth_role\(\), ''\) not in \(([^)]*)\)/.exec(fn ? fn[0] : '');
check('…and names the offices that may call it directly', Boolean(fnRoles), true);
const dbOffices = [...(fnRoles ? fnRoles[1] : '').matchAll(/'([a-z-]+)'/g)]
  .map((m) => m[1]).sort();

check('the route guards on the capability',
  /restore-archived-application/.test(route), true);
const holders = ['superadmin', 'admin', 'registrar', 'admissions-officer', 'academic-office',
  'vice-chancellor', 'finance', 'lecturer', 'student', 'national-rector', 'chancellor']
  .filter((r) => can(r, 'restore-archived-application')).sort();

check('…and the capability is held by exactly who the database admits',
  holders, dbOffices);

// THE OFFICE THAT READS AND THE OFFICE THAT WRITES ARE DIFFERENT, deliberately.
check('the Admissions Officer reads the archive', navOffices.includes('admissions-officer'), true);
check('…and does not put records back on the register',
  can('admissions-officer', 'restore-archived-application'), false);

// A NULL ROLE IS REFUSED RATHER THAN PASSED. Written the obvious way,
// `auth_role() not in (…)` is NULL for an account with no profile row, the IF
// is not taken and the restore succeeds.
check('a role the register does not know is refused, not waved through',
  /coalesce\(auth_role\(\), ''\)/.test(fn ? fn[0] : ''), true);

// ---------------------------------------------------------------------------
console.log('\nNothing here is a deletion\n');

check('the screen says so in as many words',
  /Nothing here is deleted/.test(screen), true);
check('…and no path from it reaches the deletion workflow',
  /api\/admin\/deletion|deletion_requests|approve-deletion/.test(screen), false);
check('the route has one action, because nothing archives anything',
  /action !== 'restore'/.test(route), true);

// THE ARCHIVE IS READ-ONLY, and this is the finding that was invisible in the
// SQL: a view over one table with no join is automatically updatable, the
// project's default grants hand `authenticated` UPDATE on every new view, and
// this one is deliberately not security_invoker — so a write would have landed
// as the owner, past the row policy on `students`.
check('the archive’s write privileges are taken away whole',
  /revoke all on archived_applications from anon, authenticated;/.test(sql), true);
check('…and only SELECT handed back',
  /grant select on archived_applications to authenticated;/.test(sql), true);

// AND THE PUBLISHABLE KEY CANNOT CALL THE RESTORE FUNCTION. `anon` holds an
// EXPLICIT grant from the project's default privileges, which a revoke from
// PUBLIC does not touch.
check('`anon` is revoked by name, not only through PUBLIC',
  /revoke all on function restore_application\(uuid, uuid\) from public, anon;/.test(sql), true);

// ---------------------------------------------------------------------------
console.log('\nMoney taken for nothing is answered for separately\n');

check('the second list has no age limit in its WHERE clause',
  /create view applications_paid_and_never_processed[\s\S]*?;/.test(sql)
  && !/create view applications_paid_and_never_processed[\s\S]*?application_abandoned_after\(\)[\s\S]*?where/
    .test(sql), true);
check('…and a refunded fee is not on it',
  /coalesce\(s\.payment_status, ''\) <> 'refunded'/.test(sql), true);
// THE CARD HEADINGS, not the words anywhere in the file: the phrase "the
// archive" appears in a comment above both of them.
check('…and the screen draws it above the archive',
  screen.indexOf('title="Paid for, and never processed"')
    < screen.indexOf('title="The archive"'), true);

// ---------------------------------------------------------------------------
console.log('\nThe gap 108 left in the National Rector’s policy\n');

// SELECT POLICIES ARE OR'ED. 108 narrowed the staff policy and not this one,
// so a record approved for deletion was hidden from the Registrar and plainly
// visible to the Rector.
const nationalPolicy = /create policy students_national_read on students([\s\S]*?);/.exec(sql);
check('109 rewrites the National Rector’s policy', Boolean(nationalPolicy), true);
check('…carrying 108’s erasure clause',
  /is_awaiting_erasure\('students', id\)/.test(nationalPolicy ? nationalPolicy[1] : ''), true);
check('…and 109’s own',
  /application_is_abandoned/.test(nationalPolicy ? nationalPolicy[1] : ''), true);
check('…while still showing only their own administration',
  /administration_id = my_administration\(\)/.test(nationalPolicy ? nationalPolicy[1] : ''), true);

// ---------------------------------------------------------------------------
console.log(failures === 0
  ? '\nAll good.\n'
  : `\n${failures} failure${failures === 1 ? '' : 's'}.\n`);
process.exit(failures === 0 ? 0 : 1);
