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

// Sticky scenes are one technique and fixed windows are another; a page may
// legitimately use either or both. Absence of one is not a fault — silently
// checking nothing would be.
console.log(`\nScene bands on ${url}\n`);
if (!scenes.length) console.log('  ..    no [data-pinned] sticky scenes on this page');

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

// -------------------------------------------------------------------------
// Fixed windows: the photograph must NOT move in the viewport while the copy
// travels across it, and the copy must never ride up under the sticky header.
//
// The first is the whole mechanism, and it is deleted by any ancestor gaining
// transform / filter / will-change / contain — a change that would look like a
// performance tweak in review while silently turning the window back into an
// ordinary band.
//
// The second was a real fault: at 155svh the copy reached 14px from the top of
// a 950px viewport, 84px inside the header, and the heading was sliced in half.
// -------------------------------------------------------------------------
const windows = await page.evaluate(() => [...document.querySelectorAll('[data-fixed-window]')]
  .map((el) => el.getAttribute('data-chapter') || '(unnamed)'));

if (windows.length) console.log('\nFixed windows\n');
const headerH = await page.evaluate(() => {
  const h = document.querySelector('header');
  return h ? Math.round(h.getBoundingClientRect().height) : 0;
});

for (const chapter of windows) {
  const reads = [];
  for (const f of [0.05, 0.5, 0.95]) {
    await page.evaluate(([c, frac]) => {
      const el = [...document.querySelectorAll('[data-fixed-window]')]
        .find((n) => (n.getAttribute('data-chapter') || '(unnamed)') === c);
      const r = el.getBoundingClientRect();
      const top = window.scrollY + r.top;
      window.scrollTo({ top: top + Math.max(r.height - window.innerHeight, 0) * frac, behavior: 'instant' });
    }, [chapter, f]);
    // Wait for the picture, don't guess. These are lazy, and sampling on a
    // timer measures whatever happened to have arrived — which is how a
    // working band gets reported as a blank one.
    await page.waitForFunction((c) => {
      const el = [...document.querySelectorAll('[data-fixed-window]')]
        .find((n) => (n.getAttribute('data-chapter') || '(unnamed)') === c);
      const img = el && el.querySelector('img');
      return !!img && img.complete && img.naturalWidth > 0;
    }, chapter, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(250);
    reads.push(await page.evaluate((c) => {
      const el = [...document.querySelectorAll('[data-fixed-window]')]
        .find((n) => (n.getAttribute('data-chapter') || '(unnamed)') === c);
      const img = el.querySelector('img');
      const copy = el.querySelector('h1, h2, h3, p');
      const ir = img.getBoundingClientRect();
      return {
        // Liveness, checked before geometry. An image that never loaded, or one
        // that has been re-anchored off screen, reports 0px drift — the same
        // reading a perfectly working fixed window gives. Drift alone cannot
        // tell the two apart, so it must never be the only assertion.
        loaded: img.complete && img.naturalWidth > 0,
        // clientWidth/clientHeight, not innerWidth/innerHeight: the latter
        // include the scrollbar gutter, so a correct full-bleed image measures
        // ~15px narrower than the window wherever scrollbars take space, and
        // the check would fail a page that is fine.
        atViewport: Math.abs(ir.top) <= 2
          && Math.abs(ir.height - document.documentElement.clientHeight) <= 4
          && Math.abs(ir.width - document.documentElement.clientWidth) <= 4,
        imgTop: Math.round(ir.top),
        imgLeft: Math.round(ir.left),
        copyTop: Math.round(el.querySelector('div.relative').getBoundingClientRect().top),
        firstTextTop: copy ? Math.round(copy.getBoundingClientRect().top) : 0,
      };
    }, chapter));
  }
  if (process.env.DEBUG_SCENES) console.log('    debug reads:', JSON.stringify(reads));
  const drift = Math.max(...reads.map((r) => r.imgTop)) - Math.min(...reads.map((r) => r.imgTop))
    + Math.max(...reads.map((r) => r.imgLeft)) - Math.min(...reads.map((r) => r.imgLeft));
  const travel = Math.max(...reads.map((r) => r.copyTop)) - Math.min(...reads.map((r) => r.copyTop));
  const highest = Math.min(...reads.map((r) => r.firstTextTop));

  console.log(`  ${chapter}`);
  // Liveness FIRST. A photograph that never loaded, or that is parked off
  // screen, reports 0px drift and would otherwise sail through the check that
  // is supposed to prove the technique works. Ask a broken build to look
  // broken before asking a working one to look right.
  if (reads.every((r) => r.loaded)) pass('the photograph actually loaded');
  else fail(`${chapter}: the photograph never loaded — a blank band cannot be a fixed window, and it reports 0px drift`);
  if (reads.every((r) => r.atViewport)) pass('it fills the viewport at every depth');
  else fail(`${chapter}: the photograph is not viewport-sized at the viewport origin (top ${reads.map((r) => r.imgTop).join('/')}) — position:fixed has been re-anchored, so this is an ordinary scrolling band`);
  if (drift <= 2) pass(`the photograph is stationary (${drift}px drift across the band)`);
  else fail(`${chapter}: the photograph moved ${drift}px — an ancestor has gained transform/filter/will-change/contain and this is no longer a fixed window`);
  if (travel > 150) pass(`the copy travels across it (${travel}px)`);
  else fail(`${chapter}: the copy only travels ${travel}px — the band is too short to read as a window`);
  if (highest > headerH + 8) pass(`the copy stays clear of the ${headerH}px header (nearest ${highest}px)`);
  else fail(`${chapter}: the copy reaches ${highest}px, under the ${headerH}px header — reduce the band height`);
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
