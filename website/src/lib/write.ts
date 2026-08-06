'use client';

// ---------------------------------------------------------------------------
// Report failed writes instead of discarding them.
//
// Fifteen places in this portal performed an insert, update or delete and never
// looked at the result. The pattern was always the same:
//
//     await supabase.from('documents').insert({ … });
//     setShowModal(false);
//     load();
//
// When the write failed — a policy refusal, a missing column, a lost
// connection — the modal still closed, the list still refreshed, and the user
// watched their work not appear. Most read that as the interface being slow and
// did it again.
//
// It is the same fault that hid two much larger ones: results could never be
// saved at all because the table had no unique index for the upsert's conflict
// target, and every audit write from result entry was failing on a type
// mismatch. Both were invisible for exactly this reason.
//
// This is deliberately tiny. A write either reports or it does not, and making
// that one line long is the only way it gets used consistently.
// ---------------------------------------------------------------------------

import { toast } from 'sonner';

interface WriteResult {
  error: { message: string } | null;
}

/**
 * Await a Supabase write and surface any failure.
 *
 * `what` completes the sentence "Could not …", so pass a verb phrase:
 * "publish the announcement", "remove the timetable entry".
 *
 * Returns true when the write succeeded, so a caller can hold a modal open on
 * failure rather than closing it over the top of the user's unsaved work:
 *
 *     if (!(await write(supabase.from('x').insert(row), 'save the entry'))) return;
 *     setShowModal(false);
 */
export async function write(op: PromiseLike<WriteResult>, what: string): Promise<boolean> {
  const { error } = await op;
  if (!error) return true;
  // The database's own message is included. "Could not save" tells a registrar
  // nothing; "violates row-level security policy" tells whoever they forward it
  // to exactly where to look.
  toast.error(`Could not ${what}`, {
    description: error.message,
    duration: 8000,
  });
  return false;
}

/** The success half, for the same call sites. Keeps the pairing visible. */
export function wrote(what: string) {
  toast.success(what);
}
