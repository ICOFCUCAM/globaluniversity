'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { HeroSlide } from '@/content/site';
import { Aurora, Grain, LightShaft } from './Atmosphere';
import Magnetic from './Magnetic';
import { HERO_ASSURANCES } from '@/content/institutionalFacts';
import { UNIVERSITY } from '@/lib/constants';

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
      className="relative isolate min-h-[clamp(34rem,88vh,54rem)] overflow-hidden bg-brand-purple-dark text-white"
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

            {/* THE SCRIM, AND WHY IT IS MUCH LIGHTER THAN IT WAS.
                It used to run 85% at the top, 60% through the middle and 95% at
                the base, with a radial darkening over all of it. The photograph
                underneath is a real graduation — real robes, real faces, people
                who were actually there — and almost none of it reached the
                viewer. The humanity is the whole reason for using a photograph
                instead of a gradient.

                It is now a VERTICAL scrim only, heavy exactly where type sits
                and nowhere else: enough at the top for the sticky header,
                enough at the base for the buttons and the fold, and a broad
                transparent middle where the faces are. The horizontal band is
                what keeps contrast on the headline without flattening the
                image, because the headline is centred and the picture is not.

                Contrast is still met: the headline sits on ~55% at the point it
                is drawn, over a dark image, in near-white at display size. */}
            <div className="absolute inset-0 bg-gradient-to-b from-brand-purple-dark/80 via-brand-purple-dark/40 to-brand-purple-dark/88" />
            {/* The band behind the type. Set by measurement, not by taste: the
                headline is drawn in near-white at display weight and needs the
                composite behind it to stay under roughly 45% luminance for AA
                at that size. 0.42 was not enough over the brighter frames —
                the ceremony photographs have white robes and daylight windows
                directly behind the centred headline. */}
            <div className="absolute inset-x-0 top-1/2 h-[58%] -translate-y-1/2 bg-[linear-gradient(to_bottom,transparent,rgba(29,20,40,0.55)_30%,rgba(29,20,40,0.55)_70%,transparent)]" />
            {/* A warm cast rather than a grey one — the ceremony is gold-lit and
                a neutral scrim drains it. */}
            <div className="absolute inset-0 bg-[radial-gradient(75%_65%_at_50%_42%,rgba(233,193,74,0.10),transparent_70%)] mix-blend-soft-light" />
          </div>
        );
      })}

      {/* Atmosphere: shafts from a clerestory, aurora beneath, grain over all.
          z-[1] puts it above the photographic frames, below the copy. */}
      <div className="pointer-events-none absolute inset-0 z-[1]">
        <Aurora tone="dual" intensity={0.85} />
        <LightShaft />
        <Grain opacity={0.06} />
      </div>

      {/* Copy is rendered once, outside the fading frames, so the headline
          never cross-fades against itself. */}
      <div className="relative z-[2] mx-auto flex min-h-[clamp(34rem,88vh,54rem)] max-w-5xl flex-col items-center justify-center px-4 py-24 text-center sm:py-32">
        {/* THE MOTTO, AND WHY IT IS THE CONSTANT.
            The headlines below rotate; this does not. That is how an
            established university's front page is built — the crest and the
            motto hold still while the news moves underneath them — and it is
            what turns four separate slides into one institution speaking.

            The words are the university's own, from constants.ts, and were
            already carried on the certificate. They are more distinctive than
            anything that could be written for the purpose: "Knowledge.
            Character. Service." belongs to nobody, and this belongs to ICOF. */}
        {/* A GLOBAL UNIVERSITY — the identity, above the motto and above the
            rotating headline, because it is the thing a visitor must leave
            with. It was buried in the top bar and the footer; those are the
            two places a first-time visitor reads last. */}
        <p className="mb-4 font-heading text-[13px] font-bold uppercase tracking-[0.42em] text-white/85 [text-shadow:0_1px_14px_rgba(29,20,40,0.85)] sm:text-[15px] sm:tracking-[0.5em]">
          A Global University
        </p>
        <p className="mb-7 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-full border border-brand-gold/35 bg-brand-purple-dark/25 px-5 py-2 font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold backdrop-blur-md sm:text-[11px] sm:tracking-[0.26em]">
          {UNIVERSITY.motto.replace(/&/g, '·').split(/[,·]/).map((word, wi) => (
            <span key={word} className="flex items-center gap-3">
              {wi > 0 && (
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-brand-gold/70" />
              )}
              {word.trim()}
            </span>
          ))}
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
            {/* Only the visible slide is the document's h1; the rest are plain
                text so the page never ships four competing top-level headings. */}
            {i === current ? (
              <h1 className="font-heading text-display-xl font-bold text-transparent [text-wrap:balance] [background-image:linear-gradient(175deg,#ffffff_38%,#f7e6b4_78%,#e9c14a_100%)] [background-clip:text] [-webkit-background-clip:text] drop-shadow-[0_2px_24px_rgba(29,20,40,0.45)]">
                {slide.title}
              </h1>
            ) : (
              <p className="font-heading text-display-xl font-bold text-transparent [text-wrap:balance] [background-image:linear-gradient(175deg,#ffffff_38%,#f7e6b4_78%,#e9c14a_100%)] [background-clip:text] [-webkit-background-clip:text]">
                {slide.title}
              </p>
            )}
            <p className="mx-auto mt-5 max-w-2xl text-balance leading-relaxed text-white/90 [text-shadow:0_1px_12px_rgba(29,20,40,0.75)] sm:mt-6 sm:text-xl">
              {slide.text}
            </p>
            <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:mt-11 sm:flex-row sm:items-center sm:gap-4">
              <Magnetic strength={9}>
              <Link
                href={slide.cta.href}
                tabIndex={i === current ? 0 : -1}
                // The ring is not decoration. Gold on a gold-lit ceremony photograph —
                // yellow robes, a tan tablecloth — loses its edge entirely, and a
                // primary call to action that dissolves into the background is not a
                // call to action. A dark hairline holds the shape on every frame.
                className="group relative flex items-center justify-center gap-2.5 overflow-hidden rounded-full bg-brand-gold px-8 py-4 font-heading text-[15px] font-bold tracking-[0.01em] text-brand-purple-dark shadow-gold ring-1 ring-brand-purple-dark/25 transition duration-300 ease-enter hover:bg-brand-gold-deep active:scale-[0.98] active:duration-75 hover:shadow-lift-lg sm:px-10 sm:py-[1.15rem] sm:text-base"
              >
                <span className="relative z-10">{slide.cta.label}</span>
                {/* The arrow travels on hover. A static arrow is decoration; one
                    that moves is a promise about what the click does. */}
                <span
                  aria-hidden="true"
                  className="relative z-10 transition-transform duration-300 group-hover:translate-x-1"
                >
                  →
                </span>
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 -left-1/3 w-1/3 bg-white/40 blur-md transition-transform duration-700 group-hover:translate-x-[460%]"
                />
              </Link>
              </Magnetic>
              <Magnetic strength={9}>
              <Link
                href="/programs"
                tabIndex={i === current ? 0 : -1}
                className="group flex items-center justify-center gap-2.5 rounded-full border-2 border-white/45 bg-brand-purple-dark/25 px-8 py-4 font-heading text-[15px] font-bold tracking-[0.01em] text-white backdrop-blur-md transition duration-300 hover:border-brand-gold hover:bg-brand-gold/15 hover:text-brand-gold sm:px-10 sm:py-[1.15rem] sm:text-base"
              >
                Explore Programmes
                <span
                  aria-hidden="true"
                  className="transition-transform duration-300 group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
              </Magnetic>
            </div>

            {/* THE TRUST STRIP.
                A stranger's next thought after "what is this place for" is
                "why should I believe you". Every clause here is checkable by
                the person reading it — the accreditation against the Ministry's
                own register, the campuses against the address in the footer,
                the study modes against any programme page.

                What is NOT here: alumni counts, satisfaction percentages,
                countries represented. Those are the figures that would impress
                most and this university cannot yet evidence any of them. See
                src/content/institutionalFacts.ts. */}
            <ul className="mt-9 flex flex-wrap items-center justify-center gap-x-7 gap-y-2.5 sm:mt-11">
              {HERO_ASSURANCES.map((a) => (
                <li
                  key={a}
                  className="flex items-center gap-2 font-sans text-[11px] font-medium tracking-wide text-white/80 [text-shadow:0_1px_10px_rgba(29,20,40,0.8)] sm:text-[12.5px]"
                >
                  <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-brand-gold" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* The hero dissolves downward into the quick-links card instead of
          terminating on a hard edge. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-24 bg-gradient-to-b from-transparent to-brand-purple-dark/85"
      />

      {/* Controls */}
      <div className="absolute inset-x-0 bottom-0 z-[3]">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-3 px-4 pb-10">
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
