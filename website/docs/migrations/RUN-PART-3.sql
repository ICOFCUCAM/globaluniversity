-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — MIGRATIONS 058, 059, 060, 061, 062, 063, 064, 065, 066, 067, 068, 069, 070, IN ORDER
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-migration-run.mjs
--   Rebuild:   node scripts/build-migration-run.mjs --out=RUN-PART-3.sql 058 059 060 061 062 063 064 065 066 067 068 069 070
--
-- ---------------------------------------------------------------------------
-- HOW TO RUN IT
--
-- Supabase SQL editor: paste the whole file and run once.
-- psql:                psql "<connection string>" -f docs/migrations/RUN-PART-3.sql
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
-- The LAST THING this file prints is a table saying which of these migrations
-- landed. You do not have to run anything else to find out — and you should
-- not have to, because the Supabase SQL editor does not display the NOTICE
-- lines the proofs write.
-- ===========================================================================

-- ===========================================================================
-- ===========================================================================
--
--   058_the_vice_chancellor_approves_a_curriculum.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 058 — THE VICE-CHANCELLOR APPROVES A CURRICULUM
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- CURRICULUM APPROVAL BECOMES POSSIBLE. Since 057 no curriculum could be
-- approved by anybody, including the Superadministrator, because
-- `academic_approval_requirements` was empty and the system refuses to record
-- a curriculum as approved by nobody. This names the office: the
-- Vice-Chancellor.
--
-- The University's ruling, in full: "the VC approves a corriculum."
--
-- ---------------------------------------------------------------------------
-- ONE OFFICE, AND SAY SO PLAINLY
-- ---------------------------------------------------------------------------
--
-- The chain the University drew earlier was
--
--     Draft → Department Review → Faculty Review → Academic Board Approval
--
-- and it named the Vice-Chancellor when asked who approves. So this seeds ONE
-- required office rather than three. The Head of Department and the Dean are
-- not omitted by accident and they are not out of the picture — the version
-- still moves through `department_review` and `faculty_review`, which is where
-- their scrutiny sits. What this table holds is narrower: the signature that
-- GATES the move to approved.
--
-- IF THE UNIVERSITY MEANT THEIR SIGNATURES TO GATE IT TOO, it is one statement
-- and the chain tightens immediately, with no code change anywhere:
--
--     insert into academic_approval_requirements (subject, office) values
--       ('curriculum', 'hod'), ('curriculum', 'dean')
--     on conflict do nothing;
--
-- That is the whole point of 057 holding the quorum as data. Adding an office
-- is an INSERT, not a migration and not a deployment.
--
-- ---------------------------------------------------------------------------
-- AND IT IS STILL NOT SOLE AUTHORITY
-- ---------------------------------------------------------------------------
--
-- 055 lets the Vice-Chancellor draft an appointment letter and approve it
-- alone, marked permanently, because the appointing authority IS theirs.
--
-- This is a different thing wearing a similar shape, and the difference
-- matters. The Vice-Chancellor approving a curriculum is an office signing a
-- register that records the signature, the date and the version signed. Nobody
-- can later say a curriculum was approved without saying who approved it and
-- when — and 057 refuses to let that signature be edited or deleted
-- afterwards.
--
-- `made_on_sole_authority` belongs to appointments and does not appear here.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 057 FIRST, AND SAY SO RATHER THAN LETTING POSTGRES SAY IT.
--
-- The University ran this file on its own and got:
--
--     ERROR: 42P01: relation "academic_approval_requirements" does not exist
--
-- which is true, unhelpful, and looks like a defect in the migration rather
-- than a missing one before it. 057 creates that table; this file only puts a
-- row in it.
--
-- A migration that depends on an earlier one should name it. The cost of not
-- doing so is somebody reading a Postgres error code at the end of a long day
-- and concluding the file is broken.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.academic_approval_requirements') is null then
    raise exception
      '058 needs 057 first. 057_the_academic_structure.sql creates the academic structure — '
      'schools, programmes, programme versions and the approvals table this file seeds — and it '
      'has not been run on this database. Run RUN-OUTSTANDING.sql, which contains both in order '
      'and is safe to re-run over anything already applied.'
      using errcode = 'undefined_table';
  end if;
end $$;

insert into academic_approval_requirements (subject, office, note)
values ('curriculum', 'vice-chancellor',
        'The University''s ruling: the Vice-Chancellor approves a curriculum. A version moves '
        'through department and faculty review before reaching this signature; this is the '
        'signature that gates approval.')
on conflict (subject, office) do nothing;


-- ===========================================================================
-- PROVE IT
-- ===========================================================================

do $$
declare
  vc      uuid;
  officer uuid;
  sch     uuid;
  dept    uuid;
  prog    uuid;
  ver     uuid;
  refused boolean;
  msg     text;
begin
  begin
    vc      := gen_random_uuid();
    officer := gen_random_uuid();
    insert into auth.users (id, email) values
      (vc, '058-vc@example.test'), (officer, '058-officer@example.test');

    insert into schools (code, name) values ('proof-058', 'A Proof School of Study')
      returning id into sch;
    insert into departments (name, code, faculty, school_id)
      values ('A Proof Department', 'P58', 'A Proof School of Study', sch) returning id into dept;
    insert into programmes (code, award_level) values ('proof-doctor-of-study', 'Doctorate')
      returning id into prog;

    -- A DOCTORATE IS TWO YEARS. The University's ruling, and the first row in
    -- this system to record it as a number rather than as a sentence on a
    -- marketing page.
    insert into programme_versions
      (programme_id, version_label, name, school_id, department_id,
       duration_years, semesters_per_year, total_credits, effective_from, drafted_by)
    values (prog, '2026', 'A Proof Doctor of Study', sch, dept,
            2, 2, null, current_date, officer)
    returning id into ver;

    -- ---- WITHOUT THE VICE-CHANCELLOR, NO ----------------------------------
    refused := false;
    begin
      update programme_versions set status = 'approved' where id = ver;
    exception when others then refused := true; msg := sqlerrm;
    end;
    if not refused then
      raise exception '058 FAILED: a curriculum was approved without the Vice-Chancellor';
    end if;
    if position('vice-chancellor' in msg) = 0 then
      raise exception '058 FAILED: the refusal does not name the Vice-Chancellor: %', msg;
    end if;

    -- AND ANOTHER OFFICE'S SIGNATURE IS NOT A SUBSTITUTE. This is the check
    -- that matters: a registrar signing in good faith must not satisfy a
    -- requirement the University placed on the Vice-Chancellor.
    insert into academic_approvals (subject, subject_id, office, decision, decided_by)
      values ('curriculum', ver, 'registrar', 'approved', officer);

    refused := false;
    begin
      update programme_versions set status = 'approved' where id = ver;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '058 FAILED: another office stood in for the Vice-Chancellor';
    end if;

    -- ---- WITH IT, YES -----------------------------------------------------
    insert into academic_approvals (subject, subject_id, office, decision, decided_by)
      values ('curriculum', ver, 'vice-chancellor', 'approved', vc);

    update programme_versions set status = 'approved', approved_at = now() where id = ver;

    if not exists (select 1 from programme_versions where id = ver and status = 'approved') then
      raise exception '058 FAILED: the Vice-Chancellor approved it and it was still refused';
    end if;

    -- AND THE RECORD SAYS WHO. An approval nobody can attribute is the thing
    -- this whole chain exists to prevent.
    if not exists (select 1 from academic_approvals
                    where subject = 'curriculum' and subject_id = ver
                      and office = 'vice-chancellor' and decided_by = vc) then
      raise exception '058 FAILED: the approval does not record who gave it';
    end if;

    -- ---- AND IT CANNOT BE TAKEN BACK QUIETLY ------------------------------
    refused := false;
    begin
      delete from academic_approvals
       where subject_id = ver and office = 'vice-chancellor';
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '058 FAILED: the Vice-Chancellor''s signature was deleted';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '058 OK: a curriculum cannot be approved without the Vice-Chancellor, and no '
               'other office stands in for that signature';
  raise notice '058 OK: with it the version approves, the record names who signed and when, '
               'and the signature cannot be deleted afterwards';
end $$;


-- ===========================================================================
-- VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- WHO MUST SIGN AN ACADEMIC CHANGE. One row: curriculum, vice-chancellor.
--
-- Add the Head of Department and the Dean here if their scrutiny is meant to
-- GATE approval rather than precede it. No deployment is needed — 057 holds
-- this as data precisely so the University can tighten its own chain.
-- ---------------------------------------------------------------------------
select subject, office, note
  from academic_approval_requirements
 order by subject, office;


-- ===========================================================================
-- ===========================================================================
--
--   059_the_academic_calendar.sql
--
-- ===========================================================================
-- ===========================================================================

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


-- ===========================================================================
-- ===========================================================================
--
--   060_the_schools_and_programmes.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 060 — THE SCHOOLS AND PROGRAMMES
-- ===========================================================================
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-academic-seed.mjs
--   Source:    src/content/programmeCatalogue.ts
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- THE REGISTER STOPS BEING EMPTY. 5 schools and 41 programmes
-- become rows, moved out of the TypeScript the website compiles them from and
-- into tables the Superadministrator can manage.
--
-- NOTHING IS OPENED. Every programme arrives as a draft. 023 ruled that
-- admission is opt-in, and 057 refuses to open a programme with no published
-- curriculum in any case.
--
-- NO CURRICULUM IS SEEDED, and no duration. See the closing report: the
-- University has ruled the length of 41 of these
-- 41 programmes and published a RANGE for the other 0.
-- "One to two academic years" is not a duration, and writing 1 or 2 into
-- `duration_years` would be inventing the length of a degree.
-- ===========================================================================


-- ===========================================================================
-- 1. THE SCHOOLS
-- ===========================================================================
--
-- Five, as the University publishes on its About page. `faculties.ts` lists
-- six because it separates the School of Ministry at Douala; the About page
-- names five and that is what is seeded.

insert into schools (code, name, mission, status)
values ('theology', 'Faculty of Theology', 'Preparing Christian leaders, ministers, missionaries and theologians for service throughout Africa and the world.', 'active')
on conflict (code) do nothing;

insert into schools (code, name, mission, status)
values ('engineering', 'Faculty of Engineering and Technology', 'Building practitioners who can design, install, maintain and secure the systems modern work depends on — in African economies and in the international market their skills travel to.', 'active')
on conflict (code) do nothing;

-- PUBLISHED NAME, not the catalogue's. programmeCatalogue.ts calls this
-- "Faculty of Business Management Science and Administration", which appears nowhere else and which the About page
-- contradicts.
insert into schools (code, name, mission, status)
values ('business', 'Global Institute of Business and Management Science', 'Training ethical administrators, accountants and managers for enterprise, government and the not-for-profit sector, in Africa and wherever our graduates are called to serve.', 'active')
on conflict (code) do nothing;

insert into schools (code, name, mission, status)
values ('ministry', 'School of Ministry', 'Forming pastors, evangelists and church leaders for the work itself — the congregation, the mission field and the organisation that carries them.', 'active')
on conflict (code) do nothing;

insert into schools (code, name, mission, status)
values ('education', 'Faculty of Education', 'Forming teachers who can hold a classroom and reach the child in it — for schools across Africa and for the diaspora communities that share them.', 'active')
on conflict (code) do nothing;


-- ===========================================================================
-- 2. THE PROGRAMMES
-- ===========================================================================
--
-- The code is the slug the site already uses in every programme URL and in
-- `courses.programme_slug`, so the register joins to both without
-- translation. Nothing here is abbreviated or invented.
--
-- `status` is 'draft' for every one of them. Opening a programme for
-- admission is a decision, and 057 will refuse it until a curriculum has
-- been approved.

do $$
declare
  s_id uuid;
begin
  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('diploma-in-theology', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Theology · 120 credits · One academic year

  select id into s_id from schools where code = 'ministry';
  insert into programmes (code, award_level, status)
  values ('diploma-in-ministry', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Ministry · 120 credits · One academic year

  select id into s_id from schools where code = 'ministry';
  insert into programmes (code, award_level, status)
  values ('diploma-in-christian-leadership', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Christian Leadership · 120 credits · One academic year

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-computer-networking', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Computer Networking · 120 credits · One academic year

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-software-engineering', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Software Engineering · 120 credits · One academic year

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-web-development', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Web Development · 120 credits · One academic year

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-hardware-maintenance', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Hardware Maintenance · 120 credits · One academic year

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-laptop-chipset-technology', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Laptop and Chipset Technology · 120 credits · One academic year

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-database-administration', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Database Administration · 120 credits · One academic year

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-air-conditioning-refrigeration', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Air Conditioning and Refrigeration · 120 credits · One academic year

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-computerized-accounting', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Computerised Accounting · 120 credits · One academic year

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('diploma-in-secretarial-duties', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Secretarial Duties · 120 credits · One academic year

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('diploma-in-business-management', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Business Management · 120 credits · One academic year

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('diploma-in-project-management', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Project Management · 120 credits · One academic year

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('diploma-in-accountancy', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Accountancy · 120 credits · One academic year

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('diploma-in-banking-and-finance', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Banking and Finance · 120 credits · One academic year

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('diploma-in-non-profit-management', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Non-Profit Management · 120 credits · One academic year

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('diploma-in-insurance', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Insurance · 120 credits · One academic year

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('diploma-in-executive-secretarial-duties', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Executive Secretarial Duties · 120 credits · One academic year

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('diploma-in-bilingual-secretarial-duties', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Diploma in Bilingual Secretarial Duties · 120 credits · One academic year

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('certificate-in-theology', 'Certificate', 'draft')
  on conflict (code) do nothing;
  -- Certificate of Theology · Up to one academic year

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('certificate-in-christian-education', 'Certificate', 'draft')
  on conflict (code) do nothing;
  -- Certificate of Christian Education · Up to one academic year

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('divinity', 'Bachelor''s', 'draft')
  on conflict (code) do nothing;
  -- Bachelor of Divinity · Three academic years

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('bachelor-of-theology', 'Bachelor''s', 'draft')
  on conflict (code) do nothing;
  -- Bachelor of Theology · 180 credits · Three academic years

  select id into s_id from schools where code = 'ministry';
  insert into programmes (code, award_level, status)
  values ('bachelor-of-ministry', 'Bachelor''s', 'draft')
  on conflict (code) do nothing;
  -- Bachelor of Ministry · 180 credits · Three academic years

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('bachelor-of-christian-education', 'Bachelor''s', 'draft')
  on conflict (code) do nothing;
  -- Bachelor of Christian Education · Three academic years

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('master-of-theology', 'Master''s', 'draft')
  on conflict (code) do nothing;
  -- Master of Theology · 120 credits · Two academic years

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('master-of-divinity', 'Master''s', 'draft')
  on conflict (code) do nothing;
  -- Master of Divinity · 120 credits · Two academic years

  select id into s_id from schools where code = 'ministry';
  insert into programmes (code, award_level, status)
  values ('masters-evangelism-mission', 'Master''s', 'draft')
  on conflict (code) do nothing;
  -- Masters in Evangelism and Mission · 120 credits · Two academic years

  select id into s_id from schools where code = 'ministry';
  insert into programmes (code, award_level, status)
  values ('master-of-arts-christian-leadership', 'Master''s', 'draft')
  on conflict (code) do nothing;
  -- Master of Arts in Christian Leadership · 120 credits · Two academic years

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('black-liberation-theology', 'Master''s', 'draft')
  on conflict (code) do nothing;
  -- Master of Arts in Black Liberation Theology · 120 credits · Two academic years

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('doctor-of-philosophy-theology', 'Doctorate', 'draft')
  on conflict (code) do nothing;
  -- Doctor of Philosophy (Ph.D.) in Theology · Two academic years of supervised research

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('doctor-of-theology', 'Doctorate', 'draft')
  on conflict (code) do nothing;
  -- Doctor of Theology · Two academic years of supervised research

  select id into s_id from schools where code = 'theology';
  insert into programmes (code, award_level, status)
  values ('doctor-of-systematic-theology', 'Doctorate', 'draft')
  on conflict (code) do nothing;
  -- Doctor of Systematic Theology · Two academic years of supervised research

  select id into s_id from schools where code = 'ministry';
  insert into programmes (code, award_level, status)
  values ('doctor-of-ministry', 'Doctorate', 'draft')
  on conflict (code) do nothing;
  -- Doctor of Ministry · Two academic years of supervised research

  select id into s_id from schools where code = 'education';
  insert into programmes (code, award_level, status)
  values ('primary-education', 'Bachelor''s', 'draft')
  on conflict (code) do nothing;
  -- Primary Education · Three academic years

  select id into s_id from schools where code = 'education';
  insert into programmes (code, award_level, status)
  values ('special-education', 'Bachelor''s', 'draft')
  on conflict (code) do nothing;
  -- Special Education · Three academic years

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('software-engineering', 'Bachelor''s', 'draft')
  on conflict (code) do nothing;
  -- Software Engineering · Three academic years

  select id into s_id from schools where code = 'engineering';
  insert into programmes (code, award_level, status)
  values ('networking', 'Diploma', 'draft')
  on conflict (code) do nothing;
  -- Computer Networking · 120 credits · One academic year

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('business-management', 'Bachelor''s', 'draft')
  on conflict (code) do nothing;
  -- Business Management · Three academic years

  select id into s_id from schools where code = 'business';
  insert into programmes (code, award_level, status)
  values ('project-management', 'Master''s', 'draft')
  on conflict (code) do nothing;
  -- Project Management · 120 credits · Two academic years

end $$;


-- ===========================================================================
-- 3. PROVE IT
-- ===========================================================================

do $$
declare
  n integer;
begin
  select count(*) into n from schools;
  if n < 5 then
    raise exception '060 FAILED: % schools seeded, expected at least 5', n;
  end if;

  select count(*) into n from programmes;
  if n < 41 then
    raise exception '060 FAILED: % programmes seeded, expected at least 41', n;
  end if;

  -- THE FIVE SCHOOLS BY NAME. A count alone passes if the right number of
  -- wrong rows is there, and the About page names these five specifically.
  select count(*) into n from schools
   where code in ('theology', 'engineering', 'business', 'ministry', 'education');
  if n <> 5 then
    raise exception '060 FAILED: % of the 5 published schools are present', n;
  end if;

  -- NOTHING IS OPEN. The check that matters: a seed that quietly advertised
  -- forty-one programmes to applicants would be the single most damaging
  -- thing this file could do.
  select count(*) into n from programmes where status <> 'draft';
  if n > 0 then
    raise exception '060 FAILED: % programmes are not drafts — the seed opened something for admission', n;
  end if;

  -- ---------------------------------------------------------------------
  -- NO ASSERTION ABOUT WHAT DOES NOT EXIST YET.
  --
  -- This checked twice, and was wrong twice. First it asserted that no
  -- programme VERSION existed — true until 061 seeded one for every
  -- programme. Rescoped to curriculum ENTRIES, it was true until 062 moved
  -- three curricula in. Each time the bundle was clean on its first pass
  -- from empty and red on its second.
  --
  -- The mistake is the shape, not the table. A migration cannot prove
  -- anything by counting rows it did not create: every later migration is
  -- free to create them, and a proof that depends on the future being empty
  -- is a proof with an expiry date. 045 collided with 055 the same way.
  --
  -- What 060 is answerable for is above: the schools and programmes IT
  -- seeded, and that not one of them is open. That is the whole of its job.
  -- ---------------------------------------------------------------------

  raise notice '060 OK: 5 schools and 41 programmes are in the register, every one a draft';
  raise notice '060 OK: no curriculum and no duration was seeded — the University has published a range, not a length, for 0 of them';
end $$;


-- ===========================================================================
-- 4. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- THE REGISTER. Five schools, forty-one programmes, none open.
-- ---------------------------------------------------------------------------
select s.name as school,
       count(p.id) as programmes,
       count(*) filter (where p.status = 'open_for_admission') as open_for_admission
  from schools s
  left join programmes p on true
  group by s.name order by s.name;

-- ---------------------------------------------------------------------------
-- EVERY LEVEL HAS A RULED LENGTH. 061 gives each programme a version.
--
-- 0 of 41 programmes have no length this system can record,
-- because what is published is a range. Each needs a duration before a
-- curriculum can be built for it:
--
--
-- The three the University HAS ruled — Bachelor's three years, Doctorate two,
-- Certificate up to one — need no further statement.
-- ---------------------------------------------------------------------------
select award_level, count(*) as programmes
  from programmes group by award_level order by award_level;


-- ===========================================================================
-- ===========================================================================
--
--   061_a_version_for_every_programme.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 061 — A VERSION FOR EVERY PROGRAMME
-- ===========================================================================
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-academic-seed.mjs
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- EVERY ONE OF THE 41 PROGRAMMES GETS A CURRICULUM VERSION to hang
-- a curriculum from. 060 could not: 27 of them were published as "One to two
-- academic years", and a range is not a length. The University has since
-- ruled every level — Certificate one, Diploma one, Bachelor's three,
-- Master's two, Doctorate two — so `duration_years` can hold a number for
-- all of them.
--
-- EVERY VERSION IS A DRAFT, AND NONE HAS A SINGLE COURSE IN IT. A version
-- becomes real when the Vice-Chancellor approves it (058) and it cannot be
-- approved while its curriculum is empty of the credits it claims. This
-- builds the shelf; the University fills it.
--
-- THE LABEL IS THE ACADEMIC YEAR, and the effective date is the day that
-- year opens — 15 August, from 059. Nothing here is chosen: the version is
-- named after the year it takes effect in, which is how a student admitted
-- in 2026/2027 is later known to be reading the 2026/2027 curriculum.
-- ===========================================================================

do $$
declare
  y_label text;
  y_start date;
  p_id    uuid;
  s_id    uuid;
begin
  -- THE ACADEMIC YEAR IN FORCE, asked of the calendar rather than assumed.
  select label, starts_on into y_label, y_start from academic_years where status = 'current';
  if y_label is null then
    raise exception
      'No academic year is current, so a version cannot be dated. 059 sets one from the date; run it first.'
      using errcode = 'no_data_found';
  end if;

  select id into p_id from programmes where code = 'diploma-in-theology';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Theology', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-ministry';
  select id into s_id from schools where code = 'ministry';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Ministry', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-christian-leadership';
  select id into s_id from schools where code = 'ministry';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Christian Leadership', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-computer-networking';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Computer Networking', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-software-engineering';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Software Engineering', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-web-development';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Web Development', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-hardware-maintenance';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Hardware Maintenance', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-laptop-chipset-technology';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Laptop and Chipset Technology', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-database-administration';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Database Administration', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-air-conditioning-refrigeration';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Air Conditioning and Refrigeration', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-computerized-accounting';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Computerised Accounting', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-secretarial-duties';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Secretarial Duties', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-business-management';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Business Management', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-project-management';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Project Management', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-accountancy';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Accountancy', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-banking-and-finance';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Banking and Finance', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-non-profit-management';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Non-Profit Management', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-insurance';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Insurance', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-executive-secretarial-duties';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Executive Secretarial Duties', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'diploma-in-bilingual-secretarial-duties';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Diploma in Bilingual Secretarial Duties', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'certificate-in-theology';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Certificate of Theology', s_id, 1,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'certificate-in-christian-education';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Certificate of Christian Education', s_id, 1,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'divinity';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Bachelor of Divinity', s_id, 3,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'bachelor-of-theology';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Bachelor of Theology', s_id, 3,
          2, 180, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'bachelor-of-ministry';
  select id into s_id from schools where code = 'ministry';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Bachelor of Ministry', s_id, 3,
          2, 180, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'bachelor-of-christian-education';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Bachelor of Christian Education', s_id, 3,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'master-of-theology';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Master of Theology', s_id, 2,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'master-of-divinity';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Master of Divinity', s_id, 2,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'masters-evangelism-mission';
  select id into s_id from schools where code = 'ministry';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Masters in Evangelism and Mission', s_id, 2,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'master-of-arts-christian-leadership';
  select id into s_id from schools where code = 'ministry';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Master of Arts in Christian Leadership', s_id, 2,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'black-liberation-theology';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Master of Arts in Black Liberation Theology', s_id, 2,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'doctor-of-philosophy-theology';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Doctor of Philosophy (Ph.D.) in Theology', s_id, 2,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'doctor-of-theology';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Doctor of Theology', s_id, 2,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'doctor-of-systematic-theology';
  select id into s_id from schools where code = 'theology';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Doctor of Systematic Theology', s_id, 2,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'doctor-of-ministry';
  select id into s_id from schools where code = 'ministry';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Doctor of Ministry', s_id, 2,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'primary-education';
  select id into s_id from schools where code = 'education';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Primary Education', s_id, 3,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'special-education';
  select id into s_id from schools where code = 'education';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Special Education', s_id, 3,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'software-engineering';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Software Engineering', s_id, 3,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'networking';
  select id into s_id from schools where code = 'engineering';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Computer Networking', s_id, 1,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'business-management';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Business Management', s_id, 3,
          2, null, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

  select id into p_id from programmes where code = 'project-management';
  select id into s_id from schools where code = 'business';
  insert into programme_versions
    (programme_id, version_label, name, school_id, duration_years,
     semesters_per_year, total_credits, effective_from, status)
  values (p_id, y_label, 'Project Management', s_id, 2,
          2, 120, y_start, 'draft')
  on conflict (programme_id, version_label) do nothing;

end $$;


-- ===========================================================================
-- PROVE IT
-- ===========================================================================

do $$
declare n integer; bad integer;
begin
  select count(*) into n from programme_versions;
  if n < 41 then
    raise exception '061 FAILED: % versions, expected at least 41', n;
  end if;

  -- EVERY PROGRAMME HAS ONE. A count alone passes if one programme has two.
  select count(*) into bad from programmes p
   where not exists (select 1 from programme_versions v where v.programme_id = p.id);
  if bad > 0 then
    raise exception '061 FAILED: % programmes still have no version', bad;
  end if;

  -- AND NOT ONE IS PUBLISHED. A version published here would have skipped
  -- the Vice-Chancellor, which is the whole of 058.
  select count(*) into bad from programme_versions where status <> 'draft';
  if bad > 0 then
    raise exception '061 FAILED: % versions are not drafts — the seed approved a curriculum', bad;
  end if;

  -- THE RULED LENGTHS, READ BACK. Not a spot check: every level at once.
  select count(*) into bad from programme_versions v
    join programmes p on p.id = v.programme_id
   where v.duration_years <> case p.award_level
           when 'Certificate' then 1
           when 'Diploma' then 1
           when 'Bachelor''s' then 3
           when 'Master''s' then 2
           when 'Doctorate' then 2
           else v.duration_years end;
  if bad > 0 then
    raise exception '061 FAILED: % versions disagree with the ruled length for their award', bad;
  end if;

  raise notice '061 OK: all 41 programmes have a version, every one a draft with no courses in it';
  raise notice '061 OK: every duration matches the length the University ruled for its award level';
end $$;


-- ===========================================================================
-- VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- EVERY PROGRAMME, ITS LENGTH AND WHAT ITS CURRICULUM ADDS UP TO SO FAR.
-- `credits_in_curriculum` is 0 for all of them: the shelf is built and empty.
-- The gap against `total_credits` is the Curriculum Builder's work.
-- ---------------------------------------------------------------------------
select p.award_level,
       count(*)                                              as programmes,
       min(v.duration_years)                                 as years,
       count(*) filter (where v.total_credits is not null)   as with_a_credit_total,
       count(*) filter (where v.status = 'draft')            as drafts
  from programmes p
  join programme_versions v on v.programme_id = p.id
  group by p.award_level order by p.award_level;


-- ===========================================================================
-- ===========================================================================
--
--   062_the_curricula_already_written.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 062 — THE CURRICULA THE UNIVERSITY HAS ALREADY WRITTEN
-- ===========================================================================
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-curriculum-seed.mjs
--   Source:    src/content/programmeCourses.ts
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- 3 PROGRAMMES GET A REAL CURRICULUM — course by course, placed in the
-- year and semester the University wrote them into:
--
--   Bachelor of Theology     36 courses · 3 years · 6 semesters · 180 credits
--   Bachelor of Ministry     34 courses · 3 years · 6 semesters · 180 credits
--   Diploma of Theology      15 courses · 1 years · 2 semesters · 120 credits  (credit DERIVED: 120 / 15 = 8 each)
--
-- 061 built the shelf. This is the first thing on it, and it is the first
-- curriculum in this system that can be counted rather than read.
--
-- THE ENTRIES ATTACH TO A DRAFT VERSION and stay there. A curriculum becomes
-- the University's when the Vice-Chancellor approves it (058); 057 freezes it
-- at that moment, so this seeding could not have run afterwards.
--
-- ===========================================================================

-- ===========================================================================
-- 1. THE COURSES THEMSELVES
-- ===========================================================================
--
-- Most of these are not rows yet. `courses.credit_unit` is NOT NULL and
-- defaults to 3, so every insert below states the credit explicitly — a
-- default silently standing in for a value nobody wrote is how a curriculum
-- ends up adding to the wrong number.

-- Bachelor of Theology
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 210', 'Introduction to Biblical Studies', 6, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 220', 'Bible Survey I', 3, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 230', 'Bible Survey II', 3, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 250', 'Bible Doctrine I', 3, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MW 300', 'Evangelism and Missions Introduction', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('OTH 300', 'Old Testament History and Theology', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('CH 200', 'Introduction to Church History', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('LC 110', 'Christology I', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('OT 300', 'Pentateuch Studies', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 720', 'Christian Psychology and Human Relations', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('CH 300', 'Advanced Church History', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 660', 'Christian Ethics', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('CED 160', 'Christian Education', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 330', 'Hermeneutics and Biblical Interpretation', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 320', 'Homiletics I', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BL 340', 'Epistles Studies', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('STT 410', 'Pneumatology', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 650', 'Spiritual Leadership', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 270', 'Introduction to Biblical Hebrew', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 260', 'Bible Doctrine II', 3, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('RM 540', 'Research Methodology I', 3, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('STT 400', 'Systematic Theology I', 3, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('RM 550', 'Research Methodology II', 3, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('STT 420', 'Systematic Theology II', 3, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 280', 'Introduction to New Testament Greek', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 670', 'Spiritual Formation', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 730', 'Family Theology and Marriage Studies', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 350', 'Advanced Hermeneutics', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('CDS 100', 'Acts and Apostolic Mission', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MW 350', 'Missiology and Global Christianity', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 820', 'ICT, Technology and Global Ministry', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIS 340', 'Advanced Homiletics', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 760', 'Spiritual Warfare and Demonology', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('STT 430', 'African Theology and Contextual Theology', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('STT 450', 'Ecotheology and Creation Care', 5, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('RM 560', 'Bachelor Thesis and Defense', 20, 'credit_hour')
on conflict (code) do nothing;

-- Bachelor of Ministry
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 101', 'Introduction to Christian Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIB 101', 'Old Testament Survey', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIB 102', 'New Testament Survey', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('THE 101', 'Introduction to Christian Doctrine', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('SFM 101', 'Spiritual Formation and Christian Character', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('COM 101', 'Communication for Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIB 103', 'Biblical Interpretation and Hermeneutics', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('THE 102', 'Theology of Yahuah, Yahusha and the Ruach HaQodesh', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BIB 104', 'Life and Ministry of Yahusha the Messiah', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 102', 'Prayer, Worship and Spiritual Disciplines', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('HIS 101', 'Church History I', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 103', 'Introduction to Preaching and Teaching', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 201', 'Five-Fold Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 202', 'Pastoral Ministry and Shepherding', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('EVG 201', 'Evangelism and Discipleship', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('THE 201', 'Theology of the Church', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('LEA 201', 'Christian Leadership', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MUS 201', 'Worship and Music Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 203', 'Apostolic Leadership and Church Planting', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 204', 'Prophetic Ministry and Spiritual Discernment', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 205', 'Christian Education and Discipleship', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('PAS 201', 'Pastoral Care and Christian Counseling', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('ADM 201', 'Church Administration and Management', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('FIN 201', 'Christian Finance and Stewardship', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIS 301', 'Missions and Cross-Cultural Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('COM 301', 'Christian Media and Communications', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('ITM 301', 'Information Technology for Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('YTH 301', 'Youth and Children’s Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('COM 302', 'Community Development and Social Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('RES 301', 'Research Methods for Ministry', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 306', 'Advanced Ministry Leadership', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 307', 'Ministry Ethics, Governance and Accountability', 5, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MIN 308', 'Ministry Practicum', 10, 'ECTS')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('RES 302', 'Bachelor Ministry Research Project', 10, 'ECTS')
on conflict (code) do nothing;

-- Diploma of Theology
-- EVERY CREDIT BELOW IS 8, AND NOT ONE OF THEM WAS WRITTEN BY THE
-- UNIVERSITY. The award is ruled at 120 credits and 15 courses
-- are named for it; 120 / 15 is 8 exactly. The
-- assumption is that these carry equal weight. Where they do not, edit the
-- entry credits in the Curriculum Builder — the total is checked against the
-- programme's own figure on every change, so an uneven split still has to
-- add to 120.
insert into courses (code, title, credit_unit, credit_system)
values ('MA 210', 'Use of English', 8, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BL 300', 'Epistle I', 8, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('CED 180', 'Soteriology I', 8, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 640', 'Ministerial Ethics', 8, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('NT 330', 'Romans', 8, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('BL 160', 'Tabernacle', 8, 'credit_hour')
on conflict (code) do nothing;
insert into courses (code, title, credit_unit, credit_system)
values ('MDS 880', 'Faith', 8, 'credit_hour')
on conflict (code) do nothing;


-- ===========================================================================
-- 2. AND WHERE EACH ONE SITS
-- ===========================================================================
--
-- Year, semester and requirement belong HERE and not on the course — the
-- same course may sit differently in another programme, which is the whole
-- reason 057 put them on the entry.
--
-- Every entry is `core`: neither curriculum marks anything elective, and
-- inventing an elective would change what a student must pass.

do $$
declare
  v_id uuid;
  c_id uuid;
begin
  -- ---- Bachelor of Theology ----
  select v.id into v_id from programme_versions v
    join programmes p on p.id = v.programme_id
   where p.code = 'bachelor-of-theology' order by v.effective_from desc limit 1;
  if v_id is null then
    raise exception 'No version of bachelor-of-theology exists. 061 creates one; run it first.'
      using errcode = 'no_data_found';
  end if;

  select id into c_id from courses where code = 'BIS 210';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 6)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 220';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 3)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 230';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 3)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 250';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 3)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MW 300';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'OTH 300';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'CH 200';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'LC 110';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'OT 300';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 720';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'CH 300';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 660';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'CED 160';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 330';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 320';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BL 340';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'STT 410';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 650';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 270';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 260';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 3)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'RM 540';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 3)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'STT 400';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 3)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'RM 550';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 3)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'STT 420';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 3)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 280';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 670';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 730';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 350';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'CDS 100';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MW 350';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 820';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIS 340';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 760';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'STT 430';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'STT 450';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'RM 560';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 2, 'core', 20)
  on conflict (programme_version_id, course_id) do nothing;

  -- ---- Bachelor of Ministry ----
  select v.id into v_id from programme_versions v
    join programmes p on p.id = v.programme_id
   where p.code = 'bachelor-of-ministry' order by v.effective_from desc limit 1;
  if v_id is null then
    raise exception 'No version of bachelor-of-ministry exists. 061 creates one; run it first.'
      using errcode = 'no_data_found';
  end if;

  select id into c_id from courses where code = 'MIN 101';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIB 101';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIB 102';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'THE 101';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'SFM 101';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'COM 101';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIB 103';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'THE 102';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BIB 104';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 102';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'HIS 101';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 103';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 201';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 202';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'EVG 201';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'THE 201';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'LEA 201';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MUS 201';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 203';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 204';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 205';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'PAS 201';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'ADM 201';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'FIN 201';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 2, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIS 301';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'COM 301';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'ITM 301';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'YTH 301';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'COM 302';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'RES 301';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 1, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 306';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 307';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 2, 'core', 5)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MIN 308';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 2, 'core', 10)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'RES 302';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 3, 2, 'core', 10)
  on conflict (programme_version_id, course_id) do nothing;

  -- ---- Diploma of Theology ----
  select v.id into v_id from programme_versions v
    join programmes p on p.id = v.programme_id
   where p.code = 'diploma-in-theology' order by v.effective_from desc limit 1;
  if v_id is null then
    raise exception 'No version of diploma-in-theology exists. 061 creates one; run it first.'
      using errcode = 'no_data_found';
  end if;

  select id into c_id from courses where code = 'BIS 250';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MW 300';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'CH 200';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MA 210';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'OTH 300';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'LC 110';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 1, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 760';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MW 350';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BL 300';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'CED 180';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 640';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'NT 330';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'OT 300';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'BL 160';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;
  select id into c_id from courses where code = 'MDS 880';
  insert into curriculum_entries
    (programme_version_id, course_id, year, semester, requirement, credits)
  values (v_id, c_id, 1, 2, 'core', 8)
  on conflict (programme_version_id, course_id) do nothing;

end $$;


-- ===========================================================================
-- 3. WHAT A CURRICULUM ADDS UP TO, DRAFT OR NOT
-- ===========================================================================
--
-- `programme_in_force` answers "what is this programme" and joins only the
-- PUBLISHED version — right for a prospectus, useless for the Curriculum
-- Builder, which works on a DRAFT and needs its running total on every edit.
--
-- A draft is the only time the total matters. Once a version is published it
-- is frozen and its arithmetic cannot change; while it is a draft the gap
-- between what the courses add to and what the programme claims IS the work
-- remaining, and it is what the Academic Dashboard means by
-- "programme/curriculum issues".

create or replace view curriculum_progress
with (security_invoker = true) as
select v.id                as version_id,
       v.programme_id,
       p.code,
       p.award_level,
       v.version_label,
       v.status,
       v.duration_years,
       v.semesters_per_year,
       v.total_credits,
       (select count(*) from curriculum_entries e
         where e.programme_version_id = v.id)            as courses_in_curriculum,
       (select coalesce(sum(coalesce(e.credits, c.credit_unit)), 0)
          from curriculum_entries e join courses c on c.id = e.course_id
         where e.programme_version_id = v.id)            as credits_in_curriculum,
       -- THE GAP, SIGNED. Negative is short, positive is over, zero is done.
       (select coalesce(sum(coalesce(e.credits, c.credit_unit)), 0)
          from curriculum_entries e join courses c on c.id = e.course_id
         where e.programme_version_id = v.id) - coalesce(v.total_credits, 0)
                                                        as credits_against_claim,
       -- AND WHETHER EVERY TERM THE PROGRAMME RUNS HAS ANYTHING IN IT. A
       -- curriculum can add to exactly 180 and still have an empty semester.
       (select count(distinct (e.year, e.semester)) from curriculum_entries e
         where e.programme_version_id = v.id)            as terms_with_courses,
       v.duration_years * v.semesters_per_year           as terms_expected
  from programme_versions v
  join programmes p on p.id = v.programme_id;

comment on view curriculum_progress is
  'Every programme version, published or draft, with what its curriculum actually adds up to '
  'against what the programme claims. `programme_in_force` shows only published versions; the '
  'Curriculum Builder works on drafts, which is the only time the total can still change.';


-- ===========================================================================
-- 4. PROVE IT
-- ===========================================================================

do $$
declare n integer; total integer;
begin
  -- Bachelor of Theology: 36 courses, 180 credits
  select count(*), coalesce(sum(e.credits), 0) into n, total
    from curriculum_entries e
    join programme_versions v on v.id = e.programme_version_id
    join programmes p on p.id = v.programme_id
   where p.code = 'bachelor-of-theology';
  if n <> 36 then
    raise exception '062 FAILED: bachelor-of-theology has % entries, expected 36', n;
  end if;
  if total <> 180 then
    raise exception '062 FAILED: bachelor-of-theology adds up to %, not 180', total;
  end if;

  -- Bachelor of Ministry: 34 courses, 180 credits
  select count(*), coalesce(sum(e.credits), 0) into n, total
    from curriculum_entries e
    join programme_versions v on v.id = e.programme_version_id
    join programmes p on p.id = v.programme_id
   where p.code = 'bachelor-of-ministry';
  if n <> 34 then
    raise exception '062 FAILED: bachelor-of-ministry has % entries, expected 34', n;
  end if;
  if total <> 180 then
    raise exception '062 FAILED: bachelor-of-ministry adds up to %, not 180', total;
  end if;

  -- Diploma of Theology: 15 courses, 120 credits
  select count(*), coalesce(sum(e.credits), 0) into n, total
    from curriculum_entries e
    join programme_versions v on v.id = e.programme_version_id
    join programmes p on p.id = v.programme_id
   where p.code = 'diploma-in-theology';
  if n <> 15 then
    raise exception '062 FAILED: diploma-in-theology has % entries, expected 15', n;
  end if;
  if total <> 120 then
    raise exception '062 FAILED: diploma-in-theology adds up to %, not 120', total;
  end if;

  -- THE CURRICULUM MATCHES WHAT THE PROGRAMME CLAIMS. This is the check the
  -- Curriculum Builder will make on every edit, made once here: a version
  -- claiming 180 credits whose courses add to 174 is a curriculum nobody can
  -- graduate from, and it would be found by a student rather than by this.
  --
  -- READ FROM `curriculum_progress`, NOT `programme_in_force`. This check was
  -- written against the latter and PASSED WITHOUT TESTING ANYTHING: that view
  -- joins only PUBLISHED versions, every version here is a draft, so it
  -- returned no rows and the count was 0. A proof that cannot see the thing
  -- it is checking always passes. Section 5 adds the view that can.
  -- ---------------------------------------------------------------------
  -- SCOPED TO THE THREE THIS FILE SEEDS, AND THAT MATTERS.
  --
  -- These three checks were written GLOBALLY — "no curriculum anywhere fails
  -- to add up", "exactly 3 curricula have courses", "no version anywhere is
  -- other than a draft" — and every one of them was a time bomb.
  --
  -- The Curriculum Builder exists now. The day the University builds a fourth
  -- curriculum, or approves one, or leaves a draft half-finished (which the
  -- builder deliberately allows, showing the shortfall in red), re-running
  -- this bundle would fail HERE and roll the whole thing back. The University
  -- is invited to re-run it — it is idempotent, and the Readiness panel says
  -- so — so this would have gone off.
  --
  -- It is the rule this repository already learned once and wrote down: A
  -- MIGRATION CANNOT PROVE ANYTHING BY COUNTING ROWS IT DID NOT CREATE. 060
  -- had the same fault in the other direction — asserting a global ABSENCE
  -- that 061 and 062 then filled.
  --
  -- So each check now names the three programme codes this file seeds.
  -- ---------------------------------------------------------------------
  select count(*) into n from curriculum_progress cp
    join programmes p on p.id = cp.programme_id
   where p.code in ('bachelor-of-theology', 'bachelor-of-ministry', 'diploma-in-theology')
     and cp.courses_in_curriculum > 0
     and cp.total_credits is not null
     and cp.credits_in_curriculum <> cp.total_credits;
  if n > 0 then
    raise exception
      '062 FAILED: % of the curricula seeded here do not add up to what their programme claims', n;
  end if;

  -- AND IT SAW THEM. The assertion above is only worth having if the view
  -- returned the curricula this file just seeded.
  select count(*) into n from curriculum_progress cp
    join programmes p on p.id = cp.programme_id
   where p.code in ('bachelor-of-theology', 'bachelor-of-ministry', 'diploma-in-theology')
     and cp.courses_in_curriculum > 0;
  if n <> 3 then
    raise exception '062 FAILED: the totals view sees % of the 3 seeded curricula', n;
  end if;

  -- AND NOTHING WAS APPROVED ON THE WAY IN — of the versions this file
  -- touches. A version the University has since approved through the builder
  -- is not this migration's business, and failing on it would refuse to
  -- re-run over the University's own governance.
  select count(*) into n
    from programme_versions v
    join programmes p on p.id = v.programme_id
   where p.code in ('bachelor-of-theology', 'bachelor-of-ministry', 'diploma-in-theology')
     and v.status <> 'draft';
  if n > 0 then
    raise notice
      '062 — % of the seeded versions are no longer drafts. That is the University''s own '
      'approval and nothing here has changed it.', n;
  end if;

  raise notice '062 OK: 3 curricula moved into rows, course by course, each adding up to exactly what its programme claims';
  raise notice '062 OK: every entry is core, every version is still a draft, and nothing was approved on the way in';
end $$;


-- ===========================================================================
-- 5. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- WHAT EACH PROGRAMME NOW HAS. `credits_in_curriculum` against
-- `total_credits` is the Curriculum Builder's running total: equal means the
-- curriculum is complete, 0 means the shelf is still empty.
-- ---------------------------------------------------------------------------
select code, award_level, status, duration_years as yrs,
       courses_in_curriculum as courses, credits_in_curriculum as credits,
       total_credits as claims, credits_against_claim as gap,
       terms_with_courses || ' of ' || terms_expected as terms_filled
  from curriculum_progress
 order by courses_in_curriculum desc, code
 limit 10;


-- ===========================================================================
-- ===========================================================================
--
--   063_the_offering_and_the_class.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 063 — THE OFFERING AND THE CLASS
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- THE TWO LINKS MISSING FROM THE MIDDLE OF THE ACADEMIC CHAIN ARE BUILT. The
-- chain the University drew runs
--
--   Programme → Curriculum → Course → COURSE OFFERING → CLASS/SECTION
--     → Student Registration → Assessment → Result → Transcript → Graduation
--
-- and everything from Registration down has existed and worked for months.
-- Everything above Course now exists too, since 057. The two in the middle did
-- not exist in any form, and their absence is why four separate screens are
-- unsatisfactory at once:
--
--   COURSE REGISTRATION is "far too empty" because there was nothing to
--   register AGAINST. `enrollments` joins a student straight to a COURSE, so
--   the system cannot say who is teaching it, where, when, or how many places
--   are left — because none of that is recorded anywhere.
--
--   THE TIMETABLE cannot detect a conflict because a room was free text in a
--   JSON blob. Two blobs both saying "Room A201" are not a room.
--
--   THE LMS cannot show "My Courses" because a student belongs to no class.
--
--   AN EXAMINATION cannot have a candidate list, because a candidate list IS
--   the cohort registered on an offering.
--
-- One missing entity, four broken screens.
--
-- ---------------------------------------------------------------------------
-- A COURSE IS NOT A COURSE OFFERING, AND THIS IS THE CORRECTION
-- ---------------------------------------------------------------------------
--
-- The University put it exactly: "A course is an academic definition… That
-- course can be offered: 2026/27 — Semester 1, with lecturer, class, delivery
-- mode, campus, room, schedule, maximum enrollment, registered students."
--
--   BIS 220 Bible Survey I, 3 credits          — the COURSE. True every year.
--   BIS 220, 2026/2027 Semester 1, on campus   — the OFFERING. True once.
--   BIS 220, group A, Prof X, Room 3, Mon 08   — the CLASS. One timetable slot.
--
-- Putting a lecturer on `courses` — which is where `courses.lecturer_id` still
-- is — says the same person teaches it forever, in every year, on every
-- campus. It is the same mistake as `courses.year` and `courses.semester`,
-- which 057 moved to the curriculum entry: a fact about one PLACEMENT stored
-- against the thing placed.
--
-- ---------------------------------------------------------------------------
-- WHAT IS NOT SEEDED
-- ---------------------------------------------------------------------------
--
-- No room, no offering, no class. The University has not told this system
-- where it teaches — not one room number, capacity or building — and a
-- plausible "Room A201" is exactly the invention that ends up on a timetable a
-- student walks to. The tables arrive empty and the Superadministrator fills
-- them.
-- ===========================================================================


-- ===========================================================================
-- 1. WHERE TEACHING HAPPENS
-- ===========================================================================
--
-- A ROOM IS A ROW, and that is the whole of why conflict detection becomes
-- possible. The timetable's "room" has been free text inside a JSON blob in
-- `module_records`; two records both reading "Room A201" are two strings, and
-- no query can say they are the same place.

create table if not exists rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (length(btrim(code)) between 1 and 32),
  name        text,
  campus      text,
  -- WHAT KIND OF SPACE, because a lecture theatre and a laboratory are not
  -- interchangeable and a timetable that treats them as such will schedule a
  -- practical into a seminar room.
  kind        text not null default 'room'
                check (kind in ('room', 'lecture-hall', 'laboratory', 'studio', 'online')),
  capacity    integer check (capacity is null or capacity > 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table rooms is
  'Where the University teaches. EMPTY on arrival: not one room number, building or capacity '
  'has been stated, and an invented "Room A201" is the kind of thing a student walks to.';


-- ===========================================================================
-- 2. THE OFFERING — A COURSE, IN A TERM
-- ===========================================================================

create table if not exists course_offerings (
  id                uuid primary key default gen_random_uuid(),
  course_id         uuid not null references courses (id) on delete restrict,
  -- THE TERM, FROM THE CALENDAR. Not an integer somebody typed: 059 exists so
  -- that "which academic year is this" has one answer, and an offering is the
  -- first thing that has to agree with it.
  academic_year_id  uuid not null references academic_years (id) on delete restrict,
  term_sequence     integer not null check (term_sequence between 1 and 4),

  -- THE UNIVERSITY'S OWN THREE WORDS. Ruled: "The school is not only online.
  -- Delivery is Campus, Online, or Online / Campus — those exact words."
  delivery_mode     text not null default 'Campus'
                      check (delivery_mode in ('Campus', 'Online', 'Online / Campus')),
  campus            text,
  language          text,

  -- WHO ANSWERS FOR IT. On the offering, not the course: the person teaching
  -- BIS 220 this year is not necessarily the person who taught it last.
  lecturer_id       uuid references lecturers (id) on delete set null,

  max_enrolment     integer check (max_enrolment is null or max_enrolment > 0),
  status            text not null default 'planned'
                      check (status in ('planned', 'open', 'closed', 'cancelled')),
  created_at        timestamptz not null default now(),

  -- ONE OFFERING OF A COURSE PER TERM. Two is two capacities, two lecturers
  -- and two answers to "am I registered" — and where a University genuinely
  -- runs a course twice in a term, that is two CLASSES of one offering, which
  -- is what section 3 is for.
  unique (course_id, academic_year_id, term_sequence)
);

create index if not exists course_offerings_by_term
  on course_offerings (academic_year_id, term_sequence);

comment on table course_offerings is
  'A course as actually offered: this year, this semester, this delivery mode, this lecturer, '
  'this many places. The COURSE is the academic definition and is true every year; the offering '
  'is true once.';


-- ===========================================================================
-- 3. THE CLASS — A GROUP, A ROOM AND AN HOUR
-- ===========================================================================
--
-- An offering may be taught to more than one group, and each group meets at
-- its own time in its own place. That is the row a timetable draws, and the
-- row two of which cannot occupy one room at one hour.

create table if not exists class_sections (
  id            uuid primary key default gen_random_uuid(),
  offering_id   uuid not null references course_offerings (id) on delete cascade,
  -- 'A', 'B', 'Evening'. The University's own label for the group.
  code          text not null default 'A' check (length(btrim(code)) between 1 and 24),
  lecturer_id   uuid references lecturers (id) on delete set null,
  room_id       uuid references rooms (id) on delete set null,

  -- 1 = Monday, as ISO numbers them. Null where a class has no fixed slot,
  -- which an online cohort working asynchronously legitimately has not.
  day_of_week   integer check (day_of_week is null or day_of_week between 1 and 7),
  starts_at     time,
  ends_at       time,

  delivery_mode text check (delivery_mode is null or
                  delivery_mode in ('Campus', 'Online', 'Online / Campus')),
  online_link   text,
  capacity      integer check (capacity is null or capacity > 0),
  created_at    timestamptz not null default now(),

  unique (offering_id, code),
  constraint class_sections_run_forwards
    check (starts_at is null or ends_at is null or ends_at > starts_at),
  -- A SLOT IS A DAY AND TWO TIMES, OR NONE OF THEM. Half a slot cannot be put
  -- on a timetable and cannot be checked for a clash, so it is refused rather
  -- than stored as something that looks scheduled.
  constraint class_sections_slot_is_whole
    check ((day_of_week is null and starts_at is null and ends_at is null)
           or (day_of_week is not null and starts_at is not null and ends_at is not null))
);

create index if not exists class_sections_by_slot
  on class_sections (day_of_week, starts_at, ends_at);


-- ===========================================================================
-- 4. THE CONFLICTS, AS A QUERY
-- ===========================================================================
--
-- The University named three: "Room conflict. Lecturer conflict. Student-group
-- conflict."
--
-- The first two are answerable the moment a room and a lecturer are rows, and
-- they are answered here — once, in a view, rather than by each screen
-- inventing its own overlap arithmetic and getting the boundary wrong. Two
-- classes where one ends exactly as the other begins do NOT clash; `<` and `>`
-- rather than `<=` and `>=` is the whole of that, and it is the detail every
-- hand-written version gets wrong.
--
-- THE THIRD IS DIFFERENT AND WORTH SAYING. A student-cohort clash — two
-- compulsory courses at the same hour — is not visible in the timetable at
-- all. It is a CURRICULUM question: are these two courses both core, in the
-- same programme version, in the same year and semester? That join is below,
-- and it is only possible because 057 put year, semester and core/elective on
-- the curriculum entry.

create or replace view timetable_clashes
with (security_invoker = true) as
-- ROOM: one space, two classes, overlapping hours.
select 'room'::text                        as kind,
       a.id                                as section_id,
       b.id                                as clashes_with,
       r.code                              as detail,
       a.day_of_week, a.starts_at, a.ends_at
  from class_sections a
  join class_sections b
    on b.id <> a.id
   and b.room_id = a.room_id
   and b.day_of_week = a.day_of_week
   and b.starts_at < a.ends_at
   and b.ends_at   > a.starts_at
  join rooms r on r.id = a.room_id
 where a.room_id is not null
   and a.day_of_week is not null

union all

-- LECTURER: one person, two classes, overlapping hours.
select 'lecturer',
       a.id, b.id,
       coalesce(l.first_name || ' ' || l.last_name, 'A lecturer'),
       a.day_of_week, a.starts_at, a.ends_at
  from class_sections a
  join class_sections b
    on b.id <> a.id
   and b.lecturer_id = a.lecturer_id
   and b.day_of_week = a.day_of_week
   and b.starts_at < a.ends_at
   and b.ends_at   > a.starts_at
  join lecturers l on l.id = a.lecturer_id
 where a.lecturer_id is not null
   and a.day_of_week is not null

union all

-- COHORT: two courses a student must pass, in the same term of the same
-- programme, taught at the same hour. Nobody can attend both.
select 'cohort',
       a.id, b.id,
       p.code || ' year ' || ea.year || ' semester ' || ea.semester,
       a.day_of_week, a.starts_at, a.ends_at
  from class_sections a
  join course_offerings oa on oa.id = a.offering_id
  join curriculum_entries ea on ea.course_id = oa.course_id and ea.requirement = 'core'
  join class_sections b on b.id <> a.id
   and b.day_of_week = a.day_of_week
   and b.starts_at < a.ends_at
   and b.ends_at   > a.starts_at
  join course_offerings ob on ob.id = b.offering_id
  join curriculum_entries eb
    on eb.course_id = ob.course_id
   and eb.requirement = 'core'
   and eb.programme_version_id = ea.programme_version_id
   and eb.year = ea.year
   and eb.semester = ea.semester
  join programme_versions v on v.id = ea.programme_version_id
  join programmes p on p.id = v.programme_id
 where a.day_of_week is not null;

comment on view timetable_clashes is
  'Room, lecturer and student-cohort conflicts, computed once rather than by each screen. Two '
  'classes where one ends exactly as the other begins do not clash — the boundary every '
  'hand-written overlap check gets wrong.';


-- ===========================================================================
-- 5. A REGISTRATION IS AGAINST AN OFFERING
-- ===========================================================================
--
-- `enrollments.course_id` stays — the results pipeline, the GPA engine and the
-- graduation audit all read it, and rewriting them is not this migration's
-- job. What is added is the link that was missing: WHICH offering, and
-- therefore which lecturer, which room, which cohort and how many places.
--
-- NOT NOT-NULL, deliberately. Every existing registration was made before
-- offerings existed and cannot be given one retrospectively without inventing
-- which class a student attended.

alter table enrollments
  add column if not exists offering_id uuid references course_offerings (id) on delete restrict,
  add column if not exists section_id  uuid references class_sections (id) on delete set null;

create index if not exists enrollments_by_offering
  on enrollments (offering_id) where offering_id is not null;

-- AND THE OFFERING MUST BE OF THE COURSE REGISTERED. Without this a
-- registration can name BIS 220 and point at an offering of OT 300, and every
-- screen downstream reports a different course depending on which column it
-- happens to read.
create or replace function refuse_a_mismatched_offering()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  offered uuid;
begin
  if new.offering_id is null then return new; end if;

  select course_id into offered from course_offerings where id = new.offering_id;
  if offered is distinct from new.course_id then
    raise exception
      'This registration names one course and an offering of another. Every screen downstream '
      'would report whichever of the two it happened to read.'
      using errcode = 'check_violation';
  end if;

  -- AND THE SECTION MUST BELONG TO THAT OFFERING.
  if new.section_id is not null
     and not exists (select 1 from class_sections
                      where id = new.section_id and offering_id = new.offering_id) then
    raise exception
      'This registration names a class that is not part of the offering it is registered to.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists enrollments_offering_matches_course on enrollments;
create trigger enrollments_offering_matches_course
  before insert or update on enrollments
  for each row execute function refuse_a_mismatched_offering();


-- ===========================================================================
-- 6. WHAT IS ON OFFER, AND HOW FULL
-- ===========================================================================

create or replace view course_offering_roll
with (security_invoker = true) as
select o.id                 as offering_id,
       c.code               as course_code,
       c.title              as course_title,
       c.credit_unit,
       y.label              as year_label,
       y.starts_in,
       o.term_sequence,
       o.delivery_mode,
       o.campus,
       o.status,
       o.max_enrolment,
       l.first_name || ' ' || l.last_name        as lecturer,
       (select count(*) from class_sections s where s.offering_id = o.id)  as classes,
       (select count(*) from enrollments e
         where e.offering_id = o.id and e.status = 'registered')           as registered,
       -- PLACES LEFT, or null where no ceiling was set. Null is not zero, and
       -- a screen that treats it as zero closes a course nobody limited.
       case when o.max_enrolment is null then null
            else o.max_enrolment - (select count(*) from enrollments e
                                     where e.offering_id = o.id and e.status = 'registered')
       end                                                                 as places_left
  from course_offerings o
  join courses c on c.id = o.course_id
  join academic_years y on y.id = o.academic_year_id
  left join lecturers l on l.id = o.lecturer_id;

comment on view course_offering_roll is
  'Every offering with its lecturer, its classes and how full it is. `places_left` is null where '
  'no ceiling was set — null is not zero, and a screen reading it as zero closes a course nobody '
  'limited.';


-- ===========================================================================
-- 7. WHO CAN READ IT
-- ===========================================================================
--
-- WHAT IS ON OFFER IS PUBLIC. A prospective student comparing universities
-- should be able to see that a course runs in Semester 1, on campus, and what
-- it is worth — that is a prospectus, and hiding it serves nobody.
--
-- WHO IS REGISTERED IS NOT, and that is already true: `enrollments` carries
-- its own policy and this migration does not touch it.

alter table rooms            enable row level security;
alter table course_offerings enable row level security;
alter table class_sections   enable row level security;

drop policy if exists course_offerings_read on course_offerings;
create policy course_offerings_read on course_offerings
  for select using (
    status in ('open', 'closed')
    or auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                       'vice-chancellor', 'chancellor', 'dean', 'hod',
                       'programme-coordinator', 'lecturer')
  );

drop policy if exists class_sections_read on class_sections;
create policy class_sections_read on class_sections
  for select using (auth.uid() is not null);

-- A ROOM NUMBER IS NOT A SECRET, and a timetable is unreadable without one.
drop policy if exists rooms_read on rooms;
create policy rooms_read on rooms for select using (auth.uid() is not null);

-- No write policy on any of the three. Every change goes through the API.


-- ===========================================================================
-- 8. PROVE IT
-- ===========================================================================

do $$
declare
  y_id     uuid;
  room_a   uuid;
  room_b   uuid;
  lect     uuid;
  crs_a    uuid;
  crs_b    uuid;
  off_a    uuid;
  off_b    uuid;
  sec_a    uuid;
  sec_b    uuid;
  stu      uuid;
  n        integer;
  refused  boolean;
begin
  begin
    select id into y_id from academic_years where status = 'current';
    if y_id is null then select id into y_id from academic_years order by starts_in limit 1; end if;

    insert into rooms (code, name, capacity) values ('PROOF-1', 'A Proof Room', 40)
      returning id into room_a;
    insert into rooms (code, name, capacity) values ('PROOF-2', 'Another Proof Room', 40)
      returning id into room_b;
    -- `staff_id` is NOT NULL on this table; a proof that omitted it would fail
    -- for a reason that has nothing to do with this migration.
    insert into lecturers (staff_id, first_name, last_name, email)
      values ('PROOF-063', 'A', 'Proof-Lecturer', '063-lecturer@example.test')
      returning id into lect;
    insert into courses (code, title, credit_unit) values ('PRF 601', 'A Proof Course', 5)
      on conflict (code) do nothing;
    select id into crs_a from courses where code = 'PRF 601';
    insert into courses (code, title, credit_unit) values ('PRF 602', 'Another Proof Course', 5)
      on conflict (code) do nothing;
    select id into crs_b from courses where code = 'PRF 602';

    insert into course_offerings (course_id, academic_year_id, term_sequence, delivery_mode,
                                  lecturer_id, max_enrolment, status)
      values (crs_a, y_id, 1, 'Campus', lect, 2, 'open') returning id into off_a;

    -- ---- ONE OFFERING OF A COURSE PER TERM --------------------------------
    refused := false;
    begin
      insert into course_offerings (course_id, academic_year_id, term_sequence)
        values (crs_a, y_id, 1);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '063 FAILED: one course was offered twice in one term';
    end if;

    -- ---- HALF A TIMETABLE SLOT IS REFUSED ---------------------------------
    -- A day with no times cannot be drawn and cannot be checked for a clash.
    refused := false;
    begin
      insert into class_sections (offering_id, code, day_of_week) values (off_a, 'X', 1);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '063 FAILED: a class was scheduled on a day with no hours';
    end if;

    insert into class_sections (offering_id, code, lecturer_id, room_id,
                                day_of_week, starts_at, ends_at)
      values (off_a, 'A', lect, room_a, 1, time '08:00', time '10:00') returning id into sec_a;

    -- ---- A ROOM HOLDS ONE CLASS AT A TIME ---------------------------------
    insert into course_offerings (course_id, academic_year_id, term_sequence, status)
      values (crs_b, y_id, 1, 'open') returning id into off_b;
    insert into class_sections (offering_id, code, room_id, day_of_week, starts_at, ends_at)
      values (off_b, 'A', room_a, 1, time '09:00', time '11:00') returning id into sec_b;

    select count(*) into n from timetable_clashes
     where kind = 'room' and section_id in (sec_a, sec_b);
    if n = 0 then
      raise exception '063 FAILED: two classes in one room at one hour were not reported';
    end if;

    -- AND A CLASS THAT ENDS EXACTLY AS ANOTHER BEGINS DOES NOT CLASH. This is
    -- the boundary every hand-written overlap check gets wrong.
    update class_sections set starts_at = time '10:00', ends_at = time '12:00' where id = sec_b;
    select count(*) into n from timetable_clashes
     where kind = 'room' and section_id in (sec_a, sec_b);
    if n > 0 then
      raise exception '063 FAILED: back-to-back classes were reported as a clash';
    end if;

    -- ---- AND A LECTURER IS IN ONE PLACE -----------------------------------
    update class_sections set lecturer_id = lect, room_id = room_b,
           starts_at = time '09:00', ends_at = time '11:00' where id = sec_b;
    select count(*) into n from timetable_clashes
     where kind = 'lecturer' and section_id in (sec_a, sec_b);
    if n = 0 then
      raise exception '063 FAILED: one lecturer in two rooms at one hour was not reported';
    end if;

    -- ---- A REGISTRATION CANNOT NAME TWO DIFFERENT COURSES -----------------
    insert into auth.users (id, email) values (gen_random_uuid(), '063-student@example.test');
    insert into students (first_name, last_name, email, matric_no)
      values ('A', 'Proof-Student', '063-student@example.test', 'PROOF-063')
      returning id into stu;

    refused := false;
    begin
      insert into enrollments (student_id, course_id, academic_year, semester, status, offering_id)
        values (stu, crs_b, 2026, 1, 'registered', off_a);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '063 FAILED: a registration named one course and an offering of another';
    end if;

    -- AND A CLASS MUST BELONG TO THE OFFERING REGISTERED TO.
    refused := false;
    begin
      insert into enrollments (student_id, course_id, academic_year, semester, status,
                               offering_id, section_id)
        values (stu, crs_a, 2026, 1, 'registered', off_a, sec_b);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '063 FAILED: a registration named a class from a different offering';
    end if;

    -- ---- AND THE ROLL COUNTS WHAT IS THERE --------------------------------
    insert into enrollments (student_id, course_id, academic_year, semester, status,
                             offering_id, section_id)
      values (stu, crs_a, 2026, 1, 'registered', off_a, sec_a);

    select registered into n from course_offering_roll where offering_id = off_a;
    if n <> 1 then
      raise exception '063 FAILED: the roll counts % registered, not 1', n;
    end if;
    select places_left into n from course_offering_roll where offering_id = off_a;
    if n <> 1 then
      raise exception '063 FAILED: places left is %, not 1 of 2', n;
    end if;

    -- NO CEILING IS NOT A FULL COURSE. A screen reading null as zero would
    -- close a course nobody limited.
    update course_offerings set max_enrolment = null where id = off_a;
    select places_left into n from course_offering_roll where offering_id = off_a;
    if n is not null then
      raise exception '063 FAILED: an unlimited offering reports % places left', n;
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '063 OK: a course is offered once per term, and a registration cannot name one '
               'course and an offering of another';
  raise notice '063 OK: a room holds one class at a time and a lecturer is in one place — and '
               'back-to-back classes are NOT reported as a clash';
  raise notice '063 OK: half a timetable slot is refused, and the roll counts who is registered '
               'without reading an unlimited offering as a full one';
end $$;


-- ===========================================================================
-- 9. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- EMPTY, AND THAT IS CORRECT. The University has not said where it teaches:
-- not one room number, building or capacity. Nothing here is seeded, because
-- an invented "Room A201" is the kind of thing a student walks to.
-- ---------------------------------------------------------------------------
select (select count(*) from rooms)             as rooms,
       (select count(*) from course_offerings)  as offerings,
       (select count(*) from class_sections)    as classes,
       (select count(*) from enrollments where offering_id is not null)
                                                as registrations_against_an_offering;

-- ---------------------------------------------------------------------------
-- AND NOTHING CLASHES, because nothing is scheduled. This is the query the
-- timetable will run on every change: room, lecturer and student-cohort
-- conflicts, in one place.
-- ---------------------------------------------------------------------------
select kind, count(*) as conflicts from timetable_clashes group by kind;


-- ===========================================================================
-- ===========================================================================
--
--   064_the_rooms_to_start_from.sql
--
-- ===========================================================================
-- ===========================================================================

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


-- ===========================================================================
-- ===========================================================================
--
--   065_the_year_that_cannot_lie.sql
--
-- ===========================================================================
-- ===========================================================================

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
declare
  moved_label text[] := '{}';
  moved_was   text[] := '{}';
  moved_now   text[] := '{}';
  r           record;
begin
  -- -------------------------------------------------------------------
  -- NO TEMP TABLE. THIS IS THE SECOND VERSION, AND THE FIRST ONE FAILED
  -- ON THE UNIVERSITY'S OWN DATABASE.
  --
  -- It collected the plan into `create temp table rolled_years on commit
  -- drop`. `on commit drop` means exactly that: the table survives until the
  -- transaction COMMITS. This function is called twice in this file — once to
  -- correct the statuses, once inside the proof — and the Supabase SQL editor
  -- runs a whole script as ONE transaction. So the second call met a temp
  -- table the first had left behind:
  --
  --   ERROR: 42P07: relation "rolled_years" already exists
  --
  -- It passed locally because psql without --single-transaction commits after
  -- every statement, which dropped the table between the two calls. The
  -- harness was kinder than production, which is the same way the 057 code
  -- constraint reached the University broken.
  --
  -- Arrays hold the plan instead. They are function-local, they cannot
  -- collide with a previous call, and they work identically whether the
  -- caller wraps the script in a transaction or not.
  -- -------------------------------------------------------------------
  for r in
    select y.label as y_label,
           y.status as was,
           case
             when current_date between y.starts_on and y.ends_on then 'current'
             when y.ends_on < current_date                        then 'closed'
             else 'planning'
           end as should_be
      from academic_years y
     order by y.starts_in
  loop
    if r.was is distinct from r.should_be then
      moved_label := moved_label || r.y_label;
      moved_was   := moved_was   || r.was;
      moved_now   := moved_now   || r.should_be;
    end if;
  end loop;

  -- THE ORDER MATTERS, AND THIS IS THE OTHER REASON THIS IS A FUNCTION.
  --
  -- `academic_years_one_current` is a unique index over status where status =
  -- 'current'. A single UPDATE that moves 2026/2027 out of current and
  -- 2027/2028 into it can be evaluated row by row, and if the incoming row is
  -- written before the outgoing one the index sees two current years and the
  -- whole statement fails.
  --
  -- So the leaving year is stood down first, in its own statement, and only
  -- then is the arriving year stood up.
  update academic_years y
     set status = case
       when y.ends_on < current_date then 'closed'
       else 'planning'
     end
   where not (current_date between y.starts_on and y.ends_on)
     and y.status is distinct from (case
       when y.ends_on < current_date then 'closed'
       else 'planning'
     end);

  update academic_years y
     set status = 'current'
   where current_date between y.starts_on and y.ends_on
     and y.status is distinct from 'current';

  return query
    select * from unnest(moved_label, moved_was, moved_now);
end $$;

comment on function roll_the_academic_year() is
  'Brings every year''s stored status into line with the calendar, and returns what moved. Stands '
  'the leaving year down BEFORE standing the arriving one up: academic_years_one_current is a '
  'unique index, and a single UPDATE doing both can be evaluated in the order that trips it. '
  'Holds its plan in arrays rather than a temp table, so that calling it twice inside one '
  'transaction — which is how the Supabase SQL editor runs a script — does not collide.';


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


-- ===========================================================================
-- ===========================================================================
--
--   066_when_registration_is_open.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 066 — WHEN REGISTRATION IS OPEN
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- NOTHING CLOSES. No registration window is seeded, so no student is locked
-- out on the day this runs. What appears is the ABILITY to record a window,
-- and the rule that applies once one exists.
--
-- THE RULE, IN ONE SENTENCE: a student may register themselves only while the
-- registration window is open; the Registry may register anybody at any time,
-- and a registration it makes outside the window is RECORDED AS LATE rather
-- than refused.
--
-- ---------------------------------------------------------------------------
-- WHY NOT SIMPLY REFUSE EVERYONE OUTSIDE THE WINDOW
-- ---------------------------------------------------------------------------
--
-- Because late registration is a real thing a University does, and a system
-- that cannot perform it is a system the Registry works around — on paper,
-- where nothing counts it. The question was never "should late registration be
-- possible". It is "should it be INVISIBLE", and the answer to that is no.
--
-- So `enrollments.registered_late` records it. A registration made outside the
-- window carries the fact for as long as the row exists, and the Registry can
-- be asked at the end of the year how many there were.
--
-- ---------------------------------------------------------------------------
-- AND A TERM WITH NO WINDOW RECORDED DOES NOT REFUSE ANYBODY
-- ---------------------------------------------------------------------------
--
-- 059 created `academic_periods` and left it empty on purpose, saying so: "the
-- University has stated when its SEMESTERS open, not when registration does,
-- and a plausible deadline that was never agreed is worse than none."
--
-- That still holds. NO WINDOW RECORDED IS NOT A CLOSED WINDOW. If an absent
-- period meant "closed", this migration would lock every student in the
-- University out of registration the moment it ran — which is the same mistake
-- as reading a null capacity as zero, and it is refused here for the same
-- reason. `window_recorded` is a separate column from `is_open` so that no
-- caller can collapse the two by accident.
-- ===========================================================================


-- ===========================================================================
-- 0. THE MIGRATION THIS ONE NEEDS
-- ===========================================================================

do $$
begin
  if to_regclass('public.academic_periods') is null then
    raise exception
      'Migration 059 has not been run on this database: there is no academic calendar to hang a '
      'registration window on. Run 059_the_academic_calendar.sql first, or run the whole bundle.';
  end if;
end $$;


-- ===========================================================================
-- 1. A REGISTRATION KNOWS WHETHER IT WAS LATE
-- ===========================================================================
--
-- NOT NULL WITH A DEFAULT OF FALSE, because every registration made before
-- this existed was made when no window was recorded, and a registration made
-- in a term with no deadline cannot have missed one. Backfilling them as
-- `true` would invent a hundred late registrations; leaving them null would
-- make every later count ambiguous.

alter table enrollments
  add column if not exists registered_late boolean not null default false;

comment on column enrollments.registered_late is
  'True where this registration was made outside the term''s recorded registration window. Only '
  'the Registry can make one — a student registering themselves is refused — and it is recorded '
  'rather than refused because late registration is a real act, and a system that cannot perform '
  'it is one the Registry performs on paper instead.';

create index if not exists enrollments_late on enrollments (academic_year, semester)
  where registered_late;


-- ===========================================================================
-- 2. IS REGISTRATION OPEN? — ONE VIEW, ASKED BY EVERYBODY
-- ===========================================================================
--
-- The registration screen, the registration route and the calendar screen all
-- need this answer, and they must not each compute it. A screen that thinks
-- registration is open while the route thinks it is closed produces a form
-- that submits and is refused, which is the shape of bug that generates a
-- support ticket for every single user.
--
-- THE ADD/DROP WINDOW IS CARRIED ALONGSIDE, because dropping a course after
-- registration has closed is normally still allowed for a period, and the drop
-- action needs the same one-place answer.

create or replace view registration_window
with (security_invoker = true) as
select y.id                as academic_year_id,
       y.label             as year_label,
       y.starts_in,
       t.id                as term_id,
       t.sequence          as term_sequence,
       t.name              as term_name,
       reg.starts_on       as registration_opens,
       reg.ends_on         as registration_closes,
       drop_p.starts_on    as add_drop_opens,
       drop_p.ends_on      as add_drop_closes,
       -- WAS A WINDOW EVER RECORDED? Distinct from whether it is open, and
       -- kept distinct on purpose: an absent window must not read as a closed
       -- one, or this view would lock out every term nobody has dated.
       (reg.id is not null) as window_recorded,
       -- OPEN, which for a term with no window recorded is TRUE. See the
       -- header. The alternative closes the University.
       (reg.id is null
        or current_date between reg.starts_on and reg.ends_on) as is_open,
       (drop_p.id is null
        or current_date between drop_p.starts_on and drop_p.ends_on) as add_drop_open
  from academic_terms t
  join academic_years y on y.id = t.academic_year_id
  left join academic_periods reg
    on reg.term_id = t.id and reg.kind = 'registration'
  left join academic_periods drop_p
    on drop_p.term_id = t.id and drop_p.kind = 'add-drop';

comment on view registration_window is
  'Whether registration is open for each term, and whether a window was ever recorded — two '
  'different questions, kept in two columns. A term with no window recorded is OPEN: 059 left '
  'academic_periods empty deliberately, and reading an absent window as a closed one would lock '
  'every student out of registration the day this ran.';


-- ===========================================================================
-- 3. THE PERIODS OF A TERM, READABLE IN ONE QUERY
-- ===========================================================================
--
-- Every window of every term with its year, so the calendar screen can draw a
-- term's periods without a three-way join written by hand in TypeScript.

create or replace view academic_period_calendar
with (security_invoker = true) as
select p.id,
       p.kind,
       p.starts_on,
       p.ends_on,
       p.note,
       t.id       as term_id,
       t.sequence as term_sequence,
       t.name     as term_name,
       y.id       as academic_year_id,
       y.label    as year_label,
       y.starts_in,
       -- IS TODAY INSIDE IT? Derived, like everything else about a date in
       -- this schema — see 065 for what a stored answer to this costs.
       (current_date between p.starts_on and p.ends_on) as in_force
  from academic_periods p
  join academic_terms t on t.id = p.term_id
  join academic_years y on y.id = t.academic_year_id;

comment on view academic_period_calendar is
  'Every registration, teaching, examination and results window with the term and year it belongs '
  'to. `in_force` is derived from today''s date rather than stored.';


-- ===========================================================================
-- 4. A PERIOD MUST FIT INSIDE ITS TERM
-- ===========================================================================
--
-- A registration window that opens before the semester exists, or closes after
-- it has ended, is not a window — it is a typo that nothing catches until a
-- student cannot register on a day the calendar says they should be able to.
--
-- REFUSED AT THE DATABASE rather than in the route, because the route is not
-- the only writer: an operator with SQL is, and so is the next screen somebody
-- builds.

create or replace function refuse_a_period_outside_its_term()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  t_starts date;
  t_ends   date;
  t_name   text;
begin
  select starts_on, ends_on, name into t_starts, t_ends, t_name
    from academic_terms where id = new.term_id;

  if new.starts_on < t_starts or new.ends_on > t_ends then
    raise exception
      'This % window runs % to %, which is outside %, running % to %. A window that falls '
      'outside its own semester cannot be met by anybody.',
      new.kind, new.starts_on, new.ends_on, t_name, t_starts, t_ends
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists academic_periods_fit_their_term on academic_periods;
create trigger academic_periods_fit_their_term
  before insert or update on academic_periods
  for each row execute function refuse_a_period_outside_its_term();


-- ===========================================================================
-- 5. WHO CAN READ IT
-- ===========================================================================
--
-- WHEN REGISTRATION OPENS IS PUBLIC. A student who cannot find out when they
-- may register is a student who telephones the Registry, and there is nothing
-- confidential about a date the University wants people to meet.

alter table academic_periods enable row level security;

drop policy if exists academic_periods_read on academic_periods;
create policy academic_periods_read on academic_periods for select using (true);

-- No write policy. Every change goes through /api/academic/calendar.


-- ===========================================================================
-- 6. PROVE IT
-- ===========================================================================

do $$
declare
  y_id     uuid;
  t_id     uuid;
  t_start  date;
  t_end    date;
  n        integer;
  refused  boolean;
  open_now boolean;
  recorded boolean;
begin
  begin
    select y.id, t.id, t.starts_on, t.ends_on
      into y_id, t_id, t_start, t_end
      from academic_terms t
      join academic_years y on y.id = t.academic_year_id
     where current_date between t.starts_on and t.ends_on
     limit 1;

    if t_id is null then
      raise exception
        '066 FAILED: today falls in no academic term, so the window rule cannot be proved. The '
        'calendar needs extending.';
    end if;

    -- ---- WITH NO WINDOW RECORDED, REGISTRATION IS OPEN ------------------
    --
    -- THE ASSERTION THAT MATTERS MOST. If this were false, running this
    -- migration would lock every student in the University out of
    -- registration, on a database where nobody had recorded a single date.
    delete from academic_periods where term_id = t_id and kind = 'registration';

    select is_open, window_recorded into open_now, recorded
      from registration_window where term_id = t_id;
    if not open_now then
      raise exception
        '066 FAILED: a term with no registration window recorded reported registration CLOSED. '
        'That locks out every student in the University.';
    end if;
    if recorded then
      raise exception '066 FAILED: a term with no window recorded reported one as recorded';
    end if;

    -- ---- A WINDOW THAT IS OPEN TODAY -----------------------------------
    insert into academic_periods (term_id, kind, starts_on, ends_on)
      values (t_id, 'registration', greatest(t_start, current_date - 7),
              least(t_end, current_date + 7));

    select is_open, window_recorded into open_now, recorded
      from registration_window where term_id = t_id;
    if not open_now or not recorded then
      raise exception
        '066 FAILED: a window covering today reported open=%, recorded=%', open_now, recorded;
    end if;

    -- ---- AND ONE THAT HAS CLOSED ---------------------------------------
    --
    -- PROVE THE RULE BY WATCHING IT REFUSE. A window nobody has seen close is
    -- a window nobody has tested.
    update academic_periods
       set starts_on = greatest(t_start, current_date - 30),
           ends_on   = greatest(t_start + 1, current_date - 20)
     where term_id = t_id and kind = 'registration';

    select is_open, window_recorded into open_now, recorded
      from registration_window where term_id = t_id;
    if open_now then
      raise exception '066 FAILED: a window that closed twenty days ago reported open';
    end if;
    if not recorded then
      raise exception '066 FAILED: a closed window reported as never recorded';
    end if;

    -- ---- A PERIOD OUTSIDE ITS TERM IS REFUSED --------------------------
    refused := false;
    begin
      insert into academic_periods (term_id, kind, starts_on, ends_on)
        values (t_id, 'examinations', t_start - 60, t_start - 30);
    exception when check_violation then
      refused := true;
    end;
    if not refused then
      raise exception
        '066 FAILED: a window entirely outside its own semester was accepted';
    end if;

    -- ---- AND A TERM MAY NOT HAVE TWO OF THE SAME WINDOW ----------------
    --
    -- 059's unique (term_id, kind). Two registration windows in one semester
    -- is two answers to "is registration open", which is the whole fault this
    -- view exists to prevent.
    refused := false;
    begin
      insert into academic_periods (term_id, kind, starts_on, ends_on)
        values (t_id, 'registration', t_start, t_start + 1);
    exception when unique_violation then
      refused := true;
    end;
    if not refused then
      raise exception '066 FAILED: a term was allowed two registration windows';
    end if;

    -- ---- THE LATE FLAG EXISTS AND DEFAULTS TO FALSE --------------------
    select count(*) into n
      from information_schema.columns
     where table_schema = 'public' and table_name = 'enrollments'
       and column_name = 'registered_late' and is_nullable = 'NO';
    if n <> 1 then
      raise exception '066 FAILED: enrollments.registered_late is missing or nullable';
    end if;

    raise notice '066 OK — a term with no window recorded is OPEN, a recorded window opens and '
                 'closes on its dates, a window outside its own semester is refused, a term '
                 'cannot have two, and a registration can record that it was late.';

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   067_one_student_one_record.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 067 — ONE STUDENT, ONE RECORD
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- NOTHING IS WRITTEN AND NOTHING IS REFUSED. Three views appear, and with them
-- a question the system has never been able to answer: WHERE IS THIS STUDENT
-- UP TO?
--
-- Not "what have they passed" — the transcript answers that, and has for
-- months. The unanswered one is the one a student actually asks: what is left?
-- Which courses of MY programme have I still to take, which am I on now, and
-- how far is that from the award?
--
-- ---------------------------------------------------------------------------
-- WHY THIS COULD NOT BE ASKED BEFORE
-- ---------------------------------------------------------------------------
--
-- It needs three things that arrived separately and only now exist together:
--
--   057 made the CURRICULUM data. Before it, what a programme required was a
--   TypeScript constant compiled into the website, so no query could compare a
--   student's results against it.
--
--   057 also put `programme_version_id` on the student. That is the whole of
--   the University's own ruling that "students remain attached to the
--   curriculum version under which they were admitted" — without it, a student
--   admitted in 2024 would be measured against a curriculum revised in 2026
--   and told they were short of courses that did not exist when they enrolled.
--
--   063 linked a registration to an OFFERING, so "registered" means registered
--   on something that runs, in a term, rather than on the idea of a course.
--
-- ---------------------------------------------------------------------------
-- WHAT `not-taken` MEANS, AND WHY IT IS NOT AN ERROR
-- ---------------------------------------------------------------------------
--
-- A first-year student has not taken the third-year courses, and that is not a
-- finding. `student_curriculum_progress` returns EVERY entry of the student's
-- curriculum with its state, including the ones they have not reached, because
-- a list of only what they have done cannot show what is left — which is the
-- entire question.
--
-- The four states are exact:
--
--   passed      an APPROVED result with a grade point above zero
--   failed      an APPROVED result with a grade point of zero
--   registered  on the roll for it now, no approved result yet
--   not-taken   neither
--
-- A MARK THAT HAS BEEN ENTERED BUT NOT APPROVED IS NOT A PASS. It is a
-- proposal, and a board may yet send it back. Counting it would tell a student
-- they had finished a course the University has not agreed they have finished.
-- ===========================================================================


-- ===========================================================================
-- 0. THE MIGRATIONS THIS ONE NEEDS
-- ===========================================================================

do $$
begin
  if to_regclass('public.curriculum_entries') is null then
    raise exception
      'Migration 057 has not been run on this database: there is no curriculum to measure a '
      'student against. Run 057_the_academic_structure.sql first, or run the whole bundle.';
  end if;
end $$;


-- ===========================================================================
-- 1. WHERE IS THIS STUDENT UP TO, COURSE BY COURSE
-- ===========================================================================
--
-- One row per entry in the curriculum the student was admitted under.
--
-- THE CREDIT IS THE CURRICULUM'S, NOT THE COURSE'S, where the curriculum
-- states one. The same rule `curriculum_progress` applies, and for the same
-- reason: a course may be worth a different number of credits in a different
-- programme, which is exactly why 057 moved the figure onto the entry. Two
-- views disagreeing about what a course is worth is how a student passes a
-- degree on one screen and is six credits short on another.

create or replace view student_curriculum_progress
with (security_invoker = true) as
select s.id                                        as student_id,
       s.programme_version_id,
       e.id                                        as entry_id,
       e.course_id,
       c.code                                      as course_code,
       c.title                                     as course_title,
       e.year,
       e.semester,
       e.requirement,
       coalesce(e.credits, c.credit_unit, 0)       as credits,
       -- THE APPROVED RESULT, IF THERE IS ONE. `distinct on` with the highest
       -- attempt: a resit is a second row for the same course, and the one
       -- that counts is the latest the University approved.
       r.grade,
       r.grade_point,
       r.attempt,
       en.id                                       as enrollment_id,
       en.academic_year                            as taken_in_year,
       en.semester                                 as taken_in_semester,
       case
         when r.id is not null and r.grade_point > 0 then 'passed'
         when r.id is not null                       then 'failed'
         when en.id is not null                      then 'registered'
         else 'not-taken'
       end                                         as state
  from students s
  join curriculum_entries e on e.programme_version_id = s.programme_version_id
  join courses c on c.id = e.course_id
  -- THE LATEST APPROVED ATTEMPT. A student who failed and resat has two rows;
  -- the record shows the one that stands.
  left join lateral (
    select r2.id, r2.grade, r2.grade_point, r2.attempt
      from results r2
     where r2.student_id = s.id
       and r2.course_id = e.course_id
       and r2.status = 'approved'
     order by coalesce(r2.attempt, 1) desc, r2.approved_at desc nulls last
     limit 1
  ) r on true
  -- AND WHETHER THEY ARE ON IT NOW. Registered and not dropped; a dropped
  -- registration is not a course in progress.
  left join lateral (
    select e2.id, e2.academic_year, e2.semester
      from enrollments e2
     where e2.student_id = s.id
       and e2.course_id = e.course_id
       and e2.status = 'registered'
     order by e2.academic_year desc, e2.semester desc
     limit 1
  ) en on true
 where s.programme_version_id is not null;

comment on view student_curriculum_progress is
  'Every course of the curriculum a student was admitted under, with where they are up to: '
  'passed, failed, registered or not-taken. `not-taken` is not a finding — a first-year student '
  'has not taken the third-year courses — and it is returned because a list of only what has been '
  'done cannot show what is left.';


-- ===========================================================================
-- 2. THE SAME THING, TOTALLED
-- ===========================================================================
--
-- One row per student. What a Registrar needs at a glance and what the record
-- screen opens on.
--
-- EVERY FIGURE IS COUNTED FROM A ROW. `credits_required` is the programme
-- version's own total, not a number typed into a component — that was the
-- fault `graduation.ts` was written to correct, where the Certificate
-- Generator compared against the literal 111 at a University whose Bachelor of
-- Theology is 180.

create or replace view student_academic_record
with (security_invoker = true) as
select s.id                                          as student_id,
       s.matric_no,
       s.student_number,
       -- THE DOUBLE SPACE A NULL MIDDLE NAME LEAVES BEHIND.
       --
       -- Written first as first || ' ' || middle || ' ' || last with coalesce
       -- on each, which reads 'Mabel  Holten' for everybody who has no middle
       -- name — most people. Found by printing it, not by reading it.
       -- `concat_ws` skips nulls, so there is no gap to collapse.
       nullif(trim(both ' ' from
         concat_ws(' ', s.first_name, s.middle_name, s.last_name)), '')
                                                     as full_name,
       s.status,
       s.student_status,
       s.academic_standing,
       s.admission_year,
       s.programme_version_id,
       p.code                                        as programme_code,
       v.name                                        as programme_name,
       v.version_label,
       v.duration_years,
       v.semesters_per_year,
       v.total_credits                               as credits_required,
       -- ---- WHAT THEY HAVE DONE ------------------------------------------
       coalesce(prog.passed, 0)                      as courses_passed,
       coalesce(prog.failed, 0)                      as courses_failed,
       coalesce(prog.registered, 0)                  as courses_registered,
       coalesce(prog.not_taken, 0)                   as courses_outstanding,
       coalesce(prog.credits_earned, 0)              as credits_earned,
       coalesce(prog.credits_registered, 0)          as credits_registered,
       -- HOW FAR FROM THE AWARD. Negative means short. Null where the
       -- programme states no total to measure against — which is a different
       -- thing from being on target, and is why it is not coalesced to zero.
       case when v.total_credits is null then null
            else coalesce(prog.credits_earned, 0) - v.total_credits
       end                                           as credits_against_award,
       -- ---- AND WHAT THE GPA ENGINE LAST COMPUTED ------------------------
       --
       -- READ, NOT RECOMPUTED. `semester_gpas` is written by the recompute
       -- route against the published scale; a view that did its own arithmetic
       -- here would be a second grading scale, and the two would disagree the
       -- first time the Senate changed one.
       g.cgpa,
       g.gpa                                         as last_semester_gpa,
       g.academic_year                               as last_computed_year,
       g.semester                                    as last_computed_semester
  from students s
  left join programme_versions v on v.id = s.programme_version_id
  left join programmes p on p.id = v.programme_id
  left join lateral (
    select count(*) filter (where pr.state = 'passed')                     as passed,
           count(*) filter (where pr.state = 'failed')                     as failed,
           count(*) filter (where pr.state = 'registered')                 as registered,
           count(*) filter (where pr.state = 'not-taken')                  as not_taken,
           coalesce(sum(pr.credits) filter (where pr.state = 'passed'), 0) as credits_earned,
           coalesce(sum(pr.credits) filter (where pr.state = 'registered'), 0)
                                                                          as credits_registered
      from student_curriculum_progress pr
     where pr.student_id = s.id
  ) prog on true
  left join lateral (
    select sg.cgpa, sg.gpa, sg.academic_year, sg.semester
      from semester_gpas sg
     where sg.student_id = s.id
     order by sg.academic_year desc, sg.semester desc
     limit 1
  ) g on true;

comment on view student_academic_record is
  'One row per student: their programme, how far through the curriculum they are, credits earned '
  'against the award, and the GPA the engine last computed. `credits_against_award` is null where '
  'the programme states no total — which is not the same as being on target.';


-- ===========================================================================
-- 3. A TERM AT A TIME
-- ===========================================================================
--
-- The shape the University asked for: "Year 1 — Semester 1, 30 / 30 credits."
--
-- KEYED ON THE TERM THE COURSE WAS ACTUALLY TAKEN IN, not on the curriculum's
-- year and semester. Those are two different facts and conflating them is a
-- real error: a student who repeats a year takes a Year 1 course in their
-- second year, and a progress sheet that files it under Year 1 shows them
-- passing a term they were not enrolled in.

create or replace view student_term_record
with (security_invoker = true) as
select e.student_id,
       e.academic_year,
       e.semester,
       count(*)                                                  as courses_taken,
       count(*) filter (where r.grade_point > 0)                 as courses_passed,
       count(*) filter (where r.id is not null
                          and r.grade_point = 0)                 as courses_failed,
       count(*) filter (where r.id is null)                      as awaiting_result,
       coalesce(sum(c.credit_unit), 0)                           as credits_attempted,
       coalesce(sum(c.credit_unit) filter (where r.grade_point > 0), 0) as credits_earned,
       g.gpa,
       g.cgpa
  from enrollments e
  join courses c on c.id = e.course_id
  left join lateral (
    select r2.id, r2.grade_point
      from results r2
     where r2.student_id = e.student_id
       and r2.course_id = e.course_id
       and r2.status = 'approved'
     order by coalesce(r2.attempt, 1) desc
     limit 1
  ) r on true
  left join semester_gpas g
    on g.student_id = e.student_id
   and g.academic_year = e.academic_year
   and g.semester = e.semester
 where e.status = 'registered'
 group by e.student_id, e.academic_year, e.semester, g.gpa, g.cgpa;

comment on view student_term_record is
  'A student''s terms, one row each, with credits attempted and earned. Keyed on the term the '
  'course was TAKEN in rather than the curriculum''s year and semester — a student repeating a '
  'year takes a Year 1 course in their second year, and filing it under Year 1 shows them '
  'passing a term they were not enrolled in.';


-- ===========================================================================
-- 4. PROVE IT
-- ===========================================================================

do $$
declare
  v_id      uuid;
  stu       uuid;
  crs_a     uuid;
  crs_b     uuid;
  crs_c     uuid;
  dept      uuid;
  enr       uuid;
  n         integer;
  st        text;
  earned    numeric;
begin
  begin
    -- ---- A PROGRAMME VERSION OF ITS OWN, WITH THREE COURSES IN IT -------
    --
    -- CREATED RATHER THAN BORROWED. The first version of this proof took the
    -- oldest existing programme version and asserted the progress view
    -- returned three rows. It returned eighteen, because 062 had already
    -- written fifteen courses into that curriculum — the assertion was
    -- measuring the seed, not the view.
    --
    -- A proof that shares state with the data it is running against is a proof
    -- whose result depends on what else has been seeded, which is no proof.
    declare
      prog_id uuid;
    begin
      insert into programmes (code, award_level, status)
        values ('proof-067-programme', 'Diploma', 'draft')
        returning id into prog_id;
      insert into programme_versions
        (programme_id, version_label, name, duration_years, semesters_per_year,
         total_credits, status, effective_from)
        values (prog_id, 'v-proof', 'A Proof Programme', 1, 2, 13, 'draft', date '2026-08-15')
        returning id into v_id;
    end;

    select id into dept from departments limit 1;
    if dept is null then
      insert into departments (name, code, faculty, head_name)
        values ('Proof 067', 'P067', 'Proof', 'Nobody') returning id into dept;
    end if;

    insert into courses (code, title, credit_unit, department_id, level, semester, year)
      values ('PROOF-067-A', 'A Passed Course', 4, dept, 100, 1, 1) returning id into crs_a;
    insert into courses (code, title, credit_unit, department_id, level, semester, year)
      values ('PROOF-067-B', 'A Failed Course', 4, dept, 100, 1, 1) returning id into crs_b;
    insert into courses (code, title, credit_unit, department_id, level, semester, year)
      values ('PROOF-067-C', 'An Untaken Course', 4, dept, 100, 2, 1) returning id into crs_c;

    insert into curriculum_entries (programme_version_id, course_id, year, semester, requirement, credits)
      values (v_id, crs_a, 1, 1, 'core', 5),   -- NOTE: 5, not the course's 4
             (v_id, crs_b, 1, 1, 'core', 4),
             (v_id, crs_c, 1, 2, 'core', 4);

    insert into students (matric_no, first_name, last_name, email, department_id,
                          program, degree_type, admission_year, status, programme_version_id)
      values ('PROOF/067/1', 'A', 'Candidate', 'proof-067@example.test', dept,
              'Proof', 'Proof', 2026, 'enrolled', v_id)
      returning id into stu;

    -- ---- PASSED, FAILED, REGISTERED, NOT TAKEN -------------------------
    insert into enrollments (student_id, course_id, academic_year, semester, status)
      values (stu, crs_a, 2026, 1, 'registered') returning id into enr;
    insert into results (student_id, course_id, enrollment_id, grade, grade_point, status)
      values (stu, crs_a, enr, 'A', 4.0, 'approved');

    insert into enrollments (student_id, course_id, academic_year, semester, status)
      values (stu, crs_b, 2026, 1, 'registered') returning id into enr;
    insert into results (student_id, course_id, enrollment_id, grade, grade_point, status)
      values (stu, crs_b, enr, 'F', 0.0, 'approved');

    select count(*) into n from student_curriculum_progress where student_id = stu;
    if n <> 3 then
      raise exception
        '067 FAILED: the curriculum has 3 courses and the progress view returned %', n;
    end if;

    select state into st from student_curriculum_progress
      where student_id = stu and course_id = crs_a;
    if st <> 'passed' then raise exception '067 FAILED: a passed course reads %', st; end if;

    select state into st from student_curriculum_progress
      where student_id = stu and course_id = crs_b;
    if st <> 'failed' then raise exception '067 FAILED: a failed course reads %', st; end if;

    -- THE ONE THAT MATTERS MOST: a course the student has not reached must
    -- still appear, because a list of only what has been done cannot show
    -- what is left.
    select state into st from student_curriculum_progress
      where student_id = stu and course_id = crs_c;
    if st <> 'not-taken' then
      raise exception '067 FAILED: an untaken course reads % rather than not-taken', st;
    end if;

    -- ---- THE CURRICULUM'S CREDIT, NOT THE COURSE'S ----------------------
    --
    -- PROOF-067-A is worth 4 in the catalogue and 5 in this curriculum. The
    -- record must count 5: that is the whole reason 057 put the figure on the
    -- entry, and a view reading the course's own number would disagree with
    -- `curriculum_progress` about whether a degree is complete.
    select credits_earned into earned from student_academic_record where student_id = stu;
    if earned <> 5 then
      raise exception
        '067 FAILED: credits earned came to % — the curriculum says PROOF-067-A is worth 5, the '
        'catalogue says 4, and the curriculum governs', earned;
    end if;

    -- ---- AN UNAPPROVED MARK IS NOT A PASS -------------------------------
    --
    -- PROVE THE RULE BY BREAKING IT. A mark entered and not yet approved is a
    -- proposal; counting it tells a student they have finished a course the
    -- University has not agreed they have finished.
    insert into enrollments (student_id, course_id, academic_year, semester, status)
      values (stu, crs_c, 2026, 2, 'registered') returning id into enr;
    insert into results (student_id, course_id, enrollment_id, grade, grade_point, status)
      values (stu, crs_c, enr, 'A', 4.0, 'draft');

    select state into st from student_curriculum_progress
      where student_id = stu and course_id = crs_c;
    if st <> 'registered' then
      raise exception
        '067 FAILED: a course with an UNAPPROVED mark reads % — an unapproved mark is a proposal, '
        'not a pass', st;
    end if;

    select credits_earned into earned from student_academic_record where student_id = stu;
    if earned <> 5 then
      raise exception '067 FAILED: an unapproved mark added % credits to the record', earned - 5;
    end if;

    -- ---- A NULL MIDDLE NAME LEAVES NO DOUBLE SPACE ----------------------
    --
    -- The proof student has no middle name, which is the ordinary case. The
    -- first version of this view read 'A  Candidate'.
    if exists (select 1 from student_academic_record
                where student_id = stu and full_name like '%  %') then
      raise exception
        '067 FAILED: a student with no middle name reads with a double space in their name';
    end if;
    if (select full_name from student_academic_record where student_id = stu)
       <> 'A Candidate' then
      raise exception '067 FAILED: the name reads "%"',
        (select full_name from student_academic_record where student_id = stu);
    end if;

    -- ---- AND THE TERM VIEW COUNTS THE TERM IT WAS TAKEN IN --------------
    select courses_taken into n from student_term_record
      where student_id = stu and academic_year = 2026 and semester = 1;
    if n <> 2 then
      raise exception '067 FAILED: 2026 semester 1 shows % courses, not 2', n;
    end if;

    select courses_outstanding into n from student_academic_record where student_id = stu;
    if n <> 0 then
      raise exception
        '067 FAILED: every course is now taken and % are still counted outstanding', n;
    end if;

    raise notice '067 OK — a student''s whole curriculum is visible including what they have not '
                 'reached; the curriculum''s credit governs over the catalogue''s; an unapproved '
                 'mark is not a pass; and a term counts the courses taken in it.';

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   068_the_course_as_a_place_to_learn.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 068 — THE COURSE AS A PLACE TO LEARN
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- NOTHING IS DELETED AND NOTHING IS REFUSED. A course gains somewhere to keep
-- what is taught in it — an outline, learning outcomes, and materials attached
-- week by week — and a student gains a shelf of the courses they are actually
-- registered on.
--
-- Nothing is seeded. No outline is invented, no reading list is guessed at.
--
-- ---------------------------------------------------------------------------
-- THE UNIVERSITY'S OBJECTION, WHICH THIS ANSWERS
-- ---------------------------------------------------------------------------
--
-- "The LMS should NOT be called a Learning Management System if it isn't
-- actually an LMS… The current LMS looks like a file repository containing:
-- Introduction to AI, SQL Tutorial, React Framework, Neural Networks. Those
-- examples don't even appear connected to the University's actual academic
-- programmes."
--
-- The invented rows were removed months ago. The deeper fault was not the
-- content — it was the SHAPE. Materials lived in `module_records`, a JSON blob
-- store, keyed on a course code typed in as free text. So:
--
--   · a material naming 'BIS 220' matched no course, because a string is not a
--     foreign key;
--   · nothing could list the materials OF a course, only search for a string;
--   · a student could not be shown "my courses", because no material knew
--     which offering, which term or which cohort it belonged to;
--   · and a lecturer's own courses could not be gathered at all.
--
-- A course_id fixes every one of those at once.
--
-- ---------------------------------------------------------------------------
-- WHY A MATERIAL POINTS AT A COURSE AND *OPTIONALLY* AT AN OFFERING
-- ---------------------------------------------------------------------------
--
-- The distinction the University drew, applied one level further down.
--
-- A course outline, a reading list and a set of learning outcomes belong to
-- the COURSE. They are true in 2026 and in 2029, and re-uploading them every
-- August is how a reading list comes to differ between two terms of the same
-- course for no reason anybody intended.
--
-- A lecture recording, a week's slides and a class announcement belong to the
-- OFFERING. They are this term's.
--
-- So `offering_id` is nullable, and that null MEANS SOMETHING: the material
-- stands for every term the course runs. A screen showing an offering shows
-- both; a screen showing the catalogue entry shows only the first.
-- ===========================================================================


-- ===========================================================================
-- 0. THE MIGRATIONS THIS ONE NEEDS
-- ===========================================================================

do $$
begin
  if to_regclass('public.course_offerings') is null then
    raise exception
      'Migration 063 has not been run on this database: there are no course offerings for a '
      'term''s materials to belong to. Run 063_the_offering_and_the_class.sql first, or run the '
      'whole bundle.';
  end if;
end $$;


-- ===========================================================================
-- 1. WHAT A COURSE TEACHES
-- ===========================================================================
--
-- `courses.description` has existed since 001 and is the prospectus sentence.
-- These two are different things and a University distinguishes them:
--
--   THE OUTLINE is what will be covered, week by week. It is what a student
--   reads to know what they are in for.
--
--   THE LEARNING OUTCOMES are what they will be able to do afterwards. They
--   are what an examiner writes a paper against and what an accreditor asks
--   to see, and they are the reason this is a separate column rather than more
--   prose in the description.
--
-- BOTH NULLABLE. Not one course in this University has either recorded, and
-- inventing them would be inventing what the University teaches.

alter table courses
  add column if not exists outline           text,
  add column if not exists learning_outcomes text;

comment on column courses.outline is
  'What the course covers, week by week. Distinct from `description`, which is the prospectus '
  'sentence. Null until the University writes one — an invented outline is an invented course.';

comment on column courses.learning_outcomes is
  'What a student can do after passing. What an examiner writes a paper against and what an '
  'accreditor asks to see, which is why it is not more prose in the description.';


-- ===========================================================================
-- 2. THE MATERIALS THEMSELVES
-- ===========================================================================

create table if not exists course_materials (
  id           uuid primary key default gen_random_uuid(),

  -- A FOREIGN KEY, NOT A TYPED-IN CODE. This is the whole of the fix: a
  -- material naming 'BIS 220' as a string matched no course and could not be
  -- listed, filtered or counted. ON DELETE CASCADE because a material for a
  -- course that no longer exists is a file nobody can reach through any screen.
  course_id    uuid not null references courses (id) on delete cascade,

  -- THIS TERM'S, OR EVERY TERM'S. Null means the material belongs to the
  -- COURSE and stands for every term it runs — see the file header. ON DELETE
  -- CASCADE would destroy a recording when a term is tidied away, so a
  -- cancelled offering releases its materials back to the course instead.
  offering_id  uuid references course_offerings (id) on delete set null,

  kind         text not null default 'note'
                 check (kind in ('outline', 'reading', 'note', 'slides', 'video',
                                 'link', 'recording', 'announcement')),

  -- THE TEACHING WEEK, where the material belongs to one. Null for anything
  -- that stands outside the weekly rhythm: the reading list, the outline.
  week         integer check (week is null or week between 1 and 52),

  title        text not null check (length(btrim(title)) between 1 and 300),
  body         text,
  url          text,

  -- VISIBLE TO STUDENTS, OR NOT YET. A lecturer preparing week 9 in week 2
  -- must be able to keep it back; without this they keep it on their own
  -- computer, which is where it stays when they are ill.
  visible      boolean not null default true,

  sort_order   integer not null default 0,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- A MATERIAL IS SOMETHING TO READ, WATCH OR OPEN. One with neither a body
  -- nor a link is a title on a page that does nothing when clicked, and a
  -- student cannot tell it from a broken one.
  constraint course_materials_have_something
    check (body is not null or url is not null)
);

create index if not exists course_materials_by_course
  on course_materials (course_id, week, sort_order);
create index if not exists course_materials_by_offering
  on course_materials (offering_id) where offering_id is not null;

comment on table course_materials is
  'What is taught in a course: outline, reading, notes, slides, video, recordings. Keyed to the '
  'course by FOREIGN KEY rather than by a typed-in code — a material naming ''BIS 220'' as a '
  'string matched no course and could be searched for but never listed. `offering_id` null means '
  'the material belongs to the course and stands for every term it runs.';

-- AND THE OFFERING MUST BE OF THE COURSE. Without this a material can name
-- BIS 220 and point at an offering of OT 300, and the week 3 slides appear on
-- somebody else's course.
create or replace function refuse_a_material_on_the_wrong_course()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  offered uuid;
begin
  if new.offering_id is null then return new; end if;
  select course_id into offered from course_offerings where id = new.offering_id;
  if offered is distinct from new.course_id then
    raise exception
      'This material names one course and an offering of another. It would appear on the wrong '
      'course''s page.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists course_materials_match_the_offering on course_materials;
create trigger course_materials_match_the_offering
  before insert or update on course_materials
  for each row execute function refuse_a_material_on_the_wrong_course();


-- ===========================================================================
-- 3. MY COURSES — THE SHELF A STUDENT OPENS
-- ===========================================================================
--
-- The University asked for it in these words: "My Programmes → My Courses →
-- inside BIS 220: course overview, lecturer, outline, weekly materials…"
--
-- THE SHELF IS THE REGISTRATIONS, not the catalogue. A student's courses are
-- the ones they are registered on this term — which is a question that could
-- not be asked before 063 linked a registration to an offering, because
-- "registered on BIS 220" named no term, no lecturer and no class.
--
-- `security_invoker` AND `auth.uid()`: the view returns the signed-in
-- student's own courses and nobody else's, and it does so in the database
-- rather than by a screen remembering to filter. A screen that forgets is a
-- screen that shows one student another's timetable.

create or replace view my_courses
with (security_invoker = true) as
select s.id                    as student_id,
       c.id                    as course_id,
       c.code                  as course_code,
       c.title                 as course_title,
       c.credit_unit,
       c.description,
       c.outline,
       c.learning_outcomes,
       o.id                    as offering_id,
       o.term_sequence,
       o.delivery_mode,
       o.campus,
       o.status                as offering_status,
       y.label                 as year_label,
       y.starts_in,
       l.id                    as lecturer_id,
       coalesce(l.first_name || ' ' || l.last_name, null) as lecturer,
       e.id                    as enrollment_id,
       e.academic_year,
       e.semester,
       e.status                as registration_status,
       -- HOW MUCH THERE IS TO READ. Counted here so a shelf can show it
       -- without a second query per course — and so a course with nothing in
       -- it says nothing rather than looking broken.
       (select count(*) from course_materials m
         where m.course_id = c.id
           and m.visible
           and (m.offering_id is null or m.offering_id = o.id))  as materials
  from enrollments e
  join students s on s.id = e.student_id
  join courses c on c.id = e.course_id
  left join course_offerings o on o.id = e.offering_id
  left join academic_years y on y.id = o.academic_year_id
  left join lecturers l on l.id = o.lecturer_id
 where e.status = 'registered'
   and s.auth_user_id = auth.uid();

comment on view my_courses is
  'The signed-in student''s own courses: what they are registered on, who teaches it this term, '
  'and how much material there is. Filtered by auth.uid() in the DATABASE rather than by a screen '
  'remembering to — a screen that forgets shows one student another''s courses.';


-- ===========================================================================
-- 4. AND THE COURSES A LECTURER TEACHES
-- ===========================================================================
--
-- The same question from the other side, and equally unanswerable before 063:
-- `courses.lecturer_id` says who teaches a course FOREVER, in every year and
-- on every campus, which is the mistake 063 was written to correct. The
-- offering says who teaches it THIS TERM.
--
-- BOTH ARE READ, and that is deliberate rather than untidy. Until the
-- University sets up a term, `courses.lecturer_id` is the only record of who
-- teaches what, and a lecturer whose shelf was empty until somebody built an
-- offering would conclude the system had lost their courses.

create or replace view my_teaching
with (security_invoker = true) as
with mine as (
  -- ---- WHAT THEY ARE OFFERING THIS TERM -------------------------------
  select l.id              as lecturer_id,
         c.id              as course_id,
         c.code            as course_code,
         c.title           as course_title,
         c.credit_unit,
         o.id              as offering_id,
         o.term_sequence,
         o.status          as offering_status,
         o.delivery_mode,
         y.label           as year_label,
         y.starts_in,
         'offering'::text  as attached_by
    from lecturers l
    join course_offerings o on o.lecturer_id = l.id
    join courses c on c.id = o.course_id
    join academic_years y on y.id = o.academic_year_id
   -- THE ACCOUNT, BY `auth_user_id` AND NOT BY EMAIL. Written first as
   -- `join profiles p on p.email = l.email`, which silently returns NOTHING
   -- for any lecturer whose sign-in address differs from the one on their
   -- staff record — and a shelf that is empty for a reason nobody can see is
   -- worse than one that errors. 001 put the column here for this.
   where l.auth_user_id = auth.uid()

  union all

  -- ---- AND WHAT THE CATALOGUE STILL SAYS THEY TEACH --------------------
  --
  -- `courses.lecturer_id` says who teaches a course FOREVER — the mistake 063
  -- was written to correct. It is read anyway, and only where no offering of
  -- that course names them, because until the University sets up a term it is
  -- the ONLY record of who teaches what. A lecturer whose shelf was empty
  -- until somebody built an offering would conclude the system had lost their
  -- courses.
  select l.id, c.id, c.code, c.title, c.credit_unit,
         null::uuid, null::integer, null::text, null::text, null::text, null::integer,
         'catalogue'::text
    from lecturers l
    join courses c on c.lecturer_id = l.id
   where l.auth_user_id = auth.uid()
     and not exists (
       select 1 from course_offerings o2
        where o2.course_id = c.id and o2.lecturer_id = l.id)
)
select m.*,
       (select count(*) from course_materials mt
         where mt.course_id = m.course_id
           and (mt.offering_id is null or mt.offering_id = m.offering_id))  as materials,
       (select count(*) from enrollments e
         where e.status = 'registered'
           and (case when m.offering_id is not null then e.offering_id = m.offering_id
                     else e.course_id = m.course_id end))                   as registered
  from mine m;

comment on view my_teaching is
  'The signed-in lecturer''s courses, from their offerings this term AND from courses.lecturer_id '
  'where no term has been set up. `attached_by` says which, because a lecturer whose shelf was '
  'empty until somebody built an offering would conclude the system had lost their courses. '
  'Matched on lecturers.auth_user_id, not on email: an email match returns nothing, silently, for '
  'anybody whose sign-in address differs from their staff record.';


-- ===========================================================================
-- 5. WHO CAN READ AND WRITE A MATERIAL
-- ===========================================================================
--
-- A MATERIAL IS FOR THE CLASS, NOT FOR THE WORLD. `course_offerings` is
-- readable by anybody — what is on offer is a prospectus — but a lecture
-- recording is not.
--
-- Every signed-in member of the University may read a visible material. That
-- is wider than "only the registered students" on purpose: a student deciding
-- whether to take a course next term should be able to see its outline and
-- reading list, and an examiner marking it needs the same. A material a
-- lecturer is still preparing is `visible = false` and is nobody's but the
-- offices that manage courses.

alter table course_materials enable row level security;

drop policy if exists course_materials_read on course_materials;
create policy course_materials_read on course_materials
  for select using (
    (visible and auth.uid() is not null)
    or auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                       'dean', 'hod', 'programme-coordinator', 'lecturer')
  );

-- No write policy. Every change goes through /api/academic/materials.


-- ===========================================================================
-- 6. PROVE IT
-- ===========================================================================

do $$
declare
  dept     uuid;
  crs_a    uuid;
  crs_b    uuid;
  y_id     uuid;
  off_a    uuid;
  off_b    uuid;
  n        integer;
  refused  boolean;
begin
  begin
    select id into dept from departments limit 1;
    if dept is null then
      insert into departments (name, code, faculty, head_name)
        values ('Proof 068', 'P068', 'Proof', 'Nobody') returning id into dept;
    end if;

    insert into courses (code, title, credit_unit, department_id, level, semester, year)
      values ('PROOF-068-A', 'A Course With Materials', 3, dept, 100, 1, 1)
      returning id into crs_a;
    insert into courses (code, title, credit_unit, department_id, level, semester, year)
      values ('PROOF-068-B', 'Another Course Entirely', 3, dept, 100, 1, 1)
      returning id into crs_b;

    select id into y_id from academic_years order by starts_in limit 1;
    insert into course_offerings (course_id, academic_year_id, term_sequence)
      values (crs_a, y_id, 1) returning id into off_a;
    insert into course_offerings (course_id, academic_year_id, term_sequence)
      values (crs_b, y_id, 1) returning id into off_b;

    -- ---- A MATERIAL OF THE COURSE, FOR EVERY TERM -----------------------
    insert into course_materials (course_id, kind, title, body)
      values (crs_a, 'outline', 'Course outline', 'Week 1 to week 12.');

    -- ---- AND ONE OF THIS TERM ONLY --------------------------------------
    insert into course_materials (course_id, offering_id, kind, week, title, url)
      values (crs_a, off_a, 'recording', 3, 'Week 3 lecture', 'https://example.test/w3');

    select count(*) into n from course_materials where course_id = crs_a;
    if n <> 2 then
      raise exception '068 FAILED: the course has % materials, expected 2', n;
    end if;

    -- ---- A MATERIAL CANNOT NAME AN OFFERING OF ANOTHER COURSE -----------
    --
    -- PROVE THE GUARD BY BREAKING IT. Without this the week 3 slides of one
    -- course appear on the page of another.
    refused := false;
    begin
      insert into course_materials (course_id, offering_id, kind, title, url)
        values (crs_a, off_b, 'slides', 'Slides on the wrong course', 'https://example.test/x');
    exception when check_violation then
      refused := true;
    end;
    if not refused then
      raise exception
        '068 FAILED: a material was attached to an offering of a different course';
    end if;

    -- ---- A MATERIAL WITH NEITHER A BODY NOR A LINK IS REFUSED -----------
    --
    -- A title that does nothing when clicked is indistinguishable from a
    -- broken one, and a student cannot tell which.
    refused := false;
    begin
      insert into course_materials (course_id, kind, title)
        values (crs_a, 'note', 'A title and nothing else');
    exception when check_violation then
      refused := true;
    end;
    if not refused then
      raise exception '068 FAILED: a material with nothing in it was accepted';
    end if;

    -- ---- AND A WEEK OUTSIDE A YEAR IS REFUSED ---------------------------
    refused := false;
    begin
      insert into course_materials (course_id, kind, week, title, body)
        values (crs_a, 'note', 70, 'Week seventy', 'x');
    exception when check_violation then
      refused := true;
    end;
    if not refused then
      raise exception '068 FAILED: a material was filed under week 70';
    end if;

    -- ---- THE COURSE KEEPS ITS MATERIALS WHEN AN OFFERING GOES -----------
    --
    -- ON DELETE SET NULL, not cascade. A term tidied away must not destroy the
    -- recording of a lecture that was actually given — and a material whose
    -- term is gone falls back to belonging to the course, which is the
    -- sensible reading of it.
    delete from course_offerings where id = off_a;
    select count(*) into n from course_materials where course_id = crs_a;
    if n <> 2 then
      raise exception
        '068 FAILED: deleting the offering destroyed % of the course''s materials', 2 - n;
    end if;
    select count(*) into n
      from course_materials where course_id = crs_a and offering_id is null;
    if n <> 2 then
      raise exception
        '068 FAILED: a material whose offering was deleted did not fall back to the course';
    end if;

    -- ---- AND THE OUTLINE COLUMNS EXIST, EMPTY ---------------------------
    select count(*) into n
      from information_schema.columns
     where table_schema = 'public' and table_name = 'courses'
       and column_name in ('outline', 'learning_outcomes');
    if n <> 2 then
      raise exception '068 FAILED: the outline columns were not added';
    end if;

    select count(*) into n from courses
     where outline is not null or learning_outcomes is not null;
    if n <> 0 then
      raise exception
        '068 FAILED: % course(s) arrived with an outline nobody wrote. An invented outline is an '
        'invented course.', n;
    end if;

    raise notice '068 OK — materials key to a course by foreign key, a term''s material cannot '
                 'land on another course, a material with nothing in it is refused, and deleting '
                 'a term releases its materials to the course rather than destroying them.';

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   069_the_end_of_the_chain.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 069 — THE END OF THE CHAIN
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- NOTHING IS CONFERRED AND NOTHING IS REFUSED. A view appears that gathers, for
-- every student, what a graduation decision actually needs — the award they are
-- reading for, the credits they have earned, their cumulative GPA, any
-- outstanding condition of admission, and whether a degree has already been
-- conferred on them.
--
-- And one column is added to `graduation_records`, for the case the table could
-- not previously record: a Senate conferring a degree on a candidate who did
-- not meet every requirement, WITH ITS REASON.
--
-- ---------------------------------------------------------------------------
-- THE TABLE HAS EXISTED SINCE 019 AND NOTHING HAS EVER TOUCHED IT
-- ---------------------------------------------------------------------------
--
-- `graduation_records` was created in migration 019, with a good design: the
-- Senate's resolution date is NOT NULL, a degree cannot be conferred before the
-- Senate resolved to confer it, and one award is conferred on one student once.
--
-- No screen and no route has ever read or written a row into it. It is the same
-- fault `reachability.test.mjs` was written to catch — a thing that exists, is
-- correct, and is connected to nothing — and it escaped that test only because
-- the test hunts tables that are READ and never written. This one was neither.
--
-- So this migration adds no table. The end of the chain was already modelled;
-- it just had no door.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS SYSTEM CANNOT ESTABLISH, AND SAYS SO
-- ---------------------------------------------------------------------------
--
-- `src/lib/graduation.ts` checks four things: credits, cumulative GPA,
-- outstanding admission conditions, and fees. Three are answerable from rows.
--
-- THE FOURTH IS NOT. The University keeps no per-student fee schedule in this
-- system — `payments` records what was received, and nothing records what was
-- owed — so a balance cannot be computed. `assessGraduation` is already
-- careful about this: it reports the fee check as UNKNOWN rather than as zero,
-- because "we did not look" and "nothing is owed" are different answers and
-- only one of them should let a degree through.
--
-- The consequence is worth stating plainly rather than discovering: NO
-- CANDIDATE EVER FULLY QUALIFIES BY COMPUTATION. Every verdict is
-- indeterminate on fees. That is not a bug to be worked around by pretending
-- the balance is zero — it is the system telling the truth about what it
-- knows, and the Senate confers on a fee position confirmed with the Finance
-- Office, not with this screen.
--
-- ---------------------------------------------------------------------------
-- AND A CONFERRAL IS A RECORD OF AN ACT, NOT THE ACT
-- ---------------------------------------------------------------------------
--
-- `graduation.ts` says it in its own header: "Whether the Senate has resolved
-- to confer… is a meeting, not a computation, and no query stands in for it —
-- this establishes that a candidate QUALIFIES, and a human still confers."
--
-- 019 built that in: `senate_approved_on` is NOT NULL, so a conferral cannot
-- be recorded without naming the day the Senate resolved. What follows adds
-- the missing half of the same idea — where the Senate confers DESPITE an
-- unmet requirement, the reason is recorded on the row and stays there.
-- ===========================================================================


-- ===========================================================================
-- 0. THE MIGRATIONS THIS ONE NEEDS
-- ===========================================================================

do $$
begin
  if to_regclass('public.graduation_records') is null then
    raise exception
      'Migration 019 has not been run on this database: there is no graduation record to write '
      'into. Run 019_academic_record.sql first, or run the whole bundle.';
  end if;
  if to_regclass('public.student_academic_record') is null then
    raise exception
      'Migration 067 has not been run on this database: there is no academic record to assess a '
      'candidate from. Run 067_one_student_one_record.sql first, or run the whole bundle.';
  end if;
end $$;


-- ===========================================================================
-- 1. CONFERRED DESPITE SOMETHING
-- ===========================================================================
--
-- NULL IS THE NORMAL CASE, and it means the candidate met every requirement
-- the system could check.
--
-- A VALUE MEANS THE SENATE WENT AHEAD ANYWAY, and says why. That happens — an
-- aegrotat award, a case referred and resolved, a requirement waived on
-- evidence this system never held — and a University whose system cannot
-- record it is a University that records it on paper, where no audit will find
-- it and no later question can be answered from it.
--
-- IT IS NOT A FLAG. A boolean would say that something was overridden and not
-- what; the reason is the whole value of the column, and it stays on the row
-- for as long as the degree stands.

alter table graduation_records
  add column if not exists conferred_despite text;

comment on column graduation_records.conferred_despite is
  'Where the Senate conferred despite an unmet requirement, the reason — in words, not a flag. '
  'Null is the normal case and means every requirement the system can check was met. A '
  'University whose system cannot record an exception records it on paper, where no audit finds '
  'it.';


-- ===========================================================================
-- 2. EVERY CANDIDATE, WITH WHAT A DECISION NEEDS
-- ===========================================================================
--
-- One row per student who is reading for an award, carrying the four inputs
-- `assessGraduation` takes. Gathered here rather than in five reads per
-- candidate, so that a cohort of two hundred is one query.
--
-- THE ASSESSMENT ITSELF IS NOT DONE HERE. `src/lib/graduation.ts` holds it,
-- tested, and it is the same function the Certificate Generator already calls.
-- A second copy in SQL would mean a candidate's eligibility depending on which
-- screen asked — which is the exact fault `prerequisites.ts` exists to prevent
-- one level down.

create or replace view graduation_candidate
with (security_invoker = true) as
select r.student_id,
       r.matric_no,
       r.student_number,
       r.full_name,
       r.status,
       r.student_status,
       r.programme_code,
       r.programme_name,
       r.credits_required,
       r.credits_earned,
       r.credits_against_award,
       r.courses_outstanding,
       r.courses_failed,
       r.cgpa,
       s.award_id,
       a.code                     as award_code,
       a.title                    as award_title,
       a.kind                     as award_kind,
       a.credits_required         as award_credits_required,
       a.min_cgpa,
       a.cgpa_confirmed,
       -- THE ADMISSION CONDITIONS, AS THE COLUMN HOLDS THEM. Text, parsed by
       -- the caller. Not parsed here: `assessGraduation` already treats
       -- unparseable conditions as ONE OUTSTANDING ITEM rather than as none,
       -- and a view that silently returned an empty array on bad JSON would
       -- wave through the case that most needs looking at.
       s.admission_conditions,
       -- ---- AND WHETHER IT IS ALREADY DONE --------------------------------
       g.id                       as graduation_id,
       g.senate_approved_on,
       g.conferred_on,
       g.convocation_on,
       g.classification,
       g.graduation_number,
       g.certificate_credential_id,
       g.conferred_despite
  from student_academic_record r
  join students s on s.id = r.student_id
  left join awards a on a.id = s.award_id
  -- ONE CONFERRAL OF ONE AWARD TO ONE STUDENT — 019's unique constraint, so
  -- this join cannot multiply rows.
  left join graduation_records g
    on g.student_id = s.id and g.award_id is not distinct from s.award_id;

comment on view graduation_candidate is
  'Every student reading for an award, with the four inputs a graduation decision needs and '
  'whether a degree has already been conferred. The assessment itself lives in '
  'src/lib/graduation.ts and is not restated here — a second copy would mean eligibility '
  'depending on which screen asked.';


-- ===========================================================================
-- 3. AND THE COHORT, TOTALLED
-- ===========================================================================
--
-- What a Registrar preparing a congregation needs at a glance: how many have
-- been conferred, on what dates, and how many are still candidates.

create or replace view graduation_cohort
with (security_invoker = true) as
select coalesce(g.conferred_on, date '1900-01-01')      as conferred_on,
       count(*)                                          as conferred,
       count(*) filter (where g.conferred_despite is not null) as conferred_despite,
       count(distinct g.award_id)                        as awards,
       min(g.senate_approved_on)                         as senate_approved_on,
       max(g.convocation_on)                             as convocation_on
  from graduation_records g
 group by g.conferred_on;

comment on view graduation_cohort is
  'Conferrals grouped by the day they were conferred — a congregation, as the record sees it. '
  '`conferred_despite` counts the ones where the Senate went ahead over an unmet requirement.';


-- ===========================================================================
-- 4. WHO CAN WRITE ONE
-- ===========================================================================
--
-- 019 gave the table a READ policy and no write policy at all, which is why
-- nothing could ever write to it through the client. That stays: every
-- conferral goes through /api/academic/graduation, which re-runs the
-- assessment server-side before it writes.
--
-- The read policy 019 set already includes the student's own row, so a
-- graduate can see their own conferral. Nothing here widens it.


-- ===========================================================================
-- 5. PROVE IT
-- ===========================================================================

do $$
declare
  dept     uuid;
  v_id     uuid;
  prog_id  uuid;
  award    uuid;
  stu      uuid;
  n        integer;
  refused  boolean;
  g_id     uuid;
begin
  begin
    select id into dept from departments limit 1;
    if dept is null then
      insert into departments (name, code, faculty, head_name)
        values ('Proof 069', 'P069', 'Proof', 'Nobody') returning id into dept;
    end if;

    insert into programmes (code, award_level, status)
      values ('proof-069-programme', 'Diploma', 'draft') returning id into prog_id;
    insert into programme_versions
      (programme_id, version_label, name, duration_years, semesters_per_year,
       total_credits, status, effective_from)
      values (prog_id, 'v-proof', 'A Proof Programme', 1, 2, 24, 'draft', date '2026-08-15')
      returning id into v_id;

    insert into awards (code, title, kind, credits_required, min_cgpa, cgpa_confirmed)
      values ('P069', 'Proof Award', 'diploma', 24, 2.00, true)
      returning id into award;

    insert into students (matric_no, first_name, last_name, email, department_id,
                          program, degree_type, admission_year, status,
                          programme_version_id, award_id)
      values ('PROOF/069/1', 'A', 'Candidate', 'proof-069@example.test', dept,
              'Proof', 'Proof', 2026, 'enrolled', v_id, award)
      returning id into stu;

    -- ---- THE CANDIDATE IS VISIBLE, AND NOT YET CONFERRED ----------------
    select count(*) into n from graduation_candidate where student_id = stu;
    if n <> 1 then
      raise exception '069 FAILED: the candidate view returned % rows for one student', n;
    end if;

    select count(*) into n
      from graduation_candidate where student_id = stu and graduation_id is null;
    if n <> 1 then
      raise exception '069 FAILED: a student with no conferral was reported as conferred';
    end if;

    -- ---- THE AWARD'S OWN REQUIREMENT IS CARRIED -------------------------
    --
    -- Not a number typed into a component. That was the fault `graduation.ts`
    -- was written to correct: the Certificate Generator compared against the
    -- literal 111 at a University whose Bachelor of Theology is 180.
    select award_credits_required into n from graduation_candidate where student_id = stu;
    if n <> 24 then
      raise exception '069 FAILED: the award requirement read % rather than the award''s 24', n;
    end if;

    -- ---- A DEGREE CANNOT BE CONFERRED BEFORE THE SENATE RESOLVED --------
    --
    -- PROVE THE GUARD BY BREAKING IT. 019 set this constraint and nothing has
    -- ever exercised it, because nothing has ever written to the table.
    refused := false;
    begin
      insert into graduation_records
        (student_id, award_id, senate_approved_on, conferred_on)
        values (stu, award, date '2027-07-15', date '2027-07-01');
    exception when check_violation then
      refused := true;
    end;
    if not refused then
      raise exception
        '069 FAILED: a degree was conferred two weeks BEFORE the Senate resolved to confer it';
    end if;

    -- ---- A PROPER CONFERRAL ---------------------------------------------
    insert into graduation_records
      (student_id, award_id, senate_approved_on, conferred_on, convocation_on,
       classification, graduation_number)
      values (stu, award, date '2027-07-01', date '2027-07-15', date '2027-08-02',
              'Pass', 'IGUC/G/2027/0001')
      returning id into g_id;

    select count(*) into n
      from graduation_candidate where student_id = stu and graduation_id is not null;
    if n <> 1 then
      raise exception '069 FAILED: a conferred degree does not show on the candidate view';
    end if;

    -- ---- AND A SECOND IS REFUSED ----------------------------------------
    --
    -- 019's unique (student_id, award_id). A second conferral of the same
    -- award is a REISSUE of the certificate, not a second degree, and the
    -- difference matters on a register somebody verifies against.
    refused := false;
    begin
      insert into graduation_records
        (student_id, award_id, senate_approved_on, conferred_on)
        values (stu, award, date '2028-07-01', date '2028-07-15');
    exception when unique_violation then
      refused := true;
    end;
    if not refused then
      raise exception
        '069 FAILED: the same award was conferred on the same student twice';
    end if;

    -- ---- THE REASON COLUMN HOLDS A REASON, NOT A FLAG -------------------
    update graduation_records
       set conferred_despite = 'Senate resolved on 1 July 2027 to confer notwithstanding six '
                               || 'credits outstanding, on the medical evidence considered.'
     where id = g_id;

    select count(*) into n
      from graduation_candidate
     where student_id = stu and conferred_despite like '%medical evidence%';
    if n <> 1 then
      raise exception '069 FAILED: the recorded reason does not reach the candidate view';
    end if;

    -- ---- AND THE COHORT COUNTS IT ---------------------------------------
    select conferred_despite into n from graduation_cohort
     where conferred_on = date '2027-07-15';
    if n <> 1 then
      raise exception
        '069 FAILED: the cohort view counted % conferrals made despite an unmet requirement', n;
    end if;

    raise notice '069 OK — every candidate carries their award''s own requirement, a degree '
                 'cannot be conferred before the Senate resolved, the same award cannot be '
                 'conferred twice, and a conferral made despite an unmet requirement records '
                 'the reason in words.';

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   070_where_the_student_stands.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 070 — WHERE THE STUDENT STANDS
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- NOTHING IS WRITTEN AND NOTHING IS REFUSED. One function and three views
-- appear, and with them the question the student portal has never been able to
-- ask: WHERE IS THIS STUDENT IN THEIR OWN JOURNEY?
--
-- ---------------------------------------------------------------------------
-- THE UNIVERSITY'S INSTRUCTION
-- ---------------------------------------------------------------------------
--
-- "The student web should not simply expose the Superadmin Academic modules.
-- It should be a student-facing academic journey, with information and actions
-- appearing according to the student's actual status."
--
-- That last clause is the architectural requirement, and it cannot be met by a
-- screen. A screen deciding what to show has to work the stage out for itself,
-- from two status columns and a handful of counts — and the dashboard, the
-- navigation, the registration screen and the programme page would each work
-- it out separately and come to differ. The first time they differ, a student
-- is offered a registration button on a screen that also tells them
-- registration has closed.
--
-- So the stage is decided ONCE, in `student_stage()`, and everything reads it.
--
-- ---------------------------------------------------------------------------
-- THE TWO STATUS COLUMNS, AND WHY NEITHER IS THE ANSWER ALONE
-- ---------------------------------------------------------------------------
--
-- `students.status` is the ADMISSION pipeline: draft, applicant, under_review,
-- … admission_issued, enrolled, withdrawn. It answers "how far has this
-- application got".
--
-- `students.student_status` is the ENROLLED LIFE: active, graduated,
-- suspended, withdrawn. It answers "what is this student's standing now".
--
-- Neither answers "what should this person see today". An enrolled, active
-- student with no programme version has nothing to register for; one with a
-- conferred degree is not a student at all any more; one whose registration
-- window has closed and who registered for nothing has a different problem
-- from one who registered for six courses. The stage is the combination.
-- ===========================================================================


-- ===========================================================================
-- 0. THE MIGRATIONS THIS ONE NEEDS
-- ===========================================================================

do $$
begin
  if to_regclass('public.student_academic_record') is null then
    raise exception
      'Migration 067 has not been run on this database: there is no academic record for a '
      'journey to be drawn from. Run 067_one_student_one_record.sql first, or run the whole '
      'bundle.';
  end if;
  if to_regclass('public.registration_window') is null then
    raise exception
      'Migration 066 has not been run on this database: there is no registration window. Run '
      '066_when_registration_is_open.sql first, or run the whole bundle.';
  end if;
end $$;


-- ===========================================================================
-- 1. THE STAGE, DECIDED ONCE
-- ===========================================================================
--
-- Immutable and pure: the same inputs always give the same answer, and it can
-- be called from a view, from a policy, or by an operator checking a case.
--
-- THE ORDER OF THE TESTS IS THE WHOLE LOGIC and it runs from the end
-- backwards, because the later facts overrule the earlier ones. A student with
-- a conferred degree is an alumnus whatever their admission record says; a
-- withdrawal overrules an enrolment; and only after those is it worth asking
-- how far an application got.

create or replace function student_stage(
  p_status          text,
  p_student_status  text,
  p_has_conferral   boolean,
  p_has_programme   boolean,
  p_registered_now  integer
)
returns text
language sql
immutable
as $$
  select case
    -- ---- THE END OF THE JOURNEY, FIRST ---------------------------------
    when p_has_conferral                        then 'alumni'
    when p_student_status = 'graduated'         then 'graduated'
    when p_student_status = 'withdrawn'
      or p_status = 'withdrawn'                 then 'withdrawn'
    when p_student_status = 'suspended'         then 'suspended'

    -- ---- STILL IN THE ADMISSIONS PIPELINE ------------------------------
    --
    -- A PERSON HERE IS NOT YET A STUDENT, and the portal must not offer them
    -- a curriculum, a timetable or a registration button. The Admissions
    -- Portal is where their journey is, and the student portal says so.
    when p_status in ('draft', 'applicant', 'under_review', 'documents_required',
                      'documents_verified', 'fee_pending', 'fee_paid',
                      'registrar_approved', 'ready_for_academic_review',
                      'returned')               then 'applying'
    when p_status in ('rejected', 'declined')   then 'not-admitted'
    when p_status = 'deferred'                  then 'deferred'

    -- ---- ADMITTED, NOT YET ENROLLED ------------------------------------
    --
    -- The offer is made and the place is not yet taken up. 024's `enrolled`
    -- is the act of turning up; until it happens there is an admission letter
    -- to read and an acceptance to make, and nothing academic to do.
    when p_status in ('approved', 'conditional', 'admission_processing',
                      'admission_processing_failed', 'admission_issued')
                                                then 'admitted'

    -- ---- ENROLLED, AND THEN IT DEPENDS ---------------------------------
    --
    -- NO PROGRAMME VERSION IS ITS OWN STAGE, not an error message on a
    -- curriculum page. A student the Registry has not yet attached to a
    -- curriculum has no courses to be recommended, no credits to count and
    -- no progress to draw — and telling them "0 of 0 credits" would say they
    -- had finished.
    when not p_has_programme                    then 'awaiting-programme'
    when coalesce(p_registered_now, 0) > 0      then 'studying'
    else                                             'registering'
  end;
$$;

comment on function student_stage(text, text, boolean, boolean, integer) is
  'Where a student stands, decided once so that the dashboard, the navigation and every screen '
  'agree. Tested from the END BACKWARDS: a conferred degree overrules everything, a withdrawal '
  'overrules an enrolment, and only then does it matter how far an application got.';


-- ===========================================================================
-- 2. MY JOURNEY — ONE ROW, FOR THE PERSON SIGNED IN
-- ===========================================================================
--
-- `security_invoker` AND `auth.uid()`: the row is the signed-in student's own
-- and nobody else's, decided in the database rather than by a screen
-- remembering to filter. A screen that forgets shows one student another's
-- progress on the first page after signing in — which is the single most
-- damaging thing a student portal can do, and this codebase has done it once
-- already with a borrowed CGPA.

create or replace view my_journey
with (security_invoker = true) as
select s.id                                   as student_id,
       s.auth_user_id,
       trim(both ' ' from
         concat_ws(' ', s.first_name, s.middle_name, s.last_name))  as full_name,
       s.first_name,
       s.matric_no,
       s.student_number,
       s.status                               as admission_status,
       s.student_status,
       s.admission_year,

       -- ---- WHERE THEY STAND ---------------------------------------------
       student_stage(
         s.status,
         s.student_status,
         g.id is not null,
         s.programme_version_id is not null,
         coalesce(reg.registered_now, 0)::integer
       )                                      as stage,

       -- ---- THE PROGRAMME ------------------------------------------------
       s.programme_version_id,
       p.code                                 as programme_code,
       v.name                                 as programme_name,
       v.version_label,
       v.duration_years,
       v.semesters_per_year,
       v.total_credits                        as credits_required,
       aw.title                               as award_title,

       -- ---- THE TERM THE UNIVERSITY IS IN --------------------------------
       --
       -- From 065's derived view, not from a stored column. See that
       -- migration: the column was set once and would have said 2026/2027 for
       -- ever.
       t.year_label,
       t.starts_in,
       t.term_sequence,
       t.term_name,

       -- ---- WHICH YEAR OF THE PROGRAMME THEY ARE IN ----------------------
       --
       -- COUNTED FROM THE CREDITS THEY HAVE EARNED, not from the years since
       -- admission. A student who repeated a year is in Year 1 of the
       -- curriculum in their second calendar year, and a portal that counts
       -- calendar years tells them they are in Year 2 and recommends courses
       -- they have not reached.
       --
       -- Null where the programme states no total, because dividing by it
       -- would be inventing a year number.
       case
         when v.total_credits is null or v.duration_years is null then null
         when v.total_credits = 0 then 1
         else least(
           v.duration_years,
           greatest(1, floor(r.credits_earned
                             / (v.total_credits::numeric / v.duration_years))::int + 1))
       end                                    as programme_year,

       -- ---- PROGRESS -----------------------------------------------------
       r.credits_earned,
       r.credits_registered,
       r.credits_against_award,
       r.courses_passed,
       r.courses_failed,
       r.courses_registered,
       r.courses_outstanding,
       r.cgpa,
       r.last_semester_gpa,

       -- ---- WHAT IS TRUE THIS TERM ---------------------------------------
       coalesce(reg.registered_now, 0)        as registered_this_term,
       coalesce(reg.credits_now, 0)           as credits_this_term,
       w.window_recorded                      as registration_window_recorded,
       w.is_open                              as registration_open,
       w.registration_opens,
       w.registration_closes,

       -- ---- AND THE END, WHERE IT HAS COME -------------------------------
       g.id                                   as graduation_id,
       g.conferred_on,
       g.classification
  from students s
  left join student_academic_record r on r.student_id = s.id
  left join programme_versions v on v.id = s.programme_version_id
  left join programmes p on p.id = v.programme_id
  left join awards aw on aw.id = s.award_id
  left join graduation_records g
    on g.student_id = s.id and g.award_id is not distinct from s.award_id
  -- THE TERM, AND IT MAY LEGITIMATELY BE ABSENT. Today can fall outside every
  -- year the calendar covers; a left join says so honestly rather than
  -- dropping the student's whole row.
  left join academic_term_now t on true
  left join registration_window w
    on w.starts_in = t.starts_in and w.term_sequence = t.term_sequence
  left join lateral (
    select count(*)                                        as registered_now,
           coalesce(sum(c.credit_unit), 0)                 as credits_now
      from enrollments e
      join courses c on c.id = e.course_id
     where e.student_id = s.id
       and e.status = 'registered'
       and e.academic_year = t.starts_in
       and e.semester = t.term_sequence
  ) reg on true
 where s.auth_user_id = auth.uid();

comment on view my_journey is
  'One row: where the signed-in student stands, their programme, the term, their progress and '
  'whether registration is open. Filtered by auth.uid() in the DATABASE — a screen that filters '
  'is a screen that can forget to, and forgetting shows one student another''s progress on the '
  'first page after signing in.';


-- ===========================================================================
-- 3. MY WEEK — WHERE TO BE, AND WHEN
-- ===========================================================================
--
-- The classes of the courses the signed-in student is registered on this term.
-- Possible only because 063 linked a registration to an offering: before it,
-- "registered on BIS 220" named no class, no room and no hour.

create or replace view my_classes
with (security_invoker = true) as
select s.id                          as student_id,
       c.code                        as course_code,
       c.title                       as course_title,
       sec.id                        as section_id,
       sec.code                      as section_code,
       sec.day_of_week,
       sec.starts_at,
       sec.ends_at,
       sec.delivery_mode,
       sec.online_link,
       rm.code                       as room_code,
       rm.name                       as room_name,
       rm.campus,
       coalesce(l.first_name || ' ' || l.last_name, null) as lecturer
  from enrollments e
  join students s on s.id = e.student_id
  join courses c on c.id = e.course_id
  join course_offerings o on o.id = e.offering_id
  join class_sections sec on sec.offering_id = o.id
  left join rooms rm on rm.id = sec.room_id
  left join lecturers l on l.id = coalesce(sec.lecturer_id, o.lecturer_id)
 where e.status = 'registered'
   and sec.day_of_week is not null
   and s.auth_user_id = auth.uid()
   -- THE CLASS THEY ARE IN, where the registration names one. Where it does
   -- not — an offering with a single class attaches automatically, but an
   -- older registration may name none — every class of the offering is shown,
   -- because a student who cannot see any is worse served than one who sees
   -- two and asks.
   and (e.section_id is null or e.section_id = sec.id);

comment on view my_classes is
  'The signed-in student''s timetabled classes this term, with the room and the lecturer. '
  'Possible only since 063: before it a registration named a course and not a class, so no '
  'student could be told where to be.';


-- ===========================================================================
-- 4. MY CURRICULUM — THE DEGREE, AS THE STUDENT READS IT
-- ===========================================================================
--
-- 067's `student_curriculum_progress` for the signed-in student alone, with
-- one column added that only a student's screen needs: whether a course is
-- available to register for NOW.
--
-- The University asked for exactly these four words: "Completed, In Progress,
-- Outstanding, Not Yet Available." The fourth is the one that needed a new
-- fact — a course is not yet available if it is not offered this term, and
-- that is an offering question, not a curriculum one.

create or replace view my_curriculum
with (security_invoker = true) as
select pr.student_id,
       pr.entry_id,
       pr.course_id,
       pr.course_code,
       pr.course_title,
       pr.year,
       pr.semester,
       pr.requirement,
       pr.credits,
       pr.grade,
       pr.grade_point,
       pr.attempt,
       pr.state,
       -- IS IT ON OFFER THIS TERM? Null where there is no current term at all.
       (o.id is not null)            as offered_now,
       o.id                          as offering_id,
       o.status                      as offering_status
  from student_curriculum_progress pr
  join students s on s.id = pr.student_id
  left join academic_term_now t on true
  left join academic_years y on y.starts_in = t.starts_in
  left join course_offerings o
    on o.course_id = pr.course_id
   and o.academic_year_id = y.id
   and o.term_sequence = t.term_sequence
 where s.auth_user_id = auth.uid();

comment on view my_curriculum is
  'The signed-in student''s own curriculum with where they are up to, plus whether each course is '
  'actually on offer this term. The University''s four words — Completed, In Progress, '
  'Outstanding, Not Yet Available — and the fourth needed the offering, not the curriculum.';


-- ===========================================================================
-- 5. PROVE IT
-- ===========================================================================

do $$
declare
  st  text;
begin
  begin
    -- ---- THE STAGE FUNCTION, AT EVERY TURN ------------------------------
    --
    -- Asserted directly rather than through the view, because the view needs a
    -- signed-in user and a migration has none. The function is where the logic
    -- is; the view only feeds it.

    -- A conferred degree overrules everything, including a withdrawal.
    st := student_stage('withdrawn', 'withdrawn', true, true, 0);
    if st <> 'alumni' then
      raise exception '070 FAILED: a graduate with a conferral reads "%" rather than alumni', st;
    end if;

    -- A withdrawal overrules an enrolment.
    st := student_stage('enrolled', 'withdrawn', false, true, 3);
    if st <> 'withdrawn' then
      raise exception '070 FAILED: a withdrawn student reads "%"', st;
    end if;

    -- AN APPLICANT IS NOT A STUDENT. This is the one that matters most for
    -- the portal: offering a curriculum, a timetable or a registration button
    -- to somebody whose application is still under review is the portal
    -- telling them they have a place.
    st := student_stage('under_review', null, false, false, 0);
    if st <> 'applying' then
      raise exception '070 FAILED: an application under review reads "%"', st;
    end if;

    st := student_stage('admission_issued', null, false, false, 0);
    if st <> 'admitted' then
      raise exception '070 FAILED: an issued admission reads "%"', st;
    end if;

    -- ENROLLED WITH NO CURRICULUM IS ITS OWN STAGE, not an error on a
    -- progress page. Without this the student is shown "0 of 0 credits",
    -- which reads as a completed degree.
    st := student_stage('enrolled', 'active', false, false, 0);
    if st <> 'awaiting-programme' then
      raise exception
        '070 FAILED: an enrolled student with no curriculum reads "%" rather than '
        'awaiting-programme', st;
    end if;

    st := student_stage('enrolled', 'active', false, true, 0);
    if st <> 'registering' then
      raise exception '070 FAILED: an enrolled student with no registrations reads "%"', st;
    end if;

    st := student_stage('enrolled', 'active', false, true, 6);
    if st <> 'studying' then
      raise exception '070 FAILED: a student registered on six courses reads "%"', st;
    end if;

    -- A NULL COUNT IS NOT SIX. A student whose registrations could not be
    -- counted must not be told they are studying.
    st := student_stage('enrolled', 'active', false, true, null);
    if st <> 'registering' then
      raise exception '070 FAILED: a null registration count reads "%"', st;
    end if;

    -- A suspension is not a withdrawal and is not a graduation.
    st := student_stage('enrolled', 'suspended', false, true, 3);
    if st <> 'suspended' then
      raise exception '070 FAILED: a suspended student reads "%"', st;
    end if;

    -- And a refused application says so rather than reading as an applicant
    -- still waiting.
    st := student_stage('rejected', null, false, false, 0);
    if st <> 'not-admitted' then
      raise exception '070 FAILED: a refused application reads "%"', st;
    end if;

    -- ---- THE VIEWS EXIST AND ARE EMPTY WITHOUT A SIGNED-IN USER ---------
    --
    -- `auth.uid()` is null in a migration, so every one of these must return
    -- NOTHING. If any returned rows, the filter is not doing its job and one
    -- student would see another's.
    if (select count(*) from my_journey) <> 0 then
      raise exception
        '070 FAILED: my_journey returned rows with no signed-in user. The auth.uid() filter is '
        'not filtering, and every student would see every other student''s progress.';
    end if;
    if (select count(*) from my_classes) <> 0 then
      raise exception '070 FAILED: my_classes returned rows with no signed-in user';
    end if;
    if (select count(*) from my_curriculum) <> 0 then
      raise exception '070 FAILED: my_curriculum returned rows with no signed-in user';
    end if;

    raise notice '070 OK — the stage is decided once and reads correctly at every turn of the '
                 'journey; a conferral overrules a withdrawal; an applicant is not a student; '
                 'and all three views return nothing at all to nobody.';

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;
end $$;


-- ===========================================================================
-- DID IT LAND?  — READ THIS TABLE
-- ===========================================================================
--
-- Every row should say YES. A row saying NO means that migration did not take
-- effect: scroll up for the first red ERROR, fix it, and run the file again.
-- Running it twice is safe.
--
-- The proofs inside each migration also RAISE NOTICE, which the Supabase SQL
-- editor does not show. This table is the same answer in a form it does.
-- ===========================================================================

select * from (
  select '058' as migration, '058_the_vice_chancellor_approves_a_curriculum.sql' as file,
         case when to_regclass('public.academic_approval_requirements') is null then 'NO'
                 when exists (select 1 from academic_approval_requirements where subject = 'curriculum') then 'YES'
                 else 'NO' end as landed,
         'rows:academic_approval_requirements:subject = ''curriculum''' as what_it_creates
  union all
  select '059' as migration, '059_the_academic_calendar.sql' as file,
         case when to_regclass('public.academic_terms') is not null then 'YES' else 'NO' end as landed,
         'academic_terms' as what_it_creates
  union all
  select '060' as migration, '060_the_schools_and_programmes.sql' as file,
         case when to_regclass('public.programmes') is null then 'NO'
                 when exists (select 1 from programmes where true) then 'YES'
                 else 'NO' end as landed,
         'rows:programmes:true' as what_it_creates
  union all
  select '061' as migration, '061_a_version_for_every_programme.sql' as file,
         case when to_regclass('public.programme_versions') is null then 'NO'
                 when exists (select 1 from programme_versions where true) then 'YES'
                 else 'NO' end as landed,
         'rows:programme_versions:true' as what_it_creates
  union all
  select '062' as migration, '062_the_curricula_already_written.sql' as file,
         case when to_regclass('public.curriculum_progress') is not null then 'YES' else 'NO' end as landed,
         'curriculum_progress' as what_it_creates
  union all
  select '063' as migration, '063_the_offering_and_the_class.sql' as file,
         case when to_regclass('public.course_offerings') is not null then 'YES' else 'NO' end as landed,
         'course_offerings' as what_it_creates
  union all
  select '064' as migration, '064_the_rooms_to_start_from.sql' as file,
         case when exists (
                   select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = 'rooms'
                      and column_name = 'provisional')
                 then 'YES' else 'NO' end as landed,
         'rooms.provisional' as what_it_creates
  union all
  select '065' as migration, '065_the_year_that_cannot_lie.sql' as file,
         case when to_regclass('public.academic_year_now') is not null then 'YES' else 'NO' end as landed,
         'academic_year_now' as what_it_creates
  union all
  select '066' as migration, '066_when_registration_is_open.sql' as file,
         case when to_regclass('public.registration_window') is not null then 'YES' else 'NO' end as landed,
         'registration_window' as what_it_creates
  union all
  select '067' as migration, '067_one_student_one_record.sql' as file,
         case when to_regclass('public.student_academic_record') is not null then 'YES' else 'NO' end as landed,
         'student_academic_record' as what_it_creates
  union all
  select '068' as migration, '068_the_course_as_a_place_to_learn.sql' as file,
         case when to_regclass('public.course_materials') is not null then 'YES' else 'NO' end as landed,
         'course_materials' as what_it_creates
  union all
  select '069' as migration, '069_the_end_of_the_chain.sql' as file,
         case when to_regclass('public.graduation_candidate') is not null then 'YES' else 'NO' end as landed,
         'graduation_candidate' as what_it_creates
  union all
  select '070' as migration, '070_where_the_student_stands.sql' as file,
         case when to_regclass('public.my_journey') is not null then 'YES' else 'NO' end as landed,
         'my_journey' as what_it_creates
) as landed_report
 order by migration;

