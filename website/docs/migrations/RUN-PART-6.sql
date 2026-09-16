-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — MIGRATIONS 097, 098, IN ORDER
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-migration-run.mjs
--   Rebuild:   node scripts/build-migration-run.mjs --out=RUN-PART-6.sql 097 098
--
-- ---------------------------------------------------------------------------
-- HOW TO RUN IT
--
-- Supabase SQL editor: paste the whole file and run once.
-- psql:                psql "<connection string>" -f docs/migrations/RUN-PART-6.sql
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
--   097_a_nation_the_university_can_see.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 097 — A NATION THE UNIVERSITY CAN SEE
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. NATIONAL ADMINISTRATIONS BECOME A THING THE DATABASE KNOWS ABOUT.
--    `national_administrations` is created and IS EMPTY. This migration does
--    not establish a single one; it makes it possible for the University to.
--
-- 2. AN ADMINISTRATION CANNOT BE MARKED `established` WITHOUT TWO THINGS: the
--    agreement it operates under, and the appointment its Rector holds.
--    This is a closed door, and it is the point of the file. The programme
--    calls for a National Administration Agreement; this refuses to let one be
--    forgotten. A `proposed` administration needs neither, so the University
--    can still write a country down while the agreement is being drafted.
--
-- 3. WHOEVER CREATES AN ADMINISTRATION MAY NOT BE ITS RECTOR. The same rule
--    041 applies to appointments and 045 to correspondence: the office that
--    prepares is not the office that benefits.
--
-- 4. SEVEN TABLES GAIN `administration_id`, NULLABLE, AND EVERY EXISTING ROW
--    KEEPS A NULL. Nothing that works today changes. A row with no
--    administration is a row the centre administers, which is what every row
--    in this database is until somebody says otherwise.
--
-- 5. A NATIONAL RECTOR SEES THEIR OWN NATION AND NO OTHER. Enforced in
--    row-level security rather than in a screen — see below, it is the whole
--    argument of this file.
--
-- 6. TWO ROLES EXIST THAT DID NOT: `national-rector` and
--    `national-financial-secretary`. Neither can be assigned to anybody by
--    this migration; `assign-roles` is still the Superadministrator's.
--
-- WHAT DOES NOT CHANGE, AND MUST NOT:
--
--   A National Rector gets NO degree authority, NO admission decision, NO
--   curriculum approval and NO credential issuance. The programme is explicit
--   — "The National Rector does not become an independent registrar,
--   degree-awarding authority or academic authority outside ICOF's statutes"
--   — and nothing below grants any of them.
--
-- ---------------------------------------------------------------------------
-- WHY THE SCOPING IS IN ROW-LEVEL SECURITY AND NOT IN THE SCREENS
-- ---------------------------------------------------------------------------
--
-- "A Rector sees their own nation's students" is a question about a ROW. This
-- codebase has learned that distinction expensively and written it down:
-- a POLICY decides about a row, a TRIGGER decides about a column, and
-- row-level security cannot hide a column at all.
--
-- Put the scoping in the screens and it holds until somebody adds a screen, or
-- a report, or an export, and forgets. Put it here and a forgotten screen
-- returns an empty list instead of another country's students. The failure
-- mode of the first is a data breach; of the second, a bug report.
--
-- ---------------------------------------------------------------------------
-- AND WHY THE NEW POLICIES ARE ADDED RATHER THAN THE OLD ONES REWRITTEN
-- ---------------------------------------------------------------------------
--
-- Postgres ORs the permissive policies on a table. So a new
-- `students_national_read` beside the existing `students_staff_read` WIDENS
-- the door for a Rector and leaves every existing office exactly as it was.
--
-- Rewriting the existing policy to add one more case would have put every
-- office in this University behind a single statement that this file touched —
-- and the first mistake in it would lock out the Registrar. Additive is not
-- laziness here; it is the smaller blast radius.
-- ===========================================================================


-- ===========================================================================
-- 1. THE TWO ROLES
-- ===========================================================================
--
-- REPLACED, NOT WIDENED IN PLACE. A CHECK constraint cannot have a value added
-- to it; it is dropped and written again with the longer list. 056 did the
-- same thing for the same reason, and its note applies here: every value
-- already there stays, so no existing row is invalidated.
--
-- `src/lib/schemaContract.test.mjs` compares this list against `roles.ts` on
-- every run, so a role added to one has to be added to the other.

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
      'exam-officer', 'moderator', 'examiner', 'invigilator',
      'lecturer', 'finance', 'admissions-officer', 'library-staff',
      'student-affairs',
      'hr-officer', 'hr-administrator',
      -- ---------------------------------------------------------------
      -- THE NATIONAL OFFICES. New here.
      --
      -- A National Rector is an officer OF THIS UNIVERSITY holding its
      -- authority within one nation — not an agent, not a franchisee. The
      -- Financial Secretary is the second of the two, and exists as its own
      -- role rather than as `finance` with a nation attached because the
      -- programme asks for financial authority to be SEPARATED from the
      -- Rector's, and two people cannot be separated while they share a role.
      -- ---------------------------------------------------------------
      'national-rector', 'national-financial-secretary',
      'student', 'applicant',
      'academic-office'
    ));
end $$;


-- ===========================================================================
-- 2. THE REGISTER OF NATIONAL ADMINISTRATIONS
-- ===========================================================================

create table if not exists national_administrations (
  id          uuid primary key default gen_random_uuid(),

  -- ---- Which nation -------------------------------------------------------
  --
  -- The country as the University writes it, and nothing more. NOT a lookup
  -- against a list of the world's countries: this University teaches where it
  -- teaches, `universityPlaces.json` already refuses to overstate a presence,
  -- and a table of 195 rows of which two are used is a table nobody maintains.
  country     text not null check (length(btrim(country)) between 2 and 80),

  -- What it is called on a letterhead: "ICOF Global University — National
  -- Administration of Uganda". Stored rather than composed, because the
  -- University may want a form of words this system did not think of.
  name        text not null check (length(btrim(name)) between 6 and 160),

  -- ---- Where it stands ----------------------------------------------------
  --
  -- `proposed`     a country written down; no agreement yet, no authority yet
  -- `established`  operating, under an agreement, with a Rector in post
  -- `suspended`    its authority withdrawn, its records intact
  -- `closed`       finished. The country may be proposed again as a new row.
  status      text not null default 'proposed'
              check (status in ('proposed', 'established', 'suspended', 'closed')),

  -- ---- Who leads it -------------------------------------------------------
  rector_id   uuid references auth.users (id) on delete restrict,

  -- THE APPOINTMENT THE RECTOR HOLDS, and it is not decoration.
  --
  -- 047 refuses an appointment to be marked issued with no document behind it,
  -- for the reason that an authority nobody can produce a letter for is an
  -- authority the University cannot defend. A National Rector's authority is
  -- larger than most appointments in this system — it reaches a nation's
  -- students, its staff and its money — so it traces to an appointment, and
  -- the appointment traces to an issued letter, all the way down.
  rector_appointment_id uuid references appointments (id) on delete restrict,

  -- ---- What it operates under ---------------------------------------------
  --
  -- The National Administration Agreement, by reference. The programme's own
  -- closing recommendation and the thing this file refuses to let anybody
  -- forget. See section 3.
  agreement_reference text check (agreement_reference is null
                                  or length(btrim(agreement_reference)) between 3 and 120),
  agreement_dated_on  date,

  established_on  date,
  note            text,

  -- ---- Who wrote it down --------------------------------------------------
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- =======================================================================
  -- AN ESTABLISHED ADMINISTRATION HAS AN AGREEMENT AND A RECTOR IN POST.
  -- =======================================================================
  --
  -- This is the door. A `proposed` row needs neither, so a country can be
  -- written down on the day somebody first raises it; the moment it is
  -- `established` — which is the moment it starts recruiting students and
  -- receiving money — both must be there.
  constraint national_administration_established_has_an_agreement
    check (status <> 'established'
           or (agreement_reference is not null
               and rector_id is not null
               and rector_appointment_id is not null)),

  -- =======================================================================
  -- AND WHOEVER WROTE IT DOWN IS NOT THE PERSON IT PUTS IN CHARGE.
  -- =======================================================================
  --
  -- 041 refuses an appointment authorised by its own drafter and 045 refuses a
  -- letter authorised by whoever prepared it. An administration somebody
  -- created and then made themselves Rector of is the same act wearing a
  -- third hat, and it is the one that hands a person a country.
  constraint national_administration_creator_is_not_the_rector
    check (rector_id is null or created_by is null or rector_id <> created_by)
);

comment on table national_administrations is
  'The nations ICOF Global University operates through. One row per National '
  'Administration. Empty until the University establishes one.';

-- ONE LIVE ADMINISTRATION PER COUNTRY. A closed one does not hold the slot —
-- a country that once had an administration may have another.
create unique index if not exists national_administrations_one_per_country
  on national_administrations (lower(btrim(country)))
  where status <> 'closed';

-- AND ONE PER RECTOR. The programme describes a person who builds a national
-- academic community; two at once is not that, and the first sign of it would
-- be a Rector's dashboard showing two countries' students added together.
create unique index if not exists national_administrations_one_per_rector
  on national_administrations (rector_id)
  where rector_id is not null and status <> 'closed';

create index if not exists national_administrations_status_idx
  on national_administrations (status);

drop trigger if exists national_administrations_touch on national_administrations;
create trigger national_administrations_touch
  before update on national_administrations
  for each row execute function set_updated_at();


-- ===========================================================================
-- 3. THE ROWS THAT CARRY A NATION
-- ===========================================================================
--
-- NULLABLE, EVERY ONE. A null means "the centre administers this", which is
-- what every row in this database is on the day this runs. Making it NOT NULL
-- would require a nation for every student the University has ever admitted,
-- and there is no true answer to give.
--
-- ADDED INSIDE A GUARD because not every deployment has every table — a
-- database landed from 001 upward has them all, but a column added to a table
-- that is not there stops the whole file, and the University runs these in a
-- SQL editor where a failure halfway is the worst outcome.

do $$
declare
  t text;
begin
  foreach t in array array[
    -- WHO THE NATION RECRUITED AND TEACHES. An application and a student are
    -- one row in this schema at two stages (037), so this single column
    -- carries both "recruited by" and "enrolled through".
    'students',
    -- WHOSE ACCOUNT BELONGS TO THE NATION. The Rector's own, the Financial
    -- Secretary's, and every national officer's. This is what
    -- `my_administration()` reads for somebody who is not the Rector.
    'profiles',
    -- WHOM THE NATION RECOMMENDED. The appointment is still the University's
    -- to make — 041 is untouched — but the nation it was made for is recorded.
    'appointments',
    'staff_records',
    -- WHAT THE NATION TOOK AND WHAT IT CHARGED.
    'payments',
    'student_fee_assessments',
    -- WHAT THE NATION WROTE. A Rector's letters are the University speaking in
    -- that country.
    'correspondence'
  ] loop
    if exists (select 1 from information_schema.tables
               where table_schema = 'public' and table_name = t) then
      execute format(
        'alter table %I add column if not exists administration_id uuid '
        'references national_administrations (id) on delete restrict', t);
      execute format(
        'create index if not exists %I on %I (administration_id) '
        'where administration_id is not null',
        t || '_administration_idx', t);
    end if;
  end loop;
end $$;


-- ===========================================================================
-- 4. WHICH NATION THE CALLER BELONGS TO
-- ===========================================================================

-- THE ADMINISTRATION THIS CALLER LEADS OR SERVES.
--
-- Two ways to belong to a nation, and the order matters. A Rector is found by
-- the register — `rector_id` is the appointment, and it is the authoritative
-- statement of who leads what. Everybody else is found by their profile, which
-- is where a national officer is attached.
--
-- The Rector is looked up FIRST so that a Rector whose profile was never
-- stamped still leads their nation: the register is the fact, the profile is
-- the convenience.
create or replace function my_administration()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select id from national_administrations
      where rector_id = auth.uid() and status <> 'closed'
      limit 1),
    (select administration_id from profiles where id = auth.uid())
  );
$$;

revoke all on function my_administration() from public;
grant execute on function my_administration() to authenticated;

-- WHETHER THIS CALLER ANSWERS TO A NATION AT ALL.
create or replace function serves_a_national_administration()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select my_administration() is not null;
$$;

revoke all on function serves_a_national_administration() from public;
grant execute on function serves_a_national_administration() to authenticated;

-- THE CENTRE.
--
-- The offices that see the whole University and always did. Named once here so
-- that the policies below and the trigger in section 5 cannot drift apart —
-- which is exactly what happened to `governs_the_curriculum` in 092 before it
-- was given a function of its own.
--
-- `auth.uid() is null` is the SERVER acting with the service key — a migration,
-- a restore, or a route that has already made this decision. A browser session
-- always has a uid, so this does not open a door to one.
create or replace function governs_the_university()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is null
      or auth_role() in ('superadmin', 'admin', 'chancellor', 'vice-chancellor',
                         'registrar', 'academic-office', 'finance-director');
$$;

revoke all on function governs_the_university() from public;
grant execute on function governs_the_university() to authenticated;


-- ===========================================================================
-- 5. MOVING A ROW BETWEEN NATIONS IS THE CENTRE'S ACT
-- ===========================================================================
--
-- A POLICY DECIDES ABOUT A ROW; A TRIGGER DECIDES ABOUT A COLUMN. Section 6
-- lets a Rector read their nation's rows. This stops a Rector — who can reach
-- the row — from writing another nation's id onto it, or their own onto a row
-- that was never theirs.
--
-- Without it the scoping is decoration: anybody who can update a student could
-- move that student into their own administration, and with them the tuition
-- allocation that 098 will hang off the same column.
create or replace function administration_is_the_centres_to_set()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- A NEW ROW MAY BE BORN INTO A NATION — that is how a Rector recruits a
    -- student — BUT ONLY INTO THEIR OWN. Otherwise the rule is one INSERT away
    -- from meaningless.
    if new.administration_id is not null
       and not governs_the_university()
       and new.administration_id is distinct from my_administration() then
      raise exception 'A record can only be created in your own National Administration.'
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  if new.administration_id is not distinct from old.administration_id then
    return new;
  end if;

  if not governs_the_university() then
    raise exception 'Moving a record from one National Administration to another is the '
                    'University''s act, not a national one. Ask the Registrar.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['students', 'profiles', 'appointments', 'staff_records',
                           'payments', 'student_fee_assessments', 'correspondence'] loop
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = t
                 and column_name = 'administration_id') then
      execute format('drop trigger if exists %I on %I',
                     t || '_administration_is_the_centres', t);
      execute format(
        'create trigger %I before insert or update of administration_id on %I '
        'for each row execute function administration_is_the_centres_to_set()',
        t || '_administration_is_the_centres', t);
    end if;
  end loop;
end $$;


-- ===========================================================================
-- 6. ROW-LEVEL SECURITY
-- ===========================================================================

alter table national_administrations enable row level security;

-- THE REGISTER ITSELF IS READABLE BY EVERY MEMBER OF STAFF. Which nations the
-- University operates through is not a secret — it is on the prospectus — and
-- a lecturer in Buea teaching a student in Kampala should be able to see that
-- Uganda exists.
drop policy if exists national_administrations_read on national_administrations;
create policy national_administrations_read on national_administrations
  for select using (auth.uid() is not null);

-- WRITING TO IT IS THE CENTRE'S. Establishing a nation, naming its Rector and
-- recording its agreement are institutional acts.
drop policy if exists national_administrations_centre_write on national_administrations;
create policy national_administrations_centre_write on national_administrations
  for all using (governs_the_university()) with check (governs_the_university());

-- ---------------------------------------------------------------------------
-- AND THE NATIONAL READ, ONE TABLE AT A TIME.
--
-- Written out rather than looped, because a policy is the last thing in this
-- system that should be generated by a string: it is the sentence that decides
-- who sees a student's date of birth, and it should be readable as one.
-- ---------------------------------------------------------------------------

drop policy if exists students_national_read on students;
create policy students_national_read on students
  for select using (
    administration_id is not null and administration_id = my_administration()
  );

drop policy if exists payments_national_read on payments;
create policy payments_national_read on payments
  for select using (
    administration_id is not null and administration_id = my_administration()
  );

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'appointments'
               and column_name = 'administration_id') then
    execute 'drop policy if exists appointments_national_read on appointments';
    execute 'create policy appointments_national_read on appointments for select using ('
            '  administration_id is not null and administration_id = my_administration())';
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'staff_records'
               and column_name = 'administration_id') then
    execute 'drop policy if exists staff_records_national_read on staff_records';
    execute 'create policy staff_records_national_read on staff_records for select using ('
            '  administration_id is not null and administration_id = my_administration())';
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'student_fee_assessments'
               and column_name = 'administration_id') then
    execute 'drop policy if exists student_fee_assessments_national_read on '
            'student_fee_assessments';
    execute 'create policy student_fee_assessments_national_read on student_fee_assessments '
            'for select using ('
            '  administration_id is not null and administration_id = my_administration())';
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'correspondence'
               and column_name = 'administration_id') then
    execute 'drop policy if exists correspondence_national_read on correspondence';
    execute 'create policy correspondence_national_read on correspondence for select using ('
            '  administration_id is not null and administration_id = my_administration())';
  end if;
end $$;


-- ===========================================================================
-- 7. THE PROOF
-- ===========================================================================
--
-- Everything below happens inside a transaction that is rolled back. It writes
-- no row the University keeps, competes for no slot their data occupies, and
-- asserts nothing about what their database already contains — the three
-- faults this repository has recorded against its own proofs.
--
-- The countries used are deliberately not real places this University teaches
-- in. `Atlantis` and `Thule` cannot collide with a National Administration the
-- University establishes next week.

do $$
declare
  centre     uuid := gen_random_uuid();
  rector_a   uuid := gen_random_uuid();
  rector_b   uuid := gen_random_uuid();
  officer_a  uuid := gen_random_uuid();
  admin_a    uuid;
  admin_b    uuid;
  appt_a     uuid;
  student_a  uuid;
  student_b  uuid;
  refused    boolean;
  seen       integer;
begin
  -- ---- the people -------------------------------------------------------
  insert into auth.users (id, email) values
    (centre,   'proof-097-centre@example.invalid'),
    (rector_a, 'proof-097-rector-a@example.invalid'),
    (rector_b, 'proof-097-rector-b@example.invalid');

  -- ON CONFLICT DO UPDATE, because `handle_new_user` has already made these
  -- three profiles. The insert above into auth.users fires it, and a plain
  -- insert here collides on the primary key — which is what the first run of
  -- this proof did.
  insert into profiles (id, email, full_name, role) values
    (centre,   'proof-097-centre@example.invalid',   'Proof Registrar', 'registrar'),
    (rector_a, 'proof-097-rector-a@example.invalid', 'Proof Rector A',  'national-rector'),
    (rector_b, 'proof-097-rector-b@example.invalid', 'Proof Rector B',  'national-rector')
  on conflict (id) do update
    set role = excluded.role, full_name = excluded.full_name;

  raise notice '097 OK  the two national roles are accepted by profiles_role_valid';

  -- ---- an administration can be proposed without an agreement -----------
  insert into national_administrations (country, name, created_by)
    values ('Atlantis', 'ICOF Global University — National Administration of Atlantis', centre)
    returning id into admin_a;

  raise notice '097 OK  a country can be written down before its agreement exists';

  -- ---- but not established without one ----------------------------------
  begin
    refused := false;
    update national_administrations set status = 'established' where id = admin_a;
  exception when check_violation then
    refused := true;
  end;
  if not refused then
    raise exception '097 FAILED — an administration was established with no agreement';
  end if;
  raise notice '097 OK  and refuses to be established without an agreement and a Rector';

  -- ---- nor with an agreement but no appointment behind the Rector --------
  begin
    refused := false;
    update national_administrations
       set status = 'established',
           agreement_reference = 'NRA-PROOF-097',
           rector_id = rector_a
     where id = admin_a;
  exception when check_violation then
    refused := true;
  end;
  if not refused then
    raise exception '097 FAILED — a Rector took office with no appointment behind them';
  end if;
  raise notice '097 OK  …and not without the appointment the Rector holds';

  -- ---- give the Rector a real appointment --------------------------------
  -- `employment_type` and `start_date` are NOT NULL with no default — 041's
  -- doing, and right: an appointment with neither is not an appointment.
  insert into appointments (person_id, full_name, position_title,
                            employment_type, start_date, end_date, status)
    values (rector_a, 'Proof Rector A', 'National Rector',
            'fixed-term', current_date, current_date + 1095, 'draft')
    returning id into appt_a;

  update national_administrations
     set status = 'established',
         agreement_reference = 'NRA-PROOF-097',
         rector_id = rector_a,
         rector_appointment_id = appt_a
   where id = admin_a;

  raise notice '097 OK  with both in place it establishes';

  -- ---- the creator may not be the Rector ---------------------------------
  begin
    refused := false;
    insert into national_administrations (country, name, created_by, rector_id)
      values ('Thule', 'ICOF Global University — National Administration of Thule',
              rector_b, rector_b);
  exception when check_violation then
    refused := true;
  end;
  if not refused then
    raise exception '097 FAILED — somebody created an administration and made themselves '
                    'its Rector';
  end if;
  raise notice '097 OK  whoever creates an administration may not be its Rector';

  insert into national_administrations (country, name, created_by, rector_id,
                                        rector_appointment_id, agreement_reference, status)
    values ('Thule', 'ICOF Global University — National Administration of Thule',
            centre, rector_b, appt_a, 'NRA-PROOF-097-B', 'established')
    returning id into admin_b;

  -- ---- one live administration per country -------------------------------
  begin
    refused := false;
    insert into national_administrations (country, name, created_by)
      values ('atlantis', 'A second Atlantis', centre);
  exception when unique_violation then
    refused := true;
  end;
  if not refused then
    raise exception '097 FAILED — one country took two live administrations';
  end if;
  raise notice '097 OK  a country has one live administration, case and spacing aside';

  -- ---- a student in each nation ------------------------------------------
  insert into students (matric_no, first_name, last_name, administration_id)
    values ('PROOF-097-A', 'Proof', 'Atlantis', admin_a) returning id into student_a;
  insert into students (matric_no, first_name, last_name, administration_id)
    values ('PROOF-097-B', 'Proof', 'Thule', admin_b) returning id into student_b;

  -- =====================================================================
  -- THE ONE THAT MATTERS: A RECTOR SEES THEIR OWN NATION AND NOT THE OTHER.
  -- =====================================================================
  --
  -- Run as the `authenticated` role with Rector A's claim, which is what a
  -- browser session actually is. `set local` so it ends with the transaction.
  perform set_config('request.jwt.claim.sub', rector_a::text, true);
  set local role authenticated;

  select count(*) into seen from students
   where matric_no in ('PROOF-097-A', 'PROOF-097-B');

  reset role;
  -- `reset role` RESTORES THE ROLE AND LEAVES THE CLAIM, which lasts the whole
  -- transaction. 096 was caught by exactly this: the University's own update
  -- ran as the lecturer because the claim was still set.
  perform set_config('request.jwt.claim.sub', '', true);

  if seen <> 1 then
    raise exception '097 FAILED — a Rector saw % of the two nations'' students, not 1', seen;
  end if;
  raise notice '097 OK  a Rector reads their own nation''s students and not the other''s';

  -- =====================================================================
  -- AND NOBODY NATIONAL MOVES A STUDENT BETWEEN NATIONS.
  -- =====================================================================
  --
  -- THIS IS TESTED THROUGH AN OFFICER WHO CAN ACTUALLY REACH THE ROW, and the
  -- first version of it was not. It asked a Rector to move a student and read
  -- the refusal as proof — but a Rector has no UPDATE policy on `students` at
  -- all, so the statement matched no rows, and AN UPDATE MATCHING NO ROWS
  -- UNDER RLS SUCCEEDS. The assertion passed with the trigger deleted, which
  -- is the definition of a test that measures nothing.
  --
  -- A national Admissions Officer is the real case: `students_desk_update`
  -- lets them write to a student, and `profiles.administration_id` puts them
  -- in a nation. The trigger is then the only thing standing between them and
  -- another country's register.
  insert into auth.users (id, email) values (officer_a, 'proof-097-officer@example.invalid');
  insert into profiles (id, email, full_name, role, administration_id)
    values (officer_a, 'proof-097-officer@example.invalid', 'Proof Officer A',
            'admissions-officer', admin_a)
  on conflict (id) do update
    set role = excluded.role, administration_id = excluded.administration_id;

  perform set_config('request.jwt.claim.sub', officer_a::text, true);
  set local role authenticated;

  begin
    refused := false;
    update students set administration_id = admin_b where id = student_a;
  exception when insufficient_privilege then
    refused := true;
  end;

  reset role;
  perform set_config('request.jwt.claim.sub', '', true);

  if not refused then
    raise exception '097 FAILED — a national officer moved a student to another nation '
                    'and the trigger said nothing';
  end if;
  if (select administration_id from students where id = student_a) <> admin_a then
    raise exception '097 FAILED — the student moved nations';
  end if;
  raise notice '097 OK  a national officer cannot move a student to another nation';

  -- ---- but the centre can, which is what makes the rule a rule and not an
  -- ---- outage ------------------------------------------------------------
  update students set administration_id = admin_b where id = student_a;
  if (select administration_id from students where id = student_a) <> admin_b then
    raise exception '097 FAILED — the centre could not move a student between nations';
  end if;
  update students set administration_id = admin_a where id = student_a;
  raise notice '097 OK  …and the centre can';

  -- ---- and a Rector cannot write to a student at all ----------------------
  --
  -- Stated separately, as its own fact, rather than folded into the trigger
  -- test above where it was doing the work and taking the credit. A National
  -- Rector reads their nation's students; changing a student record is the
  -- Registrar's act in this University and 097 does not move it.
  perform set_config('request.jwt.claim.sub', rector_a::text, true);
  set local role authenticated;
  update students set phone = '000' where id = student_a;
  get diagnostics seen = row_count;
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);

  if seen <> 0 then
    raise exception '097 FAILED — a National Rector wrote to % student row(s)', seen;
  end if;
  raise notice '097 OK  a Rector reads their nation''s students and writes to none of them';

  raise exception 'proof-097-rollback';
exception
  when others then
    if sqlerrm = 'proof-097-rollback' then
      raise notice '097 OK  every proof above rolled back; nothing was kept';
    else
      raise;
    end if;
end $$;


-- ===========================================================================
-- ===========================================================================
--
--   098_what_the_nation_keeps.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 098 — WHAT THE NATION KEEPS
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. A DOOR CLOSES, AND IT IS THE POINT OF THE FILE. From this moment every
--    payment that names a National Administration is split the instant it is
--    recorded — and WITH NO AGREEMENT IN FORCE, THE WHOLE OF IT GOES TO THE
--    CENTRE. A nation cannot receive a cent before the University has approved
--    the agreement that says what it receives. Nothing is lost: the allocation
--    records why it went where it went, and an agreement approved later
--    governs the payments that follow it, not the ones before.
--
-- 2. REGISTRATION IS NEVER SHARED. The programme is explicit — "Registration
--    fees are allocated to the central ICOF University administration" — so a
--    payment whose purpose is registration allocates 100% to the centre
--    whatever any agreement says, and section 4 refuses an agreement that
--    tries to say otherwise.
--
-- 3. THE MONEY ADDS UP OR THE ROW DOES NOT EXIST. `to_centre + to_nation =
--    gross` is a CHECK constraint, not a convention. A reconciliation that can
--    disagree with itself is not a reconciliation.
--
-- 4. AN ALLOCATION CANNOT BE EDITED. Once written, the amounts are frozen; a
--    correction is a reversal and a new allocation. This is the same rule 043
--    applies to an issued document and for the same reason: a figure somebody
--    can quietly change is a figure nobody can rely on in an audit.
--
-- 5. NOTHING IS ALLOCATED RETROSPECTIVELY. Payments already in the database
--    have no `administration_id` — 097 left every existing row null — so they
--    are the centre's, which is what they have always been. This file writes
--    no allocation for them.
--
-- ---------------------------------------------------------------------------
-- WHY THE SPLIT IS A TRIGGER AND NOT A ROUTE
-- ---------------------------------------------------------------------------
--
-- Because there is more than one way money gets into this database — the
-- Finance desk, a restore, a correction, an import, and whatever the University
-- builds next — and a rule that lives in one route governs one of them.
--
-- The University has learned this in this system already: `reachability.test`
-- exists because things that were correct and connected to nothing kept being
-- found. A split computed in a route is a split that is missing from every
-- other door into `payments`.
--
-- ---------------------------------------------------------------------------
-- AND WHY THE RECTOR CANNOT APPROVE THEIR OWN AGREEMENT
-- ---------------------------------------------------------------------------
--
-- The agreement decides what the Rector's own administration receives. 041
-- refuses an appointment authorised by its drafter, 045 a letter authorised by
-- its preparer, and 097 an administration whose creator made themselves its
-- Rector. This is the fourth of the same rule, applied to the one that decides
-- money.
-- ===========================================================================


-- ===========================================================================
-- 1. THE AGREEMENT
-- ===========================================================================

create table if not exists national_revenue_agreements (
  id               uuid primary key default gen_random_uuid(),
  administration_id uuid not null
                   references national_administrations (id) on delete restrict,

  -- The National Administration Agreement this implements, by reference. 097
  -- already refuses to establish an administration without one; this names the
  -- clause the figures come from, so a dispute has a document to go to.
  reference        text not null check (length(btrim(reference)) between 3 and 120),

  -- ---- WHAT THE NATION KEEPS OF TUITION -----------------------------------
  --
  -- A percentage, two decimals, nothing clever. The University sets it per
  -- administration because the programme says the terms are established in the
  -- agreement, and agreements differ.
  --
  -- ZERO IS ALLOWED AND IS NOT THE SAME AS NO AGREEMENT. An administration on
  -- 0% has been considered and set to nothing; one with no agreement has not
  -- been considered at all, and section 5 treats them differently.
  tuition_share_percent numeric(5,2) not null
                   check (tuition_share_percent >= 0 and tuition_share_percent <= 100),

  -- ---- WHEN IT APPLIES ----------------------------------------------------
  effective_from   date not null,
  effective_to     date,
  constraint national_revenue_agreement_ends_after_it_starts
    check (effective_to is null or effective_to > effective_from),

  status           text not null default 'draft'
                   check (status in ('draft', 'in_force', 'ended')),

  -- ---- WHO APPROVED IT ----------------------------------------------------
  approved_by      uuid references auth.users (id) on delete set null,
  approved_at      timestamptz,

  note             text,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- AN AGREEMENT IN FORCE HAS BEEN APPROVED BY SOMEBODY. A draft need not be.
  constraint national_revenue_agreement_in_force_is_approved
    check (status <> 'in_force' or (approved_by is not null and approved_at is not null))
);

comment on table national_revenue_agreements is
  'What each National Administration keeps of the tuition its students pay. '
  'Registration is never shared — see 098 section 5.';

-- ONE AGREEMENT IN FORCE PER ADMINISTRATION AT A TIME. Two would make "what
-- does this nation keep" a question with two answers, which is the state a
-- finance system exists to prevent.
create unique index if not exists national_revenue_agreements_one_in_force
  on national_revenue_agreements (administration_id)
  where status = 'in_force';

create index if not exists national_revenue_agreements_by_administration
  on national_revenue_agreements (administration_id, status);

drop trigger if exists national_revenue_agreements_touch on national_revenue_agreements;
create trigger national_revenue_agreements_touch
  before update on national_revenue_agreements
  for each row execute function set_updated_at();


-- ===========================================================================
-- 2. AND IT IS NOT APPROVED BY THE PERSON IT PAYS
-- ===========================================================================
--
-- A TRIGGER RATHER THAN A CHECK, because the answer is in another table: the
-- Rector of this administration is a column of `national_administrations`, and
-- a CHECK constraint cannot look there.

create or replace function an_agreement_is_not_approved_by_its_rector()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rector uuid;
begin
  if new.approved_by is null then
    return new;
  end if;

  select rector_id into rector
    from national_administrations where id = new.administration_id;

  if rector is not null and rector = new.approved_by then
    raise exception 'A National Rector cannot approve the agreement that decides what their '
                    'own administration keeps. It is approved by the University.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists an_agreement_is_not_approved_by_its_rector_trg
  on national_revenue_agreements;
create trigger an_agreement_is_not_approved_by_its_rector_trg
  before insert or update on national_revenue_agreements
  for each row execute function an_agreement_is_not_approved_by_its_rector();


-- ===========================================================================
-- 3. THE ALLOCATION — ONE PER PAYMENT, AND IT ADDS UP
-- ===========================================================================

create table if not exists revenue_allocations (
  id               uuid primary key default gen_random_uuid(),

  -- ONE ALLOCATION PER PAYMENT. The unique constraint is the whole of the
  -- protection against a payment being counted twice, which is the failure a
  -- national administration would notice last and care about most.
  payment_id       uuid not null unique references payments (id) on delete cascade,

  administration_id uuid not null
                   references national_administrations (id) on delete restrict,
  -- Null where there was no agreement in force. `basis` says so in words.
  agreement_id     uuid references national_revenue_agreements (id) on delete set null,

  gross            numeric(14,2) not null check (gross > 0),
  to_centre        numeric(14,2) not null check (to_centre >= 0),
  to_nation        numeric(14,2) not null check (to_nation >= 0),
  currency         text not null,

  -- WHY IT WENT WHERE IT WENT, in a word a report can group by and a sentence
  -- a Financial Secretary can read.
  --
  --   registration    the centre's in full, always
  --   tuition         split by the agreement in force
  --   no-agreement    the centre's in full, because nothing had been approved
  --   other           anything else the University takes; the centre's
  basis            text not null
                   check (basis in ('registration', 'tuition', 'no-agreement', 'other')),
  note             text,

  allocated_at     timestamptz not null default now(),

  -- =====================================================================
  -- THE MONEY ADDS UP OR THE ROW DOES NOT EXIST.
  -- =====================================================================
  constraint revenue_allocation_adds_up
    check (to_centre + to_nation = gross)
);

comment on table revenue_allocations is
  'How each payment was divided between the centre and a National '
  'Administration. Written by a trigger when the payment lands; never edited.';

create index if not exists revenue_allocations_by_administration
  on revenue_allocations (administration_id, allocated_at desc);

-- ---------------------------------------------------------------------------
-- AND IT IS NEVER EDITED.
--
-- 043 freezes an issued document and 050's audit trail is append-only, for the
-- same reason: a number somebody can quietly change afterwards is a number
-- that proves nothing. A correction is a reversal and a new allocation, which
-- leaves both on the record.
-- ---------------------------------------------------------------------------
create or replace function an_allocation_is_never_rewritten()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.gross is distinct from old.gross
     or new.to_centre is distinct from old.to_centre
     or new.to_nation is distinct from old.to_nation
     or new.currency is distinct from old.currency
     or new.administration_id is distinct from old.administration_id
     or new.payment_id is distinct from old.payment_id then
    raise exception 'An allocation records what was divided and when. Correct it with a '
                    'reversing payment and a new allocation, so both stay on the record.'
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists an_allocation_is_never_rewritten_trg on revenue_allocations;
create trigger an_allocation_is_never_rewritten_trg
  before update on revenue_allocations
  for each row execute function an_allocation_is_never_rewritten();


-- ===========================================================================
-- 4. REGISTRATION IS NEVER SHARED
-- ===========================================================================
--
-- Stated once, here, so that section 5 and any future reader are reading the
-- same sentence. A payment is registration if its purpose says so; the match
-- is deliberately loose because `payments.purpose` is free text that the
-- Finance desk has been typing into for years.

create or replace function is_registration_money(purpose text)
returns boolean
language sql
immutable
as $$
  select purpose is not null and purpose ~* '(^|[^a-z])registration([^a-z]|$)';
$$;


-- ===========================================================================
-- 5. THE SPLIT, COMPUTED WHEN THE MONEY LANDS
-- ===========================================================================

create or replace function allocate_a_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  deal    national_revenue_agreements%rowtype;
  nation  numeric(14,2);
  why     text;
begin
  -- NO NATION NAMED, NOTHING TO SPLIT. This is every payment the University
  -- has ever taken, and it stays that way.
  if new.administration_id is null then
    return new;
  end if;

  -- REGISTRATION IS THE CENTRE'S, whatever any agreement says.
  if is_registration_money(new.purpose) then
    insert into revenue_allocations
      (payment_id, administration_id, gross, to_centre, to_nation, currency, basis)
    values (new.id, new.administration_id, new.amount, new.amount, 0, new.currency,
            'registration')
    on conflict (payment_id) do nothing;
    return new;
  end if;

  select * into deal from national_revenue_agreements
   where administration_id = new.administration_id
     and status = 'in_force'
     and effective_from <= current_date
     and (effective_to is null or effective_to >= current_date)
   limit 1;

  if not found then
    -- THE DOOR. Nothing approved, so nothing is shared — and the row says why
    -- rather than silently reading as a 0% agreement.
    insert into revenue_allocations
      (payment_id, administration_id, gross, to_centre, to_nation, currency, basis, note)
    values (new.id, new.administration_id, new.amount, new.amount, 0, new.currency,
            'no-agreement',
            'No national revenue agreement was in force on the day this was received.')
    on conflict (payment_id) do nothing;
    return new;
  end if;

  -- ROUNDED TO THE CENT, AND THE CENTRE ABSORBS THE REMAINDER. Computing both
  -- halves by percentage and rounding each would let them miss by a cent, and
  -- `revenue_allocation_adds_up` would then refuse the row — so the nation's
  -- share is rounded and the centre takes what is left. The University is the
  -- party that can carry a cent; a national ledger that will not balance is
  -- somebody's afternoon.
  nation := round(new.amount * deal.tuition_share_percent / 100, 2);

  insert into revenue_allocations
    (payment_id, administration_id, agreement_id, gross, to_centre, to_nation,
     currency, basis)
  values (new.id, new.administration_id, deal.id, new.amount,
          new.amount - nation, nation, new.currency, 'tuition')
  on conflict (payment_id) do nothing;

  return new;
end;
$$;

drop trigger if exists allocate_a_payment_trg on payments;
create trigger allocate_a_payment_trg
  after insert on payments
  for each row execute function allocate_a_payment();


-- ===========================================================================
-- 6. WHAT THE FINANCIAL SECRETARY RECONCILES
-- ===========================================================================
--
-- A VIEW RATHER THAN A TABLE, because a running total stored is a running
-- total that can disagree with the rows under it. This one cannot: it is the
-- rows.

create or replace view national_ledger as
  select
    a.id                          as administration_id,
    a.country,
    a.name,
    a.status,
    r.currency,
    count(r.id)                   as payments_allocated,
    coalesce(sum(r.gross), 0)     as gross_received,
    coalesce(sum(r.to_nation), 0) as kept_by_the_nation,
    coalesce(sum(r.to_centre), 0) as remitted_to_the_centre,
    count(*) filter (where r.basis = 'no-agreement') as awaiting_an_agreement,
    max(r.allocated_at)           as last_allocation
  from national_administrations a
  left join revenue_allocations r on r.administration_id = a.id
  group by a.id, a.country, a.name, a.status, r.currency;

comment on view national_ledger is
  'What each National Administration has received and what was remitted, from '
  'the allocations themselves. `awaiting_an_agreement` counts money that went '
  'to the centre because nothing had been approved.';


-- ===========================================================================
-- 7. ROW-LEVEL SECURITY
-- ===========================================================================

alter table national_revenue_agreements enable row level security;
alter table revenue_allocations enable row level security;

-- WRITING AN AGREEMENT IS THE CENTRE'S.
drop policy if exists national_revenue_agreements_centre on national_revenue_agreements;
create policy national_revenue_agreements_centre on national_revenue_agreements
  for all using (governs_the_university()) with check (governs_the_university());

-- AND A NATION READS ITS OWN. A Rector who cannot see the terms they operate
-- under is being asked to run an administration on trust.
drop policy if exists national_revenue_agreements_own on national_revenue_agreements;
create policy national_revenue_agreements_own on national_revenue_agreements
  for select using (administration_id = my_administration());

drop policy if exists revenue_allocations_centre on revenue_allocations;
create policy revenue_allocations_centre on revenue_allocations
  for all using (governs_the_university()) with check (governs_the_university());

drop policy if exists revenue_allocations_own on revenue_allocations;
create policy revenue_allocations_own on revenue_allocations
  for select using (administration_id = my_administration());

grant select on national_ledger to authenticated;


-- ===========================================================================
-- 8. THE PROOF
-- ===========================================================================

do $$
declare
  centre    uuid := gen_random_uuid();
  rector    uuid := gen_random_uuid();
  nation    uuid;
  deal      uuid;
  appt      uuid;
  pay       uuid;
  student   uuid;
  alloc     revenue_allocations%rowtype;
  refused   boolean;
begin
  insert into auth.users (id, email) values
    (centre, 'proof-098-centre@example.invalid'),
    (rector, 'proof-098-rector@example.invalid');
  insert into profiles (id, email, full_name, role) values
    (centre, 'proof-098-centre@example.invalid', 'Proof Finance Director', 'finance-director'),
    (rector, 'proof-098-rector@example.invalid', 'Proof Rector',           'national-rector')
  on conflict (id) do update set role = excluded.role;

  insert into appointments (person_id, full_name, position_title,
                            employment_type, start_date, end_date, status)
    values (rector, 'Proof Rector', 'National Rector',
            'fixed-term', current_date, current_date + 1095, 'draft')
    returning id into appt;

  insert into national_administrations
    (country, name, created_by, rector_id, rector_appointment_id,
     agreement_reference, status)
    values ('Erewhon', 'ICOF Global University — National Administration of Erewhon',
            centre, rector, appt, 'NRA-PROOF-098', 'established')
    returning id into nation;

  insert into students (matric_no, first_name, last_name, administration_id)
    values ('PROOF-098', 'Proof', 'Erewhon', nation) returning id into student;

  -- ---- WITH NO AGREEMENT, THE CENTRE KEEPS EVERYTHING --------------------
  insert into payments (student_id, reference, amount, currency, purpose,
                        administration_id)
    values (student, 'PROOF-098-TUITION-A', 1000.00, 'USD', 'Tuition, first instalment',
            nation)
    returning id into pay;

  select * into alloc from revenue_allocations where payment_id = pay;
  if alloc.basis <> 'no-agreement' or alloc.to_nation <> 0 or alloc.to_centre <> 1000.00 then
    raise exception '098 FAILED — a nation was paid with no agreement in force (% / % / %)',
      alloc.basis, alloc.to_nation, alloc.to_centre;
  end if;
  raise notice '098 OK  with no agreement in force the whole payment stays with the centre';

  -- ---- THE RECTOR CANNOT APPROVE THEIR OWN TERMS -------------------------
  begin
    refused := false;
    insert into national_revenue_agreements
      (administration_id, reference, tuition_share_percent, effective_from,
       status, approved_by, approved_at, created_by)
      values (nation, 'NRA-PROOF-098', 70, current_date, 'in_force',
              rector, now(), centre);
  exception when insufficient_privilege then
    refused := true;
  end;
  if not refused then
    raise exception '098 FAILED — a Rector approved the agreement that pays their own nation';
  end if;
  raise notice '098 OK  a Rector cannot approve the agreement that pays their own nation';

  -- ---- an agreement the University approved ------------------------------
  insert into national_revenue_agreements
    (administration_id, reference, tuition_share_percent, effective_from,
     status, approved_by, approved_at, created_by)
    values (nation, 'NRA-PROOF-098', 70, current_date, 'in_force',
            centre, now(), centre)
    returning id into deal;

  -- ---- TUITION SPLITS BY THE AGREEMENT -----------------------------------
  insert into payments (student_id, reference, amount, currency, purpose,
                        administration_id)
    values (student, 'PROOF-098-TUITION-B', 1000.00, 'USD', 'Tuition, second instalment',
            nation)
    returning id into pay;

  select * into alloc from revenue_allocations where payment_id = pay;
  if alloc.basis <> 'tuition' or alloc.to_nation <> 700.00 or alloc.to_centre <> 300.00 then
    raise exception '098 FAILED — tuition split as % / % / % rather than 700 to the nation',
      alloc.basis, alloc.to_nation, alloc.to_centre;
  end if;
  raise notice '098 OK  tuition splits by the agreement in force';

  -- ---- REGISTRATION IS NEVER SHARED --------------------------------------
  insert into payments (student_id, reference, amount, currency, purpose,
                        administration_id)
    values (student, 'PROOF-098-REG', 250.00, 'USD', 'Registration fee', nation)
    returning id into pay;

  select * into alloc from revenue_allocations where payment_id = pay;
  if alloc.basis <> 'registration' or alloc.to_nation <> 0 then
    raise exception '098 FAILED — registration was shared with a nation (% / %)',
      alloc.basis, alloc.to_nation;
  end if;
  raise notice '098 OK  registration is the centre''s even under a 70%% agreement';

  -- ---- AND THE ROW CANNOT BE REWRITTEN -----------------------------------
  begin
    refused := false;
    update revenue_allocations set to_nation = 250.00, to_centre = 0 where payment_id = pay;
  exception when restrict_violation then
    refused := true;
  end;
  if not refused then
    raise exception '098 FAILED — an allocation was rewritten after the fact';
  end if;
  raise notice '098 OK  an allocation cannot be rewritten';

  -- ---- AND IT HAS TO ADD UP ----------------------------------------------
  begin
    refused := false;
    insert into revenue_allocations
      (payment_id, administration_id, gross, to_centre, to_nation, currency, basis)
      values (pay, nation, 100, 10, 10, 'USD', 'other');
  exception when check_violation then
    refused := true;
  when unique_violation then
    -- the payment already has one; use a fresh payment to test the sum
    refused := false;
  end;
  if not refused then
    insert into payments (student_id, reference, amount, currency, purpose)
      values (student, 'PROOF-098-SUM', 100.00, 'USD', 'Other') returning id into pay;
    begin
      refused := false;
      insert into revenue_allocations
        (payment_id, administration_id, gross, to_centre, to_nation, currency, basis)
        values (pay, nation, 100, 10, 10, 'USD', 'other');
    exception when check_violation then
      refused := true;
    end;
  end if;
  if not refused then
    raise exception '098 FAILED — an allocation was accepted whose halves do not make the whole';
  end if;
  raise notice '098 OK  an allocation whose halves do not make the whole is refused';

  -- ---- THE LEDGER READS THE ROWS -----------------------------------------
  if (select kept_by_the_nation from national_ledger
       where administration_id = nation and currency = 'USD') <> 700.00 then
    raise exception '098 FAILED — the ledger does not agree with the allocations';
  end if;
  raise notice '098 OK  the ledger is the allocations and agrees with them';

  raise exception 'proof-098-rollback';
exception
  when others then
    if sqlerrm = 'proof-098-rollback' then
      raise notice '098 OK  every proof above rolled back; nothing was kept';
    else
      raise;
    end if;
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
  select '097' as migration, '097_a_nation_the_university_can_see.sql' as file,
         case when to_regclass('public.national_administrations') is not null then 'YES' else 'NO' end as landed,
         'national_administrations' as what_it_creates
  union all
  select '098' as migration, '098_what_the_nation_keeps.sql' as file,
         case when to_regclass('public.revenue_allocations') is not null then 'YES' else 'NO' end as landed,
         'revenue_allocations' as what_it_creates
) as landed_report
 order by migration;

