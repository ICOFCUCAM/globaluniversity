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
// WHAT THIS TEST DOES, AND WHAT IT DELIBERATELY DOES NOT
// ---------------------------------------------------------------------------
//
// It does NOT fix it. Making the portal read the table at runtime means every
// grade calculation becomes asynchronous, and that is a change to make
// deliberately rather than as part of an audit.
//
// What it does is hold the two together. If somebody edits the bands in either
// place without the other, this fails and names the band. That turns a silent
// divergence — a student's transcript disagreeing with the Faculty Handbook —
// into a failed build.
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

console.log('\nThe University writes its grading scale down twice\n');

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

// ---------------------------------------------------------------------------
// AND THE THING THIS TEST CANNOT FIX, SAID ON EVERY RUN
// ---------------------------------------------------------------------------

console.log('\n      STILL OPEN: nothing in the application reads `grading_scales`. The table, its');
console.log('      `is_active` flag, its per-award variants and the `grading_scale_restatements`');
console.log('      approval trail are all unread. A restatement published in the database will');
console.log('      not change a single grade the portal computes until grading.ts reads it.');

console.log(failures === 0
  ? '\nThe two scales agree, and will fail the build the day they stop.'
  : `\n${failures} failed — the portal and the database disagree about a grade.`);
process.exit(failures === 0 ? 0 : 1);
