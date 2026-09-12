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
    select id into fam_id from position_profiles
      where family = 'academic-staff' and position_id is null;

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
    insert into position_profiles (position_id, version, status, job_purpose,
                                   created_by, activated_by, activated_at)
    values (pos_id, 1, 'active',
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
    insert into position_profiles (position_id, version, status, created_by)
    values (pos_id, 2, 'draft', someone)
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
