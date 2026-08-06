-- ===========================================================================
-- ICOF Global University — the admissions pipeline: reads, writes and gates
--
-- Two things in one file, because they are the same subject and running one
-- without the other leaves the pipeline half-wired:
--
--   1. The fix for applications never reaching the Finance desk.
--   2. The three-office pipeline — Finance, Registrar, Admissions Office —
--      with each office's permitted moves enforced in the database.
--
-- Run this in the Supabase SQL editor. It is small, idempotent, and safe to
-- run on a database that already has 000_complete.sql applied.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS WRONG
--
-- Applications submitted through /apply WERE being recorded. The row was
-- written to `students` with status 'applicant' every time, and the insert was
-- permitted by the `students_public_apply` policy.
--
-- Nobody could see them. The only SELECT policy on `students` was
--
--   create policy students_own_row on students
--     for select using (auth.uid() = auth_user_id);
--
-- An applicant has no auth account, so `auth_user_id` is null; a Finance
-- officer is not the applicant either way. Row-level security therefore
-- returned zero rows to every member of staff, on every screen, always. The
-- Finance queue was empty not because nothing had arrived but because nothing
-- could be shown. The Registrar's queue, the student register and every count
-- on the dashboard read zero for the same reason.
--
-- There was a second fault behind it. There was no UPDATE policy on `students`
-- at all, so even had Finance seen the application, registering the fee would
-- have been refused — silently, because the desk did not check the error.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES, AND WHAT IT PRESERVES
--
-- Staff can now read applications and update them. Separation of duties is
-- kept, and kept in the database rather than in the interface: Finance cannot
-- record an admission decision, and the Registrar cannot alter a payment.
--
-- RLS cannot restrict columns, so that split is enforced by a trigger — the
-- same technique used to stop users promoting themselves in section 10 of
-- 000_complete.sql. A policy alone would grant the whole row.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Staff may read applications
--
-- auth_role() is the security-definer helper from 000_complete.sql section 7.
-- It reads the caller's role past RLS, which is what stops a policy on
-- `students` that consults `profiles` from recursing.
-- ---------------------------------------------------------------------------

drop policy if exists students_staff_read on students;
create policy students_staff_read on students
  for select using (
    auth_role() in (
      'superadmin', 'admin', 'registrar', 'finance', 'finance-director',
      'admissions-officer', 'dean', 'hod', 'programme-coordinator',
      'academic-office', 'lecturer', 'student-affairs'
    )
  );


-- ---------------------------------------------------------------------------
-- 2. The two desks may write
--
-- Deliberately narrow. A lecturer and a dean can read the register; neither
-- appears here, because neither admits students nor takes money.
-- ---------------------------------------------------------------------------

drop policy if exists students_desk_update on students;
create policy students_desk_update on students
  for update using (
    auth_role() in ('superadmin', 'admin', 'registrar', 'finance', 'finance-director', 'admissions-officer')
  );


-- ---------------------------------------------------------------------------
-- 3. Separation of duties, enforced in the database
--
-- Finance verifies the money. The Registrar confers the place. Neither may do
-- the other's job — that is the whole reason the admissions pipeline has two
-- desks, and until now it was a rule the interface asked people to respect
-- rather than one the database held them to.
--
-- 'admin' and 'superadmin' are exempt so the institution is not locked out of
-- its own records; every such change is visible in the audit log.
-- ---------------------------------------------------------------------------

create or replace function guard_admissions_separation() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text;
begin
  -- Server routes hold the service-role key and have already checked the
  -- caller's capability in application code; this guard is for the browser.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  actor := auth_role();

  if actor in ('superadmin', 'admin') then
    return new;
  end if;

  -- Payment fields: Finance only.
  if (new.payment_status    is distinct from old.payment_status)
     or (new.fee_reference     is distinct from old.fee_reference)
     or (new.fee_amount        is distinct from old.fee_amount)
     or (new.fee_currency      is distinct from old.fee_currency)
     or (new.fee_registered_by is distinct from old.fee_registered_by)
     or (new.fee_registered_at is distinct from old.fee_registered_at)
  then
    if actor not in ('finance', 'finance-director') then
      raise exception 'only the Finance office may register or alter a payment';
    end if;
  end if;

  -- Decision fields: the two offices that decide, and nobody else.
  --
  -- The Registrar records the verification and forwards; the Admissions Office
  -- records the admission. Finance appears in neither list, which is the point
  -- — the office that takes the money never writes a decision.
  if (new.decision_reason      is distinct from old.decision_reason)
     or (new.decided_by          is distinct from old.decided_by)
     or (new.decided_at          is distinct from old.decided_at)
     or (new.student_number      is distinct from old.student_number)
     or (new.admission_conditions is distinct from old.admission_conditions)
     or (new.account_created_at  is distinct from old.account_created_at)
  then
    if actor not in ('registrar', 'admissions-officer') then
      raise exception 'only the Registrar or the Admissions Office may record a decision';
    end if;
  end if;

  -- `status` moves through the pipeline, and which move is allowed depends on
  -- who is making it. Three offices, three permitted moves, and no office can
  -- make another's.
  if new.status is distinct from old.status then
    -- Finance registers the fee and nothing else.
    if actor in ('finance', 'finance-director') and new.status <> 'fee_paid' then
      raise exception 'the Finance office may only move an application to fee_paid';
    end if;

    -- The Registrar verifies the record and forwards it, or asks for documents,
    -- or declines. It does not admit: 'approved' and 'conditional' are the
    -- Admissions Office's, and this is what stops the Registrar bypassing them.
    if actor = 'registrar'
       and new.status not in ('registrar_approved', 'documents_required', 'rejected', 'deferred')
    then
      raise exception 'the Registrar verifies and forwards; admitting belongs to the Admissions Office';
    end if;

    -- The Admissions Office admits, and only from a record the Registrar has
    -- forwarded. An application that skipped the Registrar cannot be admitted.
    if actor = 'admissions-officer' then
      if new.status not in ('approved', 'conditional', 'rejected', 'deferred') then
        raise exception 'the Admissions Office may admit, decline or defer';
      end if;
      if new.status in ('approved', 'conditional') and old.status <> 'registrar_approved' then
        raise exception 'this record has not been verified and forwarded by the Registrar';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists students_guard_separation on students;
create trigger students_guard_separation
  before update on students
  for each row execute function guard_admissions_separation();


-- ---------------------------------------------------------------------------
-- 4. Verify
-- ---------------------------------------------------------------------------

-- (a) Three policies on students: own row, staff read, desk update, plus the
--     public application insert. Expect four rows.
select policyname, cmd
from pg_policies
where tablename = 'students'
order by policyname;

-- (b) The separation guard is installed. Expect one row.
select tgname from pg_trigger where tgname = 'students_guard_separation';

-- (c) How many applications are sitting in the database right now. If this is
--     greater than zero, they were being recorded all along and only the
--     reading was blocked.
select status, count(*) as applications
from students
group by status
order by count(*) desc;


-- ===========================================================================
-- AFTER RUNNING THIS
--
-- Sign in as the Finance officer and open Admissions — Finance. Every
-- application submitted since the site went live should now be listed, oldest
-- first. Nothing was lost: the rows were always there.
-- ===========================================================================
