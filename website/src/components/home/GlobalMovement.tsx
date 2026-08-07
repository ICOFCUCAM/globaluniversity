import Link from 'next/link';
import PinnedScene from './PinnedScene';
import { UNIVERSITY } from '@/lib/constants';

// ---------------------------------------------------------------------------
// PART OF A GLOBAL MOVEMENT.
//
// WHY THIS BAND EXISTS AT ALL. The homepage said "accredited by the Ministry of
// Higher Education since 2007" four times — in the hero assurances, under the
// proof band, in full in the standing band, and again in the footer. A claim
// made four times does not become four times as credible; it reads as an
// institution with one thing to say about itself, and it crowded out the fact
// that actually distinguishes this university from any other accredited
// college in the region.
//
// That fact is the fellowship. ICOF Global University is not a school that
// happens to be Christian and happens to have an international student list. It
// is the higher-education expression of the International Circle of Faith, a
// network that was already global before the university existed. THAT is what
// makes "A Global University" a description rather than an aspiration.
//
// So accreditation is now stated once, properly, with its regulator named, in
// the standing band — and this band carries the identity.
//
// ---------------------------------------------------------------------------
// WHAT IS DELIBERATELY NOT CLAIMED HERE
//
// No number of member churches. No count of nations. No founding date for the
// fellowship, no list of countries it operates in, no membership figures. Every
// one of those would be the obvious thing to put in a band like this and not
// one of them can be evidenced from anything in this system.
//
// ---------------------------------------------------------------------------
// AND WHY IT IS PINNED
//
// This is the first claim the page makes about identity, and the one a reader
// is most likely to skim, because "part of a global movement" is the kind of
// sentence every institution writes. Holding the frame takes the choice away:
// the academic body stays in front of them for two thirds of a screen longer
// than a band would, and then the university's own story rises across it.
// ---------------------------------------------------------------------------
//
// The two things said below are both checkable: the university stands within
// ICOF, which its own charter and every prospectus states; and the university
// teaches from Buea, Douala, its Nigerian centre and online, which any
// programme page will confirm. That is the whole band. It is shorter than it
// could be and it is all true.
// ---------------------------------------------------------------------------

export default function GlobalMovement() {
  return (
    <PinnedScene
      src="/images/graduation-2024/grad-2024-congregation-row.jpg"
      alt="Members of the ICOF Global University academic body in doctoral and faculty robes"
      anchor="right"
      focal="52% 24%"
      exposure={0.5}
      hold={175}
      chapter="The fellowship"
    >
      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brand-gold">
        Part of a global movement
      </p>

      <h2 className="mt-8 font-heading text-[clamp(2.1rem,5vw,3.9rem)] font-bold leading-[1.06] tracking-[-0.025em] text-white [text-wrap:balance]">
        A university born of a fellowship that was already global.
      </h2>

      <p className="mt-8 max-w-lg text-[15px] leading-relaxed text-white/90 sm:text-base">
        {UNIVERSITY.name} stands within the International Circle of Faith — a Christian
        network committed to ministry, education, missions and collaboration across
        nations. The university is where that work becomes higher education: academic
        study, professional formation and Christian character held together, and taught
        from Buea, Douala, our centre in Nigeria and online to students on every
        continent.
      </p>

      <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
        <Link
          href="/about"
          className="group inline-flex items-center gap-3 border-b border-brand-gold/40 pb-1 font-heading text-[15px] font-bold text-brand-gold transition duration-300 hover:border-brand-gold hover:text-white"
        >
          Our history and mission
          <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </Link>
        <Link
          href="/accreditation"
          className="group inline-flex items-center gap-3 border-b border-white/25 pb-1 font-heading text-[15px] font-bold text-white/85 transition duration-300 hover:border-brand-gold hover:text-brand-gold"
        >
          Recognition and accreditation
          <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </Link>
      </div>
    </PinnedScene>
  );
}
