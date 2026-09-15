// ---------------------------------------------------------------------------
// TWO SCREENS USING THE SAME WORD COUNT THE SAME PEOPLE.
//
// Run with:  node src/lib/oneWordOneCount.test.mjs
//
// ---------------------------------------------------------------------------
// WHAT HAPPENED
// ---------------------------------------------------------------------------
//
// On the afternoon of 15 September 2026 the University had two screens open:
//
//     Dashboard   ENROLLED STUDENTS   1
//     Enrolment   ENROLLED            2
//
// about the same two people, on the same day, minutes apart. Mabel Holten had
// just been enrolled and appeared in one and not the other.
//
// The Enrolment desk asks `status = 'enrolled'`. The Dashboard asked
// `student_status is not null` — a different column, set by migration 037's
// ONE-TIME BACKFILL and by nothing else since. So it counted whoever existed
// the day 037 ran and would never count anybody again: the tile would have sat
// at its number while the University enrolled hundreds, and nobody would have
// had a reason to look.
//
// THIS IS THE THIRD TIME THIS CODEBASE HAS MADE THE SAME MISTAKE. The
// attendance percentage was nearly counted in two places, and course progress
// was too; both were pulled into SQL so there is one definition. The rule that
// came out of it, written on migration 086 and again on 087:
//
//     Two screens counting the same thing is two percentages, and the one a
//     student quotes in an appeal will be whichever is higher.
//
// ---------------------------------------------------------------------------
// WHAT THIS CHECKS
// ---------------------------------------------------------------------------
//
// That every screen displaying a count under the word "enrolled" asks the
// database the same question. It reads the source rather than the rendering,
// because there is no database to render against here — and because the
// question is about what the code asks, not what today's data makes of it.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

let failures = 0;
const check = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`ok    ${label}`);
  } else {
    failures++;
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
  }
};

const at = (p) => new URL(`../${p}`, import.meta.url).pathname;

/** Source with comments removed — half of these files EXPLAIN the old query. */
const bare = (p) => readFileSync(at(p), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

console.log('\n"Enrolled" means one thing across the whole system\n');

// ---------------------------------------------------------------------------
// THE DEFINITION, IN ONE PLACE.
//
// `status = 'enrolled'` — the Registrar has recorded that the place was taken
// up. Not an offer, not an admission, not a standing backfilled years ago.
// ---------------------------------------------------------------------------
// EITHER SPELLING COUNTS, because the rule is about the DEFINITION and not
// the syntax. The dashboards ask the database — `.eq('status', 'enrolled')`;
// the Enrolment desk pulls the desk's states and separates them in JavaScript
// — `r.status === 'enrolled'`. Both are "the Registrar recorded that the place
// was taken up", which is the thing that has to be the same.
//
// Insisting on one spelling would have failed a screen that was already right,
// and a false failure here is how the next person weakens the check until it
// guards nothing.
const ENROLLED = new RegExp(
  "\\.eq\\(\\s*'status'\\s*,\\s*'enrolled'\\s*\\)"
  + "|status\\s*===?\\s*'enrolled'",
);

const COUNTERS = [
  ['components/dashboard/OfficeDashboard.tsx', 'the office dashboard'],
  ['components/dashboard/AdminDashboard.tsx', 'the administrator dashboard'],
  ['components/admissions/Enrolment.tsx', 'the Enrolment desk'],
];

for (const [file, what] of COUNTERS) {
  const src = bare(file);
  check(`${what} counts status = 'enrolled'`, ENROLLED.test(src), true);

  // AND NOT THE COLUMN THAT FROZE. `student_status` is a real column with a
  // real use — a student's standing, which 019's machinery reads — but it is
  // not the answer to "how many students are enrolled", and reaching for it
  // again is exactly how this recurs.
  check(`…and ${what} does not count on student_status`,
    /\bstudent_status\b/.test(src) && /not\(\s*'student_status'/.test(src), false);
}

// ---------------------------------------------------------------------------
// AND ENROLLING SETS THE STANDING.
//
// The other half of the same fault. `student_status` was NULL for every
// student enrolled since 037 ran, because nothing set it — so the column 019's
// academic standing, progression and graduation machinery reads was empty for
// everybody who had arrived since.
//
// Taking up a place is when a person becomes a student in good standing, so
// the enrolment route is where it is set.
// ---------------------------------------------------------------------------
{
  const src = bare('app/api/admissions/enrol/route.ts');
  check('enrolling sets the student’s standing, so the column is not left empty',
    /student_status:\s*'active'/.test(src), true);
  check('…in the same write that records the enrolment',
    /status:\s*'enrolled'[\s\S]{0,400}student_status:\s*'active'/.test(src), true);
}

// ---------------------------------------------------------------------------
// AND THE LABEL SAYS WHAT IS COUNTED.
//
// The tile read "Enrolled students" with the hint "Admitted, conditional or
// active" — a label, a hint and a query that were three different claims. The
// hint is the one a reader trusts when the number surprises them.
// ---------------------------------------------------------------------------
for (const [file, what] of COUNTERS.slice(0, 2)) {
  const src = readFileSync(at(file), 'utf8');
  check(`${what} does not still hint at admitted or conditional`,
    /hint: 'Admitted, conditional or active'/.test(src), false);
}

console.log(failures ? `\n${failures} check(s) failed.\n` : '\nOne word, one count.\n');
process.exit(failures ? 1 : 0);
