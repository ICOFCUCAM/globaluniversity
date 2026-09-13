// ---------------------------------------------------------------------------
// Grading — the one part of this system that must not be wrong.
//
// Run with:  node src/lib/grading.test.mjs
//
// There is no test runner configured in this project, and adding one is a
// larger decision than this file. It is a plain script that exits non-zero on
// failure, so it works today and drops straight into whatever runner is chosen
// later.
//
// WHY THIS FILE EXISTS. The portal spent its whole life grading students on a
// scale the university does not use — A at 70, pass at 40, points out of 5.00,
// against a published scale of A at 94, pass at 65, points out of 4.00. Nobody
// noticed because nothing checked. The scale is now derived from
// content/regulations.ts, and these assertions are what will notice if it
// drifts again: they are written against the published document, not against
// the implementation, so a change to the code that contradicts the regulations
// fails here rather than on a student's transcript.
//
// The bands are duplicated deliberately. A test that imports the same constant
// the code imports proves only that a file can be read.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

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

// --- The published scale, typed out from the university's document. ---------
// grade, min, max, points
//
// VERSION 2, the American four-point scale, which the University has adopted
// and applied to past transcripts as well as future ones. Version 1 is asserted
// separately below: it has to still be in the file, and it has to not be the
// one anything computes on.
const PUBLISHED = [
  ['A',  93, 100, 4.00],
  ['A-', 90, 92,  3.70],
  ['B+', 87, 89,  3.30],
  ['B',  83, 86,  3.00],
  ['B-', 80, 82,  2.70],
  ['C+', 77, 79,  2.30],
  ['C',  73, 76,  2.00],
  ['C-', 70, 72,  1.70],
  ['D+', 67, 69,  1.30],
  ['D',  65, 66,  1.00],
  ['F',   0, 64,  0.00],
];

// --- Read the scale the code will actually use. -----------------------------
const reg = readFileSync(new URL('../content/regulations.ts', import.meta.url), 'utf8');

/**
 * ONE NAMED EXPORT, NOT EVERY BAND IN THE FILE.
 *
 * This used to scan the whole file, which worked for exactly as long as there
 * was one scale in it. The moment version 1 was kept alongside version 2 the
 * scan returned twenty-two bands, two grades called A, and marks landing in two
 * bands at once — and it reported that as the scale being broken rather than as
 * the test looking in the wrong place. A test that cannot tell "the file has a
 * second scale in it" from "the scale is wrong" is worse than no test.
 */
function scaleNamed(name) {
  const head = `export const ${name}: GradeBand[] = [`;
  const from = reg.indexOf(head);
  if (from < 0) throw new Error(`regulations.ts has no ${name}`);
  const body = reg.slice(from + head.length, reg.indexOf('];', from));
  return [...body.matchAll(/grade: '([^']+)',\s*descriptor: '[^']*',\s*range: '([^']+)',\s*points: '([^']+)'/g)]
    .map(([, grade, range, points]) => {
      const [min, max] = range.replace('%', '').split(/[–-]/).map((n) => Number(n.trim()));
      return [grade, min, max, Number(points)];
    });
}

const bands = scaleNamed('gradeScale');

check('regulations.ts holds all eleven published bands', bands.length, PUBLISHED.length);
for (let i = 0; i < PUBLISHED.length; i++) {
  check(`band ${PUBLISHED[i][0]} matches the published document`, bands[i], PUBLISHED[i]);
}

// --- The pass mark. ---------------------------------------------------------
const passMark = Number(/export const passMark = '(\d+)%'/.exec(reg)?.[1]);
check('pass mark is 65', passMark, 65);

// The band below the pass mark must be F, and the band at it must not be.
// This is the assertion that would have caught the original fault: on the old
// scale 50 was a C.
const bandFor = (score) => bands.find(([, min, max]) => score >= min && score <= max)?.[0];
check('50% is a fail under the published scale', bandFor(50), 'F');
check('64% is a fail', bandFor(64), 'F');
check('65% is the lowest pass', bandFor(65), 'D');
check('93% is an A', bandFor(93), 'A');
check('100% is an A', bandFor(100), 'A');

// THE ONE THING VERSION 2 MUST NOT HAVE DONE. The American scale conventionally
// runs D- down to 60 and passes there. Adopting that would have turned every
// mark from 60 to 64 into a pass on every transcript the University has issued,
// retroactively — credit it never awarded, and possibly degrees it never
// conferred. The University asked for the points to be less harsh, not for the
// pass line to move, so 60 stays a fail and there is no D-.
check('60% is still a fail', bandFor(60), 'F');
check('there is no D- band', bands.some(([g]) => g === 'D-'), false);

console.log('\nVersion 1 is kept, and is not what anything computes on\n');

// A figure computed under version 1 is printed on documents the University has
// already sealed. Deleting the scale that produced them would leave nobody able
// to explain a 3.14 that recomputes to 3.40.
{
  const v1 = scaleNamed('gradeScaleV1');
  check('version 1 is still in the file', v1.length, 11);
  check('…and it is the old scale, unaltered', v1[1], ['A-', 91, 93, 3.33]);
  check('…while the scale in force is version 2', bands[1], ['A-', 90, 92, 3.70]);
  check('the version in force is declared',
    Number(/export const gradeScaleVersion = (\d+)/.exec(reg)?.[1]), 2);

  // grading.ts is what every GPA, classification and transcript is computed
  // from. It must read the active scale and must not have been pointed at the
  // superseded one.
  const g = readFileSync(new URL('./grading.ts', import.meta.url), 'utf8');
  check('grading.ts does not compute on the superseded scale', /gradeScaleV1/.test(g), false);
}

console.log('\nThe classification bands moved with the scale\n');

// ---------------------------------------------------------------------------
// THE TRAP THIS CLOSES. Lifting A- from 3.33 to 3.70 without lifting the First
// Class boundary would have left First Class sitting at 3.33 — which on the new
// scale is between B+ and B, not an A- at all. The University would have gone
// on printing "First Class Honours: an A- average or above" while awarding it
// for a B+ average. Nobody edits a number in one file and remembers a number in
// another, so the boundaries are checked against the letters they claim.
// ---------------------------------------------------------------------------
{
  const from = reg.indexOf('export const classificationBands');
  const body = reg.slice(from, reg.indexOf('];', from));
  const claimed = [...body.matchAll(/min: ([\d.]+), label: '([^']+)', basis: '(?:an?|the) ([A-F][+-]?)/g)]
    .map(([, min, label, letter]) => ({ min: Number(min), label, letter }));

  check('every band states the letter it stands for', claimed.length, 5);

  const pointsFor = (letter) => bands.find(([g]) => g === letter)?.[3];
  const wrong = claimed.filter((b) => pointsFor(b.letter) !== b.min)
    .map((b) => `${b.label} claims ${b.letter} but sits at ${b.min}`);
  check('each boundary is the grade point of the letter it names', wrong, []);

  check('First Class is an A- average', claimed[0].min, 3.70);
  check('Second Class Upper is a B average', claimed[1].min, 3.00);
}

// --- Every mark from 0 to 100 lands in exactly one band. --------------------
// Off-by-one gaps between bands are the classic grading bug: a scale reading
// 91–93 and 89–90 leaves nothing at all for a student who scored exactly 90.5,
// and a scale that overlaps awards two different grades for one mark.
const unmatched = [];
const multiple = [];
for (let score = 0; score <= 100; score++) {
  const hits = bands.filter(([, min, max]) => score >= min && score <= max);
  if (hits.length === 0) unmatched.push(score);
  if (hits.length > 1) multiple.push(score);
}
check('every whole mark 0–100 falls in a band', unmatched, []);
check('no mark falls in two bands', multiple, []);

// --- Grade points are on a 4.00 scale, not 5.00. ---------------------------
const maxPoints = Math.max(...bands.map((b) => b[3]));
check('the highest grade point is 4.00', maxPoints, 4);

// --- The code has not reintroduced the old scale. ---------------------------
const grading = readFileSync(new URL('./grading.ts', import.meta.url), 'utf8');
check(
  'grading.ts does not hardcode a grading scale of its own',
  /minScore:\s*70|gradePoint:\s*5\.0/.test(grading),
  false,
);
check(
  'grading.ts derives its scale from the published regulations',
  grading.includes("from '@/content/regulations'"),
  true,
);

console.log(failures === 0 ? '\nAll grading checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
