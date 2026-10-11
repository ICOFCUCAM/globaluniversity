// ---------------------------------------------------------------------------
// A TRANSFER CREDIT IS A CREDIT, AND IT IS NEVER AN ICOF CREDIT.
//
// Run with:  node src/lib/transferCreditWorkflow.test.mjs
//
// ---------------------------------------------------------------------------
// THE UNIVERSITY'S DECISION OF 16 SEPTEMBER 2026
// ---------------------------------------------------------------------------
//
//   "Credit transfer: YES. ICOF accepts transfer credits from other
//    institutions, and `transfer_credits` becomes a real workflow rather than
//    being retired. Approved credits join the authoritative academic record
//    and must reach programme progress, credit totals, graduation eligibility
//    and the transcript. THEY STAY DISTINGUISHABLE FROM COURSES COMPLETED AT
//    ICOF — that distinction is the point, not a detail."
//
// ---------------------------------------------------------------------------
// WHAT HAS TO STAY TRUE, AND WHY EACH OF THESE IS HERE
// ---------------------------------------------------------------------------
//
// 1. THE TWO FIGURES NEVER MERGE. One total satisfies the first half of the
//    ruling and loses the second, and it would look right.
//
// 2. A TRANSFER CREDIT IS NEVER SCORED. 035 publishes ICOF's grading scale
//    and the engine computes against it; importing another institution's
//    grade points would make the CGPA a weighted average of two marking
//    standards, one of which the Senate has never seen. A classification
//    resting on that is one the University cannot defend.
//
// 3. IT REACHES THE DECISION, NOT JUST THE SCREEN. The thing 019 left out for
//    a year was the connection to the record that decides whether somebody
//    graduates — so `assessGraduation` is tested on the arithmetic directly.
//
// 4. THE SCREEN AND THE MIGRATION KNOW THE SAME STATES. The ladder is the
//    database's, on a table five offices can write to.
//
// 5. RECORDING AND DECIDING ARE TWO CAPABILITIES. One held by both would let
//    whoever holds it do the whole thing alone.
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

const bundle = (name, from) => {
  const out = join(root, 'node_modules', '.cache', 'iguc-tests', name);
  execFileSync('npx', [
    'esbuild', join(here, from),
    '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error',
    `--alias:@=${join(root, 'src')}`,
  ]);
  return out;
};

const sql = read('docs/migrations/110_a_transfer_credit_is_a_credit.sql');
const route = read('src/app/api/academic/transfer-credit/route.ts');
const screen = read('src/components/academic/TransferCredits.tsx');
const gradRoute = read('src/app/api/academic/graduation/route.ts');
const gradScreen = read('src/components/academic/Graduation.tsx');
const records = read('src/components/academic/AcademicRecords.tsx');

const { TRANSFER_STATUS, transferStatusLabel, transferCounts } =
  await import(bundle('transfercredit.mjs', 'transferCredit.ts'));
const { assessGraduation } = await import(bundle('grad-tc.mjs', 'graduation.ts'));
const { can } = await import(bundle('roles-tc.mjs', 'roles.ts'));

const award = {
  id: 'a', code: 'BTH', title: 'Bachelor of Theology', kind: 'degree',
  creditsRequired: 180, minCgpa: 2.0, cgpaConfirmed: true,
};
const base = {
  award, cgpa: 3.0, outstandingConditions: [], feeBalance: null, status: 'enrolled',
};

// ---------------------------------------------------------------------------
console.log('\nTransfer credit counts toward the award\n');

// THE GAP THAT EXISTED FOR A YEAR: 019 could accept a credit and the degree
// was still refused, because nothing joined the two.
const short = assessGraduation({ ...base, creditsEarned: 150 });
check('150 of 180 at ICOF alone does not qualify',
  short.checks.find((c) => c.id === 'credits').state, 'unmet');

const withTransfer = assessGraduation({ ...base, creditsEarned: 150, creditsTransferred: 30 });
check('…and 150 at ICOF with 30 transferred does',
  withTransfer.checks.find((c) => c.id === 'credits').state, 'met');

// AND THE ANSWER SHOWS ITS WORKING, which is the ruling drawn rather than
// described. A registrar signing a degree is entitled to know how much of it
// this University taught.
check('…saying how much of it ICOF taught',
  withTransfer.checks.find((c) => c.id === 'credits').found,
  '180 toward the award — 150 earned at ICOF and 30 transferred');

// WITH NONE, THE SENTENCE DOES NOT MENTION IT. A line reading "150 toward the
// award — 150 earned at ICOF and 0 transferred" on every ordinary student is
// noise that teaches people to stop reading it.
check('…and says nothing of transfers where there are none',
  assessGraduation({ ...base, creditsEarned: 150 })
    .checks.find((c) => c.id === 'credits').found,
  '150 earned');

// A CALLER THAT HAS NOT BEEN TAUGHT ABOUT TRANSFER CREDIT reports the ICOF
// figure rather than a wrong total — the field is optional for that reason.
check('an untaught caller is not given an inflated total',
  assessGraduation({ ...base, creditsEarned: 150 })
    .checks.find((c) => c.id === 'credits').state, 'unmet');

// AND A NEGATIVE CANNOT TAKE CREDITS AWAY.
check('a negative transferred figure cannot reduce the total',
  assessGraduation({ ...base, creditsEarned: 180, creditsTransferred: -50 })
    .checks.find((c) => c.id === 'credits').state, 'met');

// ---------------------------------------------------------------------------
console.log('\nAnd never toward the GPA\n');

// THE MIGRATION ASSERTS THIS AGAINST THE CATALOGUE rather than trusting it:
// "nothing reads that" is a sentence that stops being true.
check('110 refuses to land if anything that scores reads the table',
  /prosrc ilike '%transfer_credits%'[\s\S]{0,200}grade_point/.test(sql), true);
check('…and the two figures are summed in the record, not merged',
  /as credits_transferred/.test(sql) && /as credits_total/.test(sql), true);
check('…while `credits_earned` keeps its old expression exactly',
  /coalesce\(prog\.credits_earned, 0\)\s*as credits_earned/.test(sql), true);

// THE CGPA IS NOT AN INPUT TO THE CREDIT CHECK AND THE CREDITS ARE NOT AN
// INPUT TO THE CGPA CHECK. Proved by moving one and watching the other hold.
const heavyTransfer = assessGraduation({
  ...base, cgpa: 1.0, creditsEarned: 0, creditsTransferred: 180,
});
check('180 transferred credits meet the credit requirement',
  heavyTransfer.checks.find((c) => c.id === 'credits').state, 'met');
check('…and do not rescue a CGPA of 1.0',
  heavyTransfer.checks.find((c) => c.id === 'cgpa').state, 'unmet');

// ---------------------------------------------------------------------------
console.log('\nThe two figures never merge, on any screen that shows them\n');

check('the record screen asks for both',
  /credits_transferred, credits_total/.test(records), true);
check('…and prints the split beside the total',
  /at ICOF, \$\{transferred\} transferred/.test(records), true);
check('the graduation list merges the figure in rather than re-summing it',
  /credits_transferred/.test(gradScreen) && /transferred\.get\(c\.student_id\)/.test(gradScreen),
  true);
check('…and passes it to the assessment, so the list cannot call a transfer '
  + 'student short of a degree it says they qualify for',
  /creditsTransferred: Number\(c\.credits_transferred/.test(gradScreen), true);
check('the conferral route reads it from the authoritative record',
  /from\('student_academic_record'\)[\s\S]{0,120}credits_transferred/.test(gradRoute), true);

// ---------------------------------------------------------------------------
console.log('\nThe screen and the migration know the same states\n');

// READ OUT OF THE CHECK CONSTRAINT. A list written twice is two lists, and
// the ladder belongs to the database because five offices can write to the
// table and a rule in one screen is a rule the other four do not have.
const constraint = /transfer_credits_status_check[\s\S]*?check \(status in \(([\s\S]*?)\)\)/
  .exec(sql);
check('110 states the states', Boolean(constraint), true);
const fromSql = [...(constraint ? constraint[1] : '').matchAll(/'([a-z_]+)'/g)]
  .map((m) => m[1]).sort();
check('…and the screen knows exactly those', Object.keys(TRANSFER_STATUS).sort(), fromSql);

check('only an accepted credit counts', fromSql.filter((s) => transferCounts(s)), ['accepted']);
check('a state nobody taught it shows as itself, not as a blank',
  transferStatusLabel('invented_in_2028'), 'invented_in_2028');

// THE PATH IS THE DATABASE'S AND THE ROUTE DOES NOT RESTATE IT. A second
// description of the ladder is a second ladder.
check('the path is a trigger, not a list in the route',
  /a_transfer_credit_follows_its_path/.test(sql), true);
check('…and the route reports the database’s own refusal',
  /error: 'refused'[\s\S]{0,80}error\.message/.test(route)
  || /return bad\('refused', 409, error\.message\)/.test(route), true);

// AND ACCEPTING SKIPS NOTHING. Proved in SQL by breaking it; asserted here so
// that removing the proof is a failing test rather than a quiet loss.
check('110 watches an unreviewed claim be refused acceptance',
  /cannot go from submitted to accepted/.test(sql), true);
check('…and a refusal with no reason be refused',
  /transfer_credits_reason_check/.test(sql), true);
check('…and more credits accepted than were offered be refused',
  /transfer_credits_not_more_check/.test(sql), true);

// ---------------------------------------------------------------------------
console.log('\nRecording and deciding are two acts\n');

check('the route guards them on different capabilities',
  /record: RECORD/.test(route) && /accept: DECIDE/.test(route), true);

// THE ONE THAT MATTERS. Two names one role holds is one name in a disguise.
check('the Faculty Dean decides', can('dean', 'approve-transfers'), true);
check('…and does not record', can('dean', 'record-transfer-credit'), false);
check('the Registrar records', can('registrar', 'record-transfer-credit'), true);
check('…and does not decide', can('registrar', 'approve-transfers'), false);

// THE ACADEMIC OFFICE HOLDS BOTH, deliberately and not by accident: it is the
// office that takes academic decisions in this system, and it held 019's
// write policy already.
check('the Academic Office holds both halves',
  [can('academic-office', 'record-transfer-credit'),
    can('academic-office', 'approve-transfers')],
  [true, true]);

// AND NOBODY ELSE HOLDS EITHER.
for (const role of ['lecturer', 'student', 'finance', 'hod', 'invigilator']) {
  check(`a ${role} holds neither`,
    [can(role, 'record-transfer-credit'), can(role, 'approve-transfers')],
    [false, false]);
}

// ---------------------------------------------------------------------------
console.log('\nAnd the cap the University has not set is not invented\n');

check('no cap is enforced anywhere in the migration',
  /refuse|reject|exception/.test(
    (/create view transfers_that_carry_most_of_the_award[\s\S]*?;/.exec(sql) ?? [''])[0],
  ), false);
check('the cases are listed instead',
  /transfers_that_carry_most_of_the_award/.test(sql), true);
// THE PHRASE ALONE, because the comment wraps it across two concatenated SQL
// string literals and a regex for the whole sentence matches the intention
// rather than the file.
check('…and the view says it is a question, not a rule',
  /NOT A BREACH/.test(sql), true);

// ---------------------------------------------------------------------------
console.log('\nThe screen says the thing that is easiest to get wrong\n');

check('that nothing counts until somebody decides',
  /counting for nothing until somebody decides/.test(screen)
  && /Nothing counts until an officer accepts it/.test(screen), true);
check('…and that an accepted credit never touches the GPA',
  /never toward the GPA/.test(screen), true);

// ---------------------------------------------------------------------------
console.log(failures === 0
  ? '\nAll good.\n'
  : `\n${failures} failure${failures === 1 ? '' : 's'}.\n`);
process.exit(failures === 0 ? 0 : 1);
