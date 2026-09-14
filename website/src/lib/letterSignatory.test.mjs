// ---------------------------------------------------------------------------
// WHO SIGNED THE LETTER, AND IN WHAT OFFICE.
//
// Run with:  node src/lib/letterSignatory.test.mjs
//
// ---------------------------------------------------------------------------
// WHAT THIS GUARDS
// ---------------------------------------------------------------------------
//
// The University issued an appointment letter. Above the signature rule it said
// BY AUTHORITY OF THE VICE-CHANCELLOR, and beneath the rule it said:
//
//     vc@iguc.net
//     Registrar
//
// Three faults in four lines, and every one of them was a fallback written into
// the letter route rather than anything the University had recorded.
//
//   1. AN EMAIL ADDRESS IS NOT A NAME. The last resort was `caller.email` while
//      `caller.fullName` — the signer's actual name, loaded on every request by
//      the guard — was never consulted. This letter is shown to a bank, an
//      embassy and a ministry.
//
//   2. 'Registrar' WAS HARD-CODED as the office. It was printed beneath the
//      Vice-Chancellor's own signature, so the document stated an office its
//      signer does not hold. The caller's role says what office they hold.
//
//   3. AND THE RULE WAS EMPTY, because no specimen signature had ever been
//      switched on — see `admin/signature enable`, which had no screen until
//      now. That half is guarded by routeActions.test.mjs; this file guards the
//      two lines of text.
//
// THE REFUSAL IS THE POINT. Where the University has recorded neither a name
// nor an office for the signer, the letter is refused rather than issued with a
// blank or an address in it. An unsigned letter of appointment that looks
// signed is worse than no letter.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;
const check = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`ok    ${label}`);
  } else {
    failures++;
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
  }
};

const here = new URL('.', import.meta.url).pathname;

// COMMENTS STRIPPED FIRST, ALWAYS. The route's comments quote the very strings
// being searched for — "vc@iguc.net", "Registrar" — so a check that read the
// raw file would fail on the explanation of the fix. This suite has been caught
// by that more than once.
const decomment = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

const route = decomment(
  readFileSync(join(here, '../app/api/appointments/letter/route.ts'), 'utf8'));

console.log('\nA letter of appointment names the person who signed it\n');

// --- The name -------------------------------------------------------------
check('the signatory name falls back to the caller’s recorded name',
  /signatoryName[\s\S]{0,160}caller\.fullName/.test(route), true);

check('…and never to their email address',
  /signatoryName[\s\S]{0,160}caller\.email/.test(route), false);

// Belt and braces: the whole route must not reach for the email when deciding
// what to print, wherever that code eventually moves to.
check('…nowhere in the route does an email become a signatory',
  /signator(y|y_)[a-z_]*[^\n]*caller\.email/i.test(route), false);

// --- The office -----------------------------------------------------------
check('the office comes from the caller’s role',
  /signatoryRole[\s\S]{0,160}roleLabels\[caller\.role\]/.test(route), true);

check('…and is not hard-coded to Registrar',
  /signatoryRole[\s\S]{0,160}'Registrar'/.test(route), false);

// --- And the letter is refused rather than signed by nobody ---------------
check('a letter with no name for the signer is refused',
  /if \(!signatoryName \|\| signatoryName\.includes\('@'\)\)/.test(route), true);

check('…and one with no office is refused too',
  /if \(!signatoryRole\)/.test(route), true);

check('…with a refusal that says what to do about it',
  /Record your full name on your account/.test(route), true);

// --- ONE RESOLUTION, USED BY BOTH THE DOCUMENT AND THE RECORD -------------
//
// The letter row stores `signatory_name` and `signatory_role` so the register
// can say who signed a letter years later. They were computed by a second copy
// of the same expression — so a fix to one would have left the other printing
// an email address into the permanent record.
check('the archived row and the document use the same resolved name',
  /signatory_name: signatoryName/.test(route), true);
check('…and the same resolved office',
  /signatory_role: signatoryRole/.test(route), true);

console.log('\nAnd a stored signature can actually be switched on\n');

// --- The other half: the specimen ------------------------------------------
//
// 049 requires a second pair of eyes, and for as long as nothing called
// `enable` there was no second pair of eyes anywhere — so every specimen
// stayed off and every letter printed an empty rule.
const signature = decomment(
  readFileSync(join(here, '../app/api/admin/signature/route.ts'), 'utf8'));
const screen = decomment(
  readFileSync(join(here, '../components/settings/SignatureSpecimen.tsx'), 'utf8'));

check('the route can list whose specimens exist', /action === 'list'/.test(signature), true);
check('…but never hands back the image',
  /action === 'list'[\s\S]{0,700}\bimage\b/.test(signature), false);

check('a screen sends enable', /action: 'enable'|action,\s*$/m.test(screen)
  && /'enable' \| 'revoke'/.test(screen), true);
check('…and sends revoke', /'enable' \| 'revoke'/.test(screen), true);
check('…and asks for the authority before it will',
  /MIN_AUTHORITY/.test(screen), true);

// STILL NOT YOUR OWN. The screen must not offer a control 049 refuses.
check('the screen refuses to offer you your own',
  /isMine \?/.test(screen), true);

console.log(failures ? `\n${failures} check(s) failed.\n` : '\nAll signatory checks passed.\n');
process.exit(failures ? 1 : 0);
