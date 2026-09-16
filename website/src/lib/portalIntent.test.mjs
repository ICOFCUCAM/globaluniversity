// ---------------------------------------------------------------------------
// FIVE PORTALS, ONE SIGN-IN, AND EVERYBODY LANDS SOMEWHERE THAT IS THEIRS.
//
// Run with:  node src/lib/portalIntent.test.mjs
//
// ---------------------------------------------------------------------------
// WHAT THIS EXISTS FOR
// ---------------------------------------------------------------------------
//
// The University looked at the public site and said: "it seams all those
// windows open to one area."
//
// They were right. Four of the five Portals entries pointed at `/portal`,
// identically, and the portal always opened on the dashboard — so the menu
// promised five destinations, delivered two, and discarded the one thing the
// visitor had just told it.
//
// The fix is NOT five sign-ins. A link cannot know who you are, so a separate
// "Administration" sign-in would refuse people only after they had typed a
// password, and five sign-ins are five things that must agree about sessions
// and lockouts. The fix is one door and many destinations: the link states an
// intent, and identity decides whether it can be honoured.
//
// This file holds three things:
//
//   1. Every menu entry leads somewhere that exists.
//   2. An intent never reaches a screen the role is not already served.
//   3. Somebody whose intent cannot be met is told, rather than dropped.
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
const src = join(root, 'src');

const cache = join(root, 'node_modules', '.cache', 'iguc-tests');
mkdirSync(cache, { recursive: true });
const out = join(cache, 'portal-intent.mjs');
execFileSync('npx', [
  'esbuild', join(src, 'lib', 'portalIntent.ts'),
  '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error',
  `--alias:@=${src}`, '--jsx=automatic', '--external:react', '--external:react/jsx-runtime',
  '--external:lucide-react',
]);
const { PORTAL_INTENTS, resolveIntent, intentFromSearch } = await import(out);

const stripTs = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1 ');

const siteTs = stripTs(readFileSync(join(src, 'content', 'site.ts'), 'utf8'));
const typesTs = stripTs(readFileSync(join(src, 'lib', 'types.ts'), 'utf8'));
const VIEWS = (/export type ViewType\s*=([\s\S]*?);/.exec(typesTs)[1]
  .match(/'[a-z-]+'/g) ?? []).map((s) => s.slice(1, -1));

const ROLES = (/export type UserRole\s*=([\s\S]*?);/.exec(typesTs)[1]
  .match(/'[a-z-]+'/g) ?? []).map((s) => s.slice(1, -1));

/** The Portals menu, as the public site actually declares it. */
const portals = [...(/portals:\s*\[([\s\S]*?)\]/.exec(siteTs)[1])
  .matchAll(/\{\s*label:\s*'([^']+)',\s*href:\s*'([^']+)'\s*\}/g)]
  .map((m) => ({ label: m[1], href: m[2] }));

console.log('\nFive portals, one sign-in\n');

// ---------------------------------------------------------------------------
// 1. THE MENU LEADS SOMEWHERE
// ---------------------------------------------------------------------------

check('the public site offers the five portals', portals.length, 5);

// THE ORIGINAL FAULT, NAMED. Four entries with the same href is a menu that
// looks like wayfinding and is not.
const portalHrefs = portals.map((p) => p.href);
const duplicated = portalHrefs.filter((h, i) => portalHrefs.indexOf(h) !== i);
check('…and no two of them lead to the same address', duplicated, []);

const intents = portals
  .map((p) => /[?&]to=([a-z-]+)/.exec(p.href)?.[1])
  .filter(Boolean);
check('…four of them carry an intent', intents.length, 4);

const unknown = intents.filter((i) => !PORTAL_INTENTS[i]);
check('…and every intent is one the portal knows', unknown, []);

// The application is the exception and must stay one: an applicant is not a
// portal user, and sending them to the staff-and-student sign-in would refuse
// them after they had typed a password.
check('…and the application does not go through the portal sign-in',
  portals.find((p) => /Application/i.test(p.label))?.href, '/apply');

// ---------------------------------------------------------------------------
// 2. EVERY CANDIDATE IS A REAL SCREEN
// ---------------------------------------------------------------------------

const badCandidates = [];
for (const [name, intent] of Object.entries(PORTAL_INTENTS)) {
  for (const c of intent.candidates) if (!VIEWS.includes(c)) badCandidates.push(`${name} → ${c}`);
}
check('every destination an intent offers is a view that exists', badCandidates, []);

// AND EACH INTENT REACHES SOMEBODY. An intent no role can satisfy is a menu
// entry that always lands on a dashboard with an apology.
const unreachable = Object.keys(PORTAL_INTENTS)
  .filter((i) => !ROLES.some((r) => resolveIntent(i, r).honoured
    && resolveIntent(i, r).view !== 'dashboard'));
check('…and every intent is reachable by at least one role', unreachable, []);

// ---------------------------------------------------------------------------
// 3. AN INTENT IS A REQUEST, NEVER AN AUTHORISATION
//
// THE CHECK THAT MATTERS. If a link could land somebody on a screen their role
// is not served, the Portals menu would be a way round the navigation — and
// through it, round the capability matrix.
// ---------------------------------------------------------------------------

const student = resolveIntent('transcripts', 'student');
check('a student following Transcripts gets their own record',
  student.view, 'my-transcript');

const registrar = resolveIntent('transcripts', 'registrar');
check('…and a Registrar following the same link gets the issuing desk',
  registrar.view, 'transcript');

// THE BREAK. A student must not reach the desk that ISSUES transcripts, and
// the ordering of the candidate list is what stops it.
check('…and the student is not taken to the issuing desk',
  student.view === 'transcript', false);

const studentAdmin = resolveIntent('administration', 'student');
check('a student following Administration is not given an administration screen',
  studentAdmin.view, 'dashboard');
check('…and is told why rather than dropped',
  typeof studentAdmin.note === 'string' && studentAdmin.note.length > 40, true);

const lecturer = resolveIntent('lms', 'lecturer');
check('a lecturer following E-Learning reaches teaching, not a dashboard',
  lecturer.view !== 'dashboard', true);

// ---------------------------------------------------------------------------
// 4. AND NOTHING SURPRISING ON THE WAY IN
// ---------------------------------------------------------------------------

check('no intent at all lands on the dashboard, quietly',
  resolveIntent(null, 'registrar'), { view: 'dashboard', honoured: true, note: null });

check('…and an invented one does the same rather than failing',
  resolveIntent('nonsense', 'registrar').view, 'dashboard');

check('a query string is read', intentFromSearch('?to=lms'), 'lms');
check('…an unknown one is ignored', intentFromSearch('?to=whatever'), null);
check('…and rubbish does not stop the portal opening', intentFromSearch('%%%'), null);

console.log(failures
  ? `\n${failures} check(s) failed.\n`
  : '\nEvery portal leads somewhere, and identity decides where.\n');
process.exit(failures ? 1 : 0);
