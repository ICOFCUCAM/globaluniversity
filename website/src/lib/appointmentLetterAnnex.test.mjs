// ---------------------------------------------------------------------------
// A LETTER THAT NAMES AN ATTACHMENT IS A PROMISE.
//
// Run with:  node src/lib/appointmentLetterAnnex.test.mjs
//
// ---------------------------------------------------------------------------
// WHAT THIS GUARDS
// ---------------------------------------------------------------------------
//
// The University: "the letter does not have the other pages like job
// description."
//
// It did not. The letter named the job description by code and version, said it
// "accompanies this letter", said it "forms an integral part of your
// appointment", and listed it under Attachments — and carried nothing. The
// recipient of a letter like that believes a document was withheld from them.
//
// TWO FAULTS PRODUCED IT, and this file holds both shut.
//
//   1. THE LETTER NEVER CARRIED THE DOCUMENT. It referred to a separate record
//      produced by a separate route that nothing bound to the letter. The job
//      description is now annexed in full, rendered by the same function as the
//      standalone document so the two cannot word the same clause differently.
//
//   2. THE CLAUSES WERE ONLY FETCHED FOR A POST WITH ITS OWN PROFILE. 048 seeds
//      EIGHT FAMILY profiles and most posts have none of their own, inheriting
//      the family's wording through `position_job_description`. The route
//      gated the query on the post's own profile, so for those posts no clauses
//      were ever read — and it would have kept doing that after the University
//      activated the eight, making the activation appear to do nothing.
//
// AND THE HONEST CASE IS TESTED TOO. Where no job description is in force there
// is nothing to annex, and the letter has to say that rather than promise a
// document nobody can produce.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;
const check = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`ok    ${label}`);
  } else {
    failures++;
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
  }
};

const here = new URL('.', import.meta.url).pathname;
const cache = join(here, '../../node_modules/.cache/icof');
mkdirSync(cache, { recursive: true });

process.env.CREDENTIAL_SECRET = 'x'.repeat(48);

const out = join(cache, 'letterForAnnex.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'appointmentLetter.ts'), '--bundle', '--format=esm',
  '--platform=node', `--outfile=${out}`, '--log-level=error',
  `--alias:@=${join(here, '..')}`, '--external:qrcode',
]);
const { appointmentLetterHtml } = await import(out);

// A SPECIMEN. Nobody in the register is named here.
const appointment = {
  full_name: 'A Specimen Appointee',
  postal_address: 'PO Box 1, Buea, Cameroon',
  position_title: 'Director of Academic Affairs',
  unit_name: 'Academic Affairs',
  employment_type: 'permanent',
  start_date: '2026-10-01',
  probation_months: 6,
  place_of_duty: 'Buea',
  reports_to_name: 'The Vice-Chancellor',
  working_hours: '40 hours weekly',
  appointing_authority: 'The Vice-Chancellor',
  authority_decided_on: '2026-09-01',
  terms: 'As annexed.',
  status: 'letter_generated',
};

// Real section names from JD_SECTIONS, including the three authority sections.
const clauses = [
  { section: 'key-responsibilities', ordinal: 1, body: 'Oversee admissions, registration and examinations.', source: 'family' },
  { section: 'academic', ordinal: 2, body: 'Maintain the integrity of the academic record.', source: 'family' },
  { section: 'may-authorize', ordinal: 3, body: 'Authorise the publication of examination results.', source: 'position' },
  { section: 'may-recommend', ordinal: 4, body: 'Recommend the appointment of external examiners.', source: 'position' },
  { section: 'must-obtain-approval', ordinal: 5, body: 'Obtain Senate approval before opening a programme.', source: 'position' },
  { section: 'qualifications', ordinal: 6, body: 'A doctorate in a relevant discipline.', source: 'family' },
  { section: 'evaluation', ordinal: 7, body: 'Reviewed annually against agreed objectives.', source: 'family' },
];

const letter = async (jobDescription) => {
  const built = await appointmentLetterHtml({
    appointment, reference: 'IGUC/HR/APT/2026/9001', version: 1,
    jobDescription, family: 'executive',
  });
  return typeof built === 'string' ? built : built.html;
};

const attachmentsOf = (html) => {
  const block = /<div class="attachments">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? '';
  return [...block.matchAll(/<li>([^<]+)<\/li>/g)].map((m) => m[1].trim());
};

console.log('\nThe job description is in the letter, not promised by it\n');

// --- IN FORCE: the document is carried -------------------------------------
{
  const html = await letter({
    code: 'ACA-DAA', title: 'Director of Academic Affairs', family: 'executive',
    unit: 'Academic Affairs', reportsTo: 'The Vice-Chancellor', version: 1,
    activatedOn: '2026-09-10',
    purpose: 'To lead the academic administration of the University.',
    clauses,
  });

  check('the letter carries a job description annex',
    /<h2>Job Description and Terms of Reference<\/h2>/.test(html), true);
  check('…which says it is part of this letter',
    /forms part of the letter of appointment/.test(html), true);
  check('…and names the version annexed', /version 1/.test(html), true);
  check('…and the purpose of the post', html.includes('lead the academic administration'), true);

  // EVERY CLAUSE. Not a sample — the fault was a document that was named and
  // not carried, and carrying most of it is the same fault in a smaller size.
  for (const c of clauses) {
    check(`the annex carries the ${c.section} clause`, html.includes(c.body), true);
  }

  // THE AUTHORITY SECTIONS REACH THE ANNEX AND NOT THE LETTER'S OWN PROSE.
  // The old rule kept `may-authorize` out of the letter entirely, to stop the
  // University stating a grant of authority in two documents that could drift.
  // Annexing the job description is not a second statement of it — it IS the
  // job description — but the letter's own "Principal Areas of Responsibility"
  // must still not restate it.
  const body = html.split('<h2>Job Description and Terms of Reference</h2>')[0];
  check('the letter body does not restate the authority clauses',
    /publication of examination results|external examiners|Senate approval/.test(body), false);
  check('…while the duties do appear in the letter body',
    body.includes('Oversee admissions, registration and examinations.'), true);

  // A clause inherited from the family says so, because changing it changes
  // every post in that family.
  check('an inherited clause is marked as inherited',
    /from the family profile/.test(html), true);

  check('the attachments say the job description is annexed',
    attachmentsOf(html).some((t) => /annexed to this letter/.test(t)), true);
  check('the letter no longer says a document accompanies it',
    /accompanies this letter/.test(html), false);
}

// --- NOT IN FORCE: nothing is promised -------------------------------------
//
// What the University has today: eight job descriptions still in draft. The
// letter must not claim one is attached.
{
  const html = await letter({
    code: 'ACA-DAA', title: 'Director of Academic Affairs', family: 'executive',
  });

  check('with none in force there is no annex',
    /<h2>Job Description and Terms of Reference<\/h2>/.test(html), false);
  check('…the letter says so plainly',
    // \s+ because the sentence wraps in the source template literal, and a
    // check that only matches one line of it fails on a reflow.
    /is not yet in\s+force, and none is annexed to this letter/.test(html), true);
  check('…and does not list it as an attachment',
    attachmentsOf(html).some((t) => /Job description/i.test(t)), false);
  check('…and still tells the appointee what governs in the meantime',
    /duties\s+in the meantime are those set out in this letter/.test(html), true);
}

// --- THE ROUTE ASKS FOR THE RESOLVED DOCUMENT, UNCONDITIONALLY --------------
//
// The second fault was in the route, not the letter, so reading the letter
// could never have caught it. A post inheriting its family's job description
// has no profile of its own, and the query that reads the clauses used to be
// gated on one.
{
  const route = readFileSync(
    join(here, '../app/api/appointments/letter/route.ts'), 'utf8')
    // COMMENTS STRIPPED FIRST. This file's comments discuss the very thing
    // being matched, and a check that reads its own explanation passes on
    // prose. That has caught this suite out before.
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  const jdQuery = /from\('position_job_description'\)/.exec(route);
  check('the route reads the resolved job description', Boolean(jdQuery), true);

  // The gate that caused the fault: `if (pr?.id) {` around the clause query.
  const gated = /if\s*\(\s*pr\?\.id\s*\)[\s\S]{0,400}position_job_description/.test(route);
  check('…and does not gate it on the post having its own profile', gated, false);

  check('…and asks for the source, so an inherited clause can say so',
    /select\('section, ordinal, body, source'\)/.test(route), true);

  // Falling back to the family's profile is what supplies the version number
  // for a post that inherits.
  check('…and falls back to the family profile for the version',
    /eq\('family', family\)[\s\S]{0,120}is\('position_id', null\)/.test(route), true);
}

console.log(failures ? `\n${failures} check(s) failed.\n` : '\nAll annex checks passed.\n');
process.exit(failures ? 1 : 0);
