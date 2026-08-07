'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Grain } from '@/components/Atmosphere';

// ---------------------------------------------------------------------------
// A PINNED SCENE — the photograph holds, then the next layer crosses it.
//
// ===========================================================================
// THE MECHANIC, AND WHY IT IS MOSTLY NOT JAVASCRIPT
// ===========================================================================
//
// IMAGE → SCROLL → NEXT LAYER CROSSES THE IMAGE → NEW SCENE.
//
// The whole cut is three rules of CSS:
//
//   this section is TALLER than the viewport      (h-[170svh])
//   its only child is sticky at the top           (sticky top-0 h-[100svh])
//   the section AFTER it is positioned and opaque (relative z-10 + a background)
//
// The photograph pins while the reader scrolls the extra height, and then the
// following section — which is a later sibling in the same stacking context —
// paints over it and slides up across the held frame. The image does not move;
// the page moves past it. That is what makes it read as a cut between shots
// rather than as two rectangles meeting.
//
// The third rule is the one that silently fails. A section with a background
// but NO position paints in the block-background layer, which is UNDERNEATH
// every positioned element — so the pinned frame would sit on top of the very
// section meant to cover it, and the page would look broken in a way that is
// genuinely hard to diagnose. `data-crosses` on the following section is how
// that requirement is made visible, and pinned.test.mjs fails the build if a
// pinned scene is followed by a section that cannot cross it.
//
// ===========================================================================
// WHAT THE JAVASCRIPT IS ACTUALLY FOR
// ===========================================================================
//
// Nothing structural. The pin, the cross and the order all work with scripting
// off — which matters, because a homepage whose narrative depends on hydration
// is a homepage that is blank on a slow connection.
//
// The script adds two things, both of which are polish and both of which
// degrade to nothing:
//
//   A SLOW PUSH IN. The photograph scales from 1.00 to about 1.06 across the
//   pin. Real, but under half a percent per hundred pixels of scroll — a
//   cinematographer's push, not a zoom. It is what stops a held frame from
//   looking like a stalled page.
//
//   A RECEDE. Over the last third of the pin the frame dims and drops a few
//   pixels, so the outgoing image reads as moving BEHIND the arriving layer
//   rather than being wiped by it. Without this the cut is technically correct
//   and emotionally flat: two things at the same depth, one covering the other.
//
// Both are transform and opacity only — compositor properties, no layout, no
// paint. One listener, one rAF, and it unsubscribes when the scene is off
// screen, so a page carrying five of these is doing work for at most one.
//
// ===========================================================================
// REDUCED MOTION
// ===========================================================================
//
// A pin is not motion. Nothing translates against the reader's scroll, nothing
// moves that they did not move; the frame simply stays while the page goes
// past, which is what a sticky table header does. So the pin and the cross are
// kept under prefers-reduced-motion.
//
// The push-in and the recede ARE motion and are both dropped — scale against
// scroll is exactly the parallax-adjacent effect that provokes vestibular
// symptoms. What remains is a still photograph, held, then covered.
// ---------------------------------------------------------------------------

export interface PinnedSceneProps {
  src: string;
  alt: string;
  /**
   * Total height in svh. The pin lasts (hold − 100) of scrolling, so 170 gives
   * about two thirds of a screen of held frame. Below ~140 the pin is too brief
   * to register as a held shot and just reads as a slow section.
   */
  hold?: number;
  focal?: string;
  priority?: boolean;
  /** 0–1. How much photograph survives the scrim. */
  exposure?: number;
  /** Where the copy sits, and so where the scrim is heaviest. */
  anchor?: 'left' | 'right' | 'centre';
  chapter?: string;
  className?: string;
  children: React.ReactNode;
}

function scrim(anchor: NonNullable<PinnedSceneProps['anchor']>, exposure: number): string {
  // The dark stop is HELD across the full width the copy occupies before it
  // falls. See Formation.tsx: gold is a light ink and needs a genuinely dark
  // ground, which a gradient that starts ramping at the first pixel cannot give
  // it. The copy column is half the viewport, so the hold runs to 56%.
  const deep = `rgba(14,7,28,${(0.94 - exposure * 0.30).toFixed(3)})`;
  const mid = `rgba(20,11,38,${(0.66 - exposure * 0.28).toFixed(3)})`;
  const open = `rgba(29,16,52,${(0.26 - exposure * 0.18).toFixed(3)})`;
  if (anchor === 'right') {
    return `linear-gradient(260deg, ${deep} 0%, ${deep} 56%, ${mid} 76%, ${open} 94%, ${open} 100%)`;
  }
  if (anchor === 'centre') {
    return `radial-gradient(ellipse 108% 94% at 50% 50%, ${deep} 0%, ${deep} 46%, ${mid} 74%, ${open} 100%)`;
  }
  return `linear-gradient(100deg, ${deep} 0%, ${deep} 56%, ${mid} 76%, ${open} 94%, ${open} 100%)`;
}

export default function PinnedScene({
  src,
  alt,
  hold = 170,
  focal = '50% 38%',
  priority = false,
  exposure = 0.5,
  anchor = 'left',
  chapter,
  className = '',
  children,
}: PinnedSceneProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [p, setP] = useState(0);
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    let live = false;

    const read = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      if (travel <= 0) return;
      setP(Math.min(Math.max(-r.top / travel, 0), 1));
    };
    const onScroll = () => {
      if (frame || !live) return;
      frame = requestAnimationFrame(read);
    };

    // Only listen while the scene is anywhere near the viewport. A page with
    // five pinned scenes should not run five scroll handlers the whole way
    // down it.
    const io = new IntersectionObserver(
      ([entry]) => {
        live = entry.isIntersecting;
        if (live) read();
      },
      { rootMargin: '120px' },
    );
    io.observe(el);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      io.disconnect();
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [reduced]);

  // The recede: nothing for the first two thirds, then the frame dims and sinks
  // as the next layer arrives over it.
  const exit = Math.max(0, (p - 0.66) / 0.34);

  return (
    <section
      ref={ref}
      data-on-dark=""
      data-chapter={chapter}
      data-pinned=""
      className={`relative z-0 bg-brand-purple-dark text-white ${className}`}
      style={{ height: `${hold}svh` }}
    >
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 will-change-transform"
          style={
            reduced
              ? undefined
              : { transform: `scale(${(1 + p * 0.06).toFixed(4)}) translateY(${(exit * 14).toFixed(1)}px)` }
          }
        >
          <Image
            src={src}
            alt={alt}
            fill
            sizes="100vw"
            quality={82}
            priority={priority}
            loading={priority ? undefined : 'lazy'}
            className="object-cover"
            style={{ objectPosition: focal }}
          />
        </div>

        <div aria-hidden="true" className="absolute inset-0 -z-10" style={{ background: scrim(anchor, exposure) }} />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-brand-purple/25 mix-blend-multiply" />
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <Grain opacity={0.075} />
        </div>
        {/* The receding veil. Zero for most of the pin. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-brand-purple-dark"
          style={{ opacity: reduced ? 0 : exit * 0.5 }}
        />

        {/* THE COPY MUST SIT WHERE THE SCRIM IS DARKEST.
            The first version of this took an `anchor` prop, used it to aim the
            scrim, and then laid the copy out the same way whichever value it
            was given — so anchor="right" darkened the right of the frame and
            put the words on the left, over the brightest part of the
            photograph. It looked plausible in a screenshot and was exactly
            backwards. Placement and scrim now read the same prop. */}
        <div
          className={`relative mx-auto flex w-full max-w-7xl px-6 sm:px-10 lg:px-16 ${
            anchor === 'right' ? 'justify-end' : anchor === 'centre' ? 'justify-center' : 'justify-start'
          }`}
          style={
            reduced
              ? undefined
              : { opacity: 1 - exit * 0.85, transform: `translateY(${(exit * -10).toFixed(1)}px)` }
          }
        >
          <div className={anchor === 'centre' ? 'max-w-4xl text-center' : 'max-w-2xl'}>{children}</div>
        </div>
      </div>
    </section>
  );
}
