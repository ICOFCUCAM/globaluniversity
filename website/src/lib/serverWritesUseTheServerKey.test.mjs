// ---------------------------------------------------------------------------
// NO ROUTE WRITES WITH THE BROWSER'S KEY.
//
// Run with:  node src/lib/serverWritesUseTheServerKey.test.mjs
//
// ---------------------------------------------------------------------------
// THE OUTAGE THIS EXISTS BECAUSE OF
// ---------------------------------------------------------------------------
//
// Migration 091 took INSERT, UPDATE, DELETE and TRUNCATE away from `anon` —
// the publishable key, which ships in the JavaScript of every page — because
// the audit found that the same grant let an unauthenticated request TRUNCATE
// the University's database past all 129 of its policies.
//
// Before shipping it, the question "does anything write as anon?" was asked,
// and answered two ways, both of which were beside the point:
//
//   · no INSERT policy in the schema names `anon`  — true, and irrelevant
//   · the public application form posts to `/api/apply` rather than writing
//     from the browser — true, and irrelevant
//
// `/api/apply` imported `@/lib/supabase`, which is the browser client built on
// the publishable key, and inserted the applicant with it. A route on the
// server holding the browser's key is not a server-side write. It is a browser
// write with extra steps, and it had been working only because `anon` could
// write to every table in the schema.
//
// So 091 closed the hole and broke the University's admissions intake, and the
// two checks that were supposed to prevent exactly that both passed.
//
// ---------------------------------------------------------------------------
// WHAT THIS CHECKS, AND WHY IT IS THE RIGHT QUESTION
// ---------------------------------------------------------------------------
//
// Not "is there a policy", and not "does the browser post to a route". Which
// KEY the route is holding when it writes. That is the fact the outage turned
// on, and it is the one thing neither earlier check looked at.
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
 * Source with comments stripped.
 *
 * ESSENTIAL HERE, not a nicety: every route that was fixed now carries a long
 * comment EXPLAINING that it must not write with the browser key, and those
 * comments contain the exact words this file searches for.
 */
const bare = (p) => readFileSync(p, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

/** A write through a Supabase client, in the spelling this codebase uses. */
const WRITE = /\.from\(\s*['"`][a-z_]+['"`]\s*\)[\s\S]{0,400}?\.(insert|update|upsert|delete)\s*\(/;

/**
 * The browser client: `import { supabase } from '@/lib/supabase'`.
 *
 * It is built on NEXT_PUBLIC_SUPABASE_ANON_KEY. Importing it in a route is
 * fine — plenty of routes READ with it, and reading is what the publishable
 * key is for. Writing with it is the fault.
 */
const IMPORTS_BROWSER_KEY = /import\s*\{[^}]*\bsupabase\b[^}]*\}\s*from\s*['"]@\/lib\/supabase['"]/;

console.log('\nEvery route that writes holds the service key to do it\n');

const found = routes(apiDir);
check('there are routes to check at all', found.length > 0, true);

const offenders = [];
for (const file of found) {
  const src = bare(file);
  if (!IMPORTS_BROWSER_KEY.test(src)) continue;

  // Does the BROWSER client write? A route may import it to read and also hold
  // an admin client to write — that is correct and common here — so the match
  // is anchored on the browser client's own identifier.
  const browserWrites = new RegExp(
    String.raw`\bsupabase\s*\.from\(\s*['"\`][a-z_]+['"\`]\s*\)[\s\S]{0,400}?\.(insert|update|upsert|delete)\s*\(`,
  ).test(src);

  if (browserWrites) offenders.push(file.slice(apiDir.length).replace(/\/route\.ts$/, ''));
}

check('no route writes with the publishable key', offenders, []);

// ---------------------------------------------------------------------------
// AND THE ONE THAT BROKE, BY NAME.
//
// The sweep above would pass if `/api/apply` stopped writing at all, or
// stopped existing. What matters is that the University's admissions intake
// still records an applicant, and does it with the service key.
// ---------------------------------------------------------------------------
{
  const src = bare(join(apiDir, 'apply/route.ts'));
  check('the application form still records the applicant', WRITE.test(src), true);
  check('…using the service key', /adminClient\(\)/.test(src), true);
  check('…and not the browser client', IMPORTS_BROWSER_KEY.test(src), false);

  // AND IT SAYS SO WHEN IT CANNOT. An application that was not recorded must
  // never look recorded: somebody has filled in a long form and is owed the
  // truth about whether it arrived.
  check('…and refuses rather than pretending when the key is absent',
    /if\s*\(\s*!\s*supabase\s*\)[\s\S]{0,300}return false/.test(src), true);
}

console.log(failures ? `\n${failures} check(s) failed.\n` : '\nEvery server write holds a server key.\n');
process.exit(failures ? 1 : 0);
