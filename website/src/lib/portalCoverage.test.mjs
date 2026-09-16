// ---------------------------------------------------------------------------
// IS EVERY DOOR BUILT, AND CAN EVERY OFFICE REACH THEIRS?
//
//   node src/lib/portalCoverage.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
//
// `reachability.test.mjs` asks whether the CODE is connected to itself: does
// every guarded route have a caller, does every table something reads have
// something that writes it. It passed while an invigilator could sign in and
// see one menu item.
//
// This asks the other question — whether the PEOPLE are connected to the code:
//
//   Can every office reach a dashboard and the screen that changes their own
//   password? Is every screen this portal can draw reachable from a menu? And
//   is every capability the University grants actually checked by something?
//
// ---------------------------------------------------------------------------
// THE FAULT IT WAS WRITTEN AFTER
// ---------------------------------------------------------------------------
//
// `portalNav.tsx` carries a paragraph about a constant that once held four
// roles, leaving eleven offices with "a page rather than a portal". That
// paragraph was written, the list was extended to sixteen — and six roles were
// still missing from it. The two HR offices and all four examination offices.
//
// AN INVIGILATOR SAW ONE MENU ITEM. No Dashboard, no Settings, on a system
// that emails them a temporary password and tells them to change it.
//
// It survived being written about directly above itself, because reading a
// list of sixteen names and noticing which seven are absent is not something
// anybody does reliably. Counting is. So this counts.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n`
      + `      actual   ${JSON.stringify(actual)}`);
  } else {
    console.log(`ok    ${label}`);
  }
}

const here = new URL('.', import.meta.url).pathname;
const root = join(here, '../..');
const src = join(root, 'src');
const cache = join(root, 'node_modules/.cache/icof');
mkdirSync(cache, { recursive: true });

const read = (p) => readFileSync(p, 'utf8');

// The nav is JSX, so it is bundled rather than parsed. Regex over this file
// once counted the word 'applicant' out of a COMMENT and reported that an
// applicant had four menu entries — the measuring instrument lying about the
// thing being measured.
const navOut = join(cache, 'portalNav.mjs');
execFileSync('npx', [
  'esbuild', join(src, 'lib/portalNav.tsx'), '--bundle', '--format=esm', '--platform=node',
  `--outfile=${navOut}`, '--log-level=error', `--alias:@=${src}`,
  '--jsx=automatic', '--external:react', '--external:react/jsx-runtime',
  '--external:lucide-react',
]);
const NAV = await import(navOut);

const types = read(join(src, 'lib/types.ts'));

/** Every role the University has, from the closed union that declares them. */
const ROLES = (() => {
  const block = types.slice(
    types.indexOf('export type UserRole'),
    types.indexOf('export interface Department'),
  );
  return [...block.matchAll(/^\s*\|\s*'([a-z-]+)'/gm)].map((m) => m[1]);
})();

/**
 * Every screen the portal can draw.
 *
 * COMMENTS ARE STRIPPED FIRST, and that line is the whole reason this function
 * has a comment of its own.
 *
 * The first version read every quoted string after `export type ViewType`.
 * This file's header is about a measuring instrument that counted the word
 * 'applicant' out of a COMMENT in portalNav.tsx — and then this function did
 * exactly the same thing to itself: a comment added beside a new view id
 * mentioned `'submitted'`, and the test reported a screen called "submitted"
 * as unrouted and unreachable.
 *
 * Stripping the comments is not a workaround for one word. The union is
 * written both one-per-line and several-to-a-line, so the ids cannot be taken
 * from line starts either; what is left after the prose is the vocabulary.
 */
const VIEWS = (() => {
  const block = types.slice(types.indexOf('export type ViewType'))
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  return [...block.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
})();

// ===========================================================================
// 1. EVERY OFFICE HAS A PORTAL, NOT A PAGE
// ===========================================================================
//
// Two entries decide it, and neither is negotiable:
//
//   dashboard  somewhere to land. Without it the first screen after signing
//              in is whatever happens to be first in the menu.
//   settings   the screen that changes their own password. The University
//              emails a temporary one and tells them to change it
//              immediately, so an office that cannot reach Settings has been
//              given an instruction it cannot follow.

console.log('\nEvery office can reach a dashboard and their own password\n');

/**
 * The one role deliberately outside the portal.
 *
 * AppLayout turns an applicant away and sends them to the Admissions Portal,
 * so a menu would be a door into a building they are told not to enter. Listed
 * here rather than special-cased below, so that removing that redirect without
 * giving them a menu fails this test.
 */
const NOT_IN_THIS_PORTAL = ['applicant'];

for (const role of ROLES) {
  const ids = NAV.navItemsFor(role).map((i) => i.id);
  if (NOT_IN_THIS_PORTAL.includes(role)) {
    check(`${role} is deliberately outside this portal`, ids, []);
    continue;
  }
  check(`${role} can reach a dashboard`, ids.includes('dashboard'), true);
  check(`${role} can reach the screen that changes their password`,
    ids.includes('settings'), true);
}

// AND NOBODY IS LEFT WITH A PAGE. Four entries — dashboard, announcements,
// forum, settings — is what EVERYONE alone gives you: a role at exactly four
// holds capabilities that no screen serves.
console.log('\nAnd an office with work to do has somewhere to do it\n');

const THIN = ROLES
  .filter((r) => !NOT_IN_THIS_PORTAL.includes(r))
  .filter((r) => NAV.navItemsFor(r).length <= 4);

/**
 * Offices that hold a capability and have no screen for it.
 *
 * NAMED RATHER THAN TOLERATED. Each of these is a power the University has
 * granted with no door built — the fault `portalNav.tsx` already records
 * against the Academic Affairs desk, still open for these two. Printed on
 * every run so it cannot become a thing nobody is reminded of.
 */
const NO_SCREEN_YET = {
  // ---------------------------------------------------------------------
  // THE LIBRARY, AND WHY IT IS NOT A MISSING SCREEN.
  //
  // The obvious reading of an office with a capability and no module is that
  // somebody forgot to build one. Here it is a decision.
  //
  // A library runs on a library system: catalogue, holdings, circulation,
  // reservations, fines, interlibrary loan, and a bibliographic standard a
  // student record system has no business reimplementing. Universities run
  // those as their own systems and connect them; they do not build them
  // inside the registry. A half-built catalogue here would become the place
  // nobody's holdings actually are.
  //
  // What a library needs FROM this system is one thing — is this person a
  // current student — and `view-registered-students` is that. This office now
  // holds it.
  //
  // STUDENT AFFAIRS WAS ON THIS LIST AND IS NOT ANY MORE. They held
  // `manage-hostel` and `manage-student-welfare` and had nothing to open. The
  // answer was not a hostel module: it was the request queue 073 had already
  // built with nobody to work it. Answering students IS their work.
  // ---------------------------------------------------------------------
  'library-staff': 'Holds `manage-library`, and deliberately has no library module: a catalogue, '
    + 'circulation and holdings belong in a library system, not in a student record system. What '
    + 'the library needs from here \u2014 whether somebody is a current student \u2014 it now '
    + 'has through `view-registered-students`.',
};

const unexplainedThin = THIN.filter((r) => !NO_SCREEN_YET[r]);
check('every office with a capability has a screen for it — or the gap is named',
  unexplainedThin, []);
for (const r of THIN.filter((x) => NO_SCREEN_YET[x])) {
  console.log(`      no screen yet: ${r} — ${NO_SCREEN_YET[r]}`);
}

// ===========================================================================
// 2. EVERY SCREEN IS ROUTED, AND REACHABLE
// ===========================================================================

console.log('\nEvery screen the portal can name, it can also draw\n');

const app = read(join(src, 'components/AppLayout.tsx'));
const routed = new Set([...app.matchAll(/case '([a-z0-9-]+)':/g)].map((m) => m[1]));

// ---------------------------------------------------------------------------
// UNLESS IT IS A REAL URL.
//
// Every entry in the portal selects a module inside AppLayout's switch, with
// one exception: the Academic Studio is a tree of server-rendered routes with
// its own layout and its own session, so the sidebar NAVIGATES to it. There is
// no case to write and there should not be one.
//
// The exemption is READ OUT OF portalNav rather than listed here, so it covers
// exactly the entries that actually carry an `href` — and the day somebody
// gives an entry an href and no destination, or takes the href away and
// forgets the case, this still fails.
// ---------------------------------------------------------------------------
const nav = read(join(src, 'lib/portalNav.tsx'));
const navigatesAway = new Set(
  [...nav.matchAll(/id:\s*'([a-z0-9-]+)',?[\s\S]{0,200}?href:\s*'([^']+)'/g)].map((m) => m[1]),
);
check('an entry that navigates away has somewhere to navigate to',
  [...navigatesAway].filter((id) => {
    const m = new RegExp(`id:\\s*'${id}'[\\s\\S]{0,200}?href:\\s*'([^']+)'`).exec(nav);
    return !m || !m[1].startsWith('/');
  }), []);

const notRouted = VIEWS.filter((v) => !routed.has(v) && !navigatesAway.has(v));
check('every ViewType has a case in AppLayout, or an href instead', notRouted, []);

/**
 * Screens with no menu entry of their own, and why.
 *
 * A view id that nothing offers is not automatically wrong — three of these
 * are second names for a screen reached under one entry — but it is always
 * worth a sentence, because the other way it happens is somebody adding a
 * screen and forgetting the door.
 */
const NO_MENU_BY_DESIGN = {
  studio: 'One of three ids over the Credentials workspace. Only `credentials` is in the menu; '
    + 'three entries over one subject was worse than one. Links and dashboard actions still '
    + 'name this id.',
  'credential-authority': 'The same workspace under a third name, kept because existing links '
    + 'point at it.',
  // ---------------------------------------------------------------------
  // TWO THAT LOST THEIR MENU ENTRY WHEN THE STUDENT WEB WAS REBUILT.
  //
  // Both were STUDENT entries. A student now reads their own record on
  // 'my-transcript' and their credentials on 'my-credentials', because these
  // two open the screens that ISSUE a transcript and a certificate — the
  // Registry's act, and not something to hand a graduate.
  //
  // They are still routed, and staff still reach both from the administrator's
  // dashboard and from Credentials, which is where issuing was consolidated.
  // Worth a sentence rather than a deletion: the ids are named by dashboard
  // actions that would otherwise fall through to nothing.
  // ---------------------------------------------------------------------
  transcript: 'The screen that ISSUES a transcript. Reached from the administrator’s dashboard '
    + 'and from Credentials → Issue; no menu entry since students moved to `my-transcript`.',
  certificate: 'The screen that ISSUES a certificate, on the same footing.',
};

const navIds = new Set();
for (const role of ROLES) for (const i of NAV.navItemsFor(role)) navIds.add(i.id);
const noMenu = VIEWS.filter((v) => !navIds.has(v)).filter((v) => !NO_MENU_BY_DESIGN[v]);
check('every screen is reachable from some menu — or the absence is explained', noMenu, []);

// ===========================================================================
// 3. EVERY CAPABILITY IS CHECKED BY SOMETHING
// ===========================================================================
//
// THE FAULT THIS CATCHES is stated twice already in this codebase, in those
// words: "the capability was granted and the door was not built". A role
// holding a power nothing enforces is a promise the system does not keep —
// and, worse, it reads in `roles.ts` exactly like the powers that ARE real.

console.log('\nEvery capability the University grants, something checks\n');

const roles = read(join(src, 'lib/roles.ts'));
const capsIn = (name) => {
  const i = roles.indexOf(`export const ${name}`);
  const j = roles.indexOf('] as const;', i);
  return [...roles.slice(i, j).matchAll(/^\s*'([a-z0-9-]+)',/gm)].map((m) => m[1]);
};
const CAPABILITIES = [...capsIn('OPERATIONAL_CAPABILITIES'), ...capsIn('SYSTEM_CAPABILITIES')];

// Named anywhere outside roles.ts: at a guard, in a can(), or as a field on a
// workflow stage — the examination and results chains hold theirs as DATA, so
// looking only at call sites reports working code as dead.
const everythingElse = (() => {
  let text = '';
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      // ---- THE ACADEMIC STUDIO HAS ITS OWN CAPABILITY VOCABULARY --------
      //
      // `src/academic/lib/capabilities.ts` lists six roles and their acts
      // inside a lecture's material. It is a DIFFERENT SYSTEM from
      // `src/lib/roles.ts`, which lists the University's twenty-three roles —
      // and some words appear in both.
      //
      // `assign-lecturers` is one. This scan read the Studio's file, found the
      // string, and reported the University's capability as enforced when
      // nothing in the portal enforces it. A false "this is covered" is worse
      // than a gap on this particular report, because the whole point of it is
      // to name capabilities nobody checks.
      //
      // The two vocabularies are kept apart rather than merged: the Studio's
      // are about one lecture, the University's about the institution, and
      // flattening them would make every Studio act grantable from the
      // portal's role editor.
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name)
        && !p.endsWith('lib/roles.ts')
        // THE STUDIO'S OWN VOCABULARY FILE, AND ONLY THAT FILE.
        //
        // The first attempt at this excluded the whole of src/academic, which
        // stopped the false positive and created a worse one in the other
        // direction: the Studio's ROUTES enforce the University's `studio-*`
        // capabilities for real, and excluding the tree reported six of them
        // as checked nowhere while they were being checked on every request.
        //
        // One file is the problem — the one that happens to use some of the
        // same words for a different vocabulary — so one file is excluded.
        && !p.endsWith('academic/lib/capabilities.ts')) text += read(p);
    }
  };
  walk(src);
  return text;
})();

/**
 * Capabilities that are vocabulary rather than enforcement, and why.
 *
 * TWO KINDS, and they are different. Some describe what a person may do and
 * are enforced somewhere else entirely — a student's right to see their own
 * results is enforced by a view filtering on auth.uid(), not by a capability
 * check. Others name a power with nothing behind it at all, and those are the
 * ones worth reading this list for.
 */
const NOT_ENFORCED = {
  // ---- enforced elsewhere, by the database rather than by a check --------
  apply: 'The Admissions Portal is a separate surface; applying is governed there.',
  'upload-documents': 'Enforced by row-level security on `documents`, not by a capability.',
  'pay-fees': 'The University records payments; a student does not write one.',
  'view-results': 'Enforced by `my_results`, which filters on auth.uid() in the database.',
  'download-transcript': 'Enforced by `claim_transcript_download`, which checks ownership and '
    + 'the remaining allowance itself.',
  'view-all-faculties': 'Descriptive. What an office SEES is decided by the menu and by the '
    + 'row-level policies, not by a check on this name.',
  'view-institutional-finance': 'Descriptive, as above.',
  'monitor-teaching': 'Descriptive, as above.',

  // ---- granted, with nothing behind it ----------------------------------
  'approve-refund': 'NO DOOR. The Finance Director may approve a refund and there is no refund '
    + 'anywhere in this system — no request, no screen, no table.',
  'assign-programme': 'NO DOOR. Attaching a student to a curriculum is done by the Registry in '
    + 'the Enrolment screen without checking this, and there is no screen that does.',
  'assign-lecturers': 'NO DOOR. Course allocation happens on the Offerings screen, which guards '
    + 'on `manage-course-offerings` instead. This name and that one are the same act.',
  'assign-lecturers-to-courses': 'NO DOOR, and a duplicate of the line above. Two capability '
    + 'names for one act is how a grant comes to mean nothing.',
  'approve-course-allocation': 'NO DOOR. Nothing approves an allocation; the Offerings screen '
    + 'assigns a lecturer and that is the end of it.',
  'approve-transfers': 'NO DOOR. `transfer_credits` exists as a table and no screen reads or '
    + 'writes it.',
  'assign-proctor': 'NO DOOR. `examination_officers` exists and nothing reads it.',
  'manage-hostel': 'Named, not enforced, and deliberately so: hostel allocation is not work this '
    + 'system does. Student Affairs\u2019 actual work here is the request queue.',
  'manage-student-welfare': 'The same. A welfare case system is its own thing; what reaches this '
    + 'system is a student ASKING for something, and that is `handle-student-request`.',
  'message-lecturers': 'NO DOOR. There is no messaging in this system; the forum is the only '
    + 'place anybody writes to anybody.',
  'reinstate-account': 'NO DOOR. Accounts can be suspended and nothing lifts one.',
  'reset-user-password': 'NO DOOR. A user changes their own; nobody resets another’s.',
  'impersonate-user': 'NO DOOR, and the only one on this list that is better left that way '
    + 'until somebody asks for it.',
  'manage-academic-session': 'Superseded. The academic calendar screen guards on '
    + '`manage-academic-calendar`, which is the same power under the name that got built.',
  'maintenance-mode': 'NO DOOR.',
  'export-data': 'NO DOOR. Individual screens export what they show; nothing exports the '
    + 'institution.',
};

const unenforced = CAPABILITIES.filter((c) => !everythingElse.includes(`'${c}'`));
const unexplained = unenforced.filter((c) => !NOT_ENFORCED[c]);
check('every capability is enforced somewhere — or the gap is named', unexplained, []);

// SAID OUT LOUD, EVERY RUN. The list above is only useful while somebody is
// reminded it exists; the count is what makes it uncomfortable.
const noDoor = unenforced.filter((c) => (NOT_ENFORCED[c] ?? '').startsWith('NO DOOR'));
console.log(`      ${unenforced.length} of ${CAPABILITIES.length} capabilities are not checked `
  + `anywhere; ${noDoor.length} of those have no screen at all:`);
for (const c of noDoor) console.log(`        ${c} — ${NOT_ENFORCED[c]}`);

// AND NOTHING IS EXPLAINED THAT NO LONGER NEEDS EXPLAINING. The same rule the
// reachability test applies to its own list: an entry here that has since been
// built must be deleted, or the list becomes a graveyard.
const staleExplanations = Object.keys(NOT_ENFORCED).filter((c) => !unenforced.includes(c));
check('nothing is excused that is now enforced', staleExplanations, []);

console.log(failures === 0
  ? '\nEvery office has a portal, every screen a door, and every ungranted power a reason.'
  : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
