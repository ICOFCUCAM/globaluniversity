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
