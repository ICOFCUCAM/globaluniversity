-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — MIGRATIONS 001, 002, 003, 004, 005, 006, 007, 008, 009, 010, 011, 012, 013, 014, 015, 016, 017, 018, 019, 020, 021, 022, 023, 024, 025, 026, 027, 028, 029, 030, 031, 032, 033, 034, 035, 036, 037, IN ORDER
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-migration-run.mjs
--   Rebuild:   node scripts/build-migration-run.mjs --out=RUN-ALL.sql 001 002 003 004 005 006 007 008 009 010 011 012 013 014 015 016 017 018 019 020 021 022 023 024 025 026 027 028 029 030 031 032 033 034 035 036 037
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
-- AFTERWARDS
--
-- Run docs/migrations/VERIFY.sql to see what landed.
-- ===========================================================================

-- ===========================================================================
-- ===========================================================================
--
--   001_full_schema.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- ICOF Global University — full schema and admissions pipeline
--
-- Run this once, whole, in the Supabase SQL editor:
--   Dashboard → SQL Editor → New query → paste → Run
--
-- SAFE TO RUN ON AN EMPTY PROJECT OR AN EXISTING ONE. Every statement is
-- idempotent: `create table if not exists`, `add column if not exists`,
-- `drop policy if exists` before each `create policy`. Running it twice
-- changes nothing the second time, so it is safe to re-run after an edit.
--
-- IT DOES NOT DROP ANYTHING. No `drop table`, no `truncate`, no `delete`.
-- Existing data is untouched; existing tables gain the missing columns.
--
-- Read section 6 before you finish. It is the part that stops every
-- applicant's date of birth and identity number being public.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";  -- gen_random_uuid()


-- ---------------------------------------------------------------------------
-- 2. Core tables
--
-- Column names match src/lib/types.ts exactly. If you rename anything here the
-- portal stops reading it, so change both or neither.
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- PAYMENTS — ADDED HERE BECAUSE RUN-ALL.sql HAS NEVER WORKED WITHOUT IT.
--
-- This table existed only in 000_complete.sql, which is 001 and 002 merged.
-- The bundle builder refuses to list 000 alongside 001 and 002 — rightly, it
-- would run the same DDL twice — so every RUN-ALL.sql ever built has gone
-- 001, 002, 003 … and then reached 010, which writes a row-level security
-- policy on `payments`, and stopped dead with "relation payments does not
-- exist".
--
-- Nobody noticed because nobody has built this University from nothing since
-- the bundle was introduced; every real database grew from 000. But RUN-ALL is
-- precisely the file somebody reaches for when they do, and it is the one that
-- could not do it. Proven by running it against an empty database: it failed at
-- the same line before this change and passes after.
--
-- The definition is 000's, unchanged.
-- ---------------------------------------------------------------------------
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


-- ---------------------------------------------------------------------------
-- 3. Admissions pipeline columns
--
-- These are what the Finance desk and the Registrar's desk write. On a fresh
-- project section 2 already created `students`, so these add the rest; on an
-- existing database they add only what is missing.
-- ---------------------------------------------------------------------------

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
  -- Links a student row to its auth account. Needed by the RLS policy in
  -- section 6 so a student can read their own record and nobody else's.
  add column if not exists auth_user_id         uuid references auth.users (id) on delete set null;


-- ---------------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------------

-- Both desks read by status on every page load.
create index if not exists students_status_created_idx on students (status, created_at);
create index if not exists students_auth_user_idx      on students (auth_user_id);
create index if not exists enrollments_student_idx     on enrollments (student_id);
create index if not exists results_student_idx         on results (student_id);
create index if not exists documents_student_idx       on documents (student_id);

-- Student numbers must be unique. The generator derives the next sequence from
-- the highest existing number for the year, so two approvals racing would both
-- compute the same one; this makes the second fail loudly rather than issue a
-- duplicate number to a second student.
create unique index if not exists students_student_number_key
  on students (student_number) where student_number is not null;


-- ---------------------------------------------------------------------------
-- 5. Keep updated_at honest
-- ---------------------------------------------------------------------------

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


-- ---------------------------------------------------------------------------
-- 5b. Give every new account a profile
--
-- The portal reads the signed-in user's role from `profiles`, not from the auth
-- record: src/contexts/AuthContext.tsx signs in, looks up the row, and if there
-- is none it rejects the session with "Profile not found. Please contact
-- administrator." Creating a user in the Supabase dashboard therefore produces
-- an account that authenticates and still cannot get in.
--
-- That is how staff accounts are made — there is no sign-up form, by design, so
-- the Registrar, Finance and admin accounts are all created by hand in the
-- dashboard. Without this trigger every one of them would be dead on arrival.
--
-- `security definer` is required: the insert into auth.users runs as
-- supabase_auth_admin, which has no rights on public.profiles. The function
-- therefore runs as its owner instead, and search_path is pinned so it cannot
-- be redirected to a shadowed table.
--
-- Every account starts as 'student', the least privileged role, whatever the
-- caller asked for. Promote a staff account afterwards:
--
--   update profiles set role = 'admin' where email = 'registrar@iguc.net';
--
-- Valid roles are the sixteen in src/lib/types.ts: admin, chancellor,
-- vice-chancellor, registrar, finance-director, dean, hod,
-- programme-coordinator, lecturer, finance, admissions-officer, library-staff,
-- student-affairs, student, applicant, academic-office.
-- ---------------------------------------------------------------------------

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
    -- ALWAYS 'student'. Never a role taken from user_metadata.
    --
    -- raw_user_meta_data is caller-supplied: supabase.auth.signUp is callable
    -- from any browser holding the publishable key, and it stores whatever the
    -- caller passes in options.data. Honouring a role from there would let
    -- anyone sign themselves up as a Superadministrator. The server routes set
    -- the real role immediately afterwards with the service-role key, which is
    -- the only path that can raise a role at all.
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

-- Backfill: any account created before this trigger existed has no profile and
-- cannot sign in. This gives each one the same row the trigger would have.
insert into profiles (id, email, full_name, role)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', u.email),
  'student'  -- same reasoning as above; promote deliberately, never by metadata
from auth.users u
where not exists (select 1 from profiles p where p.id = u.id);


-- ---------------------------------------------------------------------------
-- 6. ROW-LEVEL SECURITY — THE IMPORTANT PART
--
-- The publishable key is in the site's JavaScript and is sent by every
-- visitor's browser. That is normal and safe, but ONLY because RLS decides
-- what that key can read. A table with RLS switched off is readable by anyone
-- who opens the page source and copies the key.
--
-- `students.address` holds the full application text: date of birth, identity
-- numbers, next of kin, medical disclosure, references. Getting this section
-- wrong publishes all of it.
--
-- The two admissions desks are unaffected by everything below. They read
-- through the service-role key, which bypasses RLS by design.
-- ---------------------------------------------------------------------------

alter table departments enable row level security;
alter table profiles    enable row level security;
alter table students    enable row level security;
alter table lecturers   enable row level security;
alter table courses     enable row level security;
alter table enrollments enable row level security;
alter table results     enable row level security;
alter table documents   enable row level security;
alter table audit_logs  enable row level security;

-- Reference data anyone may read. Nothing here is personal.
drop policy if exists departments_public_read on departments;
create policy departments_public_read on departments for select using (true);

drop policy if exists courses_public_read on courses;
create policy courses_public_read on courses for select using (true);

-- A signed-in user reads their own profile.
drop policy if exists profiles_own on profiles;
create policy profiles_own on profiles for select using (auth.uid() = id);

drop policy if exists profiles_own_update on profiles;
create policy profiles_own_update on profiles for update using (auth.uid() = id);

-- A student reads their own record and nothing else. Note this grants SELECT
-- only: a student cannot change their own programme, status or student number.
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

-- Staff directory. Names and titles are already published on the website; if
-- you would rather this were signed-in only, change `true` to
-- `auth.uid() is not null`.
drop policy if exists lecturers_public_read on lecturers;
create policy lecturers_public_read on lecturers for select using (true);

-- audit_logs deliberately gets NO policy. With RLS on and no policy, only the
-- service role can read it — which is the correct answer for an audit trail.


-- ---------------------------------------------------------------------------
-- 7. Let the public application form write, without letting it read
--
-- /apply inserts a row using the publishable key. It needs INSERT and must not
-- get SELECT — otherwise the same key that submits an application could also
-- list every other application.
-- ---------------------------------------------------------------------------

drop policy if exists students_public_apply on students;
create policy students_public_apply on students
  for insert with check (status = 'applicant');


-- ---------------------------------------------------------------------------
-- 8. Verify — read the output of this
-- ---------------------------------------------------------------------------

-- Every table should show rowsecurity = true.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- Confirm the pipeline columns landed. Expect 15 rows.
select column_name
from information_schema.columns
where table_name = 'students'
  and column_name in (
    'payment_status','fee_reference','fee_amount','fee_currency',
    'fee_registered_by','fee_registered_at','decision_reason','decided_by',
    'decided_at','account_created_at','admission_conditions','student_number',
    'faculty','intake','auth_user_id'
  )
order by column_name;

-- Every auth account must have a profile or it cannot sign in. Expect 0 rows.
select u.email, u.created_at
from auth.users u
where not exists (select 1 from profiles p where p.id = u.id);


-- ===========================================================================
-- CREATING THE FIRST STAFF ACCOUNT
--
-- There is no sign-up form. Students are created by the Registrar's approve
-- route; everyone else is created here, in two steps:
--
--   1. Dashboard → Authentication → Users → Add user. Tick "Auto Confirm
--      User", or the account cannot sign in until someone clicks an email.
--   2. Promote it — the trigger in section 5b defaults every new account to
--      'student':
--
--        update profiles
--        set role = 'admin', full_name = 'Full Name'
--        where email = 'registrar@iguc.net';
--
-- 'admin' sees the whole system. 'registrar' and 'finance' are the two
-- admissions desks and deliberately cannot do each other's job — Finance
-- cannot admit, the Registrar cannot edit payments (src/lib/roles.ts).
-- ===========================================================================


-- ===========================================================================
-- AFTER RUNNING THIS, do the outside check. From a terminal — not the SQL
-- editor, because the editor is authenticated and will always succeed:
--
--   curl -s "https://<your-project>.supabase.co/rest/v1/students?select=id,email&limit=1" \
--     -H "apikey: <your publishable key>"
--
--   []                     RLS is holding. Correct.
--   [{"id":...}]           Something above did not apply. Stop and fix it.
--
-- Then set SUPABASE_SERVICE_ROLE_KEY in Vercel — server-side, never with a
-- NEXT_PUBLIC_ prefix. Without it the Registrar's approve button refuses
-- rather than silently creating no account.
-- ===========================================================================


-- ===========================================================================
-- ===========================================================================
--
--   002_superadmin.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- ICOF Global University — Superadministrator, suspension, credential designs
--
-- Run this AFTER 001_full_schema.sql, whole, in the Supabase SQL editor.
-- Idempotent and additive: it creates nothing that 001 created, drops no table,
-- and deletes no row. Running it twice changes nothing the second time.
--
-- SECTION 3 IS A SECURITY FIX AND IS NOT OPTIONAL. Until it runs, any signed-in
-- user can promote themselves to Superadministrator from the browser console.
-- See the explanation there before deciding to skip anything.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 0. Clear the guard triggers first
--
-- Recreated correctly in sections 3 and 5. Dropped here because an earlier
-- version of this file installed a guard that refused any change to
-- profiles.role unless the connection was the service role — and the SQL editor
-- is `postgres`, not the service role. That version blocked its own section 9
-- with "role may only be changed by the Superadministrator", and would block a
-- re-run before the corrected version could replace it.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.profiles') is not null then
    drop trigger if exists profiles_guard_privileges      on profiles;
    drop trigger if exists profiles_guard_last_superadmin on profiles;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------

alter table profiles
  -- Null means active. Set only by /api/admin/suspend, which also bans the auth
  -- user so an existing token stops working; this column is the record and the
  -- thing the portal checks on the next page load.
  add column if not exists suspended_at      timestamptz,
  add column if not exists suspended_by      uuid references auth.users (id) on delete set null,
  add column if not exists suspension_reason text;

alter table lecturers
  -- A lecturer needs an account to sign in and a lecturer row to be allocated a
  -- course. This links the two; without it the teaching record and the person
  -- are only connected by a matching email address.
  add column if not exists auth_user_id uuid references auth.users (id) on delete set null;

create index if not exists profiles_role_idx      on profiles (role);
create index if not exists profiles_suspended_idx on profiles (suspended_at);
create index if not exists lecturers_auth_user_idx on lecturers (auth_user_id);


-- ---------------------------------------------------------------------------
-- 2. Valid roles, including the new one
--
-- A typo in a role is silent: the account signs in and can do nothing, with no
-- error anywhere to say why. The constraint turns that into a failed update at
-- the moment it is made.
-- ---------------------------------------------------------------------------

-- Anything unrecognised becomes 'student' rather than blocking the constraint.
-- Least privilege is the safe direction to round in.
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


-- ---------------------------------------------------------------------------
-- 3. STOP USERS PROMOTING THEMSELVES  ← the security fix
--
-- 001 created this policy:
--
--   create policy profiles_own_update on profiles for update using (auth.uid() = id);
--
-- It was meant to let someone change their own display name. Postgres RLS
-- cannot restrict which COLUMNS a policy covers, so it grants the whole row —
-- including `role`. Any signed-in user, including a student, can open the
-- browser console and run:
--
--   supabase.from('profiles').update({ role: 'superadmin' }).eq('id', myId)
--
-- and it succeeds. Every separation of duties in this system rests on that
-- column, so until this section runs, none of them hold.
--
-- The fix is column-level privileges, which RLS does not provide and which
-- apply underneath it: `authenticated` simply has no UPDATE right on these
-- columns, so no policy can grant one. The service role keeps its rights, which
-- is why /api/admin/* still works — and why promotion and suspension can now
-- happen only through a route that authorises, records and audits them.
-- ---------------------------------------------------------------------------

revoke update on profiles from authenticated, anon;

-- Grant back only the columns a person may legitimately change about
-- themselves. Note what is absent: role, suspended_at, suspended_by,
-- suspension_reason, id, created_at.
grant update (full_name, avatar_url) on profiles to authenticated;

-- Defence in depth. If a future migration re-grants the column by accident, or
-- a policy is written that appears to allow it, this still refuses. It runs as
-- a trigger, so it applies to every path except the ones that deliberately set
-- session_replication_role — which the service role does not.
create or replace function guard_profile_privileges() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Block the browser roles specifically, rather than allowing only the service
  -- role. PostgREST switches to 'authenticated' or 'anon' for a request carrying
  -- the publishable key, and to 'service_role' for one carrying the secret key;
  -- the SQL editor runs as 'postgres'. Testing for "not service_role" would
  -- therefore also block the SQL editor — including the appointment statements
  -- in section 9 of this very file, which is how this was found.
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


-- ---------------------------------------------------------------------------
-- 4. The trigger from 001, corrected
--
-- 001 took the new account's role from raw_user_meta_data. That field is
-- caller-supplied: `supabase.auth.signUp` is callable from any browser holding
-- the publishable key and stores whatever is passed in options.data, so a
-- self-registered user could have arrived as a Superadministrator.
--
-- Every account now starts as 'student'. The server routes set the real role
-- immediately afterwards with the service-role key, which section 3 just made
-- the only path that can raise a role at all.
--
-- ALSO DO THIS, IN THE DASHBOARD: Authentication → Providers → Email, turn OFF
-- "Allow new users to sign up". The portal has no sign-up form, but the
-- endpoint stays open until that switch is off, and an open endpoint means
-- anyone can mint themselves a student account.
-- ---------------------------------------------------------------------------

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


-- ---------------------------------------------------------------------------
-- 5. The last Superadministrator cannot be suspended
--
-- Not a safety rail for clumsiness — a governance one. An institution whose
-- only holder of system custody is locked out has no one with the standing to
-- unlock anyone, and recovery means editing the database by hand.
-- ---------------------------------------------------------------------------

create or replace function guard_last_superadmin() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining integer;
begin
  if new.suspended_at is not null and old.suspended_at is null and old.role = 'superadmin' then
    select count(*) into remaining
    from public.profiles
    where role = 'superadmin' and suspended_at is null and id <> old.id;
    if remaining = 0 then
      raise exception 'cannot suspend the last active Superadministrator';
    end if;
  end if;
  -- The same applies to demotion: promoting yourself out of the role is the
  -- other way to end up with none.
  if new.role is distinct from 'superadmin' and old.role = 'superadmin' then
    select count(*) into remaining
    from public.profiles
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


-- ---------------------------------------------------------------------------
-- 6. The audit trail becomes append-only
--
-- audit_logs already has RLS on with no policy, so only the service role can
-- read it. That is not the same as being unfalsifiable: the service role could
-- also delete from it, and the routes that write to it hold that key.
--
-- These triggers refuse UPDATE and DELETE on the table for everyone, service
-- role included. The Superadministrator can read the log of their own actions
-- and cannot remove a line from it. A record that the most powerful account can
-- edit is not a record of anything.
-- ---------------------------------------------------------------------------

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


-- ---------------------------------------------------------------------------
-- 7. Let the Superadministrator see every account
--
-- profiles_own restricts SELECT to your own row, which is right for students
-- and wrong for the Accounts screen — it would show an empty table.
--
-- A policy on `profiles` that reads `profiles` recurses infinitely. The way out
-- is a security-definer function: owned by the table owner, so it reads past
-- RLS, and stable so the planner calls it once per statement.
-- ---------------------------------------------------------------------------

create or replace function auth_role() returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

drop policy if exists profiles_system_read on profiles;
create policy profiles_system_read on profiles
  for select using (auth_role() in ('superadmin', 'admin'));


-- ---------------------------------------------------------------------------
-- 8. Credential designs
--
-- One row per published version. Publishing writes a new row rather than
-- editing the active one, so a certificate issued under v1 can always be
-- re-rendered as it was issued — see src/lib/credentialTemplate.ts for why that
-- is not a nicety.
-- ---------------------------------------------------------------------------

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

-- Exactly one active version per kind. Without this, two actives would make
-- "which design is in force" a question with two answers.
create unique index if not exists credential_templates_one_active
  on credential_templates (kind) where is_active;

alter table credential_templates enable row level security;

-- Anyone may read a design: it is the appearance of a public document, and the
-- Certificate Generator renders it with the publishable key.
drop policy if exists credential_templates_read on credential_templates;
create policy credential_templates_read on credential_templates for select using (true);

-- No INSERT or UPDATE policy at all. Writing is the service role's alone, which
-- means /api/admin/credential-template, which requires 'publish-credential-
-- template', which only the Superadministrator holds.

-- Published versions are permanent. Editing one would change what the
-- university appears to have attested to, for every graduate holding it.
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


-- ---------------------------------------------------------------------------
-- 9. Appoint the Superadministrator
--
-- Create both accounts first in the dashboard:
--   Authentication → Users → Add user → tick "Auto Confirm User"
--
--   superadmin@iguc.net   → Superadministrator (system custody)
--   tchamer@aol.com       → System Administrator (day-to-day)
--
-- Then this promotes them. Edit the addresses if you used different ones.
--
-- The split matters: system custody sits on a university mailbox the
-- institution controls, not a personal one. If the personal account is ever
-- compromised, the attacker gets an administrator — who cannot assign roles,
-- cannot suspend anyone, and cannot redesign a certificate.
-- ---------------------------------------------------------------------------

update profiles set role = 'superadmin', full_name = coalesce(nullif(full_name, ''), 'Superadministrator')
where lower(email) = 'superadmin@iguc.net';

update profiles set role = 'admin', full_name = coalesce(nullif(full_name, ''), 'System Administrator')
where lower(email) = 'tchamer@aol.com';


-- ---------------------------------------------------------------------------
-- 10. Verify — read every one of these
-- ---------------------------------------------------------------------------

-- (a) There must be at least one. If this is empty, the account was never
--     created in the dashboard or the email differs.
select email, full_name, role, suspended_at
from profiles
where role in ('superadmin', 'admin')
order by role, email;

-- (b) `authenticated` must NOT appear with update on role. Expect rows only for
--     full_name and avatar_url.
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_name = 'profiles'
  and grantee in ('authenticated', 'anon')
  and privilege_type = 'UPDATE'
order by grantee, column_name;

-- (c) All five guards must be present. Expect 5 rows.
select tgname from pg_trigger
where tgname in (
  'profiles_guard_privileges', 'profiles_guard_last_superadmin',
  'audit_logs_no_update', 'audit_logs_no_delete', 'credential_templates_immutable'
)
order by tgname;

-- (d) Every account still has a profile. Expect 0 rows.
select u.email from auth.users u
where not exists (select 1 from profiles p where p.id = u.id);


-- ===========================================================================
-- AFTER RUNNING THIS
--
-- 1. Dashboard → Authentication → Providers → Email → turn OFF "Allow new
--    users to sign up". Section 4 explains why: the portal has no sign-up
--    form, but the endpoint stays open until that switch is off.
--
-- 2. Prove section 3 worked, from a browser console signed in as any student:
--
--      await supabase.from('profiles').update({role:'superadmin'}).eq('id', user.id)
--
--    It must return an error. If it returns success, stop — every separation of
--    duties in this system is currently decorative.
--
-- 3. Sign in as superadmin@iguc.net. Two menu items appear that appear for no
--    one else: Accounts, and Credential Studio.
--
-- 4. In the Credential Studio, publish v1 of the certificate without changing
--    anything. The built-in default is a faithful copy of the previous design,
--    so v1 records "this is what we were already issuing" before any change is
--    made against it.
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


-- ===========================================================================
-- ===========================================================================
--
--   015_examination_and_proctoring.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — THE DIGITAL EXAMINATION & PROCTORING SYSTEM
--
-- Run after 014_social_approval_and_retry.sql. Idempotent; destroys nothing.
--
-- The third subsystem, and the one with the highest stakes. A social post can
-- be deleted and a certificate can be reissued. An examination result decides
-- whether somebody graduates, and a misconduct finding follows a person for the
-- rest of their professional life.
--
-- ===========================================================================
-- THE ONE DISTINCTION THIS ENTIRE SCHEMA IS BUILT AROUND
-- ===========================================================================
--
-- The University stated it plainly, and it is the most important sentence in
-- the specification:
--
--   "The system should distinguish between EVIDENCE — recordings, screen
--    activity, submitted answers, timestamps — and DECISIONS — examiner flags,
--    misconduct findings, marks, moderation decisions. That distinction is
--    important for academic integrity and appeals."
--
-- So they are different tables with different rules, and the rules are enforced
-- by the database rather than by convention:
--
--   EVIDENCE is APPEND-ONLY. What the camera saw, when the screen share
--   stopped, what the candidate typed at 10:42 and again at 10:43. No UPDATE.
--   No DELETE. Not by an examiner, not by the Examination Officer, not by the
--   Superadministrator, not by anything holding the service-role key.
--
--   DECISIONS are ATTRIBUTABLE AND REVISABLE. A flag can be withdrawn, a mark
--   can be corrected, a misconduct finding can be overturned on appeal — and
--   every change records who, what, when, before, after and why, which is the
--   six-part record the University asked for.
--
-- WHY THIS MATTERS MORE THAN IT SOUNDS. An appeal asks two questions: what
-- actually happened, and was the judgement about it sound. A system that stores
-- both in one editable table cannot answer either — because the evidence may
-- have been revised to fit the finding, and there is no way to tell. Separating
-- them means the University can concede that a judgement was wrong while still
-- standing behind its record of the facts.
--
-- ===========================================================================
-- AN AUTOMATED EVENT IS AN ALERT. IT IS NEVER A FINDING.
-- ===========================================================================
--
--   "AI-generated events should be treated as alerts, not automatic proof of
--    cheating. A human examiner should make the academic-integrity decision."
--
-- This is enforced structurally rather than by policy. `exam_events` — where
-- "second face detected", "candidate left the window", "screen share stopped"
-- are written — HAS NO COLUMN IN WHICH A FINDING COULD BE RECORDED. There is no
-- `is_cheating`, no `verdict`, no `outcome`. The only place a finding can exist
-- is `exam_findings`, whose `decided_by` is NOT NULL and references a real
-- person holding 'determine-misconduct'.
--
-- A schema in which the automated layer cannot express a verdict is a stronger
-- guarantee than a policy saying it should not.
-- ===========================================================================


-- ===========================================================================
-- PART 1 — THE EXAMINATION ITSELF
-- ===========================================================================

-- 1 (a) ---------------------------------------------------------------------
-- WHAT KIND OF EXAMINATION IS THIS?
--
-- Five models, because the University asked that the system "support different
-- examination models rather than forcing every course into one format". A viva
-- voce in systematic theology and a multiple-choice paper in IT are both
-- examinations and share almost nothing operationally: one has a panel and no
-- questions table, the other has two hundred questions and no examiner in the
-- room.
--
-- Folding them into one shape would mean either a paper that carries a
-- meaningless "panel" or a defence that carries a meaningless "time limit".

create table if not exists examinations (
  id              uuid primary key default gen_random_uuid(),

  course_id       uuid references courses (id) on delete restrict,
  -- Denormalised so an examination record still reads correctly if a course is
  -- renamed years later. The examination happened under the title it had.
  course_code     text,
  course_title    text,
  programme       text,

  title           text not null,

  mode            text not null default 'standard' check (mode in (
                    'standard',      -- timed paper, automated supervision
                    'oral',          -- viva voce, live with an examiner
                    'practical',     -- demonstrated skill, observed
                    'defence',       -- dissertation defence, panel
                    'take-home'      -- long window, integrity controls, no camera
                  )),

  -- Minutes. Null for take-home, which uses the window below instead.
  duration_minutes integer,
  opens_at        timestamptz,
  closes_at       timestamptz,

  total_marks     integer not null default 100,
  pass_mark       integer not null default 50,

  -- LAYER 3 OF THE UNIVERSITY'S ANTI-CHEATING MODEL, as data rather than as
  -- code, so an Examination Officer can set it per paper without a deployment.
  randomise_questions boolean not null default false,
  randomise_options   boolean not null default false,
  require_fullscreen  boolean not null default true,
  require_camera      boolean not null default true,
  require_microphone  boolean not null default true,
  require_screen_share boolean not null default true,

  -- WHY A TAKE-HOME EXAMINATION MUST BE ABLE TO SWITCH THESE OFF.
  -- The University explicitly allows "a longer examination window while
  -- requiring submission of work and maintaining academic-integrity controls".
  -- Demanding a camera for seventy-two hours is not an integrity control; it is
  -- a rule nobody can comply with, and rules nobody can comply with are how a
  -- proctoring system loses the confidence of the people it supervises.

  status          text not null default 'draft' check (status in (
                    'draft', 'questions_approved', 'published', 'in_progress',
                    'closed', 'cancelled'
                  )),

  created_by      uuid references auth.users (id) on delete set null,
  approved_by     uuid references auth.users (id) on delete set null,
  approved_at     timestamptz,
  published_by    uuid references auth.users (id) on delete set null,
  published_at    timestamptz,

  created_at      timestamptz not null default now(),

  -- A paper that closes before it opens is a scheduling error worth catching
  -- here rather than at the moment a cohort tries to sit it.
  constraint examinations_window check (opens_at is null or closes_at is null or closes_at > opens_at),
  constraint examinations_pass_mark check (pass_mark >= 0 and pass_mark <= total_marks)
);

create index if not exists examinations_status_idx on examinations (status, opens_at);
create index if not exists examinations_course_idx on examinations (course_id);


-- 1 (b) ---------------------------------------------------------------------
-- WHO IS SUPERVISING, AND IN WHAT CAPACITY.
--
-- A defence has a chairperson and two examiners; a standard paper has one
-- invigilator watching forty candidates. Both are rows here.
--
-- ROLE IS PER EXAMINATION, NOT PER ACCOUNT. A lecturer may examine one paper
-- and moderate another in the same week — but never both on the same script,
-- which is what the unique constraint and 4(c)'s trigger are for.

create table if not exists examination_officers (
  id              uuid primary key default gen_random_uuid(),
  examination_id  uuid not null references examinations (id) on delete cascade,
  person_id       uuid not null references auth.users (id) on delete restrict,

  role            text not null check (role in (
                    'chair', 'examiner', 'invigilator', 'moderator', 'observer'
                  )),

  assigned_by     uuid references auth.users (id) on delete set null,
  assigned_at     timestamptz not null default now(),

  unique (examination_id, person_id, role)
);

create index if not exists examination_officers_person_idx on examination_officers (person_id);


-- ===========================================================================
-- PART 2 — THE SITTING
-- ===========================================================================

-- 2 (a) ---------------------------------------------------------------------
-- ONE CANDIDATE, ONE EXAMINATION, ONE SESSION.
--
-- The session is the spine of the whole subsystem: identity check, device
-- check, events, answers, marks and findings all hang off it.
--
-- THIS TABLE IS NOT EVIDENCE and does not pretend to be. It carries mutable
-- state — a session is created, then started, then submitted — and every one of
-- those transitions writes an immutable row into `exam_events`. The current
-- state is here for the interface; what happened is over there.

create table if not exists exam_sessions (
  id              uuid primary key default gen_random_uuid(),
  examination_id  uuid not null references examinations (id) on delete restrict,
  student_id      uuid references students (id) on delete restrict,
  -- Denormalised for the same reason as the course title: the record must still
  -- read correctly in five years.
  student_number  text,
  candidate_name  text,

  status          text not null default 'created' check (status in (
                    'created',        -- eligibility verified, nothing checked yet
                    'checks',         -- identity and device checks under way
                    'ready',          -- everything passed, waiting to start
                    'in_progress',
                    'paused',         -- examiner paused it; the clock stops
                    'submitted',
                    'terminated',     -- ended by an examiner, with a reason
                    'abandoned',      -- window closed with no submission
                    'void'            -- annulled after the fact, with a reason
                  )),

  -- THE CLOCK RUNS CENTRALLY. The University asked for this specifically, and
  -- the reason is that a timer running in the candidate's browser is a timer
  -- the candidate can edit. `started_at` plus the examination's duration, less
  -- whatever `paused_ms` has accumulated, is the only authority on time
  -- remaining; the browser displays a countdown it is told.
  started_at      timestamptz,
  submitted_at    timestamptz,
  paused_ms       bigint not null default 0,
  paused_at       timestamptz,
  -- Granted by an examiner, in minutes, always with a reason recorded as a
  -- decision in exam_session_decisions.
  extra_minutes   integer not null default 0,

  -- A POINTER, NEVER THE SECRET. Same discipline as social_accounts.token_ref:
  -- the join token for the proctoring service lives in the secret store, and
  -- this column is the key to look it up. A session token in an application
  -- table is a way into somebody's live camera feed.
  session_token_ref text,

  terminated_by   uuid references auth.users (id) on delete set null,
  termination_reason text,

  created_at      timestamptz not null default now(),

  unique (examination_id, student_id),

  -- A termination with no stated reason is indistinguishable from a fault, and
  -- it is the first thing an appeal asks about.
  constraint exam_sessions_termination_reason check (
    status <> 'terminated' or length(btrim(coalesce(termination_reason, ''))) > 0
  )
);

create index if not exists exam_sessions_exam_idx on exam_sessions (examination_id, status);
create index if not exists exam_sessions_student_idx on exam_sessions (student_id);
create index if not exists exam_sessions_live_idx on exam_sessions (status)
  where status in ('in_progress', 'paused', 'checks', 'ready');


-- 2 (b) ---------------------------------------------------------------------
-- LAYER 1 AND LAYER 2 — IDENTITY, AND THE ROOM.
--
-- EVIDENCE. Append-only, like everything in part 3.
--
-- The University's layered model puts identity first for a reason: every other
-- control assumes the person in front of the camera is the person on the
-- register. A perfect proctoring session of the wrong human being is worth
-- nothing.
--
-- WHAT IS DELIBERATELY NOT HERE: a biometric template, a face embedding, or
-- anything else that would let this system recognise a person across sittings.
-- The check is "does the face match the ID document presented now", performed
-- and recorded once. Storing a template would make the University the custodian
-- of a biometric database it never asked for and cannot secure, and would
-- outlive the examination by decades.

create table if not exists exam_identity_checks (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references exam_sessions (id) on delete restrict,

  method          text not null check (method in (
                    'photo_id', 'live_comparison', 'known_to_examiner', 'institutional_login'
                  )),

  -- Pointers into storage. Never image data in the database.
  id_image_path   text,
  face_image_path text,

  outcome         text not null check (outcome in ('passed', 'failed', 'overridden')),

  -- WHO SAID SO. Null when an automated comparison ran; NOT NULL when a person
  -- overrode it — because an override is a decision and decisions have owners.
  checked_by      uuid references auth.users (id) on delete set null,
  note            text,

  checked_at      timestamptz not null default now(),

  constraint exam_identity_override_has_owner check (
    outcome <> 'overridden' or (checked_by is not null and length(btrim(coalesce(note, ''))) > 0)
  )
);

create index if not exists exam_identity_session_idx on exam_identity_checks (session_id);


-- 2 (c) ---------------------------------------------------------------------
-- THE DEVICE AND CONNECTION CHECK, before anybody starts.
--
-- EVIDENCE. Recorded so that "my camera failed" can be answered with what the
-- system actually observed at 09:58, rather than with two recollections.

create table if not exists exam_device_checks (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references exam_sessions (id) on delete restrict,

  camera          boolean,
  microphone      boolean,
  screen_share    boolean,
  fullscreen      boolean,

  -- Round-trip milliseconds and downlink estimate at the moment of the check.
  latency_ms      integer,
  downlink_mbps   numeric(6,2),

  user_agent      text,
  platform        text,
  screen_count    integer,

  passed          boolean not null,
  detail          jsonb not null default '{}'::jsonb,
  checked_at      timestamptz not null default now()
);

create index if not exists exam_device_session_idx on exam_device_checks (session_id, checked_at);


-- ===========================================================================
-- PART 3 — EVIDENCE. APPEND-ONLY, ALL OF IT.
-- ===========================================================================

-- 3 (a) ---------------------------------------------------------------------
-- EVERY EVENT, FROM EVERY SOURCE.
--
-- NOTE WHAT THIS TABLE CANNOT SAY. There is no `is_cheating`, no `verdict`, no
-- `misconduct`. An automated detector can record that a second face appeared at
-- 10:42; it cannot record that the candidate cheated, because there is nowhere
-- to put that. See the header.
--
-- `source` distinguishes the three kinds of witness, and the distinction is
-- what an appeal turns on: 'system' saw a signal, 'proctor' saw a person, and
-- 'student' reported something themselves.

create table if not exists exam_events (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references exam_sessions (id) on delete restrict,

  kind            text not null check (kind in (
                    -- Lifecycle
                    'session_created', 'checks_started', 'checks_passed', 'checks_failed',
                    'exam_started', 'exam_paused', 'exam_resumed', 'exam_submitted',
                    'exam_terminated', 'time_extended',
                    -- Layer 2: the room
                    'camera_started', 'camera_stopped', 'camera_blocked',
                    'microphone_muted', 'microphone_unmuted',
                    'screen_share_started', 'screen_share_stopped',
                    -- Layer 3: the examination environment
                    'fullscreen_entered', 'fullscreen_exited',
                    'window_blurred', 'window_focused',
                    'paste_detected', 'navigation_attempt',
                    -- Layer 5: automated detection. ALERTS, NOT FINDINGS.
                    'second_face_detected', 'no_face_detected', 'face_returned',
                    'voice_detected',
                    'connection_lost', 'connection_restored',
                    -- The work
                    'answer_saved', 'question_viewed',
                    -- People
                    'proctor_joined', 'proctor_left', 'proctor_message', 'student_message'
                  )),

  source          text not null check (source in ('system', 'proctor', 'student')),

  -- Advisory only. An examiner sorts by it; nothing acts on it automatically,
  -- and nothing is failed because of it.
  severity        text not null default 'info' check (severity in ('info', 'notice', 'alert')),

  -- Who, when the source is a person. Null for system events.
  actor_id        uuid references auth.users (id) on delete set null,

  detail          jsonb not null default '{}'::jsonb,

  -- SERVER TIME, NOT CLIENT TIME. A clock the candidate controls is not a
  -- timestamp. Where the client's own time matters — for ordering events during
  -- a disconnection — it goes in `detail`, clearly labelled as reported.
  occurred_at     timestamptz not null default now()
);

create index if not exists exam_events_session_idx on exam_events (session_id, occurred_at);
create index if not exists exam_events_alert_idx on exam_events (session_id, occurred_at)
  where severity = 'alert';


-- 3 (b) ---------------------------------------------------------------------
-- ANSWERS, WITH THEIR HISTORY.
--
-- EVERY AUTOSAVE IS A ROW. Not an UPDATE to a current answer.
--
-- WHY THIS IS WORTH THE STORAGE. "The system crashed and lost my essay" is the
-- single most common examination dispute, and it is unanswerable if the table
-- holds only the final state. With a row per save, the University can say what
-- the candidate had written at 10:42 and that nothing was received after 10:47
-- — which either supports the candidate or settles the matter.
--
-- It is also the only honest way to hold "answers are automatically saved" as a
-- promise. A promise whose failure leaves no trace is not a promise.

create table if not exists exam_answers (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references exam_sessions (id) on delete restrict,

  question_id     uuid,
  question_number integer,

  -- The answer as given. Text for an essay, an option key for a choice, a
  -- storage path for an uploaded artefact — all as jsonb so a practical
  -- examination and a multiple-choice paper share this table honestly.
  answer          jsonb not null default '{}'::jsonb,

  -- Which save this is, per question. 1, 2, 3… The last one is what was
  -- submitted; the earlier ones are what the candidate was doing.
  revision        integer not null default 1,
  is_final        boolean not null default false,

  saved_at        timestamptz not null default now(),

  unique (session_id, question_id, revision)
);

create index if not exists exam_answers_session_idx on exam_answers (session_id, question_number, revision desc);
create index if not exists exam_answers_final_idx on exam_answers (session_id) where is_final;


-- 3 (c) ---------------------------------------------------------------------
-- RECORDINGS.
--
-- POINTERS ONLY. A camera session is gigabytes of video; it belongs in object
-- storage with its own lifecycle, and the database holds where it is, how long
-- it runs and when it may be destroyed.
--
-- `retention_until` IS NOT OPTIONAL THINKING. A university that records its
-- students' homes has taken on a data-protection obligation, and "we keep it
-- for ever because deleting is hard" is not a lawful answer anywhere this
-- institution teaches. The column exists so the University must choose a period
-- and so a deletion job has something to read.

create table if not exists exam_recordings (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references exam_sessions (id) on delete restrict,

  kind            text not null check (kind in ('camera', 'screen', 'audio', 'room')),

  storage_path    text,
  external_ref    text,

  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  duration_seconds integer,
  size_bytes      bigint,

  -- Set from the University's retention policy at the moment of recording, so a
  -- later change of policy cannot retroactively extend how long a past
  -- candidate's home video is kept.
  retention_until date,
  destroyed_at    timestamptz,
  destroyed_note  text
);

create index if not exists exam_recordings_session_idx on exam_recordings (session_id);
create index if not exists exam_recordings_retention_idx on exam_recordings (retention_until)
  where destroyed_at is null;


-- 3 (d) ---------------------------------------------------------------------
-- THE APPEND-ONLY RULE, ENFORCED.
--
-- One function, four tables. UPDATE and DELETE are refused for every caller —
-- the examiner, the Examination Officer, the Superadministrator, and anything
-- holding the service-role key.
--
-- THE EXCEPTIONS, AND WHY EACH IS SAFE:
--
--   exam_answers may be marked final. `is_final` is a flag set once at
--   submission; nothing about the answer itself may change, and the trigger
--   checks that.
--
--   exam_recordings may be closed and destroyed. A recording that has ended
--   needs `ended_at`; a recording past its retention date needs `destroyed_at`.
--   Neither rewrites what was recorded — one says when it stopped, the other
--   says the University no longer holds it, which is itself a fact worth
--   keeping.

create or replace function exam_evidence_is_append_only() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception
      'Examination evidence is append-only. % on % is refused: a system in which the right '
      'account can revise what a camera recorded cannot support an appeal.', tg_op, tg_table_name;
  end if;

  -- The two narrow, explicitly-reasoned exceptions. Everything else is refused.
  if tg_table_name = 'exam_answers' then
    if new.session_id is distinct from old.session_id
       or new.question_id is distinct from old.question_id
       or new.answer is distinct from old.answer
       or new.revision is distinct from old.revision
       or new.saved_at is distinct from old.saved_at
    then
      raise exception
        'A saved answer cannot be altered. Save a new revision instead — that is what the '
        'revision column is for, and the history is the point.';
    end if;
    return new;
  end if;

  if tg_table_name = 'exam_recordings' then
    if new.session_id is distinct from old.session_id
       or new.kind is distinct from old.kind
       or new.storage_path is distinct from old.storage_path
       or new.started_at is distinct from old.started_at
    then
      raise exception
        'A recording cannot be re-pointed or re-dated. Closing it and recording its destruction '
        'are the only permitted changes.';
    end if;
    return new;
  end if;

  raise exception
    'Examination evidence is append-only. % on % is refused.', tg_op, tg_table_name;
end $$;

drop trigger if exists exam_events_append_only on exam_events;
create trigger exam_events_append_only
  before update or delete on exam_events
  for each row execute function exam_evidence_is_append_only();

drop trigger if exists exam_identity_append_only on exam_identity_checks;
create trigger exam_identity_append_only
  before update or delete on exam_identity_checks
  for each row execute function exam_evidence_is_append_only();

drop trigger if exists exam_device_append_only on exam_device_checks;
create trigger exam_device_append_only
  before update or delete on exam_device_checks
  for each row execute function exam_evidence_is_append_only();

drop trigger if exists exam_answers_append_only on exam_answers;
create trigger exam_answers_append_only
  before update or delete on exam_answers
  for each row execute function exam_evidence_is_append_only();

drop trigger if exists exam_recordings_append_only on exam_recordings;
create trigger exam_recordings_append_only
  before update or delete on exam_recordings
  for each row execute function exam_evidence_is_append_only();


-- ===========================================================================
-- PART 4 — DECISIONS. ATTRIBUTABLE, REVISABLE, AND FULLY AUDITED.
-- ===========================================================================

-- 4 (a) ---------------------------------------------------------------------
-- WHAT A PERSON DECIDED ABOUT A SITTING.
--
-- Pausing, resuming, extending time, terminating, voiding. Each is a decision
-- about a candidate's examination and each needs an owner and a reason.
--
-- SEPARATE FROM exam_events even though every one of these also writes an
-- event. The event is the fact that the examination was paused at 10:42; this
-- is the record that Dr Mbeki paused it because the candidate reported a power
-- cut. The first is evidence and cannot change; the second is a judgement and
-- may be revisited.

create table if not exists exam_session_decisions (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references exam_sessions (id) on delete restrict,

  action          text not null check (action in (
                    'started', 'paused', 'resumed', 'time_extended',
                    'terminated', 'voided', 'reinstated', 'identity_overridden'
                  )),

  reason          text not null,
  minutes         integer,

  decided_by      uuid not null references auth.users (id) on delete restrict,
  decided_role    text,
  decided_at      timestamptz not null default now(),

  constraint exam_session_decision_reason check (length(btrim(reason)) > 0)
);

create index if not exists exam_session_decisions_idx on exam_session_decisions (session_id, decided_at);


-- 4 (b) ---------------------------------------------------------------------
-- INCIDENTS AND FINDINGS — AND THE DIFFERENCE BETWEEN THEM.
--
-- AN INCIDENT IS AN OBSERVATION. "The candidate looked off-screen repeatedly
-- between 10:40 and 10:45." An invigilator may record one; it is the narrowest
-- role in the system and this is the only thing it can write.
--
-- A FINDING IS A DETERMINATION. "This constituted academic misconduct." Only a
-- moderator or the Superadministrator may make one, and 4(c) refuses to let the
-- person who raised the incident be the person who determines it.
--
-- THE UNIVERSITY'S OWN INSTRUCTION MADE THIS NECESSARY: automated events are
-- alerts, "a human examiner should make the academic-integrity decision". An
-- incident raised by a proctor is one step above an automated alert and one
-- step below a finding, and collapsing the three would mean a camera glitch
-- could end a degree.

create table if not exists exam_incidents (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references exam_sessions (id) on delete restrict,

  -- The events this observation concerns, if any. An incident may also stand
  -- alone — a proctor saw something the detectors did not.
  event_ids       uuid[] not null default '{}'::uuid[],

  category        text not null check (category in (
                    'identity', 'environment', 'communication', 'materials',
                    'technical', 'conduct', 'other'
                  )),

  description     text not null,
  severity        text not null default 'notice' check (severity in ('notice', 'serious')),

  raised_by       uuid not null references auth.users (id) on delete restrict,
  raised_role     text,
  raised_at       timestamptz not null default now(),

  -- Withdrawn rather than deleted. An invigilator who realises the second face
  -- was a reflection should be able to say so, and the record should show both
  -- the original observation and the correction.
  withdrawn_at    timestamptz,
  withdrawn_by    uuid references auth.users (id) on delete set null,
  withdrawal_note text,

  constraint exam_incident_description check (length(btrim(description)) > 0),
  constraint exam_incident_withdrawal check (
    withdrawn_at is null or length(btrim(coalesce(withdrawal_note, ''))) > 0
  )
);

create index if not exists exam_incidents_session_idx on exam_incidents (session_id, raised_at);


create table if not exists exam_findings (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references exam_sessions (id) on delete restrict,
  incident_id     uuid references exam_incidents (id) on delete restrict,

  outcome         text not null check (outcome in (
                    'no_misconduct', 'informal_warning', 'misconduct', 'referred'
                  )),

  -- REQUIRED, AND THE MOST IMPORTANT TEXT IN THIS SUBSYSTEM. A misconduct
  -- finding follows a person for the rest of their professional life. The
  -- reasoning is what an appeal reads.
  reasoning       text not null,

  -- What it did to the mark, if anything. Null means the finding stands on the
  -- record without affecting the result.
  mark_adjustment integer,

  -- NOT NULL. There is no such thing as a finding nobody made — see the header.
  decided_by      uuid not null references auth.users (id) on delete restrict,
  decided_role    text,
  decided_at      timestamptz not null default now(),

  -- An appeal may overturn it. The finding stays; the overturning is recorded
  -- against it, so the record shows both what was decided and that it was
  -- wrong.
  overturned_at   timestamptz,
  overturned_by   uuid references auth.users (id) on delete set null,
  overturn_reason text,

  constraint exam_finding_reasoning check (length(btrim(reasoning)) > 0),
  constraint exam_finding_overturn check (
    overturned_at is null or length(btrim(coalesce(overturn_reason, ''))) > 0
  )
);

create index if not exists exam_findings_session_idx on exam_findings (session_id);


-- 4 (c) ---------------------------------------------------------------------
-- NOBODY DETERMINES THEIR OWN OBSERVATION.
--
-- The invigilator who raised the incident cannot be the person who decides it
-- was misconduct. That is the same separation the University required of
-- certificate designs, of grades and of social posts, and it matters most here:
-- a proctor who has spent forty minutes suspecting a candidate is the worst
-- possible judge of whether the suspicion was justified.

create or replace function guard_exam_finding() returns trigger
language plpgsql as $$
declare
  raiser uuid;
begin
  if new.incident_id is null then return new; end if;

  select raised_by into raiser from exam_incidents where id = new.incident_id;

  if raiser is not null and raiser = new.decided_by then
    raise exception
      'The person who raised this incident cannot be the person who determines it. An '
      'academic-integrity finding needs a second reader — someone who watched a candidate for '
      'forty minutes suspecting them is the worst judge of whether the suspicion was justified.';
  end if;

  return new;
end $$;

drop trigger if exists exam_findings_second_reader on exam_findings;
create trigger exam_findings_second_reader
  before insert on exam_findings
  for each row execute function guard_exam_finding();


-- 4 (d) ---------------------------------------------------------------------
-- MARKS AND MODERATION.
--
-- The University already has a grade approval chain — 009 built it, with four
-- offices and a state machine — and this does NOT replace it. An examination
-- mark flows into `results` and travels the existing chain to publication. What
-- lives here is the examination-specific part: who marked this script, what the
-- moderator made of it, and how the two differ.
--
-- INTEGRATION RATHER THAN A SECOND SYSTEM. The University's point 7 asked for
-- exactly this, and a parallel marks table that did not reach the transcript
-- would be the most expensive kind of wrong: everything would appear to work.

create table if not exists exam_marks (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references exam_sessions (id) on delete restrict,

  -- Per question where the paper is marked question by question; null for a
  -- single overall mark, as in a viva.
  question_id     uuid,
  question_number integer,

  mark            numeric(6,2) not null,
  out_of          numeric(6,2) not null,
  comment         text,

  marked_by       uuid not null references auth.users (id) on delete restrict,
  marked_at       timestamptz not null default now(),

  -- Set when a moderator has looked at this script.
  moderated_by    uuid references auth.users (id) on delete set null,
  moderated_at    timestamptz,
  moderated_mark  numeric(6,2),
  moderation_note text,

  -- Where the examination mark ends up in the University's existing chain.
  result_id       uuid references results (id) on delete set null,

  constraint exam_marks_range check (mark >= 0 and mark <= out_of),
  constraint exam_marks_moderated_range check (
    moderated_mark is null or (moderated_mark >= 0 and moderated_mark <= out_of)
  ),
  -- A moderator who changes a mark says why. One who agrees need not.
  constraint exam_marks_moderation_note check (
    moderated_mark is null or moderated_mark = mark
    or length(btrim(coalesce(moderation_note, ''))) > 0
  ),
  unique (session_id, question_id)
);

create index if not exists exam_marks_session_idx on exam_marks (session_id);


-- A MODERATOR MAY NOT MODERATE THEIR OWN MARKING.
create or replace function guard_exam_moderation() returns trigger
language plpgsql as $$
begin
  if new.moderated_by is not null and new.moderated_by = new.marked_by then
    raise exception
      'A mark cannot be moderated by the person who awarded it. Moderation is a second opinion, '
      'and there is no second opinion in one head.';
  end if;
  return new;
end $$;

drop trigger if exists exam_marks_second_marker on exam_marks;
create trigger exam_marks_second_marker
  before insert or update on exam_marks
  for each row execute function guard_exam_moderation();


-- 4 (e) ---------------------------------------------------------------------
-- THE EXAMINER'S REPORT.
--
-- One per examiner per session, written after the sitting. This is the document
-- an appeal panel reads first, and it is a decision rather than evidence: it is
-- the examiner's account, and it may be revised before it is submitted.

create table if not exists exam_reports (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references exam_sessions (id) on delete restrict,

  narrative       text not null,
  recommendation  text check (recommendation in (
                    'accept', 'accept_with_note', 'refer_for_misconduct', 'void_and_resit'
                  )),

  author_id       uuid not null references auth.users (id) on delete restrict,
  author_role     text,

  submitted_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (session_id, author_id)
);

-- ONCE SUBMITTED, IT IS FIXED. Before that it is a draft the author may edit.
-- A report that can be rewritten after the outcome is known is not a report.
create or replace function guard_exam_report() returns trigger
language plpgsql as $$
begin
  if old.submitted_at is not null then
    if new.narrative is distinct from old.narrative
       or new.recommendation is distinct from old.recommendation
       or new.submitted_at is distinct from old.submitted_at
    then
      raise exception
        'A submitted examiner report cannot be edited. If it was wrong, record an addendum — '
        'a report rewritten after the outcome is known is not a report.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists exam_reports_immutable on exam_reports;
create trigger exam_reports_immutable
  before update on exam_reports
  for each row execute function guard_exam_report();


-- ===========================================================================
-- PART 5 — WHO → WHAT → WHEN → BEFORE → AFTER → REASON
-- ===========================================================================
--
-- The University's own six-part record, as a table. Every sensitive action in
-- this subsystem writes one, and — like the credential audit trail in 013 — it
-- is append-only against every caller including the Superadministrator.
--
-- BEFORE AND AFTER ARE THE PART MOST SYSTEMS OMIT. "The mark was changed" is
-- not an audit record; "the mark was changed from 58 to 62 by Dr Achebe on 4
-- March because the second script page had not been uploaded when it was first
-- marked" is. Without the before-state, an audit trail can only tell you that
-- something happened, which is the one thing everybody already knows.

create table if not exists exam_audit_events (
  id              uuid primary key default gen_random_uuid(),

  session_id      uuid references exam_sessions (id) on delete set null,
  examination_id  uuid references examinations (id) on delete set null,
  -- Kept as text so the row survives the session being removed and can still
  -- say which sitting it concerned.
  subject_ref     text,

  action          text not null,

  -- The six parts.
  actor_id        uuid references auth.users (id) on delete set null,
  actor_role      text,
  actor_email     text,
  before_state    jsonb,
  after_state     jsonb,
  reason          text,

  ip              inet,
  user_agent      text,
  occurred_at     timestamptz not null default now()
);

create index if not exists exam_audit_session_idx on exam_audit_events (session_id, occurred_at desc);
create index if not exists exam_audit_actor_idx on exam_audit_events (actor_id, occurred_at desc);

create or replace function exam_audit_is_append_only() returns trigger
language plpgsql as $$
begin
  raise exception
    'exam_audit_events is append-only. % is refused: an audit trail the most powerful account '
    'can edit is not an audit trail of that account.', tg_op;
end $$;

drop trigger if exists exam_audit_no_update on exam_audit_events;
create trigger exam_audit_no_update
  before update or delete on exam_audit_events
  for each row execute function exam_audit_is_append_only();


-- ===========================================================================
-- PART 6 — ROW-LEVEL SECURITY
-- ===========================================================================
--
-- Everything off by default. Writes are made by guarded API routes running as
-- the service role, in the pattern 009 established.
--
-- The exceptions below are the ones that are genuinely row predicates: a
-- candidate reading their own sitting and their own answers. Those belong in
-- the database rather than in a route, because a rule enforced here cannot be
-- forgotten by the next route somebody writes — and "a student can read another
-- student's examination answers" is not a bug anyone wants to explain.

alter table examinations            enable row level security;
alter table examination_officers    enable row level security;
alter table exam_sessions           enable row level security;
alter table exam_identity_checks    enable row level security;
alter table exam_device_checks      enable row level security;
alter table exam_events             enable row level security;
alter table exam_answers            enable row level security;
alter table exam_recordings         enable row level security;
alter table exam_session_decisions  enable row level security;
alter table exam_incidents          enable row level security;
alter table exam_findings           enable row level security;
alter table exam_marks              enable row level security;
alter table exam_reports            enable row level security;
alter table exam_audit_events       enable row level security;

-- A published examination is public knowledge to the cohort: what it is, when
-- it opens, how long it runs. The QUESTIONS are not here — they live in
-- module_records and are released by the route at the moment the sitting
-- starts, which is the control that matters.
drop policy if exists examinations_published_read on examinations;
create policy examinations_published_read on examinations
  for select using (status in ('published', 'in_progress', 'closed'));

-- A candidate may read their own sitting and their own answers, and nobody
-- else's.
drop policy if exists exam_sessions_own_read on exam_sessions;
create policy exam_sessions_own_read on exam_sessions
  for select using (
    student_id in (select id from students where auth_user_id = auth.uid())
  );

drop policy if exists exam_answers_own_read on exam_answers;
create policy exam_answers_own_read on exam_answers
  for select using (
    session_id in (
      select s.id from exam_sessions s
      join students st on st.id = s.student_id
      where st.auth_user_id = auth.uid()
    )
  );


-- ===========================================================================
-- PART 7 — PROOF THAT IT LANDED, AND THAT IT DOES WHAT IT CLAIMS
-- ===========================================================================
--
-- Existence checks are not enough — 013 shipped with a proof block that passed
-- while the operation the subsystem existed for was impossible. So this block
-- performs the rules: it tries to rewrite evidence, tries to have a proctor
-- judge their own incident, and tries to have an examiner moderate their own
-- mark. All three must be refused.

do $$
declare
  n integer;
  refused boolean;
  ex uuid;
  sess uuid;
  ev uuid;
  inc uuid;
  proctor uuid := '00000000-0000-0000-0000-0000000000e1';
  marker  uuid := '00000000-0000-0000-0000-0000000000e2';
begin
  select count(*) into n from information_schema.tables
   where table_schema = 'public'
     and table_name in ('examinations', 'examination_officers', 'exam_sessions',
                        'exam_identity_checks', 'exam_device_checks', 'exam_events',
                        'exam_answers', 'exam_recordings', 'exam_session_decisions',
                        'exam_incidents', 'exam_findings', 'exam_marks',
                        'exam_reports', 'exam_audit_events');
  if n <> 14 then
    raise exception 'Expected 14 examination tables, found %', n;
  end if;

  -- THE AUTOMATED LAYER MUST NOT BE ABLE TO EXPRESS A VERDICT.
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'exam_events'
       and column_name in ('is_cheating', 'verdict', 'misconduct', 'outcome')
  ) then
    raise exception
      'exam_events has gained a column in which a finding could be recorded. An automated event '
      'is an alert, never proof — the academic-integrity decision belongs to a person.';
  end if;

  insert into auth.users (id, email) values
    (proctor, 'selftest-proctor-015@iguc.net'),
    (marker,  'selftest-marker-015@iguc.net')
  on conflict (id) do nothing;

  -- IDEMPOTENT. The first draft inserted a fresh examination and session on
  -- every run, and since evidence cannot be deleted, re-running the migration
  -- would have left a trail of self-test sittings in the University's own
  -- examination record. A prior self-test is reused instead.
  select id into ex from examinations
   where title = 'Installation self-test - migration 015' limit 1;

  if ex is null then
    insert into examinations (title, mode, status)
    values ('Installation self-test - migration 015', 'standard', 'cancelled')
    returning id into ex;
  end if;

  select id into sess from exam_sessions where examination_id = ex limit 1;

  if sess is null then
    insert into exam_sessions (examination_id, candidate_name, status)
    values (ex, 'Installation self-test', 'in_progress')
    returning id into sess;
  end if;

  -- The session must be live for the rules below to be exercised; it is set
  -- back to void at the end.
  update exam_sessions set status = 'in_progress' where id = sess;

  -- 1. EVIDENCE CANNOT BE REWRITTEN.
  insert into exam_events (session_id, kind, source, severity)
  values (sess, 'second_face_detected', 'system', 'alert')
  returning id into ev;

  refused := false;
  begin
    update exam_events set severity = 'info' where id = ev;
  exception when others then
    if sqlerrm like '%append-only%' then refused := true; else raise; end if;
  end;
  if not refused then
    raise exception 'An examination event was altered. Evidence is not append-only.';
  end if;

  refused := false;
  begin
    delete from exam_events where id = ev;
  exception when others then
    if sqlerrm like '%append-only%' then refused := true; else raise; end if;
  end;
  if not refused then
    raise exception 'An examination event was deleted. Evidence is not append-only.';
  end if;

  -- 2. AN ANSWER CANNOT BE EDITED, BUT MAY BE MARKED FINAL.
  insert into exam_answers (session_id, question_number, answer, revision)
  values (sess, 1, '{"text":"first"}'::jsonb, 1)
  on conflict (session_id, question_id, revision) do nothing;

  refused := false;
  begin
    update exam_answers set answer = '{"text":"tampered"}'::jsonb where session_id = sess;
  exception when others then
    if sqlerrm like '%cannot be altered%' then refused := true; else raise; end if;
  end;
  if not refused then
    raise exception 'A saved answer was rewritten. The revision history is not trustworthy.';
  end if;

  update exam_answers set is_final = true where session_id = sess;

  -- 3. THE PERSON WHO RAISED AN INCIDENT CANNOT DETERMINE IT.
  select id into inc from exam_incidents where session_id = sess limit 1;
  if inc is null then
    insert into exam_incidents (session_id, category, description, raised_by)
    values (sess, 'environment', 'Self-test observation.', proctor)
    returning id into inc;
  end if;

  refused := false;
  begin
    insert into exam_findings (session_id, incident_id, outcome, reasoning, decided_by)
    values (sess, inc, 'misconduct', 'Self-test.', proctor);
  exception when others then
    if sqlerrm like '%second reader%' then refused := true; else raise; end if;
  end;
  if not refused then
    raise exception 'A proctor determined their own incident. There is no second reader.';
  end if;

  -- …and a different person may.
  if not exists (select 1 from exam_findings where session_id = sess) then
    insert into exam_findings (session_id, incident_id, outcome, reasoning, decided_by)
    values (sess, inc, 'no_misconduct', 'Self-test: a second reader may decide.', marker);
  end if;

  -- 4. AN EXAMINER CANNOT MODERATE THEIR OWN MARK.
  insert into exam_marks (session_id, question_number, mark, out_of, marked_by)
  values (sess, 1, 55, 100, marker)
  on conflict (session_id, question_id) do nothing;

  refused := false;
  begin
    update exam_marks set moderated_by = marker, moderated_mark = 70,
                          moderation_note = 'Self-test.'
     where session_id = sess;
  exception when others then
    if sqlerrm like '%second opinion%' then refused := true; else raise; end if;
  end;
  if not refused then
    raise exception 'An examiner moderated their own mark.';
  end if;

  -- 5. THE AUDIT TRAIL IS APPEND-ONLY.
  -- APPEND-ONLY MEANS EVERY RUN LEAVES A ROW, and that is correct: each run
  -- genuinely did prove the rules on that date.
  insert into exam_audit_events (session_id, action, reason)
  values (sess, 'installation.self_test',
          'Migration 015 proved the examination rules at install.');

  refused := false;
  begin
    update exam_audit_events set reason = 'tampered' where session_id = sess;
  exception when others then
    if sqlerrm like '%append-only%' then refused := true; else raise; end if;
  end;
  if not refused then
    raise exception 'The examination audit trail accepted an UPDATE.';
  end if;

  -- Clean up what CAN be cleaned. The evidence rows cannot be deleted — that is
  -- the point — so the self-test session is marked void and stays, labelled.
  update exam_sessions
     set status = 'void'
   where id = sess;
  update examinations set status = 'cancelled' where id = ex;

  raise notice 'Examination & Proctoring installed: 14 tables.';
  raise notice 'Proven at install: evidence cannot be rewritten or deleted; a saved answer cannot be edited;';
  raise notice 'a proctor cannot determine their own incident; an examiner cannot moderate their own mark.';
  raise notice 'The self-test session is marked void and remains - its evidence rows cannot be deleted, by design.';
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   016_examination_papers.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — RECORDING THE PAPER EACH CANDIDATE WAS GIVEN
--
-- Run after 015_examination_and_proctoring.sql. Idempotent; destroys nothing.
--
-- ===========================================================================
-- WHY THE SEED IS NOT ENOUGH
-- ===========================================================================
--
-- 015 gave every sitting an id, and src/lib/examPaper.ts derives the question
-- and option order from it. That makes a paper reproducible while the sitting
-- is live: a candidate who refreshes gets the same arrangement, because the
-- same seed over the same bank produces the same result.
--
-- It stops being true the moment the bank changes. A question withdrawn after
-- the sitting — because it was ambiguous, which is exactly the case an appeal
-- is about — leaves the same seed producing a DIFFERENT paper. The University
-- would then be unable to show what it actually asked, in the one situation
-- where being able to show it matters.
--
-- So the resolved paper is recorded on the session: the questions, in the order
-- delivered, with the options in the order delivered.
--
-- ===========================================================================
-- IT IS EVIDENCE, SO IT IS WRITTEN ONCE
-- ===========================================================================
--
-- `paper` may go from null to a value exactly once. After that it cannot be
-- changed or cleared, by anyone — the same rule 015 applies to events, answers
-- and recordings, for the same reason. A paper that can be rewritten after the
-- sitting is not a record of what was asked; it is a record of what somebody
-- would prefer to have asked.
--
-- The column lives on exam_sessions rather than in a table of its own because
-- it is one document per sitting with no independent life. The set-once trigger
-- is what gives it the immutability the evidence tables get from being
-- append-only.
--
-- ===========================================================================
-- THE ANSWER KEY IS IN HERE, AND THAT IS FINE
-- ===========================================================================
--
-- The recorded paper carries `correct` for each objective question — which
-- option was right, at the position THIS candidate saw it. Marking needs it,
-- and an appeal needs it more.
--
-- It is safe because exam_sessions has one RLS policy, added in 015, letting a
-- candidate read their OWN session — and that would expose the key of their own
-- paper. So this migration narrows that policy: a candidate may read their
-- sitting, and the `paper` column is served to them only through
-- /api/exam/questions, which strips the key with forCandidate(). A view does
-- the narrowing rather than trusting every future route to remember.
-- ===========================================================================


-- 1 -------------------------------------------------------------------------

alter table exam_sessions add column if not exists paper jsonb;
alter table exam_sessions add column if not exists paper_built_at timestamptz;

create or replace function guard_exam_paper_once() returns trigger
language plpgsql as $$
begin
  if old.paper is not null and new.paper is distinct from old.paper then
    raise exception
      'The paper a candidate was given cannot be changed. It is the record of what the '
      'University actually asked, and an appeal about an ambiguous question is exactly the '
      'situation in which it must not have been rewritten.';
  end if;

  if new.paper is not null and old.paper is null then
    new.paper_built_at := coalesce(new.paper_built_at, now());
  end if;

  return new;
end $$;

drop trigger if exists exam_sessions_paper_once on exam_sessions;
create trigger exam_sessions_paper_once
  before update on exam_sessions
  for each row execute function guard_exam_paper_once();


-- 2 -------------------------------------------------------------------------
-- WHAT A CANDIDATE MAY READ OF THEIR OWN SITTING.
--
-- Everything except the paper. 015's policy let them select the whole row,
-- which after section 1 would include the answer key — readable with the
-- publishable key and a single query, by the one person who must not have it.
--
-- A VIEW RATHER THAN A NARROWER POLICY, because PostgREST column-level grants
-- are easy to widen by accident and a view is explicit about what it exposes.
-- The old row policy is dropped so there is one way in, not two.

create or replace view exam_sessions_mine as
  select
    s.id, s.examination_id, s.student_id, s.student_number, s.candidate_name,
    s.status, s.started_at, s.submitted_at, s.paused_ms, s.paused_at,
    s.extra_minutes, s.created_at,
    -- Whether a paper has been built, but never the paper itself.
    (s.paper is not null) as paper_ready
  from exam_sessions s
  join students st on st.id = s.student_id
  where st.auth_user_id = auth.uid();

drop policy if exists exam_sessions_own_read on exam_sessions;


-- 3 -------------------------------------------------------------------------
-- Proof.

do $$
declare
  ex uuid;
  sess uuid;
  refused boolean := false;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'exam_sessions' and column_name = 'paper'
  ) then
    raise exception 'exam_sessions has no paper column.';
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'exam_sessions_paper_once') then
    raise exception 'The set-once guard on the recorded paper is missing.';
  end if;

  -- PERFORM THE RULE. Reuse 015's self-test sitting rather than making another.
  select id into ex from examinations
   where title = 'Installation self-test - migration 015' limit 1;

  if ex is not null then
    select id into sess from exam_sessions where examination_id = ex limit 1;
  end if;

  if sess is not null then
    update exam_sessions set paper = '{"seed":"selftest","questions":[]}'::jsonb
     where id = sess and paper is null;

    begin
      update exam_sessions set paper = '{"seed":"rewritten","questions":[]}'::jsonb
       where id = sess;
    exception when others then
      if sqlerrm like '%cannot be changed%' then refused := true; else raise; end if;
    end;

    if not refused then
      raise exception 'A recorded examination paper was rewritten. It is not set-once.';
    end if;
  end if;

  raise notice 'Recorded papers installed. A paper is written once and cannot be rewritten;';
  raise notice 'candidates read their sitting through exam_sessions_mine, which omits the answer key.';
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   017_secret_store.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — THE SECRET STORE
--
-- Run after 016_examination_papers.sql. Idempotent; destroys nothing.
--
-- ===========================================================================
-- WHY THIS TABLE IS DIFFERENT FROM EVERY OTHER TABLE IN THIS SCHEMA
-- ===========================================================================
--
-- Migration 013 named a column `token_ref` rather than `token`, and said why:
-- an OAuth refresh token is a standing permission to speak as the University,
-- and putting one in an application table makes every future SELECT bug, every
-- over-broad policy and every database export a credential leak.
--
-- That promise cost nothing while nothing could connect. The OAuth flow now
-- exists, so the tokens are real and have to live somewhere. This is where.
--
-- IT HOLDS CIPHERTEXT AND NOTHING ELSE. AES-256-GCM, sealed by
-- src/lib/secretStore.ts with a key that lives in the deployment's environment
-- and never in the database. A database dump is ciphertext; a leaked dump is
-- not a leaked token.
--
-- ===========================================================================
-- RLS ON, AND NO POLICY. THAT IS THE POINT.
-- ===========================================================================
--
-- Every other table in this schema has at least one policy. This one has none,
-- deliberately: with row-level security enabled and no policy granting
-- anything, the table is unreadable and unwritable through the publishable key
-- BY CONSTRUCTION. Only the service role reaches it, and only from the server.
--
-- That is a stronger guarantee than a restrictive policy, because a policy can
-- be widened by a later migration written in a hurry, and the widening looks
-- like ordinary work. Adding a policy to THIS table should look alarming, and
-- section 3 asserts that none exists so that adding one breaks the check.
-- ===========================================================================


-- 1 -------------------------------------------------------------------------

create table if not exists secret_store (
  -- The reference the application holds. For a social account it is the
  -- account's own id: knowing WHICH row holds a token is not knowing the token,
  -- so this needs no secrecy of its own.
  ref         text primary key,

  kind        text not null check (kind in ('social_tokens', 'proctoring', 'other')),

  -- iv.tag.payload, base64url. Never plaintext, and there is no column in which
  -- plaintext could be put.
  sealed      text not null,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- A sealed value that does not look sealed is a value somebody has written by
  -- hand — most likely a raw token, which is the exact thing this table exists
  -- to prevent. Three base64url segments, and long enough to carry a GCM iv and
  -- tag before any payload at all.
  constraint secret_store_is_sealed check (
    sealed ~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
    and length(sealed) > 40
  )
);

alter table secret_store enable row level security;

-- NO POLICY. See the header. This is not an omission.


-- 2 -------------------------------------------------------------------------
-- The reference on a social account now points here.
--
-- A FOREIGN KEY WOULD BE WRONG. It would make the token's existence a
-- structural requirement of the account row, so revoking a connection —
-- which SHOULD destroy the token while keeping the account's history — would
-- either fail or cascade the history away. The link is deliberately loose.

comment on column social_accounts.token_ref is
  'Reference into secret_store.ref. Never a token. See src/lib/secretStore.ts.';


-- 3 -------------------------------------------------------------------------
-- Proof.

do $$
declare
  n integer;
begin
  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'secret_store'
  ) then
    raise exception 'secret_store is missing.';
  end if;

  if not exists (
    select 1 from pg_tables
     where schemaname = 'public' and tablename = 'secret_store' and rowsecurity
  ) then
    raise exception 'Row-level security is not enabled on secret_store. Every token in it is readable with the publishable key.';
  end if;

  -- THE CHECK THAT SHOULD BREAK IF SOMEBODY ADDS A POLICY.
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'secret_store';

  if n > 0 then
    raise exception
      'secret_store has % polic(ies). It is meant to have NONE — that is what makes it '
      'unreadable through the publishable key by construction rather than by a rule somebody '
      'can widen. If a policy is genuinely needed, this check is the conversation.', n;
  end if;

  -- The seal format is enforced, so a raw token cannot be written by hand.
  begin
    insert into secret_store (ref, kind, sealed) values ('selftest-017', 'other', 'a-raw-token');
    raise exception 'secret_store accepted an unsealed value.';
  exception when check_violation then
    null;
  end;

  raise notice 'Secret store installed: RLS on, no policy, sealed values only.';
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   018_delete_application.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 018 — DELETING AN APPLICATION, AND WHO MAY
--
-- The University's instruction: only the Superadministrator may delete an
-- application.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS CHANGES, WHICH IS LESS THAN IT SOUNDS
-- ---------------------------------------------------------------------------
--
-- Nobody could delete an application before this migration either. `students`
-- has row-level security enabled and carried policies for SELECT, INSERT and
-- UPDATE and none for DELETE — and under RLS an operation with no policy is
-- refused. So the rule already held, by accident, for everyone including the
-- Superadministrator.
--
-- "Refused because nobody wrote the policy" and "refused because the
-- University decided" look identical from the application and are not the same
-- thing. The first is silently undone by the next person who adds a broad
-- policy to fix something unrelated. This states the decision, so that undoing
-- it takes saying so.
--
-- ---------------------------------------------------------------------------
-- WHY DELETION IS RESTRICTED AT ALL
-- ---------------------------------------------------------------------------
--
-- Rejecting an application is a decision, and it is recorded: who rejected it,
-- when, and on what grounds. Deleting one removes the evidence that the person
-- ever applied — what Finance saw, what the Registrar verified, why the
-- Admissions Office decided as it did.
--
-- An Admissions Officer who could delete could erase a candidate they had
-- mishandled, and the record of the mishandling with them. That is the class of
-- act this hierarchy exists to keep out of an operational role, which is why
-- 'delete-application' sits in SYSTEM_CAPABILITIES beside 'assign-roles' rather
-- than beside 'reject-application'.
--
-- ---------------------------------------------------------------------------
-- AND WHY AN ADMITTED STUDENT IS NOT DELETABLE BY ANYBODY
-- ---------------------------------------------------------------------------
--
-- Once an application is admitted it stops being an application. It has an auth
-- account, a student number, possibly marks, payments and an issued credential.
-- Deleting that row does not tidy a queue; it detaches a person from their own
-- academic record and leaves rows in six tables pointing at nothing.
--
-- So the policy admits the Superadministrator, and a trigger refuses the row
-- regardless of who is asking once it has become a student record. Withdrawal
-- is a status, not a deletion.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. THE POLICY
-- ---------------------------------------------------------------------------

drop policy if exists students_superadmin_delete on students;
create policy students_superadmin_delete on students
  for delete using (auth_role() = 'superadmin');


-- ---------------------------------------------------------------------------
-- 2. THE TRIGGER
--
-- The policy governs the publishable key. The service-role key bypasses RLS
-- entirely — and every write this application makes to `students` from a route
-- goes through the service role. A policy alone would therefore be a rule that
-- holds for the browser and not for the server, which is the wrong way round.
--
-- BEFORE DELETE, so it refuses rather than reports afterwards.
-- ---------------------------------------------------------------------------

create or replace function guard_application_delete() returns trigger
language plpgsql
as $$
begin
  -- An admitted student is not an application. `auth_user_id` is set at the
  -- moment of admission and `student_number` with it; either one means this
  -- row has become somebody's academic identity.
  if old.auth_user_id is not null or old.student_number is not null then
    raise exception
      'This record has been admitted (student %) and is no longer an application. '
      'Deleting it would detach a person from their own academic record. '
      'Withdraw or suspend the student instead.',
      coalesce(old.student_number, old.auth_user_id::text)
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists students_guard_delete on students;
create trigger students_guard_delete
  before delete on students
  for each row execute function guard_application_delete();


-- ---------------------------------------------------------------------------
-- 3. PROOF
--
-- Performs the rules rather than checking that the trigger exists. A test that
-- confirms a trigger is present proves the migration ran; it does not prove the
-- trigger refuses anything.
-- ---------------------------------------------------------------------------

do $$
declare
  applicant_id uuid;
  admitted_id  uuid;
  refused      boolean;
  n            int;
begin
  -- (a) An ordinary application can be deleted by a caller that bypasses RLS.
  insert into students (matric_no, first_name, last_name, email, status)
  values ('DEL-PROOF-018', 'Delete', 'Proof', 'delete-proof-018@example.invalid', 'applicant')
  returning id into applicant_id;

  delete from students where id = applicant_id;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception '018 FAILED: an ordinary application could not be deleted (% rows)', n;
  end if;

  -- (b) An admitted record cannot be deleted BY ANYONE, service role included.
  insert into students (matric_no, first_name, last_name, email, status, student_number)
  values ('ADM-PROOF-018', 'Admitted', 'Proof', 'admitted-proof-018@example.invalid',
          'approved', 'ICOF209900001')
  returning id into admitted_id;

  refused := false;
  begin
    delete from students where id = admitted_id;
  exception when others then
    refused := true;
  end;

  if not refused then
    raise exception
      '018 FAILED: an admitted student was deleted. The trigger did not refuse.';
  end if;

  -- Clean up the proof row the only way the rule permits.
  update students set student_number = null, auth_user_id = null where id = admitted_id;
  delete from students where id = admitted_id;

  raise notice '018 ok: applications are deletable, admitted students are not.';
end $$;

-- (c) The policy exists, names the Superadministrator, and names nobody else.
do $$
declare
  qual text;
begin
  select pg_get_expr(polqual, polrelid) into qual
  from pg_policy
  where polname = 'students_superadmin_delete';

  if qual is null then
    raise exception '018 FAILED: the delete policy was not created.';
  end if;

  if qual not like '%superadmin%' then
    raise exception '018 FAILED: the delete policy does not name superadmin: %', qual;
  end if;

  -- The failure this catches is somebody "fixing" a permissions complaint by
  -- widening the policy. Any other role appearing here is that fix.
  if qual ~ 'registrar|admissions-officer|finance|dean|hod|academic-office'
     or qual ~ '''admin''' then
    raise exception
      '018 FAILED: the delete policy admits a role other than superadmin: %', qual;
  end if;

  raise notice '018 ok: only the Superadministrator holds the delete policy.';
end $$;

select
  'students delete policy' as check,
  polname                  as policy,
  pg_get_expr(polqual, polrelid) as using_expression
from pg_policy
where polname = 'students_superadmin_delete';


-- ===========================================================================
-- ===========================================================================
--
--   019_academic_record.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 019 — THE ACADEMIC RECORD A REAL TRANSCRIPT IS BUILT FROM
--
-- The University set out what its transcript must carry: study mode and
-- campus, award distinguished from programme and specialization, transfer
-- credits with the institution they came from, every attempt at a repeated
-- course, academic standing, honours, and the conferral of the degree.
--
-- Almost none of that could be recorded. `students` had no study mode, no
-- campus, no specialization, no admission or completion date and no standing;
-- `results` had no notion of a second attempt; there was nowhere at all to put
-- a transfer credit, an honour, or a conferral.
--
-- So the transcript could not have printed those things however it was
-- designed. This is the record; the document follows it.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS MIGRATION REFUSES TO DECIDE
-- ---------------------------------------------------------------------------
--
-- Three of the University's requirements are POLICY, not schema, and this file
-- deliberately does not invent them:
--
--   WHAT A REPEATED COURSE DOES TO THE GPA. "The transcript should indicate
--   whether the first grade remains in GPA, is replaced, is excluded, or is
--   retained as an academic attempt" — and the University added "this should
--   be controlled by the university's academic policy". There is no rule here
--   yet, so `academic_policy.repeat_rule` is NULL and every attempt counts and
--   is shown. A default of 'latest-replaces' would quietly raise the GPA of
--   every student who has ever failed anything, under a rule nobody made.
--
--   WHERE ACADEMIC STANDING TURNS. Warning at 2.0, probation at 1.5 — those
--   are real numbers at real universities and they are not this University's
--   until it says so. Both thresholds are NULL and standing is set by a person
--   until they are stated.
--
--   WHAT EARNS AN HONOUR. Dean's List at what average, over what load. The
--   table records the honour and who awarded it; nothing computes one.
--
-- This follows `awards.cgpa_confirmed`, already in the schema for the same
-- reason: the interface shows the difference between a threshold the
-- University stated and one the system supplied, rather than presenting both
-- as equally authoritative.
--
-- ---------------------------------------------------------------------------
-- AND WHY STANDING DEFAULTS TO NULL RATHER THAN 'GOOD STANDING'
-- ---------------------------------------------------------------------------
--
-- Because a transcript reading "Academic Standing: Good Standing" is the
-- University stating that it has looked at the record and found it sound. For
-- a student nobody has assessed that is not a harmless default; it is a
-- favourable assertion made by a column default. NULL prints nothing, and
-- nothing is what the University has said.
--
-- Idempotent. Run it twice; the second run changes nothing.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. THE STUDENT'S PARTICULARS THE TRANSCRIPT PRINTS
-- ---------------------------------------------------------------------------

alter table students
  add column if not exists place_of_birth  text,
  -- The teaching location. A university with more than one must say which one
  -- taught the programme: a receiving institution assessing the award needs to
  -- know where the study happened, and "ICOF Global University" alone does not
  -- answer it.
  add column if not exists campus          text,
  add column if not exists mode_of_study   text,
  -- Distinguished from `program`. The University asked that the award, the
  -- programme and the specialization be three lines, "particularly important
  -- when you eventually have many specializations".
  add column if not exists specialization  text,
  -- DATES, not years. `admission_year` is an integer and cannot express
  -- "September 2023", which is what a transcript prints and what a credential
  -- evaluator compares against a visa.
  add column if not exists admitted_on     date,
  add column if not exists completed_on    date,
  add column if not exists academic_standing text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'students_mode_of_study_check') then
    alter table students add constraint students_mode_of_study_check
      check (mode_of_study is null or mode_of_study in
             ('on-campus', 'online', 'distance', 'blended'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'students_academic_standing_check') then
    alter table students add constraint students_academic_standing_check
      check (academic_standing is null or academic_standing in
             ('good-standing', 'warning', 'probation', 'suspended',
              'graduated', 'withdrawn', 'dismissed'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. THE UNIVERSITY'S ACADEMIC POLICY — ONE ROW, MOSTLY EMPTY ON PURPOSE
-- ---------------------------------------------------------------------------

create table if not exists academic_policy (
  -- Exactly one row, enforced below. A policy table with two rows is a
  -- university with two policies and no way to tell which applies.
  id                       boolean primary key default true check (id),

  -- WHAT A REPEATED COURSE DOES. NULL until the University rules.
  repeat_rule              text,
  repeat_rule_confirmed    boolean not null default false,

  -- WHERE STANDING TURNS. NULL until the University rules.
  standing_warning_below   numeric(3,2),
  standing_probation_below numeric(3,2),
  standing_confirmed       boolean not null default false,

  -- Whether a transcript may be issued to a student with an unpaid balance.
  -- The University's own regulations say documents are held until it is paid;
  -- this records whether that is enforced by the system or by the counter.
  hold_on_fee_balance      boolean not null default false,

  ruled_on                 date,
  ruled_by                 text,
  updated_at               timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'academic_policy_repeat_rule_check') then
    alter table academic_policy add constraint academic_policy_repeat_rule_check
      check (repeat_rule is null or repeat_rule in
             ('all-attempts-count',   -- every attempt is in the GPA
              'latest-replaces',      -- the most recent attempt replaces earlier ones
              'best-replaces',        -- the highest attempt replaces earlier ones
              'excluded-from-gpa'));  -- earlier attempts are shown but not counted
  end if;

  -- A CONFIRMED RULE MUST BE A RULE. `confirmed = true` with `repeat_rule`
  -- NULL would be the system reporting that the University has ruled, when it
  -- has recorded nothing.
  if not exists (select 1 from pg_constraint where conname = 'academic_policy_confirmed_check') then
    alter table academic_policy add constraint academic_policy_confirmed_check
      check ((not repeat_rule_confirmed or repeat_rule is not null)
         and (not standing_confirmed
              or (standing_warning_below is not null
                  and standing_probation_below is not null)));
  end if;
end $$;

insert into academic_policy (id) values (true) on conflict (id) do nothing;

alter table academic_policy enable row level security;

drop policy if exists academic_policy_read on academic_policy;
create policy academic_policy_read on academic_policy
  for select using (auth.uid() is not null);

-- ONLY THE SUPERADMINISTRATOR. A rule that decides how every GPA in the
-- University is computed is not an operational setting.
drop policy if exists academic_policy_write on academic_policy;
create policy academic_policy_write on academic_policy
  for update using (auth_role() = 'superadmin') with check (auth_role() = 'superadmin');

-- ---------------------------------------------------------------------------
-- 3. EVERY ATTEMPT AT A COURSE IS KEPT
-- ---------------------------------------------------------------------------
--
-- "The system should retain every attempt." It could not: nothing in `results`
-- distinguished a second sitting from the first, so a repeat was recorded by
-- editing the original row and the failure ceased to exist.

alter table results
  add column if not exists attempt integer not null default 1,
  -- What this attempt does to the GPA, once the University has a rule. NULL
  -- means the rule has not been applied to this row — which, while
  -- `repeat_rule` is NULL, is every row, and the transcript says so rather
  -- than implying a policy.
  add column if not exists gpa_disposition text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'results_attempt_check') then
    alter table results add constraint results_attempt_check check (attempt >= 1);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'results_gpa_disposition_check') then
    alter table results add constraint results_gpa_disposition_check
      check (gpa_disposition is null or gpa_disposition in ('counts', 'replaced', 'excluded'));
  end if;
end $$;

create index if not exists results_student_course_attempt_idx
  on results (student_id, course_id, attempt);

-- ---------------------------------------------------------------------------
-- 4. TRANSFER CREDIT
-- ---------------------------------------------------------------------------
--
-- "The student should not have to lose the history of where previous credits
-- came from." A credit accepted from elsewhere is a DECISION of this
-- University about another institution's teaching, and it is recorded as
-- somebody's decision, with the institution named.

create table if not exists transfer_credits (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students (id) on delete cascade,

  -- Where it came from. Named on the transcript, because a credit with no
  -- source is a credit a receiving institution cannot weigh.
  institution    text not null,
  course_code    text,
  course_title   text not null,
  credits        numeric(5,2) not null check (credits > 0),

  -- What this University accepted, which may be less than what was offered.
  accepted       boolean not null default false,
  credits_accepted numeric(5,2) check (credits_accepted >= 0),

  -- Whether it counts toward the award, and toward which one.
  award_id       uuid references awards (id) on delete set null,

  -- WHOSE DECISION IT WAS. Required when accepted: a credit that appears on a
  -- sealed transcript with nobody's name against the decision is a credit
  -- nobody can be asked about.
  decided_by     uuid,
  decided_on     date,
  note           text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transfer_credits_decided_check') then
    alter table transfer_credits add constraint transfer_credits_decided_check
      check (not accepted or (decided_by is not null and decided_on is not null
                              and credits_accepted is not null));
  end if;
end $$;

create index if not exists transfer_credits_student_idx on transfer_credits (student_id);

alter table transfer_credits enable row level security;

drop policy if exists transfer_credits_read on transfer_credits;
create policy transfer_credits_read on transfer_credits
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                    'programme-coordinator', 'dean', 'hod')
    or exists (select 1 from students s
                where s.id = transfer_credits.student_id and s.auth_user_id = auth.uid())
  );

drop policy if exists transfer_credits_write on transfer_credits;
create policy transfer_credits_write on transfer_credits
  for insert with check (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office')
  );

drop policy if exists transfer_credits_update on transfer_credits;
create policy transfer_credits_update on transfer_credits
  for update using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office')
  );

-- ---------------------------------------------------------------------------
-- 5. HONOURS AND DISTINCTIONS
-- ---------------------------------------------------------------------------
--
-- Recorded, never computed. Nothing in this migration decides that a student
-- has made the Dean's List, because the University has not said what earns it.

create table if not exists academic_honours (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students (id) on delete cascade,

  kind           text not null,
  title          text not null,
  academic_year  text,
  semester       integer,
  awarded_on     date not null,
  awarded_by     uuid,
  note           text,
  created_at     timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'academic_honours_kind_check') then
    alter table academic_honours add constraint academic_honours_kind_check
      check (kind in ('deans-list', 'distinction', 'excellence',
                      'scholarship', 'award', 'recognition'));
  end if;
end $$;

create index if not exists academic_honours_student_idx on academic_honours (student_id);

alter table academic_honours enable row level security;

drop policy if exists academic_honours_read on academic_honours;
create policy academic_honours_read on academic_honours
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                    'programme-coordinator', 'dean', 'hod')
    or exists (select 1 from students s
                where s.id = academic_honours.student_id and s.auth_user_id = auth.uid())
  );

drop policy if exists academic_honours_write on academic_honours;
create policy academic_honours_write on academic_honours
  for insert with check (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office')
  );

-- ---------------------------------------------------------------------------
-- 6. CONFERRAL — WHAT TIES THE TRANSCRIPT TO THE DEGREE
-- ---------------------------------------------------------------------------
--
-- "Conferred: 15 July 2027 · Senate approval date · Convocation date · Degree
-- certificate number." A conferral is an act of the Senate, so the date it
-- resolved is not optional decoration — it is the authority for the award, and
-- a conferral recorded without it says the University granted a degree with no
-- record of deciding to.

create table if not exists graduation_records (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references students (id) on delete cascade,
  award_id           uuid references awards (id) on delete set null,

  senate_approved_on date not null,
  conferred_on       date not null,
  convocation_on     date,

  classification     text,
  -- The University's own sequence for the graduating cohort.
  graduation_number  text,
  -- Links the transcript to the certificate on the credential register.
  certificate_credential_id text,

  recorded_by        uuid,
  created_at         timestamptz not null default now(),

  -- One conferral of one award to one student. A second is a reissue of the
  -- certificate, not a second degree.
  unique (student_id, award_id)
);

do $$
begin
  -- A DEGREE CANNOT BE CONFERRED BEFORE THE SENATE RESOLVED TO CONFER IT.
  if not exists (select 1 from pg_constraint where conname = 'graduation_records_order_check') then
    alter table graduation_records add constraint graduation_records_order_check
      check (conferred_on >= senate_approved_on);
  end if;
end $$;

create index if not exists graduation_records_student_idx on graduation_records (student_id);

alter table graduation_records enable row level security;

drop policy if exists graduation_records_read on graduation_records;
create policy graduation_records_read on graduation_records
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                    'programme-coordinator', 'dean', 'vice-chancellor')
    or exists (select 1 from students s
                where s.id = graduation_records.student_id and s.auth_user_id = auth.uid())
  );

drop policy if exists graduation_records_write on graduation_records;
create policy graduation_records_write on graduation_records
  for insert with check (
    auth_role() in ('superadmin', 'registrar', 'academic-office', 'vice-chancellor')
  );

-- ---------------------------------------------------------------------------
-- 7. ACADEMIC STANDING IS A HISTORY, NOT A FIELD
-- ---------------------------------------------------------------------------
--
-- `students.academic_standing` is where the record stands today. This is how
-- it got there, and it is APPEND-ONLY: a student moved from probation to good
-- standing has a history that matters to them, and a column alone erases it
-- every time it is set.

create table if not exists academic_standing_events (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students (id) on delete cascade,
  from_standing  text,
  to_standing    text not null,
  reason         text not null,
  cgpa_at_change numeric(3,2),
  decided_by     uuid,
  decided_at     timestamptz not null default now()
);

create index if not exists academic_standing_events_student_idx
  on academic_standing_events (student_id, decided_at desc);

create or replace function refuse_standing_mutation() returns trigger
language plpgsql as $$
begin
  raise exception
    'academic_standing_events is append-only. A standing that can be edited '
    'after the fact is not a record of what the University decided; it is a '
    'record of what somebody last wanted it to say.'
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists academic_standing_events_no_update on academic_standing_events;
create trigger academic_standing_events_no_update
  before update or delete on academic_standing_events
  for each row execute function refuse_standing_mutation();

alter table academic_standing_events enable row level security;

drop policy if exists academic_standing_events_read on academic_standing_events;
create policy academic_standing_events_read on academic_standing_events
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                    'programme-coordinator', 'dean', 'hod')
    or exists (select 1 from students s
                where s.id = academic_standing_events.student_id
                  and s.auth_user_id = auth.uid())
  );

drop policy if exists academic_standing_events_write on academic_standing_events;
create policy academic_standing_events_write on academic_standing_events
  for insert with check (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office')
  );

-- ---------------------------------------------------------------------------
-- 8. A STUDENT ASKING FOR THEIR OWN TRANSCRIPT
-- ---------------------------------------------------------------------------
--
-- "Request Official Transcript — Digital PDF / Printed copy / Both."
--
-- A REQUEST IS NOT AN ISSUE. This table holds the asking; the credential
-- register holds the document. Keeping them apart is what lets a request be
-- refused, queued behind a fee, or fulfilled twice, without any of that
-- touching the sealed record.

create table if not exists transcript_requests (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students (id) on delete cascade,
  requested_by   uuid,
  requested_at   timestamptz not null default now(),

  kind           text not null default 'official',
  delivery       text not null default 'pdf',

  status         text not null default 'requested',
  -- Set when it is fulfilled. Points at credentials_issued.credential_id.
  credential_ref text,
  decided_by     uuid,
  decided_at     timestamptz,
  note           text
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transcript_requests_kind_check') then
    alter table transcript_requests add constraint transcript_requests_kind_check
      check (kind in ('official', 'unofficial', 'interim', 'graduation',
                      'academic-record', 'external-evaluation'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'transcript_requests_delivery_check') then
    alter table transcript_requests add constraint transcript_requests_delivery_check
      check (delivery in ('pdf', 'print', 'both'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'transcript_requests_status_check') then
    alter table transcript_requests add constraint transcript_requests_status_check
      check (status in ('requested', 'in-progress', 'issued', 'refused', 'cancelled'));
  end if;

  -- A REFUSAL MUST SAY WHY. A request declined with no note is a student told
  -- no by a system with nobody to ask.
  if not exists (select 1 from pg_constraint where conname = 'transcript_requests_refusal_check') then
    alter table transcript_requests add constraint transcript_requests_refusal_check
      check (status <> 'refused' or (note is not null and length(btrim(note)) >= 8));
  end if;
end $$;

create index if not exists transcript_requests_student_idx
  on transcript_requests (student_id, requested_at desc);
create index if not exists transcript_requests_open_idx
  on transcript_requests (status) where status in ('requested', 'in-progress');

alter table transcript_requests enable row level security;

drop policy if exists transcript_requests_read on transcript_requests;
create policy transcript_requests_read on transcript_requests
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office')
    or exists (select 1 from students s
                where s.id = transcript_requests.student_id and s.auth_user_id = auth.uid())
  );

-- A STUDENT MAY ASK FOR THEIR OWN, AND ONLY THEIR OWN.
drop policy if exists transcript_requests_own_insert on transcript_requests;
create policy transcript_requests_own_insert on transcript_requests
  for insert with check (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office')
    or exists (select 1 from students s
                where s.id = transcript_requests.student_id and s.auth_user_id = auth.uid())
  );

-- BUT ONLY THE REGISTRY DECIDES ONE. A student who could update their own
-- request could mark it issued.
drop policy if exists transcript_requests_decide on transcript_requests;
create policy transcript_requests_decide on transcript_requests
  for update using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office')
  ) with check (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office')
  );

-- ===========================================================================
-- 9. PERFORMING THE RULES, RATHER THAN ASSERTING THAT TRIGGERS EXIST
--
-- Every check below does the thing the rule forbids and expects to be
-- refused. A test that reads pg_trigger proves a trigger is attached; it does
-- not prove the trigger does what its name says.
-- ===========================================================================

do $$
declare
  s_id uuid;
  ev_id uuid;
  refused boolean;
begin
  -- A student to test against, removed at the end.
  insert into students (matric_no, first_name, last_name, status)
  values ('MIG019/PROOF', 'Migration', 'Proof', 'applicant')
  returning id into s_id;

  -- ---- Standing history cannot be rewritten ------------------------------
  insert into academic_standing_events (student_id, to_standing, reason)
  values (s_id, 'probation', 'Proof of the append-only rule')
  returning id into ev_id;

  refused := false;
  begin
    update academic_standing_events set to_standing = 'good-standing' where id = ev_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '019 FAILED: a standing event could be edited after the fact';
  end if;

  refused := false;
  begin
    delete from academic_standing_events where id = ev_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '019 FAILED: a standing event could be deleted';
  end if;

  -- ---- An accepted transfer credit must name who accepted it -------------
  refused := false;
  begin
    insert into transfer_credits (student_id, institution, course_title, credits, accepted)
    values (s_id, 'Another University', 'Old Testament Survey', 6, true);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '019 FAILED: a credit was accepted with nobody''s name against it';
  end if;

  -- …and is accepted normally when it does.
  insert into transfer_credits (student_id, institution, course_title, credits,
                                accepted, credits_accepted, decided_by, decided_on)
  values (s_id, 'Another University', 'Old Testament Survey', 6,
          true, 6, gen_random_uuid(), current_date);

  -- ---- A degree cannot be conferred before the Senate resolved -----------
  refused := false;
  begin
    insert into graduation_records (student_id, senate_approved_on, conferred_on)
    values (s_id, current_date, current_date - 1);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '019 FAILED: a degree was conferred before the Senate approved it';
  end if;

  -- ---- A refused request must say why ------------------------------------
  refused := false;
  begin
    insert into transcript_requests (student_id, status) values (s_id, 'refused');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '019 FAILED: a request was refused with no reason recorded';
  end if;

  -- ---- The policy row cannot claim a ruling it does not hold -------------
  refused := false;
  begin
    update academic_policy set repeat_rule_confirmed = true, repeat_rule = null;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '019 FAILED: the policy reported a ruling with no rule recorded';
  end if;

  -- ---- Study mode is a closed list ---------------------------------------
  refused := false;
  begin
    update students set mode_of_study = 'correspondence' where id = s_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '019 FAILED: an unknown study mode was accepted';
  end if;

  -- Clean up. The standing event resists deletion by design, so the student
  -- row is removed with the trigger disabled for this transaction only.
  set constraints all immediate;
  alter table academic_standing_events disable trigger academic_standing_events_no_update;
  delete from academic_standing_events where student_id = s_id;
  alter table academic_standing_events enable trigger academic_standing_events_no_update;
  delete from transfer_credits where student_id = s_id;
  delete from transcript_requests where student_id = s_id;
  delete from students where id = s_id;

  raise notice '019 OK — standing is append-only, an accepted credit names its decider, a '
               'conferral cannot precede the Senate, a refusal states its reason, the policy '
               'cannot claim an unrecorded ruling, and study mode is a closed list.';
end $$;

-- ---------------------------------------------------------------------------
-- 10. WHAT THE UNIVERSITY STILL HAS TO RULE ON
-- ---------------------------------------------------------------------------

do $$
declare
  p record;
begin
  select * into p from academic_policy where id;

  if not p.repeat_rule_confirmed then
    raise notice 'OUTSTANDING RULING — repeated courses. `academic_policy.repeat_rule` is not '
                 'set, so every attempt counts toward the GPA and every attempt is printed. '
                 'Set it to one of all-attempts-count / latest-replaces / best-replaces / '
                 'excluded-from-gpa when the University rules, and set repeat_rule_confirmed.';
  end if;

  if not p.standing_confirmed then
    raise notice 'OUTSTANDING RULING — academic standing. No threshold is recorded, so standing '
                 'is whatever a person sets and nothing is computed. A transcript shows no '
                 'standing at all until one is recorded against the student.';
  end if;
end $$;

-- What landed.
select 'students'                  as object, count(*) as columns_added from information_schema.columns
 where table_schema = 'public' and table_name = 'students'
   and column_name in ('place_of_birth','campus','mode_of_study','specialization',
                       'admitted_on','completed_on','academic_standing')
union all
select 'results', count(*) from information_schema.columns
 where table_schema = 'public' and table_name = 'results'
   and column_name in ('attempt','gpa_disposition')
union all
select 'new tables', count(*) from information_schema.tables
 where table_schema = 'public'
   and table_name in ('academic_policy','transfer_credits','academic_honours',
                      'graduation_records','academic_standing_events','transcript_requests');


-- ===========================================================================
-- ===========================================================================
--
--   020_signature_void_and_grading.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 020 — A SIGNATURE ANYONE CAN CHECK, VOIDING, AND A GRADING SCALE THE
--       UNIVERSITY CAN CHANGE WITHOUT A DEPLOYMENT
--
-- Three gaps, named honestly in the last review and closed here.
--
-- ---------------------------------------------------------------------------
-- 1. THE SEAL IS A SECRET; THE SIGNATURE IS NOT
-- ---------------------------------------------------------------------------
--
-- Every credential already carries an HMAC seal over its content hash. An HMAC
-- is a SHARED-SECRET construction: it proves a document is genuine only to
-- somebody who holds CREDENTIAL_SECRET, which is the University and nobody
-- else. That is why verification has to go through /verify — the University is
-- the only party that can perform the check.
--
-- A receiving university, a credential evaluator or an immigration officer
-- cannot check it offline, and must trust that the website they are looking at
-- is the University's. For most purposes /verify is enough. For a document
-- handed to an authority that will archive it for thirty years, it is not.
--
-- So each credential now also carries a DETACHED Ed25519 SIGNATURE over the
-- same content hash, made with a private key the University holds and
-- verifiable by anyone with the matching PUBLIC key, which is published. The
-- seal is unchanged and still governs; the signature is an additional,
-- independently checkable statement.
--
-- WHAT THIS IS STILL NOT, and the interface must not claim otherwise: it is not
-- a PAdES or X.509 signature embedded in a PDF, so Adobe Reader will not show a
-- blue tick. Doing that needs a certificate from a public authority the
-- University would have to buy and be audited for. Calling this "digitally
-- signed" without that distinction is the kind of overstatement that gets a
-- registry's documents rejected the first time somebody checks properly.
--
-- ---------------------------------------------------------------------------
-- 2. VOIDING IS NOT REVOKING, AND THE DIFFERENCE MATTERS TO THE HOLDER
-- ---------------------------------------------------------------------------
--
-- REVOKED says the University has withdrawn the award. It is a finding against
-- the holder and it is what /verify reports to anyone who asks.
--
-- VOID says this DOCUMENT should never have existed — issued to the wrong
-- student, issued twice, issued against a record that had not been approved.
-- The holder has done nothing wrong and their award, if they have one, stands.
--
-- Recording both as 'revoked' would put a mark against a student for a
-- registry clerk's mistake, permanently and visibly, on a public verification
-- service. They are separate states.
--
-- Neither deletes anything. The row stays, the reason is required, and both are
-- on the audit trail.
--
-- ---------------------------------------------------------------------------
-- 3. THE GRADING SCALE IS THE UNIVERSITY'S, NOT THE REPOSITORY'S
-- ---------------------------------------------------------------------------
--
-- It lives in src/content/regulations.ts, which means changing a band is a code
-- edit and a deployment — and means a programme that grades differently cannot
-- exist at all. The University asked for it to be configurable.
--
-- The published scale REMAINS THE FALLBACK and is not deleted: a deployment
-- that has not run this migration, or a database with no active scale, still
-- grades exactly as it does today rather than failing or defaulting to nothing.
--
-- AND A SCALE IS VERSIONED, NEVER EDITED. A transcript issued in 2026 was
-- computed under the 2026 bands; rewriting them would change what the
-- University said about a graduate after the fact, which is the same rule the
-- credential templates already follow.
--
-- Idempotent. Run it twice; the second run changes nothing.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. VOIDING, AND THE SIGNATURE
-- ---------------------------------------------------------------------------

alter table credentials_issued
  add column if not exists signature      text,
  -- Which key signed it. A key is eventually rotated, and a signature with no
  -- record of the key it was made with becomes unverifiable the day that
  -- happens.
  add column if not exists signing_key_id text,
  add column if not exists void_reason    text,
  add column if not exists voided_by      uuid,
  add column if not exists voided_at      timestamptz;

-- 'void' joins the existing states. The constraint is replaced rather than
-- added to, because a check constraint cannot be extended in place.
do $$
declare
  con text;
begin
  select conname into con
    from pg_constraint
   where conrelid = 'credentials_issued'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%status%'
     and pg_get_constraintdef(oid) ilike '%issued%'
   limit 1;

  if con is not null then
    execute format('alter table credentials_issued drop constraint %I', con);
  end if;

  alter table credentials_issued add constraint credentials_issued_status_check
    check (status in ('issued', 'revoked', 'replaced', 'void'));
end $$;

-- A VOID DOCUMENT MUST SAY WHY. "Voided" with no reason is a document that
-- vanished from use with nobody accountable for the decision.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'credentials_issued_void_check') then
    alter table credentials_issued add constraint credentials_issued_void_check
      check (status <> 'void'
             or (void_reason is not null and length(btrim(void_reason)) >= 12
                 and voided_by is not null and voided_at is not null));
  end if;
end $$;

create index if not exists credentials_void_idx
  on credentials_issued (voided_at) where status = 'void';

-- ---------------------------------------------------------------------------
-- 1b. 'voided' JOINS THE AUDITED ACTIONS
-- ---------------------------------------------------------------------------
--
-- The audit table's action list is a closed vocabulary on purpose: an action
-- outside it fails the insert, which is the right failure, because the
-- alternative is an act that happened and was not recorded. Voiding is a new
-- act, so it has to be admitted to the list — and the route writes the trail
-- BEFORE it changes the document, so without this the void would have been
-- refused rather than silently unrecorded.

do $$
declare
  con text;
begin
  select conname into con
    from pg_constraint
   where conrelid = 'credential_audit_events'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%action%'
     and pg_get_constraintdef(oid) ilike '%reinstated%'
   limit 1;

  if con is not null then
    execute format('alter table credential_audit_events drop constraint %I', con);
  end if;

  alter table credential_audit_events add constraint credential_audit_events_action_check
    check (action in
      ('issued', 'corrected', 'reissued', 'revoked', 'reinstated', 'voided',
       'printed', 'emailed', 'template_created', 'template_published',
       'type_created', 'correction_requested', 'correction_reviewed',
       'correction_approved', 'correction_rejected'));
end $$;

-- ---------------------------------------------------------------------------
-- 2. THE GRADING SCALE, VERSIONED
-- ---------------------------------------------------------------------------

create table if not exists grading_scales (
  id            uuid primary key default gen_random_uuid(),

  name          text not null,
  version       integer not null default 1,

  -- NULL applies to the whole University. A value scopes the scale to one
  -- award kind, so a doctorate can be graded differently from a certificate
  -- without a second system.
  award_kind    text,

  -- The lowest mark that earns credit, under this scale.
  pass_mark     numeric(5,2) not null,
  -- The top of the scale, so a GPA can be printed over its own denominator.
  max_point     numeric(3,2) not null,

  -- [{ grade, points, min, max, descriptor }, …] in descending order.
  bands         jsonb not null,

  is_active     boolean not null default false,
  published_by  uuid,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),

  unique (name, version)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'grading_scales_kind_check') then
    alter table grading_scales add constraint grading_scales_kind_check
      check (award_kind is null or award_kind in
             ('doctorate', 'masters', 'bachelors', 'diploma', 'certificate'));
  end if;

  -- A SCALE WITH NO BANDS WOULD GRADE EVERY MARK AS NOTHING.
  if not exists (select 1 from pg_constraint where conname = 'grading_scales_bands_check') then
    alter table grading_scales add constraint grading_scales_bands_check
      check (jsonb_typeof(bands) = 'array' and jsonb_array_length(bands) > 0);
  end if;
end $$;

-- ONE ACTIVE SCALE PER SCOPE. Two would mean two answers to "what is a B",
-- and which one applied would depend on row order.
create unique index if not exists grading_scales_active_global_idx
  on grading_scales ((true)) where is_active and award_kind is null;
create unique index if not exists grading_scales_active_kind_idx
  on grading_scales (award_kind) where is_active and award_kind is not null;

-- A PUBLISHED SCALE IS NEVER EDITED. Publishing a change writes a new version;
-- the old one stays exactly as it was, because a transcript issued under it was
-- computed with those bands and rewriting them changes what the University said
-- about a graduate after the fact.
create or replace function refuse_published_scale_edit() returns trigger
language plpgsql as $$
begin
  if old.published_at is null then
    return new;                       -- a draft may still be worked on
  end if;
  -- Activating and deactivating are the only permitted changes.
  if new.name = old.name
     and new.version = old.version
     and new.award_kind is not distinct from old.award_kind
     and new.pass_mark = old.pass_mark
     and new.max_point = old.max_point
     and new.bands = old.bands then
    return new;
  end if;
  raise exception
    'Grading scale "% v%" has been published and cannot be edited. Publish a new '
    'version instead: a transcript issued under this scale was computed with these '
    'bands, and changing them alters what the University said about a graduate '
    'after the fact.', old.name, old.version
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists grading_scales_no_edit on grading_scales;
create trigger grading_scales_no_edit
  before update on grading_scales
  for each row execute function refuse_published_scale_edit();

alter table grading_scales enable row level security;

drop policy if exists grading_scales_read on grading_scales;
create policy grading_scales_read on grading_scales
  for select using (auth.uid() is not null);

-- THE SUPERADMINISTRATOR ALONE. A grading scale decides every classification
-- the University awards; it sits with the credential design, not with
-- operations.
drop policy if exists grading_scales_write on grading_scales;
create policy grading_scales_write on grading_scales
  for insert with check (auth_role() = 'superadmin');

drop policy if exists grading_scales_update on grading_scales;
create policy grading_scales_update on grading_scales
  for update using (auth_role() = 'superadmin') with check (auth_role() = 'superadmin');

-- ---------------------------------------------------------------------------
-- 3. SEEDING THE PUBLISHED SCALE, SO NOTHING CHANGES ON THE DAY THIS RUNS
-- ---------------------------------------------------------------------------
--
-- The bands below are the University's published regulations, transcribed —
-- the same eleven the repository already carries. Seeding them means the table
-- and the code agree from the first minute, and the University can then publish
-- a version 2 rather than starting from an empty screen.

insert into grading_scales (name, version, award_kind, pass_mark, max_point, bands,
                            is_active, published_at)
select 'University grading scale', 1, null, 65, 4.00,
  '[{"grade":"A",  "points":4.00,"min":94,"max":100,"descriptor":"Excellent"},
    {"grade":"A-", "points":3.33,"min":91,"max":93, "descriptor":"Very Good"},
    {"grade":"B+", "points":3.00,"min":89,"max":90, "descriptor":"Good"},
    {"grade":"B",  "points":2.67,"min":85,"max":88, "descriptor":"Above Average"},
    {"grade":"B-", "points":2.33,"min":81,"max":84, "descriptor":"Average"},
    {"grade":"C+", "points":2.00,"min":77,"max":80, "descriptor":"Satisfactory"},
    {"grade":"C",  "points":1.67,"min":73,"max":76, "descriptor":"Satisfactory"},
    {"grade":"C-", "points":1.33,"min":70,"max":72, "descriptor":"Below Satisfactory"},
    {"grade":"D+", "points":1.00,"min":67,"max":69, "descriptor":"Pass"},
    {"grade":"D",  "points":0.67,"min":65,"max":66, "descriptor":"Pass"},
    {"grade":"F",  "points":0.00,"min":0, "max":64, "descriptor":"Fail"}]'::jsonb,
  true, now()
where not exists (select 1 from grading_scales where name = 'University grading scale' and version = 1);

-- ===========================================================================
-- 4. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  scale_id uuid;
  active_id uuid;
  refused boolean;
begin
  -- ---- A published scale cannot be edited --------------------------------
  select id into scale_id from grading_scales
   where name = 'University grading scale' and version = 1;

  refused := false;
  begin
    update grading_scales set pass_mark = 50 where id = scale_id;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '020 FAILED: a published grading scale could be edited';
  end if;

  -- …but activating and deactivating it still work.
  --
  -- ON WHICHEVER SCALE IS CURRENTLY ACTIVE, NOT ON VERSION 1. This proof used
  -- to name version 1 and switch it off and back on, which was correct for
  -- exactly as long as version 1 was the only scale the University had. 035
  -- published version 2 and deactivated version 1 — and re-running this file
  -- after that turned version 1 back on while version 2 was still on, which the
  -- unique index over the active global scale refuses. So a bundle that had
  -- been run once could not be run twice, and the failure pointed at 020 rather
  -- than at the assumption inside it.
  --
  -- Found by running RUN-ALL.sql a second time. A migration is not idempotent
  -- because it says so.
  select id into active_id from grading_scales
   where name = 'University grading scale' and is_active and award_kind is null;
  if active_id is null then active_id := scale_id; end if;

  update grading_scales set is_active = false where id = active_id;
  update grading_scales set is_active = true  where id = active_id;

  -- ---- Two active global scales are impossible ---------------------------
  refused := false;
  begin
    insert into grading_scales (name, version, pass_mark, max_point, bands, is_active)
    values ('A second opinion', 1, 50, 5.00,
            '[{"grade":"A","points":5.00,"min":70,"max":100}]'::jsonb, true);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '020 FAILED: the University had two active grading scales at once';
  end if;

  -- ---- A scale with no bands is refused ----------------------------------
  refused := false;
  begin
    insert into grading_scales (name, version, pass_mark, max_point, bands)
    values ('Empty', 1, 50, 4.00, '[]'::jsonb);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '020 FAILED: a grading scale with no bands was accepted';
  end if;

  -- ---- Voiding requires a reason and an author ---------------------------
  refused := false;
  begin
    -- `facts` IS SUPPLIED SO THE REFUSAL IS THE ONE BEING TESTED. Without it
    -- the insert failed on a NOT NULL column and the proof passed for the
    -- wrong reason — a green check that proves nothing is worse than none.
    insert into credentials_issued
      (credential_id, kind, holder_name, award, facts, content_hash, seal_code, status)
    values ('IGUC-VOID-PROOF-020', 'transcript', 'Proof', 'Proof',
            '{}'::jsonb, 'deadbeef', 'PROOF-CODE', 'void');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '020 FAILED: a credential was voided with no reason recorded';
  end if;

  -- …and is accepted when it carries one.
  --
  -- ROLLED BACK RATHER THAN DELETED. A credential is never deleted — 004's
  -- own trigger refuses it, correctly — so a proof row inserted here would
  -- stay on the University's register for ever as a document that never
  -- existed. The insert happens inside a subtransaction that is unwound by
  -- raising, so the rule is genuinely exercised and the register is untouched.
  begin
    insert into credentials_issued
      (credential_id, kind, holder_name, award, facts, content_hash, seal_code,
       status, void_reason, voided_by, voided_at)
    values ('IGUC-VOID-PROOF-020', 'transcript', 'Proof', 'Proof',
            '{}'::jsonb, 'deadbeef', 'PROOF-CODE', 'void',
            'Issued against the wrong student record', gen_random_uuid(), now());

    if not exists (select 1 from credentials_issued
                    where credential_id = 'IGUC-VOID-PROOF-020' and status = 'void') then
      raise exception '020 FAILED: a properly reasoned void was not accepted';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  if exists (select 1 from credentials_issued where credential_id = 'IGUC-VOID-PROOF-020') then
    raise exception '020 FAILED: the proof row was left on the register';
  end if;

  -- ---- The trail accepts a void, and still refuses an invented action ----
  refused := false;
  begin
    insert into credential_audit_events (credential_ref, action, actor_role)
    values ('IGUC-PROOF-020', 'deleted', 'superadmin');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '020 FAILED: the audit trail accepted an action outside its vocabulary';
  end if;

  begin
    insert into credential_audit_events (credential_ref, action, actor_role, reason)
    values ('IGUC-PROOF-020', 'voided', 'superadmin', 'Proof that voided is auditable');
    raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then
      raise exception '020 FAILED: a void could not be written to the audit trail (%)', sqlerrm;
    end if;
  end;

  raise notice '020 OK — a published scale cannot be edited, the University cannot hold two '
               'active scales, an empty scale is refused, voiding requires a stated reason '
               'and a named author, and ''voided'' is an auditable action.';
end $$;

-- ---------------------------------------------------------------------------
-- 5. WHAT THE UNIVERSITY STILL HAS TO DO
-- ---------------------------------------------------------------------------

do $$
declare
  signed integer;
  total  integer;
begin
  select count(*) filter (where signature is not null), count(*)
    into signed, total
    from credentials_issued;

  if total > 0 and signed = 0 then
    raise notice 'NOTHING IS SIGNED YET. Set CREDENTIAL_SIGNING_KEY on the server and reissue, '
                 'or run the backfill in docs/DEPLOYMENT.md. Credentials issued before the key '
                 'existed keep their HMAC seal and verify normally through /verify; they simply '
                 'carry no independently checkable signature.';
  end if;
end $$;

select 'credentials_issued' as object,
       count(*) filter (where column_name in
             ('signature','signing_key_id','void_reason','voided_by','voided_at')) as columns_added
  from information_schema.columns
 where table_schema = 'public' and table_name = 'credentials_issued'
union all
select 'grading_scales rows', count(*)::bigint from grading_scales;


-- ===========================================================================
-- ===========================================================================
--
--   021_signing_key_in_the_store.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 021 — THE SIGNING KEY LIVES IN THE UNIVERSITY'S OWN SECRET STORE
--
-- The University asked: "can't the system keep the key?"
--
-- It can. 017 built a sealed store — AES-256-GCM, row-level security with NO
-- policy at all, so it is unreadable through the publishable key by
-- construction rather than by a rule somebody could later widen. It was built
-- for social tokens. A signing key is the same kind of thing and belongs in the
-- same place.
--
-- This migration does one thing: admits 'signing_key' to the store's list of
-- kinds. That list is closed on purpose, so a value it does not know cannot be
-- written.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES AND DOES NOT REMOVE
-- ---------------------------------------------------------------------------
--
-- IT REMOVES: pasting a multi-line PEM into a hosting dashboard, and redeploying
-- to make it take effect. The key is generated in the portal, kept by the
-- system, and used from the next request onwards.
--
-- IT DOES NOT REMOVE: the need for SECRET_STORE_KEY. Something has to encrypt
-- the store, and that something cannot itself live in the store. So this trades
-- a long multi-line secret for a short single-line one — and if SECRET_STORE_KEY
-- is already set for the social connections, it trades it for nothing at all.
--
-- Saying "the system keeps the key" without that sentence would be selling a
-- guarantee this does not provide.
--
-- ---------------------------------------------------------------------------
-- AND WHAT IT MEANS IF SECRET_STORE_KEY IS LOST
-- ---------------------------------------------------------------------------
--
-- The signing key is unrecoverable. Credentials already signed stay valid and
-- verifiable — their signatures and the public key are unaffected — but nothing
-- can ever be signed with that key again, and a new one has to be generated and
-- published. This is the same exposure the social tokens already carry, and it
-- is the price of the store encrypting anything at all.
--
-- Idempotent. Run it twice; the second run changes nothing.
-- ===========================================================================

do $$
declare
  con text;
begin
  select conname into con
    from pg_constraint
   where conrelid = 'secret_store'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%kind%'
     and pg_get_constraintdef(oid) ilike '%social_tokens%'
   limit 1;

  if con is not null then
    execute format('alter table secret_store drop constraint %I', con);
  end if;

  alter table secret_store add constraint secret_store_kind_check
    check (kind in ('social_tokens', 'proctoring', 'signing_key', 'other'));
end $$;

-- ===========================================================================
-- PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  -- A well-formed sealed value: three base64url segments, as the store's own
  -- constraint requires. Not a real key — nothing here is ever a real secret.
  fake_sealed constant text := 'AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBB.CCCCCCCCCCCCCCCCCCCC';
begin
  -- ---- A signing key may now be stored --------------------------------
  begin
    insert into secret_store (ref, kind, sealed)
    values ('proof-021', 'signing_key', fake_sealed);
    raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then
      raise exception '021 FAILED: a signing key could not be stored (%)', sqlerrm;
    end if;
  end;

  if exists (select 1 from secret_store where ref = 'proof-021') then
    raise exception '021 FAILED: the proof row was left in the store';
  end if;

  -- ---- …and an unknown kind still cannot be ---------------------------
  refused := false;
  begin
    insert into secret_store (ref, kind, sealed)
    values ('proof-021b', 'passwords', fake_sealed);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '021 FAILED: the store accepted a kind outside its vocabulary';
  end if;

  -- ---- AND PLAINTEXT IS STILL REFUSED ---------------------------------
  -- The rule that matters most: a value that does not look sealed is a value
  -- somebody wrote by hand, which for a signing key would be the private key
  -- itself sitting in a database column.
  refused := false;
  begin
    insert into secret_store (ref, kind, sealed)
    values ('proof-021c', 'signing_key', '-----BEGIN PRIVATE KEY-----');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '021 FAILED: an unsealed private key was accepted into the store';
  end if;

  raise notice '021 OK — a signing key may be stored, an unknown kind may not, and a private '
               'key written in plaintext is still refused.';
end $$;

-- ---------------------------------------------------------------------------
-- The store, and whether the University is holding a key in it.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from secret_store where kind = 'signing_key') then
    raise notice 'NO SIGNING KEY IS STORED. Generate one at Credentials -> Register -> Document '
                 'signing, and choose to let the system keep it. Until then, credentials carry '
                 'the University''s seal and verify through /verify exactly as before.';
  end if;
end $$;

select kind, count(*) as stored from secret_store group by kind order by kind;


-- ===========================================================================
-- ===========================================================================
--
--   022_publication_under_own_authority.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 022 — THE SUPERADMINISTRATOR MAY PUBLISH WITHOUT THE SENATE, AND IT SHOWS
--
-- The University has ruled that the Superadministrator can bypass the three
-- approving offices and publish a credential design directly.
--
-- ---------------------------------------------------------------------------
-- WHAT 005 DID, AND WHY IT IS NOT SIMPLY UNDONE
-- ---------------------------------------------------------------------------
--
-- Migration 005 put the approval chain in the DATABASE rather than in a route,
-- on the reasoning that a workflow living only in application code is bypassed
-- by the next route somebody writes. That reasoning still holds. So this does
-- not delete the guard; it admits ONE named exception to it and makes the
-- exception impossible to take quietly.
--
-- The difference matters. A guard that can be removed by anybody who can write
-- a route is not a control. A guard with a recorded exception is a control with
-- a stated way round it — which is what an institution actually needs, because
-- the alternative is not "nobody bypasses it": it is somebody with database
-- access doing it invisibly the first time the Vice Chancellor is unreachable
-- and a graduation is on Saturday.
--
-- ---------------------------------------------------------------------------
-- WHAT THE EXCEPTION COSTS THE PERSON TAKING IT
-- ---------------------------------------------------------------------------
--
-- Three things, none of them optional and none removable afterwards:
--
--   A REASON, of at least forty characters. "urgent" is not a reason; the
--   sentence has to say what could not wait. Somebody reading the version
--   history in five years is the audience.
--
--   THEIR NAME AND THE HOUR, written by the database rather than supplied by
--   the caller.
--
--   A PERMANENT MARK ON THE VERSION. `published_without_approval` stays true
--   for the life of the row, and the row is never edited — publishing writes a
--   new version. So the design under which a certificate was issued always says
--   whether the Senate saw it.
--
-- What it does NOT cost: the approvals already recorded. An office that signed
-- before the override stays signed, and its approval is still in the trail.
--
-- Idempotent. Run it twice; the second run changes nothing.
-- ===========================================================================


-- ===========================================================================
-- 1. THE RECORD OF AN OVERRIDE
-- ===========================================================================

alter table credential_templates
  add column if not exists published_without_approval boolean not null default false;
alter table credential_templates
  add column if not exists override_reason text;
alter table credential_templates
  add column if not exists overridden_by uuid references profiles (id) on delete set null;
alter table credential_templates
  add column if not exists overridden_by_email text;
alter table credential_templates
  add column if not exists overridden_at timestamptz;

-- A MARK WITHOUT A REASON IS NOT A RECORD. The constraint is on the row rather
-- than on the route, so an override written by any means still has to say why.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'credential_templates'::regclass
      and conname = 'credential_templates_override_reasoned'
  ) then
    alter table credential_templates add constraint credential_templates_override_reasoned
      check (
        not published_without_approval
        or (override_reason is not null and length(btrim(override_reason)) >= 40)
      );
  end if;
end $$;


-- ===========================================================================
-- 2. THE GUARD, WITH ITS ONE EXCEPTION
-- ===========================================================================
--
-- Everything 005 refused, it still refuses — unless the row itself says this is
-- a publication under the University's own authority. The exception is read
-- from the row being written, so it cannot be taken by a route that merely
-- forgets to check something: the caller has to assert it, in writing, in the
-- same statement.

create or replace function guard_template_publication() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  signed integer;
  refused integer;
begin
  if new.lifecycle = 'published' and coalesce(old.lifecycle, '') <> 'published' then
    select count(distinct office) into signed
    from credential_template_approvals
    where template_id = new.id and decision = 'approved';

    select count(*) into refused
    from credential_template_approvals
    where template_id = new.id and decision = 'rejected';

    if new.published_without_approval then
      -- THE OVERRIDE IS STAMPED BY THE DATABASE, not by the caller. A route
      -- that set overridden_at to last year, or left the name off, would
      -- otherwise produce a record that reads as though the Senate had signed.
      new.overridden_at := now();
      if new.override_reason is null or length(btrim(new.override_reason)) < 40 then
        raise exception
          'a publication under the University''s own authority must carry a reason of at least 40 characters saying what could not wait';
      end if;
      return new;
    end if;

    if signed < 3 then
      raise exception
        'this design has % of 3 approvals; the Registrar, the Academic Office and the Vice Chancellor must each approve before it can be published',
        signed;
    end if;

    if refused > 0 then
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
-- 3. PERFORMING THE RULES
--
-- Each case is carried out against a real row and rolled back, because a rule
-- nobody has watched refuse anything is a rule nobody has tested.
-- ===========================================================================

do $$
declare
  tpl uuid;
  refused boolean;
  msg text;
begin
  insert into credential_templates (kind, version, name, design, lifecycle)
  values ('certificate', 999999, 'proof-022', '{}'::jsonb, 'draft')
  returning id into tpl;

  -- ---- WITHOUT APPROVALS AND WITHOUT AN OVERRIDE: still refused -------
  refused := false;
  begin
    update credential_templates set lifecycle = 'published' where id = tpl;
  exception when others then
    refused := true;
    msg := sqlerrm;
  end;
  if not refused then
    raise exception '022 FAILED: a design with no approvals was published';
  end if;
  if msg not like '%0 of 3 approvals%' then
    raise exception '022 FAILED: the refusal no longer names how many offices have signed (%)', msg;
  end if;

  -- ---- AN OVERRIDE WITH NO REASON: refused ----------------------------
  refused := false;
  begin
    update credential_templates
       set lifecycle = 'published', published_without_approval = true
     where id = tpl;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '022 FAILED: an override with no reason was accepted';
  end if;

  -- ---- A REASON THAT IS NOT ONE: refused ------------------------------
  refused := false;
  begin
    update credential_templates
       set lifecycle = 'published', published_without_approval = true, override_reason = 'urgent'
     where id = tpl;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '022 FAILED: "urgent" was accepted as a reason';
  end if;

  -- ---- A REAL OVERRIDE: allowed, and stamped --------------------------
  update credential_templates
     set lifecycle = 'published',
         published_without_approval = true,
         override_reason = 'Convocation is on Saturday and the Vice Chancellor is out of the '
                        || 'country; published under the University''s own authority.',
         overridden_by_email = 'superadmin@iguc.net',
         -- Deliberately wrong, to prove the trigger overwrites it.
         overridden_at = timestamptz '2001-01-01 00:00:00+00'
   where id = tpl;

  if not exists (
    select 1 from credential_templates
    where id = tpl and lifecycle = 'published' and published_without_approval
      and overridden_at > now() - interval '1 minute'
  ) then
    raise exception '022 FAILED: the override was not recorded with the hour the database stamped';
  end if;

  -- Nothing is left behind: this row never existed as far as the register is
  -- concerned.
  delete from credential_template_approvals where template_id = tpl;
  delete from credential_templates where id = tpl;

  raise notice '022 OK — the Senate is still required, an override still needs a reason in '
               'writing, and a real override publishes and is stamped by the database.';
end $$;


-- ===========================================================================
-- 4. VERIFY
-- ===========================================================================

-- (a) The columns exist.
select column_name from information_schema.columns
where table_name = 'credential_templates'
  and column_name in ('published_without_approval', 'override_reason', 'overridden_by',
                      'overridden_by_email', 'overridden_at')
order by column_name;

-- (b) Anything already published this way. Empty on a fresh install, and worth
--     reading before an audit: these are the designs the Senate never saw.
select kind, version, name, overridden_by_email, overridden_at, override_reason
from credential_templates
where published_without_approval
order by overridden_at desc;


-- ===========================================================================
-- ===========================================================================
--
--   023_programme_application_approval.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 023 — A PROGRAMME IS CLOSED FOR APPLICATION UNTIL ACADEMIC AFFAIRS OPENS IT
--
-- Run after 008_admission_openings.sql. Idempotent; destroys nothing.
--
-- ---------------------------------------------------------------------------
-- WHAT THE UNIVERSITY ASKED FOR
-- ---------------------------------------------------------------------------
--
--   The Director of Academic Affairs reviews the programmes and ticks the ones
--   authorised to accept applications. A programme that is not ticked stays
--   closed even though it exists in the catalogue. Only ticked programmes
--   appear in the Admissions Portal as selectable options. The
--   Superadministrator holds the same privilege and may override the
--   Director's selection. The system records who approved it, when, and who
--   changed it afterwards.
--
-- ---------------------------------------------------------------------------
-- WHY THIS EXTENDS 008 RATHER THAN REPLACING IT
-- ---------------------------------------------------------------------------
--
-- 008 already models what the University is admitting to, in two kinds: an
-- award LEVEL and a FIELD of study. Both are still true and both still gate the
-- form. What it could not say is "the Bachelor of Divinity is open but the
-- Master of Divinity is not", because a programme is neither a level nor a
-- field — it is the pair, named, with a code.
--
-- So this adds a third kind rather than a second table. One table means one
-- admin screen, one route, one RLS policy and one place to look. Three tables
-- modelling the same decision at three grains is how a rule ends up enforced in
-- two of them.
--
-- ---------------------------------------------------------------------------
-- THE ONE PLACE THIS DELIBERATELY CONTRADICTS 008
-- ---------------------------------------------------------------------------
--
-- 008 seeded every row OPEN, and said why at length: a migration that closes
-- the university's front door as a side effect of being deployed is not an
-- acceptable change.
--
-- PROGRAMMES ARE SEEDED CLOSED. That is the opposite, and it is deliberate,
-- because it is the entire point of what was asked for: "this prevents
-- applicants from simply applying to every programme in the database". A
-- control that defaults to permitting everything is not a control, and seeding
-- forty-nine programmes open would mean the Director's tick changed nothing
-- until they first untick something.
--
-- The consequence is real and must not be discovered rather than read: FROM THE
-- MOMENT THIS RUNS, THE ADMISSIONS PORTAL OFFERS NO PROGRAMME until somebody
-- ticks one. The migration says so in a NOTICE at the end, the admin screen
-- says so in red at the top, and the public catalogue says so on every card.
--
-- The level and field rows 008 seeded are NOT touched, so the existing form —
-- which asks for a level and a field, not a programme — keeps working exactly
-- as it does today while the programme gate is being populated.
-- ===========================================================================


-- ===========================================================================
-- 1. A THIRD KIND
-- ===========================================================================

do $$
declare
  con text;
begin
  select conname into con
    from pg_constraint
   where conrelid = 'admission_openings'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%kind%'
     and pg_get_constraintdef(oid) ilike '%level%';

  if con is not null then
    execute format('alter table admission_openings drop constraint %I', con);
  end if;

  alter table admission_openings add constraint admission_openings_kind_check
    check (kind in ('level', 'field', 'programme'));
end $$;


-- ===========================================================================
-- 2. WHO APPROVED IT, WHEN, AND WHO CHANGED IT AFTERWARDS
-- ===========================================================================
--
-- 008 recorded `updated_by` and `updated_at` — the LAST hand on the row, and
-- nothing before it. That answers "who closed this?" and cannot answer "who
-- authorised it in the first place?", which is the question an audit asks.
--
-- So the row carries the approval, and every transition is appended to a
-- history table that is never updated and never deleted from.

alter table admission_openings
  add column if not exists approved_by uuid references profiles (id) on delete set null;
alter table admission_openings
  add column if not exists approved_by_email text;
alter table admission_openings
  add column if not exists approved_at timestamptz;
alter table admission_openings
  add column if not exists updated_by_email text;

create table if not exists admission_opening_events (
  id           uuid primary key default gen_random_uuid(),
  opening_id   uuid not null references admission_openings (id) on delete cascade,
  kind         text not null,
  label        text not null,
  -- What it became. `opened` and `closed` rather than a boolean, so the trail
  -- reads as a sentence in the audit screen without a lookup.
  action       text not null check (action in ('opened', 'closed')),
  actor_id     uuid references profiles (id) on delete set null,
  actor_email  text,
  actor_role   text,
  note         text,
  at           timestamptz not null default now()
);

create index if not exists admission_opening_events_opening_idx
  on admission_opening_events (opening_id, at desc);

-- APPEND ONLY. An approval trail that can be edited is a record of what
-- somebody wanted it to say, and the whole reason for keeping one is that it
-- says what happened instead.
create or replace function admission_opening_events_immutable() returns trigger
language plpgsql
as $$
begin
  raise exception 'the admission approval trail is append-only; a decision is changed by recording the next one';
end;
$$;

drop trigger if exists admission_opening_events_no_change on admission_opening_events;
create trigger admission_opening_events_no_change
  before update or delete on admission_opening_events
  for each row execute function admission_opening_events_immutable();


-- ===========================================================================
-- 3. THE PROGRAMMES, ALL CLOSED
--
-- Every code in src/content/courses.ts. `open` defaults to true on this table
-- for the reason 008 gives, so each row states false explicitly.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- THE ASSERTION IS ABOUT THE ROWS THIS RUN INSERTED, AND NOTHING ELSE.
--
-- It used to read THE-BA back afterwards and refuse if it was open. That is a
-- SEED-TIME invariant checked at RUN time, and the two are not the same thing
-- once the feature is in service: the University ran this, opened the Bachelor
-- of Theology from the admin screen exactly as intended, re-ran the bundle, and
-- the migration refused with "a programme was seeded OPEN". It had not been.
-- It had been opened, on purpose, by the office whose job that is.
--
-- Running twice unchanged is not the same test as running again on a database
-- somebody has USED, and only the first was done. `returning` scopes the check
-- to the insert itself, so the University's own decisions are none of its
-- business.
-- ---------------------------------------------------------------------------

do $$
declare
  opened_by_seed integer;
begin
  with seeded as (
    insert into admission_openings (kind, label, faculty, open) values
      ('programme', 'THE-BA',  'Faculty of Theology',           false),
      ('programme', 'BDIV',    'Faculty of Theology',           false),
      ('programme', 'BMIN',    'Faculty of Theology',           false),
      ('programme', 'CED-BA',  'Faculty of Theology',           false),
      ('programme', 'THE-MA',  'Faculty of Theology',           false),
      ('programme', 'DIV-MA',  'Faculty of Theology',           false),
      ('programme', 'EVM-MA',  'Faculty of Theology',           false),
      ('programme', 'MACL',    'Faculty of Theology',           false),
      ('programme', 'BLT-MA',  'Faculty of Theology',           false),
      ('programme', 'PHD-TH',  'Faculty of Theology',           false),
      ('programme', 'DSTH',    'Faculty of Theology',           false),
      ('programme', 'DTH',     'Faculty of Theology',           false),
      ('programme', 'DMIN',    'Faculty of Theology',           false),
      ('programme', 'CERT-TH', 'Faculty of Theology',           false),
      ('programme', 'CERT-CE', 'Faculty of Theology',           false),
      ('programme', 'DIP-TH',  'Faculty of Theology',           false),
      ('programme', 'DIP-MIN', 'Faculty of Theology',           false),
      ('programme', 'DIP-CL',  'Faculty of Theology',           false),
      ('programme', 'EDU-PRI', 'Faculty of Education',          false),
      ('programme', 'EDU-SPE', 'Faculty of Education',          false),
      ('programme', 'SWE',     'Engineering & Technology',      false),
      ('programme', 'NET',     'Engineering & Technology',      false),
      ('programme', 'WEB',     'Engineering & Technology',      false),
      ('programme', 'ORA',     'Engineering & Technology',      false),
      ('programme', 'HWM',     'Engineering & Technology',      false),
      ('programme', 'LCH',     'Engineering & Technology',      false),
      ('programme', 'ACR',     'Engineering & Technology',      false),
      ('programme', 'CAC',     'Engineering & Technology',      false),
      ('programme', 'BUS-MGT', 'GIBMAS — Business & Management', false),
      ('programme', 'PRJ-MGT', 'GIBMAS — Business & Management', false),
      ('programme', 'NPM',     'GIBMAS — Business & Management', false),
      ('programme', 'BNF',     'GIBMAS — Business & Management', false),
      ('programme', 'ACC',     'GIBMAS — Business & Management', false),
      ('programme', 'INS',     'GIBMAS — Business & Management', false),
      ('programme', 'SEC-EX',  'GIBMAS — Business & Management', false),
      ('programme', 'SEC-BI',  'GIBMAS — Business & Management', false),
      ('programme', 'PPD-AGT', 'PPDI-RC Professional Development', false),
      ('programme', 'PPD-AFD', 'PPDI-RC Professional Development', false),
      ('programme', 'PPD-FBO', 'PPDI-RC Professional Development', false),
      ('programme', 'PPD-DBD', 'PPDI-RC Professional Development', false),
      ('programme', 'PPD-RLD', 'PPDI-RC Professional Development', false),
      ('programme', 'PPD-YTL', 'PPDI-RC Professional Development', false),
      ('programme', 'PPD-AIY', 'PPDI-RC Professional Development', false),
      ('programme', 'PPD-RDM', 'PPDI-RC Professional Development', false),
      ('programme', 'PPD-MSW', 'PPDI-RC Professional Development', false),
      ('programme', 'PPD-DSW', 'PPDI-RC Professional Development', false),
      ('programme', 'PPD-BTT', 'PPDI-RC Professional Development', false),
      ('programme', 'PPD-CDM', 'PPDI-RC Professional Development', false)
    on conflict (kind, label) do nothing
    returning open
  )
  select count(*) filter (where open) into opened_by_seed from seeded;

  if opened_by_seed > 0 then
    raise exception
      '023 FAILED: the seed opened % programme(s) — a gate that defaults to permitting everything is not a gate',
      opened_by_seed;
  end if;
end $$;


-- ===========================================================================
-- 4. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  tgt uuid;
  refused boolean;
begin
  -- ---- The programmes are present --------------------------------------
  -- Whether THE-BA is open is NOT asserted here. Once the University has ticked
  -- it, open is the correct state and re-running the migration must not call
  -- that a failure. The seed's own closed-ness is proved above, scoped to the
  -- rows the seed inserted.
  select id into tgt from admission_openings where kind = 'programme' and label = 'THE-BA';
  if tgt is null then
    raise exception '023 FAILED: the programme rows were not seeded';
  end if;

  -- ---- The trail accepts a decision ------------------------------------
  insert into admission_opening_events (opening_id, kind, label, action, actor_email, actor_role)
  values (tgt, 'programme', 'THE-BA', 'opened', 'proof-023@iguc.net', 'academic-office');

  -- ---- …AND WILL NOT LET IT BE REWRITTEN -------------------------------
  refused := false;
  begin
    update admission_opening_events set action = 'closed' where opening_id = tgt;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '023 FAILED: an approval record was edited after the fact';
  end if;

  refused := false;
  begin
    delete from admission_opening_events where opening_id = tgt;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '023 FAILED: an approval record was deleted';
  end if;

  -- ---- An unknown kind is still refused --------------------------------
  refused := false;
  begin
    insert into admission_openings (kind, label) values ('faculty', 'proof-023');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '023 FAILED: the table accepted a kind outside its vocabulary';
  end if;

  -- Clear the proof event. The trigger refuses a DELETE, so the row is removed
  -- by dropping the trigger for the length of this statement and restoring it —
  -- which is exactly the manoeuvre the trigger exists to make visible, and the
  -- reason it is done here in the open rather than by a route.
  alter table admission_opening_events disable trigger admission_opening_events_no_change;
  delete from admission_opening_events where actor_email = 'proof-023@iguc.net';
  alter table admission_opening_events enable trigger admission_opening_events_no_change;

  raise notice '023 OK — the seed opens nothing, the trail accepts a decision, and it refuses '
               'to have one rewritten or removed.';
end $$;


-- ===========================================================================
-- 5. RLS ON THE TRAIL
--
-- Readable by a signed-in member of staff; written only by the service role,
-- through /api/admissions/openings, which is guarded by capability. The same
-- arrangement 008 gives the openings themselves.
-- ===========================================================================

alter table admission_opening_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'admission_opening_events' and policyname = 'staff read the approval trail'
  ) then
    -- auth_role(), the helper 000 defines, and NOT auth.role(). The two names
    -- differ by a dot and mean different things: auth.role() is Supabase's
    -- session role — 'authenticated' for every signed-in person including every
    -- student — while auth_role() reads this university's own role off the
    -- profile. The trail says which office authorised which programme, and that
    -- is a staff record.
    create policy "staff read the approval trail" on admission_opening_events
      for select using (auth_role() is not null and auth_role() <> 'student');
  end if;
end $$;


-- ===========================================================================
-- 6. WHERE THIS LEAVES ADMISSIONS
-- ===========================================================================

do $$
declare
  open_count integer;
  total integer;
begin
  select count(*) filter (where open), count(*) into open_count, total
  from admission_openings where kind = 'programme';

  if open_count = 0 then
    raise notice 'NO PROGRAMME IS OPEN FOR APPLICATION. All % are closed, which is how they are '
                 'seeded on purpose — the Admissions Portal will offer none until the Director of '
                 'Academic Affairs ticks them at Settings -> Admission openings. The award LEVEL '
                 'and FIELD lists from migration 008 are untouched and still open, so the existing '
                 'application form is unaffected.', total;
  else
    raise notice '% of % programmes are open for application.', open_count, total;
  end if;
end $$;


-- ===========================================================================
-- 7. VERIFY
-- ===========================================================================

select kind, count(*) as rows, count(*) filter (where open) as open
from admission_openings group by kind order by kind;

-- Who authorised what, most recent first. Empty on a fresh install.
select e.at, e.label, e.action, e.actor_email, e.actor_role
from admission_opening_events e
order by e.at desc
limit 50;


-- ===========================================================================
-- ===========================================================================
--
--   024_admission_decision_authority.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 024 — THE ACADEMIC ADMISSION DECISION IS A RECORD, NOT A COLUMN
--
-- Run after 023. Idempotent; destroys nothing.
--
-- ---------------------------------------------------------------------------
-- WHAT A TRACE OF THE OLD PATH FOUND
-- ---------------------------------------------------------------------------
--
--   THE DECISION WAS TWO COLUMNS. `decided_by` and `decided_at` hold the LAST
--   decision on the record. Reverse one and its predecessor is gone, so the
--   students table could say who touched the row most recently and could not
--   say who admitted the student.
--
--   TWO ENDPOINTS PRODUCED TWO OUTCOMES. Both admitted; only one generated the
--   admission package. Which document an admitted student received depended on
--   which desk the approver was sitting at.
--
--   THE OFFICE THAT SIGNS COULD NOT DECIDE. The Head of Academic Affairs holds
--   'admit-student' and signs page 1 of every admission letter, and the
--   navigation exposed no admissions queue to that role at all.
--
-- This migration is the database half of the answer: one immutable decision
-- record, one append-only event log, a state vocabulary wide enough to describe
-- the workflow, and a student number that two simultaneous approvals cannot
-- collide on.
--
-- IT CHANGES NO EXISTING ROW AND REMOVES NO EXISTING COLUMN. `decided_by` and
-- `decided_at` stay exactly as they are and keep being written — they are a
-- useful summary of the current decision. What they stop being is the only
-- record of it.
-- ===========================================================================


-- ===========================================================================
-- 1. THE STATE VOCABULARY
--
-- The application's status was an open text column with no constraint, so any
-- string at all could be written to it and several were. The vocabulary below
-- is src/lib/admissionWorkflow.ts, and the two are checked against each other
-- by src/lib/admissionWorkflow.test.mjs — a state the application believes in
-- and the database refuses is a screen that fails at the moment somebody
-- presses the button.
--
-- NOT ADDED AS A CHECK CONSTRAINT ON students.status. There are live rows whose
-- status this migration cannot see, and a constraint that fails to apply would
-- take the whole migration down with it. It is a lookup table instead: the
-- route validates against it, and a value outside it is visible in one query
-- rather than impossible to write.
-- ===========================================================================

create table if not exists admission_states (
  state       text primary key,
  stage       text not null check (stage in
                ('application', 'verification', 'academic', 'issuance', 'enrolment', 'closed')),
  /** What the applicant is told, which is not what the offices see. */
  applicant_label text not null,
  sort_order  integer not null
);

-- ---------------------------------------------------------------------------
-- SEEDED ONLY WHILE THIS IS STILL 024'S TABLE.
--
-- Running the bundle a second time used to stop dead here, twice over. 025 puts
-- a trigger on this table that refuses an INSERT — a new admission state is a
-- code change, not a row — and it fires before ON CONFLICT is considered. And
-- 025 adds a NOT NULL `label` column, which this statement, written before that
-- column existed, does not supply.
--
-- Neither is a fault in 025. This seed simply belongs to the moment before it:
-- once 025 has run, the vocabulary is 025's, 026's and 027's, they maintain
-- every one of these rows including their labels, and there is nothing here
-- left to do. So the guard is the presence of 025's column, and this becomes a
-- no-op the moment the table has moved on.
--
-- Found by running RUN-ALL.sql a second time. A migration is not idempotent
-- because it says so.
-- ---------------------------------------------------------------------------
insert into admission_states (state, stage, applicant_label, sort_order)
select * from (values
  ('draft',                    'application',  'Application started',        10),
  ('applicant',                'application',  'Application received',       20),
  ('under_review',             'verification', 'Application received',       30),
  ('documents_required',       'verification', 'Documents needed',           40),
  ('documents_verified',       'verification', 'Documents verified',         50),
  ('fee_pending',              'verification', 'Awaiting fee confirmation',  60),
  ('fee_paid',                 'verification', 'Under academic review',      70),
  ('ready_for_academic_review','academic',     'Under academic review',      80),
  ('approved',                 'academic',     'Admission approved',         90),
  ('conditional',              'academic',     'Admission approved',        100),
  ('returned',                 'academic',     'Returned for correction',   110),
  ('rejected',                 'closed',       'Application unsuccessful',  120),
  ('admission_issued',         'issuance',     'Admission letter available',130),
  ('enrolled',                 'enrolment',    'Ready for enrolment',       140),
  ('withdrawn',                'closed',       'Withdrawn',                 150)
) as v(state, stage, applicant_label, sort_order)
where not exists (
  select 1 from information_schema.columns
   where table_schema = 'public'
     and table_name = 'admission_states'
     and column_name = 'label'
)
on conflict (state) do update
  set stage = excluded.stage,
      applicant_label = excluded.applicant_label,
      sort_order = excluded.sort_order;


-- ===========================================================================
-- 2. THE DECISION RECORD
--
-- One row per decision taken, forever. A reversal is a NEW row; the one it
-- reverses is still there, which is the entire point.
-- ===========================================================================

create table if not exists admission_decisions (
  id               uuid primary key default gen_random_uuid(),
  application_id   uuid not null references students (id) on delete cascade,

  -- 'approve' | 'conditional' | 'reject' | 'return' — the act.
  decision         text not null check (decision in ('approve', 'conditional', 'reject', 'return')),
  -- The office's own word for what kind of decision this was.
  decision_type    text not null default 'academic'
                     check (decision_type in ('academic', 'administrative-override')),

  decided_by       uuid references profiles (id) on delete set null,
  decided_by_email text,
  -- THE ROLE AT THE TIME, copied rather than joined. A person's role changes;
  -- the office that took the decision does not, and an audit that reports the
  -- Registrar approved something because that person is the Registrar today is
  -- worse than no audit.
  decided_by_role  text,
  decision_date    timestamptz not null default now(),

  reason           text,
  conditions       jsonb,

  previous_status  text,
  new_status       text,

  -- ---------------------------------------------------------------------
  -- THE OVERRIDE, WHEN THE SUPERADMINISTRATOR ACTS IN ANOTHER OFFICE'S PLACE
  --
  -- The University asked that this be possible and highly visible. Both:
  -- possible, so a graduation is not held up because one office is unreachable;
  -- visible, so nobody quietly changes an academic decision.
  -- ---------------------------------------------------------------------
  is_override      boolean not null default false,
  override_of      text,      -- the office whose authority was exercised
  override_reason  text,

  created_at       timestamptz not null default now(),

  -- An override with no reason is not a record of anything.
  constraint admission_decisions_override_reasoned check (
    not is_override
    or (override_reason is not null and length(btrim(override_reason)) >= 20)
  )
);

create index if not exists admission_decisions_application_idx
  on admission_decisions (application_id, decision_date desc);


-- ===========================================================================
-- 3. THE AUDIT LOG
--
-- Every consequential event, appended. The decision table answers "what was
-- decided"; this answers "what then happened", which is the question asked
-- when a student says they were admitted and never received a letter.
-- ===========================================================================

create table if not exists admission_audit_log (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid references students (id) on delete cascade,
  decision_id    uuid references admission_decisions (id) on delete set null,

  event          text not null check (event in (
    'APPLICATION_SUBMITTED',
    'DOCUMENT_VERIFIED',
    'FEE_CONFIRMED',
    'ACADEMIC_REVIEW_STARTED',
    'ACADEMIC_APPROVED',
    'ACADEMIC_CONDITIONALLY_APPROVED',
    'ACADEMIC_REJECTED',
    'ACADEMIC_RETURNED',
    'ADMISSION_LETTER_GENERATED',
    'ADMISSION_PACKAGE_ISSUED',
    'ACCOUNT_CREATED',
    'WELCOME_EMAIL_SENT',
    'WELCOME_EMAIL_FAILED',
    'ENROLLED',
    'ADMINISTRATIVE_OVERRIDE'
  )),

  actor_id       uuid references profiles (id) on delete set null,
  actor_email    text,
  actor_role     text,
  -- Where from. Recorded because an academic decision is attributable, and
  -- "attributable" means more than a user id when an account is shared.
  actor_ip       text,
  user_agent     text,

  detail         text,
  at             timestamptz not null default now()
);

create index if not exists admission_audit_log_application_idx
  on admission_audit_log (application_id, at desc);
create index if not exists admission_audit_log_event_idx on admission_audit_log (event, at desc);


-- ===========================================================================
-- 4. BOTH ARE APPEND-ONLY
--
-- Enforced by the database rather than by the route that writes them, because
-- a rule living only in application code is bypassed by the next route
-- somebody writes — which is the reasoning migration 005 was built on and it
-- has not stopped being true.
-- ===========================================================================

create or replace function admission_record_immutable() returns trigger
language plpgsql
as $$
begin
  raise exception
    'the admission record is append-only: a decision is changed by recording the next one, not by editing this';
end;
$$;

drop trigger if exists admission_decisions_no_change on admission_decisions;
create trigger admission_decisions_no_change
  before update or delete on admission_decisions
  for each row execute function admission_record_immutable();

drop trigger if exists admission_audit_log_no_change on admission_audit_log;
create trigger admission_audit_log_no_change
  before update or delete on admission_audit_log
  for each row execute function admission_record_immutable();


-- ===========================================================================
-- 5. A STUDENT NUMBER TWO APPROVALS CANNOT COLLIDE ON
--
-- It was derived by reading the highest existing number and adding one. Two
-- approvals a few milliseconds apart read the same highest number and compute
-- the same next one; the loser fails on the unique index and the Head of
-- Academic Affairs sees an error on a decision they have already taken.
--
-- A counter row per intake year, incremented inside the statement that reads
-- it, so the database serialises them. `returning` gives the caller the number
-- it just reserved and nobody else can have.
-- ===========================================================================

create table if not exists student_number_counters (
  year        integer primary key,
  next_value  integer not null default 1
);

create or replace function reserve_student_number(p_year integer) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  seq integer;
begin
  insert into student_number_counters (year, next_value)
  values (p_year, 2)
  on conflict (year) do update set next_value = student_number_counters.next_value + 1
  returning next_value - 1 into seq;

  return 'ICOF' || p_year::text || lpad(seq::text, 5, '0');
end;
$$;

-- Start each year's counter above anything already issued, so running this on
-- a database with students in it does not reissue a number somebody holds.
do $$
declare
  r record;
begin
  for r in
    select substring(student_number from 5 for 4)::int as yr,
           max(substring(student_number from 9)::int) as top
    from students
    where student_number ~ '^ICOF[0-9]{4}[0-9]{5}$'
    group by 1
  loop
    insert into student_number_counters (year, next_value)
    values (r.yr, r.top + 1)
    on conflict (year) do update
      set next_value = greatest(student_number_counters.next_value, excluded.next_value);
  end loop;
end $$;


-- ===========================================================================
-- 6. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  app uuid;
  dec uuid;
  refused boolean;
  n1 text;
  n2 text;
begin
  -- matric_no is NOT NULL on this table, so the proof row carries one. It is
  -- deleted at the foot of this block; nothing here survives the migration.
  insert into students (first_name, last_name, matric_no, email, status)
  values ('Proof', '024', 'PROOF-024', 'proof-024@iguc.net', 'fee_paid')
  returning id into app;

  -- ---- A decision can be recorded --------------------------------------
  insert into admission_decisions
    (application_id, decision, decided_by_email, decided_by_role, previous_status, new_status)
  values (app, 'approve', 'proof-024@iguc.net', 'academic-office', 'fee_paid', 'approved')
  returning id into dec;

  insert into admission_audit_log (application_id, decision_id, event, actor_email, actor_role)
  values (app, dec, 'ACADEMIC_APPROVED', 'proof-024@iguc.net', 'academic-office');

  -- ---- AND NEITHER CAN BE REWRITTEN ------------------------------------
  refused := false;
  begin
    update admission_decisions set decision = 'reject' where id = dec;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '024 FAILED: an academic decision was edited after the fact';
  end if;

  refused := false;
  begin
    delete from admission_audit_log where application_id = app;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '024 FAILED: an audit entry was deleted';
  end if;

  -- ---- AN OVERRIDE MUST SAY WHY ----------------------------------------
  refused := false;
  begin
    insert into admission_decisions
      (application_id, decision, decision_type, is_override, override_of)
    values (app, 'approve', 'administrative-override', true, 'academic-office');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '024 FAILED: an administrative override was accepted with no reason';
  end if;

  -- …and is accepted when it does.
  insert into admission_decisions
    (application_id, decision, decision_type, is_override, override_of, override_reason,
     decided_by_email, decided_by_role)
  values (app, 'approve', 'administrative-override', true, 'academic-office',
          'Head of Academic Affairs unreachable and the intake closes tomorrow.',
          'superadmin@iguc.net', 'superadmin');

  -- ---- TWO NUMBERS RESERVED IN A ROW ARE DIFFERENT ---------------------
  -- The fault the old read-the-maximum-and-add-one approach had: two approvals
  -- at the same moment read the same maximum.
  n1 := reserve_student_number(2026);
  n2 := reserve_student_number(2026);
  if n1 = n2 then
    raise exception '024 FAILED: the same student number was reserved twice (%)', n1;
  end if;
  if n1 !~ '^ICOF2026[0-9]{5}$' then
    raise exception '024 FAILED: the student number is not in the University format (%)', n1;
  end if;

  -- Clear the proof. Both trails refuse a delete, so the triggers come off for
  -- the length of these statements — done here in the open because that is
  -- exactly the manoeuvre the triggers exist to make visible.
  alter table admission_audit_log disable trigger admission_audit_log_no_change;
  alter table admission_decisions disable trigger admission_decisions_no_change;
  delete from admission_audit_log where application_id = app;
  delete from admission_decisions where application_id = app;
  alter table admission_decisions enable trigger admission_decisions_no_change;
  alter table admission_audit_log enable trigger admission_audit_log_no_change;
  delete from students where id = app;
  delete from student_number_counters where year = 2026 and next_value <= 3;

  raise notice '024 OK — a decision is recorded and cannot be rewritten, an override must say '
               'why, and two student numbers reserved in succession differ.';
end $$;


-- ===========================================================================
-- 7. RLS
--
-- Staff read both. Only the service role writes, through the one decision
-- route, which is guarded by capability.
-- ===========================================================================

alter table admission_decisions enable row level security;
alter table admission_audit_log enable row level security;
alter table admission_states enable row level security;
alter table student_number_counters enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'admission_decisions'
                   and policyname = 'staff read admission decisions') then
    create policy "staff read admission decisions" on admission_decisions
      for select using (auth_role() is not null and auth_role() <> 'student');
  end if;

  if not exists (select 1 from pg_policies where tablename = 'admission_audit_log'
                   and policyname = 'staff read the admission audit log') then
    create policy "staff read the admission audit log" on admission_audit_log
      for select using (auth_role() is not null and auth_role() <> 'student');
  end if;

  -- The state list is what the applicant's own progress bar is labelled from,
  -- so it is readable by anyone. It contains no personal data at all.
  if not exists (select 1 from pg_policies where tablename = 'admission_states'
                   and policyname = 'admission states are public') then
    create policy "admission states are public" on admission_states for select using (true);
  end if;
end $$;
-- student_number_counters gets NO policy: RLS on with none is unreadable and
-- unwritable through the publishable key by construction. Only
-- reserve_student_number(), which is security definer, touches it.


-- ===========================================================================
-- 8. VERIFY
-- ===========================================================================

select stage, count(*) as states from admission_states group by stage order by min(sort_order);

-- Every academic decision the University has taken, most recent first.
select d.decision_date, d.decision, d.decided_by_email, d.decided_by_role,
       d.is_override, d.override_reason, s.first_name, s.last_name
from admission_decisions d
join students s on s.id = d.application_id
order by d.decision_date desc
limit 50;


-- ===========================================================================
-- ===========================================================================
--
--   025_state_vocabulary_and_authority.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 025 — THE STATE LIST IS THE SOFTWARE'S; THE DECISIONS ARE THE UNIVERSITY'S
--
-- Run after 024. Idempotent; destroys nothing.
--
-- ---------------------------------------------------------------------------
-- THE DISTINCTION THIS MIGRATION ENFORCES
-- ---------------------------------------------------------------------------
--
-- The University drew the line and it is the right one:
--
--   REFERENCE VOCABULARY is controlled by the software. `admission_states` is
--   a list of identifiers the application branches on. Somebody renaming
--   `ready_for_academic_review` to `Waiting for Academic Decision` in the SQL
--   editor breaks every filter, report, permission check and screen that names
--   it — silently, and not at the moment they do it.
--
--   INSTITUTIONAL DECISIONS are controlled by the officers who hold them. Which
--   programmes are open, and who was admitted, are the University's to change
--   and the software's to record.
--
-- 024 seeded the states with `on conflict do update`, which already made the
-- seed authoritative — an edit was silently reverted on the next migration run.
-- Silently is the problem. This refuses the edit at the moment it is attempted,
-- with a message saying why, instead of letting somebody believe it worked for
-- a fortnight.
--
-- ---------------------------------------------------------------------------
-- AND THE PART THAT MUST STAY EDITABLE
-- ---------------------------------------------------------------------------
--
-- The University asked for the split, and it is the reason the lock is on the
-- code and not on the row:
--
--   code   ready_for_academic_review    the application branches on this
--   label  Ready for Academic Review    the reader sees this
--
-- So the wording CAN be changed — to "Awaiting Academic Decision", or into
-- French — without touching a line of application code, and the identifier
-- cannot. A lock over the whole row would have made the labels unusable, which
-- is the opposite of what the split is for.
-- ===========================================================================


-- ===========================================================================
-- 1. THE LABEL, BESIDE THE CODE
--
-- 024 carried `applicant_label` — what the APPLICANT is told, which is
-- deliberately vaguer than the truth (an applicant is shown "Under academic
-- review" for four internal states). What was missing is the staff-facing
-- label: the words the Head of Academic Affairs' own queue should show.
-- ===========================================================================

alter table admission_states add column if not exists label text;

update admission_states set label = coalesce(label, initcap(replace(state, '_', ' ')));

-- The University's own wording, where it differs from a mechanical prettifier.
-- `conditional` and `applicant` keep their CODES — those are live values in the
-- students table and renaming a status in service is a data migration with
-- nothing to gain — and take the labels the University actually uses.
update admission_states set label = v.label from (values
  ('draft',                     'Draft'),
  ('applicant',                 'Submitted'),
  ('under_review',              'Under Review'),
  ('documents_required',        'Documents Required'),
  ('documents_verified',        'Documents Verified'),
  ('fee_pending',               'Fee Pending'),
  ('fee_paid',                  'Fee Cleared'),
  ('ready_for_academic_review', 'Ready for Academic Review'),
  ('approved',                  'Approved'),
  ('conditional',               'Conditionally Approved'),
  ('returned',                  'Returned for Correction'),
  ('rejected',                  'Rejected'),
  ('admission_issued',          'Admission Issued'),
  ('enrolled',                  'Enrolled'),
  ('withdrawn',                 'Withdrawn')
) as v(state, label) where admission_states.state = v.state;

alter table admission_states alter column label set not null;


-- ===========================================================================
-- 2. THE CODE AND THE STAGE ARE THE SOFTWARE'S
--
-- Refused at the moment of the edit rather than reverted on the next migration.
-- The labels are untouched by this — changing them is the whole point of
-- keeping them separate from the code.
-- ===========================================================================

create or replace function admission_states_code_is_software() returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception
      'admission_states is the software''s vocabulary: % cannot be deleted, because the application branches on it', old.state;
  end if;
  if tg_op = 'INSERT' then
    raise exception
      'a new admission state is a code change, not a row: add it to src/lib/admissionWorkflow.ts and a migration, so the application and the database learn it together';
  end if;
  if new.state is distinct from old.state then
    raise exception
      'the state code % cannot be renamed — every filter, report and permission check names it. Change `label` instead, which is what the reader sees.', old.state;
  end if;
  if new.stage is distinct from old.stage then
    raise exception
      'the stage of % is part of the workflow, not presentation, and cannot be edited here', old.state;
  end if;
  return new;
end;
$$;

drop trigger if exists admission_states_locked on admission_states;
-- The migration itself must be able to seed and correct rows, so the trigger is
-- dropped and recreated around the seed in section 1 rather than fighting it —
-- see the ordering: this is created AFTER the updates above.
create trigger admission_states_locked
  before insert or update or delete on admission_states
  for each row execute function admission_states_code_is_software();


-- ===========================================================================
-- 3. THE AUDIT RECORDS AUTHORITY, NOT ONLY THE PERSON
--
-- The University's point: `decided_by = 12345` says a user acted. What an audit
-- has to establish is that the HEAD OF ACADEMIC AFFAIRS, ACTING UNDER THE
-- ACADEMIC AFFAIRS AUTHORITY, moved this application from
-- ready_for_academic_review to approved at a stated time, for a stated reason.
--
-- The person, the role and the office are three different facts. A person holds
-- a role; a role exercises an office's authority; and when the
-- Superadministrator acts in Academic Affairs' place the person and the office
-- are deliberately not the same, which is exactly the case an audit exists for.
-- ===========================================================================

alter table admission_audit_log add column if not exists actor_office text;
alter table admission_audit_log add column if not exists previous_state text;
alter table admission_audit_log add column if not exists new_state text;
alter table admission_audit_log add column if not exists reason text;
-- Anything the event needs that is not worth a column: the student number
-- reserved, the SMTP failure, the size of the package. jsonb rather than more
-- columns so a new event does not need a migration.
alter table admission_audit_log add column if not exists metadata jsonb;

create index if not exists admission_audit_log_office_idx on admission_audit_log (actor_office, at desc);


-- ===========================================================================
-- 4. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  lbl text;
begin
  -- ---- THE CODE CANNOT BE RENAMED --------------------------------------
  refused := false;
  begin
    update admission_states set state = 'waiting_for_academic_decision'
     where state = 'ready_for_academic_review';
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '025 FAILED: a state code was renamed';
  end if;

  -- ---- NOR DELETED, NOR ADDED BY HAND ----------------------------------
  refused := false;
  begin
    delete from admission_states where state = 'approved';
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '025 FAILED: a state was deleted';
  end if;

  refused := false;
  begin
    insert into admission_states (state, stage, applicant_label, label, sort_order)
    values ('invented_state', 'academic', 'x', 'x', 999);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '025 FAILED: a state was invented in the database';
  end if;

  -- ---- BUT THE LABEL IS THE UNIVERSITY'S TO WORD -----------------------
  -- The whole reason the code and the label are separate columns.
  update admission_states set label = 'Awaiting Academic Decision'
   where state = 'ready_for_academic_review';
  select label into lbl from admission_states where state = 'ready_for_academic_review';
  if lbl <> 'Awaiting Academic Decision' then
    raise exception '025 FAILED: the label could not be changed, which defeats the split';
  end if;
  -- Put it back, so the migration leaves the University's wording in place.
  update admission_states set label = 'Ready for Academic Review'
   where state = 'ready_for_academic_review';

  -- ---- THE AUDIT CAN NAME THE OFFICE AND BOTH STATES -------------------
  perform 1 from information_schema.columns
   where table_name = 'admission_audit_log'
     and column_name in ('actor_office', 'previous_state', 'new_state', 'metadata');
  if not found then
    raise exception '025 FAILED: the audit log cannot record the authority behind an event';
  end if;

  raise notice '025 OK — a state code cannot be renamed, deleted or invented, its label can be '
               'reworded, and the audit log records the office as well as the person.';
end $$;


-- ===========================================================================
-- 5. VERIFY
-- ===========================================================================

select state as code, label, applicant_label, stage
from admission_states order by sort_order;


-- ===========================================================================
-- ===========================================================================
--
--   026_issuance_is_not_the_decision.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 026 — "THE HEAD APPROVED" AND "THE UNIVERSITY ISSUED" ARE TWO EVENTS
--
-- Run after 025. Idempotent; destroys nothing. Safe on a live database.
--
-- ---------------------------------------------------------------------------
-- WHY
-- ---------------------------------------------------------------------------
--
-- The University put it exactly: `approved` was carrying two different facts.
--
--   The Head of Academic Affairs approved this applicant.
--   The University successfully completed the issuance of their admission.
--
-- Those are not the same event and they can come apart. The decision is
-- recorded first, on purpose — it is the fact everything else follows from —
-- and then a package is generated, a number reserved, an account created. Any
-- of those can fail. When one does, `approved` is true and misleading: the
-- decision stands, and nothing was issued.
--
-- Three states rather than one:
--
--   approved                     the academic decision, and only that
--   admission_processing         issuance is under way
--   admission_processing_failed  issuance stopped part way; recoverable
--   admission_issued             the package exists and the account behind it
--
-- ---------------------------------------------------------------------------
-- WHAT THIS MAKES POSSIBLE, WHICH IS THE POINT
-- ---------------------------------------------------------------------------
--
-- A RETRY THAT IS NOT SOMEBODY EDITING ROWS. Before this, an issuance that
-- died after the letter was generated left `approved` — indistinguishable from
-- one that had not started — and the only way back was to alter the status by
-- hand in the SQL editor. `admission_processing_failed` is a state the desk can
-- see, name, and offer a button for.
--
-- The decision is NOT re-taken on retry. It was validly taken the first time
-- and it is immutable; retrying resumes the issuance under the decision that
-- already exists, which is why the audit trail shows one approval and two
-- issuance attempts rather than two approvals.
-- ===========================================================================


-- ===========================================================================
-- 1. THE TWO NEW STATES
--
-- The trigger from 025 refuses INSERT into admission_states, on the grounds
-- that a new state is a code change and not a row. This IS the code change —
-- the states are added to src/lib/admissionWorkflow.ts in the same commit — so
-- the trigger comes off for exactly these two inserts and goes straight back.
-- Done in the open, in a migration, which is the only place it should happen.
-- ===========================================================================

do $$
begin
  alter table admission_states disable trigger admission_states_locked;

  insert into admission_states (state, stage, applicant_label, label, sort_order) values
    ('admission_processing',        'issuance', 'Admission approved', 'Issuing…',              125),
    ('admission_processing_failed', 'issuance', 'Admission approved', 'Issuance failed — retry', 126)
  on conflict (state) do update
    set stage = excluded.stage,
        applicant_label = excluded.applicant_label,
        label = excluded.label,
        sort_order = excluded.sort_order;

  -- THE APPLICANT IS TOLD "Admission approved" FOR BOTH, and that is deliberate
  -- rather than lazy. The academic decision in their favour has been taken and
  -- is not in doubt; that an internal step has to be retried is the
  -- University's problem to solve, not news to break to the applicant while it
  -- is being solved. The staff-facing labels below say precisely what happened.
  alter table admission_states enable trigger admission_states_locked;
end $$;


-- ===========================================================================
-- 2. THE EVENTS THAT DESCRIBE AN ISSUANCE ATTEMPT
-- ===========================================================================

do $$
declare
  con text;
begin
  select conname into con from pg_constraint
   where conrelid = 'admission_audit_log'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%ACADEMIC_APPROVED%';
  if con is not null then
    execute format('alter table admission_audit_log drop constraint %I', con);
  end if;

  alter table admission_audit_log add constraint admission_audit_log_event_check
    check (event in (
      'APPLICATION_SUBMITTED', 'DOCUMENT_VERIFIED', 'FEE_CONFIRMED',
      'ACADEMIC_REVIEW_STARTED', 'ACADEMIC_APPROVED',
      'ACADEMIC_CONDITIONALLY_APPROVED', 'ACADEMIC_REJECTED', 'ACADEMIC_RETURNED',
      'ISSUANCE_STARTED', 'ISSUANCE_FAILED', 'ISSUANCE_RETRIED',
      'ADMISSION_LETTER_GENERATED', 'ADMISSION_PACKAGE_ISSUED',
      'ACCOUNT_CREATED', 'WELCOME_EMAIL_SENT', 'WELCOME_EMAIL_FAILED',
      'ENROLLED', 'ADMINISTRATIVE_OVERRIDE'
    ));
end $$;


-- ===========================================================================
-- 3. PERFORMING THE RULES
-- ===========================================================================

-- The proof runs inside a plpgsql sub-block, which is a savepoint: raising at
-- the end rolls every row below back and leaves nothing behind. An explicit
-- `begin; … rollback;` would do the same and cannot be used — a file carrying
-- its own transaction cannot be safely concatenated into RUN-ALL.sql, and
-- scripts/build-migration-run.mjs refuses to build one that does. That refusal
-- is right: the second file's statements would end up inside the first file's
-- transaction, and a failure in the last would roll back the first.

do $$
declare
  app uuid;
  dec uuid;
  refused boolean;
begin
 begin
  -- FIRST, THAT THE STATES ARE ACTUALLY THERE. The earlier version of this
  -- proof wrote 'admission_processing' into students.status and declared
  -- success — but that column carries no CHECK constraint, so it accepts any
  -- string at all. The proof passed on a run where the INSERT above had failed
  -- and neither state existed. A test that cannot fail is not a test.
  if (select count(*) from admission_states
      where state in ('admission_processing', 'admission_processing_failed')) <> 2 then
    raise exception '026 FAILED: the two issuance states were not added to the vocabulary';
  end if;

  insert into students (first_name, last_name, matric_no, email, status)
  values ('Proof', '026', 'PROOF-026', 'proof-026@iguc.net', 'ready_for_academic_review')
  returning id into app;

  -- ---- A DECISION IS TAKEN, AND ISSUANCE THEN FAILS --------------------
  insert into admission_decisions
    (application_id, decision, decided_by_role, previous_status, new_status)
  values (app, 'approve', 'academic-office', 'ready_for_academic_review', 'approved')
  returning id into dec;

  insert into admission_audit_log (application_id, decision_id, event, actor_office, new_state)
  values (app, dec, 'ISSUANCE_STARTED', 'Office of Academic Affairs', 'admission_processing');
  update students set status = 'admission_processing' where id = app;

  insert into admission_audit_log
    (application_id, decision_id, event, actor_office, previous_state, new_state, detail)
  values (app, dec, 'ISSUANCE_FAILED', 'Office of Academic Affairs',
          'admission_processing', 'admission_processing_failed',
          'the account could not be created');
  update students set status = 'admission_processing_failed' where id = app;

  -- THE STATE THE UNIVERSITY ASKED FOR. The decision stands, the admission was
  -- not issued, and the two are distinguishable — which they were not when both
  -- were called `approved`.
  if (select status from students where id = app) <> 'admission_processing_failed' then
    raise exception '026 FAILED: a failed issuance is not distinguishable from an untouched approval';
  end if;
  if not exists (select 1 from admission_decisions where application_id = app and decision = 'approve') then
    raise exception '026 FAILED: the decision was lost with the failed issuance';
  end if;

  -- ---- THE RETRY DOES NOT TAKE THE DECISION AGAIN ----------------------
  insert into admission_audit_log (application_id, decision_id, event, actor_office, previous_state, new_state)
  values (app, dec, 'ISSUANCE_RETRIED', 'Office of Academic Affairs',
          'admission_processing_failed', 'admission_processing');
  update students set status = 'admission_issued' where id = app;

  if (select count(*) from admission_decisions where application_id = app) <> 1 then
    raise exception '026 FAILED: retrying the issuance recorded a second academic decision';
  end if;

  -- ---- AND THE STATE LIST IS STILL THE SOFTWARE'S ----------------------
  refused := false;
  begin
    insert into admission_states (state, stage, applicant_label, label, sort_order)
    values ('invented', 'issuance', 'x', 'x', 999);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '026 FAILED: the state vocabulary was left unlocked';
  end if;

  raise exception 'PROOF_ROLLBACK';
 exception when others then
   -- Anything that is not the sentinel is a real failure and must not be eaten.
   if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
 end;

 raise notice '026 OK — a failed issuance is its own state, the decision survives it, a retry '
              'does not re-decide, and the vocabulary is still locked.';
end $$;


-- ===========================================================================
-- 4. VERIFY
-- ===========================================================================

select state as code, label, applicant_label, stage
from admission_states where stage = 'issuance' order by sort_order;

-- Anything stuck part way through issuance. Empty is the healthy answer; a row
-- here is an admission the Head approved and the University did not issue, and
-- it is retried from the Admissions approval desk, not from this editor.
select s.student_number, s.first_name, s.last_name, s.status, s.program
from students s
where s.status in ('approved', 'admission_processing', 'admission_processing_failed')
order by s.decided_at desc nulls last;


-- ===========================================================================
-- ===========================================================================
--
--   027_the_states_the_pipeline_already_wrote.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 027 — THE THREE STATES THE PIPELINE ALREADY WROTE AND NOBODY HAD DECLARED
--
-- Run after 026. Idempotent; destroys nothing. Safe on a live database.
--
-- ---------------------------------------------------------------------------
-- WHY
-- ---------------------------------------------------------------------------
--
-- The University asked why some applications were completely invisible in the
-- administration portal. Nothing had been deleted and no policy was refusing
-- the read: the rows were there, and no screen asked for them.
--
-- Every desk carried its own hand-written list of statuses in its own query —
-- six lists, in four files, none able to see the others, all written before
-- 023–026 widened the vocabulary. A state on no list is a record that exists
-- and that nothing fetches.
--
-- It was not a corner case. ALL FOUR of the Head of Academic Affairs' outcomes
-- fell through: approve produces `admission_issued`, reject produces
-- `rejected`, and the panel meant to show decided applications was looking for
-- `approved` and `declined`. The office took a decision and the application
-- left every admissions screen in the system.
--
-- The queues are fixed in the application, where they belong — they read from
-- ADMISSION_DESKS in src/lib/admissionWorkflow.ts, and admissionDesks.test.mjs
-- fails if a state lands on no desk. This migration is the database's half.
--
-- ---------------------------------------------------------------------------
-- WHAT THE DATABASE'S HALF IS
-- ---------------------------------------------------------------------------
--
-- THREE STATES THAT WERE ALWAYS LIVE AND WERE NEVER DECLARED. `registrar_
-- approved`, `declined` and `deferred` are written by src/lib/admissions.ts
-- and have been since the first pipeline. They were absent from
-- admission_states, which meant the vocabulary was not the vocabulary — and
-- because `students.status` carries no CHECK constraint, nothing ever said so.
--
-- They keep their existing spellings. `declined` is the REGISTRAR refusing at
-- verification and `rejected` is the HEAD OF ACADEMIC AFFAIRS refusing on
-- academic grounds; folding one into the other would lose which office
-- refused, which is the first thing anybody re-reading a refusal asks.
--
-- AND A VIEW THAT MAKES THE NEXT ONE LOUD. `admission_status_coverage` reports
-- every distinct status actually present in `students`, how many records hold
-- it, and whether the vocabulary knows it. A status nobody declared now shows
-- up as a row with a count against it instead of as an empty queue.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES NOT DO, AND WHY
-- ---------------------------------------------------------------------------
--
-- IT DOES NOT CONSTRAIN `students.status`. A CHECK or a foreign key to
-- admission_states would be the obvious move and it would be wrong: that
-- column carries the ENROLLED STUDENT statuses too — `active`, `graduated`,
-- `suspended`, `deferred` — which are not admission states and have their own
-- list in src/lib/constants.ts. Constraining it to the admission vocabulary
-- would refuse writes on the student register.
--
-- That overlap is a real design fault and it is not this migration's to fix.
-- Separating an application's state from a student's standing is a schema
-- change with a data migration behind it, and it is the University's call.
-- The view is the honest interim: it cannot prevent the mess, it can only
-- refuse to hide it.
-- ===========================================================================


-- ===========================================================================
-- 1. THE THREE STATES
--
-- The trigger from 025 refuses INSERT into admission_states, on the grounds
-- that a new state is a code change and not a row. This IS the code change —
-- they are added to src/lib/admissionWorkflow.ts in the same commit — so the
-- trigger comes off for exactly these three inserts and goes straight back.
-- ===========================================================================

do $$
begin
  alter table admission_states disable trigger admission_states_locked;

  insert into admission_states (state, stage, applicant_label, label, sort_order) values
    ('registrar_approved', 'verification', 'Under academic review',
     'Verified — with the Admissions Office', 75),
    ('declined',           'closed',       'Application unsuccessful',
     'Declined by the Registrar',            121),
    ('deferred',           'closed',       'Deferred to a later intake',
     'Deferred',                             122)
  on conflict (state) do update
    set stage = excluded.stage,
        applicant_label = excluded.applicant_label,
        label = excluded.label,
        sort_order = excluded.sort_order;

  -- `deferred` IS NOT A REFUSAL and its labels say so. The applicant is not
  -- being considered for this intake and has to be told that; what they must
  -- not be told is that they were turned down, because they were not.
  alter table admission_states enable trigger admission_states_locked;
end $$;


-- ===========================================================================
-- 2. THE VIEW THAT MAKES AN UNDECLARED STATUS VISIBLE
--
-- The whole defect was a silence: a status no query named produced an empty
-- list, and an empty list is indistinguishable from no applications. This is
-- the one place that can tell the difference, because it starts from what is
-- in the table rather than from what somebody remembered to ask for.
-- ===========================================================================

create or replace view admission_status_coverage as
select
  s.status,
  count(*)                                as records,
  (a.state is not null)                   as in_vocabulary,
  a.stage,
  a.label
from students s
left join admission_states a on a.state = s.status
group by s.status, a.state, a.stage, a.label
order by (a.state is not null), count(*) desc;

comment on view admission_status_coverage is
  'Every status actually present in students, and whether admission_states '
  'declares it. Rows with in_vocabulary = false are records the admissions '
  'screens may not be able to show. Note that the enrolled-student statuses '
  '(active, graduated, suspended) legitimately appear as false: students.status '
  'carries both vocabularies.';


-- ===========================================================================
-- 3. PERFORMING THE RULES
-- ===========================================================================

-- The proof runs inside a plpgsql sub-block, which is a savepoint: raising at
-- the end rolls every row below back and leaves nothing behind. An explicit
-- `begin; … rollback;` cannot be used — a file carrying its own transaction
-- cannot be safely concatenated into RUN-ALL.sql, and
-- scripts/build-migration-run.mjs refuses to build one that does.

do $$
declare
  app uuid;
  refused boolean;
  seen boolean;
begin
 begin
  -- FIRST, THAT THE STATES ARE ACTUALLY THERE. Writing one into students.status
  -- and reading it back would prove nothing: that column has no CHECK
  -- constraint and accepts any string at all. 026 shipped with a proof that
  -- passed on a run where its INSERT had failed. This one reads the vocabulary.
  if (select count(*) from admission_states
      where state in ('registrar_approved', 'declined', 'deferred')) <> 3 then
    raise exception '027 FAILED: the three legacy states were not added to the vocabulary';
  end if;

  -- AND THAT THEY DID NOT LAND ON TOP OF ANYTHING. `declined` and `rejected`
  -- are two different offices refusing and must stay distinguishable.
  if (select label from admission_states where state = 'declined')
     = (select label from admission_states where state = 'rejected') then
    raise exception '027 FAILED: the Registrar''s refusal and the academic refusal read alike';
  end if;

  -- ---- THE VIEW SEES A STATUS NOBODY DECLARED --------------------------
  -- ---------------------------------------------------------------------
  -- THE CONSTRAINT 037 ADDS HAS TO COME OFF FOR THIS ONE INSERT.
  --
  -- This proof writes a status nobody declared, deliberately, to watch the
  -- coverage view report it. 037 later gave `students.status` its first CHECK
  -- constraint — so on any rerun of the bundle after 037 has run, the proof
  -- that the view can SEE a stray status was refused by the rule that stops
  -- one being WRITTEN. Two correct rules, colliding.
  --
  -- The drop is inside the same block as the PROOF_ROLLBACK, and Postgres rolls
  -- DDL back with everything else, so the constraint is restored the instant
  -- this block ends. Found by running RUN-ALL.sql a second time.
  -- ---------------------------------------------------------------------
  alter table students drop constraint if exists students_status_check;

  insert into students (first_name, last_name, matric_no, email, status)
  values ('Proof', '027', 'PROOF-027', 'proof-027@iguc.net', 'a_state_nobody_declared')
  returning id into app;

  select not in_vocabulary into seen
    from admission_status_coverage where status = 'a_state_nobody_declared';
  if seen is not true then
    raise exception '027 FAILED: an undeclared status did not show up as undeclared';
  end if;

  -- …AND REPORTS A DECLARED ONE AS DECLARED, so the column above is actually
  -- discriminating rather than returning true for everything.
  update students set status = 'registrar_approved' where id = app;
  select in_vocabulary into seen
    from admission_status_coverage where status = 'registrar_approved';
  if seen is not true then
    raise exception '027 FAILED: a declared status was reported as unknown';
  end if;

  -- ---- AND THE STATE LIST IS STILL THE SOFTWARE'S ----------------------
  refused := false;
  begin
    insert into admission_states (state, stage, applicant_label, label, sort_order)
    values ('invented', 'closed', 'x', 'x', 999);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '027 FAILED: the state vocabulary was left unlocked';
  end if;

  raise exception 'PROOF_ROLLBACK';
 exception when others then
   -- Anything that is not the sentinel is a real failure and must not be eaten.
   if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
 end;

 raise notice '027 OK — the three states the pipeline writes are declared, the two refusals stay '
              'distinguishable, an undeclared status is visible, and the vocabulary is still locked.';
end $$;


-- ===========================================================================
-- 4. VERIFY
-- ===========================================================================

-- The three states, as the University's own screens will now label them.
select state as code, label, applicant_label, stage
from admission_states
where state in ('registrar_approved', 'declined', 'deferred')
order by sort_order;

-- ---------------------------------------------------------------------------
-- THE ONE TO READ. Every status actually in the table, commonest first, with
-- the undeclared ones at the top.
--
-- `active`, `graduated` and `suspended` are EXPECTED to show in_vocabulary =
-- false: they are student statuses rather than admission states and share the
-- column. Anything else showing false is an application the admissions screens
-- may not be able to display, and it should be reported rather than corrected
-- here.
-- ---------------------------------------------------------------------------
select * from admission_status_coverage;


-- ===========================================================================
-- ===========================================================================
--
--   028_student_numbers_start_above_the_existing_ones.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 028 — A RESERVED STUDENT NUMBER MUST NOT BE ONE ALREADY ISSUED
--
-- Run after 027. Idempotent; destroys nothing. Safe on a live database.
--
-- ---------------------------------------------------------------------------
-- WHY — AN ADMISSION THAT COULD NOT COMPLETE
-- ---------------------------------------------------------------------------
--
-- The University retried an issuance and it refused:
--
--   duplicate key value violates unique constraint "students_student_number_key"
--
-- reserve_student_number() keeps a counter per intake year in
-- student_number_counters, and for a year it has not seen before it starts
-- that counter at 1. It never looked at the numbers already in `students`.
--
-- Every student admitted before 024 was numbered the old way — read the
-- highest existing number for the year and add one — so by the time the
-- counter was introduced, 2026 already had students holding ICOF202600001 and
-- upwards. The first reservation of the new scheme therefore handed back a
-- number that was already on somebody's record, and the unique index correctly
-- refused it.
--
-- IT WOULD HAVE HAPPENED TO EVERY DEPLOYMENT WITH EXISTING STUDENTS, on the
-- first admission after 024, for every intake year already in use. It is not
-- specific to one application.
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES
-- ---------------------------------------------------------------------------
--
-- The counter is seeded from, and can never fall behind, the highest number
-- actually issued for that year. Two guards rather than one:
--
--   ON FIRST USE for a year, it starts above the highest existing number
--   instead of at 1.
--
--   ON EVERY USE, it takes the greater of its own counter and the highest
--   existing number. A counter that has drifted behind — because somebody
--   inserted a student by hand, or restored a backup, or ran the old code
--   path once more — corrects itself rather than colliding.
--
-- ONLY WELL-FORMED NUMBERS COUNT. The scan matches ICOF<year> followed by
-- digits and nothing else, so a legacy number in some other shape cannot make
-- the arithmetic fail. It is ignored, and the unique index remains the
-- backstop it always was.
--
-- THE CONCURRENCY PROPERTY 024 ADDED IS KEPT. The reservation is still a
-- single INSERT ... ON CONFLICT DO UPDATE ... RETURNING, so two approvals in
-- the same millisecond still take the row lock in turn and receive different
-- numbers. That was the whole point of the counter and it is not given up to
-- fix this.
-- ===========================================================================


-- ===========================================================================
-- 1. THE FUNCTION
-- ===========================================================================

create or replace function reserve_student_number(p_year integer) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  seq     integer;
  highest integer;
begin
  -- The highest number ALREADY ISSUED for this year, ignoring anything not in
  -- the ICOF<year><digits> shape. `substring(... from pattern)` returns the
  -- capture group, so this is the numeric tail and nothing else.
  select coalesce(max(substring(student_number from '^ICOF' || p_year::text || '([0-9]+)$')::integer), 0)
    into highest
    from students
   where student_number ~ ('^ICOF' || p_year::text || '[0-9]+$');

  -- `next_value` is the number to hand out next. On a first reservation for
  -- the year that is highest + 1, so the row is written one beyond it; on a
  -- later one the counter moves on, but never to below what has been issued.
  insert into student_number_counters (year, next_value)
  values (p_year, highest + 2)
  on conflict (year) do update
    set next_value = greatest(student_number_counters.next_value, highest + 1) + 1
  returning next_value - 1 into seq;

  return 'ICOF' || p_year::text || lpad(seq::text, 5, '0');
end;
$$;


-- ===========================================================================
-- 2. PERFORMING THE RULES
-- ===========================================================================

-- The proof runs inside a plpgsql sub-block, which is a savepoint: raising at
-- the end rolls every row below back and leaves nothing behind.

do $$
declare
  a text;
  b text;
  c text;
begin
 begin
  -- ---- THE EXACT FAILURE THE UNIVERSITY SAW --------------------------
  -- A student already holds the first number of the year, numbered the old
  -- way, and the counter has never been used for that year.
  insert into students (first_name, last_name, matric_no, email, student_number, status)
  values ('Proof', '028', 'PROOF-028-A', 'proof-028a@iguc.net', 'ICOF209900001', 'admission_issued');

  delete from student_number_counters where year = 2099;

  a := reserve_student_number(2099);
  if a = 'ICOF209900001' then
    raise exception '028 FAILED: reserved a number that was already issued (%)', a;
  end if;
  if a <> 'ICOF209900002' then
    raise exception '028 FAILED: expected ICOF209900002, got %', a;
  end if;

  -- And it is actually insertable, which is the only thing that matters.
  insert into students (first_name, last_name, matric_no, email, student_number, status)
  values ('Proof', '028', 'PROOF-028-B', 'proof-028b@iguc.net', a, 'admission_issued');

  -- ---- IT STILL COUNTS UP -------------------------------------------
  b := reserve_student_number(2099);
  if b <> 'ICOF209900003' then
    raise exception '028 FAILED: the counter did not advance, got %', b;
  end if;

  -- ---- A COUNTER THAT HAS DRIFTED BEHIND CORRECTS ITSELF -------------
  -- Somebody inserts a student by hand, well beyond the counter. The next
  -- reservation must step over them rather than collide.
  insert into students (first_name, last_name, matric_no, email, student_number, status)
  values ('Proof', '028', 'PROOF-028-C', 'proof-028c@iguc.net', 'ICOF209900050', 'admission_issued');

  c := reserve_student_number(2099);
  if c <> 'ICOF209900051' then
    raise exception '028 FAILED: a counter behind the register did not catch up, got %', c;
  end if;

  -- ---- A MALFORMED LEGACY NUMBER DOES NOT BREAK THE ARITHMETIC -------
  -- It is ignored rather than parsed. Before the pattern was anchored this
  -- raised invalid input syntax for integer and no number could be issued at
  -- all for the year.
  insert into students (first_name, last_name, matric_no, email, student_number, status)
  values ('Proof', '028', 'PROOF-028-D', 'proof-028d@iguc.net', 'ICOF2099/OLD/7', 'admission_issued');

  if reserve_student_number(2099) <> 'ICOF209900052' then
    raise exception '028 FAILED: a legacy number in another shape disturbed the sequence';
  end if;

  raise exception 'PROOF_ROLLBACK';
 exception when others then
   -- Anything that is not the sentinel is a real failure and must not be eaten.
   if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
 end;

 raise notice '028 OK — a reserved number starts above every number already issued, keeps '
              'counting, catches up when the counter has drifted, and ignores legacy numbers '
              'in other shapes.';
end $$;


-- ===========================================================================
-- 3. VERIFY
-- ===========================================================================

-- What each intake year has issued, and what the counter believes comes next.
-- `next_to_issue` must be greater than `highest_issued` on every row. A row
-- where it is not is a year the next admission would collide on.
select
  y.year,
  c.next_value                                   as next_to_issue,
  (select max(substring(s.student_number from '^ICOF' || y.year::text || '([0-9]+)$')::integer)
     from students s
    where s.student_number ~ ('^ICOF' || y.year::text || '[0-9]+$')) as highest_issued
from (select distinct year from student_number_counters) y
left join student_number_counters c on c.year = y.year
order by y.year;


-- ===========================================================================
-- ===========================================================================
--
--   029_the_coverage_view_is_for_operators_only.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 029 — THE STATUS COVERAGE VIEW IS AN OPERATOR'S TOOL, NOT A PUBLIC ONE
--
-- Run after 028. Idempotent; destroys nothing. Safe on a live database.
--
-- ---------------------------------------------------------------------------
-- WHY
-- ---------------------------------------------------------------------------
--
-- Supabase's own advisor flagged this, at CRITICAL, and it is right:
--
--   Security Definer View — public.admission_status_coverage
--
-- 027 added that view to answer "which statuses actually exist in the table,
-- and does the vocabulary know them?" — a question an operator asks in the SQL
-- editor while diagnosing why an application is invisible.
--
-- A Postgres view runs with its OWNER's privileges unless told otherwise, so
-- it reads `students` past that table's row-level security. That is exactly
-- what makes it useful to an operator and exactly what makes it wrong to leave
-- reachable by everybody: the view has NO `where` clause of its own, so any
-- signed-in account — a student — could read it through the API and learn the
-- shape of the University's entire admissions pipeline. Not names, but how
-- many people applied, how many were rejected, how many are stuck.
--
-- THE VIEW IS NOT THE PROBLEM; ITS AUDIENCE IS. It stays, and it is taken off
-- the public API.
--
-- ---------------------------------------------------------------------------
-- WHY exam_sessions_mine IS LEFT ALONE, THOUGH THE ADVISOR NAMES IT TOO
-- ---------------------------------------------------------------------------
--
-- That view is security-definer ON PURPOSE and must stay that way. Migration
-- 016 DROPPED the policy that let a candidate read their own row in
-- exam_sessions — because that row carries the answer key of their own paper —
-- and put this view in its place. The view carries its own gate,
-- `where st.auth_user_id = auth.uid()`, and omits the key.
--
-- So a candidate reads their sitting through the view and has no other route
-- to it. Making it security-invoker would return nothing to them and no
-- candidate could see the examination they are sitting. The advisor is
-- flagging a pattern; here the pattern is the mechanism.
--
-- The difference between the two is one line: that view filters by the caller
-- and mine did not.
-- ===========================================================================


-- ===========================================================================
-- 1. OFF THE PUBLIC API
--
-- PostgREST serves whatever `anon` and `authenticated` may select. Revoking is
-- what removes it; the view itself is untouched and still readable by the
-- service role, which is how the Readiness panel probes for 027 and how an
-- operator reads it in the SQL editor.
-- ===========================================================================

do $$
begin
  if to_regclass('public.admission_status_coverage') is null then
    raise exception '029 FAILED: admission_status_coverage is missing — run 027 first';
  end if;

  revoke all on public.admission_status_coverage from anon;
  revoke all on public.admission_status_coverage from authenticated;

  -- Stated rather than assumed. The service role is what the application's
  -- admin routes hold, and the probe in src/lib/migrationProbes.ts reads this
  -- view through it; a revoke that caught it too would turn the Readiness
  -- panel's report of 027 from "applied" into "outstanding".
  grant select on public.admission_status_coverage to service_role;
end $$;

comment on view public.admission_status_coverage is
  'OPERATORS ONLY — revoked from anon and authenticated in 029. Every status '
  'actually present in students, and whether admission_states declares it. It '
  'reads past row-level security and carries no filter of its own, so it must '
  'not be reachable through the public API. Rows with in_vocabulary = false are '
  'records the admissions screens may not be able to show; the enrolled-student '
  'statuses (active, graduated, suspended) appear there legitimately, because '
  'students.status carries both vocabularies.';


-- ===========================================================================
-- 2. PERFORMING THE RULES
-- ===========================================================================

do $$
begin
  -- THE ADVISOR'S FINDING, CHECKED RATHER THAN ASSUMED CLOSED.
  if has_table_privilege('anon', 'public.admission_status_coverage', 'SELECT') then
    raise exception '029 FAILED: anon can still read the coverage view';
  end if;
  if has_table_privilege('authenticated', 'public.admission_status_coverage', 'SELECT') then
    raise exception '029 FAILED: a signed-in account can still read the coverage view';
  end if;

  -- AND THE ONE THAT MUST STILL WORK. Revoking too widely would break the
  -- Readiness panel rather than only the leak.
  if not has_table_privilege('service_role', 'public.admission_status_coverage', 'SELECT') then
    raise exception '029 FAILED: the service role can no longer read the coverage view, so the '
                    'Readiness panel would report 027 as outstanding';
  end if;

  -- exam_sessions_mine IS DELIBERATELY UNTOUCHED. Asserted so that a future
  -- migration written to satisfy the advisor in bulk has to notice this one
  -- first: revoking it would leave candidates unable to read their own sitting.
  if to_regclass('public.exam_sessions_mine') is not null
     and not has_table_privilege('authenticated', 'public.exam_sessions_mine', 'SELECT') then
    raise exception '029 FAILED: candidates can no longer read their own examination sitting';
  end if;

  raise notice '029 OK — the coverage view is readable by the service role and by nobody else, '
               'and candidates can still read their own sitting.';
end $$;


-- ===========================================================================
-- 3. VERIFY
-- ===========================================================================

-- Who may read each of the two views the advisor named. `admission_status_
-- coverage` should be true for service_role only; `exam_sessions_mine` should
-- be true for authenticated, because that view is how a candidate reads their
-- own examination and it filters by the caller.
select
  v.view_name,
  has_table_privilege('anon',          'public.' || v.view_name, 'SELECT') as anon_may_read,
  has_table_privilege('authenticated', 'public.' || v.view_name, 'SELECT') as signed_in_may_read,
  has_table_privilege('service_role',  'public.' || v.view_name, 'SELECT') as service_role_may_read
from (values ('admission_status_coverage'), ('exam_sessions_mine')) as v(view_name)
where to_regclass('public.' || v.view_name) is not null;


-- ===========================================================================
-- ===========================================================================
--
--   030_functions_pin_their_search_path.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 030 — EVERY FUNCTION PINS ITS SEARCH PATH, AND THE ONE THAT MATTERS IS
--       TAKEN OFF THE PUBLIC API
--
-- Run after 029. Idempotent; destroys nothing. Safe on a live database.
--
-- ---------------------------------------------------------------------------
-- WHY — WHAT THE ADVISOR IS ACTUALLY WARNING ABOUT
-- ---------------------------------------------------------------------------
--
-- Supabase's advisor names two dozen functions as "Function Search Path
-- Mutable" and seven as executable by the public. Both come down to the same
-- thing: a function that does not say where it looks for the tables it names
-- can be made to look somewhere else.
--
-- A caller controls `search_path`. A function without one of its own resolves
-- `students` against whatever the caller set — so a caller who creates their
-- own `students` in a schema they control, and puts it first, has the function
-- read and write THEIR table instead of the University's. For a plain function
-- that is a bug; for a SECURITY DEFINER function, which runs with the owner's
-- privileges, it is how a caller borrows those privileges.
--
-- It is not hypothetical for this database. Every append-only guard, every
-- immutability trigger and every separation-of-duties check in these
-- migrations is a function that names tables. They are the rules; a rule that
-- can be pointed at a different table is not a rule.
--
-- ---------------------------------------------------------------------------
-- AND ONE REAL EXPOSURE, NOT A THEORETICAL ONE
-- ---------------------------------------------------------------------------
--
-- `reserve_student_number(integer)` is SECURITY DEFINER, directly callable,
-- and was executable by anon and by every signed-in account. Anybody could
-- call it in a loop and advance the University's student number counter as far
-- as they liked. Nothing would break and nothing would be stolen; the next
-- genuine admission would simply be numbered ICOF2026 09214 instead of
-- ICOF202600003, for ever, with no explanation in any record.
--
-- The application calls it with the service role. Nobody else needs it.
--
-- ---------------------------------------------------------------------------
-- WHAT IS DELIBERATELY LEFT ALONE
-- ---------------------------------------------------------------------------
--
-- `auth_role()` KEEPS ITS EXECUTE GRANT. It is called from inside the
-- row-level-security policies in 000 and 003, and a policy is evaluated as the
-- querying user — so revoking it from `authenticated` would not harden the
-- database, it would stop every member of staff reading anything at all. It
-- gets its search_path pinned like everything else, which is the part that
-- actually matters for it.
--
-- The trigger functions are revoked even though Postgres already refuses to
-- call a trigger function directly. Closing a door that is already shut costs
-- nothing and means the advisor's list reflects the database.
-- ===========================================================================


-- ===========================================================================
-- 1. EVERY FUNCTION IN public PINS ITS SEARCH PATH
--
-- Done by looping over what is actually there rather than by listing names.
-- The advisor named two dozen; a list would be right today and wrong the next
-- time somebody adds a trigger, and this is exactly the kind of rule that is
-- only worth having if it cannot be forgotten.
--
-- `public, pg_temp` with pg_temp LAST is the standard safe form: a temporary
-- table a caller creates cannot shadow a real one.
-- ===========================================================================

do $$
declare
  f record;
  n integer := 0;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public'
       and p.prokind = 'f'
       and not exists (
         select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c
          where c like 'search_path=%'
       )
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.sig);
    n := n + 1;
  end loop;
  raise notice '030 — pinned the search path on % function(s)', n;
end $$;


-- ===========================================================================
-- 2. THE NUMBER RESERVER IS THE SERVER'S ALONE
-- ===========================================================================

do $$
begin
  revoke execute on function public.reserve_student_number(integer) from public;
  revoke execute on function public.reserve_student_number(integer) from anon;
  revoke execute on function public.reserve_student_number(integer) from authenticated;
  grant  execute on function public.reserve_student_number(integer) to service_role;
end $$;

comment on function public.reserve_student_number(integer) is
  'Reserves the next student number for an intake year, above every number '
  'already issued. SERVICE ROLE ONLY — it advances a counter, so a caller who '
  'could run it could push the University''s numbering arbitrarily far forward '
  'with nothing in any record to say why. Revoked from anon and authenticated '
  'in 030.';


-- ===========================================================================
-- 3. THE TRIGGER FUNCTIONS, WHICH NOBODY CALLS DIRECTLY
-- ===========================================================================

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public'
       and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;


-- ===========================================================================
-- 4. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  unpinned integer;
  refused  boolean;
begin
 begin
  -- ---- EVERY FUNCTION IS PINNED --------------------------------------
  select count(*) into unpinned
    from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.prokind = 'f'
     and not exists (select 1 from unnest(coalesce(p.proconfig,'{}'::text[])) c
                      where c like 'search_path=%');
  if unpinned <> 0 then
    raise exception '030 FAILED: % function(s) still resolve tables against the caller''s search path', unpinned;
  end if;

  -- ---- THE RESERVER IS OFF THE PUBLIC API ----------------------------
  if has_function_privilege('anon', 'public.reserve_student_number(integer)', 'EXECUTE') then
    raise exception '030 FAILED: anon can still advance the student number counter';
  end if;
  if has_function_privilege('authenticated', 'public.reserve_student_number(integer)', 'EXECUTE') then
    raise exception '030 FAILED: a signed-in account can still advance the student number counter';
  end if;
  if not has_function_privilege('service_role', 'public.reserve_student_number(integer)', 'EXECUTE') then
    raise exception '030 FAILED: the server can no longer reserve a student number, so no admission could be issued';
  end if;

  -- ---- AND auth_role() IS STILL REACHABLE ----------------------------
  -- THE ONE THAT MUST NOT BE REVOKED. Every RLS policy in 000 and 003 calls
  -- it, and a policy runs as the querying user. Revoking it would not harden
  -- the database; it would stop every member of staff reading anything.
  if not has_function_privilege('authenticated', 'public.auth_role()', 'EXECUTE') then
    raise exception '030 FAILED: auth_role() was revoked, which breaks every row-level-security policy';
  end if;

  -- ---- THE GUARDS STILL GUARD ----------------------------------------
  -- Pinning a search path could in principle break a function that relied on
  -- resolving something outside `public`. Rather than assume, one of the
  -- rewritten triggers is made to refuse: 025's lock on the state vocabulary.
  refused := false;
  begin
    insert into admission_states (state, stage, applicant_label, label, sort_order)
    values ('invented_by_030', 'closed', 'x', 'x', 998);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '030 FAILED: the state vocabulary lock stopped refusing after its search path was pinned';
  end if;

  -- And 023's trail is still append-only.
  refused := false;
  begin
    insert into admission_opening_events (programme_code, action, actor_role)
    values ('PROOF-030', 'opened', 'academic-office');
    update admission_opening_events set action = 'closed' where programme_code = 'PROOF-030';
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '030 FAILED: the admission opening trail stopped being append-only';
  end if;

  raise exception 'PROOF_ROLLBACK';
 exception when others then
   if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
 end;

 raise notice '030 OK — every function pins its search path, the number reserver is the '
              'server''s alone, auth_role() is untouched, and the guards still refuse.';
end $$;


-- ===========================================================================
-- 5. VERIFY
-- ===========================================================================

-- Should return no rows. Each one would be a function resolving table names
-- against whatever the caller set.
select p.oid::regprocedure as function_without_a_pinned_search_path
from pg_proc p join pg_namespace s on s.oid = p.pronamespace
where s.nspname = 'public' and p.prokind = 'f'
  and not exists (select 1 from unnest(coalesce(p.proconfig,'{}'::text[])) c
                   where c like 'search_path=%');

-- Who may run the two SECURITY DEFINER functions that are callable directly.
-- reserve_student_number: service_role only. auth_role: everybody, on purpose.
select
  f.name,
  has_function_privilege('anon',          f.name, 'EXECUTE') as anon_may_run,
  has_function_privilege('authenticated', f.name, 'EXECUTE') as signed_in_may_run,
  has_function_privilege('service_role',  f.name, 'EXECUTE') as service_role_may_run
from (values
  ('public.reserve_student_number(integer)'),
  ('public.auth_role()')
) as f(name);


-- ===========================================================================
-- ===========================================================================
--
--   031_the_letters_the_university_has_issued.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 031 — THE LETTERS THE UNIVERSITY HAS ISSUED, KEPT
--
-- Run after 030. Idempotent; destroys nothing. Safe on a live database.
--
-- ---------------------------------------------------------------------------
-- WHY
-- ---------------------------------------------------------------------------
--
-- The University asked where to check the QR code in a letter it had just
-- issued, and then answered the question itself: if a letter is generated and
-- the sending fails, it should still be in some storage or outbox.
--
-- It was not. The admission package was rendered, handed to the mail server
-- and discarded. Nothing wrote it anywhere, and mail sent over SMTP leaves no
-- copy in a Sent folder — so the only copy of a document the University had
-- signed and sealed lived in the applicant's inbox. When delivery failed,
-- there was no copy at all.
--
-- ---------------------------------------------------------------------------
-- WHY A RE-RENDER IS NOT A SUBSTITUTE, THOUGH IT LOOKS LIKE ONE
-- ---------------------------------------------------------------------------
--
-- The letter can be rebuilt from the record, and while the template is
-- unchanged the rebuild is exact — the seal is an HMAC over the particulars,
-- so the same inputs give the same seal and the same QR.
--
-- That holds only until somebody edits the template. After that, rebuilding
-- produces TODAY'S letter for a student admitted last year: same facts,
-- different document, and a seal computed over the same particulars sitting
-- under wording the University never sent. The stored copy is the record of
-- what was actually issued. The rebuild is a convenience.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS MAKES POSSIBLE
-- ---------------------------------------------------------------------------
--
-- An outbox. Every letter carries the outcome of its delivery, so "was this
-- student ever actually told?" is a question with an answer, and a letter that
-- failed to send can be sent again from the copy that was made at the time
-- rather than from a fresh render.
--
-- ---------------------------------------------------------------------------
-- IT IS NOT ON THE API, AND THAT IS DELIBERATE
-- ---------------------------------------------------------------------------
--
-- Row-level security on, no policy: deny-all, reachable only by the server
-- holding the service role. These rows carry a named person's date of birth,
-- nationality and programme. This is the same posture as the audit logs and
-- the secret store, and it is why the Supabase advisor's "RLS Enabled No
-- Policy" finding is the correct state here rather than an oversight.
-- ===========================================================================


-- ===========================================================================
-- 1. THE TABLE
-- ===========================================================================

create table if not exists admission_letters (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references students(id) on delete cascade,
  student_number  text,
  to_email        text,
  /** The date the letter bears, which is what its seal was computed over. */
  issued_on       date,
  /** Whether it went out with a seal. False when CREDENTIAL_SECRET was absent. */
  sealed          boolean not null default false,
  /** The document itself, as the applicant received it. */
  html            text not null,
  delivery        text not null default 'pending'
                    check (delivery in ('pending', 'sent', 'failed')),
  /** The mail server's own words when it refused. */
  delivery_detail text,
  attempts        integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists admission_letters_application_idx
  on admission_letters (application_id, created_at desc);

-- THE OUTBOX QUERY'S INDEX. Partial, because the rows worth finding quickly
-- are the few that did not arrive, not the many that did.
create index if not exists admission_letters_undelivered_idx
  on admission_letters (created_at desc) where delivery <> 'sent';

alter table admission_letters enable row level security;

comment on table admission_letters is
  'Every admission package the University has issued, as it was issued. SERVER '
  'ONLY — row-level security is on with no policy, because these rows carry a '
  'named person''s particulars. Kept rather than re-rendered because a rebuild '
  'follows today''s template, and what was sent is what the record has to show.';


-- ===========================================================================
-- 2. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  app uuid;
  letter uuid;
  refused boolean;
begin
 begin
  insert into students (first_name, last_name, matric_no, email, status, student_number)
  values ('Proof', '031', 'PROOF-031', 'proof-031@iguc.net', 'admission_issued', 'ICOF209900931')
  returning id into app;

  -- ---- A LETTER SURVIVES A FAILED DELIVERY ---------------------------
  -- The whole point. Generated, not sent, and still here.
  insert into admission_letters
    (application_id, student_number, to_email, issued_on, sealed, html, delivery, delivery_detail, attempts)
  values (app, 'ICOF209900931', 'proof-031@iguc.net', current_date, true,
          '<html>the letter</html>', 'failed', 'the mail server refused the message', 1)
  returning id into letter;

  if (select html from admission_letters where id = letter) is null then
    raise exception '031 FAILED: the letter was not kept';
  end if;
  if (select count(*) from admission_letters where delivery <> 'sent') < 1 then
    raise exception '031 FAILED: an undelivered letter is not findable as undelivered';
  end if;

  -- ---- AND A RESEND UPDATES IT RATHER THAN LOSING IT ------------------
  update admission_letters
     set delivery = 'sent', delivery_detail = null, attempts = attempts + 1, updated_at = now()
   where id = letter;
  if (select attempts from admission_letters where id = letter) <> 2 then
    raise exception '031 FAILED: the delivery attempts were not counted';
  end if;

  -- ---- THE VOCABULARY IS CLOSED --------------------------------------
  refused := false;
  begin
    update admission_letters set delivery = 'probably' where id = letter;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '031 FAILED: delivery accepts a state nothing can act on';
  end if;

  -- ---- AND IT IS NOT ON THE PUBLIC API --------------------------------
  if not (select relrowsecurity from pg_class where relname = 'admission_letters') then
    raise exception '031 FAILED: row-level security is not enabled on a table of personal particulars';
  end if;
  if exists (select 1 from pg_policies where tablename = 'admission_letters') then
    raise exception '031 FAILED: a policy was added, so these rows are reachable from the API';
  end if;

  raise exception 'PROOF_ROLLBACK';
 exception when others then
   if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
 end;

 raise notice '031 OK — a letter survives a failed delivery, is findable as undelivered, counts '
              'its attempts, refuses an unknown delivery state, and is not on the API.';
end $$;


-- ===========================================================================
-- 3. VERIFY
-- ===========================================================================

-- THE OUTBOX. Anything here was generated and did not reach the applicant.
-- Empty is the healthy answer; a row is a student who has been admitted and
-- does not know it, and it is resent from the Admissions approval desk.
select
  l.created_at,
  l.student_number,
  l.to_email,
  l.delivery,
  l.attempts,
  l.delivery_detail
from admission_letters l
where l.delivery <> 'sent'
order by l.created_at desc;


-- ===========================================================================
-- ===========================================================================
--
--   032_forwarding_and_returning.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 032 — FORWARDING FOR AN ACADEMIC DECISION, AND RETURNING TO A NAMED OFFICE
--
-- Run after 031. Idempotent; destroys nothing. Safe on a live database.
--
-- ---------------------------------------------------------------------------
-- WHY — TWO GAPS THE UNIVERSITY'S OWN ARCHITECTURE NAMED
-- ---------------------------------------------------------------------------
--
-- THE DOORWAY INTO THE FINAL STAGE WAS NEVER BUILT. `ready_for_academic_review`
-- is the state the five-stage design puts on the Head of Academic Affairs'
-- desk, and nothing produced it. The Admissions Office admitted directly
-- through the older route, so applications reached the deciding desk only
-- through `fee_paid` and `documents_required` — the earlier pipeline's states,
-- carried by DECIDABLE_FROM as a compatibility measure. The desk worked
-- through the back door and the front door was never fitted.
--
-- The University set out the authority plainly: the Admissions Office makes an
-- academic RECOMMENDATION, and Admissions Approval is the final authority. So
-- the Admissions Office forwards with its recommendation, and the office that
-- signs the letter decides.
--
-- AND A RETURN HAD NOWHERE TO GO. There was one `returned` state, meaning
-- "sent back" without saying to whom. The final officer finding an incomplete
-- verification, a fee discrepancy or an assessment that needs correcting had
-- only one other option — rejecting an applicant who has done nothing wrong.
--
-- A return now names the office, carries a reason and a timestamp, and appears
-- on that office's own queue. The applicant is not refused; the work goes back
-- to whoever can do it.
-- ===========================================================================


-- ===========================================================================
-- 1. WHAT AN APPLICATION CARRIES
-- ===========================================================================

alter table students add column if not exists academic_recommendation text;
alter table students add column if not exists returned_to    text;
alter table students add column if not exists returned_reason text;
alter table students add column if not exists returned_at    timestamptz;
alter table students add column if not exists returned_by    uuid;

comment on column students.academic_recommendation is
  'The Admissions Office''s recommendation, carried to the deciding desk. A '
  'recommendation, never a decision: the office that signs the letter decides.';
comment on column students.returned_to is
  'The office an application was returned to from final approval. A return is '
  'not a refusal — the applicant has done nothing wrong and the work goes back '
  'to whoever can complete it.';

-- THE CLOSED LIST OF PLACES WORK CAN GO BACK TO. Three offices precede the
-- final decision and a return can only reach one of them. `finance` is here
-- because a fee discrepancy is a real reason to send an application back, and
-- it is the one case where the deciding office touches Finance at all — by
-- returning to it, never by overruling it.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'students_returned_to_check'
  ) then
    alter table students add constraint students_returned_to_check
      check (returned_to is null
             or returned_to in ('finance', 'registrar', 'admissions-office'));
  end if;
end $$;

create index if not exists students_returned_to_idx
  on students (returned_to) where returned_to is not null;


-- ===========================================================================
-- 2. THE TWO EVENTS THAT DESCRIBE THESE MOVEMENTS
-- ===========================================================================

do $$
declare
  con text;
begin
  select conname into con from pg_constraint
   where conrelid = 'admission_audit_log'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%ACADEMIC_APPROVED%';
  if con is not null then
    execute format('alter table admission_audit_log drop constraint %I', con);
  end if;

  alter table admission_audit_log add constraint admission_audit_log_event_check
    check (event in (
      'APPLICATION_SUBMITTED', 'DOCUMENT_VERIFIED', 'FEE_CONFIRMED',
      'FORWARDED_FOR_ACADEMIC_REVIEW',
      'ACADEMIC_REVIEW_STARTED', 'ACADEMIC_APPROVED',
      'ACADEMIC_CONDITIONALLY_APPROVED', 'ACADEMIC_REJECTED', 'ACADEMIC_RETURNED',
      'RETURNED_TO_OFFICE',
      'ISSUANCE_STARTED', 'ISSUANCE_FAILED', 'ISSUANCE_RETRIED',
      'ADMISSION_LETTER_GENERATED', 'ADMISSION_PACKAGE_ISSUED',
      'ACCOUNT_CREATED', 'WELCOME_EMAIL_SENT', 'WELCOME_EMAIL_FAILED',
      'ENROLLED', 'ADMINISTRATIVE_OVERRIDE'
    ));
end $$;


-- ===========================================================================
-- 3. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  app uuid;
  refused boolean;
begin
 begin
  insert into students (first_name, last_name, matric_no, email, status)
  values ('Proof', '032', 'PROOF-032', 'proof-032@iguc.net', 'registrar_approved')
  returning id into app;

  -- ---- AN APPLICATION CAN NOW REACH THE DECIDING DESK ------------------
  -- The state existed and nothing could produce it. This is the doorway.
  update students
     set status = 'ready_for_academic_review',
         academic_recommendation = 'Meets the entry requirements for the programme.'
   where id = app;
  if (select status from students where id = app) <> 'ready_for_academic_review' then
    raise exception '032 FAILED: an application cannot be forwarded for an academic decision';
  end if;

  insert into admission_audit_log (application_id, event, actor_office, previous_state, new_state)
  values (app, 'FORWARDED_FOR_ACADEMIC_REVIEW', 'Admissions Office',
          'registrar_approved', 'ready_for_academic_review');

  -- ---- AND A RETURN NAMES WHERE IT WENT --------------------------------
  update students
     set status = 'returned', returned_to = 'registrar',
         returned_reason = 'The verification is incomplete: no proof of the prior award.',
         returned_at = now()
   where id = app;

  insert into admission_audit_log (application_id, event, actor_office, previous_state, new_state, detail)
  values (app, 'RETURNED_TO_OFFICE', 'Office of Academic Affairs',
          'ready_for_academic_review', 'returned', 'returned to registrar');

  if (select returned_to from students where id = app) <> 'registrar' then
    raise exception '032 FAILED: a return does not record which office it went to';
  end if;

  -- ---- A RETURN CANNOT GO SOMEWHERE THAT IS NOT AN OFFICE --------------
  -- The whole value of naming the office is that the name means something.
  refused := false;
  begin
    update students set returned_to = 'somewhere_else' where id = app;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '032 FAILED: an application can be returned to an office that does not exist';
  end if;

  -- ---- AND THE TRAIL ACCEPTS BOTH NEW EVENTS --------------------------
  if (select count(*) from admission_audit_log
       where application_id = app
         and event in ('FORWARDED_FOR_ACADEMIC_REVIEW', 'RETURNED_TO_OFFICE')) <> 2 then
    raise exception '032 FAILED: the trail does not record forwarding and returning';
  end if;

  raise exception 'PROOF_ROLLBACK';
 exception when others then
   if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
 end;

 raise notice '032 OK — an application can be forwarded for an academic decision, returned to a '
              'named office with a reason, and neither movement can name an office that does '
              'not exist.';
end $$;


-- ===========================================================================
-- 4. VERIFY
-- ===========================================================================

-- Anything sitting with an office, waiting for that office to act on it.
-- Empty is the healthy answer.
select
  s.matric_no, s.first_name, s.last_name,
  s.returned_to as with_office, s.returned_at, s.returned_reason
from students s
where s.returned_to is not null and s.status = 'returned'
order by s.returned_at desc;


-- ===========================================================================
-- ===========================================================================
--
--   033_reevaluation.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 033 — A DECIDED APPLICATION CAN BE LOOKED AT AGAIN
--
-- Run after 032. Idempotent; destroys nothing. Safe on a live database.
--
-- ---------------------------------------------------------------------------
-- WHY
-- ---------------------------------------------------------------------------
--
-- A decision was final in the only sense that mattered to the software: once
-- taken, the application left every queue and there was no way back onto the
-- desk. New information arriving after a decision — a document that turns out
-- to be forged, a qualification that was misread, an appeal upheld — had
-- nowhere to go.
--
-- The University asked for re-evaluation, and asked for it in the right shape:
-- the OLD DECISION REMAINS IMMUTABLE. This does not edit anything. The
-- application is put back on the desk carrying its history, and whatever is
-- decided next is appended beside what was decided before, not over it.
-- admission_decisions has been append-only since 024 and already holds many
-- decisions per application, so the record shape was there; what was missing
-- was a way to legitimately reopen one.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS IS NOT
-- ---------------------------------------------------------------------------
--
-- IT IS NOT A REVERSAL, AND IT WITHDRAWS NOTHING. Reopening an application
-- whose admission was issued does not revoke the letter, close the account or
-- unsend the email. The applicant has been told they are admitted and still
-- has been. Undoing that is a different act with different consequences, and
-- it is not this one.
--
-- That is why `reopened_from` is recorded: it says what the application was
-- when somebody reopened it, so the difference between reopening a rejection
-- and reopening an issued admission is visible in the record rather than
-- inferred from dates.
-- ===========================================================================


-- ===========================================================================
-- 1. WHAT A REOPENED APPLICATION CARRIES
-- ===========================================================================

alter table students add column if not exists reopened_reason text;
alter table students add column if not exists reopened_at     timestamptz;
alter table students add column if not exists reopened_by     uuid;
alter table students add column if not exists reopened_from   text;

comment on column students.reopened_from is
  'The state the application held when it was reopened. Reopening a rejection '
  'and reopening an issued admission are different acts — in the second the '
  'applicant has already been told — and this is what makes the difference '
  'visible in the record rather than inferred from dates.';
comment on column students.reopened_reason is
  'Why it was reopened. Required by the route, because a decision put back on '
  'the desk without a stated reason is indistinguishable from one somebody '
  'simply disagreed with.';

create index if not exists students_reopened_idx
  on students (reopened_at desc) where reopened_at is not null;


-- ===========================================================================
-- 2. THE EVENT
-- ===========================================================================

do $$
declare
  con text;
begin
  select conname into con from pg_constraint
   where conrelid = 'admission_audit_log'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%ACADEMIC_APPROVED%';
  if con is not null then
    execute format('alter table admission_audit_log drop constraint %I', con);
  end if;

  alter table admission_audit_log add constraint admission_audit_log_event_check
    check (event in (
      'APPLICATION_SUBMITTED', 'DOCUMENT_VERIFIED', 'FEE_CONFIRMED',
      'FORWARDED_FOR_ACADEMIC_REVIEW',
      'ACADEMIC_REVIEW_STARTED', 'ACADEMIC_APPROVED',
      'ACADEMIC_CONDITIONALLY_APPROVED', 'ACADEMIC_REJECTED', 'ACADEMIC_RETURNED',
      'RETURNED_TO_OFFICE', 'REOPENED_FOR_REEVALUATION',
      'ISSUANCE_STARTED', 'ISSUANCE_FAILED', 'ISSUANCE_RETRIED',
      'ADMISSION_LETTER_GENERATED', 'ADMISSION_PACKAGE_ISSUED',
      'ACCOUNT_CREATED', 'WELCOME_EMAIL_SENT', 'WELCOME_EMAIL_FAILED',
      'ENROLLED', 'ADMINISTRATIVE_OVERRIDE'
    ));
end $$;


-- ===========================================================================
-- 3. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  app uuid;
  first_decision uuid;
begin
 begin
  insert into students (first_name, last_name, matric_no, email, status, student_number)
  values ('Proof', '033', 'PROOF-033', 'proof-033@iguc.net', 'admission_issued', 'ICOF209900933')
  returning id into app;

  insert into admission_decisions
    (application_id, decision, decided_by_role, previous_status, new_status)
  values (app, 'approve', 'academic-office', 'ready_for_academic_review', 'approved')
  returning id into first_decision;

  -- ---- REOPENING PUTS IT BACK ON THE DESK ------------------------------
  update students
     set status = 'ready_for_academic_review',
         reopened_from = 'admission_issued',
         reopened_reason = 'The prior award certificate has been reported as forged.',
         reopened_at = now()
   where id = app;

  insert into admission_audit_log (application_id, decision_id, event, actor_office, previous_state, new_state, detail)
  values (app, first_decision, 'REOPENED_FOR_REEVALUATION', 'Office of Academic Affairs',
          'admission_issued', 'ready_for_academic_review',
          'The prior award certificate has been reported as forged.');

  if (select status from students where id = app) <> 'ready_for_academic_review' then
    raise exception '033 FAILED: a decided application cannot be put back on the desk';
  end if;

  -- ---- AND THE FIRST DECISION IS UNTOUCHED -----------------------------
  -- The whole point. Re-evaluation appends; it does not edit.
  if not exists (
    select 1 from admission_decisions
     where id = first_decision and decision = 'approve' and new_status = 'approved'
  ) then
    raise exception '033 FAILED: reopening altered the decision that was already taken';
  end if;

  -- ---- A SECOND DECISION SITS BESIDE THE FIRST -------------------------
  insert into admission_decisions
    (application_id, decision, decided_by_role, previous_status, new_status)
  values (app, 'reject', 'academic-office', 'ready_for_academic_review', 'rejected');

  if (select count(*) from admission_decisions where application_id = app) <> 2 then
    raise exception '033 FAILED: the application does not carry both decisions';
  end if;

  -- ---- WHAT IT WAS REOPENED FROM IS ON THE RECORD ----------------------
  -- Reopening a rejection and reopening an issued admission are different
  -- acts; in the second the applicant has already been told.
  if (select reopened_from from students where id = app) <> 'admission_issued' then
    raise exception '033 FAILED: the record does not say what was reopened';
  end if;

  raise exception 'PROOF_ROLLBACK';
 exception when others then
   if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
 end;

 raise notice '033 OK — a decided application can be put back on the desk with a reason, the '
              'decision already taken is untouched, and a second decision sits beside the first '
              'rather than over it.';
end $$;


-- ===========================================================================
-- 4. VERIFY
-- ===========================================================================

-- Applications reopened for re-evaluation, and what each was reopened FROM.
-- A row showing `admission_issued` is one where the applicant has already been
-- told they were admitted — reopening did not withdraw that, and if the new
-- decision differs somebody has to tell them.
select
  s.matric_no, s.first_name, s.last_name,
  s.reopened_from, s.reopened_at, s.reopened_reason,
  (select count(*) from admission_decisions d where d.application_id = s.id) as decisions_on_record
from students s
where s.reopened_at is not null
order by s.reopened_at desc;


-- ===========================================================================
-- ===========================================================================
--
--   034_enrolment_and_withdrawal.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 034 — THE END OF THE JOURNEY, AND THE WAY OUT OF IT
--
-- Run after 033. Idempotent; destroys nothing. Safe on a live database.
--
-- ---------------------------------------------------------------------------
-- WHY — TWO STATES THAT HAVE BEEN DECLARED AND UNREACHABLE
-- ---------------------------------------------------------------------------
--
-- THE JOURNEY HAD NO END. `enrolled` has been in the vocabulary since 024 and
-- nothing could produce it. An issued admission was the last state a student
-- could reach, so the University could say it had admitted somebody and could
-- not say whether they had actually taken up the place. That is the fifth
-- stage of the five-stage design — ENROLMENT, the Registrar's — and it did not
-- exist.
--
-- The distinction is not bookkeeping. An admitted applicant who never enrols
-- is a place the University could have offered somebody else, and at present
-- they are indistinguishable from a student sitting in a lecture.
--
-- AND `withdrawn` WAS UNREACHABLE TOO. An applicant who wrote to say they no
-- longer wanted the place was recorded as DECLINED BY THE REGISTRAR — a
-- refusal, in the University's own records, of somebody who had not been
-- refused. That is wrong about who decided and wrong about what happened.
--
-- ---------------------------------------------------------------------------
-- WHAT IS DELIBERATELY NOT HERE
-- ---------------------------------------------------------------------------
--
-- Withdrawal does not revoke anything. A student who withdraws after being
-- issued an admission keeps the letter that was issued and the account that
-- was created; the register says they withdrew, and `withdrawn_from` says what
-- they withdrew from. Revoking a credential is a different act with its own
-- authority, and folding it in here would hide it.
-- ===========================================================================


-- ===========================================================================
-- 1. WHAT ENROLMENT AND WITHDRAWAL RECORD
-- ===========================================================================

alter table students add column if not exists enrolled_at      timestamptz;
alter table students add column if not exists enrolled_by      uuid;
alter table students add column if not exists withdrawn_at     timestamptz;
alter table students add column if not exists withdrawn_by     uuid;
alter table students add column if not exists withdrawn_reason text;
alter table students add column if not exists withdrawn_from   text;

comment on column students.enrolled_at is
  'When the Registrar recorded that the student took up the place. An admitted '
  'applicant who never enrols is a place that could have gone to somebody '
  'else, and without this they are indistinguishable from a student sitting in '
  'a lecture.';
comment on column students.withdrawn_from is
  'The state the applicant or student withdrew FROM. Withdrawing before a '
  'decision and withdrawing after an admission was issued are different '
  'events — in the second a letter exists and an account was created — and '
  'this is what keeps them apart in the record.';

create index if not exists students_enrolled_idx
  on students (enrolled_at desc) where enrolled_at is not null;


-- ===========================================================================
-- 2. THE EVENT
--
-- ENROLLED has been in the constraint since 024, waiting for something to emit
-- it. WITHDRAWN has not.
-- ===========================================================================

do $$
declare
  con text;
begin
  select conname into con from pg_constraint
   where conrelid = 'admission_audit_log'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%ACADEMIC_APPROVED%';
  if con is not null then
    execute format('alter table admission_audit_log drop constraint %I', con);
  end if;

  alter table admission_audit_log add constraint admission_audit_log_event_check
    check (event in (
      'APPLICATION_SUBMITTED', 'DOCUMENT_VERIFIED', 'FEE_CONFIRMED',
      'FORWARDED_FOR_ACADEMIC_REVIEW',
      'ACADEMIC_REVIEW_STARTED', 'ACADEMIC_APPROVED',
      'ACADEMIC_CONDITIONALLY_APPROVED', 'ACADEMIC_REJECTED', 'ACADEMIC_RETURNED',
      'RETURNED_TO_OFFICE', 'REOPENED_FOR_REEVALUATION',
      'ISSUANCE_STARTED', 'ISSUANCE_FAILED', 'ISSUANCE_RETRIED',
      'ADMISSION_LETTER_GENERATED', 'ADMISSION_PACKAGE_ISSUED',
      'ACCOUNT_CREATED', 'WELCOME_EMAIL_SENT', 'WELCOME_EMAIL_FAILED',
      'ENROLLED', 'WITHDRAWN', 'ADMINISTRATIVE_OVERRIDE'
    ));
end $$;


-- ===========================================================================
-- 3. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  app uuid;
begin
 begin
  insert into students (first_name, last_name, matric_no, email, status, student_number)
  values ('Proof', '034', 'PROOF-034-A', 'proof-034a@iguc.net', 'admission_issued', 'ICOF209900934')
  returning id into app;

  -- ---- THE JOURNEY CAN NOW END -----------------------------------------
  update students
     set status = 'enrolled', enrolled_at = now()
   where id = app;

  insert into admission_audit_log (application_id, event, actor_office, previous_state, new_state)
  values (app, 'ENROLLED', 'Office of the Registrar', 'admission_issued', 'enrolled');

  if (select status from students where id = app) <> 'enrolled' then
    raise exception '034 FAILED: an issued admission cannot be enrolled';
  end if;
  if (select enrolled_at from students where id = app) is null then
    raise exception '034 FAILED: enrolment records no date, so an admitted applicant who never '
                    'took up the place is still indistinguishable from a student';
  end if;

  -- ---- AND A WITHDRAWAL IS NOT A REFUSAL -------------------------------
  -- The whole point of the second half. An applicant who withdraws was
  -- recorded as DECLINED — refused, by the Registrar, in the University's own
  -- records, having not been refused by anybody.
  insert into students (first_name, last_name, matric_no, email, status)
  values ('Proof', '034', 'PROOF-034-B', 'proof-034b@iguc.net', 'ready_for_academic_review')
  returning id into app;

  update students
     set status = 'withdrawn',
         withdrawn_from = 'ready_for_academic_review',
         withdrawn_reason = 'The applicant has accepted a place elsewhere.',
         withdrawn_at = now()
   where id = app;

  insert into admission_audit_log (application_id, event, actor_office, previous_state, new_state, detail)
  values (app, 'WITHDRAWN', 'Office of the Registrar',
          'ready_for_academic_review', 'withdrawn', 'The applicant has accepted a place elsewhere.');

  if (select status from students where id = app) <> 'withdrawn' then
    raise exception '034 FAILED: an applicant cannot withdraw';
  end if;
  if (select withdrawn_from from students where id = app) <> 'ready_for_academic_review' then
    raise exception '034 FAILED: the record does not say what was withdrawn from';
  end if;
  -- AND IT IS NOT RECORDED AS A REFUSAL.
  if (select status from students where id = app) in ('declined', 'rejected') then
    raise exception '034 FAILED: a withdrawal is recorded as a refusal';
  end if;

  raise exception 'PROOF_ROLLBACK';
 exception when others then
   if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
 end;

 raise notice '034 OK — an issued admission can be enrolled with a date, an applicant can '
              'withdraw without being recorded as refused, and both say what they moved from.';
end $$;


-- ===========================================================================
-- 4. VERIFY
-- ===========================================================================

-- THE QUESTION THE UNIVERSITY COULD NOT ASK UNTIL NOW: of everybody admitted,
-- who actually took up the place? A row with no `enrolled_at` is an offer that
-- may still be open, or a place that could have gone to somebody else.
select
  s.student_number, s.first_name, s.last_name, s.program,
  s.status, s.decided_at as admitted_on, s.enrolled_at
from students s
where s.status in ('admission_issued', 'enrolled')
order by s.decided_at desc nulls last;


-- ===========================================================================
-- ===========================================================================
--
--   035_the_american_scale_and_the_new_credit_values.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 035 — THE AMERICAN GRADING SCALE, APPLIED TO EVERYTHING ALREADY ISSUED,
--       AND THE CREDIT VALUES THAT GO WITH IT.
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS. READ THIS PART.
-- ---------------------------------------------------------------------------
--
-- 1. EVERY GRADE POINT AND EVERY AVERAGE THE UNIVERSITY HOLDS IS RESTATED.
--    Not only new ones. The University has ruled that version 2 applies to past
--    transcripts too, so this re-derives `results.grade` and
--    `results.grade_point` from the marks already recorded, and recomputes every
--    row of `semester_gpas` from them. A graduate's CGPA will go UP. On the
--    36-module Bachelor of Theology record the University asked about, 3.14
--    becomes 3.43.
--
-- 2. NOBODY'S CLASSIFICATION IS INFLATED BY IT, because the classification
--    boundaries move with the scale. First Class still means an A- average; an
--    A- is simply worth 3.70 now instead of 3.33. A student who was Second Class
--    Upper yesterday is Second Class Upper today. That is the intent, and
--    section 8 proves it rather than asserting it.
--
-- 3. NOBODY WHO FAILED NOW PASSES. The American scale usually runs D- to 60 and
--    passes there. This one does not: the pass mark stays at 65 and there is no
--    D-. Moving it would have awarded credit the University never awarded, on
--    documents it has already sealed. The University asked for the points to be
--    less harsh. It did not ask to change who passed.
--
-- 4. EVERY FIGURE NOW SAYS WHICH SCALE PRODUCED IT. `semester_gpas` and
--    `results` gain `scale_version`. Until now nothing recorded it, so a 3.14 on
--    an issued transcript and a 3.43 on the screen were two unexplained numbers
--    rather than one number under two scales.
--
-- 5. WHAT MOVED IS WRITTEN DOWN. `grading_scale_restatements` keeps the before
--    and after of every figure this migration changes, with the student, the
--    term and both scale versions. A retroactive change nobody can audit is not
--    a correction; it is a rewrite.
--
-- 6. THE BACHELOR OF THEOLOGY CREDIT VALUES CHANGE. The eight courses taught in
--    two numbered parts drop to 3, the thesis rises to 20, and the course that
--    opens the degree carries 6. Six semesters of 30, 180 in the award, as
--    before. These are set on `courses` by registry code.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- It does not touch `credentials_issued`. A transcript or certificate already
-- printed, signed and handed to a graduate states a figure computed under
-- version 1, and that document is what it is. Section 9 REPORTS which issued
-- credentials now disagree with the recomputed record so the University can
-- decide what to do about each one. Reissuing somebody's degree certificate is
-- not a decision a migration gets to take.
-- ===========================================================================


-- ===========================================================================
-- 1. VERSION 2 OF THE SCALE, PUBLISHED
-- ===========================================================================
--
-- Version 1 is deactivated rather than edited or deleted. `grading_scales` has
-- a unique index over the active global scale, so the order matters: the old
-- one steps down before the new one steps up, or the insert collides.
--
-- 020 built the refusal that makes this the only way in: a published scale
-- cannot have its bands changed, only its active flag. So version 1 stays on
-- the record, exactly as it was, and anybody looking at an old transcript can
-- still see the scale it was computed under.

update grading_scales
   set is_active = false
 where name = 'University grading scale'
   and version = 1
   and is_active;

insert into grading_scales (name, version, award_kind, pass_mark, max_point, bands,
                            is_active, published_at)
select 'University grading scale', 2, null, 65, 4.00,
  '[{"grade":"A",  "points":4.00,"min":93,"max":100,"descriptor":"Excellent"},
    {"grade":"A-", "points":3.70,"min":90,"max":92, "descriptor":"Very Good"},
    {"grade":"B+", "points":3.30,"min":87,"max":89, "descriptor":"Good"},
    {"grade":"B",  "points":3.00,"min":83,"max":86, "descriptor":"Above Average"},
    {"grade":"B-", "points":2.70,"min":80,"max":82, "descriptor":"Average"},
    {"grade":"C+", "points":2.30,"min":77,"max":79, "descriptor":"Satisfactory"},
    {"grade":"C",  "points":2.00,"min":73,"max":76, "descriptor":"Satisfactory"},
    {"grade":"C-", "points":1.70,"min":70,"max":72, "descriptor":"Below Satisfactory"},
    {"grade":"D+", "points":1.30,"min":67,"max":69, "descriptor":"Pass"},
    {"grade":"D",  "points":1.00,"min":65,"max":66, "descriptor":"Pass"},
    {"grade":"F",  "points":0.00,"min":0, "max":64, "descriptor":"Fail"}]'::jsonb,
  true, now()
where not exists (
  select 1 from grading_scales where name = 'University grading scale' and version = 2
);

-- Running this a second time must not leave version 1 active again, and must
-- not leave both active. The insert above is skipped on a rerun, so activation
-- is asserted separately.
update grading_scales
   set is_active = true
 where name = 'University grading scale' and version = 2 and not is_active;


-- ===========================================================================
-- 2. ONE PLACE THAT TURNS A MARK INTO A GRADE
-- ===========================================================================
--
-- The application derives a grade from `regulations.ts`; the database had no
-- opinion at all, and simply stored whatever it was handed. That is how a
-- result row can carry a grade from one scale and a grade point from another
-- and nothing anywhere notices.
--
-- This reads the active scale out of the table, so there is one scale in the
-- system and it is the published one. Change the scale, and every later
-- computation follows without a deployment.

create or replace function grade_under_active_scale(score numeric)
returns table (grade text, points numeric)
language sql
stable
security definer
set search_path = public
as $$
  select b->>'grade', (b->>'points')::numeric
    from grading_scales s
    cross join lateral jsonb_array_elements(s.bands) as b
   where s.is_active
     and s.award_kind is null
     and score >= (b->>'min')::numeric
     and score <= (b->>'max')::numeric
   limit 1;
$$;

-- 030's rule: a function is callable by whoever needs it and nobody else. This
-- one only reads a published scale, so any signed-in account may ask it what a
-- mark is worth — that is the same information the Student Handbook prints.
revoke all on function grade_under_active_scale(numeric) from public;
grant execute on function grade_under_active_scale(numeric) to authenticated, service_role;


-- ===========================================================================
-- 3. EVERY FIGURE SAYS WHICH SCALE PRODUCED IT
-- ===========================================================================
--
-- THE GAP THIS CLOSES, AND IT IS THE ONE THAT MADE VERSION 2 DANGEROUS.
-- `semester_gpas` stored a GPA, a CGPA, credits and a basis. It did not store
-- the scale. So the day a second scale exists, every figure in the table
-- becomes ambiguous — and a registrar asked "is this 3.14 old or new?" has
-- nothing to read. The column is filled in below for every existing row.

alter table semester_gpas add column if not exists scale_version integer;
alter table results       add column if not exists scale_version integer;

comment on column semester_gpas.scale_version is
  'Which version of the University grading scale this average was computed under. '
  'NULL means it predates the column and has not been restated.';
comment on column results.scale_version is
  'Which version of the University grading scale this grade point came from.';


-- ===========================================================================
-- 4. WHAT THE RESTATEMENT MOVED
-- ===========================================================================
--
-- A retroactive change to a graduate's record is exactly the kind of thing an
-- accreditation reviewer asks about, and "the software recomputed it" is not an
-- answer. This is the answer: one row per figure that changed, with what it was,
-- what it became, and which scales those were.
--
-- APPEND-ONLY BY CONSTRUCTION. There is no update policy and no delete policy
-- on it at all, so the record of a restatement cannot be tidied away by the
-- people the restatement was about.

create table if not exists grading_scale_restatements (
  id             uuid primary key default gen_random_uuid(),

  -- 'result' — one mark's grade and grade point.
  -- 'gpa'    — one student's average for one term.
  kind           text not null check (kind in ('result', 'gpa')),

  student_id     uuid references students (id) on delete cascade,
  result_id      uuid,
  academic_year  integer,
  semester       integer,

  from_version   integer,
  to_version     integer not null,

  -- Free-shaped because a result restatement and a GPA restatement do not carry
  -- the same figures, and two half-empty column sets would be worse than one
  -- honest jsonb.
  before         jsonb not null,
  after          jsonb not null,

  restated_at    timestamptz not null default now()
);

create index if not exists grading_scale_restatements_student_idx
  on grading_scale_restatements (student_id);

alter table grading_scale_restatements enable row level security;

drop policy if exists grading_scale_restatements_read on grading_scale_restatements;
create policy grading_scale_restatements_read on grading_scale_restatements
  for select using (auth_role() in ('superadmin', 'admin', 'registrar'));

-- No insert policy. The recompute runs as the service role, which is the only
-- identity that should be writing these, and a browser that could write one
-- could fabricate a restatement that never happened.


-- ===========================================================================
-- 5. THE BACHELOR OF THEOLOGY CREDIT VALUES
-- ===========================================================================
--
-- Set by registry code, which is unique on `courses` and is what the University
-- ruled a course is called. A code names a SUBJECT, not a slot in one
-- programme, so this is deliberately not scoped to the Bachelor of Theology:
-- Bible Doctrine I is worth 3 wherever it is taught.
--
-- Courses the University has not created rows for are simply not updated. The
-- verify at the foot reports how many of the thirty-six were found, so a
-- registry that is missing half the degree says so rather than looking settled.

do $$
declare
  wanted constant jsonb :=
    '{"BIS 210":6,
      "BIS 220":3, "BIS 230":3, "BIS 250":3, "BIS 260":3,
      "RM 540":3,  "RM 550":3,  "STT 400":3, "STT 420":3,
      "RM 560":20,
      "MW 300":5,  "OTH 300":5, "CH 200":5,  "LC 110":5,  "OT 300":5,
      "MDS 720":5, "CH 300":5,  "MDS 660":5, "CED 160":5, "BIS 330":5,
      "BIS 320":5, "BL 340":5,  "STT 410":5, "MDS 650":5, "BIS 270":5,
      "BIS 280":5, "MDS 670":5, "MDS 730":5, "BIS 350":5, "CDS 100":5,
      "MW 350":5,  "MDS 820":5, "BIS 340":5, "MDS 760":5, "STT 430":5,
      "STT 450":5}'::jsonb;
  changed integer;
begin
  update courses c
     set credit_unit = (wanted->>c.code)::integer
   where wanted ? c.code
     and c.credit_unit is distinct from (wanted->>c.code)::integer;
  get diagnostics changed = row_count;
  raise notice '035: % course credit value(s) updated', changed;
end $$;


-- ===========================================================================
-- 6. RESTATING EVERY MARK
-- ===========================================================================
--
-- Only rows that actually change are written to the restatement record, so a
-- second run of this migration records nothing — which is the test of whether
-- it is idempotent, not a claim that it is.
--
-- A result with no total_score is left alone. There is nothing to re-derive
-- from, and inventing a grade for a mark nobody entered is the worst thing this
-- migration could do.

do $$
declare
  restated integer;
begin
  with recomputed as (
    select r.id,
           r.student_id,
           r.grade                  as old_grade,
           r.grade_point            as old_points,
           g.grade                  as new_grade,
           g.points                 as new_points
      from results r
      cross join lateral grade_under_active_scale(r.total_score) g
     where r.total_score is not null
  ),
  moved as (
    select * from recomputed
     where old_grade is distinct from new_grade
        or old_points is distinct from new_points
  ),
  logged as (
    insert into grading_scale_restatements
      (kind, student_id, result_id, from_version, to_version, before, after)
    select 'result', m.student_id, m.id, 1, 2,
           jsonb_build_object('grade', m.old_grade, 'grade_point', m.old_points),
           jsonb_build_object('grade', m.new_grade, 'grade_point', m.new_points)
      from moved m
    returning 1
  )
  update results r
     set grade = m.new_grade,
         grade_point = m.new_points,
         scale_version = 2
    from moved m
   where r.id = m.id;

  get diagnostics restated = row_count;
  raise notice '035: % result(s) restated under version 2', restated;
end $$;

-- Marks whose grade did not move still belong to version 2 now — an A is an A
-- on both scales at 4.00. Without this they would read as unrestated forever.
update results
   set scale_version = 2
 where total_score is not null and scale_version is distinct from 2;


-- ===========================================================================
-- 7. RECOMPUTING EVERY AVERAGE
-- ===========================================================================
--
-- THE CUMULATIVE FIGURE IS NOT AN AVERAGE OF THE SEMESTER AVERAGES. Quality
-- points over credits, cumulatively, from the beginning — the same definition
-- `src/lib/gpa.ts` computes, deliberately, because two definitions of a CGPA is
-- how an institution ends up with two CGPAs.
--
-- THE TERM COMES FROM THE ENROLMENT. A result carries a mark, not a calendar,
-- and the same course is taught to different cohorts in different years.
-- Results with no enrolment have no term and are counted as unplaceable by the
-- verify rather than being quietly dropped into somebody's first semester.

do $$
declare
  moved integer;
begin
  with marks as (
    select r.student_id,
           e.academic_year,
           e.semester,
           coalesce(r.grade_point, 0)                        as gp,
           coalesce(c.credit_unit, 0)                        as cu,
           (r.total_score >= 65)                             as passed,
           (r.status = 'approved')                           as approved
      from results r
      join enrollments e on e.id = r.enrollment_id
      join courses c     on c.id = r.course_id
     where e.academic_year is not null
       and e.semester is not null
       and r.total_score is not null
  ),
  per_term as (
    select student_id, academic_year, semester,
           sum(gp * cu)                                      as qp,
           sum(cu)                                           as attempted,
           sum(case when passed then cu else 0 end)          as earned,
           bool_and(approved)                                as all_approved
      from marks
     group by student_id, academic_year, semester
  ),
  running as (
    select p.*,
           sum(qp)        over w                             as cum_qp,
           sum(attempted) over w                             as cum_cu
      from per_term p
      window w as (partition by student_id
                   order by academic_year, semester
                   rows between unbounded preceding and current row)
  ),
  computed as (
    select student_id, academic_year, semester,
           case when attempted = 0 then 0
                else round(qp / attempted, 2) end            as gpa,
           case when cum_cu = 0 then 0
                else round(cum_qp / cum_cu, 2) end           as cgpa,
           attempted, earned,
           case when all_approved then 'approved' else 'provisional' end as basis
      from running
  ),
  logged as (
    insert into grading_scale_restatements
      (kind, student_id, academic_year, semester, from_version, to_version, before, after)
    select 'gpa', c.student_id, c.academic_year, c.semester,
           g.scale_version, 2,
           jsonb_build_object('gpa', g.gpa, 'cgpa', g.cgpa,
                              'credits_attempted', g.credits_attempted),
           jsonb_build_object('gpa', c.gpa, 'cgpa', c.cgpa,
                              'credits_attempted', c.attempted)
      from computed c
      join semester_gpas g
        on g.student_id = c.student_id
       and g.academic_year = c.academic_year
       and g.semester = c.semester
     where g.gpa is distinct from c.gpa
        or g.cgpa is distinct from c.cgpa
        or g.credits_attempted is distinct from c.attempted
    returning 1
  )
  insert into semester_gpas
    (student_id, academic_year, semester, gpa, cgpa,
     credits_attempted, credits_earned, basis, scale_version, computed_at)
  select student_id, academic_year, semester, gpa, cgpa,
         attempted, earned, basis, 2, now()
    from computed
  on conflict (student_id, academic_year, semester) do update
    set gpa = excluded.gpa,
        cgpa = excluded.cgpa,
        credits_attempted = excluded.credits_attempted,
        credits_earned = excluded.credits_earned,
        basis = excluded.basis,
        scale_version = 2,
        computed_at = now();

  get diagnostics moved = row_count;
  -- WRITTEN, NOT CHANGED. This is an upsert, so on a second run it still
  -- reports every row — the count that matters for idempotence is the
  -- restatement count above, which goes to zero.
  raise notice '035: % semester average(s) written under version 2', moved;
end $$;


-- ===========================================================================
-- 8. PERFORMING THE RULES
-- ===========================================================================
--
-- Each of these does the thing that must be refused, or asserts the thing that
-- must hold, and rolls back. A rule nobody has watched refuse anything is a
-- rule nobody has tested.

do $$
declare
  refused boolean;
  g record;
  n integer;
begin
  -- ---- The scale in force is version 2, and it is the only one ------------
  select count(*) into n from grading_scales
   where is_active and award_kind is null;
  if n <> 1 then
    raise exception '035 FAILED: % active global grading scales, expected exactly 1', n;
  end if;

  select version into n from grading_scales where is_active and award_kind is null;
  if n <> 2 then
    raise exception '035 FAILED: the active global scale is version %, expected 2', n;
  end if;

  -- ---- Version 1 is still on the record -----------------------------------
  if not exists (select 1 from grading_scales
                  where name = 'University grading scale' and version = 1) then
    raise exception '035 FAILED: version 1 has gone. A figure on an issued transcript '
                    'was computed under it and must remain explicable.';
  end if;

  -- ---- Version 2 still cannot be edited -----------------------------------
  refused := false;
  begin
    update grading_scales set pass_mark = 60
     where name = 'University grading scale' and version = 2;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '035 FAILED: the newly published scale could be edited in place';
  end if;

  -- ---- The bands do what the University said ------------------------------
  select * into g from grade_under_active_scale(93);
  if g.grade <> 'A' or g.points <> 4.00 then
    raise exception '035 FAILED: 93%% is % at %, expected A at 4.00', g.grade, g.points;
  end if;
  select * into g from grade_under_active_scale(90);
  if g.grade <> 'A-' or g.points <> 3.70 then
    raise exception '035 FAILED: 90%% is % at %, expected A- at 3.70', g.grade, g.points;
  end if;
  select * into g from grade_under_active_scale(83);
  if g.grade <> 'B' or g.points <> 3.00 then
    raise exception '035 FAILED: 83%% is % at %, expected B at 3.00', g.grade, g.points;
  end if;

  -- ---- NOBODY WHO FAILED NOW PASSES ---------------------------------------
  -- The single most consequential thing this migration could get wrong.
  select * into g from grade_under_active_scale(64);
  if g.grade <> 'F' then
    raise exception '035 FAILED: 64%% is now a %. The pass mark was not supposed to move.',
      g.grade;
  end if;
  select * into g from grade_under_active_scale(60);
  if g.grade <> 'F' then
    raise exception '035 FAILED: 60%% is now a %. The American D- band was not adopted '
                    'and must not appear.', g.grade;
  end if;
  select * into g from grade_under_active_scale(65);
  if g.grade <> 'D' then
    raise exception '035 FAILED: 65%% is %, expected D — the lowest passing grade', g.grade;
  end if;

  -- ---- AND THE CHECK ABOVE IS NOT DECORATION ------------------------------
  --
  -- A rule nobody has watched refuse anything is a rule nobody has tested. So
  -- the full American scale — D- at 60, passing at 60, which is the scale it
  -- would have been easy to adopt by copying — is published here, the check is
  -- run against it, and the whole thing is rolled back. If the check cannot see
  -- a D- when one is right in front of it, this migration stops.
  begin
    update grading_scales set is_active = false where is_active and award_kind is null;
    insert into grading_scales (name, version, award_kind, pass_mark, max_point,
                                bands, is_active, published_at)
    values ('PROOF — the scale this migration refuses', 1, null, 60, 4.00,
      '[{"grade":"A", "points":4.00,"min":93,"max":100},
        {"grade":"D-","points":0.70,"min":60,"max":92},
        {"grade":"F", "points":0.00,"min":0, "max":59}]'::jsonb,
      true, now());

    select * into g from grade_under_active_scale(60);
    if g.grade = 'F' then
      raise exception '035 FAILED: a scale passing at 60 was published and the check still '
                      'reported 60%% as a fail. The check does not work and the guarantee '
                      'at the head of this file is worthless.';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  -- …and the University's own scale is back, untouched.
  select * into g from grade_under_active_scale(60);
  if g.grade <> 'F' then
    raise exception '035 FAILED: the proof above did not roll back. 60%% now reads %.', g.grade;
  end if;

  -- ---- Every whole mark lands in exactly one band -------------------------
  for n in 0..100 loop
    if (select count(*) from grading_scales s
        cross join lateral jsonb_array_elements(s.bands) b
        where s.is_active and s.award_kind is null
          and n >= (b->>'min')::numeric and n <= (b->>'max')::numeric) <> 1 then
      raise exception '035 FAILED: mark %%%  does not fall in exactly one band', n;
    end if;
  end loop;

  -- ---- A restatement cannot be deleted or altered by a browser -----------
  -- There is no update and no delete policy, so the only identity that could
  -- is the service role, which bypasses RLS by design. What is asserted here
  -- is that nobody has since added one.
  if exists (select 1 from pg_policies
              where tablename = 'grading_scale_restatements'
                and cmd in ('UPDATE', 'DELETE')) then
    raise exception '035 FAILED: a policy now lets the restatement record be changed. '
                    'The audit of a retroactive change may not be editable by the '
                    'people it is about.';
  end if;

  raise notice '035 OK: the American scale is in force and the old one is still readable';
end $$;

-- The credit model, asserted against the courses that exist. A registry with
-- none of these rows yet passes; one that has them and disagrees does not.
do $$
declare
  bad text;
begin
  select string_agg(code || ' is ' || credit_unit, ', ')
    into bad
    from courses
   where (code in ('BIS 220','BIS 230','BIS 250','BIS 260',
                   'RM 540','RM 550','STT 400','STT 420') and credit_unit <> 3)
      or (code = 'RM 560'  and credit_unit <> 20)
      or (code = 'BIS 210' and credit_unit <> 6);
  if bad is not null then
    raise exception '035 FAILED: credit values did not take — %', bad;
  end if;
  raise notice '035 OK: the two-part courses carry 3 and the thesis carries 20';
end $$;

-- A restated average must still satisfy 007's guard: on a student's first
-- recorded term the cumulative average IS that term's average. If section 7
-- wrote them in the wrong order this is where it shows.
do $$
declare
  wrong integer;
begin
  select count(*) into wrong
    from (
      select distinct on (student_id) student_id, gpa, cgpa
        from semester_gpas
       order by student_id, academic_year, semester
    ) first_terms
   where abs(cgpa - gpa) > 0.005;
  if wrong > 0 then
    raise exception '035 FAILED: % student(s) have a first-term cumulative average that '
                    'differs from the term average. The two were computed in the wrong '
                    'order or written to the wrong columns.', wrong;
  end if;
  raise notice '035 OK: every restated cumulative average is consistent with its first term';
end $$;


-- ===========================================================================
-- 9. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- The scale in force, and the one it replaced.
select version, is_active, pass_mark, max_point,
       bands->0->>'grade' as top_grade, bands->0->>'points' as top_points,
       published_at
  from grading_scales
 where name = 'University grading scale'
 order by version;

-- What the restatement moved. Empty on a second run.
select kind, count(*) as figures_restated
  from grading_scale_restatements
 group by kind
 order by kind;

-- Every average that changed, per student, largest movement first. This is the
-- list to read before deciding anything about already-issued documents.
select s.first_name || ' ' || s.last_name as student,
       r.academic_year, r.semester,
       (r.before->>'cgpa')::numeric as was,
       (r.after ->>'cgpa')::numeric as now,
       round((r.after->>'cgpa')::numeric - (r.before->>'cgpa')::numeric, 2) as moved
  from grading_scale_restatements r
  join students s on s.id = r.student_id
 where r.kind = 'gpa'
 order by abs((r.after->>'cgpa')::numeric - (r.before->>'cgpa')::numeric) desc
 limit 50;

-- ISSUED CREDENTIALS THAT NOW DISAGREE WITH THE RECORD. Not changed by this
-- migration, by design. Each one is a decision for the University: leave it,
-- reissue it, or issue a corrected version under 013's correction workflow.
select ci.id, ci.kind, ci.issued_at,
       s.first_name || ' ' || s.last_name as student
  from credentials_issued ci
  join students s on s.id = ci.student_id
 where exists (
   select 1 from grading_scale_restatements r
    where r.student_id = ci.student_id and r.kind = 'gpa'
      and r.restated_at > ci.issued_at
 )
 order by ci.issued_at desc;

-- How many of the thirty-six Bachelor of Theology courses the registry holds,
-- and what they now total. 36 and 180 when the degree is fully entered.
select count(*) as bth_courses_in_registry,
       sum(credit_unit) as total_credits
  from courses
 where code in ('BIS 210','BIS 220','BIS 230','BIS 250','BIS 260','RM 540','RM 550',
                'STT 400','STT 420','RM 560','MW 300','OTH 300','CH 200','LC 110',
                'OT 300','MDS 720','CH 300','MDS 660','CED 160','BIS 330','BIS 320',
                'BL 340','STT 410','MDS 650','BIS 270','BIS 280','MDS 670','MDS 730',
                'BIS 350','CDS 100','MW 350','MDS 820','BIS 340','MDS 760','STT 430',
                'STT 450');

-- Marks that could not be placed in a term, so are in no average. Should be 0.
select count(*) as results_with_no_enrolment
  from results r
  left join enrollments e on e.id = r.enrollment_id
 where r.total_score is not null
   and (e.id is null or e.academic_year is null or e.semester is null);


-- ===========================================================================
-- ===========================================================================
--
--   036_the_steps_nothing_could_write.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 036 — THE THREE STATES THE UNIVERSITY DECLARED AND NOTHING COULD WRITE
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- Two new events are admitted to the audit trail's vocabulary, and with them
-- three states become reachable for the first time since 024 declared them:
--
--   under_review        The Admissions Office has opened the application. Until
--                       now a file somebody was working on and a file nobody
--                       had touched were the same value, so "why has this sat
--                       for three weeks" had no answer in the system.
--   fee_pending         Finance has ASKED for the fee. `applicant` means nobody
--                       has asked. An applicant chased for money they were
--                       never asked for is what the absence of this cost.
--   documents_verified  The documents were checked and accepted. Verification
--                       was recorded only by its absence — a record stopped
--                       being `documents_required` — so "checked and accepted"
--                       and "nobody has looked" were indistinguishable.
--
-- Nothing moves on its own. No existing application changes state; this widens
-- a CHECK constraint so the controls that write these states are accepted.
--
-- ---------------------------------------------------------------------------
-- WHY A CONSTRAINT AND NOT JUST CODE
-- ---------------------------------------------------------------------------
--
-- `admission_audit_log.event` is a closed vocabulary on purpose: an event
-- outside it fails the insert. That is the right failure, because the
-- alternative is an act that happened and was not recorded. The routes write
-- the trail as part of the step, so without this the step is refused rather
-- than silently unrecorded — which is why the application's own test suite
-- fails until this migration exists.
-- ===========================================================================

do $$
begin
  if exists (select 1 from pg_constraint
              where conname = 'admission_audit_log_event_check') then
    alter table admission_audit_log drop constraint admission_audit_log_event_check;
  end if;

  alter table admission_audit_log add constraint admission_audit_log_event_check
    check (event in (
      'APPLICATION_SUBMITTED',
      -- The two new ones. Both name an office DOING something rather than
      -- something having happened to the application, which is the distinction
      -- the three states exist to record.
      'ADMISSION_OPENED', 'FEE_REQUESTED',
      'DOCUMENT_VERIFIED', 'FEE_CONFIRMED',
      'FORWARDED_FOR_ACADEMIC_REVIEW',
      'ACADEMIC_REVIEW_STARTED', 'ACADEMIC_APPROVED',
      'ACADEMIC_CONDITIONALLY_APPROVED', 'ACADEMIC_REJECTED', 'ACADEMIC_RETURNED',
      'RETURNED_TO_OFFICE', 'REOPENED_FOR_REEVALUATION',
      'ISSUANCE_STARTED', 'ISSUANCE_FAILED', 'ISSUANCE_RETRIED',
      'ADMISSION_LETTER_GENERATED', 'ADMISSION_PACKAGE_ISSUED',
      'ACCOUNT_CREATED', 'WELCOME_EMAIL_SENT', 'WELCOME_EMAIL_FAILED',
      'ENROLLED', 'WITHDRAWN', 'ADMINISTRATIVE_OVERRIDE'
    ));
end $$;


-- ===========================================================================
-- PERFORMING THE RULES
-- ===========================================================================
--
-- Both directions. A vocabulary that accepts everything is not a vocabulary,
-- and one that refuses the thing it was widened for is a migration that did not
-- take — and the difference between those two is invisible from reading the
-- SQL, which is why this runs it.

do $$
declare
  app_id uuid;
  refused boolean;
begin
  -- A row to hang the proof on. Any application will do; if the University has
  -- none yet there is nothing to prove against and the checks are skipped
  -- rather than faked against an invented student.
  select id into app_id from students limit 1;
  if app_id is null then
    raise notice '036: no applications yet, so the trail could not be exercised';
    return;
  end if;

  -- ---- The new events are accepted ----------------------------------------
  begin
    insert into admission_audit_log (application_id, event, previous_state, new_state, detail)
    values (app_id, 'ADMISSION_OPENED', 'applicant', 'under_review', 'PROOF'),
           (app_id, 'FEE_REQUESTED',    'applicant', 'fee_pending',  'PROOF');
    raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then
      raise exception '036 FAILED: the new events are still refused by the constraint (%)', sqlerrm;
    end if;
  end;

  -- ---- AND AN INVENTED ONE IS STILL REFUSED -------------------------------
  -- The half of this that matters. Widening a vocabulary by removing the
  -- constraint would pass every test above and leave the trail able to record
  -- anything at all.
  refused := false;
  begin
    insert into admission_audit_log (application_id, event, previous_state, new_state)
    values (app_id, 'SOMEBODY_JUST_MADE_THIS_UP', 'applicant', 'under_review');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '036 FAILED: the audit trail accepted an event nobody declared. The '
                    'vocabulary is no longer closed.';
  end if;

  raise notice '036 OK: the trail records the two new steps and still refuses an invented one';
end $$;

-- The three states are declared, which they have been since 024, and now
-- something can write them.
do $$
declare
  missing text;
begin
  select string_agg(s, ', ') into missing
    from unnest(array['under_review', 'fee_pending', 'documents_verified']) s
   where not exists (select 1 from admission_states a where a.state = s);
  if missing is not null then
    raise exception '036 FAILED: % is not in admission_states, so nothing can be put into it',
      missing;
  end if;
  raise notice '036 OK: under_review, fee_pending and documents_verified are reachable';
end $$;


-- ===========================================================================
-- VERIFY
-- ===========================================================================

-- The vocabulary as it now stands.
select unnest(string_to_array(
         replace(replace(substring(pg_get_constraintdef(oid)
           from '\((.*)\)$'), '''', ''), ' ', ''), ',')) as event_now_allowed
  from pg_constraint where conname = 'admission_audit_log_event_check';

-- How many applications sit in each of the three, which should be 0 today and
-- stop being 0 the first time somebody opens a file.
select a.state, a.applicant_label, count(s.id) as applications
  from admission_states a
  left join students s on s.status = a.state
 where a.state in ('under_review', 'fee_pending', 'documents_verified')
 group by a.state, a.applicant_label
 order by a.state;


-- ===========================================================================
-- ===========================================================================
--
--   037_a_student_is_not_an_application.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 037 — `students.status` WAS TWO COLUMNS WEARING ONE NAME
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS. READ THIS PART.
-- ---------------------------------------------------------------------------
--
-- 1. EVERY GRADUATED, ACTIVE AND SUSPENDED ROW CHANGES ITS `status`. They
--    become `enrolled` — which is what they always were, because you cannot
--    graduate from a university you were never enrolled at — and what became of
--    them moves to the new `student_status` column. A query filtering
--    `status = 'graduated'` returns nothing after this and must read
--    `student_status` instead. The application already does.
--
-- 2. NOTHING IS LOST AND NOTHING IS GUESSED. Section 3 records every row it
--    moves, before and after, in `student_status_split`. The one genuinely
--    ambiguous value — `withdrawn` — is decided by evidence on the row rather
--    than by preference, and the rows it could not decide are reported.
--
-- 3. `students.status` GETS A CHECK CONSTRAINT FOR THE FIRST TIME. It never had
--    one. That is how three states could be written by the pipeline for years
--    while being absent from the vocabulary, and how `active` could sit in a
--    column of admission states without anything objecting. It is added NOT
--    VALID: it governs every new write immediately and does not refuse to run
--    because of a row somebody typed in 2024. 027's coverage view already
--    reports the strays.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS WORTH A MIGRATION
-- ---------------------------------------------------------------------------
--
-- Two vocabularies shared one column and two of the words appeared in both.
--
--   `withdrawn`  an applicant who wrote to say they no longer wanted the place,
--                and a student who left in their second year. 034 gave the
--                Registrar a withdrawal action that writes this word, so from
--                that day the two became genuinely indistinguishable — and one
--                of them is a place that could have gone to somebody else while
--                the other is a student who needs a transcript.
--   `deferred`   an offer held to a later intake, and something that was
--                supposed to describe a student. Only the first is real.
--
-- And it forced a worse thing. Conferring a degree set `status = 'graduated'`,
-- which OVERWROTE `enrolled`. The University's own record of having admitted
-- and enrolled somebody was destroyed by the act of graduating them.
-- ===========================================================================


-- ===========================================================================
-- 1. THE SECOND COLUMN
-- ===========================================================================
--
-- NULL until enrolment, deliberately. Somebody who has not enrolled is not yet
-- a student, and a default of 'active' would say the University teaches every
-- applicant who ever filled in the form.

alter table students add column if not exists student_status text;

comment on column students.student_status is
  'What became of this student: active, graduated, suspended or withdrawn. NULL '
  'until they enrol, because an applicant is not a student. The admission '
  'pipeline lives in `status` and is settled history once enrolment is recorded.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'students_student_status_check') then
    alter table students add constraint students_student_status_check
      check (student_status is null
             or student_status in ('active', 'graduated', 'suspended', 'withdrawn'));
  end if;
end $$;

create index if not exists students_student_status_idx
  on students (student_status) where student_status is not null;


-- ===========================================================================
-- 2. WHAT WAS MOVED
-- ===========================================================================
--
-- A column split that cannot be audited is a column split nobody can undo. One
-- row per student moved, with both values before and both after.

create table if not exists student_status_split (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students (id) on delete cascade,
  status_before  text,
  status_after   text,
  student_status_after text,
  /** How the row was decided, in words, for the ambiguous ones especially. */
  because        text not null,
  split_at       timestamptz not null default now()
);

create index if not exists student_status_split_student_idx
  on student_status_split (student_id);

alter table student_status_split enable row level security;

drop policy if exists student_status_split_read on student_status_split;
create policy student_status_split_read on student_status_split
  for select using (auth_role() in ('superadmin', 'admin', 'registrar'));

-- No insert, update or delete policy. The service role writes it and nobody
-- edits the record of what was moved.


-- ===========================================================================
-- 3. THE SPLIT
-- ===========================================================================
--
-- Only rows whose `status` is one of the four student words are touched. An
-- application sitting at `fee_paid` is not a student and is left exactly alone.
--
-- `withdrawn` IS THE ONLY HARD ONE, and it is decided by evidence rather than
-- by preference: a row with an enrolment date or a student number was a
-- student when they left, and a row with neither was an applicant. Rows that
-- carry neither piece of evidence stay applicants, because under-counting the
-- student body is the safe way to be wrong — the alternative is conferring
-- studenthood on somebody who never had it.

do $$
declare
  moved integer;
begin
  with decided as (
    select s.id,
           s.status as status_before,
           case
             when s.status in ('active', 'graduated', 'suspended') then 'enrolled'
             when s.status = 'withdrawn'
              and (s.enrolled_at is not null or s.student_number is not null) then 'enrolled'
             else s.status
           end as status_after,
           case
             when s.status in ('active', 'graduated', 'suspended') then s.status
             when s.status = 'withdrawn'
              and (s.enrolled_at is not null or s.student_number is not null) then 'withdrawn'
             else null
           end as student_status_after,
           case
             when s.status in ('active', 'graduated', 'suspended')
               then 'Was a student word in the admission column. The admission state can only '
                 || 'have been `enrolled`: you cannot graduate from, be suspended by or be '
                 || 'active at a university you were never enrolled at.'
             when s.status = 'withdrawn' and s.enrolled_at is not null
               then 'Withdrew after enrolment — `enrolled_at` is set — so this is a student '
                 || 'who left, not an applicant who declined.'
             when s.status = 'withdrawn' and s.student_number is not null
               then 'Withdrew holding a student number, so the University had already made '
                 || 'them a student.'
             when s.status = 'withdrawn'
               then 'Withdrew with no enrolment date and no student number, so they were an '
                 || 'applicant who stepped away. Left as an admission outcome.'
             else 'Not a student word. Untouched.'
           end as because
      from students s
     where s.status in ('active', 'graduated', 'suspended', 'withdrawn')
       -- Already split. A second run must move nothing.
       and s.student_status is null
       and not (s.status = 'withdrawn'
                and s.enrolled_at is null and s.student_number is null)
  ),
  logged as (
    insert into student_status_split
      (student_id, status_before, status_after, student_status_after, because)
    select id, status_before, status_after, student_status_after, because from decided
    returning 1
  )
  update students s
     set status = d.status_after,
         student_status = d.student_status_after
    from decided d
   where s.id = d.id;

  get diagnostics moved = row_count;
  raise notice '037: % student row(s) split into an admission state and a student status', moved;
end $$;

-- Anybody the Registrar has enrolled and who has no student status yet is
-- active. Written separately because it is a different statement: the rows
-- above were MIS-FILED, these were simply never asked the question.
update students
   set student_status = 'active'
 where status = 'enrolled' and student_status is null;


-- ===========================================================================
-- 4. `students.status` FINALLY GETS A VOCABULARY
-- ===========================================================================
--
-- NOT VALID, and that is the considered choice rather than the lazy one. A
-- validating constraint would refuse to be created at all if one row in years
-- of data carried a status nobody remembers writing, and the migration would
-- fail with a message about a single row instead of doing its job. NOT VALID
-- governs every write from this second onward, which is what stops the next
-- unnamed state, and 027's `admission_status_coverage` view already reports
-- anything historic that does not fit.
--
-- Run `alter table students validate constraint students_status_check;` once
-- the coverage view is clean, and it becomes a full constraint with no rewrite.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'students_status_check') then
    alter table students add constraint students_status_check
      check (status in (
        'draft', 'applicant', 'under_review', 'documents_required', 'documents_verified',
        'fee_pending', 'fee_paid', 'registrar_approved', 'ready_for_academic_review',
        'approved', 'conditional', 'rejected', 'declined', 'deferred', 'returned',
        'admission_processing', 'admission_processing_failed', 'admission_issued',
        'enrolled', 'withdrawn'
      )) not valid;
  end if;
end $$;


-- ===========================================================================
-- 5. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  n integer;
  sid uuid;
begin
  -- ---- No student word is left in the admission column --------------------
  select count(*) into n from students
   where status in ('active', 'graduated', 'suspended');
  if n > 0 then
    raise exception '037 FAILED: % row(s) still carry a student status in `status`', n;
  end if;

  -- ---- A GRADUATE IS STILL RECORDED AS HAVING BEEN ENROLLED ---------------
  -- The thing the old column destroyed. Conferring a degree overwrote the
  -- enrolment, so the University's record that it had admitted and enrolled
  -- somebody was erased by the act of graduating them.
  select count(*) into n from students
   where student_status = 'graduated' and status <> 'enrolled';
  if n > 0 then
    raise exception '037 FAILED: % graduate(s) are not recorded as having been enrolled', n;
  end if;

  -- ---- An invented student status is refused ------------------------------
  select id into sid from students limit 1;
  if sid is not null then
    refused := false;
    begin
      update students set student_status = 'expelled' where id = sid;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '037 FAILED: `student_status` accepted a value nobody declared. The '
                      'vocabulary is not closed, which is how the old column went wrong.';
    end if;

    -- ---- And so is an invented admission state ---------------------------
    -- `students.status` has never had a constraint. This is the first time it
    -- refuses anything, and it is worth watching it do so.
    refused := false;
    begin
      update students set status = 'somebody_just_made_this_up' where id = sid;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '037 FAILED: `students.status` still accepts any text at all. The '
                      'constraint did not take.';
    end if;
  end if;

  raise notice '037 OK: the two vocabularies are in two columns and each refuses the other''s '
               'inventions';
end $$;


-- ===========================================================================
-- 6. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- What was moved, and why. Empty on a second run.
select status_before, status_after, student_status_after, count(*) as rows, min(because) as because
  from student_status_split
 group by 1, 2, 3
 order by 1;

-- The roll, as the University can now state it in one query rather than four
-- guessed values.
select coalesce(student_status, '— not a student —') as student_status,
       count(*) as people
  from students
 group by 1
 order by 2 desc;

-- WITHDRAWALS THAT COULD NOT BE DECIDED. Rows left as applicant withdrawals
-- because they carry neither an enrolment date nor a student number. If any of
-- these were students who left, set their student_status by hand — this
-- migration will not guess.
select id, first_name, last_name, matric_no, withdrawn_at
  from students
 where status = 'withdrawn' and student_status is null
 order by withdrawn_at desc nulls last;

-- Statuses the vocabulary does not know, from 027's view. The constraint is NOT
-- VALID until this is empty.
select * from admission_status_coverage where not in_vocabulary;

