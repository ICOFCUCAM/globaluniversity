'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Grain } from '@/components/Atmosphere';

// ---------------------------------------------------------------------------
// THE KNOWLEDGE — four faculties, one at a time, at the size of a title card.
//
// ===========================================================================
// WHAT THIS REPLACES
// ===========================================================================
//
// Four cards in a two-by-two grid, each with a photograph in a rounded corner,
// a name, a paragraph and an "Explore" link. 1.77 screens of catalogue.
//
// A grid of four says "here are our four departments, pick one". That is a menu.
// It is the correct figure for a directory page and the wrong one for a
// homepage, where the reader has not yet been given a reason to care which
// faculty is which. What a homepage owes them is the sense that each of these
// is a serious place — and four things shown at once cannot be serious, because
// seriousness is mostly a function of how much room a thing is given.
//
// ===========================================================================
// THE ACCESSIBILITY PROBLEM THIS SOLVES, WHICH THE MOTTO SCENE DODGED
// ===========================================================================
//
// Formation.tsx has the same one-at-a-time structure and solved the focus
// problem by having no links at all — defensible there, because a motto needs
// no call to action.
//
// Faculties genuinely need links. A reader who wants the Faculty of Theology
// must be able to reach it, and hiding three of the four links from the
// keyboard because they happen to be at opacity 0 would make this scene
// unusable for anyone not using a mouse. The usual fixes are all bad:
//
//   inert / aria-hidden on inactive panels — takes three quarters of the
//     university's academic structure away from screen readers to serve a
//     visual effect.
//
//   render only the active panel's link — the tab order silently changes as
//     the reader scrolls, which is disorienting in a different way.
//
//   leave them focusable and hidden — a keyboard trap: tab moves focus to a
//     link nobody can see and the page scrolls to nowhere.
//
// So: EVERY PANEL KEEPS ITS LINK, AND FOCUS DRIVES THE SCENE. Tab into the
// Engineering link and the scene advances to Engineering. Nothing is hidden
// from anybody, nothing is a trap, and the keyboard path through the section is
// the same path the mouse takes. It is the one solution where the assistive
// experience and the visual one are the same experience.
//
// ===========================================================================
// THE HONEST LIMITATION, CARRIED OVER FROM THE CARDS
// ===========================================================================
//
// These are all ceremony photographs. Nothing in the library shows engineering
// being taught, a business seminar, or a classroom — so the four faculties are
// differentiated by their words and not by their pictures, and a reader looking
// closely will notice that the Faculty of Engineering is illustrated by a
// graduation. Commissioning one teaching photograph per faculty is the single
// highest-value change available to this page, and it is one only the
// university can make.
//
// What has changed is that every image here now clears 1080px. The card grid
// used students.jpg at 968px, which was fine inside a 400px card and would be
// visibly soft across a full viewport.
// ---------------------------------------------------------------------------

export interface FacultyScene {
  id: string;
  /**
   * The REAL faculty page slug, which is not the catalogue id.
   * programmeCatalogue.ts keys the four disciplines as theology / engineering /
   * business / education; faculties.ts keys the pages as theology-buea /
   * engineering-technology / gibmas / education. Three of the four differ, so
   * linking to the catalogue id would 404 on three faculties out of four.
   */
  slug: string;
  name: string;
  /** The line that says what this faculty is for. */
  mission: string;
  count: number;
  src: string;
  alt: string;
  focal: string;
}

export default function FacultyScenes({ faculties }: { faculties: FacultyScene[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const [reduced, setReduced] = useState(false);
  // Set while focus is inside the scene. Scroll must not fight the keyboard:
  // if a reader has tabbed to Business, a stray scroll event should not yank
  // the picture back to Theology while their focus ring is still on Business.
  const focusHeld = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      if (focusHeld.current) return;
      const r = el.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      if (travel <= 0) return;
      const p = Math.min(Math.max(-r.top / travel, 0), 1);
      const next = Math.min(faculties.length - 1, Math.floor(p * faculties.length * 0.99));
      setActive((prev) => (prev === next ? prev : next));
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [faculties.length]);

  return (
    <section
      ref={ref}
      data-on-dark=""
      data-chapter="Faculties"
      aria-labelledby="faculties-heading"
      className="relative z-0 bg-brand-purple-dark text-white"
      style={{ height: `${100 + faculties.length * 85}svh` }}
    >
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        {faculties.map((f, i) => (
          <Image
            key={f.id}
            src={f.src}
            alt={i === active ? f.alt : ''}
            fill
            sizes="100vw"
            quality={82}
            loading={i === 0 ? 'eager' : 'lazy'}
            className="-z-20 object-cover transition-opacity duration-[900ms] ease-out motion-reduce:transition-none"
            style={{ objectPosition: f.focal, opacity: i === active ? 1 : 0 }}
          />
        ))}

        {/* The dark stop is held to 56% — see Formation.tsx. Gold is a light ink
            and the copy column runs to half the viewport. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{
            background:
              'linear-gradient(100deg, rgba(14,7,28,0.94) 0%, rgba(14,7,28,0.94) 56%, '
              + 'rgba(20,11,38,0.66) 76%, rgba(29,16,52,0.26) 94%, rgba(29,16,52,0.26) 100%)',
          }}
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-brand-purple/25 mix-blend-multiply" />
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <Grain opacity={0.075} />
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-6 sm:px-10 lg:px-16">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brand-gold">
            04 — The knowledge
          </p>
          {/* The section's real heading, for the document outline and for the
              aria-labelledby above. Visually it is the small line; the faculty
              names beneath it are larger but they are h3s, because they are
              inside this section rather than peers of it. */}
          <h2 id="faculties-heading" className="sr-only">
            Schools and faculties
          </h2>

          <div className="mt-8 grid max-w-2xl">
            {faculties.map((f, i) => (
              <div
                key={f.id}
                className="col-start-1 row-start-1 transition-all duration-700 ease-out motion-reduce:transition-opacity"
                style={{
                  opacity: i === active ? 1 : 0,
                  transform: reduced || i === active ? 'none' : 'translateY(14px)',
                }}
                // Focus drives the scene. A keyboard reader tabbing into any
                // faculty's link brings that faculty's panel forward, so the
                // focus ring is never on something invisible.
                onFocusCapture={() => {
                  focusHeld.current = true;
                  setActive(i);
                }}
                onBlurCapture={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) focusHeld.current = false;
                }}
              >
                <h3 className="font-heading text-[clamp(2.3rem,6.5vw,5.4rem)] font-bold uppercase leading-[0.94] tracking-[-0.035em] text-white">
                  {f.name}
                </h3>
                <p className="mt-5 font-sans text-[12px] font-semibold uppercase tracking-[0.24em] text-brand-gold">
                  {f.count} {f.count === 1 ? 'programme' : 'programmes'}
                </p>
                <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-white/90 sm:text-base">
                  {f.mission}
                </p>
                <Link
                  href={`/faculty/${f.slug}`}
                  className="group mt-9 inline-flex items-center gap-3 border-b border-brand-gold/40 pb-1 font-heading text-[15px] font-bold text-brand-gold transition duration-300 hover:border-brand-gold hover:text-white"
                >
                  Explore {f.name}
                  <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </Link>
              </div>
            ))}
          </div>

          <div aria-hidden="true" className="mt-14 flex items-center gap-3">
            {faculties.map((f, i) => (
              <span
                key={f.id}
                className="h-[2px] w-12 rounded-full transition-all duration-500"
                style={{ background: i === active ? '#f7dc79' : 'rgba(255,255,255,0.22)' }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
