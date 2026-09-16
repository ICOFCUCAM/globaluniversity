// ---------------------------------------------------------------------------
// EVERY STUDIO ACT IS ACTUALLY ASKED ABOUT, OR SAYS WHY NOT.
//
// Run with:  node src/academic/lib/studioPermissions.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS WHEN portalCoverage.test.mjs ALREADY CHECKS ENFORCEMENT
// ---------------------------------------------------------------------------
//
// Because it was passing for the wrong reason, and that was worse than
// failing.
//
// That test asks whether a capability's NAME appears anywhere outside
// `roles.ts`. For most of the University's capabilities that is a fair proxy:
// the only reason to write the string is to check it.
//
// The Academic Studio broke the proxy. `STUDIO_ACTS` in studioPermissions.ts
// lists all thirteen as data — it is what a screen walks to draw the padlocks
// the University asked for. So the moment that table existed, every one of the
// thirteen looked enforced, including three that are checked nowhere at all.
//
// A green report about a permission nobody checks is the exact failure the
// other file exists to prevent, arrived at through the other file.
//
// ---------------------------------------------------------------------------
// SO THIS ASKS THE NARROWER QUESTION
// ---------------------------------------------------------------------------
//
// Not "does the string appear" but "is this capability handed to
// `mayRunStudioAct` somewhere under app/api/studio". That is the only thing
// that refuses a request, and it is the thing the University's ruling is
// actually about:
//
//     "Submission does not automatically mean AI processing."
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync, statSync } from 'node:fs';
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

// fileURLToPath, not new URL().pathname — a parent directory with a space in
// it percent-encodes, and this repository has had that fault once already.
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');

const strip = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name === 'route.ts') out.push(full);
  }
  return out;
}

console.log('\nEvery Academic Studio act is asked about on the request\n');

const permissions = strip(readFileSync(join(here, 'studioPermissions.ts'), 'utf8'));

const acts = [...permissions.matchAll(/\{ capability: '([a-z-]+)', label: '([^']+)' \}/g)]
  .map((m) => ({ capability: m[1], label: m[2] }));
check('the thirteen acts are declared', acts.length, 13);

// EVERY ONE CARRIES WORDS TO SHOW. The University's ruling is that a locked
// function stays VISIBLE — "🔒 Generate 15-minute Audio / Permission required"
// — so an act with no label is a padlock with nothing beside it.
check('and every one has something to show a person',
  acts.filter((a) => !a.label || a.label.length < 4).map((a) => a.capability), []);

// ---------------------------------------------------------------------------
// WHAT THE ROUTES ACTUALLY ASK
// ---------------------------------------------------------------------------
const routes = walk(join(root, 'src', 'app', 'api', 'studio'));
check('there are Studio routes to check', routes.length > 5, true);

const routeText = routes.map((f) => strip(readFileSync(f, 'utf8'))).join('\n');

/**
 * A capability is ENFORCED when it reaches `mayRunStudioAct`.
 *
 * Two shapes count, because both are real: handed in directly, and looked up
 * from a table that the same file passes to it. Anything else — a name in a
 * list, a comment, a label — does not.
 */
const asked = new Set();

// ---------------------------------------------------------------------------
// FILE BY FILE, AND THE RESULT MUST REACH THE CHECK.
//
// The first version concatenated every route and asked whether the text
// mentioned `CAPABILITY_FOR_STAGE[`. Deleting the entire permission check from
// the run route — the single most important break there is — STILL PASSED,
// because the lookup line above it survived and the table was credited on its
// own.
//
// A detector that credits a table for existing is measuring the table, not the
// enforcement. So: per file, and the looked-up value has to be handed to
// `mayRunStudioAct` in that same file before the table counts.
// ---------------------------------------------------------------------------
for (const file of routes) {
  const text = strip(readFileSync(file, 'utf8'));
  if (!/mayRunStudioAct\(/.test(text)) continue;

  // Every quoted name inside a call — a ternary chooses between two, and a
  // pattern stopping at the first `)` saw only one of them.
  for (const call of text.matchAll(/mayRunStudioAct\(([\s\S]{0,240}?)\);/g)) {
    for (const name of call[1].matchAll(/'([a-z-]+)'/g)) asked.add(name[1]);
  }

  // A table declared in the route whose values the same file checks.
  for (const m of text.matchAll(/^\s*[a-z]+:\s*'(studio-[a-z-]+|publish-course-material)',$/gm)) {
    asked.add(m[1]);
  }

  // And the stage table, which lives in studioPermissions.ts because a stage
  // with no named capability must be REFUSED rather than run. It counts only
  // when this file looks a stage up AND passes what it found to the check.
  if (/CAPABILITY_FOR_STAGE\[/.test(text) && /mayRunStudioAct\([^;]*needed/.test(text)) {
    const table = /export const CAPABILITY_FOR_STAGE[\s\S]*?\n\};/.exec(permissions)?.[0] ?? '';
    for (const m of table.matchAll(/'(studio-[a-z-]+)'/g)) asked.add(m[1]);
  }
}

/**
 * THE ACTS NOT YET BEHIND A CHECK, EACH SAYING WHY.
 *
 * Not an excuse list. Every line here is a permission the University can see
 * in Studio Control, can grant, can revoke — and which nothing currently
 * consults. That is a real gap and it is written down as one.
 */
const NOT_YET_ENFORCED = {
  'studio-record-lecture':
    'Recording in the browser ends in the same POST as an upload, so there is no separate route '
    + 'to guard yet. Until the recorder is a distinct act, a lecturer with upload and without '
    + 'record can still record — the permission is real in Studio Control and enforced nowhere.',
  'studio-replace-content':
    'The artefact route names it, but there is no `replace` action in its switch to trigger it: '
    + 'a recording is replaced today by uploading another. The permission is ready for the act '
    + 'and the act is not built.',
  'studio-manage-ebooks':
    'The Course Library is not built. The University ruled on it on 16 September 2026 — e-books '
    + 'as first-class course resources, with reading and downloading as SEPARATE rights — and '
    + 'this permission exists so the work has somewhere to land.',
};

const unasked = acts.map((a) => a.capability)
  .filter((c) => !asked.has(c) && !NOT_YET_ENFORCED[c]);
check('every act is either checked on a request, or named as not yet checked', unasked, []);

// AND THE LIST DOES NOT GO STALE. An act that HAS been wired must come off it,
// or the next reader is told a permission does nothing when it does.
const staleExcuses = Object.keys(NOT_YET_ENFORCED).filter((c) => asked.has(c));
check('nothing is excused that is now enforced', staleExcuses, []);

console.log(`\n      ${asked.size} of ${acts.length} acts are checked on the request.`);
for (const [c, why] of Object.entries(NOT_YET_ENFORCED)) console.log(`      not yet: ${c} — ${why.slice(0, 96)}…`);

// ---------------------------------------------------------------------------
// THE SCREEN'S LIST AND THE SERVER'S LIST ARE THE SAME LIST
// ---------------------------------------------------------------------------
//
// StudioControl.tsx carries its own copy of the thirteen acts, and has to:
// `studioPermissions.ts` reads the service key to resolve grants, so importing
// it into a client component would pull a service-role client into the browser
// bundle.
//
// A copy is fine. A copy nobody checks is how an office comes to grant a
// permission the server has never heard of — it would appear on screen, be
// written to capability_grants, and refuse nothing, for ever, silently.
// ---------------------------------------------------------------------------
console.log('\nThe screen offers exactly what the server enforces\n');

const screen = strip(readFileSync(
  join(root, 'src', 'components', 'admin', 'StudioControl.tsx'), 'utf8'));

const onScreen = [...screen.matchAll(/\{ capability: '([a-z-]+)', label: '([^']+)'/g)]
  .map((m) => m[1]).sort();
check('the screen lists the same acts as the server',
  onScreen, acts.map((a) => a.capability).sort());

// AND EVERY ONE SAYS WHAT IT COSTS OR WHAT IT DOES. An office deciding whether
// to hand somebody the fifteen-minute audio needs to know it is the expensive
// one; a row that only repeats its own name tells them nothing.
const notes = [...screen.matchAll(/note: '([^']{10,})'/g)].map((m) => m[1]);
check('and every act explains itself to the person granting it',
  notes.length, acts.length);

// THE SCREEN CANNOT OFFER "FOREVER". 056 refuses a grant with no expiry, so a
// form that implied one would be a button that always fails.
// THE OPTIONS THEMSELVES, not the word anywhere on the page. The first version
// searched for "forever" and failed on the sentence EXPLAINING that there is no
// forever — a check that punishes the screen for saying the right thing.
const options = [...screen.matchAll(/<option value=\{(\d+)\}>([^<]*)</g)]
  .map((m) => ({ days: Number(m[1]), label: m[2] }));
check('the grant form offers some lengths', options.length > 1, true);
check('…and none of them is unlimited',
  options.filter((o) => o.days <= 0 || /never|unlimited|forever/i.test(o.label)), []);
check('…and it names the twenty-character minimum the database enforces',
  /20 characters/.test(screen), true);

// ---------------------------------------------------------------------------
// AND THE ONE THAT MATTERS MOST, BY NAME
//
// The whole ruling turns on this: a lecturer may submit without being able to
// spend the University's money on a model. If `lecturer` ever holds an AI
// capability by ROLE, the grant machinery becomes decoration.
// ---------------------------------------------------------------------------
console.log('\nA lecturer submits. A model runs when somebody says so\n');

const roles = strip(readFileSync(join(root, 'src', 'lib', 'roles.ts'), 'utf8'));
const lecturerBlock = /\n  lecturer: \[([\s\S]*?)\n  \],/.exec(roles)?.[1] ?? '';
check('the lecturer block was found', lecturerBlock.length > 50, true);

const aiHeldByRole = [...lecturerBlock.matchAll(/'(studio-ai-[a-z-]+)'/g)].map((m) => m[1]);
check('a lecturer holds NO studio-ai capability by role', aiHeldByRole, []);

// AND STILL HOLDS THE ONES THAT ARE PLAINLY THEIRS. A ruling that left a
// lecturer unable to type a lecture would have been read as an outage.
for (const c of ['studio-submit-lecture', 'studio-upload-lecture', 'studio-approve-content']) {
  check(`…and does hold '${c}'`, lecturerBlock.includes(`'${c}'`), true);
}

// THE VICE-CHANCELLOR GRANTS, AND DOES NOT THEREBY GET TO CHANGE ROLES.
const vcBlock = /\n  'vice-chancellor': \[([\s\S]*?)\n  \],/.exec(roles)?.[1] ?? '';
check('the Vice-Chancellor may grant a Studio permission',
  vcBlock.includes("'grant-studio-permission'"), true);
check('…and has not been handed assign-roles to do it',
  vcBlock.includes("'assign-roles'"), false);

// AND THE NARROWING IS REAL, not a comment. The grant route must check that
// the capability being granted actually begins `studio-`.
const grantRoute = strip(readFileSync(
  join(root, 'src', 'app', 'api', 'admin', 'capability-grant', 'route.ts'), 'utf8'));
check('the narrower authority only answers for studio- capabilities',
  /startsWith\('studio-'\)/.test(grantRoute), true);
check('…and it is used to admit a caller the broader check refused',
  /grant-studio-permission/.test(grantRoute), true);

console.log(failures ? `\n${failures} check(s) failed.\n` : '\nSubmitting and generating are different acts.\n');
process.exit(failures ? 1 : 0);
