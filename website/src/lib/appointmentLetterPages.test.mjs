// ---------------------------------------------------------------------------
// WHAT THE APPOINTMENT LETTER ACTUALLY DOES ON A PAGE.
//
// Run with:  node src/lib/appointmentLetterPages.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS IS RENDERED RATHER THAN READ
// ---------------------------------------------------------------------------
//
// Nearly every real defect in this codebase was found by rendering the thing
// and reading the pixels, not by reading the source. A letter is exactly the
// case: the CSS looks right, the markup looks right, and the document runs to
// two pages with the signature block orphaned on the second — which nobody
// notices until an appointee receives a page with nothing on it but a name and
// a line.
//
// So this opens the generated letter in Chromium at A4 and measures it.
//
// ---------------------------------------------------------------------------
// AND WHY THERE IS NO PDF
// ---------------------------------------------------------------------------
//
// `playwright` is a DEV dependency. Chromium is not present in the deployment,
// so a route that rendered a PDF on the server would work here and fail on
// Vercel — which is worse than not having one, because it would be discovered
// by the first officer trying to issue a letter.
//
// The letter is therefore HTML with print CSS, as the admission letter already
// is, and the browser produces the PDF. What this file guarantees is that the
// thing the browser prints is the right shape.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
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
const cache = join(here, '../../node_modules/.cache/icof');
mkdirSync(cache, { recursive: true });

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  // NOT A PASS. A measurement that did not happen is not a measurement that
  // succeeded, and reporting it as one is how a suite comes to vouch for
  // things it never looked at.
  console.error('FAIL  playwright is not installed, so nothing was measured');
  process.exit(1);
}

// --- Generate a letter from a complete record ------------------------------
const out = join(cache, 'letterForPages.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'appointmentLetter.ts'), '--bundle', '--format=esm',
  '--platform=node', `--outfile=${out}`, '--log-level=error',
  `--alias:@=${join(here, '..')}`, '--external:qrcode',
]);
// THE GEOMETRY COMES FROM THE LETTER, not from a constant retyped here. It was
// retyped for about ten minutes and immediately went stale when the margin
// changed, reporting a letter with 46px more room as fitting more tightly.
const { appointmentLetterHtml, PRINTABLE } = await import(out);

const appointment = {
  full_name: 'A Specimen Appointee',
  postal_address: 'PO Box 1, Buea, Cameroon',
  position_title: 'Lecturer in Systematic Theology',
  unit_name: 'Faculty of Theology',
  employment_type: 'permanent',
  start_date: '2026-10-01',
  effective_date: '2026-10-01',
  probation_months: 6,
  place_of_duty: 'Buea campus',
  reports_to_name: 'The Head of Academic Affairs',
  working_hours: '40 hours per week',
  appointing_authority: 'The University Council',
  authority_decided_on: '2026-09-03',
  salary_amount: 450000,
  salary_currency: 'FCFA',
  salary_period: 'month',
  // A REALISTIC BLOCK OF TERMS, not one sentence. The page count is decided by
  // this paragraph more than by anything else, and measuring a letter with a
  // placeholder in it measures nothing.
  terms: [
    'This appointment is subject to the conditions of service of the University and to the',
    'regulations in force from time to time. You are required to devote your full professional',
    'time to the duties of the post and to observe the University’s policies on conduct,',
    'confidentiality and conflict of interest.',
    '',
    'Either party may terminate this appointment by giving three months’ notice in writing,',
    'or payment in lieu of notice. During the probationary period, one month’s notice applies.',
    '',
    'Your appointment is subject to satisfactory verification of the qualifications and',
    'references you have supplied.',
  ].join('\n'),
};

const letter = await appointmentLetterHtml({
  appointment,
  reference: 'APT-2026-0042',
  issuedOn: '2026-09-12',
  version: 1,
  signatoryName: 'The Registrar',
  signatoryRole: 'Registrar',
  siteUrl: 'https://example.test',
});

const file = join(cache, 'appointment-letter.html');
writeFileSync(file, letter.html);

const browser = await chromium.launch({ executablePath: CHROME });

// ---------------------------------------------------------------------------
// THE VIEWPORT IS THE PRINTABLE AREA, NOT A WINDOW.
//
// A4 is 794 x 1123 CSS pixels at 96dpi, and the @page rule takes 16mm off each
// side and 18mm off top and bottom — 60 and 68 pixels at 3.7795 px/mm. So the
// text block is 674 wide and 987 tall.
//
// Measured in a default 1280-wide window, every width check passes trivially
// and the height is wrong, because the paragraphs are laid out at nearly twice
// the width they will actually have. That is the shape of a measurement that
// looks like a measurement.
// ---------------------------------------------------------------------------
const PRINTABLE_WIDTH = PRINTABLE.width;
const page = await browser.newPage({
  viewport: { width: PRINTABLE_WIDTH, height: 1123 },
});
await page.goto(`file://${file}`);
await page.emulateMedia({ media: 'print' });

console.log('\nThe letter fits the page it is printed on\n');

const A4_PRINTABLE_HEIGHT = PRINTABLE.height;

const measured = await page.evaluate(() => {
  const body = document.body;
  const sign = document.querySelector('.sign');
  const seal = document.querySelector('.seal');
  return {
    height: Math.ceil(body.getBoundingClientRect().height),
    width: Math.ceil(body.getBoundingClientRect().width),
    signTop: sign ? Math.round(sign.getBoundingClientRect().top) : -1,
    sealTop: seal ? Math.round(seal.getBoundingClientRect().top) : -1,
    sealBottom: seal ? Math.round(seal.getBoundingClientRect().bottom) : -1,
  };
});

const pages = Math.ceil(measured.height / A4_PRINTABLE_HEIGHT);
const headroom = (pages * A4_PRINTABLE_HEIGHT) - measured.height;
console.log(`      measured ${measured.height}px tall — ${pages} page(s) at A4, `
  + `${headroom}px to spare`);

// HOW CLOSE IT IS, said out loud. A letter that fits by four pixels fits on
// this machine and on no other: a font substituted on a different platform, or
// a slightly longer name, tips it over. Reporting the headroom is what stops
// "it passes" being mistaken for "it is comfortable".
check('and it fits with room to spare, not by a pixel', headroom >= 30, true);

// TWO PAGES IS ACCEPTABLE FOR A LETTER WITH FULL TERMS. Three is not: it means
// the terms have overflowed in a way nobody intended, and an appointment letter
// running to three pages is one somebody will not read to the end.
// ONE PAGE FOR A LETTER WITH FULL TERMS, and pinned at one rather than two.
//
// It was two: 1293px against a 987px page, with the signature 40px onto the
// second. Trimmed to fit, it then measured 1001px — still two pages, with a
// second page carrying fourteen pixels of the seal panel. A page that exists
// to hold the bottom edge of a box is a page somebody prints, looks at, and
// throws away wondering what went wrong.
//
// Pinned here so it cannot drift back. If the University lengthens its
// standard terms this will fail, which is the right moment to decide whether
// the letter becomes two pages deliberately.
check('a full letter is one page', pages, 1);

// THE ONE THAT WOULD ACTUALLY EMBARRASS THE UNIVERSITY. A final page carrying
// nothing but the signature line and the seal is a page that looks like a
// mistake, and it is the classic print-CSS failure.
//
// THE THRESHOLD MATTERS AND THE FIRST ONE WAS WRONG. It asked whether the
// signature sat more than 40px into the page, and the signature sat at exactly
// 40px — so the check passed by one pixel while the defect it was written for
// was present. A margin that narrow is not a test, it is a coincidence.
//
// The honest question is how much of the letter shares the page with the
// signature. Less than a fifth of a page above it means the signature is the
// page: a reader turns over and finds a name, a line and a QR code.
const MINIMUM_ABOVE_THE_SIGNATURE = Math.round(A4_PRINTABLE_HEIGHT / 5);
{
  const pageOfSignature = Math.floor(measured.signTop / A4_PRINTABLE_HEIGHT);
  const above = measured.signTop - (pageOfSignature * A4_PRINTABLE_HEIGHT);
  console.log(`      the signature sits ${above}px into page ${pageOfSignature + 1}`);
  check('the signature shares its page with the letter',
    above >= MINIMUM_ABOVE_THE_SIGNATURE || pageOfSignature === 0, true);
}

console.log('\nAnd it is the width of the page, not wider\n');

{
  // A DOCUMENT WIDER THAN THE PAGE loses its right edge when printed, and the
  // thing on the right edge of this letter is the verification code.
  check('nothing overflows the page width', measured.width <= PRINTABLE_WIDTH, true);

  const overflowing = await page.evaluate(() => {
    const w = document.body.getBoundingClientRect().width;
    return [...document.querySelectorAll('*')]
      .filter((el) => el.getBoundingClientRect().right > w + 1)
      .map((el) => el.tagName.toLowerCase() + (el.className ? `.${el.className}` : ''));
  });
  check('no element runs past the right edge', overflowing, []);
}

console.log('\nThe things a reader has to be able to find are on it\n');

{
  // READ OFF THE RENDERED PAGE, not the source. A field present in the markup
  // and hidden by CSS is absent from the document, and the source cannot tell
  // the difference.
  const text = await page.evaluate(() => document.body.innerText);

  for (const [what, value] of [
    ['the name', 'A Specimen Appointee'],
    ['the position', 'Lecturer in Systematic Theology'],
    ['the faculty', 'Faculty of Theology'],
    ['the date', '12 September 2026'],
    ['the reference', 'IGUC/HR/APT/2026/0042'],
    ['the start date', '1 October 2026'],
    ['the working hours', '40 hours per week'],
    ['the place of duty', 'Buea campus'],
    ['the reporting officer', 'The Head of Academic Affairs'],
    ['the appointing authority', 'The University Council'],
    ['the signatory', 'The Registrar'],
    // THE AUTHORITY, STATED. A reader in five years needs to know the letter
    // was made by the office that may make it, and a signature alone does not
    // say so.
    ['the appointing authority of the University', 'BY AUTHORITY OF THE VICE-CHANCELLOR'],
  ]) {
    check(`${what} is visible on the page`, text.includes(value), true);
  }

  // THE SALARY IS ON THE LETTER AND NOWHERE ELSE. It is not on the public
  // verification page, and this is the only document that carries it.
  check('the remuneration is on the letter', text.includes('FCFA 450,000 per month'), true);

  // AND THE PROBATION SAYS WHEN IT ENDS, rather than a number the appointee
  // has to do arithmetic on.
  check('the probation states the date it ends', text.includes('1 April 2027'), true);
}

console.log('\nThe seal panel is at the foot, where a reader looks for it\n');

{
  // A VERIFICATION CODE HALFWAY UP THE PAGE is one nobody finds. It belongs
  // below the signature, and this asserts the order rather than trusting the
  // markup to have stayed in it.
  check('the seal sits below the signature', measured.sealTop > measured.signTop, true);
  check('and it is the last thing on the document',
    measured.sealBottom >= measured.height - 40, true);
}

await browser.close();

console.log(failures === 0 ? '\nAll letter page checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
