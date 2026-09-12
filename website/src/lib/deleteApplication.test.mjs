// ---------------------------------------------------------------------------
// WHO MAY DELETE AN APPLICATION.
//
// Run with:  node src/lib/deleteApplication.test.mjs
//
// ---------------------------------------------------------------------------
// WHY A TEST FOR A ONE-LINE RULE
// ---------------------------------------------------------------------------
//
// "Only the Superadministrator may delete an application" is a sentence the
// University said once. It is enforced in three places — the capability matrix,
// the route, and migration 018 — and each of them can be widened by somebody
// solving an unrelated problem in a hurry.
//
// The realistic way this breaks is not malice. It is an Admissions Officer
// asking to tidy their queue, and 'delete-application' being added to their
// list because it is one line and the request is reasonable. This test is what
// makes that one line fail the build, so the widening has to be a decision
// rather than a convenience.
//
// It checks the MATRIX, not the UI. A hidden button is courtesy; the capability
// is what the route enforces.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
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
const out = join(dir, 'roles-delete.mjs');
execFileSync('npx', [
  'esbuild', new URL('./roles.ts', import.meta.url).pathname,
  '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error',
  `--alias:@=${new URL('..', import.meta.url).pathname.replace(/\/$/, '')}`,
]);
const { can, SYSTEM_CAPABILITIES } = await import(out);

// Every role the portal knows. Listed here rather than imported so that adding
// a role does not silently escape the sweep below — a new role with the
// capability would otherwise pass unnoticed.
const ROLES = [
  'superadmin', 'admin', 'chancellor', 'vice-chancellor', 'registrar',
  'finance-director', 'finance', 'admissions-officer', 'dean', 'hod',
  'programme-coordinator', 'academic-office', 'lecturer', 'library-staff',
  'student-affairs', 'student',
  'exam-officer', 'examiner', 'invigilator', 'moderator',
];

console.log('\nOnly the Superadministrator may delete an application\n');

check('the Superadministrator may', can('superadmin', 'delete-application'), true);

// THE ONE THAT MATTERS. 'admin' used to be a wildcard, and the whole role
// hierarchy exists because while it was, nothing could be reserved from an
// administrator.
check('an ordinary Administrator may NOT', can('admin', 'delete-application'), false);

// The offices that handle applications every day, and therefore the ones most
// likely to be granted this by request.
check('the Admissions Officer may NOT', can('admissions-officer', 'delete-application'), false);
check('the Registrar may NOT', can('registrar', 'delete-application'), false);
check('Finance may NOT', can('finance', 'delete-application'), false);
check('the Vice-Chancellor may NOT', can('vice-chancellor', 'delete-application'), false);

const holders = ROLES.filter((r) => can(r, 'delete-application'));
check('exactly one role holds it, and it is the Superadministrator', holders, ['superadmin']);

// An unauthenticated or unknown caller. `can` is given undefined whenever the
// session has not resolved, which on a destructive control must fail closed.
check('nobody signed in may', can(undefined, 'delete-application'), false);
check('null may not either', can(null, 'delete-application'), false);
check('an unrecognised role may not', can('vice-provost', 'delete-application'), false);

// --- It is filed as systemic, not operational. ------------------------------
//
// Placement is not cosmetic: SYSTEM_CAPABILITIES is the list `admin` does not
// receive. A capability moved out of it is a capability the Administrator gets.

console.log('\nIt is filed with the systemic powers, which is what keeps it from admin\n');

check(
  'delete-application is a system capability',
  SYSTEM_CAPABILITIES.includes('delete-application'),
  true,
);

// --- The route and the migration agree with the matrix. ---------------------
//
// Read as text. The point is not to re-test the matrix but to catch the three
// enforcement points drifting apart — the failure mode where the capability is
// right and the route guards the wrong one, which no unit test of `can` sees.

console.log('\nThe route and the migration enforce the same rule\n');

const route = readFileSync(
  new URL('../app/api/admissions/delete/route.ts', import.meta.url).pathname, 'utf8',
);

check("the route guards on 'delete-application'", route.includes("guard(request, 'delete-application')"), true);
check('the route takes the caller from the token, not the body', route.includes('body.role'), false);
// The audit entry must be written BEFORE the delete. If a failure can leave the
// row gone and nothing recorded, the trail cannot be relied on for the one
// action it exists to cover.
check(
  'the audit entry is written before the delete',
  route.indexOf('audit(admin') < route.indexOf(".from('students').delete()"),
  true,
);
check('and a failed audit write aborts the deletion', route.includes('not-deleted-because-not-recorded'), true);
check('an admitted student is refused', route.includes('already-admitted'), true);
check('a reason is required', route.includes('reason-required'), true);

const migration = readFileSync(
  new URL('../../docs/migrations/018_delete_application.sql', import.meta.url).pathname, 'utf8',
);

check('the migration creates a delete policy', migration.includes('for delete using'), true);
check('naming superadmin', migration.includes("auth_role() = 'superadmin'"), true);
check(
  'and no other role appears in the policy',
  /for delete using \(auth_role\(\) = 'superadmin'\)/.test(migration),
  true,
);
// The service-role key bypasses RLS, so the policy alone would be a rule that
// holds for the browser and not for the server.
check('a trigger backs the policy for service-role callers', migration.includes('before delete on students'), true);
check('and it refuses an admitted student', migration.includes('auth_user_id is not null or old.student_number is not null'), true);

// --- The panel itself, rendered. --------------------------------------------
//
// It lives in its own component precisely so this is possible: inline in
// AdmissionsDesk it could only be seen with an application selected, and on a
// database with an empty queue there is nothing to select — so the one control
// that destroys a record was the one nobody could look at before shipping.

console.log('\nThe panel, rendered\n');

const panelBundle = join(dir, 'delete-panel.mjs');
execFileSync('npx', [
  'esbuild', new URL('../components/admissions/DeleteApplicationPanel.tsx', import.meta.url).pathname,
  '--bundle', '--format=esm', '--platform=node', `--outfile=${panelBundle}`, '--log-level=error',
  '--jsx=automatic',
  // lucide-react resolves to CommonJS by default, and a CJS `require('react')`
  // inside an ESM bundle throws at import time. Preferring the module field
  // picks its ESM build instead.
  '--main-fields=module,main',
  `--alias:@=${new URL('..', import.meta.url).pathname.replace(/\/$/, '')}`,
  '--external:react', '--external:react-dom',
]);
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const { default: Panel } = await import(panelBundle);

const noop = () => {};
const draw = (props) => renderToStaticMarkup(React.createElement(Panel, {
  allowed: true,
  matricNo: 'ICOF/2026/0451',
  reason: '',
  onReasonChange: noop,
  confirmation: '',
  onConfirmationChange: noop,
  onDelete: noop,
  ...props,
}));

// NOTHING AT ALL for a role without the capability — not a disabled button,
// not an explanation. The markup carries no trace of the control.
check('a role without the capability sees nothing', draw({ allowed: false }), '');

const empty = draw({});
check('the Superadministrator sees the panel', empty.includes('Delete this application'), true);
check('it names the applicant’s own reference', empty.includes('ICOF/2026/0451'), true);
check('it points at Reject as the ordinary route', empty.includes('use Reject'), true);

// The button must be unusable until BOTH fields are satisfied. A confirmation
// that can be skipped is decoration.
// MATCHES THE ATTRIBUTE, NOT THE CLASS NAME. The first version of this read
// /<button[^>]*disabled/ and matched the Tailwind class `disabled:opacity-40`,
// so it reported every render as disabled — including the one that is not, and
// every assertion below would have passed no matter what the component did.
const disabled = (html) => /<button[^>]*\sdisabled=""/.test(html);
check('disabled with neither field given', disabled(empty), true);
check(
  'still disabled with a reason but no confirmation',
  disabled(draw({ reason: 'Duplicate submission by the same applicant' })),
  true,
);
check(
  'still disabled with the confirmation but no reason',
  disabled(draw({ confirmation: 'ICOF/2026/0451' })),
  true,
);
check(
  'still disabled when the confirmation is the wrong reference',
  disabled(draw({ reason: 'Duplicate submission by the same applicant', confirmation: 'ICOF/2026/0452' })),
  true,
);
check(
  'still disabled when the reason is too short to be one',
  disabled(draw({ reason: 'dupe', confirmation: 'ICOF/2026/0451' })),
  true,
);
check(
  'enabled only when both are right',
  disabled(draw({ reason: 'Duplicate submission by the same applicant', confirmation: 'ICOF/2026/0451' })),
  false,
);
// And not while a request is already in flight, or a double click deletes twice.
check(
  'and never while a deletion is already running',
  disabled(draw({ reason: 'Duplicate submission by the same applicant', confirmation: 'ICOF/2026/0451', busy: true })),
  true,
);

check(
  'it says which field is still missing',
  draw({ confirmation: 'ICOF/2026/0451' }).includes('at least a dozen characters'),
  true,
);

console.log(
  failures === 0
    ? '\nOne role holds it, all three enforcement points agree, and the panel refuses until both fields are right.\n'
    : `\n${failures} failed\n`,
);
process.exit(failures === 0 ? 0 : 1);
