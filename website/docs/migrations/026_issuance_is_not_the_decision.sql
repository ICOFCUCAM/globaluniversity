-- ===========================================================================
-- 026 — "THE HEAD APPROVED" AND "THE UNIVERSITY ISSUED" ARE TWO EVENTS
--
-- Run after 025. Idempotent; destroys nothing. Safe on a live database.
--
-- ---------------------------------------------------------------------------
-- WHY
-- ---------------------------------------------------------------------------
--
-- The University put it exactly: `approved` was carrying two different facts.
--
--   The Head of Academic Affairs approved this applicant.
--   The University successfully completed the issuance of their admission.
--
-- Those are not the same event and they can come apart. The decision is
-- recorded first, on purpose — it is the fact everything else follows from —
-- and then a package is generated, a number reserved, an account created. Any
-- of those can fail. When one does, `approved` is true and misleading: the
-- decision stands, and nothing was issued.
--
-- Three states rather than one:
--
--   approved                     the academic decision, and only that
--   admission_processing         issuance is under way
--   admission_processing_failed  issuance stopped part way; recoverable
--   admission_issued             the package exists and the account behind it
--
-- ---------------------------------------------------------------------------
-- WHAT THIS MAKES POSSIBLE, WHICH IS THE POINT
-- ---------------------------------------------------------------------------
--
-- A RETRY THAT IS NOT SOMEBODY EDITING ROWS. Before this, an issuance that
-- died after the letter was generated left `approved` — indistinguishable from
-- one that had not started — and the only way back was to alter the status by
-- hand in the SQL editor. `admission_processing_failed` is a state the desk can
-- see, name, and offer a button for.
--
-- The decision is NOT re-taken on retry. It was validly taken the first time
-- and it is immutable; retrying resumes the issuance under the decision that
-- already exists, which is why the audit trail shows one approval and two
-- issuance attempts rather than two approvals.
-- ===========================================================================


-- ===========================================================================
-- 1. THE TWO NEW STATES
--
-- The trigger from 025 refuses INSERT into admission_states, on the grounds
-- that a new state is a code change and not a row. This IS the code change —
-- the states are added to src/lib/admissionWorkflow.ts in the same commit — so
-- the trigger comes off for exactly these two inserts and goes straight back.
-- Done in the open, in a migration, which is the only place it should happen.
-- ===========================================================================

do $$
begin
  alter table admission_states disable trigger admission_states_locked;

  insert into admission_states (state, stage, applicant_label, label, sort_order) values
    ('admission_processing',        'issuance', 'Admission approved', 'Issuing…',              125),
    ('admission_processing_failed', 'issuance', 'Admission approved', 'Issuance failed — retry', 126)
  on conflict (state) do update
    set stage = excluded.stage,
        applicant_label = excluded.applicant_label,
        label = excluded.label,
        sort_order = excluded.sort_order;

  -- THE APPLICANT IS TOLD "Admission approved" FOR BOTH, and that is deliberate
  -- rather than lazy. The academic decision in their favour has been taken and
  -- is not in doubt; that an internal step has to be retried is the
  -- University's problem to solve, not news to break to the applicant while it
  -- is being solved. The staff-facing labels below say precisely what happened.
  alter table admission_states enable trigger admission_states_locked;
end $$;


-- ===========================================================================
-- 2. THE EVENTS THAT DESCRIBE AN ISSUANCE ATTEMPT
-- ===========================================================================

do $$
declare
  con text;
begin
  select conname into con from pg_constraint
   where conrelid = 'admission_audit_log'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%ACADEMIC_APPROVED%';
  if con is not null then
    execute format('alter table admission_audit_log drop constraint %I', con);
  end if;

  alter table admission_audit_log add constraint admission_audit_log_event_check
    check (event in (
      'APPLICATION_SUBMITTED', 'DOCUMENT_VERIFIED', 'FEE_CONFIRMED',
      'ACADEMIC_REVIEW_STARTED', 'ACADEMIC_APPROVED',
      'ACADEMIC_CONDITIONALLY_APPROVED', 'ACADEMIC_REJECTED', 'ACADEMIC_RETURNED',
      'ISSUANCE_STARTED', 'ISSUANCE_FAILED', 'ISSUANCE_RETRIED',
      'ADMISSION_LETTER_GENERATED', 'ADMISSION_PACKAGE_ISSUED',
      'ACCOUNT_CREATED', 'WELCOME_EMAIL_SENT', 'WELCOME_EMAIL_FAILED',
      'ENROLLED', 'ADMINISTRATIVE_OVERRIDE'
    ));
end $$;


-- ===========================================================================
-- 3. PERFORMING THE RULES
-- ===========================================================================

-- The proof runs inside a plpgsql sub-block, which is a savepoint: raising at
-- the end rolls every row below back and leaves nothing behind. An explicit
-- `begin; … rollback;` would do the same and cannot be used — a file carrying
-- its own transaction cannot be safely concatenated into RUN-ALL.sql, and
-- scripts/build-migration-run.mjs refuses to build one that does. That refusal
-- is right: the second file's statements would end up inside the first file's
-- transaction, and a failure in the last would roll back the first.

do $$
declare
  app uuid;
  dec uuid;
  refused boolean;
begin
 begin
  -- FIRST, THAT THE STATES ARE ACTUALLY THERE. The earlier version of this
  -- proof wrote 'admission_processing' into students.status and declared
  -- success — but that column carries no CHECK constraint, so it accepts any
  -- string at all. The proof passed on a run where the INSERT above had failed
  -- and neither state existed. A test that cannot fail is not a test.
  if (select count(*) from admission_states
      where state in ('admission_processing', 'admission_processing_failed')) <> 2 then
    raise exception '026 FAILED: the two issuance states were not added to the vocabulary';
  end if;

  insert into students (first_name, last_name, matric_no, email, status)
  values ('Proof', '026', 'PROOF-026', 'proof-026@iguc.net', 'ready_for_academic_review')
  returning id into app;

  -- ---- A DECISION IS TAKEN, AND ISSUANCE THEN FAILS --------------------
  insert into admission_decisions
    (application_id, decision, decided_by_role, previous_status, new_status)
  values (app, 'approve', 'academic-office', 'ready_for_academic_review', 'approved')
  returning id into dec;

  insert into admission_audit_log (application_id, decision_id, event, actor_office, new_state)
  values (app, dec, 'ISSUANCE_STARTED', 'Office of Academic Affairs', 'admission_processing');
  update students set status = 'admission_processing' where id = app;

  insert into admission_audit_log
    (application_id, decision_id, event, actor_office, previous_state, new_state, detail)
  values (app, dec, 'ISSUANCE_FAILED', 'Office of Academic Affairs',
          'admission_processing', 'admission_processing_failed',
          'the account could not be created');
  update students set status = 'admission_processing_failed' where id = app;

  -- THE STATE THE UNIVERSITY ASKED FOR. The decision stands, the admission was
  -- not issued, and the two are distinguishable — which they were not when both
  -- were called `approved`.
  if (select status from students where id = app) <> 'admission_processing_failed' then
    raise exception '026 FAILED: a failed issuance is not distinguishable from an untouched approval';
  end if;
  if not exists (select 1 from admission_decisions where application_id = app and decision = 'approve') then
    raise exception '026 FAILED: the decision was lost with the failed issuance';
  end if;

  -- ---- THE RETRY DOES NOT TAKE THE DECISION AGAIN ----------------------
  insert into admission_audit_log (application_id, decision_id, event, actor_office, previous_state, new_state)
  values (app, dec, 'ISSUANCE_RETRIED', 'Office of Academic Affairs',
          'admission_processing_failed', 'admission_processing');
  update students set status = 'admission_issued' where id = app;

  if (select count(*) from admission_decisions where application_id = app) <> 1 then
    raise exception '026 FAILED: retrying the issuance recorded a second academic decision';
  end if;

  -- ---- AND THE STATE LIST IS STILL THE SOFTWARE'S ----------------------
  refused := false;
  begin
    insert into admission_states (state, stage, applicant_label, label, sort_order)
    values ('invented', 'issuance', 'x', 'x', 999);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '026 FAILED: the state vocabulary was left unlocked';
  end if;

  raise exception 'PROOF_ROLLBACK';
 exception when others then
   -- Anything that is not the sentinel is a real failure and must not be eaten.
   if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
 end;

 raise notice '026 OK — a failed issuance is its own state, the decision survives it, a retry '
              'does not re-decide, and the vocabulary is still locked.';
end $$;


-- ===========================================================================
-- 4. VERIFY
-- ===========================================================================

select state as code, label, applicant_label, stage
from admission_states where stage = 'issuance' order by sort_order;

-- Anything stuck part way through issuance. Empty is the healthy answer; a row
-- here is an admission the Head approved and the University did not issue, and
-- it is retried from the Admissions approval desk, not from this editor.
select s.student_number, s.first_name, s.last_name, s.status, s.program
from students s
where s.status in ('approved', 'admission_processing', 'admission_processing_failed')
order by s.decided_at desc nulls last;
