// ---------------------------------------------------------------------------
// WHAT AN OFFICIAL LETTER ACTUALLY DOES ON A PAGE.
//
// Run with:  node src/lib/correspondenceLetterPages.test.mjs
//
// ---------------------------------------------------------------------------
// THE DIFFERENCE FROM THE APPOINTMENT LETTER, AND WHY IT NEEDS ITS OWN FILE
// ---------------------------------------------------------------------------
//
// An appointment letter has a bounded shape: a table of known rows and a block
// of standard terms. Its page count is predictable and pinned at one.
//
// A letter from the Vice-Chancellor does not. The body is whatever was typed,
// and it can run to three pages legitimately. So the thing to measure here is
// not "does it fit on one page" — it is the failure that actually embarrasses
// the University: a final page carrying nothing but a signature and a QR code.
//
// This therefore renders a SHORT letter and a LONG one, and checks the same
// rule against both.
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

const out = join(cache, 'correspondenceLetter.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'correspondenceLetter.ts'), '--bundle', '--format=esm',
  '--platform=node', `--outfile=${out}`, '--log-level=error',
  `--alias:@=${join(here, '..')}`, '--external:qrcode',
]);
const { correspondenceLetterHtml, PRINTABLE } = await import(out);

const base = {
  kind: 'government',
  originating_office: 'vice-chancellor',
  subject: 'Accreditation of the Faculty of Theology',
  recipient_name: 'The Honourable Minister',
  recipient_org: 'Ministry of Higher Education',
  recipient_address: 'Yaoundé, Cameroon',
  recipient_email: 'registry@example.test',
  status: 'authorized',
  initiated_by: 'the-vc',
};

const SHORT = 'The University writes to acknowledge the Ministry’s correspondence of last '
  + 'month and to confirm that the documentation requested has been assembled and will be '
  + 'forwarded under separate cover before the end of the quarter.';

// A REALISTIC LONG LETTER, not a placeholder repeated. The page break is decided
// by where the paragraphs actually fall, and a body of "lorem" measures nothing.
const LONG = [
  SHORT,
  '',
  'The University wishes to place on record the steps it has taken since the Ministry’s '
  + 'inspection. Each of the matters raised has been assigned to a named officer, and the '
  + 'Registrar maintains a register of the actions taken and the dates on which they were '
  + 'completed. That register is available to the Ministry on request.',
  '',
  'On the question of records, the University has moved its student records, admissions '
  + 'decisions and academic results onto a single system with an append-only history. Every '
  + 'decision now records the officer who took it, the date, and the state of the record '
  + 'before and after. Documents issued by the University carry a verification code and may '
  + 'be checked independently by any institution receiving them.',
  '',
  'On the question of staffing, appointments are made by the Vice-Chancellor on the '
  + 'recommendation of the offices concerned, and every appointment letter is archived in the '
  + 'form in which it was issued. The University would be glad to demonstrate this to the '
  + 'Ministry’s officers at their convenience.',
  '',
  'The University remains at the Ministry’s disposal and would welcome a further meeting '
  + 'at whatever date is convenient.',
].join('\n');

const browser = await chromium.launch({ executablePath: CHROME });

async function measure(label, body) {
  const letter = await correspondenceLetterHtml({
    correspondence: { ...base, body },
    reference: 'VC-2026-0042',
    issuedOn: '2026-09-12',
    version: 1,
    signatoryName: 'The Vice-Chancellor',
    signatoryRole: 'Vice-Chancellor',
    siteUrl: 'https://example.test',
  });
  const file = join(cache, `correspondence-${label}.html`);
  writeFileSync(file, letter.html);

  // THE VIEWPORT IS THE PRINTABLE AREA, NOT A WINDOW. Measured in a default
  // 1280-wide window the paragraphs lay out at nearly twice the width they will
  // actually have, every width check passes trivially and the height is wrong.
  const page = await browser.newPage({
    viewport: { width: PRINTABLE.width, height: 1123 },
  });
  await page.goto(`file://${file}`);
  await page.emulateMedia({ media: 'print' });
  const m = await page.evaluate(() => {
    const sign = document.querySelector('.sign');
    const seal = document.querySelector('.seal');
    const foot = document.querySelector('.footer');
    const footStyle = foot ? getComputedStyle(foot) : null;
    return {
      footerPosition: footStyle?.position ?? 'absent',
      footerVisible: footStyle?.display ?? 'absent',
      footerText: foot?.textContent?.trim() ?? '',
      height: Math.ceil(document.body.getBoundingClientRect().height),
      width: Math.ceil(document.body.getBoundingClientRect().width),
      signTop: sign ? Math.round(sign.getBoundingClientRect().top) : -1,
      sealTop: seal ? Math.round(seal.getBoundingClientRect().top) : -1,
      sealBottom: seal ? Math.round(seal.getBoundingClientRect().bottom) : -1,
      text: document.body.innerText,
      overflowing: [...document.querySelectorAll('*')]
        .filter((el) => el.getBoundingClientRect().right
          > document.body.getBoundingClientRect().width + 1)
        .map((el) => el.tagName.toLowerCase()),
    };
  });
  await page.close();
  return m;
}

// ---------------------------------------------------------------------------
// THE RULE, APPLIED TO BOTH.
//
// Less than a fifth of a page above the signature means the signature IS the
// page: a reader turns over and finds a name, a line and a QR code. The
// threshold was once "more than 40px", and the signature sat at exactly 40 — so
// the check passed by one pixel while the defect it was written for was
// present. A margin that narrow is not a test, it is a coincidence.
// ---------------------------------------------------------------------------
const MINIMUM_ABOVE = Math.round(PRINTABLE.height / 5);

for (const [label, body] of [['short', SHORT], ['long', LONG]]) {
  console.log(`\nA ${label} letter from the Vice-Chancellor\n`);
  const m = await measure(label, body);
  const pages = Math.ceil(m.height / PRINTABLE.height);
  const pageOfSignature = Math.floor(m.signTop / PRINTABLE.height);
  const above = m.signTop - (pageOfSignature * PRINTABLE.height);
  console.log(`      ${m.height}px tall — ${pages} page(s), signature ${above}px into `
    + `page ${pageOfSignature + 1}`);

  check('the signature shares its page with the letter',
    above >= MINIMUM_ABOVE || pageOfSignature === 0, true);
  // A DOCUMENT WIDER THAN THE PAGE loses its right edge when printed, and the
  // thing on the right edge of this letter is the verification code.
  check('nothing runs past the right edge', m.overflowing, []);
  check('the seal sits below the signature', m.sealTop > m.signTop, true);
  check('and it is the last thing on the document', m.sealBottom >= m.height - 40, true);

  // ---------------------------------------------------------------------
  // THE RUNNING FOOTER, MEASURED AS A COMPUTED STYLE.
  //
  // "position: fixed" is the ONLY mechanism Chromium has for repeating an
  // element on every printed page — CSS paged-media margin boxes are the
  // standard way and Chromium does not implement them. So the footer repeating
  // is exactly equivalent to it computing as fixed UNDER PRINT, and that is
  // what this asks. Reading the stylesheet would not: the rule sits inside an
  // @media print block, and a screen-media measurement reports display: none
  // and position: static while the printed page is correct.
  // ---------------------------------------------------------------------
  check('the footer is fixed under print, which is what repeats it',
    m.footerPosition, 'fixed');
  check('…and it is visible under print', m.footerVisible !== 'none', true);
  // WHAT A READER OF PAGE THREE NEEDS. A later page separated from the first is
  // a sheet with no reference on it and nothing saying who issued it.
  check('…and carries the reference', m.footerText.includes('IGUC/VC/2026/0042'), true);
  check('…and where to check it', m.footerText.includes('/verify'), true);

  // READ OFF THE RENDERED PAGE, not the source. A field present in the markup
  // and hidden by CSS is absent from the document.
  for (const [what, value] of [
    ['the office it comes from', 'Office of the Vice-Chancellor'],
    ['the recipient', 'The Honourable Minister'],
    ['their organisation', 'Ministry of Higher Education'],
    ['the subject', 'Accreditation of the Faculty of Theology'],
    ['the date', '12 September 2026'],
    ['the reference', 'IGUC/VC/2026/0042'],
    ['the signatory', 'Vice-Chancellor'],
  ]) {
    check(`${what} is visible on the page`, m.text.includes(value), true);
  }

  // THE LINE THAT MUST NOT BE THERE. A letter the Vice-Chancellor signs
  // themselves carrying "BY AUTHORITY OF THE VICE-CHANCELLOR" is the authority
  // citing itself, and printing it here would make the real ones on appointment
  // letters read as a formula too.
  check('it does not claim authority from itself',
    /BY AUTHORITY OF/.test(m.text), false);
}

// ---------------------------------------------------------------------------
// AND AN INCOMPLETE LETTER IS REFUSED RATHER THAN PRINTED BLANK.
// Prove a guard by breaking it.
// ---------------------------------------------------------------------------
console.log('\nA letter that is not ready does not become a document\n');

{
  let refused = false;
  try {
    const { correspondenceLetterHtml: gen } = await import(out);
    await gen({
      correspondence: { ...base, body: SHORT, recipient_name: '' },
      reference: 'VC-2026-0043',
      issuedOn: '2026-09-12',
      version: 1,
      signatoryName: 'The Vice-Chancellor',
      signatoryRole: 'Vice-Chancellor',
      siteUrl: 'https://example.test',
    });
  } catch { refused = true; }
  check('a letter addressed to nobody cannot be generated', refused, true);
}

await browser.close();

console.log(failures === 0
  ? '\nAll correspondence page checks passed.'
  : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
