// ---------------------------------------------------------------------------
// LECTURERS, STUDENTS, OTHER — AND THE YEAR THEY CAME IN.
//
// Run with:  node src/lib/peopleClassification.test.mjs
//
// ---------------------------------------------------------------------------
// THE UNIVERSITY'S INSTRUCTION
// ---------------------------------------------------------------------------
//
//   "find persons should be differentiated to lecturers, students, other. it
//    should also be classified by years. all accounts should be separated also
//    likewise."
//
// ---------------------------------------------------------------------------
// WHAT HAS TO STAY TRUE, AND WHY EACH OF THESE IS HERE
// ---------------------------------------------------------------------------
//
// 1. EVERY ROLE LANDS IN EXACTLY ONE GROUP. The three groups are a partition
//    of the twenty-five roles, so a twenty-sixth cannot be added without this
//    file being told about it. The precedent is exact and expensive: eight
//    roles had capabilities, screens and a dashboard and could not be given an
//    account at all, because the list of creatable roles was a SEPARATE list
//    that nothing compared against anything. This counts the real list.
//
// 2. AN APPLICANT IS COUNTED WITH THE STUDENTS AND IS NOT CALLED ONE. This
//    system draws a hard line between an application and an admitted student
//    — 018 refuses to delete a record once it is admitted precisely because it
//    has stopped being an application. A screen that folded applicants into a
//    student count would be disagreeing with the register.
//
// 3. THE YEAR IS NOT `created_at`. An account opened this week for a student
//    admitted two years ago belongs to their cohort. Getting this backwards
//    would file a whole intake in the wrong year the first time a batch of
//    accounts was opened late, and it would look right.
//
// 4. NOBODY FALLS OFF A LIST. Every person gets a year, whatever is missing
//    from their record. A person absent from a register is a person nobody can
//    act on, which is worse than a person filed under an approximate year that
//    says it is approximate.
//
// 5. BOTH SCREENS USE THIS ONE MODULE. The University asked for the Accounts
//    list and the person-finder to be separated the same way. Two copies is
//    two answers waiting to disagree.
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

const bundle = (name, from) => {
  const out = join(root, 'node_modules', '.cache', 'iguc-tests', name);
  execFileSync('npx', [
    'esbuild', join(here, from),
    '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error',
    `--alias:@=${join(root, 'src')}`,
  ]);
  return out;
};

const {
  PERSON_KINDS, personKind, isApplicant, personYear, yearsPresent, yearLabel,
  YEAR_BASIS_LABELS, personKindLabel,
} = await import(bundle('people.mjs', 'people.ts'));
const { roleLabels } = await import(bundle('roles-people.mjs', 'roles.ts'));

const accounts = read('src/components/accounts/AccountManagement.tsx');
const studio = read('src/components/admin/StudioControl.tsx');

// ---------------------------------------------------------------------------
console.log('\nThree groups, and every role in exactly one\n');

check('the University named three', PERSON_KINDS.map((k) => k.kind),
  ['lecturer', 'student', 'other']);

const roles = Object.keys(roleLabels);
check('the register holds twenty-five roles', roles.length, 25);

// THE PARTITION. Every role classified, each into one of the three, and the
// three adding back up to the whole.
const kinds = Object.fromEntries(roles.map((r) => [r, personKind(r)]));
const unclassified = roles.filter((r) => !['lecturer', 'student', 'other'].includes(kinds[r]));
check('every role lands in one of the three', unclassified, []);

const tally = { lecturer: 0, student: 0, other: 0 };
for (const r of roles) tally[kinds[r]] += 1;
check('…and the three add up to all of them',
  tally.lecturer + tally.student + tally.other, roles.length);

check('a lecturer is a lecturer', personKind('lecturer'), 'lecturer');
check('a student is a student', personKind('student'), 'student');
check('every office is in the third group',
  roles.filter((r) => !['lecturer', 'student', 'applicant'].includes(r))
    .every((r) => kinds[r] === 'other'), true);
check('…and there are more than twenty of them', tally.other > 20, true);

// A ROLE THIS FILE HAS NEVER HEARD OF. `other` is where it goes, because a
// person with an unrecognised role still has to appear on a register
// somewhere, and inventing a fourth group at runtime would be a group with no
// label and no tab.
check('a role invented next year still lands somewhere',
  personKind('provost-of-something'), 'other');
check('…and so does no role at all', [personKind(null), personKind(undefined)],
  ['other', 'other']);

// ---------------------------------------------------------------------------
console.log('\nAn applicant is counted with the students and is not called one\n');

check('an applicant is grouped with the students', personKind('applicant'), 'student');
check('…and is still distinguishable', isApplicant('applicant'), true);
check('…while an admitted student is not an applicant', isApplicant('student'), false);
check('the group is not named after one of its two halves',
  personKindLabel('student'), 'Students');

// THE SCREEN SAYS SO IN WORDS. A distinction held in a boolean nobody renders
// is a distinction the reader does not have.
check('the Accounts screen says how many are applicants',
  /not yet admitted/.test(accounts), true);

// ---------------------------------------------------------------------------
console.log('\nThe year is the year they came in, not the year of the account\n');

// THE ONE THAT MATTERS MOST. An account opened long after the admission must
// file under the admission.
check('a student admitted in 2024 whose account was opened in 2026 is a 2024',
  personYear({
    role: 'student', accountOpenedAt: '2026-10-09T00:00:00Z', admissionYear: 2024,
  }),
  { year: 2024, basis: 'admitted' });

check('…and the screen says where that year came from',
  YEAR_BASIS_LABELS.admitted, 'admitted');

check('an applicant with no admission year is filed by when they applied',
  personYear({
    role: 'applicant', accountOpenedAt: '2026-10-09T00:00:00Z',
    appliedAt: '2025-03-02T00:00:00Z',
  }),
  { year: 2025, basis: 'applied' });

check('a member of staff is filed by when they started',
  personYear({
    role: 'registrar', accountOpenedAt: '2026-10-09T00:00:00Z', startedOn: '2023-01-16',
  }),
  { year: 2023, basis: 'appointed' });

// A STAFF RECORD IS NOT CONSULTED FOR A STUDENT, AND VICE VERSA. Reading the
// wrong one would be a plausible-looking year from the wrong register.
check('a student is not filed by a staff date that got attached to them',
  personYear({
    role: 'student', accountOpenedAt: '2026-01-01T00:00:00Z', admissionYear: 2024,
    startedOn: '2019-01-01',
  }),
  { year: 2024, basis: 'admitted' });

// ---------------------------------------------------------------------------
console.log('\nAnd nobody falls off a list for having an incomplete record\n');

check('an account with nothing else recorded falls back to its own year',
  personYear({ role: 'hod', accountOpenedAt: '2025-07-04T00:00:00Z' }),
  { year: 2025, basis: 'account' });

check('…and so does a student whose register row cannot be read',
  personYear({ role: 'student', accountOpenedAt: '2025-07-04T00:00:00Z' }),
  { year: 2025, basis: 'account' });

// AN ADMISSION YEAR OF ZERO OR NULL IS NOT A YEAR. Trusting it would file
// people under the year 0 and the screen would show a chip saying "0".
for (const bad of [null, 0, undefined]) {
  check(`an admission year of ${JSON.stringify(bad)} is not believed`,
    personYear({
      role: 'student', accountOpenedAt: '2025-07-04T00:00:00Z', admissionYear: bad,
    }).basis,
    'account');
}

// AND AN UNREADABLE DATE DOES NOT PRODUCE NaN ON THE SCREEN.
check('an unparseable account date yields a year that says it is not recorded',
  yearLabel(personYear({ role: 'dean', accountOpenedAt: 'not a date' }).year),
  'Year not recorded');
check('…while a real year is just the number',
  yearLabel(2026), '2026');

// ---------------------------------------------------------------------------
console.log('\nThe year chips: most recent first, counted, and no empty ones\n');

const people = [
  { y: 2026 }, { y: 2024 }, { y: 2026 }, { y: 2025 }, { y: 2026 },
];
check('most recent first', yearsPresent(people, (p) => p.y).map((y) => y.year),
  [2026, 2025, 2024]);
check('…with a count each', yearsPresent(people, (p) => p.y).map((y) => y.count),
  [3, 1, 1]);
check('…and the counts add back up to everybody',
  yearsPresent(people, (p) => p.y).reduce((n, y) => n + y.count, 0), people.length);
check('no chip for a year nobody is in',
  yearsPresent(people, (p) => p.y).some((y) => y.count === 0), false);
check('an empty list produces no chips', yearsPresent([], (p) => p.y), []);

// ---------------------------------------------------------------------------
console.log('\nBoth screens separate the list the same way, from this one module\n');

for (const [name, src] of [['Accounts', accounts], ['Studio Control', studio]]) {
  check(`${name} classifies from src/lib/people`,
    /from '@\/lib\/people'/.test(src), true);
  // A LISTED PERSON'S ROLE, not any role at all: the Accounts create-form
  // legitimately shows extra fields when `form.role === 'lecturer'`, which is
  // about what a NEW account needs and not about how an existing one is
  // filed. A regex that caught both would have had to be deleted the first
  // time it fired, which makes it worse than no check.
  check(`…and holds no classification of its own`,
    /\b[rp]\.role === '|row\.role === '/.test(src), false);
  check(`…draws all three groups`, /PERSON_KINDS/.test(src), true);
  check(`…and offers the years`, /yearsPresent/.test(src), true);
}

// THE COUNT ON A TAB AND THE ROWS UNDER IT COME FROM ONE LIST. A count
// computed from one source beside a list filtered from another is the oldest
// bug on any screen in this system, and it has been found here twice.
check('the Accounts tab counts are taken from the classified list',
  /count: classified\.filter/.test(accounts), true);
check('the Studio picker counts are taken from the loaded list',
  /count: people\.filter/.test(studio), true);

// AND A SEARCH IS NOT CONFINED TO THE GROUP SHOWING. Somebody typing a
// surname wants that person.
check('a search in Accounts crosses every group',
  /Searching every group and every year/.test(accounts), true);
check('…and so does one in the picker',
  /Searching every group and year/.test(studio), true);

// THE PICKER'S FORTY-MATCH CAP IS GONE. It was the reason a lecturer could be
// unreachable without already knowing their name: the list was every account
// in the University, ordered by name, truncated.
check('the picker no longer truncates the register',
  /\.slice\(0, 40\)/.test(studio), false);

// ---------------------------------------------------------------------------
console.log(failures === 0
  ? '\nAll good.\n'
  : `\n${failures} failure${failures === 1 ? '' : 's'}.\n`);
process.exit(failures === 0 ? 0 : 1);
