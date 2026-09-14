// ---------------------------------------------------------------------------
// DOES THE LETTER ACTUALLY CHANGE WITH THE OFFICE, AND DOES IT STAY INSIDE ITS
// AUTHORITY WHILE IT DOES?
//
// Run with:  node src/lib/appointmentRegisters.test.mjs
//
// ---------------------------------------------------------------------------
// THE TWO QUESTIONS
// ---------------------------------------------------------------------------
//
// 1. THE UNIVERSITY ASKED FOR WORDING THAT CHANGES BY POST — a Dean, a
//    Registrar, a Lecturer and a Director of ICT should not receive the same
//    generic executive letter. It is easy to build something that LOOKS
//    dynamic: eight entries in a table, each subtly different, all saying the
//    same thing. So these cases generate real letters for real families and
//    assert on the sentences that must and must not appear in each.
//
// 2. THE UNIVERSITY ALSO SAID the letter must not invent powers beyond what has
//    been authorised. The job description holds three sections that ARE grants
//    of authority — may-authorize, may-recommend, must-obtain-approval — and
//    the letter is given the whole job description to print duties from. If it
//    ever prints those three, the University has stated a grant of authority in
//    two documents that can later disagree.
//
//    That is the assertion this file exists for, and it is written as a leak
//    test: the fixture deliberately includes authority clauses with distinctive
//    wording, and every letter is searched for them.
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

const bundle = (name, file) => {
  const out = join(cache, name);
  execFileSync('npx', [
    'esbuild', join(here, file), '--bundle', '--format=esm', '--platform=node',
    `--outfile=${out}`, '--log-level=error', `--alias:@=${join(here, '..')}`,
    '--external:qrcode',
  ]);
  return out;
};

const { appointmentLetterHtml } = await import(bundle('lettersForRegisters.mjs', 'appointmentLetter.ts'));
const R = await import(bundle('registersUnderTest.mjs', 'appointmentRegisters.ts'));
const P = await import(bundle('positionsForRegisters.mjs', 'positions.ts'));

// ---------------------------------------------------------------------------
// EVERY FAMILY HAS A REGISTER, checked against the families themselves rather
// than a list typed here. A family added by a future migration with no register
// would otherwise fall silently to `other` and nobody would look.
// ---------------------------------------------------------------------------
console.log('\nEvery kind of office has wording of its own\n');

check('the register covers every family',
  P.POSITION_FAMILIES.filter((f) => !R.REGISTERS[f]), []);

// AND THE REGISTERS ARE NOT COPIES OF EACH OTHER. Eight entries that differ
// only in a word would satisfy the check above and none of the University's
// intent, so the openings and headings are counted for distinctness.
const statusHeadings = P.POSITION_FAMILIES
  .map((f) => R.REGISTERS[f].status?.heading ?? '(none)');
check('at least four distinct status headings',
  new Set(statusHeadings).size >= 4, true);

// THE FLAG THAT DECIDES WHETHER A LETTER TALKS ABOUT AUTHORITY.
check('only the three leading families carry delegated authority',
  P.POSITION_FAMILIES.filter((f) => R.REGISTERS[f].carriesDelegatedAuthority).sort(),
  ['academic-administration', 'executive', 'faculty-leadership']);

// AN UNKNOWN FAMILY FALLS TO THE PLAINEST REGISTER, NEVER THE GRANDEST.
check('an unknown family gets `other`',
  R.registerFor('vice-emperor').carriesDelegatedAuthority, false);
check('…and so does a missing one', R.registerFor(null).status, null);
check('…and `other` grants nothing',
  R.REGISTERS.other.carriesDelegatedAuthority, false);

// ---------------------------------------------------------------------------
console.log('\nThe conduct list grows with the authority held\n');

check('a Lecturer is not told to exercise University authority',
  R.conductFor(R.REGISTERS['academic-staff']).some((c) => c.includes('exercise University authority')),
  false);
check('an executive officer is',
  R.conductFor(R.REGISTERS.executive).some((c) => c.includes('exercise University authority')),
  true);
check('and the obligation appears once, not twice',
  R.conductFor(R.REGISTERS.executive)
    .filter((c) => c.includes('exercise University authority')).length, 1);

// ---------------------------------------------------------------------------
// THE LETTERS THEMSELVES
// ---------------------------------------------------------------------------

// THE THREE CLAUSES THAT MUST NEVER REACH A LETTER. Worded distinctively so a
// match is unambiguous.
const AUTHORITY_CLAUSES = [
  { section: 'may-authorize', ordinal: 1, body: 'ZZAUTH approve course allocations across the faculties.' },
  { section: 'may-recommend', ordinal: 1, body: 'ZZRECO recommend promotions to the Vice-Chancellor.' },
  { section: 'must-obtain-approval', ordinal: 1, body: 'ZZAPPR any commitment of University funds needs prior approval.' },
];

const DUTY_CLAUSES = [
  { section: 'academic', ordinal: 1, body: 'ZZDUTY teach and assess the courses allocated.' },
  { section: 'administrative', ordinal: 1, body: 'ZZADMIN keep the records of the unit.' },
];

async function letterFor(family, overrides = {}) {
  const out = await appointmentLetterHtml({
    appointment: {
      full_name: 'A Specimen Appointee',
      position_title: overrides.title ?? 'A Specimen Post',
      unit_name: 'A Specimen Unit',
      employment_type: 'permanent',
      start_date: '2026-10-01',
      effective_date: '2026-10-01',
      place_of_duty: 'Buea campus',
      working_hours: '40 hours per week',
      reports_to_name: 'The Vice-Chancellor',
      appointing_authority: 'The Vice-Chancellor',
      salary_amount: 1000,
      salary_currency: 'USD',
      salary_period: 'month',
      ...(overrides.appointment ?? {}),
    },
    jobDescription: {
      code: 'ZZZ-TEST', title: 'A Specimen Post', version: 1,
      clauses: [...DUTY_CLAUSES, ...AUTHORITY_CLAUSES],
    },
    family,
    reference: 'APT-2026-0001',
    issuedOn: '2026-09-13',
    version: 1,
    signatoryName: 'A Specimen Signatory',
    signatoryRole: 'Registrar',
    siteUrl: 'https://www.iguc.net',
    ...(overrides.input ?? {}),
  });
  return out.html;
}

// ---------------------------------------------------------------------------
// A LETTER NEVER RESTATES WHAT THE JOB DESCRIPTION MAY AUTHORISE.
//
// THE RULE IS THE SAME; WHERE IT APPLIES HAS MOVED, AND THE REASON IS WORTH
// WRITING DOWN.
//
// This used to assert that `may-authorize`, `may-recommend` and
// `must-obtain-approval` appeared NOWHERE in the letter's HTML. What it was
// protecting was stated plainly at the time: the University must not state a
// grant of authority in two documents that can later disagree about what
// somebody was entitled to decide.
//
// The letter now ANNEXES the job description rather than referring to one. It
// had been naming the document, saying it accompanied the letter, listing it
// under Attachments — and carrying nothing; the University said so ("the letter
// does not have the other pages like job description").
//
// Carrying the document is not a second statement of the grant. It is the same
// clauses, rendered by the same function, from the same resolved rows, at a
// named version. What would still be a second statement — and is still refused
// here — is the letter's OWN PROSE restating them in its own words, which is
// what "Principal Areas of Responsibility" would do if it stopped filtering.
//
// So the assertion is now made on the letter up to the annex, and the annex is
// asserted to carry them. Both halves matter: a change that quietly dropped the
// authority sections from the annexed job description would make the University
// annex an incomplete document.
// ---------------------------------------------------------------------------
console.log('\nA letter never restates what the job description may authorise\n');

/** Everything before the annexed job description: the letter in its own words. */
const lettersOwnWords = (html) =>
  html.split('<h2>Job Description and Terms of Reference</h2>')[0];

for (const family of P.POSITION_FAMILIES) {
  const html = await letterFor(family);
  // ONE ASSERTION PER FAMILY, because a leak that only happens for one of them
  // is exactly the kind that ships.
  check(`${family}: no authority clause leaks into the letter's own words`,
    ['ZZAUTH', 'ZZRECO', 'ZZAPPR'].filter((m) => lettersOwnWords(html).includes(m)), []);
  check(`${family}: but the duties do appear`,
    lettersOwnWords(html).includes('ZZDUTY'), true);
  // AND THE ANNEXED DOCUMENT IS COMPLETE. The three authority sections are the
  // point of a job description — "may recommend" and "may authorise" are the
  // difference between advice and a commitment of the University — so an annex
  // without them would be an extract presented as the document.
  check(`${family}: and the annexed job description carries them`,
    ['ZZAUTH', 'ZZRECO', 'ZZAPPR'].filter((m) => !html.includes(m)), []);
}

// ---------------------------------------------------------------------------
console.log('\nAnd the letter reads differently for each kind of office\n');

const lecturer = await letterFor('academic-staff', { title: 'Lecturer in Systematic Theology' });
const daa = await letterFor('academic-administration', { title: 'Director of Academic Affairs' });
const dean = await letterFor('faculty-leadership', { title: 'Dean, Faculty of Education' });
const ict = await letterFor('ict', { title: 'Director of ICT' });

// THE ONE THAT MATTERS MOST. A Lecturer holds no delegated authority, and a
// letter telling them they exercise powers delegated by the Vice-Chancellor is
// a letter somebody will one day rely on.
check('a Lecturer is not told they exercise delegated authority',
  /formally delegated to you/.test(lecturer), false);
check('the Director of Academic Affairs is', /formally delegated to you/.test(daa), true);
check('and so is a Dean', /formally delegated to you/.test(dean), true);

check('a Lecturer’s letter talks about teaching', /Academic Duties/.test(lecturer), true);
check('…and not about executive leadership',
  /executive leadership/.test(lecturer), false);
check('the Director of Academic Affairs’ letter does',
  /executive leadership/.test(daa), true);

check('a Lecturer is bound to academic integrity', /academic integrity/.test(lecturer), true);
check('the ICT Director is bound on personal data', /personal data/.test(ict), true);
check('…and the Lecturer is not given the ICT clause',
  /personal data/.test(lecturer), false);

check('the subject line names the academic staff appointment',
  /Appointment to the Academic Staff/.test(lecturer), true);
check('…and the executive one names the office',
  /Re: Appointment as Director of Academic Affairs/.test(daa), true);

// ---------------------------------------------------------------------------
console.log('\nPrecedence is printed only when the University has stated it\n');

const withStanding = await letterFor('academic-administration', {
  title: 'Director of Academic Affairs',
  input: {
    precedence: 'Second-ranking officer after the Vice-Chancellor',
    standing: 'a senior executive office of the University, ranking immediately below the Vice-Chancellor',
  },
});
check('it appears when stated', /Second-ranking officer/.test(withStanding), true);
check('…as a sentence too', /ranking immediately below the Vice-Chancellor/.test(withStanding), true);

// AND NOT OTHERWISE. This is the assertion that stops a future letter claiming
// a rank for a post the University has never ranked.
const withoutStanding = await letterFor('academic-administration', {
  title: 'Director of Academic Affairs',
});
check('and never when it is not', /ranking immediately below/.test(withoutStanding), false);
check('…nor for a Lecturer', /Institutional rank/.test(lecturer), false);

// ---------------------------------------------------------------------------
console.log('\n“By authority of myself” is not a statement of authority\n');

const signedByVc = await letterFor('executive', {
  input: { signatoryName: 'Prof Chamayah Meyembi', signatoryRole: 'Vice-Chancellor' },
});
check('a letter the Vice-Chancellor signs carries no by-authority line',
  /BY AUTHORITY OF/.test(signedByVc), false);

const signedByRegistrar = await letterFor('executive');
check('a letter the Registrar signs does',
  /BY AUTHORITY OF THE VICE-CHANCELLOR/.test(signedByRegistrar), true);

// ---------------------------------------------------------------------------
console.log('\nThe numbering has no gaps in it\n');

// A LETTER WITH NO SALARY LOSES A SECTION. The numbering must close up rather
// than run 1, 2, 3, 5 — a reader citing "paragraph 5" of a document with no
// paragraph 4 has found a hole in the University's paperwork.
const unpaid = await letterFor('academic-staff', {
  appointment: { salary_amount: null, salary_currency: null, salary_period: null },
});
const numbers = [...unpaid.matchAll(/<h3>(\d+)\./g)].map((m) => Number(m[1]));
check('the sections run 1..n with no gap',
  numbers.every((n, i) => n === i + 1), true);
check('…and an unpaid appointment has no remuneration section',
  /Remuneration and Benefits/.test(unpaid), false);

// ---------------------------------------------------------------------------
console.log('\nAnd the University’s crest is on its own letters\n');
check('the letterhead carries the crest', /class="crest"/.test(daa), true);

// ---------------------------------------------------------------------------
console.log(failures === 0
  ? '\nThe letter fits the office, and stops where the job description begins.\n'
  : `\n${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
