-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — MIGRATIONS 048, 049, 050, 051, 052, 053, 054, 055, 056, 057, IN ORDER
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-migration-run.mjs
--   Rebuild:   node scripts/build-migration-run.mjs --out=RUN-PART-2.sql 048 049 050 051 052 053 054 055 056 057
--
-- ---------------------------------------------------------------------------
-- HOW TO RUN IT
--
-- Supabase SQL editor: paste the whole file and run once.
-- psql:                psql "<connection string>" -f docs/migrations/RUN-PART-2.sql
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
--   048_the_job_descriptions_and_what_they_inherit.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 048 — THE JOB DESCRIPTIONS, AND WHAT THEY INHERIT
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. THE UNIVERSITY GETS A REGISTER OF ITS POSTS. Forty-six of them, seeded
--    with title, job code, family and reporting line. That is structure, not
--    content: it says the post exists and where it sits, and nothing about what
--    the holder does.
--
-- 2. EVERY POST HAS A JOB DESCRIPTION, INHERITED FROM ITS FAMILY. Eight family
--    profiles carry the clauses that are genuinely common — an academic's
--    teaching and research duties, a director's financial authority — and each
--    post adds its own on top. Forty-six separate documents would be forty-six
--    places to update the confidentiality clause, and within a year they would
--    say four different things.
--
-- 3. NOTHING IS APPROVED. Every profile this migration writes is a DRAFT, at
--    the University's instruction, and a draft cannot be attached to an
--    appointment letter. Activating one requires somebody other than its
--    author, exactly as 044 requires of a document template.
--
-- ---------------------------------------------------------------------------
-- THE ONE THING TO READ TWICE
-- ---------------------------------------------------------------------------
--
-- THE SEEDED WORDING IS NOT THE UNIVERSITY'S POLICY YET. It is a first draft
-- written to be edited, and it is marked `draft` for that reason rather than as
-- a formality. A job description states what somebody may authorise, what they
-- must escalate, and what they are assessed on — it is the document produced
-- when a dismissal is challenged. Nothing in it should reach a letter until the
-- University has read it and somebody other than its author has activated it.
--
-- The Readiness panel and `position_profiles_unapproved` both report what is
-- still sitting in draft, so this cannot be forgotten quietly.
-- ===========================================================================


-- ===========================================================================
-- 1. THE POSTS
-- ===========================================================================

create table if not exists positions (
  id             uuid primary key default gen_random_uuid(),

  -- IGUC-ACA-LEC. The code is what a job description, an appointment and an
  -- establishment return all name, and a title is not stable enough to be a
  -- key: "Lecturer" and "Lecturer I" are the same post with a grade attached.
  job_code       text not null unique check (job_code ~ '^[A-Z][A-Z0-9-]{2,23}$'),
  title          text not null check (length(btrim(title)) >= 3),

  -- THE FAMILY IS THE REUSE. Everything common to a family is written once on
  -- the family's own profile and inherited.
  family         text not null check (family in (
                   'executive', 'academic-administration', 'faculty-leadership',
                   'administration', 'student-services', 'ict',
                   'academic-staff', 'other')),

  -- WHERE IT SITS. Free text against the University's stated structure rather
  -- than a foreign key: not every post belongs to a faculty, and a nullable
  -- key to a table that does not cover half the establishment is worse than a
  -- name.
  unit_name      text,
  faculty        text,
  reports_to     text,
  supervises     text,
  duty_station   text,

  employment_category text,
  grade          text,

  -- ---------------------------------------------------------------------
  -- WHAT THE POST IS USUALLY WORTH — INDICATIVE, AND IT NEVER REACHES A
  -- LETTER BY ITSELF.
  --
  -- The University's ruling: a figure may be carried on a template, and the
  -- box may be left empty. So a post can hold one, and the Vice-Chancellor
  -- can take it or type over it when making the appointment — but the letter
  -- prints `appointments.salary_amount` and nothing else. A figure that could
  -- print from here would be the University stating a salary it had not
  -- decided for the person holding the letter.
  -- ---------------------------------------------------------------------
  indicative_salary_amount   numeric(14, 2)
    check (indicative_salary_amount is null or indicative_salary_amount > 0),
  indicative_salary_currency text
    check (indicative_salary_currency is null or indicative_salary_currency in
           ('USD', 'FCFA', 'EUR', 'GBP', 'NGN')),
  indicative_salary_period   text
    check (indicative_salary_period is null or indicative_salary_period in
           ('hour', 'month', 'year', 'session', 'contract', 'stipend')),

  -- A post the University no longer fills stays in the register. An
  -- appointment made to it in 2026 must still name something in 2036.
  active         boolean not null default true,

  created_at     timestamptz not null default now()
);

create index if not exists positions_family_idx on positions (family, title);

-- Added separately as well, so a database that already has `positions` from an
-- earlier run of this file picks them up rather than silently lacking them.
alter table positions
  add column if not exists indicative_salary_amount numeric(14, 2),
  add column if not exists indicative_salary_currency text,
  add column if not exists indicative_salary_period text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'positions_indicative_salary_is_complete') then
    alter table positions add constraint positions_indicative_salary_is_complete
      check ((indicative_salary_amount is null)
             or (indicative_salary_currency is not null and indicative_salary_period is not null));
  end if;
end $$;

comment on column positions.indicative_salary_amount is
  'What the post is usually worth. INDICATIVE ONLY — a letter prints appointments.salary_amount '
  'and never this. It exists so the Vice-Chancellor can take a figure or type over it when '
  'making the appointment, and so that the box may be left empty.';


-- ===========================================================================
-- 2. THE JOB DESCRIPTION
-- ===========================================================================
--
-- VERSIONED, WITH ONE ACTIVE AT A TIME, ACTIVATED BY SOMEBODY OTHER THAN ITS
-- AUTHOR. The same shape as 044's document templates, deliberately: a job
-- description is a document the University issues and is held to, and a second
-- arrangement for versioning one would be a second answer to "which wording was
-- in force when this person was appointed".

create table if not exists position_profiles (
  id             uuid primary key default gen_random_uuid(),

  -- EITHER a post's own profile, OR a family's. Exactly one, never both and
  -- never neither — a profile belonging to nothing cannot be found, and one
  -- belonging to both would be inherited by itself.
  position_id    uuid references positions (id) on delete cascade,
  family         text check (family in (
                   'executive', 'academic-administration', 'faculty-leadership',
                   'administration', 'student-services', 'ict',
                   'academic-staff', 'other')),

  version        integer not null default 1 check (version >= 1),

  -- Why the post exists. The one section that is never inherited, because a
  -- purpose shared between two posts means one of them is undefined.
  job_purpose    text,

  status         text not null default 'draft'
                   check (status in ('draft', 'active', 'superseded')),

  effective_from date,

  created_by     uuid references auth.users (id) on delete set null,
  activated_by   uuid references auth.users (id) on delete set null,
  activated_at   timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'position_profiles_belongs_to_one_thing') then
    alter table position_profiles add constraint position_profiles_belongs_to_one_thing
      check ((position_id is not null) <> (family is not null));
  end if;

  -- ---------------------------------------------------------------------
  -- NOBODY ACTIVATES THE JOB DESCRIPTION THEY WROTE.
  --
  -- The same rule 044 applies to a letter template and 005 to a certificate
  -- design, and it matters more here than in either: a job description says
  -- what its holder may authorise and what they are assessed on. One person
  -- writing and approving that alone is one person deciding the terms on
  -- which somebody else can be dismissed.
  -- ---------------------------------------------------------------------
  if not exists (select 1 from pg_constraint where conname = 'position_profiles_second_pair_of_eyes') then
    alter table position_profiles add constraint position_profiles_second_pair_of_eyes
      check (activated_by is null or created_by is null or activated_by <> created_by);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'position_profiles_activation_is_complete') then
    alter table position_profiles add constraint position_profiles_activation_is_complete
      check (status <> 'active' or (activated_by is not null and activated_at is not null));
  end if;

  -- AN ACTIVE PROFILE SAYS WHY THE POST EXISTS. A job description with no
  -- purpose is a list of tasks, and the first question at any review is what
  -- the post is for.
  if not exists (select 1 from pg_constraint where conname = 'position_profiles_active_states_its_purpose') then
    alter table position_profiles add constraint position_profiles_active_states_its_purpose
      check (status <> 'active'
             or (job_purpose is not null and length(btrim(job_purpose)) >= 40));
  end if;
end $$;

-- ONE ACTIVE PROFILE PER POST, and one per family.
create unique index if not exists position_profiles_one_active_per_post_idx
  on position_profiles (position_id) where status = 'active' and position_id is not null;
create unique index if not exists position_profiles_one_active_per_family_idx
  on position_profiles (family) where status = 'active' and family is not null;

create unique index if not exists position_profiles_version_per_post_idx
  on position_profiles (position_id, version) where position_id is not null;
create unique index if not exists position_profiles_version_per_family_idx
  on position_profiles (family, version) where family is not null;


-- ===========================================================================
-- 3. THE CLAUSES
-- ===========================================================================
--
-- ONE TABLE, NOT TWENTY COLUMNS. The University named about twenty sections and
-- said most are "where applicable" — which as columns means twenty mostly-null
-- fields, and no way to number the responsibilities within one. As rows, a
-- section that does not apply simply has none, and the numbering the University
-- asked for is the ordinal.

create table if not exists position_profile_clauses (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references position_profiles (id) on delete cascade,

  section        text not null check (section in (
                   -- The responsibilities, in the University's own grouping.
                   'key-responsibilities', 'institutional', 'academic',
                   'administrative', 'financial', 'people-management',
                   'student', 'research', 'ict', 'compliance',
                   -- Decision-making authority, split three ways as asked. The
                   -- split is the point: "may recommend" and "may authorise"
                   -- are the difference between advice and a commitment.
                   'may-authorize', 'may-recommend', 'must-obtain-approval',
                   -- The rest.
                   'reporting', 'performance-areas', 'performance-indicators',
                   'qualifications', 'experience', 'technical-skills',
                   'behavioural-competencies', 'working-relationships',
                   'confidentiality', 'evaluation', 'amendment')),

  ordinal        integer not null check (ordinal >= 1),
  body           text not null check (length(btrim(body)) >= 10),

  created_at     timestamptz not null default now(),

  unique (profile_id, section, ordinal)
);

create index if not exists position_profile_clauses_profile_idx
  on position_profile_clauses (profile_id, section, ordinal);


-- ===========================================================================
-- 4. THE INHERITANCE, RESOLVED IN ONE PLACE
-- ===========================================================================
--
-- A POST'S JOB DESCRIPTION IS ITS FAMILY'S CLAUSES PLUS ITS OWN. Resolved here
-- rather than in the application, because a screen and a letter working it out
-- separately would be two answers to "what does this job description say", and
-- the one that matters is whichever got printed.
--
-- A post's own clause in a section REPLACES the family's for that section. It
-- does not merge: a Dean whose financial authority differs from the family's
-- needs to state it, not to have it appended to a paragraph that contradicts it.

create or replace view position_job_description
with (security_invoker = true) as
  with own_sections as (
    select pp.position_id, c.section
      from position_profiles pp
      join position_profile_clauses c on c.profile_id = pp.id
     where pp.position_id is not null and pp.status = 'active'
     group by 1, 2
  )
  select p.id as position_id,
         p.job_code,
         p.title,
         p.family,
         c.section,
         c.ordinal,
         c.body,
         case when pp.position_id is not null then 'position' else 'family' end as source
    from positions p
    join position_profiles pp
      on pp.status = 'active'
     and (pp.position_id = p.id or (pp.family = p.family and pp.position_id is null))
    join position_profile_clauses c on c.profile_id = pp.id
   -- A FAMILY CLAUSE IS DROPPED WHERE THE POST HAS ITS OWN IN THAT SECTION.
   where pp.position_id is not null
      or not exists (select 1 from own_sections o
                      where o.position_id = p.id and o.section = c.section);

-- What is still waiting to be read and approved. Named so the Readiness panel
-- can ask, and so "we will approve them later" has somewhere to be counted.
create or replace view position_profiles_unapproved
with (security_invoker = true) as
  select pp.id,
         coalesce(p.title, 'Family: ' || pp.family) as what,
         coalesce(p.job_code, pp.family) as code,
         pp.version,
         pp.created_at,
         (select count(*) from position_profile_clauses c where c.profile_id = pp.id) as clauses
    from position_profiles pp
    left join positions p on p.id = pp.position_id
   where pp.status = 'draft';


-- ===========================================================================
-- 5. AN APPOINTMENT NAMES THE POST AND THE WORDING IN FORCE
-- ===========================================================================
--
-- THE DOROTHY RULE AGAIN, from 044. An appointment letter that referred to "the
-- job description" and nothing more would be unreadable the moment the job
-- description changed — and the appointee is holding the version they were
-- given. `on delete restrict` means a profile that has been attached to an
-- appointment can never be deleted.

alter table appointments
  add column if not exists position_id uuid references positions (id) on delete set null,
  add column if not exists position_profile_id uuid references position_profiles (id)
    on delete restrict;

do $$
begin
  -- A JOB DESCRIPTION ATTACHED TO AN APPOINTMENT IS AN APPROVED ONE. This is
  -- the door the draft state exists to close: a first draft written by one
  -- person must not reach an appointee as the terms of their post.
  if not exists (select 1 from pg_constraint where conname = 'appointments_jd_is_approved') then
    alter table appointments add constraint appointments_jd_is_approved
      check (position_profile_id is null or position_profile_approved(position_profile_id))
      not valid;
  end if;
exception
  when undefined_function then
    -- The function is created below; on a first run the constraint is added
    -- after it. Nothing to do here.
    null;
end $$;

create or replace function position_profile_approved(p uuid) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from position_profiles pp
     where pp.id = p and pp.status in ('active', 'superseded')
  );
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'appointments_jd_is_approved') then
    alter table appointments add constraint appointments_jd_is_approved
      check (position_profile_id is null or position_profile_approved(position_profile_id))
      not valid;
  end if;
end $$;


-- ===========================================================================
-- 6. WHO CAN READ AND WRITE
-- ===========================================================================

alter table positions enable row level security;
alter table position_profiles enable row level security;
alter table position_profile_clauses enable row level security;

drop policy if exists positions_read on positions;
create policy positions_read on positions
  for select to authenticated using (true);

drop policy if exists position_profiles_read on position_profiles;
create policy position_profiles_read on position_profiles
  for select to authenticated using (true);

drop policy if exists position_profile_clauses_read on position_profile_clauses;
create policy position_profile_clauses_read on position_profile_clauses
  for select to authenticated using (true);


-- ===========================================================================
-- 7. THE REGISTER OF POSTS
-- ===========================================================================
--
-- STRUCTURE ONLY. Title, code, family and reporting line — where the post sits,
-- not what its holder does. The four faculties are the University's own, as
-- stated on its site. Nothing else here asserts that a post is filled, and no
-- person is named.

insert into positions (job_code, title, family, reports_to, unit_name) values
  -- Executive
  ('EXE-VC',    'Vice-Chancellor',              'executive', 'The University Council', 'Office of the Vice-Chancellor'),
  ('EXE-DVC',   'Deputy Vice-Chancellor',       'executive', 'Vice-Chancellor', 'Office of the Vice-Chancellor'),
  ('EXE-PVC',   'Pro-Vice-Chancellor',          'executive', 'Vice-Chancellor', 'Office of the Vice-Chancellor'),
  ('EXE-SEC',   'University Secretary',         'executive', 'Vice-Chancellor', 'Office of the Vice-Chancellor'),

  -- Academic administration
  ('ACA-REG',   'Registrar',                    'academic-administration', 'Vice-Chancellor', 'Registry'),
  ('ACA-DREG',  'Deputy Registrar',             'academic-administration', 'Registrar', 'Registry'),
  ('ACA-DAA',   'Director of Academic Affairs', 'academic-administration', 'Vice-Chancellor', 'Academic Affairs'),
  ('ACA-DADM',  'Director of Admissions',       'academic-administration', 'Registrar', 'Admissions'),
  ('ACA-DEXR',  'Director of Examinations and Records', 'academic-administration', 'Registrar', 'Examinations and Records'),
  ('ACA-DGRAD', 'Dean of Graduate Studies',     'academic-administration', 'Director of Academic Affairs', 'Graduate Studies'),
  ('ACA-DRES',  'Director of Research',         'academic-administration', 'Vice-Chancellor', 'Research'),
  ('ACA-DQA',   'Director of Quality Assurance','academic-administration', 'Vice-Chancellor', 'Quality Assurance'),

  -- Faculties. The four are the University's own.
  ('FAC-DTHE',  'Dean, Faculty of Theology',    'faculty-leadership', 'Director of Academic Affairs', 'Faculty of Theology'),
  ('FAC-DENG',  'Dean, Faculty of Engineering and Technology', 'faculty-leadership', 'Director of Academic Affairs', 'Faculty of Engineering and Technology'),
  ('FAC-DBMS',  'Dean, Faculty of Business and Management Science', 'faculty-leadership', 'Director of Academic Affairs', 'Faculty of Business and Management Science'),
  ('FAC-DEDU',  'Dean, Faculty of Education',   'faculty-leadership', 'Director of Academic Affairs', 'Faculty of Education'),
  ('FAC-HOD',   'Head of Department',           'faculty-leadership', 'Dean of Faculty', null),
  ('FAC-PC',    'Programme Coordinator',        'faculty-leadership', 'Head of Department', null),
  ('FAC-ADMIN', 'Faculty Administrator',        'faculty-leadership', 'Dean of Faculty', null),

  -- Administration
  ('ADM-FIN',   'Finance Director',             'administration', 'Vice-Chancellor', 'Finance'),
  ('ADM-HR',    'Human Resources Director',     'administration', 'Vice-Chancellor', 'Human Resources'),
  ('ADM-PROC',  'Procurement Director',         'administration', 'Vice-Chancellor', 'Administration'),
  ('ADM-DIR',   'Administrative Director',      'administration', 'Vice-Chancellor', 'Administration'),

  -- Student services
  ('STU-DSA',   'Director of Student Affairs',  'student-services', 'Vice-Chancellor', 'Student Affairs'),
  ('STU-INTL',  'International Relations Director', 'student-services', 'Vice-Chancellor', 'International Relations'),
  ('STU-LIB',   'University Librarian',         'student-services', 'Director of Academic Affairs', 'Library'),
  ('STU-CAR',   'Career Services Director',     'student-services', 'Director of Student Affairs', 'Student Affairs'),
  ('STU-ALU',   'Alumni Relations Officer',     'student-services', 'Director of Student Affairs', 'Alumni Relations'),

  -- ICT
  ('ICT-DIR',   'Director of ICT',              'ict', 'Vice-Chancellor', 'ICT'),
  ('ICT-SYS',   'Systems Administrator',        'ict', 'Director of ICT', 'ICT'),
  ('ICT-SUP',   'IT Support Officer',           'ict', 'Director of ICT', 'ICT'),
  ('ICT-SEC',   'Information Security Officer', 'ict', 'Director of ICT', 'ICT'),

  -- Academic staff
  ('ACS-PROF',  'Professor',                    'academic-staff', 'Head of Department', null),
  ('ACS-ASSOC', 'Associate Professor',          'academic-staff', 'Head of Department', null),
  ('ACS-SLEC',  'Senior Lecturer',              'academic-staff', 'Head of Department', null),
  ('ACS-LEC',   'Lecturer',                     'academic-staff', 'Head of Department', null),
  ('ACS-ALEC',  'Assistant Lecturer',           'academic-staff', 'Head of Department', null),
  ('ACS-RF',    'Research Fellow',              'academic-staff', 'Director of Research', 'Research'),

  -- Other
  ('OTH-CHAP',  'Director of Chaplaincy',       'other', 'Vice-Chancellor', 'Chaplaincy'),
  ('OTH-COMM',  'Communications and Public Relations Director', 'other', 'Vice-Chancellor', 'Communications'),
  ('OTH-EXO',   'Examination Officer',          'other', 'Director of Examinations and Records', 'Examinations and Records'),
  ('OTH-ADMO',  'Admissions Officer',           'other', 'Director of Admissions', 'Admissions'),
  ('OTH-REGO',  'Registry Officer',             'other', 'Registrar', 'Registry')
on conflict (job_code) do nothing;


-- ===========================================================================
-- 8. THE FAMILY JOB DESCRIPTIONS — DRAFTS, EVERY ONE
-- ===========================================================================
--
-- WRITTEN TO BE EDITED. These are a starting point for the University, not its
-- policy, and every one is `draft` so that none of them can reach an appointee
-- until somebody has read it and somebody else has activated it.

do $$
declare
  fam text;
  pid uuid;
begin
  foreach fam in array array['executive', 'academic-administration', 'faculty-leadership',
                             'administration', 'student-services', 'ict',
                             'academic-staff', 'other']
  loop
    if exists (select 1 from position_profiles where family = fam and position_id is null) then
      continue;
    end if;

    insert into position_profiles (family, version, status, job_purpose)
    values (fam, 1, 'draft',
      'DRAFT FOR THE UNIVERSITY''S APPROVAL. This profile states the duties common to every '
      || 'post in the ' || replace(fam, '-', ' ') || ' family. It has not been approved and '
      || 'must not be attached to an appointment until it has been read and activated.')
    returning id into pid;

    -- ---- The clauses every post in the University carries -----------------
    insert into position_profile_clauses (profile_id, section, ordinal, body) values
      (pid, 'institutional', 1,
       'Uphold the mission, statutes and regulations of ICOF Global University, and conduct '
       'the duties of the post in accordance with the University''s policies in force from '
       'time to time.'),
      (pid, 'institutional', 2,
       'Represent the University professionally in dealings with students, colleagues, '
       'partner institutions and the public.'),
      (pid, 'compliance', 1,
       'Comply with the University''s policies on conduct, conflict of interest, data '
       'protection and safeguarding, and report any breach that comes to notice.'),
      (pid, 'confidentiality', 1,
       'Treat student records, staff records, examination material and the University''s '
       'commercial and legal affairs as confidential, during the appointment and after it '
       'ends.'),
      (pid, 'reporting', 1,
       'Report to the officer named in the letter of appointment, and provide such written '
       'reports as that officer or the Vice-Chancellor may require.'),
      (pid, 'evaluation', 1,
       'Performance is reviewed annually against the key performance areas set out in this '
       'job description, and at the end of any probationary period.'),
      (pid, 'amendment', 1,
       'This job description may be amended by the University after consultation with the '
       'post-holder. An amended version is issued as a new version; the version in force at '
       'the date of appointment remains on the record.'),
      (pid, 'must-obtain-approval', 1,
       'Any commitment of University funds, any public statement made on behalf of the '
       'University, and any agreement with an external body require the prior approval of '
       'the Vice-Chancellor or of the officer to whom that authority has been delegated in '
       'writing.');

    -- ---- And what distinguishes the family --------------------------------
    if fam = 'academic-staff' then
      insert into position_profile_clauses (profile_id, section, ordinal, body) values
        (pid, 'academic', 1, 'Teach the courses allocated by the Head of Department, to the '
         'syllabus approved for the programme, and keep the teaching materials current.'),
        (pid, 'academic', 2, 'Set, invigilate and mark assessments in accordance with the '
         'University''s examination regulations, and submit marks by the published deadline.'),
        (pid, 'academic', 3, 'Supervise student projects, dissertations and theses as '
         'allocated.'),
        (pid, 'student', 1, 'Act as academic adviser to allocated students and be available '
         'to them at published consultation times.'),
        (pid, 'research', 1, 'Pursue an active programme of research or scholarship '
         'appropriate to the discipline and the grade of the post, and publish its results.'),
        (pid, 'performance-areas', 1, 'Teaching quality, assessment turnaround, student '
         'progression, research output, and contribution to the department.'),
        (pid, 'qualifications', 1, 'A qualification in the discipline appropriate to the '
         'grade of the post, as set out in the University''s conditions of service.'),
        (pid, 'may-recommend', 1, 'Recommend marks, progression decisions and programme '
         'changes to the Head of Department.');

    elsif fam = 'faculty-leadership' then
      insert into position_profile_clauses (profile_id, section, ordinal, body) values
        (pid, 'academic', 1, 'Lead the academic work of the faculty or department, including '
         'curriculum design, programme review and the maintenance of academic standards.'),
        (pid, 'people-management', 1, 'Allocate teaching, supervise the academic staff of the '
         'unit, and conduct their annual performance review.'),
        (pid, 'administrative', 1, 'Chair the meetings of the unit, maintain its records, and '
         'report to the Director of Academic Affairs.'),
        (pid, 'student', 1, 'Deal with student academic matters within the unit, including '
         'appeals at first instance.'),
        (pid, 'may-authorize', 1, 'Approve course allocations and the unit''s teaching '
         'timetable.'),
        (pid, 'may-recommend', 1, 'Recommend appointments, promotions and programme approvals '
         'to the Vice-Chancellor through the Director of Academic Affairs.'),
        (pid, 'performance-areas', 1, 'Academic standards, student progression and '
         'completion, staff development, and the timely conduct of the unit''s business.');

    elsif fam = 'executive' then
      insert into position_profile_clauses (profile_id, section, ordinal, body) values
        (pid, 'institutional', 3, 'Exercise the authority conferred by the statutes of the '
         'University and by the Council, and account to the Council for its exercise.'),
        (pid, 'people-management', 1, 'Lead the officers of the University and oversee the '
         'performance of the offices reporting to the post.'),
        (pid, 'financial', 1, 'Oversee the financial position of the University within the '
         'budget approved by the Council.'),
        (pid, 'may-authorize', 1, 'Authorise appointments, official correspondence and '
         'institutional decisions within the authority conferred by the statutes.'),
        (pid, 'performance-areas', 1, 'Institutional standing, academic quality, financial '
         'sustainability, and governance.');

    elsif fam = 'academic-administration' then
      insert into position_profile_clauses (profile_id, section, ordinal, body) values
        (pid, 'administrative', 1, 'Direct the office named in the letter of appointment and '
         'ensure its statutory and regulatory obligations are met.'),
        (pid, 'academic', 1, 'Maintain the integrity of the University''s academic records, '
         'admissions decisions and examination processes within the remit of the office.'),
        (pid, 'people-management', 1, 'Supervise the staff of the office and conduct their '
         'annual performance review.'),
        (pid, 'may-authorize', 1, 'Authorise the routine business of the office within '
         'delegated limits set in writing by the Vice-Chancellor.'),
        (pid, 'performance-areas', 1, 'Accuracy and completeness of records, turnaround of '
         'the office''s business, and regulatory compliance.');

    elsif fam = 'administration' then
      insert into position_profile_clauses (profile_id, section, ordinal, body) values
        (pid, 'administrative', 1, 'Direct the function named in the letter of appointment and '
         'maintain its policies, procedures and records.'),
        (pid, 'financial', 1, 'Manage the budget of the function, and account for expenditure '
         'against it.'),
        (pid, 'people-management', 1, 'Supervise the staff of the function and conduct their '
         'annual performance review.'),
        (pid, 'performance-areas', 1, 'Service standards, budget management, compliance, and '
         'the timely conduct of the function''s business.');

    elsif fam = 'student-services' then
      insert into position_profile_clauses (profile_id, section, ordinal, body) values
        (pid, 'student', 1, 'Provide the services of the office to students, and maintain the '
         'standards published in the student handbook.'),
        (pid, 'administrative', 1, 'Maintain the records of the office and report on its '
         'activity to the officer named in the letter of appointment.'),
        (pid, 'performance-areas', 1, 'Student satisfaction, responsiveness, and the accuracy '
         'of the office''s records.');

    elsif fam = 'ict' then
      insert into position_profile_clauses (profile_id, section, ordinal, body) values
        (pid, 'ict', 1, 'Maintain the availability, integrity and security of the University''s '
         'information systems.'),
        (pid, 'ict', 2, 'Administer access to those systems in accordance with the '
         'University''s role matrix, and grant no access that has not been authorised.'),
        (pid, 'compliance', 2, 'Maintain the audit trails the University relies on, and take '
         'no action that alters or removes a record of what a system has done.'),
        (pid, 'performance-areas', 1, 'System availability, security posture, backup and '
         'recovery, and responsiveness to support requests.');

    else
      insert into position_profile_clauses (profile_id, section, ordinal, body) values
        (pid, 'administrative', 1, 'Carry out the duties of the office as directed by the '
         'officer named in the letter of appointment.'),
        (pid, 'performance-areas', 1, 'Accuracy, timeliness, and the standards set for the '
         'office.');
    end if;
  end loop;
end $$;


-- ===========================================================================
-- 9. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  someone uuid;
  other uuid;
  fam_id uuid;
  src_id uuid;
  pos_id uuid;
  own_id uuid;
  n integer;
begin
  select id into someone from auth.users limit 1;
  select id into other from auth.users where id <> someone limit 1;
  if someone is null or other is null then
    raise notice '048: fewer than two accounts, so the rules could not be exercised';
    return;
  end if;

  begin
    select id into pos_id from positions where job_code = 'ACS-LEC';

    -- -----------------------------------------------------------------------
    -- THE PROOF BRINGS ITS OWN FAMILY PROFILE. IT USED TO EDIT THE
    -- UNIVERSITY'S.
    --
    -- THIS IS WHAT STOPPED THE MIGRATION ON THE LIVE DATABASE, AT
    -- `update position_profiles set created_by = someone where id = fam_id`:
    --
    --   ERROR: new row for relation "position_profiles" violates check
    --          constraint "position_profiles_second_pair_of_eyes"
    --
    -- The University had activated the academic-staff job description through
    -- the Job Descriptions screen, and the account that activated it was the
    -- same account this proof picks as `someone`. Writing that account into
    -- `created_by` made the author and the activator one person, which is
    -- precisely what the constraint exists to refuse. THE CONSTRAINT WAS
    -- RIGHT. The proof had no business writing to their row at all.
    --
    -- Borrowing the University's data was the whole mistake, and it kept
    -- producing new failures as they used the system: first an unordered
    -- `select into` that would pick an arbitrary version once they forked one,
    -- then this. So the proof now works on a profile of its own, at a version
    -- far outside the range the University will ever reach, and touches their
    -- row only to park it — which rolls back with everything else.
    --
    -- THE CLAUSES ARE COPIED because the inheritance check below is the point
    -- of this migration: a Lecturer must inherit the family's clauses. A
    -- profile with none would prove the opposite of what it claims.
    -- -----------------------------------------------------------------------
    select id into src_id from position_profiles
     where family = 'academic-staff' and position_id is null
     order by (status = 'active') desc, version desc
     limit 1;

    update position_profiles set status = 'superseded'
     where family = 'academic-staff' and position_id is null and status = 'active';

    select coalesce(max(version), 0) + 1 into n from position_profiles
     where family = 'academic-staff' and position_id is null;
    if n < 9001 then n := 9001; end if;

    insert into position_profiles (family, version, status, job_purpose)
    values ('academic-staff', n, 'draft',
            'To carry the teaching, assessment and scholarship of the discipline, and to '
            'supervise the students allocated to the post.')
    returning id into fam_id;

    insert into position_profile_clauses (profile_id, section, ordinal, body)
    select fam_id, c.section, c.ordinal, c.body
      from position_profile_clauses c
     where c.profile_id = src_id;

    -- ---- A PROFILE BELONGS TO A POST OR A FAMILY, NEVER BOTH ---------------
    refused := false;
    begin
      insert into position_profiles (position_id, family, status)
      values (pos_id, 'academic-staff', 'draft');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '048 FAILED: a profile belonged to a post and a family at once, so it '
                      'is inherited by itself';
    end if;

    refused := false;
    begin
      insert into position_profiles (status) values ('draft');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '048 FAILED: a profile belonging to nothing was accepted';
    end if;

    -- ---- NOBODY ACTIVATES WHAT THEY WROTE ---------------------------------
    update position_profiles set created_by = someone where id = fam_id;
    refused := false;
    begin
      update position_profiles
         set status = 'active', activated_by = someone, activated_at = now()
       where id = fam_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '048 FAILED: the author of a job description activated it alone, so one '
                      'person set the terms on which somebody else can be dismissed';
    end if;

    -- ---- AND AN ACTIVE ONE SAYS WHY THE POST EXISTS ------------------------
    refused := false;
    begin
      update position_profiles
         set job_purpose = 'Teaching.', status = 'active',
             activated_by = other, activated_at = now()
       where id = fam_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '048 FAILED: a job description was approved with no statement of what '
                      'the post is for';
    end if;

    update position_profiles
       set status = 'active', activated_by = other, activated_at = now()
     where id = fam_id;

    -- ---- THE POST INHERITS THE FAMILY'S CLAUSES ----------------------------
    select count(*) into n from position_job_description where position_id = pos_id;
    if n = 0 then
      raise exception '048 FAILED: a Lecturer inherited nothing from the academic staff family';
    end if;
    if not exists (select 1 from position_job_description
                    where position_id = pos_id and source = 'family') then
      raise exception '048 FAILED: nothing in the Lecturer''s job description came from the '
                      'family, so the inheritance is not working';
    end if;

    -- ---- AND ITS OWN CLAUSE REPLACES THE FAMILY'S FOR THAT SECTION ---------
    --
    -- THE NEXT FREE VERSION, AND THE POST'S OWN ACTIVE PROFILE PARKED FIRST.
    -- Version 1 was hard-coded here, and `one_active_per_post_idx` permits one
    -- active profile per post — so the first time the University gives the
    -- Lecturer a job description of its own, both the version and the active
    -- slot collide and the migration fails on a database where nothing is
    -- wrong. Rolled back with the rest of the block.
    update position_profiles set status = 'superseded'
     where position_id = pos_id and status = 'active';

    select coalesce(max(version), 0) + 1 into n from position_profiles
     where position_id = pos_id;
    if n < 9001 then n := 9001; end if;

    insert into position_profiles (position_id, version, status, job_purpose,
                                   created_by, activated_by, activated_at)
    values (pos_id, n, 'active',
            'To teach the courses of the department to the standard the University requires, '
            'and to supervise the students allocated to the post.',
            someone, other, now())
    returning id into own_id;
    insert into position_profile_clauses (profile_id, section, ordinal, body)
    values (own_id, 'research', 1,
            'Pursue research in the discipline as agreed annually with the Head of Department.');

    if exists (select 1 from position_job_description
                where position_id = pos_id and section = 'research' and source = 'family') then
      raise exception '048 FAILED: a post with its own research clause still inherited the '
                      'family''s, so the job description says two things about one duty';
    end if;
    -- …while the sections it did not restate still come from the family.
    if not exists (select 1 from position_job_description
                    where position_id = pos_id and section = 'confidentiality'
                      and source = 'family') then
      raise exception '048 FAILED: stating one section lost the rest of the family''s clauses';
    end if;

    -- ---- A DRAFT JOB DESCRIPTION CANNOT REACH AN APPOINTEE -----------------
    -- The door the draft state exists to close, and 048 seeds everything as a
    -- draft, so this is the guard that keeps the seeded wording off a letter.
    -- Again the next free version, for the reason above.
    insert into position_profiles (position_id, version, status, created_by)
    values (pos_id, n + 1, 'draft', someone)
    returning id into own_id;

    -- (validate so the NOT VALID constraint applies to what follows)
    alter table appointments validate constraint appointments_jd_is_approved;

    refused := false;
    begin
      insert into appointments
        (full_name, position_title, employment_type, start_date, terms, status,
         drafted_by, position_id, position_profile_id)
      values ('A Specimen Appointee', 'Lecturer', 'permanent', current_date + 30,
              'The terms.', 'draft', someone, pos_id, own_id);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '048 FAILED: an unapproved job description was attached to an '
                      'appointment, so a first draft reached an appointee as the terms of '
                      'their post';
    end if;

    -- ---- AN INDICATIVE FIGURE IS A COMPLETE ONE OR NONE AT ALL ------------
    -- A number with no currency beside it is the thing that ends up on a
    -- letter as "2000" and is read as dollars by one officer and francs by
    -- the next.
    refused := false;
    begin
      update positions set indicative_salary_amount = 2000 where id = pos_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '048 FAILED: a post carries an indicative figure in no currency';
    end if;
    update positions
       set indicative_salary_amount = 2000, indicative_salary_currency = 'USD',
           indicative_salary_period = 'month'
     where id = pos_id;

    -- …and the appointment still carries no salary, because an indicative
    -- figure is not a decision about anybody's pay.
    if exists (select 1 from appointments where position_id = pos_id
                 and salary_amount = 2000) then
      raise exception '048 FAILED: an indicative figure reached an appointment by itself';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '048 OK: an indicative salary on a post is complete or absent, and never '
               'reaches a letter by itself';
  raise notice '048 OK: a profile belongs to a post or a family and never to both or neither';
  raise notice '048 OK: nobody activates the job description they wrote, and an approved one '
               'states what the post is for';
  raise notice '048 OK: a post inherits its family''s clauses, and its own clause replaces '
               'the family''s for that section without losing the rest';
  raise notice '048 OK: an unapproved job description cannot be attached to an appointment';
end $$;


-- ===========================================================================
-- 10. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- The establishment, by family.
select family, count(*) as posts from positions group by 1 order by 1;

-- ---------------------------------------------------------------------------
-- EVERYTHING WAITING TO BE READ AND APPROVED. This should be eight rows — the
-- eight family profiles — and every one of them is a draft written to be
-- edited, not the University's policy.
-- ---------------------------------------------------------------------------
select what, code, version, clauses from position_profiles_unapproved order by what;


-- ===========================================================================
-- ===========================================================================
--
--   049_verification_signatures_and_the_written_letter.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 049 — VERIFICATION, SIGNATURES, AND THE LETTER AS IT WAS WRITTEN
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. AN OFFICIAL LETTER CAN BE CHECKED BY A STRANGER. 042 built the
--    verification view for appointment letters; correspondence had none, so a
--    ministry holding a letter from the Vice-Chancellor could scan its QR code
--    and be told nothing. `correspondence_verification` answers for it.
--
-- 2. A SIGNATURE IMAGE IS A CONTROLLED FEATURE, NOT A FILE ON A PAGE. The
--    University asked that an electronic signature be explicit rather than an
--    image pasted onto every document. `signature_specimens` holds one per
--    officer, switched off until somebody OTHER than its owner enables it, and
--    every letter records which mode it was signed in. An officer's signature
--    that anybody can attach to anything is a forgery kit.
--
-- 3. THE VICE-CHANCELLOR CAN WRITE A LETTER RATHER THAN TYPE ONE. Official
--    correspondence gains `body_format`, so a body can be plain text or the
--    sanitised HTML a rich-text editor produces. Plain stays the default and
--    every existing letter is plain.
--
-- 4. TWO KINDS OF LETTER THE UNIVERSITY NAMED AND THE REGISTER DID NOT HAVE:
--    an Official Response and a Special Assignment.
--
-- ---------------------------------------------------------------------------
-- THE ONE THING TO READ TWICE
-- ---------------------------------------------------------------------------
--
-- THE PUBLIC VERIFICATION OF A LETTER NAMES NOBODY. An appointment letter's
-- view already carries the holder and the post, because that is what a bank or
-- an embassy is checking. Correspondence is different: a warning letter and a
-- disciplinary directive are correspondence, and a verification page that
-- printed "To: [name], Subject: Final written warning" would publish a
-- disciplinary record to anybody who scanned the code.
--
-- So `correspondence_verification` carries the reference, the kind, the office,
-- the date, the version and whether it stands — and no recipient, no subject
-- and no body. It answers "is this a genuine, current letter of the University"
-- and refuses to answer anything else.
-- ===========================================================================


-- ===========================================================================
-- 1. THE TWO MISSING KINDS
-- ===========================================================================

do $$
declare
  con text;
begin
  select conname into con from pg_constraint
   where conrelid = 'correspondence'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%commendation%'
     and pg_get_constraintdef(oid) like '%directive%'
   limit 1;

  if con is not null then
    execute format('alter table correspondence drop constraint %I', con);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'correspondence_kind_known') then
    alter table correspondence add constraint correspondence_kind_known
      check (kind in (
        'general', 'appointment', 'reappointment', 'promotion', 'invitation',
        'commendation', 'recommendation', 'government', 'university',
        'partnership', 'directive', 'warning', 'authorization',
        'official-response', 'special-assignment', 'special', 'other'));
  end if;
end $$;


-- ===========================================================================
-- 2. THE LETTER AS IT WAS WRITTEN
-- ===========================================================================
--
-- SANITISED BEFORE IT ARRIVES, NOT WHEN IT IS DISPLAYED. The application holds
-- a closed allow-list of tags and strips everything else on the way in, so what
-- is stored is what can safely be printed. Sanitising on the way out would mean
-- the archived bytes and the printed bytes are different documents, and the
-- hash then proves the wrong one.
--
-- A NOTE ON WHY THIS IS NOT A FREE FIELD. The body goes onto a sealed document.
-- Script, style, iframe, event handlers and external references are refused by
-- the application, and this constraint is the database saying the same thing
-- for a caller that forgets — a crude check, deliberately, because a
-- sophisticated one in SQL would be a second sanitiser to keep in step.

alter table correspondence
  add column if not exists body_format text not null default 'plain';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'correspondence_body_format_known') then
    alter table correspondence add constraint correspondence_body_format_known
      check (body_format in ('plain', 'html'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'correspondence_body_carries_no_script') then
    alter table correspondence add constraint correspondence_body_carries_no_script
      check (
        body_format <> 'html'
        -- `\y`, NOT `\b`. Postgres regular expressions read `\b` as a
        -- backspace character, not a word boundary — so the first version of
        -- this constraint matched nothing at all and the proof below walked a
        -- script straight into the body of an official letter. It took one run
        -- to find, which is the argument for performing a guard rather than
        -- reading it.
        or (body !~* '<\s*(script|style|iframe|object|embed|form|link|meta)\y'
            and body !~* '\son[a-z]+\s*=')
      );
  end if;
end $$;

comment on column correspondence.body_format is
  'plain or html. HTML is what a rich-text editor produced, sanitised by the application '
  'against a closed allow-list BEFORE it was stored — so the archived bytes and the printed '
  'bytes are the same document and the hash proves the one that went out.';


-- ===========================================================================
-- 3. SIGNATURES — AN EXPLICIT, CONTROLLED FEATURE
-- ===========================================================================
--
-- The University's instruction: "make it an explicit controlled feature rather
-- than simply placing an image of a signature onto every document."
--
-- So a specimen is off until switched on, switched on by somebody other than
-- the person whose signature it is, and usable only by that person. An
-- officer's signature image that any administrator can attach to any document
-- is not a signature; it is a forgery kit with an audit trail.

create table if not exists signature_specimens (
  id            uuid primary key default gen_random_uuid(),

  -- WHOSE SIGNATURE IT IS. One per person: two specimens for one officer means
  -- two signatures on the University's documents and no way to say which is
  -- theirs.
  owner_id      uuid not null unique references auth.users (id) on delete cascade,
  owner_name    text not null check (length(btrim(owner_name)) >= 3),
  owner_role    text not null check (length(btrim(owner_role)) >= 2),

  -- A data URI. Held in the row rather than in storage because it is small,
  -- because it must not be fetchable by URL, and because a signature reachable
  -- over HTTP is a signature anybody can download.
  image         text check (image is null or image like 'data:image/%'),

  -- OFF UNTIL SWITCHED ON.
  enabled       boolean not null default false,
  enabled_by    uuid references auth.users (id) on delete set null,
  enabled_at    timestamptz,
  -- Why the University permitted it. A specimen signature is a standing
  -- authority to sign in somebody's name, and one nobody explained is one
  -- nobody can withdraw with confidence.
  authority     text,

  revoked_at    timestamptz,
  revoked_reason text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

do $$
begin
  -- NOBODY ENABLES THEIR OWN. The same second pair of eyes this system requires
  -- of a certificate design, a letter template and a job description — and here
  -- the thing being approved is the ability to reproduce somebody's signature.
  if not exists (select 1 from pg_constraint where conname = 'signature_specimens_second_pair_of_eyes') then
    alter table signature_specimens add constraint signature_specimens_second_pair_of_eyes
      check (enabled_by is null or enabled_by <> owner_id);
  end if;

  -- AN ENABLED SPECIMEN NAMES WHO ENABLED IT, WHEN, ON WHAT AUTHORITY, AND HAS
  -- AN IMAGE TO USE.
  if not exists (select 1 from pg_constraint where conname = 'signature_specimens_enabling_is_complete') then
    alter table signature_specimens add constraint signature_specimens_enabling_is_complete
      check (
        not enabled
        or (enabled_by is not null and enabled_at is not null and image is not null
            and authority is not null and length(btrim(authority)) >= 20)
      );
  end if;

  -- A REVOKED SPECIMEN IS NOT ENABLED.
  if not exists (select 1 from pg_constraint where conname = 'signature_specimens_revoked_is_off') then
    alter table signature_specimens add constraint signature_specimens_revoked_is_off
      check (revoked_at is null or not enabled);
  end if;
end $$;

alter table signature_specimens enable row level security;

-- NOBODY READS SOMEBODY ELSE'S SPECIMEN. Not HR, not an administrator. The
-- letter generator runs with the service role and reads it for the person who
-- is signing; nothing else has a reason to see the image at all.
drop policy if exists signature_specimens_own on signature_specimens;
create policy signature_specimens_own on signature_specimens
  for select to authenticated using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- AND EVERY LETTER RECORDS HOW IT WAS SIGNED
-- ---------------------------------------------------------------------------
--
-- "Signed by [name] / Title / Authorization date" — the three the University
-- asked to be recorded, plus the one that matters afterwards: whether the
-- document carries a reproduced signature or a typed name over a rule.

alter table appointment_letters
  add column if not exists signature_mode text not null default 'typed',
  add column if not exists signature_specimen_id uuid references signature_specimens (id)
    on delete restrict,
  add column if not exists authorized_on date;

alter table correspondence_letters
  add column if not exists signature_mode text not null default 'typed',
  add column if not exists signature_specimen_id uuid references signature_specimens (id)
    on delete restrict,
  add column if not exists authorized_on date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'appointment_letters_signature_mode_known') then
    alter table appointment_letters add constraint appointment_letters_signature_mode_known
      check (signature_mode in ('typed', 'specimen')
             and (signature_mode <> 'specimen' or signature_specimen_id is not null));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'correspondence_letters_signature_mode_known') then
    alter table correspondence_letters add constraint correspondence_letters_signature_mode_known
      check (signature_mode in ('typed', 'specimen')
             and (signature_mode <> 'specimen' or signature_specimen_id is not null));
  end if;
end $$;


-- ===========================================================================
-- 4. WHAT A STRANGER IS TOLD
-- ===========================================================================
--
-- THIS VIEW NAMES NOBODY, and that is the whole design of it. A warning letter
-- and a disciplinary directive are correspondence. A verification page printing
-- "To: [name] — Subject: Final written warning" would publish a disciplinary
-- record to anybody who scanned the code off a document lying on a desk.
--
-- It answers one question: is this a genuine, current letter of the University.

-- ---------------------------------------------------------------------------
-- DROPPED FIRST, NOT REPLACED. `create or replace view` cannot remove a column,
-- and on the SECOND run of RUN-ALL 042 recreates the appointment view in its
-- own narrower shape and then this file tries to widen it again — which
-- Postgres refuses with "cannot drop columns from view". The first pass was
-- clean and the second was not, which is exactly what running it twice is for.
-- ---------------------------------------------------------------------------
drop view if exists correspondence_verification;

create view correspondence_verification
with (security_invoker = false) as
select l.reference,
       'Official Correspondence'::text as document,
       -- The KIND is safe and useful — a reader is checking a letter they are
       -- already holding, and it tells them the register agrees with the
       -- letterhead in front of them.
       c.kind,
       c.originating_office            as office,
       l.issued_on                     as issued,
       l.version,
       case
         -- A SUPERSEDED LETTER IS NOT A FORGERY, and saying so would be wrong
         -- in a way that costs somebody a contract. It was genuine and has
         -- been replaced.
         when l.superseded_at is not null then 'Superseded'
         when c.status = 'withdrawn' then 'Withdrawn'
         when c.status <> 'issued' then 'Not issued'
         else 'Valid'
       end                             as status,
       (select max(v.version) from correspondence_letters v
         where v.correspondence_id = l.correspondence_id) as current_version,
       l.signature_mode
  from correspondence_letters l
  join correspondence c on c.id = l.correspondence_id;

comment on view correspondence_verification is
  'What the QR code on an official letter resolves to. Carries no recipient, no subject and '
  'no body: a warning letter is correspondence, and a verification page that named the '
  'recipient would publish a disciplinary record to anybody who scanned the code.';

grant select on correspondence_verification to anon, authenticated, service_role;

-- The appointment view gains the signature mode too, so a reader can be told
-- whether the document they hold carries a reproduced signature.
drop view if exists appointment_letter_verification;

create view appointment_letter_verification
with (security_invoker = false) as
select l.reference,
       'Appointment Letter'::text             as document,
       a.full_name                            as holder,
       a.position_title                       as position,
       coalesce(a.unit_name, '')              as unit,
       l.issued_on                            as issued,
       l.version,
       case
         when l.superseded_at is not null then 'Superseded'
         when a.status in ('withdrawn', 'declined') then 'Not in force'
         when a.status = 'ended' then 'Ended'
         else 'Valid'
       end                                    as status,
       (select max(v.version) from appointment_letters v
         where v.appointment_id = l.appointment_id) as current_version,
       l.signature_mode
  from appointment_letters l
  join appointments a on a.id = l.appointment_id;

grant select on appointment_letter_verification to anon, authenticated, service_role;


-- ===========================================================================
-- 5. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  someone uuid;
  other uuid;
  c_id uuid;
  s_id uuid;
  found text;
begin
  select id into someone from auth.users limit 1;
  select id into other from auth.users where id <> someone limit 1;
  if someone is null or other is null then
    raise notice '049: fewer than two accounts, so the rules could not be exercised';
    return;
  end if;

  begin
    -- ---- THE TWO NEW KINDS ARE FILEABLE -----------------------------------
    insert into correspondence (kind, subject, body, recipient_name, initiated_by, status)
    values ('official-response', 'Response to the Ministry',
            'The University responds to the correspondence received last month as follows.',
            'The Ministry of Higher Education', someone, 'draft')
    returning id into c_id;

    insert into correspondence (kind, subject, body, recipient_name, initiated_by, status)
    values ('special-assignment', 'Special assignment',
            'You are assigned to the task described below for the period stated.',
            'A Specimen Officer', someone, 'draft');

    -- ---- A RICH-TEXT BODY CANNOT CARRY A SCRIPT ---------------------------
    -- The body goes onto a sealed document. This is the database saying what
    -- the application's sanitiser says, for the caller that forgets.
    refused := false;
    begin
      update correspondence
         set body_format = 'html',
             body = '<p>Dear Minister,</p><script>alert(1)</script><p>Yours sincerely.</p>'
       where id = c_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '049 FAILED: a script reached the body of an official letter';
    end if;

    refused := false;
    begin
      update correspondence
         set body_format = 'html',
             body = '<p onclick="steal()">Dear Minister, the University writes as follows.</p>'
       where id = c_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '049 FAILED: an event handler reached the body of an official letter';
    end if;

    -- …and ordinary marked-up prose is fine.
    update correspondence
       set body_format = 'html',
           body = '<p>Dear Minister,</p><p>The University writes to confirm the '
                  || 'arrangements discussed, and <strong>accepts</strong> the timetable '
                  || 'proposed.</p>'
     where id = c_id;

    -- ---- NOBODY ENABLES THEIR OWN SIGNATURE -------------------------------
    insert into signature_specimens (owner_id, owner_name, owner_role, image)
    values (someone, 'The Vice-Chancellor', 'Vice-Chancellor',
            'data:image/png;base64,iVBORw0KGgo=')
    returning id into s_id;

    refused := false;
    begin
      update signature_specimens
         set enabled = true, enabled_by = someone, enabled_at = now(),
             authority = 'Approved by the University Council on the date stated.'
       where id = s_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '049 FAILED: an officer switched on the reproduction of their own '
                      'signature, so one person created a standing authority to sign in '
                      'their own name';
    end if;

    -- ---- AND ENABLING ONE SAYS ON WHAT AUTHORITY --------------------------
    refused := false;
    begin
      update signature_specimens
         set enabled = true, enabled_by = other, enabled_at = now()
       where id = s_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '049 FAILED: a specimen signature was switched on with no authority '
                      'stated, so nobody can say on what basis it may be withdrawn';
    end if;

    update signature_specimens
       set enabled = true, enabled_by = other, enabled_at = now(),
           authority = 'Approved by the University Council on the date stated.'
     where id = s_id;

    -- ---- A LETTER SIGNED BY SPECIMEN NAMES THE SPECIMEN -------------------
    refused := false;
    begin
      update correspondence_letters set signature_mode = 'specimen'
       where reference = 'VC-2026-0042';
    exception when others then refused := true;
    end;
    -- (the row may not exist on this database; what matters is that a mode of
    -- 'specimen' with no specimen is refused, proved directly below)

    insert into correspondence (kind, subject, body, recipient_name, initiated_by,
                                status, authorized_by, authorized_at, issued_at)
    values ('invitation', 'Convocation invitation',
            'The University would be honoured by your presence at its convocation.',
            'A Specimen Guest', someone, 'issued', other, now(), now())
    returning id into c_id;

    refused := false;
    begin
      insert into correspondence_letters
        (correspondence_id, reference, issued_on, html, signature_mode)
      values (c_id, 'VC-2026-9049', current_date, '<p>The letter.</p>', 'specimen');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '049 FAILED: a letter claims a reproduced signature and names no '
                      'specimen, so nobody can say whose signature is on it';
    end if;

    insert into correspondence_letters
      (correspondence_id, reference, issued_on, html, signature_mode, signature_specimen_id)
    values (c_id, 'VC-2026-9049', current_date, '<p>The letter.</p>', 'specimen', s_id);

    -- ---- AND THE STRANGER IS TOLD ENOUGH, AND NO MORE ---------------------
    select status into found from correspondence_verification where reference = 'VC-2026-9049';
    if found is distinct from 'Valid' then
      raise exception '049 FAILED: an issued letter verifies as %', coalesce(found, 'nothing');
    end if;

    -- THE PRIVACY CHECK, PERFORMED RATHER THAN ASSERTED IN A COMMENT.
    if exists (
      select 1 from information_schema.columns
       where table_name = 'correspondence_verification'
         and column_name in ('recipient_name', 'recipient_org', 'recipient_email',
                             'subject', 'body', 'recipient_address')
    ) then
      raise exception '049 FAILED: the public verification of a letter carries the recipient '
                      'or the subject, so scanning a warning letter publishes a disciplinary '
                      'record';
    end if;

    -- A withdrawn letter says so rather than reading as a forgery.
    update correspondence set status = 'withdrawn',
           withdrawn_reason = 'Superseded by a later decision of the University.'
     where id = c_id;
    select status into found from correspondence_verification where reference = 'VC-2026-9049';
    if found is distinct from 'Withdrawn' then
      raise exception '049 FAILED: a withdrawn letter verifies as %', coalesce(found, 'nothing');
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '049 OK: an official response and a special assignment are fileable kinds';
  raise notice '049 OK: a rich-text body cannot carry a script, a style block or an event '
               'handler onto a sealed document';
  raise notice '049 OK: nobody switches on the reproduction of their own signature, and '
               'enabling one states the authority for it';
  raise notice '049 OK: a letter claiming a reproduced signature names whose it is';
  raise notice '049 OK: a stranger can check a letter, and is told no recipient and no subject';
end $$;


-- ===========================================================================
-- 6. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- Every letter a stranger could be holding, and what they would be told.
select reference, kind, office, issued, version, status
  from correspondence_verification
 order by issued desc, reference;

-- SPECIMEN SIGNATURES IN FORCE. Each one is a standing authority to reproduce
-- somebody's signature on a University document. If this list is longer than
-- the University expects, that is the thing to act on today.
select owner_name, owner_role, enabled, enabled_at, authority
  from signature_specimens
 where enabled
 order by owner_name;


-- ===========================================================================
-- ===========================================================================
--
--   050_acceptance_the_activation_rule_and_the_full_audit.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 050 — ACCEPTANCE, THE ACTIVATION RULE, AND THE REST OF THE AUDIT TRAIL
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT THE AUDIT FOUND, AND WHAT THIS FIXES
-- ---------------------------------------------------------------------------
--
-- The University asked for a full implementation audit before more code. Of the
-- eleven links it listed for an appointment, nine already existed: person,
-- position, department, initiator, approver, issuer, documents, versions and
-- audit events. TWO DID NOT.
--
-- 1. ACCEPTANCE WAS A TIMESTAMP. `appointments.accepted_at` said WHEN somebody
--    accepted and nothing else — not who, and not WHICH VERSION of the letter
--    they were looking at. An appointee who accepted version 1 and was later
--    sent version 2 with a different salary had, on the record, simply
--    "accepted". That is the fact a dispute turns on.
--
-- 2. FACULTY WAS NOT RECORDED. A department carries one; an appointment to a
--    post that is not in a department carried nothing.
--
-- AND THE AUDIT VOCABULARY WAS SHORT. Of the fifteen actions the University
-- named, `appointment_events` could record nine. Letter viewed, letter
-- downloaded, email sent, email failed, appointment accepted and appointment
-- renewed had no event to be recorded as — so the trail could not show them
-- even though the code was willing to write them.
--
-- ---------------------------------------------------------------------------
-- AND THE ONE THING TO READ TWICE
-- ---------------------------------------------------------------------------
--
-- WHEN DOES SOMEBODY BECOME A MEMBER OF STAFF? The University said to keep
-- approved, issued, accepted and active distinct — they now are — and to make
-- the rule configurable rather than assumed.
--
-- `institutional_settings.staff_activation_point` is that rule, seeded to
-- 'accepted'. THIS IS A DEFAULT AND NOT A DECISION: it is the most cautious of
-- the three, because a staff record created on issue exists for somebody who
-- may yet decline. Change it to 'issued' or 'start_date' if the University
-- means something else; the trigger reads the setting rather than hard-coding
-- any of them.
-- ===========================================================================


-- ===========================================================================
-- 1. THE ACCEPTANCE
-- ===========================================================================
--
-- ITS OWN TABLE, NOT A COLUMN. An acceptance is an act by the APPOINTEE — the
-- only act in this whole workflow that is not the University's — and it is the
-- one a dispute turns on. A row can say who, when, from where, and which
-- version of which document they were answering.

create table if not exists appointment_acceptances (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,

  -- WHICH DOCUMENT THEY WERE LOOKING AT. Not a copy of the reference for
  -- convenience: the letter they read is the letter they agreed to, and an
  -- amendment issued afterwards does not retroactively become the thing they
  -- accepted.
  letter_id      uuid not null references appointment_letters (id) on delete restrict,
  reference      text not null,
  version        integer not null check (version >= 1),

  decision       text not null check (decision in ('accepted', 'declined')),

  -- WHO. The appointee's own account where they have one, and their typed name
  -- either way — an appointee accepting by a link in an email may not have a
  -- portal account yet, and refusing the acceptance until they do would mean
  -- the University could not record what actually happened.
  accepted_by    uuid references auth.users (id) on delete set null,
  accepted_name  text not null check (length(btrim(accepted_name)) >= 3),
  accepted_email text,

  -- A DECLINE SAYS WHY, like every other closure in this system.
  reason         text,

  at             timestamptz not null default now()
);

create index if not exists appointment_acceptances_appointment_idx
  on appointment_acceptances (appointment_id, at);

do $$
begin
  -- A DECLINE STATES A REASON.
  if not exists (select 1 from pg_constraint where conname = 'appointment_acceptances_decline_explained') then
    alter table appointment_acceptances add constraint appointment_acceptances_decline_explained
      check (decision <> 'declined' or (reason is not null and length(btrim(reason)) >= 10));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- ONE STANDING ANSWER PER APPOINTMENT.
--
-- A partial unique index rather than a plain one: an appointee may decline and
-- the University may later reissue an amended letter which they accept, and
-- both rows are the truth. What must not happen is two LIVE answers at once.
-- Superseded answers are marked rather than deleted.
-- ---------------------------------------------------------------------------
alter table appointment_acceptances
  add column if not exists superseded_at timestamptz;

create unique index if not exists appointment_acceptances_one_standing_idx
  on appointment_acceptances (appointment_id) where superseded_at is null;

-- ---------------------------------------------------------------------------
-- AN ACCEPTANCE IS OF AN ISSUED LETTER, and of THE CURRENT one.
--
-- Accepting a superseded version is the failure this exists to catch: the
-- appointee opens an old email, clicks accept, and the register records them as
-- having agreed to terms the University has already replaced.
-- ---------------------------------------------------------------------------
create or replace function refuse_acceptance_of_a_stale_letter() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  l record;
begin
  select * into l from appointment_letters where id = new.letter_id;
  if l is null then
    raise exception 'No such letter.' using errcode = 'check_violation';
  end if;
  if l.appointment_id <> new.appointment_id then
    raise exception 'That letter belongs to a different appointment.'
      using errcode = 'check_violation';
  end if;
  if l.superseded_at is not null then
    raise exception
      'This letter has been superseded. The appointee is answering a version the University '
      'has already replaced — send them the current one rather than recording an agreement '
      'to terms that no longer stand.'
      using errcode = 'check_violation';
  end if;
  if not exists (select 1 from appointments a
                  where a.id = new.appointment_id and a.issued_at is not null) then
    raise exception
      'This appointment has not been issued, so there is nothing for the appointee to have '
      'accepted.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists appointment_acceptances_of_a_current_letter on appointment_acceptances;
create trigger appointment_acceptances_of_a_current_letter
  before insert on appointment_acceptances
  for each row execute function refuse_acceptance_of_a_stale_letter();

alter table appointment_acceptances enable row level security;

drop policy if exists appointment_acceptances_read on appointment_acceptances;
create policy appointment_acceptances_read on appointment_acceptances
  for select to authenticated
  using (exists (select 1 from appointments a where a.id = appointment_acceptances.appointment_id));


-- ===========================================================================
-- 2. THE FACULTY
-- ===========================================================================
--
-- FREE TEXT AGAINST THE UNIVERSITY'S STATED STRUCTURE, matching `positions`.
-- There is no faculties table — `departments.faculty` is text too — and
-- inventing one here would mean this migration asserting a list of the
-- University's faculties, which is not a migration's place.

alter table appointments
  add column if not exists faculty text;

comment on column appointments.faculty is
  'The faculty or school the post sits in. Text, matching departments.faculty and '
  'positions.faculty — the University states its faculties in its own content, not in a '
  'table a migration invented.';


-- ===========================================================================
-- 3. THE REST OF THE AUDIT VOCABULARY
-- ===========================================================================
--
-- The six the University named that could not be recorded. Note what is NOT
-- here: nothing that removes a line. The history has no delete path and no
-- capability unlocks one.

-- ---------------------------------------------------------------------------
-- A MIGRATION MUST NOT ABORT OVER HISTORY IT DID NOT WRITE.
--
-- This block failed on the University's own database:
--
--   ERROR: check constraint "appointment_events_vocabulary" of relation
--          "appointment_events" is violated by some row
--
-- It dropped the narrower vocabulary and added the wider one, and PostgreSQL
-- checks every existing row when a CHECK is added. One row in the University's
-- history carried an event word this list does not have, and the whole of
-- part two of the hand-over stopped because of it.
--
-- THE HISTORY IS NOT THE THING TO FIX. `appointment_events` is append-only by
-- design — the University's own rule, written into 041: "nothing that removes
-- a line". A migration that refuses to run until somebody edits the audit
-- trail is asking for exactly the act the audit trail exists to prevent.
--
-- SO: the vocabulary governs everything written FROM NOW ON, and a row already
-- there that falls outside it is REPORTED BY NAME rather than deleted, edited
-- or silently accepted. `not valid` is what PostgreSQL calls that, and 037
-- uses it for the same reason on `students.status`.
--
-- WHERE NOTHING VIOLATES IT, THE CONSTRAINT IS VALIDATED IMMEDIATELY, so a
-- clean database gets a fully enforced constraint and not a weaker one.
--
-- AND THE LIST AGREES WITH 079. `WHATSAPP_HANDED_OVER` is 079's word, and it
-- is here too — otherwise re-running the whole bundle after somebody has sent
-- a letter by WhatsApp would drop 079's wider vocabulary, re-add this narrower
-- one, and fail on the row 079 had quite properly allowed. That is this same
-- fault waiting to happen a second time.
-- ---------------------------------------------------------------------------

do $$
declare
  con      text;
  stray    text;
  strays   integer;
begin
  select conname into con from pg_constraint
   where conrelid = 'appointment_events'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%LETTER_SUPERSEDED%'
   limit 1;

  if con is not null then
    execute format('alter table appointment_events drop constraint %I', con);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'appointment_events_vocabulary') then

    -- ---- WHAT IS ALREADY THERE THAT THIS LIST DOES NOT KNOW ----------------
    select count(*), string_agg(distinct event, ', ' order by event)
      into strays, stray
      from appointment_events
     where event not in (
       'DRAFTED', 'EDITED', 'REVIEWED', 'SUBMITTED_FOR_AUTHORITY', 'AUTHORIZED', 'RETURNED',
       'LETTER_GENERATED', 'LETTER_ISSUED', 'LETTER_VIEWED', 'LETTER_DOWNLOADED',
       'LETTER_SUPERSEDED', 'EMAIL_SENT', 'EMAIL_FAILED', 'LETTER_DELIVERY_FAILED',
       'ACCEPTED', 'DECLINED', 'RENEWED', 'STAFF_ACTIVATED',
       'WITHDRAWN', 'ENDED', 'ADMINISTRATIVE_OVERRIDE', 'WHATSAPP_HANDED_OVER');

    alter table appointment_events add constraint appointment_events_vocabulary
      check (event in (
        'DRAFTED', 'EDITED', 'REVIEWED', 'SUBMITTED_FOR_AUTHORITY', 'AUTHORIZED', 'RETURNED',
        'LETTER_GENERATED', 'LETTER_ISSUED', 'LETTER_VIEWED', 'LETTER_DOWNLOADED',
        'LETTER_SUPERSEDED', 'EMAIL_SENT', 'EMAIL_FAILED', 'LETTER_DELIVERY_FAILED',
        'ACCEPTED', 'DECLINED', 'RENEWED', 'STAFF_ACTIVATED',
        'WITHDRAWN', 'ENDED', 'ADMINISTRATIVE_OVERRIDE', 'WHATSAPP_HANDED_OVER'))
      not valid;

    if coalesce(strays, 0) = 0 then
      -- NOTHING IN THE WAY, so it is enforced over the whole table and not
      -- only over what comes next.
      alter table appointment_events validate constraint appointment_events_vocabulary;
      raise notice '050: the appointment history vocabulary is in force over every row';
    else
      raise notice '050: % existing appointment history row(s) carry an event word this '
                   'vocabulary does not list — %. They are LEFT EXACTLY AS THEY ARE, because '
                   'this history is append-only by the University''s own rule. The vocabulary '
                   'governs everything written from now on. To see them: select event, count(*) '
                   'from appointment_events group by event order by 2 desc;', strays, stray;
    end if;
  end if;
end $$;


-- ===========================================================================
-- 4. WHEN SOMEBODY BECOMES A MEMBER OF STAFF
-- ===========================================================================
--
-- The University's instruction: keep approved, issued, accepted and active
-- distinct, and CONFIGURE the point at which the employee record becomes
-- active. So the rule is a row, not a line of code.

create table if not exists institutional_settings (
  key         text primary key,
  value       text not null,
  -- WHAT THIS SETTING MEANS, in the table, so that somebody changing it can
  -- read what they are changing without finding the migration that made it.
  description text,
  -- THE CHOICES, so a screen can offer them and a typo cannot become a policy.
  allowed     text[],
  updated_by  uuid references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'institutional_settings_value_is_allowed') then
    alter table institutional_settings add constraint institutional_settings_value_is_allowed
      check (allowed is null or value = any (allowed));
  end if;
end $$;

insert into institutional_settings (key, value, description, allowed) values
  ('staff_activation_point', 'accepted',
   'When an appointee becomes a member of staff. '
   '"issued" — as soon as the letter goes out, which creates a staff record for somebody who '
   'may yet decline. '
   '"accepted" — when the appointee has said yes. The cautious default, and what this is '
   'seeded to. '
   '"start_date" — not until the day the appointment begins, which is the strictest and means '
   'a new lecturer has no portal account until their first day.',
   array['issued', 'accepted', 'start_date'])
on conflict (key) do nothing;

alter table institutional_settings enable row level security;

drop policy if exists institutional_settings_read on institutional_settings;
create policy institutional_settings_read on institutional_settings
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- AND THE RULE IS ENFORCED, NOT ADVISORY.
--
-- 042 refused a staff record whose appointment had not been ISSUED. That was
-- the right floor and it is not the University's rule. This reads the setting.
-- ---------------------------------------------------------------------------
create or replace function staff_activation_is_permitted() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rule text;
  a record;
begin
  if new.staff_record_id is null or old.staff_record_id is not null then
    return new;
  end if;

  select value into rule from institutional_settings where key = 'staff_activation_point';
  rule := coalesce(rule, 'accepted');

  select * into a from appointments where id = new.id;

  if rule = 'issued' then
    if new.issued_at is null then
      raise exception 'This appointment has not been issued, so nobody can be made staff from it.'
        using errcode = 'check_violation';
    end if;

  elsif rule = 'accepted' then
    if not exists (select 1 from appointment_acceptances ac
                    where ac.appointment_id = new.id
                      and ac.decision = 'accepted' and ac.superseded_at is null) then
      raise exception
        'The University''s rule is that a staff record follows ACCEPTANCE, and this appointee '
        'has not accepted. Change institutional_settings.staff_activation_point if the '
        'University means something else — do not work around it, because a staff record for '
        'somebody who later declines is a person the system says works here.'
        using errcode = 'check_violation';
    end if;

  elsif rule = 'start_date' then
    if new.start_date is null or new.start_date > current_date then
      raise exception
        'The University''s rule is that a staff record begins on the start date, and this '
        'appointment starts on %.', coalesce(new.start_date::text, 'no stated date')
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists appointments_staff_activation_rule on appointments;
create trigger appointments_staff_activation_rule
  before update on appointments
  for each row execute function staff_activation_is_permitted();


-- ===========================================================================
-- 5. WHAT THE UNIVERSITY IS WAITING ON
-- ===========================================================================

create or replace view appointments_awaiting_acceptance
with (security_invoker = true) as
  select a.id,
         a.full_name,
         a.position_title,
         a.unit_name,
         a.issued_at,
         l.reference,
         l.version,
         -- HOW LONG IT HAS BEEN SITTING. The number somebody acts on: an offer
         -- unanswered for six weeks is a post the University thinks is filled.
         (current_date - a.issued_at::date) as days_waiting
    from appointments a
    join appointment_letters l
      on l.appointment_id = a.id and l.superseded_at is null
   where a.issued_at is not null
     and a.status = 'issued'
     and not exists (select 1 from appointment_acceptances ac
                      where ac.appointment_id = a.id and ac.superseded_at is null);


-- ===========================================================================
-- 6. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  someone uuid;
  other uuid;
  a_id uuid;
  l1 uuid;
  l2 uuid;
  staff uuid;
begin
  select id into someone from auth.users limit 1;
  select id into other from auth.users where id <> someone limit 1;
  if someone is null or other is null then
    raise notice '050: fewer than two accounts, so the rules could not be exercised';
    return;
  end if;

  begin
    insert into appointments
      (full_name, position_title, unit_name, faculty, employment_type, start_date, terms,
       status, drafted_by, authorized_by, authorized_at)
    values ('A Specimen Appointee', 'Lecturer', 'Department of Theology',
            'Faculty of Theology', 'permanent', current_date + 30, 'The terms.',
            'approved', someone, other, now())
    returning id into a_id;

    -- ---- NOTHING IS ACCEPTED BEFORE IT IS ISSUED --------------------------
    insert into appointment_letters (appointment_id, reference, issued_on, html)
    values (a_id, 'APT-2026-9050', current_date, '<p>Version one.</p>')
    returning id into l1;

    refused := false;
    begin
      insert into appointment_acceptances
        (appointment_id, letter_id, reference, version, decision, accepted_name)
      values (a_id, l1, 'APT-2026-9050', 1, 'accepted', 'A Specimen Appointee');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '050 FAILED: an appointee accepted a letter that had not been issued';
    end if;

    update appointments set status = 'issued', issued_at = now(), issued_by = other
     where id = a_id;

    -- ---- A DECLINE STATES A REASON ----------------------------------------
    refused := false;
    begin
      insert into appointment_acceptances
        (appointment_id, letter_id, reference, version, decision, accepted_name)
      values (a_id, l1, 'APT-2026-9050', 1, 'declined', 'A Specimen Appointee');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '050 FAILED: an appointment was declined for no stated reason';
    end if;

    -- The acceptance itself, of the version they were actually sent.
    insert into appointment_acceptances
      (appointment_id, letter_id, reference, version, decision, accepted_name, accepted_email)
    values (a_id, l1, 'APT-2026-9050', 1, 'accepted', 'A Specimen Appointee',
            'appointee@example.test');

    -- ---- ONE STANDING ANSWER ----------------------------------------------
    refused := false;
    begin
      insert into appointment_acceptances
        (appointment_id, letter_id, reference, version, decision, accepted_name, reason)
      values (a_id, l1, 'APT-2026-9050', 1, 'declined', 'A Specimen Appointee',
              'Changed their mind about the post.');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '050 FAILED: one appointment carries two standing answers at once';
    end if;

    -- ---- AND NOBODY ACCEPTS A SUPERSEDED LETTER ---------------------------
    -- The failure this is for: the appointee opens an old email, clicks accept,
    -- and the register records them as agreeing to terms already replaced.
    update appointment_acceptances set superseded_at = now() where appointment_id = a_id;
    update appointment_letters set superseded_at = now() where id = l1;
    insert into appointment_letters
      (appointment_id, reference, version, issued_on, html, kind, supersedes_reason)
    values (a_id, 'APT-2026-9051', 2, current_date, '<p>Version two.</p>', 'amended',
            'The start date moved by one month at the appointee''s request.')
    returning id into l2;

    refused := false;
    begin
      insert into appointment_acceptances
        (appointment_id, letter_id, reference, version, decision, accepted_name)
      values (a_id, l1, 'APT-2026-9050', 1, 'accepted', 'A Specimen Appointee');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '050 FAILED: an appointee accepted a letter the University had already '
                      'replaced';
    end if;

    -- ---- THE ACTIVATION RULE IS READ, NOT ASSUMED -------------------------
    -- Seeded to 'accepted'. The standing acceptance was superseded above, so
    -- there is none — and a staff record must therefore be refused.
    insert into lecturers (staff_id, first_name, last_name, email)
    values ('SPEC-050', 'A Specimen', 'Appointee', 'appointee@example.test')
    returning id into staff;

    refused := false;
    begin
      update appointments set staff_record_id = staff, staff_activated_at = now()
       where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '050 FAILED: somebody became a member of staff with no acceptance '
                      'standing, under a rule that says acceptance is the point';
    end if;

    -- With the answer given against the current letter, it goes.
    insert into appointment_acceptances
      (appointment_id, letter_id, reference, version, decision, accepted_name)
    values (a_id, l2, 'APT-2026-9051', 2, 'accepted', 'A Specimen Appointee');

    update appointments set staff_record_id = staff, staff_activated_at = now()
     where id = a_id;

    -- ---- AND THE RULE IS GENUINELY CONFIGURABLE ---------------------------
    -- Changing the setting changes the behaviour; it is not a comment.
    refused := false;
    begin
      update institutional_settings set value = 'whenever-we-feel-like-it'
       where key = 'staff_activation_point';
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '050 FAILED: the activation rule accepted a value nobody declared';
    end if;

    update institutional_settings set value = 'start_date'
     where key = 'staff_activation_point';
    update appointments set staff_record_id = null where id = a_id;

    refused := false;
    begin
      update appointments set staff_record_id = staff where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '050 FAILED: under a start-date rule, somebody starting in thirty days '
                      'was made staff today';
    end if;

    -- ---- THE SIX EVENTS THAT COULD NOT BE RECORDED ------------------------
    insert into appointment_events (appointment_id, event, actor_id)
    select a_id, e, someone from unnest(array[
      'REVIEWED', 'LETTER_VIEWED', 'LETTER_DOWNLOADED',
      'EMAIL_SENT', 'EMAIL_FAILED', 'ACCEPTED', 'RENEWED', 'STAFF_ACTIVATED'
    ]) as e;

    refused := false;
    begin
      insert into appointment_events (appointment_id, event, actor_id)
      values (a_id, 'QUIETLY_CHANGED', someone);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '050 FAILED: the audit trail accepted an event nobody declared';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '050 OK: an acceptance names who, when, and WHICH VERSION of which letter';
  raise notice '050 OK: nothing is accepted before issue, a decline states a reason, and one '
               'appointment carries one standing answer';
  raise notice '050 OK: a superseded letter cannot be accepted';
  raise notice '050 OK: the staff activation point is read from the settings and enforced, and '
               'a value nobody declared is refused';
  raise notice '050 OK: the audit trail can record all fifteen actions and nothing else';
end $$;


-- ===========================================================================
-- 7. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- WHEN SOMEBODY BECOMES STAFF AT THIS UNIVERSITY. Read this and change it if it
-- is not what the University means.
select key, value, allowed from institutional_settings where key = 'staff_activation_point';

-- OFFERS NOBODY HAS ANSWERED. An offer unanswered for six weeks is a post the
-- University believes is filled and a candidate who has taken another job.
select full_name, position_title, reference, version, days_waiting
  from appointments_awaiting_acceptance
 order by days_waiting desc;

-- What the trail can now record, in use.
select event, count(*) as times from appointment_events group by 1 order by 2 desc;


-- ===========================================================================
-- ===========================================================================
--
--   051_templates_for_every_document_the_university_issues.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 051 — A TEMPLATE REGISTRY FOR EVERY DOCUMENT THE UNIVERSITY ISSUES
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. OFFICIAL CORRESPONDENCE GETS VERSIONED TEMPLATES, and every issued letter
--    records which version produced it. 044 built the registry for eleven HR
--    documents and gave `appointment_letters` a `template_id` with
--    ON DELETE RESTRICT — the rule that keeps the wording of 2026 attached to a
--    letter issued in 2026. Correspondence had neither. The Vice-Chancellor's
--    letters to ministries were the one document family with no answer to
--    "which wording was in force when we sent this".
--
-- 2. THE OTHER THREE DOCUMENTS OF AN APPOINTMENT PACKAGE become templates too:
--    the Job Description, the Terms and Conditions of Appointment, and the
--    Acceptance of Appointment. The University named four documents and only
--    the first had a template.
--
-- 3. AN APPOINTMENT RECORDS WHICH CONDITIONS OF SERVICE APPLY TO IT. Until now
--    the letter said "the conditions of service in force from time to time",
--    which is true and unusable: an appointee in a dispute needs the version
--    that was in force when they signed, and nothing recorded it.
--
-- 4. A TEMPLATE SAYS WHEN IT TAKES EFFECT. `effective_from`, which the
--    University asked for and 044 did not carry.
--
-- ---------------------------------------------------------------------------
-- THE ONE THING TO READ TWICE
-- ---------------------------------------------------------------------------
--
-- CORRESPONDENCE TEMPLATE KINDS ARE PREFIXED `letter-`, AND THEY HAD TO BE.
-- Three names appear in both vocabularies — 'reappointment', 'promotion' and
-- 'appointment' are HR document types AND kinds of official correspondence.
-- Merged without a prefix, a template written for the Vice-Chancellor's
-- promotion LETTER would be picked up as the template for an HR promotion
-- PACKAGE, and nobody would notice until somebody read the document that came
-- out. Two vocabularies that share three words are not one vocabulary.
-- ===========================================================================


-- ===========================================================================
-- 1. THE KINDS
-- ===========================================================================

do $$
declare
  con text;
begin
  select conname into con from pg_constraint
   where conrelid = 'document_templates'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%initial-appointment%'
   limit 1;

  if con is not null then
    execute format('alter table document_templates drop constraint %I', con);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'document_templates_kind_known') then
    alter table document_templates add constraint document_templates_kind_known
      check (kind in (
        -- The eleven HR documents, unchanged. 044's rows keep their kind.
        'initial-appointment', 'reappointment', 'contract-renewal', 'promotion',
        'transfer', 'acting-appointment', 'probation-confirmation',
        'contract-extension', 'appointment-amendment', 'termination', 'retirement',

        -- The other three documents of an appointment package. The University
        -- named four and only the letter had a template.
        'job-description', 'terms-and-conditions', 'acceptance-form',

        -- Official correspondence, PREFIXED. Three of these names —
        -- reappointment, promotion, appointment — already mean something else
        -- above, and a template written for one would have been served for the
        -- other.
        'letter-general', 'letter-appointment', 'letter-reappointment',
        'letter-promotion', 'letter-invitation', 'letter-commendation',
        'letter-recommendation', 'letter-government', 'letter-university',
        'letter-partnership', 'letter-directive', 'letter-warning',
        'letter-authorization', 'letter-official-response',
        'letter-special-assignment', 'letter-special', 'letter-other'));
  end if;
end $$;


-- ===========================================================================
-- 2. WHEN A TEMPLATE TAKES EFFECT
-- ===========================================================================

alter table document_templates
  add column if not exists effective_from date;

do $$
begin
  -- AN ACTIVE TEMPLATE HAS A DATE IT CAME INTO FORCE. Not a formality: "which
  -- wording applied in March" is the question a dispute opens with, and a
  -- registry that can only answer "the one that is active now" cannot answer it.
  --
  -- NOT VALID, because 044's existing rows predate the column and refusing to
  -- run over them would leave the whole migration unapplied.
  if not exists (select 1 from pg_constraint where conname = 'document_templates_active_has_a_date') then
    alter table document_templates add constraint document_templates_active_has_a_date
      check (status <> 'active' or effective_from is not null) not valid;
  end if;
end $$;

-- Existing active templates take effect from the day they were activated,
-- which is the only honest answer available for a row written before the
-- column existed.
update document_templates
   set effective_from = coalesce(effective_from, activated_at::date, created_at::date)
 where status = 'active' and effective_from is null;


-- ===========================================================================
-- 3. CORRESPONDENCE RECORDS THE WORDING THAT MADE IT
-- ===========================================================================
--
-- THE DOROTHY RULE, EXTENDED. `on delete restrict` means a template version
-- that has produced a letter can never be deleted — so a document issued in
-- 2026 keeps the wording of 2026 even after the template has been redesigned
-- twice. 044 applied it to appointment letters. This applies it to the
-- Vice-Chancellor's.

alter table correspondence_letters
  add column if not exists template_id uuid references document_templates (id) on delete restrict,
  add column if not exists template_version integer;

create index if not exists correspondence_letters_template_idx
  on correspondence_letters (template_id) where template_id is not null;


-- ===========================================================================
-- 4. WHICH CONDITIONS OF SERVICE APPLY TO THIS APPOINTMENT
-- ===========================================================================
--
-- "The conditions of service in force from time to time" is what the letter
-- said, and it is true and unusable. An appointee in a dispute needs the
-- version that was in force when they accepted, and nothing recorded it.
--
-- Restricted on delete for the same reason as the letter template: the
-- conditions somebody was appointed under cannot be deleted out from under
-- them.

alter table appointments
  add column if not exists terms_template_id uuid references document_templates (id)
    on delete restrict,
  add column if not exists job_description_template_id uuid references document_templates (id)
    on delete restrict;

comment on column appointments.terms_template_id is
  'The version of the Terms and Conditions of Appointment that applies to this appointment. '
  'Fixed at issue and never updated afterwards: an appointee is bound by the conditions in '
  'force when they accepted, not by whatever the University writes next.';


-- ===========================================================================
-- 5. WHAT IS AND IS NOT COVERED
-- ===========================================================================
--
-- The screen the University asked for needs to show which document types have
-- an active template and which do not. Computing that in the application would
-- mean the screen and the generator disagreeing about what "covered" means.

create or replace view document_template_coverage
with (security_invoker = true) as
  select k.kind,
         t.id            as active_template_id,
         t.name,
         t.version,
         t.effective_from,
         t.activated_at,
         t.created_by,
         t.activated_by,
         (select count(*) from document_templates d where d.kind = k.kind) as versions,
         -- LETTERS ALREADY ISSUED UNDER THIS KIND. The number that decides
         -- whether a template can be retired quietly or whether somebody is
         -- holding a document made from it.
         (select count(*) from appointment_letters l
           join document_templates d on d.id = l.template_id
          where d.kind = k.kind) as appointment_letters_issued,
         (select count(*) from correspondence_letters c
           join document_templates d on d.id = c.template_id
          where d.kind = k.kind) as correspondence_issued
    from (select unnest(array[
            'initial-appointment', 'reappointment', 'contract-renewal', 'promotion',
            'transfer', 'acting-appointment', 'probation-confirmation',
            'contract-extension', 'appointment-amendment', 'termination', 'retirement',
            'job-description', 'terms-and-conditions', 'acceptance-form',
            'letter-general', 'letter-appointment', 'letter-reappointment',
            'letter-promotion', 'letter-invitation', 'letter-commendation',
            'letter-recommendation', 'letter-government', 'letter-university',
            'letter-partnership', 'letter-directive', 'letter-warning',
            'letter-authorization', 'letter-official-response',
            'letter-special-assignment', 'letter-special', 'letter-other']) as kind) k
    left join document_templates t on t.kind = k.kind and t.status = 'active';


-- ===========================================================================
-- 6. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  someone uuid;
  other uuid;
  t_id uuid;
  c_id uuid;
  a_id uuid;
  n integer;
begin
  select id into someone from auth.users limit 1;
  select id into other from auth.users where id <> someone limit 1;
  if someone is null or other is null then
    raise notice '051: fewer than two accounts, so the rules could not be exercised';
    return;
  end if;

  begin
    -- ---- FIRST, GET OUT OF THE UNIVERSITY'S WAY ---------------------------
    -- The same fault 044 was stopped by on the live database: this proof
    -- activates a 'terms-and-conditions' template, and `one_active_idx`
    -- permits one active per kind. A University that has activated its own
    -- conditions of service through Settings would collide with this proof and
    -- the migration would fail on a database where nothing is wrong.
    --
    -- Rolled back with the rest of the block, so the University's template is
    -- active again the moment the proof ends.
    update document_templates set status = 'retired'
     where kind = 'terms-and-conditions' and status = 'active';

    -- ---- THE NEW KINDS ARE REGISTRABLE ------------------------------------
    -- VERSION 9001, NOT 1, and for the reason 044's proof now carries too: 052
    -- seeds a version 1 of every kind, so a proof claiming version 1 collides
    -- with the University's own first draft on a re-run.
    insert into document_templates (kind, version, name, body, status, created_by)
    values ('terms-and-conditions', 9001, 'Conditions of Service',
            'The conditions of service of the University, as approved by the Council.',
            'draft', someone)
    returning id into t_id;

    insert into document_templates (kind, version, name, body, status, created_by)
    values ('letter-government', 9001, 'Government Correspondence',
            'The standard form of a letter to a government ministry.', 'draft', someone);

    -- ---- AND A KIND NOBODY DECLARED IS REFUSED ----------------------------
    refused := false;
    begin
      insert into document_templates (kind, version, name, body, status, created_by)
      values ('a-kind-we-made-up', 9001, 'Something', 'A body long enough to pass.',
              'draft', someone);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '051 FAILED: the registry accepted a document kind nobody declared';
    end if;

    -- ---- AN ACTIVE TEMPLATE STATES WHEN IT TOOK EFFECT --------------------
    alter table document_templates validate constraint document_templates_active_has_a_date;

    refused := false;
    begin
      update document_templates
         set status = 'active', activated_by = other, activated_at = now()
       where id = t_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '051 FAILED: a template came into force on no particular date, so '
                      '"which wording applied in March" cannot be answered';
    end if;

    update document_templates
       set status = 'active', activated_by = other, activated_at = now(),
           effective_from = current_date
     where id = t_id;

    -- ---- THE CONDITIONS SOMEBODY WAS APPOINTED UNDER CANNOT BE DELETED ----
    insert into appointments
      (full_name, position_title, employment_type, start_date, terms, status,
       drafted_by, terms_template_id)
    values ('A Specimen Appointee', 'Lecturer', 'permanent', current_date + 30,
            'The conditions of service apply.', 'draft', someone, t_id)
    returning id into a_id;

    refused := false;
    begin
      delete from document_templates where id = t_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '051 FAILED: the conditions of service somebody was appointed under were '
                      'deleted out from under them';
    end if;

    -- ---- AND A CORRESPONDENCE LETTER RECORDS ITS WORDING -------------------
    insert into correspondence (kind, subject, body, recipient_name, initiated_by, status,
                                authorized_by, authorized_at, issued_at)
    values ('government', 'Accreditation correspondence',
            'The University writes to the Ministry on the matter discussed.',
            'The Ministry of Higher Education', someone, 'issued', other, now(), now())
    returning id into c_id;

    insert into correspondence_letters
      (correspondence_id, reference, issued_on, html, template_id, template_version)
    values (c_id, 'VC-2099-0051', current_date, '<p>The letter.</p>', t_id, 9001);

    refused := false;
    begin
      delete from document_templates where id = t_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '051 FAILED: a template that produced a letter to a ministry was deleted, '
                      'so the University cannot say what wording it sent';
    end if;

    -- ---- THE COVERAGE VIEW SEES WHAT IS MISSING ---------------------------
    --
    -- THIS USED TO ASSERT THAT SOMETHING WAS MISSING — and said so in its own
    -- failure message: "which on a fresh database cannot be true".
    --
    -- The University's database is not a fresh database. They have put a
    -- template in force for EVERY kind the University issues, which is exactly
    -- the work this view exists to track to completion. So the proof failed
    -- them for having finished it, and the message sent whoever read it
    -- looking for a broken view.
    --
    -- A PROOF MUST NOT ASSUME A STATE. IT MUST CREATE THE STATE IT OBSERVES.
    -- So: park one kind's active template, check the view notices it has gone,
    -- and let the rollback put it back.
    update document_templates set status = 'retired'
     where kind = 'transfer' and status = 'active';

    if not exists (select 1 from document_template_coverage
                    where kind = 'transfer' and active_template_id is null) then
      raise exception '051 FAILED: a document type with no active template is reported as '
                      'covered, so the list of what is still outstanding cannot be trusted';
    end if;
    if not exists (select 1 from document_template_coverage
                    where kind = 'terms-and-conditions' and active_template_id is not null) then
      raise exception '051 FAILED: the coverage view cannot see an active template';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '051 OK: every document the University issues has a template kind, and one '
               'nobody declared is refused';
  raise notice '051 OK: an active template states the date it came into force';
  raise notice '051 OK: the conditions of service somebody was appointed under cannot be '
               'deleted, and neither can the wording that produced a letter to a ministry';
  raise notice '051 OK: the coverage view reports which document types have no active template';
end $$;


-- ===========================================================================
-- 7. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- DOCUMENT TYPES WITH NO ACTIVE TEMPLATE. Every row here is a document the
-- University can be asked to produce and has no approved wording for. This
-- list will be long today and that is the point of showing it.
-- ---------------------------------------------------------------------------
select kind, versions
  from document_template_coverage
 where active_template_id is null
 order by kind;

-- And the ones that are covered, with the wording in force.
select kind, name, version, effective_from,
       appointment_letters_issued + correspondence_issued as documents_issued
  from document_template_coverage
 where active_template_id is not null
 order by kind;


-- ===========================================================================
-- ===========================================================================
--
--   052_a_first_draft_of_every_document.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 052 — A FIRST DRAFT OF EVERY DOCUMENT THE UNIVERSITY ISSUES
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- All thirty-one document types get a version 1, in DRAFT, with wording in it.
-- The Document Templates screen stops reading "31 of 31 have no active
-- template" and starts reading like a registry with something to edit.
--
-- NOTHING IS ACTIVE. Not one of these produces a document until somebody at
-- the University reads it and activates it, and the screen shows each as a
-- draft waiting for exactly that.
--
-- ---------------------------------------------------------------------------
-- THE ONE THING TO READ TWICE
-- ---------------------------------------------------------------------------
--
-- THIS WORDING IS NOT THE UNIVERSITY'S POLICY. It is a starting point written
-- to be edited — the same standing this migration's author has for the job
-- descriptions 048 seeded, and for the same reason: an appointment letter, a
-- termination letter and a written warning are documents produced in a dispute,
-- and none of them should carry a sentence nobody at the University has read.
--
-- AND `created_by` IS DELIBERATELY NULL on every row. 044 refuses a template to
-- be activated by whoever wrote it; nobody at the University wrote these, so
-- any officer holding the capability may activate one. That is the second pair
-- of eyes working rather than being bypassed: the person approving the wording
-- is not the person who drafted it.
--
-- ---------------------------------------------------------------------------
-- THE PLACEHOLDERS
-- ---------------------------------------------------------------------------
--
-- `{{name}}` is filled from the record, never typed. The names below match the
-- columns on `appointments` and `correspondence` — full_name, position_title,
-- unit_name, start_date, and so on. A placeholder nothing fills prints as
-- itself, which is visible and correctable; a blank line is not.
-- ===========================================================================

do $$
declare
  seeded integer := 0;
begin
  -- =======================================================================
  -- 1. THE APPOINTMENT DOCUMENTS
  -- =======================================================================

  insert into document_templates (kind, version, name, body, status)
  select v.kind, 1, v.name, v.body, 'draft'
    from (values

  ('initial-appointment', 'Initial Appointment',
   'We are pleased to offer you appointment as {{position_title}} in the {{unit_name}} of the '
   || 'University, on the terms set out below.' || chr(10) || chr(10)
   || 'Your appointment takes effect from {{start_date}}. You will be based at '
   || '{{place_of_duty}} and will report to {{reports_to_name}}.' || chr(10) || chr(10)
   || 'This appointment is made subject to the conditions of service of the University and to '
   || 'satisfactory verification of the qualifications and references you have supplied. You '
   || 'are required to devote your full professional attention to the duties of the post and '
   || 'to observe the University''s policies on conduct, confidentiality and conflict of '
   || 'interest.' || chr(10) || chr(10)
   || 'Please confirm your acceptance in writing.'),

  ('reappointment', 'Reappointment',
   'Following the conclusion of your previous term, the University is pleased to reappoint you '
   || 'as {{position_title}} in the {{unit_name}}, with effect from {{start_date}}.'
   || chr(10) || chr(10)
   || 'The terms of your reappointment are set out below. Except where they are varied here, '
   || 'the conditions of service under which you previously held the post continue to apply, '
   || 'and your service is treated as continuous.' || chr(10) || chr(10)
   || 'Please confirm your acceptance in writing.'),

  ('contract-renewal', 'Contract Renewal',
   'The University is pleased to renew your appointment as {{position_title}} in the '
   || '{{unit_name}} for a further term, with effect from {{start_date}} and expiring on '
   || '{{end_date}}.' || chr(10) || chr(10)
   || 'The terms of the renewed appointment are set out below. Your service is continuous and '
   || 'the conditions of service in force continue to apply.' || chr(10) || chr(10)
   || 'Please confirm your acceptance in writing.'),

  ('promotion', 'Promotion',
   'Following consideration of your record of service, the University is pleased to inform you '
   || 'that you have been promoted to the post of {{position_title}} in the {{unit_name}}, '
   || 'with effect from {{effective_date}}.' || chr(10) || chr(10)
   || 'The revised terms attaching to the post are set out below. All other terms of your '
   || 'appointment are unchanged and your service is continuous.' || chr(10) || chr(10)
   || 'The University records its appreciation of your contribution and wishes you well in the '
   || 'wider responsibilities the post carries.'),

  ('transfer', 'Transfer',
   'You are hereby transferred to the post of {{position_title}} in the {{unit_name}}, with '
   || 'effect from {{effective_date}}. Your place of duty from that date is {{place_of_duty}} '
   || 'and you will report to {{reports_to_name}}.' || chr(10) || chr(10)
   || 'Your service is continuous and your conditions of service are unchanged except as set '
   || 'out below. You are asked to hand over the responsibilities of your present post before '
   || 'the effective date.'),

  ('acting-appointment', 'Acting Appointment',
   'You are appointed to act as {{position_title}} in the {{unit_name}} with effect from '
   || '{{start_date}} until {{end_date}}, or until the substantive post is filled, whichever '
   || 'is the earlier.' || chr(10) || chr(10)
   || 'While acting you carry the full responsibilities of the post and report to '
   || '{{reports_to_name}}. An acting appointment does not confer any right to the substantive '
   || 'post, and your existing appointment continues beneath it.'),

  ('probation-confirmation', 'Confirmation of Appointment',
   'Following the satisfactory completion of your probationary period, the University is '
   || 'pleased to confirm your appointment as {{position_title}} in the {{unit_name}} with '
   || 'effect from {{effective_date}}.' || chr(10) || chr(10)
   || 'Your appointment is now substantive and the notice provisions of the conditions of '
   || 'service apply in full. The University records its appreciation of your work during the '
   || 'probationary period.'),

  ('contract-extension', 'Contract Extension',
   'Your appointment as {{position_title}} in the {{unit_name}}, which was due to expire on '
   || '{{end_date}}, is extended to the date shown below.' || chr(10) || chr(10)
   || 'All other terms of your appointment are unchanged and your service is continuous. This '
   || 'extension does not alter the character of the appointment.'),

  ('appointment-amendment', 'Appointment Amendment',
   'The University writes to amend the terms of your appointment as {{position_title}} in the '
   || '{{unit_name}}, with effect from {{effective_date}}.' || chr(10) || chr(10)
   || 'The amended terms are set out below and replace the corresponding terms of the letter '
   || 'previously issued to you. THE EARLIER LETTER REMAINS ON THE UNIVERSITY''S RECORD and is '
   || 'not withdrawn; this letter states what has changed and from when.' || chr(10) || chr(10)
   || 'Please confirm your acceptance of the amended terms in writing.'),

  ('termination', 'Termination / End of Appointment',
   'The University writes concerning your appointment as {{position_title}} in the '
   || '{{unit_name}}.' || chr(10) || chr(10)
   || 'Your appointment ends on the date shown below. The reason and the notice given are '
   || 'stated there.' || chr(10) || chr(10)
   || 'You are asked to hand over University property, records and access in your possession '
   || 'to {{reports_to_name}} before that date. Outstanding salary and entitlements will be '
   || 'settled through the Finance Office.' || chr(10) || chr(10)
   || 'Your obligations of confidentiality continue after the appointment ends. The University '
   || 'thanks you for your service.'),

  ('retirement', 'Retirement',
   'The University writes concerning your retirement from the post of {{position_title}} in '
   || 'the {{unit_name}}, with effect from the date shown below.' || chr(10) || chr(10)
   || 'The Vice-Chancellor and the University Council record their appreciation of your '
   || 'service and the contribution you have made to the life of the institution.'
   || chr(10) || chr(10)
   || 'The Finance Office will write separately regarding your final settlement and any '
   || 'entitlements. You are asked to hand over University property and records before the '
   || 'effective date.'),

  -- =======================================================================
  -- 2. THE REST OF THE APPOINTMENT PACKAGE
  -- =======================================================================

  ('job-description', 'Job Description',
   'JOB DESCRIPTION — {{position_title}}' || chr(10) || chr(10)
   || 'This job description accompanies the letter of appointment and forms part of it. The '
   || 'duties set out in the job description registered for this post under code {{job_code}} '
   || 'apply, and are summarised below.' || chr(10) || chr(10)
   || 'Position: {{position_title}}' || chr(10)
   || 'Department or faculty: {{unit_name}}' || chr(10)
   || 'Reports to: {{reports_to_name}}' || chr(10)
   || 'Duty station: {{place_of_duty}}' || chr(10)
   || 'Employment category: {{employment_type}}' || chr(10) || chr(10)
   || 'THE FULL JOB DESCRIPTION IS HELD IN THE UNIVERSITY''S REGISTER OF POSTS, versioned and '
   || 'approved separately from this letter. Migration 048 holds the structure — purpose, key '
   || 'responsibilities, decision-making authority, performance areas, qualifications — and '
   || 'the wording is edited there rather than here, so that one post has one job description '
   || 'and not a copy in every letter.' || chr(10) || chr(10)
   || 'The job description may be amended by the University after consultation with the '
   || 'post-holder. The version in force at the date of appointment remains on the record.'),

  ('terms-and-conditions', 'Terms and Conditions of Appointment',
   'CONDITIONS OF SERVICE' || chr(10) || chr(10)
   || '1. GENERAL. This appointment is subject to the statutes and regulations of the '
   || 'University and to the policies in force from time to time. Where this letter and the '
   || 'conditions of service differ, this letter governs for the matters it states.'
   || chr(10) || chr(10)
   || '2. HOURS AND DUTIES. You are required to devote your full professional attention to the '
   || 'duties of the post during the hours stated in the letter of appointment, and to carry '
   || 'out such other duties as may reasonably be assigned by the officer to whom you report.'
   || chr(10) || chr(10)
   || '3. PROBATION. Where the letter states a probationary period, the appointment is '
   || 'confirmed only on its satisfactory completion. During probation one month''s notice '
   || 'applies on either side.' || chr(10) || chr(10)
   || '4. NOTICE. After confirmation, either party may end the appointment by three months'' '
   || 'notice in writing, or payment in lieu. Nothing in this clause limits the University''s '
   || 'right to end an appointment summarily for gross misconduct.' || chr(10) || chr(10)
   || '5. REMUNERATION. Salary and any allowances are as stated in the letter of appointment '
   || 'and are paid monthly in arrears, subject to lawful deductions. Allowances are payable '
   || 'only where the letter states them.' || chr(10) || chr(10)
   || '6. CONFIDENTIALITY. You shall treat student records, staff records, examination '
   || 'material and the University''s commercial and legal affairs as confidential, during the '
   || 'appointment and after it ends.' || chr(10) || chr(10)
   || '7. CONFLICT OF INTEREST. You shall disclose any outside interest or employment that '
   || 'might conflict with the duties of the post, and shall not accept such engagement '
   || 'without written approval.' || chr(10) || chr(10)
   || '8. INTELLECTUAL PROPERTY. Rights in work produced in the course of the appointment vest '
   || 'in the University except where the University agrees otherwise in writing.'
   || chr(10) || chr(10)
   || '9. CONDUCT. You shall observe the University''s policies on conduct, data protection '
   || 'and safeguarding, and shall report any breach that comes to your notice.'
   || chr(10) || chr(10)
   || '10. AMENDMENT. These conditions may be amended by the University. The version in force '
   || 'at the date you accepted your appointment is the version that binds you, and is '
   || 'recorded against the appointment.'),

  ('acceptance-form', 'Acceptance of Appointment',
   'ACCEPTANCE OF APPOINTMENT' || chr(10) || chr(10)
   || 'To: The Vice-Chancellor, ICOF Global University' || chr(10) || chr(10)
   || 'I, {{full_name}}, acknowledge receipt of the letter of appointment bearing reference '
   || '{{reference}} and dated {{issued_on}}.' || chr(10) || chr(10)
   || 'I have read the letter, the job description and the conditions of service referred to '
   || 'in it, and I ACCEPT the appointment as {{position_title}} in the {{unit_name}} on the '
   || 'terms stated, with effect from {{start_date}}.' || chr(10) || chr(10)
   || 'Signed: ____________________________     Date: ____________________'
   || chr(10) || chr(10)
   || 'This form may be returned by post or by hand. An acceptance may also be recorded '
   || 'through the University''s verification page using the reference and code printed on the '
   || 'letter, in which case the University''s record of your acceptance names the version of '
   || 'the letter you answered.'),

  -- =======================================================================
  -- 3. OFFICIAL CORRESPONDENCE
  -- =======================================================================
  --
  -- SHORTER, AND THEY HAVE TO BE. A correspondence template is a frame for
  -- words the authority writes at the time, not a form with the words already
  -- in it — the body of a letter to a ministry IS the Vice-Chancellor
  -- speaking, and a template that wrote it for them would be the system
  -- speaking instead.

  ('letter-general', 'General Correspondence',
   'Standard frame for general correspondence of the University. The body is composed by the '
   || 'originating office; the letterhead, reference, date, signature block and verification '
   || 'code are added by the system.'),

  ('letter-appointment', 'Letter — Appointment',
   'Frame for an appointment letter written directly by an office rather than generated from '
   || 'an appointment record. Where an appointment record exists, the Appointment Letter '
   || 'template is used instead and nothing is typed by hand.'),

  ('letter-reappointment', 'Letter — Reappointment',
   'Frame for a reappointment communicated by letter from an office. The terms themselves '
   || 'belong on an appointment record, which produces the document nobody types.'),

  ('letter-promotion', 'Letter — Promotion',
   'Frame for a letter conveying a promotion. Where the promotion is recorded as an '
   || 'appointment, the Promotion template produces the letter from the record instead.'),

  ('letter-invitation', 'Letter — Invitation',
   'Frame for an invitation issued by the University — to a convocation, a lecture, an '
   || 'inspection or a meeting. State clearly what is being asked of the recipient, on what '
   || 'date, and by when a reply is needed.'),

  ('letter-commendation', 'Letter — Commendation',
   'Frame for a letter of commendation. Say what was done, by whom, and why the University '
   || 'considers it worth recording. A commendation that does not name the act reads as a '
   || 'formality and is worth less to the person receiving it.'),

  ('letter-recommendation', 'Letter — Recommendation',
   'Frame for a letter of recommendation. State the capacity in which the University knows the '
   || 'subject and over what period, then the recommendation itself. A recommendation goes to '
   || 'somebody with no other knowledge of the person, so the facts it rests on belong in it.'),

  ('letter-government', 'Letter — Government Correspondence',
   'Frame for correspondence with a ministry or government authority. Read it back as a '
   || 'stranger would: the reader has no context, cannot ask a follow-up question, and may be '
   || 'filing it against the University''s standing.'),

  ('letter-university', 'Letter — University Correspondence',
   'Frame for correspondence with another university or institution — accreditation, transfer '
   || 'of credit, joint provision, or a reference. State plainly what the University is asking '
   || 'or confirming.'),

  ('letter-partnership', 'Letter — Partnership',
   'Frame for a partnership or collaboration approach. State what is proposed, what each side '
   || 'would contribute, and what the next step is. A proposal with no next step in it is one '
   || 'nobody answers.'),

  ('letter-directive', 'Letter — Directive',
   'Frame for a directive issued to a member of staff or an office. State what is required, on '
   || 'whose authority, and by when. A directive is one of the two documents most likely to be '
   || 'produced in an appeal, so it should say what happened, what is required, and nothing '
   || 'else.'),

  ('letter-warning', 'Letter — Warning',
   'Frame for a written warning. State the conduct concerned, the date it occurred, the '
   || 'standard it fell short of, what is now required, and the consequence of a repetition. '
   || 'Say whether the warning may be appealed and to whom, and over what period it remains on '
   || 'the record. This letter turns up in an appeal; write it as the document that will be '
   || 'read there.'),

  ('letter-authorization', 'Letter — Authorization',
   'Frame for a letter authorising a named person to act for the University in a stated matter. '
   || 'State precisely what is authorised, the period, and any limit on it. An authorisation '
   || 'without a limit is one the University cannot later say was exceeded.'),

  ('letter-official-response', 'Letter — Official Response',
   'Frame for the University''s formal response to correspondence received. Name what is being '
   || 'answered — its reference and date — before answering it, so the reader can file the two '
   || 'together.'),

  ('letter-special-assignment', 'Letter — Special Assignment',
   'Frame for assigning a member of staff to a task outside the ordinary duties of their post. '
   || 'State the task, the period, to whom they report for it, and what happens to their '
   || 'ordinary duties meanwhile.'),

  ('letter-special', 'Letter — Special Letter',
   'Frame for a letter that does not fall under any other kind and is issued under the '
   || 'authority of the originating office.'),

  ('letter-other', 'Letter — Other',
   'Frame for correspondence the register has no better kind for. If this is being used often, '
   || 'the University should add the kind it is really being used for rather than leaving the '
   || 'register unable to count it.')

    ) as v (kind, name, body)
   where not exists (
     select 1 from document_templates d where d.kind = v.kind
   );

  get diagnostics seeded = row_count;
  raise notice '052: % document template(s) seeded as version 1, all in draft', seeded;
end $$;


-- ===========================================================================
-- 4. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  refused boolean;
  someone uuid;
  t_id uuid;
  n integer;
begin
  select id into someone from auth.users limit 1;

  -- ---- EVERY KIND HAS A DRAFT --------------------------------------------
  select count(*) into n from document_template_coverage
   where (select count(*) from document_templates d where d.kind = kind) = 0;
  if n > 0 then
    raise exception '052 FAILED: % document type(s) still have no template at all', n;
  end if;

  -- ---- AND NOT ONE OF THEM IS ACTIVE --------------------------------------
  -- The whole point. A seeded template that produced documents without anybody
  -- reading it would put wording nobody approved onto the University's paper.
  select count(*) into n from document_templates where status = 'active';
  if n > 0 then
    raise notice '052: % template(s) are active — those were activated by the University, '
                 'not seeded by this migration', n;
  end if;
  select count(*) into n from document_templates
   where status = 'active' and created_by is null and activated_by is null;
  if n > 0 then
    raise exception '052 FAILED: % seeded template(s) are active with nobody having activated '
                    'them', n;
  end if;

  if someone is null then
    raise notice '052: no accounts, so activation could not be exercised';
    return;
  end if;

  begin
    -- -----------------------------------------------------------------------
    -- THE PROOF BRINGS ITS OWN DRAFT. IT USED TO BORROW THE UNIVERSITY'S.
    --
    -- TWO WAYS THIS BROKE ON A REAL DATABASE, both found by running it against
    -- a copy of the University's own state rather than a clean one.
    --
    -- 1. It read `where kind = 'letter-warning' and status = 'draft'`. Once the
    --    University activates its seeded warning letter through Settings there
    --    is no draft left, `t_id` is null, every following update touches no
    --    rows, and the check below reports "an active template's wording was
    --    rewritten in place" — a FAILURE MESSAGE DESCRIBING SOMETHING THAT DID
    --    NOT HAPPEN, which is the worst kind, because it sends whoever reads
    --    it looking for a fault that is not there.
    --
    -- 2. Activating it collided with the University's own active template on
    --    `one_active_idx` — the same fault that stopped 044.
    --
    -- Both go away if the proof stops competing for the University's rows.
    -- Version 9001 stays out of the way of their versions, and `created_by`
    -- stays NULL because that is the property being proved: a seeded draft has
    -- no author, so any officer may put it in force without tripping 044's
    -- "nobody activates their own".
    --
    -- The retirement below is still needed — one active per kind — and rolls
    -- back with the rest of the block, so the University's template is active
    -- again the moment the proof ends.
    -- -----------------------------------------------------------------------
    update document_templates set status = 'retired'
     where kind = 'letter-warning' and status = 'active';

    insert into document_templates (kind, version, name, body, status, created_by)
    values ('letter-warning', 9001, 'Warning Letter',
            'A specimen warning letter, long enough to satisfy the minimum body length.',
            'draft', null)
    returning id into t_id;

    -- ---- A SEEDED DRAFT CAN BE ACTIVATED BY ANY OFFICER ---------------------
    -- `created_by` is null on every seeded row, so 044's "nobody activates
    -- their own" does not block the University from putting its own wording
    -- into force. The officer approving it did not write it, which is the rule
    -- working rather than being bypassed.
    update document_templates
       set status = 'active', activated_by = someone, activated_at = now(),
           effective_from = current_date
     where id = t_id;

    -- ---- BUT THE WORDING STILL CANNOT BE REWRITTEN ONCE ACTIVE --------------
    refused := false;
    begin
      update document_templates set body = 'Something else entirely, at some length.'
       where id = t_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '052 FAILED: an active template''s wording was rewritten in place';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '052 OK: every document type has a version 1 to edit, and none of them is '
               'active until somebody at the University activates it';
  raise notice '052 OK: a seeded draft can be activated by any officer holding the capability, '
               'because nobody here wrote it — and once active its wording is frozen';
end $$;


-- ===========================================================================
-- 5. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- EVERY DOCUMENT TYPE AND WHERE ITS WORDING STANDS. After this runs, every row
-- should show a version 1 in draft. Open Document Templates in the portal,
-- read each one, edit what the University wants changed, and activate it — a
-- draft produces nothing until then.
-- ---------------------------------------------------------------------------
select k.kind,
       d.name,
       d.version,
       d.status,
       length(d.body) as words_to_read
  from document_template_coverage k
  left join document_templates d on d.kind = k.kind
 order by d.status, k.kind;


-- ===========================================================================
-- ===========================================================================
--
--   053_where_an_office_stands.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 053 — WHERE AN OFFICE STANDS, AND THE OFFICE THAT WAS CALLED THREE THINGS
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- 1. THE APPOINTMENT LETTER STARTS SAYING DIFFERENT THINGS TO DIFFERENT
--    OFFICES. It already did in the code; this is the data that feeds it. A
--    post's `family` selects the register of wording — a Dean's letter, a
--    Lecturer's and the Director of Academic Affairs' stop being the same
--    generic executive letter with a different job title in it.
--
-- 2. THE DIRECTOR OF ACADEMIC AFFAIRS IS RECORDED AS RANKING IMMEDIATELY BELOW
--    THE VICE-CHANCELLOR. The University stated this on 13 September 2026. It
--    is stored on the post, and it is the ONLY post that carries it — so the
--    sentence can be printed where it is true and nowhere else.
--
--    A LETTER THAT CLAIMS A RANK IS MAKING A CONSTITUTIONAL CLAIM. If that
--    sentence lived in a template, every future template copying it would
--    repeat the claim for whatever post it was pointed at, and a Lecturer's
--    letter would quietly say the same thing. As a column on one row it cannot.
--
-- 3. NOTHING IS GRANTED. `precedence` and `standing` say where an office sits.
--    They say nothing about what it may authorise, may recommend or must
--    escalate — those three are in the job description, which 048 versions and
--    approves separately, and this migration does not touch them.
--
-- ---------------------------------------------------------------------------
-- AND IT DOES NOT RENAME ANYTHING
-- ---------------------------------------------------------------------------
--
-- The University has ruled that the office called "Head of Academic Affairs" in
-- this system and "Academic Director General" on the published About page is
-- the DIRECTOR OF ACADEMIC AFFAIRS. 048 already seeded the post under that
-- name, so there is no row here to rename — the disagreement was in the
-- application's own constants and in the website's content, and both are fixed
-- in the same change as this file. It is recorded here because somebody reading
-- the migrations in five years will want to know when the three names became
-- one.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. WHERE AN OFFICE STANDS
-- ---------------------------------------------------------------------------

alter table positions
  add column if not exists executive_level text,
  -- The rank, as it is printed in a table cell: "Second-ranking officer after
  -- the Vice-Chancellor".
  add column if not exists precedence      text,
  -- The same standing, as a sentence in a paragraph. TWO COLUMNS ON PURPOSE:
  -- lowercasing the first to make the second produced "The office of Director
  -- of Academic Affairs is second-ranking officer after the Vice-Chancellor",
  -- which is neither a rank nor English.
  add column if not exists standing        text;

comment on column positions.executive_level is
  'The management band the office sits in, where the University has recorded one. Printed in '
  'the appointment letter''s details table. Never derived.';

comment on column positions.precedence is
  'Where the office ranks, as a table-cell value. Printed ONLY for posts that carry it, so a '
  'letter cannot claim a standing the University has not stated for that post.';

comment on column positions.standing is
  'The same fact as a sentence, for the letter''s opening paragraphs. Says where the office '
  'sits and NOT what it may do — authority is in the job description and nowhere else.';

-- NOT A FREE-TEXT INVITATION. A standing is a considered statement about the
-- University's structure, and a one-word value in it is a typo rather than a
-- ruling.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'positions_standing_is_a_statement') then
    alter table positions add constraint positions_standing_is_a_statement
      check (standing is null or length(btrim(standing)) >= 20);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'positions_precedence_is_a_rank') then
    alter table positions add constraint positions_precedence_is_a_rank
      check (precedence is null or length(btrim(precedence)) >= 8);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. THE ONE POST THE UNIVERSITY HAS RANKED
-- ---------------------------------------------------------------------------
--
-- WRITTEN ONLY WHERE IT IS STILL EMPTY. If the University has since edited
-- either field, this must not put its own wording back on a re-run — a
-- migration that overwrites a considered change is a migration nobody can run
-- twice.

update positions
   set executive_level = coalesce(executive_level, 'Senior Executive Management'),
       precedence      = coalesce(precedence, 'Second-ranking officer after the Vice-Chancellor'),
       standing        = coalesce(standing,
                                  'a senior executive office of the University, ranking '
                                  'immediately below the Vice-Chancellor in the University''s '
                                  'executive structure')
 where job_code = 'ACA-DAA';

-- ---------------------------------------------------------------------------
-- 3. PROVE IT
-- ---------------------------------------------------------------------------

do $$
declare
  ranked  int;
  daa     record;
  refused boolean;
begin
  -- ---- ONE POST CARRIES A RANK, AND ONLY ONE ------------------------------
  select count(*) into ranked from positions where precedence is not null;
  if ranked <> 1 then
    raise exception '053 FAILED: % posts carry a precedence, expected exactly 1', ranked;
  end if;

  select job_code, precedence, standing, executive_level, family
    into daa from positions where job_code = 'ACA-DAA';

  if daa is null then
    raise exception '053 FAILED: ACA-DAA is not in the register — run 048 first';
  end if;
  if daa.precedence is null or daa.standing is null then
    raise exception '053 FAILED: the Director of Academic Affairs carries no standing';
  end if;
  if daa.family <> 'academic-administration' then
    raise exception '053 FAILED: ACA-DAA is in family %, so it would take the wrong register',
                    daa.family;
  end if;

  -- ---- EVERY POST HAS A FAMILY, because the family picks the wording ------
  -- A post with none falls to the plainest register rather than the grandest,
  -- which is safe — but a post with no family at all is a post nobody
  -- classified, and the letter it produces is nobody's decision.
  if exists (select 1 from positions where family is null or btrim(family) = '') then
    raise exception '053 FAILED: some posts have no family, so their letters have no register';
  end if;

  -- ---- AND THE GUARDS REFUSE ---------------------------------------------
  begin
    refused := false;
    begin
      update positions set standing = 'senior' where job_code = 'ACA-DAA';
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '053 FAILED: a one-word standing was accepted as a statement of structure';
    end if;

    refused := false;
    begin
      update positions set precedence = 'top' where job_code = 'ACA-DAA';
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '053 FAILED: a three-letter precedence was accepted as a rank';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '053 OK: every post carries a family, so every appointment letter has a register '
               'of wording appropriate to the office';
  raise notice '053 OK: the Director of Academic Affairs ranks immediately below the '
               'Vice-Chancellor, and is the only post that carries a standing';
  raise notice '053 OK: a standing too short to be a statement is refused';
end $$;


-- ===========================================================================
-- 4. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- WHICH REGISTER EACH KIND OF OFFICE WILL TAKE, and which posts the University
-- has ranked. Every family below should have posts in it; only ACA-DAA should
-- show a precedence.
-- ---------------------------------------------------------------------------
select family,
       count(*)                                        as posts,
       count(*) filter (where precedence is not null)  as ranked,
       string_agg(job_code, ', ' order by job_code)
         filter (where precedence is not null)         as which
  from positions
 group by family
 order by family;


-- ===========================================================================
-- ===========================================================================
--
--   054_course_registration.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 054 — COURSE REGISTRATION: THE ACT NOBODY COULD PERFORM
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- A STUDENT CAN BE REGISTERED FOR A COURSE. Until now nothing in this system
-- could do it. `enrollments` has existed since 001; the results pipeline reads
-- it to build a mark sheet, the GPA engine reads it to weight a transcript,
-- and the graduation audit reads it to decide whether somebody may be awarded
-- a degree. Every one of them reads a table that no screen and no route has
-- ever written a row into.
--
-- It was found by counting reads against writes per table — the same sweep
-- that found the signature specimens and the allowances — and it is the
-- largest of the three, because the three things it feeds are marks,
-- transcripts and graduation.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS FILE ADDS, AND WHY EACH PIECE
-- ---------------------------------------------------------------------------
--
-- 1. A CLOSED VOCABULARY FOR `status`. It was `text not null default
--    'registered'` with no constraint, so any word at all could be written and
--    every reader would have to guess which words it might find. The three
--    below are the ones a registration can be in.
--
-- 2. WHO REGISTERED THIS STUDENT, AND HOW. A registration is a commitment: it
--    puts somebody on a mark sheet and it puts a course on their transcript.
--    One with no actor is one nobody can be asked about. `registered_via`
--    separates a student registering themselves from the Registry doing it for
--    them, because those two are answerable in different directions.
--
-- 3. THE DROP, AS A STATE AND NOT A DELETION. Deleting the row would take the
--    student off the mark sheet and leave no trace that they were ever on it —
--    and a student who sat an assessment and then vanished from the register
--    is the shape of a real dispute.
--
-- 4. THE LIVE ROLL AS A VIEW. The mark sheet must not list somebody who
--    dropped the course. The screens read every enrolment row today, so
--    introducing a dropped state without this view would put dropped students
--    in front of an examiner.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS FILE DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- ENFORCE PREREQUISITES IN SQL. The rule is published in
-- src/lib/prerequisites.ts, tested, and it reports EVERY failing condition at
-- once with a sentence per reason naming the course — because a check that
-- returns on the first failure makes a student re-submit to discover the
-- second. A trigger can refuse; it cannot explain. The route applies the rule
-- and the database holds the shape of the record.
--
-- That is a deliberate asymmetry and it is worth stating plainly: this is the
-- one guard in the system that is NOT belt-and-braces in SQL.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. THE SHAPE OF A REGISTRATION
-- ---------------------------------------------------------------------------

alter table enrollments
  add column if not exists registered_by   uuid references auth.users (id) on delete set null,
  -- 'self' when the student registered, 'registry' when an officer did it for
  -- them. Not derivable from registered_by: an officer who is also a student
  -- would be indistinguishable.
  add column if not exists registered_via  text,
  add column if not exists dropped_at      timestamptz,
  add column if not exists dropped_by      uuid references auth.users (id) on delete set null,
  add column if not exists drop_reason     text;

comment on column enrollments.registered_by is
  'Who put this student on this course. A registration puts somebody on a mark sheet and a '
  'course on their transcript; one with no actor is one nobody can be asked about.';

comment on column enrollments.registered_via is
  'self | registry. Separates a student registering themselves from the Registry doing it for '
  'them — the two are answerable in different directions.';

do $$
begin
  -- ---- THE STATUS VOCABULARY, CLOSED ------------------------------------
  -- NOT VALID, deliberately. A database with existing enrolments carrying some
  -- other word must not fail to migrate; the constraint governs every row
  -- written from now on, and the verify query at the foot names anything that
  -- would not pass.
  if not exists (select 1 from pg_constraint where conname = 'enrollments_status_is_known') then
    alter table enrollments add constraint enrollments_status_is_known
      check (status in ('registered', 'dropped', 'completed')) not valid;
  end if;

  -- ---- A DROPPED REGISTRATION SAYS WHEN AND WHY -------------------------
  -- A drop with no date is one nobody can place in a term, and a drop with no
  -- reason is one nobody can answer for at an appeal.
  if not exists (select 1 from pg_constraint where conname = 'enrollments_drop_is_complete') then
    alter table enrollments add constraint enrollments_drop_is_complete
      check (
        status <> 'dropped'
        or (dropped_at is not null and drop_reason is not null
            and length(btrim(drop_reason)) >= 8)
      ) not valid;
  end if;

  -- ---- AND A LIVE ONE CARRIES NO DROP -----------------------------------
  -- The pair that actually catches a bug: re-registering a dropped course by
  -- setting the status back and forgetting to clear the drop leaves a row that
  -- is registered AND dropped, which every reader will interpret differently.
  if not exists (select 1 from pg_constraint where conname = 'enrollments_live_is_not_dropped') then
    alter table enrollments add constraint enrollments_live_is_not_dropped
      check (status = 'dropped' or dropped_at is null) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'enrollments_via_is_known') then
    alter table enrollments add constraint enrollments_via_is_known
      check (registered_via is null or registered_via in ('self', 'registry')) not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. THE LIVE ROLL
-- ---------------------------------------------------------------------------
--
-- WHO IS ACTUALLY TAKING THIS COURSE. The mark sheet, the GPA engine and the
-- graduation audit all ask this question and all of them asked it by reading
-- every row in `enrollments`, which was correct only while nothing could be
-- dropped.
--
-- A VIEW RATHER THAN A FILTER IN EACH SCREEN, because there are three screens
-- and they would drift — and the one that drifts is the one that puts a
-- student who dropped the course in front of an examiner.

drop view if exists course_roll;

create view course_roll
with (security_invoker = true) as
select e.id                as enrollment_id,
       e.student_id,
       e.course_id,
       e.academic_year,
       e.semester,
       e.status,
       e.enrolled_at,
       e.registered_via
  from enrollments e
 where e.status in ('registered', 'completed');

comment on view course_roll is
  'Who is actually taking a course: registered and completed, never dropped. The mark sheet, '
  'the GPA engine and the graduation audit all read this rather than filtering for themselves.';

grant select on course_roll to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. PROVE IT
-- ---------------------------------------------------------------------------

do $$
declare
  s_id    uuid;
  c_id    uuid;
  e_id    uuid;
  refused boolean;
begin
  begin
    -- A student and a course to register, made here and rolled back.
    insert into students (first_name, last_name, matric_no)
      values ('Proof', 'Student', 'PROOF-054-' || substr(gen_random_uuid()::text, 1, 8))
      returning id into s_id;

    insert into courses (code, title, credit_unit)
      values ('ZZZ054-' || substr(gen_random_uuid()::text, 1, 6), 'A Proof Course', 3)
      returning id into c_id;

    -- ---- A REGISTRATION IS ACCEPTED ---------------------------------------
    insert into enrollments (student_id, course_id, academic_year, semester,
                             status, registered_by, registered_via)
      values (s_id, c_id, 2026, 1, 'registered', null, 'self')
      returning id into e_id;

    if not exists (select 1 from course_roll where enrollment_id = e_id) then
      raise exception '054 FAILED: a registered student is not on the roll';
    end if;

    -- ---- A WORD NOBODY DEFINED IS REFUSED ---------------------------------
    refused := false;
    begin
      update enrollments set status = 'maybe' where id = e_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '054 FAILED: an undefined status was accepted';
    end if;

    -- ---- A DROP WITH NO REASON IS REFUSED ---------------------------------
    refused := false;
    begin
      update enrollments set status = 'dropped', dropped_at = now() where id = e_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '054 FAILED: a course was dropped with no reason recorded';
    end if;

    -- ---- A PROPER DROP IS ACCEPTED, AND LEAVES THE ROLL -------------------
    update enrollments
       set status = 'dropped', dropped_at = now(),
           drop_reason = 'Withdrew from the module within the change period'
     where id = e_id;

    if exists (select 1 from course_roll where enrollment_id = e_id) then
      raise exception '054 FAILED: a dropped student is still on the mark sheet';
    end if;

    -- ---- AND A ROW CANNOT BE BOTH -----------------------------------------
    -- The one that catches the real bug: re-registering by setting the status
    -- back and forgetting to clear the drop.
    refused := false;
    begin
      update enrollments set status = 'registered' where id = e_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '054 FAILED: a row is registered and dropped at the same time';
    end if;

    -- Clearing the drop as well is what re-registration must do, and it works.
    update enrollments
       set status = 'registered', dropped_at = null, dropped_by = null, drop_reason = null
     where id = e_id;
    if not exists (select 1 from course_roll where enrollment_id = e_id) then
      raise exception '054 FAILED: a re-registered student is not back on the roll';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '054 OK: a student can be registered for a course, and the registration records '
               'who did it and whether the student did it themselves';
  raise notice '054 OK: a drop is a state with a date and a reason, not a deletion — and a '
               'dropped student leaves the mark sheet';
  raise notice '054 OK: a row cannot be registered and dropped at the same time';
end $$;


-- ===========================================================================
-- 4. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- WHAT IS ON THE REGISTER NOW, AND WHETHER ANY EXISTING ROW WOULD FAIL THE NEW
-- RULES. The constraints were added NOT VALID so that a database with older
-- rows still migrates; this is where you find out whether there are any.
--
-- `unknown_status` should be 0. If it is not, those rows carry a word nothing
-- defines, and every reader of the table is guessing what it means.
-- ---------------------------------------------------------------------------
select count(*)                                                  as enrolments,
       count(*) filter (where status = 'registered')              as registered,
       count(*) filter (where status = 'dropped')                 as dropped,
       count(*) filter (where status = 'completed')               as completed,
       count(*) filter (where status not in
                        ('registered', 'dropped', 'completed'))   as unknown_status,
       count(*) filter (where registered_by is null
                          and status <> 'dropped')                as no_actor_recorded
  from enrollments;


-- ===========================================================================
-- ===========================================================================
--
--   055_the_office_that_needs_no_second_signature.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 055 — THE OFFICE THAT NEEDS NO SECOND SIGNATURE
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- THE VICE-CHANCELLOR CAN DRAFT AN APPOINTMENT AND APPROVE IT. So can the
-- Chancellor, and so can a system account. Nobody else can, and the act is
-- marked on the record permanently.
--
-- The University ruled it: "a VC needs no one to approve its letter, even the
-- superadmin." The appointing authority IS the Vice-Chancellor; requiring a
-- second person to countersign the appointing authority's own decision is not
-- a separation of duties, it is asking the office to get permission to do the
-- thing the office is for.
--
-- ---------------------------------------------------------------------------
-- THE ROUTE EXISTED AND COULD NEVER BE TAKEN
-- ---------------------------------------------------------------------------
--
-- 045 built `made_on_sole_authority` for exactly this, with a stated reason and
-- a permanent mark — and then closed with:
--
--     "041's constraint refuses an approval by the drafter outright. An
--      appointment made on sole authority names the same person as initiator
--      and approver but leaves `drafted_by` to whoever prepared it — so the two
--      rules do not collide."
--
-- They did not collide because the second rule could never fire. 045 assumed
-- sole authority meant the Vice-Chancellor DIRECTED an appointment somebody
-- else typed. The University means something simpler: the Vice-Chancellor
-- writes it and approves it, one person, start to finish. `drafted_by =
-- authorized_by`, which 041 refuses flatly.
--
-- So the flag has sat in the schema since 045, written by nothing, guarding a
-- door that was bricked up.
--
-- ---------------------------------------------------------------------------
-- WHAT IS NOT RELAXED, AND THIS IS THE POINT
-- ---------------------------------------------------------------------------
--
-- 041's rule still refuses a self-approval by DEFAULT. An HR officer, a
-- registrar, an administrator drafting and approving their own appointment is
-- refused exactly as before. The only way past it is the flag, the flag is
-- only permitted for the offices that hold the authority, and setting it
-- cannot be undone.
--
-- THE UNIVERSITY CAN DO IT. WHAT IT CANNOT DO IS DO IT QUIETLY. That is 040's
-- shape for emergency publishing and 045's for this, and it does not change
-- because the act has become ordinary rather than exceptional.
--
-- ---------------------------------------------------------------------------
-- AND THE REASON IS NO LONGER DEMANDED
-- ---------------------------------------------------------------------------
--
-- 045 required twenty characters of explanation whenever the flag was set,
-- because it modelled sole authority as an EXCEPTION — the same shape as an
-- emergency publication. The University has now ruled that it is the
-- Vice-Chancellor's ordinary way of working.
--
-- An explanation demanded every time a thing is done normally is a box
-- somebody types a full stop into, and a record full of full stops is worse
-- than no record: it looks like an audit trail and carries nothing. What the
-- University is answerable for is WHO did it and THAT they did it alone, and
-- both are already recorded — permanently, and now unerasably.
--
-- The reason stays available for the day somebody wants to give one.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. A SYSTEM ACCOUNT IS AN OFFICE TOO
-- ---------------------------------------------------------------------------
--
-- 045's office vocabulary has no value for the Superadministrator, who is not
-- an office of the University but is the account that holds every capability.
-- Without this the ruling could not be carried out by the very account the
-- University named in it.

do $$
begin
  if exists (select 1 from pg_constraint
              where conname = 'appointments_initiated_by_office_check') then
    alter table appointments drop constraint appointments_initiated_by_office_check;
  end if;

  alter table appointments add constraint appointments_initiated_by_office_check
    check (initiated_by_office is null or initiated_by_office in
           ('hr', 'vice-chancellor', 'chancellor', 'registrar', 'academic-office', 'system'));
end $$;

-- ---------------------------------------------------------------------------
-- 2. THE DRAFTER MAY APPROVE, BUT ONLY ON SOLE AUTHORITY
-- ---------------------------------------------------------------------------

do $$
begin
  -- REPLACED, NOT DROPPED. The rule still refuses every self-approval that is
  -- not marked; what changes is that being marked is now possible.
  if exists (select 1 from pg_constraint where conname = 'appointments_second_pair_of_eyes') then
    alter table appointments drop constraint appointments_second_pair_of_eyes;
  end if;

  alter table appointments add constraint appointments_second_pair_of_eyes
    check (
      authorized_by is null
      or drafted_by is null
      or authorized_by <> drafted_by
      -- THE ONE WAY THROUGH, and it leaves a mark that cannot be removed.
      or made_on_sole_authority
    );
end $$;

-- ---------------------------------------------------------------------------
-- 3. AND ONLY THE OFFICES THAT HOLD THE AUTHORITY MAY SET IT
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'appointments_sole_authority_explained') then
    alter table appointments drop constraint appointments_sole_authority_explained;
  end if;

  alter table appointments add constraint appointments_sole_authority_explained
    check (
      not made_on_sole_authority
      -- AN HR CLERK TICKING THIS BOX WOULD BE THE WHOLE SEPARATION GONE. 045's
      -- words, and they still hold — the list is simply one longer.
      or initiated_by_office in ('vice-chancellor', 'chancellor', 'system')
    );
end $$;

-- ---------------------------------------------------------------------------
-- 4. THE MARK CANNOT BE TAKEN OFF
-- ---------------------------------------------------------------------------
--
-- 045 called the mark permanent and nothing enforced it. An appointment
-- approved by its own drafter and then quietly unflagged is an appointment
-- that reads as ordinary and was not — and it is the one row in this table
-- where that matters.

create or replace function refuse_to_unmark_sole_authority()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.made_on_sole_authority and not new.made_on_sole_authority then
    raise exception
      'This appointment was approved by the officer who drafted it, on their own authority. '
      'That mark is part of the record and cannot be removed.';
  end if;
  return new;
end $$;

drop trigger if exists appointments_sole_authority_is_permanent on appointments;
create trigger appointments_sole_authority_is_permanent
  before update on appointments
  for each row execute function refuse_to_unmark_sole_authority();

-- ---------------------------------------------------------------------------
-- 5. PROVE IT
-- ---------------------------------------------------------------------------

do $$
declare
  vc      uuid;
  clerk   uuid;
  a_id    uuid;
  refused boolean;
begin
  begin
    -- THE ID IS SUPPLIED, NOT DEFAULTED. auth.users.id has no default on a
    -- real Supabase project — GoTrue generates it in the application — so an
    -- insert that leaves it out is refused with 23502. Every other migration
    -- in this directory names it; this one did not, and failed here on the
    -- University's database after passing twice on the local harness.
    vc    := gen_random_uuid();
    clerk := gen_random_uuid();
    insert into auth.users (id, email) values (vc,    '055-vc@example.test');
    insert into auth.users (id, email) values (clerk, '055-clerk@example.test');

    -- ---- THE ORDINARY RULE STILL BITES ------------------------------------
    -- An officer who is not the appointing authority drafting and approving
    -- their own appointment is refused exactly as it was before this file.
    insert into appointments (full_name, position_title, employment_type,
                              start_date, place_of_duty, status, drafted_by,
                              initiated_by_office)
      values ('A Proof Appointee', 'A Proof Post', 'permanent', '2026-10-01',
              'Buea', 'submitted', clerk, 'hr')
      returning id into a_id;

    refused := false;
    begin
      update appointments set status = 'approved', authorized_by = clerk, authorized_at = now()
       where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '055 FAILED: a clerk approved their own appointment';
    end if;

    -- ---- AND TICKING THE BOX DOES NOT HELP THEM ---------------------------
    -- The office is 'hr', which may not claim sole authority however the flag
    -- is set. This is the check that stops the new door being a way round the
    -- old rule for everybody.
    refused := false;
    begin
      update appointments
         set status = 'approved', authorized_by = clerk, authorized_at = now(),
             made_on_sole_authority = true
       where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '055 FAILED: an HR office claimed sole authority';
    end if;

    -- ---- THE VICE-CHANCELLOR MAY, AND IT IS MARKED ------------------------
    insert into appointments (full_name, position_title, employment_type,
                              start_date, place_of_duty, status, drafted_by,
                              initiated_by_office)
      values ('A Proof Appointee', 'A Proof Post', 'permanent', '2026-10-01',
              'Buea', 'submitted', vc, 'vice-chancellor')
      returning id into a_id;

    update appointments
       set status = 'approved', authorized_by = vc, authorized_at = now(),
           made_on_sole_authority = true
     where id = a_id;

    if not exists (select 1 from appointments
                    where id = a_id and made_on_sole_authority
                      and drafted_by = authorized_by) then
      raise exception '055 FAILED: the Vice-Chancellor could not approve their own appointment';
    end if;

    -- ---- AND STILL CANNOT DO IT UNMARKED ----------------------------------
    -- The flag is the whole permission. Without it the Vice-Chancellor is
    -- refused like anybody else, which is what keeps the mark honest: there is
    -- no self-approval anywhere in this table that is not flagged.
    insert into appointments (full_name, position_title, employment_type,
                              start_date, place_of_duty, status, drafted_by,
                              initiated_by_office)
      values ('A Proof Appointee', 'A Proof Post', 'permanent', '2026-10-01',
              'Buea', 'submitted', vc, 'vice-chancellor')
      returning id into a_id;

    refused := false;
    begin
      update appointments set status = 'approved', authorized_by = vc, authorized_at = now()
       where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '055 FAILED: a self-approval was accepted without the mark';
    end if;

    -- ---- AND THE MARK CANNOT BE REMOVED -----------------------------------
    update appointments
       set status = 'approved', authorized_by = vc, authorized_at = now(),
           made_on_sole_authority = true
     where id = a_id;

    refused := false;
    begin
      update appointments set made_on_sole_authority = false where id = a_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '055 FAILED: the sole-authority mark was taken off';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '055 OK: the Vice-Chancellor, the Chancellor and a system account may draft an '
               'appointment and approve it themselves';
  raise notice '055 OK: everybody else is still refused, and ticking the box does not help them';
  raise notice '055 OK: a self-approval without the mark is refused, and the mark cannot be '
               'taken off once set';
end $$;


-- ===========================================================================
-- 6. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- EVERY APPOINTMENT ONE PERSON MADE END TO END. Empty today; this is where
-- they will appear, and the Vice-Chancellor's own appointments will be among
-- them by design rather than by accident.
-- ---------------------------------------------------------------------------
select count(*)                                                   as appointments,
       count(*) filter (where made_on_sole_authority)             as made_alone,
       count(*) filter (where authorized_by is not null
                          and authorized_by = drafted_by)         as self_approved,
       count(*) filter (where authorized_by is not null
                          and authorized_by = drafted_by
                          and not made_on_sole_authority)         as self_approved_unmarked
  from appointments;


-- ===========================================================================
-- ===========================================================================
--
--   056_what_an_office_may_not_even_see.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 056 — WHAT AN OFFICE MAY NOT EVEN SEE
-- ===========================================================================
--
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
--
-- THE CERTIFICATE AND TRANSCRIPT DESIGNS STOP BEING READABLE BY EVERYBODY.
-- Until this file runs, the policy on `credential_templates` is:
--
--     create policy credential_templates_read on credential_templates
--       for select using (true);
--
-- `using (true)` is not "every member of staff". It is EVERY CALLER THE
-- PUBLISHABLE KEY BELONGS TO — every applicant, every student, every lecturer,
-- and every visitor who opens the site without signing in at all. The rows it
-- serves are the blank certificate and the blank transcript: border, seal
-- placement, crest position, typeface, every measurement that makes a
-- University document look like one.
--
-- The University put it plainly: some accounts must not SEE these, not merely
-- be unable to edit them. Read-only was never the safe half of the problem.
-- A design nobody can edit and anybody can read is a design anybody can copy.
--
-- AND THE APPOINTMENT REGISTER GETS THREE BANDS instead of one list. An HR
-- officer sees the files on their own desk. The Registrar sees the whole
-- register, executive appointments included — the University has ruled that.
--
-- AND AN EXECUTIVE POST MAY ONLY BE FILLED BY THE APPOINTING AUTHORITY.
--
-- AND THE SUPERADMINISTRATOR GETS THE SWITCH — as time-boxed, audited grants
-- rather than a setting, for the reason in section 6.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS FILE DOES NOT DO, AND WHY
-- ---------------------------------------------------------------------------
--
-- IT DOES NOT RANK THE OFFICES. The obvious rule — "you may not appoint to a
-- post more senior than your own" — needs an orderable seniority for every
-- office, and the University has not stated one. 053 recorded `precedence` as
-- PROSE, for printing, and said so in the column comment: "Never derived."
-- Turning that sentence into a number would mean inventing the ladder, which
-- is the one thing this codebase may not do.
--
-- So section 5 uses only the fact 053 actually recorded — that an office is
-- marked executive — and refuses those to everybody but the appointing
-- authority. It is the narrow, true version of the rule. The full ladder is
-- available the day the University states it.
-- ===========================================================================


-- ===========================================================================
-- 1. SIX OFFICES THE APPLICATION HAS AND THE DATABASE WOULD NOT STORE
-- ===========================================================================
--
-- Found while writing the proof for section 2, by trying to make somebody an
-- HR officer:
--
--     new row for relation "profiles" violates check constraint
--     "profiles_role_valid"
--
-- `profiles.role` carries seventeen roles. `src/lib/roles.ts` defines
-- twenty-three. These six exist in the application, hold capabilities in the
-- matrix, are offered by the role picker, and cannot be written to a profile:
--
--     hr-officer          hr-administrator
--     exam-officer        examiner
--     invigilator         moderator
--
-- WHAT THAT MEANT IN PRACTICE. `draft-appointment` is held by superadmin,
-- admin, vice-chancellor, hr-officer and hr-administrator — and two of those
-- five are roles no account could ever hold. The examination offices are the
-- same story: 015 and 016 built proctoring around an Examination Officer, an
-- examiner, a moderator and an invigilator, and not one of them could be
-- assigned. Every capability granted to these six was unreachable, and
-- nothing said so, because assigning the role fails at the moment somebody
-- tries it rather than at the moment the matrix was written.
--
-- This is fixed here rather than in its own file because section 2 cannot be
-- PROVED without it: a band for the officer who drafted the appointment is
-- untestable while no such officer can exist.
--
-- src/lib/schemaContract.test.mjs now compares the two lists on every run, so
-- the next role added to one has to be added to the other.

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'profiles_role_valid') then
    alter table profiles drop constraint profiles_role_valid;
  end if;

  alter table profiles add constraint profiles_role_valid
    check (role in (
      -- Custody of the system, as distinct from office in the University.
      'superadmin', 'admin',
      -- The University's offices, in the order roles.ts states them.
      'chancellor', 'vice-chancellor', 'registrar', 'finance-director',
      'dean', 'hod', 'programme-coordinator',
      -- THE EXAMINATION OFFICES. 015 and 016 wrote the proctoring system
      -- around these four and none could be assigned to anybody.
      'exam-officer', 'moderator', 'examiner', 'invigilator',
      'lecturer', 'finance', 'admissions-officer', 'library-staff',
      'student-affairs',
      -- HUMAN RESOURCES. The offices that hold 'draft-appointment'.
      'hr-officer', 'hr-administrator',
      'student', 'applicant',
      -- Predates the hierarchy; takes the academic admission decision.
      'academic-office'
    ));
end $$;


-- ===========================================================================
-- 2. THE BLANK CERTIFICATE IS NOT PUBLIC
-- ===========================================================================
--
-- WHO KEEPS THIS ROW, taken from the capabilities and nowhere else:
--
--   superadmin       design-credentials, publish-credential-template
--   admin            issue-credential
--   registrar        issue-credential, approve-credential-design
--   academic-office  issue-credential, approve-credential-design
--   vice-chancellor  approve-credential-design
--
-- Nobody else has a reason to hold the blank. A student reads their OWN
-- issued credential through `credentials_issued`, which 004 already scoped to
-- them, and that row carries the finished document — not the template it was
-- struck from.

drop policy if exists credential_templates_read on credential_templates;
create policy credential_templates_read on credential_templates
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office', 'vice-chancellor')
  );

comment on table credential_templates is
  'The blank certificate and the blank transcript. Restricted to the offices that design, '
  'approve or issue from them — 056. Read-only is not safe on its own: a design anybody can '
  'read is a design anybody can reproduce.';


-- ===========================================================================
-- 3. THE APPOINTMENT REGISTER IN THREE BANDS
-- ===========================================================================
--
-- 041's policy was:
--
--     person_id = auth.uid() or auth_role() in ('superadmin','admin','registrar')
--
-- which has a hole at each end. `hr-officer`, `hr-administrator` and the
-- VICE-CHANCELLOR all hold 'draft-appointment' and none of them is on that
-- list, so the Appointments screen renders an empty table for every one of
-- them. The Superadministrator never saw it because the Superadministrator is
-- waved through.
--
-- 055 has just given the Vice-Chancellor the authority to take an appointment
-- from draft to approval alone. Under 041's policy the VC could create one and
-- then not see it.
--
-- THE THREE BANDS
--
--   YOURS         — the appointment naming you. 041 had this and it stays:
--                   nobody should write to HR to find out what they were
--                   appointed as.
--   ON YOUR DESK  — you drafted it, you authorised it, or it was initiated in
--                   your name. This is the band that was missing, and it is
--                   the one that makes the screen work for the officers whose
--                   job it is.
--   THE REGISTER  — the whole thing. The University has ruled that the
--                   Registrar sees all of it, executive appointments
--                   included; the Registrar keeps the register of the
--                   University's officers and a register with holes in it is
--                   not a register.
--
-- WHAT IS DELIBERATELY ABSENT: `hr-officer` and `hr-administrator` are not in
-- the third band. They see their own work, which is what the University means
-- by "it is not even their place."

drop policy if exists appointments_read on appointments;
create policy appointments_read on appointments
  for select using (
    -- YOURS
    person_id = auth.uid()
    -- ON YOUR DESK
    or drafted_by = auth.uid()
    or authorized_by = auth.uid()
    or initiated_by = auth.uid()
    or reviewed_by = auth.uid()
    or issued_by = auth.uid()
    -- THE REGISTER
    or auth_role() in ('superadmin', 'admin', 'registrar', 'vice-chancellor', 'chancellor')
  );

-- THE LETTER FOLLOWS THE APPOINTMENT. A letter visible to somebody the
-- appointment is not would be the same disclosure by a longer route — the
-- letter carries the salary in words.
drop policy if exists appointment_letters_read on appointment_letters;
create policy appointment_letters_read on appointment_letters
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'vice-chancellor', 'chancellor')
    or exists (select 1 from appointments a
                where a.id = appointment_letters.appointment_id
                  and (a.person_id = auth.uid()
                       or a.drafted_by = auth.uid()
                       or a.authorized_by = auth.uid()
                       or a.initiated_by = auth.uid()))
  );

-- AND SO DOES THE HISTORY. 041 gave the events to superadmin/admin/registrar
-- only, which means an HR officer cannot see the history of the appointment
-- they themselves drafted — the screen shows the row and then nothing about
-- how it got there.
drop policy if exists appointment_events_read on appointment_events;
create policy appointment_events_read on appointment_events
  for select using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'vice-chancellor', 'chancellor')
    or exists (select 1 from appointments a
                where a.id = appointment_events.appointment_id
                  and (a.person_id = auth.uid()
                       or a.drafted_by = auth.uid()
                       or a.authorized_by = auth.uid()
                       or a.initiated_by = auth.uid()))
  );


-- ===========================================================================
-- 4. THE ALLOWANCES ARE THE SALARY BY ANOTHER NAME
-- ===========================================================================
--
-- 041 held the salary back from the ordinary screens and built
-- `appointments_without_pay` for the purpose, with the reasoning: "who holds
-- which post is ordinary institutional information; what they are paid is
-- not."
--
-- 047 then added `appointment_allowances` — housing, transport, responsibility
-- — as rows in their own table. They are money, they are on the same
-- appointment, and holding back the salary column while serving the
-- allowances row is holding back nothing at all.

do $$
begin
  if to_regclass('public.appointment_allowances') is not null then
    drop policy if exists appointment_allowances_read on appointment_allowances;
    create policy appointment_allowances_read on appointment_allowances
      for select using (
        auth_role() in ('superadmin', 'admin', 'registrar', 'vice-chancellor',
                        'chancellor', 'finance-director')
        or exists (select 1 from appointments a
                    where a.id = appointment_allowances.appointment_id
                      and a.person_id = auth.uid())
      );
  end if;
end $$;


-- ===========================================================================
-- 5. AN EXECUTIVE POST IS THE APPOINTING AUTHORITY'S TO FILL
-- ===========================================================================
--
-- This is the University's "it is not even their place", in the only form the
-- recorded facts support.
--
-- 053 marks an office executive by recording `executive_level` against it. It
-- has done so for one post so far — the Director of Academic Affairs, the
-- second-ranking officer after the Vice-Chancellor — and the University adds
-- others by filling that column, not by editing this file.
--
-- An appointment TO such a post may only be initiated by the Vice-Chancellor,
-- the Chancellor, or the system account. An HR officer may prepare anything
-- else; they may not put the University's second-ranking officer in post.
--
-- WHY A TRIGGER AND NOT A CHECK CONSTRAINT: the rule reads a column on a
-- DIFFERENT row — positions.executive_level — and a check constraint may only
-- see the row it is on.
--
-- WHY IT READS `initiated_by_office` AND NOT THE CALLER'S ROLE: every write to
-- this table goes through /api/appointments with the service key, which
-- carries no role claim, so auth_role() is 'anon' at write time and would
-- refuse everybody. `initiated_by_office` is the route's statement of which
-- office is acting, and 045 built it for exactly this.

create or replace function refuse_executive_appointment_from_below()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  level text;
  post  text;
begin
  if new.position_id is null then return new; end if;

  select p.executive_level, p.title into level, post
    from positions p where p.id = new.position_id;

  if level is null or btrim(level) = '' then return new; end if;

  if coalesce(new.initiated_by_office, '') not in ('vice-chancellor', 'chancellor', 'system') then
    raise exception
      '% is an executive office of the University. An appointment to it is the appointing '
      'authority''s to make — the Vice-Chancellor or the Chancellor — and cannot be initiated '
      'by the % office.', coalesce(post, 'That post'), coalesce(new.initiated_by_office, 'unnamed')
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists appointments_executive_posts_are_reserved on appointments;
create trigger appointments_executive_posts_are_reserved
  before insert or update on appointments
  for each row execute function refuse_executive_appointment_from_below();


-- ===========================================================================
-- 6. THE SWITCH, AS GRANTS RATHER THAN A SETTING
-- ===========================================================================
--
-- The University asked for a switch the Superadministrator can use to approve
-- or deny access. This is that, built as grants, and the difference is worth
-- stating because it is the whole reason for the table.
--
-- A SETTING ANSWERS "CAN THEY?" A GRANT ANSWERS "COULD THEY, THEN?"
--
-- A switch that turns "hr-officer may see the whole register" on and off holds
-- one bit, and that bit is always the CURRENT value. Six months after a letter
-- was written, with the switch off, there is nothing in the database that says
-- whether it was on the day the letter was written. The record cannot answer
-- the only question anybody ever asks about a permission — who could do this,
-- and when.
--
-- A grant is a row with two dates on it. Turning it off does not erase it.
--
-- THREE RULES, EACH REFUSING SOMETHING:
--
--   EVERY GRANT EXPIRES. There is no open-ended grant, because an open-ended
--   grant is a role change written in the wrong table, and it will be
--   forgotten — that is not a risk, it is what happens.
--
--   EVERY GRANT SAYS WHY. Not a full stop: twenty characters, the same floor
--   053 put on `standing`.
--
--   A GRANT IS NOT EDITABLE. It may be revoked, which is a new fact with its
--   own timestamp. It may not be rewritten, because a permission whose reason
--   and dates can be changed afterwards proves nothing about the past.

create table if not exists capability_grants (
  id           uuid primary key default gen_random_uuid(),
  -- WHO. A person, not a role. Granting to a role is what the role matrix is
  -- for; this table exists for the exception to it.
  grantee_id   uuid not null references auth.users (id) on delete cascade,
  -- WHAT. Deliberately unconstrained text. The vocabulary lives in
  -- src/lib/roles.ts and moves with the application; a CHECK listing the
  -- capabilities here would be a second copy that goes stale, and a stale
  -- vocabulary refuses a capability the application has just added.
  -- /api/admin/capability-grant validates against the real list.
  capability   text not null check (length(btrim(capability)) between 3 and 80),
  reason       text not null check (length(btrim(reason)) >= 20),
  granted_by   uuid not null references auth.users (id) on delete restrict,
  granted_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  revoked_by   uuid references auth.users (id) on delete set null,

  constraint capability_grants_expires_after_granting
    check (expires_at > granted_at),
  -- A REVOCATION HAS A REVOKER, and a revoker implies a revocation. Half of
  -- either is a row nobody can read.
  constraint capability_grants_revocation_is_whole
    check ((revoked_at is null) = (revoked_by is null))
);

create index if not exists capability_grants_grantee
  on capability_grants (grantee_id, capability);

comment on table capability_grants is
  'The Superadministrator''s switch, as rows. A named person holds a named capability until a '
  'stated date for a stated reason. Every grant expires, every grant says why, and no grant '
  'can be rewritten once made — only revoked, which is a new fact with its own timestamp.';

-- ---------------------------------------------------------------------------
-- NOT EDITABLE, AND THIS IS THE PART THAT MAKES THE TABLE WORTH HAVING
-- ---------------------------------------------------------------------------

create or replace function refuse_to_rewrite_a_grant()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception
      'A grant is not deleted. Revoke it: the row is the record that somebody held this, and '
      'for how long.'
      using errcode = 'check_violation';
  end if;

  if new.grantee_id is distinct from old.grantee_id
     or new.capability is distinct from old.capability
     or new.reason    is distinct from old.reason
     or new.granted_by is distinct from old.granted_by
     or new.granted_at is distinct from old.granted_at
     or new.expires_at is distinct from old.expires_at then
    raise exception
      'A grant cannot be rewritten. Revoke this one and make another — a permission whose '
      'reason and dates can be changed afterwards proves nothing about the past.'
      using errcode = 'check_violation';
  end if;

  -- AND A REVOCATION IS NOT UNDONE EITHER. Restoring access is a new grant.
  if old.revoked_at is not null and new.revoked_at is null then
    raise exception
      'This grant was revoked. That is part of the record. Make a new grant instead.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists capability_grants_are_not_rewritten on capability_grants;
create trigger capability_grants_are_not_rewritten
  before update or delete on capability_grants
  for each row execute function refuse_to_rewrite_a_grant();

-- ---------------------------------------------------------------------------
-- WHAT IS IN FORCE RIGHT NOW. The application reads this, never the table, so
-- that "expired" and "revoked" are decided in one place rather than in every
-- caller that forgets one of them.
-- ---------------------------------------------------------------------------

create or replace view capability_grants_in_force
with (security_invoker = true) as
select id, grantee_id, capability, reason, granted_by, granted_at, expires_at
  from capability_grants
 where revoked_at is null
   and expires_at > now();

comment on view capability_grants_in_force is
  'Grants that have not expired and have not been revoked. Read this, not the table: it is the '
  'one place where "still in force" is decided.';

alter table capability_grants enable row level security;

-- YOU SEE YOUR OWN GRANTS. Somebody should be able to find out what they have
-- been given and when it runs out, without asking the Superadministrator.
drop policy if exists capability_grants_own on capability_grants;
create policy capability_grants_own on capability_grants
  for select using (
    grantee_id = auth.uid()
    or auth_role() in ('superadmin', 'admin')
  );

-- No write policy. Grants are made through /api/admin/capability-grant, which
-- checks that the caller is the Superadministrator and records who granted it.


-- ===========================================================================
-- 7. PROVE IT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- HOW AN ACTOR IS PUT ON IN THESE PROOFS, because getting this wrong makes
-- every assertion below pass without testing anything.
--
-- `auth_role()` does NOT read the JWT. A later migration redefined it as
--
--     select role from public.profiles where id = auth.uid();
--
-- so setting `request.jwt.claim.role` changes nothing — it is read by no
-- function in this database. The first draft of this proof did exactly that,
-- and the student and visitor assertions both "passed" because auth_role()
-- was returning NULL for everybody and the policy refused every row. Only the
-- Registrar assertion — the one that expects to SEE something — noticed.
--
-- SO EVERY CHECK THAT EXPECTS A REFUSAL IS PAIRED WITH ONE THAT EXPECTS A
-- ROW. A proof made only of refusals cannot tell a working rule from a broken
-- connection.
--
-- Identity is `request.jwt.claim.sub`, and the role is whatever `profiles`
-- says for that id.
-- ---------------------------------------------------------------------------

do $$
declare
  vc        uuid;
  hr        uuid;
  other_hr  uuid;
  reg       uuid;
  stu       uuid;
  a_mine    uuid;
  a_theirs  uuid;
  exec_post uuid;
  g_id      uuid;
  seen      integer;
  refused   boolean;
begin
  begin
    vc       := gen_random_uuid();
    hr       := gen_random_uuid();
    other_hr := gen_random_uuid();
    reg      := gen_random_uuid();
    stu      := gen_random_uuid();
    insert into auth.users (id, email) values
      (vc,       '056-vc@example.test'),
      (hr,       '056-hr@example.test'),
      (other_hr, '056-hr2@example.test'),
      (reg,      '056-registrar@example.test'),
      (stu,      '056-student@example.test');
    insert into profiles (id, email, role) values
      (vc,       '056-vc@example.test',        'vice-chancellor'),
      (hr,       '056-hr@example.test',        'hr-officer'),
      (other_hr, '056-hr2@example.test',       'hr-officer'),
      (reg,      '056-registrar@example.test', 'registrar'),
      (stu,      '056-student@example.test',   'student')
    on conflict (id) do update set role = excluded.role;

    -- ---- THE BLANK CERTIFICATE IS NOT PUBLIC ------------------------------
    insert into credential_templates (kind, version, name, design, is_active)
      values ('certificate', 990056, '056 proof', '{}'::jsonb, false);

    set local role authenticated;

    execute format('set local request.jwt.claim.sub = %L', stu);
    select count(*) into seen from credential_templates where version = 990056;
    if seen <> 0 then
      raise exception '056 FAILED: a student can read the blank certificate';
    end if;

    -- THE VISITOR WHO NEVER SIGNED IN. This is the caller `using (true)` was
    -- serving, and the one worth naming separately: not a member of staff with
    -- too much access, but the public.
    set local request.jwt.claim.sub = '';
    select count(*) into seen from credential_templates where version = 990056;
    if seen <> 0 then
      raise exception '056 FAILED: a visitor who is not signed in can read the blank certificate';
    end if;

    -- AND THE OFFICE THAT ISSUES FROM IT STILL CAN. A rule that also refuses
    -- the people who need the row is not a tighter rule, it is a broken screen.
    -- This assertion is what caught the proof above testing nothing at all.
    execute format('set local request.jwt.claim.sub = %L', reg);
    select count(*) into seen from credential_templates where version = 990056;
    if seen <> 1 then
      raise exception '056 FAILED: the Registrar cannot read the blank certificate';
    end if;

    reset role;

    -- ---- THE THREE BANDS --------------------------------------------------
    insert into appointments (full_name, position_title, employment_type, start_date,
                              place_of_duty, status, drafted_by, initiated_by_office)
      values ('056 Mine', 'A Proof Post', 'permanent', '2026-10-01', 'Buea', 'draft', hr, 'hr')
      returning id into a_mine;

    insert into appointments (full_name, position_title, employment_type, start_date,
                              place_of_duty, status, drafted_by, initiated_by_office)
      values ('056 Theirs', 'A Proof Post', 'permanent', '2026-10-01', 'Buea', 'draft',
              other_hr, 'hr')
      returning id into a_theirs;

    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', hr);

    -- ON YOUR DESK. This is the band 041 did not have, and without it the HR
    -- screen is an empty table for the officer who drafted every row in it.
    select count(*) into seen from appointments where id = a_mine;
    if seen <> 1 then
      raise exception '056 FAILED: an HR officer cannot see the appointment they drafted';
    end if;

    -- AND NOT SOMEBODY ELSE'S.
    select count(*) into seen from appointments where id = a_theirs;
    if seen <> 0 then
      raise exception '056 FAILED: an HR officer can read an appointment off another desk';
    end if;

    -- AND NOT A STUDENT'S BUSINESS AT ALL.
    execute format('set local request.jwt.claim.sub = %L', stu);
    select count(*) into seen from appointments where id in (a_mine, a_theirs);
    if seen <> 0 then
      raise exception '056 FAILED: a student can read the appointment register';
    end if;

    -- THE REGISTER. The University has ruled the Registrar sees all of it.
    execute format('set local request.jwt.claim.sub = %L', reg);
    select count(*) into seen from appointments where id in (a_mine, a_theirs);
    if seen <> 2 then
      raise exception '056 FAILED: the Registrar cannot see the whole register';
    end if;

    -- AND THE VICE-CHANCELLOR, who since 055 may draft and approve alone and
    -- under 041's policy could not then see what they had made.
    execute format('set local request.jwt.claim.sub = %L', vc);
    select count(*) into seen from appointments where id in (a_mine, a_theirs);
    if seen <> 2 then
      raise exception '056 FAILED: the Vice-Chancellor cannot see the register';
    end if;

    reset role;

    -- ---- AN EXECUTIVE POST IS RESERVED ------------------------------------
    insert into positions (job_code, title, family, executive_level)
      values ('PROOF-EXEC-056', 'A Proof Executive Office', 'other', 'Executive')
      returning id into exec_post;

    refused := false;
    begin
      insert into appointments (full_name, position_title, employment_type, start_date,
                                place_of_duty, status, drafted_by, initiated_by_office,
                                position_id)
        values ('056 Exec', 'A Proof Executive Office', 'permanent', '2026-10-01', 'Buea',
                'draft', hr, 'hr', exec_post);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '056 FAILED: HR filled an executive post';
    end if;

    -- AND THE APPOINTING AUTHORITY MAY.
    insert into appointments (full_name, position_title, employment_type, start_date,
                              place_of_duty, status, drafted_by, initiated_by_office,
                              position_id)
      values ('056 Exec', 'A Proof Executive Office', 'permanent', '2026-10-01', 'Buea',
              'draft', vc, 'vice-chancellor', exec_post);

    -- AND AN ORDINARY POST IS UNTOUCHED. A rule that quietly stops HR doing
    -- its ordinary work would be discovered as an outage, not as a rule.
    insert into positions (job_code, title, family)
      values ('PROOF-ORD-056', 'A Proof Ordinary Post', 'other')
      returning id into exec_post;
    insert into appointments (full_name, position_title, employment_type, start_date,
                              place_of_duty, status, drafted_by, initiated_by_office,
                              position_id)
      values ('056 Ordinary', 'A Proof Ordinary Post', 'permanent', '2026-10-01', 'Buea',
              'draft', hr, 'hr', exec_post);

    -- ---- THE GRANTS -------------------------------------------------------
    insert into capability_grants (grantee_id, capability, reason, granted_by, expires_at)
      values (hr, 'authorize-appointment',
              'Covering the Registrar during the September recess.', vc, now() + interval '14 days')
      returning id into g_id;

    -- NO OPEN-ENDED GRANT.
    refused := false;
    begin
      insert into capability_grants (grantee_id, capability, reason, granted_by, expires_at)
        values (hr, 'issue-credential', 'A perfectly good reason, at length.', vc, null);
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '056 FAILED: a grant was made with no expiry';
    end if;

    -- NO GRANT WITHOUT A REASON. A full stop is what a mandatory box gets.
    refused := false;
    begin
      insert into capability_grants (grantee_id, capability, reason, granted_by, expires_at)
        values (hr, 'issue-credential', '.', vc, now() + interval '1 day');
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '056 FAILED: a grant was made without a stated reason';
    end if;

    -- NOT REWRITEABLE.
    refused := false;
    begin
      update capability_grants set expires_at = now() + interval '400 days' where id = g_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '056 FAILED: a grant was rewritten after the fact';
    end if;

    -- NOT DELETABLE.
    refused := false;
    begin
      delete from capability_grants where id = g_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '056 FAILED: a grant was deleted';
    end if;

    -- REVOCABLE, AND THEN GONE FROM WHAT IS IN FORCE.
    if not exists (select 1 from capability_grants_in_force where id = g_id) then
      raise exception '056 FAILED: a live grant is not in force';
    end if;

    update capability_grants set revoked_at = now(), revoked_by = vc where id = g_id;

    if exists (select 1 from capability_grants_in_force where id = g_id) then
      raise exception '056 FAILED: a revoked grant is still in force';
    end if;

    -- AND THE REVOCATION DOES NOT COME OFF.
    refused := false;
    begin
      update capability_grants set revoked_at = null, revoked_by = null where id = g_id;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '056 FAILED: a revocation was undone';
    end if;

    -- AN EXPIRED GRANT IS NOT IN FORCE EITHER, and this is the one people
    -- forget: it was never revoked, so a caller checking `revoked_at is null`
    -- alone would still honour it.
    insert into capability_grants (grantee_id, capability, reason, granted_by,
                                   granted_at, expires_at)
      values (hr, 'issue-credential', 'An old grant that has since run out.', vc,
              now() - interval '30 days', now() - interval '1 day')
      returning id into g_id;

    if exists (select 1 from capability_grants_in_force where id = g_id) then
      raise exception '056 FAILED: an expired grant is still in force';
    end if;

    raise exception 'PROOF_ROLLBACK';
  exception
    when others then
      reset role;
      if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
  end;

  raise notice '056 OK: the blank certificate and transcript are readable only by the offices '
               'that design, approve or issue from them — not by students, and not by visitors';
  raise notice '056 OK: the appointment register has three bands — yours, on your desk, and the '
               'whole register for the Registrar, the Vice-Chancellor and the Chancellor';
  raise notice '056 OK: an executive post can only be filled by the appointing authority';
  raise notice '056 OK: a grant expires, states a reason, cannot be rewritten or deleted, and '
               'is out of force once revoked or expired';
end $$;


-- ===========================================================================
-- 8. VERIFY — READ THIS OUTPUT
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- WHO CAN READ THE BLANK DOCUMENTS NOW. Before this file the answer was
-- `true`, meaning everybody. It should now name five offices.
-- ---------------------------------------------------------------------------
select 'credential_templates' as protects,
       pg_get_expr(polqual, polrelid) as readable_by
  from pg_policy
 where polname = 'credential_templates_read';

-- ---------------------------------------------------------------------------
-- AND THE GRANTS IN FORCE. Empty today. Anything here is somebody holding a
-- capability their role does not carry, and the row says who gave it, why,
-- and when it lapses.
-- ---------------------------------------------------------------------------
select count(*) filter (where true)                     as grants_ever,
       count(*) filter (where revoked_at is not null)   as revoked,
       count(*) filter (where expires_at <= now())      as expired,
       (select count(*) from capability_grants_in_force) as in_force
  from capability_grants;


-- ===========================================================================
-- ===========================================================================
--
--   057_the_academic_structure.sql
--
-- ===========================================================================
-- ===========================================================================

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
  -- ---------------------------------------------------------------------
  -- THE ONE IMMUTABLE THING, AND IT IS THE SLUG THE UNIVERSITY ALREADY USES.
  --
  -- Everything else about a programme may be revised in a new version; the
  -- code is how the revisions are known to be the same programme.
  --
  -- This was an invented uppercase form capped at 24 characters, and 23 of the
  -- University's 41 programmes have identifiers longer than that —
  -- `diploma-in-air-conditioning-refrigeration` is 41. Abbreviating them would
  -- have meant inventing 41 programme codes the University has never used.
  --
  -- It already has one. The slug is in every programme URL on the live site
  -- and in `courses.programme_slug`, so taking it verbatim means the register
  -- joins to the website and to the course table with no translation, and
  -- nothing here is made up. It is also the same shape as `schools.code`.
  -- ---------------------------------------------------------------------
  code         text not null unique check (code ~ '^[a-z][a-z0-9-]{1,63}$'),
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

-- ---------------------------------------------------------------------------
-- AND THE PATTERN IS REPLACED ON A DATABASE THAT ALREADY HAS THE TABLE.
--
-- `create table if not exists` does exactly nothing when the table is there —
-- including nothing to its CHECK constraints. So widening the code pattern in
-- the block above reached a fresh database and NOT the University's, which had
-- already run the earlier version of this file. The proof then inserted the
-- new lowercase code against the old uppercase constraint and stopped the
-- whole bundle:
--
--     ERROR: 23514: new row for relation "programmes" violates check
--            constraint "programmes_code_check"
--     DETAIL: Failing row contains (…, proof-bachelor-of-study, …)
--
-- MY TESTING COULD NOT HAVE FOUND THIS. Every run was from an empty database,
-- where `create table` does apply the new constraint. The upgrade path — an
-- older version of this same file, then this one — is the path the University
-- is actually on, and it was the one path never exercised.
--
-- 056 already had to do this for `profiles_role_valid`. Any constraint that
-- changes after a table has shipped needs its own drop-and-add; editing the
-- create block is a change that only ever reaches new installations.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'programmes_code_check') then
    alter table programmes drop constraint programmes_code_check;
  end if;
  alter table programmes add constraint programmes_code_check
    check (code ~ '^[a-z][a-z0-9-]{1,63}$');
end $$;

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

    -- ---------------------------------------------------------------------
    -- THE PROOF SETS ITS OWN STARTING POINT.
    --
    -- The first assertion below is that with NO approving body recorded, the
    -- refusal explains how to record one. 058 seeds exactly such a body, so on
    -- a database that has had 058 this proof used to get a different refusal
    -- and fail — RUN-ALL was clean on its first pass from empty and red on its
    -- second.
    --
    -- This is the same collision 045 had with 055, and the same fix: a proof
    -- must not assume the state a later migration deliberately changes. The
    -- whole block rolls back, so anything 058 seeded is restored when it does.
    -- ---------------------------------------------------------------------
    delete from academic_approval_requirements where subject = 'curriculum';

    insert into schools (code, name) values ('proof-school', 'A Proof School of Study')
      returning id into sch;
    -- `faculty` is NOT NULL on the existing table — the text column section 2
    -- leaves in place. A proof that did not set it would fail on a real database
    -- for a reason that has nothing to do with this migration.
    insert into departments (name, code, faculty, school_id)
      values ('A Proof Department', 'PRF', 'A Proof School of Study', sch)
      returning id into dept;

    insert into programmes (code, award_level, status)
      values ('proof-bachelor-of-study', 'Bachelor''s', 'draft') returning id into prog;

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
  select '048' as migration, '048_the_job_descriptions_and_what_they_inherit.sql' as file,
         case when to_regclass('public.positions') is not null then 'YES' else 'NO' end as landed,
         'positions' as what_it_creates
  union all
  select '049' as migration, '049_verification_signatures_and_the_written_letter.sql' as file,
         case when to_regclass('public.signature_specimens') is not null then 'YES' else 'NO' end as landed,
         'signature_specimens' as what_it_creates
  union all
  select '050' as migration, '050_acceptance_the_activation_rule_and_the_full_audit.sql' as file,
         case when to_regclass('public.appointment_acceptances') is not null then 'YES' else 'NO' end as landed,
         'appointment_acceptances' as what_it_creates
  union all
  select '051' as migration, '051_templates_for_every_document_the_university_issues.sql' as file,
         case when to_regclass('public.document_template_coverage') is not null then 'YES' else 'NO' end as landed,
         'document_template_coverage' as what_it_creates
  union all
  select '052' as migration, '052_a_first_draft_of_every_document.sql' as file,
         case when to_regclass('public.document_templates') is null then 'NO'
                 when exists (select 1 from document_templates where created_by is null) then 'YES'
                 else 'NO' end as landed,
         'rows:document_templates:created_by is null' as what_it_creates
  union all
  select '053' as migration, '053_where_an_office_stands.sql' as file,
         case when exists (
                   select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = 'positions'
                      and column_name = 'standing')
                 then 'YES' else 'NO' end as landed,
         'positions.standing' as what_it_creates
  union all
  select '054' as migration, '054_course_registration.sql' as file,
         case when to_regclass('public.course_roll') is not null then 'YES' else 'NO' end as landed,
         'course_roll' as what_it_creates
  union all
  select '055' as migration, '055_the_office_that_needs_no_second_signature.sql' as file,
         case when exists (
                   select 1 from pg_constraint
                    where conname = 'appointments_second_pair_of_eyes'
                      and position('made_on_sole_authority' in pg_get_constraintdef(oid)) > 0)
                 then 'YES' else 'NO' end as landed,
         'def:appointments_second_pair_of_eyes:made_on_sole_authority' as what_it_creates
  union all
  select '056' as migration, '056_what_an_office_may_not_even_see.sql' as file,
         case when to_regclass('public.capability_grants') is not null then 'YES' else 'NO' end as landed,
         'capability_grants' as what_it_creates
  union all
  select '057' as migration, '057_the_academic_structure.sql' as file,
         case when to_regclass('public.programme_versions') is not null then 'YES' else 'NO' end as landed,
         'programme_versions' as what_it_creates
) as landed_report
 order by migration;

