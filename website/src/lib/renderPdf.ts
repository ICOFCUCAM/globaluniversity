// ---------------------------------------------------------------------------
// TURNING AN ARCHIVED DOCUMENT INTO A PDF, SERVER-SIDE.
//
// ---------------------------------------------------------------------------
// WHY A REAL PDF AND NOT AN HTML FILE
// ---------------------------------------------------------------------------
//
// The University: "the letter ready to be open should open as pdf from the
// browser and download as pdf … it must be open in a4".
//
// Until now the letter was HTML everywhere: archived as HTML, opened as HTML,
// and — worse — ATTACHED TO THE EMAIL AS AN .html FILE. An appointee opening
// an appointment letter got a web page attachment, which looks improvised and
// which many mail clients will not preview at all. A letter of appointment is
// a document somebody prints, files, and shows to a bank or an embassy.
//
// ---------------------------------------------------------------------------
// THE SAME ENGINE THE STYLESHEET WAS WRITTEN FOR
// ---------------------------------------------------------------------------
//
// `officialDocument.ts` typesets these documents in CSS — `@page { size: A4 }`,
// a running footer, `break-inside: avoid` on the signature block so nobody is
// signed across a page boundary. Chromium's print-to-PDF honours all of it,
// because it is the engine that laid the page out.
//
// `preferCSSPageSize: true` is what makes that true rather than nearly true:
// without it Puppeteer's own `format` wins and the document's `@page` rule is
// ignored, which is how a letter typeset for A4 comes out US Letter — short
// enough to clip the footer and wrong on every printer in Cameroon.
//
// ---------------------------------------------------------------------------
// AND IT DEGRADES HONESTLY
// ---------------------------------------------------------------------------
//
// Chromium may not be available — a deployment target without the binary, a
// cold start that ran out of memory. `renderPdf` throws, and every caller is
// written to fall back to the HTML it already had rather than fail the act.
// Nobody loses a letter because a PDF could not be made of it.
// ---------------------------------------------------------------------------

// NO `import 'server-only'` HERE — it is not a dependency of this project, and
// adding one to make a comment enforceable is the wrong trade. This module is
// imported by a route with `runtime = 'nodejs'` and by nothing else; the
// dynamic imports below would fail loudly in a browser bundle anyway.

/** A4 at 96dpi, used only when a document carries no @page rule of its own. */
const A4 = { width: '210mm', height: '297mm' } as const;

/**
 * Render a complete HTML document to a PDF.
 *
 * THE HTML IS THE ARCHIVED BYTES. Nothing here re-renders the letter from the
 * record — this is a printer, not a generator, and the PDF it makes is the
 * document that was issued.
 */
export async function renderPdf(html: string): Promise<Buffer> {
  // IMPORTED INSIDE THE FUNCTION, NOT AT THE TOP. These are heavy native
  // packages; a top-level import pulls them into every request that touches
  // this module's file, including the ones that never make a PDF.
  const [{ default: chromium }, puppeteer] = await Promise.all([
    import('@sparticuz/chromium'),
    import('puppeteer-core'),
  ]);

  // LOCAL CHROMIUM FIRST, where there is one. The sandbox and a developer's
  // machine have a full browser already, and asking the serverless pack to
  // unpack itself there is slower and can fail on a read-only /tmp.
  const local = process.env.CHROMIUM_PATH;
  const executablePath = local || await chromium.executablePath();

  const browser = await puppeteer.launch({
    args: local ? ['--no-sandbox', '--disable-dev-shm-usage'] : chromium.args,
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();

    // `load`, then a beat for fonts. Every image in these documents is a
    // data: URI — the crest, the QR in the seal panel — so there is no network
    // to idle on, and this version of puppeteer-core does not offer
    // `networkidle0` to `setContent` anyway. `document.fonts.ready` is the one
    // thing that genuinely resolves after load and changes the layout.
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => (document as unknown as {
      fonts?: { ready: Promise<unknown> };
    }).fonts?.ready);

    const pdf = await page.pdf({
      // THE DOCUMENT'S OWN @page RULE WINS. See the header.
      preferCSSPageSize: true,
      ...A4,
      printBackground: true,
      // MARGINS COME FROM THE STYLESHEET TOO. Setting them here as well would
      // add a second margin inside the first and shrink every letter.
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/**
 * A filename a person can find again.
 *
 * THE REFERENCE, NOT A UUID. `IGUC/HR/APT/2026/0001` is what the letter is
 * called on its own face and in the register, so the file is called that too,
 * with the slashes a filesystem cannot take turned into hyphens.
 */
export function pdfFilename(reference: string): string {
  const safe = String(reference).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${safe || 'document'}.pdf`;
}
