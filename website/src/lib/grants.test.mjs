// ---------------------------------------------------------------------------
// RESOURCE + ACTION + SCOPE, AND THE SIDEBAR THAT READS IT.
//
// Run with:  node src/lib/grants.test.mjs
//
// ---------------------------------------------------------------------------
// WHAT THIS GUARDS
// ---------------------------------------------------------------------------
//
// The University, on the architecture:
//
//   "ROLE → CAPABILITIES → RESOURCE + SCOPE + ACTION → SIDEBAR VISIBILITY →
//    PAGE ACCESS → API AUTHORIZATION. Then the sidebar automatically knows
//    whether something should be displayed."
//
// Before it, the sidebar was gated on ROLE and the routes on CAPABILITY, so the
// two answered different questions and disagreed in both directions — a
// capability held with no door, and a door held with no capability.
//
// AND "OWN" COULD NOT BE SAID AT ALL. `manage-question-bank` cannot mean "their
// own"; `view-registered-students` cannot mean "in their own courses". So the
// choice was the whole University's question bank or none of it.
//
// ---------------------------------------------------------------------------
// THE TRAP THIS FILE EXISTS BECAUSE OF
// ---------------------------------------------------------------------------
//
// The first version matched on RESOURCE ALONE. A lecturer holds
// `courses/view:own-courses`, so an entry naming only `courses` let them
// straight back into the Course catalogue — the one screen the University's
// ruling exists to keep them out of. Resource and action together, or the model
// says nothing.
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

const bundle = (file, opts = []) => {
  const out = join(cache, `${file.replace(/\.tsx?$/, '')}.grants.mjs`);
  execFileSync('npx', [
    'esbuild', join(here, file), '--bundle', '--format=esm', '--platform=node',
    `--outfile=${out}`, '--log-level=error', `--alias:@=${join(here, '..')}`, ...opts,
  ]);
  return out;
};

const G = await import(bundle('grants.ts'));
const N = await import(bundle('portalNav.tsx',
  ['--jsx=automatic', '--define:process.env.NODE_ENV="production"']));

const ids = (role) => N.groupsFor(role).flatMap((g) => g.items.map((i) => i.id));

console.log('\nThe University’s lecturer tree, branch by branch\n');

// ---------------------------------------------------------------------------
// THE TREE AS THE UNIVERSITY DREW IT.
//
//   Lecturer
//     ├── Courses          → view
//     ├── Question Bank    → manage:own-courses
//     ├── Question Papers  → create-draft:own-courses
//     ├── Students         → view:own-courses
//     ├── Early Warning    → manage:own-courses
//     ├── Announcements    → create:own-courses
//     └── Timetable        → view
// ---------------------------------------------------------------------------
const TREE = [
  ['courses', 'view', 'own-courses'],
  ['question-bank', 'manage', 'own-courses'],
  ['question-papers', 'create-draft', 'own-courses'],
  ['students', 'view', 'own-courses'],
  ['early-warning', 'manage', 'own-courses'],
  ['announcements', 'create', 'own-courses'],
  ['timetable', 'view', 'university'],
];

for (const [resource, action, scope] of TREE) {
  check(`lecturer: ${resource} → ${action}:${scope}`,
    G.scopeOf('lecturer', resource, action), scope);
}

// --- AND THE ACTIONS THEY MAY NOT TAKE ------------------------------------
//
// "The lecturer can prepare the paper but cannot unilaterally make it the
// University's official examination paper."
const REFUSED = [
  ['courses', 'manage', 'define the University’s catalogue'],
  ['question-papers', 'approve', 'approve a paper'],
  ['question-papers', 'publish', 'publish an official paper'],
  ['grades', 'approve', 'approve a mark'],
  ['announcements', 'create', 'speak for the University'],
  ['early-warning', 'view', 'read the University-wide risk register'],
  ['timetable', 'manage', 'move a class'],
  ['students', 'manage', 'administer a student record'],
];
for (const [resource, action, what] of REFUSED) {
  const scope = G.scopeOf('lecturer', resource, action);
  // `announcements/create` IS granted — at `own-courses`. What must be refused
  // is the UNIVERSITY scope, which is a different thing from the action being
  // absent, and a check that ignored the difference would pass on nothing.
  if (resource === 'announcements' && action === 'create') {
    check(`lecturer may NOT ${what}`, scope === 'university', false);
  } else if (resource === 'early-warning' && action === 'view') {
    check(`lecturer may NOT ${what}`, scope === 'university', false);
  } else {
    check(`lecturer may NOT ${what}`, scope, null);
  }
}

console.log('\nAnd the sidebar reads the grant rather than a second list\n');

const lecturer = ids('lecturer');

// --- THE TRAP: RESOURCE WITHOUT ACTION ------------------------------------
//
// `courses` and `my-courses` are the SAME resource. Only the action tells them
// apart, and matching on the resource alone put the catalogue back in a
// lecturer's sidebar.
check('the catalogue is not offered to a lecturer', lecturer.includes('courses'), false);
check('…while their own courses are', lecturer.includes('my-courses'), true);

const nav = readFileSync(join(here, 'portalNav.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
check('the filter matches on resource AND action',
  /scopeOf\(role, i\.resource, i\.action\) !== null/.test(nav), true);
check('…and a ruled role does not fall back to the role list',
  /isRuled\(role\) && i\.resource && i\.action/.test(nav), true);

// --- A ROLE NOBODY HAS RULED ON IS UNTOUCHED ------------------------------
//
// The migration is deliberately one office at a time: rewriting 111
// capabilities across 23 roles without a ruling on each would mean inventing
// the University's own arrangements.
check('a lecturer has been ruled on', G.isRuled('lecturer'), true);
for (const role of ['dean', 'registrar', 'finance', 'student']) {
  check(`${role} has not, and still sees a portal`,
    G.isRuled(role) === false && ids(role).length > 3, true);
}

// --- THE VOCABULARY IS CLOSED ---------------------------------------------
//
// A grant naming a resource, action or scope nobody declared would be a rule
// that reads correctly and matches nothing.
for (const role of ['lecturer']) {
  for (const g of G.grantsFor(role)) {
    check(`${role}: '${g.resource}' is a declared resource`,
      G.RESOURCES.includes(g.resource), true);
    check(`${role}: '${g.action}' is a declared action`,
      G.ACTIONS.includes(g.action), true);
    check(`${role}: '${g.scope}' is a declared scope`,
      G.SCOPES.includes(g.scope), true);
  }
}

// --- AND EVERY SCOPE CAN BE SAID ON A PAGE --------------------------------
//
// A screen showing four students has to be able to say they are four of THEIRS
// rather than four in the University.
for (const scope of G.SCOPES) {
  check(`'${scope}' has words a screen can use`,
    typeof G.SCOPE_LABELS[scope] === 'string' && G.SCOPE_LABELS[scope].length > 0, true);
}

console.log(failures ? `\n${failures} check(s) failed.\n` : '\nAll grant checks passed.\n');
process.exit(failures ? 1 : 0);
