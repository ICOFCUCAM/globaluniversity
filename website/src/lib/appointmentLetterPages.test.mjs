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
// THIS FILE MEASURES THE PAGE. SOMETHING ELSE MEASURES THE PDF.
// ---------------------------------------------------------------------------
//
// This once said there was no server-side PDF, because `playwright` is a DEV
// dependency and Chromium was not in the deployment. Both halves of that have
// since changed: the University asked for a real A4 PDF, `@sparticuz/chromium`
// supplies a browser on Vercel, and `src/lib/renderPdf.ts` prints one.
//
// The division of labour is worth keeping straight, because each file catches
// something the other cannot:
//
//   this file                 opens the letter in Playwright and reads the
//                             LAID-OUT PAGE — what fits on page one, where the
//                             signature and the seal land.
//   renderPdf.test.mjs        drives the production path (puppeteer-core,
//                             `preferCSSPageSize`) and reads the MediaBox out
//                             of the bytes, so a letter silently printed at US
//                             Letter fails.
//   scripts/check-pdf-tracing.mjs
//                             reads Next's file-tracing manifest after a build,
//                             because a browser that is not IN the deployment
//                             makes no PDF wherever it works locally. That is
//                             the fault an appointee actually hit.
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
// ---------------------------------------------------------------------------
// A THROWAWAY SIGNING KEY, SO THE LETTER UNDER TEST IS A SEALED ONE.
//
// NOT A SECRET. It is forty-eight x's, and the University's real key is in the
// deployment environment where it belongs. But without SOMETHING here,
// `sealDocument` returns an unsealed seal, the panel correctly prints "this
// copy carries no verification seal", and there is no QR code on the page at
// all — so this file was measuring the geometry of a letter no appointee
// receives, and the QR check below found nothing to measure.
// ---------------------------------------------------------------------------
process.env.CREDENTIAL_SECRET = 'x'.repeat(48);

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
  salary_currency: 'USD',
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

// A REALISTIC APPOINTMENT CARRIES ALLOWANCES AND A JOB DESCRIPTION. Measuring
// a letter without them measures a letter the University does not send: 047's
// allowances each add a row, and the job-description reference adds a
// paragraph. The page count is decided by exactly these.
const letter = await appointmentLetterHtml({
  allowances: [
    { kind: 'housing', amount: 400, currency: 'USD', period: 'month' },
    { kind: 'transport', amount: 150, currency: 'USD', period: 'month' },
    { kind: 'research', amount: 1200, currency: 'USD', period: 'year' },
  ],
  jobDescription: { code: 'ACS-LEC', title: 'Lecturer', version: 2 },
  termsReference: 'the University\u2019s conditions of service in force from time to time',
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
  const closing = document.querySelector('.closing');
  return {
    height: Math.ceil(body.getBoundingClientRect().height),
    width: Math.ceil(body.getBoundingClientRect().width),
    signTop: sign ? Math.round(sign.getBoundingClientRect().top) : -1,
    sealTop: seal ? Math.round(seal.getBoundingClientRect().top) : -1,
    sealBottom: seal ? Math.round(seal.getBoundingClientRect().bottom) : -1,
    closingTop: closing ? Math.round(closing.getBoundingClientRect().top) : -1,
    closingHeight: closing ? Math.ceil(closing.getBoundingClientRect().height) : 0,
  };
});

// ---------------------------------------------------------------------------
// THE PAGE COUNT COMES FROM A REAL PDF, NOT FROM DIVIDING A HEIGHT.
//
// The DOM height was the measurement here for a long time and it is wrong the
// moment anything carries `break-inside: avoid`: the block moves to the next
// page when printed and the DOM knows nothing about it, so a letter that
// prints on two pages measures as two pages' worth of pixels whatever the
// breaks actually do. Chromium is asked to print it and the pages are counted.
// ---------------------------------------------------------------------------
const pdf = await page.pdf({ format: 'A4', printBackground: true });
const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
// WHAT THE LAST PAGE ACTUALLY CARRIES. The closing paragraph, the signature
// and the seal move as one block, so the last page holds either that block
// alone or that block plus whatever preceded it. Either way this is the number
// that decides whether page two reads as the end of a letter or as a mistake.
const lastPageInk = measured.closingTop >= 0
  && (measured.closingTop % A4_PRINTABLE_HEIGHT) + measured.closingHeight > A4_PRINTABLE_HEIGHT
  ? measured.closingHeight
  : measured.height - ((pages - 1) * A4_PRINTABLE_HEIGHT);

console.log(`      ${measured.height}px of content — ${pages} printed page(s) at A4, `
  + `the last carrying ${lastPageInk}px`);

// ---------------------------------------------------------------------------
// A LAST PAGE THAT IS NEARLY EMPTY IS THE FAULT, NOT A SECOND PAGE.
//
// This asked for ONE page and got it while the letter was thin. A realistic
// appointment letter — salary, three allowances, full terms, a job-description
// reference — is 1109px against a 987px page, and a two-page letter of
// appointment is entirely normal for a university.
//
// What is not normal is turning over to find a QR code on a blank sheet. The
// closing paragraph, signature and seal are bound together precisely so the
// final page carries a sentence, a signature and a seal rather than the last
// forty pixels of a box.
// ---------------------------------------------------------------------------
check('the last page carries a real part of the letter, not a stray line',
  lastPageInk >= Math.round(A4_PRINTABLE_HEIGHT / 5), true);

// ---------------------------------------------------------------------------
// THE CEILING MOVED, BECAUSE THE UNIVERSITY REPLACED THE LETTER.
//
// This was two, and the reasoning was sound for the letter it was written
// against: a table, a paragraph of typed terms, and a signature. Three pages of
// THAT would have meant something had overflowed.
//
// The University then supplied the letter it actually wanted — thirteen
// numbered sections covering status, delegated authority, accountability,
// remuneration, conduct, conditions, review, confidentiality, termination, the
// job description and acceptance. That document is three pages when it is
// correct, and clamping it at two would mean cutting sections the University
// asked for.
//
// FOUR, NOT UNLIMITED. The duties printed under "Principal Areas of
// Responsibility" come from the job description, and a job description with
// forty clauses would run this to six pages without anybody deciding to. Four
// is where it stops being a letter.
//
// THE REAL GUARD IS THE ONE ABOVE, and it did not change: whatever the page
// count, the last page must carry a real part of the letter rather than a QR
// code on a blank sheet.
// ---------------------------------------------------------------------------
check('a full letter runs to no more than four pages', pages <= 4, true);

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
{
  // THE DOM COORDINATE IS NOT WHERE IT PRINTS. This reported "the signature
  // sits 866px into page 1" while the signature was in fact printing on page
  // two — because `.closing` carries `break-inside: avoid` and the DOM knows
  // nothing about the break. A position read from the DOM and described as a
  // page is a measurement of the wrong thing stated confidently.
  //
  // The signature is inside `.closing`, so what matters is where that block
  // lands, and `lastPageInk` above is exactly that.
  const signInClosing = measured.signTop >= measured.closingTop
    && measured.signTop <= measured.closingTop + measured.closingHeight;
  check('the signature is bound to the closing block, so it cannot be orphaned',
    signInClosing, true);
  check('and the seal is bound with it',
    measured.sealTop >= measured.closingTop
      && measured.sealBottom <= measured.closingTop + measured.closingHeight + 1, true);
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
    // LOWERCASE "the", DELIBERATELY. The record holds "The University Council"
    // — correct in a table cell and wrong in the middle of "made on the
    // authority of The University Council", which is what the letter said
    // until `midSentence` was added. The article is the only thing touched.
    ['the appointing authority', 'authority of the University Council'],
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
  check('the remuneration is on the letter', text.includes('USD 450,000 per month'), true);

  // THE ALLOWANCES ARE EACH THEIR OWN LINE, in their own currency and period,
  // and nothing is added together. A letter printing one combined figure would
  // state a number the University never decided.
  for (const [what, line] of [
    ['housing', 'Housing allowance — USD 400 per month'],
    ['transport', 'Transport allowance — USD 150 per month'],
    // ON ITS OWN BASIS. An annual allowance beside a monthly salary, printed as
    // annual, because summing them would be arithmetic the University did not do.
    ['research', 'Research allowance — USD 1,200 per annum'],
  ]) {
    check(`the ${what} allowance is on the letter, on its own basis`,
      text.includes(line), true);
  }

  // AND THE JOB DESCRIPTION IS REFERENCED BY CODE AND VERSION. "See the
  // attached job description" is useless in five years; this names the document
  // the University can still produce.
  check('the job description is referenced by code', text.includes('ACS-LEC'), true);
  check('…and by version', text.includes('version 2'), true);
  check('…and the conditions of service are pointed at',
    text.includes('conditions of service'), true);

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
  // ---------------------------------------------------------------------
  // THE SEAL IS NO LONGER THE LAST THING, AND THAT IS THE UNIVERSITY'S OWN
  // LAYOUT. Their draft closes with OFFICIAL DOCUMENT VERIFICATION and then
  // ATTACHMENTS — the verification block first, then the manifest of what
  // travels with the letter. A list of attachments printed above the seal
  // would sit between the signature and the code, which is the one place
  // nothing should go.
  //
  // So what is asserted is the ORDER, which is what actually matters:
  // signature, then seal, then the manifest, and nothing after it.
  // ---------------------------------------------------------------------
  const tail = await page.evaluate(() => {
    const seal = document.querySelector('.seal');
    const att = document.querySelector('.attachments');
    const annex = document.querySelector('.annex');
    const box = (el) => (el
      ? {
        top: Math.round(el.getBoundingClientRect().top + window.scrollY),
        bottom: Math.round(el.getBoundingClientRect().bottom + window.scrollY),
      }
      : { top: -1, bottom: -1 });
    return {
      sealBottom: box(seal).bottom,
      attTop: box(att).top,
      attBottom: box(att).bottom,
      annexTop: box(annex).top,
      sigBottom: box(document.querySelector('.sign')).bottom,
      hasAnnex: !!annex,
    };
  });

  check('the attachments are listed after the seal', tail.attTop >= tail.sealBottom, true);

  // ---------------------------------------------------------------------
  // THE QR ON THE REAL LETTER, MEASURED ON THE REAL LETTER.
  //
  // `officialDocument.test.mjs` measures the panel in isolation. This measures
  // the square that is actually in the document this file renders — because
  // the panel is only correct here if the letter passes it the right argument,
  // and it did not for the whole life of the letter.
  //
  // 88 CSS px is 23.3mm. Divide by the modules across and compare against the
  // ~0.5mm floor for a phone camera reading off paper.
  // ---------------------------------------------------------------------
  const qrModules = Number((/viewBox="0 0 (\d+)/.exec(letter.html) ?? [])[1] ?? -1);
  const qrMm = (88 / 3.7795) / qrModules;
  console.log(`      QR: ${qrModules} modules, ${qrMm.toFixed(2)}mm each`);
  check('the letter’s own QR is coarse enough to scan', qrMm >= 0.5, true);
  // ---------------------------------------------------------------------
  // PAGE ONE IS THE APPOINTMENT, AND THE ANNEX IS EVERYTHING ELSE.
  //
  // The University: "endeavor for the letter, signature and seal to enter the
  // first page. That is the appointment. Page two then can carry job
  // descriptions and other things as seen in the letter."
  //
  // This used to assert that the manifest was the LAST THING ON THE DOCUMENT,
  // which encoded the old shape: one continuous flow with the signature
  // arriving on page three. It is now the last thing on PAGE ONE, and the
  // annex follows it on a page of its own.
  //
  // MEASURED AGAINST THE PRINTABLE HEIGHT, not against the flow. A signature
  // 20px past the bottom of page one is on page two, and only this number
  // knows that.
  // ---------------------------------------------------------------------
  check('the manifest is the last thing on page one',
    tail.hasAnnex ? tail.annexTop >= tail.attBottom : tail.attBottom >= measured.height - 40,
    true);

  if (tail.hasAnnex) {
    const onPageOne = (px) => px > 0 && px <= A4_PRINTABLE_HEIGHT;
    console.log(`      page one ends at ${tail.attBottom}px of ${A4_PRINTABLE_HEIGHT}px`);

    check('the signature is on page one', onPageOne(tail.sigBottom), true);
    check('the seal is on page one', onPageOne(tail.sealBottom), true);
    check('and everything before the annex fits on page one',
      onPageOne(tail.attBottom), true);
  }
}

await browser.close();

console.log(failures === 0 ? '\nAll letter page checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
