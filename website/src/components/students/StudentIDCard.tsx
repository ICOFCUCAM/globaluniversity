'use client';

import { QRCodeSVG } from 'qrcode.react';
import { UNIVERSITY } from '@/lib/constants';

interface StudentLike {
  matric_no: string;
  student_number?: string | null;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  date_of_birth?: string | null;
  program?: string | null;
  degree_type?: string | null;
  admission_year?: number | string;
  photo_url?: string | null;
  status?: string;
}

/**
 * The student identity card.
 *
 * An identity card is not a summary of a record — it is a document a stranger
 * uses to decide whether the person in front of them is who they say they are.
 * Three things follow from that, and all three were wrong here.
 *
 * IT MUST CARRY A FACE. The card fell back to the holder's initials in a gold
 * box when no photograph was on file. That looks deliberate — like a design —
 * so a card with no photograph passed as a finished card, and an invigilator or
 * a gate officer had nothing to check a person against. There is no fallback
 * now: without a photograph the card is not issued, and the screen says why.
 *
 * IT MUST NAME THE PERSON, NOT JUST THE RECORD. Name and date of birth, because
 * a name alone does not distinguish two students who share one, and the date of
 * birth is what every other identity document the holder carries is keyed to.
 *
 * IT MUST EXPIRE. The card was valid for seven years — admission year plus
 * seven, which is neither a rule the university has nor a period anyone would
 * choose. A card outliving the holder's enrolment is a card that admits a
 * withdrawn student to an examination hall. It is valid for one year now, and
 * renewed on registration for the following semester, so it lapses on its own
 * if the holder stops registering.
 *
 * STILL OUTSTANDING: the QR is not signed. It encodes the card's own contents,
 * so a scanner reads back whatever the card says rather than what the
 * university holds — which means it confirms nothing that reading the card
 * would not. Signing it needs the same treatment as the admission letter
 * (src/lib/documentSecurity.ts), and that runs server-side; this component is
 * rendered in the browser. Until then the QR is a convenience for scanning at a
 * gate, not evidence, and it is labelled as such.
 */
export default function StudentIDCard({ student, onClose }: { student: StudentLike; onClose: () => void }) {
  const fullName = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ');
  const idNumber = student.student_number || student.matric_no;

  // One year, renewable. Issued today, because a card is issued when it is
  // printed — not when the holder was admitted.
  const issued = new Date();
  const expires = new Date(issued);
  expires.setFullYear(expires.getFullYear() + 1);
  const monthYear = (d: Date) =>
    `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const dob = student.date_of_birth
    ? new Date(student.date_of_birth).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
      }).toUpperCase()
    : null;

  const qrPayload = JSON.stringify({
    u: 'IGUC',
    id: idNumber,
    n: fullName,
    d: student.date_of_birth ?? '',
    p: student.program,
    x: expires.toISOString().slice(0, 10),
  });

  // An applicant is not a student. A card issued before admission is a card
  // that says the university has accepted someone it has not.
  const notEnrolled = ['applicant', 'fee_paid', 'registrar_approved', 'documents_required', 'rejected', 'deferred']
    .includes((student.status ?? '').toLowerCase());
  const noPhoto = !student.photo_url;
  const refuse = notEnrolled || noPhoto;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 print:static print:block print:bg-white print:p-0"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg">
        {refuse ? (
          <div className="mx-auto max-w-md rounded-2xl border border-amber-300 bg-amber-50 p-7 print:hidden">
            <p className="font-heading text-lg font-bold text-amber-900">No card can be issued yet</p>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-amber-900/90">
              {notEnrolled && (
                <li>
                  <strong>{fullName} is not yet enrolled.</strong> The record stands at{' '}
                  <span className="font-mono text-[13px]">{student.status}</span>. A student card is
                  issued on registration, after the Admissions Office has admitted the applicant —
                  a card issued before that says the university has accepted someone it has not.
                </li>
              )}
              {noPhoto && (
                <li>
                  <strong>There is no photograph on file.</strong> A card without a face cannot be
                  checked against the person carrying it, which is the only thing it is for. Upload
                  a photograph to the student record and print the card again.
                </li>
              )}
            </ul>
            <button
              onClick={onClose}
              className="mt-6 rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-[#4a4155] shadow ring-1 ring-black/5 transition hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        ) : (
          <>
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
                      {UNIVERSITY.name.toUpperCase()}
                    </p>
                    <p className="text-[9px] uppercase tracking-[0.2em] text-[#f7dc79]">
                      Student Identity Card
                    </p>
                  </div>
                </div>

                <div className="mt-3.5 flex flex-1 items-start gap-3.5">
                  {/* The face. Portrait proportions, because that is the shape a
                      photograph of a person is, and a square crop cuts the top
                      of the head off as often as not. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={student.photo_url!}
                    alt={`Photograph of ${fullName}`}
                    className="h-[88px] w-[68px] shrink-0 rounded-lg border-2 border-[#f7dc79]/70 object-cover"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-heading text-[17px] font-extrabold leading-tight">
                      {fullName}
                    </p>
                    <p className="mt-0.5 font-mono text-[13px] tracking-wider text-[#f7dc79]">
                      {idNumber}
                    </p>
                    {dob && (
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-white/70">
                        Date of birth <span className="font-semibold text-white/90">{dob}</span>
                      </p>
                    )}
                    <p className="mt-1 truncate text-[11px] text-white/85">
                      {[student.degree_type, student.program].filter(Boolean).join(' · ')}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-white/60">
                      Issued {monthYear(issued)} · <span className="text-[#f7dc79]">Expires {monthYear(expires)}</span>
                    </p>
                  </div>

                  <div className="shrink-0 rounded-lg bg-white p-1.5">
                    <QRCodeSVG value={qrPayload} size={64} level="M" />
                  </div>
                </div>

                {/* Why it expires, on the card itself. A holder who is told at a
                    gate that their card has lapsed should not have to ask
                    anyone what to do about it. */}
                <p className="text-[8.5px] leading-snug text-white/55">
                  Valid for one year. Renewed on payment of registration for the following semester.
                  Not transferable. If found, return to the Office of the Registrar.
                </p>

                <div className="mt-1.5 flex items-end justify-between gap-3 text-[9px] text-white/60">
                  <span className="min-w-0 truncate">
                    {UNIVERSITY.descriptor} · {UNIVERSITY.headquarters} · {UNIVERSITY.website}
                  </span>
                  <span className="shrink-0 font-heading text-[10px] italic text-[#f7dc79]">Registrar</span>
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
                className="rounded-xl bg-white/90 px-6 py-2.5 text-sm font-medium text-[#4a4155] transition hover:bg-white"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
