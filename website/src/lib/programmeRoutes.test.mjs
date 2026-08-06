// ---------------------------------------------------------------------------
// One programme, one URL.
//
// Run with:  node src/lib/programmeRoutes.test.mjs
//
// WHY THIS FILE EXISTS. Adding /programmes/<slug> pages to the catalogue gave
// three programmes — the theology, ministry and Christian leadership diplomas —
// a second address, because those three also have a record in site.ts and were
// already served at /programs/<slug>. Two URLs for one degree is not a harmless
// convenience: search engines split the ranking between them, and the applicant
// who lands on the thinner one never learns the other exists.
//
// The fix is a redirect list in next.config.mjs. That file is plain ESM and
// cannot import the TypeScript catalogue, so the slugs are written out by hand
// — which is exactly the arrangement that drifts the first time a programme is
// added. This test is what stops it drifting: it derives the collisions from
// the catalogue and fails if next.config.mjs does not cover every one.
//
// It also checks the reverse — a redirect for a slug that no longer collides is
// a permanent redirect pointing at nothing, and 308s are cached by browsers for
// a long time.
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
const bundle = join(dir, 'routes-test.mjs');
execFileSync('npx', [
  'esbuild', new URL('../content/programmeCatalogue.ts', import.meta.url).pathname,
  '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`, '--log-level=error',
  `--alias:@=${new URL('..', import.meta.url).pathname.replace(/\/$/, '')}`,
], { stdio: 'inherit' });

const { ALL_PROGRAMMES, DIPLOMA_PROGRAMMES, hasProgramPage, programmeHref } = await import(bundle);
const { default: config } = await import(new URL('../../next.config.mjs', import.meta.url).pathname);
const redirects = await config.redirects();

// ---------------------------------------------------------------------------

// The slugs that need a redirect are the ones that were BUILT at /programmes
// before the collision was found — the hand-written diplomas that also have a
// site.ts record. Everything else that could collide is closed off by
// `dynamicParams = false` on the route and 404s, which is correct for an
// address that was never published.
const collisions = DIPLOMA_PROGRAMMES
  .filter((p) => hasProgramPage(p.slug))
  .map((p) => p.slug)
  .sort();

check(
  'the catalogue has programmes that also have a /programs page — otherwise this test is asleep',
  collisions.length > 0,
  true,
);

const covered = redirects
  .filter((r) => r.source.startsWith('/programmes/'))
  .map((r) => r.source.replace('/programmes/', ''))
  .sort();

check('every colliding slug is redirected in next.config.mjs', covered, collisions);

for (const slug of collisions) {
  const r = redirects.find((x) => x.source === `/programmes/${slug}`);
  check(`  ${slug} → /programs/${slug}`, r?.destination, `/programs/${slug}`);
  check(`  ${slug} is permanent`, r?.permanent, true);
}

// The links on the cards and the level pages must point at the surviving URL,
// not at the one that redirects — a link to a 308 is a wasted round trip and,
// in a sitemap, an instruction to index a redirect.
for (const slug of ALL_PROGRAMMES.filter((p) => hasProgramPage(p.slug)).map((p) => p.slug)) {
  check(`  programmeHref('${slug}') skips the redirect`, programmeHref(slug), `/programs/${slug}`);
}

const nonCollider = ALL_PROGRAMMES.find((p) => !hasProgramPage(p.slug))?.slug;
check(
  `programmeHref keeps catalogue-only programmes on /programmes ('${nonCollider}')`,
  programmeHref(nonCollider),
  `/programmes/${nonCollider}`,
);

// No two programmes may share a slug, or one of them is unreachable entirely.
const slugs = ALL_PROGRAMMES.map((p) => p.slug);
check('no duplicate slugs in the catalogue', slugs.length, new Set(slugs).size);

console.log(failures === 0 ? '\nAll route checks passed.' : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
