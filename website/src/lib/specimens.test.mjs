// ---------------------------------------------------------------------------
// The specimen certificates — is each one honest about its level, and is each
// one impossible to mistake for an issued credential?
//
// Run with:  node src/lib/specimens.test.mjs
//
// WHY THIS FILE EXISTS. Specimens are the one artefact in this system designed
// to look exactly like the real thing. That makes two failures possible that no
// other screen can produce:
//
//   A SPECIMEN THAT MISSTATES ITS LEVEL teaches the University the wrong form.
//   Somebody approves a diploma specimen that says "confers upon", and the
//   wording is then wrong on every diploma actually issued.
//
//   A SPECIMEN THAT LOOKS ISSUED is a forger's starting material. The whole
//   value of the artwork is that it is hard to reproduce; handing out a
//   convincing blank hands over exactly what is hard to reproduce.
//
// It renders the real component, like certificate.test.mjs, because what is
// under test is the printed document and not the table it was built from.
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

function bundle(source, name) {
  const out = join(dir, name);
  execFileSync('npx', [
    'esbuild', new URL(source, import.meta.url).pathname,
    '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error',
    '--jsx=automatic',
    `--alias:@=${new URL('..', import.meta.url).pathname.replace(/\/$/, '')}`,
    '--external:react', '--external:react-dom',
  ]);
  return out;
}

const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const { default: CertificateDocument } = await import(bundle('../components/certificate/CertificateDocument.tsx', 'spec-cert.mjs'));
const { DEFAULT_CERTIFICATE_DESIGN } = await import(bundle('./credentialTemplate.ts', 'spec-tpl.mjs'));
const { SPECIMENS, specimenById } = await import(bundle('./specimens.ts', 'spec-list.mjs'));
const { courses } = await import(bundle('../content/courses.ts', 'spec-courses.mjs'));
const { awardKindOf } = await import(bundle('./awards.ts', 'spec-awards.mjs'));

const render = (specimen) =>
  renderToStaticMarkup(React.createElement(CertificateDocument, {
    design: DEFAULT_CERTIFICATE_DESIGN,
    data: specimen.data,
    specimen: true,
  }));

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const rendered = Object.fromEntries(SPECIMENS.map((s) => [s.id, text(render(s))]));
const get = (id) => rendered[id];

// --- Every level the University confers has one, and only one. --------------

console.log('\nOne specimen per level, and each level is real\n');

check('there are five specimens', SPECIMENS.length, 5);
check(
  'one per level, in ascending order',
  SPECIMENS.map((s) => s.id),
  ['certificate', 'diploma', 'bachelor', 'master', 'doctorate'],
);
check('no two specimens share an id', new Set(SPECIMENS.map((s) => s.id)).size, SPECIMENS.length);

// THE ANTI-FABRICATION CHECK. Every award named on a specimen must be one the
// University actually offers, matched against the catalogue the public site is
// built from. A specimen carrying an invented award is a picture of a
// qualification that does not exist, and it would circulate as one.
const catalogue = new Set(courses.map((c) => c.title));
for (const s of SPECIMENS) {
  check(
    `${s.level}: “${s.data.degree}” is an award the University offers`,
    catalogue.has(s.data.degree),
    true,
  );
}

// And the award's level must be the level the specimen claims to demonstrate —
// otherwise the doctorate specimen could quietly be a master's and every
// assertion below would still pass.
const EXPECTED_KIND = {
  certificate: 'certificate',
  diploma: 'diploma',
  bachelor: 'bachelors',
  master: 'masters',
  doctorate: 'doctorate',
};
for (const s of SPECIMENS) {
  check(`${s.level}: the award classifies as ${EXPECTED_KIND[s.id]}`, awardKindOf(s.data.degree), EXPECTED_KIND[s.id]);
}

// --- None of them can pass as issued. ---------------------------------------

console.log('\nNone of them can pass as an issued certificate\n');

for (const s of SPECIMENS) {
  check(`${s.level}: SPECIMEN is overprinted`, get(s.id).includes('SPECIMEN'), true);
  check(
    `${s.level}: the credential number says so where a number would be`,
    get(s.id).includes('NOT AN ISSUED CREDENTIAL'),
    true,
  );
  // A plausible number is the dangerous case: IGUC-BTH-26A9-F8K2-P19D reads as
  // real to anyone who has seen one, and SPECIMEN across the face is a layer of
  // ink somebody can crop.
  check(
    `${s.level}: and carries no plausible-looking number`,
    /IGUC-[A-Z]{2,4}-[A-Z0-9]{4}-/.test(get(s.id)),
    false,
  );
  check(
    `${s.level}: the holder is not a plausible graduate`,
    get(s.id).includes('Specimen A. Candidate'),
    true,
  );
}

check(
  'all five name the same holder, so they read as one template not five graduates',
  new Set(SPECIMENS.map((s) => s.data.fullName)).size,
  1,
);

// --- What actually varies by level. -----------------------------------------
//
// These are the four decisions the single Bachelor-of-Theology preview could
// never show, and each one is the University attesting to something specific.

console.log('\nThe conferring verb — a diploma is awarded, a degree is conferred\n');

check('a certificate is awarded to', get('certificate').includes('awards to'), true);
check('a diploma is awarded to', get('diploma').includes('awards to'), true);
check('and a diploma is NOT conferred upon', get('diploma').includes('confers upon'), false);
check('a bachelor’s is conferred upon', get('bachelor').includes('confers upon'), true);
check('a master’s is conferred upon', get('master').includes('confers upon'), true);
// A DOCTORATE IS NEITHER AWARDED NOR CONFERRED. The candidate is ADMITTED to
// the degree, which is what the ceremony actually does, and it is the form the
// older universities use. Reading "confers upon" here would be the sign that
// somebody had flattened the five levels into one wording to simplify the code.
check('a doctorate is admitted to the degree', get('doctorate').includes('has admitted'), true);
check('and a doctorate is not "conferred upon"', get('doctorate').includes('confers upon'), false);
check('nor is it "awarded" like a prize', get('doctorate').includes('awards to'), false);

console.log('\nThe lead-in — a diploma is not called a degree\n');

check('the certificate says “the Certificate of”', get('certificate').includes('the Certificate of'), true);
check('the diploma says “the Diploma of”', get('diploma').includes('the Diploma of'), true);
check('and the diploma never says “the Degree of”', get('diploma').includes('the Degree of'), false);
check('the bachelor’s says “the Degree of”', get('bachelor').includes('the Degree of'), true);
check('the master’s says “the Degree of”', get('master').includes('the Degree of'), true);
check('the doctorate says “the Degree of”', get('doctorate').includes('the Degree of'), true);

// The instrument word is not printed twice. "THE DIPLOMA OF / DIPLOMA IN
// THEOLOGY" is the University stammering on its own document.
check(
  'the diploma does not repeat the instrument word',
  /the Diploma of\s+Diploma/i.test(get('diploma')),
  false,
);
check(
  'the certificate does not repeat the instrument word',
  /the Certificate of\s+Certificate/i.test(get('certificate')),
  false,
);

console.log('\nThe classification — a doctorate has none\n');

check('the diploma prints its distinction', get('diploma').includes('with Distinction'), true);
check('the bachelor’s prints its honours', get('bachelor').includes('Second Class Honours (Upper Division)'), true);
check('the master’s prints its distinction', get('master').includes('with Distinction'), true);
// The failure this catches: a doctorate printed "with Second Class Honours",
// which is meaningless, and which no reviewer looking at a bachelor's preview
// would ever have seen.
check('the doctorate prints no class of award', /Honours|Distinction|Class/i.test(get('doctorate')), false);
check('nor does the certificate', /Honours|Distinction|Class/i.test(get('certificate')), false);

// FOUND BY LOOKING AT THE RENDERED SHEETS. The Master of Divinity printed
// "with with Distinction": the design's lead-in is "with", and the
// classification had been written the way a person says it. The certificate is
// sealed at issue, so the mistake would have been on a document in somebody's
// hands. CertificateDocument now strips a repeated lead-in.
check('the lead-in is not printed twice', /with\s+with/i.test(get('master')), false);
check('nor on the diploma', /with\s+with/i.test(get('diploma')), false);

console.log('\nThe thesis — only a research degree names its work\n');

check('the doctorate names its thesis', get('doctorate').includes('A Specimen Thesis Title'), true);
check('the master’s names no thesis', get('master').includes('Specimen Thesis'), false);
check('the bachelor’s names no thesis', get('bachelor').includes('Specimen Thesis'), false);

// --- The lookup. ------------------------------------------------------------

console.log('\nLooking one up\n');

check('a specimen can be found by id', specimenById('doctorate')?.level, 'Doctorate');
check('an unknown id yields nothing rather than the first one', specimenById('honorary'), undefined);

// --- Each one says what it is for. ------------------------------------------

for (const s of SPECIMENS) {
  check(`${s.level}: says what it demonstrates`, (s.shows ?? '').length > 40, true);
}

console.log(
  failures === 0
    ? '\nEvery level is stated correctly, and no specimen can pass as issued.\n'
    : `\n${failures} failed\n`,
);
process.exit(failures === 0 ? 0 : 1);
