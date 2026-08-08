// ---------------------------------------------------------------------------
// THE TRANSCRIPT AS A DOCUMENT: what goes on the sheet, and where it comes from.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
//
// Until now the University rendered its transcript FOUR TIMES, in four places,
// from four different shapes:
//
//   the Issue screen        — inline JSX, portrait, purple table headers
//   the delivery route      — a hand-written HTML string, portrait, five columns
//   the Studio preview      — TranscriptDocument.tsx, a third layout again
//   TranscriptMaster.tsx    — the one the University actually corrected, twelve
//                             rounds of it, rendered by nothing
//
// So the document a registrar approved in the Studio was not the document the
// Issue screen previewed, and neither was the document a graduate received by
// email. Three of those four were wrong and the fourth was unreachable.
//
// There is now ONE component, `TranscriptMaster`, and this file is the only way
// data reaches it. Every surface calls one of these two functions.
//
// ---------------------------------------------------------------------------
// THE SEALED SNAPSHOT IS THE DOCUMENT — NOT THE LIVE MARKS
// ---------------------------------------------------------------------------
//
// `masterFromCredential` reads `facts` off the register row and nothing else.
// That is the whole point of sealing: a transcript reproduced in 2031 must show
// what the University said when it issued it, not what the database says now.
// Re-deriving from `results` at render time would make every archived transcript
// change silently the moment a mark was corrected — including the copy already
// in a graduate's hand, and including the one a receiving university is holding
// against the seal.
// ---------------------------------------------------------------------------

import type { TranscriptData, TranscriptYear } from '@/lib/types';

/**
 * Everything the master sheet prints beyond the marks themselves.
 *
 * DEFINED HERE RATHER THAN IN THE COMPONENT so that the delivery route can
 * build one without importing a React file, and so the shape has one home.
 */
export interface TranscriptMasterData extends TranscriptData {
  /** The register's number for this document. */
  credentialId?: string | null;
  /** The seal in words, for a reader with no scanner. */
  sealCode?: string | null;
  /** Verification QR, as SVG markup. Rendered by the server that signed it. */
  qrSvg?: string | null;
  version?: number | null;
  issuedOn?: string | null;
  dateOfBirth?: string | null;
  placeOfBirth?: string | null;
  sex?: string | null;
  studentNumber?: string | null;
  /** Credits on PASSED courses. Not the same number as credits attempted. */
  creditsEarned?: number | null;
  /** Set when the record was transcribed from an archive rather than derived. */
  transcribedFrom?: string | null;
  /** Printed beside the award, as the original sets it. */
  studentAddress?: string | null;
  superseded?: boolean;
  /**
   * Where images resolve from.
   *
   * The screen wants '/images/…', relative to the site. An emailed copy is
   * opened from a desktop with no site behind it, so the server passes an
   * absolute origin and the crest still arrives.
   */
  assetBase?: string;
  /**
   * The University's seal, already inlined as a data: URI.
   *
   * Overrides `assetBase` for the crest and the watermark. The delivery route
   * sets it so an emailed transcript keeps its watermark when it is opened on a
   * machine with no network — the one thing an absolute URL cannot survive.
   */
  sealSrc?: string;
}

/* ------------------------------------------------------------------ */
/* A NAME IN THREE COLUMNS                                             */
/* ------------------------------------------------------------------ */

export interface HolderName {
  surname: string;
  firstNames: string;
  middleName: string;
}

/**
 * Split a stored full name back into the three columns the sheet prints.
 *
 * A FALLBACK, NOT THE MECHANISM. From now on the issue routes store the parts
 * separately in `facts`, because "Grace Nalova Meyembi" cannot be split back
 * with certainty — plenty of people carry two surnames, and getting it wrong
 * puts the wrong word under "Surname" on a sealed document.
 *
 * It exists for rows issued before that, where the derived path built the name
 * as first + middle + last: for those the last token IS the surname and this is
 * exactly right. For a manually typed name it is a guess, and it is only ever
 * used when the parts are absent.
 */
export function splitHolderName(full: string): HolderName {
  const parts = String(full ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { surname: '', firstNames: '', middleName: '' };
  if (parts.length === 1) return { surname: parts[0], firstNames: '', middleName: '' };
  if (parts.length === 2) return { surname: parts[1], firstNames: parts[0], middleName: '' };
  return {
    surname: parts[parts.length - 1],
    firstNames: parts[0],
    middleName: parts.slice(1, -1).join(' '),
  };
}

/* ------------------------------------------------------------------ */
/* THE SEALED ROW, TURNED BACK INTO A SHEET                            */
/* ------------------------------------------------------------------ */

/** A `credentials_issued` row, as loosely as the database hands it over. */
export type CredentialRow = Record<string, unknown>;

export interface FromCredentialOptions {
  /** Verification QR for this credential, already rendered by the server. */
  qrSvg?: string | null;
  /** Absolute origin for images, when the document will be read offline. */
  assetBase?: string;
  /** The seal as a data: URI, when the server could read it off disk. */
  sealSrc?: string;
}

const n = (v: unknown, fallback = 0): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
};

const s = (v: unknown): string => (v == null ? '' : String(v));

/**
 * Rebuild the master sheet from a sealed register row.
 *
 * TOTALS ARE READ, NOT RECOMPUTED. `facts.cgpa` and `facts.credits_earned` are
 * inside the content hash; recomputing them here would mean a rounding change
 * in this file could make an archived document disagree with its own seal.
 */
export function masterFromCredential(
  row: CredentialRow,
  opts: FromCredentialOptions = {},
): TranscriptMasterData {
  const facts = (row.facts ?? {}) as Record<string, unknown>;

  const holder = s(row.holder_name ?? facts.name);
  const parts: HolderName = facts.holder_surname || facts.holder_first_names
    ? {
      surname: s(facts.holder_surname),
      firstNames: s(facts.holder_first_names),
      middleName: s(facts.holder_middle_name),
    }
    : splitHolderName(holder);

  const years = (Array.isArray(facts.years) ? facts.years : []) as TranscriptYear[];

  const programme = s(row.programme ?? facts.programme);

  return {
    student: {
      first_name: parts.firstNames,
      middle_name: parts.middleName,
      last_name: parts.surname,
      matric_no: s(row.student_number ?? facts.student_number),
      program: programme,
      // The award line the original prints across the head of the sheet.
      degree_type: programme,
    } as TranscriptData['student'],
    department: { name: programme, faculty: programme } as TranscriptData['department'],
    years,
    totalCredits: n(facts.credits_attempted),
    cgpa: n(facts.cgpa),
    classification: s(row.classification ?? facts.classification),

    credentialId: s(row.credential_id) || null,
    sealCode: s(row.seal_code) || null,
    qrSvg: opts.qrSvg ?? null,
    version: n(row.version, 1),
    issuedOn: formatIssued(s(facts.issued) || s(row.issued_at)),
    dateOfBirth: s(facts.date_of_birth) || null,
    placeOfBirth: s(facts.place_of_birth) || null,
    sex: s(facts.sex) || null,
    studentNumber: s(row.student_number ?? facts.student_number) || null,
    creditsEarned: facts.credits_earned == null ? null : n(facts.credits_earned),
    // PRINTED ON THE FACE, not merely stored. A provenance held only in the
    // database is a safeguard nobody reading the document can see.
    transcribedFrom: facts.source === 'transcribed'
      ? (s(facts.source_record) || 'an unstated source')
      : null,
    studentAddress: s(facts.student_address) || null,
    superseded: row.status === 'replaced',
    assetBase: opts.assetBase,
    sealSrc: opts.sealSrc,
  };
}

/**
 * "2026-08-08" as "8 August 2026".
 *
 * Left alone if it is not a plain date — a value that is already prose, or a
 * date the University typed in its own form for a historical record, must not
 * be reformatted into something it did not say.
 */
export function formatIssued(value: string): string {
  const iso = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return value;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

/* ------------------------------------------------------------------ */
/* HOW MANY SHEETS                                                     */
/* ------------------------------------------------------------------ */

/** One sheet: the years printed on it, and whether it closes the document. */
export interface Sheet {
  years: TranscriptYear[];
  closing: boolean;
}

/**
 * Two years to a sheet, AND THE CLOSING BLOCK COSTS A SLOT.
 *
 * The University's own transcript runs Year One and Year Two on the first sheet
 * and Year Three with the totals and the signatures on the second. Fitting a
 * three-year record onto one page would mean type too small to read under a
 * photocopier, which is how most transcripts are actually received.
 *
 * The totals, the offices and the signature line take roughly the height of one
 * year's table, so they are paginated as if they were a year. Without that the
 * last sheet overflows and the totals print over the final Semester GPA row —
 * which is exactly what happened when the rule was "two years a sheet, closing
 * block wherever it lands".
 *
 *   one year    → 1 sheet   (the year and the closing block)
 *   two years   → 2 sheets  (both years, then the closing block)
 *   three years → 2 sheets  (two years, then the third with the closing)
 *   four years  → 3 sheets, and so on
 *
 * WHICH IS WHY IT STRETCHES TO THE PROGRAMME. A certificate runs one year, a
 * diploma two, a bachelor's three; the sheet count follows the record rather
 * than a fixed assumption about how long a programme is.
 *
 * EXPORTED because the preview wrappers need the sheet count to size their box,
 * and a second implementation of this rule in a screen is how a preview ends up
 * disagreeing with the document.
 */
export const SLOTS_PER_SHEET = 2;

export function paginate(years: readonly TranscriptYear[]): Sheet[] {
  const slots: Array<{ year: TranscriptYear } | { closing: true }> = [
    ...years.map((year) => ({ year })),
    { closing: true as const },
  ];

  const sheets: Sheet[] = [];
  for (let i = 0; i < slots.length; i += SLOTS_PER_SHEET) {
    const chunk = slots.slice(i, i + SLOTS_PER_SHEET);
    sheets.push({
      years: chunk
        .filter((x): x is { year: TranscriptYear } => 'year' in x)
        .map((x) => x.year),
      closing: chunk.some((x) => 'closing' in x),
    });
  }
  return sheets;
}

/* ------------------------------------------------------------------ */
/* HAS THIS STUDENT FINISHED?                                          */
/* ------------------------------------------------------------------ */

export interface ProgressInput {
  creditsEarned: number;
  /** From `awards.credits_required`. Null when no award is on the record. */
  creditsRequired: number | null;
}

export interface Progress {
  /** True only when the credit requirement is known AND met. */
  complete: boolean;
  /** 0–100, clamped. Zero when the requirement is unknown. */
  percent: number;
  /** Credits still to earn. Null when the requirement is unknown. */
  remaining: number | null;
  /** What to say about it, in words a registrar can act on. */
  note: string;
}

/**
 * How far through the programme this student is, by the credit rule.
 *
 * WHAT THIS IS FOR: putting the students who have finished at the top of the
 * Issue screen, so the single button is offered rather than hunted for. The
 * University asked that a transcript be generated "with a single button at the
 * end of a study program where all studies information for that program is
 * completed", and a screen that lists every student alphabetically does not
 * offer that — it hides it.
 *
 * WHAT IT IS EMPHATICALLY NOT: a graduation decision. `assessGraduation` in
 * graduation.ts is that, and it weighs four things this ignores — the CGPA
 * minimum, outstanding admission conditions and the fee balance. A transcript
 * is issued to students who have NOT finished, for visas and transfers, so this
 * gates nothing. It only sorts.
 *
 * AN UNKNOWN REQUIREMENT IS NOT A MET ONE. A student with no award on their
 * record reads as 'not complete' with the reason stated, never as complete,
 * because a missing rule must not silently satisfy itself.
 */
export function programmeProgress({ creditsEarned, creditsRequired }: ProgressInput): Progress {
  const earned = Math.max(0, n(creditsEarned));

  if (!creditsRequired || creditsRequired <= 0) {
    return {
      complete: false,
      percent: 0,
      remaining: null,
      note: earned > 0
        ? `${earned} credits earned. No award is recorded against this student, so there is no `
          + 'credit requirement to measure them against.'
        : 'No award is recorded against this student, so completion cannot be established.',
    };
  }

  const remaining = Math.max(0, creditsRequired - earned);
  const percent = Math.min(100, Math.round((earned / creditsRequired) * 100));

  return {
    complete: remaining === 0,
    percent,
    remaining,
    note: remaining === 0
      ? `Programme complete — ${earned} of ${creditsRequired} credits earned.`
      : `${earned} of ${creditsRequired} credits earned · ${remaining} outstanding.`,
  };
}
