-- ===========================================================================
-- 087 — PROGRESS WITHOUT SURVEILLANCE, STUDY MODE, AND SEARCHING EVERYTHING
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- ONE DOOR CLOSES AND FIVE THINGS ARE ADDED.
--
-- THE DOOR: A LECTURER STOPS BEING ABLE TO READ HOW LONG EACH STUDENT SPENT
-- ON EACH LESSON, AND WHEN. 084 gave them `lesson_progress` whole, which
-- includes `seconds_spent`, `last_position_seconds`, `started_at` and
-- `updated_at` — a per-second record of one person's study habits, timestamped.
--
-- The University's ruling, September 2026: "don't turn it into creepy
-- surveillance. The lecturer should see useful academic indicators, not
-- unnecessary personal analytics."
--
-- AND A POLICY CANNOT DO THIS, which is the same wall 085 hit over the answer
-- key: row-level security is ROW-level and cannot hide a column. There is no
-- policy that says "the lecturer may read this row's state but not its
-- seconds". So the lecturer's table-level read is taken away entirely and
-- replaced with a VIEW that has no such column to expose — items, completions,
-- a percentage, and the DATE of last activity rather than the moment of it.
--
-- What a lecturer needs to teach is "four students have not opened Module 3".
-- What they do not need is "this student read Lesson 2 at 03:14 for eleven
-- minutes", and the difference is not a matter of trust. It is a matter of the
-- column not being there.
--
-- THE FIVE ADDITIONS:
--
--   1. MODULE AND COURSE PROGRESS as a figure, counted from meaningful events.
--   2. MODULES THAT UNLOCK IN ORDER, so "Module 4 — Locked" means something.
--   3. HIGHLIGHTS: a private note anchored to the passage it is about.
--   4. STUDY MODE on the tutor, recorded on the conversation.
--   5. SEARCH that reaches announcements, assignments and discussions, not
--      only lessons.
--
-- ---------------------------------------------------------------------------
-- WHAT COUNTS AS PROGRESS, AND WHAT MUST NOT
-- ---------------------------------------------------------------------------
--
-- The University: "Don't measure only: 7 files downloaded. That's a terrible
-- LMS metric."
--
-- It is, and it is terrible in a specific way: it can be satisfied without
-- learning anything. A student who clicks every lesson and reads none of them
-- is 100% complete, and the bar has then told them they are finished.
--
-- So the denominator is every piece of work in the module — its lessons AND
-- its activities — and the numerator counts only things a person had to DO:
--
--   · a lesson the student marked complete (not merely opened);
--   · a quiz or knowledge check with a submitted attempt;
--   · an assignment handed in;
--   · a discussion the student actually posted in.
--
-- OPENING SOMETHING IS NOT PROGRESS. `lesson_progress.state` distinguishes
-- 'started' from 'completed' precisely so that this view can refuse to count
-- the first, and the proof at the foot of the file opens a lesson without
-- completing it and asserts the percentage does not move.
-- ===========================================================================


-- ===========================================================================
-- 1. MODULES THAT UNLOCK IN ORDER
-- ===========================================================================

alter table course_modules
  add column if not exists unlocks_after uuid references course_modules(id) on delete set null;

comment on column course_modules.unlocks_after is
  'The module that must be finished before this one opens. Null means this module is open to '
  'anyone on the course as soon as it is visible. A chain, not a graph: one predecessor.';

-- A MODULE CANNOT UNLOCK AFTER ITSELF, which is a module nobody ever reaches.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'course_modules_unlocks_after_another') then
    alter table course_modules
      add constraint course_modules_unlocks_after_another
      check (unlocks_after is null or unlocks_after <> id) not valid;
    alter table course_modules validate constraint course_modules_unlocks_after_another;
  end if;
end $$;


-- ===========================================================================
-- 2. COUNTING PROGRESS
-- ===========================================================================
--
-- ONE DEFINITION, IN SQL, USED BY EVERY SCREEN. The University's rule about
-- attendance applies here word for word: two screens counting the same thing
-- is two percentages, and a student will quote whichever is higher.

-- ---------------------------------------------------------------------------
-- EVERY PIECE OF WORK IN A MODULE, and whether a given student has done it.
--
-- NOT A VIEW A STUDENT SELECTS FROM DIRECTLY — it takes a student id, so it
-- would answer about anybody. It is the shared arithmetic; the views below put
-- the fences round it.
-- ---------------------------------------------------------------------------
create or replace function module_items_done(the_module uuid, the_student uuid)
returns table (items bigint, done bigint)
language sql
stable
security definer
set search_path = public
as $$
  with work as (
    -- THE LESSONS.
    select l.id as item, 'lesson' as sort,
           exists (select 1 from lesson_progress p
                    where p.lesson_id = l.id
                      and p.student_id = the_student
                      -- OPENED IS NOT DONE.
                      and p.state = 'completed') as finished
      from course_lessons l
     where l.module_id = the_module and l.visible
    union all
    -- THE ACTIVITIES.
    select a.id, 'activity',
           case when a.kind = 'discussion' then
             -- PARTICIPATION IS POSTING. Reading a discussion is not joining
             -- one, and a metric that counted it would be back to measuring
             -- downloads.
             exists (select 1 from discussion_posts d
                      join students s on s.id = the_student
                      where d.activity_id = a.id
                        and d.author_id = s.auth_user_id
                        and d.hidden_at is null)
           else
             exists (select 1 from activity_submissions sub
                      where sub.activity_id = a.id
                        and sub.student_id = the_student
                        -- A DRAFT IS NOT A SUBMISSION.
                        and sub.state in ('submitted', 'graded', 'returned'))
           end
      from course_activities a
     where a.module_id = the_module and a.visible
  )
  select count(*)::bigint, count(*) filter (where finished)::bigint from work;
$$;

comment on function module_items_done(uuid, uuid) is
  'How many pieces of work a module holds and how many this student has finished. Opening a '
  'lesson is not finishing it; a draft is not a submission; reading a discussion is not '
  'joining one.';

revoke all on function module_items_done(uuid, uuid) from public;
grant execute on function module_items_done(uuid, uuid) to authenticated, service_role;


-- ---------------------------------------------------------------------------
-- IS THIS MODULE OPEN TO THIS STUDENT YET?
--
-- The predecessor must be FINISHED — every item of it — not merely started.
-- A module with no predecessor is open.
-- ---------------------------------------------------------------------------
create or replace function module_is_unlocked(the_module uuid, the_student uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  prior uuid;
  n record;
begin
  select unlocks_after into prior from course_modules where id = the_module;
  if prior is null then return true; end if;
  select * into n from module_items_done(prior, the_student);
  -- A PREDECESSOR WITH NOTHING IN IT DOES NOT BLOCK ANYTHING. An empty module
  -- can never be finished, and a chain behind one would lock the rest of the
  -- course with no way for the student to tell why.
  if n.items = 0 then return true; end if;
  return n.done >= n.items;
end $$;

comment on function module_is_unlocked(uuid, uuid) is
  'Whether this student has finished the module this one unlocks after. An empty predecessor '
  'does not block: it can never be finished, and would lock the rest of the course silently.';

revoke all on function module_is_unlocked(uuid, uuid) from public;
grant execute on function module_is_unlocked(uuid, uuid) to authenticated, service_role;


-- ---------------------------------------------------------------------------
-- AND A LOCKED MODULE'S LESSONS ARE NOT READABLE.
--
-- THE MODULE ITSELF STILL IS, deliberately. The University's sketch shows
-- "Module 4 — Locked" on the page: a student should see that the module exists
-- and that they have not reached it, which is information. What they should
-- not have is its contents.
--
-- 084's policy is replaced rather than added to, so there remains ONE answer
-- to "who may read a lesson".
-- ---------------------------------------------------------------------------
drop policy if exists course_lessons_read on course_lessons;
create policy course_lessons_read on course_lessons
  for select using (
    (visible
      and is_enrolled_on_course(course_id)
      and module_is_open(module_id)
      and module_is_unlocked(module_id,
            (select id from students where auth_user_id = auth.uid())))
    or may_curate_course(course_id)
  );


-- ---------------------------------------------------------------------------
-- WHAT THE STUDENT SEES OF THEIR OWN PROGRESS.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- DROPPED IN DEPENDENCY ORDER, AND THE SECOND RUN IS WHAT FOUND THIS.
--
-- `my_course_progress` is built on `my_module_progress`, so dropping the
-- module view first fails with "cannot drop ... because other objects depend
-- on it" — on the SECOND run, never the first. A migration that is correct
-- once and refuses afterwards is the worst kind to ship: it lands cleanly, and
-- breaks for whoever re-runs the bundle.
--
-- NOT `cascade`, which would silently drop whatever else had come to depend on
-- these views and report success.
-- ---------------------------------------------------------------------------
drop view if exists my_course_progress;
drop view if exists my_module_progress;
create view my_module_progress as
  select
    s.id            as student_id,
    m.course_id,
    m.id            as module_id,
    m.title         as module_title,
    m.sort_order,
    m.unlocks_after,
    module_is_unlocked(m.id, s.id) as unlocked,
    n.items,
    n.done,
    case when n.items = 0 then null
         else round(100.0 * n.done / n.items, 0) end as percent
  from course_modules m
  join students s on s.auth_user_id = auth.uid()
  cross join lateral module_items_done(m.id, s.id) n
  where m.visible
    and (m.opens_on is null or m.opens_on <= current_date)
    and is_enrolled_on_course(m.course_id);

grant select on my_module_progress to authenticated;

create view my_course_progress as
  select
    student_id,
    course_id,
    count(*)                       as modules,
    count(*) filter (where percent = 100) as modules_complete,
    sum(items)                     as items,
    sum(done)                      as done,
    case when sum(items) = 0 then null
         else round(100.0 * sum(done) / sum(items), 0) end as percent
  from my_module_progress
  group by student_id, course_id;

grant select on my_course_progress to authenticated;

comment on view my_course_progress is
  'The signed-in student''s progress through each course, counted over every piece of work in '
  'every open module. Weighted by items rather than by module, so a module with one lesson does '
  'not count as much as a module with twelve.';


-- ===========================================================================
-- 3. WHAT A LECTURER MAY SEE, AND WHAT THEY MAY NOT
-- ===========================================================================
--
-- THE POLICY GOES. 084 gave the lecturer `lesson_progress` whole so that the
-- early-warning screen could work, and `lesson_progress` carries seconds and
-- timestamps. The requirement is academic indicators without personal
-- analytics, and no policy can deliver that because no policy can hide a
-- column — so the table-level read is withdrawn and replaced.

drop policy if exists lesson_progress_teacher_read on lesson_progress;

-- ---------------------------------------------------------------------------
-- WHAT REPLACES IT.
--
-- Counts, a percentage, and a DATE. Not `updated_at`, not `seconds_spent`, not
-- `last_position_seconds` — there is no column here that could carry them, so
-- the guarantee does not depend on anybody remembering.
--
-- A DATE AND NOT A TIMESTAMP, and that is the whole distinction in one line:
-- "has not touched this course in three weeks" is an academic indicator a
-- tutor should act on. "Was reading at 03:14" is not, and the difference is
-- the precision.
-- ---------------------------------------------------------------------------
drop view if exists course_progress_for_teaching;
create view course_progress_for_teaching as
  select
    s.id            as student_id,
    s.matric_no,
    s.first_name,
    s.last_name,
    m.course_id,
    m.id            as module_id,
    m.title         as module_title,
    n.items,
    n.done,
    case when n.items = 0 then null
         else round(100.0 * n.done / n.items, 0) end as percent,
    (select max(p.updated_at)::date
       from lesson_progress p
       join course_lessons l on l.id = p.lesson_id
      where p.student_id = s.id and l.module_id = m.id) as last_active_on
  from course_modules m
  join enrollments e on e.course_id = m.course_id and e.status in ('registered', 'completed')
  join students s on s.id = e.student_id
  cross join lateral module_items_done(m.id, s.id) n
  where may_curate_course(m.course_id);

grant select on course_progress_for_teaching to authenticated;

comment on view course_progress_for_teaching is
  'What a lecturer may see of their own students'' progress: how much of each module is done, '
  'and the DATE of last activity. Deliberately carries no seconds_spent and no timestamp — the '
  'University ruled against personal analytics, and a policy cannot hide a column, so the '
  'column is not here.';


-- ===========================================================================
-- 4. HIGHLIGHTS
-- ===========================================================================
--
-- "Students should be able to: Bookmark, Highlight, Add private note."
--
-- A HIGHLIGHT IS A NOTE WITH A PASSAGE, not a fourth table. The thing a
-- student wants is "this sentence, and what I thought about it", and splitting
-- them means a highlight cannot become a note when the student types.

alter table student_notes
  add column if not exists quote text,
  add column if not exists anchor text;

comment on column student_notes.quote is
  'The passage the note is about, copied at the time. COPIED, not referenced: a lecturer may '
  'edit the lesson afterwards, and a highlight that silently moved to different words would be '
  'worse than one that did not move at all.';
comment on column student_notes.anchor is
  'Where in the lesson the passage was — a character offset, a timestamp in an audio lecture, a '
  'page in a document. Free text because those are not the same kind of thing.';

-- A HIGHLIGHT WITH NOTHING WRITTEN ON IT IS STILL A HIGHLIGHT, so `body` must
-- now be allowed to be empty when there is a quote. 084 required a body.
do $$
begin
  if exists (select 1 from pg_constraint
              where conrelid = 'student_notes'::regclass
                and conname = 'student_notes_body_check') then
    alter table student_notes drop constraint student_notes_body_check;
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'student_notes_says_something') then
    alter table student_notes
      add constraint student_notes_says_something
      check (length(btrim(coalesce(body, ''))) between 0 and 20000
             and (length(btrim(coalesce(body, ''))) >= 1
                  or length(btrim(coalesce(quote, ''))) >= 1)) not valid;
    alter table student_notes validate constraint student_notes_says_something;
  end if;
end $$;

alter table student_notes alter column body drop not null;


-- ===========================================================================
-- 5. STUDY MODE
-- ===========================================================================
--
-- The University: "Student: 'Give me the answer to question 4.' AI: 'I'll help
-- you work through the question. First, what do you understand by…?' That
-- makes it a learning assistant rather than a cheating engine."
--
-- RECORDED ON THE CONVERSATION, not decided per answer. A mode that could
-- change between one message and the next is a mode a student can talk their
-- way out of — and the transcript would then show a conversation that was in
-- study mode for the questions nobody minded and in answer mode for the one
-- that mattered.

alter table tutor_conversations
  add column if not exists mode text not null default 'study';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tutor_conversations_mode_is_known') then
    alter table tutor_conversations
      add constraint tutor_conversations_mode_is_known
      check (mode in ('study', 'explain')) not valid;
    alter table tutor_conversations validate constraint tutor_conversations_mode_is_known;
  end if;
end $$;

comment on column tutor_conversations.mode is
  'study  — works the student through it: asks what they understand first, never hands over an '
  'answer to marked work. The DEFAULT, because the default is what most conversations will be. '
  'explain — explains a concept from the course materials outright. Neither ever answers a '
  'graded assignment; that refusal is recorded on the message.';


-- ===========================================================================
-- 6. SEARCHING EVERYTHING, NOT ONLY LESSONS
-- ===========================================================================
--
-- "It searches: lessons, PDFs, transcripts, lecture notes, announcements,
-- assignments, discussions."
--
-- 086 searched lessons and their transcripts. This adds the other three, and
-- each one repeats the enrolment rule for itself — a view runs as its owner,
-- so nothing underneath protects it.

drop view if exists course_content_search;
create view course_content_search as
  -- ---- LESSONS, READINGS, TRANSCRIPTS ------------------------------------
  select
    'lesson'::text as source,
    les.id         as item_id,
    les.course_id,
    m.id           as module_id,
    m.title        as module_title,
    c.code         as course_code,
    les.kind,
    les.title,
    les.summary    as excerpt,
    les.requirement,
    (les.transcript is not null and length(btrim(les.transcript)) > 0) as has_transcript,
    to_tsvector('english',
      coalesce(les.title,'') || ' ' || coalesce(les.summary,'') || ' ' ||
      coalesce(les.body,'') || ' ' || coalesce(les.transcript,'') || ' ' ||
      coalesce(les.citation,'') || ' ' || coalesce(les.author,'')) as document
  from course_lessons les
  join course_modules m on m.id = les.module_id
  join courses c on c.id = les.course_id
  where (les.visible and m.visible
           and (m.opens_on is null or m.opens_on <= current_date)
           and is_enrolled_on_course(les.course_id))
     or may_curate_course(les.course_id)

  union all

  -- ---- ASSIGNMENTS, QUIZZES AND DISCUSSION TOPICS ------------------------
  select
    'activity', a.id, a.course_id, a.module_id, m.title, c.code,
    a.kind, a.title,
    left(coalesce(a.instructions, ''), 300),
    null, false,
    to_tsvector('english',
      coalesce(a.title,'') || ' ' || coalesce(a.instructions,'') || ' ' ||
      coalesce(a.learning_objective,''))
  from course_activities a
  left join course_modules m on m.id = a.module_id
  join courses c on c.id = a.course_id
  where (a.visible and is_enrolled_on_course(a.course_id)
           and (a.opens_at is null or a.opens_at <= now()))
     or may_curate_course(a.course_id)

  union all

  -- ---- WHAT WAS SAID IN A DISCUSSION -------------------------------------
  --
  -- A student searching "hermeneutics" should find the thread where it was
  -- argued about, which is often where the best explanation in a course is.
  select
    'discussion', d.id, d.course_id, a.module_id, m.title, c.code,
    'post', a.title, left(d.body, 300), null, false,
    to_tsvector('english', coalesce(d.body,''))
  from discussion_posts d
  join course_activities a on a.id = d.activity_id
  left join course_modules m on m.id = a.module_id
  join courses c on c.id = d.course_id
  where d.hidden_at is null
    and (is_enrolled_on_course(d.course_id) or may_curate_course(d.course_id))

  union all

  -- ---- COURSE ANNOUNCEMENTS AND NOTES ------------------------------------
  --
  -- 068's `course_materials`, which is where a course announcement lives.
  select
    'material', mat.id, mat.course_id, null, null, c.code,
    mat.kind, mat.title, left(coalesce(mat.body, ''), 300), null, false,
    to_tsvector('english', coalesce(mat.title,'') || ' ' || coalesce(mat.body,''))
  from course_materials mat
  join courses c on c.id = mat.course_id
  where (mat.visible and is_enrolled_on_course(mat.course_id))
     or may_curate_course(mat.course_id);

grant select on course_content_search to authenticated;

comment on view course_content_search is
  'Everything searchable in the courses the signed-in person is on or teaches: lessons and '
  'their transcripts, assignments and quizzes, what was said in discussions, and course '
  'announcements. Every branch repeats the enrolment rule because a view runs as its owner.';


-- ===========================================================================
-- 7. REFLECTION
-- ===========================================================================
--
-- The University's activity layer names one kind 085 did not have. A
-- reflection is handed in like an assignment and is not marked out of
-- anything — the point of it is that it was written, not that it was right.

do $$
begin
  if exists (select 1 from pg_constraint
              where conrelid = 'course_activities'::regclass
                and conname = 'course_activities_kind_check') then
    alter table course_activities drop constraint course_activities_kind_check;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'course_activities_kind_is_known') then
    alter table course_activities
      add constraint course_activities_kind_is_known
      check (kind in ('assignment', 'quiz', 'knowledge_check', 'discussion', 'reflection'))
      not valid;
    alter table course_activities validate constraint course_activities_kind_is_known;
  end if;
end $$;


-- ===========================================================================
-- PROVE IT, AND ROLL IT BACK
-- ===========================================================================

do $$
declare
  lect_user uuid := gen_random_uuid();
  in_user   uuid := gen_random_uuid();
  lect_id   uuid;
  the_course uuid;
  mine      uuid;
  mod1      uuid;
  mod2      uuid;
  les1      uuid;
  les2      uuid;
  quiz1     uuid;
  pct       numeric;
  seen      integer;
  cols      integer;
begin
  begin
    insert into auth.users (id, email) values
      (lect_user, '087-lecturer@example.test'),
      (in_user,   '087-student@example.test');
    insert into profiles (id, email, role) values
      (lect_user, '087-lecturer@example.test', 'lecturer'),
      (in_user,   '087-student@example.test',  'student')
    on conflict (id) do update set role = excluded.role;

    insert into lecturers (staff_id, first_name, last_name, auth_user_id)
      values ('ICOFSTF-9087', 'Proof', 'Lecturer', lect_user) returning id into lect_id;
    insert into courses (code, title, lecturer_id)
      values ('ZZZ 9087', 'A Course Written By The 087 Proof', lect_id)
      returning id into the_course;
    insert into students (matric_no, first_name, last_name, status, auth_user_id)
      values ('087/PROOF', 'Works', 'ThroughIt', 'enrolled', in_user) returning id into mine;
    insert into enrollments (student_id, course_id, status)
      values (mine, the_course, 'registered');

    -- MODULE 1: one lesson and one quiz. MODULE 2: unlocks after module 1.
    insert into course_modules (course_id, title, visible, sort_order)
      values (the_course, 'Module 1', true, 1) returning id into mod1;
    insert into course_modules (course_id, title, visible, sort_order, unlocks_after)
      values (the_course, 'Module 2', true, 2, mod1) returning id into mod2;

    insert into course_lessons (module_id, course_id, kind, title, body, visible)
      values (mod1, the_course, 'text', 'Lesson one', 'Body.', true) returning id into les1;
    insert into course_activities (course_id, module_id, kind, title, graded, points, visible)
      values (the_course, mod1, 'quiz', 'Quiz one', true, 10, true) returning id into quiz1;
    insert into course_lessons (module_id, course_id, kind, title, body, visible)
      values (mod2, the_course, 'text', 'Lesson two', 'Body.', true) returning id into les2;

    -- ---- A MODULE CANNOT UNLOCK AFTER ITSELF ------------------------------
    begin
      update course_modules set unlocks_after = mod1 where id = mod1;
      raise exception '087 FAILED: a module unlocks after itself, so nobody ever reaches it';
    exception
      when check_violation then null;
    end;

    -- ---- A REFLECTION IS NOW A KIND --------------------------------------
    insert into course_activities (course_id, module_id, kind, title, visible)
      values (the_course, mod1, 'reflection', 'A reflection', true);
    -- ...and an invented kind still is not.
    begin
      insert into course_activities (course_id, module_id, kind, title, visible)
        values (the_course, mod1, 'homework', 'Not a kind this University has', true);
      raise exception '087 FAILED: an unrecognised activity kind was accepted';
    exception
      when check_violation then null;
    end;

    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', in_user);

    -- ---- NOTHING DONE YET -------------------------------------------------
    select percent into pct from my_module_progress where module_id = mod1;
    if pct is distinct from 0 then
      raise exception '087 FAILED: a module with nothing done reports % per cent, not 0', pct;
    end if;

    -- ---- MODULE 2 IS LOCKED, AND ITS LESSON UNREADABLE --------------------
    select count(*) into seen from my_module_progress where module_id = mod2 and unlocked;
    if seen <> 0 then
      raise exception '087 FAILED: module 2 is unlocked before module 1 is finished';
    end if;
    select count(*) into seen from course_lessons where id = les2;
    if seen <> 0 then
      raise exception '087 FAILED: a student can read the lessons of a locked module';
    end if;
    -- BUT THE MODULE ITSELF IS VISIBLE. "Module 4 — Locked" is information.
    select count(*) into seen from course_modules where id = mod2;
    if seen <> 1 then
      raise exception '087 FAILED: a locked module is hidden entirely, so a student cannot see '
                      'that there is more course ahead of them';
    end if;

    -- ---- OPENING A LESSON IS NOT FINISHING IT -----------------------------
    --
    -- The assertion the whole progress model rests on. A bar that fills by
    -- clicking tells a student they are finished.
    insert into lesson_progress (lesson_id, student_id, state)
      values (les1, mine, 'started');
    select percent into pct from my_module_progress where module_id = mod1;
    if pct is distinct from 0 then
      raise exception '087 FAILED: opening a lesson moved the progress bar to % per cent — the '
                      'metric can be satisfied by clicking', pct;
    end if;

    -- ---- COMPLETING IT DOES --------------------------------------------
    --
    -- Three items in module 1: the lesson, the quiz and the reflection.
    update lesson_progress set state = 'completed', completed_at = now()
     where lesson_id = les1 and student_id = mine;
    select percent into pct from my_module_progress where module_id = mod1;
    if pct is distinct from 33 then
      raise exception '087 FAILED: one of three items finished reports % per cent, not 33', pct;
    end if;

    -- ---- AND A DRAFT SUBMISSION IS NOT A SUBMISSION -----------------------
    insert into activity_submissions (activity_id, student_id, state)
      values (quiz1, mine, 'draft');
    select percent into pct from my_module_progress where module_id = mod1;
    if pct is distinct from 33 then
      raise exception '087 FAILED: an unsubmitted draft counted as work done (% per cent)', pct;
    end if;

    update activity_submissions set state = 'submitted', submitted_at = now()
     where activity_id = quiz1 and student_id = mine;
    select percent into pct from my_module_progress where module_id = mod1;
    if pct is distinct from 67 then
      raise exception '087 FAILED: two of three items finished reports % per cent, not 67', pct;
    end if;

    -- ---- A HIGHLIGHT WITH NO WORDS ON IT IS STILL A HIGHLIGHT -------------
    insert into student_notes (student_id, course_id, lesson_id, quote, anchor)
      values (mine, the_course, les1, 'The passage that mattered.', 'offset:412');
    -- ...but a note with neither words nor a passage is nothing at all.
    begin
      insert into student_notes (student_id, course_id, lesson_id)
        values (mine, the_course, les1);
      raise exception '087 FAILED: a note with no body and no highlighted passage was accepted';
    exception
      when check_violation then null;
    end;

    -- ---- STUDY MODE IS THE DEFAULT ---------------------------------------
    reset role;
    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', in_user);
    insert into tutor_conversations (student_id, course_id) values (mine, the_course);
    select count(*) into seen from tutor_conversations
     where student_id = mine and mode = 'study';
    if seen <> 1 then
      raise exception '087 FAILED: a tutor conversation did not default to study mode, so the '
                      'safe behaviour is the one somebody has to remember to ask for';
    end if;

    -- ---- SEARCH REACHES THE DISCUSSION AND THE ASSIGNMENT -----------------
    reset role;
    insert into course_activities (course_id, module_id, kind, title, instructions, visible)
      values (the_course, mod1, 'discussion', 'Can theology be separated from context?',
              'Post your response.', true);
    insert into discussion_posts (activity_id, course_id, author_id, body)
      select id, the_course, in_user, 'My answer turns on hermeneutics, properly understood.'
        from course_activities where title = 'Can theology be separated from context?';

    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', in_user);
    select count(*) into seen from course_content_search
     where course_id = the_course and source = 'discussion'
       and document @@ plainto_tsquery('english', 'hermeneutics');
    if seen <> 1 then
      raise exception '087 FAILED: a word argued about in a discussion cannot be searched for';
    end if;

    reset role;

    -- =====================================================================
    -- AND THE SURVEILLANCE THE UNIVERSITY RULED AGAINST
    -- =====================================================================
    --
    -- Two assertions, because one is not enough. The lecturer must not be able
    -- to read the seconds — AND the view they are given must not have a column
    -- that could carry them, so the guarantee does not rest on the policy
    -- being written correctly next time.
    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', lect_user);

    select count(*) into seen from lesson_progress where student_id = mine;
    if seen <> 0 then
      raise exception '087 FAILED: the lecturer still reads lesson_progress, which carries '
                      'seconds_spent and a timestamp for every lesson this student opened';
    end if;

    -- BUT THEY CAN STILL TEACH. A rule that also refuses the people who need
    -- it is not a tighter rule, it is a broken screen.
    --
    -- 75, AND THE ARITHMETIC IS WORTH FOLLOWING because this assertion caught
    -- its own author. Module 1 now holds FOUR items — the lesson, the quiz,
    -- the reflection, and the discussion added for the search test above — and
    -- the student has finished three of them: the lesson completed, the quiz
    -- submitted, and the discussion POSTED IN. So this doubles as the proof
    -- that taking part in a discussion counts as work done, and that the
    -- reflection nobody has written counts as work outstanding.
    select percent into pct from course_progress_for_teaching
     where student_id = mine and module_id = mod1;
    if pct is distinct from 75 then
      raise exception '087 FAILED: the lecturer cannot see how far their own student has got '
                      '(read % per cent, expected 75 — three of four items)', pct;
    end if;

    -- AND THE STUDENT'S OWN FIGURE IS THE SAME FIGURE. Two screens counting
    -- the same thing is two percentages, and a student will quote whichever is
    -- higher.
    execute format('set local request.jwt.claim.sub = %L', in_user);
    select percent into pct from my_module_progress where module_id = mod1;
    if pct is distinct from 75 then
      raise exception '087 FAILED: the student sees % per cent where the lecturer sees 75 — '
                      'the two screens are counting differently', pct;
    end if;

    reset role;

    select count(*) into cols from information_schema.columns
     where table_name = 'course_progress_for_teaching'
       and column_name in ('seconds_spent', 'last_position_seconds', 'started_at', 'updated_at');
    if cols <> 0 then
      raise exception '087 FAILED: the lecturer''s progress view carries % personal-analytics '
                      'column(s) — the University ruled against them, and a policy cannot hide '
                      'a column', cols;
    end if;

    raise exception 'rollback 087 proof';
  exception
    when others then
      reset role;
      if sqlerrm <> 'rollback 087 proof' then raise; end if;
  end;
end $$;


do $$
begin
  raise notice '087 OK: progress counts work done, not files opened — a lesson merely started '
               'does not move the bar, and neither does an unsubmitted draft';
  raise notice '087 OK: modules unlock in order, and a locked one is visible while its lessons '
               'are not';
  raise notice '087 OK: a lecturer sees how far a student has got and no longer sees how long '
               'they spent or when — the view has no such column';
  raise notice '087 OK: highlights, study mode by default, and search that reaches discussions, '
               'assignments and announcements';
end $$;
