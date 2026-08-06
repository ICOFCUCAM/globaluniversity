// ---------------------------------------------------------------------------
// The grade approval chain — can the wrong person move a mark?
//
// Run with:  node src/lib/resultsWorkflow.test.mjs
//
// WHY THIS FILE EXISTS. Everything downstream of a mark depends on these rules:
// a term average is 'approved' only when every mark in it is, a certificate may
// only be issued against an approved average, and a degree is conferred on a
// certificate. If this state machine can be walked by one person, or a step can
// be skipped, the university's degrees rest on nothing — and it would look
// exactly the same from the outside as if it worked.
//
// The rules are also the kind that survive review by looking obviously correct.
// "Only the Dean may approve for the faculty" reads as true whether or not the
// code says it, which is why this enumerates every actor against every state
// rather than checking the happy path and one refusal.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
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

const dir = join(new URL('../../node_modules/.cache/icof', import.meta.url).pathname);
mkdirSync(dir, { recursive: true });
const bundle = join(dir, 'workflow-test.mjs');
execFileSync('npx', [
  'esbuild', new URL('./resultsWorkflow.ts', import.meta.url).pathname,
  '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`, '--log-level=error',
  `--alias:@=${new URL('.', import.meta.url).pathname.replace(/\/[^/]*$/, '')}`,
], { stdio: 'inherit' });

const W = await import(bundle);

const rolesBundle = join(dir, 'roles-test.mjs');
execFileSync('npx', [
  'esbuild', new URL('./roles.ts', import.meta.url).pathname,
  '--bundle', '--format=esm', '--platform=node', `--outfile=${rolesBundle}`, '--log-level=error',
], { stdio: 'inherit' });
const { can } = await import(rolesBundle);

/** An actor as the route builds one: an id and a role's capability predicate. */
const person = (id, role) => ({ id, holds: (c) => can(role, c) });

// ===========================================================================
// 1. THE CHAIN IS THE ONE THE UNIVERSITY PUBLISHED
// ===========================================================================

check('four steps', W.STAGES.length, 4);
check(
  'the offices, in order',
  W.STAGES.map((s) => s.actor),
  ['Lecturer', 'Head of Department', 'Dean', 'Registrar'],
);
check(
  'the states, in order',
  [W.STAGES[0].from, ...W.STAGES.map((s) => s.to)],
  ['draft', 'submitted', 'moderated', 'faculty-approved', 'approved'],
);
check(
  'each step needs a different capability',
  new Set(W.STAGES.map((s) => s.capability)).size,
  4,
);

// ===========================================================================
// 2. EVERY ROLE AGAINST EVERY STATE
//
// The matrix, not the happy path. For each state, exactly one role in the chain
// may advance it, and it is the one whose step that is.
// ===========================================================================

const CHAIN_ROLES = ['lecturer', 'hod', 'dean', 'registrar'];
const OUTSIDERS = ['student', 'finance', 'applicant', 'library-staff', 'chancellor'];

for (const [i, stage] of W.STAGES.entries()) {
  for (const [j, role] of CHAIN_ROLES.entries()) {
    // A fresh person each time, so the four-people rule never interferes here.
    const d = W.mayAdvance(person(`p-${role}`, role), { status: stage.from });
    check(
      `${role} ${i === j ? 'MAY' : 'may not'} advance from '${stage.from}'`,
      d.ok,
      i === j,
    );
  }
  for (const role of OUTSIDERS) {
    const d = W.mayAdvance(person(`o-${role}`, role), { status: stage.from });
    check(`  ${role} may not advance from '${stage.from}'`, [d.ok, d.refusal], [false, 'not-your-step']);
  }
}

// ===========================================================================
// 3. NO STEP MAY BE SKIPPED
//
// The Registrar cannot publish a draft. This is the failure that would matter
// most: it would put unmoderated marks on the academic record and a degree
// could be conferred on them.
// ===========================================================================

check(
  'the Registrar cannot publish a draft',
  W.mayAdvance(person('reg', 'registrar'), { status: 'draft' }).refusal,
  'not-your-step',
);
check(
  'the Registrar cannot publish a merely submitted class',
  W.mayAdvance(person('reg', 'registrar'), { status: 'submitted' }).refusal,
  'not-your-step',
);
check(
  'the Dean cannot approve a class the department has not moderated',
  W.mayAdvance(person('dean', 'dean'), { status: 'submitted' }).refusal,
  'not-your-step',
);
check(
  'nothing advances past published',
  W.mayAdvance(person('reg2', 'registrar'), { status: 'approved' }).refusal,
  'already-published',
);

// ===========================================================================
// 4. THE FOUR-PEOPLE RULE
//
// This is the one an administrator would otherwise defeat: `admin` is every
// operational capability, so one administrator holds all four steps.
// ===========================================================================

const admin = person('admin-1', 'admin');

check('an administrator holds all four steps', W.STAGES.map((s) => admin.holds(s.capability)), [true, true, true, true]);

check(
  'and may still perform any ONE of them',
  W.STAGES.map((s) => W.mayAdvance(admin, { status: s.from }).ok),
  [true, true, true, true],
);

// Now walk the chain with that administrator's signature already on it.
let mark = { status: 'draft' };
mark = { ...mark, status: 'submitted', submitted_by: 'admin-1' };
check(
  'having submitted, the administrator may not moderate',
  W.mayAdvance(admin, mark).refusal,
  'already-acted',
);
check(
  'but somebody else may',
  W.mayAdvance(person('hod-1', 'hod'), mark).ok,
  true,
);

mark = { ...mark, status: 'moderated', moderated_by: 'hod-1' };
check(
  'the administrator still may not approve for the faculty, two steps later',
  W.mayAdvance(admin, mark).refusal,
  'already-acted',
);

mark = { ...mark, status: 'faculty-approved', faculty_approved_by: 'dean-1' };
check(
  'nor publish, three steps later — one signature is one signature',
  W.mayAdvance(admin, mark).refusal,
  'already-acted',
);
check(
  'a fourth person publishes',
  W.mayAdvance(person('reg-1', 'registrar'), mark).ok,
  true,
);

// The narrower rule this replaces would have allowed exactly this: two people
// alternating to produce four approvals.
const a = person('two-1', 'admin');
const b = person('two-2', 'admin');
const alternating = {
  status: 'faculty-approved',
  submitted_by: 'two-1',
  moderated_by: 'two-2',
  faculty_approved_by: 'two-1',
};
check(
  'two people cannot produce four approvals by alternating',
  W.mayAdvance(b, alternating).refusal,
  'already-acted',
);

// ===========================================================================
// 5. RETURNING
// ===========================================================================

check(
  'a reason is required',
  W.mayReturn(person('hod-2', 'hod'), { status: 'submitted' }, '   ').refusal,
  'reason-required',
);
check(
  'a draft cannot be sent back — it has not gone anywhere',
  W.mayReturn(person('hod-2', 'hod'), { status: 'draft' }, 'no').refusal,
  'nothing-to-return',
);
check(
  'published marks are not returned through this door',
  W.mayReturn(person('reg-2', 'registrar'), { status: 'approved' }, 'wrong').refusal,
  'already-published',
);
check(
  'the Head of Department may return a class awaiting moderation',
  W.mayReturn(person('hod-2', 'hod'), { status: 'submitted' }, 'Four exam marks missing.').ok,
  true,
);
check(
  'the Registrar may return a class that has reached them',
  W.mayReturn(person('reg-2', 'registrar'), { status: 'faculty-approved' }, 'Wrong cohort.').ok,
  true,
);
check(
  'a lecturer cannot return a class that is with the Dean — it is not theirs to refuse',
  W.mayReturn(person('lec-2', 'lecturer'), { status: 'moderated' }, 'changed my mind').refusal,
  'not-your-step',
);
check(
  'a student cannot return anything',
  W.mayReturn(person('stu', 'student'), { status: 'submitted' }, 'I failed').refusal,
  'not-your-step',
);

// A return clears every signature. Leaving them would show a class as moderated
// by somebody who moderated a different set of numbers.
const cleared = W.returnPatch('hod-3', 'Marks transposed for two students.', '2026-01-01T00:00:00Z');
check('a return goes all the way to draft', cleared.status, 'draft');
check(
  'and withdraws every signature',
  [cleared.submitted_by, cleared.moderated_by, cleared.faculty_approved_by, cleared.approved_by],
  [null, null, null, null],
);
check('and records why', cleared.returned_reason, 'Marks transposed for two students.');

// ===========================================================================
// 6. THE PATCH A STEP WRITES
// ===========================================================================

for (const stage of W.STAGES) {
  const patch = W.advancePatch(stage, 'who', '2026-01-01T00:00:00Z');
  check(`  ${stage.to}: status`, patch.status, stage.to);
  check(`  ${stage.to}: attributed`, patch[stage.byColumn], 'who');
  check(`  ${stage.to}: timestamped`, patch[stage.atColumn], '2026-01-01T00:00:00Z');
  check(`  ${stage.to}: clears any objection`, patch.returned_reason, null);
}

// ===========================================================================
// 7. EDITABILITY
//
// A mark may be edited only while the class is a draft. This is what stops a
// lecturer changing a mark the Dean has already approved.
// ===========================================================================

check(
  'only a draft is editable',
  W.RESULT_STATUSES.map((s) => W.isEditable(s)),
  [true, false, false, false, false],
);

console.log(failures === 0 ? '\nAll approval-chain checks passed.' : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
