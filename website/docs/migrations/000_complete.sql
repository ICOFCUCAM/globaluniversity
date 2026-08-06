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
-- THREE THINGS TO DO AFTER THIS FINISHES
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
-- ===========================================================================
