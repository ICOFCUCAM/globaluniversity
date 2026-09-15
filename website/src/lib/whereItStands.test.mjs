// ---------------------------------------------------------------------------
// "WHY IS DOROTHY THE ONLY ENROLLED?"
//
// Run with:  node src/lib/whereItStands.test.mjs
//
// ---------------------------------------------------------------------------
// WHAT THIS GUARDS
// ---------------------------------------------------------------------------
//
// The University asked twice, weeks apart:
//
//     "Mabel is also enrolled and why is it not showing here?
//      They were supposed to be two enrolled."
//     "Why is Dorothy the only enrolled?"
//
// Both times the answer was the same — the other applicant had not reached the
// Registrar's desk — and both times the SCREEN COULD NOT SAY SO. It showed two
// numbers and "Nobody is waiting", which is true of that desk and reads as a
// statement about the whole University. A register that cannot say where
// somebody is sends the person who asked to ask a human instead, and that is
// the fault, not the data.
//
// So `whereItStands` turns a state into an office and a sentence, and the
// Enrolment screen lists everybody who is not at it.
//
// WHAT IS MEASURED HERE:
//
//   1. EVERY state the pipeline can hold has an answer. A state added later
//      and forgotten here would print "recorded as ready_for_academic_review"
//      at somebody, which is the vocabulary problem all over again.
//   2. The answer is a SENTENCE, not a state name echoed back.
//   3. An outcome is not described as waiting on anybody.
//   4. The screen actually asks for the other records and renders them.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;
const check = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`ok    ${label}`);
  } else {
    failures++;
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
  }
};

const here = new URL('.', import.meta.url).pathname;
const cache = join(here, '../../node_modules/.cache/icof');
mkdirSync(cache, { recursive: true });

const out = join(cache, 'whereItStands.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'admissionWorkflow.ts'), '--bundle', '--format=esm',
  '--platform=node', `--outfile=${out}`, '--log-level=error',
  `--alias:@=${join(here, '..')}`,
]);
const W = await import(out);

console.log('\nEvery state the register can hold can say where it stands\n');

// --- 1. NO STATE IS UNACCOUNTED FOR ----------------------------------------
//
// Named one by one in the failure rather than counted, because a count would
// say "two missing" and leave somebody to find which two.
const unexplained = W.ADMISSION_STATES.filter((st) => {
  const w = W.whereItStands(st);
  return !w || !w.waitingFor || w.waitingFor.startsWith('Recorded as ');
});
check('no state falls through to its own name', unexplained, []);

// --- 2. IN WORDS, NOT IN VOCABULARY ----------------------------------------
//
// An officer reading "ready_for_academic_review" has to know the vocabulary;
// one reading "Awaiting the academic decision" does not.
const echoed = W.ADMISSION_STATES.filter(
  (st) => W.whereItStands(st).waitingFor.includes(st));
check('and no answer just echoes the state name back', echoed, []);

// --- 3. THE TWO THE UNIVERSITY ACTUALLY HIT --------------------------------
//
// `approved` is where an applicant sits when the Head of Academic Affairs has
// admitted them and the issuance has not completed. That is where the missing
// person was all three times, and the sentence has to say more than "approved".
//
// ---------------------------------------------------------------------------
// AND IT MUST NOT SAY WHAT THIS TEST USED TO DEMAND
// ---------------------------------------------------------------------------
//
// The assertion here was
//
//     /no letter[\s\S]*no student number[\s\S]*no account/
//
// which pinned the message to a flat claim that the record has none of the
// three. `approved` is ALSO where a partly-completed issuance comes to rest,
// and where every admission taken before the issuance states existed still
// sits — so a record here may have a number and an account already.
//
// The University hit it: the Enrolment desk printed "no student number" beside
// a student whose own row, two columns to the left, showed ICOF202600001. They
// then went looking for an enrolment button, on the strength of a sentence that
// was wrong. A test that pins an untrue sentence in place is worse than no test
// — it defends the defect.
//
// So the requirement is now: name the office, say the issuance has not
// completed, name the control that finishes it, and DO NOT claim to know what
// the record already has.
{
  const approved = W.whereItStands('approved');
  check('an admitted-but-not-issued applicant names the office holding it',
    approved.office, 'Office of Academic Affairs');
  check('…and says the issuance has not completed',
    /issuance has not completed/i.test(approved.waitingFor), true);
  check('…and names the control that finishes it',
    /issue admission/i.test(approved.waitingFor), true);
  check('…and does NOT claim the record has no student number',
    /no student number/i.test(approved.waitingFor), false);

  const failed = W.whereItStands('admission_processing_failed');
  check('a half-finished issuance says it can be retried',
    /retry/i.test(failed.waitingFor), true);
}

// --- 4. AN OUTCOME IS NOT WAITING ON ANYBODY -------------------------------
//
// "Refused by the Head of Academic Affairs" is finished. Printing an office
// beside it would put a refused applicant on somebody's queue.
for (const st of ['rejected', 'declined', 'deferred', 'withdrawn']) {
  check(`${st} is finished with, not waiting on an office`,
    W.whereItStands(st).office, null);
}

// And the states that ARE on somebody's desk name one.
for (const st of ['under_review', 'fee_pending', 'ready_for_academic_review', 'approved']) {
  check(`${st} names the office holding it`,
    typeof W.whereItStands(st).office === 'string', true);
}

// --- 5. AN UNKNOWN STATE STILL ANSWERS -------------------------------------
//
// `students.status` carries no CHECK constraint, so a value nothing in this
// codebase writes can exist on the University's database. It must not render a
// blank cell.
check('a state nobody declared still says something',
  W.whereItStands('something_nobody_declared').waitingFor.length > 0, true);
check('…and so does an empty one',
  W.whereItStands(null).waitingFor.length > 0, true);

console.log('\nAnd the Enrolment desk asks the question on the officer’s behalf\n');

// --- 6. THE SCREEN ---------------------------------------------------------
const screen = readFileSync(
  join(here, '../components/admissions/Enrolment.tsx'), 'utf8')
  // COMMENTS STRIPPED. This screen's comments quote the University's question
  // verbatim, so an unstripped read would match its own explanation.
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

check('the desk asks for the records that are NOT at it',
  /\.not\('status', 'in'/.test(screen), true);
check('…and explains each one with whereItStands',
  /whereItStands\(r\.status\)/.test(screen), true);
check('…under a heading that says it is not this desk’s queue',
  /Not at this desk yet/.test(screen), true);

// --- 7. AND WHETHER THE ACCOUNT EXISTS -------------------------------------
//
// "Those enrolled are supposed to have a student account with username and
// password." They are — the account is created when the admission is ISSUED,
// not here — but the desk that records enrolment could not show whether one
// exists, so an issuance that failed part way looked exactly like one that
// worked.
check('the enrolled list carries the account', /auth_user_id/.test(screen), true);
check('…and says plainly when there is none', /No account/.test(screen), true);
// THE PASSWORD IS NEVER SHOWN. It is generated once, sent in the welcome email
// and not kept; a screen that displayed one would be displaying a stale value
// or storing something it must not.
check('…and never shows a password', /password/i.test(screen), false);

console.log(failures ? `\n${failures} check(s) failed.\n` : '\nAll checks passed.\n');
process.exit(failures ? 1 : 0);
