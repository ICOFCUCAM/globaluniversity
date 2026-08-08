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
// held two programmes; a `DIPLOMA_CREDITS` constant held a level default; the
// Bachelor of Theology stated 180 ECTS in its own content module; the Bachelor
// of Ministry states 180 ECTS in its own; and migration 006 seeded a third
// figure into the database. Five places, no single statement of what the
// University's award levels are worth.
//
// That is survivable while the numbers agree. They do not.
//
// ===========================================================================
// THE DIPLOMA IS SPECIFIED TWICE, AT DIFFERENT VALUES
// ===========================================================================
//
// This is the finding, and it is the reason to read this file rather than the
// reason to skim it.
//
//   180 ECTS   programmeCatalogue.ts sets every Diploma to 180 and publishes
//              the figure. Its comment records the provenance: "180, on the
//              university's instruction, correcting the 120 seeded in
//              migration 006."
//
//   120 ECTS   §25 of the School of Ministry academic framework, supplied in
//              August 2026, states "Diploma in Ministry — 120 ECTS —
//              Professional ministry preparation", within a ladder that also
//              gives Certificate 60, Bachelor 180 and Master 120.
//
// Both are the university's own instruction. The second is later. Neither is
// obviously a slip: 120 ECTS is the conventional European two-year diploma and
// sits correctly in a 60/120/180 ladder, while 180 was issued as a deliberate
// correction of exactly the figure the new framework now restates.
//
// SO NOTHING HAS BEEN CHANGED. A credit value is the single most load-bearing
// number a university publishes — it governs transfer, articulation, the
// transcript and the certificate — and picking between two contradictory
// instructions is not a decision a website should make on the university's
// behalf. The site continues to publish 180 for diplomas, which is what it
// published yesterday; the conflict is recorded in CREDIT_QUESTIONS below and
// on the page, and the ladder is stated once so the next figure has somewhere
// to go.
//
// The cost of guessing wrong is not a wrong number on a page. It is a graduate
// whose diploma is rejected on transfer because the credit stated on their
// transcript is not the credit the university now says the award carries.
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
 * The award ladder, as the School of Ministry academic framework states it.
 *
 * PUBLISHED AS THE FRAMEWORK'S STATEMENT, not as a University-wide regulation,
 * because that is what it is. §25 sets out the ladder for the School of
 * Ministry. It is the most complete statement of an award ladder this
 * university has supplied, and it is very likely intended to govern the
 * institution — but "very likely intended" is not a regulation, and the
 * difference matters at exactly the moment somebody relies on it.
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
    // NULL, DELIBERATELY, AND IT IS THE ONLY NULL IN THIS TABLE.
    //
    // Not because no figure exists but because two do — 180 in the published
    // catalogue, 120 in the framework — and printing either here would resolve
    // by publication a conflict the University has not resolved by decision.
    // A page that shows this cell as "under review" is telling the truth; one
    // that shows a number is picking a side.
    ects: null,
    duration: 'One to two years',
    purpose: 'Professional preparation, and advanced standing towards a degree.',
    source: 'Contested — see CREDIT_QUESTIONS. The site publishes 180 ECTS.',
  },
  {
    level: 'Bachelor',
    ects: 180,
    duration: 'Three years · six semesters',
    purpose: 'The full undergraduate degree, and the gateway to graduate study.',
    source: 'Stated for both the B.Th. and the B.Min., and by the framework §25.',
  },
  {
    level: 'Master',
    ects: 120,
    duration: 'One to two years',
    purpose: 'Advanced professional specialisation or theological scholarship.',
    source: 'School of Ministry academic framework §25.',
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
    finding: 'The Diploma is specified at two different credit values.',
    detail:
      'The programme catalogue publishes 180 ECTS for every diploma, on an instruction that '
      + 'expressly corrected an earlier figure of 120. The School of Ministry academic framework, '
      + 'supplied later, states 120 ECTS for the Diploma in Ministry within a ladder of '
      + 'Certificate 60, Bachelor 180 and Master 120. Both are the University’s own instruction '
      + 'and the site has changed neither, because a credit value governs transfer, articulation, '
      + 'the transcript and the certificate.',
    recommendation:
      'Rule once, for the whole University, and say whether the ruling is retrospective. If the '
      + 'answer is 120, every diploma already issued at 180 needs a decision of its own — that is '
      + 'the part that gets forgotten, and it is the part a graduate discovers at a transfer desk.',
  },
  {
    id: 'ladder-scope',
    finding: 'The award ladder is stated by one School, not by the University.',
    detail:
      'The 60 / 120 / 180 / 120 ladder above comes from §25 of the School of Ministry framework, '
      + 'which describes the progression that School should build. It is the most complete '
      + 'statement of an award ladder the University has supplied, and nothing contradicts it — '
      + 'but it has not been adopted as a University-wide regulation, so it cannot yet be quoted '
      + 'as one to an accreditor.',
    recommendation:
      'Adopt it as a University credit regulation, or state where it does not apply. The '
      + 'engineering and business diplomas in particular carry no published credit value at all, '
      + 'and a ladder that governs them would give them one.',
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
