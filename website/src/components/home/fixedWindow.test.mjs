// ---------------------------------------------------------------------------
// THE FIXED-WINDOW CANARY.
//
//   node src/components/home/fixedWindow.test.mjs
//
// ===========================================================================
// WHY A STATIC TEST WHEN THERE IS ALREADY A BROWSER ONE
// ===========================================================================
//
// scripts/check-scenes.mjs proves the effect works: it measures the pinned
// photograph's viewport rectangle at three scroll depths and fails on any
// drift. That is the real proof and it stays.
//
// It also needs a production build and a running server, which means it is not
// in `npm test` and will not run on most changes. The mechanism it protects is
// deleted by a one-word edit:
//
//     className="relative z-10 will-change-transform ..."
//
// clip-path clips fixed descendants but does NOT become their containing block.
// `transform`, `filter`, `backdrop-filter`, `perspective`, `contain` and
// `will-change` on any of those DO. Add one of them anywhere between the
// section and the picture and `position: fixed` starts behaving as
// `position: absolute`: the photograph scrolls with the blocks, the composition
// silently becomes an ordinary band, and the diff reads as an optimisation.
// Nothing throws. Nothing warns. The page still looks fine in a screenshot of
// any single moment.
//
// The university asked for this explicitly:
//
//     "what ever adjustment and upgrade you do in feature, make sure this
//      fix window mechanism is included"
//
// So it is asserted in the suite that runs on every change, from the source
// text, with no build and no browser. This test cannot prove the effect
// happens — only check-scenes can do that. It proves the specific edits that
// would silently destroy it have not been made.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

let failures = 0;
const ok = (m) => console.log(`ok    ${m}`);
const bad = (m) => {
  failures++;
  console.error(`FAIL  ${m}`);
};

console.log('\nThe fixed-window mechanism\n');

// Every component that pins a photograph to the viewport. A new one must be
// added here — that is the point of listing them rather than globbing: adding
// a file to this list is a deliberate act, and forgetting to is caught by the
// count assertion at the end.
const PINNED = ['FixedWindow.tsx', 'Triptych.tsx'];

// The properties that establish a containing block for fixed descendants. Any
// one of them, anywhere in these files, re-anchors the picture to the section.
//
// Matched as Tailwind utilities and as raw CSS, because both spellings appear
// in this repository and either would do the damage.
const KILLERS = [
  [/\bwill-change\b|\bwill-change-/, 'will-change'],
  [/(?:^|["\s;{])transform\s*:/, 'transform (CSS)'],
  [/\b(?:scale|rotate|translate|skew)-(?:x-|y-)?\[?\d/, 'a transform utility'],
  [/\bfilter\s*:/, 'filter (CSS)'],
  [/\bbackdrop-blur\b|\bbackdrop-filter\s*:/, 'backdrop-filter'],
  [/\bperspective\s*:/, 'perspective'],
  [/\bcontain\s*:\s*(?:paint|layout|strict|content)/, 'contain'],
];

for (const file of PINNED) {
  const src = readFileSync(join(here, file), 'utf8');
  console.log(`  ${file}`);

  // The two halves of the mechanism.
  if (/clipPath:\s*'inset\(0\)'/.test(src)) ok('    the section clips with inset(0)');
  else bad(`${file}: no clipPath: inset(0) — nothing confines the viewport-sized picture to this section`);

  if (/className="fixed inset-0/.test(src)) ok('    the photograph is position: fixed, full viewport');
  else bad(`${file}: no "fixed inset-0" layer — the picture is not pinned to the viewport`);

  // ONLY THE ANCESTORS, AND ONLY THE CODE.
  //
  // The first version of this test failed all three of its own subjects, and
  // every failure was the test's fault rather than the component's — which is
  // the exact species of error this repository has already made four times over
  // with contrast probes, so it is written down rather than quietly fixed.
  //
  //   It matched its own prose. These files explain the mechanism by NAMING
  //   the properties that break it: "no transform, no filter, no will-change".
  //   A test that greps the whole file flags the warning as the offence.
  //
  //   It matched a leaf. The "Explore the university" arrow uses
  //   group-hover:translate-x-1. That is a transform, and it is harmless: it
  //   establishes a containing block for ITS OWN fixed descendants, of which
  //   there are none. Only an ANCESTOR of the pinned picture can do damage.
  //
  // So: comments are stripped, and only the source that PRECEDES the fixed
  // layer is scanned. In JSX an ancestor is always written before the element
  // it contains, so the prefix is exactly the set of elements that could be
  // wrapping the photograph. This is a heuristic and it is the honest one —
  // it accepts a sibling written earlier as a false positive, which fails
  // loudly, rather than missing a wrapper, which would fail silently.
  const body = src
    .slice(src.indexOf('export default function'))
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const ancestors = body.slice(0, body.indexOf('className="fixed inset-0'));

  for (const [re, name] of KILLERS) {
    if (re.test(ancestors)) {
      bad(
        `${file}: uses ${name} — it establishes a containing block for fixed descendants, so position: fixed becomes position: absolute and the photograph scrolls with the page`,
      );
    }
  }
  ok('    nothing here establishes a containing block for fixed descendants');
}

// The triptych's own shape: three blocks, one opaque in the middle. A rewrite
// that loses the middle block's opacity loses the interruption, and a rewrite
// that gives the outer blocks a background loses the window.
const tri = readFileSync(join(here, 'Triptych.tsx'), 'utf8')
  .slice(readFileSync(join(here, 'Triptych.tsx'), 'utf8').indexOf('export default function'))
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
console.log('\n  Triptych shape\n');

// Counted in the rendered JSX only. The header comment of that file quotes
// "<Image fill>" while explaining the version this replaced, and counting that
// reported a duplicated composition in a file that has exactly one picture.
//
// Both spellings count. The pinned ground is now a generated SVG map drawn with
// a plain <img> — next/image would need dangerouslyAllowSVG enabled site-wide
// to pass it, and has nothing to offer a vector file anyway. Counting only
// <Image> reported ZERO pictures in a composition built entirely around one.
const images = (tri.match(/<Image\b/g) || []).length + (tri.match(/<img\b/g) || []).length;
if (images === 1) ok('    one photograph, not one per block');
else bad(`Triptych: ${images} <Image> elements — the composition is duplicated, not shared`);

if (/bg-brand-purple-dark lg:min-h/.test(tri) || /min-h-\[\d+svh\][^"]*bg-brand-purple-dark/.test(tri))
  ok('    the middle block carries an opaque background');
else bad('Triptych: no opaque background on the middle block — nothing can interrupt the photograph');

// The count assertion. A new pinned component that is not listed above gets no
// protection at all, and the failure would be silent — so the list is checked
// against the directory.
const { readdirSync } = await import('node:fs');
const pinnedOnDisk = readdirSync(here)
  .filter((f) => f.endsWith('.tsx'))
  .filter((f) => /className="fixed inset-0/.test(readFileSync(join(here, f), 'utf8')));

console.log('');
const missing = pinnedOnDisk.filter((f) => !PINNED.includes(f));
if (!missing.length) ok(`every component that pins a photograph is covered (${pinnedOnDisk.length})`);
else
  bad(
    `these pin a photograph but are not in PINNED, so nothing protects them: ${missing.join(', ')}`,
  );

console.log('');
if (failures) {
  console.error(`${failures} check(s) failed.\n`);
  process.exit(1);
}
console.log('The pinned photograph stays pinned.\n');
