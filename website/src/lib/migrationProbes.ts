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
