// ---------------------------------------------------------------------------
// WHICH MIGRATIONS THIS DATABASE HAS HAD, READ FROM THE DATABASE ITSELF.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
//
// The University asked why it always had to ask for the migrations. The honest
// answer was that the list lived in my head and in a commit message, so the
// only way to find out what was outstanding was for somebody to ask somebody.
// That is not a system; it is a habit, and habits are forgotten exactly when
// they matter — the week somebody else is doing the deployment.
//
// So the system answers it. Each entry below names one thing a migration
// creates and where to look for it; the readiness route tries to read it and
// reports what is not there. Nobody has to remember, and nobody has to ask.
//
// ---------------------------------------------------------------------------
// WHAT IT CAN AND CANNOT SEE
// ---------------------------------------------------------------------------
//
// It reads through the same interface the application uses, so it sees exactly
// what the application would: a missing table and a missing column both come
// back as an error naming what is absent.
//
// It CANNOT see a migration that adds no table and no column — one that only
// widens a CHECK constraint, or replaces a function. Those are named here too,
// with what to run to check them by hand, rather than being left out and
// silently reported as fine. A readiness screen that says "all clear" about
// something it never looked at is worse than one that admits the gap.
// ---------------------------------------------------------------------------

export interface MigrationProbe {
  /** The file, as it sits in docs/migrations. */
  file: string;
  /** What the University gets from it, in a sentence a registrar can read. */
  what: string;
  /**
   * A table or view the migration creates, or a table it adds `column` to.
   *
   * A VIEW IS AS GOOD AS A TABLE HERE, because the probe reads through
   * PostgREST and PostgREST serves both the same way.
   *
   * Absent where nothing can be read — naming a table a constraint-only
   * migration merely touches would read as though that table were the marker.
   */
  table?: string;
  /** Absent when the table itself is the marker. */
  column?: string;
  /**
   * Set where nothing the application can read changes.
   *
   * The value is the check to run by hand. These migrations are reported as
   * unverifiable rather than as applied: the alternative is a screen that
   * quietly vouches for something it has not looked at.
   */
  cannotSee?: string;
}

/**
 * The migrations that add something readable, oldest first.
 *
 * NOT EVERY MIGRATION — the early ones build the schema the application cannot
 * start without, and a portal that renders at all has had them. These are the
 * ones that add capability afterwards, which is where a database falls behind:
 * somebody deploys the code on Friday and runs the SQL on Monday, and in
 * between one screen refuses with a message about a column.
 */
export const MIGRATION_PROBES: MigrationProbe[] = [
  {
    file: '004_credential_register.sql',
    what: 'The register of everything the University has issued.',
    table: 'credentials_issued',
  },
  {
    file: '005_senate_approval.sql',
    what: 'The approval chain: a design is signed by three offices before it is published.',
    table: 'credential_template_approvals',
  },
  {
    file: '006_awards_and_graduation.sql',
    what: 'The awards the University confers and what each requires.',
    table: 'awards',
  },
  {
    file: '009_results_approval.sql',
    what: 'The approval chain for marks, and the record of every transition.',
    table: 'result_transitions',
  },
  {
    file: '011_school_of_ministry_curriculum.sql',
    what: 'Prerequisites, co-requisites and the mode a course requires.',
    table: 'courses',
    column: 'prerequisites',
  },
  {
    file: '013_social_and_credential_authority.sql',
    what: 'Credential versioning and correction, and the social command centre.',
    table: 'credentials_issued',
    column: 'version',
  },
  {
    file: '015_examination_and_proctoring.sql',
    what: 'Examinations, sittings and the proctoring record.',
    table: 'examinations',
  },
  {
    file: '016_examination_papers.sql',
    what: 'The paper itself, built and held against the sitting.',
    table: 'exam_sessions',
    column: 'paper',
  },
  {
    file: '017_secret_store.sql',
    what: 'The sealed store the University keeps its own secrets in.',
    table: 'secret_store',
  },
  {
    file: '019_academic_record.sql',
    what: 'Transfer credits, honours, academic standing and the fuller student record.',
    table: 'transfer_credits',
  },
  {
    file: '020_signature_void_and_grading.sql',
    what: 'Detached signatures on the register, voiding with a reason, and the published '
      + 'grading scale.',
    table: 'credentials_issued',
    column: 'signature',
  },
  {
    file: '021_signing_key_in_the_store.sql',
    what: 'Lets the system keep the document signing key in its own sealed store.',
    // A widened CHECK constraint changes nothing the application can read.
    cannotSee: "select pg_get_constraintdef(oid) from pg_constraint "
      + "where conname = 'secret_store_kind_check';  -- it should list 'signing_key'",
  },
  {
    file: '022_publication_under_own_authority.sql',
    what: 'Lets the Superadministrator publish a design without the three offices, on the record.',
    table: 'credential_templates',
    column: 'published_without_approval',
  },
  {
    file: '023_programme_application_approval.sql',
    what: 'Which programmes may accept applications, who authorised each, and every change since.',
    // The trail rather than the openings table: 008 created that one, so its
    // presence would report 023 as run on a database that has only had 008.
    table: 'admission_opening_events',
  },
  {
    file: '024_admission_decision_authority.sql',
    what: 'The academic admission decision as an immutable record, its audit log, and a '
      + 'student number two approvals cannot collide on.',
    // The decision table rather than the audit log: both arrive together, and
    // this is the one the University reads when asked who admitted somebody.
    table: 'admission_decisions',
  },
  {
    file: '025_state_vocabulary_and_authority.sql',
    what: 'Locks the state vocabulary to the software, splits code from label, and records the '
      + 'office behind every admission event, not only the person.',
    table: 'admission_audit_log',
    column: 'actor_office',
  },
  {
    file: '026_issuance_is_not_the_decision.sql',
    what: 'Separates the academic decision from the issuance, so a half-finished admission is '
      + 'its own state and can be retried rather than corrected by hand.',
    // Not a table or a column — two rows in an existing table. Named here so
    // the Readiness panel does not report it as fine without looking.
    cannotSee: "select state, label from admission_states where stage = 'issuance';"
      + "  -- it should list admission_processing and admission_processing_failed",
  },
  {
    file: '027_the_states_the_pipeline_already_wrote.sql',
    what: 'Declares the three states the pipeline has always written — registrar_approved, '
      + 'declined and deferred — and adds the view that reports any status the vocabulary '
      + 'does not know, so an application can no longer be invisible in silence.',
    // The view, which no earlier migration creates. It reads through PostgREST
    // exactly as a table does, so this one IS visible — unlike 026, which only
    // added rows.
    table: 'admission_status_coverage',
  },
  {
    file: '028_student_numbers_start_above_the_existing_ones.sql',
    what: 'Stops a reserved student number colliding with one already issued — which refused '
      + 'the first admission after 024 on any year that already had students.',
    // Replaces a function and adds no table and no column, so the application
    // cannot see it. Named here rather than left out: a readiness screen that
    // says "all clear" about something it never looked at is worse than one
    // that admits the gap.
    cannotSee: "select prosrc like '%greatest(student_number_counters.next_value%' as has_028 "
      + "from pg_proc where proname = 'reserve_student_number';  -- it should be true",
  },
  {
    file: '029_the_coverage_view_is_for_operators_only.sql',
    what: 'Takes the status coverage view off the public API. It reads past row-level security '
      + 'and carries no filter, so any signed-in account could read the shape of the whole '
      + 'admissions pipeline through it.',
    // A revoke changes no table and no column. Worse, the probe reads through
    // the service role — which still has access on purpose — so it would come
    // back applied whether the revoke had run or not.
    cannotSee: "select has_table_privilege('authenticated', "
      + "'public.admission_status_coverage', 'SELECT');  -- it should be false",
  },
  {
    file: '030_functions_pin_their_search_path.sql',
    what: 'Stops every function resolving table names against whatever the caller set, and takes '
      + 'the student-number reserver off the public API — anybody could call it in a loop and '
      + 'push the University’s numbering arbitrarily far forward.',
    // Grants and function settings. Nothing the application can read.
    cannotSee: 'select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace '
      + "where s.nspname = 'public' and p.prokind = 'f' and not exists (select 1 from "
      + "unnest(coalesce(p.proconfig,'{}'::text[])) c where c like 'search_path=%');  -- 0",
  },
  {
    file: '031_the_letters_the_university_has_issued.sql',
    what: 'Keeps every admission package the University issues, with the outcome of its '
      + 'delivery — so a letter that failed to send is in an outbox rather than gone, and the '
      + 'University can see what it actually sent a student.',
    table: 'admission_letters',
  },
  {
    file: '032_forwarding_and_returning.sql',
    what: 'Lets the Admissions Office forward an application for an academic decision — the '
      + 'doorway into the final stage, which the vocabulary declared and nothing could reach — '
      + 'and lets a return name the office it goes back to rather than merely going back.',
    table: 'students',
    column: 'returned_to',
  },
  {
    file: '033_reevaluation.sql',
    what: 'Lets a decided application be put back on the desk with a reason — an appeal upheld, '
      + 'a document reported as forged — without editing the decision already taken.',
    table: 'students',
    column: 'reopened_reason',
  },
  {
    file: '034_enrolment_and_withdrawal.sql',
    what: 'Ends the journey — the Registrar can record that an admitted student took up the '
      + 'place — and lets an applicant withdraw without being recorded as refused by the '
      + 'University, which is what happened until now.',
    table: 'students',
    column: 'enrolled_at',
  },
  {
    file: '035_the_american_scale_and_the_new_credit_values.sql',
    what: 'Puts the American grading scale in force and applies it to transcripts already '
      + 'issued — every grade point and every average is restated, with a record of what each '
      + 'one was before. Sets the Bachelor of Theology credit values: the eight two-part '
      + 'courses at 3 and the thesis at 20.',
    // The record of the restatement, which no earlier migration creates. Chosen
    // over the scale_version columns because it is the thing that would be
    // missing if the migration half-ran: the columns can exist with nothing
    // restated into them, and a Readiness panel reporting "applied" on that
    // would be vouching for a recompute that never happened.
    table: 'grading_scale_restatements',
  },
  {
    file: '036_the_steps_nothing_could_write.sql',
    what: 'Makes three states the University declared in 024 reachable for the first time: an '
      + 'application the Admissions Office has opened, a fee that has been asked for, and '
      + 'documents that were positively checked rather than merely no longer outstanding.',
    // A widened CHECK constraint adds no table and no column. Named here with
    // the query to run rather than left out: a Readiness panel that says "all
    // clear" about something it never looked at is worse than one that admits
    // the gap.
    cannotSee: "select pg_get_constraintdef(oid) like '%ADMISSION_OPENED%' as has_036 "
      + "from pg_constraint where conname = 'admission_audit_log_event_check';"
      + '  -- it should be true',
  },
  {
    file: '037_a_student_is_not_an_application.sql',
    what: 'Splits `students.status` into the admission state and what became of the student. '
      + 'Two vocabularies shared one column and two words appeared in both, so an applicant who '
      + 'declined a place and a student who left in their second year were the same value — and '
      + 'conferring a degree overwrote the record of the enrolment it rested on.',
    // The record of what the split moved. Chosen over the column itself
    // because the column can exist with nothing migrated into it, and a panel
    // reporting "applied" on that would be vouching for a split that never ran.
    table: 'student_status_split',
  },
  {
    file: '038_announcements_are_the_institution_speaking.sql',
    what: 'Makes an announcement an institutional record rather than a row on the documents '
      + 'table: an author, a clearance by somebody else, a publication that names who did it, '
      + 'an append-only history, one row per destination, and a platform-by-platform '
      + 'adaptation of the same words.',
    // The history. Chosen over `announcements` itself because the table can
    // exist with no trail attached, and a Readiness panel reporting "applied"
    // on that would be vouching for the one thing the old noticeboard lacked.
    table: 'announcement_events',
  },
  {
    file: '039_a_destination_is_a_publishing_job.sql',
    what: 'Turns each destination into a publishing job that keeps its own receipt: the '
      + 'platform’s post id, its own scheduled time, a retry count and the exact text sent. '
      + 'Gives an announcement more than one picture, each described. Creates somewhere for '
      + 'engagement figures to live — deliberately empty, because nothing collects them yet.',
    // The media table. Chosen over `announcement_metrics` because that one is
    // meant to be empty, so its presence says nothing about whether the rest
    // of the migration ran.
    table: 'announcement_media',
  },
  {
    file: '040_emergency_publishing_and_erasure.sql',
    what: 'Lets one person publish an emergency notice without a second pair of eyes — only an '
      + 'emergency, only with a stated reason, and the record says so permanently. And lets the '
      + 'Superadministrator erase an announcement, which 038 made impossible: the text is '
      + 'destroyed and a tombstone records that it existed, who removed it and where it had '
      + 'already reached.',
    table: 'announcement_tombstones',
  },
  {
    file: '041_appointments_and_the_letters_that_issue_from_them.sql',
    what: 'Gives the University somewhere to record that it has appointed somebody — position, '
      + 'employment type, start date, probation, place of duty, reporting officer and pay — and '
      + 'makes the appointment letter an output generated from that record, versioned and '
      + 'sealed, rather than the place the facts live.',
    table: 'appointments',
  },
  {
    file: '042_the_appointment_lifecycle_and_the_staff_record.sql',
    what: 'Gives an appointment the full lifecycle — approved, letter generated, issued, '
      + 'accepted, active — and the amendment path for when something changes after issuance. '
      + 'Closes the door that mattered: a staff record can no longer be created from an '
      + 'appointment that was never issued.',
    // THE DOOR IT CLOSES, rather than a column on `appointments`. A staff row
    // that names the appointment behind it is the whole point of 042, and it
    // is the thing whose absence means the guard is not there.
    table: 'lecturers',
    column: 'appointment_id',
  },
  {
    file: '043_working_hours_and_the_appointing_authority.sql',
    what: 'Two fields the letter has to state and the record did not carry — working hours, and '
      + 'the body that made the appointment, which is not the officer who approved it here. '
      + 'And a hash over the archived letter, so “this is the document we sent” can be proved '
      + 'rather than rested on a trigger having worked.',
    table: 'appointment_letters',
    column: 'content_hash',
  },
  {
    file: '044_document_templates_and_the_letters_tied_to_them.sql',
    what: 'A template registry for the eleven HR document types, each versioned, one active at '
      + 'a time, activated by somebody other than whoever wrote it. Every issued letter records '
      + 'which template version produced it, and that version can then never be deleted — a '
      + 'document issued in 2026 was produced by the wording of 2026.',
    table: 'document_templates',
  },
  {
    file: '045_official_correspondence_and_who_initiated_it.sql',
    what: 'A register of the University’s own official letters — invitations, commendations, '
      + 'correspondence with a ministry, directives — which did not exist at all. Records who '
      + 'INITIATED separately from who authorised, so an appointment proposed by HR and one '
      + 'started by the Vice-Chancellor are finally distinguishable, and makes an appointment '
      + 'made on one office’s sole authority visible and permanent rather than quiet.',
    table: 'correspondence',
  },
  {
    file: '046_the_correspondence_history_and_the_delegated_draft.sql',
    what: 'The history 045 left out — official correspondence was the only institutional act in '
      + 'this system with no append-only record of who did what to it. Also makes “prepare this '
      + 'letter” a real act: the Vice-Chancellor can hand a letter to an administrator with a '
      + 'brief, before the letter exists, and the authority does not move with the typing. And '
      + 'references are now allocated by the register rather than counted by the application, '
      + 'so two officers issuing in the same second are not handed the same one.',
    // THE HISTORY IS THE MARKER, because it is the thing whose absence means
    // the register cannot say what happened — not a column on `correspondence`,
    // which 045 already created.
    table: 'correspondence_events',
  },
  {
    file: '047_the_money_the_actors_and_the_two_axes.sql',
    what: 'The University’s appointments are priced in dollars from here on, and an '
      + 'appointment can carry allowances — housing, transport, responsibility — each '
      + 'with its own amount and period, none assumed. The record also names five people '
      + 'instead of three: who reviewed it and who issued it were previously guessed at. And '
      + 'it closes a door: nothing reaches `issued` without both an approval and an archived '
      + 'letter behind it.',
    // THE ALLOWANCES ARE THE MARKER. `reviewed_by` is a column on a table 041
    // already created; this is a table that did not exist before.
    table: 'appointment_allowances',
  },
  {
    file: '048_the_job_descriptions_and_what_they_inherit.sql',
    what: 'A register of the University’s forty-six posts, and a job description for each, '
      + 'inherited from one of eight family profiles so the confidentiality clause is written '
      + 'once rather than forty-six times. EVERYTHING IT SEEDS IS A DRAFT: the wording is a '
      + 'first draft for the University to read, nobody may activate what they wrote, and an '
      + 'unapproved job description cannot be attached to an appointment.',
    table: 'positions',
  },
  {
    file: '049_verification_signatures_and_the_written_letter.sql',
    what: 'A stranger holding a letter from the Vice-Chancellor can now check it — 045 built '
      + 'the register and gave it nothing to answer with. The public view names no recipient '
      + 'and no subject, because a warning letter is correspondence. A reproduced signature '
      + 'becomes an explicit controlled feature: off until somebody other than its owner '
      + 'switches it on with a stated authority, and every letter records how it was signed. '
      + 'And the Vice-Chancellor can write a letter rather than type one.',
    // The signature store is the marker: the verification view could be
    // confused with 042's, and `body_format` is a column on a table 045 made.
    table: 'signature_specimens',
  },
  {
    file: '050_acceptance_the_activation_rule_and_the_full_audit.sql',
    what: 'Acceptance stops being a timestamp. An acceptance now names WHO answered and WHICH '
      + 'VERSION of which letter they were answering — the fact a dispute turns on when an '
      + 'amended letter follows. A superseded letter can no longer be accepted. WHEN SOMEBODY '
      + 'BECOMES STAFF is now a setting the University controls rather than an assumption in '
      + 'the code, seeded to “accepted”. And the audit trail can record all fifteen '
      + 'actions the University listed; six of them had no event to be recorded as.',
    table: 'appointment_acceptances',
  },
  {
    file: '051_templates_for_every_document_the_university_issues.sql',
    what: 'Official correspondence gets versioned templates, and every issued letter records '
      + 'which version produced it — 044 built that rule for eleven HR documents and the '
      + 'Vice-Chancellor’s letters had none. The other three documents of an appointment '
      + 'package (job description, conditions of service, acceptance form) become templates '
      + 'too. And an appointment now records WHICH VERSION of the conditions of service '
      + 'applies to it: "in force from time to time" is true and unusable to somebody in a '
      + 'dispute.',
    // The view is the marker: document_templates is 044's and the new columns
    // sit on tables that already existed.
    table: 'document_template_coverage',
  },
  {
    file: '052_a_first_draft_of_every_document.sql',
    what: 'A first draft of all thirty-one documents the University issues — every '
      + 'appointment document, the conditions of service, the acceptance form, and a frame for '
      + 'each kind of official letter. NOTHING IS ACTIVE: each is a version 1 in draft, written '
      + 'to be read and edited in Document Templates, and none produces a document until '
      + 'somebody at the University activates it.',
    // NOT A TABLE — 051 made them all. The marker is that a specific seeded
    // row exists, which no probe shape can express, so this is stated rather
    // than claimed.
    cannotSee: "select count(*) as drafts from document_templates where status = 'draft';"
      + '  -- it should be 31 on a database where nobody has activated any yet',
  },
  {
    file: '053_where_an_office_stands.sql',
    what: 'Where each office stands, so the appointment letter can say different things to '
      + 'different posts. A Dean, a Lecturer, the Registrar and the Director of Academic '
      + 'Affairs stop receiving the same generic executive letter. Also records the '
      + 'University’s ruling that the Director of Academic Affairs ranks immediately below the '
      + 'Vice-Chancellor — on that post alone, so no other letter can claim it.',
    // THE COLUMN IS THE MARKER. `positions` is 048's, and the three columns
    // this file adds sit on it; `standing` is the one no earlier migration
    // created.
    table: 'positions',
    column: 'standing',
  },
  {
    file: '054_course_registration.sql',
    what: 'Course registration. A student can be put on a course at all — the act nothing in '
      + 'this system could perform, though the results pipeline, the GPA engine and the '
      + 'graduation audit have all read `enrollments` since migration 001. A registration now '
      + 'records who made it and whether the student did it themselves; a drop is a state with '
      + 'a date and a reason rather than a deletion; and `course_roll` is the live roll, so a '
      + 'student who dropped a course does not appear on its mark sheet.',
    // THE VIEW IS THE MARKER. `enrollments` is 001's, and the columns this
    // file adds sit on it — but `course_roll` is a relation no earlier
    // migration created, which is the cheaper and less error-prone probe.
    table: 'course_roll',
  },
  {
    file: '055_the_office_that_needs_no_second_signature.sql',
    what: 'The Vice-Chancellor, the Chancellor and a system account may draft an appointment and '
      + 'approve it themselves. Everybody else is still refused — and a self-approval that is '
      + 'not marked as made on sole authority is refused for everybody, so no appointment can be '
      + 'made by one person quietly. The mark cannot be removed once set.',
    // NOT A TABLE AND NOT A COLUMN — 045 added the column, 055 changes what the
    // constraints permit and adds the trigger that makes the mark permanent.
    cannotSee: "select pg_get_constraintdef(oid) from pg_constraint "
      + "where conname = 'appointments_second_pair_of_eyes';"
      + '  -- it should end with "OR made_on_sole_authority"',
  },
  {
    file: '056_what_an_office_may_not_even_see.sql',
    what: 'The blank certificate and the blank transcript stop being readable by everybody — '
      + 'until this runs, every student, applicant and unsigned-in visitor can read the '
      + 'designs. The appointment register gets three bands: your own, the files on your desk, '
      + 'and the whole register for the Registrar, the Vice-Chancellor and the Chancellor. An '
      + 'executive post can only be filled by the appointing authority. Six offices the '
      + 'application already has — HR Officer, HR Administrator, Examination Officer, Examiner, '
      + 'Moderator, Invigilator — become assignable for the first time. And the '
      + 'Superadministrator gets capability grants: a named person holds a named capability '
      + 'until a stated date, for a stated reason, in a row that cannot be rewritten.',
    // A TABLE THIS TIME. The read policies it rewrites cannot be probed through
    // PostgREST — a restricted row comes back as an empty list, not an error,
    // which is indistinguishable from a table that happens to be empty.
    // `capability_grants` is new in this migration and nothing earlier creates
    // it, so it is the honest marker.
    table: 'capability_grants',
  },
  {
    file: '057_the_academic_structure.sql',
    what: 'The University\u2019s academic structure becomes data: schools, departments, '
      + 'programmes, the VERSION of a programme somebody was admitted under, and the curriculum '
      + 'that version carries \u2014 instead of TypeScript constants compiled into the website. '
      + 'Nothing is seeded; the tables arrive empty because which of the forty-one programmes '
      + 'are current, and on what version, is a decision rather than a default. '
      + 'AND NO CURRICULUM CAN BE APPROVED until the University records which offices must sign '
      + 'one \u2014 academic_approval_requirements arrives empty on purpose, and the refusal '
      + 'says how to fill it.',
    table: 'programme_versions',
  },
  {
    file: '058_the_vice_chancellor_approves_a_curriculum.sql',
    what: 'Curriculum approval becomes possible at all. Since 057 no curriculum could be '
      + 'approved by anybody \u2014 including the Superadministrator \u2014 because the '
      + 'University had not said who approves one. It has now: the Vice-Chancellor. A version '
      + 'still moves through department and faculty review; this is the signature that gates '
      + 'approval, and no other office stands in for it.',
    // A SEEDED ROW, not a table or a column. 057 created the table this fills,
    // so its presence would report 058 as run on a database that has only had
    // 057 \u2014 and the whole point of 058 is that the row is there.
    cannotSee: "select subject, office from academic_approval_requirements "
      + "where subject = 'curriculum';  -- it should list vice-chancellor",
  },
  {
    file: '059_the_academic_calendar.sql',
    what: 'The academic calendar, on the western system the University ruled: Semester 1 opens '
      + '15 August, Semester 2 opens 2 January, so the academic year runs 15 August to 14 August '
      + 'and is written 2026/2027. FIXES A LIVE DEFECT: registration took its year from '
      + 'new Date().getFullYear(), and Semester 1 straddles New Year \u2014 so one cohort in one '
      + 'term split across two academic years and had its GPA computed twice, over half its '
      + 'courses each time. The windows INSIDE a term (registration, teaching, examinations, '
      + 'results) arrive empty: the University has stated when its semesters open, not when '
      + 'registration does.',
    table: 'academic_terms',
  },
  {
    file: '060_the_schools_and_programmes.sql',
    what: 'The register stops being empty: the University\u2019s five schools and forty-one '
      + 'programmes become rows, moved out of the TypeScript the website compiles them from. '
      + 'EVERY PROGRAMME ARRIVES AS A DRAFT \u2014 nothing is opened for admission, because 023 '
      + 'ruled that admission is opt-in. No curriculum and no duration is seeded: the University '
      + 'has ruled the length of fourteen of them and published a RANGE for the other '
      + 'twenty-seven, and "One to two academic years" is not a duration.',
    // A SEEDED SET OF ROWS. 057 created the table, so its presence would report
    // 060 as run on a database that has only had 057.
    cannotSee: 'select count(*) from programmes;  -- it should be at least 41, every one a draft',
  },
  {
    file: '061_a_version_for_every_programme.sql',
    what: 'Every one of the 41 programmes gets a curriculum version to hang a curriculum from. '
      + '060 could not: 27 were published as "One to two academic years", and a range is not a '
      + 'length. The University has since ruled every level \u2014 Certificate one, Diploma one, '
      + 'Bachelor\u2019s three, Master\u2019s two, Doctorate two. EVERY VERSION IS A DRAFT with '
      + 'no courses in it: a version becomes real when the Vice-Chancellor approves it. This '
      + 'builds the shelf; the University fills it.',
    cannotSee: 'select count(*) from programme_versions;  -- it should be at least 41, '
      + 'every one a draft',
  },
  {
    file: '062_the_curricula_already_written.sql',
    what: 'The three curricula the University has already written move into rows, course by '
      + 'course, in the year and semester it placed them: Bachelor of Theology 36 courses / 180 '
      + 'credits, Bachelor of Ministry 34 / 180, Diploma in Theology 15 / 120. Each adds up to '
      + 'exactly what its programme claims, and every term of every one has courses in it. The '
      + 'Diploma\u2019s courses carried no credit value, so it is DERIVED from the ruled total '
      + '\u2014 120 over 15 courses is 8 exactly. All three are drafts until the '
      + 'Vice-Chancellor approves them.',
    // The view is the marker: it is what 062 creates that nothing before it did.
    table: 'curriculum_progress',
  },
  {
    file: '063_the_offering_and_the_class.sql',
    what: 'The two links missing from the middle of the academic chain: a COURSE OFFERING (a '
      + 'course as actually offered — this year, this semester, this lecturer, this many places) '
      + 'and a CLASS (a group, a room and an hour). Their absence is why four screens were '
      + 'unsatisfactory at once: registration had nothing to register against, the timetable had '
      + 'no room to clash, the LMS had no class a student belongs to, and an examination had no '
      + 'candidate list. Room, lecturer and student-cohort conflicts are now one query. Nothing '
      + 'is seeded \u2014 the University has not said where it teaches, and an invented room '
      + 'number is what a student walks to.',
    table: 'course_offerings',
  },
  {
    file: '064_the_rooms_to_start_from.sql',
    what: 'Seventeen rooms \u2014 nine at Buea, five at Douala, three online \u2014 every one '
      + 'marked PROVISIONAL, because the University asked for room numbers to be given and then '
      + 'edited. The codes are made up; the campuses are not. None claims a capacity, because a '
      + 'wrong one puts students in a corridor. Editing a room clears the placeholder label, so '
      + 'nobody has to remember to confirm it. Until this ran, no class could be placed anywhere '
      + 'and a room double-booking could not be detected, because no class was in a room.',
    // The column is the marker: `provisional` is what 064 adds and 063 did not.
    table: 'rooms',
    column: 'provisional',
  },
  {
    file: '065_the_year_that_cannot_lie.sql',
    what: 'A fault that had not gone off yet. 059 set every academic year\u2019s status ONCE, '
      + 'with current_date, on the day it ran \u2014 under a comment saying the date decides it. '
      + 'It decided it once. On 15 August 2027 the column would still have said 2026/2027, and '
      + 'Course Offerings, the Timetable and the Academic Overview all opened on it: three '
      + 'screens, wrong year, in silence. `academic_year_now` derives it from the dates every '
      + 'time it is asked; `academic_year_drift` reports where the stored record disagrees; and '
      + 'the Academic Calendar screen can put them back in step.',
    table: 'academic_year_now',
  },
];

/** What a probe came back as. */
export type ProbeState = 'applied' | 'outstanding' | 'unverifiable' | 'unknown';

/**
 * Read a failed query and say whether it means the migration has not been run.
 *
 * POSTGRES SAYS SO PRECISELY: 42P01 is an undefined table, 42703 an undefined
 * column. Anything else — a policy that refuses the read, a dropped connection
 * — is NOT evidence the migration is missing, and saying it is would send
 * somebody to run SQL that is already applied.
 */
export function stateFromError(
  error: { code?: string; message?: string } | null | undefined,
): ProbeState {
  if (!error) return 'applied';
  const code = error.code ?? '';
  if (code === '42P01' || code === '42703') return 'outstanding';
  // PostgREST reports a missing column on a select as a schema-cache miss
  // (PGRST204) or in the message text, depending on version.
  if (code === 'PGRST204' || code === 'PGRST205') return 'outstanding';
  if (/does not exist|could not find/i.test(error.message ?? '')) return 'outstanding';
  return 'unknown';
}
