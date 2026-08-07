// ---------------------------------------------------------------------------
// Do the pinned scenes actually get crossed?
//
//   node scripts/check-scenes.mjs [url]
//
// WHAT THIS CATCHES. A pinned scene holds a photograph in a sticky child while
// the reader scrolls, and the next section is meant to rise up over the held
// frame. That requires the next section to be in the POSITIONED layer and to be
// opaque. Miss either and the page does not throw, does not warn, and does not
// look obviously broken — it looks like the sticky is jammed, or like a section
// has gone transparent for no reason. It is one of the harder CSS faults to
// read backwards from the symptom, so it is worth asserting directly.
//
// Needs a running server, so it is not part of `npm test` — that suite is pure
// Node and must stay runnable without a build.
// ---------------------------------------------------------------------------

import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:3200/';
const EXE = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let failures = 0;
let skipped = 0;
const fail = (m) => { failures++; console.error(`  FAIL  ${m}`); };
const pass = (m) => console.log(`  ok    ${m}`);

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 500) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 45));
  }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(400);

const scenes = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('[data-pinned]')) {
    const next = el.nextElementSibling;
    const cs = next ? getComputedStyle(next) : null;
    const sticky = el.querySelector(':scope > *');
    out.push({
      chapter: el.getAttribute('data-chapter') || '(unnamed)',
      height: Math.round(el.getBoundingClientRect().height),
      childSticky: sticky ? getComputedStyle(sticky).position : null,
      childHeight: sticky ? Math.round(sticky.getBoundingClientRect().height) : 0,
      hasNext: !!next,
      nextTag: next ? next.tagName.toLowerCase() : null,
      nextPosition: cs ? cs.position : null,
      nextBg: cs ? cs.backgroundColor : null,
      nextZ: cs ? cs.zIndex : null,
    });
  }
  return out;
});

console.log(`\nPinned scenes on ${url}\n`);
if (!scenes.length) fail('no [data-pinned] scenes found at all');

const opaque = (c) => {
  if (!c || c === 'transparent') return false;
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return false;
  const parts = m[1].split(',').map((n) => parseFloat(n));
  return parts.length < 4 || parts[3] >= 0.99;
};

for (const s of scenes) {
  console.log(`  ${s.chapter}  (${s.height}px tall, sticky child ${s.childHeight}px)`);
  if (s.childSticky === 'sticky') pass('the frame is pinned'); else fail(`${s.chapter}: child is "${s.childSticky}", not sticky — nothing will hold`);
  if (s.height > s.childHeight + 40) pass('there is scroll travel to pin against'); else fail(`${s.chapter}: outer height ${s.height} barely exceeds the sticky child ${s.childHeight} — the pin will be imperceptible`);
  if (!s.hasNext) { fail(`${s.chapter}: nothing follows it, so nothing can cross it`); continue; }
  if (s.nextPosition && s.nextPosition !== 'static') pass(`the next <${s.nextTag}> is positioned (${s.nextPosition}) and can cross`);
  else fail(`${s.chapter}: the next <${s.nextTag}> is position:static — it will paint UNDERNEATH the pinned frame`);
  if (opaque(s.nextBg)) pass(`the next <${s.nextTag}> is opaque (${s.nextBg})`);
  else fail(`${s.chapter}: the next <${s.nextTag}> has background ${s.nextBg} — the held photograph will show through its text`);
}

// The cross itself: scroll to the seam and confirm the covering section really
// is over the pinned frame at the point where they meet.
for (const s of scenes) {
  const crossed = await page.evaluate((chapter) => {
    const el = [...document.querySelectorAll('[data-pinned]')].find(
      (n) => (n.getAttribute('data-chapter') || '(unnamed)') === chapter,
    );
    const next = el.nextElementSibling;
    if (!next) return null;
    // Put the seam a third of the way up the viewport.
    const y = window.scrollY + next.getBoundingClientRect().top - window.innerHeight * 0.6;
    // 'instant' matters: the page sets scroll-behavior: smooth, so a plain
    // scrollTo is still animating when the probe reads the seam and the check
    // reports "not in view" for a seam that is about to be exactly in view.
    window.scrollTo({ top: y, behavior: 'instant' });
    return true;
  }, s.chapter);
  if (!crossed) continue;
  await page.waitForTimeout(700);
  const hit = await page.evaluate((chapter) => {
    const el = [...document.querySelectorAll('[data-pinned]')].find(
      (n) => (n.getAttribute('data-chapter') || '(unnamed)') === chapter,
    );
    const next = el.nextElementSibling;
    const r = next.getBoundingClientRect();
    if (r.top > window.innerHeight - 8 || r.top < 0) return { skip: true };
    // What is actually painted a few pixels inside the covering section?
    const probe = document.elementFromPoint(window.innerWidth * 0.5, r.top + 6);
    return { skip: false, inside: !!probe && (probe === next || next.contains(probe)) };
  }, s.chapter);
  if (hit.skip) { skipped++; console.log(`  ..    ${s.chapter}: seam not in view, cross NOT probed`); }
  else if (hit.inside) pass(`${s.chapter}: the next layer paints over the held frame at the seam`);
  else fail(`${s.chapter}: at the seam the pinned frame is still on top — the cross is not happening`);
}

await browser.close();
console.log('');
if (failures) {
  console.error(`${failures} check(s) failed.\n`);
  process.exit(1);
}
// A skipped probe is not a pass. Saying so plainly is the whole point of
// having the check — a green line for something that was never measured is
// worse than no line at all.
if (skipped) {
  console.log(`Every pinned scene holds. ${skipped} cross(es) could not be probed — not verified.\n`);
  process.exit(2);
}
console.log('Every pinned scene holds, and every one of them gets crossed.\n');
