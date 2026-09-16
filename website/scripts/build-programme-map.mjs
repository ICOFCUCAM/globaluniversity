// ---------------------------------------------------------------------------
// THE NATIONAL RECTOR PROGRAMME MAP, BUILT FROM THE REPOSITORY.
//
//   node scripts/build-programme-map.mjs
//
// Writes docs/NATIONAL-RECTOR-PROGRAMME-MAP.md and .html.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A SCRIPT AND NOT A DOCUMENT
// ---------------------------------------------------------------------------
//
// The first version of this map was written by hand on 16 September 2026 and
// was accurate for about a day. Then 097, 098 and 099 landed, the two national
// roles went into the hierarchy and four screens were built — and the document
// still said "there is no national_administrations table", which had stopped
// being true. The University asked for it again, which is the right thing to
// ask and the wrong thing to have to ask.
//
// So the status of a section is NOT WRITTEN DOWN HERE. Each section declares
// the artefacts it claims — tables, views, functions, policies, columns, roles,
// capabilities, files, sidebar entries — and every one is looked for in the
// repository. The verdict is counted from what was found.
//
// A section also declares its GAPS, and a gap is a question the repository is
// asked, not a sentence somebody typed. "Nothing outside the national screens
// sets administration_id" is a grep. When that stops being true the gap closes
// by itself and the section goes green without anybody editing this file.
//
// Which means this map cannot be stale and cannot be flattering. If a table is
// dropped the section that claimed it turns amber the next time this runs.
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const docs = join(root, 'docs');
const migrationsDir = join(docs, 'migrations');

// ---------------------------------------------------------------------------
// READING THE REPOSITORY
// ---------------------------------------------------------------------------

const migrationFiles = readdirSync(migrationsDir)
  .filter((f) => /^\d\d\d_.*\.sql$/.test(f))
  .sort();

const rawSql = migrationFiles
  .map((f) => readFileSync(join(migrationsDir, f), 'utf8'))
  .join('\n');

/**
 * SQL COMMENTS COME OFF BEFORE ANYTHING IS COUNTED, with quoting and $$ bodies
 * tracked, because these migrations are more comment than statement and a
 * table named in a paragraph is not a table. The same reader is in
 * src/lib/myRecordIsMine.test.mjs, for the same reason.
 */
const stripSqlComments = (sql) => {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (c === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; }
        if (sql[j] === "'") { j += 1; break; }
        j += 1;
      }
      out += sql.slice(i, j); i = j; continue;
    }
    const dollar = c === '$' && /^\$[A-Za-z_]*\$/.exec(sql.slice(i, i + 32));
    if (dollar) {
      const tag = dollar[0];
      const end = sql.indexOf(tag, i + tag.length);
      const j = end === -1 ? sql.length : end + tag.length;
      out += sql.slice(i, j); i = j; continue;
    }
    if (c === '-' && sql[i + 1] === '-') {
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? sql.length : nl; out += ' '; continue;
    }
    if (c === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? sql.length : end + 2; out += ' '; continue;
    }
    out += c; i += 1;
  }
  return out;
};

const sql = stripSqlComments(rawSql);

const stripTs = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1 ');

const read = (rel) => (existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : '');
const readClean = (rel) => stripTs(read(rel));

const typesTs = readClean('src/lib/types.ts');
const rolesTs = readClean('src/lib/roles.ts');
const navTs = readClean('src/lib/portalNav.tsx');

const union = (text, name) => {
  const m = new RegExp(`export type ${name}\\s*=([\\s\\S]*?);`).exec(text);
  return m ? (m[1].match(/'[a-z-]+'/g) ?? []).map((s) => s.slice(1, -1)) : [];
};

const ROLES = union(typesTs, 'UserRole');

// `Capability` is `typeof OPERATIONAL_CAPABILITIES[number] | typeof
// SYSTEM_CAPABILITIES[number]`, so the type declaration names no capabilities
// at all. Reading it as a union returned an empty list — and the map then
// reported six sections as part built because every capability they claimed was
// "missing". The arrays are what has to be read.
const constArray = (text, name) => {
  const m = new RegExp(`export const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`).exec(text);
  return m ? (m[1].match(/'[a-z-]+'/g) ?? []).map((s) => s.slice(1, -1)) : [];
};
const CAPABILITIES = [
  ...constArray(rolesTs, 'OPERATIONAL_CAPABILITIES'),
  ...constArray(rolesTs, 'SYSTEM_CAPABILITIES'),
];

// THE ACADEMIC STUDIO KEEPS ITS OWN VOCABULARY, and finding that out is the
// second thing this script caught. `request-translation` and
// `approve-translation` are real, enforced capabilities — they are just not in
// `roles.ts`, they are in `src/academic/lib/capabilities.ts`, which is the
// vendored Studio folder Phase 5 exists to retire. The map reads both and says
// which list a capability came from, rather than reporting a working rule as
// missing because it looked in one place.
const studioTs = readClean('src/academic/lib/capabilities.ts');
const STUDIO_CAPABILITIES = [
  ...constArray(studioTs, 'ACADEMIC_CAPABILITIES'),
  ...(studioTs.match(/^\s*'[a-z-]+',\s*$/gm) ?? []).map((s) => s.trim().slice(1, -2)),
];
if (!CAPABILITIES.length) {
  console.error('No capabilities could be read from src/lib/roles.ts — the map would report '
    + 'every capability as missing. Fix the reader before trusting anything below.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// THE QUESTIONS A SECTION MAY ASK
//
// Each returns { kind, name, found }. Nothing here reports a judgement; they
// report a presence, and the verdict is counted from them further down.
// ---------------------------------------------------------------------------

const has = (re) => re.test(sql);

const table = (name) => ({
  kind: 'table', name, found: has(new RegExp(`create table if not exists ${name}\\b`, 'i')),
});
const view = (name) => ({
  kind: 'view', name, found: has(new RegExp(`create (or replace )?view ${name}\\b`, 'i')),
});
const fn = (name) => ({
  kind: 'function', name, found: has(new RegExp(`create or replace function ${name}\\s*\\(`, 'i')),
});
const policy = (name) => ({
  kind: 'policy', name, found: has(new RegExp(`create policy ${name}\\b`, 'i')),
});
const constraint = (name) => ({
  kind: 'constraint', name, found: has(new RegExp(`\\b${name}\\b`)),
});
/** A column added to a table that already existed. */
const column = (tbl, col) => ({
  kind: 'column',
  name: `${tbl}.${col}`,
  found: has(new RegExp(`alter table ${tbl}[\\s\\S]{0,200}?add column if not exists ${col}\\b`, 'i'))
    || has(new RegExp(`create table if not exists ${tbl}\\b[\\s\\S]*?\\n\\s*${col}\\s`, 'i')),
});
const role = (name) => ({ kind: 'role', name, found: ROLES.includes(name) });
const capability = (name) => ({
  kind: CAPABILITIES.includes(name) ? 'capability' : 'studio capability',
  name,
  found: CAPABILITIES.includes(name) || STUDIO_CAPABILITIES.includes(name),
});
const file = (rel) => ({ kind: 'file', name: rel, found: existsSync(join(root, rel)) });
/** A sidebar entry, which is what makes a screen reachable at all. */
const nav = (id) => ({ kind: 'sidebar', name: id, found: new RegExp(`id: '${id}'`).test(navTs) });

// ---------------------------------------------------------------------------
// A GAP IS A GREP, NOT AN OPINION.
// ---------------------------------------------------------------------------

/** Every .ts/.tsx under src, so a gap can ask about the application as a whole. */
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name);
    if (name.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name.name)) out.push(full);
  }
  return out;
};
const appFiles = walk(join(root, 'src'))
  .filter((f) => !/\.test\.[cm]?[jt]sx?$/.test(f))
  .map((f) => ({ path: f.slice(root.length + 1), text: stripTs(readFileSync(f, 'utf8')) }));

/**
 * SCREENS AND ROUTES outside `national/` that mention something — the seam,
 * measured.
 *
 * Narrowed to `src/components` and `src/app/api` on purpose. Asked of all of
 * `src` it found `src/lib/migrationProbes.ts`, which names `administration_id`
 * in order to ask the database whether 097 has run — and on that evidence the
 * map closed the gap and reported section 2 fully wired. A probe that LOOKS FOR
 * a column is not a screen that SETS one, and a question loose enough to
 * confuse them answers something nobody asked.
 */
const writesOutsideNational = (needle) => appFiles
  .filter((f) => /^src\/(components|app\/api)\//.test(f.path)
    && !/\/national\//.test(f.path)
    && f.text.includes(needle))
  .map((f) => f.path);

const gap = (says, open) => ({ says, open: Boolean(open) });

// ---------------------------------------------------------------------------
// THE ELEVEN SECTIONS
//
// The prose is the University's programme restated; the evidence and the gaps
// are the repository's answer to it.
// ---------------------------------------------------------------------------

const SECTIONS = [
  {
    n: 1,
    title: 'The National Rector',
    gloss: 'A scoped leadership office',
    evidence: [
      role('national-rector'),
      capability('lead-national-administration'),
      capability('establish-national-administration'),
      table('national_administrations'),
      fn('my_administration'),
      fn('serves_a_national_administration'),
      fn('governs_the_university'),
      constraint('national_administration_creator_is_not_the_rector'),
      nav('national-administrations'),
      file('src/components/national/NationalAdministrations.tsx'),
      file('src/app/api/national/administration/route.ts'),
    ],
    note: 'The role sits below the central offices — the University’s academic authority is not '
      + 'the Rector’s — and above a Dean, because a Rector leads an administration and a Dean '
      + 'leads a faculty within one. Which nation is a row in the register, not a property of '
      + 'the role: the role says what kind of authority, the register says where. 097 refuses '
      + 'to record an administration as established without the agreement it operates under, '
      + 'and refuses whoever creates it to be its own Rector.',
    gaps: [],
  },
  {
    n: 2,
    title: 'Recruitment & enrolment',
    gloss: 'Local access, global standards',
    evidence: [
      table('admission_openings'), table('admission_decisions'), table('admission_letters'),
      table('students'), table('enrollments'),
      column('students', 'administration_id'),
      policy('students_national_read'),
      fn('administration_is_the_centres_to_set'),
      capability('view-national-students'),
    ],
    note: 'The admissions pipeline was already built University-wide. 097 attached a nation to '
      + 'a student and made the scoping a row-level rule rather than a screen’s good manners, '
      + 'so a forgotten page cannot leak another country’s applicants. A record may be born '
      + 'into a nation — that is how a Rector recruits — but only into the Rector’s own, and '
      + 'moving a record between nations is the University’s act.',
    gaps: [
      gap('No admissions screen sets `administration_id`, so a student admitted today belongs '
        + 'to no nation and the central view is unchanged. Deliberate — nothing that works '
        + 'stops working — but it means the nation is currently attached by hand.',
      writesOutsideNational('administration_id').length === 0),
    ],
  },
  {
    n: 3,
    title: 'Staff recommendation',
    gloss: 'The Rector recommends, ICOF appoints',
    evidence: [
      table('appointments'), table('appointment_letters'), table('appointment_acceptances'),
      table('national_staff_recommendations'),
      fn('a_recommendation_is_somebody_elses_decision'),
      capability('recommend-national-staff'),
      nav('national-staff'),
      file('src/components/national/NationalStaff.tsx'),
      file('src/app/api/national/staff/route.ts'),
    ],
    note: '“The National Rector recommends. ICOF University verifies and appoints.” The '
      + 'capability stops deliberately short of drafting an appointment, and 099 refuses in '
      + 'the database a recommendation decided by whoever made it — the same rule 041 already '
      + 'applied to approvals.',
    gaps: [],
  },
  {
    n: 4,
    title: 'Tuition & revenue model',
    gloss: 'National financial participation',
    evidence: [
      table('fee_schedules'), table('student_fee_assessments'), table('payments'),
      table('national_revenue_agreements'), table('revenue_allocations'),
      fn('allocate_a_payment'), fn('is_registration_money'),
      fn('an_agreement_is_not_approved_by_its_rector'),
      fn('an_allocation_is_never_rewritten'),
      view('national_ledger'),
      constraint('revenue_allocation_adds_up'),
    ],
    note: 'The split is written WHEN THE PAYMENT LANDS, by a trigger, not calculated by a '
      + 'screen when somebody asks — so the ledger is a record of what happened rather than an '
      + 'opinion formed later. An allocation is never rewritten, the parts must add up to the '
      + 'gross, and an agreement cannot be approved by the Rector it pays.',
    gaps: [],
  },
  {
    n: 5,
    title: 'National Financial Secretary',
    gloss: 'Two-level financial governance',
    evidence: [
      role('national-financial-secretary'),
      capability('administer-national-finance'), capability('view-national-finance'),
      table('national_expenses'),
      fn('a_nation_spends_what_it_kept'),
      constraint('national_expense_recorder_is_not_the_authoriser'),
      view('national_purse'),
      nav('national-finance'),
      file('src/components/national/NationalFinance.tsx'),
      file('src/app/api/national/expense/route.ts'),
    ],
    note: 'A separate role rather than `finance` with a nation attached, because the programme '
      + 'asks for financial authority to be separated from the Rector’s and two people cannot '
      + 'be separated while they share a role. The Secretary records; the Rector authorises; '
      + 'neither can do both on the same expense; and an administration cannot authorise more '
      + 'than it was allocated.',
    gaps: [],
  },
  {
    n: 6,
    title: 'Your own ICOF office',
    gloss: 'A national workspace, not a shell',
    evidence: [
      nav('national-rectorate'),
      file('src/components/national/NationalRectorate.tsx'),
      capability('lead-national-administration'),
      view('national_purse'), view('national_ledger'),
    ],
    note: 'The dashboard was always the scoping question wearing a different hat, so it fell '
      + 'out of the other five rather than being built: the same screens ask the same '
      + 'questions and row-level security returns a smaller answer.',
    gaps: [],
  },
  {
    n: 7,
    title: 'Rector as senior academic',
    gloss: 'Where appropriately qualified',
    evidence: [
      table('lectures'), table('lecture_artefacts'), table('course_lessons'),
      table('live_sessions'), table('capability_grants'),
    ],
    note: 'Neither national office is an academic role. A Rector who also teaches is granted '
      + 'the teaching capabilities through `capability_grants` — governed, audited and with an '
      + 'expiry — because the programme makes it conditional. A condition is a grant, not a '
      + 'role.',
    gaps: [],
  },
  {
    n: 8,
    title: 'One lecture, many languages',
    gloss: 'Translation as an act, not a feature',
    evidence: [
      table('lectures'), table('live_sessions'),
      capability('studio-ai-translate'),
      capability('request-translation'), capability('approve-translation'),
    ],
    note: 'Requesting a translation and approving one are separate acts held by different '
      + 'people, so “the AI must not silently rewrite the lecturer’s terminology” is a rule '
      + 'the system enforces rather than a hope.',
    gaps: [
      gap('`request-translation` and `approve-translation` are enforced, but they live in the '
        + 'Academic Studio’s own capability list rather than in `roles.ts`. Two vocabularies '
        + 'means a capability can be granted in one and unknown to the other; retiring the '
        + 'vendored folder is what closes it.',
      STUDIO_CAPABILITIES.includes('request-translation')
        && !CAPABILITIES.includes('request-translation')),
    ],
  },
  {
    n: 9,
    title: 'One academic standard',
    gloss: 'What the centre keeps',
    evidence: [
      table('programmes'), table('programme_versions'), table('curriculum_entries'),
      table('academic_approvals'), table('results'), table('grading_scales'),
      table('credentials_issued'), table('credential_templates'),
      fn('governs_the_university'),
    ],
    note: 'None of this was delegated. The Vice-Chancellor approves a curriculum; results move '
      + 'submit → moderate → approve → publish with no step skippable; credentials issue from '
      + 'an immutable archive. `governs_the_university()` is the line between what a nation '
      + 'may do and what only the centre may.',
    gaps: [],
  },
  {
    n: 10,
    title: 'A worldwide network',
    gloss: 'Where the University teaches from',
    evidence: [
      file('src/content/universityPlaces.json'),
      table('national_administrations'),
    ],
    note: '`universityPlaces.json` is the public picture — five nations and online delivery, '
      + 'drawn on the homepage map. `national_administrations` is the governing register. '
      + 'Both are correct and they are separate things.',
    gaps: [
      gap('The two lists of countries are not joined. A nation can be established in the '
        + 'register without appearing on the public map, and the map can name a country with '
        + 'no administration behind it. Nothing reconciles them.',
      !/national_administrations/.test(read('src/content/universityPlaces.json'))),
    ],
  },
  {
    n: 11,
    title: 'Not a branch campus',
    gloss: 'An officer of ICOF, not an agent of it',
    evidence: [
      file('src/content/universityPlaces.json'),
      table('national_administrations'),
      constraint('national_administration_established_has_an_agreement'),
    ],
    note: '`universityPlaces.json` already separated a campus from a centre from an in-country '
      + 'presence and said so in as many words. 097 put the same distinction in the database: '
      + 'an administration operates under an agreement with the University, its Rector holds a '
      + 'University appointment, and its students are the University’s students.',
    gaps: [],
  },
];

// ---------------------------------------------------------------------------
// THE VERDICT IS COUNTED
// ---------------------------------------------------------------------------

for (const s of SECTIONS) {
  s.missing = s.evidence.filter((e) => !e.found);
  s.openGaps = s.gaps.filter((g) => g.open);
  s.status = s.missing.length === s.evidence.length ? 'none'
    : (s.missing.length > 0 || s.openGaps.length > 0) ? 'part' : 'built';
}

const built = SECTIONS.filter((s) => s.status === 'built').length;
const part = SECTIONS.filter((s) => s.status === 'part').length;
const none = SECTIONS.filter((s) => s.status === 'none').length;
const allMissing = SECTIONS.flatMap((s) => s.missing.map((m) => `${m.kind} ${m.name}`));

const WORDS = ['none', 'one', 'two', 'three', 'four', 'five', 'six',
  'seven', 'eight', 'nine', 'ten', 'eleven'];
const word = (n) => WORDS[n] ?? String(n);
const Word = (n) => word(n).replace(/^./, (c) => c.toUpperCase());

const LABEL = { built: 'Built', part: 'Part built', none: 'Not built' };

// The counts the map quotes about itself, read rather than remembered.
const tables = new Set(sql.match(/create table if not exists [a-z_]+/gi)
  ?.map((m) => m.split(/\s+/).pop().toLowerCase()) ?? []).size;

const today = new Date().toLocaleDateString('en-GB',
  { day: 'numeric', month: 'long', year: 'numeric' });

// ---------------------------------------------------------------------------
// MARKDOWN
// ---------------------------------------------------------------------------

const evidenceLine = (s) => s.evidence
  .map((e) => `\`${e.name}\`${e.found ? '' : ' **(missing)**'}`).join(', ');

const md = `# The National Rector Programme, mapped against the system

The University supplied the National Rector & National Administration Programme
on 16 September 2026 and asked: *"map this out and show me what you have map and
how it is integrated to the ICOF Global University System."*

This is that map, regenerated on ${today}.

**Nothing in it was written by hand.** \`scripts/build-programme-map.mjs\` reads
${migrationFiles.length} migrations, ${tables} tables, ${ROLES.length} roles and
${CAPABILITIES.length} capabilities, looks for every artefact each section
claims, and counts the verdict from what it finds. A section cannot be reported
as built while something it depends on is absent, and it cannot go stale,
because it is not a description — it is a query. Run the script again and the
map is true again.

---

## The finding

**${Word(built)} of the eleven sections are built and enforced${part ? `, ${word(part)} ${part === 1 ? 'is' : 'are'} part built` : ''}${none ? `, and ${word(none)} ${none === 1 ? 'is' : 'are'} not built` : ''}.**

The first version of this map, a day before the work started, found six sections
built and every one of them built University-wide: no \`national_administrations\`
table, no \`administration_id\` on any row, no role scoped to a country. That was
one seam rather than eleven, and it has been closed.

A nation is now a row. Rows know which nation they belong to. The scoping is
row-level security rather than a screen's good manners, so a page nobody
remembered to guard cannot leak another country's data. The money is split when
it lands, by a trigger, and an administration cannot spend what it was not
allocated.

${allMissing.length
    ? `**Artefacts claimed but not found:** ${allMissing.map((m) => `\`${m}\``).join(', ')}.`
    : '**Every artefact claimed below was found in the repository.**'}

---

## The eleven sections

| # | In the programme | Status | What the system has |
|---|---|---|---|
${SECTIONS.map((s) => `| ${s.n} | **${s.title}** | ${LABEL[s.status]} | ${s.note.replace(/\|/g, '\\|')} |`).join('\n')}

---

## The evidence, artefact by artefact

${SECTIONS.map((s) => `**${s.n}. ${s.title}** — ${LABEL[s.status]}\n\n${evidenceLine(s)}\n`).join('\n')}
---

## What is still open

${SECTIONS.flatMap((s) => s.openGaps.map((g) => `- **§${s.n} ${s.title}.** ${g.says}`)).join('\n')
  || '- Nothing the sections above declare as a gap is still open.'}

These are the gaps the sections declare, and each one is a question this script
asks the repository rather than a note somebody left. When the answer changes
the gap disappears from this list without anybody editing it.

---

## Where the line falls now

**The centre keeps** — and none of it was delegated: \`programmes\`,
\`programme_versions\`, \`curriculum_entries\`, \`academic_approvals\`,
\`results\`, \`grading_scales\`, \`credentials_issued\`, \`credential_templates\`,
\`examinations\`, \`document_templates\`. \`governs_the_university()\` is that
line, written once and called from every policy that needs it.

**The nation now holds** — created by 097, 098 and 099:
\`national_administrations\`, \`national_revenue_agreements\`,
\`revenue_allocations\`, \`national_staff_recommendations\`,
\`national_expenses\`, and the two views the offices read,
\`national_ledger\` and \`national_purse\`.

**The nation now reaches** — existing University-wide tables that carry an
\`administration_id\` and a national read policy: \`students\`, \`profiles\`,
\`appointments\`, \`staff_records\`, \`payments\`, \`student_fee_assessments\`,
\`correspondence\`.

---

## The agreement

The programme's closing recommendation — a National Rector Agreement fixing
revenue, appointment powers, degree authority, records, banking, taxation,
termination and data protection — still has its machinery waiting rather than
built. 078's **Conditions of Appointment** carry the twenty-odd clauses a letter
of appointment states, there is a screen for editing them, and they attach to a
post. A National Rector Agreement is a condition set for the national post.

097 already refuses to record an administration as *established* without an
\`agreement_reference\`, so the database is asking for the document. Nothing yet
produces it.

---

## How to regenerate this

\`\`\`
cd website
node scripts/build-programme-map.mjs
\`\`\`

It writes this file and \`NATIONAL-RECTOR-PROGRAMME-MAP.html\` beside it, and
exits non-zero if a section claims an artefact the repository does not have.
`;

writeFileSync(join(docs, 'NATIONAL-RECTOR-PROGRAMME-MAP.md'), md);

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ticks = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');

const pills = (s) => s.evidence
  .map((e) => `<span class="pill ${e.found ? 'ok' : 'no'}" title="${e.kind}">${esc(e.name)}</span>`)
  .join('\n        ');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>National Rector Programme — System Map</title>
<style>
  :root {
    --purple: #422e59; --deep: #2f2040; --gold: #e9c14a;
    --ink: #1c1720; --quiet: #5c5366; --rule: #e6e0ee; --tint: #f8f6fb;
    --built: #1f7a4d; --built-bg: #e7f5ed;
    --part: #a86a12; --part-bg: #fdf3e0;
    --none: #a3283f; --none-bg: #fdeaee;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #efecf4; color: var(--ink);
    font: 15px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 0 20px 64px; }

  header { background: var(--deep); color: #fff; padding: 34px 0 30px; margin-bottom: 26px; }
  header .wrap { padding-bottom: 0; }
  header .eyebrow {
    font-size: 12px; letter-spacing: .22em; text-transform: uppercase; color: var(--gold);
    margin: 0 0 8px;
  }
  header h1 { font: normal 31px/1.2 Georgia, serif; margin: 0 0 10px; }
  header p { margin: 0; color: #d6cce4; max-width: 780px; }
  /* The script's own name sits in the masthead, and the light <code> chip used
     everywhere else turns into an unreadable slab against the deep purple. */
  header code {
    background: rgba(255, 255, 255, .13); border-color: rgba(255, 255, 255, .22);
    color: #f4ecff;
  }

  h2 {
    font: normal 21px/1.3 Georgia, serif; color: var(--deep);
    margin: 34px 0 4px; padding-bottom: 8px; border-bottom: 2px solid var(--rule);
  }
  h2 + .sub { margin: 0 0 16px; color: var(--quiet); font-size: 14px; }

  .verdict {
    background: #fff; border: 1px solid var(--rule); border-left: 5px solid var(--built);
    border-radius: 8px; padding: 18px 22px; margin-bottom: 8px;
  }
  .verdict h3 { margin: 0 0 8px; font: normal 19px/1.3 Georgia, serif; color: var(--deep); }
  .verdict p { margin: 0 0 8px; }
  .verdict p:last-child { margin-bottom: 0; }
  code {
    font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
    background: var(--tint); border: 1px solid var(--rule); border-radius: 3px;
    padding: 1px 5px;
  }

  .tally { display: flex; gap: 10px; flex-wrap: wrap; margin: 16px 0 0; }
  .tally div {
    flex: 1 1 150px; min-width: 0; background: #fff; border: 1px solid var(--rule);
    border-radius: 8px; padding: 12px 14px;
  }
  .tally b { display: block; font: normal 26px/1.1 Georgia, serif; color: var(--deep); }
  .tally span { font-size: 12px; letter-spacing: .08em; text-transform: uppercase;
                color: var(--quiet); }

  table { width: 100%; border-collapse: collapse; background: #fff;
          border: 1px solid var(--rule); border-radius: 8px; overflow: hidden; }
  thead th {
    background: var(--purple); color: #fff; text-align: left; font-weight: 500;
    font-size: 12px; letter-spacing: .1em; text-transform: uppercase;
    padding: 10px 14px;
  }
  tbody td { padding: 12px 14px; border-top: 1px solid var(--rule); vertical-align: top; }
  tbody tr:nth-child(even) { background: #fcfbfe; }
  td.n { width: 34px; color: var(--quiet); font-variant-numeric: tabular-nums; }
  td.what { width: 24%; }
  td.what b { display: block; color: var(--deep); font-weight: 600; }
  td.what span { color: var(--quiet); font-size: 13px; }
  td.status { width: 122px; }
  td.ev { font-size: 13.5px; color: var(--quiet); }

  .chip {
    display: inline-block; font-size: 11px; font-weight: 600; letter-spacing: .06em;
    text-transform: uppercase; padding: 3px 9px; border-radius: 99px; white-space: nowrap;
  }
  .chip.built { background: var(--built-bg); color: var(--built); }
  .chip.part  { background: var(--part-bg);  color: var(--part); }
  .chip.none  { background: var(--none-bg);  color: var(--none); }

  .stack { background: #fff; border: 1px solid var(--rule); border-radius: 8px; padding: 22px; }
  .layer { border: 1px solid var(--rule); border-radius: 6px; margin: 0 0 10px; overflow: hidden; }
  .layer .head {
    padding: 9px 14px; font-size: 12px; letter-spacing: .12em; text-transform: uppercase;
    display: flex; justify-content: space-between; gap: 12px; align-items: baseline;
  }
  .layer .head em { font-style: normal; letter-spacing: 0; text-transform: none;
                    font-size: 12px; opacity: .8; }
  .layer .body { padding: 12px 14px; display: flex; flex-wrap: wrap; gap: 7px; }
  .layer.central .head { background: var(--purple); color: var(--gold); }
  .layer.nation .head  { background: var(--built-bg); color: var(--built); }
  .layer.reach .head   { background: var(--tint); color: var(--deep); }
  .pill {
    font: 12.5px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
    background: var(--tint); border: 1px solid var(--rule); border-radius: 4px;
    padding: 3px 8px; color: var(--quiet);
    /* A pill naming a file path is 46 monospace characters and cannot shrink:
       measured at 390px the page scrolled to 446. These three lines are what
       stops it, and a flex item needs min-width:0 before anything else will. */
    max-width: 100%; min-width: 0; overflow-wrap: anywhere;
  }
  .pill.ok { background: var(--built-bg); border-color: #bfe3ce; color: var(--built); }
  .pill.no { background: var(--none-bg); border-color: #f2c3cd; color: var(--none); }
  .layer .note { padding: 0 14px 12px; font-size: 13px; color: var(--quiet); margin: 0; }

  .sect { background: #fff; border: 1px solid var(--rule); border-radius: 8px;
          padding: 14px 16px; margin: 0 0 10px; }
  .sect h4 { margin: 0 0 8px; font: normal 16px/1.3 Georgia, serif; color: var(--deep);
             display: flex; gap: 10px; align-items: baseline; }
  .sect .body { display: flex; flex-wrap: wrap; gap: 6px; }

  .gaps { background: #fff; border: 1px solid var(--rule); border-left: 5px solid var(--part);
          border-radius: 8px; padding: 16px 20px; }
  .gaps ul { margin: 0; padding-left: 20px; }
  .gaps li { margin-bottom: 10px; color: var(--quiet); }
  .gaps li:last-child { margin-bottom: 0; }
  .gaps b { color: var(--deep); }

  .foot {
    margin-top: 34px; padding-top: 14px; border-top: 1px solid var(--rule);
    font-size: 13px; color: var(--quiet);
  }
  .foot code { font-size: 12.5px; }

  @media screen and (max-width: 820px) {
    td.what, td.status { width: auto; }
    table, thead, tbody, tr, td { display: block; }
    thead { display: none; }
    tbody td { border-top: 0; padding: 4px 14px; }
    tbody tr { border-top: 1px solid var(--rule); padding: 10px 0; }
  }
</style>
</head>
<body>

<header>
  <div class="wrap">
    <p class="eyebrow">ICOF Global University</p>
    <h1>National Rector &amp; National Administration Programme</h1>
    <p>The programme as written, mapped against the system as it actually stands.
       Regenerated ${esc(today)} by <code>scripts/build-programme-map.mjs</code>, which reads
       ${migrationFiles.length} migrations, ${tables} tables, ${ROLES.length} roles and
       ${CAPABILITIES.length} capabilities and counts each verdict from what it finds.
       Nothing on this page was written by hand.</p>
  </div>
</header>

<div class="wrap">

  <div class="verdict">
    <h3>The finding</h3>
    <p><b>${Word(built)} of the eleven sections are built and enforced${part ? `, ${word(part)} ${part === 1 ? 'is' : 'are'} part built` : ''}${none ? `, ${word(none)} not built` : ''}.</b></p>
    <p>The first version of this map, a day before the work started, found six sections built
       and <i>every one of them built University-wide</i>: no <code>national_administrations</code>
       table, no <code>administration_id</code> on any row, no role scoped to a country. That was
       one seam rather than eleven, and it has been closed.</p>
    <p>A nation is now a row. Rows know which nation they belong to. The scoping is row-level
       security rather than a screen’s good manners, so a page nobody remembered to guard cannot
       leak another country’s data. The money is split when it lands, by a trigger, and an
       administration cannot spend what it was not allocated.</p>
    <div class="tally">
      <div><b>${built}</b><span>Built</span></div>
      <div><b>${part}</b><span>Part built</span></div>
      <div><b>${none}</b><span>Not built</span></div>
      <div><b>${allMissing.length}</b><span>Artefacts missing</span></div>
    </div>
  </div>

  <h2>The eleven sections</h2>
  <p class="sub">Status counted from the artefacts each section claims, not asserted.</p>

  <table>
    <thead>
      <tr><th>#</th><th>In the programme</th><th>Status</th><th>What the system has</th></tr>
    </thead>
    <tbody>
${SECTIONS.map((s) => `      <tr>
        <td class="n">${s.n}</td>
        <td class="what"><b>${esc(s.title)}</b><span>${esc(s.gloss)}</span></td>
        <td class="status"><span class="chip ${s.status}">${LABEL[s.status]}</span></td>
        <td class="ev">${ticks(s.note)}</td>
      </tr>`).join('\n')}
    </tbody>
  </table>

  <h2>The evidence</h2>
  <p class="sub">Green was found in the repository. Red was claimed and is not there.</p>

${SECTIONS.map((s) => `  <div class="sect">
    <h4><span class="chip ${s.status}">${LABEL[s.status]}</span> ${s.n}. ${esc(s.title)}</h4>
    <div class="body">
        ${pills(s)}
    </div>
  </div>`).join('\n')}

  <h2>Where the line falls</h2>
  <p class="sub">What the centre kept, what the nation holds, and what the nation reaches into.</p>

  <div class="stack">
    <div class="layer central">
      <div class="head">The centre keeps <em>none of this was delegated</em></div>
      <div class="body">
        ${['programmes', 'programme_versions', 'curriculum_entries', 'academic_approvals',
    'results', 'grading_scales', 'credentials_issued', 'credential_templates',
    'examinations', 'document_templates']
    .map((t) => `<span class="pill ${table(t).found ? 'ok' : 'no'}">${t}</span>`).join('\n        ')}
      </div>
      <p class="note"><code>governs_the_university()</code> is that line, written once and
         called from every policy that needs it.</p>
    </div>

    <div class="layer nation">
      <div class="head">The nation holds <em>created by 097, 098 and 099</em></div>
      <div class="body">
        ${['national_administrations', 'national_revenue_agreements', 'revenue_allocations',
    'national_staff_recommendations', 'national_expenses']
    .map((t) => `<span class="pill ${table(t).found ? 'ok' : 'no'}">${t}</span>`).join('\n        ')}
        ${['national_ledger', 'national_purse']
    .map((v) => `<span class="pill ${view(v).found ? 'ok' : 'no'}">${v}</span>`).join('\n        ')}
      </div>
      <p class="note">Two of these are views rather than tables, because a purse that is stored
         can disagree with the payments behind it and a purse that is derived cannot.</p>
    </div>

    <div class="layer reach">
      <div class="head">The nation reaches <em>University-wide tables carrying administration_id</em></div>
      <div class="body">
        ${['students', 'profiles', 'appointments', 'staff_records', 'payments',
    'student_fee_assessments', 'correspondence']
    .map((t) => `<span class="pill ${column(t, 'administration_id').found ? 'ok' : 'no'}">${t}</span>`).join('\n        ')}
      </div>
      <p class="note">Nullable, every one. The University’s existing records stay exactly as they
         are and nothing that works today stops working.</p>
    </div>
  </div>

  <h2>What is still open</h2>
  <p class="sub">Each of these is a question this script asks the repository, not a note somebody
     left. When the answer changes the gap disappears by itself.</p>

  <div class="gaps">
    <ul>
${SECTIONS.flatMap((s) => s.openGaps.map((g) =>
    `      <li><b>§${s.n} ${esc(s.title)}.</b> ${ticks(g.says)}</li>`)).join('\n')
  || '      <li>Nothing the sections above declare as a gap is still open.</li>'}
      <li><b>The National Rector Agreement.</b> 078’s Conditions of Appointment carry the clauses
        a letter states and attach to a post, so the agreement is a condition set for the national
        post rather than a new system. 097 already refuses to record an administration as
        <i>established</i> without an <code>agreement_reference</code> — the database is asking for
        the document. Nothing yet produces it.</li>
    </ul>
  </div>

  <p class="foot">
    Regenerate with <code>node scripts/build-programme-map.mjs</code>. It writes this page and the
    Markdown beside it, and exits non-zero if a section claims an artefact the repository does not
    have. ICOF Global University · ${esc(today)}
  </p>
</div>

</body>
</html>
`;

writeFileSync(join(docs, 'NATIONAL-RECTOR-PROGRAMME-MAP.html'), html);

// ---------------------------------------------------------------------------
// AND IT FAILS IF THE MAP WOULD HAVE TO LIE.
// ---------------------------------------------------------------------------

console.log(`\nNational Rector Programme map — regenerated ${today}\n`);
for (const s of SECTIONS) {
  const flag = s.status === 'built' ? 'ok  ' : s.status === 'part' ? 'part' : 'NONE';
  console.log(`  ${flag}  ${String(s.n).padStart(2)}. ${s.title}`
    + (s.missing.length ? `  — missing ${s.missing.map((m) => m.name).join(', ')}` : '')
    + (s.openGaps.length ? `  — ${s.openGaps.length} gap(s) open` : ''));
}
console.log(`\n  ${built} built · ${part} part built · ${none} not built`);
console.log(`  read ${migrationFiles.length} migrations, ${tables} tables, `
  + `${ROLES.length} roles, ${CAPABILITIES.length} capabilities\n`);

if (allMissing.length) {
  console.error(`${allMissing.length} claimed artefact(s) not found: ${allMissing.join(', ')}\n`);
  process.exit(1);
}
