-- ===========================================================================
-- 105 — THE VICE-CHANCELLOR CAN SEE THE UNIVERSITY
-- ===========================================================================
--
-- The University asked, looking at the Vice-Chancellor's own dashboard:
--
--   "WHY IS ENROLLMENT NOT REGISTERED"
--
-- Enrolled students: 0. Admitted this cycle: 0. Courses: 77.
--
-- ---------------------------------------------------------------------------
-- IT IS NOT A COUNT. IT IS A REFUSAL.
-- ---------------------------------------------------------------------------
--
-- `students_staff_read` admits eleven roles: superadmin, admin, registrar,
-- finance, finance-director, admissions-officer, dean, hod,
-- programme-coordinator, academic-office, student-affairs — and a lecturer,
-- for the students they teach.
--
-- THE VICE-CHANCELLOR IS NOT ON THAT LIST. NEITHER IS THE CHANCELLOR.
--
-- So the two most senior offices of the University read ZERO students, always,
-- however many the University has. `courses` is publicly readable and showed
-- 77 in the same row of tiles, which is what makes the dashboard look like a
-- working screen reporting an empty institution rather than a screen being
-- refused.
--
-- A COUNT OF ZERO AND A REFUSAL LOOK IDENTICAL, and this is the third time
-- that has cost the University something. 013 enabled row-level security on
-- `credential_audit_events` and wrote no policy at all, so the immutable trail
-- was readable by nobody for as long as it existed. 004 built
-- `credentials_issued` and never admitted the Vice-Chancellor, so the register
-- of what the University had issued was closed to the officer who signs them.
-- Both were found the same way: somebody senior looked at a screen and it said
-- nothing was there.
--
-- ---------------------------------------------------------------------------
-- WHY THESE TWO OFFICES AND NO OTHERS
-- ---------------------------------------------------------------------------
--
-- Because the capability matrix already says they see the institution, and the
-- database is the only thing disagreeing:
--
--   The Vice-Chancellor holds `view-executive-dashboard`, `view-all-faculties`
--   and `monitor-progress`.
--
--   The Chancellor holds all three AND `view-admitted-students` — a capability
--   whose entire content is reading the very rows this policy withholds.
--
-- The audit's own note on `view-all-faculties` says why the grant alone was
-- never enough: "Descriptive. What an office SEES is decided by the menu and
-- by the row-level policies, not by a check on this name." The menu offered
-- it. The policy did not.
--
-- ---------------------------------------------------------------------------
-- READING IS NOT ADMITTING, AND NOTHING HERE CHANGES THAT
-- ---------------------------------------------------------------------------
--
-- The University's design deliberately withholds `admit-student` and
-- `verify-payment` from both offices — "an institution where the Vice
-- Chancellor can personally admit a student has no separation of duties left
-- to speak of, whatever its org chart says." That separation is untouched.
--
-- This is a SELECT policy. Neither office gains a way to create, admit, amend
-- or delete a student record, and the proof below watches the insert being
-- refused rather than assuming it.
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. THE VICE-CHANCELLOR'S DASHBOARD STARTS TELLING THE TRUTH. Enrolled
--    students, admitted this cycle, the Students screen, and the "needs
--    attention" panel that reasons from those counts.
--
-- 2. NOBODY LOSES A ROW. The policy is replaced with the same eleven roles
--    plus two, and the lecturer's own narrower clause is carried through
--    unchanged.
--
-- 3. NOTHING IS SEEDED AND NO STUDENT RECORD IS TOUCHED.
--
-- ===========================================================================


-- ===========================================================================
-- 1. THE POLICY, WITH TWO MORE OFFICES ON IT
-- ===========================================================================
--
-- Written out in full rather than patched, because a policy is a sentence and
-- half a sentence cannot be read. The lecturer clause is 083's and is repeated
-- here exactly: a lecturer reads the students they teach and no others.
-- ---------------------------------------------------------------------------

drop policy if exists students_staff_read on students;

create policy students_staff_read on students
  for select using (
    auth_role() in (
      'superadmin', 'admin', 'registrar', 'finance', 'finance-director',
      'admissions-officer', 'dean', 'hod', 'programme-coordinator',
      'academic-office', 'student-affairs',
      -- THE TWO THAT WERE MISSING. Both hold `view-executive-dashboard`; the
      -- Chancellor holds `view-admitted-students`, which is this policy's own
      -- subject matter.
      'vice-chancellor', 'chancellor'
    )
    or (auth_role() = 'lecturer' and teaches_this_student(id))
  );

comment on policy students_staff_read on students is
  'Who may read the student register. The Vice-Chancellor and the Chancellor were absent from '
  'it until 105, so both read zero students on every screen — which looks exactly like a '
  'University with no students. Reading is not admitting: neither office holds admit-student '
  'or verify-payment, and this policy does not give them one.';


-- ===========================================================================
-- 2. THE PROOF
-- ===========================================================================
--
-- Prove a guard by breaking it, and prove a grant by watching it work. Both
-- halves matter here: the fault was a policy that refused somebody it should
-- have admitted, so a proof that only checks refusals would have passed
-- happily on the broken version.
-- ===========================================================================

do $$
declare
  vc       uuid := gen_random_uuid();
  chan     uuid := gen_random_uuid();
  lect     uuid := gen_random_uuid();
  lib      uuid := gen_random_uuid();
  stu      uuid;
  seen     integer;
  refused  boolean;
begin
  insert into auth.users (id, email) values
    (vc,   'proof-105-vc@example.invalid'),
    (chan, 'proof-105-chancellor@example.invalid'),
    (lect, 'proof-105-lecturer@example.invalid'),
    (lib,  'proof-105-librarian@example.invalid');
  insert into profiles (id, email, full_name, role) values
    (vc,   'proof-105-vc@example.invalid',         'Proof Vice-Chancellor', 'vice-chancellor'),
    (chan, 'proof-105-chancellor@example.invalid', 'Proof Chancellor',      'chancellor'),
    (lect, 'proof-105-lecturer@example.invalid',   'Proof Lecturer',        'lecturer'),
    (lib,  'proof-105-librarian@example.invalid',  'Proof Librarian',       'library-staff')
  on conflict (id) do update set role = excluded.role;

  -- A STUDENT OF OUR OWN. Never counts the University's: a proof that asserts
  -- how many students they have fails them for using the system.
  insert into students (matric_no, first_name, last_name, email, student_number, status)
       values ('PROOF-105-A', 'Proof', 'Enrolled-105', 'proof-105-a@example.invalid',
               'PROOF-105-A', 'enrolled')
    returning id into stu;

  -- ---- THE GRANT, WATCHED WORKING ---------------------------------------
  --
  -- RLS DOES NOT APPLY TO A TABLE'S OWNER, so this must change role or it
  -- proves nothing at all.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', vc::text, true);
  select count(*) into seen from students where id = stu;
  reset role;
  if seen <> 1 then
    raise exception '105 FAILED — the Vice-Chancellor read % of one student', seen;
  end if;
  raise notice '105 OK  the Vice-Chancellor can read the student register';

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', chan::text, true);
  select count(*) into seen from students where id = stu;
  reset role;
  if seen <> 1 then
    raise exception '105 FAILED — the Chancellor read % of one student', seen;
  end if;
  raise notice '105 OK  …and so can the Chancellor, who holds view-admitted-students';

  -- ---- AND READING IS STILL NOT ADMITTING -------------------------------
  --
  -- The separation the University built this around. If this ever stops
  -- refusing, 105 has done something nobody asked for.
  refused := false;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', vc::text, true);
    insert into students (matric_no, first_name, last_name, status)
         values ('PROOF-105-B', 'Proof', 'Admitted-By-The-VC', 'enrolled');
    reset role;
  exception when others then
    begin reset role; exception when others then null; end;
    refused := true;
  end;
  if not refused then
    raise exception '105 FAILED — the Vice-Chancellor admitted a student';
  end if;
  raise notice '105 OK  …and neither of them can create a student record';

  -- ---- THE CEILING IS STILL A CEILING -----------------------------------
  --
  -- A policy widened by two must not have been widened to everybody. The
  -- Librarian is the test because they are staff, signed in, and have no
  -- business in the student register.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', lib::text, true);
  select count(*) into seen from students where id = stu;
  reset role;
  if seen <> 0 then
    raise exception '105 FAILED — the Librarian read % students', seen;
  end if;
  raise notice '105 OK  a Librarian still reads none';

  -- AND A LECTURER READS ONLY THEIR OWN, which is 083's rule and is carried
  -- through this rewrite rather than dropped by it. This lecturer teaches
  -- nobody, so they see nobody.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', lect::text, true);
  select count(*) into seen from students where id = stu;
  reset role;
  if seen <> 0 then
    raise exception '105 FAILED — a lecturer read a student they do not teach';
  end if;
  raise notice '105 OK  …and a lecturer still reads only the students they teach';

  raise exception 'ROLLBACK 105';
exception
  when others then
    if sqlerrm = 'ROLLBACK 105' then
      raise notice '105 OK  every proof above rolled back; no student record was written to';
    else
      raise;
    end if;
end $$;


-- ===========================================================================
-- 3. DONE
-- ===========================================================================
do $$
begin
  raise notice '105 APPLIED  the Vice-Chancellor and the Chancellor can read the student '
               'register. Their dashboards have been reporting zero students because the '
               'policy refused them, not because there were none.';
end $$;
