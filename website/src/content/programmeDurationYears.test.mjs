// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY PUBLISHES MUST MATCH WHAT IT HAS BUILT.
//
// Run with:  node src/content/programmeDurationYears.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
//
// The University's Bachelor of Theology is THREE years. That has been ruled
// twice, and everything actually built agreed with it:
//
//   bachelorOfTheologyCreditCurriculum.duration  "Three years"
//   bachelorOfMinistryCurriculum.duration        "3 years · 6 semesters"
//   the B.Th. curriculum itself                  years 1–3, 6 semesters,
//                                                36 courses, 180 credits
//   the specimen transcript                      3 years, 6 semesters
//
// The published catalogue said "Three to four academic years", and
// institutionalFacts.ts said "Three to four years". So the website told a
// prospective student one number and the transcript told a graduate another.
//
// THAT IS THE WORST PLACE FOR THIS KIND OF DRIFT. A transcript is the document
// somebody else verifies — a registrar at another institution, an employer, a
// ministry of education. When it disagrees with the awarding university's own
// website, the transcript is what gets doubted.
//
// Nobody noticed for the ordinary reason: the two numbers live in different
// files, written months apart, and neither one is wrong on its own page. This
// reads the CURRICULUM — the thing with courses in it — and holds the prose to
// it.
//
// ---------------------------------------------------------------------------
// WHY IT MEASURES RATHER THAN ASSERTS A STRING
// ---------------------------------------------------------------------------
//
// A test that said `assert LEVEL_DURATION.Bachelor === 'Three academic years'`
// would pass for a curriculum that had since grown a fourth year, and the next
// person would "fix" it by editing the expectation. So the expected number is
// counted from the course list, and the published sentence has to contain it.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
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
const cache = join(root, 'node_modules/.cache/icof');
mkdirSync(cache, { recursive: true });

function load(file, name) {
  const out = join(cache, `${name}.mjs`);
  execFileSync('npx', [
    'esbuild', join(root, file),
    '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`,
    '--log-level=error', `--alias:@=${join(root, 'src')}`, '--external:qrcode',
  ]);
  return import(out);
}

const catalogue = await load('src/content/programmeCatalogue.ts', 'dur-catalogue');
const curricula = await load('src/content/programmeCourses.ts', 'dur-curricula');
const facts = await load('src/content/institutionalFacts.ts', 'dur-facts');
const credit = await load('src/content/creditFramework.ts', 'dur-credit');

// Spelled out, because the published sentences are prose and not digits.
const WORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];

console.log('\nWhat is built\n');

// THE CURRICULUM IS THE EVIDENCE. Every programme that has one is counted, so
// adding a curriculum adds a check rather than leaving a gap.
const built = new Map();
for (const programme of curricula.programmesWithCourses()) {
  const { courses } = curricula.coursesForProgramme(programme);
  const years = [...new Set(courses.map((c) => c.year))].sort();
  const semesters = new Set(courses.map((c) => `${c.year}.${c.semester}`));
  const credits = courses.reduce((t, c) => t + (c.credits ?? 0), 0);
  built.set(programme, { years: years.length, semesters: semesters.size, credits });
  console.log(`      ${programme}: ${years.length} years, ${semesters.size} semesters, `
    + `${courses.length} courses, ${credits} credits`);
}

check('the University has curricula to check against', built.size > 0, true);

// THE UNIVERSITY'S RULING, WATCHED HOLDING. Both bachelor's programmes with a
// curriculum must run three years — not "no more than four", three.
console.log('\nThe Bachelor’s is three years, in the curriculum itself\n');

for (const [programme, shape] of built) {
  if (!/^bachelor/i.test(programme)) continue;
  check(`${programme} runs three years`, shape.years, 3);
  // SIX SEMESTERS FOLLOWS, and is worth its own line: a three-year programme
  // recorded with eight semesters would satisfy the year count and still be
  // the four-year structure under another name.
  check(`…in six semesters`, shape.semesters, 6);
  // 180 IS THE RULING — "of the conflicting credit totals, only the one with
  // 180 stands".
  check(`…totalling 180 credits`, shape.credits, 180);
}

console.log('\nAnd the published sentence says the same number\n');

{
  const published = catalogue.durationFor
    ? catalogue.durationFor('Bachelor')
    : catalogue.ALL_PROGRAMMES.find((p) => p.award === "Bachelor's")?.duration ?? '';

  const expected = WORD[3];
  check('the catalogue publishes three years for a Bachelor’s',
    new RegExp(`\\b(${expected}|3)\\b`, 'i').test(published), true);
  // THE FAILURE THIS CATCHES, NAMED. "Three to four" contains "three" and
  // would pass a test that only looked for the right word.
  check('…and does not publish a range that reaches four',
    /\b(four|4)\b/i.test(published), false);
  console.log(`      published: ${JSON.stringify(published)}`);
}

{
  const row = (facts.PATHWAY ?? [])
    .find((a) => /bachelor/i.test(a.award));
  check('institutionalFacts’ award ladder has a Bachelor’s row', !!row, true);
  if (row) {
    check('…and it does not say four either', /\b(four|4)\b/i.test(row.duration), false);
    console.log(`      published: ${JSON.stringify(row.duration)}`);
  }
}

// ---------------------------------------------------------------------------
// AND THE DOCTORATE IS TWO YEARS.
//
// A standing University ruling, restated explicitly: "Doctorate is two years."
//
// This one had drifted further than the Bachelor's and in more places. The
// site published "Three or more academic years of supervised research" across
// programmeCatalogue.ts, institutionalFacts.ts and creditFramework.ts, and the
// visitor-facing programme finder put the Doctorate in a band labelled "Three
// years or more" — so somebody filtering by how long they had was shown the
// wrong award.
//
// NO CURRICULUM TO MEASURE AGAINST. The three doctorates are examined by
// thesis and carry no credit-rated course list, so unlike the Bachelor's there
// is nothing to count. What is checked instead is that every published
// sentence agrees with the ruling and that none of them reaches past two — a
// range is the failure mode this whole file exists for.
// ---------------------------------------------------------------------------

console.log('\nThe Doctorate is two years, wherever it is published\n');

{
  const reachesPastTwo = /\b(three|3|four|4|five|5|or more)\b/i;

  const level = catalogue.durationFor
    ? catalogue.durationFor('Doctorate')
    : catalogue.ALL_PROGRAMMES.find((p) => p.award === 'Doctorate')?.duration ?? '';
  check('the catalogue publishes two years for a Doctorate',
    /\b(two|2)\b/i.test(level), true);
  check('…and does not reach past two', reachesPastTwo.test(level), false);
  console.log(`      catalogue:          ${JSON.stringify(level)}`);

  const ladder = (facts.PATHWAY ?? []).find((a) => /doctor/i.test(a.award));
  check('institutionalFacts’ award ladder has a Doctorate row', !!ladder, true);
  if (ladder) {
    check('…and it does not reach past two', reachesPastTwo.test(ladder.duration), false);
    console.log(`      institutionalFacts: ${JSON.stringify(ladder.duration)}`);
  }

  const framework = (credit.AWARD_LADDER ?? [])
    .find((a) => /doctor/i.test(a.award ?? a.level ?? a.title ?? ''));
  check('the credit framework has a Doctorate row', !!framework, true);
  if (framework) {
    check('…and it does not reach past two', reachesPastTwo.test(framework.duration ?? ''), false);
    console.log(`      creditFramework:    ${JSON.stringify(framework.duration)}`);
  }

  // THE ONE A READER ACTUALLY USES. The finder's bands are how a visitor
  // chooses; a Doctorate filed under "three years or more" is the ruling
  // contradicted at the point of decision.
  const finder = readFileSync(join(root, 'src/components/home/ProgrammeFinder.tsx'), 'utf8');
  const longBand = /\{[^}]*id:\s*'long'[^}]*\}/.exec(finder)?.[0] ?? '';
  check('the programme finder does not file a Doctorate under three years or more',
    /Doctorate/.test(longBand), false);
}

process.exit(failures === 0 ? 0 : 1);
