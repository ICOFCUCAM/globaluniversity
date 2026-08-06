// ---------------------------------------------------------------------------
// Fees — the second part of this system that must not be wrong.
//
// Run with:  node src/lib/fees.test.mjs
//
// WHY THIS FILE EXISTS. The fee schedule was published in FCFA, then converted
// to US dollars because the university now quotes one currency worldwide and
// takes payment locally. A conversion is arithmetic, and arithmetic done once
// by hand, across fourteen line items, in a file nobody re-reads, is arithmetic
// that will be wrong somewhere.
//
// It already was. The total was typed as USD 200 against items that add to 245
// — a figure printed on the university's own regulations page, wrong by
// forty-five dollars, for as long as it stood there. The total is computed now,
// and this file is what notices if the rest drifts.
//
// The rate and the rounding are typed out here rather than imported. A test
// that imports the same constant the code imports proves only that a file can
// be read.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

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

// The terms the university adopted: 600 FCFA to the dollar, every fee rounded
// up to a whole multiple of five so that no fee needs change made on it.
const RATE = 600;
const STEP = 5;

const src = readFileSync(new URL('../content/regulations.ts', import.meta.url), 'utf8');

// --- The rate and the rounding step are what the university adopted. --------
const rateLine = src.match(/usdConversionRate\s*=\s*\{([^}]*)\}/);
check('the conversion rate is declared', !!rateLine, true);
check('the rate is 600 FCFA to the dollar', Number(rateLine[1].match(/fcfaPerUsd:\s*(\d+)/)[1]), RATE);
check('fees round to a multiple of five', Number(rateLine[1].match(/roundedToNearest:\s*(\d+)/)[1]), STEP);
check('the rate is marked confirmed', /confirmed:\s*true/.test(rateLine[1]), true);

// --- Every dollar figure in the schedule. -----------------------------------
// Parsed out of the source rather than imported, so a fee added as a bare
// string is caught the same as one added through the helper.
const items = [...src.matchAll(
  /\{\s*item:\s*'([^']+)',\s*amount:\s*'USD ([\d,]+)([^']*)'(?:,\s*wasFcfa:\s*'([\d,]+)([^']*)')?(,\s*optional:\s*true)?/g,
)].map((m) => ({
  item: m[1],
  usd: Number(m[2].replace(/,/g, '')),
  fcfa: m[4] ? Number(m[4].replace(/,/g, '')) : null,
  optional: !!m[6],
}));

check('the schedule was parsed', items.length > 10, true);

const notRounded = items.filter((f) => f.usd % STEP !== 0).map((f) => `${f.item}: USD ${f.usd}`);
check('every fee is a whole multiple of five dollars', notRounded, []);

// The rule is round UP: a fee rounded down would have the university collecting
// less than the FCFA schedule it replaced, on every line, forever.
const misconverted = items
  .filter((f) => f.fcfa !== null)
  .filter((f) => f.usd !== Math.max(STEP, Math.ceil(f.fcfa / RATE / STEP) * STEP))
  .map((f) => `${f.item}: ${f.fcfa} FCFA at ${RATE} is USD ${Math.max(STEP, Math.ceil(f.fcfa / RATE / STEP) * STEP)}, shown as USD ${f.usd}`);
check('every converted fee matches the rate and the rounding', misconverted, []);

// --- The total is derived, not typed. ---------------------------------------
check(
  'the total is computed from the schedule rather than written by hand',
  /miscellaneousFeesTotal\s*=\s*`USD \$\{miscellaneousFees/.test(src),
  true,
);

// --- No FCFA amount survives in the published schedule. ---------------------
// `wasFcfa` is the original, kept beside each line so the arithmetic stays
// checkable; it is the only place FCFA may appear as an amount.
const stray = [...src.matchAll(/amount:\s*'([^']*FCFA[^']*)'/g)].map((m) => m[1]);
check('no fee is still quoted in FCFA', stray, []);

// --- The application fee, which is quoted in three places. ------------------
const appFee = src.match(/applicationFee\s*=\s*'USD (\d+)'/);
check('the application fee is USD 100', Number(appFee[1]), 100);
check(
  'the payment terms quote the same application fee',
  src.includes(`The Application Fee is USD ${appFee[1]}`),
  true,
);

console.log(failures === 0 ? '\nAll fee checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
