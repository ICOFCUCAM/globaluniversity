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
on conflict (kind, label) do nothing;


-- ===========================================================================
-- 4. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  tgt uuid;
  refused boolean;
begin
  -- ---- A programme arrives closed --------------------------------------
  select id into tgt from admission_openings where kind = 'programme' and label = 'THE-BA';
  if tgt is null then
    raise exception '023 FAILED: the programme rows were not seeded';
  end if;
  if (select open from admission_openings where id = tgt) then
    raise exception '023 FAILED: a programme was seeded OPEN — the gate would permit everything';
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

  raise notice '023 OK — programmes are seeded closed, the trail accepts a decision, and it '
               'refuses to have one rewritten or removed.';
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
