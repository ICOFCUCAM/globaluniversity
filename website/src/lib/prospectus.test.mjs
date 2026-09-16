// ---------------------------------------------------------------------------
// THE BOOK, MEASURED IN CHROMIUM RATHER THAN READ IN THE SOURCE.
//
// Run with:  node src/lib/prospectus.test.mjs
//
// ---------------------------------------------------------------------------
// THE THREE THINGS THAT CAN GO WRONG WITH A BOOK, AND THE ONE THAT MATTERS MOST
// ---------------------------------------------------------------------------
//
// 1. SOMETHING THE UNIVERSITY WROTE IS NOT IN IT. Forty chapters were
//    transcribed from a message into a structure. A dropped bullet, a lost
//    paragraph, a heading that became a comment — none of that fails a
//    typecheck, none of it fails a build, and the first person to notice is a
//    candidate reading a prospectus with a hole in it.
//
// 2. SOMETHING IS IN IT THAT THE UNIVERSITY DID NOT WRITE. This is the worse
//    one, and it is the standing rule of this codebase: never invent an
//    institutional fact. A prospectus is read by somebody deciding whether to
//    commit years of their professional life, and a sentence nobody at the
//    University wrote would be read as a promise the University had made.
//
//    So this test does not spot-check for suspicious words. It takes every
//    piece of text in the rendered book, subtracts everything traceable to the
//    University's own text or to `constants.ts`, and requires the remainder to
//    be a short declared list of typesetting words — "Contents", "Chapter
//    Twelve". Anything else is prose the press invented, and it fails.
//
// 3. IT DOES NOT SURVIVE A PRINTER. A cover that prints as black text on white,
//    a page wider than A4 losing its right edge, a toolbar printed across the
//    top of the first page. The standing rule again: measure, do not assume.
//    Every one of those is invisible in the source and decisive on paper.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let failures = 0;
function check(label, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`ok    ${label}`);
  } else {
    failures++;
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
  }
}

// fileURLToPath, NEVER new URL().pathname — the latter percent-encodes a space
// in a directory name and every path built from it then misses.
const here = dirname(fileURLToPath(import.meta.url));
const cache = join(here, '../../node_modules/.cache/icof');
mkdirSync(cache, { recursive: true });

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  // NOT A PASS. A measurement that did not happen is not a measurement that
  // succeeded, and reporting it as one is how a suite comes to vouch for
  // things it never looked at.
  console.error('FAIL  playwright is not installed, so nothing was measured');
  process.exit(1);
}

const bundle = join(cache, 'prospectus.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'prospectus.ts'), '--bundle', '--format=esm',
  '--platform=node', `--outfile=${bundle}`, '--log-level=error',
  `--alias:@=${join(here, '..')}`, '--external:qrcode',
]);
const { renderBook, BOOK_PRINTABLE } = await import(bundle);

const contentBundle = join(cache, 'nationalRector.mjs');
execFileSync('npx', [
  'esbuild', join(here, '../content/nationalRector.ts'), '--bundle', '--format=esm',
  '--platform=node', `--outfile=${contentBundle}`, '--log-level=error',
  `--alias:@=${join(here, '..')}`,
]);
const { NATIONAL_RECTOR, chaptersInOrder } = await import(contentBundle);

const constantsBundle = join(cache, 'universityConstants.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'constants.ts'), '--bundle', '--format=esm',
  '--platform=node', `--outfile=${constantsBundle}`, '--log-level=error',
  `--alias:@=${join(here, '..')}`,
]);
const { UNIVERSITY } = await import(constantsBundle);

const book = NATIONAL_RECTOR;
const chapters = chaptersInOrder(book);


// ---------------------------------------------------------------------------
// EVERY STRING THE UNIVERSITY WROTE, GATHERED FROM THE DATA ITSELF.
// ---------------------------------------------------------------------------
//
// Walked rather than listed, so a block kind added later is covered without
// anybody remembering to come back here. A list would go stale on the first
// new diagram and would then be vouching for text it had never seen.

function harvest(value, out = []) {
  if (typeof value === 'string') { out.push(value); return out; }
  if (Array.isArray(value)) { for (const v of value) harvest(v, out); return out; }
  if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      // `kind` IS STRUCTURE, NOT TEXT. It says which shape a block is —
      // 'bullets', 'defs', 'equation' — and the press never prints it. Counting
      // it as one of the University's words would have this test demanding the
      // word "bullets" appear somewhere in the prospectus.
      if (key === 'kind') continue;
      harvest(v, out);
    }
    return out;
  }
  if (typeof value === 'number') out.push(String(value));
  return out;
}

/** Same shape whichever side it came from — quotes, dashes and runs of space. */
const normalise = (s) => String(s)
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/[–—]/g, '-')
  .replace(/\s+/g, ' ')
  .trim();

// ---------------------------------------------------------------------------
// TWO LISTS, AND THEY ARE NOT THE SAME LIST.
// ---------------------------------------------------------------------------
//
// THE BOOK'S OWN WORDS must all appear on the page. That is the transcription
// check: the University wrote them, so they print.
//
// THE UNIVERSITY'S FACTS may appear. `constants.ts` holds the crest's
// institution, the motto, the address, the registrar's name, the year the
// University was founded — and the cover prints four of them. Requiring all of
// them would fail the book for not printing the Registrar's name on a
// prospectus that has no reason to carry it.
//
// Running the two together is what the first version of this file did, and it
// failed the book for not printing '+237 675 133 426' and '2007'.
const bookWords = harvest(book).map(normalise);
const allowed = bookWords.concat(Object.values(UNIVERSITY).map((v) => normalise(String(v))));
const written = new Set(allowed);

// ---------------------------------------------------------------------------
// AND ONE PART OF THE BOOK IS NOT THE UNIVERSITY'S WORDS AT ALL.
// ---------------------------------------------------------------------------
//
// The Vice-Chancellor's letter was drafted for him, from material the
// University has published, and is awaiting his approval. Everything else
// between these covers is text the University supplied whole.
//
// That distinction is the kind that survives about a week unless something
// measures it. So it is measured: the drafted words are counted, and the count
// is checked against the one file they are allowed to come from. If somebody
// later writes a paragraph of their own into `nationalRector.ts`, the two
// numbers stop agreeing.
const draftedWords = harvest(book.viceChancellor).map(normalise);

/**
 * The words the PRESS supplies, as against the ones the University wrote.
 *
 * DELIBERATELY TINY, AND THAT IS THE POINT OF THE LIST. Every entry here is a
 * sentence in the book that nobody at the University typed, so each one has to
 * be a typesetting word rather than a claim: a contents heading, a chapter
 * number, a part number, a form rule. The moment somebody adds a helpful
 * sentence of explanation to the press, it lands here and has to be defended —
 * which is exactly the conversation that should happen before a prospectus
 * starts saying things on the University's behalf.
 */
const PRESS_WORDS = new Set([
  'Contents',
  'What is in this book',
  // The one button on the reading copy. It is absent from the copy that gets
  // attached to an email, which the last section of this file proves.
  'Print or save as PDF',
  // The label and the running head over the Vice-Chancellor's letter. The
  // letter itself is his; these two say where the reader is.
  'A message from the Vice-Chancellor',
  'From the Vice-Chancellor',
]);
const PRESS_PATTERNS = [
  /^Chapter [A-Z-]+$/,          // Chapter TWENTY-TWO
  /^Part [IVX]+$/,              // Part XIV
  /^[-—▼·]+$/,   // the arrow in a flow, the dash in a contents row
  /^\d+$/,                      // a chapter number in the contents, a step number
  // WHERE THIS COPY CAN BE READ AGAIN, printed into the foot of every page.
  // It is not a claim about the University — it is the address the reader is
  // already at, derived from the request rather than typed anywhere.
  /^https?:\/\//,
];


// ---------------------------------------------------------------------------
// RENDER IT
// ---------------------------------------------------------------------------

const reading = renderBook(book, { toolbar: true, sourceUrl: 'https://example.test/publications/national-rector' });
const attached = renderBook(book, { toolbar: false, sourceUrl: 'https://example.test/publications/national-rector' });

const readingFile = join(cache, 'prospectus-reading.html');
const attachedFile = join(cache, 'prospectus-attached.html');
writeFileSync(readingFile, reading);
writeFileSync(attachedFile, attached);

const browser = await chromium.launch({ executablePath: CHROME });

// A4 AT 96dpi, WHICH IS THE PAGE THE STYLESHEET IS WRITTEN FOR. Measured in a
// default 1280-wide window the sheets lay out at nearly twice their real width,
// every overflow check passes trivially, and the measurement means nothing.
const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
await page.goto(`file://${readingFile}`);

const screen = await page.evaluate(() => {
  const toolbar = document.querySelector('.toolbar');
  return {
    sheets: document.querySelectorAll('.sheet').length,
    covers: document.querySelectorAll('.cover').length,
    dividers: document.querySelectorAll('.divider').length,
    chapterTitles: [...document.querySelectorAll('h3.chapter-title')].map((e) => e.textContent.trim()),
    tocRows: [...document.querySelectorAll('.toc .row')].map((r) => ({
      n: r.querySelector('.no')?.textContent?.trim() ?? '',
      name: r.querySelector('.name')?.textContent?.trim() ?? '',
    })),
    toolbarPresent: Boolean(toolbar),
    title: document.title,
    // EVERY PIECE OF TEXT ON THE PAGE, node by node. innerText would join a
    // heading to the paragraph under it and a run of words could then trace to
    // neither source while looking like it traced to both.
    texts: (() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const out = [];
      let node = walker.nextNode();
      while (node) {
        const t = node.textContent.trim();
        if (t) out.push(t);
        node = walker.nextNode();
      }
      return out;
    })(),
  };
});


console.log('\nNothing the University wrote was lost on the way into the book\n');

// The Vice-Chancellor's letter, the foreword and the contents each open with a
// chapter title, as do the final section and the colophon. Forty chapters plus
// those five.
const FRONT_MATTER_TITLES = 3;   // the letter, the foreword, the contents
const BACK_MATTER_TITLES = 2;    // the application form, the closing page

check('every chapter has a page of its own',
  screen.chapterTitles.length,
  chapters.length + FRONT_MATTER_TITLES + BACK_MATTER_TITLES);

check('…and they are in the order the University put them in',
  screen.chapterTitles.slice(FRONT_MATTER_TITLES, FRONT_MATTER_TITLES + chapters.length),
  chapters.map((c) => c.chapter.title));

check('there is a cover', screen.covers, 1);
check('every part has a divider', screen.dividers, book.parts.length);
check('the sheets add up',
  screen.sheets,
  // cover + the Vice-Chancellor's letter + foreword + contents
  // + one divider per part + one per chapter + the final section + the colophon.
  1 + FRONT_MATTER_TITLES + book.parts.length + chapters.length + BACK_MATTER_TITLES);

// THE CONTENTS PAGE IS CHECKED AGAINST THE BOOK, not against a second list.
// A contents page that disagrees with the book is worse than none, because a
// reader trusts it.
check('the contents lists every chapter and the final section',
  screen.tocRows.length, chapters.length + 1);
check('…numbered from one, in order',
  screen.tocRows.slice(0, chapters.length).map((r) => r.n),
  chapters.map((c) => String(c.number)));
check('…and naming the same chapters the book contains',
  screen.tocRows.slice(0, chapters.length).map((r) => r.name),
  chapters.map((c) => c.chapter.title));

// EVERY PARAGRAPH, BULLET, HEADING AND TERM — traced from the source INTO the
// rendered page. The check above proves the chapter titles survived; this
// proves their contents did.
//
// WRITTEN AS FUNCTIONS OVER A LIST OF TEXTS so that the same two detectors can
// be pointed at a DOCTORED page further down. A detector nobody has watched
// refuse anything is a detector nobody has tested — and both of these are the
// kind that pass happily while looking at nothing.
const whatIsMissing = (texts) => {
  const rendered = new Set(texts.map(normalise));
  return bookWords.filter((w) => w.length > 3 && ![...rendered].some((r) => r.includes(w)));
};

const whatWasInvented = (texts) => [...new Set(texts
  .map(normalise)
  .filter((t) => t.length > 0)
  // A run head sets two things either side of a middle dot; split before
  // judging, or "Part III · Building the National Administration" would look
  // like a sentence from nowhere.
  .flatMap((t) => t.split('·').map((s) => s.trim()).filter(Boolean))
  .filter((t) => !written.has(t))
  .filter((t) => !PRESS_WORDS.has(t))
  .filter((t) => !PRESS_PATTERNS.some((p) => p.test(t)))
  // A term set INSIDE a longer sentence the University wrote is still theirs.
  .filter((t) => !allowed.some((w) => w.includes(t))))];

check('every word of the University’s text reached the page',
  whatIsMissing(screen.texts).slice(0, 5), []);


console.log('\nAnd nothing reached the page that the University did not write\n');

check('nothing on the page came from anywhere but the University',
  whatWasInvented(screen.texts), []);


console.log('\nAnd the one drafted part of it is confined to the file it is declared in\n');

// ---------------------------------------------------------------------------
// THE VICE-CHANCELLOR'S LETTER IS DRAFT COPY. This keeps that true.
// ---------------------------------------------------------------------------
//
// It is the only prose in the book that the University did not supply, it is
// awaiting the Vice-Chancellor's approval, and `viceChancellorMessage.ts` says
// so at length. What this checks is that it stays the ONLY one: that the
// drafted words are exactly the words in that file, and that none of them have
// migrated into `nationalRector.ts`, where they would silently acquire the
// standing of the University's own text.
const vcSource = normalise(
  readFileSync(join(here, '../content/viceChancellorMessage.ts'), 'utf8'));
const rectorSource = normalise(
  readFileSync(join(here, '../content/nationalRector.ts'), 'utf8'));

// MATCHED AGAINST THE SOURCE WITH THE QUOTING TAKEN OUT.
//
// A paragraph is written across five or six lines with a `+` between them and a
// quote at each end, so the sentence never appears in the file as one run of
// characters. Squashing both sides — dropping quotes, plus signs and every
// space — makes the comparison about the words and not about how they were
// typed. The first attempt matched on a six-word prefix instead and reported
// that none of the letter was in the file it is literally defined in.
const squash = (s) => normalise(s).replace(/['"+\s]/g, '');
const vcSquashed = squash(vcSource);
const rectorSquashed = squash(rectorSource);

// Paragraphs, not names and addresses: the signature block's fields are short
// and appear in constants.ts too.
const sentences = draftedWords.filter((w) => w.length > 60);
check('there is a drafted letter to check at all', sentences.length > 5, true);
check('the drafted letter is declared where it says it is',
  sentences.filter((w) => !vcSquashed.includes(squash(w))), []);
check('…and none of it has drifted into the University’s own text',
  sentences.filter((w) => rectorSquashed.includes(squash(w))), []);
check('…and it is marked as awaiting his approval',
  /THIS IS DRAFT COPY\. IT IS NOT YET THE VICE-CHANCELLOR'S OWN WORDS\./
    .test(readFileSync(join(here, '../content/viceChancellorMessage.ts'), 'utf8')), true);

// AND IT IS SIGNED BY THE PERSON THE UNIVERSITY SAYS HOLDS THE OFFICE — read
// out of constants rather than typed here, so a change of Vice-Chancellor
// fails this instead of leaving a prospectus going out over the wrong name.
check('…and signed by the Vice-Chancellor the University names',
  book.viceChancellor.name, UNIVERSITY.viceChancellor);
check('…at the Vice-Chancellor’s own address',
  book.viceChancellor.email, UNIVERSITY.viceChancellorEmail);

// ---------------------------------------------------------------------------
// AND THE SIGNATURE IS ON THE SAME SHEET AS THE LETTER.
// ---------------------------------------------------------------------------
//
// It was not. At the leading the letter was first set in, it came to 1003px
// against a 987px printable page — sixteen pixels over, which prints as a
// second sheet carrying a name, a rule and an email address.
//
// `officialDocument.ts` spends four paragraphs on this exact failure for the
// appointment letter, and the reason is the same here: a signature on a page of
// its own does not look like the end of a letter, it looks like a fault in the
// document.
//
// Measured rather than eyeballed, because sixteen pixels is invisible on screen
// and decisive on paper.



console.log('\nThe cover no longer carries the campus street address\n');

// THE UNIVERSITY'S INSTRUCTION OF 16 SEPTEMBER 2026, held by a test because a
// removal is exactly the kind of change that comes back with the next edit to
// the cover and nobody notices.
check('the street address is gone from the whole book',
  screen.texts.some((t) => /Bulu Blind Junction/i.test(t)), false);
check('…and the cover still says where the institution is seated',
  screen.texts.some((t) => t.includes(UNIVERSITY.headquarters)), true);


console.log('\nAnd both of those refuse a page that deserves refusing\n');

// ---------------------------------------------------------------------------
// THE TWO DETECTORS, BROKEN ON PURPOSE.
// ---------------------------------------------------------------------------
//
// The standing rule: a guard nobody has watched refuse anything is a guard
// nobody has tested. Both checks above are the sort that pass for the wrong
// reason — a harvest that gathered nothing would report nothing missing, and an
// allow-list that swallowed everything would report nothing invented. Each of
// those failures looks exactly like success.
//
// So each detector is pointed at a page it MUST reject.

// A SENTENCE NOBODY AT THE UNIVERSITY WROTE, and the worst kind: a plausible
// institutional claim, in the house voice, that would be read as a promise.
const FABRICATED = 'ICOF Global University is accredited by the Ministry of Higher Education '
  + 'and has campuses in fourteen countries.';
check('an invented institutional claim is caught',
  whatWasInvented([...screen.texts, FABRICATED]), [FABRICATED]);

// A CHAPTER'S WORTH OF THE UNIVERSITY'S TEXT, DROPPED. Not the title — the
// title is checked three different ways above. A body paragraph, which is
// exactly what a transcription loses.
const droppedChapter = chapters[11].chapter;
const droppedText = droppedChapter.blocks.find((b) => b.kind === 'p').text;
const withoutIt = screen.texts.filter((t) => normalise(t) !== normalise(droppedText));
check('a paragraph lost in transcription is caught',
  whatIsMissing(withoutIt), [normalise(droppedText)]);
check('…and the page it was lost from really did have it',
  withoutIt.length, screen.texts.length - 1);


console.log('\nIt survives a printer\n');

await page.emulateMedia({ media: 'print' });
const printed = await page.evaluate(() => {
  const body = document.body.getBoundingClientRect();
  const cover = document.querySelector('.cover');
  const foot = document.querySelector('.pagefoot');
  const toolbar = document.querySelector('.toolbar');
  return {
    coverBackground: cover ? getComputedStyle(cover).backgroundColor : 'absent',
    coverColour: cover ? getComputedStyle(cover).color : 'absent',
    footPosition: foot ? getComputedStyle(foot).position : 'absent',
    footDisplay: foot ? getComputedStyle(foot).display : 'absent',
    footText: foot?.textContent?.replace(/\s+/g, ' ')?.trim() ?? '',
    toolbarDisplay: toolbar ? getComputedStyle(toolbar).display : 'absent',
    // ANYTHING WIDER THAN THE PAGE LOSES ITS RIGHT EDGE ON PAPER. The dashboard
    // panel is four columns in a flex row and is exactly the shape that does
    // this, which is why it is measured rather than eyeballed.
    overflowing: [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > body.right + 1)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className || '?'}`),
  };
});

// A COVER THAT PRINTS WHITE IS NOT A COVER. Browsers drop background colour
// from a printout unless the document says otherwise, and the crest would then
// float in the middle of a blank sheet.
check('the cover keeps its colour under print',
  printed.coverBackground !== 'rgba(0, 0, 0, 0)' && printed.coverBackground !== 'rgb(255, 255, 255)',
  true);
check('…and its text is legible against it', printed.coverColour, 'rgb(255, 255, 255)');

// "position: fixed" is the ONLY mechanism Chromium has for repeating an element
// on every printed page; CSS paged-media margin boxes are the standard way and
// Chromium does not implement them. So the foot repeating IS it computing as
// fixed under print. Reading the stylesheet would not show this — the rule is
// inside an @media print block and computes to display:none on screen.
check('the foot of the page repeats under print', printed.footPosition, 'fixed');
check('…and is visible', printed.footDisplay !== 'none', true);
check('…and says which book this loose sheet came from',
  printed.footText.includes(book.title), true);
check('…and where to read the whole thing',
  printed.footText.includes('example.test'), true);

// THE TOOLBAR IS FURNITURE FROM A SYSTEM THE READER HAS NEVER SEEN.
check('the toolbar never prints', printed.toolbarDisplay, 'none');
check('nothing runs past the edge of the page', printed.overflowing, []);

// ---------------------------------------------------------------------------
// AND THE VICE-CHANCELLOR'S SIGNATURE SHARES ITS PAGE WITH HIS LETTER.
// ---------------------------------------------------------------------------
//
// NOT "the letter fits on one page", which was this check's first wording and
// was the wrong rule. A Vice-Chancellor's letter running to two pages is a
// normal letter; `correspondenceLetterPages.test.mjs` says so in as many words
// and measures the thing that actually embarrasses the University instead —
// "a final page carrying nothing but a signature".
//
// So the rule is that one: a fifth of a page of words above the signature, or
// the signature is on the first page anyway. `officialDocument.ts` spends four
// paragraphs on the same failure for the appointment letter.
//
// MEASURED IN ITS OWN WINDOW, AT THE PRINTABLE WIDTH. The page above is 794px
// wide, which is the SHEET and not the text block on it — lines break wider
// there, and the first version of this check read 1192px for the same letter.
// A line count taken at the wrong measure is not a line count.
const letterPage = await browser.newPage({
  viewport: { width: BOOK_PRINTABLE.width, height: BOOK_PRINTABLE.height },
});
await letterPage.goto(`file://${readingFile}`);
await letterPage.emulateMedia({ media: 'print' });
const letter = await letterPage.evaluate(() => {
  const el = document.querySelector('.letter');
  const sign = document.querySelector('.signoff');
  return {
    height: el ? Math.round(el.getBoundingClientRect().height) : -1,
    top: el ? Math.round(el.getBoundingClientRect().top) : -1,
    signTop: sign ? Math.round(sign.getBoundingClientRect().top) : -1,
    signText: sign?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  };
});
await letterPage.close();

console.log(`      the Vice-Chancellor's letter is ${letter.height}px against a `
  + `${BOOK_PRINTABLE.height}px page`);
// A fifth of a page. The threshold is the one correspondenceLetterPages.test.mjs
// arrived at, and its note on why a narrower one is a coincidence rather than a
// test applies here unchanged.
const MINIMUM_ABOVE = Math.round(BOOK_PRINTABLE.height / 5);
const pageOfSignature = Math.floor((letter.signTop - letter.top) / BOOK_PRINTABLE.height);
const above = (letter.signTop - letter.top) - (pageOfSignature * BOOK_PRINTABLE.height);
console.log(`      the signature is ${above}px into page ${pageOfSignature + 1} of it`);

check('there is a letter and a signature to measure',
  letter.height > 0 && letter.signTop > 0, true);
check('his signature shares its page with his letter',
  pageOfSignature === 0 || above >= MINIMUM_ABOVE, true);
check('…and it is his name under the rule',
  letter.signText.startsWith(book.viceChancellor.name), true);

await page.close();


console.log('\nThe copy that gets attached to an email is the book and nothing else\n');

const attachedPage = await browser.newPage({ viewport: { width: 794, height: 1123 } });
await attachedPage.goto(`file://${attachedFile}`);
const attachedShape = await attachedPage.evaluate(() => ({
  toolbar: document.querySelectorAll('.toolbar').length,
  sheets: document.querySelectorAll('.sheet').length,
  // A FILE THAT FETCHES ANYTHING IS A FILE THAT BREAKS ON A PLANE. The whole
  // argument for embedding the crest as a data URI is that this number is zero.
  remote: [...document.querySelectorAll('img, link, script')]
    .map((el) => el.getAttribute('src') || el.getAttribute('href') || '')
    .filter((u) => /^https?:/i.test(u)),
}));
await attachedPage.close();

check('it carries no toolbar', attachedShape.toolbar, 0);
check('it is the whole book', attachedShape.sheets, screen.sheets);
check('and it asks the network for nothing', attachedShape.remote, []);

await browser.close();

console.log(failures
  ? `\n${failures} check(s) failed.\n`
  : '\nThe book is the University’s words, and it prints.\n');
process.exit(failures ? 1 : 0);
