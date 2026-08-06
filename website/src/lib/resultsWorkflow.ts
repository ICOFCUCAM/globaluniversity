// ---------------------------------------------------------------------------
// THE GRADE APPROVAL CHAIN.
//
// WHAT WAS WRONG. Both places a mark can be entered wrote `status: 'draft'`,
// and nothing in the system ever wrote anything else. There was no route, no
// capability and no screen that could move a mark forward. So:
//
//   every semester average computed as `basis: 'provisional'`, because
//   /api/results/recompute marks a term provisional unless every mark in it is
//   approved — and none ever was;
//
//   /api/credential/issue refuses to issue against a provisional average,
//   which is correct and meant no certificate could ever be issued to anybody;
//
//   the Office and Admin dashboards counted drafts as "pending approval" and
//   pointed at a queue with no way to clear it.
//
// The certificate artwork, the seal, the verification page, the issuance
// register, the GPA engine — all built, none reachable, because a mark could
// never become an approved mark. This file is the missing link.
//
// WHY FOUR STAGES AND NOT ONE. Because the university has already published
// this chain. `gradeApproval` in lifecycle.ts states it — lecturer submits, the
// Head of Department moderates, the Dean approves for the faculty, the
// Registrar approves for publication — and says of it: "No step may be skipped,
// including by an administrator. A result published without moderation is a
// result the university cannot defend on appeal." A one-click approval would
// have made that sentence false, and the place it is published is a page
// prospective students and accreditors read.
//
// So the stages here are the stages there. If the university changes its mind,
// it changes lifecycle.ts and this file together, deliberately, rather than
// discovering that the software quietly did something else.
//
// WHY THIS FILE HAS NO DATABASE ACCESS. Every rule below is a rule about who
// may do what, and those are the rules most worth testing. Kept pure, the whole
// chain can be exercised in milliseconds without a database, which is why
// resultsWorkflow.test.mjs can enumerate every transition and every actor
// instead of checking the two paths somebody thought of.
// ---------------------------------------------------------------------------

import type { Capability } from './roles';

/**
 * Where a mark is in the chain.
 *
 * 'draft' is where marks are entered and re-entered; it is the only state a
 * lecturer may edit in. Everything after it is a claim somebody has signed.
 */
export type ResultStatus =
  | 'draft'
  | 'submitted'
  | 'moderated'
  | 'faculty-approved'
  | 'approved';

export const RESULT_STATUSES: ResultStatus[] = [
  'draft', 'submitted', 'moderated', 'faculty-approved', 'approved',
];

export interface Stage {
  /** The status a mark must be in for this step to apply. */
  from: ResultStatus;
  /** Where it goes. */
  to: ResultStatus;
  /** Held by the office that performs this step, and by nobody else. */
  capability: Capability;
  /** The office, as the university names it. */
  actor: string;
  /** The button. */
  verb: string;
  /** What the step means, shown to the person about to do it. */
  meaning: string;
  /** The column recording who did it and when. */
  byColumn: string;
  atColumn: string;
}

/**
 * The chain, in order. Matches `gradeApproval` in lifecycle.ts step for step.
 *
 * WHY EACH STEP HAS ITS OWN CAPABILITY rather than one 'approve-results' held
 * by four offices. With a single capability the Dean could perform the
 * moderation step and the Registrar could perform all three, which is a chain
 * in name only — the whole point is that four different people look. Separate
 * capabilities make skipping a step impossible rather than discouraged.
 */
export const STAGES: Stage[] = [
  {
    from: 'draft',
    to: 'submitted',
    capability: 'submit-results',
    actor: 'Lecturer',
    verb: 'Submit for moderation',
    meaning:
      'You are declaring this class complete. After submitting you can no longer edit these marks — '
      + 'a correction means asking for them to be returned, and the return is recorded.',
    byColumn: 'submitted_by',
    atColumn: 'submitted_at',
  },
  {
    from: 'submitted',
    to: 'moderated',
    capability: 'moderate-results',
    actor: 'Head of Department',
    verb: 'Moderate',
    meaning:
      'You are attesting that the marking is consistent with the department’s standard and that '
      + 'the spread is defensible.',
    byColumn: 'moderated_by',
    atColumn: 'moderated_at',
  },
  {
    from: 'moderated',
    to: 'faculty-approved',
    capability: 'approve-results',
    actor: 'Dean',
    verb: 'Approve for the faculty',
    meaning: 'You are approving the moderated marks on behalf of the faculty.',
    byColumn: 'faculty_approved_by',
    atColumn: 'faculty_approved_at',
  },
  {
    from: 'faculty-approved',
    to: 'approved',
    capability: 'publish-results',
    actor: 'Registrar',
    verb: 'Approve for publication',
    meaning:
      'You are writing these marks to the academic record. Grade point averages recompute '
      + 'immediately, and a degree may be conferred on the result.',
    byColumn: 'approved_by',
    atColumn: 'approved_at',
  },
];

/** The step that applies to a mark in this state, or null if it is finished. */
export function nextStage(status: ResultStatus): Stage | null {
  return STAGES.find((s) => s.from === status) ?? null;
}

export function stageIndex(status: ResultStatus): number {
  const i = STAGES.findIndex((s) => s.from === status);
  return i === -1 ? STAGES.length : i;
}

/** Human wording for a state, for the queue and for the student's screen. */
export const STATUS_LABEL: Record<ResultStatus, string> = {
  draft: 'Draft',
  submitted: 'Awaiting moderation',
  moderated: 'Awaiting faculty approval',
  'faculty-approved': 'Awaiting publication',
  approved: 'Published to the record',
};

/**
 * RETURNING A MARK.
 *
 * Any office in the chain may send a class back rather than approve it, and it
 * goes all the way to 'draft' — not one step back.
 *
 * WHY ALL THE WAY. Because a mark that returns to the middle of the chain has
 * been seen by the offices above it and not by the ones below, and the next
 * approval would rest on a moderation of a different set of numbers. The
 * university's own note says a lecturer may not alter a mark after moderation
 * "without the chain being restarted, and the restart is itself recorded". A
 * one-step rewind is exactly the shortcut that sentence forbids.
 *
 * A reason is REQUIRED. A class sent back without one tells the lecturer that
 * somebody objected and nothing about what to change, which produces a second
 * submission identical to the first.
 */
export function canReturn(status: ResultStatus): boolean {
  return status !== 'draft';
}

export const RETURN_TO: ResultStatus = 'draft';

export interface Actor {
  id: string;
  /**
   * Whether this person holds a capability.
   *
   * A PREDICATE, NOT A LIST. `superadmin` is defined as 'all' rather than as an
   * enumeration, so asking for "their capabilities" means expanding a wildcard
   * into an array that exists only to be searched once. Passing the question
   * instead of the answer keeps roles.ts the single place that knows what a
   * role may do — which is the whole point of that file.
   */
  holds: (capability: Capability) => boolean;
}

/** A mark, as much of it as the rules need. */
export interface MarkState {
  status: ResultStatus;
  submitted_by?: string | null;
  moderated_by?: string | null;
  faculty_approved_by?: string | null;
  approved_by?: string | null;
}

export type Refusal =
  | 'wrong-stage'
  | 'not-your-step'
  | 'already-published'
  | 'already-acted'
  | 'nothing-to-return'
  | 'reason-required';

export interface Decision {
  ok: boolean;
  refusal?: Refusal;
  /** Said to the person, not to the log. */
  because?: string;
  stage?: Stage;
}

const WHY: Record<Refusal, string> = {
  'wrong-stage': 'This class is not at that step of the chain.',
  'not-your-step': 'That step belongs to another office.',
  'already-published': 'These marks are already on the academic record.',
  'already-acted':
    'You have already signed this class once. Four approvals from one person is one opinion '
    + 'recorded four times, whatever offices that person holds.',
  'nothing-to-return': 'A draft has not been submitted, so there is nothing to send back.',
  'reason-required': 'Say what needs to change. A class sent back without a reason comes back unchanged.',
};

/** Everyone who has already signed this class, in order. */
export function signatories(mark: MarkState): string[] {
  const row = mark as unknown as Record<string, string | null | undefined>;
  return STAGES.slice(0, stageIndex(mark.status))
    .map((s) => row[s.byColumn])
    .filter((v): v is string => !!v);
}

/**
 * May this person advance this mark?
 *
 * THE FOUR-PEOPLE RULE: nobody may sign the same class twice, at any step.
 *
 * A weaker version — "not two CONSECUTIVE steps" — is the obvious rule and it
 * is not enough here. `admin` is defined as every operational capability, so an
 * administrator holds all four steps of this chain. Under the consecutive rule
 * an administrator and one colleague could alternate and walk a class from
 * draft to the academic record with four signatures representing two opinions.
 * lifecycle.ts says "No step may be skipped, including by an administrator";
 * two people producing four approvals skips two steps in substance while
 * satisfying them on paper, which is worse than skipping them openly.
 *
 * So: signed once, done. The consequence is real and worth stating plainly —
 * where one person holds two offices in the chain, that class stops until
 * somebody else is available. That is the correct outcome. A university that
 * cannot find four people to look at a set of marks has not got an approval
 * chain, and the software should say so rather than simulate one.
 *
 * Holding several offices is otherwise fine and is not refused: the Dean who is
 * also acting Head of Department can still act as either on classes they have
 * not already signed.
 */
export function mayAdvance(actor: Actor, mark: MarkState): Decision {
  if (mark.status === 'approved') {
    return { ok: false, refusal: 'already-published', because: WHY['already-published'] };
  }

  const stage = nextStage(mark.status);
  if (!stage) return { ok: false, refusal: 'wrong-stage', because: WHY['wrong-stage'] };

  if (!actor.holds(stage.capability)) {
    return { ok: false, refusal: 'not-your-step', because: WHY['not-your-step'], stage };
  }

  if (signatories(mark).includes(actor.id)) {
    return { ok: false, refusal: 'already-acted', because: WHY['already-acted'], stage };
  }

  return { ok: true, stage };
}

/**
 * May this person send this class back?
 *
 * ONLY THE OFFICE THE CLASS IS CURRENTLY WAITING ON. You may refuse work that
 * has been put in front of you. You may not reach forward for a class that has
 * moved past you, and you may not reach back for one that has not arrived.
 *
 * THE CASE THIS EXCLUDES ON PURPOSE: a lecturer recalling their own class from
 * the Dean. It looks reasonable — they spotted their own error — and it is the
 * rule that would quietly undo the chain. Submitting is what closes marks to
 * editing; if the person who is prevented from editing can also lift the
 * prevention, the control is decorative, because the route is recall, edit,
 * resubmit. The same reasoning runs through the rest of this system: a
 * suspended Superadministrator cannot un-suspend themselves.
 *
 * The lecturer is not stuck. They ask the office holding the class, which
 * returns it with the reason — and the restart then has a second person on the
 * record, which is what lifecycle.ts requires of a restart.
 *
 * Published marks are NOT returnable here at all. Correcting the academic
 * record after publication is a different act with different consequences — a
 * transcript may already have been issued on it — and it does not belong behind
 * the same button as "send this back to the lecturer".
 */
export function mayReturn(actor: Actor, mark: MarkState, reason: string): Decision {
  if (!canReturn(mark.status)) {
    return { ok: false, refusal: 'nothing-to-return', because: WHY['nothing-to-return'] };
  }
  if (mark.status === 'approved') {
    return { ok: false, refusal: 'already-published', because: WHY['already-published'] };
  }
  if (!reason.trim()) {
    return { ok: false, refusal: 'reason-required', because: WHY['reason-required'] };
  }

  const pending = nextStage(mark.status);
  if (!pending || !actor.holds(pending.capability)) {
    return { ok: false, refusal: 'not-your-step', because: WHY['not-your-step'] };
  }

  return { ok: true };
}

/**
 * The columns a successful advance writes.
 *
 * Returned rather than applied so the route does the writing and this file
 * stays free of a database — but the SHAPE of the write is decided here, where
 * the rules are, not scattered through a request handler.
 */
export function advancePatch(stage: Stage, actorId: string, atISO: string): Record<string, unknown> {
  return {
    status: stage.to,
    [stage.byColumn]: actorId,
    [stage.atColumn]: atISO,
    // A class going forward is no longer carrying an objection.
    returned_reason: null,
  };
}

/**
 * The columns a return writes.
 *
 * Every actor column is cleared. The chain restarts, so the previous
 * moderation and faculty approval no longer stand — leaving them in place would
 * show a class as moderated by somebody who moderated a different set of marks.
 * What happened is not lost: result_transitions keeps every step, including
 * this one and the reason.
 */
export function returnPatch(actorId: string, reason: string, atISO: string): Record<string, unknown> {
  return {
    status: RETURN_TO,
    submitted_by: null,
    submitted_at: null,
    moderated_by: null,
    moderated_at: null,
    faculty_approved_by: null,
    faculty_approved_at: null,
    approved_by: null,
    approved_at: null,
    returned_reason: reason.trim(),
    returned_by: actorId,
    returned_at: atISO,
  };
}

/** True when a mark may still be edited in the grade book. */
export function isEditable(status: ResultStatus): boolean {
  return status === 'draft';
}
