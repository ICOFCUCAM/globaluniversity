// ---------------------------------------------------------------------------
// Does the Graduation screen tell the truth about what it cannot establish?
//
//   node scripts/check-graduation-screen.mjs [url]
//
// ---------------------------------------------------------------------------
// WHY THIS ONE MATTERS MORE THAN MOST
// ---------------------------------------------------------------------------
//
// A degree is the most consequential thing this system records, and the fee
// check CANNOT BE MADE: the University keeps no per-student fee schedule here,
// so `assessGraduation` reports fees as UNKNOWN for everybody, always.
//
// A screen that quietly showed a green tick anyway would be the single place a
// degree slips through on an unpaid account — and it would look exactly like a
// working screen. So the check below is not "does it load": it is whether the
// undetermined check is VISIBLE, and whether a candidate who does not qualify
// is shown as not qualifying.
//
// The rows are the database's: 069 applied to the harness, then two candidates
// built on it — one who has passed everything, one six credits short with a
// CGPA below the award's minimum.
// ---------------------------------------------------------------------------

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:3219';
const EXE = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const DIR = '/tmp/claude-0/-home-user/c9453aaa-aaac-5ac4-afe9-8b9092c06b92/scratchpad';
const CANDIDATES = JSON.parse(readFileSync(`${DIR}/candidates.json`, 'utf8'));

let failures = 0;
const fail = (m) => { failures++; console.error(`  FAIL  ${m}`); };
const pass = (m) => console.log(`  ok    ${m}`);

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1440, height: 1300 } });

await page.route('**/rest/v1/**', async (route) => {
  const url = route.request().url();
  await route.fulfill({
    status: 200, contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(url.includes('/graduation_candidate') ? CANDIDATES : []),
  });
});

await page.goto(`${base}/portal`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
const demo = page.locator('button', { hasText: /Demo Admin/i }).first();
if (await demo.count()) { await demo.click(); await page.waitForTimeout(2500); }

const link = page.getByRole('button', { name: /Graduation & awards/i }).first();
if (await link.count() === 0) {
  fail('no way into Graduation & awards from the sidebar');
} else {
  pass("'Graduation & awards' has a way into it from the sidebar");
  await link.click();
  await page.waitForTimeout(2000);
}

let body = await page.locator('body').innerText();

// ---- THE STANDING NOTICE, ABOVE EVERY VERDICT ----------------------------
if (/The Senate confers/i.test(body)) {
  pass('the screen states that it establishes qualification and the Senate confers');
} else {
  fail('the screen does not say who actually confers');
}
if (/fee position cannot be established/i.test(body)) {
  pass('…and that the fee position cannot be established here');
} else {
  fail('the screen does not disclose that the fee check cannot be made — this is the whole risk');
}

// ---- BOTH CANDIDATES ------------------------------------------------------
for (const c of CANDIDATES) {
  if (body.includes(c.full_name)) pass(`${c.full_name} is on the list`);
  else fail(`${c.full_name} is missing`);
}

// ---- THE ONE WHO HAS FINISHED --------------------------------------------
await page.getByRole('button', { name: /Grace Ndeh/ }).first().click();
await page.waitForTimeout(800);
body = await page.locator('body').innerText();

if (/24 earned/.test(body)) pass('credits are read against the award requirement');
else fail('the credits check does not show what was earned');
// THE ASSERTION THAT MATTERS MOST. Everything academic is met, and the screen
// must STILL not claim the candidate qualifies outright.
if (/Cannot be determined/i.test(body) && /fees/i.test(body)) {
  pass('a candidate who has met every academic requirement still reads as UNDETERMINED on fees');
} else {
  fail('a candidate with everything passed is shown as qualifying — the fee check was not made');
}
if (/finance office/i.test(body.toLowerCase()) || /Check with the Finance Office/i.test(body)) {
  pass('…and the screen says where the fee position has to be confirmed');
} else {
  fail('nothing says where to confirm the fee position');
}

// ---- AND THE ONE WHO HAS NOT ---------------------------------------------
await page.getByRole('button', { name: /Grace Ndeh/ }).first().click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: /Samuel Tabe/ }).first().click();
await page.waitForTimeout(800);
body = await page.locator('body').innerText();

if (/6 credits short/i.test(body)) {
  pass('a candidate six credits short is told exactly how short');
} else {
  fail('the shortfall is not stated');
}
if (/Below the minimum for this award/i.test(body)) {
  pass('and a CGPA below the award minimum is refused in words');
} else {
  fail('a CGPA below the minimum is not called out');
}
if (/Does not qualify/i.test(body)) {
  pass('…and the summary says plainly that they do not qualify');
} else {
  fail('the summary does not say the candidate does not qualify');
}

// ---- THE CONFERRAL FORM DEMANDS THE SENATE'S DATE ------------------------
await page.getByRole('button', { name: /^Record a conferral$/ }).first().click();
await page.waitForTimeout(600);
body = await page.locator('body').innerText();
if (/The Senate resolved on/i.test(body)) {
  pass('the conferral form asks for the day the Senate resolved, first');
} else {
  fail('the form does not ask for the Senate resolution date');
}
// ASSERTED ON THE ELEMENT, NOT ON THE PAGE TEXT. The first version of this
// looked for the prompt in innerText and failed against a correct screen: the
// prompt is a textarea PLACEHOLDER, and a placeholder is not text content.
const reasonBox = page.getByRole('textbox', {
  name: /Reason for conferring despite an unmet requirement/i,
}).first();
if (await reasonBox.count() && await reasonBox.isVisible()) {
  pass('and a candidate who does not qualify cannot be conferred without a recorded reason');
} else {
  fail('a conferral over an unmet requirement is not asking for a reason');
}
if (/does not meet 2 requirements/i.test(body)) {
  pass('…with both unmet requirements named in the form itself');
} else {
  fail('the form does not name what is unmet');
}
const confer = page.getByRole('button', { name: /^Record the conferral$/ }).first();
if (await confer.isDisabled()) {
  pass('…and the button is refused until that reason and the dates are given');
} else {
  fail('the conferral button is live with no Senate date and no reason');
}

const shot = `${DIR}/graduation.png`;
await page.screenshot({ path: shot, fullPage: true });
console.log(`\n        ${shot}`);

await browser.close();
console.log(failures === 0
  ? '\nThe register says what it knows, and says what it does not.\n'
  : `\n${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
