-- ===========================================================================
-- 109 — AN ABANDONED APPLICATION LEAVES THE REGISTER
-- ===========================================================================
--
-- The University, on the six rows filling their Students screen, every one of
-- them reading "Awaiting payment":
--
--   "STUDENT WHO FAIL IN THE APPLICATION PROCESS AND OR PAY NOT THEIR
--    APPLICATION FEE AND APPLICATION WAS NOT PROCESSED, THAT INFORMATION
--    SHOULD SOMEHOW OVER TIME BE DELETED OR REMOVE SOMEWHERE THAN REMAINING
--    ON THE DASHBOARD"
--
-- And, asked how: ninety days; the unpaid, the refused, the withdrawn and the
-- paid-but-never-processed; automatically, with the Registrar able to bring
-- one back.
--
-- ---------------------------------------------------------------------------
-- THIS IS NOT A DELETION, AND THAT IS THE POINT
-- ---------------------------------------------------------------------------
--
-- 108 built deletion: the Superadministrator asks, the Vice-Chancellor
-- decides, thirty days, gone. That is right for the handful of trial records
-- made while testing the system, and wrong for this — there will be hundreds
-- of abandoned applications over the years, each one needing a request and an
-- approval, and the University would spend longer clearing the register than
-- using it.
--
-- NOTHING HERE IS DESTROYED. An abandoned application leaves the Students
-- register and the dashboard counts, and is read on a screen of its own. The
-- evidence that somebody applied survives, because that is occasionally the
-- thing somebody needs.
--
-- ---------------------------------------------------------------------------
-- AND NOTHING HAS TO RUN
-- ---------------------------------------------------------------------------
--
-- There is no job, no schedule and no row to write. An application is
-- abandoned because of its OWN dates and its own status, so staleness is
-- computed when it is asked about rather than stored by something that has to
-- remember to run.
--
-- That matters more than it sounds. A stored flag set by a nightly task is a
-- flag that is wrong whenever the task did not run, and nobody notices for
-- weeks. A computed one cannot be stale by construction: the ninetieth day
-- arrives whether anybody is watching or not.
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES FOR THE UNIVERSITY THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- 1. APPLICATIONS OLDER THAN NINETY DAYS LEAVE THE STUDENTS REGISTER AT ONCE,
--    if they were never paid for, were refused, were withdrawn, were asked for
--    documents that never came, or were paid and never processed. That is a
--    visible change to a screen the University uses, and it is the one they
--    asked for.
--
--    HOW MANY depends on their data; the six on the screen were all recent, so
--    they stay until their ninetieth day.
--
-- 2. NOTHING IS DELETED, HIDDEN FROM THE REGISTRY, OR CHANGED. No row is
--    written by this migration at all. `archived_applications` shows every one
--    of them to the offices that admit people, and `restore_application()`
--    puts one back.
--
-- 3. ONE OF THE FIVE KINDS IS A PROBLEM AND NOT CLUTTER. An application that
--    was PAID FOR and never processed is money the University took for
--    nothing. The University asked for those to age out too, and they do —
--    but `applications_paid_and_never_processed` lists them separately and
--    for ever, because a thing that leaves the screen quietly is a thing
--    nobody ever answers for.
--
-- 4. A GAP 108 LEFT IS CLOSED ON THE WAY PAST. SELECT policies are OR'ed, and
--    `students_national_read` — the National Rector reading the students of
--    their own administration — did not carry 108's erasure clause. A record
--    the Vice-Chancellor had approved for deletion was hidden from the
--    Registrar and still plainly visible to the Rector. It is narrowed here
--    for both reasons at once.
--
-- ===========================================================================


-- ===========================================================================
-- 1. HOW LONG, AND WHICH ONES
-- ===========================================================================
--
-- NINETY DAYS IS THE UNIVERSITY'S ANSWER, not this migration's assumption, and
-- it is a function rather than a literal sprinkled through four places so that
-- changing it is one edit and cannot be changed in three places out of four.
-- ---------------------------------------------------------------------------

create or replace function application_abandoned_after()
returns interval
language sql
immutable
as $$ select interval '90 days' $$;

comment on function application_abandoned_after() is
  'How long an application stays on the register after it is abandoned. Ninety days, by the '
  'University''s decision: long enough that a slow payer is never lost, short enough that each '
  'intake clears before the next.';


-- ---------------------------------------------------------------------------
-- WHETHER A PARTICULAR APPLICATION HAS BEEN ABANDONED.
--
-- STABLE AND NOT IMMUTABLE: it reads the clock. That is also why nothing can
-- index it, which is fine at this size and is said here so the next person
-- does not try.
--
-- IT DOES NOT TAKE `payment_status`, and that is deliberate rather than an
-- omission. Whether the fee was received changes WHY an application was
-- abandoned — which the archive reports — but never WHETHER: an application
-- the University was paid for and never processed ages off the register at
-- ninety days exactly like one nobody paid for. A parameter the body ignores
-- is a parameter that lies to the next reader about what the answer depends
-- on, so there is not one.
--
-- `restored_at` IS THE EXEMPTION. When the Registrar brings one back it is
-- stamped, and the ninety days start again from that moment — so a restored
-- application does not vanish again the next time the screen is drawn, which
-- would make the Restore button look broken.
-- ---------------------------------------------------------------------------

create or replace function application_is_abandoned(
  the_status  text,
  made_at     timestamptz,
  decided_at  timestamptz,
  restored_at timestamptz
)
returns boolean
language sql
stable
as $$
  select
    -- NEVER AN ADMITTED STUDENT. `enrolled`, `admission_issued`, `approved`
    -- and `conditional` are people the University has taken in; nothing here
    -- touches them, and the list below is POSITIVE rather than an exclusion
    -- for exactly that reason — a status added next year is not silently
    -- archived by a migration written before it existed.
    --
    -- `under_review`, `admission_processing` and `returned` are absent too,
    -- and for a different reason: those are on the University's OWN desk. An
    -- application sitting there for ninety days is the University's backlog,
    -- and hiding a backlog is not tidying.
    the_status in (
      'draft', 'applicant', 'fee_pending',      -- never paid
      'rejected', 'declined',                   -- refused by the University
      'withdrawn',                              -- taken back by the applicant
      'documents_required',                      -- documents asked for, never sent
      'fee_paid', 'documents_verified', 'registrar_approved',
      'ready_for_academic_review'               -- paid, and never processed
    )
    and coalesce(restored_at, decided_at, made_at) < now() - application_abandoned_after();
$$;

comment on function application_is_abandoned(text, timestamptz, timestamptz, timestamptz) is
  'Whether an application has been abandoned long enough to leave the register. Computed from '
  'the row''s own dates, so there is no job to run and no stored flag to go stale. Counted '
  'from the LAST thing that happened to it — its restoration, its decision, or its making. '
  'The statuses are listed positively: a status invented after this function was written is '
  'never archived by it, and one on the University''s own desk is never archived at all.';


-- ===========================================================================
-- 2. BRINGING ONE BACK
-- ===========================================================================
--
-- The Registrar's, and it needs no approval: nothing was lost, so nothing is
-- being undone. It stamps `restored_to_register_at`, which both exempts the
-- row for another ninety days and records that somebody did it.
-- ---------------------------------------------------------------------------

alter table students
  add column if not exists restored_to_register_at timestamptz,
  add column if not exists restored_by uuid references auth.users (id) on delete set null;

comment on column students.restored_to_register_at is
  'When an abandoned application was brought back onto the register. The ninety days run again '
  'from here, so a restored application does not vanish the next time a screen is drawn.';


-- ---------------------------------------------------------------------------
-- SECURITY DEFINER, because of a circularity rather than for convenience: the
-- row this function is asked to restore is, by definition, one the caller
-- cannot see. An ordinary `update … where id = …` with a RETURNING clause is
-- checked against the SELECT policy, which hides it. So the function reads and
-- writes past the policy and names the offices itself.
--
-- WHICH IS WHY IT REFUSES BY ROLE IN ITS FIRST LINES, and why those lines are
-- the first thing the proof at the foot of this file breaks.
-- ---------------------------------------------------------------------------

create or replace function restore_application(
  the_application uuid,
  the_officer     uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nm text;
begin
  -- -----------------------------------------------------------------------
  -- THE SERVICE KEY IS THE APPLICATION, AND ITS ROUTE HAS ALREADY GUARDED IT.
  --
  -- Every write in this system arrives through a route that calls `guard()`,
  -- which reads the role matrix AND 056's capability grants. A list of offices
  -- here that the service key had to satisfy would be a SECOND opinion about
  -- who may — and it would silently refuse a grant the University had
  -- deliberately issued, which is the worst of both: a rule in two places,
  -- disagreeing.
  --
  -- SO THIS CHECK IS FOR DIRECT SQL, where no route has guarded anything.
  --
  -- AND IT REFUSES AN UNKNOWN ROLE RATHER THAN PASSING A NULL ONE. Written the
  -- obvious way — `if auth_role() not in (…)` — a null role makes the whole
  -- comparison NULL, the IF is not taken, and the call SUCCEEDS: a signed-in
  -- account with no `profiles` row would have restored at will. That is not a
  -- rule, it is an accident that happens to hold, so the coalesce is explicit.
  -- -----------------------------------------------------------------------
  -- BOTH OPERANDS COALESCED, AND THE SECOND ONE WAS NOT, AT FIRST.
  --
  -- The note above is about `auth_role()` going null, and it was right; what
  -- it missed is that `auth.role()` — Supabase's, the one with the dot — does
  -- exactly the same thing. Its real definition has no fallback:
  --
  --   coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
  --            nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  --
  -- so on a session with no claims it is NULL, `NULL <> 'service_role'` is
  -- NULL, `NULL and anything` is NULL, the IF is not taken, and the function
  -- carries on and restores the application. The guard was the wrong way round
  -- from the failure it was written to prevent.
  --
  -- IT PASSED HERE AND FAILED ON THE UNIVERSITY'S DATABASE, which is the part
  -- worth remembering: `tests/supabase-stub.sql` defined `auth.role()` with a
  -- final `, 'anon'` that Supabase does not have, so the comparison was
  -- 'anon' <> 'service_role' — true — and every proof passed. The stub has
  -- been corrected to match, and it now reproduces the failure exactly.
  if coalesce(auth.role(), '') <> 'service_role'
     and coalesce(auth_role(), '') not in ('superadmin', 'admin', 'registrar') then
    raise exception 'Only the Office of the Registrar may return an application to the register';
  end if;

  select trim(both ' ' from coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
    into nm
    from students
   where id = the_application;

  if nm is null then
    raise exception 'There is no such application';
  end if;

  update students
     set restored_to_register_at = now(),
         -- WHOEVER IS SIGNED IN, AND ONLY OTHERWISE WHAT WAS PASSED. The
         -- parameter exists because the service key has no `auth.uid()` to
         -- read and the route knows who asked; `auth.uid()` wins wherever
         -- there is one, so a browser cannot name somebody else as the
         -- officer by sending it.
         restored_by             = coalesce(auth.uid(), the_officer)
   where id = the_application;

  return the_application;
end;
$$;

-- `anon` BY NAME, not only PUBLIC. The project's default privileges hand EXECUTE
-- to `anon` explicitly at the moment a function in `public` is created, and a
-- revoke from PUBLIC does not touch an explicit grant — so the obvious
-- `revoke all … from public` leaves the publishable key able to call this. The
-- body refuses it anyway, having no role to match; this is the second lock, and
-- it is the one that does not depend on reading the body correctly.
revoke all on function restore_application(uuid, uuid) from public, anon;
grant execute on function restore_application(uuid, uuid) to authenticated;

comment on function restore_application(uuid, uuid) is
  'Returns an abandoned application to the Students register, for another ninety days. The '
  'Registrar''s, and needing nobody''s approval, because nothing was deleted. SECURITY DEFINER '
  'out of necessity: the row is one the caller cannot see, which is the whole point of it being '
  'archived — so the function names the offices that may call it in its own first lines.';


-- ===========================================================================
-- 3. IT LEAVES THE REGISTER
-- ===========================================================================
--
-- The read policy, narrowed once more. 105 added the Vice-Chancellor and the
-- Chancellor, who read zero students before it; 108 hid what is approved for
-- deletion from everybody except the two who can restore it; this hides what
-- has been abandoned from everybody.
--
-- FROM EVERYBODY, INCLUDING THE REGISTRAR. An archive somebody still sees on
-- the main register is not an archive, and the Registrar reads
-- `archived_applications` instead — a screen that says what it is.
--
-- The whole policy is written out rather than referred to, for the reason 105
-- gave: a policy is a sentence, and half a sentence cannot be read.
-- ---------------------------------------------------------------------------

drop policy if exists students_staff_read on students;
create policy students_staff_read on students
  for select using (
    (
      auth_role() in (
        'superadmin', 'admin', 'registrar', 'finance', 'finance-director',
        'admissions-officer', 'dean', 'hod', 'programme-coordinator',
        'academic-office', 'student-affairs', 'vice-chancellor', 'chancellor'
      )
      or (auth_role() = 'lecturer' and teaches_this_student(id))
    )
    -- 108: approved for deletion, and visible only to the two who can still
    -- bring it back.
    and (
      not is_awaiting_erasure('students', id)
      or auth_role() in ('superadmin', 'vice-chancellor')
    )
    -- 109: abandoned, and visible on the archive instead.
    and not application_is_abandoned(status, created_at, decided_at, restored_to_register_at)
  );

comment on policy students_staff_read on students is
  'Who may read the student register, and which rows. 105 added the Vice-Chancellor and the '
  'Chancellor, who read zero students before it. 108 hides a record approved for deletion from '
  'everybody except the two who can restore it. 109 hides an abandoned application from '
  'everybody: it is read on `archived_applications` instead, which says what it is.';


-- ---------------------------------------------------------------------------
-- AND THE SAME TWO CLAUSES ON THE NATIONAL RECTOR'S POLICY, which is the gap
-- 108 left.
--
-- POSTGRES OR'S SELECT POLICIES. Narrowing one and not the other narrows
-- nothing: a record the Vice-Chancellor had approved for deletion disappeared
-- from the Registrar's register and sat in plain view on the Rector's, and an
-- abandoned application would have done the same. A rule that holds for one
-- reader and not another is not a rule.
--
-- The Rector's clause is otherwise untouched: their own administration's
-- students, and nobody else's.
-- ---------------------------------------------------------------------------

drop policy if exists students_national_read on students;
create policy students_national_read on students
  for select using (
    administration_id is not null
    and administration_id = my_administration()
    and (
      not is_awaiting_erasure('students', id)
      or auth_role() in ('superadmin', 'vice-chancellor')
    )
    and not application_is_abandoned(status, created_at, decided_at, restored_to_register_at)
  );

comment on policy students_national_read on students is
  'The National Rector reads the students of their own administration and nobody else''s. '
  'Carries 108''s erasure clause and 109''s abandonment clause, because SELECT policies are '
  'OR''ed and a row hidden by one policy is still shown by another — 108 narrowed only the '
  'staff policy, and a record approved for deletion stayed plainly visible here.';


-- ===========================================================================
-- 4. WHERE THEY GO
-- ===========================================================================
--
-- SECURITY DEFINER, and this is the one place in the scheme where that is the
-- right answer rather than the lazy one. A `security_invoker` view would read
-- with the caller's rights and therefore through the policy above — which
-- hides exactly the rows this view exists to show. The view would be empty for
-- everybody, for ever.
--
-- So the view bypasses the policy and does the restricting itself, in its own
-- WHERE clause, naming the same offices. That is a thing to be careful about
-- and it is why the list is here in full rather than inherited.
-- ---------------------------------------------------------------------------

drop view if exists archived_applications;

create view archived_applications
with (security_invoker = false) as
  select s.id,
         s.matric_no,
         s.student_number,
         trim(both ' ' from coalesce(s.first_name, '') || ' ' || coalesce(s.last_name, ''))
           as full_name,
         s.email,
         s.phone,
         s.program,
         s.intake,
         s.status,
         s.payment_status,
         s.created_at,
         s.decided_at,
         s.decision_reason,
         s.restored_to_register_at,
         -- WHY IT LEFT, in a word the screen can group by. The refusals and
         -- the withdrawal are read off the status; the difference between
         -- "nobody paid" and "the University was paid" is read off
         -- `payment_status`, because a fee can be registered without the
         -- status having moved on and the archive must not call that unpaid.
         case
           when s.status in ('rejected', 'declined')              then 'refused'
           when s.status = 'withdrawn'                            then 'withdrawn'
           when s.status = 'documents_required'                   then 'documents-never-sent'
           when s.payment_status = 'verified'
             or s.status in ('fee_paid', 'documents_verified',
                             'registrar_approved',
                             'ready_for_academic_review')         then 'paid-never-processed'
           else 'never-paid'
         end as why,
         extract(day from now() - coalesce(s.restored_to_register_at,
                                           s.decided_at, s.created_at))::integer as days_idle
    from students s
   where application_is_abandoned(
           s.status, s.created_at, s.decided_at, s.restored_to_register_at)
     -- THE VIEW DOES ITS OWN RESTRICTING, because it reads past the policy.
     and auth_role() in ('superadmin', 'admin', 'registrar', 'admissions-officer',
                         'academic-office', 'vice-chancellor');

comment on view archived_applications is
  'Applications that have left the register: never paid for, refused, withdrawn, asked for '
  'documents that never came, or paid and never processed, and more than ninety days idle. '
  'Nothing here is deleted. security_invoker is OFF deliberately — a view reading with the '
  'caller''s rights would read through the very policy that hides these rows, and would be '
  'empty for everybody — so it names the offices that may read it itself.';


-- ---------------------------------------------------------------------------
-- AND IT IS READ-ONLY, WHICH IS NOT A FORMALITY.
--
-- This was found by asking Postgres rather than by reading the SQL, and it is
-- worth writing down because the reasoning that makes it safe is wrong:
--
--   select table_name, is_updatable from information_schema.views
--    where table_name = 'archived_applications';   -->  YES
--
-- A view over ONE table with no join, aggregate, DISTINCT or GROUP BY is
-- AUTOMATICALLY UPDATABLE, whatever it is named and whatever it is for. Three
-- of its columns are expressions and so are not writable, but `status`,
-- `payment_status` and the rest are ordinary references and are. The project's
-- default grants hand `authenticated` INSERT, UPDATE and DELETE on every new
-- view. And because this view is deliberately NOT `security_invoker`, a write
-- through it would execute as the owner — PAST the row policy on `students`.
--
-- So any signed-in account could have rewritten an application's status, or
-- deleted the row outright, through a view whose whole purpose is reading. The
-- fifteen other definer views in the schema all report `is_updatable = NO`,
-- because each has a join or an aggregate that happens to disqualify it — they
-- are safe by accident, and this one would not have been.
--
-- The privilege is therefore removed whole and SELECT handed back alone. `anon`
-- loses it entirely: an unauthenticated caller has no business here, and while
-- the WHERE clause above would refuse them anyway, two locks on a door that
-- reads past the policy is the right number.
-- ---------------------------------------------------------------------------

revoke all on archived_applications from anon, authenticated;
grant select on archived_applications to authenticated;


-- ---------------------------------------------------------------------------
-- AND THE ONE KIND THAT IS A PROBLEM RATHER THAN CLUTTER
-- ---------------------------------------------------------------------------
--
-- The University asked for paid-but-never-processed applications to age out
-- with the rest, and they do. But money was taken and nothing happened, and a
-- thing that leaves the screen quietly is a thing nobody ever answers for — so
-- these are also listed on their own, with no age limit at all, from the day
-- the payment was taken.
--
-- NO NINETY DAYS ON THIS ONE. An unprocessed paid application is worth looking
-- at on its second day, not its ninety-first.
--
-- A REFUNDED FEE IS NOT MONEY TAKEN FOR NOTHING. 102 made a refund a
-- transaction related to the payment rather than an edit of it, and the
-- application's `payment_status` becomes `refunded`; the University is no
-- longer holding anything, so it does not belong on a list of money owed an
-- explanation.
--
-- security_invoker IS ON, unlike the archive above, and for a reason worth
-- stating: these rows are NOT hidden by the register's policy until their
-- ninetieth day, so the ordinary rules reach them. Past that day the row
-- leaves this list too — which is why `already_archived` is a column: the
-- screen reads the archive for the older ones and says so.
-- ---------------------------------------------------------------------------

drop view if exists applications_paid_and_never_processed;

create view applications_paid_and_never_processed
with (security_invoker = true) as
  select s.id,
         s.matric_no,
         s.student_number,
         trim(both ' ' from coalesce(s.first_name, '') || ' ' || coalesce(s.last_name, ''))
           as full_name,
         s.email,
         s.program,
         s.status,
         s.payment_status,
         s.fee_reference,
         s.fee_amount,
         s.fee_currency,
         s.fee_registered_at,
         s.created_at,
         extract(day from now() - coalesce(s.fee_registered_at, s.created_at))::integer
           as days_waiting,
         application_is_abandoned(
           s.status, s.created_at, s.decided_at, s.restored_to_register_at) as already_archived
    from students s
   where
     -- NOT DECIDED. Every status before a decision is taken, and none after:
     -- an application that was refused with the fee correctly paid is not
     -- money taken for nothing, it is a decision somebody made.
     s.status in ('draft', 'applicant', 'fee_pending', 'fee_paid', 'under_review',
                  'documents_required', 'documents_verified', 'registrar_approved',
                  'ready_for_academic_review')
     -- AND PAID FOR. Either Finance registered the fee, or the status itself
     -- says the money arrived.
     and (
       s.payment_status = 'verified'
       or s.status in ('fee_paid', 'documents_verified', 'registrar_approved',
                       'ready_for_academic_review')
     )
     and coalesce(s.payment_status, '') <> 'refunded';

comment on view applications_paid_and_never_processed is
  'Applications the University has been paid for and has not finished processing, from the day '
  'the payment was taken and with no age limit. They age off the register with everything else '
  'after ninety days; this is so that leaving the screen is not the same as being answered '
  'for. A refunded fee is not here — the University is no longer holding it. security_invoker, '
  'because these rows are NOT hidden by the register''s policy until they are ninety days old.';

-- READ-ONLY FOR THE SAME REASON, though not for the same stakes: this one is
-- `security_invoker`, so a write through it would be checked against the
-- register's own update policy rather than running as the owner. It is still a
-- list, and a list that can be written to is not a list.
revoke all on applications_paid_and_never_processed from anon, authenticated;
grant select on applications_paid_and_never_processed to authenticated;


-- ===========================================================================
-- 5. THE PROOF
-- ===========================================================================
--
-- SIX OF THIS PROOF'S OWN APPLICATIONS, at dates it chooses, in a nation it
-- invents. It never counts the University's applications and never asserts how
-- many they have: a proof that holds an opinion about their data fails them
-- for using the system.
-- ===========================================================================

do $$
declare
  reg       uuid := gen_random_uuid();
  rector    uuid := gen_random_uuid();
  nation    uuid;
  fresh     uuid;
  unpaid    uuid;
  refused_  uuid;
  paid      uuid;
  docs      uuid;
  enrolled_ uuid;
  seen      integer;
  t         text;
  refused_by_role boolean := false;
begin
  insert into auth.users (id, email) values
    (reg,    'proof-109-registrar@example.invalid'),
    (rector, 'proof-109-rector@example.invalid');
  insert into profiles (id, email, full_name, role) values
    (reg,    'proof-109-registrar@example.invalid', 'Proof Registrar 109', 'registrar'),
    (rector, 'proof-109-rector@example.invalid',    'Proof Rector 109',    'national-rector')
  on conflict (id) do update set role = excluded.role;

  -- A NATION OF THIS PROOF'S OWN. `national_administrations_one_per_country`
  -- is unique on the country, so the proof invents one that cannot be a real
  -- one rather than borrowing a country the University may have established.
  insert into national_administrations (country, name, status, rector_id)
       values ('Proof Country 109', 'Proof National Administration 109', 'proposed', rector)
    returning id into nation;

  insert into students (matric_no, first_name, last_name, status, created_at)
       values ('PROOF-109-FRESH', 'Proof', 'Fresh-109', 'applicant', now() - interval '10 days')
    returning id into fresh;
  insert into students (matric_no, first_name, last_name, status, created_at, administration_id)
       values ('PROOF-109-UNPAID', 'Proof', 'Unpaid-109', 'applicant',
               now() - interval '200 days', nation)
    returning id into unpaid;
  insert into students (matric_no, first_name, last_name, status, created_at, decided_at)
       values ('PROOF-109-REFUSED', 'Proof', 'Refused-109', 'rejected',
               now() - interval '300 days', now() - interval '200 days')
    returning id into refused_;
  insert into students (matric_no, first_name, last_name, status, payment_status,
                        fee_reference, created_at)
       values ('PROOF-109-PAID', 'Proof', 'PaidNotDone-109', 'fee_paid', 'verified',
               'PROOF-109-FEE', now() - interval '200 days')
    returning id into paid;
  insert into students (matric_no, first_name, last_name, status, payment_status, created_at)
       values ('PROOF-109-DOCS', 'Proof', 'DocsNeverSent-109', 'documents_required',
               'verified', now() - interval '200 days')
    returning id into docs;
  insert into students (matric_no, first_name, last_name, status, created_at, student_number)
       values ('PROOF-109-ENROLLED', 'Proof', 'Enrolled-109', 'enrolled',
               now() - interval '900 days', 'PROOF-109-ENROLLED')
    returning id into enrolled_;

  -- ---- A RECENT APPLICATION STAYS ---------------------------------------
  if application_is_abandoned('applicant', now() - interval '10 days', null, null) then
    raise exception '109 FAILED — a ten-day-old application was treated as abandoned';
  end if;
  raise notice '109 OK  a recent application stays on the register';

  -- ---- AND AN OLD UNPAID ONE DOES NOT -----------------------------------
  if not application_is_abandoned('applicant', now() - interval '200 days', null, null) then
    raise exception '109 FAILED — a two-hundred-day-old unpaid application is still current';
  end if;
  raise notice '109 OK  …and one nobody paid for, two hundred days on, does not';

  -- ---- AN ADMITTED STUDENT IS NEVER TOUCHED -----------------------------
  --
  -- The assertion that matters most. Everything else here is tidying; this one
  -- is the difference between tidying and losing people.
  foreach t in array array['enrolled', 'admission_issued', 'approved', 'conditional']
  loop
    if application_is_abandoned(t, now() - interval '900 days', null, null) then
      raise exception '109 FAILED — a student at status "%" and nine hundred days was archived', t;
    end if;
  end loop;
  raise notice '109 OK  an admitted or enrolled student is never archived, at any age';

  -- ---- AND NEITHER IS THE UNIVERSITY'S OWN BACKLOG ----------------------
  --
  -- `under_review` is on the Admissions Office's desk and `admission_processing`
  -- is halfway through issuance. Ninety days of either is the University's own
  -- delay, and hiding a delay is not tidying.
  foreach t in array array['under_review', 'admission_processing', 'returned', 'deferred']
  loop
    if application_is_abandoned(t, now() - interval '900 days', null, null) then
      raise exception '109 FAILED — "%" is on the University''s own desk and was archived', t;
    end if;
  end loop;
  raise notice '109 OK  …nor is anything still sitting on the University''s own desk';

  -- ---- THEY LEAVE THE REGISTER ------------------------------------------
  --
  -- RLS does not apply to the owner, so this changes role or it proves
  -- nothing at all.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', reg::text, true);
  select count(*) into seen from students where id in (unpaid, refused_, paid, docs);
  reset role;
  if seen <> 0 then
    raise exception '109 FAILED — % abandoned application(s) are still on the register', seen;
  end if;
  raise notice '109 OK  an abandoned application leaves the Students register and the counts';

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', reg::text, true);
  select count(*) into seen from students where id in (fresh, enrolled_);
  reset role;
  if seen <> 2 then
    raise exception '109 FAILED — the register lost % of two rows it must keep', 2 - seen;
  end if;
  raise notice '109 OK  …and nothing else does';

  -- ---- INCLUDING FROM THE NATIONAL RECTOR, WHICH 108 DID NOT ------------
  --
  -- SELECT policies are OR'ed. Before this migration `students_national_read`
  -- answered for every student of the administration with no clause about
  -- erasure or abandonment at all, so narrowing the staff policy narrowed
  -- nothing. The Rector's own student is the one asserted on.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', rector::text, true);
  select count(*) into seen from students where id = unpaid;
  reset role;
  if seen <> 0 then
    raise exception '109 FAILED — the National Rector still reads an abandoned application';
  end if;
  raise notice '109 OK  …including from the National Rector, whose policy 108 had not narrowed';

  -- ---- AND THEY ARE READABLE ON THE ARCHIVE -----------------------------
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', reg::text, true);
  select count(*) into seen from archived_applications
   where id in (unpaid, refused_, paid, docs);
  reset role;
  if seen <> 4 then
    raise exception '109 FAILED — the archive shows % of four abandoned applications', seen;
  end if;
  raise notice '109 OK  …they are all readable on the archive, which is not a deletion';

  -- EACH SAYING WHY IT LEFT.
  select why into t from archived_applications where id = refused_;
  if t <> 'refused' then
    raise exception '109 FAILED — a refused application left for reason "%"', t;
  end if;
  select why into t from archived_applications where id = paid;
  if t <> 'paid-never-processed' then
    raise exception '109 FAILED — a paid, unprocessed application left for reason "%"', t;
  end if;
  select why into t from archived_applications where id = docs;
  if t <> 'documents-never-sent' then
    raise exception '109 FAILED — an application whose documents never came left for "%"', t;
  end if;
  select why into t from archived_applications where id = unpaid;
  if t <> 'never-paid' then
    raise exception '109 FAILED — an application nobody paid for left for reason "%"', t;
  end if;
  raise notice '109 OK  …each one saying why it left';

  -- AND THE ARCHIVE IS NOT READABLE BY SOMEBODY WHO IS NOT AN ADMISSIONS
  -- OFFICE. The view reads past the policy, so this is the only thing standing
  -- between an archived application and a lecturer.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', rector::text, true);
  select count(*) into seen from archived_applications;
  reset role;
  if seen <> 0 then
    raise exception '109 FAILED — an office with no admissions business read % archived rows', seen;
  end if;
  raise notice '109 OK  …and the archive, which reads past the policy, refuses everybody else';

  -- AND NOBODY WRITES THROUGH IT. PROVED BY BREAKING IT, because the thing
  -- that makes this dangerous is invisible in the SQL: the view is over one
  -- table with no join, so Postgres makes it automatically updatable, and it
  -- is deliberately not security_invoker, so a write would land as the owner
  -- and past the row policy on `students` altogether.
  refused_by_role := false;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', reg::text, true);
    update archived_applications set status = 'enrolled' where id = refused_;
    reset role;
  exception
    -- THE SQLSTATE, NOT `others`. A refusal is only a proof if it is the
    -- refusal being claimed: `when others` would have passed just as happily
    -- on a typo in the column name, and reported that the lock holds.
    when insufficient_privilege then
      reset role;
      refused_by_role := true;
  end;
  if not refused_by_role then
    raise exception '109 FAILED — an application was rewritten THROUGH the archive, past the '
                    'row policy, by an ordinary signed-in account';
  end if;
  select status into t from students where id = refused_;
  if t <> 'rejected' then
    raise exception '109 FAILED — the archive write was refused and the row changed anyway, '
                    'to "%"', t;
  end if;
  raise notice '109 OK  …and nothing can be WRITTEN through it: the view is read-only, which '
               'an auto-updatable definer view is not by default';

  -- ---- MONEY TAKEN FOR NOTHING IS LISTED FROM DAY ONE -------------------
  select count(*) into seen from applications_paid_and_never_processed
   where id in (paid, docs);
  if seen <> 2 then
    raise exception '109 FAILED — % of two paid, unprocessed applications are on no list', seen;
  end if;
  -- AND A REFUSAL IS NOT. The fee was paid and a decision was taken; the
  -- University owes an explanation for inaction, not for deciding.
  select count(*) into seen from applications_paid_and_never_processed where id = refused_;
  if seen <> 0 then
    raise exception '109 FAILED — a refused application is listed as money taken for nothing';
  end if;
  raise notice '109 OK  and one the University was PAID for and never processed is listed '
               'separately, with no age limit — a refusal is not';

  -- A REFUNDED FEE LEAVES THAT LIST, because nothing is being held.
  update students set payment_status = 'refunded' where id = paid;
  select count(*) into seen from applications_paid_and_never_processed where id = paid;
  if seen <> 0 then
    raise exception '109 FAILED — a refunded fee is still listed as money taken for nothing';
  end if;
  update students set payment_status = 'verified' where id = paid;
  raise notice '109 OK  …and a refunded fee leaves it, because nothing is being held';

  -- ---- THE REGISTRAR BRINGS ONE BACK ------------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', reg::text, true);
  perform restore_application(unpaid);
  select count(*) into seen from students where id = unpaid;
  reset role;
  if seen <> 1 then
    raise exception '109 FAILED — a restored application did not come back';
  end if;
  raise notice '109 OK  the Registrar can bring one back, with no approval, because nothing '
               'was lost';

  -- AND NOBODY ELSE CAN. PROVED BY BREAKING IT: a rule nobody has watched
  -- refuse anything is a rule nobody has tested.
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', rector::text, true);
    perform restore_application(refused_);
    reset role;
  exception
    when others then
      reset role;
      -- THE MESSAGE IS CHECKED, not merely the fact that something threw. A
      -- bare `when others` reports a passing guard when the call failed for a
      -- missing column, a typo or a null — which is how a rule nobody has
      -- watched refuse anything comes to look tested.
      if sqlerrm not like 'Only the Office of the Registrar%' then
        raise exception '109 FAILED — restoring was refused, but for the wrong reason: %', sqlerrm;
      end if;
      refused_by_role := true;
  end;
  if not refused_by_role then
    raise exception '109 FAILED — an office with no admissions business restored an application';
  end if;
  raise notice '109 OK  …and an office with no admissions business is refused when it tries';

  -- NOR CAN A SIGNED-IN ACCOUNT WITH NO PROFILE AT ALL, which is the case the
  -- obvious spelling of the guard would have let through: `auth_role()` is
  -- null, `null not in (…)` is NULL, the IF is not taken and the restore
  -- happens. There is no profile row for `stranger`, deliberately.
  refused_by_role := false;
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
    perform restore_application(refused_);
    reset role;
  exception
    when others then
      reset role;
      if sqlerrm not like 'Only the Office of the Registrar%' then
        raise exception '109 FAILED — a profile-less caller was refused for the wrong reason: %',
          sqlerrm;
      end if;
      refused_by_role := true;
  end;
  if not refused_by_role then
    raise exception '109 FAILED — an account with no profile row restored an application, '
                    'which is what `null not in (…)` evaluating to NULL does';
  end if;
  raise notice '109 OK  …nor can a signed-in account the register has no profile for';

  -- AND THE PUBLISHABLE KEY CANNOT EVEN CALL IT. Asked rather than reasoned
  -- about, because the answer was NO the first time it was asked and the
  -- revoke above is what changed it: default privileges grant `anon` EXECUTE
  -- by name when a function in `public` is created, and revoking from PUBLIC
  -- does not remove a grant made to a role.
  if has_function_privilege('anon', 'restore_application(uuid, uuid)', 'EXECUTE') then
    raise exception '109 FAILED — the publishable key may execute restore_application';
  end if;
  if not has_function_privilege('authenticated',
                                'restore_application(uuid, uuid)', 'EXECUTE') then
    raise exception '109 FAILED — a signed-in office may NOT execute restore_application, so '
                    'the Restore button cannot work at all';
  end if;
  raise notice '109 OK  …and the publishable key cannot so much as call it, while a signed-in '
               'office can';

  -- AND THE APPLICATION'S OWN SERVICE KEY CAN, because its route has already
  -- asked `guard()` — which reads the role matrix AND 056's capability grants,
  -- and is the one authority on who may. A second list here would refuse a
  -- grant the University had deliberately issued.
  --
  -- IT NAMES THE OFFICER IT ACTED FOR, since a service key has no `auth.uid()`
  -- to read and a restoration date with nobody against it is half a record.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform restore_application(docs, reg);
  perform set_config('request.jwt.claim.role', '', true);
  reset role;
  select restored_by::text into t from students where id = docs;
  if t is distinct from reg::text then
    raise exception '109 FAILED — the service key restored an application and recorded the '
                    'officer as "%"', coalesce(t, 'nobody');
  end if;
  raise notice '109 OK  …while the application''s own service key can, naming the officer it '
               'acted for';

  -- AND IT DOES NOT VANISH AGAIN ON THE NEXT DRAW. The ninety days run from
  -- the restoration, or the Restore button would look broken.
  if application_is_abandoned('applicant', now() - interval '200 days', null, now()) then
    raise exception '109 FAILED — a just-restored application was archived again at once';
  end if;
  raise notice '109 OK  …and it does not vanish again the moment the screen is redrawn';

  raise exception 'ROLLBACK 109';
exception
  when others then
    if sqlerrm = 'ROLLBACK 109' then
      raise notice '109 OK  every proof above rolled back; no application of the '
                   'University''s was read, counted or written to';
    else
      raise;
    end if;
end $$;


-- ===========================================================================
-- 6. DONE
-- ===========================================================================
do $$
begin
  raise notice '109 APPLIED  an application that was never paid for, was refused, was '
               'withdrawn, had documents asked for that never came, or was paid and never '
               'processed leaves the Students register ninety days on. NOTHING IS DELETED: it '
               'is read on the archive, and the Registrar can bring one back without '
               'anybody''s approval. An admitted or enrolled student is never touched, at any '
               'age, and neither is anything still on the University''s own desk.';
end $$;
