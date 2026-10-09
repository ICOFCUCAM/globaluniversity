// ---------------------------------------------------------------------------
// WHO A PERSON IS, AND WHICH YEAR THEY BELONG TO.
//
// ---------------------------------------------------------------------------
// THE UNIVERSITY'S INSTRUCTION
// ---------------------------------------------------------------------------
//
//   "find persons should be differentiated to lecturers, students, other. it
//    should also be classified by years. all accounts should be separated also
//    likewise."
//
// Two screens list people — Accounts and Studio Control — and both listed them
// as one undifferentiated run of names with a search box over the top. On a
// register of a few dozen that is merely untidy. On one of several hundred it
// is unusable: looking for a lecturer meant reading past every student, and
// there was no way at all to ask "who came in this year".
//
// ---------------------------------------------------------------------------
// WHY THE CLASSIFICATION LIVES HERE AND NOT IN EITHER SCREEN
// ---------------------------------------------------------------------------
//
// Because there are two screens, and the University asked for both to be
// separated the same way. Two copies of "which roles count as staff" is two
// answers waiting to disagree the next time a role is added — and this system
// has already been bitten by exactly that: eight roles existed in the matrix,
// in the navigation and on their own dashboards, and could not be given an
// account at all, because the list of creatable roles was a separate list that
// nothing compared against anything.
//
// `peopleClassification.test.mjs` checks that EVERY role in `roleLabels` lands
// in exactly one kind, so a twenty-sixth role cannot be added without this
// file being told about it.
// ---------------------------------------------------------------------------

import type { UserRole } from './types';

export type PersonKind = 'lecturer' | 'student' | 'other';

/**
 * The three the University named.
 *
 * `other` IS NOT A LEFTOVER BIN, and the label says so: it is the
 * administration — every office that runs the University rather than teaching
 * in it or studying at it. Naming it "Other" on the screen and meaning
 * "nobody we thought about" is how a group nobody maintains comes about.
 */
export const PERSON_KINDS: { kind: PersonKind; label: string; note: string }[] = [
  {
    kind: 'lecturer',
    label: 'Lecturers',
    note: 'The people who teach. A lecturer also needs a teaching record before a course can '
      + 'be allocated to them, which is not the same thing as an account.',
  },
  {
    kind: 'student',
    label: 'Students',
    note: 'Accounts that came out of the admissions pipeline — a paid application and a '
      + 'decision sit behind every one. Applicants are here too, and counted separately, '
      + 'because an applicant is not yet a student.',
  },
  {
    kind: 'other',
    label: 'Administration',
    note: 'Every office that runs the University: the Registry, Finance, Admissions, the '
      + 'faculties, HR, the examination offices, the national tier and the two executive '
      + 'offices.',
  },
];

/**
 * Which of the three a role belongs to.
 *
 * AN APPLICANT IS COUNTED WITH THE STUDENTS AND IS NOT CALLED ONE. The
 * University named three groups, so there are three; but this system draws a
 * hard line between an application and an admitted student — 018 refuses to
 * delete a record once it is admitted precisely because it has stopped being
 * an application — and a count that quietly folded applicants into "students"
 * would be the screen disagreeing with the register. So they share the group
 * and `isApplicant` keeps them apart inside it.
 */
export function personKind(role: string | null | undefined): PersonKind {
  if (role === 'lecturer') return 'lecturer';
  if (role === 'student' || role === 'applicant') return 'student';
  return 'other';
}

export function isApplicant(role: string | null | undefined): boolean {
  return role === 'applicant';
}

export const personKindLabel = (kind: PersonKind): string =>
  PERSON_KINDS.find((k) => k.kind === kind)?.label ?? kind;

// ---------------------------------------------------------------------------
// AND THE YEAR.
//
// "CLASSIFIED BY YEARS" MEANS THE YEAR THEY CAME IN, which is a different
// date for a student and for a member of staff, and the screen has to say
// which or the column is a guess with a number in it:
//
//   admitted       the student's admission year, from the register
//   applied        they applied in that year and have not been admitted
//   appointed      the year a member of staff started, from their staff record
//   account        the year the account itself was opened, and nothing better
//                  is recorded
//
// THE FALLBACK IS ALWAYS AVAILABLE, because `profiles.created_at` is NOT NULL.
// So every person gets a year and nobody is dropped from a list for having an
// incomplete record — which is the failure mode that matters here. A person
// missing from a register is a person nobody can act on.
// ---------------------------------------------------------------------------

export type YearBasis = 'admitted' | 'applied' | 'appointed' | 'account';

export const YEAR_BASIS_LABELS: Record<YearBasis, string> = {
  admitted: 'admitted',
  applied: 'applied',
  appointed: 'appointed',
  account: 'account opened',
};

export interface PersonFacts {
  /** `profiles.role`. */
  role: string | null | undefined;
  /** `profiles.created_at`. The only one of these that is never null. */
  accountOpenedAt: string;
  /** `students.admission_year`, where the register holds one. */
  admissionYear?: number | null;
  /** `students.created_at` — when they applied. */
  appliedAt?: string | null;
  /** `staff_records.started_on`. */
  startedOn?: string | null;
}

export interface PersonYear {
  year: number;
  basis: YearBasis;
}

const yearOfDate = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.getUTCFullYear();
};

/**
 * The year to file a person under, and where that year came from.
 *
 * THE ORDER IS THE POINT. The most specific thing the University actually
 * recorded wins, and the account's own creation date is the last resort rather
 * than the first — an account opened in 2026 for a student admitted in 2024
 * belongs in 2024, and filing them under 2026 would put a whole cohort in the
 * wrong year the first time a batch of accounts was opened late.
 */
export function personYear(facts: PersonFacts): PersonYear {
  const kind = personKind(facts.role);

  if (kind === 'student') {
    if (typeof facts.admissionYear === 'number' && facts.admissionYear > 0) {
      return { year: facts.admissionYear, basis: 'admitted' };
    }
    const applied = yearOfDate(facts.appliedAt);
    if (applied !== null) return { year: applied, basis: 'applied' };
  } else {
    const started = yearOfDate(facts.startedOn);
    if (started !== null) return { year: started, basis: 'appointed' };
  }

  // NEVER NULL. `profiles.created_at` is NOT NULL in the schema, so this
  // always answers and no person falls off a list.
  return { year: yearOfDate(facts.accountOpenedAt) ?? 0, basis: 'account' };
}

/**
 * Years present in a set of people, most recent first, with a count each.
 *
 * MOST RECENT FIRST because that is the one being worked on. A year with a
 * zero count is not listed: an empty chip is a chip that does nothing.
 */
export function yearsPresent<T>(
  people: T[],
  yearOf: (p: T) => number,
): { year: number; count: number }[] {
  const tally = new Map<number, number>();
  for (const p of people) {
    const y = yearOf(p);
    tally.set(y, (tally.get(y) ?? 0) + 1);
  }
  return [...tally.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => b.year - a.year);
}

/** For the one case `personYear` cannot answer with a real year. */
export const yearLabel = (year: number): string => (year > 0 ? String(year) : 'Year not recorded');
