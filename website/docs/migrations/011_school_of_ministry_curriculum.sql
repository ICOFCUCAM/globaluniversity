-- ===========================================================================
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
-- 1. Gives `courses` three columns it does not have: the prerequisite chain,
--    a co-requisite list, and the unit its credit value is counted in.
-- 2. Registers the School of Ministry as a department.
-- 3. Loads the 34 courses of the Bachelor of Ministry — 180 ECTS across
--    6 semesters — with their codes, credit values, levels and
--    prerequisites.
--
-- ---------------------------------------------------------------------------
-- WHY THE PREREQUISITE COLUMN MATTERS MORE THAN IT LOOKS
--
-- The Bachelor of Ministry is the first programme this university publishes
-- with a prerequisite chain. Until now `courses` had nowhere to record one, so
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
-- The three columns the curriculum needs. `if not exists` throughout, so this
-- can be run against a database that has already had it.

alter table courses add column if not exists prerequisites  text[] not null default '{}'::text[];
alter table courses add column if not exists co_requisites  text[] not null default '{}'::text[];
-- 'all' — every course in `prerequisites`. 'any' — one of them suffices.
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
values ('School of Ministry', 'SOM', 'School of Ministry')
on conflict (code) do update set name = excluded.name, faculty = excluded.faculty;

-- 3 ------------------------------------------------------------------------
-- The 34 courses.
--
-- `on conflict (code) do update` rather than insert-or-skip: re-running after
-- a curriculum change must UPDATE the row, or the generator would be able to
-- create a course and never able to correct one. Every generated column is
-- refreshed; lecturer_id is not touched, because who teaches a course is the
-- registry's business and not the curriculum's.

with seeded (code, title, credit_unit, level, semester, year, description,
             prerequisites, requires_mode, requires_ects, prerequisite_text) as (
  values
  ('MIN 101', 'Introduction to Christian Ministry', 5, 100, 1, 1, 'Introduces the nature, purpose and practice of Christian ministry. Students examine ministry as calling, service, stewardship and leadership.', '{}'::text[], 'all', null, 'None'),
  ('BIB 101', 'Old Testament Survey', 5, 100, 1, 1, 'A comprehensive introduction to the books, historical development, major themes, theology and ministry significance of the Old Testament.', '{}'::text[], 'all', null, 'None'),
  ('BIB 102', 'New Testament Survey', 5, 100, 1, 1, 'Study of the Gospels, Acts, Pauline writings, General Epistles and Revelation.', '{}'::text[], 'all', null, 'None'),
  ('THE 101', 'Introduction to Christian Doctrine', 5, 100, 1, 1, 'Introduction to foundational Christian doctrines including Yahuah, humanity, sin, Yahusha the Messiah, salvation, the Ruach HaQodesh, the Church and final things.', '{}'::text[], 'all', null, 'None'),
  ('SFM 101', 'Spiritual Formation and Christian Character', 5, 100, 1, 1, 'Develops spiritual disciplines and Christian character through prayer, Scripture, worship, fasting, service, accountability and reflection.', '{}'::text[], 'all', null, 'None'),
  ('COM 101', 'Communication for Ministry', 5, 100, 1, 1, 'Develops written, oral, interpersonal and public communication skills for Christian ministry.', '{}'::text[], 'all', null, 'None'),
  ('BIB 103', 'Biblical Interpretation and Hermeneutics', 5, 100, 2, 1, 'Students learn principles of biblical interpretation, context, genre, observation, interpretation and application.', array['BIB 101', 'BIB 102'], 'any', null, 'BIB 101 or BIB 102'),
  ('THE 102', 'Theology of Yahuah, Yahusha and the Ruach HaQodesh', 5, 100, 2, 1, 'Study of Trinitarian theology, Christology and Pneumatology.', array['THE 101'], 'all', null, 'THE 101'),
  ('BIB 104', 'Life and Ministry of Yahusha the Messiah', 5, 100, 2, 1, 'Study of the person, teaching, ministry, death, resurrection and mission of Yahusha.', array['BIB 102'], 'all', null, 'BIB 102'),
  ('MIN 102', 'Prayer, Worship and Spiritual Disciplines', 5, 100, 2, 1, 'Practical development of prayer, worship, fasting, meditation, spiritual disciplines and corporate spiritual life.', array['SFM 101'], 'all', null, 'SFM 101'),
  ('HIS 101', 'Church History I', 5, 100, 2, 1, 'From the early Church through the Reformation.', '{}'::text[], 'all', null, 'None'),
  ('MIN 103', 'Introduction to Preaching and Teaching', 5, 100, 2, 1, 'Introduction to sermon preparation, Bible teaching, lesson planning and public ministry.', array['COM 101'], 'all', null, 'COM 101'),
  ('MIN 201', 'Five-Fold Ministry', 5, 200, 1, 2, 'Apostolic · Prophetic · Evangelistic · Pastoral · Teaching. Students examine the biblical foundations, functions, responsibilities, strengths and potential abuses associated with five-fold ministry.', array['MIN 101', 'BIB 103'], 'all', null, 'MIN 101, BIB 103'),
  ('MIN 202', 'Pastoral Ministry and Shepherding', 5, 200, 1, 2, null, array['MIN 101'], 'all', null, 'MIN 101'),
  ('EVG 201', 'Evangelism and Discipleship', 5, 200, 1, 2, 'Students develop practical evangelism and disciple-making skills.', array['MIN 101'], 'all', null, 'MIN 101'),
  ('THE 201', 'Theology of the Church', 5, 200, 1, 2, 'Ecclesiology, Church identity, leadership, sacraments/ordinances, mission and community.', array['THE 102'], 'all', null, 'THE 102'),
  ('LEA 201', 'Christian Leadership', 5, 200, 1, 2, 'Leadership theory integrated with biblical servant leadership.', array['MIN 101'], 'all', null, 'MIN 101'),
  ('MUS 201', 'Worship and Music Ministry', 5, 200, 1, 2, 'For worship leaders, musicians, singers and worship coordinators.', array['MIN 101'], 'all', null, 'MIN 101'),
  ('MIN 203', 'Apostolic Leadership and Church Planting', 5, 200, 2, 2, 'Students study church planting, ministry multiplication, organizational development and apostolic leadership.', array['MIN 201'], 'all', null, 'MIN 201'),
  ('MIN 204', 'Prophetic Ministry and Spiritual Discernment', 5, 200, 2, 2, null, array['MIN 201'], 'all', null, 'MIN 201'),
  ('MIN 205', 'Christian Education and Discipleship', 5, 200, 2, 2, 'Design and management of Christian educational programmes.', array['MIN 103'], 'all', null, 'MIN 103'),
  ('PAS 201', 'Pastoral Care and Christian Counseling', 5, 200, 2, 2, 'Introduction to pastoral counseling, grief, marriage, family, crisis and referral practices.', array['MIN 202'], 'all', null, 'MIN 202'),
  ('ADM 201', 'Church Administration and Management', 5, 200, 2, 2, null, array['LEA 201'], 'all', null, 'LEA 201'),
  ('FIN 201', 'Christian Finance and Stewardship', 5, 200, 2, 2, null, array['ADM 201'], 'all', null, 'ADM 201'),
  ('MIS 301', 'Missions and Cross-Cultural Ministry', 5, 300, 1, 3, 'Study of missions, culture, contextualization, global Christianity and cross-cultural communication.', array['EVG 201'], 'all', null, 'EVG 201'),
  ('COM 301', 'Christian Media and Communications', 5, 300, 1, 3, null, array['COM 101'], 'all', null, 'COM 101'),
  ('ITM 301', 'Information Technology for Ministry', 5, 300, 1, 3, 'A distinctive modern ministry course.', array['COM 101'], 'all', null, 'COM 101'),
  ('YTH 301', 'Youth and Children’s Ministry', 5, 300, 1, 3, 'Developmentally appropriate ministry for children, adolescents and young adults.', array['MIN 205'], 'all', null, 'MIN 205'),
  ('COM 302', 'Community Development and Social Ministry', 5, 300, 1, 3, 'Students explore Christian responses to poverty, education, health, social justice, community development and humanitarian needs.', array['MIS 301'], 'all', null, 'MIS 301'),
  ('RES 301', 'Research Methods for Ministry', 5, 300, 1, 3, null, '{}'::text[], 'all', 60, 'At least 60 ECTS completed'),
  ('MIN 306', 'Advanced Ministry Leadership', 5, 300, 2, 3, 'Advanced organizational and spiritual leadership.', array['LEA 201', 'MIN 203'], 'all', null, 'LEA 201, MIN 203'),
  ('MIN 307', 'Ministry Ethics, Governance and Accountability', 5, 300, 2, 3, null, array['ADM 201'], 'all', null, 'ADM 201'),
  ('MIN 308', 'Ministry Practicum', 10, 300, 2, 3, 'Supervised practical ministry placement.', '{}'::text[], 'all', 120, 'Minimum 120 ECTS'),
  ('RES 302', 'Bachelor Ministry Research Project', 10, 300, 2, 3, 'Students conduct an approved research project addressing a significant biblical, theological, ministry, organizational or community issue.', array['RES 301'], 'all', null, 'RES 301')
)
insert into courses (
  code, title, credit_unit, credit_system, department_id, level, semester, year,
  description, is_elective, prerequisites, requires_mode, requires_ects,
  prerequisite_text, programme_slug
)
select
  s.code, s.title, s.credit_unit, 'ECTS',
  (select id from departments where code = 'SOM'),
  s.level, s.semester, s.year, s.description,
  -- Every course in the published plan is required. The fourteen
  -- specialization tracks are not seeded at all: the framework describes them
  -- as provision the School intends to offer, and there is no elective slot in
  -- the six-semester plan to take one in. Seeding a course a student cannot
  -- enrol in would put it on a transcript-shaped table with no way to earn it.
  false,
  s.prerequisites, s.requires_mode, s.requires_ects, s.prerequisite_text,
  'bachelor-of-ministry'
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
    from courses where programme_slug = 'bachelor-of-ministry';
  if n <> 34 then
    raise exception 'Expected 34 Bachelor of Ministry courses, found %', n;
  end if;
  if ects <> 180 then
    raise exception 'Expected 180 ECTS across the Bachelor of Ministry, found %', ects;
  end if;
end $$;
