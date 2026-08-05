'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function VerifyInner() {
  const params = useSearchParams();
  const [state, setState] = useState<'checking' | 'valid' | 'invalid' | 'none'>('checking');
  const [payload, setPayload] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    const d = params.get('d');
    const s = params.get('s');
    if (!d || !s) {
      setState('none');
      return;
    }
    fetch(`/api/credential?d=${encodeURIComponent(d)}&s=${encodeURIComponent(s)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.valid) {
          setPayload(res.payload);
          setState('valid');
        } else setState('invalid');
      })
      .catch(() => setState('invalid'));
  }, [params]);

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
        <p className="mx-auto mt-8 max-w-md leading-relaxed text-brand-muted">
          Scan the QR code on an ICOF Global University transcript or certificate to verify it here.
        </p>
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
          <p className="mt-4 text-center font-heading text-xl font-bold text-emerald-700 [text-wrap:balance]">
            Authentic ICOF Global University credential
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
