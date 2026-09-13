// ---------------------------------------------------------------------------
// MOVE THE CURRICULA THE UNIVERSITY HAS ALREADY WRITTEN INTO ROWS.
//
//   node scripts/build-curriculum-seed.mjs
//   -> docs/migrations/062_the_curricula_already_written.sql
//
// ===========================================================================
// WHAT MOVES, AND WHAT DOES NOT
// ===========================================================================
//
// Three curricula exist in src/content/. Two are complete and move; one cannot
// and is reported instead.
//
//   Bachelor of Theology   36 courses · 3 years · 6 semesters · 180 credits
//   Bachelor of Ministry   34 courses · 3 years · 6 semesters · 180 credits
//   Diploma of Theology    15 courses · 1 year  · 2 semesters · NO CREDITS
//
// THE DIPLOMA MOVES TOO, ON THE UNIVERSITY'S INSTRUCTION: "affix edited credit
// value to the diploma and move." It had been held back for two reasons and
// both are now answered — but how they were answered matters, so both are
// written down here rather than buried in the SQL.
//
//   ITS COURSES CARRY NO CREDIT VALUE, and `courses.credit_unit` is NOT NULL
//   and defaults to 3 — so letting the default stand would have written 3
//   against every one and produced a curriculum of 45 credits against a
//   programme the University has ruled at 120. A number nobody stated,
//   arriving through a column default, is the worst kind of invention: it
//   looks like data.
//
//   SO THE CREDIT IS DERIVED, NOT GUESSED. The University has ruled the award
//   at 120 credits and written 15 courses into it. 120 / 15 is 8 exactly, and
//   the curriculum then adds up to precisely what the programme claims rather
//   than near it. The even division is the assumption — that these fifteen
//   carry equal weight — and it is the only distribution that is not arbitrary.
//   A file with an exact remainder is the only one this generator will do it
//   for; anything else is held back.
//
//   AND ITS NAME MATCHES NO PROGRAMME EXACTLY. The curriculum says "Diploma OF
//   Theology"; the catalogue publishes "Diploma IN Theology". They are the same
//   award and the University has now said to move it, so the match is made —
//   declared in BY_NAME below rather than done by fuzzy matching, so that the
//   one place it happens is visible.
//
// ===========================================================================
// WHAT IS NOT DECIDED HERE
// ===========================================================================
//
// EVERY ENTRY IS CORE, because neither source marks anything elective. That is
// what the curricula say, not a judgement about what they should say.
//
// NOTHING IS APPROVED. The entries attach to the DRAFT version 061 created, and
// a draft is where they stay until the Vice-Chancellor approves it. 057 freezes
// a curriculum on approval, so this seeding could not have run afterwards.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const cache = join(root, 'node_modules/.cache/icof');
mkdirSync(cache, { recursive: true });

function load(file, name) {
  const out = join(cache, `${name}.mjs`);
  execFileSync('npx', [
    'esbuild', join(root, file), '--bundle', '--format=esm', '--platform=node',
    `--outfile=${out}`, '--log-level=error', `--alias:@=${join(root, 'src')}`,
  ]);
  return import(out);
}

const courses = await load('src/content/programmeCourses.ts', 'curr-courses');
const catalogue = await load('src/content/programmeCatalogue.ts', 'curr-catalogue');

const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

// THE CREDIT SYSTEM each curriculum counts in. `courses.credit_system` accepts
// 'ECTS' or 'credit_hour'; the B.Th. file says "credit hours" in prose.
const SYSTEM = {
  'Bachelor of Theology': 'credit_hour',
  'Bachelor of Ministry': 'ECTS',
  'Diploma of Theology': 'credit_hour',
};

// WHERE A CURRICULUM'S NAME IS NOT THE CATALOGUE'S. One entry, stated rather
// than inferred: a generator that matched programme names loosely would
// silently attach a curriculum to the wrong award the first time two titles
// resembled each other.
const BY_NAME = {
  'Diploma of Theology': 'diploma-in-theology',
};

const moving = [];
const held = [];

for (const name of courses.programmesWithCourses()) {
  const { courses: list } = courses.coursesForProgramme(name);
  const programme = BY_NAME[name]
    ? catalogue.ALL_PROGRAMMES.find((p) => p.slug === BY_NAME[name])
    : catalogue.ALL_PROGRAMMES.find((p) => p.title === name);
  const missingCredit = list.filter((c) => !c.credits);

  if (!programme) {
    held.push({ name, list, noProgramme: true, missingCredit: missingCredit.length });
    continue;
  }

  // ---------------------------------------------------------------------
  // THE CREDIT, WHERE THE UNIVERSITY WROTE COURSES AND NOT VALUES.
  //
  // Only from the programme's own PUBLISHED total, and only when it divides
  // exactly. 120 over 15 courses is 8; 120 over 16 would be 7.5, and a
  // rounded 8 would make the curriculum add to 128 against a programme
  // claiming 120 — a discrepancy nobody would notice until a student was
  // eight credits short of graduating.
  // ---------------------------------------------------------------------
  let derived = null;
  if (missingCredit.length === list.length && programme.credits) {
    const each = programme.credits / list.length;
    if (Number.isInteger(each)) derived = each;
  }

  if (missingCredit.length > 0 && derived === null) {
    held.push({ name, list, noProgramme: false, missingCredit: missingCredit.length,
      published: programme.credits ?? null });
    continue;
  }

  const priced = list.map((c) => ({ ...c, credits: c.credits ?? derived }));
  moving.push({
    name,
    slug: programme.slug,
    list: priced,
    derived,
    published: programme.credits ?? null,
    system: SYSTEM[name] ?? 'credit_hour',
    credits: priced.reduce((t, c) => t + c.credits, 0),
    years: new Set(priced.map((c) => c.year)).size,
    semesters: new Set(priced.map((c) => `${c.year}.${c.semester}`)).size,
  });
}

const lines = [];
const w = (s = '') => lines.push(s);

w('-- ===========================================================================');
w('-- 062 — THE CURRICULA THE UNIVERSITY HAS ALREADY WRITTEN');
w('-- ===========================================================================');
w('--');
w('-- GENERATED FILE. DO NOT EDIT.');
w('--   Generator: scripts/build-curriculum-seed.mjs');
w('--   Source:    src/content/programmeCourses.ts');
w('--');
w('-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS');
w('--');
w(`-- ${moving.length} PROGRAMMES GET A REAL CURRICULUM — course by course, placed in the`);
w('-- year and semester the University wrote them into:');
w('--');
for (const m of moving) {
  w(`--   ${m.name.padEnd(24)} ${String(m.list.length).padStart(2)} courses · `
    + `${m.years} years · ${m.semesters} semesters · ${m.credits} credits`
    + (m.derived ? `  (credit DERIVED: ${m.published} / ${m.list.length} = ${m.derived} each)` : ''));
}
w('--');
w('-- 061 built the shelf. This is the first thing on it, and it is the first');
w('-- curriculum in this system that can be counted rather than read.');
w('--');
w('-- THE ENTRIES ATTACH TO A DRAFT VERSION and stay there. A curriculum becomes');
w('-- the University\'s when the Vice-Chancellor approves it (058); 057 freezes it');
w('-- at that moment, so this seeding could not have run afterwards.');
w('--');
if (held.length > 0) {
  w('-- ---------------------------------------------------------------------------');
  w('-- AND ONE IS HELD BACK. See the report at the foot of this file.');
  w('-- ---------------------------------------------------------------------------');
  w('--');
}
w('-- ===========================================================================');
w();

// ---------------------------------------------------------------------------
w('-- ===========================================================================');
w('-- 1. THE COURSES THEMSELVES');
w('-- ===========================================================================');
w('--');
w('-- Most of these are not rows yet. `courses.credit_unit` is NOT NULL and');
w('-- defaults to 3, so every insert below states the credit explicitly — a');
w('-- default silently standing in for a value nobody wrote is how a curriculum');
w('-- ends up adding to the wrong number.');
w();
const seen = new Set();
for (const m of moving) {
  w(`-- ${m.name}`);
  if (m.derived) {
    w(`-- EVERY CREDIT BELOW IS ${m.derived}, AND NOT ONE OF THEM WAS WRITTEN BY THE`);
    w(`-- UNIVERSITY. The award is ruled at ${m.published} credits and ${m.list.length} courses`);
    w(`-- are named for it; ${m.published} / ${m.list.length} is ${m.derived} exactly. The`);
    w('-- assumption is that these carry equal weight. Where they do not, edit the');
    w('-- entry credits in the Curriculum Builder — the total is checked against the');
    w("-- programme's own figure on every change, so an uneven split still has to");
    w(`-- add to ${m.published}.`);
  }
  for (const c of m.list) {
    if (seen.has(c.code)) continue;
    seen.add(c.code);
    w('insert into courses (code, title, credit_unit, credit_system)');
    w(`values (${q(c.code)}, ${q(c.title)}, ${c.credits}, ${q(m.system)})`);
    w('on conflict (code) do nothing;');
  }
  w();
}

// ---------------------------------------------------------------------------
w();
w('-- ===========================================================================');
w('-- 2. AND WHERE EACH ONE SITS');
w('-- ===========================================================================');
w('--');
w('-- Year, semester and requirement belong HERE and not on the course — the');
w('-- same course may sit differently in another programme, which is the whole');
w('-- reason 057 put them on the entry.');
w('--');
w('-- Every entry is `core`: neither curriculum marks anything elective, and');
w('-- inventing an elective would change what a student must pass.');
w();
w('do $$');
w('declare');
w('  v_id uuid;');
w('  c_id uuid;');
w('begin');
for (const m of moving) {
  w(`  -- ---- ${m.name} ----`);
  w('  select v.id into v_id from programme_versions v');
  w('    join programmes p on p.id = v.programme_id');
  w(`   where p.code = ${q(m.slug)} order by v.effective_from desc limit 1;`);
  w('  if v_id is null then');
  w(`    raise exception 'No version of ${m.slug} exists. 061 creates one; run it first.'`);
  w("      using errcode = 'no_data_found';");
  w('  end if;');
  w();
  for (const c of m.list) {
    w(`  select id into c_id from courses where code = ${q(c.code)};`);
    w('  insert into curriculum_entries');
    w('    (programme_version_id, course_id, year, semester, requirement, credits)');
    w(`  values (v_id, c_id, ${c.year}, ${c.semester}, 'core', ${c.credits})`);
    w('  on conflict (programme_version_id, course_id) do nothing;');
  }
  w();
}
w('end $$;');
w();

// ---------------------------------------------------------------------------
w();
w('-- ===========================================================================');
w('-- 3. WHAT A CURRICULUM ADDS UP TO, DRAFT OR NOT');
w('-- ===========================================================================');
w('--');
w('-- `programme_in_force` answers "what is this programme" and joins only the');
w('-- PUBLISHED version — right for a prospectus, useless for the Curriculum');
w('-- Builder, which works on a DRAFT and needs its running total on every edit.');
w('--');
w('-- A draft is the only time the total matters. Once a version is published it');
w('-- is frozen and its arithmetic cannot change; while it is a draft the gap');
w('-- between what the courses add to and what the programme claims IS the work');
w('-- remaining, and it is what the Academic Dashboard means by');
w('-- "programme/curriculum issues".');
w();
w('create or replace view curriculum_progress');
w('with (security_invoker = true) as');
w('select v.id                as version_id,');
w('       v.programme_id,');
w('       p.code,');
w('       p.award_level,');
w('       v.version_label,');
w('       v.status,');
w('       v.duration_years,');
w('       v.semesters_per_year,');
w('       v.total_credits,');
w('       (select count(*) from curriculum_entries e');
w('         where e.programme_version_id = v.id)            as courses_in_curriculum,');
w('       (select coalesce(sum(coalesce(e.credits, c.credit_unit)), 0)');
w('          from curriculum_entries e join courses c on c.id = e.course_id');
w('         where e.programme_version_id = v.id)            as credits_in_curriculum,');
w('       -- THE GAP, SIGNED. Negative is short, positive is over, zero is done.');
w('       (select coalesce(sum(coalesce(e.credits, c.credit_unit)), 0)');
w('          from curriculum_entries e join courses c on c.id = e.course_id');
w('         where e.programme_version_id = v.id) - coalesce(v.total_credits, 0)');
w('                                                        as credits_against_claim,');
w('       -- AND WHETHER EVERY TERM THE PROGRAMME RUNS HAS ANYTHING IN IT. A');
w('       -- curriculum can add to exactly 180 and still have an empty semester.');
w('       (select count(distinct (e.year, e.semester)) from curriculum_entries e');
w('         where e.programme_version_id = v.id)            as terms_with_courses,');
w('       v.duration_years * v.semesters_per_year           as terms_expected');
w('  from programme_versions v');
w('  join programmes p on p.id = v.programme_id;');
w();
w('comment on view curriculum_progress is');
w("  'Every programme version, published or draft, with what its curriculum actually adds up to '");
w("  'against what the programme claims. `programme_in_force` shows only published versions; the '");
w("  'Curriculum Builder works on drafts, which is the only time the total can still change.';");
w();
w();
w('-- ===========================================================================');
w('-- 4. PROVE IT');
w('-- ===========================================================================');
w();
w('do $$');
w('declare n integer; total integer;');
w('begin');
for (const m of moving) {
  w(`  -- ${m.name}: ${m.list.length} courses, ${m.credits} credits`);
  w('  select count(*), coalesce(sum(e.credits), 0) into n, total');
  w('    from curriculum_entries e');
  w('    join programme_versions v on v.id = e.programme_version_id');
  w('    join programmes p on p.id = v.programme_id');
  w(`   where p.code = ${q(m.slug)};`);
  w(`  if n <> ${m.list.length} then`);
  w(`    raise exception '062 FAILED: ${m.slug} has % entries, expected ${m.list.length}', n;`);
  w('  end if;');
  w(`  if total <> ${m.credits} then`);
  w(`    raise exception '062 FAILED: ${m.slug} adds up to %, not ${m.credits}', total;`);
  w('  end if;');
  w();
}
w('  -- THE CURRICULUM MATCHES WHAT THE PROGRAMME CLAIMS. This is the check the');
w('  -- Curriculum Builder will make on every edit, made once here: a version');
w('  -- claiming 180 credits whose courses add to 174 is a curriculum nobody can');
w('  -- graduate from, and it would be found by a student rather than by this.');
w('  --');
w('  -- READ FROM `curriculum_progress`, NOT `programme_in_force`. This check was');
w('  -- written against the latter and PASSED WITHOUT TESTING ANYTHING: that view');
w('  -- joins only PUBLISHED versions, every version here is a draft, so it');
w('  -- returned no rows and the count was 0. A proof that cannot see the thing');
w('  -- it is checking always passes. Section 5 adds the view that can.');
w('  select count(*) into n from curriculum_progress');
w('   where courses_in_curriculum > 0');
w('     and total_credits is not null');
w('     and credits_in_curriculum <> total_credits;');
w('  if n > 0 then');
w("    raise exception '062 FAILED: % curricula do not add up to what their programme "
  + "claims', n;");
w('  end if;');
w();
w('  -- AND IT SAW THEM. The assertion above is only worth having if the view');
w('  -- returned the curricula this file just seeded.');
w('  select count(*) into n from curriculum_progress where courses_in_curriculum > 0;');
w(`  if n <> ${moving.length} then`);
w(`    raise exception '062 FAILED: the totals view sees % curricula, not the ${moving.length} `
  + `just seeded', n;`);
w('  end if;');
w();
w('  -- AND NOTHING WAS APPROVED ON THE WAY IN.');
w("  select count(*) into n from programme_versions where status <> 'draft';");
w('  if n > 0 then');
w("    raise exception '062 FAILED: % versions are no longer drafts', n;");
w('  end if;');
w();
w(`  raise notice '062 OK: ${moving.length} curricula moved into rows, course by course, each `
  + `adding up to exactly what its programme claims';`);
w("  raise notice '062 OK: every entry is core, every version is still a draft, and nothing "
  + "was approved on the way in';");
w('end $$;');
w();

// ---------------------------------------------------------------------------
w();
w('-- ===========================================================================');
w('-- 5. VERIFY — READ THIS OUTPUT');
w('-- ===========================================================================');
w();
w('-- ---------------------------------------------------------------------------');
w('-- WHAT EACH PROGRAMME NOW HAS. `credits_in_curriculum` against');
w('-- `total_credits` is the Curriculum Builder\'s running total: equal means the');
w('-- curriculum is complete, 0 means the shelf is still empty.');
w('-- ---------------------------------------------------------------------------');
w('select code, award_level, status, duration_years as yrs,');
w('       courses_in_curriculum as courses, credits_in_curriculum as credits,');
w('       total_credits as claims, credits_against_claim as gap,');
w("       terms_with_courses || ' of ' || terms_expected as terms_filled");
w('  from curriculum_progress');
w(' order by courses_in_curriculum desc, code');
w(' limit 10;');
w();
if (held.length > 0) {
  w('-- ---------------------------------------------------------------------------');
  w('-- HELD BACK, AND WHY.');
  w('--');
  for (const h of held) {
    w(`--   ${h.name} — ${h.list.length} courses`);
    if (h.missingCredit > 0) {
      w(`--     ${h.missingCredit} of them carry no credit value, and none exists as a row in`);
      w('--     `courses` already. credit_unit is NOT NULL and defaults to 3, so seeding');
      w(`--     them would write 3 against every one — a curriculum of ${h.list.length * 3}`);
      w('--     credits against a programme the University has ruled at 120.');
    }
    if (h.noProgramme) {
      w('--     AND the name matches no programme in the catalogue: the curriculum says');
      w('--     "Diploma OF Theology", the catalogue publishes "Diploma IN Theology".');
      w('--     Almost certainly the same award, and almost certainly is not a basis for');
      w('--     attaching a curriculum to a programme.');
    }
    w('--');
    w('--     The fifteen, each needing a credit value:');
    for (const c of h.list) {
      w(`--       ${c.code.padEnd(10)} ${c.title}`);
    }
    w('--');
  }
  w('-- ---------------------------------------------------------------------------');
  w('select count(*) as curricula_seeded from (');
  w('  select distinct programme_version_id from curriculum_entries) as seeded;');
  w();
}

writeFileSync(join(root, 'docs/migrations/062_the_curricula_already_written.sql'),
  lines.join('\n'));
console.log('docs/migrations/062_the_curricula_already_written.sql');
for (const m of moving) console.log(`  moving  ${m.name}: ${m.list.length} courses, ${m.credits} credits`);
for (const h of held) console.log(`  HELD    ${h.name}: ${h.list.length} courses`);
