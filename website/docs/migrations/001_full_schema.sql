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
-- The role comes from user_metadata when the caller set one — the approve route
-- stamps role='student' there — and falls back to 'student', the least
-- privileged role, when it did not. Promote a staff account afterwards:
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
    coalesce(new.raw_user_meta_data->>'role', 'student')
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
  coalesce(u.raw_user_meta_data->>'role', 'student')
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
