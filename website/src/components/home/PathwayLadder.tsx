import Link from 'next/link';
import Reveal from '@/components/Reveal';
import { PATHWAY } from '@/content/institutionalFacts';

// ---------------------------------------------------------------------------
// The academic ladder — certificate through doctorate, as one route.
//
// WHY A UNIVERSITY NEEDS THIS ON ITS FRONT PAGE and a college does not. The
// single most common reason somebody does not apply is that they believe the
// door they can reach is the wrong door — they have a certificate's worth of
// confidence and are looking at a page about doctorates. Showing the awards as
// one connected route, rather than five unrelated cards, answers that before
// they leave: you can start where you actually are, and it goes all the way.
//
// It is also the strongest thing this particular university has to say. Every
// award here articulates into the next, and a completed diploma carries advanced
// standing into a degree. That is a genuine structural promise and it was
// visible nowhere on the homepage.
//
// WHY THE DURATIONS COME FROM institutionalFacts.ts. Because the same durations
// are printed on every programme card, and two lists of the same fact drift.
// ---------------------------------------------------------------------------

export default function PathwayLadder() {
  return (
    <section
      data-chapter="Pathways"
      aria-labelledby="pathways-heading"
      className="relative overflow-hidden bg-white py-24 sm:py-32"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.25em] text-brand-gold-deep">
              Academic pathways
            </p>
            <h2
              id="pathways-heading"
              className="mt-4 font-heading text-display font-bold text-brand-purple [text-wrap:balance]"
            >
              Start where you are. Go as far as you intend.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-brand-muted">
              Each award articulates into the next. A completed diploma may carry advanced standing
              into a bachelor&rsquo;s degree, so the first qualification you earn here is a step
              rather than a ceiling.
            </p>
          </div>
        </Reveal>

        {/* The rail. On large screens it is a horizontal journey with a line
            running through it; below that it stacks, because a five-step
            horizontal diagram on a phone is a five-step diagram nobody reads. */}
        <div className="relative mt-16 sm:mt-20">
          <span
            aria-hidden="true"
            className="absolute left-6 top-0 hidden h-full w-px bg-gradient-to-b from-brand-sand via-brand-gold/50 to-brand-sand sm:block lg:left-0 lg:top-[2.15rem] lg:h-px lg:w-full lg:bg-gradient-to-r"
          />

          <ol className="relative grid gap-8 sm:gap-10 lg:grid-cols-5 lg:gap-6">
            {PATHWAY.map((step, i) => (
              <Reveal key={step.award} delay={i * 90}>
                <li className="group relative flex gap-5 sm:pl-0 lg:block">
                  {/* The node. It sits on the rail on desktop and beside the
                      copy on mobile, which is why the rail changes axis. */}
                  <span
                    aria-hidden="true"
                    className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-brand-sand bg-white font-heading text-base font-bold text-brand-purple shadow-sm transition duration-500 group-hover:-translate-y-1 group-hover:border-brand-gold group-hover:bg-brand-purple group-hover:text-brand-gold group-hover:shadow-lift lg:mx-auto"
                  >
                    {i + 1}
                  </span>

                  <div className="min-w-0 lg:mt-6 lg:text-center">
                    <Link
                      href={step.href}
                      className="font-heading text-xl font-bold text-brand-purple transition group-hover:text-brand-purple-dark"
                    >
                      <span className="absolute inset-0" aria-hidden="true" />
                      {step.award}
                    </Link>
                    <p className="mt-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-gold-deep">
                      {step.duration}
                    </p>
                    <p className="mt-3 text-[15px] leading-relaxed text-brand-muted">{step.note}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>

        <Reveal delay={200}>
          <div className="mt-16 flex flex-col items-center gap-4 sm:mt-20 sm:flex-row sm:justify-center">
            <Link
              href="/programs"
              className="group inline-flex items-center gap-2.5 rounded-full bg-brand-purple px-8 py-4 font-heading text-[15px] font-bold text-white shadow-lift transition duration-300 hover:bg-brand-purple-dark hover:shadow-lift-lg"
            >
              Browse all programmes
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
            <Link
              href="/admissions"
              className="group inline-flex items-center gap-2.5 rounded-full border-2 border-brand-purple px-8 py-4 font-heading text-[15px] font-bold text-brand-purple transition duration-300 hover:bg-brand-purple hover:text-white"
            >
              Entry requirements
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
