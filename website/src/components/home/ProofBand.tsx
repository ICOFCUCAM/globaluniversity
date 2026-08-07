import Link from 'next/link';
import { institutionalFacts } from '@/content/institutionalFacts';

// ---------------------------------------------------------------------------
// The proof band — the first thing after the hero.
//
// WHY IT SITS HERE. A visitor arrives with two questions in order: what is this
// place for, and why should I believe you. The hero answers the first. Nothing
// answered the second until the footer, by which point the sceptical reader has
// gone.
//
// WHAT REPLACED WHAT. The homepage carried four figures from the WordPress
// theme it was built on: 7,228 Success Stories, 1,742 Happy Students, 213
// Courses, 15 Years Experience. Not one can be substantiated from anything in
// this system, and two can be checked and are wrong — 213 courses against a
// catalogue of forty-one, and fifteen years against a founding year of 2007,
// which was true in 2022 and has been ageing on the front page ever since.
//
// A university's homepage is not the place to be caught rounding. Every figure
// here is computed — from the catalogue, from the faculty list, from the
// founding year — so none of it can be typed in and none of it can drift out of
// step with the prospectus.
//
// WHY THERE ARE NO ALUMNI OR SATISFACTION NUMBERS. Because this university
// cannot yet evidence them, and those are precisely the numbers an accreditor
// asks to see evidenced. See src/content/institutionalFacts.ts, which records
// each one and the query that will produce it.
// ---------------------------------------------------------------------------

export default function ProofBand() {
  const facts = institutionalFacts();
  // The programme count leads; the rest are its context. Found by label rather
  // than by index so a reordering of institutionalFacts() cannot silently
  // promote the wrong number to eight rem.
  const lead = facts.find((f) => /programme/i.test(f.label)) ?? facts[0];
  const rest = facts.filter((f) => f !== lead);

  return (
    <section
      // A real id, not one the scroll rail invents on mount. The hero links
      // down to this section, and a link whose target only exists after a
      // client component has hydrated is broken for anyone who lands with
      // JavaScript still in flight — which on a slow connection is everyone,
      // for the first second.
      id="at-a-glance"
      aria-label="The university at a glance"
      data-chapter="At a glance"
      className="relative border-y border-brand-sand/70 bg-brand-cream dark:border-white/10 dark:bg-[#181121]"
    >
      {/* ================================================================
          ONE NUMBER LEADS, THREE FOLLOW QUIETLY.

          This was four statistics in an even row, each with a rule under it and
          each the same size — a scoreboard. Four things of equal weight are
          four things a reader has to rank for themselves, and most rank them by
          not reading any of them.

          The reference the university pointed at leads with a single figure at
          enormous scale, gives it a short label above and a sentence of context
          beside it, and lets everything else sit small. That is not a layout
          trick; it is an editorial decision about which fact does the work.

          Here the lead is the programme count, because it is the number that
          answers the question a prospective student actually has — "is there
          enough here for me" — and because it is the one figure on the page
          that grows every time the university opens a course. The founding
          year, the faculty count and the staff count are context for it, not
          rivals to it.

          All four are still counted by institutionalFacts() from the catalogue
          and the rosters. None is typed.
          ================================================================ */}
      <div className="mx-auto max-w-7xl px-6 py-20 sm:px-10 sm:py-24 lg:px-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] lg:items-center lg:gap-20">
          <div>
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-muted dark:text-white/55">
              {lead.label}
            </p>
            <p className="mt-3 font-heading text-[clamp(4.5rem,11vw,8.5rem)] font-bold leading-[0.85] tracking-[-0.045em] text-brand-purple dark:text-white">
              {lead.value}
            </p>
            <p className="mt-5 font-heading text-[clamp(1.15rem,2vw,1.5rem)] font-bold leading-snug text-brand-purple/85 dark:text-white/85">
              across {rest[1]?.value ?? ''} schools and faculties, taught in Buea, Douala and
              online worldwide.
            </p>
          </div>

          <div>
            <p className="text-[15.5px] leading-relaxed text-brand-muted dark:text-white/70 sm:text-[17px]">
              Accredited by the Ministry of Higher Education of Cameroon since{' '}
              {rest[0]?.value ?? ''} — and every figure on this page is counted from the
              university&rsquo;s own catalogue and rosters, never estimated.
            </p>

            <Link
              href="/accreditation"
              className="group mt-8 inline-flex items-center gap-3 rounded-full border-2 border-brand-purple/25 px-7 py-3.5 font-heading text-[14.5px] font-bold text-brand-purple transition duration-300 hover:border-brand-purple dark:border-white/30 dark:text-white dark:hover:border-brand-gold dark:hover:text-brand-gold"
            >
              Recognition and accreditation
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </Link>

            {/* The remaining facts, small and in one line. They are context for
                the figure above, so they are set as context. */}
            <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-5 border-t border-brand-purple/12 pt-7 dark:border-white/12">
              {rest.map((f) => (
                <div key={f.label} title={f.source}>
                  <dt className="sr-only">{f.label}</dt>
                  <dd>
                    <span className="block font-heading text-[24px] font-bold leading-none text-brand-purple dark:text-white">
                      {f.value}
                    </span>
                    <span className="mt-2 block max-w-[9rem] font-sans text-[10.5px] font-semibold uppercase leading-snug tracking-[0.14em] text-brand-muted dark:text-white/55">
                      {f.label}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
