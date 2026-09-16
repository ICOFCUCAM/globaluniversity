// ---------------------------------------------------------------------------
// THE SYSTEM HANDBOOK SAYS WHAT THE SYSTEM DOES.
//
// Run with:  node src/lib/handbook.test.mjs
//
// ---------------------------------------------------------------------------
// WHAT THIS EXISTS TO PREVENT
// ---------------------------------------------------------------------------
//
// The University asked for "the authoritative operational reference for the use
// of the ICOF Global University digital system". A handbook that is quoted at
// officers and has drifted from the system is worse than no handbook, because
// nobody checks a document with the Vice-Chancellor's name on the front.
//
// Part II and Part VIII are generated for that reason. But a generated file is
// only true on the day it was generated, and it is committed — so the way it
// goes wrong is that somebody changes the capability matrix and does not run
// `npm run handbook`.
//
// THE FIRST SECTION BELOW IS THE WHOLE POINT OF THIS FILE. It asks the live
// matrix the same questions the generator asked and fails if the answers have
// moved. A capability that changes hands therefore breaks the build rather than
// quietly making the handbook wrong.
// ---------------------------------------------------------------------------

import { readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

let failures = 0;
const check = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`ok    ${label}`);
  } else {
    failures++;
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
  }
};

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const src = join(root, 'src');

const cache = join(root, 'node_modules', '.cache', 'iguc-tests');
mkdirSync(cache, { recursive: true });
const bundle = (entry, name) => {
  const out = join(cache, name);
  execFileSync('npx', [
    'esbuild', entry, '--bundle', '--format=esm', '--platform=node',
    `--outfile=${out}`, '--log-level=error', `--alias:@=${src}`,
  ]);
  return out;
};

const { can, ALL_CAPABILITIES } = await import(bundle(join(src, 'lib', 'roles.ts'), 'hb-roles.mjs'));
const { PUBLICATIONS, chapterCount } =
  await import(bundle(join(src, 'lib', 'publications.ts'), 'hb-pubs.mjs'));
const { renderBook, BOOK_PRINTABLE } =
  await import(bundle(join(src, 'lib', 'prospectus.ts'), 'hb-press.mjs'));
const { ROLE_PROFILES, RESTRICTED_TO_THE_TWO, ENFORCED, COUNTS } =
  await import(bundle(join(src, 'content', 'handbookFromTheSystem.ts'), 'hb-gen.mjs'));

const stripTs = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/.*$/gm, '$1 ');

const ROLES = (() => {
  const t = stripTs(readFileSync(join(src, 'lib', 'types.ts'), 'utf8'));
  const m = /export type UserRole\s*=([\s\S]*?);/.exec(t);
  return (m[1].match(/'[a-z-]+'/g) ?? []).map((s) => s.slice(1, -1));
})();

const handbook = PUBLICATIONS.find((p) => p.slug === 'system-handbook');

console.log('\nThe ICOF Global University System Handbook\n');

// ---------------------------------------------------------------------------
// 1. THE GENERATED HALF IS IN STEP WITH THE LIVE SYSTEM
// ---------------------------------------------------------------------------

check('the handbook is on the Vice-Chancellor’s shelf', Boolean(handbook), true);

check('every role in the system has a profile',
  ROLE_PROFILES.map((r) => r.role).sort(), [...ROLES].sort());

// THE STALENESS CHECK. Asked of `can()` rather than of the file the generator
// read, so a matrix edited without rebuilding the handbook fails here.
const drifted = [];
for (const r of ROLE_PROFILES) {
  for (const c of ALL_CAPABILITIES) {
    const live = can(r.role, c);
    const printed = r.capabilities.includes(c);
    if (live !== printed) drifted.push(`${r.role} ${live ? 'now holds' : 'no longer holds'} ${c}`);
  }
}
check('…and every capability it prints is one the system still grants', drifted.slice(0, 8), []);

check('…and the capability count it quotes is the real one',
  COUNTS.capabilities, ALL_CAPABILITIES.length);

check('…and the role count it quotes is the real one', COUNTS.roles, ROLES.length);

// ---------------------------------------------------------------------------
// 2. PART VIII CLAIMS NO RESTRICTION THE SYSTEM HAS STOPPED APPLYING
// ---------------------------------------------------------------------------

const reallyRestricted = ALL_CAPABILITIES
  .filter((c) => {
    const holders = ROLES.filter((r) => can(r, c));
    return holders.length > 0
      && holders.every((r) => r === 'superadmin' || r === 'vice-chancellor');
  })
  .sort();

check('the restricted list is exactly what the matrix restricts',
  [...RESTRICTED_TO_THE_TWO].sort(), reallyRestricted);

// NAMED ONE BY ONE, because these are the ones the University ruled on and a
// list that happens to be right is not the same as these being in it.
for (const c of ['view-certificate-template', 'authorise-certificate-reissue',
  'validate-transcript-exception', 'view-transcript-audit']) {
  check(`…and ${c} is on it`, RESTRICTED_TO_THE_TWO.includes(c), true);
}

// ---------------------------------------------------------------------------
// 3. THE ENFORCED RULES ARE RULES SOMETHING HAS WATCHED REFUSE
// ---------------------------------------------------------------------------

check('Part VIII lists rules from the migrations', ENFORCED.length > 20, true);
check('…and counts them honestly',
  COUNTS.provedRules, ENFORCED.reduce((n, e) => n + e.rules.length, 0));

// EVERY ONE IS STILL IN ITS MIGRATION. A rule that stops being proved must
// leave the handbook, and this is what notices if the generator is stale.
const orphaned = [];
for (const e of ENFORCED) {
  // NORMALISED THE SAME WAY THE GENERATOR NORMALISED IT. In SQL an apostrophe
  // inside a single-quoted string is written twice, so "a student''s whole"
  // in the migration is "a student's whole" in the handbook — and a naive
  // substring check reported two perfectly correct rules as orphans. A test
  // that compares two texts has to compare them in the same alphabet.
  const sql = readFileSync(join(root, 'docs', 'migrations', e.file), 'utf8')
    .replace(/''/g, "'");
  for (const rule of e.rules) {
    // The first few words are enough and survive the line-wrapping the
    // migrations use inside their notices.
    const head = rule.split(/\s+/).slice(0, 4).join(' ');
    if (!sql.includes(head)) orphaned.push(`${e.migration}: ${head}`);
  }
}
check('…and every one of them is still printed by its migration', orphaned.slice(0, 5), []);

// ---------------------------------------------------------------------------
// 4. THE BOOK ITSELF
// ---------------------------------------------------------------------------

const book = handbook.book;
check('it has the eleven parts the University set out', book.parts.length, 11);

check('…including the Lecturer & Student User Guide',
  book.parts.some((pt) => /Lecturer & Student User Guide/.test(pt.title)), true);

check('…and the parts are in the order the University gave them',
  book.parts.map((pt) => pt.ordinal),
  ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']);

check('it is substantial', chapterCount(handbook) > 90, true);

// EVERY CHAPTER HAS SOMETHING IN IT. A part list with an empty chapter reads
// as a document somebody stopped writing.
const empty = book.parts
  .flatMap((pt) => pt.chapters.map((c) => ({ pt: pt.ordinal, c })))
  .filter(({ c }) => c.blocks.length < 2)
  .map(({ pt, c }) => `${pt}: ${c.title}`);
check('…and no chapter is a heading with nothing under it', empty, []);

// ---------------------------------------------------------------------------
// 5. EVERY OFFICE IS ACCOUNTED FOR
//
// A handbook that lists twelve offices in a University of twenty-five roles has
// left thirteen groups of people with no entry. They need not each have a
// chapter — several are treated together — but every one must be NAMED.
// ---------------------------------------------------------------------------

const rendered = renderBook(book, { toolbar: false, sourceUrl: 'https://x.test/p/system-handbook' });
const words = rendered.toLowerCase();

const missing = ROLE_PROFILES
  .filter((r) => !words.includes(r.label.toLowerCase()) && !words.includes(r.role))
  .map((r) => r.label);
check('every role in the system is named somewhere in the handbook', missing, []);

// ---------------------------------------------------------------------------
// 6. NO INSTITUTIONAL FACT IS INVENTED
//
// The standing rule of this codebase. The handbook is the likeliest place in
// the repository for an invented accreditation, campus or statistic to appear,
// because it is long and it is prose.
// ---------------------------------------------------------------------------

const banned = [
  // Things a handbook drifts into claiming. None of these has been stated by
  // the University, and each would be read as institutional fact.
  //
  // `ranking` WAS ON THIS LIST AND WAS WRONG. The University's own words for
  // the Director of Academic Affairs are "ranking immediately below the
  // Vice-Chancellor in the University's executive structure" — a statement
  // about precedence between its own offices, which is exactly the kind of
  // fact this handbook exists to carry. A ban on the substring caught the
  // University quoting itself. What is actually forbidden is a claim about
  // the University's standing against OTHER institutions.
  'accredited by', 'ranked ', 'world ranking', 'league table',
  'award-winning', 'world-class', 'top university',
  'students enrolled', 'alumni worldwide', 'partner universities',
];
const claimed = banned.filter((b) => words.includes(b));
check('it claims no accreditation, ranking or statistic', claimed, []);

// AND NO MARKDOWN. The press renders plain text, so a backtick, an asterisk
// pair or a hash heading prints exactly as typed — and did: "generated by
// `npm run handbook`" reached the rendered page with the backticks showing,
// in the one document that is supposed to be authoritative. Found by reading
// the page rather than the source.
const visible = rendered
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ');
check('…and no Markdown leaks into the printed text',
  /`|\*\*/.test(visible), false);

// AND IT DOES NOT PRINT THE STREET ADDRESS. The University asked on
// 16 September 2026 for "opposite Bulu Blind Junction, Buea Cameroon" to be
// removed. It is still in constants.ts, which this test does not change — but
// nothing this handbook prints may carry it.
check('…and does not print the address the University asked to be removed',
  words.includes('bulu blind'), false);

// ---------------------------------------------------------------------------
// 7. AND THE VICE-CHANCELLOR'S FOREWORD IS DRAFT, COUNTED SEPARATELY
//
// The same discipline the prospectus keeps: the line between "the University
// wrote this" and "this was drafted for the University" is measured rather
// than remembered.
// ---------------------------------------------------------------------------

const vcFile = readFileSync(join(src, 'content', 'viceChancellorMessage.ts'), 'utf8');
check('the foreword is drafted in the file that holds drafts for him',
  /export const HANDBOOK_FOREWORD/.test(vcFile), true);
check('…and that file says it is awaiting his approval',
  /DRAFT COPY AWAITING PROF MEYEMBI'S APPROVAL/i.test(vcFile), true);

// ---------------------------------------------------------------------------
// 8. AND IT SETS ON THE PAGE
//
// Measured, not reasoned about. 105 chapters broke the contents page the first
// time this was rendered: three-digit chapter numbers against a 26px column and
// a title set never to shrink took the page to 646px against 643.
// ---------------------------------------------------------------------------

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({
  viewport: { width: BOOK_PRINTABLE.width, height: BOOK_PRINTABLE.height },
});
await page.setContent(rendered, { waitUntil: 'load' });
const measured = await page.evaluate(() => {
  const d = document.documentElement;
  const sheets = [...document.querySelectorAll('.sheet')];
  const toc = sheets.find((s) => s.textContent.includes('What is in this book'));
  const right = toc ? toc.getBoundingClientRect().right : 0;
  return {
    overflow: d.scrollWidth > d.clientWidth,
    contentsRowsPastTheEdge: toc
      ? [...toc.querySelectorAll('.row .name')]
        .filter((e) => e.getBoundingClientRect().right > right + 0.5).length
      : -1,
    sheets: sheets.length,
  };
});
await browser.close();

check('the printed page does not scroll sideways', measured.overflow, false);
check('…and no contents entry runs off the edge', measured.contentsRowsPastTheEdge, 0);
check('…and it is a whole book', measured.sheets > 60, true);

console.log(failures
  ? `\n${failures} check(s) failed. Run \`npm run handbook\` if the system has moved.\n`
  : `\nThe handbook says what the system does — ${chapterCount(handbook)} chapters, `
    + `${COUNTS.roles} roles, ${COUNTS.provedRules} proved rules.\n`);
process.exit(failures ? 1 : 0);
