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

const { registryCode, facultyCode, registryCodes, subjectPrefixes } =
  await import(bundle('./courseCodes.ts', 'course-codes.mjs'));
const { coursesForProgramme, awaitingRegistryCode } =
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

const registrySourced = [...bth.courses, ...dip.courses, ...bmin.courses]
  .filter((c) => c.codeSource === 'registry');
check('every registry code on every schedule was supplied by the University',
  registrySourced.filter((c) => !supplied.has(c.code)).map((c) => c.code), []);
check('…and there are some, so the check is not passing on an empty set',
  registrySourced.length > 0, true);

// The other half: a subject the registry has not numbered keeps the programme's
// own code and is MARKED as such, rather than being handed something that looks
// like a faculty code.
const awaiting = awaitingRegistryCode(bth);
check('the courses the faculty has not numbered are marked, not filled in',
  awaiting.every((c) => c.codeSource === 'programme'), true);
check('…and they are named rather than hidden', awaiting.length > 0, true);
check('Pneumatology has no registry code and does not pretend to',
  registryCode('Pneumatology'), null);
check('…so it stands in with the code from the programme brief',
  codeOf(bth, 'Pneumatology'), 'BTH208');

// A subject the 180-ECTS structure SPLIT must not inherit the single code of
// the course it was split from — two courses cannot share one number.
check('Church History I does not take the code of the single Church History',
  registryCode('Church History I'), null);
check('nor does Church History II', registryCode('Church History II'), null);

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
check('no code appears twice under two titles',
  registryCodes().length, new Set(registryCodes().map((c) => c.code)).size);
check('the prefixes are listed with the courses that carry them, not with invented meanings',
  subjectPrefixes().every((p) => p.courses.length > 0 && !('meaning' in p)), true);
check('and BIS is one of them, carrying more than one course',
  (subjectPrefixes().find((p) => p.prefix === 'BIS')?.courses.length ?? 0) > 1, true);

process.exit(failures === 0 ? 0 : 1);
