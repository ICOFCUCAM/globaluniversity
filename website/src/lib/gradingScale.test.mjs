// ---------------------------------------------------------------------------
// THE GRADING SCALE, WHEN IT COMES FROM THE DATABASE.
//
// Run with:  node src/lib/gradingScale.test.mjs
//
// ---------------------------------------------------------------------------
// THE FAILURE THIS IS HUNTING
// ---------------------------------------------------------------------------
//
// A stored scale produces plausible grades whatever is wrong with it. Bands in
// the wrong order, a missing band, a pass mark from a different institution —
// every one of them yields a letter and a number that look like a grade, get
// written to a transcript, and are sealed. Nothing downstream can tell.
//
// So the cases below are the malformed ones, and the rule throughout is that a
// scale which cannot be trusted falls back to the University\u2019s published
// regulations rather than grading anybody under it.
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
const outfile = join(dir, 'gradingScale.mjs');
execFileSync('npx', [
  'esbuild', new URL('./gradingScale.ts', import.meta.url).pathname,
  '--bundle', '--format=esm', '--platform=node', `--outfile=${outfile}`, '--log-level=error',
  '--main-fields=module,main',
  `--alias:@=${new URL('..', import.meta.url).pathname.replace(/\/$/, '')}`,
]);

const {
  scaleFromRow, gradeFor, passes, divergesFromPublished, PUBLISHED_SCALE,
} = await import(outfile);

console.log('\nFalling back rather than grading badly\n');

check('no row falls back to the published regulations',
  scaleFromRow(null).isFallback, true);
check('a row with no bands falls back',
  scaleFromRow({ name: 'Broken', bands: [] }).isFallback, true);
check('a row whose bands are not an array falls back',
  scaleFromRow({ name: 'Broken', bands: 'A=4' }).isFallback, true);
// A BAND WITH NO LETTER IS NOT A BAND. All of them nameless means no scale.
check('bands with no grade letters fall back',
  scaleFromRow({ bands: [{ points: 4, min: 90, max: 100 }] }).isFallback, true);

console.log('\nA scale the University has published\n');

const stored = scaleFromRow({
  name: 'Doctoral scale',
  pass_mark: 70,
  max_point: 4,
  // DELIBERATELY OUT OF ORDER. A scale stored ascending, which is how somebody
  // typing a table naturally writes one, must not grade every mark as the
  // lowest band it fits.
  bands: [
    { grade: 'F', points: 0, min: 0, max: 69, descriptor: 'Fail' },
    { grade: 'B', points: 3, min: 70, max: 84, descriptor: 'Good' },
    { grade: 'A', points: 4, min: 85, max: 100, descriptor: 'Excellent' },
  ],
});

check('a stored scale is not a fallback', stored.isFallback, false);
check('it keeps its own name', stored.name, 'Doctoral scale');
check('and its own pass mark', stored.passMark, 70);
check('bands are sorted highest first regardless of how they were stored',
  stored.bands.map((b) => b.grade), ['A', 'B', 'F']);

check('a mark at the top of a band grades correctly', gradeFor(stored, 100).grade, 'A');
check('a mark at the bottom of a band grades correctly', gradeFor(stored, 85).grade, 'A');
check('one mark below the boundary drops a band', gradeFor(stored, 84).grade, 'B');
check('a failing mark grades as failing', gradeFor(stored, 69).grade, 'F');
check('a mark outside every band grades as nothing rather than guessing',
  gradeFor(stored, 101), null);

console.log('\nThe pass mark is the scale\u2019s own\n');

// THE FAULT THIS PREVENTS: a student passing on one screen and failing on
// another, because one compared against the published 65 and the other against
// the scale\u2019s 70.
check('70 passes under a scale whose pass mark is 70', passes(stored, 70), true);
check('69 does not', passes(stored, 69), false);
check('and 65 does not, even though the published mark is 65',
  passes(stored, 65), false);
check('while 65 does pass under the published scale',
  passes(PUBLISHED_SCALE, 65), true);

console.log('\nSaying when two sources disagree\n');

check('the published scale never disagrees with itself',
  divergesFromPublished(PUBLISHED_SCALE), []);
{
  const differences = divergesFromPublished(stored);
  check('a different pass mark is reported',
    differences.some((d) => d.includes('pass mark')), true);
  check('a missing published grade is reported',
    differences.some((d) => d.includes('A-')), true);
  // NAMED, NOT COUNTED. "3 differences" tells a registrar nothing they can act
  // on; the sentence tells them which band to look at.
  check('and every difference is a sentence rather than a count',
    differences.every((d) => d.length > 20), true);
}

process.exit(failures === 0 ? 0 : 1);
