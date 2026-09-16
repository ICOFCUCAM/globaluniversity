// ---------------------------------------------------------------------------
// ONE NAME FOR ONE ACT, AND THE NAME IS SPENT SOMEWHERE.
//
// Run with:  node src/lib/oneNameForOneAct.test.mjs
//
// ---------------------------------------------------------------------------
// THE FAULT THIS WAS WRITTEN AFTER
// ---------------------------------------------------------------------------
//
// Allocating a lecturer to a course had FOUR capability names —
// `assign-lecturers`, `assign-lecturers-to-courses`, `approve-course-allocation`
// and `manage-course-offerings` — held between them by the Academic Office, the
// Head of Department, the System Administrator and, it was believed, the
// Superadministrator alone.
//
// Nothing consulted any of them. The Course Offerings screen, which is where
// the act happens, guarded on `manage-courses` — the CATALOGUE permission,
// which answers what BIS 220 *is*, not who teaches it this year.
//
// THREE OF THE FOUR WERE KNOWN TO BE EMPTY. The fourth was not, and that is the
// part worth a test. An audit note asserted for months that the Offerings
// screen "guards on `manage-course-offerings` instead" — and that string was
// declared nowhere in this codebase. It appeared only inside the sentence
// claiming it was enforced.
//
// It survived because `can('superadmin', <anything>)` is true: the
// Superadministrator holds 'all', so probing the matrix for an undeclared name
// answers yes, and the one office that needs no guard is the only one a guard
// against a misspelling admits.
//
// A capability check against a name nobody declared is not a weak guard. It is
// a guard that refuses every office except the one that could already do
// everything — silently, and with a grant screen still offering the name.
//
// ---------------------------------------------------------------------------
// SO THIS ASKS THREE THINGS
// ---------------------------------------------------------------------------
//
//   1. Every capability a role is granted is a DECLARED capability. TypeScript
//      catches this in roles.ts itself; it does not catch a string passed to
//      can() from a component, which is how the fault arrived.
//
//   2. Every capability named in a can() or guard() call somewhere in the
//      application is declared. This is the direction that was broken.
//
//   3. The retired names are gone, the survivor is held by the offices that
//      did the work, and no office that could allocate a lecturer before can
//      no longer do so.
// ---------------------------------------------------------------------------

import { readFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

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
const src = join(root, 'src');

const dir = join(root, 'node_modules', '.cache', 'iguc-tests');
mkdirSync(dir, { recursive: true });
const out = join(dir, 'roles-one-name.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'roles.ts'),
  '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error',
  `--alias:@=${join(root, 'src')}`,
]);
const { can, OPERATIONAL_CAPABILITIES, SYSTEM_CAPABILITIES } = await import(out);

const DECLARED = new Set([...OPERATIONAL_CAPABILITIES, ...SYSTEM_CAPABILITIES]);

// ---------------------------------------------------------------------------

function walk(d, acc = []) {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) { walk(p, acc); continue; }
    if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) acc.push(p);
  }
  return acc;
}

const files = walk(src);

console.log('\nEvery capability the application checks is a capability the University declares\n');

// `can(x, 'name')` and `guard(request, 'name')`. The cast form
// `'name' as Capability` is deliberately included: a cast is exactly how an
// undeclared string gets past the compiler, so it is the form most in need of
// watching.
const CALL = /\b(?:can|guard)\s*\(\s*[^,()]*(?:\([^()]*\))?[^,()]*,\s*'([a-z][a-z0-9-]*)'/g;
const CAST = /'([a-z][a-z0-9-]*)'\s+as\s+Capability/g;

const undeclared = [];
const otherVocabulary = new Set();
for (const file of files) {
  // roles.ts declares them; handbookFromTheSystem.ts is generated FROM them.
  if (/roles\.ts$/.test(file) || /handbookFromTheSystem\.ts$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');

  // ---------------------------------------------------------------------
  // THE OTHER `can()`, WHICH IS NOT THIS SYSTEM'S.
  //
  // The vendored Academic Studio under src/academic imports `can` from its own
  // ./capabilities — a SECOND capability vocabulary with a second vocabulary's
  // worth of names, none of them declared in roles.ts, none of them visible on
  // any grant screen, and none of them something the University can withhold
  // from an office.
  //
  // That is a decision for the University (adopt the folder properly or retire
  // it) and not a fault this test can fix. What it can do is stop the second
  // vocabulary growing quietly while the decision is outstanding, so those
  // names are counted here rather than excused unseen.
  // ---------------------------------------------------------------------
  const vendored = /^src\/academic\//.test(relative(root, file).replace(/\\/g, '/'))
    || /from '@\/academic\//.test(text)
    || /from '\.{1,2}\/(?:[\w.-]+\/)*capabilities'/.test(text);

  for (const re of [CALL, CAST]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      if (DECLARED.has(m[1])) continue;
      if (vendored) { otherVocabulary.add(m[1]); continue; }
      undeclared.push(`${relative(root, file)}: ${m[1]}`);
    }
  }
}
check('no screen or route checks a capability that does not exist', undeclared.sort(), []);

// THE SECOND VOCABULARY, COUNTED. If this number moves, somebody has either
// made the decision or deepened the problem, and either way it should be said
// out loud rather than discovered later.
const second = [...otherVocabulary].sort();
console.log(`      the vendored Academic Studio carries ${second.length} capability names of `
  + 'its own, which roles.ts does not declare and no grant screen can offer:');
console.log(`        ${second.join(', ')}`);
check('the Academic Studio’s separate vocabulary has not grown', second, [
  'approve-translation', 'authorise-own-voice', 'issue-certificate', 'manage-enrolment',
  'manage-faculties', 'manage-people', 'mark-assignment', 'request-translation',
  'set-assignment', 'set-reading', 'set-working-language', 'submit-assignment',
  'upload-source-material', 'view-engagement',
]);

// ---------------------------------------------------------------------------

console.log('\nThe four names for allocating a lecturer are one name\n');

const RETIRED = [
  'assign-lecturers',
  'assign-lecturers-to-courses',
  'approve-course-allocation',
  'message-lecturers',
  'impersonate-user',
  'reinstate-account',
];
check('the six retired names are declared nowhere',
  RETIRED.filter((c) => DECLARED.has(c)), []);

check('the surviving name is declared',
  DECLARED.has('manage-course-offerings'), true);

// THE OFFICES THAT DID THE WORK. The University's rule when it retired the
// three: "the surviving name must be held by the offices that did the work —
// otherwise the merge quietly withdraws an authority instead of tidying a
// name." The Academic Office held `assign-lecturers`; the Head of Department
// held the other two; the System Administrator held all three.
for (const role of ['superadmin', 'admin', 'academic-office', 'hod']) {
  check(`${role} may allocate a lecturer`, can(role, 'manage-course-offerings'), true);
}

// AND THE ONE NOBODY GRANTED IT TO, who could do it anyway. The Programme
// Coordinator reached the act through `manage-courses` while holding none of
// the four names. Moving the guard onto the canonical name would have taken
// that away without anybody deciding to.
check('the programme coordinator keeps what it could already do',
  can('programme-coordinator', 'manage-course-offerings'), true);

// ---- THE GUARD, BROKEN ----------------------------------------------------
//
// A rule nobody has watched refuse anything is a rule nobody has tested. A
// lecturer teaches the course and does not decide who teaches it; a student is
// not near this at all.
for (const role of ['lecturer', 'student', 'finance', 'librarian', 'national-rector']) {
  check(`${role} may not allocate a lecturer`, can(role, 'manage-course-offerings'), false);
}

// AND THE MISSPELLING THAT STARTED IT. `can()` must not answer yes to a name
// the University never declared — for any office that is not the
// Superadministrator, who holds 'all' and for whom this question has no
// meaning.
check('an undeclared name admits nobody',
  ['admin', 'academic-office', 'hod', 'registrar', 'lecturer']
    .filter((r) => can(r, 'manage-course-offering')), []);

// ---------------------------------------------------------------------------

console.log('\nEnrolment attaches a student to a curriculum, and says so\n');

// `assign-programme` was listed for months as a capability nothing checked,
// with the note "there is no screen that does". There is: enrolment is the act.
const enrol = readFileSync(join(src, 'app/api/admissions/enrol/route.ts'), 'utf8');
check('the enrolment route guards on assign-programme',
  /guard\(request,\s*'assign-programme'\)/.test(enrol), true);

// Nothing is withdrawn: every office offered the Enrolment screen holds it.
for (const role of ['superadmin', 'admin', 'registrar']) {
  check(`${role} may still enrol`, can(role, 'assign-programme'), true);
}
const nav = readFileSync(join(src, 'lib/portalNav.tsx'), 'utf8');
const enrolEntry = nav.slice(nav.indexOf("id: 'enrolment'") + "id: 'enrolment'".length);
const offered = [...enrolEntry.slice(0, enrolEntry.indexOf('},')).matchAll(/'([a-z-]+)'/g)]
  .map((m) => m[1]);
check('the Enrolment entry was read, not missed', offered.length > 0, true);
check('no office is offered Enrolment that cannot enrol',
  offered.filter((r) => !can(r, 'assign-programme')), []);

// ---------------------------------------------------------------------------

console.log(failures === 0
  ? '\nOne act, one name, and the name is checked where the act happens.\n'
  : `\n${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
