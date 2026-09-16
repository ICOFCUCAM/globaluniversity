// ---------------------------------------------------------------------------
// THE SCREEN AND THE POLICY AGREE ABOUT WHO MAY BE HERE.
//
// Run with:  node src/lib/data/roleMap.test.mjs
//
// ---------------------------------------------------------------------------
// THE FAULT THIS GUARDS
// ---------------------------------------------------------------------------
//
// Two files answer "may this office see a lecturer's material":
//
//   roleMap.ts                       decides what the SCREEN does
//   092's governs_the_curriculum()   decides what the DATABASE does
//
// If they drift, the outcome is the worst available: a person is offered a
// course, opens it, and is told they may not read it. Or — the direction that
// actually matters — an office is quietly shown a door the policy would have
// refused, and nobody finds out until somebody reads a draft they should not
// have.
//
// This repository has met the shape of that fault repeatedly, most recently in
// `oneWordOneCount.test.mjs`:
//
//     Two screens counting the same thing is two percentages, and the one a
//     student quotes in an appeal will be whichever is higher.
//
// So the list is not copied and compared by eye. It is READ OUT OF THE
// MIGRATION and compared to the code, every run.
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
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
  }
};

// fileURLToPath, not new URL().pathname — this folder's name has a space in it.
const here = dirname(fileURLToPath(import.meta.url));

console.log('\nThe role map and the migration admit the same offices\n');

const { platformRole, MAPPED, UNFILLED } = await import('./roleMap.ts')
  .catch(async () => import(join(here, 'roleMap.ts')));

// ---------------------------------------------------------------------------
// WHAT THE MIGRATION ADMITS
// ---------------------------------------------------------------------------
const migration = readFileSync(
  // FROM src/academic/lib/data, the migrations are four levels up and then
  // docs/. This said `../../../../website/docs/...`, which was right while the
  // Studio was its own repository beside website/ and became website/website/
  // once it moved inside.
  //
  // It CRASHED rather than skipping, which is the failure to want: a test that
  // cannot find the migration it checks against must not quietly pass.
  join(here, '../../../../docs/migrations/092_a_lecture_and_what_is_made_from_it.sql'),
  'utf8',
);

const body = /create or replace function governs_the_curriculum\(\)[\s\S]*?\$\$([\s\S]*?)\$\$;/
  .exec(migration);
check('092 still has governs_the_curriculum()', Boolean(body), true);

const admitted = [...(body?.[1] ?? '').matchAll(/'([a-z-]+)'/g)].map((m) => m[1]).sort();
check('…and it admits somebody', admitted.length > 0, true);

// ---------------------------------------------------------------------------
// WHAT THE CODE ADMITS
//
// The same question from the other side: which University roles does the map
// turn into `registry` or `coordinator` — the two that reach a lecturer's
// published material without teaching the course.
// ---------------------------------------------------------------------------
const governing = MAPPED
  .filter(([, platform]) => platform === 'registry' || platform === 'coordinator')
  .map(([university]) => university)
  .sort();

check('the code and the migration admit exactly the same offices', governing, admitted);

// ---------------------------------------------------------------------------
// AND THE ROLES THAT MUST NOT BE IN IT
// ---------------------------------------------------------------------------
//
// THE TWO MOST SENIOR OFFICES OF THE UNIVERSITY ARE REFUSED, on purpose. The
// Chancellor and the Vice-Chancellor govern the institution; they do not
// govern the curriculum. Seniority is not the question a lecture's material
// asks — "whose teaching is this" is — and a reader who finds that surprising
// should find it asserted rather than inferred.
for (const role of ['chancellor', 'vice-chancellor', 'finance', 'invigilator', 'applicant',
  'hr-officer', 'library-staff', 'examiner', 'moderator']) {
  check(`'${role}' has no place in a lecture's material`, platformRole(role), null);
}

check("'lecturer' maps to lecturer", platformRole('lecturer'), 'lecturer');
check("'student' maps to student", platformRole('student'), 'student');
check("'registrar' maps to registry", platformRole('registrar'), 'registry');
check("'hod' maps to coordinator", platformRole('hod'), 'coordinator');

// CASE AND WHITESPACE. A role read from a database column arrives as it was
// stored, and 'Registrar ' refused for having a capital letter would be a
// person locked out by a space.
check('a stored role is matched however it was capitalised',
  platformRole('  Registrar '), 'registry');
check('an absent role is nobody', [platformRole(null), platformRole(undefined), platformRole('')],
  [null, null, null]);

// ---------------------------------------------------------------------------
// THE POSTS THE UNIVERSITY HAS NOT CREATED
//
// `assistant` and `translation-reviewer` are real roles in this platform and
// NOBODY HOLDS THEM, because the University's role list has neither post.
// Inventing one would be inventing an institutional fact.
//
// The test pins that as a deliberate state with a reason, so the next person
// to notice the gap reads why rather than filling it in.
// ---------------------------------------------------------------------------
check('the unfilled posts are named, with a reason each',
  Object.keys(UNFILLED).sort(), ['assistant', 'translation-reviewer']);
for (const [role, why] of Object.entries(UNFILLED)) {
  check(`…and '${role}' says what happens meanwhile`, why.length > 60, true);
}
check('no University role maps to a post that does not exist',
  MAPPED.filter(([, platform]) => platform in UNFILLED), []);

console.log(failures ? `\n${failures} check(s) failed.\n` : '\nThe screen and the policy agree.\n');
process.exit(failures ? 1 : 0);
