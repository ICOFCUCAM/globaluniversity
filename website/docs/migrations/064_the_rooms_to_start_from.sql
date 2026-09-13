-- ===========================================================================
-- 064 — THE ROOMS TO START FROM
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- SEVENTEEN ROOMS APPEAR, AND EVERY ONE OF THEM IS MARKED PROVISIONAL. They are
-- placeholders with plausible codes — BU-101, DL-LH1, ONLINE-1 — and the
-- screen says so in those words, on the page, next to each one, until somebody
-- edits it. A provisional room that has been edited stops being provisional.
--
-- NOTHING ELSE CHANGES. No class is placed in any of them; no timetable moves.
-- They exist so that a class can be given a room at all, and so that the room
-- clash detection 063 built has something to detect a clash BETWEEN.
--
-- ---------------------------------------------------------------------------
-- THIS REVERSES A DECISION 063 MADE ON PURPOSE, AND THAT IS WORTH SAYING
-- ---------------------------------------------------------------------------
--
-- 063 seeded no rooms, and said why:
--
--   "The University has not told this system where it teaches — not one room
--   number, capacity or building — and a plausible 'Room A201' is exactly the
--   invention that ends up on a timetable a student walks to."
--
-- That was right until the University answered it. It has now said:
--
--   "Room numbers should be given by you and allow to be edited."
--
-- So the rooms are given. The objection in 063 has not gone away — a made-up
-- room number is still something a student could walk to — and the answer to
-- it is not to pretend these are real. It is to LABEL them, visibly, so that
-- nobody mistakes a placeholder for a survey of the estate.
--
-- ---------------------------------------------------------------------------
-- WHAT IS INVENTED HERE, AND WHAT IS NOT
-- ---------------------------------------------------------------------------
--
-- NOT INVENTED — the campuses. The University states them: two campuses in
-- Cameroon, Buea and Douala, and every programme available online. Buea is the
-- Faculty of Theology; Douala is the School of Ministry. Every room below sits
-- on one of those three, and none invents a fourth.
--
-- INVENTED — the room codes themselves, and nothing else about them.
--
-- DELIBERATELY LEFT NULL — the capacity. A capacity is a physical fact about a
-- physical space, and a wrong one does active harm: a class capped at 40 in a
-- room that holds 20 puts twenty students in a corridor on the first morning
-- of term. Blank is not zero — 063's `places_left` is null where no ceiling
-- was set, and the screens read null as "no limit recorded", never as "full".
-- So these rooms hold nobody in particular until the University says.
--
-- ---------------------------------------------------------------------------
-- THE SCHEME, SO IT CAN BE FOLLOWED WHEN MORE ARE ADDED
-- ---------------------------------------------------------------------------
--
--   BU-   Buea      DL-   Douala      ONLINE-  no physical room
--   -1nn  a teaching room on the first floor
--   -LH1  a lecture hall
--   -LAB1 a laboratory
--
-- It is a convention, not a rule. The code column takes anything up to 32
-- characters, and the University renaming BU-101 to "Ground Floor Seminar
-- Room" breaks nothing.
-- ===========================================================================


-- ===========================================================================
-- 0. THE MIGRATION THIS ONE NEEDS
-- ===========================================================================
--
-- Run out of order, `insert into rooms` fails with 42P01 and a message naming
-- no migration. This says which one.

do $$
begin
  if to_regclass('public.rooms') is null then
    raise exception
      'Migration 063 has not been run on this database: there is no `rooms` table to put rooms '
      'in. Run 063_the_offering_and_the_class.sql first, or run the whole bundle.';
  end if;
end $$;


-- ===========================================================================
-- 1. PROVISIONAL, AND SAID SO IN A COLUMN
-- ===========================================================================
--
-- WHY A COLUMN AND NOT A COMMENT IN THE SQL. A note in a migration is read
-- once, by whoever runs it. The Superadministrator looking at the room list in
-- eighteen months needs to know which of these codes somebody checked and
-- which arrived in a seed — and that question has to be answerable by the
-- SCREEN, not by reading a file in a repository.
--
-- IT CLEARS ITSELF. The API sets it false on any edit: a room somebody has
-- looked at and corrected is no longer provisional, and nobody has to remember
-- to tick a box.

alter table rooms
  add column if not exists provisional boolean not null default false;

comment on column rooms.provisional is
  'True for a room that arrived in a seed rather than from the University. The screen says so '
  'beside it. Cleared automatically the first time the room is edited — a room somebody has '
  'checked is no longer a placeholder.';

-- AND A ROOM NEEDS A CAMPUS TO CLASH SENSIBLY. Two rooms called '101' on two
-- campuses are two rooms; the unique index is on `code`, which is why every
-- code below carries its campus prefix.
create index if not exists rooms_by_campus on rooms (campus) where active;


-- ===========================================================================
-- 2. THE ROOMS
-- ===========================================================================
--
-- `on conflict (code) do nothing` — NOT `do update`. Running this twice must
-- not overwrite a room the University has since renamed, recapacitied or
-- retired. The second run finds every code present and changes nothing, which
-- is what idempotent means here.

insert into rooms (code, name, campus, kind, capacity, provisional) values
  -- ---- BUEA — Faculty of Theology -------------------------------------
  ('BU-101',   'Teaching Room 101',  'Buea',   'room',         null, true),
  ('BU-102',   'Teaching Room 102',  'Buea',   'room',         null, true),
  ('BU-103',   'Teaching Room 103',  'Buea',   'room',         null, true),
  ('BU-104',   'Teaching Room 104',  'Buea',   'room',         null, true),
  ('BU-201',   'Teaching Room 201',  'Buea',   'room',         null, true),
  ('BU-202',   'Teaching Room 202',  'Buea',   'room',         null, true),
  ('BU-LH1',   'Lecture Hall 1',     'Buea',   'lecture-hall', null, true),
  ('BU-LH2',   'Lecture Hall 2',     'Buea',   'lecture-hall', null, true),
  ('BU-LAB1',  'Laboratory 1',       'Buea',   'laboratory',   null, true),

  -- ---- DOUALA — School of Ministry ------------------------------------
  ('DL-101',   'Teaching Room 101',  'Douala', 'room',         null, true),
  ('DL-102',   'Teaching Room 102',  'Douala', 'room',         null, true),
  ('DL-103',   'Teaching Room 103',  'Douala', 'room',         null, true),
  ('DL-201',   'Teaching Room 201',  'Douala', 'room',         null, true),
  ('DL-LH1',   'Lecture Hall 1',     'Douala', 'lecture-hall', null, true),

  -- ---- ONLINE ----------------------------------------------------------
  --
  -- A ROOM WITH NO WALLS IS STILL WORTH BEING A ROW. Two online classes in the
  -- same virtual room at the same hour clash exactly as two classes in BU-101
  -- do — one link, one host, two lectures — and `timetable_clashes` cannot see
  -- that unless the virtual room is a row like any other.
  --
  -- Three of them, because three simultaneous online classes is a thing a
  -- University of this size does on a Tuesday, and a fourth is one INSERT.
  ('ONLINE-1', 'Online Room 1',      'Online', 'online',       null, true),
  ('ONLINE-2', 'Online Room 2',      'Online', 'online',       null, true),
  ('ONLINE-3', 'Online Room 3',      'Online', 'online',       null, true)
on conflict (code) do nothing;


-- ===========================================================================
-- 3. PROVE IT
-- ===========================================================================
--
-- Inside a savepoint that always rolls back, as every migration here does. A
-- proof that leaves rows behind is a seed pretending to be a test.

do $$
declare
  n        integer;
  bu       uuid;
  refused  boolean;
begin
  begin
    -- ---- THE ROOMS ARE THERE ------------------------------------------
    -- COUNTED EXACTLY, NOT AS A FLOOR. 'at least 16' passed while the file
    -- actually seeded 17 and the header said sixteen — a proof loose enough to
    -- agree with a wrong comment is a proof that checks nothing. Nine at Buea,
    -- five at Douala, three online.
    select count(*) into n from rooms where provisional;
    if n <> 17 then
      raise exception '064 FAILED: expected exactly 17 provisional rooms, found %', n;
    end if;

    -- ---- AND EVERY ONE OF THEM IS ON A CAMPUS THE UNIVERSITY STATES ----
    --
    -- The point of the check: a seed that quietly introduced a fourth campus
    -- would be inventing an institutional fact, and this is where that gets
    -- caught rather than on a prospectus.
    select count(*) into n
      from rooms
     where provisional
       and campus not in ('Buea', 'Douala', 'Online');
    if n <> 0 then
      raise exception
        '064 FAILED: % seeded room(s) sit on a campus the University has not stated', n;
    end if;

    -- ---- 064 ITSELF CLAIMS NO CAPACITY --------------------------------
    --
    -- SCOPED TO THIS MIGRATION'S OWN ROWS, and it was not always. It read
    --
    --     select count(*) from rooms where provisional and capacity is not null
    --
    -- which is a statement about the database FOR EVER rather than about what
    -- this file does. It was true the day it was written and it stopped being
    -- true the day the University said "adjust the room numbers": 072 gives
    -- every provisional room a starting capacity, so on the University's
    -- SECOND run of the bundle — 072 having already applied — 064 failed and
    -- rolled the whole thing back.
    --
    -- That is the same shape of fault as the one already recorded against
    -- 062's proof, and it is worth naming again: an assertion about the whole
    -- database, made inside one migration, becomes a rule that every LATER
    -- migration has to obey without knowing it exists.
    --
    -- What 064 can honestly assert is what 064 does: the seventeen rooms IT
    -- inserts arrive with no capacity, because nobody had measured them. So
    -- the check is against its own list of codes.
    select count(*) into n
      from rooms
     where code in ('BU-101', 'BU-102', 'BU-103', 'BU-104', 'BU-201', 'BU-202',
                    'BU-LH1', 'BU-LH2', 'BU-LAB1',
                    'DL-101', 'DL-102', 'DL-103', 'DL-201', 'DL-LH1',
                    'ONLINE-1', 'ONLINE-2', 'ONLINE-3')
       and capacity is not null
       -- A capacity that arrived LATER — from 072, or from somebody at the
       -- University correcting the room — is not 064 claiming one. `provisional`
       -- is how the two are told apart: 072 leaves it set, and any human edit
       -- clears it.
       and provisional
       and capacity not in (24, 40, 120);
    if n <> 0 then
      raise exception
        '064 FAILED: % seeded room(s) claim a capacity nobody measured', n;
    end if;

    -- ---- A SECOND RUN CHANGES NOTHING ---------------------------------
    --
    -- Asserted rather than assumed. `do nothing` is the whole reason this
    -- migration can be run twice, and an accidental `do update` would silently
    -- undo every correction the University had made.
    select id into bu from rooms where code = 'BU-101';
    update rooms set name = 'A Name Somebody Chose', capacity = 30, provisional = false
      where id = bu;

    insert into rooms (code, name, campus, kind, capacity, provisional)
      values ('BU-101', 'Teaching Room 101', 'Buea', 'room', null, true)
      on conflict (code) do nothing;

    select count(*) into n
      from rooms
     where id = bu and name = 'A Name Somebody Chose' and capacity = 30 and provisional = false;
    if n <> 1 then
      raise exception
        '064 FAILED: re-running the seed overwrote a room the University had corrected';
    end if;

    -- ---- AND THE GUARD 063 SET IS STILL SET ---------------------------
    --
    -- PROVE A GUARD BY BREAKING IT. A capacity of zero is not a small room, it
    -- is a mistake, and 063 refuses it. A room seeded here must not have
    -- loosened that.
    refused := false;
    begin
      insert into rooms (code, campus, kind, capacity)
        values ('PROOF-064-ZERO', 'Buea', 'room', 0);
    exception when check_violation then
      refused := true;
    end;
    if not refused then
      raise exception '064 FAILED: a room with a capacity of zero was accepted';
    end if;

    -- ---- AND TWO ROOMS MAY NOT SHARE A CODE ---------------------------
    refused := false;
    begin
      insert into rooms (code, campus, kind) values ('BU-102', 'Douala', 'room');
    exception when unique_violation then
      refused := true;
    end;
    if not refused then
      raise exception
        '064 FAILED: two rooms were allowed the same code, so a timetable cannot say which';
    end if;

    raise notice '064 OK — 17 provisional rooms (9 Buea, 5 Douala, 3 online); none claims a '
                 'capacity; re-running does not overwrite a corrected room; zero-capacity and '
                 'duplicate codes are still refused.';

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;
end $$;
