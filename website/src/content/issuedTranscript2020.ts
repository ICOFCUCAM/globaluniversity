// ---------------------------------------------------------------------------
// THE COURSE CODES ON A TRANSCRIPT THE UNIVERSITY ISSUED.
//
// Read from an official academic transcript of ICOF Global University College,
// dated 15 January 2020, for a Bachelor of Theology completed in 2011. The
// University supplied the document and directed that these codes be entered,
// and that where this transcript and the later course listing disagree, THIS
// DOCUMENT GOVERNS.
//
// ---------------------------------------------------------------------------
// WHY A SEPARATE FILE, AND WHY IT SAYS WHERE EVERY LINE CAME FROM
// ---------------------------------------------------------------------------
//
// These codes were not sent as a list. They were read off a scanned sheet, and
// that is a different kind of evidence from a table somebody typed and checked:
// a scan can be misread, and MDS against MPR or 760 against 780 is one pixel of
// difference on a page that has been photocopied and photographed.
//
// So they are kept apart from the material the University typed out, each line
// carries the title EXACTLY as the transcript prints it — "Advance Homiletics",
// "ICT & Globalization.", "Churches Org & Adm", trailing full stop and all —
// and the ones that are hard to read are named at the bottom rather than
// quietly settled. A code on a sealed transcript should be traceable to a line
// on a document somebody can hold, and this file is where that trace lives.
//
// NOTHING HERE IS A CURRICULUM. The programme those courses were read on is
// the superseded 139-credit-hour Bachelor; the award is the 180-ECTS structure.
// What survives from this document is the faculty's numbering, which is the
// same numbering the University still uses.
// ---------------------------------------------------------------------------

export interface IssuedCode {
  code: string;
  /** The course title as the transcript prints it, not as we would write it. */
  title: string;
  /** Where on the sheet it was read. */
  where: string;
}

/**
 * Year Three, both semesters, as printed.
 *
 * The University asked for these specifically: Year Three was never included
 * in the course listing supplied to this project, so before this file every
 * third-year subject on the Bachelor of Theology was awaiting a faculty code.
 */
export const ISSUED_2020_YEAR_THREE: IssuedCode[] = [
  { code: 'BIS 330', title: 'Hermeneutics', where: 'Year Three, First Semester 10-2011' },
  { code: 'BIS 490', title: 'Eschatology', where: 'Year Three, First Semester 10-2011' },
  { code: 'BL 330', title: 'Epistle IV', where: 'Year Three, First Semester 10-2011' },
  { code: 'CDS 100', title: 'Acts of Apostles', where: 'Year Three, First Semester 10-2011' },
  { code: 'MDS 655', title: 'Spiritual Leadership II', where: 'Year Three, First Semester 10-2011' },
  { code: 'MDS 740', title: 'Churches Org & Adm', where: 'Year Three, First Semester 10-2011' },
  { code: 'STT 420', title: 'Systematic Theology II', where: 'Year Three, First Semester 10-2011' },
  { code: 'MDS 820', title: 'ICT & Globalization', where: 'Year Three, First Semester 10-2011' },

  { code: 'BIS 340', title: 'Advance Homiletics', where: 'Year Three, Second Semester 2011' },
  { code: 'MDS 880', title: 'Exegesis of Faith', where: 'Year Three, Second Semester 2011' },
  { code: 'MW 350', title: 'Missiology', where: 'Year Three, Second Semester 2011' },
  { code: 'MDS 760', title: 'Demonology', where: 'Year Three, Second Semester 2011' },
  { code: 'MDS 710', title: 'Parliamentary Laws', where: 'Year Three, Second Semester 2011' },
  { code: 'STT 440', title: 'Systematic Theology III', where: 'Year Three, Second Semester 2011' },
  { code: 'MDS 800', title: 'Practical Holiness', where: 'Year Three, Second Semester 2011' },
  { code: 'MDS 810', title: 'Poetical Books (Wisdom Literature)', where: 'Year Three, Second Semester 2011' },
  // The thesis carries NO CODE on the transcript — five credits, a grade point,
  // and a blank in the code column. It is left blank here too. A thesis is the
  // one line on a transcript nobody would question, and inventing a number for
  // it to look tidy would be inventing a number.
];

/**
 * Codes from earlier years of the same document that settle something the
 * later listing left open or contradicted.
 *
 * NOT A FULL TRANSCRIPTION of Years One and Two — the listing already covers
 * those, and re-reading forty codes off a scan to confirm forty codes that were
 * typed out is how a misreading gets in.
 */
export const ISSUED_2020_EARLIER: IssuedCode[] = [
  // The listing supplied to this project stops at Research Methodology I.
  { code: 'RM 550', title: 'Research Method II', where: 'Year Two, Second Semester 2010' },
  // The psychology course the Bachelor still teaches. It is on the transcript
  // and in neither listing, so without this line the subject would have been
  // given a new number while the University's own number sat unused.
  { code: 'MDS 720', title: 'Social Psychology and Human Relation', where: 'Year One, Second Semester 2009' },
  // THE UNIVERSITY HAS RULED THAT THIS DOCUMENT GOVERNS. The later listing
  // gives EN 101 for Use of English; the transcript prints MA 210, and the same
  // sheet uses EN 140 for Creative Writings — so the two codes are not a
  // misreading of one another and the disagreement is real.
  { code: 'MA 210', title: 'Use of English', where: 'Year One, First Semester 08-2009' },
];

export const ISSUED_2020 = [...ISSUED_2020_YEAR_THREE, ...ISSUED_2020_EARLIER];

/**
 * Lines on the sheet that could not be read with enough confidence to enter,
 * kept here rather than dropped so the University can settle them from the
 * paper rather than from a screen.
 *
 * A code omitted costs a course its faculty number, which is visible and
 * fixable. A code guessed costs a graduate a transcript that says something the
 * registry never said, which is neither.
 */
export const ISSUED_2020_UNCERTAIN: { reading: string; against: string; note: string }[] = [
  {
    reading: 'MDS 520 — Spiritual Gifts I, Year Two Second Semester',
    against: 'MPR 520 in the course listing supplied to this project',
    note:
      'Three letters at the smallest size on the sheet, in a column where the two lines above '
      + 'both read MDS. The number agrees; only the prefix is in doubt, and a prefix is exactly '
      + 'what the University asked to be got right. Left as MPR 520 until the paper is checked.',
  },
];
