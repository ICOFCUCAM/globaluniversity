// ---------------------------------------------------------------------------
// CHROMIUM HAS TO BE IN THE DEPLOYMENT, NOT JUST IN node_modules.
//
// Run with:  node scripts/check-pdf-tracing.mjs        (after `npm run build`)
//
// ---------------------------------------------------------------------------
// WHAT THIS GUARDS
// ---------------------------------------------------------------------------
//
// An appointee opened their acceptance page and read this:
//
//   "Your letter could not be prepared as a PDF just now: The input directory
//    /vercel/path0/website/node_modules/@sparticuz/chromium/bin does not
//    exist. If you are using a bundler … you must externalize
//    @sparticuz/chromium so it is not relocated."
//
// Chromium is not a library. It is a 67MB brotli archive that the package
// unpacks to /tmp and launches. Webpack saw an `import`, bundled the wrapper
// JavaScript into the route, and left the browser behind; Next's file tracing
// follows `require` calls, and nothing requires a .br file, so it was dropped
// from the deployment as well. The wrapper then looked for a browser beside
// itself and found an empty directory.
//
// THE CODE WAS NEVER WRONG. `renderPdf` degrades honestly and every caller
// falls back to HTML, so nothing crashed and no letter was lost — which is
// exactly why this could sit in production unnoticed. The only symptom is a
// letter that quietly arrives as a web page instead of a document.
//
// ---------------------------------------------------------------------------
// WHY A BUILD ARTEFACT AND NOT THE SOURCE
// ---------------------------------------------------------------------------
//
// Reading next.config.mjs would only prove that somebody wrote the setting
// down. `.nft.json` is Next's own manifest of what it is going to ship, so
// this reads the answer rather than the intention — and it is the artefact
// Vercel uses to build the function.
//
// The measurement that found the fault: before, the letter route's manifest
// listed 373 files and NOT ONE was from @sparticuz. After, the four archives
// are there.
// ---------------------------------------------------------------------------

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '../.next/server/app');

// EVERY ROUTE THAT MAKES A PDF. Both of them: the officer's copy from the
// register, and the appointee's own download after they accept. The appointee's
// is the one that failed in front of somebody outside the University.
const ROUTES = [
  'api/appointments/letter',
  'api/appointments/accept/letter',
];

// The four archives the package unpacks. Named individually rather than
// counted, because a manifest carrying only `fonts.tar.br` would pass a count
// and still have no browser in it.
const ARCHIVES = ['chromium.br', 'al2023.tar.br', 'fonts.tar.br', 'swiftshader.tar.br'];

let failures = 0;
const fail = (msg) => { console.log(`FAIL  ${msg}`); failures += 1; };
const ok = (msg) => console.log(`ok    ${msg}`);

console.log('\nThe browser that prints the letters is in the deployment\n');

if (!existsSync(app)) {
  console.log('No build to inspect — run `npm run build` first. Skipping.\n');
  process.exit(0);
}

for (const route of ROUTES) {
  const manifest = join(app, route, 'route.js.nft.json');

  if (!existsSync(manifest)) {
    fail(`${route} has no trace manifest — has the route been renamed?`);
    continue;
  }

  const files = JSON.parse(readFileSync(manifest, 'utf8')).files ?? [];
  const missing = ARCHIVES.filter((a) => !files.some((f) => f.endsWith(`@sparticuz/chromium/bin/${a}`)));

  if (missing.length) {
    fail(`${route} ships without ${missing.join(', ')} — a PDF cannot be made there, `
      + 'and the letter will silently fall back to HTML. Check '
      + 'experimental.outputFileTracingIncludes in next.config.mjs.');
  } else {
    ok(`${route} carries all four chromium archives`);
  }

  // EXTERNALISED, NOT BUNDLED. Tracing the archives is not enough on its own:
  // if webpack has relocated the wrapper, the wrapper looks for bin/ beside the
  // bundle rather than in node_modules and the archives sit there unread. A
  // package left external shows up in the manifest as its own files.
  if (!files.some((f) => f.includes('@sparticuz/chromium/build'))) {
    fail(`${route} has no @sparticuz/chromium JavaScript traced, which means webpack `
      + 'bundled it instead of leaving it external. Check '
      + 'experimental.serverComponentsExternalPackages in next.config.mjs.');
  } else {
    ok(`…and the package is left external rather than relocated`);
  }
}

console.log(failures
  ? `\n${failures} problem(s): a letter will not become a PDF in production.\n`
  : '\nBoth PDF routes ship a browser.\n');

process.exit(failures ? 1 : 0);
