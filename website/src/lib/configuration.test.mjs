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

const { inspect, SETTINGS, deploymentStamp } = await import(outfile);

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
// AND THE PREFIX ALONE IS NOT EVIDENCE. NEXT_PUBLIC_SITE_URL is SITE_URL with a
// prefix, and is also a declared public variable in its own right. Reading it
// as a leaked copy would tell somebody to rotate a key that is a web address.
check('a declared public variable is not read as a leak of its private namesake',
  inspect({ ...MINIMUM, SITE_URL: 'https://iguc.net', NEXT_PUBLIC_SITE_URL: 'https://iguc.net' })
    .exposedSecrets, []);
// While a genuine one still is.
check('but a real leaked secret still is',
  inspect({ ...MINIMUM, NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: 'leaked' }).exposedSecrets,
  ['NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY']);

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

console.log('\nEvery variable the code reads is on the report\n');

// ---------------------------------------------------------------------------
// THE DEFECT THIS CATCHES, FOUND ON THE UNIVERSITY'S OWN DEPLOYMENT.
//
// The panel named NEXT_PUBLIC_SITE_URL and almost nothing read it. The
// admission letter's sign-in link, the identity card and the staff welcome
// email are all built from SITE_URL, which was on no report at all. Somebody
// configuring a deployment from that panel would have set the advertised
// variable, seen every dot green, and sent admission letters pointing at a
// hard-coded fallback.
//
// SMTP_PORT was missing the same way, and it is the variable that decides
// whether the mail connection is encrypted.
//
// So the list is checked against the code rather than maintained beside it.
// ---------------------------------------------------------------------------
{
  const srcDir = new URL('../', import.meta.url).pathname;
  // Both shapes: `process.env.NAME`, and `const { NAME } = process.env`.
  const direct = execFileSync('grep', [
    '-rhoE', 'process\\.env\\.[A-Z_0-9]+', '--include=*.ts', '--include=*.tsx', srcDir,
  ]).toString().split('\n').map((s) => s.replace('process.env.', '')).filter(Boolean);

  const destructured = (execFileSync('grep', [
    '-rhoE', 'const \\{[^}]*\\} = process\\.env', '--include=*.ts', '--include=*.tsx', srcDir,
  ]).toString().match(/[A-Z_0-9]{3,}/g) ?? []);

  const used = [...new Set([...direct, ...destructured])].sort();
  check('the scan found variables at all', used.length > 8, true);

  const declared = SETTINGS.map((s) => s.name);
  // The platform's own, not the University's. Nobody sets these by hand and
  // listing them as things to configure would be advice to break a deployment.
  const PLATFORM = [
    'NODE_ENV', 'VERCEL', 'VERCEL_ENV', 'VERCEL_URL', 'PORT',
    'VERCEL_GIT_COMMIT_SHA', 'VERCEL_GIT_COMMIT_REF', 'VERCEL_GIT_COMMIT_MESSAGE',
  ];
  check('nothing the code reads is missing from the report',
    used.filter((v) => !declared.includes(v) && !PLATFORM.includes(v)), []);
}

console.log('\nWhich commit is running, answered rather than guessed\n');

// ---------------------------------------------------------------------------
// The University reported two fixes as not working and guessed a branch needed
// merging. It did not — the commits were pushed and the host had not rebuilt on
// them — but nobody could establish that from the portal, so it was settled by
// guessing. This is what makes it a fact instead.
// ---------------------------------------------------------------------------
{
  const stamp = deploymentStamp({
    VERCEL_GIT_COMMIT_SHA: '7971c5adf0123456789abcdef',
    VERCEL_GIT_COMMIT_REF: 'claude/university-site-vercel-migration-vmsizi',
    VERCEL_GIT_COMMIT_MESSAGE: 'Put the variables on the report\n\nA long body\nover lines.',
    VERCEL_ENV: 'production',
  });
  check('the commit is shown short enough to read', stamp.commit, '7971c5adf');
  // THE FIELD THAT ANSWERS THE QUESTION ASKED. Whether a merge is needed is a
  // question about which branch the deployment was built from.
  check('the branch is carried', stamp.branch, 'claude/university-site-vercel-migration-vmsizi');
  check('only the subject line of the message', stamp.message, 'Put the variables on the report');
  check('and the environment', stamp.environment, 'production');
  check('it reports itself available', stamp.available, true);
}
{
  // A HOST WITH THE SYSTEM VARIABLES SWITCHED OFF must say it cannot tell,
  // rather than render an empty box that reads like a commit of nothing.
  const blank = deploymentStamp({});
  check('with nothing set it admits it cannot tell', blank.available, false);
  check('and invents no commit', blank.commit, null);
}

console.log('\nA variable that is dangerous when SET, not when missing\n');

{
  // NEXT_PUBLIC_ENABLE_DEMO puts one-click administrator sign-in on the public
  // login page. Every other check here treats absence as the fault, so without
  // this the report would call such a deployment fully operational.
  const clean = inspect(MINIMUM);
  check('a deployment without it is not warned about', clean.dangerouslySet, []);
  check('…and is still reported operational', clean.operational, true);

  const demo = inspect({ ...MINIMUM, NEXT_PUBLIC_ENABLE_DEMO: 'true' });
  check('setting it raises the warning', demo.dangerouslySet, ['NEXT_PUBLIC_ENABLE_DEMO']);

  // AND IT IS NOT MISTAKEN FOR A LEAKED SECRET. It is genuinely a browser
  // variable; flagging it as an exposed secret would send somebody to rotate a
  // key that does not exist.
  check('and it is not reported as an exposed secret', demo.exposedSecrets, []);

  // The warning is useless without words, and the words live on the row.
  const row = demo.settings.find((s) => s.name === 'NEXT_PUBLIC_ENABLE_DEMO');
  check('the warning carries an explanation', (row?.dangerIfSet ?? '').length > 40, true);
}

console.log('\nThe SMTP port, which decides whether the connection is encrypted\n');

// ---------------------------------------------------------------------------
// 465 IS IMPLICIT TLS AND 587 UPGRADES WITH STARTTLS, so `secure` is derived
// from the port rather than configured separately — which makes a mistyped port
// a silent downgrade rather than an error.
//
// `Number('')` is 0, not NaN. An SMTP_PORT saved with an empty value — which a
// hosting panel accepts without complaint — used to mean port 0 with TLS off.
// That fails, but it fails looking like a network fault, and the thing people
// then check is the host name.
// ---------------------------------------------------------------------------
{
  const outM = join(dir, 'mailer.mjs');
  // nodemailer STAYS EXTERNAL. Bundling it into ESM rewrites its internal
  // `require('events')` into a shim that throws on first call, so the import
  // fails before a single assertion runs. Node imports the CommonJS package
  // directly without complaint; it just must not be flattened into the bundle.
  execFileSync('npx', [
    'esbuild', new URL('./mailer.ts', import.meta.url).pathname,
    '--bundle', '--format=esm', '--platform=node', '--external:nodemailer',
    `--outfile=${outM}`, '--log-level=error',
  ]);
  const { smtpPort } = await import(outM);

  check('the University’s own port survives', smtpPort('465'), 465);
  check('and selects implicit TLS', smtpPort('465') === 465, true);
  check('whitespace around it is tolerated', smtpPort(' 465 '), 465);
  check('unset falls back to STARTTLS', smtpPort(undefined), 587);
  // THE ONE THAT WAS BROKEN. Not 0.
  check('an empty value falls back rather than becoming port 0', smtpPort(''), 587);
  check('so does a non-number', smtpPort('mail.iguc.net'), 587);
  check('and so does something out of range', smtpPort('70000'), 587);
  check('a caller’s own fallback is honoured', smtpPort(undefined, 2525), 2525);
}

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
