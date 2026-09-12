-- ===========================================================================
-- ENOUGH OF SUPABASE TO RUN THE MIGRATIONS AGAINST A PLAIN POSTGRES.
--
--   psql -f tests/supabase-stub.sql -f 000_complete.sql -f 001_... etc.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS IN THE REPOSITORY
-- ---------------------------------------------------------------------------
--
-- It was not. It lived in /var/tmp/pgtest on whichever machine had last been
-- used, which meant the instruction "prove it against Postgres rather than
-- reading it" depended on a directory nobody had written down and that does
-- not survive a new container. The first thing that happened on a fresh one was
-- that the harness was gone and the proof had to be rebuilt from memory.
--
-- A test harness that only exists on one machine is a test harness that will
-- be skipped. So it lives here, beside the migrations it exists to run.
--
-- ---------------------------------------------------------------------------
-- WHAT IT IS AND IS NOT
-- ---------------------------------------------------------------------------
--
-- It provides the Supabase-specific objects the migrations reference — the
-- `auth` schema, `auth.users`, `auth.uid()`, `auth.role()`, and the
-- `authenticated` role that policies are granted to. Nothing more.
--
-- IT IS NOT A SECURITY MODEL. `auth.uid()` here reads a session setting that
-- any caller can set, which is exactly what makes it useful for a test and
-- exactly why nothing built on it proves anything about production RLS. What
-- these runs prove is that the DDL applies, that the constraints and triggers
-- refuse what they are meant to refuse, and that a migration is idempotent.
-- ===========================================================================

create extension if not exists pgcrypto;

-- The role policies are granted to. Supabase creates it; a plain Postgres
-- has not heard of it, and `grant ... to authenticated` fails without it.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end $$;

create schema if not exists auth;

-- The columns the migrations actually touch, not the real table's shape.
create table if not exists auth.users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- THE TWO FUNCTIONS EVERY POLICY IS WRITTEN AGAINST.
--
-- Both read a session setting, so a test can say who it is:
--
--   set local request.jwt.claim.sub  = '<uuid>';
--   set local request.jwt.claim.role = 'registrar';
--
-- Unset means nobody, which is the useful default: a policy tested with no
-- identity should refuse, and it does.
-- ---------------------------------------------------------------------------
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role() returns text
language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$;
