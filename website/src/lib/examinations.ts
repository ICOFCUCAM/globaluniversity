// ---------------------------------------------------------------------------
// THE DIGITAL EXAMINATION & PROCTORING SYSTEM — the rules, held apart from the
// screens and the routes that use them.
//
// Four things need these rules and only one of them is a screen: the
// candidate's exam interface, the examiner's console, the routes that write to
// the register, and the tests. When rules like these live in a component, the
// route re-implements them slightly differently and the difference is the bug —
// except here the bug is a candidate given four extra minutes, or one whose
// paper submits early.
//
// ---------------------------------------------------------------------------
// THE CLOCK IS THE ONE THING THAT CANNOT LIVE IN THE BROWSER
// ---------------------------------------------------------------------------
//
// "Exam timer runs centrally" is in the University's specification, and it is
// the single most load-bearing sentence in it. A countdown computed in the
// candidate's browser is a countdown the candidate can edit — with the
// developer console, with a clock change, or by leaving the page and coming
// back. `remainingMs` below takes the session's server-recorded start, the
// paper's duration, whatever pause time has accumulated and any granted
// extension, and derives the answer. The browser is TOLD what to display.
//
// ---------------------------------------------------------------------------
// EVIDENCE AND DECISIONS ARE DIFFERENT KINDS OF THING
// ---------------------------------------------------------------------------
//
// The University asked for this and migration 015 enforces it in the database.
// It is repeated in the type system here because the distinction is easy to
// lose in an interface: an examiner looking at a screen sees "second face
// detected at 10:42" and "misconduct" side by side and may reasonably read them
// as the same kind of statement. They are not. One is what a detector observed;
// the other is what a person concluded, and only the second has an author.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 1. WHAT KIND OF EXAMINATION
// ---------------------------------------------------------------------------

export const EXAM_MODES = ['standard', 'oral', 'practical', 'defence', 'take-home'] as const;
export type ExamMode = (typeof EXAM_MODES)[number];

export interface ModeProfile {
  id: ExamMode;
  label: string;
  /** One line the Examination Officer reads when choosing. */
  note: string;
  /** Does a live examiner have to be present for the whole sitting? */
  liveExaminer: boolean;
  /** May more than one examiner join the room? */
  panel: boolean;
  /** Are questions delivered by the system, or is the assessment a conversation? */
  questionPaper: boolean;
  /** What the supervision layer looks like by default. */
  defaults: {
    camera: boolean;
    microphone: boolean;
    screenShare: boolean;
    fullscreen: boolean;
  };
}

export const MODE_PROFILES: Record<ExamMode, ModeProfile> = {
  standard: {
    id: 'standard',
    label: 'Standard written examination',
    note: 'A timed paper under automated supervision, with a proctor watching.',
    liveExaminer: false,
    panel: false,
    questionPaper: true,
    defaults: { camera: true, microphone: true, screenShare: true, fullscreen: true },
  },
  oral: {
    id: 'oral',
    label: 'Oral examination (viva voce)',
    note: 'A conversation with an examiner. No question paper; the record is the recording and the examiner’s report.',
    liveExaminer: true,
    panel: false,
    questionPaper: false,
    // No screen share: there is no screen involved, and demanding one is a
    // requirement a candidate cannot meaningfully satisfy in a spoken
    // examination.
    defaults: { camera: true, microphone: true, screenShare: false, fullscreen: false },
  },
  practical: {
    id: 'practical',
    label: 'Practical examination',
    note: 'A demonstrated skill, observed. The screen share IS the examination when the skill is on a computer.',
    liveExaminer: true,
    panel: false,
    questionPaper: true,
    defaults: { camera: true, microphone: true, screenShare: true, fullscreen: false },
  },
  defence: {
    id: 'defence',
    label: 'Dissertation defence',
    note: 'A panel: a chairperson and two or more examiners. Assessment is deliberated, not scored live.',
    liveExaminer: true,
    panel: true,
    questionPaper: false,
    defaults: { camera: true, microphone: true, screenShare: true, fullscreen: false },
  },
  'take-home': {
    id: 'take-home',
    label: 'Take-home examination',
    note: 'A long window with submission controls. Not proctored — see below.',
    liveExaminer: false,
    panel: false,
    questionPaper: true,
    // NOTHING IS ON, AND THAT IS THE HONEST SETTING.
    //
    // A take-home paper runs for days. Requiring a camera for seventy-two hours
    // is not an integrity control; it is a rule nobody can comply with, and
    // rules nobody can comply with are how a proctoring system loses the
    // confidence of the people it supervises — after which they stop reporting
    // the genuine faults too.
    //
    // The integrity controls for this mode are different in kind: a submission
    // deadline, the work itself, and the University's academic-conduct
    // regulations. The system should not pretend otherwise.
    defaults: { camera: false, microphone: false, screenShare: false, fullscreen: false },
  },
};

// ---------------------------------------------------------------------------
// 2. THE EXAMINATION'S OWN WORKFLOW
// ---------------------------------------------------------------------------

export const EXAM_STATES = [
  'draft', 'questions_approved', 'published', 'in_progress', 'closed', 'cancelled',
] as const;
export type ExamState = (typeof EXAM_STATES)[number];

/**
 * The workflow the University drew, as a table.
 *
 * QUESTIONS ARE APPROVED BEFORE THE PAPER IS PUBLISHED, and those are two
 * different people. The office that sets a paper does not release it — the same
 * separation this system already applies to certificate designs, to grades and
 * to announcements, and for the same reason: a paper published by the person
 * who wrote it has had one reader.
 */
export const EXAM_TRANSITIONS: Record<
  ExamState,
  Array<{ to: ExamState; capability: string; label: string }>
> = {
  draft: [
    { to: 'questions_approved', capability: 'moderate-examination', label: 'Approve the questions' },
    { to: 'cancelled', capability: 'schedule-examination', label: 'Cancel' },
  ],
  questions_approved: [
    { to: 'published', capability: 'publish-examination', label: 'Publish to the cohort' },
    { to: 'draft', capability: 'schedule-examination', label: 'Return for revision' },
    { to: 'cancelled', capability: 'schedule-examination', label: 'Cancel' },
  ],
  published: [
    { to: 'in_progress', capability: 'publish-examination', label: 'Open the sitting' },
    // A published paper may still be cancelled — a cohort may be told the
    // examination is off — but it can no longer be edited back into a draft,
    // because candidates have already seen it exists.
    { to: 'cancelled', capability: 'schedule-examination', label: 'Cancel' },
  ],
  in_progress: [
    { to: 'closed', capability: 'publish-examination', label: 'Close the sitting' },
  ],
  closed: [],
  cancelled: [],
};

// ---------------------------------------------------------------------------
// 3. ONE CANDIDATE'S SITTING
// ---------------------------------------------------------------------------

export const SESSION_STATES = [
  'created', 'checks', 'ready', 'in_progress', 'paused',
  'submitted', 'terminated', 'abandoned', 'void',
] as const;
export type SessionState = (typeof SESSION_STATES)[number];

export interface Session {
  id: string;
  state: SessionState;
  /** Server time. Null until the candidate starts. */
  startedAt: string | null;
  submittedAt: string | null;
  /** Accumulated paused time, in milliseconds. */
  pausedMs: number;
  /** Set while paused; null otherwise. */
  pausedAt: string | null;
  /** Granted by an examiner, in minutes. */
  extraMinutes: number;
}

export interface Paper {
  durationMinutes: number | null;
  opensAt: string | null;
  closesAt: string | null;
  mode: ExamMode;
}

/**
 * How long this candidate has left, in milliseconds.
 *
 * THE ONLY AUTHORITY ON TIME REMAINING. See the header — a browser countdown is
 * a suggestion. The route recomputes this on every autosave and refuses a save
 * that arrives after zero; the interface displays what it is given.
 *
 * PAUSED TIME DOES NOT COUNT. A candidate whose examination was paused for
 * twenty minutes because of a power cut gets those twenty minutes back, which
 * is the entire point of having a pause rather than an extension.
 *
 * Returns null when there is no clock to run: a take-home paper is bounded by
 * its window, not by a duration, and returning 0 for it would submit the
 * candidate's work the moment they opened it.
 */
export function remainingMs(
  session: Session,
  paper: Paper,
  now: number = Date.now(),
): number | null {
  if (paper.durationMinutes == null) return null;
  if (!session.startedAt) return paper.durationMinutes * 60_000;

  const allowed = (paper.durationMinutes + (session.extraMinutes ?? 0)) * 60_000;
  const started = Date.parse(session.startedAt);

  // While paused, the clock is frozen at the moment it stopped. Counting the
  // current pause as elapsed would take time off a candidate who is not sitting.
  const frozen = session.pausedAt ? Date.parse(session.pausedAt) : now;
  const elapsed = frozen - started - (session.pausedMs ?? 0);

  return Math.max(0, allowed - elapsed);
}

/** Has this candidate run out of time? */
export function isExpired(session: Session, paper: Paper, now: number = Date.now()): boolean {
  const left = remainingMs(session, paper, now);
  if (left === null) {
    // A take-home paper expires at the window's close instead.
    return Boolean(paper.closesAt && Date.parse(paper.closesAt) <= now);
  }
  return left <= 0;
}

/**
 * Who may move a sitting, and to where.
 *
 * NOTE WHAT THE CANDIDATE CAN DO: start, and submit. Nothing else. They cannot
 * pause their own examination, and they cannot un-terminate one.
 */
export const SESSION_TRANSITIONS: Record<
  SessionState,
  Array<{ to: SessionState; capability: string; label: string; requiresReason?: boolean }>
> = {
  created: [
    { to: 'checks', capability: 'sit-examination', label: 'Begin the checks' },
    { to: 'void', capability: 'control-exam-session', label: 'Void this sitting', requiresReason: true },
  ],
  checks: [
    { to: 'ready', capability: 'sit-examination', label: 'Checks passed' },
    { to: 'void', capability: 'control-exam-session', label: 'Void this sitting', requiresReason: true },
  ],
  ready: [
    { to: 'in_progress', capability: 'sit-examination', label: 'Start' },
    { to: 'void', capability: 'control-exam-session', label: 'Void this sitting', requiresReason: true },
  ],
  in_progress: [
    { to: 'paused', capability: 'control-exam-session', label: 'Pause', requiresReason: true },
    { to: 'submitted', capability: 'sit-examination', label: 'Submit' },
    { to: 'terminated', capability: 'terminate-examination', label: 'Terminate', requiresReason: true },
    { to: 'abandoned', capability: 'control-exam-session', label: 'Mark abandoned', requiresReason: true },
  ],
  paused: [
    { to: 'in_progress', capability: 'control-exam-session', label: 'Resume', requiresReason: true },
    { to: 'terminated', capability: 'terminate-examination', label: 'Terminate', requiresReason: true },
  ],
  // A submitted paper is marked, not reopened. Reopening would let a candidate
  // add to work an examiner may already have seen.
  submitted: [
    { to: 'void', capability: 'determine-misconduct', label: 'Void after review', requiresReason: true },
  ],
  terminated: [
    { to: 'void', capability: 'determine-misconduct', label: 'Void after review', requiresReason: true },
  ],
  abandoned: [
    { to: 'void', capability: 'determine-misconduct', label: 'Void after review', requiresReason: true },
  ],
  void: [],
};

export interface SessionMove {
  from: SessionState;
  to: SessionState;
  holds: (capability: string) => boolean;
  reason?: string | null;
  /** Is this the candidate whose sitting it is? Some moves are theirs alone. */
  isCandidate?: boolean;
}

export interface MoveVerdict {
  allowed: boolean;
  reason?: string;
}

export function canMoveSession(move: SessionMove): MoveVerdict {
  const available = SESSION_TRANSITIONS[move.from];
  if (!available) return { allowed: false, reason: `${move.from} is not a session state.` };
  if (available.length === 0) {
    return { allowed: false, reason: `A ${move.from} sitting is closed and cannot be moved.` };
  }

  const transition = available.find((t) => t.to === move.to);
  if (!transition) {
    return { allowed: false, reason: `A ${move.from.replace('_', ' ')} sitting cannot go to ${move.to}.` };
  }

  if (!move.holds(transition.capability)) {
    return { allowed: false, reason: `You may not ${transition.label.toLowerCase()}.` };
  }

  // THE CANDIDATE'S OWN MOVES ARE THEIRS ALONE. 'sit-examination' is held by
  // every student, so without this an enrolled student could start or submit
  // somebody else's paper.
  if (transition.capability === 'sit-examination' && move.isCandidate === false) {
    return {
      allowed: false,
      reason: 'Only the candidate may do that. An examiner may pause, extend or terminate the sitting.',
    };
  }

  if (transition.requiresReason && !move.reason?.trim()) {
    return {
      allowed: false,
      reason:
        'Say why. This is the first thing an appeal asks about, and a decision with no stated '
        + 'reason is indistinguishable from a fault.',
    };
  }

  return { allowed: true };
}

/** What this person can do with a sitting in this state — used to draw buttons. */
export function sessionMovesFor(
  state: SessionState,
  holds: (capability: string) => boolean,
  isCandidate: boolean,
) {
  return (SESSION_TRANSITIONS[state] ?? []).filter((t) =>
    holds(t.capability) && (t.capability !== 'sit-examination' || isCandidate));
}

// ---------------------------------------------------------------------------
// 4. THE GATE BEFORE THE EXAMINATION
// ---------------------------------------------------------------------------

export interface Readiness {
  eligible: boolean;
  identityVerified: boolean;
  camera: boolean;
  microphone: boolean;
  screenShare: boolean;
  fullscreen: boolean;
  connectionOk: boolean;
  consented: boolean;
}

export interface Requirement {
  key: keyof Readiness;
  label: string;
  /** Blocking, or merely advisable for this mode? */
  required: boolean;
  met: boolean;
  /** What the candidate should actually do about it. */
  remedy?: string;
}

/**
 * What still stands between this candidate and starting.
 *
 * REQUIREMENTS COME FROM THE MODE, NOT FROM A GLOBAL SETTING. Demanding a
 * screen share for a spoken viva, or a camera for a seventy-two-hour take-home
 * paper, produces a check the candidate cannot pass — and a candidate who
 * cannot start their examination will find a way around the system or miss the
 * sitting. Neither outcome is supervision.
 *
 * EVERY UNMET REQUIREMENT CARRIES A REMEDY. "Camera check failed" sends a
 * frightened candidate to a helpdesk twenty minutes before their paper. "Your
 * browser is blocking the camera — click the camera icon in the address bar and
 * choose Allow" is something they can act on alone.
 */
export function requirementsFor(mode: ExamMode, readiness: Partial<Readiness>): Requirement[] {
  const d = MODE_PROFILES[mode].defaults;
  const r = readiness;

  const list: Requirement[] = [
    {
      key: 'eligible',
      label: 'Registered for this course and cleared to sit',
      required: true,
      met: Boolean(r.eligible),
      remedy: 'The Registry decides eligibility. Contact them — this cannot be resolved here.',
    },
    {
      key: 'identityVerified',
      label: 'Identity verified',
      // Not for a take-home paper: there is nobody to compare a face to over
      // three days, and pretending otherwise is theatre.
      required: mode !== 'take-home',
      met: Boolean(r.identityVerified),
      remedy: 'Hold your student card up to the camera when prompted.',
    },
    {
      key: 'camera',
      label: 'Camera working',
      required: d.camera,
      met: Boolean(r.camera),
      remedy: 'Your browser may be blocking it. Click the camera icon in the address bar and choose Allow.',
    },
    {
      key: 'microphone',
      label: 'Microphone working',
      required: d.microphone,
      met: Boolean(r.microphone),
      remedy: 'Check that the right microphone is selected in your system sound settings.',
    },
    {
      key: 'screenShare',
      label: 'Screen shared',
      required: d.screenShare,
      met: Boolean(r.screenShare),
      remedy: 'Choose “Entire screen” rather than a single window — a shared window hides everything else.',
    },
    {
      key: 'fullscreen',
      label: 'Full screen',
      required: d.fullscreen,
      met: Boolean(r.fullscreen),
      remedy: 'The examination opens full screen when you start. Leaving full screen is recorded.',
    },
    {
      key: 'connectionOk',
      label: 'Connection stable',
      required: mode !== 'take-home',
      met: Boolean(r.connectionOk),
      remedy: 'Move closer to your router, or use a wired connection if you have one.',
    },
    {
      key: 'consented',
      label: 'Examination rules read and accepted',
      required: true,
      met: Boolean(r.consented),
      remedy: 'Read the rules above and tick the box.',
    },
  ];

  return list.filter((x) => x.required || x.met);
}

/** May this candidate start? */
export function mayStart(mode: ExamMode, readiness: Partial<Readiness>): boolean {
  return requirementsFor(mode, readiness).every((r) => !r.required || r.met);
}

// ---------------------------------------------------------------------------
// 5. EVENTS — EVIDENCE, AND NEVER A VERDICT
// ---------------------------------------------------------------------------

export const EVENT_KINDS = [
  'session_created', 'checks_started', 'checks_passed', 'checks_failed',
  'exam_started', 'exam_paused', 'exam_resumed', 'exam_submitted',
  'exam_terminated', 'time_extended',
  'camera_started', 'camera_stopped', 'camera_blocked',
  'microphone_muted', 'microphone_unmuted',
  'screen_share_started', 'screen_share_stopped',
  'fullscreen_entered', 'fullscreen_exited',
  'window_blurred', 'window_focused',
  'paste_detected', 'navigation_attempt',
  'second_face_detected', 'no_face_detected', 'face_returned',
  'voice_detected',
  'connection_lost', 'connection_restored',
  'answer_saved', 'question_viewed',
  'proctor_joined', 'proctor_left', 'proctor_message', 'student_message',
] as const;

export type EventKind = (typeof EVENT_KINDS)[number];
export type EventSource = 'system' | 'proctor' | 'student';
export type EventSeverity = 'info' | 'notice' | 'alert';

/**
 * How loudly the console should show an event.
 *
 * ADVISORY, AND NOTHING ACTS ON IT. No sitting is terminated because of a
 * severity, no mark is reduced, and no finding is generated. It orders a list
 * for a human being, which is the whole of its job.
 *
 * WHY 'alert' IS SPARING. Nine alerts an hour is a console nobody reads, and a
 * proctor who has learned to dismiss alerts will dismiss the one that mattered.
 * A dropped connection is a NOTICE — it happens constantly and is usually the
 * candidate's broadband. A second face in the room is an ALERT, because it is
 * rare and because it is the thing a person actually needs to look at.
 */
export function severityOf(kind: EventKind): EventSeverity {
  switch (kind) {
    case 'second_face_detected':
    case 'screen_share_stopped':
    case 'camera_stopped':
    case 'camera_blocked':
    case 'navigation_attempt':
      return 'alert';

    case 'no_face_detected':
    case 'fullscreen_exited':
    case 'window_blurred':
    case 'paste_detected':
    case 'microphone_muted':
    case 'connection_lost':
    case 'checks_failed':
    case 'exam_terminated':
      return 'notice';

    default:
      return 'info';
  }
}

/** What an event says, in words a candidate or an appeal panel can read. */
export function describeEvent(kind: EventKind, source: EventSource): string {
  const who = source === 'proctor' ? 'The proctor' : source === 'student' ? 'The candidate' : 'The system';
  const text: Partial<Record<EventKind, string>> = {
    session_created: 'The sitting was created.',
    checks_started: 'The candidate began the pre-examination checks.',
    checks_passed: 'The checks passed.',
    checks_failed: 'The checks did not pass.',
    exam_started: 'The examination started.',
    exam_paused: 'The examination was paused.',
    exam_resumed: 'The examination resumed.',
    exam_submitted: 'The candidate submitted.',
    exam_terminated: 'The examination was terminated.',
    time_extended: 'Additional time was granted.',
    camera_started: 'The camera started.',
    camera_stopped: 'The camera stopped.',
    camera_blocked: 'The camera was blocked by the browser or the device.',
    microphone_muted: 'The microphone was muted.',
    microphone_unmuted: 'The microphone was unmuted.',
    screen_share_started: 'Screen sharing started.',
    screen_share_stopped: 'Screen sharing stopped.',
    fullscreen_entered: 'The examination entered full screen.',
    fullscreen_exited: 'The examination left full screen.',
    window_blurred: 'The examination window lost focus.',
    window_focused: 'The examination window regained focus.',
    paste_detected: 'Text was pasted into an answer.',
    navigation_attempt: 'An attempt was made to leave the examination.',
    second_face_detected: 'More than one face was visible to the camera.',
    no_face_detected: 'No face was visible to the camera.',
    face_returned: 'The candidate returned to the camera.',
    voice_detected: 'Another voice was heard.',
    connection_lost: 'The connection dropped.',
    connection_restored: 'The connection was restored.',
    answer_saved: 'An answer was saved.',
    question_viewed: 'A question was opened.',
    proctor_joined: 'A proctor joined the sitting.',
    proctor_left: 'A proctor left the sitting.',
    proctor_message: 'The proctor sent a message.',
    student_message: 'The candidate sent a message.',
  };

  const line = text[kind] ?? `${kind.replace(/_/g, ' ')}.`;
  // System events describe themselves; a person's action names the person's role.
  return source === 'system' ? line : `${who}: ${line.replace(/^The (proctor|candidate) /, '')}`;
}

/**
 * THE SENTENCE THAT MUST APPEAR WHEREVER ALERTS ARE SHOWN.
 *
 * Exported as a constant rather than typed into each screen, so it cannot be
 * softened on one of them. The University was explicit: an automated event is
 * an alert and not proof, and the academic-integrity decision belongs to a
 * person. A console that lists "second face detected" in red with no such
 * sentence beside it is teaching every proctor who reads it the opposite.
 */
export const ALERTS_ARE_NOT_FINDINGS =
  'These are automated observations, not findings. A camera can mistake a reflection, a poster '
  + 'or a passing family member for a second person. Nothing here is evidence of misconduct until '
  + 'a person has looked at it and said so.';

// ---------------------------------------------------------------------------
// 6. EVIDENCE OR DECISION?
// ---------------------------------------------------------------------------

export type RecordClass = 'evidence' | 'decision';

/**
 * Which of the two kinds of thing a given table holds.
 *
 * USED BY THE INTERFACE, so that an examination record can show them apart and
 * label them — the University asked for the distinction because appeals turn on
 * it, and a screen that interleaves "camera stopped at 10:42" with "the
 * examiner found misconduct" without saying which is which has thrown the
 * distinction away at the last step.
 */
export const RECORD_CLASSES: Record<string, RecordClass> = {
  exam_events: 'evidence',
  exam_answers: 'evidence',
  exam_recordings: 'evidence',
  exam_identity_checks: 'evidence',
  exam_device_checks: 'evidence',

  exam_session_decisions: 'decision',
  exam_incidents: 'decision',
  exam_findings: 'decision',
  exam_marks: 'decision',
  exam_reports: 'decision',
};

export const EVIDENCE_NOTE =
  'Evidence. Recorded as it happened and append-only — it cannot be edited or deleted by anyone, '
  + 'including the Superadministrator.';

export const DECISION_NOTE =
  'A decision by a named person. It can be revised, and every revision records who, what, when, '
  + 'what it said before, what it says now, and why.';

// ---------------------------------------------------------------------------
// 7. INCIDENTS AND FINDINGS
// ---------------------------------------------------------------------------

export const INCIDENT_CATEGORIES = [
  'identity', 'environment', 'communication', 'materials', 'technical', 'conduct', 'other',
] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

export const FINDING_OUTCOMES = [
  'no_misconduct', 'informal_warning', 'misconduct', 'referred',
] as const;
export type FindingOutcome = (typeof FINDING_OUTCOMES)[number];

export interface FindingMove {
  raisedBy: string | null;
  decidedBy: string;
  holds: (capability: string) => boolean;
  reasoning?: string | null;
}

/**
 * May this person make this finding?
 *
 * THE SECOND-READER RULE, mirrored from migration 015's trigger. The person who
 * raised the incident cannot be the person who determines it: somebody who has
 * spent forty minutes watching a candidate and suspecting them is the worst
 * available judge of whether the suspicion was justified.
 */
export function canDetermine(move: FindingMove): MoveVerdict {
  if (!move.holds('determine-misconduct')) {
    return {
      allowed: false,
      reason:
        'Finding misconduct is a moderator’s decision. A proctor records what they saw; somebody '
        + 'else weighs it.',
    };
  }

  if (move.raisedBy && move.raisedBy === move.decidedBy) {
    return {
      allowed: false,
      reason:
        'You raised this incident, so you cannot be the one who determines it. It needs a second '
        + 'reader.',
    };
  }

  if (!move.reasoning?.trim()) {
    return {
      allowed: false,
      reason:
        'A finding needs its reasoning written down. It follows a person for the rest of their '
        + 'professional life, and the reasoning is what an appeal reads.',
    };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 8. THE SIX-PART AUDIT RECORD
// ---------------------------------------------------------------------------

export interface AuditRecord {
  who: { id: string | null; role: string | null; email: string | null };
  what: string;
  when: string;
  before: unknown;
  after: unknown;
  reason: string | null;
}

/**
 * One line of the trail, in the University's own six parts.
 *
 * BEFORE AND AFTER ARE THE PART MOST SYSTEMS OMIT. "The mark was changed" is
 * not an audit record — it tells the reader the one thing they already knew.
 * "Changed from 58 to 62 by the moderator because the second page had not been
 * uploaded when it was first marked" is an answer.
 */
export function describeAudit(r: AuditRecord): string {
  const who = r.who.role
    ? `${r.who.role}${r.who.email ? ` (${r.who.email})` : ''}`
    : 'The system';

  const change = r.before !== undefined && r.after !== undefined && r.before !== null
    ? ` — from ${JSON.stringify(r.before)} to ${JSON.stringify(r.after)}`
    : '';

  return `${who} ${r.what.replace(/[._]/g, ' ')}${change}${r.reason ? ` — ${r.reason}` : ''}`;
}
