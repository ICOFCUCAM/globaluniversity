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
  // Is the band directly behind the rail a dark one? See below: the rail is
  // FIXED, so it cannot inherit anything from the section it happens to be
  // floating over, and it has to work this out for itself.
  const [onDark, setOnDark] = useState(false);
  // Nothing is a chapter yet while the reader is still in the hero.
  const [started, setStarted] = useState(false);
  const frame = useRef(0);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-chapter]'));
    setChapters(nodes.map((n, i) => ({ id: n.id || `chapter-${i}`, label: n.dataset.chapter ?? '' })));
    nodes.forEach((n, i) => {
      if (!n.id) n.id = `chapter-${i}`;
    });
    const darkBands = Array.from(document.querySelectorAll<HTMLElement>('[data-on-dark]'));

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

        // The rail sits at the vertical middle of the viewport, so the band it
        // is drawn over is whichever one contains that point. getBoundingClientRect
        // is viewport-relative and reflows nothing here; there are a handful of
        // dark bands, and this runs inside the same rAF as everything else.
        const y = window.innerHeight / 2;
        setOnDark(darkBands.some((b) => {
          const r = b.getBoundingClientRect();
          return r.top <= y && r.bottom >= y;
        }));

        // The rail indexes the chapters. While the reader is still in the hero
        // they have not reached the first one, and a rail that reports "At a
        // glance" as the current chapter before that section is on screen is
        // simply lying about where they are.
        setStarted(nodes.length > 0 && window.scrollY + window.innerHeight * 0.55 >= nodes[0].offsetTop);
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
      className={`pointer-events-none fixed right-6 top-1/2 z-30 hidden -translate-y-1/2 transition-opacity duration-500 lg:block ${
        started ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="relative flex flex-col items-end gap-3">
        {/* Track and fill.
            WHY THE PALETTE IS COMPUTED RATHER THAN INHERITED. This element is
            position:fixed, so it is not inside the section it appears to be on
            top of and no amount of CSS inheritance can tell it what colour that
            section is. Drawn in brand-purple throughout, it wrote dark purple
            over the dark purple hero and over every other [data-on-dark] band:
            a faint ghost of a label that read as a rendering fault rather than
            as an index. */}
        <span className={`absolute right-[3px] top-0 h-full w-px ${onDark ? 'bg-white/20' : 'bg-brand-purple/12'}`} />
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
                i === active ? 'translate-x-0 opacity-100' : 'translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-70'
              } ${
                onDark
                  ? i === active ? 'text-brand-gold' : 'text-white/70'
                  : i === active ? 'text-brand-purple' : 'text-brand-muted'
              }`}
            >
              {c.label}
            </span>
            <span
              className={`block rounded-full transition-all duration-300 ${
                i === active
                  ? `h-2.5 w-2.5 ring-4 ${onDark ? 'bg-brand-gold ring-brand-gold/20' : 'bg-brand-gold-deep ring-brand-gold/25'}`
                  : onDark
                    ? 'h-1.5 w-1.5 bg-white/30 group-hover:bg-white/60'
                    : 'h-1.5 w-1.5 bg-brand-purple/25 group-hover:bg-brand-purple/50'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
