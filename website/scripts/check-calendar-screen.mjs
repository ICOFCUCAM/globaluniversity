// ---------------------------------------------------------------------------
// Does the Academic Calendar screen show the 2027 fault before it happens?
//
//   node scripts/check-calendar-screen.mjs [url]
//
// ---------------------------------------------------------------------------
// WHAT IS BEING CHECKED, AND WHY IT NEEDS A BROWSER
// ---------------------------------------------------------------------------
//
// 059 set every academic year's status ONCE, with current_date, on the day the
// migration ran — under a comment saying the date decides it. On 15 August 2027
// the column would still have said 2026/2027, and three screens would have
// opened on last year in silence.
//
// 065's fix is a view that derives the year from the dates and a report that
// names any year whose stored status has drifted. Whether that fix WORKS is
// proved in SQL, in the migration, against Postgres.
//
// What SQL cannot prove is whether a person looking at the screen would notice.
// That is what this checks, and it checks it twice:
//
//   THE CALENDAR IN STEP — the screen says which year today is in, and states
//   plainly that nothing is out of step.
//
//   THE CALENDAR OUT OF STEP — the 2027 fault, performed: the rows are served
//   with 2026/2027 still marked current while the dates put today in
//   2027/2028. The screen must say so loudly and offer the button that fixes
//   it. A quiet screen here is the whole bug.
// ---------------------------------------------------------------------------

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:3214';
const EXE = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const DIR = '/tmp/claude-0/-home-user/c9453aaa-aaac-5ac4-afe9-8b9092c06b92/scratchpad';

const YEARS = JSON.parse(readFileSync(`${DIR}/years.json`, 'utf8'));
const TERMS = JSON.parse(readFileSync(`${DIR}/terms.json`, 'utf8'));
const NOW = JSON.parse(readFileSync(`${DIR}/year-now.json`, 'utf8'));

let failures = 0;
const fail = (m) => { failures++; console.error(`  FAIL  ${m}`); };
const pass = (m) => console.log(`  ok    ${m}`);

/**
 * The drift report, computed the way the database computes it, over whatever
 * rows are being served. Written here rather than hard-coded so the out-of-step
 * scenario cannot accidentally agree with itself.
 */
const driftOver = (years, today) => years
  .map((y) => ({
    ...y,
    should_be: today >= y.starts_on && today <= y.ends_on ? 'current'
      : y.ends_on < today ? 'closed' : 'planning',
  }))
  .filter((y) => y.status !== y.should_be);

async function open(scenario, rows, nowRows, shot) {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

  await page.route('**/rest/v1/**', async (route) => {
    const url = route.request().url();
    let payload;
    if (url.includes('/academic_year_now')) payload = nowRows[0] ?? null;
    else if (url.includes('/academic_year_drift')) payload = rows.drift;
    else if (url.includes('/academic_years')) payload = rows.years;
    else if (url.includes('/academic_terms')) payload = TERMS;
    else payload = [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(payload),
    });
  });

  await page.goto(`${base}/portal`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const demo = page.locator('button', { hasText: /Demo Admin/i }).first();
  if (await demo.count()) { await demo.click(); await page.waitForTimeout(2500); }

  const link = page.getByRole('button', { name: 'Academic calendar', exact: false }).first();
  if (await link.count() === 0) {
    fail('no way into the Academic calendar from the sidebar');
    await browser.close();
    return '';
  }
  pass(`'Academic calendar' has a way into it from the sidebar (${scenario})`);
  await link.click();
  await page.waitForTimeout(2500);

  const body = await page.locator('body').innerText();
  await page.screenshot({ path: shot, fullPage: true });
  console.log(`        ${shot}`);
  await browser.close();
  return body;
}

// =========================================================================
// ONE — the calendar as it actually is today
// =========================================================================
console.log('\nThe calendar in step\n');

const today = new Date().toISOString().slice(0, 10);
const inStep = { years: YEARS, drift: driftOver(YEARS, today) };
const bodyA = await open('in step', inStep, NOW, `${DIR}/calendar-in-step.png`);

if (/Today is in/i.test(bodyA) && bodyA.includes(NOW[0].label)) {
  pass(`it names the year today is in — ${NOW[0].label}`);
} else {
  fail('it does not name the year today is in');
}
if (/cannot go stale|worked out from the dates/i.test(bodyA)) {
  pass('and says the answer is derived from the dates rather than stored');
} else {
  fail('it does not say where the answer comes from');
}
if (/Nothing is out of step/i.test(bodyA)) {
  pass('and states plainly that nothing has drifted');
} else {
  fail('a calendar in step does not say so');
}

// =========================================================================
// TWO — THE 2027 FAULT, PERFORMED
// =========================================================================
//
// PROVE A GUARD BY BREAKING IT. The rows are rewritten so that today falls in
// 2027/2028 while 2026/2027 is still stored as current — exactly the state
// 059's one-shot UPDATE would have left behind. If the screen is quiet about
// this, the fix does not work where it matters, which is in front of a person.
console.log('\nThe 2027 fault, performed\n');

const LATER = '2027-09-01';
const stale = YEARS.map((y) => ({
  ...y,
  // The stored statuses as 059 left them on the day it ran.
  status: y.starts_in === 2026 ? 'current' : y.starts_in < 2026 ? 'closed' : 'planning',
}));
const nowLater = stale.filter((y) => LATER >= y.starts_on && LATER <= y.ends_on);
const outOfStep = { years: stale, drift: driftOver(stale, LATER) };

if (nowLater.length !== 1 || nowLater[0].label !== '2027/2028') {
  fail(`the scenario is wrong: ${LATER} should fall in 2027/2028`);
}
if (outOfStep.drift.length < 2) {
  fail(`the scenario is wrong: expected at least 2 drifted years, built ${outOfStep.drift.length}`);
} else {
  pass(`the scenario has ${outOfStep.drift.length} drifted years, as the real fault would`);
}

const bodyB = await open('out of step', outOfStep, nowLater, `${DIR}/calendar-out-of-step.png`);

if (/out of step with the calendar/i.test(bodyB)) {
  pass('the screen says the calendar is out of step');
} else {
  fail('the screen is SILENT about a stale year — this is the whole bug');
}
if (bodyB.includes('2026/2027') && /recorded as/i.test(bodyB)) {
  pass('and names the year that is wrong, and what it is recorded as');
} else {
  fail('it does not name which year is wrong');
}
if (/Roll the year over/i.test(bodyB)) {
  pass('and offers the button that puts it back in step');
} else {
  fail('there is no way to fix it from the screen');
}
// AND THE DERIVED ANSWER IS UNMOVED BY THE STALE COLUMN. This is the
// assertion that matters most: the screens must open on 2027/2028 even while
// the stored record still says 2026/2027.
// CASE-INSENSITIVE, because innerText applies text-transform: the heading is
// written "Today is in" and rendered "TODAY IS IN". The first version of this
// assertion failed against a screen that was correct, which is the kind of
// false alarm that gets a check deleted rather than fixed.
if (/Today is in[\s\S]{0,80}2027\/2028/i.test(bodyB)) {
  pass('…and the year today is in still reads 2027/2028, not the stale stored value');
} else {
  fail('the screen followed the stored status instead of the calendar');
}

console.log('');
console.log(failures === 0
  ? 'The calendar shows the 2027 fault years before it would have bitten.\n'
  : `${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
