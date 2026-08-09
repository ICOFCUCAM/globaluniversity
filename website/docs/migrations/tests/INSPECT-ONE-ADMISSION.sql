-- ===========================================================================
-- AFTER ONE REAL ADMISSION: INSPECT EVERY RESULTING RECORD.
--
-- READ ONLY. It writes nothing and is safe on production.
--
-- Put the applicant's email in the line below and run the whole file. Every
-- section is one of the things the University asked to see proved.
-- ===========================================================================

\set applicant '''test.applicant@example.com'''

-- 1. THE APPLICATION, and where it ended up. Expect status = admission_issued.
select id, first_name, last_name, email, student_number, status,
       program, degree_type, faculty, campus, intake,
       decided_by, decided_at, account_created_at, auth_user_id
from students where email = :applicant;

-- 2. THE ACADEMIC DECISION. Expect exactly one, decision = approve, with the
--    role and office of the person who took it. A second row here means a
--    reversal or a correction, which is how it should look.
select d.decision_date, d.decision, d.decision_type,
       d.decided_by_email, d.decided_by_role,
       d.previous_status, d.new_status, d.reason,
       d.is_override, d.override_of, d.override_reason
from admission_decisions d
join students s on s.id = d.application_id
where s.email = :applicant
order by d.decision_date;

-- 3. THE AUDIT TRAIL, in order. On a clean run expect, at minimum:
--      ACADEMIC_APPROVED
--      ISSUANCE_STARTED
--      ADMISSION_LETTER_GENERATED
--      ACCOUNT_CREATED
--      ADMISSION_PACKAGE_ISSUED
--      WELCOME_EMAIL_SENT      (or WELCOME_EMAIL_FAILED, which is not a fault
--                               in the admission — the letter and account exist)
--    An ISSUANCE_FAILED row names the step that stopped and is the retry cue.
select a.at, a.event, a.actor_email, a.actor_role, a.actor_office,
       a.previous_state, a.new_state, a.detail, a.metadata, a.actor_ip
from admission_audit_log a
join students s on s.id = a.application_id
where s.email = :applicant
order by a.at;

-- 4. THE ACCOUNT. Expect one auth user and one profile with role = 'student'.
--    A student number on the application with no profile here is the exact
--    failure the issuance states exist to make visible.
select p.id, p.email, p.full_name, p.role, u.created_at as auth_created,
       u.email_confirmed_at
from students s
left join profiles p on p.id = s.auth_user_id
left join auth.users u on u.id = s.auth_user_id
where s.email = :applicant;

-- 5. THE STUDENT NUMBER, and that the counter moved with it.
select s.student_number, c.year, c.next_value as next_to_be_issued
from students s
left join student_number_counters c
  on c.year = substring(s.student_number from 5 for 4)::int
where s.email = :applicant;

-- 6. ANYTHING STUCK. Empty is the healthy answer. A row here is an admission
--    the Head approved and the University did not finish issuing — retried from
--    the Admissions approval desk, never by editing these rows.
select first_name, last_name, email, status, decided_at
from students
where status in ('approved', 'conditional', 'admission_processing', 'admission_processing_failed')
order by decided_at desc nulls last;
