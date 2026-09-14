// ---------------------------------------------------------------------------
// EVERY ACTION A ROUTE ACCEPTS IS ONE SOMETHING CAN ACTUALLY REACH.
//
// ---------------------------------------------------------------------------
// THE BUG THIS EXISTS FOR
// ---------------------------------------------------------------------------
//
// The University approved an appointment, pressed "Issue the letter", and got:
//
//   No letter has been generated for this appointment. 047 refuses an
//   appointment to be marked issued with no document behind it.
//
// Every word of that was true, and there was no way out of it. `issue`
// required an archived letter; only `generate` makes one; AND NO SCREEN HAS
// EVER CALLED `generate`. An approved appointment could not be issued at all.
//
// ---------------------------------------------------------------------------
// WHY reachability.test.mjs DID NOT CATCH IT
// ---------------------------------------------------------------------------
//
// That test asks whether a ROUTE is called by a screen. `/api/appointments/
// letter` is called constantly — for preview, for issue, for email — so it
// passed. The dead action was one of six inside a route that was otherwise
// busy, and nothing looked inside.
//
// THE UNIT THAT CAN DIE IS THE ACTION, NOT THE ROUTE. A route that dispatches
// on `body.action` is really several endpoints sharing a door, and they have
// to be checked one at a time.
//
// ---------------------------------------------------------------------------
// WHAT AN EXEMPTION MEANS
// ---------------------------------------------------------------------------
//
// An action no screen sends is not automatically wrong — it may be invoked by
// another action, by a scheduled job, or by an operator with a token. But that
// has to be WRITTEN DOWN with a reason, so the difference between "deliberate"
// and "forgotten" is a fact in the repository rather than a guess.
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../../', import.meta.url).pathname;

let failures = 0;
const fail = (m) => { failures += 1; console.error(`FAIL  ${m}`); };
const ok = (m) => console.log(`ok    ${m}`);

/** Comments stripped, so a comment naming an action never counts as a caller. */
const decomment = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

function walk(dir, ext, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------------------
// ACTIONS NOTHING ON A SCREEN SENDS, AND WHY THAT IS ALL RIGHT
// ---------------------------------------------------------------------------
//
// Each entry is "route action" → the reason. An action missing from here and
// from every screen fails the test.
const REACHED_ANOTHER_WAY = {
  // `issue` generates the letter when there is none, so the reference is
  // allocated as part of issuing. `generate` remains for a caller that wants
  // it allocated first — which is what this entry records.
  'appointments/letter generate': 'Performed inside the `issue` action, which produces the '
    + 'letter when an approved appointment has none. Kept as its own action for a caller that '
    + 'wants the reference allocated before issuing.',
};

// ---------------------------------------------------------------------------
// ACTIONS WITH NO SCREEN AT ALL — A REGISTER OF THE DEBT, NOT AN EXCUSE
// ---------------------------------------------------------------------------
//
// These are REAL GAPS. The route works, the rules are enforced, and there is
// no button anywhere — the same fault that dead-ended the appointment letter,
// standing open in seventeen other places. Finance cannot assess a student's
// fees, waive one, cancel one, grant or refuse a clearance; nobody can edit a
// fee schedule or a fee item after creating it; a correspondence letter cannot
// be withdrawn.
//
// `appointments close` WAS ON THIS LIST and is not any more. The Appointments
// screen now carries the control, so the entry came off — which is the whole
// point of the list refusing a stale one.
//
// SO WAS `admin/signature enable`, AND THAT ONE HAD A VISIBLE COST. 049 refuses
// self-enabling, so a specimen signature needs a second pair of eyes — and
// nothing in the system offered them. Every specimen ever stored stayed
// switched off, and every letter the University issued printed a blank rule
// where a signature belongs, including the Vice-Chancellor's own. It was on
// this list the whole time, which is what the list is for.
//
// THEY ARE LISTED SO THEY CANNOT BE FORGOTTEN, and the test still reports every
// one of them on every run. What it refuses is a NEW one appearing, or a listed
// one still being listed after it has been wired up — a stale entry is how a
// real orphan hides behind a tidy list.
const NO_SCREEN_YET = [
  // ---------------------------------------------------------------------
  // THE FOUR BELOW MARKED * WERE FOUND THE DAY THIS TEST LEARNED ABOUT
  // ROUTES.
  //
  // While the comparison was route-blind, each was masked by an action of the
  // same NAME reachable on some other route: a screen sending 'set' to the
  // rooms route reported `academic/offerings set` as wired, and so on. They
  // are not new gaps. They are gaps that have been open the whole time and
  // could not be seen — which is exactly what this list exists to prevent, and
  // the reason the flat name match had to go.
  // ---------------------------------------------------------------------
  'academic/curriculum move',              // *
  'academic/curriculum reprice',
  'academic/graduation revise',
  'academic/offerings reschedule',
  'academic/offerings set',                // *
  'academic/structure programme-status',
  'admin/appointment-conditions forkPost',
  'admin/appointment-conditions preamble',
  'admin/capability-grant grant',
  'admin/capability-grant mine',           // *
  'admin/document-template retire',
  'admin/job-description fork',            // *
  'announcements variants',
  'correspondence withdraw',
  'finance/fees assess',
  'finance/fees cancel',
  'finance/fees clear',
  'finance/fees item-set',
  'finance/fees refuse',
  'finance/fees schedule-set',
  'finance/fees waive',
];


console.log('\nEvery action a route accepts can be reached from a screen\n');

// ---- WHAT EACH ROUTE ACCEPTS ----------------------------------------------
const routes = walk(join(root, 'src', 'app', 'api'), 'route.ts');
const accepted = new Map();   // "appointments/letter" -> Set(actions)

for (const file of routes) {
  const src = decomment(readFileSync(file, 'utf8'));
  if (!/body\.action/.test(src)) continue;   // not an action-dispatching route

  const name = file
    .replace(join(root, 'src', 'app', 'api') + '/', '')
    .replace(/\/route\.ts$/, '');

  const found = new Set();

  // `action === 'x'`  and  `action !== 'x'`
  for (const m of src.matchAll(/\baction\s*[!=]==\s*'([a-zA-Z][\w-]*)'/g)) found.add(m[1]);
  // `['a','b'].includes(action)`  and  `ACTIONS = ['a','b']`
  for (const m of src.matchAll(/\[([^\]]*)\]\s*\.includes\(\s*action/g)) {
    for (const s of m[1].matchAll(/'([a-zA-Z][\w-]*)'/g)) found.add(s[1]);
  }
  for (const m of src.matchAll(/\bACTIONS\s*=\s*\[([^\]]*)\]/g)) {
    for (const s of m[1].matchAll(/'([a-zA-Z][\w-]*)'/g)) found.add(s[1]);
  }
  // `const CAPABILITY: Record<string, Capability> = { preview: …, issue: … }`
  const cap = /CAPABILITY[^=]*=\s*\{([\s\S]*?)\n\s*\};/.exec(src);
  if (cap) {
    // KEYED OFF THE SEPARATOR, NOT THE LINE START, so two entries written on
    // one line are both seen. Anchoring to `^` found only the first.
    for (const m of cap[1].matchAll(/(?:^|[,{])\s*'?([a-zA-Z][\w-]*)'?\s*:/g)) found.add(m[1]);
  }

  if (found.size > 0) accepted.set(name, found);
}

// ---- WHAT THE SCREENS SEND -------------------------------------------------
const screens = [
  ...walk(join(root, 'src', 'components'), '.tsx'),
  ...walk(join(root, 'src', 'app'), '.tsx'),
];

// ---------------------------------------------------------------------------
// ATTRIBUTED TO A ROUTE WHERE THAT CAN BE TOLD, AND NOT ONLY NAMED.
//
// This used to be one flat Set of action NAMES, compared route-blind:
// `sent.has(action)`. So an action called 'retire' sent to ANY route reported
// every other route's 'retire' as wired — and the failure was worse than a
// false pass, because the test then instructed the reader to delete the
// NO_SCREEN_YET entry for a gap that was still wide open. "A stale entry is how
// a real orphan hides behind a tidy list", and a route-blind match manufactures
// stale entries.
//
// It surfaced when the Question Bank screen gained `retire` in September 2026
// and `admin/document-template retire` — which no screen sends — was reported
// as closed.
//
// SO: a file naming exactly one `/api/...` route has its actions attributed to
// that route. A file naming several (or none) contributes to the loose set, as
// before, because there is no honest way to tell which action went where.
// ---------------------------------------------------------------------------
const sent = new Set();                 // the loose set: attribution impossible
const sentByRoute = new Map();          // route -> Set(actions)

for (const file of screens) {
  const src = decomment(readFileSync(file, 'utf8'));

  const routesNamed = new Set();
  for (const m of src.matchAll(/['"`]\/api\/([a-z0-9/-]+)['"`]/g)) routesNamed.add(m[1]);
  const only = routesNamed.size === 1 ? [...routesNamed][0] : null;
  const here = new Set();
  // `action:` followed by ANY expression, and every string in it counts.
  //
  // A PLAIN `action: 'x'` MATCH WAS NOT ENOUGH. The appointment form writes
  //   action: editingId ? 'edit' : 'draft'
  // and the correspondence composer does the same, so a ternary's second arm
  // looked like an action no screen sent. Two lines of context, because these
  // are sometimes wrapped.
  for (const m of src.matchAll(/\baction:\s*([^\n]*(?:\n[^\n]*)?)/g)) {
    for (const s of m[1].matchAll(/'([a-zA-Z][\w-]*)'/g)) here.add(s[1]);
  }
  // A helper called with the action as its first argument — `letter('issue',`,
  // `act('activate',` — which is how several screens spell it.
  for (const m of src.matchAll(/\b[a-z]\w*\(\s*'([a-zA-Z][\w-]*)'\s*,/g)) here.add(m[1]);
  // A union type of actions passed through, e.g. 'issue' | 'email' | 'whatsapp'
  for (const m of src.matchAll(/'([a-zA-Z][\w-]*)'(?:\s*\|\s*'[a-zA-Z][\w-]*')+/g)) {
    for (const s of m[0].matchAll(/'([a-zA-Z][\w-]*)'/g)) here.add(s[1]);
  }

  if (only) {
    if (!sentByRoute.has(only)) sentByRoute.set(only, new Set());
    for (const a of here) sentByRoute.get(only).add(a);
  } else {
    for (const a of here) sent.add(a);
  }
}

// ---- AND THE COMPARISON ----------------------------------------------------
const orphans = [];
let checked = 0;

for (const [route, actions] of [...accepted].sort()) {
  for (const action of [...actions].sort()) {
    checked += 1;
    const key = `${route} ${action}`;
    if (sentByRoute.get(route)?.has(action)) continue;
    // A SCREEN WE COULD NOT ATTRIBUTE. Still counts, or the test would report
    // every action sent from a file that talks to two routes.
    if (sent.has(action)) continue;
    if (key in REACHED_ANOTHER_WAY) continue;
    orphans.push(key);
  }
}

const listed = new Set(NO_SCREEN_YET);
const unlisted = orphans.filter((o) => !listed.has(o));
const known = orphans.filter((o) => listed.has(o));

if (unlisted.length === 0) {
  ok(`${checked} action(s) across ${accepted.size} action-dispatching route(s); `
    + `${known.length} have no screen yet and every one of them is named below`);
} else {
  for (const o of unlisted) {
    fail(`POST /api/${o.split(' ')[0]} accepts the action '${o.split(' ')[1]}', and no screen `
      + 'sends it.\n'
      + '      Wire it to a screen, or name it in NO_SCREEN_YET, or add it to\n'
      + '      REACHED_ANOTHER_WAY with the reason — an action nothing calls is a step of a\n'
      + '      workflow that stops, and the University finds it by pressing a button that\n'
      + '      refuses with a true sentence and no way out.');
  }
}

// ---- A LISTED GAP THAT HAS BEEN CLOSED MUST LEAVE THE LIST ----------------
//
// The half that keeps the register honest. A list that only ever grows stops
// being read, and a stale entry is how a real orphan hides inside a tidy one.
for (const key of NO_SCREEN_YET) {
  const [route, action] = key.split(' ');
  if (!accepted.has(route) || !accepted.get(route).has(action)) {
    fail(`NO_SCREEN_YET names '${action}' on '${route}', which the route no longer accepts. `
      + 'Remove the entry.');
  } else if (sentByRoute.get(route)?.has(action) || sent.has(action)) {
    // ROUTE-AWARE, LIKE THE COMPARISON ABOVE. Left on the flat set, this half
    // of the register went the other way: it demanded the removal of an entry
    // for a gap that was still open, because some OTHER route had an action of
    // the same name. That is how the check started instructing the reader to
    // delete a true entry — the failure that set all of this off.
    fail(`NO_SCREEN_YET still names '${action}' on '${route}', but a screen now sends it. `
      + 'Remove the entry — the gap is closed.');
  }
}

// ---- AND THEY ARE PRINTED, EVERY RUN --------------------------------------
if (known.length > 0) {
  console.log(`\n      ${known.length} route action(s) with no screen — real gaps, standing open:`);
  for (const o of known) {
    console.log(`        · POST /api/${o.split(' ')[0]}  →  ${o.split(' ')[1]}`);
  }
}

// ---- NOTHING IS DECLARED THAT IS NO LONGER DEAD ----------------------------
//
// The other half of the rule. A stale exemption is how a real orphan hides.
for (const key of Object.keys(REACHED_ANOTHER_WAY)) {
  const [route, action] = key.split(' ');
  if (!accepted.has(route)) {
    fail(`REACHED_ANOTHER_WAY names the route '${route}', which no longer dispatches on an `
      + 'action. Remove the entry.');
  } else if (!accepted.get(route).has(action)) {
    fail(`REACHED_ANOTHER_WAY names '${action}' on '${route}', which the route no longer `
      + 'accepts. Remove the entry.');
  }
}
if (failures === 0) ok('nothing is declared reachable-another-way that the route no longer has');

// ---- AND THE RULE CAN REFUSE SOMETHING ------------------------------------
//
// Proved by breaking it: the exact shape that dead-ended the appointment
// letter — a route accepting an action, with no screen sending it and no
// declaration — must be reported.
{
  const routeSrc = decomment(`
    const CAPABILITY = {
      preview: 'a', generate: 'b', issue: 'c',
    };
    const action = String(body.action ?? '');
    if (action === 'preview') { }
  `);
  const found = new Set();
  for (const m of routeSrc.matchAll(/\baction\s*[!=]==\s*'([a-zA-Z][\w-]*)'/g)) found.add(m[1]);
  const cap = /CAPABILITY[^=]*=\s*\{([\s\S]*?)\n\s*\};/.exec(routeSrc);
  if (cap) for (const m of cap[1].matchAll(/(?:^|[,{])\s*'?([a-zA-Z][\w-]*)'?\s*:/g)) found.add(m[1]);

  if (found.has('generate') && found.has('issue') && found.has('preview')) {
    ok('the rule reads the actions out of a route the way the real one is written');
  } else {
    fail(`the extractor missed actions in a specimen route — it found [${[...found]}], so it `
      + 'would report a dead action as reachable');
  }
}

console.log(failures === 0
  ? '\nNo route action is unreachable and unaccounted for.'
  : `\n${failures} unreachable route action(s) — a workflow stops there.`);

process.exit(failures === 0 ? 0 : 1);
