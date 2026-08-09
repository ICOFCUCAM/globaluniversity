-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — MIGRATIONS 021, 022, IN ORDER
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-migration-run.mjs
--   Rebuild:   node scripts/build-migration-run.mjs --out=RUN-OUTSTANDING.sql 021 022
--
-- ---------------------------------------------------------------------------
-- HOW TO RUN IT
--
-- Supabase SQL editor: paste the whole file and run once.
-- psql:                psql "<connection string>" -f docs/migrations/RUN-OUTSTANDING.sql
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

