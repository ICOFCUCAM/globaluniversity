import Image from 'next/image';
import { Grain } from '@/components/Atmosphere';

// ---------------------------------------------------------------------------
// A FIXED WINDOW — the photograph is locked to the viewport, the section is a
// window that travels across it.
//
// ===========================================================================
// WHAT THIS IS, AND HOW IT DIFFERS FROM A STICKY SCENE
// ===========================================================================
//
// A sticky scene — Formation.tsx and FacultyScenes.tsx — holds a photograph
// still by making it sticky INSIDE its own section: the picture and the words
// are locked together, and the pair of them hold while the page scrolls past.
//
// This is the other thing, and it is the one the ICOF site does. The photograph
// does not belong to the section at all — it is locked to the VIEWPORT, and the
// section is a hole cut in the page through which part of it is visible. Scroll
// and the words travel upward across a stationary image; a different part of
// the picture is exposed at the top of the band than at the bottom. The image
// is embedded in the page rather than laid on top of it.
//
// It is what `background-attachment: fixed` does, done in a way that survives
// contact with a phone.
//
// ===========================================================================
// WHY NOT background-attachment: fixed
// ===========================================================================
//
// Because it is ignored on iOS Safari and has been for a decade. Mobile Safari
// silently falls back to `scroll`, so the effect the whole composition is built
// on simply does not happen on the single most common device this university's
// students will use — and it fails silently, which is worse than failing
// loudly. On Android Chrome it works but repaints the whole band on every
// scroll frame, which is the other half of the reason the technique got a bad
// name.
//
// ===========================================================================
// THE CLIP-PATH TRICK, AND THE SUBTLETY THAT MAKES OR BREAKS IT
// ===========================================================================
//
//   the window   position: relative; clip-path: inset(0)
//   the picture  position: fixed; inset: 0        (a full viewport of image)
//
// `clip-path` on the window clips every descendant, including fixed ones, so
// the viewport-sized picture is only visible through the band.
//
// THE SUBTLETY: clip-path clips fixed descendants but does NOT become their
// containing block. That distinction is the entire mechanism. The properties
// that DO establish a containing block for fixed descendants — transform,
// filter, backdrop-filter, perspective, will-change on any of those, and
// contain: paint/layout/strict/content — would each re-anchor the picture to
// the section, at which point `position: fixed` behaves exactly like
// `position: absolute`, the image scrolls with the band, and the effect
// quietly becomes nothing at all.
//
// So: no transform, no filter, no will-change, and no `contain` anywhere
// between this section and the fixed picture. A later hand adding
// `will-change: transform` here for "performance" would delete the effect
// without touching a line of it, and the diff would look like an optimisation.
// scripts/check-scenes.mjs measures the picture's viewport rect at three
// scroll positions and fails if it moved at all.
//
// ===========================================================================
// REDUCED MOTION
// ===========================================================================
//
// Nothing here animates and nothing moves against the reader's scroll — the
// picture is stationary in the viewport, which is the least vestibularly
// provocative thing an image can do. The words move at exactly scroll speed.
// There is no motion to reduce, so there is no reduced-motion branch, and this
// component ships zero JavaScript.
// ---------------------------------------------------------------------------

export interface FixedWindowProps {
  src: string;
  alt: string;
  /**
   * Band height in svh, and the number that decides whether this works.
   *
   * The copy is centred in the band, so across the scroll it travels
   * ±(height − 100)/2 svh either side of the viewport centre. Set this too
   * large and the words ride up UNDERNEATH the sticky header at the top of the
   * band's travel: at 155svh on a 950px viewport the copy reached 14px from the
   * top of the viewport, which is 84px inside a 98px header. The heading was
   * sliced in half and the contrast probe, sampling what was actually behind
   * the glyphs, reported the ground as #f7dc79 — the header's own gold rule.
   *
   * 132 keeps the copy clear of the header at 950px while still travelling
   * ~300px across the stationary photograph, which is more than enough for the
   * window to read. Below about 120 there is too little travel to notice.
   */
  height?: number;
  focal?: string;
  priority?: boolean;
  /** 0–1. How much photograph survives the scrim. */
  exposure?: number;
  anchor?: 'left' | 'right' | 'centre';
  chapter?: string;
  className?: string;
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// THE WASH, AND WHY IT IS A TRANSPARENT VIOLET RATHER THAN A DARK SCRIM
//
// The first version of this band used the same near-black scrim as the sticky
// scenes: rgba(14,7,28,0.94) held across the copy column. It measured
// beautifully — 7/7 elements passing WCAG AA at 8:1 and better — and it was
// the wrong picture entirely, because a photograph under a 94% black wash is
// not a photograph. It is a texture. The reader gets a dark band with words on
// it and no sense that anybody was ever in the room.
//
// The reference the university keeps pointing at does the opposite: an EVEN,
// TRANSPARENT VIOLET laid over the whole frame at roughly half strength. The
// picture stays luminous. Whites go lavender, shadows go plum, faces and chairs
// and a ceiling grid all stay legible, and the band reads as one tinted
// photograph rather than as an image hidden behind a panel. That is what
// "transparent" has meant in every note about this.
//
// So the wash is now two layers doing two different jobs, which is the only way
// to get both properties at once:
//
//   THE TINT is even, violet, and light enough to keep the photograph. It is
//   flat rather than directional — a gradient here would make one end of a
//   stationary image lighter than the other as the window travelled over it,
//   which is precisely the artefact the fixed technique should avoid.
//
//   THE PLATE is a soft ellipse of darkness behind the copy only, feathered out
//   to nothing well before the edges of the frame. It buys the contrast the
//   tint cannot, and it costs the picture almost nothing because it is confined
//   to the area the words already cover.
//
// A single flat wash strong enough for white text destroys the photograph; a
// single wash weak enough to keep the photograph cannot carry text. Splitting
// them is the whole trick.
// ---------------------------------------------------------------------------

/** The even violet tint. Keeps the photograph; does not carry the text. */
function tint(exposure: number): string {
  // Lower exposure = more violet, more picture lost. 0.5 is the reference look.
  const a = (0.72 - exposure * 0.34).toFixed(3);
  return `linear-gradient(180deg, rgba(96,64,163,${a}) 0%, rgba(74,48,132,${a}) 100%)`;
}

/** The soft plate behind the copy. Carries the text; barely touches the frame. */
function plate(anchor: NonNullable<FixedWindowProps['anchor']>): string {
  const at = anchor === 'right' ? '74% 50%' : anchor === 'centre' ? '50% 50%' : '26% 50%';
  // Measured, not chosen. At 0.82/0.66/0.30 the violet tint lifted the ground
  // under the gold links to rgb(114,95,129) and they came in at 4.19:1 against
  // a 4.5 requirement — while the white body copy beside them passed at 9:1 and
  // hid it, which is the same way gold failed on the motto scene. Gold is a
  // light ink: #f7dc79 sits near 0.73 relative luminance and needs a genuinely
  // dark ground that white never asks for.
  //
  // Deepened and widened. The ellipse still feathers to nothing before the
  // frame edges, so the photograph at the margins is untouched — the extra
  // darkness is spent only where the words already are.
  return `radial-gradient(ellipse 72% 74% at ${at},`
    + ' rgba(12,6,26,0.90) 0%,'
    + ' rgba(12,6,26,0.80) 44%,'
    + ' rgba(16,8,34,0.42) 74%,'
    + ' rgba(16,8,34,0) 100%)';
}

export default function FixedWindow({
  src,
  alt,
  height = 132,
  focal = '50% 38%',
  priority = false,
  exposure = 0.5,
  anchor = 'left',
  chapter,
  className = '',
  children,
}: FixedWindowProps) {
  return (
    <section
      data-on-dark=""
      data-chapter={chapter}
      data-fixed-window=""
      // relative z-10 so this band paints in the positioned layer like every
      // other section — see Section.tsx on why an unpositioned band goes
      // underneath everything it is meant to sit beside.
      className={`relative z-10 flex items-center bg-brand-purple-dark text-white ${className}`}
      style={{ minHeight: `${height}svh`, clipPath: 'inset(0)' }}
    >
      {/* A full viewport of photograph, stationary, seen through this band.
          NOT `fill` — next/image's fill sets position:absolute, which would
          anchor it to the section and undo the whole thing. */}
      <div aria-hidden="true" className="fixed inset-0 -z-20">
        <Image
          src={src}
          alt=""
          fill
          sizes="100vw"
          quality={82}
          priority={priority}
          loading={priority ? undefined : 'lazy'}
          className="object-cover"
          style={{ objectPosition: focal }}
        />
      </div>

      {/* The scrim is fixed with the picture, not with the band. If it scrolled
          while the photograph stayed put, the darkest part of the wash would
          slide off the words as the reader moved down the section — which is
          the failure mode that makes most parallax bands unreadable at one end. */}
      <div aria-hidden="true" className="fixed inset-0 -z-10" style={{ background: tint(exposure) }} />
      <div aria-hidden="true" className="fixed inset-0 -z-10" style={{ background: plate(anchor) }} />
      <div aria-hidden="true" className="fixed inset-0 -z-10">
        <Grain opacity={0.075} />
      </div>

      {/* The alt text lives on a real, screen-reader-visible element rather than
          on the decorative fixed layer, because the picture there is aria-hidden
          and its alt would never be announced. */}
      <span className="sr-only">{alt}</span>

      <div
        className={`relative mx-auto flex w-full max-w-7xl px-6 py-24 sm:px-10 lg:px-16 lg:py-32 ${
          anchor === 'right' ? 'justify-end' : anchor === 'centre' ? 'justify-center' : 'justify-start'
        }`}
      >
        <div className={anchor === 'centre' ? 'max-w-4xl text-center' : 'max-w-2xl'}>{children}</div>
      </div>
    </section>
  );
}
