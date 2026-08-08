'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { projectFlatWorld } from '@/lib/azimuthal';
import { NATIONS_FULL } from '@/content/institutionalFacts';

// ---------------------------------------------------------------------------
// WHERE WE TEACH — three layers over a pinned photograph.
//
// ===========================================================================
// WHAT THIS REPLACES, AND WHY
// ===========================================================================
//
// A dark plate holding a map, an information panel and a six-tab selector. It
// was correct — every claim in it was true and precisely qualified — and it was
// still a control panel. The university asked for something else:
//
//     "a premium global-university experience, not a collection of location
//      cards... The section should breathe. Use generous whitespace, large
//      typography and asymmetric composition... Do not make the map the main
//      attraction — the university and people remain the focus."
//
// That is a different instrument. Tabs make a reader operate the section before
// it tells them anything, and the six panels repeated what the campus, the
// international and the online pages already say at length. The homepage's job
// here is one sentence — WHEREVER YOU STUDY, YOU BELONG TO THE SAME UNIVERSITY
// — with the footprint underneath it as evidence, and every detail on the page
// that owns it.
//
// ===========================================================================
// THE THREE LAYERS
// ===========================================================================
//
//   1. THE PHOTOGRAPH. A graduand in doctoral regalia being received by the
//      platform party at the university's own congregation. People, not
//      architecture; this institution's own afternoon, not a stock library's.
//      It is PINNED — position: fixed inside a clip-path: inset(0) section —
//      the same mechanism the university asked to be preserved everywhere, so
//      the content travels across it while the picture holds still.
//
//      AND IT IS LUMINOUS. The brief is explicit that the image must not be
//      buried under a heavy dark overlay, so there is no full-frame scrim. The
//      photograph carries a light gradient at the edges only, and every word
//      that needs contrast sits on its own translucent plate. That is more work
//      than one big black veil and it is the whole difference between a
//      photograph and a texture.
//
//   2. THE GEOGRAPHY. The university's own azimuthal projection, held at low
//      opacity and bled off the right edge so it reads as an engraving on the
//      picture rather than a map on a travel site. Fine lines run from Cameroon
//      to each of the other places — restraint, not a flight-path diagram — and
//      the marks distinguish a named site from a nation, as they do everywhere
//      else on this site.
//
//   3. THE CONTENT. Two blocks, asymmetric, with a screen of air between them.
//
// ===========================================================================
// THE MOTION IS OPACITY AND STROKE, NEVER TRANSFORM ON AN ANCESTOR
// ===========================================================================
//
// The map fades in and the network draws itself when the section arrives, and
// the marks appear one after another. None of that is done with a transform on
// anything between the section and the fixed layer — `transform`, `filter`,
// `perspective`, `contain` and `will-change` all establish a containing block
// for fixed descendants, which would silently convert the pinned photograph
// into an ordinary scrolling background. Nothing throws; the composition just
// quietly stops existing.
//
// So the reveal is opacity on the layers and stroke-dashoffset on the lines.
// The marks do use a transform — but they are DESCENDANTS of the fixed layer,
// not ancestors of it, and a transform on a child of a fixed element cannot
// re-anchor its parent. src/components/home/fixedWindow.test.mjs scans only the
// source that precedes the fixed layer, for exactly this reason.
//
// prefers-reduced-motion is honoured by skipping the observer entirely: the
// section renders in its finished state and nothing animates.
// ---------------------------------------------------------------------------

const PHOTO = '/images/graduation-2024/grad-2024-congregation-greeting.jpg';

// The disc, in the 0–100 space the overlay SVG uses. 47 is 94% of the
// half-width, which is the inset the generated flat-world.svg draws at — so a
// mark here lands on the mark already drawn beneath it.
const DISC = { cx: 50, cy: 50, r: 47 };

const at = (lon: number, lat: number) => projectFlatWorld(lon, lat, DISC.cx, DISC.cy, DISC.r);

/** Every marked place, with the nation it belongs to. */
const MARKS = NATIONS_FULL.flatMap((n) =>
  n.sites.map((s) => ({ country: n.country, name: s.name, establishment: s.establishment, lon: s.lon, lat: s.lat })),
);

// THE LINES RUN FROM CAMEROON, because that is where the university is from and
// a network drawn from anywhere else would be making a different claim. Buea is
// the origin; Douala is sixty kilometres away and would draw a line to itself.
const ORIGIN = MARKS.find((m) => m.name === 'Buea')!;
const LINKS = MARKS.filter((m) => m.country !== 'Cameroon');

export default function GlobalPresence() {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        // ONCE. A section that re-animates every time it scrolls back into view
        // is a section that will not let the reader alone.
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '-15% 0px -15% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      data-on-dark=""
      data-chapter="Global presence"
      aria-labelledby="presence-heading"
      className="relative z-10 bg-brand-purple-dark text-white"
      // The window. clip-path confines the viewport-sized picture to this
      // section without becoming its containing block.
      style={{ clipPath: 'inset(0)' }}
    >
      {/* ---- LAYER 1 + 2: THE PINNED CANVAS ---------------------------- */}
      <div aria-hidden="true" data-pinned-ground className="fixed inset-0 -z-20">
        <Image
          src={PHOTO}
          alt=""
          fill
          sizes="100vw"
          quality={82}
          loading="lazy"
          className="object-cover"
          // The handshake is left of centre and the standing graduands fill the
          // right; this keeps both, and keeps the water bottles on the table
          // out of the bottom of the frame.
          // Pushed up and slightly right: the handshake and the graduand's face
          // are the subject, and the table of water bottles is the bottom-left
          // corner of the source. A frame centred on the file would have led
          // with the bottles.
          style={{ objectPosition: '48% 34%' }}
        />

        {/* NOT A FULL-FRAME SCRIM — a SHAPED one.
            The brief is explicit that the photograph must stay luminous rather
            than being buried under a heavy dark overlay, so nothing here dims
            the whole frame. Three gradients darken only where words land, and
            the right half — the standing graduands, the regalia, the faces —
            keeps very nearly its full strength.

            THE ELLIPSE IS THE ONE THAT MATTERS. A linear left-to-right ramp was
            not enough: the headline runs to about 70% of the width, and at that
            point it crossed the brightest thing in the picture, a white
            table-cloth and a row of water bottles. Letterforms over that are
            legible in a screenshot and not on a screen. The ellipse follows the
            TEXT rather than the frame, so the contrast is bought exactly where
            it is spent. */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_78%_88%_at_12%_46%,rgba(20,11,32,0.94)_0%,rgba(20,11,32,0.86)_34%,rgba(20,11,32,0.52)_62%,rgba(20,11,32,0.12)_86%,transparent_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1b1029]/70 via-transparent to-[#1b1029]/20" />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#1b1029]/85 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#1b1029]/70 to-transparent" />

        {/* ---- THE GEOGRAPHY, bled off the right edge ---- */}
        <div
          className={`absolute right-[-14vw] top-1/2 aspect-square w-[86vw] -translate-y-1/2 transition-opacity duration-[1600ms] ease-out sm:right-[-10vw] sm:w-[62vw] lg:right-[-6vw] lg:w-[46vw] ${
            shown ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/flat-world.svg"
            alt=""
            className="h-full w-full opacity-[0.22] mix-blend-screen"
          />

          {/* The network and the marks, in the same coordinate space. */}
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible">
            <g stroke="#f7dc79" fill="none" strokeLinecap="round">
              {LINKS.map((m, i) => {
                const [x1, y1] = at(ORIGIN.lon, ORIGIN.lat);
                const [x2, y2] = at(m.lon, m.lat);
                // A gentle arc, not a straight chord. A great circle on this
                // projection is a curve, and a dead-straight line between two
                // points on a globe is the tell of a diagram that has never
                // met a map.
                const mx = (x1 + x2) / 2 + (y2 - y1) * 0.12;
                const my = (y1 + y2) / 2 - (x2 - x1) * 0.12;
                return (
                  <path
                    key={m.country}
                    d={`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`}
                    strokeWidth={0.22}
                    strokeOpacity={0.5}
                    pathLength={1}
                    strokeDasharray={1}
                    strokeDashoffset={shown ? 0 : 1}
                    style={{
                      transition: `stroke-dashoffset 1400ms cubic-bezier(0.22,1,0.36,1) ${420 + i * 160}ms`,
                    }}
                  />
                );
              })}
            </g>

            <g>
              {MARKS.map((m, i) => {
                const [x, y] = at(m.lon, m.lat);
                return (
                  <g
                    key={`${m.country}-${m.name ?? 'nation'}`}
                    style={{
                      opacity: shown ? 1 : 0,
                      transition: `opacity 700ms ease-out ${700 + i * 130}ms`,
                    }}
                  >
                    <circle cx={x} cy={y} r={2.6} fill="#f7dc79" fillOpacity={0.12} />
                    {/* A named site is a filled dot; a nation is an open ring.
                        The same distinction the register draws everywhere. */}
                    {m.establishment ? (
                      <circle cx={x} cy={y} r={0.85} fill="#f7dc79" />
                    ) : (
                      <circle cx={x} cy={y} r={0.9} fill="none" stroke="#f7dc79" strokeWidth={0.4} />
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      </div>

      {/* ---- LAYER 3: THE CONTENT ------------------------------------- */}

      {/* BLOCK ONE — the sentence the homepage is here to say. */}
      <div className="relative flex min-h-[92svh] items-center px-5 py-28 sm:px-8 lg:px-16">
        <div className="max-w-3xl">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brand-gold">
            Global presence
          </p>
          <h2
            id="presence-heading"
            className="mt-8 font-heading text-[clamp(2.6rem,6.4vw,5.4rem)] font-bold leading-[0.99] tracking-[-0.035em] [text-wrap:balance]"
          >
            Wherever you study, you belong to the same university.
          </h2>
          <p className="mt-10 max-w-xl text-[16px] leading-relaxed text-white/85 sm:text-[17.5px]">
            The same academic standards, the same faculty, the same examinations and the
            same credential — on campus, in-country, or online.
          </p>
        </div>
      </div>

      {/* BLOCK TWO — the footprint, as a register and not as cards.
          Asymmetric: it sits to the left of the disc, which is bleeding off the
          right, so the two halves of the composition are doing different work
          rather than mirroring each other. */}
      <div className="relative px-5 pb-32 sm:px-8 lg:px-16">
        <div className="max-w-2xl rounded-[1.75rem] bg-[#160c22]/55 p-8 backdrop-blur-[2px] sm:p-11">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.3em] text-brand-gold">
            The footprint
          </p>

          {/* CONCISE, ON PURPOSE. Each line is a place and what it is. The
              campus pages, the international page and the online-learning page
              carry the detail; repeating it here would make the homepage a
              worse version of three pages that already exist. */}
          <dl className="mt-8">
            {NATIONS_FULL.map((n) => {
              const named = n.sites.filter((s) => s.name).map((s) => s.name);
              return (
                <div
                  key={n.id}
                  className="grid gap-x-8 gap-y-1 border-t border-white/12 py-4 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]"
                >
                  <dt className="font-heading text-[17px] font-bold leading-tight">
                    {n.country}
                  </dt>
                  <dd className="text-[14px] leading-snug text-white/70">
                    <span className="text-brand-gold/95">{n.kind}</span>
                    {named.length > 0 && (
                      <span className="text-white/55"> · {named.join(' · ')}</span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>

          <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
            <Link
              href="/campus-life"
              className="group inline-flex items-center gap-2.5 border-b-2 border-brand-gold/45 pb-1 font-heading text-[14.5px] font-bold text-brand-gold transition hover:border-brand-gold"
            >
              Campus life
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
            <Link
              href="/international"
              className="group inline-flex items-center gap-2.5 border-b-2 border-white/25 pb-1 font-heading text-[14.5px] font-bold text-white/90 transition hover:border-brand-gold hover:text-brand-gold"
            >
              International students
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
            <Link
              href="/online-learning"
              className="group inline-flex items-center gap-2.5 border-b-2 border-white/25 pb-1 font-heading text-[14.5px] font-bold text-white/90 transition hover:border-brand-gold hover:text-brand-gold"
            >
              How online study works
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
