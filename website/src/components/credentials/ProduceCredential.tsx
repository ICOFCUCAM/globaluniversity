'use client';

// ---------------------------------------------------------------------------
// PRODUCING THE DOCUMENT — hard copy, soft copy, email.
//
// ---------------------------------------------------------------------------
// WHAT WAS WRONG
// ---------------------------------------------------------------------------
//
// The three outputs existed and none of them was findable. Print sat on the
// issue screen; Print and Email sat on the register, three menu groups away;
// and a PDF was never mentioned anywhere, so the reasonable conclusion from
// looking at the portal was that it could not produce one.
//
// It can, and always could. The certificate carries its own @page rule — A4
// landscape, zero margin, everything but the document hidden — so the browser's
// print dialogue produces an exact, vector, full-bleed PDF of the sheet. That is
// a better PDF than a JavaScript library would generate for this document,
// because the artwork is SVG and the layout is in millimetres; a library would
// rasterise both.
//
// ---------------------------------------------------------------------------
// WHY PRINT AND PDF ARE ONE AUDITED ACT AND NOT TWO
// ---------------------------------------------------------------------------
//
// Because the server cannot tell them apart, and should not claim to. Both
// buttons make the same call; the operator then chooses a printer or "Save as
// PDF" in a dialogue the server never sees. Recording 'printed' for one and
// 'downloaded' for the other would put a distinction in the audit trail that
// nothing verified — and an audit trail is worth exactly what its weakest
// entry is worth.
//
// So the trail records what is true: a copy of this document was produced, by
// whom, when, and of which version. Which machine it came out of is not
// something this system knows.
// ---------------------------------------------------------------------------

import React from 'react';
import { Printer, FileDown, Mail, Loader2, Info } from 'lucide-react';
import { CARD, FOCUS, BTN_SECONDARY, BTN_PRIMARY } from '@/lib/portalTheme';

export interface ProduceCredentialProps {
  /** Whether the caller may produce a copy at all. */
  allowed: boolean;
  /** Whether the caller may email it to the holder. */
  mayEmail: boolean;
  /**
   * Produce the document. Resolves when the request has been made.
   *
   * The caller owns opening the print window — see CredentialAuthority — because
   * the window must be opened synchronously from the click or the browser blocks
   * it as a pop-up.
   */
  onProduce: () => void;
  onEmail: () => void;
  busy?: boolean;
  /** The graduate's address, so the operator can see where it is going. */
  holderEmail?: string | null;
  /**
   * Set when the credential has been superseded by a later version.
   *
   * Producing one is legitimate — an appeal panel may need the document as it
   * stood — but it must never happen unknowingly.
   */
  superseded?: boolean;
}

export default function ProduceCredential({
  allowed, mayEmail, onProduce, onEmail, busy, holderEmail, superseded,
}: ProduceCredentialProps) {
  if (!allowed) return null;

  return (
    <div className={`${CARD} p-5`}>
      <h3 className="font-heading text-base font-bold text-[#422e59] dark:text-[#e4dcf0]">
        Produce this certificate
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
        Every copy is recorded on the credential’s audit trail — who produced it, when, and which
        version.
      </p>

      {/* AN EXPLICIT WARNING, NOT A DISABLED BUTTON. Producing a superseded
          version is a legitimate act; doing it by accident is not. */}
      {superseded && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-[#e9c14a]/40 bg-[#e9c14a]/10 p-3 text-xs text-[#6b6076] dark:text-[#9c93ad]">
          <Info size={14} className="mt-0.5 shrink-0 text-[#a07c12]" />
          This version has been superseded by a later one. Producing it is legitimate — an appeal
          may need the document as it stood — but it is not the graduate’s current certificate.
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <button
            onClick={onProduce}
            disabled={busy}
            className={`${BTN_PRIMARY} w-full justify-center ${FOCUS}`}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
            Hard copy
          </button>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[#8a8194]">
            Opens the document and the print dialogue. Choose the printer.
          </p>
        </div>

        <div>
          {/* THE SAME CALL. The difference is what the operator picks in the
              dialogue, which is why this is a second button rather than a
              second endpoint — the value is telling somebody a PDF is
              available, which nothing in the portal previously did. */}
          <button
            onClick={onProduce}
            disabled={busy}
            className={`${BTN_SECONDARY} w-full justify-center ${FOCUS}`}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
            Soft copy (PDF)
          </button>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[#8a8194]">
            Same dialogue — choose <strong>Save as PDF</strong> as the destination. An exact A4
            landscape sheet, full bleed, vector.
          </p>
        </div>

        <div>
          <button
            onClick={onEmail}
            disabled={busy || !mayEmail}
            className={`${BTN_SECONDARY} w-full justify-center ${FOCUS}`}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
            Email it
          </button>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[#8a8194]">
            {mayEmail
              ? <>Sent to {holderEmail ? <strong>{holderEmail}</strong> : 'the address on the record'}, with the document attached.</>
              : 'Your role may produce a copy but not send one to the graduate.'}
          </p>
        </div>
      </div>
    </div>
  );
}
