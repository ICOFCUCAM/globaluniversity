-- ===========================================================================
-- 065 — THE YEAR THAT CANNOT LIE
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- NOTHING VISIBLE TODAY, AND THAT IS THE POINT. This migration stops a fault
-- that has not gone off yet: on 15 August 2027, three screens would have
-- quietly opened on the wrong academic year and nobody would have been told.
--
-- After this runs, "which academic year is it" is answered by the DATES, every
-- time it is asked, and the answer cannot go stale. The Academic Calendar
-- screen also gains the ability to say when the stored status and the calendar
-- disagree, and to put them back in step.
--
-- ---------------------------------------------------------------------------
-- THE FAULT, EXACTLY
-- ---------------------------------------------------------------------------
--
-- 059 wrote this, and the comment above it is the giveaway:
--
--   -- ONE YEAR IS CURRENT, and it is decided by the date rather than by
--   -- somebody remembering to change it every August.
--   update academic_years
--      set status = case
--        when current_date between starts_on and ends_on then 'current'
--        ...
--
-- It IS decided by the date — ONCE, on the day the migration runs. After that
-- it is a stored value that nothing updates, which is precisely the thing the
-- comment says it is not. The comment goes on: "A status column nobody updates
-- is a status column that lies from the second week of term." It was right,
-- and it was describing itself.
--
-- Today the column happens to be correct, because the migration ran during
-- 2026/2027. On 15 August 2027 it will still say 2026/2027, and
-- CourseOfferings, TimetableGrid and AcademicOverview all open on
-- `status = 'current'`. Three screens, wrong year, no error, no warning — the
-- worst shape of bug this system can have.
--
-- ---------------------------------------------------------------------------
-- THE FIX IS TO DERIVE IT, NOT TO REMEMBER TO UPDATE IT
-- ---------------------------------------------------------------------------
--
-- 059 already had the right idea one level down: `academic_term_on(date)`
-- derives the TERM from the dates and is therefore incapable of being stale.
-- The year gets the same treatment.
--
-- `academic_year_now` is a view over the dates. There is no column to forget
-- to update, no August morning on which somebody has to remember, and no
-- second source of truth.
--
-- ---------------------------------------------------------------------------
-- SO WHAT IS `status` FOR NOW?
-- ---------------------------------------------------------------------------
--
-- A REAL ADMINISTRATIVE ACT, and it keeps its column. Closing a year is
-- something the Registry DOES — after the last board has sat and the last
-- result is approved — and it is not the same event as the year ending on the
-- calendar. A year can be over and still open while the marks come in.
--
-- What changes is which question it answers. It no longer answers "which year
-- is it" — the dates do. It answers "has the Registry finished with it".
--
-- AND THE TWO CAN NOW DISAGREE VISIBLY. `academic_year_drift` lists every year
-- whose stored status does not match where the calendar actually is. That is
-- the report that would have caught this fault in 2027 without anybody
-- noticing three screens were wrong.
-- ===========================================================================


-- ===========================================================================
-- 0. THE MIGRATION THIS ONE NEEDS
-- ===========================================================================

do $$
begin
  if to_regclass('public.academic_years') is null then
    raise exception
      'Migration 059 has not been run on this database: there is no academic calendar to '
      'correct. Run 059_the_academic_calendar.sql first, or run the whole bundle.';
  end if;
end $$;


-- ===========================================================================
-- 1. WHICH YEAR IS IT? — ASKED OF THE DATES
-- ===========================================================================
--
-- The counterpart to 059's `academic_term_now`, one level up. Between them a
-- screen can ask "which year and which semester" and get an answer that is
-- true on the day it is asked rather than on the day a migration ran.
--
-- ZERO ROWS IS A LEGITIMATE ANSWER. Today may fall outside every year the
-- calendar covers — 059 seeds 2015 to 2035, and 2036 arrives eventually. A
-- view returning nothing says so honestly; a stored column would go on naming
-- a year that ended a decade earlier.

create or replace view academic_year_now
with (security_invoker = true) as
select id, label, starts_in, starts_on, ends_on, status
  from academic_years
 where current_date between starts_on and ends_on
 order by starts_on
 limit 1;

comment on view academic_year_now is
  'The academic year today falls in, derived from the dates every time it is asked. Screens read '
  'this rather than `status = ''current''`, which is a stored value that 059 set once and nothing '
  'updates — correct on the day it ran and wrong from the following August.';


-- ===========================================================================
-- 2. WHERE THE STORED STATUS AND THE CALENDAR DISAGREE
-- ===========================================================================
--
-- THE REPORT THAT WOULD HAVE CAUGHT THIS. Not an alarm that has to be wired
-- up — a query anybody can run and the calendar screen shows on every visit.
-- A drifted year is not an error; it is a year somebody has to make a decision
-- about, which is a different thing and is why this reports rather than
-- corrects.
--
-- `should_be` is what the dates say. `status` is what is stored. A row appears
-- only when they differ.

create or replace view academic_year_drift
with (security_invoker = true) as
select y.id,
       y.label,
       y.starts_in,
       y.starts_on,
       y.ends_on,
       y.status,
       case
         when current_date between y.starts_on and y.ends_on then 'current'
         when y.ends_on < current_date                        then 'closed'
         else 'planning'
       end as should_be
  from academic_years y
 where y.status is distinct from (
         case
           when current_date between y.starts_on and y.ends_on then 'current'
           when y.ends_on < current_date                        then 'closed'
           else 'planning'
         end)
 order by y.starts_in;

comment on view academic_year_drift is
  'Years whose stored status no longer matches the calendar. A year still marked current after '
  'its last day, or one still marked planning after its first, is how three screens come to open '
  'on the wrong year in silence.';


-- ===========================================================================
-- 3. PUTTING THEM BACK IN STEP
-- ===========================================================================
--
-- ONE FUNCTION, so that the calendar screen, the API and an operator with psql
-- all perform the same act. The alternative — each of them writing its own
-- UPDATE — is how the three of them come to disagree about what 'closed'
-- means.
--
-- IT RETURNS WHAT IT CHANGED rather than changing things silently. Rolling the
-- year over is a consequential act: registration screens, the timetable and
-- the overview all move to a different year the moment it happens, and the
-- person who pressed the button should be told which years moved.

create or replace function roll_the_academic_year()
returns table (label text, was text, now_is text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- THE ORDER MATTERS, AND THIS IS THE WHOLE REASON THIS IS A FUNCTION.
  --
  -- `academic_years_one_current` is a unique index over status where status =
  -- 'current'. A single UPDATE that moves 2026/2027 out of current and
  -- 2027/2028 into it can be evaluated row by row, and if the incoming row is
  -- written before the outgoing one the index sees two current years and the
  -- whole statement fails.
  --
  -- So the leaving year is stood down first, in its own statement, and only
  -- then is the arriving year stood up.
  create temp table rolled_years on commit drop as
  select y.id,
         y.label as y_label,
         y.status as was,
         case
           when current_date between y.starts_on and y.ends_on then 'current'
           when y.ends_on < current_date                        then 'closed'
           else 'planning'
         end as should_be
    from academic_years y;

  update academic_years y
     set status = r.should_be
    from rolled_years r
   where r.id = y.id
     and r.should_be <> 'current'
     and y.status is distinct from r.should_be;

  update academic_years y
     set status = r.should_be
    from rolled_years r
   where r.id = y.id
     and r.should_be = 'current'
     and y.status is distinct from r.should_be;

  return query
    select r.y_label, r.was, r.should_be
      from rolled_years r
     where r.was is distinct from r.should_be
     order by r.y_label;
end $$;

comment on function roll_the_academic_year() is
  'Brings every year''s stored status into line with the calendar, and returns what moved. Stands '
  'the leaving year down BEFORE standing the arriving one up: academic_years_one_current is a '
  'unique index, and a single UPDATE doing both can be evaluated in the order that trips it.';


-- ===========================================================================
-- 4. AND THE STATUSES ARE CORRECT AS OF NOW
-- ===========================================================================
--
-- Running the function rather than repeating 059's UPDATE, so that the act
-- performed by the migration is the same act the screen performs. A migration
-- that does the thing its own way is a migration that has not tested the way
-- everybody else does it.

do $$
declare
  moved integer;
begin
  select count(*) into moved from roll_the_academic_year();
  if moved > 0 then
    raise notice '065 — % academic year(s) had drifted and were brought into line', moved;
  end if;
end $$;


-- ===========================================================================
-- 5. PROVE IT
-- ===========================================================================

do $$
declare
  n         integer;
  now_label text;
  drifted   integer;
  a_id      uuid;
  b_id      uuid;
begin
  begin
    -- ---- THE VIEW NAMES THE YEAR TODAY IS IN --------------------------
    select label into now_label from academic_year_now;
    if now_label is null then
      raise exception
        '065 FAILED: today falls in no academic year the calendar covers. 059 seeds 2015 to '
        '2035 — if today is outside that, the calendar needs extending.';
    end if;

    select count(*) into n from academic_year_now;
    if n <> 1 then
      raise exception '065 FAILED: academic_year_now returned % rows, not 1', n;
    end if;

    -- ---- AND IT AGREES WITH THE TERM VIEW 059 ALREADY HAD --------------
    --
    -- Two derivations of the same fact must not disagree. If they ever do,
    -- one of them is reading different dates and a registration is about to
    -- be filed under the wrong year.
    select count(*) into n
      from academic_year_now y
      join academic_term_now t on t.academic_year_id = y.id;
    if n <> 1 then
      raise exception
        '065 FAILED: academic_year_now and academic_term_now name different years';
    end if;

    -- ---- AFTER ROLLING, NOTHING HAS DRIFTED ---------------------------
    select count(*) into drifted from academic_year_drift;
    if drifted <> 0 then
      raise exception
        '065 FAILED: % year(s) still drifted after roll_the_academic_year()', drifted;
    end if;

    -- ---- PROVE THE DRIFT REPORT BY CAUSING DRIFT ----------------------
    --
    -- A report nobody has watched report anything is a report nobody has
    -- tested. This is the 2027 fault, performed deliberately: mark a year
    -- current that today is not in.
    select id into a_id from academic_years where status = 'current';
    select id into b_id from academic_years
      where starts_on > current_date order by starts_on limit 1;

    update academic_years set status = 'planning' where id = a_id;
    update academic_years set status = 'current'  where id = b_id;

    select count(*) into drifted from academic_year_drift;
    if drifted < 2 then
      raise exception
        '065 FAILED: the calendar was deliberately put out of step and academic_year_drift '
        'reported only % row(s)', drifted;
    end if;

    -- AND THE DERIVED VIEW IS UNMOVED BY THE LIE. This is the assertion that
    -- matters: a stored status saying otherwise must not change which year
    -- the screens open on.
    select label into now_label from academic_year_now;
    if now_label <> (select label from academic_years
                      where current_date between starts_on and ends_on) then
      raise exception
        '065 FAILED: academic_year_now followed the stored status instead of the calendar';
    end if;

    -- ---- AND ROLLING IT PUTS IT BACK ----------------------------------
    perform roll_the_academic_year();
    select count(*) into drifted from academic_year_drift;
    if drifted <> 0 then
      raise exception
        '065 FAILED: roll_the_academic_year() left % year(s) still out of step', drifted;
    end if;

    -- ---- AND STILL ONLY ONE YEAR IS CURRENT ---------------------------
    --
    -- 059's unique index is the guard. Rolling the year over is exactly the
    -- operation that would trip it if the two updates were one.
    select count(*) into n from academic_years where status = 'current';
    if n <> 1 then
      raise exception '065 FAILED: % years are marked current after rolling', n;
    end if;

    raise notice '065 OK — the current year is derived from the dates and ignores a stale '
                 'status; drift is reported; rolling the year over corrects it without ever '
                 'putting two years in charge at once.';

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;
end $$;
