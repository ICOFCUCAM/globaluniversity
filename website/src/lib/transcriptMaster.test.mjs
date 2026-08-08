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
function bundle(source, name) {
  const outfile = join(dir, name);
  execFileSync('npx', [
    'esbuild', new URL(source, import.meta.url).pathname,
    '--bundle', '--format=esm', '--platform=node', `--outfile=${outfile}`, '--log-level=error',
    '--main-fields=module,main',
    `--alias:@=${new URL('..', import.meta.url).pathname.replace(/\/$/, '')}`,
  ]);
  return outfile;
}

const {
  masterFromCredential, splitHolderName, programmeProgress, formatIssued, paginate,
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

// THE CLOSING BLOCK COSTS A SLOT. Without that the totals print over the final
// Semester GPA row, which is what happened on a three-year record.
check('a one-year certificate is one sheet', paginate([yr(1)]).length, 1);
check('a two-year diploma is two sheets', paginate([yr(1), yr(2)]).length, 2);
check('a three-year bachelor’s is two sheets', paginate([yr(1), yr(2), yr(3)]).length, 2);
check('a four-year record is three sheets', paginate([yr(1), yr(2), yr(3), yr(4)]).length, 3);
check('a six-year record is four sheets',
  paginate([yr(1), yr(2), yr(3), yr(4), yr(5), yr(6)]).length, 4);

check('the closing block is on the last sheet and nowhere else',
  paginate([yr(1), yr(2), yr(3)]).map((s) => s.closing), [false, true]);
check('a one-year record closes on its only sheet',
  paginate([yr(1)]).map((s) => s.closing), [true]);
check('two years to a sheet, in order',
  paginate([yr(1), yr(2), yr(3)]).map((s) => s.years.map((y) => y.year)), [[1, 2], [3]]);

// A RECORD WITH NO YEARS STILL HAS A DOCUMENT. It prints one sheet carrying the
// closing block, rather than none at all — an empty page is visibly wrong,
// where no page is a blank screen nobody can diagnose.
check('an empty record is still one sheet', paginate([]).length, 1);
check('the specimen paginates to two sheets',
  paginate(SPECIMEN_TRANSCRIPT.years).length, 2);

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
  check('every course is a University course code', codes.every((c) => /^BTH\d{3}$/.test(c)), true);
  check('no course appears twice', new Set(codes).size, codes.length);
}



console.log('\nA closing block that needs its own sheet\n');

// TWO SLOTS FOR A CLOSE that also carries transfer credits, honours and a
// conferral. The pad is what stops it running over the fold.
check('three years and a full close is three sheets',
  paginate([yr(1), yr(2), yr(3)], 2).length, 3);
check('two years and a full close is two sheets',
  paginate([yr(1), yr(2)], 2).length, 2);
check('one year and a full close is two sheets',
  paginate([yr(1)], 2).length, 2);
check('the close is printed once and only once',
  paginate([yr(1), yr(2), yr(3)], 2).filter((s) => s.closing).length, 1);
check('…and it is the last sheet that carries it',
  paginate([yr(1), yr(2), yr(3)], 2).map((s) => s.closing), [false, false, true]);
// NO BLANK PAGE. The padded slot must not become a sheet with a page number
// and nothing on it.
check('the padded sheet still carries a year rather than being blank',
  paginate([yr(1), yr(2), yr(3)], 2).map((s) => s.years.length), [2, 1, 0]);
check('a one-slot close is unchanged by the new argument',
  paginate([yr(1), yr(2), yr(3)], 1).length, paginate([yr(1), yr(2), yr(3)]).length);

process.exit(failures === 0 ? 0 : 1);
