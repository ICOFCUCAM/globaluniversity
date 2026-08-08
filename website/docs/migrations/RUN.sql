-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — MIGRATIONS 006, 010, 011, 012, 013, 014, IN ORDER
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-migration-run.mjs
--   Rebuild:   node scripts/build-migration-run.mjs 006 010 011 012 013 014
--
-- ---------------------------------------------------------------------------
-- HOW TO RUN IT
--
-- Supabase SQL editor: paste the whole file and run once.
-- psql:                psql "<connection string>" -f docs/migrations/RUN.sql
--
-- Every migration in it is idempotent and destroys nothing, so running it twice
-- is safe. It is NOT wrapped in a transaction: each file is written to run
-- statement by statement, and wrapping them would mean a failure in the last
-- one silently undid the first.
--
-- ---------------------------------------------------------------------------
-- WHAT TO EXPECT IN THE OUTPUT
--
-- Some of these raise NOTICE deliberately — they report on the state they
-- found rather than changing it silently. A notice is information, not a
-- warning. An ERROR is a real failure and stops the run.
--
-- ---------------------------------------------------------------------------
-- AFTERWARDS
--
-- Run docs/migrations/VERIFY.sql to see what landed.
-- ===========================================================================

-- ===========================================================================
-- ===========================================================================
--
--   006_awards_and_graduation.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — THE AWARDS, AND WHAT EARNS THEM
--
-- Run after 005_senate_approval.sql. Idempotent; destroys nothing.
--
-- ---------------------------------------------------------------------------
-- WHY
--
-- The Certificate Generator hard-coded 'Bachelor of Science' for every graduate
-- of a university that does not teach a Bachelor of Science, and printed the
-- word "Eligible" beside a check that computed nothing. Both were placeholders
-- from the template this system started as, and both survived because nothing
-- in the database said what the university actually confers or what earns it.
--
-- So the award title was free text typed by whoever pressed the button, and
-- eligibility was a word. This table is the answer to both: it names the awards,
-- and it states the credit requirement and the minimum cumulative GPA for each.
-- After this, "issue a certificate" can become "issue a certificate the
-- regulations permit", which is a different act.
--
-- ---------------------------------------------------------------------------
-- WHERE THE FIGURES COME FROM, AND WHICH ARE THE UNIVERSITY'S TO CONFIRM
--
-- The Bachelor of Theology is stated at 180 ECTS on the university's own
-- programme page, and the Diploma at 120. Those two are the university's.
--
-- The minimum CGPA for each award is NOT published anywhere in the material
-- this system was built from. 1.00 is seeded — the lowest passing grade point
-- on the university's own scale, so it excludes only a candidate who has failed
-- outright, and it will not silently withhold a degree from someone entitled to
-- one. It is marked `cgpa_confirmed = false` and the Certificate Generator says
-- so on screen. A university that wants a higher bar sets it here, deliberately,
-- rather than discovering the system had invented one.
-- ===========================================================================


-- ===========================================================================
-- 1. THE AWARDS
-- ===========================================================================

create table if not exists awards (
  id               uuid primary key default gen_random_uuid(),

  -- Short code, used in the credential number: IGUC-BTH-26A9-...
  code             text not null unique,
  title            text not null,

  -- Which kind of instrument it is. The certificate's wording follows this —
  -- a diploma is not a degree and the document must not call it one, and a
  -- doctorate is not classified. See src/lib/awards.ts.
  kind             text not null check (kind in
                     ('doctorate', 'masters', 'bachelors', 'diploma', 'certificate')),

  faculty          text,

  -- What earns it.
  credits_required integer not null check (credits_required > 0),
  min_cgpa         numeric(3,2) not null default 1.00 check (min_cgpa >= 0 and min_cgpa <= 4),

  -- False until the university states the figure. The Generator shows the
  -- distinction, because a threshold the system invented and a threshold the
  -- Senate set should not look the same to the person issuing a degree.
  cgpa_confirmed   boolean not null default false,

  -- Withdrawn awards stay on the table. A degree conferred in 2019 under a
  -- programme the university has since closed is still a degree, and its
  -- certificate must still be renderable.
  active           boolean not null default true,

  created_at       timestamptz not null default now()
);

create index if not exists awards_active_idx on awards (active, title);

-- The two the university has published curricula for. `on conflict do nothing`
-- so re-running this never overwrites a figure the university has since set.
--
-- DTH IS 120. It was seeded here at 120, changed to 180 on an instruction, and
-- has now been ruled back to 120 by the university: "Diploma is 120. 180 is
-- degree." This file carries the ruling for FRESH installs only.
--
-- Because of the `on conflict do nothing` above, RE-RUNNING THIS FILE WILL NOT
-- CORRECT A DATABASE THAT ALREADY HAS THE OLD ROW. That is the clause working
-- as intended — it exists so a figure the university has since set by hand is
-- never overwritten by a re-run — and it is why the correction is applied by
-- migration 012 instead of here.
--
-- Do not "fix" this by changing it to `do update`. That would make every
-- re-run of this file silently reset any credit value the registry has set,
-- which is a far worse failure than the one it would save.
insert into awards (code, title, kind, faculty, credits_required, min_cgpa, cgpa_confirmed)
values
  ('BTH', 'Bachelor of Theology', 'bachelors', 'Faculty of Theology', 180, 1.00, false),
  ('DTH', 'Diploma of Theology',  'diploma',   'Faculty of Theology', 120, 1.00, false)
on conflict (code) do nothing;


-- ===========================================================================
-- 2. WHICH AWARD A STUDENT IS READING FOR
--
-- `students.program` is free text — it holds whatever the application form
-- collected. That is fine for a prospectus and useless for deciding whether
-- somebody has finished: "BTh", "B.Th", "Bachelor of Theology" and "Theology"
-- are four strings and one programme.
-- ===========================================================================

alter table students
  add column if not exists award_id uuid references awards (id) on delete set null;

create index if not exists students_award_idx on students (award_id);


-- ===========================================================================
-- 3. RLS
--
-- The award catalogue is public. It is on the prospectus already, and a
-- credential evaluator reading a certificate should be able to look up what the
-- award requires without an account.
-- ===========================================================================

alter table awards enable row level security;

drop policy if exists awards_public_read on awards;
create policy awards_public_read on awards for select using (true);

-- No write policy: with RLS on and none, only the service role writes. The
-- credit requirement for a degree is not something an administrator changes
-- from a browser.


-- ===========================================================================
-- 4. VERIFY
-- ===========================================================================

select code, title, kind, credits_required, min_cgpa, cgpa_confirmed
from awards order by kind, title;

-- How many students are linked to an award. Zero on a fresh install; every
-- graduating student needs one before a certificate can be issued to them.
select count(*) filter (where award_id is not null) as linked,
       count(*)                                     as total
from students;


-- ===========================================================================
-- AFTER RUNNING THIS
--
-- 1. Add any other awards the university confers. The two seeded here are the
--    two with published curricula; the prospectus lists faculties of Education,
--    Engineering and Business whose awards are not specified anywhere this
--    system could read.
--
-- 2. Set min_cgpa for each award if the university has a rule. The seeded 1.00
--    excludes only an outright failure, which is the safe direction to be wrong
--    in — but it is the system's figure, not the Senate's, until you change it:
--
--      update awards set min_cgpa = 2.00, cgpa_confirmed = true where code = 'BTH';
--
-- 3. Link graduating students to their award:
--
--      update students set award_id = (select id from awards where code = 'BTH')
--      where program ilike '%theology%' and degree_type ilike '%bachelor%';
-- ===========================================================================


-- ===========================================================================
-- ===========================================================================
--
--   010_writes_the_ui_makes.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — THE WRITES THE INTERFACE ACTUALLY MAKES
--
-- Run after 009_results_approval.sql. Idempotent; destroys nothing.
--
-- ---------------------------------------------------------------------------
-- WHY
--
-- An audit of every write the browser makes against every policy the database
-- has found that most of them could not succeed. Row-level security is on
-- across the schema and the policy set is almost entirely SELECT: whole screens
-- of this portal were writing into a database that refuses them.
--
-- It is a quiet failure. supabase-js returns an error object rather than
-- throwing, so a screen that does not check it shows a spinner, stops, and
-- looks like it worked. The `results` table was the worst case and is fixed in
-- 009. This file finishes the audit.
--
--   courses          CourseManagement inserts a course. No INSERT policy.
--                    No course means no enrolment, no enrolment means no mark,
--                    and no mark means no degree. This is the top of the whole
--                    academic pipeline.
--
--   payments         FeeModule inserts a payment. No INSERT policy. No payment
--                    record means no financial clearance, which is step 2 of
--                    the graduation audit.
--
--   documents        Seven portal modules — LMS, forum, timetable, question
--                    bank, assignments, announcements, insights — use this
--                    table as a general-purpose store. It is not one. See
--                    section 3: those writes fail on a NOT NULL constraint
--                    before RLS is even consulted, so no policy could have
--                    saved them.
--
-- ---------------------------------------------------------------------------
-- WHY POLICIES HERE, AND ROUTES FOR RESULTS
--
-- Migration 009 deliberately gave `results` no write policy at all and put
-- every write behind a guarded API route. The rule there is not expressible as
-- a row predicate — it depends on the caller's capability, on which step of the
-- approval chain the class is at, and on who has already signed it.
--
-- The rules below ARE row predicates. "The Academic Office may add a course."
-- "Finance may record a payment." Those fit RLS exactly, and putting them
-- behind routes instead would be ceremony without a control.
--
-- The test for which treatment a table gets is not how important it is. It is
-- whether the rule can be written as a condition on a row.
-- ===========================================================================


-- ===========================================================================
-- 1. COURSES
--
-- 'manage-courses' is held by the Academic Office, the Registrar and the
-- programme coordinators. A lecturer is absent: teaching a course and creating
-- one in the catalogue are different acts, and a catalogue anybody may add to
-- stops being a catalogue.
--
-- No DELETE policy. A course with results attached is part of the academic
-- record of everybody who took it, and deleting it would cascade. Courses are
-- withdrawn by being marked inactive, not removed.
-- ===========================================================================

drop policy if exists courses_staff_write on courses;
create policy courses_staff_write on courses
  for insert with check (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office', 'programme-coordinator')
  );

drop policy if exists courses_staff_update on courses;
create policy courses_staff_update on courses
  for update using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office', 'programme-coordinator')
  );


-- ===========================================================================
-- 2. PAYMENTS
--
-- INSERT ONLY, for the Finance offices. There is deliberately no UPDATE and no
-- DELETE policy, and that is the important half of this section.
--
-- A payment record is a financial record. A receipt entered in error is
-- corrected by a second row — a reversal — never by editing the first, because
-- an amount that can be edited is an amount that cannot be audited. The
-- Registrar is absent here for the reason stated at the top of roles.ts: the
-- Registrar Administrator cannot edit payments, and that sentence should be the
-- absence of a policy rather than a line in a document.
-- ===========================================================================

drop policy if exists payments_finance_insert on payments;
create policy payments_finance_insert on payments
  for insert with check (
    auth_role() in ('superadmin', 'admin', 'finance', 'finance-director')
  );


-- ===========================================================================
-- 3. WHERE THE PORTAL MODULES PUT THEIR DATA
--
-- Seven modules write to `documents`. That table is:
--
--     create table documents (
--       id            uuid primary key ...,
--       student_id    uuid NOT NULL references students (id) on delete cascade,
--       file_name     text not null,
--       file_url      text not null,
--       ...
--     );
--
-- It models a file belonging to a student. The modules were storing a timetable
-- slot, a forum thread, an exam question, an announcement — none of which
-- belongs to a student — by putting a label in `file_name` and a JSON blob in
-- `file_url`. Thirteen of the fourteen write sites never set `student_id`, so
-- every one of them failed on NOT NULL. No RLS policy could have fixed that;
-- the rows were never valid.
--
-- The `on delete cascade` is the part that would have hurt later. Had those
-- writes ever succeeded by borrowing some student's id, removing that student
-- would have deleted the university's timetable.
--
-- So the modules get a table shaped like what they actually store. `documents`
-- goes back to being what it says it is.
-- ===========================================================================

create table if not exists module_records (
  id           uuid primary key default gen_random_uuid(),

  -- Which module owns this row: 'lms', 'forum', 'timetable', 'exams',
  -- 'assignments', 'announcements'. Separate from `kind` so a module can be
  -- queried wholesale without knowing every kind it writes.
  module       text not null,

  -- What it is within that module: 'timetable-slot', 'forum-thread',
  -- 'forum-reply', 'exam-question', 'assignment-brief', 'assignment-sub',
  -- 'announcement', 'live-class', 'attendance'.
  kind         text not null,

  title        text not null,

  -- The record itself. JSONB, not a base64 blob in a URL column — so it can be
  -- queried, indexed and read by a human looking at the table.
  body         jsonb not null default '{}'::jsonb,

  -- Optional links. NULLABLE, all of them, and none cascading to a delete that
  -- would take a timetable with it.
  student_id   uuid references students (id) on delete set null,
  course_id    uuid references courses (id) on delete set null,
  parent_id    uuid references module_records (id) on delete cascade,

  author_id    uuid,
  author_name  text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists module_records_module_idx  on module_records (module, kind, created_at desc);
create index if not exists module_records_parent_idx  on module_records (parent_id);
create index if not exists module_records_student_idx on module_records (student_id);
create index if not exists module_records_course_idx  on module_records (course_id);

create or replace function module_records_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists module_records_updated_at on module_records;
create trigger module_records_updated_at before update on module_records
  for each row execute function module_records_touch();

alter table module_records enable row level security;

-- READ: anybody signed in. A timetable, a reading list and an announcement are
-- meant to be seen by the people they are for, and the alternative — a policy
-- enumerating which module each role may read — would be wrong the first time a
-- module is added.
drop policy if exists module_records_read on module_records;
create policy module_records_read on module_records
  for select using (auth.uid() is not null);

-- WRITE: staff, plus a student writing something that is theirs.
--
-- The student clause is narrow on purpose: `author_id = auth.uid()` means a
-- student can post to a forum and submit an assignment, and cannot write an
-- announcement in somebody else's name or edit the timetable.
drop policy if exists module_records_staff_write on module_records;
create policy module_records_staff_write on module_records
  for insert with check (
    auth_role() in (
      'superadmin', 'admin', 'registrar', 'academic-office',
      'dean', 'hod', 'programme-coordinator', 'lecturer', 'student-affairs'
    )
    or (auth_role() = 'student' and author_id = auth.uid())
  );

-- Editing and removing: staff, or your own row. A student may delete their own
-- forum post; they may not delete anybody else's, and they may not touch a row
-- staff wrote.
drop policy if exists module_records_update on module_records;
create policy module_records_update on module_records
  for update using (
    auth_role() in (
      'superadmin', 'admin', 'registrar', 'academic-office',
      'dean', 'hod', 'programme-coordinator', 'lecturer', 'student-affairs'
    )
    or author_id = auth.uid()
  );

drop policy if exists module_records_delete on module_records;
create policy module_records_delete on module_records
  for delete using (
    auth_role() in (
      'superadmin', 'admin', 'registrar', 'academic-office',
      'dean', 'hod', 'programme-coordinator', 'lecturer'
    )
    or author_id = auth.uid()
  );


-- ===========================================================================
-- 4. DOCUMENTS — the student uploads that belong there
--
-- With the modules moved out, this table is again what its columns say: a file
-- belonging to a student. It still has no write policy, so an applicant cannot
-- upload their own certificates. Two policies, both narrow.
-- ===========================================================================

drop policy if exists documents_own_insert on documents;
create policy documents_own_insert on documents
  for insert with check (
    student_id in (select id from students where auth_user_id = auth.uid())
    or auth_role() in ('superadmin', 'admin', 'registrar', 'admissions-officer', 'academic-office')
  );

-- `verified` is the Registry's word that a document is genuine, and a student
-- who could update their own row could set it. So students get no UPDATE at
-- all: a wrong file is replaced by uploading again, not edited.
drop policy if exists documents_staff_update on documents;
create policy documents_staff_update on documents
  for update using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'admissions-officer', 'academic-office')
  );


-- ===========================================================================
-- 5. AUDIT LOGS
--
-- No policy is added here, and that is the decision rather than an omission.
--
-- Several screens used to write their own audit entries from the browser. Every
-- one of those failed, and it is just as well: an audit trail a client can
-- write is an audit trail a client can forge, and one it can write selectively
-- is worse than none, because its silence then means nothing.
--
-- Audit entries are written by the guarded API routes, server-side, attributed
-- to the caller the server itself authenticated. The remaining browser-side
-- audit writes should be deleted rather than enabled — see the note in
-- ResultProcessing.tsx where one already was.
-- ===========================================================================


-- ===========================================================================
-- 6. VERIFY
-- ===========================================================================

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- Every table with RLS on and NO write policy of any kind. Expect: results and
-- audit_logs, both deliberate, both written only by guarded routes.
select c.relname as table_without_write_policy
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity
  and not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname
      and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  )
order by 1;

select count(*) as module_records_rows from module_records;


-- ===========================================================================
-- AFTER RUNNING THIS
--
-- Courses can be created, fees can be recorded, students can upload documents,
-- and the seven portal modules write to a table that can accept their rows.
--
-- NOTHING IS MIGRATED OUT OF `documents`. There is nothing to migrate: those
-- writes never succeeded, so there are no rows. If this database somehow does
-- hold module rows in `documents` — from a period when RLS was off — they can
-- be moved with:
--
--   insert into module_records (module, kind, title, body, created_at)
--   select 'legacy', document_type, file_name,
--          jsonb_build_object('legacy_url', file_url), uploaded_at
--   from documents
--   where document_type in (
--     'timetable-slot','attendance','forum-thread','forum-reply','exam-question',
--     'assignment-brief','assignment-sub','announcement','live-class'
--   );
--
-- Check the count first. If it is zero, as expected, skip it.
-- ===========================================================================


-- ===========================================================================
-- ===========================================================================
--
--   011_school_of_ministry_curriculum.sql
--
-- ===========================================================================
-- ===========================================================================

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


-- ===========================================================================
-- ===========================================================================
--
--   012_credit_framework.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — THE CREDIT RULING
--
-- Run after 011_school_of_ministry_curriculum.sql. Idempotent; destroys
-- nothing. Safe to run on a fresh database and on one that has been live.
--
-- ---------------------------------------------------------------------------
-- THE RULING
--
--   "Diploma is 120. 180 is degree."
--   "Masters is 120 credits."
--
-- Three of the five award levels now carry a direct ruling. The Doctorate
-- carries no credit figure, which is the normal state for an award examined by
-- thesis; the Certificate has not been ruled on and is deliberately absent from
-- this file rather than set to the 60 the School of Ministry framework
-- proposes.
--
-- The Diploma is the one that had been stated three different ways:
--
--   120   seeded here by migration 006 when the awards table was created
--   180   instructed afterwards, and published on the site ever since
--   120   restated by the School of Ministry academic framework §25, inside a
--         ladder of Certificate 60, Diploma 120, Bachelor 180, Master 120
--
-- ---------------------------------------------------------------------------
-- WHY A MIGRATION AND NOT AN EDIT TO 006
--
-- 006 has been corrected, and that fixes FRESH installs only. Its insert ends
-- `on conflict (code) do nothing`, which is deliberate: it exists so that
-- re-running the schema never overwrites a credit value the registry has since
-- set by hand. The consequence is that an installation which already ran the
-- 180 version still holds 180 and will go on holding it however many times 006
-- is replayed.
--
-- `awards.credits_required` is not decoration. It is what the graduation audit
-- reads to decide whether a student may be conferred. A database left at 180
-- would refuse to graduate a diploma student who has completed the 120 credits
-- the University now says the award requires — and the refusal would look like
-- an incomplete record rather than a stale figure.
--
-- ---------------------------------------------------------------------------
-- WHAT IS NOT DONE HERE, AND WHY IT IS NOT AN OVERSIGHT
--
-- No credential is reissued and no conferral is revisited. Section 3 checks
-- whether any diploma has in fact been issued under the 180 figure and RAISES
-- A NOTICE if one has, rather than quietly correcting it.
--
-- A credential that has been issued is a document the University has put its
-- seal on and a graduate may already have submitted to an employer or a
-- registrar. Changing the credit it states is a decision for the Senate — it
-- may require reissue, a corrigendum, or nothing at all if the certificate does
-- not print a credit total. A migration must not make that call at 3am on
-- somebody's staging box. So it reports and stops.
-- ===========================================================================

-- 1 ------------------------------------------------------------------------
-- Every diploma award requires 120 credits.
--
-- Matched on `kind`, not on the code 'DTH'. The ruling is about the LEVEL, and
-- a diploma award added next year must not need this migration written again.

update awards
   set credits_required = 120
 where kind = 'diploma'
   and credits_required <> 120;

-- 2 ------------------------------------------------------------------------
-- The bachelor's is 180. Asserted rather than assumed: the ruling names both
-- halves — "180 is degree" — and a bachelor's award seeded at some other value
-- would be just as wrong in the other direction, and just as invisible.

update awards
   set credits_required = 180
 where kind = 'bachelors'
   and credits_required <> 180;

-- 2b -----------------------------------------------------------------------
-- The master's is 120.
--
-- No master's award has a row in this table yet, so today this updates nothing
-- — and it is written anyway, for two reasons. A database that HAS one seeded
-- by hand is corrected, and the assertion in section 4 then holds the level for
-- every master's award created afterwards. A migration that only fixes rows it
-- expects to find is a migration that silently skips the installation that
-- differs, which is the only installation worth writing it for.

update awards
   set credits_required = 120
 where kind = 'masters'
   and credits_required <> 120;

-- 3 ------------------------------------------------------------------------
-- Has anything already been conferred under the old figure?
--
-- A notice, not an exception. This must not block the migration: the ruling
-- should take effect either way, and a university with issued diplomas needs
-- the new figure in place before it can decide what to do about them.

do $$
declare
  n integer;
begin
  if to_regclass('public.credentials_issued') is null then
    raise notice 'No credential register in this database; nothing to check.';
    return;
  end if;

  -- MATCHED ON credentials_issued.kind, NOT ON A JOIN TO awards.
  --
  -- The register does not carry an award_id. It carries `kind` — one of
  -- certificate, transcript, diploma, admission-letter, student-card,
  -- completion-letter — and `award` as free text. That is deliberate in 004: a
  -- credential is a snapshot of what was conferred on the day, and a foreign
  -- key would let a later edit to the awards table change what a sealed
  -- document says it was. So the check reads the register's own word.
  select count(*) into n
    from credentials_issued
   where kind = 'diploma'
     and status <> 'revoked';

  if n > 0 then
    raise notice
      'ATTENTION: % diploma credential(s) were issued before this ruling. The '
      'award now requires 120 credits. Whether those documents need reissue, a '
      'corrigendum, or nothing at all is a decision for the Senate — this '
      'migration has deliberately not touched them.', n;
  else
    raise notice 'No diploma credential has been issued; the ruling is not retrospective.';
  end if;
end $$;

-- 4 ------------------------------------------------------------------------
-- Proof that the ruling landed.

do $$
declare
  bad integer;
begin
  select count(*) into bad
    from awards
   where (kind = 'diploma'   and credits_required <> 120)
      or (kind = 'bachelors' and credits_required <> 180)
      or (kind = 'masters'   and credits_required <> 120);
  -- 'certificate' and 'doctorate' are absent on purpose. No credit figure has
  -- been ruled for the certificate, and a doctorate examined by thesis is not
  -- credit-rated; asserting a value for either would invent a regulation.
  if bad > 0 then
    raise exception '% award(s) still disagree with the credit ruling', bad;
  end if;
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   013_social_and_credential_authority.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — THE SOCIAL PIPELINE AND THE CREDENTIAL AUTHORITY
--
-- Run after 012_credit_framework.sql. Idempotent; destroys nothing.
--
-- Two of the three subsystems the university asked for. The third — proctored
-- online examinations — is deliberately absent: the university said "i will
-- give you details", and a schema written ahead of that specification would
-- have to be migrated away from rather than extended.
--
-- ===========================================================================
-- 1. THE SOCIAL PIPELINE
-- ===========================================================================
--
--   "administrators to create social media contents about the university and
--    post it and it immediately automate to all the university social media
--    accounts and also the administrator personal account provided they
--    connects it. The super admin can connect the system to all the social
--    medias and every admin can share their content without connecting.
--    individual administrators would only be given the option in their
--    settings to connect theirs."
--
-- THAT IS TWO KINDS OF ACCOUNT AND THEY MUST NOT SHARE A TABLE BY ACCIDENT.
-- A university account belongs to the institution: the Superadministrator
-- connects it once and every administrator may publish through it without
-- holding its credentials. A personal account belongs to a person: only that
-- person may connect it, only that person may revoke it, and nobody else may
-- publish through it — not the Superadministrator, not another administrator,
-- not a scheduled job acting on their behalf.
--
-- `scope` carries the distinction and a CHECK enforces the consequence: a
-- university account has no owner, a personal account must have one.
--
-- CONSENT IS PER POST, NOT PER CONNECTION. An administrator who once linked
-- their own account has not agreed that every future university announcement
-- goes out under their name for the rest of their employment. So the fan-out
-- ledger records each target explicitly, and section 1(d) refuses at the
-- database level to create a personal target for anyone but the post's author.
--
-- NO TOKEN IS STORED HERE. `token_ref` is a pointer into the secret store.
-- An OAuth refresh token is a standing permission to speak as the university;
-- putting one in an application table means every future SELECT bug, every
-- over-broad RLS policy and every database export is a credential leak.
--
-- ===========================================================================
-- 2. THE CREDENTIAL AUTHORITY
-- ===========================================================================
--
--   "the superadmin should have a special privilege to edit any version of the
--    certificates or degrees and print while forwarding the digital copy to
--    the student through email... the changes he make should automatically
--    register in the system. He is more of the VC of the university. He can
--    also create other kinds of certificate for different role that may not
--    even be academic."
--
-- AN ISSUED CREDENTIAL IS NEVER EDITED IN PLACE, and this is the one design
-- decision in this file that is not negotiable. 004_credential_register.sql
-- built the register on the principle that a sealed document is a statement
-- the university made on a date, and its content hash is what /verify checks.
-- Editing the row would change what the university appears to have said in
-- 2024, break every seal already in circulation, and leave no trace that a
-- correction ever happened.
--
-- So a correction SUPERSEDES. The original is marked 'replaced', a new
-- credential is issued with a new number and a new hash, and an amendment row
-- records who changed what, why, and which document replaced which. That is
-- what "the changes he make should automatically register in the system"
-- actually requires — a registry entry, not an UPDATE.
-- ===========================================================================


-- 1 (a) ---------------------------------------------------------------------
-- The accounts the system may speak through.

create table if not exists social_accounts (
  id              uuid primary key default gen_random_uuid(),

  -- 'university' — the institution's own account, connected once by the
  -- Superadministrator and usable by every administrator.
  -- 'personal'   — an administrator's own account, connected by them alone.
  scope           text not null check (scope in ('university', 'personal')),

  -- Null for a university account; the owner for a personal one. The CHECK
  -- below is what stops a personal account existing without a person, which
  -- would make it publishable by anybody.
  owner_id        uuid references auth.users (id) on delete cascade,

  platform        text not null check (platform in
                    ('facebook', 'instagram', 'x', 'linkedin', 'youtube', 'tiktok', 'threads')),

  -- What a human sees when choosing where to post.
  handle          text not null,
  display_name    text,
  avatar_url      text,

  -- The platform's own id for the page/profile, used when publishing.
  external_id     text,

  -- A POINTER, NOT A TOKEN. See the header. The secret store holds the access
  -- and refresh tokens; this column holds the key to look them up.
  token_ref       text,
  token_expires_at timestamptz,
  scopes          text[] not null default '{}'::text[],

  status          text not null default 'connected'
                    check (status in ('connected', 'expired', 'revoked', 'error')),
  last_error      text,

  connected_by    uuid references auth.users (id) on delete set null,
  connected_at    timestamptz not null default now(),
  revoked_at      timestamptz,

  constraint social_accounts_scope_owner check (
    (scope = 'university' and owner_id is null)
    or (scope = 'personal' and owner_id is not null)
  )
);

-- One connection per platform per owner. A second Facebook page for the
-- university is a second row with a different external_id, which is why the
-- key includes it.
create unique index if not exists social_accounts_unique
  on social_accounts (scope, coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), platform, coalesce(external_id, handle));

create index if not exists social_accounts_owner_idx on social_accounts (owner_id) where owner_id is not null;


-- 1 (b) ---------------------------------------------------------------------
-- The content itself. One post, many destinations.

create table if not exists social_posts (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null references auth.users (id) on delete restrict,

  body            text not null,
  link_url        text,

  -- Set by the author: do they also want this on their own connected
  -- accounts? Recorded on the POST, not inferred from the connection, because
  -- linking an account once is not consent for every future announcement.
  include_personal boolean not null default false,

  scheduled_for   timestamptz,

  status          text not null default 'draft'
                    check (status in ('draft', 'scheduled', 'publishing', 'published', 'partially_failed', 'failed', 'cancelled')),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  published_at    timestamptz
);

create index if not exists social_posts_status_idx on social_posts (status, scheduled_for);
create index if not exists social_posts_author_idx on social_posts (author_id);

create table if not exists social_post_media (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references social_posts (id) on delete cascade,
  storage_path text not null,
  -- REQUIRED, not optional. A university publishing an image with no alt text
  -- is publishing something a blind reader cannot see, and every platform
  -- carries the omission onward.
  alt_text    text not null,
  ordinal     integer not null default 0
);

create index if not exists social_post_media_post_idx on social_post_media (post_id, ordinal);


-- 1 (c) ---------------------------------------------------------------------
-- The fan-out ledger: one row per account this post is going to.
--
-- A post that succeeds on four platforms and fails on the fifth is not
-- "published" and is not "failed". Without a row per destination there is
-- nowhere to record that, and the administrator is left refreshing a page that
-- says nothing useful.

create table if not exists social_post_targets (
  id             uuid primary key default gen_random_uuid(),
  post_id        uuid not null references social_posts (id) on delete cascade,
  account_id     uuid not null references social_accounts (id) on delete restrict,

  status         text not null default 'pending'
                   check (status in ('pending', 'sending', 'posted', 'failed', 'skipped')),
  attempts       integer not null default 0,
  external_post_id text,
  external_url   text,
  last_error     text,

  queued_at      timestamptz not null default now(),
  posted_at      timestamptz,

  unique (post_id, account_id)
);

create index if not exists social_post_targets_pending_idx
  on social_post_targets (status) where status in ('pending', 'sending');


-- 1 (d) ---------------------------------------------------------------------
-- NOBODY POSTS TO SOMEBODY ELSE'S ACCOUNT.
--
-- Enforced in the database, not in the interface. A trigger, because the rule
-- spans two tables and a CHECK constraint cannot see across a foreign key.
--
-- This is the rule that protects a member of staff from having the university
-- speak in their name, and it is exactly the kind of rule that survives in a
-- specification and dies in a refactor unless the database holds it.

create or replace function social_target_consent() returns trigger
  language plpgsql as $$
declare
  acct social_accounts%rowtype;
  post social_posts%rowtype;
begin
  select * into acct from social_accounts where id = new.account_id;
  select * into post from social_posts   where id = new.post_id;

  if acct.scope = 'personal' then
    if acct.owner_id is distinct from post.author_id then
      raise exception
        'A personal social account may only be a target of its own owner''s post '
        '(account owner %, post author %)', acct.owner_id, post.author_id;
    end if;
    if not post.include_personal then
      raise exception
        'This post is not marked to include personal accounts; the author must opt in per post.';
    end if;
  end if;

  if acct.status <> 'connected' then
    raise exception 'Social account % is %, not connected', acct.id, acct.status;
  end if;

  return new;
end $$;

drop trigger if exists social_target_consent_trg on social_post_targets;
create trigger social_target_consent_trg
  before insert or update on social_post_targets
  for each row execute function social_target_consent();


-- 1 (e) ---------------------------------------------------------------------
-- ONE POST, MANY VOICES.
--
-- "Create once -> review once -> publish everywhere" does NOT mean publishing
-- identical text everywhere. LinkedIn wants a paragraph, X wants a sentence,
-- Instagram wants a caption and hashtags, and a university that posts the same
-- 400 words to all six reads as a bot on five of them.
--
-- So the post holds the INTENT and a variant holds what each platform actually
-- receives. A variant with no row falls back to the post body, which is what
-- makes the simple case simple.
--
-- `source` records whether a human wrote it or the assistant drafted it. That
-- is not bookkeeping: the university asked that "the administrator remains in
-- control and approves before publishing", and an approval means nothing if
-- nobody can tell afterwards which words were generated.

create table if not exists social_post_variants (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references social_posts (id) on delete cascade,
  platform     text not null check (platform in
                 ('facebook', 'instagram', 'x', 'linkedin', 'youtube', 'tiktok', 'threads')),

  body         text not null,
  hashtags     text[] not null default '{}'::text[],

  source       text not null default 'human' check (source in ('human', 'assistant')),
  -- Edited by a human after the assistant drafted it. Distinct from 'human',
  -- because "reviewed and changed" is a different fact from "written from
  -- scratch" and the audit answer differs.
  edited_by    uuid references auth.users (id) on delete set null,
  approved_by  uuid references auth.users (id) on delete set null,
  approved_at  timestamptz,

  created_at   timestamptz not null default now(),
  unique (post_id, platform)
);


-- 1 (f) ---------------------------------------------------------------------
-- Engagement, pulled back from each platform after publication.
--
-- A SNAPSHOT TABLE, NOT A RUNNING TOTAL. Every platform revises its own
-- numbers — a like is withdrawn, a video's view count is recounted — and a
-- single mutable "likes" column loses the history every time it is refreshed.
-- Rows are cheap; a chart of reach over the week after a graduation
-- announcement is not reconstructible from a number that was overwritten.

create table if not exists social_post_metrics (
  id           uuid primary key default gen_random_uuid(),
  target_id    uuid not null references social_post_targets (id) on delete cascade,
  captured_at  timestamptz not null default now(),
  impressions  integer,
  reach        integer,
  likes        integer,
  comments     integer,
  shares       integer,
  clicks       integer,
  video_views  integer,
  raw          jsonb not null default '{}'::jsonb
);

create index if not exists social_post_metrics_target_idx
  on social_post_metrics (target_id, captured_at desc);


-- 2 (a) ---------------------------------------------------------------------
-- CREDENTIAL TYPES — what kinds of instrument this university awards.
--
-- "Create New Credential... name, category, template, eligibility, authority,
-- validity, verification." This is the table that makes the system not a
-- degree printer: a Certificate of Excellence in Christian Leadership and a
-- Bachelor of Theology are both credentials and must never be confused.
--
-- `category` IS THE GUARD AGAINST THE WORST FAILURE THIS SYSTEM COULD HAVE.
-- The university was explicit: "the system should clearly classify them so
-- nobody mistakes an institutional certificate for an accredited academic
-- degree." A certificate of appreciation that renders like a degree, verifies
-- like a degree and is filed like a degree IS a fake degree, whatever the
-- title says. So the category is required, constrained, and carried onto the
-- issued credential and into verification.

create table if not exists credential_types (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  name           text not null,

  category       text not null check (category in
                   ('academic', 'professional', 'ministry', 'institutional', 'honorary')),

  -- Academic awards say so, in a boolean, so that no query has to parse a
  -- category string to answer "is this a degree".
  is_academic    boolean not null default false,

  template_id    uuid references credential_templates (id) on delete set null,

  -- Who may receive it, and who may confer it. Free-form prose for the first
  -- because eligibility is a policy sentence; a role for the second because it
  -- is enforced.
  eligibility    text,
  issuing_role   text not null default 'registrar',

  validity       text not null default 'permanent'
                   check (validity in ('permanent', 'expiring')),
  validity_months integer,

  verification_enabled boolean not null default true,

  status         text not null default 'draft'
                   check (status in ('draft', 'active', 'retired')),

  created_by     uuid references auth.users (id) on delete set null,
  approved_by    uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),

  -- An expiring credential with no period is a credential that never expires
  -- while claiming to.
  constraint credential_types_validity check (
    validity = 'permanent' or (validity = 'expiring' and validity_months is not null)
  ),
  -- An academic award in a non-academic category is the confusion this table
  -- exists to prevent.
  constraint credential_types_academic_category check (
    (is_academic and category = 'academic') or (not is_academic)
  )
);


-- 2 (b) ---------------------------------------------------------------------
-- THE TEMPLATE STUDIO EXTENDS THE EXISTING LIBRARY. IT DOES NOT REPLACE IT.
--
-- THIS SECTION WAS WRONG WHEN FIRST WRITTEN AND THE DATABASE CAUGHT IT. It
-- opened with `create table if not exists credential_templates (...)` carrying
-- a fresh design — code, title, category, layout, status. That table already
-- exists: 000_complete.sql built it and 005_senate_approval.sql gave it a
-- publication gate. So the CREATE silently did nothing, every column named in
-- it was absent, and the migration failed on the next line with "column status
-- does not exist".
--
-- Silently. That is the part worth keeping in the file. `if not exists` turns
-- a redefinition into a no-op, so a second, incompatible design for a table
-- that already holds published certificate artwork raises nothing at all — the
-- error surfaced two statements later on an index, pointing at the wrong
-- cause. Had 013 not touched `status`, this would have shipped, and the
-- application would have been written against columns the database has never
-- had.
--
-- WHAT IS ALREADY THERE, AND WHY NONE OF IT MAY BE THROWN AWAY:
--
--   design jsonb          the artwork, as data
--   kind                  'certificate' | 'transcript'
--   version, is_active    versioned, with one active design per kind
--   lifecycle             draft -> submitted -> approved -> published -> withdrawn
--   credential_templates_immutable    a published design cannot be edited
--   credential_templates_publication  three offices — Registrar, Academic
--                                     Office, Vice Chancellor — must each
--                                     approve before it may be published
--
-- That last trigger is the university's own separation of duties, written in
-- 005. The Superadministrator asked for the power to design certificates; that
-- is granted. The power to design one AND publish it alone was not asked for
-- and is not given here.
--
-- WHAT THIS MIGRATION ADDS. Two things, both additive:
--
--   type_id   which credential type this design is the artwork for, so that a
--             new type created under point 6 can carry its own certificate
--             rather than borrowing the one design allowed per `kind`.
--   fields    the merge fields the design declares — {{student.full_name}},
--             {{credential.number}} — named explicitly rather than discovered
--             by scanning the artwork, so the studio can tell an author that a
--             field will render blank BEFORE the document is sealed.

alter table credential_templates add column if not exists type_id uuid
  references credential_types (id) on delete restrict;
alter table credential_templates add column if not exists fields jsonb not null default '[]'::jsonb;

-- ONE ACTIVE DESIGN PER TYPE, not one per kind.
--
-- 000 declared `unique (kind) where is_active`, which was right when there
-- were exactly two kinds and no types. Under point 6 the university may create
-- a Certificate of Ordination and a Certificate of Appreciation, and both are
-- kind='certificate'; the old index would let only one of them have artwork.
--
-- coalesce, not NULLS NOT DISTINCT: the latter is Postgres 15+, and this file
-- should not be the reason a migration fails on an older instance. The
-- sentinel groups every untyped design together, which preserves exactly the
-- old rule for the house certificate and transcript.
drop index if exists credential_templates_one_active;
create unique index if not exists credential_templates_one_active_per_type
  on credential_templates (kind, coalesce(type_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where is_active;


-- 2 (c) ---------------------------------------------------------------------
-- The amendment register.
--
-- A CORRECTION SUPERSEDES; IT DOES NOT OVERWRITE. See the header. The original
-- credential keeps its number, its hash and its date and is marked 'replaced';
-- a new credential is issued; this row is the link between them and the reason.

create table if not exists credential_amendments (
  id                   uuid primary key default gen_random_uuid(),

  original_id          uuid not null references credentials_issued (id) on delete restrict,
  replacement_id       uuid references credentials_issued (id) on delete set null,

  -- What actually changed, field by field, as {field: {from, to}}. A reason
  -- alone is not an audit trail — the question asked years later is "what did
  -- it say before", and only this column answers it.
  changes              jsonb not null default '{}'::jsonb,

  -- Why. Free text and REQUIRED: a correction to a person's name or award on a
  -- sealed document without a stated reason is indistinguishable from tampering.
  reason               text not null,

  amended_by           uuid not null references auth.users (id) on delete restrict,
  amended_at           timestamptz not null default now(),

  -- "forwarding the digital copy to the student through email"
  emailed_to           text,
  emailed_at           timestamptz,
  printed_at           timestamptz,

  constraint credential_amendments_reason_not_blank check (length(btrim(reason)) > 0)
);

create index if not exists credential_amendments_original_idx on credential_amendments (original_id);



-- 2 (d) ---------------------------------------------------------------------
-- VERSIONING ON THE ISSUED CREDENTIAL.
--
-- The register already had `replaced_by` and a 'replaced' status. What it did
-- not have is a version NUMBER and a link backwards, and without those the
-- history the university drew — "Version 1, superseded, name correction ->
-- Version 2, current" — cannot be rendered, because there is no way to ask a
-- credential which number it is or what it came from.
--
-- `credential_id` stays STABLE ACROSS VERSIONS. IGUC-BTH-2026-00125 is the
-- award; v1 and v2 are what the university has said about it. A QR code
-- printed on v1 must resolve to the award and be told the current version — 
-- see the university's point 9 — which is impossible if each version invents
-- a new number.

alter table credentials_issued add column if not exists version        integer not null default 1;
alter table credentials_issued add column if not exists supersedes_id  uuid references credentials_issued (id) on delete set null;
alter table credentials_issued add column if not exists type_id        uuid references credential_types (id) on delete set null;
alter table credentials_issued add column if not exists template_id    uuid references credential_templates (id) on delete set null;

-- THE COLUMNS ABOVE WERE NOT ENOUGH, AND THE DATABASE PROVED IT.
--
-- 004 declared `credential_id text not null unique`. That single word made the
-- entire versioning design impossible: version 2 of IGUC-BTH-2026-00125 is a
-- second row carrying the same credential_id, and the unique constraint refuses
-- it. Adding the columns, the index and the foreign key all succeeded; the
-- first actual amendment would have failed with "duplicate key value violates
-- unique constraint", months later, in front of a graduate waiting for a
-- corrected certificate.
--
-- Nothing in the first draft of this migration would have caught that. It
-- asserted that tables existed and that triggers existed — not that the one
-- operation the whole subsystem is FOR could be performed. Section 3 now
-- performs it.
--
-- WHY THE CONSTRAINT IS REPLACED RATHER THAN DROPPED. 004's reasoning for it
-- still holds: a credential number is random rather than sequential, and
-- uniqueness is what makes that safe. So the guarantee is preserved and
-- narrowed — one row per (number, version) instead of one row per number — and
-- the version chain trigger below supplies what the narrower constraint alone
-- would lose: that two rows sharing a number are genuinely the same award,
-- rather than two different awards that collided.

alter table credentials_issued drop constraint if exists credentials_issued_credential_id_key;

create unique index if not exists credentials_issued_ref_version
  on credentials_issued (credential_id, version);

create index if not exists credentials_issued_version_idx
  on credentials_issued (credential_id, version desc);

-- THE VERSION CHAIN MUST BE A CHAIN.
--
-- Without this, `unique (credential_id, version)` would let two unrelated
-- awards share a number as long as their version numbers differed — which is
-- worse than the constraint it replaced, because /verify resolves by number and
-- would show one graduate's award as a version of another's.
--
-- A CHECK constraint cannot express this: it needs to look at another row. So
-- it is a trigger, and it enforces three things —
--
--   version 1 is an original and supersedes nothing
--   version n > 1 supersedes something
--   what it supersedes is the previous version OF THE SAME AWARD
create or replace function guard_credential_version() returns trigger
language plpgsql as $$
declare
  prior record;
begin
  if new.version < 1 then
    raise exception 'a credential version is 1 or greater; got %', new.version;
  end if;

  if new.version = 1 then
    if new.supersedes_id is not null then
      raise exception 'version 1 of a credential is an original and cannot supersede anything';
    end if;
    return new;
  end if;

  if new.supersedes_id is null then
    raise exception
      'version % of % must say which version it replaces. A correction that does not point at '
      'what it corrected is an edit with extra steps.', new.version, new.credential_id;
  end if;

  select credential_id, version into prior
    from credentials_issued where id = new.supersedes_id;

  if prior is null then
    raise exception 'the credential this version supersedes does not exist';
  end if;

  if prior.credential_id is distinct from new.credential_id then
    raise exception
      'version % claims number % but supersedes %, which is a different award. '
      'Two awards must never share a credential number.',
      new.version, new.credential_id, prior.credential_id;
  end if;

  if prior.version <> new.version - 1 then
    raise exception
      'version % must supersede version %, not version %. The history has to be continuous or '
      'it cannot be read back.', new.version, new.version - 1, prior.version;
  end if;

  return new;
end $$;

drop trigger if exists credentials_version_chain on credentials_issued;
create trigger credentials_version_chain
  before insert on credentials_issued
  for each row execute function guard_credential_version();


-- 2 (e) ---------------------------------------------------------------------
-- THE CORRECTION REQUEST. Students do not edit their own credentials.
--
-- The route the university drew: student requests -> registrar reviews ->
-- escalated if required -> Credential Authority approves -> new version.
-- Every one of those is a state, and the states are the point: a correction
-- that skips review is an edit, and an edit to a sealed document is the thing
-- this whole design exists to prevent.

create table if not exists credential_correction_requests (
  id             uuid primary key default gen_random_uuid(),
  credential_id  uuid not null references credentials_issued (id) on delete restrict,
  student_id     uuid references students (id) on delete set null,
  requested_by   uuid not null references auth.users (id) on delete restrict,

  description    text not null,
  -- What the student says it should say, field by field. Proposed, never
  -- applied: the authority decides what is actually changed.
  proposed       jsonb not null default '{}'::jsonb,
  evidence       text[] not null default '{}'::text[],

  status         text not null default 'submitted' check (status in
                   ('submitted', 'under_review', 'escalated', 'approved', 'rejected', 'withdrawn')),

  reviewed_by    uuid references auth.users (id) on delete set null,
  reviewed_at    timestamptz,
  review_note    text,

  escalated_at   timestamptz,
  decided_by     uuid references auth.users (id) on delete set null,
  decided_at     timestamptz,
  decision_note  text,

  -- Filled when the correction produces a new version.
  amendment_id   uuid references credential_amendments (id) on delete set null,

  created_at     timestamptz not null default now(),

  constraint correction_description_not_blank check (length(btrim(description)) > 0),
  -- A rejection with no reason is a decision a student cannot appeal.
  constraint correction_rejection_has_note check (
    status <> 'rejected' or length(btrim(coalesce(decision_note, ''))) > 0
  )
);

create index if not exists correction_requests_status_idx
  on credential_correction_requests (status, created_at desc);


-- 2 (f) ---------------------------------------------------------------------
-- THE AUDIT TRAIL, AND IT IS IMMUTABLE IN THE DATABASE.
--
-- "Every important action should produce an immutable audit event." Immutable
-- is a word most systems use to mean "we do not have an edit screen for it".
-- Here it means the database refuses: a trigger blocks UPDATE and DELETE on
-- this table for every caller, including the service role and including the
-- Superadministrator.
--
-- That is the point. An audit trail the most powerful account can edit is not
-- an audit trail of that account, and the most powerful account is precisely
-- the one this table exists to hold to the record.

create table if not exists credential_audit_events (
  id             uuid primary key default gen_random_uuid(),

  credential_id  uuid references credentials_issued (id) on delete set null,
  -- Kept as TEXT as well, because the row must survive the credential being
  -- deleted and still say which award it was about.
  credential_ref text,

  action         text not null check (action in
                   ('issued', 'corrected', 'reissued', 'revoked', 'reinstated',
                    'printed', 'emailed', 'template_created', 'template_published',
                    'type_created', 'correction_requested', 'correction_reviewed',
                    'correction_approved', 'correction_rejected')),

  from_version   integer,
  to_version     integer,
  reason         text,

  actor_id       uuid references auth.users (id) on delete set null,
  actor_role     text,
  actor_email    text,
  ip             inet,
  user_agent     text,

  document_hash  text,
  detail         jsonb not null default '{}'::jsonb,

  occurred_at    timestamptz not null default now()
);

create index if not exists credential_audit_credential_idx
  on credential_audit_events (credential_id, occurred_at desc);
create index if not exists credential_audit_actor_idx
  on credential_audit_events (actor_id, occurred_at desc);

create or replace function credential_audit_is_append_only() returns trigger
  language plpgsql as $$
begin
  raise exception
    'credential_audit_events is append-only. % is refused: an audit trail that can be '
    'rewritten is not an audit trail of whoever can rewrite it.', tg_op;
end $$;

drop trigger if exists credential_audit_no_update on credential_audit_events;
create trigger credential_audit_no_update
  before update or delete on credential_audit_events
  for each row execute function credential_audit_is_append_only();


-- 2 (g) ---------------------------------------------------------------------
-- ROW-LEVEL SECURITY, FOR EVERY TABLE THIS FILE ADDS.
--
-- Every one of them is off-limits by default. The writes are made by guarded
-- API routes running as the service role, in the pattern 009 established for
-- results: the rules are about WHO the caller is and WHICH STEP they are on,
-- and neither is expressible as a row predicate.
--
-- The exceptions below are the ones that ARE row predicates — a person reading
-- their own connections, a student reading their own correction request — and
-- those belong here rather than in a route, because a rule enforced by the
-- database cannot be forgotten by the next route somebody writes.
--
-- NOTE ON `credential_templates`: not listed. 000 already enabled RLS on it and
-- gave it a public read policy. It is left exactly as it was.

alter table social_accounts                enable row level security;
alter table social_posts                   enable row level security;
alter table social_post_media              enable row level security;
alter table social_post_targets            enable row level security;
alter table social_post_variants           enable row level security;
alter table social_post_metrics            enable row level security;
alter table credential_types               enable row level security;
alter table credential_amendments          enable row level security;
alter table credential_correction_requests enable row level security;
alter table credential_audit_events        enable row level security;

-- YOUR OWN CONNECTIONS, AND ONLY YOURS.
--
-- This is the university's "An administrator should never receive the
-- credentials or tokens of another administrator" written as a row predicate.
-- `owner_id = auth.uid()` is false for every university account (owner_id is
-- null there) and false for every other person's, so a signed-in administrator
-- reading this table sees their own connections and nothing else — including
-- when the route that queried it forgot a WHERE clause.
drop policy if exists social_accounts_own_read on social_accounts;
create policy social_accounts_own_read on social_accounts
  for select using (owner_id = auth.uid());

-- Revoking your own connection is yours alone and needs no route.
drop policy if exists social_accounts_own_revoke on social_accounts;
create policy social_accounts_own_revoke on social_accounts
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- A credential type is public knowledge — what awards this university makes is
-- exactly the thing a verifier needs to read.
drop policy if exists credential_types_public_read on credential_types;
create policy credential_types_public_read on credential_types
  for select using (status = 'active');

-- A student may see their own correction requests and no one else's.
drop policy if exists correction_requests_own_read on credential_correction_requests;
create policy correction_requests_own_read on credential_correction_requests
  for select using (requested_by = auth.uid());


-- 3 -------------------------------------------------------------------------
-- Proof that it landed.

do $$
declare
  n integer;
  ok boolean;
begin
  select count(*) into n from information_schema.tables
   where table_schema = 'public'
     and table_name in ('social_accounts', 'social_posts', 'social_post_media',
                        'social_post_targets', 'social_post_variants',
                        'social_post_metrics', 'credential_templates',
                        'credential_types', 'credential_amendments',
                        'credential_correction_requests', 'credential_audit_events');
  if n <> 11 then
    raise exception 'Expected 11 tables for the two subsystems, found %', n;
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'social_target_consent_trg') then
    raise exception 'The personal-account consent trigger is missing; a member of staff could be posted as.';
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'credential_audit_no_update') then
    raise exception 'The audit trail is editable. That is not an audit trail.';
  end if;

  -- THE COLUMNS, NOT JUST THE TABLES. The first draft of this file assumed
  -- `create table if not exists credential_templates` had created what it
  -- described; the table already existed, the CREATE did nothing, and none of
  -- its columns were there. Counting tables would not have caught that. So
  -- check that the two columns 2(b) adds are actually present.
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'credential_templates'
       and column_name in ('type_id', 'fields')
     group by table_name having count(*) = 2
  ) then
    raise exception
      'credential_templates is missing type_id and/or fields. The Template Studio cannot bind a design to a credential type.';
  end if;

  -- And that the three-office publication gate from 005 is still standing.
  -- Nothing in this file touches it, which is exactly why it is worth
  -- asserting: a later migration that dropped and recreated the table would
  -- take the gate with it and nothing else would notice.
  if not exists (select 1 from pg_trigger where tgname = 'credential_templates_publication') then
    raise exception
      'The three-office approval gate on template publication is gone. A design could be published without the Registrar, the Academic Office or the Vice Chancellor.';
  end if;

  -- Prove the append-only rule rather than trusting the trigger exists.
  --
  -- THE ROW THIS LEAVES BEHIND IS DELIBERATE AND CANNOT BE REMOVED — that is
  -- what append-only means, and it applies to this migration as much as to the
  -- Vice-Chancellor. The first entry in the University's credential audit trail
  -- is the record that the audit trail was installed and proven on the day it
  -- was installed. That is a reasonable thing for it to say.
  insert into credential_audit_events (action, reason)
  values ('issued', 'Installation self-test - migration 013. The audit trail was proven append-only at install.');
  begin
    update credential_audit_events set reason = 'tampered'
     where reason like 'Installation self-test%';
    raise exception 'The audit trail accepted an UPDATE. Refusing to complete.';
  exception when others then
    if sqlerrm like '%append-only%' then
      ok := true;
    else
      raise;
    end if;
  end;

  -- ---------------------------------------------------------------------
  -- PROVE THAT A CREDENTIAL CAN ACTUALLY BE AMENDED.
  --
  -- Everything above this point checks that things EXIST. This checks that the
  -- one operation the whole subsystem is for can be performed — because the
  -- first draft of this migration passed every existence check while making
  -- amendment impossible. `credential_id` was UNIQUE, so version 2 of an award
  -- could never be written, and nothing said so until an amendment was
  -- attempted. That would have been months later, in front of a graduate.
  --
  -- So: issue a certificate, correct it, and confirm both versions survive.
  -- Then revoke and delete the test rows — which the register refuses, so they
  -- are marked instead and carry a holder name that says what they are.
  -- ---------------------------------------------------------------------
  declare
    v1 uuid;
    v2 uuid;
    ref text := 'IGUC-SELFTEST-013';
  begin
    -- Clear anything a previous run left, so this is idempotent. The register
    -- refuses DELETE by design, so a prior self-test is reused rather than
    -- removed: the unique index on (credential_id, version) makes a second
    -- insert of the same pair fail, which would look like the bug this block
    -- exists to detect.
    select id into v1 from credentials_issued where credential_id = ref and version = 1;

    if v1 is null then
      insert into credentials_issued
        (credential_id, kind, holder_name, facts, content_hash, seal_code, version)
      values (ref, 'certificate', 'Installation self-test - migration 013',
              '{}'::jsonb, 'selftest-v1', 'selftest-v1', 1)
      returning id into v1;
    end if;

    select id into v2 from credentials_issued where credential_id = ref and version = 2;

    if v2 is null then
      begin
        insert into credentials_issued
          (credential_id, kind, holder_name, facts, content_hash, seal_code, version, supersedes_id)
        values (ref, 'certificate', 'Installation self-test - migration 013 (corrected)',
                '{}'::jsonb, 'selftest-v2', 'selftest-v2', 2, v1)
        returning id into v2;
      exception when unique_violation then
        raise exception
          'A CREDENTIAL CANNOT BE AMENDED. Version 2 was refused because credential_id is still '
          'uniquely constrained on its own. Every correction the University makes would fail. %', sqlerrm;
      end;
    end if;

    -- Both versions must survive. That is "never destroy the previous
    -- certificate", checked rather than asserted.
    if (select count(*) from credentials_issued where credential_id = ref) <> 2 then
      raise exception 'Amendment did not leave two versions. The previous certificate was destroyed.';
    end if;

    -- And the chain must refuse a version that claims to belong to another award.
    begin
      insert into credentials_issued
        (credential_id, kind, holder_name, facts, content_hash, seal_code, version, supersedes_id)
      values ('IGUC-SELFTEST-013-OTHER', 'certificate', 'Should not exist',
              '{}'::jsonb, 'x', 'x', 3, v2);
      raise exception 'Two different awards were allowed to share a version chain.';
    exception when others then
      if sqlerrm not like '%different award%' then raise; end if;
    end;

    -- Mark the self-test rows so nobody mistakes them for a real award. They
    -- cannot be deleted — the register refuses deletion, on purpose.
    update credentials_issued
       set status = 'revoked',
           revocation_reason = 'Installation self-test row from migration 013. Not a real credential.'
     where credential_id = ref and status <> 'revoked';
  end;

  raise notice 'Social pipeline and Credential Authority installed: 11 tables, consent enforced, audit trail append-only.';
  raise notice 'Amendment proven: a credential can be corrected to version 2 and version 1 survives.';
  raise notice 'Proctored examinations are NOT in this migration - awaiting the university''s specification.';
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   014_social_approval_and_retry.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — APPROVAL, SCHEDULING AND RETRY FOR THE COMMAND CENTRE
--
-- Run after 013_social_and_credential_authority.sql. Idempotent; destroys
-- nothing.
--
-- ===========================================================================
-- WHY A POST NEEDS AN APPROVAL STATE OF ITS OWN
-- ===========================================================================
--
-- 013 gave `social_posts` a status: draft, scheduled, publishing, published,
-- partially_failed, failed, cancelled. Every one of those describes what has
-- happened to the post MECHANICALLY — where it is in the pipeline.
--
-- None of them answers the question an approval workflow exists to ask: has a
-- person with the authority to speak for this University read these words and
-- agreed to them?
--
-- Folding approval into the same column would have forced a choice between
-- "approved" and "scheduled" for a post that is both, and would have made
-- "rejected" a sibling of "failed" — conflating an editorial decision with a
-- network timeout. They are different facts about different things, so they
-- are different columns.
--
-- ===========================================================================
-- WHY REJECTION CARRIES A NOTE AND APPROVAL DOES NOT
-- ===========================================================================
--
-- The same asymmetry as the credential correction workflow, for the same
-- reason. An approval needs no explanation — the words stand as written. A
-- rejection without one leaves the author guessing which sentence was the
-- problem, and the usual outcome is the same post resubmitted unchanged.
--
-- ===========================================================================
-- RETRY IS A COUNTER, NOT A NEW ROW
-- ===========================================================================
--
-- When one network refuses a post that five accepted, the fix is to try that
-- one again — not to republish, which would duplicate the announcement on the
-- five that worked. So the target row is re-queued in place and counts its
-- attempts, and `last_attempt_at` and `last_error` say what happened last time.
--
-- A cap is deliberately NOT enforced in the database. A network that is down
-- for a day should be retried tomorrow, and a schema that refused the fourth
-- attempt would turn a temporary outage into a permanent gap in the record.
-- The interface stops offering the button; the database keeps the count.
-- ===========================================================================


-- 1 -------------------------------------------------------------------------
-- APPROVAL.

alter table social_posts add column if not exists approval_state text
  not null default 'draft'
  check (approval_state in ('draft', 'submitted', 'approved', 'rejected'));

alter table social_posts add column if not exists submitted_by  uuid references auth.users (id) on delete set null;
alter table social_posts add column if not exists submitted_at  timestamptz;
alter table social_posts add column if not exists approved_by   uuid references auth.users (id) on delete set null;
alter table social_posts add column if not exists approved_at   timestamptz;
alter table social_posts add column if not exists review_note   text;

-- A rejection a person cannot act on is not a review.
alter table social_posts drop constraint if exists social_posts_rejection_has_note;
alter table social_posts add constraint social_posts_rejection_has_note check (
  approval_state <> 'rejected' or length(btrim(coalesce(review_note, ''))) > 0
);

create index if not exists social_posts_approval_idx
  on social_posts (approval_state, created_at desc);

-- THE AUTHOR IS NOT THE APPROVER.
--
-- The same separation the University required of certificate designs in 005 and
-- of grades in 009: the office that writes does not sign off its own work. An
-- announcement is the institution speaking, and one person composing, approving
-- and publishing it alone is exactly the arrangement that puts an unconsidered
-- sentence on six networks under the University's name.
--
-- ENFORCED IN THE DATABASE rather than in a route, because the route that
-- approves and the route that publishes are different files and will be edited
-- by different people.
create or replace function guard_social_approval() returns trigger
language plpgsql as $$
begin
  if new.approval_state = 'approved'
     and old.approval_state is distinct from 'approved'
     and new.approved_by is not null
     and new.approved_by = new.author_id
  then
    raise exception
      'the author of a post may not approve it. Another administrator must read it first — '
      'that is what the approval step is for.';
  end if;
  return new;
end $$;

drop trigger if exists social_posts_approval_trg on social_posts;
create trigger social_posts_approval_trg
  before update on social_posts
  for each row execute function guard_social_approval();


-- 2 -------------------------------------------------------------------------
-- RETRY.

-- 013 ALREADY HAD MOST OF THIS. `attempts`, `last_error`, `external_url` and
-- `external_post_id` are on social_post_targets already, and the first draft of
-- this file re-added all four — a no-op that read as new work.
--
-- WHAT IS GENUINELY MISSING is `last_attempt_at`. Without it, "when did this
-- last fail" cannot be answered, and a retry queue that cannot say how long a
-- destination has been failing is a list rather than a queue.
--
-- The draft that removed the redundant columns removed this one too, and the
-- local database did not complain — because the FIRST draft had already added
-- it there. Only rebuilding the whole schema from empty caught it. That is what
-- the from-scratch run of RUN-ALL.sql is for, and it is why "it worked when I
-- re-ran it" is not evidence about a migration.
alter table social_post_targets add column if not exists last_attempt_at timestamptz;

-- THE COLUMN IS `status`, NOT `state`. Worth writing down, because the
-- TypeScript that reads this table called it `state` and used four values the
-- CHECK constraint does not accept — so the fan-out insert failed and nothing
-- could ever be published. See TargetState in src/lib/social.ts.
create index if not exists social_post_targets_retry_idx
  on social_post_targets (status, last_attempt_at)
  where status = 'failed';


-- WHAT THE ATTACHMENT ACTUALLY IS.
--
-- social_post_media has storage_path and alt_text but no way to say whether the
-- file is a photograph or a video. That distinction is load-bearing rather than
-- decorative: Instagram cannot publish without an image, YouTube and TikTok
-- cannot publish without a video, and the composer blocks a post that would be
-- refused by the network. Without this column it has nothing to test.
alter table social_post_media add column if not exists kind text
  not null default 'image' check (kind in ('image', 'video'));


-- 3 -------------------------------------------------------------------------
-- THE CALENDAR.
--
-- No new table. A content calendar is a QUERY over posts that have a date —
-- `scheduled_for` for what is planned, `published_at` for what went out — and a
-- second table holding "calendar entries" would immediately be able to disagree
-- with the posts it claimed to describe.
--
-- This index is what makes the month view a scan of a few rows rather than of
-- the whole publication history.
create index if not exists social_posts_calendar_idx
  on social_posts (coalesce(scheduled_for, published_at, created_at) desc);


-- 4 -------------------------------------------------------------------------
-- Proof that it landed.

do $$
declare
  n integer;
begin
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'social_posts'
     and column_name in ('approval_state', 'submitted_by', 'submitted_at',
                         'approved_by', 'approved_at', 'review_note');
  if n <> 6 then
    raise exception 'Expected 6 approval columns on social_posts, found %', n;
  end if;

  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'social_post_targets'
     and column_name in ('attempts', 'last_attempt_at', 'last_error', 'external_url');
  if n <> 4 then
    raise exception 'Expected the retry columns on social_post_targets, found %', n;
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'social_post_media' and column_name = 'kind'
  ) then
    raise exception 'social_post_media has no kind column; the composer cannot tell an image from a video.';
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'social_posts_approval_trg') then
    raise exception 'The self-approval guard is missing; one person could write, approve and publish alone.';
  end if;

  -- PROVE THE GUARD, rather than trusting that the trigger exists. 013 shipped
  -- with an existence check that passed while the operation it described was
  -- impossible; that is not repeated here.
  declare
    author uuid := '00000000-0000-0000-0000-0000000000aa';
    post   uuid;
    refused boolean := false;
  begin
    insert into auth.users (id, email)
    values (author, 'selftest-014@iguc.net')
    on conflict (id) do nothing;

    insert into social_posts (author_id, body, approval_state)
    values (author, 'Installation self-test - migration 014.', 'submitted')
    returning id into post;

    begin
      update social_posts
         set approval_state = 'approved', approved_by = author, approved_at = now()
       where id = post;
    exception when others then
      if sqlerrm like '%may not approve it%' then refused := true; else raise; end if;
    end;

    if not refused then
      raise exception 'An author was allowed to approve their own post. Refusing to complete.';
    end if;

    -- A post is not a sealed document; deleting the self-test row is fine and
    -- leaves the publication history clean.
    delete from social_posts where id = post;
    delete from auth.users where id = author;
  end;

  raise notice 'Command Centre approval and retry installed. Self-approval is refused, proven at install.';
end $$;

