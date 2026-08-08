// ---------------------------------------------------------------------------
// THE CREDIT FRAMEWORK, AND THE CONFLICT IT RECORDS.
//
//   node src/content/creditFramework.test.mjs
//
// ===========================================================================
// WHAT THIS TEST IS ACTUALLY FOR
// ===========================================================================
//
// Not to prove that 180 is 180. It is to hold a DISAGREEMENT open until the
// University settles it.
//
// The programme catalogue publishes 180 ECTS for every diploma. The School of
// Ministry academic framework states 120 for the Diploma in Ministry. Both are
// the university's own instruction, the site has changed neither, and the
// conflict is published rather than resolved.
//
// The failure mode this guards against is not a wrong number. It is somebody
// tidying up — deleting the null in the ladder, or filling the cell in with
// whichever figure was nearest to hand — and thereby resolving by housekeeping
// a question that governs transfer, articulation, the transcript and the
// certificate. So the test asserts that the Diploma still has NO figure, that
// the two sources still disagree, and that the disagreement is still on record.
//
// When the University rules, this test is edited deliberately, by somebody who
// has read why it is here. That is the point.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;
const ok = (m) => console.log(`ok    ${m}`);
const bad = (m) => {
  failures++;
  console.error(`FAIL  ${m}`);
};
const check = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) ok(label);
  else bad(`${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
};

const dir = join(new URL('../../node_modules/.cache/icof', import.meta.url).pathname);
mkdirSync(dir, { recursive: true });
const srcRoot = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const load = async (file, out) => {
  const bundle = join(dir, out);
  execFileSync('npx', [
    'esbuild', new URL(file, import.meta.url).pathname,
    '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`,
    '--log-level=error', `--alias:@=${srcRoot}`,
  ], { stdio: 'inherit' });
  return import(bundle);
};

const F = await load('./creditFramework.ts', 'credit-test.mjs');
const B = await load('./bachelorOfMinistry.ts', 'credit-bmin.mjs');
const C = await load('./programmeCatalogue.ts', 'credit-cat.mjs');

console.log('\nThe award ladder\n');

check('five levels', F.AWARD_LADDER.map((a) => a.level),
  ['Certificate', 'Diploma', 'Bachelor', 'Master', 'Doctorate']);

check('the Certificate is 60 ECTS', F.ectsFor('Certificate'), 60);
check('the Bachelor is 180 ECTS', F.ectsFor('Bachelor'), 180);
check('the Master is 120 ECTS', F.ectsFor('Master'), 120);

// The ladder must agree with the degree the University actually publishes. If
// the B.Min. were ever restructured to a different total, a ladder that still
// said 180 would be describing a degree nobody offers.
check('…and the Bachelor figure is the one the B.Min. actually carries',
  F.ectsFor('Bachelor'), B.bminTotalEcts);

// A doctorate examined by thesis is not conventionally credit-rated. Absent,
// not missing.
check('the Doctorate carries no credit figure, which is correct', F.ectsFor('Doctorate'), null);

console.log('\nThe diploma conflict, held open\n');

check('the ladder states NO figure for the Diploma', F.ectsFor('Diploma'), null);

// The two sources, read from where they actually live rather than restated.
const catalogueDiploma = C.ALL_PROGRAMMES
  .filter((p) => p.award === 'Diploma' && p.credits !== undefined)
  .map((p) => p.credits);
const frameworkDiploma = B.bminLadder.find((l) => l.award === 'Diploma in Ministry');

const catalogueSays = [...new Set(catalogueDiploma)];
check('the programme catalogue publishes one diploma figure', catalogueSays.length, 1);
check('…and it is 180 ECTS', catalogueSays[0], 180);
check('the School of Ministry framework says 120 ECTS', frameworkDiploma.credits, '120 ECTS');

if (String(catalogueSays[0]) !== frameworkDiploma.credits.replace(' ECTS', '')) {
  ok('    the two sources still disagree — the conflict this file records is real');
} else {
  bad(
    'The catalogue and the framework now AGREE on the diploma credit value. '
    + 'If the University has ruled, record the ruling in creditFramework.ts, give the '
    + 'Diploma its figure in AWARD_LADDER, decide whether it is retrospective for '
    + 'diplomas already issued, and then update this test deliberately.',
  );
}

console.log('\nThe questions are on record\n');

check('three credit questions are published', F.CREDIT_QUESTIONS.length, 3);
const incomplete = F.CREDIT_QUESTIONS.filter((q) => !q.finding || !q.detail || !q.recommendation);
check('…each with a finding, a detail and a recommendation', incomplete.map((q) => q.id), []);
check('the diploma conflict is the first, because it is the one that governs a transcript',
  F.CREDIT_QUESTIONS[0].id, 'diploma-credit-value');

// A workload statement is what makes a credit figure mean anything to a
// receiving institution. A ladder without one is a list of numbers.
check('one ECTS is defined in hours', /25 to 30 hours/.test(F.ECTS_NOTE), true);
check('…and a full year is stated', /60 ECTS/.test(F.ECTS_NOTE), true);

console.log('');
if (failures) {
  console.error(`${failures} check(s) failed.\n`);
  process.exit(1);
}
console.log('The credit framework is stated, and its one open conflict is still open.\n');
