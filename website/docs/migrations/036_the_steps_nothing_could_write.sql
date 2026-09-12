-- ===========================================================================
-- 036 — THE THREE STATES THE UNIVERSITY DECLARED AND NOTHING COULD WRITE
-- ===========================================================================
--
-- ---------------------------------------------------------------------------
-- WHAT CHANGES THE MOMENT THIS RUNS
-- ---------------------------------------------------------------------------
--
-- Two new events are admitted to the audit trail's vocabulary, and with them
-- three states become reachable for the first time since 024 declared them:
--
--   under_review        The Admissions Office has opened the application. Until
--                       now a file somebody was working on and a file nobody
--                       had touched were the same value, so "why has this sat
--                       for three weeks" had no answer in the system.
--   fee_pending         Finance has ASKED for the fee. `applicant` means nobody
--                       has asked. An applicant chased for money they were
--                       never asked for is what the absence of this cost.
--   documents_verified  The documents were checked and accepted. Verification
--                       was recorded only by its absence — a record stopped
--                       being `documents_required` — so "checked and accepted"
--                       and "nobody has looked" were indistinguishable.
--
-- Nothing moves on its own. No existing application changes state; this widens
-- a CHECK constraint so the controls that write these states are accepted.
--
-- ---------------------------------------------------------------------------
-- WHY A CONSTRAINT AND NOT JUST CODE
-- ---------------------------------------------------------------------------
--
-- `admission_audit_log.event` is a closed vocabulary on purpose: an event
-- outside it fails the insert. That is the right failure, because the
-- alternative is an act that happened and was not recorded. The routes write
-- the trail as part of the step, so without this the step is refused rather
-- than silently unrecorded — which is why the application's own test suite
-- fails until this migration exists.
-- ===========================================================================

do $$
begin
  if exists (select 1 from pg_constraint
              where conname = 'admission_audit_log_event_check') then
    alter table admission_audit_log drop constraint admission_audit_log_event_check;
  end if;

  alter table admission_audit_log add constraint admission_audit_log_event_check
    check (event in (
      'APPLICATION_SUBMITTED',
      -- The two new ones. Both name an office DOING something rather than
      -- something having happened to the application, which is the distinction
      -- the three states exist to record.
      'ADMISSION_OPENED', 'FEE_REQUESTED',
      'DOCUMENT_VERIFIED', 'FEE_CONFIRMED',
      'FORWARDED_FOR_ACADEMIC_REVIEW',
      'ACADEMIC_REVIEW_STARTED', 'ACADEMIC_APPROVED',
      'ACADEMIC_CONDITIONALLY_APPROVED', 'ACADEMIC_REJECTED', 'ACADEMIC_RETURNED',
      'RETURNED_TO_OFFICE', 'REOPENED_FOR_REEVALUATION',
      'ISSUANCE_STARTED', 'ISSUANCE_FAILED', 'ISSUANCE_RETRIED',
      'ADMISSION_LETTER_GENERATED', 'ADMISSION_PACKAGE_ISSUED',
      'ACCOUNT_CREATED', 'WELCOME_EMAIL_SENT', 'WELCOME_EMAIL_FAILED',
      'ENROLLED', 'WITHDRAWN', 'ADMINISTRATIVE_OVERRIDE'
    ));
end $$;


-- ===========================================================================
-- PERFORMING THE RULES
-- ===========================================================================
--
-- Both directions. A vocabulary that accepts everything is not a vocabulary,
-- and one that refuses the thing it was widened for is a migration that did not
-- take — and the difference between those two is invisible from reading the
-- SQL, which is why this runs it.

do $$
declare
  app_id uuid;
  refused boolean;
begin
  -- A row to hang the proof on. Any application will do; if the University has
  -- none yet there is nothing to prove against and the checks are skipped
  -- rather than faked against an invented student.
  select id into app_id from students limit 1;
  if app_id is null then
    raise notice '036: no applications yet, so the trail could not be exercised';
    return;
  end if;

  -- ---- The new events are accepted ----------------------------------------
  begin
    insert into admission_audit_log (application_id, event, previous_state, new_state, detail)
    values (app_id, 'ADMISSION_OPENED', 'applicant', 'under_review', 'PROOF'),
           (app_id, 'FEE_REQUESTED',    'applicant', 'fee_pending',  'PROOF');
    raise exception 'PROOF_ROLLBACK';
  exception when others then
    if sqlerrm <> 'PROOF_ROLLBACK' then
      raise exception '036 FAILED: the new events are still refused by the constraint (%)', sqlerrm;
    end if;
  end;

  -- ---- AND AN INVENTED ONE IS STILL REFUSED -------------------------------
  -- The half of this that matters. Widening a vocabulary by removing the
  -- constraint would pass every test above and leave the trail able to record
  -- anything at all.
  refused := false;
  begin
    insert into admission_audit_log (application_id, event, previous_state, new_state)
    values (app_id, 'SOMEBODY_JUST_MADE_THIS_UP', 'applicant', 'under_review');
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '036 FAILED: the audit trail accepted an event nobody declared. The '
                    'vocabulary is no longer closed.';
  end if;

  raise notice '036 OK: the trail records the two new steps and still refuses an invented one';
end $$;

-- The three states are declared, which they have been since 024, and now
-- something can write them.
do $$
declare
  missing text;
begin
  select string_agg(s, ', ') into missing
    from unnest(array['under_review', 'fee_pending', 'documents_verified']) s
   where not exists (select 1 from admission_states a where a.state = s);
  if missing is not null then
    raise exception '036 FAILED: % is not in admission_states, so nothing can be put into it',
      missing;
  end if;
  raise notice '036 OK: under_review, fee_pending and documents_verified are reachable';
end $$;


-- ===========================================================================
-- VERIFY
-- ===========================================================================

-- The vocabulary as it now stands.
select unnest(string_to_array(
         replace(replace(substring(pg_get_constraintdef(oid)
           from '\((.*)\)$'), '''', ''), ' ', ''), ',')) as event_now_allowed
  from pg_constraint where conname = 'admission_audit_log_event_check';

-- How many applications sit in each of the three, which should be 0 today and
-- stop being 0 the first time somebody opens a file.
select a.state, a.applicant_label, count(s.id) as applications
  from admission_states a
  left join students s on s.status = a.state
 where a.state in ('under_review', 'fee_pending', 'documents_verified')
 group by a.state, a.applicant_label
 order by a.state;
