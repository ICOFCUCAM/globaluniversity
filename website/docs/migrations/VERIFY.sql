-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — WHAT LANDED
--
-- Run after RUN.sql. Reads only; changes nothing.
--
-- Each query answers one question the migrations were run to settle. Read the
-- expected value beside each before you read the result — a number you have
-- not predicted is a number you will accept.
-- ===========================================================================

-- 1. THE AWARDS AND THEIR CREDIT VALUES.                    (006, 012)
--
-- Expect: every diploma 120, every bachelor's 180, every master's 120.
-- The University ruled "Diploma is 120. 180 is degree." and "Masters is 120
-- credits." A row disagreeing here is a graduation audit that will refuse the
-- wrong student.
select code, title, kind, credits_required, min_cgpa, cgpa_confirmed
  from awards
 order by kind, code;

-- 2. THE CREDIT RULING, AS A VERDICT RATHER THAN A TABLE TO SQUINT AT.
--
-- Expect: zero rows. Anything returned is an award that disagrees with the
-- ruling, named.
select code, kind, credits_required,
       case kind when 'diploma' then 120 when 'bachelors' then 180
                 when 'masters' then 120 end as should_be
  from awards
 where (kind = 'diploma'   and credits_required <> 120)
    or (kind = 'bachelors' and credits_required <> 180)
    or (kind = 'masters'   and credits_required <> 120);

-- 3. THE SCHOOL OF MINISTRY DEPARTMENT.                          (011)
--
-- Expect: exactly one row, code SOM.
select id, code, name, faculty from departments where code = 'SOM';

-- 4. THE BACHELOR OF MINISTRY, COUNTED.                          (011)
--
-- Expect: 34 courses, 180 ECTS, 6 distinct semester/year pairs.
-- These are the same three numbers the website publishes and the same three
-- the migration asserted at load time. If they differ from 34 / 180, the
-- catalogue and the registry are describing different degrees.
select count(*)                       as courses,
       sum(credit_unit)               as ects,
       count(distinct (year, semester)) as terms,
       min(credit_unit)               as smallest_course,
       max(credit_unit)               as largest_course
  from courses
 where programme_slug = 'bachelor-of-ministry';

-- 5. THE SHAPE OF THE PLAN, TERM BY TERM.                        (011)
--
-- Expect: six rows, every one at 30 ECTS. A standard semester is 30 and six of
-- them are the degree; a term that is not 30 is a plan a student cannot follow.
select year, semester, count(*) as courses, sum(credit_unit) as ects
  from courses
 where programme_slug = 'bachelor-of-ministry'
 group by year, semester
 order by year, semester;

-- 6. THE PREREQUISITE CHAIN.                                     (011)
--
-- Expect: 25 courses with a prerequisite, 1 of them 'any' (BIB 103, which the
-- framework states as "BIB 101 or BIB 102"), 2 with an ECTS threshold
-- (RES 301 at 60, MIN 308 at 120), and 0 co-requisites until the University
-- rules on FIN 201 and COM 302.
--
-- THAT 25 WAS WRITTEN AS 23 AND THE FIRST REAL RUN CORRECTED IT. The figure had
-- been recalled rather than counted, which is precisely the failure this file's
-- own header warns about — "a number you have not predicted is a number you
-- will accept" — reached by the person writing the predictions. Nine of the
-- thirty-four courses are ungated: the six of Semester 1, HIS 101, and RES 301
-- and MIN 308, whose requirement is a credit threshold and not a named course.
--
-- The 'any' count is the one worth reading. Every other prerequisite is a
-- conjunction; if this returns 0 the AND/OR distinction has been lost, and a
-- registry would then refuse a student who has satisfied BIB 103's requirement.
select count(*) filter (where cardinality(prerequisites) > 0) as gated,
       count(*) filter (where requires_mode = 'any')          as disjunctions,
       count(*) filter (where requires_ects is not null)      as credit_thresholds,
       count(*) filter (where cardinality(co_requisites) > 0) as co_requisites
  from courses
 where programme_slug = 'bachelor-of-ministry';

-- 6b. THE CREDIT VALUES ARE ECTS, AND SAY SO.                    (011)
--
-- Expect: one row — ECTS, 34.
--
-- `courses.credit_system` defaults to 'credit_hour', because that is what the
-- catalogue seeded before this programme existed. Five ECTS and five credit
-- hours are not the same quantity, and a row that says 5 without saying which
-- is the one thing a credential evaluator will not accept. If this returns
-- 'credit_hour' the seed has landed with the wrong unit and every transcript
-- drawn from it will understate the degree.
select credit_system, count(*)
  from courses
 where programme_slug = 'bachelor-of-ministry'
 group by credit_system;

-- 7. NO PREREQUISITE POINTS AT A COURSE THAT DOES NOT EXIST.     (011)
--
-- Expect: zero rows. A prerequisite naming a course the registry does not hold
-- is a rule that can never be satisfied, and the student finds out at
-- registration.
select c.code, p.needs
  from courses c
  cross join lateral unnest(c.prerequisites) as p(needs)
 where c.programme_slug = 'bachelor-of-ministry'
   and not exists (select 1 from courses x where x.code = p.needs);

-- 8. THE TERMINOLOGY.                                            (011)
--
-- Expect: three rows — THE 101, THE 102 and BIB 104 — and no course anywhere
-- in this programme containing "Jesus" or "Holy Spirit". The School of
-- Ministry uses Yahuah for the Creator, Yahusha for the Messiah and the Ruach
-- HaQodesh for the Spirit.
select code, title
  from courses
 where programme_slug = 'bachelor-of-ministry'
   and (title ilike '%Yahuah%' or title ilike '%Yahusha%' or title ilike '%Ruach%'
        or description ilike '%Yahuah%' or description ilike '%Yahusha%')
 order by code;

-- 9. …AND NOTHING SLIPPED THROUGH.                               (011)
--
-- Expect: zero rows.
select code, title
  from courses
 where programme_slug = 'bachelor-of-ministry'
   and (title ilike '%Jesus%' or description ilike '%Jesus%'
        or title ilike '%Holy Spirit%' or description ilike '%Holy Spirit%');

-- 10. THE WRITE POLICIES THE INTERFACE NEEDS.                    (010)
--
-- Expect: INSERT and UPDATE policies on courses and payments, and at minimum a
-- SELECT on documents. Migration 010 exists because whole screens of the portal
-- were writing into a database that refused them — quietly, because
-- supabase-js returns an error object rather than throwing, so an unchecked
-- screen shows a spinner and looks like it worked.
select tablename, policyname, cmd
  from pg_policies
 where schemaname = 'public'
   and tablename in ('courses', 'payments', 'documents')
 order by tablename, cmd, policyname;

-- 11. THE COLUMNS THE CURRICULUM NEEDED.                         (011)
--
-- Expect: prerequisites, requires_mode, requires_ects, prerequisite_text,
-- co_requisites, credit_system, programme_slug.
select column_name, data_type, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'courses'
   and column_name in ('prerequisites', 'requires_mode', 'requires_ects',
                       'prerequisite_text', 'co_requisites', 'credit_system',
                       'programme_slug')
 order by column_name;

-- 12. HAS ANYTHING BEEN CONFERRED?                               (004, 012)
--
-- Expect: zero, today. If this is not zero, the credit ruling reached documents
-- the University has already sealed, and whether they need reissue, a
-- corrigendum or nothing at all is a decision for the Senate — not for a
-- migration, which is why 012 raises a notice and does not touch them.
select kind, status, count(*)
  from credentials_issued
 group by kind, status
 order by kind, status;

-- 13. THE TWO NEW SUBSYSTEMS LANDED.                             (013)
--
-- Expect: eleven rows. If any is missing, the Command Centre screen that reads
-- it will render an empty panel rather than an error, which is the failure mode
-- worth catching here rather than in front of a visitor.
select table_name
  from information_schema.tables
 where table_schema = 'public'
   and table_name in ('social_accounts', 'social_posts', 'social_post_media',
                      'social_post_targets', 'social_post_variants',
                      'social_post_metrics', 'credential_templates',
                      'credential_types', 'credential_amendments',
                      'credential_correction_requests', 'credential_audit_events')
 order by table_name;

-- 14. NOBODY CAN BE POSTED AS, AND NOBODY CAN EDIT THE RECORD.   (013)
--
-- Expect exactly three triggers:
--   social_target_consent_trg        on social_post_targets
--   credential_audit_no_update       on credential_audit_events
--   credential_templates_publication on credential_templates   (from 005)
--
-- The third is not new. It is listed because it is the three-office approval
-- gate — Registrar, Academic Office, Vice Chancellor — and 013 extends the
-- table it sits on. If it is absent, a certificate design can be published by
-- one person acting alone.
select c.relname as on_table, t.tgname
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
 where t.tgname in ('social_target_consent_trg', 'credential_audit_no_update',
                    'credential_templates_publication')
 order by t.tgname;

-- 15. NO TOKEN IS SITTING IN AN APPLICATION TABLE.               (013)
--
-- Expect: zero rows. `social_accounts.token_ref` is a POINTER into the secret
-- store, never the secret. This looks for anything shaped like a real OAuth
-- token that has been written into it by a route that did not read the header
-- of 013 — a long opaque string, or one carrying a JWT's two dots.
--
-- A false negative is possible (a short token would pass) and that is fine:
-- this is a smoke alarm, not a proof. A single row here is a credential leak
-- waiting for the next database export.
select id, scope, platform, handle, length(token_ref) as ref_length
  from social_accounts
 where token_ref is not null
   and (length(token_ref) > 64 or token_ref like '%.%.%')
 order by connected_at desc;

-- 16. CAN A CREDENTIAL ACTUALLY BE CORRECTED?                    (013)
--
-- Expect: one row, credentials_issued_ref_version, and NO row named
-- credentials_issued_credential_id_key.
--
-- This is the check that would have caught the defect. 004 declared
-- credential_id UNIQUE on its own, which makes version 2 of an award
-- impossible — the correction the University asked for in point 4 would have
-- failed with "duplicate key value", months after installation, in front of a
-- graduate. 013 replaces it with a unique index on (credential_id, version)
-- and adds a trigger so that two rows sharing a number are genuinely the same
-- award rather than a collision.
select indexname
  from pg_indexes
 where schemaname = 'public' and tablename = 'credentials_issued'
   and indexname in ('credentials_issued_ref_version', 'credentials_issued_credential_id_key')
 order by indexname;

-- 17. THE VERSION CHAIN IS GUARDED.                              (013)
--
-- Expect: one row — credentials_version_chain. Without it, unique
-- (credential_id, version) would let two unrelated awards share a number as
-- long as their versions differed, and /verify would show one graduate's award
-- as a version of another's.
select t.tgname, c.relname as on_table
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
 where t.tgname = 'credentials_version_chain';

-- 18. THE INSTALLATION SELF-TEST ROWS.                           (013)
--
-- Expect: two rows, both revoked, both named "Installation self-test".
--
-- 013 proves amendment works by actually issuing and correcting a credential.
-- The register refuses deletion by design, so the rows survive — revoked, and
-- labelled so nobody mistakes them for a real award. If this returns zero rows
-- the migration has not been run; if it returns rows that are NOT revoked,
-- something has interfered with them.
select credential_id, version, status, holder_name
  from credentials_issued
 where credential_id = 'IGUC-SELFTEST-013'
 order by version;

-- 19. THE EXAMINATION SYSTEM LANDED.                             (015)
--
-- Expect: fourteen rows.
select table_name
  from information_schema.tables
 where table_schema = 'public'
   and table_name in ('examinations', 'examination_officers', 'exam_sessions',
                      'exam_identity_checks', 'exam_device_checks', 'exam_events',
                      'exam_answers', 'exam_recordings', 'exam_session_decisions',
                      'exam_incidents', 'exam_findings', 'exam_marks',
                      'exam_reports', 'exam_audit_events')
 order by table_name;

-- 20. EXAMINATION EVIDENCE CANNOT BE REWRITTEN.                  (015)
--
-- Expect six triggers: five append-only guards on the evidence tables, and the
-- append-only guard on the audit trail. If any is missing, the University can
-- no longer say that its record of what happened during a sitting is the record
-- of what happened — which is the only thing that makes an appeal answerable.
select c.relname as on_table, t.tgname
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
 where t.tgname in ('exam_events_append_only', 'exam_identity_append_only',
                    'exam_device_append_only', 'exam_answers_append_only',
                    'exam_recordings_append_only', 'exam_audit_no_update')
 order by c.relname;

-- 21. NOBODY JUDGES THEIR OWN OBSERVATION OR MODERATES THEIR OWN MARK. (015)
--
-- Expect two triggers: exam_findings_second_reader and exam_marks_second_marker.
select t.tgname, c.relname as on_table
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
 where t.tgname in ('exam_findings_second_reader', 'exam_marks_second_marker')
 order by t.tgname;

-- 22. AN AUTOMATED EVENT STILL CANNOT EXPRESS A VERDICT.         (015)
--
-- Expect: ZERO rows. exam_events must have no column in which a finding could
-- be recorded — no is_cheating, no verdict, no misconduct, no outcome. The
-- University's instruction was that AI events are alerts and that a human makes
-- the academic-integrity decision, and a schema in which the automated layer
-- CANNOT express a verdict is a stronger guarantee than a policy saying it
-- should not. A row here means that guarantee has been lost.
select column_name
  from information_schema.columns
 where table_schema = 'public' and table_name = 'exam_events'
   and column_name in ('is_cheating', 'verdict', 'misconduct', 'outcome');

-- 23. RECORDINGS HAVE A RETENTION DATE.                          (015)
--
-- Expect: zero rows once recordings exist. A university that records its
-- students' homes has a data-protection obligation, and "we keep it for ever
-- because deleting is hard" is not a lawful answer anywhere this institution
-- teaches. Any row here is a recording nobody has decided the fate of.
select id, session_id, kind, started_at
  from exam_recordings
 where retention_until is null and destroyed_at is null
 order by started_at;
