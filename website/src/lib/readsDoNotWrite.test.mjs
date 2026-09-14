// ---------------------------------------------------------------------------
// A READ DOES NOT CHANGE THE UNIVERSITY'S RECORDS.
//
// Run with:  node src/lib/readsDoNotWrite.test.mjs
//
// ---------------------------------------------------------------------------
// THE RULING
// ---------------------------------------------------------------------------
//
// The University, September 2026, on finding that `/api/exam/questions` built
// and recorded an examination paper on a GET:
//
//   "A GET should generally mean retrieve/read, not create/modify official
//    state... A browser, proxy, crawler or prefetcher should never accidentally
//    create an official academic record simply because it requested a page."
//
// ---------------------------------------------------------------------------
// WHY IT WAS NOT HYPOTHETICAL
// ---------------------------------------------------------------------------
//
// The paper was built from the question bank, written to `exam_sessions`, and
// an examination event recorded — all on a request that looked to everything in
// between like a page view. And 016 makes `exam_sessions.paper` SET-ONCE, so
// the first build wins permanently:
//
//   · a link prefetcher warms the URL           -> the candidate's paper is set
//   · a dropped connection is retried           -> recorded twice, event twice
//   · a browser restores yesterday's tabs       -> a paper for a sitting that
//                                                  has not begun
//   · a scanner follows the URL out of a log    -> same
//
// In each case the paper the candidate eventually sits was chosen by something
// that was not the candidate, and the `question_viewed` event says a person
// read questions that nobody read.
//
// ---------------------------------------------------------------------------
// WHAT THIS CHECKS
// ---------------------------------------------------------------------------
//
// Every GET handler in every route, for a write through the Supabase client.
// The rule is structural rather than a matter of review: a route added next
// year is covered by the same sweep.
// ---------------------------------------------------------------------------

import { readdirSync, readFileSync, statSync } from 'node:fs';
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

const apiDir = new URL('../app/api/', import.meta.url).pathname;

/** Every route.ts under src/app/api, at any depth. */
function routes(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...routes(full));
    else if (entry === 'route.ts') out.push(full);
  }
  return out;
}

/**
 * The body of one exported handler, from its signature to the next export.
 *
 * COMMENTS STRIPPED FIRST, and this codebase has been caught by that more times
 * than by any other single mistake. Half the GET handlers here explain in prose
 * why they do NOT write, and a naive search finds `.update(` inside the
 * sentence saying so.
 */
function handlerBody(source, verb) {
  const bare = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
  const start = bare.search(new RegExp(`export\\s+async\\s+function\\s+${verb}\\b`));
  if (start < 0) return null;
  const rest = bare.slice(start);
  const next = rest.slice(1).search(/\nexport\s+(async\s+)?(function|const)\b/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

// ---------------------------------------------------------------------------
// THE EXCEPTIONS, NAMED ONE BY ONE.
//
// PINNED RATHER THAN PATTERN-MATCHED, so a new one has to be added here
// deliberately, with a reason somebody reads, instead of slipping in under a
// rule like "callbacks may write".
// ---------------------------------------------------------------------------
const ALLOWED = new Map([
  // An OAuth provider redirects the BROWSER back with a code in the query
  // string, so the callback is a GET by the protocol's design and not by ours.
  // Storing the token it carries is the entire purpose of the redirect; there
  // is no POST available to move it to.
  ['social/oauth/callback', 'the provider chooses the verb on an OAuth redirect'],
]);

// ---------------------------------------------------------------------------
// A WRITE TO A TABLE, AND NOT EVERY METHOD CALLED `update`.
//
// The first version matched `.update(` anywhere, and reported the credential
// verification route — where the line is
//
//     createHash('sha256').update(JSON.stringify(payload)).digest('hex')
//
// a digest of the presented payload, computed to compare against the signature.
// It changes nothing anywhere.
//
// A FALSE FAILURE IS NOT HARMLESS HERE. The next person makes the test pass by
// loosening it, and then it stops catching the real thing. So the match is
// anchored on `.from('table')`, which is how every genuine write in this
// codebase is spelled — `admin.from('exam_sessions').update({ paper })`.
// ---------------------------------------------------------------------------
const WRITES = /\.from\(\s*['"`][a-z_]+['"`]\s*\)[\s\S]{0,400}?\.(insert|update|upsert|delete)\s*\(/;

console.log('\nNo GET creates or changes an institutional record\n');

const found = routes(apiDir);
check('there are routes to check at all', found.length > 0, true);

for (const file of found) {
  const name = file.slice(apiDir.length).replace(/\/route\.ts$/, '');
  const body = handlerBody(readFileSync(file, 'utf8'), 'GET');
  if (body === null) continue;

  const writes = WRITES.test(body);
  if (ALLOWED.has(name)) {
    // AND AN EXCEPTION THAT STOPPED WRITING SHOULD LOSE ITS EXCEPTION, or the
    // list grows into a list of things nobody has looked at since.
    check(`${name}: still needs its exception (${ALLOWED.get(name)})`, writes, true);
  } else {
    check(`${name}: GET writes nothing`, writes, false);
  }
}

// ---------------------------------------------------------------------------
// AND THE ONE THE RULING WAS ABOUT, BY NAME.
//
// The sweep above would pass if `/api/exam/questions` simply stopped having a
// GET, or stopped existing. What the University asked for is that releasing a
// paper became an explicit mutation — so that is checked as its own thing.
// ---------------------------------------------------------------------------
{
  const file = join(apiDir, 'exam/questions/route.ts');
  const source = readFileSync(file, 'utf8');
  const get = handlerBody(source, 'GET');
  const post = handlerBody(source, 'POST');

  check('exam/questions still answers a GET', get !== null, true);
  check('…and releasing the paper is now a POST', post !== null, true);
  check('…which is the handler that builds it', WRITES.test(post ?? ''), true);
  check('…while the GET only reads it back', WRITES.test(get ?? ''), false);

  // THE RETRY PROPERTY, which matters more here than refusing a second call:
  // a candidate who reconnects must get the paper they already have, not a
  // refusal and not a different arrangement.
  const bare = post.replace(/^[ \t]*\/\/.*$/gm, '');
  check('…and posting twice returns the same paper rather than failing',
    /if\s*\(\s*row\.paper\s*\)/.test(bare), true);
}

// ---------------------------------------------------------------------------
// AND THE SCREEN ASKS FOR IT THE NEW WAY.
//
// A route that no longer releases on a GET, with a screen that still GETs, is
// an examination nobody can sit. That failure would be invisible to every check
// above.
// ---------------------------------------------------------------------------
{
  const screen = readFileSync(
    new URL('../components/exams/SitExamination.tsx', import.meta.url).pathname, 'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

  check('the examination screen posts to release the paper',
    /fetch\(\s*'\/api\/exam\/questions'[\s\S]{0,200}method:\s*'POST'/.test(screen), true);
  check('…and no longer builds it by fetching a URL',
    /\/api\/exam\/questions\?sessionId=/.test(screen), false);
}

console.log(failures ? `\n${failures} check(s) failed.\n` : '\nAll read-safety checks passed.\n');
process.exit(failures ? 1 : 0);
