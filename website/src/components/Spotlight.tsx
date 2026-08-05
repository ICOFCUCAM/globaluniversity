'use client';

import { useRef, type ReactNode } from 'react';

/**
 * SpotlightGroup — pointer-tracked illumination across a set of cards.
 *
 * One listener on the container, not one per card. On pointer move it writes
 * --mx / --my (viewport-relative, resolved per card in CSS) onto each child
 * via a single custom property on the group, and each card renders a radial
 * highlight positioned from those variables. The effect: a light source that
 * travels with the cursor and grazes the edges of neighbouring cards, rather
 * than N independent hover states switching on and off.
 *
 * Everything happens in CSS custom properties, so React never re-renders and
 * the browser only repaints a background-image. Touch devices never fire
 * pointermove, so they simply get the static card.
 */
export function SpotlightGroup({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'touch') return;
    const el = ref.current;
    if (!el) return;
    // Coalesce to one write per animation frame; pointermove can fire far
    // more often than the display refreshes.
    if (frame.current) return;
    const { clientX, clientY } = e;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--gx', `${clientX - r.left}px`);
      el.style.setProperty('--gy', `${clientY - r.top}px`);
    });
  }

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={() => ref.current?.style.setProperty('--go', '0')}
      onPointerEnter={() => ref.current?.style.setProperty('--go', '1')}
      className={`spotlight-group ${className}`}
      style={{ ['--go' as string]: '0' }}
    >
      {children}
    </div>
  );
}

/**
 * SpotlightCard — a surface that catches the group's light.
 * `tone` picks the highlight colour for dark vs light grounds.
 */
export function SpotlightCard({
  children,
  className = '',
  tone = 'dark',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'dark' | 'light';
}) {
  const glow =
    tone === 'dark'
      ? 'rgba(247,220,121,0.16)'
      : 'rgba(87,84,154,0.13)';
  const edge =
    tone === 'dark'
      ? 'rgba(247,220,121,0.55)'
      : 'rgba(233,193,74,0.75)';

  return (
    <div className={`spotlight-card group/sc relative ${className}`}>
      {/* Illuminated fill */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[var(--go,0)] transition-opacity duration-500"
        style={{
          background: `radial-gradient(340px circle at var(--gx, 50%) var(--gy, 50%), ${glow}, transparent 65%)`,
        }}
      />
      {/* Illuminated border — masked so only the 1px rim lights up */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[var(--go,0)] transition-opacity duration-500"
        style={{
          padding: '1px',
          background: `radial-gradient(240px circle at var(--gx, 50%) var(--gy, 50%), ${edge}, transparent 60%)`,
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />
      {children}
    </div>
  );
}
