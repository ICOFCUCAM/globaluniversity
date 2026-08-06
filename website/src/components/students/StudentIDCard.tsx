'use client';

// ---------------------------------------------------------------------------
// The student identity card.
//
// An identity card is not a summary of a record — it is a document a stranger
// uses to decide whether the person in front of them is who they say they are.
// Everything below follows from that.
//
// THE CARD IS ISSUED BY THE SERVER, NOT DRAWN FROM THE BROWSER'S COPY.
//
// It used to render whatever row the register happened to be holding, and its
// QR encoded that same row — so the QR confirmed nothing. A scanner read back
// what the card said. Change the name in memory before printing and the QR
// agreed with the change.
//
// This component now posts a student id to /api/identity/card and draws what
// comes back. The name, the number, the expiry and the seal are the
// university's, read from the database with the service-role key and signed
// there. The page cannot add to them, and it cannot make its own QR.
//
// IT MUST CARRY A FACE. The card used to fall back to the holder's initials in
// a gold box when no photograph was on file. That looks deliberate — like a
// design — so a card with no face passed as finished, and an invigilator had
// nothing to check a person against. The server refuses to issue one now, and
// says so.
//
// IT MUST EXPIRE. It was valid for admission year plus seven, which is neither
// a rule the university has nor a period anyone would choose. A card outliving
// enrolment admits a withdrawn student to an examination hall. One year now,
// renewed on payment of registration for the following semester, and the expiry
// is inside the seal — the one field a card is worth forging.
//
// WHAT THE SEAL DOES NOT PROVE: that the holder is still enrolled today. A
// student suspended the week after printing carries a card that still verifies.
// See the route for why, and what closing it would take.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { UNIVERSITY } from '@/lib/constants';

export interface IssuedCard {
  fullName: string;
  idNumber: string;
  dateOfBirth: string | null;
  programme: string;
  photoUrl: string;
  issuedOn: string;
  expiresOn: string;
}

export interface CardSeal {
  sealed: boolean;
  code: string;
  qrSvg: string | null;
}

const monthYear = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

/**
 * The face of the card.
 *
 * Separated from the fetching below so it can be rendered without a session, a
 * server or a database — which is how it is screenshotted and checked. It draws
 * what it is handed and computes nothing: every value on a card is the
 * university's, decided in /api/identity/card.
 */
export function IdentityCard({ card, seal }: { card: IssuedCard; seal: CardSeal }) {
  return (
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
              photograph of a person is; a square crop takes the top of the head
              off as often as not. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={card.photoUrl}
            alt={`Photograph of ${card.fullName}`}
            className="h-[88px] w-[68px] shrink-0 rounded-lg border-2 border-[#f7dc79]/70 object-cover"
          />

          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-[17px] font-extrabold leading-tight">
              {card.fullName}
            </p>
            <p className="mt-0.5 font-mono text-[13px] tracking-wider text-[#f7dc79]">
              {card.idNumber}
            </p>
            {card.dateOfBirth && (
              <p className="mt-1 text-[10px] uppercase tracking-wide text-white/70">
                Date of birth <span className="font-semibold text-white/90">{card.dateOfBirth}</span>
              </p>
            )}
            <p className="mt-1 truncate text-[11px] text-white/85">{card.programme}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-white/60">
              Issued {monthYear(card.issuedOn)} ·{' '}
              <span className="text-[#f7dc79]">Expires {monthYear(card.expiresOn)}</span>
            </p>
          </div>

          <div className="shrink-0 text-center">
            {seal.qrSvg ? (
              <div
                className="rounded-lg bg-white p-1.5"
                // The QR is SVG built by the route from the link it signed. It
                // is markup the server generated, not anything a user supplied.
                dangerouslySetInnerHTML={{ __html: seal.qrSvg }}
              />
            ) : (
              <div className="flex h-[68px] w-[68px] items-center justify-center rounded-lg border border-dashed border-white/30 p-1 text-center text-[7px] uppercase leading-tight tracking-wide text-white/50">
                Not sealed
              </div>
            )}
          </div>
        </div>

        {/* The fine print carries two things a holder should never have to ask
            anyone about: why the card expires, and how to check it.

            The seal code is set in words here rather than under the QR — a gate
            with a scanner uses the QR, but a registrar on the telephone reads
            this, and nineteen characters do not fit in sixty-eight pixels at a
            legible size. A code nobody can read is not a check anyone
            completes. */}
        <p className="text-[8.5px] leading-snug text-white/55">
          {seal.sealed ? (
            <>
              <span className="font-mono tracking-tight text-[#f7dc79]/90">Seal {seal.code}</span>
              {' — verify at '}{UNIVERSITY.website}/verify, or scan. Valid for one year, renewed on
              payment of registration for the following semester. Not transferable. If found,
              return to the Office of the Registrar.
            </>
          ) : (
            <>
              Valid for one year, renewed on payment of registration for the following semester.
              This copy carries no verification code — ask the Registrar to reissue it.
            </>
          )}
        </p>

        <div className="mt-1.5 flex items-end justify-between gap-3 text-[9px] text-white/60">
          <span className="min-w-0 truncate">
            {UNIVERSITY.descriptor} · {UNIVERSITY.headquarters} · {UNIVERSITY.website}
          </span>
          <span className="shrink-0 font-heading text-[10px] italic text-[#f7dc79]">Registrar</span>
        </div>
      </div>
    </div>
  );
}

export default function StudentIDCard({
  student,
  onClose,
}: {
  student: { id: string; first_name?: string; last_name?: string };
  onClose: () => void;
}) {
  const [issued, setIssued] = useState<{ card: IssuedCard; seal: CardSeal } | null>(null);
  const [refusals, setRefusals] = useState<{ code: string; message: string }[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        if (live) setProblem('Your session has expired. Sign in again to print a card.');
        return;
      }
      const res = await fetch('/api/identity/card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentId: student.id }),
      })
        .then((r) => r.json())
        .catch(() => null);
      if (!live) return;
      if (res?.ok) setIssued({ card: res.card, seal: res.seal });
      else if (res?.refusals) setRefusals(res.refusals);
      else setProblem(res?.error ?? 'The card could not be issued.');
    })();
    return () => {
      live = false;
    };
  }, [student.id]);

  const name = [student.first_name, student.last_name].filter(Boolean).join(' ') || 'this student';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 print:static print:block print:bg-white print:p-0"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg">
        {/* --- Not issued ------------------------------------------------ */}
        {(refusals || problem) && (
          <div className="mx-auto max-w-md rounded-2xl border border-amber-300 bg-amber-50 p-7 print:hidden">
            <p className="font-heading text-lg font-bold text-amber-900">No card can be issued yet</p>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-amber-900/90">
              {refusals?.map((r) => (
                <li key={r.code}>
                  <strong>{name}:</strong> {r.message}
                </li>
              ))}
              {problem && <li>{problem}</li>}
            </ul>
            <button
              onClick={onClose}
              className="mt-6 rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-[#4a4155] shadow ring-1 ring-black/5 transition hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        )}

        {/* --- Waiting on the university --------------------------------- */}
        {!issued && !refusals && !problem && (
          <div className="mx-auto flex aspect-[8/5] w-full max-w-md items-center justify-center rounded-2xl bg-[#322244] text-sm text-white/70 print:hidden">
            <span className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-[#f7dc79]"
              />
              Issuing…
            </span>
          </div>
        )}

        {/* --- The card -------------------------------------------------- */}
        {issued && (
          <>
            <IdentityCard card={issued.card} seal={issued.seal} />

            {!issued.seal.sealed && (
              <p className="mx-auto mt-4 max-w-md rounded-xl border border-amber-300 bg-amber-50 p-4 text-[13px] leading-relaxed text-amber-900 print:hidden">
                <strong>This card carries no verification code.</strong> CREDENTIAL_SECRET is not
                set on the server, so nothing can be sealed. The card is genuine but cannot be
                checked by anyone scanning it. Set the key and print it again.
              </p>
            )}

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
