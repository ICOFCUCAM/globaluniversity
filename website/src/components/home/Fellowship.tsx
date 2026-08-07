import Link from 'next/link';

// ---------------------------------------------------------------------------
// THE FELLOWSHIP — the one thing about this university nobody else can claim.
//
// ===========================================================================
// WHY THIS SECTION EXISTS
// ===========================================================================
//
// Everything else on this homepage is a claim other universities also make.
// Accredited: so is everyone. Forty-one programmes: a number. Online and on
// campus: standard. Taught by practitioners: every institution says it.
//
// The International Circle of Faith is the exception. A worldwide fellowship of
// colleges, seminaries and ministries across four continents, from which this
// university was founded in 2007 — that is a fact about this institution and no
// other, and it was reduced on the homepage to eleven grey words under the hero
// eyebrow, where it read as a legal sub-heading rather than as heritage.
//
// A university with a distinct origin that hides it is choosing to compete on
// the axes where it is weakest.
//
// ===========================================================================
// WHY IT SITS HERE AND NOT ANYWHERE ELSE
// ===========================================================================
//
// Inside the pinned world window, over the map. That is not decoration: the
// claim being made is geographic — sister institutions across Africa, the
// Americas, Europe and Asia — and it is being made on a projection that shows
// every continent at once with Africa at the foot. The section and its ground
// are saying the same thing in two languages.
//
// It replaces the programme teaser that used to hold this slot, which named the
// four disciplines and their counts — the SAME four names and the SAME four
// counts as the faculties section further down. Two sections, one fact, in one
// page. The teaser's only unique element was its "Explore all programmes"
// button, which has moved to the faculties section where it belongs, beside the
// disciplines it opens.
//
// ===========================================================================
// THE COPY IS NOT WRITTEN, IT IS QUOTED
// ===========================================================================
//
// The sentence below is the university's own, from src/content/pages.ts, where
// it has described the fellowship since before this rebuild. Heritage claims are
// exactly the ones a homepage must not improve on: "sister colleges, seminaries
// and ministries across Africa, the Americas, Europe and Asia" is checkable, and
// anything more resonant that I could write would not be.
// ---------------------------------------------------------------------------

export default function Fellowship() {
  return (
    <section
      data-on-dark=""
      data-chapter="The fellowship"
      aria-labelledby="fellowship-heading"
      // No background: this is inside the world window and the map is the
      // ground. See Triptych.tsx.
      className="relative py-24 text-white sm:py-32"
    >
      <div className="mx-auto w-full max-w-7xl px-6 sm:px-10 lg:px-16">
        <div className="max-w-3xl">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brand-gold">
            The International Circle of Faith
          </p>

          <h2
            id="fellowship-heading"
            className="mt-7 font-heading text-[clamp(1.9rem,4.4vw,3.3rem)] font-bold leading-[1.08] tracking-[-0.03em] [text-wrap:balance]"
          >
            A university within a worldwide fellowship.
          </h2>

          <p className="mt-8 max-w-2xl text-[15.5px] leading-relaxed text-white/80 sm:text-[17px]">
            ICOF Global University belongs to the worldwide fellowship of the International
            Circle of Faith, with sister colleges, seminaries and ministries across Africa, the
            Americas, Europe and Asia. Students join us from many nations — on campus in Buea
            and Douala, through our centre in Nigeria, and online from anywhere in the world.
          </p>

          <Link
            href="/about"
            className="group mt-11 inline-flex items-center gap-3 border-b border-white/45 pb-1 font-heading text-[15px] font-bold text-white transition duration-300 hover:border-brand-gold"
          >
            Our history and identity
            <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
