// ---------------------------------------------------------------------------
// THE TRANSCRIPT — is every derived number on it right?
//
// Run with:  node src/lib/transcript.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS IS WORTH TESTING AND THE RENDER IS NOT
// ---------------------------------------------------------------------------
//
// A transcript is the document a student is judged on by employers, other
// universities and immigration authorities, and every figure on it is derived:
// grade point × credit unit, summed, divided by credits attempted, then again
// cumulatively. None of that is visible as wrong. A GPA out by 0.1 looks
// exactly like a GPA that is right, and it changes a classification.
//
// The cases below are the ones that go wrong in practice — a semester with no
// credits, a failed course, a mark still in the approval chain, a floating
// point sum landing on a classification boundary.
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
function bundle(source, name) {
  const outfile = join(dir, name);
  execFileSync('npx', [
    'esbuild', new URL(source, import.meta.url).pathname,
    '--bundle', '--format=esm', '--platform=node', `--outfile=${outfile}`, '--log-level=error',
    `--alias:@=${new URL('..', import.meta.url).pathname.replace(/\/$/, '')}`,
  ]);
  return outfile;
}
const out = bundle('./transcript.ts', 'transcript.mjs');
const {
  buildTranscript, isTranscriptable, creditsEarned, canIssueTranscript, APPROVED_STATES,
} = await import(out);

const student = { id: 's1', matric_no: 'ICOF/2026/0451', first_name: 'A', last_name: 'B' };
const department = { id: 'd1', name: 'Theology' };

const course = (code, credit, year, semester) => ({
  code, title: `${code} Title`, credit_unit: credit, year, semester,
});

/** An approved result by default — the state a transcript may print. */
const row = (code, credit, gp, opts = {}) => ({
  total_score: opts.score ?? 70,
  grade: opts.grade ?? 'A',
  grade_point: gp,
  status: opts.status ?? 'approved',
  courses: course(code, credit, opts.year ?? 1, opts.semester ?? 1),
});

const build = (results) => buildTranscript({ student, department, results });

// --- The arithmetic, on a worked example. -----------------------------------

console.log('\nThe arithmetic\n');

// 3 credits at 4.0 = 12 quality points; 3 at 3.0 = 9. 21 / 6 = 3.5.
const simple = build([row('THE101', 3, 4.0), row('BIB105', 3, 3.0)]);
check('semester credits are summed', simple.data.years[0].semesters[0].totalCredits, 6);
check('quality points are grade point × credit unit', simple.data.years[0].semesters[0].totalGradePoints, 21);
check('the semester GPA is quality points ÷ credits', simple.data.years[0].semesters[0].gpa, 3.5);
check('the CGPA matches on a single semester', simple.data.cgpa, 3.5);
check('credits attempted are totalled', simple.data.totalCredits, 6);

// A CGPA is NOT the mean of the semester GPAs — it is weighted by credits.
// Semester 1: 3cr @ 4.0 = 12. Semester 2: 6cr @ 2.0 = 12. Total 24 / 9 = 2.67.
// The mean of the two GPAs would be 3.00, which is the wrong answer and the
// mistake most often made.
const weighted = build([
  row('A101', 3, 4.0, { semester: 1 }),
  row('B201', 6, 2.0, { semester: 2 }),
]);
check('the CGPA is weighted by credits, not the mean of semester GPAs', weighted.data.cgpa, 2.67);
check('and the two semesters are kept apart', weighted.data.years[0].semesters.length, 2);

// --- Division by zero, which is the case that actually happens. -------------

console.log('\nA semester with no credits\n');

const zero = build([row('X100', 0, 4.0)]);
check('the GPA is 0, not NaN', zero.data.years[0].semesters[0].gpa, 0);
check('and the CGPA is 0, not NaN', zero.data.cgpa, 0);
check('NaN never reaches the document', Number.isNaN(zero.data.cgpa), false);

const none = build([]);
check('a student with no results yields no years', none.data.years, []);
check('and a CGPA of 0 rather than NaN', none.data.cgpa, 0);

// --- Only approved marks appear. --------------------------------------------
//
// Migration 009 built a four-office approval chain so that a mark is not a fact
// until it has cleared it. A transcript printing drafts publishes marks a
// moderator may be in the middle of sending back.

console.log('\nOnly marks that cleared the approval chain\n');

check('an approved result may be printed', isTranscriptable(row('A', 3, 4)), true);
check('a published result may be printed', isTranscriptable(row('A', 3, 4, { status: 'published' })), true);
check('a draft may NOT', isTranscriptable(row('A', 3, 4, { status: 'draft' })), false);
check('nor one submitted but not approved', isTranscriptable(row('A', 3, 4, { status: 'submitted' })), false);
check('nor one sent back', isTranscriptable(row('A', 3, 4, { status: 'returned' })), false);
check('the approved states are exactly two', [...APPROVED_STATES], ['approved', 'published']);

const mixed = build([
  row('OK101', 3, 4.0),
  row('PENDING201', 3, 4.0, { status: 'draft' }),
]);
check('a draft is excluded from the totals', mixed.data.totalCredits, 3);
check('and the registrar is told it was left off', mixed.omitted.length, 1);
check('with a count', mixed.omitted[0].count, 1);
check(
  'and a reason naming the approval chain',
  mixed.omitted[0].reason.includes('approval chain'),
  true,
);

// A row whose course join failed. Printing it would put a grade against an
// unnamed course; dropping it silently would make the totals not add up.
const orphan = build([row('OK101', 3, 4.0), { ...row('X', 3, 4), courses: null }]);
check('a row with no course is dropped', orphan.data.totalCredits, 3);
check('and reported as dropped', orphan.omitted.some((o) => o.reason.includes('no course record')), true);

// --- Credits earned is not credits attempted. -------------------------------

console.log('\nAttempted and earned are different numbers\n');

const withFail = [
  row('PASS101', 3, 4.0, { score: 75 }),
  row('FAIL201', 3, 0.0, { score: 22, grade: 'F' }),
];
check('credits attempted counts the failure', build(withFail).data.totalCredits, 6);
check('credits earned does not', creditsEarned(withFail), 3);
// And the failure still appears on the transcript. A transcript that hides a
// failed course is a falsified record.
check('the failed course is still printed', build(withFail).data.years[0].semesters[0].courses.length, 2);
check(
  'and its grade is shown',
  build(withFail).data.years[0].semesters[0].courses.some((c) => c.grade === 'F'),
  true,
);

// --- Ordering, so a reissue matches the original. ---------------------------

console.log('\nOrdering is stable, so a reissue matches the original\n');

const shuffled = build([
  row('Z999', 3, 4.0, { year: 2, semester: 1 }),
  row('A101', 3, 4.0, { year: 1, semester: 2 }),
  row('M500', 3, 4.0, { year: 1, semester: 1 }),
  row('B202', 3, 4.0, { year: 1, semester: 1 }),
]);
check('years ascend', shuffled.data.years.map((y) => y.year), [1, 2]);
check('semesters ascend within a year', shuffled.data.years[0].semesters.map((s) => s.semester), [1, 2]);
check(
  'courses are in code order within a semester',
  shuffled.data.years[0].semesters[0].courses.map((c) => c.code),
  ['B202', 'M500'],
);
// The same input in a different order must produce an identical document.
const reversed = build([
  row('B202', 3, 4.0, { year: 1, semester: 1 }),
  row('M500', 3, 4.0, { year: 1, semester: 1 }),
  row('A101', 3, 4.0, { year: 1, semester: 2 }),
  row('Z999', 3, 4.0, { year: 2, semester: 1 }),
]);
check(
  'a reissue from the same record is byte-identical',
  JSON.stringify(reversed.data),
  JSON.stringify(shuffled.data),
);

// A course with no year or semester recorded is still a mark the student
// earned, and is gathered rather than dropped.
const unplaced = build([{ ...row('U100', 3, 4.0), courses: course('U100', 3, null, null) }]);
check('a course with no year is kept', unplaced.data.totalCredits, 3);
check('under year 0, which the document labels', unplaced.data.years[0].year, 0);

// --- Refusing to issue nothing. ---------------------------------------------
//
// Sealing an empty transcript puts a permanent, verifiable University document
// on the register stating a student has completed nothing — and the register
// never overwrites, so it exists for ever even once superseded.

console.log('\nAn empty transcript is not a transcript\n');

check('a transcript with no courses is refused', typeof canIssueTranscript(none.data), 'string');
check(
  'and the refusal says why it matters',
  canIssueTranscript(none.data).includes('permanent'),
  true,
);
check('an all-zero-credit transcript is refused', typeof canIssueTranscript(zero.data), 'string');
check('a real transcript is allowed', canIssueTranscript(simple.data), null);

// --- Rounding at a classification boundary. ---------------------------------

console.log('\nRounding, where a classification turns\n');

// 3.665 held as a float is 3.6649999999999996, and naive rounding gives 3.66.
const boundary = build([
  row('R1', 2, 3.5), row('R2', 2, 3.83),
]);
// (7 + 7.66) / 4 = 3.665 -> 3.67, not 3.66.
check('a value ending in 5 rounds up rather than down', boundary.data.cgpa, 3.67);
// Precedence trap: `x?.length ?? 0 <= 2` parses as `x?.length ?? (0 <= 2)`,
// which is truthy whatever the length is. Parenthesised.
const decimals = (n) => (String(n).split('.')[1] ?? '').length;
check('the CGPA is never given more than two decimals', decimals(boundary.data.cgpa) <= 2, true);
check('nor is a semester GPA', decimals(weighted.data.years[0].semesters[0].gpa) <= 2, true);

// --- The classification comes from the same function the certificate uses. ---

// --- How long each level runs. ----------------------------------------------
//
// Two of these are University rulings and the rest are working assumptions.
// Asserting them here is what makes a silent edit to the table a failing build
// rather than a Certificate that quietly starts offering four years.

console.log('\nThe nominal length of each level\n');

const { nominalYears, NOMINAL_YEARS } = await import(bundle('./awards.ts', 'tr-awards.mjs'));

// Ruled by the University.
check('a bachelor’s runs three years', nominalYears('Bachelor of Theology'), 3);
check('a doctorate runs two', nominalYears('Doctor of Philosophy (Theology)'), 2);
// Working assumptions, asserted so a change to them is deliberate.
check('a certificate, one', nominalYears('Certificate of Theology'), 1);
check('a diploma, two', nominalYears('Diploma in Theology'), 2);
check('a master’s, two', nominalYears('Master of Divinity'), 2);
// An unrecognised or absent award gets the ceiling rather than zero, which
// would leave the year field with no options at all.
check('an unknown award gets the ceiling', nominalYears('Fellowship in Something'), 6);
check('and so does no award at all', nominalYears(null), 6);
check('every kind has a length', Object.values(NOMINAL_YEARS).every((n) => n > 0), true);

// --- The class of award depends on the LEVEL. -------------------------------
//
// This was a real defect: buildTranscript assigned a classification to every
// transcript, so a transcribed doctorate printed "First Class Honours" — under
// a research degree, which is passed rather than classified. The same fault the
// specimen book caught on certificates, one document over.

console.log('\nOnly awards that carry a class get one\n');

const forAward = (award) => buildTranscript({
  student, department, award,
  results: [row('A101', 3, 4.0), row('B102', 3, 4.0)],
}).data.classification;

check('a bachelor’s is classified', forAward('Bachelor of Theology').length > 0, true);
check('a master’s is classified', forAward('Master of Divinity').length > 0, true);
check('a diploma is classified', forAward('Diploma in Theology').length > 0, true);
// The two that are not, and the two that were wrong before.
check('a doctorate carries NO class', forAward('Doctor of Philosophy (Theology)'), '');
check('nor does a certificate', forAward('Certificate of Theology'), '');
// Empty, not a placeholder: a dash under a doctorate reads as a missing value
// rather than an inapplicable one.
check('and the field is empty rather than a dash', forAward('Doctor of Theology'), '');
// A transcript for a student mid-programme may not know the award yet.
check('with no award named, the class is still computed', forAward(undefined).length > 0, true);

check(
  'a classification is assigned',
  typeof simple.data.classification === 'string' && simple.data.classification.length > 0,
  true,
);

console.log(
  failures === 0
    ? '\nEvery derived figure is right, drafts stay off, and an empty transcript is refused.\n'
    : `\n${failures} failed\n`,
);

console.log('\nThe academic session of a semester\n');

// THE UNIVERSITY'S OWN SHEET HEADS EACH BLOCK "First Semester 08-2009", and a
// receiving registrar reads WHEN before anything else. It rides in the record
// rather than being added by whichever screen is drawing the sheet, so the
// preview and the emailed copy cannot head their semesters differently.
{
  const r = buildTranscript({
    student, department,
    results: [row('BIS 220', 3, 4, { year: 1, semester: 1 }),
      row('BIS 230', 3, 3, { year: 1, semester: 2 })],
    sessions: { '1-1': '08-2009', '1-2': '2009' },
  });
  const [first, second] = r.data.years[0].semesters;
  check('the session reaches the semester it belongs to', [first.session, second.session],
    ['08-2009', '2009']);
}
// AND NOTHING IS COUNTED FORWARD. A semester with no session recorded prints
// without one; deriving it from an admission year is right until a student
// repeats or is away, and then it states under seal that they were somewhere
// they were not.
{
  const r = buildTranscript({
    student, department, results: [row('BIS 220', 3, 4, { year: 1, semester: 1 })],
  });
  check('a semester with no session recorded carries none',
    r.data.years[0].semesters[0].session, undefined);
}
{
  const r = buildTranscript({
    student, department, results: [row('BIS 220', 3, 4, { year: 1, semester: 1 })],
    sessions: { '1-1': '   ' },
  });
  check('and whitespace is not a session', r.data.years[0].semesters[0].session, undefined);
}

process.exit(failures === 0 ? 0 : 1);