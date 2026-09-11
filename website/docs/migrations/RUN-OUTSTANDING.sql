-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — MIGRATIONS 026, 027, IN ORDER
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-migration-run.mjs
--   Rebuild:   node scripts/build-migration-run.mjs --out=RUN-OUTSTANDING.sql 026 027
--
-- ---------------------------------------------------------------------------
-- HOW TO RUN IT
--
-- Supabase SQL editor: paste the whole file and run once.
-- psql:                psql "<connection string>" -f docs/migrations/RUN-OUTSTANDING.sql
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
-- Run docs/migrations/VERIFY.sql to see what landed.
-- ===========================================================================

-- ===========================================================================
-- ===========================================================================
--
--   026_issuance_is_not_the_decision.sql
--
-- ===========================================================================
-- ===========================================================================

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


-- ===========================================================================
-- ===========================================================================
--
--   027_the_states_the_pipeline_already_wrote.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 027 — THE THREE STATES THE PIPELINE ALREADY WROTE AND NOBODY HAD DECLARED
--
-- Run after 026. Idempotent; destroys nothing. Safe on a live database.
--
-- ---------------------------------------------------------------------------
-- WHY
-- ---------------------------------------------------------------------------
--
-- The University asked why some applications were completely invisible in the
-- administration portal. Nothing had been deleted and no policy was refusing
-- the read: the rows were there, and no screen asked for them.
--
-- Every desk carried its own hand-written list of statuses in its own query —
-- six lists, in four files, none able to see the others, all written before
-- 023–026 widened the vocabulary. A state on no list is a record that exists
-- and that nothing fetches.
--
-- It was not a corner case. ALL FOUR of the Head of Academic Affairs' outcomes
-- fell through: approve produces `admission_issued`, reject produces
-- `rejected`, and the panel meant to show decided applications was looking for
-- `approved` and `declined`. The office took a decision and the application
-- left every admissions screen in the system.
--
-- The queues are fixed in the application, where they belong — they read from
-- ADMISSION_DESKS in src/lib/admissionWorkflow.ts, and admissionDesks.test.mjs
-- fails if a state lands on no desk. This migration is the database's half.
--
-- ---------------------------------------------------------------------------
-- WHAT THE DATABASE'S HALF IS
-- ---------------------------------------------------------------------------
--
-- THREE STATES THAT WERE ALWAYS LIVE AND WERE NEVER DECLARED. `registrar_
-- approved`, `declined` and `deferred` are written by src/lib/admissions.ts
-- and have been since the first pipeline. They were absent from
-- admission_states, which meant the vocabulary was not the vocabulary — and
-- because `students.status` carries no CHECK constraint, nothing ever said so.
--
-- They keep their existing spellings. `declined` is the REGISTRAR refusing at
-- verification and `rejected` is the HEAD OF ACADEMIC AFFAIRS refusing on
-- academic grounds; folding one into the other would lose which office
-- refused, which is the first thing anybody re-reading a refusal asks.
--
-- AND A VIEW THAT MAKES THE NEXT ONE LOUD. `admission_status_coverage` reports
-- every distinct status actually present in `students`, how many records hold
-- it, and whether the vocabulary knows it. A status nobody declared now shows
-- up as a row with a count against it instead of as an empty queue.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES NOT DO, AND WHY
-- ---------------------------------------------------------------------------
--
-- IT DOES NOT CONSTRAIN `students.status`. A CHECK or a foreign key to
-- admission_states would be the obvious move and it would be wrong: that
-- column carries the ENROLLED STUDENT statuses too — `active`, `graduated`,
-- `suspended`, `deferred` — which are not admission states and have their own
-- list in src/lib/constants.ts. Constraining it to the admission vocabulary
-- would refuse writes on the student register.
--
-- That overlap is a real design fault and it is not this migration's to fix.
-- Separating an application's state from a student's standing is a schema
-- change with a data migration behind it, and it is the University's call.
-- The view is the honest interim: it cannot prevent the mess, it can only
-- refuse to hide it.
-- ===========================================================================


-- ===========================================================================
-- 1. THE THREE STATES
--
-- The trigger from 025 refuses INSERT into admission_states, on the grounds
-- that a new state is a code change and not a row. This IS the code change —
-- they are added to src/lib/admissionWorkflow.ts in the same commit — so the
-- trigger comes off for exactly these three inserts and goes straight back.
-- ===========================================================================

do $$
begin
  alter table admission_states disable trigger admission_states_locked;

  insert into admission_states (state, stage, applicant_label, label, sort_order) values
    ('registrar_approved', 'verification', 'Under academic review',
     'Verified — with the Admissions Office', 75),
    ('declined',           'closed',       'Application unsuccessful',
     'Declined by the Registrar',            121),
    ('deferred',           'closed',       'Deferred to a later intake',
     'Deferred',                             122)
  on conflict (state) do update
    set stage = excluded.stage,
        applicant_label = excluded.applicant_label,
        label = excluded.label,
        sort_order = excluded.sort_order;

  -- `deferred` IS NOT A REFUSAL and its labels say so. The applicant is not
  -- being considered for this intake and has to be told that; what they must
  -- not be told is that they were turned down, because they were not.
  alter table admission_states enable trigger admission_states_locked;
end $$;


-- ===========================================================================
-- 2. THE VIEW THAT MAKES AN UNDECLARED STATUS VISIBLE
--
-- The whole defect was a silence: a status no query named produced an empty
-- list, and an empty list is indistinguishable from no applications. This is
-- the one place that can tell the difference, because it starts from what is
-- in the table rather than from what somebody remembered to ask for.
-- ===========================================================================

create or replace view admission_status_coverage as
select
  s.status,
  count(*)                                as records,
  (a.state is not null)                   as in_vocabulary,
  a.stage,
  a.label
from students s
left join admission_states a on a.state = s.status
group by s.status, a.state, a.stage, a.label
order by (a.state is not null), count(*) desc;

comment on view admission_status_coverage is
  'Every status actually present in students, and whether admission_states '
  'declares it. Rows with in_vocabulary = false are records the admissions '
  'screens may not be able to show. Note that the enrolled-student statuses '
  '(active, graduated, suspended) legitimately appear as false: students.status '
  'carries both vocabularies.';


-- ===========================================================================
-- 3. PERFORMING THE RULES
-- ===========================================================================

-- The proof runs inside a plpgsql sub-block, which is a savepoint: raising at
-- the end rolls every row below back and leaves nothing behind. An explicit
-- `begin; … rollback;` cannot be used — a file carrying its own transaction
-- cannot be safely concatenated into RUN-ALL.sql, and
-- scripts/build-migration-run.mjs refuses to build one that does.

do $$
declare
  app uuid;
  refused boolean;
  seen boolean;
begin
 begin
  -- FIRST, THAT THE STATES ARE ACTUALLY THERE. Writing one into students.status
  -- and reading it back would prove nothing: that column has no CHECK
  -- constraint and accepts any string at all. 026 shipped with a proof that
  -- passed on a run where its INSERT had failed. This one reads the vocabulary.
  if (select count(*) from admission_states
      where state in ('registrar_approved', 'declined', 'deferred')) <> 3 then
    raise exception '027 FAILED: the three legacy states were not added to the vocabulary';
  end if;

  -- AND THAT THEY DID NOT LAND ON TOP OF ANYTHING. `declined` and `rejected`
  -- are two different offices refusing and must stay distinguishable.
  if (select label from admission_states where state = 'declined')
     = (select label from admission_states where state = 'rejected') then
    raise exception '027 FAILED: the Registrar''s refusal and the academic refusal read alike';
  end if;

  -- ---- THE VIEW SEES A STATUS NOBODY DECLARED --------------------------
  insert into students (first_name, last_name, matric_no, email, status)
  values ('Proof', '027', 'PROOF-027', 'proof-027@iguc.net', 'a_state_nobody_declared')
  returning id into app;

  select not in_vocabulary into seen
    from admission_status_coverage where status = 'a_state_nobody_declared';
  if seen is not true then
    raise exception '027 FAILED: an undeclared status did not show up as undeclared';
  end if;

  -- …AND REPORTS A DECLARED ONE AS DECLARED, so the column above is actually
  -- discriminating rather than returning true for everything.
  update students set status = 'registrar_approved' where id = app;
  select in_vocabulary into seen
    from admission_status_coverage where status = 'registrar_approved';
  if seen is not true then
    raise exception '027 FAILED: a declared status was reported as unknown';
  end if;

  -- ---- AND THE STATE LIST IS STILL THE SOFTWARE'S ----------------------
  refused := false;
  begin
    insert into admission_states (state, stage, applicant_label, label, sort_order)
    values ('invented', 'closed', 'x', 'x', 999);
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '027 FAILED: the state vocabulary was left unlocked';
  end if;

  raise exception 'PROOF_ROLLBACK';
 exception when others then
   -- Anything that is not the sentinel is a real failure and must not be eaten.
   if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
 end;

 raise notice '027 OK — the three states the pipeline writes are declared, the two refusals stay '
              'distinguishable, an undeclared status is visible, and the vocabulary is still locked.';
end $$;


-- ===========================================================================
-- 4. VERIFY
-- ===========================================================================

-- The three states, as the University's own screens will now label them.
select state as code, label, applicant_label, stage
from admission_states
where state in ('registrar_approved', 'declined', 'deferred')
order by sort_order;

-- ---------------------------------------------------------------------------
-- THE ONE TO READ. Every status actually in the table, commonest first, with
-- the undeclared ones at the top.
--
-- `active`, `graduated` and `suspended` are EXPECTED to show in_vocabulary =
-- false: they are student statuses rather than admission states and share the
-- column. Anything else showing false is an application the admissions screens
-- may not be able to display, and it should be reported rather than corrected
-- here.
-- ---------------------------------------------------------------------------
select * from admission_status_coverage;

