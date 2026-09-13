// ---------------------------------------------------------------------------
// NO SCREEN SHIPS A CURRICULUM THE UNIVERSITY DOES NOT TEACH.
//
// Run with:  node src/components/inventedData.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
//
// The University opened its own LMS and found:
//
//     Introduction to AI - Lecture 1
//     Search Algorithms Video
//     SQL Tutorial Complete Guide
//     React Framework Masterclass
//     Neural Networks Deep Dive
//
// under course codes CSC 301, CSC 202, CSC 212 — and a banner underneath
// admitting the rows were illustrative samples. ICOF Global University teaches
// theology, ministry, education, engineering and business. It has never taught
// a single one of those courses.
//
// Their words: "That immediately makes the university portal feel like a demo."
//
// It was not only the LMS. The same file supplied four invented examinations to
// the examination screen, a `dashboardStats` of 2,847 students and 186
// lecturers, and eight `recentActivities` naming five members of staff who do
// not work here. The transcript had already been rescued from it once — the
// note at the top of sampleData.ts described removing a B.Sc. Computer Science
// record for a "Faculty of Computing" that every transcript surface had been
// rendering, including the screen where the Superadministrator approves the
// design of the document the University issues.
//
// So this is the third time invented academic content has been found on a live
// screen, and the second time it was found by the University rather than by a
// test.
//
// ---------------------------------------------------------------------------
// WHAT IT CHECKS, AND WHY IT IS SPELLED THIS WAY
// ---------------------------------------------------------------------------
//
// Two things, both narrow on purpose:
//
//   1. NOTHING IMPORTS A MODULE OF INVENTED DATA. sampleData.ts is deleted; an
//      import of it, or of anything named like it, fails here.
//
//   2. NO PORTAL SCREEN CONTAINS A COURSE CODE FROM A DISCIPLINE THE UNIVERSITY
//      DOES NOT TEACH. The codes are checked against the real course registry,
//      so this cannot drift as the catalogue grows.
//
// It does NOT try to detect "fake-looking data" in general. A test that guesses
// gets ignored the first time it is wrong.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
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

const root = new URL('../..', import.meta.url).pathname;
const src = join(root, 'src');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.')) out.push(full);
  }
  return out;
}

const files = walk(src);

console.log('\nThe module of invented data is gone, and nothing reaches for it\n');

check('src/lib/sampleData.ts does not exist',
  existsSync(join(src, 'lib/sampleData.ts')), false);

{
  const importers = files
    .filter((f) => /from\s+['"][^'"]*\bsampleData['"]/.test(readFileSync(f, 'utf8')))
    .map((f) => f.replace(`${root}/`, ''));
  check('nothing imports it', importers, []);
}

console.log('\nNo screen carries a course code the University does not teach\n');

// THE REAL REGISTRY, so this cannot go stale as the catalogue grows.
const cache = join(root, 'node_modules/.cache/icof');
mkdirSync(cache, { recursive: true });
const bundle = join(cache, 'invented-courses.mjs');
execFileSync('npx', [
  'esbuild', join(src, 'content/courseCodes.ts'),
  '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`,
  '--log-level=error', `--alias:@=${src}`,
]);
const registry = await import(bundle);

const known = new Set();
const add = (code) => {
  if (typeof code === 'string') known.add(code.replace(/\s+/g, '').toUpperCase());
};
// REGISTERED codes are the University's own numbering; ASSIGNED ones were
// allocated where a course had a title and no number. Both are real.
for (const entry of registry.registryCodes()) {
  add(entry.code);
  for (const also of entry.alsoKnownAs ?? []) add(also);
}
for (const entry of registry.assignedCodes()) add(entry.code);

// AND THE SUBJECT PREFIXES the University actually uses. A code with a real
// prefix and an unfamiliar number is a course this registry has not caught up
// with; a code with a prefix that appears nowhere in the University — CSC, for
// Computer Science — is from another institution's curriculum entirely, and
// that is the thing worth refusing.
const PREFIXES = new Set(registry.subjectPrefixes().map((p) => p.prefix.toUpperCase()));
console.log(`      the registry knows ${known.size} codes across ${PREFIXES.size} subject prefixes`);
check('the registry is readable', known.size > 0 && PREFIXES.size > 0, true);

// A COURSE CODE IS THREE LETTERS AND THREE DIGITS. Anything matching that shape
// inside a screen is a course being named, and it had better be one of ours.
const CODE = /\b([A-Z]{3})\s?(\d{3})\b/g;

// Prefixes that are not course codes at all. Kept short and each one named —
// a long ignore list is how a check like this stops checking anything.
const NOT_A_COURSE = new Set([
  'APT', // appointment reference, APT-2026-0042
  'IGU', // the University's own prefix
  'RUN', 'SQL', 'PDF', 'CSS', 'URL', 'API', 'JWT', 'RLS', 'UTC', 'ICO',
]);

{
  const offenders = [];
  for (const file of files.filter((f) => f.includes('/components/'))) {
    const text = readFileSync(file, 'utf8');
    // Comments are where this codebase explains its own history, and those
    // explanations NAME the codes that were removed. Stripping them is what
    // lets the note above stay written down.
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const [, letters, digits] of code.matchAll(CODE)) {
      if (NOT_A_COURSE.has(letters)) continue;
      if (known.has(`${letters}${digits}`)) continue;
      if (PREFIXES.has(letters)) continue;
      offenders.push(`${file.replace(`${root}/`, '')}: ${letters} ${digits}`);
    }
  }
  check('no component names a course outside the registry', [...new Set(offenders)], []);
}

console.log('\nAnd the screens the University complained about read real records\n');

{
  const lms = readFileSync(join(src, 'components/lms/LMSModule.tsx'), 'utf8');
  check('the LMS reads its materials from the store',
    /listRecords\(\s*'lms',\s*'material'\s*\)/.test(lms), true);
  // THE FAILURE THAT LOOKED LIKE SUCCESS. The upload handler closed the dialog
  // and wrote nothing at all.
  check('…and adding a material actually writes something',
    /saveRecord\(\{[\s\S]{0,200}kind:\s*'material'/.test(lms), true);
  check('…and no longer announces its own contents as samples',
    /SampleDataNotice/.test(lms), false);

  const exams = readFileSync(join(src, 'components/exams/ExamModule.tsx'), 'utf8');
  check('the examination screen reads the examinations table',
    /\.from\('examinations'\)/.test(exams), true);
  check('…and no longer announces its own contents as samples',
    /SampleDataNotice/.test(exams), false);
}

process.exit(failures === 0 ? 0 : 1);
