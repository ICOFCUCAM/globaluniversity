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
      <h1 className="font-heading text-3xl font-extrabold text-brand-purple">Credential Verification</h1>
      {state === 'checking' && <p className="mt-6 text-brand-muted">Verifying…</p>}
      {state === 'none' && (
        <p className="mt-6 text-brand-muted">
          Scan the QR code on an ICOF Global University transcript or certificate to verify it here.
        </p>
      )}
      {state === 'invalid' && (
        <div className="mt-8 rounded-xl border-2 border-red-300 bg-red-50 p-8">
          <p className="text-4xl">❌</p>
          <p className="mt-3 font-heading text-xl font-bold text-red-700">Not verified</p>
          <p className="mt-2 text-sm text-red-600">
            This document could not be verified. It may have been altered or was not issued by ICOF
            Global University. Contact registrar@iguc.net for assistance.
          </p>
        </div>
      )}
      {state === 'valid' && payload && (
        <div className="mt-8 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-8 text-left">
          <p className="text-center text-4xl">✅</p>
          <p className="mt-3 text-center font-heading text-xl font-bold text-emerald-700">
            Authentic ICOF Global University credential
          </p>
          <dl className="mt-6 space-y-2 text-sm">
            {Object.entries(payload).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-6 border-b border-emerald-200/60 pb-1.5">
                <dt className="font-semibold capitalize text-emerald-900">{k.replace(/_/g, ' ')}</dt>
                <dd className="text-emerald-800">{String(v)}</dd>
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
    <Suspense fallback={<div className="py-20 text-center text-brand-muted">Loading…</div>}>
      <VerifyInner />
    </Suspense>
  );
}
