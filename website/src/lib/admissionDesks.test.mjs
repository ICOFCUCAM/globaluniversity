// ---------------------------------------------------------------------------
// NO APPLICATION IS INVISIBLE.
//
// Run with:  node src/lib/admissionDesks.test.mjs
//
// ---------------------------------------------------------------------------
// THE DEFECT THIS EXISTS TO CATCH
// ---------------------------------------------------------------------------
//
// The University asked why some applications were completely not visible in the
// administration portal. Nothing was deleted and nothing was refused by a
// policy: the rows were there, and no screen asked for them.
//
// Every desk carried its own hand-written list of statuses in its own query —
// six lists, in four files, none able to see the others, all written before
// migrations 023–026 widened the vocabulary. So a state on no list was a record
// that existed and that no screen fetched.
//
// It was not a corner case. ALL FOUR of the Head of Academic Affairs' outcomes
// fell through the gap: approve produced `admission_issued`, reject produced
// `rejected`, and the panel meant to show decided applications was looking for
// `approved` and `declined` — the older Registrar-led pipeline's spellings. The
// office took a decision and the application vanished from every admissions
// screen in the system.
//
// The lists now live once, in ADMISSION_DESKS, beside the vocabulary they are
// drawn from. This file is what makes that worth anything: it fails if any
// state lands on no desk, so adding a state and forgetting a queue is a red
// test rather than a silence.
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
const dir = join(here, '../../node_modules/.cache/icof');
mkdirSync(dir, { recursive: true });
const out = join(dir, 'admissionDesks.mjs');
execFileSync('npx', [
  'esbuild', join(here, 'admissionWorkflow.ts'),
  '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error',
]);
const W = await import(out);

// ---------------------------------------------------------------------------

console.log('\nEvery state the vocabulary declares is on somebody’s desk\n');

check('no state is invisible', W.statesNobodyCanSee(), []);

// A typo in a desk's list is silent in exactly the same way a missing state is:
// `.in('status', ['admission_issed'])` matches nothing and looks like an empty
// queue.
{
  const unknown = [];
  for (const [key, desk] of Object.entries(W.ADMISSION_DESKS)) {
    for (const s of desk.states) {
      if (!W.ADMISSION_STATES.includes(s)) unknown.push(`${key}:${s}`);
    }
  }
  check('no desk names a state that does not exist', unknown, []);
}

// An exemption is a claim somebody defends in review. It has to name a real
// state and give a reason, or it is just a way of silencing the test.
{
  const bad = Object.entries(W.NOT_ON_ANY_DESK)
    .filter(([s, why]) => !W.ADMISSION_STATES.includes(s) || String(why).trim().length < 30)
    .map(([s]) => s);
  check('every exemption names a real state and gives a reason', bad, []);
  check('and only `draft` is exempt', Object.keys(W.NOT_ON_ANY_DESK), ['draft']);
}

console.log('\nThe four outcomes this desk can produce are each visible somewhere\n');

// THE REGRESSION, NAMED. These are the states the Head of Academic Affairs'
// four decisions actually produce, and every one of them was on no queue.
{
  const visible = new Set(W.statesOnSomeDesk());
  const outcomes = {
    'approve → admission_issued': 'admission_issued',
    'reject → rejected': 'rejected',
    'conditional → conditional': 'conditional',
    'return → returned': 'returned',
  };
  for (const [what, state] of Object.entries(outcomes)) {
    check(`${what} is listed by a desk`, visible.has(state), true);
  }
  // And a returned application goes back to the office that corrects it.
  check('a returned application is on the Admissions Office queue',
    W.statesForDesk('admissions-office').includes('returned'), true);
  // The three the old pipeline writes, which the vocabulary did not name.
  for (const s of ['registrar_approved', 'declined', 'deferred']) {
    check(`the legacy state \`${s}\` is declared`, W.ADMISSION_STATES.includes(s), true);
    check(`…and is listed by a desk`, visible.has(s), true);
  }
}

console.log('\nEvery state a desk shows can actually be reached\n');

// ---------------------------------------------------------------------------
// THE MIRROR OF THE INVISIBILITY DEFECT.
//
// There, records existed and no screen asked for them. Here, a screen asks and
// no record can ever arrive: a state the vocabulary declares, a desk lists, and
// no code path writes. The queue is permanently empty and nothing says why.
//
// Six were found this way, and the worst is `ready_for_academic_review` — the
// state the five-stage design puts on the Head of Academic Affairs' desk.
// Nothing produces it. Applications reach that desk only through `fee_paid`
// and `documents_required`, the older pipeline's states, which DECIDABLE_FROM
// carries as a compatibility measure. The doorway into the final stage was
// never built, and the desk worked anyway, so nobody noticed.
//
// An unreachable state is not automatically a bug — it may be a step not yet
// built — but it must be DECLARED as one rather than sit silently.
// ---------------------------------------------------------------------------
{
  const srcDir = new URL('../', import.meta.url).pathname;

  // Literal writes: `status: 'x'` anywhere in the application.
  const literals = new Set(
    (execFileSync('grep', [
      '-rhoE', "status: '[a-z_]+'", '--include=*.ts', '--include=*.tsx', srcDir,
    ]).toString().match(/'[a-z_]+'/g) ?? []).map((s) => s.replace(/'/g, '')),
  );

  // AND THE ONES WRITTEN THROUGH A VARIABLE. The decision route writes
  // `status: newStatus`, where newStatus is ACADEMIC_DECISIONS[d].becomes — so
  // a scan for literals alone would report all four outcomes as unreachable.
  const route = readFileSync(
    join(srcDir, 'app/api/admissions/decision/route.ts'), 'utf8',
  );
  if (/status: newStatus/.test(route)) {
    for (const d of Object.values(W.ACADEMIC_DECISIONS)) literals.add(d.becomes);
  }

  // THE SAME TRICK, FOR THE VERIFICATION STEPS. /api/admissions/verification
  // writes `status: step.to`, where the step comes out of VERIFICATION_STEPS —
  // so the three states it exists to make reachable would read as unreachable
  // to a scan for literals, and this test would go on reporting a gap that had
  // just been closed. Conditional on the route actually doing it, so deleting
  // the route brings the gap back rather than leaving the test vouching for it.
  const verification = readFileSync(
    join(srcDir, 'app/api/admissions/verification/route.ts'), 'utf8',
  );
  if (/status: step\.to/.test(verification)) {
    for (const v of Object.values(W.VERIFICATION_STEPS)) literals.add(v.to);
  }

  check('the scan found states being written', literals.size > 5, true);

  const unreachable = W.ADMISSION_STATES.filter((s) => !literals.has(s));
  check('every unreachable state is declared, with what is missing',
    unreachable.filter((s) => !(s in W.NOT_YET_REACHABLE)), []);

  // AND NOTHING IS LISTED THAT IS ACTUALLY REACHABLE. A stale entry here would
  // describe a gap that has since been closed, which is its own kind of lie.
  check('nothing is declared unreachable that code can in fact produce',
    Object.keys(W.NOT_YET_REACHABLE).filter((s) => literals.has(s)), []);

  const thin = Object.entries(W.NOT_YET_REACHABLE)
    .filter(([, why]) => String(why).trim().length < 40).map(([s]) => s);
  check('each one says what is missing rather than merely that it is', thin, []);
}

console.log('\nEvery state a desk shows has something to render\n');

// ---------------------------------------------------------------------------
// THE FAILURE THIS CATCHES IS A BLANK SCREEN, NOT A MISSING ROW.
//
// The desks render `stages[stageOf(row)]` and read `.tone` and `.label` off it.
// A state on a desk with no entry in `stages` is `undefined.tone` — a
// TypeError thrown mid-render, which in React takes out the whole panel rather
// than the one row. Widening the queues without widening `stages` would have
// swapped an invisible application for a broken page.
//
// The keys are read out of the source rather than imported because
// src/lib/admissions.ts constructs the Supabase client at module scope, and a
// test should not need credentials to check a lookup table.
// ---------------------------------------------------------------------------
{
  const text = readFileSync(join(here, 'admissions.ts'), 'utf8');
  const block = /export const stages: Record<AdmissionStage, StageMeta> = \{([\s\S]*?)\n\};/
    .exec(text)?.[1] ?? '';
  const chips = [...block.matchAll(/^ {2}(\w+): \{/gm)].map((m) => m[1]);

  check('the chip table was actually found', chips.length > 5, true);

  const shown = new Set(Object.values(W.ADMISSION_DESKS).flatMap((d) => d.states));
  check('every state on a desk has a chip',
    [...shown].filter((s) => !chips.includes(s)).sort(), []);

  // And the fallback exists, so an unrecognised status renders as grey rather
  // than throwing. `stageOf` returns 'unknown' for anything it has not been
  // taught, and that key has to be there for it to mean anything.
  check('there is an `unknown` chip to fall back to', chips.includes('unknown'), true);
}

console.log('\nPROVING THE GUARD BY BREAKING IT\n');

// ---------------------------------------------------------------------------
// A rule nobody has watched refuse anything is a rule nobody has tested. So the
// original defect is reconstructed here: the desk set with the Decided panel
// taken back out, which is the code as it stood when the University asked the
// question.
//
// `unseeable` is re-implemented rather than imported so it can be fed a
// different desk set — and it is checked against the shipped function on the
// real data first, so a re-implementation that had drifted would not be
// silently vouching for anything.
// ---------------------------------------------------------------------------
function unseeable(states, desks, exempt) {
  const visible = new Set(Object.values(desks).flatMap((d) => d.states));
  return states.filter((s) => !visible.has(s) && !(s in exempt));
}

check('the test’s own rule agrees with the shipped one',
  unseeable(W.ADMISSION_STATES, W.ADMISSION_DESKS, W.NOT_ON_ANY_DESK),
  W.statesNobodyCanSee());

{
  // Remove the Decided panel and the widened Processed list — the two things
  // that were missing — and the states the University could not find come back.
  // THE DESK SET AS IT STOOD WHEN THE UNIVERSITY ASKED THE QUESTION. The
  // Decided panel did not exist, Processed looked for the two older spellings,
  // and there was no enrolment desk at all — `enrolled` was declared and
  // unreachable. Reconstructing it means removing everything that came after,
  // not only the panel: leaving the enrolment desk in would keep
  // `admission_issued` visible and the reconstruction would prove nothing.
  const before = { ...W.ADMISSION_DESKS };
  delete before['academic-decided'];
  delete before.enrolment;
  before.processed = { ...before.processed, states: ['approved', 'declined'] };

  const lost = unseeable(W.ADMISSION_STATES, before, W.NOT_ON_ANY_DESK);
  check('the old desk set loses the decision outcomes',
    lost.filter((s) => ['admission_issued', 'rejected', 'conditional'].includes(s)).sort(),
    ['admission_issued', 'conditional', 'rejected']);
  check('…and the guard catches it', lost.length > 0, true);
}

{
  // A state added to the vocabulary and to no desk is the other half of the
  // same mistake, and it is the one a future change is most likely to make.
  const invented = [...W.ADMISSION_STATES, 'appeal_pending'];
  check('a new state on no desk is refused',
    unseeable(invented, W.ADMISSION_DESKS, W.NOT_ON_ANY_DESK), ['appeal_pending']);
}

console.log('\nAnd the queues no longer carry lists of their own\n');

// ---------------------------------------------------------------------------
// THE DRIFT GUARD. The registry is only worth something while the desks read
// from it. A literal status array in a queue is exactly how this happened the
// first time, so it is refused at source.
//
// Only the QUEUE files are scanned. A status list in a route guard is a
// different thing — /api/admissions/admit naming `registrar_approved` is
// stating what it will accept, not what somebody can see — and scanning those
// too would train people to route round the test.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// READS ARE SCANNED; WRITES ARE NOT, and the difference is not a loophole.
//
// The first version of this scan flagged six lines and every one was a
// TRANSITION GUARD: `.update({...}).eq('id', id).in('status', ['fee_paid',
// 'documents_required'])`, which says what state a change is legal FROM. That
// is a rule about authority, it is supposed to be written down at the point it
// is enforced, and it is the reason a stale browser tab cannot drag a decided
// application back into a queue.
//
// A literal list on a SELECT is the opposite: it decides what somebody can
// see, and that is the thing that went wrong. So the scan finds each status
// filter and asks whether the nearest preceding call was `.select(` or
// `.update(`.
// ---------------------------------------------------------------------------
function inlineQueueFilters(text) {
  const found = [];
  for (const m of text.matchAll(/\.(?:in|eq)\(\s*'status'\s*,\s*\[?\s*'/g)) {
    const before = text.slice(0, m.index);
    if (before.lastIndexOf('.select(') > before.lastIndexOf('.update(')) {
      found.push(text.slice(m.index, m.index + 44).replace(/\s+/g, ' '));
    }
  }
  return found;
}

{
  // Both directions, on fabricated input, so the scan is known to have teeth
  // before it is pointed at the real files and comes back clean.
  check('the scan catches a hand-written queue filter',
    inlineQueueFilters("supabase.from('students').select('*').in('status', ['fee_paid'])").length, 1);
  check('…and leaves a transition guard alone',
    inlineQueueFilters("supabase.from('students').update({ status: 'x' }).eq('id', i).in('status', ['fee_paid'])"), []);

  const QUEUE_SOURCES = [
    'src/lib/admissions.ts',
    'src/components/admissions/AcademicAdmissions.tsx',
    'src/components/admissions/AdmissionsOffice.tsx',
    'src/components/admissions/AdmissionsDesk.tsx',
  ];
  const offenders = [];
  for (const rel of QUEUE_SOURCES) {
    for (const hit of inlineQueueFilters(readFileSync(join(here, '../../', rel), 'utf8'))) {
      offenders.push(`${rel}: ${hit}`);
    }
  }
  check('no queue names its own statuses', offenders, []);
}

process.exit(failures === 0 ? 0 : 1);
