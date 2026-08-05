'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Counts a formatted figure up when it first scrolls into view.
 *
 * Takes the display string straight from content ("7,228", "15", "1,742")
 * so the separators and any suffix survive; only the digits animate. Users
 * who prefer reduced motion, and anyone without JS, see the final value.
 */
export default function CountUp({
  value,
  duration = 1600,
  className = '',
}: {
  value: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const target = Number(value.replace(/[^\d]/g, ''));
    if (!Number.isFinite(target) || target === 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const prefix = value.slice(0, value.search(/\d/));
    const suffix = value.slice(value.search(/\d(?=[^\d]*$)/) + 1);
    const grouped = value.includes(',');

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();

        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          // easeOutExpo — fast off the mark, settles precisely on the figure.
          const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
          const n = Math.round(target * eased);
          setDisplay(prefix + (grouped ? n.toLocaleString('en-US') : String(n)) + suffix);
          if (t < 1) requestAnimationFrame(tick);
          else setDisplay(value);
        };
        setDisplay(prefix + '0' + suffix);
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref} className={`tabular ${className}`}>
      {display}
    </span>
  );
}
