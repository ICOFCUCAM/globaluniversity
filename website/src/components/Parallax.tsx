'use client';

import { useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// A slow parallax drift for section photography.
//
// WHY IT IS WORTH THE CODE. Everything on this page below the hero was
// perfectly static, and a page where nothing responds to the scroll reads as a
// document rather than a place. The effect wanted here is not a visible one — a
// picture that slides noticeably is a picture competing with the paragraph next
// to it — but the sense that the image sits at a slightly different depth from
// the type.
//
// WHY NOT `background-attachment: fixed`. It is the one-line version and it is
// broken on iOS, ignored inside any element with a transform, and forces a
// full-surface repaint on every scroll frame on the browsers where it does
// work. This translates a transform instead, which the compositor handles
// without touching layout or paint.
//
// WHY IntersectionObserver AND NOT A PLAIN SCROLL LISTENER. A listener runs for
// every section on the page whether or not it is anywhere near the viewport.
// The observer switches the work off entirely when the element is off-screen,
// which on this homepage is most of them most of the time.
//
// REDUCED MOTION IS HONOURED, and honoured properly: the effect is not merely
// slowed, it never starts, and the image is left at its resting offset. Somebody
// who has asked their operating system for less movement has usually asked
// because movement makes them ill.
// ---------------------------------------------------------------------------

export default function Parallax({
  children,
  className = '',
  /**
   * How far the image travels across a full pass through the viewport, in
   * pixels. Deliberately small. The child should be scaled slightly larger than
   * its frame so the travel never exposes an edge — see the callers, which use
   * `scale-[1.12]`.
   */
  distance = 42,
}: {
  children: React.ReactNode;
  className?: string;
  distance?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let visible = false;

    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // -1 when the element is just below the fold, +1 when just above it.
      const progress = (rect.top + rect.height / 2 - vh / 2) / (vh / 2 + rect.height / 2);
      setOffset(Math.max(-1, Math.min(1, progress)) * (distance / 2));
    };

    const onScroll = () => {
      if (!visible || raf) return;
      raf = requestAnimationFrame(update);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) update();
      },
      { rootMargin: '120px' },
    );
    io.observe(el);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [distance]);

  return (
    <div ref={ref} className={className}>
      <div
        className="h-full w-full will-change-transform"
        style={{ transform: `translate3d(0, ${offset}px, 0)` }}
      >
        {children}
      </div>
    </div>
  );
}
