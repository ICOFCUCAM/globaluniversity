// ---------------------------------------------------------------------------
// The social pipeline — can one administrator post as another?
//
// Run with:  node src/lib/social.test.mjs
//
// WHY THIS FILE EXISTS. The university stated one rule about this subsystem in
// terms that admit no exception:
//
//   "An administrator should never receive the credentials or tokens of
//    another administrator. These connections belong only to that
//    administrator."
//
// A rule like that fails quietly. Nobody reports it, because the person whose
// account was posted from does not see the composer that did it, and the person
// who did it sees a success message. It would surface as a member of staff
// asking why their personal account carried a university announcement they had
// never seen — by which time it is a resignation letter, not a bug report.
//
// So this file does not check the happy path. It enumerates every combination
// of scope, owner and choice and asserts who is addressable in each, and it
// checks that the answer is the same one migration 013's trigger gives. Two
// enforcement points that disagree are worse than one, because each is
// evidence to the reader that the other has been thought about.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
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

// esbuild with the `@` alias, the same way the other library tests load a
// module from this tree.
const root = new URL('../..', import.meta.url).pathname;
const out = join(root, '.test-build', 'social');
mkdirSync(out, { recursive: true });
const bundle = join(out, 'social.mjs');
execFileSync('npx', [
  'esbuild', new URL('./social.ts', import.meta.url).pathname,
  '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`, '--log-level=error',
  `--alias:@=${new URL('..', import.meta.url).pathname.replace(/\/$/, '')}`,
]);
const S = await import(bundle);

// ---------------------------------------------------------------------------
const ALICE = 'alice';
const BOB = 'bob';

const account = (id, scope, ownerId, platform, status = 'connected') => ({
  id, scope, ownerId, platform, handle: `@${id}`, status,
});

const ACCOUNTS = [
  account('uni-fb', 'university', null, 'facebook'),
  account('uni-x', 'university', null, 'x'),
  account('alice-x', 'personal', ALICE, 'x'),
  account('alice-ig', 'personal', ALICE, 'instagram'),
  account('bob-x', 'personal', BOB, 'x'),
  account('bob-li', 'personal', BOB, 'linkedin'),
];

const idsFor = (authorId, choice, platforms) =>
  S.resolveTargets({ authorId, choice, accounts: ACCOUNTS, platforms })
    .targets.map((t) => t.account.id).sort();

console.log('\nAn administrator can never address another administrator\'s account\n');

check(
  'Alice choosing "both" reaches the university accounts and her own',
  idsFor(ALICE, 'both'),
  ['alice-ig', 'alice-x', 'uni-fb', 'uni-x'],
);

check(
  '…and never Bob\'s, on any platform',
  idsFor(ALICE, 'both').filter((id) => id.startsWith('bob')),
  [],
);

check(
  'Bob choosing "both" reaches his own and the university\'s, not Alice\'s',
  idsFor(BOB, 'both'),
  ['bob-li', 'bob-x', 'uni-fb', 'uni-x'],
);

check(
  '"university" reaches no personal account at all, not even the author\'s own',
  idsFor(ALICE, 'university'),
  ['uni-fb', 'uni-x'],
);

check(
  '"personal" reaches only the author\'s own — no university account',
  idsFor(ALICE, 'personal'),
  ['alice-ig', 'alice-x'],
);

check(
  'a person with no connections of their own gets the university\'s and nothing else',
  idsFor('carol', 'both'),
  ['uni-fb', 'uni-x'],
);

check(
  '…and choosing "personal" with nothing connected reaches nowhere',
  idsFor('carol', 'personal'),
  [],
);

// THE SUPERADMIN HAS NO EXCEPTION. This is the check most likely to be
// "helpfully" broken later by someone implementing an override.
check(
  'a superadmin is not a special case: they still cannot post as Bob',
  S.resolveTargets({
    authorId: 'superadmin-vc', choice: 'both', accounts: ACCOUNTS,
  }).targets.map((t) => t.account.id).filter((id) => id.startsWith('bob') || id.startsWith('alice')),
  [],
);

check(
  'a platform filter narrows the destinations without widening the owners',
  idsFor(ALICE, 'both', ['x']),
  ['alice-x', 'uni-x'],
);

console.log('\nA connection that cannot be used is reported, not skipped in silence\n');

const WITH_DEAD = [
  account('uni-fb', 'university', null, 'facebook'),
  account('uni-ig', 'university', null, 'instagram', 'expired'),
  account('uni-li', 'university', null, 'linkedin', 'revoked'),
];

const dead = S.resolveTargets({ authorId: ALICE, choice: 'university', accounts: WITH_DEAD });

check('only the live account is a target', dead.targets.map((t) => t.account.id), ['uni-fb']);
check('the other two are reported as skipped', dead.skipped.map((s) => s.account.id), ['uni-ig', 'uni-li']);
check('…each with a reason a person can act on', dead.skipped.every((s) => s.reason.length > 10), true);

check(
  'an expired token is not publishable even while the status says connected',
  S.isPublishable({
    ...account('x', 'university', null, 'x'),
    tokenExpiresAt: new Date(Date.now() - 1000).toISOString(),
  }),
  false,
);

console.log('\nA post is checked against every platform it is actually going to\n');

const draft = (over) => ({
  authorId: ALICE,
  body: over,
  media: [],
  choice: 'university',
  variants: [],
});

const uniX = [account('uni-x', 'university', null, 'x')];
const uniFb = [account('uni-fb', 'university', null, 'facebook')];
const longBody = 'a'.repeat(400);

const problemsFor = (accounts, post) =>
  S.problemsWith(post, S.resolveTargets({ authorId: ALICE, choice: 'university', accounts }));

check(
  '400 characters is blocking on X',
  problemsFor(uniX, draft(longBody)).filter((p) => p.severity === 'blocking').map((p) => p.platform),
  ['x'],
);

check(
  '…and not a problem at all on Facebook',
  problemsFor(uniFb, draft(longBody)).length,
  0,
);

check(
  'the same post going to both is blocked once, for X only',
  problemsFor([...uniX, ...uniFb], draft(longBody))
    .filter((p) => p.severity === 'blocking').map((p) => p.platform),
  ['x'],
);

check(
  'a per-platform variant rescues it: X gets its own short text',
  problemsFor([...uniX, ...uniFb], {
    ...draft(longBody),
    variants: [{ platform: 'x', body: 'Short enough.', hashtags: [], source: 'human' }],
  }).length,
  0,
);

check(
  'hashtags count towards the limit, because they are published as part of the body',
  problemsFor(uniX, {
    ...draft('a'.repeat(270)),
    variants: [{ platform: 'x', body: 'a'.repeat(270), hashtags: ['graduation', 'theology'], source: 'human' }],
  }).filter((p) => p.severity === 'blocking').length,
  1,
);

console.log('\nMedia, alternative text and the platforms that cannot publish without them\n');

const uniIg = [account('uni-ig', 'university', null, 'instagram')];

check(
  'Instagram with no image is blocking',
  problemsFor(uniIg, draft('Congratulations to the graduating class.'))
    .filter((p) => p.severity === 'blocking').map((p) => p.message),
  ['Instagram cannot publish without an image.'],
);

check(
  'a video does not satisfy Instagram\'s requirement for an image',
  problemsFor(uniIg, {
    ...draft('Congratulations.'),
    media: [{ url: '/v.mp4', kind: 'video', altText: 'The conferral.' }],
  }).filter((p) => p.severity === 'blocking').length,
  1,
);

check(
  'an image with no alternative text blocks the post everywhere, not only on Instagram',
  problemsFor(uniFb, {
    ...draft('Congratulations.'),
    media: [{ url: '/p.jpg', kind: 'image', altText: '   ' }],
  }).filter((p) => p.severity === 'blocking').map((p) => p.platform),
  [null],
);

check(
  'an empty post is blocking',
  problemsFor(uniFb, draft('   ')).filter((p) => p.severity === 'blocking').length,
  1,
);

check(
  'a post addressed nowhere is blocking, and says so',
  S.problemsWith(draft('Real text.'), { targets: [], skipped: [], includePersonal: false })
    .filter((p) => p.severity === 'blocking').map((p) => p.message),
  ['No account is selected, so this post has nowhere to go.'],
);

check(
  '…and when the accounts exist but are all expired, it says THAT instead',
  S.problemsWith(draft('Real text.'), {
    targets: [], includePersonal: false,
    skipped: [{ account: WITH_DEAD[1], reason: 'expired' }],
  }).filter((p) => p.severity === 'blocking').map((p) => p.message),
  ['Every account this post was addressed to needs reconnecting.'],
);

check(
  'a schedule in the past is blocking',
  problemsFor(uniFb, { ...draft('Real.'), scheduledFor: new Date(Date.now() - 60000).toISOString() })
    .filter((p) => p.severity === 'blocking').length,
  1,
);

check(
  'too many hashtags is a warning, and does not stop publication',
  S.canPublish(problemsFor(uniX, {
    ...draft('Short.'),
    variants: [{ platform: 'x', body: 'Short.', hashtags: Array.from({ length: 9 }, (_, i) => `t${i}`), source: 'human' }],
  })),
  true,
);

console.log('\nThe outcome of a fan-out is reported honestly\n');

// THE REGISTER'S WORDS: pending, sending, posted, failed, skipped. This test
// used 'published' and 'queued' — words that read better and that the database
// does not accept — and passed, because it only ever compared the library to
// itself. schemaContract.test.mjs now compares TARGET_STATES to the CHECK
// constraint, which is what should have been done from the start.
check('all six posted', S.statusFromTargets(Array(6).fill('posted')), 'published');
check('all six failed', S.statusFromTargets(Array(6).fill('failed')), 'failed');
check(
  'five posted and one failed is neither of those',
  S.statusFromTargets([...Array(5).fill('posted'), 'failed']),
  'partially_failed',
);
check(
  '…and the sentence says which, so nobody reposts the five that worked',
  S.describeOutcome([...Array(5).fill('posted'), 'failed']),
  'Published to 5 of 6. 1 did not accept it and can be retried.',
);
check(
  'anything still pending means the post is still publishing',
  S.statusFromTargets(['posted', 'pending']),
  'publishing',
);
check(
  '…and so does anything still sending',
  S.statusFromTargets(['posted', 'sending']),
  'publishing',
);
check('nothing addressed is still a draft', S.statusFromTargets([]), 'draft');

console.log('\nOnly a failed destination can be tried again\n');

const targets = [
  { id: 'a', state: 'posted' },
  { id: 'b', state: 'failed' },
  { id: 'c', state: 'skipped' },
  { id: 'd', state: 'pending' },
];
check('a failed target is retryable', S.retryable(targets).map((t) => t.id), ['b']);
check(
  'a skipped one is not — its connection needs reconnecting first',
  S.retryable(targets).filter((t) => t.state === 'skipped'),
  [],
);
check(
  'and a posted one is not, because retrying it would duplicate the announcement',
  S.retryable(targets).filter((t) => t.state === 'posted'),
  [],
);

console.log('\nThe assistant drafts; it does not write on its own authority\n');

const generated = S.asAssistantDraft('x', 'Congratulations to the graduating class.', ['graduation']);
check('a generated variant is marked as such', generated.source, 'assistant');
check('…and stays marked after a human edits it', S.markEdited(generated, ALICE).source, 'assistant');
check('…but records who edited it', S.markEdited(generated, ALICE).editedBy, ALICE);
check(
  'the brief forbids inventing institutional facts',
  /Invent nothing/.test(S.ASSISTANT_BRIEF) && /accreditation/.test(S.ASSISTANT_BRIEF),
  true,
);

console.log('\nThe platform list matches what the database will accept\n');

// If these ever disagree, the failure lands after the administrator presses
// Publish — the worst possible moment to discover a typo in a CHECK constraint.
const migration = await import('node:fs').then((fs) =>
  fs.readFileSync(join(root, 'docs/migrations/013_social_and_credential_authority.sql'), 'utf8'));
const constraint = migration.match(/platform\s+text not null check \(platform in\s*\n?\s*\(([^)]+)\)/);
const inDb = constraint
  ? constraint[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).sort()
  : ['NO CHECK CONSTRAINT FOUND'];

check('every platform the composer offers is one the database accepts', [...S.PLATFORMS].sort(), inDb);

check(
  'every platform has a profile, so none can render an undefined limit',
  S.PLATFORMS.filter((p) => !S.PLATFORM_PROFILES[p]),
  [],
);

console.log(failures === 0
  ? '\nAn administrator cannot post as a colleague, and no post leaves without its checks.'
  : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
