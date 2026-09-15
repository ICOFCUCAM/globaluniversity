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
