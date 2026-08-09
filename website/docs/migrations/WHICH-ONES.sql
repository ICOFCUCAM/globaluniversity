-- ICOF GLOBAL UNIVERSITY — which migrations still need running.
-- Paste into the Supabase SQL editor and Run. Reads only; changes nothing.
select coalesce(string_agg(f, ', ' order by n), 'Nothing outstanding.') as still_to_run
from (values
  ('000_complete.sql',                         0, to_regclass('public.profiles')                  is not null),
  ('003_pipeline_rls.sql',                     3, exists (select 1 from pg_policies where tablename='students' and policyname='students_staff_read')),
  ('004_credential_register.sql',              4, to_regclass('public.credentials_issued')         is not null),
  ('005_senate_approval.sql',                  5, to_regclass('public.credential_template_approvals') is not null),
  ('006_awards_and_graduation.sql',            6, to_regclass('public.awards')                     is not null),
  ('007_gpa_engine.sql',                       7, to_regclass('public.semester_gpas')              is not null),
  ('008_admission_openings.sql',               8, to_regclass('public.admission_openings')         is not null),
  ('009_results_approval.sql',                 9, to_regclass('public.result_transitions')         is not null),
  ('010_writes_the_ui_makes.sql',             10, to_regclass('public.module_records')             is not null),
  ('011_school_of_ministry_curriculum.sql',   11, exists (select 1 from information_schema.columns where table_name='courses' and column_name='programme_slug')),
  -- 012 CREATES NO SCHEMA AT ALL; it sets credit values. So the probe is the
  -- data, and it reports the file as still to run while any award disagrees
  -- with the ruling — which is also exactly when it needs running again. The
  -- first version of this line probed `courses.credit_system`, a column 011
  -- adds, so it would have reported 012 as done on a database where it never
  -- ran.
  ('012_credit_framework.sql',                12,
     to_regclass('public.awards') is not null
     and exists (select 1 from awards)
     and not exists (select 1 from awards
                      where (kind='diploma'   and credits_required <> 120)
                         or (kind='bachelors' and credits_required <> 180)
                         or (kind='masters'   and credits_required <> 120))),
  ('013_social_and_credential_authority.sql', 13, to_regclass('public.credential_audit_events')    is not null),
  ('014_social_approval_and_retry.sql',       14, exists (select 1 from information_schema.columns where table_name='social_posts' and column_name='approval_state')),
  ('015_examination_and_proctoring.sql',      15, to_regclass('public.exam_sessions')              is not null),
  ('016_examination_papers.sql',              16, to_regclass('public.exam_sessions_mine')         is not null),
  ('017_secret_store.sql',                    17, to_regclass('public.secret_store')               is not null),
  ('018_delete_application.sql',              18, exists (select 1 from pg_policies where tablename='students' and policyname='students_superadmin_delete')),
  ('019_academic_record.sql',                 19, to_regclass('public.transfer_credits')           is not null),
  ('020_signature_void_and_grading.sql',      20, to_regclass('public.grading_scales')             is not null)
) as m(f, n, landed)
where not landed;
