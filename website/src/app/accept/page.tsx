'use client';

// ---------------------------------------------------------------------------
// THE APPOINTEE ANSWERS.
//
//   /accept?reference=APT-2026-0042&code=ICOF-XXXX-XXXX-XXXX
//
// ---------------------------------------------------------------------------
// WHY THIS PAGE IS OUTSIDE THE PORTAL
// ---------------------------------------------------------------------------
//
// The person using it has no account here, and under the University's own rule
// they cannot have one yet: `staff_activation_point` is set to `accepted`, so
// they become staff — and get a login — only AFTER they have answered. A page
// behind the portal would have asked them to sign in to an account that their
// signing in was the precondition for.
//
// That was a deadlock in the live system, not a missing nicety. The rule was
// set, the API was built and tested, and there was no page: nobody at the
// University could ever have become staff through it.
//
// ---------------------------------------------------------------------------
// WHAT PROVES IT IS THEM
// ---------------------------------------------------------------------------
//
// The verification code printed on their letter, checked by the API against an
// HMAC recomputed from the appointment's own particulars. It is exactly as
// strong as a signature on a paper letter and no stronger — anybody holding the
// paper could sign it — and the record says the answer came this way.
//
// ---------------------------------------------------------------------------
// AND WHAT IT DELIBERATELY DOES NOT SHOW
// ---------------------------------------------------------------------------
//
// The salary. It is on the letter in their hand, and this page is reached by a
// link that may sit in an inbox, be forwarded, or be opened on a shared
// machine. The API does not return it, so the page cannot show it by mistake.
// ---------------------------------------------------------------------------

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface Offer {
  ok?: boolean;
  reference?: string;
  printed?: string;
  version?: number;
  name?: string;
  position?: string;
  unit?: string | null;
  faculty?: string | null;
  startDate?: string | null;
  alreadyAnswered?: { decision?: string; at?: string; version?: number };
  error?: string;
  detail?: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** The same spelling the letter uses. `toLocaleDateString` differs by build. */
function longDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** What each refusal means, in the appointee's terms rather than the API's. */
const REFUSALS: Record<string, string> = {
  'not-a-reference': 'That does not look like a University document reference. It reads like '
    + 'APT-2026-0042 and is printed at the head of your letter.',
  'no-such-letter': 'No letter with that reference is on the University’s register. Check '
    + 'the reference against your letter, or write to the University.',
  'wrong-code': 'The verification code does not match that reference. The code is printed at '
    + 'the foot of your letter, beside the QR square, and reads like ICOF-0000-0000-0000.',
  superseded: 'This letter has been replaced by a later version. The University has sent you '
    + 'the current one — please answer that instead. Answering this one would record you '
    + 'as agreeing to terms that no longer stand.',
  'not-issued': 'This appointment has not been issued yet, so there is nothing to answer.',
  'no-such-appointment': 'The University’s record for this letter could not be found. '
    + 'Please write to the University.',
};

function AcceptInner() {
  const params = useSearchParams();

  const [reference, setReference] = useState('');
  const [code, setCode] = useState('');
  const [offer, setOffer] = useState<Offer | null>(null);
  const [looking, setLooking] = useState(false);
  const [name, setName] = useState('');
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [answered, setAnswered] = useState<{ decision: string; detail?: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const look = useCallback(async (ref: string, c: string) => {
    if (!ref.trim() || !c.trim()) return;
    setLooking(true);
    setProblem(null);
    try {
      const r = await fetch(
        `/api/appointments/accept?reference=${encodeURIComponent(ref.trim())}`
        + `&code=${encodeURIComponent(c.trim())}`,
      );
      const j = (await r.json()) as Offer;
      if (!j.ok) {
        setOffer(null);
        setProblem(REFUSALS[j.error ?? ''] ?? j.detail
          ?? 'The University’s register could not be reached. Try again shortly.');
        return;
      }
      setOffer(j);
      setName(j.name ?? '');
    } catch {
      setProblem('The University’s register could not be reached. Try again shortly.');
    } finally {
      setLooking(false);
    }
  }, []);

  // THE LINK DOES THE WORK. An appointee who clicks the link in their email
  // should see the offer, not a form asking them to retype what is already in
  // the URL. The boxes are the fallback for somebody holding paper.
  useEffect(() => {
    const ref = params.get('reference') ?? '';
    const c = params.get('code') ?? '';
    if (ref) setReference(ref.toUpperCase());
    if (c) setCode(c.toUpperCase());
    if (ref && c) void look(ref, c);
  }, [params, look]);

  const answer = async (decision: 'accepted' | 'declined') => {
    setBusy(true);
    setProblem(null);
    try {
      const r = await fetch('/api/appointments/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: reference.trim(),
          code: code.trim(),
          decision,
          name: name.trim(),
          ...(decision === 'declined' ? { reason: reason.trim() } : {}),
        }),
      });
      const j = await r.json();
      if (!j.ok) {
        setProblem(REFUSALS[j.error ?? ''] ?? j.detail ?? 'That was not accepted.');
        return;
      }
      setAnswered({
        decision: String(j.decision ?? (j.alreadyAnswered ? 'already' : decision)),
        detail: j.detail,
      });
    } catch {
      setProblem('The University could not be reached. Nothing has been recorded — try '
        + 'again shortly.');
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full rounded-lg border border-brand-sand px-3 py-2.5 text-sm '
    + 'text-brand-purple focus:border-brand-gold focus:outline-none';

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <p className="mb-5 inline-flex items-center gap-2.5 rounded-full border border-brand-gold-deep/30 bg-brand-cream px-4 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-gold-ink">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-gold-deep" />
        Appointment
      </p>
      <h1 className="font-heading text-display font-bold text-brand-purple [text-wrap:balance]">
        Accept your appointment
      </h1>
      <div className="mt-5 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />

      {/* ------------------------------------------------------------------
          ANSWERED — the end of the road, in either direction
          ------------------------------------------------------------------ */}
      {answered ? (
        <div
          className={`mt-8 rounded-2xl border p-5 ${
            answered.decision === 'declined'
              ? 'border-brand-sand bg-brand-cream'
              : 'border-emerald-300 bg-emerald-50'}`}
        >
          <p className="font-heading text-lg font-semibold text-brand-purple">
            {answered.decision === 'declined'
              ? 'Your decision has been recorded'
              : answered.decision === 'already'
                ? 'You have already answered this'
                : 'Your acceptance has been recorded'}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-brand-ink">{answered.detail}</p>
          <p className="mt-3 text-xs leading-relaxed text-brand-muted">
            Keep your letter. It carries the reference and the verification code, and either can
            be checked at any time.
          </p>
        </div>
      ) : (
        <>
          {/* --------------------------------------------------------------
              THE OFFER, READ BACK TO THEM
              -------------------------------------------------------------- */}
          {offer && (
            <div className="mt-8 rounded-2xl border border-brand-sand bg-white p-5 text-left">
              <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold-ink">
                What you are being asked to accept
              </p>
              <dl className="mt-3 space-y-2 text-sm">
                {([
                  ['Name', offer.name],
                  ['Position', offer.position],
                  ['Faculty or department', offer.faculty || offer.unit],
                  ['Commencing', longDate(offer.startDate)],
                  ['Reference', offer.printed],
                  ['Letter version', offer.version ? String(offer.version) : null],
                ] as [string, string | null | undefined][])
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="flex flex-wrap justify-between gap-2">
                      <dt className="text-brand-muted">{k}</dt>
                      <dd className="font-medium text-brand-ink">{v}</dd>
                    </div>
                  ))}
              </dl>
              {/* THE SALARY IS NOT HERE ON PURPOSE, and saying so is better
                  than leaving them wondering whether it was forgotten. */}
              <p className="mt-3 border-t border-brand-sand pt-2 text-xs leading-relaxed text-brand-muted">
                The remuneration and the full terms are on the letter itself. They are not shown
                on this page, which is reached by a link that may sit in an inbox.
              </p>

              {offer.alreadyAnswered && (
                <p className="mt-3 rounded-lg bg-brand-cream px-3 py-2 text-sm text-brand-ink">
                  You have already {offer.alreadyAnswered.decision === 'accepted'
                    ? 'accepted' : 'declined'} this appointment. Contact the University if that
                  was not what you intended.
                </p>
              )}
            </div>
          )}

          {/* --------------------------------------------------------------
              THE REFERENCE AND CODE — the fallback for paper
              -------------------------------------------------------------- */}
          {!offer && (
            <form
              onSubmit={(e) => { e.preventDefault(); void look(reference, code); }}
              className="mt-8 space-y-3 rounded-2xl border border-brand-sand bg-white p-5 text-left"
            >
              <p className="text-sm leading-relaxed text-brand-muted">
                Enter the reference and the verification code printed on your letter of
                appointment. The reference is at the head of the letter; the code is at the foot,
                beside the QR square.
              </p>
              <div>
                <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-brand-gold-ink" htmlFor="ref">
                  Reference
                </label>
                <input
                  id="ref" className={`${field} mt-1 font-mono uppercase`} value={reference}
                  placeholder="APT-2026-0042" autoComplete="off" spellCheck={false}
                  onChange={(e) => setReference(e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-brand-gold-ink" htmlFor="code">
                  Verification code
                </label>
                <input
                  id="code" className={`${field} mt-1 font-mono uppercase`} value={code}
                  placeholder="ICOF-0000-0000-0000" autoComplete="off" spellCheck={false}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </div>
              <button
                type="submit"
                disabled={looking || !reference.trim() || !code.trim()}
                className="rounded-lg bg-brand-purple px-6 py-2.5 font-heading text-sm font-semibold text-white transition hover:bg-brand-purple-dark disabled:opacity-40"
              >
                {looking ? 'Checking…' : 'Find my appointment'}
              </button>
            </form>
          )}

          {problem && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-left text-sm leading-relaxed text-amber-900">
              {problem}
            </div>
          )}

          {/* --------------------------------------------------------------
              THE ANSWER
              -------------------------------------------------------------- */}
          {offer && !offer.alreadyAnswered && (
            <div className="mt-5 rounded-2xl border border-brand-sand bg-white p-5 text-left">
              <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-brand-gold-ink" htmlFor="name">
                Your full name
              </label>
              <input
                id="name" className={`${field} mt-1`} value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-brand-muted">
                Typing your name is your signature on this answer. It is recorded with the date,
                the time, and the version of the letter you are answering.
              </p>

              {declining && (
                <div className="mt-4">
                  <label className="block font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-brand-gold-ink" htmlFor="why">
                    Why are you declining?
                  </label>
                  <textarea
                    id="why" className={`${field} mt-1 min-h-[90px]`} value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <p className="mt-1.5 text-xs text-brand-muted">
                    The University needs to know whether to re-advertise the post or to correct
                    something in the offer.
                  </p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {!declining && (
                  <button
                    type="button"
                    disabled={busy || name.trim().length < 3}
                    className="rounded-lg bg-brand-purple px-6 py-2.5 font-heading text-sm font-semibold text-white transition hover:bg-brand-purple-dark disabled:opacity-40"
                    onClick={() => void answer('accepted')}
                  >
                    {busy ? 'Recording…' : 'Accept this appointment'}
                  </button>
                )}
                {declining ? (
                  <>
                    <button
                      type="button"
                      disabled={busy || name.trim().length < 3 || reason.trim().length < 10}
                      className="rounded-lg border border-brand-sand px-6 py-2.5 font-heading text-sm font-semibold text-brand-purple transition hover:bg-brand-cream disabled:opacity-40"
                      onClick={() => void answer('declined')}
                    >
                      {busy ? 'Recording…' : 'Confirm decline'}
                    </button>
                    <button
                      type="button"
                      className="px-3 py-2.5 text-sm text-brand-muted underline"
                      onClick={() => { setDeclining(false); setReason(''); }}
                    >
                      Back
                    </button>
                  </>
                ) : (
                  // DECLINING IS NOT HIDDEN, and it is not the same weight as
                  // accepting. A page that offers only "accept" is a page that
                  // has decided for them.
                  <button
                    type="button"
                    className="px-3 py-2.5 text-sm text-brand-muted underline"
                    onClick={() => setDeclining(true)}
                  >
                    I need to decline
                  </button>
                )}
              </div>
            </div>
          )}

          <p className="mt-6 text-xs leading-relaxed text-brand-muted">
            Accepting records your agreement against this version of the letter. Being appointed
            and being on the staff register are separate steps: Human Resources opens your staff
            record after you have accepted.
          </p>
        </>
      )}
    </div>
  );
}

export default function AcceptPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center gap-3 py-20 text-center text-brand-muted">
      <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-brand-sand border-t-brand-gold-deep" />
      Loading&hellip;
    </div>}>
      <AcceptInner />
    </Suspense>
  );
}
