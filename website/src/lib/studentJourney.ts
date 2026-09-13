// ---------------------------------------------------------------------------
// THE STUDENT'S JOURNEY, AS THE PORTAL READS IT.
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY ASKED FOR
// ---------------------------------------------------------------------------
//
// "The student web should not simply expose the Superadmin Academic modules.
// It should be a student-facing academic journey, with information and actions
// appearing according to the student's actual status."
//
// The stage itself is decided in SQL — `student_stage()`, added by 070 — so
// that the dashboard, the navigation and every screen read the same answer. If
// each worked it out for itself they would come to differ, and the first time
// they did, a student would be offered a registration button on a screen that
// also told them registration had closed.
//
// WHAT LIVES HERE is what the stage MEANS to a reader: what to call it, what
// it entitles them to see, and what the one next thing to do is.
//
// ---------------------------------------------------------------------------
// EVERY STAGE HAS A NEXT STEP, OR SAYS WHY IT HAS NONE
// ---------------------------------------------------------------------------
//
// A portal that shows a student where they are and not what to do next is a
// status page. The difference between the two is `whatNext`, and where it is
// null the stage says plainly that the next move is somebody else's — which is
// information too, and better than a button that does nothing.
// ---------------------------------------------------------------------------

import type { ViewType } from './types';

/** The stages `student_stage()` returns. Kept in the order a journey runs. */
export const STAGES = [
  'applying',
  'not-admitted',
  'deferred',
  'admitted',
  'awaiting-programme',
  'registering',
  'studying',
  'suspended',
  'withdrawn',
  'graduated',
  'alumni',
] as const;

export type Stage = typeof STAGES[number];

export interface StageMeaning {
  /** What the student is called at this stage, in the second person. */
  heading: string;
  /** One sentence saying where they stand. */
  says: string;
  /**
   * The single next thing to do, or null where the next move is not theirs.
   *
   * NULL IS A REAL ANSWER. "Your application is with the Admissions Office" is
   * more use than a disabled button, and a portal that invents an action for
   * every stage teaches people to press things that do nothing.
   */
  whatNext: { label: string; goTo: ViewType } | null;
  /** Said where `whatNext` is null: whose move it is. */
  waitingOn?: string;
  /**
   * Which screens mean anything at this stage.
   *
   * NOT A PERMISSION. `roles.ts` decides what a student MAY open; this decides
   * what is worth offering them today. A student still applying may in
   * principle open the timetable; showing it to them would imply they have
   * classes.
   */
  shows: ViewType[];
  tone: 'waiting' | 'good' | 'attention' | 'ended';
}

// What every enrolled student's portal contains, once they are actually
// studying. Listed once rather than repeated across the stages that share it.
const STUDYING: ViewType[] = [
  'dashboard', 'my-programme', 'course-registration', 'lms', 'timetable',
  'my-calendar', 'results', 'my-transcript', 'my-graduation',
  'assignments', 'sit-examination', 'forum',
  'my-finance', 'my-documents', 'my-credentials',
  'student-services', 'my-announcements', 'my-profile', 'settings',
];

// What is worth offering to somebody who is not studying: nothing about
// courses, and everything about their own record and their own account. Listed
// once rather than repeated across the four stages that share it.
const RECORD_ONLY: ViewType[] = [
  'dashboard', 'my-transcript', 'my-graduation', 'results', 'my-documents',
  'my-credentials', 'my-finance', 'student-services', 'my-announcements',
  'my-profile', 'settings',
];

export const STAGE_MEANING: Record<Stage, StageMeaning> = {
  // ---------------------------------------------------------------------
  // BEFORE THERE IS A STUDENT
  //
  // The hardest case to get right, and the one a portal usually gets wrong by
  // showing an empty curriculum. A person whose application is under review
  // has no programme, no courses and no timetable — and a screen that draws
  // the shell of those things tells them they have a place.
  // ---------------------------------------------------------------------
  applying: {
    heading: 'Your application is with us',
    says: 'You are not enrolled yet, so there is no programme, timetable or course list here '
      + 'to show you. Everything about your application — its status, your documents and your '
      + 'payment — is in the Admissions Portal.',
    whatNext: null,
    waitingOn: 'The Admissions Office. You will be emailed when a decision is made.',
    shows: ['dashboard', 'my-documents', 'my-announcements', 'my-profile', 'settings'],
    tone: 'waiting',
  },
  'not-admitted': {
    heading: 'This application was not successful',
    says: 'The University was not able to offer you a place on this application. Nothing further '
      + 'is outstanding on your side.',
    whatNext: null,
    waitingOn: 'Nobody. The Admissions Office can tell you about applying again.',
    shows: ['dashboard', 'my-documents', 'my-profile', 'settings'],
    tone: 'ended',
  },
  deferred: {
    heading: 'Your place is deferred',
    says: 'You have been admitted and your entry has been deferred to a later intake. Your place '
      + 'is held; there is nothing academic to do until it opens.',
    whatNext: null,
    waitingOn: 'The Registry, who will write when your intake opens.',
    shows: ['dashboard', 'my-documents', 'my-announcements', 'student-services',
      'my-profile', 'settings'],
    tone: 'waiting',
  },

  // ---------------------------------------------------------------------
  // ADMITTED, NOT YET ENROLLED
  //
  // The offer is made and the place is not taken up. There is a letter to
  // read and an acceptance to make — and still no curriculum, because a
  // curriculum is attached at enrolment.
  // ---------------------------------------------------------------------
  admitted: {
    heading: 'You have been offered a place',
    says: 'Your admission letter is ready. Accepting it and enrolling is what turns the offer '
      + 'into a place — until then there is no programme record to read.',
    whatNext: { label: 'Read your admission letter', goTo: 'my-credentials' },
    shows: ['dashboard', 'my-credentials', 'my-documents', 'my-announcements',
      'student-services', 'my-profile', 'settings'],
    tone: 'attention',
  },

  // ---------------------------------------------------------------------
  // ENROLLED
  // ---------------------------------------------------------------------
  //
  // NO CURRICULUM IS ITS OWN STAGE. Without it the progress page reads
  // "0 of 0 credits", which a reader takes to mean a finished degree.
  'awaiting-programme': {
    heading: 'You are enrolled',
    says: 'Your record is not yet attached to a curriculum, so there is nothing to register for '
      + 'and no progress to show. That is the Registry’s next step, not yours.',
    whatNext: null,
    waitingOn: 'The Registry, who attach your record to the curriculum you were admitted under.',
    shows: ['dashboard', 'my-credentials', 'my-documents', 'my-finance',
      'my-announcements', 'student-services', 'my-profile', 'settings'],
    tone: 'waiting',
  },
  registering: {
    heading: 'Time to register',
    says: 'You are enrolled on your programme and have not registered for any courses this '
      + 'semester. Nothing else in the portal fills up until you do — no timetable, no '
      + 'materials, no marks.',
    whatNext: { label: 'Register for this semester', goTo: 'course-registration' },
    shows: STUDYING,
    tone: 'attention',
  },
  studying: {
    heading: 'You are studying',
    says: 'Registered for this semester. Your courses, materials and timetable are all here.',
    whatNext: { label: 'Open your courses', goTo: 'lms' },
    shows: STUDYING,
    tone: 'good',
  },

  // ---------------------------------------------------------------------
  // THE ENDINGS
  // ---------------------------------------------------------------------
  suspended: {
    heading: 'Your studies are suspended',
    says: 'You cannot register for courses while a suspension stands. Your record and your '
      + 'results remain, and remain yours.',
    whatNext: null,
    waitingOn: 'The Registry. A suspension is lifted by the office that recorded it.',
    shows: RECORD_ONLY,
    tone: 'attention',
  },
  withdrawn: {
    heading: 'You have withdrawn',
    says: 'Your studies have ended. Everything you completed stays on your record and you can '
      + 'still request a transcript of it.',
    whatNext: { label: 'Your transcript', goTo: 'my-transcript' },
    shows: RECORD_ONLY,
    tone: 'ended',
  },
  graduated: {
    heading: 'You have completed your programme',
    says: 'Your studies are finished and your award is being processed. The certificate follows '
      + 'the Senate’s conferral.',
    whatNext: { label: 'Where you stand', goTo: 'my-graduation' },
    shows: RECORD_ONLY,
    tone: 'good',
  },
  // THE DEGREE IS CONFERRED. A graduate is not a student, and the portal
  // stops offering them a curriculum and a timetable — but it does not stop
  // being theirs. A transcript and a certificate are wanted for decades.
  alumni: {
    heading: 'Congratulations, graduate',
    says: 'Your degree has been conferred. Your transcript and certificate are here whenever you '
      + 'need them — for as long as the University keeps records, which is for ever.',
    whatNext: { label: 'Your credentials', goTo: 'my-credentials' },
    shows: RECORD_ONLY,
    tone: 'good',
  },
};

/**
 * What a stage means, for any string the database might return.
 *
 * AN UNKNOWN STAGE IS NOT A CRASH AND NOT A BLANK SCREEN. If a later migration
 * adds one and this file has not caught up, the student sees a portal that
 * works and a sentence saying the University is looking at their record —
 * rather than a page that renders nothing at all.
 */
export function meaningOf(stage: string | null | undefined): StageMeaning {
  const known = STAGE_MEANING[stage as Stage];
  if (known) return known;
  return {
    heading: 'Your record is being looked at',
    says: 'Your record is in a state this portal does not yet have a page for. Nothing is wrong '
      + 'with it; write to the Registry if you need something in the meantime.',
    whatNext: null,
    waitingOn: 'The Registry.',
    shows: ['dashboard', 'my-documents', 'my-announcements', 'my-profile', 'settings'],
    tone: 'waiting',
  };
}

/** Whether a screen is worth offering at this stage. */
export function showsAtStage(stage: string | null | undefined, view: ViewType): boolean {
  return meaningOf(stage).shows.includes(view);
}

/**
 * The four words the University asked for, for one course of a curriculum.
 *
 * "Completed, In Progress, Outstanding, Not Yet Available."
 *
 * The fourth needed a fact the curriculum does not hold: whether the course is
 * actually OFFERED this term. A student cannot register for a course nobody is
 * running, and telling them it is merely "outstanding" sends them looking for
 * a button that is not there.
 */
export function courseStanding(
  state: string,
  offeredNow: boolean | null,
): { label: string; tone: 'done' | 'now' | 'todo' | 'later' | 'failed' } {
  if (state === 'passed') return { label: 'Completed', tone: 'done' };
  if (state === 'failed') return { label: 'Failed — to be repeated', tone: 'failed' };
  if (state === 'registered') return { label: 'In progress', tone: 'now' };
  // NOT-TAKEN SPLITS IN TWO, and that is the whole point of this function.
  if (offeredNow) return { label: 'Outstanding', tone: 'todo' };
  return { label: 'Not yet available', tone: 'later' };
}
