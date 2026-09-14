-- ===========================================================================
-- 086 — THE TIMETABLE JOINS THE COURSE, AND THE COURSE BECOMES SEARCHABLE
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- NOTHING IS DELETED AND NOTHING IS REFUSED that was permitted before. Four
-- things are added, all of them joins between things that already existed
-- separately:
--
--   1. A LIVE CLASS IN THE LMS IS A TIMETABLED CLASS. Not a copy of one.
--   2. A STUDENT CAN SEE THEIR OWN ATTENDANCE as a figure, and a lecturer can
--      see the register for a class they teach.
--   3. EVERY WORD OF A COURSE IS SEARCHABLE — lessons, transcripts, readings —
--      and only within the courses the person asking is on.
--   4. THE COURSE AI TUTOR has somewhere to keep a conversation, and a
--      citation on every answer.
--
-- ---------------------------------------------------------------------------
-- WHY A LIVE CLASS MUST NOT BE RETYPED
-- ---------------------------------------------------------------------------
--
-- The University: "Your Timetable already knows: BLT 501, Monday 08:00-10:00.
-- The LMS should connect to it."
--
-- Quite so, and the alternative is the fault this whole system has been
-- unpicking for months. 084 gave a lesson `starts_at` and a `join_url`, and if
-- that is where a live class lives then the University has TWO answers to
-- "when is BLT 501 on Monday" — the timetable's and the LMS's. They agree on
-- the day they are typed and disagree the first time a class moves, and the
-- one that moved is the one nobody updated.
--
-- So a live-class lesson NAMES ITS SECTION. The day, the time, the room and
-- the meeting link are read from the timetable; the lesson holds what the
-- timetable has no business holding — what the class is about, what to read
-- first, what a student should be able to do afterwards.
--
-- ---------------------------------------------------------------------------
-- AND WHAT THE TUTOR MAY AND MAY NOT DO
-- ---------------------------------------------------------------------------
--
-- The University: it "answers student questions only from approved course
-- materials and cites the relevant course/module/lesson. It must operate as a
-- learning assistant rather than simply generating answers to graded
-- assignments."
--
-- Both halves are structural here rather than left to a prompt:
--
--   · A CITATION IS A ROW, not a sentence in the answer. `tutor_citations`
--     points at a real lesson, so a citation cannot be to a lesson that does
--     not exist — which is the characteristic failure of a model asked to cite
--     its sources in prose.
--
--   · A REFUSAL IS RECORDED. When the tutor declines to do a student's
--     assignment for them, the reason is written down, so the University can
--     read what it has been refusing rather than take anybody's word for it.
--
-- THE TUTOR IS DARK UNTIL A KEY IS ADDED, which is the University's decision
-- of September 2026. Nothing here calls anything: these are the tables the
-- conversation lives in, and they are useful on their own — a student's
-- questions are worth keeping whether or not anything answered them.
-- ===========================================================================


-- ===========================================================================
-- 1. A LIVE CLASS IS A TIMETABLED CLASS
-- ===========================================================================

alter table course_lessons
  add column if not exists section_id uuid references class_sections(id) on delete set null;

comment on column course_lessons.section_id is
  'The timetabled class this lesson IS. The day, time, room and meeting link are read from '
  'class_sections; the lesson holds only what the timetable has no business holding. Null for '
  'every kind but live_class.';

create index if not exists course_lessons_by_section
  on course_lessons (section_id) where section_id is not null;

-- ---------------------------------------------------------------------------
-- ONLY A LIVE CLASS HAS A SECTION.
--
-- A reading with a timetable slot is a row somebody built by copying another
-- row, and it would appear in a student's "next class" panel.
--
-- WRITTEN AS `not valid` THEN VALIDATED, because the University's database has
-- rows in this table already and a constraint that cannot be added is a
-- constraint that is not there. Validation then checks them. If it fails, it
-- fails LOUDLY on their data rather than being skipped.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'course_lessons_section_is_a_class') then
    alter table course_lessons
      add constraint course_lessons_section_is_a_class
      check (section_id is null or kind = 'live_class') not valid;
    alter table course_lessons validate constraint course_lessons_section_is_a_class;
  end if;
end $$;


-- ===========================================================================
-- 2. WHAT A STUDENT'S NEXT CLASS IS
-- ===========================================================================
--
-- SELF-FILTERING, which is the house pattern for every `my_*` view in this
-- schema and worth saying why: a view runs as its OWNER, so row-level security
-- on the tables underneath does NOT apply to somebody selecting from it. A
-- view that did not filter on `auth.uid()` itself would hand every student the
-- whole University's timetable, and it would do it without any policy being
-- wrong.

drop view if exists my_next_classes;
create view my_next_classes as
  select
    s.id                as student_id,
    c.id                as course_id,
    c.code              as course_code,
    c.title             as course_title,
    sec.id              as section_id,
    sec.day_of_week,
    sec.starts_at,
    sec.ends_at,
    sec.delivery_mode,
    sec.online_link,
    rm.code             as room_code,
    rm.campus,
    coalesce(l.first_name || ' ' || l.last_name, null) as lecturer,
    -- THE LESSON, WHERE THE LECTURER HAS WRITTEN ONE. A class with a lesson
    -- has something to read before it; a class without one is still a class.
    les.id              as lesson_id,
    les.title           as lesson_title,
    les.learning_objective
  from enrollments e
  join students s on s.id = e.student_id
  join courses c on c.id = e.course_id
  join course_offerings o on o.id = e.offering_id
  join class_sections sec on sec.offering_id = o.id
  left join rooms rm on rm.id = sec.room_id
  left join lecturers l on l.id = coalesce(sec.lecturer_id, o.lecturer_id)
  left join course_lessons les
         on les.section_id = sec.id and les.visible
  where e.status = 'registered'
    and sec.day_of_week is not null
    and s.auth_user_id = auth.uid()
    and (e.section_id is null or e.section_id = sec.id);

grant select on my_next_classes to authenticated;

comment on view my_next_classes is
  'The signed-in student''s timetabled classes, with the LMS lesson for each where the lecturer '
  'has written one. Filters on auth.uid() itself: a view runs as its owner, so RLS underneath '
  'does not protect it.';


-- ===========================================================================
-- 3. ATTENDANCE, AS A FIGURE
-- ===========================================================================
--
-- The University: "Student sees: Attendance: 87.5%".
--
-- COUNTED IN SQL AND NOT IN A SCREEN, because two screens counting the same
-- thing is two percentages, and the one a student quotes in an appeal will be
-- whichever is higher.
--
-- LATE COUNTS AS ATTENDED, and that is a decision worth writing down rather
-- than burying: a student who arrived at 08:10 was at the class. Whether
-- lateness carries its own consequence is a matter for the University, and
-- `class_attendance.state` keeps the distinction so they can rule on it later
-- without recounting anything. EXCUSED IS EXCLUDED ALTOGETHER — an authorised
-- absence must not reduce a percentage, or the register punishes the student
-- for having a reason the University accepted.

drop view if exists my_attendance;
create view my_attendance as
  select
    s.id  as student_id,
    c.id  as course_id,
    c.code as course_code,
    c.title as course_title,
    count(*) filter (where a.state <> 'excused')            as counted,
    count(*) filter (where a.state in ('present', 'late'))  as attended,
    count(*) filter (where a.state = 'absent')              as absent,
    count(*) filter (where a.state = 'excused')             as excused,
    case when count(*) filter (where a.state <> 'excused') = 0 then null
         else round(
           100.0 * count(*) filter (where a.state in ('present', 'late'))
                 / count(*) filter (where a.state <> 'excused'), 1)
    end as percent
  from class_attendance a
  join students s on s.id = a.student_id
  join course_lessons les on les.id = a.lesson_id
  join courses c on c.id = les.course_id
  where s.auth_user_id = auth.uid()
  group by s.id, c.id, c.code, c.title;

grant select on my_attendance to authenticated;

comment on view my_attendance is
  'The signed-in student''s attendance per course. Late counts as attended; excused is excluded '
  'from the denominator, so an authorised absence does not reduce the figure.';


-- ===========================================================================
-- 4. SEARCHING A COURSE
-- ===========================================================================
--
-- "Make all course content searchable." Including the transcript, which is the
-- point of having one: "Students can: Listen, Read, Search transcript."
--
-- AND ONLY WITHIN THEIR OWN COURSES. The same view that makes a course
-- searchable makes every course searchable if it forgets to ask who is
-- asking — and a search box is the most convenient possible way to read
-- somebody else's material, because it does not require knowing it is there.

drop view if exists course_content_search;
create view course_content_search as
  select
    les.id        as lesson_id,
    les.course_id,
    m.id          as module_id,
    m.title       as module_title,
    c.code        as course_code,
    c.title       as course_title,
    les.kind,
    les.title,
    les.summary,
    les.requirement,
    les.author,
    les.published_year,
    -- WHETHER THE HIT WAS IN THE TRANSCRIPT, so a result can say "at 12:04 in
    -- the audio lecture" rather than sending a student to the top of an
    -- eighty-minute recording.
    (les.transcript is not null and length(btrim(les.transcript)) > 0) as has_transcript,
    to_tsvector('english',
      coalesce(les.title, '') || ' ' || coalesce(les.summary, '') || ' ' ||
      coalesce(les.body, '') || ' ' || coalesce(les.transcript, '') || ' ' ||
      coalesce(les.citation, '') || ' ' || coalesce(les.author, '')) as document
  from course_lessons les
  join course_modules m on m.id = les.module_id
  join courses c on c.id = les.course_id
  where
    -- THE SAME RULE THE POLICY USES, written again because a view cannot
    -- inherit one. 084's `course_lessons_read` protects the table; this view
    -- runs as its owner and would sail straight past it.
    (les.visible and m.visible
       and (m.opens_on is null or m.opens_on <= current_date)
       and is_enrolled_on_course(les.course_id))
    or may_curate_course(les.course_id);

grant select on course_content_search to authenticated;

comment on view course_content_search is
  'Every searchable word of the courses the signed-in person is on or teaches — lesson text, '
  'transcripts and citations. Repeats the enrolment rule because a view runs as its owner and '
  'would otherwise bypass the policy on course_lessons entirely.';


-- ===========================================================================
-- 5. THE COURSE AI TUTOR
-- ===========================================================================

create table if not exists tutor_conversations (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students(id) on delete cascade,
  course_id    uuid not null references courses(id) on delete cascade,
  title        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists tutor_conversations_by_student
  on tutor_conversations (student_id, course_id);

create table if not exists tutor_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references tutor_conversations(id) on delete cascade,
  role            text not null check (role in ('student', 'tutor')),
  body            text not null check (length(btrim(body)) >= 1),

  -- ---- WHAT THE TUTOR WOULD NOT DO ---------------------------------------
  --
  -- "It must operate as a learning assistant rather than simply generating
  -- answers to graded assignments."
  --
  -- RECORDED RATHER THAN ASSUMED. A refusal that leaves no trace is a claim
  -- about the system's behaviour that nobody can check — and this is exactly
  -- the sort of claim a university will one day be asked to substantiate.
  refused_reason  text check (refused_reason is null or refused_reason in (
                    'graded_assignment',   -- asked for the answer to marked work
                    'outside_materials',   -- not answerable from this course
                    'not_a_course_question'
                  )),
  -- Only a tutor message can refuse; a student's question is not a refusal.
  constraint tutor_messages_only_the_tutor_refuses
    check (refused_reason is null or role = 'tutor'),

  created_at      timestamptz not null default now()
);

create index if not exists tutor_messages_by_conversation
  on tutor_messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- THE CITATION, AS A ROW.
--
-- "…and cites the relevant course/module/lesson."
--
-- A FOREIGN KEY, NOT A SENTENCE. A model asked to cite its sources in prose
-- will cite a lesson that does not exist, confidently and in the right format,
-- and a student will go looking for it. A row cannot point at a lesson that is
-- not there: the database refuses to store the citation at all, and the answer
-- is rejected before anybody reads it.
-- ---------------------------------------------------------------------------
create table if not exists tutor_citations (
  id           uuid primary key default gen_random_uuid(),
  message_id   uuid not null references tutor_messages(id) on delete cascade,
  lesson_id    uuid not null references course_lessons(id) on delete cascade,
  -- The passage the answer rests on, so a student can check it rather than
  -- trust it.
  quote        text,
  created_at   timestamptz not null default now()
);

create index if not exists tutor_citations_by_message
  on tutor_citations (message_id);

alter table tutor_conversations enable row level security;
alter table tutor_messages      enable row level security;
alter table tutor_citations     enable row level security;

grant select, insert, update on tutor_conversations to authenticated;
grant select, insert on tutor_messages  to authenticated;
grant select          on tutor_citations to authenticated;

-- ---------------------------------------------------------------------------
-- A CONVERSATION IS THE STUDENT'S OWN.
--
-- AND NOT THE LECTURER'S TO READ, which is the same judgement 084 made about
-- private notes and for the same reason: a student who believes the person
-- marking them is reading their questions asks different questions, and a
-- tutor nobody dares ask a stupid question of is not a tutor.
-- ---------------------------------------------------------------------------
drop policy if exists tutor_conversations_own on tutor_conversations;
create policy tutor_conversations_own on tutor_conversations
  for all
  using (student_id in (select id from students where auth_user_id = auth.uid()))
  with check (
    student_id in (select id from students where auth_user_id = auth.uid())
    -- AND ONLY ABOUT A COURSE THEY ARE ON. The corpus is the course's
    -- material, so a conversation about a course somebody is not registered on
    -- is a request to be read material they may not read.
    and is_enrolled_on_course(course_id)
  );

drop policy if exists tutor_messages_own on tutor_messages;
create policy tutor_messages_own on tutor_messages
  for select using (
    conversation_id in (
      select id from tutor_conversations
       where student_id in (select id from students where auth_user_id = auth.uid()))
  );

-- THE STUDENT ASKS; THE TUTOR ANSWERS THROUGH THE SERVICE KEY. A session that
-- could write `role = 'tutor'` could put words in the University's mouth and
-- then quote them.
drop policy if exists tutor_messages_ask on tutor_messages;
create policy tutor_messages_ask on tutor_messages
  for insert with check (
    role = 'student'
    and refused_reason is null
    and conversation_id in (
      select id from tutor_conversations
       where student_id in (select id from students where auth_user_id = auth.uid()))
  );

drop policy if exists tutor_citations_own on tutor_citations;
create policy tutor_citations_own on tutor_citations
  for select using (
    message_id in (
      select m.id from tutor_messages m
       join tutor_conversations t on t.id = m.conversation_id
      where t.student_id in (select id from students where auth_user_id = auth.uid()))
  );


-- ===========================================================================
-- PROVE IT, AND ROLL IT BACK
-- ===========================================================================

do $$
declare
  lect_user uuid := gen_random_uuid();
  in_user   uuid := gen_random_uuid();
  out_user  uuid := gen_random_uuid();
  lect_id   uuid;
  the_course uuid;
  other_course uuid;
  mine      uuid;
  theirs    uuid;
  the_module uuid;
  the_lesson uuid;
  live_lesson uuid;
  the_year  uuid;
  the_offering uuid;
  the_section uuid;
  convo     uuid;
  msg       uuid;
  seen      integer;
  pct       numeric;
begin
  begin
    insert into auth.users (id, email) values
      (lect_user, '086-lecturer@example.test'),
      (in_user,   '086-enrolled@example.test'),
      (out_user,  '086-stranger@example.test');
    insert into profiles (id, email, role) values
      (lect_user, '086-lecturer@example.test', 'lecturer'),
      (in_user,   '086-enrolled@example.test', 'student'),
      (out_user,  '086-stranger@example.test', 'student')
    on conflict (id) do update set role = excluded.role;

    insert into lecturers (staff_id, first_name, last_name, auth_user_id)
      values ('ICOFSTF-9086', 'Proof', 'Lecturer', lect_user) returning id into lect_id;
    insert into courses (code, title, lecturer_id)
      values ('ZZZ 9086', 'A Course Written By The 086 Proof', lect_id)
      returning id into the_course;
    insert into courses (code, title)
      values ('ZZZ 9086B', 'A Course Nobody In This Proof Is On')
      returning id into other_course;

    insert into students (matric_no, first_name, last_name, status, auth_user_id)
      values ('086/PROOF/IN', 'On', 'TheCourse', 'enrolled', in_user) returning id into mine;
    insert into students (matric_no, first_name, last_name, status, auth_user_id)
      values ('086/PROOF/OUT', 'Not', 'OnIt', 'enrolled', out_user) returning id into theirs;

    -- A TERM, AN OFFERING AND A TIMETABLED SECTION, because a live class that
    -- is not on the timetable is the thing this migration exists to prevent.
    insert into academic_years (label, starts_in, starts_on, ends_on)
      -- The label must match ^\d{4}/\d{4}$, and a year far enough out that
      -- it cannot collide with one the University has set up.
      values ('2099/2100', 2099, '2099-09-01', '2100-06-30')
      returning id into the_year;
    insert into course_offerings (course_id, academic_year_id, term_sequence, status)
      values (the_course, the_year, 1, 'open') returning id into the_offering;
    insert into class_sections (offering_id, code, day_of_week, starts_at, ends_at,
                                delivery_mode, online_link)
      values (the_offering, 'ZZZ9086-A', 1, '08:00', '10:00', 'Online',
              'https://meet.example.test/086-proof')
      returning id into the_section;

    insert into enrollments (student_id, course_id, offering_id, status)
      values (mine, the_course, the_offering, 'registered');

    insert into course_modules (course_id, title, visible)
      values (the_course, 'Module for the 086 proof', true) returning id into the_module;

    insert into course_lessons (module_id, course_id, kind, title, body, transcript, visible)
      values (the_module, the_course, 'audio', 'An audio lecture written by the proof',
              'The description.', 'Welcome to this lecture on the doctrine of proof.', true)
      returning id into the_lesson;

    insert into course_lessons (module_id, course_id, kind, title, visible, section_id, starts_at)
      values (the_module, the_course, 'live_class', 'The Monday class', true, the_section,
              now() + interval '1 day')
      returning id into live_lesson;

    -- ---- ONLY A LIVE CLASS HAS A SECTION ----------------------------------
    begin
      update course_lessons set section_id = the_section where id = the_lesson;
      raise exception '086 FAILED: a reading was given a timetable slot, so it will appear in a '
                      'student''s next-class panel';
    exception
      when check_violation then null;
    end;

    -- ---- ATTENDANCE ------------------------------------------------------
    --
    -- Three counted classes: present, late, absent. Plus one excused, which
    -- must not appear in the denominator.
    insert into course_lessons (module_id, course_id, kind, title, visible, starts_at)
      select the_module, the_course, 'live_class', 'Class ' || g, true, now() - (g || ' days')::interval
        from generate_series(1, 3) g;

    insert into class_attendance (lesson_id, student_id, state)
      select id, mine,
             case when title = 'Class 1' then 'present'
                  when title = 'Class 2' then 'late'
                  else 'absent' end
        from course_lessons
       where course_id = the_course and title like 'Class %';
    insert into class_attendance (lesson_id, student_id, state)
      values (live_lesson, mine, 'excused');

    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', in_user);

    select percent into pct from my_attendance where course_id = the_course;
    -- present + late = 2 attended of 3 counted. The excused one is excluded.
    if pct is distinct from 66.7 then
      raise exception '086 FAILED: attendance came back as %, not 66.7 — present and late of '
                      'three counted classes, with the excused one excluded', pct;
    end if;

    -- ---- THE NEXT CLASS READS THE TIMETABLE -------------------------------
    select count(*) into seen from my_next_classes
     where section_id = the_section and lesson_id = live_lesson;
    if seen <> 1 then
      raise exception '086 FAILED: the student''s timetabled class is not joined to its LMS '
                      'lesson, so Join class has nothing to open';
    end if;

    -- ---- SEARCH FINDS THE TRANSCRIPT --------------------------------------
    select count(*) into seen from course_content_search
     where lesson_id = the_lesson
       and document @@ plainto_tsquery('english', 'doctrine of proof');
    if seen <> 1 then
      raise exception '086 FAILED: a word spoken in the audio lecture and written in its '
                      'transcript cannot be searched for';
    end if;

    -- ---- AND SEARCH IS NOT A WAY INTO SOMEBODY ELSE'S COURSE --------------
    execute format('set local request.jwt.claim.sub = %L', out_user);
    select count(*) into seen from course_content_search where course_id = the_course;
    if seen <> 0 then
      raise exception '086 FAILED: a student not on the course can search its content — the '
                      'most convenient possible way to read another course''s material';
    end if;
    select count(*) into seen from my_next_classes;
    if seen <> 0 then
      raise exception '086 FAILED: a student reads a timetable of classes they are not on';
    end if;
    select count(*) into seen from my_attendance;
    if seen <> 0 then
      raise exception '086 FAILED: a student reads somebody else''s attendance';
    end if;

    reset role;

    -- ---- THE TUTOR --------------------------------------------------------
    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', in_user);

    insert into tutor_conversations (student_id, course_id, title)
      values (mine, the_course, 'About the audio lecture') returning id into convo;

    insert into tutor_messages (conversation_id, role, body)
      values (convo, 'student', 'What is the doctrine of proof?') returning id into msg;

    -- A STUDENT MAY NOT SPEAK AS THE TUTOR. They could otherwise write an
    -- answer, and then quote the University as having given it.
    begin
      insert into tutor_messages (conversation_id, role, body)
        values (convo, 'tutor', 'The University says whatever this student wants.');
      raise exception '086 FAILED: a student wrote a message as the tutor, so they can put '
                      'words in the University''s mouth and then quote them';
    exception
      when insufficient_privilege then null;
    end;

    -- NOR OPEN A CONVERSATION ABOUT A COURSE THEY ARE NOT ON. The corpus is
    -- that course's material.
    begin
      insert into tutor_conversations (student_id, course_id)
        values (mine, other_course);
      raise exception '086 FAILED: a student opened a tutor conversation about a course they '
                      'are not registered on, whose material is the tutor''s corpus';
    exception
      when insufficient_privilege then null;
    end;

    -- NOR ONE AS SOMEBODY ELSE.
    begin
      insert into tutor_conversations (student_id, course_id) values (theirs, the_course);
      raise exception '086 FAILED: a student opened a tutor conversation as another student';
    exception
      when insufficient_privilege then null;
    end;

    reset role;

    -- ---- A CITATION CANNOT POINT AT A LESSON THAT DOES NOT EXIST ----------
    --
    -- The characteristic failure of a model asked to cite its sources: a
    -- reference in the right format to something that was never there.
    begin
      insert into tutor_citations (message_id, lesson_id)
        values (msg, gen_random_uuid());
      raise exception '086 FAILED: the tutor cited a lesson that does not exist, and a student '
                      'would go looking for it';
    exception
      when foreign_key_violation then null;
    end;

    -- ---- AND THE LECTURER DOES NOT READ THE CONVERSATION -----------------
    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', lect_user);
    select count(*) into seen from tutor_conversations where student_id = mine;
    if seen <> 0 then
      raise exception '086 FAILED: the lecturer can read a student''s tutor conversation, and a '
                      'tutor nobody dares ask a stupid question of is not a tutor';
    end if;
    reset role;

    raise exception 'rollback 086 proof';
  exception
    when others then
      reset role;
      if sqlerrm <> 'rollback 086 proof' then raise; end if;
  end;
end $$;


do $$
begin
  raise notice '086 OK: a live class in the LMS IS the timetabled class, so the two cannot '
               'disagree about when it is';
  raise notice '086 OK: attendance counts late as attended and excludes the excused, and a '
               'student sees only their own';
  raise notice '086 OK: a course is searchable to its transcripts, and only by the people on it';
  raise notice '086 OK: the tutor cites a real lesson, refuses in writing, and its conversation '
               'is the student''s own';
end $$;
