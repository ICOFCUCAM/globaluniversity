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
import type { TranscriptKind } from '@/lib/transcriptTypes';

/** One credit accepted from another institution, and where it came from. */
export interface TransferCredit {
  institution: string;
  courseCode?: string | null;
  courseTitle: string;
  credits: number;
  creditsAccepted: number;
  accepted: boolean;
}

/** An honour the University has recorded. Never computed — see migration 019. */
export interface Honour {
  kind: string;
  title: string;
  academicYear?: string | null;
  awardedOn?: string | null;
}

/** The conferral, which is an act of the Senate and carries its date. */
export interface Conferral {
  award: string;
  senateApprovedOn?: string | null;
  conferredOn: string;
  convocationOn?: string | null;
  classification?: string | null;
  graduationNumber?: string | null;
  certificateCredentialId?: string | null;
}

/** A change of academic standing. Printed on the internal record only. */
export interface StandingEvent {
  from?: string | null;
  to: string;
  reason: string;
  decidedAt: string;
}

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

  /* --- Which document this is ------------------------------------------ */

  /** Official, unofficial, interim, graduation, internal, or for evaluation. */
  transcriptKind?: TranscriptKind;

  /* --- Identity, from the student's master record ----------------------- */

  /** The teaching location. A university with more than one must say which. */
  campus?: string | null;
  nationality?: string | null;
  /** on-campus | online | distance | blended */
  modeOfStudy?: string | null;
  admittedOn?: string | null;
  completedOn?: string | null;

  /* --- The award, which is three things and not one --------------------- */

  /** "Bachelor of Theology" — the instrument. */
  award?: string | null;
  /** "Theology" — the field of study. */
  programme?: string | null;
  /** "Christian Leadership", where the programme has one. */
  specialization?: string | null;
  faculty?: string | null;
  /** "2024–2027", derived from admission and completion. */
  academicPeriod?: string | null;

  /* --- The summary a reader outside the University relies on ------------ */

  /** good-standing | warning | probation | … Empty when nobody has assessed. */
  academicStanding?: string | null;
  /** "In progress" | "Completed" | "Withdrawn". */
  degreeStatus?: string | null;
  /**
   * Credits accepted from elsewhere, and where from.
   *
   * KEPT SEPARATE FROM THE SEMESTER RECORD, because a transfer credit was not
   * taught or examined by this University and folding it into a semester
   * table would have the University reporting a mark it never awarded.
   */
  transferCredits?: TransferCredit[];
  honours?: Honour[];
  conferral?: Conferral | null;
  standingHistory?: StandingEvent[];
  /** Registry working notes. Printed on the internal record only. */
  internalNotes?: string | null;
  /**
   * What the University's rule on repeated courses is, in words, or null when
   * it has not ruled.
   *
   * PRINTED WHEN A REPEAT IS ON THE RECORD. A transcript showing the same
   * course twice with two grades, and not saying which counts, is a document
   * the reader has to guess at — and the two readings differ by a class of
   * award.
   */
  repeatRule?: string | null;

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

    // --- Everything the sealed snapshot carries beyond the marks ----------
    //
    // ALL OF IT FROM `facts`, for the same reason the marks are. A transcript
    // reissued in 2031 must show the campus the student studied at and the
    // standing they held when it was issued, not what the student record says
    // by then — people transfer campus and standing changes.
    transcriptKind: (s(facts.transcript_kind) || 'official') as TranscriptKind,
    campus: s(facts.campus) || null,
    nationality: s(facts.nationality) || null,
    modeOfStudy: s(facts.mode_of_study) || null,
    admittedOn: s(facts.admitted_on) ? formatIssued(s(facts.admitted_on)) : null,
    completedOn: s(facts.completed_on) ? formatIssued(s(facts.completed_on)) : null,

    award: s(facts.award_title) || s(row.award) || null,
    programme: programme || null,
    specialization: s(facts.specialization) || null,
    faculty: s(facts.faculty) || null,
    academicPeriod: s(facts.academic_period)
      || academicPeriod(s(facts.admitted_on), s(facts.completed_on)),

    academicStanding: standingLabel(s(facts.academic_standing)),
    degreeStatus: s(facts.degree_status) || null,
    transferCredits: Array.isArray(facts.transfer_credits)
      ? (facts.transfer_credits as TransferCredit[]) : [],
    honours: Array.isArray(facts.honours) ? (facts.honours as Honour[]) : [],
    conferral: (facts.conferral as Conferral | undefined) ?? null,
    standingHistory: Array.isArray(facts.standing_history)
      ? (facts.standing_history as StandingEvent[]) : [],
    internalNotes: s(facts.internal_notes) || null,
    repeatRule: repeatRuleWording(s(facts.repeat_rule)),
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
 * How many blocks fit on a sheet, and what each block costs.
 *
 * ---------------------------------------------------------------------------
 * MEASURED, NOT ASSUMED — AND THE OLD NUMBER WAS ASSUMED
 * ---------------------------------------------------------------------------
 *
 * The rule used to be "two years to a sheet", which made a three-year bachelor's
 * degree print on THREE sheets and head itself "Page 1 of 3". The University's
 * own transcript of the same degree is TWO: Year One and Year Two on the first
 * sheet, Year Three with the totals and the signatures on the second.
 *
 * The blocks were then measured on the rendered sheet, at A4 landscape:
 *
 *   the sheet, less its margins and running head      ~190mm
 *   masthead, programme band and grade legend          ~59mm   (first sheet only)
 *   one year's table                                ~51–59mm
 *   the closing block, carrying transfer credits,
 *     honours and the conferral                      ~111mm
 *   the closing block bare — totals and signatures    ~65mm
 *
 * So a sheet holds THREE year-tables' worth of room; the opening matter costs
 * one of them on the first sheet; and the full closing block costs two. Which
 * gives the University's own layout without being told it: 1 + 1 + 1 on the
 * first sheet, then Year Three and the close on the second.
 *
 * The old rule was not wrong by a rounding error — it was a guess with no
 * measurement behind it, and it cost every graduate a third sheet carrying a
 * quarter of a page of text.
 */
const SHEET_CAPACITY = 3;

/**
 * What the masthead, the programme band and the grade legend cost, on the first
 * sheet only. Later sheets carry the running head and nothing else, which is
 * why they hold a year more.
 */
const OPENING_COST = 1;

/**
 * Kept for the preview wrappers, which size their box from the sheet count.
 *
 * EXPORTED SO THERE IS ONE RULE. A second implementation in a screen is how a
 * preview ends up disagreeing with the document it is previewing.
 */
export const SLOTS_PER_SHEET = SHEET_CAPACITY;

/**
 * How many slots the closing block needs for THIS record.
 *
 * ONE FOR A BARE CLOSE — the totals, the offices and the signature line. TWO
 * once it also carries transfer credits, honours or a conferral, because those
 * are three further ruled blocks.
 *
 * IT LIVES HERE RATHER THAN IN THE COMPONENT, and that is the fix for a fault
 * nobody could see: the document computed this and paginated with it, while the
 * preview box and every test called paginate() with the default of one. They
 * were measuring a pagination the document never used, which is why a
 * three-sheet bachelor's degree passed a test asserting two.
 */
export function closingSlotsFor(data: {
  transferCredits?: readonly unknown[] | null;
  honours?: readonly unknown[] | null;
  conferral?: unknown;
  standingHistory?: readonly unknown[] | null;
}): number {
  const heavy = (data.transferCredits?.length ?? 0) > 0
    || (data.honours?.length ?? 0) > 0
    || Boolean(data.conferral)
    || (data.standingHistory?.length ?? 0) > 0;
  return heavy ? 2 : 1;
}

export function paginate(
  years: readonly TranscriptYear[],
  closingSlots: number = 1,
): Sheet[] {
  const closing = Math.min(SHEET_CAPACITY, Math.max(1, Math.floor(closingSlots)));

  const sheets: Sheet[] = [];
  let current: TranscriptYear[] = [];
  // The first sheet starts with the opening matter already on it.
  let used = OPENING_COST;

  for (const year of years) {
    if (used + 1 > SHEET_CAPACITY) {
      sheets.push({ years: current, closing: false });
      current = [];
      used = 0;
    }
    current.push(year);
    used += 1;
  }

  // THE CLOSE GOES ON THE LAST SHEET IF IT FITS, and starts a new one if it
  // does not — never straddling the fold, which is what put the totals over the
  // final Semester GPA row before any of this was measured.
  if (used + closing > SHEET_CAPACITY) {
    sheets.push({ years: current, closing: false });
    current = [];
  }
  sheets.push({ years: current, closing: true });

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


/* ------------------------------------------------------------------ */
/* WORDS FOR THE THINGS THE DATABASE HOLDS AS CODES                    */
/* ------------------------------------------------------------------ */

/**
 * "2024–2027" from two dates.
 *
 * OPEN-ENDED WHILE THE PROGRAMME RUNS. "2024–" is honest about a student still
 * studying; "2024–2027" on an interim transcript would state a completion that
 * has not happened, and an expected date is not a fact about the record.
 */
export function academicPeriod(admitted: string, completed: string): string | null {
  const from = admitted.slice(0, 4);
  if (!/^\d{4}$/.test(from)) return null;
  const to = completed.slice(0, 4);
  return /^\d{4}$/.test(to) ? `${from}–${to}` : `${from}–`;
}

/**
 * Academic standing in the words a reader outside the University understands.
 *
 * AN UNRECORDED STANDING PRINTS NOTHING. Not "Unknown", not "—", and above all
 * not "Good Standing": a transcript saying the University has looked at a
 * record and found it sound is a favourable statement, and making it by
 * default is making it about students nobody has assessed.
 */
export function standingLabel(code: string): string | null {
  switch (code) {
    case 'good-standing': return 'Good Standing';
    case 'warning':       return 'Academic Warning';
    case 'probation':     return 'Academic Probation';
    case 'suspended':     return 'Suspended';
    case 'graduated':     return 'Graduated';
    case 'withdrawn':     return 'Withdrawn';
    case 'dismissed':     return 'Dismissed';
    default:              return null;
  }
}

/**
 * What the University's repeat rule means, in a sentence a stranger can act on.
 *
 * NULL WHEN THERE IS NO RULE, and the document then says so in its own words
 * rather than implying one. Migration 019 leaves `repeat_rule` unset on
 * purpose: defaulting to "the latest attempt replaces the earlier one" would
 * quietly raise the GPA of every student who has ever failed anything, under a
 * rule nobody made.
 */
export function repeatRuleWording(rule: string): string | null {
  switch (rule) {
    case 'all-attempts-count':
      return 'Where a course was repeated, every attempt is shown and every attempt counts '
        + 'toward the cumulative grade point average.';
    case 'latest-replaces':
      return 'Where a course was repeated, every attempt is shown; the most recent attempt '
        + 'replaces earlier ones in the cumulative grade point average.';
    case 'best-replaces':
      return 'Where a course was repeated, every attempt is shown; the highest attempt replaces '
        + 'earlier ones in the cumulative grade point average.';
    case 'excluded-from-gpa':
      return 'Where a course was repeated, every attempt is shown; earlier attempts are recorded '
        + 'as academic attempts and are excluded from the cumulative grade point average.';
    default:
      return null;
  }
}

/**
 * Credits accepted from other institutions.
 *
 * ACCEPTED ONLY. A credit offered and refused is on the student's file and is
 * not on their transcript — printing it would suggest the University counted
 * something it declined.
 */
export function transferAccepted(credits: readonly TransferCredit[] | undefined): number {
  return (credits ?? [])
    .filter((c) => c.accepted)
    .reduce((t, c) => t + (Number(c.creditsAccepted) || 0), 0);
}
