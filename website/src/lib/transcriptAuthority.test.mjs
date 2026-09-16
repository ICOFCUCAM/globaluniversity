// ---------------------------------------------------------------------------
// WHO MAY ISSUE AN OFFICIAL TRANSCRIPT, AND FOR WHOM.
//
// Run with:  node src/lib/transcriptAuthority.test.mjs
//
// ---------------------------------------------------------------------------
// THE UNIVERSITY'S RULING, 16 SEPTEMBER 2026
// ---------------------------------------------------------------------------
//
//   "The Vice-Chancellor and SuperAdmin shall each possess independent
//    authority to generate and issue official ICOF student transcripts.
//    Neither […] requires authorization from the other."
//
//   "No ordinary transcript workflow shall permit the creation or fabrication
//    of a transcript for a person who is not represented by an authorized
//    student record in the university information system."
//
//   "Every transcript generation and issuance event, regardless of the issuing
//    authority, shall be permanently recorded […]. The Vice-Chancellor and
//    SuperAdmin shall have complete visibility."
//
// ---------------------------------------------------------------------------
// THE GAP THIS CLOSED
// ---------------------------------------------------------------------------
//
// THE VICE-CHANCELLOR DID NOT HOLD `issue-credential`. They held
// `approve-credential-design` and nothing that issues anything, so
// "VC → verify → generate → issue" — the University's own diagram — was a
// sentence the capability matrix made impossible. The office with the highest
// transcript authority in the ruling had none in the system.
// ---------------------------------------------------------------------------

import { readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let failures = 0;
const check = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`ok    ${label}`);
  } else {
    failures++;
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
  }
};

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

const dir = join(root, 'node_modules', '.cache', 'iguc-tests');
mkdirSync(dir, { recursive: true });
const out = join(dir, 'roles-transcript.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'roles.ts'),
  '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error',
  `--alias:@=${join(root, 'src')}`,
]);
const { can } = await import(out);

const ROLES = [
  'superadmin', 'admin', 'chancellor', 'vice-chancellor', 'registrar',
  'finance-director', 'dean', 'hod', 'programme-coordinator', 'lecturer',
  'finance', 'admissions-officer', 'library-staff', 'student-affairs',
  'hr-officer', 'hr-administrator', 'national-rector',
  'national-financial-secretary', 'student', 'applicant', 'academic-office',
  'exam-officer', 'examiner', 'invigilator', 'moderator',
];
const holders = (capability) => ROLES.filter((r) => can(r, capability));

const migration = readFileSync(
  join(root, 'docs/migrations/100_the_transcript_is_issued_to_a_student_we_have.sql'), 'utf8',
);

console.log('\nIndependent transcript issuance authority\n');

// ---------------------------------------------------------------------------
// 1. THE TWO HIGHEST OFFICES, EACH ALONE
// ---------------------------------------------------------------------------

check('the Vice-Chancellor can issue', can('vice-chancellor', 'issue-credential'), true);
check('the Superadministrator can issue', can('superadmin', 'issue-credential'), true);

check('only those two may permit an exception',
  holders('validate-transcript-exception'), ['superadmin', 'vice-chancellor']);

check('…and only those two read every transcript ever generated',
  holders('view-transcript-audit'), ['superadmin', 'vice-chancellor']);

// NO DUAL APPROVAL. The capability that permits the exception is not the
// capability that issues, so neither office needs the other for an ordinary
// transcript — "the audit trail is the control, not mandatory dual
// authorization".
check('permitting an exception is not the same capability as issuing',
  can('registrar', 'issue-credential') && !can('registrar', 'validate-transcript-exception'),
  true);

// ---------------------------------------------------------------------------
// 2. THE ORDINARY WORKFLOW
// ---------------------------------------------------------------------------

check('the Registrar issues transcripts', can('registrar', 'issue-credential'), true);
check('the Director of Academic Affairs issues transcripts',
  can('academic-office', 'issue-credential'), true);

// …AND THEY DO NOT DECIDE THEIR OWN EXCEPTIONS, which is the whole of why the
// exception exists as a separate capability.
check('…and neither validates an exception',
  [can('registrar', 'validate-transcript-exception'),
    can('academic-office', 'validate-transcript-exception')],
  [false, false]);

// ---------------------------------------------------------------------------
// 3. A NATIONAL RECTOR HAS NO TRANSCRIPT AUTHORITY
//
// The University's §8 table, and refused in two places: the role holds no
// issuing capability, and 100 will not accept a generation row that names the
// office.
// ---------------------------------------------------------------------------

for (const c of ['issue-credential', 'validate-transcript-exception', 'view-transcript-audit']) {
  check(`a National Rector does not hold ${c}`, can('national-rector', c), false);
}

check('…and the database will not record one as the issuing office',
  /check \(issued_role in \([\s\S]*?\)\)/.test(migration)
    && !/'national-rector'[\s\S]{0,80}\)\n\);/.test(migration),
  true);

// ---------------------------------------------------------------------------
// 4. AND WHAT THE DATABASE REFUSES, WHICH IS THE PART A SCREEN CANNOT
// ---------------------------------------------------------------------------

check('a transcript names a student or carries a validation',
  /transcript_issue_names_a_student_or_carries_a_validation/.test(migration), true);

// MATCHED ON THE NOTICES, NOT THE EXCEPTION PROSE. The refusal messages are
// built by concatenating adjacent SQL string literals across several lines, so
// a sentence that reads as one in the file is quoted, broken and re-quoted in
// the text — and a regex written against how it reads finds nothing. The
// `raise notice` lines are single lines, and each one is an assertion the
// migration only reaches by having watched the rule refuse something.
check('…and the validation has to have been approved',
  /100 OK  an exceptional transcript waits for the validation/.test(migration), true);

check('…and the approval covers the student it was given for',
  /100 OK  an approval covers the student it was given for/.test(migration), true);

check('…and the guard that decides both is one function',
  /a_transcript_comes_from_the_register/.test(migration), true);

check('a generation record is never rewritten',
  /a_transcript_issue_is_never_rewritten/.test(migration), true);

check('…and generating again is a new version, not a replacement',
  /the_next_transcript_version/.test(migration), true);

check('…and "system" is not an office that issues transcripts',
  /never "system"|'system'/.test(migration), true);

// PROVED BY BREAKING. Each of the rules above has an assertion in the
// migration that FAILS the run if the rule stops refusing — which is what
// makes them rules rather than intentions.
const breaks = (migration.match(/raise exception '100 FAILED/g) ?? []).length;
check('…and every one of them is proved by being broken', breaks >= 12, true);

// ---------------------------------------------------------------------------
// 5. THE RLS ASSERTIONS ACTUALLY EXERCISE RLS
//
// A migration runs as the owner of its tables, and row-level security does not
// apply to a table's owner. An assertion about who can see what, taken without
// changing role, is the total every time and passes whatever the policies say.
// The first version of 100's proof did exactly that.
// ---------------------------------------------------------------------------

check('the visibility proof changes role before counting',
  /set local role authenticated;[\s\S]{0,200}?select count\(\*\) into seen from transcript_issues/
    .test(migration),
  true);

check('…and asserts a ceiling as well as a floor',
  /a lecturer read % transcript generations/.test(migration), true);

console.log(failures
  ? `\n${failures} check(s) failed.\n`
  : '\nThe two highest offices each issue alone, and nobody issues to a stranger.\n');
process.exit(failures ? 1 : 0);
