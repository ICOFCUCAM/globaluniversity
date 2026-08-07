import Link from 'next/link';
import { Aurora, Grain } from '@/components/Atmosphere';
import { flatWorldSvg } from '@/lib/flatWorld';
import { cta } from '@/content/site';

// ---------------------------------------------------------------------------
// THE LAST SCENE — your future starts here, over the world.
//
// ===========================================================================
// WHY THE WORLD AND NOT A PHOTOGRAPH
// ===========================================================================
//
// This closed on a photograph of the 2024 graduates standing with their
// families, chosen on the argument that nobody enrols because a university owns
// a building — they enrol because of what happens to a person who finishes.
// That argument was right about buildings and still landed in the wrong place.
//
// A photograph of one ceremony closes the page on a MEMORY: a particular
// afternoon, particular people, already past. It is the right picture for a
// section about graduation and the wrong one for the moment a reader is being
// asked to begin. What that moment needs is not evidence of what happened, but
// the size of what is on offer.
//
// The world does that in one figure, and it is the university's own — the
// azimuthal equidistant projection from the crest in the header and engraved on
// every certificate it issues, Africa at the foot, every continent on the disc
// at once. A reader deciding whether to apply sees the institution's mark and
// the reach of it in the same drawing. "Your Future Starts Here" over the world
// says something a crowd photograph cannot.
//
// ===========================================================================
// AND IT COSTS NOTHING
// ===========================================================================
//
// flatWorldSvg is pure and deterministic, so this is called once at module
// scope on the server and the markup is inlined: no image request, no lazy
// load, no decode, nothing to shift layout, and no JavaScript. The heaviest
// section on the page is now the lightest — which matters most exactly here,
// at the foot, where a reader on a slow connection arrives last.
//
// The pins are the university's three real locations. See UNIVERSITY_PLACES in
// src/lib/flatWorld.ts for why there are three and not forty.
// ---------------------------------------------------------------------------

const WORLD = flatWorldSvg({
  size: 900,
  colour: '#f7dc79',
  inset: 0.95,
  landOpacity: 0.42,
  places: true,
  id: 'future',
});

export default function FinalScene() {
  return (
    <section
      data-on-dark=""
      data-chapter="Apply"
      className="relative z-10 flex min-h-[92svh] items-center overflow-hidden bg-brand-purple-dark py-28 text-white sm:py-36"
    >
      {/* The world, centred and large, behind everything. Decorative: the places
          it marks are named in the line beneath the buttons, so nothing is lost
          to a reader who cannot see it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 w-[min(115vw,58rem)] -translate-x-1/2 -translate-y-1/2 opacity-[0.52]"
        dangerouslySetInnerHTML={{ __html: WORLD }}
      />

      <Aurora tone="dual" intensity={0.7} fields={2} />
      <Grain opacity={0.06} />

      {/* A vignette so the type at the centre sits on a darker ground than the
          map behind it. Radial rather than flat: the map should stay visible at
          the edges, where no words are. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 54% 56% at 50% 50%, rgba(12,6,26,0.78) 0%, '
            + 'rgba(12,6,26,0.56) 48%, rgba(16,8,34,0.16) 78%, rgba(16,8,34,0) 100%)',
        }}
      />

      <div className="relative mx-auto w-full max-w-4xl px-6 text-center sm:px-10">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brand-gold">
          Admissions
        </p>

        <h2 className="mt-8 font-heading text-[clamp(2.6rem,7vw,5.4rem)] font-bold leading-[1.02] tracking-[-0.03em] text-white [text-wrap:balance]">
          {cta.title}
        </h2>

        <p className="mx-auto mt-8 max-w-2xl text-[15px] leading-relaxed text-white/90 sm:text-lg">
          {cta.text}
        </p>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-5">
          <Link
            href={cta.button.href}
            className="rounded-full bg-brand-gold px-9 py-4 font-heading text-[15px] font-bold text-brand-purple shadow-gold transition duration-300 hover:bg-brand-gold-deep"
          >
            {cta.button.label}
          </Link>
          <Link
            href="/contact"
            className="rounded-full border-2 border-white/55 px-9 py-4 font-heading text-[15px] font-bold text-white transition duration-300 hover:border-brand-gold hover:text-brand-gold"
          >
            Talk to an adviser
          </Link>
        </div>

        {/* The one line of reassurance that belongs at the point of decision,
            and the only place on this page the accreditation is repeated —
            a reader about to fill in a form is entitled to it here even though
            the claim is made in full further up. */}
        <p className="mt-10 font-sans text-[12.5px] text-white/70">
          Accredited by the Ministry of Higher Education since 2007 · Buea · Douala · Nigeria · Online worldwide
        </p>
      </div>
    </section>
  );
}
