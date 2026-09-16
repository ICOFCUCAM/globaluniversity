// ---------------------------------------------------------------------------
// THE UNIVERSITY'S TWENTY-THREE ROLES, AND THIS PLATFORM'S SIX.
//
// `profiles.role` is the University's answer to "what is this person". This
// platform asks a narrower question — what may they do to a lecture — and has
// six answers. One of those is not a rename of the other, so the mapping is
// written here, once, and tested.
//
// ---------------------------------------------------------------------------
// WHAT IS DELIBERATELY NOT MAPPED
// ---------------------------------------------------------------------------
//
// TWO OF THE PLATFORM'S ROLES HAVE NOBODY IN THEM, and that is the correct
// state rather than an omission to be filled in later.
//
//   `assistant`            — a teaching assistant, who may upload and run a
//                            transformation but never correct, approve or
//                            publish. The University's role list has no such
//                            post. Inventing one here would be inventing an
//                            institutional fact, which this repository does
//                            not do.
//
//   `translation-reviewer` — reads one language and vouches for what it says.
//                            Same: the University has not created the post.
//
// Both degrade honestly. With nobody holding `translation-reviewer`, every
// translation stays `unreviewed` and every screen showing one says so — which
// is true, and better than a translation quietly presented as checked. With
// nobody holding `assistant`, a lecturer does their own uploading.
//
// When the University rules that either post exists, it is one line here.
//
// ---------------------------------------------------------------------------
// AND WHY MOST OF THE UNIVERSITY'S ROLES MAP TO NOTHING
// ---------------------------------------------------------------------------
//
// An Invigilator, an HR Officer, a Finance Officer and an Applicant have no
// business inside a lecture's material, so they get no platform role and the
// Studio does not open for them.
//
// This is not a second opinion about who may read what — it AGREES WITH THE
// DATABASE ON PURPOSE. 092's `governs_the_curriculum()` admits exactly
// superadmin, admin, registrar, academic-office, dean, hod and
// programme-coordinator, and that is the same list as `REGISTRY` and
// `COORDINATOR` below. If these two ever disagree, the screen would offer
// something the policy then refuses, which is the worst of both: a person
// told they may do a thing and then told they may not.
// `roleMap.test.mjs` compares this file against the migration and fails if
// they drift.
// ---------------------------------------------------------------------------

import type { Role } from '../capabilities';

/** The offices that run the environment. They read published material only. */
const REGISTRY = ['superadmin', 'admin', 'registrar', 'academic-office'] as const;

/** The offices that run a faculty's or department's courses. Same reading. */
const COORDINATOR = ['dean', 'hod', 'programme-coordinator'] as const;

export function platformRole(universityRole: string | null | undefined): Role | null {
  if (!universityRole) return null;
  const role = universityRole.trim().toLowerCase();

  if (role === 'lecturer') return 'lecturer';
  if (role === 'student') return 'student';
  if ((REGISTRY as readonly string[]).includes(role)) return 'registry';
  if ((COORDINATOR as readonly string[]).includes(role)) return 'coordinator';

  // Everybody else — invigilator, examiner, moderator, exam-officer, finance,
  // finance-director, admissions-officer, library-staff, student-affairs,
  // hr-officer, hr-administrator, chancellor, vice-chancellor, applicant.
  //
  // THE TWO MOST SENIOR OFFICES OF THE UNIVERSITY ARE IN THAT LIST, and it is
  // not an oversight. The Chancellor and the Vice-Chancellor govern the
  // institution; they do not govern the curriculum, and 092 does not admit
  // them either. Seniority is not the question a lecture's material asks —
  // "whose teaching is this" is.
  return null;
}

/** Everything this file knows how to answer, for the test to walk. */
export const MAPPED: ReadonlyArray<readonly [string, Role]> = [
  ['lecturer', 'lecturer'],
  ['student', 'student'],
  ...REGISTRY.map((r) => [r, 'registry'] as const),
  ...COORDINATOR.map((r) => [r, 'coordinator'] as const),
];

/** Platform roles nobody holds, and why. Read by the test, and by people. */
export const UNFILLED: Readonly<Record<string, string>> = {
  assistant:
    'The University has no teaching-assistant post. Until it rules that one exists, a lecturer '
    + 'does their own uploading.',
  'translation-reviewer':
    'The University has no translation-reviewer post. Until it rules that one exists, every '
    + 'translation stays unreviewed and says so on every screen that shows it.',
};
