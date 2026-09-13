// ---------------------------------------------------------------------------
// DOES THE STUDENT WEB ACTUALLY DRAW, AND DOES IT TELL THE TRUTH WHEN THE
// DATABASE IS OUT OF REACH?
//
//   NEXT_PUBLIC_ENABLE_DEMO=true npx next dev -p 3111
//   node scripts/check-student-web.mjs
//
// ---------------------------------------------------------------------------
// WHY THE SECOND HALF OF THAT QUESTION IS THE IMPORTANT ONE
// ---------------------------------------------------------------------------
//
// This sandbox cannot reach the University's Supabase project, so every one of
// these screens is rendering with a FAILED read. That is not a limitation of
// the check — it is the case worth checking hardest, because it is the one the
// portal has got wrong twice before:
//
//   - the calendar screen announced "Today falls in no academic year the
//     calendar covers" when it had simply been unable to reach the database;
//   - the registration screen drew a loading skeleton for ever.
//
// Both said something FALSE about the University rather than something true
// about the network. So what is asserted here is that each student screen
// (a) draws at all, (b) does not claim an empty database, and (c) leaves the
// navigation in place — because a student whose read failed must still be able
// to get to another screen.
// ---------------------------------------------------------------------------

import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:3111';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let failures = 0;
const ok = (m) => console.log(`ok    ${m}`);
const bad = (m, detail) => { failures += 1; console.log(`FAIL  ${m}\n      ${detail}`); };

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(`${BASE}/portal`, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: /Demo Student/i }).click();
await page.waitForSelector('aside[aria-label="Portal navigation"]', { timeout: 20000 });

// ---------------------------------------------------------------------------
// 1. THE RAIL IS THE STUDENT'S OWN, NOT THE REGISTRY'S
// ---------------------------------------------------------------------------
const nav = page.locator('aside[aria-label="Portal navigation"]');
const labels = (await nav.locator('nav button').allInnerTexts())
  .map((t) => t.trim()).filter(Boolean);

console.log(`\nThe rail a student is given\n      ${labels.join(' · ')}\n`);

for (const wanted of ['My programme', 'My timetable', 'My courses', 'Assessments', 'Results',
  'Transcript', 'Graduation', 'Fees & payments', 'My documents', 'Student services',
  'Announcements', 'My profile', 'Academic calendar']) {
  if (labels.some((l) => l.toLowerCase() === wanted.toLowerCase())) ok(`the rail offers "${wanted}"`);
  else bad(`the rail offers "${wanted}"`, `it has: ${labels.join(', ')}`);
}

// THE STAFF-SHAPED ENTRIES ARE GONE. This is the University's actual
// instruction — "should not simply expose the Superadmin Academic modules" —
// and it is the one thing on this screen worth failing a build over.
// 'Academic records' is on this list because it opens a REGISTER of five
// hundred students with a search box over it, and a student was being given it.
for (const unwanted of ['Question papers', 'Programme resources', 'Grade book',
  'Rooms', 'Course offerings', 'Attendance', 'Students', 'Academic records',
  'Result approval', 'Learning (LMS)', 'Fees & receipts']) {
  if (labels.some((l) => l.toLowerCase() === unwanted.toLowerCase())) {
    bad(`a student is not offered "${unwanted}"`, 'it is in the rail');
  } else ok(`a student is not offered "${unwanted}"`);
}

// ---------------------------------------------------------------------------
// 2. EVERY STUDENT SCREEN DRAWS, AND SAYS SOMETHING TRUE
// ---------------------------------------------------------------------------
//
// "Could not be read" is the RIGHT answer here — the database is out of reach.
// What must not appear is a claim about the University: that they have no
// courses, no results, or nothing due.
// ---------------------------------------------------------------------------
// LET THE PORTAL'S OWN READ SETTLE FIRST.
//
// The journey row is read once, when the student arrives. Clicking into a
// screen before that read has finished measures the read, not the screen —
// which is what the first version of this check did, and it reported 'My
// programme' as slow when it was simply waiting for the portal to know who
// the student was.
//
// So the dashboard is given its time here, once, and everything after it is
// measured against a portal that already has the answer.
// ---------------------------------------------------------------------------
//
// WAITING FOR THE RIGHT THING. "Is there any text on the screen" settles
// instantly, because the masthead draws the student's name before the read
// comes back — so the first version of this wait reported 0.0s and then timed
// every screen against a portal that was still loading. What actually says the
// read has finished is the block that depends on it: either the stage's own
// sentence, or the notice that the record could not be read.
{
  const began = Date.now();
  const settledWhen = /could not be read|Waiting on:|Time to register|You are studying|You are enrolled|Your application is with us|Congratulations, graduate|Your record is being looked at/i;
  while (Date.now() - began < 25000) {
    const t = (await page.locator('#portal-main').innerText()).trim();
    if (settledWhen.test(t)) break;
    await page.waitForTimeout(250);
  }
  console.log(`      the portal read the journey in ${((Date.now() - began) / 1000).toFixed(1)}s\n`);
}

const FALSE_WHEN_OFFLINE = [
  /no results yet/i,
  /nothing is timetabled for you yet/i,
  /nothing has been set for you yet/i,
  /no courses/i,
  /no documents yet/i,
  /nothing to tell you/i,
  /you have not asked us for anything yet/i,
  /the calendar has no dates in it yet/i,
  /the university has not recorded any payment/i,
];

// ---- AND THE GROUPS THE UNIVERSITY ASKED FOR, BY NAME ----
const groupTitles = (await nav.locator('nav h2').allInnerTexts())
  .map((t) => t.trim().toLowerCase()).filter(Boolean);
console.log(`\n      groups: ${groupTitles.join(' · ')}\n`);
for (const g of ['my academics', 'learning', 'finance', 'documents', 'services',
  'community', 'profile']) {
  if (groupTitles.includes(g)) ok(`the rail has a "${g}" group`);
  else bad(`the rail has a "${g}" group`, `it has: ${groupTitles.join(', ')}`);
}

for (const screen of ['My programme', 'My timetable', 'Assessments', 'Results',
  'Transcript', 'Graduation', 'Fees & payments', 'My documents', 'Student services',
  'Announcements', 'Academic calendar', 'My profile']) {
  const entry = nav.getByRole('button', { name: screen, exact: true });
  if (await entry.count() === 0) { bad(`${screen} opens`, 'no such entry'); continue; }

  // ---- HOW LONG THE STUDENT LOOKS AT NOTHING --------------------------
  //
  // MEASURED, AND MEASURED FROM THE RIGHT MOMENT — which took three goes.
  //
  // The first version asserted at a fixed 2.5 seconds and reported four
  // correct screens as drawing nothing: they were showing a loading skeleton,
  // which has no text in it.
  //
  // The second waited for "any text in main", and that settles INSTANTLY —
  // because at the moment of the click the previous screen is still on the
  // page. It reported every screen as settling in 0.0s and then checked for a
  // skeleton 2ms later, before React had even swapped the screen.
  //
  // So: remember what was on the page, click, and wait for it to CHANGE.
  const main = page.locator('#portal-main');
  const before = (await main.innerText()).trim();
  await entry.click();

  const began = Date.now();
  let text = '';
  while (Date.now() - began < 25000) {
    text = (await main.innerText()).trim();
    const skeleton = await main.locator('[role="status"]').count();
    if (text !== before && text.length >= 20 && skeleton === 0) break;
    await page.waitForTimeout(250);
  }
  const settled = Date.now() - began;
  console.log(`      ${screen} settled in ${(settled / 1000).toFixed(1)}s`);

  if (text.length < 20) { bad(`${screen} draws something`, `main is ${text.length} chars`); continue; }
  ok(`${screen} draws something`);

  // The rail survives. A failed read that also empties the navigation leaves
  // a student on a dead screen with no way off it.
  const still = await nav.locator('nav button').count();
  if (still >= 5) ok(`${screen} leaves the navigation in place (${still} entries)`);
  else bad(`${screen} leaves the navigation in place`, `${still} entries left`);

  const lie = FALSE_WHEN_OFFLINE.find((re) => re.test(text));
  if (lie) {
    bad(`${screen} does not claim an empty database when the read failed`,
      `it says something matching ${lie}`);
  } else ok(`${screen} does not claim an empty database when the read failed`);

  // AND IT IS NOT A SKELETON FOR EVER. Every one of these screens puts a
  // deadline on its read; one still animating after 25 seconds has not.
  const spinning = await main.locator('[role="status"]').count();
  if (spinning > 0) bad(`${screen} settles`, `still a loading skeleton after ${settled}ms`);
  else ok(`${screen} settles`);

  // THE SCREEN THE PORTAL ALREADY HAS THE ANSWER FOR MUST BE IMMEDIATE.
  // 'My programme' reads the journey from the context, which was loaded when
  // the student signed in — so it has nothing to wait for. If this starts
  // failing, somebody has given it back its own read.
  if (screen === 'My programme') {
    if (settled < 2000) ok('My programme does not re-read what the portal already has');
    else {
      bad('My programme does not re-read what the portal already has',
        `it took ${(settled / 1000).toFixed(1)}s to say anything`);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. THE DASHBOARD LEADS WITH WHERE THEY STAND
// ---------------------------------------------------------------------------
await nav.getByRole('button', { name: 'Dashboard', exact: true }).click();
await page.waitForTimeout(1500);
const dash = (await page.locator('#portal-main').innerText()).trim();
// WHEN THE READ FAILED, the dashboard says so — it does not welcome somebody
// into a portal it cannot describe. Either answer is correct; a blank one is
// not, and neither is a claim about their record.
if (/welcome/i.test(dash)) ok('the dashboard welcomes the student by name');
else if (/could not be read/i.test(dash)) {
  ok('the dashboard says plainly that the record could not be read');
} else bad('the dashboard says something', dash.slice(0, 200));

await page.screenshot({ path: '/tmp/claude-0/student-web.png', fullPage: true });
console.log('\n      screenshot: /tmp/claude-0/student-web.png');

await browser.close();
console.log(failures === 0
  ? '\nThe student web is the student\'s own, and tells the truth when it cannot read.'
  : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
