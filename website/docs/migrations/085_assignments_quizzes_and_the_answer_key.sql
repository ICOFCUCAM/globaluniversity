-- ===========================================================================
-- 085 — ASSIGNMENTS, QUIZZES, KNOWLEDGE CHECKS, AND THE ANSWER KEY
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- NOTHING IS DELETED AND NOTHING IS REFUSED that was permitted before. A
-- course gains the things a student DOES — an assignment to hand in, a quiz to
-- sit, a quick check after a lecture, a discussion to join — and a lecturer
-- gains somewhere to mark them and write feedback.
--
-- Nothing is seeded. No assignment is invented for any course.
--
-- ---------------------------------------------------------------------------
-- THE ONE DECISION THIS FILE IS REALLY ABOUT
-- ---------------------------------------------------------------------------
--
-- A QUIZ'S CORRECT ANSWERS MUST NEVER REACH THE BROWSER.
--
-- This is easy to get wrong and impossible to fix afterwards. The obvious
-- shape is `activity_options (id, question_id, label, is_correct)` with a
-- policy admitting the enrolled student — and row-level security is
-- ROW-level. A policy cannot hide a column. So the student's own browser
-- receives `is_correct` on every option of every question, and the quiz is
-- decorative: the answers are two keystrokes away in the network tab.
--
-- The University's own rule about this system, written after a screen was
-- found deciding something the database should have: a screen is a
-- convenience, a policy is the rule. There is no policy that hides a column.
--
-- So the key lives in its own table. `activity_options` carries what a student
-- must see to answer — the label and its order. `activity_answer_key` carries
-- which option is right and why, and NO student policy admits it at all: it is
-- readable by the people who set the paper and by the service key that marks
-- it. A student's answers are graded on the server, against a table their
-- session cannot read, and what comes back is a score and an explanation.
--
-- The proof at the foot of this file sits a student down and watches them fail
-- to read the answers.
--
-- ---------------------------------------------------------------------------
-- AND WHY A KNOWLEDGE CHECK IS THE SAME THING AS A QUIZ
-- ---------------------------------------------------------------------------
--
-- The University asked for "quizzes and non-graded knowledge checks". They
-- differ in one boolean — whether the score counts — and in nothing else: both
-- have questions, options, attempts and answers. Two tables would be the same
-- table twice, and the second copy is where the answer key gets left readable.
-- ===========================================================================


-- ===========================================================================
-- 1. ACTIVITIES — THE THINGS A STUDENT DOES
-- ===========================================================================
--
-- ATTACHED TO A LESSON OR STANDING ON ITS OWN. The University's sketch of a
-- lesson ends "After watching — Quick check", so an activity may name the
-- lesson it follows; a coursework essay names no lesson and belongs to the
-- module or the course.

create table if not exists course_activities (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references courses(id) on delete cascade,
  module_id    uuid references course_modules(id) on delete cascade,
  lesson_id    uuid references course_lessons(id) on delete set null,

  kind         text not null check (kind in (
                 'assignment',       -- handed in, marked by a person
                 'quiz',             -- marked by the system, counts
                 'knowledge_check',  -- marked by the system, does not count
                 'discussion'        -- a conversation, not a submission
               )),

  title        text not null check (length(btrim(title)) between 1 and 300),
  instructions text,
  learning_objective text,

  -- ---- DOES IT COUNT? ----------------------------------------------------
  --
  -- The whole difference between a quiz and a knowledge check, and it is
  -- CONSTRAINED rather than left to the screen: a knowledge check carrying
  -- marks is a knowledge check that counts, which is not what the student was
  -- told when they sat it.
  graded       boolean not null default false,
  points       numeric(6,2) check (points is null or points >= 0),
  weight_percent numeric(5,2) check (weight_percent is null
                                     or (weight_percent >= 0 and weight_percent <= 100)),

  opens_at     timestamptz,
  due_at       timestamptz,
  closes_at    timestamptz,
  allow_late   boolean not null default false,
  attempts_allowed integer not null default 1 check (attempts_allowed >= 1),

  -- ---- WHAT MAY BE HANDED IN --------------------------------------------
  --
  -- "Submission type: ☑ PDF ☑ DOCX ☑ Text ☑ Link". A lecturer who asks for an
  -- essay as a PDF and receives a link to a document nobody outside one
  -- account can open has not received the essay.
  --
  -- EMPTY MEANS THE LECTURER HAS NOT SAID, which is not the same as "anything
  -- goes" — the upload screen asks before it accepts. An assignment is the
  -- only kind this applies to; a quiz is answered, not handed in.
  submission_types text[] not null default '{}',

  visible      boolean not null default false,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- ONLY THE FOUR THE UNIVERSITY NAMED. An unrecognised word here is an
  -- upload screen that silently offers nothing.
  constraint course_activities_submission_types_are_known
    check (submission_types <@ array['pdf', 'docx', 'text', 'link']::text[]),

  constraint course_activities_check_is_not_graded
    check (kind <> 'knowledge_check' or graded = false),
  -- A DISCUSSION IS NOT HANDED IN. Attempts and a due date on one are a sign
  -- the kind was chosen by accident.
  constraint course_activities_discussion_is_not_marked
    check (kind <> 'discussion' or (graded = false and points is null)),
  -- CLOSING BEFORE IT OPENS is a window nobody can use, and the screen that
  -- would have to notice is the screen nobody tests.
  constraint course_activities_window_makes_sense
    check (closes_at is null or opens_at is null or closes_at >= opens_at)
);

create index if not exists course_activities_by_course on course_activities (course_id);
create index if not exists course_activities_by_module on course_activities (module_id);
create index if not exists course_activities_by_lesson on course_activities (lesson_id)
  where lesson_id is not null;

-- THE SAME KEY 084 PUT ON A MODULE, and for the same reason: a question's
-- (activity_id, course_id) will be a composite foreign key into this, so the
-- course on a question cannot disagree with the course on its activity.
create unique index if not exists course_activities_id_course_idx
  on course_activities (id, course_id);


-- ===========================================================================
-- 2. QUESTIONS, AND THE OPTIONS A STUDENT MAY SEE
-- ===========================================================================

create table if not exists activity_questions (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references course_activities(id) on delete cascade,
  -- Denormalised and unable to lie — see the composite key below.
  course_id    uuid not null references courses(id) on delete cascade,

  kind         text not null check (kind in (
                 'single_choice', 'multiple_choice', 'true_false',
                 'short_answer', 'essay'
               )),
  prompt       text not null check (length(btrim(prompt)) >= 1),
  points       numeric(6,2) not null default 1 check (points >= 0),
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),

  constraint activity_questions_activity_agrees
    foreign key (activity_id, course_id)
    references course_activities (id, course_id) on delete cascade
);

create index if not exists activity_questions_by_activity
  on activity_questions (activity_id, sort_order);

-- ---------------------------------------------------------------------------
-- WHAT THE STUDENT SEES. A label and its place in the list.
--
-- THERE IS NO `is_correct` HERE, AND THAT IS THE POINT OF THE FILE. It is in
-- `activity_answer_key`, which no student policy admits.
-- ---------------------------------------------------------------------------
create table if not exists activity_options (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references activity_questions(id) on delete cascade,
  label        text not null check (length(btrim(label)) >= 1),
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists activity_options_by_question
  on activity_options (question_id, sort_order);

-- ---------------------------------------------------------------------------
-- WHAT THE STUDENT MUST NOT SEE.
--
-- One row per option, saying whether it is the right one, plus the expected
-- answer for a written question and the explanation shown AFTER marking.
--
-- ONE TABLE FOR ALL THREE because they are one secret. An explanation reading
-- "because the Council of Nicaea met in 325, not 381" gives the answer away as
-- completely as a boolean does, and a design that protected the boolean and
-- served the explanation would feel careful and be useless.
-- ---------------------------------------------------------------------------
create table if not exists activity_answer_key (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references activity_questions(id) on delete cascade,
  option_id    uuid references activity_options(id) on delete cascade,

  is_correct   boolean not null default false,
  -- For short answers: what counts as right. Compared case-insensitively and
  -- trimmed by the marking route; a human still reviews an essay.
  expected     text,
  explanation  text,

  -- ---- "REVIEW MODULE 2, LESSON 3 BEFORE CONTINUING" ---------------------
  --
  -- The University's own example of what a knowledge check should say when a
  -- student gets it wrong. It is the difference between an assessment and a
  -- teaching tool: "Incorrect" tells a student they are lost, and a pointer
  -- back to the lesson tells them where to go.
  --
  -- A REAL LESSON, NOT A TYPED-IN REFERENCE. "Module 2, Lesson 3" as text is
  -- wrong the moment a lecturer inserts a lesson, and wrong silently.
  review_lesson_id uuid references course_lessons(id) on delete set null,

  created_at   timestamptz not null default now()
);

create unique index if not exists activity_answer_key_one_per_option_idx
  on activity_answer_key (option_id) where option_id is not null;
create index if not exists activity_answer_key_by_question
  on activity_answer_key (question_id);


-- ===========================================================================
-- 3. SUBMISSIONS, MARKS AND FEEDBACK
-- ===========================================================================

create table if not exists activity_submissions (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references course_activities(id) on delete cascade,
  student_id   uuid not null references students(id) on delete cascade,
  attempt_no   integer not null default 1 check (attempt_no >= 1),

  state        text not null default 'draft' check (state in (
                 'draft',      -- being written, the student's own
                 'submitted',  -- handed in
                 'graded',     -- marked, not yet released
                 'returned'    -- released to the student with feedback
               )),

  body         text,
  media_path   text,
  media_type   text,
  submitted_at timestamptz,
  late         boolean not null default false,

  score        numeric(6,2) check (score is null or score >= 0),
  -- "grades and lecturer feedback" — the University's list, and feedback is
  -- the half that is usually an afterthought. A mark with no words is a number
  -- a student cannot learn anything from.
  feedback     text,
  graded_by    uuid references auth.users(id),
  graded_at    timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- HANDED IN MEANS A MOMENT, for the same reason 084 required one of a
  -- completed lesson: a submission with no time cannot be shown to be late or
  -- on time, and lateness is the thing most often argued about.
  constraint activity_submissions_submitted_has_a_moment
    check ((state = 'draft') or (submitted_at is not null)),
  -- MARKED MEANS MARKED BY SOMEBODY, AT A TIME.
  constraint activity_submissions_graded_has_a_marker
    check ((state not in ('graded', 'returned'))
           or (graded_at is not null and score is not null))
);

create unique index if not exists activity_submissions_one_per_attempt_idx
  on activity_submissions (activity_id, student_id, attempt_no);
create index if not exists activity_submissions_by_student
  on activity_submissions (student_id);
create index if not exists activity_submissions_to_mark
  on activity_submissions (activity_id, state);

create table if not exists submission_answers (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references activity_submissions(id) on delete cascade,
  question_id   uuid not null references activity_questions(id) on delete cascade,
  option_id     uuid references activity_options(id) on delete set null,
  answer_text   text,
  -- WRITTEN BY THE MARKING ROUTE, never by the student's own session. The
  -- policy below lets a student write their answer and not their mark.
  is_correct    boolean,
  score         numeric(6,2),
  created_at    timestamptz not null default now()
);

create unique index if not exists submission_answers_one_per_question_idx
  on submission_answers (submission_id, question_id, coalesce(option_id, '00000000-0000-0000-0000-000000000000'::uuid));


-- ===========================================================================
-- 4. DISCUSSIONS
-- ===========================================================================
--
-- A COURSE DISCUSSION IS NOT THE UNIVERSITY FORUM. `forum_*` is the whole
-- institution talking; this is one class, and a post in it is readable by the
-- people on that course and their lecturer. Keeping them apart is the same
-- decision the University made about announcements: scope is the thing that
-- was missing, not the feature.

create table if not exists discussion_posts (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references course_activities(id) on delete cascade,
  course_id    uuid not null references courses(id) on delete cascade,
  reply_to     uuid references discussion_posts(id) on delete cascade,

  author_id    uuid not null references auth.users(id),
  body         text not null check (length(btrim(body)) between 1 and 20000),

  -- A lecturer's post in their own course is worth marking as such: a student
  -- reading six answers should know which one is the lecturer's.
  by_staff     boolean not null default false,
  edited_at    timestamptz,
  hidden_at    timestamptz,
  hidden_by    uuid references auth.users(id),
  created_at   timestamptz not null default now(),

  constraint discussion_posts_activity_agrees
    foreign key (activity_id, course_id)
    references course_activities (id, course_id) on delete cascade
);

create index if not exists discussion_posts_by_activity
  on discussion_posts (activity_id, created_at);


-- ===========================================================================
-- 5. ATTENDANCE
-- ===========================================================================
--
-- AGAINST THE LIVE CLASS ITSELF, which 084 made a lesson. A separate register
-- keyed on a date and a course code would be a second answer to "what classes
-- are there", and the two would disagree the first time a class moved.

create table if not exists class_attendance (
  id           uuid primary key default gen_random_uuid(),
  lesson_id    uuid not null references course_lessons(id) on delete cascade,
  student_id   uuid not null references students(id) on delete cascade,
  state        text not null check (state in ('present', 'absent', 'late', 'excused')),
  note         text,
  recorded_by  uuid references auth.users(id),
  recorded_at  timestamptz not null default now()
);

create unique index if not exists class_attendance_one_per_class_idx
  on class_attendance (lesson_id, student_id);
create index if not exists class_attendance_by_student
  on class_attendance (student_id);


-- ===========================================================================
-- 6. WHO MAY READ AND WRITE WHAT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- IS THIS ACTIVITY OPEN TO THE PERSON ASKING?
--
-- SECURITY DEFINER, and 084 explains why at length: a policy on
-- `activity_questions` that asks its question with a subquery on
-- `course_activities` gets an answer already filtered by
-- `course_activities_read`, so the clause that looks like the rule is never
-- reached — and deleting it changes nothing any proof can observe. A rule
-- invisible behind another rule is a decoration.
-- ---------------------------------------------------------------------------
create or replace function activity_is_open(the_activity uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from course_activities a
     where a.id = the_activity
       and a.visible
       and (a.opens_at is null or a.opens_at <= now())
       and is_enrolled_on_course(a.course_id)
  );
$$;

comment on function activity_is_open(uuid) is
  'Whether this activity is visible, has opened, and the signed-in account is registered on its '
  'course. Security definer so a question policy asking it is not silently answered by the '
  'activity policy.';

revoke all on function activity_is_open(uuid) from public;
grant execute on function activity_is_open(uuid) to authenticated, service_role;

alter table course_activities   enable row level security;
alter table activity_questions  enable row level security;
alter table activity_options    enable row level security;
alter table activity_answer_key enable row level security;
alter table activity_submissions enable row level security;
alter table submission_answers  enable row level security;
alter table discussion_posts    enable row level security;
alter table class_attendance    enable row level security;

grant select on course_activities, activity_questions, activity_options to authenticated;
grant select, insert, update on activity_submissions to authenticated;
grant select, insert, update, delete on submission_answers to authenticated;
grant select, insert, update on discussion_posts to authenticated;
grant select on class_attendance to authenticated;
-- NO GRANT AT ALL ON THE ANSWER KEY. Not select, not anything. The policy
-- below is a second lock on a door that has no handle on this side.

-- ---- THE ACTIVITY ---------------------------------------------------------
--
-- `opens_at` GATES THE STUDENT. An examination visible in the sidebar a week
-- early, with its questions readable, is an examination sat a week early.
drop policy if exists course_activities_read on course_activities;
create policy course_activities_read on course_activities
  for select using (
    (visible and is_enrolled_on_course(course_id)
             and (opens_at is null or opens_at <= now()))
    or may_curate_course(course_id)
  );

-- ---- THE QUESTIONS --------------------------------------------------------
--
-- READABLE WITH THE ACTIVITY, through a function rather than a subquery on
-- `course_activities` — 084 learned that the hard way: a policy subquery is
-- itself filtered by the other table's policy, so the clause that looks like
-- the rule is never reached and deleting it changes nothing a proof can see.
drop policy if exists activity_questions_read on activity_questions;
create policy activity_questions_read on activity_questions
  for select using (
    activity_is_open(activity_id) or may_curate_course(course_id)
  );

drop policy if exists activity_options_read on activity_options;
create policy activity_options_read on activity_options
  for select using (
    exists (select 1 from activity_questions q
             where q.id = activity_options.question_id
               and (activity_is_open(q.activity_id) or may_curate_course(q.course_id)))
  );

-- ---- THE ANSWER KEY -------------------------------------------------------
--
-- THE POINT OF THE WHOLE FILE. No student clause exists — not "after they have
-- submitted", not "once it is marked". A student's session never reads this
-- table under any condition, and what they are shown after marking is written
-- onto their own answer row by the route that marks it.
drop policy if exists activity_answer_key_curator on activity_answer_key;
create policy activity_answer_key_curator on activity_answer_key
  for select using (
    exists (select 1 from activity_questions q
             where q.id = activity_answer_key.question_id
               and may_curate_course(q.course_id))
  );

-- ---- SUBMISSIONS ----------------------------------------------------------
--
-- A STUDENT'S OWN, AND THE MARKER'S. A student reads their own submission and
-- nobody else's — not the other answers in the class, which is the most
-- ordinary way an assessment system leaks.
drop policy if exists activity_submissions_own on activity_submissions;
create policy activity_submissions_own on activity_submissions
  for select using (
    student_id in (select id from students where auth_user_id = auth.uid())
    or exists (select 1 from course_activities a
                where a.id = activity_submissions.activity_id
                  and may_curate_course(a.course_id))
  );

-- WRITING ONE. A student may hand in their own work and may not mark it: the
-- `with check` pins the row to them, and the route that grades holds the
-- service key.
--
-- AND A HANDED-IN ATTEMPT IS NOT EDITABLE. `using` on the update restricts it
-- to drafts, so a student cannot rewrite an essay after the marker has opened
-- it — which is the fault that makes a submitted_at column meaningless.
drop policy if exists activity_submissions_write on activity_submissions;
create policy activity_submissions_write on activity_submissions
  for insert with check (
    student_id in (select id from students where auth_user_id = auth.uid())
    and state in ('draft', 'submitted')
    and score is null and feedback is null and graded_at is null
  );

drop policy if exists activity_submissions_amend on activity_submissions;
create policy activity_submissions_amend on activity_submissions
  for update
  using (
    state = 'draft'
    and student_id in (select id from students where auth_user_id = auth.uid())
  )
  with check (
    student_id in (select id from students where auth_user_id = auth.uid())
    and state in ('draft', 'submitted')
    and score is null and feedback is null and graded_at is null
  );

drop policy if exists submission_answers_own on submission_answers;
create policy submission_answers_own on submission_answers
  for select using (
    exists (select 1 from activity_submissions s
             where s.id = submission_answers.submission_id
               and (s.student_id in (select id from students where auth_user_id = auth.uid())
                    or exists (select 1 from course_activities a
                                where a.id = s.activity_id
                                  and may_curate_course(a.course_id))))
  );

-- A STUDENT WRITES THEIR ANSWER AND NOT ITS MARK. `is_correct` and `score`
-- must be null on the way in; the marking route fills them with the service
-- key, against a table the student cannot read.
drop policy if exists submission_answers_write on submission_answers;
create policy submission_answers_write on submission_answers
  for insert with check (
    is_correct is null and score is null
    and exists (select 1 from activity_submissions s
                 where s.id = submission_answers.submission_id
                   and s.state = 'draft'
                   and s.student_id in (select id from students
                                         where auth_user_id = auth.uid()))
  );

-- ---- DISCUSSION -----------------------------------------------------------
drop policy if exists discussion_posts_read on discussion_posts;
create policy discussion_posts_read on discussion_posts
  for select using (
    (hidden_at is null and is_enrolled_on_course(course_id))
    or may_curate_course(course_id)
  );

drop policy if exists discussion_posts_write on discussion_posts;
create policy discussion_posts_write on discussion_posts
  for insert with check (
    author_id = auth.uid()
    and (is_enrolled_on_course(course_id) or may_curate_course(course_id))
  );

-- ---- ATTENDANCE -----------------------------------------------------------
--
-- READ ONLY FOR EVERYBODY HERE. A student sees their own record and a lecturer
-- sees their class's; neither writes it from a browser session, because a
-- register a student can amend is not a register.
drop policy if exists class_attendance_read on class_attendance;
create policy class_attendance_read on class_attendance
  for select using (
    student_id in (select id from students where auth_user_id = auth.uid())
    or exists (select 1 from course_lessons l
                where l.id = class_attendance.lesson_id
                  and may_curate_course(l.course_id))
  );


-- ===========================================================================
-- PROVE IT, AND ROLL IT BACK
-- ===========================================================================

do $$
declare
  lect_user uuid := gen_random_uuid();
  in_user   uuid := gen_random_uuid();
  out_user  uuid := gen_random_uuid();
  -- A THIRD STUDENT, ON THE COURSE. Without them the proof enrolled its own
  -- "stranger" in order to test cross-student reads, and then asserted that
  -- the stranger could not see the course — a proof arguing with itself.
  peer_user uuid := gen_random_uuid();
  lect_id   uuid;
  the_course uuid;
  mine      uuid;
  theirs    uuid;
  the_module uuid;
  the_quiz  uuid;
  the_q     uuid;
  right_opt uuid;
  wrong_opt uuid;
  sub       uuid;
  seen      integer;
begin
  begin
    insert into auth.users (id, email) values
      (lect_user, '085-lecturer@example.test'),
      (in_user,   '085-enrolled@example.test'),
      (out_user,  '085-stranger@example.test'),
      (peer_user, '085-classmate@example.test');
    insert into profiles (id, email, role) values
      (lect_user, '085-lecturer@example.test', 'lecturer'),
      (in_user,   '085-enrolled@example.test', 'student'),
      (out_user,  '085-stranger@example.test', 'student'),
      (peer_user, '085-classmate@example.test', 'student')
    on conflict (id) do update set role = excluded.role;

    insert into lecturers (staff_id, first_name, last_name, auth_user_id)
      values ('ICOFSTF-9085', 'Proof', 'Lecturer', lect_user) returning id into lect_id;
    insert into courses (code, title, lecturer_id)
      values ('ZZZ 9085', 'A Course Written By The 085 Proof', lect_id)
      returning id into the_course;

    insert into students (matric_no, first_name, last_name, status, auth_user_id)
      values ('085/PROOF/IN', 'Sits', 'TheQuiz', 'enrolled', in_user) returning id into mine;
    insert into students (matric_no, first_name, last_name, status, auth_user_id)
      values ('085/PROOF/OUT', 'Not', 'OnTheCourse', 'enrolled', out_user);
    -- The classmate, whose submission the first student must not be able to
    -- read. A CLASSMATE AND NOT THE STRANGER: reading another student's work
    -- is a fault that only exists between two people on the same course, and
    -- testing it with somebody the policy already excludes proves nothing.
    insert into students (matric_no, first_name, last_name, status, auth_user_id)
      values ('085/PROOF/PEER', 'Also', 'OnTheCourse', 'enrolled', peer_user)
      returning id into theirs;
    insert into enrollments (student_id, course_id, status) values
      (mine, the_course, 'registered'),
      (theirs, the_course, 'registered');

    insert into course_modules (course_id, title, visible)
      values (the_course, 'Module for the 085 proof', true) returning id into the_module;

    insert into course_activities (course_id, module_id, kind, title, graded, points, visible)
      values (the_course, the_module, 'quiz', 'A quiz written by the 085 proof', true, 10, true)
      returning id into the_quiz;

    insert into activity_questions (activity_id, course_id, kind, prompt, points)
      values (the_quiz, the_course, 'single_choice',
              'Which of these was written by a proof?', 1)
      returning id into the_q;

    insert into activity_options (question_id, label, sort_order)
      values (the_q, 'The right one', 1) returning id into right_opt;
    insert into activity_options (question_id, label, sort_order)
      values (the_q, 'The wrong one', 2) returning id into wrong_opt;

    insert into activity_answer_key (question_id, option_id, is_correct, explanation)
      values (the_q, right_opt, true, 'Because the proof says so, which gives it away.'),
             (the_q, wrong_opt, false, null);

    -- ---- A KNOWLEDGE CHECK CANNOT CARRY MARKS -----------------------------
    begin
      insert into course_activities (course_id, kind, title, graded, visible)
        values (the_course, 'knowledge_check', 'A check that counts', true, true);
      raise exception '085 FAILED: a knowledge check was accepted as graded, so a student can '
                      'be marked on something they were told did not count';
    exception
      when check_violation then null;
    end;

    -- ---- A QUESTION CANNOT BELONG TO ANOTHER COURSE -----------------------
    begin
      insert into activity_questions (activity_id, course_id, kind, prompt)
        values (the_quiz, (select id from courses where id <> the_course limit 1),
                'single_choice', 'A question in the wrong course');
      raise exception '085 FAILED: a question was accepted into a course its activity does not '
                      'belong to, so course_id can lie and every policy reading it is wrong';
    exception
      when foreign_key_violation then null;
      -- A database with only this proof's course has no second course to try,
      -- and an assertion that cannot run must not pass silently either.
      when not_null_violation then null;
    end;

    -- =====================================================================
    -- NOW SIT THE STUDENT DOWN AND WATCH THEM TRY TO READ THE ANSWERS
    -- =====================================================================
    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', in_user);

    -- THE QUESTION AND THE OPTIONS, WHICH THEY MUST SEE TO ANSWER.
    select count(*) into seen from activity_questions where id = the_q;
    if seen <> 1 then
      raise exception '085 FAILED: a student registered on the course cannot read the quiz '
                      'question, so the quiz is unsittable';
    end if;
    select count(*) into seen from activity_options where question_id = the_q;
    if seen <> 2 then
      raise exception '085 FAILED: a student can read % of the 2 options', seen;
    end if;

    -- AND THE ANSWER KEY, WHICH THEY MUST NOT. This is the assertion the file
    -- exists for.
    select count(*) into seen from activity_answer_key where question_id = the_q;
    if seen <> 0 then
      raise exception '085 FAILED: a student can read the answer key — the correct answer is '
                      'in their own browser and the quiz is decorative';
    end if;

    -- ---- THEY HAND IN AN ATTEMPT ------------------------------------------
    insert into activity_submissions (activity_id, student_id, attempt_no, state)
      values (the_quiz, mine, 1, 'draft') returning id into sub;
    insert into submission_answers (submission_id, question_id, option_id)
      values (sub, the_q, wrong_opt);

    -- ---- AND CANNOT MARK THEMSELVES ---------------------------------------
    begin
      insert into submission_answers (submission_id, question_id, option_id, is_correct, score)
        values (sub, the_q, right_opt, true, 1);
      raise exception '085 FAILED: a student wrote their own mark onto an answer';
    exception
      when insufficient_privilege then null;
    end;

    begin
      update activity_submissions set score = 10, state = 'graded', graded_at = now()
       where id = sub;
      raise exception '085 FAILED: a student graded their own submission';
    exception
      when insufficient_privilege then null;
    end;

    -- ---- NOR READ A CLASSMATE'S -------------------------------------------
    reset role;
    insert into activity_submissions (activity_id, student_id, attempt_no, state, submitted_at)
      values (the_quiz, theirs, 1, 'submitted', now());

    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', in_user);
    select count(*) into seen from activity_submissions where student_id = theirs;
    if seen <> 0 then
      raise exception '085 FAILED: a student can read another student''s submission';
    end if;

    -- ---- THE STRANGER SEES NONE OF IT -------------------------------------
    execute format('set local request.jwt.claim.sub = %L', out_user);
    select count(*) into seen from course_activities where id = the_quiz;
    if seen <> 0 then
      raise exception '085 FAILED: a student not registered on the course can read its quiz';
    end if;
    select count(*) into seen from activity_options where question_id = the_q;
    if seen <> 0 then
      raise exception '085 FAILED: a student not registered on the course can read the quiz '
                      'options';
    end if;

    -- ---- AND THE PERSON WHO SET IT CAN READ THE KEY ------------------------
    --
    -- A rule that also refuses the marker is not a tighter rule, it is a quiz
    -- nobody can mark.
    execute format('set local request.jwt.claim.sub = %L', lect_user);
    select count(*) into seen from activity_answer_key where question_id = the_q;
    if seen <> 2 then
      raise exception '085 FAILED: the lecturer who set the quiz reads % of 2 answer-key rows',
                      seen;
    end if;
    select count(*) into seen from activity_submissions where activity_id = the_quiz;
    if seen <> 2 then
      raise exception '085 FAILED: the lecturer cannot see the submissions to mark';
    end if;

    reset role;

    raise exception 'rollback 085 proof';
  exception
    when others then
      reset role;
      if sqlerrm <> 'rollback 085 proof' then raise; end if;
  end;
end $$;


do $$
begin
  raise notice '085 OK: a course has assignments, quizzes, knowledge checks and discussions';
  raise notice '085 OK: and a student sitting a quiz cannot read the answer key, cannot mark '
               'themselves, and cannot read another student''s submission';
end $$;
