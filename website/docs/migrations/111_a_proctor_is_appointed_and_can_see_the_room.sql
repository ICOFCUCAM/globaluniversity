-- ===========================================================================
-- 111 — A PROCTOR IS APPOINTED, AND CAN SEE THE ROOM
-- ===========================================================================
--
-- The University's decision of 16 September 2026:
--
--   "`assign-proctor` is kept, not retired, and becomes functional when
--    proctoring is built. `examination_officers` is connected to the
--    examination workflow rather than removed."
--
-- ---------------------------------------------------------------------------
-- THE LIVE CONSOLE HAS BEEN EMPTY FOR EVERYBODY, SINCE 016
-- ---------------------------------------------------------------------------
--
-- Not slow, not broken — EMPTY, with no error. This was found by asking the
-- database rather than by reading the code:
--
--   an INVIGILATOR, signed in, sees 0 live session(s) of 1
--   …and 0 row(s) of the register of who is assigned to what
--   …and 1 of 1 published examination
--
-- 015 enabled row-level security on thirteen examination tables and wrote
-- three policies: a published paper is public to the cohort, and a candidate
-- reads their own sitting and their own answers. 016 then replaced the
-- candidate's policy with the `exam_sessions_mine` view and DROPPED it.
--
-- A TABLE WITH RLS ENABLED AND NO POLICY IS NOT A TABLE WITH DEFAULT ACCESS.
-- It is invisible to every signed-in account, and it does not say so: a SELECT
-- succeeds and returns nothing. So `ExaminerConsole.tsx`, which reads
-- `exam_sessions` with the browser's publishable key, has shown an empty room
-- to every invigilator the University has ever had, and has looked like an
-- examination hall with nobody in it rather than like a fault.
--
-- `examination_officers` has been in the same state since 015 created it:
-- the register of WHO IS WATCHING WHAT, readable by nobody, written by
-- nothing. That is the table the University's ruling names.
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. THE EXAMINER CONSOLE STOPS BEING EMPTY — for the officers appointed to
--    that examination, and for the Examination Office. Not for everybody:
--    see §2.
--
-- 2. AN EXAMINATION NOBODY HAS BEEN APPOINTED TO IS WATCHED BY NOBODY, and
--    that is the point of the ruling rather than a side effect. A proctor
--    sees the sittings of the papers they were put on, and no others. The
--    Examination Office sees all of them, because running the examinations is
--    their office.
--
--    SO THE DAY THIS RUNS, A PUBLISHED EXAMINATION WITH NO OFFICER ON IT IS
--    STILL UNWATCHED. `examinations_nobody_is_watching` lists them, and it is
--    the first thing to look at.
--
-- 3. A CANDIDATE CANNOT BE AN OFFICER OF THEIR OWN EXAMINATION. Refused by
--    the database, not by a screen.
--
-- NOTHING IS ASSIGNED BY THIS MIGRATION. It builds the register and the rule;
-- every appointment on it is somebody's, afterwards, through
-- /api/exam/officers.
-- ===========================================================================


-- ===========================================================================
-- 1. WHO IS WATCHING WHAT
-- ===========================================================================
--
-- SECURITY DEFINER, and that is what stops it recursing. The policies below
-- ask this function who may read a sitting, and the function reads
-- `examination_officers` — which has a policy of its own that asks this
-- function. A plain function would loop. A definer function runs as the
-- table's owner, to whom row security does not apply, so the inner read is
-- not policed and the loop never forms.
--
-- That is subtle enough that the proof at the foot of this file performs it:
-- it reads the register as a signed-in officer and requires an answer.
-- ---------------------------------------------------------------------------

create or replace function watches_this_examination(the_examination uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- THE OFFICE THAT RUNS THE EXAMINATIONS SEES ALL OF THEM. Narrow on
    -- purpose: a Dean, a lecturer and the Registrar are not on this list,
    -- because watching a live sitting is not their work and a proctoring
    -- console open to half the staff is not proctoring.
    coalesce(auth_role(), '') in ('superadmin', 'admin', 'exam-officer')
    or exists (
      select 1 from examination_officers o
       where o.examination_id = the_examination
         and o.person_id = auth.uid()
    );
$$;

comment on function watches_this_examination(uuid) is
  'Whether the caller may watch this examination: the Examination Office and the two system '
  'offices always, and anybody appointed to this particular paper in `examination_officers`. '
  'SECURITY DEFINER so that the policies which call it can read the register without '
  'recursing through the register''s own policy.';


-- ---------------------------------------------------------------------------
-- A CANDIDATE CANNOT INVIGILATE THEIR OWN EXAMINATION.
--
-- Nor mark it, nor moderate it, nor chair it. Obvious, and obvious rules are
-- the ones nobody writes down until somebody does it.
--
-- AND NEITHER CAN A STUDENT OR AN APPLICANT AT ALL. 015's `role` check says
-- what KIND of officer somebody is; it has never said anything about who the
-- person is. This is the first thing that does.
-- ---------------------------------------------------------------------------

create or replace function an_officer_is_not_a_candidate()
returns trigger
language plpgsql
as $$
declare
  their_role text;
  nm         text;
begin
  select role, full_name into their_role, nm from profiles where id = new.person_id;

  if their_role is null then
    raise exception 'There is no account for the person being appointed to this examination.';
  end if;

  if their_role in ('student', 'applicant') then
    raise exception '% is a %, and cannot be an officer of an examination.',
      coalesce(nm, 'That person'), their_role;
  end if;

  if exists (
    select 1
      from exam_sessions s
      join students st on st.id = s.student_id
     where s.examination_id = new.examination_id
       and st.auth_user_id = new.person_id
  ) then
    raise exception '% is sitting this examination and cannot be an officer of it.',
      coalesce(nm, 'That person');
  end if;

  new.assigned_at := coalesce(new.assigned_at, now());
  return new;
end;
$$;

drop trigger if exists an_officer_is_not_a_candidate_trg on examination_officers;
create trigger an_officer_is_not_a_candidate_trg
  before insert or update on examination_officers
  for each row execute function an_officer_is_not_a_candidate();

comment on function an_officer_is_not_a_candidate() is
  'Refuses to appoint a candidate of an examination as an officer of it, and refuses to '
  'appoint a student or an applicant to any examination at all. 015''s CHECK says what KIND '
  'of officer somebody is and has never said anything about who they are.';


-- ===========================================================================
-- 2. THE POLICIES THAT HAVE BEEN MISSING SINCE 016
-- ===========================================================================
--
-- Five tables with row security on and nothing written against them. Each one
-- gets the same sentence: the candidate reads their own, and the officers
-- appointed to that examination read the room.
--
-- WRITES STAY WITH THE SERVICE KEY. Every one of these tables is written by a
-- route — /api/exam/session, /api/exam/event, /api/exam/integrity,
-- /api/exam/mark — which guards on capability first. A browser that could
-- insert its own `exam_events` could write its own integrity record, and the
-- evidence of an examination has to be the system's rather than the
-- candidate's. So there is no insert or update policy here, deliberately, and
-- the absence is stated rather than left to be inferred from nothing.
-- ---------------------------------------------------------------------------

drop policy if exists examination_officers_read on examination_officers;
create policy examination_officers_read on examination_officers
  for select using (
    -- YOUR OWN APPOINTMENT, ALWAYS. An officer who cannot see that they have
    -- been appointed has not really been told.
    person_id = auth.uid()
    or watches_this_examination(examination_id)
  );

comment on policy examination_officers_read on examination_officers is
  'Who may read the register of who is watching what: your own appointments always, plus '
  'every appointment on an examination you are yourself an officer of or that your office '
  'runs. Written only by the service key, through /api/exam/officers, which guards on '
  '`assign-proctor`.';

drop policy if exists exam_sessions_staff_read on exam_sessions;
create policy exam_sessions_staff_read on exam_sessions
  for select using (
    -- THE CANDIDATE'S OWN, which 015 wrote and 016 dropped when it moved the
    -- student onto `exam_sessions_mine`. Restored here: the view is a
    -- convenience, and a table the owner of a row cannot read is a trap for
    -- the next thing that reads it directly.
    student_id in (select id from students where auth_user_id = auth.uid())
    or watches_this_examination(examination_id)
  );

drop policy if exists exam_events_watcher_read on exam_events;
create policy exam_events_watcher_read on exam_events
  for select using (
    exists (
      select 1 from exam_sessions s
       where s.id = exam_events.session_id
         and watches_this_examination(s.examination_id)
    )
  );

comment on policy exam_events_watcher_read on exam_events is
  'The proctoring trail of a sitting, readable by the officers appointed to that examination. '
  'NOT BY THE CANDIDATE: these are the observations made ABOUT them during the sitting, and a '
  'candidate who could read their own flags in real time could work out what the system '
  'notices and what it does not.';

drop policy if exists exam_incidents_watcher_read on exam_incidents;
create policy exam_incidents_watcher_read on exam_incidents
  for select using (
    exists (
      select 1 from exam_sessions s
       where s.id = exam_incidents.session_id
         and watches_this_examination(s.examination_id)
    )
  );

drop policy if exists exam_marks_watcher_read on exam_marks;
create policy exam_marks_watcher_read on exam_marks
  for select using (
    exists (
      select 1 from exam_sessions s
       where s.id = exam_marks.session_id
         and watches_this_examination(s.examination_id)
    )
  );

comment on policy exam_marks_watcher_read on exam_marks is
  'A paper''s marks, readable by the officers appointed to that examination. NOT BY THE '
  'CANDIDATE: a mark reaches a student through the results workflow, after the approval chain '
  '009 built, and not by being readable the moment an examiner types it.';


-- ===========================================================================
-- 3. AND THE EXAMINATIONS NOBODY IS WATCHING
-- ===========================================================================
--
-- The operational consequence of the ruling, and the list the Examination
-- Office should open first on the day this runs: every examination that is
-- published or under way with no invigilator appointed to it.
--
-- `chair`, `examiner`, `moderator` AND `observer` DO NOT COUNT AS WATCHING.
-- 015's five officer kinds are not five words for the same job — an examiner
-- marks afterwards and a moderator checks the marking; neither is in the room.
-- Counting them would report a watched examination because somebody will read
-- the scripts next week.
-- ---------------------------------------------------------------------------

drop view if exists examinations_nobody_is_watching;

create view examinations_nobody_is_watching
with (security_invoker = true) as
  select e.id,
         e.course_code,
         e.course_title,
         e.title,
         e.mode,
         e.status,
         e.opens_at,
         e.closes_at,
         e.duration_minutes,
         (select count(*) from exam_sessions s where s.examination_id = e.id)
           as candidates,
         (select count(*) from examination_officers o where o.examination_id = e.id)
           as officers_of_any_kind
    from examinations e
   where e.status in ('published', 'in_progress')
     and not exists (
       select 1 from examination_officers o
        where o.examination_id = e.id
          and o.role = 'invigilator'
     );

comment on view examinations_nobody_is_watching is
  'Examinations published or under way with no INVIGILATOR appointed. An examiner marks '
  'afterwards and a moderator checks the marking; neither is in the room, so neither counts '
  'here. `officers_of_any_kind` is shown beside it so that an examination with a chair and no '
  'invigilator reads as what it is rather than as an oversight nobody touched.';


-- ===========================================================================
-- 4. THE PROOF
-- ===========================================================================
--
-- Its own examination, its own officers, its own candidate. It never counts
-- the University's examinations and never asserts how many they have.
-- ===========================================================================

do $$
declare
  watcher  uuid := gen_random_uuid();
  stranger uuid := gen_random_uuid();
  cand     uuid := gen_random_uuid();
  office   uuid := gen_random_uuid();
  exam     uuid;
  other    uuid;
  stu      uuid;
  sess     uuid;
  seen     integer;
  refused_ boolean;
begin
  insert into auth.users (id, email) values
    (watcher,  'proof-111-watcher@example.invalid'),
    (stranger, 'proof-111-stranger@example.invalid'),
    (cand,     'proof-111-candidate@example.invalid'),
    (office,   'proof-111-office@example.invalid');
  insert into profiles (id, email, full_name, role) values
    (watcher,  'proof-111-watcher@example.invalid',   'Proof Invigilator 111', 'invigilator'),
    (stranger, 'proof-111-stranger@example.invalid',  'Proof Stranger 111',    'invigilator'),
    (cand,     'proof-111-candidate@example.invalid', 'Proof Candidate 111',   'student'),
    (office,   'proof-111-office@example.invalid',    'Proof Exam Officer 111', 'exam-officer')
  on conflict (id) do update set role = excluded.role;

  insert into examinations (course_code, course_title, title, duration_minutes, status)
       values ('PRF111', 'Proof Course 111', 'Proof Examination 111', 60, 'published')
    returning id into exam;
  insert into examinations (course_code, course_title, title, duration_minutes, status)
       values ('PRF111B', 'Proof Course 111B', 'Proof Examination 111B', 60, 'published')
    returning id into other;

  insert into students (matric_no, first_name, last_name, status, auth_user_id)
       values ('PROOF-111', 'Proof', 'Candidate-111', 'enrolled', cand)
    returning id into stu;
  insert into exam_sessions (examination_id, student_id, candidate_name, status)
       values (exam, stu, 'Proof Candidate 111', 'in_progress')
    returning id into sess;

  -- ---- THE FAULT, PERFORMED BEFORE IT IS FIXED IS NOT POSSIBLE ----------
  --
  -- The policies are already created by the time this block runs, so the
  -- "empty console" cannot be reproduced here. What CAN be asserted is the
  -- thing that makes the fix a fix: an appointed officer sees the room.

  -- ---- AN UNAPPOINTED INVIGILATOR SEES NOTHING --------------------------
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', stranger::text, true);
  select count(*) into seen from exam_sessions where id = sess;
  reset role;
  if seen <> 0 then
    raise exception '111 FAILED — an invigilator nobody appointed is watching the room';
  end if;
  raise notice '111 OK  an invigilator appointed to nothing watches nothing';

  -- ---- APPOINTED, AND THE ROOM OPENS ------------------------------------
  insert into examination_officers (examination_id, person_id, role, assigned_by)
       values (exam, watcher, 'invigilator', office);

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', watcher::text, true);
  select count(*) into seen from exam_sessions where id = sess;
  reset role;
  if seen <> 1 then
    raise exception '111 FAILED — the appointed invigilator sees % of 1 sitting. This is the '
                    'fault 111 exists to fix, still present.', seen;
  end if;
  raise notice '111 OK  …and one appointed to this paper sees its sittings';

  -- AND ONLY ITS SITTINGS. The register is per examination, not per role.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', watcher::text, true);
  select count(*) into seen from exam_sessions where examination_id = other;
  reset role;
  if seen <> 0 then
    raise exception '111 FAILED — an invigilator appointed to one paper is reading another';
  end if;
  raise notice '111 OK  …and not the sittings of a paper they were not put on';

  -- ---- THE REGISTER ANSWERS WITHOUT RECURSING ---------------------------
  --
  -- The policy on `examination_officers` calls a function that reads
  -- `examination_officers`. If `watches_this_examination` were not SECURITY
  -- DEFINER this query would recurse until Postgres refused it, and the
  -- symptom would be an error nobody could read.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', watcher::text, true);
  select count(*) into seen from examination_officers where examination_id = exam;
  reset role;
  if seen <> 1 then
    raise exception '111 FAILED — the register of who is watching shows % of 1', seen;
  end if;
  raise notice '111 OK  the register answers, and does not recurse through its own policy';

  -- ---- THE EXAMINATION OFFICE SEES EVERY ROOM ---------------------------
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', office::text, true);
  select count(*) into seen from exam_sessions where id = sess;
  reset role;
  if seen <> 1 then
    raise exception '111 FAILED — the Examination Office cannot see a sitting it is running';
  end if;
  raise notice '111 OK  the Examination Office sees every room, appointed or not';

  -- ---- THE CANDIDATE READS THEIR OWN SITTING ----------------------------
  --
  -- 015 wrote this and 016 dropped it when it moved the student onto a view.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', cand::text, true);
  select count(*) into seen from exam_sessions where id = sess;
  reset role;
  if seen <> 1 then
    raise exception '111 FAILED — a candidate cannot read their own sitting';
  end if;
  raise notice '111 OK  …and a candidate reads their own sitting, which 016 had dropped';

  -- ---- AND NOT THE OBSERVATIONS MADE ABOUT THEM -------------------------
  insert into exam_events (session_id, kind, source, severity)
       values (sess, 'window_blurred', 'system', 'alert');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', cand::text, true);
  select count(*) into seen from exam_events where session_id = sess;
  reset role;
  if seen <> 0 then
    raise exception '111 FAILED — a candidate is reading the proctoring flags raised about '
                    'them during their own sitting';
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', watcher::text, true);
  select count(*) into seen from exam_events where session_id = sess;
  reset role;
  if seen <> 1 then
    raise exception '111 FAILED — the invigilator cannot see the proctoring trail (% of 1)', seen;
  end if;
  raise notice '111 OK  the proctoring trail is the invigilator''s and never the candidate''s';

  -- ---- A CANDIDATE CANNOT BE AN OFFICER OF THEIR OWN EXAMINATION --------
  refused_ := false;
  begin
    insert into examination_officers (examination_id, person_id, role, assigned_by)
         values (exam, cand, 'invigilator', office);
  exception when others then
    if sqlerrm not like '%cannot be an officer%' then
      raise exception '111 FAILED — refused, but for the wrong reason: %', sqlerrm;
    end if;
    refused_ := true;
  end;
  if not refused_ then
    raise exception '111 FAILED — a candidate was appointed to invigilate their own paper';
  end if;
  raise notice '111 OK  a candidate cannot be an officer of their own examination';

  -- ---- NOR CAN ANY STUDENT, OF ANY EXAMINATION --------------------------
  refused_ := false;
  begin
    insert into examination_officers (examination_id, person_id, role, assigned_by)
         values (other, cand, 'observer', office);
  exception when others then
    refused_ := true;
  end;
  if not refused_ then
    raise exception '111 FAILED — a student was made an observer of an examination';
  end if;
  raise notice '111 OK  …nor can a student be an officer of any examination at all';

  -- ---- AND THE UNWATCHED ONES ARE LISTED --------------------------------
  --
  -- `exam` has an invigilator and `other` has none, so exactly one of this
  -- proof's two papers is on the list. IT NEVER COUNTS THE UNIVERSITY'S.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', office::text, true);
  select count(*) into seen from examinations_nobody_is_watching where id in (exam, other);
  reset role;
  if seen <> 1 then
    raise exception '111 FAILED — % of this proof''s two papers are listed as unwatched, not 1',
      seen;
  end if;
  if not exists (select 1 from examinations_nobody_is_watching where id = other) then
    raise exception '111 FAILED — a paper with no invigilator is not on the list';
  end if;
  raise notice '111 OK  and a published paper with nobody appointed to watch it is listed';

  -- AN EXAMINER IS NOT A WATCHER. Appointing one to `other` must not take it
  -- off the list: marking afterwards is not being in the room.
  insert into examination_officers (examination_id, person_id, role, assigned_by)
       values (other, watcher, 'examiner', office);
  if not exists (select 1 from examinations_nobody_is_watching where id = other) then
    raise exception '111 FAILED — appointing an EXAMINER took a paper off the unwatched list';
  end if;
  raise notice '111 OK  …and appointing somebody to mark it afterwards does not take it off';

  raise exception 'ROLLBACK 111';
exception
  when others then
    if sqlerrm = 'ROLLBACK 111' then
      raise notice '111 OK  every proof above rolled back; no examination, sitting or '
                   'appointment of the University''s was read, counted or written to';
    else
      raise;
    end if;
end $$;


-- ===========================================================================
-- 5. DONE
-- ===========================================================================
do $$
declare n integer;
begin
  select count(*) into n from examinations_nobody_is_watching;
  raise notice '111 APPLIED  the proctoring console was EMPTY FOR EVERYBODY since 016 — five '
               'tables had row security on and no policy, which is invisible rather than '
               'open, and a SELECT returned nothing without saying why. The officers '
               'appointed to a paper can now see its room, the Examination Office can see '
               'every room, and a candidate reads their own sitting and never the '
               'observations made about them. AN EXAMINATION WITH NOBODY APPOINTED IS '
               'WATCHED BY NOBODY: % published or running examination(s) have no invigilator '
               'on them right now, and `examinations_nobody_is_watching` lists them.', n;
end $$;
