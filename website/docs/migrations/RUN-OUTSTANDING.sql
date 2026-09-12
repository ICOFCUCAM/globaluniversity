-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — MIGRATIONS 031, 032, 033, 034, IN ORDER
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-migration-run.mjs
--   Rebuild:   node scripts/build-migration-run.mjs --out=RUN-OUTSTANDING.sql 031 032 033 034
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
--   031_the_letters_the_university_has_issued.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 031 — THE LETTERS THE UNIVERSITY HAS ISSUED, KEPT
--
-- Run after 030. Idempotent; destroys nothing. Safe on a live database.
--
-- ---------------------------------------------------------------------------
-- WHY
-- ---------------------------------------------------------------------------
--
-- The University asked where to check the QR code in a letter it had just
-- issued, and then answered the question itself: if a letter is generated and
-- the sending fails, it should still be in some storage or outbox.
--
-- It was not. The admission package was rendered, handed to the mail server
-- and discarded. Nothing wrote it anywhere, and mail sent over SMTP leaves no
-- copy in a Sent folder — so the only copy of a document the University had
-- signed and sealed lived in the applicant's inbox. When delivery failed,
-- there was no copy at all.
--
-- ---------------------------------------------------------------------------
-- WHY A RE-RENDER IS NOT A SUBSTITUTE, THOUGH IT LOOKS LIKE ONE
-- ---------------------------------------------------------------------------
--
-- The letter can be rebuilt from the record, and while the template is
-- unchanged the rebuild is exact — the seal is an HMAC over the particulars,
-- so the same inputs give the same seal and the same QR.
--
-- That holds only until somebody edits the template. After that, rebuilding
-- produces TODAY'S letter for a student admitted last year: same facts,
-- different document, and a seal computed over the same particulars sitting
-- under wording the University never sent. The stored copy is the record of
-- what was actually issued. The rebuild is a convenience.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS MAKES POSSIBLE
-- ---------------------------------------------------------------------------
--
-- An outbox. Every letter carries the outcome of its delivery, so "was this
-- student ever actually told?" is a question with an answer, and a letter that
-- failed to send can be sent again from the copy that was made at the time
-- rather than from a fresh render.
--
-- ---------------------------------------------------------------------------
-- IT IS NOT ON THE API, AND THAT IS DELIBERATE
-- ---------------------------------------------------------------------------
--
-- Row-level security on, no policy: deny-all, reachable only by the server
-- holding the service role. These rows carry a named person's date of birth,
-- nationality and programme. This is the same posture as the audit logs and
-- the secret store, and it is why the Supabase advisor's "RLS Enabled No
-- Policy" finding is the correct state here rather than an oversight.
-- ===========================================================================


-- ===========================================================================
-- 1. THE TABLE
-- ===========================================================================

create table if not exists admission_letters (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references students(id) on delete cascade,
  student_number  text,
  to_email        text,
  /** The date the letter bears, which is what its seal was computed over. */
  issued_on       date,
  /** Whether it went out with a seal. False when CREDENTIAL_SECRET was absent. */
  sealed          boolean not null default false,
  /** The document itself, as the applicant received it. */
  html            text not null,
  delivery        text not null default 'pending'
                    check (delivery in ('pending', 'sent', 'failed')),
  /** The mail server's own words when it refused. */
  delivery_detail text,
  attempts        integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists admission_letters_application_idx
  on admission_letters (application_id, created_at desc);

-- THE OUTBOX QUERY'S INDEX. Partial, because the rows worth finding quickly
-- are the few that did not arrive, not the many that did.
create index if not exists admission_letters_undelivered_idx
  on admission_letters (created_at desc) where delivery <> 'sent';

alter table admission_letters enable row level security;

comment on table admission_letters is
  'Every admission package the University has issued, as it was issued. SERVER '
  'ONLY — row-level security is on with no policy, because these rows carry a '
  'named person''s particulars. Kept rather than re-rendered because a rebuild '
  'follows today''s template, and what was sent is what the record has to show.';


-- ===========================================================================
-- 2. PERFORMING THE RULES
-- ===========================================================================

do $$
declare
  app uuid;
  letter uuid;
  refused boolean;
begin
 begin
  insert into students (first_name, last_name, matric_no, email, status, student_number)
  values ('Proof', '031', 'PROOF-031', 'proof-031@iguc.net', 'admission_issued', 'ICOF209900931')
  returning id into app;

  -- ---- A LETTER SURVIVES A FAILED DELIVERY ---------------------------
  -- The whole point. Generated, not sent, and still here.
  insert into admission_letters
    (application_id, student_number, to_email, issued_on, sealed, html, delivery, delivery_detail, attempts)
  values (app, 'ICOF209900931', 'proof-031@iguc.net', current_date, true,
          '<html>the letter</html>', 'failed', 'the mail server refused the message', 1)
  returning id into letter;

  if (select html from admission_letters where id = letter) is null then
    raise exception '031 FAILED: the letter was not kept';
  end if;
  if (select count(*) from admission_letters where delivery <> 'sent') < 1 then
    raise exception '031 FAILED: an undelivered letter is not findable as undelivered';
  end if;

  -- ---- AND A RESEND UPDATES IT RATHER THAN LOSING IT ------------------
  update admission_letters
     set delivery = 'sent', delivery_detail = null, attempts = attempts + 1, updated_at = now()
   where id = letter;
  if (select attempts from admission_letters where id = letter) <> 2 then
    raise exception '031 FAILED: the delivery attempts were not counted';
  end if;

  -- ---- THE VOCABULARY IS CLOSED --------------------------------------
  refused := false;
  begin
    update admission_letters set delivery = 'probably' where id = letter;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '031 FAILED: delivery accepts a state nothing can act on';
  end if;

  -- ---- AND IT IS NOT ON THE PUBLIC API --------------------------------
  if not (select relrowsecurity from pg_class where relname = 'admission_letters') then
    raise exception '031 FAILED: row-level security is not enabled on a table of personal particulars';
  end if;
  if exists (select 1 from pg_policies where tablename = 'admission_letters') then
    raise exception '031 FAILED: a policy was added, so these rows are reachable from the API';
  end if;

  raise exception 'PROOF_ROLLBACK';
 exception when others then
   if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
 end;

 raise notice '031 OK — a letter survives a failed delivery, is findable as undelivered, counts '
              'its attempts, refuses an unknown delivery state, and is not on the API.';
end $$;


-- ===========================================================================
-- 3. VERIFY
-- ===========================================================================

-- THE OUTBOX. Anything here was generated and did not reach the applicant.
-- Empty is the healthy answer; a row is a student who has been admitted and
-- does not know it, and it is resent from the Admissions approval desk.
select
  l.created_at,
  l.student_number,
  l.to_email,
  l.delivery,
  l.attempts,
  l.delivery_detail
from admission_letters l
where l.delivery <> 'sent'
order by l.created_at desc;


-- ===========================================================================
-- ===========================================================================
--
--   032_forwarding_and_returning.sql
--
-- ===========================================================================
-- ===========================================================================

-- ===========================================================================
-- 032 — FORWARDING FOR AN ACADEMIC DECISION, AND RETURNING TO A NAMED OFFICE
--
-- Run after 031. Idempotent; destroys nothing. Safe on a live database.
--
-- ---------------------------------------------------------------------------
-- WHY — TWO GAPS THE UNIVERSITY'S OWN ARCHITECTURE NAMED
-- ---------------------------------------------------------------------------
--
-- THE DOORWAY INTO THE FINAL STAGE WAS NEVER BUILT. `ready_for_academic_review`
-- is the state the five-stage design puts on the Head of Academic Affairs'
-- desk, and nothing produced it. The Admissions Office admitted directly
-- through the older route, so applications reached the deciding desk only
-- through `fee_paid` and `documents_required` — the earlier pipeline's states,
-- carried by DECIDABLE_FROM as a compatibility measure. The desk worked
-- through the back door and the front door was never fitted.
--
-- The University set out the authority plainly: the Admissions Office makes an
-- academic RECOMMENDATION, and Admissions Approval is the final authority. So
-- the Admissions Office forwards with its recommendation, and the office that
-- signs the letter decides.
--
-- AND A RETURN HAD NOWHERE TO GO. There was one `returned` state, meaning
-- "sent back" without saying to whom. The final officer finding an incomplete
-- verification, a fee discrepancy or an assessment that needs correcting had
-- only one other option — rejecting an applicant who has done nothing wrong.
--
-- A return now names the office, carries a reason and a timestamp, and appears
-- on that office's own queue. The applicant is not refused; the work goes back
-- to whoever can do it.
-- ===========================================================================


-- ===========================================================================
-- 1. WHAT AN APPLICATION CARRIES
-- ===========================================================================

alter table students add column if not exists academic_recommendation text;
alter table students add column if not exists returned_to    text;
alter table students add column if not exists returned_reason text;
alter table students add column if not exists returned_at    timestamptz;
alter table students add column if not exists returned_by    uuid;

comment on column students.academic_recommendation is
  'The Admissions Office''s recommendation, carried to the deciding desk. A '
  'recommendation, never a decision: the office that signs the letter decides.';
comment on column students.returned_to is
  'The office an application was returned to from final approval. A return is '
  'not a refusal — the applicant has done nothing wrong and the work goes back '
  'to whoever can complete it.';

-- THE CLOSED LIST OF PLACES WORK CAN GO BACK TO. Three offices precede the
-- final decision and a return can only reach one of them. `finance` is here
-- because a fee discrepancy is a real reason to send an application back, and
-- it is the one case where the deciding office touches Finance at all — by
-- returning to it, never by overruling it.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'students_returned_to_check'
  ) then
    alter table students add constraint students_returned_to_check
      check (returned_to is null
             or returned_to in ('finance', 'registrar', 'admissions-office'));
  end if;
end $$;

create index if not exists students_returned_to_idx
  on students (returned_to) where returned_to is not null;


-- ===========================================================================
-- 2. THE TWO EVENTS THAT DESCRIBE THESE MOVEMENTS
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
      'RETURNED_TO_OFFICE',
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
  refused boolean;
begin
 begin
  insert into students (first_name, last_name, matric_no, email, status)
  values ('Proof', '032', 'PROOF-032', 'proof-032@iguc.net', 'registrar_approved')
  returning id into app;

  -- ---- AN APPLICATION CAN NOW REACH THE DECIDING DESK ------------------
  -- The state existed and nothing could produce it. This is the doorway.
  update students
     set status = 'ready_for_academic_review',
         academic_recommendation = 'Meets the entry requirements for the programme.'
   where id = app;
  if (select status from students where id = app) <> 'ready_for_academic_review' then
    raise exception '032 FAILED: an application cannot be forwarded for an academic decision';
  end if;

  insert into admission_audit_log (application_id, event, actor_office, previous_state, new_state)
  values (app, 'FORWARDED_FOR_ACADEMIC_REVIEW', 'Admissions Office',
          'registrar_approved', 'ready_for_academic_review');

  -- ---- AND A RETURN NAMES WHERE IT WENT --------------------------------
  update students
     set status = 'returned', returned_to = 'registrar',
         returned_reason = 'The verification is incomplete: no proof of the prior award.',
         returned_at = now()
   where id = app;

  insert into admission_audit_log (application_id, event, actor_office, previous_state, new_state, detail)
  values (app, 'RETURNED_TO_OFFICE', 'Office of Academic Affairs',
          'ready_for_academic_review', 'returned', 'returned to registrar');

  if (select returned_to from students where id = app) <> 'registrar' then
    raise exception '032 FAILED: a return does not record which office it went to';
  end if;

  -- ---- A RETURN CANNOT GO SOMEWHERE THAT IS NOT AN OFFICE --------------
  -- The whole value of naming the office is that the name means something.
  refused := false;
  begin
    update students set returned_to = 'somewhere_else' where id = app;
  exception when others then refused := true;
  end;
  if not refused then
    raise exception '032 FAILED: an application can be returned to an office that does not exist';
  end if;

  -- ---- AND THE TRAIL ACCEPTS BOTH NEW EVENTS --------------------------
  if (select count(*) from admission_audit_log
       where application_id = app
         and event in ('FORWARDED_FOR_ACADEMIC_REVIEW', 'RETURNED_TO_OFFICE')) <> 2 then
    raise exception '032 FAILED: the trail does not record forwarding and returning';
  end if;

  raise exception 'PROOF_ROLLBACK';
 exception when others then
   if sqlerrm <> 'PROOF_ROLLBACK' then raise; end if;
 end;

 raise notice '032 OK — an application can be forwarded for an academic decision, returned to a '
              'named office with a reason, and neither movement can name an office that does '
              'not exist.';
end $$;


-- ===========================================================================
-- 4. VERIFY
-- ===========================================================================

-- Anything sitting with an office, waiting for that office to act on it.
-- Empty is the healthy answer.
select
  s.matric_no, s.first_name, s.last_name,
  s.returned_to as with_office, s.returned_at, s.returned_reason
from students s
where s.returned_to is not null and s.status = 'returned'
order by s.returned_at desc;


-- ===========================================================================
-- ===========================================================================
--
--   033_reevaluation.sql
--
-- ===========================================================================
-- ===========================================================================

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


-- ===========================================================================
-- ===========================================================================
--
--   034_enrolment_and_withdrawal.sql
--
-- ===========================================================================
-- ===========================================================================

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

