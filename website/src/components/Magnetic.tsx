'use client';

import { useRef, type ReactNode } from 'react';

/**
 * Magnetic — a control that leans toward the cursor as it approaches.
 *
 * Translation is capped at `strength` pixels and eased by distance from the
 * button's centre, so it reads as attraction rather than as the element
 * chasing the pointer. Writes a transform directly to the node inside a
 * single rAF; React never re-renders.
 *
 * Skipped for touch pointers and for reduced-motion users, both of whom get
 * an ordinary button.
 */
export default function Magnetic({
  children,
  strength = 10,
  className = '',
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const frame = useRef(0);

  function move(e: React.PointerEvent<HTMLSpanElement>) {
    if (e.pointerType === 'touch') return;
    const el = ref.current;
    if (!el || frame.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const { clientX, clientY } = e;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const r = el.getBoundingClientRect();
      const dx = (clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (clientY - (r.top + r.height / 2)) / (r.height / 2);
      el.style.transform = `translate3d(${Math.max(-1, Math.min(1, dx)) * strength}px, ${
        Math.max(-1, Math.min(1, dy)) * strength * 0.7
      }px, 0)`;
    });
  }

  function reset() {
    const el = ref.current;
    if (el) el.style.transform = 'translate3d(0,0,0)';
  }

  return (
    <span
      ref={ref}
      onPointerMove={move}
      onPointerLeave={reset}
      className={`inline-block will-change-transform ${className}`}
      style={{ transition: 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)' }}
    >
      {children}
    </span>
  );
}
