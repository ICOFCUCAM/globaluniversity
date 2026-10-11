// ---------------------------------------------------------------------------
// WHERE A TRANSFER CREDIT HAS GOT TO.
//
// ---------------------------------------------------------------------------
// WHY THIS IS A FILE AND NOT A CONSTANT IN THE SCREEN
// ---------------------------------------------------------------------------
//
// Because the ladder is the database's. 110 holds it in
// `a_transfer_credit_follows_its_path()`, on a table five offices can write
// to, and a screen that kept its own list of the states would be a second
// description of a thing it does not own — right until somebody added a state
// to the migration.
//
// `transferCreditWorkflow.test.mjs` reads 110's CHECK constraint and fails if
// this file knows a different set of words.
// ---------------------------------------------------------------------------

export const TRANSFER_STATUS: Record<string, { label: string; className: string; note: string }> = {
  submitted: {
    label: 'Recorded',
    className: 'bg-[#fdf3e0] text-[#a86a12]',
    note: 'What the student presented, typed up by the Registry. It counts for nothing yet.',
  },
  under_review: {
    label: 'With the Dean',
    className: 'bg-[#eef2fb] text-[#3a4f86]',
    note: 'On the desk of the Faculty Dean or the Academic Office. It still counts for nothing.',
  },
  accepted: {
    label: 'Accepted',
    className: 'bg-[#e7f5ed] text-[#1f7a4d]',
    note: 'Counts toward the award, apart from credit earned at ICOF, and never toward the GPA.',
  },
  refused: {
    label: 'Refused',
    className: 'bg-[#fdeaee] text-[#a3283f]',
    note: 'The University did not accept it. The reason is on the file, and arguing it again '
      + 'is a new claim rather than a reopened one.',
  },
  withdrawn: {
    label: 'Withdrawn',
    className: 'bg-[#f8f6fb] text-[#5c5366]',
    note: 'Taken back before anybody decided it.',
  },
  rescinded: {
    label: 'Rescinded',
    className: 'bg-[#f8f6fb] text-[#5c5366]',
    note: 'Accepted and then taken back out of the record — on a false transcript, for '
      + 'instance. It has come off the progress sheet and out of the totals, and the reason '
      + 'is on the file.',
  },
};

/** The statuses, in the order the ladder goes. */
export const TRANSFER_STATUSES = Object.keys(TRANSFER_STATUS);

/**
 * A state this file has not been taught is shown as itself rather than as a
 * blank. The University has found three gaps in this system by looking at a
 * screen; a row that renders as nothing is a gap nobody can find.
 */
export const transferStatusLabel = (status: string | null | undefined): string => {
  if (!status) return 'Unrecorded';
  return TRANSFER_STATUS[status]?.label ?? status;
};

/** Whether this state means the credit is counting toward the award right now. */
export const transferCounts = (status: string | null | undefined): boolean =>
  status === 'accepted';
