// ---------------------------------------------------------------------------
// THE BACHELOR OF MINISTRY, CHECKED AGAINST ITSELF.
//
//   node src/content/bachelorOfMinistry.test.mjs
//
// ===========================================================================
// WHY A CURRICULUM NEEDS A TEST
// ===========================================================================
//
// A prospectus is prose and nobody adds it up. A curriculum is arithmetic, and
// the arithmetic is the thing an approval panel, a credential evaluator and a
// receiving university all check first. This programme states 180 ECTS across
// six semesters, so either every semester is 30 and the total is 180, or the
// document is wrong about the award it confers.
//
// It also states a prerequisite chain — the first on this site to do so. A
// prerequisite is not decoration: it decides what a student is permitted to
// enrol in, and one that names a course taught later, or at the same time, or
// not at all, is a rule the registry cannot apply.
//
// ===========================================================================
// WHAT IS ASSERTED AND WHAT IS PINNED
// ===========================================================================
//
// ASSERTED: everything the framework settles. Semester loads, the total, the
// component-table total, unique codes, and prerequisites that resolve to a
// course taught in an EARLIER semester.
//
// PINNED: the two prerequisites that do not — FIN 201 → ADM 201 and
// COM 302 → MIS 301, each naming a course in its own semester. These are
// academic decisions for the university and this repository does not make them
// silently. So they are listed by name, with the reason, and the test fails if
// the list stops matching reality in EITHER direction: a new unsatisfiable
// prerequisite fails, and so does a listed one that has been fixed. A known
// defect that quietly gets fixed and leaves its exception behind is how the
// next one hides.
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
const bundle = join(dir, 'bmin-test.mjs');
execFileSync('npx', [
  'esbuild', new URL('./bachelorOfMinistry.ts', import.meta.url).pathname,
  '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`, '--log-level=error',
  `--alias:@=${new URL('..', import.meta.url).pathname.replace(/\/$/, '')}`,
], { stdio: 'inherit' });
const B = await import(bundle);

console.log('\nBachelor of Ministry — the arithmetic\n');

check('six semesters', B.bminSemesters.length, 6);
for (const s of B.bminSemesters) {
  const n = B.semesterEcts(s);
  if (n === 30) ok(`    ${s.label} carries 30 ECTS`);
  else bad(`${s.label} carries ${n} ECTS, not 30 — a standard semester is 30 ECTS and six of them are the award`);
}
check('the programme totals 180 ECTS', B.bminTotalEcts, 180);
check('the component table also totals 180 ECTS', B.bminComponentTotal, 180);
check('thirty-four courses are taught', B.bminCourseCount, 34);

// A duplicated course code is two different courses sharing one line on a
// transcript, which is unresolvable after the fact.
const codes = B.bminAllCourses.map((c) => c.code);
const dupes = codes.filter((c, i) => codes.indexOf(c) !== i);
check('no course code is used twice', dupes, []);

// Fourteen tracks of four courses each. The count is asserted because the
// framework grew from ten tracks to fourteen between revisions, and a track
// silently lost in an edit is a specialisation a student cannot find.
check('fourteen specialization tracks', B.bminTracks.length, 14);
check('…lettered A to N without a gap', B.bminTracks.map((t) => t.letter).join(''), 'ABCDEFGHIJKLMN');
check('…each of four courses', B.bminTrackCourseCount, 56);
const trackCodes = B.bminTracks.flatMap((t) => t.courses.map((c) => c.code));
check('no track course code is used twice', trackCodes.filter((c, i) => trackCodes.indexOf(c) !== i), []);

console.log('\nThe prerequisite chain\n');

// Where each course is taught, by semester index.
const when = {};
B.bminSemesters.forEach((s, i) => s.courses.forEach((c) => { when[c.code] = i; }));

// The two the university must rule on. Fixing one means deleting its line here.
const SAME_SEMESTER = {
  'FIN 201': 'ADM 201',
  'COM 302': 'MIS 301',
};

const seenSameSemester = [];
for (const [i, s] of B.bminSemesters.entries()) {
  for (const c of s.courses) {
    for (const p of c.requires) {
      if (when[p] === undefined) {
        bad(`${c.code} requires ${p}, which is taught nowhere in the programme`);
      } else if (when[p] > i) {
        bad(`${c.code} (${s.label}) requires ${p}, which is taught later (${B.bminSemesters[when[p]].label})`);
      } else if (when[p] === i) {
        seenSameSemester.push(`${c.code}→${p}`);
        if (SAME_SEMESTER[c.code] !== p) {
          bad(`${c.code} requires ${p} in the same semester, and it is not one of the two known cases — see BMIN_OPEN_QUESTIONS`);
        }
      }
    }
  }
}
const expected = Object.entries(SAME_SEMESTER).map(([a, b]) => `${a}→${b}`);
check(
  'the two unsatisfiable prerequisites are exactly the ones on record',
  seenSameSemester.sort(),
  expected.sort(),
);
ok('    every other prerequisite names a course taught in an earlier semester');

// A credit-threshold prerequisite must be reachable by the time the course is
// taught. RES 301 asks for 60 ECTS and MIN 308 for 120; both sit after enough
// semesters to have earned them — but only if the semester loads hold, which is
// why this is checked from the plan rather than assumed.
for (const [i, s] of B.bminSemesters.entries()) {
  const earned = B.bminSemesters.slice(0, i).reduce((n, x) => n + B.semesterEcts(x), 0);
  for (const c of s.courses) {
    if (c.requiresEcts === undefined) continue;
    if (earned >= c.requiresEcts) ok(`    ${c.code} needs ${c.requiresEcts} ECTS and ${earned} are earned by ${s.label}`);
    else bad(`${c.code} needs ${c.requiresEcts} ECTS but only ${earned} can be earned before ${s.label}`);
  }
}

console.log('\nThe terminology policy\n');

// ENFORCED, NOT TRUSTED.
//
// The university directed that the School of Ministry use Yahuah for the
// Creator, Yahusha for the Messiah and the Ruach HaQodesh for the Spirit. A
// policy that lives only in a paragraph is a policy that survives exactly until
// the next course is added by somebody who has not read it, and the failure is
// invisible: one course title in a table of thirty-four.
//
// So the source file is read as text and the forbidden forms are searched for
// directly. This is the only assertion in the suite that reads the file rather
// than the module, because what is being checked is the wording itself.
const { readFileSync } = await import('node:fs');
const src = readFileSync(new URL('./bachelorOfMinistry.ts', import.meta.url).pathname, 'utf8');

// Strip the header and the policy note, which QUOTE the old forms in order to
// record what was changed. A test that flagged its own changelog would force
// the record to be deleted to make the test pass.
const body = src.slice(src.indexOf('export const bminTerminology'));

for (const [forbidden, use] of [['Jesus', 'Yahusha'], ['Holy Spirit', 'the Ruach HaQodesh']]) {
  if (!body.includes(forbidden)) ok(`    no "${forbidden}" in the School’s own voice — it says ${use}`);
  else bad(`"${forbidden}" appears in the curriculum; the School of Ministry terminology policy requires ${use}`);
}

check('Yahuah names the Creator', body.includes('Yahuah'), true);
check('Yahusha names the Messiah', body.includes('Yahusha'), true);
check('the Ruach HaQodesh names the Spirit', body.includes('Ruach HaQodesh'), true);

// THE OTHER HALF OF THE POLICY, and the half a find-and-replace would destroy.
// The policy governs the NAMES of the Creator and the Messiah. It does not
// rename the faith, and it expressly preserves scholarly terminology. A future
// sweep that turned "Christian doctrine" into something else, or renamed
// Christology, would be a confessional and an academic change nobody asked for.
check('the faith is still called Christian', body.includes('Christian'), true);
check('the academic disciplines keep their own names', body.includes('Christology'), true);

check('the policy itself is published', typeof B.bminTerminology === 'string' && B.bminTerminology.includes('Yahuah'), true);
check(
  'and so is the theological statement',
  typeof B.bminTheologicalStatement === 'string' && B.bminTheologicalStatement.includes('Ruach HaQodesh'),
  true,
);

console.log('\nWhat is published about what is unresolved\n');

// The findings are part of the deliverable. If somebody deletes one from the
// data because the page looked untidy, the defect stops being visible while
// remaining true, which is the worst of both.
check('four open questions are published', B.BMIN_OPEN_QUESTIONS.length, 4);
const missing = B.BMIN_OPEN_QUESTIONS.filter((q) => !q.finding || !q.detail || !q.recommendation);
check('…each with a finding, a detail and a recommendation', missing.map((q) => q.id), []);

// Assessment weights are the university's own and must add up where given. A
// course whose breakdown sums to 90% has lost a component in transcription.
for (const c of B.bminAllCourses) {
  if (!c.assessment) continue;
  const total = c.assessment.reduce((n, a) => n + a.weight, 0);
  if (total === 100) ok(`    ${c.code} assessment sums to 100%`);
  else bad(`${c.code} assessment sums to ${total}%, not 100`);
}

console.log('');
if (failures) {
  console.error(`${failures} check(s) failed.\n`);
  process.exit(1);
}
console.log('The Bachelor of Ministry adds up.\n');
