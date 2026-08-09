-- ===========================================================================
-- AFTER ONE REAL ADMISSION: EVERY RESULTING RECORD, IN ONE GRID.
--
-- READ ONLY. It writes nothing and is safe on production.
--
-- ---------------------------------------------------------------------------
-- HOW TO USE IT
-- ---------------------------------------------------------------------------
--
-- Change the email on the FIRST LINE of the query below — it appears once and
-- everything else reads it — then run the whole file.
--
-- ---------------------------------------------------------------------------
-- WHY IT IS ONE QUERY AND NOT SIX
-- ---------------------------------------------------------------------------
--
-- The first version used `\set applicant '…'` and six separate SELECTs. Both
-- were wrong for the tool it is run in:
--
--   \set IS A psql COMMAND, not SQL. The Supabase SQL editor sends statements
--   to the server, which has never heard of it — "syntax error at or near \".
--   scripts/build-migration-run.mjs refuses psql meta-commands in migrations
--   for precisely this reason, and this file was written by hand and never put
--   through it.
--
--   THE EDITOR SHOWS ONE RESULT. Six SELECTs return six result sets and the
--   grid displays the last, so five of the six answers were invisible even
--   when it ran.
--
-- So: one query, one result set, one row per fact, in the order the admission
-- happened.
-- ===========================================================================

with applicant as (
  -- ▼▼▼ THE ONLY LINE TO EDIT ▼▼▼
  select 'test.applicant@example.com'::text as email
  -- ▲▲▲ THE ONLY LINE TO EDIT ▲▲▲
),
app as (select s.* from students s join applicant a on s.email = a.email)

-- 1. THE APPLICATION. Expect status = admission_issued on a clean run.
select 1 as ord, '1. APPLICATION' as section, 'status' as item,
       coalesce(status, '(none)') as value, null::timestamptz as at from app
union all
select 1, '1. APPLICATION', 'name', trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')), null from app
union all
select 1, '1. APPLICATION', 'programme', coalesce(program, '(none)'), null from app
union all
select 1, '1. APPLICATION', 'student number', coalesce(student_number, '(NOT ISSUED)'), null from app
union all
select 1, '1. APPLICATION', 'decided at', coalesce(decided_at::text, '(never)'), decided_at from app
union all
select 1, '1. APPLICATION', 'auth user linked',
       case when auth_user_id is null then '(NO ACCOUNT LINKED)' else auth_user_id::text end, null from app

-- 2. THE ACADEMIC DECISION. Expect exactly one on a clean run. A second row is
--    a reversal or a correction, which is how one should look.
union all
select 2, '2. DECISION',
       d.decision || case when d.is_override then ' (ADMINISTRATIVE OVERRIDE)' else '' end,
       coalesce(d.decided_by_email, '(unnamed)') || ' — ' || coalesce(d.decided_by_role, '(no role)')
         || ' — ' || coalesce(d.previous_status, '?') || ' → ' || coalesce(d.new_status, '?')
         || coalesce(' — ' || d.reason, '') || coalesce(' — override: ' || d.override_reason, ''),
       d.decision_date
from admission_decisions d join app on app.id = d.application_id

-- 3. THE AUDIT TRAIL, in order. On a clean run expect ACADEMIC_APPROVED,
--    ISSUANCE_STARTED, ADMISSION_LETTER_GENERATED, ACCOUNT_CREATED,
--    ADMISSION_PACKAGE_ISSUED and WELCOME_EMAIL_SENT. An ISSUANCE_FAILED row
--    names the step that stopped and is the cue to retry from the desk.
union all
select 3, '3. AUDIT TRAIL', l.event,
       coalesce(l.actor_office, '(no office)')
         || coalesce(' — ' || l.actor_email, '')
         || coalesce(' — ' || l.previous_state || ' → ' || l.new_state, '')
         || coalesce(' — ' || l.detail, ''),
       l.at
from admission_audit_log l join app on app.id = l.application_id

-- 4. THE ACCOUNT. A student number on the application with nothing here is
--    exactly the failure the issuance states exist to make visible.
union all
select 4, '4. ACCOUNT', 'profile',
       coalesce(p.email || ' — role ' || p.role, '(NO PROFILE ROW)'), null
from app left join profiles p on p.id = app.auth_user_id

-- 5. THE NUMBER, and that the counter moved past it.
union all
select 5, '5. NUMBER', 'counter for ' || coalesce(substring(app.student_number from 5 for 4), '—'),
       coalesce(c.next_value::text, '(no counter row for that year)'), null
from app left join student_number_counters c
  on c.year = nullif(substring(app.student_number from 5 for 4), '')::int

-- 6. ANYTHING STUCK, university-wide. Empty is the healthy answer. A row here
--    is an admission the Head approved and the University did not finish
--    issuing — retried from the Admissions approval desk, never by editing it.
union all
select 6, '6. STUCK ANYWHERE', s.status,
       trim(coalesce(s.first_name,'') || ' ' || coalesce(s.last_name,'')) || ' — ' || coalesce(s.email,''),
       s.decided_at
from students s
where s.status in ('approved', 'conditional', 'admission_processing', 'admission_processing_failed')

order by ord, at nulls first, item;
