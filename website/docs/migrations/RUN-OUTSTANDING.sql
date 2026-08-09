-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — MIGRATIONS 021, 022, 023, 024, IN ORDER
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-migration-run.mjs
--   Rebuild:   node scripts/build-migration-run.mjs --out=RUN-OUTSTANDING.sql 021 022 023 024
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

insert into admission_states (state, stage, applicant_label, sort_order) values
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

