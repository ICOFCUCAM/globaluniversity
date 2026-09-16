-- ===========================================================================
-- 095 — THE UNIVERSITY DECIDES WHEN A MODEL RUNS
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- A DOOR CLOSES, AND IT IS THE POINT OF THE FILE:
--
--     NO TRANSFORMATION RUNS ON A COURSE LECTURE UNTIL AN OFFICE HAS ACCEPTED
--     THE SUBMISSION.
--
-- Until now a lecture could be created and transformed in the same minute by
-- the same person. The University's ruling of 16 September 2026 puts a stop
-- between them:
--
--     Lecturer submits → Administration reviews/processes → AI transforms →
--     Final academic material → Students
--
-- EXISTING LECTURES ARE NOT STRANDED. Every lecture already in the table is
-- backfilled to `accepted`, because it was created under the old rule and
-- retrospectively refusing work somebody has already done is not a review, it
-- is a punishment. The stop applies to what is submitted from now on.
--
-- A PERSONAL LECTURE IS NOT REVIEWED AT ALL. Somebody's own recording in their
-- own library has no cohort, no University money behind it and nobody to
-- answer to. Sending it through an office would be the University asserting
-- authority over a study tool.
--
-- ---------------------------------------------------------------------------
-- THE TENSION IN THIS RULING, AND HOW IT IS RESOLVED
-- ---------------------------------------------------------------------------
--
-- 092 says an office may NOT read a lecturer's unpublished draft. This ruling
-- says an office reviews a submission before a model runs on it. Read one way,
-- the second requires breaking the first.
--
-- IT DOES NOT, BECAUSE THE REVIEW IS OF THE REQUEST, NOT THE WORDS.
--
-- What an office needs in order to decide is: which course, whose lecture, how
-- long the recording is, and therefore what it will cost to transcribe and
-- what it will cost to voice. None of that is the content. `submissions_for_review`
-- below is the office's screen and IT HAS NO BODY COLUMN — not filtered out in
-- the application, not hidden by a policy, ABSENT, because row-level security
-- is row-level and cannot hide a column. This repository has met that five
-- times; the answer each time was a view without the column.
--
-- So the line holds exactly where 092 drew it: the University decides whether
-- the work happens and pays for it; the lecturer is the only person who reads
-- the draft and the only person who can approve it.
--
-- ---------------------------------------------------------------------------
-- AND RETURNING IS NOT REFUSING
-- ---------------------------------------------------------------------------
--
-- `returned` sends a submission back with a note — the file is unusable, the
-- course is wrong, the recording is forty seconds long. The lecturer fixes it
-- and submits again. A refusal with no way back would make an office the end
-- of a lecturer's work rather than a step in it, and a note is compulsory for
-- the same reason a grant's reason is: a decision nobody explained is one
-- nobody can appeal.
-- ===========================================================================


-- ===========================================================================
-- WHERE A SUBMISSION HAS GOT TO
-- ===========================================================================

alter table lectures add column if not exists review_state text;
alter table lectures add column if not exists submitted_at timestamptz;
alter table lectures add column if not exists reviewed_by uuid references auth.users (id);
alter table lectures add column if not exists reviewed_at timestamptz;
alter table lectures add column if not exists review_note text;

-- ---------------------------------------------------------------------------
-- THE BACKFILL, BEFORE THE CONSTRAINT.
--
-- Ordered this way on purpose: a NOT NULL default applied to an existing table
-- would fill old rows with 'draft' and strand every lecture the University has
-- already submitted. They were made under the old rule; they keep the benefit
-- of it.
--
-- `coalesce` rather than `where review_state is null` so a second run finds
-- nothing to do — and so a lecture created between the two runs is not caught
-- by a blanket update and quietly accepted.
--
-- THIS ONE CANNOT BE PROVED BY THE BLOCK AT THE FOOT OF THIS FILE, and saying
-- so is better than implying it is covered. By the time that block runs there
-- are no pre-existing rows left to backfill — every lecture it makes is made
-- AFTER the column exists, and correctly starts as a draft. Deleting this
-- statement therefore breaks nothing that the in-file proof can see.
--
-- It is proved from outside instead: a database at 094, a lecture inserted
-- into it, then 095 run over the top, and the lecture read back. That is a
-- thing the harness can set up and a migration cannot.
-- ---------------------------------------------------------------------------
update lectures
   set review_state = 'accepted',
       reviewed_at  = coalesce(reviewed_at, created_at)
 where review_state is null;

alter table lectures alter column review_state set default 'draft';
alter table lectures alter column review_state set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lectures_review_state_known') then
    alter table lectures add constraint lectures_review_state_known
      check (review_state in ('draft', 'submitted', 'accepted', 'returned'));
  end if;

  -- A DECISION CARRIES ITS DECIDER. Half of either is a row nobody can read,
  -- which is the same rule 056 applies to a revocation.
  if not exists (select 1 from pg_constraint where conname = 'lectures_decision_is_whole') then
    alter table lectures add constraint lectures_decision_is_whole
      check (review_state not in ('accepted', 'returned')
             or (reviewed_at is not null));
  end if;

  -- AND A RETURN CARRIES ITS REASON. Sending somebody's work back without
  -- saying why makes an office unanswerable.
  if not exists (select 1 from pg_constraint where conname = 'lectures_a_return_says_why') then
    alter table lectures add constraint lectures_a_return_says_why
      check (review_state <> 'returned'
             or (review_note is not null and length(btrim(review_note)) >= 10));
  end if;
end $$;

comment on column lectures.review_state is
  'Where the submission has got to: draft (the lecturer is still working), submitted (waiting for '
  'an office), accepted (a model may now run on it), returned (sent back with a note). A personal '
  'lecture is never reviewed.';

create index if not exists lectures_awaiting_review_idx
  on lectures (course_id, submitted_at) where review_state = 'submitted';


-- ===========================================================================
-- THE STOP ITSELF
-- ===========================================================================
--
-- Enforced in the database and not only in the route, because the route is one
-- client of this table. A job queue, a script, a restore or a second
-- application would all reach `lecture_artefacts` directly.
-- ===========================================================================

create or replace function transformation_needs_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  the_lecture record;
begin
  -- Only the transition INTO work. An artefact sitting at 'ready' being
  -- approved or published is not a model running.
  if new.state not in ('queued', 'running') then return new; end if;
  if tg_op = 'UPDATE' and old.state in ('queued', 'running') then return new; end if;

  select l.context, l.review_state, l.title
    into the_lecture
    from lectures l where l.id = new.lecture_id;

  -- A PERSONAL LIBRARY HAS NO ADMINISTRATION.
  if the_lecture.context <> 'course' then return new; end if;

  if the_lecture.review_state <> 'accepted' then
    raise exception 'The University has not accepted this submission yet, so no transformation '
                    'may run on it. It is at %, and an office moves it to accepted.',
                    the_lecture.review_state
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists transformation_needs_acceptance_trg on lecture_artefacts;
create trigger transformation_needs_acceptance_trg
  before insert or update of state on lecture_artefacts
  for each row execute function transformation_needs_acceptance();


-- ===========================================================================
-- WHAT AN OFFICE SEES, AND WHAT IT DOES NOT
-- ===========================================================================
--
-- NO BODY COLUMN. Not filtered, not policy-hidden — ABSENT. Row-level security
-- is ROW-level and cannot withhold one column of a row it admits, which is why
-- 087 built `course_progress_for_teaching` and 088 built `lecturer_directory`
-- the same way.
--
-- What is here is what a decision needs: whose, which course, how long, and
-- how long it has been waiting.
-- ===========================================================================

drop view if exists submissions_for_review;
create view submissions_for_review
with (security_invoker = true)
as
  select
    l.id             as lecture_id,
    l.course_id,
    c.code           as course_code,
    c.title          as course_title,
    l.sequence,
    l.title,
    l.abstract,
    l.delivered_on,
    l.source_minutes,
    l.owner_id,
    l.submitted_at,
    l.review_state,
    l.review_note,
    -- HOW LONG SOMEBODY HAS BEEN WAITING, which is the number an office needs
    -- and the one nobody computes for themselves.
    case when l.submitted_at is null then null
         else floor(extract(epoch from (now() - l.submitted_at)) / 86400)::integer
    end as days_waiting,
    -- WHAT IS BEING ASKED FOR, counted rather than read.
    (select count(*) from lecture_artefacts a
      where a.lecture_id = l.id and a.state <> 'absent') as artefacts_so_far
  from lectures l
  join courses c on c.id = l.course_id
 where l.context = 'course';

comment on view submissions_for_review is
  'The administration''s queue: whose lecture, which course, how long the recording is, and how '
  'long it has been waiting. NO BODY COLUMN — an office decides whether the work happens and '
  'pays for it; the lecturer is the only person who reads the draft.';

revoke all on submissions_for_review from anon;
grant select on submissions_for_review to authenticated;


-- ===========================================================================
-- WHO MAY MOVE IT
-- ===========================================================================
--
-- 092's `lectures_modify` admits the OWNER alone, which is right for the title
-- and the abstract and wrong for the review state: an office has to be able to
-- accept a submission it does not own.
--
-- So the columns are split rather than the policy widened. An office may write
-- the review columns and nothing else; the owner may write everything except
-- the review columns. Neither can do the other's half.
-- ===========================================================================

drop policy if exists lectures_review on lectures;
create policy lectures_review on lectures
  for update using (context = 'course' and governs_the_curriculum())
  with check (context = 'course' and governs_the_curriculum());

-- ---------------------------------------------------------------------------
-- AND THE OWNER CANNOT ACCEPT THEIR OWN SUBMISSION.
--
-- A policy cannot express this — it is about WHICH COLUMN changed and by whom,
-- and row-level security decides about rows. So a trigger, which is the same
-- answer 090 reached for `password_set_at` and the same shape as
-- `second_pair_of_eyes`.
--
-- Without it the stop is decoration: a lecturer would submit and accept in one
-- request and the office would never see it.
-- ---------------------------------------------------------------------------
create or replace function review_is_somebody_elses_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.review_state is not distinct from old.review_state then return new; end if;
  if new.context <> 'course' then return new; end if;

  -- Submitting is the owner's own act: draft → submitted.
  if old.review_state = 'draft' and new.review_state = 'submitted' then
    if auth.uid() is not null and auth.uid() <> new.owner_id then
      raise exception 'A lecture is submitted by the person whose it is.'
        using errcode = 'insufficient_privilege';
    end if;
    new.submitted_at := now();
    return new;
  end if;

  -- Everything else is the University's decision, and not the owner's.
  if auth.uid() is not null and auth.uid() = new.owner_id then
    raise exception 'A lecturer does not accept their own submission. The University reviews it: '
                    'that is what the step is for.'
      using errcode = 'insufficient_privilege';
  end if;

  new.reviewed_by := coalesce(auth.uid(), new.reviewed_by);
  new.reviewed_at := now();
  return new;
end;
$$;

drop trigger if exists review_is_somebody_elses_decision_trg on lectures;
create trigger review_is_somebody_elses_decision_trg
  before update of review_state on lectures
  for each row execute function review_is_somebody_elses_decision();


-- ===========================================================================
-- THE PROOF
-- ===========================================================================

do $$
declare
  lect_user   uuid := gen_random_uuid();
  office_user uuid := gen_random_uuid();
  lect_id     uuid;
  the_course  uuid;
  the_lecture uuid;
  personal    uuid;
  seen        integer;
  cols        integer;
begin
  begin
    insert into auth.users (id, email) values
      (lect_user,   '095-lecturer@example.test'),
      (office_user, '095-office@example.test');
    insert into profiles (id, email, role) values
      (lect_user,   '095-lecturer@example.test', 'lecturer'),
      (office_user, '095-office@example.test',   'academic-office')
    on conflict (id) do update set role = excluded.role;

    insert into lecturers (staff_id, first_name, last_name, auth_user_id)
      values ('ICOFSTF-9095', 'Proof', 'Lecturer', lect_user) returning id into lect_id;
    insert into courses (code, title, lecturer_id)
      values ('ZZZ 9095', 'A Course Written By The 095 Proof', lect_id)
      returning id into the_course;

    insert into lectures (course_id, sequence, title, owner_id, created_by)
      values (the_course, 1, 'A lecture awaiting the University', lect_user, lect_user)
      returning id into the_lecture;

    -- ---- A NEW LECTURE IS A DRAFT ----------------------------------------
    select count(*) into seen from lectures where id = the_lecture and review_state = 'draft';
    if seen <> 1 then
      raise exception '095 FAILED: a new lecture did not start as a draft';
    end if;

    -- ---- AND NOTHING MAY RUN ON IT ---------------------------------------
    begin
      insert into lecture_artefacts (lecture_id, course_id, kind, origin, owner_id, state)
        values (the_lecture, the_course, 'transcript', 'ai', lect_user, 'queued');
      raise exception '095 FAILED: a transformation was queued on a lecture the University has '
                      'not accepted — the stop this migration exists for is not there';
    exception
      when check_violation then null;
    end;

    -- ---- A LECTURER CANNOT ACCEPT THEIR OWN -------------------------------
    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', lect_user);

    update lectures set review_state = 'submitted' where id = the_lecture;
    select count(*) into seen from lectures
     where id = the_lecture and review_state = 'submitted' and submitted_at is not null;
    if seen <> 1 then
      raise exception '095 FAILED: a lecturer cannot submit their own lecture, or the moment was '
                      'not recorded';
    end if;

    begin
      update lectures set review_state = 'accepted' where id = the_lecture;
      raise exception '095 FAILED: a lecturer accepted their own submission, so the University''s '
                      'review is a step anybody can skip';
    exception
      when insufficient_privilege then null;
    end;

    -- ---- THE OFFICE SEES IT, AND NOT THE WORDS ---------------------------
    execute format('set local request.jwt.claim.sub = %L', office_user);
    select count(*) into seen from submissions_for_review where lecture_id = the_lecture;
    if seen <> 1 then
      raise exception '095 FAILED: an office cannot see a submission waiting for it';
    end if;

    reset role;

    -- THE COLUMN THAT IS NOT THERE. Asserted against the catalogue rather than
    -- by reading a row, because a view that merely has no DATA in a column
    -- today would pass a read and fail the day somebody writes one.
    select count(*) into cols from information_schema.columns
     where table_schema = 'public' and table_name = 'submissions_for_review'
       and column_name in ('body', 'segments', 'transcript', 'parts');
    if cols <> 0 then
      raise exception '095 FAILED: the office''s queue has a column carrying the lecture''s words '
                      '— 092 says an office does not read a lecturer''s draft';
    end if;

    -- ---- A RETURN MUST SAY WHY -------------------------------------------
    begin
      update lectures set review_state = 'returned' where id = the_lecture;
      raise exception '095 FAILED: a submission was returned with no note, leaving a lecturer '
                      'with work sent back and no reason';
    exception
      when check_violation then null;
    end;

    -- ---- AND ONCE ACCEPTED, THE WORK RUNS --------------------------------
    update lectures
       set review_state = 'accepted', reviewed_by = office_user, reviewed_at = now()
     where id = the_lecture;

    insert into lecture_artefacts (lecture_id, course_id, kind, origin, owner_id, state)
      values (the_lecture, the_course, 'transcript', 'ai', lect_user, 'queued');
    select count(*) into seen from lecture_artefacts
     where lecture_id = the_lecture and state = 'queued';
    if seen <> 1 then
      raise exception '095 FAILED: an accepted submission still cannot be transformed, so the '
                      'stop never lifts';
    end if;

    -- ---- A PERSONAL LECTURE IS NOBODY'S TO REVIEW ------------------------
    insert into lectures (course_id, context, sequence, title, owner_id, created_by)
      values (the_course, 'personal', 9001, 'Somebody''s own recording', lect_user, lect_user)
      returning id into personal;

    -- CAUGHT AS AN ASSERTION, NOT AS A CRASH. Removing the personal-lecture
    -- bypass makes this insert raise, and an unhandled raise here would come
    -- out of psql as a bare ERROR — which the break harness reads as "the
    -- proof did not run" rather than "the guard is gone". A proof whose
    -- failure is indistinguishable from not having run is half a proof.
    begin
      insert into lecture_artefacts (lecture_id, course_id, kind, origin, owner_id, state)
        values (personal, the_course, 'transcript', 'ai', lect_user, 'queued');
    exception
      when check_violation then
        raise exception '095 FAILED: a personal recording was sent to an office for review, '
                        'which makes the University the gatekeeper of somebody''s own study tool';
    end;
    select count(*) into seen from lecture_artefacts
     where lecture_id = personal and state = 'queued';
    if seen <> 1 then
      raise exception '095 FAILED: a personal recording could not be transformed at all';
    end if;

    select count(*) into seen from submissions_for_review where lecture_id = personal;
    if seen <> 0 then
      raise exception '095 FAILED: somebody''s personal library appears in the administration''s '
                      'queue';
    end if;

    raise exception 'rollback 095 proof';
  exception
    when others then
      reset role;
      if sqlerrm <> 'rollback 095 proof' then raise; end if;
  end;
end $$;


do $$
begin
  raise notice '095 OK: a lecture starts as a draft and nothing may run on it until an office '
               'has accepted the submission';
  raise notice '095 OK: a lecturer submits their own and cannot accept their own — the review is '
               'somebody else''s decision or it is not a review';
  raise notice '095 OK: the office queue has no column carrying the lecture''s words, so the '
               'University decides whether the work happens without reading the draft';
  raise notice '095 OK: a submission cannot be returned without a note';
  raise notice '095 OK: a personal recording is never reviewed and never appears in the queue';
end $$;
