// ---------------------------------------------------------------------------
// THE ONE ROUTE WITH NO `guard()`, AND WHAT HOLDS IT UP INSTEAD.
//
// Run with:  node src/lib/theInvitationIsTheAuthority.test.mjs
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
//
// The University asked for a button that forwards an appointment to the
// appointee "through the various means, whatsapp, text etc, so that they can
// add their emails, and passwords and create their staff records".
//
// Everything else that writes in this application begins by asking who the
// caller is. /api/appointments/join cannot: the person opening it has no
// account yet, because opening one is the point. So the token is the only
// authority there is, and every property that makes that safe has to be
// asserted rather than assumed.
//
// ---------------------------------------------------------------------------
// AND IT MUST NOT UNDO "AN OFFICER OPENS IT"
// ---------------------------------------------------------------------------
//
// The University's earlier ruling: "an account that springs into existence on
// acceptance is a live login nobody authorised." The invitation is the
// officer's decision, which is why issuing one is guarded by
// `open-staff-record` and why the staff record records the INVITING OFFICER as
// the person who opened it — not the appointee, who would otherwise appear in
// the register as the author of their own appointment to it.
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

const issue = read('src/app/api/appointments/invite/route.ts');
const join_ = read('src/app/api/appointments/join/route.ts');
const page = read('src/app/join/page.tsx');
const sql = read('docs/migrations/107_the_appointee_supplies_their_own_particulars.sql');

// ---------------------------------------------------------------------------

console.log('\nIssuing an invitation is an officer’s act\n');

check('issuing is guarded by the same capability as opening the record',
  /issue: 'open-staff-record'/.test(issue), true);
check('and so is revoking it', /revoke: 'open-staff-record'/.test(issue), true);

// NOT BEFORE ACCEPTANCE. Inviting somebody to open a staff record for a post
// they have not taken up is inviting them to join on their own say-so.
check('an invitation is refused before the appointee has accepted',
  /\['accepted', 'active'\]\.includes/.test(issue), true);
check('…and refused once they are already on the register',
  /already-on-the-register/.test(issue), true);

// ---------------------------------------------------------------------------

console.log('\nThe link is a secret the University does not keep\n');

check('the token is 32 random bytes', /randomBytes\(32\)/.test(issue), true);
check('only its digest is stored',
  /createHash\('sha256'\)\.update\(token\)\.digest\('hex'\)/.test(issue), true);

// THE TOKEN MUST NOT BE WRITTEN ANYWHERE IT PERSISTS. The insert names
// `token_hash`, never `token`.
const insert = issue.slice(issue.indexOf("from('appointment_invitations')\n    .insert("));
check('the raw token is never inserted',
  /token:\s/.test(insert.slice(0, 400)), false);

// NOR INTO THE AUDIT TRAIL, which is a second place it could leak from.
//
// SCOPED TO THE CALL, not to the next five hundred characters. The first
// draft took a fixed window and caught `joinUrl(token)` two lines BELOW the
// audit call — a true statement about the file and a false one about the
// trail. A check that fails on correct code is a check somebody deletes.
const auditCall = (() => {
  const from = issue.indexOf('STAFF_INVITATION_ISSUED');
  return issue.slice(from, issue.indexOf('})', from));
})();
check('nor written into the audit trail', /\btoken\b(?!Hash)/.test(auditCall), false);
check('…and the audit call was found, not an empty string', auditCall.length > 80, true);

// AND THE DATABASE REFUSES THE SHAPE, so a route that one day forgot to hash
// is stopped rather than trusted.
check('the database refuses anything that is not a digest',
  /an_invitation_stores_a_digest_not_a_token/.test(sql), true);
check("…and the shape it insists on is a 64-character hex digest",
  /check \(token_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/.test(sql), true);

// ---------------------------------------------------------------------------

console.log('\nGood once, and only for what it was issued for\n');

check('the database allows one claim and no second',
  /an_invitation_is_claimed_once/.test(sql), true);
check('…and refuses a claim being cleared, which would make it live again',
  /old\.claimed_at is not null and new\.claimed_at is distinct from old\.claimed_at/.test(sql),
  true);
check('…and refuses it being repointed at another appointment',
  /new\.appointment_id is distinct from old\.appointment_id/.test(sql), true);
check('one live invitation per appointment',
  /one_live_invitation_per_appointment/.test(sql), true);
check('an invitation expires', /an_invitation_expires_after_it_is_issued/.test(sql), true);
check('the claim route checks the expiry itself too',
  /new Date\(String\(inv\.expires_at\)\) <= new Date\(\)/.test(join_), true);

// EVERY TOUCH IS COUNTED, including the ones that fail — a link being guessed
// at looks exactly like a link being used unless somebody counts.
check('every attempt is counted, successful or not',
  /attempts: Number\(inv\.attempts \?\? 0\) \+ 1/.test(join_), true);

// AND THE COUNT IS BEFORE THE VERDICT. Counting only successes counts nothing
// worth having.
const beforeVerdict = join_.indexOf('attempts: Number(inv.attempts')
  < join_.indexOf('if (inv.claimed_at || inv.revoked_at)');
check('…and counted before the invitation is judged', beforeVerdict, true);

// ---------------------------------------------------------------------------

console.log('\nIt tells a stranger nothing\n');

// ONE REFUSAL FOR FIVE REASONS. "Expired", "already used" and "no such
// invitation" tell somebody working through guesses which guesses to repeat.
const refusals = [...join_.matchAll(/return noGood\(\);/g)].length;
check('unknown, used, revoked, expired and withdrawn all give the same answer',
  refusals >= 5, true);
check('and the answer names none of them',
  /It may have been used already, withdrawn, or run\s+\+?\s*'?out of time/.test(join_)
  || /used already, withdrawn, or run/.test(join_), true);

// THE PAGE SHOWS ONLY WHAT PROVES IT IS THEIRS. A link forwarded to a wrong
// number must not read out somebody's address and telephone to a stranger.
const looked = join_.slice(join_.indexOf('function look(a: Row)'));
const lookBody = looked.slice(0, looked.indexOf('}\n'));
for (const leak of ['email', 'postal_address', 'phone']) {
  check(`the page is not told their ${leak} before they prove who they are`,
    new RegExp(`\\b${leak}\\b`).test(lookBody), false);
}

// ---------------------------------------------------------------------------

console.log('\nThe appointee sets nothing about the post\n');

// THE ROUTE DOES NOT READ THEM FROM THE BODY. Not validated and rejected —
// NOT READ, because a field that is read and then checked is one careless
// edit away from being honoured.
const claimBody = join_.slice(join_.indexOf('async function claim('));
for (const field of [
  'position_title', 'position_id', 'employment_type', 'start_date', 'faculty', 'role',
  'staff_number', 'family',
]) {
  check(`\`${field}\` is never taken from the caller`,
    new RegExp(`body\\.${field}|body\\[['"]${field}`).test(claimBody), false);
}

// THE ROLE COMES FROM THE POST'S FAMILY. Nobody appoints themselves a
// Registrar by sending different JSON.
check('the role is derived from the family the post is filed under',
  /roleForFamily\(family\)/.test(claimBody), true);

// AND THE STAFF NUMBER FROM THE UNIVERSITY.
check('the staff number comes from the register',
  /rpc\('next_staff_number'/.test(claimBody), true);

// THE OFFICER OPENED IT, not the appointee. This is the line that keeps the
// University's original ruling true.
check('the record names the inviting officer as the one who opened it',
  /opened_by: inv\.issued_by/.test(claimBody), true);
check('…and `issued_by` is actually selected, or that line is undefined',
  /const INVITATION = '[^']*\bissued_by\b/.test(join_), true);

// ---------------------------------------------------------------------------

console.log('\nAnd the page proves itself before it asks for anything\n');

// It arrives on WhatsApp as a link from a number. The reader's correct first
// instinct is that it might be a fraud.
check('it shows their name and post before any field',
  page.indexOf('This invitation is for') < page.indexOf('How the University reaches you'),
  true);
check('it tells them what to do if it is not them',
  /If this is not you/.test(page), true);

// THE PARTICULARS ARE TEXT, NOT DISABLED INPUTS. A disabled input is a field a
// browser can re-enable.
const proofPanel = page.slice(page.indexOf('This invitation is for'),
  page.indexOf('How the University reaches you'));
check('the particulars are drawn as text, never as inputs',
  /<input/.test(proofPanel), false);

check('a password is at least as long as the library says',
  /MIN_PASSWORD/.test(join_) && /MIN_PASSWORD/.test(page), true);

// ---------------------------------------------------------------------------

console.log('\nAnd nobody but the service key can read the digest\n');

check('the digest is revoked at the column, not hidden by a view',
  /revoke all on appointment_invitations from authenticated/.test(sql)
  && /grant select \(%s\) on appointment_invitations/.test(sql), true);
check('…and the column list is read from the catalogue, so a new column is covered',
  /column_name <> 'token_hash'/.test(sql), true);
check('the status view carries no digest',
  /create or replace view appointment_invitation_status[\s\S]*?token_hash/.test(
    sql.slice(sql.indexOf('create or replace view appointment_invitation_status'),
      sql.indexOf('comment on view appointment_invitation_status'))), false);

// ---------------------------------------------------------------------------
// AND THE MIGRATION PROVED ALL OF IT AGAINST POSTGRES.
// ---------------------------------------------------------------------------

const psql = (db, q) => execFileSync('psql', ['-d', db, '-Atc', q], {
  encoding: 'utf8',
  env: { ...process.env, PGHOST: '/var/tmp/pgtest/sock', PGUSER: 'postgres' },
  stdio: ['ignore', 'pipe', 'ignore'],
}).trim();

let db = null;
try {
  db = psql('postgres', "select datname from pg_database where datname ~ '^mall[0-9]+$'")
    .split('\n').map((d) => d.trim()).filter(Boolean)
    .sort((a, b) => Number(b.replace(/\D/g, '')) - Number(a.replace(/\D/g, '')))[0] ?? null;
} catch { /* the harness is not running */ }

if (db) {
  console.log(`\nMeasured against ${db}\n`);
  // THE ONE THAT CANNOT BE READ FROM THE SOURCE. A column-level revoke looks
  // identical whether it worked or not — and the first draft of 107 granted
  // the table and revoked the column, which Postgres silently ignores because
  // a table grant subsumes every column in it.
  const canRead = psql(db, "select count(*) from information_schema.column_privileges "
    + "where table_name = 'appointment_invitations' and column_name = 'token_hash' "
    + "and grantee = 'authenticated' and privilege_type = 'SELECT'");
  check('`authenticated` genuinely cannot select the digest', canRead, '0');

  const others = psql(db, "select count(*) from information_schema.column_privileges "
    + "where table_name = 'appointment_invitations' and column_name = 'claimed_email' "
    + "and grantee = 'authenticated' and privilege_type = 'SELECT'");
  check('…while the rest of the row is still theirs to read', others, '1');
} else {
  console.log('\n(no fully-migrated database was reachable, so the grants were not read)');
}

// ---------------------------------------------------------------------------

console.log(failures === 0
  ? '\nThe invitation is the authority, and it is good once.\n'
  : `\n${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
