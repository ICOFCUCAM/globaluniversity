// ---------------------------------------------------------------------------
// THE BOOK PRESS — how a prospectus is set, as against how a letter is set.
//
// ---------------------------------------------------------------------------
// WHY THIS IS NOT `officialDocument.ts`
// ---------------------------------------------------------------------------
//
// That file is the press for LETTERS: one letterhead, a body, a signature, a
// seal, and a great deal of measured care about keeping the signature on the
// same page as the words it signs. Every one of those concerns belongs to a
// document of one to three pages that somebody signs.
//
// A book has none of them and has four the letter has never needed:
//
//   A COVER, which is the only page most people will look at twice.
//   A TABLE OF CONTENTS, which has to agree with the chapters or it is worse
//     than having none.
//   PART DIVIDERS, so forty chapters read as fourteen movements.
//   A CHAPTER THAT ALWAYS STARTS ON A FRESH PAGE, which is what makes a bound
//     document feel bound rather than printed.
//
// Trying to make one stylesheet serve both would mean a letter carrying rules
// about part dividers and a book carrying rules about signature rules. So the
// two presses are separate, and what they genuinely share — the crest, the
// University's purple, A4 — is imported rather than retyped.
//
// ---------------------------------------------------------------------------
// WHAT IT PRODUCES, AND WHY THAT IS ONE FILE AND NOT A PDF
// ---------------------------------------------------------------------------
//
// A single self-contained HTML document. The crest is embedded as a data URI,
// the stylesheet is inline, and there is not one network request in it — so it
// survives being saved to a phone, attached to an email, or opened on a machine
// with no connection, which is exactly what "forwarded by any method" means.
//
// It is not a PDF because this deployment has no PDF toolchain: Chromium is a
// development dependency and is not present on Vercel, which was discovered the
// first time an officer tried to issue a letter. Every recipient's browser can
// print this to PDF, and the print CSS here is what governs what comes out.
// `/api/publications/[slug]?print=1` opens that dialogue over it.
//
// ---------------------------------------------------------------------------
// ONE THING THIS FILE DELIBERATELY WILL NOT DO
// ---------------------------------------------------------------------------
//
// It will not supply a fact. Every word it prints comes from the book data or
// from `constants.ts`; there is no default country, no default fee, no "since
// 1998", no placeholder that reads as a statement. Where a heading has no text
// under it — several form headings do — it prints the heading and a ruled
// space, not an invented sentence.
// ---------------------------------------------------------------------------

import { UNIVERSITY } from './constants';
import { CREST_DATA_URI } from './crest';
import { escape, PAGE } from './officialDocument';
// GENERATED, FROM THE PHOTOGRAPHS THE UNIVERSITY NAMED. All three are from the
// 2024 graduation — "add photogragh but those from 2021 to 26" — and were
// chosen by reading the files' dates rather than by looking at them and
// guessing. See scripts/build-prospectus-images.mjs.
import { CONGREGATION_PLATE, HOODING_PLATE, CONFERRAL_PLATE } from './prospectusImages';
import {
  type Block, type Book, type Chapter, type Part, chaptersInOrder,
} from '@/content/nationalRector';

// ---------------------------------------------------------------------------
// 1. THE PAGE
// ---------------------------------------------------------------------------
//
// A4, like everything else the University prints, but with a book's margins.
// A letter is set to 16mm at the sides because it is read once and filed; a
// book is read across many pages and a narrower measure is what stops the eye
// losing its place returning to the left edge.

const MARGIN_TOP_MM = 18;
const MARGIN_SIDE_MM = 20;

const PX_PER_MM = 96 / 25.4;

/**
 * The text block a page of this book actually has.
 *
 * DERIVED, AND EXPORTED, FOR ONE REASON. `officialDocument.ts` records what
 * happens otherwise: "a margin changed in one place and the test went on
 * dividing by the old printable height… A measurement against a stale constant
 * is worse than no measurement, because it is believed."
 *
 * The first version of the page test measured the Vice-Chancellor's letter in a
 * 794px window — which is the SHEET, not the text block on it — and read 1192px
 * where the true figure is 1451. Lines break at the width they are printed at,
 * or the number means nothing.
 */
export const BOOK_PRINTABLE = {
  width: Math.round(PAGE.width - (2 * MARGIN_SIDE_MM * PX_PER_MM)),
  height: Math.round(PAGE.height - (2 * MARGIN_TOP_MM * PX_PER_MM)),
} as const;

/** The University's purple, in the two weights the documents already use. */
const PURPLE = '#422e59';
const PURPLE_DEEP = '#2f2040';
const INK = '#1c1720';
const QUIET = '#5c5366';
const RULE = '#e6e0ee';

/**
 * The whole stylesheet, as one template literal.
 *
 * NO BACKTICKS ANYWHERE INSIDE IT, INCLUDING IN THE COMMENTS. A pair of them
 * in a CSS comment ends the literal mid-sentence and the file stops compiling
 * with an error pointing at whatever word came next — which reads as a CSS
 * problem and is not one. It has happened three times while this book was
 * being written: around constants.ts, around --edge, and around width: 50%.
 * `officialDocument.ts` carries the same warning for the same reason.
 */
function styles(): string {
  return `
  @page { size: A4; margin: ${MARGIN_TOP_MM}mm ${MARGIN_SIDE_MM}mm; }

  /* THE COVER IS PRINTED IN COLOUR ON PURPOSE — and it is the only page that
     is, on the University's ruling. A browser drops background colour from a
     printout unless it is told not to, and without this the cover prints as
     black text on white with the crest floating in the middle of it, which is
     not a cover. The part dividers used to need this too; they are on paper
     now and no longer do. */
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  html { background: #efecf4; }
  body {
    font: 11pt/1.55 Georgia, 'Times New Roman', serif;
    color: ${INK};
    margin: 0;
    background: #efecf4;
  }

  /* -------------------------------------------------------------------
     THE SHEET.

     On screen the book is drawn as a stack of A4 sheets on a grey ground, so
     what a reader sees is what will come out of the printer. On paper the
     sheet furniture disappears entirely and @page takes over — otherwise every
     printed page would carry a second, inner margin and a drop shadow.
     ------------------------------------------------------------------- */
  .sheet {
    width: ${PAGE.width}px;
    min-height: ${PAGE.height}px;
    box-sizing: border-box;
    margin: 18px auto;
    padding: ${MARGIN_TOP_MM}mm ${MARGIN_SIDE_MM}mm;
    background: #fff;
    box-shadow: 0 1px 3px rgba(28,23,32,.18), 0 8px 24px rgba(28,23,32,.10);
    position: relative;
    break-after: page;
    page-break-after: always;
  }
  .sheet:last-child { break-after: auto; page-break-after: auto; }

  @media print {
    html, body { background: #fff; }
    .sheet {
      width: auto; min-height: 0; margin: 0; padding: 0;
      box-shadow: none; background: transparent;
    }
    .screen-only { display: none !important; }
  }

  /* ---- THE COVER ---------------------------------------------------- */
  .cover {
    background: ${PURPLE_DEEP};
    color: #fff;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    text-align: center;
  }
  .cover .crest { width: 108px; height: 108px; object-fit: contain; margin: 0 auto; }
  .cover .institution {
    font-size: 15pt; letter-spacing: .22em; text-transform: uppercase;
    margin: 18px 0 0; color: #e9c14a;
  }
  .cover .motto { font-size: 9.5pt; letter-spacing: .12em; color: #cfc4de; margin: 6px 0 0; }
  .cover h1 {
    font-size: 40pt; line-height: 1.08; letter-spacing: .01em;
    margin: 0; font-weight: normal;
  }
  .cover .rule { width: 84px; height: 2px; background: #e9c14a; margin: 22px auto; }
  /* MEASURED. At 78% the strapline broke after "Your" and left "Leadership."
     alone on the second line of a book cover. The printable width of an A4
     sheet at these margins is 643px and the line wants about 560 — so the
     measure was the only thing standing between it and one clean line. */
  .cover .subtitle { font-size: 13pt; line-height: 1.5; color: #e4dcee; margin: 0 auto; max-width: 94%; }
  /* -------------------------------------------------------------------
     NO PHOTOGRAPH ON THE COVER. The University's ruling of 16 September 2026:
     "do not put image on first page."

     It carried a band of the 2024 academic body across its foot for about an
     hour. The photographs stay in the book — they are on the plate page after
     the contents — and the cover is the crest, the name, the motto, the title
     and the strapline on the University's purple, which is what it was.

     prospectus.test.mjs holds it: the cover has no image on it but the crest,
     which is the University's own mark and not a picture of anybody.
     ------------------------------------------------------------------- */
  .cover .foot { font-size: 9pt; letter-spacing: .08em; color: #b8a9cb; }
  .cover .foot p { margin: 3px 0; }

  /* ---- THE PLATE PAGE ------------------------------------------------
     Three photographs of one occasion, on paper. Not a coloured page — the
     University's ruling is that only the cover is — so the pictures sit on
     white with air around them, which is how a book sets a plate anyway.
     ------------------------------------------------------------------- */
  .plates { display: flex; flex-direction: column; justify-content: center; }
  .plates .wide { width: 100%; border-radius: 3px; display: block; }
  .plates .pair { display: flex; gap: 12px; margin-top: 12px; }
  /* -------------------------------------------------------------------
     50% MINUS HALF THE GAP, AND min-width: 0.

     At a plain 50% the two plates plus the 12px between them came to 12px
     more than the page, and they could not shrink to fit: a flex item's
     default min-width of auto resolves to an image's INTRINSIC width, and
     these are 640px plates in a 643px text block. So the right-hand one ran
     off the edge of the printed page, taking a third of itself with it.

     Invisible at any width above about 900px, which is every window this book
     was ever screenshotted in.
     ------------------------------------------------------------------- */
  .plates .pair img {
    width: calc(50% - 6px); min-width: 0; border-radius: 3px; display: block;
  }
  .plates .caption {
    margin: 14px 0 0; text-align: center; font-size: 9pt; letter-spacing: .14em;
    text-transform: uppercase; color: ${QUIET};
  }

  /* -------------------------------------------------------------------
     A PART DIVIDER — ON PAPER, NOT ON COLOUR.

     The University, 16 September 2026: "only the front page is color. the rest
     should not be like first page."

     These fourteen pages were full-bleed purple, the same treatment as the
     cover, and they were wrong twice over. A cover is the cover BECAUSE it is
     the only page that looks like that; fifteen pages in the same livery make
     the cover one of a set. And a candidate printing the prospectus was being
     asked to flood fourteen sheets of A4 with solid ink to read four lines on
     each of them.

     WHAT MAKES A DIVIDER A DIVIDER IS THE SPACE, NOT THE INK. The page is
     nearly empty, the type is centred and vertically centred, and rules sit
     above and below the title block. Turning onto one still tells you the book
     has changed movement.
     ------------------------------------------------------------------- */
  .divider {
    display: flex; flex-direction: column; justify-content: center; text-align: center;
  }
  .divider .inner {
    border-top: 1px solid ${RULE}; border-bottom: 1px solid ${RULE};
    padding: 34px 0 30px;
  }
  .divider .part-no {
    font-size: 10.5pt; letter-spacing: .32em; text-transform: uppercase; color: ${PURPLE};
    margin: 0 0 14px;
  }
  .divider h2 {
    font-size: 27pt; font-weight: normal; margin: 0; line-height: 1.22; color: ${PURPLE_DEEP};
  }
  .divider .rule { width: 64px; height: 2px; background: #e9c14a; margin: 22px auto 20px; }
  .divider ol { list-style: none; padding: 0; margin: 0; font-size: 10.5pt; color: ${QUIET}; }
  .divider ol li { margin: 5px 0; }

  /* ---- A PLAIN PAGE'S RUNNING HEAD ---------------------------------- */
  .runhead {
    display: flex; justify-content: space-between; align-items: baseline;
    border-bottom: 1px solid ${RULE}; padding-bottom: 6px; margin-bottom: 22px;
    font-size: 8pt; letter-spacing: .14em; text-transform: uppercase; color: #8a8194;
  }

  /* ---- A CHAPTER OPENING -------------------------------------------- */
  .chapter-no {
    font-size: 9pt; letter-spacing: .26em; text-transform: uppercase;
    color: ${PURPLE}; margin: 0 0 8px;
  }
  h3.chapter-title {
    font-size: 21pt; font-weight: normal; line-height: 1.22; margin: 0;
    color: ${PURPLE_DEEP};
  }
  .chapter-title + .opening-rule { width: 56px; height: 2px; background: #e9c14a; margin: 14px 0 20px; }

  /* ---- THE TEXT ------------------------------------------------------ */
  p { margin: 0 0 10px; }
  p, li { orphans: 3; widows: 3; }
  h4 {
    font-size: 11.5pt; margin: 20px 0 6px; color: ${PURPLE_DEEP};
    letter-spacing: .01em;
  }
  .lead {
    font-size: 13pt; line-height: 1.45; color: ${PURPLE_DEEP};
    margin: 16px 0; padding-left: 14px; border-left: 3px solid #e9c14a;
    break-inside: avoid; page-break-inside: avoid;
  }
  ul.bullets { margin: 10px 0 14px; padding-left: 0; list-style: none; }
  ul.bullets li {
    position: relative; padding-left: 18px; margin: 4px 0;
  }
  ul.bullets li::before {
    content: ''; position: absolute; left: 3px; top: .62em;
    width: 5px; height: 5px; background: #e9c14a; border-radius: 50%;
  }
  dl.defs { margin: 12px 0; }
  dl.defs > div { margin: 0 0 12px; break-inside: avoid; page-break-inside: avoid; }
  dl.defs dt {
    font-size: 11pt; color: ${PURPLE_DEEP}; letter-spacing: .02em; margin-bottom: 2px;
  }
  dl.defs dd { margin: 0; }
  ol.numbered { margin: 12px 0; padding: 0; list-style: none; counter-reset: n; }
  ol.numbered li {
    position: relative; padding-left: 34px; margin: 0 0 11px;
    break-inside: avoid; page-break-inside: avoid;
  }
  ol.numbered li .n {
    position: absolute; left: 0; top: 0; width: 23px; height: 23px; border-radius: 50%;
    background: ${PURPLE}; color: #fff; font-size: 9.5pt; line-height: 23px;
    text-align: center;
  }
  ol.numbered li .t { display: block; color: ${PURPLE_DEEP}; font-size: 11pt; }

  /* ---- THE DIAGRAMS -------------------------------------------------
     The University drew these in monospaced characters, which is how a
     diagram is drawn in a chat window and not how one is printed in a book.
     Set as type they say the same thing and survive a printer.
     ------------------------------------------------------------------- */
  .flow { margin: 16px 0; text-align: center; break-inside: avoid; page-break-inside: avoid; }
  .flow .step {
    display: inline-block; border: 1px solid #d6cce4; border-radius: 4px;
    background: #f8f6fb; color: ${PURPLE_DEEP};
    padding: 5px 16px; font-size: 10pt; letter-spacing: .02em;
  }
  .flow .arrow { display: block; color: #b8a9cb; font-size: 9pt; line-height: 1.5; margin: 1px 0; }

  .equation {
    margin: 20px 0; text-align: center; break-inside: avoid; page-break-inside: avoid;
    border-top: 1px solid ${RULE}; border-bottom: 1px solid ${RULE}; padding: 16px 0;
  }
  .equation .term {
    font-size: 13pt; letter-spacing: .14em; text-transform: uppercase; color: ${PURPLE_DEEP};
    margin: 4px 0;
  }
  .equation .op { font-size: 12pt; color: #b8a9cb; margin: 2px 0; }

  .panel {
    margin: 16px 0; border: 1px solid #d6cce4; border-radius: 5px; overflow: hidden;
    break-inside: avoid; page-break-inside: avoid;
  }
  .panel .panel-head {
    background: ${PURPLE}; color: #fff; padding: 10px 14px; text-align: center;
  }
  .panel .panel-head .t {
    font-size: 10pt; letter-spacing: .18em; text-transform: uppercase; color: #e9c14a;
  }
  .panel .panel-head .s { font-size: 10.5pt; margin-top: 3px; }
  .panel .panel-body { display: flex; }
  .panel .col { flex: 1 1 0; padding: 12px 14px; border-left: 1px solid ${RULE}; }
  .panel .col:first-child { border-left: 0; }
  .panel .col h5 {
    margin: 0 0 6px; font-size: 8.5pt; letter-spacing: .14em; text-transform: uppercase;
    color: ${PURPLE}; font-weight: normal;
  }
  .panel .col ul { margin: 0; padding: 0; list-style: none; font-size: 10pt; }
  .panel .col li { margin: 3px 0; color: ${QUIET}; }

  .tree { margin: 16px 0; break-inside: avoid; page-break-inside: avoid; }
  .tree .root {
    display: inline-block; background: ${PURPLE}; color: #fff; border-radius: 4px;
    padding: 6px 18px; font-size: 10.5pt; letter-spacing: .08em; text-transform: uppercase;
  }
  .tree .branches { margin: 10px 0 0 22px; border-left: 1px solid #d6cce4; padding-left: 0; }
  .tree .branch { position: relative; padding: 0 0 0 20px; margin: 8px 0; }
  .tree .branch::before {
    content: ''; position: absolute; left: 0; top: .72em; width: 14px; height: 1px;
    background: #d6cce4;
  }
  .tree .branch > .label { color: ${PURPLE_DEEP}; font-size: 10.5pt; }
  .tree .children { margin: 4px 0 0 0; padding: 0; list-style: none; }
  .tree .children li {
    position: relative; padding-left: 18px; margin: 3px 0; font-size: 10pt; color: ${QUIET};
  }
  .tree .children li::before {
    content: ''; position: absolute; left: 2px; top: .62em; width: 4px; height: 4px;
    border-radius: 50%; background: #cbbede;
  }

  .network { margin: 18px 0; text-align: center; break-inside: avoid; page-break-inside: avoid; }
  .network .root {
    display: inline-block; background: ${PURPLE}; color: #fff; border-radius: 4px;
    padding: 7px 22px; font-size: 10.5pt; letter-spacing: .12em; text-transform: uppercase;
  }
  .network .stem { width: 1px; height: 14px; background: #d6cce4; margin: 0 auto; }

  /* -------------------------------------------------------------------
     THE RAIL, AND WHY IT IS NOT A BORDERED BOX.

     It was: a div with a top, left and right border, inset from each side by
     "half a column". That is what the University rejected, and it was wrong in
     two ways at once.

     THE MIDDLE ADMINISTRATION HAD NO CONNECTOR AT ALL. Three boxes, a bar over
     them, and a drop at each END only — so the figure drew the University as
     joined to the outer two and not to the one in the middle, which is the
     opposite of what the chapter says.

     AND THE DROPS DID NOT LAND ON THE BOXES. "Half a column" is only half a
     column when there are no gaps between them. With 12px between three
     columns each column is (100% - 24px) / 3 wide, so its centre is at
     (100% - 24px) / 6 — not at 100% / 6. The ends sat a few pixels inboard of
     where the boxes actually are, which reads as a drawing that does not quite
     line up.

     So the rail is now laid out by the SAME flex rule as the columns
     underneath it. Each column gets a tick at its own centre, whatever the
     widths work out to, and the horizontal bar runs from the first centre to
     the last — both computed by the renderer from the column count and this
     gap. Nothing is estimated.
     ------------------------------------------------------------------- */
  .network .rail { position: relative; height: 16px; display: flex; gap: 12px; }
  /* --edge is set inline by the renderer: half a column, gaps included. (No
     backticks in this comment — the whole stylesheet is a template literal.) */
  .network .rail::before {
    content: ''; position: absolute; top: 0; height: 1px; background: #d6cce4;
    left: var(--edge); right: var(--edge);
  }
  .network .rail .tick { flex: 1 1 0; position: relative; }
  .network .rail .tick::before {
    content: ''; position: absolute; left: 50%; top: 0; bottom: 0;
    width: 1px; background: #d6cce4;
  }

  .network .cols { display: flex; gap: 12px; }
  .network .node {
    flex: 1 1 0; border: 1px solid #d6cce4; border-radius: 4px; background: #f8f6fb;
    padding: 9px 8px;
    font-size: 8.5pt; letter-spacing: .08em; text-transform: uppercase; color: ${PURPLE_DEEP};
  }

  /* -------------------------------------------------------------------
     THE BAND, AND WHY THE FOUR WORDS ARE NOT PRINTED THREE TIMES.

     The University, 16 September 2026: "even the information are all same
     which is bad."

     They were right. Each of the three administrations carried its own list —
     Rectors, Students, Faculty, Finance — so the figure printed the same four
     words three times and told a reader nothing on the second and third
     reading of them. It looked like a diagram assembled by copy and paste,
     which in effect it was.

     The list is one band now, under all three, reached by a tick from each.
     Three columns descending into one shared band says "every one of these
     contains this" — which is what the repetition was trying to say and what
     the University's own sketch meant — in a quarter of the ink.

     NOTHING WAS ADDED TO SAY IT. No caption, no "within each". The connectors
     carry the meaning, so the figure still contains only the University's own
     words.
     ------------------------------------------------------------------- */
  .network .drop { position: relative; height: 12px; display: flex; gap: 12px; }
  .network .drop .tick { flex: 1 1 0; position: relative; }
  .network .drop .tick::before {
    content: ''; position: absolute; left: 50%; top: 0; bottom: 0;
    width: 1px; background: #d6cce4;
  }
  .network .band {
    border: 1px solid #d6cce4; border-radius: 4px; background: #f8f6fb;
    padding: 9px 10px; font-size: 10pt; color: ${QUIET}; letter-spacing: .02em;
  }

  /* ---- THE FORM ------------------------------------------------------ */
  .fields { margin: 12px 0 18px; }
  .field {
    display: flex; align-items: baseline; gap: 10px; margin: 0 0 14px;
    break-inside: avoid; page-break-inside: avoid;
  }
  .field .label { flex: 0 0 auto; font-size: 10pt; color: ${PURPLE_DEEP}; }
  .field .line { flex: 1 1 auto; border-bottom: 1px solid #b8a9cb; height: 1.1em; }
  .instruction {
    margin: 8px 0 0; font-size: 10.5pt; color: ${QUIET}; font-style: italic;
  }
  /* A RULED SPACE TO WRITE IN, because the University asked for a profile and a
     plan and a form with nowhere to put them is not a form. */
  .writein {
    margin: 8px 0 20px;
    background-image: repeating-linear-gradient(
      to bottom, transparent 0, transparent 25px, #ded6e8 25px, #ded6e8 26px);
    height: 156px;
  }

  /* ---- THE VICE-CHANCELLOR'S LETTER ------------------------------------
     A letter, not a chapter. Set a shade wider in the leading than the body
     of the book, because it is read once and continuously rather than
     consulted.
     ------------------------------------------------------------------- */
  /* -------------------------------------------------------------------
     SET WIDER THAN A CHAPTER, BECAUSE IT IS READ AND NOT CONSULTED.

     MEASURED AT THE PRINTABLE WIDTH: the letter is 1451px against a 987px text
     block, so it runs to two pages, and the signature lands 364px into the
     second one with three paragraphs above it.

     THAT IS THE MEASUREMENT THAT MATTERS, and it is not "does it fit on one
     page". A Vice-Chancellor's letter running to two pages is a normal letter;
     what would be wrong is a last page carrying nothing but a name and an
     email address, which is the failure officialDocument.ts spends four
     paragraphs on and correspondenceLetterPages.test.mjs measures for official
     correspondence. 364px is well clear of the fifth of a page that test uses.

     A TIGHTER SETTING WAS TRIED AND PUT BACK. 1.56 leading and 9px of spacing
     were introduced to "fit the letter on one page" — on the strength of a
     measurement taken in a 794px window, which is the SHEET and not the text
     block on it. At the real width the letter was never one page and the
     tighter setting bought nothing but a closer-set letter. The window is now
     BOOK_PRINTABLE and the leading is back where it reads best.
     ------------------------------------------------------------------- */
  .letter p { line-height: 1.62; }
  .signoff { margin-top: 26px; break-inside: avoid; page-break-inside: avoid; }
  .signoff .rule { width: 62mm; height: 1px; background: ${INK}; margin-bottom: 8px; }
  .signoff .who { font-size: 12pt; color: ${PURPLE_DEEP}; margin: 0; }
  .signoff .what { font-size: 9.5pt; color: ${QUIET}; margin: 1px 0 0; }

  /* ---- THE CONTENTS --------------------------------------------------- */
  /* -------------------------------------------------------------------
     TWO COLUMNS, AND THE REASON IS A MEASUREMENT.

     Fourteen parts and forty chapters set in one column came to 1777px
     against a 987px page: the contents of a book running to two pages, the
     second of them a third full. A reader looking for chapter thirty-one had
     to turn over the contents page.

     Two columns bring it to one. The rows are held together so a chapter
     title never splits across the fold, and a part heading never ends a
     column with its first chapter at the top of the next one.
     ------------------------------------------------------------------- */
  .toc { margin: 0; column-count: 2; column-gap: 26px; }
  .toc .part {
    margin: 16px 0 6px; font-size: 9pt; letter-spacing: .18em; text-transform: uppercase;
    color: ${PURPLE}; border-bottom: 1px solid ${RULE}; padding-bottom: 4px;
    break-inside: avoid; break-after: avoid; page-break-after: avoid;
  }
  .toc .part:first-child { margin-top: 0; }
  .toc .row {
    display: flex; gap: 8px; align-items: baseline; margin: 3px 0; font-size: 10.5pt;
    break-inside: avoid; page-break-inside: avoid;
  }
  .toc .row .no { flex: 0 0 26px; color: #8a8194; font-size: 9.5pt; }
  .toc .row .name { flex: 0 0 auto; }
  .toc .row .dots { flex: 1 1 auto; border-bottom: 1px dotted #cbbede; height: .55em; }

  /* ---- THE COLOPHON --------------------------------------------------- */
  .colophon { text-align: center; }
  .colophon .strapline {
    font-size: 12pt; letter-spacing: .08em; color: ${PURPLE_DEEP}; margin: 6px 0 22px;
  }
  .colophon .lead { text-align: left; }

  /* ---- THE FOOT OF EVERY PRINTED PAGE ---------------------------------
     Chromium has no @page margin boxes, so a page NUMBER cannot be printed by
     the document — that comes from the browser's own print footer. What can be
     printed is which book this is and where it came from, which is what a
     reader holding a loose sheet of a forwarded document actually needs.
     ------------------------------------------------------------------- */
  .pagefoot { display: none; }
  @media print {
    .pagefoot {
      display: flex; position: fixed; bottom: 0; left: 0; right: 0;
      justify-content: space-between; gap: 12px;
      border-top: 1px solid ${RULE}; padding-top: 3px;
      font: 7.5pt/1.2 Georgia, 'Times New Roman', serif; color: #8a8194;
    }
    body { padding-bottom: 18px; }
  }

  /* ---- THE BAR AT THE TOP, WHICH NEVER PRINTS ------------------------- */
  .toolbar {
    position: sticky; top: 0; z-index: 5;
    background: ${PURPLE_DEEP}; color: #fff;
    display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
    padding: 10px 16px;
    font: 13px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .toolbar .name { font-weight: 600; letter-spacing: .02em; }
  .toolbar .spacer { flex: 1 1 auto; }
  .toolbar a, .toolbar button {
    font: inherit; color: #fff; background: rgba(255,255,255,.12);
    border: 1px solid rgba(255,255,255,.22); border-radius: 6px;
    padding: 5px 12px; cursor: pointer; text-decoration: none;
  }
  .toolbar a:hover, .toolbar button:hover { background: rgba(255,255,255,.22); }
  .toolbar .hint { color: #cfc4de; font-size: 12px; }

  /* -------------------------------------------------------------------
     A PHONE, AND ONLY A PHONE.

     "screen and" IS LOAD-BEARING AND WAS MISSING. Under print the sheet's own
     width collapses to auto and the page's width is the A4 text block — 643px
     — which is under 860, so a bare max-width query MATCHES THE PRINTED PAGE.
     The dashboard's four columns and the Rectors network's three
     administrations were therefore being printed stacked one above another,
     in the phone layout, on A4.

     Nobody would have seen it from a screenshot: every picture of this book
     was taken in a 1000px window, where the query does not match. It surfaced
     because a measurement of the network figure at the printed width reported
     all three administrations at the same centre.
     ------------------------------------------------------------------- */
  @media screen and (max-width: 860px) {
    .sheet { width: auto; max-width: 100%; margin: 12px 8px; padding: 22px 18px; min-height: 0; }
    .cover h1 { font-size: 30pt; }
    .panel .panel-body { display: block; }
    .panel .col { border-left: 0; border-top: 1px solid ${RULE}; }
    .panel .col:first-child { border-top: 0; }

    /* THE FIGURE STACKS, SO ITS CONNECTORS MUST TOO. The rail and the drops
       were laid out across three columns whatever the columns were doing, so
       a phone showed a three-way bracket over one stacked box. One centred
       line says the same thing when everything is in a single file. */
    .network .cols { display: block; }
    .network .node { margin: 8px 0; }
    .network .rail::before, .network .rail .tick, .network .drop .tick { display: none; }
    .network .rail, .network .drop { display: block; height: 12px; }
    .network .rail::after, .network .drop::after {
      content: ''; display: block; width: 1px; height: 100%; margin: 0 auto;
      background: #d6cce4;
    }
  }
`;
}


// ---------------------------------------------------------------------------
// 2. THE BLOCKS
// ---------------------------------------------------------------------------

function renderBlock(b: Block): string {
  switch (b.kind) {
    case 'p':
      return `<p>${escape(b.text)}</p>`;

    case 'lead':
      return `<p class="lead">${escape(b.text)}</p>`;

    case 'h':
      return `<h4>${escape(b.text)}</h4>`;

    case 'bullets':
      return `<ul class="bullets">${
        b.items.map((i) => `<li>${escape(i)}</li>`).join('')}</ul>`;

    case 'defs':
      return `<dl class="defs">${b.items.map((i) => `<div>`
        + `<dt>${escape(i.term)}</dt><dd>${escape(i.text)}</dd></div>`).join('')}</dl>`;

    case 'flow':
      // THE ARROW IS A CHARACTER AND NOT AN IMAGE, so it survives being
      // forwarded, saved and printed on a machine with no fonts installed
      // beyond the ones every machine has.
      return `<div class="flow">${b.steps.map((s, i) => (i === 0 ? '' : '<span class="arrow">▼</span>')
        + `<span class="step">${escape(s)}</span>`).join('')}</div>`;

    case 'equation':
      return `<div class="equation">${b.lines.map((l) => (
        // A LINE THAT IS ONLY AN OPERATOR IS SET AS ONE. '+' and '=' are not
        // terms of the equation and setting them at term size would read as
        // three headings with punctuation between them.
        /^[+=]$/.test(l.trim())
          ? `<div class="op">${escape(l)}</div>`
          : `<div class="term">${escape(l)}</div>`)).join('')}</div>`;

    case 'panel':
      return `<div class="panel">
  <div class="panel-head">
    <div class="t">${escape(b.title)}</div>
    ${b.subtitle ? `<div class="s">${escape(b.subtitle)}</div>` : ''}
  </div>
  <div class="panel-body">${b.columns.map((c) => `<div class="col">
    <h5>${escape(c.heading)}</h5>
    <ul>${c.items.map((i) => `<li>${escape(i)}</li>`).join('')}</ul>
  </div>`).join('')}</div>
</div>`;

    case 'tree':
      return `<div class="tree">
  <div class="root">${escape(b.root)}</div>
  <div class="branches">${b.branches.map((br) => `<div class="branch">
    <span class="label">${escape(br.label)}</span>
    ${br.children?.length
      ? `<ul class="children">${br.children.map((c) => `<li>${escape(c)}</li>`).join('')}</ul>`
      : ''}
  </div>`).join('')}</div>
</div>`;

    case 'network': {
      // EACH ADMINISTRATION IS NAMED, AND NO NAME APPEARS TWICE. The content
      // file carries the University's own three examples and says where they
      // came from.
      //
      // WHAT THEY NO LONGER EACH CARRY is the list of what is inside them.
      // See the stylesheet: it is one band under all of them.
      const columns = b.administrations.length;
      const nodes = b.administrations
        .map((a) => `<div class="node">${escape(a)}</div>`).join('');
      // WHERE THE FIRST AND LAST COLUMN'S CENTRES ACTUALLY ARE.
      //
      // Not 100%/(2n) — that is only right when the columns touch. With `gap`
      // between n columns each one is (100% - (n-1)·gap)/n wide, so its centre
      // sits half of that from its own edge. The bar is drawn between those two
      // points and the ticks are placed by the same flex rule as the columns,
      // so the drawing lines up at any column count rather than nearly lining
      // up at three.
      const GAP = 12;
      const half = `calc((100% - ${(columns - 1) * GAP}px) / ${columns * 2})`;
      const ticks = '<span class="tick"></span>'.repeat(columns);
      return `<div class="network">
  <div class="root">${escape(b.root)}</div>
  <div class="stem"></div>
  <div class="rail" style="--edge: ${half}">${ticks}</div>
  <div class="cols">${nodes}</div>
  <div class="drop">${ticks}</div>
  <div class="band">${b.under.map(escape).join(' · ')}</div>
</div>`;
    }

    case 'numbered':
      return `<ol class="numbered">${b.items.map((i) => `<li>
    <span class="n">${i.n}</span>
    <span class="t">${escape(i.title)}</span>
    ${i.text ? `<span>${escape(i.text)}</span>` : ''}
  </li>`).join('')}</ol>`;

    case 'fields':
      return `<div class="fields">${b.items.map((f) => `<div class="field">
    <span class="label">${escape(f)}</span><span class="line"></span>
  </div>`).join('')}</div>`;

    case 'instruction':
      // AN INSTRUCTION ON A FORM COMES WITH SOMEWHERE TO ANSWER IT. The
      // University wrote "Provide a summary of your academic career" and then
      // the next heading; printed literally that is a question with no space
      // under it, which on paper is an oversight rather than a design.
      return `<p class="instruction">${escape(b.text)}</p><div class="writein"></div>`;
  }
}

const blocks = (list: Block[]): string => list.map(renderBlock).join('\n');


// ---------------------------------------------------------------------------
// 3. THE PAGES
// ---------------------------------------------------------------------------

function cover(book: Book): string {
  return `<section class="sheet cover">
  <div>
    <img class="crest" src="${CREST_DATA_URI}" alt="">
    <p class="institution">${escape(book.institution)}</p>
    <p class="motto">${escape(UNIVERSITY.motto)}</p>
  </div>
  <div>
    <h1>${escape(book.title)}</h1>
    <div class="rule"></div>
    <p class="subtitle">${escape(book.subtitle)}</p>
  </div>
  <div class="foot">
    <!-- ----------------------------------------------------------------
         THE SEAT, NOT THE STREET.

         The cover carried "Opposite Bulu Blind Junction, Buea-Cameroon" and
         the University removed it on 16 September 2026.

         They were right, and constants.ts had already written down the
         reasoning for a different document (no backticks in this comment: the
         whole page is a template literal, and a pair of them here would end it
         mid-sentence). The campus address belongs on
         correspondence, "where it is what the reader actually needs", while a
         document that travels across borders should "name the institution
         behind the holder rather than one of the places it teaches". This
         prospectus is emailed to a professor who has never heard of Buea and
         is deciding whether ICOF is a real institution. A junction in one town
         answers a question they were not asking.
         ---------------------------------------------------------------- -->
    <p>${escape(UNIVERSITY.headquarters)}</p>
    <p>${escape(UNIVERSITY.website)} · ${escape(UNIVERSITY.email)}</p>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// THE VICE-CHANCELLOR'S MESSAGE
// ---------------------------------------------------------------------------
//
// A signed letter rather than a chapter, and it is set as one: the University's
// letterhead colours, the paragraphs, a closing line set apart, and a name with
// an office and an address under it.
//
// IT COMES BEFORE THE FOREWORD. The Foreword is the University's account of the
// model; this is a person asking somebody to come and build it. A reader who
// opens the book meets the invitation first and the architecture second, which
// is the order they will care about them in.
//
// NO PORTRAIT. There is room designed for one and the University has not chosen
// a photograph yet — "some of those pictures are not good. so make sure i
// recommend before using." `scripts/build-prospectus-images.mjs` prepares
// whichever they name.

function viceChancellorsMessage(book: Book): string {
  const m = book.viceChancellor;
  return `<section class="sheet letter">
  ${runningHead(book.institution, 'From the Vice-Chancellor')}
  <p class="chapter-no">A message from the Vice-Chancellor</p>
  <h3 class="chapter-title">${escape(m.title)}</h3>
  <div class="opening-rule"></div>
  ${m.paragraphs.map((p) => `<p>${escape(p)}</p>`).join('\n  ')}
  <p class="lead">${escape(m.close)}</p>
  <div class="signoff">
    <div class="rule"></div>
    <p class="who">${escape(m.name)}</p>
    <p class="what">${escape(m.role)} · ${escape(m.office)}</p>
    <p class="what">${escape(m.email)}</p>
  </div>
</section>`;
}

function runningHead(left: string, right: string): string {
  return `<div class="runhead"><span>${escape(left)}</span><span>${escape(right)}</span></div>`;
}

function foreword(book: Book): string {
  return `<section class="sheet">
  ${runningHead(book.institution, book.title)}
  <p class="chapter-no">${escape(book.foreword.title)}</p>
  <h3 class="chapter-title">${escape(book.title)}</h3>
  <div class="opening-rule"></div>
  ${blocks(book.foreword.blocks)}
</section>`;
}

function contents(book: Book): string {
  const rows = book.parts.map((part) => {
    const head = `<p class="part">Part ${escape(part.ordinal)} · ${escape(part.title)}</p>`;
    const chapters = part.chapters.map((c, i) => {
      // THE CHAPTER'S NUMBER COMES FROM ITS POSITION IN THE BOOK, not from a
      // second list that has to be kept in step with the first. A contents page
      // that disagrees with the book is worse than no contents page, because a
      // reader trusts it.
      const n = chaptersInOrder(book).find((e) => e.chapter === c)?.number ?? i + 1;
      return `<div class="row">
      <span class="no">${n}</span>
      <span class="name">${escape(c.title)}</span>
      <span class="dots"></span>
    </div>`;
    }).join('');
    return head + chapters;
  }).join('');

  return `<section class="sheet">
  ${runningHead(book.institution, book.title)}
  <p class="chapter-no">Contents</p>
  <h3 class="chapter-title">What is in this book</h3>
  <div class="opening-rule"></div>
  <div class="toc">${rows}
    <p class="part">${escape(book.final.label)}</p>
    <div class="row"><span class="no">—</span><span class="name">${escape(book.final.title)}</span><span class="dots"></span></div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// THE PLATE PAGE.
// ---------------------------------------------------------------------------
//
// Three photographs of the 2024 graduation, between the contents and Part I.
// The conferral, the hooding and the academic procession — three moments of the
// one act a university exists to perform, which is the argument the forty
// chapters after it are making in prose.
//
// ONE CAPTION, NOT THREE. Every word printed in this book that the University
// did not write has to be defended in `prospectus.test.mjs`, and three
// descriptive captions would be three sentences of mine narrating their
// photographs. The single line says what the plate is and takes its year from
// the University's own folder name, which is the same evidence the photographs
// were selected on.

function plates(book: Book): string {
  return `<section class="sheet plates">
  <div>
    <img class="wide" src="${CONGREGATION_PLATE}" alt="">
    <div class="pair">
      <img src="${HOODING_PLATE}" alt="">
      <img src="${CONFERRAL_PLATE}" alt="">
    </div>
    <p class="caption">${escape(book.institution)} · Graduation, 2024</p>
  </div>
</section>`;
}

function divider(part: Part): string {
  return `<section class="sheet divider">
  <div class="inner">
    <p class="part-no">Part ${escape(part.ordinal)}</p>
    <h2>${escape(part.title)}</h2>
    <div class="rule"></div>
    <ol>${part.chapters.map((c) => `<li>${escape(c.title)}</li>`).join('')}</ol>
  </div>
</section>`;
}

function chapterPage(book: Book, part: Part, chapter: Chapter): string {
  return `<section class="sheet">
  ${runningHead(`Part ${part.ordinal} · ${part.title}`, book.institution)}
  <p class="chapter-no">Chapter ${escape(chapter.ordinal)}</p>
  <h3 class="chapter-title">${escape(chapter.title)}</h3>
  <div class="opening-rule"></div>
  ${blocks(chapter.blocks)}
</section>`;
}

function finalSection(book: Book): string {
  return `<section class="sheet">
  ${runningHead(book.final.label, book.institution)}
  <p class="chapter-no">${escape(book.final.label)}</p>
  <h3 class="chapter-title">${escape(book.final.title)}</h3>
  <div class="opening-rule"></div>
  ${blocks(book.final.blocks)}
</section>`;
}

function colophon(book: Book): string {
  return `<section class="sheet colophon">
  <img class="crest" src="${CREST_DATA_URI}" alt=""
       style="width:72px;height:72px;object-fit:contain;margin:0 auto 14px;display:block">
  <p class="chapter-no">${escape(book.institution)}</p>
  <h3 class="chapter-title">${escape(book.colophon.title)}</h3>
  <p class="strapline">${escape(book.colophon.strapline)}</p>
  ${blocks(book.colophon.blocks)}
</section>`;
}


// ---------------------------------------------------------------------------
// 4. THE WHOLE BOOK
// ---------------------------------------------------------------------------

export interface BookOptions {
  /**
   * Put the browser's print dialogue over it on load.
   *
   * The same bytes either way — see `/api/document/archived`, which makes the
   * same choice for the same reason: a second rendering path for printing is a
   * second thing to keep in step, and the one that drifts is always the one
   * nobody looks at.
   */
  print?: boolean;
  /**
   * The bar across the top with Print and Download on it.
   *
   * OFF BY DEFAULT, because the copy that gets attached to an email should be
   * the book and not the book with a toolbar in it. The reading route turns it
   * on; the download does not.
   */
  toolbar?: boolean;
  /** Where this copy can be read again, printed into the foot of every page. */
  sourceUrl?: string;
}

export function renderBook(book: Book, options: BookOptions = {}): string {
  const pages: string[] = [
    cover(book), viceChancellorsMessage(book), foreword(book), contents(book),
    plates(book),
  ];

  for (const part of book.parts) {
    pages.push(divider(part));
    for (const chapter of part.chapters) pages.push(chapterPage(book, part, chapter));
  }
  pages.push(finalSection(book));
  pages.push(colophon(book));

  const title = `${book.title} — ${book.institution}`;

  const toolbar = options.toolbar ? `<div class="toolbar screen-only">
  <span class="name">${escape(book.title)}</span>
  <span class="hint">${escape(book.institution)}</span>
  <span class="spacer"></span>
  <button type="button" onclick="window.print()">Print or save as PDF</button>
</div>` : '';

  // THE PRINT TRIGGER IS THREE LINES AND NOT A LIBRARY, for the reason the
  // archived-document route gives: `afterprint` rather than a timer, so a
  // reader who cancels the dialogue keeps the book on screen instead of
  // watching a blank tab.
  const trigger = options.print
    ? `<script>window.addEventListener('load',function(){window.print();});</script>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<meta name="author" content="${escape(book.institution)}">
<meta name="description" content="${escape(book.subtitle)}">
<style>${styles()}</style>
</head>
<body>
${toolbar}
${pages.join('\n')}
<div class="pagefoot">
  <span>${escape(book.institution)} · ${escape(book.title)}</span>
  <span>${escape(options.sourceUrl ?? UNIVERSITY.website)}</span>
</div>
${trigger}
</body>
</html>`;
}


// ---------------------------------------------------------------------------
// 5. THE BOOK AS A MESSAGE
// ---------------------------------------------------------------------------
//
// WhatsApp cannot be handed a file by a web page — 079 sets that out at length
// and nothing here changes it. What it can be handed is a message, so the
// message carries what the book is, who it is from, and the address at which
// the whole thing can be read.
//
// SHORT ON PURPOSE. A WhatsApp message that runs to four paragraphs is read as
// far as the "read more" and no further.

export function bookAsMessage(book: Book, url: string, recipient?: string | null): string {
  const greeting = recipient?.trim() ? `Dear ${recipient.trim()},\n\n` : '';
  return `${greeting}${book.institution} — ${book.title}\n`
    + `${book.subtitle}\n\n`
    + 'The full prospectus, including the office of National Rector, the National '
    + 'Administration, the appointment process and the application form:\n'
    + `${url}\n\n`
    + `${UNIVERSITY.name}\n${UNIVERSITY.email}`;
}

/**
 * The covering note for an email, as the University's own correspondence would
 * word it.
 *
 * Returned as a subject and a body rather than one string, because the
 * Correspondence Center takes them separately and gluing them together here
 * would only mean splitting them again there.
 */
export function bookAsCoveringLetter(book: Book, url: string):
{ subject: string; body: string } {
  return {
    subject: `${book.title} — ${book.institution}`,
    body: [
      `${book.institution} is establishing a network of National Administrations led by `
      + 'qualified academic and educational leaders.',
      '',
      `Our prospectus, ${book.title}, sets out the office in full: the National `
      + 'Administration, student enrollment, staffing, financial administration, academic '
      + 'participation, technology, multilingual learning, institutional governance, '
      + 'development, and the process through which qualified candidates may apply. The '
      + 'application form is at the end of it.',
      '',
      'The prospectus may be read and printed here:',
      url,
      '',
      book.colophon.strapline,
    ].join('\n'),
  };
}
