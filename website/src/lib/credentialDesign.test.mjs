// ---------------------------------------------------------------------------
// THE DESIGN VALIDATOR — and the one thing it must never do, which is refuse
// the University's own certificate.
//
// Run with:  node src/lib/credentialDesign.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
//
// It shipped refusing it. The built-in certificate carries an 11mm ornate
// frame; the validator's ceiling was 10mm, invented rather than measured. So
// "Reset to the built-in default" produced a design that could not be
// published, under a message — "Border width must be between 0 and 10 mm" —
// that reads as though a border were compulsory when the truth was the
// opposite.
//
// Nobody caught it because every test of a design used a design somebody had
// just built for the test. The first case below is therefore the important
// one: EVERY DESIGN THE APPLICATION SHIPS MUST PASS THE APPLICATION'S OWN
// VALIDATOR. A default that cannot be published is not a default.
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
const out = join(dir, 'credentialDesign.mjs');
execFileSync('npx', [
  'esbuild', new URL('./credentialTemplate.ts', import.meta.url).pathname,
  '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error',
  `--alias:@=${new URL('..', import.meta.url).pathname.replace(/\/$/, '')}`,
]);

const {
  validateDesign, defaultDesign, maxBorderWidthMm, isSignatureImage, SIGNATURE_MAX_BYTES,
  DEFAULT_CERTIFICATE_DESIGN, DEFAULT_TRANSCRIPT_DESIGN,
} = await import(out);

/** A one-pixel transparent PNG, standing in for a scanned signature. */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAA'
  + 'C0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

console.log('\nThe designs the University actually ships\n');

// THE CASE THAT WAS MISSING. Run it against every kind the studio can reset to.
for (const kind of ['certificate', 'transcript']) {
  check(`the built-in ${kind} can be published`, validateDesign(defaultDesign(kind), kind), []);
}
check('…and the certificate default is the one the studio resets to',
  defaultDesign('certificate').borderWidthMm, DEFAULT_CERTIFICATE_DESIGN.borderWidthMm);
check('…as is the transcript default',
  defaultDesign('transcript').borderWidthMm, DEFAULT_TRANSCRIPT_DESIGN.borderWidthMm);

console.log('\nThe border, which is a choice\n');

const cert = DEFAULT_CERTIFICATE_DESIGN;
const withBorder = (border, borderWidthMm, pageSize = 'A4') =>
  validateDesign({ ...cert, border, borderWidthMm, pageSize }, 'certificate');

// NO BORDER IS A DESIGN, NOT A FAULT. A width left behind from a frame that
// was switched off draws nothing, so it is not something to refuse a
// publication over.
check('a design with no border publishes', withBorder('none', 1), []);
check('…even carrying a width from the frame it used to have', withBorder('none', 40), []);
check('…and even an absurd one, because none of it is drawn', withBorder('none', 900), []);

// The University's own frame, and the frame it would have if somebody wanted a
// heavier one. Both are legitimate.
check('the University’s 11mm ornate frame publishes', withBorder('ornate', 11), []);
check('a 40mm frame publishes — wide, but a choice', withBorder('ornate', 40), []);

console.log('\nAnd what is still refused, which is a frame that eats the sheet\n');

// MEASURED AGAINST THE PAPER, not against a number somebody picked. A quarter
// of the short edge leaves half the sheet in the middle; beyond that the
// document is a frame with a note inside it.
check('a frame past a quarter of an A4 sheet is refused', withBorder('ornate', 60).length, 1);
check('…and the message names the paper it was measured against',
  withBorder('ornate', 60)[0].includes('A4'), true);
check('…and says how to have no frame at all',
  withBorder('ornate', 60)[0].includes('Border: none'), true);
// Letter is 216mm across, so its ceiling is higher — and stated as its own.
// The ceilings are read from the same function the studio's slider reads, so a
// change to the rule cannot leave the two disagreeing again.
check('A4 stops at a quarter of 210mm', maxBorderWidthMm('A4'), 53);
check('Letter stops at a quarter of 216mm', maxBorderWidthMm('Letter'), 54);
check('the same width may pass on Letter, which is a wider sheet',
  withBorder('ornate', 54, 'Letter'), []);
check('while A4 refuses it', withBorder('ornate', 54).length, 1);
check('a negative width is refused', withBorder('single', -1).length, 1);

console.log('\nThe checks that were already there, still there\n');

// A GUARD ON THE GUARD. Loosening the border rule must not have loosened
// anything else — these are the refusals that keep an unreadable document off
// a graduate's wall.
check('white text on white paper is still refused',
  validateDesign({ ...cert, ink: '#fffdf5' }, 'certificate').length > 0, true);
check('a design with no signatory is still refused',
  validateDesign({ ...cert, signatories: [] }, 'certificate').length > 0, true);
check('a design with the verification code switched off is still refused',
  validateDesign({ ...cert, security: { ...cert.security, qr: false } }, 'certificate').length > 0, true);
check('and a signatory with no office is still refused',
  validateDesign({ ...cert, signatories: [{ name: 'A Person', office: '  ' }] }, 'certificate').length > 0,
  true);

console.log('\nAffixing a signature\n');

// A SIGNATURE IS OPTIONAL. The University has always signed by hand, and a
// design with no image must publish exactly as before.
check('a design with no signature publishes', validateDesign(cert, 'certificate'), []);

const signed = (signature) => validateDesign({
  ...cert, signatories: [{ name: 'A Registrar', office: 'Registrar', signature }],
}, 'certificate');

check('a scanned PNG publishes', signed(PNG), []);
check('a WebP does too', signed(PNG.replace('image/png', 'image/webp')), []);

// A LINK IS NOT A SIGNATURE. The document would stop carrying one the day the
// host moved, and until then every graduate opening their certificate would
// tell that host they had.
check('a web address is refused', signed('https://iguc.net/signatures/registrar.png').length, 1);
check('…and the message says why a sealed document cannot use one',
  signed('https://iguc.net/x.png')[0].includes('complete in itself'), true);

// AN SVG IS A DOCUMENT, not an image: it can carry script, and it would be
// rendered inside a page that shows sealed credentials.
check('an SVG is refused', signed('data:image/svg+xml;base64,PHN2Zy8+').length, 1);
check('and so is a PDF', signed('data:application/pdf;base64,JVBERi0=').length, 1);

// A PHOTOGRAPH OF A PAGE, pasted in by mistake.
check('something far too large to be a signature is refused',
  signed(`data:image/png;base64,${'A'.repeat(SIGNATURE_MAX_BYTES)}`).length, 1);
check('…and is told what to do about it',
  signed(`data:image/png;base64,${'A'.repeat(SIGNATURE_MAX_BYTES)}`)[0]
    .includes('transparent background'), true);

check('the shape check agrees with the validator',
  [isSignatureImage(PNG), isSignatureImage('https://iguc.net/x.png'),
    isSignatureImage('data:image/svg+xml;base64,PHN2Zy8+')],
  [true, false, false]);

process.exit(failures === 0 ? 0 : 1);
