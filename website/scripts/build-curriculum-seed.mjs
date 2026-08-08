// ---------------------------------------------------------------------------
// BUILD THE CURRICULUM SEED.
//
//   node scripts/build-curriculum-seed.mjs
//   -> docs/migrations/011_school_of_ministry_curriculum.sql
//
// ===========================================================================
// WHY THE SQL IS GENERATED AND NOT WRITTEN
// ===========================================================================
//
// The Bachelor of Ministry is published at /bachelor-of-ministry from
// src/content/bachelorOfMinistry.ts: thirty-four courses with codes, ECTS
// values and a prerequisite chain. The learning system needs the same
// thirty-four courses as rows, or it cannot enrol anybody on the degree the
// website advertises.
//
// Hand-writing that INSERT is the third copy of the same list, and this
// repository has already shipped the bug that produces: the ministry awards
// moved faculty in one catalogue and not the other, and the homepage said
// "4 programmes" while the prospectus said six. Nothing failed. Both numbers
// were counted correctly from a catalogue that was wrong.
//
// A course list is worse than a count, because the drift is invisible for
// years and then surfaces on a transcript. So the migration is an ARTEFACT of
// the curriculum. Change a course on the site, re-run this, and the database
// follows. The generated file is committed — a deploy must never depend on
// node being available — and the header of the SQL says where it came from so
// nobody edits the output instead of the source.
//
// ===========================================================================
// WHAT THE SCHEMA GAINS, AND WHY
// ===========================================================================
//
// `courses` in 001_full_schema.sql has code, title, credit_unit, level,
// semester, year and is_elective. It has nowhere to put three things this
// curriculum states:
//
//   prerequisites   The B.Min. is the first programme on this site with a
//                   prerequisite chain. Published on the page, unenforceable
//                   by the registry, is the worst of both: the university has
//                   announced a rule it cannot apply, and the first student to
//                   register for MIN 201 without MIN 101 finds out at
//                   graduation.
//
//   co_requisites   FIN 201 names ADM 201 and both sit in Semester 4; COM 302
//                   names MIS 301 and both sit in Semester 5. The School's
//                   recommended resolution is to treat them as co-requisites —
//                   taken alongside rather than before. The column exists so
//                   that ruling can be recorded when it is made. It is EMPTY
//                   until then: the schema is ready for the decision, and does
//                   not pre-empt it.
//
//   credit_system   credit_unit is an integer with no unit attached. Five ECTS
//                   and five credit hours are not the same quantity, and this
//                   university teaches programmes accounted both ways — see
//                   the Bachelor of Theology, which is specified twice in two
//                   incompatible systems. A number without its unit is the one
//                   thing a credential evaluator will not accept.
// ---------------------------------------------------------------------------

import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// The curriculum is TypeScript, so it is bundled rather than imported. Same
// mechanism the tests use, and for the same reason: there is one source and
// everything else reads it.
const cacheDir = join(root, 'node_modules/.cache/icof');
mkdirSync(cacheDir, { recursive: true });
const bundle = join(cacheDir, 'bmin-seed.mjs');
execFileSync('npx', [
  'esbuild', join(root, 'src/content/bachelorOfMinistry.ts'),
  '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`,
  '--log-level=error', `--alias:@=${join(root, 'src')}`,
], { stdio: 'inherit' });

const B = await import(bundle);

/** Single-quote a SQL string literal, or emit NULL. */
const q = (s) => (s === undefined || s === null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
/** A Postgres text[] literal. */
const arr = (xs) => (xs.length ? `array[${xs.map(q).join(', ')}]` : "'{}'::text[]");

const DEPT = { code: 'SOM', name: 'School of Ministry', faculty: 'School of Ministry' };
const PROGRAMME = 'bachelor-of-ministry';

const rows = [];
B.bminSemesters.forEach((s, i) => {
  // year 1 covers semesters 1-2, year 2 covers 3-4, year 3 covers 5-6. The
  // level is the course code's own hundred, read from the code rather than
  // guessed from the semester: RES 301 is taught in Semester 5 and is a
  // 300-level course, and MIN 306 is 300-level in Semester 6.
  const year = Math.floor(i / 2) + 1;
  const semester = (i % 2) + 1;
  for (const c of s.courses) {
    const level = Number(c.code.split(' ')[1][0]) * 100;
    rows.push({
      code: c.code,
      title: c.title,
      credit_unit: c.ects,
      level,
      semester,
      year,
      description: c.description ?? null,
      prerequisites: c.requires,
      // 'all' or 'any'. Without it "BIB 101 or BIB 102" and "MIN 101, BIB 103"
      // are the same two-element array, and a registry reading the column has
      // no way to tell a disjunction from a conjunction.
      requires_mode: c.requiresMode ?? 'all',
      // Threshold prerequisites ("At least 60 ECTS completed") are not course
      // codes and are kept as the sentence the framework wrote, in its own
      // column, rather than being crushed into the array.
      requires_ects: c.requiresEcts ?? null,
      prerequisite_text: c.prerequisite,
    });
  }
});

const total = rows.reduce((n, r) => n + r.credit_unit, 0);
if (total !== B.bminTotalEcts) {
  console.error(`Refusing to write: seed totals ${total} ECTS, curriculum totals ${B.bminTotalEcts}.`);
  process.exit(1);
}

const values = rows.map((r) =>
  `  (${q(r.code)}, ${q(r.title)}, ${r.credit_unit}, ${r.level}, ${r.semester}, ${r.year}, `
  + `${q(r.description)}, ${arr(r.prerequisites)}, ${q(r.requires_mode)}, `
  + `${r.requires_ects ?? 'null'}, ${q(r.prerequisite_text)})`,
).join(',\n');

const sql = `-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — THE SCHOOL OF MINISTRY CURRICULUM
--
-- Run after 010_writes_the_ui_makes.sql. Idempotent; destroys nothing.
--
-- GENERATED FILE. DO NOT EDIT.
--
--   Source:    src/content/bachelorOfMinistry.ts
--   Generator: scripts/build-curriculum-seed.mjs
--
-- Edit the curriculum and re-run the generator. An edit made here is lost the
-- next time somebody does, and worse, it makes the database disagree with the
-- page the university publishes.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES
--
-- 1. Gives \`courses\` three columns it does not have: the prerequisite chain,
--    a co-requisite list, and the unit its credit value is counted in.
-- 2. Registers the School of Ministry as a department.
-- 3. Loads the ${rows.length} courses of the Bachelor of Ministry — ${total} ECTS across
--    ${B.bminSemesters.length} semesters — with their codes, credit values, levels and
--    prerequisites.
--
-- ---------------------------------------------------------------------------
-- WHY THE PREREQUISITE COLUMN MATTERS MORE THAN IT LOOKS
--
-- The Bachelor of Ministry is the first programme this university publishes
-- with a prerequisite chain. Until now \`courses\` had nowhere to record one, so
-- the rule existed on the website and nowhere else. A rule announced and not
-- enforced is worse than no rule: the student who registers for MIN 201
-- without MIN 101 discovers it at graduation, when the remedy is a year.
--
-- The array holds course CODES, not ids, deliberately. A prerequisite is a
-- statement about the curriculum, and it must survive a course being deleted
-- and re-created — which is exactly what happens when a catalogue is reloaded.
-- A foreign key would either block that reload or cascade the rule away.
--
-- ---------------------------------------------------------------------------
-- CO-REQUISITES ARE EMPTY, AND THAT IS THE POINT
--
-- Two prerequisites in the published framework cannot be satisfied as written:
-- FIN 201 requires ADM 201 and both are in Semester 4; COM 302 requires
-- MIS 301 and both are in Semester 5. The School's recommended resolution is
-- to redesignate both as co-requisites.
--
-- That is an academic decision for the University and it has not been taken.
-- So the column exists, ready, and holds nothing. The schema does not pre-empt
-- a ruling, and when the ruling comes it is a data change and not a migration.
-- ===========================================================================

-- 1 ------------------------------------------------------------------------
-- The three columns the curriculum needs. \`if not exists\` throughout, so this
-- can be run against a database that has already had it.

alter table courses add column if not exists prerequisites  text[] not null default '{}'::text[];
alter table courses add column if not exists co_requisites  text[] not null default '{}'::text[];
-- 'all' — every course in \`prerequisites\`. 'any' — one of them suffices.
-- Without this column "BIB 101 or BIB 102" and "MIN 101, BIB 103" are the same
-- two-element array. A registry reading it as 'all' refuses a student who has
-- met BIB 103's requirement; reading it as 'any' admits one who has met neither
-- of MIN 201's. 'all' is the default because a comma means conjunction, and
-- because an over-strict rule is caught at the registration desk while an
-- over-lax one is caught by an examiner at graduation.
alter table courses add column if not exists requires_mode  text not null default 'all';
alter table courses add column if not exists requires_ects  integer;
alter table courses add column if not exists prerequisite_text text;

-- A credit value with no unit is not a credit value. This university teaches
-- programmes accounted in ECTS and programmes accounted in US-style credit
-- hours, and five of one is not five of the other. Existing rows are left as
-- 'credit_hour', which is what the seeded catalogue was.
alter table courses add column if not exists credit_system text not null default 'credit_hour';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'courses_credit_system_check') then
    alter table courses add constraint courses_credit_system_check
      check (credit_system in ('ECTS', 'credit_hour'));
  end if;
end $$;

-- Which published programme a course belongs to, matching the slug on the
-- website. Without it the registry can list courses but cannot answer "what
-- does this student still owe", which is the question graduation turns on.
alter table courses add column if not exists programme_slug text;

create index if not exists courses_programme_slug_idx on courses (programme_slug);

-- 2 ------------------------------------------------------------------------
-- The School of Ministry as a department. It is a school on the website and a
-- department in this schema; the two names are joined here rather than by a
-- convention somebody has to remember.

insert into departments (name, code, faculty)
values (${q(DEPT.name)}, ${q(DEPT.code)}, ${q(DEPT.faculty)})
on conflict (code) do update set name = excluded.name, faculty = excluded.faculty;

-- 3 ------------------------------------------------------------------------
-- The ${rows.length} courses.
--
-- \`on conflict (code) do update\` rather than insert-or-skip: re-running after
-- a curriculum change must UPDATE the row, or the generator would be able to
-- create a course and never able to correct one. Every generated column is
-- refreshed; lecturer_id is not touched, because who teaches a course is the
-- registry's business and not the curriculum's.

with seeded (code, title, credit_unit, level, semester, year, description,
             prerequisites, requires_mode, requires_ects, prerequisite_text) as (
  values
${values}
)
insert into courses (
  code, title, credit_unit, credit_system, department_id, level, semester, year,
  description, is_elective, prerequisites, requires_mode, requires_ects,
  prerequisite_text, programme_slug
)
select
  s.code, s.title, s.credit_unit, 'ECTS',
  (select id from departments where code = ${q(DEPT.code)}),
  s.level, s.semester, s.year, s.description,
  -- Every course in the published plan is required. The fourteen
  -- specialization tracks are not seeded at all: the framework describes them
  -- as provision the School intends to offer, and there is no elective slot in
  -- the six-semester plan to take one in. Seeding a course a student cannot
  -- enrol in would put it on a transcript-shaped table with no way to earn it.
  false,
  s.prerequisites, s.requires_mode, s.requires_ects, s.prerequisite_text,
  ${q(PROGRAMME)}
from seeded s
on conflict (code) do update set
  title             = excluded.title,
  credit_unit       = excluded.credit_unit,
  credit_system     = excluded.credit_system,
  department_id     = excluded.department_id,
  level             = excluded.level,
  semester          = excluded.semester,
  year              = excluded.year,
  description       = excluded.description,
  prerequisites     = excluded.prerequisites,
  requires_mode     = excluded.requires_mode,
  requires_ects     = excluded.requires_ects,
  prerequisite_text = excluded.prerequisite_text,
  programme_slug    = excluded.programme_slug;

-- 4 ------------------------------------------------------------------------
-- Proof, at migration time, that the load is the degree.
--
-- A seed that silently loads thirty-three of thirty-four courses leaves a
-- programme that cannot be completed and a database that looks fine. This
-- raises instead.

do $$
declare
  n integer;
  ects integer;
begin
  select count(*), sum(credit_unit) into n, ects
    from courses where programme_slug = ${q(PROGRAMME)};
  if n <> ${rows.length} then
    raise exception 'Expected ${rows.length} Bachelor of Ministry courses, found %', n;
  end if;
  if ects <> ${total} then
    raise exception 'Expected ${total} ECTS across the Bachelor of Ministry, found %', ects;
  end if;
end $$;
`;

const out = join(root, 'docs/migrations/011_school_of_ministry_curriculum.sql');
writeFileSync(out, sql);
console.log(
  `011_school_of_ministry_curriculum.sql  ${rows.length} courses / ${total} ECTS, `
  + `${(sql.length / 1024).toFixed(1)}KB`,
);
