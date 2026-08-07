// ---------------------------------------------------------------------------
// Is the world the right way round?
//
// Run with:  node src/lib/flatWorld.test.mjs
//
// WHY THIS FILE EXISTS. The projection was written once with the sign of the
// sine inverted, which produced the view from INSIDE the globe: Asia to the
// left of Africa, the Americas to the right. It was caught by looking at a
// screenshot, which is not a system anyone should rely on — a mirrored map is
// the archetypal error that survives review, because it still looks like a
// world and nobody double-checks a continent they recognise.
//
// The map is now the university's most reusable piece of identity: it is at the
// centre of the crest, and anywhere else the page needs to say where this
// institution reaches. That makes an accidental flip a site-wide error rather
// than a local one, and worth a test that states the geography in words.
//
// It also pins the crest to the map. The crest imports flatWorld and must keep
// producing the same drawing; a change to the projection that silently altered
// the mark on the front page would otherwise go unnoticed until somebody
// compared screenshots.
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
const bundle = join(dir, 'flatworld-test.mjs');
execFileSync('npx', [
  'esbuild', new URL('./flatWorld.ts', import.meta.url).pathname,
  '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`, '--log-level=error',
  `--alias:@=${new URL('.', import.meta.url).pathname.replace(/\/[^/]*$/, '')}`,
], { stdio: 'inherit' });
const W = await import(bundle);

const C = 300;
const R = 280;
const at = (lon, lat) => W.projectFlatWorld(lon, lat, C, C, R);

console.log('\nThe flat world — orientation\n');

// The centre of the disc is the North Pole, at any longitude.
const pole = at(0, 90);
check('the North Pole is the centre', [Math.round(pole[0]), Math.round(pole[1])], [C, C]);
const poleEast = at(140, 90);
check('every longitude meets at the pole', [Math.round(poleEast[0]), Math.round(poleEast[1])], [C, C]);

// 20°E runs straight down, so Africa sits at the foot.
const [ax, ay] = at(20, 0);
check('20°E on the equator is directly below the pole', Math.round(ax), C);
check('…and below it, not above', ay > C, true);

// THE ORIENTATION TEST. Get this wrong and the map is a mirror.
const africa = at(20, 5);      // Central Africa
const asia = at(100, 30);      // China
const americas = at(-95, 40);  // the United States
check('Eurasia is RIGHT of Africa', asia[0] > africa[0], true);
check('the Americas are LEFT of Africa', americas[0] < africa[0], true);
check('the Americas are ABOVE the equator line of Africa', americas[1] < africa[1], true);

// Distance from the centre is linear in colatitude — that is what
// "equidistant" means, and it is the property that makes the projection this
// one rather than a stereographic or gnomonic lookalike.
const r = (lat) => Math.hypot(at(20, lat)[0] - C, at(20, lat)[1] - C);
const r60 = r(60);
const r30 = r(30);
const r0 = r(0);
check('spacing is even: 90→60 equals 60→30', Math.abs((r60 - 0) - (r30 - r60)) < 0.01, true);
check('spacing is even: 60→30 equals 30→0', Math.abs((r30 - r60) - (r0 - r30)) < 0.01, true);

// The southern cut is the rim.
const rim = Math.hypot(at(20, W.SOUTH_CUT)[0] - C, at(20, W.SOUTH_CUT)[1] - C);
check('60°S lands exactly on the rim', Math.abs(rim - R) < 0.01, true);

console.log('\nThe pins\n');

// Cameroon and Nigeria are within a few degrees of each other and both sit
// close to the down-meridian, so they must land near the foot and near enough
// together to read as one region.
const buea = at(9.24, 4.16);
const douala = at(9.71, 4.05);
const naija = at(7.49, 9.06);
check('Buea and Douala are within a few pixels of each other', Math.hypot(buea[0] - douala[0], buea[1] - douala[1]) < 6, true);
check('Nigeria is north of Buea', naija[1] < buea[1], true);
check('all three sit below the pole', [buea, douala, naija].every((p) => p[1] > C), true);

// Only places the university actually teaches from.
check('three places are marked, no more', W.UNIVERSITY_PLACES.length, 3);
check(
  'and they are the campuses and the centre',
  W.UNIVERSITY_PLACES.map((p) => p.name).sort(),
  ['Buea', 'Douala', 'Nigeria'],
);

console.log('\nThe drawing\n');

const svg = W.flatWorldSvg({ size: 600, places: true });
check('it emits one svg', (svg.match(/<svg/g) || []).length, 1);
check('…that is closed', svg.trim().endsWith('</svg>'), true);
check('it draws land', svg.includes('<path d="M'), true);
check('it draws the graticule by default', svg.includes('<line'), true);
check('graticule can be turned off', !W.flatWorldSvg({ showGraticule: false }).includes('<line'), true);
// Counting circles does NOT isolate the pins — the four parallels of the
// graticule are circles too, as are the sea and the rim. So compare the two
// drawings against each other: each place adds a dot and a ring, and nothing
// else about the figure changes.
const circles = (s) => (s.match(/<circle/g) || []).length;
const bare = W.flatWorldSvg({ size: 600 });
check('each place adds exactly two circles', circles(svg) - circles(bare), W.UNIVERSITY_PLACES.length * 2);
check('and no place is drawn unless asked', circles(bare), 6); // sea + 4 parallels + rim

// Self-similarity: the figure is a coordinate space, not a size. Doubling the
// size must produce exactly the same drawing at twice the scale, because that
// is the property the crest relies on when it renders at 600 and displays at
// 520 CSS pixels.
const small = W.flatWorldSvg({ size: 300, id: 'x' });
const large = W.flatWorldSvg({ size: 600, id: 'x' });
const firstCoord = (s) => {
  const m = s.match(/<path d="M([\d.]+),([\d.]+)/);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
};
const [sx, sy] = firstCoord(small);
const [lx, ly] = firstCoord(large);
check('doubling the size doubles the geometry', [Math.abs(lx - sx * 2) < 0.2, Math.abs(ly - sy * 2) < 0.2], [true, true]);

if (failures) {
  console.error(`\n${failures} check(s) failed.\n`);
  process.exit(1);
}
console.log('\nThe world is the right way round.\n');
