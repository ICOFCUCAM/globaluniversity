'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';

/**
 * The signed verification QR printed on a transcript.
 *
 * Signing is no longer an open endpoint — see api/credential/route.ts, where a
 * public POST let anyone have the university sign a degree of their choosing.
 * The caller must now present its own session, and only the office holding
 * 'design-credentials' is signed for.
 *
 * When signing is refused, the QR is omitted and the reason printed instead. A
 * transcript with no QR is an unverifiable document; a transcript with a QR
 * that fails to verify is a document that looks forged. The first is much the
 * better failure, and saying why stops a registrar reprinting it five times.
 */
export default function TranscriptQR({ student }: { student: any }) {
  const [url, setUrl] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const payload = {
      document: 'Academic Transcript',
      name: `${student.last_name} ${student.first_name} ${student.middle_name ?? ''}`.trim(),
      matric_number: student.matric_no,
      programme: `${student.degree_type ?? ''} ${student.program ?? ''}`.trim(),
      admission_year: String(student.admission_year ?? ''),
      issued: new Date().toISOString().slice(0, 10),
    };
    const data = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setProblem('Sign in to print a verifiable transcript.');
        return;
      }
      const res = await fetch('/api/credential', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ data }),
      }).then((r) => r.json()).catch(() => null);

      if (res?.sig) { setUrl(`${window.location.origin}/verify?d=${data}&s=${res.sig}`); return; }
      setProblem(
        res?.error === 'credential-secret-not-set'
          ? 'CREDENTIAL_SECRET is not set, so this transcript cannot carry a verification code.'
          : 'This account is not permitted to sign credentials, so no verification code was added.',
      );
    })();
  }, [student]);

  if (problem) {
    return (
      <p className="mt-3 max-w-[300px] text-[9px] leading-snug text-red-700 print:text-black">
        <strong>No verification code.</strong> {problem} The document below is not independently
        verifiable and should not be issued as an official transcript.
      </p>
    );
  }
  if (!url) return null;
  return (
    <div className="mt-3 flex items-center gap-3">
      <QRCodeSVG value={url} size={64} level="M" />
      <p className="max-w-[220px] text-[9px] leading-snug text-[#6b6076] dark:text-[#9c93ad]">
        Scan to verify the authenticity of this transcript at iguc.net/verify. Unauthorized
        alteration invalidates this document.
      </p>
    </div>
  );
}
