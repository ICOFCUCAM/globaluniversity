// ---------------------------------------------------------------------------
// WHOSE UNIVERSITY THIS IS.
//
// The demonstration store carries "Demonstration University" in its seed, and
// that is right for a demonstration. Mounted against a real institution's
// database, the name has to come from the institution.
//
// ---------------------------------------------------------------------------
// WHY THIS IS NOT JUST A STRING IN THIS FILE
// ---------------------------------------------------------------------------
//
// The ICOF repository has a standing rule, and it is the first of them:
//
//     Never invent an institutional fact. No accreditation, campus,
//     programme, faculty member, partnership, ranking, statistic, award, or
//     date of founding that the University has not stated.
//     `src/lib/constants.ts` and `src/content/site.ts` are where the facts
//     live; if it is not there, ask.
//
// The University's name IS one of those facts, and it is already written down,
// once, in `website/src/lib/constants.ts`. Copying it here would make two
// places that answer the same question — and the one that is wrong is
// whichever was edited second.
//
// So it is configuration until the two trees are one. WHEN THE STUDIO MOVES
// INSIDE `website/`, THIS FILE GOES AND THE CONSTANT IS IMPORTED DIRECTLY.
// That is the whole intended lifetime of this file, and it is written here so
// nobody mistakes it for the permanent home of the University's name.
//
// AND IT REFUSES RATHER THAN GUESSING. There is no default, because a default
// would be a name this platform made up, shown to students, under the
// University's own letterhead.
// ---------------------------------------------------------------------------

import type { University } from './domain/types';

export const UNIVERSITY: University = {
  get id() { return required('ACADEMIC_UNIVERSITY_ID'); },
  get name() { return required('ACADEMIC_UNIVERSITY_NAME'); },
  get shortName() { return required('ACADEMIC_UNIVERSITY_SHORT_NAME'); },
} as University;

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `${name} is not set. Running against a real university's database requires its own name: `
      + 'this platform does not invent one, and a placeholder would appear on students’ '
      + 'screens under that university’s letterhead. The name lives in '
      + 'website/src/lib/constants.ts; set it here until the two trees are one.',
    );
  }
  return value.trim();
}
