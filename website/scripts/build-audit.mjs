// ---------------------------------------------------------------------------
// THE SYSTEM AUDIT — what is built, what is not, and what nobody can see.
//
//   node scripts/build-audit.mjs        (npm run audit)
//
// Writes docs/SYSTEM-AUDIT.md.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A SCRIPT
// ---------------------------------------------------------------------------
//
// The University asked for an overall audit. An audit written by hand is a
// photograph of one afternoon: it is right when it is filed and wrong within a
// week, and the second time somebody asks it has to be done again from
// nothing. This repository has made that mistake once already — the National
// Rector programme map — and the answer then was the answer now. The audit is
// a query.
//
// Everything below is computed. Nothing is remembered.
//
// ---------------------------------------------------------------------------
// AND IT SAYS WHAT IT CANNOT SEE
// ---------------------------------------------------------------------------
//
// The largest single unknown in this system is not in this repository: it is
// WHICH MIGRATIONS THE UNIVERSITY HAS ACTUALLY RUN. The sandbox cannot reach
// their database. An audit that quietly omitted that would be reporting on the
// half it can measure and calling it the whole, so it is the first section.
//
// ---------------------------------------------------------------------------
// WHAT COUNTS AS A GAP
// ---------------------------------------------------------------------------
//
// Four kinds, and they are not equally serious:
//
//   NO DOOR       Machinery exists and nothing can reach it. A table nothing
//                 reads, a capability nothing checks, a view with no screen.
//                 The system cannot do the thing it was built to do.
//   NO LOCK       A door exists and nothing guards it.
//   TWO ANSWERS   The same fact is stated in two places that can disagree.
//   UNKNOWN       Something this audit cannot determine from here.
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const src = join(root, 'src');
const migrationsDir = join(root, 'docs', 'migrations');

const stripTs = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1 ');

// ---------------------------------------------------------------------------
// READING THE REPOSITORY
// ---------------------------------------------------------------------------

const migrationFiles = readdirSync(migrationsDir)
  .filter((f) => /^\d\d\d_.*\.sql$/.test(f)).sort();

/** Which migration first created each table or view. */
const bornIn = {};
for (const f of migrationFiles) {
  const sql = readFileSync(join(migrationsDir, f), 'utf8');
  for (const m of sql.matchAll(/create table if not exists ([a-z_]+)/gi)) {
    if (!bornIn[m[1]]) bornIn[m[1]] = f.slice(0, 3);
  }
  for (const m of sql.matchAll(/create (?:or replace )?view ([a-z_]+)/gi)) {
    if (!bornIn[m[1]]) bornIn[m[1]] = f.slice(0, 3);
  }
}
const objects = Object.keys(bornIn).sort();

/** Every source file the application actually ships. */
const walk = (d, out = []) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const f = join(d, e.name);
    if (e.isDirectory()) walk(f, out);
    else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) out.push(f);
  }
  return out;
};
const sourceFiles = walk(src);
const sourceText = sourceFiles.map((f) => stripTs(readFileSync(f, 'utf8'))).join('\n');

/** Named in code at all — as a string, which is how every table is reached. */
const isRead = (name) => new RegExp(`['"\`]${name}['"\`]`).test(sourceText);

// ---------------------------------------------------------------------------
// THE CAPABILITY MATRIX, BY RUNNING IT
// ---------------------------------------------------------------------------

const cache = join(root, 'node_modules', '.cache', 'iguc-audit');
mkdirSync(cache, { recursive: true });
const bundled = join(cache, 'roles.mjs');
execFileSync('npx', [
  'esbuild', join(src, 'lib', 'roles.ts'), '--bundle', '--format=esm', '--platform=node',
  `--outfile=${bundled}`, '--log-level=error', `--alias:@=${src}`,
]);
const { can, ALL_CAPABILITIES, roleLabels } = await import(bundled);

const typesTs = stripTs(readFileSync(join(src, 'lib', 'types.ts'), 'utf8'));
const ROLES = (/export type UserRole\s*=([\s\S]*?);/.exec(typesTs)[1]
  .match(/'[a-z-]+'/g) ?? []).map((s) => s.slice(1, -1));

/**
 * A capability nothing checks.
 *
 * ASKED OF THE SHIPPED SOURCE ONLY. `roles.ts` names every capability by
 * definition, so it is excluded — counting it would report that every
 * capability is enforced, which is the answer that makes the check useless.
 */
/**
 * The files excluded, and each for a different reason.
 *
 * THE FIRST RUN OF THIS AUDIT REPORTED ZERO CAPABILITIES UNENFORCED, against
 * portalCoverage's twenty-four. The cause was the third entry:
 * `handbookFromTheSystem.ts` is GENERATED and lists every capability in the
 * system as data, so every capability appeared somewhere in src and the check
 * answered "all enforced" — the one answer that makes it useless.
 *
 * A false "this is covered" is worse than a missed gap on a report whose whole
 * purpose is to name the things nobody checks.
 */
const EXCLUDED = [
  // Declares them all, by definition.
  join(src, 'lib', 'roles.ts'),
  // A DIFFERENT VOCABULARY that reuses some of the same words for acts inside
  // one lecture. portalCoverage excludes this one file and no more, because
  // the Studio's ROUTES do enforce the University's studio-* capabilities.
  join(src, 'academic', 'lib', 'capabilities.ts'),
  // Generated: the handbook's own tables, and the figures drawn from them.
  join(src, 'content', 'handbookFromTheSystem.ts'),
  join(src, 'lib', 'handbookFigures.ts'),
  join(src, 'content', 'systemHandbook.ts'),
];
const enforcementText = sourceFiles
  .filter((f) => !EXCLUDED.includes(f))
  .map((f) => stripTs(readFileSync(f, 'utf8')))
  .join('\n');
const unenforced = ALL_CAPABILITIES
  .filter((c) => !new RegExp(`['"\`]${c}['"\`]`).test(enforcementText))
  .sort();

// ---------------------------------------------------------------------------
// THE GAPS
// ---------------------------------------------------------------------------

const unread = objects.filter((o) => !isRead(o));

/**
 * Grouped by the migration that created them, because the shape of the answer
 * is different for each group and a flat list of thirty-nine names hides it.
 */
const unreadByMigration = {};
for (const o of unread) (unreadByMigration[bornIn[o]] ??= []).push(o);

/** Views AppLayout renders, and the sidebar entries that reach them. */
const layout = stripTs(readFileSync(join(src, 'components', 'AppLayout.tsx'), 'utf8'));
const nav = stripTs(readFileSync(join(src, 'lib', 'portalNav.tsx'), 'utf8'));
const rendered = [...new Set([...layout.matchAll(/case '([a-z-]+)':/g)].map((m) => m[1]))];
const navIds = [...new Set([...nav.matchAll(/id:\s*'([a-z-]+)'/g)].map((m) => m[1]))];
// An entry with an href is a link to a page, not a view AppLayout renders.
const hrefIds = [...new Set([...nav.matchAll(/id:\s*'([a-z-]+)',\s*href:/g)].map((m) => m[1]))];
const menuNoScreen = navIds.filter((v) => !rendered.includes(v) && !hrefIds.includes(v));

/** The Academic Studio keeps its own capability list. Two vocabularies. */
const studioCaps = existsSync(join(src, 'academic', 'lib', 'capabilities.ts'))
  ? [...new Set((stripTs(readFileSync(join(src, 'academic', 'lib', 'capabilities.ts'), 'utf8'))
    .match(/'[a-z-]+'/g) ?? []).map((s) => s.slice(1, -1)))]
  : [];
const studioOnly = studioCaps.filter((c) => !ALL_CAPABILITIES.includes(c));
const vendoredFiles = existsSync(join(src, 'academic')) ? walk(join(src, 'academic')).length : 0;

/**
 * Roles served nothing at all.
 *
 * READ FROM THE HANDBOOK'S GENERATED PROFILES, not counted again here.
 *
 * This audit first counted them itself, with a regex over portalNav looking for
 * a roles list within 400 characters of an id — and reported LIBRARY STAFF as
 * served no screen, against the five the handbook gives them. The handbook's
 * parser is the careful one: it handles the untitled Dashboard group, the items
 * whose roles are a named const rather than a literal, and both item shapes,
 * and it refuses to build if its count disagrees with the file.
 *
 * Two parsers of one file is exactly the fault this audit reports elsewhere as
 * TWO ANSWERS. It would be a poor audit that committed it.
 */
const profiles = JSON.parse(
  /ROLE_PROFILES: RoleProfile\[\] = ([\s\S]*?);\n\nexport/
    .exec(readFileSync(join(src, 'content', 'handbookFromTheSystem.ts'), 'utf8'))[1],
);
const thinPortals = profiles
  .map((r) => ({
    role: r.role,
    label: r.label,
    screens: r.screens.reduce((n, g) => n + g.items.length, 0),
  }))
  .filter((r) => r.screens === 0);

/** Every bundle the University might still have to run. */
const parts = readdirSync(migrationsDir).filter((f) => /^RUN-PART-\d+\.sql$/.test(f)).sort();

const md = [];
const say = (s = '') => md.push(s);

const today = new Date().toLocaleDateString('en-GB',
  { day: 'numeric', month: 'long', year: 'numeric' });

say('# The ICOF Global University system, audited');
say();
say(`Generated on ${today} by \`npm run audit\`. Nothing in it is written by hand:`);
say(`every figure is read from the repository, so this document can be produced`);
say('again at any time and will describe the system as it is then.');
say();
say(`**${objects.length} tables and views · ${migrationFiles.length} migrations · `
  + `${ROLES.length} roles · ${ALL_CAPABILITIES.length} capabilities · `
  + `${sourceFiles.length} source files.**`);
say();
say('---');
say();

// ---- 0. WHAT THIS CANNOT SEE ---------------------------------------------
say('## 0. What this audit cannot see — and it is the biggest item');
say();
say('**Which migrations the University has actually run.** This sandbox cannot reach');
say('their Supabase project, so every statement below about the database describes');
say('what the REPOSITORY defines, not what is live.');
say();
say(`${migrationFiles.length} migrations exist. ${parts.length} bundles are prepared for`);
say(`running: ${parts.join(', ')}.`);
say();
say('This matters more than any other line in this document. Every screen, route and');
say('rule described below assumes tables that may not exist yet, and a system whose');
say('code is ahead of its database fails at the moment somebody uses it rather than');
say('at the moment it is deployed.');
say();
say('**There are two instruments for closing this and neither has been run against');
say('the live database:**');
say();
say('- `docs/migrations/ARE-THEY-ALL-IN.sql` — paste into the Supabase SQL editor and');
say('  it returns one row per migration saying YES or NO. It changes nothing.');
say('- The Readiness panel in Credentials, which reads the same probes from inside the');
say('  portal and reports what is outstanding.');
say();
say('Until one of them is run, everything below is an audit of the plans.');
say();

// ---- 1. NO DOOR ----------------------------------------------------------
say('---');
say();
say('## 1. No door — machinery nothing can reach');
say();
say(`### ${unread.length} tables and views are named nowhere in the application`);
say();
say('Each was created by a migration, is protected by row-level security, and is read');
say('by no screen and no route. Grouped by the migration that created them, because');
say('the groups have different answers.');
say();
// ---------------------------------------------------------------------
// CLASSIFIED, BECAUSE THE UNIVERSITY ASKED FOR THAT ONCE ALREADY
//
//   "I would not immediately delete or expose those tables. This is exactly
//    where Claude needs to distinguish between A. Orphaned/obsolete tables
//    and B. Valid domain tables with no UI yet."
//
// So the group, not just the list. A migration whose objects have no screen
// because the screens are not written yet is a schedule; one whose objects
// have no screen because somebody forgot is a fault; and they need different
// answers.
// ---------------------------------------------------------------------
const MEANING = {
  '015': 'The proctoring half of the examination system. The exam screens exist; '
    + 'identity checks, device checks, recordings and reports have no interface.',
  '016': 'A student-facing examination view with no screen reading it.',
  '019': 'Academic policy, honours and standing events — the rules a faculty applies, '
    + 'with no screen to set or read them.',
  '024': 'Admission state machinery and the student-number counter, used by the '
    + 'database rather than by a screen.',
  '084': 'The Course Learning Hub. The data model was landed ahead of its screens '
    + 'deliberately, so they could be built against something proved.',
  '085': 'The Course Learning Hub — activities, answers, discussion and attendance.',
  '086': 'The Course Learning Hub — a student’s own classes, attendance and search.',
  '087': 'The Course Learning Hub — progress, for a student and for whoever teaches them.',
  '088': 'The lecturer directory.',
  '098': 'THE NATIONAL REVENUE AGREEMENT. Nothing in the application creates or '
    + 'approves one — and with no agreement in force every payment stays whole with '
    + 'the centre. The entire national revenue model cannot be switched on.',
  '101': 'THE CERTIFICATE AUDIT. §7 of the certificate ruling gives the '
    + 'Vice-Chancellor and the SuperAdmin the complete trail; the view exists and '
    + 'no screen reads it.',
};
say('| Migration | Objects | What it means |');
say('|---|---|---|');
for (const mig of Object.keys(unreadByMigration).sort()) {
  const list = unreadByMigration[mig];
  const note = MEANING[mig] ?? 'A helper view nothing has needed yet.';
  say(`| ${mig} | \`${list.join('`, `')}\` | ${note} |`);
}
say();
say('**None of these should be deleted.** The University ruled on that when the');
say('question was last asked, and re-reading them confirms it: every one is a valid');
say('domain object, and the two in capitals are machinery this repository built and');
say('left no way to reach.');
say();
say(`### ${unenforced.length} capabilities are checked nowhere`);
say();
say('A capability that no route and no screen asks for is a permission the University');
say('grants and cannot exercise. Granting one to a new role would change nothing.');
say();
say(unenforced.map((c) => `- \`${c}\``).join('\n'));
say();
if (menuNoScreen.length) {
  say('### Menu entries that render nothing');
  say();
  say(menuNoScreen.map((v) => `- \`${v}\``).join('\n'));
  say();
}
if (thinPortals.length) {
  say('### Roles served no screen at all');
  say();
  say(thinPortals.map((r) => `- **${r.label}** (\`${r.role}\`)`).join('\n'));
  say();
  say('An applicant is turned away from the student portal on purpose \u2014 it is for');
  say('enrolled students, and there are no application forms in it. Worth naming all the');
  say('same, because the role still holds capabilities it therefore cannot exercise here.');
  say();
}

// ---- 2. TWO ANSWERS ------------------------------------------------------
say('---');
say();
say('## 2. Two answers — the same fact stated twice');
say();
if (vendoredFiles) {
  say(`### The Academic Studio is a second application inside this one`);
  say();
  say(`\`src/academic\` holds ${vendoredFiles} files, including its own capability list.`);
  say(`${studioOnly.length} capabilities exist there and not in \`roles.ts\`:`);
  say();
  say(studioOnly.map((c) => `\`${c}\``).join(', '));
  say();
  say('Two capability vocabularies means a permission can be granted in one and be');
  say('unknown to the other. The System Handbook reads both, which is a workaround and');
  say('not a fix.');
  say();
}

// ---- 3. THE INSTRUMENTS --------------------------------------------------
say('---');
say();
say('## 3. What is already guarded, and by what');
say();
say('This system tests itself more than most, and the audit should say so as plainly');
say('as it says where the gaps are. These run on `npm test` and fail the build:');
say();
say('| Instrument | What it refuses |');
say('|---|---|');
say('| `reachability.test.mjs` | A route no screen calls; a table read by code nothing can write to |');
say('| `portalCoverage.test.mjs` | A capability enforced nowhere, unless the gap is named with a reason |');
say('| `migrationProbes.test.mjs` | A migration with nothing the Readiness panel can look for |');
say('| `bundles.test.mjs` | A bundle that does not apply to a database built from the previous commit |');
say('| `schemaContract.test.mjs` | A column the SQL claims and does not create |');
say('| `handbook.test.mjs` | A handbook that has drifted from the capability matrix |');
say('| `myRecordIsMine.test.mjs` | A "my" screen that reads one row without saying whose |');
say('| `theCertificateSampleIsRestricted.test.mjs` | The certificate design reaching any office but two |');
say('| `transcriptAuthority.test.mjs` | A transcript issued to somebody not in the register |');
say();
say('Every migration proves its own rules in SQL and rolls back, so the rules in Part');
say('VIII of the handbook are a list of things that have been watched to refuse.');
say();

writeFileSync(join(root, 'docs', 'SYSTEM-AUDIT.md'), `${md.join('\n')}\n`);

console.log('\nThe ICOF Global University system, audited\n');
console.log(`  ${objects.length} tables and views, ${unread.length} reachable from nothing`);
console.log(`  ${ALL_CAPABILITIES.length} capabilities, ${unenforced.length} checked nowhere`);
console.log(`  ${menuNoScreen.length} menu entries render nothing`);
console.log(`  ${thinPortals.length} roles served no screen`);
console.log(`  ${vendoredFiles} files in the vendored Studio, ${studioOnly.length} capabilities of its own`);
console.log(`  ${migrationFiles.length} migrations, ${parts.length} bundles prepared`);
console.log('\n  → docs/SYSTEM-AUDIT.md\n');
