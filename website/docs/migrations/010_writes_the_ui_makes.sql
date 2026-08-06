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
