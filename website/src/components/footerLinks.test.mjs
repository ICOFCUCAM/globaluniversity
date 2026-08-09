// ---------------------------------------------------------------------------
// EVERY LINK ON THE SITE GOES SOMEWHERE.
//
// Run with:  node src/components/footerLinks.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
//
// The footer carried `/careers`, and so did the Academics mega-menu. There is
// no src/app/careers, and `careers` is not one of the twenty slugs in pages.ts,
// so both were the not-found page — from the footer, which is on every page of
// the site, and from the navigation bar, which is too.
//
// Nothing caught it because nothing could. A dead link does not fail the build:
// Next.js resolves hrefs at request time, so `<Link href="/careers">` compiles
// exactly as cleanly as one that works. It does not fail a type check either.
// It fails for a visitor, quietly, and the only person who finds out is the one
// who wanted the thing.
//
// The footer also listed Research twice — once from site.nav, once hardcoded
// underneath — which is the other failure of a list that is part loop and part
// hand-written.
//
// ---------------------------------------------------------------------------
// IT READS THE COMPILED CONTENT, NOT THE SOURCE TEXT
// ---------------------------------------------------------------------------
//
// The first draft matched hrefs with a regular expression over site.ts and
// reported eight working links as duplicates: `nav` holds six top-level entries
// AND their nested mega-menu groups, and a pattern cannot tell the difference
// between the two while the footer very much can — it renders only the top
// level. So site.ts is bundled and imported, and the arrays are read as arrays.
//
// A checker that cries wolf is worse than no checker, because the next real
// failure is read as noise too. That happened twice while writing this file.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
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

const src = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const app = join(src, 'app');
const footer = readFileSync(join(src, 'components/Footer.tsx'), 'utf8');

const cache = join(src, '../node_modules/.cache/icof');
mkdirSync(cache, { recursive: true });
const out = join(cache, 'site.mjs');
execFileSync('npx', [
  'esbuild', join(src, 'content/site.ts'),
  '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error',
  `--alias:@=${src}`,
]);
const { site } = await import(out);
const pagesTs = readFileSync(join(src, 'content/pages.ts'), 'utf8');
const contentSlugs = new Set([...pagesTs.matchAll(/slug: '([a-z0-9-]+)'/g)].map((m) => m[1]));

/**
 * Walk the route tree segment by segment, taking a dynamic segment where there
 * is no literal one.
 *
 * AN EARLIER VERSION ONLY LOOKED AT THE FIRST SEGMENT and reported
 * `/degrees/bachelors-degrees` and three siblings as dead. They are not:
 * `src/app/degrees` holds no page.tsx of its own, only `[slug]/page.tsx`, which
 * serves all four.
 */
function resolves(href) {
  const parts = href.replace(/^\//, '').split(/[/#?]/).filter(Boolean);
  if (!parts.length) return existsSync(join(app, 'page.tsx'));

  // ONE SEGMENT IS DECIDED HERE AND NOT BY THE WALK BELOW, because src/app has
  // a root [slug] catch-all and the walk would hand it anything: /careers found
  // `[slug]/page.tsx`, called that resolved, and reported a 404 as healthy.
  // That route calls notFound() for a slug it does not know, so the only
  // single-segment links that exist are a real folder or a real content slug.
  if (parts.length === 1) {
    return existsSync(join(app, parts[0], 'page.tsx')) || contentSlugs.has(parts[0]);
  }

  let dir = app;
  for (const part of parts) {
    const literal = join(dir, part);
    if (existsSync(literal)) { dir = literal; continue; }
    const dynamic = readdirSync(dir, { withFileTypes: true })
      .find((e) => e.isDirectory() && /^\[.+\]$/.test(e.name));
    if (!dynamic) return false;
    dir = join(dir, dynamic.name);
  }
  return existsSync(join(dir, 'page.tsx'));
}

/** Every href in the navigation, top level and mega-menu alike. */
function everyNavHref() {
  const found = [];
  const walk = (node) => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node && typeof node === 'object') {
      if (typeof node.href === 'string') found.push(node.href);
      Object.values(node).forEach(walk);
    }
  };
  walk(site.nav);
  walk(site.portals);
  return found;
}

console.log('\nEvery internal link resolves\n');

const fromFooter = [...footer.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]);
const internal = [...fromFooter, ...everyNavHref()]
  .filter((h) => h.startsWith('/') && !h.startsWith('/#'));

check('nothing in the footer or the navigation is a 404',
  [...new Set(internal.filter((h) => !resolves(h)))], []);

console.log('\nAnd the Explore column names nothing twice\n');

// THE DUPLICATE THAT SHIPPED. site.nav gained Research when it was promoted to
// a top-level entry, and the footer was already printing a hardcoded one, so
// the column listed it on two consecutive lines.
{
  const fromNav = site.nav.map((i) => i.href);         // only the top level, which is what it renders
  const exploreUl = /Explore\s*<\/h2>([\s\S]*?)<\/ul>/.exec(footer);
  const byHand = [...(exploreUl?.[1] ?? '').matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]);

  check('the column reads the navigation and finds it', fromNav.length > 0, true);
  check('…and adds nothing the navigation already carries',
    byHand.filter((h) => fromNav.includes(h)), []);

  const all = [...fromNav, ...byHand];
  check('…and names no destination twice',
    [...new Set(all.filter((h, i) => all.indexOf(h) !== i))], []);
}

// Reported, not forbidden: how many labels the portals column spends on how
// many destinations is the University's decision, and one worth seeing.
{
  const hrefs = site.portals.map((p) => p.href);
  const distinct = [...new Set(hrefs)];
  console.log(
    `\n      note: Student Portals offers ${hrefs.length} labels across `
    + `${distinct.length} destination${distinct.length === 1 ? '' : 's'} (${distinct.join(', ')}).\n`,
  );
}

process.exit(failures === 0 ? 0 : 1);
