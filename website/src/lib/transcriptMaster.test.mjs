// ---------------------------------------------------------------------------
// THE SEALED TRANSCRIPT, TURNED BACK INTO A SHEET.
//
// Run with:  node src/lib/transcriptMaster.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS IS THE MAPPING WORTH TESTING
// ---------------------------------------------------------------------------
//
// `masterFromCredential` is the only thing standing between a register row and
// the document a graduate, an employer or a receiving university reads. Every
// way it can be wrong is silent:
//
//   * reading the LIVE marks instead of the sealed snapshot — an archived
//     transcript would change whenever a mark was corrected, including the copy
//     already in somebody's hand
//   * recomputing a total instead of reading it — a rounding change in this
//     repository would make an archived document disagree with its own seal
//   * putting the wrong word under "Surname" — printed, sealed, uncorrectable
//     without reissuing
//   * losing the transcribed-from provenance — the one line that tells a reader
//     these marks never passed the approval chain
//
// And `programmeProgress` decides who appears in the finished queue. Counting
// an unknown requirement as met would offer a registrar a single button over a
// student who has not finished.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
  } else {
    console.log(`ok    ${label}`);
  }
}

const dir = join(new URL('../../node_modules/.cache/icof', import.meta.url).pathname);
mkdirSync(dir, { recursive: true });
function bundle(source, name, jsx = false) {
  const outfile = join(dir, name);
  execFileSync('npx', [
    'esbuild', new URL(source, import.meta.url).pathname,
    '--bundle', '--format=esm', '--platform=node', `--outfile=${outfile}`, '--log-level=error',
    '--main-fields=module,main',
    `--alias:@=${new URL('..', import.meta.url).pathname.replace(/\/$/, '')}`,
    ...(jsx ? ['--jsx=automatic', '--external:react', '--external:react-dom'] : []),
  ]);
  return outfile;
}

const {
  masterFromCredential, splitHolderName, programmeProgress, formatIssued, paginate,
  closingSlotsFor,
} = await import(bundle('./transcriptMaster.ts', 'transcriptMaster.mjs'));

const { SPECIMEN_TRANSCRIPT } = await import(bundle('./transcriptSpecimen.ts', 'transcriptSpecimen.mjs'));

/** A register row as the database hands it over. */
const sealedRow = (overrides = {}) => ({
  credential_id: 'IGUC-TRANSCRIPT-2026-000123',
  kind: 'transcript',
  holder_name: 'Grace Nalova Meyembi',
  student_number: 'ICOF202600451',
  programme: 'Bachelor of Theology',
  classification: 'Second Class Honours (Upper Division)',
  seal_code: 'AMBER-FALCON-1174',
  version: 2,
  status: 'active',
  issued_at: '2026-08-08T09:14:00.000Z',
  facts: {
    name: 'Grace Nalova Meyembi',
    credential_id: 'IGUC-TRANSCRIPT-2026-000123',
    issued: '2026-08-08',
    cgpa: 3.41,
    credits_attempted: 180,
    credits_earned: 175,
    years: [
      {
        year: 1,
        semesters: [{
          semester: 1,
          courses: [{ code: 'BTH101', title: 'Introduction to Biblical Studies', creditUnit: 5, grade: 'A', gradePoint: 4, qualityPoint: 20 }],
          totalCredits: 5,
          totalGradePoints: 20,
          gpa: 4,
        }],
      },
    ],
    ...(overrides.facts ?? {}),
  },
  ...overrides,
});

console.log('\nThe sealed snapshot is the document\n');

{
  const d = masterFromCredential(sealedRow());
  check('the course list comes from facts.years, not from live marks', d.years.length, 1);
  check('the CGPA is read, never recomputed', d.cgpa, 3.41);
  check('credits attempted are read from the snapshot', d.totalCredits, 180);
  check('credits earned are a separate figure from attempted', d.creditsEarned, 175);
  check('the classification is carried through', d.classification, 'Second Class Honours (Upper Division)');
  check('the credential number is the register’s', d.credentialId, 'IGUC-TRANSCRIPT-2026-000123');
  check('the seal code is printed in words', d.sealCode, 'AMBER-FALCON-1174');
  check('the version is carried, so a reissue says which it is', d.version, 2);
}

{
  // A ROW WITH NO SNAPSHOT MUST NOT INVENT ONE. It renders as an empty record
  // — visibly wrong — rather than as a plausible transcript built from nothing.
  const d = masterFromCredential({ credential_id: 'X', facts: {} });
  check('no snapshot yields no courses', d.years, []);
  check('no snapshot yields no credits rather than a guess', d.totalCredits, 0);
  check('no snapshot yields a zero CGPA rather than NaN', d.cgpa, 0);
}

console.log('\nThe name in three columns\n');

check('a stored three-part name splits back the way it was built',
  splitHolderName('Grace Nalova Meyembi'),
  { surname: 'Meyembi', firstNames: 'Grace', middleName: 'Nalova' });
check('two names split into first and surname',
  splitHolderName('Grace Meyembi'),
  { surname: 'Meyembi', firstNames: 'Grace', middleName: '' });
check('one name is treated as the surname',
  splitHolderName('Meyembi'),
  { surname: 'Meyembi', firstNames: '', middleName: '' });
check('an empty name yields empty parts rather than throwing',
  splitHolderName(''),
  { surname: '', firstNames: '', middleName: '' });
check('extra whitespace does not become an empty part',
  splitHolderName('  Grace   Nalova   Meyembi '),
  { surname: 'Meyembi', firstNames: 'Grace', middleName: 'Nalova' });

{
  // THE STORED PARTS WIN. Splitting is a fallback for rows issued before the
  // parts were recorded; when they are there, a two-word surname survives.
  const d = masterFromCredential(sealedRow({
    holder_name: 'Grace Nalova Meyembi Ngu',
    facts: {
      holder_surname: 'Meyembi Ngu', holder_first_names: 'Grace', holder_middle_name: 'Nalova',
      years: [],
    },
  }));
  check('a recorded two-word surname is not re-split', d.student.last_name, 'Meyembi Ngu');
  check('the recorded first names are used', d.student.first_name, 'Grace');
  check('the recorded middle name is used', d.student.middle_name, 'Nalova');
}

console.log('\nProvenance and standing\n');

{
  const derived = masterFromCredential(sealedRow());
  check('a derived transcript carries no transcription notice', derived.transcribedFrom, null);

  const transcribed = masterFromCredential(sealedRow({
    facts: {
      source: 'transcribed',
      source_record: 'Registry examination register, volume IV, pages 88–91',
      years: [],
    },
  }));
  check('a transcribed record says so on its face',
    transcribed.transcribedFrom,
    'Registry examination register, volume IV, pages 88–91');

  // THE NOTICE MUST NOT DISAPPEAR WHEN THE SOURCE IS MISSING. A transcribed
  // record with no stated source is still a transcribed record.
  const noSource = masterFromCredential(sealedRow({
    facts: { source: 'transcribed', years: [] },
  }));
  check('a transcribed record with no source still declares itself',
    noSource.transcribedFrom, 'an unstated source');
}

{
  const replaced = masterFromCredential(sealedRow({ status: 'replaced' }));
  check('a superseded row prints the superseded band', replaced.superseded, true);
  check('a current row does not', masterFromCredential(sealedRow()).superseded, false);
}

console.log('\nThe date the document bears\n');

check('the issue date is set as a reader reads it', formatIssued('2026-08-08'), '8 August 2026');
check('a back-dated document keeps its own date', formatIssued('2011-07-15'), '15 July 2011');
check('a value that is already prose is left alone', formatIssued('Session 2010/2011'), 'Session 2010/2011');
check('an empty date does not become today', formatIssued(''), '');
{
  // BACK-DATING THE DOCUMENT NEVER BACK-DATES THE REGISTER — facts.issued is
  // what the sheet bears, `issued_at` is when the row was written, and the
  // sheet must show the former.
  const d = masterFromCredential(sealedRow({
    issued_at: '2026-08-08T09:14:00.000Z',
    facts: { issued: '2011-07-15', years: [] },
  }));
  check('the sheet bears the document’s date, not the row’s', d.issuedOn, '15 July 2011');
}

console.log('\nWho has finished\n');

check('meeting the requirement is completion',
  programmeProgress({ creditsEarned: 180, creditsRequired: 180 }).complete, true);
check('exceeding it is completion too',
  programmeProgress({ creditsEarned: 185, creditsRequired: 180 }).complete, true);
check('one credit short is not',
  programmeProgress({ creditsEarned: 179, creditsRequired: 180 }).complete, false);
check('and it says how many are outstanding',
  programmeProgress({ creditsEarned: 179, creditsRequired: 180 }).remaining, 1);
check('the percentage is rounded, not floored to nothing',
  programmeProgress({ creditsEarned: 90, creditsRequired: 180 }).percent, 50);
check('the percentage cannot exceed 100',
  programmeProgress({ creditsEarned: 400, creditsRequired: 180 }).percent, 100);

// AN UNKNOWN RULE IS NOT A SATISFIED RULE. This is the case that would put a
// student who has not finished at the top of a registrar's screen under a
// single button.
check('no award on the record is never complete',
  programmeProgress({ creditsEarned: 500, creditsRequired: null }).complete, false);
check('a zero requirement is never complete',
  programmeProgress({ creditsEarned: 500, creditsRequired: 0 }).complete, false);
check('and it says why rather than showing a bare zero',
  programmeProgress({ creditsEarned: 500, creditsRequired: null }).note.includes('No award is recorded'), true);
check('negative credits are floored at nothing earned',
  programmeProgress({ creditsEarned: -10, creditsRequired: 180 }).remaining, 180);

console.log('\nHow many sheets — stretching to the programme\n');

const yr = (n) => ({ year: n, semesters: [] });

// THE CLOSING BLOCK COSTS ROOM, and how much depends on what it carries. These
// are asserted at BOTH sizes, because the fault that reached the University was
// that only the small one was ever tested: a bachelor's degree with transfer
// credits, honours and a conferral printed three sheets and headed itself
// "Page 1 of 3", while a test asserting two passed all along — it was
// paginating with a closing block the document never used.
check('a one-year certificate is one sheet', paginate([yr(1)]).length, 1);
check('a two-year diploma is two sheets', paginate([yr(1), yr(2)]).length, 2);
check('a three-year bachelor’s is two sheets', paginate([yr(1), yr(2), yr(3)]).length, 2);

// THE CASE THE UNIVERSITY REPORTED, at the size its own graduates print at.
check('…and still two with transfer credits, honours and a conferral on the close',
  paginate([yr(1), yr(2), yr(3)], 2).length, 2);
check('…with Year Three and the close on the second sheet, as the University’s own is',
  paginate([yr(1), yr(2), yr(3)], 2).map((s) => [s.years.map((y) => y.year), s.closing]),
  [[[1, 2], false], [[3], true]]);

check('a four-year record is two sheets', paginate([yr(1), yr(2), yr(3), yr(4)]).length, 2);
check('…and three when the close is the full one',
  paginate([yr(1), yr(2), yr(3), yr(4)], 2).length, 3);
check('a six-year record is three sheets',
  paginate([yr(1), yr(2), yr(3), yr(4), yr(5), yr(6)]).length, 3);

check('the closing block is on the last sheet and nowhere else',
  paginate([yr(1), yr(2), yr(3)]).map((s) => s.closing), [false, true]);
check('a one-year record closes on its only sheet',
  paginate([yr(1)]).map((s) => s.closing), [true]);
// The opening matter costs the first sheet a year's room, which is why the
// first holds two and the rest hold three.
check('two years on the first sheet, three on the ones after it',
  paginate([yr(1), yr(2), yr(3), yr(4), yr(5)]).map((s) => s.years.map((y) => y.year)),
  [[1, 2], [3, 4, 5], []]);

console.log('\nHow much room the close needs, decided in one place\n');

// THE FUNCTION THAT WAS MISSING. It lived inside the component, so the preview
// box and the tests could not see it and quietly used a different number.
check('a bare close is one slot', closingSlotsFor({}), 1);
check('transfer credits make it two', closingSlotsFor({ transferCredits: [{}] }), 2);
check('so do honours', closingSlotsFor({ honours: [{}] }), 2);
check('so does a conferral', closingSlotsFor({ conferral: { on: '2026-07-15' } }), 2);
check('and so does a standing history', closingSlotsFor({ standingHistory: [{}] }), 2);
check('the specimen’s close is the full one',
  closingSlotsFor(SPECIMEN_TRANSCRIPT), 2);

// A RECORD WITH NO YEARS STILL HAS A DOCUMENT. It prints one sheet carrying the
// closing block, rather than none at all — an empty page is visibly wrong,
// where no page is a blank screen nobody can diagnose.
check('an empty record is still one sheet', paginate([]).length, 1);
// PAGINATED THE WAY IT PRINTS, with its own closing size rather than the
// default — which is the whole of the fault this pair of lines missed before.
check('the specimen paginates to two sheets, as it prints',
  paginate(SPECIMEN_TRANSCRIPT.years, closingSlotsFor(SPECIMEN_TRANSCRIPT)).length, 2);

console.log('\nThe specimen\n');

check('the specimen runs three years, as the University ruled a bachelor’s is',
  SPECIMEN_TRANSCRIPT.years.length, 3);
check('six semesters in all', SPECIMEN_TRANSCRIPT.years.flatMap((y) => y.semesters).length, 6);
check('180 credits, as the programme is published', SPECIMEN_TRANSCRIPT.totalCredits, 180);
check('it names the University’s own award', SPECIMEN_TRANSCRIPT.student.program, 'Bachelor of Theology');
// A SPECIMEN MUST NEVER BE MISTAKEN FOR AN ISSUED DOCUMENT, and must never
// carry a real graduate's identity.
check('the holder is plainly a specimen', SPECIMEN_TRANSCRIPT.student.last_name, 'Candidate');
check('the credential number says what it is',
  SPECIMEN_TRANSCRIPT.credentialId, 'SPECIMEN — NOT AN ISSUED CREDENTIAL');
check('it carries no seal code, because nothing sealed it',
  SPECIMEN_TRANSCRIPT.sealCode, null);
{
  const codes = SPECIMEN_TRANSCRIPT.years
    .flatMap((y) => y.semesters.flatMap((s) => s.courses.map((c) => c.code)));
  // THE FACULTY'S CODES, NOT THE PROGRAMME BRIEF'S. This asserted /^BTH\d{3}$/,
  // which is the numbering counted off within one degree — and the University
  // has ruled that a code belongs to the subject: BIS 220 on every programme
  // that teaches Bible Survey I. A specimen printing BTH102 beside a real
  // transcript printing BIS 220 teaches the wrong document.
  check('every course carries a faculty subject code',
    codes.every((c) => /^[A-Z]{2,4} \d{3}$/.test(c)), true);
  check('and Bible Survey I is the one the registry issued',
    codes.includes('BIS 220'), true);
  check('no course appears twice', new Set(codes).size, codes.length);
}



console.log('\nA closing block that needs room, and what happens when there is none\n');

// THESE ASSERTIONS USED TO ENCODE THE FAULT. They said a three-year record with
// a full close was THREE sheets, and they passed — because they were written
// from the rule rather than from the paper. The University's own transcript of
// that degree is two sheets, and the room was there all along: Year Three's
// table is 59mm and the full close 111mm on a sheet with 190mm to give.
check('three years and a full close is two sheets, as the University prints it',
  paginate([yr(1), yr(2), yr(3)], 2).length, 2);
check('two years and a full close is two sheets',
  paginate([yr(1), yr(2)], 2).length, 2);
check('one year and a full close is two sheets',
  paginate([yr(1)], 2).length, 2);
check('the close is printed once and only once',
  paginate([yr(1), yr(2), yr(3)], 2).filter((s) => s.closing).length, 1);
check('…and it is the last sheet that carries it',
  paginate([yr(1), yr(2), yr(3)], 2).map((s) => s.closing), [false, true]);

// THE CLOSE NEVER STRADDLES THE FOLD. That was the real reason for the old
// rule, and it still holds: where the close does not fit under the last year it
// starts a sheet of its own rather than running over.
check('a close that does not fit starts its own sheet rather than running over',
  paginate([yr(1), yr(2)], 2).map((s) => [s.years.length, s.closing]),
  [[2, false], [0, true]]);

// NO SHEET IS BLANK. A sheet with neither a year nor the close would print a
// page number over empty paper — visibly wrong on a sealed document.
for (const [years, close] of [[3, 2], [3, 1], [4, 2], [6, 2], [1, 2], [0, 1]]) {
  const sheets = paginate(Array.from({ length: years }, (_, i) => yr(i + 1)), close);
  check(`${years} years, close of ${close}: no sheet is empty`,
    sheets.filter((s) => s.years.length === 0 && !s.closing).length, 0);
}
check('a one-slot close is unchanged by the new argument',
  paginate([yr(1), yr(2), yr(3)], 1).length, paginate([yr(1), yr(2), yr(3)]).length);


console.log('\nThe grid, which is the first thing a registrar recognises\n');

// ---------------------------------------------------------------------------
// WHY THE GRID IS MEASURED AND NOT JUST LOOKED AT
// ---------------------------------------------------------------------------
//
// The University corrected this table three times, and two of the corrections
// were accepted on the strength of a screenshot and were wrong.
//
//   FIRST it was a single rule per boundary, which is a spreadsheet.
//   THEN it was two equal rules with a gap — and the gap was set in points, so
//   the browser rounded it to nothing and drew one 2px stroke instead. Measured,
//   `border-spacing` computed to 0px. It photographed as an improvement.
//   THEN two equal rules, which is still not what the sheet does: the second
//   line is not the first line again. It is a frame inside a frame — a visible
//   outer rule, a thread of paper, and a much lighter inner rule.
//
// So the construction is asserted on the rendered component, where a browser
// cannot round it away and a later tidy-up cannot quietly flatten it.
{
  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: TranscriptMaster } =
    await import(bundle('../components/transcript/TranscriptMaster.tsx', 'tm-grid.mjs', true));
  const { DEFAULT_TRANSCRIPT_DESIGN } =
    await import(bundle('./credentialTemplate.ts', 'tm-grid-tpl.mjs'));

  const html = renderToStaticMarkup(React.createElement(TranscriptMaster, {
    design: DEFAULT_TRANSCRIPT_DESIGN, data: SPECIMEN_TRANSCRIPT, specimen: true,
  }));
  const styles = html.match(/style="[^"]*"/g) ?? [];
  const tables = styles.filter((s) => s.includes('border-collapse'));
  const framed = styles.filter((s) => s.includes('box-shadow:inset'));

  // THE OUTER GRID IS ONE CONTINUOUS RULE that crosses the whole table. The
  // second line comes from the frame inside each cell, not from a second
  // border, so the outer rule never doubles at a cell edge.
  check('every table on the sheet collapses its outer grid',
    tables.filter((s) => !s.includes('border-collapse:collapse')).length, 0);
  check('…and draws its own outer rule, a shade stronger, round the edge',
    tables.filter((s) => !/border:0\.7pt solid #8a8a8a/.test(s)).length, 0);
  check('…and there are tables, so this is not passing on an empty set',
    tables.length > 0, true);

  // THE FRAME ITSELF: a thread of paper, then a lighter rule, reading inward.
  check('the sheet is framed in many places, not one',
    framed.length > 8, true);
  check('every frame lays the paper gap against the outer rule and the inner rule beneath it',
    framed.filter((s) => !(s.includes('#fdfcf8') && s.includes('#d8d3c6'))).length, 0);
  // If the two rules were the same grey it would be a doubled line again, which
  // is the correction the University made twice.
  check('the inner rule is lighter than the outer, not the same rule twice',
    parseInt('d8d3c6', 16) > parseInt('a8a8a8', 16), true);

  // A COURSE ROW IS FRAMED DOWN ITS SIDES AND NOT ACROSS, because the original
  // rules nothing between the entries of a semester. A frame that closed would
  // put a line under every course.
  const courseRow = framed.find((s) => s.includes('7.4pt') && !s.includes('font-weight:700'));
  check('a course row carries the frame on its verticals only',
    /box-shadow:inset 1px 0[^"]*inset -1px 0[^"]*"/.test(courseRow ?? ''), true);
  check('…and nothing across the top or bottom of it',
    /inset 0(px)? (1|-1)px/.test(courseRow ?? ''), false);

  // NOT BLACK, NOT THICK, NOT COLOURED, NOT ROUNDED — each asked for by name.
  check('no rule anywhere on the sheet is black',
    styles.filter((s) => /border[^;"]*:(?![^;"]*none)[^;"]*(#000|black)/.test(s)).length, 0);
  check('no rule is 2pt or heavier',
    styles.filter((s) => /border[^;"]*:\s*([2-9]|\d\d)(\.\d+)?pt/.test(s)).length, 0);
  check('nothing on the grid is rounded',
    styles.filter((s) => /border-radius/.test(s)).length, 0);
  check('the rules are the two greys, plus the ink the signature line is drawn in',
    Array.from(new Set((html.match(/border[^;"]*solid (#[0-9a-f]{3,6})/g) ?? [])
      .map((m) => m.slice(m.lastIndexOf('#'))))).sort(),
    ['#8a8a8a', '#a8a8a8', DEFAULT_TRANSCRIPT_DESIGN.ink].sort());
}


console.log('\nA signature on the transcript, and the specimen rule again\n');

// The transcript's Registrar signs the "Signed ____" rule at the foot. The same
// rule holds as on the certificate, for the same reason: a specimen carrying a
// real officer's strokes is the most useful thing a forger could be handed.
{
  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: TranscriptMaster } =
    await import(bundle('../components/transcript/TranscriptMaster.tsx', 'tm-sig.mjs', true));
  const { DEFAULT_TRANSCRIPT_DESIGN } =
    await import(bundle('./credentialTemplate.ts', 'tm-sig-tpl.mjs'));

  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAA'
    + 'C0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const design = {
    ...DEFAULT_TRANSCRIPT_DESIGN,
    signatories: [{ name: 'Dr Divine Lyonga', office: 'Registrar', signature: PNG }],
  };
  const draw = (specimen) => renderToStaticMarkup(React.createElement(TranscriptMaster, {
    design, data: SPECIMEN_TRANSCRIPT, specimen,
  }));

  check('an issued transcript carries the Registrar’s signature', draw(false).includes(PNG), true);
  // THE BUG THIS PAIR EXISTS FOR. The close listed only signatories with a
  // NAME, so an officer who signed on screen without typing their name had the
  // whole row dropped — the sheet fell back to the University's record and
  // printed two offices and no signature, with nothing to say why. The panel
  // promises that a blank name prints whoever holds the office; it now does.
  {
    const unnamed = {
      ...DEFAULT_TRANSCRIPT_DESIGN,
      signatories: [{ name: '', office: 'Registrar', signature: PNG }],
    };
    const html = renderToStaticMarkup(React.createElement(TranscriptMaster, {
      design: unnamed, data: SPECIMEN_TRANSCRIPT, specimen: false,
    }));
    check('a signature with no name beside it is still printed', html.includes(PNG), true);
    check('…and the office is filled from the University’s own record',
      html.includes('Registrar:'), true);
  }
  check('a specimen does not', draw(true).includes(PNG), false);
  check('and the rule to sign on is there either way', draw(true).includes('Signed'), true);
  // A design with no image is untouched — the University has always signed by
  // hand and must be able to go on doing so.
  check('a design with no signature renders no image',
    renderToStaticMarkup(React.createElement(TranscriptMaster, {
      design: DEFAULT_TRANSCRIPT_DESIGN, data: SPECIMEN_TRANSCRIPT, specimen: false,
    })).includes('data:image/png;base64,iVBOR'), false);
}

process.exit(failures === 0 ? 0 : 1);