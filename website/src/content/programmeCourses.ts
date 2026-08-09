// ---------------------------------------------------------------------------
// THE COURSES OF A PROGRAMME, FOR A TRANSCRIPT THAT SHOULD NOT BE RETYPED.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
//
// The historical transcription screen asked an operator to type a code, a title,
// a credit value, a year and a semester for every course on a three-year
// degree — thirty-six rows for a Bachelor of Theology — when the University has
// published all five of those things for that programme and this repository
// already carries them.
//
// Retyping a course title is not a neutral cost. It is thirty-six chances to
// put a course on a SEALED University document under a name the University does
// not use, and nobody in the registry would notice, because it reads perfectly
// well. The archive supplies the GRADES; the University supplies the courses.
//
// ---------------------------------------------------------------------------
// WHAT IT REFUSES TO DO
// ---------------------------------------------------------------------------
//
// Invent a course list for a programme the University has not published one
// for. Three programmes have a published schedule — the Bachelor of Theology,
// the Bachelor of Ministry and the Diploma of Theology — and the rest do not.
// For those, this returns nothing and the screen says so, rather than offering
// a plausible list of courses that no committee ever approved.
//
// ---------------------------------------------------------------------------
// AND WHICH SOURCE GOVERNS
// ---------------------------------------------------------------------------
//
// The Bachelor of Theology has TWO course lists in this repository, and they
// disagree: `bthCurriculum` in bachelorOfTheology.ts (36 courses, six semesters
// at 5 ECTS) and `bachelorOfTheologyCreditCurriculum` in curricula.ts (30
// courses, Years One and Two only, credit hours).
//
// The second one says in its own note that it is supplementary and that "the
// 180-ECTS structure published at /bachelor-of-theology governs this award —
// the university has confirmed it". So the first governs, and this file follows
// the confirmation rather than picking whichever is easier to read.
// ---------------------------------------------------------------------------

import { bthCurriculum } from '@/content/bachelorOfTheology';
import { bminSemesters } from '@/content/bachelorOfMinistry';
import { diplomaOfTheologyCurriculum } from '@/content/curricula';

/** One course, ready to become a transcript row. */
export interface ProgrammeCourse {
  code: string;
  title: string;
  /** ECTS, where the University has stated one. Null where it has not. */
  credits: number | null;
  year: number;
  semester: number;
}

export interface ProgrammeSchedule {
  /** The programme title as `courses.ts` gives it. */
  programme: string;
  courses: ProgrammeCourse[];
  /** Where the list comes from, printed on screen so it can be challenged. */
  source: string;
  /**
   * Set when the University has published courses but not their credit values.
   * The screen fills the codes and titles and leaves the operator to supply
   * credits from the archive — which is the honest split.
   */
  creditsUnstated?: boolean;
}

/** Five ECTS a course, as the Bachelor of Theology is published. */
const BTH_CREDITS = 5;

function bth(): ProgrammeSchedule {
  const courses: ProgrammeCourse[] = [];
  bthCurriculum.forEach((block, i) => {
    // Six blocks in published order: Year One Sem 1 and 2, Year Two, Year Three.
    const year = Math.floor(i / 2) + 1;
    const semester = (i % 2) + 1;
    for (const c of block.courses) {
      courses.push({ code: c.code, title: c.title, credits: BTH_CREDITS, year, semester });
    }
  });
  return {
    programme: 'Bachelor of Theology',
    courses,
    source: 'The published Bachelor of Theology structure — 36 courses, six semesters, 5 ECTS '
      + 'each, 180 in total.',
  };
}

function bmin(): ProgrammeSchedule {
  const courses: ProgrammeCourse[] = [];
  bminSemesters.forEach((s, i) => {
    const year = Math.floor(i / 2) + 1;
    const semester = (i % 2) + 1;
    for (const c of s.courses) {
      courses.push({
        code: c.code,
        title: c.title,
        credits: typeof c.ects === 'number' ? c.ects : null,
        year,
        semester,
      });
    }
  });
  return {
    programme: 'Bachelor of Ministry',
    courses,
    source: 'The published Bachelor of Ministry semester plan.',
  };
}

function diplomaOfTheology(): ProgrammeSchedule {
  const courses: ProgrammeCourse[] = [];
  diplomaOfTheologyCurriculum.terms.forEach((term, i) => {
    for (const c of term.courses) {
      courses.push({
        code: c.code,
        title: c.title,
        // NO CREDIT VALUES WERE SUPPLIED for this programme, and the curriculum
        // file says so. Filling in 3 because it is a common number would put an
        // invented credit value on a sealed transcript.
        credits: typeof c.credits === 'number' ? c.credits : null,
        year: 1,
        semester: i + 1,
      });
    }
  });
  return {
    programme: 'Diploma of Theology',
    courses,
    source: 'The published Diploma of Theology schedule — one year, two semesters.',
    creditsUnstated: courses.every((c) => c.credits === null),
  };
}

/**
 * Every programme whose courses the University has published.
 *
 * Keyed by the programme title exactly as `courses.ts` carries it, because that
 * is what the transcription screen's dropdown is built from and a second
 * spelling here would silently match nothing.
 */
const SCHEDULES: Record<string, () => ProgrammeSchedule> = {
  'Bachelor of Theology': bth,
  'Bachelor of Ministry': bmin,
  'Diploma of Theology': diplomaOfTheology,
};

/** The published courses for a programme, or null where there are none. */
export function coursesForProgramme(title: string | null | undefined): ProgrammeSchedule | null {
  if (!title) return null;
  const build = SCHEDULES[title.trim()];
  return build ? build() : null;
}

/** Which programmes can be filled in. Used to tell the operator, not to gate. */
export function programmesWithCourses(): string[] {
  return Object.keys(SCHEDULES);
}
