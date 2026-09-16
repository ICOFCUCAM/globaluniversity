// ---------------------------------------------------------------------------
// WHICH DOOR SOMEBODY CAME THROUGH, AND WHERE IT SHOULD TAKE THEM.
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY SAW
// ---------------------------------------------------------------------------
//
// The public site's Portals menu offers five entries:
//
//     Student Portal (Registration & Transcripts)
//     Online Application
//     E-Learning (LMS)
//     Administration
//     Transcripts
//
// FOUR OF THEM POINTED AT THE SAME ADDRESS. `/portal`, identically, and the
// portal always opened on the dashboard — so the menu promised five
// destinations, delivered two, and threw away the one thing the visitor had
// just told it: what they came to do.
//
// The University put it exactly right: "it seams all those windows open to one
// area… maybe the login widget should be arrange such that it leads the
// different users to their different areas."
//
// ---------------------------------------------------------------------------
// ONE DOOR, MANY DESTINATIONS — AND NOT FIVE DOORS
// ---------------------------------------------------------------------------
//
// The obvious reading is five sign-in pages, one per portal. That would be
// worse than what is there now, for a reason this system already knows:
//
//     A LINK CANNOT KNOW WHO YOU ARE.
//
// An "Administration" sign-in would have no way to tell a student from a
// Registrar until after the password was typed, so it would either refuse
// people at the wrong moment or refuse nobody and be decoration. And five
// sign-ins is five things that must agree about sessions, passwords and
// lockouts.
//
// So a portal link states an INTENT and identity decides whether it can be
// honoured. It is the same principle the database already works by — row-level
// security is a floor, not an identity — applied to navigation: a link is a
// request, never an authorisation.
//
// ---------------------------------------------------------------------------
// AND AN INTENT IS A LIST, NOT A SCREEN
// ---------------------------------------------------------------------------
//
// "Transcripts" means two different screens depending on who is asking: a
// student wants their own record, and a Registrar wants the desk that issues
// one. Both are the right answer to the same word.
//
// So each intent carries candidates in order, and the first one the signed-in
// role is actually served wins. Nothing here grants access: the candidate is
// only offered if `portalNav` already serves that role that screen, which is
// itself gated on the capability matrix.
//
// If none of them fits — an applicant who clicked Administration — the person
// lands on their own dashboard and is told why, rather than being dropped
// somewhere with no explanation.
// ---------------------------------------------------------------------------

import type { UserRole, ViewType } from './types';
import { groupsFor } from './portalNav';

export interface PortalIntent {
  /** What the public menu calls it, so the sign-in card can say it back. */
  label: string;
  /**
   * Where it leads, best first.
   *
   * ORDER IS THE WHOLE DESIGN. `transcripts` offers a student their own record
   * before it offers anybody the issuing desk, so the commonest visitor gets
   * the commonest answer without the list having to know who they are.
   */
  candidates: ViewType[];
}

export const PORTAL_INTENTS: Record<string, PortalIntent> = {
  student: {
    label: 'Student Portal',
    // -------------------------------------------------------------------
    // `course-registration` WAS FIRST HERE AND WAS WRONG, because STAFF ARE
    // SERVED IT TOO. A Registrar following "Student Portal" landed on the
    // screen a student uses to pick their own courses, which is not the
    // Registrar's version of anything.
    //
    // Written across all twenty-five roles, the answer was obvious and the
    // assertion for one role had missed it. `my-programme` is a student's
    // own home and is served to students alone; `students` is the register,
    // and is the staff answer to the same word.
    // -------------------------------------------------------------------
    candidates: ['my-programme', 'students'],
  },
  lms: {
    label: 'E-Learning',
    candidates: ['lms', 'my-courses', 'programme-resources'],
  },
  administration: {
    label: 'Administration',
    // -------------------------------------------------------------------
    // `settings` WAS ON THIS LIST AND WAS WRONG, and the test is what said
    // so: EVERY role is served Settings, so a student following
    // "Administration" landed on their own account preferences — which is
    // not administration, and is exactly the kind of near-miss that teaches
    // somebody the menu is lying to them.
    //
    // A candidate only belongs here if being served it means holding
    // administrative authority. These four do; a settings page does not.
    //
    // There is no dedicated "administration" screen and none should exist:
    // what administration MEANS differs by office, and each office's
    // dashboard is already that answer. Hence the fall-through.
    // -------------------------------------------------------------------
    // Ordered from the most administrative outward, so an office served
    // several lands on the one that means the most. The last three are what
    // "administration" means to an office that has no system screens: the
    // Rector's own administration, its finances, and the Registrar's desk.
    candidates: [
      'accounts', 'audit', 'document-templates', 'national-administrations',
      'national-rectorate', 'national-finance', 'admissions-registrar',
    ],
  },
  transcripts: {
    label: 'Transcripts',
    candidates: ['my-transcript', 'transcript'],
  },
};

export interface Resolved {
  view: ViewType;
  /** False when the intent could not be met and the dashboard was used. */
  honoured: boolean;
  /** Said to the person, when it was not. Never a stack trace. */
  note: string | null;
}

/** Every view this role is actually served, from the navigation itself. */
function servedViews(role: UserRole | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const group of groupsFor(role)) {
    for (const item of group.items) out.add(item.id);
  }
  return out;
}

/**
 * Where to land somebody who arrived through a named portal.
 *
 * NOTHING HERE OPENS A DOOR. It chooses among doors `portalNav` has already
 * decided this role may use, so an intent cannot be used to reach a screen the
 * capability matrix withholds — which is the whole reason the candidate list is
 * filtered rather than trusted.
 */
export function resolveIntent(
  intent: string | null | undefined,
  role: UserRole | null | undefined,
): Resolved {
  const fallback: Resolved = { view: 'dashboard', honoured: false, note: null };
  if (!intent) return { ...fallback, honoured: true };

  const wanted = PORTAL_INTENTS[intent];
  if (!wanted) return { ...fallback, honoured: true };

  const served = servedViews(role);
  const hit = wanted.candidates.find((c) => served.has(c));
  if (hit) return { view: hit, honoured: true, note: null };

  return {
    ...fallback,
    note: `${wanted.label} is not part of your portal, so this is your dashboard instead. `
      + 'If you expected to reach it, your account may hold a different role from the one '
      + 'you were thinking of — the Registrar’s office can tell you which.',
  };
}

/** The `?to=` on a portal link, if it names an intent this file knows. */
export function intentFromSearch(search: string): string | null {
  try {
    const to = new URLSearchParams(search).get('to');
    return to && PORTAL_INTENTS[to] ? to : null;
  } catch {
    // A malformed query string is not a reason to fail to open the portal.
    return null;
  }
}
