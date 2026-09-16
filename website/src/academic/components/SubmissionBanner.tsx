'use client';

// ---------------------------------------------------------------------------
// WHERE THIS LECTURE HAS GOT TO, AND WHAT TO DO ABOUT IT.
//
// ---------------------------------------------------------------------------
// THE GAP THIS CLOSES
// ---------------------------------------------------------------------------
//
// 095 made a lecture a draft and refused every transformation until an office
// accepts it. The office got a queue. THE LECTURER GOT NOTHING — no way to
// move a draft to `submitted`, and therefore no way for the queue ever to have
// anything in it.
//
// So the stop was not a review. It was an outage that looked like one, and
// from a lecturer's chair the symptom would have been every Generate button
// refusing with a message about a step they could not reach.
//
// ---------------------------------------------------------------------------
// AND IT SAYS WHERE THINGS ARE EVEN WHEN THERE IS NOTHING TO PRESS
// ---------------------------------------------------------------------------
//
// `submitted` has no button: waiting is the correct state and a button would
// invite somebody to press it twice. But a screen that shows nothing at all
// while somebody waits is how "is this working?" becomes a telephone call — so
// it says what it is waiting for, and since when.
// ---------------------------------------------------------------------------

import React, { useState } from 'react';
import { AlertTriangle, Check, Clock, Loader2, Send, Undo2 } from 'lucide-react';

type State = 'draft' | 'submitted' | 'accepted' | 'returned';

export function SubmissionBanner({
  lectureId, state, submittedAt, reviewNote, isOwner, personal,
}: {
  lectureId: string;
  /**
   * Undefined where the store predates 095.
   *
   * TREATED AS A DRAFT, not as accepted. If the column is not there the
   * database is not enforcing the stop either, so nothing is blocked — and
   * offering Submit is a truthful thing to show, where claiming "accepted"
   * would be this screen inventing a decision nobody made.
   */
  state?: State;
  submittedAt?: string;
  reviewNote?: string;
  isOwner: boolean;
  personal: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // A PERSONAL LECTURE IS NEVER REVIEWED. 095 skips it entirely, so a banner
  // about a decision nobody will make would be noise on somebody's own
  // recording.
  if (personal) return null;

  const at = state ?? 'draft';
  if (sent) {
    return (
      <Banner tone="ok" icon={<Check size={16} />}>
        Submitted to the University. You will see it here when an office has decided.
      </Banner>
    );
  }

  if (at === 'accepted') {
    return (
      <Banner tone="ok" icon={<Check size={16} />}>
        Accepted by the University. You can run whatever transformations your account is allowed.
      </Banner>
    );
  }

  if (at === 'submitted') {
    const days = submittedAt
      ? Math.floor((Date.now() - new Date(submittedAt).getTime()) / 86_400_000) : null;
    return (
      <Banner tone="wait" icon={<Clock size={16} />}>
        With the University{days != null && days > 0 ? `, for ${days} day${days === 1 ? '' : 's'}` : ''}.
        Nothing can be transcribed, corrected or voiced until an office accepts it.
      </Banner>
    );
  }

  const submit = async () => {
    setBusy(true); setFailed(null);
    try {
      const response = await fetch('/api/studio/submissions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'submit', lectureId }),
      });
      const result = await response.json() as { ok?: boolean; detail?: string; error?: string };
      if (!response.ok || !result.ok) {
        setFailed(result.detail ?? result.error ?? 'It was not submitted.');
        return;
      }
      setSent(true);
    } catch {
      setFailed('It was not submitted — the University could not be reached.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Banner tone={at === 'returned' ? 'bad' : 'wait'}
      icon={at === 'returned' ? <Undo2 size={16} /> : <Send size={16} />}>
      <div>
        {at === 'returned' ? (
          <>
            <p className="font-medium">The University sent this back.</p>
            {/* THE NOTE, WHOLE. It is compulsory in the database precisely so
                there is something to show here; summarising it would undo
                that. */}
            {reviewNote && <p className="mt-0.5">{reviewNote}</p>}
            <p className="mt-0.5">Put it right and submit it again.</p>
          </>
        ) : (
          <p>
            This is a draft. Submit it and the University decides whether the work goes ahead —
            nothing can be transcribed, corrected or voiced until then.
          </p>
        )}

        {isOwner ? (
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="mt-2 inline-flex items-center gap-1.5 rounded border border-studio-page-line bg-white px-2.5 py-1 text-[11px] text-studio-brand hover:border-studio-brand/40 disabled:opacity-40"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {at === 'returned' ? 'Submit it again' : 'Submit to the University'}
          </button>
        ) : (
          // SOMEBODY ELSE'S LECTURE. A co-teacher reading it should know why
          // nothing is running, and should not be offered a button that would
          // refuse them: 095 makes submitting the owner's own act.
          <p className="mt-2 text-[11px] text-studio-ink-faint">
            Only the lecturer whose lecture this is can submit it.
          </p>
        )}

        {failed && (
          <p className="mt-1 flex items-start gap-1.5 text-[11px] text-studio-bad">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />{failed}
          </p>
        )}
      </div>
    </Banner>
  );
}

function Banner({ tone, icon, children }: {
  tone: 'ok' | 'wait' | 'bad';
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const skin = tone === 'ok'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
    : tone === 'bad'
      ? 'border-red-300 bg-red-50 text-studio-bad'
      : 'border-amber-300 bg-amber-50 text-amber-900';
  return (
    <div className={`mx-6 mt-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs md:mx-8 ${skin}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
