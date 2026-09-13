// ---------------------------------------------------------------------------
// ATTACKING THE LETTER SANITISER.
//
// Run with:  node src/lib/letterMarkup.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THE CASES BELOW AND NOT "IT STRIPS SCRIPT TAGS"
// ---------------------------------------------------------------------------
//
// Every one of these is a documented bypass of a sanitiser somebody shipped.
// A test that checks `<script>` is removed proves nothing: that is the case the
// author had in mind. The cases that matter are the ones they did not —
// `<scr<script>ipt>`, which a single-pass strip reassembles into a working
// script; `<img onerror>`, which survives a tag allow-list applied without an
// attribute allow-list; and `javascript:` in an href, which survives both.
//
// The body of a letter goes onto a SEALED document that the University's own
// verification page vouches for. A sanitiser that can be walked past here is a
// sanitiser that puts the University's seal on somebody else's content.
//
// Prove a guard by breaking it.
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

const here = new URL('.', import.meta.url).pathname;
const cache = join(here, '../../node_modules/.cache/icof');
mkdirSync(cache, { recursive: true });
const out = join(cache, 'letterMarkup.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'letterMarkup.ts'), '--bundle', '--format=esm', '--platform=node',
  `--outfile=${out}`, '--log-level=error', `--alias:@=${join(here, '..')}`,
]);
const M = await import(out);

/** Nothing that can execute, reach out, or style the page survives. */
function dangerous(html) {
  return /<\s*(script|style|iframe|object|embed|img|a|svg|link|meta|form|input)\b/i.test(html)
    || /\son[a-z]+\s*=/i.test(html)
    || /javascript:/i.test(html)
    || /\bstyle\s*=/i.test(html)
    || /\bsrc\s*=/i.test(html)
    || /\bhref\s*=/i.test(html);
}

console.log('\nThe bypasses that have worked on real sanitisers\n');

const attacks = [
  ['a plain script tag', '<p>Dear Minister,</p><script>steal()</script>'],
  // A SINGLE-PASS STRIP REASSEMBLES THIS into <script>. The classic.
  ['a script nested inside itself', '<scr<script>ipt>steal()</scr</script>ipt>'],
  ['an event handler on a permitted tag', '<p onclick="steal()">Text.</p>'],
  ['an event handler with odd spacing', '<p\n  OnClick = "steal()" >Text.</p>'],
  ['an image with an error handler', '<img src=x onerror=steal()>'],
  ['a javascript link', '<a href="javascript:steal()">Click</a>'],
  ['a style block', '<style>body{display:none}</style><p>Text.</p>'],
  ['a style attribute', '<p style="position:fixed;top:0">Text.</p>'],
  ['an iframe', '<iframe src="https://example.test"></iframe>'],
  ['an svg with a handler', '<svg onload="steal()"><circle r="1"/></svg>'],
  ['a form that posts elsewhere', '<form action="https://example.test"><input name="a"></form>'],
  ['an unterminated comment hiding a tag', '<!-- <p>hidden <script>steal()</script>'],
  ['a doctype', '<!DOCTYPE html><p>Text.</p>'],
  ['an uppercase script tag', '<SCRIPT>steal()</SCRIPT>'],
  ['a script with a null-ish separator', '<script\t>steal()</script>'],
  ['a meta refresh', '<meta http-equiv="refresh" content="0;url=https://example.test">'],
  ['a link to a stylesheet', '<link rel="stylesheet" href="https://example.test/a.css">'],
];

for (const [what, input] of attacks) {
  const clean = M.sanitiseLetterHtml(input);
  check(`${what} does not survive`, dangerous(clean), false);
}

console.log('\nAnd the contents of a script are not left lying in the letter\n');

{
  // STRIPPING THE TAGS AND KEEPING THE TEXT would leave "steal()" as a
  // sentence in a letter from the Vice-Chancellor to a ministry.
  check('the code inside a script is gone',
    M.sanitiseLetterHtml('<p>Dear Minister,</p><script>steal()</script>').includes('steal'),
    false);
  check('and so is the CSS inside a style block',
    M.sanitiseLetterHtml('<style>body{display:none}</style><p>Text.</p>').includes('display'),
    false);
  // BUT ORDINARY TEXT IN AN UNKNOWN TAG IS KEPT. Dropping it would silently
  // delete a sentence somebody wrote, and a letter quietly missing a paragraph
  // is worse than one carrying a stray word.
  check('but a sentence in an unrecognised tag is not deleted',
    M.sanitiseLetterHtml('<section>The University writes.</section>'),
    'The University writes.');
}

console.log('\nWhat the University asked for does survive\n');

{
  check('paragraphs', M.sanitiseLetterHtml('<p>One.</p><p>Two.</p>'), '<p>One.</p><p>Two.</p>');
  check('emphasis',
    M.sanitiseLetterHtml('<p>The University <strong>accepts</strong> the <em>terms</em>.</p>'),
    '<p>The University <strong>accepts</strong> the <em>terms</em>.</p>');
  check('headings', M.sanitiseLetterHtml('<h2>Schedule</h2>'), '<h2>Schedule</h2>');
  check('lists',
    M.sanitiseLetterHtml('<ul><li>One</li><li>Two</li></ul>'),
    '<ul><li>One</li><li>Two</li></ul>');
  check('tables',
    M.sanitiseLetterHtml('<table><tr><th>Item</th><td>Value</td></tr></table>'),
    '<table><tr><th>Item</th><td>Value</td></tr></table>');
  check('a line break', M.sanitiseLetterHtml('<p>One<br>Two</p>'), '<p>One<br>Two</p>');

  // THE ONE ATTRIBUTE THAT IS CONTENT. The Vice-Chancellor deciding the
  // schedule starts on a fresh page is a decision about the document, not
  // styling — so it is carried, and it is the only thing that is.
  check('a page break is carried',
    M.sanitiseLetterHtml('<p>One.</p><hr class="page-break"><p>Two.</p>'),
    '<p>One.</p><hr class="page-break"><p>Two.</p>');
  check('…and any other class is not',
    M.sanitiseLetterHtml('<p class="anything">Text.</p>'), '<p>Text.</p>');
}

console.log('\nThe document it produces is balanced\n');

{
  // AN UNCLOSED PARAGRAPH would otherwise swallow the signature block and the
  // seal panel into the letter's last sentence — a defect nobody sees until it
  // is printed.
  check('an unclosed tag is closed', M.sanitiseLetterHtml('<p>Dear Minister,'),
    '<p>Dear Minister,</p>');
  check('nested unclosed tags are closed innermost first',
    M.sanitiseLetterHtml('<ul><li>One<li>Two'),
    '<ul><li>One<li>Two</li></li></ul>');
  check('a closing tag nothing opened is dropped',
    M.sanitiseLetterHtml('</p><p>Text.</p>'), '<p>Text.</p>');
}

console.log('\nA bare angle bracket in prose is prose\n');

{
  // "budgets < 5%" is a sentence somebody will write, and escaping it is what
  // stops it becoming the start of a tag.
  check('a less-than sign survives as text',
    M.sanitiseLetterHtml('<p>Departments with budgets < 5% of the total.</p>'),
    '<p>Departments with budgets &lt; 5% of the total.</p>');
  // AN ENTITY THE EDITOR ALREADY WROTE IS LEFT ALONE. Re-escaping it would
  // turn "Business & Management" into "Business &amp;amp; Management" — one
  // more "amp;" every time the letter was opened and saved.
  check('an entity survives untouched',
    M.sanitiseLetterHtml('<p>Business &amp; Management</p>'),
    '<p>Business &amp; Management</p>');
  check('and a bare ampersand is escaped once',
    M.sanitiseLetterHtml('<p>Business & Management</p>'),
    '<p>Business &amp; Management</p>');
}

console.log('\nSanitising is idempotent, which is what makes the hash mean anything\n');

{
  // THE ARCHIVED BYTES ARE THE PRINTED BYTES. If sanitising a sanitised body
  // changed it, the stored document and the printed one would differ and the
  // SHA-256 in the archive would prove the wrong one.
  for (const [, input] of attacks) {
    const once = M.sanitiseLetterHtml(input);
    const twice = M.sanitiseLetterHtml(once);
    check('a second pass changes nothing', once, twice);
  }
  check('and a stored body reports as sanitised',
    M.isSanitised(M.sanitiseLetterHtml('<p onclick="x()">Text.</p>'), 'html'), true);
  // THE ASSERTION AT THE POINT OF PRINTING. If this ever fails on a stored
  // body, something wrote to the column without going through the sanitiser —
  // and the right answer is to refuse to generate, not to clean it up quietly.
  check('…while a raw one does not',
    M.isSanitised('<p onclick="x()">Text.</p>', 'html'), false);
  check('and plain text is left entirely alone',
    M.isSanitised('anything at all <script>', 'plain'), true);
}

console.log('\nThe prose can be measured, which is what the length checks need\n');

{
  // A BODY OF `<p></p><p></p>` IS FORTY CHARACTERS OF NOTHING, and the
  // minimum-length objection would pass it.
  check('empty markup measures as empty',
    M.letterPlainText('<p></p><p></p><p></p>', 'html'), '');
  check('and prose measures as its words',
    M.letterPlainText('<p>Dear Minister,</p><p>The University writes.</p>', 'html'),
    'Dear Minister,\nThe University writes.');
  check('a plain body is returned unchanged',
    M.letterPlainText('Dear Minister,', 'plain'), 'Dear Minister,');
}

console.log(failures === 0 ? '\nAll letter markup checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
