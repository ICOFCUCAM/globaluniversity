-- ===========================================================================
-- 059 — THE ACADEMIC CALENDAR
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- A REGISTRATION STOPS GUESSING WHICH YEAR IT BELONGS TO, and it has been
-- guessing wrong.
--
-- The University's ruling: "USE the western system, august 15 and january 2."
-- Semester 1 opens on 15 August. Semester 2 opens on 2 January. The academic
-- year is therefore 15 August to 14 August, and it is written 2026/2027.
--
-- ---------------------------------------------------------------------------
-- THE BUG THIS FIXES, AND IT IS LIVE TODAY
-- ---------------------------------------------------------------------------
--
-- src/components/courses/CourseRegistration.tsx dates a registration like this:
--
--     /** The academic year a registration defaults to. */
--     const thisYear = () => new Date().getFullYear();
--
-- That is the CALENDAR year. Under the ruling above, Semester 1 of 2026/2027
-- runs from 15 August 2026 to 1 January 2027 — so it straddles New Year, and:
--
--   a student registering in December 2026 is recorded against 2026
--   a student registering in January 2027, FOR THE SAME SEMESTER, against 2027
--
-- One cohort, one term, two academic years. And `semester_gpas` is keyed on
-- (student_id, academic_year, semester), so that student's grade point average
-- is computed TWICE for one semester, each time over half their courses, and
-- the transcript reads both.
--
-- Nobody would find this by reading the code. It is a defect that only appears
-- in January, only for students who register late, and it produces a wrong
-- number rather than an error.
--
-- ---------------------------------------------------------------------------
-- NOTHING HERE IS INVENTED, AND THAT IS WHY THE SEEDING IS SAFE
-- ---------------------------------------------------------------------------
--
-- Two dates were given. Everything below is those two dates applied:
--
--   Semester 1 opens 15 August       — stated
--   Semester 2 opens 2 January       — stated
--   Semester 1 therefore ENDS 1 January, the day before Semester 2 opens
--   Semester 2 therefore ENDS 14 August, the day before the next year opens
--   the academic year therefore runs 15 August to 14 August
--
-- No end date is guessed. A semester ends when the next one begins, which is
-- the only answer the two stated dates support.
--
-- WHAT IS NOT SEEDED is the inside of a term. The University's own example has
-- registration opening a month before teaching and results closing a fortnight
-- after examinations — real dates, and it has not stated them. So
-- `academic_periods` is created and left EMPTY, exactly as 057 left the
-- approving body empty until the University named it.
-- ===========================================================================


-- ===========================================================================
-- 1. THE YEAR
-- ===========================================================================

create table if not exists academic_years (
  id          uuid primary key default gen_random_uuid(),
  -- '2026/2027'. The form the University writes and a transcript prints.
  -- `academic_honours.academic_year` is already text in exactly this shape.
  label       text not null unique check (label ~ '^\d{4}/\d{4}$'),
  -- THE STARTING CALENDAR YEAR, as an integer. The five tables that already
  -- carry `academic_year integer` — enrollments, semester_gpas and three more —
  -- cannot hold '2026/2027', and changing their type would rewrite live rows
  -- for no gain. So the integer means THE YEAR THE ACADEMIC YEAR OPENS IN, and
  -- section 5 makes every writer derive it rather than reach for the clock.
  starts_in   integer not null unique check (starts_in between 1900 and 2200),
  starts_on   date not null,
  ends_on     date not null,
  status      text not null default 'planning'
                check (status in ('planning', 'current', 'closed')),
  created_at  timestamptz not null default now(),

  constraint academic_years_run_forwards check (ends_on > starts_on),
  constraint academic_years_label_matches_year
    check (label = starts_in::text || '/' || (starts_in + 1)::text)
);

comment on table academic_years is
  'The University''s academic years, on the western calendar: 15 August to 14 August, written '
  '2026/2027. `starts_in` is the integer the existing academic_year columns hold — 2026 means '
  '2026/2027, so a January registration files under the year the term OPENED in.';


-- ===========================================================================
-- 2. THE TERMS INSIDE IT
-- ===========================================================================

create table if not exists academic_terms (
  id                uuid primary key default gen_random_uuid(),
  academic_year_id  uuid not null references academic_years (id) on delete cascade,
  -- 1 and 2. The same integer `enrollments.semester` and `semester_gpas.semester`
  -- already hold, so nothing has to be translated at the join.
  sequence          integer not null check (sequence between 1 and 4),
  name              text not null check (length(btrim(name)) >= 3),
  starts_on         date not null,
  ends_on           date not null,
  created_at        timestamptz not null default now(),

  unique (academic_year_id, sequence),
  constraint academic_terms_run_forwards check (ends_on > starts_on)
);

create index if not exists academic_terms_by_date on academic_terms (starts_on, ends_on);

-- TWO TERMS OF ONE YEAR MAY NOT OVERLAP. An overlap is a date that belongs to
-- two semesters, and every question this table exists to answer — which term
-- is this, when does registration close — then has two answers.
create or replace function refuse_overlapping_terms()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  clash text;
begin
  -- ---------------------------------------------------------------------
  -- COMPARED BY SEQUENCE, NOT BY ID, AND THAT IS NOT A DETAIL.
  --
  -- This read `t.id <> new.id`, which is right for an UPDATE and useless for
  -- an INSERT: a re-inserted row carries a fresh id, so on the second run of
  -- this migration the trigger looked at the Semester 1 already sitting there,
  -- saw a different id, and refused — BEFORE `on conflict … do nothing` ever
  -- got the chance to skip it.
  --
  -- The migration was therefore not idempotent, which is the one property
  -- every file in this directory is required to have. It passed its first run
  -- and failed its second.
  --
  -- (academic_year_id, sequence) is unique, so any OTHER term in the same year
  -- necessarily has a different sequence. Excluding by that excludes exactly
  -- the row being written, whether it is new or not.
  -- ---------------------------------------------------------------------
  select t.name into clash
    from academic_terms t
   where t.academic_year_id = new.academic_year_id
     and t.sequence <> new.sequence
     and t.starts_on <= new.ends_on
     and t.ends_on   >= new.starts_on
   limit 1;

  if clash is not null then
    raise exception
      'These dates overlap %, which is in the same academic year. A day cannot belong to two '
      'semesters — every question this calendar answers would then have two answers.', clash
      using errcode = 'check_violation';
  end if;

  -- AND A TERM LIES INSIDE ITS YEAR. A semester running past the end of the
  -- year it belongs to is how a registration lands in the wrong one.
  if exists (select 1 from academic_years y
              where y.id = new.academic_year_id
                and (new.starts_on < y.starts_on or new.ends_on > y.ends_on)) then
    raise exception
      'This term falls outside the academic year it belongs to.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists academic_terms_do_not_overlap on academic_terms;
create trigger academic_terms_do_not_overlap
  before insert or update on academic_terms
  for each row execute function refuse_overlapping_terms();


-- ===========================================================================
-- 3. AND THE PERIODS INSIDE A TERM — EMPTY, ON PURPOSE
-- ===========================================================================
--
-- The University's own example:
--
--     Registration    01 September – 15 October
--     Teaching        01 October    – 15 January
--     Examinations    18 January    – 30 January
--     Results         01 February   – 15 February
--
-- Note that registration OPENS BEFORE THE TERM DOES and results close after it
-- ends. So a period is not constrained to sit inside its term — that would
-- refuse the University's own example on the first insert.
--
-- WHY A TABLE AND NOT FOUR PAIRS OF COLUMNS ON `academic_terms`. "Is
-- registration open?" has to be one query. Four column pairs make it four
-- special cases, and the Registration Engine's twelfth check — registration
-- period — would be written differently by every caller that needs it.
--
-- NOTHING IS SEEDED. The two dates the University gave place the TERMS. It has
-- not given the dates inside them, and a plausible registration window is
-- exactly the kind of invention that is quoted back to a university by a
-- student who missed a deadline that was never real.

create table if not exists academic_periods (
  id          uuid primary key default gen_random_uuid(),
  term_id     uuid not null references academic_terms (id) on delete cascade,
  kind        text not null check (kind in
                ('registration', 'add-drop', 'teaching', 'examinations', 'results', 'break')),
  starts_on   date not null,
  ends_on     date not null,
  note        text,
  created_at  timestamptz not null default now(),

  unique (term_id, kind),
  constraint academic_periods_run_forwards check (ends_on > starts_on)
);

comment on table academic_periods is
  'Registration, teaching, examinations and results windows within a term. EMPTY on arrival: the '
  'University has stated when its SEMESTERS open, not when registration does, and a plausible '
  'deadline that was never agreed is worse than none.';


-- ===========================================================================
-- 4. THE YEARS THEMSELVES, FROM THE RULE
-- ===========================================================================
--
-- Generated, not chosen. Every row below is the University's two dates applied
-- to a calendar year, which is why seeding this is safe where seeding a
-- programme was not: nothing here is a decision.
--
--   15 August  Y      Semester 1 opens
--    1 January Y+1    Semester 1 closes — the day before Semester 2 opens
--    2 January Y+1    Semester 2 opens
--   14 August  Y+1    Semester 2 closes — the day before the next year opens
--
-- FROM 2015, not from this year. The University has ruled that "the 2020
-- transcript governs" in a dispute, so records reaching back to 2020 exist and
-- must have a year to belong to. Through 2035 so that nobody has to run a
-- migration to open next September.

do $$
declare
  y        integer;
  year_id  uuid;
begin
  for y in 2015..2035 loop
    insert into academic_years (label, starts_in, starts_on, ends_on, status)
    values (y::text || '/' || (y + 1)::text, y,
            make_date(y, 8, 15), make_date(y + 1, 8, 14), 'planning')
    on conflict (starts_in) do nothing;

    select id into year_id from academic_years where starts_in = y;

    insert into academic_terms (academic_year_id, sequence, name, starts_on, ends_on)
    values (year_id, 1, 'Semester 1', make_date(y, 8, 15), make_date(y + 1, 1, 1))
    on conflict (academic_year_id, sequence) do nothing;

    insert into academic_terms (academic_year_id, sequence, name, starts_on, ends_on)
    values (year_id, 2, 'Semester 2', make_date(y + 1, 1, 2), make_date(y + 1, 8, 14))
    on conflict (academic_year_id, sequence) do nothing;
  end loop;
end $$;

-- ONE YEAR IS CURRENT, and it is decided by the date rather than by somebody
-- remembering to change it every August. A status column nobody updates is a
-- status column that lies from the second week of term.
update academic_years
   set status = case
     when current_date between starts_on and ends_on then 'current'
     when ends_on < current_date then 'closed'
     else 'planning'
   end;

create unique index if not exists academic_years_one_current
  on academic_years (status) where status = 'current';


-- ===========================================================================
-- 5. WHICH TERM IS A GIVEN DAY IN?
-- ===========================================================================
--
-- The whole point of the file. One function, so that every screen and every
-- route asks the calendar the same question and gets the same answer — instead
-- of each one reaching for `new Date().getFullYear()` and being wrong in
-- January in its own way.

create or replace function academic_term_on(on_day date)
returns table (
  academic_year_id  uuid,
  year_label        text,
  starts_in         integer,
  term_id           uuid,
  term_sequence     integer,
  term_name         text,
  term_starts_on    date,
  term_ends_on      date
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select y.id, y.label, y.starts_in, t.id, t.sequence, t.name, t.starts_on, t.ends_on
    from academic_terms t
    join academic_years y on y.id = t.academic_year_id
   where on_day between t.starts_on and t.ends_on
   order by t.starts_on
   limit 1;
$$;

comment on function academic_term_on(date) is
  'The academic year and semester a date falls in. Every writer of enrollments.academic_year '
  'must take the figure from here: the calendar year is NOT the academic year, and a Semester 1 '
  'that straddles New Year splits one cohort across two years if anybody uses the clock.';

-- AND TODAY, for the screens that only ever want now.
create or replace view academic_term_now
with (security_invoker = true) as
select * from academic_term_on(current_date);


-- ===========================================================================
-- 6. A REGISTRATION KNOWS ITS TERM
-- ===========================================================================
--
-- The integer column stays — five tables use it and rewriting them buys
-- nothing — but a registration now also names the row it belongs to, so the
-- link is a foreign key rather than a convention somebody has to remember.

alter table enrollments
  add column if not exists academic_year_id uuid
    references academic_years (id) on delete restrict;

create index if not exists enrollments_by_academic_year
  on enrollments (academic_year_id) where academic_year_id is not null;

-- BACK-FILLED WHERE IT IS UNAMBIGUOUS. An existing row records an integer and
-- a semester; if a year with that `starts_in` exists, the link is certain.
update enrollments e
   set academic_year_id = y.id
  from academic_years y
 where e.academic_year_id is null
   and e.academic_year = y.starts_in;


-- ===========================================================================
-- 7. WHO CAN READ IT
-- ===========================================================================
--
-- The academic calendar is the most public thing in this system. An applicant
-- deciding whether to apply needs to know when term starts, and a student needs
-- to know when registration closes without signing in to find out.

alter table academic_years   enable row level security;
alter table academic_terms   enable row level security;
alter table academic_periods enable row level security;

drop policy if exists academic_years_read on academic_years;
create policy academic_years_read on academic_years for select using (true);

drop policy if exists academic_terms_read on academic_terms;
create policy academic_terms_read on academic_terms for select using (true);

drop policy if exists academic_periods_read on academic_periods;
create policy academic_periods_read on academic_periods for select using (true);

-- No write policy. The calendar is set through the API, which checks the
-- capability and records who changed it.


-- ===========================================================================
-- 8. PROVE IT
-- ===========================================================================

do $$
declare
  r        record;
  n        integer;
  refused  boolean;
  y2026    uuid;
begin
  -- ---- THE RULE, READ BACK ----------------------------------------------
  select * into r from academic_term_on(make_date(2026, 8, 15));
  if r.year_label <> '2026/2027' or r.term_sequence <> 1 then
    raise exception '059 FAILED: 15 August 2026 is not Semester 1 of 2026/2027, it is % %',
      r.year_label, r.term_sequence;
  end if;

  -- THE DAY BEFORE belongs to the year before. This is the boundary the whole
  -- file turns on, so it is checked from both sides.
  select * into r from academic_term_on(make_date(2026, 8, 14));
  if r.year_label <> '2025/2026' or r.term_sequence <> 2 then
    raise exception '059 FAILED: 14 August 2026 is not Semester 2 of 2025/2026, it is % %',
      r.year_label, r.term_sequence;
  end if;

  select * into r from academic_term_on(make_date(2027, 1, 2));
  if r.year_label <> '2026/2027' or r.term_sequence <> 2 then
    raise exception '059 FAILED: 2 January 2027 is not Semester 2 of 2026/2027';
  end if;

  -- ---- AND THE BUG, NAMED ------------------------------------------------
  -- December and January, one cohort, one semester. Under `getFullYear()`
  -- these are 2026 and 2027; under the calendar they are the same term.
  declare
    december record;
    january  record;
  begin
    select * into december from academic_term_on(make_date(2026, 12, 15));
    select * into january  from academic_term_on(make_date(2026, 12, 31));
    if december.year_label <> january.year_label
       or december.term_sequence <> january.term_sequence then
      raise exception '059 FAILED: one semester split across two academic years';
    end if;
    if december.starts_in <> 2026 then
      raise exception '059 FAILED: December 2026 does not file under 2026, it files under %',
        december.starts_in;
    end if;

    -- 1 JANUARY 2027 IS STILL SEMESTER 1. The calendar year has turned; the
    -- academic one has not. This is the exact day `getFullYear()` got wrong.
    select * into january from academic_term_on(make_date(2027, 1, 1));
    if january.starts_in <> 2026 or january.term_sequence <> 1 then
      raise exception '059 FAILED: 1 January 2027 files under % semester %, not 2026 semester 1',
        january.starts_in, january.term_sequence;
    end if;
  end;

  -- ---- EVERY DAY OF TWENTY-ONE YEARS BELONGS SOMEWHERE --------------------
  -- A gap between 1 and 2 January, or between 14 and 15 August, would be a day
  -- on which nobody could register and no query would say why.
  select count(*) into n
    from generate_series(make_date(2015, 8, 15), make_date(2036, 8, 13), interval '1 day') d
   where not exists (select 1 from academic_term_on(d::date));
  if n > 0 then
    raise exception '059 FAILED: % days fall in no term at all', n;
  end if;

  -- AND NO DAY BELONGS TO TWO.
  -- `overlaps` cannot name this: it is a reserved word in Postgres and the
  -- parser reads it as the OVERLAPS operator.
  select count(*) into n from (
    select t.starts_on from academic_terms t
      join academic_terms u on u.id <> t.id
                           and u.academic_year_id = t.academic_year_id
                           and u.starts_on <= t.ends_on and u.ends_on >= t.starts_on
  ) clashing;
  if n > 0 then
    raise exception '059 FAILED: % terms overlap within their year', n;
  end if;

  -- ---- THE REFUSALS ------------------------------------------------------
  select id into y2026 from academic_years where starts_in = 2026;

  refused := false;
  begin
    insert into academic_terms (academic_year_id, sequence, name, starts_on, ends_on)
      values (y2026, 3, 'An Overlapping Term', make_date(2026, 9, 1), make_date(2026, 10, 1));
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '059 FAILED: a term was added overlapping one already there';
  end if;

  refused := false;
  begin
    insert into academic_terms (academic_year_id, sequence, name, starts_on, ends_on)
      values (y2026, 4, 'A Term Outside Its Year', make_date(2030, 1, 1), make_date(2030, 2, 1));
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '059 FAILED: a term was placed outside the academic year it belongs to';
  end if;

  -- A LABEL THAT DISAGREES WITH ITS OWN YEAR. '2026/2028' is the kind of typo
  -- that is invisible in a list and wrong on a transcript.
  refused := false;
  begin
    insert into academic_years (label, starts_in, starts_on, ends_on)
      values ('2026/2028', 2099, make_date(2099, 8, 15), make_date(2100, 8, 14));
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '059 FAILED: a year was labelled inconsistently with its own starting year';
  end if;

  -- ---- AND THE PERIODS ARE EMPTY -----------------------------------------
  select count(*) into n from academic_periods;
  if n > 0 then
    raise exception '059 FAILED: registration and teaching windows were invented';
  end if;

  raise notice '059 OK: 15 August opens Semester 1 and 2 January opens Semester 2, so the '
               'academic year runs 15 August to 14 August and is written 2026/2027';
  raise notice '059 OK: December and January of one Semester 1 file under the SAME academic '
               'year — the split that getFullYear() caused, and that computed a GPA twice';
  raise notice '059 OK: every day from 2015 to 2036 belongs to exactly one term, and a term '
               'cannot overlap another or fall outside its year';
  raise notice '059 OK: the periods inside a term are empty — the University has stated when '
               'its semesters open, not when registration does';
end $$;


-- ===========================================================================
-- 9. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- WHICH TERM IS IT RIGHT NOW? One row. If this is empty the calendar does not
-- cover today, which would mean the seeded band needs extending.
-- ---------------------------------------------------------------------------
select year_label, term_name, term_starts_on, term_ends_on
  from academic_term_now;

-- ---------------------------------------------------------------------------
-- AND THE NEXT FEW YEARS, so the rule can be read rather than trusted.
-- Semester 1 should open on 15 August and close on 1 January; Semester 2 open
-- on 2 January and close on 14 August.
-- ---------------------------------------------------------------------------
select y.label, y.status, t.name, t.starts_on, t.ends_on
  from academic_years y
  join academic_terms t on t.academic_year_id = y.id
 where y.starts_in between extract(year from current_date)::int - 1
                       and extract(year from current_date)::int + 2
 order by y.starts_in, t.sequence;

-- ---------------------------------------------------------------------------
-- AND WHAT IS STILL TO BE SET. Empty: the University has not stated when
-- registration opens, when teaching runs, when examinations sit or when
-- results are released. Fill it per term, for example:
--
--   insert into academic_periods (term_id, kind, starts_on, ends_on)
--   select t.id, 'registration', date '2026-09-01', date '2026-10-15'
--     from academic_terms t join academic_years y on y.id = t.academic_year_id
--    where y.starts_in = 2026 and t.sequence = 1;
-- ---------------------------------------------------------------------------
select count(*) as periods_recorded from academic_periods;
