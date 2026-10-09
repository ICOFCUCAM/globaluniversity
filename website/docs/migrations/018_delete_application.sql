-- ===========================================================================
-- 018 — DELETING AN APPLICATION, AND WHO MAY
--
-- The University's instruction: only the Superadministrator may delete an
-- application.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS CHANGES, WHICH IS LESS THAN IT SOUNDS
-- ---------------------------------------------------------------------------
--
-- Nobody could delete an application before this migration either. `students`
-- has row-level security enabled and carried policies for SELECT, INSERT and
-- UPDATE and none for DELETE — and under RLS an operation with no policy is
-- refused. So the rule already held, by accident, for everyone including the
-- Superadministrator.
--
-- "Refused because nobody wrote the policy" and "refused because the
-- University decided" look identical from the application and are not the same
-- thing. The first is silently undone by the next person who adds a broad
-- policy to fix something unrelated. This states the decision, so that undoing
-- it takes saying so.
--
-- ---------------------------------------------------------------------------
-- WHY DELETION IS RESTRICTED AT ALL
-- ---------------------------------------------------------------------------
--
-- Rejecting an application is a decision, and it is recorded: who rejected it,
-- when, and on what grounds. Deleting one removes the evidence that the person
-- ever applied — what Finance saw, what the Registrar verified, why the
-- Admissions Office decided as it did.
--
-- An Admissions Officer who could delete could erase a candidate they had
-- mishandled, and the record of the mishandling with them. That is the class of
-- act this hierarchy exists to keep out of an operational role, which is why
-- 'delete-application' sits in SYSTEM_CAPABILITIES beside 'assign-roles' rather
-- than beside 'reject-application'.
--
-- ---------------------------------------------------------------------------
-- AND WHY AN ADMITTED STUDENT IS NOT DELETABLE BY ANYBODY
-- ---------------------------------------------------------------------------
--
-- Once an application is admitted it stops being an application. It has an auth
-- account, a student number, possibly marks, payments and an issued credential.
-- Deleting that row does not tidy a queue; it detaches a person from their own
-- academic record and leaves rows in six tables pointing at nothing.
--
-- So the policy admits the Superadministrator, and a trigger refuses the row
-- regardless of who is asking once it has become a student record. Withdrawal
-- is a status, not a deletion.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. THE POLICY
-- ---------------------------------------------------------------------------

drop policy if exists students_superadmin_delete on students;
create policy students_superadmin_delete on students
  for delete using (auth_role() = 'superadmin');


-- ---------------------------------------------------------------------------
-- 2. THE TRIGGER
--
-- The policy governs the publishable key. The service-role key bypasses RLS
-- entirely — and every write this application makes to `students` from a route
-- goes through the service role. A policy alone would therefore be a rule that
-- holds for the browser and not for the server, which is the wrong way round.
--
-- BEFORE DELETE, so it refuses rather than reports afterwards.
-- ---------------------------------------------------------------------------

create or replace function guard_application_delete() returns trigger
language plpgsql
as $$
begin
  -- An admitted student is not an application. `auth_user_id` is set at the
  -- moment of admission and `student_number` with it; either one means this
  -- row has become somebody's academic identity.
  if old.auth_user_id is not null or old.student_number is not null then
    raise exception
      'This record has been admitted (student %) and is no longer an application. '
      'Deleting it would detach a person from their own academic record. '
      'Withdraw or suspend the student instead.',
      coalesce(old.student_number, old.auth_user_id::text)
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists students_guard_delete on students;
create trigger students_guard_delete
  before delete on students
  for each row execute function guard_application_delete();


-- ---------------------------------------------------------------------------
-- 3. PROOF
--
-- Performs the rules rather than checking that the trigger exists. A test that
-- confirms a trigger is present proves the migration ran; it does not prove the
-- trigger refuses anything.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- AMENDED AFTER 108, WHICH MADE THIS PROOF IMPOSSIBLE TO RUN TWICE.
--
-- 108 put a trigger on `students` that refuses EVERY delete which is not the
-- carrying-out of a request the Vice-Chancellor approved thirty days earlier —
-- deliberately, including the service key's. This proof deletes two rows it
-- made itself, so from the moment 108 exists the proof cannot complete.
--
-- ON A FRESH DATABASE NOTHING WENT WRONG, because 018 runs ninety migrations
-- before 108 and the trigger did not exist yet. It only failed on the SECOND
-- full run of RUN-ALL.sql, where 108's trigger is already there when 018 comes
-- round again:
--
--   ERROR: A students is not deleted outright. The Superadministrator puts it
--          up for deletion, the Vice-Chancellor decides…
--
-- Which is the rule working correctly, on the wrong row.
--
-- SO 108's GUARD IS PARKED FOR THE LENGTH OF THIS PROOF AND PUT BACK, and
-- 018's OWN guard is left armed throughout — part (b) below exists to watch it
-- refuse, and disabling the lot would have turned the most important assertion
-- in this file into a line that always passes. A rule nobody has watched
-- refuse anything is a rule nobody has tested.
--
-- The whole thing is one transaction, so a failure anywhere re-arms it.
-- ---------------------------------------------------------------------------

do $$
declare
  applicant_id uuid;
  admitted_id  uuid;
  refused      boolean;
  n            int;
  parked       boolean := false;
begin
  if exists (
    select 1 from pg_trigger
     where tgrelid = 'students'::regclass
       and tgname = 'nothing_is_deleted_without_the_vc_trg'
  ) then
    alter table students disable trigger nothing_is_deleted_without_the_vc_trg;
    parked := true;
  end if;

  -- (a) An ordinary application can be deleted by a caller that bypasses RLS.
  insert into students (matric_no, first_name, last_name, email, status)
  values ('DEL-PROOF-018', 'Delete', 'Proof', 'delete-proof-018@example.invalid', 'applicant')
  returning id into applicant_id;

  delete from students where id = applicant_id;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception '018 FAILED: an ordinary application could not be deleted (% rows)', n;
  end if;

  -- (b) An admitted record cannot be deleted BY ANYONE, service role included.
  insert into students (matric_no, first_name, last_name, email, status, student_number)
  values ('ADM-PROOF-018', 'Admitted', 'Proof', 'admitted-proof-018@example.invalid',
          'approved', 'ICOF209900001')
  returning id into admitted_id;

  refused := false;
  begin
    delete from students where id = admitted_id;
  exception when others then
    refused := true;
  end;

  if not refused then
    raise exception
      '018 FAILED: an admitted student was deleted. The trigger did not refuse.';
  end if;

  -- Clean up the proof row the only way the rule permits.
  update students set student_number = null, auth_user_id = null where id = admitted_id;
  delete from students where id = admitted_id;

  -- AND 108's GUARD GOES BACK ON. Leaving it off would be the worst outcome
  -- available here: every delete on the register permitted, silently, on a
  -- database whose owner had just run the migration that forbids them.
  if parked then
    alter table students enable trigger nothing_is_deleted_without_the_vc_trg;
  end if;

  raise notice '018 ok: applications are deletable, admitted students are not.';
end $$;

-- ---------------------------------------------------------------------------
-- AND IT REALLY IS BACK ON. Asked of the catalogue rather than assumed from
-- the block above having finished: `tgenabled` is 'O' for an ordinary enabled
-- trigger and 'D' for a disabled one, and a proof that left the University's
-- register unguarded would be a far worse fault than the one it was fixing.
-- ---------------------------------------------------------------------------
do $$
declare
  state "char";
begin
  select tgenabled into state
    from pg_trigger
   where tgrelid = 'students'::regclass
     and tgname = 'nothing_is_deleted_without_the_vc_trg';

  if state is null then
    raise notice '018 --  108 has not been run yet; nothing to re-arm.';
  elsif state = 'D' then
    raise exception '018 FAILED: 108''s deletion guard was left DISABLED on students. '
                    'Every delete on the register would be permitted.';
  else
    raise notice '018 ok: 108''s deletion guard is armed again.';
  end if;
end $$;

-- (c) The policy exists, names the Superadministrator, and names nobody else.
do $$
declare
  qual text;
begin
  select pg_get_expr(polqual, polrelid) into qual
  from pg_policy
  where polname = 'students_superadmin_delete';

  if qual is null then
    raise exception '018 FAILED: the delete policy was not created.';
  end if;

  if qual not like '%superadmin%' then
    raise exception '018 FAILED: the delete policy does not name superadmin: %', qual;
  end if;

  -- The failure this catches is somebody "fixing" a permissions complaint by
  -- widening the policy. Any other role appearing here is that fix.
  if qual ~ 'registrar|admissions-officer|finance|dean|hod|academic-office'
     or qual ~ '''admin''' then
    raise exception
      '018 FAILED: the delete policy admits a role other than superadmin: %', qual;
  end if;

  raise notice '018 ok: only the Superadministrator holds the delete policy.';
end $$;

select
  'students delete policy' as check,
  polname                  as policy,
  pg_get_expr(polqual, polrelid) as using_expression
from pg_policy
where polname = 'students_superadmin_delete';
