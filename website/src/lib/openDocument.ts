// ---------------------------------------------------------------------------
// OPENING AN ISSUED DOCUMENT SO IT CAN BE PRINTED OR SAVED AS A PDF.
//
// ---------------------------------------------------------------------------
// WHAT WAS MISSING
// ---------------------------------------------------------------------------
//
// The University: "how come letters approved cannot be produced in pdf and
// ready to be sent through email and also a digital copy that is verified. a
// printable copy also".
//
// The letters were always A4-ready — `officialDocument.ts` has carried
// `@page { size: A4; margin: … }` and a running footer since it was written,
// and the page count test measures against the printable height. What was
// missing was ANY WAY TO ASK FOR IT. The archived letter opened in a bare tab
// with no indication that it was a finished document you could print, and
// nothing said the browser's own print dialogue would save it as a PDF.
//
// ---------------------------------------------------------------------------
// WHY THE BROWSER'S PRINT DIALOGUE AND NOT A PDF LIBRARY
// ---------------------------------------------------------------------------
//
// Because the document is already typeset for A4 in CSS, and Chromium's own
// print-to-PDF renders that CSS exactly — the same engine that laid the page
// out. A JavaScript PDF library re-implements the layout, and the first thing
// it loses is the page breaks: `break-inside: avoid` on the signature block is
// what stops a letter being signed across a page boundary, and no client-side
// converter honours it reliably.
//
// So the PDF the University gets this way is not a lesser one. It is the
// document, rendered by the engine its stylesheet was written for.
//
// ---------------------------------------------------------------------------
// THE BAR IS SCREEN-ONLY
// ---------------------------------------------------------------------------
//
// It must not appear on the paper. `@media print { display: none }` — and it
// is appended to the body rather than woven into the document, so the archived
// bytes are shown exactly as they were archived and nothing here can alter
// what the letter says.
// ---------------------------------------------------------------------------

/** What the toolbar needs to describe the document it is sitting on. */
export interface OpenedDocument {
  /** The archived HTML, exactly as stored. */
  html: string;
  /** IGUC/HR/APT/2026/0001 — shown on the bar so the tab is identifiable. */
  reference?: string | null;
  /** Whether the copy carries a verification seal. */
  sealed?: boolean | null;
  /** Where a recipient checks it. */
  verifyUrl?: string;
}

/**
 * The screen-only toolbar, as HTML.
 *
 * PLAIN STYLES, INLINE. The document's own stylesheet is the University's and
 * this must not depend on it, nor add a class that could collide with one.
 */
function toolbar(d: OpenedDocument): string {
  const ref = d.reference ? String(d.reference) : '';
  // LIGHT ON DARK, AND SAID TWICE. The bar sits on the University's own
  // document, whose stylesheet colours `span`, `strong` and `a` for ink on
  // paper — dark on white. Inheriting those onto a dark purple bar produced a
  // line that was measurably unreadable, so every colour here is stated
  // explicitly rather than left to cascade.
  const seal = d.sealed === false
    ? '<span style="color:#ffd88a">No verification seal on this copy</span>'
    : d.sealed
      ? `<span style="color:#a7e8c4">Sealed${d.verifyUrl
        ? ` &middot; verify at <a href="${d.verifyUrl}" target="_blank" rel="noopener"
             style="color:#a7e8c4;text-decoration:underline">${
  d.verifyUrl.replace(/^https?:\/\//, '')}</a>` : ''}</span>`
      : '';

  return `
<style>
  @media print { #iguc-bar { display: none !important; } }
  @media screen { body { padding-top: 56px !important; } }
  #iguc-bar { position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
              display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
              padding: 9px 16px; background: #422e59; color: #fff;
              font: 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
              box-shadow: 0 1px 6px rgba(0,0,0,.25); }
  #iguc-bar button { font: inherit; font-weight: 600; cursor: pointer;
              border: 0; border-radius: 6px; padding: 7px 13px;
              background: #fff; color: #422e59; }
  #iguc-bar button:hover { background: #efe9f6; }
  /* !important because the letter's own stylesheet colours these elements for
     ink on paper, and it wins on specificity inside its own document. */
  #iguc-bar, #iguc-bar * { color: #f3eefa !important; }
  #iguc-bar .meta { font-size: 12px; color: #d9cdea !important; }
  #iguc-bar .meta strong { color: #fff !important; }
  #iguc-bar button, #iguc-bar button * { color: #422e59 !important; }
  #iguc-bar .seal, #iguc-bar .seal * { color: inherit !important; }
</style>
<div id="iguc-bar">
  <button type="button" onclick="window.print()">Print / Save as PDF</button>
  <span class="meta">${ref ? `${ref} &middot; ` : ''}Choose <strong>Save as PDF</strong>
    as the destination to keep a PDF copy.</span>
  <span class="meta seal" style="margin-left:auto">${seal}</span>
</div>`;
}

/**
 * Open an archived document in its own tab, with a way to print or save it.
 *
 * THE WINDOW IS OPENED BY THE CALLER, BEFORE ITS AWAIT. A browser blocks
 * `window.open` that is not the direct consequence of a click, and fetching
 * the document breaks that chain — so the caller claims the tab on the click
 * and hands it here once the bytes arrive.
 *
 * Returns false when there is no window to write into, so the caller can say
 * the pop-up was blocked rather than appearing to do nothing.
 */
export function writeDocument(w: Window | null, d: OpenedDocument): boolean {
  if (!w) return false;
  w.document.write(d.html);
  // APPENDED AFTER THE DOCUMENT IS CLOSED, so the archived bytes are parsed as
  // themselves first and the bar cannot land inside the letter's own markup.
  w.document.close();
  try {
    w.document.body.insertAdjacentHTML('beforeend', toolbar(d));
  } catch {
    // A document that refuses the insert is still a readable letter, and the
    // browser's own Print command still works. Never worth failing the open.
  }
  return true;
}
