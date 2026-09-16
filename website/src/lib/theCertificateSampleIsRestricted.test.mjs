// ---------------------------------------------------------------------------
// THE CERTIFICATE SAMPLE IS THE VICE-CHANCELLOR'S AND THE
// SUPERADMINISTRATOR'S, AND NOBODY ELSE'S.
//
// Run with:  node src/lib/theCertificateSampleIsRestricted.test.mjs
//
// ---------------------------------------------------------------------------
// THE UNIVERSITY'S RULING, 16 SEPTEMBER 2026
// ---------------------------------------------------------------------------
//
//   "No office, department, National Administration, Registrar, Director of
//    Academic Affairs, lecturer, staff member, student, or National Rector may
//    view, download, preview, copy, reproduce, or access the official
//    certificate template/sample. […] The certificate design is therefore
//    treated as a restricted institutional security asset."
//
//   "The security restriction should not exist only in the user interface. It
//    should be enforced at the authorization/API/database level. […] Simply
//    hiding a button is not sufficient."
//
// ---------------------------------------------------------------------------
// WHAT THIS WAS BEFORE
// ---------------------------------------------------------------------------
//
// The specimen book was reachable by four roles — the Superadministrator, the
// Vice-Chancellor, the REGISTRAR and the ACADEMIC OFFICE — and gated by
// nothing but a sidebar role list. `CredentialsWorkspace` pushed the tab
// unconditionally, under a comment that read:
//
//     Specimens    anyone who can reach this screen. There is nothing in a
//                  specimen to protect — that is the point of a specimen.
//
// That reasoning was half right and drew the wrong conclusion from it. A
// specimen protects no graduate: it carries SPECIMEN across the face, an
// invented holder and a credential number reading NOT AN ISSUED CREDENTIAL, so
// nobody can pass one off as a conferred degree. What it still carries is the
// LAYOUT, THE SECURITY FEATURES AND THE WORDING of the University's
// certificate — which is the whole of what the ruling withdraws.
//
// ---------------------------------------------------------------------------
// SO THE RULE IS CHECKED IN THREE PLACES, BECAUSE IT IS ENFORCED IN THREE
// ---------------------------------------------------------------------------
//
//   the matrix     only two roles hold `view-certificate-template`
//   the screens    the tab is not drawn, and the gallery refuses inside
//   the database   101's policy, so an API call returns no design at all
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
const out = join(dir, 'roles-certificate.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'roles.ts'),
  '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error',
  `--alias:@=${join(root, 'src')}`,
]);
const { can } = await import(out);

/** Every role the portal knows, listed so that adding one fails this loudly. */
const ROLES = [
  'superadmin', 'admin', 'chancellor', 'vice-chancellor', 'registrar',
  'finance-director', 'dean', 'hod', 'programme-coordinator', 'lecturer',
  'finance', 'admissions-officer', 'library-staff', 'student-affairs',
  'hr-officer', 'hr-administrator', 'national-rector',
  'national-financial-secretary', 'student', 'applicant', 'academic-office',
  'exam-officer', 'examiner', 'invigilator', 'moderator',
];

const holders = (capability) => ROLES.filter((r) => can(r, capability));

const decomment = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1 ');

const source = (rel) => decomment(readFileSync(join(root, rel), 'utf8'));

console.log('\nThe certificate sample is a restricted institutional asset\n');

// ---------------------------------------------------------------------------
// 1. THE MATRIX
// ---------------------------------------------------------------------------

check('exactly two roles may see the certificate template',
  holders('view-certificate-template'),
  ['superadmin', 'vice-chancellor']);

check('…and exactly two may authorise a replacement certificate',
  holders('authorise-certificate-reissue'),
  ['superadmin', 'vice-chancellor']);

// NAMED ONE BY ONE, because "the list is these two" and "the Registrar is not
// on it" fail differently, and the second is the sentence the University wrote.
for (const role of ['registrar', 'academic-office', 'national-rector',
  'national-financial-secretary', 'lecturer', 'student', 'admin', 'chancellor',
  'hr-officer', 'dean']) {
  check(`…and ${role} may not`, can(role, 'view-certificate-template'), false);
}

// ---------------------------------------------------------------------------
// 2. AND HOLDING ONE AUTHORITY DOES NOT CONFER ANOTHER
//
// The University's own §8: "Transcript authority does not grant
// certificate-template authority. The Registrar may legitimately generate an
// official transcript but still cannot see the certificate sample."
// ---------------------------------------------------------------------------

check('the Registrar issues credentials…', can('registrar', 'issue-credential'), true);
check('…and still may not see the certificate sample',
  can('registrar', 'view-certificate-template'), false);

check('the Academic Office issues credentials…',
  can('academic-office', 'issue-credential'), true);
check('…and still may not see the certificate sample',
  can('academic-office', 'view-certificate-template'), false);

// LOOKING IS NOT REDRAWING, EITHER. The Vice-Chancellor must see the design to
// approve it; redesigning it stays the Superadministrator's alone.
check('the Vice-Chancellor sees the design…',
  can('vice-chancellor', 'view-certificate-template'), true);
check('…and cannot redraw it', can('vice-chancellor', 'design-credentials'), false);

// ---------------------------------------------------------------------------
// 3. THE SCREENS
// ---------------------------------------------------------------------------

const workspace = source('src/components/credentials/CredentialsWorkspace.tsx');
const gallery = source('src/components/studio/SpecimenGallery.tsx');

check('the workspace gates the specimen tab on the capability',
  /maySeeTheDesign[\s\S]{0,400}?id: 'specimens'/.test(workspace), true);

check('…and does not fall back to the specimen book for a role with no areas',
  /\?\?\s*'specimens'/.test(workspace), false);

check('…and the gallery refuses from the inside as well',
  /can\(\s*user\?\.role\s*,\s*'view-certificate-template'\s*\)/.test(gallery), true);

// ---------------------------------------------------------------------------
// 4. THE DATABASE, WHICH IS WHERE "NOT SUFFICIENT" WAS AIMED
// ---------------------------------------------------------------------------

const migration = readFileSync(
  join(root, 'docs/migrations/101_the_certificate_design_is_not_everybodys.sql'), 'utf8',
);

check('101 restricts the certificate design in a policy',
  /create policy credential_templates_read[\s\S]*?sees_the_certificate_design\(\)/.test(migration),
  true);

// PER KIND. Written against the whole table, the certificate rule would have
// taken the transcript sheet with it — and the Registrar's transcript screen
// renders that one in the browser.
check('…per kind, so the transcript design is not taken with it',
  /when kind = 'certificate' then sees_the_certificate_design\(\)/.test(migration), true);

check('…and the two authorities are separate functions',
  /the_vice_chancellor_or_the_superadministrator\(new\.authorised_by\)/.test(migration), true);

// ---------------------------------------------------------------------------
// 5. AND THE SPECIMEN STILL CARRIES NO REAL GRADUATE
//
// A standing rule of this codebase, unchanged by the ruling and worth keeping
// beside it: restricting who may see a specimen is not a reason to relax what
// a specimen may contain.
// ---------------------------------------------------------------------------

const specimens = readFileSync(join(root, 'src/lib/specimens.ts'), 'utf8');
check('a specimen is still marked as not an issued credential',
  /NOT AN ISSUED CREDENTIAL/.test(specimens), true);

console.log(failures
  ? `\n${failures} check(s) failed.\n`
  : '\nThe certificate design is the Vice-Chancellor’s and the Superadministrator’s.\n');
process.exit(failures ? 1 : 0);
