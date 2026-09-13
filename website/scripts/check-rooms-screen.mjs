// ---------------------------------------------------------------------------
// Does the Rooms screen draw the rooms 064 actually seeds?
//
//   node scripts/check-rooms-screen.mjs [url]
//
// ---------------------------------------------------------------------------
// WHY THE ROWS ARE INTERCEPTED RATHER THAN INVENTED
// ---------------------------------------------------------------------------
//
// The sandbox cannot reach the University's Supabase project, so the screen's
// only observable behaviour there is its failure path — which is worth
// checking, and is checked by check-academic-screens.mjs, and tells us nothing
// at all about whether seventeen rooms render legibly.
//
// So the PostgREST call is intercepted in the browser and answered with the
// rows a real database produced: 064 was applied to the local Postgres harness
// and `rooms` was dumped to JSON. These are not fixtures somebody typed. They
// are the migration's own output, which means this check fails if 064 ever
// seeds something the screen cannot draw.
//
// ---------------------------------------------------------------------------
// WHAT IT ASSERTS, AND WHY EACH ONE
// ---------------------------------------------------------------------------
//
// The University asked for room numbers to be given and then edited. The
// danger in giving them is that a made-up code is indistinguishable from a
// checked one. So the assertions are about whether the screen SAYS SO:
//
//   - the word "Placeholder" appears beside a seeded room;
//   - the standing notice counts them;
//   - a capacity nobody measured reads "Not measured" and never "0";
//   - the rooms are grouped by the campuses the University states, and no
//     fourth campus has crept in.
// ---------------------------------------------------------------------------

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:3213';
const EXE = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOMS = JSON.parse(readFileSync(
  '/tmp/claude-0/-home-user/c9453aaa-aaac-5ac4-afe9-8b9092c06b92/scratchpad/rooms.json', 'utf8',
));

let failures = 0;
const fail = (m) => { failures++; console.error(`  FAIL  ${m}`); };
const pass = (m) => console.log(`  ok    ${m}`);

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

// ---- THE INTERCEPT -------------------------------------------------------
//
// Everything the screen asks the database for is answered here. `rooms` gets
// the migration's own rows; `class_sections` gets an empty list, because no
// class has been placed in any of them yet and that is the true state.
await page.route('**/rest/v1/**', async (route) => {
  const url = route.request().url();
  const body = url.includes('/rooms') ? ROOMS
    : url.includes('/class_sections') ? []
      : [];
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  });
});

await page.goto(`${base}/portal`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
const demo = page.locator('button', { hasText: /Demo Admin/i }).first();
if (await demo.count()) { await demo.click(); await page.waitForTimeout(2500); }

const link = page.getByRole('button', { name: 'Rooms', exact: false }).first();
if (await link.count() === 0) {
  fail('no way into Rooms from the sidebar');
} else {
  await link.click();
  await page.waitForTimeout(2500);
}

const body = await page.locator('body').innerText();

// ---- IT DREW THE ROOMS ---------------------------------------------------
for (const code of ['BU-101', 'BU-LH1', 'BU-LAB1', 'DL-101', 'DL-LH1', 'ONLINE-1']) {
  if (body.includes(code)) pass(`${code} is on the page`);
  else fail(`${code} is not on the page`);
}

// ---- AND SAID THEY ARE PLACEHOLDERS --------------------------------------
const placeholders = (body.match(/Placeholder/g) ?? []).length;
if (placeholders >= ROOMS.length) {
  pass(`every one of the ${ROOMS.length} seeded rooms is labelled a placeholder`);
} else {
  fail(`only ${placeholders} of ${ROOMS.length} rooms carry the placeholder label`);
}

if (/17 of these rooms are placeholders/i.test(body)) {
  pass('and the standing notice counts them, at the top, before the table');
} else {
  fail('the standing notice does not count the placeholders');
}

// ---- A CAPACITY NOBODY MEASURED IS NOT ZERO ------------------------------
//
// THE ASSERTION THAT MATTERS MOST HERE. `capacity` is null on every seeded
// room, and a screen printing null as 0 would say the University's rooms hold
// nobody — which is both false and the kind of thing a scheduler acts on.
if (body.includes('Not measured')) {
  pass('an unmeasured capacity reads "Not measured"');
} else {
  fail('an unmeasured capacity is not labelled');
}
const zeroCells = await page.locator('td', { hasText: /^0$/ }).count();
const classCells = ROOMS.length; // the "Classes" column is legitimately 0
if (zeroCells <= classCells) {
  pass('…and no capacity is printed as 0');
} else {
  fail(`${zeroCells} cells read "0" — more than the ${classCells} class counts, so a capacity is being printed as zero`);
}

// ---- THE CAMPUSES ARE THE UNIVERSITY'S OWN -------------------------------
for (const campus of ['Buea', 'Douala', 'Online']) {
  if (body.includes(campus)) pass(`${campus} is a heading`);
  else fail(`${campus} is missing`);
}
// PROVE IT BY LOOKING FOR WHAT MUST NOT BE THERE. A seed that quietly
// introduced a fourth campus would be inventing an institutional fact.
const invented = ['Yaoundé', 'Yaounde', 'Lagos', 'Bamenda', 'Limbe', 'Kumba']
  .filter((c) => body.includes(c));
if (invented.length === 0) pass('and no campus the University has not stated appears');
else fail(`a campus the University has not stated is on the page: ${invented.join(', ')}`);

// ---- AND THE EDIT DIALOG IS THE THING THAT CONFIRMS A ROOM ---------------
//
// The whole design rests on this: there is no separate "yes, this room is
// real" button, because a button like that is one more thing to forget. So the
// dialog has to SAY that saving is what clears the label — otherwise the
// mechanism is invisible and somebody builds the forgettable button later.
const shot = '/tmp/claude-0/-home-user/c9453aaa-aaac-5ac4-afe9-8b9092c06b92/scratchpad/rooms-populated.png';
await page.screenshot({ path: shot, fullPage: true });
console.log(`\n        ${shot}`);

await page.getByRole('button', { name: 'Edit BU-101' }).click();
await page.waitForTimeout(600);
const dialog = await page.locator('[role="dialog"]').innerText().catch(() => '');
if (/Saving marks it as checked/i.test(dialog)) {
  pass('the edit dialog says that saving is what clears the placeholder label');
} else {
  fail('the edit dialog does not say how a placeholder stops being one');
}
if (/blank means not recorded, not zero/i.test(dialog)) {
  pass('…and that a blank capacity means not recorded, not zero');
} else {
  fail('the capacity field does not say what blank means');
}
const editShot = '/tmp/claude-0/-home-user/c9453aaa-aaac-5ac4-afe9-8b9092c06b92/scratchpad/rooms-edit.png';
await page.screenshot({ path: editShot });
console.log(`        ${editShot}`);

await browser.close();
console.log(failures === 0
  ? '\nThe Rooms screen draws what 064 seeds, and says what it is.\n'
  : `\n${failures} failed.\n`);
process.exit(failures === 0 ? 0 : 1);
