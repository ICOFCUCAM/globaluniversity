// ---------------------------------------------------------------------------
// WHAT AN APPOINTMENT MAKES SOMEBODY.
//
// Run with:  node src/lib/staffRecords.test.mjs
//
// ---------------------------------------------------------------------------
// WHAT THIS GUARDS
// ---------------------------------------------------------------------------
//
// The University asked: "What about staff accounts, like lecturers and
// professors? How do you intend to build this one?"
//
// There were two halves and nothing between them. An appointment was drafted,
// approved, issued and accepted; the acceptance page said "Human Resources will
// open your staff record"; and somebody opened a DIFFERENT FORM and retyped the
// name, the email, the title and the department. A name typed twice is a name
// that can differ — the fault the appointment letter exists to prevent,
// arriving by another road.
//
// THE UNIVERSITY'S THREE RULINGS, and each is measured below:
//
//   1. AN OFFICER OPENS IT, not the acceptance. So no code path may create a
//      staff record as a side effect of somebody accepting.
//   2. THE ACADEMIC OFFICE, THE REGISTRAR AND THE VICE-CHANCELLOR may do it —
//      and, before this, only the Superadministrator could create any account.
//   3. EVERY APPOINTEE GETS A STAFF NUMBER, whatever their post. It used to
//      come out of `lecturers`, so a Dean or a Director received an account and
//      no number at all.
//
// AND THE ROLE IS NOT A DROPDOWN. It comes from the family the University filed
// the post under, so an account's powers follow the appointment rather than
// whoever happened to open the record.
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

const out = join(cache, 'staffRecords.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'staffRecords.ts'), '--bundle', '--format=esm',
  '--platform=node', `--outfile=${out}`, '--log-level=error',
  `--alias:@=${join(here, '..')}`,
]);
const S = await import(out);

const rolesOut = join(cache, 'rolesForStaff.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'roles.ts'), '--bundle', '--format=esm',
  '--platform=node', `--outfile=${rolesOut}`, '--log-level=error',
  `--alias:@=${join(here, '..')}`,
]);
const R = await import(rolesOut);

const positionsOut = join(cache, 'positionsForStaff.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'positions.ts'), '--bundle', '--format=esm',
  '--platform=node', `--outfile=${positionsOut}`, '--log-level=error',
  `--alias:@=${join(here, '..')}`,
]);
const P = await import(positionsOut);

console.log('\nThe post decides the account, not whoever opens the record\n');

// --- EVERY FAMILY HAS AN ANSWER -------------------------------------------
//
// A family added later and forgotten here would silently hand somebody the
// fallback role, which is a real account with real powers.
for (const family of P.POSITION_FAMILIES) {
  const role = S.roleForFamily(family);
  check(`${family} maps to a role the University has`,
    Object.keys(R.roleLabels).includes(role), true);
}

// --- AND NOT TO ONE THIS MAY NEVER MINT -----------------------------------
//
// `superadmin` is system custody; `chancellor` and `vice-chancellor` are the
// University's two most senior offices. None may be created by opening a staff
// record — that is a decision somebody takes on purpose, not a consequence of
// filing a post under a family.
for (const family of [...P.POSITION_FAMILIES, null, undefined, 'a-family-nobody-declared']) {
  check(`${String(family)} never mints a role that must be granted on purpose`,
    S.NEVER_FROM_AN_APPOINTMENT.includes(S.roleForFamily(family)), false);
}

// --- THE ONES THAT MATTER, NAMED ------------------------------------------
check('an academic-staff post makes a lecturer', S.roleForFamily('academic-staff'), 'lecturer');
check('faculty leadership makes a dean', S.roleForFamily('faculty-leadership'), 'dean');
// AN UNFILED POST GETS THE SMALLEST ACCOUNT THERE IS. An account that can do
// too much is a mistake nobody notices; one that can do too little is reported
// on the first morning.
check('a post nobody filed gets the smallest account', S.roleForFamily(null), 'lecturer');

// --- WHO TEACHES ----------------------------------------------------------
//
// A teaching record is what allocates a course. A Dean who cannot be allocated
// one cannot do half their job; a Finance Officer has no business with one.
check('a lecturer gets a teaching record', S.TEACHES.includes('academic-staff'), true);
check('and so does a Dean', S.TEACHES.includes('faculty-leadership'), true);
check('an administrator does not', S.TEACHES.includes('administration'), false);
check('nor does an executive officer', S.TEACHES.includes('executive'), false);

console.log('\nAnd the University’s three rulings hold\n');

// --- 2. WHO MAY OPEN ONE --------------------------------------------------
const roles = readFileSync(join(here, 'roles.ts'), 'utf8');
const holdersOf = (capability) => {
  const o = [];
  for (const m of roles.matchAll(/'?([a-z-]+)'?:\s*\[([^\]]*)\]/g)) {
    if (m[2].includes(capability)) o.push(m[1]);
  }
  return o;
};
const openers = holdersOf('open-staff-record');
check('the Academic Office may open a staff record', openers.includes('academic-office'), true);
check('so may the Registrar', openers.includes('registrar'), true);
check('and so may the Vice-Chancellor', openers.includes('vice-chancellor'), true);
// NOT HR. They draft the appointment; opening the record creates a University
// login, and the University put that elsewhere. Named so that a later change
// is a decision rather than a drift.
check('HR drafts the appointment but does not open the record',
  openers.includes('hr-officer') || openers.includes('hr-administrator'), false);

// --- 1. AND NOTHING OPENS ONE BY ITSELF -----------------------------------
//
// "An officer opens it." A staff record created as a side effect of acceptance
// would be a live login nobody authorised, so the accept route must not write
// to the register.
const decomment = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

const accept = decomment(
  readFileSync(join(here, '../app/api/appointments/accept/route.ts'), 'utf8'));
check('accepting a letter does not open a staff record',
  /staff_records/.test(accept), false);
check('…and says so to the appointee',
  /staff record/i.test(
    readFileSync(join(here, '../app/api/appointments/accept/route.ts'), 'utf8')), true);

// --- 3. EVERY APPOINTEE GETS A NUMBER -------------------------------------
//
// The number used to be issued from `lecturers`, which only teaching staff are
// in. 082 moves it to the register, and the route must ask the register.
const route = decomment(
  readFileSync(join(here, '../app/api/appointments/staff-record/route.ts'), 'utf8'));

check('the staff number comes from the register',
  /rpc\('next_staff_number'/.test(route), true);
check('…and not from the lecturers table',
  /from\('lecturers'\)[\s\S]{0,200}staff_id[\s\S]{0,60}order/.test(route), false);
check('a register row is written for every appointee',
  /from\('staff_records'\)\.insert/.test(route), true);
// The teaching record is conditional; the register row is not.
//
// MATCHED ON `TEACHES.includes` RATHER THAN ON THE WHOLE `if`. 104 gave the
// condition a second clause — `!lecturerId &&`, so that reopening an account
// finds the teaching record instead of writing a second one — and an assertion
// pinned to the exact old text failed a change that strengthened what it was
// guarding. What has to stay true is that the teaching record is behind
// TEACHES and the register row is not.
check('…while the teaching record is only for those who teach',
  /TEACHES\.includes/.test(route), true);
check('…and the register row is behind no such condition',
  /TEACHES[\s\S]{0,400}from\('staff_records'\)\.insert/.test(route), false);

// --- NOTHING IS RETYPED ----------------------------------------------------
//
// The whole point. Every particular is read from the appointment, so the
// register and the letter cannot disagree about who somebody is.
for (const field of ['full_name', 'email', 'position_title', 'position_id', 'employment_type']) {
  check(`${field} is copied from the appointment`,
    new RegExp(`${field}: a\\.${field}|${field},`).test(route), true);
}

// --- AND IT REFUSES BEFORE ACCEPTANCE -------------------------------------
check('a staff record is refused before the appointee has accepted',
  /\['accepted', 'active'\]\.includes\(String\(a\.status\)\)/.test(route), true);
check('…in words, not as a constraint violation',
  /Being appointed and being on the staff register are two/.test(route), true);

// --- OPENING IT TWICE IS NOT TWO JOBS -------------------------------------
check('opening the same appointment twice returns what is there',
  /alreadyOpen: true/.test(route), true);

// --- THE PASSWORD ----------------------------------------------------------
//
// Generated once, emailed, stored nowhere. It comes back to the screen only
// where the email could not be sent, or the account would be unreachable.
check('the password is returned only when the email failed',
  /\.\.\.\(delivered \? \{\} : \{ password/.test(route), true);
check('…and the register never stores one',
  /staff_records[\s\S]{0,600}password/.test(
    readFileSync(join(here, '../../docs/migrations/082_the_staff_register.sql'), 'utf8')
      // INDENTED COMMENTS TOO. `^--` misses "  -- the password is ... never
      // stored here", which is the very line explaining that it is not stored,
      // and the check then fails on its own explanation.
      .replace(/^\s*--.*$/gm, '')), false);

console.log(failures ? `\n${failures} check(s) failed.\n` : '\nAll staff record checks passed.\n');
process.exit(failures ? 1 : 0);
