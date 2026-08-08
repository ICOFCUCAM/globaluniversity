// ---------------------------------------------------------------------------
// THE CREDIT FRAMEWORK, AND THE CONFLICT IT RECORDS.
//
//   node src/content/creditFramework.test.mjs
//
// ===========================================================================
// WHAT THIS TEST IS ACTUALLY FOR
// ===========================================================================
//
// It was written to hold a DISAGREEMENT open. The catalogue published 180 ECTS
// for every diploma; the School of Ministry framework said 120. Both were the
// university's own instruction, the site changed neither, and this file failed
// if the two ever agreed — with instructions to edit it deliberately once the
// University ruled, rather than let housekeeping resolve a question that
// governs transfer, articulation, the transcript and the certificate.
//
// THE UNIVERSITY RULED: "Diploma is 120. 180 is degree." So this test has been
// edited deliberately, and it now guards the opposite invariant: that every
// place the figure lives AGREES.
//
// That is a bigger check than the one it replaces, because the figure lives in
// four of them — the award ladder, the programme catalogue, the School of
// Ministry framework's own §25 ladder, and `awards.credits_required` in the
// database. The first three are asserted here. The fourth cannot be reached
// from a test with no database, so migration 012 asserts it at run time
// instead, and this file checks that the migration exists and says 120.
//
// One thing is asserted that looks like paranoia and is not: that the diploma
// figure is stated against the LEVEL and not against one programme. A
// per-programme entry silently beats the level default in the catalogue's own
// resolution order, so a 180 reinstated on a single diploma would override the
// ruling for that programme alone, and nothing else here would notice.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
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

// WHICH RUNGS THE UNIVERSITY HAS ACTUALLY RULED ON.
//
// Not pedantry. A figure a university has ruled can be quoted to an accreditor;
// a figure inferred from one school's framework cannot, and the two look
// identical in a table. `source` is what carries the difference, so it is
// asserted rather than trusted to survive an edit.
const ruled = F.AWARD_LADDER.filter((a) => /Ruled by the University/.test(a.source)).map((a) => a.level);
check('three rungs carry a direct ruling', ruled, ['Diploma', 'Bachelor', 'Master']);
check('…and the Certificate is still the framework’s statement',
  /framework §25/.test(F.AWARD_LADDER.find((a) => a.level === 'Certificate').source), true);

// The ladder must agree with the degree the University actually publishes. If
// the B.Min. were ever restructured to a different total, a ladder that still
// said 180 would be describing a degree nobody offers.
check('…and the Bachelor figure is the one the B.Min. actually carries',
  F.ectsFor('Bachelor'), B.bminTotalEcts);

// A doctorate examined by thesis is not conventionally credit-rated. Absent,
// not missing.
check('the Doctorate carries no credit figure, which is correct', F.ectsFor('Doctorate'), null);

console.log('\nThe diploma ruling, in every place the figure lives\n');

check('the ladder states 120 for the Diploma', F.ectsFor('Diploma'), 120);

// Read from where they actually live rather than restated here, so a figure
// changed in one place and not the others fails rather than passing quietly.
const catalogueDiploma = C.ALL_PROGRAMMES
  .filter((p) => p.award === 'Diploma' && p.credits !== undefined)
  .map((p) => p.credits);
const catalogueSays = [...new Set(catalogueDiploma)];
const frameworkDiploma = B.bminLadder.find((l) => l.award === 'Diploma in Ministry');

check('the catalogue publishes exactly one diploma figure', catalogueSays.length, 1);
check('…and it is 120', catalogueSays[0], 120);
check('the School of Ministry framework §25 agrees', frameworkDiploma.credits, '120 ECTS');
check('all three sources now state the same figure',
  [F.ectsFor('Diploma'), catalogueSays[0], Number(frameworkDiploma.credits.replace(' ECTS', ''))],
  [120, 120, 120]);

// "180 is degree" is the other half of the ruling and is just as checkable.
const bachelors = [...new Set(
  C.ALL_PROGRAMMES.filter((p) => p.award === "Bachelor's" && p.credits !== undefined).map((p) => p.credits),
)];
check('every bachelor’s with a published figure carries 180', bachelors, [180]);
check('…and no diploma carries the degree’s figure',
  catalogueDiploma.filter((c) => c === 180), []);

// EVERY diploma, not just the theology ones. The ruling was about the level,
// so a diploma that publishes no figure at all would mean the level default is
// not being applied — which is how the ruling would silently fail to reach the
// technology and business programmes.
const diplomas = C.ALL_PROGRAMMES.filter((p) => p.award === 'Diploma');
check('no diploma is left without a credit figure',
  diplomas.filter((p) => p.credits === undefined).map((p) => p.slug), []);
console.log(`      ${diplomas.length} diplomas, all at 120 ECTS`);

// THE LEVEL, NOT THE PROGRAMME. A per-programme entry beats the level default
// in the catalogue's resolution order, so a 180 reinstated on one diploma would
// override the ruling for that programme and nothing else here would see it.
const cat = readFileSync(new URL('./programmeCatalogue.ts', import.meta.url).pathname, 'utf8');
const levelBlock = cat.slice(cat.indexOf('const LEVEL_CREDITS'), cat.indexOf('const LEVEL_DURATION'));
check('the diploma figure is stated against the LEVEL', /Diploma:\s*120/.test(levelBlock), true);
const publishedBlock = cat.slice(cat.indexOf('const PUBLISHED_CREDITS'), cat.indexOf('const LEVEL_CREDITS'));
check('…and no diploma overrides it per-programme',
  /'diploma-[a-z-]+':\s*\d+/.test(publishedBlock), false);

// "Masters is 120 credits" — the third ruling, and the one the catalogue was
// already applying before it was ruled. Read from the catalogue, so a change
// there without a change to the ladder fails.
const masters = [...new Set(
  C.ALL_PROGRAMMES.filter((p) => p.award === "Master's" && p.credits !== undefined).map((p) => p.credits),
)];
check('every master’s carries 120', masters, [120]);
check('…and none is left without a figure',
  C.ALL_PROGRAMMES.filter((p) => p.award === "Master's" && p.credits === undefined).map((p) => p.slug), []);
check('the ladder and the catalogue agree on the master’s',
  F.ectsFor('Master'), masters[0]);

// THE CERTIFICATE PUBLISHES NOTHING, AND THAT IS THE ASSERTION.
//
// The framework proposes 60 and the University has not ruled. The likely answer
// is the dangerous one here: a certificate card printing 60 would state a
// regulation nobody made, and it would be indistinguishable from one that had
// been. So the absence is checked, and this line is what somebody must delete
// deliberately when the ruling comes.
const certs = C.ALL_PROGRAMMES.filter((p) => p.award === 'Certificate');
check('no certificate publishes a credit figure, because none has been ruled',
  certs.filter((p) => p.credits !== undefined).map((p) => p.slug), []);
console.log(`      ${certs.length} certificates, none with a figure — awaiting a ruling`);

// The database half. Unreachable from here, so what is checked is that the
// migration which carries it exists and says the right thing.
const mig = readFileSync(new URL('../../docs/migrations/012_credit_framework.sql', import.meta.url).pathname, 'utf8');
check('migration 012 sets every diploma award to 120',
  /kind = 'diploma'[\s\S]{0,80}credits_required/.test(mig) && /set credits_required = 120/.test(mig), true);
check('…and every bachelor’s award to 180', /set credits_required = 180/.test(mig), true);
check('…and every master’s award to 120', /kind = 'masters'/.test(mig), true);
check('…and refuses to leave a disagreeing award behind',
  /raise exception .*disagree with the credit ruling/.test(mig), true);
// The certificate must NOT be asserted in the migration either. A value there
// would invent the regulation the ladder is careful not to invent.
check('…and asserts nothing about the certificate',
  /kind = 'certificate'/.test(mig), false);

console.log('\nThe questions are on record\n');

check('three credit questions are published', F.CREDIT_QUESTIONS.length, 3);
const incomplete = F.CREDIT_QUESTIONS.filter((q) => !q.finding || !q.detail || !q.recommendation);
check('…each with a finding, a detail and a recommendation', incomplete.map((q) => q.id), []);
check('the diploma ruling is the first, because it is the one that governs a transcript',
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
console.log('The credit framework is stated, and the diploma ruling holds everywhere.\n');
