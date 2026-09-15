// ---------------------------------------------------------------------------
// RESOURCE + ACTION + SCOPE.
//
// ---------------------------------------------------------------------------
// WHY A CAPABILITY WAS NEVER ENOUGH
// ---------------------------------------------------------------------------
//
// The University, on what a lecturer's account may do:
//
//   "Lecturer
//      ├── Courses          → view
//      ├── Question Bank    → manage:own-courses
//      ├── Question Papers  → create-draft:own-courses
//      ├── Students         → view:own-courses
//      ├── Early Warning    → manage:own-courses
//      ├── Announcements    → create:own-courses
//      └── Timetable        → view
//
//    Then the sidebar automatically knows whether something should be
//    displayed."
//
// A capability is one word and carries none of that. `manage-question-bank`
// cannot say "their own"; `view-registered-students` cannot say "in their own
// courses". So "own" lived nowhere: it was either written again inside each
// screen, or — far more often — not written at all, and a lecturer reached the
// whole University's question bank because the only alternative was reaching
// none of it.
//
// AND THE SIDEBAR KNEW LESS STILL. It was gated on ROLE alone, while the routes
// were gated on CAPABILITY, so the two answered different questions and
// disagreed in both directions: a capability held with no door, and a door held
// with no capability.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS, AND WHAT IT IS NOT YET
// ---------------------------------------------------------------------------
//
// One grant is a RESOURCE, an ACTION and a SCOPE. The sidebar, the page and the
// route all read the same grant, so they cannot disagree about who may do what
// to which of it.
//
// IT IS AUTHORITATIVE FOR THE ROLES THE UNIVERSITY HAS RULED ON, and only
// those. The capability matrix in `roles.ts` still answers for everybody else,
// because rewriting 111 capabilities across 23 roles without a ruling on each
// would mean INVENTING the University's own arrangements — which is the one
// thing this codebase must never do. `grants.test.mjs` asserts the two agree
// wherever both have an opinion, so they cannot drift apart while the migration
// is half done.
// ---------------------------------------------------------------------------

import type { UserRole } from './types';

/**
 * The things somebody acts on.
 *
 * NAMED FOR WHAT A PERSON WOULD CALL THEM, not for tables. "Question papers" is
 * one resource even though it touches three tables, because the University's
 * ruling is about question papers.
 */
export const RESOURCES = [
  'courses',
  // ---- NAMED IN THE UNIVERSITY'S OWN EXAMPLES, September 2026 ----------
  //
  //   Registrar → manage academic records → students → manage → university
  //   Student   → view academic record    → academic record → view → self
  //   VC        → issue appointment       → appointments → issue → institution
  //   Finance Officer → Fees → university-wide financial scope
  //
  // `academic-record` is deliberately NOT `students`: the University wrote
  // both, on the same list, for different roles. A Registrar manages the
  // student register; a student views their own academic record. Collapsing
  // them would grant one of those two something nobody granted.
  'academic-record',
  'appointments',
  'fees',
  'question-bank',
  'question-papers',
  'students',
  'early-warning',
  'announcements',
  'timetable',
  'staff-record',
  'grades',
] as const;

export type Resource = (typeof RESOURCES)[number];

/**
 * What may be done to one.
 *
 * `create-draft` IS ITS OWN ACTION, and that is the University's point about
 * examination papers: "the lecturer can prepare the paper but cannot
 * unilaterally make it the University's official examination paper." A draft
 * and an official paper are two different things to be able to make.
 */
export const ACTIONS = [
  'view',
  /** The University's word for a Vice-Chancellor and an appointment. */
  'issue',
  'create-draft',
  'create',
  'manage',
  'submit',
  'approve',
  'publish',
] as const;

export type Action = (typeof ACTIONS)[number];

/**
 * How much of a resource a grant reaches.
 *
 * THE WORD THE WHOLE MODEL EXISTS FOR. Every fault the University found in the
 * lecturer's account was a missing scope: the early-warning screen was the
 * institution's, the question bank was the University's, the roll was visible
 * only by accident. None of those was a decision anybody took — there was
 * simply no way to say "own".
 */
export const SCOPES = [
  /** The whole University. */
  'university',
  'own-faculty',
  'own-department',
  'own-programme',
  /** The courses this person is allocated to teach. */
  'own-courses',
  /** This person, and nobody else. */
  'self',
] as const;

export type Scope = (typeof SCOPES)[number];

export interface Grant {
  resource: Resource;
  action: Action;
  scope: Scope;
}

/**
 * The University's ruling on a lecturer, September 2026, written as it was
 * given.
 *
 * "A lecturer should be able to teach a course, but should not be able to
 *  define the University's course catalogue."
 */
const LECTURER: Grant[] = [
  // Their own record, and nobody else's.
  { resource: 'staff-record', action: 'view', scope: 'self' },

  // VIEW, never manage. The catalogue is curriculum governance.
  { resource: 'courses', action: 'view', scope: 'own-courses' },

  // Their students, in their own classes — a roll, not a record.
  { resource: 'students', action: 'view', scope: 'own-courses' },

  // Their teaching content, which IS theirs.
  { resource: 'question-bank', action: 'manage', scope: 'own-courses' },

  // ---------------------------------------------------------------------
  // PREPARE, AND SUBMIT. NOT APPROVE, AND NOT PUBLISH.
  //
  // The University's workflow: draft → submit → review → approve → lock →
  // official examination paper. The lecturer holds the first two arrows and
  // none of the rest, so they cannot unilaterally make a paper the
  // University's official one.
  // ---------------------------------------------------------------------
  { resource: 'question-papers', action: 'create-draft', scope: 'own-courses' },
  { resource: 'question-papers', action: 'submit', scope: 'own-courses' },

  // Marks: enter and submit for moderation. Approving one is elsewhere, and
  // 015 refuses anybody moderating their own marking.
  { resource: 'grades', action: 'manage', scope: 'own-courses' },
  { resource: 'grades', action: 'submit', scope: 'own-courses' },

  // ---------------------------------------------------------------------
  // "A LECTURER SHOULD BE ABLE TO IDENTIFY STUDENTS IN THEIR OWN COURSES WHO
  // NEED ATTENTION… but should not have access to a university-wide
  // student-risk database."
  // ---------------------------------------------------------------------
  { resource: 'early-warning', action: 'manage', scope: 'own-courses' },

  // A notice to their own class. Not the University speaking — that is
  // `announcements/create:university`, and they may still READ those.
  { resource: 'announcements', action: 'view', scope: 'university' },
  { resource: 'announcements', action: 'create', scope: 'own-courses' },

  // The timetable is read, never moved.
  { resource: 'timetable', action: 'view', scope: 'university' },
];

/**
 * Every role the University has ruled on in these terms.
 *
 * DELIBERATELY SHORT. A role added here stops consulting the capability matrix
 * for the resources named, so it goes in when the University has said what it
 * should hold — not when somebody guesses.
 */
// ---------------------------------------------------------------------------
// THE FIVE THE UNIVERSITY WROTE OUT, AND NOT ONE LINE MORE
// ---------------------------------------------------------------------------
//
// Given as examples under "AUTHORIZATION ARCHITECTURE", September 2026:
//
//     Dean      → view students          → students → view → own faculty
//     Registrar → manage academic records → students → manage → university
//     Student   → view academic record   → academic record → view → self
//     VC        → issue appointment      → appointments → issue → institution
//     Finance Officer → Fees → university-wide financial scope
//
// EACH IS EXACTLY ONE TRIPLE, because exactly one was given. The temptation is
// to fill in the rest — a Dean surely also views courses, a Registrar surely
// manages enrolments — and that is the one thing this file must never do. What
// a Dean may do beyond this is not yet ruled, and a guess written here would be
// indistinguishable from a ruling when somebody reads it next year.
//
// SO THESE ARE PARTIAL, AND THE LECTURER'S IS NOT. See `COMPLETE` below: for a
// role with a complete tree the absence of a grant is a REFUSAL; for a role
// with a partial one it means "not ruled on yet", and the capability matrix
// answers as it did before.
//
// MEASURED RATHER THAN ASSERTED: treating the Dean's one line as complete
// takes their sidebar from 20 items to 18 today. Two screens, silently, for
// every Dean in the University — and the number grows with every menu entry
// that gains a `resource` and an `action`, because those are the only ones the
// grant is consulted for. Small today, and the wrong direction.
// ---------------------------------------------------------------------------
const DEAN: Grant[] = [
  { resource: 'students', action: 'view', scope: 'own-faculty' },
];

const REGISTRAR: Grant[] = [
  { resource: 'students', action: 'manage', scope: 'university' },
];

const STUDENT: Grant[] = [
  { resource: 'academic-record', action: 'view', scope: 'self' },
];

// 'institution' IS THE UNIVERSITY'S WORD and 'university' is the scope this
// vocabulary already had. They are the same extent here — the whole of the
// institution — so a second name for it was not added: two words for one reach
// is how `assign-lecturers` and `assign-lecturers-to-courses` came to exist,
// with nothing enforcing either. If the University means something WIDER than
// the University by "institution", this is the line to correct.
const VICE_CHANCELLOR: Grant[] = [
  { resource: 'appointments', action: 'issue', scope: 'university' },
];

const FINANCE: Grant[] = [
  { resource: 'fees', action: 'manage', scope: 'university' },
];

const GRANTS: Partial<Record<UserRole, Grant[]>> = {
  lecturer: LECTURER,
  dean: DEAN,
  registrar: REGISTRAR,
  student: STUDENT,
  'vice-chancellor': VICE_CHANCELLOR,
  finance: FINANCE,
};

/**
 * Roles whose grant tree is the WHOLE of what they may do.
 *
 * For these, no grant means refused. For every other role in `GRANTS` the tree
 * is what the University has ruled SO FAR, and anything absent falls back to
 * the capability matrix — which is the honest reading of one line written on a
 * list headed "Examples".
 */
const COMPLETE: ReadonlySet<UserRole> = new Set<UserRole>(['lecturer']);

/** Is this role's tree exhaustive, so that silence means refusal? */
export function isComplete(role: UserRole | null | undefined): boolean {
  return Boolean(role && COMPLETE.has(role));
}

/** Whether this role has been ruled on in resource/action/scope terms at all. */
export function isRuled(role: UserRole | null | undefined): boolean {
  return Boolean(role && GRANTS[role]);
}

/**
 * Whether the grant model is the authority for this role on this exact
 * resource and action — as opposed to the capability matrix.
 *
 * TRUE WHEN THERE IS A RULING TO APPLY, and true for every resource/action of
 * a role whose tree is complete, because there silence is itself the ruling.
 */
export function grantDecides(
  role: UserRole | null | undefined, resource: Resource, action: Action,
): boolean {
  if (isComplete(role)) return true;
  return scopeOf(role, resource, action) !== null;
}

export function grantsFor(role: UserRole | null | undefined): Grant[] {
  return (role && GRANTS[role]) ?? [];
}

/**
 * The scope at which this role may take this action on this resource, or null
 * where they may not take it at all.
 *
 * RETURNS THE SCOPE RATHER THAN A BOOLEAN, because the caller almost always
 * needs it: a screen that knows somebody may `view` students still has to know
 * whether to show the whole register or one course's roll.
 */
export function scopeOf(
  role: UserRole | null | undefined,
  resource: Resource,
  action: Action,
): Scope | null {
  const g = grantsFor(role).find((x) => x.resource === resource && x.action === action);
  return g ? g.scope : null;
}

/**
 * Whether anything at all may be done with this resource — which is exactly the
 * question a sidebar asks.
 *
 * "Then the sidebar automatically knows whether something should be displayed."
 */
export function mayReach(
  role: UserRole | null | undefined,
  resource: Resource,
): boolean {
  return grantsFor(role).some((g) => g.resource === resource);
}

/**
 * What a screen should say about how much it is showing.
 *
 * SAID, RATHER THAN LEFT TO BE INFERRED. A lecturer looking at an early-warning
 * list with four students on it should know it is four of THEIRS and not four
 * in the University.
 */
export const SCOPE_LABELS: Record<Scope, string> = {
  university: 'across the University',
  'own-faculty': 'in your faculty',
  'own-department': 'in your department',
  'own-programme': 'on your programme',
  'own-courses': 'on the courses you teach',
  self: 'your own',
};
