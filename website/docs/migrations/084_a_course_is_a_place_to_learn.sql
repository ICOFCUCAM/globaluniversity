-- ===========================================================================
-- 084 — MODULES, LESSONS, AND WHO IS ACTUALLY ON THE COURSE
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- TWO THINGS, AND THE FIRST ONE CLOSES A DOOR.
--
-- 1. COURSE MATERIAL STOPS BEING READABLE BY ANYONE WITH AN ACCOUNT.
--
--    `course_materials_read` says, today, `visible and auth.uid() is not null`.
--    Read it again: ANY signed-in person reads EVERY course's material. A
--    student registered on nothing reads all of it. An applicant with an
--    account reads all of it. A lecturer reads every other lecturer's teaching
--    content.
--
--    The University's ruling: "Every learning resource must belong to an
--    actual Course and Course Offering and therefore be visible only to
--    students legitimately enrolled in that course."
--
--    After this, material is readable by the students registered on the course
--    and by the people who teach or govern it. Nothing is deleted; a row that
--    was visible to everybody is now visible to the class.
--
-- 2. A COURSE GAINS A STRUCTURE, which is the rest of the file.
--
--    Modules, and lessons inside them. Nothing is seeded — no module is
--    invented for a course the University has not written one for, and every
--    course keeps exactly the material it has today, which appears alongside
--    the new structure rather than being migrated into a shape nobody chose.
--
-- ---------------------------------------------------------------------------
-- WHY A FLAT LIST WAS THE FAULT, NOT THE CONTENT
-- ---------------------------------------------------------------------------
--
-- The University: "When a student logs in, they shouldn't think 'Where do I
-- download my lecturer's PDF?' They should think 'This is where I take my
-- course.'"
--
-- 068 gave a material a `course_id`, which fixed the connection — a material
-- belongs to a real course, and a student sees the courses they registered on.
-- It did not give the course an ORDER. `course_materials` has `week` and
-- `sort_order` and nothing else, so a course is a list sorted by number, and a
-- list sorted by number is a filing cabinet with better labels.
--
-- Teaching has a shape: a module gathers a fortnight's work around one idea, a
-- lesson within it is a thing to read or watch or do, and the order is the
-- argument. That shape cannot be expressed by an integer column.
--
-- ---------------------------------------------------------------------------
-- AND WHY A LESSON CARRIES ITS COURSE AS WELL AS ITS MODULE
-- ---------------------------------------------------------------------------
--
-- Because row-level security has to answer "may this person read this lesson"
-- without joining, and a policy that joins to the module to find the course is
-- a policy that runs on every row of every query.
--
-- A DENORMALISED COLUMN THAT CAN LIE IS WORSE THAN A JOIN, so this one cannot:
-- `course_modules` carries a unique key on (id, course_id) and a lesson's
-- (module_id, course_id) is a composite foreign key into it. Postgres refuses
-- a lesson whose course is not its module's course. No trigger, no reconciling
-- job, no drift — the database will not hold the bad state at all.
-- ===========================================================================


-- ===========================================================================
-- WHO IS ON THE COURSE, AND WHO TEACHES IT
-- ===========================================================================
--
-- SECURITY DEFINER for the same reason 083's was: a policy on a table must not
-- have to read a table the caller cannot read in order to decide whether the
-- caller may read it. These own the question and answer it once.

-- ---------------------------------------------------------------------------
-- A STUDENT'S OWN REGISTRATION.
--
-- `completed` COUNTS, AND THAT IS A DECISION. A student who finished the
-- course in June should still be able to open the lessons in July — the
-- alternative is material that evaporates the day the mark is entered, which
-- is not how a university library has ever worked. `dropped` does not count.
-- ---------------------------------------------------------------------------
create or replace function is_enrolled_on_course(the_course uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from enrollments e
      join students s on s.id = e.student_id
     where e.course_id = the_course
       and e.status in ('registered', 'completed')
       and s.auth_user_id = auth.uid()
  );
$$;

comment on function is_enrolled_on_course(uuid) is
  'Whether the signed-in account is a student registered on this course. Completed counts: '
  'material must not evaporate the day the mark is entered.';

-- ---------------------------------------------------------------------------
-- THE LECTURER ALLOCATED TO IT.
--
-- BOTH WAYS A COURSE IS ALLOCATED, exactly as 083 reads them: an offering
-- names the lecturer for a term, and `courses.lecturer_id` names who teaches
-- the course when no term has been set up yet.
-- ---------------------------------------------------------------------------
create or replace function teaches_this_course(the_course uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from courses c
      left join course_offerings o on o.course_id = c.id
      join lecturers l on l.id = coalesce(o.lecturer_id, c.lecturer_id)
     where c.id = the_course
       and l.auth_user_id = auth.uid()
  );
$$;

comment on function teaches_this_course(uuid) is
  'Whether the signed-in account is allocated to teach this course, by the offering or by the '
  'catalogue.';

-- ---------------------------------------------------------------------------
-- WHO MAY BUILD THE COURSE.
--
-- The lecturer who teaches it, and the offices that govern the curriculum.
--
-- NOT EVERY ACADEMIC ROLE. A lecturer curates the course they are allocated to
-- and no other, which is the University's ruling of September 2026 — "a
-- lecturer teaching BLT 501 can manage their teaching content for BLT 501" —
-- and the reason this takes a course and returns an answer about THAT course
-- rather than being a capability.
-- ---------------------------------------------------------------------------
create or replace function may_curate_course(the_course uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth_role() in (
           'superadmin', 'admin', 'registrar', 'academic-office',
           'dean', 'hod', 'programme-coordinator'
         )
      or (auth_role() = 'lecturer' and teaches_this_course(the_course));
$$;

comment on function may_curate_course(uuid) is
  'Whether the signed-in account may build this course: the lecturer allocated to it, or an '
  'office that governs the curriculum. A lecturer curates their own course and no other.';



revoke all on function is_enrolled_on_course(uuid) from public;
revoke all on function teaches_this_course(uuid)   from public;
revoke all on function may_curate_course(uuid)     from public;
grant execute on function is_enrolled_on_course(uuid) to authenticated, service_role;
grant execute on function teaches_this_course(uuid)   to authenticated, service_role;
grant execute on function may_curate_course(uuid)     to authenticated, service_role;


-- ===========================================================================
-- 1. MODULES — THE SPINE OF A COURSE
-- ===========================================================================
--
-- A MODULE MAY BELONG TO A TERM OR TO THE COURSE ITSELF, and 068 already
-- established why both are needed: the course's own structure is true in 2026
-- and in 2029, while a particular term's arrangement of it is not. A null
-- `offering_id` means "this is how the course is built"; a set one means "this
-- is how it ran that term".

create table if not exists course_modules (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references courses(id) on delete cascade,
  offering_id  uuid references course_offerings(id) on delete cascade,

  title        text not null check (length(btrim(title)) between 1 and 300),
  -- WHAT THIS MODULE IS FOR, in the lecturer's own words. A student opening
  -- week four should be told what week four is about before being shown six
  -- files.
  overview     text,

  -- ---- WHAT THE STUDENT SHOULD BE ABLE TO DO AFTERWARDS ------------------
  --
  -- The University: "By completing this module, the student should be able to:
  -- Explain… Analyse… Compare… Evaluate… This allows the course to become
  -- outcome-driven rather than simply content-driven."
  --
  -- AN ARRAY, NOT A PARAGRAPH. Outcomes are a list everywhere else in this
  -- system — `courses.learning_outcomes`, the programme's, the award's — and a
  -- paragraph cannot be counted, ticked off against a module's activities, or
  -- carried onto a transcript. Empty means the lecturer has not written them
  -- yet, which is allowed; a module half-built must still save.
  objectives   text[] not null default '{}',

  sort_order   integer not null default 0,
  -- A module can be written in advance and opened on the day. Null means open.
  opens_on     date,
  visible      boolean not null default false,

  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- THE KEY A LESSON POINTS AT. Without this the composite foreign key below
-- cannot exist, and `course_lessons.course_id` becomes a column that can lie.
create unique index if not exists course_modules_id_course_idx
  on course_modules (id, course_id);

create index if not exists course_modules_by_course
  on course_modules (course_id, sort_order);
create index if not exists course_modules_by_offering
  on course_modules (offering_id) where offering_id is not null;


-- ===========================================================================
-- 2. LESSONS — THE THINGS A STUDENT ACTUALLY OPENS
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- ONE TABLE, NOT ELEVEN
-- ---------------------------------------------------------------------------
--
-- A text lesson, a PDF, a reading, an audio lecture, an uploaded video, a
-- YouTube link, an image, a presentation and a live class are all the same
-- thing to the University: A THING IN THE COURSE, IN ITS PLACE IN THE ORDER,
-- THAT A STUDENT OPENS AND IS THEN KNOWN TO HAVE OPENED. They differ in how
-- they are rendered and in nothing else that matters here.
--
-- Eleven tables would mean eleven joins to build one page, eleven policies
-- saying the same sentence, and eleven places to forget progress tracking.
--
-- ---------------------------------------------------------------------------
-- AN EXTERNAL VIDEO IS A LESSON, NOT A LINK
-- ---------------------------------------------------------------------------
--
-- The University: "Allow external video links but wrap them in proper lesson
-- metadata including title, description, learning objective and study
-- instructions."
--
-- So those are columns, and they are columns for every kind — because the
-- reason a YouTube link needs a learning objective is not that it is external.
-- It is that a student needs to know why they are being asked to watch it, and
-- that is as true of the lecturer's own recording.

create table if not exists course_lessons (
  id           uuid primary key default gen_random_uuid(),
  module_id    uuid not null references course_modules(id) on delete cascade,
  -- DENORMALISED, AND UNABLE TO LIE. See the composite foreign key below.
  course_id    uuid not null references courses(id) on delete cascade,

  kind         text not null check (kind in (
                 'text',          -- written in the LMS, no file at all
                 'document',      -- PDF or similar, uploaded or linked
                 'reading',       -- a book, article or chapter
                 'audio',         -- an audio lecture
                 'video',         -- uploaded video
                 'video_external',-- YouTube, Vimeo or another host
                 'link',          -- an external learning resource
                 'image',
                 'presentation',
                 'live_class'     -- a scheduled session, joined at its time
               )),

  title        text not null check (length(btrim(title)) between 1 and 300),
  summary      text,

  -- ---- WHY THIS IS IN THE COURSE -----------------------------------------
  --
  -- The two columns the University named by name. Both optional, because a
  -- lecturer part-way through building a module should not be blocked, and a
  -- required field nobody has an answer for is filled in with a full stop.
  learning_objective  text,
  study_instructions  text,

  -- ---- THE CONTENT, WHICHEVER SORT IT IS ---------------------------------
  --
  -- `body`  — rich text written in the LMS. The University: "Allow lecturers
  --           to create rich-text lessons directly inside the LMS without
  --           requiring file uploads."
  -- `url`   — an external video or resource.
  -- `media_path` — the object in the private bucket, for an upload.
  body         text,
  url          text,
  media_path   text,
  -- THE MIME TYPE IS WHAT TELLS PDF FROM WORD FROM EPUB, and the reason
  -- `kind` does not need a value for each: 'document' says how it sits in the
  -- course, `media_type` says what the player or viewer must do with it.
  -- Audio is the same — mp3, m4a and wav are three media types of one kind.
  media_type   text,
  media_bytes  bigint,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),

  -- WHOSE PLAYER. The University: the student must see "Lecture 5 — Theology
  -- and Social Justice with an embedded player — not a random YouTube URL",
  -- and a screen cannot embed what it cannot identify.
  provider     text check (provider is null or provider in ('youtube', 'vimeo', 'internal', 'other')),

  -- HOW LONG THIS WILL TAKE, which the University asked for by name on an
  -- external video and is worth having on everything: a student deciding
  -- whether to start a lesson before a lecture is asking one question.
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes between 1 and 6000),

  -- TRANSCRIPTS ARE PROVIDED, NOT GENERATED. The University chose a lecturer
  -- pasting or uploading one over a transcription vendor, and the column is
  -- shaped so an automatic step could fill it later without changing anything
  -- that reads it.
  transcript   text,

  -- ---- READING LISTS -----------------------------------------------------
  --
  -- "Add reading lists with required/recommended classification." It is a
  -- property of the reading, not a separate list: a reading list IS the
  -- readings of a course, and holding them twice would let the two disagree.
  --
  -- THREE BANDS, NOT TWO, because the University named three: "Primary
  -- Reading", "Secondary Reading", "Recommended". Primary and secondary are
  -- both required and a student needs to know which to open first.
  requirement  text check (requirement is null or requirement in
                 ('primary', 'secondary', 'recommended')),

  -- ---- AND A READING IS A CITATION, NOT A TITLE --------------------------
  --
  -- "Each item can have: author, title, year, publisher, ISBN/DOI where
  -- applicable, link, uploaded file."
  --
  -- COLUMNS RATHER THAN ONE CITATION STRING, which is what this first had.
  -- A string cannot be sorted by author, cannot be checked against the
  -- library's holdings, and cannot be rendered in the University's own
  -- citation style — it can only be printed exactly as somebody typed it,
  -- which means the reading list is as consistent as its worst entry.
  author       text,
  published_year integer check (published_year is null
                                or published_year between 1000 and 2200),
  publisher    text,
  isbn         text,
  doi          text,
  -- What a lecturer typed when the fields above do not fit — a lecture given
  -- at a conference, an unpublished manuscript. Kept so nothing is lost, and
  -- used only when the structured fields are empty.
  citation     text,

  -- ---- LIVE CLASSES ------------------------------------------------------
  --
  -- "Connect scheduled classes from the Timetable to the LMS and provide a
  -- Join Class action for online sessions."
  starts_at    timestamptz,
  ends_at      timestamptz,
  join_url     text,

  sort_order   integer not null default 0,
  visible      boolean not null default false,

  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- ---- THE COLUMN THAT CANNOT LIE ----------------------------------------
  --
  -- A lesson's course must be its module's course. Postgres enforces it, so
  -- there is no state in which a policy reading `course_lessons.course_id`
  -- decides against the wrong course.
  constraint course_lessons_module_agrees
    foreign key (module_id, course_id)
    references course_modules (id, course_id) on delete cascade,

  -- ---- AND A LESSON MUST BE SOMETHING ------------------------------------
  --
  -- A row with no body, no url, no upload and no scheduled time is a title in
  -- a list that opens onto nothing. It is the exact shape of the fault the
  -- old LMS had — a dialog that closed and wrote nothing — so the database
  -- refuses it rather than the screen remembering to.
  constraint course_lessons_has_content
    check (body is not null or url is not null or media_path is not null
           or starts_at is not null)
);

create index if not exists course_lessons_by_module
  on course_lessons (module_id, sort_order);
create index if not exists course_lessons_by_course
  on course_lessons (course_id);
-- MAKING THE COURSE SEARCHABLE. "Make all course content searchable."
create index if not exists course_lessons_search
  on course_lessons using gin (
    to_tsvector('english',
      coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' ||
      coalesce(body, '') || ' ' || coalesce(transcript, '') || ' ' ||
      coalesce(citation, ''))
  );


-- ===========================================================================
-- 3. PROGRESS — WHAT A STUDENT HAS ACTUALLY DONE
-- ===========================================================================
--
-- "Add student progress tracking based on meaningful learning activities."
--
-- MEANINGFUL, which rules out the obvious implementation. Counting page opens
-- would make a student who clicked every lesson and read none of them 100%
-- complete, and a progress bar that can be filled by clicking is worse than no
-- progress bar — it tells the student they are finished.
--
-- So a row records BOTH: that it was opened, and whether the student said they
-- had finished with it. `last_position_seconds` is where the audio or video
-- was left, so it resumes.

create table if not exists lesson_progress (
  id           uuid primary key default gen_random_uuid(),
  lesson_id    uuid not null references course_lessons(id) on delete cascade,
  student_id   uuid not null references students(id) on delete cascade,

  state        text not null default 'started' check (state in ('started', 'completed')),
  seconds_spent         integer not null default 0 check (seconds_spent >= 0),
  last_position_seconds integer check (last_position_seconds is null or last_position_seconds >= 0),

  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),

  -- COMPLETED MEANS A MOMENT. A row saying completed with no time is a row
  -- that cannot be put in order on a transcript or an early-warning list.
  constraint lesson_progress_completed_has_a_moment
    check ((state = 'completed') = (completed_at is not null))
);

create unique index if not exists lesson_progress_one_per_student_idx
  on lesson_progress (lesson_id, student_id);
create index if not exists lesson_progress_by_student
  on lesson_progress (student_id);


-- ===========================================================================
-- 4. NOTES AND BOOKMARKS — THE STUDENT'S OWN
-- ===========================================================================
--
-- "Add bookmarks and private student notes."
--
-- PRIVATE MEANS PRIVATE, and it is worth being exact about who that excludes:
-- not only other students but the LECTURER. A student who believes their notes
-- are read by the person marking them writes different notes, and the feature
-- is then worse than absent. The policy below admits the author and the
-- Superadministrator's service key, and nobody else — no dean, no registrar.

create table if not exists student_notes (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students(id) on delete cascade,
  course_id    uuid not null references courses(id) on delete cascade,
  lesson_id    uuid references course_lessons(id) on delete cascade,
  body         text not null check (length(btrim(body)) between 1 and 20000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists student_notes_by_student
  on student_notes (student_id, course_id);

create table if not exists course_bookmarks (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students(id) on delete cascade,
  lesson_id    uuid not null references course_lessons(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create unique index if not exists course_bookmarks_one_each_idx
  on course_bookmarks (student_id, lesson_id);


-- ---------------------------------------------------------------------------
-- HAS THIS MODULE BEEN OPENED TO THE CLASS?
--
-- WHY THIS IS A FUNCTION AND NOT A SUBQUERY, which is a lesson learned by
-- breaking the proof. `course_lessons_read` first asked
--
--     exists (select 1 from course_modules m where m.id = ... and m.visible)
--
-- and that subquery is ITSELF filtered by `course_modules_read`. So a stranger
-- saw no lessons because they saw no modules — and the lesson policy's own
-- enrolment test was never reached. Deleting it from the policy changed
-- nothing the proof could observe, which means it was not being tested at all.
--
-- Two rules where one is invisible behind the other is one rule and a
-- decoration. SECURITY DEFINER lifts the module question out of RLS so it
-- answers on its own, and each clause of the policy then fails on its own when
-- it is wrong.
-- ---------------------------------------------------------------------------
create or replace function module_is_open(the_module uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from course_modules m
     where m.id = the_module
       and m.visible
       and (m.opens_on is null or m.opens_on <= current_date)
  );
$$;

comment on function module_is_open(uuid) is
  'Whether this module has been made visible and its opening date has arrived. Security definer '
  'so a lesson policy asking it is not silently answered by the module policy.';

revoke all on function module_is_open(uuid) from public;
grant execute on function module_is_open(uuid) to authenticated, service_role;


-- ===========================================================================
-- 5. WHO MAY READ WHAT
-- ===========================================================================

alter table course_modules   enable row level security;
alter table course_lessons   enable row level security;
alter table lesson_progress  enable row level security;
alter table student_notes    enable row level security;
alter table course_bookmarks enable row level security;

grant select on course_modules, course_lessons to authenticated;
grant select, insert, update, delete on lesson_progress  to authenticated;
grant select, insert, update, delete on student_notes    to authenticated;
grant select, insert, delete         on course_bookmarks to authenticated;

-- ---------------------------------------------------------------------------
-- THE COURSE'S OWN STRUCTURE — the class, and the people who build it.
--
-- `visible` GATES THE STUDENT AND NOT THE LECTURER, which is what makes a
-- module draftable: a lecturer builds week five in week three and the class
-- does not see it until it is opened.
-- ---------------------------------------------------------------------------
drop policy if exists course_modules_read on course_modules;
create policy course_modules_read on course_modules
  for select using (
    (visible and (opens_on is null or opens_on <= current_date)
             and is_enrolled_on_course(course_id))
    or may_curate_course(course_id)
  );

drop policy if exists course_lessons_read on course_lessons;
create policy course_lessons_read on course_lessons
  for select using (
    (visible and is_enrolled_on_course(course_id) and module_is_open(module_id))
    or may_curate_course(course_id)
  );

-- ---------------------------------------------------------------------------
-- A STUDENT'S OWN PROGRESS, NOTES AND BOOKMARKS.
--
-- WRITTEN BY THE STUDENT DIRECTLY, and deliberately — unlike almost everything
-- else in this system, which is written through a route with a service key.
-- Progress is written every few seconds while a video plays; routing that
-- through a server with an administrative key would put the University's
-- highest privilege behind its highest-frequency write.
--
-- `with check` PINS THE ROW TO THE AUTHOR, so a student cannot write progress
-- or a note as somebody else. The `using` clause alone would not: it governs
-- which rows are visible to change, not what a new row may claim to be.
-- ---------------------------------------------------------------------------
drop policy if exists lesson_progress_own on lesson_progress;
create policy lesson_progress_own on lesson_progress
  for all
  using (student_id in (select id from students where auth_user_id = auth.uid()))
  with check (student_id in (select id from students where auth_user_id = auth.uid()));

-- AND THE PEOPLE WHO TEACH IT MAY SEE IT, because that is the whole point of
-- progress tracking — the University's early-warning ruling is about a
-- lecturer identifying students in their own courses who need attention.
-- READ ONLY: a lecturer may not mark a lesson complete on a student's behalf.
drop policy if exists lesson_progress_teacher_read on lesson_progress;
create policy lesson_progress_teacher_read on lesson_progress
  for select using (
    exists (select 1 from course_lessons l
             where l.id = lesson_progress.lesson_id
               and may_curate_course(l.course_id))
  );

-- THE AUTHOR, AND NOBODY ELSE AT ALL. No lecturer, no dean, no registrar.
drop policy if exists student_notes_own on student_notes;
create policy student_notes_own on student_notes
  for all
  using (student_id in (select id from students where auth_user_id = auth.uid()))
  with check (student_id in (select id from students where auth_user_id = auth.uid()));

drop policy if exists course_bookmarks_own on course_bookmarks;
create policy course_bookmarks_own on course_bookmarks
  for all
  using (student_id in (select id from students where auth_user_id = auth.uid()))
  with check (student_id in (select id from students where auth_user_id = auth.uid()));


-- ===========================================================================
-- 6. AND THE MATERIAL THAT WAS ALREADY THERE
-- ===========================================================================
--
-- THE DOOR THIS MIGRATION CLOSES. `visible and auth.uid() is not null` is not
-- a rule about a course; it is a rule about having an account. Every signed-in
-- person could read every course's teaching material, and the University's
-- ruling is that a learning resource is "visible only to students legitimately
-- enrolled in that course".
--
-- The offices keep the reach they have. The lecturer's is narrowed to the
-- courses they teach, as 083 narrowed their reach into the student register.

drop policy if exists course_materials_read on course_materials;
create policy course_materials_read on course_materials
  for select using (
    (visible and is_enrolled_on_course(course_id))
    or may_curate_course(course_id)
  );


-- ===========================================================================
-- 7. THE PRIVATE BUCKET
-- ===========================================================================
--
-- Audio lectures, video and documents are objects, not rows. The University
-- chose a private Supabase bucket served by signed URL, so the bytes obey the
-- same enrolment rule as everything else rather than sitting on a public URL
-- that anyone who has ever seen it keeps forever.
--
-- CONDITIONAL, because the local proof harness has no `storage` schema — it
-- stubs `auth` and nothing else. On the University's project the schema is
-- there and the bucket is created; on the harness this is a no-op, and the
-- alternative is a migration that cannot be proved before it is shipped.

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public)
      values ('course-media', 'course-media', false)
      on conflict (id) do update set public = false;
    raise notice '084: the private course-media bucket is in place';
  else
    raise notice '084: no storage schema here, so no bucket — this is the proof harness';
  end if;
end $$;


-- ===========================================================================
-- PROVE IT, AND ROLL IT BACK
-- ===========================================================================
--
-- BY READING THE COURSE AS THREE DIFFERENT PEOPLE, for the reason 083's proof
-- had to be rewritten: a policy naming the right function can still be a
-- policy that lets everybody through, and no amount of reading the text finds
-- that out. This signs in as the student on the course, a student not on it,
-- and the lecturer who teaches it, and counts what each can see.
--
-- EVERYTHING IT NEEDS, IT MAKES. Its own course code, its own matriculation
-- numbers, its own staff number. Nothing of the University's is read, written
-- or competed for, and the whole block rolls back.

do $$
declare
  lect_user uuid := gen_random_uuid();
  out_user  uuid := gen_random_uuid();
  in_user   uuid := gen_random_uuid();
  lect_id   uuid;
  the_course uuid;
  -- A SECOND REAL COURSE, and the proof was worthless without it. See below.
  other_course uuid;
  mine      uuid;
  theirs    uuid;
  the_module uuid;
  the_lesson uuid;
  seen      integer;
begin
  begin
    insert into auth.users (id, email) values
      (lect_user, '084-lecturer@example.test'),
      (in_user,   '084-enrolled@example.test'),
      (out_user,  '084-stranger@example.test');
    insert into profiles (id, email, role) values
      (lect_user, '084-lecturer@example.test', 'lecturer'),
      (in_user,   '084-enrolled@example.test', 'student'),
      (out_user,  '084-stranger@example.test', 'student')
    on conflict (id) do update set role = excluded.role;

    insert into lecturers (staff_id, first_name, last_name, auth_user_id)
      values ('ICOFSTF-9084', 'Proof', 'Lecturer', lect_user) returning id into lect_id;
    insert into courses (code, title, lecturer_id)
      values ('ZZZ 9084', 'A Course Written By This Proof', lect_id) returning id into the_course;
    insert into courses (code, title)
      values ('ZZZ 9084B', 'A Second Course, For The Composite Key')
      returning id into other_course;

    insert into students (matric_no, first_name, last_name, status, auth_user_id)
      values ('084/PROOF/IN', 'On', 'TheCourse', 'enrolled', in_user) returning id into mine;
    insert into students (matric_no, first_name, last_name, status, auth_user_id)
      values ('084/PROOF/OUT', 'Not', 'OnIt', 'enrolled', out_user) returning id into theirs;

    insert into enrollments (student_id, course_id, status)
      values (mine, the_course, 'registered');

    insert into course_modules (course_id, title, visible, sort_order)
      values (the_course, 'Module written by the 084 proof', true, 1)
      returning id into the_module;
    insert into course_lessons (module_id, course_id, kind, title, body, visible)
      values (the_module, the_course, 'text', 'Lesson written by the 084 proof',
              'The body of it.', true)
      returning id into the_lesson;

    -- ---- THE COLUMN THAT CANNOT LIE ---------------------------------------
    --
    -- A lesson claiming a course its module does not belong to. If this is
    -- ever accepted, every policy reading `course_lessons.course_id` decides
    -- against the wrong course.
    --
    -- A REAL SECOND COURSE, AND THIS IS THE WHOLE POINT OF IT. The first
    -- version of this check passed `gen_random_uuid()` — a course id that
    -- exists nowhere — so the PLAIN `references courses(id)` refused it and
    -- the composite key was never consulted. Removing the composite key
    -- entirely still passed. The fault it guards is a lesson pointing at a
    -- course that REALLY EXISTS and is not its module's, and only a real
    -- second course can ask that question.
    begin
      insert into course_lessons (module_id, course_id, kind, title, body, visible)
        values (the_module, other_course, 'text', 'A lesson in the wrong course', 'x', true);
      raise exception '084 FAILED: a lesson was accepted into a real course its module does '
                      'not belong to, so course_id can lie and every policy reading it is wrong';
    exception
      when foreign_key_violation then null;
    end;

    -- ---- A LESSON THAT OPENS ONTO NOTHING ---------------------------------
    begin
      insert into course_lessons (module_id, course_id, kind, title, visible)
        values (the_module, the_course, 'text', 'A title and nothing else', true);
      raise exception '084 FAILED: a lesson with no body, no url, no upload and no scheduled '
                      'time was accepted — a title in a list that opens onto nothing';
    exception
      when check_violation then null;
    end;

    -- ---- NOW READ THE COURSE AS THREE PEOPLE ------------------------------
    set local role authenticated;

    -- THE STUDENT ON IT.
    execute format('set local request.jwt.claim.sub = %L', in_user);
    select count(*) into seen from course_lessons where id = the_lesson;
    if seen <> 1 then
      raise exception '084 FAILED: a student registered on the course cannot see its lesson, '
                      'so the course is empty for the class it was built for';
    end if;

    -- THE STUDENT WHO IS NOT. This is the count the old rule never took: it
    -- asked only whether somebody was signed in.
    execute format('set local request.jwt.claim.sub = %L', out_user);
    select count(*) into seen from course_lessons where id = the_lesson;
    if seen <> 0 then
      raise exception '084 FAILED: a student not registered on the course can read its '
                      'lessons — every signed-in account still reads every course';
    end if;
    select count(*) into seen from course_modules where id = the_module;
    if seen <> 0 then
      raise exception '084 FAILED: a student not registered on the course can read its modules';
    end if;

    -- THE LECTURER WHO TEACHES IT, whose course it is.
    execute format('set local request.jwt.claim.sub = %L', lect_user);
    select count(*) into seen from course_lessons where id = the_lesson;
    if seen <> 1 then
      raise exception '084 FAILED: the lecturer allocated to the course cannot read the lesson '
                      'they wrote';
    end if;

    reset role;

    -- ---- AND THE DOOR THIS MIGRATION EXISTS TO CLOSE ----------------------
    --
    -- `course_materials` is the headline of the file and had no assertion at
    -- all until the proof was broken on purpose and this was noticed. The old
    -- rule was `visible and auth.uid() is not null`: an account, not a course.
    insert into course_materials (course_id, kind, title, body, visible)
      values (the_course, 'outline', 'An outline written by the 084 proof', 'The outline.', true);

    set local role authenticated;

    execute format('set local request.jwt.claim.sub = %L', in_user);
    select count(*) into seen from course_materials where course_id = the_course;
    if seen <> 1 then
      raise exception '084 FAILED: a student registered on the course cannot read its material';
    end if;

    execute format('set local request.jwt.claim.sub = %L', out_user);
    select count(*) into seen from course_materials where course_id = the_course;
    if seen <> 0 then
      raise exception '084 FAILED: a student not registered on the course reads its material — '
                      'the door this migration exists to close is still open';
    end if;

    execute format('set local request.jwt.claim.sub = %L', lect_user);
    select count(*) into seen from course_materials where course_id = the_course;
    if seen <> 1 then
      raise exception '084 FAILED: the lecturer who teaches the course cannot read its material';
    end if;

    reset role;

    -- ---- AN INVISIBLE MODULE IS NOT THE CLASS'S BUSINESS -------------------
    --
    -- What makes a module draftable. Without it a lecturer building week five
    -- in week three publishes it by typing it.
    update course_modules set visible = false where id = the_module;
    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', in_user);
    select count(*) into seen from course_modules where id = the_module;
    if seen <> 0 then
      raise exception '084 FAILED: a student can read a module that has not been opened, so a '
                      'lecturer cannot draft one';
    end if;
    select count(*) into seen from course_lessons where id = the_lesson;
    if seen <> 0 then
      raise exception '084 FAILED: a student can read a lesson inside a module that has not '
                      'been opened';
    end if;
    reset role;
    update course_modules set visible = true where id = the_module;

    -- ---- A NOTE IS PRIVATE FROM THE LECTURER, NOT ONLY FROM OTHER STUDENTS -
    insert into student_notes (student_id, course_id, lesson_id, body)
      values (mine, the_course, the_lesson, 'What the student thought of it.');

    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', lect_user);
    select count(*) into seen from student_notes where student_id = mine;
    if seen <> 0 then
      raise exception '084 FAILED: the lecturer can read a student''s private notes, which '
                      'makes the feature worse than absent';
    end if;

    -- AND THE STUDENT WHO WROTE IT CAN.
    execute format('set local request.jwt.claim.sub = %L', in_user);
    select count(*) into seen from student_notes where student_id = mine;
    if seen <> 1 then
      raise exception '084 FAILED: a student cannot read their own notes';
    end if;

    -- ---- AND A STUDENT CANNOT WRITE PROGRESS AS SOMEBODY ELSE -------------
    --
    -- The `with check` clause, watched refusing. `using` alone governs which
    -- rows may be changed, not what a new row may claim to be.
    begin
      insert into lesson_progress (lesson_id, student_id) values (the_lesson, theirs);
      raise exception '084 FAILED: a student wrote progress onto another student''s record';
    exception
      when insufficient_privilege then null;
    end;

    -- THEIR OWN, WHICH MUST STILL WORK.
    insert into lesson_progress (lesson_id, student_id) values (the_lesson, mine);
    select count(*) into seen from lesson_progress where student_id = mine;
    if seen <> 1 then
      raise exception '084 FAILED: a student cannot record their own progress';
    end if;

    reset role;

    raise exception 'rollback 084 proof';
  exception
    when others then
      reset role;
      if sqlerrm <> 'rollback 084 proof' then raise; end if;
  end;
end $$;


do $$
begin
  raise notice '084 OK: course material is readable by the class and the people who teach it, '
               'and not by everyone with an account';
  raise notice '084 OK: a course has modules and lessons, a lesson cannot claim the wrong '
               'course, and one that opens onto nothing is refused';
  raise notice '084 OK: progress is the student''s own to write, and their notes are private '
               'from the lecturer too';
end $$;
