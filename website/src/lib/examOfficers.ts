// ---------------------------------------------------------------------------
// THE FIVE KINDS OF EXAMINATION OFFICER, AND WHICH OF THEM IS IN THE ROOM.
//
// ---------------------------------------------------------------------------
// WHY THE DISTINCTION IS THE WHOLE POINT
// ---------------------------------------------------------------------------
//
// 015 gave `examination_officers.role` five values and no screen ever used
// them. They are not five words for the same job:
//
//   an INVIGILATOR is in the room while the paper is being sat
//   an EXAMINER marks it afterwards
//   a MODERATOR checks the marking
//   a CHAIR is answerable for the paper
//   an OBSERVER is present and decides nothing
//
// ONLY THE FIRST IS WATCHING. `examinations_nobody_is_watching` counts
// invigilators alone, because an examination with a chair, an examiner and a
// moderator and no invigilator is an examination nobody is in the room for —
// and a list that reported it as covered would be worse than no list.
//
// All five open the live console for that paper, which is a different
// question: a chair who cannot look at the room they are answerable for is
// answerable for nothing.
// ---------------------------------------------------------------------------

export interface OfficerRole {
  role: string;
  label: string;
  /** Whether this kind is in the room while the paper is being sat. */
  watches: boolean;
  note: string;
}

export const OFFICER_ROLES: OfficerRole[] = [
  {
    role: 'invigilator',
    label: 'Invigilator',
    watches: true,
    note: 'In the room while the paper is being sat. This is the only kind that counts as '
      + 'watching, and an examination with none is on the unwatched list however many other '
      + 'officers it has.',
  },
  {
    role: 'chair',
    label: 'Chair',
    watches: false,
    note: 'Answerable for the paper. Sees the live room, because somebody answerable for a '
      + 'sitting they cannot look at is answerable for nothing.',
  },
  {
    role: 'examiner',
    label: 'Examiner',
    watches: false,
    note: 'Marks it afterwards. Not in the room, so appointing one does not make an '
      + 'examination watched.',
  },
  {
    role: 'moderator',
    label: 'Moderator',
    watches: false,
    note: 'Checks the marking. 015 refuses to let an examiner moderate their own mark.',
  },
  {
    role: 'observer',
    label: 'Observer',
    watches: false,
    note: 'Present and decides nothing.',
  },
];

export const officerLabel = (role: string | null | undefined): string => {
  if (!role) return 'Unassigned';
  return OFFICER_ROLES.find((r) => r.role === role)?.label ?? role;
};

export const officerWatches = (role: string | null | undefined): boolean =>
  OFFICER_ROLES.some((r) => r.role === role && r.watches);
