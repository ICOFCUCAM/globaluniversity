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
      // No background and no overflow-hidden on the SECTION. The rows below
      // carry their own grounds, and overflow-hidden is the kind of property
      // that gets upgraded to `contain` or paired with a transform later —
      // either of which would re-anchor the pinned map inside the window this
      // section now lives in. See Triptych.tsx.
      className="relative"
    >
      {/* ==================================================================
          TWO ROWS: ONE WHITE, ONE TRANSPARENT.

              "this section is too big. divide into to rows. the first white
               and the second transparent"

          As one transparent block this was a screen and a half of dark, with
          a heading, a paragraph, five columns and two buttons all floating on
          the same map. Everything was equally weightless, so nothing led, and
          the map — which is meant to be an environment — became a texture
          behind an entire section of copy.

          Splitting it fixes both at once. The white row is a hard, opaque
          edge: it stops the dark, gives the heading a ground of its own, and
          makes the map's return in the second row an event rather than a
          continuation. And the darkness is now spent only where it earns
          something — on the ladder itself, where the five awards sit over the
          world they can be taken from.

          The white row is a LID over the pinned map for its own height, which
          is exactly what a lid is for here. That is the one case where a
          background inside this window is correct rather than a mistake.
          ================================================================== */}

      {/* ---- ROW 1 — white. The claim. ---------------------------------- */}
      <div className="relative bg-brand-cream py-16 dark:bg-[#181121] sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <p className="font-sans text-xs font-semibold uppercase tracking-[0.25em] text-brand-gold-ink dark:text-brand-gold">
                Academic pathways
              </p>
              <h2
                id="pathways-heading"
                className="mt-4 font-heading text-display font-bold text-brand-purple dark:text-white [text-wrap:balance]"
              >
                Start where you are. Go as far as you intend.
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-brand-muted dark:text-white/65">
                Each award articulates into the next. A completed diploma may carry advanced
                standing into a bachelor&rsquo;s degree, so the first qualification you earn here
                is a step rather than a ceiling.
              </p>
            </div>
          </Reveal>
        </div>
        {/* The seam. A hairline of gold where the white ends and the world
            begins, so the two rows read as one section divided rather than as
            two sections that happen to touch. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-gold/45 to-transparent"
        />
      </div>

      {/* ---- ROW 2 — transparent. The ladder, over the world. ------------

          data-on-dark IS ON THIS ROW, NOT ON THE SECTION, and it matters.
          ScrollRail decides its palette GEOMETRICALLY — it asks whether a
          [data-on-dark] band is behind the rail at the rail's own vertical
          position — so marking a section that is half cream and half dark told
          it "dark" for the whole thing, and the PATHWAYS label rendered in gold
          on the cream row at 1.24:1. Gold is a light ink; on cream it is
          decoration pretending to be text.

          On the row, the rail reads light while it is beside the white and dark
          while it is beside the map, which is what the attribute has always
          meant: "this band is dark even in the light theme". */}
      {/* THE PADDING IS PART OF THE HALVING, NOT AN AFTERTHOUGHT.
          py-20 here was 160px of the 507 this row used to occupy — a third of
          it, spent on air at a seam that already has a white row and a gold
          hairline doing the separating. A band that is deliberately compact
          does not need the vertical breathing room of a band that is
          deliberately spacious. */}
      <div data-on-dark="" className="relative py-6 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {/* The rail. On large screens it is a horizontal journey with a line
              running through it; below that it stacks, because a five-step
              horizontal diagram on a phone is a five-step diagram nobody
              reads. */}
          <div className="relative">
            <span
              aria-hidden="true"
              className="absolute left-[1.125rem] top-0 hidden h-full w-px bg-gradient-to-b from-white/10 via-brand-gold/45 to-white/10 sm:block lg:left-0 lg:top-[1.125rem] lg:h-px lg:w-full lg:bg-gradient-to-r"
            />

            <ol className="relative grid gap-7 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
              {PATHWAY.map((step, i) => (
                <Reveal key={step.award} delay={i * 90}>
                  <li className="group relative rounded-xl focus-within:ring-2 focus-within:ring-brand-gold focus-within:ring-offset-4">
                    {/* THE NUMBER IS INLINE WITH THE AWARD, NOT STACKED ABOVE IT.
                        Stacked, each step cost a 3rem node plus a 1.5rem gap
                        before a single word of it was read — 72px of vertical
                        space per column, in a row that had five columns and
                        therefore paid for it once. Beside the name it costs
                        nothing: the node is shorter than the line of type it
                        sits next to, so the whole rail row is now the height of
                        one heading. That is where half of this section's height
                        went, and no information left with it. */}
                    <span className="flex items-center gap-3.5">
                      <span
                        aria-hidden="true"
                        className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-white/30 bg-brand-purple-dark font-heading text-[13px] font-bold text-white transition duration-500 group-hover:border-brand-gold group-hover:text-brand-gold"
                      >
                        {i + 1}
                      </span>
                      <Link
                        href={step.href}
                        className="font-heading text-[19px] font-bold leading-tight text-white transition group-hover:text-brand-gold"
                      >
                        <span className="absolute inset-0" aria-hidden="true" />
                        {step.award}
                      </Link>
                    </span>

                    <p className="mt-3 font-sans text-[10.5px] font-semibold uppercase tracking-[0.12em] text-brand-gold">
                      {step.duration}
                    </p>
                    <p className="mt-2 text-[13.5px] leading-snug text-white/70">{step.note}</p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>

          <Reveal delay={200}>
            <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/programs"
                className="group inline-flex items-center gap-2.5 rounded-full bg-brand-gold px-8 py-4 font-heading text-[15px] font-bold text-brand-purple shadow-lift transition duration-300 ease-enter hover:bg-brand-gold-deep hover:shadow-lift-lg active:scale-[0.98] active:duration-75"
              >
                Browse all programmes
                <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </Link>
              <Link
                href="/admissions"
                className="group inline-flex items-center gap-2.5 rounded-full border-2 border-white/40 px-8 py-4 font-heading text-[15px] font-bold text-white transition duration-300 ease-enter hover:border-brand-gold hover:text-brand-gold active:scale-[0.98] active:duration-75"
              >
                Entry requirements
                <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
