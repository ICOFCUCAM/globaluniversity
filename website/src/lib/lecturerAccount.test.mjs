// ---------------------------------------------------------------------------
// WHAT A LECTURER'S ACCOUNT CAN ACTUALLY DO.
//
// Run with:  node src/lib/lecturerAccount.test.mjs
//
// ---------------------------------------------------------------------------
// WHAT THIS GUARDS
// ---------------------------------------------------------------------------
//
// The University asked what features a lecturer account has. The answer on
// paper was six capabilities. The answer in practice was sixteen sidebar
// entries, and the two lists did not meet.
//
// THE SIDEBAR IS GATED BY ROLE ONLY. `groupsFor` filters on
// `i.roles.includes(role)` and a menu item has no capability field at all, so
// what somebody SEES and what somebody MAY DO were never connected. Two faults
// come out of that, and this file holds both shut for the lecturer:
//
//   A CAPABILITY WITH NO DOOR. `view-registered-students` was held by every
//   lecturer and not one screen they could open was gated on it — the three
//   that test it leave `lecturer` out of their role lists. Their roll was
//   visible only incidentally, per course, on the way to entering a mark.
//
//   A RECORD ITS OWN SUBJECT COULD NOT SEE. A staff record was opened for
//   somebody — number, post, letter, conditions — and Appointments and
//   Correspondence are gated to the offices, so the one person it is about
//   could not read any of it.
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

const out = join(cache, 'navForLecturer.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'portalNav.tsx'), '--bundle', '--format=esm',
  '--platform=node', `--outfile=${out}`, '--log-level=error',
  '--jsx=automatic', `--alias:@=${join(here, '..')}`,
  '--define:process.env.NODE_ENV="production"',
]);
const N = await import(out);

const idsFor = (role) => N.groupsFor(role).flatMap((g) => g.items.map((i) => i.id));

console.log('\nA lecturer can reach every capability they hold\n');

const lecturer = idsFor('lecturer');

// --- THE ROLL, WHICH HAD NO DOOR ------------------------------------------
check('a lecturer has a screen for the students registered on their courses',
  lecturer.includes('my-students'), true);

// --- AND THEIR OWN RECORD --------------------------------------------------
check('…and a screen for their own staff record', lecturer.includes('my-record'), true);

// EVERY MEMBER OF STAFF, not only a lecturer. A Dean, a Registrar and a Finance
// Officer all have a staff record and all were equally unable to read it.
for (const role of ['dean', 'registrar', 'academic-office', 'finance', 'hr-officer',
  'library-staff', 'exam-officer']) {
  check(`${role} can see their own record too`, idsFor(role).includes('my-record'), true);
}

// --- AND A STUDENT CANNOT ------------------------------------------------
//
// `my-record` is the STAFF record. A student's own record is `my-profile`, and
// offering them a screen that will always be empty is the anti-pattern the
// settings file names.
check('a student is not offered a staff record', idsFor('student').includes('my-record'), false);
check('…nor a teaching roll', idsFor('student').includes('my-students'), false);

console.log('\nAnd the screens behind them are real\n');

// --- THE VIEW SWITCH ACTUALLY RENDERS THEM --------------------------------
//
// A menu entry whose ViewType no switch handles is a door onto a blank page,
// which is how this system has failed before.
const layout = readFileSync(join(here, '../components/AppLayout.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
for (const id of ['my-record', 'my-students']) {
  check(`something renders '${id}'`, new RegExp(`case '${id}':`).test(layout), true);
}

// --- AND WHAT THE RECORD SCREEN SHOWS -------------------------------------
const record = readFileSync(join(here, '../components/staff/MyRecord.tsx'), 'utf8');
// THE LABELS A READER SEES, not the column names. Checking for `staff_number`
// passed on the SELECT list alone: the column could be fetched and never
// printed, which is the state the screen was already in before it existed.
for (const label of ['Staff number', 'Post', 'In post since', 'Username']) {
  check(`my record shows "${label}"`, record.includes(`'${label}'`), true);
}
check('…and opens the letter that was issued', /appointment_letters/.test(record), true);
// THE ARCHIVED BYTES, not a re-render. A second rendering path would be a
// second answer to "what does my letter say".
check('…the archived bytes, not a second rendering',
  /writeDocument/.test(record) && !/appointmentLetterHtml/.test(record), true);

// --- THE ROLL IS A ROLL, NOT A RECORD -------------------------------------
//
// `view-registered-students` entitles a lecturer to know who is in front of
// them — not to read an admission file, a fee or a mark from somebody else's
// course. A screen that widened it would be granting capabilities nobody did.
// COMMENTS STRIPPED FIRST. This screen's header explains that it shows nothing
// about fees — and an unstripped read matches its own explanation and fails.
// That trap has caught this suite half a dozen times today.
const students = readFileSync(join(here, '../components/staff/MyStudents.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
check('the roll reads the caller-scoped teaching view', /my_teaching/.test(students), true);
check('…and the course roll', /course_roll/.test(students), true);
for (const word of ['fees', 'admission_', 'salary']) {
  check(`…and nothing about ${word}`, students.includes(word), false);
}

// --- THE JOIN THAT MAKES THE LETTER READABLE ------------------------------
//
// 041's policy admits the appointee where `appointments.person_id` is their
// account. Until the staff record is opened there IS no account, so opening it
// has to set the column or the letter stays unreadable by its own subject.
const route = readFileSync(
  join(here, '../app/api/appointments/staff-record/route.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
check('opening a staff record tells the appointment who they are',
  /person_id: authUserId/.test(route), true);

console.log('\nAnd the University’s ruling on a lecturer holds, line by line\n');

// ---------------------------------------------------------------------------
// THE UNIVERSITY'S TABLE, SEPTEMBER 2026.
//
// "A lecturer should be able to teach a course, but should not be able to
//  define the University's course catalogue. A lecturer teaching BLT 501 can
//  manage their teaching content for BLT 501, but should not be able to change
//  BLT 501 → 5 credits → Core → Semester 1, because that is curriculum
//  governance."
//
// Written out as they wrote it, so a later change to the matrix is measured
// against the ruling rather than against whatever the matrix happened to say.
// ---------------------------------------------------------------------------
const rolesOut = join(cache, 'rolesForLecturer.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'roles.ts'), '--bundle', '--format=esm',
  '--platform=node', `--outfile=${rolesOut}`, '--log-level=error',
  `--alias:@=${join(here, '..')}`,
]);
const R = await import(rolesOut);

const MAY = [
  ['view their own staff record', 'view-own-staff-record'],
  ['view the students in their own classes', 'view-registered-students'],
  ['view their own courses', 'view-own-courses'],
  ['create course materials', 'publish-course-material'],
  ['reach the learning space', 'access-lms'],
  ['write question-bank items', 'manage-question-bank'],
  ['draft a question paper', 'draft-question-paper'],
  ['enter grades', 'upload-grades'],
  ['submit results for moderation', 'submit-results'],
  ['take attendance', 'take-attendance'],
  ['see early warning for their own students', 'view-own-student-risk'],
  // POSTED AS A MATERIAL OF KIND 'announcement', which 068 has admitted since
  // it was written. A second capability for the same act was granted here and
  // portalCoverage caught it: enforced nowhere, and a duplicate name for
  // something that already worked.
  ['announce to their own course', 'publish-course-material'],
];

const MAY_NOT = [
  ['define or edit the University’s course catalogue', 'manage-courses'],
  ['approve an examination paper', 'schedule-examination'],
  ['publish an official examination paper', 'publish-examination'],
  ['moderate a mark, including their own', 'moderate-results'],
  ['approve results', 'approve-results'],
  ['publish results', 'publish-results'],
  ['speak for the University in an announcement', 'compose-announcement'],
  ['approve an announcement', 'approve-announcement'],
  ['move a class in the timetable', 'build-timetable'],
  ['manage student records', 'create-student-record'],
  ['see a student’s fees', 'verify-payment'],
  ['manage admissions', 'admit-student'],
];

for (const [what, capability] of MAY) {
  check(`a lecturer may ${what}`, R.can('lecturer', capability), true);
}
for (const [what, capability] of MAY_NOT) {
  check(`a lecturer may NOT ${what}`, R.can('lecturer', capability), false);
}

// AND NOTHING BESIDE IT. A capability quietly added to the lecturer's list
// would not be caught by either loop above — only by counting.
// COUNTED AGAINST THE DISTINCT CAPABILITIES, because two rows of the
// University's table are satisfied by one capability: posting a course
// announcement IS publishing a course material of kind 'announcement'.
check('and holds nothing the University did not grant',
  R.capabilitiesOf('lecturer').length, new Set(MAY.map((m) => m[1])).size);

console.log('\nThe catalogue is not a lecturer’s to edit\n');

// --- THE DOOR, NOT ONLY THE CAPABILITY ------------------------------------
//
// The whole fault this ruling corrects was a sidebar gated by ROLE ONLY: a
// lecturer reached Course management holding no `manage-courses` at all. So it
// is the MENU that has to refuse them, and the menu now carries a capability.
check('a lecturer is not offered the course catalogue',
  lecturer.includes('courses'), false);
check('…but is offered their own courses', lecturer.includes('my-courses'), true);
// AND SOMEBODY WHO MAY KEEP THE CATALOGUE STILL REACHES IT. A gate that shut
// everybody out would pass the check above and break the University.
check('the office that keeps the catalogue still reaches it',
  idsFor('academic-office').includes('courses') || idsFor('registrar').includes('courses'), true);

// --- AND ANNOUNCEMENTS ARE STILL READABLE ---------------------------------
//
// I gated this entry on `compose-announcement` and took the gate out again.
// Every CONTROL on that screen is already behind a capability a lecturer does
// not hold, so the ruling — "create university announcements: no" — was
// satisfied without it; gating the ENTRY as well would have hidden the
// University's own notices from almost everybody who has to read them, the
// Registrar and the Academic Office included. Reading a notice is not
// composing one.
check('a lecturer can still read the University’s announcements',
  lecturer.includes('announcements'), true);
check('…and still cannot compose one', R.can('lecturer', 'compose-announcement'), false);

// --- THE MENU CAN EXPRESS A CAPABILITY AT ALL -----------------------------
//
// The structural fix. Without this field the ruling is unsayable: a role list
// cannot distinguish "teaches a course" from "defines the catalogue".
const nav = readFileSync(join(here, 'portalNav.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
check('a menu entry can name the capability it needs',
  /capability\?: Capability;/.test(nav), true);
check('…and the filter actually consults it',
  /!i\.capability \|\| can\(role, i\.capability\)/.test(nav), true);

console.log(failures ? `\n${failures} check(s) failed.\n` : '\nAll lecturer account checks passed.\n');
process.exit(failures ? 1 : 0);
