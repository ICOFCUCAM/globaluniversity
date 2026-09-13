// ---------------------------------------------------------------------------
// THE AUTHORITY STARTS AND FINISHES ITS OWN LETTER.
//
// Run with:  node src/lib/correspondence.test.mjs
//
// ---------------------------------------------------------------------------
// WHAT THIS IS ACTUALLY GUARDING
// ---------------------------------------------------------------------------
//
// Everything else in this system refuses to let one person do both halves of
// an act. This file is the deliberate exception and the exception has to be
// tested, because an exception nobody has watched work is one somebody will
// later "fix" by making it consistent with the rest — and then the
// Vice-Chancellor cannot send a letter to a ministry without asking an
// administrator's permission.
//
// The line: correspondence commits the University's WORDS, and an appointment
// commits its MONEY. 041 refuses an approval by the drafter for the second
// reason. It does not apply to a letter, because there is nothing for a second
// person to check that the author does not already know.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
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
const out = join(cache, 'correspondence.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'correspondence.ts'), '--bundle', '--format=esm', '--platform=node',
  `--outfile=${out}`, '--log-level=error', `--alias:@=${join(here, '..')}`,
]);
const C = await import(out);

const letter = {
  kind: 'government',
  originating_office: 'vice-chancellor',
  subject: 'Accreditation correspondence',
  body: 'A letter of sufficient length to be a letter rather than a note, addressed to a '
    + 'ministry that has asked the University a question.',
  recipient_name: 'The Ministry of Higher Education',
  recipient_email: 'registry@example.test',
  status: 'draft',
  initiated_by: 'the-vc',
};

console.log('\nThe Vice-Chancellor starts and finishes, with nobody in between\n');

{
  // THE WHOLE POINT. Requiring somebody else to approve the Vice-Chancellor's
  // own words would be inventing an authority above the one the University has.
  check('the VC may authorise their own letter', C.canAuthorize(letter, 'the-vc'), true);
  check('…and it can be issued by one office', C.canBeIssuedByOneOffice(letter), true);
  check('…with nothing outstanding against it', C.objectionsTo(letter).filter((o) => o.blocking), []);

  // AND THE WHOLE PATH IS REACHABLE. Draft to issued, one person, no state in
  // the middle that needs somebody else.
  const authorised = { ...letter, status: 'authorized', authorized_by: 'the-vc' };
  check('an authorised letter can be issued', C.canIssue(authorised), true);
  check('and a scheduled one can be', C.canIssue({ ...authorised, status: 'scheduled' }), true);
  check('a draft cannot be issued without being authorised first',
    C.canIssue(letter), false);
}

console.log('\nBut delegating the typing does not delegate the authority\n');

{
  // THE ONE THING THAT IS REFUSED. An administrator asked to prepare a letter
  // may not then authorise it, or "please draft this" has quietly become
  // "please decide this".
  const prepared = { ...letter, status: 'awaiting_authority', prepared_by: 'an-administrator' };
  check('the preparer cannot authorise what they prepared',
    C.canAuthorize(prepared, 'an-administrator'), false);
  check('the Vice-Chancellor still can', C.canAuthorize(prepared, 'the-vc'), true);
  check('and the screen can say it is no longer a one-office letter',
    C.canBeIssuedByOneOffice(prepared), false);

  // A letter the VC prepared themselves is still a one-office letter: the
  // preparer and the initiator are the same person.
  check('preparing your own letter is not delegation',
    C.canBeIssuedByOneOffice({ ...letter, prepared_by: 'the-vc' }), true);
}

console.log('\nAn issued letter is finished\n');

{
  check('it cannot be edited', C.canEdit({ status: 'issued' }), false);
  check('nor withdrawn', C.canWithdraw({ status: 'issued' }), false);
  // BEFORE IT GOES, everything is still changeable — including something a
  // preparer has handed back, because the authority reads it and may want a
  // word changed rather than a whole return.
  for (const s of ['draft', 'preparing', 'awaiting_authority']) {
    check(`a ${s} letter can still be edited`, C.canEdit({ status: s }), true);
  }
  check('an authorised one cannot be edited', C.canEdit({ status: 'authorized' }), false);
}

console.log('\nWhat is wrong is said before it goes, and only the real problems block\n');

{
  check('a letter with no kind is refused',
    C.objectionsTo({ ...letter, kind: null }).map((o) => o.code), ['no-kind']);
  // FILTERED TO THE BLOCKING ONES. A government letter always carries the
  // read-it-as-a-stranger note, and a test that expected the exact list would
  // have been asserting the warning's presence by accident.
  check('…and with no recipient',
    C.objectionsTo({ ...letter, recipient_name: '' })
      .filter((o) => o.blocking).map((o) => o.code), ['no-recipient']);
  check('…and with four words in it',
    C.blocks(C.objectionsTo({ ...letter, body: 'Please attend.' })), true);

  // A WARNING IS NOT A REFUSAL. Each of these is a judgement the author may
  // genuinely have made, said out loud because it is obvious afterwards and
  // invisible at the time.
  const outward = C.objectionsTo(letter);
  check('a letter leaving the University is flagged',
    outward.some((o) => o.code === 'goes-outside-the-university'), true);
  check('…and does not block it', C.blocks(outward), false);

  const warning = C.objectionsTo({ ...letter, kind: 'warning' });
  check('a warning letter is flagged as one that turns up in an appeal',
    warning.some((o) => o.code === 'carries-consequences'), true);
  check('…and does not block it either', C.blocks(warning), false);

  // NO EMAIL IS NOT AN ERROR. A letter to a ministry is often posted, and
  // refusing to record it because nobody typed an address would make the
  // register useless for exactly the correspondence that matters most.
  const noEmail = C.objectionsTo({ ...letter, recipient_email: '' });
  check('a letter with no email address is noted',
    noEmail.some((o) => o.code === 'no-email'), true);
  check('…and still goes', C.blocks(noEmail), false);
  check('…and says somebody has to post it',
    noEmail.find((o) => o.code === 'no-email').message.includes('post it'), true);
}

console.log('\nThe reference is filed one way and printed another\n');

{
  check('the Vice-Chancellor files under VC', C.reference('vice-chancellor', 2026, 42),
    'VC-2026-0042');
  check('the Registrar under REG', C.reference('registrar', 2026, 7), 'REG-2026-0007');
  check('and it prints as the filing convention',
    C.printedReference('VC-2026-0042'), 'IGUC/VC/2026/0042');
  // NO SLASHES IN THE STORED FORM. A reference with them cannot go in a URL
  // path without escaping and the verification link is where it ends up.
  check('the stored form survives a URL untouched',
    C.reference('vice-chancellor', 2026, 42),
    encodeURIComponent(C.reference('vice-chancellor', 2026, 42)));
  check('every office has a prefix', Object.keys(C.OFFICE_PREFIX).length, C.OFFICES.length);
}

console.log('\nAnd 045 holds the same line\n');

{
  // BOTH FILES, because the vocabulary is not all in one. 045 declared fourteen
  // kinds and 049 restated the constraint to add promotion, official-response
  // and special-assignment. Reading only 045 reported the three newest as
  // unknown to the database when they are in the constraint currently in
  // force — a test asserting where a rule was written rather than whether it
  // holds.
  const sql = [
    '045_official_correspondence_and_who_initiated_it.sql',
    '049_verification_signatures_and_the_written_letter.sql',
  ].map((f) => readFileSync(join(here, '../../docs/migrations/', f), 'utf8')).join('\n');

  // THE DATABASE PERMITS THE ONE-OFFICE LETTER, which is the thing a future
  // "consistency" change would break. There is no constraint saying the
  // initiator may not be the authoriser, and this asserts that absence.
  check('nothing refuses an initiator authorising their own letter',
    /initiated_by <> authorized_by/.test(sql), false);

  // …while the delegation rule IS enforced.
  check('but a preparer authorising their own preparation is refused',
    /correspondence_preparer_is_not_authority/.test(sql), true);
  check('and the constraint is the one this file describes',
    /prepared_by <> authorized_by/.test(sql), true);

  for (const k of C.LETTER_KINDS) {
    check(`the register knows '${k}'`, sql.includes(`'${k}'`), true);
  }

  // AND THE APPOINTMENT RULE IS NOT RELAXED BY ANY OF THIS. Correspondence
  // commits the University's words; an appointment commits its money.
  check('an appointment on sole authority is still recorded as such',
    /made_on_sole_authority/.test(sql), true);
  check('…and is available to the Vice-Chancellor and Chancellor only',
    /initiated_by_office in \('vice-chancellor', 'chancellor'\)/.test(sql), true);
}

console.log(failures === 0 ? '\nAll correspondence checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
