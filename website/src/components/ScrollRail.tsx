'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * ScrollRail — a fixed vertical index of the page's sections.
 *
 * Reads the [data-chapter] sections already in the markup, tracks which one
 * holds the viewport's midpoint, and renders a rail of nodes on the right
 * edge that fills as the reader descends. Clicking a node scrolls to it.
 *
 * Rendered only at lg and above, only when there are enough sections to be
 * useful, and hidden entirely from assistive technology — this is an
 * ambient orientation aid layered over navigation that already exists in the
 * header, not a second nav to maintain.
 */
export default function ScrollRail() {
  const [chapters, setChapters] = useState<{ id: string; label: string }[]>([]);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-chapter]'));
    setChapters(nodes.map((n, i) => ({ id: n.id || `chapter-${i}`, label: n.dataset.chapter ?? '' })));
    nodes.forEach((n, i) => {
      if (!n.id) n.id = `chapter-${i}`;
    });

    const onScroll = () => {
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        const mid = window.scrollY + window.innerHeight / 2;
        let idx = 0;
        nodes.forEach((n, i) => {
          if (n.offsetTop <= mid) idx = i;
        });
        setActive(idx);
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
      });
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  if (chapters.length < 4) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed right-6 top-1/2 z-30 hidden -translate-y-1/2 lg:block"
    >
      <div className="relative flex flex-col items-end gap-3">
        {/* Track and fill */}
        <span className="absolute right-[3px] top-0 h-full w-px bg-brand-purple/12" />
        <span
          className="absolute right-[3px] top-0 w-px origin-top bg-gradient-to-b from-brand-gold to-brand-gold-deep transition-transform duration-200"
          style={{ height: '100%', transform: `scaleY(${progress})` }}
        />

        {chapters.map((c, i) => (
          <button
            key={c.id}
            onClick={() => document.getElementById(c.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="pointer-events-auto group flex items-center gap-2.5"
            tabIndex={-1}
          >
            <span
              className={`whitespace-nowrap font-sans text-[9px] font-bold uppercase tracking-[0.16em] transition-all duration-300 ${
                i === active
                  ? 'translate-x-0 text-brand-purple opacity-100'
                  : 'translate-x-2 text-brand-muted opacity-0 group-hover:translate-x-0 group-hover:opacity-70'
              }`}
            >
              {c.label}
            </span>
            <span
              className={`block rounded-full transition-all duration-300 ${
                i === active
                  ? 'h-2.5 w-2.5 bg-brand-gold-deep ring-4 ring-brand-gold/25'
                  : 'h-1.5 w-1.5 bg-brand-purple/25 group-hover:bg-brand-purple/50'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
