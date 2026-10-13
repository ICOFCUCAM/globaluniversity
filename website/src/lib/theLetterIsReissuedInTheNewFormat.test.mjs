// ---------------------------------------------------------------------------
// EVERY ACTION A SCREEN SENDS REACHES A ROUTE THAT IMPLEMENTS IT.
//
// Run with:  node src/lib/theLetterIsReissuedInTheNewFormat.test.mjs
//
// ---------------------------------------------------------------------------
// WHAT HAPPENED
// ---------------------------------------------------------------------------
//
// The University, looking at Prof Aaron Ndenka's appointment: "the issue
// button that cause the letter to be reissue in the new format it not working.
// instead the letter is in the old format still."
//
// Three separate faults, and each one alone was enough.
//
//   1. THE REFORMAT BUTTON POSTED TO THE WRONG ROUTE. It called
//      `act({ action: 'reformat' })`, and `act` posts to /api/appointments.
//      `reformat` is implemented in /api/appointments/letter. The appointment
//      route rejects an unknown action at its capability map, so the one act
//      that re-renders a letter in the current house style had never once
//      reached the code that performs it.
//
//   2. THE BUTTON WAS NOT DRAWN ON THIS ROW ANYWAY. It asked for a status of
//      `issued`, `accepted` or `active`. An amendment puts the appointment
//      back to `letter_generated`, and approving one puts it back to
//      `approved`, while `issued_at` stays set — because somebody was issued a
//      letter and that did not stop being true. The row offered "Open the
//      issued letter (PDF)", which is gated on exactly that field, beside no
//      way to re-render it.
//
//   3. SO THE ONLY BUTTON LEFT WAS "ISSUE THE LETTER", WHICH RE-SENDS. `issue`
//      on an appointment carrying an `issued_at` loads the archived letter and
//      delivers it again, unchanged — deliberately, so a crash after issuing is
//      resumable. Under that label it reads as a button that does not work.
//      The letter stayed in the old format because nothing had re-rendered it.
//
// ---------------------------------------------------------------------------
// WHAT HAS TO STAY TRUE
// ---------------------------------------------------------------------------
//
// THE GENERAL GUARD IS THE POINT, not the three fixes. A screen that posts an
// action to a route that does not implement it is a dead button, and nothing
// in the type system catches it: both ends speak in string literals. So this
// reads the capability map out of each route and the action out of each call
// site, and insists the two agree — for every action, not for the one that
// was reported.
//
// The check that was supposed to hold this read `/action: 'reformat'/` against
// the screen: that the WORD appears somewhere in the file. It did. It was on
// the same line as the call to the wrong function.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let failures = 0;
const check = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`ok    ${label}`);
  } else {
    failures++;
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n`
      + `      actual   ${JSON.stringify(actual)}`);
  }
};

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const out = join(root, 'node_modules', '.cache', 'iguc-tests', 'appointments-reissue.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'appointments.ts'),
  '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error',
  `--alias:@=${join(root, 'src')}`,
]);
const { hasALetter } = await import(out);

const screen = read('src/components/hr/Appointments.tsx');
const letterRoute = read('src/app/api/appointments/letter/route.ts');
const apptRoute = read('src/app/api/appointments/route.ts');

/** The actions a route will actually accept, read off its capability map. */
const implemented = (source) => {
  const start = source.indexOf('const CAPABILITY: Record<string, Capability> = {');
  const block = source.slice(start, source.indexOf('\n};', start));
  return new Set(Array.from(block.matchAll(/^\s{2}(\w+):/gm), (m) => m[1]));
};

const LETTER_ACTIONS = implemented(letterRoute);
const APPOINTMENT_ACTIONS = implemented(apptRoute);

// Sanity: if these come back empty the rest of the file proves nothing.
check('the letter route’s actions were found', LETTER_ACTIONS.size > 0, true);
check('the appointment route’s actions were found', APPOINTMENT_ACTIONS.size > 0, true);

// ---------------------------------------------------------------------------
console.log('\nEvery action the screen sends is implemented by the route it sends it to\n');

const sentTo = (re) => Array.from(screen.matchAll(re), (m) => m[1]);

// `letter(...)` posts to /api/appointments/letter.
const viaLetter = sentTo(/\bletter\('([a-z]+)'/g);
check('the screen does call the letter route', viaLetter.length > 0, true);
check('…and every action it sends there exists there',
  viaLetter.filter((a) => !LETTER_ACTIONS.has(a)), []);

// `act({ action: '…' })` posts to /api/appointments. THIS IS THE ONE THAT FAILED:
// `reformat` was in this list and is not an appointment action.
const viaAct = sentTo(/\bact\(\{\s*action: '([a-z]+)'/g);
check('the screen does call the appointment route', viaAct.length > 0, true);
check('…and every action it sends there exists there',
  viaAct.filter((a) => !APPOINTMENT_ACTIONS.has(a)), []);

// And the direct posts, which bypass both helpers.
const direct = Array.from(
  screen.matchAll(/authedPost\('\/api\/appointments\/letter', \{\s*\n?\s*action: '([a-z]+)'/g),
  (m) => m[1],
);
check('…and so does every action posted to the letter route directly',
  direct.filter((a) => !LETTER_ACTIONS.has(a)), []);

// NAMED, so a regression says which button died.
check('reformat goes to the route that implements it',
  /letter\('reformat', a\.id\)/.test(screen), true);
check('…and the appointment route is not asked for it',
  APPOINTMENT_ACTIONS.has('reformat'), false);

// ---------------------------------------------------------------------------
console.log('\nThe button is drawn wherever there is a letter to re-render\n');

// THE ROUTE'S OWN PRECONDITION, which is not a status at all: `reformat` loads
// the current letter and refuses with `nothing-to-reformat` if there is none.
check('the route asks whether a letter exists',
  /nothing-to-reformat/.test(letterRoute), true);
check('…and the screen asks the same question',
  /\{hasALetter\(a\) && mayIssue &&/.test(screen), true);
check('…rather than a list of statuses that leaves this row out',
  /\['issued', 'accepted', 'active'\]\.includes\(String\(a\.status\)\) && mayIssue/.test(screen),
  false);

// THE ROW THE UNIVERSITY WAS LOOKING AT. Badge "Letter ready", which is
// `approved` or `letter_generated`, with `issued_at` set from the first issue.
check('an approved appointment that has already been issued has a letter',
  hasALetter({ status: 'approved', issued_at: '2026-09-14T00:00:00Z' }), true);
check('…and so does one sitting at letter_generated after an amendment',
  hasALetter({ status: 'letter_generated' }), true);
check('…and an issued one', hasALetter({ status: 'issued' }), true);
check('…and an accepted one', hasALetter({ status: 'accepted' }), true);
check('…and an active one', hasALetter({ status: 'active' }), true);

// AND IT IS NOT DRAWN WHERE THERE IS NOTHING, which is what stops the button
// teaching people that buttons refuse.
check('a draft has no letter', hasALetter({ status: 'draft' }), false);
check('nor has one awaiting approval', hasALetter({ status: 'submitted' }), false);
check('nor an approved one that was never issued',
  hasALetter({ status: 'approved', issued_at: null }), false);
check('nor one whose amendment is being considered',
  hasALetter({ status: 'amendment_requested' }), false);

// ---------------------------------------------------------------------------
console.log('\nAnd the issue button says which of the two things it is about to do\n');

// IT RE-SENDS. The route is explicit, and the label has to be.
check('the route re-sends rather than re-renders once issued',
  /if \(appointment\.issued_at\) \{\s*\n\s*const result = await deliver/.test(letterRoute), true);
check('the button says so when that is what it will do',
  /Send the archived letter again/.test(screen), true);
check('…and still says Issue where it will actually issue',
  /'Issue the letter'/.test(screen), true);
check('…and points at the button that does change the format',
  /It does not re-render it/.test(screen), true);

// THE SUPERSEDING LETTER HAD NO DOOR. `amend` archives version 2 and leaves
// the appointment at `letter_generated`; "Issue the letter" asked for
// `approved` and "Send it again" for `issued`, so nothing offered to send it.
check('an appointment with a generated letter can be issued',
  /\['approved', 'letter_generated'\]\.includes\(String\(a\.status\)\) && mayIssue/.test(screen),
  true);

// ---------------------------------------------------------------------------
console.log(failures === 0
  ? '\nThe reformat reaches the route, on every row that has a letter.\n'
  : `\n${failures} failure${failures === 1 ? '' : 's'}.\n`);
process.exit(failures === 0 ? 0 : 1);
