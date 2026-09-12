'use client';

// ---------------------------------------------------------------------------
// THE SPECIMEN BOOK.
//
// One certificate per level the University confers, shown side by side.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS FOR, AND WHY ONE PREVIEW WAS NOT ENOUGH
// ---------------------------------------------------------------------------
//
// The Studio previewed a single Bachelor of Theology. Four decisions vary by
// level and none of them could be seen: the conferring verb, the lead-in, the
// classification, and whether a thesis is named. So the only way to find out
// what a doctorate looks like was to confer one on somebody.
//
// Every real specimen book works this way — a page per instrument, so the
// office that signs them has seen each form before one is signed for a person.
// That is what this is.
//
// ---------------------------------------------------------------------------
// THEY ARE DESIGNED TO BE SHOWN, WHICH IS WHY THEY ARE DISARMED
// ---------------------------------------------------------------------------
//
// A specimen exists to be printed, emailed and put in front of a committee, so
// it will end up outside this system. It carries SPECIMEN across the face, a
// credential number that reads NOT AN ISSUED CREDENTIAL, an invented holder,
// and no entry in the register — so /verify returns nothing for it. See
// src/lib/specimens.ts.
// ---------------------------------------------------------------------------

import React from 'react';
import { Printer, ChevronDown } from 'lucide-react';
import CertificateDocument from '@/components/certificate/CertificateDocument';
import { DEFAULT_CERTIFICATE_DESIGN } from '@/lib/credentialTemplate';
import type { CredentialDesign } from '@/lib/credentialTemplate';
import { SPECIMENS } from '@/lib/specimens';
import { SECTION_SUB, CARD, FOCUS, BTN_SECONDARY, EYEBROW } from '@/lib/portalTheme';

/**
 * The gallery.
 *
 * TAKES THE LIVE DESIGN when the Studio has one, so a specimen shows what the
 * University's certificate looks like NOW rather than what the defaults look
 * like. A specimen book printed from stale defaults is worse than none: it is
 * an authoritative-looking picture of a document the University does not issue.
 */
export default function SpecimenGallery({ design }: { design?: CredentialDesign }) {
  const active = design ?? DEFAULT_CERTIFICATE_DESIGN;

  // One at a time, or all five. Default to one — five A4 landscape sheets at
  // once is a page nobody scrolls to the bottom of, and the comparison people
  // actually want is between two adjacent levels.
  const [openId, setOpenId] = React.useState<string | null>(SPECIMENS[2].id); // the bachelor's
  const [trueSize, setTrueSize] = React.useState(false);
  const scale = trueSize ? 1 : 0.5;

  return (
    <div className="space-y-5">
      {/* NO HEADING HERE. The workspace above already names the area and says
          what it is for; repeating it printed the same sentence twice, one line
          apart. What this adds is the part the shell cannot say — why none of
          these sheets is dangerous. */}
      <p className={SECTION_SUB}>
        Every sheet is overprinted SPECIMEN, names an invented holder, and carries no credential
        number — none of them verifies, because none of them is in the register.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-[#ded6c8] p-0.5 dark:border-[#3d3349]">
          {([['Fit', false], ['Actual size', true]] as [string, boolean][]).map(([label, v]) => (
            <button
              key={label}
              onClick={() => setTrueSize(v)}
              className={`rounded-md px-3 py-1 text-[11px] font-medium transition-colors ${FOCUS} ${
                trueSize === v
                  ? 'bg-[#422e59] text-white'
                  : 'text-[#6b6076] hover:bg-[#f2eee6] dark:text-[#9c93ad] dark:hover:bg-[#2a2333]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => setOpenId(null)} className={`${BTN_SECONDARY} text-[11px]`}>
          Collapse all
        </button>
        <button onClick={() => window.print()} className={`${BTN_SECONDARY} text-[11px]`}>
          <Printer size={13} /> Print the open specimen
        </button>
      </div>

      <div className="space-y-3">
        {SPECIMENS.map((s) => {
          const open = openId === s.id;
          return (
            <div key={s.id} className={CARD}>
              <button
                onClick={() => setOpenId(open ? null : s.id)}
                aria-expanded={open}
                className={`flex w-full items-start justify-between gap-4 p-4 text-left ${FOCUS}`}
              >
                <div className="min-w-0">
                  <p className={EYEBROW}>{s.level}</p>
                  <p className="mt-1 font-heading text-base font-bold text-[#422e59] dark:text-[#e4dcf0]">
                    {s.data.degree}
                  </p>
                  {/* WHAT THIS SHEET EXISTS TO SHOW. Without it the gallery is
                      five pictures and the reader has to spot the difference
                      themselves — which is precisely what nobody did when there
                      was one preview. */}
                  <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
                    {s.shows}
                  </p>
                </div>
                <ChevronDown
                  size={18}
                  className={`mt-1 shrink-0 text-[#a49bb0] transition-transform ${open ? 'rotate-180' : ''}`}
                />
              </button>

              {open && (
                <div className="border-t border-[#ded6c8] p-4 dark:border-[#3d3349]">
                  <div className="overflow-auto rounded-xl bg-[#f2eee6] p-5 dark:bg-[#2a2333]">
                    <div style={{
                      transform: `scale(${scale})`,
                      transformOrigin: 'top left',
                      width: `${100 / scale}%`,
                      height: trueSize ? undefined : 'auto',
                    }}>
                      <CertificateDocument design={active} data={s.data} specimen />
                    </div>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[#a49bb0]">
                    {trueSize
                      ? 'Actual printed size — scroll to see the whole sheet.'
                      : `Shown at ${Math.round(scale * 100)}% of printed size.`}
                    {' '}
                    {design
                      ? 'Drawn with the design currently open in the Studio.'
                      : 'Drawn with the University’s default certificate design.'}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
