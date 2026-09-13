// ---------------------------------------------------------------------------
// THE SEAL PANEL — what a document says when it cannot be verified.
//
// Run with:  node src/lib/officialDocument.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
//
// A specimen appointment letter was rendered to look at, and the foot of it
// read:
//
//     Verification code:
//     Check this document at www.iguc.net/verify
//
// Nothing after the colon. The panel branched on whether a seal OBJECT was
// present, and `sealDocument` returns one either way — with `sealed: false` and
// an empty code when `CREDENTIAL_SECRET` is missing. So on any deployment
// nobody had finished configuring, every appointment letter and every piece of
// official correspondence went out inviting its reader to check a code that was
// not printed.
//
// The function's own doc comment promised the opposite, in those words, which
// is the whole reason this is now a test rather than a comment: a rule nobody
// has watched refuse anything is a rule nobody has tested.
//
// SO THE GUARD IS BROKEN ON PURPOSE BELOW. Each case generates a panel with the
// secret absent, present, and present-but-too-short, and asserts what a reader
// would actually see.
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

// THE SECRET IS SET BEFORE THE BUNDLE IS IMPORTED, and changed between cases by
// re-importing with a cache-busting query. `secret()` reads process.env on every
// call, so this is belt and braces rather than a requirement — but a test that
// depended on that detail would pass for the wrong reason the day it changed.
function bundle(name, file, extra = []) {
  const out = join(cache, name);
  execFileSync('npx', [
    'esbuild', join(here, file), '--bundle', '--format=esm', '--platform=node',
    `--outfile=${out}`, '--log-level=error', `--alias:@=${join(here, '..')}`, ...extra,
  ]);
  return out;
}

const docOut = bundle('officialDocumentForSeal.mjs', 'officialDocument.ts', ['--external:qrcode']);
const secOut = bundle('documentSecurityForSeal.mjs', 'documentSecurity.ts', ['--external:qrcode']);

const { sealPanel } = await import(docOut);
const { sealDocument } = await import(secOut);

const FIELDS = {
  name: 'A Specimen Appointee',
  position: 'Director of Academic Affairs',
  unit: 'Academic Affairs',
  reference: 'APT-2026-0007',
  issued: '2026-09-13',
};

const sealWith = (secret) => {
  const before = process.env.CREDENTIAL_SECRET;
  if (secret === null) delete process.env.CREDENTIAL_SECRET;
  else process.env.CREDENTIAL_SECRET = secret;
  const out = sealDocument('ICOFGU-APPOINTMENT-V1', 'Appointment Letter', FIELDS, 'https://www.iguc.net');
  if (before === undefined) delete process.env.CREDENTIAL_SECRET;
  else process.env.CREDENTIAL_SECRET = before;
  return out;
};

// ---------------------------------------------------------------------------
console.log('\nWith no signing secret — the failure that shipped\n');

const unsealed = sealWith(null);
check('the seal object exists but is not sealed',
  [unsealed.sealed, unsealed.code], [false, '']);

const panelUnsealed = await sealPanel(unsealed, 'IGUC/HR/APT/2026/0007', 1);

// THE ASSERTION THAT WOULD HAVE CAUGHT IT. An empty code is not "a code that
// happens to be blank" — it is an invitation to check something that is not
// there, and the reader who tries it concludes the document is fake.
check('it does not print an empty verification code',
  /Verification code:\s*<\/p>|Verification code:<\/strong>\s*<\/p>/.test(panelUnsealed), false);
check('…nor the word “code” at all', /Verification code/.test(panelUnsealed), false);
check('…nor an invitation to check it', /\/verify<\/p>/.test(panelUnsealed), false);

check('it says plainly that there is no seal',
  /carries no verification seal/.test(panelUnsealed), true);

// AND NO QR. A code square that resolves to a page saying "no such document" is
// worse than no square: the reader did the check the University asked for and
// got an answer that reads as a forgery.
check('and draws no QR', /<svg/.test(panelUnsealed), false);

// THE REFERENCE IS STILL PRINTED. An unsealed letter is still a letter and
// still has to be findable in the register by the office that issued it.
check('the reference and version survive',
  /IGUC\/HR\/APT\/2026\/0007 · version 1/.test(panelUnsealed), true);

// ---------------------------------------------------------------------------
console.log('\nWith a secret too short to be a secret\n');

// 31 CHARACTERS, ONE BELOW THE FLOOR. The interesting case is not "absent" but
// "present and rejected": a deployment that set something looks configured, and
// this is where a blank code would have come back.
const short = sealWith('x'.repeat(31));
check('a 31-character secret is refused', short.sealed, false);
const panelShort = await sealPanel(short, 'IGUC/HR/APT/2026/0007', 1);
check('and the panel says so rather than printing nothing',
  [/carries no verification seal/.test(panelShort), /Verification code/.test(panelShort)],
  [true, false]);

// ---------------------------------------------------------------------------
console.log('\nWith a real secret\n');

const sealed = sealWith('y'.repeat(48));
check('it seals', sealed.sealed, true);
check('the code is the spoken form', /^ICOF-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(sealed.code), true);

const panelSealed = await sealPanel(sealed, 'IGUC/HR/APT/2026/0007', 1);
check('the panel prints the code', panelSealed.includes(sealed.code), true);
check('…and invites the check', /Check this document at/.test(panelSealed), true);
check('…and says nothing about a missing seal',
  /carries no verification seal/.test(panelSealed), false);

// ---------------------------------------------------------------------------
console.log('\nThe QR is coarse enough for a phone to read off paper\n');

// ---------------------------------------------------------------------------
// THE MEASUREMENT THAT FOUND IT, KEPT AS THE TEST.
//
// A QR is drawn at 88 CSS px, which is 23.3mm on paper. Divide that by the
// number of modules across and you get the size of one module — and the
// practical floor for a phone camera reading off paper is about 0.5mm.
//
// The appointment letter's QR carried the whole signed payload: 376
// characters, 77 modules, 0.30mm each. It could not be scanned. So the letter
// told its reader to scan a code that would not scan, which makes the
// verification story fail at the last inch — the reader does what they are
// asked and gets nothing.
//
// THE VIEWBOX IS THE MODULE COUNT. It is read from the generated SVG rather
// than recomputed here, so this measures the square the letter actually
// carries.
// ---------------------------------------------------------------------------
const PRINTED_MM = 88 / 3.7795;
const FLOOR_MM = 0.5;

const modulesOf = (svg) => {
  const m = /viewBox="0 0 (\d+)/.exec(svg);
  return m ? Number(m[1]) : -1;
};

const panelWithRegister = await sealPanel(
  sealed, 'IGUC/HR/APT/2026/0006', 1, 'https://www.iguc.net',
);
const registeredModules = modulesOf(panelWithRegister);
const registeredMm = PRINTED_MM / registeredModules;

console.log(`      ${registeredModules} modules at ${PRINTED_MM.toFixed(1)}mm `
  + `— ${registeredMm.toFixed(2)}mm each, floor ${FLOOR_MM}mm`);

check('a registered document’s QR clears the floor', registeredMm >= FLOOR_MM, true);

// AND THE OLD ONE DID NOT, asserted so the fix cannot be quietly undone by
// somebody passing the long URL again.
const panelWithoutRegister = await sealPanel(sealed, 'IGUC/HR/APT/2026/0006', 1);
const payloadMm = PRINTED_MM / modulesOf(panelWithoutRegister);
check('…and the payload form is the one that did not',
  payloadMm < FLOOR_MM, true);

// ---------------------------------------------------------------------------
console.log('\nAnd a null seal is still handled\n');

const panelNull = await sealPanel(null, 'IGUC/HR/APT/2026/0007', 2);
check('a letter generated with no seal at all says so',
  /carries no verification seal/.test(panelNull), true);
check('…and prints its own reference', /version 2/.test(panelNull), true);

// ---------------------------------------------------------------------------
console.log(failures === 0
  ? '\nThe panel never invites a check it cannot answer.\n'
  : `\n${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
