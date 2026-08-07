// ---------------------------------------------------------------------------
// Do the homepage's faculty links go anywhere?
//
//   node src/content/facultyLinks.test.mjs
//
// WHY THIS EXISTS. This repository keeps faculties in two files under two
// different sets of keys, and nothing connected them:
//
//   programmeCatalogue.ts  ids:    theology · engineering · business · education
//   faculties.ts           slugs:  theology-buea · engineering-technology ·
//                                  gibmas · education
//
// Three of the four differ. /faculty/[slug] is generated from faculties.ts, so
// a link built from a catalogue id is a 404 on three faculties out of four —
// and a 404 that only appears in production, because generateStaticParams
// simply does not emit the missing routes rather than failing the build.
//
// The card grid that preceded the faculty scenes hid this by pointing all four
// cards at the /faculty index. That was safe and useless: four separate
// faculties, four identical links. Naming the real slugs made the links useful
// and made this test necessary.
//
// It also checks the count, and that check has now done its job once. It read
// "four disciplines, five pages — the fifth is Douala, the same discipline at
// another campus", and it said: if a genuinely new faculty is added, this fails
// and somebody has to decide whether the homepage should say five.
//
// A genuinely new faculty was added. The university asked for a School of
// Ministry, six awards moved into it from the Faculty of Theology, and the
// decision was taken: the homepage says FIVE disciplines and the site has SIX
// faculty pages, the sixth still being Douala. The assertion is updated rather
// than deleted, so the next new faculty trips it too.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;
const check = (label, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures++;
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
  } else {
    console.log(`ok    ${label}`);
  }
};

const dir = join(new URL('../../node_modules/.cache/icof', import.meta.url).pathname);
mkdirSync(dir, { recursive: true });
const root = new URL('../', import.meta.url).pathname.replace(/\/$/, '');

const bundle = join(dir, 'faculties-test.mjs');
execFileSync('npx', [
  'esbuild', new URL('./faculties.ts', import.meta.url).pathname,
  '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`, '--log-level=error',
  `--alias:@=${root}`,
], { stdio: 'inherit' });
const F = await import(bundle);

const catBundle = join(dir, 'catalogue-test.mjs');
execFileSync('npx', [
  'esbuild', new URL('./programmeCatalogue.ts', import.meta.url).pathname,
  '--bundle', '--format=esm', '--platform=node', `--outfile=${catBundle}`, '--log-level=error',
  `--alias:@=${root}`,
], { stdio: 'inherit' });
const C = await import(catBundle);

console.log('\nFaculty links on the homepage\n');

// Pull the slugs and catalogue ids the homepage actually passes to FacultyScenes.
const page = readFileSync(new URL('../app/page.tsx', import.meta.url).pathname, 'utf8');
const block = page.slice(page.indexOf('<FacultyScenes'), page.indexOf('/>', page.indexOf('<FacultyScenes')));
const slugs = [...block.matchAll(/slug: '([^']+)'/g)].map((m) => m[1]);
const ids = [...block.matchAll(/id: '([^']+)'/g)].map((m) => m[1]);

check('the homepage names five disciplines', slugs.length, 5);
check('…and one catalogue id for each', ids.length, slugs.length);

const realSlugs = new Set(F.facultyList.map((f) => f.slug));
for (const s of slugs) {
  check(`/faculty/${s} is a real page`, realSlugs.has(s), true);
}

const realIds = new Set(C.FACULTIES.map((f) => f.id));
for (const id of ids) {
  check(`catalogue id "${id}" exists`, realIds.has(id), true);
  const n = C.programmesByFaculty(id).length;
  check(`…and "${id}" has programmes to count`, n > 0, true);
}

// The count the homepage asserts about itself.
check(
  'the site has six faculty pages, five disciplines plus Douala',
  F.facultyList.map((f) => f.slug).sort(),
  [
    'education',
    'engineering-technology',
    'gibmas',
    'school-of-ministry',
    'theology-buea',
    'theology-douala',
  ],
);

// No duplicates — a copy-paste in the scene list would otherwise show the same
// faculty twice with two different pictures and nobody would notice.
check('no discipline is listed twice', new Set(slugs).size, slugs.length);
check('no catalogue id is used twice', new Set(ids).size, ids.length);

if (failures) {
  console.error(`\n${failures} check(s) failed.\n`);
  process.exit(1);
}
console.log('\nEvery faculty on the homepage leads somewhere real.\n');
