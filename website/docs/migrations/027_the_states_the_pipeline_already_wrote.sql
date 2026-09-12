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
  -- ---------------------------------------------------------------------
  -- THE CONSTRAINT 037 ADDS HAS TO COME OFF FOR THIS ONE INSERT.
  --
  -- This proof writes a status nobody declared, deliberately, to watch the
  -- coverage view report it. 037 later gave `students.status` its first CHECK
  -- constraint — so on any rerun of the bundle after 037 has run, the proof
  -- that the view can SEE a stray status was refused by the rule that stops
  -- one being WRITTEN. Two correct rules, colliding.
  --
  -- The drop is inside the same block as the PROOF_ROLLBACK, and Postgres rolls
  -- DDL back with everything else, so the constraint is restored the instant
  -- this block ends. Found by running RUN-ALL.sql a second time.
  -- ---------------------------------------------------------------------
  alter table students drop constraint if exists students_status_check;

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
