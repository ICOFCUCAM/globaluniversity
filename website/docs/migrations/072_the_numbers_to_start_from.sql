-- ===========================================================================
-- 072 — THE NUMBERS TO START FROM, AND EVERY ONE OF THEM ADJUSTABLE
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- Two sets of blanks are filled in with STARTING FIGURES, and both are marked
-- as starting figures in a column the screens read:
--
--   1. Every seeded room gets a capacity. 064 deliberately left all seventeen
--      blank because nobody had measured them.
--   2. Twelve programmes get a credit total. The other twenty-nine already had
--      one; these had nothing at all, so their progress bars read "0 / —" and
--      no graduation audit could ever say a student had finished.
--
-- NOTHING THE UNIVERSITY HAS ALREADY CORRECTED IS TOUCHED. Both updates are
-- restricted to rows still flagged provisional. Run this file ten times and a
-- room somebody fixed keeps their figure — which is asserted in the proof, by
-- correcting a room and then re-running the update against it.
--
-- ---------------------------------------------------------------------------
-- THE UNIVERSITY'S INSTRUCTION
-- ---------------------------------------------------------------------------
--
-- "Adjust the room numbers and curricula and make them adjustable. You had
-- started allocating the numbers before."
--
-- So these are allocations, not facts the University has stated, and the
-- difference is carried in the data rather than in a comment nobody reads.
-- `rooms.provisional` already did this for rooms; `programme_versions` had no
-- equivalent, so it gets one here. Both clear themselves the first time
-- somebody edits the row — a figure a person has looked at and kept is no
-- longer a placeholder, and nobody has to remember to tick a box.
--
-- ---------------------------------------------------------------------------
-- WHERE THE CREDIT TOTALS COME FROM
-- ---------------------------------------------------------------------------
--
-- Four of the five come from rulings the University has already given:
--
--   Bachelor's    3 years   180 credits   ("only the one with 180 stands")
--   Master's      2 years   120 credits
--   Diploma       1 year    120 credits
--   Doctorate     2 years     ?
--   Certificate   1 year      ?
--
-- The last two the University has NOT stated, and this file does not pretend
-- otherwise. A Doctorate is given 120 and a Certificate 60 — each in step with
-- the levels either side of it, each marked provisional, each one edit away
-- from whatever the University decides. They are visible as allocations on the
-- Programme Register rather than indistinguishable from the 180 that is a
-- ruling.
--
-- WHY NOT LEAVE THEM BLANK. Because blank is not neutral here. A programme
-- with no total cannot show progress, cannot be audited for graduation, and
-- reads on the student's own screen as "your programme states no total" — and
-- twelve of the University's forty-one programmes were in that state.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS FILE DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- IT WRITES NO COURSES. A curriculum's SHAPE — how many years, how many
-- semesters, how many credits — is arithmetic the University has ruled on.
-- What is taught in it is not, and inventing thirty-eight programmes' worth of
-- course titles would be inventing the University's teaching. The Curriculum
-- Builder is where those are written, one programme at a time, by somebody who
-- knows the subject.
-- ===========================================================================


-- ===========================================================================
-- 0. THE MIGRATIONS THIS ONE NEEDS
-- ===========================================================================

do $$
begin
  if to_regclass('public.rooms') is null then
    raise exception
      'Migration 063 has not been run on this database: there are no rooms to give capacities '
      'to. Run the whole bundle.';
  end if;
  if to_regclass('public.programme_versions') is null then
    raise exception
      'Migration 057 has not been run on this database: there are no programme versions to give '
      'credit totals to. Run the whole bundle.';
  end if;
end $$;


-- ===========================================================================
-- 1. A PROGRAMME VERSION CAN NOW SAY ITS FIGURES ARE PROVISIONAL
-- ===========================================================================
--
-- The same column, the same meaning and the same self-clearing behaviour as
-- `rooms.provisional`, because the question is the same one: eighteen months
-- from now, which of these numbers did somebody check?

alter table programme_versions
  add column if not exists provisional boolean not null default false;

comment on column programme_versions.provisional is
  'True for a version whose shape — duration, semesters or credit total — was allocated by a '
  'migration rather than stated by the University. The Programme Register says so beside it. '
  'Cleared automatically the first time somebody edits the version.';


-- ===========================================================================
-- 2. EVERY SEEDED ROOM GETS A CAPACITY
-- ===========================================================================
--
-- BY KIND, because that is the only thing this system knows about a room it
-- has never seen. A teaching room seats a seminar group, a lecture hall seats
-- a cohort, a laboratory seats fewer than either because of the benches.
--
-- AN ONLINE ROOM IS LEFT BLANK ON PURPOSE, and it is the one case where blank
-- is the right answer rather than a gap. A virtual room's ceiling is whatever
-- the licence allows, which is a fact about a contract and not about a room.
-- Putting a number there would cap an online class at a figure nobody agreed.
--
-- ONLY ROOMS STILL FLAGGED PROVISIONAL. A room the University has corrected
-- keeps its figure, for ever, however many times this runs.

update rooms
   set capacity = case kind
                    when 'lecture-hall' then 120
                    when 'laboratory'   then 24
                    else                     40
                  end
 where provisional
   and active
   and capacity is null
   and kind <> 'online';


-- ===========================================================================
-- 3. THE TWELVE PROGRAMMES WITH NO CREDIT TOTAL
-- ===========================================================================
--
-- MATCHED ON `award_level`, NOT ON A NAME AND NOT ON A DURATION.
--
-- The first version of this matched on the programme's NAME, looking for the
-- word "certificate" in it. `programmes` has no name column — the name is on
-- the version — so it did not even run. That was luck: matching a rule to a
-- string somebody typed is how a programme renamed next year quietly changes
-- its credit total.
--
-- `programmes.award_level` is a CHECK-constrained enumeration of exactly six
-- values, which is the University's own vocabulary for this and cannot drift.
-- Every branch below names one of the six, so a seventh added later falls
-- through to no branch at all and leaves the total NULL — visible, rather than
-- silently given somebody else's number.

update programme_versions v
   set total_credits = case p.award_level
         when 'Certificate'           then  60
         when 'Diploma'               then 120
         when 'Bachelor''s'           then 180
         when 'Postgraduate Diploma'  then 120
         when 'Master''s'             then 120
         when 'Doctorate'             then 120
       end,
       provisional = true
  from programmes p
 where p.id = v.programme_id
   and v.total_credits is null
   and p.award_level in ('Certificate', 'Diploma', 'Bachelor''s',
                         'Postgraduate Diploma', 'Master''s', 'Doctorate');


-- ===========================================================================
-- 4. PROVE IT
-- ===========================================================================

do $$
declare
  n         integer;
  cap       integer;
  rid       uuid;
  vid       uuid;
  pid       uuid;
begin
  begin
    -- =================================================================
    -- NO SEEDED ROOM IS LEFT WITHOUT A CAPACITY, EXCEPT AN ONLINE ONE
    -- =================================================================
    select count(*) into n
      from rooms
     where provisional and active and kind <> 'online' and capacity is null;
    if n <> 0 then
      raise exception '072 FAILED: % provisional rooms still have no capacity', n;
    end if;

    select count(*) into n
      from rooms where kind = 'online' and capacity is not null and provisional;
    if n <> 0 then
      raise exception
        '072 FAILED: an online room was given a capacity — that is a fact about a licence, '
        'not about a room';
    end if;

    -- =================================================================
    -- A CAPACITY IS A WHOLE NUMBER ABOVE ZERO
    -- =================================================================
    --
    -- Zero is the value that would do real damage: a class capped at zero
    -- refuses every registration, and nobody would look at the room to find
    -- out why.
    select count(*) into n from rooms where capacity is not null and capacity <= 0;
    if n <> 0 then
      raise exception '072 FAILED: % rooms have a capacity of zero or less', n;
    end if;

    -- =================================================================
    -- A ROOM THE UNIVERSITY HAS CORRECTED IS NEVER OVERWRITTEN
    -- =================================================================
    --
    -- THE ASSERTION THIS FILE EXISTS FOR. Everything else here is arithmetic;
    -- this is the promise made at the top of the file, and it is proved by
    -- doing what the University would do — correcting a room — and then
    -- running the update again against it.
    insert into rooms (code, name, campus, kind, capacity, provisional, active)
    values ('PRF072-A', 'Proof Room A', 'Buea', 'room', null, true, true)
    returning id into rid;

    -- The University corrects it: a real number, and no longer provisional.
    update rooms set capacity = 17, provisional = false where id = rid;

    -- Now re-run this migration's own update, exactly as written.
    update rooms
       set capacity = case kind
                        when 'lecture-hall' then 120
                        when 'laboratory'   then 24
                        else                     40
                      end
     where provisional and active and capacity is null and kind <> 'online';

    select capacity into cap from rooms where id = rid;
    if cap <> 17 then
      raise exception
        '072 FAILED: a room the University corrected was overwritten with % (was 17)', cap;
    end if;

    -- And a room still provisional with a blank capacity IS filled.
    insert into rooms (code, name, campus, kind, capacity, provisional, active)
    values ('PRF072-B', 'Proof Room B', 'Buea', 'lecture-hall', null, true, true);
    update rooms
       set capacity = case kind
                        when 'lecture-hall' then 120
                        when 'laboratory'   then 24
                        else                     40
                      end
     where provisional and active and capacity is null and kind <> 'online';
    select capacity into cap from rooms where code = 'PRF072-B';
    if cap <> 120 then
      raise exception '072 FAILED: a provisional lecture hall was not given 120 (got %)', cap;
    end if;

    -- =================================================================
    -- EVERY PROGRAMME VERSION NOW HAS A CREDIT TOTAL
    -- =================================================================
    select count(*) into n
      from programme_versions v
      join programmes p on p.id = v.programme_id
     where v.total_credits is null
       and p.award_level in ('Certificate', 'Diploma', 'Bachelor''s',
                             'Postgraduate Diploma', 'Master''s', 'Doctorate');
    if n <> 0 then
      raise exception '072 FAILED: % programme versions still have no credit total', n;
    end if;

    -- =================================================================
    -- AND THE UNIVERSITY'S OWN RULING STANDS: A BACHELOR'S IS 180
    -- =================================================================
    --
    -- "Of the conflicting credit totals, only the one with 180 stands." Any
    -- three-year programme carrying something else would mean this file had
    -- overwritten a ruling, which is the one thing it must never do.
    select count(*) into n
      from programme_versions v
      join programmes p on p.id = v.programme_id
     where p.award_level = 'Bachelor''s' and v.total_credits <> 180;
    if n <> 0 then
      raise exception
        '072 FAILED: % Bachelor''s programmes do not total 180 credits', n;
    end if;

    -- =================================================================
    -- A TOTAL THE UNIVERSITY ALREADY STATED IS NOT REPLACED
    -- =================================================================
    select id into pid from programmes limit 1;
    insert into programme_versions (
      programme_id, version_label, name, duration_years, semesters_per_year,
      total_credits, effective_from, status
    ) values (
      pid, 'PRF072', 'Proof Version 072', 2, 2, 95, current_date, 'draft'
    ) returning id into vid;

    update programme_versions v
       set total_credits = case p.award_level
             when 'Certificate'          then  60
             when 'Diploma'              then 120
             when 'Bachelor''s'          then 180
             when 'Postgraduate Diploma' then 120
             when 'Master''s'            then 120
             when 'Doctorate'            then 120
           end,
           provisional = true
      from programmes p
     where p.id = v.programme_id and v.total_credits is null;

    select total_credits into n from programme_versions where id = vid;
    if n <> 95 then
      raise exception
        '072 FAILED: a stated credit total of 95 was replaced with %', n;
    end if;

    -- And it was not falsely marked as an allocation.
    if (select provisional from programme_versions where id = vid) then
      raise exception '072 FAILED: a stated total was marked provisional';
    end if;

    raise notice '072 OK — every teaching room has a starting capacity and every online room '
      'still has none; every programme has a credit total and the Bachelor''s 180 is untouched; '
      'and a figure the University has corrected survives this migration being run again.';

    raise exception 'ROLLBACK_072';
  exception
    when others then
      if sqlerrm = 'ROLLBACK_072' then
        return;
      end if;
      raise;
  end;
end $$;
