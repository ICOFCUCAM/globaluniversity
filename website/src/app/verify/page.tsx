'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function VerifyInner() {
  const params = useSearchParams();
  const [state, setState] = useState<'checking' | 'valid' | 'invalid' | 'none' | 'unconfigured'>('checking');
  const [payload, setPayload] = useState<Record<string, string> | null>(null);
  const [number, setNumber] = useState('');
  const [looking, setLooking] = useState(false);
  const [byNumber, setByNumber] = useState<{
    found?: boolean;
    note?: string;
    credential?: {
      holderName?: string; award?: string; classification?: string | null;
      programme?: string | null; issuedOn?: string | null; status?: string;
    };
  } | null>(null);
  const [register, setRegister] = useState<{
    status: string; note: string; issuedOn?: string | null;
    revokedOn?: string | null; revocationReason?: string | null;
    templateVersion?: number | null; hashMatches?: boolean;
  } | null>(null);

  const lookUpNumber = useCallback(async (raw: string) => {
    const id = raw.trim();
    if (!id) return;
    setLooking(true);
    setByNumber(null);
    const res = await fetch(`/api/credential?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .catch(() => null);
    setByNumber(
      res?.ok
        ? res
        : { found: false, note: res?.note ?? 'The register could not be reached. Try again shortly.' },
    );
    setLooking(false);
  }, []);

  useEffect(() => {
    const d = params.get('d');
    const s = params.get('s');
    // A share link from a graduate's credential wallet carries the number, not
    // a signed payload — it is a link they may paste into an email to an
    // employer, and it has to work when it is opened rather than require the
    // recipient to retype anything.
    const id = params.get('id');
    if (!d || !s) {
      setState('none');
      if (id) {
        setNumber(id.toUpperCase());
        void lookUpNumber(id);
      }
      return;
    }
    fetch(`/api/credential?d=${encodeURIComponent(d)}&s=${encodeURIComponent(s)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.signed ?? res.valid) {
          setPayload(res.payload);
          setRegister(res.register ?? null);
          setState('valid');
        } else if (res.error === 'credential-secret-not-set') setState('unconfigured');
        else setState('invalid');
      })
      .catch(() => setState('invalid'));
  }, [params, lookUpNumber]);


  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="mb-5 inline-flex items-center gap-2.5 rounded-full border border-brand-gold-deep/30 bg-brand-cream px-4 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-gold-deep">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-gold-deep" />
        Official verification
      </p>
      <h1 className="font-heading text-display font-bold text-brand-purple [text-wrap:balance]">
        Credential Verification
      </h1>
      <div className="mx-auto mt-5 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />

      {state === 'checking' && (
        <p className="mt-8 flex items-center justify-center gap-3 text-brand-muted">
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-brand-sand border-t-brand-gold-deep"
          />
          Verifying…
        </p>
      )}
      {state === 'none' && (
        <div className="mx-auto mt-8 max-w-md text-left">
          <p className="text-center leading-relaxed text-brand-muted">
            Scan the QR code on an ICOF Global University certificate, transcript or admission
            letter — or enter the credential number printed on it.
          </p>
          {/* An employer holding a printed certificate has a NUMBER, not a QR
              payload. Every certificate tells them to verify here, so there has
              to be somewhere to type it; without this the instruction printed on
              the document could not be followed. */}
          <form
            onSubmit={(e) => { e.preventDefault(); void lookUpNumber(number); }}
            className="mt-7 rounded-2xl border border-brand-sand bg-white p-5"
          >
            <label htmlFor="credential-number" className="block font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-brand-gold-deep">
              Credential number
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                id="credential-number"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="IGUC-BTH-26A9-F8K2-P19D"
                autoComplete="off"
                spellCheck={false}
                className="min-w-[200px] flex-1 rounded-lg border border-brand-sand px-3 py-2.5 font-mono text-sm uppercase tracking-wide text-brand-purple focus:border-brand-gold focus:outline-none"
              />
              <button
                type="submit"
                disabled={!number.trim() || looking}
                className="rounded-lg bg-brand-purple px-6 py-2.5 font-heading text-sm font-semibold text-white transition hover:bg-brand-purple-dark disabled:opacity-40"
              >
                {looking ? 'Checking…' : 'Verify'}
              </button>
            </div>
            <p className="mt-2.5 text-xs leading-relaxed text-brand-muted">
              This confirms whether the university issued a credential with that number, and what it
              says. Compare it against the document in front of you. It does not disclose anything
              else from the holder&apos;s record.
            </p>

            {byNumber && (
              <div className={`mt-5 rounded-xl border p-4 ${
                !byNumber.found
                  ? 'border-red-300 bg-red-50'
                  : byNumber.credential?.status === 'revoked'
                    ? 'border-red-300 bg-red-50'
                    : 'border-emerald-300 bg-emerald-50'
              }`}>
                <p className={`font-sans text-[11px] font-bold uppercase tracking-[0.14em] ${
                  !byNumber.found || byNumber.credential?.status === 'revoked' ? 'text-red-700' : 'text-emerald-700'
                }`}>
                  {!byNumber.found
                    ? 'Not issued'
                    : byNumber.credential?.status === 'revoked'
                      ? 'Revoked'
                      : byNumber.credential?.status === 'replaced' ? 'Superseded' : 'Verified'}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-[#2f2838]">{byNumber.note}</p>
                {byNumber.found && byNumber.credential && (
                  <dl className="mt-3 space-y-1.5 text-[13px]">
                    {([
                      ['Holder', byNumber.credential.holderName],
                      ['Award', byNumber.credential.award],
                      ['Classification', byNumber.credential.classification],
                      ['Programme', byNumber.credential.programme],
                      ['Issued', byNumber.credential.issuedOn
                        ? new Date(byNumber.credential.issuedOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                        : null],
                    ] as [string, string | null | undefined][])
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-6 border-b border-black/5 pb-1.5">
                          <dt className="text-brand-muted">{k}</dt>
                          <dd className="text-right font-semibold text-[#2f2838]">{v}</dd>
                        </div>
                      ))}
                  </dl>
                )}
              </div>
            )}
          </form>
        </div>
      )}
      {state === 'unconfigured' && (
        <div className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 p-8 text-left">
          <p className="font-heading text-lg font-bold text-amber-900">
            Verification is not available
          </p>
          <p className="mt-2 text-sm leading-relaxed text-amber-900/90">
            This university has not finished configuring credential verification, so this document
            can be neither confirmed nor rejected here. That is not a finding about the document.
            Contact the Office of the Registrar at{' '}
            <a href="mailto:registrar@iguc.net" className="underline">registrar@iguc.net</a> to
            verify it directly.
          </p>
        </div>
      )}

      {state === 'invalid' && (
        <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-8 shadow-lift">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </span>
          <p className="mt-4 font-heading text-xl font-bold text-red-700">Not verified</p>
          <p className="mt-2 text-sm text-red-600">
            This document could not be verified. It may have been altered or was not issued by ICOF
            Global University. Contact registrar@iguc.net for assistance.
          </p>
        </div>
      )}
      {state === 'valid' && payload && (
        <div className="mt-10 overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-left shadow-lift">
          {/* Seal: a conic ring around a drawn check, echoing the crest */}
          <span className="relative mx-auto flex h-16 w-16 items-center justify-center">
            <span
              aria-hidden="true"
              className="absolute inset-0 animate-crest rounded-full"
              style={{
                background:
                  'conic-gradient(from 0deg, transparent 0deg, rgba(16,185,129,0.9) 80deg, rgba(16,185,129,0.25) 150deg, transparent 230deg)',
                WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))',
                mask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))',
              }}
            />
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12.5 4.5 4.5L19 7" />
              </svg>
            </span>
          </span>
          {/* Two checks, reported separately, because they can disagree and the
              disagreement is the interesting part. The signature says the
              university's key was applied. The register says it was issued and
              still stands. Only when both hold does this page say the credential
              is current — and it never says more than the checks establish. */}
          <p className="mt-4 text-center font-heading text-xl font-bold text-emerald-700 [text-wrap:balance]">
            {register?.status === 'issued' && register.hashMatches !== false
              ? 'Issued by ICOF Global University'
              : 'Sealed by ICOF Global University'}
          </p>
          <p className="mt-1.5 text-center font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-600/80">
            Signature verified
          </p>
          <dl className="mt-7 space-y-2.5 text-sm">
            {Object.entries(payload).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-6 border-b border-emerald-200/60 pb-2">
                <dt className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] capitalize text-emerald-900/70">{k.replace(/_/g, ' ')}</dt>
                <dd className="text-right font-medium text-emerald-900">{String(v)}</dd>
              </div>
            ))}
          </dl>
          {register && (
            <div className={`mt-6 rounded-xl border p-4 ${
              register.status === 'revoked' || register.hashMatches === false
                ? 'border-red-300 bg-red-50'
                : register.status === 'issued'
                  ? 'border-emerald-300 bg-white'
                  : 'border-amber-300 bg-amber-50'
            }`}>
              <p className={`font-sans text-[10px] font-bold uppercase tracking-[0.16em] ${
                register.status === 'revoked' || register.hashMatches === false
                  ? 'text-red-700'
                  : register.status === 'issued' ? 'text-emerald-700' : 'text-amber-700'
              }`}>
                {register.status === 'revoked'
                  ? 'Revoked'
                  : register.status === 'replaced'
                    ? 'Superseded'
                    : register.status === 'issued'
                      ? (register.hashMatches === false ? 'Altered' : 'On the register')
                      : register.status === 'unavailable' ? 'Register unavailable' : 'Not registered'}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-[#2f2838]">{register.note}</p>
              <dl className="mt-3 space-y-1 text-[12px] text-[#6b6076]">
                {register.issuedOn && (
                  <div className="flex justify-between gap-6">
                    <dt>Issued</dt>
                    <dd className="font-medium text-[#2f2838]">
                      {new Date(register.issuedOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </dd>
                  </div>
                )}
                {register.revokedOn && (
                  <div className="flex justify-between gap-6">
                    <dt>Revoked</dt>
                    <dd className="font-medium text-red-700">
                      {new Date(register.revokedOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </dd>
                  </div>
                )}
                {register.revocationReason && (
                  <div className="flex justify-between gap-6">
                    <dt>Reason</dt>
                    <dd className="text-right font-medium text-red-700">{register.revocationReason}</dd>
                  </div>
                )}
                {register.templateVersion != null && (
                  <div className="flex justify-between gap-6">
                    <dt>Issued under design</dt>
                    <dd className="font-medium text-[#2f2838]">v{register.templateVersion}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
          <p className="mt-5 text-[11px] leading-relaxed text-emerald-900/70">
            Questions about a credential shown here go to{' '}
            <a href="mailto:registrar@iguc.net" className="underline">registrar@iguc.net</a>, quoting
            the credential number.
          </p>
        </div>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center gap-3 py-20 text-center text-brand-muted">
        <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-brand-sand border-t-brand-gold-deep" />
        Loading…
      </div>}>
      <VerifyInner />
    </Suspense>
  );
}
