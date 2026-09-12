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
