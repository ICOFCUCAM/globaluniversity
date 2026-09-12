'use client';

// ---------------------------------------------------------------------------
// SIGNING ON THE SCREEN.
//
// The University asked why affixing a signature opened a file chooser and
// whether the document could not simply be signed. It can, and this is that:
// the officer signs with a mouse, a finger or a stylus and the strokes become
// the image the credential carries.
//
// ---------------------------------------------------------------------------
// WHY THIS IS BETTER THAN THE FILE, AND WHY THE FILE STAYS
// ---------------------------------------------------------------------------
//
// Signing here produces exactly what the document needs and nothing else. A
// canvas begins transparent and only the strokes are painted, so there is no
// white box behind the signature — which is the single commonest fault with a
// scanned one, and the one that prints a pale rectangle over the frame of every
// certificate. It is also cropped to the ink, so it sits on the rule the same
// way whoever signs and wherever on the pad they start.
//
// The file chooser stays because a wet signature on paper is still the thing
// many institutions want: the officer signs a sheet, it is scanned at 600dpi,
// and that scan is the University's own record of their hand. Nothing here
// replaces that; it removes the step for the officer who is sitting at the
// machine.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS NOT
// ---------------------------------------------------------------------------
//
// It is not a legal electronic signature and nothing here says it is. It is the
// APPEARANCE of a signature, printed on a document — the same standing as the
// scan of a wet one. What makes a credential from this University checkable is
// the seal, the credential number, the register behind /verify and the Ed25519
// signature over the content hash. Those are cryptography; this is ink.
// ---------------------------------------------------------------------------

import React from 'react';
import { Eraser, Check, X } from 'lucide-react';
import { inkBounds, looksSigned } from '@/lib/signatureInk';
import { FOCUS, BTN_SECONDARY } from '@/lib/portalTheme';

/** Drawn large and scaled down on the document, so print stays sharp. */
const PAD_W = 620;
const PAD_H = 200;
/** Room round the strokes when the ink is cropped out, in canvas pixels. */
const TRIM_PAD = 6;

/**
 * The inks an officer may sign in.
 *
 * REAL SIGNING INKS, not a colour picker. A palette invites somebody to sign a
 * degree certificate in pink, and the four here are the ones institutions
 * actually use: black and blue-black for the archive, royal blue because it is
 * visibly not a photocopy, and a dark red kept for the office that also seals.
 *
 * The colour is a property of the signature, not of the design: two officers on
 * the same certificate may sign in different inks, exactly as they would on
 * paper.
 */
const INKS = [
  { label: 'Black', value: '#101820' },
  { label: 'Blue-black', value: '#1b2a4a' },
  { label: 'Royal blue', value: '#1747c2' },
  { label: 'Dark red', value: '#8a1b1b' },
] as const;

export default function SignaturePad({
  office, onDone, onCancel,
}: {
  office: string;
  onDone: (signature: string) => void;
  onCancel: () => void;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const drawing = React.useRef(false);
  const last = React.useRef<{ x: number; y: number } | null>(null);
  /**
   * Where the last curve ended.
   *
   * THE STROKE CAME OUT DASHED WITHOUT THIS. Each move drew from the previous
   * POINT to the midpoint of the new segment and stopped, so the second half of
   * every segment was never painted and the signature was a row of commas. A
   * curve has to START where the last one ended, which is the midpoint, not the
   * point.
   */
  const lastMid = React.useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = React.useState(false);
  const [tooLittle, setTooLittle] = React.useState(false);
  const [ink, setInk] = React.useState<string>(INKS[0].value);
  // Read inside the pointer handlers, which are not re-created when the colour
  // changes — without the ref a stroke begun after a colour change would still
  // be drawn in the colour the handler closed over.
  const inkRef = React.useRef(ink);
  inkRef.current = ink;

  // THE BACKING STORE IS DENSER THAN THE BOX. A canvas drawn at CSS size and
  // printed at 300dpi is a blur; at three times the size it holds up on paper,
  // which is the only place this image really has to work.
  const dpr = 3;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = PAD_W * dpr;
    canvas.height = PAD_H * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.4;
  }, []);

  function at(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    // The pad is drawn at PAD_W but laid out narrower on a small screen, so a
    // point has to be mapped back rather than taken as-is.
    return {
      x: ((e.clientX - rect.left) / rect.width) * PAD_W,
      y: ((e.clientY - rect.top) / rect.height) * PAD_H,
    };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = at(e);
    lastMid.current = last.current;
    setTooLittle(false);
    // A DOT IS A MARK. Somebody who signs with a full stop after their initial
    // must get the full stop; without this a single tap draws nothing at all.
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && last.current) {
      ctx.beginPath();
      ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = inkRef.current;
      ctx.fill();
    }
    setHasInk(true);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    const from = last.current;
    if (!ctx || !from) return;
    const to = at(e);
    // A QUADRATIC THROUGH THE MIDPOINTS, not a straight line to each sample.
    // Pointer events arrive far enough apart that a polyline shows every one of
    // them as a corner, and a signature made of corners does not look like
    // anybody's hand.
    //
    // FROM THE LAST MIDPOINT, THROUGH THE POINT, TO THE NEW MIDPOINT. Starting
    // at the point instead left half of every segment unpainted — the strokes
    // came out dashed, which looked like a stylus problem and was arithmetic.
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const start = lastMid.current ?? from;
    // Set per stroke rather than once, so a colour changed mid-signature applies
    // from there on — which is what a second pen would do.
    ctx.strokeStyle = inkRef.current;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(from.x, from.y, mid.x, mid.y);
    ctx.stroke();
    lastMid.current = mid;
    last.current = to;
  }

  function up() {
    // The tail of the stroke: the last midpoint to where the pen actually
    // lifted. Without it every stroke stops half a sample short of the end.
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && drawing.current && lastMid.current && last.current) {
      ctx.strokeStyle = inkRef.current;
      ctx.beginPath();
      ctx.moveTo(lastMid.current.x, lastMid.current.y);
      ctx.lineTo(last.current.x, last.current.y);
      ctx.stroke();
    }
    drawing.current = false;
    last.current = null;
    lastMid.current = null;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    setTooLittle(false);
  }

  /**
   * Take the ink, crop it, and hand it over as a transparent PNG.
   *
   * The crop is what makes a drawn signature usable: the image becomes the
   * strokes and nothing else, so the document can size it against the rule
   * rather than against however much of the pad somebody used.
   */
  function use() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const full = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // One byte per pixel: the alpha channel alone, which on a transparent pad
    // is exactly "is there ink here".
    const alpha = new Uint8ClampedArray(canvas.width * canvas.height);
    for (let i = 0; i < alpha.length; i += 1) alpha[i] = full.data[i * 4 + 3];

    const bounds = inkBounds(alpha, canvas.width, canvas.height, TRIM_PAD * dpr);
    if (!looksSigned(bounds, 24 * dpr) || !bounds) {
      // A STRAY TAP IS NOT A SIGNATURE, and saving one would put a full stop on
      // every credential issued under this design.
      setTooLittle(true);
      return;
    }

    const out = document.createElement('canvas');
    out.width = bounds.width;
    out.height = bounds.height;
    const octx = out.getContext('2d');
    if (!octx) return;
    octx.putImageData(
      ctx.getImageData(bounds.x, bounds.y, bounds.width, bounds.height), 0, 0,
    );
    onDone(out.toDataURL('image/png'));
  }

  return (
    <div className="rounded-xl border border-[#ded6c8] bg-white p-3 dark:border-[#3d3349] dark:bg-[#241d30]">
      <p className="text-[11px] font-semibold text-[#33234a] dark:text-[#e4dcf0]">
        Sign for {office || 'this office'}
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-[#8a8194]">
        Sign with a mouse, a finger or a stylus. The strokes are kept on their own — there is no
        paper behind them, so nothing prints as a white box over the frame.
      </p>

      {/* The rule to sign on, drawn under the pad rather than into it: a line
          painted on the canvas would be cropped and saved as part of the
          signature, and every certificate would carry two rules. */}
      <div className="relative mt-2">
        <canvas
          ref={canvasRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          onPointerCancel={up}
          aria-label={`Signing area for ${office || 'this office'}`}
          role="img"
          className="w-full cursor-crosshair touch-none rounded-lg border border-[#ded6c8] bg-white dark:border-[#3d3349]"
          style={{ aspectRatio: `${PAD_W} / ${PAD_H}` }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-[#c8c1d4]"
        />
      </div>

      {tooLittle && (
        <p role="status" className="mt-1.5 text-[11px] text-[#a07c12]">
          That is a mark rather than a signature — sign across the line and try again.
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-[#8a8194]">Ink</span>
        {INKS.map((pen) => (
          <button
            key={pen.value}
            onClick={() => setInk(pen.value)}
            aria-pressed={ink === pen.value}
            title={pen.label}
            className={`h-6 w-6 rounded-full border transition-transform ${FOCUS} ${
              ink === pen.value
                ? 'scale-110 border-[#422e59] ring-2 ring-[#422e59]/30 dark:border-[#c5a55a]'
                : 'border-[#ded6c8] hover:scale-105 dark:border-[#3d3349]'
            }`}
            style={{ background: pen.value }}
          >
            <span className="sr-only">{pen.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          onClick={use}
          disabled={!hasInk}
          className={`inline-flex items-center gap-1.5 rounded-xl bg-[#422e59] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 ${FOCUS}`}
        >
          <Check size={13} /> Use this signature
        </button>
        <button onClick={clear} className={`${BTN_SECONDARY} inline-flex items-center gap-1.5 text-xs`}>
          <Eraser size={13} /> Clear
        </button>
        <button onClick={onCancel} className={`${BTN_SECONDARY} inline-flex items-center gap-1.5 text-xs`}>
          <X size={13} /> Cancel
        </button>
      </div>
    </div>
  );
}
