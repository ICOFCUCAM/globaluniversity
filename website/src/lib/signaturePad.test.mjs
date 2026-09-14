// ---------------------------------------------------------------------------
// SIGNING ON THE SCREEN.
//
// Run with:  node src/lib/signaturePad.test.mjs
//
// ---------------------------------------------------------------------------
// WHAT THIS GUARDS
// ---------------------------------------------------------------------------
//
// The University: "is it not good to create a signature pad where I can sign on
// the screen with a pen and store?"
//
// It is, and it removes a class of problem rather than fixing another instance
// of one. Every fault the signature has had came out of photographing paper:
// the sheet was white and opaque so it covered the rule; the ink was a fraction
// of the frame so the signature printed small; the lighting was uneven so a
// threshold had to be guessed at. A pen on glass has no paper.
//
// WHAT HAS TO BE TRUE OF WHAT THE PAD PRODUCES, and is measured below:
//
//   1. THE GROUND IS TRANSPARENT. If the pad stored its white canvas, a drawn
//      signature would cover the rule exactly as a photographed one did — the
//      same bug arriving by a new road.
//   2. IT IS CROPPED TO THE INK. The pad is a wide box and a signature occupies
//      part of it. The stylesheet fits the IMAGE to the rule, so storing the
//      box is how a signature comes to print small.
//   3. IT IS ACTUALLY THE STROKE THAT WAS DRAWN, in the right place. A pad that
//      returned a blank or a fixed image would pass 1 and 2 and be useless.
//   4. CLEARING GIVES BACK NOTHING, rather than an empty image that would be
//      stored as a signature.
//
// ---------------------------------------------------------------------------
// DRIVEN WITH A REAL POINTER
// ---------------------------------------------------------------------------
//
// Playwright's mouse produces genuine pointer events, so the handlers under
// test are the ones that run in front of an officer — `setPointerCapture`, the
// minimum-distance filter, the quadratic smoothing. Dispatching synthetic
// events would test a different code path from the one that ships.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
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
const cache = join(here, '../../node_modules/.cache/icof/pad');
mkdirSync(cache, { recursive: true });

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

console.log('\nA signature drawn on the screen is a signature, on nothing\n');

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

// --- The real component, mounted -------------------------------------------
//
// Bundled from source rather than reimplemented, so this measures the pad the
// University uses and not a copy of it that drifted.
const entry = join(cache, 'entry.jsx');
writeFileSync(entry, `
import React from 'react';
import { createRoot } from 'react-dom/client';
import SignaturePad from '${join(here, '../components/settings/SignaturePad.tsx')}';

function Harness() {
  const [uri, setUri] = React.useState(undefined);
  window.__result = () => uri;
  return <div style={{ width: 520, padding: 20 }}>
    <SignaturePad onDone={(u) => { window.__last = u; setUri(u); }} />
  </div>;
}
createRoot(document.getElementById('root')).render(<Harness />);
`);

const bundle = join(cache, 'pad.js');
execFileSync('npx', [
  'esbuild', entry, '--bundle', '--outfile=' + bundle, '--log-level=error',
  '--loader:.jsx=jsx', '--jsx=automatic', '--define:process.env.NODE_ENV="production"',
  `--alias:@=${join(here, '..')}`,
]);

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 700, height: 500 } });
await page.setContent('<body style="margin:0"><div id="root"></div></body>');
await page.addScriptTag({ content: readFileSync(bundle, 'utf8') });
await page.waitForSelector('canvas');

const box = await page.locator('canvas').boundingBox();

// --- Sign it ---------------------------------------------------------------
//
// Two strokes, in the LEFT HALF of the pad and the UPPER part of it, so the
// crop has something to prove: a pad that returned its whole canvas would show
// ink across the middle of the returned image rather than filling it.
const sign = async () => {
  const y = box.y + (box.height * 0.45);
  await page.mouse.move(box.x + 40, y);
  await page.mouse.down();
  for (let i = 0; i <= 30; i += 1) {
    const t = i / 30;
    await page.mouse.move(
      box.x + 40 + (t * (box.width * 0.4)),
      y - (Math.sin(t * Math.PI * 2) * 22),
    );
  }
  await page.mouse.up();

  // A second stroke, the way a real hand lifts — and CLEARLY BELOW the first,
  // because the undo check below reads the image's height. Drawn inside the
  // first stroke's own vertical range it changes no bounding box, and the check
  // passes or fails on nothing.
  await page.mouse.move(box.x + 60, y + 44);
  await page.mouse.down();
  await page.mouse.move(box.x + 150, y + 40);
  await page.mouse.up();
};

await sign();
await page.locator('button', { hasText: 'Use this signature' }).click();
await page.waitForFunction(() => typeof window.__last === 'string');

const m = await page.evaluate(async () => {
  const uri = window.__last;
  const im = new Image();
  await new Promise((r) => { im.onload = r; im.src = uri; });
  const c = document.createElement('canvas');
  c.width = im.width; c.height = im.height;
  const cx = c.getContext('2d');
  cx.drawImage(im, 0, 0);
  const d = cx.getImageData(0, 0, im.width, im.height).data;

  let inked = 0;
  let firstRow = -1;
  let lastRow = -1;
  for (let y = 0; y < im.height; y += 1) {
    let rowHasInk = false;
    for (let x = 0; x < im.width; x += 1) {
      if (d[((((y * im.width) + x)) * 4) + 3] > 24) { inked += 1; rowHasInk = true; }
    }
    if (rowHasInk) { if (firstRow < 0) firstRow = y; lastRow = y; }
  }
  const at = (x, y) => d[((((y * im.width) + x)) * 4) + 3];
  return {
    w: im.width,
    h: im.height,
    corners: [at(0, 0), at(im.width - 1, 0), at(0, im.height - 1), at(im.width - 1, im.height - 1)],
    inkFraction: inked / (im.width * im.height),
    // How much of the image's height the ink spans. Storing the whole canvas
    // would leave wide empty bands top and bottom.
    verticalSpan: (lastRow - firstRow + 1) / im.height,
    bytes: Math.round((uri.length - uri.indexOf(',') - 1) * 0.75),
  };
});

console.log(`      ${m.w}×${m.h}, ink ${(m.inkFraction * 100).toFixed(1)}%,`
  + ` spanning ${(m.verticalSpan * 100).toFixed(0)}% of its height`);

// 1. THE GROUND IS TRANSPARENT
check('the corners of the stored image are transparent',
  m.corners.every((a) => a === 0), true);

// 2. CROPPED TO THE INK
//
// The pad is 520 wide at 2× — about 1000px of canvas — and the signature was
// drawn across less than half of it. Anything near that width means the box was
// stored rather than the signature.
check('it is cropped to the signature, not the whole pad', m.w < 600, true);
// A MARGIN IS KEPT ON PURPOSE, so the strokes are not clipped flush — about 2%
// of the width on each side. Measured at 85% of the height for a signature this
// shape, so the floor is set below that and well above the ~20% a stored
// whole-pad image would give.
check('…and the ink fills what is kept, rather than sitting in a wide box',
  m.verticalSpan > 0.7, true);

// 3. IT IS THE STROKE THAT WAS DRAWN
check('there is real ink in it', m.inkFraction > 0.02, true);
// A filled rectangle would also have ink. A signature is a line: most of its
// bounding box is empty.
check('…and it is a line rather than a block', m.inkFraction < 0.4, true);

check('and it is small enough to live in a letter row', m.bytes < 200_000, true);

// 4. CLEARING GIVES BACK NOTHING
await page.locator('button', { hasText: 'Clear' }).click();
const cleared = await page.evaluate(() => window.__last);
check('clearing the pad returns nothing at all', cleared, null);

// AND THE CONTROLS ARE OFF WHEN THERE IS NOTHING TO ACT ON. A "Use this
// signature" that is live over an empty pad stores a blank image.
const disabled = await page.locator('button', { hasText: 'Use this signature' }).isDisabled();
check('…and nothing can be stored from an empty pad', disabled, true);

// --- UNDO TAKES BACK ONE STROKE, NOT EVERYTHING ---------------------------
await sign();
await page.locator('button', { hasText: 'Undo the last stroke' }).click();
await page.locator('button', { hasText: 'Use this signature' }).click();
await page.waitForFunction(() => typeof window.__last === 'string');
const afterUndo = await page.evaluate(async () => {
  const im = new Image();
  await new Promise((r) => { im.onload = r; im.src = window.__last; });
  return { w: im.width, h: im.height };
});
// The crossbar sat below the first stroke, so removing it must shorten the
// image. Equal height would mean undo removed nothing.
check('undo removes the last stroke and keeps the rest',
  afterUndo.h < m.h && afterUndo.w > 0, true);

await browser.close();

console.log(failures ? `\n${failures} check(s) failed.\n` : '\nAll signature pad checks passed.\n');
process.exit(failures ? 1 : 0);
