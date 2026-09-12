'use client';

// ---------------------------------------------------------------------------
// DELETE AN APPLICATION — the Superadministrator's panel.
//
// ---------------------------------------------------------------------------
// WHY THIS IS ITS OWN COMPONENT
// ---------------------------------------------------------------------------
//
// It was written inline in AdmissionsDesk, next to Reject, and could not be
// verified by looking at it: the surrounding pane only renders once an
// application is selected, and on a database with an empty queue there is
// nothing to select. So the one control on the screen that destroys a record
// was the one control nobody could see before shipping.
//
// Pulled out here it takes props and nothing else, which means a test can
// render it directly and assert what it draws — for a Superadministrator, and
// for everybody else. See deleteApplication.test.mjs.
//
// ---------------------------------------------------------------------------
// WHY TWO FIELDS
// ---------------------------------------------------------------------------
//
// A reason alone is what every destructive form asks for, and it gets typed on
// the way to the button rather than instead of thinking. Typing the applicant's
// own reference makes the operator name the person they are erasing — which
// catches the failure this actually produces, which is not malice but the wrong
// row selected.
// ---------------------------------------------------------------------------

import React from 'react';
import { Trash2 } from 'lucide-react';

export interface DeleteApplicationPanelProps {
  /** Whether the caller holds 'delete-application'. */
  allowed: boolean;
  /** The application's own reference, which must be typed to confirm. */
  matricNo: string;
  reason: string;
  onReasonChange: (value: string) => void;
  confirmation: string;
  onConfirmationChange: (value: string) => void;
  onDelete: () => void;
  busy?: boolean;
}

/** The shortest reason worth recording. See the route, which enforces the same. */
export const MIN_REASON = 12;

export default function DeleteApplicationPanel({
  allowed, matricNo, reason, onReasonChange,
  confirmation, onConfirmationChange, onDelete, busy,
}: DeleteApplicationPanelProps) {
  // NOTHING IS DRAWN FOR ANYBODY ELSE — not a disabled button, not an
  // explanation of a power they do not have. Returning null rather than
  // rendering-and-disabling also means the markup carries no trace of the
  // control for a role that may not use it.
  if (!allowed) return null;

  const reasonShort = reason.trim().length < MIN_REASON;
  const misconfirmed = confirmation.trim() !== matricNo;
  const blocked = reasonShort || misconfirmed;

  return (
    <div className="rounded-xl border border-red-300 bg-red-50/60 p-5 dark:border-red-900/50 dark:bg-red-950/20">
      <h3 className="flex items-center gap-2 font-bold text-red-800 dark:text-red-300">
        <Trash2 size={18} /> Delete this application
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-red-800/80 dark:text-red-300/80">
        Held by the Superadministrator alone. This destroys the record that the application was
        ever made — what Finance saw, what the Registrar verified, and why it was decided as it
        was. <strong>To refuse an applicant, use Reject:</strong> that is a decision, it is
        recorded, and it leaves them a route to reapply.
      </p>

      <label className="mt-3 block">
        <span className="text-[10px] font-bold uppercase tracking-wide text-red-800/80 dark:text-red-300/80">
          Reason * — recorded in the audit trail, permanently
        </span>
        <textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          rows={2}
          aria-label="Reason for deleting this application"
          className="mt-1 w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none dark:bg-[#1c1722]"
        />
      </label>

      <label className="mt-3 block">
        <span className="text-[10px] font-bold uppercase tracking-wide text-red-800/80 dark:text-red-300/80">
          Type {matricNo} to confirm
        </span>
        <input
          value={confirmation}
          onChange={(e) => onConfirmationChange(e.target.value)}
          aria-label="Type the application reference to confirm"
          className="mt-1 w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none dark:bg-[#1c1722]"
        />
      </label>

      <button
        onClick={onDelete}
        disabled={busy || blocked}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-40"
      >
        <Trash2 size={15} /> Delete permanently
      </button>

      {/* SAYS WHAT IS MISSING. A disabled button with no explanation is the
          commonest way a two-field confirmation becomes a support ticket. */}
      {blocked && (
        <p className="mt-2 text-[11px] text-red-800/70 dark:text-red-300/70">
          {reasonShort
            ? 'Give a reason of at least a dozen characters.'
            : `Type ${matricNo} exactly to confirm.`}
        </p>
      )}
    </div>
  );
}
