import Link from 'next/link';
import { Grain } from '@/components/Atmosphere';
import { institutionalFacts } from '@/content/institutionalFacts';

// ---------------------------------------------------------------------------
// THE SIGNATURE COMPOSITION — one photograph held still, three blocks driven
// across it.
//
// ===========================================================================
// THE CORRECTION THAT PRODUCED THIS FILE
// ===========================================================================
//
// The first build of this satisfied the letter of the brief and missed the
// point of it. It put ONE <Image fill> on the section and let three children
// carry their own overlays, so the picture was continuous across all three
// blocks — block 3 showed exactly what it would show if block 2 were glass.
// Structurally guaranteed, measured, and correct in every respect except the
// one that mattered:
//
//     "the background image does not stick. you move and scroll the three
//      containers across the image background"
//
// A parent-scoped background is laid out ONCE and then travels with the page.
// The picture and the blocks move together, so nothing crosses anything —
// scrolling reveals no more of the photograph at the bottom of the composition
// than it did at the top. It is a shared background. It is not a scene.
//
// What is being asked for is the opposite relationship. The photograph does not
// belong to the section at all: it is pinned to the VIEWPORT and does not move,
// and the three blocks are driven up across it. A different part of the picture
// stands behind the words at the end of the scroll than at the beginning, and
// the middle block passes over it like a shutter closing and opening again.
//
//     block 1   OPAQUE        the claim, on solid ground — see below
//     the slot  transparent   whatever the page puts in the window
//     block 2   OPAQUE        the picture is behind an architectural plane
//     block 3   transparent   the same fixed picture, now showing a
//                             different part of itself, because the reader
//                             has travelled and the picture has not
//
// BLOCK 1 STARTED AS A WINDOW AND IS NOW A LID. It was transparent, so the map
// began the instant the hero ended:
//
//     "immidiately after the hero, the next block should not be transparent"
//
// One dissolve too early. The hero is itself a composed image — a building, a
// crest, a headline over photography — and a second picture straight underneath
// gives the reader two photographic environments back to back with nothing
// solid between them. The page never lands before it starts moving again.
//
// ===========================================================================
// HOW THE IMAGE IS HELD STILL
// ===========================================================================
//
//   the section   position: relative; clip-path: inset(0)
//   the picture   position: fixed; inset: 0     (one viewport of photograph)
//
// `clip-path` clips every descendant including fixed ones, so the viewport-sized
// picture is only ever visible through this section. It is the same mechanism
// as FixedWindow.tsx, and the reasoning there applies here in full: NOT
// `background-attachment: fixed`, which iOS Safari has silently ignored for a
// decade, on the single most common device these students will use.
//
// THE SUBTLETY THAT BREAKS IT: clip-path clips fixed descendants but does not
// become their containing block. `transform`, `filter`, `backdrop-filter`,
// `perspective`, `contain`, or `will-change` on any of those WOULD become one —
// at which point `position: fixed` behaves as `position: absolute`, the picture
// scrolls with the section, and this file quietly reverts to the version it
// replaces. A later hand adding `will-change: transform` "for performance"
// would delete the effect without touching a line of it.
//
// scripts/check-scenes.mjs measures the picture's viewport rectangle at three
// scroll depths and fails on any drift at all, and separately proves the first
// two blocks are opaque and the last one is a window.
//
// ===========================================================================
// WHAT PINNING FIXED, BESIDES THE EFFECT
// ===========================================================================
//
// The previous build carried a knowingly-accepted resolution cost, written out
// at length: a parent-scoped image is scaled to the height of the WHOLE
// composition, so a 1080×720 source stretched to 1501px was a 2.1× upscale, and
// the section that most needed a luminous photograph had the softest one.
//
// A fixed picture is one viewport tall no matter how long the composition runs.
// The same source now covers ~900px — about 1.25× — and the blocks can be as
// tall as the scene needs without touching the image quality at all. The cost
// disappeared with the mistake that caused it.
//
// ===========================================================================
// THE WASH, AND THE MISTAKE THIS UNIVERSITY HAS NOW MADE TWICE
// ===========================================================================
//
// The tint is a LIGHT violet, lighter than most of what it covers, so it lifts
// the frame into lavender rather than pushing it toward black. It is flat, not
// a gradient: a gradient over a stationary picture would light one end of the
// image differently from the other as the blocks travelled across it, which is
// exactly the artefact a pinned photograph should not have. It is fixed with
// the picture for the same reason.
//
// The plate — a soft ellipse of darkness behind the words only — is NOT fixed,
// because it belongs to the words and has to travel with them.
//
// The plate is 0.56 and stays there. When a gold eyebrow measured 2.04:1 on the
// first build, the plate was driven 0.70 → 0.86 → 0.94 to rescue it, which is a
// near-black wash: the photograph was buried to save one 11px label. That is
// the fault this university corrected once already on the fixed-window bands,
// and repeating it here earned the note that produced this rewrite. The
// contrast was then solved properly by changing the INK to white — and the
// label was removed altogether, because small text cannot live on a luminous
// photograph at all. White is the lightest ink there is and it still measured
// 3.12:1 against a 4.5 requirement.
//
// Hence: only LARGE type sits on the picture here. That is not a stylistic
// preference. It is the only kind of text this treatment can carry.
// ---------------------------------------------------------------------------

/**
 * The plate behind the words. Feathers to nothing well before the edges, so the
 * map at the margins is untouched and the darkness is spent only where the
 * words already are.
 *
 * THE GEOMETRY IS NOT DECORATIVE. It was `ellipse 64% 70% at 24% 74%`, which
 * puts the ellipse's centre three quarters of the way down a transparent block
 * and gives it a vertical radius of 70% — so at the bottom edge the gradient is
 * only 37% of the way out from its centre and still painting at roughly 0.30
 * alpha. The block ends there and the plate is cut off mid-fade, leaving a hard
 * horizontal band across the map at the seam between two blocks that are both
 * supposed to be windows onto the same picture.
 *
 * Nothing in the CSS is wrong; the gradient is doing exactly what it was told.
 * It is only visible because the map behind it is continuous across the seam,
 * which is the whole point of the composition — the same edge over a per-block
 * background would have been invisible forever.
 *
 * So the vertical radius plus the offset now reach 100% and no further: the
 * plate arrives at zero exactly at the boundary it is not allowed to cross.
 */
const plate = (at: string) =>
  `radial-gradient(ellipse 62% 44% at ${at},` +
  ' rgba(11,5,24,0.40) 0%,' +
  ' rgba(14,7,30,0.24) 46%,' +
  ' rgba(16,8,34,0.08) 76%,' +
  ' rgba(16,8,34,0) 100%)';

export default function Triptych({ children }: { children?: React.ReactNode }) {
  const facts = institutionalFacts();
  // Found by label rather than by index, so a reordering of institutionalFacts()
  // cannot silently promote the wrong number to seven rem. The programme count
  // leads because it answers the question a prospective student actually has —
  // is there enough here for me — and because it is the one figure that grows
  // every time the university opens a course.
  const lead = facts.find((f) => /programme/i.test(f.label)) ?? facts[0];
  const rest = facts.filter((f) => f !== lead);
  const facultyCount = facts.find((f) => /faculties/i.test(f.label))?.value ?? '';
  const established = facts.find((f) => /established/i.test(f.label))?.value ?? '';

  return (
    <section
      data-on-dark=""
      data-chapter="The university"
      data-triptych=""
      aria-labelledby="triptych-heading"
      // relative z-10 so this paints in the positioned layer like every other
      // section — see Section.tsx on why an unpositioned band goes underneath
      // everything it is meant to sit beside.
      //
      // NO `isolate`, NO transform, NO will-change. See the header.
      className="relative z-10 bg-brand-purple-dark text-white"
      style={{ clipPath: 'inset(0)' }}
    >
      {/* THE WORLD, PINNED. A full viewport of it, stationary, seen through
          whichever blocks are transparent at this moment.

          A plain <img>, not next/image: the source is an SVG, and next/image
          would need dangerouslyAllowSVG turned on for the whole site to pass it
          through — a global relaxation of the image pipeline to serve one file
          this repository generates itself. It is also pointless here. There is
          no responsive srcset to build and no format to negotiate: one vector
          file is exact at every width, which is the entire reason it replaced a
          photograph.

          object-cover, so the disc bleeds off the top and bottom of the frame
          rather than floating letterboxed in the middle. The world is meant to
          be the architecture of this section, not a picture of a world placed
          inside it. */}
      <div aria-hidden="true" className="fixed inset-0 -z-20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/flat-world.svg"
          alt=""
          className="h-full w-full object-cover"
          style={{ objectPosition: '50% 50%' }}
        />
      </div>
      {/* NO VIOLET WASH HERE, and the omission is deliberate.
          The tint exists on the photographic bands to hold a luminous picture
          down far enough for white text. This ground is gold line-work on
          near-black: there is nothing to hold down, and a wash over it would
          only mute the coastlines that are the whole point of the upgrade. The
          plate under each block of copy is doing correspondingly less work too
          — 0.38 rather than 0.56. */}
      {/* A LIGHT, EVEN SCRIM — added when the window was extended upward, and
          argued for rather than reached for.
          The rule this repository keeps relearning is: when a light ground
          fails a light ink, change the INK, because darkening the ground always
          works and always costs the picture. It does not apply here, and the
          reason it does not is worth being precise about. The ink is already
          white — the lightest there is — and the text that now sits on the map
          is a five-column ladder at 15px, so it cannot be made larger either.
          Both of the usual answers are exhausted.
          What is left is the ground, and the cost is genuinely different for a
          MAP than for a photograph. A photograph under a wash loses faces,
          depth and the sense that somebody was in the room. Line art loses a
          little contrast and nothing else: at 0.34 every coastline, border and
          graticule circle is still perfectly legible, which is why the land fill
          also came down from 0.26 to 0.17 in the generator. Flat and fixed with
          the map, so it cannot slide across it as the blocks travel. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10"
        style={{ background: 'rgba(16,8,34,0.34)' }}
      />
      <div aria-hidden="true" className="fixed inset-0 -z-10">
        <Grain opacity={0.06} />
      </div>

      {/* The map is decorative — the meaning is in the words — but the
          description has to live on a real element, because the figure above is
          aria-hidden and its alt would never be announced. */}
      <span className="sr-only">
        A map of the world on the azimuthal equidistant projection, centred on
        the North Pole and cut at 60° south, with Africa at the foot.
      </span>

      {/* ---- BLOCK 1 — OPAQUE. The claim, on solid ground. -----------------

              "immidiately after the hero, the next block should not be
               transparent"

          It was transparent, and the map began the instant the hero ended.
          That is one dissolve too early. The hero is itself a composed image —
          a building, a crest, a headline over photography — and running a
          second picture straight underneath it gives the reader two
          photographic environments back to back with nothing solid between
          them. The page never lands before it starts moving again.

          So the claim sits on brand-purple, one step LIGHTER than the
          purple-dark of the hero above it and of the facts plane below. That
          matters: the same colour would have made the hero look as though it
          had simply carried on for another half screen, and the seam would
          have vanished along with the sense that a new chapter had begun.

          The map now first appears at the pathways ladder, which is where the
          university asked to see it. The composition reads:

              opaque claim -> white row -> WORLD -> WORLD -> opaque facts
              -> WORLD

          No plate here either. A plate is a darkened patch for seating words
          on a picture; over a flat, opaque ground it is a stain and nothing
          else. */}
      <div data-block="" className="relative flex min-h-[52svh] items-end bg-brand-purple lg:min-h-[56svh]">
        {/* The seam into the white row below, so the purple does not end at a
            ruled line. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-gold/35 to-transparent"
        />

        <div className="mx-auto w-full max-w-7xl px-6 pb-20 sm:px-10 lg:px-16 lg:pb-24">
          <div className="max-w-xl">
            <h2
              id="triptych-heading"
              className="font-heading text-[clamp(2.1rem,5vw,3.8rem)] font-bold leading-[1.04] tracking-[-0.03em] [text-wrap:balance]"
            >
              A university without borders.
            </h2>
          </div>
        </div>
      </div>

      {/* ---- WHATEVER THE PAGE PUTS INSIDE THE WINDOW ---------------------

          The window used to begin at block 1. The university asked for it to
          start higher:

              "can you make transparent these section. so that we can start
               seeing the flatearth image top"

          Anything rendered here is inside the clip, so the pinned map is behind
          it — which means anything rendered here must have NO background of its
          own and must be set for a dark ground. A section that keeps its white
          background is not transparent, it is a white lid on the window, and
          the map simply stops existing for its whole height.

          IT SITS AFTER BLOCK 1, NOT BEFORE IT, and the order is the argument of
          the chapter. This composition is now the second thing on the page, so
          the first words a reader meets after the hero should be the claim —
          "A university without borders" — and not a five-step ladder of awards.
          Claim, then how far the awards go, then how much there is, then the
          counted evidence, then the promise. Put the ladder first and the
          chapter opens with an administrative diagram.

          A slot rather than an import so page.tsx still shows what the
          composition contains, in order, at a glance. A component that reached
          out and rendered two named sections of its own would hide the shape of
          the homepage inside a file called Triptych. */}
      {children}

      {/* ---- BLOCK 2 — OPAQUE. The shutter. --------------------------------
          bg-brand-purple-dark with no transparency anywhere in it. This is the
          block that hides the fixed picture, and it is the only one that has a
          background at all. */}
      <div data-block="" className="relative flex min-h-[86svh] items-center bg-brand-purple-dark lg:min-h-[92svh]">
        {/* The two seams. Short — 5rem — so the plane still reads as a plane.
            Any longer and the purple becomes a fade, which is the opposite of
            an interruption. They hang outside the block, over the transparent
            neighbours, so the shutter closes softly on a moving picture. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-20 h-20 bg-gradient-to-b from-transparent to-brand-purple-dark"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -bottom-20 h-20 bg-gradient-to-t from-transparent to-brand-purple-dark"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-gold/35 to-transparent"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-gold/35 to-transparent"
        />

        {/* ==================================================================
            TWO SLOGANS HAVE STOOD HERE AND BOTH WERE ASKED TO GO.

            FIRST: NOBILITY. PROFESSIONALISM. GODLINESS., three stacked lines at
            up to 6rem — the largest type anywhere on this site.

                "This concept of nobility professionality and Godliness must be
                 complete reduce to a single Line not so much significant."

            THEN: "Education is owed, not sold", which was smaller and better
            written and still the same species of thing.

                "the sections where we find the words nobilty professionalism
                 and godliness and Education is owned and not sold should be
                 replace with any of the sections with informations and not
                 what i see"

            The second note is the one that identifies what was actually wrong,
            and it is not the size of the type. This is the OPAQUE plane in the
            middle of a pinned map — the one moment the reader is held still
            with nothing else to look at, and the most expensive position on the
            homepage. Spending it on a sentence that cannot be checked is the
            waste. Every university believes in nobility; every university would
            say education is owed. A reader learns nothing from either, and a
            reader who has just been shown a world map is owed something better
            than a motto in return for stopping.

            SO IT CARRIES THE FACTS, and they are the only ones on this site
            that can be evidenced. Every figure is COUNTED by
            institutionalFacts() from the published catalogue, the faculty list,
            the staff rosters and the founding year — nothing here is typed in,
            so nothing here can drift out of step with the prospectus or age on
            the front page the way "15 Years Experience" did.

            This absorbs the At a glance band, which was the first section after
            the hero and one of the three the university called not good. It was
            a scoreboard on cream in the position that should have been carrying
            the argument. The numbers are better here: framed by the world
            rather than announced at a visitor who has not yet been given a
            reason to care how many programmes there are.

            The motto survives as ONE 11px line at the foot, which is where a
            motto belongs — present and attributable, not pretending to be the
            reason anybody should come.
            ================================================================== */}
        <div className="mx-auto w-full max-w-5xl px-6 py-24 text-center sm:px-10 lg:px-16">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brand-gold">
            {lead.label}
          </p>
          <p className="mt-4 font-heading text-[clamp(4rem,10vw,7.5rem)] font-bold leading-[0.85] tracking-[-0.045em]">
            {lead.value}
          </p>
          <p className="mx-auto mt-7 max-w-2xl font-heading text-[clamp(1.15rem,2.3vw,1.6rem)] font-bold leading-snug [text-wrap:balance]">
            across {facultyCount} schools and faculties, taught in Buea, Douala and online
            worldwide.
          </p>

          {/* The rest, small and in one row. They are context for the figure
              above, so they are set as context rather than as rivals to it —
              four numbers at equal weight is a scoreboard, and a reader ranks a
              scoreboard by reading none of it. */}
          <dl className="mx-auto mt-14 flex max-w-3xl flex-wrap justify-center gap-x-14 gap-y-8 border-t border-white/15 pt-10">
            {rest.map((f) => (
              <div key={f.label} title={f.source}>
                <dt className="sr-only">{f.label}</dt>
                <dd>
                  <span className="block font-heading text-[26px] font-bold leading-none">
                    {f.value}
                  </span>
                  <span className="mt-2.5 block max-w-[10rem] font-sans text-[10.5px] font-semibold uppercase leading-snug tracking-[0.16em] text-white/60">
                    {f.label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          <p className="mx-auto mt-12 max-w-2xl text-[15px] leading-relaxed text-white/75">
            Accredited by the Ministry of Higher Education of Cameroon since {established}.
            Every figure here is counted from the university&rsquo;s own catalogue and
            rosters, never estimated.
          </p>

          <Link
            href="/accreditation"
            className="group mt-9 inline-flex items-center gap-3 rounded-full border-2 border-white/30 px-7 py-3.5 font-heading text-[14.5px] font-bold text-white transition duration-300 hover:border-brand-gold hover:text-brand-gold"
          >
            Recognition and accreditation
            <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </Link>

          {/* The motto. One line, 11px, and deliberately no larger. */}
          <p className="mt-16 font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brand-gold">
            Nobility · Professionalism · Godliness
          </p>
        </div>
      </div>

      {/* ---- BLOCK 3 — transparent. The photograph returns. ----------------
          Not the same crop as block 1, and that is the whole effect: the reader
          has travelled roughly a viewport and a half, the picture has not moved
          at all, so a different part of the congregation now stands behind the
          words. */}
      <div data-block="" className="relative flex min-h-[56svh] items-start lg:min-h-[62svh]">
        <div aria-hidden="true" className="absolute inset-0 -z-[5]" style={{ background: plate('76% 44%') }} />

        <div className="mx-auto w-full max-w-7xl px-6 pt-20 sm:px-10 lg:px-16 lg:pt-24">
          <div className="ml-auto max-w-xl lg:text-right">
            <h3 className="font-heading text-[clamp(1.9rem,4.4vw,3.3rem)] font-bold leading-[1.06] tracking-[-0.03em] [text-wrap:balance]">
              Preparing people for the world that is coming.
            </h3>
            {/* WHITE, not gold, and this is the rule the composition is built
                on rather than a colour preference. This link is 15px — small
                text — and it sits on a photograph deliberately kept luminous.
                Gold is a LIGHT ink (#f7dc79 is 0.73 relative luminance); on a
                ground light enough to still be a photograph it cannot reach
                4.5:1, and the only ways to rescue it are to darken the picture
                or enlarge the text. The gold is spent on the hover border,
                where nothing has to be read. */}
            <Link
              href="/about"
              className="group mt-10 inline-flex items-center gap-3 border-b border-white/45 pb-1 font-heading text-[15px] font-bold text-white transition duration-300 hover:border-brand-gold"
            >
              Explore the university
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
