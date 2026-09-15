-- ===========================================================================
-- 094 — LIVE DELIVERY IS NOT PUBLICATION
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- NOTHING CLOSES. Three new tables and one new unique index on
-- `course_lessons (id, course_id)`, which takes nothing away — it exists so a
-- live session's (lesson_id, course_id) can be a foreign key, exactly as 084
-- did for lessons and 092 for artefacts.
--
-- ---------------------------------------------------------------------------
-- THE DISTINCTION THIS FILE IS NAMED FOR
-- ---------------------------------------------------------------------------
--
-- 092 and 093 are built on one rule: a student reads what the lecturer has
-- approved and published, and never the machine's first draft.
--
-- A LIVE CLASS IS THE EXCEPTION, AND IT IS NOT A LOOPHOLE.
--
-- A student in Brazil sitting in a lecture given in English is not reading
-- material. They are AT the event, hearing it as it is given. What the carried
-- text gives them is what a human interpreter in the room would give them —
-- and an interpreter does not wait for the lecturer to review the morning
-- before speaking.
--
-- So the cohort reads `live_segments` and `live_carried` for a session on
-- their course, unapproved, while it happens. What makes that honest rather
-- than a hole in 092:
--
--   · NONE OF IT IS EVER THE MASTER. The reviewed record of a lecture is the
--     artefact pipeline — recording, transcript, correction, approval. Live
--     text is interpretation, it is marked as such, and it never becomes an
--     artefact by sitting still. A lecturer who wants the lecture published
--     takes the recording through the pipeline like any other.
--   · A REFUSAL IS RECORDED AND SHOWN. When the carry cannot be trusted, the
--     student is told so. See below — it is a check constraint, not a
--     convention.
--   · THE FALLBACK IS THE FLOOR, NOT SILENCE. When a language fails, the
--     student hears the original. Silence is the worst available answer
--     because it is indistinguishable from their own connection dropping.
--
-- ---------------------------------------------------------------------------
-- A REFUSAL THAT SAYS NOTHING IS WORSE THAN A WRONG TRANSLATION
-- ---------------------------------------------------------------------------
--
-- `live_carried.state = 'refused'` means the system declined to carry a
-- sentence — the terminology check failed, the model would not commit, the
-- audio was unintelligible. The student must be TOLD that, in the moment,
-- because a gap they cannot account for is one they will fill themselves,
-- usually by assuming they missed something.
--
-- So a refusal without a reason cannot be stored at all. The proof watches it
-- refuse.
-- ===========================================================================


-- ===========================================================================
-- THE KEY A LIVE SESSION HANGS ON
-- ===========================================================================
--
-- 086 gave `course_lessons` a `section_id` and the kind `live_class`, with
-- `starts_at`, `ends_at` and `join_url`. That row IS the scheduled class —
-- it is what `my_next_classes` reads and what a student sees on the Timetable.
--
-- A live session is what happens inside one. It points at that lesson where
-- there is one, and stands alone where there is not: a lecturer who starts an
-- unscheduled session should not be refused because nobody put it on a
-- timetable first.
-- ===========================================================================

create unique index if not exists course_lessons_id_course_key
  on course_lessons (id, course_id);


-- ===========================================================================
-- THE SESSION
-- ===========================================================================

create table if not exists live_sessions (
  id             uuid primary key default gen_random_uuid(),
  course_id      uuid not null references courses (id) on delete cascade,
  lecture_id     uuid references lectures (id) on delete set null,

  -- The scheduled class this is the delivery of, where there is one.
  lesson_id      uuid,

  title          text not null check (length(btrim(title)) between 1 and 300),
  lecturer_id    uuid not null references auth.users (id),

  -- WHAT IS BEING SPOKEN, and what is being carried out of it. The floor is
  -- never one of the carried languages: carrying English into English is a
  -- cost with no listener.
  floor_language text not null,
  languages      text[] not null default '{}',

  state          text not null default 'scheduled'
                 check (state in ('scheduled', 'running', 'ended', 'abandoned')),
  started_at     timestamptz,
  ended_at       timestamptz,

  -- WHAT A STUDENT HEARS WHEN THEIR LANGUAGE FAILS.
  --   'floor'   — the original. The default, and almost always right.
  --   'notice'  — a spoken or written notice that the carry has stopped.
  --   'silence' — available, and the worst of the three: a student cannot
  --               tell it from their own connection dropping.
  fallback       text not null default 'floor'
                 check (fallback in ('floor', 'silence', 'notice')),
  media_path     text,
  created_at     timestamptz not null default now(),

  constraint live_sessions_floor_is_not_carried
    check (not (floor_language = any (languages))),

  -- A SESSION THAT IS RUNNING STARTED. A session that ended, ended.
  constraint live_sessions_running_has_a_start
    check (state not in ('running', 'ended') or started_at is not null),
  constraint live_sessions_ended_has_an_end
    check (state <> 'ended' or ended_at is not null),
  constraint live_sessions_ends_after_it_starts
    check (ended_at is null or started_at is null or ended_at >= started_at),

  -- The scheduled class must belong to the same course. Same protection as
  -- 084's lesson and 092's artefact: a denormalised column that can lie is
  -- worse than the join it saved.
  constraint live_sessions_lesson_agrees
    foreign key (lesson_id, course_id) references course_lessons (id, course_id)
    on delete set null
);

comment on table live_sessions is
  'A live class being delivered, and interpreted into the languages its cohort reads. Points at '
  'the course_lessons row of kind live_class where the class was scheduled; stands alone where '
  'it was not.';

create index if not exists live_sessions_course_idx on live_sessions (course_id, state);


-- ===========================================================================
-- WHAT WAS SAID, AND WHAT WAS CARRIED
-- ===========================================================================

create table if not exists live_segments (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references live_sessions (id) on delete cascade,
  sequence    integer not null,
  heard       text not null,
  spoken_at   timestamptz not null default now(),
  seconds     numeric(8,2) not null check (seconds >= 0),
  unique (session_id, sequence),

  -- The key a carried segment's composite foreign key points at.
  unique (id, session_id)
);

comment on table live_segments is
  'One utterance in the floor language, as heard. NOT a transcript of record: the reviewed '
  'account of a lecture is the artefact pipeline, and nothing here becomes one by sitting still.';

create table if not exists live_carried (
  id          uuid primary key default gen_random_uuid(),
  segment_id  uuid not null references live_segments (id) on delete cascade,
  session_id  uuid not null references live_sessions (id) on delete cascade,
  sequence    integer not null,
  language    text not null,

  --   'heard'    — the utterance arrived, nothing done with it yet
  --   'carrying' — in flight
  --   'ready'    — carried, and the student has it
  --   'refused'  — declined, WITH a reason the student is shown
  --   'late'     — arrived after the moment had passed
  --   'failed'   — broke
  state       text not null
              check (state in ('heard', 'carrying', 'ready', 'refused', 'late', 'failed')),
  text        text,
  media_path  text,
  refusal     text,
  timing      jsonb,
  unique (segment_id, language),

  -- ---- THE CONSTRAINT THIS FILE EXISTS FOR ------------------------------
  --
  -- A refusal with no reason is a gap the student cannot account for, and a
  -- gap they cannot account for is one they will fill themselves — usually by
  -- assuming they missed something. It cannot be stored.
  constraint live_carried_a_refusal_says_why
    check (state <> 'refused' or (refusal is not null and length(btrim(refusal)) > 0)),

  constraint live_carried_segment_agrees
    foreign key (segment_id, session_id) references live_segments (id, session_id)
    on delete cascade
);

comment on table live_carried is
  'One utterance carried into one language. A refusal names its reason, because a silence the '
  'student cannot account for is worse than a translation they can doubt.';

create index if not exists live_carried_session_idx
  on live_carried (session_id, sequence, language);


-- ===========================================================================
-- ROW-LEVEL SECURITY
-- ===========================================================================
--
-- The cohort reads it while it happens, which is the exception argued at the
-- top of this file. Everything that WRITES it belongs to the lecturer taking
-- the class.
-- ===========================================================================

alter table live_sessions enable row level security;
alter table live_segments enable row level security;
alter table live_carried  enable row level security;

drop policy if exists live_sessions_read  on live_sessions;
drop policy if exists live_sessions_write on live_sessions;

create policy live_sessions_read on live_sessions
  for select using (
       lecturer_id = auth.uid()
    or teaches_this_course(course_id)
    or is_enrolled_on_course(course_id)
  );

create policy live_sessions_write on live_sessions
  for all using (lecturer_id = auth.uid())
  with check (lecturer_id = auth.uid() and teaches_this_course(course_id));

-- ---------------------------------------------------------------------------
-- WHO MAY READ ONE UTTERANCE
--
-- SECURITY DEFINER, and not a subquery in the policy. A policy on
-- `live_segments` that reads `live_sessions` to find the course has that read
-- filtered by `live_sessions`' OWN policy — the clause can be unreachable and
-- a student in the class is refused the interpretation. 084 met this on
-- `course_lessons_read`, which is why `module_is_open()` exists; 092 met it
-- again in the vendored predicates it replaced.
-- ---------------------------------------------------------------------------
create or replace function may_follow_live_session(the_session uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from live_sessions s
     where s.id = the_session
       and (s.lecturer_id = auth.uid()
         or teaches_this_course(s.course_id)
         or is_enrolled_on_course(s.course_id))
  );
$$;

create or replace function runs_live_session(the_session uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from live_sessions s
     where s.id = the_session and s.lecturer_id = auth.uid()
  );
$$;

comment on function may_follow_live_session(uuid) is
  'Whether the signed-in account may follow this live class: the lecturer taking it, a lecturer '
  'on the course, or a student enrolled on it. Security definer, so the policies that call it '
  'are not filtered by live_sessions'' own policy.';

revoke all on function may_follow_live_session(uuid) from public;
revoke all on function runs_live_session(uuid)       from public;
grant execute on function may_follow_live_session(uuid) to authenticated;
grant execute on function runs_live_session(uuid)       to authenticated;

drop policy if exists live_segments_read  on live_segments;
drop policy if exists live_segments_write on live_segments;
drop policy if exists live_carried_read   on live_carried;
drop policy if exists live_carried_write  on live_carried;

create policy live_segments_read on live_segments
  for select using (may_follow_live_session(session_id));
create policy live_segments_write on live_segments
  for all using (runs_live_session(session_id)) with check (runs_live_session(session_id));

create policy live_carried_read on live_carried
  for select using (may_follow_live_session(session_id));
create policy live_carried_write on live_carried
  for all using (runs_live_session(session_id)) with check (runs_live_session(session_id));

revoke insert, update, delete, truncate, references, trigger
  on live_sessions, live_segments, live_carried from anon;
revoke truncate, references, trigger
  on live_sessions, live_segments, live_carried from authenticated;
grant select on live_sessions, live_segments, live_carried to anon, authenticated;
grant insert, update, delete on live_sessions, live_segments, live_carried to authenticated;


-- ===========================================================================
-- THE PROOF
-- ===========================================================================

do $$
declare
  lect_user uuid := gen_random_uuid();
  in_user   uuid := gen_random_uuid();
  out_user  uuid := gen_random_uuid();
  lect_id   uuid;
  the_course uuid;
  other_course uuid;
  other_module uuid;
  other_lesson uuid;
  mine      uuid;
  theirs    uuid;
  the_module uuid;
  the_lesson uuid;
  the_session uuid;
  other_session uuid;
  the_segment uuid;
  other_segment uuid;
  seen      integer;
begin
  begin
    insert into auth.users (id, email) values
      (lect_user, '094-lecturer@example.test'),
      (in_user,   '094-enrolled@example.test'),
      (out_user,  '094-stranger@example.test');
    insert into profiles (id, email, role) values
      (lect_user, '094-lecturer@example.test', 'lecturer'),
      (in_user,   '094-enrolled@example.test', 'student'),
      (out_user,  '094-stranger@example.test', 'student')
    on conflict (id) do update set role = excluded.role;

    insert into lecturers (staff_id, first_name, last_name, auth_user_id)
      values ('ICOFSTF-9094', 'Proof', 'Lecturer', lect_user) returning id into lect_id;
    insert into courses (code, title, lecturer_id)
      values ('ZZZ 9094', 'A Course Written By The 094 Proof', lect_id)
      returning id into the_course;
    insert into courses (code, title)
      values ('ZZZ 9094B', 'A Second Course, For The Lesson Key')
      returning id into other_course;

    insert into students (matric_no, first_name, last_name, status, auth_user_id)
      values ('094/PROOF/IN', 'In', 'TheClass', 'enrolled', in_user) returning id into mine;
    insert into students (matric_no, first_name, last_name, status, auth_user_id)
      values ('094/PROOF/OUT', 'Not', 'InIt', 'enrolled', out_user) returning id into theirs;
    insert into enrollments (student_id, course_id, status)
      values (mine, the_course, 'registered');

    insert into course_modules (course_id, title, visible, sort_order)
      values (the_course, 'Module written by the 094 proof', true, 1)
      returning id into the_module;
    insert into course_lessons (module_id, course_id, kind, title, starts_at, ends_at, visible)
      values (the_module, the_course, 'live_class', 'The scheduled class',
              now(), now() + interval '1 hour', true)
      returning id into the_lesson;

    -- A REAL SECOND LESSON ON A REAL SECOND COURSE. An invented uuid would be
    -- refused by the plain key and the composite one never consulted — 084's
    -- lesson, learned once and not relearned.
    insert into course_modules (course_id, title, visible, sort_order)
      values (other_course, 'A module of the OTHER course', true, 1)
      returning id into other_module;
    insert into course_lessons (module_id, course_id, kind, title, starts_at, ends_at, visible)
      values (other_module, other_course, 'live_class', 'Another course''s class',
              now(), now() + interval '1 hour', true)
      returning id into other_lesson;

    insert into live_sessions (course_id, lesson_id, title, lecturer_id,
                               floor_language, languages, state, started_at)
      values (the_course, the_lesson, 'The 094 proof''s live class', lect_user,
              'en', array['fr', 'pt'], 'running', now())
      returning id into the_session;

    -- ---- A SESSION CANNOT BORROW ANOTHER COURSE'S CLASS -------------------
    begin
      update live_sessions set lesson_id = other_lesson where id = the_session;
      raise exception '094 FAILED: a live session was attached to a scheduled class of a '
                      'different course, so it would appear on the wrong timetable';
    exception
      when foreign_key_violation then null;
    end;

    -- ---- CARRYING THE FLOOR INTO THE FLOOR --------------------------------
    begin
      insert into live_sessions (course_id, title, lecturer_id, floor_language, languages, state)
        values (the_course, 'A session carrying English into English', lect_user,
                'en', array['fr', 'en'], 'scheduled');
      raise exception '094 FAILED: a session was accepted carrying its own floor language, '
                      'which is a cost with no listener';
    exception
      when check_violation then null;
    end;

    -- ---- A SESSION THAT IS RUNNING BUT NEVER STARTED ----------------------
    begin
      insert into live_sessions (course_id, title, lecturer_id, floor_language, state)
        values (the_course, 'A class that is running and never began', lect_user, 'en', 'running');
      raise exception '094 FAILED: a session is "running" with no start time, so nobody can say '
                      'when the class began';
    exception
      when check_violation then null;
    end;

    insert into live_segments (session_id, sequence, heard, seconds)
      values (the_session, 1, 'What the lecturer actually said.', 4.5)
      returning id into the_segment;

    -- ---- A REFUSAL THAT SAYS NOTHING --------------------------------------
    --
    -- The constraint this file is named for.
    begin
      insert into live_carried (segment_id, session_id, sequence, language, state)
        values (the_segment, the_session, 1, 'fr', 'refused');
      raise exception '094 FAILED: a refusal was stored with no reason, so the student gets a '
                      'gap they cannot tell from their own connection dropping';
    exception
      when check_violation then null;
    end;

    -- AND ONE THAT DOES, WHICH MUST STILL WORK.
    insert into live_carried (segment_id, session_id, sequence, language, state, refusal)
      values (the_segment, the_session, 1, 'fr', 'refused',
              'The lecturer''s protected terminology was lost in the carry.');

    insert into live_carried (segment_id, session_id, sequence, language, state, text)
      values (the_segment, the_session, 1, 'pt', 'ready', 'O que o professor disse.');

    -- ---- A CARRIED LINE CANNOT CLAIM ANOTHER SESSION ----------------------
    insert into live_sessions (course_id, title, lecturer_id, floor_language, languages, state,
                               started_at)
      values (the_course, 'A second session of the same course', lect_user, 'en',
              array['fr'], 'running', now())
      returning id into other_session;
    insert into live_segments (session_id, sequence, heard, seconds)
      values (other_session, 1, 'Something said in the other session.', 2.0)
      returning id into other_segment;

    begin
      insert into live_carried (segment_id, session_id, sequence, language, state, text)
        values (other_segment, the_session, 1, 'de', 'ready', 'Etwas anderes.');
      raise exception '094 FAILED: a carried line claimed a session its segment does not belong '
                      'to, so one class''s interpretation can appear inside another';
    exception
      when foreign_key_violation then null;
    end;

    -- ---- NOW FOLLOW THE CLASS AS THREE PEOPLE -----------------------------
    set local role authenticated;

    -- THE STUDENT IN THE CLASS. Unapproved, live, and that is the ruling at
    -- the top of this file: they are AT the event, not reading material.
    execute format('set local request.jwt.claim.sub = %L', in_user);
    select count(*) into seen from live_segments where session_id = the_session;
    if seen <> 1 then
      raise exception '094 FAILED: a student in the class cannot read what is being said in it, '
                      'so the interpretation reaches nobody';
    end if;
    select count(*) into seen from live_carried where session_id = the_session;
    if seen <> 2 then
      raise exception '094 FAILED: a student in the class cannot read the carried text';
    end if;

    -- AND THEY SEE THE REFUSAL, rather than a line that is simply missing.
    select count(*) into seen from live_carried
      where session_id = the_session and state = 'refused' and refusal is not null;
    if seen <> 1 then
      raise exception '094 FAILED: the student cannot see that a line was refused, which is the '
                      'whole reason a refusal is stored rather than dropped';
    end if;

    -- THE STUDENT WHO IS NOT ON THE COURSE.
    execute format('set local request.jwt.claim.sub = %L', out_user);
    select count(*) into seen from live_sessions where id = the_session;
    if seen <> 0 then
      raise exception '094 FAILED: a student not on the course can see its live class';
    end if;
    select count(*) into seen from live_segments where session_id = the_session;
    if seen <> 0 then
      raise exception '094 FAILED: a student not on the course can read what is being said in '
                      'its live class';
    end if;

    -- ---- AND A STUDENT CANNOT PUT WORDS IN THE LECTURER'S MOUTH ----------
    begin
      insert into live_segments (session_id, sequence, heard, seconds)
        values (the_session, 99, 'Something the lecturer never said.', 1.0);
      raise exception '094 FAILED: a student wrote a line into the live transcript of a class, '
                      'attributed to the lecturer taking it';
    exception
      when insufficient_privilege then null;
    end;

    reset role;

    raise exception 'rollback 094 proof';
  exception
    when others then
      reset role;
      if sqlerrm <> 'rollback 094 proof' then raise; end if;
  end;
end $$;


do $$
begin
  raise notice '094 OK: a live session belongs to its own course''s scheduled class, cannot '
               'carry its own floor language, and cannot be running without having started';
  raise notice '094 OK: a refusal cannot be stored without a reason, so a student is told the '
               'line was declined rather than left with a gap';
  raise notice '094 OK: a carried line cannot claim a session its segment does not belong to';
  raise notice '094 OK: the class follows it live and unapproved — they are at the event — and '
               'a student not on the course reads none of it';
  raise notice '094 OK: only the lecturer taking the class writes what was said in it';
end $$;
