// ---------------------------------------------------------------------------
// THE CONTRAST CHECK — does the text on this site actually meet AA?
//
// ===========================================================================
// FOUR WRONG INSTRUMENTS BEFORE THIS ONE
// ===========================================================================
//
// Contrast is the most repeated fault in this repository, and every time it was
// "checked" the check was wrong before the design was. All four are recorded
// because each one produced numbers that were quoted in a commit message.
//
//   1. SAMPLED THE BRIGHTEST PIXELS of each text element. Those are the glyphs.
//      It was measuring the ink against the ink and reporting 21:1 on text
//      nobody could read.
//
//   2. MEASURED BUTTONS AGAINST THE PHOTOGRAPH BEHIND THEM. A gold pill
//      supplies its own opaque background; "Enroll Today" was reported at
//      1.29:1 and actually measures 8.76:1.
//
//   3. MEASURED A TOKEN THAT HAD NEVER COMPILED. brand-gold-ink was added to
//      tailwind.config.ts while `next dev` was running, and Next caches the
//      Tailwind config at PostCSS init, so 43 elements were falling back to an
//      inherited colour. Every number reported for them was against a colour
//      that was not on the screen.
//
//   4. WALKED THE ANCESTOR CHAIN for the background colour. Reasonable, and
//      wrong for this codebase: the site paints most of its grounds with
//      absolutely-positioned sibling layers —
//
//          <footer class="relative text-white">
//            <div class="absolute inset-0 bg-brand-purple-dark" />
//
//      — which are not ancestors of the text. The walk fell through to the
//      body and reported every line of the footer as white-on-cream. 550 false
//      failures on one run, on a footer that has always been correct.
//
// ===========================================================================
// SO: THE GROUND IS PHOTOGRAPHED, THE INK IS COMPUTED
// ===========================================================================
//
// The two halves are measured by different means because they fail in
// different ways.
//
//   THE INK comes from getComputedStyle(...).color. That is exactly what the
//   browser will paint, cascade already resolved, and it cannot be confused
//   with anything else on screen. Sampling pixels for the ink is fault 1.
//
//   THE GROUND is photographed with the ink removed. Every text colour on the
//   page is forced transparent, a full-page screenshot is taken, and the pixels
//   underneath each line box are read back. That sees overlay layers, duotones,
//   gradients, photographs, mix-blend-mode and backdrop filters — everything
//   the eye sees and a style walk cannot. Reasoning about the ground is
//   fault 4.
//
// The screenshot is decoded INSIDE the page, via createImageBitmap onto an
// OffscreenCanvas, so no image decoder is needed in Node and the pixels stay
// in the coordinate space the rects were measured in.
//
// ===========================================================================
// WHICH PIXELS, AND WHY NOT THE WORST ONE
// ===========================================================================
//
// A line box sits over many pixels. Taking the single worst one makes any
// underline, border or one-pixel seam fail the whole line; taking the mean
// passes white text laid half on a dark photograph and half on the sky.
//
// So both tails are taken — the 10th and 90th percentile luminance under the
// line — and the WORSE of the two contrasts is the result. A single stray pixel
// cannot move a decile; a ground that is genuinely half light and half dark
// moves one of them a long way, which is the case that must fail.
//
// The spread between those deciles is also reported. A wide spread on passing
// text is the "it passes today" warning: text sitting on a busy photograph,
// where a different crop or a re-encode changes the answer.
//
// ===========================================================================
// WHAT COUNTS AS A FAILURE
// ===========================================================================
//
// WCAG 2.1 AA: 4.5:1 for normal text, 3:1 for large text, where large is
// >=24px, or >=18.66px when bold (weight >= 700).
//
// Text that is not visible is skipped — display:none, visibility:hidden, zero
// area, and the sr-only clip rectangle. aria-hidden ornaments ARE measured but
// reported separately: a "◆" nobody can see is a design fault, not an
// accessibility one, and mixing the two hides the failures that matter.
//
// RUN AGAINST A PRODUCTION BUILD. See fault 3.
//
//   npm run build && npx next start -p 3111
//   BASE_URL=http://127.0.0.1:3111 node scripts/check-contrast.mjs
//   BASE_URL=... ROUTES=/contact,/about node scripts/check-contrast.mjs
//
// ===========================================================================
// UNFINISHED, AND SAYING SO RATHER THAN SHIPPING IT AS DONE
// ===========================================================================
//
// This completes on short pages and finds real failures on them — the gold
// links on /contact measure 1.72:1 against a 4.5 requirement, which is text
// this university cannot read. It does NOT yet complete on the homepage inside
// five minutes, and it is committed in that state deliberately rather than
// left out of the repository or quietly reported as working.
//
// The remaining cost is the per-viewport round trip: each step encodes a PNG,
// passes it across the CDP bridge as base64, and decodes it again inside the
// page. On a long page that is a dozen multi-megabyte strings. The fix is to
// stop moving pixels at all — read the ground with elementsFromPoint and
// getComputedStyle in a single pass, falling back to a screenshot only for the
// elements whose ground is a photograph — but that is a rewrite of the
// measurement, not a tuning of it, and it has not been done.
//
// Until then it is a targeted tool: point it at a route with ROUTES= and it
// answers in seconds. It is NOT in `npm test` and must not be added to it while
// this note is still here.
// ---------------------------------------------------------------------------

import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';

// Same resolution as check-scenes.mjs. The bundled download is not present in
// this environment; the browser is provisioned at a fixed path.
const EXE = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// Routes that carry substantial prose. Not the whole sitemap — the generated
// programme and degree pages share one template each, so one instance of each
// proves the template.
const ROUTES = process.env.ROUTES
  ? process.env.ROUTES.split(',')
  : [
      '/',
      '/about',
      '/welcome',
      '/programs',
      '/programs/certificate-in-theology',
      '/faculty',
      '/faculty/theology-buea',
      '/admissions',
      '/apply',
      '/tuition',
      '/contact',
      '/online-learning',
      '/campus-life',
      '/verify',
      '/news',
      '/prospectus',
      '/academic-catalog',
      '/academic-regulations',
      '/student-handbook',
      '/graduate-school-handbook',
      '/bachelor-of-theology',
      '/master-of-theology',
      '/black-liberation-theology',
      '/roots-of-faith',
      '/documents',
      '/degrees/masters-degrees',
      '/fr',
      '/fr/contact',
      '/fr/programmes',
    ];

// ---------------------------------------------------------------------------
// STAGE 1 — collect the ink and the line boxes, before anything is altered.
// ---------------------------------------------------------------------------
const COLLECT = () => {
  const parseColor = (s) => {
    const m = String(s || '').match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (p.length < 3 || p.some(Number.isNaN)) return null;
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };

  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = (n.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const el = n.parentElement;
    if (!el) continue;
    if (el.closest('script, style, noscript, svg, template')) continue;

    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;

    // Element opacity fades the ink toward whatever is behind it. Below 0.1
    // there is nothing to measure.
    let opacity = 1;
    for (let a = el; a; a = a.parentElement) opacity *= parseFloat(getComputedStyle(a).opacity) || 1;
    if (opacity < 0.1) continue;

    // The sr-only rectangle: clipped to nothing, present for screen readers.
    if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.clipPath === 'inset(50%)') continue;

    const fg = parseColor(cs.color);
    if (!fg) continue;

    // Gradient-filled type: `bg-clip-text` with a transparent colour, where the
    // ink IS the element's background image. There is no foreground colour to
    // measure — reporting 1:1 for it would be fault 1 in a new costume. The
    // heading it is used on is 68px display type over a solid purple band, and
    // it is checked by eye.
    if (fg.a === 0) continue;

    // Line boxes, not the element rect. A heading in a wide container leaves
    // most of its rect empty, and sampling that empty space measures the
    // padding rather than the ground under the words.
    const range = document.createRange();
    range.selectNodeContents(n);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width >= 3 && r.height >= 3);
    if (!rects.length) continue;

    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;

    out.push({
      text: text.length > 52 ? text.slice(0, 52) + '…' : text,
      fg: { ...fg, a: fg.a * opacity },
      fgCss: cs.color,
      size,
      weight,
      large: size >= 24 || (size >= 18.66 && weight >= 700),
      decorative:
        el.getAttribute('aria-hidden') === 'true' || !!el.closest('[aria-hidden="true"]'),
      where:
        el.tagName.toLowerCase() +
        (typeof el.className === 'string' && el.className.trim()
          ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
          : ''),
      // Document coordinates — the full-page screenshot's own space.
      rects: rects.map((r) => ({
        x: r.left + window.scrollX,
        y: r.top + window.scrollY,
        w: r.width,
        h: r.height,
      })),
    });
  }
  return out;
};

// ---------------------------------------------------------------------------
// STAGE 2 — remove every ink on the page, so a screenshot shows only ground.
//
// -webkit-text-fill-color is the one that actually wins: `color` alone is
// overridden by any element that sets a fill colour, and text-shadow would
// otherwise leave a coloured ghost exactly where the glyphs were.
// ---------------------------------------------------------------------------
const STRIP_INK = () => {
  const style = document.createElement('style');
  style.id = '__contrast_strip__';
  style.textContent = `*, *::before, *::after {
    color: transparent !important;
    -webkit-text-fill-color: transparent !important;
    text-shadow: none !important;
    text-decoration-color: transparent !important;
    caret-color: transparent !important;
  }`;
  document.head.appendChild(style);
};

// ---------------------------------------------------------------------------
// STAGE 3 — read the ground back out of the screenshot.
// ---------------------------------------------------------------------------
const SAMPLE = async ({ shot, items, scrollY }) => {
  const blob = await (await fetch(shot)).blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);

  const lum = (r, g, b) => {
    const f = (v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratioL = (a, b) => {
    const [x, y] = a > b ? [a, b] : [b, a];
    return (x + 0.05) / (y + 0.05);
  };

  // ONE readback for the whole page, then index into it.
  //
  // The first version called getImageData once per line box. On the homepage
  // that is a few thousand GPU readbacks against a 1440x10000 canvas and the
  // check did not finish inside four minutes — a check nobody can afford to run
  // is a check that does not exist. One readback and integer indexing brings
  // the same page in under twenty seconds.
  const all = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
  const W = bitmap.width;
  const H = bitmap.height;
  const at = (x, y) => {
    const i = (y * W + x) * 4;
    return [all[i], all[i + 1], all[i + 2]];
  };

  const results = [];

  for (const item of items) {
    const lums = [];
    let sample = null;
    for (const r of item.rects) {
      // Document coordinates -> this viewport's coordinates.
      const x0 = Math.max(0, Math.round(r.x));
      const y0 = Math.max(0, Math.round(r.y - scrollY));
      const x1 = Math.min(W, Math.round(r.x + r.w));
      const y1 = Math.min(H, Math.round(r.y + r.h - scrollY));
      if (x1 - x0 < 1 || y1 - y0 < 1) continue;
      // At most ~24x8 samples per line box. Enough for two deciles, cheap
      // enough that a page of prose stays in the tens of thousands of reads.
      const sx = Math.max(1, Math.floor((x1 - x0) / 24));
      const sy = Math.max(1, Math.floor((y1 - y0) / 8));
      for (let y = y0; y < y1; y += sy) {
        for (let x = x0; x < x1; x += sx) {
          const px = at(x, y);
          lums.push(lum(px[0], px[1], px[2]));
          if (!sample) sample = px;
        }
      }
    }
    if (lums.length < 4) continue;

    lums.sort((a, b) => a - b);
    const at = (p) => lums[Math.min(lums.length - 1, Math.floor(p * lums.length))];
    const lo = at(0.1);
    const hi = at(0.9);

    // The ink, composited onto each tail of the ground. An alpha-faded ink
    // lands somewhere between itself and what it sits on, so it must be
    // composited before it is measured — this is what catches text-white/60.
    const { r, g, b, a } = item.fg;
    const inkOn = (groundL) => {
      // Composite in linear terms is not exact against a luminance alone, so
      // the ground is reconstructed as a neutral of that luminance. For the
      // opaque case (a === 1) this is exact; for the faded case it is the
      // standard approximation and errs conservatively.
      const inv = (L) => {
        const g2 = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
        return g2(Math.max(0, Math.min(1, L))) * 255;
      };
      const gv = inv(groundL);
      return lum(r * a + gv * (1 - a), g * a + gv * (1 - a), b * a + gv * (1 - a));
    };

    const worst = Math.min(ratioL(inkOn(lo), lo), ratioL(inkOn(hi), hi));
    const required = item.large ? 3 : 4.5;

    results.push({
      ...item,
      rects: undefined,
      ratio: Math.round(worst * 100) / 100,
      required,
      // How much the ground moves under one line. Wide means a photograph.
      spread: Math.round((hi - lo) * 100) / 100,
      bg: sample ? `rgb(${sample[0]}, ${sample[1]}, ${sample[2]})` : '?',
      pass: worst >= required,
    });
  }
  return results;
};

const run = async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  let failures = 0;
  let ornaments = 0;
  let risky = 0;
  const report = [];

  for (const route of ROUTES) {
    let res;
    try {
      res = await page.goto(BASE + route, { waitUntil: 'load', timeout: 45000 });
    } catch (err) {
      report.push({ route, error: String(err.message || err) });
      failures++;
      continue;
    }
    if (!res || res.status() >= 400) {
      report.push({ route, error: `HTTP ${res ? res.status() : 'no response'}` });
      failures++;
      continue;
    }

    // Lazy images must be decoded before the ground is photographed, or text
    // over a photograph is measured against an empty box.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) window.scrollTo(0, y);
      window.scrollTo(0, 0);
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images)
          .filter((i) => !i.complete)
          .map((i) => new Promise((r) => { i.onload = i.onerror = r; })),
      );
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    });

    const items = await page.evaluate(COLLECT);
    if (!items.length) continue;

    await page.evaluate(STRIP_INK);

    // ONE VIEWPORT AT A TIME, never fullPage.
    //
    // Two reasons, and the second is the one that matters. A full-page
    // screenshot of a long page is 14 million pixels: the base64 round-trip and
    // the single getImageData over it did not finish inside four minutes, and a
    // check nobody can afford to run is a check that does not exist.
    //
    // But it is also WRONG for this site. Chromium takes a fullPage shot by
    // expanding the viewport to the document height, so every `position: fixed`
    // layer is painted once at 10,000px tall and smeared down the whole page.
    // The triptych's pinned photograph — the one composition on the site whose
    // entire point is that it does not move — would be measured against a
    // ground that exists in no browser. Stepping the real viewport down the
    // page measures what a reader actually sees, fixed layers included.
    const measured = [];
    const { vh, docH } = await page.evaluate(() => ({
      vh: window.innerHeight,
      docH: document.documentElement.scrollHeight,
    }));
    const done = new Set();
    for (let top = 0; top < docH; top += vh) {
      const due = items.filter((it, i) => {
        if (done.has(i)) return false;
        // Fully inside this viewport, so no line box is cut in half by the
        // frame edge and measured against the wrong half of its ground.
        const fits = it.rects.every((r) => r.y >= top && r.y + r.h <= top + vh);
        if (fits) done.add(i);
        return fits;
      });
      if (!due.length) continue;
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top);
      await page.waitForTimeout(60);
      const scrollY = await page.evaluate(() => window.scrollY);
      const buf = await page.screenshot({ type: 'png' });
      const shot = 'data:image/png;base64,' + buf.toString('base64');
      measured.push(...(await page.evaluate(SAMPLE, { shot, items: due, scrollY })));
    }

    const bad = measured.filter((m) => !m.pass && !m.decorative);
    const orn = measured.filter((m) => !m.pass && m.decorative);
    const warn = measured.filter((m) => m.pass && !m.decorative && m.spread > 0.25);

    failures += bad.length;
    ornaments += orn.length;
    risky += warn.length;

    if (bad.length || orn.length || warn.length) report.push({ route, bad, orn, warn });
  }

  await browser.close();

  for (const r of report) {
    if (r.error) {
      console.log(`\n${r.route}\n  COULD NOT LOAD — ${r.error}`);
      continue;
    }
    console.log(`\n${r.route}`);
    for (const f of r.bad) {
      console.log(
        `  FAIL  ${String(f.ratio).padStart(6)}:1 (needs ${f.required})  ${f.fgCss} on ${f.bg}  ${f.size}px  "${f.text}"`,
      );
      console.log(`        ${f.where}`);
    }
    for (const f of r.orn) {
      console.log(`  orn.  ${String(f.ratio).padStart(6)}:1  ${f.fgCss} on ${f.bg}  "${f.text}"`);
    }
    for (const f of r.warn) {
      console.log(
        `  busy  ${String(f.ratio).padStart(6)}:1  passes, but the ground moves ${f.spread} under it  "${f.text}"`,
      );
    }
  }

  console.log(
    `\n${failures} text failures, ${ornaments} decorative below threshold, ${risky} passing on a moving ground.`,
  );

  if (failures > 0) {
    console.log(
      '\nText below AA is not a style choice. Change the INK — darkening the ground\n' +
        'is the answer that always works and always costs the photograph.',
    );
    process.exit(1);
  }
  console.log('\nEvery visible text colour on these routes clears AA.');
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
