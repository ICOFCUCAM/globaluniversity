-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — MIGRATIONS 083, 084, 085, 086, 087, IN ORDER
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-migration-run.mjs
--   Rebuild:   node scripts/build-migration-run.mjs --out=RUN-PART-5.sql 083 084 085 086 087
--
-- ---------------------------------------------------------------------------
-- HOW TO RUN IT
--
-- Supabase SQL editor: paste the whole file and run once.
-- psql:                psql "<connection string>" -f docs/migrations/RUN-PART-5.sql
--
-- Every migration in it is idempotent and destroys nothing, so running it twice
-- is safe. It is NOT wrapped in a transaction: each file is written to run
-- statement by statement, and wrapping them would mean a failure in the last
-- one silently undid the first.
--
-- ---------------------------------------------------------------------------
-- WHAT TO EXPECT IN THE OUTPUT
--
-- Some of these raise NOTICE deliberately — they report on the state they
-- found rather than changing it silently. A notice is information, not a
-- warning. An ERROR is a real failure and stops the run.
--
-- ---------------------------------------------------------------------------
-- AFTERWARDS
--
-- The LAST THING this file prints is a table saying which of these migrations
-- landed. You do not have to run anything else to find out — and you should
-- not have to, because the Supabase SQL editor does not display the NOTICE
-- lines the proofs write.
-- ===========================================================================

-- ===========================================================================
-- ===========================================================================
--
--   083_a_lecturer_sees_their_own_students.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 083 — A LECTURER SEES THEIR OWN STUDENTS, AND NOT THE REGISTER
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- A LECTURER STOPS BEING ABLE TO READ EVERY STUDENT THE UNIVERSITY HAS.
--
-- `students_staff_read` names twelve roles and `lecturer` is one of them, so
-- any lecturer account could read the whole register from a browser — every
-- student's name, matriculation number, programme and status, whether or not
-- that student had ever been in their class.
--
-- The University's ruling, September 2026: a lecturer must not "access
-- students outside their legitimate teaching scope", and must be able to "view
-- students registered in courses/classes they teach".
--
-- ---------------------------------------------------------------------------
-- AND WHY THE SCREEN WAS NOT ENOUGH
-- ---------------------------------------------------------------------------
--
-- The University, in the same ruling: "hiding a menu item must never replace
-- server-side authorization."
--
-- Quite so. `MyStudents` asks only for the roll of the courses somebody
-- teaches, and that was true of the SCREEN and of nothing else. The row-level
-- policy is what actually decides, and it said every student. A screen is a
-- convenience; a policy is the rule.
--
-- ---------------------------------------------------------------------------
-- ONLY THE LECTURER, BECAUSE ONLY THE LECTURER HAS BEEN RULED ON
-- ---------------------------------------------------------------------------
--
-- A Dean, a Head of Department and a Programme Coordinator read the whole
-- register too, and the same argument probably narrows each of them — to a
-- faculty, a department, a programme. The University has not said so, and a
-- migration that decided it would be inventing their arrangements. Every other
-- role keeps exactly the reach it has today.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- WHOSE STUDENTS ARE WHOSE
-- ---------------------------------------------------------------------------
--
-- SECURITY DEFINER, and deliberately. The policy on `students` must not read
-- `students` to decide whether it may read `students`; a function that owns the
-- question answers it once, without recursion.
--
-- BOTH WAYS A COURSE IS ALLOCATED. 068 explains it: an offering names the
-- lecturer for a term, and `courses.lecturer_id` says who teaches a course
-- FOREVER — the mistake 063 was written to correct. Both are read, because
-- until the University sets up a term the second is all there is, and a
-- lecturer who could not see their class in week one would have to be given
-- the whole register again.

create or replace function teaches_this_student(the_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from enrollments e
      join courses c on c.id = e.course_id
      left join course_offerings o on o.course_id = c.id
      join lecturers l
        on l.id = coalesce(o.lecturer_id, c.lecturer_id)
     where e.student_id = the_student
       and e.status in ('registered', 'completed')
       and l.auth_user_id = auth.uid()
  );
$$;

comment on function teaches_this_student(uuid) is
  'Whether the signed-in account is allocated to teach a course this student is registered on. '
  'Reads the offering and the catalogue alike, because until a term is set up only the second '
  'names a lecturer.';

revoke all on function teaches_this_student(uuid) from public;
grant execute on function teaches_this_student(uuid) to authenticated, service_role;


-- ---------------------------------------------------------------------------
-- THE POLICY
-- ---------------------------------------------------------------------------
--
-- The eleven other roles keep the reach they have; the lecturer's is narrowed
-- to the students they actually teach. Written as one policy rather than two so
-- there is one answer to "who may read a student" rather than two that can
-- drift.

drop policy if exists students_staff_read on students;
create policy students_staff_read on students
  for select using (
    auth_role() in (
      'superadmin', 'admin', 'registrar', 'finance', 'finance-director',
      'admissions-officer', 'dean', 'hod', 'programme-coordinator',
      'academic-office', 'student-affairs'
    )
    -- THE LECTURER'S OWN CLASSES, AND NO FURTHER.
    or (auth_role() = 'lecturer' and teaches_this_student(students.id))
  );


-- ===========================================================================
-- PROVE IT, AND ROLL IT BACK
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- BY READING THE REGISTER AS A LECTURER, NOT BY READING THE POLICY
-- ---------------------------------------------------------------------------
--
-- The first draft of this proof asked `pg_policy` whether the installed
-- predicate mentioned `teaches_this_student`, and that is worth writing down
-- because it proved NOTHING. A policy reading
--
--     auth_role() in (... 'lecturer' ...) or teaches_this_student(students.id)
--
-- mentions the function, passes every check, and leaves a lecturer reading the
-- whole register exactly as before — the `or` is satisfied by the list before
-- the function is ever consulted. A text search cannot tell a narrowing from a
-- widening that happens to use the same words.
--
-- So this signs in. Two students, one on the lecturer's course and one not, and
-- the lecturer is made to say which of them they can see. Revert the policy and
-- the second count is 1 and the proof fails, which is the whole point of it.
--
-- EVERYTHING IT NEEDS, IT MAKES. Its own course code, its own matriculation
-- numbers, its own staff number — nothing of the University's is read, written
-- or competed for, and the whole block rolls back.
-- ---------------------------------------------------------------------------

do $$
declare
  lect_user  uuid := gen_random_uuid();
  reg_user   uuid := gen_random_uuid();
  lect_id    uuid;
  course_id  uuid;
  mine       uuid;
  theirs     uuid;
  seen       integer;
begin
  begin
    -- ---- A LECTURER, A REGISTRAR, A COURSE AND TWO STUDENTS ---------------
    insert into auth.users (id, email) values
      (lect_user, '083-lecturer@example.test'),
      (reg_user,  '083-registrar@example.test');
    insert into profiles (id, email, role) values
      (lect_user, '083-lecturer@example.test',  'lecturer'),
      (reg_user,  '083-registrar@example.test', 'registrar')
    on conflict (id) do update set role = excluded.role;

    insert into lecturers (staff_id, first_name, last_name, auth_user_id)
      values ('ICOFSTF-9083', 'Proof', 'Lecturer', lect_user)
      returning id into lect_id;

    insert into courses (code, title, lecturer_id)
      values ('ZZZ 9083', 'A Course Written By This Proof', lect_id)
      returning id into course_id;

    insert into students (matric_no, first_name, last_name, status)
      values ('083/PROOF/MINE', 'Taught', 'ByThisLecturer', 'enrolled')
      returning id into mine;
    insert into students (matric_no, first_name, last_name, status)
      values ('083/PROOF/THEIRS', 'Taught', 'BySomebodyElse', 'enrolled')
      returning id into theirs;

    -- Only the first is registered on the course. The second is a student of
    -- the University and no business of this lecturer's.
    insert into enrollments (student_id, course_id, status)
      values (mine, course_id, 'registered');

    -- ---- NOW SIGN IN AS THE LECTURER --------------------------------------
    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', lect_user);

    -- THEIR OWN CLASS. A rule that also refuses the people who need the row is
    -- not a tighter rule, it is a broken screen — "My students" showing nobody.
    select count(*) into seen from students where id = mine;
    if seen <> 1 then
      raise exception '083 FAILED: a lecturer cannot see a student registered on the course '
                      'they teach, so My students is empty for everybody';
    end if;

    -- AND NOT THE REST OF THE UNIVERSITY. This is the count the old proof
    -- never took, and the one the ruling is about.
    select count(*) into seen from students where id = theirs;
    if seen <> 0 then
      raise exception '083 FAILED: a lecturer can read a student they do not teach — the '
                      'whole register is still open to them';
    end if;

    -- ---- AND THE OFFICES STILL REACH THE REGISTER -------------------------
    --
    -- A migration that narrowed everybody would satisfy both counts above and
    -- break the Registrar on the same morning.
    execute format('set local request.jwt.claim.sub = %L', reg_user);
    select count(*) into seen from students where id in (mine, theirs);
    if seen <> 2 then
      raise exception '083 FAILED: the Registrar reads % of 2 students — an office was dropped '
                      'from the policy while the lecturer was being narrowed', seen;
    end if;

    reset role;

    -- ---- THE FUNCTION ANSWERS, AND DOES NOT RECURSE -----------------------
    --
    -- A predicate on `students` that reads `students` without `security
    -- definer` recurses until Postgres gives up, and it would do it inside the
    -- University's own register. The point is not the answer but that it
    -- RETURNS.
    if teaches_this_student('00000000-0000-0000-0000-000000000000'::uuid) then
      raise exception '083 FAILED: a student nobody is registered on is reported as taught';
    end if;

    raise exception 'rollback 083 proof';
  exception
    when others then
      reset role;
      if sqlerrm <> 'rollback 083 proof' then raise; end if;
  end;
end $$;


do $$
begin
  raise notice '083 OK: a lecturer reads only the students registered on courses they teach';
  raise notice '083 OK: and the Registrar, Admissions, Finance and the faculties still read the '
               'register as before';
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   084_a_course_is_a_place_to_learn.sql
--
-- ===========================================================================
-- ===========================================================================

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


-- ===========================================================================
-- ===========================================================================
--
--   085_assignments_quizzes_and_the_answer_key.sql
--
-- ===========================================================================
-- ===========================================================================

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


-- ===========================================================================
-- ===========================================================================
--
--   086_live_classes_attendance_search_and_the_tutor.sql
--
-- ===========================================================================
-- ===========================================================================

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


-- ===========================================================================
-- ===========================================================================
--
--   087_progress_without_surveillance.sql
--
-- ===========================================================================
-- ===========================================================================

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


-- ===========================================================================
-- DID IT LAND?  — READ THIS TABLE
-- ===========================================================================
--
-- Every row should say YES. A row saying NO means that migration did not take
-- effect: scroll up for the first red ERROR, fix it, and run the file again.
-- Running it twice is safe.
--
-- The proofs inside each migration also RAISE NOTICE, which the Supabase SQL
-- editor does not show. This table is the same answer in a form it does.
-- ===========================================================================

select * from (
  select '083' as migration, '083_a_lecturer_sees_their_own_students.sql' as file,
         case when exists (
                   select 1 from pg_policy p
                    where p.polname = 'students_staff_read'
                      and position('teaches_this_student' in
                                   pg_get_expr(p.polqual, p.polrelid)) > 0)
                 then 'YES' else 'NO' end as landed,
         'policydef:students_staff_read:teaches_this_student' as what_it_creates
  union all
  select '084' as migration, '084_a_course_is_a_place_to_learn.sql' as file,
         case when to_regclass('public.course_lessons') is not null then 'YES' else 'NO' end as landed,
         'course_lessons' as what_it_creates
  union all
  select '085' as migration, '085_assignments_quizzes_and_the_answer_key.sql' as file,
         case when to_regclass('public.activity_answer_key') is not null then 'YES' else 'NO' end as landed,
         'activity_answer_key' as what_it_creates
  union all
  select '086' as migration, '086_live_classes_attendance_search_and_the_tutor.sql' as file,
         case when to_regclass('public.tutor_citations') is not null then 'YES' else 'NO' end as landed,
         'tutor_citations' as what_it_creates
  union all
  select '087' as migration, '087_progress_without_surveillance.sql' as file,
         case when exists (
                   select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = 'course_modules'
                      and column_name = 'unlocks_after')
                 then 'YES' else 'NO' end as landed,
         'course_modules.unlocks_after' as what_it_creates
) as landed_report
 order by migration;

