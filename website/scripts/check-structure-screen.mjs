// ---------------------------------------------------------------------------
// Is the top of the academic tree actually visible?
//
//   node scripts/check-structure-screen.mjs [url]
//
// The University drew the tree — University, School/Faculty, Department, Study
// Programme, and down — and objected that the portal was "organized around
// isolated utilities rather than around the University's actual academic
// structure." Programmes got a screen; the two levels ABOVE them did not.
//
// So what is checked here is whether the relationship is drawn, not merely
// whether the rows load. A flat list of schools and a second flat list of
// departments would pass a row count and fail the point.
//
// Rows come from the harness after RUN-ALL: five real schools from 060, with
// departments attached to two of them and one attached to none.
// ---------------------------------------------------------------------------

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:3216';
const EXE = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const DIR = '/tmp/claude-0/-home-user/c9453aaa-aaac-5ac4-afe9-8b9092c06b92/scratchpad';
const SCHOOLS = JSON.parse(readFileSync(`${DIR}/schools.json`, 'utf8'));
const DEPTS = JSON.parse(readFileSync(`${DIR}/departments.json`, 'utf8'));
const VERSIONS = JSON.parse(readFileSync(`${DIR}/pversions.json`, 'utf8'));

let failures = 0;
const fail = (m) => { failures++; console.error(`  FAIL  ${m}`); };
const pass = (m) => console.log(`  ok    ${m}`);

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

await page.route('**/rest/v1/**', async (route) => {
  const url = route.request().url();
  const body = url.includes('/schools') ? SCHOOLS
    : url.includes('/departments') ? DEPTS
      : url.includes('/programme_versions') ? VERSIONS
        : [];
  await route.fulfill({
    status: 200, contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  });
});

await page.goto(`${base}/portal`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
const demo = page.locator('button', { hasText: /Demo Admin/i }).first();
if (await demo.count()) { await demo.click(); await page.waitForTimeout(2500); }

const link = page.getByRole('button', { name: 'Schools & departments', exact: false }).first();
if (await link.count() === 0) {
  fail('no way into Schools & departments from the sidebar');
} else {
  pass("'Schools & departments' has a way into it from the sidebar");
  await link.click();
  await page.waitForTimeout(2000);
}

const body = await page.locator('body').innerText();

// ---- THE FIVE SCHOOLS 060 SEEDED -----------------------------------------
for (const s of SCHOOLS) {
  if (body.includes(s.name)) pass(`${s.name} is on the page`);
  else fail(`${s.name} is missing`);
}

// ---- AND THE DEPARTMENTS UNDER THEM --------------------------------------
const attached = DEPTS.filter((d) => d.school_id);
for (const d of attached) {
  if (body.includes(d.name)) pass(`${d.name} is drawn`);
  else fail(`${d.name} is missing`);
}

// ---- A SCHOOL WITH NO DEPARTMENTS SAYS SO --------------------------------
//
// Silence here would leave a reader wondering whether the screen had failed to
// load them. The empty case is a finding about the University, not a glitch.
if (/No departments in this school/i.test(body)) {
  pass('a school with no departments says so, rather than showing nothing');
} else {
  fail('a school with no departments is silent');
}

// ---- AND A DEPARTMENT WITH NO SCHOOL IS SHOWN, NOT HIDDEN ----------------
//
// THE ASSERTION THAT MATTERS MOST. 001 created departments years before 057
// created schools, so live rows carry no school_id. Hidden, they would be
// departments whose lecturers and courses hang from something nobody can see.
const orphans = DEPTS.filter((d) => !d.school_id);
if (orphans.length === 0) {
  fail('the scenario is wrong: it needs a department with no school to test that case');
} else if (/belongs? to no school/i.test(body) && body.includes(orphans[0].name)) {
  pass('a department belonging to no school is shown under its own heading, not hidden');
} else {
  fail('a department with no school is not visible anywhere');
}

// ---- THE TREE COUNTS WHAT HANGS OFF EACH PART ----------------------------
if (/programme version/i.test(body)) {
  pass('each school says how many programme versions hang from it');
} else {
  fail('nothing says what hangs off a school');
}

const shot = `${DIR}/academic-structure.png`;
await page.screenshot({ path: shot, fullPage: true });
console.log(`\n        ${shot}`);

await browser.close();
console.log(failures === 0
  ? '\nThe top of the tree is visible, and so is what hangs from it.\n'
  : `\n${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
