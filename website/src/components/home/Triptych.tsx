import Image from 'next/image';
import Link from 'next/link';
import { Grain } from '@/components/Atmosphere';

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
//     block 1   transparent   the fixed photograph reads through a violet wash
//     block 2   OPAQUE        the photograph is behind an architectural plane
//     block 3   transparent   the same fixed photograph, now showing a
//                             different part of itself, because the reader
//                             has travelled and the picture has not
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
// scroll depths and fails on any drift at all, and separately proves the middle
// block is opaque and the outer two are not.
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

/** Flat, light, fixed with the picture. Keeps the photograph; carries no text. */
const TINT = 'rgba(148,114,220,0.42)';

/**
 * The plate behind the words. Feathers to nothing well before the edges, so the
 * photograph at the margins is untouched and the darkness is spent only where
 * the words already are.
 */
const plate = (at: string) =>
  `radial-gradient(ellipse 64% 70% at ${at},` +
  ' rgba(11,5,24,0.56) 0%,' +
  ' rgba(14,7,30,0.34) 48%,' +
  ' rgba(16,8,34,0.10) 78%,' +
  ' rgba(16,8,34,0) 100%)';

export default function Triptych() {
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
      {/* THE ONE PHOTOGRAPH. A full viewport of it, stationary, seen through
          whichever blocks are transparent at this moment.
          `fill` sets position:absolute on the <img>, which is why it is wrapped
          in the fixed div rather than being fixed itself. */}
      <div aria-hidden="true" className="fixed inset-0 -z-20">
        <Image
          src="/images/graduation-2024/grad-2024-congregation-full.jpg"
          alt=""
          fill
          sizes="100vw"
          quality={86}
          loading="lazy"
          className="object-cover"
          style={{ objectPosition: '52% 38%' }}
        />
      </div>
      {/* Fixed with the picture, not with the blocks. A wash that scrolled while
          the photograph stayed put would slide its own shading across the image
          — the failure that makes most parallax bands look wrong at one end. */}
      <div aria-hidden="true" className="fixed inset-0 -z-10" style={{ background: TINT }} />
      <div aria-hidden="true" className="fixed inset-0 -z-10">
        <Grain opacity={0.07} />
      </div>

      {/* The photograph is decorative — the meaning is in the words — but the
          alt has to live on a real element, because the picture above is
          aria-hidden and its alt would never be announced. */}
      <span className="sr-only">
        The academic body of ICOF Global University at the 2024 congregation.
      </span>

      {/* ---- BLOCK 1 — transparent. The photograph reads. ------------------
          No background of any kind: everything behind this block is the fixed
          picture. Only the plate, which travels with the words. */}
      <div className="relative flex min-h-[56svh] items-end lg:min-h-[62svh]">
        <div aria-hidden="true" className="absolute inset-0 -z-[5]" style={{ background: plate('24% 74%') }} />

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

      {/* ---- BLOCK 2 — OPAQUE. The shutter. --------------------------------
          bg-brand-purple-dark with no transparency anywhere in it. This is the
          block that hides the fixed picture, and it is the only one that has a
          background at all. */}
      <div className="relative flex min-h-[62svh] items-center bg-brand-purple-dark lg:min-h-[66svh]">
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

        <div className="mx-auto w-full max-w-7xl px-6 py-24 text-center sm:px-10 lg:px-16">
          {/* An eyebrow is legible HERE and nowhere else in this composition,
              because this is the one block with a solid ground under it —
              gold on #2a1c3d, not gold on a photograph. */}
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brand-gold">
            What we believe
          </p>
          {/* The motto, at the largest size anywhere on the site. This block
              exists to be the pause in the photograph — three words and nothing
              else, and the emptiness around them is the point. */}
          <p className="mt-12 font-heading text-[clamp(2.4rem,7.5vw,6rem)] font-bold uppercase leading-[1.02] tracking-[-0.04em]">
            Nobility.
            <br />
            Professionalism.
            <br />
            Godliness.
          </p>
        </div>
      </div>

      {/* ---- BLOCK 3 — transparent. The photograph returns. ----------------
          Not the same crop as block 1, and that is the whole effect: the reader
          has travelled roughly a viewport and a half, the picture has not moved
          at all, so a different part of the congregation now stands behind the
          words. */}
      <div className="relative flex min-h-[56svh] items-start lg:min-h-[62svh]">
        <div aria-hidden="true" className="absolute inset-0 -z-[5]" style={{ background: plate('76% 30%') }} />

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
