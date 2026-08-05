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
