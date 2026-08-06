// ---------------------------------------------------------------------------
// The certificate — does it say the right thing about the right person?
//
// Run with:  node src/lib/certificate.test.mjs
//
// WHY THIS FILE EXISTS. Eleven changes were made to this document in one
// sitting and the only check on any of them was somebody looking at a
// screenshot. A certificate is the university's most consequential statement
// about a person; "it looked right" is not a standard it can be held to, and a
// screenshot cannot show what happens to a fifty-character name, a diploma
// wrongly called a degree, or a doctorate printed with a class of honours.
//
// It renders the real component through react-dom/server and reads the markup.
// Rendering is the thing under test — a test that imported the wording tables
// and checked them against themselves would prove only that a file can be read.
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

const dir = join(new URL('../../node_modules/.cache/icof', import.meta.url).pathname);
mkdirSync(dir, { recursive: true });
const bundle = join(dir, 'cert-test.mjs');
execFileSync('npx', [
  'esbuild', new URL('../components/certificate/CertificateDocument.tsx', import.meta.url).pathname,
  '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`, '--log-level=error',
  '--jsx=automatic',
  `--alias:@=${new URL('..', import.meta.url).pathname.replace(/\/$/, '')}`,
  '--external:react', '--external:react-dom',
]);

const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const { default: CertificateDocument } = await import(bundle);
const tplBundle = join(dir, 'tpl-test.mjs');
execFileSync('npx', [
  'esbuild', new URL('./credentialTemplate.ts', import.meta.url).pathname,
  '--bundle', '--format=esm', '--platform=node', `--outfile=${tplBundle}`, '--log-level=error',
]);
const { DEFAULT_CERTIFICATE_DESIGN } = await import(tplBundle);

const BASE = {
  fullName: 'Grace Nalova Meyembi',
  programme: 'Christian Counselling',
  degree: 'Bachelor of Arts',
  classification: 'Second Class Honours (Upper Division)',
  credentialId: 'IGUC-BA-26A9-F8K2-P19D',
  sealCode: 'ICOF-7T2M-XQ4V-K93B',
  issuedOn: new Date('2026-08-05T00:00:00Z'),
};

const render = (data = {}, props = {}) =>
  renderToStaticMarkup(React.createElement(CertificateDocument, {
    design: DEFAULT_CERTIFICATE_DESIGN,
    data: { ...BASE, ...data },
    ...props,
  }));

// Strip tags so assertions are about what a reader sees, not about markup.
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// --- It states the award, the holder and the class. -------------------------
const basic = text(render());
check('the holder is named', basic.includes('Grace Nalova Meyembi'), true);
check('the award is named', basic.includes('Bachelor of Arts'), true);
check('the classification is printed', basic.includes('Second Class Honours (Upper Division)'), true);
check('the credential number is printed', basic.includes('IGUC-BA-26A9-F8K2-P19D'), true);
check('the seal code is printed', basic.includes('ICOF-7T2M-XQ4V-K93B'), true);

// --- The programme. ---------------------------------------------------------
// It was passed in and never rendered for the whole life of this component.
check('the programme is printed', basic.includes('in Christian Counselling'), true);
check(
  'the programme is suppressed when the award title already names it',
  text(render({ degree: 'Bachelor of Theology', programme: 'Theology' })).includes('in Theology'),
  false,
);

// --- The date, spelt out. ---------------------------------------------------
check('the date is spelt', basic.includes('Fifth Day of August, Two Thousand Twenty-Six'), true);
check(
  'an ordinal in the twenties is spelt correctly',
  text(render({ issuedOn: new Date('2026-08-21T00:00:00Z') })).includes('Twenty-First Day'),
  true,
);
check(
  'the thirtieth is not "Thirty-th"',
  text(render({ issuedOn: new Date('2026-08-30T00:00:00Z') })).includes('Thirtieth Day'),
  true,
);

// --- The wording follows the kind of award. ---------------------------------
const diploma = text(render({ degree: 'Diploma in Theology', programme: 'Theology' }));
check('a diploma is not called a degree', diploma.includes('the Degree of'), false);
check('a diploma is called a diploma', diploma.includes('the Diploma of'), true);

const phd = text(render({
  degree: 'Doctor of Philosophy',
  programme: 'Systematic Theology',
  thesisTitle: 'The Doctrine of Providence in the African Church',
}));
check('a doctorate is not classified', phd.includes('Second Class Honours'), false);
check('a doctorate names its thesis', phd.includes('The Doctrine of Providence in the African Church'), true);
check(
  'a taught award does not print a thesis line',
  basic.includes('for the thesis'),
  false,
);

// --- Long names are set to fit rather than overflowing. ---------------------
const longName = 'Emmanuella Chiamaka Nwachukwu-Adeyemi Oluwatosin';
const longHtml = render({ fullName: longName });
check('a long name is set smaller than a short one',
  Number(/font-size:(\d+)px;line-height:1\.12/.exec(longHtml)?.[1]) <
  Number(/font-size:(\d+)px;line-height:1\.12/.exec(render())?.[1]),
  true);
check('the long name still appears in full', text(longHtml).includes(longName), true);

// --- The name fits the sheet it is printed on, not a character count. -------
// The first version counted characters and ignored the page width, so an
// ordinary three-part name broke onto two lines on a portrait sheet while the
// code was satisfied it had fitted.
const portrait = { ...DEFAULT_CERTIFICATE_DESIGN, orientation: 'portrait' };
const renderWith = (design, data = {}) =>
  renderToStaticMarkup(React.createElement(CertificateDocument, {
    design, data: { ...BASE, ...data },
  }));
const sizeIn = (html) => Number(/font-size:(\d+)px;line-height:1\.12/.exec(html)?.[1]);
check(
  'the same name is set smaller on the narrower sheet',
  sizeIn(renderWith(portrait)) < sizeIn(renderWith(DEFAULT_CERTIFICATE_DESIGN)),
  true,
);
check(
  'a name that fits landscape at full size is not shrunk needlessly',
  sizeIn(renderWith(DEFAULT_CERTIFICATE_DESIGN, { fullName: 'John Doe' })),
  42,
);

// --- A certificate with no number is refused. -------------------------------
const noId = text(render({ credentialId: '' }));
check('no credential number means no certificate', noId.includes('No certificate can be rendered'), true);
check('and the refusal does not confer anything', noId.includes('confers upon'), false);
check(
  'but a specimen may have no number',
  text(render({ credentialId: '' }, { specimen: true })).includes('SPECIMEN'),
  true,
);

// --- A specimen is unmistakable, and an issued credential is never marked. ---
check('a specimen is overprinted', text(render({}, { specimen: true })).includes('SPECIMEN'), true);
check('an issued credential is not', basic.includes('SPECIMEN'), false);

// --- A duplicate says so. ---------------------------------------------------
const dup = text(render({ duplicateOf: 'IGUC-BA-24A1-C7X9-M42K' }));
check('a duplicate is marked', dup.includes('Duplicate'), true);
check('and names the original', dup.includes('IGUC-BA-24A1-C7X9-M42K'), true);

// --- The registration reference. --------------------------------------------
check(
  'the registration reference prints when present',
  text(render({ registrationNo: 'ICOFGU/BA202308' })).includes('ICOFGU/BA202308'),
  true,
);
check('and nothing is printed when it is absent', basic.includes('REG. NO.'), false);

// --- It is announced to assistive technology. -------------------------------
const html = render();
check('the document declares itself an article', html.includes('role="article"'), true);
check(
  'and its label states the award and the holder',
  /aria-label="[^"]*Bachelor of Arts[^"]*Grace Nalova Meyembi/.test(html),
  true,
);

// --- The page is set up for print. ------------------------------------------
check('an @page rule is emitted', html.includes('@page { size: A4 landscape; margin: 0; }'), true);

console.log(failures === 0 ? '\nAll certificate checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
