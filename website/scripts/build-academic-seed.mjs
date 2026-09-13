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

// ---------------------------------------------------------------------------
// EVERY LEVEL IS NOW RULED, AND 27 BLANKS BECAME 41 NUMBERS.
//
// This list held three entries and the other 27 programmes were published as
// "One to two academic years" — a range, not a length, so no version could be
// seeded for them. The University has since ruled: "Diploma is 1 year. Masters
// is 2years."
//
// A Postgraduate Diploma is still absent, deliberately: no programme in the
// catalogue carries that award, so there is nothing to give a length to and
// nothing to guess.
// ---------------------------------------------------------------------------
const YEARS = { Certificate: 1, Diploma: 1, "Bachelor's": 3, "Master's": 2, Doctorate: 2 };
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
w('  -- NO CURRICULUM WAS INVENTED BY THIS FILE. Deliberately scoped to what');
w('  -- THIS migration created: 061 seeds a version per programme from the');
w('  -- durations the University has since ruled, so a blanket "no versions');
w('  -- exist" would be a proof that passes only until the next migration runs —');
w('  -- which is how 045 collided with 055.');
w('  select count(*) into n from curriculum_entries;');
w('  if n > 0 then');
w("    raise exception '060 FAILED: % curriculum entries exist — a curriculum was invented', n;");
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
w(needDuration.length === 0
  ? '-- EVERY LEVEL HAS A RULED LENGTH. 061 gives each programme a version.'
  : '-- AND WHAT THE UNIVERSITY STILL HAS TO STATE.');
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

// ---------------------------------------------------------------------------
// 061 — A VERSION PER PROGRAMME.
//
// Separate from 060 because 060 has already been handed to the University and
// may already have been run. A file somebody has run is not edited; a new one
// is added beside it. That is the lesson of the programmes_code_check failure,
// applied before it happens rather than after.
// ---------------------------------------------------------------------------
if (needDuration.length === 0) {
  const v = [];
  const x = (t = '') => v.push(t);
  x('-- ===========================================================================');
  x('-- 061 — A VERSION FOR EVERY PROGRAMME');
  x('-- ===========================================================================');
  x('--');
  x('-- GENERATED FILE. DO NOT EDIT.');
  x('--   Generator: scripts/build-academic-seed.mjs');
  x('--');
  x('-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS');
  x('--');
  x(`-- EVERY ONE OF THE ${programmes.length} PROGRAMMES GETS A CURRICULUM VERSION to hang`);
  x('-- a curriculum from. 060 could not: 27 of them were published as "One to two');
  x('-- academic years", and a range is not a length. The University has since');
  x('-- ruled every level — Certificate one, Diploma one, Bachelor\'s three,');
  x("-- Master's two, Doctorate two — so `duration_years` can hold a number for");
  x('-- all of them.');
  x('--');
  x('-- EVERY VERSION IS A DRAFT, AND NONE HAS A SINGLE COURSE IN IT. A version');
  x('-- becomes real when the Vice-Chancellor approves it (058) and it cannot be');
  x('-- approved while its curriculum is empty of the credits it claims. This');
  x('-- builds the shelf; the University fills it.');
  x('--');
  x('-- THE LABEL IS THE ACADEMIC YEAR, and the effective date is the day that');
  x('-- year opens — 15 August, from 059. Nothing here is chosen: the version is');
  x('-- named after the year it takes effect in, which is how a student admitted');
  x('-- in 2026/2027 is later known to be reading the 2026/2027 curriculum.');
  x('-- ===========================================================================');
  x();
  x('do $$');
  x('declare');
  x('  y_label text;');
  x('  y_start date;');
  x('  p_id    uuid;');
  x('  s_id    uuid;');
  x('begin');
  x('  -- THE ACADEMIC YEAR IN FORCE, asked of the calendar rather than assumed.');
  x("  select label, starts_on into y_label, y_start from academic_years where status = 'current';");
  x('  if y_label is null then');
  x('    raise exception');
  x("      'No academic year is current, so a version cannot be dated. 059 sets one from the "
    + "date; run it first.'");
  x("      using errcode = 'no_data_found';");
  x('  end if;');
  x();
  for (const p of programmes) {
    x(`  select id into p_id from programmes where code = ${q(p.code)};`);
    x(`  select id into s_id from schools where code = ${q(p.school)};`);
    x('  insert into programme_versions');
    x('    (programme_id, version_label, name, school_id, duration_years,');
    x('     semesters_per_year, total_credits, effective_from, status)');
    x(`  values (p_id, y_label, ${q(p.title)}, s_id, ${YEARS[p.award]},`);
    x(`          2, ${p.credits ?? 'null'}, y_start, 'draft')`);
    x('  on conflict (programme_id, version_label) do nothing;');
    x();
  }
  x('end $$;');
  x();
  x();
  x('-- ===========================================================================');
  x('-- PROVE IT');
  x('-- ===========================================================================');
  x();
  x('do $$');
  x('declare n integer; bad integer;');
  x('begin');
  x('  select count(*) into n from programme_versions;');
  x(`  if n < ${programmes.length} then`);
  x(`    raise exception '061 FAILED: % versions, expected at least ${programmes.length}', n;`);
  x('  end if;');
  x();
  x('  -- EVERY PROGRAMME HAS ONE. A count alone passes if one programme has two.');
  x('  select count(*) into bad from programmes p');
  x('   where not exists (select 1 from programme_versions v where v.programme_id = p.id);');
  x('  if bad > 0 then');
  x("    raise exception '061 FAILED: % programmes still have no version', bad;");
  x('  end if;');
  x();
  x('  -- AND NOT ONE IS PUBLISHED. A version published here would have skipped');
  x('  -- the Vice-Chancellor, which is the whole of 058.');
  x("  select count(*) into bad from programme_versions where status <> 'draft';");
  x('  if bad > 0 then');
  x("    raise exception '061 FAILED: % versions are not drafts — the seed approved a "
    + "curriculum', bad;");
  x('  end if;');
  x();
  x('  -- THE RULED LENGTHS, READ BACK. Not a spot check: every level at once.');
  x('  select count(*) into bad from programme_versions v');
  x('    join programmes p on p.id = v.programme_id');
  x('   where v.duration_years <> case p.award_level');
  for (const [award, years] of Object.entries(YEARS)) {
    x(`           when ${q(award)} then ${years}`);
  }
  x('           else v.duration_years end;');
  x('  if bad > 0 then');
  x("    raise exception '061 FAILED: % versions disagree with the ruled length for their "
    + "award', bad;");
  x('  end if;');
  x();
  x(`  raise notice '061 OK: all ${programmes.length} programmes have a version, every one a `
    + `draft with no courses in it';`);
  x("  raise notice '061 OK: every duration matches the length the University ruled for its "
    + "award level';");
  x('end $$;');
  x();
  x();
  x('-- ===========================================================================');
  x('-- VERIFY — READ THIS OUTPUT');
  x('-- ===========================================================================');
  x();
  x('-- ---------------------------------------------------------------------------');
  x('-- EVERY PROGRAMME, ITS LENGTH AND WHAT ITS CURRICULUM ADDS UP TO SO FAR.');
  x('-- `credits_in_curriculum` is 0 for all of them: the shelf is built and empty.');
  x('-- The gap against `total_credits` is the Curriculum Builder\'s work.');
  x('-- ---------------------------------------------------------------------------');
  x('select p.award_level,');
  x('       count(*)                                              as programmes,');
  x('       min(v.duration_years)                                 as years,');
  x('       count(*) filter (where v.total_credits is not null)   as with_a_credit_total,');
  x("       count(*) filter (where v.status = 'draft')            as drafts");
  x('  from programmes p');
  x('  join programme_versions v on v.programme_id = p.id');
  x('  group by p.award_level order by p.award_level;');
  x();
  writeFileSync(join(root, 'docs/migrations/061_a_version_for_every_programme.sql'), v.join('\n'));
  console.log('docs/migrations/061_a_version_for_every_programme.sql');
}
console.log(`docs/migrations/060_the_schools_and_programmes.sql`);
console.log(`  ${schools.length} schools, ${programmes.length} programmes`);
console.log(`  ${needDuration.length} programmes have no stated duration`);
