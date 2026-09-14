// ---------------------------------------------------------------------------
// THE PDF THE APPOINTEE DOWNLOADS IS A REAL PDF, AT A4.
//
// Run with:  node src/lib/renderPdf.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS SEPARATELY FROM THE PAGE MEASUREMENT
// ---------------------------------------------------------------------------
//
// `appointmentLetterPages.test.mjs` opens the letter in Playwright and reads
// the geometry of the LAID-OUT PAGE. That is a different code path from the one
// production uses: the route calls `renderPdf`, which drives `puppeteer-core`
// against `@sparticuz/chromium` and asks for `page.pdf({ preferCSSPageSize })`.
// Everything the appointee actually receives is decided in those two lines.
//
// `preferCSSPageSize` is the whole reason this is measured rather than assumed.
// Without it Puppeteer's own `format` wins, the document's `@page { size: A4 }`
// is ignored, and a letter typeset for A4 comes out US Letter — half an inch
// shorter, clipping the footer, and wrong on every printer in Cameroon. The
// setting is one word and the failure is invisible until somebody prints one.
//
// So this renders a letter the way the route does and reads the MediaBox out of
// the resulting bytes.
//
// ---------------------------------------------------------------------------
// CHROMIUM HERE, CHROMIUM THERE
// ---------------------------------------------------------------------------
//
// The sandbox has a full browser, so `CHROMIUM_PATH` is set and the serverless
// pack is not unpacked. On Vercel there is no local browser and
// `@sparticuz/chromium` supplies one — which only works if the deployment
// carries it. That is a different question and `scripts/check-pdf-tracing.mjs`
// answers it, by reading Next's own file-tracing manifest after a build.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;
const check = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`ok    ${label}`);
  } else {
    failures++;
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
  }
};

const here = new URL('.', import.meta.url).pathname;
const cache = join(here, '../../node_modules/.cache/icof');
mkdirSync(cache, { recursive: true });

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

console.log('\nThe letter becomes a PDF, and the PDF is A4\n');

if (!existsSync(CHROME)) {
  // NOT A PASS. A measurement that did not happen is not a measurement that
  // succeeded — the same rule the page test keeps.
  console.error('FAIL  there is no Chromium at ' + CHROME + ', so nothing was measured');
  process.exit(1);
}
process.env.CHROMIUM_PATH = CHROME;

// A THROWAWAY SIGNING KEY. Forty-eight x's — not the University's, which lives
// in the deployment environment. Without one the letter carries no seal and the
// document under measurement is not the document an appointee receives.
process.env.CREDENTIAL_SECRET = 'x'.repeat(48);

// The native packages stay external: bundling `@sparticuz/chromium` is the
// exact fault this whole area exists because of.
const bundle = (file) => {
  const out = join(cache, file.replace('.ts', '.pdftest.mjs'));
  execFileSync('npx', [
    'esbuild', join(here, file), '--bundle', '--format=esm', '--platform=node',
    `--outfile=${out}`, '--log-level=error', `--alias:@=${join(here, '..')}`,
    '--external:qrcode', '--external:puppeteer-core', '--external:@sparticuz/chromium',
  ]);
  return out;
};

const { appointmentLetterHtml } = await import(bundle('appointmentLetter.ts'));
const { renderPdf, pdfFilename } = await import(bundle('renderPdf.ts'));

// A SPECIMEN, NOT A REAL APPOINTEE. Nobody in the register is named here.
const built = await appointmentLetterHtml({
  appointment: {
    full_name: 'A Specimen Appointee',
    postal_address: 'PO Box 1, Buea, Cameroon',
    position_title: 'Lecturer in Systematic Theology',
    unit_name: 'Faculty of Theology',
    employment_type: 'permanent',
    start_date: '2026-10-01',
    probation_months: 6,
    place_of_duty: 'Buea',
    reports_to_name: 'The Dean',
    working_hours: '40 hours weekly',
    appointing_authority: 'The Vice-Chancellor',
    authority_decided_on: '2026-09-01',
    terms: 'As set out in the conditions annexed.',
    salary_amount: 500000,
    salary_currency: 'XAF',
    salary_period: 'monthly',
    status: 'letter_generated',
  },
  reference: 'IGUC/HR/APT/2026/9001',
  version: 1,
});

const pdf = await renderPdf(typeof built === 'string' ? built : built.html);

// --- It is a PDF, not an HTML file with an optimistic name -----------------
check('the bytes are a PDF', pdf.subarray(0, 5).toString('latin1'), '%PDF-');
check('and there is a document in it', pdf.length > 20_000, true);

// --- EVERY page is A4 ------------------------------------------------------
//
// Every one, not the first. `preferCSSPageSize` applies to the whole document,
// but a stylesheet that set a different size on the annex would produce a
// letter whose first page passed a check of the first page.
const boxes = [...pdf.toString('latin1').matchAll(/\/MediaBox\s*\[([^\]]+)\]/g)]
  .map((m) => m[1].trim().split(/\s+/).map(Number))
  .map(([x0, y0, x1, y1]) => [(x1 - x0) / 72 * 25.4, (y1 - y0) / 72 * 25.4]);

check('the document has pages with a stated size', boxes.length > 0, true);

// A4 is 210 × 297mm. Chromium rounds to the CSS pixel, so 209.9 is A4 and
// 215.9 × 279.4 (US Letter) is what this is here to refuse.
const a4 = boxes.filter(([w, h]) => Math.abs(w - 210) < 1 && Math.abs(h - 297) < 1);
check(`all ${boxes.length} page(s) are A4 and not US Letter`, a4.length, boxes.length);

// --- The appointment is on page one, the rest follows it -------------------
//
// The University's ruling: "the letter, signature and seal to enter the first
// page. That is the appointment. Page two then can carry job descriptions."
// A one-page PDF would mean the annex vanished.
check('the appointment is followed by an annex', boxes.length >= 2, true);

// --- A person can find the file again --------------------------------------
check('the file is named for the reference',
  pdfFilename('IGUC/HR/APT/2026/9001'), 'IGUC-HR-APT-2026-9001.pdf');

console.log(failures ? `\n${failures} check(s) failed.\n` : '\nAll PDF checks passed.\n');
process.exit(failures ? 1 : 0);
