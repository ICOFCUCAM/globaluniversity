-- ===========================================================================
-- 073 — ASKING THE UNIVERSITY FOR SOMETHING, AND BEING TOLD WHO IT IS FOR
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- Two things, and neither closes a door:
--
--   1. A student can ask the University for something IN THE SYSTEM rather
--      than by email, and the request has a state everybody can see:
--      submitted → under review → approved or declined → completed.
--
--   2. An announcement can be addressed to a School, a programme, a course or
--      one student, instead of only to "students" as a whole.
--
-- Nothing existing is altered or deleted. Every announcement already written
-- keeps working exactly as it does today, because an announcement with no
-- target is university-wide — which is what all of them are now.
--
-- ---------------------------------------------------------------------------
-- THE UNIVERSITY'S INSTRUCTION, AND THE WARNING THAT CAME WITH IT
-- ---------------------------------------------------------------------------
--
-- "Every request should have Submitted → Under Review → Approved / Declined →
-- Completed rather than students emailing the university for everything."
--
-- And: "before building make sure you check the system to avoid duplicate as
-- many must be in the system and need to be connected."
--
-- That check was done, and it changed this file. The system ALREADY has two
-- request pipelines:
--
--   `transcript_requests`           — a student asking for their transcript
--   `credential_correction_requests`— a graduate asking for a name to be fixed
--
-- Both work. Both have a Registry screen behind them. So this migration does
-- NOT give them a third home, and does not copy their rows anywhere. It adds
-- the requests that have nowhere to live — academic leave, deferment, a
-- programme change, a course withdrawal, an appeal, a contact correction — and
-- then the student's screen UNIONS all three into one list.
--
-- THE ALTERNATIVE WAS THE FAULT THE UNIVERSITY WARNED ABOUT. A general
-- `student_requests` table that also handled transcripts would have meant a
-- transcript request could exist in two tables at once, with two statuses, and
-- the Registry's existing queue would show one of them.
--
-- ---------------------------------------------------------------------------
-- WHY THE STATES ARE FIVE AND NOT FOUR
-- ---------------------------------------------------------------------------
--
-- The University named four. There is a fifth — WITHDRAWN — because a student
-- who changes their mind must be able to take a request back, and the only
-- alternatives are leaving it open for ever or having the Registry decline
-- something nobody is asking for any more. A withdrawn request is the
-- student's own act and is the one transition they may make after submitting.
--
-- AND 'approved' IS NOT THE END. A deferment approved on Monday is not a
-- deferment granted: somebody has to move the record. 'completed' is the
-- Registry saying the thing was actually done, and the gap between the two is
-- where the work lives. A system that stopped at 'approved' would show a
-- student an approval and leave them waiting for a change nobody had made.
-- ===========================================================================


-- ===========================================================================
-- 0. THE MIGRATIONS THIS ONE NEEDS
-- ===========================================================================

do $$
begin
  if to_regclass('public.students') is null then
    raise exception 'Migration 001 has not been run. Run the whole bundle.';
  end if;
  if to_regclass('public.announcements') is null then
    raise exception
      'Migration 038 has not been run on this database: there are no announcements to target. '
      'Run the whole bundle.';
  end if;
  if to_regclass('public.transcript_requests') is null then
    raise exception
      'The transcript request pipeline is missing, and this migration is written around it '
      'rather than replacing it. Run the whole bundle.';
  end if;
end $$;


-- ===========================================================================
-- 1. A REQUEST A STUDENT MAKES OF THE UNIVERSITY
-- ===========================================================================

create table if not exists student_requests (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students (id) on delete cascade,

  -- WHAT IS BEING ASKED FOR. Constrained rather than free text, because the
  -- desk that handles a deferment is not the desk that handles a fee query,
  -- and routing on a phrase somebody typed cannot work.
  --
  -- TRANSCRIPTS ARE DELIBERATELY ABSENT. `transcript_requests` already holds
  -- those and has the Registry queue behind it. A student asking for one here
  -- would create a second request nobody is working on.
  kind          text not null check (kind in (
                  'enrolment-confirmation',
                  'student-id-card',
                  'contact-change',
                  'academic-leave',
                  'deferment',
                  'programme-change',
                  'course-withdrawal',
                  'academic-appeal',
                  'message-registrar',
                  'message-finance',
                  'message-academic-office',
                  'other'
                )),

  subject       text not null check (length(btrim(subject)) between 3 and 200),
  -- ENOUGH TO ACT ON. A request reading "please help" cannot be decided, and
  -- the decline that follows wastes the student's time and the Registry's.
  detail        text not null check (length(btrim(detail)) >= 20),

  status        text not null default 'submitted' check (status in (
                  'submitted', 'under-review', 'approved', 'declined',
                  'completed', 'withdrawn'
                )),

  submitted_at  timestamptz not null default now(),
  submitted_by  uuid references auth.users (id) on delete set null,

  -- WHO IS HOLDING IT, in the University's own words rather than a role key,
  -- because the student reads this.
  with_office   text,

  decided_by    uuid references auth.users (id) on delete set null,
  decided_at    timestamptz,
  -- A DECLINE WITHOUT A REASON IS NOT AN ANSWER. Enforced below rather than
  -- left to whichever screen happens to write the row.
  decision_note text,

  completed_by  uuid references auth.users (id) on delete set null,
  completed_at  timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- ---- THE RULES, IN THE TABLE RATHER THAN IN A ROUTE -------------------
  --
  -- A route can be bypassed by anything holding the service key. These cannot.
  constraint student_requests_decided_together check (
    (decided_by is null and decided_at is null)
    or (decided_by is not null and decided_at is not null)
  ),
  constraint student_requests_decision_recorded check (
    status not in ('approved', 'declined') or decided_at is not null
  ),
  -- THE ONE THAT MATTERS MOST TO THE STUDENT.
  constraint student_requests_decline_has_a_reason check (
    status <> 'declined'
    or (decision_note is not null and length(btrim(decision_note)) >= 10)
  ),
  -- NOTHING IS COMPLETED THAT WAS NEVER APPROVED. 'completed' means the
  -- University did the thing; doing a thing nobody approved is the fault this
  -- refuses.
  constraint student_requests_completed_after_decision check (
    status <> 'completed' or (decided_at is not null and completed_at is not null)
  )
);

comment on table student_requests is
  'What a student asks the University for, with a state anybody can see. Deliberately does NOT '
  'cover transcripts or credential corrections: those already have their own pipelines and '
  'their own Registry queues, and a second home for them would mean one request in two tables.';

create index if not exists student_requests_by_student
  on student_requests (student_id, submitted_at desc);
-- The Registry's queue: what is open, oldest first, because the oldest
-- unanswered request is the one somebody is waiting on.
create index if not exists student_requests_open
  on student_requests (status, submitted_at)
  where status in ('submitted', 'under-review');

-- `updated_at` moves on its own. A column nothing maintains is a column that
-- lies, and every screen that sorts by it sorts by when the row was created.
create or replace function touch_student_request()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists student_requests_touch on student_requests;
create trigger student_requests_touch
  before update on student_requests
  for each row execute function touch_student_request();


-- ---------------------------------------------------------------------------
-- 1 (b) A STUDENT SEES THEIR OWN, AND MAY WITHDRAW IT AND NOTHING ELSE
-- ---------------------------------------------------------------------------
--
-- WHY POLICIES AND NOT A CHECK IN THE ROUTE. The route is the right place to
-- decide WHETHER something is sensible; it is the wrong place to be the only
-- thing standing between one student and another student's appeal.

alter table student_requests enable row level security;

drop policy if exists student_requests_own_select on student_requests;
create policy student_requests_own_select on student_requests
  for select using (
    exists (select 1 from students s
             where s.id = student_requests.student_id
               and s.auth_user_id = auth.uid())
  );

drop policy if exists student_requests_own_insert on student_requests;
create policy student_requests_own_insert on student_requests
  for insert with check (
    exists (select 1 from students s
             where s.id = student_requests.student_id
               and s.auth_user_id = auth.uid())
    -- A REQUEST IS MADE AS SUBMITTED. A student inserting one already marked
    -- 'approved' would have approved their own deferment.
    and status = 'submitted'
    and decided_by is null and decided_at is null
    and completed_by is null and completed_at is null
  );

-- WITHDRAWING IS THE ONLY CHANGE A STUDENT MAY MAKE, and only while nobody
-- has decided it. After a decision the record is the University's.
drop policy if exists student_requests_own_withdraw on student_requests;
create policy student_requests_own_withdraw on student_requests
  for update using (
    exists (select 1 from students s
             where s.id = student_requests.student_id
               and s.auth_user_id = auth.uid())
    and status in ('submitted', 'under-review')
  ) with check (
    status = 'withdrawn'
  );


-- ===========================================================================
-- 2. AN ANNOUNCEMENT CAN NOW BE ADDRESSED TO SOMEBODY IN PARTICULAR
-- ===========================================================================
--
-- WHAT THE UNIVERSITY ASKED FOR
--
--   "It should be targeted. University: University-wide announcement.
--    Faculty: School of Theology announcement. Programme: MA Black Liberation
--    Theology announcement. Course: BLT 501 announcement. Student-specific:
--    Your registration requires attention."
--
-- ---------------------------------------------------------------------------
-- FOUR NULLABLE COLUMNS, NOT A TARGETS TABLE
-- ---------------------------------------------------------------------------
--
-- `announcement_destinations` already exists and is about WHERE a notice is
-- PUBLISHED — the website, a social account, an email run. This is about WHO
-- it is for, which is a different question, and putting it in that table would
-- have made "the School of Theology" look like a publishing channel.
--
-- Nullable because NULL is the existing behaviour and must stay the default:
-- an announcement with no school, no programme, no course and no student is
-- university-wide, which is what every announcement written so far is. No
-- backfill is needed and none is done.
--
-- NARROWEST WINS, and it is decided by reading the columns rather than by a
-- precedence rule somewhere: a notice with a course_id is a course notice
-- whatever else is set on it.

alter table announcements
  add column if not exists school_id    uuid references schools (id)            on delete cascade,
  add column if not exists programme_id uuid references programmes (id)         on delete cascade,
  add column if not exists course_id    uuid references courses (id)            on delete cascade,
  add column if not exists student_id   uuid references students (id)           on delete cascade;

comment on column announcements.student_id is
  'Addressed to one student — "your registration requires attention". The strongest targeting '
  'there is, and the one that must never be got wrong: a notice about one person''s fees '
  'appearing on everybody''s noticeboard is a privacy failure, not a display bug.';

-- ON DELETE CASCADE, DELIBERATELY, and it is the opposite of the choice made
-- for rooms. A room is retired because its history matters — where an
-- examination was held is a record. A notice addressed to a student who has
-- been deleted is addressed to nobody, and keeping it would leave a row that
-- no policy below can reason about.

create index if not exists announcements_for_student
  on announcements (student_id) where student_id is not null;
create index if not exists announcements_for_course
  on announcements (course_id) where course_id is not null;
create index if not exists announcements_for_programme
  on announcements (programme_id) where programme_id is not null;
create index if not exists announcements_for_school
  on announcements (school_id) where school_id is not null;

-- HOW NARROW IS IT? Computed once so no screen decides for itself, and so the
-- ordering "your own first, then your course, then your programme" is the same
-- everywhere.
create or replace function announcement_reach(
  p_student_id uuid, p_course_id uuid, p_programme_id uuid, p_school_id uuid
) returns text language sql immutable as $$
  select case
    when p_student_id   is not null then 'you'
    when p_course_id    is not null then 'course'
    when p_programme_id is not null then 'programme'
    when p_school_id    is not null then 'school'
    else                                 'university'
  end;
$$;

comment on function announcement_reach(uuid, uuid, uuid, uuid) is
  'How narrowly an announcement is addressed. Decided in one place so that "your own notices '
  'first" means the same thing on every screen that shows them.';


-- ===========================================================================
-- 3. PROVE IT
-- ===========================================================================

do $$
declare
  stu       uuid;
  dept      uuid;
  rq        uuid;
  n         integer;
  txt       text;
  officer   uuid;
begin
  begin
    -- A REAL DECIDER. The first version of this proof set `decided_at` and
    -- left `decided_by` null, which violates `decided_together` — so the
    -- "declined with no reason" assertions below were passing on the WRONG
    -- constraint and proving nothing about the reason at all. A proof that
    -- passes for a reason you did not intend is worse than one that fails.
    insert into auth.users (id, email)
    values (gen_random_uuid(), 'proof073-officer@example.invalid')
    returning id into officer;

    select id into dept from departments limit 1;
    if dept is null then
      insert into departments (name, code, faculty, head_name)
      values ('Proof Department 073', 'PRF073', 'Proof', 'Nobody') returning id into dept;
    end if;

    insert into students (
      matric_no, first_name, last_name, email, department_id, program,
      degree_type, admission_year, status, student_status
    ) values (
      'PRF073/0001', 'Proof', 'Student', 'proof073@example.invalid', dept,
      'Proof Programme', 'BA', 2026, 'enrolled', 'active'
    ) returning id into stu;

    -- =================================================================
    -- A REQUEST THAT CANNOT BE ACTED ON IS REFUSED AT THE TABLE
    -- =================================================================
    begin
      insert into student_requests (student_id, kind, subject, detail)
      values (stu, 'deferment', 'Help', 'please help');
      raise exception '073 FAILED: a request with no detail was accepted';
    exception when check_violation then null;
    end;

    begin
      insert into student_requests (student_id, kind, subject, detail)
      values (stu, 'not-a-real-kind', 'A subject', 'A detail long enough to act on.');
      raise exception '073 FAILED: a request of an unknown kind was accepted';
    exception when check_violation then null;
    end;

    -- A TRANSCRIPT IS NOT ONE OF THE KINDS. The whole point of the audit that
    -- shaped this file: transcript_requests already holds those.
    begin
      insert into student_requests (student_id, kind, subject, detail)
      values (stu, 'transcript', 'My transcript', 'I would like a copy of my transcript.');
      raise exception
        '073 FAILED: a transcript request was accepted here, giving it a second home';
    exception when check_violation then null;
    end;

    insert into student_requests (student_id, kind, subject, detail)
    values (stu, 'deferment', 'Deferment of entry',
            'I would like to defer my entry to the next intake for medical reasons.')
    returning id into rq;

    if (select status from student_requests where id = rq) <> 'submitted' then
      raise exception '073 FAILED: a new request does not start as submitted';
    end if;

    -- =================================================================
    -- A DECLINE WITHOUT A REASON IS NOT AN ANSWER
    -- =================================================================
    --
    -- THE GUARD THIS TABLE EXISTS FOR. A student emailed the University and
    -- got no reply; a student who uses this and gets "Declined" with nothing
    -- beside it is no better off.
    begin
      update student_requests
         set status = 'declined', decided_at = now(),
             decided_by = officer, decision_note = null
       where id = rq;
      raise exception '073 FAILED: a request was declined with no reason';
    exception when check_violation then null;
    end;

    begin
      update student_requests
         set status = 'declined', decided_at = now(), decided_by = officer,
             decision_note = 'no'
       where id = rq;
      raise exception '073 FAILED: a decline reason of "no" was accepted';
    exception when check_violation then null;
    end;

    -- =================================================================
    -- NOTHING IS COMPLETED THAT WAS NEVER DECIDED
    -- =================================================================
    begin
      update student_requests
         set status = 'completed', completed_at = now(), completed_by = officer
       where id = rq;
      raise exception '073 FAILED: a request was completed without ever being decided';
    exception when check_violation then null;
    end;

    -- AND THE WHOLE JOURNEY WORKS, in the University's own order.
    update student_requests set status = 'under-review', with_office = 'The Registry'
     where id = rq;
    update student_requests
       set status = 'approved', decided_at = now(), decided_by = officer,
           decision_note = 'Approved by the Registry; entry deferred to the next intake.'
     where id = rq;
    update student_requests
       set status = 'completed', completed_at = now(), completed_by = officer
     where id = rq;
    if (select status from student_requests where id = rq) <> 'completed' then
      raise exception '073 FAILED: a request could not be carried to completed';
    end if;

    -- =================================================================
    -- AND THE `updated_at` TRIGGER ACTUALLY FIRES
    -- =================================================================
    --
    -- NOT TESTED BY COMPARING TIMESTAMPS. `now()` is the TRANSACTION's start
    -- time, and this whole proof is one transaction — so submitted_at and
    -- updated_at are identical to the microsecond however many updates run
    -- between them, and the first version of this assertion failed against a
    -- trigger that was working perfectly.
    --
    -- What proves a trigger is that it OVERRIDES what the caller wrote. So the
    -- update below deliberately sets updated_at to 2001, and the trigger must
    -- throw that away.
    update student_requests
       set with_office = 'The Registry', updated_at = timestamptz '2001-01-01'
     where id = rq;
    select count(*) into n from student_requests
     where id = rq and updated_at = timestamptz '2001-01-01';
    if n <> 0 then
      raise exception
        '073 FAILED: updated_at kept a value the caller wrote — the trigger did not fire';
    end if;
    select count(*) into n from student_requests where id = rq and updated_at = now();
    if n <> 1 then
      raise exception '073 FAILED: updated_at was not stamped by the trigger';
    end if;

    -- =================================================================
    -- AN ANNOUNCEMENT WITH NO TARGET IS STILL UNIVERSITY-WIDE
    -- =================================================================
    --
    -- The compatibility promise at the top of the file. If this fails, every
    -- notice the University has ever written has just stopped reaching people.
    select announcement_reach(null, null, null, null) into txt;
    if txt <> 'university' then
      raise exception '073 FAILED: an untargeted announcement is no longer university-wide (%)', txt;
    end if;

    -- AND THE NARROWEST TARGET WINS, whatever else is set alongside it.
    select announcement_reach(stu, gen_random_uuid(), gen_random_uuid(), gen_random_uuid())
      into txt;
    if txt <> 'you' then
      raise exception '073 FAILED: a notice addressed to one student reads as % instead', txt;
    end if;
    select announcement_reach(null, gen_random_uuid(), gen_random_uuid(), gen_random_uuid())
      into txt;
    if txt <> 'course' then
      raise exception '073 FAILED: a course notice reads as % instead', txt;
    end if;
    select announcement_reach(null, null, gen_random_uuid(), gen_random_uuid()) into txt;
    if txt <> 'programme' then
      raise exception '073 FAILED: a programme notice reads as % instead', txt;
    end if;
    select announcement_reach(null, null, null, gen_random_uuid()) into txt;
    if txt <> 'school' then
      raise exception '073 FAILED: a school notice reads as % instead', txt;
    end if;

    -- =================================================================
    -- THE EXISTING PIPELINES ARE UNTOUCHED
    -- =================================================================
    --
    -- Named here so that anybody who later adds 'transcript' to the kinds
    -- above has to delete this assertion to do it.
    if to_regclass('public.transcript_requests') is null then
      raise exception '073 FAILED: transcript_requests has gone';
    end if;
    if to_regclass('public.credential_correction_requests') is null then
      raise exception '073 FAILED: credential_correction_requests has gone';
    end if;

    raise notice '073 OK — a request cannot be made without enough to act on, cannot be '
      'declined without a reason, and cannot be completed without ever being decided; a '
      'transcript request is refused here because it already has a home; and an announcement '
      'with no target is still university-wide.';

    raise exception 'ROLLBACK_073';
  exception
    when others then
      if sqlerrm = 'ROLLBACK_073' then
        return;
      end if;
      raise;
  end;
end $$;
