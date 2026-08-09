'use client';

// ---------------------------------------------------------------------------
// THE MANAGEMENT SYSTEM'S MASTHEAD — the sign-in screen's band, brought inside.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS
// ---------------------------------------------------------------------------
//
// The University looked at its sign-in screen and its management system side by
// side and asked for the second to be built like the first. They were not the
// same institution to look at. The sign-in screen has a photograph under an
// aubergine wash, light moving across it, a gold rule, and a strip of facts
// along the foot. The moment anyone signed in, all of that fell away and left a
// flat purple rectangle with the hero photograph pasted into the right-hand
// third at fifteen per cent.
//
// Four dashboards had written that rectangle out separately — Admin, Registrar,
// Finance and the shared Office screen — each a copy of the others differing in
// the greeting verb and nothing else. Copies drift. One of them said "Good day"
// and the rest said "Welcome back", which is how you can tell they were never
// meant to be four things.
//
// So there is one band now, and it is built out of the same four atmosphere
// primitives the sign-in screen uses. Not a band that resembles it: the same
// Aurora, the same LightShaft, the same Grain, the same Seam, over the same
// gradient. A member of staff signing in should not feel the institution
// changed at the door.
//
// ---------------------------------------------------------------------------
// WHAT THE STRIP MAY CARRY
// ---------------------------------------------------------------------------
//
// Facts. The sign-in screen's strip reads Campuses / Founded / Faculties, and
// every one of those is in src/lib/constants.ts because the University stated
// it. This strip carries the same kind of thing — which office you are in, what
// today is, how many items are waiting on your own desk — and each caller
// passes what it has actually counted.
//
// It is deliberately not a place for statistics with no provenance. The
// dashboards below it went through that once already: 2,847 students and a
// "+12%" nobody calculated. A band across the top of the screen is the most
// widely-read surface in the system and therefore the worst possible place to
// put a number that came from nowhere.
//
// ---------------------------------------------------------------------------
// THE PHOTOGRAPH, AND WHAT HAPPENS WITHOUT ONE
// ---------------------------------------------------------------------------
//
// It is painted as a background layer ON TOP OF a gradient that is always
// drawn. So if the file is missing — not yet uploaded, renamed, lost in a
// deploy — the band renders as the wash alone: darker, plainer, and completely
// intact. No broken-image glyph, no collapsed height, no alt text sitting in
// the middle of a masthead.
//
// That matters more here than it would elsewhere. This is the first thing every
// member of staff sees after signing in, and a broken image at the top of it
// reads as a broken system underneath.
// ---------------------------------------------------------------------------

import React from 'react';
import { Aurora, Grain, LightShaft, Seam } from '@/components/Atmosphere';
import { IMAGES, UNIVERSITY } from '@/lib/constants';

/** One entry in the strip along the foot. */
export interface MastheadFact {
  /** Small, uppercase, gold. */
  label: string;
  /** What it is. Rendered as given — format numbers before passing them. */
  value: React.ReactNode;
}

interface PortalMastheadProps {
  /** The gold line above the heading. The office, normally. */
  eyebrow: string;
  /** The heading. Kept short — it is set large. */
  title: string;
  /**
   * A trailing part of the heading set in gold, as "University" is on the
   * sign-in screen. Rendered after `title` with a space.
   */
  accent?: string;
  /** One line under the heading. Defaults to the University's own name. */
  lead?: React.ReactNode;
  /** The strip along the foot. Today's date is added unless `date` is false. */
  facts?: MastheadFact[];
  /** Set false where the date is noise — a screen the reader opens all day. */
  date?: boolean;
  /** Buttons. Two at most; this is a masthead, not a toolbar. */
  actions?: React.ReactNode;
  /**
   * A photograph of the person, ringed in gold as the crest is on the sign-in
   * screen. Omitted rather than substituted when there is none: a grey silhouette
   * standing in for a student's face is worse than a heading with no portrait.
   */
  portrait?: string;
  /**
   * The photograph. Defaults to the management system's own — which is NOT the
   * sign-in screen's, because no image on this site is used twice.
   */
  photograph?: string;
}

/**
 * Today, written the way the University writes it everywhere else.
 *
 * `en-GB` rather than the browser's locale on purpose: a date rendered
 * 08/09/2026 to one member of staff and 09/08/2026 to another, in a system
 * whose whole business is dated records, is a fault waiting for a deadline.
 */
function today(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export default function PortalMasthead({
  eyebrow,
  title,
  accent,
  lead,
  facts = [],
  date = true,
  actions,
  portrait,
  photograph = IMAGES.portalHero,
}: PortalMastheadProps) {
  const strip: MastheadFact[] = date
    ? [...facts, { label: 'Today', value: today() }]
    : facts;

  return (
    <section className="relative isolate overflow-hidden rounded-2xl">
      {/* ---- The ground. Painted first and always, so the band survives a
              missing photograph as a wash rather than as a hole. ---- */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-[#241a30] via-[#3a2850] to-[#4b3a6b]"
      />

      {/* ---- The photograph, over it, IN THE BAND'S OWN COLOUR.

              `mix-blend-luminosity` keeps the photograph's light and shade and
              takes its hue from the aubergine underneath. This is not a
              flourish; it is what makes the band safe.

              The first version simply laid the photograph down and put a
              translucent wash over it, which is what the sign-in screen does —
              and the sign-in screen gets away with it because its photograph is
              a dark interior. Tried here with a bright one, the picture went
              straight through the wash and the band came out blue: the
              University's colour lost, on its own masthead, because of which
              file somebody happened to upload.

              Blending on luminosity means the band is aubergine whatever the
              photograph is. Somebody can change the picture without having to
              understand the layer stack, which is the only way this survives
              being maintained by anyone but its author.

              A background layer rather than an <img> for the reason at the top
              of this file: a 404 here costs nothing visible. ---- */}
      {photograph && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center opacity-70 mix-blend-luminosity"
          style={{ backgroundImage: `url(${photograph})` }}
        />
      )}

      {/* ---- The wash, and the light moving through it. The same four
              primitives the sign-in screen puts over its own photograph. ---- */}
      <Aurora tone="dual" intensity={0.45} fields={2} />
      <LightShaft />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-[#241a30]/90 via-[#3a2850]/78 to-[#57549a]/55"
      />
      {/* THE TEXT SIDE IS ALWAYS DEEP. Without this the heading sits over
          whatever happens to be in the left third of the photograph, and the
          contrast of a masthead becomes a property of a JPEG. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-[#1d1428] via-[#241a30]/72 to-transparent"
      />
      <Grain />
      <Seam flip />

      <div className="relative z-10 px-6 py-6 sm:px-7 sm:py-7">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <div className="min-w-0 max-w-2xl">
            {/* The gold eyebrow with its dot — the sign-in screen's, at the
                size a working screen can carry. */}
            <p className="inline-flex items-center gap-2 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e9c14a]">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#e9c14a]" />
              {eyebrow}
            </p>

            <h1 className="mt-2 font-heading text-2xl font-bold leading-tight sm:text-[1.75rem]">
              {/* White falling to gold, as the sign-in screen sets its own
                  title. The plain-colour fallback underneath is what a browser
                  without background-clip renders — text, not nothing. */}
              <span className="text-white [background-image:linear-gradient(175deg,#ffffff_38%,#f7e6b4_82%,#e9c14a_100%)] [background-clip:text] [-webkit-background-clip:text] [-webkit-text-fill-color:transparent]">
                {title}
              </span>
              {accent && <span className="text-[#e9c14a]"> {accent}</span>}
            </h1>

            <p className="mt-1.5 text-sm leading-relaxed text-white/70">
              {lead ?? `${UNIVERSITY.name} · ${UNIVERSITY.descriptor}`}
            </p>
          </div>

          {(actions || portrait) && (
            <div className="flex flex-wrap items-center gap-3">
              {actions}
              {portrait && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={portrait}
                  alt=""
                  className="h-16 w-16 flex-shrink-0 rounded-full object-cover ring-2 ring-[#e9c14a]/60 ring-offset-2 ring-offset-[#3a2850]"
                />
              )}
            </div>
          )}
        </div>

        {/* ---- The strip. Hairline above it and between its entries, which is
                what makes it read as a plinth under the heading rather than as
                a second paragraph. ---- */}
        {strip.length > 0 && (
          // THE DIVIDERS ONLY APPEAR WHERE THE STRIP CANNOT WRAP. Drawn
          // unconditionally they are a bug on a narrow workspace: the last
          // entry drops to a second line and takes its left-hand rule with it,
          // leaving a hairline hanging in the middle of nothing. A rule between
          // two things is only a rule while the two things are side by side.
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-white/10 pt-4 md:flex md:flex-wrap md:items-stretch">
            {strip.map((f, i) => (
              <div
                key={f.label}
                className={i > 0 ? 'md:border-l md:border-white/10 md:pl-6' : ''}
              >
                <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
                  {f.label}
                </dt>
                {/* Tabular, because a masthead strip is read down a column when
                    two of them are open side by side — and because a CGPA is
                    the number a student compares against last term's. */}
                <dd className="mt-0.5 font-heading text-sm font-bold tabular-nums text-white">
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}

/**
 * The masthead's own button treatments.
 *
 * BTN_PRIMARY and BTN_SECONDARY are built for a white card and are unreadable
 * on the wash — which is why all four dashboards were already overriding them
 * inline, each with its own guess at the override. These are that override,
 * written once.
 */
export const MASTHEAD_BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-[#e9c14a] px-4 py-2.5 text-sm font-semibold '
  + 'text-[#241a30] transition-colors hover:bg-[#f3d27a] focus-visible:outline-none focus-visible:ring-2 '
  + 'focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#33234a]';

export const MASTHEAD_BTN_SECONDARY =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/10 px-4 py-2.5 '
  + 'text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 '
  + 'focus-visible:ring-offset-[#33234a]';
