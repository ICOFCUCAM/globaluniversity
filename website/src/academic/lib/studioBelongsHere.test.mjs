// ---------------------------------------------------------------------------
// THE ACADEMIC STUDIO LOOKS LIKE PART OF THE UNIVERSITY, NOT LIKE A GUEST.
//
// Run with:  node src/academic/lib/studioBelongsHere.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS IS A TEST AND NOT A STYLE PREFERENCE
// ---------------------------------------------------------------------------
//
// The University, 16 September 2026:
//
//     "opening the studio make one feel it is another site with different
//      names. can you make it follow the same feelings like the others."
//
// Three separate things caused that, and each one can come back on its own —
// a palette edited, a heading retyped, a nav entry restored — with nothing
// failing and nobody noticing until somebody opens it and feels lost again.
//
//   1. IT WORE ANOTHER PRODUCT'S COLOURS. Its own blue, because it used to be
//      its own repository.
//   2. IT CALLED ITSELF SOMETHING ELSE. "Lecture Studio" in the sidebar, while
//      the portal's own menu said "Academic Studio" — two names for one place
//      is the fault this whole integration keeps closing.
//   3. THERE WAS NO WAY BACK. The Studio is real routes, so entering it
//      replaces the portal's sidebar — and without a link home the only way
//      out was the browser's back button. That is most of what "another site"
//      means: not the colours, the fact that you cannot get home.
//
// ---------------------------------------------------------------------------
// AND THE FOURTH THING, WHICH IS NOT DECORATION
// ---------------------------------------------------------------------------
//
//     "students don't make lectures. so some sections would not even be
//      display to the student account."
//
// A student offered the submission screen is not a security problem —
// `ownership.ts` refuses them every act on a lecture and 092 refuses them in
// the database. It is a comprehension problem: every click ends in a refusal,
// and the person concludes they have misunderstood the system rather than that
// the system is showing them a door that is not theirs.
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

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');
const read = (...p) => readFileSync(join(root, ...p), 'utf8');

console.log('\nThe Studio wears the University’s colours\n');

const css = read('src', 'academic', 'studio.css');
const tailwind = read('tailwind.config.ts');

// THE UNIVERSITY'S PURPLE, READ OUT OF ITS OWN CONFIG rather than typed here.
// A copy of a hex value is a second place for it to be wrong.
const purple = /purple:\s*'#([0-9a-f]{6})'/i.exec(tailwind)?.[1];
const purpleDark = /'purple-dark':\s*'#([0-9a-f]{6})'/i.exec(tailwind)?.[1];
check('the University declares a brand purple', Boolean(purple && purpleDark), true);

const rgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');

// The `:root` block only — the high-contrast block below it overrides these
// on purpose, for anybody who needs it, and must not be read as the default.
const rootBlock = /:root\s*\{[\s\S]*?\n\}/.exec(css)?.[0] ?? '';
check('the Studio’s brand IS the University’s purple',
  new RegExp(`--brand:\\s*${rgb(purple)};`).test(rootBlock), true);
check('…and its dark brand is the University’s dark purple',
  new RegExp(`--brand-dark:\\s*${rgb(purpleDark)};`).test(rootBlock), true);

// AND THE BLUE IT ARRIVED WITH IS GONE. Checked by name, because a palette
// half-changed reads as a bug rather than a decision.
check('the blue it arrived with is gone', /--brand:\s*31 77 122/.test(css), false);

// HIGH CONTRAST STILL OVERRIDES. Somebody who needs it must not lose it
// because the default palette moved.
check('high contrast still sets its own brand',
  /data-contrast='high'[\s\S]{0,400}--brand:/.test(css), true);

console.log('\nAnd calls itself what the portal calls it\n');

const shell = read('src', 'academic', 'components', 'AppShell.tsx');
const nav = read('src', 'lib', 'portalNav.tsx');

const portalLabel = /label: 'Academic Studio'/.test(nav);
check('the portal’s menu says Academic Studio', portalLabel, true);
check('…and so does the Studio’s own sidebar', /Academic Studio/.test(shell), true);
check('…and the old product name is gone from the chrome',
  /Lecture Studio/.test(shell), false);

// THE WAY HOME. The single largest cause of "this is another site".
check('there is a way back to the portal', /Back to the portal/.test(shell), true);
check('…and it points at the portal', /href="\/portal"/.test(shell), true);

// THE PORTAL'S OWN SIDEBAR TREATMENT: dark purple ground, gold on the active
// row. Read out of the portal's Sidebar rather than asserted from memory.
const sidebar = read('src', 'components', 'Sidebar.tsx');
const activeGold = /text-\[#e9c14a\]/.test(sidebar);
check('the portal marks the active row in gold', activeGold, true);
check('…and the Studio marks it the same way', /text-\[#e9c14a\]/.test(shell), true);

console.log('\nA student is not shown a room that is not theirs\n');

// `] as const;` IS THE TERMINATOR, not `];`. The first version looked for the
// latter, ran straight past the end of NAV, swallowed TEACHING_NAV with it and
// reported submission as offered to everybody while the code had just stopped
// offering it. A pattern that reads two arrays as one measures neither.
const everybodyNav = /const NAV = \[[\s\S]*?\] as const;/.exec(shell)?.[0] ?? '';
check('the list everybody gets was found', everybodyNav.length > 40, true);
check('submission is not in the list everybody gets',
  everybodyNav.includes('nav.lectures'), false);
check('…it is in the teaching list', /TEACHING_NAV[\s\S]{0,200}nav\.lectures/.test(shell), true);
check('…and a student is given none of it',
  /actor\.role === 'student' \? \[\] : TEACHING_NAV/.test(shell), true);

// AND WHAT A STUDENT DOES GET IS STILL THERE. A ruling that left a student
// with nothing would have been read as an outage, not a tidy-up.
for (const key of ['nav.courses', 'nav.notifications', 'nav.profile']) {
  check(`…while '${key}' is still offered to everybody`, everybodyNav.includes(key), true);
}

console.log(failures ? `\n${failures} check(s) failed.\n` : '\nIt looks like part of the University.\n');
process.exit(failures ? 1 : 0);
