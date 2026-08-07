import Link from 'next/link';
import { ALL_PROGRAMMES } from '@/content/programmeCatalogue';

// ---------------------------------------------------------------------------
// FIND THE PATH THAT IS RIGHT FOR YOU — a doorway, not the room.
//
// ===========================================================================
// WHAT THIS REPLACES, AND WHY THE THING IT REPLACES WAS GOOD
// ===========================================================================
//
// The homepage carried the full programme finder: a search field, three groups
// of filters, live result counts, and six programmes rendered in full with
// their summaries, durations and credit values.
//
// It worked. It was, by some distance, the most useful interaction on the site,
// and it was rebuilt twice — once from cards into rows, once for contrast. None
// of that was wasted, because the finder still exists. It is simply not on the
// front page any more.
//
// It had to go because of what it WAS, which is the Programs page. A homepage
// that contains another page has stopped being a front door: a reader who came
// to find out whether this university is serious is instead handed a filtering
// tool and six programme descriptions, before they have been given a reason to
// want any of them.
//
// ===========================================================================
// A DOORWAY HAS TO OFFER SOMETHING, NOT JUST POINT
// ===========================================================================
//
// The lazy version of this section is a heading and a button. That is a sign,
// not a doorway, and it wastes the one thing the homepage should be doing here:
// making the catalogue feel large and navigable at the same time.
//
// So it states the real shape of the catalogue — the total, and the four
// disciplines with their counts — as four routes straight into the page that
// filters. The reader learns the scale, sees their own subject named, and
// arrives at the finder already narrowed. Every number is counted from the
// catalogue, so none of it can drift.
// ---------------------------------------------------------------------------

const DISCIPLINES = [
  { id: 'theology', label: 'Theology', slug: 'theology-buea' },
  { id: 'engineering', label: 'Engineering & Technology', slug: 'engineering-technology' },
  { id: 'business', label: 'Business & Management', slug: 'gibmas' },
  { id: 'education', label: 'Education', slug: 'education' },
];

export default function ProgrammeTeaser() {
  const total = ALL_PROGRAMMES.length;

  return (
    <section
      data-chapter="Programmes"
      aria-labelledby="programmes-heading"
      className="relative z-10 border-t border-[#eee7db] bg-white py-24 dark:border-white/10 dark:bg-[#150f1e] sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end lg:gap-20">
          <div>
            <h2
              id="programmes-heading"
              className="font-heading text-[clamp(1.9rem,4vw,3.1rem)] font-bold leading-[1.1] tracking-[-0.02em] text-brand-purple dark:text-white [text-wrap:balance]"
            >
              Find the path that is right for you.
            </h2>
            <p className="mt-7 max-w-lg text-[15.5px] leading-relaxed text-brand-muted dark:text-white/70 sm:text-[17px]">
              {total} programmes across theology, technology, business and education — from a
              one-year certificate to a doctorate, on campus and online.
            </p>
          </div>

          <div className="flex lg:justify-end">
            <Link
              href="/programs"
              className="group inline-flex items-center gap-3 rounded-full bg-brand-purple px-8 py-4 font-heading text-[15px] font-bold text-white transition duration-300 hover:bg-brand-purple-dark dark:bg-brand-gold dark:text-brand-purple dark:hover:bg-brand-gold-deep"
            >
              Explore all programmes
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>
        </div>

        {/* Four routes into the catalogue, already narrowed. Counted from
            programmeCatalogue.ts — the same source the finder itself uses, so
            the number a reader sees here is the number they land on. */}
        <ul className="mt-16 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-4">
          {DISCIPLINES.map((d) => {
            const n = ALL_PROGRAMMES.filter((p) => p.facultyId === d.id).length;
            return (
              <li key={d.id}>
                <Link
                  href={`/faculty/${d.slug}`}
                  aria-label={`${d.label} — ${n} programmes`}
                  className="group block border-t border-[#e6ddcb] py-7 transition-colors duration-300 hover:border-brand-gold-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 dark:border-white/12 dark:hover:border-brand-gold/50"
                >
                  <span className="block font-heading text-[2.6rem] font-bold leading-none tracking-[-0.03em] text-brand-purple transition-colors duration-300 group-hover:text-brand-gold-ink dark:text-white dark:group-hover:text-brand-gold">
                    {n}
                  </span>
                  <span className="mt-3 block font-heading text-[16px] font-bold leading-snug text-brand-purple dark:text-white">
                    {d.label}
                  </span>
                  <span className="mt-1.5 block font-sans text-[12.5px] text-brand-muted dark:text-white/55">
                    {n === 1 ? 'programme' : 'programmes'}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
