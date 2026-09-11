// ---------------------------------------------------------------------------
// THE CONFIGURATION REPORT — does it tell the truth about a deployment?
//
// Run with:  node src/lib/configuration.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS IS WORTH TESTING
// ---------------------------------------------------------------------------
//
// Because a report that says everything is fine is indistinguishable from a
// deployment where everything is fine — until somebody presses Email at a
// graduation and nothing arrives. The report is the only thing standing between
// an operator and a feature that is quietly off, so the cases below are the
// ones where it could lie:
//
//   * a required variable missing and 'operational' still true
//   * a key present but too short to be a key
//   * a secret copied under a NEXT_PUBLIC_ name and not shouted about
//
// That last one is the reason this file exists. Anything prefixed NEXT_PUBLIC_
// is compiled into the browser bundle and served to every visitor. The service
// role key under that name hands the world full read and write over every
// record the University holds, and the site looks completely normal.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.error(`FAIL  ${label}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
  } else {
    console.log(`ok    ${label}`);
  }
}

const dir = join(new URL('../../node_modules/.cache/icof', import.meta.url).pathname);
mkdirSync(dir, { recursive: true });
const outfile = join(dir, 'configuration.mjs');
execFileSync('npx', [
  'esbuild', new URL('./configuration.ts', import.meta.url).pathname,
  '--bundle', '--format=esm', '--platform=node', `--outfile=${outfile}`, '--log-level=error',
  `--alias:@=${new URL('..', import.meta.url).pathname.replace(/\/$/, '')}`,
]);

const { inspect, SETTINGS } = await import(outfile);

/** Everything a deployment cannot run without, and nothing else. */
const MINIMUM = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  CREDENTIAL_SECRET: 'x'.repeat(48),
};

console.log('\nAn empty deployment\n');

{
  const r = inspect({});
  check('nothing is operational', r.operational, false);
  check('and every required variable is named',
    r.missingRequired.sort(),
    ['CREDENTIAL_SECRET', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY'].sort());
  // EVERY ABSENCE CARRIES ITS CONSEQUENCE, IN FULL. A red dot with nothing
  // beside it teaches people to ignore red dots — and so does one saying "as
  // LIVEKIT_URL", which was what three of these said until this case caught
  // them. The panel shows this sentence standing alone under the missing
  // variable, so a cross-reference sends the reader hunting for the line it
  // refers to.
  check('every setting says what its absence costs',
    r.settings.filter((s) => !s.ifAbsent || s.ifAbsent.length < 20).map((s) => s.name), []);
  check('and no value is ever returned',
    r.settings.some((s) => 'value' in s), false);
}

console.log('\nThe minimum a University can run on\n');

{
  const r = inspect(MINIMUM);
  check('it is operational', r.operational, true);
  check('with nothing required missing', r.missingRequired, []);
  // OPERATIONAL IS NOT COMPLETE, and the report must not imply it is.
  check('but the recommended ones are still named',
    r.missingRecommended.includes('CREDENTIAL_SIGNING_KEY'), true);
  check('…including outbound mail', r.missingRecommended.includes('SMTP_HOST'), true);
}

console.log('\nA key that is present but not a key\n');

// THE CASE THAT LOOKS FINE. A CREDENTIAL_SECRET of "changeme" is set, so a
// naive report shows a green dot — and the seal it produces is guessable.
{
  const r = inspect({ ...MINIMUM, CREDENTIAL_SECRET: 'changeme' });
  const secret = r.settings.find((s) => s.name === 'CREDENTIAL_SECRET');
  check('a short secret is reported as set', secret.set, true);
  check('…and as too short', secret.tooShort, true);
  check('and the deployment is NOT operational because of it', r.operational, false);
}
{
  const r = inspect({ ...MINIMUM, CREDENTIAL_SIGNING_KEY: 'too-short' });
  const key = r.settings.find((s) => s.name === 'CREDENTIAL_SIGNING_KEY');
  check('a short signing key is flagged too', key.tooShort, true);
  // …but it is only recommended, so it does not stop the University working.
  check('though it does not make the deployment inoperable', r.operational, true);
}

console.log('\nA secret published to every visitor\n');

// THE WORST MISCONFIGURATION THERE IS, and the one the site gives no sign of.
{
  const r = inspect({ ...MINIMUM, NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: 'leaked' });
  check('the exposed name is caught',
    r.exposedSecrets, ['NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY']);
}
{
  const r = inspect({ ...MINIMUM, NEXT_PUBLIC_CREDENTIAL_SECRET: 'leaked', NEXT_PUBLIC_SMTP_PASS: 'leaked' });
  check('and so is every other secret given a public name',
    r.exposedSecrets.sort(), ['NEXT_PUBLIC_CREDENTIAL_SECRET', 'NEXT_PUBLIC_SMTP_PASS'].sort());
}
check('a correctly configured deployment reports none',
  inspect(MINIMUM).exposedSecrets, []);
// AND A GENUINELY PUBLIC VARIABLE IS NOT A LEAK. The Supabase URL and the
// publishable key are meant to be in the browser; flagging them would train
// somebody to dismiss the warning that matters.
check('the variables that are supposed to be public are not flagged',
  inspect({ ...MINIMUM, NEXT_PUBLIC_SITE_URL: 'https://iguc.net' }).exposedSecrets, []);

console.log('\nThe list itself\n');

check('every setting has a name, a purpose and a consequence',
  SETTINGS.filter((s) => !s.name || !s.purpose || !s.ifAbsent).map((s) => s.name), []);
check('no setting is listed twice',
  new Set(SETTINGS.map((s) => s.name)).size, SETTINGS.length);
// A SETTING MARKED PUBLIC MUST CARRY THE PREFIX, and one that is not must not.
check('every public setting is named NEXT_PUBLIC_',
  SETTINGS.filter((s) => s.public && !s.name.startsWith('NEXT_PUBLIC_')).map((s) => s.name), []);
check('and no secret is',
  SETTINGS.filter((s) => !s.public && s.name.startsWith('NEXT_PUBLIC_')).map((s) => s.name), []);

console.log('\nThe mail test cannot be pointed at somebody else\n');

// ---------------------------------------------------------------------------
// THE PROPERTY THAT MATTERS MORE THAN THE FEATURE.
//
// An authenticated endpoint that sends text to an address taken from the
// request body — through the University's mail server, over the University's
// domain — is a relay for anybody who ever borrows a Superadministrator's
// session, and the messages carry the University's reputation rather than the
// sender's. The recipient is read from the caller's own profile, and there is
// nothing in the body to point it anywhere else.
//
// Checked at source because the alternative is trusting a comment.
// ---------------------------------------------------------------------------
{
  const route = readFileSync(
    new URL('../app/api/health/mail-test/route.ts', import.meta.url).pathname, 'utf8',
  );
  check('the recipient comes from the signed-in caller',
    /to:\s*g\.caller\.email\b/.test(route), true);
  // The route never reads a body at all, which is the strongest form of this:
  // there is no parsed input for a recipient to hide in.
  check('the route reads no request body', /request\.(json|text|formData)\(/.test(route), false);
  check('and it is behind a capability guard', /await guard\(request, '[a-z-]+'\)/.test(route), true);
}

process.exit(failures === 0 ? 0 : 1);
