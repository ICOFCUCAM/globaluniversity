// ---------------------------------------------------------------------------
// THE MASTHEAD'S TWO PROMISES.
//
// Run with:  node src/components/portal/portalMasthead.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
//
// The band across the top of every dashboard makes two promises that are not
// visible in the code that uses it, and both were broken once already during
// the hour it was written.
//
//   IT SURVIVES A MISSING PHOTOGRAPH. The picture is a background layer over a
//   gradient that is always painted, never an <img>. Someone "tidying" it into
//   an <img> would not notice anything wrong — their file is committed — and
//   would ship a broken-image glyph across the top of every screen to whoever
//   deploys before uploading it.
//
//   IT STAYS THE UNIVERSITY'S COLOUR. The first version laid the photograph
//   down under a translucent wash, copying the sign-in screen. That works there
//   because its photograph is a dark interior; tried here with a bright one the
//   picture came through and the band rendered blue. The fix was to blend on
//   luminosity, so the aubergine is a property of the band rather than of
//   whichever file was uploaded.
//
// Neither can be caught by rendering the component — it renders perfectly well
// while being wrong on both counts. They are read out of the source instead,
// which is unglamorous and is the only thing that would have caught either.
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync, statSync } from 'node:fs';
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

const here = new URL('.', import.meta.url).pathname;
const src = join(here, '../..');
const masthead = readFileSync(join(here, 'PortalMasthead.tsx'), 'utf8');
const constants = readFileSync(join(src, 'lib/constants.ts'), 'utf8');

console.log('\nA missing photograph costs nothing\n');

// The photograph is set through backgroundImage. If this ever becomes an <img>
// the band gets a broken glyph instead of a wash.
check('the photograph is painted as a background layer',
  /backgroundImage: `url\(\$\{photograph\}\)`/.test(masthead), true);
check('…and never as an <img> the browser could fail to load',
  /<img[^>]*\{photograph\}/.test(masthead), false);
// The ground under it is unconditional — no `photograph &&` guarding it.
check('a gradient is painted underneath whether or not there is a photograph',
  /bg-gradient-to-br from-\[#241a30\] via-\[#3a2850\] to-\[#4b3a6b\]/.test(masthead), true);

console.log('\nAnd the band stays the University’s colour\n');

check('the photograph is blended on luminosity, so it takes the band’s hue',
  /mix-blend-luminosity/.test(masthead), true);
check('the text side is darkened independently of the picture',
  /bg-gradient-to-r from-\[#1d1428\]/.test(masthead), true);

console.log('\nNo photograph is used twice\n');

// ---------------------------------------------------------------------------
// THE UNIVERSITY'S OWN RULE, held to by counting.
//
// The administrator's dashboard used to paste the sign-in screen's photograph
// into its welcome band — the same picture the reader had been looking at
// full-bleed on the way in. That is what `portalHero` exists to end, and it
// only stays ended if nothing reaches for `hero` again.
// ---------------------------------------------------------------------------

check('the management system has a photograph of its own',
  /portalHero: '\/images\/portal-hero\.(jpg|png)'/.test(constants), true);

// AND IT IS ACTUALLY THERE, at a weight a phone can carry. It arrived as a
// 2,053 KB PNG, which is about eight times what a photograph needs and is paid
// for by every visitor on a handset. The ceiling is the one public/images's own
// README sets for everything else in that folder.
{
  const named = /portalHero: '(\/images\/[^']+)'/.exec(constants)?.[1];
  const file = join(here, '../../../public', named ?? '');
  let bytes = 0;
  try { bytes = statSync(file).size; } catch { bytes = -1; }
  check('the file the constant names exists', bytes >= 0, true);
  check('…and is under the 400 KB the images README sets', bytes > 0 && bytes < 400_000, true);
}

/** Every .tsx under src, so a new caller cannot be added unnoticed. */
function tsxFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...tsxFiles(p));
    else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const usesHero = tsxFiles(src)
  .filter((f) => /\bIMAGES\.hero\b/.test(readFileSync(f, 'utf8')))
  .map((f) => f.slice(src.length + 1));

check('the sign-in screen is the only thing using the sign-in photograph',
  usesHero, ['components/LoginScreen.tsx']);

process.exit(failures === 0 ? 0 : 1);
