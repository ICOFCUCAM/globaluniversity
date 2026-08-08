// ---------------------------------------------------------------------------
// The examination system — can the clock be cheated, and can a machine
// convict a student?
//
// Run with:  node src/lib/examinations.test.mjs
//
// WHY THIS FILE EXISTS. Three of the University's instructions are absolute and
// all three fail silently:
//
//   "Exam timer runs centrally." A clock that drifts, or that counts paused
//   minutes, takes time off a candidate who cannot see that it happened. They
//   submit early or run out mid-sentence, and there is nothing on the screen to
//   tell them why.
//
//   "AI-generated events should be treated as alerts, not automatic proof of
//    cheating." A system that quietly hardens an alert into a finding produces
//   a misconduct record nobody chose to make — and it looks exactly like one
//   somebody did.
//
//   "No single ordinary administrator should be able to alter examination
//    evidence, marks and academic records." One person doing two jobs on the
//   same script is invisible from the outside: the paperwork is complete and
//   the signatures are there.
//
// So this file attacks the clock arithmetic, tries to have a machine convict
// somebody, and tries to have one person both raise and judge an incident.
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

const root = new URL('../..', import.meta.url).pathname;
const out = join(root, '.test-build', 'exams');
mkdirSync(out, { recursive: true });
const bundle = join(out, 'examinations.mjs');
execFileSync('npx', [
  'esbuild', new URL('./examinations.ts', import.meta.url).pathname,
  '--bundle', '--format=esm', '--platform=node', `--outfile=${bundle}`, '--log-level=error',
  `--alias:@=${new URL('..', import.meta.url).pathname.replace(/\/$/, '')}`,
]);
const E = await import(bundle);

// ---------------------------------------------------------------------------
console.log('\nThe clock runs centrally, and paused time is given back\n');

const MIN = 60_000;
const T0 = Date.parse('2026-09-14T09:00:00.000Z');

const session = (over) => ({
  id: 's', state: 'in_progress', startedAt: new Date(T0).toISOString(),
  submittedAt: null, pausedMs: 0, pausedAt: null, extraMinutes: 0, ...over,
});
const paper = (over) => ({ durationMinutes: 120, opensAt: null, closesAt: null, mode: 'standard', ...over });

check(
  'at the moment of starting, the whole paper remains',
  E.remainingMs(session(), paper(), T0),
  120 * MIN,
);
check(
  'thirty minutes in, ninety remain',
  E.remainingMs(session(), paper(), T0 + 30 * MIN),
  90 * MIN,
);
check(
  'it never goes negative',
  E.remainingMs(session(), paper(), T0 + 300 * MIN),
  0,
);
check(
  'a paper not yet started shows its full duration',
  E.remainingMs(session({ startedAt: null }), paper(), T0 + 50 * MIN),
  120 * MIN,
);

// THE CHECK THAT MATTERS MOST. A candidate paused for twenty minutes must get
// those twenty minutes back, or a power cut costs them their degree.
check(
  'twenty minutes of accumulated pause are given back',
  E.remainingMs(session({ pausedMs: 20 * MIN }), paper(), T0 + 50 * MIN),
  90 * MIN,
);
check(
  'while PAUSED the clock is frozen, not merely slowed',
  E.remainingMs(
    session({ pausedAt: new Date(T0 + 30 * MIN).toISOString() }),
    paper(),
    T0 + 90 * MIN,   // an hour of wall-clock has passed since the pause
  ),
  90 * MIN,
);
check(
  '…and resuming after that hour still leaves ninety minutes',
  E.remainingMs(
    session({ pausedMs: 60 * MIN }),
    paper(),
    T0 + 90 * MIN,
  ),
  90 * MIN,
);
check(
  'granted extra time is added',
  E.remainingMs(session({ extraMinutes: 15 }), paper(), T0 + 30 * MIN),
  105 * MIN,
);

check('a paper with time left has not expired', E.isExpired(session(), paper(), T0 + 30 * MIN), false);
check('one past its duration has', E.isExpired(session(), paper(), T0 + 121 * MIN), true);

console.log('\nA take-home paper has a window, not a countdown\n');

const takeHome = paper({ mode: 'take-home', durationMinutes: null, closesAt: new Date(T0 + 72 * 60 * MIN).toISOString() });

check(
  'there is no countdown to display',
  E.remainingMs(session(), takeHome, T0 + 10 * MIN),
  null,
);
check(
  '…and it does NOT read as expired the moment it opens',
  E.isExpired(session(), takeHome, T0 + 10 * MIN),
  false,
);
check(
  'it expires when the window closes',
  E.isExpired(session(), takeHome, T0 + 73 * 60 * MIN),
  true,
);

console.log('\nThe checks a candidate must pass depend on the kind of examination\n');

const nothingReady = {};
const allReady = {
  eligible: true, identityVerified: true, camera: true, microphone: true,
  screenShare: true, fullscreen: true, connectionOk: true, consented: true,
};

check('nothing ready, nothing starts', E.mayStart('standard', nothingReady), false);
check('everything ready, a standard paper starts', E.mayStart('standard', allReady), true);

check(
  'a viva does not demand a screen share — there is no screen',
  E.requirementsFor('oral', { ...allReady, screenShare: false })
    .filter((r) => r.key === 'screenShare' && r.required).length,
  0,
);
check(
  '…so a viva starts without one',
  E.mayStart('oral', { ...allReady, screenShare: false, fullscreen: false }),
  true,
);
check(
  'a standard paper DOES demand one',
  E.mayStart('standard', { ...allReady, screenShare: false }),
  false,
);

// A REQUIREMENT NOBODY CAN MEET IS NOT A CONTROL.
check(
  'a take-home paper demands no camera',
  E.requirementsFor('take-home', {}).filter((r) => r.key === 'camera' && r.required).length,
  0,
);
check(
  '…nor identity verification, which cannot be done over three days',
  E.requirementsFor('take-home', {}).filter((r) => r.key === 'identityVerified' && r.required).length,
  0,
);
check(
  '…but it still demands eligibility and consent',
  E.requirementsFor('take-home', {}).filter((r) => r.required).map((r) => r.key).sort(),
  ['consented', 'eligible'],
);
check(
  'every unmet requirement tells the candidate what to do about it',
  E.requirementsFor('standard', {}).filter((r) => r.required && !r.met && !r.remedy).length,
  0,
);

console.log('\nOnly the candidate may start or submit their own paper\n');

const ALL = () => true;
const move = (from, to, opts = {}) =>
  E.canMoveSession({ from, to, holds: opts.holds ?? ALL, reason: opts.reason, isCandidate: opts.isCandidate });

check('the candidate starts', move('ready', 'in_progress', { isCandidate: true }).allowed, true);
check(
  'somebody else holding every capability cannot start it for them',
  move('ready', 'in_progress', { isCandidate: false }).allowed,
  false,
);
check('the candidate submits', move('in_progress', 'submitted', { isCandidate: true }).allowed, true);
check(
  'an examiner cannot submit on the candidate’s behalf',
  move('in_progress', 'submitted', { isCandidate: false }).allowed,
  false,
);

check(
  'a student cannot pause their own examination',
  move('in_progress', 'paused', {
    holds: (c) => c === 'sit-examination', isCandidate: true, reason: 'I need a break',
  }).allowed,
  false,
);
check(
  'an examiner may pause it, with a reason',
  move('in_progress', 'paused', { isCandidate: false, reason: 'Power cut reported by the candidate.' }).allowed,
  true,
);
check(
  '…and may not pause it without one',
  move('in_progress', 'paused', { isCandidate: false }).allowed,
  false,
);
check(
  '…and the refusal explains why a reason is needed',
  /first thing an appeal asks about/.test(move('in_progress', 'paused', { isCandidate: false }).reason),
  true,
);

check(
  'a submitted paper cannot be reopened',
  move('submitted', 'in_progress', { isCandidate: true }).allowed,
  false,
);
check('a void sitting is closed to everyone', move('void', 'in_progress').allowed, false);
check(
  'terminating requires the terminate capability, not merely control',
  move('in_progress', 'terminated', {
    holds: (c) => c === 'control-exam-session', reason: 'x',
  }).allowed,
  false,
);

check(
  'the buttons an invigilator sees on a live sitting',
  E.sessionMovesFor('in_progress', (c) => ['proctor-examination', 'record-exam-incident'].includes(c), false)
    .map((m) => m.to),
  [],
);
check(
  'an invigilator can neither pause nor terminate — the narrowest role in the system',
  E.sessionMovesFor('in_progress', (c) => c === 'record-exam-incident', false).length,
  0,
);

console.log('\nA machine cannot convict a student\n');

const raisedByProctor = { raisedBy: 'proctor-1', decidedBy: 'proctor-1', holds: ALL, reasoning: 'Because.' };

check(
  'the person who raised an incident cannot determine it',
  E.canDetermine(raisedByProctor).allowed,
  false,
);
check(
  '…and the refusal says it needs a second reader',
  /second\s+reader/.test(E.canDetermine(raisedByProctor).reason),
  true,
);
check(
  'a different person may',
  E.canDetermine({ ...raisedByProctor, decidedBy: 'moderator-1' }).allowed,
  true,
);
check(
  'somebody without the capability may not, however senior they feel',
  E.canDetermine({
    raisedBy: 'proctor-1', decidedBy: 'moderator-1',
    holds: (c) => c !== 'determine-misconduct', reasoning: 'Because.',
  }).allowed,
  false,
);
check(
  'a finding with no written reasoning is refused',
  E.canDetermine({ raisedBy: 'proctor-1', decidedBy: 'moderator-1', holds: ALL, reasoning: '  ' }).allowed,
  false,
);
check(
  '…and the reason given is about the appeal, not about form-filling',
  /what an appeal reads/.test(
    E.canDetermine({ raisedBy: 'proctor-1', decidedBy: 'moderator-1', holds: ALL }).reason,
  ),
  true,
);

console.log('\nAlerts are ordered for a human, and never act on their own\n');

check('a second face is an alert', E.severityOf('second_face_detected'), 'alert');
check('screen sharing stopping is an alert', E.severityOf('screen_share_stopped'), 'alert');
check(
  'a dropped connection is only a notice — it happens constantly',
  E.severityOf('connection_lost'),
  'notice',
);
check('a saved answer is not an alert at all', E.severityOf('answer_saved'), 'info');

// A console of nine alerts an hour is a console nobody reads.
const alerts = E.EVENT_KINDS.filter((k) => E.severityOf(k) === 'alert');
check('alerts are sparing — five kinds, not fifteen', alerts.length <= 6, true);

check(
  'the sentence that must appear beside alerts says a camera can be wrong',
  /reflection/.test(E.ALERTS_ARE_NOT_FINDINGS) && /until\s+a\s+person/.test(E.ALERTS_ARE_NOT_FINDINGS),
  true,
);

console.log('\nEvidence and decisions are told apart\n');

check(
  'what the camera saw is evidence',
  ['exam_events', 'exam_answers', 'exam_recordings'].map((t) => E.RECORD_CLASSES[t]),
  ['evidence', 'evidence', 'evidence'],
);
check(
  'what a person concluded is a decision',
  ['exam_incidents', 'exam_findings', 'exam_marks', 'exam_reports'].map((t) => E.RECORD_CLASSES[t]),
  ['decision', 'decision', 'decision', 'decision'],
);
check(
  'the evidence note promises append-only, including against the Superadministrator',
  /Superadministrator/.test(E.EVIDENCE_NOTE),
  true,
);
check(
  'the decision note promises the six-part record',
  /who, what, when/.test(E.DECISION_NOTE) && /why/.test(E.DECISION_NOTE),
  true,
);

console.log('\nThe audit line answers the question an appeal actually asks\n');

check(
  'a mark change names the before and the after',
  E.describeAudit({
    who: { id: '1', role: 'moderator', email: 'm@iguc.net' },
    what: 'mark.moderated', when: '2026-09-20', before: 58, after: 62,
    reason: 'The second script page had not been uploaded when it was first marked.',
  }),
  'moderator (m@iguc.net) mark moderated — from 58 to 62 — The second script page had not been uploaded when it was first marked.',
);

console.log('\nThe library and the migration agree\n');

const raw = readFileSync(join(root, 'docs/migrations/015_examination_and_proctoring.sql'), 'utf8');

// COMMENTS STRIPPED BEFORE MATCHING. The CHECK lists in 015 carry a comment on
// several of their lines — `-- Lifecycle`, `-- timed paper, automated
// supervision` — and without removing them the first value after each comment
// arrives glued to it. The first run of this test reported six event kinds as
// missing from the database when every one of them was there: a test that cries
// wolf is worse than no test.
const sql = raw.replace(/--.*$/gm, '');

/**
 * The values a CHECK constraint permits for one TABLE's column.
 *
 * SCOPED TO THE TABLE. `status` appears on examinations, exam_sessions and
 * several others; `outcome` on exam_identity_checks and exam_findings. An
 * unscoped search finds whichever is declared first and reports every correct
 * value as wrong — which is exactly what the first run of this test did.
 */
const inCheck = (table, column) => {
  const block = sql.match(
    new RegExp(`create table if not exists ${table} \\(([\\s\\S]*?)\\n\\);`, 'i'),
  );
  if (!block) return [];
  const m = block[1].match(
    new RegExp(`\\b${column}\\s+text[\\s\\S]*?check \\(${column} in \\(([^)]*)\\)`, 'i'),
  );
  return m ? m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean) : [];
};

check('every event kind the code writes is one the database accepts',
  E.EVENT_KINDS.filter((k) => !inCheck('exam_events', 'kind').includes(k)), []);
check('every session state the code can reach is accepted',
  E.SESSION_STATES.filter((s) => !inCheck('exam_sessions', 'status').includes(s)), []);
check('every examination state is accepted',
  E.EXAM_STATES.filter((s) => !inCheck('examinations', 'status').includes(s)), []);
check('every examination mode is accepted',
  E.EXAM_MODES.filter((m) => !inCheck('examinations', 'mode').includes(m)), []);
check('every finding outcome is accepted',
  E.FINDING_OUTCOMES.filter((o) => !inCheck('exam_findings', 'outcome').includes(o)), []);
check('every incident category is accepted',
  E.INCIDENT_CATEGORIES.filter((c) => !inCheck('exam_incidents', 'category').includes(c)), []);

// THE STRUCTURAL GUARANTEE. If somebody ever adds a verdict column to the
// events table, this fails — and it should, loudly.
check(
  'the events table still has no column in which a verdict could be recorded',
  // Read from the comment-stripped copy: the table's own comment explains that
  // there is no verdict column, and matching against the prose would report the
  // absence as a presence.
  /create table if not exists exam_events \(([\s\S]*?)\n\);/i.exec(sql)?.[1]
    ?.match(/\b(is_cheating|verdict|misconduct|outcome)\b/) ?? null,
  null,
);

console.log(failures === 0
  ? '\nThe clock cannot be cheated, a machine cannot convict, and nobody judges their own observation.'
  : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
