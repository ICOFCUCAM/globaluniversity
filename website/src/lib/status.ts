// ---------------------------------------------------------------------------
// The universal status system.
//
// The university's point is exactly right: when every department reads the same
// colour the same way, a record can move between Finance, the Registrar and the
// faculty without anyone having to ask what state it is in. That only works if
// there is ONE table, so this is it. No module defines its own colours.
//
// Two design rules that follow from that, and that this file enforces:
//
//   1. A status carries its own meaning, colour and order. A module renders a
//      status by looking it up here, never by writing a colour class inline —
//      otherwise "blue" drifts to mean something slightly different in each
//      screen, which is the failure mode this system exists to prevent.
//
//   2. The colours are the university's own. Grey/red/orange/blue/yellow/
//      purple/green/dark-red/black/gold, in that order. They are not chosen for
//      contrast or fashion, so they are not "improved" here. Where a colour is
//      hard to distinguish — dark red against red, black against grey — the
//      label carries the meaning and the colour supports it, never the reverse.
//      Every chip therefore renders text as well as colour, which is also what
//      makes the system usable by anyone who cannot separate red from green.
// ---------------------------------------------------------------------------

export type UniversalStatus =
  | 'draft'
  | 'awaiting-payment'
  | 'payment-under-verification'
  | 'payment-verified'
  | 'registrar-reviewing'
  | 'documents-required'
  // The Registrar has verified the record and passed it on. The applicant is
  // not admitted at this point — the Admissions Office makes that decision,
  // and until it does, nobody should describe this person as admitted.
  | 'awaiting-admissions'
  | 'approved'
  | 'conditional'
  | 'rejected'
  | 'deferred'
  | 'graduated';

export interface StatusMeta {
  key: UniversalStatus;
  label: string;
  /** The university's colour name, kept literally. */
  colour: string;
  /** Position in the normal forward path. Terminal states sit off it. */
  order: number;
  terminal: boolean;
  meaning: string;
  /** Chip classes. Text always accompanies the colour — see rule 2 above. */
  chip: string;
  /** A solid swatch, for legends and timelines. */
  dot: string;
}

export const STATUSES: Record<UniversalStatus, StatusMeta> = {
  draft: {
    key: 'draft',
    label: 'Draft',
    colour: 'Grey',
    order: 1,
    terminal: false,
    meaning: 'The application has been started but not submitted. Only the applicant can see it.',
    chip: 'bg-gray-100 text-gray-700 ring-1 ring-gray-300',
    dot: 'bg-gray-400',
  },
  'awaiting-payment': {
    key: 'awaiting-payment',
    label: 'Awaiting payment',
    colour: 'Red',
    order: 2,
    terminal: false,
    meaning: 'Submitted, but the application fee has not been paid. Nothing moves until it is.',
    chip: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    dot: 'bg-red-500',
  },
  'payment-under-verification': {
    key: 'payment-under-verification',
    label: 'Payment under verification',
    colour: 'Orange',
    order: 3,
    terminal: false,
    meaning:
      'A payment has been recorded and Finance is checking the amount, reference, currency and whether it duplicates another.',
    chip: 'bg-orange-50 text-orange-800 ring-1 ring-orange-200',
    dot: 'bg-orange-500',
  },
  'payment-verified': {
    key: 'payment-verified',
    label: 'Payment verified',
    colour: 'Blue',
    order: 4,
    terminal: false,
    meaning:
      'Finance has confirmed the payment. This is the gate: the application becomes visible to the Office of the Registrar only now.',
    chip: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    dot: 'bg-blue-500',
  },
  'registrar-reviewing': {
    key: 'registrar-reviewing',
    label: 'Registrar reviewing',
    colour: 'Yellow',
    order: 5,
    terminal: false,
    meaning:
      'The Office of the Registrar is examining qualifications, certificates, identity documents and eligibility for the programme.',
    chip: 'bg-yellow-50 text-yellow-800 ring-1 ring-yellow-300',
    dot: 'bg-yellow-400',
  },
  'documents-required': {
    key: 'documents-required',
    label: 'Additional documents required',
    colour: 'Purple',
    order: 6,
    terminal: false,
    meaning:
      'The Registrar has asked the applicant for further documents. The record stays in the Registrar’s queue so an applicant who never responds remains visible.',
    chip: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
    dot: 'bg-purple-500',
  },
  // Indigo, and deliberately not green. Green is `approved`; an applicant at
  // this stage has been cleared by the Registrar, not admitted. Only the
  // Admissions Office admits, and until it does nobody should describe this
  // person as a student.
  'awaiting-admissions': {
    key: 'awaiting-admissions',
    label: 'Awaiting Admissions Office',
    colour: 'Indigo',
    order: 7,
    terminal: false,
    meaning:
      'The Registrar has verified the record and forwarded it to the Admissions Office, which makes the final assessment and admits.',
    chip: 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200',
    dot: 'bg-indigo-500',
  },
  approved: {
    key: 'approved',
    label: 'Approved',
    colour: 'Green',
    order: 7,
    terminal: false,
    meaning:
      'Admitted. The student number is issued, the account created and the welcome email sent, all automatically.',
    chip: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    dot: 'bg-emerald-500',
  },
  conditional: {
    key: 'conditional',
    label: 'Conditionally admitted',
    colour: 'Green, hatched',
    order: 8,
    terminal: false,
    meaning:
      'Admitted and studying, with named conditions to meet by a stated date. The conditions stay visible to the student, the adviser and the Registrar until each is discharged.',
    chip: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-400 ring-dashed',
    dot: 'bg-emerald-400',
  },
  rejected: {
    key: 'rejected',
    label: 'Rejected',
    colour: 'Dark red',
    order: 90,
    terminal: true,
    meaning: 'The application was not successful. A reason is always recorded.',
    chip: 'bg-red-100 text-red-900 ring-1 ring-red-400',
    dot: 'bg-red-800',
  },
  deferred: {
    key: 'deferred',
    label: 'Deferred',
    colour: 'Black',
    order: 91,
    terminal: true,
    meaning: 'Admission has been held over to a later intake at the applicant’s or the university’s request.',
    chip: 'bg-neutral-800 text-white ring-1 ring-neutral-900',
    dot: 'bg-neutral-900',
  },
  graduated: {
    key: 'graduated',
    label: 'Graduated',
    colour: 'Gold',
    order: 99,
    terminal: true,
    meaning: 'The award has been conferred.',
    chip: 'bg-amber-100 text-amber-900 ring-1 ring-amber-400',
    dot: 'bg-amber-500',
  },
};

/** The forward path, in order, excluding terminal outcomes. */
export const statusPath: StatusMeta[] = Object.values(STATUSES)
  .filter((s) => !s.terminal)
  .sort((a, b) => a.order - b.order);

export const terminalStatuses: StatusMeta[] = Object.values(STATUSES)
  .filter((s) => s.terminal)
  .sort((a, b) => a.order - b.order);

export const allStatuses: StatusMeta[] = Object.values(STATUSES).sort((a, b) => a.order - b.order);

/**
 * Map the value stored in `students.status` to the universal system.
 *
 * The stored values predate this table and are still what the database holds,
 * so translating here is cheaper and safer than a data migration that would
 * have to be run in lockstep with a deploy. If the stored vocabulary is ever
 * changed, this is the only function that needs to know.
 */
export function toUniversal(stored: string | null | undefined): UniversalStatus {
  switch ((stored ?? '').toLowerCase()) {
    case 'draft':
      return 'draft';
    case 'applicant':
      return 'awaiting-payment';
    case 'payment_pending':
      return 'payment-under-verification';
    case 'fee_paid':
      return 'payment-verified';
    case 'under_review':
      return 'registrar-reviewing';
    case 'documents_required':
      return 'documents-required';
    case 'registrar_approved':
      return 'awaiting-admissions';
    case 'approved':
    case 'active':
      return 'approved';
    case 'conditional':
      return 'conditional';
    case 'declined':
    case 'rejected':
      return 'rejected';
    case 'deferred':
      return 'deferred';
    case 'graduated':
      return 'graduated';
    default:
      return 'awaiting-payment';
  }
}

export function statusMeta(stored: string | null | undefined): StatusMeta {
  return STATUSES[toUniversal(stored)];
}
