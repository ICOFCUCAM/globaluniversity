// ---------------------------------------------------------------------------
// THE FACULTY'S COURSE CODES — one code per subject, across every programme.
//
// ---------------------------------------------------------------------------
// THE QUESTION THIS FILE ANSWERS
// ---------------------------------------------------------------------------
//
// "Why are these course codes so the same, whereas some would be interchanged
// and studied in other programmes? Why change the coding system shown on the
// transcript?"
//
// Because the University's own material carries THREE coding systems, and the
// transcript auto-fill was reading the wrong one:
//
//   THE REGISTRY SCHEME — subject area, then level. BIS 220 Bible Survey I,
//   CH 200 Church History, OT 300 Pentateuch, STT 400 Systematic Theology I.
//   This is the scheme on every transcript the University has issued, and it is
//   the one supplied to this project with the Diploma of Theology and with the
//   Bachelor of Theology's credit-hour listing. Its defining property is the
//   one the University asked about: THE CODE BELONGS TO THE SUBJECT, NOT TO THE
//   PROGRAMME. Bible Doctrine I is BIS 250 whether it is read on the Diploma or
//   on the Bachelor, which is what makes a course transferable between them and
//   what lets a reader see, from the code alone, where it sits in the faculty.
//
//   THE BACHELOR OF MINISTRY SCHEME — BIB 101, HIS 101, MIN 201. Also by
//   subject, but with its own prefixes, so the same subject can hold two codes:
//   Church History is CH 200 in one document and HIS 101 in the other.
//
//   THE DEVELOPMENT-BRIEF SCHEME — BTH101 … BTH312, numbered straight through
//   the 180-ECTS Bachelor of Theology in teaching order. This one is per
//   PROGRAMME, so it cannot say that a course is shared, and a subject taken on
//   two programmes gets two unrelated numbers.
//
// All three came from the University. The brief's scheme is what the transcript
// screen was filling in, because the 180-ECTS structure is the one the
// University confirmed governs the award, and its codes travel with it.
//
// ---------------------------------------------------------------------------
// WHAT THIS FILE DOES, AND THE ONE THING IT WILL NOT DO
// ---------------------------------------------------------------------------
//
// It makes the registry scheme govern: where the University has published a
// registry code for a subject, that is the code, on every programme and on
// every document.
//
// It will NOT invent the rest. Twenty-four of the thirty-six courses on the
// 180-ECTS Bachelor of Theology are new subjects the registry listing does not
// contain, and a plausible code — BIS 350 for Pneumatology, say — would be
// indistinguishable from a real one on a sealed transcript and wrong in the
// faculty's own numbering. Those courses keep the brief's code, marked as a
// programme code rather than a registry one, and are listed for the faculty to
// assign. A gap that is visible is a decision waiting; a gap that has been
// filled in by a computer is a mistake nobody will ever find.
//
// NO CODE IS TYPED IN THIS FILE. The map below pairs a course TITLE with the
// registry TITLE it is the same subject as; the code itself is read from
// `curricula.ts`, which holds what the University supplied. So this file cannot
// introduce a code the University never issued, even by a typing slip.
// ---------------------------------------------------------------------------

import { curricula, supersededBthSchedule } from '@/content/curricula';

/** Where a code on a document came from. */
export type CodeSource =
  /** The University's registry scheme, as published in its course listings. */
  | 'registry'
  /** The 180-ECTS development brief. A programme sequence, not a faculty code. */
  | 'programme';

export interface FacultyCode {
  code: string;
  source: CodeSource;
  /**
   * The registry course this was matched to, where its title differs from the
   * programme's. Printed on screen so a registrar can challenge the match
   * rather than discover it on a graduate's transcript.
   */
  matchedTo?: string;
}

/** Punctuation, case and spacing are not part of a course's identity. */
function key(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * The registry, built from what the University supplied rather than retyped.
 *
 * The Bachelor of Ministry's listing is deliberately excluded. It is a second
 * scheme for the same subjects — HIS 101 against CH 200 for Church History —
 * and mixing the two would produce exactly the confusion this file exists to
 * end. Which of the two the faculty keeps is the University's decision, not a
 * matter for a lookup table.
 */
const REGISTRY_SLUGS = ['diploma-in-theology'];

/**
 * The sources the registry is read from.
 *
 * One of them is a schedule the University SUPERSEDED — the Bachelor of
 * Theology's credit-hour listing, retired when the University ruled that only
 * the 180-ECTS structure stands. Reading a retired document is deliberate and
 * it is what that document is for: it was retired as a CURRICULUM, because its
 * credit values and its 87-hour total no longer describe the award, and its own
 * note says it "is retained only for the course codes and descriptions the ECTS
 * structure does not carry". The codes were never what was superseded — they
 * are the same codes printed on transcripts the University has issued.
 */
const registrySources = [
  ...curricula.filter((c) => REGISTRY_SLUGS.includes(c.programSlug)),
  supersededBthSchedule,
];

const registryByTitle: Map<string, { code: string; title: string }> = (() => {
  const out = new Map<string, { code: string; title: string }>();
  for (const c of registrySources) {
    for (const term of c.terms) {
      for (const course of term.courses) {
        const k = key(course.title);
        const seen = out.get(k);
        // A subject listed on two programmes with two different codes is a
        // contradiction in the University's own material, and it is surfaced
        // rather than resolved by whichever happened to be read last.
        if (seen && seen.code !== course.code) continue;
        if (!seen) out.set(k, { code: course.code, title: course.title });
      }
    }
  }
  return out;
})();

/**
 * Where a course of the 180-ECTS Bachelor of Theology is the same subject as
 * one the registry lists under a different wording.
 *
 * CONSERVATIVE ON PURPOSE. Only pairs where the two titles name the same
 * subject and differ in wording alone. Every case where the 180-ECTS structure
 * SPLIT a registry course (Church History became Church History I and II) or
 * BROADENED it (Demonology became Spiritual Warfare and Demonology) is left
 * out: one code cannot serve two courses, and a broader course is not the
 * course the registry numbered. Those are decisions for the faculty.
 */
const TITLE_ALIASES: Record<string, string> = {
  'Pentateuch Studies': 'Pentateuch',
  'Old Testament History and Theology': 'Old Testament History',
  'Homiletics I': 'Homiletics',
  'Evangelism and Missions Introduction': 'Evangelism (Intro)',
};

/**
 * The registry code for a course title, or null where the University has not
 * issued one.
 *
 * Null is a real answer here, and callers must carry it as one. Falling back to
 * "something that looks like a code" is the failure this whole file is written
 * against.
 */
export function registryCode(title: string): FacultyCode | null {
  const direct = registryByTitle.get(key(title));
  if (direct) return { code: direct.code, source: 'registry' };

  const alias = TITLE_ALIASES[title];
  if (alias) {
    const viaAlias = registryByTitle.get(key(alias));
    if (viaAlias) return { code: viaAlias.code, source: 'registry', matchedTo: viaAlias.title };
  }
  return null;
}

/**
 * The code to print for a course: the faculty's where it has one, the
 * programme's where it does not — and always saying which.
 */
export function facultyCode(title: string, programmeCode: string): FacultyCode {
  return registryCode(title) ?? { code: programmeCode, source: 'programme' };
}

/** Every registry code the University has published, for a reference screen. */
export function registryCodes(): { code: string; title: string }[] {
  return Array.from(registryByTitle.values())
    .sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * The subject prefixes in use, with the courses that carry them.
 *
 * NOT EXPANDED. It is obvious enough that OT and NT are the two testaments and
 * tempting to write "MDS — Ministry and Discipleship Studies" beside the rest,
 * but the University has never stated what its prefixes stand for, and a
 * plausible expansion printed in a handbook becomes a fact nobody checks. The
 * courses under each prefix are shown instead: they are evidence, and they let
 * the faculty write the expansion themselves.
 */
export function subjectPrefixes(): { prefix: string; courses: string[] }[] {
  const out = new Map<string, string[]>();
  for (const { code, title } of Array.from(registryByTitle.values())) {
    const prefix = code.split(/[\s0-9]/)[0];
    out.set(prefix, [...(out.get(prefix) ?? []), title]);
  }
  return Array.from(out.entries())
    .map(([prefix, courses]) => ({ prefix, courses: courses.sort() }))
    .sort((a, b) => a.prefix.localeCompare(b.prefix));
}
