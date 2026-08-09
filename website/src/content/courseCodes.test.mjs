// ---------------------------------------------------------------------------
// ONE CODE PER SUBJECT — is a course numbered the same on every programme, and
// is every code on a transcript one the University actually issued?
//
// Run with:  node src/content/courseCodes.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
//
// The University asked why its transcript screen was offering BTH101, BTH102,
// BTH103 when its own transcripts have always read BIS 220, BIS 230, BIS 250 —
// a code that says which subject area a course belongs to and at what level,
// and that stays the same when the course is read on another programme.
//
// Both sets came from the University: the first from the 180-ECTS development
// brief, the second from the registry listings. The registry scheme governs,
// and this file holds the two properties that make it worth having:
//
//   A SUBJECT IS NUMBERED ONCE. Bible Doctrine I is BIS 250 on the Diploma and
//   BIS 250 on the Bachelor. If it were not, the code would be decoration.
//
//   NO CODE IS INVENTED. Twenty-four subjects on the 180-ECTS structure have no
//   registry code yet, and the tempting thing — deriving one from the subject
//   area and the year — would put a number on a sealed transcript that no
//   faculty ever assigned and that nobody could tell from a real one.
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
  const out = join(dir, name);
  execFileSync('npx', [
    'esbuild', new URL(source, import.meta.url).pathname,
    '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error',
    `--alias:@=${new URL('..', import.meta.url).pathname.replace(/\/$/, '')}`,
  ]);
  return out;
}

const { registryCode, facultyCode, registryCodes, subjectPrefixes, codeDisagreements, assignedCodes } =
  await import(bundle('./courseCodes.ts', 'course-codes.mjs'));
const { ISSUED_2020, ISSUED_2020_UNCERTAIN } =
  await import(bundle('./issuedTranscript2020.ts', 'course-codes-2020.mjs'));
const { coursesForProgramme, codesNotFromRecord } =
  await import(bundle('./programmeCourses.ts', 'course-codes-prog.mjs'));
const { curricula, supersededBthSchedule } = await import(bundle('./curricula.ts', 'course-codes-cur.mjs'));

const bth = coursesForProgramme('Bachelor of Theology');
const dip = coursesForProgramme('Diploma of Theology');
const bmin = coursesForProgramme('Bachelor of Ministry');

console.log('\nA subject is numbered once, whichever programme reads it\n');

const codeOf = (schedule, title) => schedule.courses.find((c) => c.title === title)?.code ?? null;

// THE CASE THE UNIVERSITY RAISED. Same subject, two programmes, one code.
check('Bible Doctrine I is BIS 250 on the Diploma', codeOf(dip, 'Bible Doctrine I'), 'BIS 250');
check('…and BIS 250 on the Bachelor of Theology', codeOf(bth, 'Bible Doctrine I'), 'BIS 250');
check('Christology I is LC 110 on both',
  [codeOf(dip, 'Christology I'), codeOf(bth, 'Christology I')], ['LC 110', 'LC 110']);

// The subject-area prefix is the point of the scheme: it says where a course
// sits in the faculty, which a number counted off within one degree cannot.
check('Bible Survey I carries the biblical-studies prefix', codeOf(bth, 'Bible Survey I'), 'BIS 220');
check('Systematic Theology I carries the systematic-theology prefix',
  codeOf(bth, 'Systematic Theology I'), 'STT 400');
check('Research Methodology I carries the research prefix',
  codeOf(bth, 'Research Methodology I'), 'RM 540');

// Wording differences are not identity differences: the registry lists
// "Pentateuch", the 180-ECTS structure "Pentateuch Studies", and it is one
// subject. The match is recorded so a registrar can challenge it.
check('a course matched through a wording difference says what it matched',
  registryCode('Pentateuch Studies'), { code: 'OT 300', source: 'registry', matchedTo: 'Pentateuch' });

console.log('\nAnd no code is invented\n');

// EVERY REGISTRY CODE TRACES BACK TO THE UNIVERSITY'S OWN LISTING. This is the
// guard that matters: it fails the moment a code is written into the mapping
// file by hand.
const supplied = new Set();
for (const c of [...curricula, supersededBthSchedule]) for (const t of c.terms) for (const co of t.courses) supplied.add(co.code);
// The transcript the University issued is a supplied source too — the codes on
// it are the faculty's, read off a document the University sealed.
for (const c of ISSUED_2020) supplied.add(c.code);

const registrySourced = [...bth.courses, ...dip.courses, ...bmin.courses]
  .filter((c) => c.codeSource === 'registry');
check('every registry code on every schedule was supplied by the University',
  registrySourced.filter((c) => !supplied.has(c.code)).map((c) => c.code), []);
check('…and there are some, so the check is not passing on an empty set',
  registrySourced.length > 0, true);

// The other half: a subject the registry has not numbered keeps the programme's
// own code and is MARKED as such, rather than being handed something that looks
// like a faculty code.
const notFromRecord = codesNotFromRecord(bth);
check('every code not read off a document is marked as assigned here',
  notFromRecord.every((c) => c.codeSource === 'assigned'), true);
check('…and they are named rather than hidden', notFromRecord.length > 0, true);
check('Pneumatology was never on a University document',
  registryCode('Pneumatology')?.source, 'assigned');

console.log('\nYear Three, from the transcript the University issued in 2020\n');

// THE CODES THAT WERE MISSING. Year Three was never in the listing supplied to
// this project, so before the transcript was read every third-year subject on
// the Bachelor stood in with a programme code.
for (const [title, expected] of [
  ['Advanced Homiletics', 'BIS 340'],
  ['Systematic Theology II', 'STT 420'],
  ['Missiology and Global Christianity', 'MW 350'],
  ['Spiritual Warfare and Demonology', 'MDS 760'],
  ['Acts and Apostolic Mission', 'CDS 100'],
  ['ICT, Technology and Global Ministry', 'MDS 820'],
  ['Research Methodology II', 'RM 550'],
]) {
  check(`${title} is ${expected}`, codeOf(bth, title), expected);
}

// THE THESIS IS PRINTED WITH A BLANK CODE COLUMN on the 2020 sheet, so nothing
// was read for it — and it is not silently given one either. It is numbered in
// the assignment table, under the University's instruction, in the research
// sequence, with the reasoning beside it.
check('the thesis is not given a code the transcript does not show',
  ISSUED_2020.some((c) => /thesis/i.test(c.title)), false);
check('…it is numbered as an assignment instead, and says so',
  registryCode('Bachelor Thesis and Defense'), { code: 'RM 560', source: 'assigned' });

// Every code entered from the sheet is traceable to a named place on it, so a
// registrar can go back to the paper rather than to a decision nobody recorded.
check('every code read from the transcript says where on the sheet it was read',
  ISSUED_2020.filter((c) => !c.where || !c.title).map((c) => c.code), []);
check('and the lines that could not be read confidently are kept, not dropped',
  ISSUED_2020_UNCERTAIN.length > 0, true);

console.log('\nWhere two of the University’s documents disagree, the 2020 transcript governs\n');

// THE UNIVERSITY'S RULING. The listing says Use of English is EN 101; the
// transcript it sealed and a graduate has been carrying says MA 210.
check('Use of English is the code the issued transcript prints',
  codeOf(dip, 'Use of English'), 'MA 210');
{
  const clash = codeDisagreements().find((d) => d.title === 'Use of English');
  check('the disagreement is reported rather than swallowed', Boolean(clash), true);
  check('…with the transcript’s code governing', clash?.governing, 'MA 210');
  check('…and the listing’s code still named', clash?.also, ['EN 101']);
}

console.log('\nThe subjects the University asked to have numbered\n');

// EVERY COURSE ON THE PROGRAMME NOW CARRIES A SUBJECT CODE. Before this, a
// third of the Bachelor printed BTH2xx — a number counted off within one degree
// — beside courses numbered by the faculty.
check('no course on the Bachelor still carries a programme number',
  bth.courses.filter((c) => c.codeSource === 'programme').map((c) => c.title), []);

// THE RULE THAT MATTERS MOST. An assigned number that collides with an issued
// one gives two courses the same code, and nothing shows it until two
// transcripts disagree about what BIS 340 was.
{
  const issued = new Set();
  for (const c of [...curricula, supersededBthSchedule]) {
    for (const t of c.terms) for (const co of t.courses) issued.add(co.code);
  }
  for (const c of ISSUED_2020) issued.add(c.code);
  check('no assigned code lands on one the University has issued',
    assignedCodes().filter((a) => issued.has(a.code)).map((a) => a.code), []);
  check('…and no two assignments collide with each other',
    assignedCodes().length, new Set(assignedCodes().map((a) => a.code)).size);
}

// NOT ONE NEW SUBJECT AREA. A number inside an existing prefix can be changed by
// a memo; a new prefix is a claim about how the faculty is divided.
{
  const known = new Set(registryCodes().map((c) => c.code.split(/[\s0-9]/)[0]));
  check('every assigned code uses a prefix the University already uses',
    assignedCodes().filter((a) => !known.has(a.code.split(/[\s0-9]/)[0])).map((a) => a.code), []);
}

// Each one carries the reasoning that produced it, so the faculty is reviewing
// a decision rather than a number.
check('every assignment says why it is that number',
  assignedCodes().filter((a) => !a.because || a.because.length < 20).map((a) => a.code), []);

// The advanced course above the introduction, as the faculty's own pairs run.
check('Advanced Hermeneutics sits above Hermeneutics',
  [codeOf(bth, 'Hermeneutics and Biblical Interpretation'), codeOf(bth, 'Advanced Hermeneutics')],
  ['BIS 330', 'BIS 350']);

console.log('\nChurch history, as the University has ruled it is taught\n');

// TWO COURSES, NOT "I" AND "II". The University has ruled that church history
// is Introduction to Church History and Advanced Church History — which is what
// lets the registry number them separately at all.
check('the introduction takes the code the registry issued',
  codeOf(bth, 'Introduction to Church History'), 'CH 200');
check('…and is a real registry code, not a proposal',
  registryCode('Introduction to Church History')?.source, 'registry');
check('the advanced course carries the number assigned for it',
  facultyCode('Advanced Church History', 'BTH112'),
  { code: 'CH 300', source: 'assigned' });
check('…which follows the faculty’s own convention: a level above the introduction',
  codeOf(bth, 'Advanced Church History'), 'CH 300');
// AN ASSIGNMENT MUST NEVER SHADOW A CODE THE UNIVERSITY ISSUED. The lookup asks
// every real source first; if it ever stopped doing so, a real code would
// disappear behind one written here.
check('no assignment stands where a University document already answers',
  assignedCodes().filter((a) => {
    const c = registryCode(a.title);
    return c && c.source !== 'assigned';
  }).map((a) => a.title), []);

console.log('\nThe two the University settled itself\n');

// "Putting hermeneutics in year two or three does not matter. It is the same.
// Hermeneutics is still hermeneutics, and Biblical Studies BIS 330."
check('Hermeneutics carries BIS 330 wherever it is taught',
  registryCode('Hermeneutics and Biblical Interpretation'),
  { code: 'BIS 330', source: 'registry', matchedTo: 'Hermeneutics' });
check('…and it is taught in Year Two, which the code does not care about',
  bth.courses.find((c) => c.title === 'Hermeneutics and Biblical Interpretation')?.year, 2);

// "The two codes are for vol 1 and 2." So the Bachelor's single course is the
// first volume, and MDS 655 waits for the second rather than competing for it.
check('Spiritual Leadership is the first of the two volumes',
  registryCode('Spiritual Leadership'),
  { code: 'MDS 650', source: 'registry', matchedTo: 'Spiritual Leadership I' });
check('…and the second volume’s code is still the registry’s, unused here',
  registryCodes().some((c) => c.code === 'MDS 655'), true);

console.log('\nThe alias table, which is the one place a mistake would hide\n');

// AN ALIAS POINTING AT A TITLE THE REGISTRY DOES NOT HAVE fails silently: the
// lookup simply returns null and the course keeps its programme code, which
// looks exactly like a subject the faculty has not numbered. So every alias is
// checked to actually resolve.
for (const [from, expected] of [
  ['Pentateuch Studies', 'OT 300'],
  ['Old Testament History and Theology', 'OTH 300'],
  ['Homiletics I', 'BIS 320'],
  ['Evangelism and Missions Introduction', 'MW 300'],
]) {
  check(`"${from}" resolves to ${expected}`, registryCode(from)?.code ?? null, expected);
}

console.log('\nThe Bachelor of Ministry is left as the University published it\n');

// A SECOND SCHEME IS NOT A BUG TO BE FIXED IN A LOOKUP TABLE. The Bachelor of
// Ministry carries BIB, HIS, MIN prefixes for subjects the registry numbers
// differently. Renumbering a published programme is a faculty decision; this
// code must not take it.
check('its codes are untouched', codeOf(bmin, 'Church History I'), 'HIS 101');
check('…and are marked as programme codes rather than faculty ones',
  bmin.courses.find((c) => c.title === 'Church History I')?.codeSource, 'programme');

console.log('\nThe register itself\n');

check('the registry holds codes', registryCodes().length > 0, true);
check('no code appears twice, because a code is one course',
  registryCodes().length, new Set(registryCodes().map((c) => c.code)).size);
{
  // The same course under two of the University's own names. The register
  // carries both rather than picking one and losing the other.
  const faith = registryCodes().find((c) => c.code === 'MDS 880');
  check('a course the documents name twice keeps both names',
    [faith?.title, faith?.alsoKnownAs], ['Exegesis of Faith', ['Faith']]);
}
check('the prefixes are listed with the courses that carry them, not with invented meanings',
  subjectPrefixes().every((p) => p.courses.length > 0 && !('meaning' in p)), true);
check('and BIS is one of them, carrying more than one course',
  (subjectPrefixes().find((p) => p.prefix === 'BIS')?.courses.length ?? 0) > 1, true);

process.exit(failures === 0 ? 0 : 1);
