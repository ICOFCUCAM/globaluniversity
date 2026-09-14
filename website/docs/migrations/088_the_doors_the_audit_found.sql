-- ===========================================================================
-- 088 — THE DOORS THE AUDIT FOUND
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- RUN THIS ONE FIRST. IT CLOSES THREE OPEN DOORS.
-- ---------------------------------------------------------------------------
--
-- The University asked for a system-wide re-evaluation rather than more
-- features. Three of the things it turned up are not architecture — they are
-- live, and each was demonstrated against a real database before this file was
-- written rather than reasoned about.
--
-- ===========================================================================
-- 1. THE PUBLIC KEY READS, FORGES AND DELETES THE UNIVERSITY'S MONEY
-- ===========================================================================
--
-- Five tables have row-level security NOT ENABLED, while `anon` and
-- `authenticated` hold SELECT, INSERT, UPDATE and DELETE on all of them:
--
--     payments, fee_items, fee_schedules,
--     financial_clearances, student_fee_assessments
--
-- `anon` is the publishable key. It is in the JavaScript bundle of every page
-- of the website, readable by anyone who opens the developer tools. So, today,
-- with no account and no sign-in at all:
--
--     select * from payments                 -- every payment the University has
--     insert into payments (...)             -- a receipt for any sum
--     update payments set amount = 1         -- alter one that exists
--     delete from payments where ...         -- destroy one
--
-- All four were run against a database with these migrations applied. The
-- forged receipt and the altered amount are reproduced in the proof below.
--
-- AND THERE IS A POLICY ON `payments` ALREADY — `payments_finance_insert`.
-- That is the worst part of this finding rather than a mitigation of it:
-- somebody wrote the rule, and row-level security was never switched on, so
-- the rule has never once been consulted. A policy on a table with RLS
-- disabled is decoration that reads like protection.
--
-- WHY IT MATTERS BEYOND THE MONEY. The University's own admissions workflow
-- makes Finance a gate: "Application → Finance confirmation → Registrar →
-- Academic decision → Issuance". A forged payment row is a forged confirmation
-- at the first gate.
--
-- ===========================================================================
-- 2. ANY STUDENT CAN READ THE EXAMINATION QUESTION BANK, WITH THE ANSWERS
-- ===========================================================================
--
-- `module_records` is the old JSON store, and its read policy is
-- `auth.uid() is not null` — an account, not a role. The Question Bank screen
-- writes each question into it as
--
--     {"text": "...", "options": ["...", "..."], "answer": 0}
--
-- where `answer` is the index of the correct one. So any signed-in student
-- reads every banked examination question and which option is right. Proved,
-- with a question and its answer both coming back to a student session.
--
-- This is precisely the fault 085 was written to make impossible for quizzes —
-- the answer key in the same row as the question, reachable from the browser.
-- It was already live in the store 085 does not govern.
--
-- NARROWED RATHER THAN REBUILT. The right end state is that the Question Bank
-- uses `activity_questions` and `activity_answer_key` like everything else,
-- and that is a change to a screen, not to a policy. Until then the store
-- refuses students the `exams` module, which closes the door today without
-- breaking the five screens still reading the other modules.
--
-- ===========================================================================
-- 3. EVERY LECTURER'S PRIVATE CONTACT DETAILS ARE PUBLISHED
-- ===========================================================================
--
-- `lecturers_public_read` is `using (true)` — genuinely public, no sign-in —
-- and the table carries `email`, `phone` and `auth_user_id` alongside the name
-- and specialism a university does publish.
--
-- `auth_user_id` is the account identifier. Publishing it hands an attacker
-- the exact account to go after for every member of academic staff.
--
-- AND A POLICY CANNOT FIX THIS, which is the third time this system has met
-- the same wall: row-level security is ROW-level and cannot hide a column.
-- 085 moved the answer key to its own table for this reason and 087 replaced a
-- lecturer's progress read with a view for the same one. So the table is
-- closed to the public and a VIEW carries the columns a directory should have.
-- ===========================================================================


-- ===========================================================================
-- 1. THE FINANCE TABLES
-- ===========================================================================

alter table payments                enable row level security;
alter table fee_items               enable row level security;
alter table fee_schedules           enable row level security;
alter table financial_clearances    enable row level security;
alter table student_fee_assessments enable row level security;

-- ---------------------------------------------------------------------------
-- NOTHING IS WRITTEN FROM A BROWSER SESSION.
--
-- Every write to these tables goes through `/api/finance/fees`, which holds
-- the service key and checks authority first. So the grant is taken away
-- rather than governed by a policy: a capability that no longer exists cannot
-- be reached by a policy written wrongly later.
--
-- THIS CHANGES ONE SCREEN. `FeeModule.tsx` inserts a payment directly from the
-- browser. That insert will begin to fail, and it should: a receipt the client
-- writes for itself is a receipt anybody can write for themselves, from the
-- console, for any amount. It is named at the top of the hand-over.
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate on payments                from anon, authenticated;
revoke insert, update, delete, truncate on fee_items               from anon, authenticated;
revoke insert, update, delete, truncate on fee_schedules           from anon, authenticated;
revoke insert, update, delete, truncate on financial_clearances    from anon, authenticated;
revoke insert, update, delete, truncate on student_fee_assessments from anon, authenticated;

-- AND THE PUBLIC READS NONE OF IT.
revoke select on payments, fee_items, financial_clearances, student_fee_assessments from anon;

-- The published tariff stays readable, and only the tariff: a university
-- publishes what it charges, and `fee_schedules`/`fee_items` are the tariff.
-- The schedule a PARTICULAR student has been assessed under is
-- `student_fee_assessments`, which is not public and is revoked above.
grant select on fee_schedules, fee_items to anon, authenticated;
grant select on payments, financial_clearances, student_fee_assessments to authenticated;

-- ---------------------------------------------------------------------------
-- WHO MAY SEE WHAT
-- ---------------------------------------------------------------------------

drop policy if exists payments_read on payments;
create policy payments_read on payments
  for select using (
    student_id in (select id from students where auth_user_id = auth.uid())
    or auth_role() in ('superadmin', 'admin', 'finance', 'finance-director',
                       'registrar', 'admissions-officer')
  );

drop policy if exists student_fee_assessments_read on student_fee_assessments;
create policy student_fee_assessments_read on student_fee_assessments
  for select using (
    student_id in (select id from students where auth_user_id = auth.uid())
    or auth_role() in ('superadmin', 'admin', 'finance', 'finance-director',
                       'registrar', 'admissions-officer')
  );

-- A CLEARANCE IS A GATE IN ADMISSIONS, so the offices on the far side of that
-- gate must be able to see it — that is the whole point of a gate. The student
-- it is about sees their own.
drop policy if exists financial_clearances_read on financial_clearances;
create policy financial_clearances_read on financial_clearances
  for select using (
    student_id in (select id from students where auth_user_id = auth.uid())
    or auth_role() in ('superadmin', 'admin', 'finance', 'finance-director',
                       'registrar', 'admissions-officer', 'academic-office',
                       'vice-chancellor')
  );

-- THE PUBLISHED TARIFF. Readable by anyone, which is what published means; a
-- draft schedule is not, because it is not published yet.
drop policy if exists fee_schedules_read on fee_schedules;
create policy fee_schedules_read on fee_schedules
  for select using (
    published_at is not null
    or auth_role() in ('superadmin', 'admin', 'finance', 'finance-director', 'registrar')
  );

drop policy if exists fee_items_read on fee_items;
create policy fee_items_read on fee_items
  for select using (
    exists (select 1 from fee_schedules s
             where s.id = fee_items.schedule_id
               and (s.published_at is not null
                    or auth_role() in ('superadmin', 'admin', 'finance',
                                       'finance-director', 'registrar')))
  );

-- THE POLICY THAT WAS NEVER CONSULTED. It governed inserts from a browser
-- session, and there are none any more; leaving it would suggest there were.
drop policy if exists payments_finance_insert on payments;


-- ---------------------------------------------------------------------------
-- AND A RECEIPT NUMBER THE CLIENT CANNOT CHOOSE
-- ---------------------------------------------------------------------------
--
-- Closing the browser's write to `payments` takes the Finance desk's Record a
-- payment button with it, so the door it should have had goes in here too.
--
-- THE REFERENCE WAS BEING MADE IN THE BROWSER, as
--
--     const no = `RCPT-${Date.now().toString(36).toUpperCase()}`
--
-- and `payments.reference` is UNIQUE. Two officers taking money in the same
-- millisecond collide, and the insert fails after the cash has been handed
-- over — which the screen's own comment says must never happen. A client also
-- chooses its own institutional identifier this way, which is the thing the
-- University ruled against: "Do not allow clients to arbitrarily assign
-- institutional statuses."
--
-- The same shape 024 uses for a student number: a counter row per year,
-- incremented inside the statement that reads it, so Postgres serialises them
-- and `returning` hands back a number nobody else can have.

create table if not exists receipt_counters (
  year        integer primary key,
  next_value  integer not null default 1
);

create or replace function reserve_receipt_number(p_year integer) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  seq integer;
begin
  insert into receipt_counters (year, next_value)
  values (p_year, 2)
  on conflict (year) do update set next_value = receipt_counters.next_value + 1
  returning next_value - 1 into seq;

  return 'RCPT-' || p_year::text || '-' || lpad(seq::text, 5, '0');
end;
$$;

revoke all on function reserve_receipt_number(integer) from public, anon, authenticated;
grant execute on function reserve_receipt_number(integer) to service_role;

alter table receipt_counters enable row level security;

-- START ABOVE ANYTHING ALREADY ISSUED, exactly as 024 does, so running this on
-- a database with receipts in it cannot reissue a number somebody is holding.
do $$
declare
  r record;
begin
  for r in
    select substring(reference from 6 for 4)::int as yr,
           max(substring(reference from 11)::int) as top
      from payments
     where reference ~ '^RCPT-[0-9]{4}-[0-9]{5}$'
     group by 1
  loop
    insert into receipt_counters (year, next_value)
    values (r.yr, r.top + 1)
    on conflict (year) do update
      set next_value = greatest(receipt_counters.next_value, excluded.next_value);
  end loop;
end $$;


-- ===========================================================================
-- 2. THE EXAMINATION QUESTION BANK
-- ===========================================================================

drop policy if exists module_records_read on module_records;
create policy module_records_read on module_records
  for select using (
    auth.uid() is not null
    and (
      -- THE EXAMS MODULE IS STAFF ONLY. It holds banked questions with the
      -- index of the correct option in the same row.
      module <> 'exams'
      or auth_role() in ('superadmin', 'admin', 'registrar', 'academic-office',
                         'dean', 'hod', 'programme-coordinator', 'lecturer',
                         'exam-officer')
      or author_id = auth.uid()
    )
  );


-- ===========================================================================
-- 3. THE STAFF DIRECTORY
-- ===========================================================================

drop policy if exists lecturers_public_read on lecturers;
-- AND THE NEW NAME TOO. Dropping only the old one left the second run failing
-- with "policy lecturers_read already exists" — correct once and broken
-- afterwards, which is the shape that lands cleanly and fails for whoever
-- re-runs the bundle.
drop policy if exists lecturers_read on lecturers;
create policy lecturers_read on lecturers
  for select using (
    -- Their own row, always.
    auth_user_id = auth.uid()
    -- And the signed-in University, which needs to allocate courses, build a
    -- timetable and name whoever teaches what.
    or auth.uid() is not null
  );

-- ---------------------------------------------------------------------------
-- WHAT THE PUBLIC MAY SEE INSTEAD.
--
-- A NAME, A TITLE AND A FIELD. No email, no telephone number, and above all no
-- `auth_user_id` — which is the account to attack, published for every member
-- of academic staff.
--
-- A VIEW AND NOT A POLICY, for the third time in this schema: a policy cannot
-- hide a column, so the guarantee has to be that the column is not there.
-- ---------------------------------------------------------------------------
drop view if exists lecturer_directory;
create view lecturer_directory as
  select
    l.id,
    l.title,
    l.first_name,
    l.last_name,
    l.specialization,
    l.photo_url,
    l.department_id,
    d.name as department
  from lecturers l
  left join departments d on d.id = l.department_id
  where l.status = 'active';

grant select on lecturer_directory to anon, authenticated;

comment on view lecturer_directory is
  'The public staff directory: name, title, field, department. Deliberately carries no email, '
  'no phone and no auth_user_id — the table was published with all three, and a policy cannot '
  'hide a column, so the column is not here.';


-- ===========================================================================
-- PROVE IT, AND ROLL IT BACK
-- ===========================================================================
--
-- AS THE PUBLIC KEY AND AS A STUDENT, because that is who the audit found
-- standing inside. Every assertion below failed before this migration; the
-- numbers in the messages are the ones actually observed.

do $$
declare
  stu_user uuid := gen_random_uuid();
  fin_user uuid := gen_random_uuid();
  the_student uuid;
  other_student uuid;
  the_year uuid;
  sched uuid;
  seen integer;
begin
  begin
    insert into auth.users (id, email) values
      (stu_user, '088-student@example.test'),
      (fin_user, '088-finance@example.test');
    insert into profiles (id, email, role) values
      (stu_user, '088-student@example.test', 'student'),
      (fin_user, '088-finance@example.test', 'finance')
    on conflict (id) do update set role = excluded.role;

    insert into students (matric_no, first_name, last_name, status, auth_user_id)
      values ('088/PROOF/MINE', 'Pays', 'TheirFees', 'enrolled', stu_user)
      returning id into the_student;
    insert into students (matric_no, first_name, last_name, status)
      values ('088/PROOF/OTHER', 'Somebody', 'Else', 'enrolled')
      returning id into other_student;

    -- A MEMBER OF STAFF WITH A TELEPHONE NUMBER, and the proof was worthless
    -- without one. It asserted that the public could read no lecturers on a
    -- harness where no lecturer existed — "never assert their data is empty",
    -- and this file broke that rule while being written to enforce it. Deleting
    -- the whole staff-directory fix still passed.
    insert into lecturers (staff_id, first_name, last_name, email, phone, auth_user_id)
      values ('ICOFSTF-9088', 'Proof', 'Lecturer',
              '088-lecturer@example.test', '+237600000088', fin_user);

    insert into payments (student_id, reference, amount, currency, purpose)
      values (the_student,   '088-PROOF-MINE',  500, 'USD', 'tuition'),
             (other_student, '088-PROOF-OTHER', 500, 'USD', 'tuition');

    insert into academic_years (label, starts_in, starts_on, ends_on)
      values ('2098/2099', 2098, '2098-09-01', '2099-06-30') returning id into the_year;
    insert into fee_schedules (name, session_label, status)
      values ('088 proof tariff — unpublished', '2098/2099', 'draft')
      returning id into sched;

    -- =====================================================================
    -- THE PUBLIC KEY, WITH NO SIGN-IN AT ALL
    -- =====================================================================
    set local role anon;
    set local request.jwt.claim.sub = '';

    -- REFUSED EITHER WAY COUNTS AS REFUSED, and there are two ways: the grant
    -- is gone, so Postgres raises `permission denied` before a policy is ever
    -- consulted. That is the stronger of the two outcomes — a right that does
    -- not exist cannot be restored by a policy written wrongly later — but the
    -- assertion has to accept both, or it fails on the safer arrangement.
    begin
      select count(*) into seen from payments;
      if seen <> 0 then
        raise exception '088 FAILED: the public anon key reads % payment(s) — it is in the '
                        'JavaScript bundle of every page of the website', seen;
      end if;
    exception when insufficient_privilege then null;
    end;

    begin
      select count(*) into seen from financial_clearances;
      if seen <> 0 then
        raise exception '088 FAILED: the public anon key reads the financial clearance register';
      end if;
    exception when insufficient_privilege then null;
    end;

    begin
      select count(*) into seen from student_fee_assessments;
      if seen <> 0 then
        raise exception '088 FAILED: the public anon key reads what individual students are '
                        'charged';
      end if;
    exception when insufficient_privilege then null;
    end;

    -- AND CANNOT FORGE A RECEIPT. Observed before this migration: it could,
    -- for 999999, and could then set it to 1.
    begin
      insert into payments (student_id, reference, amount, currency, purpose)
        values (the_student, '088-ANON-FORGERY', 999999, 'USD', 'tuition');
      raise exception '088 FAILED: the public anon key wrote a payment receipt for 999999 — '
                      'Finance is the first gate of admissions, so this forges a confirmation';
    exception
      when insufficient_privilege then null;
    end;

    begin
      delete from payments where reference = '088-PROOF-MINE';
      raise exception '088 FAILED: the public anon key deleted one of the University''s '
                      'payment records';
    exception
      when insufficient_privilege then null;
    end;

    -- AN UNPUBLISHED TARIFF IS NOT PUBLIC EITHER.
    select count(*) into seen from fee_schedules where id = sched;
    if seen <> 0 then
      raise exception '088 FAILED: an unpublished draft fee schedule is readable by the public';
    end if;

    -- =====================================================================
    -- A STUDENT
    -- =====================================================================
    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', stu_user);

    -- THEIR OWN PAYMENT, WHICH THEY MUST STILL SEE.
    select count(*) into seen from payments where student_id = the_student;
    if seen <> 1 then
      raise exception '088 FAILED: a student cannot see their own payment, so the Fees screen '
                      'is empty for everybody';
    end if;

    -- AND NOT ANOTHER STUDENT'S.
    select count(*) into seen from payments where student_id = other_student;
    if seen <> 0 then
      raise exception '088 FAILED: a student reads another student''s payments';
    end if;

    -- ---- TWO RECEIPT NUMBERS ARE NEVER THE SAME NUMBER --------------------
    --
    -- The block above is still signed in as the student, and the whole point
    -- of the next assertion is that they may not do this.
    reset role;
    --
    -- What the browser's `Date.now()` could not promise. Reserved twice in a
    -- row and compared, because a uniqueness constraint alone would let the
    -- SECOND officer's payment fail rather than the numbering be wrong.
    if reserve_receipt_number(2098) = reserve_receipt_number(2098) then
      raise exception '088 FAILED: two receipt reservations returned the same number, so the '
                      'second payment taken in that moment cannot be recorded at all';
    end if;

    -- AND NO BROWSER SESSION MAY RESERVE ONE.
    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', stu_user);
    begin
      perform reserve_receipt_number(2098);
      raise exception '088 FAILED: a student reserved a receipt number, so a client still '
                      'chooses the University''s institutional identifiers';
    exception
      when insufficient_privilege then null;
    end;
    reset role;

    -- ---- THE EXAMINATION QUESTION BANK ------------------------------------
    reset role;
    insert into module_records (module, kind, title, body)
      values ('exams', 'exam-question', '088 proof question',
              '{"text":"Which council met in 325?",'
              '"options":["Nicaea","Chalcedon","Trent","Ephesus"],"answer":0}'::jsonb);
    -- A row from a module students DO use, which must keep working.
    insert into module_records (module, kind, title, body)
      values ('forum', 'thread', '088 proof thread', '{}'::jsonb);

    set local role authenticated;
    execute format('set local request.jwt.claim.sub = %L', stu_user);

    select count(*) into seen from module_records where kind = 'exam-question';
    if seen <> 0 then
      raise exception '088 FAILED: a student reads the examination question bank, and the '
                      'banked row carries the index of the correct option beside the question';
    end if;

    -- AND THE MODULES THEY DO USE STILL WORK. A rule that also refuses the
    -- people who need the row is not a tighter rule, it is five broken screens.
    select count(*) into seen from module_records where module = 'forum';
    if seen <> 1 then
      raise exception '088 FAILED: a student can no longer read the discussion forum';
    end if;

    -- ---- THE STAFF DIRECTORY ----------------------------------------------
    set local role anon;
    set local request.jwt.claim.sub = '';
    begin
      select count(*) into seen from lecturers;
      if seen <> 0 then
        raise exception '088 FAILED: the public reads the lecturers table, which carries every '
                        'member of staff''s email, telephone number and account id';
      end if;
    exception when insufficient_privilege then null;
    end;

    -- BUT THE DIRECTORY STILL ANSWERS. Closing the table without opening the
    -- view would take the staff list off the public website.
    select count(*) into seen from lecturer_directory;
    if seen is null then
      raise exception '088 FAILED: the public staff directory does not answer at all';
    end if;

    reset role;

    raise exception 'rollback 088 proof';
  exception
    when others then
      reset role;
      if sqlerrm <> 'rollback 088 proof' then raise; end if;
  end;
end $$;


-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY IS ACTUALLY SWITCHED ON.
--
-- ASKED OF THE CATALOGUE, and separately from the proof above, because of what
-- the audit turned up while this file was being tested: THE UNIVERSITY MAY BE
-- IN EITHER OF TWO STATES, and the behavioural proof cannot tell which.
--
-- `payments` is created by BOTH `000_complete.sql` and `001_full_schema.sql`.
-- 000 says of itself "this is 001 and 002 merged... if you run this, you do
-- not need either of those files" — and it is not equivalent to them. It
-- enables row-level security on `payments`; 001 and 002 between them do not.
-- So a database bootstrapped from 000 has the protection and one bootstrapped
-- from 001 + 002 does not, and both are documented paths to "the schema".
--
-- That is why this is asserted against `pg_class` rather than by reading a
-- row: on the lineage that already had RLS on, every behavioural check passes
-- whether or not this migration enables it, and the migration would then be
-- vouching for a protection it did not apply. Here it is either on or the file
-- refuses.
-- ---------------------------------------------------------------------------
do $$
declare
  unprotected text;
begin
  select string_agg(c.relname, ', ') into unprotected
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and not c.relrowsecurity
     and c.relname in ('payments', 'fee_items', 'fee_schedules',
                       'financial_clearances', 'student_fee_assessments');
  if unprotected is not null then
    raise exception '088 FAILED: row-level security is still switched OFF on % — every '
                    'policy on those tables is decoration that has never been consulted',
                    unprotected;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- AND NO BROWSER SESSION MAY WRITE THEM.
--
-- The grant, asked of the catalogue for the same reason: with RLS on and no
-- INSERT policy the write is already refused, so a behavioural check passes
-- even with the grant left in place. Two protections, and the proof must be
-- able to see each on its own.
-- ---------------------------------------------------------------------------
do $$
declare
  writable text;
begin
  select string_agg(distinct t.table_name, ', ') into writable
    from information_schema.role_table_grants t
   where t.table_schema = 'public'
     and t.grantee in ('anon', 'authenticated')
     and t.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
     and t.table_name in ('payments', 'fee_items', 'fee_schedules',
                          'financial_clearances', 'student_fee_assessments');
  if writable is not null then
    raise exception '088 FAILED: a browser session still holds write on % — a receipt the '
                    'client writes for itself is one anybody can write for themselves',
                    writable;
  end if;

  -- AND THE PUBLISHABLE KEY HOLDS NO READ ON THE PRIVATE ONES.
  --
  -- Asked separately because the policy alone already refuses it: anon has no
  -- profile, so `auth_role()` is null and nothing matches. A behavioural check
  -- therefore passes with the grant left wide open, and the grant is the outer
  -- of the two locks — the one that does not depend on a policy being right.
  select string_agg(distinct t.table_name, ', ') into writable
    from information_schema.role_table_grants t
   where t.table_schema = 'public'
     and t.grantee = 'anon'
     and t.privilege_type = 'SELECT'
     and t.table_name in ('payments', 'financial_clearances',
                          'student_fee_assessments');
  if writable is not null then
    raise exception '088 FAILED: the publishable key still holds SELECT on % — that key is '
                    'in the JavaScript bundle of every page of the website', writable;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- AND THE DIRECTORY CARRIES NO CONTACT DETAILS.
--
-- Asserted against the catalogue rather than the file, and separately from the
-- proof above, because this is the guarantee that must survive somebody
-- "helpfully" widening the view later.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked text;
begin
  select string_agg(column_name, ', ') into leaked
    from information_schema.columns
   where table_name = 'lecturer_directory'
     and column_name in ('email', 'phone', 'auth_user_id', 'appointment_id');
  if leaked is not null then
    raise exception '088 FAILED: the public staff directory carries % — a policy cannot hide a '
                    'column, which is why this view exists at all', leaked;
  end if;
end $$;


do $$
begin
  raise notice '088 OK: the public key no longer reads, forges, alters or deletes the '
               'University''s payments, clearances or fee assessments';
  raise notice '088 OK: a student no longer reads the examination question bank, and the '
               'modules students do use still work';
  raise notice '088 OK: staff email, telephone and account id are no longer published; the '
               'public directory carries a name, a title and a field';
end $$;
