// ---------------------------------------------------------------------------
// The document seal — does it actually detect an alteration?
//
// Run with:  node src/lib/documentSecurity.test.mjs
//
// The admission letter claims that changing a name, a date of birth or a
// student number on its face makes the printed code stop matching. That is the
// whole of its anti-forgery value, and it is a claim about behaviour, so it is
// tested rather than asserted in a comment.
//
// What is checked here:
//   - a different value in any sealed field produces a different code;
//   - the same values produce the same code, whatever the whitespace or case,
//     because a seal that broke on a double space would have a genuine student
//     accused of forging their own letter;
//   - the code is drawn from an alphabet a person can read aloud;
//   - with no signing key, nothing is sealed and the letter says so, rather
//     than printing a code that means nothing.
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

// The module is TypeScript. Bundle it rather than adding a loader to the
// project — the same reason grading.test.mjs is a plain script.
//
// The bundle goes under node_modules/.cache, not /tmp, because react and
// react-dom are left external: they are peer-dependency graphs with their own
// conditional exports, and bundling them is both slow and a good way to test
// something other than the code under test. Left external, they resolve from
// node_modules — which only works if the bundle sits inside the project.
const dir = join(new URL('../../node_modules/.cache/icof', import.meta.url).pathname);
mkdirSync(dir, { recursive: true });
const bundle = join(dir, 'seal.mjs');
execFileSync('npx', [
  'esbuild', new URL('./documentSecurity.ts', import.meta.url).pathname,
  '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`, '--log-level=error',
  '--external:react', '--external:react-dom', '--external:qrcode.react',
]);

process.env.CREDENTIAL_SECRET = 'k'.repeat(48);
const { sealParticulars, sealCard, sealAward, sealMatches, canonicalise, verificationQrSvg } = await import(bundle);

const SITE = 'https://iguc.net';
const base = {
  fullName: 'Marie-Claire Ekane Njoya',
  dateOfBirth: '14 March 2004',
  studentNumber: 'ICOF202600451',
  applicationNumber: 'APP-2026-00451',
  programme: "Bachelor's Degree — BSc Christian Counselling",
  issuedOn: '2026-08-06',
};

const seal = sealParticulars(base, SITE);
check('a letter is sealed when the key is set', seal.sealed, true);
check('the code is grouped for reading aloud', /^ICOF-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(seal.code), true);
check(
  'the code avoids the characters that are misread — I, L, O, U',
  /[ILOU]/.test(seal.code.slice(5)),
  false,
);

// --- An alteration to any sealed field breaks the code. ---------------------
const alterations = {
  'the name': { fullName: 'Marie-Claire Ekane Njoyah' },
  'the date of birth': { dateOfBirth: '14 March 2003' },
  'the student number': { studentNumber: 'ICOF202600452' },
  'the application number': { applicationNumber: 'APP-2026-00452' },
  'the programme': { programme: "Master's Degree — MSc Christian Counselling" },
  'the date of issue': { issuedOn: '2026-08-07' },
};
for (const [what, change] of Object.entries(alterations)) {
  const altered = sealParticulars({ ...base, ...change }, SITE);
  check(`changing ${what} changes the code`, altered.code === seal.code, false);
  check(`the original code no longer matches after ${what} is changed`,
    sealMatches({ ...base, ...change }, SITE, seal.code), false);
}

// --- But harmless differences do not. ---------------------------------------
check(
  'a double space in the name does not break the seal',
  sealParticulars({ ...base, fullName: 'Marie-Claire  Ekane Njoya' }, SITE).code,
  seal.code,
);
check(
  'a difference of case does not break the seal',
  sealParticulars({ ...base, fullName: 'MARIE-CLAIRE EKANE NJOYA' }, SITE).code,
  seal.code,
);
check('the code checks against itself', sealMatches(base, SITE, seal.code), true);
check('a code with the spaces stripped still checks', sealMatches(base, SITE, seal.code.toLowerCase()), true);

// --- The sealed format is versioned. ----------------------------------------
// When a particular is added or the order changes, letters already issued must
// still verify, and they can only do that if the document records which format
// sealed them.
check(
  'the sealed payload carries its format version',
  JSON.parse(canonicalise(base)).v,
  'ICOFGU-ADMISSION-V1',
);

// --- The link in the QR is the one the university's own page can check. -----
// The signature covers the base64 payload, because GET /api/credential re-signs
// the `d` parameter and compares. Sign anything else and the letter carries a
// QR that the university itself rejects.
const { createHmac } = await import('node:crypto');
const d = new URL(seal.verifyUrl).searchParams.get('d');
const sig = new URL(seal.verifyUrl).searchParams.get('s');
check(
  'the QR signature is an HMAC of the payload, as /api/credential verifies it',
  createHmac('sha256', process.env.CREDENTIAL_SECRET).update(d).digest('hex'),
  sig,
);
check(
  'the payload decodes to the particulars a reader will be shown',
  JSON.parse(Buffer.from(d, 'base64url').toString('utf8')).student_number,
  'ICOF202600451',
);

const qr = await verificationQrSvg(seal.verifyUrl, 96);
check('a QR code is produced', qr.startsWith('<svg') && qr.length > 500, true);
check('the QR needs no external request', /https?:\/\/(?!www\.w3\.org)/.test(qr.replace(seal.verifyUrl, '')), false);

// --- A card is a different document, and its seal is not a letter's. --------
// Both carry the same name, date of birth, student number and programme. If the
// kind were not inside the sealed bytes, a card's seal would verify against a
// letter's payload and vice versa — so a withdrawn student could present an old
// admission letter's code on a current-looking card.
const card = sealCard({
  credentialId: 'IGUC-SC-26B4-J7QP-T2XN',
  fullName: base.fullName,
  dateOfBirth: base.dateOfBirth,
  studentNumber: base.studentNumber,
  programme: base.programme,
  issuedOn: '2026-08-06',
  expiresOn: '2027-08-06',
}, SITE);
check('a card is sealed too', card.sealed, true);
check('a card and a letter for the same student seal differently', card.code === seal.code, false);
check(
  'the card payload names its own kind',
  JSON.parse(Buffer.from(new URL(card.verifyUrl).searchParams.get('d'), 'base64url').toString('utf8')).document,
  'Student Identity Card',
);

// The expiry is inside the seal — the one field a card is worth forging.
const extended = sealCard({
  credentialId: 'IGUC-SC-26B4-J7QP-T2XN',
  fullName: base.fullName,
  dateOfBirth: base.dateOfBirth,
  studentNumber: base.studentNumber,
  programme: base.programme,
  issuedOn: '2026-08-06',
  expiresOn: '2030-08-06',
}, SITE);
check('extending the expiry changes the card seal', extended.code === card.code, false);

// --- The QR has to scan off paper, which is a size problem. -----------------
// The long URL encodes as an 87-module symbol. At the 24mm a certificate can
// spare that is 0.28mm a module, and the practical floor for a phone camera
// reading printed matter is about 0.5mm — so every certificate carried a QR
// that could not be scanned, and the document tells the reader to scan it.
const award = sealAward({
  credentialId: 'IGUC-BA-26A9-F8K2-P19D',
  holderName: base.fullName,
  award: 'Bachelor of Arts',
  classification: 'Second Class Honours (Upper Division)',
  programme: 'Christian Counselling',
  issuedOn: '2026-08-05',
}, SITE);
const modulesOf = async (url) =>
  Number(/viewBox="0 0 (\d+)/.exec(await verificationQrSvg(url, 84))[1]);

check('the short form encodes in fewer modules',
  (await modulesOf(award.shortVerifyUrl)) < (await modulesOf(award.verifyUrl)), true);
check('and is coarse enough to scan at 24mm printed (0.5mm a module)',
  24 / (await modulesOf(award.shortVerifyUrl)) >= 0.5, true);
check('the short form resolves by credential number',
  new URL(award.shortVerifyUrl).searchParams.get('id'), 'IGUC-BA-26A9-F8K2-P19D');

// A card is registered too, so it also gets a short QR — and it must, because
// the long one is 0.23mm a module at the 19mm a card can spare.
check('a card is on the register and gets a short QR',
  new URL(card.shortVerifyUrl).searchParams.get('id'), 'IGUC-SC-26B4-J7QP-T2XN');
check('and the card QR is coarse enough to scan at 19mm',
  19 / (await modulesOf(card.shortVerifyUrl)) >= 0.5, true);

// A document that is NOT on the register has nothing to look up, so it keeps
// the long form. An admission letter is sealed but never registered — and a
// short URL for one would resolve to "not issued", so a genuine letter would
// scan as a forgery.
check('an unregistered document keeps the signed payload in its QR',
  seal.shortVerifyUrl, seal.verifyUrl);

// --- No key, no seal. -------------------------------------------------------
// A code that cannot be verified is worse than no code: it invites a reader to
// trust something nobody can check.
delete process.env.CREDENTIAL_SECRET;
const unsealed = sealParticulars(base, SITE);
check('with no signing key nothing is sealed', unsealed.sealed, false);
check('and no code is printed', unsealed.code, '');
check('and a presented code cannot pass', sealMatches(base, SITE, seal.code), false);

process.env.CREDENTIAL_SECRET = 'short';
check('a short key is refused as no key at all', sealParticulars(base, SITE).sealed, false);

console.log(failures === 0 ? '\nAll document-seal checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
