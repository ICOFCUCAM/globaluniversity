// ---------------------------------------------------------------------------
// THE COURSE LEARNING HUB SPEAKS THE DATABASE'S VOCABULARY.
//
// Run with:  node src/lib/courseHub.test.mjs
//
// ---------------------------------------------------------------------------
// WHAT WAS THERE
// ---------------------------------------------------------------------------
//
// 084 built modules and lessons, 085 activities and their answer keys, 086 the
// tutor's citations, 087 the rule that a module unlocks only when the one
// before it is finished. The row policies were written carefully and
// `my_module_progress` and `my_course_progress` were built to report how far
// through a student is — AND NOT ONE SCREEN READ ANY OF IT. Four migrations
// of learning material reachable only by writing SQL.
//
// ---------------------------------------------------------------------------
// WHAT HAS TO STAY TRUE
// ---------------------------------------------------------------------------
//
// 1. THE WORDS MATCH. `lesson_progress.state` is `started` or `completed` —
//    not `complete`, not `in_progress`, which is what they are called in most
//    systems and what this screen said first. A CHECK constraint refuses
//    anything else, so the wrong word is a Mark-as-done button that simply
//    does not work, for everybody, silently.
//
// 2. UN-MARKING CLEARS THE DATE. `lesson_progress_completed_has_a_moment`
//    requires `completed_at` to be set EXACTLY when the state is `completed`.
//    A screen that changed only the word would be refused.
//
// 3. EVERY KIND OF LESSON HAS A LABEL. Ten in the constraint; one missing
//    here renders as a blank line in a reading list.
//
// 4. THE SCREEN ASKS THE DATABASE WHAT IS READABLE. The policies decide which
//    modules and lessons arrive; this file never filters material it was
//    given, and a locked module is SHOWN rather than hidden, because 087's
//    unlocking is a sequence and not a secret.
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
    'esbuild', join(here, from),
    '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error',
    `--alias:@=${join(root, 'src')}`,
  ]);
  return out;
};

const sql = read('docs/migrations/084_a_course_is_a_place_to_learn.sql');
const screen = read('src/components/courses/CourseHub.tsx');
const nav = read('src/lib/portalNav.tsx');

// PROSE IS CHECKED ON A WHITESPACE-COLLAPSED COPY. JSX wraps a sentence
// across lines wherever it happens to reach the margin, so a regex for a
// phrase that spans a line break fails on the formatting rather than on the
// words — which is a test that breaks when somebody reflows a paragraph.
const said = screen.replace(/\s+/g, ' ');

const {
  LESSON_KINDS, lessonKindLabel, lessonProgressPatch, LESSON_STARTED, LESSON_COMPLETED,
} = await import(bundle('coursehub.mjs', 'courseHub.ts'));

// ---------------------------------------------------------------------------
console.log('\nThe two progress states are the database’s two words\n');

// READ OUT OF 084'S CHECK CONSTRAINT. Writing the pair here by hand would
// prove that somebody can type, which is exactly what went wrong: the screen
// first said 'complete' and 'in_progress', which the constraint refuses.
const stateCheck = /state\s+text not null default 'started' check \(state in \(([^)]*)\)\)/
  .exec(sql);
check('084 states the two states', Boolean(stateCheck), true);
const fromSql = [...(stateCheck ? stateCheck[1] : '').matchAll(/'([a-z_]+)'/g)]
  .map((m) => m[1]).sort();
check('…and the screen knows exactly those', [LESSON_COMPLETED, LESSON_STARTED].sort(), fromSql);

// THE TWO WORDS THAT LOOK RIGHT AND ARE NOT. Named individually because they
// are what a reasonable person writes, and the failure is silent.
check('it is not "complete"', LESSON_COMPLETED === 'complete', false);
check('…nor "in_progress"', LESSON_STARTED === 'in_progress', false);
check('the screen holds no state word of its own',
  /'complete'|'in_progress'/.test(screen), false);

// ---------------------------------------------------------------------------
console.log('\nUn-marking a lesson clears the date, because the constraint says so\n');

check('084 ties the state to the moment',
  /completed_has_a_moment/.test(sql), true);
const done = lessonProgressPatch(true);
const undone = lessonProgressPatch(false);
check('marking done sets a completion date', typeof done.completed_at, 'string');
check('…and the state that goes with it', done.state, LESSON_COMPLETED);
check('un-marking CLEARS the date rather than leaving it', undone.completed_at, null);
check('…and drops back to started', undone.state, LESSON_STARTED);

// ---------------------------------------------------------------------------
console.log('\nEvery kind of lesson has a label\n');

const kindCheck = /kind\s+text not null check \(kind in \(([\s\S]*?)\)\)/.exec(sql);
check('084 states the kinds', Boolean(kindCheck), true);
const kinds = [...(kindCheck ? kindCheck[1] : '').matchAll(/'([a-z_]+)'/g)]
  .map((m) => m[1]).sort();
check('…ten of them', kinds.length, 10);
check('…and the screen labels every one',
  kinds.filter((k) => !LESSON_KINDS[k]), []);
check('a kind nobody taught it shows as itself', lessonKindLabel('hologram'), 'hologram');

// ---------------------------------------------------------------------------
console.log('\nA locked module is shown, not hidden\n');

// 087'S UNLOCKING IS A SEQUENCE, NOT A SECRET. A student is entitled to see
// that Module 3 exists and what opens it; hiding it makes the course look
// shorter than it is.
check('the screen draws a locked module', /Locked/.test(said), true);
check('…and says what opens it',
  /opens when the one before it is complete/.test(said), true);
check('…and does not pretend to withhold material it never received',
  /its material is not released yet/.test(said), true);

// AND IT NEVER FILTERS WHAT THE DATABASE GAVE IT. The policies decide; a
// second filter here would be a second opinion, and the two would disagree.
check('the screen has no visibility rule of its own',
  /\.eq\('visible'|visible === true|\.visible &&/.test(screen), false);

// ---------------------------------------------------------------------------
console.log('\nA full progress bar is not a pass\n');

// THE ONE PLACE SOMEBODY MIGHT THINK OTHERWISE is under the percentage, so
// that is where it is said.
check('the screen says progress reaches no academic record',
  /reaches no academic record/.test(said), true);
check('…and names what does', /approval chain/.test(said), true);

// ---------------------------------------------------------------------------
console.log('\nAnd it is on the menu, where the work is\n');

check('the hub has a menu entry', /id: 'course-hub'/.test(nav), true);
// IMMEDIATELY AFTER "My courses": these are your courses, and this is what is
// in them.
check('…immediately after My courses',
  nav.indexOf("id: 'my-courses'") < nav.indexOf("id: 'course-hub'")
  && nav.slice(nav.indexOf("id: 'my-courses'"), nav.indexOf("id: 'course-hub'"))
    .split("id: '").length === 2,
  true);
check('…on the same capability, because reading your own course material is '
  + 'not a second permission',
  /id: 'course-hub'[\s\S]{0,400}capability: 'view-own-courses'/.test(nav), true);

// ---------------------------------------------------------------------------
console.log(failures === 0
  ? '\nAll good.\n'
  : `\n${failures} failure${failures === 1 ? '' : 's'}.\n`);
process.exit(failures === 0 ? 0 : 1);
