'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Grain } from '@/components/Atmosphere';

// ---------------------------------------------------------------------------
// THE FORMATION — scene 03.
//
// Three words the university organises itself around, told one at a time at the
// size of a title card, over photography that changes beneath them.
//
// ===========================================================================
// WHAT THIS REPLACES AND WHY THE CARDS HAD TO GO
// ===========================================================================
//
// Three bordered boxes in a row, each with a word, a bold line and a paragraph.
// 0.79 of a screen at 181 words per screen — the second densest band on the
// page — and the single clearest example of the problem with the whole layout:
// the university's motto, the thing carved into its crest, rendered as a
// feature comparison table.
//
// Three boxes side by side say "here are three attributes, all equal, scan
// whichever interests you". That is a specification. A motto is not a
// specification; it is a claim about what the institution is FOR, and it can
// only be made one word at a time, with enough silence around each word for it
// to land.
//
// ===========================================================================
// WHY A STICKY SCENE RATHER THAN THREE STACKED BANDS
// ===========================================================================
//
// Three full-height bands would also give each word its own screen — and would
// add three screens to a page already too long, with two hard cuts where the
// reader is thrown from one photograph to the next.
//
// Sticky costs the same three screens of scrolling but spends them inside ONE
// frame. The picture changes under fixed type, which is how a film dissolves
// between shots and why it reads as continuous rather than as a list. The
// reader is not moving between three things; they are watching one thing
// develop. That is the entire difference between a section and a scene.
//
// ===========================================================================
// WHAT IS DELIBERATELY NOT IN HERE
// ===========================================================================
//
// NO LINKS. Not one, and it is not an oversight. Panels that fade out are
// still in the document — which is right, because a screen reader should hear
// all three convictions in order, and hiding two thirds of the university's
// motto from assistive technology to serve a visual effect would be indefensible.
//
// But anything focusable inside a faded-out panel is a keyboard trap in
// waiting: tab moves focus to a link nobody can see, the page scrolls to
// nowhere, and the reader is lost. The usual patches — `inert`, aria-hidden on
// the inactive panels — buy the visual effect by taking the words away from
// screen readers, which is the wrong trade.
//
// Making the panels pure text costs nothing, because a motto does not need a
// call to action. The links that belong to this material are on /about, which
// the scene after this one points to.
// ---------------------------------------------------------------------------

interface Conviction {
  word: string;
  title: string;
  body: string;
  src: string;
  alt: string;
  focal: string;
}

const CONVICTIONS: Conviction[] = [
  {
    word: 'Nobility',
    title: 'Education owed, not sold',
    body:
      'We bring accredited higher education within reach of working adults, ministers and '
      + 'first-generation students — in Cameroon, across Africa, and anywhere a connection reaches. '
      + 'A qualification that only the comfortable can attempt is not an education system.',
    // Graduands with their scrolls: the people the claim is about, at the moment
    // the claim is kept.
    src: '/images/graduation-2024/grad-2024-graduands-scrolls.jpg',
    alt: 'Graduands of ICOF Global University holding their scrolls at the 2024 congregation',
    focal: '50% 34%',
  },
  {
    word: 'Professionalism',
    title: 'Taught by people who have done it',
    body:
      'Our faculty hold professorships, doctorates and senior professional qualifications, and '
      + 'earned them in pulpits, classrooms, laboratories and boardrooms before bringing that work '
      + 'into the lecture hall. Theory is applied from the first semester because it was practised '
      + 'before it was taught.',
    src: '/images/graduation-2024/grad-2024-faculty-robes.jpg',
    alt: 'Faculty of ICOF Global University in academic robes',
    focal: '50% 30%',
  },
  {
    word: 'Godliness',
    title: 'Character formed alongside competence',
    body:
      'Founded within the International Circle of Faith, we hold that rigorous scholarship and '
      + 'formed character belong together. A degree that trains a mind and forms no one is only a '
      + 'piece of paper, however well examined.',
    // The hooding: the university placing the hood on a graduate. Conferral as
    // an act between two people, which is what this conviction is about.
    src: '/images/graduation-2024/grad-2024-hooding.jpg',
    alt: 'A graduate of ICOF Global University being hooded at the 2024 congregation',
    focal: '50% 36%',
  },
];

export default function Formation() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const [reduced, setReduced] = useState(false);

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
      const r = el.getBoundingClientRect();
      // How far through the tall outer container we are, 0 to 1. The sticky
      // child occupies one viewport of it, so the travel is height - vh.
      const travel = r.height - window.innerHeight;
      if (travel <= 0) return;
      const p = Math.min(Math.max(-r.top / travel, 0), 1);
      // Bias slightly late so each word holds its ground before handing over,
      // rather than swapping the instant the midpoint is crossed.
      const next = Math.min(CONVICTIONS.length - 1, Math.floor(p * CONVICTIONS.length * 0.98));
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
  }, []);

  return (
    <section
      ref={ref}
      data-on-dark=""
      data-chapter="Formation"
      className="relative h-[300svh] bg-brand-purple-dark text-white"
    >
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        {/* THE PICTURES. All three mount; only one is opaque. Cross-fading
            mounted images is what makes the change a dissolve — swapping the
            src would show a blank frame while the next one decodes. */}
        {CONVICTIONS.map((c, i) => (
          <Image
            key={c.src}
            src={c.src}
            alt={i === active ? c.alt : ''}
            fill
            sizes="100vw"
            quality={82}
            // The first is what a reader arriving at this scene sees, so it
            // must not be lazy; the other two can wait until the scene is near.
            loading={i === 0 ? 'eager' : 'lazy'}
            className="-z-20 object-cover transition-opacity duration-[900ms] ease-out motion-reduce:transition-none"
            style={{ objectPosition: c.focal, opacity: i === active ? 1 : 0 }}
          />
        ))}

        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          // THE HOLD RUNS TO 56%, NOT 44%, AND IT IS DARKER THAN THE OTHER
          // BANDS. Both numbers were measured, not chosen.
          //
          // The copy column here runs from x=144 to about x=720 on a 1440px
          // viewport — exactly half the width — and the first version's dark
          // stop ended at 44%. So the last tenth of every line sat on the ramp,
          // out over the bright part of the picture.
          //
          // That is survivable for white ink and not for gold. Gold is a LIGHT
          // colour: #f7dc79 has a relative luminance around 0.73, so it needs a
          // genuinely dark ground in a way white never reveals. Measured
          // against the graduands photograph, the gold subtitle came in at
          // 2.23:1 where it needed 3.0, and the gold eyebrow at 3.16:1 against
          // the faculty photograph where it needed 4.5 — while the white body
          // copy directly beneath them was passing at 13:1 and hiding it.
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
            03 — Our formation
          </p>

          {/* The three panels are stacked in one grid cell rather than absolutely
              positioned, so the frame is as tall as the longest of them and the
              type never jumps between words. */}
          <div className="mt-10 grid max-w-2xl">
            {CONVICTIONS.map((c, i) => (
              <div
                key={c.word}
                className="col-start-1 row-start-1 transition-all duration-700 ease-out motion-reduce:transition-opacity"
                style={{
                  opacity: i === active ? 1 : 0,
                  transform: reduced || i === active ? 'none' : 'translateY(14px)',
                  pointerEvents: i === active ? 'auto' : 'none',
                }}
              >
                <h2 className="font-heading text-[clamp(3rem,9vw,7.5rem)] font-bold uppercase leading-[0.92] tracking-[-0.035em] text-white">
                  {c.word}
                </h2>
                <p className="mt-6 font-heading text-[clamp(1.15rem,2.2vw,1.6rem)] font-bold leading-snug text-brand-gold">
                  {c.title}
                </p>
                <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/90 sm:text-base">
                  {c.body}
                </p>
              </div>
            ))}
          </div>

          {/* Where we are in the scene. Rules rather than dots — a dot row reads
              as a carousel the reader is expected to click, and this is not
              one. */}
          <div aria-hidden="true" className="mt-14 flex items-center gap-3">
            {CONVICTIONS.map((c, i) => (
              <span
                key={c.word}
                className="h-[2px] w-14 rounded-full transition-all duration-500"
                style={{ background: i === active ? 'var(--brand-gold, #f7dc79)' : 'rgba(255,255,255,0.22)' }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
