// ---------------------------------------------------------------------------
// EVERY OFFICE THAT SENDS MAIL CAN BE REPLIED TO.
//
// Run with:  node src/lib/mailer.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
//
// The From address on every email this system sends is fixed: it is whatever
// account the mail server authenticates, and there is one of those. The office
// appeared only as a display name —
//
//   From: "ICOF Global University — Office of Academic Affairs" <admissions@…>
//
// — so an admitted student replying to ask about their decision reached the
// inbox that handles applications, and a graduate querying a certificate
// reached it too, though the Registrar had signed that one.
//
// Reply-To fixes it, and the way that goes wrong is quiet: a route names an
// office the table does not know, no reply address is set, and the reply lands
// wherever the From address points. Nothing errors. Nobody notices until
// somebody asks why Academic Affairs never answered.
//
// So the offices the routes actually name are read out of the routes.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
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

const here = new URL('.', import.meta.url).pathname;
const dir = join(here, '../../node_modules/.cache/icof');
mkdirSync(dir, { recursive: true });
const out = join(dir, 'constants.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'constants.ts'),
  '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error',
]);
const { UNIVERSITY, OFFICE_REPLY_TO, OFFICE_WITHOUT_REPLY_TO } = await import(out);

// ---------------------------------------------------------------------------
// Every `office:` a sending route passes, read from the routes themselves.
// ---------------------------------------------------------------------------
function officesThatSendMail() {
  const apiDir = join(here, '../app/api');
  const found = new Set();
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) { walk(p); continue; }
      if (!entry.name.endsWith('.ts')) continue;
      const text = readFileSync(p, 'utf8');
      // Only where mail is actually sent. `actor_office` is an audit column and
      // a different thing entirely.
      if (!/\bsend\(\{/.test(text)) continue;
      for (const m of text.matchAll(/^\s*office:\s*'([^']+)'/gm)) found.add(m[1]);
    }
  };
  walk(apiDir);
  return [...found].sort();
}

console.log('\nEvery office that sends mail has somewhere for a reply to go\n');

{
  const offices = officesThatSendMail();
  // A FLOOR, TO CATCH A BROKEN SCAN rather than to pin the count. It was four
  // until the two legacy admit routes were retired; the Admissions Office no
  // longer sends anything, because it forwards rather than admits. A scan that
  // has stopped working returns zero, which is what this is guarding against.
  check('the scan found the sending offices', offices.length >= 3, true);

  const unaddressed = offices.filter(
    (o) => !(o in OFFICE_REPLY_TO) && !(o in OFFICE_WITHOUT_REPLY_TO),
  );
  check('no office sends mail nobody can reply to', unaddressed, []);

  // An exemption is a claim somebody defends in review, not a way of silencing
  // the test.
  const thin = Object.entries(OFFICE_WITHOUT_REPLY_TO)
    .filter(([, why]) => String(why).trim().length < 30).map(([o]) => o);
  check('every exemption gives a reason', thin, []);
}

console.log('\nAnd the addresses are the University’s own\n');

{
  // NEVER AN INVENTED ADDRESS. Mail to one that does not exist bounces, and a
  // letter already sent cannot be taken back. Each of these is recorded in
  // constants.ts because the University stated it.
  check('Academic Affairs', OFFICE_REPLY_TO['Office of Academic Affairs'],
    UNIVERSITY.academicAffairsEmail);
  check('the Registrar', OFFICE_REPLY_TO['Office of the Registrar'], UNIVERSITY.email);
  check('Admissions', OFFICE_REPLY_TO['Office of Admissions'], UNIVERSITY.admissionsEmail);

  const badlyFormed = Object.entries(OFFICE_REPLY_TO)
    .filter(([, address]) => !/^[^@\s]+@iguc\.net$/.test(address))
    .map(([office]) => office);
  check('every one is an address at the University’s own domain', badlyFormed, []);
}

console.log('\nAn explicit reply-to still wins\n');

// THE ONE THAT WOULD BREAK SOMETHING REAL. The application acknowledgement goes
// to the admissions inbox with the APPLICANT's address as Reply-To, so staff
// can answer the applicant in one click. An office default overriding that
// would have them replying to themselves.
{
  const mailer = readFileSync(join(here, 'mailer.ts'), 'utf8');
  const line = /replyTo:\s*(.+)/.exec(mailer)?.[1] ?? '';
  check('the caller’s own reply-to is preferred', /request\.replyTo\s*\?\?/.test(line), true);

  const apply = readFileSync(join(here, '../app/api/apply/route.ts'), 'utf8');
  check('and the application acknowledgement still sets one',
    /replyTo:\s*applicantEmail/.test(apply), true);
}

console.log('\nThe applicant is told their application arrived, and their reference\n');

// ---------------------------------------------------------------------------
// THE GAP THIS CLOSES. A person applied to the University and received nothing
// at all — no acknowledgement, and no reference. Every later instruction quotes
// that reference and the status page asks for it, so it existed only inside the
// institution that issued it, and the page built for applicants could not be
// used by one.
// ---------------------------------------------------------------------------
{
  const apply = readFileSync(join(here, '../app/api/apply/route.ts'), 'utf8');
  check('the applicant is sent something', /to:\s*applicantEmail/.test(apply), true);
  check('…carrying their reference', /Your reference/.test(apply), true);
  check('…and where to check their own progress',
    /application-status/.test(apply), true);

  // AND IT MUST NOT BE ABLE TO FAIL THE SUBMISSION. The application is already
  // captured by that point; an applicant whose acknowledgement bounced is in a
  // far better position than one whose application was refused because it did.
  const afterOffice = apply.slice(apply.indexOf('emailed = delivery.sent'));
  check('the acknowledgement is sent after the application is captured',
    /to:\s*applicantEmail/.test(afterOffice), true);
}

process.exit(failures === 0 ? 0 : 1);
