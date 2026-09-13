// ---------------------------------------------------------------------------
// GENERATE THE SEED FOR THE ACADEMIC REGISTER.
//
//   node scripts/build-academic-seed.mjs
//   -> docs/migrations/060_the_schools_and_programmes.sql
//
// ===========================================================================
// WHY THIS IS GENERATED AND NOT TYPED
// ===========================================================================
//
// Forty-one programmes and five schools is four hundred lines of INSERT, and a
// typed one is a transcription exercise with forty-one chances to get a title
// wrong. Worse, it goes stale silently: the catalogue on the website changes,
// the seed does not, and the register quietly describes a University that no
// longer exists.
//
// This reads src/content/programmeCatalogue.ts — the same file the public site
// renders — and writes the migration from it. Re-running it after a catalogue
// change produces the new seed, and `git diff` shows exactly what moved.
//
// ===========================================================================
// WHAT IT WILL NOT DO
// ===========================================================================
//
// IT SEEDS NO PROGRAMME VERSION. A version needs `duration_years`, and the
// catalogue publishes prose: "Three academic years" for a bachelor's, which the
// University has ruled, but "One to two academic years" for a master's and for
// a diploma — which is a RANGE, not a duration. Writing 1 or 2 there would be
// inventing the length of eighteen programmes.
//
// So programmes arrive with their identity and no curriculum, and the file ends
// by listing what the University still has to state. That list is the work, and
// it is better on screen than guessed at in a column.
//
// IT OPENS NOTHING. Every programme is seeded 'draft'. Migration 023 ruled that
// admission is opt-in — a programme accepts applications because somebody
// decided it should — and 057 refuses to open one that has no published
// curriculum anyway.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const cache = join(root, 'node_modules/.cache/icof');
mkdirSync(cache, { recursive: true });

const bundle = join(cache, 'academic-seed.mjs');
execFileSync('npx', [
  'esbuild', join(root, 'src/content/programmeCatalogue.ts'),
  '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`,
  '--log-level=error', `--alias:@=${join(root, 'src')}`,
]);
const { ALL_PROGRAMMES, FACULTIES } = await import(bundle);

// ---------------------------------------------------------------------------
// THE FIVE SCHOOLS, AND WHY FIVE.
//
// Two lists of faculties exist in this repository and they disagree.
// `faculties.ts` has SIX (it splits the School of Ministry into Buea and
// Douala); `programmeCatalogue.ts` has FIVE and is the one every programme
// actually points at.
//
// The University settles it on its own About page, in src/content/pages.ts:
//
//   "Five schools and faculties carry the university's teaching mission: the
//    Faculty of Theology in Buea, the School of Ministry in Douala, the Faculty
//    of Education, the Faculty of Engineering and Technology, and the Global
//    Institute of Business and Management Science (GIBMAS)"
//
// Five, named. So the codes come from the catalogue — keeping every programme's
// link intact — and the NAMES come from what the University publishes.
//
// That last point matters for one of them. programmeCatalogue.ts calls the
// business faculty "Faculty of Business Management Science and Administration",
// a name that appears nowhere else and that the About page contradicts. The
// published name is used and the discrepancy is reported rather than silently
// preferred.
// ---------------------------------------------------------------------------
const PUBLISHED_NAME = {
  theology: 'Faculty of Theology',
  ministry: 'School of Ministry',
  education: 'Faculty of Education',
  engineering: 'Faculty of Engineering and Technology',
  business: 'Global Institute of Business and Management Science',
};

const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

const schools = FACULTIES.map((f) => ({
  code: f.id,
  name: PUBLISHED_NAME[f.id] ?? f.name,
  renamed: (PUBLISHED_NAME[f.id] ?? f.name) !== f.name ? f.name : null,
  mission: f.mission ?? null,
}));

const unknown = FACULTIES.filter((f) => !PUBLISHED_NAME[f.id]);
if (unknown.length > 0) {
  console.error(
    `\nRefusing to build: ${unknown.map((f) => f.id).join(', ')} is not one of the five schools\n`
    + 'the University publishes on its About page. Either the catalogue has gained a faculty the\n'
    + 'University has not announced, or PUBLISHED_NAME in this script is out of date. Settle it\n'
    + 'before seeding — a school nobody has stated is exactly the kind of invention the seed\n'
    + 'must not carry.\n',
  );
  process.exit(1);
}

const programmes = ALL_PROGRAMMES.map((p) => ({
  code: p.slug,
  title: p.title,
  award: p.award,
  school: p.facultyId,
  duration: p.duration ?? null,
  credits: p.credits ?? null,
}));

// WHAT CANNOT BE TURNED INTO A NUMBER. Only the durations the University has
// RULED are unambiguous; a published range is not a duration.
const YEARS = { "Bachelor's": 3, Doctorate: 2, Certificate: 1 };
const needDuration = programmes.filter((p) => !YEARS[p.award]);

const lines = [];
const w = (s = '') => lines.push(s);

w('-- ===========================================================================');
w('-- 060 — THE SCHOOLS AND PROGRAMMES');
w('-- ===========================================================================');
w('--');
w('-- GENERATED FILE. DO NOT EDIT.');
w('--   Generator: scripts/build-academic-seed.mjs');
w('--   Source:    src/content/programmeCatalogue.ts');
w('--');
w('-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS');
w('--');
w(`-- THE REGISTER STOPS BEING EMPTY. ${schools.length} schools and ${programmes.length} programmes`);
w('-- become rows, moved out of the TypeScript the website compiles them from and');
w('-- into tables the Superadministrator can manage.');
w('--');
w('-- NOTHING IS OPENED. Every programme arrives as a draft. 023 ruled that');
w('-- admission is opt-in, and 057 refuses to open a programme with no published');
w('-- curriculum in any case.');
w('--');
w('-- NO CURRICULUM IS SEEDED, and no duration. See the closing report: the');
w(`-- University has ruled the length of ${programmes.length - needDuration.length} of these`);
w(`-- ${programmes.length} programmes and published a RANGE for the other ${needDuration.length}.`);
w('-- "One to two academic years" is not a duration, and writing 1 or 2 into');
w('-- `duration_years` would be inventing the length of a degree.');
w('-- ===========================================================================');
w();
w();
w('-- ===========================================================================');
w('-- 1. THE SCHOOLS');
w('-- ===========================================================================');
w('--');
w('-- Five, as the University publishes on its About page. `faculties.ts` lists');
w('-- six because it separates the School of Ministry at Douala; the About page');
w('-- names five and that is what is seeded.');
w();
for (const s of schools) {
  if (s.renamed) {
    w(`-- PUBLISHED NAME, not the catalogue's. programmeCatalogue.ts calls this`);
    w(`-- "${s.renamed}", which appears nowhere else and which the About page`);
    w('-- contradicts.');
  }
  w('insert into schools (code, name, mission, status)');
  w(`values (${q(s.code)}, ${q(s.name)}, ${q(s.mission)}, 'active')`);
  w('on conflict (code) do nothing;');
  w();
}

w();
w('-- ===========================================================================');
w('-- 2. THE PROGRAMMES');
w('-- ===========================================================================');
w('--');
w('-- The code is the slug the site already uses in every programme URL and in');
w('-- `courses.programme_slug`, so the register joins to both without');
w('-- translation. Nothing here is abbreviated or invented.');
w('--');
w("-- `status` is 'draft' for every one of them. Opening a programme for");
w('-- admission is a decision, and 057 will refuse it until a curriculum has');
w('-- been approved.');
w();
w('do $$');
w('declare');
w('  s_id uuid;');
w('begin');
for (const p of programmes) {
  w(`  select id into s_id from schools where code = ${q(p.school)};`);
  w('  insert into programmes (code, award_level, status)');
  w(`  values (${q(p.code)}, ${q(p.award)}, 'draft')`);
  w('  on conflict (code) do nothing;');
  w(`  -- ${p.title}${p.credits ? ` · ${p.credits} credits` : ''} · ${p.duration ?? 'no duration published'}`);
  w();
}
w('end $$;');
w();
w();
w('-- ===========================================================================');
w('-- 3. PROVE IT');
w('-- ===========================================================================');
w();
w('do $$');
w('declare');
w('  n integer;');
w('begin');
w('  select count(*) into n from schools;');
w(`  if n < ${schools.length} then`);
w(`    raise exception '060 FAILED: % schools seeded, expected at least ${schools.length}', n;`);
w('  end if;');
w();
w('  select count(*) into n from programmes;');
w(`  if n < ${programmes.length} then`);
w(`    raise exception '060 FAILED: % programmes seeded, expected at least ${programmes.length}', n;`);
w('  end if;');
w();
w('  -- THE FIVE SCHOOLS BY NAME. A count alone passes if the right number of');
w('  -- wrong rows is there, and the About page names these five specifically.');
w('  select count(*) into n from schools');
w(`   where code in (${schools.map((s) => q(s.code)).join(', ')});`);
w(`  if n <> ${schools.length} then`);
w(`    raise exception '060 FAILED: % of the ${schools.length} published schools are present', n;`);
w('  end if;');
w();
w('  -- NOTHING IS OPEN. The check that matters: a seed that quietly advertised');
w('  -- forty-one programmes to applicants would be the single most damaging');
w('  -- thing this file could do.');
w("  select count(*) into n from programmes where status <> 'draft';");
w('  if n > 0 then');
w("    raise exception '060 FAILED: % programmes are not drafts — the seed opened "
  + "something for admission', n;");
w('  end if;');
w();
w('  -- AND NO CURRICULUM WAS INVENTED.');
w('  select count(*) into n from programme_versions;');
w('  if n > 0 then');
w("    raise exception '060 FAILED: % programme versions exist — a duration was invented', n;");
w('  end if;');
w();
w(`  raise notice '060 OK: ${schools.length} schools and ${programmes.length} programmes are in `
  + `the register, every one a draft';`);
w(`  raise notice '060 OK: no curriculum and no duration was seeded — the University has `
  + `published a range, not a length, for ${needDuration.length} of them';`);
w('end $$;');
w();
w();
w('-- ===========================================================================');
w('-- 4. VERIFY — READ THIS OUTPUT');
w('-- ===========================================================================');
w();
w('-- ---------------------------------------------------------------------------');
w('-- THE REGISTER. Five schools, forty-one programmes, none open.');
w('-- ---------------------------------------------------------------------------');
w('select s.name as school,');
w('       count(p.id) as programmes,');
w("       count(*) filter (where p.status = 'open_for_admission') as open_for_admission");
w('  from schools s');
w('  left join programmes p on true');
w('  group by s.name order by s.name;');
w();
w('-- ---------------------------------------------------------------------------');
w('-- AND WHAT THE UNIVERSITY STILL HAS TO STATE.');
w('--');
w(`-- ${needDuration.length} of ${programmes.length} programmes have no length this system can `
  + 'record,');
w('-- because what is published is a range. Each needs a duration before a');
w('-- curriculum can be built for it:');
w('--');
for (const p of needDuration) {
  w(`--   ${p.code.padEnd(42)} ${p.award.padEnd(12)} published: ${p.duration ?? '—'}`);
}
w('--');
w('-- The three the University HAS ruled — Bachelor\'s three years, Doctorate two,');
w('-- Certificate up to one — need no further statement.');
w('-- ---------------------------------------------------------------------------');
w('select award_level, count(*) as programmes');
w('  from programmes group by award_level order by award_level;');
w();

const out = join(root, 'docs/migrations/060_the_schools_and_programmes.sql');
writeFileSync(out, lines.join('\n'));
console.log(`docs/migrations/060_the_schools_and_programmes.sql`);
console.log(`  ${schools.length} schools, ${programmes.length} programmes`);
console.log(`  ${needDuration.length} programmes have no stated duration`);
