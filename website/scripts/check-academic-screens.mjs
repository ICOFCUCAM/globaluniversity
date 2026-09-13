// ---------------------------------------------------------------------------
// Do the new academic screens actually draw?
//
//   node scripts/check-academic-screens.mjs [url]
//
// WHAT THIS CATCHES, and why reading the source would not have.
//
// Every one of these screens reads a database. The sandbox cannot reach the
// University's Supabase project, so every read HANGS — it does not fail, which
// is a different thing and the reason the first version of the Programme
// Register drew its loading skeleton forever. `within()` puts a deadline on
// the read; this asserts the deadline is actually reached and the screen says
// something rather than spinning.
//
// So the pass condition is NOT "the data arrived". It is: the screen renders
// its own heading, and within twenty seconds it is either showing data or
// saying plainly that it could not be read. A skeleton still on the page after
// that is the bug.
//
// Needs a running dev server, so it is not part of `npm test` — that suite is
// pure Node and must stay runnable without a build.
// ---------------------------------------------------------------------------

import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:3211';
const EXE = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let failures = 0;
const fail = (m) => { failures++; console.error(`  FAIL  ${m}`); };
const pass = (m) => console.log(`  ok    ${m}`);

const SCREENS = [
  { view: 'academic-overview', nav: 'Academic overview', heading: 'Academic overview' },
  { view: 'course-offerings', nav: 'Course offerings', heading: 'Course offerings' },
  { view: 'rooms', nav: 'Rooms', heading: 'Rooms' },
  { view: 'timetable', nav: 'Timetable', heading: 'Timetable' },
  { view: 'course-registration', nav: 'Course registration', heading: 'Course registration' },
];

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

// Demo mode signs in from the login screen's demo buttons. 'Demo Admin' is the
// one that holds `manage-courses`, which is what three of these four need to
// show anything but a refusal.
await page.goto(`${base}/portal`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
const demo = page.locator('button', { hasText: /Demo Admin/i }).first();
if (await demo.count()) {
  await demo.click();
  await page.waitForTimeout(3000);
} else {
  console.log('  note  no demo sign-in found; continuing as whoever is signed in');
}

for (const s of SCREENS) {
  console.log(`\n${s.heading}\n`);

  // REACHED THE WAY A READER REACHES IT: by clicking the sidebar entry. A
  // screen that renders when mounted directly but has no way in is exactly
  // what reachability.test.mjs keeps finding, so this walks in through the
  // door rather than around it.
  const link = page.getByRole('button', { name: s.nav, exact: false })
    .or(page.getByRole('link', { name: s.nav, exact: false })).first();
  if (await link.count()) {
    pass(`'${s.nav}' has a way into it from the sidebar`);
    await link.click().catch(() => {});
  } else {
    fail(`no way into '${s.view}' from the sidebar`);
    continue;
  }

  await page.waitForTimeout(1000);

  const headingSeen = await page.getByText(s.heading, { exact: false }).first()
    .isVisible().catch(() => false);
  if (headingSeen) pass('the screen renders its heading');
  else fail(`'${s.heading}' never appeared`);

  // -----------------------------------------------------------------------
  // THE DEADLINE — and the condition it is measured against, which is the
  // part the first version of this script got wrong.
  //
  // It accepted any recognisable sentence as "settled", and 'No academic
  // years recorded' is on the page from the first paint because the year
  // picker renders its empty case before the calendar has answered. So the
  // check passed on a screen that was still drawing a skeleton, and the
  // screenshot proved it.
  //
  // A LOADING STATE IS THE THING BEING TESTED FOR, so it cannot also be the
  // proof. The only pass condition is: NO skeleton is left on the page.
  // Twenty-five seconds is `within()`'s fifteen plus the second read plus
  // slack.
  // -----------------------------------------------------------------------
  //
  // AND A LOADING STATE SPELLED IN WORDS IS STILL A LOADING STATE. The second
  // version of this counted only skeletons and passed the registration screen
  // while it read 'Reading the calendar…' — which it would have gone on
  // reading forever, because that particular read had no deadline on it. The
  // screenshot showed it; the assertion did not.
  const STILL_LOADING = /Reading the calendar|Reading the catalogue/i;

  let settled = false;
  for (let i = 0; i < 25; i += 1) {
    const stillSkeleton = await page.locator('.animate-pulse').count().catch(() => 1);
    const words = await page.locator('body').innerText().catch(() => 'Reading the calendar');
    if (stillSkeleton === 0 && !STILL_LOADING.test(words)) { settled = true; break; }
    await page.waitForTimeout(1000);
  }
  if (settled) pass('no loading state is left on the page — it settles rather than spinning');
  else fail('still drawing a skeleton after 25 seconds');

  // AND IT SAYS SOMETHING. A blank page with no skeleton has also "settled".
  const body = await page.locator('body').innerText().catch(() => '');
  const saidSomething = /could not be read|Nothing is offered|Nothing is timetabled|Nothing needs attention|No academic years recorded|did not answer within|no courses in the catalogue|Choose a student|not linked to a student record|needs attention|No rooms are recorded|placeholder/i
    .test(body);
  if (saidSomething) pass('and it tells the reader what it found, or that it could not look');
  else fail('it settled into saying nothing at all');

  const shot = `/tmp/claude-0/-home-user/c9453aaa-aaac-5ac4-afe9-8b9092c06b92/scratchpad/${s.view}.png`;
  await page.screenshot({ path: shot, fullPage: true });
  console.log(`        ${shot}`);
}

console.log('');
if (errors.length > 0) {
  for (const e of errors.slice(0, 6)) fail(`uncaught in the page: ${e.slice(0, 200)}`);
} else {
  pass('no uncaught error in any of them');
}

await browser.close();
console.log(failures === 0
  ? '\nEvery new academic screen draws and settles.\n'
  : `\n${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
