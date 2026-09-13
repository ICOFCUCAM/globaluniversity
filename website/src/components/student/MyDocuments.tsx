'use client';

// ---------------------------------------------------------------------------
// MY DOCUMENTS — three registers, one shelf.
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY ASKED FOR
// ---------------------------------------------------------------------------
//
// "This is particularly important given the admission system you've built.
// Admission Letter · Issued · Verified. Enrolment Confirmation. Course
// Registration. Academic Transcript. Fee Statements. Receipts. Certificates.
// Other Official Documents. Every official document should have: document
// number, issue date, status, verification, download/view, QR verification
// where appropriate."
//
// ---------------------------------------------------------------------------
// NOTHING NEW WAS BUILT TO HOLD THESE
// ---------------------------------------------------------------------------
//
// The University's instruction was "check the system to avoid duplicate as
// many must be in the system and need to be connected", and this screen is the
// clearest case of it. All three registers already existed and had done for
// months: `credentials_issued` holds every sealed certificate with its
// verification code, `admission_letters` holds every letter the University has
// issued, `documents` holds everything uploaded. No student could open any of
// them. 074's `my_documents` reads all three; this draws them.
//
// ---------------------------------------------------------------------------
// THE QR CODE IS OFFERED WHERE IT MEANS SOMETHING, AND NOWHERE ELSE
// ---------------------------------------------------------------------------
//
// "QR verification where appropriate" — and `appropriate` is doing real work
// in that sentence. A sealed credential can be checked by a stranger at
// /verify against its content hash. An uploaded birth certificate cannot:
// there is nothing to check it against, and a QR code beside it would offer a
// proof that does not exist to an employer who would believe it.
//
// So `verifiable` comes from the view, and the QR panel appears only for rows
// that carry it.
//
// ---------------------------------------------------------------------------
// AND `TranscriptQR` IS NOT REUSED HERE, THOUGH IT LOOKED LIKE THE ANSWER
// ---------------------------------------------------------------------------
//
// The audit found `TranscriptQR` sitting in this repository, working, and
// called by nothing — exactly the pattern the University warned about, and the
// obvious thing to connect. It is the wrong component for this screen, and the
// reason is worth writing down so nobody tries again.
//
// It SIGNS ON DEMAND: it builds a payload, posts it to /api/credential, and
// gets back a signature. That endpoint is restricted to the office holding
// `design-credentials`, because an open signing endpoint once let anybody have
// the University sign a degree of their choosing. A student does not hold it,
// so the component would render its own refusal — "this account is not
// permitted to sign credentials" — on the student's own certificate.
//
// It is also solving a different problem. A transcript being PRINTED does not
// exist as a row yet, so it has to be signed as it is drawn. A credential in
// `credentials_issued` was sealed when it was issued and already carries its
// verification code. There is nothing to sign; there is only a code to show.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/portal';
import StudentScreen from './StudentScreen';
import { readMine } from '@/lib/studentReads';
import { QRCodeSVG } from 'qrcode.react';
import {
  Award, BadgeCheck, FileText, FolderOpen, Mail, ShieldCheck, Upload, X,
} from 'lucide-react';

// eslint-disable-next-line max-len
const COLUMNS = 'student_id, source, item_id, kind, title, document_number, issued_on, status, in_force, verifiable, verification_code, file_url, version';

export interface StudentDocument {
  source: 'credential' | 'admission-letter' | 'upload';
  item_id: string;
  kind: string;
  title: string;
  document_number: string | null;
  issued_on: string | null;
  status: string;
  in_force: boolean;
  verifiable: boolean;
  verification_code: string | null;
  file_url: string | null;
  version: number;
}

/**
 * The three registers, named as the University would name them.
 *
 * ORDERED BY WHAT MATTERS MOST TO A GRADUATE. A sealed certificate is the
 * document somebody needs at short notice, twenty years from now; an uploaded
 * copy of a birth certificate is the one they needed once.
 */
const GROUPS: { source: StudentDocument['source']; title: string; note: string;
  icon: React.ReactNode }[] = [
  {
    source: 'credential',
    title: 'Sealed credentials',
    note: 'Issued under the University’s seal. Anyone can verify these without contacting us.',
    icon: <Award size={20} />,
  },
  {
    source: 'admission-letter',
    title: 'Admission',
    note: 'The letter the University issued you, exactly as it was sent.',
    icon: <Mail size={20} />,
  },
  {
    source: 'upload',
    title: 'Documents you gave us',
    note: 'What you uploaded, and whether the University has checked it.',
    icon: <Upload size={20} />,
  },
];

export default function MyDocuments() {
  const [docs, setDocs] = useState<StudentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [showing, setShowing] = useState<StudentDocument | null>(null);

  const load = useCallback(async () => {
    const { rows, failed: f } = await readMine<StudentDocument>('my_documents', COLUMNS);
    setDocs(rows); setFailed(f); setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const grouped = useMemo(() => GROUPS.map((g) => ({
    ...g,
    rows: docs
      .filter((d) => d.source === g.source)
      .sort((a, b) => (b.issued_on ?? '').localeCompare(a.issued_on ?? '')),
  })).filter((g) => g.rows.length > 0), [docs]);

  const sealed = docs.filter((d) => d.verifiable && d.in_force).length;

  return (
    <StudentScreen
      title="My documents"
      subtitle={docs.length === 0 ? 'Everything official the University holds for you'
        : `${docs.length} document${docs.length === 1 ? '' : 's'}`
          + (sealed > 0 ? ` · ${sealed} verifiable` : '')}
      loading={loading}
      failed={failed}
      empty={docs.length === 0}
      icon={<FolderOpen size={20} />}
      emptyTitle="No documents yet"
      emptyWhy={'Nothing has been issued to you and nothing has been uploaded. Your admission '
        + 'letter appears here once it is issued, and your certificate once your degree is '
        + 'conferred.'}
    >
      <div className="space-y-6">
        {grouped.map((g) => (
          <section key={g.source} className="space-y-2">
            <div>
              <h2 className="font-heading text-sm font-bold text-[#422e59] dark:text-[#c8b6e8]">
                {g.title}
              </h2>
              <p className="text-[11px] text-[#a49bb0] dark:text-[#7b7289]">{g.note}</p>
            </div>
            <Card className="divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
              {g.rows.map((d) => (
                <Row key={`${d.source}-${d.item_id}`} d={d} onVerify={() => setShowing(d)} />
              ))}
            </Card>
          </section>
        ))}

        {/* NOT PROMISED, BECAUSE THEY DO NOT EXIST YET. The University listed
            Enrolment Confirmation, Course Registration and Fee Statements
            among the documents a student should hold. None of the three is
            issued by this system today. Saying so is better than a heading
            with nothing under it, which reads as a thing that has gone
            missing — and the request screen is where one can be asked for. */}
        <p className="text-[11px] leading-relaxed text-[#a49bb0] dark:text-[#7b7289]">
          Enrolment confirmations, course registration statements and fee statements are not yet
          issued as documents by this system. You can ask the Registry for one under Student
          services, and it will be sent to you.
        </p>
      </div>

      {showing && <VerifyPanel d={showing} onClose={() => setShowing(null)} />}
    </StudentScreen>
  );
}

function Row({ d, onVerify }: { d: StudentDocument; onVerify: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <span className="shrink-0 text-[#c5a55a]">
        {d.source === 'credential' ? <Award size={16} />
          : d.source === 'admission-letter' ? <Mail size={16} /> : <FileText size={16} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#33234a] dark:text-[#e4dcf0]">
          {d.title}
          {/* A SUPERSEDED VERSION IS SAID SO. A graduate holding version 1 of a
              corrected certificate needs to know version 2 exists. */}
          {d.version > 1 && (
            <span className="ml-2 text-[11px] font-normal text-[#a07c12]">version {d.version}</span>
          )}
        </p>
        <p className="truncate text-[11px] text-[#a49bb0]">
          {d.document_number ?? 'No document number'}
          {d.issued_on ? ` · issued ${new Date(`${d.issued_on}T00:00:00`)
            .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
        </p>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
        !d.in_force ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
          : d.status === 'verified' || d.status === 'issued' || d.status === 'sealed'
            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
            : 'bg-[#f5f1ea] text-[#6b6076] dark:bg-[#2a2333] dark:text-[#9c93ad]'
      }`}>
        {/* THE STATUS IS THE REGISTER'S OWN WORD, not one this screen invents.
            'revoked' must read as revoked. */}
        {d.in_force ? d.status : d.status}
      </span>
      {d.verifiable && d.in_force ? (
        <button
          onClick={onVerify}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#ded6c8] px-3
                     py-1.5 text-xs font-medium text-[#422e59] transition hover:bg-[#f5f1ea]
                     dark:border-[#3d3349] dark:text-[#c8b6e8] dark:hover:bg-[#2a2333]"
        >
          <ShieldCheck size={13} /> Verify
        </button>
      ) : d.file_url ? (
        <a
          href={d.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg border border-[#ded6c8] px-3 py-1.5 text-xs font-medium
                     text-[#422e59] transition hover:bg-[#f5f1ea] dark:border-[#3d3349]
                     dark:text-[#c8b6e8] dark:hover:bg-[#2a2333]"
        >
          View
        </a>
      ) : null}
    </div>
  );
}

/** The verification panel. See the header for why this is not TranscriptQR. */
function VerifyPanel({ d, onClose }: { d: StudentDocument; onClose: () => void }) {
  const url = typeof window === 'undefined' ? '' : `${window.location.origin}/verify`;
  const full = d.verification_code ? `${url}?c=${encodeURIComponent(d.verification_code)}` : url;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-label={`Verify ${d.title}`}
      onClick={onClose}
    >
      <Card className="w-full max-w-md p-6" >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-base font-bold text-[#422e59] dark:text-[#c8b6e8]">
              {d.title}
            </h2>
            <p className="text-xs text-[#a49bb0]">{d.document_number}</p>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="rounded-lg p-1.5 text-[#a49bb0] hover:bg-[#f5f1ea] dark:hover:bg-[#2a2333]">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <QRCodeSVG value={full} size={168} level="M" />
          <p className="text-center text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
            Anyone can scan this, or enter the code below at <strong>{url}</strong>, and see what
            the University issued. They do not need an account and they do not need to contact us.
          </p>
          {d.verification_code && (
            <p className="select-all rounded-lg bg-[#faf8f4] px-3 py-2 font-mono text-sm
                          tracking-wider text-[#33234a] dark:bg-[#241f2c] dark:text-[#e4dcf0]">
              {d.verification_code}
            </p>
          )}
          <p className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
            <BadgeCheck size={12} /> Sealed by the University
          </p>
        </div>
      </Card>
    </div>
  );
}
