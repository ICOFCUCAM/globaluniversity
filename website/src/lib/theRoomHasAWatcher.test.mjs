// ---------------------------------------------------------------------------
// A PROCTOR IS APPOINTED, AND CAN SEE THE ROOM.
//
// Run with:  node src/lib/theRoomHasAWatcher.test.mjs
//
// ---------------------------------------------------------------------------
// THE UNIVERSITY'S DECISION OF 16 SEPTEMBER 2026
// ---------------------------------------------------------------------------
//
//   "`assign-proctor` is kept, not retired, and becomes functional when
//    proctoring is built. `examination_officers` is connected to the
//    examination workflow rather than removed."
//
// ---------------------------------------------------------------------------
// THE FAULT THIS EXISTS TO KEEP FIXED
// ---------------------------------------------------------------------------
//
// Five examination tables had row-level security enabled and NO POLICY, which
// is invisible rather than open: a SELECT succeeds and returns nothing. The
// Examiner Console read `exam_sessions` with the browser's key and showed an
// empty hall to every invigilator the University has ever had — and an empty
// hall looks like a quiet exam, not like a fault.
//
// That class of defect cannot be seen by reading a screen, so what is checked
// here is the SHAPE of the fix: that each of the five tables has a policy at
// all, and that the policies are scoped to the register the ruling names.
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

const sql = read('docs/migrations/111_a_proctor_is_appointed_and_can_see_the_room.sql');
const route = read('src/app/api/exam/officers/route.ts');
const panel = read('src/components/exams/ExamOfficers.tsx');
const office = read('src/components/exams/ExaminationOffice.tsx');

const { OFFICER_ROLES, officerWatches, officerLabel } =
  await import(bundle('examofficers.mjs', 'examOfficers.ts'));
const { can } = await import(bundle('roles-exam.mjs', 'roles.ts'));

// ---------------------------------------------------------------------------
console.log('\nEvery table the console reads has a policy at all\n');

// THE FIVE THAT HAD NONE. A table with row security on and no policy is
// invisible to every signed-in account, and this is the only check that would
// have caught the original fault: not "is the policy right", but "is there
// one".
for (const table of ['exam_sessions', 'exam_events', 'exam_incidents', 'exam_marks',
  'examination_officers']) {
  check(`${table} has a read policy`,
    new RegExp(`create policy \\w+ on ${table}\\s*\\n?\\s*for select`).test(sql), true);
}

// AND EACH IS SCOPED TO THE REGISTER THE RULING NAMES, directly or through
// the sitting. A policy that said `true` would also satisfy the check above
// and would be the opposite of the ruling.
const policies = [...sql.matchAll(/create policy (\w+) on (\w+)\s*\n\s*for select using \(([\s\S]*?)\n  \);/g)];
check('five policies were written', policies.length, 5);
for (const [, name, table, body] of policies) {
  check(`${name} is scoped, not open`,
    /watches_this_examination/.test(body), true);
  if (table === 'exam_sessions') {
    // THE ONE 016 DROPPED. A candidate reading their own sitting.
    check('…and the candidate keeps their own sitting',
      /students where auth_user_id = auth\.uid\(\)/.test(body), true);
  }
}

// ---------------------------------------------------------------------------
console.log('\nThe trail is the invigilator’s, never the candidate’s\n');

// A CANDIDATE WHO COULD READ THEIR OWN FLAGS could work out what the system
// notices. The absence is deliberate, so it is asserted rather than left to
// be inferred from nothing.
const events = policies.find(([, , t]) => t === 'exam_events');
check('exam_events names no candidate', /auth_user_id/.test(events?.[3] ?? ''), false);
const marks = policies.find(([, , t]) => t === 'exam_marks');
check('nor does exam_marks', /auth_user_id/.test(marks?.[3] ?? ''), false);
check('…and the migration says why rather than leaving it to be noticed',
  /NOT BY THE CANDIDATE/.test(sql), true);

// ---------------------------------------------------------------------------
console.log('\nThe helper is SECURITY DEFINER, or the policies recurse\n');

// THE SUBTLE ONE. `examination_officers`' own policy calls a function that
// reads `examination_officers`. A plain function would loop until Postgres
// refused it; a definer function runs as the owner, to whom row security does
// not apply, and the loop never forms.
const fn = /create or replace function watches_this_examination[\s\S]*?\$\$;/.exec(sql);
check('the helper exists', Boolean(fn), true);
check('…and is SECURITY DEFINER', /security definer/.test(fn?.[0] ?? ''), true);
check('…with its search_path pinned', /set search_path = public/.test(fn?.[0] ?? ''), true);
check('…and 111 performs the read rather than trusting it',
  /does not recurse through its own policy/.test(sql), true);

// ---------------------------------------------------------------------------
console.log('\nOnly an invigilator counts as being in the room\n');

// 015's five officer kinds are not five words for one job. An examination
// with a chair, an examiner and a moderator and no invigilator is an
// examination nobody is in the room for.
check('five kinds of officer', OFFICER_ROLES.length, 5);
check('…and exactly one of them watches',
  OFFICER_ROLES.filter((r) => r.watches).map((r) => r.role), ['invigilator']);
check('an examiner is not watching', officerWatches('examiner'), false);
check('nor a moderator', officerWatches('moderator'), false);
check('a kind nobody taught it is shown as itself', officerLabel('scrutineer'), 'scrutineer');

// AND THE MIGRATION'S LIST AGREES WITH THE SCREEN'S. 015 holds the five in a
// CHECK constraint; a sixth added there and not here would render as a blank.
check('the unwatched list counts invigilators alone',
  /o\.role = 'invigilator'/.test(sql), true);
check('…and 111 watches an EXAMINER fail to take a paper off that list',
  /appointing an EXAMINER took a paper off the unwatched list/.test(sql), true);

// ---------------------------------------------------------------------------
console.log('\nA candidate cannot be an officer of their own examination\n');

check('the rule is a trigger, not a screen',
  /an_officer_is_not_a_candidate/.test(sql), true);
check('…refusing a candidate of that paper',
  /is sitting this examination and cannot be an officer of it/.test(sql), true);
check('…and a student or applicant of any paper at all',
  /their_role in \('student', 'applicant'\)/.test(sql), true);
check('…and 111 proves both by trying them',
  /a candidate was appointed to invigilate their own paper/.test(sql)
  && /a student was made an observer of an examination/.test(sql), true);

// ---------------------------------------------------------------------------
console.log('\n`assign-proctor` finally has a door\n');

check('the route guards on it', /'assign-proctor' as Capability/.test(route), true);
check('…and removing is guarded the same as appointing, because it closes a door',
  /action !== 'assign' && action !== 'remove'/.test(route), true);
check('the Examination Office holds it', can('exam-officer', 'assign-proctor'), true);
check('…and a lecturer does not', can('lecturer', 'assign-proctor'), false);
check('…nor a student', can('student', 'assign-proctor'), false);

check('the panel is on the Examination Office screen',
  /<ExamOfficers/.test(office), true);
check('…and only for a paper that can actually be sat',
  /\['published', 'in_progress', 'closed'\]\.includes\(r\.status\)/.test(office), true);
check('…and the buttons appear only for the office that holds the capability',
  /mayAssign=\{holds\('assign-proctor'\)\}/.test(office), true);

// THE SCREEN SAYS WHAT AN APPOINTMENT ACTUALLY DOES. Somebody removing an
// officer to tidy a list is closing a door, and should be told so.
check('the panel says an appointment opens the room',
  /An appointment opens the live room/.test(panel), true);
check('…and says plainly when nobody is in it',
  /Nobody is in the room/.test(panel), true);

// ---------------------------------------------------------------------------
console.log(failures === 0
  ? '\nAll good.\n'
  : `\n${failures} failure${failures === 1 ? '' : 's'}.\n`);
process.exit(failures === 0 ? 0 : 1);
