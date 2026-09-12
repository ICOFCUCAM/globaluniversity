// ---------------------------------------------------------------------------
// THE INSTITUTION SPEAKING.
//
// Run with:  node src/lib/announcements.test.mjs
//
// ---------------------------------------------------------------------------
// WHAT THIS GUARDS
// ---------------------------------------------------------------------------
//
// The Announcements page was a noticeboard with no table: a notice was a row on
// `documents` with its text packed into a data-URL, posted by anybody whose
// role was `admin` or `lecturer`, alone and instantly, with no author on the
// record and no history.
//
// The rules that replace it are worth exactly as much as they refuse. This
// calls each one.
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

const here = new URL('.', import.meta.url).pathname;
const cache = join(here, '../../node_modules/.cache/icof');
mkdirSync(cache, { recursive: true });
const out = join(cache, 'announcements.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'announcements.ts'), '--bundle', '--format=esm', '--platform=node',
  `--outfile=${out}`, '--log-level=error', `--alias:@=${join(here, '..')}`,
]);
const A = await import(out);

console.log('\nThe portal is where the announcement is, not one destination among eight\n');

{
  // THE RULE THAT STOPS THE CANONICAL RECORD LIVING ON SOMEBODY ELSE'S SERVER.
  // A tick box somebody could clear would allow an announcement published to
  // Facebook and nowhere in the University's own system.
  check('nothing chosen still reaches the portal',
    A.resolveDestinations([]), ['portal']);
  check('the portal cannot be left out',
    A.resolveDestinations(['facebook', 'x']).includes('portal'), true);
  check('an invented destination is dropped',
    A.resolveDestinations(['facebook', 'carrier_pigeon']), ['portal', 'facebook']);
  check('and the order is the registry’s, so the screen is stable',
    A.resolveDestinations(['x', 'facebook']), ['portal', 'facebook', 'x']);
}

console.log('\nThe author is not the second pair of eyes\n');

{
  // The rule the whole arrangement rests on. 005 requires it of a certificate
  // design, 009 of a grade, 014 of a social post.
  const submitted = { status: 'submitted', author_id: 'alice' };
  check('the author cannot clear their own', A.canDecide(submitted, 'alice'), false);
  check('somebody else can', A.canDecide(submitted, 'bob'), true);

  // A SUPERADMINISTRATOR WHO WROTE IT IS STILL ITS AUTHOR. The function takes
  // an id and no role, deliberately: holding every capability is not the same
  // as being somebody else, and a role argument here would invite an exception.
  check('the rule is about identity, not rank', A.canDecide.length, 2);

  check('a draft is not awaiting anybody',
    A.canDecide({ status: 'draft', author_id: 'alice' }, 'bob'), false);
  check('nor is one already cleared',
    A.canDecide({ status: 'approved', author_id: 'alice' }, 'bob'), false);
}

console.log('\nWhat was cleared is what is published\n');

{
  // Editing after submission would return exactly the arrangement this
  // replaces: words nobody read going out under the University's name.
  check('a draft can be edited', A.canEdit({ status: 'draft' }), true);
  check('a returned one can be', A.canEdit({ status: 'rejected' }), true);
  check('one awaiting clearance cannot', A.canEdit({ status: 'submitted' }), false);
  check('nor can a cleared one', A.canEdit({ status: 'approved' }), false);
  check('nor a published one', A.canEdit({ status: 'published' }), false);
}

console.log('\nThe portal carries it before anybody else does\n');

{
  // A student who reads about their own institution on Instagram and finds
  // nothing when they sign in has been told by a stranger.
  check('a cleared announcement cannot go straight to the networks',
    A.canReleaseExternally({ status: 'approved' }), false);
  check('a published one can', A.canReleaseExternally({ status: 'published' }), true);
  check('a draft certainly cannot', A.canReleaseExternally({ status: 'draft' }), false);
}

console.log('\nRetracting is not deleting\n');

{
  check('something published can be taken down', A.canRetract({ status: 'published' }), true);
  check('a draft has nothing to take down', A.canRetract({ status: 'draft' }), false);
  // `retracted` IS IN THE VOCABULARY AND `deleted` IS NOT. The University has
  // to be able to say that it said something and then took it back, and the
  // copy on Facebook does not disappear because a database row did.
  check('the vocabulary has a word for it',
    A.ANNOUNCEMENT_STATES.includes('retracted'), true);
  check('and a retracted notice is not shown as published',
    A.PUBLICLY_VISIBLE.includes('retracted'), false);
  check('only a published one is public', A.PUBLICLY_VISIBLE, ['published']);
}

console.log('\nWhat is wrong is said before the click, and all of it at once\n');

{
  const bare = { title: 'x', body: 'short', category: 'general', audiences: ['students'] };
  const codes = A.objectionsTo(bare, []).map((o) => o.code).sort();
  check('a thin announcement is refused on both counts',
    codes, ['body-too-short', 'title-too-short']);

  const good = {
    title: 'Applications are open',
    body: 'Applications for the 2026/2027 academic year are open from today.',
    category: 'admissions',
    audiences: ['applicants'],
  };
  check('a complete one has nothing against it', A.objectionsTo(good, []), []);

  check('a category is required',
    A.objectionsTo({ ...good, category: null }, []).map((o) => o.code), ['no-category']);
  check('and so is an audience',
    A.objectionsTo({ ...good, audiences: [] }, []).map((o) => o.code), ['no-audience']);

  // AN IMAGE WITHOUT ALT TEXT. 013 already requires it of social media; the
  // University's own noticeboard is an odd place to require less.
  check('an image must be described',
    A.objectionsTo({ ...good, image_path: 'a/b.jpg' }, [], { hasImage: true })
      .map((o) => o.code), ['image-without-alt-text']);
  check('…and a described one passes',
    A.objectionsTo({ ...good, image_path: 'a/b.jpg', image_alt: 'Graduands on the steps' },
      [], { hasImage: true }), []);

  // INSTAGRAM AND YOUTUBE REFUSE TEXT, and being told now beats discovering it
  // when a platform returns an error hours later.
  check('Instagram without an image is refused',
    A.objectionsTo(good, ['instagram']).map((o) => o.code), ['instagram-needs-an-image']);
  check('…and with one is not',
    A.objectionsTo(good, ['instagram'], { hasImage: true }), []);
  check('YouTube cannot carry a written announcement at all',
    A.objectionsTo(good, ['youtube'], { hasImage: true }).map((o) => o.code),
    ['youtube-needs-video']);
  check('an unconnected account is refused before anything is sent',
    A.objectionsTo(good, ['linkedin'], { connected: { linkedin: false } }).map((o) => o.code),
    ['not-connected:linkedin']);

  // A WARNING IS NOT A REFUSAL. Addressing the public is a decision somebody
  // may genuinely mean; it is said out loud and it does not block.
  const pub = A.objectionsTo({ ...good, audiences: ['public'] }, []);
  check('addressing the world is flagged', pub.map((o) => o.code), ['addressed-to-the-public']);
  check('…and does not stop the announcement', A.blocks(pub), false);
  check('but a missing audience does',
    A.blocks(A.objectionsTo({ ...good, audiences: [] }, [])), true);
}

console.log('\nWhere it actually reached is never rounded up to “published”\n');

{
  // The reason each destination has its own row. A single flag would read
  // "published" when one network accepted it and five refused.
  check('all delivered', A.describeDelivery(['delivered', 'delivered']),
    'Published to all 2.');
  check('a partial failure says so, and says it can be retried',
    A.describeDelivery(['delivered', 'failed']),
    'Published to 1, failed at 1. The failures can be tried again.');
  check('total failure does not claim a publication',
    A.describeDelivery(['failed', 'failed']), 'Failed at all 2. Nothing was published.');
  check('and nothing sent is not nothing wrong', A.describeDelivery([]), 'Nowhere yet.');
}

console.log('\nEach platform gets the announcement in its own voice, or the master\n');

{
  const master = {
    title: 'Applications are open',
    body: 'Applications for the 2026/2027 academic year are open from today at iguc.net.',
  };

  const none = A.previewFor(master, [], ['facebook', 'x']);
  check('every external destination is previewed', none.map((p) => p.platform), ['facebook', 'x']);
  // A PLATFORM WITH NO VARIANT FALLS BACK TO THE MASTER. Requiring one per
  // destination would mean an urgent notice waits for five rewrites, and
  // urgency is exactly when the rewriting does not happen.
  check('and falls back to the master when nothing was written',
    none.every((p) => p.draft.fallsBackToMaster), true);
  check('the portal is not previewed as a social post',
    A.previewFor(master, [], []).length, 0);

  const withVariant = A.previewFor(master, [
    { platform: 'x', body: 'Applications are open.', hashtags: ['IGUC', 'Admissions'], source: 'human' },
  ], ['x']);
  check('a variant replaces the master', withVariant[0].text.startsWith('Applications are open.'), true);
  check('…and its hashtags are appended with a hash',
    withVariant[0].text.includes('#IGUC #Admissions'), true);
  check('…and it no longer falls back', withVariant[0].draft.fallsBackToMaster, false);

  // OVER THE LIMIT IS A NUMBER, not a disabled button. A greyed-out Publish
  // leaves somebody staring at six destinations not knowing which objected.
  const long = { title: 'A notice', body: 'x'.repeat(5000) };
  const over = A.previewFor(long, [], ['x'])[0];
  check('too long for the platform is measured', over.over > 0, true);
  check('and short enough is zero', A.previewFor(master, [], ['x'])[0].over, 0);
}

console.log('\nA starting draft is marked as one\n');

{
  const master = { title: 'A notice about something', body: 'y'.repeat(1000) };
  const started = A.startingVariants(master, ['x', 'linkedin']);
  check('one per external destination', started.map((v) => v.platform), ['x', 'linkedin']);

  // EVERY GENERATED DRAFT IS MARKED `assistant`. A sentence the University
  // publishes under its own name that nobody chose is the thing this column
  // exists to make visible — a person editing it makes it theirs.
  check('and none of them claims a person wrote it',
    started.every((v) => v.source === 'assistant'), true);
  check('each fits the platform it is for',
    started.every((v) => v.body.length <= 5000), true);
  // CUT AT A SENTENCE, NEVER MID-WORD. A university publishing half a sentence
  // is worse than one publishing a short one.
  check('the short one was actually shortened',
    started.find((v) => v.platform === 'x').body.length < 1000, true);
}

console.log('\nThe capability, the route and the migration agree\n');

{
  const route = readFileSync(join(here, '../app/api/announcements/route.ts'), 'utf8');
  const roles = readFileSync(join(here, 'roles.ts'), 'utf8');
  const sql = readFileSync(
    join(here, '../../docs/migrations/038_announcements_are_the_institution_speaking.sql'), 'utf8');

  for (const cap of ['compose-announcement', 'approve-announcement', 'publish-announcement']) {
    check(`${cap} is a real capability`, roles.includes(`'${cap}'`), true);
    check(`…and the route names it`, route.includes(`'${cap}'`), true);
  }

  // RELEASING OUTWARD NEEDS THE SOCIAL AUTHORITY TOO. Without this the new
  // door is a way round the rule that already governs the University's
  // outward voice.
  check('releasing outward also requires publishing socially',
    /publish-social-post/.test(route), true);

  // AND THE DATABASE HOLDS THE SEPARATION, not only the route. The route is
  // one caller; the constraint is the rule.
  check('the database refuses an author clearing their own',
    /approved_by <> author_id/.test(sql), true);
  check('the history is append-only in the database',
    /announcement_events_append_only/.test(sql), true);
}

console.log(failures === 0 ? '\nAll announcement checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
