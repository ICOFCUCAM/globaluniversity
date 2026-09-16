-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — MIGRATIONS 092, 093, 094, IN ORDER
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-migration-run.mjs
--   Rebuild:   node scripts/build-migration-run.mjs --out=RUN-092-094.sql 092 093 094
--
-- ---------------------------------------------------------------------------
-- HOW TO RUN IT
--
-- Supabase SQL editor: paste the whole file and run once.
-- psql:                psql "<connection string>" -f docs/migrations/RUN-092-094.sql
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
--   092_a_lecture_and_what_is_made_from_it.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 092 — A LECTURE, AND WHAT IS MADE FROM IT
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- NO DOOR CLOSES AND NO EXISTING ROW MOVES. Every table here is new, every
-- policy is on a new table, and nothing the University has today is read,
-- rewritten or reinterpreted. Running this changes what the system CAN hold,
-- not what it holds.
--
-- ONE THING IS NEW AND THE UNIVERSITY SHOULD SEE IT BEFORE RUNNING IT:
--
--     AN ADMINISTRATOR CANNOT READ AN UNPUBLISHED LECTURE, AND CANNOT DELETE
--     A RECORDING. NOT EVEN THE SUPERADMINISTRATOR.
--
-- That is not an oversight and it is not this migration's opinion. It is the
-- founding distinction of the platform the University asked to be integrated
-- "all" of, written in its `src/lib/domain/ownership.ts`:
--
--     THE LECTURER OWNS THE ACADEMIC SOURCE MATERIAL — the recording, and
--     everything the AI makes out of it.
--     THE UNIVERSITY OWNS THE COURSE ENVIRONMENT — the course exists, it runs
--     this session, these students are on it. The university opens the room.
--     It does not write on the board.
--
-- and the line that file draws under it: "THE DELETE LINE IS THE IMPORTANT
-- ONE. If an administrator could delete a lecturer's recording, the lecturer
-- would not own it."
--
-- The offices keep everything they have. They see THAT a lecture was recorded,
-- transformed and published — delivery is the University's business and it is
-- answerable for it — and they read every published word. What they do not get
-- is a lecturer's draft.
--
-- IF THE UNIVERSITY WANTS IT OTHERWISE, SAY SO AND IT CHANGES. It is one
-- policy in this file, and the proof below already watches it refuse, so the
-- refusal would be seen to stop rather than silently stop being true. But it
-- has to be a ruling, not a default, which is why it is at the top of this
-- file rather than in a comment beside the policy.
--
-- ---------------------------------------------------------------------------
-- WHY `lectures` AND NOT `course_lessons`
-- ---------------------------------------------------------------------------
--
-- 084 gave a course modules and lessons. A lesson is PUBLISHED CONTENT: a
-- thing a student opens, reads, watches or does.
--
-- A lecture is a TAUGHT EVENT — delivered on a date, by a person, in a room or
-- on a call, and recorded. One lecture produces several lessons: the corrected
-- text, the structured notes, the fifteen-minute audio, the revision set.
--
-- Collapsing the two would mean either a lesson that carries a recording and a
-- processing state it has no business having, or a lecture that cannot be
-- taught until somebody has decided which lesson it is. They are different
-- things and they are joined, not merged: when an artefact is PUBLISHED, it
-- may also be written as a `course_lessons` row, so the Learning Hub screens
-- that already exist display it without knowing this pipeline is here. That
-- join is drawn in 093, once there is something published to draw it from.
--
-- ---------------------------------------------------------------------------
-- AND WHY AN ARTEFACT CARRIES ITS COURSE
-- ---------------------------------------------------------------------------
--
-- The same reason 084 gave a lesson its course: a policy that joins to the
-- lecture to find the course runs that join on every row of every query.
--
-- And with the same protection, because a denormalised column that can lie is
-- worse than the join it saved. `lectures` carries a unique key on
-- (id, course_id); an artefact's (lecture_id, course_id) is a composite
-- foreign key into it. Postgres refuses an artefact whose course is not its
-- lecture's. The proof below tries it against a REAL second course, because
-- 084 learned that trying it with an invented id proves nothing — the plain
-- `references courses(id)` refuses that one and the composite key is never
-- consulted.
-- ===========================================================================


-- ===========================================================================
-- THE LECTURE
-- ===========================================================================

create table if not exists lectures (
  id             uuid primary key default gen_random_uuid(),
  course_id      uuid not null references courses (id) on delete cascade,

  -- 'course'   — taught to a cohort, and the whole pipeline applies.
  -- 'personal' — somebody's own, and the owner is the only audience.
  context        text not null default 'course'
                 check (context in ('course', 'personal')),

  sequence       integer not null,
  title          text not null check (length(btrim(title)) between 1 and 300),
  abstract       text,
  delivered_on   date,

  -- THE OWNER IS NOT THE CREATOR. A teaching assistant may upload a lecture on
  -- a lecturer's behalf; the material is still the lecturer's, and every rule
  -- about changing it reads `owner_id`. Keeping both means the audit trail can
  -- say who put it there without the ownership line moving.
  owner_id       uuid not null references auth.users (id),
  created_by     uuid not null references auth.users (id),

  source_minutes integer check (source_minutes is null or source_minutes >= 0),
  created_at     timestamptz not null default now(),

  unique (course_id, sequence),

  -- The key an artefact's composite foreign key points at. Redundant with the
  -- primary key by itself; it exists so (lecture_id, course_id) can be a
  -- foreign key, which is what stops an artefact naming the wrong course.
  unique (id, course_id)
);

comment on table lectures is
  'A taught event: delivered on a date, by a person, and recorded. Distinct from '
  'course_lessons, which is published content — one lecture produces several lessons.';

create index if not exists lectures_course_idx on lectures (course_id, sequence);
create index if not exists lectures_owner_idx  on lectures (owner_id);


-- ===========================================================================
-- WHAT THE PIPELINE MAKES FROM IT
-- ===========================================================================

create table if not exists lecture_artefacts (
  id             uuid primary key default gen_random_uuid(),
  lecture_id     uuid not null references lectures (id) on delete cascade,
  course_id      uuid not null references courses (id) on delete cascade,

  kind           text not null check (kind in (
                   'recording', 'transcript', 'corrected_text', 'knowledge_extract',
                   'structured_notes', 'teaching_script', 'audio_15min',
                   'revision_materials')),

  -- WHO MADE THESE WORDS. 'ai' is a first-class answer and it is displayed:
  -- nobody approves machine prose believing a person wrote it.
  origin         text not null check (origin in ('lecturer', 'ai', 'university')),
  owner_id       uuid not null references auth.users (id),

  state          text not null default 'absent' check (state in (
                   'absent', 'queued', 'running', 'ready',
                   'approved', 'published', 'failed')),

  derived_from   uuid references lecture_artefacts (id) on delete set null,

  -- ---- THE LANGUAGES ------------------------------------------------------
  -- Every translation is a derivative of the MASTER, never of another
  -- translation, so nine languages are nine renderings of one lecture rather
  -- than a chain that has drifted.
  language             text,
  translated_from      uuid references lecture_artefacts (id) on delete cascade,
  translation_standing text check (translation_standing in ('reviewed', 'unreviewed', 'stale')),
  reviewed_by          uuid references auth.users (id),
  reviewed_at          timestamptz,

  body           text,
  segments       jsonb,
  parts          jsonb,
  media_path     text,
  media_seconds  integer,
  produced_by    text,
  error          text,

  -- What the checks found: the verification pass, the terminology count, the
  -- translation validator, the word check. Shown to the lecturer on review.
  verification         jsonb,
  terminology          jsonb,
  translation_findings jsonb,
  word_check           jsonb,

  version               integer not null default 0,
  corrected_by_lecturer boolean not null default false,
  stale_since           timestamptz,

  approved_by    uuid references auth.users (id),
  approved_at    timestamptz,
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (lecture_id, kind, language),

  -- THE COLUMN THAT CANNOT LIE. See the header.
  constraint lecture_artefacts_lecture_agrees
    foreign key (lecture_id, course_id) references lectures (id, course_id)
    on delete cascade,

  -- ---- A PERSON STANDS BEHIND IT, OR IT IS NOT APPROVED ------------------
  --
  -- The AI proposes; it never approves and never publishes. This is that
  -- sentence as a constraint rather than a paragraph: a row cannot reach
  -- 'approved' or 'published' with nobody's name on it.
  constraint lecture_artefacts_approved_by_a_person
    check (state not in ('approved', 'published') or approved_by is not null)
);

comment on table lecture_artefacts is
  'One row per pipeline stage per lecture per language. The state machine — absent, queued, '
  'running, ready, approved, published — is what makes lecturer review enforceable rather '
  'than recommended.';

create index if not exists lecture_artefacts_lecture_idx on lecture_artefacts (lecture_id);
create index if not exists lecture_artefacts_course_idx  on lecture_artefacts (course_id, state);
create index if not exists lecture_artefacts_owner_idx   on lecture_artefacts (owner_id);


-- ---------------------------------------------------------------------------
-- PUBLISHING WHAT NOBODY APPROVED
-- ---------------------------------------------------------------------------
--
-- The constraint above says an approved row has an approver. It does not say
-- a row cannot go straight from 'ready' to 'published' with `approved_by`
-- filled in by the same statement — which is the publishing of unapproved
-- machine prose, arrived at by writing two columns at once.
--
-- The pipeline states allow it structurally. `ownership.ts` refuses it in the
-- application. This refuses it in the database, which is where it has to be
-- refused as well, because the application is one client of this table.
-- ---------------------------------------------------------------------------
create or replace function artefact_publish_needs_approval()
returns trigger
language plpgsql
as $$
begin
  if new.state = 'published' and coalesce(old.state, 'absent') not in ('approved', 'published') then
    raise exception 'An artefact is approved before it is published: publishing puts it in '
                    'front of students under the lecturer''s name. It is at %, not approved.',
                    coalesce(old.state, 'absent')
      using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists artefact_publish_needs_approval_trg on lecture_artefacts;
create trigger artefact_publish_needs_approval_trg
  before update on lecture_artefacts
  for each row execute function artefact_publish_needs_approval();


-- ===========================================================================
-- EVERY EARLIER BODY
-- ===========================================================================
--
-- The correction history IS the product: a lecturer reads what the model
-- produced, corrects what it got wrong, and the record of that correction is
-- how the University can answer "did a person check this?" years later.
--
-- A STUDENT NEVER READS THIS TABLE, and that is the sharp edge of it. Version
-- 1 is the machine's first draft of somebody's speech. A student reading the
-- history would be reading exactly what approval exists to keep from them,
-- through a table nobody thought of as content. The proof below watches it
-- refuse.
-- ===========================================================================

create table if not exists artefact_versions (
  id               uuid primary key default gen_random_uuid(),
  artefact_id      uuid not null references lecture_artefacts (id) on delete cascade,
  version          integer not null,
  body             text,
  media_path       text,
  authored_by      text not null,
  authored_by_name text,
  origin           text not null check (origin in ('lecturer', 'ai', 'university')),
  note             text,
  created_at       timestamptz not null default now(),
  unique (artefact_id, version)
);

comment on table artefact_versions is
  'Every earlier body of an artefact, with who wrote it and why. Read by the owner and by a '
  'lecturer on the course; never by a student, because version 1 is the unapproved draft.';

create index if not exists artefact_versions_artefact_idx
  on artefact_versions (artefact_id, version desc);


-- ===========================================================================
-- THE KNOWLEDGE THE COURSE AI ANSWERS OUT OF
-- ===========================================================================
--
-- NOT `course_content_search`, WHICH ALREADY EXISTS. 086's view searches
-- CONTENT — the lessons and activities a course holds, as they are written.
-- This is DERIVED KNOWLEDGE: what the lecture established, extracted into
-- nodes the tutor retrieves and cites. One is an index of what is there; the
-- other is a reading of it.
-- ===========================================================================

create table if not exists lecture_knowledge (
  lecture_id   uuid primary key references lectures (id) on delete cascade,
  course_id    uuid not null references courses (id) on delete cascade,
  nodes        jsonb not null default '[]'::jsonb,
  extracted_at timestamptz not null default now(),

  -- The same key that stops an artefact naming the wrong course.
  constraint lecture_knowledge_lecture_agrees
    foreign key (lecture_id, course_id) references lectures (id, course_id)
    on delete cascade
);

comment on table lecture_knowledge is
  'Each lecture''s extraction, from which the course knowledge base is merged and the Course '
  'AI answers with citations.';


-- ===========================================================================
-- WHO IS ASKING
-- ===========================================================================
--
-- THREE FUNCTIONS, AND THE VENDORED FILE'S TWO ARE NOT AMONG THEM.
--
-- `docs/integration/001_lecture_studio.sql` brings `ls_teaches_course` and
-- `ls_enrolled_on`. Both are dropped in favour of 084's `teaches_this_course`
-- and `is_enrolled_on_course`, and this is not tidying.
--
-- Measured rather than assumed: both enrolment predicates accept exactly
-- ('registered', 'completed'), so no door moves. But the vendored pair are
-- plain `stable` functions and 084's are SECURITY DEFINER with a set
-- search_path. A policy calling a non-definer predicate has that predicate's
-- own subquery on `enrollments` and `students` filtered by THOSE tables'
-- policies — so the clause can be unreachable and the artefact is refused to
-- a student who is genuinely enrolled.
--
-- This codebase has already met that exact fault: 084's `course_lessons_read`
-- had a subquery on `course_modules` that was itself filtered by the module
-- policy, which is why `module_is_open()` exists at all. The vendored pair
-- have never been run against a database, so nobody has watched them fail.
-- ===========================================================================

-- Does the signed-in account own this lecture? Ownership of everything made
-- from a lecture starts here and does not move.
create or replace function owns_this_lecture(the_lecture uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from lectures l
     where l.id = the_lecture
       and l.owner_id = auth.uid()
  );
$$;

comment on function owns_this_lecture(uuid) is
  'Whether the signed-in account is the lecture''s owner. The owner is the only account that '
  'may change a lecture or anything made from it, and an administrator is not an exception.';

-- Is this lecture somebody's own, rather than a course's?
--
-- A student records their own lecture, or uploads one they were given. It is
-- theirs, everything made from it is theirs, and this system is a study tool
-- rather than the University's publishing pipeline. So the owner may do
-- anything with it — and NOBODY else may touch it at all, not their lecturer,
-- not the Registrar, not another student.
create or replace function lecture_is_personal(the_lecture uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from lectures l
     where l.id = the_lecture
       and l.context = 'personal'
  );
$$;

comment on function lecture_is_personal(uuid) is
  'Whether the lecture lives in somebody''s personal library rather than on a taught course. '
  'It changes exactly one thing: the owner is the whole audience.';

-- The offices that run the course environment.
--
-- SEPARATE FROM `may_curate_course` ON PURPOSE, and the difference is the
-- whole ownership line. `may_curate_course` grants these offices curation —
-- read AND write — over a course's modules and lessons, which is right: the
-- curriculum is theirs. Academic material made from a lecturer's own teaching
-- is not, so they reach it through this instead, and it opens one door:
-- reading what has been published.
create or replace function governs_the_curriculum()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth_role() in (
    'superadmin', 'admin', 'registrar', 'academic-office',
    'dean', 'hod', 'programme-coordinator'
  );
$$;

comment on function governs_the_curriculum() is
  'Whether the signed-in account holds an office that runs the course environment. It opens '
  'exactly one door on a lecturer''s material — reading what the lecturer has published — '
  'because the University holds the room and the lecturer holds what is taught in it.';

revoke all on function owns_this_lecture(uuid)   from public;
revoke all on function lecture_is_personal(uuid) from public;
revoke all on function governs_the_curriculum()  from public;
grant execute on function owns_this_lecture(uuid)   to authenticated;
grant execute on function lecture_is_personal(uuid) to authenticated;
grant execute on function governs_the_curriculum()  to authenticated;


-- ===========================================================================
-- ROW-LEVEL SECURITY — `ownership.ts`, POLICY FOR POLICY
-- ===========================================================================
--
-- If these do not mirror that file, the database is more permissive than the
-- product and the product's rules become decoration.
--
--   personal          the owner, and nobody else at all
--   student           read only, published only, on a course they are on
--   the offices       read only, published only, and never a write
--   lecturer teaching read everything on the course; change only their own
--   owner             everything
--
-- THERE IS NO TEACHING-ASSISTANT CLAUSE, and its absence is deliberate.
-- `ownership.ts` has one — an assistant may upload and run a transformation
-- where the lecturer has put them on the course, and may not correct, approve
-- or publish. The University's role list has no teaching assistant in it, and
-- inventing one here would be inventing an institutional fact. When the
-- University rules that the post exists, it is one clause in these policies.
-- ===========================================================================

alter table lectures          enable row level security;
alter table lecture_artefacts enable row level security;
alter table artefact_versions enable row level security;
alter table lecture_knowledge enable row level security;

-- ---- THE LECTURE ----------------------------------------------------------
drop policy if exists lectures_read   on lectures;
drop policy if exists lectures_write  on lectures;
drop policy if exists lectures_modify on lectures;
drop policy if exists lectures_remove on lectures;

create policy lectures_read on lectures
  for select using (
    case when context = 'personal' then
      owner_id = auth.uid()
    else
          owner_id = auth.uid()
      or  teaches_this_course(course_id)
      or  governs_the_curriculum()
      -- A student sees a lecture on a course they are on. The title and the
      -- date are the timetable; what was TAUGHT is the artefacts, and those
      -- are published or they are not readable.
      or  is_enrolled_on_course(course_id)
    end
  );

create policy lectures_write on lectures
  for insert with check (
    owner_id = auth.uid()
    or (context = 'course' and teaches_this_course(course_id))
  );

create policy lectures_modify on lectures
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy lectures_remove on lectures
  for delete using (owner_id = auth.uid());

-- ---- THE ARTEFACTS --------------------------------------------------------
drop policy if exists lecture_artefacts_read   on lecture_artefacts;
drop policy if exists lecture_artefacts_write  on lecture_artefacts;
drop policy if exists lecture_artefacts_modify on lecture_artefacts;
drop policy if exists lecture_artefacts_remove on lecture_artefacts;

create policy lecture_artefacts_read on lecture_artefacts
  for select using (
    case when lecture_is_personal(lecture_id) then
      owner_id = auth.uid()
    else
          owner_id = auth.uid()
      -- CO-TEACHING IS NORMAL. A colleague on the course reads its material;
      -- everything that CHANGES it stays with the owner.
      or  teaches_this_course(course_id)
      or  (state = 'published' and is_enrolled_on_course(course_id))
      or  (state = 'published' and governs_the_curriculum())
    end
  );

create policy lecture_artefacts_write on lecture_artefacts
  for insert with check (owner_id = auth.uid() and owns_this_lecture(lecture_id));

create policy lecture_artefacts_modify on lecture_artefacts
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy lecture_artefacts_remove on lecture_artefacts
  for delete using (owner_id = auth.uid());

-- ---- THE VERSION HISTORY --------------------------------------------------
drop policy if exists artefact_versions_read  on artefact_versions;
drop policy if exists artefact_versions_write on artefact_versions;

create policy artefact_versions_read on artefact_versions
  for select using (
    exists (
      select 1 from lecture_artefacts a
       where a.id = artefact_versions.artefact_id
         and (
           case when lecture_is_personal(a.lecture_id) then
             a.owner_id = auth.uid()
           else
             a.owner_id = auth.uid() or teaches_this_course(a.course_id)
           end
         )
    )
  );

create policy artefact_versions_write on artefact_versions
  for insert with check (
    exists (
      select 1 from lecture_artefacts a
       where a.id = artefact_versions.artefact_id
         and a.owner_id = auth.uid()
    )
  );

-- ---- THE KNOWLEDGE --------------------------------------------------------
drop policy if exists lecture_knowledge_read  on lecture_knowledge;
drop policy if exists lecture_knowledge_write on lecture_knowledge;

create policy lecture_knowledge_read on lecture_knowledge
  for select using (
    case when lecture_is_personal(lecture_id) then
      owns_this_lecture(lecture_id)
    else
          owns_this_lecture(lecture_id)
      or  teaches_this_course(course_id)
      or  is_enrolled_on_course(course_id)
    end
  );

create policy lecture_knowledge_write on lecture_knowledge
  for all using (owns_this_lecture(lecture_id)) with check (owns_this_lecture(lecture_id));


-- ===========================================================================
-- AND THE BROWSER CANNOT REACH PAST THE POLICIES
-- ===========================================================================
--
-- 091 revoked write from `anon` across the schema and set default privileges
-- so a new table does not quietly hand them back. These four tables were
-- created after that ran, so they are covered by the default — and saying so
-- once here is cheaper than the afternoon spent finding out it was not.
-- ===========================================================================

revoke insert, update, delete, truncate, references, trigger
  on lectures, lecture_artefacts, artefact_versions, lecture_knowledge from anon;
revoke truncate, references, trigger
  on lectures, lecture_artefacts, artefact_versions, lecture_knowledge from authenticated;

grant select on lectures, lecture_artefacts, artefact_versions, lecture_knowledge to anon, authenticated;
grant insert, update, delete
  on lectures, lecture_artefacts, artefact_versions, lecture_knowledge to authenticated;


-- ===========================================================================
-- THE PROOF
-- ===========================================================================
--
-- EVERYTHING IT NEEDS, IT MAKES. Its own course codes, its own matriculation
-- numbers, its own staff number, at 9092 so nothing of the University's is
-- competed for. Nothing of theirs is read, written or asserted to be empty,
-- and the whole block rolls back.
-- ===========================================================================

do $$
declare
  lect_user   uuid := gen_random_uuid();
  other_lect  uuid := gen_random_uuid();
  in_user     uuid := gen_random_uuid();
  out_user    uuid := gen_random_uuid();
  office_user uuid := gen_random_uuid();
  lect_id     uuid;
  other_id    uuid;
  the_course  uuid;
  -- A REAL SECOND COURSE. 084 learned the hard way that a composite-key check
  -- passing an invented uuid proves nothing: the plain `references courses(id)`
  -- refuses that one and the composite key is never consulted.
  other_course uuid;
  mine        uuid;
  theirs      uuid;
  the_lecture uuid;
  personal    uuid;
  the_artefact uuid;
  seen        integer;
begin
  begin
    insert into auth.users (id, email) values
      (lect_user,   '092-lecturer@example.test'),
      (other_lect,  '092-colleague@example.test'),
      (in_user,     '092-enrolled@example.test'),
      (out_user,    '092-stranger@example.test'),
      (office_user, '092-registrar@example.test');
    insert into profiles (id, email, role) values
      (lect_user,   '092-lecturer@example.test',  'lecturer'),
      (other_lect,  '092-colleague@example.test', 'lecturer'),
      (in_user,     '092-enrolled@example.test',  'student'),
      (out_user,    '092-stranger@example.test',  'student'),
      (office_user, '092-registrar@example.test', 'registrar')
    on conflict (id) do update set role = excluded.role;

    insert into lecturers (staff_id, first_name, last_name, auth_user_id)
      values ('ICOFSTF-9092', 'Proof', 'Lecturer', lect_user) returning id into lect_id;
    insert into lecturers (staff_id, first_name, last_name, auth_user_id)
      values ('ICOFSTF-9092B', 'Proof', 'Colleague', other_lect) returning id into other_id;

    insert into courses (code, title, lecturer_id)
      values ('ZZZ 9092', 'A Course Written By The 092 Proof', lect_id)
      returning id into the_course;
    insert into courses (code, title)
      values ('ZZZ 9092B', 'A Second Course, For The Composite Key')
      returning id into other_course;

    insert into students (matric_no, first_name, last_name, status, auth_user_id)
      values ('092/PROOF/IN', 'On', 'TheCourse', 'enrolled', in_user) returning id into mine;
    insert into students (matric_no, first_name, last_name, status, auth_user_id)
      values ('092/PROOF/OUT', 'Not', 'OnIt', 'enrolled', out_user) returning id into theirs;

    insert into enrollments (student_id, course_id, status)
      values (mine, the_course, 'registered');

    insert into lectures (course_id, sequence, title, owner_id, created_by)
      values (the_course, 1, 'A lecture given by the 092 proof', lect_user, lect_user)
      returning id into the_lecture;

    -- ---- THE COLUMN THAT CANNOT LIE ---------------------------------------
    begin
      insert into lecture_artefacts (lecture_id, course_id, kind, origin, owner_id, state, body)
        values (the_lecture, other_course, 'transcript', 'ai', lect_user, 'ready', 'x');
      raise exception '092 FAILED: an artefact was accepted into a real course its lecture does '
                      'not belong to, so course_id can lie and every policy reading it decides '
                      'against the wrong course';
    exception
      when foreign_key_violation then null;
    end;

    -- ---- NOBODY'S NAME ON AN APPROVAL -------------------------------------
    begin
      insert into lecture_artefacts (lecture_id, course_id, kind, origin, owner_id, state, body)
        values (the_lecture, the_course, 'corrected_text', 'ai', lect_user, 'approved', 'x');
      raise exception '092 FAILED: an artefact reached "approved" with nobody''s name on it — '
                      'the AI approved its own output';
    exception
      when check_violation then null;
    end;

    insert into lecture_artefacts (lecture_id, course_id, kind, origin, owner_id, state, body)
      values (the_lecture, the_course, 'structured_notes', 'ai', lect_user, 'ready',
              'What the model made of the lecture.')
      returning id into the_artefact;

    -- ---- PUBLISHING WHAT NOBODY APPROVED ----------------------------------
    --
    -- Both columns in one statement, which is how this would actually happen:
    -- the constraint alone cannot see it, and the trigger is what refuses.
    begin
      update lecture_artefacts
         set state = 'published', approved_by = lect_user, published_at = now()
       where id = the_artefact;
      raise exception '092 FAILED: an artefact went from "ready" straight to "published" — '
                      'the model''s words reached students over the lecturer''s name without '
                      'the lecturer reading them';
    exception
      when check_violation then null;
    end;

    -- AND THE PATH THAT MUST STILL WORK.
    update lecture_artefacts
       set state = 'approved', approved_by = lect_user, approved_at = now()
     where id = the_artefact;
    update lecture_artefacts
       set state = 'published', published_at = now()
     where id = the_artefact;
    select count(*) into seen
      from lecture_artefacts where id = the_artefact and state = 'published';
    if seen <> 1 then
      raise exception '092 FAILED: an approved artefact could not be published, so the pipeline '
                      'has no way out';
    end if;

    insert into artefact_versions (artefact_id, version, body, authored_by, origin, note)
      values (the_artefact, 1, 'The machine''s first draft, before anybody read it.',
              'ai', 'ai', 'first pass');

    -- ---- NOW READ IT AS FIVE PEOPLE ---------------------------------------
    set local role authenticated;

    -- THE STUDENT ON THE COURSE reads what was published.
    execute format('set local request.jwt.claim.sub = %L', in_user);
    select count(*) into seen from lecture_artefacts where id = the_artefact;
    if seen <> 1 then
      raise exception '092 FAILED: a student on the course cannot read a PUBLISHED artefact, '
                      'so publishing does nothing';
    end if;

    -- AND NOT THE DRAFT HISTORY. Version 1 is the unapproved machine draft;
    -- a student reading it reads exactly what approval exists to withhold.
    select count(*) into seen from artefact_versions where artefact_id = the_artefact;
    if seen <> 0 then
      raise exception '092 FAILED: a student can read the version history, so they can read '
                      'the unapproved draft through a table nobody thought of as content';
    end if;

    -- THE STUDENT WHO IS NOT ON IT reads nothing.
    execute format('set local request.jwt.claim.sub = %L', out_user);
    select count(*) into seen from lecture_artefacts where id = the_artefact;
    if seen <> 0 then
      raise exception '092 FAILED: a student not on the course reads its published material';
    end if;

    -- THE COLLEAGUE who does not teach this course.
    execute format('set local request.jwt.claim.sub = %L', other_lect);
    select count(*) into seen from lecture_artefacts where id = the_artefact;
    if seen <> 0 then
      raise exception '092 FAILED: a lecturer who does not teach the course reads its material';
    end if;

    -- THE OWNER reads everything of their own.
    execute format('set local request.jwt.claim.sub = %L', lect_user);
    select count(*) into seen from artefact_versions where artefact_id = the_artefact;
    if seen <> 1 then
      raise exception '092 FAILED: the lecturer cannot read the correction history of their '
                      'own artefact';
    end if;

    reset role;

    -- ---- THE OFFICE, WHICH IS THE RULING AT THE TOP OF THIS FILE ----------
    --
    -- Put the artefact back to a draft and ask the Registrar to read it.
    update lecture_artefacts set state = 'ready', approved_by = null, approved_at = null,
                                 published_at = null
     where id = the_artefact;

    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', office_user);
    select count(*) into seen from lecture_artefacts where id = the_artefact;
    if seen <> 0 then
      raise exception '092 FAILED: an office of the University can read a lecturer''s '
                      'unpublished draft — the ownership line this migration exists to draw '
                      'is not drawn';
    end if;

    reset role;
    update lecture_artefacts
       set state = 'approved', approved_by = lect_user, approved_at = now()
     where id = the_artefact;
    update lecture_artefacts set state = 'published', published_at = now()
     where id = the_artefact;

    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', office_user);
    select count(*) into seen from lecture_artefacts where id = the_artefact;
    if seen <> 1 then
      raise exception '092 FAILED: an office of the University cannot read PUBLISHED material, '
                      'which is delivery it is answerable for';
    end if;

    -- AND CANNOT DELETE THE RECORDING. If it could, the lecturer would not own it.
    delete from lecture_artefacts where id = the_artefact;
    reset role;
    select count(*) into seen from lecture_artefacts where id = the_artefact;
    if seen <> 1 then
      raise exception '092 FAILED: an office of the University deleted a lecturer''s artefact';
    end if;

    -- ---- A PERSONAL LECTURE IS NOBODY ELSE'S ------------------------------
    insert into lectures (course_id, context, sequence, title, owner_id, created_by)
      values (the_course, 'personal', 9001, 'A student''s own recording', in_user, in_user)
      returning id into personal;
    insert into lecture_artefacts (lecture_id, course_id, kind, origin, owner_id, state, body)
      values (personal, the_course, 'transcript', 'ai', in_user, 'ready', 'Their own notes.');

    set local role authenticated;

    -- NOT EVEN THE LECTURER WHOSE COURSE IT SITS ON.
    execute format('set local request.jwt.claim.sub = %L', lect_user);
    select count(*) into seen from lecture_artefacts where lecture_id = personal;
    if seen <> 0 then
      raise exception '092 FAILED: a lecturer can read a student''s personal recording, which '
                      'makes a personal library worse than absent';
    end if;

    -- AND THE PERSON WHOSE IT IS, WHICH MUST STILL WORK.
    execute format('set local request.jwt.claim.sub = %L', in_user);
    select count(*) into seen from lecture_artefacts where lecture_id = personal;
    if seen <> 1 then
      raise exception '092 FAILED: a student cannot read their own personal material';
    end if;

    -- ---- AND NOBODY WRITES AS SOMEBODY ELSE -------------------------------
    --
    -- The `with check` clause, watched refusing. `using` alone governs which
    -- rows may be CHANGED, not what a new row may CLAIM to be.
    execute format('set local request.jwt.claim.sub = %L', out_user);
    begin
      insert into lectures (course_id, sequence, title, owner_id, created_by)
        values (the_course, 9002, 'A lecture claimed on somebody else''s behalf',
                lect_user, out_user);
      raise exception '092 FAILED: an account created a lecture owned by somebody else';
    exception
      when insufficient_privilege then null;
    end;

    reset role;

    raise exception 'rollback 092 proof';
  exception
    when others then
      reset role;
      if sqlerrm <> 'rollback 092 proof' then raise; end if;
  end;
end $$;


do $$
begin
  raise notice '092 OK: a lecture is a taught event, an artefact cannot name a course its '
               'lecture does not belong to, and neither can the knowledge extract';
  raise notice '092 OK: nothing reaches approved without a person''s name on it, and nothing '
               'reaches published without first being approved';
  raise notice '092 OK: a student reads what was published and never the version history, '
               'where the unapproved draft lives';
  raise notice '092 OK: an office of the University reads published material and cannot read '
               'a draft or delete a recording — the lecturer owns what they taught';
  raise notice '092 OK: a personal recording is the owner''s alone, not even their lecturer''s';
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   093_what_is_published_becomes_a_lesson.sql
--
-- ===========================================================================
-- ===========================================================================

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


-- ===========================================================================
-- ===========================================================================
--
--   094_live_delivery_is_not_publication.sql
--
-- ===========================================================================
-- ===========================================================================

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
  select '092' as migration, '092_a_lecture_and_what_is_made_from_it.sql' as file,
         case when to_regclass('public.lecture_artefacts') is not null then 'YES' else 'NO' end as landed,
         'lecture_artefacts' as what_it_creates
  union all
  select '093' as migration, '093_what_is_published_becomes_a_lesson.sql' as file,
         case when to_regclass('public.study_aids') is not null then 'YES' else 'NO' end as landed,
         'study_aids' as what_it_creates
  union all
  select '094' as migration, '094_live_delivery_is_not_publication.sql' as file,
         case when to_regclass('public.live_carried') is not null then 'YES' else 'NO' end as landed,
         'live_carried' as what_it_creates
) as landed_report
 order by migration;

