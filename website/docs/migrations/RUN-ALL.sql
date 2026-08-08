-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — MIGRATIONS 000, 003, 004, 005, 006, 007, 008, 009, 010, 011, 012, IN ORDER
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-migration-run.mjs
--   Rebuild:   node scripts/build-migration-run.mjs --out=RUN-ALL.sql 000 003 004 005 006 007 008 009 010 011 012
--
-- ---------------------------------------------------------------------------
-- HOW TO RUN IT
--
-- Supabase SQL editor: paste the whole file and run once.
-- psql:                psql "<connection string>" -f docs/migrations/RUN-ALL.sql
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
-- BEFORE YOU RUN THIS ONE — it starts from an empty database
--
-- 000_complete.sql appoints two administrators, and it can only appoint an
-- account that already exists. Create them first:
--
--   Dashboard -> Authentication -> Users -> Add user   (tick "Auto Confirm User")
--     superadmin@iguc.net   system custody
--     tchamer@aol.com       day-to-day administration
--
-- Running the file before they exist is harmless. It simply appoints nobody,
-- and you re-run that section afterwards.
--
-- AND AFTERWARDS, DO THE SECURITY CHECK at the foot of 000. Until it passes,
-- any signed-in student can make themselves a Superadministrator from the
-- browser console. That is not a formality.
--
-- ---------------------------------------------------------------------------
-- AFTERWARDS
--
-- Run docs/migrations/VERIFY.sql to see what landed.
-- ===========================================================================

-- ===========================================================================
-- ===========================================================================
--
--   000_complete.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — COMPLETE DATABASE SETUP
--
-- ONE FILE. Paste the whole thing into the Supabase SQL editor and press Run.
--   Dashboard → SQL Editor → New query → paste → Run
--
-- This is 001_full_schema.sql and 002_superadmin.sql merged into a single
-- script, in the right order, with nothing that creates something and then
-- replaces it later. If you run this, you do not need either of those files.
--
-- SAFE ON AN EMPTY PROJECT OR AN EXISTING ONE. Every statement is idempotent —
-- `create table if not exists`, `add column if not exists`, `drop policy if
-- exists` before each `create policy`. Running it twice changes nothing the
-- second time. It drops no table, truncates nothing and deletes no row.
--
-- BEFORE YOU RUN IT, create the two accounts it appoints, so section 14 has
-- something to promote:
--   Dashboard → Authentication → Users → Add user  (tick "Auto Confirm User")
--     superadmin@iguc.net   — system custody
--     tchamer@aol.com       — day-to-day administration
-- Running it first is harmless; just re-run section 14 afterwards.
--
-- AFTER IT FINISHES, do the three checks at the bottom. Section 15 (b) is the
-- one that matters: until it passes, any signed-in student can make themselves
-- a Superadministrator from the browser console.
-- ===========================================================================


-- ===========================================================================
-- 0. CLEAR THE GUARD TRIGGERS FIRST
--
-- These are recreated, correctly, in sections 10 and 11. They are dropped here
-- because an earlier version of this migration installed a guard that refused
-- any change to profiles.role unless the connection was the service role — and
-- the SQL editor is not the service role, it is `postgres`. That version
-- blocked its own appointment statements with
--
--   ERROR: role may only be changed by the Superadministrator
--
-- and, worse, would block section 6 of this file on a re-run, before the
-- corrected version had a chance to replace it. Dropping first makes this file
-- safe to run whether or not that earlier attempt left anything behind.
-- ===========================================================================

-- Wrapped, because `drop trigger if exists ... on profiles` still raises if
-- `profiles` itself does not exist — which is the case on a fresh project,
-- where section 2 has not run yet.
do $$
begin
  if to_regclass('public.profiles') is not null then
    drop trigger if exists profiles_guard_privileges      on profiles;
    drop trigger if exists profiles_guard_last_superadmin on profiles;
  end if;
end $$;


-- ===========================================================================
-- 1. EXTENSIONS
-- ===========================================================================

create extension if not exists "pgcrypto";  -- gen_random_uuid()


-- ===========================================================================
-- 2. CORE TABLES
--
-- Column names match src/lib/types.ts exactly. Rename anything here and the
-- portal stops reading it, so change both or neither.
-- ===========================================================================

create table if not exists departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text not null unique,
  faculty     text not null,
  head_name   text,
  created_at  timestamptz not null default now()
);

-- Mirrors auth.users. The portal reads a signed-in user's role from here, so a
-- role change is a row update rather than a token reissue.
create table if not exists profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'student',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists students (
  id                   uuid primary key default gen_random_uuid(),
  matric_no            text not null unique,
  first_name           text not null,
  last_name            text not null,
  middle_name          text,
  email                text,
  phone                text,
  date_of_birth        date,
  gender               text,
  nationality          text,
  state_of_origin      text,
  address              text,
  department_id        uuid references departments (id) on delete set null,
  program              text,
  degree_type          text,
  admission_year       integer,
  expected_graduation  integer,
  status               text not null default 'applicant',
  photo_url            text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists lecturers (
  id              uuid primary key default gen_random_uuid(),
  staff_id        text not null unique,
  first_name      text not null,
  last_name       text not null,
  title           text,
  email           text,
  phone           text,
  department_id   uuid references departments (id) on delete set null,
  specialization  text,
  photo_url       text,
  status          text not null default 'active',
  created_at      timestamptz not null default now()
);

create table if not exists courses (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  title          text not null,
  credit_unit    integer not null default 3,
  department_id  uuid references departments (id) on delete set null,
  level          integer,
  semester       integer,
  year           integer,
  lecturer_id    uuid references lecturers (id) on delete set null,
  description    text,
  is_elective    boolean not null default false,
  created_at     timestamptz not null default now()
);

create table if not exists enrollments (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students (id) on delete cascade,
  course_id      uuid not null references courses (id) on delete cascade,
  academic_year  integer,
  semester       integer,
  status         text not null default 'registered',
  enrolled_at    timestamptz not null default now(),
  unique (student_id, course_id, academic_year, semester)
);

create table if not exists results (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students (id) on delete cascade,
  course_id      uuid not null references courses (id) on delete cascade,
  enrollment_id  uuid references enrollments (id) on delete set null,
  ca_score       numeric(5,2),
  exam_score     numeric(5,2),
  total_score    numeric(5,2),
  grade          text,
  grade_point    numeric(3,2),
  status         text not null default 'draft',
  submitted_by   uuid,
  approved_by    uuid,
  submitted_at   timestamptz,
  approved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists documents (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students (id) on delete cascade,
  file_name      text not null,
  file_url       text not null,
  file_type      text,
  document_type  text,
  verified       boolean not null default false,
  uploaded_at    timestamptz not null default now()
);

create table if not exists audit_logs (
  id            uuid primary key default gen_random_uuid(),
  action        text not null,
  entity_type   text,
  entity_id     text,
  performed_by  uuid,
  details       jsonb,
  ip_address    text,
  created_at    timestamptz not null default now()
);

-- One row per published credential design. Publishing writes a NEW row rather
-- than editing the active one, so a certificate issued under v1 can always be
-- re-rendered as it was issued. Editing a design in place would change what the
-- university appears to have attested to, for every graduate holding it.
create table if not exists credential_templates (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('certificate', 'transcript')),
  version       integer not null,
  name          text not null,
  design        jsonb not null,
  is_active     boolean not null default false,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  published_at  timestamptz,
  unique (kind, version)
);


-- Component marks.
--
-- The university has adopted its published four-part assessment scheme, so a
-- result is no longer a CA mark and an exam mark. `results` kept ca_score and
-- exam_score, which weighted the examination at 60% where the regulations say
-- 30% and had nowhere at all to record participation or presentations.
--
-- Stored as jsonb rather than as four columns because the scheme differs by
-- level: undergraduate courses are marked on participation, assignments,
-- examinations and presentations; master's courses on participation, research
-- paper, presentations and final examination; thesis courses on proposal,
-- methodology and final presentation. Four fixed columns would fit one of the
-- three and mislabel the others.
--
-- `scheme` records WHICH scheme the marks were entered under, alongside the
-- marks themselves. That is what makes an old result readable after the
-- regulations change: without it, a 2026 result would be re-weighted by a 2030
-- scheme and the transcript would quietly restate a grade the student was never
-- given.
--
-- ca_score and exam_score are kept, not dropped. They hold every mark entered
-- before this change and dropping them would destroy that record.
alter table results
  add column if not exists components jsonb,
  add column if not exists scheme     text;


-- Payments. Receipts were being written into `documents` as base64-encoded
-- JSON, with the amount readable only by regex over the filename — which also
-- contains the student's name, so a name with a digit in it silently dropped
-- that payment from the totals. A financial record has to be a row: queryable,
-- summable, and visible to an audit that does not know an encoding.
--
-- `amount` is numeric, not text. Money held as text sorts "9,000" above
-- "10,000" and cannot be summed in SQL at all.
--
-- Currency is stored per row and never converted. The university charges two
-- bands — the ICOF scholarship rate for African and Global South students, and
-- a European rate for everyone else — so a single figure across both would be
-- meaningless. Reports group by currency.
create table if not exists payments (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid references students (id) on delete set null,
  reference     text not null unique,
  amount        numeric(14,2) not null check (amount > 0),
  currency      text not null check (currency in ('FCFA','USD','EUR','GBP','NGN')),
  purpose       text not null,
  method        text,
  -- Who took the money. Finance verifies payments; nobody else may.
  received_by   uuid references auth.users (id) on delete set null,
  received_at   timestamptz not null default now(),
  note          text,
  created_at    timestamptz not null default now()
);


-- ===========================================================================
-- 3. ADMISSIONS PIPELINE COLUMNS
--
-- What the Finance desk and the Registrar's desk write.
-- ===========================================================================

alter table students
  add column if not exists payment_status       text default 'pending',
  add column if not exists fee_reference        text,
  add column if not exists fee_amount           text,
  add column if not exists fee_currency         text,
  add column if not exists fee_registered_by    uuid,
  add column if not exists fee_registered_at    timestamptz,
  add column if not exists decision_reason      text,
  add column if not exists decided_by           uuid,
  add column if not exists decided_at           timestamptz,
  add column if not exists account_created_at   timestamptz,
  add column if not exists admission_conditions jsonb,
  add column if not exists student_number       text,
  add column if not exists faculty              text,
  add column if not exists intake               text,
  -- Where and how often the student studies. Neither was stored: the
  -- application collected them, buried them in the free-text summary, and the
  -- admission letter then had nothing to read — so every letter said whatever
  -- the code's fallback happened to be. `mode` is on campus / online / both;
  -- `attendance` is full or part time. They are two questions because they are
  -- two questions: a part-time student on campus could not previously say so.
  add column if not exists mode                 text,
  add column if not exists attendance           text,
  add column if not exists campus               text,
  -- Links a student row to its auth account. Without it the students_own_row
  -- policy in section 9 matches nothing and a student signs in to an empty
  -- portal — no programme, no results, no transcript.
  add column if not exists auth_user_id         uuid references auth.users (id) on delete set null;


-- ===========================================================================
-- 4. SUSPENSION AND STAFF LINKING
-- ===========================================================================

alter table profiles
  -- Null means active. Set only by /api/admin/suspend, which also bans the auth
  -- user so an existing token stops working. This column is the record, and it
  -- is what the portal checks on the next page load.
  add column if not exists suspended_at      timestamptz,
  add column if not exists suspended_by      uuid references auth.users (id) on delete set null,
  add column if not exists suspension_reason text;

alter table lecturers
  -- A lecturer needs an account to sign in and a lecturer row to be allocated a
  -- course. This links the two.
  add column if not exists auth_user_id uuid references auth.users (id) on delete set null;


-- ===========================================================================
-- 5. INDEXES
-- ===========================================================================

create index if not exists students_status_created_idx on students (status, created_at);
create index if not exists students_auth_user_idx      on students (auth_user_id);
create index if not exists enrollments_student_idx     on enrollments (student_id);
create index if not exists results_student_idx         on results (student_id);
create index if not exists documents_student_idx       on documents (student_id);
-- One result per student per course.
--
-- Both mark-entry screens upsert with `onConflict: 'student_id,course_id'`, and
-- Postgres requires a unique index matching that target — without one every
-- upsert fails with "there is no unique or exclusion constraint matching the ON
-- CONFLICT specification". There was no such index, so saving marks had never
-- worked at all; the error was discarded by the caller, so nobody found out.
create unique index if not exists results_student_course_key
  on results (student_id, course_id);

create index if not exists payments_student_idx        on payments (student_id);
create index if not exists payments_received_idx       on payments (received_at);
create index if not exists profiles_role_idx           on profiles (role);
create index if not exists profiles_suspended_idx      on profiles (suspended_at);
create index if not exists lecturers_auth_user_idx     on lecturers (auth_user_id);

-- Student numbers must be unique. The generator derives the next sequence from
-- the highest existing number for the year, so two approvals racing would both
-- compute the same one; this makes the second fail loudly rather than issue a
-- duplicate number to a second student.
create unique index if not exists students_student_number_key
  on students (student_number) where student_number is not null;

-- Exactly one active design per kind. Without this, "which design is in force"
-- becomes a question with two answers.
create unique index if not exists credential_templates_one_active
  on credential_templates (kind) where is_active;


-- ===========================================================================
-- 6. VALID ROLES
--
-- A typo in a role is silent: the account signs in and can do nothing, with no
-- error anywhere to say why. This turns that into a failed update at the moment
-- it is made.
-- ===========================================================================

-- Round anything unrecognised down to 'student'. Least privilege is the safe
-- direction to round in.
update profiles set role = 'student'
where role not in (
  'superadmin','admin','chancellor','vice-chancellor','registrar',
  'finance-director','dean','hod','programme-coordinator','lecturer','finance',
  'admissions-officer','library-staff','student-affairs','student','applicant',
  'academic-office'
);

alter table profiles drop constraint if exists profiles_role_valid;
alter table profiles add constraint profiles_role_valid check (role in (
  'superadmin','admin','chancellor','vice-chancellor','registrar',
  'finance-director','dean','hod','programme-coordinator','lecturer','finance',
  'admissions-officer','library-staff','student-affairs','student','applicant',
  'academic-office'
));


-- ===========================================================================
-- 7. KEEP updated_at HONEST
-- ===========================================================================

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists students_updated_at on students;
create trigger students_updated_at before update on students
  for each row execute function set_updated_at();

drop trigger if exists results_updated_at on results;
create trigger results_updated_at before update on results
  for each row execute function set_updated_at();


-- ===========================================================================
-- 8. GIVE EVERY ACCOUNT A PROFILE
--
-- Sign-in reads the role from `profiles`, not from the auth record: the portal
-- signs in, looks up the row, and refuses the session with "Profile not found"
-- when there is none. Creating a user in the dashboard without this produces an
-- account that authenticates and still cannot get in.
--
-- THE ROLE IS ALWAYS 'student', never one taken from user_metadata.
-- raw_user_meta_data is caller-supplied: supabase.auth.signUp is callable from
-- any browser holding the publishable key and stores whatever is passed in
-- options.data. Honouring a role from there would let anyone sign themselves up
-- as a Superadministrator. The server routes set the real role immediately
-- afterwards with the service-role key, which section 10 makes the only path
-- that can raise a role at all.
--
-- `security definer` is required: the insert into auth.users runs as
-- supabase_auth_admin, which has no rights on public.profiles.
-- ===========================================================================

create or replace function handle_new_user() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill: accounts created before this trigger existed have no profile and
-- cannot sign in.
insert into profiles (id, email, full_name, role)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'full_name', u.email), 'student'
from auth.users u
where not exists (select 1 from profiles p where p.id = u.id);


-- ===========================================================================
-- 9. ROW-LEVEL SECURITY
--
-- The publishable key is in the site's JavaScript and is sent by every
-- visitor's browser. That is normal and safe, but ONLY because RLS decides what
-- that key can read. A table with RLS off is readable by anyone who opens the
-- page source and copies the key.
--
-- `students.address` holds the full application text: date of birth, identity
-- numbers, next of kin, medical disclosure, references. Getting this wrong
-- publishes all of it.
--
-- The admissions desks are unaffected by everything here. They read through the
-- service-role key, which bypasses RLS by design.
-- ===========================================================================

alter table departments          enable row level security;
alter table profiles             enable row level security;
alter table students             enable row level security;
alter table lecturers            enable row level security;
alter table courses              enable row level security;
alter table enrollments          enable row level security;
alter table results              enable row level security;
alter table documents            enable row level security;
alter table audit_logs           enable row level security;
alter table payments             enable row level security;
alter table credential_templates enable row level security;

-- A policy on `profiles` that reads `profiles` recurses infinitely. The way out
-- is a security-definer function: owned by the table owner, so it reads past
-- RLS, and stable so the planner calls it once per statement.
create or replace function auth_role() returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Reference data anyone may read. Nothing here is personal.
drop policy if exists departments_public_read on departments;
create policy departments_public_read on departments for select using (true);

drop policy if exists courses_public_read on courses;
create policy courses_public_read on courses for select using (true);

-- Staff directory. Names and titles are already published on the website; if
-- you would rather this were signed-in only, change `true` to
-- `auth.uid() is not null`.
drop policy if exists lecturers_public_read on lecturers;
create policy lecturers_public_read on lecturers for select using (true);

-- The appearance of a public document. The Certificate Generator renders it
-- with the publishable key, so it has to be readable.
drop policy if exists credential_templates_read on credential_templates;
create policy credential_templates_read on credential_templates for select using (true);

-- A signed-in user reads their own profile. Section 10 governs what they may
-- write to it, which is far less than this policy alone would allow.
drop policy if exists profiles_own on profiles;
create policy profiles_own on profiles for select using (auth.uid() = id);

drop policy if exists profiles_own_update on profiles;
create policy profiles_own_update on profiles for update using (auth.uid() = id);

-- The Accounts screen. profiles_own alone would show an empty table.
drop policy if exists profiles_system_read on profiles;
create policy profiles_system_read on profiles
  for select using (auth_role() in ('superadmin', 'admin'));

-- A student reads their own record and nothing else. SELECT only: a student
-- cannot change their own programme, status or student number.
drop policy if exists students_own_row on students;
create policy students_own_row on students
  for select using (auth.uid() = auth_user_id);

drop policy if exists enrollments_own on enrollments;
create policy enrollments_own on enrollments for select using (
  student_id in (select id from students where auth_user_id = auth.uid())
);

drop policy if exists results_own on results;
create policy results_own on results for select using (
  student_id in (select id from students where auth_user_id = auth.uid())
);

drop policy if exists documents_own on documents;
create policy documents_own on documents for select using (
  student_id in (select id from students where auth_user_id = auth.uid())
);

-- Staff may read applications.
--
-- WITHOUT THIS THE ADMISSIONS PIPELINE DOES NOT WORK AT ALL. `students_own_row`
-- alone restricts SELECT to `auth.uid() = auth_user_id`; an applicant has no
-- auth account so that column is null, and a Finance officer is not the
-- applicant. RLS therefore returned zero rows to every member of staff, so the
-- Finance queue, the Registrar's queue, the student register and every
-- dashboard count read empty — while the applications sat in the table.
drop policy if exists students_staff_read on students;
create policy students_staff_read on students
  for select using (
    auth_role() in (
      'superadmin', 'admin', 'registrar', 'finance', 'finance-director',
      'admissions-officer', 'dean', 'hod', 'programme-coordinator',
      'academic-office', 'lecturer', 'student-affairs'
    )
  );

-- And the two desks may write. There was no UPDATE policy at all, so
-- registering a fee was refused even when the application could be seen.
-- Narrow on purpose: a lecturer or dean may read the register, and neither
-- appears here, because neither admits students nor takes money.
drop policy if exists students_desk_update on students;
create policy students_desk_update on students
  for update using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'finance', 'finance-director', 'admissions-officer')
  );

-- /apply inserts with the publishable key. It needs INSERT and must not get
-- SELECT — otherwise the key that submits an application could list every
-- other application.
drop policy if exists students_public_apply on students;
create policy students_public_apply on students
  for insert with check (status = 'applicant');

-- A student may read their own payments and nothing else. Finance reads and
-- writes through the service role, which bypasses RLS.
drop policy if exists payments_own on payments;
create policy payments_own on payments for select using (
  student_id in (select id from students where auth_user_id = auth.uid())
);

drop policy if exists payments_system_read on payments;
create policy payments_system_read on payments
  for select using (auth_role() in ('superadmin', 'admin', 'finance', 'finance-director'));

-- audit_logs and credential_templates get NO write policy and audit_logs gets
-- no read policy either. With RLS on and no policy, only the service role
-- reaches them — the correct answer for an audit trail, and for a table only
-- the Superadministrator's route may write.


-- ===========================================================================
-- 10. STOP USERS PROMOTING THEMSELVES  ← the one that matters
--
-- `profiles_own_update` above exists so someone can change their own display
-- name. Postgres RLS cannot restrict which COLUMNS a policy covers, so it
-- grants the whole row — including `role`. Without this section, any signed-in
-- user can open the browser console and run
--
--   supabase.from('profiles').update({ role: 'superadmin' }).eq('id', myId)
--
-- and it succeeds. Every separation of duties in this system rests on that
-- column, so until this runs, none of them hold.
--
-- The fix is column-level privileges, which apply underneath RLS: the browser
-- roles simply have no UPDATE right on those columns, so no policy can grant
-- one. The service role keeps its rights, which is why the /api/admin routes
-- still work — and why promotion and suspension can now happen only through a
-- route that authorises, records and audits them.
-- ===========================================================================

revoke update on profiles from authenticated, anon;

-- Granted back: only what a person may legitimately change about themselves.
-- Absent: role, suspended_at, suspended_by, suspension_reason.
grant update (full_name, avatar_url) on profiles to authenticated;

-- Defence in depth. If a later migration re-grants a column by accident, or a
-- policy is written that appears to allow it, this still refuses.
create or replace function guard_profile_privileges() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Block the browser roles specifically rather than allowing only the service
  -- role. PostgREST switches to 'authenticated' or 'anon' for a request bearing
  -- the publishable key and to 'service_role' for one bearing the secret key;
  -- this SQL editor runs as 'postgres'. Testing for "not service_role" would
  -- therefore also block the SQL editor, including section 14 of this file.
  if current_user in ('authenticated', 'anon') then
    if new.role is distinct from old.role then
      raise exception 'role may only be changed by the Superadministrator, through /api/admin/staff';
    end if;
    if new.suspended_at is distinct from old.suspended_at then
      raise exception 'suspension may only be changed through /api/admin/suspend';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileges on profiles;
create trigger profiles_guard_privileges
  before update on profiles
  for each row execute function guard_profile_privileges();


-- ===========================================================================
-- 10b. THE ADMISSIONS PIPELINE — three offices, three permitted moves
--
-- Finance registers the fee. The Registrar verifies the record and forwards
-- it. The Admissions Office assesses and admits. No office can make another
-- office's move, and the Admissions Office cannot admit a record the Registrar
-- has not forwarded.
--
-- RLS cannot restrict columns, so this is a trigger — the same technique as
-- section 10.
-- ===========================================================================

create or replace function guard_admissions_separation() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text;
begin
  -- Server routes hold the service-role key and have already checked the
  -- caller's capability in application code; this guard is for the browser.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  actor := auth_role();

  if actor in ('superadmin', 'admin') then
    return new;
  end if;

  -- Payment fields: Finance only.
  if (new.payment_status    is distinct from old.payment_status)
     or (new.fee_reference     is distinct from old.fee_reference)
     or (new.fee_amount        is distinct from old.fee_amount)
     or (new.fee_currency      is distinct from old.fee_currency)
     or (new.fee_registered_by is distinct from old.fee_registered_by)
     or (new.fee_registered_at is distinct from old.fee_registered_at)
  then
    if actor not in ('finance', 'finance-director') then
      raise exception 'only the Finance office may register or alter a payment';
    end if;
  end if;

  -- Decision fields: the two offices that decide, and nobody else.
  --
  -- The Registrar records the verification and forwards; the Admissions Office
  -- records the admission. Finance appears in neither list, which is the point
  -- — the office that takes the money never writes a decision.
  if (new.decision_reason      is distinct from old.decision_reason)
     or (new.decided_by          is distinct from old.decided_by)
     or (new.decided_at          is distinct from old.decided_at)
     or (new.student_number      is distinct from old.student_number)
     or (new.admission_conditions is distinct from old.admission_conditions)
     or (new.account_created_at  is distinct from old.account_created_at)
  then
    if actor not in ('registrar', 'admissions-officer') then
      raise exception 'only the Registrar or the Admissions Office may record a decision';
    end if;
  end if;

  -- `status` moves through the pipeline, and which move is allowed depends on
  -- who is making it. Three offices, three permitted moves, and no office can
  -- make another's.
  if new.status is distinct from old.status then
    -- Finance registers the fee and nothing else.
    if actor in ('finance', 'finance-director') and new.status <> 'fee_paid' then
      raise exception 'the Finance office may only move an application to fee_paid';
    end if;

    -- The Registrar verifies the record and forwards it, or asks for documents,
    -- or declines. It does not admit: 'approved' and 'conditional' are the
    -- Admissions Office's, and this is what stops the Registrar bypassing them.
    if actor = 'registrar'
       and new.status not in ('registrar_approved', 'documents_required', 'rejected', 'deferred')
    then
      raise exception 'the Registrar verifies and forwards; admitting belongs to the Admissions Office';
    end if;

    -- The Admissions Office admits, and only from a record the Registrar has
    -- forwarded. An application that skipped the Registrar cannot be admitted.
    if actor = 'admissions-officer' then
      if new.status not in ('approved', 'conditional', 'rejected', 'deferred') then
        raise exception 'the Admissions Office may admit, decline or defer';
      end if;
      if new.status in ('approved', 'conditional') and old.status <> 'registrar_approved' then
        raise exception 'this record has not been verified and forwarded by the Registrar';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists students_guard_separation on students;
create trigger students_guard_separation
  before update on students
  for each row execute function guard_admissions_separation();




-- ===========================================================================
-- 11. THE LAST SUPERADMINISTRATOR CANNOT BE SUSPENDED OR DEMOTED
--
-- Not a rail against clumsiness — a governance one. An institution whose only
-- holder of system custody is locked out has nobody with the standing to unlock
-- anyone, and recovery means editing the database by hand.
-- ===========================================================================

create or replace function guard_last_superadmin() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining integer;
begin
  if new.suspended_at is not null and old.suspended_at is null and old.role = 'superadmin' then
    select count(*) into remaining from public.profiles
    where role = 'superadmin' and suspended_at is null and id <> old.id;
    if remaining = 0 then
      raise exception 'cannot suspend the last active Superadministrator';
    end if;
  end if;
  if new.role is distinct from 'superadmin' and old.role = 'superadmin' then
    select count(*) into remaining from public.profiles
    where role = 'superadmin' and suspended_at is null and id <> old.id;
    if remaining = 0 then
      raise exception 'cannot remove the last active Superadministrator';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_last_superadmin on profiles;
create trigger profiles_guard_last_superadmin
  before update on profiles
  for each row execute function guard_last_superadmin();


-- ===========================================================================
-- 12. THE AUDIT TRAIL IS APPEND-ONLY
--
-- RLS already means only the service role can read audit_logs. That is not the
-- same as being unfalsifiable: the service role could also delete from it, and
-- the routes hold that key.
--
-- These refuse UPDATE and DELETE for everyone, service role included. The
-- Superadministrator can read the log of their own actions and cannot remove a
-- line from it. A record the most powerful account can edit is not a record of
-- anything.
-- ===========================================================================

create or replace function refuse_audit_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_logs is append-only';
end;
$$;

drop trigger if exists audit_logs_no_update on audit_logs;
create trigger audit_logs_no_update before update on audit_logs
  for each statement execute function refuse_audit_mutation();

drop trigger if exists audit_logs_no_delete on audit_logs;
create trigger audit_logs_no_delete before delete on audit_logs
  for each statement execute function refuse_audit_mutation();


-- ===========================================================================
-- 13. PUBLISHED CREDENTIAL DESIGNS ARE PERMANENT
-- ===========================================================================

create or replace function refuse_template_edit() returns trigger
language plpgsql as $$
begin
  -- is_active may flip — that is how publishing switches versions. Nothing else
  -- about a published row may change.
  if new.kind is distinct from old.kind
     or new.version is distinct from old.version
     or new.design is distinct from old.design
     or new.name is distinct from old.name
     or new.published_at is distinct from old.published_at
  then
    raise exception 'a published credential design cannot be edited; publish a new version instead';
  end if;
  return new;
end;
$$;

drop trigger if exists credential_templates_immutable on credential_templates;
create trigger credential_templates_immutable
  before update on credential_templates
  for each row execute function refuse_template_edit();


-- ===========================================================================
-- 14. APPOINT THE SUPERADMINISTRATOR AND THE ADMINISTRATOR
--
-- These do nothing unless the accounts already exist in Authentication → Users.
-- If you created them after running this file, re-run just this section.
--
-- The split matters: system custody sits on a university mailbox the
-- institution controls, not a personal one. If the personal account is ever
-- compromised, the attacker gets an administrator — who cannot assign roles,
-- cannot suspend anyone, and cannot redesign a certificate.
-- ===========================================================================

update profiles
set role = 'superadmin',
    full_name = coalesce(nullif(full_name, ''), 'Superadministrator')
where lower(email) = 'superadmin@iguc.net';

update profiles
set role = 'admin',
    full_name = coalesce(nullif(full_name, ''), 'System Administrator')
where lower(email) = 'tchamer@aol.com';

-- THE ADMISSIONS OFFICER. Uncomment and put the real address in.
--
-- Without one, the pipeline stops one step short of working. The Registrar can
-- verify and forward, and the record sits at 'registrar_approved' with nobody
-- holding the role that may move it to 'approved' — section 10b refuses the
-- Registrar that move on purpose. No error is shown to anyone; applications
-- simply accumulate in a queue no desk is watching.
--
-- The account must already exist in Authentication → Users.

-- update profiles
-- set role = 'admissions-officer',
--     full_name = coalesce(nullif(full_name, ''), 'Admissions Officer')
-- where lower(email) = 'admissions@iguc.net';


-- ===========================================================================
-- 15. VERIFY — READ THE OUTPUT OF ALL FIVE
-- ===========================================================================

-- (a) Eleven tables, every one with rowsecurity = true.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- (b) THE IMPORTANT ONE. `authenticated` must appear ONLY for full_name and
--     avatar_url. If `role` is in this list, section 10 did not apply and any
--     student can make themselves a Superadministrator.
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_name = 'profiles'
  and grantee in ('authenticated', 'anon')
  and privilege_type = 'UPDATE'
order by grantee, column_name;

-- (c) All five guards present. Expect 5 rows.
select tgname from pg_trigger
where tgname in (
  'profiles_guard_privileges', 'profiles_guard_last_superadmin',
  'audit_logs_no_update', 'audit_logs_no_delete', 'credential_templates_immutable'
)
order by tgname;

-- (d) The appointments. Expect superadmin@iguc.net and tchamer@aol.com. Empty
--     means the accounts were not created in the dashboard, or the addresses
--     differ — create them, then re-run section 14.
select email, full_name, role, suspended_at
from profiles
where role in ('superadmin', 'admin')
order by role, email;

-- (e) Every auth account has a profile, or it cannot sign in. Expect 0 rows.
select u.email, u.created_at
from auth.users u
where not exists (select 1 from profiles p where p.id = u.id);


-- ===========================================================================
-- FIVE THINGS TO DO AFTER THIS FINISHES
--
-- 1. Dashboard → Authentication → Providers → Email → turn OFF "Allow new
--    users to sign up". The portal has no sign-up form, but the endpoint stays
--    open until that switch is off, and open means anyone can mint themselves
--    a student account.
--
-- 2. Prove RLS is holding, FROM A TERMINAL — not this editor, which is
--    authenticated and will always succeed:
--
--      curl -s "https://bhpsftesricwotkziokd.supabase.co/rest/v1/students?select=id,email&limit=1" \
--        -H "apikey: sb_publishable_lQm8dFmj8PnQinSZooQbVg_WAfKJcGS"
--
--      []            RLS is holding. Correct.
--      [{"id":...}]  Stop. Every applicant's date of birth and identity number
--                    is public.
--
-- 3. Set SUPABASE_SERVICE_ROLE_KEY in Vercel — server-side, never with a
--    NEXT_PUBLIC_ prefix. Without it the Registrar's approve button and every
--    /api/admin route refuse rather than silently doing nothing.
--
-- 4. Set CREDENTIAL_SECRET in Vercel — 32 characters or more, server-side,
--    never NEXT_PUBLIC_. This is the key every admission letter, transcript and
--    certificate is sealed with. Without it the system does not fail loudly: it
--    keeps issuing admission letters, each one printed "Not sealed", carrying
--    no verification code and no QR. They are genuine letters that nobody can
--    check. Set it BEFORE the first admission goes out — changing it later
--    invalidates the seal on every document already issued under the old one.
--
--      openssl rand -hex 32
--
-- 5. Appoint the Admissions Officer — section 14, the commented block. The
--    pipeline is Finance → Registrar → Admissions Office, and with no holder of
--    the third role, approved applications stop at 'registrar_approved' and
--    nothing tells anyone why.
-- ===========================================================================


-- ===========================================================================
-- ===========================================================================
--
--   003_pipeline_rls.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- SUPERSEDED — DO NOT RUN THIS UNLESS 000_complete.sql PREDATES IT
--
-- Everything in this file is now part of 000_complete.sql:
--
--   students_staff_read           →  000_complete.sql, section 9
--   students_desk_update          →  000_complete.sql, section 9
--   guard_admissions_separation   →  000_complete.sql, section 10b
--
-- Run 000_complete.sql. It is the one file, it is idempotent, and it contains
-- this. Keep this file only for a database that had an older 000 applied and
-- needs the pipeline fix without re-running the whole thing; it is harmless to
-- run on top of a current 000, because both are idempotent and identical.
-- ===========================================================================


-- ===========================================================================
-- ICOF Global University — the admissions pipeline: reads, writes and gates
--
-- Two things in one file, because they are the same subject and running one
-- without the other leaves the pipeline half-wired:
--
--   1. The fix for applications never reaching the Finance desk.
--   2. The three-office pipeline — Finance, Registrar, Admissions Office —
--      with each office's permitted moves enforced in the database.
--
-- Run this in the Supabase SQL editor. It is small, idempotent, and safe to
-- run on a database that already has 000_complete.sql applied.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS WRONG
--
-- Applications submitted through /apply WERE being recorded. The row was
-- written to `students` with status 'applicant' every time, and the insert was
-- permitted by the `students_public_apply` policy.
--
-- Nobody could see them. The only SELECT policy on `students` was
--
--   create policy students_own_row on students
--     for select using (auth.uid() = auth_user_id);
--
-- An applicant has no auth account, so `auth_user_id` is null; a Finance
-- officer is not the applicant either way. Row-level security therefore
-- returned zero rows to every member of staff, on every screen, always. The
-- Finance queue was empty not because nothing had arrived but because nothing
-- could be shown. The Registrar's queue, the student register and every count
-- on the dashboard read zero for the same reason.
--
-- There was a second fault behind it. There was no UPDATE policy on `students`
-- at all, so even had Finance seen the application, registering the fee would
-- have been refused — silently, because the desk did not check the error.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES, AND WHAT IT PRESERVES
--
-- Staff can now read applications and update them. Separation of duties is
-- kept, and kept in the database rather than in the interface: Finance cannot
-- record an admission decision, and the Registrar cannot alter a payment.
--
-- RLS cannot restrict columns, so that split is enforced by a trigger — the
-- same technique used to stop users promoting themselves in section 10 of
-- 000_complete.sql. A policy alone would grant the whole row.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Staff may read applications
--
-- auth_role() is the security-definer helper from 000_complete.sql section 7.
-- It reads the caller's role past RLS, which is what stops a policy on
-- `students` that consults `profiles` from recursing.
-- ---------------------------------------------------------------------------

drop policy if exists students_staff_read on students;
create policy students_staff_read on students
  for select using (
    auth_role() in (
      'superadmin', 'admin', 'registrar', 'finance', 'finance-director',
      'admissions-officer', 'dean', 'hod', 'programme-coordinator',
      'academic-office', 'lecturer', 'student-affairs'
    )
  );


-- ---------------------------------------------------------------------------
-- 2. The two desks may write
--
-- Deliberately narrow. A lecturer and a dean can read the register; neither
-- appears here, because neither admits students nor takes money.
-- ---------------------------------------------------------------------------

drop policy if exists students_desk_update on students;
create policy students_desk_update on students
  for update using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'finance', 'finance-director', 'admissions-officer')
  );


-- ---------------------------------------------------------------------------
-- 3. Separation of duties, enforced in the database
--
-- Finance verifies the money. The Registrar confers the place. Neither may do
-- the other's job — that is the whole reason the admissions pipeline has two
-- desks, and until now it was a rule the interface asked people to respect
-- rather than one the database held them to.
--
-- 'admin' and 'superadmin' are exempt so the institution is not locked out of
-- its own records; every such change is visible in the audit log.
-- ---------------------------------------------------------------------------

create or replace function guard_admissions_separation() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text;
begin
  -- Server routes hold the service-role key and have already checked the
  -- caller's capability in application code; this guard is for the browser.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  actor := auth_role();

  if actor in ('superadmin', 'admin') then
    return new;
  end if;

  -- Payment fields: Finance only.
  if (new.payment_status    is distinct from old.payment_status)
     or (new.fee_reference     is distinct from old.fee_reference)
     or (new.fee_amount        is distinct from old.fee_amount)
     or (new.fee_currency      is distinct from old.fee_currency)
     or (new.fee_registered_by is distinct from old.fee_registered_by)
     or (new.fee_registered_at is distinct from old.fee_registered_at)
  then
    if actor not in ('finance', 'finance-director') then
      raise exception 'only the Finance office may register or alter a payment';
    end if;
  end if;

  -- Decision fields: the two offices that decide, and nobody else.
  --
  -- The Registrar records the verification and forwards; the Admissions Office
  -- records the admission. Finance appears in neither list, which is the point
  -- — the office that takes the money never writes a decision.
  if (new.decision_reason      is distinct from old.decision_reason)
     or (new.decided_by          is distinct from old.decided_by)
     or (new.decided_at          is distinct from old.decided_at)
     or (new.student_number      is distinct from old.student_number)
     or (new.admission_conditions is distinct from old.admission_conditions)
     or (new.account_created_at  is distinct from old.account_created_at)
  then
    if actor not in ('registrar', 'admissions-officer') then
      raise exception 'only the Registrar or the Admissions Office may record a decision';
    end if;
  end if;

  -- `status` moves through the pipeline, and which move is allowed depends on
  -- who is making it. Three offices, three permitted moves, and no office can
  -- make another's.
  if new.status is distinct from old.status then
    -- Finance registers the fee and nothing else.
    if actor in ('finance', 'finance-director') and new.status <> 'fee_paid' then
      raise exception 'the Finance office may only move an application to fee_paid';
    end if;

    -- The Registrar verifies the record and forwards it, or asks for documents,
    -- or declines. It does not admit: 'approved' and 'conditional' are the
    -- Admissions Office's, and this is what stops the Registrar bypassing them.
    if actor = 'registrar'
       and new.status not in ('registrar_approved', 'documents_required', 'rejected', 'deferred')
    then
      raise exception 'the Registrar verifies and forwards; admitting belongs to the Admissions Office';
    end if;

    -- The Admissions Office admits, and only from a record the Registrar has
    -- forwarded. An application that skipped the Registrar cannot be admitted.
    if actor = 'admissions-officer' then
      if new.status not in ('approved', 'conditional', 'rejected', 'deferred') then
        raise exception 'the Admissions Office may admit, decline or defer';
      end if;
      if new.status in ('approved', 'conditional') and old.status <> 'registrar_approved' then
        raise exception 'this record has not been verified and forwarded by the Registrar';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists students_guard_separation on students;
create trigger students_guard_separation
  before update on students
  for each row execute function guard_admissions_separation();


-- ---------------------------------------------------------------------------
-- 4. Verify
-- ---------------------------------------------------------------------------

-- (a) Three policies on students: own row, staff read, desk update, plus the
--     public application insert. Expect four rows.
select policyname, cmd
from pg_policies
where tablename = 'students'
order by policyname;

-- (b) The separation guard is installed. Expect one row.
select tgname from pg_trigger where tgname = 'students_guard_separation';

-- (c) How many applications are sitting in the database right now. If this is
--     greater than zero, they were being recorded all along and only the
--     reading was blocked.
select status, count(*) as applications
from students
group by status
order by count(*) desc;


-- ===========================================================================
-- AFTER RUNNING THIS
--
-- Sign in as the Finance officer and open Admissions — Finance. Every
-- application submitted since the site went live should now be listed, oldest
-- first. Nothing was lost: the rows were always there.
-- ===========================================================================


-- ===========================================================================
-- ===========================================================================
--
--   004_credential_register.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — THE CREDENTIAL REGISTER
--
-- Run this after 000_complete.sql. It is idempotent and destroys nothing.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS THE MOST IMPORTANT PIECE OF THE CREDENTIAL SYSTEM
--
-- Until now the university could SIGN a credential but had no record that it
-- had ISSUED one. Those are different claims, and the difference is the whole
-- of credential security:
--
--   A signature proves the university's key was applied to a string.
--   The register proves the university issued THIS credential, to THIS person,
--   on THIS date — and whether it still stands.
--
-- Without the register, /verify could only ever answer "correctly signed",
-- which is why the code has said exactly that and never "valid". Three things
-- were impossible:
--
--   1. REVOCATION. A degree rescinded for proven misconduct, a certificate
--      issued in error, a transcript superseded — none could be withdrawn. Once
--      signed, a document verified for ever. An institution that cannot revoke
--      a credential cannot be said to control it.
--
--   2. EXISTENCE. A forger who obtained the signing key could mint credentials
--      that verified perfectly, for people who never studied here, and nothing
--      would contradict them. The register does: a credential not on it was not
--      issued, whatever it is signed with.
--
--   3. THE COUNT. The university could not say how many degrees it has awarded,
--      to whom, or under which version of which template. That is a question a
--      regulator asks.
--
-- ---------------------------------------------------------------------------
-- THE HASH, AND WHAT IT IS FOR
--
-- `content_hash` is SHA-256 over the canonical statement of the award — holder,
-- award, classification, programme, date, credential id — computed at issue and
-- never recomputed from a presented document. Verification recomputes it from
-- the REGISTER and compares to the presented one. So:
--
--   presented document = register  →  hash matches      →  authentic
--   presented document altered     →  hash differs      →  altered, and the
--                                                          register says what
--                                                          it should have said
--
-- That last part is what a signature alone cannot do. A broken signature says
-- "something is wrong"; the register says what the correct values were.
-- ===========================================================================


-- ===========================================================================
-- 1. THE REGISTER
-- ===========================================================================

create table if not exists credentials_issued (
  id                uuid primary key default gen_random_uuid(),

  -- The number printed on the document, e.g. IGUC-BTH-26A9-F8K2-P19D.
  --
  -- NOT SEQUENTIAL, and the uniqueness constraint is the only thing that makes
  -- that safe. A sequential number tells a forger what the next one is, and
  -- tells anyone holding two certificates how many the university has ever
  -- issued. The programme code and year are readable because a registrar uses
  -- them; the rest is random.
  credential_id     text not null unique,

  kind              text not null check (kind in (
                      'certificate', 'transcript', 'diploma',
                      'admission-letter', 'student-card', 'completion-letter'
                    )),

  -- restrict, not cascade. A student who holds a credential cannot be deleted
  -- out from under it — the award is a fact about the world that outlives the
  -- record-keeping, and a dangling certificate with no holder is a worse
  -- outcome than a delete that fails.
  student_id        uuid references students (id) on delete restrict,
  student_number    text,

  -- Denormalised on purpose. A certificate states what it stated on the day it
  -- was issued. If the register read the name from `students` at verification
  -- time, a later correction to the record would silently rewrite what a
  -- graduate's certificate appears to say — and the hash would stop matching a
  -- document that was never altered.
  holder_name       text not null,
  award             text,
  classification    text,
  programme         text,

  -- Exactly what was sealed, in the order it was sealed. Kept so a credential
  -- can be re-rendered years later as it was issued, and so the hash can be
  -- audited rather than trusted.
  facts             jsonb not null,
  content_hash      text not null,
  seal_code         text not null,

  -- Which design it was printed under. Templates are versioned and never
  -- edited in place (see 000_complete.sql section 13), so this is enough to
  -- reproduce the document exactly.
  template_version  integer,

  issued_by         uuid references auth.users (id) on delete set null,
  issued_at         timestamptz not null default now(),

  -- 'replaced' is not 'revoked'. A transcript reissued after a mark correction
  -- supersedes its predecessor without the predecessor being fraudulent, and
  -- reporting it as revoked would suggest the holder did something wrong.
  status            text not null default 'issued'
                    check (status in ('issued', 'revoked', 'replaced')),
  revoked_at        timestamptz,
  revoked_by        uuid references auth.users (id) on delete set null,
  revocation_reason text,
  replaced_by       uuid references credentials_issued (id) on delete set null
);

create index if not exists credentials_student_idx  on credentials_issued (student_id);
create index if not exists credentials_kind_idx     on credentials_issued (kind, issued_at desc);
create index if not exists credentials_status_idx   on credentials_issued (status) where status <> 'issued';
create index if not exists credentials_hash_idx     on credentials_issued (content_hash);


-- ===========================================================================
-- 2. A CREDENTIAL CANNOT BE EDITED, ONLY REVOKED
--
-- The register is the university's word on what it has awarded. If the fields
-- on it could be changed, verifying against it would prove nothing that
-- verifying against the document did not — both would say whatever the last
-- person to edit them decided.
--
-- So: the award fields are frozen at issue. Only the revocation columns move,
-- and only in one direction. This binds the service role too, which is the
-- point: the routes hold that key, and a register the most powerful account can
-- rewrite is not a register.
-- ===========================================================================

create or replace function guard_credential_register() returns trigger
language plpgsql
as $$
begin
  if (new.credential_id    is distinct from old.credential_id)
     or (new.kind            is distinct from old.kind)
     or (new.student_id      is distinct from old.student_id)
     or (new.holder_name     is distinct from old.holder_name)
     or (new.award           is distinct from old.award)
     or (new.classification  is distinct from old.classification)
     or (new.programme       is distinct from old.programme)
     or (new.facts           is distinct from old.facts)
     or (new.content_hash    is distinct from old.content_hash)
     or (new.seal_code       is distinct from old.seal_code)
     or (new.template_version is distinct from old.template_version)
     or (new.issued_at       is distinct from old.issued_at)
     or (new.issued_by       is distinct from old.issued_by)
  then
    raise exception 'an issued credential cannot be altered; revoke it and issue a replacement';
  end if;

  -- Revocation is final. Un-revoking would let an institution quietly restore a
  -- credential it had withdrawn, with nothing in the record to show it ever had
  -- — which is precisely the manoeuvre revocation exists to make impossible.
  if old.status = 'revoked' and new.status <> 'revoked' then
    raise exception 'a revoked credential cannot be reinstated; issue a new one';
  end if;

  if new.status = 'revoked' and old.status <> 'revoked' then
    if new.revocation_reason is null or btrim(new.revocation_reason) = '' then
      raise exception 'a revocation must state its reason';
    end if;
    new.revoked_at := coalesce(new.revoked_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists credentials_guard on credentials_issued;
create trigger credentials_guard
  before update on credentials_issued
  for each row execute function guard_credential_register();

-- Deletion is not a correction. A credential that should not have been issued
-- is revoked, with a reason, and the record of both stays.
create or replace function refuse_credential_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'a credential is revoked, never deleted';
end;
$$;

drop trigger if exists credentials_no_delete on credentials_issued;
create trigger credentials_no_delete before delete on credentials_issued
  for each statement execute function refuse_credential_delete();


-- ===========================================================================
-- 3. ROW-LEVEL SECURITY
--
-- RLS on, and deliberately almost no policy. Verification runs through a server
-- route holding the service-role key, which bypasses RLS — so the register does
-- not need to be readable by the browser, and making it readable would publish
-- the name, award and classification of every graduate to anyone holding the
-- publishable key.
--
-- The one policy is the holder's own: a graduate may see their own credentials
-- in the portal. Not anybody else's.
-- ===========================================================================

alter table credentials_issued enable row level security;

drop policy if exists credentials_own on credentials_issued;
create policy credentials_own on credentials_issued
  for select using (
    student_id in (select id from students where auth_user_id = auth.uid())
  );

drop policy if exists credentials_registry_read on credentials_issued;
create policy credentials_registry_read on credentials_issued
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office')
  );


-- ===========================================================================
-- 4. VERIFY
-- ===========================================================================

-- (a) The table and its guards. Expect two triggers.
select tgname from pg_trigger
where tgname in ('credentials_guard', 'credentials_no_delete')
order by tgname;

-- (b) Two policies, and RLS on.
select rowsecurity from pg_tables where tablename = 'credentials_issued';
select policyname, cmd from pg_policies where tablename = 'credentials_issued' order by policyname;

-- (c) Nothing issued yet, on a fresh install. This is the number the university
--     can now answer that it could not before.
select kind, status, count(*) from credentials_issued group by kind, status;


-- ===========================================================================
-- AFTER RUNNING THIS
--
-- CREDENTIAL_SECRET must be set in Vercel before the first credential is
-- issued. The register records a seal code computed with it; issue credentials
-- without it and the register fills with rows whose seal column is empty, and
-- they can never be sealed retrospectively without changing what was issued.
-- ===========================================================================


-- ===========================================================================
-- ===========================================================================
--
--   005_senate_approval.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — SENATE APPROVAL OF CREDENTIAL DESIGNS
--
-- Run after 004_credential_register.sql. Idempotent; destroys nothing.
--
-- ---------------------------------------------------------------------------
-- SAFE TO RUN. The application half is built:
--
--   POST  /api/admin/credential-template          submits a design (no longer
--                                                 publishes — it writes the new
--                                                 version inactive)
--   PATCH /api/admin/credential-template          { decision } records an
--                                                 office's approval, or
--                                                 { publish: true } brings an
--                                                 approved design into force
--
-- Publishing is an UPDATE now, so the gate in section 3 actually fires.
--
-- BEFORE YOU RUN IT, appoint the three approving offices — see the note at the
-- foot of this file. Without them no design can ever be published again, and
-- the certificate currently in force will simply stay in force.
-- ---------------------------------------------------------------------------
--
-- ---------------------------------------------------------------------------
-- WHY
--
-- Until now one account could design a degree certificate and publish it, and
-- from that moment every graduate of the university received it. The
-- Superadministrator is the designer — that part is right — but a design is not
-- a piece of styling: it is the form of words in which the university confers a
-- degree, the offices that sign it, and the seal it carries. An institution
-- where one person can change that alone has no governance over its own awards,
-- whatever its statutes say.
--
-- So publishing is now the end of a chain rather than a button:
--
--   Superadministrator designs   →  submits
--   Registrar                    →  approves
--   Academic Office              →  approves
--   Vice Chancellor              →  approves
--   Superadministrator           →  publishes
--
-- Four offices, each recorded with who, when, and any note. The publishing
-- route refuses a design that is not approved by all three, and the refusal is
-- in the database rather than in the interface — an approval workflow enforced
-- only in the browser is a suggestion.
--
-- WHY THE ACADEMIC OFFICE AND NOT AN 'ACADEMIC SECRETARY'. There is no such
-- role in this system; 'academic-office' is the nearest and is the office that
-- actually holds academic regulations here. Adding a role for a post that may
-- not exist would put an approval step in the chain that nobody could ever
-- satisfy, and the design would be unpublishable for ever.
--
-- WHY THE DESIGNER IS NOT ONE OF THE THREE. They authored it. An approval you
-- give to your own work is a countersignature, not a control — and a chain
-- where the first and last steps are the same person, with their own approval
-- in the middle, reads as governance while providing none.
-- ===========================================================================


-- ===========================================================================
-- 1. TEMPLATE LIFECYCLE
-- ===========================================================================

alter table credential_templates
  -- draft      — being designed; nothing has been asked of anyone
  -- submitted  — put to the approving offices
  -- approved   — all three have signed; may be published
  -- published  — in force, or was; never editable again
  -- withdrawn  — submitted and then pulled, or rejected
  add column if not exists lifecycle    text not null default 'draft',
  add column if not exists submitted_by uuid references auth.users (id) on delete set null,
  add column if not exists submitted_at timestamptz,
  add column if not exists withdrawn_at timestamptz,
  add column if not exists withdrawn_reason text;

alter table credential_templates drop constraint if exists credential_templates_lifecycle_valid;
alter table credential_templates add constraint credential_templates_lifecycle_valid
  check (lifecycle in ('draft', 'submitted', 'approved', 'published', 'withdrawn'));

-- Anything already published predates this file and is published by definition.
update credential_templates set lifecycle = 'published'
where is_active = true or published_at is not null;


-- ===========================================================================
-- 2. THE APPROVALS
--
-- One row per office per template. The unique index is what makes an approval
-- an approval: an office signs once, and signing twice is the same signature
-- rather than two.
-- ===========================================================================

create table if not exists credential_template_approvals (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references credential_templates (id) on delete cascade,
  office       text not null check (office in ('registrar', 'academic-office', 'vice-chancellor')),
  decision     text not null check (decision in ('approved', 'rejected')),
  decided_by   uuid references auth.users (id) on delete set null,
  decided_at   timestamptz not null default now(),
  note         text,
  unique (template_id, office)
);

create index if not exists template_approvals_template_idx
  on credential_template_approvals (template_id);

-- An approval, once given, is a fact. It may be withdrawn by withdrawing the
-- whole submission — which resets the chain and makes every office sign again —
-- but it cannot be quietly edited into something else afterwards.
create or replace function guard_template_approval() returns trigger
language plpgsql as $$
begin
  raise exception 'an approval cannot be edited; withdraw the submission and resubmit';
end;
$$;

drop trigger if exists template_approvals_immutable on credential_template_approvals;
create trigger template_approvals_immutable
  before update on credential_template_approvals
  for each row execute function guard_template_approval();


-- ===========================================================================
-- 3. PUBLISHING REQUIRES THE CHAIN
--
-- Enforced here, not in the route. A workflow that lives only in application
-- code is bypassed by the next route somebody writes.
-- ===========================================================================

create or replace function guard_template_publication() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  signed integer;
begin
  if new.lifecycle = 'published' and coalesce(old.lifecycle, '') <> 'published' then
    select count(distinct office) into signed
    from credential_template_approvals
    where template_id = new.id and decision = 'approved';

    if signed < 3 then
      raise exception
        'this design has % of 3 approvals; the Registrar, the Academic Office and the Vice Chancellor must each approve before it can be published',
        signed;
    end if;

    if exists (
      select 1 from credential_template_approvals
      where template_id = new.id and decision = 'rejected'
    ) then
      raise exception 'this design has been rejected by an approving office and cannot be published';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists credential_templates_publication on credential_templates;
create trigger credential_templates_publication
  before update on credential_templates
  for each row execute function guard_template_publication();


-- ===========================================================================
-- 4. ROW-LEVEL SECURITY
-- ===========================================================================

alter table credential_template_approvals enable row level security;

-- The approving offices see what is in front of them; everyone who can read a
-- template can see who has signed it. An approval chain nobody can inspect is
-- not governance either.
drop policy if exists template_approvals_read on credential_template_approvals;
create policy template_approvals_read on credential_template_approvals
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office', 'vice-chancellor', 'chancellor')
  );

-- Writes go through the server route, which checks that the caller holds the
-- office they are signing for. Deliberately no INSERT policy: with RLS on and
-- none, only the service role can record an approval, so nobody can sign on
-- another office's behalf from a browser.


-- ===========================================================================
-- 5. VERIFY
-- ===========================================================================

-- (a) The lifecycle column, with everything already live marked published.
select lifecycle, count(*) from credential_templates group by lifecycle;

-- (b) Both guards installed. Expect two rows.
select tgname from pg_trigger
where tgname in ('credential_templates_publication', 'template_approvals_immutable')
order by tgname;

-- (c) Nothing awaiting approval on a fresh install.
select t.kind, t.version, t.name, t.lifecycle, count(a.id) as approvals
from credential_templates t
left join credential_template_approvals a on a.template_id = t.id and a.decision = 'approved'
group by t.id, t.kind, t.version, t.name, t.lifecycle
order by t.kind, t.version desc;


-- ===========================================================================
-- AFTER RUNNING THIS
--
-- Three accounts must exist and hold their roles, or no design can ever be
-- published again:
--
--   registrar         — already appointed
--   academic-office   — appoint one:  update profiles set role = 'academic-office' where lower(email) = '…';
--   vice-chancellor   — appoint one:  update profiles set role = 'vice-chancellor' where lower(email) = '…';
--
-- The designs already in force are unaffected: they were marked published by
-- section 1 and the guard only fires on a transition INTO published.
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
--   007_gpa_engine.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — THE GPA ENGINE
--
-- Run after 006_awards_and_graduation.sql. Idempotent; destroys nothing.
--
-- ---------------------------------------------------------------------------
-- WHY THIS EXISTS, AND IT IS NOT A NEW FEATURE
--
-- The classification engine was already built and already wired. src/lib/grading.ts
-- computes grades, quality points, GPA, CGPA and the class of award from the
-- university's published scale, and it is covered by tests.
-- /api/credential/issue calls getClassification() and REFUSES to issue a
-- certificate when it cannot — the class of a degree is not a field a caller
-- may state.
--
-- Both of those read the cumulative GPA from a table called semester_gpas.
--
-- THAT TABLE WAS NEVER CREATED, AND NOTHING EVER WROTE TO IT. Two call sites
-- select from it; no code path in the entire system inserts or updates a row.
-- So the calculator was correct, the refusal was correct, and the input was
-- empty — every attempt to issue a certificate returned "no-cgpa" and the
-- engine never once fired. From the outside that is indistinguishable from
-- there being no engine at all, which is exactly how it looked.
--
-- This migration creates the table. The route that fills it is
-- /api/results/recompute.
--
-- ---------------------------------------------------------------------------
-- WHAT A ROW MEANS, AND WHY `basis` IS ON IT
--
-- A GPA computed from marks a lecturer has typed but nobody has approved is not
-- the same fact as a GPA computed from marks that have been through the
-- lecturer → HOD → Dean → Registrar chain, and a certificate must never rest on
-- the first. So every row records which it is, and the issuing route accepts
-- only 'approved'.
--
-- Without that column the two are indistinguishable the moment they are stored,
-- and the safe-looking default — compute from whatever is there — is how a
-- university ends up conferring a First on a spreadsheet that was still being
-- edited.
-- ===========================================================================


-- ===========================================================================
-- 1. THE TABLE
-- ===========================================================================

create table if not exists semester_gpas (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references students (id) on delete cascade,

  -- Which semester this row is the GPA for. Taken from the enrolment, because
  -- that is where the university records when a course was taken; a result
  -- carries a mark, not a calendar.
  academic_year    integer not null,
  semester         integer not null,

  -- The semester's own average, and the running cumulative average up to and
  -- including it. Both are stored rather than one derived from the other: a
  -- transcript prints the semester figure beside each term and the cumulative
  -- figure at the foot, and recomputing the running total on every read would
  -- make the two disagree the moment a back-dated result was posted.
  gpa              numeric(4,2) not null check (gpa >= 0 and gpa <= 4),
  cgpa             numeric(4,2) not null check (cgpa >= 0 and cgpa <= 4),

  -- What the averages were computed over. A CGPA without its credit count
  -- cannot be checked by anybody, and a graduation decision needs the credits
  -- anyway.
  credits_attempted integer not null default 0 check (credits_attempted >= 0),
  credits_earned    integer not null default 0 check (credits_earned >= 0),

  -- 'approved'    — every result counted has been through the approval chain.
  --                 Only this may support a certificate.
  -- 'provisional' — at least one unapproved mark was counted. Useful to a
  --                 student and to an adviser; not a basis for conferral.
  basis            text not null default 'provisional'
                     check (basis in ('approved', 'provisional')),

  computed_at      timestamptz not null default now(),
  computed_by      uuid,

  -- One row per student per semester. The recompute route upserts on this, so
  -- posting a late result corrects the row rather than adding a second one that
  -- silently disagrees with the first.
  unique (student_id, academic_year, semester)
);

create index if not exists semester_gpas_student_idx
  on semester_gpas (student_id, academic_year desc, semester desc);


-- ===========================================================================
-- 2. RLS
--
-- A student may read their own averages. Staff who can see results can see the
-- averages computed from them. NOBODY writes from a browser: with RLS on and no
-- write policy, only the service role can, and the only thing holding the
-- service role is /api/results/recompute — which recomputes from the marks
-- rather than accepting a figure.
--
-- That is the whole point. A GPA that can be written directly is a GPA that can
-- be typed, and a classification derived from a typed GPA is a classification
-- somebody chose.
-- ===========================================================================

alter table semester_gpas enable row level security;

drop policy if exists semester_gpas_own_read on semester_gpas;
create policy semester_gpas_own_read on semester_gpas
  for select using (
    -- auth_user_id, NOT user_id. The students table links to auth.users through
    -- auth_user_id (see 000_complete.sql); a policy naming a column that does
    -- not exist fails at CREATE POLICY, so this would have stopped the
    -- migration on its first line of RLS.
    student_id in (select id from students where auth_user_id = auth.uid())
  );

drop policy if exists semester_gpas_staff_read on semester_gpas;
create policy semester_gpas_staff_read on semester_gpas
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                    'vice-chancellor', 'dean', 'hod', 'lecturer')
  );


-- ===========================================================================
-- 3. THE GUARD
--
-- A trigger, because RLS cannot restrict columns and a policy cannot express
-- "this figure must have been computed". The service role bypasses RLS entirely,
-- so without this the one identity that CAN write is also the one identity with
-- no constraint on what it writes.
--
-- It refuses a cumulative average that is lower than the semester average it
-- contains on a student's first recorded semester, which is arithmetically
-- impossible — the CGPA of one semester IS that semester's GPA. It is a cheap
-- check that catches the class of bug where the two are computed in the wrong
-- order or assigned to the wrong column, which is the mistake that would
-- otherwise print a Third on a First Class transcript.
-- ===========================================================================

create or replace function semester_gpas_guard()
returns trigger language plpgsql as $$
declare
  earlier integer;
begin
  select count(*) into earlier
  from semester_gpas g
  where g.student_id = new.student_id
    and (g.academic_year, g.semester) < (new.academic_year, new.semester);

  if earlier = 0 and abs(new.cgpa - new.gpa) > 0.005 then
    raise exception 'semester_gpas: on a student''s first recorded semester the cumulative average must equal the semester average (got gpa=%, cgpa=%). This is arithmetically impossible and means the two were computed in the wrong order or written to the wrong columns.', new.gpa, new.cgpa;
  end if;

  if new.credits_earned > new.credits_attempted then
    raise exception 'semester_gpas: credits_earned (%) exceeds credits_attempted (%). A student cannot pass more credits than they sat.', new.credits_earned, new.credits_attempted;
  end if;

  return new;
end $$;

drop trigger if exists semester_gpas_guard_trg on semester_gpas;
create trigger semester_gpas_guard_trg
  before insert or update on semester_gpas
  for each row execute function semester_gpas_guard();


-- ===========================================================================
-- 4. VERIFY
-- ===========================================================================

select count(*) as rows_now from semester_gpas;

-- How many students have results but no computed average. Every one of these
-- is a student whose certificate cannot currently be issued.
select count(distinct r.student_id) as students_with_results_but_no_gpa
from results r
where not exists (select 1 from semester_gpas g where g.student_id = r.student_id);


-- ===========================================================================
-- AFTER RUNNING THIS
--
-- 1. Recompute. Nothing is computed by this migration — the marks are the
--    source and the route is the only thing allowed to read them:
--
--      POST /api/results/recompute            { "studentId": "…" }
--      POST /api/results/recompute            { "all": true }
--
--    The Studio's Readiness panel reports how many students still have none.
--
-- 2. Understand what you will get. Results are written by the mark sheet with
--    status 'draft' and NOTHING in this system advances them — the approval
--    chain in src/lib/lifecycle.ts (lecturer → HOD → Dean → Registrar) has no
--    interface. So a recompute today produces rows with basis = 'provisional',
--    and /api/credential/issue will decline them, correctly.
--
--    That is the remaining link and it is a real gap, stated here rather than
--    discovered six weeks later by a registrar with a graduation list.
-- ===========================================================================


-- ===========================================================================
-- ===========================================================================
--
--   008_admission_openings.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — WHAT IS OPEN FOR ADMISSION
--
-- Run after 007_gpa_engine.sql. Idempotent; destroys nothing.
--
-- ---------------------------------------------------------------------------
-- WHY
--
-- The application form offered every award level and every field of study the
-- university has ever taught, permanently. An applicant could apply in March
-- for an intake that does not open until September, to a programme the faculty
-- is not running this year, or to one it has stopped running altogether — and
-- nothing anywhere would refuse it. The application arrived, somebody in
-- Admissions read it, and somebody had to write back and explain.
--
-- That cost falls on the applicant, who waited; on the Admissions Office, which
-- handled a file it could never approve; and on the university, which looks
-- disorganised at precisely the moment it is being judged.
--
-- The Head of Academic Affairs decides what the university is ready to teach.
-- This table is where that decision is recorded, and the form reads it.
--
-- ---------------------------------------------------------------------------
-- WHY EVERY ROW IS SEEDED OPEN
--
-- Because the alternative silently closes admissions.
--
-- If the form treated "no row" as "not open", then the moment this migration
-- ran — before anyone had opened anything — the application form would offer an
-- empty list and every applicant would be turned away by a system nobody had
-- told to turn anyone away. A change that closes the front door of the
-- university as a side effect of being deployed is not an acceptable change.
--
-- So every level and field currently on the form is seeded open. Nothing
-- changes until the Head of Academic Affairs unchecks something, which is the
-- correct default: the migration records the present state and gives somebody
-- the ability to change it.
--
-- The same reasoning governs the form's behaviour when this table is ABSENT
-- entirely: it shows everything, exactly as it did before. A missing table is a
-- migration not yet run, not an instruction to close admissions.
-- ===========================================================================


-- ===========================================================================
-- 1. THE TABLE
-- ===========================================================================

create table if not exists admission_openings (
  id          uuid primary key default gen_random_uuid(),

  -- 'level'  — an award level, e.g. 'Bachelor of Science'
  -- 'field'  — a field of study, e.g. 'Software Engineering'
  --
  -- Two kinds in one table because the form asks two questions and either can
  -- be closed independently: a university may run every field but admit only to
  -- the diploma this year, or teach at every level but suspend one department.
  kind        text not null check (kind in ('level', 'field')),

  -- The exact string the form shows. Matching on the label rather than on an id
  -- is deliberate: the form's options are content, not database rows, and a
  -- lookup table of ids would have to be kept in step with them by hand — which
  -- is the arrangement that eventually shows an applicant an option that leads
  -- nowhere.
  label       text not null,

  -- The group the field belongs to, for the admin screen. Null for levels.
  faculty     text,

  -- The decision. False removes it from the application form.
  open        boolean not null default true,

  -- Optional guidance shown to staff, e.g. 'Not running 2026/27'.
  note        text,

  updated_by  uuid,
  updated_at  timestamptz not null default now(),

  unique (kind, label)
);

create index if not exists admission_openings_open_idx on admission_openings (open);


-- ===========================================================================
-- 2. SEED — everything the form offers today, all open
-- ===========================================================================

insert into admission_openings (kind, label, faculty) values
  ('level', 'Doctor of Philosophy',       null),
  ('level', 'Doctor of Theology',         null),
  ('level', 'Master of Arts',             null),
  ('level', 'Bachelor of Science',        null),
  ('level', 'Diploma',                    null),
  ('level', 'Certificate',                null),

  ('field', 'Theology',                   'Theology'),
  ('field', 'Divinity',                   'Theology'),
  ('field', 'Ministry',                   'Theology'),
  ('field', 'Christian Leadership',       'Theology'),
  ('field', 'Christian Education',        'Theology'),
  ('field', 'Evangelism and Mission',     'Theology'),
  ('field', 'Black Liberation Theology',  'Theology'),
  ('field', 'Primary Education',          'Education'),
  ('field', 'Special Education',          'Education'),
  ('field', 'Software Engineering',       'Engineering'),
  ('field', 'Networking',                 'Engineering'),
  ('field', 'Business Management',        'Business'),
  ('field', 'Project Management',         'Business')
on conflict (kind, label) do nothing;


-- ===========================================================================
-- 3. RLS
--
-- PUBLIC READ, and that is not an oversight. The application form is on the
-- open web and is used by people who have no account — it cannot ask which
-- programmes are open if reading the answer requires signing in.
--
-- What is public is a list of what the university is currently admitting to.
-- That is information the university publishes anyway, on the prospectus and on
-- every programme page.
--
-- NO WRITE POLICY. Only the service role writes, and the only thing holding it
-- is /api/admissions/openings, which is guarded by capability. Admissions being
-- open is an academic decision, not a row somebody can edit from a browser
-- console.
-- ===========================================================================

alter table admission_openings enable row level security;

drop policy if exists admission_openings_public_read on admission_openings;
create policy admission_openings_public_read on admission_openings
  for select using (true);


-- ===========================================================================
-- 4. VERIFY
-- ===========================================================================

select kind, count(*) filter (where open) as open, count(*) as total
from admission_openings group by kind order by kind;

select kind, label, open, note from admission_openings order by kind, faculty nulls first, label;


-- ===========================================================================
-- AFTER RUNNING THIS
--
-- Nothing changes for applicants: everything is seeded open, which is the state
-- the form was already in.
--
-- The Head of Academic Affairs closes and opens programmes in
-- Settings → Admission openings. An unchecked programme disappears from the
-- application form immediately; it is not hidden from the prospectus, because
-- "we are not admitting to this now" and "we do not teach this" are different
-- statements and the site should not conflate them.
-- ===========================================================================


-- ===========================================================================
-- ===========================================================================
--
--   009_results_approval.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — THE GRADE APPROVAL CHAIN
--
-- Run after 008_admission_openings.sql. Idempotent; destroys nothing.
--
-- ---------------------------------------------------------------------------
-- WHY
--
-- Two faults, and together they meant no degree could ever be conferred.
--
-- FAULT ONE — THE CHAIN HAD NO IMPLEMENTATION. Both places a mark can be
-- entered wrote status 'draft', and nothing in the system ever wrote anything
-- else. /api/results/recompute marks a term's average `provisional` unless
-- every mark in it is approved, and /api/credential/issue refuses to issue
-- against a provisional average. Both were behaving correctly. The input was
-- simply never going to arrive: the certificate artwork, the seal, the
-- verification page, the issuance register and the GPA engine were all built
-- and none of them was reachable, because a mark could not become an approved
-- mark.
--
-- FAULT TWO — NOBODY COULD READ OR WRITE A MARK AT ALL. `results` has RLS
-- enabled and exactly one policy on it:
--
--     create policy results_own on results for select using (
--       student_id in (select id from students where auth_user_id = auth.uid())
--     );
--
-- A student may read their own marks. That is the whole policy set. There is no
-- staff SELECT, and there is no INSERT or UPDATE policy for anybody — so the
-- Grade Book's `supabase.from('results').insert(...)` was refused by RLS every
-- time it ran. A lecturer entering a class of marks got an error per row from a
-- browser client, and the Head of Department could not have read them if they
-- had saved.
--
-- This migration fixes both: the states and the audit trail the chain needs,
-- and the read policy staff must have. Writing stays closed to browsers on
-- purpose — see section 4.
--
-- ---------------------------------------------------------------------------
-- THE CHAIN IS THE UNIVERSITY'S, NOT MINE
--
-- `gradeApproval` in src/lib/lifecycle.ts already publishes it:
--
--     1  Lecturer            submits marks for the courses they teach
--     2  Head of Department  moderates the marks
--     3  Dean                approves the moderated marks for the faculty
--     4  Registrar           approves for publication, writing the record
--     5  System              recomputes GPA
--
-- and states: "No step may be skipped, including by an administrator. A result
-- published without moderation is a result the university cannot defend on
-- appeal." That page is read by prospective students and by accreditors. The
-- states below are those steps, so the claim is true of the system and not only
-- of the page.
-- ===========================================================================


-- ===========================================================================
-- 1. THE STATES
--
-- The column already exists and already defaults to 'draft'. What it has never
-- had is a constraint, so any string at all was a valid status — including a
-- typo, which would have read as "not approved" everywhere and silently frozen
-- a class forever with nothing to show why.
-- ===========================================================================

alter table results
  add column if not exists moderated_by         uuid,
  add column if not exists moderated_at         timestamptz,
  add column if not exists faculty_approved_by  uuid,
  add column if not exists faculty_approved_at  timestamptz,
  -- Why a class was sent back. Required by the API when returning: a class
  -- returned without a reason tells the lecturer somebody objected and nothing
  -- about what to change, which produces a second submission identical to the
  -- first.
  add column if not exists returned_reason      text,
  add column if not exists returned_by          uuid,
  add column if not exists returned_at          timestamptz;

-- Existing rows first, or the constraint below fails on live data. Anything
-- that is not one of the five known states is treated as a draft, which is the
-- safe direction: it means "not yet approved" and costs a resubmission, whereas
-- guessing upwards would publish marks nobody approved.
update results
set status = 'draft'
where status is null
   or status not in ('draft', 'submitted', 'moderated', 'faculty-approved', 'approved');

alter table results drop constraint if exists results_status_known;
alter table results add constraint results_status_known
  check (status in ('draft', 'submitted', 'moderated', 'faculty-approved', 'approved'));

-- The queue reads "everything at this stage", and the recompute reads
-- "everything for this student". Neither had an index for it.
create index if not exists results_status_idx         on results (status);
create index if not exists results_course_status_idx  on results (course_id, status);


-- ===========================================================================
-- 2. THE AUDIT TRAIL
--
-- lifecycle.ts promises "Every action is timestamped and attributed" and lists
-- "Audit entry per step" among what this workflow writes. The columns above
-- record the CURRENT state — who moderated it, when. They cannot record a
-- history, because returning a class clears them: a class moderated, returned,
-- corrected and moderated again would show only the second moderation, and the
-- first would be gone as though it had never happened.
--
-- That is exactly the record an appeal turns on. So every step, forward or
-- back, is also appended here and nothing in this table is ever updated or
-- deleted.
-- ===========================================================================

create table if not exists result_transitions (
  id           uuid primary key default gen_random_uuid(),
  result_id    uuid not null references results (id) on delete cascade,

  from_status  text not null,
  to_status    text not null,

  -- 'advance' or 'return'. Derivable from the two statuses, stored anyway
  -- because the question asked of this table is almost always "was this class
  -- ever sent back, and why", and that should not require reasoning about the
  -- order of five strings.
  action       text not null check (action in ('advance', 'return')),

  actor_id     uuid,
  -- The role AT THE TIME. Roles change; a record that resolves the actor's role
  -- by lookup would restate history every time somebody is promoted.
  actor_role   text,
  actor_name   text,

  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists result_transitions_result_idx on result_transitions (result_id, created_at);
create index if not exists result_transitions_actor_idx  on result_transitions (actor_id);


-- ===========================================================================
-- 3. THE FOUR-PEOPLE RULE, AT THE DATABASE
--
-- Nobody may sign the same class twice, at any step.
--
-- The API enforces this too, in src/lib/resultsWorkflow.ts, and that is where
-- the person gets a sentence explaining the refusal. This trigger exists
-- because the API is one caller and the service-role key is not: anything
-- holding it — a script, a future route, a console — bypasses every check
-- written in TypeScript. A rule that four different people must look at a set
-- of marks is not a validation, it is the reason the chain exists, and it
-- belongs where it cannot be routed around.
--
-- WHY NOT JUST "NOT TWO CONSECUTIVE STEPS", which is the obvious rule? Because
-- `admin` is defined as every operational capability, so an administrator holds
-- all four steps. Under the consecutive rule an administrator and one colleague
-- could alternate and walk a class from draft to the academic record with four
-- signatures representing two opinions — satisfying "no step skipped" on paper
-- while skipping two in substance.
--
-- The cost is real and is the correct cost: where one person holds two offices
-- in the chain, that class stops until somebody else is available. A university
-- that cannot find four people to look at a set of marks does not have an
-- approval chain, and the database should say so rather than simulate one.
-- ===========================================================================

create or replace function results_distinct_signatories()
returns trigger
language plpgsql
as $$
declare
  signers uuid[];
begin
  signers := array_remove(
    array[new.submitted_by, new.moderated_by, new.faculty_approved_by, new.approved_by],
    null
  );

  -- cardinality(), not array_length(). array_length('{}', 1) is NULL, not 0, so
  -- an unsigned row — every newly entered mark — would compare NULL against a
  -- count and raise. That would have refused every insert the Grade Book makes,
  -- which is a spectacular way to fix a bug by replacing it with a worse one.
  if cardinality(signers) <> (select count(distinct s) from unnest(signers) as s) then
    raise exception
      'The same person appears twice in the approval chain for this result. Four approvals from '
      'one person is one opinion recorded four times.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists results_distinct_signatories_trg on results;
create trigger results_distinct_signatories_trg
  before insert or update on results
  for each row execute function results_distinct_signatories();


-- ===========================================================================
-- 4. RLS
--
-- STAFF MAY READ. Without this the Grade Book shows an empty class, the
-- approval queue shows nothing, and the Head of Department cannot see the marks
-- they are being asked to moderate. This was the state of the system: only the
-- student could read a result, and staff could read none at all.
--
-- The list is the offices that have a reason to see a mark before it is
-- published — the chain itself, plus the Registry and the Academic Office who
-- answer for the record. A Finance officer is absent: fees are not marks.
--
-- NO WRITE POLICY, AND THAT IS THE DESIGN. Every write goes through
-- /api/results/save and /api/results/advance, which hold the service role and
-- are guarded by capability. A browser cannot write a mark.
--
-- This is not caution for its own sake. If browsers could write marks under
-- RLS, the check on WHO may move a class from 'moderated' to 'approved' would
-- have to be expressible as a row predicate — and it is not: it depends on the
-- caller's capability, on which step the class is at, and on who has already
-- signed it. RLS cannot see the first and cannot express the third. The rule
-- would end up as "staff may update results", which is not the rule.
--
-- The existing student policy is left exactly as it is.
-- ===========================================================================

drop policy if exists results_staff_read on results;
create policy results_staff_read on results
  for select using (
    auth_role() in (
      'superadmin', 'admin', 'registrar', 'academic-office',
      'dean', 'hod', 'programme-coordinator', 'lecturer'
    )
  );

alter table result_transitions enable row level security;

-- The same offices may read the history. A student is deliberately absent: the
-- trail records internal deliberation — who sent a class back and why — and
-- publishing that to the class is a different decision for the university to
-- take deliberately, not a side effect of a migration.
drop policy if exists result_transitions_staff_read on result_transitions;
create policy result_transitions_staff_read on result_transitions
  for select using (
    auth_role() in (
      'superadmin', 'admin', 'registrar', 'academic-office',
      'dean', 'hod', 'programme-coordinator', 'lecturer'
    )
  );

-- No write policy here either. The trail is written by the same guarded routes,
-- and an append-only record that a browser can append to is not append-only.


-- ===========================================================================
-- 5. VERIFY
-- ===========================================================================

select status, count(*) from results group by status order by status;

select
  count(*) filter (where status = 'draft')            as draft,
  count(*) filter (where status = 'submitted')        as awaiting_moderation,
  count(*) filter (where status = 'moderated')        as awaiting_faculty,
  count(*) filter (where status = 'faculty-approved') as awaiting_publication,
  count(*) filter (where status = 'approved')         as published
from results;

select tablename, policyname, cmd
from pg_policies
where tablename in ('results', 'result_transitions')
order by tablename, policyname;


-- ===========================================================================
-- AFTER RUNNING THIS
--
-- Nothing is approved by this migration. Every existing mark stays a draft,
-- which is what it already was — the states and the trail now exist, and marks
-- move through them when the offices act.
--
-- To get the first degree out of the system:
--
--   1. A lecturer enters marks (Grade Book) and presses Submit.
--   2. A Head of Department moderates them (Records → Result approval).
--   3. A Dean approves them for the faculty.
--   4. The Registrar approves them for publication. GPAs recompute
--      automatically at this step — no second button, because a correct
--      approval that still cannot produce a certificate because somebody
--      forgot to press Recompute is the same failure this migration exists to
--      end.
--   5. The average for that term becomes `basis = 'approved'`, and
--      /api/credential/issue will issue against it.
--
-- FOUR DIFFERENT PEOPLE ARE REQUIRED. If the same account tries to perform two
-- of the four steps it is refused, by the API with an explanation and by the
-- trigger above regardless of caller. Appoint the offices — see the role
-- assignment screen — before a term's marks are due.
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

