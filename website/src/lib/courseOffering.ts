// ---------------------------------------------------------------------------
// IS IT ON OFFER? — the second question a registration asks.
//
// ---------------------------------------------------------------------------
// WHY THIS IS NOT PART OF THE PREREQUISITE RULE
// ---------------------------------------------------------------------------
//
// `src/lib/prerequisites.ts` answers "has this student earned the right to take
// this course". This answers "is the course actually running, and is there room
// on it". They are two different questions with two different remedies, and
// collapsing them sends people to the wrong office.
//
// A student refused MIN 202 because they have not passed MIN 101 must go and
// pass MIN 101. A student refused MIN 202 because the class is full has met
// every academic condition the University sets, and must go to the Registry.
// Telling the second one "you are not eligible" is both untrue and useless.
//
// So the route keeps both answers: `meetsPrerequisites` and `unavailable`.
//
// ---------------------------------------------------------------------------
// AND IT LIVES HERE RATHER THAN IN THE ROUTE
// ---------------------------------------------------------------------------
//
// A Next.js route file may export only its handlers and its runtime flags —
// anything else fails the build. A rule that cannot be exported cannot be
// imported by a test, and a rule nobody has watched refuse anything is a rule
// nobody has tested. `courseOffering.test.mjs` breaks every one of these.
// ---------------------------------------------------------------------------

/** One class of an offering: where to be, and when. */
export interface OfferedClass {
  id: string;
  code: string;
  dayOfWeek: number | null;
  startsAt: string | null;
  endsAt: string | null;
}

/** One course running in one term, as much of it as a student needs to decide. */
export interface OfferingFacts {
  offeringId: string;
  status: string;
  deliveryMode: string;
  campus: string | null;
  lecturer: string | null;
  maxEnrolment: number | null;
  registered: number;
  placesLeft: number | null;
  classes: OfferedClass[];
}

/**
 * Why this offering cannot be registered on — or null if it can.
 *
 * SAID AS A SENTENCE, not as a status code, because this is the text a student
 * reads beside the course. "planned" tells them nothing; "registration has not
 * opened for this course yet" tells them to come back.
 *
 * @param offeringsConfigured whether the TERM has any offerings at all. A term
 *   nobody has set up yet must not refuse everything: 063 seeds no offerings on
 *   purpose — which term runs which course is the University's to say, not a
 *   migration's to invent — so an empty term falls back to the catalogue and
 *   the screen says why the lecturer and the hours are missing.
 */
export function whyNot(
  offering: OfferingFacts | undefined | null,
  offeringsConfigured: boolean,
): string | null {
  if (!offering) {
    return offeringsConfigured
      ? 'This course is not offered in this term.'
      : null;
  }
  if (offering.status === 'cancelled') return 'This offering has been cancelled.';
  if (offering.status === 'planned') return 'Registration has not opened for this course yet.';
  if (offering.status === 'closed') return 'Registration for this course has closed.';
  // NULL IS NOT ZERO. An offering with no ceiling has no places left to count,
  // and a check reading null as zero closes a course nobody limited.
  if (offering.placesLeft !== null && offering.placesLeft <= 0) {
    return `This class is full — all ${offering.maxEnrolment} places are taken.`;
  }
  return null;
}

/**
 * Which class a registration attaches to.
 *
 * An offering with exactly one class needs no choice, and picking it here
 * rather than leaving the link half made is the difference between a lecturer
 * who can produce a mark sheet from their own list and one who cannot. A
 * choice that names a class belonging to some other offering is ignored rather
 * than written — 063 refuses it at the database, and a refusal at the last
 * moment is a worse experience than a sensible default.
 */
export function sectionFor(
  offering: OfferingFacts | undefined | null,
  asked: string | null,
): string | null {
  if (!offering) return null;
  if (asked && offering.classes.some((s) => s.id === asked)) return asked;
  return offering.classes.length === 1 ? offering.classes[0].id : null;
}
