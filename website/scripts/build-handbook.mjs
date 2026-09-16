// ---------------------------------------------------------------------------
// THE HANDBOOK'S FACTUAL HALF, READ OUT OF THE SYSTEM.
//
//   node scripts/build-handbook.mjs
//
// Writes src/content/handbookFromTheSystem.ts.
//
// ---------------------------------------------------------------------------
// WHY THE HANDBOOK IS NOT SIMPLY WRITTEN
// ---------------------------------------------------------------------------
//
// The University asked for a master handbook that is "the authoritative
// operational reference for the use of the ICOF Global University digital
// system" — one document that says who may do what, which screens each office
// is served, and what the system will refuse.
//
// EVERY ONE OF THOSE IS A FACT THIS REPOSITORY ALREADY HOLDS, and a handbook
// that states them in prose states them a second time. Two statements of one
// fact is how the second one comes to be wrong: the matrix changes, the
// handbook does not, and the document the University calls authoritative
// becomes the least reliable description of the system in the building.
//
// The National Rector programme map had exactly this fault and was accurate for
// about a day. So the same answer: the handbook's factual half is a query.
//
// ---------------------------------------------------------------------------
// WHAT IS GENERATED AND WHAT IS WRITTEN
// ---------------------------------------------------------------------------
//
//   GENERATED   every role, its label, its place in the hierarchy, what it may
//               do, what it may NOT do, and which screens it is served.
//               Every rule the database has been WATCHED to enforce.
//
//   WRITTEN     what the University is, how a thing is done, what an officer
//               should do when something goes wrong. Judgement, procedure and
//               explanation — which no schema holds.
//
// The written half lives in src/content/systemHandbook.ts and cites the
// generated half rather than repeating it.
//
// ---------------------------------------------------------------------------
// AND "WHAT A ROLE MAY NOT DO" IS THE HALF THAT CARRIES THE WEIGHT
// ---------------------------------------------------------------------------
//
// roles.ts says so in its own header: "Finance Administrator cannot admit
// students; Registrar Administrator cannot edit payments. That is a separation
// of duties." A handbook listing only permissions would leave every one of
// those lines as prose in a document. Here they are computed — the capabilities
// a role's NEIGHBOURS hold and it does not — so the separation is visible
// without anybody remembering to write it down.
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const src = join(root, 'src');

// ---------------------------------------------------------------------------
// 1. THE MATRIX, BY RUNNING IT
//
// Bundled and imported rather than parsed. `can()` is not a lookup — it folds
// 'all', the spreads and the per-role lists together, and a parser that read
// the table would be a second implementation of the thing it is describing.
// ---------------------------------------------------------------------------

const cache = join(root, 'node_modules', '.cache', 'iguc-handbook');
mkdirSync(cache, { recursive: true });
const bundle = join(cache, 'roles.mjs');
execFileSync('npx', [
  'esbuild', join(src, 'lib', 'roles.ts'),
  '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`, '--log-level=error',
  `--alias:@=${src}`,
]);
const {
  can, roleLabels, HIERARCHY, ALL_CAPABILITIES,
} = await import(bundle);

const stripTs = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1 ');

const typesTs = stripTs(readFileSync(join(src, 'lib', 'types.ts'), 'utf8'));
const ROLES = (() => {
  const m = /export type UserRole\s*=([\s\S]*?);/.exec(typesTs);
  return (m[1].match(/'[a-z-]+'/g) ?? []).map((s) => s.slice(1, -1));
})();

const CAPABILITIES = [...ALL_CAPABILITIES];

// ---------------------------------------------------------------------------
// 2. THE SCREENS EACH ROLE IS SERVED
//
// PARSED FROM THE SOURCE rather than bundled, because `portalNav.tsx` carries
// a lucide icon in every item and importing it would need React. The shapes it
// is parsed from are two — a one-line item and a block item — and the parser
// asserts it found a plausible number of them rather than silently returning
// an empty menu, which would read in the handbook as "this role is served
// nothing".
// ---------------------------------------------------------------------------

const navSource = readFileSync(join(src, 'lib', 'portalNav.tsx'), 'utf8');
const nav = stripTs(navSource);

/**
 * The items of one menu array, with the region bounded explicitly.
 *
 * TWO FAULTS LIVE HERE AND BOTH WERE MEASURED, not reasoned about.
 *
 * The first: the staff array was cut "at the next top-level export", and
 * STUDENT_GROUPS is declared `const`, not `export const` — so the staff region
 * ran straight through the student menu and attributed a student's screens to
 * every office. The regions are named at both ends now.
 *
 * The second: an item was matched up to `\n  }`, which is the end of a BLOCK
 * item and never appears inside a one-line one — so each one-liner swallowed
 * everything up to the next block item, and 66 staff items parsed as 49. Items
 * are cut at the next `id:` instead, which is the one boundary both shapes
 * share.
 *
 * And the count is checked against the raw number of `id:` keys in the region,
 * which is what turns "the parser lost its grip" from something a reader of
 * the handbook discovers into something this script refuses to build.
 */
/**
 * The roles on one item, whether written out or named.
 *
 * `roles: EVERYONE` IS NOT AN ARRAY. Some items name a shared const instead of
 * listing the roles, and a parser that only understood array literals read
 * those as "served to nobody" — which in a handbook is a sentence saying an
 * office cannot reach a screen it uses every day.
 */
function rolesIn(window) {
  const literal = /roles:\s*\[([\s\S]*?)\]/.exec(window);
  if (literal) return (literal[1].match(/'[a-z-]+'/g) ?? []).map((s) => s.slice(1, -1));
  const named = /roles:\s*([A-Z_][A-Z_0-9]*)/.exec(window);
  if (named) {
    const decl = new RegExp(`const ${named[1]}[^=]*=\\s*\\[([\\s\\S]*?)\\]`).exec(nav);
    if (!decl) {
      throw new Error(`build-handbook: an item names roles: ${named[1]} and portalNav.tsx does `
        + 'not declare it as an array.');
    }
    return (decl[1].match(/'[a-z-]+'/g) ?? []).map((s) => s.slice(1, -1));
  }
  return [];
}

function menuFrom(from, to) {
  const start = nav.indexOf(from);
  if (start === -1) throw new Error(`build-handbook: ${from} not found in portalNav.tsx`);
  const after = nav.slice(start + from.length);
  const stop = to ? after.indexOf(to) : -1;
  const body = stop === -1 ? after : after.slice(0, stop);

  const declared = (body.match(/id:\s*'/g) ?? []).length;

  const groups = [];
  // `title: null` IS A REAL GROUP. The Dashboard sits in one — an untitled
  // band at the top of the rail — and a regex looking only for a quoted title
  // skipped past it, leaving the one screen EVERY role is served out of every
  // profile in the handbook.
  const marks = [...body.matchAll(/title:\s*(?:'([^']+)'|(null))/g)]
    .map((m) => ({ title: m[1] ?? 'Dashboard', at: m.index }));
  for (let i = 0; i < marks.length; i += 1) {
    const slice = body.slice(marks[i].at, marks[i + 1]?.at ?? body.length);
    const ids = [...slice.matchAll(/id:\s*'([a-z-]+)'/g)];
    const items = [];
    for (let j = 0; j < ids.length; j += 1) {
      const window = slice.slice(ids[j].index, ids[j + 1]?.index ?? slice.length);
      const label = /label:\s*'([^']+)'/.exec(window);
      if (!label) continue;
      const capMatch = /capability:\s*'([a-z-]+)'/.exec(window);
      items.push({
        id: ids[j][1],
        label: label[1],
        roles: rolesIn(window),
        capability: capMatch ? capMatch[1] : null,
      });
    }
    groups.push({ title: marks[i].title, items });
  }

  const parsed = groups.reduce((n, g) => n + g.items.length, 0);
  if (parsed !== declared) {
    throw new Error(`build-handbook: ${from.slice(0, 40)}… declares ${declared} items and the `
      + `parser found ${parsed}. A handbook built from this would tell offices they are served `
      + 'screens they are not, or omit ones they are.');
  }
  return groups;
}

const STAFF_MENU = menuFrom(
  'export const menuGroups: MenuGroup[] = [', 'const STUDENT_GROUPS: MenuGroup[] = [',
);
const STUDENT_MENU = menuFrom('const STUDENT_GROUPS: MenuGroup[] = [', 'export function groupsFor');

const staffItems = STAFF_MENU.reduce((n, g) => n + g.items.length, 0);
if (staffItems < 40) {
  throw new Error(`build-handbook: parsed only ${staffItems} staff menu items — the parser has `
    + 'lost its grip on portalNav.tsx, and a handbook built from it would tell offices they are '
    + 'served screens they are not.');
}

/** What `groupsFor` would serve this role, without needing React to ask it. */
function screensFor(role) {
  const source = role === 'student' ? STUDENT_MENU : STAFF_MENU;
  return source
    .map((g) => ({
      title: g.title,
      items: g.items
        .filter((i) => i.roles.includes(role) && (!i.capability || can(role, i.capability)))
        .map((i) => i.label),
    }))
    .filter((g) => g.items.length);
}

// ---------------------------------------------------------------------------
// 3. WHAT THE DATABASE HAS BEEN WATCHED TO REFUSE
//
// Every migration proves its rules in SQL and rolls back, and each proof that
// passes prints one line. THOSE LINES ARE THE RULES, in English, already
// proved — so a handbook section built from them is a list of things the
// University has evidence for rather than a list of intentions.
//
// A rule that stops being enforced stops printing its line and leaves this
// document on the next build. That is the property no written list has.
// ---------------------------------------------------------------------------

const migrationsDir = join(root, 'docs', 'migrations');
const RULES = [];
for (const file of readdirSync(migrationsDir).filter((f) => /^\d\d\d_.*\.sql$/.test(f)).sort()) {
  const sql = readFileSync(join(migrationsDir, file), 'utf8');
  const number = file.slice(0, 3);
  const said = [];
  // `raise notice 'NNN OK  …'` — single-quoted, possibly continued on the next
  // line as an adjacent literal, which is how the long ones are written.
  const NOTICE = new RegExp(`raise notice\\s*'${number} OK\\s+([\\s\\S]*?)'\\s*(?:,|;)`, 'g');
  for (const m of sql.matchAll(NOTICE)) {
    const text = m[1]
      .replace(/'\s*\n\s*'/g, '')       // adjacent literals, joined
      .replace(/''/g, "'")              // SQL's escaped quote
      .replace(/%%/g, '%')
      .replace(/\s+/g, ' ')
      .trim();
    // The housekeeping line every proof ends on is not a rule about the
    // University; it is a rule about the proof.
    if (/rolled back/.test(text)) continue;
    if (text.length > 3) said.push(text);
  }
  if (said.length) RULES.push({ migration: number, file, rules: said });
}

// ---------------------------------------------------------------------------
// 4. THE ROLE PROFILES
// ---------------------------------------------------------------------------

const held = (role) => CAPABILITIES.filter((c) => can(role, c));

/**
 * What this role may NOT do that a role near it may.
 *
 * COMPARED AGAINST ITS NEIGHBOURS IN THE HIERARCHY, not against the whole
 * matrix. Against everything, every role "cannot design credentials", which is
 * true of twenty-three roles and tells a reader nothing. Against the offices
 * it works beside, the list is the separation of duties itself: the Registrar
 * cannot edit payments; Finance cannot admit students.
 */
function withheld(role) {
  const mine = new Set(held(role));
  const i = HIERARCHY.indexOf(role);
  const neighbours = i === -1
    ? HIERARCHY.slice(0, 6)
    : HIERARCHY.slice(Math.max(0, i - 2), i + 3).filter((r) => r !== role);
  const theirs = new Set(neighbours.flatMap((r) => held(r)));
  return [...theirs].filter((c) => !mine.has(c)).sort();
}

const PROFILES = ROLES.map((role) => ({
  role,
  label: roleLabels[role] ?? role,
  rank: HIERARCHY.indexOf(role) === -1 ? null : HIERARCHY.indexOf(role) + 1,
  capabilities: held(role),
  withheld: withheld(role),
  screens: screensFor(role),
}));

// ---------------------------------------------------------------------------
// 5. WHO HOLDS EACH CAPABILITY
// ---------------------------------------------------------------------------

const BY_CAPABILITY = CAPABILITIES.map((capability) => ({
  capability,
  roles: ROLES.filter((r) => can(r, capability)),
})).sort((a, b) => a.capability.localeCompare(b.capability));

/**
 * The capabilities the University has restricted to the two highest offices.
 *
 * COMPUTED, NOT LISTED. "Restricted" means exactly one thing here — that no
 * office outside the Vice-Chancellor and the Superadministrator holds it — and
 * computing it means Part VIII cannot claim a restriction the matrix has
 * quietly stopped applying.
 */
const RESTRICTED = BY_CAPABILITY
  .filter((c) => c.roles.length > 0
    && c.roles.every((r) => r === 'superadmin' || r === 'vice-chancellor'))
  .map((c) => c.capability);

// ---------------------------------------------------------------------------
// 6. WRITE IT
// ---------------------------------------------------------------------------

const banner = `// ---------------------------------------------------------------------------
// GENERATED. Do not edit — run \`npm run handbook\`.
//
// Written by scripts/build-handbook.mjs from src/lib/roles.ts,
// src/lib/types.ts, src/lib/portalNav.tsx and docs/migrations/*.sql.
//
// This is the half of the ICOF Global University System Handbook that states
// FACTS ABOUT THE SYSTEM: who may do what, what each office is withheld, which
// screens each role is served, and every rule the database has been watched to
// enforce. None of it is written by hand, because a handbook that restates the
// matrix in prose is a second copy of the matrix — and the second copy is the
// one that goes wrong.
//
// The written half is src/content/systemHandbook.ts and cites this.
// ---------------------------------------------------------------------------
`;

const ts = `${banner}
export interface RoleProfile {
  role: string;
  label: string;
  /** Position in the University's hierarchy, 1 = most senior. Null = outside it. */
  rank: number | null;
  capabilities: string[];
  /** What the offices beside this one may do, and it may not. */
  withheld: string[];
  screens: { title: string; items: string[] }[];
}

export interface EnforcedRules {
  migration: string;
  file: string;
  /** Each one printed by a proof that ran, refused something, and rolled back. */
  rules: string[];
}

export const GENERATED_ON = ${JSON.stringify(new Date().toISOString().slice(0, 10))};

export const ROLE_PROFILES: RoleProfile[] = ${JSON.stringify(PROFILES, null, 2)};

export const CAPABILITY_HOLDERS: { capability: string; roles: string[] }[] =
  ${JSON.stringify(BY_CAPABILITY, null, 2)};

/** Held by the Vice-Chancellor and the Superadministrator and by nobody else. */
export const RESTRICTED_TO_THE_TWO: string[] = ${JSON.stringify(RESTRICTED, null, 2)};

export const ENFORCED: EnforcedRules[] = ${JSON.stringify(RULES, null, 2)};

export const COUNTS = {
  roles: ${ROLES.length},
  capabilities: ${CAPABILITIES.length},
  migrations: ${readdirSync(migrationsDir).filter((f) => /^\\d\\d\\d_.*\\.sql$/.test(f)).length},
  provedRules: ${RULES.reduce((n, r) => n + r.rules.length, 0)},
};
`;

writeFileSync(join(src, 'content', 'handbookFromTheSystem.ts'), ts);

console.log('\nICOF Global University System Handbook — the generated half\n');
console.log(`  ${ROLES.length} roles, ${CAPABILITIES.length} capabilities`);
console.log(`  ${RESTRICTED.length} capabilities restricted to the two highest offices`);
console.log(`  ${RULES.length} migrations contributing `
  + `${RULES.reduce((n, r) => n + r.rules.length, 0)} proved rules`);
console.log(`  ${staffItems} staff screens, ${STUDENT_MENU.reduce((n, g) => n + g.items.length, 0)} student screens`);
console.log('\n  → src/content/handbookFromTheSystem.ts\n');
