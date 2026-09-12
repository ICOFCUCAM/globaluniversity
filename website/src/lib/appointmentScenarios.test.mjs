// ---------------------------------------------------------------------------
// THE UNIVERSITY'S SIX ACCEPTANCE SCENARIOS, PERFORMED.
//
// Run with:  node src/lib/appointmentScenarios.test.mjs
//
// ---------------------------------------------------------------------------
// WHAT THIS IS
// ---------------------------------------------------------------------------
//
// The University set six scenarios and said not to consider the work complete
// until they can be performed. This performs them — A through F — rather than
// asserting that code exists which looks as though it would.
//
// ---------------------------------------------------------------------------
// AND WHAT IT CAN AND CANNOT REACH
// ---------------------------------------------------------------------------
//
// The sandbox cannot reach the University's Supabase project, so the HTTP
// routes cannot be driven end to end here. Two things are done instead, and the
// file says out loud which of them ran:
//
//   THE DATABASE HALF is performed against real Postgres. Every scenario is a
//   sequence of state transitions, and it is the CONSTRAINTS that make them
//   safe — "an appointment cannot be issued without an approved decision and an
//   archived document" is a trigger, not a line in a route. Driving the SQL
//   proves the guarantee; driving a route would prove one caller's manners.
//
//   THE ROUTE HALF is checked by reading the pipeline for the ORDER of its
//   operations. Scenario F turns entirely on that order — archive, then issue,
//   then email, with the email's failure undoing nothing — and the order is a
//   property of the source, so the source is where it is asserted.
//
// If the Postgres harness is not reachable the database half is reported as NOT
// RUN, and that is a failure rather than a pass. A scenario nobody performed is
// not a scenario that succeeded.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
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
const SOCKET = '/var/tmp/pgtest/sock';

// ---------------------------------------------------------------------------
// THE ROUTE HALF — the order of operations
// ---------------------------------------------------------------------------

console.log('\nThe pipeline does things in the order that makes a failure survivable\n');

{
  const route = readFileSync(
    join(here, '../app/api/appointments/letter/route.ts'), 'utf8');

  // SCENARIO F IS AN ORDERING PROPERTY. Archive, then mark issued, then send.
  // Any other order leaves either a letter recorded as sent with nothing behind
  // it, or an appointment reversed by an SMTP timeout.
  const archiveAt = route.indexOf("from('appointment_letters').insert");
  const issueAt = route.indexOf("status: 'issued', issued_at: now");
  // lastIndexOf, NOT indexOf. `deliver` is called twice — once in the
  // already-issued branch, which re-sends and correctly does NOT re-issue, and
  // once after the issue itself. The first call sits earlier in the file than
  // the issue update, so indexOf reported the order as wrong when it was right.
  // A check that reads the wrong one of two identical calls is worse than none.
  const deliverAt = route.lastIndexOf('const result = await deliver(appointment, letter)');
  check('the document is archived before anything is marked issued',
    archiveAt > 0 && archiveAt < issueAt, true);
  check('and the email is sent last of all',
    issueAt > 0 && deliverAt > issueAt, true);

  // AND ITS FAILURE UNDOES NOTHING. The University's words: "If email fails, do
  // not reverse the appointment."
  check('a failed delivery does not roll the appointment back',
    /delivery: result\.sent \? 'sent' : 'failed'/.test(route), true);
  check('…and nothing in the delivery path deletes or reverses the appointment',
    /from\('appointments'\)[\s\S]{0,120}\.delete\(\)/.test(route), false);

  // RESUMABLE WITHOUT DUPLICATING. Every action asks what is already true.
  check('generating twice returns the existing letter',
    /alreadyGenerated: true/.test(route), true);
  check('issuing twice re-sends rather than re-issuing',
    /alreadyIssued: true/.test(route), true);
  check('and a failed amendment puts the original back',
    /superseded_at: null, superseded_by: null/.test(route), true);

  const accept = readFileSync(
    join(here, '../app/api/appointments/accept/route.ts'), 'utf8');
  check('answering twice does not produce two answers',
    /alreadyAnswered: true/.test(accept), true);
}

// ---------------------------------------------------------------------------
// THE DATABASE HALF — the six scenarios
// ---------------------------------------------------------------------------

if (!existsSync(SOCKET)) {
  // NOT A PASS. A scenario that was not performed is not a scenario that
  // succeeded, and reporting it as one is how a suite comes to vouch for things
  // it never ran.
  console.error('\nFAIL  the Postgres harness at /var/tmp/pgtest is not running, so scenarios '
    + 'A–F were NOT performed');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// STDERR IS MERGED, AND THAT IS NOT A DETAIL.
//
// Postgres writes RAISE NOTICE to stderr. execFileSync returns stdout alone, so
// the first version of this read none of the scenario results — and it PASSED,
// because the only run that had ever been examined was one that threw, where
// the catch happened to concatenate stdout and stderr.
//
// A harness that can only see its results when the thing under test fails is a
// harness that reports success for a run it did not read.
// ---------------------------------------------------------------------------
function psql(db, file) {
  return execFileSync('sh', ['-c',
    `psql -h ${SOCKET} -U postgres -d ${db} -v ON_ERROR_STOP=1 -X -q -f ${file} 2>&1`,
  ], { encoding: 'utf8' });
}

// The scenarios run inside one plpgsql block that rolls itself back, exactly as
// the migrations do — so running this test leaves the database as it found it.
const SCENARIOS = join(here, 'appointmentScenarios.sql');

let output = '';
let ran = false;
// NEWEST FIRST. A database built from an older RUN-ALL would run the scenarios
// against a schema missing the very constraints they are performing, and report
// success because nothing refused anything.
for (const db of ['mall50', 'm50', 'mall49', 'mall48']) {
  try {
    output = psql(db, SCENARIOS);
    ran = true;
    console.log(`\nScenarios A–F, performed against ${db}\n`);
    break;
  } catch (e) {
    output = String(e.stdout ?? '') + String(e.stderr ?? '');
    if (/SCENARIO .* FAILED/.test(output)) {
      // A REAL FAILURE, not a missing database. Stop and report it.
      ran = true;
      console.log(`\nScenarios A–F, performed against ${db}\n`);
      break;
    }
  }
}

if (!ran) {
  console.error('FAIL  no prepared database was reachable, so scenarios A–F were NOT '
    + 'performed. Build one: create a database, load docs/migrations/tests/supabase-stub.sql, '
    + 'then docs/migrations/RUN-ALL.sql.');
  process.exit(1);
}

for (const line of output.split('\n')) {
  const ok = /NOTICE:\s+(SCENARIO [A-F] OK: .*)$/.exec(line);
  if (ok) console.log(`ok    ${ok[1].replace(/^SCENARIO [A-F] OK: /, '')}`);
  const bad = /(SCENARIO [A-F] FAILED: .*)$/.exec(line);
  if (bad) {
    failures += 1;
    console.error(`FAIL  ${bad[1]}`);
  }
}

// EVERY SCENARIO REPORTED, or the run itself is the failure. A block that
// stopped after scenario C would otherwise pass with three ticks.
for (const letter of ['A', 'B', 'C', 'D', 'E', 'F']) {
  check(`scenario ${letter} reached its conclusion`,
    output.includes(`SCENARIO ${letter} OK:`), true);
}

console.log(failures === 0
  ? '\nAll six scenarios performed.'
  : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
