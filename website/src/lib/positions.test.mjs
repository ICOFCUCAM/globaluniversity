// ---------------------------------------------------------------------------
// THE JOB DESCRIPTION RESOLVES THE SAME WAY IN BOTH PLACES.
//
// Run with:  node src/lib/positions.test.mjs
//
// ---------------------------------------------------------------------------
// WHAT THIS IS GUARDING
// ---------------------------------------------------------------------------
//
// A post's job description is resolved twice in this system: by
// `position_job_description` in the database, and by `resolveJobDescription` in
// the library — because a screen previewing an unsaved draft cannot query a
// view of rows that do not exist yet.
//
// Two implementations of one rule is the failure this file exists to catch. If
// they drift, the job description on the screen and the job description on the
// letter are different documents, and the one that matters is whichever got
// printed for the person who later challenged it.
//
// So this asserts the rule in the library AND asserts that the SQL says the
// same thing.
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
const out = join(cache, 'positions.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'positions.ts'), '--bundle', '--format=esm', '--platform=node',
  `--outfile=${out}`, '--log-level=error', `--alias:@=${join(here, '..')}`,
]);
const P = await import(out);

const family = [
  { section: 'institutional', ordinal: 1, body: 'Uphold the mission of the University.' },
  { section: 'confidentiality', ordinal: 1, body: 'Treat student records as confidential.' },
  { section: 'research', ordinal: 1, body: 'Pursue research appropriate to the grade.' },
  { section: 'academic', ordinal: 1, body: 'Teach the courses allocated.' },
];

console.log('\nA post takes its family’s clauses where it has none of its own\n');

{
  const resolved = P.resolveJobDescription(family, []);
  check('all four are inherited', resolved.length, 4);
  check('and every one is marked as the family’s',
    resolved.every((c) => c.source === 'family'), true);
}

console.log('\nAnd its own clause REPLACES the family’s for that section\n');

{
  const own = [
    { section: 'research', ordinal: 1, body: 'Pursue research as agreed with the Head.' },
  ];
  const resolved = P.resolveJobDescription(family, own);

  // THE RULE. Not appended — replaced. Appending would produce a job
  // description that says two things about one duty, and a Dean whose financial
  // authority differs from the family's needs the difference to be the
  // document, not a contradiction inside it.
  const research = resolved.filter((c) => c.section === 'research');
  check('there is exactly one research clause', research.length, 1);
  check('and it is the post’s own', research[0].source, 'position');

  // AND NOTHING ELSE IS LOST. The bug that would be easy to write is dropping
  // every family clause the moment the post states anything.
  check('the other three still come from the family',
    resolved.filter((c) => c.source === 'family').length, 3);
  check('confidentiality survived',
    resolved.some((c) => c.section === 'confidentiality' && c.source === 'family'), true);
}

console.log('\nThe document prints in the order it reads in\n');

{
  const scrambled = [
    { section: 'amendment', ordinal: 1, body: 'This may be amended.' },
    { section: 'key-responsibilities', ordinal: 2, body: 'The second duty.' },
    { section: 'key-responsibilities', ordinal: 1, body: 'The first duty.' },
    { section: 'qualifications', ordinal: 1, body: 'A qualification.' },
  ];
  const ordered = P.order(scrambled);
  check('responsibilities come first',
    ordered.map((c) => c.section),
    ['key-responsibilities', 'key-responsibilities', 'qualifications', 'amendment']);
  check('and they are numbered in order',
    ordered.slice(0, 2).map((c) => c.ordinal), [1, 2]);

  // A CLAUSE NOBODY DECLARED MUST NOT OPEN THE DOCUMENT. `indexOf` returns -1
  // for an unknown section, and -1 sorts before everything.
  const withUnknown = P.order([...scrambled, { section: 'made-up', ordinal: 1, body: 'x.' }]);
  check('an unrecognised section sorts last, not first',
    withUnknown[withUnknown.length - 1].section, 'made-up');
}

console.log('\nNobody approves the job description they wrote\n');

{
  const draft = { status: 'draft', created_by: 'the-author' };
  check('the author cannot activate it', P.canActivateProfile(draft, 'the-author'), false);
  check('somebody else can', P.canActivateProfile(draft, 'another-officer'), true);
  check('and an active one cannot be activated again',
    P.canActivateProfile({ status: 'active', created_by: 'a' }, 'b'), false);
}

console.log('\nWhat is missing is said before it is approved\n');

{
  const bare = P.objectionsToProfile({ job_purpose: '' }, []);
  check('no purpose blocks it', bare.some((o) => o.code === 'no-purpose' && o.blocking), true);
  check('no clauses blocks it', bare.some((o) => o.code === 'no-clauses' && o.blocking), true);

  const purpose = 'To teach the courses of the department to the standard the University '
    + 'requires, and to supervise the students allocated to the post.';
  const complete = P.objectionsToProfile({ job_purpose: purpose }, family);
  check('a profile with a purpose and clauses is approvable',
    P.blocksApproval(complete), false);

  // A WARNING IS NOT A REFUSAL. A short job description for a temporary post is
  // the University's call, not this file's.
  check('but it is told nothing states the decision-making authority',
    complete.some((o) => o.code === 'no-authority-stated' && !o.blocking), true);
}

console.log('\nAn indicative figure is for the screen and never for the letter\n');

{
  check('a complete one reads as indicative',
    P.indicativePay({
      indicative_salary_amount: 2000, indicative_salary_currency: 'USD',
      indicative_salary_period: 'month',
    }),
    'USD 2,000 (indicative)');
  check('and a post with none says nothing', P.indicativePay({}), null);
}

console.log('\nAnd 048 resolves it the same way\n');

{
  const sql = readFileSync(
    join(here, '../../docs/migrations/048_the_job_descriptions_and_what_they_inherit.sql'),
    'utf8');

  // THE VIEW MUST DROP THE FAMILY CLAUSE WHERE THE POST HAS ITS OWN IN THAT
  // SECTION. If this `not exists` ever goes, the database starts returning both
  // and the two resolutions have silently diverged.
  check('the view drops a family clause the post has restated',
    /not exists \(select 1 from own_sections o/.test(sql), true);
  check('…matched on the section, not just the post',
    /o\.position_id = p\.id and o\.section = c\.section/.test(sql), true);

  // Every section and family the library knows must exist in the database's
  // vocabulary, or a clause the screen offers cannot be saved.
  for (const s of P.JD_SECTIONS) {
    check(`the database knows the section '${s}'`, sql.includes(`'${s}'`), true);
  }
  for (const f of P.POSITION_FAMILIES) {
    check(`the database knows the family '${f}'`, sql.includes(`'${f}'`), true);
  }

  // AND EVERYTHING SEEDED IS A DRAFT. The University's instruction, and the
  // thing a later edit could quietly undo by seeding one as active.
  check('nothing is seeded already approved',
    /insert into position_profiles \(family, version, status, job_purpose\)[\s\S]{0,200}'active'/
      .test(sql), false);
  check('the family profiles are seeded as drafts',
    /values \(fam, 1, 'draft',/.test(sql), true);

  // The faculty name the University ruled on.
  check('the business faculty is spelled with "and"',
    sql.includes('Faculty of Business and Management Science'), true);
  check('and never with an ampersand',
    /Business & Management/.test(sql), false);
}

console.log(failures === 0 ? '\nAll position checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
