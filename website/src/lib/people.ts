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

export type PersonKind = 'lecturer' | 'student' | 'applicant' | 'other';

/**
 * The groups, in the order they are drawn.
 *
 * ---------------------------------------------------------------------------
 * AN APPLICANT IS A GROUP, NOT A FOOTNOTE
 * ---------------------------------------------------------------------------
 *
 * The University named three — "lecturers, students, other" — and these were
 * three, with applicants counted inside Students and a line underneath saying
 * how many of them there were. The University overruled that: an applicant and
 * a student are two populations, as they are in every student record system,
 * and the whole of this codebase already agrees — 018 refuses to delete a
 * record once it is ADMITTED, precisely because it has stopped being an
 * application. A tab is the honest shape of that.
 *
 * `other` IS THE UNIVERSITY'S OWN WORD and is kept. It was drawn as
 * "Administration" for a while on the reasoning that a group called Other is a
 * group nobody maintains; the University's word is the one on the screen.
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
    note: 'Admitted. A paid application and a decision sit behind every one of these accounts.',
  },
  {
    kind: 'applicant',
    label: 'Applicants',
    note: 'Not yet admitted. Their year is the year they applied, and they move to Students '
      + 'when the application is decided.',
  },
  {
    kind: 'other',
    label: 'Other',
    note: 'Every office that runs the University: the Registry, Finance, Admissions, the '
      + 'faculties, HR, the examination offices, the national tier and the two executive '
      + 'offices.',
  },
];

/**
 * Which group a role belongs to.
 *
 * A ROLE THIS FILE HAS NOT BEEN TAUGHT LANDS IN `other` rather than being
 * dropped or inventing a group at runtime. A person with an unrecognised role
 * still has to appear on a register somewhere; a group with no tab and no
 * label is a person nobody can see.
 */
export function personKind(role: string | null | undefined): PersonKind {
  if (role === 'lecturer') return 'lecturer';
  if (role === 'student') return 'student';
  if (role === 'applicant') return 'applicant';
  return 'other';
}

/**
 * Whether this group's year is read from the admissions register rather than
 * from a staff record.
 *
 * BOTH OF THEM, and this is the line that would have been silently wrong when
 * applicants became a group of their own: `personYear` used to branch on
 * `kind === 'student'`, which covered applicants only because they WERE
 * students. Splitting the tab without splitting this would have sent every
 * applicant to look for a staff record, find none, and be filed under the year
 * their account was opened — a plausible year from the wrong register.
 */
export const readsTheAdmissionsRegister = (kind: PersonKind): boolean =>
  kind === 'student' || kind === 'applicant';

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
  if (readsTheAdmissionsRegister(personKind(facts.role))) {
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
