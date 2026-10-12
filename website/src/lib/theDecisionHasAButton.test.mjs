// ---------------------------------------------------------------------------
// AN APPOINTMENT COUNTED AS WAITING ON THE VICE-CHANCELLOR HAS A BUTTON.
//
// Run with:  node src/lib/theDecisionHasAButton.test.mjs
//
// ---------------------------------------------------------------------------
// WHAT HAPPENED
// ---------------------------------------------------------------------------
//
// The Vice-Chancellor opened Appointments, saw
//
//     Awaiting VC
//     1
//
// clicked it, read the one row — Prof Aaron Ndenka, Director of Academic
// Affairs, "Amendment requested" — and asked where the approval was.
//
// THERE WAS NOWHERE. Four places decided whether that appointment was waiting
// on the appointing authority, and three of them said yes:
//
//   the dashboard counter      submitted OR amendment_requested   → counted it
//   the drill-down             submitted OR amendment_requested   → listed it
//   canAuthorize / the route   submitted OR amendment_requested   → would accept
//   the SCREEN's buttons       a.status === 'submitted'           → drew nothing
//
// So the system counted the work, listed the work, would have accepted the
// decision, and offered no way to take it.
//
// ---------------------------------------------------------------------------
// WHAT HAS TO STAY TRUE
// ---------------------------------------------------------------------------
//
// THE FOUR ANSWER THE SAME QUESTION, by asking the same function. That is the
// whole of the fix: `isAwaitingAuthority` is one sentence in one file, and a
// status added to it later is added once.
//
// This is a shape of fault this codebase has met repeatedly — a count and a
// list with different sources, machinery with no door — and the only check
// that catches it is one that compares the readers against each other rather
// than each against its own expectation.
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

const out = join(root, 'node_modules', '.cache', 'iguc-tests', 'appointments-decision.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'appointments.ts'),
  '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error',
  `--alias:@=${join(root, 'src')}`,
]);
const {
  isAwaitingAuthority, canAuthorize, canAuthorizeAlone, dashboardCounters, matching,
} = await import(out);

const screen = read('src/components/hr/Appointments.tsx');
const board = read('src/components/hr/AppointmentDashboard.tsx');
const route = read('src/app/api/appointments/route.ts');

const HR = 'hr-uuid';
const VC = 'vc-uuid';
const of = (status) => ({ id: 'a1', status, drafted_by: HR, full_name: 'Proof Appointee' });

// ---------------------------------------------------------------------------
console.log('\nThe counter, the list, the route and the screen agree on every status\n');

// EVERY STATUS THE BOARD CAN SHOW, not only the two that are interesting.
// The fault was a disagreement on one of them, and the only way to be sure
// there is not another is to ask about all of them.
const STATUSES = [
  'draft', 'under_review', 'submitted', 'amendment_requested', 'approved',
  'letter_generated', 'issued', 'accepted', 'active', 'declined', 'withdrawn', 'ended',
];

const disagree = [];
for (const status of STATUSES) {
  const a = of(status);
  const counted = dashboardCounters([a]).awaitingVc === 1;
  const listed = matching([a], 'awaitingVc').length === 1;
  const accepted = canAuthorize(a, VC) || canAuthorizeAlone(a, VC, 'vice-chancellor');
  const drawn = isAwaitingAuthority(a);
  if (new Set([counted, listed, accepted, drawn]).size !== 1) {
    disagree.push({ status, counted, listed, accepted, drawn });
  }
}
check('no status is counted, listed or accepted without a button', disagree, []);

// AND THE TWO THAT MATTER, NAMED, so a regression says which.
check('a submitted appointment is awaiting the authority',
  isAwaitingAuthority(of('submitted')), true);
check('…and so is one whose amendment was requested — the one that had no button',
  isAwaitingAuthority(of('amendment_requested')), true);
check('a draft is not', isAwaitingAuthority(of('draft')), false);
check('nor is one already approved', isAwaitingAuthority(of('approved')), false);

// ---------------------------------------------------------------------------
console.log('\nAnd the screen asks that question rather than restating it\n');

// THE REGRESSION TO PREVENT IS LITERAL: a screen that writes the status out
// again is a screen that can be told about one new status and not the other.
check('the decision block is gated on the shared predicate',
  /\{isAwaitingAuthority\(a\) && mayApprove &&/.test(screen), true);
check('…and no longer on a status it writes out itself',
  /a\.status === 'submitted' && mayApprove/.test(screen), false);
check('the library holds the sentence once',
  (read('src/lib/appointments.ts').match(/status === 'amendment_requested'/g) ?? []).length, 1);

// ---------------------------------------------------------------------------
console.log('\nThe board says where the decision is taken\n');

// THE SECOND HALF OF THE FAULT. Even once the button exists it is on the
// OTHER screen, and the one the Vice-Chancellor opened said nothing about it.
check('the board points at the board that decides',
  /onNavigate\('appointments-board'\)/.test(board), true);
check('…only on the counter that is waiting on them',
  /drill === 'awaitingVc' && shown\.length > 0 && mayAuthorize/.test(board), true);
check('…and only to the office that holds the authority',
  /mayAuthorize = can\(user\?\.role, 'authorize-appointment'\)/.test(board), true);

// ---------------------------------------------------------------------------
console.log('\nAll three decisions are on the screen that takes them\n');

// THE UNIVERSITY, LOOKING AT THE ROW: "approve and return it button. where is
// disapproved button?"
//
// It existed, and it was called "The University withdraws it", inside a
// dropdown labelled "Close this appointment…" — a label that reads as filing
// rather than as refusing. The office being asked to decide was offered two of
// the three decisions and had to find the third somewhere that did not look
// like a decision.
check('approving is on the decision block', /<Check size=\{14\} \/> Approve/.test(screen), true);
check('returning says it goes back for changes',
  /Return for changes/.test(screen), true);
check('and refusing is there, named as a refusal',
  /Do not appoint/.test(screen), true);

// IT IS THE SAME REFUSAL THE SYSTEM ALREADY HAD, not a second one: the same
// `close` action, the same `withdrawn` outcome, the same capability. One
// refusal, with a name on this screen that says what it does.
check('…and it writes the outcome the system already had',
  /action: 'close', id: a\.id, outcome: 'withdrawn', reason/.test(screen), true);

// THE REASON MINIMUMS COME FROM THE LIBRARY, not from numbers typed into the
// screen. A button enabled at 12 characters against a route that demands more
// is a button that fails when pressed.
check('the return button uses the library minimum',
  /reason\.trim\(\)\.length < MIN_RETURN_REASON/.test(screen), true);
check('…and the refusal uses its own',
  /reason\.trim\(\)\.length < MIN_CLOSURE_REASON/.test(screen), true);

// AND "THE APPOINTEE DECLINED IT" STAYS WHERE IT WAS, because it is not the
// University's decision at all.
check('the appointee’s own refusal is not offered as a VC decision',
  /outcome: 'declined'/.test(
    (/isAwaitingAuthority\(a\) && mayApprove[\s\S]*?Do not appoint/.exec(screen) ?? [''])[0],
  ), false);

// ---------------------------------------------------------------------------
console.log('\nAnd the board is a way through, not just a count\n');

check('every row links to the screen that decides',
  /onClick: \(\) => onNavigate\('appointments-board'\)/.test(board), true);
check('…reachable from the keyboard too',
  /onKeyDown/.test(board) && /e\.key === 'Enter'/.test(board), true);
check('…and shown only to somebody with work to do there',
  /const mayAct = mayAuthorize \|\| can\(user\?\.role, 'draft-appointment'\)/.test(board), true);

// ---------------------------------------------------------------------------
console.log('\nThe route is unchanged, and still refuses what it always did\n');

check('deciding is guarded on authorize-appointment',
  /decide: 'authorize-appointment'/.test(route), true);
check('a drafter still cannot be their own second pair of eyes',
  canAuthorize(of('submitted'), HR), false);
check('…unless they are the appointing authority, which is the ruling',
  canAuthorizeAlone(of('submitted'), HR, 'vice-chancellor'), true);
check('…and an HR officer is refused it',
  canAuthorizeAlone(of('submitted'), HR, 'hr-officer'), false);

// ---------------------------------------------------------------------------
console.log(failures === 0
  ? '\nAll good.\n'
  : `\n${failures} failure${failures === 1 ? '' : 's'}.\n`);
process.exit(failures === 0 ? 0 : 1);
