// ---------------------------------------------------------------------------
// The examination paper — can the University produce what a candidate saw?
//
// Run with:  node src/lib/examPaper.test.mjs
//
// WHY THIS FILE EXISTS. Randomised papers fail in ways that look like the
// candidate's fault:
//
//   A refresh that reshuffles moves every answer onto the wrong question, and
//   the result is indistinguishable from a candidate who answered badly.
//
//   Shuffled options marked against the bank's original index mark everybody
//   wrong except the candidates whose shuffle happened to be the identity.
//
//   An appeal asking "which question was number 4" cannot be answered at all if
//   the order was generated and thrown away.
//
// None of these produces an error. Every one produces a plausible mark.
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

const root = new URL('../..', import.meta.url).pathname;
const out = join(root, '.test-build', 'paper');
mkdirSync(out, { recursive: true });
const bundle = join(out, 'examPaper.mjs');
execFileSync('npx', [
  'esbuild', new URL('./examPaper.ts', import.meta.url).pathname,
  '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`, '--log-level=error',
  `--alias:@=${new URL('..', import.meta.url).pathname.replace(/\/$/, '')}`,
]);
const P = await import(bundle);

// ---------------------------------------------------------------------------
const BANK = [
  { id: 'q1', text: 'Who wrote the Epistle to the Romans?', options: ['Paul', 'Peter', 'John', 'James'], answer: 0 },
  { id: 'q2', text: 'In what language was most of the New Testament written?', options: ['Latin', 'Koine Greek', 'Aramaic', 'Hebrew'], answer: 1 },
  { id: 'q3', text: 'How many books are in the Pentateuch?', options: ['3', '4', '5', '6'], answer: 2 },
  { id: 'q4', text: 'Discuss the doctrine of the incarnation.', options: [], answer: undefined },
];

const spec = (over) => ({ randomiseQuestions: true, randomiseOptions: true, totalMarks: 100, ...over });

console.log('\nThe same seed always produces the same paper\n');

const a = P.buildPaper(BANK, spec(), 'session-abc');
const b = P.buildPaper(BANK, spec(), 'session-abc');

check(
  'a refresh reproduces the question order exactly',
  a.questions.map((q) => q.id),
  b.questions.map((q) => q.id),
);
check(
  '…and the option order within each question',
  a.questions.map((q) => q.options.join('|')),
  b.questions.map((q) => q.options.join('|')),
);
check(
  '…and therefore where the correct answer sits',
  a.questions.map((q) => q.correct ?? null),
  b.questions.map((q) => q.correct ?? null),
);

const other = P.buildPaper(BANK, spec(), 'session-xyz');
check(
  'a different candidate gets a different arrangement',
  a.questions.map((q) => q.id).join() === other.questions.map((q) => q.id).join(),
  false,
);

// THE BUG THIS CATCHES: shuffling the bank in place would make the second
// candidate's order depend on the first's, so replaying either alone would
// produce something neither of them saw.
check(
  'building a paper does not disturb the bank',
  BANK.map((q) => q.id),
  ['q1', 'q2', 'q3', 'q4'],
);

console.log('\nEach question’s options permute independently\n');

// If every question used the same seed, the correct answer would move by the
// same amount on all of them — a pattern a candidate notices in three
// questions and can then exploit for the rest of the paper.
const many = Array.from({ length: 12 }, (_, i) => ({
  id: `m${i}`, text: `Question ${i}`, options: ['A', 'B', 'C', 'D'], answer: 0,
}));
const spread = P.buildPaper(many, spec({ randomiseQuestions: false }), 'seed');
const positions = new Set(spread.questions.map((q) => q.correct));
check('the correct option does not land in the same place every time', positions.size > 1, true);

console.log('\nThe correct answer follows its option through the shuffle\n');

const one = P.buildPaper([BANK[0]], spec({ randomiseQuestions: false }), 'seed-1').questions[0];
check(
  'whatever position it moved to, that position holds the right text',
  one.options[one.correct],
  'Paul',
);

// Written questions have no key at all.
const written = P.buildPaper([BANK[3]], spec(), 'seed').questions[0];
check('a written question carries no answer key', written.correct, undefined);
check('…and no options', written.options, []);

console.log('\nThe answer key never reaches the browser\n');

const sent = P.forCandidate(a);
check(
  'no question sent to the candidate carries `correct`',
  sent.questions.filter((q) => 'correct' in q).length,
  0,
);
check('…but the questions themselves are all there', sent.questions.length, a.questions.length);
check('…and the numbering is unchanged', sent.questions.map((q) => q.number), a.questions.map((q) => q.number));
check(
  'stripping does not damage the original — marking still works afterwards',
  a.questions.every((q) => q.options.length === 0 || q.correct !== undefined),
  true,
);

console.log('\nMarks add up to the paper’s total\n');

const four = P.buildPaper(BANK, spec({ totalMarks: 100 }), 'seed');
check('four questions out of 100 still total 100', four.totalMarks, 100);

const three = P.buildPaper(BANK.slice(0, 3), spec({ totalMarks: 100 }), 'seed');
check('three questions out of 100 total 100, not 99', three.totalMarks, 100);

const seven = P.buildPaper(
  Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, text: 't', options: ['a', 'b'], answer: 0 })),
  spec({ totalMarks: 100 }), 'seed',
);
check('seven questions out of 100 total 100', seven.totalMarks, 100);

check(
  'a question that states its own marks keeps them',
  P.buildPaper([{ id: 'w', text: 'Essay', options: [], marks: 40 }], spec({ totalMarks: 100 }), 's')
    .questions[0].marks,
  40,
);

console.log('\nMarking is against what the candidate saw\n');

const paper = P.buildPaper(BANK.slice(0, 3), spec(), 'marking-seed');

// The candidate answers every question correctly, choosing by the position the
// correct option actually occupied on THEIR paper.
const perfect = paper.questions.map((q) => ({ questionId: q.id, chosen: q.correct }));
const full = P.autoMark(paper, perfect);
check('all correct scores the full objective total', full.total, full.outOf);

// THE BUG THIS CATCHES: marking against the bank's original index. Every
// candidate whose shuffle was not the identity would be marked wrong.
const naive = paper.questions.map((q) => ({ questionId: q.id, chosen: 0 }));
const naiveResult = P.autoMark(paper, naive);
check(
  'choosing option A everywhere does NOT score full marks',
  naiveResult.total === naiveResult.outOf,
  false,
);

const partial = P.autoMark(paper, [
  { questionId: paper.questions[0].id, chosen: paper.questions[0].correct },
]);
check('an unanswered question scores zero rather than vanishing', partial.marks.length, 3);
check(
  '…and says so, so the arithmetic can be checked',
  partial.marks.filter((m) => m.note === 'No answer was given.').length,
  2,
);
check(
  'a wrong answer names the options as THIS candidate saw them',
  /Chose “.+”\. The correct answer was “.+”\./.test(
    P.autoMark(paper, paper.questions.map((q) => ({
      questionId: q.id, chosen: (q.correct + 1) % q.options.length,
    }))).marks[0].note,
  ),
  true,
);

console.log('\nNothing written is ever machine-marked\n');

const mixed = P.buildPaper(BANK, spec(), 'mixed-seed');
const marked = P.autoMark(mixed, mixed.questions.map((q) => ({ questionId: q.id, chosen: q.correct })));

check('the essay is set aside for a person', marked.forHuman.map((q) => q.id), ['q4']);
check('…and is not given a mark', marked.marks.filter((m) => m.questionId === 'q4').length, 0);
check(
  'the objective total is out of the objective marks only, not the paper',
  marked.outOf < mixed.totalMarks,
  true,
);

check('a mixed paper is not fully objective', P.fullyObjective(mixed), false);
check('an all-choice paper is', P.fullyObjective(paper), true);
check('an empty paper is not', P.fullyObjective({ seed: 's', questions: [], totalMarks: 0 }), false);

console.log('\nDrawing a subset\n');

const drawn = P.buildPaper(BANK, spec({ count: 2, totalMarks: 50 }), 'seed');
check('two questions are drawn', drawn.questions.length, 2);
check('…numbered from one', drawn.questions.map((q) => q.number), [1, 2]);
check('…and worth the whole paper between them', drawn.totalMarks, 50);

console.log('\nRandomisation can be switched off\n');

const plain = P.buildPaper(BANK, spec({ randomiseQuestions: false, randomiseOptions: false }), 'seed');
check('question order is the bank’s', plain.questions.map((q) => q.id), ['q1', 'q2', 'q3', 'q4']);
check('option order is the bank’s', plain.questions[0].options, ['Paul', 'Peter', 'John', 'James']);
check('and the key is the bank’s index', plain.questions[0].correct, 0);

console.log(failures === 0
  ? '\nEvery candidate’s paper can be reproduced exactly, and marked as they saw it.'
  : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
