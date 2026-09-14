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
  union all
  select '059' as migration, '059_the_academic_calendar.sql' as file,
         case when to_regclass('public.academic_terms') is not null then 'YES' else 'NO' end as landed,
         'academic_terms' as what_it_creates
  union all
  select '060' as migration, '060_the_schools_and_programmes.sql' as file,
         case when to_regclass('public.programmes') is null then 'NO'
                 when exists (select 1 from programmes where true) then 'YES'
                 else 'NO' end as landed,
         'rows:programmes:true' as what_it_creates
  union all
  select '061' as migration, '061_a_version_for_every_programme.sql' as file,
         case when to_regclass('public.programme_versions') is null then 'NO'
                 when exists (select 1 from programme_versions where true) then 'YES'
                 else 'NO' end as landed,
         'rows:programme_versions:true' as what_it_creates
  union all
  select '062' as migration, '062_the_curricula_already_written.sql' as file,
         case when to_regclass('public.curriculum_progress') is not null then 'YES' else 'NO' end as landed,
         'curriculum_progress' as what_it_creates
  union all
  select '063' as migration, '063_the_offering_and_the_class.sql' as file,
         case when to_regclass('public.course_offerings') is not null then 'YES' else 'NO' end as landed,
         'course_offerings' as what_it_creates
  union all
  select '064' as migration, '064_the_rooms_to_start_from.sql' as file,
         case when exists (
                   select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = 'rooms'
                      and column_name = 'provisional')
                 then 'YES' else 'NO' end as landed,
         'rooms.provisional' as what_it_creates
  union all
  select '065' as migration, '065_the_year_that_cannot_lie.sql' as file,
         case when to_regclass('public.academic_year_now') is not null then 'YES' else 'NO' end as landed,
         'academic_year_now' as what_it_creates
  union all
  select '066' as migration, '066_when_registration_is_open.sql' as file,
         case when to_regclass('public.registration_window') is not null then 'YES' else 'NO' end as landed,
         'registration_window' as what_it_creates
  union all
  select '067' as migration, '067_one_student_one_record.sql' as file,
         case when to_regclass('public.student_academic_record') is not null then 'YES' else 'NO' end as landed,
         'student_academic_record' as what_it_creates
  union all
  select '068' as migration, '068_the_course_as_a_place_to_learn.sql' as file,
         case when to_regclass('public.course_materials') is not null then 'YES' else 'NO' end as landed,
         'course_materials' as what_it_creates
  union all
  select '069' as migration, '069_the_end_of_the_chain.sql' as file,
         case when to_regclass('public.graduation_candidate') is not null then 'YES' else 'NO' end as landed,
         'graduation_candidate' as what_it_creates
  union all
  select '070' as migration, '070_where_the_student_stands.sql' as file,
         case when to_regclass('public.my_journey') is not null then 'YES' else 'NO' end as landed,
         'my_journey' as what_it_creates
  union all
  select '071' as migration, '071_what_the_student_is_owed.sql' as file,
         case when to_regclass('public.my_results') is not null then 'YES' else 'NO' end as landed,
         'my_results' as what_it_creates
  union all
  select '072' as migration, '072_the_numbers_to_start_from.sql' as file,
         case when exists (
                   select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = 'programme_versions'
                      and column_name = 'provisional')
                 then 'YES' else 'NO' end as landed,
         'programme_versions.provisional' as what_it_creates
  union all
  select '073' as migration, '073_asking_the_university_for_something.sql' as file,
         case when to_regclass('public.student_requests') is not null then 'YES' else 'NO' end as landed,
         'student_requests' as what_it_creates
  union all
  select '074' as migration, '074_connecting_what_was_already_there.sql' as file,
         case when to_regclass('public.my_requests') is not null then 'YES' else 'NO' end as landed,
         'my_requests' as what_it_creates
  union all
  select '075' as migration, '075_what_a_student_is_charged.sql' as file,
         case when to_regclass('public.fee_schedules') is not null then 'YES' else 'NO' end as landed,
         'fee_schedules' as what_it_creates
  union all
  select '076' as migration, '076_one_transcript_one_download.sql' as file,
         case when exists (
                   select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = 'transcript_requests'
                      and column_name = 'downloads_allowed')
                 then 'YES' else 'NO' end as landed,
         'transcript_requests.downloads_allowed' as what_it_creates
  union all
  select '077' as migration, '077_a_mark_is_moderated_before_anybody_sees_it.sql' as file,
         case when to_regclass('public.my_results') is null then 'NO'
                 when position('Moderated, with the Faculty' in
                               pg_get_viewdef('public.my_results'::regclass)) > 0
                 then 'YES' else 'NO' end as landed,
         'viewdef:my_results:Moderated, with the Faculty' as what_it_creates
  union all
  select '078' as migration, '078_the_conditions_every_post_is_appointed_on.sql' as file,
         case when to_regclass('public.appointment_condition_sets') is not null then 'YES' else 'NO' end as landed,
         'appointment_condition_sets' as what_it_creates
  union all
  select '079' as migration, '079_sending_a_document_by_whatsapp.sql' as file,
         case when exists (
                   select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = 'correspondence'
                      and column_name = 'recipient_phone')
                 then 'YES' else 'NO' end as landed,
         'correspondence.recipient_phone' as what_it_creates
  union all
  select '080' as migration, '080_the_appointees_three_days.sql' as file,
         case when exists (
                   select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = 'appointments'
                      and column_name = 'appointee_download_until')
                 then 'YES' else 'NO' end as landed,
         'appointments.appointee_download_until' as what_it_creates
  union all
  select '081' as migration, '081_what_an_hr_officer_may_see_and_correct.sql' as file,
         case when exists (
                   select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = 'appointments_without_pay'
                      and column_name = 'terms')
                 then 'YES' else 'NO' end as landed,
         'appointments_without_pay.terms' as what_it_creates
  union all
  select '082' as migration, '082_the_staff_register.sql' as file,
         case when to_regclass('public.staff_records') is not null then 'YES' else 'NO' end as landed,
         'staff_records' as what_it_creates
) as landed_report
 order by migration;

