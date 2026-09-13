// ---------------------------------------------------------------------------
// THE STUDENT'S JOURNEY — every stage, and what it offers.
//
//   node src/lib/studentJourney.test.mjs
//
// The University's instruction was that the student portal show "information
// and actions appearing according to the student's actual status." That makes
// this file's table load-bearing: it decides what a person sees on the first
// screen after signing in.
//
// THE CASE THAT MATTERS MOST is the one a portal usually gets wrong. Somebody
// whose application is still under review must not be shown a curriculum, a
// timetable or a registration button — drawing the empty shell of those things
// tells them they have a place they have not been offered.
//
// The stage itself is decided in SQL by `student_stage()`, proved in migration
// 070. What is checked here is what each stage MEANS.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;
const ok = (m) => console.log(`ok    ${m}`);
const bad = (m) => { failures++; console.error(`FAIL  ${m}`); };
const check = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) ok(label);
  else bad(`${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
};

const dir = join(new URL('../../node_modules/.cache/icof', import.meta.url).pathname);
mkdirSync(dir, { recursive: true });
const srcRoot = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const bundle = join(dir, 'student-journey-test.mjs');
execFileSync('npx', [
  'esbuild', new URL('./studentJourney.ts', import.meta.url).pathname,
  '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`,
  '--log-level=error', `--alias:@=${srcRoot}`,
], { stdio: 'inherit' });
const J = await import(bundle);

console.log('\nEvery stage means something, and says what to do next\n');

for (const stage of J.STAGES) {
  const m = J.STAGE_MEANING[stage];
  if (!m) { bad(`${stage} has no meaning`); continue; }
  if (!m.heading || !m.says) { bad(`${stage} has no heading or sentence`); continue; }
  // EVERY STAGE EITHER OFFERS A NEXT STEP OR SAYS WHOSE MOVE IT IS. A stage
  // with neither leaves the reader on a page that describes their situation
  // and offers nothing — which is a status page, not a portal.
  if (!m.whatNext && !m.waitingOn) {
    bad(`${stage} offers no next step and does not say whose move it is`);
  } else {
    ok(`${stage}: ${m.whatNext ? `"${m.whatNext.label}"` : `waiting on ${m.waitingOn.split('.')[0]}`}`);
  }
  // AND THE DASHBOARD IS ALWAYS REACHABLE. A stage that hid it would leave
  // somebody signed in with no screen at all.
  if (!m.shows.includes('dashboard')) bad(`${stage} does not show the dashboard`);
}

console.log('\nA person who is not yet a student is not shown a student’s portal\n');

// THE ASSERTION THIS FILE EXISTS FOR.
for (const stage of ['applying', 'not-admitted', 'deferred', 'admitted', 'awaiting-programme']) {
  for (const view of ['course-registration', 'lms', 'timetable', 'my-programme']) {
    if (J.showsAtStage(stage, view)) {
      bad(`${stage} offers "${view}" — that tells somebody they have a place or a curriculum`);
    }
  }
  ok(`${stage} is offered no curriculum, timetable, registration or courses`);
}

console.log('\nAnd somebody who IS studying gets the whole of it\n');

for (const view of ['course-registration', 'lms', 'timetable', 'my-programme',
  'academic-records', 'results', 'transcript']) {
  check(`a studying student is offered "${view}"`, J.showsAtStage('studying', view), true);
}

console.log('\nA graduate keeps what is theirs and stops being offered what is not\n');

check('an alumnus is not offered course registration',
  J.showsAtStage('alumni', 'course-registration'), false);
check('…nor a timetable', J.showsAtStage('alumni', 'timetable'), false);
// KEPT FOR DECADES. A transcript and a certificate are wanted long after the
// last class, and a portal that withdraws them at graduation is one the
// graduate has to telephone.
check('…but keeps their transcript', J.showsAtStage('alumni', 'transcript'), true);
check('…and their credentials', J.showsAtStage('alumni', 'my-credentials'), true);
check('and a withdrawn student keeps their record',
  J.showsAtStage('withdrawn', 'academic-records'), true);
check('a suspended student cannot register',
  J.showsAtStage('suspended', 'course-registration'), false);

console.log('\nAn unknown stage is a working portal, not a blank screen\n');

const unknown = J.meaningOf('something-a-later-migration-added');
check('it still has a heading', typeof unknown.heading === 'string' && unknown.heading.length > 0, true);
check('it still says whose move it is', typeof unknown.waitingOn === 'string', true);
check('and it still shows the dashboard', J.showsAtStage('nonsense', 'dashboard'), true);
check('a null stage does not throw', typeof J.meaningOf(null).heading, 'string');

console.log('\nThe four words the University asked for\n');

check('a passed course is Completed',
  J.courseStanding('passed', true).label, 'Completed');
check('a registered course is In progress',
  J.courseStanding('registered', true).label, 'In progress');
check('an untaken course that IS offered this term is Outstanding',
  J.courseStanding('not-taken', true).label, 'Outstanding');
// THE DISTINCTION THAT NEEDED THE OFFERING. Calling a course nobody is running
// "outstanding" sends a student looking for a register button that is not there.
check('an untaken course that is NOT offered is Not yet available',
  J.courseStanding('not-taken', false).label, 'Not yet available');
check('and a failed course says it is to be repeated',
  J.courseStanding('failed', true).label, 'Failed — to be repeated');

console.log('');
console.log(failures === 0
  ? 'Every stage of the journey shows what belongs to it, and nothing that does not.\n'
  : `${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
