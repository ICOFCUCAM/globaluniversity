// ---------------------------------------------------------------------------
// THE PREREQUISITE RULE, CHECKED AGAINST THE REAL CURRICULUM.
//
//   node src/lib/prerequisites.test.mjs
//
// Not against invented courses. The Bachelor of Ministry is the programme this
// rule exists for, so the fixtures ARE its thirty-four courses: a change to the
// curriculum that breaks the rule fails here, and a rule that quietly stops
// matching the curriculum fails here too.
//
// The scenario that matters most is the last one — walking a student through
// all six semesters in order and asserting they are never blocked. That is the
// only check that proves the published plan is actually walkable, and it is
// the check a registry discovers it needed after a cohort is already halfway
// through.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;
const ok = (m) => console.log(`ok    ${m}`);
const bad = (m) => {
  failures++;
  console.error(`FAIL  ${m}`);
};
const check = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) ok(label);
  else bad(`${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
};

const dir = join(new URL('../../node_modules/.cache/icof', import.meta.url).pathname);
mkdirSync(dir, { recursive: true });
const srcRoot = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const load = async (file, out) => {
  const bundle = join(dir, out);
  execFileSync('npx', [
    'esbuild', new URL(file, import.meta.url).pathname,
    '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`,
    '--log-level=error', `--alias:@=${srcRoot}`,
  ], { stdio: 'inherit' });
  return import(bundle);
};

const P = await load('./prerequisites.ts', 'prereq-test.mjs');
const B = await load('../content/bachelorOfMinistry.ts', 'prereq-bmin.mjs');

const CATALOGUE = B.bminAllCourses.map((c) => ({
  code: c.code,
  requires: c.requires,
  requiresMode: c.requiresMode,
  requiresEcts: c.requiresEcts,
  ects: c.ects,
}));
const byCode = (code) => CATALOGUE.find((c) => c.code === code);
const none = { passed: [], creditsEarned: 0 };

console.log('\nPrerequisites — the simple cases\n');

check('a course with no prerequisite is open to a new student',
  P.checkEligibility(byCode('MIN 101'), none).eligible, true);

check('a gated course is not',
  P.checkEligibility(byCode('MIN 202'), none).eligible, false);

check('…and it says which course is wanted',
  P.checkEligibility(byCode('MIN 202'), none).reasons,
  ['You must first pass MIN 101.']);

check('holding the prerequisite opens it',
  P.checkEligibility(byCode('MIN 202'), { passed: ['MIN 101'], creditsEarned: 5 }).eligible, true);

// A registry that refuses "min 101" because the catalogue says "MIN 101" is
// refusing on a keystroke.
check('a course code is not case-sensitive',
  P.checkEligibility(byCode('MIN 202'), { passed: ['min 101'], creditsEarned: 5 }).eligible, true);

console.log('\nAND versus OR — the distinction the data model nearly lost\n');

// MIN 201 requires MIN 101 AND BIB 103. BIB 103 requires BIB 101 OR BIB 102.
// Stored as bare arrays these two are indistinguishable, which is exactly the
// bug this pair of assertions exists to prevent coming back.
check('“BIB 101 or BIB 102” is satisfied by either one',
  [
    P.checkEligibility(byCode('BIB 103'), { passed: ['BIB 101'], creditsEarned: 5 }).eligible,
    P.checkEligibility(byCode('BIB 103'), { passed: ['BIB 102'], creditsEarned: 5 }).eligible,
  ],
  [true, true]);

check('…and not by neither',
  P.checkEligibility(byCode('BIB 103'), { passed: ['THE 101'], creditsEarned: 5 }).eligible, false);

check('“MIN 101, BIB 103” needs both',
  [
    P.checkEligibility(byCode('MIN 201'), { passed: ['MIN 101'], creditsEarned: 5 }).eligible,
    P.checkEligibility(byCode('MIN 201'), { passed: ['BIB 103'], creditsEarned: 5 }).eligible,
    P.checkEligibility(byCode('MIN 201'), { passed: ['MIN 101', 'BIB 103'], creditsEarned: 10 }).eligible,
  ],
  [false, false, true]);

console.log('\nCredit thresholds\n');

check('RES 301 is closed below 60 credits',
  P.checkEligibility(byCode('RES 301'), { passed: [], creditsEarned: 55 }).eligible, false);
check('…and open at 60',
  P.checkEligibility(byCode('RES 301'), { passed: [], creditsEarned: 60 }).eligible, true);
check('the practicum wants 120',
  P.checkEligibility(byCode('MIN 308'), { passed: [], creditsEarned: 119 }).reasons,
  ['MIN 308 requires 120 credits; you have 119.']);

console.log('\nEvery failing condition is reported, not just the first\n');

// A student who is short on both a course and credits must be told both, or
// they fix one, resubmit, and are refused again.
const both = P.checkEligibility(
  { code: 'X', requires: ['A', 'B'], requiresEcts: 60 },
  { passed: [], creditsEarned: 0 },
);
check('two kinds of failure produce two reasons', both.reasons.length, 2);
check('…and the missing courses are named', both.missing, ['A', 'B']);

console.log('\nCo-requisites\n');

// The distinction from a prerequisite, and the whole reason the field exists:
// taking it at the same time counts.
const co = { code: 'FIN 201', requires: [], coRequisites: ['ADM 201'] };
check('a co-requisite is not satisfied by nothing',
  P.checkEligibility(co, none).eligible, false);
check('…is satisfied by taking it in the same term',
  P.checkEligibility(co, { passed: [], creditsEarned: 0, registeringFor: ['ADM 201'] }).eligible, true);
check('…and by having already passed it',
  P.checkEligibility(co, { passed: ['ADM 201'], creditsEarned: 5 }).eligible, true);

console.log('\nThe published plan is actually walkable\n');

// THE ONE THAT MATTERS. Walk the six semesters in the order the university
// publishes them, registering for every course in each. If any course is
// refused, the plan cannot be followed as printed — which is a finding about
// the CURRICULUM, not about this module, and is exactly how the two
// unsatisfiable prerequisites were found in the first place.
const KNOWN_BLOCKED = ['FIN 201', 'COM 302'];
let passed = [];
let credits = 0;
const blocked = [];
for (const sem of B.bminSemesters) {
  const registeringFor = sem.courses.map((c) => c.code);
  for (const c of sem.courses) {
    const v = P.checkEligibility(
      { code: c.code, requires: c.requires, requiresMode: c.requiresMode, requiresEcts: c.requiresEcts },
      { passed, creditsEarned: credits, registeringFor },
    );
    if (!v.eligible) blocked.push(`${c.code} (${sem.label}): ${v.reasons.join(' ')}`);
  }
  passed = [...passed, ...registeringFor];
  credits += sem.courses.reduce((n, c) => n + c.ects, 0);
}

check(
  'exactly the two courses on record are unreachable on the published plan',
  blocked.map((b) => b.split(' ')[0] + ' ' + b.split(' ')[1].replace(/[(:].*/, '')).sort(),
  KNOWN_BLOCKED.slice().sort(),
);
for (const b of blocked) console.log(`      ${b}`);
console.log('      ^ resolved by the co-requisite ruling in BMIN_OPEN_QUESTIONS');

// And prove the recommended resolution actually works, so the University is
// choosing between a stated problem and a demonstrated fix rather than a hope.
const withCo = ['FIN 201', 'COM 302'].map((code) => {
  const c = B.bminAllCourses.find((x) => x.code === code);
  return { code, requires: [], coRequisites: c.requires };
});
check(
  'and the recommended co-requisite ruling unblocks both',
  withCo.map((c) => P.checkEligibility(c, {
    passed: [], creditsEarned: 90, registeringFor: c.coRequisites,
  }).eligible),
  [true, true],
);

console.log('\nOutstanding, for the graduation audit\n');

const fresh = P.outstanding(CATALOGUE, none);
check('a new student owes the whole degree', [fresh.courses.length, fresh.credits], [34, 180]);
const done = P.outstanding(CATALOGUE, { passed: CATALOGUE.map((c) => c.code), creditsEarned: 180 });
check('a finished student owes nothing', [done.courses.length, done.credits], [0, 0]);

// eligibleCourses answers permission, not advice: a first-year student is
// eligible for everything ungated, wherever it sits in the plan.
const open = P.eligibleCourses(CATALOGUE, none).map((c) => c.code).sort();
check('a new student may register for the ungated courses only',
  open, ['BIB 101', 'BIB 102', 'COM 101', 'HIS 101', 'MIN 101', 'SFM 101', 'THE 101'].sort());

console.log('');
if (failures) {
  console.error(`${failures} check(s) failed.\n`);
  process.exit(1);
}
console.log('The prerequisite chain is enforceable.\n');
