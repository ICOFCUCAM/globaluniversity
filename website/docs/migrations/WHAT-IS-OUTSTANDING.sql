-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — WHICH MIGRATIONS HAVE NOT BEEN RUN
--
-- Paste the whole file into the Supabase SQL editor and press Run. It READS
-- ONLY: no table is created in your schema, nothing is written, nothing is
-- altered. The two temporary objects it makes live in `pg_temp` and vanish
-- when you close the tab.
--
-- ---------------------------------------------------------------------------
-- WHY THIS EXISTS
-- ---------------------------------------------------------------------------
--
-- These migrations are not tracked by a tool. Supabase's own migration table
-- only records what was applied through its CLI, and every one of these was
-- applied by hand in the SQL editor — so it has no record of them and cannot
-- answer the question. Asking a person which files they remember running is
-- not an answer either: the cost of a wrong memory is a policy that was never
-- created, which fails silently and looks exactly like a policy that refuses.
--
-- So this asks the DATABASE. Each row probes for something that a particular
-- migration creates and that nothing else creates — a table, a policy, a
-- function, a column, or in two cases the data the migration writes. If the
-- probe finds it, that migration ran.
--
-- ---------------------------------------------------------------------------
-- HOW TO READ THE RESULT
-- ---------------------------------------------------------------------------
--
--   status = 'RUN'          the probe found what that migration creates
--   status = 'NOT RUN'      it did not — run the file named in `file`
--   status = 'skip'         superseded by another file; do not run it
--
-- RUN THE OUTSTANDING ONES IN NUMERICAL ORDER. Later files depend on earlier
-- ones — 018 adds a policy to a table 000 creates — and running them out of
-- order fails loudly rather than quietly, but it still fails.
--
-- Every migration is idempotent, so if you are unsure whether one ran, running
-- it again is safe and changes nothing.
--
-- ---------------------------------------------------------------------------
-- WHAT A PROBE CANNOT TELL YOU
-- ---------------------------------------------------------------------------
--
-- That the migration ran COMPLETELY. A file that failed halfway may have
-- created the object this looks for and stopped before the rest. 'RUN' here
-- means "this landed"; docs/migrations/VERIFY.sql is the file that checks the
-- behaviour actually holds — that evidence cannot be rewritten, that nobody
-- can approve their own post, that a candidate cannot read their own answer
-- key. Read this one first and that one after.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- One probe, and it never throws.
--
-- A probe that raises on a missing table would abort the whole report at the
-- first migration that has not been run — which is precisely the case this
-- file exists to report on. An unanswerable probe is 'not found', because a
-- migration whose objects cannot even be looked at has certainly not landed.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.probe(sql text) returns boolean
  language plpgsql stable as $probe$
declare
  found boolean;
begin
  execute sql into found;
  return coalesce(found, false);
exception when others then
  return false;
end;
$probe$;

with checks(sort, migration, file, does, probe) as (values

  (0, '000', '000_complete.sql',
   'The whole schema — profiles, students, courses, results, departments, documents.',
   $$select to_regclass('public.profiles') is not null
        and to_regclass('public.students') is not null
        and to_regclass('public.results')  is not null$$),

  (1, '001', '001_full_schema.sql',
   'Superseded by 000. Do not run it on a new project.',
   $$select true$$),

  (2, '002', '002_superadmin.sql',
   'The Superadministrator role, account custody, and the append-only audit log.',
   $$select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname = 'public' and p.proname = 'auth_role')
        and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname = 'public' and p.proname = 'guard_profile_privileges')$$),

  (3, '003', '003_pipeline_rls.sql',
   'Admissions pipeline row-level-security policies.',
   $$select exists (select 1 from pg_policies
                     where schemaname = 'public' and tablename = 'students'
                       and policyname = 'students_staff_read')$$),

  (4, '004', '004_credential_register.sql',
   'The issued-credential register and revocation.',
   $$select to_regclass('public.credentials_issued') is not null$$),

  (5, '005', '005_senate_approval.sql',
   'Three-office approval of credential designs.',
   $$select to_regclass('public.credential_template_approvals') is not null$$),

  (6, '006', '006_awards_and_graduation.sql',
   'The award catalogue and the graduation check.',
   $$select to_regclass('public.awards') is not null$$),

  (7, '007', '007_gpa_engine.sql',
   'semester_gpas — where averages are written.',
   $$select to_regclass('public.semester_gpas') is not null$$),

  (8, '008', '008_admission_openings.sql',
   'What the University is currently admitting to.',
   $$select to_regclass('public.admission_openings') is not null$$),

  (9, '009', '009_results_approval.sql',
   'The grade approval chain: states, per-stage actors, the append-only transition log.',
   $$select to_regclass('public.result_transitions') is not null$$),

  (10, '010', '010_writes_the_ui_makes.sql',
   'Write policies for courses, payments and documents, and module_records.',
   $$select to_regclass('public.module_records') is not null$$),

  (11, '011', '011_school_of_ministry_curriculum.sql',
   'The School of Ministry curriculum, its prerequisites and the columns they need.',
   -- BOTH THE COLUMN AND THE DATA. The column alone would report 'RUN' for a
   -- file that added the columns and then failed before loading the curriculum.
   $$select exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'courses'
                       and column_name = 'programme_slug')
        and exists (select 1 from courses where programme_slug = 'bachelor-of-ministry')$$),

  (12, '012', '012_credit_framework.sql',
   'The credit ruling: every diploma 120, every bachelor''s 180, every master''s 120.',
   -- THE ONLY PROBE HERE IS THE DATA, because this migration creates nothing.
   -- It reports NOT RUN while any award disagrees with the ruling, which is
   -- also exactly the condition under which it needs running again.
   $$select to_regclass('public.awards') is not null
        and exists (select 1 from awards)
        and not exists (
              select 1 from awards
               where (kind = 'diploma'   and credits_required <> 120)
                  or (kind = 'bachelors' and credits_required <> 180)
                  or (kind = 'masters'   and credits_required <> 120))$$),

  (13, '013', '013_social_and_credential_authority.sql',
   'Eleven tables: the social pipeline, and the Credential Authority with versioned supersession.',
   $$select to_regclass('public.credential_audit_events') is not null
        and to_regclass('public.social_posts') is not null
        and to_regclass('public.credential_types') is not null$$),

  (14, '014', '014_social_approval_and_retry.sql',
   'Approval state kept separate from pipeline status, and the no-self-approval trigger.',
   $$select exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'social_posts'
                       and column_name = 'approval_state')$$),

  (15, '015', '015_examination_and_proctoring.sql',
   'Fourteen tables. Evidence is append-only; decisions are made by people and recorded as theirs.',
   $$select to_regclass('public.exam_sessions') is not null
        and to_regclass('public.exam_events') is not null
        and to_regclass('public.exam_marks') is not null$$),

  (16, '016', '016_examination_papers.sql',
   'The paper each candidate saw, set once — and the view that hides the answer key from them.',
   $$select to_regclass('public.exam_sessions_mine') is not null$$),

  (17, '017', '017_secret_store.sql',
   'AES-256-GCM sealed tokens. RLS on, and deliberately no policy at all.',
   $$select to_regclass('public.secret_store') is not null$$),

  (18, '018', '018_delete_application.sql',
   'Who may delete an application: the Superadministrator alone, with a trigger behind the policy.',
   -- THE POLICY AND THE TRIGGER. The policy governs the browser; the trigger
   -- governs the service role, which bypasses policies entirely. One without
   -- the other is half the rule.
   $$select exists (select 1 from pg_policies
                     where schemaname = 'public' and tablename = 'students'
                       and policyname = 'students_superadmin_delete')
        and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname = 'public' and p.proname = 'guard_application_delete')$$),

  (19, '019', '019_academic_record.sql',
   'Study mode, campus, specialization, repeated attempts, transfer credit, honours, conferral, standing.',
   $$select exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'students'
                       and column_name = 'mode_of_study')
        and to_regclass('public.transfer_credits') is not null
        and to_regclass('public.academic_policy') is not null$$),

  (20, '020', '020_signature_void_and_grading.sql',
   'A detached Ed25519 signature, voiding as distinct from revoking, and a versioned grading scale.',
   $$select exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'credentials_issued'
                       and column_name = 'signature')
        and to_regclass('public.grading_scales') is not null$$)
)
select
  c.migration,
  case
    when c.migration = '001' then 'skip'
    when pg_temp.probe(c.probe) then 'RUN'
    else 'NOT RUN'
  end                                                as status,
  c.file,
  c.does
from checks c
order by c.sort;

-- ---------------------------------------------------------------------------
-- AND THE ANSWER IN ONE LINE.
--
-- Run this second query for the verdict on its own: how many are outstanding,
-- and the exact command to put right. If it says none, the database is current
-- with the repository.
-- ---------------------------------------------------------------------------
with checks(sort, migration, file, probe) as (values
  (0,  '000', '000_complete.sql',                        $$select to_regclass('public.profiles') is not null and to_regclass('public.students') is not null and to_regclass('public.results') is not null$$),
  (2,  '002', '002_superadmin.sql',                      $$select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname='public' and p.proname='auth_role')$$),
  (3,  '003', '003_pipeline_rls.sql',                    $$select exists (select 1 from pg_policies where schemaname='public' and tablename='students' and policyname='students_staff_read')$$),
  (4,  '004', '004_credential_register.sql',             $$select to_regclass('public.credentials_issued') is not null$$),
  (5,  '005', '005_senate_approval.sql',                 $$select to_regclass('public.credential_template_approvals') is not null$$),
  (6,  '006', '006_awards_and_graduation.sql',           $$select to_regclass('public.awards') is not null$$),
  (7,  '007', '007_gpa_engine.sql',                      $$select to_regclass('public.semester_gpas') is not null$$),
  (8,  '008', '008_admission_openings.sql',              $$select to_regclass('public.admission_openings') is not null$$),
  (9,  '009', '009_results_approval.sql',                $$select to_regclass('public.result_transitions') is not null$$),
  (10, '010', '010_writes_the_ui_makes.sql',             $$select to_regclass('public.module_records') is not null$$),
  (11, '011', '011_school_of_ministry_curriculum.sql',   $$select exists (select 1 from courses where programme_slug = 'bachelor-of-ministry')$$),
  (12, '012', '012_credit_framework.sql',                $$select exists (select 1 from awards) and not exists (select 1 from awards where (kind='diploma' and credits_required<>120) or (kind='bachelors' and credits_required<>180) or (kind='masters' and credits_required<>120))$$),
  (13, '013', '013_social_and_credential_authority.sql', $$select to_regclass('public.credential_audit_events') is not null and to_regclass('public.social_posts') is not null$$),
  (14, '014', '014_social_approval_and_retry.sql',       $$select exists (select 1 from information_schema.columns where table_schema='public' and table_name='social_posts' and column_name='approval_state')$$),
  (15, '015', '015_examination_and_proctoring.sql',      $$select to_regclass('public.exam_sessions') is not null and to_regclass('public.exam_marks') is not null$$),
  (16, '016', '016_examination_papers.sql',              $$select to_regclass('public.exam_sessions_mine') is not null$$),
  (17, '017', '017_secret_store.sql',                    $$select to_regclass('public.secret_store') is not null$$),
  (18, '018', '018_delete_application.sql',              $$select exists (select 1 from pg_policies where schemaname='public' and tablename='students' and policyname='students_superadmin_delete') and exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='guard_application_delete')$$),
  (19, '019', '019_academic_record.sql',                 $$select to_regclass('public.transfer_credits') is not null and to_regclass('public.academic_policy') is not null and exists (select 1 from information_schema.columns where table_schema='public' and table_name='students' and column_name='mode_of_study')$$),
  (20, '020', '020_signature_void_and_grading.sql',      $$select to_regclass('public.grading_scales') is not null and exists (select 1 from information_schema.columns where table_schema='public' and table_name='credentials_issued' and column_name='signature')$$)
), outstanding as (
  select migration, file from checks where not pg_temp.probe(probe) order by sort
)
select
  case when count(*) = 0
       then 'Nothing outstanding. The database is current with the repository.'
       else count(*) || ' migration(s) still to run, in this order: '
            || string_agg(file, ', ' order by migration)
  end as verdict
from outstanding;
