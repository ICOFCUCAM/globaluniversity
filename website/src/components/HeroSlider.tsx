'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { HeroSlide } from '@/content/site';

const DURATION = 7000;

export default function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const regionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    if (paused || reduced || slides.length < 2) return;
    const timer = setInterval(() => setCurrent((c) => (c + 1) % slides.length), DURATION);
    return () => clearInterval(timer);
  }, [slides.length, paused, reduced]);

  const go = useCallback(
    (dir: 1 | -1) => setCurrent((c) => (c + dir + slides.length) % slides.length),
    [slides.length],
  );

  // Arrow keys move the carousel while it has focus, per the APG carousel pattern.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    }
  }

  return (
    <section
      ref={regionRef}
      className="relative isolate min-h-[clamp(30rem,80vh,46rem)] overflow-hidden bg-brand-purple-dark text-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={onKeyDown}
      role="region"
      aria-roledescription="carousel"
      aria-label="University highlights"
      tabIndex={-1}
    >
      {slides.map((slide, i) => {
        const active = i === current;
        return (
          <div
            key={slide.title}
            className={`absolute inset-0 transition-opacity duration-[1200ms] ease-out ${
              active ? 'z-[1] opacity-100' : 'pointer-events-none opacity-0'
            }`}
            aria-hidden={!active}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}`}
          >
            {/* Slow push-in on the active frame gives the still photography life
                without asking the browser to composite anything but a transform. */}
            <div className={`absolute inset-0 ${active && !reduced ? 'animate-ken-burns' : 'scale-[1.06]'}`}>
              <Image
                src={slide.image}
                alt=""
                fill
                priority={i === 0}
                loading={i === 0 ? undefined : 'lazy'}
                quality={i === 0 ? 85 : 72}
                sizes="100vw"
                className="object-cover"
              />
            </div>

            {/* Three-part scrim: darkens the top for the sticky header, holds the
                centre readable, and grounds the base into the next section. */}
            <div className="absolute inset-0 bg-gradient-to-b from-brand-purple-dark/85 via-brand-purple/60 to-brand-purple-dark/95" />
            <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_45%,transparent,rgba(29,20,40,0.55))]" />
          </div>
        );
      })}

      {/* Copy is rendered once, outside the fading frames, so the headline
          never cross-fades against itself. */}
      <div className="relative z-[2] mx-auto flex min-h-[clamp(30rem,80vh,46rem)] max-w-5xl flex-col items-center justify-center px-4 py-28 text-center">
        <p className="mb-5 inline-flex items-center gap-2.5 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-4 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-gold backdrop-blur-sm">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-gold" />
          Accredited since 2007
        </p>

        {slides.map((slide, i) => (
          <div
            key={slide.title}
            // Inactive copy is pulled out of flow AND made `invisible`. Opacity
            // alone left it painting for a frame before hydration settled, which
            // showed as ghost text stacked under the live headline.
            className={`w-full transition-opacity duration-700 ${
              i === current
                ? 'opacity-100'
                : 'pointer-events-none invisible absolute inset-x-0 top-0 opacity-0'
            }`}
            aria-hidden={i !== current}
            {...(i !== current ? { inert: '' as unknown as boolean } : {})}
          >
            <h1 className="font-heading text-display-xl font-bold text-white [text-wrap:balance]">
              {slide.title}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-white/85 sm:text-xl">
              {slide.text}
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href={slide.cta.href}
                tabIndex={i === current ? 0 : -1}
                className="group relative overflow-hidden rounded-full bg-brand-gold px-9 py-4 font-heading text-base font-semibold text-brand-purple shadow-gold transition hover:bg-brand-gold-deep"
              >
                <span className="relative z-10">{slide.cta.label}</span>
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 -left-1/3 w-1/3 bg-white/40 blur-md transition-transform duration-700 group-hover:translate-x-[420%]"
                />
              </Link>
              <Link
                href="/apply"
                tabIndex={i === current ? 0 : -1}
                className="rounded-full border-2 border-white/40 px-9 py-4 font-heading text-base font-semibold text-white backdrop-blur-sm transition hover:border-brand-gold hover:text-brand-gold"
              >
                Start an Application
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="absolute inset-x-0 bottom-0 z-[3]">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-3 px-4 pb-8">
          <button
            onClick={() => go(-1)}
            aria-label="Previous slide"
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-white/25 text-white/70 transition hover:border-brand-gold hover:text-brand-gold sm:flex"
          >
            ‹
          </button>
          {slides.map((s, i) => (
            <button
              key={s.title}
              aria-label={`Show slide ${i + 1}: ${s.title}`}
              aria-current={i === current}
              onClick={() => setCurrent(i)}
              className="group relative h-1 overflow-hidden rounded-full bg-white/25 transition-all"
              style={{ width: i === current ? '4.5rem' : '1.75rem' }}
            >
              <span
                className={`absolute inset-y-0 left-0 rounded-full bg-brand-gold ${
                  i === current ? 'w-full' : 'w-0 group-hover:w-full'
                } transition-[width] duration-300`}
              />
            </button>
          ))}
          <button
            onClick={() => go(1)}
            aria-label="Next slide"
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-white/25 text-white/70 transition hover:border-brand-gold hover:text-brand-gold sm:flex"
          >
            ›
          </button>
        </div>
      </div>

      <span className="sr-only" aria-live="polite">
        Slide {current + 1} of {slides.length}: {slides[current]?.title}
      </span>
    </section>
  );
}
