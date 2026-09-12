-- ===========================================================================
-- 033 — A DECIDED APPLICATION CAN BE LOOKED AT AGAIN
--
-- Run after 032. Idempotent; destroys nothing. Safe on a live database.
--
-- ---------------------------------------------------------------------------
-- WHY
-- ---------------------------------------------------------------------------
--
-- A decision was final in the only sense that mattered to the software: once
-- taken, the application left every queue and there was no way back onto the
-- desk. New information arriving after a decision — a document that turns out
-- to be forged, a qualification that was misread, an appeal upheld — had
-- nowhere to go.
--
-- The University asked for re-evaluation, and asked for it in the right shape:
-- the OLD DECISION REMAINS IMMUTABLE. This does not edit anything. The
-- application is put back on the desk carrying its history, and whatever is
-- decided next is appended beside what was decided before, not over it.
-- admission_decisions has been append-only since 024 and already holds many
-- decisions per application, so the record shape was there; what was missing
-- was a way to legitimately reopen one.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS IS NOT
-- ---------------------------------------------------------------------------
--
-- IT IS NOT A REVERSAL, AND IT WITHDRAWS NOTHING. Reopening an application
-- whose admission was issued does not revoke the letter, close the account or
-- unsend the email. The applicant has been told they are admitted and still
-- has been. Undoing that is a different act with different consequences, and
-- it is not this one.
--
-- That is why `reopened_from` is recorded: it says what the application was
-- when somebody reopened it, so the difference between reopening a rejection
-- and reopening an issued admission is visible in the record rather than
-- inferred from dates.
-- ===========================================================================


-- ===========================================================================
-- 1. WHAT A REOPENED APPLICATION CARRIES
-- ===========================================================================

alter table students add column if not exists reopened_reason text;
alter table students add column if not exists reopened_at     timestamptz;
alter table students add column if not exists reopened_by     uuid;
alter table students add column if not exists reopened_from   text;

comment on column students.reopened_from is
  'The state the application held when it was reopened. Reopening a rejection '
  'and reopening an issued admission are different acts — in the second the '
  'applicant has already been told — and this is what makes the difference '
  'visible in the record rather than inferred from dates.';
comment on column students.reopened_reason is
  'Why it was reopened. Required by the route, because a decision put back on '
  'the desk without a stated reason is indistinguishable from one somebody '
  'simply disagreed with.';

create index if not exists students_reopened_idx
  on students (reopened_at desc) where reopened_at is not null;


-- ===========================================================================
-- 2. THE EVENT
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
      'FORWARDED_FOR_ACADEMIC_REVIEW',
      'ACADEMIC_REVIEW_STARTED', 'ACADEMIC_APPROVED',
      'ACADEMIC_CONDITIONALLY_APPROVED', 'ACADEMIC_REJECTED', 'ACADEMIC_RETURNED',
      'RETURNED_TO_OFFICE', 'REOPENED_FOR_REEVALUATION',
      'ISSUANCE_STARTED', 'ISSUANCE_FAILED', 'ISSUANCE_RETRIED',
      'ADMISSION_LETTER_GENERATED', 'ADMISSION_PACKAGE_ISSUED',
      'ACCOUNT_CREATED', 'WELCOME_EMAIL_SENT', 'WELCOME_EMAIL_FAILED',
      'ENROLLED', 'ADMINISTRATIVE_OVERRIDE'
    ));
end $$;


-- ===========================================================================
-- 3. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  app uuid;
  first_decision uuid;
begin
 begin
  insert into students (first_name, last_name, matric_no, email, status, student_number)
  values ('Proof', '033', 'PROOF-033', 'proof-033@iguc.net', 'admission_issued', 'ICOF209900933')
  returning id into app;

  insert into admission_decisions
    (application_id, decision, decided_by_role, previous_status, new_status)
  values (app, 'approve', 'academic-office', 'ready_for_academic_review', 'approved')
  returning id into first_decision;

  -- ---- REOPENING PUTS IT BACK ON THE DESK ------------------------------
  update students
     set status = 'ready_for_academic_review',
         reopened_from = 'admission_issued',
         reopened_reason = 'The prior award certificate has been reported as forged.',
         reopened_at = now()
   where id = app;

  insert into admission_audit_log (application_id, decision_id, event, actor_office, previous_state, new_state, detail)
  values (app, first_decision, 'REOPENED_FOR_REEVALUATION', 'Office of Academic Affairs',
          'admission_issued', 'ready_for_academic_review',
          'The prior award certificate has been reported as forged.');

  if (select status from students where id = app) <> 'ready_for_academic_review' then
    raise exception '033 FAILED: a decided application cannot be put back on the desk';
  end if;

  -- ---- AND THE FIRST DECISION IS UNTOUCHED -----------------------------
  -- The whole point. Re-evaluation appends; it does not edit.
  if not exists (
    select 1 from admission_decisions
     where id = first_decision and decision = 'approve' and new_status = 'approved'
  ) then
    raise exception '033 FAILED: reopening altered the decision that was already taken';
  end if;

  -- ---- A SECOND DECISION SITS BESIDE THE FIRST -------------------------
  insert into admission_decisions
    (application_id, decision, decided_by_role, previous_status, new_status)
  values (app, 'reject', 'academic-office', 'ready_for_academic_review', 'rejected');

  if (select count(*) from admission_decisions where application_id = app) <> 2 then
    raise exception '033 FAILED: the application does not carry both decisions';
  end if;

  -- ---- WHAT IT WAS REOPENED FROM IS ON THE RECORD ----------------------
  -- Reopening a rejection and reopening an issued admission are different
  -- acts; in the second the applicant has already been told.
  if (select reopened_from from students where id = app) <> 'admission_issued' then
    raise exception '033 FAILED: the record does not say what was reopened';
  end if;

  raise exception 'PROOF_ROLLBACK';
 exception when others then
   if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
 end;

 raise notice '033 OK — a decided application can be put back on the desk with a reason, the '
              'decision already taken is untouched, and a second decision sits beside the first '
              'rather than over it.';
end $$;


-- ===========================================================================
-- 4. VERIFY
-- ===========================================================================

-- Applications reopened for re-evaluation, and what each was reopened FROM.
-- A row showing `admission_issued` is one where the applicant has already been
-- told they were admitted — reopening did not withdraw that, and if the new
-- decision differs somebody has to tell them.
select
  s.matric_no, s.first_name, s.last_name,
  s.reopened_from, s.reopened_at, s.reopened_reason,
  (select count(*) from admission_decisions d where d.application_id = s.id) as decisions_on_record
from students s
where s.reopened_at is not null
order by s.reopened_at desc;
