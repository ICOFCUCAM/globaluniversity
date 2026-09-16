// ---------------------------------------------------------------------------
// EVERY OFFICE THE UNIVERSITY HAS CAN BE GIVEN AN ACCOUNT, AND A POST.
//
// Run with:  node src/lib/accountCreation.test.mjs
//
// ---------------------------------------------------------------------------
// THE FAULT THIS WAS WRITTEN AFTER
// ---------------------------------------------------------------------------
//
// The University opened the appointment screen and found that the register of
// positions offered forty-three posts and not one of them was the National
// Rector — an office with its own role, its own capabilities, its own
// dashboard, authority over a nation's students and money, and row-level
// security written specially for it across three migrations.
//
// Then, asked whether an account could at least be created for one: no.
//
// EIGHT OF TWENTY-FIVE ROLES could not be given an account. The two national
// offices, the two HR offices, and all four examination offices. The route
// accepted every one of them — /api/admin/staff takes any role in `roleLabels`
// and checks `canActOn` — so the only thing refusing was a hand-written array
// in a component that nothing compared against anything.
//
// ---------------------------------------------------------------------------
// AND THE SAME SIX ROLES, TWICE
// ---------------------------------------------------------------------------
//
// `portalCoverage.test.mjs` exists because of a fault with exactly this shape:
// "AN INVIGILATOR SAW ONE MENU ITEM. No Dashboard, no Settings, on a system
// that emails them a temporary password and tells them to change it." The two
// HR offices and all four examination offices were missing from the NAVIGATION
// list. They were missing from the ACCOUNT list too, and counting the first
// list did not count the second.
//
// Its own comment says why: "reading a list of sixteen names and noticing
// which seven are absent is not something anybody does reliably. Counting is."
// That was true of one list. This counts the other two.
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

const out = join(root, 'node_modules', '.cache', 'iguc-tests', 'roles-accounts.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'roles.ts'),
  '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error',
  `--alias:@=${join(root, 'src')}`,
]);
const { roleLabels, canActOn } = await import(out);

// ---------------------------------------------------------------------------

console.log('\nEvery office the University has can be given an account\n');

const screen = readFileSync(
  join(root, 'src/components/accounts/AccountManagement.tsx'), 'utf8',
);
const block = screen.slice(
  screen.indexOf('const CREATABLE'), screen.indexOf('];', screen.indexOf('const CREATABLE')),
);
const creatable = [...block.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);

check('the screen’s list was read, not missed', creatable.length > 0, true);

// ---- THE ROLES DELIBERATELY NOT OFFERED, AND WHY -------------------------
//
// An exemption is a claim like any other. Each of these has to stay true, and
// the check below fails if one of them becomes offerable without the note
// being removed.
const NOT_OFFERED = {
  student: 'Comes from the admissions pipeline. A paid application and a Registrar decision '
    + 'sit behind every student account; making one here would be admitting somebody from '
    + 'the accounts screen.',
  applicant: 'The same. An applicant account is created by applying.',
  superadmin: '`canActOn` refuses it — the comparison is strictly-more-senior and nothing '
    + 'outranks the most senior role. Offering it would be drawing a button that always '
    + 'fails.',
};

const everyRole = Object.keys(roleLabels);
const missing = everyRole
  .filter((r) => !creatable.includes(r))
  .filter((r) => !(r in NOT_OFFERED));

check('no office is left with no way to be given an account', missing.sort(), []);

// AND THE EXEMPTIONS ARE STILL EXEMPTIONS.
check('nothing is excused that the screen now offers',
  Object.keys(NOT_OFFERED).filter((r) => creatable.includes(r)), []);
check('nothing is excused that is not a role',
  Object.keys(NOT_OFFERED).filter((r) => !everyRole.includes(r)), []);

// ---- AND THE SUPERADMINISTRATOR CAN ACTUALLY CREATE EVERY ONE ------------
//
// The list offering a role and the rule permitting it are two different
// things, and a screen that offers what the route refuses is a screen that
// wastes somebody's afternoon.
check('the Superadministrator may create every role the screen offers',
  creatable.filter((r) => !canActOn('superadmin', r)), []);

// ---------------------------------------------------------------------------

console.log('\nAnd every office that is appointed by letter has a post in the register\n');

// THE REGISTER IS DATA, seeded by 048 and extended by 103. Read from the SQL
// rather than from a live database, so this fails in the repository rather
// than only on a machine that has run the migrations.
const seeds = ['048_the_job_descriptions_and_what_they_inherit.sql',
  '103_the_nation_has_offices_too.sql']
  .map((f) => readFileSync(join(root, 'docs/migrations', f), 'utf8'))
  .join('\n');

const posts = [...seeds.matchAll(/\('([A-Z][A-Z0-9-]{2,23})',\s*'([^']+)'/g)]
  .map((m) => ({ code: m[1], title: m[2] }));

check('the register was read, not missed', posts.length >= 43, true);

// THE ROLES THAT ARE APPOINTED TO A POST. Not every role is: a student is
// admitted, an applicant applies, and the two system roles are not an
// establishment position anybody is appointed to by letter.
const APPOINTED_TO_A_POST = {
  'national-rector': 'National Rector',
  'national-financial-secretary': 'National Financial Secretary',
  'vice-chancellor': 'Vice-Chancellor',
  chancellor: 'Chancellor',
  registrar: 'Registrar',
  'finance-director': 'Finance Director',
  lecturer: 'Lecturer',
  hod: 'Head of Department',
  'programme-coordinator': 'Programme Coordinator',
  'admissions-officer': 'Admissions Officer',
  'exam-officer': 'Examination Officer',
};

const titles = posts.map((p) => p.title);
const withoutAPost = Object.entries(APPOINTED_TO_A_POST)
  .filter(([, title]) => !titles.includes(title))
  .map(([role, title]) => `${role} → ${title}`);

check('every office appointed by letter is a post somebody can choose', withoutAPost, []);

// ---- THE NATIONAL TIER, NAMED ------------------------------------------
//
// The two the University found missing, asserted by job code as well as by
// title so that renaming one is a deliberate act rather than a silent one.
check('the National Rector is in the register',
  posts.some((p) => p.code === 'NAT-REC' && p.title === 'National Rector'), true);
check('the National Financial Secretary is in the register',
  posts.some((p) => p.code === 'NAT-FIN' && p.title === 'National Financial Secretary'),
  true);

// AND IN A FAMILY OF ITS OWN. Filed under `executive` they would inherit the
// Vice-Chancellor's family clauses, which is not how national money is
// divided.
const m103 = readFileSync(
  join(root, 'docs/migrations/103_the_nation_has_offices_too.sql'), 'utf8',
);
check('both are in the national family',
  /\('NAT-REC'[^)]*'national'[\s\S]{0,200}\('NAT-FIN'[^)]*'national'/.test(m103), true);

// AND THE CODE KNOWS THE FAMILY TOO, or the appointment screen groups them
// under a heading it cannot label.
const positions = readFileSync(join(root, 'src/lib/positions.ts'), 'utf8');
check('the family exists in the code as well as the database',
  /'academic-staff',\s*\n?\s*'national'/.test(positions), true);
check('and it has a label', /national: 'National Administrations'/.test(positions), true);

// ---- THE CHANCELLOR, FOUND BY COUNTING ---------------------------------
//
// Not what the University asked about. `chancellor` is a role holding the
// correspondence chain, the executive dashboard and the power to confer an
// award, and 048 wrote the Vice-Chancellor, the Deputy, the Pro-Vice and the
// University Secretary and stopped one short of the top.
check('the Chancellor is in the register',
  posts.some((p) => p.code === 'EXE-CHAN' && p.title === 'Chancellor'), true);

// AND CARRIES NO DUTIES NOBODY WROTE. 048 seeds a profile for every family and
// for no post, so the Deputy Vice-Chancellor and the University Secretary
// inherit the executive family's and have none of their own. Writing duties
// for the Chancellor would be inventing an institutional fact, so 103's own
// proof refuses one rather than this test merely hoping.
check('and 103 refuses a job description for the Chancellor',
  /a job description was written for the Chancellor/.test(m103), true);

// ---- NOTHING IS ACTIVATED ----------------------------------------------
//
// 048's rule: a job description reaches nobody until somebody has read it and
// somebody else has activated it. 103 does not make an exception of itself, so
// every profile it INSERTS is a draft. (Its proof activates two inside a
// rollback, to watch the inheritance resolve; that is an update, not an
// insert, and it is undone.)
const inserts = m103.split('insert into position_profiles').slice(1)
  .map((chunk) => chunk.slice(0, chunk.indexOf(';')));
check('103 inserts at least the three national profiles', inserts.length >= 3, true);
check('and every one of them is a draft',
  inserts.filter((v) => !v.includes("'draft'")).length, 0);

// AND THE ONLY ACTIVATION IS THE ROLLED-BACK ONE. An `update ... set status =
// 'active'` that is not inside the proof would leave a job description live on
// the University's database without anybody having read it.
const activations = [...m103.matchAll(/set status = 'active'/g)].length;
check('nothing is activated except inside the proof that rolls back',
  activations, 2);

// ---------------------------------------------------------------------------

console.log(failures === 0
  ? '\nEvery office can be given an account, and every appointed office has a post.\n'
  : `\n${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
