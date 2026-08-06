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
const PUBLISHED = [
  ['A',  94, 100, 4.00],
  ['A-', 91, 93,  3.33],
  ['B+', 89, 90,  3.00],
  ['B',  85, 88,  2.67],
  ['B-', 81, 84,  2.33],
  ['C+', 77, 80,  2.00],
  ['C',  73, 76,  1.67],
  ['C-', 70, 72,  1.33],
  ['D+', 67, 69,  1.00],
  ['D',  65, 66,  0.67],
  ['F',   0, 64,  0.00],
];

// --- Read the scale the code will actually use. -----------------------------
const reg = readFileSync(new URL('../content/regulations.ts', import.meta.url), 'utf8');
const bands = [...reg.matchAll(/grade: '([^']+)',\s*descriptor: '[^']*',\s*range: '([^']+)',\s*points: '([^']+)'/g)]
  .map(([, grade, range, points]) => {
    const [min, max] = range.replace('%', '').split(/[–-]/).map((n) => Number(n.trim()));
    return [grade, min, max, Number(points)];
  });

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
check('94% is an A', bandFor(94), 'A');
check('100% is an A', bandFor(100), 'A');

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
