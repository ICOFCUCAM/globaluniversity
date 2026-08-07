// ---------------------------------------------------------------------------
// Does the certificate's artwork stay off the public site?
//
// Run with:  node src/lib/publicArt.test.mjs
//
// WHY THIS FILE EXISTS. For one commit the homepage hero rendered the device
// from src/lib/credentialArt.ts — the figure struck on every certificate this
// university issues — as inline SVG.
//
// That is worse than publishing a photograph of the seal. A photograph has to
// be traced. An SVG is in view-source: select, copy, paste, and anyone has the
// university's engraving at unlimited resolution, exact to the last control
// point, without redrawing a single curve. Every hour of guilloché maths in
// that module is handed over in a keystroke.
//
// The artwork was never the thing that makes a certificate hard to fake — the
// credential number, the HMAC seal and the public register at /verify are, and
// src/lib/securityPatterns.ts says so plainly. But there is no reason to give
// the engraving away for nothing, and a redesign eighteen months from now will
// not remember why the hero uses publicCrest.ts instead of the prettier module
// sitting next to it. So the rule is written down here, where it fails a build.
//
// WHAT IT CHECKS. It walks the import graph outward from every page under
// src/app that is NOT behind the portal, and fails if any module reachable from
// a public page imports credentialArt. The graph walk matters: a public page
// that imports a component that imports the art module is exactly as exposed as
// one that imports it directly, and a check that only read page files would miss
// it entirely.
//
// WHAT IT CANNOT DO. It resolves the imports this codebase actually writes —
// '@/…' aliases and relative paths, with the extensions Next resolves. A
// dynamic import built from a runtime string would be invisible to it. There
// are none today; if one is added, it needs adding here too.
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

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

const SRC = resolve('src');
const APP = join(SRC, 'app');

/**
 * Routes that require a signed-in member of staff or a student. The artwork is
 * allowed here — this is where a certificate is drawn, previewed and printed,
 * which is the only place it is supposed to exist.
 */
const GATED = ['portal', 'erp', 'admissions-portal', 'api'];

/** The module nobody public may reach. */
const FORBIDDEN = 'credentialArt';

const EXTS = ['.ts', '.tsx', '.mjs', '.js'];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXTS.some((e) => entry.endsWith(e)) && !entry.includes('.test.')) out.push(p);
  }
  return out;
}

/** Every file under src/app that is not inside a gated route segment. */
function publicEntryPoints() {
  return walk(APP).filter((p) => {
    const rel = p.slice(APP.length + 1);
    const first = rel.split('/')[0];
    return !GATED.includes(first);
  });
}

/**
 * Resolve one import specifier to a file on disk, or null if it is a package.
 *
 * Next resolves a bare directory to its index file and omits extensions, so
 * both have to be tried — '@/components/home/Hero' is Hero.tsx, and
 * '@/lib/thing' could be thing.ts or thing/index.ts.
 */
function resolveImport(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else return null; // node_modules — not ours to police
  for (const e of EXTS) if (existsSync(base + e)) return base + e;
  for (const e of EXTS) if (existsSync(join(base, `index${e}`))) return join(base, `index${e}`);
  return existsSync(base) && statSync(base).isFile() ? base : null;
}

const IMPORT_RE = /(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function importsOf(file) {
  const src = readFileSync(file, 'utf8');
  const specs = [];
  for (const m of src.matchAll(IMPORT_RE)) specs.push(m[1] ?? m[2]);
  return specs;
}

/** Breadth-first from the public pages, recording how each module was reached. */
function reachableFromPublic() {
  const seen = new Map(); // file -> the file that pulled it in
  const queue = [];
  for (const entry of publicEntryPoints()) {
    seen.set(entry, null);
    queue.push(entry);
  }
  while (queue.length) {
    const file = queue.shift();
    for (const spec of importsOf(file)) {
      const target = resolveImport(spec, file);
      if (!target || seen.has(target)) continue;
      seen.set(target, file);
      queue.push(target);
    }
  }
  return seen;
}

console.log('\nThe certificate artwork must not be reachable from a public page\n');

const entries = publicEntryPoints();
// A graph walk that started from nothing would pass silently for ever.
check('the walk found public pages at all', entries.length > 20, true);

const reachable = reachableFromPublic();
check('the walk followed imports outward', reachable.size > entries.length, true);

// The hero is the file this test was written for. If it stops being reachable,
// the homepage has been restructured and this test is checking a graph that no
// longer contains the thing it is guarding.
//
// IT FIRED ONCE, CORRECTLY: the hero was rebuilt as an asymmetric composition
// and the file renamed Hero.tsx -> HeroScene.tsx. The canary did its job — it
// caught a rename that would otherwise have left this whole suite quietly
// guarding a graph with no hero in it, still reporting green.
//
// Matched by prefix rather than by exact filename now. A hero that gets renamed
// again should keep this test honest rather than break it, but a hero that
// disappears from the public graph entirely still has to fail here.
const heroReached = [...reachable.keys()].some((f) => /components\/home\/Hero[^/]*\.tsx$/.test(f));
check('the homepage hero is in the public graph', heroReached, true);

const offenders = [...reachable.keys()]
  .filter((f) => f.includes(FORBIDDEN))
  .map((f) => {
    const chain = [];
    for (let at = f; at; at = reachable.get(at)) chain.unshift(at.slice(SRC.length + 1));
    return chain.join(' → ');
  });

check(`nothing public reaches ${FORBIDDEN}.ts`, offenders, []);

// And the converse: the portal must still be able to draw a certificate. A
// "fix" that deleted the art module would pass the check above.
const certificate = join(SRC, 'components/certificate/CertificateDocument.tsx');
check(
  'the certificate itself still uses the artwork',
  existsSync(certificate) && importsOf(certificate).some((s) => s.includes(FORBIDDEN)),
  true,
);

// The public crest must not quietly become a re-export of the private one.
const crest = join(SRC, 'lib/publicCrest.ts');
check(
  'the public crest is its own drawing',
  existsSync(crest) && !importsOf(crest).some((s) => s.includes(FORBIDDEN)),
  true,
);

if (failures) {
  console.error(`\n${failures} check(s) failed.\n`);
  process.exit(1);
}
console.log('\nThe certificate artwork is not reachable from any public page.\n');
