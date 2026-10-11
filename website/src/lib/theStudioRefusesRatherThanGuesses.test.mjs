// ---------------------------------------------------------------------------
// THE ACADEMIC STUDIO REFUSES RATHER THAN GUESSES WHO YOU ARE.
//
// Run with:  node src/lib/theStudioRefusesRatherThanGuesses.test.mjs
//
// ---------------------------------------------------------------------------
// WHAT WAS THERE
// ---------------------------------------------------------------------------
//
// `src/academic` is a platform that was built to mount inside somebody else's
// university, and it opened with nothing configured so that it could
// demonstrate itself. Its identity function read:
//
//   return mode === 'header' || mode === 'supabase' ? mode : 'demo';
//
// Every other value fell to `demo` — including ABSENCE, and including a typo
// — and in `demo` the Studio takes its identity from a cookie the browser
// sets, defaulting to `person-lecturer`.
//
// So on a deployment where ACADEMIC_SESSION_MODE had never been set, anybody
// who could open /academic-studio could choose whose eyes to look through, and
// every ownership rule inside it was advisory. Nineteen pages and eighteen
// routes sat behind that one line.
//
// ---------------------------------------------------------------------------
// WHAT HAS TO STAY TRUE
// ---------------------------------------------------------------------------
//
// THE HOUSE RULE IS REFUSE, NOT FALL BACK. `adminAuth.ts` will not drop to the
// publishable key when the service key is missing, and says why: "a silent
// fallback would appear to work and change nothing". Adopting this subsystem
// properly means it obeys that rule too — a Studio that opens as a switcher
// looks exactly like a working Studio, which is what makes it worse than one
// that refuses.
//
// AND A DEMONSTRATION IS STILL POSSIBLE, because it is asked for by name.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let failures = 0;
const check = (label, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`ok    ${label}`);
  } else {
    failures++;
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n`
      + `      actual   ${JSON.stringify(actual)}`);
  }
};

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const bundle = (name, from) => {
  const out = join(root, 'node_modules', '.cache', 'iguc-tests', name);
  execFileSync('npx', [
    'esbuild', join(root, from),
    '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error',
    `--alias:@=${join(root, 'src')}`,
  ]);
  return out;
};

const { sessionMode, SESSION_NOT_CONFIGURED } =
  await import(bundle('academic-session.mjs', 'src/academic/lib/auth/session.ts'));

const actor = read('src/academic/lib/session.ts');
const config = read('src/lib/configuration.ts');

// A CLEAN SLATE FOR EACH CASE. `process.env` is shared, and a test that
// inherits the previous case's variables proves whatever ran before it.
const inEnv = (vars, fn) => {
  const before = { ...process.env };
  for (const k of ['ACADEMIC_SESSION_MODE', 'NODE_ENV', 'NEXT_PUBLIC_ENABLE_DEMO']) {
    delete process.env[k];
  }
  Object.assign(process.env, vars);
  try { return fn(); } finally {
    for (const k of Object.keys(process.env)) if (!(k in before)) delete process.env[k];
    Object.assign(process.env, before);
  }
};

// ---------------------------------------------------------------------------
console.log('\nAn unset variable is a refusal on a production build\n');

// THE WHOLE POINT. This is the case the University's own deployment is in
// until they set it, and it used to be the demonstration switcher.
check('nothing set, in production',
  inEnv({ NODE_ENV: 'production' }, sessionMode), 'unconfigured');

// AND A TYPO IS NOT A DEMONSTRATION EITHER. `ACADEMIC_SESSION_MODE=supabse`
// used to mean "let anybody be the lecturer".
check('a misspelt value, in production',
  inEnv({ NODE_ENV: 'production', ACADEMIC_SESSION_MODE: 'supabse' }, sessionMode),
  'unconfigured');
check('an empty value, in production',
  inEnv({ NODE_ENV: 'production', ACADEMIC_SESSION_MODE: '' }, sessionMode), 'unconfigured');

// ---------------------------------------------------------------------------
console.log('\nAnd a demonstration is still possible, asked for by name\n');

check('`demo` set deliberately, even in production',
  inEnv({ NODE_ENV: 'production', ACADEMIC_SESSION_MODE: 'demo' }, sessionMode), 'demo');
check('nothing set, off the production build',
  inEnv({ NODE_ENV: 'development' }, sessionMode), 'demo');
check('nothing set, with the demo flag the login page already uses',
  inEnv({ NODE_ENV: 'production', NEXT_PUBLIC_ENABLE_DEMO: 'true' }, sessionMode), 'demo');

// THE TWO REAL MODES ARE UNTOUCHED.
check('`supabase` is still `supabase`',
  inEnv({ NODE_ENV: 'production', ACADEMIC_SESSION_MODE: 'supabase' }, sessionMode), 'supabase');
check('`header` is still `header`',
  inEnv({ NODE_ENV: 'production', ACADEMIC_SESSION_MODE: 'header' }, sessionMode), 'header');

// ---------------------------------------------------------------------------
console.log('\nThe refusal says what to do about it\n');

// A REFUSAL READING "not signed in" SENDS AN ADMINISTRATOR TO LOOK AT THEIR
// OWN ACCOUNT, when the deployment is one environment variable short.
check('the message names the variable',
  /ACADEMIC_SESSION_MODE/.test(SESSION_NOT_CONFIGURED), true);
check('…and the value to set it to',
  /supabase/.test(SESSION_NOT_CONFIGURED), true);
check('…and the secret that goes with it',
  /SUPABASE_JWT_SECRET/.test(SESSION_NOT_CONFIGURED), true);
check('…and says what it is refusing INSTEAD of doing',
  /demonstration switcher/.test(SESSION_NOT_CONFIGURED), true);

check('`currentActor` refuses on it rather than reading the cookie',
  /if \(mode === 'unconfigured'\) \{\s*\n\s*throw new Error\(SESSION_NOT_CONFIGURED\);/
    .test(actor), true);

// AND THE REFUSAL COMES BEFORE THE COOKIE IS READ. Order matters: the cookie
// read is the last thing in that function, and a check placed after it would
// be a check that never runs.
check('…and the refusal is reached before the cookie',
  actor.indexOf("mode === 'unconfigured'") < actor.indexOf('cookies().get(COOKIE)'), true);

// ---------------------------------------------------------------------------
console.log('\nAnd the configuration report says the new cost of absence\n');

const row = /name: 'ACADEMIC_SESSION_MODE',[\s\S]*?\n  \},/.exec(config);
check('the report still carries the variable', Boolean(row), true);
check('…and no longer says it falls back to the switcher',
  /falls back to the DEMONSTRATION SWITCHER/.test(row?.[0] ?? ''), false);
check('…but that the Studio refuses',
  /THE STUDIO REFUSES EVERY REQUEST/.test(row?.[0] ?? ''), true);

// IT IS RECOMMENDED AND NOT REQUIRED, and that is deliberate: `required` on
// that report means the DEPLOYMENT cannot run, and the University runs
// admissions, the registry, finance and credentials with no Studio at all.
// Changing it to `required` was tried, and `configuration.test.mjs` refused
// it by holding the minimum to four names.
check('…at `recommended`, because the University runs without the Studio',
  /importance: 'recommended'/.test(row?.[0] ?? ''), true);

// ---------------------------------------------------------------------------
console.log(failures === 0
  ? '\nAll good.\n'
  : `\n${failures} failure${failures === 1 ? '' : 's'}.\n`);
process.exit(failures === 0 ? 0 : 1);
