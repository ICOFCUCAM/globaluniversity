// ---------------------------------------------------------------------------
// THE ADMISSION WORKFLOW, HELD TO ONE VOCABULARY.
//
// Run with:  node src/lib/admissionWorkflow.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
//
// The workflow is written down in four places that cannot see each other: the
// TypeScript module, the state and event lists in migration 024, the route that
// writes them, and the desk that reads them. Every one of those is a copy, and
// copies drift.
//
// The failure is specific and expensive. A state the application believes in
// and the database refuses is a screen that works in development and fails at
// the moment the Head of Academic Affairs presses the button on a real
// applicant — with the decision half taken. An event name the route emits and
// the CHECK constraint rejects loses the audit entry for the one action anybody
// will later want to look up.
//
// So the vocabularies are read out of both files and compared.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
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

const here = new URL('.', import.meta.url).pathname;
const dir = join(here, '../../node_modules/.cache/icof');
mkdirSync(dir, { recursive: true });
const out = join(dir, 'admissionWorkflow.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'admissionWorkflow.ts'),
  '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error',
]);
const W = await import(out);

// EVERY MIGRATION THAT TOUCHES THE VOCABULARY, concatenated. It read only 024,
// so when 026 added two states and three events the test reported them missing
// from a database that has them — the check was right, the corpus was short.
// Anything later that adds a state or an event belongs in this list.
const MIGRATION_FILES = [
  '024_admission_decision_authority.sql',
  '026_issuance_is_not_the_decision.sql',
  '027_the_states_the_pipeline_already_wrote.sql',
].map((f) => readFileSync(join(here, '../../docs/migrations/', f), 'utf8'));

const migration = MIGRATION_FILES.join('\n');

console.log('\nThe states the code knows are the states the database knows\n');

// A seeded row is a tuple whose SECOND value is one of the six stages. Anchoring
// on the stage rather than on the column count is what makes this survive 026,
// which seeds five columns where 024 seeded four — the previous pattern counted
// columns and reported both new states as missing from a file that has them.
const STAGES = 'application|verification|academic|issuance|enrolment|closed';

// THE PROOF BLOCKS ARE CUT OUT FIRST. Each migration ends with a section that
// deliberately attempts what the rules forbid — 026 tries to insert a state
// called 'invented' and checks that the trigger refuses it — and a scan that
// read those would report the negative tests as real seeds.
// EACH FILE IS CUT AT ITS OWN MARKER, then joined. Splitting the concatenated
// corpus instead dropped whichever half fell between two files' markers — which
// is where 026's seed lives, so both its states were reported missing from the
// file that adds them.
const seedsOnly = MIGRATION_FILES
  .map((text) => text.split(/-- \d+\. PERFORMING THE RULES/)[0])
  .join('\n');

// A seeded row is a tuple whose SECOND value is one of the six stages, whose
// third is a label, and which ends in a sort order. Anchoring on the shape
// rather than the column count is what makes it survive 026 seeding five
// columns where 024 seeded four; requiring the trailing number is what keeps
// the stage CHECK constraint's own list of stages out of the results.
const inMigration = [...seedsOnly.matchAll(
  new RegExp(`\\('([a-z_]+)',\\s*'(?:${STAGES})',\\s*'[^']*',\\s*(?:'[^']*',\\s*)?\\d+\\)`, 'g'),
)].map((m) => m[1]);

check('the migration seeds every state the module declares',
  W.ADMISSION_STATES.filter((s) => !inMigration.includes(s)), []);
check('…and seeds none the module does not',
  inMigration.filter((s) => !W.ADMISSION_STATES.includes(s)), []);

console.log('\nAnd the events the route can emit are the events the log accepts\n');

// EVERY `check (event in (...))` in the corpus, not the first one. 026 widens
// the constraint with an ALTER rather than restating the CREATE TABLE, so a
// pattern that stopped at the first block was reading the superseded list.
const inCheck = [...migration.matchAll(/check \(event in \(([\s\S]*?)\)\)/g)]
  .flatMap((block) => [...block[1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]));

check('every event the module declares is accepted by the constraint',
  W.ADMISSION_EVENTS.filter((e) => !inCheck.includes(e)), []);
check('…and the constraint accepts none the module cannot emit',
  inCheck.filter((e) => !W.ADMISSION_EVENTS.includes(e)), []);

console.log('\nThe four decisions, and what each produces\n');

check('the decision keys are the four the University named',
  Object.keys(W.ACADEMIC_DECISIONS), ['approve', 'conditional', 'return', 'reject']);
check('every decision maps to a state that exists',
  Object.values(W.ACADEMIC_DECISIONS).map((d) => d.becomes).filter((s) => !W.ADMISSION_STATES.includes(s)),
  []);
check('every decision maps to an event that exists',
  Object.values(W.EVENT_FOR_DECISION).filter((e) => !W.ADMISSION_EVENTS.includes(e)), []);
// THE WORDING THE UNIVERSITY ASKED FOR. "Approve" understates an action that
// records a decision, issues a signed document and creates an account.
check('the approve button says what it does',
  W.ACADEMIC_DECISIONS.approve.label, 'Approve & issue admission');

// The migration's decision CHECK must accept exactly these four.
const decisionCheck = /decision\s+text not null check \(decision in \(([^)]*)\)\)/.exec(migration)?.[1] ?? '';
check('the database accepts the same four decisions',
  [...decisionCheck.matchAll(/'(\w+)'/g)].map((m) => m[1]).sort(),
  ['approve', 'conditional', 'reject', 'return']);

console.log('\nA decision cannot be taken twice, or at the wrong stage\n');

// THE GUARD THAT MATTERS MOST. `approved` reaching canDecide() would let one
// applicant be admitted twice — two student numbers, two accounts, two letters.
check('an already-decided application cannot be decided again',
  W.ALREADY_DECIDED.filter((s) => W.canDecide(s)), []);
check('a submitted-but-unverified application is not decidable', W.canDecide('applicant'), false);
check('a verified and paid one is', W.canDecide('fee_paid'), true);
check('and the state the new pipeline produces is', W.canDecide('ready_for_academic_review'), true);
check('an unknown state is not decidable', W.canDecide('nonsense'), false);
check('nor is a missing one', W.canDecide(undefined), false);

console.log('\nWhat the applicant is shown covers every state\n');

// A state in no applicant stage is a student looking at a blank progress bar
// and telephoning the Registrar to ask what has happened.
{
  const covered = new Set(W.APPLICANT_STAGES.flatMap((s) => s.states));
  check('every state maps to something the applicant can be told',
    W.ADMISSION_STATES.filter((s) => !covered.has(s) && s !== 'withdrawn'), []);
  check('the stages are in the order they happen',
    W.APPLICANT_STAGES.map((s) => s.key),
    ['received', 'documents', 'review', 'decision', 'documents-issued', 'enrolment']);
  check('and the index rises through them',
    W.applicantStageIndex('applicant') < W.applicantStageIndex('admission_issued'), true);
}

console.log('\nThe delivery mode picks the right terms in the admission letter\n');

// ---------------------------------------------------------------------------
// THE BUG THIS CAUGHT. modeOf() tested for /online/ before it tested for
// both-ness, and the University's own wording for a programme taught both ways
// is "Online / Campus" — which contains "online". So a student admitted to a
// programme taught in Buea AND at a distance would have been sent the
// online-only terms: nothing about attendance being recorded, examinations
// under invigilation, or the student card needed to sit them.
// ---------------------------------------------------------------------------
{
  const pkg = readFileSync(join(here, 'admissionPackage.ts'), 'utf8');
  const body = /function modeOf\(mode: string\)[\s\S]*?\n}/.exec(pkg)?.[0] ?? '';
  // eslint-disable-next-line no-new-func
  const modeOf = new Function(`${body.replace(/: string|: 'campus' \| 'online' \| 'both'/g, '')}; return modeOf;`)();

  check('“Online / Campus” selects the terms for both', modeOf('Online / Campus'), 'both');
  check('“Online” selects the online terms', modeOf('Online'), 'online');
  check('“Campus” selects the campus terms', modeOf('Campus'), 'campus');
  // The older spellings the University's records already carry.
  check('“On campus” still works', modeOf('On campus'), 'campus');
  check('“Campus and online” still works', modeOf('Campus and online'), 'both');
  check('and an empty mode falls back to campus', modeOf(''), 'campus');
}

console.log('\nAnd the catalogue’s three labels are the three the University gave\n');

{
  const courses = readFileSync(join(here, '../content/courses.ts'), 'utf8');
  const labels = /MODE_LABEL: Record<DeliveryMode, string> = \{([\s\S]*?)\}/.exec(courses)?.[1] ?? '';
  check('Campus, Online, Online / Campus',
    [...labels.matchAll(/'([^']+)'/g)].map((m) => m[1]),
    ['Campus', 'Online', 'Online / Campus']);
}

process.exit(failures === 0 ? 0 : 1);
