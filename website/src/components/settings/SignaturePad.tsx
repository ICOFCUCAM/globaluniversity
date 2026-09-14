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
// A signature drawn here arrives as strokes on transparent ground at the size
// the pen drew them. There is no paper to remove.
//
// ---------------------------------------------------------------------------
// AND IT OPENS OUT
// ---------------------------------------------------------------------------
//
// "We should be able to expand the signature pad, sign and save to return to
// normal."
//
// Right: nobody signs their name properly in a 160-pixel strip, least of all
// with a mouse. Expanded it is most of the screen, which is roughly the size a
// hand actually signs at.
//
// WHICH IS WHY EVERY POINT IS STORED AS A FRACTION OF THE PAD rather than in
// pixels. Pixel coordinates belong to one canvas size, so expanding would
// either discard what was already drawn or stretch it out of shape; a fraction
// means the same signature renders identically at any size, and expanding and
// returning is lossless. The pad also keeps ONE ASPECT RATIO in both modes, so
// what is drawn large is the same shape when it comes back small — a pad that
// changed proportion would reward signing expanded with a signature squashed.
//
// ---------------------------------------------------------------------------
// WHAT MAKES IT LOOK LIKE A SIGNATURE RATHER THAN A MOUSE TRACK
// ---------------------------------------------------------------------------
//
// A finger or a stylus reports points every few milliseconds, and joining them
// with straight lines gives a polygon — recognisably not handwriting. Each
// segment is drawn as a quadratic curve through the midpoint of the next, which
// is continuous where two segments meet.
//
// AND THE STROKE TAPERS WITH PRESSURE where the device reports it. A pen leaves
// a thicker line when it presses harder. Without it the result is a uniform
// tube and reads as a drawing.
//
// POINTER EVENTS, NOT MOUSE AND TOUCH. One set of handlers covers a mouse, a
// finger, an Apple Pencil and a Wacom, and `setPointerCapture` means a stroke
// that leaves the canvas mid-signature is still finished rather than abandoned.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BTN_GHOST, BTN_PRIMARY } from '@/lib/portalTheme';
import {
  Eraser, Undo2, Check, Maximize2, X,
} from 'lucide-react';

/** The ink. Not black: a signature is a pen, and a pen is blue-black. */
const INK = '#12203f';

/**
 * Drawn at twice the display size so the stored image has pixels for a printer
 * to work with. The letter prints it at 15mm tall, and a canvas captured at CSS
 * resolution comes out soft on paper.
 */
const SCALE = 2;

/**
 * Width ÷ height, held the same in both modes.
 *
 * A signature written across a wide shallow box and then replayed into a
 * squarer one is a different signature. Keeping the ratio fixed is what lets
 * somebody sign expanded and get back exactly that.
 */
const ASPECT = 3.4;


/** A point, in FRACTIONS of the pad: 0–1 across and down. See the header. */
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
  // EVERY STROKE KEPT, so the last one can be undone and so the whole signature
  // can be redrawn at a new size without being lost.
  const strokes = useRef<Point[][]>([]);
  const current = useRef<Point[]>([]);
  const [hasInk, setHasInk] = useState(false);
  const [big, setBig] = useState(false);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { width: W, height: H } = canvas;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // FRACTIONS BACK INTO PIXELS. The nib scales with the pad's width so a
    // signature drawn expanded has the same relative weight when it returns.
    const px = (p: Point) => ({ x: p.x * W, y: p.y * H, w: p.w * W });

    for (const stroke of [...strokes.current, current.current]) {
      if (stroke.length === 0) continue;
      if (stroke.length === 1) {
        // A TAP IS A DOT. Without this a full stop, or the dot of an "i" made
        // as a single touch, leaves nothing at all.
        const a = px(stroke[0]);
        ctx.beginPath();
        ctx.arc(a.x, a.y, Math.max(a.w / 2, 1), 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      // SEGMENT BY SEGMENT, because the width changes along the stroke and one
      // path can only carry one lineWidth.
      for (let i = 1; i < stroke.length; i += 1) {
        const a = px(stroke[i - 1]);
        const b = px(stroke[i]);
        ctx.beginPath();
        ctx.lineWidth = Math.max((a.w + b.w) / 2, 1);
        ctx.moveTo(a.x, a.y);
        if (i + 1 < stroke.length) {
          const c = px(stroke[i + 1]);
          ctx.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2);
        } else {
          ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
      }
    }
  }, []);

  // THE BACKING STORE IS SIZED FROM THE ELEMENT'S BOX, and the element's CSS
  // size is set in `style` below rather than left to a class — see the note
  // there. Redrawn on every resize, because changing a canvas's width clears
  // it, and because expanding is a resize.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const fit = () => {
      const box = canvas.getBoundingClientRect();
      if (box.width === 0) return;
      const w = Math.round(box.width * SCALE);
      const h = Math.round(box.height * SCALE);
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      paint();
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [paint, big]);

  // ESCAPE CLOSES IT. A full-screen panel with no key to leave by is a panel
  // somebody reloads the page to escape, losing the signature they just drew.
  useEffect(() => {
    if (!big) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setBig(false); };
    window.addEventListener('keydown', onKey);
    // The page behind must not scroll under a pad somebody is signing on.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [big]);

  const pointAt = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const box = e.currentTarget.getBoundingClientRect();
    // PRESSURE WHERE THE DEVICE REPORTS IT. A mouse reports 0.5 flat and most
    // fingers do too, so this is a real taper on a stylus and a constant
    // elsewhere, rather than a guess dressed up as one.
    const pressure = e.pressure > 0 && e.pressure !== 0.5 ? e.pressure : 0.5;
    return {
      x: (e.clientX - box.left) / box.width,
      y: (e.clientY - box.top) / box.height,
      // As a fraction of the pad's width, so the nib scales with the pad.
      w: 0.0032 * (0.55 + (pressure * 0.9)),
    };
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
    // A MINIMUM DISTANCE, or a pen held still piles up hundreds of identical
    // points and the stored image grows for nothing. In fractions, so it is the
    // same real distance whatever size the pad is.
    if (Math.hypot(p.x - last.x, (p.y - last.y) / ASPECT) < 0.0015) return;
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
  // The pad is a wide box and the signature occupies part of it, so storing the
  // canvas would store the box — and the stylesheet fits the IMAGE to the rule,
  // which is how an uploaded signature came to print small. The same trim, for
  // the same reason.
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
    // SIGN, SAVE, AND COME BACK. The University asked for exactly this: the
    // expanded pad closes on taking the signature rather than leaving somebody
    // hunting for the way out of a full-screen panel.
    setBig(false);
  };

  const controls = (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={big ? BTN_PRIMARY : BTN_GHOST}
        onClick={take} disabled={!hasInk || disabled}>
        <Check size={14} /> {big ? 'Save and close' : 'Use this signature'}
      </button>
      <button type="button" className={BTN_GHOST} onClick={undo} disabled={!hasInk || disabled}>
        <Undo2 size={14} /> Undo the last stroke
      </button>
      <button type="button" className={BTN_GHOST} onClick={clear} disabled={!hasInk || disabled}>
        <Eraser size={14} /> Clear
      </button>
      {!big && (
        <button type="button" className={BTN_GHOST} onClick={() => setBig(true)} disabled={disabled}>
          <Maximize2 size={14} /> Open it larger
        </button>
      )}
    </div>
  );

  // THE PAD ITSELF, drawn once and placed in whichever frame is showing. Two
  // copies would mean two canvases and a signature that vanished on expanding.
  const pad = () => (
    // `position: relative` INLINE, for the third time in this file and the same
    // reason each time: the guide line below is positioned against this box, so
    // without it the line lands against the viewport instead. Geometry a
    // component needs to be correct does not belong in a class it can only hope
    // is loaded.
    <div style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className="touch-none"
        // ---------------------------------------------------------------
        // THE CSS SIZE IS SET HERE, NOT LEFT TO A CLASS.
        //
        // `fit()` sets `canvas.width` from the element's measured box, and a
        // canvas with no CSS size takes its LAYOUT size FROM that attribute —
        // so the two chase each other: measure 520, set the backing store to
        // 1040, which makes the element 1040 wide, which sets it to 2080. In a
        // test harness with no stylesheet it reached 76,800 pixels wide and the
        // browser ran out of memory allocating the image data.
        //
        // In the running portal Tailwind's classes pinned the CSS size and the
        // loop never started, so this was invisible — and would have stayed
        // invisible until a stylesheet failed to load or somebody renamed a
        // class. A component should not depend on a class for its correctness
        // when one line of style removes the question.
        // ---------------------------------------------------------------
        // THE HEIGHT FOLLOWS THE WIDTH AT ONE RATIO, in both modes. That is
        // what makes expanding lossless: the points are fractions of the pad,
        // so they only replay faithfully into a pad of the same shape.
        style={{
          display: 'block',
          width: '100%',
          aspectRatio: String(ASPECT),
          // WHITE IN BOTH THEMES, because it is paper. A signing surface that
          // follows the interface into dark mode asks somebody to sign in
          // white ink on black and then prints it on a white letter.
          background: '#ffffff',
          border: '1px solid #ded6c8',
          borderRadius: 12,
          cursor: disabled ? 'not-allowed' : 'crosshair',
        }}
      />
      {/* THE RULE IS DRAWN ON THE PAD, so the signature is written at the
          position it will be printed at rather than floating in an empty box
          and being placed afterwards. Proportional, so it sits in the same
          place whatever size the pad is. */}
      <div style={{
        position: 'absolute', pointerEvents: 'none',
        left: '6%', right: '6%', bottom: '22%',
        borderTop: '1px solid #c9c0b4',
      }} />
      {!hasInk && (
        <p style={{
          position: 'absolute', pointerEvents: 'none',
          left: 0, right: 0, bottom: '8%',
          textAlign: 'center', fontSize: 12, color: '#a49bb0', margin: 0,
        }}>
          Sign above the line — a finger, a stylus or a mouse
        </p>
      )}
    </div>
  );

  if (big) {
    // FULL SCREEN, and the pad inside it keeps the ordinary aspect ratio. A pad
    // that filled the window would be a different shape from the one it returns
    // to, and a signature drawn in it would come back squashed.
    return (
      <div
        className="bg-[#f7f4ee] dark:bg-[#17131d]"
        role="dialog" aria-modal="true" aria-label="Sign your name"
        // ---------------------------------------------------------------
        // THE GEOMETRY IS INLINE, LIKE THE CANVAS'S. Same reason, and it was
        // the same bug twice: written as Tailwind classes, the panel expanded
        // only where a stylesheet happened to be loaded, and under measurement
        // it rendered as an ordinary block the same width as the pad it was
        // supposed to be enlarging. A full-screen panel that quietly is not
        // full screen looks exactly like a full-screen panel to source code.
        // ---------------------------------------------------------------
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline',
          justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h3 className="font-heading text-lg font-bold text-[#422e59] dark:text-[#e4dcf0]">
              Sign your name
            </h3>
            <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
              Sign as you would on paper. Saving brings you back, with the signature ready to
              store — nothing is kept until you store it.
            </p>
          </div>
          <button type="button" className={BTN_GHOST} onClick={() => setBig(false)}>
            <X size={14} /> Close
          </button>
        </div>

        <div style={{
          display: 'flex', flex: '1 1 auto', minHeight: 0,
          alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Bounded so the pad does not become a letterbox on a wide monitor,
              and so its height always follows its width at the one ratio. */}
          <div style={{ width: '100%', maxWidth: `calc(70vh * ${ASPECT})` }}>
            {pad()}
          </div>
        </div>

        {controls}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pad()}
      {controls}
    </div>
  );
}
