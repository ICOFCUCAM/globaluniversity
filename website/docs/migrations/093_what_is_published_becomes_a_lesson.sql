-- ===========================================================================
-- 093 — WHAT IS PUBLISHED BECOMES A LESSON, AND THE REST OF THE STUDIO
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- ONE THING CLOSES AND IT IS SMALL, SO IT IS SAID FIRST:
--
--     A STUDENT CAN NO LONGER CHANGE THEIR OWN WORKING LANGUAGE.
--
-- `profiles.working_language` is added by this migration and immediately
-- revoked from every browser session at the column level. Nobody loses
-- anything they have today — the column does not exist yet — but the rule is
-- set now rather than after somebody has come to rely on the other behaviour.
--
-- Why it is locked at all: the working language is the academic environment.
-- Notes, transcript, audio, quizzes and the Course AI all come in it, and a
-- student who switches it mid-term is examined on material they have not been
-- reading. The Registry changes it, and `working_language_history` records
-- who and why. The VOICE and the SPEED are the student's own and stay theirs.
--
-- Everything else here is new tables and new columns. No existing row moves.
--
-- ---------------------------------------------------------------------------
-- THE JOIN THE UNIVERSITY ASKED FOR
-- ---------------------------------------------------------------------------
--
-- Asked in September 2026, and answered yes: "should a published artefact
-- also be written as a `course_lessons` row, so the Learning Hub screens you
-- already have display it without knowing the Studio exists?"
--
-- So publishing does two things now. The artefact reaches `published`, and a
-- lesson appears in the module the lecturer put the lecture in — the same
-- table 084 created, read by the same policy, shown by the same screens.
--
-- AND IT ONLY HAPPENS WHERE THE LECTURER SAID WHICH MODULE.
-- `course_lessons.module_id` is NOT NULL, so a lesson cannot be written
-- without one, and this migration does not invent one. `lectures.module_id`
-- is nullable: a lecture with no module publishes to the Studio's own screens
-- and no further. Guessing a module would be this system deciding where a
-- lecturer's teaching sits in their own course.
--
-- WITHDRAWING HIDES THE LESSON, IT DOES NOT DELETE IT. A student's notes,
-- bookmarks, highlights and progress all point at the lesson row; deleting it
-- would take a student's own work away as a side effect of a lecturer
-- reconsidering a paragraph. `visible` goes false and everything is still
-- there when it comes back.
--
-- ---------------------------------------------------------------------------
-- WHY PRACTICE IS NOT A SUBMISSION
-- ---------------------------------------------------------------------------
--
-- `study_aid_attempts` looks exactly like `activity_submissions` and merging
-- them would be wrong.
--
-- A submission is COURSEWORK: it has an answer key it is marked against (085
-- put that key in its own table, because row-level security cannot hide a
-- column), a marker, a returned date, and it is part of the student's result.
--
-- A study-aid quiz is PRACTICE. The student generated it themselves, they may
-- take it eleven times, and nobody marks it.
--
-- One table would put eleven practice attempts in the structure the gradebook
-- reads, and somebody would eventually average them. So `study_aid_attempts`
-- carries no marker, no answer key, no feedback and no return — the ABSENCE
-- is the point, and the proof below asserts the columns are not there rather
-- than a comment claiming they are not.
--
-- ---------------------------------------------------------------------------
-- AND WHY `lesson_progress` NEEDED NOTHING
-- ---------------------------------------------------------------------------
--
-- The reconciliation expected to add a nullable `lecture_id` to it. Measured
-- instead: `lesson_progress.lesson_id` is NOT NULL, and once a published
-- artefact IS a lesson, the Studio's progress is progress on that lesson.
-- Nothing is added, nothing is duplicated, and 087's rulings — including the
-- deliberate omission of `seconds_spent` from `course_progress_for_teaching`
-- — cover the Studio without being restated.
--
-- The cost, stated rather than discovered later: material in somebody's
-- PERSONAL library has no lesson and therefore no progress record. That is
-- the right answer anyway. There is no cohort, no lecturer and nobody to
-- report to; a personal library that tracked its owner would be surveillance
-- with an audience of one.
-- ===========================================================================


-- ===========================================================================
-- WHICH MODULE THE LECTURE BELONGS TO
-- ===========================================================================

alter table lectures add column if not exists module_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lectures_module_agrees') then
    alter table lectures add constraint lectures_module_agrees
      foreign key (module_id, course_id) references course_modules (id, course_id)
      on delete set null;
  end if;
end $$;

comment on column lectures.module_id is
  'Which module of the course this lecture belongs to. NULLABLE on purpose: a lecture with no '
  'module publishes to the Studio''s own screens and no further, because course_lessons.module_id '
  'is NOT NULL and guessing one would be this system deciding where a lecturer''s teaching sits.';


-- ===========================================================================
-- PUBLISHING WRITES THE LESSON
-- ===========================================================================

alter table course_lessons add column if not exists artefact_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'course_lessons_artefact_fk') then
    alter table course_lessons add constraint course_lessons_artefact_fk
      foreign key (artefact_id) references lecture_artefacts (id) on delete set null;
  end if;
end $$;

create unique index if not exists course_lessons_one_per_artefact
  on course_lessons (artefact_id) where artefact_id is not null;

comment on column course_lessons.artefact_id is
  'The published lecture artefact this lesson displays, when it came from the Lecture Studio. '
  'NULL for every lesson a lecturer wrote directly, which is most of them.';

-- ---------------------------------------------------------------------------
-- WHICH ARTEFACTS A STUDENT IS MEANT TO OPEN
--
-- Not all of them. `teaching_script` is the instruction for generating the
-- audio and `knowledge_extract` is what the tutor retrieves from — both are
-- machinery, and putting them in a student's module list would be filing the
-- workings beside the answer.
-- ---------------------------------------------------------------------------
create or replace function lesson_kind_for_artefact(the_kind text)
returns text
language sql
immutable
as $$
  select case the_kind
    when 'structured_notes'   then 'text'
    when 'corrected_text'     then 'text'
    when 'transcript'         then 'text'
    when 'revision_materials' then 'text'
    when 'audio_15min'        then 'audio'
    when 'recording'          then 'audio'
    else null
  end;
$$;

comment on function lesson_kind_for_artefact(text) is
  'The course_lessons.kind a published artefact appears as, or NULL for the ones a student is '
  'not meant to open: the teaching script and the knowledge extract are machinery.';

create or replace function publish_artefact_as_lesson()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  the_lecture  record;
  the_kind     text;
  next_order   integer;
begin
  select l.module_id, l.title, l.context, l.course_id
    into the_lecture
    from lectures l where l.id = new.lecture_id;

  -- A PERSONAL LECTURE HAS NO COHORT, so it never becomes a lesson.
  if the_lecture.context <> 'course' or the_lecture.module_id is null then
    return new;
  end if;

  the_kind := lesson_kind_for_artefact(new.kind);
  if the_kind is null then
    return new;
  end if;

  if new.state = 'published' then
    if exists (select 1 from course_lessons where artefact_id = new.id) then
      update course_lessons
         set title      = the_lecture.title,
             body       = case when the_kind = 'text' then new.body else body end,
             media_path = case when the_kind = 'audio' then new.media_path else media_path end,
             transcript = new.body,
             visible    = true,
             updated_at = now()
       where artefact_id = new.id;
    else
      select coalesce(max(sort_order), 0) + 1 into next_order
        from course_lessons where module_id = the_lecture.module_id;

      insert into course_lessons (
        module_id, course_id, kind, title, body, media_path, transcript,
        sort_order, visible, created_by, artefact_id)
      values (
        the_lecture.module_id, the_lecture.course_id, the_kind, the_lecture.title,
        case when the_kind = 'text' then coalesce(new.body, '') else null end,
        case when the_kind = 'audio' then new.media_path else null end,
        new.body, next_order, true, new.owner_id, new.id);
    end if;

  -- ---- WITHDRAWN: HIDDEN, NEVER DELETED --------------------------------
  --
  -- A student's notes, bookmarks, highlights and progress all point at this
  -- lesson row. Deleting it would take a student's own work away as a side
  -- effect of a lecturer reconsidering a paragraph.
  elsif tg_op = 'UPDATE' and coalesce(old.state, 'absent') = 'published' then
    update course_lessons
       set visible = false, updated_at = now()
     where artefact_id = new.id;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- ON INSERT AS WELL AS UPDATE, AND THE PROOF IS WHY
--
-- This fired on UPDATE alone, which covers every path the application takes:
-- an artefact is created `absent`, a job moves it to `queued`, `running`,
-- `ready`, the lecturer approves and publishes.
--
-- It does not cover a row INSERTED already published — a bulk import, a
-- restore, a script — which would then exist as published material with no
-- lesson, visible in the Studio and absent from the course. Found while
-- breaking the proof rather than by reading this, because the break that was
-- supposed to make unapproved work reach students PASSED: the proof was
-- inserting the artefact at `ready` instead of moving it there, so the update
-- path it was checking never ran at all.
-- ---------------------------------------------------------------------------
drop trigger if exists publish_artefact_as_lesson_trg on lecture_artefacts;
create trigger publish_artefact_as_lesson_trg
  after insert or update of state on lecture_artefacts
  for each row execute function publish_artefact_as_lesson();


-- ===========================================================================
-- THE STUDY MATERIAL
-- ===========================================================================

create table if not exists study_aids (
  id             uuid primary key default gen_random_uuid(),
  course_id      uuid not null references courses (id) on delete cascade,
  kind           text not null check (kind in ('test', 'flashcards', 'audio_revision', 'summary')),
  title          text not null check (length(btrim(title)) between 1 and 300),
  lecture_ids    uuid[] not null default '{}',
  requested_by   uuid not null references auth.users (id),

  -- WHO ASKED FOR IT, WHICH DECIDES WHO SEES IT.
  --   'lecturer-requested' — set for the course, and the cohort gets it
  --   'unreviewed'         — a student generated it for themselves
  -- A student's own revision set is not course material and no other student
  -- sees it; the word says so rather than a boolean called `shared`.
  standing       text not null check (standing in ('lecturer-requested', 'unreviewed')),
  audience       text not null default 'private' check (audience in ('course', 'private')),

  state          text not null default 'ready',
  body           text,
  media_path     text,
  brief          jsonb,
  language       text,
  translated_from uuid references study_aids (id) on delete cascade,
  translation_standing text check (translation_standing in ('reviewed', 'unreviewed', 'stale')),
  created_at     timestamptz not null default now(),

  -- A COURSE-WIDE AID IS THE LECTURER'S. A student cannot generate something
  -- and have it appear for the cohort.
  constraint study_aids_course_wide_is_the_lecturers
    check (audience = 'private' or standing = 'lecturer-requested')
);

comment on table study_aids is
  'Generated revision material: a test, flashcards, an audio revision, a summary. Distinct from '
  'course_activities, which a lecturer authors and which is marked.';

create index if not exists study_aids_course_idx on study_aids (course_id, audience);
create index if not exists study_aids_owner_idx  on study_aids (requested_by);

-- ---------------------------------------------------------------------------
-- PRACTICE, WHICH IS NOT A SUBMISSION
--
-- See the header. There is no `mark`, no `marked_by`, no `feedback`, no
-- `returned_at` and no answer key, and the proof asserts their absence.
-- ---------------------------------------------------------------------------
create table if not exists study_aid_attempts (
  id            uuid primary key default gen_random_uuid(),
  study_aid_id  uuid not null references study_aids (id) on delete cascade,
  course_id     uuid not null references courses (id) on delete cascade,
  person_id     uuid not null references auth.users (id),
  given         jsonb not null default '{}'::jsonb,
  score         integer not null default 0,
  out_of        integer not null default 0,
  taken_at      timestamptz not null default now()
);

comment on table study_aid_attempts is
  'A practice attempt at a generated quiz. NOT coursework: no marker, no answer key, no return, '
  'and no place in the gradebook. Taking it eleven times is the intended use.';

create index if not exists study_aid_attempts_person_idx
  on study_aid_attempts (person_id, taken_at desc);

create table if not exists study_recalls (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references auth.users (id),
  course_id     uuid not null references courses (id) on delete cascade,
  study_aid_id  uuid not null references study_aids (id) on delete cascade,
  card          text not null,
  rung          integer not null default 0,
  seen          integer not null default 0,
  wrong         integer not null default 0,
  last_at       timestamptz not null default now(),
  due_at        timestamptz not null,
  unique (person_id, study_aid_id, card)
);

comment on table study_recalls is
  'Spaced repetition: which card, which rung of the ladder, when it is next due. The student''s '
  'own, and nobody else''s business — not the lecturer''s.';


-- ===========================================================================
-- THE QUEUE, AND WHAT THE MODEL COST
-- ===========================================================================

create table if not exists processing_jobs (
  id            uuid primary key default gen_random_uuid(),
  lecture_id    uuid not null references lectures (id) on delete cascade,
  course_id     uuid not null references courses (id) on delete cascade,
  kind          text not null,
  actor_id      uuid not null references auth.users (id),
  actor_role    text not null,
  state         text not null default 'queued'
                check (state in ('queued', 'running', 'done', 'failed')),
  attempts      integer not null default 0,
  position      integer not null default 0,
  options       jsonb,
  error         text,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

comment on table processing_jobs is
  'The transformation queue. A job is visible to the person who queued it and to whoever owns '
  'the lecture; it is not course material and no student reads it.';

create index if not exists processing_jobs_state_idx on processing_jobs (state, position);

create table if not exists ai_run_costs (
  id             uuid primary key default gen_random_uuid(),
  course_id      uuid not null references courses (id) on delete cascade,
  lecture_id     uuid not null references lectures (id) on delete cascade,
  stage          text not null,
  produced_by    text not null,
  input_tokens   integer,
  output_tokens  integer,
  characters_in  integer not null default 0,
  characters_out integer not null default 0,
  at             timestamptz not null default now()
);

create table if not exists ai_usage (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references auth.users (id),
  period     text not null,
  minutes    integer not null,
  lecture_id uuid references lectures (id) on delete set null,
  at         timestamptz not null default now()
);

comment on table ai_run_costs is
  'What each model call cost, by stage. The University''s bill, read by the offices that pay it '
  'and by nobody else.';


-- ===========================================================================
-- A PERSONAL INBOX, WHICH IS NOT AN ANNOUNCEMENT
-- ===========================================================================
--
-- The University has `announcements` — seven tables of BROADCAST, with
-- destinations, variants, media and metrics. "Your lecture has finished
-- processing" is not an announcement: it is addressed to one person, nobody
-- composes it, and it has no audience to measure.
-- ===========================================================================

create table if not exists notifications (
  id        uuid primary key default gen_random_uuid(),
  person_id uuid not null references auth.users (id) on delete cascade,
  kind      text not null,
  title     text not null,
  body      text,
  link      text,
  at        timestamptz not null default now(),
  read_at   timestamptz
);

create index if not exists notifications_person_idx
  on notifications (person_id, at desc) where read_at is null;

comment on table notifications is
  'One person''s inbox. Distinct from announcements, which is broadcast — this is addressed, '
  'nobody composes it, and there is no audience to measure.';


-- ===========================================================================
-- THE LEARNING PROFILE
-- ===========================================================================
--
-- Two layers, deliberately unlike each other.
--
-- THE WORKING LANGUAGE is the academic environment — notes, transcript,
-- audio, quizzes and the Course AI all arrive in it. It is set once, and the
-- Registry changes it with a reason recorded, because a student who switches
-- it mid-term is examined on material they have not been reading.
--
-- THE VOICE AND THE SPEED are how it sounds. Those are the student's own and
-- they may change them whenever they like.
-- ===========================================================================

alter table profiles add column if not exists working_language text;
alter table profiles add column if not exists voice_preference text;
alter table profiles add column if not exists audio_speed numeric(3,2);
alter table profiles add column if not exists voice_consent jsonb;
alter table profiles add column if not exists accessibility jsonb;
alter table profiles add column if not exists working_language_history jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- WHICH OF THESE A BROWSER MAY WRITE, AND HOW THAT IS ACTUALLY ENFORCED
--
-- MEASURED BEFORE BEING WRITTEN, and the measurement changed the design.
--
-- The first draft of this migration revoked `update (working_language)` from
-- `authenticated`, on the model of 090's `password_set_at`. Reading the grants
-- on a landed database rather than assuming them:
--
--     authenticated | avatar_url      <- UPDATE, column-level
--     authenticated | full_name       <- UPDATE, column-level
--
-- and NO table-level UPDATE on `profiles` at all. So a browser session could
-- already write exactly two columns, the revoke had nothing to take away, and
-- the new columns were unwritable by anybody — including the student, whose
-- voice and speed are supposed to be their own. The proof caught it: it tried
-- to set the speed and got `permission denied for table profiles`.
--
-- SO THE LOCK IS THE ABSENCE OF A GRANT, not a revoke. `working_language` and
-- `working_language_history` are simply never granted, and the Registry writes
-- them with the service key.
--
-- The revokes below are kept and are deliberately belt-and-braces: they state
-- the intent in the ACL, and they would bite if somebody later granted the
-- column. They would NOT survive a table-level `grant update on profiles`,
-- which overrides column-level revokes — which is exactly why the proof
-- asserts the refusal by attempting the write, rather than reading the ACL and
-- believing it.
-- ---------------------------------------------------------------------------
do $$
begin
  execute 'revoke update (working_language) on profiles from anon, authenticated';
  execute 'revoke update (working_language_history) on profiles from anon, authenticated';
exception
  -- Nothing to take away is the desired end state, not a failure.
  when undefined_object or invalid_grant_operation then null;
end $$;

-- WHAT IS THE PERSON'S OWN. The voice it is read in, how fast, what
-- adjustments they need, and whether their own voice may be synthesised — a
-- consent nobody else should be able to give on their behalf, and which they
-- must be able to withdraw without asking permission.
grant update (voice_preference, audio_speed, accessibility, voice_consent)
  on profiles to authenticated;

-- AND THE REGISTRY'S, through a server route holding the service key.
grant update (working_language, working_language_history) on profiles to service_role;

comment on column profiles.working_language is
  'The academic environment''s language. The Registry sets it; the account holder cannot, '
  'because a mid-term switch means being examined on material you have not been reading.';


-- ===========================================================================
-- ROW-LEVEL SECURITY
-- ===========================================================================

alter table study_aids         enable row level security;
alter table study_aid_attempts enable row level security;
alter table study_recalls      enable row level security;
alter table processing_jobs    enable row level security;
alter table ai_run_costs       enable row level security;
alter table ai_usage           enable row level security;
alter table notifications      enable row level security;

-- ---- STUDY AIDS -----------------------------------------------------------
drop policy if exists study_aids_read  on study_aids;
drop policy if exists study_aids_write on study_aids;

create policy study_aids_read on study_aids
  for select using (
       requested_by = auth.uid()
    or (audience = 'course' and is_enrolled_on_course(course_id))
    or (audience = 'course' and teaches_this_course(course_id))
  );

create policy study_aids_write on study_aids
  for all using (requested_by = auth.uid()) with check (
    requested_by = auth.uid()
    and (audience = 'private' or teaches_this_course(course_id))
  );

-- ---- PRACTICE, RECALL, USAGE: THE PERSON'S OWN ----------------------------
--
-- AND NOT THE LECTURER'S. 087 settled what a lecturer may see of a student's
-- study: participation and completion, through `course_progress_for_teaching`,
-- which deliberately has no `seconds_spent`. How many times somebody failed a
-- flashcard at eleven at night is not an academic indicator.
drop policy if exists study_aid_attempts_own on study_aid_attempts;
create policy study_aid_attempts_own on study_aid_attempts
  for all using (person_id = auth.uid()) with check (person_id = auth.uid());

drop policy if exists study_recalls_own on study_recalls;
create policy study_recalls_own on study_recalls
  for all using (person_id = auth.uid()) with check (person_id = auth.uid());

drop policy if exists ai_usage_own on ai_usage;
create policy ai_usage_own on ai_usage
  for select using (person_id = auth.uid() or governs_the_curriculum());

-- ---- THE QUEUE ------------------------------------------------------------
drop policy if exists processing_jobs_read  on processing_jobs;
drop policy if exists processing_jobs_write on processing_jobs;

create policy processing_jobs_read on processing_jobs
  for select using (actor_id = auth.uid() or owns_this_lecture(lecture_id));

create policy processing_jobs_write on processing_jobs
  for all using (actor_id = auth.uid()) with check (actor_id = auth.uid());

-- ---- THE BILL -------------------------------------------------------------
drop policy if exists ai_run_costs_read on ai_run_costs;
create policy ai_run_costs_read on ai_run_costs
  for select using (governs_the_curriculum() or teaches_this_course(course_id));

-- ---- THE INBOX ------------------------------------------------------------
drop policy if exists notifications_own on notifications;
create policy notifications_own on notifications
  for all using (person_id = auth.uid()) with check (person_id = auth.uid());

revoke insert, update, delete, truncate, references, trigger
  on study_aids, study_aid_attempts, study_recalls, processing_jobs,
     ai_run_costs, ai_usage, notifications from anon;
revoke truncate, references, trigger
  on study_aids, study_aid_attempts, study_recalls, processing_jobs,
     ai_run_costs, ai_usage, notifications from authenticated;

grant select on study_aids, study_aid_attempts, study_recalls, processing_jobs,
                ai_run_costs, ai_usage, notifications to anon, authenticated;
grant insert, update, delete on study_aids, study_aid_attempts, study_recalls,
                processing_jobs, notifications to authenticated;


-- ===========================================================================
-- THE PROOF
-- ===========================================================================

do $$
declare
  lect_user  uuid := gen_random_uuid();
  in_user    uuid := gen_random_uuid();
  out_user   uuid := gen_random_uuid();
  lect_id    uuid;
  the_course uuid;
  other_course uuid;
  other_module uuid;
  mine       uuid;
  theirs     uuid;
  the_module uuid;
  the_lecture uuid;
  the_artefact uuid;
  the_lesson uuid;
  the_aid    uuid;
  seen       integer;
begin
  begin
    insert into auth.users (id, email) values
      (lect_user, '093-lecturer@example.test'),
      (in_user,   '093-enrolled@example.test'),
      (out_user,  '093-stranger@example.test');
    insert into profiles (id, email, role) values
      (lect_user, '093-lecturer@example.test', 'lecturer'),
      (in_user,   '093-enrolled@example.test', 'student'),
      (out_user,  '093-stranger@example.test', 'student')
    on conflict (id) do update set role = excluded.role;

    insert into lecturers (staff_id, first_name, last_name, auth_user_id)
      values ('ICOFSTF-9093', 'Proof', 'Lecturer', lect_user) returning id into lect_id;
    insert into courses (code, title, lecturer_id)
      values ('ZZZ 9093', 'A Course Written By The 093 Proof', lect_id)
      returning id into the_course;
    insert into courses (code, title)
      values ('ZZZ 9093B', 'A Second Course, For The Module Key')
      returning id into other_course;

    insert into students (matric_no, first_name, last_name, status, auth_user_id)
      values ('093/PROOF/IN', 'On', 'TheCourse', 'enrolled', in_user) returning id into mine;
    insert into students (matric_no, first_name, last_name, status, auth_user_id)
      values ('093/PROOF/OUT', 'Not', 'OnIt', 'enrolled', out_user) returning id into theirs;
    insert into enrollments (student_id, course_id, status)
      values (mine, the_course, 'registered');

    insert into course_modules (course_id, title, visible, sort_order)
      values (the_course, 'Module written by the 093 proof', true, 1)
      returning id into the_module;
    insert into course_modules (course_id, title, visible, sort_order)
      values (other_course, 'A module of the OTHER course', true, 1)
      returning id into other_module;

    insert into lectures (course_id, module_id, sequence, title, owner_id, created_by)
      values (the_course, the_module, 1, 'A lecture given by the 093 proof',
              lect_user, lect_user)
      returning id into the_lecture;

    -- ---- 095 PUTS A STOP IN FRONT OF THIS ---------------------------------
    --
    -- This proof walks an artefact absent → queued → running → ready, and 095
    -- refuses `queued` on a lecture the University has not accepted. So it
    -- accepts its own submission first — GUARDED, because on a fresh database
    -- 093 runs before 095 exists and the column is not there yet.
    --
    -- FOUND BY RUNNING RUN-ALL TWICE, and only by that. The first pass was
    -- clean because 095's trigger did not exist when 093's proof ran; the
    -- second pass, with everything landed, failed on this line. Idempotent is
    -- a claim until the second run is clean, and this is what that rule is
    -- for.
    if exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = 'lectures'
                  and column_name = 'review_state') then
      execute format('update lectures set review_state = %L, reviewed_at = now() where id = %L',
                     'accepted', the_lecture);
    end if;

    -- ---- A LECTURE CANNOT SIT IN ANOTHER COURSE'S MODULE ------------------
    --
    -- A REAL SECOND MODULE, on a REAL second course. 084 learned that an
    -- invented uuid proves nothing here: the plain foreign key refuses it and
    -- the composite key is never consulted.
    begin
      update lectures set module_id = other_module where id = the_lecture;
      raise exception '093 FAILED: a lecture was accepted into a module of a different course, '
                      'so the lesson it publishes would appear in the wrong course';
    exception
      when foreign_key_violation then null;
    end;

    -- ---- PUBLISHING WRITES THE LESSON ------------------------------------
    -- CREATED, THEN MOVED — which is how the pipeline actually works, and the
    -- reason this is not inserted at 'ready' directly: the trigger under test
    -- fires on the transition, so an artefact inserted already at 'ready'
    -- never exercises it. The first version of this proof did exactly that,
    -- and the break that makes unapproved work reach students PASSED.
    insert into lecture_artefacts (lecture_id, course_id, kind, origin, owner_id, body)
      values (the_lecture, the_course, 'structured_notes', 'ai', lect_user,
              'The notes the model made of the lecture.')
      returning id into the_artefact;

    update lecture_artefacts set state = 'queued'  where id = the_artefact;
    update lecture_artefacts set state = 'running' where id = the_artefact;
    update lecture_artefacts set state = 'ready'   where id = the_artefact;

    select count(*) into seen from course_lessons where artefact_id = the_artefact;
    if seen <> 0 then
      raise exception '093 FAILED: an artefact that is only READY already appears as a lesson, '
                      'so students are reading what the lecturer has not approved';
    end if;

    update lecture_artefacts set state = 'approved', approved_by = lect_user, approved_at = now()
     where id = the_artefact;
    select count(*) into seen from course_lessons where artefact_id = the_artefact;
    if seen <> 0 then
      raise exception '093 FAILED: an APPROVED artefact appears as a lesson before it was '
                      'published — approving and releasing are two decisions';
    end if;

    update lecture_artefacts set state = 'published', published_at = now()
     where id = the_artefact;
    select id into the_lesson from course_lessons where artefact_id = the_artefact;
    if the_lesson is null then
      raise exception '093 FAILED: publishing an artefact did not write a lesson, so the '
                      'Learning Hub shows nothing the Studio produced';
    end if;

    -- AND THE STUDENT SEES IT THROUGH THE POLICY 084 ALREADY WROTE.
    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', in_user);
    select count(*) into seen from course_lessons where id = the_lesson;
    if seen <> 1 then
      raise exception '093 FAILED: a student on the course cannot see the lesson publishing '
                      'created';
    end if;
    execute format('set local request.jwt.claim.sub = %L', out_user);
    select count(*) into seen from course_lessons where id = the_lesson;
    if seen <> 0 then
      raise exception '093 FAILED: a student NOT on the course can see the lesson publishing '
                      'created';
    end if;
    reset role;

    -- ---- AND AN ARTEFACT THAT ARRIVES ALREADY PUBLISHED ------------------
    --
    -- A bulk import, a restore, a script. No transition happens, so a trigger
    -- watching only UPDATE sees nothing and the material exists as published
    -- with no lesson — present in the Studio, absent from the course.
    insert into lecture_artefacts (lecture_id, course_id, kind, origin, owner_id,
                                   state, approved_by, approved_at, published_at, media_path)
      values (the_lecture, the_course, 'audio_15min', 'ai', lect_user,
              'published', lect_user, now(), now(), 'audio/093-proof.mp3');
    select count(*) into seen from course_lessons cl
      join lecture_artefacts a on a.id = cl.artefact_id
     where a.lecture_id = the_lecture and a.kind = 'audio_15min';
    if seen <> 1 then
      raise exception '093 FAILED: an artefact inserted already published wrote no lesson, so '
                      'imported or restored material is published and reaches nobody';
    end if;

    -- ---- WITHDRAWING HIDES IT AND KEEPS THE STUDENT'S WORK ---------------
    insert into lesson_progress (lesson_id, student_id) values (the_lesson, mine);
    insert into student_notes (student_id, course_id, lesson_id, body)
      values (mine, the_course, the_lesson, 'What the student thought of it.');

    update lecture_artefacts set state = 'approved', published_at = null where id = the_artefact;

    select count(*) into seen from course_lessons where id = the_lesson;
    if seen <> 1 then
      raise exception '093 FAILED: withdrawing an artefact DELETED the lesson, taking a '
                      'student''s notes and progress with it';
    end if;
    select count(*) into seen from course_lessons where id = the_lesson and visible = false;
    if seen <> 1 then
      raise exception '093 FAILED: withdrawing an artefact left the lesson visible, so a '
                      'lecturer cannot take back what they released';
    end if;
    select count(*) into seen from student_notes where lesson_id = the_lesson;
    if seen <> 1 then
      raise exception '093 FAILED: the student''s own note did not survive the withdrawal';
    end if;

    -- ---- PRACTICE IS NOT COURSEWORK --------------------------------------
    --
    -- The absence asserted, rather than a comment claiming it. If somebody
    -- later adds a mark to this table, this is what says so.
    select count(*) into seen from information_schema.columns
     where table_schema = 'public' and table_name = 'study_aid_attempts'
       and column_name in ('mark', 'marked_by', 'marked_at', 'feedback', 'returned_at');
    if seen <> 0 then
      raise exception '093 FAILED: study_aid_attempts has grown a marking column, so practice '
                      'is now sitting in the structure the gradebook reads';
    end if;

    insert into study_aids (course_id, kind, title, requested_by, standing, audience)
      values (the_course, 'flashcards', 'A student''s own revision set', in_user,
              'unreviewed', 'private')
      returning id into the_aid;

    -- A STUDENT CANNOT PUBLISH TO THE COHORT.
    begin
      insert into study_aids (course_id, kind, title, requested_by, standing, audience)
        values (the_course, 'test', 'A student''s quiz, claimed for the class', in_user,
                'unreviewed', 'course');
      raise exception '093 FAILED: a student generated a study aid and had it appear for the '
                      'whole cohort';
    exception
      when check_violation then null;
    end;

    insert into study_aid_attempts (study_aid_id, course_id, person_id, score, out_of)
      values (the_aid, the_course, in_user, 4, 10);

    set local role authenticated;

    -- ANOTHER STUDENT READS NEITHER THE SET NOR THE ATTEMPT.
    execute format('set local request.jwt.claim.sub = %L', out_user);
    select count(*) into seen from study_aids where id = the_aid;
    if seen <> 0 then
      raise exception '093 FAILED: a student can read another student''s private revision set';
    end if;
    select count(*) into seen from study_aid_attempts where study_aid_id = the_aid;
    if seen <> 0 then
      raise exception '093 FAILED: a student can read another student''s practice scores';
    end if;

    -- AND NEITHER DOES THE LECTURER. 087 settled what teaching may see.
    execute format('set local request.jwt.claim.sub = %L', lect_user);
    select count(*) into seen from study_aid_attempts where study_aid_id = the_aid;
    if seen <> 0 then
      raise exception '093 FAILED: a lecturer can read how many times a student failed their '
                      'own flashcards, which 087 ruled is not an academic indicator';
    end if;

    -- THE PERSON WHOSE IT IS, WHICH MUST STILL WORK.
    execute format('set local request.jwt.claim.sub = %L', in_user);
    select count(*) into seen from study_aid_attempts where study_aid_id = the_aid;
    if seen <> 1 then
      raise exception '093 FAILED: a student cannot read their own practice attempt';
    end if;

    -- ---- THE WORKING LANGUAGE IS NOT THE STUDENT'S TO SET ----------------
    begin
      update profiles set working_language = 'fr' where id = in_user;
      raise exception '093 FAILED: a student set their own working language, so they can '
                      'switch the language they are examined in, mid-term, unrecorded';
    exception
      when insufficient_privilege then null;
    end;

    -- AND NOBODY HAS QUIETLY OPENED THE WHOLE TABLE. A table-level UPDATE
    -- grant overrides every column-level revoke above, so the refusal proved
    -- a moment ago would stop being true with nothing else changing.
    select count(*) into seen from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'profiles'
       and privilege_type = 'UPDATE' and grantee in ('anon', 'authenticated');
    if seen <> 0 then
      raise exception '093 FAILED: a browser session holds table-level UPDATE on profiles, '
                      'which overrides every column-level revoke — the working language is '
                      'writable by the account it governs';
    end if;

    -- AND THE VOICE IS THE STUDENT'S, WHICH MUST STILL WORK.
    update profiles set voice_preference = 'lecturer', audio_speed = 1.25 where id = in_user;
    select count(*) into seen from profiles where id = in_user and audio_speed = 1.25;
    if seen <> 1 then
      raise exception '093 FAILED: a student cannot choose their own voice or speed, which are '
                      'theirs and were never meant to be locked';
    end if;

    reset role;

    raise exception 'rollback 093 proof';
  exception
    when others then
      reset role;
      if sqlerrm <> 'rollback 093 proof' then raise; end if;
  end;
end $$;


do $$
begin
  raise notice '093 OK: publishing an artefact writes a lesson into the module the lecturer '
               'chose, and only then — ready and approved write nothing';
  raise notice '093 OK: withdrawing hides the lesson and keeps it, so a student''s notes and '
               'progress survive a lecturer changing their mind';
  raise notice '093 OK: a lecture cannot sit in another course''s module';
  raise notice '093 OK: practice is not coursework — no mark, no marker, no return — and a '
               'student''s attempts are read by neither a classmate nor the lecturer';
  raise notice '093 OK: the working language is the Registry''s to set and the voice is the '
               'student''s own';
end $$;
