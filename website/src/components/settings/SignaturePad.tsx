'use client';

// ---------------------------------------------------------------------------
// SIGNING ON THE SCREEN.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
//
// The University: "is it not good to create a signature pad where I can sign on
// the screen with a pen and store?"
//
// It is, and it removes an entire class of problem rather than fixing another
// instance of it. Uploading a signature means photographing paper, and every
// fault this screen has had came out of that: the sheet is white and opaque so
// it covered the rule; the ink was a fraction of the frame so the signature
// printed small; the lighting was uneven so a threshold had to be guessed at.
// The upload path now handles all of that — but it is handling damage that a
// pen on glass never does.
//
// A signature drawn here arrives as strokes on transparent ground, cropped to
// the ink, at the size the pen drew it. There is no paper to remove.
//
// ---------------------------------------------------------------------------
// WHAT MAKES IT LOOK LIKE A SIGNATURE RATHER THAN A MOUSE TRACK
// ---------------------------------------------------------------------------
//
// A finger or a stylus reports points every few milliseconds, and joining them
// with straight lines gives a polygon — recognisably not handwriting. Each
// segment is drawn as a quadratic curve through the midpoint of the last two
// points, which is the standard way to get a smooth line out of sampled input.
//
// AND THE STROKE TAPERS WITH SPEED where the device reports pressure or a
// stylus is in use. A pen leaves a thicker line when it moves slowly. Without
// it the result is a uniform tube and reads as a drawing.
//
// POINTER EVENTS, NOT MOUSE AND TOUCH. One set of handlers covers a mouse, a
// finger, an Apple Pencil and a Wacom, and `setPointerCapture` means a stroke
// that leaves the canvas mid-signature is still finished rather than abandoned.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BTN_GHOST } from '@/lib/portalTheme';
import { Eraser, Undo2, Check } from 'lucide-react';

/** The ink. Not black: a signature is a pen, and a pen is blue-black. */
const INK = '#12203f';

/**
 * Drawn at twice the display size so the stored image has pixels for a printer
 * to work with. The letter prints it at 15mm tall, and a canvas captured at CSS
 * resolution comes out soft on paper.
 */
const SCALE = 2;

interface Point { x: number; y: number; w: number }

export default function SignaturePad({
  onDone,
  disabled,
}: {
  /** Called with a PNG data URI cropped to the ink, or null when cleared. */
  onDone: (dataUri: string | null) => void;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // EVERY STROKE KEPT, so "undo the last one" is possible and so the whole
  // signature can be redrawn after a resize without being lost.
  const strokes = useRef<Point[][]>([]);
  const current = useRef<Point[]>([]);
  const [hasInk, setHasInk] = useState(false);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = INK;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of [...strokes.current, current.current]) {
      if (stroke.length === 0) continue;
      if (stroke.length === 1) {
        // A TAP IS A DOT. Without this a full stop or the dot of an "i" drawn
        // as a single touch leaves nothing at all.
        ctx.beginPath();
        ctx.arc(stroke[0].x, stroke[0].y, stroke[0].w / 2, 0, Math.PI * 2);
        ctx.fillStyle = INK;
        ctx.fill();
        continue;
      }
      // SEGMENT BY SEGMENT, because the width changes along the stroke and a
      // single path can only carry one lineWidth.
      for (let i = 1; i < stroke.length; i += 1) {
        const a = stroke[i - 1];
        const b = stroke[i];
        ctx.beginPath();
        ctx.lineWidth = (a.w + b.w) / 2;
        ctx.moveTo(a.x, a.y);
        if (i + 1 < stroke.length) {
          // Through the midpoint of the next segment: the curve is continuous
          // where two segments meet, which is what stops it looking like a
          // polygon.
          const c = stroke[i + 1];
          ctx.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2);
        } else {
          ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
      }
    }
  }, []);

  // THE CANVAS IS SIZED FROM ITS BOX, not from a constant, so it is the width
  // of the panel on a phone and on a desktop. Redrawn on resize because
  // changing a canvas's width clears it.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const fit = () => {
      const box = canvas.getBoundingClientRect();
      if (box.width === 0) return;
      canvas.width = Math.round(box.width * SCALE);
      canvas.height = Math.round(box.height * SCALE);
      paint();
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [paint]);

  const pointAt = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const box = canvas.getBoundingClientRect();
    const x = (e.clientX - box.left) * SCALE;
    const y = (e.clientY - box.top) * SCALE;

    // PRESSURE WHERE THE DEVICE REPORTS IT. A mouse reports 0.5 flat and a
    // finger usually does too, so this is a real taper on a stylus and a
    // constant everywhere else rather than a guess dressed up as one.
    const pressure = e.pressure > 0 && e.pressure !== 0.5 ? e.pressure : 0.5;
    return { x, y, w: 1.4 * SCALE * (0.55 + (pressure * 0.9)) };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    // CAPTURED, so a stroke that runs off the edge is still finished. Without
    // this the pointerup lands on the page and the stroke is left open.
    e.currentTarget.setPointerCapture(e.pointerId);
    current.current = [pointAt(e)];
    paint();
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || current.current.length === 0) return;
    e.preventDefault();
    const p = pointAt(e);
    const last = current.current[current.current.length - 1];
    // A MINIMUM DISTANCE, or a held-still pen accumulates hundreds of identical
    // points and the stored image grows for nothing.
    if (Math.hypot(p.x - last.x, p.y - last.y) < 1.2) return;
    current.current.push(p);
    paint();
  };

  const up = () => {
    if (current.current.length === 0) return;
    strokes.current.push(current.current);
    current.current = [];
    setHasInk(true);
    paint();
  };

  const clear = () => {
    strokes.current = [];
    current.current = [];
    setHasInk(false);
    paint();
    onDone(null);
  };

  const undo = () => {
    strokes.current.pop();
    const left = strokes.current.length > 0;
    setHasInk(left);
    paint();
    if (!left) onDone(null);
  };

  // -------------------------------------------------------------------------
  // CROPPED TO THE INK, exactly as an uploaded photograph is.
  //
  // The canvas is a wide box and the signature occupies part of it, so storing
  // the canvas would store the box — and the stylesheet fits the IMAGE to the
  // rule, which is how an uploaded signature came to print small. The same
  // trim, for the same reason.
  //
  // NO PAPER TO REMOVE, though: the ground here is already transparent, so
  // there is no threshold to guess at and no lighting to compensate for. That
  // is the whole advantage of signing on the screen.
  // -------------------------------------------------------------------------
  const take = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { width: w, height: h } = canvas;
    const px = ctx.getImageData(0, 0, w, h).data;
    let minX = w; let minY = h; let maxX = -1; let maxY = -1;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (px[(((y * w) + x) * 4) + 3] > 24) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) { onDone(null); return; }

    const pad = Math.max(2 * SCALE, Math.round((maxX - minX) * 0.02));
    const cx = Math.max(0, minX - pad);
    const cy = Math.max(0, minY - pad);
    const cw = Math.min(w - cx, (maxX - minX) + 1 + (pad * 2));
    const ch = Math.min(h - cy, (maxY - minY) + 1 + (pad * 2));

    const out = document.createElement('canvas');
    out.width = cw;
    out.height = ch;
    const octx = out.getContext('2d');
    if (!octx) return;
    octx.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
    onDone(out.toDataURL('image/png'));
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <canvas
          ref={canvasRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          className="touch-none rounded-xl border border-[#ded6c8] bg-white dark:border-[#3d3349]"
          // ---------------------------------------------------------------
          // THE CSS SIZE IS SET HERE, NOT LEFT TO A CLASS.
          //
          // `fit()` sets `canvas.width` from the element's measured box, and a
          // canvas with no CSS size takes its layout size FROM that attribute —
          // so the two chase each other: measure 520, set the backing store to
          // 1040, which makes the element 1040 wide, which sets it to 2080. In
          // a test harness with no stylesheet it reached 76,800 pixels wide and
          // the browser ran out of memory allocating the image data.
          //
          // In the running portal Tailwind's `w-full h-[160px]` pinned the CSS
          // size and the loop never started, so this was invisible — and would
          // have stayed invisible until a stylesheet failed to load or somebody
          // renamed a class. A component should not depend on a class for its
          // correctness when one line of style removes the question.
          // ---------------------------------------------------------------
          style={{
            width: '100%',
            height: 160,
            cursor: disabled ? 'not-allowed' : 'crosshair',
          }}
        />
        {/* THE RULE IS DRAWN ON THE PAD ITSELF, so the signature is written at
            the size and position it will be printed at, rather than floating in
            an empty box and being scaled afterwards into a surprise. */}
        <div className="pointer-events-none absolute inset-x-6 bottom-9 border-t border-[#c9c0b4]" />
        {!hasInk && (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-[#a49bb0]">
            Sign above the line — a finger, a stylus or a mouse
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN_GHOST} onClick={undo} disabled={!hasInk || disabled}>
          <Undo2 size={14} /> Undo the last stroke
        </button>
        <button type="button" className={BTN_GHOST} onClick={clear} disabled={!hasInk || disabled}>
          <Eraser size={14} /> Clear
        </button>
        <button type="button" className={BTN_GHOST} onClick={take} disabled={!hasInk || disabled}>
          <Check size={14} /> Use this signature
        </button>
      </div>
    </div>
  );
}
