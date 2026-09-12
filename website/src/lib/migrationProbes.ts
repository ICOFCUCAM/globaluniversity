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
