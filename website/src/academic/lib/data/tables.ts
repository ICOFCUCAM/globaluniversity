// ---------------------------------------------------------------------------
// WHERE EACH THING ACTUALLY LIVES IN THE UNIVERSITY'S DATABASE.
//
// This file is the seam. The adapter never writes a table name; it asks here,
// so repointing the platform at a different host is one edit in one file and
// `schemaAgreement.test.mjs` can check every name against a real schema.
//
// ---------------------------------------------------------------------------
// WHY THE NAMES ARE NOT `ls_*` ANY MORE
// ---------------------------------------------------------------------------
//
// `docs/integration/001_lecture_studio.sql` creates twenty-two tables, all
// prefixed, because it was written to mount inside ANY university and assume
// nothing about the host.
//
// This University asked for the platform to be integrated, not parked beside
// its own system, and already had nine of the twenty-two — two of them exactly.
// `website/docs/LECTURE-STUDIO-INTEGRATION.md` is the reconciliation and the
// argument; migrations 092, 093 and 094 are what it became.
//
// ---------------------------------------------------------------------------
// TWO KINDS OF ENTRY, AND THE DIFFERENCE MATTERS
// ---------------------------------------------------------------------------
//
// A RENAME is safe: the table is this platform's own, created by 092–094 with
// the same columns it always had, under a name that fits the University's
// schema. Reading it works the moment the name changes.
//
// A MERGE is not. The University already had a table for that idea, with its
// own columns, its own policies and its own screens. `ls_submissions.mark` is
// `activity_submissions.score`; `ls_readings.citation` is seven columns on
// `course_lessons`. Pointing the old code at the new name would compile, run,
// and read nothing — or worse, write a row nobody can find.
//
// So a merge is NOT listed here. It is listed in `MERGED_NOT_YET_MAPPED`
// below, and the adapter REFUSES rather than guessing. A refusal that names
// the work left is worth more than a silent empty list.
// ---------------------------------------------------------------------------

/** The platform's own tables, created by 092–094 under the University's names. */
export const TABLES = {
  // ---- 092: the lecture and what is made from it --------------------------
  lectures:          'lectures',
  artefacts:         'lecture_artefacts',
  artefactVersions:  'artefact_versions',
  lectureKnowledge:  'lecture_knowledge',

  // ---- 093: study material, the queue, the bill, the inbox ---------------
  studyAids:         'study_aids',
  quizAttempts:      'study_aid_attempts',
  recalls:           'study_recalls',
  jobs:              'processing_jobs',
  runCosts:          'ai_run_costs',
  usage:             'ai_usage',
  notifications:     'notifications',

  // ---- 094: live translated delivery --------------------------------------
  liveSessions:      'live_sessions',
  liveSegments:      'live_segments',
  liveCarried:       'live_carried',

  // ---- 096: the course library --------------------------------------------
  //
  // THIS ONE MOVED CAMP. The reconciliation put `ls_readings` in the merge
  // list, to fold into `course_lessons` where kind = 'reading' — which was
  // right at the time, because 084's lesson already carried author, publisher,
  // ISBN and DOI.
  //
  // The University then ruled, on 16 September 2026, that an e-book is a
  // first-class course resource with a cover, a licence, and READING and
  // DOWNLOADING as separate rights. None of that fits a lesson, and a lesson
  // that grew a licence column would be two ideas in one table. So 096 gives
  // it its own, and `readings` comes off the not-yet-mapped list because it is
  // now mapped.
  resources:         'course_resources',
  library:           'my_course_library',

  // ---- The University's, read as they are ---------------------------------
  schools:           'schools',
  departments:       'departments',
  courses:           'courses',
  courseOfferings:   'course_offerings',
  courseRoll:        'course_roll',
  lecturers:         'lecturers',
  students:          'students',
  profiles:          'profiles',
  settings:          'institutional_settings',

  // 086 created these. This platform's Course AI writes them, and
  // `tutor_messages.refused_reason` already carries the refusal it produces —
  // the one seam that needed no work at all.
  tutorConversations: 'tutor_conversations',
  tutorMessages:      'tutor_messages',
} as const;

export type TableKey = keyof typeof TABLES;

/**
 * THE WORK THAT IS NOT DONE, NAMED.
 *
 * Each of these is an idea the University already had a table for, and the
 * mapping is a column-by-column rewrite rather than a new name. Until that is
 * written, the adapter throws `notYetMapped()` — which fails loudly in a
 * screen, in a test and in a log, instead of returning an empty list that
 * looks like "this course has no reading list".
 *
 * A half-finished integration is not the fault. Pretending it is finished is.
 */
export const MERGED_NOT_YET_MAPPED = {
  progress:     { into: 'lesson_progress',      was: 'ls_progress' },
  assignments:  { into: 'course_activities',    was: 'ls_assignments' },
  submissions:  { into: 'activity_submissions', was: 'ls_submissions' },
  audit:        { into: 'audit_logs',           was: 'ls_audit' },
  certificates: { into: 'documents',            was: 'ls_certificates' },
} as const;

export type MergedKey = keyof typeof MERGED_NOT_YET_MAPPED;

export function notYetMapped(what: MergedKey): never {
  const { into, was } = MERGED_NOT_YET_MAPPED[what];
  throw new Error(
    `${what} is not wired to the University's database yet. The Lecture Studio kept this in `
    + `\`${was}\`; the University already has \`${into}\`, with different columns, so this needs `
    + 'a column-by-column mapping rather than a new table name. See '
    + 'website/docs/LECTURE-STUDIO-INTEGRATION.md. Refusing rather than reading the wrong '
    + 'columns and reporting an empty result.',
  );
}
