// ---------------------------------------------------------------------------
// WHAT A LESSON IS, AND WHAT A STUDENT'S PROGRESS THROUGH ONE CAN BE.
//
// ---------------------------------------------------------------------------
// THESE WORDS ARE THE DATABASE'S, NOT THIS FILE'S
// ---------------------------------------------------------------------------
//
// 084 fixed both lists in CHECK constraints:
//
//   course_lessons.kind   ten kinds, from a paragraph of text to a live class
//   lesson_progress.state exactly two — `started` and `completed`
//
// And `lesson_progress_completed_has_a_moment` ties the second to a date:
// state = 'completed' exactly when `completed_at` is set. A screen that wrote
// 'complete' or 'in_progress' — which is what they are called in most systems
// and what this file first said — would be refused by the constraint, and the
// Mark as done button would simply not work.
//
// `courseHub.test.mjs` reads both constraints out of 084 and fails if this
// file has learned a different vocabulary.
// ---------------------------------------------------------------------------

export type LessonIconName = 'play' | 'file' | 'link' | 'calendar' | 'book';

export const LESSON_KINDS: Record<string, { label: string; icon: LessonIconName }> = {
  text: { label: 'Reading', icon: 'file' },
  document: { label: 'Document', icon: 'file' },
  reading: { label: 'Set reading', icon: 'book' },
  audio: { label: 'Audio', icon: 'play' },
  video: { label: 'Video', icon: 'play' },
  video_external: { label: 'Video', icon: 'play' },
  link: { label: 'Link', icon: 'link' },
  image: { label: 'Image', icon: 'file' },
  presentation: { label: 'Presentation', icon: 'file' },
  live_class: { label: 'Live class', icon: 'calendar' },
};

/** A kind this file has not been taught is shown as itself, never as a blank. */
export const lessonKindLabel = (kind: string | null | undefined): string => {
  if (!kind) return 'Material';
  return LESSON_KINDS[kind]?.label ?? kind;
};

/**
 * The two states, spelled as the database spells them.
 *
 * NOT 'complete' AND NOT 'in_progress'. See the note above: the CHECK
 * constraint refuses anything else, and a button that writes the wrong word
 * fails silently to the person pressing it.
 */
export const LESSON_STARTED = 'started';
export const LESSON_COMPLETED = 'completed';

/**
 * What to write when a student marks a lesson done, or un-marks it.
 *
 * `completed_at` IS NOT OPTIONAL AND IS NOT DECORATION.
 * `lesson_progress_completed_has_a_moment` requires that it is set exactly
 * when the state is `completed` — so un-marking has to clear it, and a screen
 * that only changed the word would be refused.
 */
export function lessonProgressPatch(done: boolean): {
  state: string; completed_at: string | null; started_at?: string;
} {
  return done
    ? { state: LESSON_COMPLETED, completed_at: new Date().toISOString() }
    : { state: LESSON_STARTED, completed_at: null, started_at: new Date().toISOString() };
}
