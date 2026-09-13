// ---------------------------------------------------------------------------
// IS THERE ONE GRADING SCALE, OR TWO?
//
//   node src/lib/oneGradingScale.test.mjs
//
// ---------------------------------------------------------------------------
// THE FAULT
// ---------------------------------------------------------------------------
//
// This University has its grading scale written down twice.
//
//   `grading_scales`        a table, seeded by migration 020 and restated by
//                           035, with the bands as jsonb, a pass mark, a
//                           maximum point, an `is_active` flag, a per-award
//                           variant and a publication record. There is even a
//                           `grading_scale_restatements` table holding the
//                           approval trail for changing it.
//
//   `src/lib/grading.ts`    the bands again, derived from `regulations.ts`,
//                           and the ONLY one the portal actually computes on.
//                           Every grade, every GPA, every classification.
//
// NOTHING IN THE APPLICATION READS THE TABLE. So the University can restate
// its grading scale, take it through the approval trail built for exactly that
// purpose, publish it — and every screen will go on computing the old one. The
// two agree today only because both were written from the same document.
//
// ---------------------------------------------------------------------------
// AND IT IS NOW FIXED — SO THIS TEST GUARDS TWO THINGS
// ---------------------------------------------------------------------------
//
// `GradingContext` reads the active scale when the portal starts and adopts it
// into `grading.ts`, where all fifteen files that compute a grade already
// look. The University's own scale is what the portal computes on.
//
// THE PUBLISHED BANDS REMAIN THE FALLBACK, for a database that cannot be
// reached, a migration that has not been run, or a stored scale that will not
// parse. So the two must still agree — a fallback that grades differently from
// the real thing is worse than no fallback, because it works.
//
// So: they agree band for band, AND adopting a scale actually changes what the
// portal computes. The second half is what stops the wiring being quietly
// removed later.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n`
      + `      actual   ${JSON.stringify(actual)}`);
  } else {
    console.log(`ok    ${label}`);
  }
}

const here = new URL('.', import.meta.url).pathname;
const root = join(here, '../..');
const migrations = join(root, 'docs/migrations');

// ---------------------------------------------------------------------------
// THE SCALE THE DATABASE HOLDS
// ---------------------------------------------------------------------------
//
// Read from the migration that seeds it rather than from a live database, so
// this runs anywhere. The LAST migration to insert a scale wins, because that
// is what a restatement is: 035 replaced 020's, and a future one will replace
// 035's.

const seedFiles = readdirSync(migrations)
  .filter((f) => /^\d{3}_.*\.sql$/.test(f))
  .sort();

let seeded = null;
let seededIn = null;
let seededVersion = 0;
let passMark = null;
let maxPoint = null;
for (const f of seedFiles) {
  const sql = readFileSync(join(migrations, f), 'utf8');
  // ---------------------------------------------------------------------
  // THE UNIVERSITY'S OWN SCALE, BY NAME AND BY VERSION.
  //
  // NOT "every insert into grading_scales". The first version of this took
  // any of them and picked up a THREE-BAND FIXTURE out of a proof — one that
  // exists to be refused and rolled back — then reported that the portal and
  // the database disagreed about eight grades. A test that fails against
  // working code is worse than no test.
  //
  // So: the row whose name is the University's scale, and the highest version
  // of it, because that is what a restatement is.
  // ---------------------------------------------------------------------
  const re = /select\s+'University grading scale',\s*(\d+),\s*\w+,\s*([\d.]+),\s*([\d.]+),\s*'(\[[\s\S]*?\])'::jsonb/g;
  for (const m of sql.matchAll(re)) {
    const version = Number(m[1]);
    if (version < seededVersion) continue;
    try {
      seeded = JSON.parse(m[4]);
      seededVersion = version;
      seededIn = f;
      passMark = Number(m[2]);
      maxPoint = Number(m[3]);
    } catch { /* not readable as bands */ }
  }
}

console.log('\nThe University writes its grading scale down twice, and they must agree\n');

check('the database is seeded with a grading scale', seeded !== null, true);
if (!seeded) {
  console.log('\n(no seeded scale found, so the two could not be compared)');
  process.exit(1);
}
console.log(`      the database's scale comes from ${seededIn} `
  + `(version ${seededVersion}), ${seeded.length} bands`);

// ---------------------------------------------------------------------------
// THE SCALE THE PORTAL COMPUTES ON
// ---------------------------------------------------------------------------

const cache = join(root, 'node_modules/.cache/icof');
mkdirSync(cache, { recursive: true });
const out = join(cache, 'grading.mjs');
execFileSync('npx', [
  'esbuild', join(root, 'src/lib/grading.ts'), '--bundle', '--format=esm', '--platform=node',
  `--outfile=${out}`, '--log-level=error', `--alias:@=${join(root, 'src')}`,
]);
const G = await import(out);

console.log(`      the portal's scale comes from grading.ts, ${G.GRADING_SCALE.length} bands\n`);

// ---------------------------------------------------------------------------
// AND THEY HAD BETTER AGREE, BAND FOR BAND
// ---------------------------------------------------------------------------
//
// COMPARED BY GRADE, not by position. Two lists in different orders that hold
// the same bands are the same scale; two lists in the same order with one
// value different are not, and an index-by-index comparison reports the first
// as broken and the second as fine.

const byGrade = (rows, g) => rows.find((r) => r.grade === g);

check('both scales hold the same grades',
  G.GRADING_SCALE.map((b) => b.grade).sort(),
  seeded.map((b) => b.grade).sort());

for (const band of G.GRADING_SCALE) {
  const db = byGrade(seeded, band.grade);
  if (!db) continue;
  check(`${band.grade}: the same range`, [band.minScore, band.maxScore], [db.min, db.max]);
  check(`${band.grade}: the same grade point`, Number(band.gradePoint), Number(db.points));
}

// THE PASS MARK, which is the single most consequential number of the lot: it
// decides whether a course is passed, and therefore whether credits are
// earned, and therefore whether somebody graduates.
check('the same pass mark', Number(G.PASS_MARK), passMark);
check('the same maximum grade point', Number(G.MAX_GRADE_POINT), maxPoint);

// ===========================================================================
// AND ADOPTING A SCALE ACTUALLY CHANGES WHAT THE PORTAL COMPUTES
// ===========================================================================
//
// The agreement above would pass just as happily if the wiring were removed
// and the portal went back to computing on the constant — because the two
// agree. So this proves the mechanism itself, by adopting a scale that is
// DELIBERATELY WRONG and checking the answer moves.
//
// A test that cannot tell a working system from a disconnected one is the
// thing this whole audit was about.

console.log('\nAnd the scale the University publishes is the one the portal computes on\n');

const before = G.calculateGrade(95);
check('on the published bands, 95 is an A', before.grade, 'A');

G.adoptScale({
  name: 'A scale invented by this test',
  passMark: 50,
  maxPoint: 4,
  bands: [
    { grade: 'PROOF', gradePoint: 3.21, minScore: 0, maxScore: 100, remark: 'Proof' },
  ],
});
check('adopting a scale changes the grade', G.calculateGrade(95).grade, 'PROOF');
check('…and the grade point with it', G.calculateGrade(95).gradePoint, 3.21);
check('…and the pass mark', [G.isPass(55), G.passMarkInUse()], [true, 50]);
check('…and the portal says which scale it is on',
  G.scaleInForce(), { name: 'A scale invented by this test', fromDatabase: true });

// A SCALE WITH NO BANDS IS REFUSED, not adopted. It would grade every mark in
// the University as F, silently.
G.adoptScale({ name: 'Empty', passMark: 1, maxPoint: 4, bands: [] });
check('a scale with no bands is refused', G.calculateGrade(95).grade, 'A');

G.adoptScale(null);
check('and putting it back restores the published bands', G.calculateGrade(95).grade, 'A');
check('…and says so', G.scaleInForce().fromDatabase, false);

console.log(failures === 0
  ? '\nOne scale: the University\u2019s, with the published bands behind it and holding them '
    + 'to each other.'
  : `\n${failures} failed — the portal and the database disagree about a grade.`);
process.exit(failures === 0 ? 0 : 1);
