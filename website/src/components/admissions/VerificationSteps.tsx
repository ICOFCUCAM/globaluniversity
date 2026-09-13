'use client';

// ---------------------------------------------------------------------------
// THE CONTROLS FOR THE THREE STATES NOTHING COULD WRITE.
//
// ---------------------------------------------------------------------------
// WHY THIS IS ONE COMPONENT AND NOT THREE BUTTONS ON TWO SCREENS
// ---------------------------------------------------------------------------
//
// `under_review`, `fee_pending` and `documents_verified` were declared, seeded
// and unreachable. Building a doorway into each is easy; building three
// doorways that agree about which one is open from where is the part that goes
// wrong, and it goes wrong quietly — a button offered from a state the server
// refuses is a button that looks like a broken system rather than a rule.
//
// So the buttons are DERIVED from VERIFICATION_STEPS, the same registry the
// route checks against. A step that cannot be taken from this record's state is
// not drawn, because the function that decides is the function the server uses.
// Adding a step to the registry makes it appear here; it cannot appear here and
// be refused there.
//
// THE SERVER STILL CHECKS. This draws no button the caller may not press, and
// that is courtesy, not security — /api/admissions/verification reads the role
// out of the database and the capability off the step.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  verificationStepsFrom,
  MIN_VERIFICATION_NOTE,
  type AdmissionDeskKey,
} from '@/lib/admissionWorkflow';

export interface VerificationTarget {
  id: string;
  status: string | null;
}

export default function VerificationSteps({
  application,
  desk,
  onDone,
}: {
  application: VerificationTarget;
  /** Draw only the steps belonging to this desk. Omit for all of them. */
  desk?: AdmissionDeskKey;
  onDone: (message: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const steps = verificationStepsFrom(application.status, desk);
  if (steps.length === 0) return null;

  async function take(key: string, label: string) {
    setBusy(key);
    setError(null);
    const { data: sess } = await supabase.auth.getSession();
    const res = await fetch('/api/admissions/verification', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${sess.session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ applicationId: application.id, step: key, note: note.trim() }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(null);

    if (!json?.ok) {
      // THE SERVER'S OWN WORDS. It explains why a step is unavailable from a
      // state far better than this component could guess, and a message that
      // says "something went wrong" teaches a registrar nothing.
      setError(json?.detail ?? json?.error ?? 'Nothing was recorded.');
      return;
    }
    setNoteFor(null);
    setNote('');
    onDone(`${label} — recorded.`);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {steps.map((s) => (
          <button
            key={s.key}
            type="button"
            disabled={busy !== null}
            onClick={() => (s.needsNote && noteFor !== s.key
              ? (setNoteFor(s.key), setError(null))
              : void take(s.key, s.label))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#d9cfe4] px-3 py-1.5
                       text-xs font-medium text-[#422e59] transition hover:bg-[#f5f0fa]
                       disabled:opacity-50 dark:border-[#3d3349] dark:text-[#c9b6e6]
                       dark:hover:bg-[#2a2333]"
          >
            {busy === s.key
              ? <Loader2 size={13} className="animate-spin" />
              : <Check size={13} />}
            {s.label}
          </button>
        ))}
      </div>

      {noteFor && (
        <div className="space-y-1.5">
          <label htmlFor="verification-note" className="block text-xs text-[#6b6076]">
            What was checked? This is the record somebody stands behind if the admission is
            ever questioned.
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="verification-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Certified secondary certificate and passport seen"
              className="min-w-[240px] flex-1 rounded-lg border border-[#d9cfe4] px-3 py-1.5 text-xs
                         dark:border-[#3d3349] dark:bg-[#1c1823]"
            />
            <button
              type="button"
              disabled={note.trim().length < MIN_VERIFICATION_NOTE || busy !== null}
              onClick={() => {
                const s = steps.find((x) => x.key === noteFor);
                if (s) void take(s.key, s.label);
              }}
              className="rounded-lg bg-[#422e59] px-3 py-1.5 text-xs font-medium text-white
                         disabled:opacity-40"
            >
              Record
            </button>
            <button
              type="button"
              onClick={() => { setNoteFor(null); setNote(''); }}
              className="px-2 py-1.5 text-xs text-[#6b6076] hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
