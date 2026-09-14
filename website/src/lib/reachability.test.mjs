// ---------------------------------------------------------------------------
// IS IT REACHABLE? — the audit, as a test.
//
// Run with:  node src/lib/reachability.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
//
// Every serious defect found in this system in the last two sessions was the
// same defect wearing different clothes:
//
//   · Five screens were built and none was in the sidebar. Nobody could open
//     any of them.
//   · Three screens called guarded routes with no bearer token. Every one
//     loaded, drew its whole interface, and said "Error: no-token".
//   · The social connect button navigated the browser to a guarded route, which
//     a navigation cannot authenticate. It could never have worked.
//   · `signature_specimens` was read by two routes and written by nothing, so
//     the Vice-Chancellor's signature could not reach a letter whatever was in
//     the database.
//   · `appointment_allowances` was read by the letter and written by nothing,
//     so every letter showed a basic salary and no allowances could exist.
//   · `/api/appointments/letter` — which generates, seals, archives, issues and
//     emails the appointment letter — was called by no screen at all. An
//     appointment could be drafted, submitted and approved, and then the
//     workflow simply stopped.
//   · `position_id` was never written by anything, so no appointment was ever
//     attached to a post — and the register of wording, the job description and
//     the standing of an office were all unreachable through it.
//
// None of these is a logic error. Each is a thing that exists, is correct, and
// is connected to nothing. Unit tests pass over all of them, because every
// individual piece works.
//
// So this file asks the question those tests cannot: IS ANYTHING CALLING IT?
// It reads the source and fails when a route has no caller, or a table has a
// reader and no writer.
//
// ---------------------------------------------------------------------------
// IT IS DELIBERATELY CRUDE
// ---------------------------------------------------------------------------
//
// It greps. It does not parse, and it cannot tell a live caller from one in a
// comment. That is an acceptable trade: the failure it hunts is total absence,
// and total absence is exactly what grep is good at. A false pass here is
// possible; a false FAILURE — which is what would waste somebody's time — is
// not, because the fix is always to add the caller the entry is asking for.
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync, statSync } from 'node:fs';
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

const src = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

/** Every file under a directory, recursively. */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const all = walk(src);
const routes = all.filter((f) => f.endsWith('/route.ts'));
// WHAT COUNTS AS A CALLER: a screen or a library, never another route and never
// a test. A route called only by a test is a route nobody can reach.
const callers = all.filter((f) =>
  (f.endsWith('.tsx') || f.endsWith('.ts'))
  && !f.includes('/api/')
  && !f.endsWith('.test.mjs'));

const callerText = callers.map((f) => readFileSync(f, 'utf8')).join('\n');

// ---------------------------------------------------------------------------
console.log('\nEvery guarded route has something that calls it\n');

// ---------------------------------------------------------------------------
// THE EXEMPTIONS, EACH WITH ITS REASON WRITTEN DOWN.
//
// An exemption is a claim that a route is reachable by something other than a
// screen. Every one has to say what, because "we know about that one" is how a
// list like this stops meaning anything.
// ---------------------------------------------------------------------------
const NOT_CALLED_FROM_A_SCREEN = {
  'social/oauth/callback': 'The provider redirects the browser here. There is no caller by design.',
  'credential/check': 'Called by /verify through a plain fetch with no helper, and by anybody '
    + 'checking a document from outside the University.',
  'admissions/admit': 'Superseded by /api/admissions/approve, which does the whole thing. Kept '
    + 'because letters issued through it name it in their audit trail.',
  'admissions/approve': 'Called by the admissions desk through its own inline fetch.',
  'exam/mark': 'Called by the marking screen through its own inline fetch.',
  'results/recompute': 'Called by the results screen through its own inline fetch.',
  'document/archived': 'Reads an archived document by reference; reached from a link, not a '
    + 'button.',
};

const uncalled = [];
for (const route of routes) {
  const path = route.slice(route.indexOf('/api/') + 5).replace('/route.ts', '');
  if (NOT_CALLED_FROM_A_SCREEN[path]) continue;
  if (!callerText.includes(`/api/${path}`)) uncalled.push(path);
}

check('no route is unreachable from every screen', uncalled, []);

// ---------------------------------------------------------------------------
console.log('\nNo table is read by code that nothing can write to\n');

// ---------------------------------------------------------------------------
// THE ONE THAT FOUND THE SIGNATURES AND THE ALLOWANCES.
//
// A table the application READS and never WRITES is either a view, or seeded
// data, or a feature that cannot work. The first two are listed below with the
// reason; anything else is the third.
// ---------------------------------------------------------------------------
const READ_ONLY_BY_DESIGN = {
  // Views. Nothing writes to a view.
  appointment_letter_verification: 'A view.',
  appointment_letters_unverifiable: 'A view, for an operator with SQL.',
  appointments_awaiting_acceptance: 'A view.',
  appointments_without_pay: 'A view — the same rows without the salary.',
  appointment_remuneration: 'A view.',
  correspondence_verification: 'A view.',
  document_template_coverage: 'A view.',
  position_job_description: 'A view: the resolved job description.',
  appointments_awaiting_staff_record: 'A view: appointees who have accepted and are not yet on '
    + 'the staff register. Written through `staff_records`, which is what opening a record '
    + 'inserts into — this only subtracts one from the other so the screen asks one question '
    + 'rather than two.',
  position_default_conditions: 'A view: the conditions of appointment in force for a post — '
    + 'its own active set where it has one, its family\'s everywhere else, section by '
    + 'section. Written through `appointment_condition_sets` and '
    + '`appointment_condition_clauses`, which the Conditions of appointment screen edits.',
  course_roll: 'A view: who is actually taking a course, registered and completed but never '
    + 'dropped. The mark sheet, the GPA engine and the graduation audit read it rather than '
    + 'each filtering `enrollments` for themselves.',
  position_profiles_unapproved: 'A view.',
  admission_status_coverage: 'A view.',
  curriculum_progress: 'A view over programme_versions and curriculum_entries. It is what the '
    + 'Curriculum Builder reads on every edit: programme_in_force joins only PUBLISHED versions, '
    + 'and a builder works on a draft.',
  academic_term_now: 'A view over `academic_term_on(current_date)`, which reads the academic '
    + 'calendar. Nothing writes it because nothing writes a date — it answers "which term is it" '
    + 'so that no screen has to reach for new Date().getFullYear() and be wrong every January.',
  course_offering_roll: 'A view over course_offerings, class_sections and enrollments: every '
    + 'offering with its lecturer, its classes and how full it is. `places_left` is computed '
    + 'there rather than by each screen, because null — no ceiling — is not zero, and a screen '
    + 'that reads it as zero closes a course nobody limited. /api/academic/offerings writes the '
    + 'tables underneath it.',
  timetable_clashes: 'A view: room, lecturer and student-cohort conflicts. Computed once in SQL '
    + 'rather than by each screen, because two classes where one ends exactly as the other '
    + 'begins do NOT clash — `<` and `>` rather than `<=` and `>=` — and that is the boundary '
    + 'every hand-written overlap check gets wrong.',
  academic_year_now: 'A view: the academic year today falls in, derived from the dates every '
    + 'time it is asked. Nothing writes it because nothing writes a date. It replaces reading '
    + '`status = \'current\'`, which 059 set once on the day it ran and nothing updated — correct '
    + 'that day and wrong from the following August.',
  academic_year_drift: 'A view: years whose stored status no longer matches the calendar. The '
    + 'report that makes a stale year visible before three screens quietly open on the wrong '
    + 'one. /api/academic/calendar writes the table underneath it.',
  registration_window: 'A view: whether registration is open for each term, and whether a window '
    + 'was ever recorded — two different facts in two columns, because a term nobody has dated '
    + 'is OPEN and a caller that collapsed them would lock out every student. '
    + '/api/academic/calendar writes the periods underneath it.',
  academic_period_calendar: 'A view: every registration, teaching, examination and results window '
    + 'with the term and year it belongs to. /api/academic/calendar writes academic_periods.',
  student_academic_record: 'A view over students, programme_versions, results and '
    + 'semester_gpas: where each student is up to and how far that is from the award. Nothing '
    + 'writes it because every figure in it is counted from rows the registration and results '
    + 'pipelines already write.',
  student_curriculum_progress: 'A view: every course of the curriculum a student was admitted '
    + 'under, marked passed, failed, registered or not-taken.',
  student_term_record: 'A view: a student\'s terms with credits attempted and earned, keyed on '
    + 'the term the course was TAKEN in rather than the curriculum\'s year and semester.',
  my_courses: 'A view: the signed-in student\'s own courses, filtered by auth.uid() in the '
    + 'DATABASE rather than by a screen remembering to — a screen that forgets shows one student '
    + 'another\'s courses. /api/enrolment writes the registrations underneath it.',
  my_teaching: 'A view: the signed-in lecturer\'s courses, from their offerings and from '
    + 'courses.lecturer_id where no term has been set up yet. /api/academic/offerings writes the '
    + 'offerings underneath it.',
  graduation_candidate: 'A view: every student reading for an award with the four inputs a '
    + 'graduation decision needs, and whether one has already been conferred. '
    + '/api/academic/graduation writes graduation_records underneath it.',
  graduation_cohort: 'A view: conferrals grouped by the day they were conferred — a congregation, '
    + 'as the register sees it.',
  // ---------------------------------------------------------------------
  // THE SIX THE STUDENT PORTAL READS AND NOTHING WRITES, ON PURPOSE.
  //
  // Every one of them filters on auth.uid() INSIDE THE DATABASE rather than
  // leaving a screen to remember to. That is the whole reason they are views
  // and not queries: a screen that forgets the filter shows one student
  // another student's marks, and no amount of care in the browser prevents
  // that as reliably as a view that cannot return anybody else's rows.
  // ---------------------------------------------------------------------
  my_journey: 'A view: where the signed-in student stands in their own journey, from '
    + '`student_stage()`. Nothing writes it because every fact in it is counted from rows the '
    + 'admissions, enrolment, registration and results pipelines already write.',
  my_curriculum: 'A view: the signed-in student\'s own curriculum with each course marked, plus '
    + 'whether it is OFFERED this term — the fact that separates "outstanding" from "not yet '
    + 'available". /api/enrolment and /api/academic/offerings write underneath it.',
  my_week: 'A view: the signed-in student\'s own classes arranged as a week, with the day NAMED '
    + 'in SQL. Named there and not in the browser because class_sections.day_of_week is ISO '
    + '(1 = Monday) and a browser assuming 0 = Sunday puts every class on the wrong day. '
    + '/api/academic/offerings writes the classes underneath it.',
  my_assessments: 'A view: assignment briefs and published examinations for the courses the '
    + 'signed-in student is registered on, in one list. The Assignments screen writes the briefs '
    + 'into module_records and the examination office writes the papers.',
  my_results: 'A view: the signed-in student\'s marks from the moment the lecturer SUBMITS them, '
    + 'each flagged official or provisional. A draft is not in it. /api/results and the approval '
    + 'chain write the results underneath it.',
  my_result_terms: 'A view: the same marks by term, with the GPA READ from semester_gpas rather '
    + 'than recomputed — a second opinion on a GPA is how a portal and a transcript come to '
    + 'disagree about the most consulted number in the University.',
  // ---------------------------------------------------------------------
  // THE ONE TABLE THAT IS DELIBERATELY NOT EDITABLE FROM A SCREEN.
  //
  // The portal now READS the grading scale — that is the whole point of the
  // grading context — and nothing in it writes one, on purpose.
  //
  // A transcript issued in 2026 was computed under the 2026 bands. Editing
  // those bands changes what the University said about a graduate after the
  // fact, so a scale is never edited: it is RESTATED as a new version, and
  // migration 020 enforces that with a trigger rather than trusting any
  // screen. 035 is what a restatement looks like — version 1 deactivated,
  // version 2 written beside it, both kept.
  //
  // A "change the grading scale" button would be a button that quietly
  // rewrites history, and the right home for a restatement is a migration
  // that can be read, reviewed and proved before it runs.
  // ---------------------------------------------------------------------
  grading_scales: 'Read by the grading context, which loads the active scale when the portal '
    + 'starts. Written only by migration, deliberately: a scale is restated as a new version '
    + 'rather than edited, because editing it changes what the University already said about '
    + 'graduates computed under it.',
  student_fee_account: 'A view over `student_fee_assessments` and `payments`: what the ledger '
    + 'says, per student per currency. Never stored, because a stored balance drifts from the '
    + 'rows it came from and nobody can then say which is right. /api/finance/fees writes the '
    + 'assessments and the Finance desk writes the payments underneath it.',
  capability_grants_in_force: 'A view over `capability_grants`, which /api/admin/capability-grant '
    + 'writes. It exists so that "still in force" — not revoked AND not expired — is decided in '
    + 'one place: a caller checking only `revoked_at is null` would honour a grant that ran out '
    + 'months ago, and that is the mistake every caller makes eventually.',
  // Seeded by migration and read by the application.
  positions: 'Seeded by 048 and given standing by 053. The register of posts is '
    + 'institutional structure, changed by migration rather than by a screen.',
  institutional_settings: 'Seeded by 050. One row, one setting, changed rarely and '
    + 'deliberately.',
  admission_states: 'Seeded by 025.',
  academic_approval_requirements: 'Seeded by 058: the Vice-Chancellor approves a curriculum. Held '
    + 'as DATA rather than in a trigger so the University can tighten its own governance chain '
    + 'with an INSERT — adding the Head of Department and the Dean needs no deployment. Nothing '
    + 'in the application writes it because who signs a curriculum is a constitutional question, '
    + 'not a screen.',
  awards: 'Seeded.',
  grading_scale: 'Seeded and published.',
};

const tablesRead = new Set();
const tablesWritten = new Set();

for (const f of all.filter((x) => x.endsWith('.ts') || x.endsWith('.tsx'))) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/\.from\('([a-z_]+)'\)/g)) {
    const table = m[1];
    tablesRead.add(table);
    // The write verb follows the .from() within a short span, or on the next
    // chained call. Crude on purpose — see the header.
    const after = text.slice(m.index, m.index + 400);
    if (/\.(insert|update|upsert|delete)\s*\(/.test(after)) tablesWritten.add(table);
  }
}

// ---------------------------------------------------------------------------
// KNOWN MISSING, AND NOT QUIETLY EXEMPT.
//
// These are NOT read-only by design. They are features the University does not
// have yet, and the difference matters: an entry above says "this is fine", an
// entry here says "this is a hole, it is known, and here is where it is
// written down". They are printed on every run rather than filtered out
// silently, so the list stays in front of somebody.
//
// Moving something here is not how a finding is closed. Closing it is building
// the screen and deleting the entry.
// ---------------------------------------------------------------------------
const KNOWN_MISSING = {
  // ---------------------------------------------------------------------
  // EMPTY, AND THAT IS THE POINT OF THE CHECK BELOW.
  //
  // `enrollments` was the one entry here: no course-registration screen
  // existed, so the results pipeline, the GPA engine and the graduation audit
  // all read a table nothing could write to. 054 and /api/enrolment closed it,
  // and this test refused to pass until the entry was removed — which is the
  // behaviour that stops a list like this becoming a graveyard of things
  // somebody once decided not to fix.
  // ---------------------------------------------------------------------
  //
  // AND THE ONE ENTRY THIS LIST HELD IS GONE, WHICH IS THE POINT.
  //
  // `programmes` was named here after the Fee Schedules screen became the
  // first thing in the application to read it and this check found that
  // nothing could write it — the University's forty-one were seeded by
  // migration 060 and a forty-second meant writing SQL.
  //
  // The Programme register now creates one, so the entry had to go: this test
  // fails while something is excused that no longer needs excusing, which is
  // what stops a list like this becoming a record of things somebody once
  // decided not to fix.

};

const readNeverWritten = [...tablesRead]
  .filter((t) => !tablesWritten.has(t))
  .filter((t) => !READ_ONLY_BY_DESIGN[t])
  .sort();

const knownMissing = readNeverWritten.filter((t) => KNOWN_MISSING[t]);
const unexplained = readNeverWritten.filter((t) => !KNOWN_MISSING[t]);

check('every table the application reads, something can also write — or the gap is named',
  unexplained, []);

// SAID OUT LOUD ON EVERY RUN. A known gap that nobody is reminded of is a
// forgotten one.
for (const t of knownMissing) {
  console.log(`      still missing: ${t} — ${KNOWN_MISSING[t]}`);
}

// AND THE LIST CANNOT ROT. An entry naming a table the application no longer
// reads is an entry describing a gap that has been closed or a table that has
// been removed, and either way it is now misinformation.
check('nothing is named as missing that is no longer read',
  Object.keys(KNOWN_MISSING).filter((t) => !readNeverWritten.includes(t)), []);

// ---------------------------------------------------------------------------
console.log('\nAnd the two the audit actually found are closed\n');

// NAMED INDIVIDUALLY as well as caught by the sweep above, because these two
// are the ones that were broken and a regression in either is worth a failure
// that says which.
check('a signature specimen can be stored', tablesWritten.has('signature_specimens'), true);
check('an allowance can be created', tablesWritten.has('appointment_allowances'), true);
check('an appointment can be attached to a post',
  callerText.includes('positionId') || readFileSync(
    join(src, 'app/api/appointments/route.ts'), 'utf8').includes('position_id'), true);
check('the letter route is called by a screen',
  callerText.includes('/api/appointments/letter'), true);
check('the job description can be printed',
  callerText.includes('/api/admin/job-description/document'), true);

// ---------------------------------------------------------------------------
console.log('\nGuarded routes are called with a token, not a cookie\n');

// ---------------------------------------------------------------------------
// THE `no-token` FAMILY. `credentials: 'include'` sends the Supabase session
// COOKIE, which `guard()` never looks at — it reads an Authorization header.
// Three screens shipped doing this, and each drew its whole interface before
// saying "Error: no-token", which reads as a database fault and is not one.
// ---------------------------------------------------------------------------
// COMMENTS STRIPPED FIRST, and this file has now been caught by that twice.
// `authedFetch.ts` EXPLAINS this fault in its own header — it has to name the
// thing it refuses — and naming it made the test report the one file in the
// codebase that gets this right as the one getting it wrong.
//
// The same trap took the nav audit and the coverage extractor earlier: a rule
// that reads source as text must read the CODE, not the prose about the code.
const withoutComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

const cookieCallers = callers.filter((f) => {
  const text = withoutComments(readFileSync(f, 'utf8'));
  return text.includes("credentials: 'include'") && text.includes('/api/');
}).map((f) => f.slice(src.length + 1));

check('no screen authenticates a guarded route with a cookie', cookieCallers, []);

// ---------------------------------------------------------------------------
console.log('\nNothing navigates the browser to a guarded route\n');

// A TOP-LEVEL NAVIGATION CARRIES NO AUTHORIZATION HEADER. The social connect
// button did exactly this and could never have worked: every click ended in a
// blank tab reading {"ok":false,"error":"no-token"}.
const navigators = callers.filter((f) => {
  const text = readFileSync(f, 'utf8');
  return /(?:window\.location\.href\s*=|window\.open\()\s*[`'"]\/api\//.test(text);
}).map((f) => f.slice(src.length + 1));

check('no screen navigates to an /api/ address', navigators, []);

// ---------------------------------------------------------------------------
console.log(failures === 0
  ? '\nEverything built is connected to something.\n'
  : `\n${failures} failed — something exists that nothing can reach.\n`);
process.exit(failures === 0 ? 0 : 1);
