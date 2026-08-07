'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { HERO_ASSURANCES } from '@/content/institutionalFacts';
import { UNIVERSITY } from '@/lib/constants';
import { heroSlides } from '@/content/site';
import Magnetic from '@/components/Magnetic';

// ---------------------------------------------------------------------------
// THE HERO.
//
// ===========================================================================
// WHY THERE IS NO LONGER A FULL-BLEED PHOTOGRAPH HERE
// ===========================================================================
//
// The old hero stretched a photograph across 100vw at 88vh. An audit of the
// image library explains why it looked poor, and the answer is not grading or
// cropping — it is arithmetic.
//
//   home-hero.jpg      972 × 729
//   global.jpg         972 × 729
//   students.jpg       968 × 648
//   every graduation photograph      1080 × 720
//
// Of ninety-seven photographs in this repository, THREE exceed 1600px wide. A
// 972px image spread across a 1440px viewport is a 1.5× upscale before the
// device pixel ratio doubles it again; on an ordinary Retina laptop the hero
// was showing a 4:3 photograph at roughly three times its real size, cropped to
// a cinematic shape it was never framed for. Soft edges, mushy faces, visible
// compression in the flat areas. No treatment fixes missing pixels.
//
// AND THE TWO LARGE IMAGES CANNOT BE USED.
//
//   landing-bg.jpg        1920 × 1080   stock: hands on a laptop, nowhere in
//                                       particular, no connection to ICOF
//   wp/footer-building.jpg 2560 × 1754  a CAMBRIDGE COLLEGE
//
// The second is the serious one. It is a photograph of an English collegiate
// quadrangle sitting in an African university's asset folder, and it was on the
// footer of this site until recently. Anyone who recognises it — and Cambridge
// is among the most recognisable architecture on earth — reads it as an
// institution borrowing someone else's campus. That is a credibility problem,
// not a design one, and it is exactly the kind of thing an accreditor notices.
//
// ===========================================================================
// WHAT REPLACES IT
// ===========================================================================
//
// A hero built from what this university actually has at unlimited resolution:
// its own engraved artwork. The guilloché ground, the gold rule work and the
// type are vector — they are as sharp on a 6K display as on a phone, they weigh
// a couple of kilobytes, and they are the same visual language as the
// certificate every graduate is handed.
//
// The authentic photography is still here, and it is the strongest thing on the
// page — real graduands, real robes, people who were in the hall. It sits in a
// CONTAINED PORTRAIT FRAME about 440px wide. At that size a 1080 × 720 source
// is a 1.2× downscale even on a 2× display: fully resolved, sharp, honest.
//
// The rule is simple and it is the whole decision: show a photograph at the
// size its pixels can carry, and build everything larger out of vector.
// ---------------------------------------------------------------------------

const FRAMES = [
  { src: '/images/graduation-2024/grad-2024-doctoral-portrait.jpg', alt: 'A doctoral graduand in academic dress at the 2024 congregation' },
  { src: '/images/graduation-2024/grad-2024-graduate-flowers.jpg', alt: 'A graduate with her family after the 2024 congregation' },
  { src: '/images/graduation-2024/grad-2024-hooding.jpg', alt: 'The hooding of a graduand at the 2024 congregation' },
  { src: '/images/graduation-2024/grad-2024-masters-caps.jpg', alt: "Master's graduands at the 2024 congregation" },
];

export default function Hero() {
  const [frame, setFrame] = useState(0);
  const [line, setLine] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    if (reduced || paused) return;
    const t = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length);
      setLine((l) => (l + 1) % heroSlides.length);
    }, 7000);
    return () => clearInterval(t);
  }, [reduced, paused]);

  const slide = heroSlides[line];

  return (
    <section
      data-on-dark=""
      aria-label="ICOF Global University"
      className="relative isolate overflow-hidden bg-brand-purple-dark text-white"
      // THE HEADLINE ROTATES, WHICH MAKES IT MOVING CONTENT.
      //
      // WCAG 2.2.2 is explicit: anything that moves, blinks or auto-updates for
      // more than five seconds needs a way to pause it. The old carousel paused
      // on hover and focus; this hero rotates the headline AND the photograph,
      // so it needs the same courtesy and did not have it.
      //
      // Pausing on focus matters more than pausing on hover. A keyboard user
      // tabbing to the call to action gets the headline changing underneath the
      // button they are aiming at, and a screen reader user gets the h1
      // re-announced mid-sentence.
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* ---- the engraved ground, entirely vector ------------------------ */}
      <div aria-hidden="true" className="absolute inset-0">
        {/* Guilloché: two counter-rotating rose fields, as on the certificate.
            Drawn as repeating conic and radial gradients rather than an image,
            so it resolves at any size and costs nothing to download. */}
        <div
          className="absolute inset-0 opacity-[0.28]"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 120% 90% at 22% 18%, rgba(120,102,186,0.55), transparent 60%),'
              + 'radial-gradient(ellipse 100% 80% at 82% 78%, rgba(233,193,74,0.20), transparent 62%),'
              + 'radial-gradient(ellipse 90% 70% at 60% 10%, rgba(64,44,104,0.9), transparent 70%)',
          }}
        />
        {/* Engine-turned rules — the ground the certificate is printed on. */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'repeating-linear-gradient(104deg, #f7dc79 0 1px, transparent 1px 22px)' }}
        />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: 'repeating-linear-gradient(-104deg, #f7dc79 0 1px, transparent 1px 30px)' }}
        />
        {/* A single soft light from upper left, matching the certificate's
            lighting and the globe's. */}
        <div className="absolute inset-0 bg-[radial-gradient(75%_60%_at_18%_0%,rgba(255,255,255,0.10),transparent_70%)]" />
        {/* Grounds the base into the quick-links card below. */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-brand-purple-dark" />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-24 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-20 lg:py-32">
        {/* ---- the type ------------------------------------------------- */}
        <div>
          <p className="font-heading text-[13px] font-bold uppercase tracking-[0.42em] text-white/85 sm:text-[15px] sm:tracking-[0.5em]">
            A Global University
          </p>

          <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-gold sm:text-[11px] sm:tracking-[0.26em]">
            {UNIVERSITY.motto.replace(/&/g, '·').split(/[,·]/).map((word, wi) => (
              <span key={word} className="flex items-center gap-3">
                {wi > 0 && <span aria-hidden="true" className="h-1 w-1 rounded-full bg-brand-gold/70" />}
                {word.trim()}
              </span>
            ))}
          </p>

          {/* The headline rotates; everything above it does not. On a
              typographic hero the type IS the artwork, so it is set larger and
              tighter than it was over a photograph — there is no scrim to fight
              and no busy image underneath to lose hairlines against. */}
          <h1 className="mt-8 font-heading text-[clamp(2.4rem,6.4vw,4.9rem)] font-bold leading-[1.02] tracking-[-0.025em] text-transparent [background-image:linear-gradient(168deg,#ffffff_30%,#f7e6b4_72%,#e9c14a_100%)] [background-clip:text] [-webkit-background-clip:text] [text-wrap:balance]">
            {slide.title}
          </h1>

          <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/80 sm:text-xl">
            {slide.text}
          </p>

          <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Magnetic strength={9}>
              <Link
                href={slide.cta.href}
                className="group relative flex items-center justify-center gap-2.5 overflow-hidden rounded-full bg-brand-gold px-9 py-4 font-heading text-[15px] font-bold text-brand-purple-dark shadow-gold ring-1 ring-brand-purple-dark/25 transition duration-300 ease-enter hover:bg-brand-gold-deep active:scale-[0.98] active:duration-75 sm:px-10 sm:text-base"
              >
                <span className="relative z-10">{slide.cta.label}</span>
                <span aria-hidden="true" className="relative z-10 transition-transform duration-300 group-hover:translate-x-1">→</span>
                <span aria-hidden="true" className="absolute inset-y-0 -left-1/3 w-1/3 bg-white/40 blur-md transition-transform duration-700 group-hover:translate-x-[460%]" />
              </Link>
            </Magnetic>
            <Magnetic strength={9}>
              <Link
                href="/programs"
                className="group flex items-center justify-center gap-2.5 rounded-full border-2 border-white/40 bg-white/[0.06] px-9 py-4 font-heading text-[15px] font-bold text-white backdrop-blur-sm transition duration-300 ease-enter hover:border-brand-gold hover:bg-brand-gold/12 hover:text-brand-gold active:scale-[0.98] active:duration-75 sm:px-10 sm:text-base"
              >
                Explore Programmes
                <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </Link>
            </Magnetic>
          </div>

          <ul className="mt-10 flex flex-wrap gap-x-7 gap-y-2.5">
            {HERO_ASSURANCES.map((a) => (
              <li key={a} className="flex items-center gap-2 font-sans text-[11px] font-medium tracking-wide text-white/65 sm:text-[12.5px]">
                <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-brand-gold" />
                {a}
              </li>
            ))}
          </ul>
        </div>

        {/* ---- the photograph, at a size its pixels can carry ------------- */}
        <figure className="relative mx-auto w-full max-w-[440px]">
          {/* A gold rule frame, offset — the plate a portrait is mounted on. */}
          <span
            aria-hidden="true"
            className="absolute -inset-3 rounded-[1.6rem] border border-brand-gold/30 sm:-inset-4"
          />
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl shadow-lift-lg ring-1 ring-brand-gold/25">
            {FRAMES.map((f, i) => (
              <Image
                key={f.src}
                src={f.src}
                alt={i === frame ? f.alt : ''}
                fill
                priority={i === 0}
                quality={90}
                // 440px displayed, so a 1080px source is a DOWNSCALE even at
                // 2×. This is the whole point of the redesign: the photograph
                // is never asked for pixels it does not have.
                sizes="(min-width:1024px) 440px, 92vw"
                aria-hidden={i !== frame}
                className={`object-cover transition-opacity duration-1000 ease-enter ${
                  i === frame ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ))}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-purple-dark/55 via-transparent to-transparent" />
          </div>

          <figcaption className="mt-5 flex items-center justify-between gap-4 font-sans text-[11px] text-white/45">
            <span>The 2024 congregation, Buea</span>
            <span className="flex gap-1.5" aria-hidden="true">
              {FRAMES.map((f, i) => (
                <span
                  key={f.src}
                  className={`h-1 rounded-full transition-all duration-500 ${
                    i === frame ? 'w-5 bg-brand-gold' : 'w-1.5 bg-white/25'
                  }`}
                />
              ))}
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
