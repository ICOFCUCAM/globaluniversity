// ---------------------------------------------------------------------------
// IS IT ON OFFER? — every refusal, watched refusing.
//
//   node src/lib/courseOffering.test.mjs
//
// A rule nobody has watched refuse anything is a rule nobody has tested. Five
// new answers arrived with 063 — not offered this term, not open yet, closed,
// cancelled, full — and each one is asserted here by constructing the state
// that should produce it.
//
// THE TWO THAT MATTER MOST are the ones where the obvious implementation is
// wrong:
//
//   1. NULL IS NOT ZERO. An offering with no ceiling has `places_left` null,
//      and a check reading null as zero closes a course nobody limited.
//
//   2. A TERM NOBODY HAS SET UP YET REFUSES NOTHING. 063 seeds no offerings on
//      purpose. If an absent offering always meant "not offered", the day the
//      migration ran every student in the University would have been locked
//      out of registration until somebody set the term up by hand.
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
const bundle = join(dir, 'course-offering-test.mjs');
execFileSync('npx', [
  'esbuild', new URL('./courseOffering.ts', import.meta.url).pathname,
  '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`,
  '--log-level=error', `--alias:@=${srcRoot}`,
], { stdio: 'inherit' });
const { whyNot, sectionFor } = await import(bundle);

/** An offering that is open, has room, and should refuse nobody. */
const open = (over = {}) => ({
  offeringId: 'o1',
  status: 'open',
  deliveryMode: 'Campus',
  campus: null,
  lecturer: 'A Lecturer',
  maxEnrolment: 20,
  registered: 5,
  placesLeft: 15,
  classes: [{ id: 's1', code: 'A', dayOfWeek: 1, startsAt: '09:00:00', endsAt: '11:00:00' }],
  ...over,
});

console.log('\nAn offering that is open and has room refuses nobody\n');

check('an open offering with places left is registrable',
  whyNot(open(), true), null);

console.log('\nAnd every state that should refuse, does\n');

check('a cancelled offering is refused',
  whyNot(open({ status: 'cancelled' }), true),
  'This offering has been cancelled.');

check('an offering still being planned is refused, and says to come back',
  whyNot(open({ status: 'planned' }), true),
  'Registration has not opened for this course yet.');

check('a closed offering is refused',
  whyNot(open({ status: 'closed' }), true),
  'Registration for this course has closed.');

check('a full offering is refused, and says how full',
  whyNot(open({ registered: 20, placesLeft: 0 }), true),
  'This class is full — all 20 places are taken.');

// THE BOUNDARY. Nineteen of twenty taken is one place left, not none, and an
// off-by-one here turns the last seat in every class in the University into a
// seat nobody can have.
check('…but the last place is still a place',
  whyNot(open({ registered: 19, placesLeft: 1 }), true), null);

// OVERSUBSCRIBED. The ceiling was lowered under people already registered, so
// places_left is NEGATIVE. A check written as `=== 0` misses this entirely and
// admits more students to a class that is already over.
check('an oversubscribed offering is refused, not admitted because the count is not exactly zero',
  whyNot(open({ maxEnrolment: 20, registered: 23, placesLeft: -3 }), true),
  'This class is full — all 20 places are taken.');

console.log('\nNull is not zero\n');

// The whole of this: an offering with no ceiling has nothing to be full of.
check('an offering with no ceiling is never full, however many are registered',
  whyNot(open({ maxEnrolment: null, registered: 900, placesLeft: null }), true), null);

console.log('\nA term nobody has set up yet refuses nothing\n');

check('a course with no offering, in a term with none at all, is not refused',
  whyNot(undefined, false), null);

check('…but in a term that HAS been set up, a course with no offering is not on offer',
  whyNot(undefined, true),
  'This course is not offered in this term.');

check('null is treated the same as undefined',
  whyNot(null, true),
  'This course is not offered in this term.');

console.log('\nWhich class a registration attaches to\n');

check('an offering with one class needs no choice — it is picked',
  sectionFor(open(), null), 's1');

check('a chosen class is honoured',
  sectionFor(open({
    classes: [
      { id: 's1', code: 'A', dayOfWeek: 1, startsAt: '09:00:00', endsAt: '11:00:00' },
      { id: 's2', code: 'B', dayOfWeek: 3, startsAt: '14:00:00', endsAt: '16:00:00' },
    ],
  }), 's2'), 's2');

// A CLASS THAT BELONGS TO ANOTHER OFFERING IS NOT WRITTEN. 063 refuses it at
// the database with a trigger; this stops it reaching the database at all.
check('a class belonging to some other offering is ignored, not written',
  sectionFor(open({
    classes: [
      { id: 's1', code: 'A', dayOfWeek: 1, startsAt: '09:00:00', endsAt: '11:00:00' },
      { id: 's2', code: 'B', dayOfWeek: 3, startsAt: '14:00:00', endsAt: '16:00:00' },
    ],
  }), 'a-class-of-a-different-course'), null);

check('…and with exactly one class, a bogus choice falls back to the only one there is',
  sectionFor(open(), 'a-class-of-a-different-course'), 's1');

check('an offering with two classes and no choice attaches to neither',
  sectionFor(open({
    classes: [
      { id: 's1', code: 'A', dayOfWeek: 1, startsAt: '09:00:00', endsAt: '11:00:00' },
      { id: 's2', code: 'B', dayOfWeek: 3, startsAt: '14:00:00', endsAt: '16:00:00' },
    ],
  }), null), null);

check('an offering with no classes at all attaches to nothing',
  sectionFor(open({ classes: [] }), null), null);

check('and a course with no offering has no class',
  sectionFor(undefined, 's1'), null);

console.log('');
console.log(failures === 0
  ? 'Every refusal was watched refusing, and every permission permitting.\n'
  : `${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
