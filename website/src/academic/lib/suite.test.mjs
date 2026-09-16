// ---------------------------------------------------------------------------
// A TEST NOBODY RUNS IS NOT A TEST.
//
// Three suites were written, passed when run by hand, and then sat outside
// `npm test` where nothing would have noticed them going red — which is worse
// than not having written them, because the repository looks tested.
//
// So the runner is checked against the filesystem: every `*.test.mjs` has to
// be reachable from `npm test`, and adding one without adding it to the suite
// fails here.
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { suite } from './testkit.mjs';

// ---------------------------------------------------------------------------
// TWO ROOTS NOW, BECAUSE THE STUDIO LIVES INSIDE THE UNIVERSITY'S TREE.
//
// This was `../..` — the Studio's own root when it was its own repository.
// Moved to website/src/academic/lib, `../..` became website/src, and the walk
// went looking for website/src/src. It crashed rather than reporting anything,
// which is the honest failure and how it was found.
//
// `PROJECT` is where package.json is; `MINE` is the only tree this file has an
// opinion about. It must NOT walk all of src: the University has its own forty
// suites registered under their own names, and demanding they appear as
// `studio:*` scripts would be this file claiming the whole repository.
// ---------------------------------------------------------------------------
const PROJECT = join(import.meta.dirname, '../../..');
const MINE = join(PROJECT, 'src', 'academic');
const root = MINE;
const t = suite('Every suite is in the suite');

const found = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith('.test.mjs')) found.push(relative(PROJECT, path));
  }
}
walk(MINE);

const scripts = JSON.parse(readFileSync(join(PROJECT, 'package.json'), 'utf8')).scripts;
// ---------------------------------------------------------------------------
// FOLLOW THE CHAIN, DON'T READ ONE LINE.
//
// This read `scripts.test` and asked whether it mentions `npm run <name>`.
// That worked while every suite hung directly off `test`. Folded into the
// University's package.json the Studio's thirty-six sit one step down —
// `test` runs `test:studio`, which runs `studio:suite`, `studio:ownership`
// and the rest — so every one of them read as unregistered while all thirty-six
// were in fact running.
//
// A check that cannot see through one level of indirection reports a suite as
// dead while it is passing, which is the kind of false alarm that gets a file
// deleted.
// ---------------------------------------------------------------------------
const reached = new Set();
(function follow(name) {
  if (reached.has(name) || !scripts[name]) return;
  reached.add(name);
  for (const m of scripts[name].matchAll(/npm run ([\w:-]+)/g)) follow(m[1]);
}('test'));
const all = [...reached].map((n) => `npm run ${n}`).join(' && ');
const reachable = new Set();
// ---------------------------------------------------------------------------
// BOTH SIDES SCOPED TO THE STUDIO, and the second one matters as much as the
// first. Walking only src/academic while still reading EVERY script made this
// file report the University's seventy-three suites as pointing at files that
// do not exist — a meta-test claiming the whole repository because it moved
// into it.
//
// It has an opinion about one tree. The University's own suites are registered
// under their own names and are not this file's business.
// ---------------------------------------------------------------------------
const MINE_PREFIX = 'src/academic/';
for (const [name, command] of Object.entries(scripts)) {
  if (name === 'test' || !all.includes(`npm run ${name}`)) continue;
  const match = command.match(/node\s+(\S+\.test\.mjs)/);
  if (match && match[1].startsWith(MINE_PREFIX)) reachable.add(match[1]);
}

t.check('every Studio test file on disk is run by `npm test`',
  found.filter((file) => !reachable.has(file)), []);
t.check('and every Studio test `npm test` runs is a file that exists',
  [...reachable].filter((file) => !found.includes(file)), []);
t.check('there is more than one of them', found.length > 20, true);

t.done();
