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

  return (
    <section
      aria-label="The university at a glance"
      data-chapter="At a glance"
      className="relative border-y border-brand-sand/70 bg-brand-cream"
    >
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-10 sm:gap-y-12 lg:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label} className="group text-center">
              <dt className="sr-only">{f.label}</dt>
              <dd>
                <span className="block font-heading text-[2.75rem] font-bold leading-none tracking-[-0.02em] text-brand-purple sm:text-[3.25rem]">
                  {f.value}
                </span>
                <span
                  aria-hidden="true"
                  className="mx-auto mt-4 block h-[2px] w-8 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold transition-all duration-500 group-hover:w-14"
                />
                <span className="mt-4 block font-sans text-[11px] font-semibold uppercase leading-snug tracking-[0.14em] text-brand-muted sm:text-[12px]">
                  {f.label}
                </span>
              </dd>
            </div>
          ))}
        </dl>

        {/* The line that turns a row of numbers into a claim somebody stands
            behind. Universities publish statistics constantly and almost none
            of them say where they came from; saying so is cheap and it is
            exactly the signal an accreditor, a partner institution or a careful
            parent is looking for. */}
        <p className="mt-12 text-center font-sans text-[12.5px] leading-relaxed text-brand-muted">
          Every figure on this page is counted from the university&rsquo;s own published
          catalogue and records.{' '}
          <Link href="/accreditation" className="font-semibold text-brand-purple underline decoration-brand-gold decoration-2 underline-offset-4 transition hover:text-brand-purple-dark">
            Read our accreditation
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
