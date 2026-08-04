'use client';

import { QRCodeSVG } from 'qrcode.react';

interface StudentLike {
  matric_no: string;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  program?: string | null;
  degree_type?: string | null;
  admission_year?: number | string;
  photo_url?: string | null;
  status?: string;
}

/**
 * Premium digital student ID card — deep-purple gradient, gold accent bar,
 * QR code encoding the student's identity for gate/library/exam scanning.
 * Renders at standard card ratio; the Print button produces a clean copy.
 */
export default function StudentIDCard({ student, onClose }: { student: StudentLike; onClose: () => void }) {
  const fullName = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ');
  const validUntil = Number(student.admission_year || new Date().getFullYear()) + 7;
  const qrPayload = JSON.stringify({
    u: 'IGUC',
    id: student.matric_no,
    n: fullName,
    p: student.program,
    v: validUntil,
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 print:static print:block print:bg-white print:p-0" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg">
        {/* The card */}
        <div
          id="iguc-id-card"
          className="relative mx-auto aspect-[8/5] w-full max-w-md overflow-hidden rounded-2xl shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #322244 0%, #422e59 55%, #57549a 100%)' }}
        >
          {/* Decorative rings */}
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full border-[10px] border-white/5" />
          <div className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full border-[14px] border-white/5" />
          {/* Gold accent bar */}
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#e9c14a] via-[#f7dc79] to-[#e9c14a]" />

          <div className="relative flex h-full flex-col p-5 text-white">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/site-icon.png" alt="" className="h-9 w-9 rounded-full bg-white/90 p-0.5" />
              <div>
                <p className="font-heading text-[13px] font-bold leading-tight tracking-wide">
                  ICOF GLOBAL UNIVERSITY
                </p>
                <p className="text-[9px] uppercase tracking-[0.2em] text-[#f7dc79]">Student Identity Card</p>
              </div>
            </div>

            <div className="mt-4 flex flex-1 items-center gap-4">
              {student.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={student.photo_url} alt="" className="h-20 w-20 rounded-xl border-2 border-[#f7dc79]/70 object-cover" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-[#f7dc79]/70 bg-white/10 font-heading text-2xl font-bold text-[#f7dc79]">
                  {student.first_name?.[0]}
                  {student.last_name?.[0]}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-lg font-extrabold leading-tight">{fullName}</p>
                <p className="mt-0.5 font-mono text-sm tracking-wider text-[#f7dc79]">{student.matric_no}</p>
                <p className="mt-1.5 truncate text-[11px] text-white/85">
                  {[student.degree_type, student.program].filter(Boolean).join(' · ')}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-white/60">
                  Status: {student.status ?? 'active'} · Valid thru 12/{validUntil}
                </p>
              </div>
              <div className="rounded-lg bg-white p-1.5">
                <QRCodeSVG value={qrPayload} size={72} level="M" />
              </div>
            </div>

            <div className="flex items-end justify-between text-[9px] text-white/60">
              <span>The Community University of Africa · Buea, Cameroon · www.iguc.net</span>
              <span className="font-heading text-[10px] italic text-[#f7dc79]">Registrar</span>
            </div>
          </div>
        </div>

        {/* Actions (hidden when printing) */}
        <div className="mt-5 flex justify-center gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="rounded-xl bg-[#f7dc79] px-6 py-2.5 text-sm font-semibold text-[#422e59] shadow-lg transition hover:brightness-105"
          >
            Print / Save as PDF
          </button>
          <button
            onClick={onClose}
            className="rounded-xl bg-white/90 px-6 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
