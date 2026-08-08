// ---------------------------------------------------------------------------
// THE UNIVERSITY'S CREDIT FRAMEWORK.
//
// What an award is worth, in what unit, and on whose statement.
//
// ===========================================================================
// WHY THIS FILE EXISTS
// ===========================================================================
//
// Credit values were scattered. `PUBLISHED_CREDITS` in programmeCatalogue.ts
// held three programmes; `LEVEL_CREDITS` beside it held level defaults; the
// Bachelor of Theology stated 180 ECTS in its own content module; the Bachelor
// of Ministry states 180 ECTS in its own; and migration 006 seeded a third
// figure into the database. Five places, no single statement of what the
// University's award levels are worth.
//
// That is survivable while the numbers agree. They did not — see below — and
// the disagreement was only findable once they were written down together.
//
// ===========================================================================
// THE DIPLOMA CONFLICT, AND HOW IT WAS SETTLED
// ===========================================================================
//
// This file was written to hold a disagreement open. The Diploma had been
// specified three times:
//
//   120 ECTS   seeded by migration 006 when the awards table was created
//   180 ECTS   instructed afterwards, and published by the site ever since
//   120 ECTS   restated by the School of Ministry academic framework §25,
//              inside a ladder of Certificate 60, Bachelor 180, Master 120
//
// The site published 180 and changed nothing, because a credit value governs
// transfer, articulation, the transcript and the certificate, and choosing
// between two contradictory instructions from the university is not a decision
// a website makes on the university's behalf.
//
// THE UNIVERSITY HAS NOW RULED: "Diploma is 120. 180 is degree."
//
// So the Diploma carries 120 and the ladder is complete at every level the
// university has spoken to. The history above is kept rather than tidied away —
// this figure has moved twice, and the next person to find a 180 in an old
// export needs to know which way it went and when.
//
// WHAT THE RULING TOUCHED, all of it recorded in CREDIT_QUESTIONS below:
//
//   The catalogue. The figure moved from a per-programme entry to a LEVEL one,
//   because that is the form the ruling took. Every diploma now carries 120,
//   including the technology and business diplomas that previously published no
//   figure at all.
//
//   The database. `awards.credits_required` is what the graduation audit reads.
//   Migration 006 is corrected for fresh installs, and migration 012 corrects a
//   database that already ran the 180 version — without which the audit would
//   refuse to graduate a diploma student who has completed the 120 credits the
//   award now requires, and the refusal would look like an incomplete record
//   rather than a stale figure.
//
//   Nothing retrospective, and this was checked rather than assumed. No
//   credential has been issued from this system, so no sealed diploma states a
//   figure the university has now moved. Migration 012 re-checks at run time
//   and raises a notice rather than editing a conferred document.
// ---------------------------------------------------------------------------

export type CreditUnit = 'ECTS' | 'credit hours';

export interface AwardLevel {
  /** The level as the University names it. */
  level: string;
  /** Credit value, where the University has stated one. Null where it has not. */
  ects: number | null;
  /** Typical duration, in the University's own words. */
  duration: string;
  /** What the level is for. */
  purpose: string;
  /** Where the figure comes from, so it can be checked. */
  source: string;
}

/**
 * The award ladder.
 *
 * THREE RUNGS ARE RULED AND ONE IS NOT, and `source` says which is which on
 * every row.
 *
 * The Diploma, the Bachelor and the Master carry a direct ruling from the
 * University — "Diploma is 120. 180 is degree." and "Masters is 120 credits."
 * The Doctorate carries no figure, which is the normal state for an award
 * examined by thesis rather than a gap.
 *
 * The CERTIFICATE at 60 is the one rung still resting on §25 of the School of
 * Ministry academic framework, which sets out the ladder for that School.
 * Nothing contradicts it and it is very likely intended to govern the
 * institution, but "very likely intended" is not a regulation and the
 * difference matters at the moment somebody relies on it. See the second entry
 * in CREDIT_QUESTIONS.
 */
export const AWARD_LADDER: AwardLevel[] = [
  {
    level: 'Certificate',
    ects: 60,
    duration: 'Up to one year',
    purpose: 'Foundation-level study, or formal recognition of experience already held.',
    source: 'School of Ministry academic framework §25.',
  },
  {
    level: 'Diploma',
    // 120, ON THE UNIVERSITY'S RULING. This cell was null while two figures
    // were in play; a page showing "under review" told the truth, and a page
    // showing a number would have picked a side. The side has now been picked
    // by the institution, so the number goes in.
    //
    // It also restores the coherence the 180 broke: 120 ECTS is two full-time
    // years, which matches the stated duration below, where 180 is three and
    // put the diploma level with the bachelor's.
    ects: 120,
    duration: 'One to two years',
    purpose: 'Professional preparation, and advanced standing towards a degree.',
    source: 'Ruled by the University: “Diploma is 120. 180 is degree.” Framework §25 agrees.',
  },
  {
    level: 'Bachelor',
    ects: 180,
    duration: 'Three years · six semesters',
    purpose: 'The full undergraduate degree, and the gateway to graduate study.',
    source: 'Ruled by the University: “180 is degree.” Carried by the B.Th. and the B.Min.',
  },
  {
    level: 'Master',
    ects: 120,
    duration: 'One to two years',
    purpose: 'Advanced professional specialisation or theological scholarship.',
    source: 'Ruled by the University: “Masters is 120 credits.” Framework §25 agrees.',
  },
  {
    level: 'Doctorate',
    // The framework describes the D.Min. as "a professional doctoral ministry
    // programme" and the PhD as "subject to the University's doctoral
    // regulations" — neither with a credit value. A doctorate examined by
    // thesis is not conventionally credit-rated, so an absent figure here is
    // the normal state and not a gap.
    ects: null,
    duration: 'Three years or more',
    purpose: 'Supervised original research, examined on a defended thesis.',
    source: 'No credit value stated; doctorates are examined by thesis.',
  },
];

/** What one ECTS credit represents. Stated so a transcript can be read. */
export const ECTS_NOTE =
  'One ECTS credit represents 25 to 30 hours of total student workload, including '
  + 'teaching, guided study, independent work and assessment. A full academic year is '
  + '60 ECTS and a standard semester is 30.';

export interface CreditQuestion {
  id: string;
  finding: string;
  detail: string;
  recommendation: string;
}

export const CREDIT_QUESTIONS: CreditQuestion[] = [
  {
    id: 'diploma-credit-value',
    finding: 'Settled — the Diploma is 120 ECTS and the degree is 180.',
    detail:
      'The figure had been stated three times: 120 when the awards table was created, 180 by a '
      + 'later instruction and published by the site ever since, and 120 again by the School of '
      + 'Ministry framework §25. The University has ruled: “Diploma is 120. 180 is degree.” The '
      + 'catalogue, the award ladder and the database now all carry it, and the figure is stated '
      + 'against the LEVEL rather than against one programme, which is the form the ruling took.',
    recommendation:
      'Two things follow and neither is automatic. Every diploma now inherits 120, including the '
      + 'technology and business diplomas that previously published no figure — if any of those is '
      + 'meant to differ it needs its own entry in PUBLISHED_CREDITS. And an installation that ran '
      + 'the 180 version of migration 006 must run migration 012, or its graduation audit will '
      + 'still demand 180 to confer a diploma.',
  },
  {
    id: 'ladder-scope',
    finding: 'One rung left — the Certificate is still the School of Ministry’s statement.',
    detail:
      'The Diploma at 120, the Bachelor at 180 and the Master at 120 now carry a direct ruling '
      + 'from the University. The Certificate at 60 still comes from §25 of the School of Ministry '
      + 'framework, which describes the progression that School should build. Nothing contradicts '
      + 'it — 60 ECTS is one full-time year and sits correctly below a 120-credit diploma — but it '
      + 'has not been adopted as a University-wide regulation, so it cannot yet be quoted as one '
      + 'to an accreditor. No certificate programme on this site publishes a credit figure at all.',
    recommendation:
      'Rule on the Certificate in the same words as the other three, and the ladder becomes a '
      + 'University credit regulation rather than four figures with two provenances. Until then '
      + 'the certificates publish no figure, which is the honest state and not an omission.',
  },
  {
    id: 'two-credit-systems',
    finding: 'The University accounts in two credit systems and states no conversion.',
    detail:
      'The Bachelor of Theology is specified twice — as 180 ECTS, and as a course listing in '
      + 'US-style credit hours. The Bachelor of Ministry is ECTS throughout. Five ECTS and five '
      + 'credit hours are not the same quantity, and no conversion factor between them has been '
      + 'stated by the University.',
    recommendation:
      'State the ECTS value of every course in the credit-hour listings, rather than publishing a '
      + 'conversion factor. An invented factor is the one number a credential evaluator will '
      + 'reject; a stated per-course value is simply the record.',
  },
];

/** The one figure the University has stated for every level that has one. */
export const ectsFor = (level: string): number | null =>
  AWARD_LADDER.find((a) => a.level.toLowerCase() === level.toLowerCase())?.ects ?? null;
