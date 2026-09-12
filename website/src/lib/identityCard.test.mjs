// ---------------------------------------------------------------------------
// WHO MAY HOLD A STUDENT CARD.
//
// Run with:  node src/lib/identityCard.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
//
// The card route decided this with a DENYLIST of eight statuses, and a denylist
// has to name every state that exists or it lets one through. It let thirteen
// through. `draft` — an application the applicant had not submitted — passed.
// So did `declined`, `returned`, `approved` and `admission_issued`, which means
// somebody offered a place but never registered could be handed an identity
// document saying they were a student here. The route's own refusal message
// says that must not happen.
//
// Nobody noticed because three of the states were unreachable until 036 built
// the controls that write them, and because nothing ever asked the question
// out loud. This asks it, for every state the vocabulary has, so the next state
// the University declares is refused a card until somebody decides otherwise.
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
const cache = join(here, '../../node_modules/.cache/icof');
mkdirSync(cache, { recursive: true });

const build = (file, name) => {
  const out = join(cache, name);
  execFileSync('npx', [
    'esbuild', join(here, file), '--bundle', '--format=esm', '--platform=node',
    `--outfile=${out}`, '--log-level=error', `--alias:@=${join(here, '..')}`,
  ]);
  return import(out);
};

const W = await build('admissionWorkflow.ts', 'awCard.mjs');
const S = await build('studentStatus.ts', 'ssCard.mjs');

// The rule, as the route states it. Read from the route rather than retyped, so
// a test that passes is a test about the shipped code.
const route = readFileSync(join(here, '../app/api/identity/card/route.ts'), 'utf8');
check('the route states the rule as a requirement, not a list of exclusions',
  /mayHoldAStudentCard/.test(route) && !/NOT_ENROLLED/.test(route), true);

// THE REAL FUNCTION, not a copy of it. A test that re-implements the rule it is
// testing proves the test author understood the rule and nothing at all about
// the code that ships — which is exactly how a denylist stays wrong through
// thirteen states.
const mayHoldACard = S.mayHoldAStudentCard;

console.log('\nOnly an enrolled student on the roll gets a card\n');

{
  check('an active enrolled student',
    mayHoldACard({ status: 'enrolled', student_status: 'active' }), true);

  // EVERY OTHER ADMISSION STATE IS REFUSED, including the ones nobody has
  // thought about. This is the assertion the denylist could not make.
  const wrongly = W.ADMISSION_STATES
    .filter((st) => st !== 'enrolled')
    .filter((st) => mayHoldACard({ status: st, student_status: 'active' }));
  check('no other admission state gets one', wrongly, []);

  // NAMED INDIVIDUALLY, because these are the ones that actually slipped
  // through and a reader should be able to see them refused by name.
  for (const st of ['draft', 'applicant', 'approved', 'conditional', 'admission_issued',
    'declined', 'returned', 'under_review', 'documents_verified', 'fee_pending']) {
    check(`…including ${st}`, mayHoldACard({ status: st, student_status: 'active' }), false);
  }
}

console.log('\nAnd being enrolled once is not enough\n');

{
  // A card is a CURRENT identity document. A graduate's says they are a student
  // here, and they are not.
  for (const became of ['graduated', 'withdrawn', 'suspended']) {
    check(`a ${became} student gets no new card`,
      mayHoldACard({ status: 'enrolled', student_status: became }), false);
  }
  check('and neither does an enrolment with nothing recorded against it',
    mayHoldACard({ status: 'enrolled', student_status: null }), false);
}

console.log('\nThe office that keeps the register, and no other\n');

{
  const roles = await build('roles.ts', 'rolesCard.mjs');
  const CAP = 'create-student-record';

  check('the Registrar may issue a card', roles.can('registrar', CAP), true);
  check('the Superadministrator may', roles.can('superadmin', CAP), true);

  // THE ONE FROM THE SCREENSHOT. Finance pressed the button and got the
  // server's refusal code in a dialog. The refusal was right; offering the
  // button was not.
  check('Finance may not', roles.can('finance', CAP), false);
  check('the Admissions Office may not', roles.can('admissions-officer', CAP), false);
  check('a student certainly may not', roles.can('student', CAP), false);

  // AND THE SCREEN ASKS THE SAME QUESTION THE SERVER DOES. A button drawn from
  // a different rule than the one the route enforces is a button that refuses
  // people for reasons the screen cannot explain.
  const screen = readFileSync(join(here, '../components/students/StudentManagement.tsx'), 'utf8');
  check('the screen gates the button on the route’s own capability',
    new RegExp(`can\\(user\\?\\.role, '${CAP}'\\)`).test(screen), true);
  check('…and the route requires it',
    new RegExp(`CAPABILITY = '${CAP}'`).test(route), true);
}

console.log('\nA refusal about the caller does not read as a fault in the record\n');

{
  const dialog = readFileSync(join(here, '../components/students/StudentIDCard.tsx'), 'utf8');

  // THE MESSAGE A HUMAN SAW: `not-permitted:create-student-record`. It names an
  // internal capability, does not say who does hold it, and reads as breakage.
  check('the raw error code is translated', /function explainCardError/.test(dialog), true);
  check('…and the code is no longer printed as-is',
    /setProblem\(res\?\.error\b/.test(dialog), false);

  // AND THE HEADING SPLITS. "No card can be issued yet" sent somebody looking
  // through a student record for something missing, when the refusal was about
  // them.
  check('a permission refusal gets its own heading',
    /This is not yours to issue/.test(dialog), true);
  check('…and the record-not-ready heading is kept for the record',
    /refusals \? 'No card can be issued yet'/.test(dialog), true);
}

console.log(failures === 0 ? '\nAll identity card checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
