'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

/** Signed verification QR printed on every transcript — scan → /verify. */
export default function TranscriptQR({ student }: { student: any }) {
  const [url, setUrl] = useState<string | null>(null);

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
    fetch('/api/credential', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.sig) setUrl(`${window.location.origin}/verify?d=${data}&s=${res.sig}`);
      })
      .catch(() => setUrl(null));
  }, [student]);

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
