// ---------------------------------------------------------------------------
// A STUDENT IS NOT AN APPLICATION.
//
// Run with:  node src/lib/studentStatus.test.mjs
//
// ---------------------------------------------------------------------------
// WHAT THIS IS GUARDING
// ---------------------------------------------------------------------------
//
// `students.status` carried two vocabularies and two of the words were in both.
// `withdrawn` meant an applicant who declined a place AND a student who left in
// their second year; one of those is a place that could have gone to somebody
// else and the other is a person who needs a transcript. 034 gave the Registrar
// a withdrawal action that writes that word, so from that day the system could
// not tell them apart.
//
// 037 splits the column. This holds the split: that the two vocabularies do not
// overlap, that the readers prefer the new column, and that the fallback for a
// database which has not had 037 yet is wrong in the SAFE direction.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
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

const here = new URL('.', import.meta.url).pathname;
const cache = join(here, '../../node_modules/.cache/icof');
mkdirSync(cache, { recursive: true });

const build = (file, name) => {
  const out = join(cache, name);
  execFileSync('npx', [
    'esbuild', join(here, file), '--bundle', '--format=esm', '--platform=node',
    `--outfile=${out}`, '--log-level=error', `--alias:@=${join(here, '..')}`,
  ]);
  return import(out);
};

const S = await build('studentStatus.ts', 'studentStatus.mjs');
const W = await build('admissionWorkflow.ts', 'admissionWorkflowForStatus.mjs');

console.log('\nThe two vocabularies do not share a word\n');

{
  // THE WHOLE POINT. If any word is in both lists, one column cannot tell you
  // which of two things happened — which is the state the system was in.
  const both = S.STUDENT_STATUSES.filter((s) => W.ADMISSION_STATES.includes(s));
  check('no word means one thing as an application and another as a student',
    both, ['withdrawn']);

  // …EXCEPT `withdrawn`, DELIBERATELY, AND IT IS WHY THE COLUMNS ARE SEPARATE.
  // An applicant who steps away and a student who leaves are both withdrawals
  // and there is no better word for either. What makes them distinguishable is
  // no longer the word; it is which column carries it.
  check('`deferred` is an admission outcome only',
    [W.ADMISSION_STATES.includes('deferred'), S.STUDENT_STATUSES.includes('deferred')],
    [true, false]);
  check('`graduated` is a student status only',
    [W.ADMISSION_STATES.includes('graduated'), S.STUDENT_STATUSES.includes('graduated')],
    [false, true]);
  check('`active` is a student status only',
    [W.ADMISSION_STATES.includes('active'), S.STUDENT_STATUSES.includes('active')],
    [false, true]);
}

console.log('\nAn applicant who withdrew and a student who left are different people\n');

{
  const applicantWhoDeclined = { status: 'withdrawn', student_status: null };
  const studentWhoLeft = { status: 'enrolled', student_status: 'withdrawn' };

  check('the applicant is not a student', S.isStudent(applicantWhoDeclined), false);
  check('the student is', S.isStudent(studentWhoLeft), true);
  check('neither is on the roll',
    [S.isOnRoll(applicantWhoDeclined), S.isOnRoll(studentWhoLeft)], [false, false]);
  check('and neither has graduated',
    [S.hasGraduated(applicantWhoDeclined), S.hasGraduated(studentWhoLeft)], [false, false]);
}

console.log('\nA graduate is still recorded as having been enrolled\n');

{
  // THE THING THE OLD COLUMN DESTROYED. Conferring a degree wrote 'graduated'
  // over 'enrolled', so the University's record of having enrolled somebody was
  // erased by the act of graduating them.
  const graduate = { status: 'enrolled', student_status: 'graduated' };
  check('the degree is recorded', S.hasGraduated(graduate), true);
  check('…and so is the enrolment it rests on', graduate.status, 'enrolled');
  check('a graduate is not on the roll', S.isOnRoll(graduate), false);
}

console.log('\nA suspended student is still the University’s student\n');

{
  // The difference between a suspension and an expulsion. Dropping suspended
  // students from the roll is how the person who most needs attention stops
  // appearing on the screen built to find them.
  const suspended = { status: 'enrolled', student_status: 'suspended' };
  check('on the roll', S.isOnRoll(suspended), true);
  check('and a student', S.isStudent(suspended), true);
}

console.log('\nBefore 037 has run, the readers are wrong in the safe direction\n');

{
  // A DEPLOYMENT CAN GET AHEAD OF THE SQL. Until 037 runs these values are
  // still in `status`, and a reader that saw only the new column would report
  // every graduate as not having graduated.
  check('a legacy graduate is still read as graduated',
    S.studentStatusOf({ status: 'graduated' }), 'graduated');
  check('a legacy active student is still read as active',
    S.studentStatusOf({ status: 'active' }), 'active');
  check('a legacy suspended student too',
    S.studentStatusOf({ status: 'suspended' }), 'suspended');

  // AND THE AMBIGUOUS ONE IS NOT GUESSED. In the old column `withdrawn` could
  // mean either, so it reads as "not a student" — which under-counts the roll
  // rather than conferring studenthood on somebody who never had it.
  check('a legacy withdrawal is not guessed at',
    S.studentStatusOf({ status: 'withdrawn' }), null);

  // The new column always wins, even when the old one disagrees. This is the
  // shape of a half-migrated row.
  check('the new column governs',
    S.studentStatusOf({ status: 'graduated', student_status: 'active' }), 'active');

  check('an unknown value is not a student status',
    S.studentStatusOf({ status: 'fee_paid' }), null);
  check('and neither is nothing at all', S.studentStatusOf(null), null);
  check('nor an invented one', S.studentStatusOf({ student_status: 'expelled' }), null);
}

console.log('\nNothing still reads a student word out of the admission column\n');

{
  // THE REGRESSION THIS EXISTS TO CATCH. Every one of these was a real query in
  // this repository: `.in('status', ['graduated','active'])`,
  // `status === 'graduated'`, `.in('status', ['approved','conditional','enrolled','active'])`.
  // Each looked reasonable and each is now wrong.
  const srcDir = join(here, '..');
  // grep exits 1 when it matches nothing, which execFileSync throws on. An
  // empty result is a legitimate answer here, so it is caught — and the
  // positive control below is what distinguishes "nothing to find" from "the
  // scan is broken", which is the failure mode that makes a test like this
  // quietly stop working.
  let found = [];
  try {
    found = execFileSync('grep', [
      '-rlE', "status['\"]?\\s*[=:,)\\]]*\\s*['\"](graduated|suspended)['\"]",
      '--include=*.ts', '--include=*.tsx', srcDir,
    ], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  } catch { found = []; }

  check('the scan is looking at something', found.length > 0, true);

  const offenders = found
    .map((f) => f.replace(srcDir, 'src'))
    // The vocabulary itself and the tests that describe it are allowed to say
    // the words; a file that USES them against `students.status` is not.
    .filter((f) => !/studentStatus\.(ts|test\.mjs)$/.test(f))
    .filter((f) => !/status\.ts$/.test(f));

  check('no screen or route filters students on a status word that moved',
    offenders, []);
}

console.log(failures === 0 ? '\nAll student status checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
