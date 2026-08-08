-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — MIGRATIONS 006, 010, 011, 012, IN ORDER
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-migration-run.mjs
--   Rebuild:   node scripts/build-migration-run.mjs 006 010 011 012
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

