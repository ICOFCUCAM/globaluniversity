// ---------------------------------------------------------------------------
// STUDENT VOICES AND ALUMNI PROFILES.
//
// BOTH ARRAYS ARE EMPTY, AND THAT IS THE POINT OF THIS FILE.
//
// A design review asked for testimonials and alumni profiles — "I completed my
// Bachelor…", "my ministry changed…", "I now teach…" — and it is right that a
// homepage without them is weaker. Universities are judged by their graduates.
//
// I will not write them. A fabricated testimonial is not a design placeholder
// like grey boxes or lorem ipsum; it is a statement attributed to a person who
// did not say it, published by an institution whose entire product is
// attribution. If a single quote on this page were later shown to be invented,
// every other claim on the site — the accreditation, the credit values, the
// sealed identifier on the certificate — would be read in that light, and
// fairly so.
//
// The components that render these are BUILT and wired. The sections appear the
// moment there is something true to put in them, and stay invisible until then.
// Nothing needs to be coded again; this file needs to be filled in.
//
// ---------------------------------------------------------------------------
// HOW TO FILL IT IN
//
// For each person you need four things, and the fourth is the one that matters:
//
//   1. Their words, as they said them. Lightly edited for length is fine;
//      written for them is not.
//   2. Their name, and the award and year. "Diploma in Theology, 2024".
//   3. What they do now, if they are willing to say.
//   4. THEIR WRITTEN CONSENT to be quoted and, if a photograph is used, to be
//      photographed and published. Keep it on file. This is not legal
//      throat-clearing — it is the difference between a testimonial and a
//      liability, and an accreditor may ask.
//
// A photograph is optional. A quote with a name and no photograph is worth far
// more than a quote with a stock photograph, which is worth less than nothing.
//
// START WITH THREE. Three real voices outperform a dozen thin ones, and the
// section is laid out for three.
// ---------------------------------------------------------------------------

export interface Voice {
  /** Their own words. */
  quote: string;
  name: string;
  /** e.g. 'Diploma in Theology, 2024' */
  award: string;
  /** What they do now. Optional. */
  now?: string;
  /** Path under /public/images. Optional — omit rather than use stock. */
  image?: string;
}

/**
 * Current students and recent graduates on what studying here was like.
 * Rendered by src/components/home/Voices.tsx.
 */
export const STUDENT_VOICES: Voice[] = [];

/**
 * Alumni, and where they serve now. Rendered in the same section.
 *
 * The university has bishops, pastors, teachers, engineers, civil servants and
 * missionaries among its graduates. Each one named here, with their award and
 * their post, is worth more to a prospective student than any sentence the
 * marketing copy can produce.
 */
export const ALUMNI_PROFILES: Voice[] = [];

/** True when there is anything real to show. */
export const hasVoices = STUDENT_VOICES.length + ALUMNI_PROFILES.length > 0;
