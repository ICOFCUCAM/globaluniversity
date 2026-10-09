// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY DELETES, AND HOW LONG IT WAITS.
//
// ---------------------------------------------------------------------------
// WHY A LIST AND NOT A STRING
// ---------------------------------------------------------------------------
//
// `deletion_requests.entity_type` is free text, because one table has to serve
// every kind of record. That makes it a value somebody could send anything in,
// and 108's `erase_what_is_due()` chooses the table it deletes from with an
// `if` chain rather than by interpolating that text into a DELETE — text
// concatenated into a DELETE is how an injected value chooses what the
// University destroys.
//
// This is the same list on the application's side. A kind that is not here is
// refused at the request, so the two halves cannot disagree about what is
// deletable: `deletions.test.mjs` holds them to each other.
// ---------------------------------------------------------------------------

/**
 * How long an approved record waits before it is destroyed.
 *
 * The University's ruling: "if the vc accept delete, it is deleted within 30
 * days. if he says reject, the file is restored." So the thirty days are a
 * grace period in which the decision can still be taken back — not a queue,
 * and not a delay for its own sake.
 */
export const DELETION_GRACE_DAYS = 30;

export interface Deletable {
  /** The table, which must be one `erase_what_is_due()` knows how to erase. */
  table: string;
  /** Read to build the label. One literal: supabase-js types the row from it. */
  columns: string;
  /**
   * What the record was, in words, copied at the moment of asking.
   *
   * THE WHOLE POINT OF THE SCHEME IS THAT THE ROW GOES AWAY. A history that
   * then reads "deleted 3f2a8c91-…" is a history of nothing, so the label is
   * written down while there is still something to read it from.
   */
  label: (row: Record<string, unknown>) => string;
  /** What it is called on a screen. */
  noun: string;
}

export const DELETABLE: Record<string, Deletable> = {
  students: {
    table: 'students',
    columns: 'id, first_name, last_name, student_number, matric_no, email, status',
    noun: 'student record',
    label: (r) => [
      String(r.student_number ?? r.matric_no ?? '').trim(),
      [r.first_name, r.last_name].filter(Boolean).join(' ').trim(),
      r.email ? `<${String(r.email)}>` : '',
    ].filter(Boolean).join(' ') || 'A student record',
  },
  documents: {
    table: 'documents',
    columns: 'id, kind, file_name, student_id, created_at',
    noun: 'document',
    label: (r) => [
      String(r.kind ?? 'document'),
      String(r.file_name ?? '').trim(),
    ].filter(Boolean).join(' · ') || 'An uploaded document',
  },
};
