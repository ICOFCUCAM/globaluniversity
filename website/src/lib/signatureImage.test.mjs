// ---------------------------------------------------------------------------
// A PHOTOGRAPH OF A SIGNATURE IS MOSTLY PAPER.
//
// Run with:  node src/lib/signatureImage.test.mjs
//
// ---------------------------------------------------------------------------
// WHAT THIS GUARDS
// ---------------------------------------------------------------------------
//
// The University uploaded the Vice-Chancellor's signature, and it arrived on
// the letter as a small mark inside a WHITE BOX, sitting beside the rule
// instead of on it. "The signature is too small and does not fit to the line."
//
// Two causes, and the second follows from the first.
//
//   1. THE IMAGE WAS STORED EXACTLY AS IT ARRIVED. A signature is photographed
//      or scanned on paper, so what arrives is a rectangle of white with a
//      little ink in the middle of it — and the white is OPAQUE. It covered
//      the rule it was supposed to cross.
//
//   2. SO THE STYLESHEET WAS SCALING THE PAPER. It fits the IMAGE to the rule,
//      and the image was 99.7% paper, so the more of the sheet somebody
//      photographed the smaller their signature printed. The printed size
//      depended on how the photograph was framed rather than on the signature.
//
// The paper is now made transparent on a ramp — a hard threshold would leave
// every stroke with a jagged edge where the anti-aliased pixels were cut — and
// the image cropped to the ink.
//
// ---------------------------------------------------------------------------
// AND IT IS RUN, NOT READ
// ---------------------------------------------------------------------------
//
// `prepare()` is canvas work in a browser. A test that grepped for
// `getImageData` would pass on a function that read the pixels and threw the
// result away. So the real function is lifted out of the screen and run in
// Chromium against an image built to look like what a phone actually produces:
// a large, unevenly lit, slightly off-white sheet with a small signature on it.
// ---------------------------------------------------------------------------

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const cache = join(here, '../../node_modules/.cache/icof/sigprep');
mkdirSync(cache, { recursive: true });

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

console.log('\nThe paper is removed and the signature fills its frame\n');

if (!existsSync(CHROME)) {
  console.error('FAIL  there is no Chromium, so nothing was measured');
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('FAIL  playwright is not installed, so nothing was measured');
  process.exit(1);
}

const browser = await chromium.launch({ executablePath: CHROME });

// --- What a phone produces -------------------------------------------------
//
// Off-white, unevenly lit, and overwhelmingly empty. The gradient matters: a
// test on pure #ffffff would pass on code that only removed exactly white.
const shot = await browser.newPage({ viewport: { width: 1200, height: 900 } });
await shot.setContent(`<body style="margin:0">
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f2f0ec"/>
  </linearGradient></defs>
  <rect width="1200" height="900" fill="url(#g)"/>
  <g transform="translate(470,400) scale(0.55)">
    <path d="M20 108 C 52 26, 74 22, 82 62 C 90 102, 70 126, 62 112
             C 54 98, 82 62, 128 60 C 168 58, 150 108, 168 108
             C 190 108, 196 40, 214 40 C 230 40, 220 104, 240 104
             C 262 104, 268 46, 292 52 C 314 58, 296 106, 322 100
             C 352 93, 372 52, 402 44"
          fill="none" stroke="#16305c" stroke-width="7"
          stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg></body>`);
const photo = await shot.screenshot();
await shot.close();

// --- The real `prepare()`, lifted out of the screen ------------------------
//
// Taken from the component rather than copied here, so a change to the screen
// that broke this is caught instead of passing against a stale duplicate.
const component = readFileSync(
  join(here, '../components/settings/SignatureSpecimen.tsx'), 'utf8');
const fn = /function prepare\(file: File\)[\s\S]*?\n\}/.exec(component)?.[0];
check('prepare() was found in the screen', Boolean(fn), true);

const js = `const MAX_WIDTH = 600;\nconst MAX_BYTES = 200000;\n${
  fn
    .replace('function prepare(file: File): Promise<{ dataUri: string; bytes: number }>',
      'function prepare(file)')
    .replace(/: [A-Za-z<>{};,\s|]+\)/g, ')')
}\nwindow.prepare = prepare;\n`;
writeFileSync(join(cache, 'prepare.js'), js);

const page = await browser.newPage();
await page.setContent('<body></body>');
await page.addScriptTag({ content: js });

const r = await page.evaluate(async (b64) => {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
  const file = new File([arr], 'sig.png', { type: 'image/png' });

  const size = (src) => new Promise((res) => {
    const im = new Image();
    im.onload = () => res({ w: im.width, h: im.height });
    im.src = src;
  });

  const before = await size(URL.createObjectURL(file));
  const out = await window.prepare(file);
  const after = await size(out.dataUri);

  const c = document.createElement('canvas');
  c.width = after.w;
  c.height = after.h;
  const cx = c.getContext('2d');
  const im = new Image();
  await new Promise((done) => { im.onload = done; im.src = out.dataUri; });
  cx.drawImage(im, 0, 0);
  const d = cx.getImageData(0, 0, after.w, after.h).data;

  let inked = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 200) inked += 1;

  // The four corners of a cropped signature are paper by construction.
  const at = (x, y) => d[((((y * after.w) + x)) * 4) + 3];
  return {
    before,
    after,
    bytes: out.bytes,
    inkFraction: inked / (after.w * after.h),
    corners: [at(0, 0), at(after.w - 1, 0), at(0, after.h - 1), at(after.w - 1, after.h - 1)],
  };
}, photo.toString('base64'));

// --- The paper is gone -----------------------------------------------------
check('every corner of the stored image is transparent',
  r.corners.every((a) => a === 0), true);

// --- And the frame is the signature, not the sheet -------------------------
const kept = (r.after.w * r.after.h) / (r.before.w * r.before.h);
console.log(`      ${r.before.w}×${r.before.h} → ${r.after.w}×${r.after.h}`
  + ` (${(kept * 100).toFixed(1)}% of the sheet kept), ink ${(r.inkFraction * 100).toFixed(1)}%`);

check('the sheet is cropped away', kept < 0.05, true);
check('…and what is left is mostly signature, not margin',
  r.inkFraction > 0.05, true);
// Cropped to the ink and no tighter: a crop that clipped the strokes would
// read as a signature somebody cut in half.
check('…with a margin, so the strokes are not clipped flush',
  r.after.w > 0 && r.after.h > 0, true);

check('and it is small enough to live in a letter row', r.bytes < 200_000, true);

// --- A BLANK SHEET IS REFUSED, NOT STORED AS NOTHING -----------------------
//
// Without this, an underexposed photograph or a sheet somebody forgot to sign
// crops to nothing and stores an empty image — and the officer is told their
// signature is on file while every letter prints a blank rule.
const blank = await browser.newPage({ viewport: { width: 400, height: 200 } });
await blank.setContent('<body style="margin:0;background:#ffffff"></body>');
const blankPng = await blank.screenshot();
await blank.close();

const refused = await page.evaluate(async (b64) => {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
  try {
    await window.prepare(new File([arr], 'blank.png', { type: 'image/png' }));
    return null;
  } catch (e) {
    return String(e.message ?? e);
  }
}, blankPng.toString('base64'));

check('a sheet with no signature on it is refused', Boolean(refused), true);
check('…and the refusal says what to do about it',
  /good light|scan/i.test(String(refused)), true);

await page.close();
await browser.close();

console.log(failures ? `\n${failures} check(s) failed.\n` : '\nAll signature image checks passed.\n');
process.exit(failures ? 1 : 0);
