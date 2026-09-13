// ---------------------------------------------------------------------------
// Does the Academic Records screen show what is LEFT, not just what was passed?
//
//   node scripts/check-records-screen.mjs [url]
//
// The rows are the migration's own output: 067 applied to the local Postgres
// harness, a student built with two passes, one fail, one registration and two
// courses not yet reached, then dumped to JSON. Not fixtures somebody typed —
// which means this fails if 067 ever produces a shape the screen cannot draw.
//
// WHAT IT ASSERTS. The University asked for "outstanding requirements" by name,
// and that is the half the transcript could never answer. So:
//
//   - a course the student has not reached is ON THE PAGE, not omitted;
//   - a failed course is visibly failed, not merely absent from the passes;
//   - the credits read against the award rather than as a bare total;
//   - and every term of the programme is drawn, including empty ones.
// ---------------------------------------------------------------------------

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:3216';
const EXE = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const DIR = '/tmp/claude-0/-home-user/c9453aaa-aaac-5ac4-afe9-8b9092c06b92/scratchpad';
const RECORD = JSON.parse(readFileSync(`${DIR}/record.json`, 'utf8'));
const PROGRESS = JSON.parse(readFileSync(`${DIR}/record-progress.json`, 'utf8'));
const TERMS = JSON.parse(readFileSync(`${DIR}/record-terms.json`, 'utf8'));

let failures = 0;
const fail = (m) => { failures++; console.error(`  FAIL  ${m}`); };
const pass = (m) => console.log(`  ok    ${m}`);

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

await page.route('**/rest/v1/**', async (route) => {
  const url = route.request().url();
  const body = url.includes('/student_academic_record') ? RECORD
    : url.includes('/student_curriculum_progress') ? PROGRESS
      : url.includes('/student_term_record') ? TERMS
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

const link = page.getByRole('button', { name: 'Academic records', exact: false }).first();
if (await link.count() === 0) {
  fail('no way into Academic records from the sidebar');
} else {
  pass("'Academic records' has a way into it from the sidebar");
  await link.click();
  await page.waitForTimeout(2000);
}

let body = await page.locator('body').innerText();
if (body.includes('Mabel Holten')) pass('the register lists the student');
else fail('the student is not in the register');
// A DOUBLE SPACE WHERE A MIDDLE NAME WOULD BE. Found by printing the view and
// reading it; the first version of 067 concatenated three coalesced fields.
if (!/Mabel {2,}Holten/.test(body)) pass('…and their name has no gap where a middle name is not');
else fail('the name is printed with a double space');

await page.getByRole('button', { name: /Mabel Holten/ }).first().click();
await page.waitForTimeout(2000);
body = await page.locator('body').innerText();

// ---- THE ANSWER THE TRANSCRIPT COULD NEVER GIVE --------------------------
for (const code of ['REC 101', 'REC 102', 'REC 103', 'REC 201', 'REC 202', 'REC 203']) {
  if (body.includes(code)) pass(`${code} is on the record`);
  else fail(`${code} is missing — the whole curriculum must be shown, not only what was taken`);
}
if (/Not taken/i.test(body)) {
  pass('a course the student has not reached is shown as not taken, rather than omitted');
} else {
  fail('nothing is marked "not taken" — this is the question the screen exists to answer');
}
if (/12 \/ 36/.test(body)) {
  pass('credits read against the award (12 / 36), not as a bare total');
} else {
  fail('credits are not shown against the award requirement');
}
if (/24 short of the award/i.test(body)) {
  pass('…and the shortfall is stated in words');
} else {
  fail('the shortfall is not stated');
}
if (/Courses failed[\s\S]{0,40}1|1[\s\S]{0,40}Courses failed/i.test(body)) {
  pass('the failed course is counted');
} else {
  fail('the failed course is not counted');
}
if (/2\.33/.test(body)) pass('the CGPA the engine computed is shown');
else fail('the CGPA is missing');
if (/Semester 2/.test(body)) pass('every semester of the programme is drawn, not only the sat one');
else fail('a semester the student has not reached is not drawn');

const shot = `${DIR}/academic-records.png`;
await page.screenshot({ path: shot, fullPage: true });
console.log(`\n        ${shot}`);

await browser.close();
console.log(failures === 0
  ? '\nThe record shows what is left, not only what was passed.\n'
  : `\n${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
