// ---------------------------------------------------------------------------
// THE SAME LETTER IN A NEW FORMAT IS NOT A NEW LETTER.
//
// Run with:  node src/lib/aReformatIsNotAnAmendment.test.mjs
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY ASKED FOR
// ---------------------------------------------------------------------------
//
//   "one should be able to edit the appointment letter by using the new letter
//    format but maintaining all dates, reference numbers, must be maintained."
//
// `amend` could not do it. An amendment SUPERSEDES: a new row, a new reference
// from the University's register, both documents kept, and the appointee
// receives a second letter. That is exactly right when the terms change and
// exactly wrong when only the typography has.
//
// ---------------------------------------------------------------------------
// AND WHY IT COULD NOT SIMPLY BE A NEW ROW WITH THE OLD NUMBER
// ---------------------------------------------------------------------------
//
// `appointment_letters.reference` is UNIQUE. Two rows cannot share a
// reference, and that constraint is right: /verify resolves a document BY
// reference and must never have two to choose between.
//
// So a reformat re-renders the row that is already there.
//
// ---------------------------------------------------------------------------
// WHICH IS DANGEROUS, AND IS MADE SAFE BY ONE FACT
// ---------------------------------------------------------------------------
//
// Overwriting an issued document is how a date quietly becomes a different
// date. The thing that stops it is in documentSecurity.ts: THE SEAL IS
// COMPUTED OVER THE PARTICULARS, NOT OVER THE RENDERED HTML.
//
//   `sealedPayload` takes a field map — name, post, dates, reference — and
//   normalises it. The HTML never enters.
//
// So a change of house style leaves the seal identical, and a change to any
// particular changes it. The route re-renders, compares, and refuses if the
// seal moved. That makes "nothing that matters changed" a checked fact rather
// than a promise — and it is why the verification code on a printed copy, and
// the accept link already sent by WhatsApp, both still work afterwards.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let failures = 0;
const check = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`ok    ${label}`);
  } else {
    failures++;
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n`
      + `      actual   ${JSON.stringify(actual)}`);
  }
};

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const route = read('src/app/api/appointments/letter/route.ts');
const screen = read('src/components/hr/Appointments.tsx');
const security = read('src/lib/documentSecurity.ts');

// ---------------------------------------------------------------------------

console.log('\nThe fact the whole design rests on\n');

// IF THIS EVER STOPS BEING TRUE, the reformat guard is worthless — it would be
// comparing a seal that changes whenever the template does, and would refuse
// every reformat while claiming to allow the safe ones.
const payload = security.slice(security.indexOf('function sealedPayload'));
const payloadBody = payload.slice(0, payload.indexOf('\n}\n'));
check('the seal is computed from a field map, not from rendered output',
  /fields: Record<string, string \| undefined>/.test(payloadBody), true);
check('…and nothing resembling a document body goes into it',
  /\bhtml\b|\bbody\b|\bmarkup\b/i.test(payloadBody), false);

// ---------------------------------------------------------------------------

console.log('\nA reformat keeps what the University asked to be kept\n');

const reformat = route.slice(route.indexOf("if (action === 'reformat')"));
const reformatBlock = reformat.slice(0, reformat.indexOf("if (action === 'amend')"));

check('the reference comes from the letter that already exists',
  /reference: String\(current\.reference\)/.test(reformatBlock), true);
check('…and so does the issue date',
  /issuedOn: String\(current\.issued_on\)/.test(reformatBlock), true);
check('…and the version is not incremented',
  /Number\(current\.version \?\? 1\)/.test(reformatBlock), true);

// NO NUMBER IS TAKEN FROM THE REGISTER. A second reference for one document is
// a hole in the sequence nobody can later account for.
check('no reference is allocated for a reformat',
  /keep\s*\n?\s*\? keep\.reference/.test(route), true);

// AND THE UPDATE DOES NOT NAME THEM AT ALL, which is the surest way to keep
// them: a column that is never written cannot be written wrongly.
const update = route.slice(route.indexOf("from('appointment_letters')\n        .update("));
const updateBody = update.slice(0, update.indexOf('.eq('));
for (const col of ['reference', 'version', 'issued_on', 'seal_code', 'sealed']) {
  check(`the update never writes \`${col}\``,
    new RegExp(`^\\s*${col}:`, 'm').test(updateBody), false);
}
check('…while it does write the new rendering', /html: generated\.html/.test(updateBody), true);

// ---------------------------------------------------------------------------

console.log('\nAnd it refuses to be an amendment in disguise\n');

check('the seal is compared before anything is written',
  /if \(newSeal !== keep\.sealCode\)/.test(route), true);
check('…and a moved seal is refused, not warned about',
  /not-a-reformat/.test(route), true);
check('…and the officer is sent to the path that supersedes properly',
  /That is an amendment, not a\s+'\s*\+\s*'change of format/.test(route)
  || /is an amendment, not a/.test(route), true);

// THE COMPARISON MUST COME BEFORE THE WRITE. A check performed afterwards is
// an apology, not a guard.
const sealAt = route.indexOf('if (newSeal !== keep.sealCode)');
const writeAt = route.indexOf("from('appointment_letters')\n        .update(");
check('the seal is checked before the row is touched', sealAt < writeAt && sealAt > 0, true);

// ---------------------------------------------------------------------------

console.log('\nIt is the Vice-Chancellor’s, and it leaves a record\n');

check('reformatting needs the same authority as amending',
  /reformat: 'issue-appointment-letter'/.test(route), true);
check('the history keeps the hash before and after',
  /was_content_hash: current\.content_hash/.test(route)
  && /now_content_hash: out\.letter\.content_hash/.test(route), true);

// ONE HISTORY ENTRY, NOT TWO. The first draft recorded it in `generateInto`
// as well, which would have written the act down twice with different detail.
check('and writes it down once, not twice',
  (route.match(/'LETTER_REFORMATTED'/g) ?? []).length, 1);

// ---------------------------------------------------------------------------

console.log('\nThe screen offers both, and says which is which\n');

check('the screen can reformat', /action: 'reformat'/.test(screen), true);
check('…and still offers an amendment beside it', /action: 'amend'/.test(screen), true);
check('…and explains that an amendment is for when the terms changed',
  /supersedes/.test(screen), true);

// ---------------------------------------------------------------------------

console.log(failures === 0
  ? '\nA reformat keeps the reference, the dates and the seal, or it is refused.\n'
  : `\n${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
