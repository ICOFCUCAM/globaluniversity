// ---------------------------------------------------------------------------
// AN APPOINTMENT IS A RECORD; THE LETTER IS GENERATED FROM IT.
//
// Run with:  node src/lib/appointments.test.mjs
//
// ---------------------------------------------------------------------------
// WHAT THIS GUARDS
// ---------------------------------------------------------------------------
//
// The University had nowhere to record that it had appointed somebody, so every
// appointment letter was typed by hand from facts that existed only in the
// letter. The letter WAS the record — which is why the system could not say who
// reports to whom, or whose probation ends this month.
//
// The rules that replace that are worth what they refuse. This calls each one.
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
const out = join(cache, 'appointments.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'appointments.ts'), '--bundle', '--format=esm', '--platform=node',
  `--outfile=${out}`, '--log-level=error', `--alias:@=${join(here, '..')}`,
]);
const A = await import(out);

/** A complete appointment, from which each case removes one thing. */
const complete = {
  full_name: 'A Specimen Appointee',
  position_title: 'Lecturer in Theology',
  unit_name: 'Faculty of Theology',
  effective_date: '2026-10-01',
  postal_address: 'PO Box 1, Buea',
  employment_type: 'permanent',
  start_date: '2026-10-01',
  place_of_duty: 'Buea campus',
  terms: 'Subject to the University’s conditions of service.',
  reports_to_name: 'The Head of Academic Affairs',
  probation_months: 6,
  salary_amount: 450000,
  salary_currency: 'FCFA',
  salary_period: 'month',
  status: 'draft',
  drafted_by: 'alice',
};

console.log('\nA letter cannot be issued without the things a letter is\n');

{
  check('a complete record has nothing outstanding', A.missingFrom(complete), []);

  // THE FOUR THAT ARE NOT OPTIONAL. Each is a thing that, missing, makes the
  // document not an appointment letter.
  for (const key of ['full_name', 'position_title', 'start_date', 'place_of_duty', 'terms']) {
    const m = A.missingFrom({ ...complete, [key]: null });
    check(`${key} is required`, m.map((x) => x.key), [key]);
    check(`…and it blocks`, A.blocked(m), true);
  }

  // PLACE OF DUTY IS REQUIRED ON PURPOSE. The University is not only online,
  // and somebody appointed without being told where to turn up has not been
  // told the main thing.
  check('place of duty says why it matters',
    A.missingFrom({ ...complete, place_of_duty: null })[0].message.includes('not only online'),
    true);
}

console.log('\nAnd the things that are legitimately absent do not block\n');

{
  for (const key of ['unit_name', 'effective_date', 'postal_address', 'reports_to_name']) {
    const m = A.missingFrom({ ...complete, [key]: null });
    check(`${key} is noted but does not block`, A.blocked(m), false);
    check(`…and it is still listed`, m.some((x) => x.key === key), true);
  }

  // NOTED RATHER THAN SILENT. A blank line under "Probation" on a page reads
  // as "none", which is a claim — so the screen says it is missing and
  // somebody decides.
  const noProbation = A.missingFrom({ ...complete, probation_months: null });
  check('probation is noted when absent',
    noProbation.some((x) => x.key === 'probation_months'), true);
  check('…and does not stop the letter', A.blocked(noProbation), false);
}

console.log('\nA fixed term has a term\n');

{
  // Otherwise it is a permanent appointment wearing the wrong label, and
  // nobody finds out until somebody asks when it ends.
  const fixed = { ...complete, employment_type: 'fixed-term' };
  const m = A.missingFrom(fixed);
  check('a fixed term with no end date is refused', m.map((x) => x.key), ['end_date']);
  check('…and it blocks', A.blocked(m), true);
  check('with an end date it passes',
    A.missingFrom({ ...fixed, end_date: '2029-09-30' }), []);

  // Only fixed-term. A permanent appointment with no end date is a permanent
  // appointment.
  for (const t of ['permanent', 'part-time', 'visiting', 'honorary', 'secondment']) {
    check(`${t} needs no end date`,
      A.missingFrom({ ...complete, employment_type: t, salary_amount: 1, salary_currency: 'FCFA', salary_period: 'month' })
        .some((x) => x.key === 'end_date'), false);
  }
}

console.log('\nA salary is a figure, a currency and a period, or it is none of them\n');

{
  // "450,000" with no currency and no period is not something anybody can rely
  // on, and each half looks complete on its own — which is how the omission
  // reaches a signature.
  const half = A.missingFrom({ ...complete, salary_currency: null, salary_period: null });
  check('a bare number is refused', half.map((x) => x.key), ['salary']);
  check('…and it blocks', A.blocked(half), true);
  check('a figure with no period is refused too',
    A.blocked(A.missingFrom({ ...complete, salary_period: null })), true);

  // NO SALARY AT ALL IS A WARNING, NOT A REFUSAL. Right for an honorary post
  // and a serious omission for any other, and the system cannot tell which.
  const unpaid = { ...complete, salary_amount: null, salary_currency: null, salary_period: null };
  const paidPost = A.missingFrom(unpaid);
  check('a paid post with no salary is flagged', paidPost.map((x) => x.key), ['salary']);
  check('…but does not block', A.blocked(paidPost), false);

  // An honorary appointment is not even flagged: it is expected to be unpaid.
  check('an honorary post with no salary is not flagged at all',
    A.missingFrom({ ...unpaid, employment_type: 'honorary' }), []);
}

console.log('\nThe drafter does not authorise their own appointment\n');

{
  // An appointment letter commits the University to paying somebody. This is
  // the largest version of the rule 005, 009, 014 and 038 all carry.
  const submitted = { ...complete, status: 'submitted' };
  check('the drafter cannot', A.canAuthorize(submitted, 'alice'), false);
  check('somebody else can', A.canAuthorize(submitted, 'bob'), true);
  // IDENTITY, NOT RANK. A Superadministrator who drafted it is still its
  // drafter; the function takes an id and no role, deliberately.
  check('the rule is about identity, not rank', A.canAuthorize.length, 2);
  check('a draft is not awaiting anybody', A.canAuthorize(complete, 'bob'), false);
}

console.log('\nA letter is generated from an authorised record, never a draft\n');

{
  check('a draft produces no letter', A.canGenerateLetter(complete), false);
  check('an approved one does',
    A.canGenerateLetter({ ...complete, status: 'approved' }), true);
  // AND STILL NOT IF SOMETHING IS MISSING. Authority does not conjure a start
  // date.
  check('but not if a required field is missing',
    A.canGenerateLetter({ ...complete, status: 'authorized', start_date: null }), false);
  check('a submitted record is not enough either',
    A.canGenerateLetter({ ...complete, status: 'submitted' }), false);
}

console.log('\nThe reference is something somebody can file and quote\n');

{
  check('it reads as a reference', A.letterReference(2026, 1), 'APT-2026-0001');
  check('and pads so they sort', A.letterReference(2026, 42), 'APT-2026-0042');
  check('it reads back', A.parseReference('APT-2026-0042'), { year: 2026, sequence: 42 });
  // NO SLASHES. A reference with them cannot go in a URL path without
  // escaping, and a verification link is exactly where this ends up.
  check('and it survives a URL untouched',
    A.letterReference(2026, 42), encodeURIComponent(A.letterReference(2026, 42)));
  check('and refuses something that is not one', A.parseReference('some-uuid-thing'), null);
  // A reference that encoded the time of day would tell a recipient how long
  // the University took, which is nobody's business.
  check('it carries no timestamp', /^APT-\d{4}-\d{4}$/.test(A.letterReference(2026, 7)), true);
}

console.log('\nWhat the letter prints for money, and for probation\n');

{
  check('a salary prints with its currency and period',
    A.remunerationLine(complete), 'FCFA 450,000 per month');
  // NULL RATHER THAN AN EMPTY STRING. A caller has to decide what to print
  // rather than being handed something that quietly becomes a blank line under
  // "Remuneration".
  check('no salary returns nothing to print',
    A.remunerationLine({ ...complete, salary_amount: null }), null);
  check('and a half-recorded one prints nothing rather than a bare number',
    A.remunerationLine({ ...complete, salary_currency: null }), null);

  // THE QUESTION THE RECORD EXISTS TO ANSWER. It could not be asked at all
  // before, because the answer was in a word processor file.
  check('probation ends six months after the start',
    A.probationEnds(complete), '2027-04-01');
  check('and none means none', A.probationEnds({ ...complete, probation_months: null }), null);
}

console.log('\nThe database holds the same rules, not only this file\n');

{
  const sql = readFileSync(
    join(here, '../../docs/migrations/041_appointments_and_the_letters_that_issue_from_them.sql'),
    'utf8');

  check('the drafter cannot authorise, in the database',
    /authorized_by <> drafted_by/.test(sql), true);
  check('a fixed term has a term, in the database',
    /appointments_fixed_term_ends/.test(sql), true);
  check('a salary is complete or absent, in the database',
    /appointments_salary_is_complete/.test(sql), true);

  // A LETTER IS AN OUTPUT. Editing a generated document is how a letter comes
  // to say something the register does not, with a signature on the wrong one.
  check('an issued letter cannot be rewritten',
    /refuse_letter_edit/.test(sql), true);
  check('and two letters cannot both be current',
    /appointment_letters_one_current_idx/.test(sql), true);

  // THE SALARY IS NOT ORDINARY INSTITUTIONAL INFORMATION.
  check('there is a view without the pay',
    /create or replace view appointments_without_pay/.test(sql), true);
  const view = /create or replace view appointments_without_pay([\s\S]*?)from appointments;/
    .exec(sql)?.[1] ?? '';
  check('…and it genuinely leaves the pay out',
    /salary_amount|salary_currency|salary_period/.test(view.replace(/salary_amount is not null/, '')),
    false);
  check('…while still saying that a salary exists', /is_paid/.test(view), true);

  // The vocabulary the code uses is the vocabulary the column accepts.
  for (const t of A.EMPLOYMENT_TYPES) {
    check(`the database knows '${t}'`, sql.includes(`'${t}'`), true);
  }
}

console.log('\nFour facts where there used to be one\n');

{
  // `issued` was carrying: the letter exists, the letter was sent, they said
  // yes, they are in post. One state cannot tell a Head of Department whether
  // anybody is coming.
  for (const st of ['letter_generated', 'issued', 'accepted', 'active']) {
    check(`${st} is its own state`, A.APPOINTMENT_STATES.includes(st), true);
  }
  check('and the ordinary path is a chain of seven',
    A.LIFECYCLE, ['draft', 'submitted', 'approved', 'letter_generated', 'issued',
      'accepted', 'active']);
  // THE CLOSURES ARE NOT ON IT. Drawing them in a line would suggest every
  // appointment passes through being declined.
  check('the closures are not steps along it',
    A.LIFECYCLE.some((s) => ['declined', 'withdrawn', 'ended'].includes(s)), false);
}

console.log('\nAn amendment goes back through approval, and not to whoever asked\n');

{
  for (const st of ['issued', 'accepted', 'active']) {
    check(`an ${st} appointment can be amended`,
      A.canRequestAmendment({ status: st }), true);
  }
  check('a draft has nothing to amend', A.canRequestAmendment({ status: 'draft' }), false);

  // A revised letter that one person requested and approved alone is the
  // original rule with an extra step in front of it.
  const amending = { ...complete, status: 'amendment_requested', drafted_by: 'alice' };
  check('the drafter cannot approve the amendment', A.canAuthorize(amending, 'alice'), false);
  check('somebody else can', A.canAuthorize(amending, 'bob'), true);
}

console.log('\nNobody is made staff before the letter was issued\n');

{
  // THE DOOR 042 CLOSES. A staff record created first is a person the system
  // says works here on nobody's authority.
  check('an approved appointment does not make somebody staff',
    A.canActivateStaff({ status: 'approved', issued_at: null }), false);
  check('nor does a generated letter nobody has sent',
    A.canActivateStaff({ status: 'letter_generated', issued_at: null }), false);
  check('an issued one does', A.canActivateStaff({ status: 'issued', issued_at: '2026-10-01' }), true);
  check('and so does an active one',
    A.canActivateStaff({ status: 'active', issued_at: '2026-10-01' }), true);
  // A status without the date is the shape of somebody editing the column
  // directly, and it is refused on both halves.
  check('a status with no issuance date is not enough',
    A.canActivateStaff({ status: 'issued', issued_at: null }), false);
}

console.log('\nThe letter history reads the way a file is read\n');

{
  const lines = A.letterHistory([
    { reference: 'APT-2026-0042', version: 3, kind: 'reissued', issued_on: '2026-09-25' },
    { reference: 'APT-2026-0042', version: 1, kind: 'issued', issued_on: '2026-09-12' },
    { reference: 'APT-2026-0042', version: 2, kind: 'amended', issued_on: '2026-09-20',
      supersedes_reason: 'The start date moved' },
  ]);
  check('oldest first, whatever order they arrive in', lines, [
    'Version 1 — Issued 12 Sep 2026',
    'Version 2 — Amended 20 Sep 2026 — The start date moved',
    'Version 3 — Re-issued 25 Sep 2026',
  ]);
  // AMENDED AND RE-ISSUED ARE NOT THE SAME THING. The first is a changed
  // appointment; the second is the same one sent again because the first
  // bounced. A history calling both "revised" hides the only difference.
  check('and the two kinds are distinguishable',
    A.LETTER_KIND_LABELS.amended !== A.LETTER_KIND_LABELS.reissued, true);
}

console.log('\nWhat a reader of the document is told\n');

{
  const current = { superseded_at: null };
  check('a current letter is valid',
    A.verificationStatus(current, { status: 'active' }), 'Valid');
  // A SUPERSEDED LETTER IS NOT INVALID, and saying so would be wrong in a way
  // that costs somebody a visa. It was genuine and it has been replaced.
  check('a replaced one is superseded, not invalid',
    A.verificationStatus({ superseded_at: '2026-09-20' }, { status: 'active' }), 'Superseded');
  check('a withdrawn appointment is not in force',
    A.verificationStatus(current, { status: 'withdrawn' }), 'Not in force');
  check('and one that ran its course says so',
    A.verificationStatus(current, { status: 'ended' }), 'Ended');
}

console.log('\nAnd 042 holds the same lifecycle\n');

{
  const sql = readFileSync(
    join(here, '../../docs/migrations/042_the_appointment_lifecycle_and_the_staff_record.sql'),
    'utf8');

  for (const st of A.APPOINTMENT_STATES) {
    check(`the database knows '${st}'`, sql.includes(`'${st}'`), true);
  }
  check('nobody is accepted or active before a letter was issued',
    /appointments_issued_before_accepted/.test(sql), true);
  check('a staff record cannot precede issuance',
    /staff_follows_an_issued_appointment/.test(sql), true);
  check('the reference shape is enforced',
    /\^APT-\[0-9\]\{4\}-\[0-9\]\{4,\}\$/.test(sql), true);
  check('and the public verification view exists',
    /create or replace view appointment_letter_verification/.test(sql), true);
}

console.log('\nHR issues eleven kinds of letter, not one\n');

{
  check('all eleven are named', A.DOCUMENT_TYPES.length, 11);
  for (const t of A.DOCUMENT_TYPES) {
    check(`${t} has a label a person would recognise`,
      (A.DOCUMENT_TYPE_LABELS[t] ?? '').length > 3, true);
  }

  // AN INITIAL APPOINTMENT IS THE ONE THE ORDINARY FIELDS WERE WRITTEN FOR.
  check('an initial appointment needs nothing extra',
    A.missingForType('initial-appointment', {}), []);

  // EVERYTHING ELSE IS A DOCUMENT ABOUT A CHANGE, and one that does not say
  // what changed is not one.
  check('a promotion must state the previous position',
    A.missingForType('promotion', {}).map((m) => m.key), ['previous_position']);
  check('…and is satisfied when it does',
    A.missingForType('promotion', { previous_position: 'Lecturer' }), []);
  check('a transfer must state where from',
    A.missingForType('transfer', {}).map((m) => m.key), ['previous_unit']);
  check('a renewal states both ends of the term',
    A.missingForType('contract-renewal', {}).map((m) => m.key),
    ['previous_end_date', 'end_date']);
  check('a termination states the last day and why',
    A.missingForType('termination', {}).map((m) => m.key), ['end_date', 'closed_reason']);

  // A TYPE NOBODY DECLARED IS REFUSED, rather than falling through as an
  // initial appointment — which would print "we are pleased to appoint you" on
  // a termination.
  const unknown = A.missingForType('some-letter-somebody-invented', {});
  check('an unknown type is refused', unknown.map((m) => m.key), ['document_type']);
  check('…and it blocks', A.blocked(unknown), true);
}

console.log('\nThe reference is filed one way and printed another\n');

{
  // THE UNIVERSITY WROTE BOTH. The letter body reads IGUC/HR/APT/2026/0042 and
  // the archive key is APT-2026-0042, because a reference with slashes cannot
  // go in a URL path and the verification link is where it ends up. One fact,
  // stored once, rendered two ways — so neither can drift.
  check('the stored form is URL-safe', A.letterReference(2026, 42), 'APT-2026-0042');
  check('the printed form is the filing convention',
    A.printedReference('APT-2026-0042'), 'IGUC/HR/APT/2026/0042');
  check('and the printed form is derived, not stored separately',
    A.printedReference(A.letterReference(2026, 7)), 'IGUC/HR/APT/2026/0007');
  check('something that is not a reference passes through unchanged',
    A.printedReference('not-a-reference'), 'not-a-reference');
}

console.log('\nThe letter refuses an incomplete record rather than printing a blank\n');

{
  const L = await (async () => {
    const o = join(cache, 'appointmentLetter.mjs');
    execFileSync('npx', [
      'esbuild', join(here, 'appointmentLetter.ts'), '--bundle', '--format=esm',
      '--platform=node', `--outfile=${o}`, '--log-level=error',
      `--alias:@=${join(here, '..')}`, '--external:qrcode',
    ]);
    return import(o);
  })();

  // SPELLED OUT RATHER THAN LOCALISED, for the same reason as the history:
  // toLocaleDateString gives "Sept" on one ICU build and "Sep" on the next, so
  // a document generated on the server and previewed in a browser could
  // disagree about its own date.
  check('a date prints in full', L.longDate('2026-09-12'), '12 September 2026');
  check('and nothing prints as nothing', L.longDate(null), '');

  const args = {
    reference: 'APT-2026-0042', issuedOn: '2026-09-12', version: 1,
    signatoryName: 'The Registrar', signatoryRole: 'Registrar',
    siteUrl: 'https://example.test',
  };

  // A LETTER WITH AN EMPTY LINE WHERE THE START DATE SHOULD BE looks finished,
  // gets signed, and the omission is discovered by the appointee.
  let refused = false;
  try {
    await L.appointmentLetterHtml({ ...args, appointment: { ...complete, start_date: null } });
  } catch (e) {
    refused = /not complete/.test(String(e.message));
  }
  check('an incomplete record produces no letter', refused, true);

  const out = await L.appointmentLetterHtml({ ...args, appointment: complete });
  check('the printed reference is on the page',
    out.html.includes('IGUC/HR/APT/2026/0042'), true);
  check('and so is the name, the position and the date', [
    out.html.includes('A Specimen Appointee'),
    out.html.includes('Lecturer in Theology'),
    out.html.includes('12 September 2026'),
  ], [true, true, true]);

  // EVERY ROW COMES OUT OF THE RECORD. Nothing is typed at the moment of
  // generating, which is the whole point.
  check('the working hours row appears when recorded',
    (await L.appointmentLetterHtml({
      ...args, appointment: { ...complete, working_hours: '40 hours per week' },
    })).html.includes('40 hours per week'), true);
  // A BLANK BESIDE "PROBATION" READS AS "NONE", which is a claim the
  // University has not made. The row is omitted instead.
  check('a row with nothing in it is omitted rather than left empty',
    (await L.appointmentLetterHtml({
      ...args, appointment: { ...complete, probation_months: null },
    })).html.includes('Probation'), false);

  // THE SALARY IS PRINTED WITH ITS CURRENCY AND PERIOD OR NOT AT ALL.
  check('the remuneration prints in full', out.html.includes('FCFA 450,000 per month'), true);
  check('and an unpaid post has no remuneration row',
    (await L.appointmentLetterHtml({
      ...args,
      appointment: { ...complete, employment_type: 'honorary',
        salary_amount: null, salary_currency: null, salary_period: null },
    })).html.includes('Remuneration'), false);
}

console.log(failures === 0 ? '\nAll appointment checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
