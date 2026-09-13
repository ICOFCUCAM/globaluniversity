// ---------------------------------------------------------------------------
// CAN SOMEBODY ACTUALLY TYPE INTO THE APPOINTMENT FORM?
//
// The University: "immediately I type a letter the cursor goes off and the
// window cannot input character why".
//
// `Field` was declared INSIDE the form component, so React re-created it on
// every render, threw away the <input> and built a new one — the character was
// kept in state, the focused element was gone. One letter per click.
//
// READING THE SOURCE FINDS NOTHING, because the JSX is correct; the fault is
// where the declaration sits. So this types eleven characters into a real
// browser and reads back what the box holds.
//
//   npx next dev -p 3113            (NEXT_PUBLIC_ENABLE_DEMO=true)
//   node scripts/check-typing.mjs
//
// Expect: {"value":"Mabel Nkeng","keptFocus":true,"ok":true}
// The bug reads: {"value":"M","keptFocus":false,"ok":false}
//
// `src/lib/noNestedComponents.test.mjs` is the version that runs in `npm test`
// and needs no server; this is the one that proves the symptom is really gone.
// ---------------------------------------------------------------------------

import { chromium } from 'playwright';

const EXE = process.env.CHROME
  ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.BASE ?? 'http://127.0.0.1:3113';
const TEXT = 'Mabel Nkeng';

const b = await chromium.launch({ executablePath: EXE });
const p = await b.newPage();

await p.goto(`${BASE}/portal`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3000);
await p.getByRole('button', { name: /Demo Admin/i }).first().click();
await p.waitForTimeout(3000);
await p.getByText('Draft & submit', { exact: false }).first().click();
await p.waitForTimeout(2000);
await p.getByRole('button', { name: /New appointment/i }).first().click();
await p.waitForTimeout(2500);

const box = p.locator('#a-name');
await box.click();
await box.type(TEXT, { delay: 70 });

const value = await box.inputValue();
const keptFocus = await box.evaluate((el) => el === document.activeElement);
const ok = value === TEXT && keptFocus;

console.log(JSON.stringify({ typed: TEXT, value, keptFocus, ok }));
await b.close();
process.exit(ok ? 0 : 1);
