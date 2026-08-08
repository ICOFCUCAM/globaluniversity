'use client';

import { useState } from 'react';
import Link from 'next/link';
import { projectFlatWorld } from '@/lib/azimuthal';
import { NATIONS_FULL } from '@/content/institutionalFacts';

// ---------------------------------------------------------------------------
// WHERE WE TEACH — the locations map.
//
// ===========================================================================
// WHY THE OLD SECTION WAS WRONG, IN THE UNIVERSITY'S OWN WORDS
// ===========================================================================
//
// It read "Five nations. One degree." over a register of six rows.
//
//     "I would also avoid saying 'Five nations. One degree' unless the
//      university can substantiate the accreditation/degree status in each of
//      those countries. The wording should distinguish campuses, centres,
//      in-country teaching locations, and online delivery."
//
// That is the correct objection and it is not a wording problem. A principal
// campus, a research centre that explicitly does not teach, an in-country
// teaching presence and an online platform are four different kinds of thing,
// and a list that renders them as four identical rows has asserted they are the
// same. The heading then totalled them into a claim about degrees.
//
// So the KIND is now the loudest thing about every entry — "Our academic home",
// "Professional development & research", "International teaching presence",
// "Online" — and Nigeria says in its own panel that it is not a teaching campus
// rather than leaving a reader to infer it.
//
// ===========================================================================
// WHY THIS IS A MAP AND NOT SIX CARDS
// ===========================================================================
//
// Six cards is what a page does when it has six of something and no idea what
// they mean. The university asked for one of the signature sections of the
// homepage, and for a map that reads as institutional rather than as a SaaS
// dashboard.
//
// The map is THE UNIVERSITY'S OWN. It is the azimuthal equidistant projection
// on the crest and behind the pinned window — the same drawing, the same file —
// so this section is not decorated with a world, it is the university's mark at
// full size with its own places on it. That is the difference between a premium
// institutional map and a generic one, and it costs nothing because the asset
// already exists and is already cached by the time a reader scrolls here.
//
// THE MAP DOES NOT MOVE. Selecting a nation changes the panel and lights that
// nation's marks; the disc stays exactly where it is. A map that pans and zooms
// on every click is a toy — it makes the reader's eye chase the interface
// instead of reading the institution, and on a phone it is a wrestling match.
//
// ===========================================================================
// THE ACCESSIBLE CONTROL IS THE LIST, NOT THE PINS
// ===========================================================================
//
// The pins are marked aria-hidden and are not focusable. The rail underneath is
// a real tablist: six buttons, arrow-key navigation, aria-selected, and one
// panel with aria-labelledby pointing at the active tab.
//
// Making the pins buttons TOO would double every stop in the tab order for no
// gain — a keyboard reader would meet "United States" twice and have no way to
// know the two do the same thing. One control, one stop, and the pins are what
// the control moves.
// ---------------------------------------------------------------------------

// The pins are placed over the generated flat-world.svg, whose disc is inset to
// 94% of the box. In percentage terms that is a centre at 50/50 and a radius of
// 47 — the same numbers the generator uses, so a pin lands exactly on the mark
// already drawn beneath it rather than a few pixels beside it.
const DISC = { cx: 50, cy: 50, r: 47 };

export default function GlobalPresence() {
  const [active, setActive] = useState(0);
  const nation = NATIONS_FULL[active];
  const named = nation.sites.filter((s) => s.name);

  // ARROW KEYS MOVE BETWEEN TABS, which is what a tablist is required to do and
  // what a row of buttons does not do for free. Home and End jump to the ends.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = NATIONS_FULL.length - 1;
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = active === last ? 0 : active + 1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = active === 0 ? last : active - 1;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = last;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    document.getElementById(`place-tab-${next}`)?.focus();
  };

  return (
    <section
      data-chapter="Global presence"
      aria-labelledby="presence-heading"
      className="relative z-10 bg-brand-cream py-24 dark:bg-[#181121] sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="mb-3 font-sans text-xs font-semibold uppercase tracking-[0.25em] text-brand-gold-ink dark:text-brand-gold">
          Global presence
        </p>
        <h2
          id="presence-heading"
          className="max-w-3xl font-heading text-[clamp(2.2rem,5.4vw,4.2rem)] font-bold leading-[1.04] tracking-[-0.03em] text-brand-purple dark:text-white [text-wrap:balance]"
        >
          One university. Many places.
        </h2>
        <div className="mt-5 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold" />

        {/* THE COMPRESSED SENTENCE IS GONE. It read "Two campuses in Cameroon,
            a professional development centre in Nigeria, accredited degrees
            taught in the United States, Zambia and South Africa, and every
            programme online" — one breath, four different kinds of thing, and
            the grammar makes them sound equivalent. What replaces it says the
            shape and lets each nation state its own case below. */}
        <p className="mt-8 max-w-2xl text-[15px] leading-relaxed text-brand-muted dark:text-white/80 sm:text-base">
          Our academic presence extends from our campuses to teaching locations and
          professional development centres internationally, with online study connecting
          the university to students worldwide.
        </p>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-brand-muted dark:text-white/80 sm:text-base">
          Wherever you study, the university remains one: the same academic standards,
          faculty, curriculum, examinations, student records and credentials.
        </p>

        {/* ---- THE PLATE ------------------------------------------------
            One object, not a row of cards: a dark institutional plate holding
            the map, the panel and the selector. Dark because the map is drawn
            in gold on nothing, and gold on cream is unreadable — and because a
            dark plate on a cream page reads as a plate in a book, which is the
            register this section wants. */}
        <div className="mt-14 overflow-hidden rounded-3xl bg-brand-purple-dark shadow-[0_30px_80px_-40px_rgba(20,10,40,0.6)] ring-1 ring-brand-purple/20 dark:ring-white/10">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)]">
            {/* ---- THE MAP ---- */}
            <div className="relative">
              <div className="relative mx-auto aspect-square w-full max-w-[34rem] p-6 sm:p-10">
                {/* Plain <img>, not next/image: this is an SVG, and routing it
                    through the optimiser would need dangerouslyAllowSVG on for
                    the whole site. It is 92KB gzipped, cached, and already
                    fetched — the pinned window behind the page uses the same
                    file. */}
                {/* A GROUND FOR THE DISC. The map is drawn in gold on nothing,
                    and on flat purple it reads as a faint wireframe. A soft
                    radial lift behind it separates the sphere from the plate —
                    the same trick the drawing already uses on the land, applied
                    to the space the land sits in. */}
                <div
                  aria-hidden="true"
                  className="absolute inset-6 rounded-full bg-[radial-gradient(circle_at_50%_46%,rgba(247,220,121,0.10),rgba(247,220,121,0.03)_58%,transparent_72%)] sm:inset-10"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/flat-world.svg"
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  // FULL STRENGTH. It was held at 90% out of habit — the same
                  // figure is dimmed behind the pinned window because type sits
                  // on it there. Nothing is set on it here, so dimming it only
                  // made the university's own map harder to read.
                  className="relative h-full w-full select-none"
                />

                {/* THE ACTIVE NATION'S MARKS.
                    The disc already carries every place as a small gold mark;
                    this is the one that says WHICH, and it is the only thing on
                    the plate that moves.

                    The layer is inset by exactly the padding the image sits in,
                    so a percentage here is a percentage of the IMAGE and not of
                    the padded box — otherwise every pin drifts outward by the
                    padding, which at 40px on a 544px plate is most of Cameroon. */}
                <div className="pointer-events-none absolute inset-6 sm:inset-10">
                  {nation.sites.map((s) => {
                    const [x, y] = projectFlatWorld(s.lon, s.lat, DISC.cx, DISC.cy, DISC.r);
                    return (
                      <span
                        key={`${s.lon},${s.lat}`}
                        aria-hidden="true"
                        className="absolute -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${x}%`, top: `${y}%` }}
                      >
                        <span className="relative block h-3 w-3">
                          <span
                            className={`absolute inset-0 rounded-full ${
                              s.establishment ? 'bg-brand-gold' : 'border-2 border-brand-gold bg-transparent'
                            }`}
                          />
                          <span className="absolute -inset-3 rounded-full border border-brand-gold/60" />
                          <span className="absolute -inset-6 rounded-full border border-brand-gold/25" />
                        </span>
                      </span>
                    );
                  })}

                  {/* WORLDWIDE HAS NO PIN, because it is not a place. The whole
                      disc lights instead, which is the only honest way to draw
                      "everywhere" on a map of somewhere. */}
                  {nation.sites.length === 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-[3%] rounded-full border border-brand-gold/45 bg-brand-gold/[0.07]"
                    />
                  )}
                </div>
              </div>

              {/* The seam between map and panel on desktop; a rule on mobile. */}
              <div
                aria-hidden="true"
                className="absolute inset-x-8 bottom-0 h-px bg-white/10 lg:inset-y-10 lg:left-auto lg:right-0 lg:h-auto lg:w-px"
              />
            </div>

            {/* ---- THE PANEL ---- */}
            <div
              role="tabpanel"
              id="place-panel"
              aria-labelledby={`place-tab-${active}`}
              className="flex flex-col justify-center px-7 py-10 text-white sm:px-9 lg:py-12"
            >
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-gold">
                {nation.kind}
              </p>
              <h3 className="mt-3 font-heading text-[clamp(1.5rem,3vw,2.1rem)] font-bold leading-[1.08] tracking-[-0.02em]">
                {nation.country}
              </h3>
              {nation.subKind && (
                <p className="mt-2 font-heading text-[14px] font-bold text-brand-gold/90">
                  {nation.subKind}
                </p>
              )}

              <p className="mt-5 text-[14px] leading-relaxed text-white/80">{nation.blurb}</p>

              {/* ONLY SITES THE UNIVERSITY CAN NAME ARE LISTED.
                  A site with no name exists in the register to put a mark on
                  the map, and its role is the nation's own sentence — so
                  rendering it here printed "Accredited programmes taught
                  in-country through our authorised academic presence" twice in
                  the same panel, once as the blurb and once as the entry.
                  Named sites are places; nameless ones are coordinates. */}
              {named.length > 0 && (
                <dl className="mt-7 space-y-4 border-t border-white/15 pt-6">
                  {named.map((s) => (
                    <div key={s.name}>
                      <dt className="font-heading text-[15px] font-bold text-white">{s.name}</dt>
                      <dd className="mt-0.5 text-[13.5px] leading-snug text-white/75">{s.role}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {/* NO LINK WHERE THERE IS NO PAGE. The brief asked for an
                  "Explore United States" link; there is no United States page,
                  and a link to nowhere is worse than no link. */}
              {nation.href && nation.linkLabel && (
                <Link
                  href={nation.href}
                  className="group mt-8 inline-flex w-fit items-center gap-2.5 border-b-2 border-brand-gold/50 pb-1 font-heading text-[14px] font-bold text-brand-gold transition hover:border-brand-gold"
                >
                  {nation.linkLabel}
                  <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </Link>
              )}
            </div>
          </div>

          {/* ---- THE SELECTOR, ACROSS THE FOOT OF THE PLATE ---- */}
          <div
            role="tablist"
            aria-label="Where the university teaches"
            onKeyDown={onKeyDown}
            className="flex gap-px overflow-x-auto border-t border-white/12 bg-white/[0.03]"
          >
            {NATIONS_FULL.map((n, i) => {
              const on = i === active;
              return (
                <button
                  key={n.id}
                  id={`place-tab-${i}`}
                  role="tab"
                  type="button"
                  aria-selected={on}
                  aria-controls="place-panel"
                  // ONE STOP FOR THE WHOLE RAIL. Only the selected tab is
                  // reachable by Tab; the arrow keys move within. That is the
                  // tablist pattern, and it is why six locations do not cost a
                  // keyboard reader six stops on the way past.
                  tabIndex={on ? 0 : -1}
                  onClick={() => setActive(i)}
                  // items-start and a floor on the height, so six tabs whose
                  // labels wrap to different depths still form one clean band.
                  // Without it the tallest label sets the row and the shortest
                  // floats in the middle of it.
                  className={`relative flex min-h-[5.25rem] min-w-[9rem] flex-1 flex-col items-start justify-start px-4 py-4 text-left transition sm:px-5 ${
                    on ? 'bg-white/[0.07]' : 'hover:bg-white/[0.05]'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-0 top-0 h-[3px] transition ${
                      on ? 'bg-brand-gold' : 'bg-transparent'
                    }`}
                  />
                  <span
                    className={`block font-heading text-[14px] font-bold leading-tight ${
                      on ? 'text-white' : 'text-white/70'
                    }`}
                  >
                    {n.country}
                  </span>
                  <span
                    className={`mt-1 block font-sans text-[10.5px] uppercase leading-tight tracking-[0.14em] ${
                      on ? 'text-brand-gold' : 'text-white/45'
                    }`}
                  >
                    {n.shortKind}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
