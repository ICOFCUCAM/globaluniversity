'use client';

import { useEffect, useRef, type ElementType } from 'react';

/**
 * KineticText — a heading that assembles word by word as it enters view.
 *
 * Each word is wrapped in a masked span and rises from beneath its own
 * baseline, so the line resolves like type being set rather than a block
 * fading in. The stagger is small (55ms) and the whole phrase completes
 * inside 600ms; anything slower reads as a loading state, not a flourish.
 *
 * The full string is always present in the DOM as real text — the animation
 * is applied to wrappers, so nothing is hidden from search engines or from a
 * screen reader, and prefers-reduced-motion simply shows the finished line.
 */
export default function KineticText({
  children,
  as: Tag = 'h2',
  className = '',
  delay = 0,
  stagger = 55,
}: {
  children: string;
  as?: ElementType;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const words = children.split(' ');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parts = Array.from(el.querySelectorAll<HTMLElement>('[data-kw]'));

    const settle = () => parts.forEach((w) => (w.style.transform = 'translateY(0)'));

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      settle();
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        parts.forEach((w, i) => {
          w.style.transitionDelay = `${delay + i * stagger}ms`;
          w.style.transform = 'translateY(0)';
        });
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay, stagger, children]);

  return (
    <Tag ref={ref} className={className}>
      {words.map((word, i) => (
        // Outer span clips; inner span is the thing that travels. The trailing
        // space lives outside the mask so word spacing stays correct.
        <span key={`${word}-${i}`} className="inline-block overflow-hidden align-bottom">
          <span
            data-kw=""
            className="inline-block will-change-transform"
            style={{
              transform: 'translateY(110%)',
              transition: 'transform 0.62s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {word}
          </span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </Tag>
  );
}
