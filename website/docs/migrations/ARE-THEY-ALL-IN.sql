-- ===========================================================================
-- ICOF GLOBAL UNIVERSITY — ARE ALL THE MIGRATIONS IN PLACE?
--
-- GENERATED FILE. DO NOT EDIT.
--   Generator: scripts/build-migration-run.mjs --report-only
--
-- ---------------------------------------------------------------------------
-- READS ONLY. CHANGES NOTHING.
--
-- Paste the whole file into the Supabase SQL editor and run it. It asks the
-- database catalogue what exists and reports one line per migration. It
-- creates nothing, alters nothing and drops nothing, so it is safe to run at
-- any time, as often as you like, on a live database.
--
-- ---------------------------------------------------------------------------
-- HOW TO READ THE RESULT
--
--   landed = YES   the thing that migration creates is there.
--   landed = NO    it is not. That migration has not been run.
--
-- A NO with YESes after it is the case worth stopping on: migrations are
-- written to run in order, and a gap means something later was applied to a
-- database that was missing what it assumed. Run RUN-OUTSTANDING.sql, which is
-- idempotent and will skip everything already present.
--
-- WHAT THIS CANNOT TELL YOU. It checks that each migration's marker exists —
-- not that every statement inside it succeeded. A migration that created its
-- table and then failed on a later statement reports YES. The bundles' own
-- proofs are what cover that, and they stop the run on failure.
-- ===========================================================================

-- ===========================================================================
-- DID IT LAND?  — READ THIS TABLE
-- ===========================================================================
--
-- Every row should say YES. A row saying NO means that migration did not take
-- effect: scroll up for the first red ERROR, fix it, and run the file again.
-- Running it twice is safe.
--
-- The proofs inside each migration also RAISE NOTICE, which the Supabase SQL
-- editor does not show. This table is the same answer in a form it does.
-- ===========================================================================

select * from (
  select '036' as migration, '036_the_steps_nothing_could_write.sql' as file,
         case when to_regclass('public.admission_audit_log') is not null then 'YES' else 'NO' end as landed,
         'admission_audit_log' as what_it_creates
  union all
  select '037' as migration, '037_a_student_is_not_an_application.sql' as file,
         case when to_regclass('public.students') is not null then 'YES' else 'NO' end as landed,
         'students' as what_it_creates
  union all
  select '038' as migration, '038_announcements_are_the_institution_speaking.sql' as file,
         case when to_regclass('public.announcements') is not null then 'YES' else 'NO' end as landed,
         'announcements' as what_it_creates
  union all
  select '039' as migration, '039_a_destination_is_a_publishing_job.sql' as file,
         case when to_regclass('public.announcement_media') is not null then 'YES' else 'NO' end as landed,
         'announcement_media' as what_it_creates
  union all
  select '040' as migration, '040_emergency_publishing_and_erasure.sql' as file,
         case when to_regclass('public.announcement_tombstones') is not null then 'YES' else 'NO' end as landed,
         'announcement_tombstones' as what_it_creates
  union all
  select '041' as migration, '041_appointments_and_the_letters_that_issue_from_them.sql' as file,
         case when to_regclass('public.appointments') is not null then 'YES' else 'NO' end as landed,
         'appointments' as what_it_creates
  union all
  select '042' as migration, '042_the_appointment_lifecycle_and_the_staff_record.sql' as file,
         case when to_regclass('public.appointment_events') is not null then 'YES' else 'NO' end as landed,
         'appointment_events' as what_it_creates
  union all
  select '043' as migration, '043_working_hours_and_the_appointing_authority.sql' as file,
         case when to_regclass('public.appointment_letters_unverifiable') is not null then 'YES' else 'NO' end as landed,
         'appointment_letters_unverifiable' as what_it_creates
  union all
  select '044' as migration, '044_document_templates_and_the_letters_tied_to_them.sql' as file,
         case when to_regclass('public.document_templates') is not null then 'YES' else 'NO' end as landed,
         'document_templates' as what_it_creates
  union all
  select '045' as migration, '045_official_correspondence_and_who_initiated_it.sql' as file,
         case when to_regclass('public.correspondence') is not null then 'YES' else 'NO' end as landed,
         'correspondence' as what_it_creates
  union all
  select '046' as migration, '046_the_correspondence_history_and_the_delegated_draft.sql' as file,
         case when to_regclass('public.correspondence_events') is not null then 'YES' else 'NO' end as landed,
         'correspondence_events' as what_it_creates
  union all
  select '047' as migration, '047_the_money_the_actors_and_the_two_axes.sql' as file,
         case when to_regclass('public.appointment_allowances') is not null then 'YES' else 'NO' end as landed,
         'appointment_allowances' as what_it_creates
  union all
  select '048' as migration, '048_the_job_descriptions_and_what_they_inherit.sql' as file,
         case when to_regclass('public.positions') is not null then 'YES' else 'NO' end as landed,
         'positions' as what_it_creates
  union all
  select '049' as migration, '049_verification_signatures_and_the_written_letter.sql' as file,
         case when to_regclass('public.signature_specimens') is not null then 'YES' else 'NO' end as landed,
         'signature_specimens' as what_it_creates
  union all
  select '050' as migration, '050_acceptance_the_activation_rule_and_the_full_audit.sql' as file,
         case when to_regclass('public.appointment_acceptances') is not null then 'YES' else 'NO' end as landed,
         'appointment_acceptances' as what_it_creates
  union all
  select '051' as migration, '051_templates_for_every_document_the_university_issues.sql' as file,
         case when to_regclass('public.document_template_coverage') is not null then 'YES' else 'NO' end as landed,
         'document_template_coverage' as what_it_creates
  union all
  select '052' as migration, '052_a_first_draft_of_every_document.sql' as file,
         case when to_regclass('public.document_templates') is null then 'NO'
                 when exists (select 1 from document_templates where created_by is null) then 'YES'
                 else 'NO' end as landed,
         'rows:document_templates:created_by is null' as what_it_creates
  union all
  select '053' as migration, '053_where_an_office_stands.sql' as file,
         case when exists (
                   select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = 'positions'
                      and column_name = 'standing')
                 then 'YES' else 'NO' end as landed,
         'positions.standing' as what_it_creates
  union all
  select '054' as migration, '054_course_registration.sql' as file,
         case when to_regclass('public.course_roll') is not null then 'YES' else 'NO' end as landed,
         'course_roll' as what_it_creates
  union all
  select '055' as migration, '055_the_office_that_needs_no_second_signature.sql' as file,
         case when exists (
                   select 1 from pg_constraint
                    where conname = 'appointments_second_pair_of_eyes'
                      and position('made_on_sole_authority' in pg_get_constraintdef(oid)) > 0)
                 then 'YES' else 'NO' end as landed,
         'def:appointments_second_pair_of_eyes:made_on_sole_authority' as what_it_creates
  union all
  select '056' as migration, '056_what_an_office_may_not_even_see.sql' as file,
         case when to_regclass('public.capability_grants') is not null then 'YES' else 'NO' end as landed,
         'capability_grants' as what_it_creates
  union all
  select '057' as migration, '057_the_academic_structure.sql' as file,
         case when to_regclass('public.programme_versions') is not null then 'YES' else 'NO' end as landed,
         'programme_versions' as what_it_creates
  union all
  select '058' as migration, '058_the_vice_chancellor_approves_a_curriculum.sql' as file,
         case when to_regclass('public.academic_approval_requirements') is null then 'NO'
                 when exists (select 1 from academic_approval_requirements where subject = 'curriculum') then 'YES'
                 else 'NO' end as landed,
         'rows:academic_approval_requirements:subject = ''curriculum''' as what_it_creates
) as landed_report
 order by migration;

