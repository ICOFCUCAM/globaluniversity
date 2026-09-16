// ---------------------------------------------------------------------------
// THE PHOTOGRAPHS THE PROSPECTUS CARRIES — PREPARED ONLY WHEN THE UNIVERSITY
// HAS NAMED THEM.
//
//   node scripts/build-prospectus-images.mjs \
//     VICE_CHANCELLOR=public/images/wp/vc-meyembi.png@420 \
//     COVER=public/images/some-photograph.jpg@1200
//
// Writes src/lib/prospectusImages.ts from exactly the files given and no
// others. With no arguments it writes nothing and says so.
//
// ---------------------------------------------------------------------------
// WHY IT TAKES ARGUMENTS INSTEAD OF HOLDING A LIST
// ---------------------------------------------------------------------------
//
// The University, 16 September 2026:
//
//     "some of those pictures are not good. so make sure i recommend before
//      using"
//
// A list of chosen files inside this script would be exactly the thing they
// asked not to happen: a choice made here, committed, and then run by somebody
// later as though it had been approved. The names come from them, on the
// command line, or nothing is prepared.
//
// THE BOOK CURRENTLY CARRIES NO PHOTOGRAPH. Only the University's crest, which
// is its own mark rather than a picture of anybody.
//
// ---------------------------------------------------------------------------
// WHY THEY TRAVEL WITH THE BOOK
// ---------------------------------------------------------------------------
//
// `crest.ts` gives the whole argument and it applies here word for word: the
// prospectus is emailed as an attachment, opened on a phone, saved and
// forwarded. A photograph loaded over the network renders as a broken-image
// icon in every mail client that blocks remote content, which is most of them.
//
// `prospectus.test.mjs` measures this: the attached copy must ask the network
// for nothing.
//
// ---------------------------------------------------------------------------
// AND WHY THEY ARE RE-ENCODED RATHER THAN READ AS THEY LIE
// ---------------------------------------------------------------------------
//
// `vc-meyembi.png` is 2,757 KB. Base64 inflates by a third, so embedding it as
// it stands would put a 3.6 MB portrait inside every copy of a book that gets
// emailed — and some mail servers refuse an attachment that size outright, so
// the prospectus would fail to arrive with no message to the sender.
//
// The same decision was taken once before in this repository, for the same
// reason: `IMAGES.hero` notes a 2,053 KB PNG re-encoded to 247 KB of JPEG.
//
// The number after the @ is the width to draw at — roughly twice the width it
// will be printed at, so a printer has pixels to work with. That is the crest's
// rule too.
//
// ---------------------------------------------------------------------------
// CHROMIUM DOES THE ENCODING, BECAUSE IT IS ALREADY HERE
// ---------------------------------------------------------------------------
//
// There is no image library in this project and adding one to resize two files
// would be a dependency, a lockfile change and a supply chain, for work a
// canvas does in four lines. Playwright and Chromium are already installed —
// the page tests measure documents in them.
//
// A PNG WITH TRANSPARENCY IS COMPOSITED ONTO WHITE FIRST. JPEG has no alpha
// channel: drawn straight, every transparent pixel encodes as black and a
// cut-out portrait appears against a black rectangle.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const USAGE = `
Nothing was prepared, because no photograph was named.

  node scripts/build-prospectus-images.mjs NAME=path/to/file.jpg@WIDTH ...

  NAME   how the press refers to it, e.g. VICE_CHANCELLOR
  path   relative to website/, e.g. public/images/wp/vc-meyembi.png
  WIDTH  pixels to draw at — about twice the printed width

The University chooses the photographs. This script prepares the ones they
name and does not hold a list of its own.
`;

const plates = process.argv.slice(2).map((arg) => {
  const [name, rest] = arg.split('=');
  const [from, width] = (rest ?? '').split('@');
  return { name, from, width: Number(width) || 1000 };
});

if (!plates.length || plates.some((p) => !p.name || !p.from)) {
  console.log(USAGE);
  process.exit(plates.length ? 1 : 0);
}

const missing = plates.filter((p) => !existsSync(join(root, p.from)));
if (missing.length) {
  console.error(`No such file: ${missing.map((p) => p.from).join(', ')}`);
  process.exit(1);
}

const { chromium } = await import('playwright');
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();

const encoded = [];
for (const plate of plates) {
  const bytes = readFileSync(join(root, plate.from));
  const png = /\.png$/i.test(plate.from);
  const source = `data:image/${png ? 'png' : 'jpeg'};base64,${bytes.toString('base64')}`;

  const uri = await page.evaluate(async ({ source, width, png }) => {
    const img = new Image();
    img.src = source;
    await img.decode();
    const scale = Math.min(1, width / img.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    // See the header: a transparent PNG drawn straight into a JPEG encodes
    // every transparent pixel as black.
    if (png) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // 0.82 keeps a portrait clean at print size; a wider plate can go lower
    // because it is drawn smaller than it is encoded.
    return canvas.toDataURL('image/jpeg', width > 800 ? 0.7 : 0.86);
  // `source` IS PASSED EXPLICITLY. Spreading the plate sends name, path and
  // width and NOT the data URI, which is built here — the browser then set
  // img.src to undefined and reported "the source image cannot be decoded",
  // which reads like a corrupt file and was a missing argument.
  }, { source, width: plate.width, png });

  const kb = Math.round((uri.length * 3) / 4 / 1024);
  console.log(`${plate.name.padEnd(16)} ${String((bytes.length / 1024) | 0).padStart(5)} KB `
    + `→ ${String(kb).padStart(4)} KB`);
  encoded.push({ ...plate, uri, kb });
}

await browser.close();

const file = `// ---------------------------------------------------------------------------
// THE PROSPECTUS PLATES — GENERATED. Do not edit by hand.
//
//   node scripts/build-prospectus-images.mjs ${plates.map((p) => `${p.name}=${p.from}@${p.width}`).join(' ')}
//
// Each photograph below was named by the University. The files under
// public/images are the only copies that should ever be edited; this file is
// derived from them and will be overwritten.
//
// Why they are embedded rather than linked, and why they are re-encoded: see
// the script's header.
// ---------------------------------------------------------------------------

${encoded.map((p) => `/**
 * From ${p.from} — re-encoded to ${p.width}px wide, about ${p.kb} KB.
 */
export const ${p.name}_PLATE =
  '${p.uri}';`).join('\n\n')}
`;

writeFileSync(join(root, 'src/lib/prospectusImages.ts'), file);
console.log(`\nWrote src/lib/prospectusImages.ts — ${Math.round(file.length / 1024)} KB`);
