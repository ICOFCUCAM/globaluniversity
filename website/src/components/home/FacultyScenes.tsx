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
// THE HONEST LIMITATION, CARRIED FORWARD
// ===========================================================================
//
// There is now ONE photograph rather than four, and that is a quiet
// improvement in truthfulness as well as weight: the four images were all
// ceremony photographs, so the Faculty of Engineering was being illustrated by
// a graduation. Nothing in the library shows engineering being taught, a
// business seminar, or a classroom. One honest atmosphere photograph is better
// than four that imply a specificity they do not have. Commissioning one
// teaching photograph per faculty remains the highest-value change available
// to this page, and only the university can make it.
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
  /** Retained on the type so page.tsx keeps naming them; unused here now. */
  src?: string;
  alt?: string;
  focal?: string;
}

export default function FacultyScenes({ faculties }: { faculties: FacultyScene[] }) {
  return (
    <section
      data-on-dark=""
      data-chapter="Faculties"
      aria-labelledby="faculties-heading"
      className="relative z-10 flex min-h-[100svh] items-center overflow-hidden bg-brand-purple-dark py-24 text-white sm:py-28"
    >
      <Image
        src="/images/graduation-2024/grad-2024-procession-line.jpg"
        alt=""
        fill
        sizes="100vw"
        quality={80}
        loading="lazy"
        className="-z-20 object-cover"
        style={{ objectPosition: '50% 32%' }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(180deg, rgba(12,6,26,0.93) 0%, rgba(14,7,30,0.88) 50%, '
            + 'rgba(12,6,26,0.94) 100%)',
        }}
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-brand-purple/20 mix-blend-multiply" />
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <Grain opacity={0.07} />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-6 sm:px-10 lg:px-16">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brand-gold">
          04 — The knowledge
        </p>
        <h2
          id="faculties-heading"
          className="mt-7 max-w-3xl font-heading text-[clamp(1.9rem,4vw,3.1rem)] font-bold leading-[1.1] tracking-[-0.02em] text-white [text-wrap:balance]"
        >
          Four disciplines. One standard.
        </h2>

        <ul className="mt-14">
          {faculties.map((f, i) => (
            <li key={f.id}>
              <Link
                href={`/faculty/${f.slug}`}
                // The whole row is the link — not a trailing "Explore" that
                // makes the reader aim at eleven characters. `group` drives the
                // hover and focus states below; focus-visible sits on the row
                // so a keyboard reader sees the same target a mouse does.
                className="group grid items-baseline gap-x-8 gap-y-3 border-t border-white/15 py-8 transition-colors duration-300 hover:border-brand-gold/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-4 focus-visible:ring-offset-brand-purple-dark lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_auto]"
              >
                <span className="flex items-baseline gap-5">
                  <span
                    aria-hidden="true"
                    // /75 rather than /40. The numerals are aria-hidden and
                    // decorative, so WCAG arguably exempts them — but a sighted
                    // reader uses them to keep their place, which makes them
                    // information for exactly the people who can see them.
                    // Measured 3.10:1 at /40 against a 4.5 requirement; raising
                    // them costs nothing and settles the argument.
                    className="font-heading text-[11px] font-bold tracking-[0.34em] text-brand-gold/75 transition-colors duration-300 group-hover:text-brand-gold"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="font-heading text-[clamp(1.7rem,3.4vw,2.9rem)] font-bold uppercase leading-[0.98] tracking-[-0.03em] text-white transition-colors duration-300 group-hover:text-brand-gold">
                    {f.name}
                  </span>
                </span>

                <span className="text-[14.5px] leading-relaxed text-white/80">{f.mission}</span>

                <span className="flex items-center gap-6 whitespace-nowrap">
                  <span className="font-sans text-[12px] font-semibold uppercase tracking-[0.2em] text-brand-gold">
                    {f.count} {f.count === 1 ? 'programme' : 'programmes'}
                  </span>
                  <span
                    aria-hidden="true"
                    className="font-heading text-xl text-brand-gold/60 transition-all duration-300 group-hover:translate-x-1.5 group-hover:text-brand-gold"
                  >
                    →
                  </span>
                </span>
                {/* Named for screen readers, which otherwise hear four links
                    that all begin with a number. */}
                <span className="sr-only">— explore {f.name}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div aria-hidden="true" className="border-t border-white/15" />
      </div>
    </section>
  );
}
