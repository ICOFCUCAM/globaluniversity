'use client';

// ---------------------------------------------------------------------------
// WHERE IS MY APPLICATION?
//
// ---------------------------------------------------------------------------
// WHY THIS PAGE EXISTS
// ---------------------------------------------------------------------------
//
// An applicant has no account, by design: accounts exist because an admission
// was issued, and self-signup was removed rather than hidden because an
// applicant who could create one would bypass both the fee gate and the
// verification. The consequence is that the one person most anxious to know
// where their application has got to is the one person who cannot sign in and
// look.
//
// The six stages have been written down since migration 024, in the
// applicant's own words, and nothing showed them. The alternative to this page
// is what happens today: they telephone the Registrar.
//
// ---------------------------------------------------------------------------
// WHAT IT SHOWS, AND WHAT IT DOES NOT
// ---------------------------------------------------------------------------
//
// Their stage, and nothing else. No internal state, no reason, no decision
// that has not been sent to them, nobody's name. An issuance that stopped part
// way reads as "Admission letter available" like the states either side of it,
// because the academic decision in their favour is not in doubt and an
// internal step needing another attempt is the University's problem to solve,
// not news to break to them while it is being solved.
// ---------------------------------------------------------------------------

import React, { useState } from 'react';
import { UNIVERSITY } from '@/lib/constants';

interface Stage { key: string; label: string }
interface Result {
  firstName: string | null;
  programme: string | null;
  intake: string | null;
  submitted: string | null;
  stage: Stage | null;
  stageIndex: number;
  stages: Stage[];
}

export default function ApplicationStatusPage() {
  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch('/api/apply/status', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ applicationNumber: reference.trim(), email: email.trim() }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(false);
    if (!json?.ok) {
      setError(json?.detail ?? 'We could not check that just now. Please try again shortly.');
      return;
    }
    setResult(json as Result);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="font-heading text-3xl font-bold text-[#422e59]">Your application</h1>
      <p className="mt-2 text-sm leading-relaxed text-[#6b6076]">
        Enter the reference from the acknowledgement we sent you, and the email address you
        applied with.
      </p>

      <form onSubmit={check} className="mt-6 space-y-4">
        <div>
          <label htmlFor="reference" className="block text-sm font-semibold text-[#422e59]">
            Application reference
          </label>
          <input
            id="reference"
            value={reference}
            onChange={(ev) => setReference(ev.target.value)}
            placeholder="APP-2026-XXXXX"
            className="mt-1 w-full rounded-xl border border-[#ded6c8] px-4 py-2.5 text-sm"
            required
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-[#422e59]">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            className="mt-1 w-full rounded-xl border border-[#ded6c8] px-4 py-2.5 text-sm"
            required
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-[#422e59] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Checking…' : 'Check my application'}
        </button>
      </form>

      {error && (
        <p className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </p>
      )}

      {result && (
        <section className="mt-8 rounded-2xl border border-[#ded6c8] p-6">
          <p className="text-sm text-[#6b6076]">
            {result.firstName ? `${result.firstName}, your` : 'Your'} application
            {result.programme ? <> for <strong>{result.programme}</strong></> : null}
            {result.intake ? <> ({result.intake} intake)</> : null} has reached:
          </p>

          {/* THE SIX STAGES, in the applicant's own words. Drawn in full rather
              than showing only the current one, so they can see what is still
              to come and stop wondering. */}
          <ol className="mt-4 space-y-2">
            {result.stages.map((s, i) => {
              const done = result.stageIndex >= 0 && i < result.stageIndex;
              const here = i === result.stageIndex;
              return (
                <li key={s.key} className="flex items-start gap-3 text-sm">
                  <span
                    aria-hidden
                    className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                      here ? 'bg-[#422e59]' : done ? 'bg-emerald-500' : 'bg-[#ded6c8]'
                    }`}
                  />
                  <span className={here ? 'font-semibold text-[#422e59]' : done ? 'text-[#6b6076]' : 'text-[#a49bb0]'}>
                    {s.label}
                    {here && <span className="ml-2 text-xs font-normal text-[#8a8194]">— where you are now</span>}
                  </span>
                </li>
              );
            })}
          </ol>

          {result.stageIndex < 0 && (
            <p className="mt-4 text-sm text-[#6b6076]">
              We have your application and are working through it. Please contact us if you have
              not heard from us within the usual admissions period.
            </p>
          )}

          <p className="mt-6 border-t border-[#f0ece4] pt-4 text-xs leading-relaxed text-[#8a8194]">
            Questions about your application go to{' '}
            <a href={`mailto:${UNIVERSITY.admissionsEmail}`} className="underline">
              {UNIVERSITY.admissionsEmail}
            </a>
            . Please quote your reference.
          </p>
        </section>
      )}
    </main>
  );
}
