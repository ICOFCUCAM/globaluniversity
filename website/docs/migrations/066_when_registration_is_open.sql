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
