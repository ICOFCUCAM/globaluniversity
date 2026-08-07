import Image from 'next/image';
import Link from 'next/link';
import { Grain } from '@/components/Atmosphere';

/**
 * The university's own paragraph about itself and the fellowship it belongs to,
 * from content/site.ts. Quoted, not rewritten: the American spellings
 * ("endeavors", "prioritizing") are the institution's own and correcting them
 * here would put this page out of step with every other place the passage
 * appears.
 */
const ABOUT =
  'The International Circle of Faith (ICOF) represents a contemporary movement committed to reviving and perpetuating the original apostolic message, authority, power, and anointing. With a global reach, ICOF unites ministers and ministries worldwide under a common vision of unity, prioritizing collaboration over division. Emerging from the core principles of ICOF, ICOF Global University endeavors to provide accredited education and training. Since its inception in 2007, our institution has been dedicated to nurturing professionals across various domains, championing excellence in education and service to humanity.';

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
//     block 1   OPAQUE        the About band, on solid ground — see below
//     the slot  MIXED         whatever the page puts in the window; today the
//                             pathway ladder, whose second row is opaque purple
//     window 1  transparent   the map, before the pause — "A university
//                             without borders"
//     block 2   OPAQUE        the plane that interrupts the picture; the page
//                             decides what stands on it, and today that is the
//                             Chancellor's welcome
//     block 3   transparent   the fixed picture, showing a different part of
//                             itself than it would have at the top, because the
//                             reader has travelled and the picture has not
//
// BLOCK 2 HELD THE COUNTED FACTS, WAS DELETED, AND IS BACK AS A SLOT. The
// instruction was "replaced, not removed": the facts had to go, the plane did
// not. It takes whatever the page gives it.
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
// block is opaque, the last one is a window, and something opaque interrupts
// the picture between them.
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

export default function Triptych({
  children,
  plane,
}: {
  /** Sections that sit INSIDE the window, between the first block and the
   *  plane. Anything here must carry no background of its own. */
  children?: React.ReactNode;
  /** What stands on the opaque plane that interrupts the picture. */
  plane?: React.ReactNode;
}) {
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
      <div aria-hidden="true" data-pinned-ground="" className="fixed inset-0 -z-20">
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

      {/* ---- BLOCK 1 — OPAQUE. About the university. -----------------------

              "this image 1 replaces image 2"

          It carried one line — "A university without borders." — on flat
          purple. Handsome, and a poster rather than a section: a reader who has
          just been told what this place is for arrives at a slogan, learns
          nothing, and scrolls.

          It is the About band now, which is the section the university asked
          for: what this institution is, where it came from, and two ways into
          the depth. Opaque, as instructed for the block directly under the
          hero, and on CREAM rather than purple — the hero above and the facts
          plane below are both dark, and three dark sections in a row is one
          long section. The cream is the first light ground on the page and it
          is what makes this read as a new chapter rather than a continuation.

          THE PARAGRAPH IS THE UNIVERSITY'S OWN, from content/site.ts, where it
          has described the relationship with the fellowship since before this
          rebuild. It is not rewritten. A heritage claim is the last thing a
          homepage should improve on.

          AND THE FELLOWSHIP SECTION IS GONE WITH IT. That section made this
          exact claim over the map, in the university's own words, one screen
          later. Two sections, one paragraph, one page — the fault this redesign
          has removed twice already. The claim belongs here, at the top, where a
          reader meets it first. */}
      <div data-block="" className="relative bg-brand-cream py-20 text-brand-ink dark:bg-[#181121] dark:text-white sm:py-24">
        <div className="mx-auto w-full max-w-7xl px-6 sm:px-10 lg:px-16">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
            <div>
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brand-gold-ink dark:text-brand-gold">
                About the university
              </p>

              <h2
                id="triptych-heading"
                className="mt-5 font-heading text-[clamp(1.9rem,4.2vw,3.2rem)] font-bold leading-[1.06] tracking-[-0.02em] text-brand-purple dark:text-white [text-wrap:balance]"
              >
                A university in pursuit of a brighter future
              </h2>

              <span
                aria-hidden="true"
                className="mt-7 block h-[3px] w-20 rounded-full bg-brand-gold"
              />

              <p className="mt-8 max-w-xl text-[15.5px] leading-relaxed text-brand-muted dark:text-white/75 sm:text-[16.5px]">
                {ABOUT}
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  href="/about"
                  className="rounded-full bg-brand-purple px-8 py-4 font-heading text-[15px] font-bold text-white transition duration-300 hover:bg-brand-purple-dark dark:bg-brand-gold dark:text-brand-purple dark:hover:bg-brand-gold-deep"
                >
                  Our history and mission
                </Link>
                <Link
                  href="/governance"
                  className="rounded-full border-2 border-brand-purple/30 px-8 py-4 font-heading text-[15px] font-bold text-brand-purple transition duration-300 hover:border-brand-purple dark:border-white/30 dark:text-white dark:hover:border-brand-gold dark:hover:text-brand-gold"
                >
                  Leadership and governance
                </Link>
              </div>
            </div>

            {/* The photograph runs past the right edge of the container on wide
                screens — a crop of a larger scene rather than a picture sized
                to a slot, and the one thing keeping this off the "heading,
                paragraph, two buttons, image in a box" pattern. */}
            <div className="relative h-72 overflow-hidden sm:h-96 lg:-mr-16 lg:h-full lg:min-h-[26rem] xl:-mr-24">
              <Image
                src="/images/graduation-2024/grad-platform-high-table.jpg"
                alt="The platform party of ICOF Global University standing at the high table during a congregation"
                fill
                sizes="(min-width:1024px) 48vw, 100vw"
                quality={84}
                loading="lazy"
                className="object-cover"
                style={{ objectPosition: '50% 40%' }}
              />
              <div aria-hidden="true" className="absolute inset-0 bg-brand-purple/18 mix-blend-multiply" />
            </div>
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

      {/* ---- THE FIRST WINDOW — transparent. The world, before the pause. --

              "the transparent section showing the flatmap must be between
               these two rows"

          Right, and it fixes a rhythm fault rather than adding decoration. The
          composition ran opaque → opaque → opaque → glass: the About band, the
          ladder and the plane in an unbroken run, with the picture appearing
          once at the very end. A window that only opens on the way out is not a
          window, it is a coda. The map now appears BEFORE the pause and again
          after it, so the plane is genuinely an interruption of something
          rather than the last solid thing before a reveal.

          WHAT IT CARRIES CAME BACK FROM THE CUTTING-ROOM FLOOR. "A university
          without borders." stood in block 1 on flat purple and was replaced,
          correctly, because a slogan on an empty ground is a poster rather than
          a section. Nothing was wrong with the sentence — it was in the wrong
          place. It is a claim about REACH, and here it is set on a map of every
          continent at once with Africa at its foot. The picture is the evidence
          for the words, which is the only good reason to put words on a
          picture.

          Centred and mid-height, because the closing statement below is
          right-aligned and high. Two identical windows would read as one long
          band interrupted by an accident. */}
      <div data-block="" className="relative flex min-h-[52svh] items-center lg:min-h-[56svh]">
        <div aria-hidden="true" className="absolute inset-0 -z-[5]" style={{ background: plate('50% 50%') }} />

        <div className="mx-auto w-full max-w-7xl px-6 py-20 text-center sm:px-10 lg:px-16">
          <p className="mx-auto max-w-3xl font-heading text-[clamp(2.1rem,5.4vw,4rem)] font-bold leading-[1.04] tracking-[-0.03em] [text-wrap:balance]">
            A university without borders.
          </p>
        </div>
      </div>

      {/* ---- BLOCK 2 — OPAQUE. Whatever the page puts on the plane. --------

              "i wanted this part replaced but not removed"
              "replace with this"  [the Chancellor's welcome]

          The counted facts stood here and were removed. Removing the SLOT with
          them was the wrong reading: this is the one moment on the page where
          the reader is held still with nothing else to look at, between two
          views of the world, and a composition that goes ground → ground →
          picture has lost its pause.

          So the plane is a SLOT now, like the window above it, and the page
          decides what stands on it. Today that is the Chancellor's welcome,
          which was a separate band three sections further down.

          It is the right thing to put here for a reason beyond the
          instruction. Everything else in this composition is the institution
          speaking about itself in the third person — what it is, how far its
          awards go, where it reaches. The plane interrupts that with one named
          person saying why the place exists, in his own words, with his face
          beside them. A pause is more than a gap in the picture; it is a change
          of voice.

          The wrapper carries the opaque background so the interruption holds
          even if a future occupant of this slot is transparent. */}
      <div data-block="" className="relative bg-brand-purple-dark">
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
          className="absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-brand-gold/35 to-transparent"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 z-10 h-px bg-gradient-to-r from-transparent via-brand-gold/35 to-transparent"
        />
        {plane}
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
