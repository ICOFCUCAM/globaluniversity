// ---------------------------------------------------------------------------
// THE COURSES A PROGRAMME PUBLISHES.
//
// Run with:  node src/content/programmeCourses.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS IS WORTH TESTING
// ---------------------------------------------------------------------------
//
// Because everything this returns is written onto a SEALED University document
// that cannot be corrected without reissuing it, and every way it can be wrong
// is quiet:
//
//   * a course under a title the University does not use — reads perfectly well
//   * a year or semester derived wrongly — puts a third-year course in year one
//   * an invented credit value where the University has published none
//   * a course list offered for a programme that has no published schedule
//
// None of those looks wrong on screen. The operator sees a filled table and
// assumes the University filled it.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
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

const dir = join(new URL('../../node_modules/.cache/icof', import.meta.url).pathname);
mkdirSync(dir, { recursive: true });
const outfile = join(dir, 'programmeCourses.mjs');
execFileSync('npx', [
  'esbuild', new URL('./programmeCourses.ts', import.meta.url).pathname,
  '--bundle', '--format=esm', '--platform=node', `--outfile=${outfile}`, '--log-level=error',
  '--main-fields=module,main',
  `--alias:@=${new URL('..', import.meta.url).pathname.replace(/\/$/, '')}`,
]);

const { coursesForProgramme, programmesWithCourses } = await import(outfile);

console.log('\nOnly what the University has published\n');

check('a programme with no published schedule returns nothing',
  coursesForProgramme('Doctor of Philosophy (Theology)'), null);
check('an empty programme returns nothing', coursesForProgramme(''), null);
check('an unknown programme returns nothing', coursesForProgramme('Bachelor of Astronomy'), null);
check('and the ones that do have a schedule are named',
  programmesWithCourses().sort(),
  ['Bachelor of Ministry', 'Bachelor of Theology', 'Diploma of Theology']);

console.log('\nThe Bachelor of Theology, as the University publishes it\n');

const bth = coursesForProgramme('Bachelor of Theology');
check('36 courses', bth.courses.length, 36);
check('180 ECTS in total',
  bth.courses.reduce((t, c) => t + (c.credits ?? 0), 0), 180);
check('every course carries a credit value',
  bth.courses.filter((c) => c.credits === null).length, 0);
check('three years', new Set(bth.courses.map((c) => c.year)).size, 3);
check('two semesters in each',
  [1, 2, 3].map((y) => new Set(bth.courses.filter((c) => c.year === y).map((c) => c.semester)).size),
  [2, 2, 2]);
check('six courses a semester',
  [...new Set(bth.courses.map((c) => `${c.year}.${c.semester}`))]
    .map((k) => bth.courses.filter((c) => `${c.year}.${c.semester}` === k).length),
  [6, 6, 6, 6, 6, 6]);

// THE ORDERING IS THE THING THAT GOES WRONG SILENTLY. If the year and semester
// were derived from the wrong index, a third-year course would land in year one
// and the transcript would read perfectly.
check('the first course is a Year One, Semester One course',
  [bth.courses[0].year, bth.courses[0].semester], [1, 1]);
check('and the last is Year Three, Semester Two',
  [bth.courses[35].year, bth.courses[35].semester], [3, 2]);
// BY TITLE, NOT BY CODE. These looked courses up as BTH101 and BTH312 — the
// numbering counted off within the programme — and the University has since
// ruled that a course carries its faculty code, so those strings no longer
// name anything. The course is the thing being placed; the code is what it is
// called this year.
check('the opening course is where the University puts it',
  (() => {
    const c = bth.courses.find((x) => x.title === 'Introduction to Biblical Studies');
    return [c.year, c.semester];
  })(),
  [1, 1]);
check('and the thesis is where the University puts it',
  (() => {
    const c = bth.courses.find((x) => x.title === 'Bachelor Thesis and Defense');
    return [c.year, c.semester];
  })(),
  [3, 2]);

check('no course code appears twice',
  new Set(bth.courses.map((c) => c.code)).size, bth.courses.length);
check('every course has a title',
  bth.courses.filter((c) => !c.title?.trim()).length, 0);
// THE SOURCE IS NAMED so a registrar can challenge it rather than trust it.
check('the source is stated', bth.source.length > 20, true);

console.log('\nWhere the University has published courses but not credits\n');

const dip = coursesForProgramme('Diploma of Theology');
check('the Diploma has a schedule', dip.courses.length > 0, true);
// A CREDIT VALUE NOBODY PUBLISHED IS LEFT NULL, never defaulted to a plausible
// number. Filling 3 here would seal an invented figure onto the transcript.
check('its credits are null rather than invented',
  dip.courses.every((c) => c.credits === null), true);
check('and the schedule says so', dip.creditsUnstated, true);
check('it is one year', new Set(dip.courses.map((c) => c.year)), new Set([1]));

console.log('\nThe Bachelor of Ministry\n');

const bmin = coursesForProgramme('Bachelor of Ministry');
check('it has a schedule', bmin.courses.length > 0, true);
check('every course has a code and a title',
  bmin.courses.filter((c) => !c.code?.trim() || !c.title?.trim()).length, 0);
check('no code appears twice',
  new Set(bmin.courses.map((c) => c.code)).size, bmin.courses.length);
check('every year is 1, 2 or 3',
  [...new Set(bmin.courses.map((c) => c.year))].sort(), [1, 2, 3]);
check('every semester is 1 or 2',
  [...new Set(bmin.courses.map((c) => c.semester))].sort(), [1, 2]);

process.exit(failures === 0 ? 0 : 1);
