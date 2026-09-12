// ---------------------------------------------------------------------------
// CROPPING A SIGNATURE TO ITS INK.
//
// Run with:  node src/lib/signatureInk.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THE ARITHMETIC IS TESTED AND NOT THE PAD
// ---------------------------------------------------------------------------
//
// Drawing on a canvas cannot go quietly wrong: either strokes appear under the
// pointer or they do not, and anybody using it sees which. The crop can. An
// off-by-one clips the tail of a signature, and it clips it identically every
// time, so it looks deliberate — the person who finds out is a graduate holding
// a certificate with the end of the Registrar's name shaved off.
//
// Every case here is a picture written out by hand, so the expected rectangle
// can be read off the page rather than derived from the same code under test.
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
const out = join(dir, 'signatureInk.mjs');
execFileSync('npx', [
  'esbuild', new URL('./signatureInk.ts', import.meta.url).pathname,
  '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error',
]);
const { inkBounds, looksSigned } = await import(out);

/** A picture, drawn as text: '.' is bare paper, anything else is ink. */
function pad(rows) {
  const width = rows[0].length;
  const alpha = new Uint8ClampedArray(width * rows.length);
  rows.forEach((row, y) => {
    [...row].forEach((cell, x) => { alpha[y * width + x] = cell === '.' ? 0 : 255; });
  });
  return { alpha, width, height: rows.length };
}

console.log('\nFinding the ink\n');

{
  const { alpha, width, height } = pad([
    '........',
    '..##....',
    '..##....',
    '........',
  ]);
  check('a mark in the middle is found exactly',
    inkBounds(alpha, width, height), { x: 2, y: 1, width: 2, height: 2 });
}

// THE OFF-BY-ONE THIS FILE EXISTS FOR. Ink in the last column and the last row
// must be inside the rectangle, not one pixel outside it.
{
  const { alpha, width, height } = pad([
    '....',
    '....',
    '...#',
  ]);
  check('ink in the very last pixel is kept',
    inkBounds(alpha, width, height), { x: 3, y: 2, width: 1, height: 1 });
}
{
  const { alpha, width, height } = pad([
    '#...',
    '....',
  ]);
  check('and so is ink in the very first',
    inkBounds(alpha, width, height), { x: 0, y: 0, width: 1, height: 1 });
}

// A SIGNATURE IS NOT A RECTANGLE. The bounds must take the extremes of the
// whole hand — the top of an ascender, the tail of a flourish — not of any one
// stroke.
{
  const { alpha, width, height } = pad([
    '.#........',
    '.#..##....',
    '.#.#..#...',
    '.####..#..',
    '.......##.',
  ]);
  check('a signature is bounded by its extremes, not by one stroke',
    inkBounds(alpha, width, height), { x: 1, y: 0, width: 8, height: 5 });
}

console.log('\nThe faintest ink still counts\n');

// ANY ALPHA AT ALL. The anti-aliased edge of a thin stroke is nearly
// transparent, and a threshold above zero clips exactly the parts of a hand
// that are hardest to reproduce.
{
  const width = 4;
  const alpha = new Uint8ClampedArray(width * 2);
  alpha[5] = 1;
  check('one unit of alpha is ink',
    inkBounds(alpha, width, 2), { x: 1, y: 1, width: 1, height: 1 });
}

console.log('\nRoom round the strokes\n');

{
  const { alpha, width, height } = pad([
    '......',
    '..##..',
    '......',
  ]);
  // One column each side of a two-wide mark makes four; one row each side of a
  // one-tall mark makes three. Counted off the picture above rather than taken
  // from the code — my first reading of it said two, and the code was right.
  check('the margin is added on every side', inkBounds(alpha, width, height, 1),
    { x: 1, y: 0, width: 4, height: 3 });
  // A CROP THAT STARTS AT -2 shifts the image in some browsers and throws in
  // others, so the margin stops at the edge of the pad.
  check('…and is clamped to the pad rather than running outside it',
    inkBounds(alpha, width, height, 5), { x: 0, y: 0, width: 6, height: 3 });
}

console.log('\nAn empty pad is an answer, not an error\n');

{
  const { alpha, width, height } = pad(['....', '....']);
  check('nothing drawn returns nothing', inkBounds(alpha, width, height), null);
  check('a zero-sized pad too', inkBounds(new Uint8ClampedArray(0), 0, 0), null);
}

console.log('\nAnd a stray tap is not a signature\n');

// A DOT SAVED AS A SIGNATURE puts a full stop on every certificate issued under
// the design, which is why the pad refuses it rather than trusting the officer
// to notice.
check('one dot does not count as signed',
  looksSigned({ x: 0, y: 0, width: 3, height: 3 }, 24), false);
check('a short line does not either',
  looksSigned({ x: 0, y: 0, width: 20, height: 4 }, 24), false);
check('a signature across the pad does',
  looksSigned({ x: 0, y: 0, width: 300, height: 40 }, 24), true);
// Height alone is enough: an initial written tall and narrow is a signature.
check('so does a tall narrow one', looksSigned({ x: 0, y: 0, width: 8, height: 60 }, 24), true);
check('and nothing at all does not', looksSigned(null, 24), false);

process.exit(failures === 0 ? 0 : 1);
