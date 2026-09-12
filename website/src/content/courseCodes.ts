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
// Where a subject the University has numbered is read under another wording,
// the two are paired by TITLE and the code is read from the University's own
// documents — never typed here. So a slip of the keyboard cannot introduce a
// code the University never issued.
//
// ---------------------------------------------------------------------------
// AND THE SUBJECTS IT HAD NOT NUMBERED
// ---------------------------------------------------------------------------
//
// Thirteen courses on the 180-ECTS Bachelor are new to that structure: no
// transcript and no listing carries them, because they have never been taught
// under the old one. This file refused to number them, on the grounds that a
// plausible code is indistinguishable from a real one on a sealed transcript.
//
// The University has now instructed that they be numbered, which settles it —
// the refusal was never about the numbering being impossible, only about whose
// decision it was. They are in ASSIGNED_CODES below, each under a prefix the
// University already uses, on a free number, with the reasoning that produced
// it written beside it, and marked `assigned` wherever they appear so that a
// registrar tracing a code finds an assignment rather than a document that does
// not exist.
// ---------------------------------------------------------------------------

import { curricula, supersededBthSchedule } from '@/content/curricula';
import { ISSUED_2020 } from '@/content/issuedTranscript2020';

/** Where a code on a document came from. */
export type CodeSource =
  /** The University's registry scheme, as published in its course listings. */
  | 'registry'
  /** The 180-ECTS development brief. A programme sequence, not a faculty code. */
  | 'programme'
  /**
   * A number worked out here rather than read off a document, at the
   * University's direction and under its own conventions.
   *
   * THE UNIVERSITY ASKED FOR THESE. Sixteen subjects on the 180-ECTS Bachelor
   * had never been numbered — they are new to that structure, so no transcript
   * and no listing carries them — and a registry with a hole in it cannot do
   * the one thing a registry is for. The instruction was to give them numbers.
   *
   * They are still marked apart from the codes the University issued, and they
   * always will be. Not because they are provisional — they are the faculty's
   * numbering now — but because a registrar tracing a code back to its source
   * should find "assigned under the faculty's conventions on this date" rather
   * than a document that does not exist. Every one is listed in ASSIGNED_CODES
   * below with the reasoning that produced it, and any of them can be replaced
   * by the faculty in one line.
   */
  | 'assigned';

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

/**
 * Read in this order, and the order is a ruling.
 *
 * THE ISSUED TRANSCRIPT COMES FIRST. Where the 2020 transcript and the later
 * course listing disagree — Use of English is MA 210 on the sheet and EN 101 in
 * the listing — the University has ruled that the transcript governs. That is
 * the right way round: the listing is a description of a programme, and the
 * transcript is a document the University put its seal on and a graduate has
 * been carrying for six years. Changing the code under them now would make
 * their transcript disagree with the register that is supposed to prove it.
 *
 * First wins, so precedence is expressed by position rather than by a rule
 * somewhere else that has to be kept in step with it.
 */
const orderedSources: { code: string; title: string }[] = [
  ...ISSUED_2020.map(({ code, title }) => ({ code, title })),
  ...registrySources.flatMap((c) => c.terms.flatMap((t) => t.courses
    .map((course) => ({ code: course.code, title: course.title })))),
];

const registryByTitle: Map<string, { code: string; title: string }> = (() => {
  const out = new Map<string, { code: string; title: string }>();
  for (const course of orderedSources) {
    const k = key(course.title);
    // First wins: a later source never overwrites an earlier one, so a
    // disagreement is settled by precedence rather than by whichever happened
    // to be read last. The disagreements themselves are reported by
    // codeDisagreements() rather than swallowed.
    if (!out.has(k)) out.set(k, { code: course.code, title: course.title });
  }
  return out;
})();

/**
 * Subjects the University's own documents number differently.
 *
 * SURFACED, NOT SILENTLY RESOLVED. Precedence decides which code a document
 * carries, but a registry where two sources disagree is a registry with
 * something to settle, and nothing settles if nobody can see it.
 */
export function codeDisagreements(): { title: string; governing: string; also: string[] }[] {
  const byTitle = new Map<string, { title: string; codes: string[] }>();
  for (const course of orderedSources) {
    const k = key(course.title);
    const seen = byTitle.get(k) ?? { title: course.title, codes: [] };
    if (!seen.codes.includes(course.code)) seen.codes.push(course.code);
    byTitle.set(k, seen);
  }
  return Array.from(byTitle.values())
    .filter((e) => e.codes.length > 1)
    .map((e) => ({ title: e.title, governing: e.codes[0], also: e.codes.slice(1) }));
}

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

  // --- From the 2020 transcript, which the University directed be used -----
  //
  // THE TEST APPLIED TO EVERY ONE OF THESE: does exactly one course in the
  // faculty answer to this subject? The 180-ECTS titles are the registry's
  // subject names with a describing tail — "Demonology" became "Spiritual
  // Warfare and Demonology", "Missiology" became "Missiology and Global
  // Christianity" — and where one registry course stands behind one programme
  // course, they are the same course under two wordings.
  //
  // Where the count is not one to one, nothing is mapped. Hermeneutics is the
  // case: the transcript has one BIS 330 and the 180-ECTS structure has both
  // Hermeneutics and Biblical Interpretation in Year Two and Advanced
  // Hermeneutics in Year Three. The title favours the first, the 300-level
  // number favours the second, and a coin toss on a graduate's transcript is
  // not a decision this file gets to make. Same for Spiritual Leadership, where
  // the registry has MDS 650 and MDS 655 for a programme course that is not
  // numbered I or II. Both are listed for the faculty.
  'Advanced Homiletics': 'Advance Homiletics',
  'Research Methodology II': 'Research Method II',
  'Missiology and Global Christianity': 'Missiology',
  'Spiritual Warfare and Demonology': 'Demonology',
  'Acts and Apostolic Mission': 'Acts of Apostles',
  'ICT, Technology and Global Ministry': 'ICT & Globalization',

  // The University has ruled that Church History is made of two courses:
  // Introduction to Church History and Advanced Church History. The first is
  // the course the registry numbered CH 200; the second is assigned below.
  'Introduction to Church History': 'Church History',

  // --- Settled by the University -------------------------------------------
  //
  // HERMENEUTICS. "Putting it in year two or three does not matter, it is the
  // same. Hermeneutics is still hermeneutics, and Biblical Studies BIS 330."
  // The year was the wrong thing to have hesitated over: a code names a
  // subject, and where a subject is taught is a timetable question.
  'Hermeneutics and Biblical Interpretation': 'Hermeneutics',

  // SPIRITUAL LEADERSHIP. "The two codes are for vol 1 and 2." So MDS 650 and
  // MDS 655 are the two volumes of one subject, and the Bachelor's single
  // course is the first of them.
  'Spiritual Leadership': 'Spiritual Leadership I',

  // The registry's own course, under the name its transcript prints. Same slot
  // in the same semester of the same programme; "Christian" and "Social" are
  // two names for the psychology the University teaches here.
  'Christian Psychology and Human Relations': 'Social Psychology and Human Relation',
};

/**
 * The subjects the University asked to be given numbers, and the numbers.
 *
 * ---------------------------------------------------------------------------
 * THE THREE RULES EVERY ONE OF THESE FOLLOWS
 * ---------------------------------------------------------------------------
 *
 * 1. THE PREFIX IS ONE THE UNIVERSITY ALREADY USES. Not one letter of a new
 *    subject area is invented here. A number inside an existing area can be
 *    changed by a memo; a new prefix is a claim about how the faculty is
 *    divided, and that is not a thing a lookup table gets to decide. Where a
 *    subject had no obvious home — the two biblical languages — it went to the
 *    area it is studied for rather than to a prefix made up for it.
 *
 * 2. THE NUMBER IS FREE. Every one was checked against every code the
 *    University has issued, and the test fails if an assignment ever lands on
 *    one. Two courses sharing a number is the worst thing a code register can
 *    do, because it stays invisible until two transcripts disagree.
 *
 * 3. THE ADVANCED COURSE SITS ABOVE THE INTRODUCTION, which is the faculty's
 *    own convention and not one adopted for the occasion: Homiletics BIS 320
 *    and Advance Homiletics BIS 340; Systematic Theology STT 400, 420, 440;
 *    Christology LC 110 and LC 120; Spiritual Leadership MDS 650 and 655.
 *
 * The hundred does NOT track the year of study, and it was tempting to make it.
 * On the University's own transcript Year One carries OTH 300, MW 300 and
 * NT 330 beside BIS 220 and LC 110 — the number sequences the subject area, not
 * the timetable. Imposing a year rule here would have produced a register that
 * disagreed with every transcript already issued.
 */
const ASSIGNED_CODES: { title: string; code: string; because: string }[] = [
  {
    title: 'Introduction to Biblical Studies',
    code: 'BIS 210',
    because: 'Biblical Studies, below Bible Survey I at BIS 220 — it is the course that opens '
      + 'the area.',
  },
  {
    title: 'Advanced Church History',
    code: 'CH 300',
    because: 'A level above CH 200, the code the registry issued for the introduction. The '
      + 'University has ruled that church history is taught as two courses.',
  },
  {
    title: 'Introduction to Biblical Hebrew',
    code: 'BIS 270',
    because: 'The languages are read for exegesis, so they sit in Biblical Studies rather than '
      + 'under a prefix invented for them. 270 and 280 keep the pair together and clear of the '
      + 'survey and doctrine courses at 220-260.',
  },
  {
    title: 'Introduction to New Testament Greek',
    code: 'BIS 280',
    because: 'The second of the language pair, beside Hebrew at BIS 270.',
  },
  {
    title: 'Advanced Hermeneutics',
    code: 'BIS 350',
    because: 'Above Hermeneutics at BIS 330, in the same relation as Advance Homiletics BIS 340 '
      + 'stands to Homiletics BIS 320.',
  },
  {
    title: 'Epistles Studies',
    code: 'BL 340',
    because: 'BL is the epistles area — Epistle I to IV run 300, 310, 130, 330 — and this course '
      + 'reads across them, so it follows the last of them.',
  },
  {
    title: 'Pneumatology',
    code: 'STT 410',
    because: 'A doctrine course, so Systematic Theology, between Systematic Theology I at 400 '
      + 'and II at 420 where it is taught.',
  },
  {
    title: 'Christian Ethics',
    code: 'MDS 660',
    because: 'Ministry studies, where the University already keeps Ministerial Ethics at MDS 640. '
      + 'It is not that course and does not take its number.',
  },
  {
    title: 'Spiritual Formation',
    code: 'MDS 670',
    because: 'Ministry studies, after Spiritual Leadership at 650 and 655.',
  },
  {
    title: 'Family Theology and Marriage Studies',
    code: 'MDS 730',
    because: 'Ministry studies, in the pastoral band with Parliamentary Laws 710, Social '
      + 'Psychology 720 and Churches Organisation 740.',
  },
  {
    title: 'African Theology and Contextual Theology',
    code: 'STT 430',
    because: 'Systematic Theology, between II at 420 and III at 440 — theology done '
      + 'systematically from a context, not a separate discipline.',
  },
  {
    title: 'Ecotheology and Creation Care',
    code: 'STT 450',
    because: 'Systematic Theology, after the third of the sequence at 440.',
  },
  {
    title: 'Bachelor Thesis and Defense',
    code: 'RM 560',
    because: 'The research area, after Research Method I at 540 and II at 550. The 2020 '
      + 'transcript prints the thesis with a blank code column; the University has since asked '
      + 'for these to be numbered, and the research sequence is where it lands.',
  },
];

const ASSIGNED_BY_TITLE: Record<string, string> =
  Object.fromEntries(ASSIGNED_CODES.map((a) => [a.title, a.code]));

/** The assignments with their reasoning, for a reference screen or a memo. */
export function assignedCodes(): { title: string; code: string; because: string }[] {
  return [...ASSIGNED_CODES];
}

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

  // LAST, AND ONLY AFTER EVERY REAL SOURCE HAS BEEN ASKED. An assignment must
  // never shadow a code the University itself issued.
  const assigned = ASSIGNED_BY_TITLE[title];
  if (assigned) return { code: assigned, source: 'assigned' };

  return null;
}

/**
 * The code to print for a course: the faculty's where it has one, the
 * programme's where it does not — and always saying which.
 */
export function facultyCode(title: string, programmeCode: string): FacultyCode {
  return registryCode(title) ?? { code: programmeCode, source: 'programme' };
}

/**
 * Every registry code the University has published, for a reference screen.
 *
 * ONE ROW PER CODE, because a code is one course. Where the University's
 * documents give that course two names — MDS 880 is "Faith" in the listing and
 * "Exegesis of Faith" on the 2020 transcript — the governing source's title
 * leads and the other is carried beside it. Two rows would read as two courses
 * sharing a number, which is the one thing a code register must not say.
 */
export function registryCodes(): { code: string; title: string; alsoKnownAs: string[] }[] {
  const byCode = new Map<string, { code: string; title: string; alsoKnownAs: string[] }>();
  for (const entry of Array.from(registryByTitle.values())) {
    const seen = byCode.get(entry.code);
    if (!seen) byCode.set(entry.code, { ...entry, alsoKnownAs: [] });
    else if (seen.title !== entry.title && !seen.alsoKnownAs.includes(entry.title)) {
      seen.alsoKnownAs.push(entry.title);
    }
  }
  return Array.from(byCode.values()).sort((a, b) => a.code.localeCompare(b.code));
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
