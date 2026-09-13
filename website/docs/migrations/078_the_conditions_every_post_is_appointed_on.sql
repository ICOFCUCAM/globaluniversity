-- ===========================================================================
-- 078 — THE CONDITIONS EVERY POST IS APPOINTED ON
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. EVERY POST HAS DEFAULT APPOINTMENT CONDITIONS. Eight family sets, between
--    them covering all forty-three posts in the register, carrying the twenty
--    or so clauses a letter of appointment is expected to state — duration,
--    probation, hours, remuneration, leave, confidentiality, intellectual
--    property, notice, discipline, retirement, dispute, acceptance. Choosing a
--    post in the appointment form now fills the "Appointment conditions" box,
--    which until today was empty and stayed empty.
--
-- 2. EVERY POST HAS A DUTY STATION. All forty-three were null, so the letter
--    had no place of duty unless somebody typed one. They are set to the
--    University's own published address and each stays editable.
--
-- 3. NOTHING ELSE IS INVENTED. `grade` stays null on every post, because the
--    University has never stated a grade scale, and `employment_category`
--    stays null, because what kind of employment a post is offered on is a
--    decision taken appointment by appointment and not a property of the post.
--    Both columns remain there to be filled when the University says what goes
--    in them.
--
-- ---------------------------------------------------------------------------
-- WHY THESE ARE ACTIVE AND THE JOB DESCRIPTIONS ARE STILL DRAFTS
-- ---------------------------------------------------------------------------
--
-- 048 seeded eight job-description profiles and marked every one `draft`, at
-- the University's instruction, because a job description is APPENDED TO THE
-- LETTER OUT OF THE DATABASE. Nobody reads it on the way past. So it must not
-- reach a letter until a second person has activated it, and that is a rule
-- worth keeping — those eight are still drafts after this migration, and the
-- place to activate them is the Job Descriptions screen, not a SQL file
-- pretending to be a signature.
--
-- Appointment conditions are not like that. They land in an EDITABLE BOX in
-- the appointment form. The officer preparing the letter reads them and may
-- change every word before saving, and the Vice-Chancellor reads them again
-- before approving. A default that a human must look at twice before it binds
-- anybody is a starting point, not an issued document, and holding one in
-- draft only means the box stays empty and somebody writes the conditions from
-- memory — which is the failure this closes.
--
-- The constraints below say exactly that and nothing wider: a set the system
-- seeded (`created_by` null) may be active unsigned; a set A PERSON WROTE may
-- not be active until somebody else has activated it.
--
-- ---------------------------------------------------------------------------
-- THE ONE THING TO READ TWICE
-- ---------------------------------------------------------------------------
--
-- THE CONDITIONS STATE STANDING TERMS AND REFER THE PARTICULARS TO THE LETTER.
-- "Your hours are as stated in your letter of appointment", not "40 hours per
-- week". This is how conditions of service are actually written, and it is the
-- reason one set can serve a permanent Registrar and a visiting lecturer
-- without a table of every family crossed with every employment type. The
-- letter carries the particulars; the conditions carry what is true whoever
-- signs it.
-- ===========================================================================


-- ===========================================================================
-- 1. THE SETS
-- ===========================================================================
--
-- Shaped like `position_profiles` on purpose. A post's own set replaces its
-- family's SECTION BY SECTION — the same inheritance 048 established, for the
-- same reason: a Dean whose notice period differs from the family's needs the
-- difference to BE the document, not a contradiction inside it.

create table if not exists appointment_condition_sets (
  id             uuid primary key default gen_random_uuid(),

  -- ONE OR THE OTHER, NEVER BOTH. A set that belonged to a post AND a family
  -- would be inherited by itself.
  position_id    uuid references positions (id) on delete cascade,
  family         text check (family in (
                   'executive', 'academic-administration', 'faculty-leadership',
                   'administration', 'student-services', 'ict',
                   'academic-staff', 'other')),

  version        integer not null default 1 check (version >= 1),

  -- The sentence the conditions open with, above the numbered clauses.
  preamble       text,

  status         text not null default 'draft'
                   check (status in ('draft', 'active', 'superseded')),
  effective_from date,

  created_by     uuid references auth.users (id) on delete set null,
  activated_by   uuid references auth.users (id) on delete set null,
  activated_at   timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint appointment_condition_sets_belongs_to_one_thing
    check ((position_id is not null) <> (family is not null)),

  -- NOBODY ACTIVATES WHAT THEY WROTE.
  constraint appointment_condition_sets_second_pair_of_eyes
    check (activated_by is null or created_by is null or activated_by <> created_by),

  -- AND A SET A PERSON WROTE IS NOT ACTIVE UNTIL SOMEBODY ACTIVATED IT.
  -- A seeded set — `created_by` null — is exempt, and that exemption is the
  -- whole argument in the header: these are defaults read in a box, not a
  -- document issued unread.
  constraint appointment_condition_sets_written_ones_need_activating
    check (status <> 'active' or created_by is null
           or (activated_by is not null and activated_at is not null))
);

create unique index if not exists appointment_condition_sets_one_active_per_family_idx
  on appointment_condition_sets (family)
  where status = 'active' and family is not null;

create unique index if not exists appointment_condition_sets_one_active_per_post_idx
  on appointment_condition_sets (position_id)
  where status = 'active' and position_id is not null;

create unique index if not exists appointment_condition_sets_version_per_family_idx
  on appointment_condition_sets (family, version) where family is not null;

create unique index if not exists appointment_condition_sets_version_per_post_idx
  on appointment_condition_sets (position_id, version) where position_id is not null;

comment on table appointment_condition_sets is
  'The University''s default conditions of appointment, held per family of posts and '
  'overridable per post. They fill the editable "Appointment conditions" box on the '
  'appointment form; they are never appended to a letter unread.';


-- ===========================================================================
-- 2. THE CLAUSES
-- ===========================================================================
--
-- A CLOSED LIST OF SECTIONS, and deliberately not the job description's list.
-- A job description says what the post-holder DOES. Conditions of appointment
-- say what the University and the post-holder OWE EACH OTHER. Running the two
-- through one list would put "Key Performance Indicators" into a contract and
-- "Notice of termination" into a job description.

create table if not exists appointment_condition_clauses (
  id         uuid primary key default gen_random_uuid(),
  set_id     uuid not null references appointment_condition_sets (id) on delete cascade,

  section    text not null check (section in (
               'appointment', 'duration', 'probation', 'duties',
               'hours', 'place-of-duty', 'remuneration', 'allowances',
               'deductions', 'leave', 'conduct', 'confidentiality',
               'intellectual-property', 'outside-work', 'discipline',
               'termination', 'notice', 'retirement', 'dispute',
               'governing-policies', 'acceptance', 'amendment')),

  ordinal    integer not null check (ordinal >= 1),

  -- A CLAUSE OF FIVE WORDS IS A HEADING SOMEBODY MEANT TO COME BACK TO.
  body       text not null check (length(btrim(body)) >= 10),

  created_at timestamptz not null default now(),

  unique (set_id, section, ordinal)
);

create index if not exists appointment_condition_clauses_set_idx
  on appointment_condition_clauses (set_id, section, ordinal);


-- ===========================================================================
-- 3. WHO MAY READ THEM
-- ===========================================================================
--
-- Everybody signed in. Conditions of appointment are not a secret — a member
-- of staff who cannot read the terms they are employed on has been given a
-- contract they cannot check.

alter table appointment_condition_sets    enable row level security;
alter table appointment_condition_clauses enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies
                  where tablename = 'appointment_condition_sets'
                    and policyname = 'appointment_condition_sets_read') then
    create policy appointment_condition_sets_read on appointment_condition_sets
      for select to authenticated using (true);
  end if;

  if not exists (select 1 from pg_policies
                  where tablename = 'appointment_condition_clauses'
                    and policyname = 'appointment_condition_clauses_read') then
    create policy appointment_condition_clauses_read on appointment_condition_clauses
      for select to authenticated using (true);
  end if;
end $$;


-- ===========================================================================
-- 4. WHAT A GIVEN POST'S CONDITIONS ACTUALLY ARE
-- ===========================================================================
--
-- REPLACES, DOES NOT MERGE — the same rule as `position_job_description`, and
-- it has to be, because the screen and the letter resolving inheritance two
-- different ways is how an appointee ends up holding conditions nobody in the
-- University recognises.
--
-- Dropped and recreated rather than `create or replace`, because a later
-- migration that widens it cannot then be re-run over this one.

drop view if exists position_default_conditions;

create view position_default_conditions
with (security_invoker = true) as
  with own_sections as (
    select s.position_id, c.section
      from appointment_condition_sets s
      join appointment_condition_clauses c on c.set_id = s.id
     where s.position_id is not null and s.status = 'active'
     group by s.position_id, c.section
  )
  select p.id   as position_id,
         p.job_code,
         p.title,
         p.family,
         c.section,
         c.ordinal,
         c.body,
         s.preamble,
         case when s.position_id is not null then 'position' else 'family' end as source
    from positions p
    join appointment_condition_sets s
      on s.status = 'active'
     and (s.position_id = p.id or (s.family = p.family and s.position_id is null))
    join appointment_condition_clauses c on c.set_id = s.id
   where s.position_id is not null
      or not exists (select 1 from own_sections o
                      where o.position_id = p.id and o.section = c.section);

comment on view position_default_conditions is
  'The conditions of appointment in force for each post: its own active set where it has '
  'one, its family''s everywhere else, section by section.';


-- ===========================================================================
-- 5. THE SEED — EIGHT FAMILIES, AND WHAT THEY OWE EACH OTHER
-- ===========================================================================

do $$
declare
  fam  text;
  sid  uuid;
begin
  foreach fam in array array['executive', 'academic-administration',
                             'faculty-leadership', 'administration',
                             'student-services', 'ict', 'academic-staff', 'other'] loop

    -- IDEMPOTENT BY FAMILY. A second run leaves an existing set alone,
    -- including one the University has since edited.
    if exists (select 1 from appointment_condition_sets where family = fam) then
      continue;
    end if;

    insert into appointment_condition_sets (family, version, status, effective_from, preamble)
    values (fam, 1, 'active', current_date,
      'Your appointment to this post is made on the following conditions. Where a '
      || 'particular of your appointment — its duration, your hours, your remuneration, '
      || 'your place of duty or your reporting officer — is stated in your letter of '
      || 'appointment, the letter governs and these conditions stand alongside it.')
    returning id into sid;

    -- ---- WHAT IS TRUE OF EVERY APPOINTMENT THE UNIVERSITY MAKES -----------
    insert into appointment_condition_clauses (set_id, section, ordinal, body) values
      (sid, 'appointment', 1,
       'This appointment is made by ICOF Global University and takes effect on the date '
       'stated in your letter of appointment. It is subject to your acceptance in writing '
       'and to the University''s satisfaction as to your qualifications, references and '
       'right to work.'),
      (sid, 'duration', 1,
       'The duration of this appointment is as stated in your letter. An appointment for a '
       'fixed term ends on the date stated and carries no expectation of renewal; renewal '
       'is a fresh decision of the University taken on its own merits.'),
      (sid, 'probation', 1,
       'Where your letter states a probationary period, your appointment is confirmed only '
       'on the written confirmation of the University at the end of it. The University may '
       'extend the probationary period once, in writing and with reasons. During probation '
       'either party may end the appointment on one month''s notice.'),
      (sid, 'duties', 1,
       'You shall perform the duties set out in the job description for this post, together '
       'with such other duties reasonably related to it as the University may assign. The '
       'job description may be amended after consultation with you; the version in force at '
       'the date of your appointment remains on the record.'),
      (sid, 'hours', 1,
       'Your hours of work are as stated in your letter of appointment. You are expected to '
       'work such additional hours as the proper discharge of the post reasonably requires, '
       'without further payment unless your letter states otherwise.'),
      (sid, 'place-of-duty', 1,
       'Your place of duty is as stated in your letter. The University may require you to '
       'work at any of its locations, or to travel on its business, on reasonable notice.'),
      (sid, 'remuneration', 1,
       'Your remuneration is as stated in your letter of appointment and is payable monthly '
       'in arrears. Remuneration is reviewed by the University from time to time; a review '
       'does not of itself create an entitlement to an increase.'),
      (sid, 'allowances', 1,
       'Any allowance is payable only where it is stated in your letter of appointment or '
       'granted to you in writing afterwards, and only for so long as the condition it was '
       'granted for continues.'),
      (sid, 'deductions', 1,
       'The University shall make from your remuneration such deductions as the law '
       'requires, and may recover any sum you owe it, including an overpayment, after '
       'notifying you in writing of the amount and the reason.'),
      (sid, 'leave', 1,
       'You are entitled to annual leave, public holidays, sick leave and maternity or '
       'paternity leave in accordance with the University''s leave policy in force from time '
       'to time and with the law. Annual leave is taken at times approved in advance by your '
       'reporting officer.'),
      (sid, 'conduct', 1,
       'You shall conduct yourself in accordance with the statutes, regulations and policies '
       'of the University, shall not act in a way that brings it into disrepute, and shall '
       'declare in writing any interest that conflicts, or might reasonably appear to '
       'conflict, with your duties.'),
      (sid, 'confidentiality', 1,
       'You shall treat student records, staff records, examination material and the '
       'University''s commercial and legal affairs as confidential, both during this '
       'appointment and after it ends, and shall not disclose them except as your duties or '
       'the law require.'),
      (sid, 'intellectual-property', 1,
       'Work you create in the course of this appointment belongs to the University, save '
       'that you retain the customary academic rights of authorship and attribution in '
       'scholarly publication. The University will not assert ownership of work you create '
       'wholly outside your duties and without its resources.'),
      (sid, 'outside-work', 1,
       'You shall obtain the written approval of the Vice-Chancellor before undertaking '
       'paid work outside the University. Approval will not be withheld unreasonably, and '
       'will be withheld where the outside work conflicts with your duties or with the '
       'interests of the University.'),
      (sid, 'discipline', 1,
       'Misconduct is dealt with under the University''s disciplinary procedure. You will be '
       'told the case against you in writing, given a fair opportunity to answer it, and '
       'have a right of appeal. The University may suspend you on full pay while a matter '
       'is investigated; suspension is not a disciplinary penalty.'),
      (sid, 'termination', 1,
       'The University may end this appointment for gross misconduct without notice. It may '
       'otherwise end it on notice, or on redundancy or incapacity, following the procedure '
       'in its policies and the requirements of the law.'),
      (sid, 'notice', 1,
       'Either party may end this appointment on the period of notice stated in your letter '
       'of appointment, or on one month''s written notice where the letter states none. The '
       'University may pay you in lieu of notice.'),
      (sid, 'retirement', 1,
       'Retirement is in accordance with the University''s policy and with the law. Nothing '
       'in these conditions requires you to retire at a particular age where the law '
       'provides otherwise.'),
      (sid, 'dispute', 1,
       'A grievance about your appointment should be raised in writing with your reporting '
       'officer and, failing resolution, with the Vice-Chancellor, whose decision is the '
       'final internal step. Nothing here takes away any right you have in law.'),
      (sid, 'governing-policies', 1,
       'These conditions are to be read with the statutes and regulations of the University '
       'and with its policies in force from time to time. Where a policy and these '
       'conditions conflict, these conditions govern unless the policy says otherwise and '
       'has been approved by the Vice-Chancellor.'),
      (sid, 'amendment', 1,
       'The University may amend these conditions after consultation. An amendment is issued '
       'in writing and takes effect on the date it states; the conditions in force when you '
       'accepted your appointment remain on the record.'),
      (sid, 'acceptance', 1,
       'Please signify your acceptance by signing and returning the acceptance form '
       'accompanying your letter of appointment. Your appointment is not complete until the '
       'University has received it.');

    -- ---- AND WHAT DISTINGUISHES THE FAMILY --------------------------------
    --
    -- ONE SECTION EACH, AND IT REPLACES THE FAMILY'S NOTHING — these are
    -- sections the common block does not write, so there is nothing to
    -- collide with. A post that later needs a different notice period writes
    -- its own `notice` section and takes it INSTEAD of the one above.

    if fam = 'academic-staff' then
      insert into appointment_condition_clauses (set_id, section, ordinal, body) values
        (sid, 'duties', 2,
         'Your duties include teaching, the setting and marking of assessment, the '
         'supervision of students, scholarship or research appropriate to the post, and '
         'such examination duties as the University assigns. You shall keep to the '
         'published academic calendar and to the deadlines for the submission of marks.'),
        (sid, 'outside-work', 2,
         'Scholarly activity, external examining, peer review and professional practice '
         'that supports your academic standing are encouraged, and require approval only '
         'where they are paid or where they would take a material part of your time.');

    elsif fam = 'executive' then
      insert into appointment_condition_clauses (set_id, section, ordinal, body) values
        (sid, 'duties', 2,
         'You hold an office of the University and shall exercise the powers of that office '
         'in accordance with its statutes. You shall report to the governing authority of '
         'the University as its statutes require.'),
        (sid, 'notice', 2,
         'Either party may end this appointment on three months'' written notice, or on the '
         'period stated in your letter of appointment where that is longer.'),
        (sid, 'outside-work', 2,
         'You shall not hold any other remunerated executive office without the written '
         'approval of the governing authority of the University.');

    elsif fam = 'faculty-leadership' then
      insert into appointment_condition_clauses (set_id, section, ordinal, body) values
        (sid, 'duties', 2,
         'You shall lead the academic work of the faculty, school or programme named in '
         'your letter, oversee the staff assigned to it, and account to the Vice-Chancellor '
         'for its academic standards, its student outcomes and its use of resources.'),
        (sid, 'duration', 2,
         'A headship or deanship is held for the term stated in your letter. At the end of '
         'that term you revert to your substantive academic post on its own conditions, '
         'unless the University appoints you for a further term.');

    elsif fam = 'academic-administration' then
      insert into appointment_condition_clauses (set_id, section, ordinal, body) values
        (sid, 'duties', 2,
         'You shall direct the office named in your letter, and are answerable for the '
         'accuracy and integrity of the records it keeps. You shall not alter a student '
         'record, an admission decision or an examination result except under the '
         'University''s regulations and with the authority they require.'),
        (sid, 'confidentiality', 2,
         'You have access to the University''s student and examination records as a '
         'condition of this post. Accessing a record for any purpose other than your '
         'duties, or disclosing one outside them, is gross misconduct.');

    elsif fam = 'administration' then
      insert into appointment_condition_clauses (set_id, section, ordinal, body) values
        (sid, 'duties', 2,
         'You shall direct the office named in your letter and account to the '
         'Vice-Chancellor for its work. You shall commit the University''s funds only '
         'within limits delegated to you in writing.'),
        (sid, 'conduct', 2,
         'You shall declare in writing any interest, direct or indirect, in a supplier, '
         'contractor or applicant, and shall take no part in a decision in which you have '
         'declared an interest.');

    elsif fam = 'student-services' then
      insert into appointment_condition_clauses (set_id, section, ordinal, body) values
        (sid, 'duties', 2,
         'You shall support students in the matters assigned to your office and shall '
         'observe the University''s safeguarding policy. You shall refer to the appropriate '
         'officer any matter concerning a student''s safety or welfare that is beyond your '
         'authority to resolve.'),
        (sid, 'confidentiality', 2,
         'Information a student gives you in confidence is to be kept in confidence, except '
         'where disclosure is necessary to protect that student or another person from harm, '
         'or where the law requires it.');

    elsif fam = 'ict' then
      insert into appointment_condition_clauses (set_id, section, ordinal, body) values
        (sid, 'duties', 2,
         'You shall maintain the University''s systems and the security of the data they '
         'hold, and shall follow its change-control and information-security policies.'),
        (sid, 'confidentiality', 2,
         'Administrative access to the University''s systems is given to you for the '
         'discharge of your duties alone. Reading, copying, altering or disclosing data for '
         'any other purpose is gross misconduct, whether or not the data is used.');

    else
      insert into appointment_condition_clauses (set_id, section, ordinal, body) values
        (sid, 'duties', 2,
         'You shall perform the duties of the post as set out in its job description and as '
         'assigned by the officer to whom you report.');
    end if;

  end loop;
end $$;


-- ===========================================================================
-- 6. WHERE THE POSTS ARE HELD
-- ===========================================================================
--
-- THE UNIVERSITY'S OWN PUBLISHED ADDRESS, not an invented campus. Every post
-- had `duty_station` null, so a letter carried no place of duty unless
-- somebody typed one — and a contract without a place of duty is one the
-- post-holder cannot enforce.
--
-- ONLY WHERE IT IS NULL. A station the University has since set is left alone,
-- which is also what makes a second run of this bundle a no-op.

update positions
   set duty_station = 'Opposite Bulu Blind Junction, Buea-Cameroon'
 where duty_station is null;


-- ===========================================================================
-- 7. PROVE IT, AND ROLL IT BACK
-- ===========================================================================

do $$
declare
  someone  uuid;
  sid      uuid;
  pos_id   uuid;
  refused  boolean;
  n        integer;
begin
  select id into someone from auth.users order by created_at limit 1;
  select id into pos_id from positions where job_code = 'ACA-DAA';

  -- ---- A SET BELONGS TO A POST OR A FAMILY, NEVER BOTH OR NEITHER --------
  refused := false;
  begin
    insert into appointment_condition_sets (position_id, family)
    values (pos_id, 'academic-administration');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '078 FAILED: a condition set belonged to a post and a family at once, so '
                    'it is inherited by itself';
  end if;

  refused := false;
  begin
    insert into appointment_condition_sets (version) values (1);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '078 FAILED: a condition set belonging to nothing was accepted';
  end if;

  -- ---- A SET A PERSON WROTE IS NOT ACTIVE UNTIL SOMEBODY ACTIVATES IT ----
  if someone is not null then
    -- THE NEXT FREE VERSION, NOT VERSION 1. `version_per_post_idx` is unique
    -- per post, so a hard-coded 1 collides with a version 1 the University has
    -- written for this post — the same class of fault that stopped 044 on the
    -- live database, where a proof competed for a value the University's own
    -- data occupies.
    select coalesce(max(version), 0) + 1 into n
      from appointment_condition_sets where position_id = pos_id;

    insert into appointment_condition_sets (position_id, version, status, created_by)
    values (pos_id, n, 'draft', someone)
    returning id into sid;

    refused := false;
    begin
      update appointment_condition_sets set status = 'active' where id = sid;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '078 FAILED: conditions somebody wrote went active with nobody '
                      'activating them';
    end if;

    refused := false;
    begin
      update appointment_condition_sets
         set status = 'active', activated_by = someone, activated_at = now()
       where id = sid;
    exception when others then refused := true;
    end;
    if not refused then
      raise exception '078 FAILED: somebody activated the conditions they wrote themselves';
    end if;
  end if;

  -- ---- A CLAUSE OF FIVE WORDS IS NOT A CLAUSE ---------------------------
  select id into sid from appointment_condition_sets
   where family = 'academic-administration' and status = 'active';

  refused := false;
  begin
    insert into appointment_condition_clauses (set_id, section, ordinal, body)
    values (sid, 'notice', 99, 'as agreed');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '078 FAILED: a nine-character clause was accepted as a condition of '
                    'appointment';
  end if;

  -- ---- AND THE ONE THAT IS THE POINT: EVERY POST NOW HAS CONDITIONS -----
  select count(*) into n
    from positions p
   where not exists (select 1 from position_default_conditions d
                      where d.position_id = p.id);
  if n > 0 then
    raise exception '078 FAILED: % post(s) in the register still have no conditions of '
                    'appointment', n;
  end if;

  select count(*) into n from positions where duty_station is null;
  if n > 0 then
    raise exception '078 FAILED: % post(s) still have no place of duty', n;
  end if;

  -- ---- A POST'S OWN SECTION REPLACES ITS FAMILY'S, AND ONLY THAT ONE ----
  --
  -- The rule the letter and the screen must agree about. Proved by writing a
  -- post-specific `notice` and watching the family's `notice` disappear while
  -- the family's `leave` stays.
  --
  -- FIRST, GET OUT OF THE UNIVERSITY'S WAY — the fault 044 was stopped by on
  -- the live database, which this migration had too. `one_active_per_post_idx`
  -- permits one active set per post, and the moment the University gives the
  -- Director of Academic Affairs conditions of their own through the
  -- Conditions of appointment screen, this insert collides with it and the
  -- migration fails on a database where nothing is wrong.
  --
  -- The version is chosen rather than assumed for the same reason: a
  -- hard-coded 2 collides with a version 2 the University has written.
  -- Everything here rolls back, so their set is active again the moment the
  -- proof ends.
  update appointment_condition_sets set status = 'superseded'
   where position_id = pos_id and status = 'active';

  select coalesce(max(version), 0) + 1 into n
    from appointment_condition_sets where position_id = pos_id;

  insert into appointment_condition_sets (position_id, version, status, effective_from)
  values (pos_id, n, 'active', current_date)
  returning id into sid;

  insert into appointment_condition_clauses (set_id, section, ordinal, body)
  values (sid, 'notice', 1,
    'Either party may end this appointment on six months'' written notice.');

  select count(*) into n from position_default_conditions
   where position_id = pos_id and section = 'notice';
  if n <> 1 then
    raise exception '078 FAILED: a post with its own notice clause resolved to % of them, '
                    'not one', n;
  end if;

  select count(*) into n from position_default_conditions
   where position_id = pos_id and section = 'notice' and source = 'position';
  if n <> 1 then
    raise exception '078 FAILED: the post''s own notice clause did not replace its '
                    'family''s';
  end if;

  select count(*) into n from position_default_conditions
   where position_id = pos_id and section = 'leave' and source = 'family';
  if n < 1 then
    raise exception '078 FAILED: a post that states its own notice period lost its '
                    'family''s leave clause, so the inheritance merges instead of '
                    'replacing section by section';
  end if;

  raise exception 'ROLLBACK 078 PROOF';
exception
  when others then
    if sqlerrm <> 'ROLLBACK 078 PROOF' then raise; end if;
end $$;


do $$
begin
  raise notice '078 OK: every post in the register has conditions of appointment, inherited '
               'from its family and overridable post by post';
  raise notice '078 OK: a post''s own section replaces its family''s for that section and '
               'leaves every other section alone';
  raise notice '078 OK: conditions somebody wrote cannot go active until somebody else '
               'activates them';
  raise notice '078 OK: every post has a place of duty, and grade and employment category '
               'are left empty rather than invented';
end $$;
