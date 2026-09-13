-- ===========================================================================
-- 054 — COURSE REGISTRATION: THE ACT NOBODY COULD PERFORM
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- A STUDENT CAN BE REGISTERED FOR A COURSE. Until now nothing in this system
-- could do it. `enrollments` has existed since 001; the results pipeline reads
-- it to build a mark sheet, the GPA engine reads it to weight a transcript,
-- and the graduation audit reads it to decide whether somebody may be awarded
-- a degree. Every one of them reads a table that no screen and no route has
-- ever written a row into.
--
-- It was found by counting reads against writes per table — the same sweep
-- that found the signature specimens and the allowances — and it is the
-- largest of the three, because the three things it feeds are marks,
-- transcripts and graduation.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS FILE ADDS, AND WHY EACH PIECE
-- ---------------------------------------------------------------------------
--
-- 1. A CLOSED VOCABULARY FOR `status`. It was `text not null default
--    'registered'` with no constraint, so any word at all could be written and
--    every reader would have to guess which words it might find. The three
--    below are the ones a registration can be in.
--
-- 2. WHO REGISTERED THIS STUDENT, AND HOW. A registration is a commitment: it
--    puts somebody on a mark sheet and it puts a course on their transcript.
--    One with no actor is one nobody can be asked about. `registered_via`
--    separates a student registering themselves from the Registry doing it for
--    them, because those two are answerable in different directions.
--
-- 3. THE DROP, AS A STATE AND NOT A DELETION. Deleting the row would take the
--    student off the mark sheet and leave no trace that they were ever on it —
--    and a student who sat an assessment and then vanished from the register
--    is the shape of a real dispute.
--
-- 4. THE LIVE ROLL AS A VIEW. The mark sheet must not list somebody who
--    dropped the course. The screens read every enrolment row today, so
--    introducing a dropped state without this view would put dropped students
--    in front of an examiner.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS FILE DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- ENFORCE PREREQUISITES IN SQL. The rule is published in
-- src/lib/prerequisites.ts, tested, and it reports EVERY failing condition at
-- once with a sentence per reason naming the course — because a check that
-- returns on the first failure makes a student re-submit to discover the
-- second. A trigger can refuse; it cannot explain. The route applies the rule
-- and the database holds the shape of the record.
--
-- That is a deliberate asymmetry and it is worth stating plainly: this is the
-- one guard in the system that is NOT belt-and-braces in SQL.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. THE SHAPE OF A REGISTRATION
-- ---------------------------------------------------------------------------

alter table enrollments
  add column if not exists registered_by   uuid references auth.users (id) on delete set null,
  -- 'self' when the student registered, 'registry' when an officer did it for
  -- them. Not derivable from registered_by: an officer who is also a student
  -- would be indistinguishable.
  add column if not exists registered_via  text,
  add column if not exists dropped_at      timestamptz,
  add column if not exists dropped_by      uuid references auth.users (id) on delete set null,
  add column if not exists drop_reason     text;

comment on column enrollments.registered_by is
  'Who put this student on this course. A registration puts somebody on a mark sheet and a '
  'course on their transcript; one with no actor is one nobody can be asked about.';

comment on column enrollments.registered_via is
  'self | registry. Separates a student registering themselves from the Registry doing it for '
  'them — the two are answerable in different directions.';

do $$
begin
  -- ---- THE STATUS VOCABULARY, CLOSED ------------------------------------
  -- NOT VALID, deliberately. A database with existing enrolments carrying some
  -- other word must not fail to migrate; the constraint governs every row
  -- written from now on, and the verify query at the foot names anything that
  -- would not pass.
  if not exists (select 1 from pg_constraint where conname = 'enrollments_status_is_known') then
    alter table enrollments add constraint enrollments_status_is_known
      check (status in ('registered', 'dropped', 'completed')) not valid;
  end if;

  -- ---- A DROPPED REGISTRATION SAYS WHEN AND WHY -------------------------
  -- A drop with no date is one nobody can place in a term, and a drop with no
  -- reason is one nobody can answer for at an appeal.
  if not exists (select 1 from pg_constraint where conname = 'enrollments_drop_is_complete') then
    alter table enrollments add constraint enrollments_drop_is_complete
      check (
        status <> 'dropped'
        or (dropped_at is not null and drop_reason is not null
            and length(btrim(drop_reason)) >= 8)
      ) not valid;
  end if;

  -- ---- AND A LIVE ONE CARRIES NO DROP -----------------------------------
  -- The pair that actually catches a bug: re-registering a dropped course by
  -- setting the status back and forgetting to clear the drop leaves a row that
  -- is registered AND dropped, which every reader will interpret differently.
  if not exists (select 1 from pg_constraint where conname = 'enrollments_live_is_not_dropped') then
    alter table enrollments add constraint enrollments_live_is_not_dropped
      check (status = 'dropped' or dropped_at is null) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'enrollments_via_is_known') then
    alter table enrollments add constraint enrollments_via_is_known
      check (registered_via is null or registered_via in ('self', 'registry')) not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. THE LIVE ROLL
-- ---------------------------------------------------------------------------
--
-- WHO IS ACTUALLY TAKING THIS COURSE. The mark sheet, the GPA engine and the
-- graduation audit all ask this question and all of them asked it by reading
-- every row in `enrollments`, which was correct only while nothing could be
-- dropped.
--
-- A VIEW RATHER THAN A FILTER IN EACH SCREEN, because there are three screens
-- and they would drift — and the one that drifts is the one that puts a
-- student who dropped the course in front of an examiner.

drop view if exists course_roll;

create view course_roll
with (security_invoker = true) as
select e.id                as enrollment_id,
       e.student_id,
       e.course_id,
       e.academic_year,
       e.semester,
       e.status,
       e.enrolled_at,
       e.registered_via
  from enrollments e
 where e.status in ('registered', 'completed');

comment on view course_roll is
  'Who is actually taking a course: registered and completed, never dropped. The mark sheet, '
  'the GPA engine and the graduation audit all read this rather than filtering for themselves.';

grant select on course_roll to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. PROVE IT
-- ---------------------------------------------------------------------------

do $$
declare
  s_id    uuid;
  c_id    uuid;
  e_id    uuid;
  refused boolean;
begin
  begin
    -- A student and a course to register, made here and rolled back.
    insert into students (first_name, last_name, matric_no)
      values ('Proof', 'Student', 'PROOF-054-' || substr(gen_random_uuid()::text, 1, 8))
      returning id into s_id;

    insert into courses (code, title, credit_unit)
      values ('ZZZ054-' || substr(gen_random_uuid()::text, 1, 6), 'A Proof Course', 3)
      returning id into c_id;

    -- ---- A REGISTRATION IS ACCEPTED ---------------------------------------
    insert into enrollments (student_id, course_id, academic_year, semester,
                             status, registered_by, registered_via)
      values (s_id, c_id, 2026, 1, 'registered', null, 'self')
      returning id into e_id;

    if not exists (select 1 from course_roll where enrollment_id = e_id) then
      raise exception '054 FAILED: a registered student is not on the roll';
    end if;

    -- ---- A WORD NOBODY DEFINED IS REFUSED ---------------------------------
    refused := false;
    begin
      update enrollments set status = 'maybe' where id = e_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '054 FAILED: an undefined status was accepted';
    end if;

    -- ---- A DROP WITH NO REASON IS REFUSED ---------------------------------
    refused := false;
    begin
      update enrollments set status = 'dropped', dropped_at = now() where id = e_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '054 FAILED: a course was dropped with no reason recorded';
    end if;

    -- ---- A PROPER DROP IS ACCEPTED, AND LEAVES THE ROLL -------------------
    update enrollments
       set status = 'dropped', dropped_at = now(),
           drop_reason = 'Withdrew from the module within the change period'
     where id = e_id;

    if exists (select 1 from course_roll where enrollment_id = e_id) then
      raise exception '054 FAILED: a dropped student is still on the mark sheet';
    end if;

    -- ---- AND A ROW CANNOT BE BOTH -----------------------------------------
    -- The one that catches the real bug: re-registering by setting the status
    -- back and forgetting to clear the drop.
    refused := false;
    begin
      update enrollments set status = 'registered' where id = e_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '054 FAILED: a row is registered and dropped at the same time';
    end if;

    -- Clearing the drop as well is what re-registration must do, and it works.
    update enrollments
       set status = 'registered', dropped_at = null, dropped_by = null, drop_reason = null
     where id = e_id;
    if not exists (select 1 from course_roll where enrollment_id = e_id) then
      raise exception '054 FAILED: a re-registered student is not back on the roll';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '054 OK: a student can be registered for a course, and the registration records '
               'who did it and whether the student did it themselves';
  raise notice '054 OK: a drop is a state with a date and a reason, not a deletion — and a '
               'dropped student leaves the mark sheet';
  raise notice '054 OK: a row cannot be registered and dropped at the same time';
end $$;


-- ===========================================================================
-- 4. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- WHAT IS ON THE REGISTER NOW, AND WHETHER ANY EXISTING ROW WOULD FAIL THE NEW
-- RULES. The constraints were added NOT VALID so that a database with older
-- rows still migrates; this is where you find out whether there are any.
--
-- `unknown_status` should be 0. If it is not, those rows carry a word nothing
-- defines, and every reader of the table is guessing what it means.
-- ---------------------------------------------------------------------------
select count(*)                                                  as enrolments,
       count(*) filter (where status = 'registered')              as registered,
       count(*) filter (where status = 'dropped')                 as dropped,
       count(*) filter (where status = 'completed')               as completed,
       count(*) filter (where status not in
                        ('registered', 'dropped', 'completed'))   as unknown_status,
       count(*) filter (where registered_by is null
                          and status <> 'dropped')                as no_actor_recorded
  from enrollments;
