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

console.log(failures ? `\n${failures} check(s) failed.\n` : '\nAll lecturer account checks passed.\n');
process.exit(failures ? 1 : 0);
