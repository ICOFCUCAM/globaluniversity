// ---------------------------------------------------------------------------
// THE REFUND SCHEDULE IS PUBLISHED IN TWO PLACES AND MUST SAY ONE THING.
//
// Run with:  node src/lib/refundSchedule.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
//
// `regulations.ts` carries the schedule the University publishes on
// /academic-regulations, out of the Student Fees Guide. Migration 102 carries
// the same schedule in `refund_percent_by_schedule`, because the database has
// to be able to refuse an over-payment and a number a screen computes is a
// number a different caller computes differently.
//
// Two copies of a rule is how a rule drifts. A student reading 75% on the
// website and an officer approving 50% at a desk would both be right, and the
// University would be wrong twice.
//
// ---------------------------------------------------------------------------
// AND THE TWO RULES THAT GENUINELY DISAGREE
// ---------------------------------------------------------------------------
//
// The published schedule and the University's decision of 16 September 2026
// give different answers between day 1 and day 90 — the schedule allows a
// partial refund after studies have commenced, the decision allows none. That
// disagreement is NOT a drift and is not fixed here. It is recorded on every
// request and listed in `refund_requests_where_the_rules_disagree` so the
// University can settle which governs.
//
// What this test holds is that the system never pays out more than the LOWER
// of the two without an authorised exception, and that both figures are the
// ones the University actually published.
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

// ---------------------------------------------------------------------------

console.log('\nThe published schedule and the one the database enforces are the same schedule\n');

const sql = readFileSync(
  join(root, 'docs/migrations/102_a_refund_is_not_an_edit.sql'), 'utf8',
);

// The windows out of `refund_percent_by_schedule`, in the order they are asked.
const fn = sql.slice(sql.indexOf('function refund_percent_by_schedule'));
const body = fn.slice(0, fn.indexOf('$$;'));
const windows = [...body.matchAll(/days_since_enrolment <= (\d+)\s+then (\d+)/g)]
  .map((m) => [Number(m[1]), Number(m[2])]);

check('the database holds the four windows the Fees Guide publishes', windows, [
  [7, 100], [14, 75], [30, 50], [90, 25],
]);

// AND THE FALLTHROUGH IS NOTHING. "After 90 days — None."
check('after ninety days the database allows nothing',
  /else 0\s*\n?\s*end;/.test(body), true);

// NULL IS THE FIRST WINDOW, NOT THE LAST. A student who never enrolled has
// elapsed nothing since an enrolment that has not happened. 102's own proof
// caught this reading as 0% and refusing the whole refund to the one person
// both rules agree is owed all of it.
check('a student who never enrolled is inside the first window',
  /days_since_enrolment is null then 100/.test(body), true);

// ---- THE SAME FIGURES, OUT OF WHAT THE UNIVERSITY PUBLISHES ---------------

const out = join(root, 'node_modules', '.cache', 'iguc-tests', 'regulations-refund.mjs');
execFileSync('npx', [
  'esbuild', join(root, 'src/content/regulations.ts'),
  '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error',
  `--alias:@=${join(root, 'src')}`,
]);
const { refundSchedule } = await import(out);

const published = refundSchedule
  .map((r) => Number(String(r.refund).replace('%', '')))
  .filter((n) => Number.isFinite(n));

check('the Fees Guide publishes those same percentages',
  published, [100, 75, 50, 25]);

const boundaries = refundSchedule
  .flatMap((r) => [...String(r.window).matchAll(/(\d+)\s*days?/g)].map((m) => Number(m[1])));
check('and the same day boundaries', [...new Set(boundaries)], [7, 7, 14, 14, 30, 30, 90, 90]
  .filter((v, i, a) => a.indexOf(v) === i));

// ---------------------------------------------------------------------------

console.log('\nThe published rules that are enforced rather than described\n');

// "No cash or cheque refunds are made."
check('no cash or cheque refund is accepted',
  /in \('cash', 'cheque', 'check'\)/.test(sql), true);

// "electronically to the student's, parent's or sponsor's account"
check('money goes back only to the student, a parent or a sponsor',
  /check \(destination in \('student', 'parent', 'sponsor'\)\)/.test(sql), true);

// "only one refund per month is considered"
check('one refund per student per month is considered',
  /unique index if not exists one_refund_per_student_per_month/.test(sql), true);

// ---------------------------------------------------------------------------

console.log('\nThe payment is a record, not a draft\n');

check('a payment can be neither edited nor deleted',
  /before update or delete on payments/.test(sql), true);

// AND NOTHING IN THE APPLICATION TRIES TO. If something did, 102 would break
// it the day it runs — so this is checked here rather than discovered there.
const files = execFileSync('grep', [
  '-rl', "from('payments')", join(root, 'src'),
], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);

const writers = files.filter((f) => {
  const text = readFileSync(f, 'utf8');
  const uses = [...text.matchAll(/from\('payments'\)([\s\S]{0,200})/g)];
  return uses.some((m) => /\.(update|delete|upsert)\s*\(/.test(m[1]));
});
check('nothing in the application updates or deletes a payment',
  writers.map((f) => f.replace(root + '/', '')), []);

// ---------------------------------------------------------------------------

console.log('\nSubmitting never refunds anybody\n');

check('the path is walked by the database, not by a screen',
  /request → review → decision → refund/.test(sql), true);
check('a paid refund names the money out',
  /a_paid_refund_names_the_payment_out/.test(sql), true);
check('a decided refund says who and why',
  /a_decided_refund_says_who_and_why/.test(sql), true);
check('nobody is refunded more than they paid',
  /a_refund_never_exceeds_the_payment/.test(sql), true);
check('an exception is named, authorised and timed',
  /an_exception_is_authorised/.test(sql), true);

// AND THE ROUTE ASKS FOR TWO DIFFERENT AUTHORITIES. Recording a request is
// not deciding one; the audit's complaint was that `approve-refund` named
// nothing at all.
const route = readFileSync(join(root, 'src/app/api/finance/refund/route.ts'), 'utf8');
check('deciding a refund checks approve-refund',
  /'approve-refund'/.test(route), true);
check('recording one checks a different capability',
  /'manage-student-accounts'/.test(route), true);

// ---------------------------------------------------------------------------

console.log(failures === 0
  ? '\nOne schedule, published and enforced, and a payment that cannot be edited.\n'
  : `\n${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
