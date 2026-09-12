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
  '032_forwarding_and_returning.sql',
  '033_reevaluation.sql',
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

console.log('\nEvery refusal the desk can receive, it can explain\n');

// ---------------------------------------------------------------------------
// THE BUG THIS CAUGHT. A Superadministrator pressing "Retry issuance" got the
// bare string `override-reason-required` on screen, because the desk explains a
// refusal by looking the code up in DECISION_CHECKS and there was no entry. The
// refusal itself was also wrong — see the route — but even once fixed it could
// still be reached, and a code a reader cannot act on is barely better than a
// silent failure.
//
// So: every refusal the route returns to the CALLER as a fixed code must have
// words to go with it. 5xx replies are excluded — those are faults rather than
// refusals, they carry a message built at the time, and there is nothing useful
// to write down in advance.
// ---------------------------------------------------------------------------
{
  const route = readFileSync(join(here, '../app/api/admissions/decision/route.ts'), 'utf8');
  const refusals = new Set();
  for (const m of route.matchAll(
    /error:\s*'([a-z-]+)'[^}]*\}\s*,\s*\{\s*status:\s*(4\d\d)/g,
  )) refusals.add(m[1]);

  check('the scan found the refusals at all', refusals.size > 3, true);

  // WHAT IS DELIBERATELY NOT IN THE VOCABULARY.
  //
  // DECISION_CHECKS is the list of things the server re-verifies about an
  // APPLICATION, in words a registrar can act on. These four are not that.
  // `issuance-failed` the desk handles in its own branch, with the step and
  // detail the route reports. The other three mean the browser sent something
  // malformed — no application id, a decision that does not exist, a body that
  // is not JSON — which a working screen cannot produce. Writing registrar-
  // facing prose for a programming error would tell the reader to do something
  // about a fault that is not theirs.
  for (const notADomainRefusal of [
    'issuance-failed', 'bad-json', 'missing-application-id', 'unknown-decision',
  ]) refusals.delete(notADomainRefusal);

  check('every refusal has words to explain it',
    [...refusals].filter((e) => !(e in W.DECISION_CHECKS)).sort(), []);
}

// THE RETRY MUST NOT DEMAND AN OVERRIDE REASON. The panel that collects one is
// not open during a retry — there is no decision being composed — so requiring
// it made the button unusable for the only role that sees the override banner.
{
  const route = readFileSync(join(here, '../app/api/admissions/decision/route.ts'), 'utf8');
  // The CONDITION, not a window of characters after it — the first attempt read
  // a fixed 120 characters and the comment explaining the exemption pushed the
  // exemption out of range, so the test failed on the code that fixes it.
  const guard = /if \(isOverride && admitting([\s\S]*?)\)\s*\{/.exec(route)?.[1] ?? '';
  check('the override guard was found', guard.length > 0, true);
  check('a retry is exempt from the override reason', /!retry/.test(guard), true);
}

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

console.log('\nHow far an issuance got, read from the record\n');

// ---------------------------------------------------------------------------
// The University asked for the pipeline to be shown so that a failure says
// WHERE it stopped, not only that it stopped. These are the four shapes that
// actually occur, and the one that matters is the third: Dorothy's.
// ---------------------------------------------------------------------------
{
  const ev = (event, extra = {}) => ({ event, ...extra });
  const state = (steps) => steps.map((s) => s.state);

  // A CLEAN RUN. Every step done, nothing outstanding.
  check('a completed issuance shows every step done',
    state(W.issuanceProgress([
      ev('ACADEMIC_APPROVED'), ev('ADMISSION_LETTER_GENERATED'),
      ev('ACCOUNT_CREATED'), ev('ADMISSION_PACKAGE_ISSUED'), ev('WELCOME_EMAIL_SENT'),
    ], { status: 'admission_issued', student_number: 'ICOF202600002', auth_user_id: 'u1' })),
    ['done', 'done', 'done', 'done', 'done', 'done', 'done']);

  // AN UNTOUCHED APPLICATION. Nothing has run; nothing is claimed.
  check('an application not yet issued shows nothing done',
    state(W.issuanceProgress([], { status: 'ready_for_academic_review' })),
    ['pending', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending']);

  // DOROTHY'S SECOND ATTEMPT, which is why this exists. The decision was
  // recorded and the package generated; the number reservation collided with
  // one already issued. The display must name that step and no other.
  {
    const steps = W.issuanceProgress([
      ev('ACADEMIC_APPROVED'), ev('ADMISSION_LETTER_GENERATED'),
      ev('ISSUANCE_FAILED', {
        detail: 'reserve the student number: duplicate key value violates unique constraint',
        metadata: { step: 'reserve the student number' },
      }),
    ], { status: 'admission_processing_failed' });
    check('a failed issuance names the step it stopped on',
      state(steps), ['done', 'done', 'failed', 'pending', 'pending', 'pending', 'pending']);
    check('…and carries what the database actually said',
      /duplicate key/.test(steps[2].detail ?? ''), true);
  }

  // THE ADMISSION STANDS AND ONLY THE TELLING FAILED. The email is the one step
  // whose failure invalidates nothing above it, so it is the one step with its
  // own failure event.
  {
    const steps = W.issuanceProgress([
      ev('ACADEMIC_APPROVED'), ev('ADMISSION_LETTER_GENERATED'), ev('ACCOUNT_CREATED'),
      ev('ADMISSION_PACKAGE_ISSUED'),
      ev('WELCOME_EMAIL_FAILED', { detail: 'the mail server refused the message' }),
    ], { status: 'admission_issued', student_number: 'ICOF202600003', auth_user_id: 'u2' });
    check('an undelivered email fails alone, with the admission intact',
      state(steps), ['done', 'done', 'done', 'done', 'done', 'done', 'failed']);
  }

  // EVERY STEP A FAILURE CAN NAME MUST BE A STEP THE DISPLAY KNOWS. A route
  // reporting a step spelled differently would show a pipeline where nothing
  // failed and nothing completed.
  {
    const route = readFileSync(join(here, '../app/api/admissions/decision/route.ts'), 'utf8');
    const named = [...route.matchAll(/failIssuance\('([^']+)'/g)].map((m) => m[1]);
    check('the scan found the failure points', named.length >= 4, true);
    check('every step a failure can name is one the pipeline displays',
      [...new Set(named)].filter((s) => !W.ISSUANCE_STEPS.includes(s)), []);
  }
}

console.log('\nIssuance is idempotent: a retry consumes nothing twice\n');

// ---------------------------------------------------------------------------
// THE DEFECT THIS CATCHES, WHICH THE UNIVERSITY NAMED AS A REQUIREMENT.
//
// The route reserved a student number unconditionally and wrote it to the
// record only at the last step. An issuance that reserved a number and then
// failed at any later step lost it: the counter had moved, nothing carried the
// reservation, and the next attempt took a fresh one. Each retry consumed
// another number permanently, leaving unexplained gaps in the University's
// sequence — and the same shape of fault created a second account.
//
// Idempotence has two halves and both are checked. The reservation must be
// SKIPPED when the record already carries one, and it must be PERSISTED
// immediately so that the next attempt can find it.
// ---------------------------------------------------------------------------
{
  const route = readFileSync(join(here, '../app/api/admissions/decision/route.ts'), 'utf8');

  check('an application that already has a number keeps it',
    /if \(app\.student_number\) \{\s*\n\s*studentNumber = String\(app\.student_number\)/.test(route), true);
  check('…and a new one is written to the record before anything can fail',
    /update\(\{ student_number: studentNumber \}\)/.test(route), true);

  check('an application already linked to an account reuses it',
    /if \(app\.auth_user_id\) \{[\s\S]{0,400}?updateUserById\(/.test(route), true);
  check('…and a new account is linked to the record at once',
    /update\(\{ auth_user_id: authUserId \}\)/.test(route), true);

  // THE HALF THAT IS EASY TO GET WRONG. Reusing an account without applying
  // the freshly generated password sends the applicant credentials that do not
  // work — a failure disguised as a success, which is the worst kind.
  const reuse = /if \(app\.auth_user_id\) \{([\s\S]*?)\n  \}/.exec(route)?.[1] ?? '';
  check('and reusing an account still sets the password that was emailed',
    /password/.test(reuse), true);
}

console.log('\nThe letter never invents a campus\n');

// ---------------------------------------------------------------------------
// THE DEFECT THIS CATCHES. `campus: app.campus || 'Buea'` printed Buea on the
// admission letter of any applicant whose record named no campus — a place the
// University had not said they would attend, on a formal document, produced by
// a default. For a student admitted to study online it sat directly under
// "Mode of study: Online", contradicting it.
//
// Read from the source rather than executed, because building the input pulls
// in the whole package module and its Node crypto dependencies; what matters
// here is that the fallback is not a place name.
// ---------------------------------------------------------------------------
{
  const pkg = readFileSync(join(here, 'admissionPackage.ts'), 'utf8');
  const builder = /export function admissionPackageInputFor[\s\S]*?\n}/.exec(pkg)?.[0] ?? '';
  check('the builder was found', builder.length > 200, true);

  // Not the campus line, and not anywhere else in it either.
  const invents = /campus:\s*app\.campus\s*\|\|\s*'(?!')[A-Z]/.test(builder);
  check('no place name is used as a fallback campus', invents, false);
  check('an online student’s letter says Online', /'Online'/.test(builder), true);

  // AND `row()` MUST DROP AN EMPTY VALUE, which is what makes omitting the
  // campus safe rather than printing "Campus:" with nothing after it.
  const rowFn = /const row = \(k: string, v: string \| undefined \| null\): string =>[\s\S]*?;/.exec(pkg)?.[0] ?? '';
  check('an empty particular is omitted rather than printed blank',
    /\?\s*`<tr>[\s\S]*?:\s*''/.test(rowFn), true);
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
