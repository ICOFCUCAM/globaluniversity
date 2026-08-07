import Image from 'next/image';
import { Grain } from '@/components/Atmosphere';

// ---------------------------------------------------------------------------
// PHOTOGRAPH AS ARCHITECTURE.
//
// ===========================================================================
// THE CORRECTION THIS COMPONENT IS BUILT ON
// ===========================================================================
//
// This repository's photography was assessed once and judged unusable: of 117
// images, none exceeds 3000px, two exceed 2000px, and the widest of all —
// wp/footer-building.jpg, 2560×1754 — is a Cambridge college that had no
// business being here. On that basis the hero dropped photography entirely.
//
// That judgement was right for ONE treatment and wrong for another, and the
// difference is worth writing down because it decides how this whole page is
// built.
//
//   A photograph used as a SUBJECT — sharp, opaque, in the foreground, the
//   thing the eye is asked to examine — needs roughly twice its rendered CSS
//   width in real pixels, because the reader is looking AT it and a retina
//   panel will show every interpolated edge. At a 1440px band that means a
//   2880px source. Nothing here qualifies. Nothing.
//
//   A photograph used as ARCHITECTURE — behind typography, under a scrim,
//   carrying grain — needs about three quarters of its rendered width. Not
//   because the pixels multiply, but because the artefacts of upscaling live in
//   the mid-tones, and a scrim is precisely an instrument for crushing
//   mid-tones. Add grain over the top and interpolation reads as film.
//
// At a 1440px band the second rule asks for 1080px. FORTY-SEVEN images clear
// it, and they are the right ones: the 2024 graduation in full — procession,
// hooding, doctoral robes, the congregation, the platform party, the
// registration desk — the ceremonial hall, the administration building, the
// Vice-Chancellor at 1815×1978.
//
// So the earlier conclusion stands where it was made and does not generalise.
// The hero still leads with the crest, because a hero photograph IS a subject.
// Everything below the hero can be built out of photography, because those
// photographs are grounds.
//
// ===========================================================================
// WHAT THIS COMPONENT REFUSES TO DO
// ===========================================================================
//
// It has no card. No rounded rectangle, no border, no shadow, no contained
// frame. The image is the full width of the viewport and the type sits on it.
// That is the entire point: a photograph inside a rounded box is a picture of
// the institution, and a photograph the words are set into is the institution.
//
// ---------------------------------------------------------------------------
// THE SCRIM IS TWO GRADIENTS, NOT ONE FLAT WASH
//
// A single flat overlay is the standard way this is done and it is why most
// image-behind-text sections look muddy: it dims the photograph everywhere,
// including the places carrying no text, so the picture is destroyed to make
// one corner readable and the reader gets neither.
//
// Here the scrim is directional — heavy where the words are, opening up where
// they are not — plus a low, even purple that ties the photograph to the
// institution's colour rather than leaving it as a foreign rectangle of
// somebody's white balance.
// ---------------------------------------------------------------------------

export type Anchor = 'left' | 'right' | 'centre' | 'bottom';

export interface CinematicProps {
  src: string;
  /**
   * Empty string when the photograph is atmosphere and the words on top say
   * everything it would say. Real alt text when the picture is itself the
   * information — a ceremony, a person, a building somebody might want
   * described. Deciding this per band is the only honest way to do it; a
   * component that always sets alt="" lies, and one that always demands alt
   * makes a screen reader recite the wallpaper.
   */
  alt: string;
  /** Where the type sits, and therefore where the scrim is heaviest. */
  anchor?: Anchor;
  /** object-position, so a face or a horizon survives every crop. */
  focal?: string;
  /** Above the fold? Only ever true for the topmost image band. */
  priority?: boolean;
  /**
   * How much photograph survives, 0–1. Lower it when the type is long or the
   * picture is busy; raise it when the words are three large ones.
   */
  exposure?: number;
  /** Band height. 'full' is a viewport; 'tall' about three quarters. */
  height?: 'tall' | 'full' | 'half';
  /** The scroll rail's label for this band. Omit to keep it out of the index. */
  chapter?: string;
  className?: string;
  children: React.ReactNode;
}

const HEIGHT: Record<NonNullable<CinematicProps['height']>, string> = {
  // svh, not vh: on iOS a 100vh band is taller than the visible viewport while
  // the browser chrome is showing, so the bottom of every full-height section
  // sits under the address bar until the reader scrolls.
  full: 'min-h-[100svh]',
  tall: 'min-h-[78svh] lg:min-h-[86svh]',
  half: 'min-h-[56svh] lg:min-h-[62svh]',
};

const PLACE: Record<Anchor, string> = {
  left: 'items-end justify-start text-left',
  right: 'items-end justify-end text-left',
  centre: 'items-center justify-center text-center',
  bottom: 'items-end justify-start text-left',
};

// ---------------------------------------------------------------------------
// THE SCRIM RAMP, AND WHY IT IS HELD FLAT BEFORE IT FALLS
//
// The first version ramped straight from its darkest stop at 0% to a mid stop
// at 46%. That reads well as a gradient and fails as a scrim, because the type
// does not live at 0% — it starts around x=145px and runs to x=700px, which on
// a 1440px band is 10% to 49%. So every word sat on the ramp itself, getting
// lighter as it went, and the far end of each line landed near the mid stop.
//
// Measured on the Chancellor band before this change, against the 2024
// congregation photograph — bright yellow and blue regalia, the hardest ground
// on the page:
//
//   body paragraph, white at 75%      3.03:1   fails AA (needs 4.5)
//   eyebrow, gold, 11px               3.47:1   fails AA
//   sub-line, white at 55%            1.62:1   effectively invisible
//
// So the darkest stop is now HELD across the whole width the text occupies and
// only then falls away, and it falls fast. The picture survives — it is fully
// open across the outer half, which is where the photograph is doing its work —
// and the words sit on a consistent ground rather than on a slope.
//
// Exposure still lifts the whole curve, but it can no longer lift it far enough
// to break the type: even at exposure 1 the held stop stays above 0.55.
// ---------------------------------------------------------------------------

/** Directional scrim, keyed to where the words are. */
function scrim(anchor: Anchor, exposure: number): string {
  const deep = `rgba(18,9,34,${(0.90 - exposure * 0.34).toFixed(3)})`;
  const mid = `rgba(22,12,42,${(0.62 - exposure * 0.30).toFixed(3)})`;
  const open = `rgba(29,16,52,${(0.26 - exposure * 0.20).toFixed(3)})`;
  switch (anchor) {
    case 'right':
      return `linear-gradient(255deg, ${deep} 0%, ${deep} 42%, ${mid} 62%, ${open} 84%, ${open} 100%)`;
    case 'centre':
      return `radial-gradient(ellipse 104% 90% at 50% 50%, ${deep} 0%, ${deep} 44%, ${mid} 70%, ${open} 100%)`;
    case 'bottom':
      return `linear-gradient(to top, ${deep} 0%, ${deep} 30%, ${mid} 52%, ${open} 80%, ${open} 100%)`;
    default:
      return `linear-gradient(102deg, ${deep} 0%, ${deep} 42%, ${mid} 62%, ${open} 84%, ${open} 100%)`;
  }
}

export default function Cinematic({
  src,
  alt,
  anchor = 'left',
  focal = '50% 42%',
  priority = false,
  exposure = 0.45,
  height = 'tall',
  chapter,
  className = '',
  children,
}: CinematicProps) {
  return (
    <section
      // data-on-dark is what the scroll rail and the global focus styles read
      // to invert their palette. Every one of these bands is dark by
      // construction, in both themes, so it is never conditional.
      data-on-dark=""
      data-chapter={chapter}
      className={`relative isolate flex overflow-hidden bg-brand-purple-dark text-white ${HEIGHT[height]} ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        // sizes=100vw because the image genuinely is the viewport width. Getting
        // this wrong is the most common next/image mistake: the default assumes
        // a contained image and serves a file too small for a full-bleed band,
        // which is exactly the softness this component is engineered around.
        sizes="100vw"
        priority={priority}
        // Below the fold these are the largest downloads on the page, and there
        // are five of them. Anything not first waits until it is near.
        loading={priority ? undefined : 'lazy'}
        quality={82}
        className="-z-20 object-cover"
        style={{ objectPosition: focal }}
      />

      {/* The directional scrim. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10" style={{ background: scrim(anchor, exposure) }} />

      {/* A low, even purple over everything. Without it a photograph shot under
          fluorescent light sits in the page as a green-grey rectangle with no
          relationship to the institution's colour. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-brand-purple/25 mix-blend-multiply" />

      {/* Grain last. It is what turns upscaling into film — and it is the
          reason a 1080px source can hold a 1440px band at all. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <Grain opacity={0.075} />
      </div>

      {/* A hairline of gold along the foot, so consecutive bands read as
          chapters of one document rather than as separate pages. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-px bg-gradient-to-r from-transparent via-brand-gold/45 to-transparent"
      />

      <div
        className={`relative mx-auto flex w-full max-w-7xl px-6 py-20 sm:px-10 lg:px-16 lg:py-28 ${PLACE[anchor]}`}
      >
        <div className={anchor === 'centre' ? 'w-full max-w-4xl' : 'w-full max-w-2xl'}>{children}</div>
      </div>
    </section>
  );
}
