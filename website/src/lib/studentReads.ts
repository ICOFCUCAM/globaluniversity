// ---------------------------------------------------------------------------
// READING THE STUDENT'S OWN ROWS.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS RATHER THAN THE SAME TWELVE LINES IN EIGHT SCREENS
// ---------------------------------------------------------------------------
//
// Every student screen does exactly the same thing: select from a view that
// filters on auth.uid(), put a deadline on it, and end up in one of three
// states — rows, no rows, or could not read. The twelve lines that do that had
// already been copied four times when this file was written, and the copies
// had begun to differ: two of them dropped the error and reported a failed read
// as an empty database.
//
// That is not a hypothetical. It is the fault this portal shipped on the
// calendar screen ("Today falls in no academic year the calendar covers") and
// on registration, and it is worth having one place where it cannot happen.
//
// ---------------------------------------------------------------------------
// THE THREE STATES ARE KEPT APART, ALWAYS
// ---------------------------------------------------------------------------
//
//   rows.length > 0            there is something to show
//   rows.length === 0, no fail the University genuinely has nothing for them
//   failed !== null            nobody knows, and the screen must say so
//
// A screen that collapses the last two tells a student they have no results
// when the truth is that their train went into a tunnel.
// ---------------------------------------------------------------------------

import { supabase } from './supabase';

/**
 * A deadline on a read.
 *
 * WHY EVERY READ NEEDS ONE. supabase-js does not time out. A request that
 * never answers leaves the screen on its loading skeleton for ever, which is
 * the single most common way this portal has failed — the student sees an
 * animation and concludes the University has lost their record.
 *
 * Fifteen seconds because a slow connection on a phone in Buea is a real thing
 * and five was cutting off reads that would have succeeded.
 */
export async function within<T>(work: PromiseLike<T>, seconds = 15): Promise<T> {
  return Promise.race([
    work as Promise<T>,
    new Promise<T>((_, reject) => {
      setTimeout(
        () => reject(new Error(`The database did not answer within ${seconds} seconds`)),
        seconds * 1000,
      );
    }),
  ]);
}

export interface MineResult<T> {
  rows: T[];
  /** Null when the read succeeded — INCLUDING when it returned nothing. */
  failed: string | null;
}

/**
 * Every row of a view that is the signed-in student's own.
 *
 * `columns` MUST BE A SINGLE STRING LITERAL at the call site. supabase-js
 * infers the row type from it, and a concatenated string collapses that to
 * `any` — which is how a column renamed in a migration stops being a compile
 * error and becomes an empty cell on a student's screen.
 */
export async function readMine<T>(
  view: string,
  columns: string,
  order?: { column: string; ascending?: boolean },
): Promise<MineResult<T>> {
  try {
    let q = supabase.from(view).select(columns);
    if (order) q = q.order(order.column, { ascending: order.ascending ?? true });
    const { data, error } = await within(q);
    if (error) return { rows: [], failed: explain(view, error.message) };
    return { rows: (data ?? []) as unknown as T[], failed: null };
  } catch (e) {
    return {
      rows: [],
      failed: e instanceof Error ? e.message : 'This could not be read.',
    };
  }
}

/** The same, where there is at most one row. */
export async function readMineOne<T>(
  view: string,
  columns: string,
): Promise<{ row: T | null; failed: string | null }> {
  try {
    const { data, error } = await within(
      supabase.from(view).select(columns).maybeSingle(),
    );
    if (error) return { row: null, failed: explain(view, error.message) };
    return { row: (data ?? null) as unknown as T | null, failed: null };
  } catch (e) {
    return {
      row: null,
      failed: e instanceof Error ? e.message : 'This could not be read.',
    };
  }
}

/**
 * Turn a Postgres error into something a person can act on.
 *
 * THE ONE WORTH NAMING is the missing view. Until the migration has been run
 * every read here fails, and "relation my_documents does not exist" tells a
 * student nothing at all — while naming the file tells whoever they ask
 * exactly what to do.
 */
function explain(view: string, message: string): string {
  if (new RegExp(view).test(message) && /does not exist|schema cache|could not find/i.test(message)) {
    return `This part of the portal needs a migration that has not been run yet (${view}).`;
  }
  return message;
}
