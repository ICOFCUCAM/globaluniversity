// ---------------------------------------------------------------------------
// THE LETTER AS IT WAS WRITTEN — sanitised on the way IN.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A TOKENISER AND NOT A REGULAR EXPRESSION
// ---------------------------------------------------------------------------
//
// Every regex HTML sanitiser ever written has been bypassed, and the bypasses
// are not exotic: `<scr<script>ipt>` survives a single-pass strip, `<img src=x
// onerror=y>` survives a tag allow-list applied without an attribute
// allow-list, and `<a href="javascript:…">` survives both.
//
// This walks the string once, recognises exactly three things — a comment, a
// tag, and text — and REBUILDS the output from what it recognised. Nothing is
// stripped and nothing is patched: a tag that is not on the list is simply not
// written, and an attribute that is not on the list is simply not carried. What
// comes out is constructed from an allow-list, so there is nothing to bypass.
//
// ---------------------------------------------------------------------------
// AND WHY ON THE WAY IN
// ---------------------------------------------------------------------------
//
// Sanitising on the way out would mean the bytes in the archive and the bytes
// on the page are different documents — and the SHA-256 in
// `correspondence_letters.content_hash` would then prove the wrong one. The
// University's rule is that the archived document IS what was sent. So the
// stored body is already safe, and printing it is a copy.
//
// Migration 049 says the same thing in the database, crudely and deliberately:
// a second sophisticated sanitiser in SQL would be a second one to keep in step
// with this. The database's job there is to refuse the caller that forgets.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 1. WHAT AN OFFICIAL LETTER MAY CONTAIN
// ---------------------------------------------------------------------------
//
// The University asked for paragraphs, headings, tables, page breaks and
// emphasis. That is this list and nothing else — no images, no links, no
// styling attributes. A letter is not a web page: it is printed, and everything
// that cannot be printed is either noise or an attack.

const ALLOWED = new Set([
  'p', 'br', 'hr',
  'strong', 'b', 'em', 'i', 'u',
  'h2', 'h3',
  'ul', 'ol', 'li',
  'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
]);

/** Tags that stand alone. Written as `<br>`, never `<br></br>`. */
const VOID_TAGS = new Set(['br', 'hr']);

/**
 * The one attribute carried, and only with one value.
 *
 * A PAGE BREAK IS CONTENT, not styling: the Vice-Chancellor deciding that the
 * schedule starts on a fresh page is a decision about the document. Everything
 * else — style, class, id, width, colour — is dropped, because an attribute
 * allow-list with one entry cannot be the way a script gets in.
 */
const PAGE_BREAK_CLASS = 'page-break';

export const EDITOR_TAGS = Array.from(ALLOWED);

// ---------------------------------------------------------------------------
// 2. THE TOKENISER
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// ESCAPING THAT CAN BE RUN TWICE.
//
// The obvious version — replace every `&` with `&amp;` — is NOT idempotent, and
// the test caught it immediately: sanitising an already-sanitised body turned
// `&amp;` into `&amp;amp;`, so "Business & Management" gained a letter every
// time anybody opened and saved the letter.
//
// That is not cosmetic. `isSanitised` asks whether the stored body survives
// sanitising unchanged, and the generator refuses to print a body that does
// not. A non-idempotent escape means a perfectly safe letter reports as
// tampered with and cannot be issued.
//
// So an `&` that already begins a well-formed entity is left alone.
// ---------------------------------------------------------------------------
const ENTITY = /&(?:#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,30});/;

const escapeText = (s: string): string =>
  s.replace(/&/g, (m, at: number, whole: string) =>
    (ENTITY.exec(whole.slice(at))?.index === 0 ? m : '&amp;'))
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');

interface Tag {
  name: string;
  closing: boolean;
  selfClosing: boolean;
  pageBreak: boolean;
}

/**
 * Read a tag starting at `<`. Returns the tag and where it ended, or null if
 * what follows the `<` is not a tag at all — in which case the `<` is text.
 */
function readTag(html: string, at: number): { tag: Tag; end: number } | null {
  const m = /^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/.exec(html.slice(at));
  if (!m) return null;
  const [whole, slash, rawName, rest] = m;
  const name = rawName.toLowerCase();

  // THE ONLY ATTRIBUTE READ AT ALL. Everything else in `rest` is discarded
  // without being parsed, which is the point: an attribute that is never read
  // cannot be mishandled.
  const pageBreak = /class\s*=\s*["']?\s*page-break\s*["']?/i.test(rest);

  return {
    tag: {
      name,
      closing: slash === '/',
      selfClosing: /\/\s*$/.test(rest) || VOID_TAGS.has(name),
      pageBreak,
    },
    end: at + whole.length,
  };
}

/**
 * Sanitise a letter body written in a rich-text editor.
 *
 * REBUILDS RATHER THAN STRIPS. The output is constructed from the allow-list:
 * text is escaped, permitted tags are re-emitted in a normal form, and anything
 * else is not written at all. A `<script>` is not removed — it is never
 * recognised as something to write.
 *
 * UNCLOSED TAGS ARE CLOSED. A body ending mid-paragraph would otherwise swallow
 * the signature block and the seal panel into the letter's last sentence, which
 * is a defect nobody sees until it is printed.
 */
export function sanitiseLetterHtml(input: string): string {
  const html = String(input ?? '');
  const out: string[] = [];
  const open: string[] = [];
  let i = 0;

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      out.push(escapeText(html.slice(i)));
      break;
    }
    if (lt > i) out.push(escapeText(html.slice(i, lt)));

    // A COMMENT IS SKIPPED WHOLE, and an unterminated one swallows the rest.
    // `<!-- <p>text` must not leave the `<p>` behind as markup.
    if (html.startsWith('<!--', lt)) {
      const close = html.indexOf('-->', lt + 4);
      i = close === -1 ? html.length : close + 3;
      continue;
    }
    // A doctype or processing instruction is not content.
    if (html.startsWith('<!', lt) || html.startsWith('<?', lt)) {
      const close = html.indexOf('>', lt + 2);
      i = close === -1 ? html.length : close + 1;
      continue;
    }

    const read = readTag(html, lt);
    if (!read) {
      // NOT A TAG. A bare `<` in prose — "budgets < 5%" — is text, and escaping
      // it is what stops it becoming the start of one.
      out.push('&lt;');
      i = lt + 1;
      continue;
    }

    const { tag, end } = read;
    i = end;

    // ---------------------------------------------------------------------
    // THE DECISION, AND IT IS THE WHOLE SANITISER.
    //
    // A tag not on the list is not written. Its TEXT still is — dropping the
    // content of an unknown tag would silently delete a sentence the
    // Vice-Chancellor wrote, and a letter quietly missing a paragraph is worse
    // than one carrying a stray word.
    //
    // Except for the tags whose content is not prose. `<script>alert(1)</script>`
    // must not leave `alert(1)` sitting in the letter.
    // ---------------------------------------------------------------------
    if (!ALLOWED.has(tag.name)) {
      if (!tag.closing && CONTENT_IS_NOT_PROSE.has(tag.name)) {
        const close = new RegExp(`<\\s*/\\s*${tag.name}\\s*>`, 'i').exec(html.slice(i));
        i += close ? close.index + close[0].length : html.length - i;
      }
      continue;
    }

    if (tag.selfClosing) {
      out.push(tag.name === 'hr' && tag.pageBreak
        ? `<hr class="${PAGE_BREAK_CLASS}">`
        : `<${tag.name}>`);
      continue;
    }

    if (tag.closing) {
      // A CLOSING TAG NOTHING OPENED IS DROPPED. Writing it would unbalance the
      // document in the other direction.
      const last = open.lastIndexOf(tag.name);
      if (last === -1) continue;
      // Close anything left open inside it, innermost first.
      while (open.length > last) out.push(`</${open.pop()}>`);
      continue;
    }

    open.push(tag.name);
    out.push(`<${tag.name}>`);
  }

  while (open.length) out.push(`</${open.pop()}>`);
  return out.join('').trim();
}

/** Tags whose contents are code or styling, not the letter. */
const CONTENT_IS_NOT_PROSE = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'svg',
]);

// ---------------------------------------------------------------------------
// 3. READING IT BACK
// ---------------------------------------------------------------------------

/**
 * The letter as plain text, for the length checks and for a plain-text email.
 *
 * `objectionsTo` measures the body against a minimum length, and a body of
 * `<p></p><p></p>` is forty characters of nothing. Measuring the prose is what
 * makes that check mean what it says.
 */
export function letterPlainText(html: string, format: string | null | undefined): string {
  if (format !== 'html') return String(html ?? '');
  return String(html ?? '')
    .replace(/<\s*(br|\/p|\/h2|\/h3|\/li|\/tr)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Whether this body is safe to print without further treatment.
 *
 * Used as an assertion at the point of generating a letter rather than as a
 * second sanitiser: if the stored body does not survive this, something wrote
 * to the column without going through `sanitiseLetterHtml`, and the right
 * response is to refuse to generate rather than to clean it up quietly.
 */
export function isSanitised(html: string, format: string | null | undefined): boolean {
  if (format !== 'html') return true;
  return sanitiseLetterHtml(html) === String(html ?? '').trim();
}
