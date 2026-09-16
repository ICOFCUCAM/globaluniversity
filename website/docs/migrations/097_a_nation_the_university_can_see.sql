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
-- WRITTEN OUT, ONE STATEMENT PER TABLE, AND NOT GENERATED IN A LOOP.
--
-- The first version of this did it inside a `do` block with `execute format`,
-- guarded by a check that the table existed. It worked — the columns landed and
-- the proof passed — and it was still wrong, because NOTHING READING THE SQL
-- COULD SEE THE COLUMNS. `schemaContract.test.mjs` parses these files to check
-- that every column the application selects actually exists, and it reported
-- `profiles.administration_id` as a column the migrations do not define. It was
-- right about what it could see.
--
-- The guard was defensive about nothing, too: every table below is created by
-- an earlier migration in this same sequence, so on any database that has
-- reached 097 all seven are there.
--
-- A schema a reader cannot read is a schema a tool cannot check.

-- WHO THE NATION RECRUITED AND TEACHES. An application and a student are one
-- row in this schema at two stages (037), so this single column carries both
-- "recruited by" and "enrolled through".
alter table students
  add column if not exists administration_id uuid
  references national_administrations (id) on delete restrict;

-- WHOSE ACCOUNT BELONGS TO THE NATION. The Rector's own, the Financial
-- Secretary's, and every national officer's. This is what `my_administration()`
-- reads for somebody who is not the Rector.
alter table profiles
  add column if not exists administration_id uuid
  references national_administrations (id) on delete restrict;

-- WHOM THE NATION RECOMMENDED. The appointment is still the University's to
-- make — 041 is untouched — but the nation it was made for is recorded.
alter table appointments
  add column if not exists administration_id uuid
  references national_administrations (id) on delete restrict;

alter table staff_records
  add column if not exists administration_id uuid
  references national_administrations (id) on delete restrict;

-- WHAT THE NATION TOOK AND WHAT IT CHARGED.
alter table payments
  add column if not exists administration_id uuid
  references national_administrations (id) on delete restrict;

alter table student_fee_assessments
  add column if not exists administration_id uuid
  references national_administrations (id) on delete restrict;

-- WHAT THE NATION WROTE. A Rector's letters are the University speaking in
-- that country.
alter table correspondence
  add column if not exists administration_id uuid
  references national_administrations (id) on delete restrict;

create index if not exists students_administration_idx
  on students (administration_id) where administration_id is not null;
create index if not exists profiles_administration_idx
  on profiles (administration_id) where administration_id is not null;
create index if not exists appointments_administration_idx
  on appointments (administration_id) where administration_id is not null;
create index if not exists staff_records_administration_idx
  on staff_records (administration_id) where administration_id is not null;
create index if not exists payments_administration_idx
  on payments (administration_id) where administration_id is not null;
create index if not exists student_fee_assessments_administration_idx
  on student_fee_assessments (administration_id) where administration_id is not null;
create index if not exists correspondence_administration_idx
  on correspondence (administration_id) where administration_id is not null;


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
