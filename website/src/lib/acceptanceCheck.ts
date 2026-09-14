// ---------------------------------------------------------------------------
// PROVING THAT SOMEBODY IS THE APPOINTEE, WITHOUT AN ACCOUNT.
//
// ---------------------------------------------------------------------------
// WHY THIS LEFT THE ROUTE
// ---------------------------------------------------------------------------
//
// It was a private function inside `api/appointments/accept/route.ts`, which
// was right while one route needed it. A second now does — the one that hands
// an appointee the PDF of the letter they accepted — and a Next.js route file
// may export only its handlers, so the choice was to lift it out or to write
// the check twice.
//
// WRITING IT TWICE WOULD BE THE WORST OPTION AVAILABLE. This is the check that
// decides whether a stranger with a reference number is the person the letter
// was addressed to. Two copies drift, and the copy that drifts is the one that
// eventually accepts a wrong code.
//
// ---------------------------------------------------------------------------
// WHAT THE CHECK IS
// ---------------------------------------------------------------------------
//
// The reference names the letter; the code is recomputed from the appointment
// and the University's signing secret and must match what was presented. It is
// weaker than a password and stronger than a link — you must hold a document
// the University issued, and knowing somebody's name is not enough.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import { sealAppointment } from './appointmentLetter';
import { UNIVERSITY } from './constants';

export type Db = SupabaseClient;
type Row = Record<string, unknown>;

/**
 * How long an appointee may keep collecting their own copy after accepting.
 *
 * THE UNIVERSITY'S RULING, IN ONE PLACE: "the download link must expire after
 * 3days. after 3 days, only the superadmin can extract that same letter."
 *
 * HERE RATHER THAN IN THE ROUTE because a Next.js route file may export only
 * its handlers — anything else it exports is a build error waiting for the
 * next person who does not know that.
 */
export const APPOINTEE_WINDOW_DAYS = 3;

/** APT-2026-0042. The shape of every appointment letter reference. */
export const ACCEPT_REFERENCE = /^APT-\d{4}-\d{4,}$/;

export type LetterLookup =
  | { error: 'no-such-letter' | 'no-such-appointment' | 'not-issued' | 'wrong-code' }
  | { error: 'superseded'; letter: Row }
  | { letter: Row; appointment: Row };

/**
 * Find the letter a reference names, and check the code against it.
 *
 * THE HTML IS SELECTED TOO, because the appointee's copy of the letter is the
 * archived document and not a re-rendering. Reading one extra column here is
 * cheaper than a second query and keeps "the letter" meaning one thing.
 */
export async function letterFor(
  admin: Db, reference: string, code: string,
): Promise<LetterLookup> {
  const { data: letter } = await admin
    .from('appointment_letters')
    // eslint-disable-next-line max-len
    .select('id, appointment_id, reference, version, issued_on, seal_code, sealed, superseded_at, html')
    .eq('reference', reference)
    .maybeSingle();
  if (!letter) return { error: 'no-such-letter' };

  const l = letter as Row;
  if (l.superseded_at) return { error: 'superseded', letter: l };

  const { data: appointment } = await admin
    .from('appointments')
    // eslint-disable-next-line max-len
    .select('id, full_name, position_title, unit_name, faculty, start_date, issued_at, status, email, appointee_download_until')
    .eq('id', l.appointment_id as string)
    .maybeSingle();
  if (!appointment) return { error: 'no-such-appointment' };

  const a = appointment as Row;
  if (!a.issued_at) return { error: 'not-issued' };

  const presented = code.trim().toUpperCase();
  let expected = String(l.seal_code ?? '');
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${UNIVERSITY.website}`;
    expected = sealAppointment(a, reference, String(l.issued_on), siteUrl).code;
  } catch {
    // The signing secret is not configured. Fall back to the archived code —
    // which is weaker and is why `sealed` is reported back to the caller.
  }

  if (!expected || presented !== expected.toUpperCase()) return { error: 'wrong-code' };
  return { letter: l, appointment: a };
}
