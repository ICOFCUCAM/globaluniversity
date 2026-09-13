-- ===========================================================================
-- 057 — THE ACADEMIC STRUCTURE
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- THE UNIVERSITY'S ACADEMIC STRUCTURE BECOMES DATA. Schools, departments,
-- programmes, the version of a programme somebody was admitted under, and the
-- curriculum that version carries — all of it in tables the Superadministrator
-- can manage, instead of TypeScript constants compiled into the website.
--
-- NOTHING IS SEEDED. Not one school, not one programme. The University has six
-- faculties and forty-one programmes recorded in src/content/, and moving them
-- is a decision about what is CURRENT — which of them are open, what version
-- each is on, which are archived — and that is the University's to make, not a
-- migration's. The tables arrive empty and a separate, reviewable seeding step
-- fills them.
--
-- AND NO CURRICULUM CAN BE APPROVED UNTIL THE UNIVERSITY SAYS WHO APPROVES ONE.
-- That is section 7 and it is the deliberate one. See below.
--
-- ---------------------------------------------------------------------------
-- WHY THIS FILE IS THE FOUNDATION AND NOT A FEATURE
-- ---------------------------------------------------------------------------
--
-- The University's own words: "the academic information architecture is
-- incomplete. It is currently organized around isolated utilities — Courses,
-- Course Registration, Timetable, LMS — rather than around the University's
-- actual academic structure."
--
-- That is right, and the reason the screens read as loose utilities is that
-- they are UNPARENTED. There has been nothing for them to hang from:
--
--   `faculty` is a TEXT COLUMN on departments, awards and students. Six
--   faculties exist as a TypeScript array. No school can be created.
--
--   A PROGRAMME is forty-one entries in programmeCatalogue.ts plus two rows in
--   `awards`. `courses.programme_slug` points at a programme by string.
--
--   A CURRICULUM is three files in src/content/curricula.ts, for three of the
--   forty-one. Year and semester live on the COURSE, which is why a course
--   cannot be core in one programme and elective in another.
--
--   AND NOTHING RECORDS WHICH CURRICULUM A STUDENT WAS ADMITTED UNDER, so
--   "did this student meet the requirements they signed up to" is a question
--   the database cannot answer. It can only answer "do they meet today's".
--
-- ---------------------------------------------------------------------------
-- WHAT IS VERSIONED, AND WHAT IS NOT
-- ---------------------------------------------------------------------------
--
-- `programmes` holds IDENTITY: the code, the award, the level. Those do not
-- change; a programme whose award changes is a different programme.
--
-- `programme_versions` holds everything that CAN change — including the NAME,
-- the school and the department. That is not pedantry. A transcript must print
-- the programme as it WAS. A department reorganised in 2029 must not silently
-- rewrite what a 2026 graduate studied, and it will if the name hangs off the
-- identity row.
-- ===========================================================================


-- ===========================================================================
-- 1. SCHOOLS AND FACULTIES
-- ===========================================================================
--
-- One table for both words. The University uses "Faculty of Theology" and
-- "School of Ministry" for the same kind of thing — an academic division that
-- owns departments and programmes — and two tables would mean every query
-- asking twice and every screen choosing a side.

create table if not exists schools (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[a-z][a-z0-9-]{1,31}$'),
  -- THE FULL NAME AS THE UNIVERSITY WRITES IT, including the word it chooses.
  -- 'Faculty of Theology', 'School of Ministry'. Never assembled from the code.
  name        text not null check (length(btrim(name)) >= 4),
  mission     text,
  status      text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  created_at  timestamptz not null default now()
);

comment on table schools is
  'The University''s academic divisions — faculties and schools alike. Empty on arrival: the six '
  'in src/content/faculties.ts are moved deliberately, not by this migration.';


-- ===========================================================================
-- 2. DEPARTMENTS BELONG TO A SCHOOL
-- ===========================================================================
--
-- `departments` already exists with a `faculty` TEXT column. The text is left
-- alone — something may still read it — and a real link is added beside it.
-- Nothing is migrated here: a text name cannot be resolved to a row that does
-- not exist yet.

alter table departments
  add column if not exists school_id uuid references schools (id) on delete restrict,
  add column if not exists status    text not null default 'active';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'departments_status_valid') then
    alter table departments add constraint departments_status_valid
      check (status in ('active', 'suspended', 'archived'));
  end if;
end $$;


-- ===========================================================================
-- 3. A PROGRAMME IS AN IDENTITY
-- ===========================================================================

create table if not exists programmes (
  id           uuid primary key default gen_random_uuid(),
  -- THE ONE IMMUTABLE THING. Everything else about a programme may be revised
  -- in a new version; the code is how the revisions are known to be the same
  -- programme.
  code         text not null unique check (code ~ '^[A-Z][A-Z0-9.-]{1,23}$'),
  award_id     uuid references awards (id) on delete restrict,
  -- The level, in the University's own vocabulary from programmeCatalogue.ts.
  award_level  text not null check (award_level in
                 ('Certificate', 'Diploma', 'Bachelor''s', 'Postgraduate Diploma',
                  'Master''s', 'Doctorate')),
  -- ---------------------------------------------------------------------
  -- THE PROGRAMME LIFECYCLE, as the University stated it.
  --
  -- 'open_for_admission' is a STATE, not a flag beside one. Migration 023
  -- seeds every programme closed so that admission is opt-in, and this is
  -- where that now lives: a programme is open because somebody moved it to
  -- open, and section 8 refuses the move unless a version has been approved.
  -- ---------------------------------------------------------------------
  status       text not null default 'draft' check (status in
                 ('draft', 'under_review', 'approved', 'open_for_admission',
                  'active', 'suspended', 'archived')),
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

comment on table programmes is
  'A programme''s identity: its code, its award and where it stands. Everything that can be '
  'revised — name, school, duration, credits, curriculum — belongs to programme_versions, so a '
  'transcript can print the programme as it was rather than as it is.';


-- ===========================================================================
-- 4. AND A VERSION IS WHAT IT WAS AT THE TIME
-- ===========================================================================

create table if not exists programme_versions (
  id                uuid primary key default gen_random_uuid(),
  programme_id      uuid not null references programmes (id) on delete cascade,
  -- '2026', '2026-revised'. The University's own label, not a serial number.
  version_label     text not null check (length(btrim(version_label)) between 1 and 32),

  -- WHAT IT WAS CALLED, AND WHOSE IT WAS. On the version, not the programme.
  name              text not null check (length(btrim(name)) >= 4),
  school_id         uuid references schools (id) on delete restrict,
  department_id     uuid references departments (id) on delete restrict,

  duration_years      integer not null check (duration_years between 1 and 10),
  semesters_per_year  integer not null default 2 check (semesters_per_year between 1 and 4),
  total_credits       integer check (total_credits is null or total_credits > 0),

  description             text,
  admission_requirements  text,
  graduation_requirements text,
  academic_regulations    text,
  coordinator_id          uuid references auth.users (id) on delete set null,

  effective_from    date not null,
  -- NULL means "still in force". Closed when a later version supersedes it.
  effective_to      date,

  status            text not null default 'draft' check (status in
                      ('draft', 'department_review', 'faculty_review', 'board_review',
                       'approved', 'published', 'superseded', 'withdrawn')),
  drafted_by        uuid references auth.users (id) on delete set null,
  approved_at       timestamptz,
  published_at      timestamptz,
  created_at        timestamptz not null default now(),

  unique (programme_id, version_label),
  constraint programme_versions_dates_run_forwards
    check (effective_to is null or effective_to > effective_from)
);

-- ONE PUBLISHED VERSION AT A TIME. Two versions in force is two different
-- answers to "what must this student do to graduate".
create unique index if not exists programme_versions_one_in_force
  on programme_versions (programme_id) where status = 'published';

create index if not exists programme_versions_by_programme
  on programme_versions (programme_id, effective_from desc);


-- ===========================================================================
-- 5. THE CURRICULUM
-- ===========================================================================
--
-- WHY `requirement` IS HERE AND NOT ON `courses`.
--
-- `courses.is_elective` says a course is elective everywhere. The University
-- put the counter-example plainly: "The same course may potentially belong to
-- several programmes." Then BIS 220 can be core in the Bachelor of Theology
-- and elective in the Diploma, and one boolean on the course cannot say both.
--
-- The same is true of `courses.year`, `courses.semester` and
-- `courses.programme_slug`. All four are programme-relative and all four are on
-- the wrong table. They are left in place — things still read them — and the
-- truth moves here.

create table if not exists curriculum_entries (
  id                    uuid primary key default gen_random_uuid(),
  programme_version_id  uuid not null references programme_versions (id) on delete cascade,
  course_id             uuid not null references courses (id) on delete restrict,
  year                  integer not null check (year between 1 and 10),
  semester              integer not null check (semester between 1 and 4),
  requirement           text not null default 'core' check (requirement in
                          ('core', 'elective', 'required-elective')),
  -- The credits AS COUNTED BY THIS PROGRAMME. Usually the course's own value;
  -- occasionally not, and a transcript must print what was counted.
  credits               integer check (credits is null or credits > 0),
  created_at            timestamptz not null default now(),

  -- A course appears once in a version. Twice is a registration that can be
  -- taken twice and a credit total that double-counts.
  unique (programme_version_id, course_id)
);

create index if not exists curriculum_entries_by_term
  on curriculum_entries (programme_version_id, year, semester);

comment on table curriculum_entries is
  'A course''s place in one version of one programme: which year, which semester, and whether it '
  'is core there. The same course may sit differently in another programme — which is why this is '
  'not on `courses`.';


-- ===========================================================================
-- 6. THE STUDENT IS ATTACHED TO A VERSION
-- ===========================================================================
--
-- The load-bearing column of this whole migration.
--
-- The University: "Students remain attached to the curriculum version under
-- which they were admitted." Without this, graduation eligibility answers the
-- wrong question — "do they meet today's requirements" rather than "did they
-- meet the ones they were admitted under" — and every curriculum revision
-- silently re-examines everybody already enrolled.

alter table students
  add column if not exists programme_version_id uuid
    references programme_versions (id) on delete restrict;

create index if not exists students_by_programme_version
  on students (programme_version_id) where programme_version_id is not null;


-- ===========================================================================
-- 7. ACADEMIC GOVERNANCE — AND THE UNIVERSITY HAS NOT YET NAMED THE BOARD
-- ===========================================================================
--
-- The University: "academic changes should not simply be editable by Superadmin
-- … Draft → Department Review → Faculty Review → Academic Board Approval."
--
-- THE PATTERN IS NOT NEW HERE. Migration 005 already does exactly this for
-- credential designs: approvals are ROWS, the quorum is named, and a trigger
-- refuses publication while any of the three offices has not signed.
--
-- WHAT IS DIFFERENT, AND IT IS THE POINT OF THIS SECTION. 005 could hardcode
-- its three offices because the University had named them — the Registrar, the
-- Academic Office and the Vice Chancellor. For a curriculum it has named
-- "the Academic Board", which is not a role this system has and not a
-- membership anybody has stated.
--
-- So the quorum is DATA, and `academic_approval_requirements` arrives EMPTY.
-- The trigger in section 8 refuses to approve a curriculum while it is empty,
-- and says so in words. The University fills it in one INSERT and the chain
-- comes alive; until then the system will not pretend a curriculum has been
-- approved by anybody.
--
-- INVENTING THE BOARD WOULD HAVE BEEN EASIER AND WORSE. A seeded quorum of
-- plausible offices is a governance chain that looks enforced and was never
-- agreed, and the first thing it would do is approve a curriculum in the name
-- of a body that has never met.

create table if not exists academic_approval_requirements (
  subject   text not null check (subject in ('curriculum', 'course', 'programme')),
  -- A role from profiles.role. Not constrained to a vocabulary here: 056 widened
  -- that list once already and a second copy in this file would go stale.
  office    text not null check (length(btrim(office)) >= 3),
  note      text,
  primary key (subject, office)
);

comment on table academic_approval_requirements is
  'Which offices must each approve an academic change before it takes effect. EMPTY ON PURPOSE — '
  'the University has not stated who sits on the Academic Board, and a seeded quorum would be a '
  'governance chain that looks enforced and was never agreed.';

create table if not exists academic_approvals (
  id          uuid primary key default gen_random_uuid(),
  subject     text not null check (subject in ('curriculum', 'course', 'programme')),
  subject_id  uuid not null,
  office      text not null,
  decision    text not null check (decision in ('approved', 'rejected')),
  decided_by  uuid not null references auth.users (id) on delete restrict,
  decided_at  timestamptz not null default now(),
  -- A REJECTION MUST SAY WHY. An approval need not: the signature is the
  -- statement. A refusal that gives no reason cannot be answered.
  reason      text,
  constraint academic_approvals_rejection_is_explained
    check (decision <> 'rejected' or length(btrim(coalesce(reason, ''))) >= 10),
  -- One decision per office per subject. Changing your mind is a new subject
  -- version, not a rewritten signature.
  unique (subject, subject_id, office)
);

create index if not exists academic_approvals_by_subject
  on academic_approvals (subject, subject_id);

-- AN APPROVAL IS NOT REWRITTEN OR DELETED, for the same reason 056's grants are
-- not: the record of who signed what, and when, is the entire value.
create or replace function refuse_to_rewrite_an_academic_approval()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception
    'An academic approval is a signature. It is not edited and it is not deleted — if the '
    'decision has changed, the change belongs to a new version.'
    using errcode = 'check_violation';
end $$;

drop trigger if exists academic_approvals_are_signatures on academic_approvals;
create trigger academic_approvals_are_signatures
  before update or delete on academic_approvals
  for each row execute function refuse_to_rewrite_an_academic_approval();


-- ===========================================================================
-- 8. THE REFUSALS
-- ===========================================================================
--
-- A lifecycle column with nothing enforcing it is a label. These are the rules
-- that make the vocabulary in sections 3 and 4 mean something.

-- ---------------------------------------------------------------------------
-- 8a. A CURRICULUM IS NOT APPROVED WITHOUT ITS QUORUM
-- ---------------------------------------------------------------------------

create or replace function refuse_unapproved_curriculum()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  needed  integer;
  signed  integer;
  missing text;
begin
  -- Only the move INTO approved or published is checked. Everything earlier in
  -- the chain is the University's own business.
  if new.status not in ('approved', 'published') then return new; end if;
  if tg_op = 'UPDATE' and old.status in ('approved', 'published') then return new; end if;

  select count(*) into needed
    from academic_approval_requirements where subject = 'curriculum';

  -- THE CASE THIS SECTION EXISTS FOR.
  if needed = 0 then
    raise exception
      'No approving body has been recorded for a curriculum, so this version cannot be '
      'approved. The University must first state which offices must sign — insert them into '
      'academic_approval_requirements (subject = ''curriculum''). Until then the system will '
      'not record a curriculum as approved by nobody.'
      using errcode = 'check_violation';
  end if;

  select count(*) into signed
    from academic_approvals a
    join academic_approval_requirements r
      on r.subject = 'curriculum' and r.office = a.office
   where a.subject = 'curriculum' and a.subject_id = new.id and a.decision = 'approved';

  if signed < needed then
    select string_agg(r.office, ', ' order by r.office) into missing
      from academic_approval_requirements r
     where r.subject = 'curriculum'
       and not exists (select 1 from academic_approvals a
                        where a.subject = 'curriculum' and a.subject_id = new.id
                          and a.office = r.office and a.decision = 'approved');
    raise exception
      'This curriculum has % of % approvals. Still to sign: %.', signed, needed, missing
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists programme_versions_need_their_quorum on programme_versions;
create trigger programme_versions_need_their_quorum
  before insert or update on programme_versions
  for each row execute function refuse_unapproved_curriculum();

-- ---------------------------------------------------------------------------
-- 8b. AN APPROVED CURRICULUM DOES NOT CHANGE UNDER THE STUDENTS ON IT
-- ---------------------------------------------------------------------------
--
-- This is 044's rule for document templates, applied to the thing it matters
-- most for. Once a version is approved, its courses, years, semesters and
-- core/elective marks are what the students on it signed up to. A revision is
-- a NEW version.

create or replace function refuse_to_edit_an_approved_curriculum()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  state text;
  vid   uuid;
begin
  vid := coalesce(new.programme_version_id, old.programme_version_id);
  select status into state from programme_versions where id = vid;

  if state in ('approved', 'published', 'superseded') then
    raise exception
      'This curriculum has been approved and cannot be changed. Students are attached to it as '
      'it stands. Create a new version of the programme and revise that.'
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists curriculum_entries_freeze_on_approval on curriculum_entries;
create trigger curriculum_entries_freeze_on_approval
  before insert or update or delete on curriculum_entries
  for each row execute function refuse_to_edit_an_approved_curriculum();

-- ---------------------------------------------------------------------------
-- 8c. A PROGRAMME OPENS FOR ADMISSION ONLY WITH A PUBLISHED CURRICULUM
-- ---------------------------------------------------------------------------
--
-- Migration 023 seeded every programme closed so that admission is a decision
-- somebody takes rather than a default. This is the same ruling, made
-- structural: a programme cannot be advertised to applicants before the
-- University has agreed what it consists of.

create or replace function refuse_admission_to_an_unformed_programme()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status in ('open_for_admission', 'active')
     and not exists (select 1 from programme_versions
                      where programme_id = new.id and status = 'published') then
    raise exception
      'This programme has no published curriculum, so it cannot be opened for admission. An '
      'applicant would be accepting a programme whose content the University has not yet agreed.'
      using errcode = 'check_violation';
  end if;

  -- AND IT DOES NOT CLOSE OVER PEOPLE. Archiving a programme somebody is
  -- enrolled on leaves a student attached to a programme that no longer runs.
  if new.status = 'archived'
     and exists (select 1 from students s
                  join programme_versions v on v.id = s.programme_version_id
                 where v.programme_id = new.id
                   and coalesce(s.student_status, 'enrolled') not in ('graduated', 'withdrawn')) then
    raise exception
      'Students are still enrolled on this programme. It cannot be archived while anybody is '
      'reading for it — suspend it to stop new admissions instead.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists programmes_open_only_when_formed on programmes;
create trigger programmes_open_only_when_formed
  before insert or update on programmes
  for each row execute function refuse_admission_to_an_unformed_programme();


-- ===========================================================================
-- 9. WHO CAN READ WHAT
-- ===========================================================================
--
-- The academic structure is ordinary institutional information — what the
-- University teaches, and what it takes to graduate. A student reading the
-- curriculum they are on is the point of publishing one.
--
-- WHAT IS NOT PUBLIC is an unfinished one. A draft curriculum is a proposal
-- under discussion, and an applicant reading it as though it were the
-- programme would be reading something the University has not agreed.

alter table schools                        enable row level security;
alter table programmes                     enable row level security;
alter table programme_versions             enable row level security;
alter table curriculum_entries             enable row level security;
alter table academic_approvals             enable row level security;
alter table academic_approval_requirements enable row level security;

drop policy if exists schools_read on schools;
create policy schools_read on schools for select using (true);

drop policy if exists programmes_read on programmes;
create policy programmes_read on programmes
  for select using (
    status in ('open_for_admission', 'active', 'suspended')
    or auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                       'vice-chancellor', 'chancellor', 'dean', 'hod')
  );

drop policy if exists programme_versions_read on programme_versions;
create policy programme_versions_read on programme_versions
  for select using (
    status = 'published'
    -- YOUR OWN CURRICULUM, whatever became of it since. A student whose
    -- version has been superseded must still be able to read the one they are
    -- actually being examined against.
    or exists (select 1 from students s
                where s.programme_version_id = programme_versions.id
                  and s.auth_user_id = auth.uid())
    or auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                       'vice-chancellor', 'chancellor', 'dean', 'hod')
  );

drop policy if exists curriculum_entries_read on curriculum_entries;
create policy curriculum_entries_read on curriculum_entries
  for select using (
    exists (select 1 from programme_versions v
             where v.id = curriculum_entries.programme_version_id
               and (v.status = 'published'
                    or exists (select 1 from students s
                                where s.programme_version_id = v.id
                                  and s.auth_user_id = auth.uid())))
    or auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                       'vice-chancellor', 'chancellor', 'dean', 'hod')
  );

-- THE SIGNATURES ARE VISIBLE TO THE ACADEMIC OFFICES. A governance chain
-- nobody can inspect is a governance chain nobody can rely on.
drop policy if exists academic_approvals_read on academic_approvals;
create policy academic_approvals_read on academic_approvals
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                    'vice-chancellor', 'chancellor', 'dean', 'hod')
  );

drop policy if exists academic_approval_requirements_read on academic_approval_requirements;
create policy academic_approval_requirements_read on academic_approval_requirements
  for select using (auth.uid() is not null);

-- No write policy on any of them. Every change goes through the API, which
-- checks the capability and records who acted.


-- ===========================================================================
-- 10. WHAT A PROGRAMME IS, IN ONE ROW
-- ===========================================================================
--
-- The screens ask the same question repeatedly — what is this programme, whose
-- is it, which version is in force, how long is it and how many credits — and
-- each one joining four tables for itself is four chances to join them
-- differently.

create or replace view programme_in_force
with (security_invoker = true) as
select p.id                as programme_id,
       p.code,
       p.award_level,
       p.status            as programme_status,
       v.id                as version_id,
       v.version_label,
       v.name,
       v.duration_years,
       v.semesters_per_year,
       v.total_credits,
       v.effective_from,
       s.code              as school_code,
       s.name              as school_name,
       d.name              as department_name,
       (select count(*) from curriculum_entries e where e.programme_version_id = v.id)
                           as courses_in_curriculum,
       (select coalesce(sum(coalesce(e.credits, c.credit_unit)), 0)
          from curriculum_entries e join courses c on c.id = e.course_id
         where e.programme_version_id = v.id)
                           as credits_in_curriculum
  from programmes p
  left join programme_versions v
         on v.programme_id = p.id and v.status = 'published'
  left join schools s     on s.id = v.school_id
  left join departments d on d.id = v.department_id;

comment on view programme_in_force is
  'Each programme with the version currently published, and what that curriculum actually adds '
  'up to. `credits_in_curriculum` against `total_credits` is the Curriculum Builder''s running '
  'total and the dashboard''s "programme/curriculum issues" in one place.';


-- ===========================================================================
-- 11. PROVE IT
-- ===========================================================================

do $$
declare
  officer   uuid;
  dean_id   uuid;
  sch       uuid;
  dept      uuid;
  prog      uuid;
  v1        uuid;
  v2        uuid;
  crs       uuid;
  refused   boolean;
  msg       text;
begin
  begin
    officer := gen_random_uuid();
    dean_id := gen_random_uuid();
    insert into auth.users (id, email) values
      (officer, '057-registrar@example.test'), (dean_id, '057-dean@example.test');

    insert into schools (code, name) values ('proof-school', 'A Proof School of Study')
      returning id into sch;
    -- `faculty` is NOT NULL on the existing table — the text column section 2
    -- leaves in place. A proof that did not set it would fail on a real database
    -- for a reason that has nothing to do with this migration.
    insert into departments (name, code, faculty, school_id)
      values ('A Proof Department', 'PRF', 'A Proof School of Study', sch)
      returning id into dept;

    insert into programmes (code, award_level, status)
      values ('PROOF-BTH', 'Bachelor''s', 'draft') returning id into prog;

    insert into programme_versions
      (programme_id, version_label, name, school_id, department_id,
       duration_years, semesters_per_year, total_credits, effective_from, drafted_by)
    values (prog, '2026', 'A Proof Bachelor of Study', sch, dept,
            3, 2, 180, current_date, officer)
    returning id into v1;

    -- ---- THE UNIVERSITY HAS NOT NAMED THE BOARD ---------------------------
    -- Nothing can be approved, and the refusal says what to do about it.
    refused := false;
    begin
      update programme_versions set status = 'approved' where id = v1;
    exception when others then refused := true; msg := sqlerrm;
    end;
    if not refused then
      raise exception '057 FAILED: a curriculum was approved with no approving body recorded';
    end if;
    if position('academic_approval_requirements' in msg) = 0 then
      raise exception '057 FAILED: the refusal does not say how to record the approving body';
    end if;

    -- ---- ONCE IT HAS, THE QUORUM IS COUNTED -------------------------------
    insert into academic_approval_requirements (subject, office) values
      ('curriculum', 'academic-office'), ('curriculum', 'dean');

    refused := false;
    begin
      update programme_versions set status = 'approved' where id = v1;
    exception when others then refused := true; msg := sqlerrm;
    end;
    if not refused then
      raise exception '057 FAILED: a curriculum was approved with none of its quorum signed';
    end if;
    if position('0 of 2 approvals' in msg) = 0 then
      raise exception '057 FAILED: the refusal does not count the approvals: %', msg;
    end if;

    -- ONE SIGNATURE IS NOT ENOUGH, and the refusal names who is still missing.
    insert into academic_approvals (subject, subject_id, office, decision, decided_by)
      values ('curriculum', v1, 'academic-office', 'approved', officer);

    refused := false;
    begin
      update programme_versions set status = 'approved' where id = v1;
    exception when others then refused := true; msg := sqlerrm;
    end;
    if not refused then
      raise exception '057 FAILED: one of two approvals was accepted as a quorum';
    end if;
    if position('dean' in msg) = 0 then
      raise exception '057 FAILED: the refusal does not name who has still to sign: %', msg;
    end if;

    -- ---- A COURSE CAN BE PLACED WHILE THE VERSION IS A DRAFT --------------
    insert into courses (code, title, credit_unit, department_id, level, semester, year)
      values ('PRF 101', 'A Proof Course', 6, dept, 100, 1, 1) returning id into crs;
    insert into curriculum_entries (programme_version_id, course_id, year, semester, requirement)
      values (v1, crs, 1, 1, 'core');

    -- AND NOT TWICE. Twice is a credit total that double-counts.
    refused := false;
    begin
      insert into curriculum_entries (programme_version_id, course_id, year, semester)
        values (v1, crs, 2, 1);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '057 FAILED: one course was placed twice in one curriculum';
    end if;

    -- ---- WITH THE QUORUM COMPLETE, IT APPROVES ----------------------------
    insert into academic_approvals (subject, subject_id, office, decision, decided_by)
      values ('curriculum', v1, 'dean', 'approved', dean_id);
    update programme_versions set status = 'approved', approved_at = now() where id = v1;

    if not exists (select 1 from programme_versions where id = v1 and status = 'approved') then
      raise exception '057 FAILED: a fully approved curriculum was still refused';
    end if;

    -- ---- AND THEN IT IS FROZEN --------------------------------------------
    refused := false;
    begin
      insert into curriculum_entries (programme_version_id, course_id, year, semester)
        values (v1, crs, 3, 1);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '057 FAILED: a course was added to an approved curriculum';
    end if;

    refused := false;
    begin
      delete from curriculum_entries where programme_version_id = v1;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '057 FAILED: an approved curriculum was emptied';
    end if;

    -- ---- A SIGNATURE IS NOT REWRITTEN -------------------------------------
    refused := false;
    begin
      update academic_approvals set decision = 'rejected'
       where subject_id = v1 and office = 'dean';
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '057 FAILED: an approval was rewritten after the fact';
    end if;

    -- AND A REJECTION SAYS WHY.
    refused := false;
    begin
      insert into academic_approvals (subject, subject_id, office, decision, decided_by)
        values ('curriculum', v1, 'registrar', 'rejected', officer);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '057 FAILED: a curriculum was rejected with no reason given';
    end if;

    -- ---- ADMISSION NEEDS A PUBLISHED CURRICULUM ---------------------------
    refused := false;
    begin
      update programmes set status = 'open_for_admission' where id = prog;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '057 FAILED: a programme opened for admission with no published curriculum';
    end if;

    update programme_versions set status = 'published', published_at = now() where id = v1;
    update programmes set status = 'open_for_admission' where id = prog;

    -- ---- ONE PUBLISHED VERSION AT A TIME ----------------------------------
    --
    -- THIS PROOF PASSED WITH THE INDEX DELIBERATELY BROKEN, which is why it is
    -- now written like this. The 2027 version used to be published without its
    -- quorum, so the QUORUM trigger refused it — and `refused` came back true
    -- whether or not anything stopped two versions being in force at once. A
    -- refusal for the wrong reason proves nothing, and this one was hiding the
    -- absence of the rule it claimed to test.
    --
    -- So 2027 is signed off completely first. With the quorum satisfied, the
    -- only rule left that can refuse the publish is the one under test — and
    -- the refusal is checked by NAME rather than merely counted.
    insert into programme_versions
      (programme_id, version_label, name, school_id, department_id,
       duration_years, semesters_per_year, total_credits, effective_from, drafted_by)
    values (prog, '2027', 'A Proof Bachelor of Study', sch, dept,
            3, 2, 180, current_date + 365, officer)
    returning id into v2;

    insert into academic_approvals (subject, subject_id, office, decision, decided_by) values
      ('curriculum', v2, 'academic-office', 'approved', officer),
      ('curriculum', v2, 'dean', 'approved', dean_id);
    update programme_versions set status = 'approved', approved_at = now() where id = v2;

    refused := false;
    begin
      update programme_versions set status = 'published' where id = v2;
    exception when others then refused := true; msg := sqlerrm;
    end;
    if not refused then
      raise exception '057 FAILED: two versions of one programme were in force at once';
    end if;
    if position('programme_versions_one_in_force' in msg) = 0 then
      raise exception '057 FAILED: the second version was refused, but not by the '
                      'one-in-force rule: %', msg;
    end if;

    -- ---- AND THE VIEW ADDS UP WHAT IS ACTUALLY THERE ----------------------
    if (select credits_in_curriculum from programme_in_force where programme_id = prog) <> 6 then
      raise exception '057 FAILED: the curriculum total is not counted from its entries';
    end if;
    if (select courses_in_curriculum from programme_in_force where programme_id = prog) <> 1 then
      raise exception '057 FAILED: the curriculum course count is wrong';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '057 OK: a curriculum cannot be approved until the University has recorded WHO '
               'approves one, and the refusal says how to record it';
  raise notice '057 OK: the quorum is counted, the refusal names who has still to sign, and a '
               'signature can be neither rewritten nor deleted';
  raise notice '057 OK: an approved curriculum is frozen — students are attached to it as it '
               'stands, and a revision is a new version';
  raise notice '057 OK: a programme cannot open for admission without a published curriculum, '
               'cannot be archived over enrolled students, and has one version in force at a time';
end $$;


-- ===========================================================================
-- 12. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- THE STRUCTURE, AND IT IS EMPTY. Every count below should read 0 the first
-- time this runs. That is correct: this migration builds the shape and seeds
-- nothing, because WHICH of the University's forty-one programmes are current,
-- and on what version, is a decision and not a default.
-- ---------------------------------------------------------------------------
select (select count(*) from schools)             as schools,
       (select count(*) from programmes)          as programmes,
       (select count(*) from programme_versions)  as versions,
       (select count(*) from curriculum_entries)  as curriculum_entries,
       (select count(*) from students where programme_version_id is not null)
                                                  as students_on_a_version;

-- ---------------------------------------------------------------------------
-- AND WHO APPROVES AN ACADEMIC CHANGE. Empty means no curriculum can be
-- approved yet, by anybody, including the Superadministrator. That is section
-- 7 working, not a fault. Fill it when the University has named the Board:
--
--   insert into academic_approval_requirements (subject, office) values
--     ('curriculum', 'hod'), ('curriculum', 'dean'), ('curriculum', '<the board>');
-- ---------------------------------------------------------------------------
select subject, office, note from academic_approval_requirements order by subject, office;
