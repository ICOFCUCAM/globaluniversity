-- ===========================================================================
-- 034 — THE END OF THE JOURNEY, AND THE WAY OUT OF IT
--
-- Run after 033. Idempotent; destroys nothing. Safe on a live database.
--
-- ---------------------------------------------------------------------------
-- WHY — TWO STATES THAT HAVE BEEN DECLARED AND UNREACHABLE
-- ---------------------------------------------------------------------------
--
-- THE JOURNEY HAD NO END. `enrolled` has been in the vocabulary since 024 and
-- nothing could produce it. An issued admission was the last state a student
-- could reach, so the University could say it had admitted somebody and could
-- not say whether they had actually taken up the place. That is the fifth
-- stage of the five-stage design — ENROLMENT, the Registrar's — and it did not
-- exist.
--
-- The distinction is not bookkeeping. An admitted applicant who never enrols
-- is a place the University could have offered somebody else, and at present
-- they are indistinguishable from a student sitting in a lecture.
--
-- AND `withdrawn` WAS UNREACHABLE TOO. An applicant who wrote to say they no
-- longer wanted the place was recorded as DECLINED BY THE REGISTRAR — a
-- refusal, in the University's own records, of somebody who had not been
-- refused. That is wrong about who decided and wrong about what happened.
--
-- ---------------------------------------------------------------------------
-- WHAT IS DELIBERATELY NOT HERE
-- ---------------------------------------------------------------------------
--
-- Withdrawal does not revoke anything. A student who withdraws after being
-- issued an admission keeps the letter that was issued and the account that
-- was created; the register says they withdrew, and `withdrawn_from` says what
-- they withdrew from. Revoking a credential is a different act with its own
-- authority, and folding it in here would hide it.
-- ===========================================================================


-- ===========================================================================
-- 1. WHAT ENROLMENT AND WITHDRAWAL RECORD
-- ===========================================================================

alter table students add column if not exists enrolled_at      timestamptz;
alter table students add column if not exists enrolled_by      uuid;
alter table students add column if not exists withdrawn_at     timestamptz;
alter table students add column if not exists withdrawn_by     uuid;
alter table students add column if not exists withdrawn_reason text;
alter table students add column if not exists withdrawn_from   text;

comment on column students.enrolled_at is
  'When the Registrar recorded that the student took up the place. An admitted '
  'applicant who never enrols is a place that could have gone to somebody '
  'else, and without this they are indistinguishable from a student sitting in '
  'a lecture.';
comment on column students.withdrawn_from is
  'The state the applicant or student withdrew FROM. Withdrawing before a '
  'decision and withdrawing after an admission was issued are different '
  'events — in the second a letter exists and an account was created — and '
  'this is what keeps them apart in the record.';

create index if not exists students_enrolled_idx
  on students (enrolled_at desc) where enrolled_at is not null;


-- ===========================================================================
-- 2. THE EVENT
--
-- ENROLLED has been in the constraint since 024, waiting for something to emit
-- it. WITHDRAWN has not.
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
      'ENROLLED', 'WITHDRAWN', 'ADMINISTRATIVE_OVERRIDE'
    ));
end $$;


-- ===========================================================================
-- 3. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  app uuid;
begin
 begin
  insert into students (first_name, last_name, matric_no, email, status, student_number)
  values ('Proof', '034', 'PROOF-034-A', 'proof-034a@iguc.net', 'admission_issued', 'ICOF209900934')
  returning id into app;

  -- ---- THE JOURNEY CAN NOW END -----------------------------------------
  update students
     set status = 'enrolled', enrolled_at = now()
   where id = app;

  insert into admission_audit_log (application_id, event, actor_office, previous_state, new_state)
  values (app, 'ENROLLED', 'Office of the Registrar', 'admission_issued', 'enrolled');

  if (select status from students where id = app) <> 'enrolled' then
    raise exception '034 FAILED: an issued admission cannot be enrolled';
  end if;
  if (select enrolled_at from students where id = app) is null then
    raise exception '034 FAILED: enrolment records no date, so an admitted applicant who never '
                    'took up the place is still indistinguishable from a student';
  end if;

  -- ---- AND A WITHDRAWAL IS NOT A REFUSAL -------------------------------
  -- The whole point of the second half. An applicant who withdraws was
  -- recorded as DECLINED — refused, by the Registrar, in the University's own
  -- records, having not been refused by anybody.
  insert into students (first_name, last_name, matric_no, email, status)
  values ('Proof', '034', 'PROOF-034-B', 'proof-034b@iguc.net', 'ready_for_academic_review')
  returning id into app;

  update students
     set status = 'withdrawn',
         withdrawn_from = 'ready_for_academic_review',
         withdrawn_reason = 'The applicant has accepted a place elsewhere.',
         withdrawn_at = now()
   where id = app;

  insert into admission_audit_log (application_id, event, actor_office, previous_state, new_state, detail)
  values (app, 'WITHDRAWN', 'Office of the Registrar',
          'ready_for_academic_review', 'withdrawn', 'The applicant has accepted a place elsewhere.');

  if (select status from students where id = app) <> 'withdrawn' then
    raise exception '034 FAILED: an applicant cannot withdraw';
  end if;
  if (select withdrawn_from from students where id = app) <> 'ready_for_academic_review' then
    raise exception '034 FAILED: the record does not say what was withdrawn from';
  end if;
  -- AND IT IS NOT RECORDED AS A REFUSAL.
  if (select status from students where id = app) in ('declined', 'rejected') then
    raise exception '034 FAILED: a withdrawal is recorded as a refusal';
  end if;

  raise exception 'PROOF_ROLLBACK';
 exception when others then
   if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
 end;

 raise notice '034 OK — an issued admission can be enrolled with a date, an applicant can '
              'withdraw without being recorded as refused, and both say what they moved from.';
end $$;


-- ===========================================================================
-- 4. VERIFY
-- ===========================================================================

-- THE QUESTION THE UNIVERSITY COULD NOT ASK UNTIL NOW: of everybody admitted,
-- who actually took up the place? A row with no `enrolled_at` is an offer that
-- may still be open, or a place that could have gone to somebody else.
select
  s.student_number, s.first_name, s.last_name, s.program,
  s.status, s.decided_at as admitted_on, s.enrolled_at
from students s
where s.status in ('admission_issued', 'enrolled')
order by s.decided_at desc nulls last;
