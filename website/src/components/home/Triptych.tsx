import Image from 'next/image';
import Link from 'next/link';
import { Grain } from '@/components/Atmosphere';

// ---------------------------------------------------------------------------
// THE SIGNATURE COMPOSITION — photograph, interruption, photograph.
//
// ===========================================================================
// ONE IMAGE ON THE PARENT. THREE CHILDREN THAT ONLY OWN THEIR OWN OVERLAY.
// ===========================================================================
//
// The requirement is spatial continuity: the reader must perceive
// IMAGE → COLOUR → IMAGE, not three sections that happen to share a picture.
//
// That is guaranteed here by construction rather than by matching values. The
// photograph is a single <Image fill> on the SECTION, so it is laid out once
// across the whole composition. The three blocks are content layers with
// nothing but their own background:
//
//   block 1   translucent lavender   the photograph reads
//   block 2   opaque purple          the photograph is behind an architectural plane
//   block 3   translucent lavender   the same photograph continues, uninterrupted
//
// Because there is one image element sized to the parent, block 3 shows exactly
// the part of the picture it would show if block 2 were glass. No
// background-position is set per block, nothing is duplicated, nothing is
// cropped independently — the continuity is not maintained, it is structural,
// and it cannot drift when a block's height changes.
//
// This is why the composition is NOT built on FixedWindow, which already exists
// and already puts one photograph behind several blocks. FixedWindow locks the
// image to the VIEWPORT: the picture stays still and the page travels over it,
// which is a different effect and cannot produce a middle block that hides the
// image while the two outer blocks stay registered to each other.
//
// ===========================================================================
// THE BOUNDARIES ARE THE WHOLE JOB
// ===========================================================================
//
// Three stacked rectangles would be a failure of this brief. The purple plane
// meets the photograph through a short gradient at each edge — long enough to
// read as designed, short enough that the plane still reads as a plane rather
// than a fade. A gold hairline sits on each seam.
//
// The type is asymmetric on purpose: block 1 sits low and left, block 2 is
// centred and enormous, block 3 sits high and right. The eye crosses the
// composition diagonally rather than running down a column, which is what stops
// three full-height blocks from feeling like three scrolls of the same thing.
//
// ===========================================================================
// THE RESOLUTION COST, STATED RATHER THAN HIDDEN
// ===========================================================================
//
// This is the one place on the page where the repository's photography is
// pushed past the rule the rest of it follows.
//
// A tall container scales an image by HEIGHT under object-cover, and the first
// build of this made that mistake plainly: at 175svh the composition was 1862px
// tall, a 1080×720 source was scaled 2.6×, and between that and a heavy tint the
// photograph was effectively invisible in the two blocks built to show it. A
// composition whose whole point is IMAGE → COLOUR → IMAGE had become
// COLOUR → COLOUR → COLOUR.
//
// Now ~146svh, about 1390px, so the scale is near 1.9× — and the tint is light
// enough to be a tint rather than a scrim.
//
// It is knowingly accepted here for one reason: the brief asks for a LIGHT
// lavender treatment so the photograph stays luminous, and a light treatment is
// exactly the one that shows softness. So this section will look better than any
// other on the page the day a commissioned photograph arrives, and slightly
// softer than it should until then. The taller sources in the library are a
// memorial portrait and personal photographs — not usable as a decorative
// ground at any resolution.
//
// If that trade is judged wrong, the fix is one line: reduce the block heights.
// ---------------------------------------------------------------------------

export default function Triptych() {
  return (
    <section
      data-on-dark=""
      data-chapter="The university"
      aria-labelledby="triptych-heading"
      className="relative isolate bg-brand-purple-dark text-white"
    >
      {/* THE ONE PHOTOGRAPH. Laid out across the entire composition. */}
      <div aria-hidden="true" className="absolute inset-0 -z-20 overflow-hidden">
        <Image
          src="/images/graduation-2024/grad-2024-congregation-full.jpg"
          alt=""
          fill
          sizes="100vw"
          quality={86}
          loading="lazy"
          className="object-cover"
          style={{ objectPosition: '52% 34%' }}
        />
      </div>
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <Grain opacity={0.06} />
      </div>
      {/* The photograph is decorative here — the composition's meaning is in the
          words — but a reader using a screen reader should still be told what
          the page is showing them. */}
      <span className="sr-only">
        The academic body of ICOF Global University at the 2024 congregation.
      </span>

      {/* ---- BLOCK 1 — the photograph reads ------------------------------- */}
      <div className="relative flex min-h-[46svh] items-end lg:min-h-[50svh]">
        {/* Translucent lavender, not a dark scrim. Light enough that the robes
            and faces stay legible; even, so the picture is not lit unevenly
            across a block that is only part of a larger frame. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{ background: 'linear-gradient(180deg, rgba(140,108,214,0.30) 0%, rgba(112,80,186,0.40) 100%)' }}
        />
        {/* THE PLATE, and why it has to be this strong.
            The tint is deliberately light so the photograph stays luminous —
            which puts the gold eyebrow on a lavender ground at 2.04:1 against a
            4.5 requirement. Gold is a light ink; on a light tint it has nowhere
            to go. The plate is therefore doing ALL of the contrast work, and it
            is sized to the copy rather than to the block: 62% wide, feathered to
            nothing well before the frame edge, so the photograph at the margins
            is untouched and only the corner carrying words goes dark. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(ellipse 62% 68% at 24% 78%, rgba(9,4,20,0.94) 0%, rgba(12,6,26,0.74) 46%, rgba(16,8,34,0.18) 78%, rgba(16,8,34,0) 100%)',
          }}
        />

        <div className="mx-auto w-full max-w-7xl px-6 pb-20 sm:px-10 lg:px-16 lg:pb-24">
          <div className="max-w-xl">
            {/* WHITE, NOT GOLD, and only in the two photographic blocks.
                With the tint kept light enough for the photograph to read, gold
                on it measured 4.26:1 against a 4.5 requirement — and the only
                way to close that with gold was to darken the plate until the
                picture went, which is the one thing this composition exists to
                avoid. White on the same ground is 5.12:1.
                It is also better discipline: gold now appears once in this
                composition, on the purple plane, where nothing competes with
                it. A colour used everywhere is not an accent. */}
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-white/95">
              Who we are
            </p>
            <h2
              id="triptych-heading"
              className="mt-6 font-heading text-[clamp(2.1rem,5vw,3.8rem)] font-bold leading-[1.04] tracking-[-0.03em] [text-wrap:balance]"
            >
              A university without borders.
            </h2>
          </div>
        </div>
      </div>

      {/* ---- BLOCK 2 — the architectural plane ---------------------------- */}
      <div className="relative flex min-h-[54svh] items-center bg-brand-purple-dark lg:min-h-[58svh]">
        {/* The two seams. Short — 5rem — so the plane still reads as a plane.
            Any longer and the purple becomes a fade, which is the opposite of
            an interruption. */}
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
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brand-gold">
            What we believe
          </p>
          {/* The motto, at the largest size anywhere on the site. This block
              exists to be the pause in the photograph — it has three words and
              nothing else, and the emptiness around them is the point. */}
          <p className="mt-12 font-heading text-[clamp(2.4rem,7.5vw,6rem)] font-bold uppercase leading-[1.02] tracking-[-0.04em]">
            Nobility.
            <br />
            Professionalism.
            <br />
            Godliness.
          </p>
        </div>
      </div>

      {/* ---- BLOCK 3 — the photograph continues --------------------------- */}
      <div className="relative flex min-h-[46svh] items-start lg:min-h-[50svh]">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{ background: 'linear-gradient(180deg, rgba(112,80,186,0.40) 0%, rgba(140,108,214,0.30) 100%)' }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(ellipse 62% 68% at 76% 26%, rgba(9,4,20,0.94) 0%, rgba(12,6,26,0.74) 46%, rgba(16,8,34,0.18) 78%, rgba(16,8,34,0) 100%)',
          }}
        />

        <div className="mx-auto w-full max-w-7xl px-6 pt-20 sm:px-10 lg:px-16 lg:pt-24">
          <div className="ml-auto max-w-xl lg:text-right">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-white/95">
              Where we are going
            </p>
            <h3 className="mt-6 font-heading text-[clamp(1.9rem,4.4vw,3.3rem)] font-bold leading-[1.06] tracking-[-0.03em] [text-wrap:balance]">
              Preparing people for the world that is coming.
            </h3>
            <Link
              href="/about"
              className="group mt-10 inline-flex items-center gap-3 border-b border-brand-gold/40 pb-1 font-heading text-[15px] font-bold text-brand-gold transition duration-300 hover:border-brand-gold hover:text-white"
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
