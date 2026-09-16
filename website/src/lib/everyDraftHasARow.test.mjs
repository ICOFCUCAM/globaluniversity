// ---------------------------------------------------------------------------
// A SCREEN NEVER COUNTS MORE THAN IT CAN DRAW.
//
// Run with:  node src/lib/everyDraftHasARow.test.mjs
//
// ---------------------------------------------------------------------------
// THE FAULT THIS WAS WRITTEN AFTER
// ---------------------------------------------------------------------------
//
// The University opened Job Descriptions and read:
//
//   "3 job descriptions waiting to be read and approved"
//
// above a list of eight families in which every single row said IN FORCE. They
// asked what there was to verify. Nothing was: the banner counted every draft
// profile in the database and the list iterated a constant compiled into the
// page, so a draft could be counted and never drawn.
//
// TWO KINDS OF DRAFT WERE INVISIBLE:
//
//   A POST'S OWN job description, which never had a row at all. The route has
//   supported one since it was written — `fork` creates it, and purpose,
//   clause, remove and activate all handle `position_id` — and the screen
//   selected that column only to exclude it. 103 seeded two and both vanished
//   on arrival.
//
//   A FAMILY THE DATABASE HAS AND THE BUILD DOES NOT. 103 added `national` as
//   a ninth family. A migration lands when the University runs it; a constant
//   changes when the site is redeployed. Between those two moments the family
//   existed, its draft was counted, and nothing drew it.
//
// ---------------------------------------------------------------------------
// WHY A TEST AND NOT JUST A FIX
// ---------------------------------------------------------------------------
//
// Because the shape recurs. `portalCoverage.test.mjs` exists because a list of
// sixteen roles was missing seven; `accountCreation.test.mjs` because a list of
// fourteen was missing eight. This is the same disease in a third place: a
// hand-maintained list standing in for what the database actually holds, with
// a counter beside it that reads the database directly.
//
// The counter and the list must not have different sources.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let failures = 0;
const check = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`ok    ${label}`);
  } else {
    failures++;
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n`
      + `      actual   ${JSON.stringify(actual)}`);
  }
};

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const screen = readFileSync(join(root, 'src/components/admin/JobDescriptions.tsx'), 'utf8');

// ---------------------------------------------------------------------------

console.log('\nThe banner and the list read the same thing\n');

// THE COUNTER. It counts every draft profile, which is right — what was wrong
// was the list beside it.
check('the banner counts every draft profile',
  /profiles\.filter\(\(p\) => p\.status === 'draft'\)\.length/.test(screen), true);

// AND THE LIST NO LONGER ITERATES A CONSTANT.
check('the list does not iterate POSITION_FAMILIES',
  /POSITION_FAMILIES\.map\(/.test(screen), false);
check('it iterates what the database holds instead',
  /\{entries\.map\(\(entry\) =>/.test(screen), true);

// A POST'S OWN JOB DESCRIPTION GETS A ROW. The column used to appear in this
// file only as an exclusion.
check('a profile belonging to a post is drawn, not only excluded',
  /profiles\s*\n?\s*\.filter\(\(p\) => p\.position_id && p\.status !== 'superseded'\)/
    .test(screen), true);

// AND A FAMILY THE BUILD HAS NOT HEARD OF IS DRAWN TOO.
check('families come from the posts and profiles as well as the constant',
  /posts\.map\(\(p\) => p\.family\)/.test(screen)
  && /profiles\.filter\(\(p\) => !p\.position_id\)\.map\(\(p\) => p\.family\)/.test(screen),
  true);

// THE HEADER COUNTS THE ROWS IT DREW, not the constant. It said "8 families"
// on a database that had nine.
check('the header counts the families it drew',
  /entries\.filter\(\(e\) => !e\.ofAPost\)\.length\} families/.test(screen), true);

// AND THE BANNER NAMES WHAT IS WAITING. "3 waiting" over a list where every row
// reads IN FORCE tells somebody to go and read something without saying which.
check('the banner names the drafts, not only their number',
  /entries\.filter\(\(e\) => e\.profile\?\.status === 'draft'\)/.test(screen), true);

// ---------------------------------------------------------------------------

console.log('\nAnd the route could do this the whole time\n');

const route = readFileSync(
  join(root, 'src/app/api/admin/job-description/route.ts'), 'utf8');

// EVERY ACTION HANDLES A POST PROFILE. That is what makes the screen's silence
// a screen fault rather than a missing feature — nothing had to be built in the
// route, and a whole class of job description was unreachable anyway.
check('the route can create a post’s own profile', /action === 'fork'/.test(route), true);
check('…and activating one supersedes that post’s previous version',
  /\.eq\('position_id', profile\.position_id as string\)/.test(route), true);

// ---------------------------------------------------------------------------

console.log('\n103’s three drafts are the three the University was shown\n');

const m103 = readFileSync(
  join(root, 'docs/migrations/103_the_nation_has_offices_too.sql'), 'utf8');

// One family profile and two post profiles: the national family, the National
// Rector and the National Financial Secretary. That is the 3 in the banner.
const familyDrafts = (m103.match(/insert into position_profiles \(family,/g) ?? []).length;
const postDrafts = (m103.match(/insert into position_profiles \(position_id,/g) ?? []).length;
check('103 seeds one family draft', familyDrafts, 1);
check('…and two that belong to a post', postDrafts, 2);
check('which is the three the banner counted', familyDrafts + postDrafts, 3);

// ---------------------------------------------------------------------------

console.log(failures === 0
  ? '\nEvery draft the screen counts is a draft the screen can open.\n'
  : `\n${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
