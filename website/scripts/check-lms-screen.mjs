// ---------------------------------------------------------------------------
// Is the LMS academic-contextual now, or still a file repository?
//
//   node scripts/check-lms-screen.mjs [url]
//
// The University's objection was specific: "The current LMS looks like a file
// repository containing: Introduction to AI, SQL Tutorial, React Framework,
// Neural Networks. Those examples don't even appear connected to the
// University's actual academic programmes. Instead, make it
// academic-contextual: My Courses → inside BLT 501: course overview, lecturer,
// outline, learning outcomes, weekly materials, reading list."
//
// So the checks are about CONTEXT, not about whether rows load. A flat list of
// files with a search box would pass a row count and fail the objection.
//
// The rows are the database's: 068 applied to the harness, then a real course
// built on it with an outline, outcomes, a reading list that belongs to the
// course, weekly material that belongs to this term, and one item still
// unpublished.
// ---------------------------------------------------------------------------

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:3218';
const EXE = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const DIR = '/tmp/claude-0/-home-user/c9453aaa-aaac-5ac4-afe9-8b9092c06b92/scratchpad';
const COURSES = JSON.parse(readFileSync(`${DIR}/my-courses.json`, 'utf8'));
const MATERIALS = JSON.parse(readFileSync(`${DIR}/materials.json`, 'utf8'));

let failures = 0;
const fail = (m) => { failures++; console.error(`  FAIL  ${m}`); };
const pass = (m) => console.log(`  ok    ${m}`);

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1440, height: 1300 } });

await page.route('**/rest/v1/**', async (route) => {
  const url = route.request().url();
  const body = url.includes('/my_courses') ? COURSES
    : url.includes('/my_teaching') ? []
      : url.includes('/course_materials') ? MATERIALS
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

const link = page.getByRole('button', { name: /Learning/i }).first();
if (await link.count() === 0) {
  fail('no way into Learning from the sidebar');
} else {
  pass("'Learning' has a way into it from the sidebar");
  await link.click();
  await page.waitForTimeout(2000);
}

let body = await page.locator('body').innerText();

// ---- THE SHELF IS COURSES, NOT FILES --------------------------------------
if (body.includes('BLT 501')) pass('the shelf lists the course by its code');
else fail('the course is not on the shelf');
if (body.includes('Introduction to Black Liberation Theology')) {
  pass('…and by its title');
} else {
  fail('the course title is missing');
}
// THE ROWS THE UNIVERSITY OBJECTED TO. If any of these ever reappears, the
// screen has regressed to the file repository.
for (const invented of ['Introduction to AI', 'SQL Tutorial', 'React Framework', 'Neural Networks']) {
  if (body.includes(invented)) fail(`the invented row "${invented}" is back on the screen`);
}
pass('and none of the invented rows the University objected to is on it');

// ---- INSIDE THE COURSE ----------------------------------------------------
await page.getByRole('button', { name: /BLT 501/ }).first().click();
await page.waitForTimeout(1500);
body = await page.locator('body').innerText();

for (const [what, needle] of [
  ['the course description', 'theological tradition that reads Scripture'],
  ['the outline', 'Week 3  Exodus as paradigm'],
  ['the learning outcomes', 'Trace the use of the Exodus narrative'],
  ['the reading list', 'Black Religion and Black Radicalism'],
  ['a week of material', 'Week 1 notes'],
  ['a lecture recording', 'Week 2 lecture'],
  ['an announcement', 'Seminar moved to Thursday'],
]) {
  if (body.includes(needle)) pass(`${what} is on the course page`);
  else fail(`${what} is missing`);
}

// ---- WEEK-BY-WEEK, WITH THE COURSE'S OWN MATERIAL FIRST -------------------
//
// A reading list filed under week 1 sits below the first lecture, which is the
// last place anybody looks for it.
// MEASURED IN PIXELS, NOT IN STRING POSITIONS. The first version of this
// compared indexOf('The course itself') with indexOf('Week 1') in the page
// text — and failed against a screen that was correct, because the OUTLINE
// begins 'Week 1  The question of context' and appears higher up. The words
// were ambiguous; the y coordinates are not.
const courseBox = await page.locator('h3', { hasText: /^The course itself$/ }).first()
  .boundingBox().catch(() => null);
const weekBox = await page.locator('h3', { hasText: /^Week 1$/ }).first()
  .boundingBox().catch(() => null);
if (courseBox && weekBox && courseBox.y < weekBox.y) {
  pass('what belongs to no week is drawn ABOVE week 1, where a reading list is looked for');
} else if (!courseBox || !weekBox) {
  fail('the week headings could not be found on the page');
} else {
  fail(`the course's own material is drawn below week 1 (y ${courseBox.y} vs ${weekBox.y})`);
}

// ---- THE TERM'S VERSUS THE COURSE'S ---------------------------------------
if (/every term/i.test(body)) {
  pass('material that stands every term is marked as such');
} else {
  fail('nothing distinguishes the course’s own material from this term’s');
}

// ---- AND SOMETHING STILL BEING PREPARED IS NOT SHOWN AS PUBLISHED ---------
//
// A lecturer preparing week 9 in week 2 must be able to keep it back. If the
// screen cannot tell the two apart, they keep it on their own computer, which
// is where it stays when they are ill.
if (/not published/i.test(body)) {
  pass('an unpublished draft is marked, not shown as if students could see it');
} else {
  fail('a withheld material is indistinguishable from a published one');
}

const shot = `${DIR}/lms-course.png`;
await page.screenshot({ path: shot, fullPage: true });
console.log(`\n        ${shot}`);

await browser.close();
console.log(failures === 0
  ? '\nThe LMS is a course, not a file repository.\n'
  : `\n${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
