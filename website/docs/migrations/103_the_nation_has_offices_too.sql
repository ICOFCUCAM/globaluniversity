-- ===========================================================================
-- 103 — THE NATIONAL TIER IS IN THE REGISTER OF POSITIONS
-- ===========================================================================
--
-- The University found this on the appointment screen: the post list offered
-- forty-three posts and not one of them was the National Rector.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS ACTUALLY MISSING
-- ---------------------------------------------------------------------------
--
-- Not a row. A WHOLE TIER.
--
-- 048 wrote the register of positions — forty-three posts across eight
-- families — and it is the University's central structure: the executive, the
-- registry, the four faculties, administration, student services, ICT,
-- academic staff. 097, 098 and 099 then built the national tier on top of it:
-- a `national-rector` role with its own capabilities, a
-- `national-financial-secretary` beside it, a register of nations, revenue
-- agreements, national expenditure, a Rector's dashboard, row-level security
-- that holds a Rector to their own country.
--
-- Nobody went back to 048. So the University has an office that can sign in,
-- hold authority over a nation's students and money, appear on the audit trail
-- — AND CANNOT BE APPOINTED, because the letter that appoints people is
-- written from a register that has never heard of it.
--
-- An appointment made without a post "falls back to the plainest wording and
-- carries no job description", which the screen says out loud. That is what
-- every National Rector ICOF has appointed has received.
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. TWO POSTS APPEAR IN THE APPOINTMENT SCREEN'S DROPDOWN — National Rector
--    and National Financial Secretary — under a new heading, National
--    Administrations. Choosing one fills the letter's title, unit, reporting
--    officer and ordinary terms, as it does for every other post.
--
-- 2. A NINTH FAMILY EXISTS: `national`. The families are how a job description
--    is inherited, and putting a National Rector in `executive` would have
--    given them the Vice-Chancellor's family clauses — including the one
--    requiring the Vice-Chancellor's prior approval for any commitment of
--    University funds, which is not how 098 and 099 divide national money.
--    The University's own book is explicit that the office "is distinct from
--    an ordinary recruitment representative, marketing agent or independent
--    education provider" and "operates as part of the university", so it is
--    its own family rather than a borrowed one.
--
-- 3. NOTHING IS ACTIVATED. The family profile and both post profiles land as
--    DRAFTS, exactly as 048's eight did, and no draft can reach an appointee.
--    Somebody must read them and somebody else must activate them. That is
--    048's rule and this does not make an exception of itself.
--
-- 4. NO EXISTING POST, PROFILE OR APPOINTMENT IS TOUCHED. `national` is a new
--    family, so the one-active-per-family slot it occupies was empty; NAT-REC
--    and NAT-FIN are new job codes. Nothing the University has activated is
--    competed for.
--
-- ---------------------------------------------------------------------------
-- WHERE THE WORDS COME FROM
-- ---------------------------------------------------------------------------
--
-- EVERY DUTY CLAUSE BELOW IS THE UNIVERSITY'S OWN, out of `The National
-- Rector` — the book ICOF wrote about the office, held in
-- `src/content/nationalRector.ts` and published on the Rector's shelf.
-- Chapter FOUR gives the Rector's six areas of responsibility by name;
-- chapter FIVE gives the office's standing; chapter NINETEEN gives the
-- Financial Secretary's duties as a list. Nothing here is invented, and where
-- the book is silent — the salary, the probation, the place of duty — this is
-- silent too.
--
-- THE TWO POSTS SEEDED ARE THE TWO THE SYSTEM HAS ROLES FOR. The book's
-- chapter TWENTY-EIGHT sketches a fuller national team — an Academic
-- Coordinator, Student Affairs, Admissions, Administration — but says of it
-- that "the precise structure depends on the size and requirements of the
-- National Administration", and none of those has a role, a capability or a
-- screen. Seeding them would be turning an illustration into an establishment.
--
-- ===========================================================================


-- ===========================================================================
-- 1. A NINTH FAMILY
-- ===========================================================================
--
-- THREE TABLES NAME THE FAMILIES, not one. `positions` (048),
-- `position_profiles` (048) and `appointment_condition_sets` (078) each carry
-- their own CHECK listing the eight, and widening one of them is how you
-- discover the other two — one at a time, each by a different failure.
--
-- So this finds them rather than naming them: every CHECK constraint in the
-- schema whose definition lists the families is rewritten to include
-- `national`, keeping its own name and its own null-handling. A future tenth
-- family widens all of them at once by the same means.
--
-- The constraints are REPLACED, not dropped. A family column with no
-- constraint would let a typo create a family of one post, inheriting no job
-- description and no conditions of appointment — which is the shape of the
-- fault this whole migration exists to fix.
-- ---------------------------------------------------------------------------

do $$
declare
  r        record;
  def      text;
  nullable boolean;
begin
  for r in
    select conrelid::regclass::text as tbl, conname, pg_get_constraintdef(oid) as def
      from pg_constraint
     where contype = 'c'
       and pg_get_constraintdef(oid) like '%executive%'
       and pg_get_constraintdef(oid) like '%academic-staff%'
       and pg_get_constraintdef(oid) not like '%national%'
  loop
    -- A CONSTRAINT THAT ALREADY PERMITS NULL KEEPS PERMITTING IT.
    -- `position_profiles.family` is null on a profile belonging to a post, and
    -- rewriting its check without the null arm would refuse every one of them.
    nullable := r.def like '%IS NULL%';

    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    def := format(
      'check (%s family in (''executive'', ''academic-administration'', '
      || '''faculty-leadership'', ''administration'', ''student-services'', ''ict'', '
      || '''academic-staff'', ''national'', ''other''))',
      case when nullable then 'family is null or' else '' end);
    execute format('alter table %s add constraint %I %s', r.tbl, r.conname, def);
    raise notice '103 OK  % now admits the national family', r.tbl;
  end loop;
end $$;


-- ===========================================================================
-- 2. THE TWO POSTS
-- ===========================================================================
--
-- `unit_name` is null on both, and deliberately. Every other post in the
-- register belongs to a standing unit — the Registry, the Library, Faculty of
-- Theology. A National Administration is named by its country, and the country
-- is not known until the appointment is written: "ICOF Global University —
-- National Administration of Uganda". Writing a unit here would put the wrong
-- country on every letter but one.
--
-- The Rector reports to the Vice-Chancellor because the office is the
-- University's senior representative in a nation and establishing a National
-- Administration is the centre's act, held by the Superadministrator alone.
-- The Financial Secretary reports to the Rector, which is where the book's own
-- diagram of the national team puts them.
-- ---------------------------------------------------------------------------

insert into positions (job_code, title, family, reports_to, unit_name) values
  ('NAT-REC', 'National Rector', 'national', 'Vice-Chancellor', null),
  ('NAT-FIN', 'National Financial Secretary', 'national', 'National Rector', null)
on conflict (job_code) do nothing;


-- ---------------------------------------------------------------------------
-- AND THE CHANCELLOR, WHO WAS MISSING FOR THE SAME REASON
-- ---------------------------------------------------------------------------
--
-- Not part of what the University asked about, and found by counting while
-- checking it: `chancellor` is a role with capabilities — the correspondence
-- chain, the executive dashboard, conferring an award — and there is no
-- Chancellor in the register either. 048 wrote the Vice-Chancellor, the Deputy
-- and Pro-Vice-Chancellors and the University Secretary, and stopped one above
-- the Vice-Chancellor.
--
-- NO JOB DESCRIPTION IS WRITTEN FOR IT, deliberately. 048 seeds a profile for
-- every FAMILY and for no post, so the Deputy Vice-Chancellor, the
-- Pro-Vice-Chancellor and the University Secretary all inherit the executive
-- family's and have none of their own. The Chancellor does the same. Writing
-- duties for the office would be the University's to do, not this migration's,
-- and nothing in the repository states them.
--
-- `reports_to` is 'The University Council', which is what 048 gives the
-- Vice-Chancellor. The unit name mirrors the Vice-Chancellor's and is the
-- easiest thing here for the University to change if it is wrong.
insert into positions (job_code, title, family, reports_to, unit_name) values
  ('EXE-CHAN', 'Chancellor', 'executive', 'The University Council', 'Office of the Chancellor')
on conflict (job_code) do nothing;

-- ALREADY THERE UNDER THE WRONG FAMILY? Move it. A database where somebody
-- added the post by hand before this ran should end in the same place as one
-- where nobody did.
update positions set family = 'national'
 where job_code in ('NAT-REC', 'NAT-FIN') and family <> 'national';


-- ===========================================================================
-- 3. THE FAMILY JOB DESCRIPTION — A DRAFT, LIKE THE OTHER EIGHT
-- ===========================================================================
--
-- The eight clauses every post in the University carries are 048's, repeated
-- here word for word so that a national post is not a post with fewer
-- obligations. The two that follow are the family's own and come from chapter
-- FIVE of the book.
-- ---------------------------------------------------------------------------

do $$
declare
  pid uuid;
begin
  if exists (select 1 from position_profiles where family = 'national' and position_id is null)
  then
    raise notice '103 --  the national family profile is already there; left alone';
    return;
  end if;

  insert into position_profiles (family, version, status, job_purpose)
  values ('national', 1, 'draft',
    'DRAFT FOR THE UNIVERSITY''S APPROVAL. This profile states the duties common to every '
    'post in a National Administration. A National Administration is the University operating '
    'within an approved nation, and an officer of one is an officer of ICOF Global University. '
    'It has not been approved and must not be attached to an appointment until it has been '
    'read and activated.')
  returning id into pid;

  -- ---- 048's eight, unchanged -------------------------------------------
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

  -- ---- AND WHAT DISTINGUISHES A NATIONAL POST ----------------------------
  --
  -- Chapter FIVE: the office "is distinct from an ordinary recruitment
  -- representative, marketing agent or independent education provider" and
  -- "operates as part of the university". That distinction is worth a clause,
  -- because it is the one a post-holder is most likely to be asked about in
  -- their own country.
  insert into position_profile_clauses (profile_id, section, ordinal, body) values
    (pid, 'institutional', 3,
     'A National Administration is part of ICOF Global University and not a separate '
     'institution, agency or recruitment business. The post-holder acts within the '
     'University''s academic governance, administrative systems, student systems, financial '
     'systems, policies and reporting structures, and may use only the institutional '
     'designation granted by ICOF.'),
    (pid, 'institutional', 4,
     'Protect the reputation, standards and interests of ICOF Global University within the '
     'nation.'),
    (pid, 'must-obtain-approval', 2,
     'The National Administration operates under the National Administration Agreement in '
     'force. Money is divided as that agreement provides and national expenditure is '
     'authorised as University policy provides; neither is varied locally.');

  raise notice '103 OK  the national family job description is seeded, as a draft';
end $$;


-- ===========================================================================
-- 4. THE NATIONAL RECTOR'S OWN CLAUSES
-- ===========================================================================
--
-- Chapter FOUR of the book, which names the six areas by name and defines each
-- in a sentence. The six are reproduced as six duties in the order the book
-- gives them.
--
-- A post's clauses REPLACE the family's for the section they are in and keep
-- the family's everywhere else, so these sit in `duties` and `authority`,
-- which the family profile above leaves empty.
-- ---------------------------------------------------------------------------

do $$
declare
  pos uuid;
  pid uuid;
begin
  select id into pos from positions where job_code = 'NAT-REC';
  if pos is null then
    raise exception '103 FAILED — NAT-REC was not created';
  end if;
  if exists (select 1 from position_profiles where position_id = pos) then
    raise notice '103 --  the National Rector already has a job description; left alone';
    return;
  end if;

  insert into position_profiles (position_id, version, status, job_purpose)
  values (pos, 1, 'draft',
    'DRAFT FOR THE UNIVERSITY''S APPROVAL. The National Rector is the senior representative '
    'of ICOF Global University within an approved nation. The office combines institutional '
    'administration and academic leadership, and is responsible for developing the ICOF '
    'presence within the nation and for leading the National Administration according to '
    'University policy and the National Administration Agreement.')
  returning id into pid;

  insert into position_profile_clauses (profile_id, section, ordinal, body) values
    (pid, 'key-responsibilities', 1,
     'Institutional leadership. Lead the national operation and establish its organizational '
     'structure.'),
    (pid, 'key-responsibilities', 2,
     'Student development. Develop the national student community and oversee its local '
     'administration and support.'),
    (pid, 'key-responsibilities', 3,
     'Academic leadership. Participate in academic activities, and teach or supervise '
     'students where appropriately qualified and separately appointed to do so.'),
    (pid, 'key-responsibilities', 4,
     'Staff development. Develop the national team and recommend qualified individuals for '
     'appointment.'),
    (pid, 'key-responsibilities', 5,
     'National representation. Represent ICOF Global University within approved national '
     'relationships and activities.'),
    (pid, 'key-responsibilities', 6,
     'Institutional growth. Develop the National Administration from its initial '
     'establishment into a sustainable national academic community.'),
    -- ---- AND WHAT THE SYSTEM ACTUALLY REFUSES THEM -----------------------
    --
    -- Written from 097, 098 and 099 rather than from the book, because a job
    -- description that describes an authority the database withholds is a job
    -- description that will be quoted back at the University.
    (pid, 'institutional', 1,
     'The Rector''s authority runs to one National Administration — their own. Students, '
     'payments, staff and records of another nation are not within the office, and the '
     'University''s systems refuse them rather than merely discouraging access.'),
    (pid, 'may-recommend', 1,
     'National expenditure, and qualified individuals for appointment to the national team.'),
    (pid, 'must-obtain-approval', 1,
     'National expenditure is recommended by the Rector and authorised centrally; it is not '
     'the Rector''s to authorise. The revenue agreement that pays the Rector''s own National '
     'Administration cannot be approved by that Rector. Both separations are enforced by the '
     'University''s systems and not only by this document.'),
    (pid, 'must-obtain-approval', 2,
     'Issuing a University credential — a transcript, a certificate or an academic record — '
     'is not within the office. Those are issued centrally, by the offices the University '
     'has named for them.');

  raise notice '103 OK  the National Rector''s job description is seeded, as a draft';
end $$;


-- ===========================================================================
-- 5. THE NATIONAL FINANCIAL SECRETARY'S
-- ===========================================================================
--
-- Chapter NINETEEN, which gives the duties as a list of fourteen. They are
-- grouped here rather than reproduced as fourteen one-line clauses, because a
-- job description printed onto a letter is read by a person.
-- ---------------------------------------------------------------------------

do $$
declare
  pos uuid;
  pid uuid;
begin
  select id into pos from positions where job_code = 'NAT-FIN';
  if pos is null then
    raise exception '103 FAILED — NAT-FIN was not created';
  end if;
  if exists (select 1 from position_profiles where position_id = pos) then
    raise notice '103 --  the Financial Secretary already has a job description; left alone';
    return;
  end if;

  insert into position_profiles (position_id, version, status, job_purpose)
  values (pos, 1, 'draft',
    'DRAFT FOR THE UNIVERSITY''S APPROVAL. The National Financial Secretary is the '
    'professional financial function of a National Administration, combining national '
    'operational responsibility with institutional accountability to central finance.')
  returning id into pid;

  insert into position_profile_clauses (profile_id, section, ordinal, body) values
    (pid, 'key-responsibilities', 1,
     'Tuition reconciliation, payment records, receipts and financial documentation for the '
     'National Administration.'),
    (pid, 'key-responsibilities', 2,
     'National expenses, approved staff payments and budgets.'),
    (pid, 'key-responsibilities', 3,
     'Student account reconciliation, outstanding tuition and approved refunds.'),
    (pid, 'key-responsibilities', 4,
     'Banking administration, audit preparation, financial reports, and reporting to central '
     'finance.'),
    (pid, 'financial', 1,
     'Financial authority within a National Administration is separated sufficiently to '
     'protect the administration and its officers. The Secretary keeps the record and does '
     'not authorise the expenditure they record.'),
    (pid, 'compliance', 1,
     'A payment recorded by the University is never afterwards edited or deleted by any '
     'office, including this one. A correction is a further transaction and both stay '
     'readable.');

  raise notice '103 OK  the National Financial Secretary''s job description is seeded, as a draft';
end $$;


-- ===========================================================================
-- 5b. A FAMILY NEEDS MORE THAN A NAME: CONDITIONS, AND A PLACE OF DUTY
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- THE SAME OMISSION, ONE LAYER DOWN
-- ---------------------------------------------------------------------------
--
-- This migration existed because 097–099 added a tier and did not go back to
-- 048. It then added a family and did not go back to 078 — which holds, as its
-- closing assertion, that EVERY post in the register has conditions of
-- appointment and a place of duty.
--
-- 078 seeds those conditions PER FAMILY, and `position_default_conditions`
-- resolves a post's conditions from its own set or its family's. A post in a
-- family 078 never heard of resolves to nothing, so the National Rector would
-- have been appointable on no conditions at all.
--
-- Four clean runs of this migration did not find it. The upgrade test did, by
-- replaying the whole bundle in one transaction on a database that had already
-- run it once — which is the only arrangement in which 078 re-checks a
-- register 103 has already extended.
--
-- ---------------------------------------------------------------------------
-- THE CLAUSES ARE COPIED, NOT WRITTEN
-- ---------------------------------------------------------------------------
--
-- From whatever the University has ACTIVE for the executive family — not from
-- a copy of 078's text pasted here. If they have since edited their conditions
-- of appointment, the national set carries the edit; a second copy of the
-- original would have drifted from their policy the first time they changed it.
--
-- The executive family is the source because a National Rector holds an office
-- and exercises its powers, which is what that family's own clauses say.
-- ---------------------------------------------------------------------------

do $$
declare
  src uuid;
  sid uuid;
begin
  if exists (select 1 from appointment_condition_sets where family = 'national') then
    raise notice '103 --  the national conditions of appointment are already there; left alone';
  else
    select id into src from appointment_condition_sets
     where family = 'executive' and status = 'active' limit 1;

    if src is null then
      -- 078 HAS NOT RUN. Nothing to copy and nothing to do; the bundle runs
      -- 078 before this, and a database without it has no register either.
      raise notice '103 --  078 has not run, so there is nothing to copy conditions from';
    else
      insert into appointment_condition_sets (family, version, status, effective_from, preamble)
      select 'national', 1, 'active', current_date, preamble
        from appointment_condition_sets where id = src
      returning id into sid;

      insert into appointment_condition_clauses (set_id, section, ordinal, body)
      select sid, c.section, c.ordinal, c.body
        from appointment_condition_clauses c where c.set_id = src;

      -- ---- AND THE THREE THAT ARE THE NATION'S OWN ---------------------
      --
      -- From the University's book, and from what 097–099 actually enforce.
      -- THE ORDINAL IS COMPUTED, NOT GUESSED. The set just copied already
      -- carries the executive family's own clauses at `duties 2` and
      -- `outside-work 2`, and writing a literal 2 or 3 here collided with them
      -- — which the harness caught and reading would not have. Each clause
      -- takes the next free ordinal in its own section, so it stays correct
      -- whatever the University has since added to the set it was copied from.
      insert into appointment_condition_clauses (set_id, section, ordinal, body)
      select sid, v.section,
             (select coalesce(max(c.ordinal), 0) + 1
                from appointment_condition_clauses c
               where c.set_id = sid and c.section = v.section),
             v.body
        from (values
          ('duties',
           'You are appointed to one National Administration, named in your letter of '
           'appointment. Your authority under this appointment extends to that National '
           'Administration and to no other, and the University''s systems enforce that '
           'separation rather than relying on it being observed.'),
          ('appointment',
           'The National Administration operates under the National Administration Agreement '
           'in force. Revenue is divided as that Agreement provides and national expenditure '
           'is authorised as University policy provides. Neither is varied locally, and an '
           'agreement that pays a National Administration is not approved by an officer of '
           'that administration.'),
          ('outside-work',
           'You shall not hold an office, agency or interest in another education provider '
           'operating in the same nation without the written consent of the University. Your '
           'office is the University''s presence in that nation, and a competing interest in '
           'it is not compatible with holding the office.')
        ) as v(section, body);

      raise notice '103 OK  the national family has conditions of appointment, copied from '
                   'the executive set the University has in force';
    end if;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- AND A PLACE OF DUTY, which 078 also requires of every post.
--
-- THE NATIONAL POSTS DO NOT SIT IN BUEA. 078 filled every null `duty_station`
-- with the University's central address, which is right for a central post and
-- wrong for an office whose whole purpose is to be somewhere else. The place
-- of duty of a national post is the National Administration, and which one is
-- not known until the letter is written — the same reason `unit_name` is null
-- on both.
--
-- The Chancellor takes whatever the Vice-Chancellor has, read from the row
-- rather than written here: if the University has moved, both move together,
-- and the address does not get a second copy in this repository.
-- ---------------------------------------------------------------------------

update positions
   set duty_station = 'The National Administration named in the letter of appointment'
 where job_code in ('NAT-REC', 'NAT-FIN') and duty_station is null;

update positions p
   set duty_station = (select duty_station from positions where job_code = 'EXE-VC')
 where p.job_code = 'EXE-CHAN' and p.duty_station is null;


-- ===========================================================================
-- 6. THE PROOF
-- ===========================================================================

do $$
declare
  seen      integer;
  refused   boolean;
  pos       uuid;
  t         text;
  activator uuid := gen_random_uuid();
begin
  -- ---- THE POSTS ARE IN THE REGISTER -------------------------------------
  select count(*) into seen from positions where job_code in ('NAT-REC', 'NAT-FIN');
  if seen <> 2 then
    raise exception '103 FAILED — % of the two national posts are in the register', seen;
  end if;
  raise notice '103 OK  the National Rector and the National Financial Secretary are posts';

  select count(*) into seen from positions where job_code = 'EXE-CHAN';
  if seen <> 1 then
    raise exception '103 FAILED — the Chancellor is still not in the register';
  end if;
  -- AND IT INHERITS, having no description of its own — the same as the Deputy
  -- Vice-Chancellor and the University Secretary beside it.
  if exists (select 1 from position_profiles pp join positions p on p.id = pp.position_id
              where p.job_code = 'EXE-CHAN') then
    raise exception '103 FAILED — a job description was written for the Chancellor, which is '
                    'the University''s to write and not this migration''s';
  end if;
  raise notice '103 OK  the Chancellor is a post too, inheriting the executive family''s '
               'description and carrying no invented duties';

  select family into t from positions where job_code = 'NAT-REC';
  if t <> 'national' then
    raise exception '103 FAILED — the National Rector landed in the % family', t;
  end if;
  raise notice '103 OK  …in a family of their own, not borrowed from the executive';

  -- ---- AND THE FAMILY IS STILL A CLOSED LIST -----------------------------
  --
  -- Prove a guard by breaking it. Widening a constraint is the kind of change
  -- that quietly becomes no constraint at all.
  refused := false;
  begin
    insert into positions (job_code, title, family)
      values ('ZZZ-103', 'A Proof Post 103', 'natoinal');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '103 FAILED — a post was created in a family that does not exist';
  end if;
  raise notice '103 OK  a misspelt family is still refused';

  -- ---- NOTHING IS ACTIVE -------------------------------------------------
  select count(*) into seen
    from position_profiles pp
    left join positions p on p.id = pp.position_id
   where (pp.family = 'national' or p.job_code in ('NAT-REC', 'NAT-FIN'))
     and pp.status = 'active';
  if seen <> 0 then
    raise exception '103 FAILED — % national job descriptions landed ACTIVE', seen;
  end if;
  raise notice '103 OK  every national job description is a draft and can reach nobody';

  -- ---- THE RESOLVED DESCRIPTION IS THE FAMILY'S PLUS THE POST'S ----------
  --
  -- The inheritance is the whole point of 048's design, so it is watched
  -- working rather than assumed. A national post must carry the University's
  -- eight common clauses AND its own duties.
  select id into pos from positions where job_code = 'NAT-REC';

  -- Activated only inside the rollback, so the resolution can be observed at
  -- all — `position_job_description` reads active profiles. The University's
  -- own data is not competed for: `national` is a new family and NAT-REC a new
  -- post, so both slots were empty before this migration created them.
  --
  -- AND ACTIVATION IS NOT A STATUS COLUMN. 048 holds `activated_by` and
  -- `activated_at` to be present on any active profile, and holds the
  -- activator to be somebody other than the author. Setting the status alone
  -- is refused, which is the rule working; this proof is not entitled to an
  -- exception from it, so it names an activator of its own.
  insert into auth.users (id, email) values (activator, 'proof-103@example.invalid');
  insert into profiles (id, email, full_name, role)
    values (activator, 'proof-103@example.invalid', 'Proof Activator 103', 'superadmin')
  on conflict (id) do update set role = excluded.role;

  update position_profiles
     set status = 'active', activated_by = activator, activated_at = now()
   where family = 'national' and position_id is null;
  update position_profiles
     set status = 'active', activated_by = activator, activated_at = now()
   where position_id = pos;

  select count(*) into seen from position_job_description
   where position_id = pos and section = 'key-responsibilities';
  if seen <> 6 then
    raise exception '103 FAILED — the Rector resolved to % duties, not the book''s six', seen;
  end if;

  select count(*) into seen from position_job_description
   where position_id = pos and section = 'confidentiality';
  if seen < 1 then
    raise exception '103 FAILED — a national post inherited no confidentiality clause';
  end if;
  raise notice '103 OK  a national post inherits the University''s common clauses and adds '
               'the office''s own';

  -- ---- 078'S INVARIANT STILL HOLDS ---------------------------------------
  --
  -- The assertion this migration broke on its first pass through the upgrade
  -- test: every post in the register has conditions of appointment, and every
  -- post has a place of duty. Checked here as well as in 078 so that the
  -- migration that ADDS posts is the one that proves it did not break it.
  select count(*) into seen
    from positions p
   where not exists (select 1 from position_default_conditions d
                      where d.position_id = p.id);
  if seen > 0 then
    raise exception '103 FAILED — % post(s) in the register have no conditions of '
                    'appointment', seen;
  end if;
  select count(*) into seen from positions where duty_station is null;
  if seen > 0 then
    raise exception '103 FAILED — % post(s) have no place of duty', seen;
  end if;
  raise notice '103 OK  every post in the register still has conditions of appointment and '
               'a place of duty, the three new ones included';

  -- AND THE NATIONAL POSTS ARE NOT POSTED TO THE CENTRE. 078 fills a null
  -- place of duty with the University's own address, which is right for a
  -- central post and wrong for an office whose purpose is to be elsewhere.
  select duty_station into t from positions where job_code = 'NAT-REC';
  if t is distinct from 'The National Administration named in the letter of appointment' then
    raise exception '103 FAILED — the National Rector''s place of duty is "%"', t;
  end if;
  raise notice '103 OK  …and a National Rector is not posted to the central campus';

  raise exception 'ROLLBACK 103';
exception
  when others then
    if sqlerrm = 'ROLLBACK 103' then
      raise notice '103 OK  the proof rolled back; the drafts seeded above are still drafts';
    else
      raise;
    end if;
end $$;


-- ===========================================================================
-- 7. DONE
-- ===========================================================================
do $$
begin
  raise notice '103 APPLIED  the National Rector and the National Financial Secretary can '
               'now be appointed by letter, with a job description drawn from the '
               'University''s own book. Both descriptions are DRAFTS and must be read and '
               'activated before an appointment can carry one.';
end $$;
