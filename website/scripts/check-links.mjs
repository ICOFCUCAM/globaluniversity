// ---------------------------------------------------------------------------
// Does every link on the homepage go anywhere?
//
//   node scripts/check-links.mjs [url]
//
// WHY THIS EXISTS. Writing GlobalPresence I linked "Visit our campuses" to
// /campuses. There is no /campuses route — the page is /campus-life — so the
// homepage shipped a 404 on a primary call to action. Nothing caught it:
// TypeScript does not type-check href strings, the build does not resolve
// internal links, and the section rendered perfectly.
//
// I found it only because I happened to curl the route while checking
// something else. That is not a system, and the class of bug is common enough
// to deserve one: every internal href, followed, at every deploy.
//
// Needs a running server, so it is not part of `npm test`.
// ---------------------------------------------------------------------------

import { chromium } from 'playwright';

const base = (process.argv[2] || 'http://localhost:3205/').replace(/\/$/, '');
const EXE = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
await page.goto(base + '/', { waitUntil: 'networkidle' });

// Every distinct internal href on the page, including ones inside scenes that
// are currently faded out — they are still reachable by keyboard and by
// scrolling, so a dead one is still a dead one.
const hrefs = await page.evaluate(() => {
  const out = new Set();
  for (const a of document.querySelectorAll('a[href]')) {
    const h = a.getAttribute('href');
    if (!h || h.startsWith('#') || h.startsWith('mailto:') || h.startsWith('tel:')) continue;
    if (/^https?:\/\//i.test(h)) continue; // external — not this check's job
    out.add(h.split('#')[0]);
  }
  return [...out].sort();
});
await browser.close();

console.log(`\n${hrefs.length} internal links on the homepage\n`);

let bad = 0;
for (const h of hrefs) {
  const url = base + (h.startsWith('/') ? h : '/' + h);
  let status = 0;
  try {
    const res = await fetch(url, { redirect: 'manual' });
    status = res.status;
  } catch {
    status = 0;
  }
  const ok = status === 200 || (status >= 300 && status < 400);
  if (!ok) {
    bad++;
    console.error(`  FAIL  ${String(status).padStart(3)}  ${h}`);
  } else {
    console.log(`  ok    ${String(status).padStart(3)}  ${h}`);
  }
}

console.log('');
if (bad) {
  console.error(`${bad} homepage link(s) go nowhere.\n`);
  process.exit(1);
}
console.log('Every link on the homepage resolves.\n');
