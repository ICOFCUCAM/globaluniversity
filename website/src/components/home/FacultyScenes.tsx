import Image from 'next/image';
import Link from 'next/link';
import { Grain } from '@/components/Atmosphere';

// ---------------------------------------------------------------------------
// THE KNOWLEDGE — four disciplines on one screen, as an index at scale.
//
// ===========================================================================
// THE SECOND REDESIGN, AND WHY THE STICKY VERSION HAD TO GO
// ===========================================================================
//
// This was four cards in a two-by-two grid. It became a sticky scene: each
// faculty held a full viewport in turn while the photograph behind it changed,
// with focus wired to advance the scene so the keyboard path matched the mouse
// path.
//
// The focus handling was the right solution to a real problem and the scene
// still had to go, because of what it cost: 4.4 SCREENS. With the formation
// scene beside it, two sections were eating 7.4 screens of a 25-screen page —
// thirty per cent of the homepage — to deliver three convictions and four
// faculty names. Four names is not four screens of information. It is a list,
// and a reader looking for their subject was being made to scroll through
// three they did not want to reach the one they did.
//
// That is the specific cruelty of the one-at-a-time device applied to a
// CHOICE. It works for a motto, where the reader is being told something and
// pacing is the point. It is wrong for a menu, where the reader already knows
// what they are looking for and every screen between them and it is friction.
//
// ===========================================================================
// WHAT REPLACES IT — an index, not a grid of cards
// ===========================================================================
//
// Four rows, one screen. The discipline set at title size, the programme count
// beside it, one line of what it is for, and the whole row a link. Separated by
// hairlines rather than enclosed in boxes: a rule groups without containing,
// which is the difference between a page that reads as editorial and one that
// reads as a component library.
//
// Every row is visible, so scanning for "Business" takes an eye movement
// rather than three scrolls. Every row is a single link, so the keyboard path
// is four tab stops in reading order with nothing hidden and nothing to
// advance — the focus-driven scene machinery is gone because there is no
// longer anything to drive.
//
// It also ships no JavaScript. The sticky version was a client component with
// a scroll listener, a rAF loop, focus capture, a reduced-motion query and four
// cross-fading images. This is a server component with one image.
//
// ===========================================================================
// THE PHOTOGRAPHS ARE BACK, AND NOT AS A BACKGROUND
// ===========================================================================
//
// This section went from four ceremony photographs, to one, to none. The four
// were dishonest — nothing in the library shows engineering being taught, so
// the Faculty of Engineering was illustrated by a graduation. The one that
// replaced them was honest but pointless: buried under a 93% scrim, unreadable
// as a picture while still making the type work harder.
//
// Both of those were the same mistake in two sizes: a photograph used as a
// GROUND, dimmed until it was safe to set words on. The university has now
// asked for pictures here again, and pointed at its own /faculty page, where
// each faculty carries an image. So the pictures return in the only way that
// was ever defensible — each one is its own frame, at its own edge of the row,
// with nothing set on top of it. Nothing is dimmed, because nothing has to be.
//
// The honesty problem is unchanged and is handled honestly. These are still
// ceremony photographs: robes, hoodings, congregations. They are not pictures
// of engineering being taught, and they are captioned as what they are —
// "a hooding at the 2024 congregation", not "engineering students at work".
// A reader is shown the university, truthfully, beside each discipline.
// Commissioning one teaching photograph per faculty remains the highest-value
// change available to this page and only the university can make it.
//
// ===========================================================================
// WHY THIS IS NOT A CARD GRID
// ===========================================================================
//
// The /faculty page uses cards: rounded corners, shadow, white plate, image
// with the title laid over it, a button at the bottom. That is the correct
// pattern there — it is an index of six equivalent things a reader is choosing
// between, and cards are good at "these are the options".
//
// The instruction here was explicit that it must not look like SaaS, and a
// grid of shadowed rounded cards with an image on top and a link at the bottom
// is precisely the SaaS feature-grid. So this stays a ROW INDEX and gains a
// picture per row: full-bleed rows separated by hairlines, no boxes, no
// shadows, no radius, the numeral and the discipline at title size, the image
// a tall narrow crop at the outer edge. A rule groups without containing,
// which is the difference between editorial and a component library.
//
// The rows ALTERNATE the image side. With five rows all imaged on the left the
// eye runs down a single column of pictures and the type becomes a caption;
// alternating makes the reader cross the page five times and keeps the words
// the subject.
// ---------------------------------------------------------------------------

export interface FacultyScene {
  id: string;
  /**
   * The REAL faculty page slug, which is not the catalogue id.
   * programmeCatalogue.ts keys the disciplines as theology / engineering /
   * business / education; faculties.ts keys the pages as theology-buea /
   * engineering-technology / gibmas / education. Three of the four differ, so
   * a link built from the catalogue id 404s on three faculties out of four.
   * facultyLinks.test.mjs fails the build if any of these stops resolving.
   */
  slug: string;
  name: string;
  mission: string;
  count: number;
  /** The faculty's photograph. Its own frame at the edge of the row — never a
   *  ground under the type. */
  src: string;
  alt: string;
  focal?: string;
}

export default function FacultyScenes({
  faculties,
  total,
}: {
  faculties: FacultyScene[];
  /** Programmes in the whole catalogue. Counted by the caller, never typed. */
  total: number;
}) {
  return (
    <section
      data-on-dark=""
      data-chapter="Faculties"
      aria-labelledby="faculties-heading"
      className="relative z-10 overflow-hidden bg-brand-purple-dark py-24 text-white sm:py-28"
    >
      {/* NO PHOTOGRAPH BEHIND THIS SECTION.

          It carried a full-bleed procession shot under a 93% scrim, which is
          the worst of both: the picture was unreadable as a picture and the
          type still had to fight it. A photograph dimmed until it is safe to
          set text on is not photography, it is expensive texture.

          The four disciplines are a typographic index. What they need is a
          quiet ground and room, not a picture behind them — and the sections
          on either side are already carrying real imagery. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <Grain opacity={0.07} />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-6 sm:px-10 lg:px-16">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brand-gold">
          Schools and faculties
        </p>
        <h2
          id="faculties-heading"
          className="mt-7 max-w-3xl font-heading text-[clamp(1.9rem,4vw,3.1rem)] font-bold leading-[1.1] tracking-[-0.02em] text-white [text-wrap:balance]"
        >
          Five disciplines. One standard.
        </h2>
        {/* The scale of the catalogue, stated once. It used to be the opening
            line of a separate programme teaser that then listed the same four
            disciplines with the same four counts as the rows below — one fact,
            two sections, one page. */}
        <p className="mt-6 max-w-xl text-[15.5px] leading-relaxed text-white/70 sm:text-[17px]">
          {total} programmes, from a one-year certificate to a doctorate, on campus in Buea and
          Douala and online worldwide.
        </p>

        <ul className="mt-14">
          {faculties.map((f, i) => {
            // Alternating sides. See the header: five pictures stacked in one
            // column turn the type into captions.
            const imageRight = i % 2 === 1;
            return (
              <li key={f.id}>
                <Link
                  href={`/faculty/${f.slug}`}
                  // The whole row is the link — not a trailing "Explore" that
                  // makes the reader aim at eleven characters. `group` drives
                  // the hover and focus states; focus-visible sits on the row
                  // so a keyboard reader sees the same target a mouse does.
                  // THE COLUMN TEMPLATE SWAPS WITH THE ORDER, and it has to.
                  // The first build alternated only the `order` of the three
                  // cells against a fixed [15rem, 1fr, auto] template, so on
                  // reversed rows the photograph landed in the `auto` column
                  // and collapsed to nothing while the heading was squeezed
                  // into 15rem and wrapped to three lines. It looked like the
                  // image had failed to load. `order` moves what is IN a
                  // column; it does not move the column.
                  className={`group grid items-center gap-x-10 gap-y-6 border-t border-white/15 py-9 transition-colors duration-300 hover:border-brand-gold/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-4 focus-visible:ring-offset-brand-purple-dark ${
                    imageRight
                      ? 'lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,15rem)]'
                      : 'lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto]'
                  }`}
                >
                  {/* THE PHOTOGRAPH. Its own frame, no radius, no shadow, no
                      plate — nothing is set on it, so it needs no scrim and
                      runs at full strength. A thin gold rule on the outer edge
                      ties it to the row without boxing it in. */}
                  <span
                    className={`relative block h-40 w-full overflow-hidden sm:h-44 lg:h-32 ${
                      imageRight ? 'lg:order-3' : 'lg:order-1'
                    }`}
                  >
                    <Image
                      src={f.src}
                      alt={f.alt}
                      fill
                      sizes="(min-width:1024px) 15rem, 100vw"
                      quality={80}
                      loading="lazy"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                      style={{ objectPosition: f.focal ?? '50% 40%' }}
                    />
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 bg-brand-purple/25 mix-blend-multiply transition-opacity duration-500 group-hover:opacity-0"
                    />
                    <span
                      aria-hidden="true"
                      className={`absolute inset-y-0 w-px bg-brand-gold/45 transition-colors duration-300 group-hover:bg-brand-gold ${
                        imageRight ? 'right-0' : 'left-0'
                      }`}
                    />
                  </span>

                  <span className={`min-w-0 ${imageRight ? 'lg:order-1' : 'lg:order-2'}`}>
                    <span className="flex items-baseline gap-5">
                      <span
                        aria-hidden="true"
                        // /75 rather than /40. The numerals are aria-hidden and
                        // decorative, so WCAG arguably exempts them — but a
                        // sighted reader uses them to keep their place, which
                        // makes them information for exactly the people who can
                        // see them. Measured 3.10:1 at /40 against a 4.5
                        // requirement; raising them costs nothing.
                        className="font-heading text-[11px] font-bold tracking-[0.34em] text-brand-gold/75 transition-colors duration-300 group-hover:text-brand-gold"
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="font-heading text-[clamp(1.5rem,2.9vw,2.4rem)] font-bold uppercase leading-[1] tracking-[-0.03em] text-white transition-colors duration-300 group-hover:text-brand-gold">
                        {f.name}
                      </span>
                    </span>
                    <span className="mt-3 block max-w-2xl text-[14.5px] leading-relaxed text-white/80">
                      {f.mission}
                    </span>
                  </span>

                  <span
                    className={`flex items-center gap-6 whitespace-nowrap ${
                      imageRight ? 'lg:order-2 lg:justify-self-end' : 'lg:order-3'
                    }`}
                  >
                    <span className="font-sans text-[12px] font-semibold uppercase tracking-[0.2em] text-brand-gold">
                      {f.count} {f.count === 1 ? 'programme' : 'programmes'}
                    </span>
                    <span
                      aria-hidden="true"
                      // /85 rather than /60. It is decorative and aria-hidden,
                      // so WCAG arguably lets it go — but it is the affordance
                      // that tells a sighted reader the row is a link, which
                      // makes it information for precisely the people who can
                      // see it.
                      className="font-heading text-xl text-brand-gold/85 transition-all duration-300 group-hover:translate-x-1.5 group-hover:text-brand-gold"
                    >
                      →
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* MOVED HERE FROM THE PROGRAMME TEASER, which is deleted. A button
            that opens the full catalogue belongs beside the disciplines it
            opens, not in a section of its own two screens earlier. */}
        <div className="mt-14 flex flex-wrap items-center gap-5">
          <Link
            href="/programs"
            className="group inline-flex items-center gap-3 rounded-full bg-brand-gold px-8 py-4 font-heading text-[15px] font-bold text-brand-purple transition duration-300 hover:bg-brand-gold-deep"
          >
            Explore all programmes
            <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </Link>
          <Link
            href="/admissions"
            className="group inline-flex items-center gap-3 rounded-full border-2 border-white/35 px-8 py-4 font-heading text-[15px] font-bold text-white transition duration-300 hover:border-brand-gold hover:text-brand-gold"
          >
            Entry requirements
            <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
