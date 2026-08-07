import Link from 'next/link';
import Reveal from '@/components/Reveal';
import { Aurora, Grain, Seam } from '@/components/Atmosphere';
import { NETWORK_NODES, NETWORK_KINDS } from '@/content/globalNetwork';
import LivingGlobe from './LivingGlobe';

// ---------------------------------------------------------------------------
// The global network — the signature section.
//
// WHY A DRAWN GLOBE AND NOT AN EMBEDDED MAP. An interactive Google or Mapbox map
// costs several hundred kilobytes and a third-party connection on the busiest
// page of the site, cannot be styled to match a purple-and-gold brand, and sets
// cookies from another origin before a visitor has agreed to anything — which,
// for an institution taking applications from Europe, is a consent problem
// rather than a design preference.
//
// It began as a flat equirectangular map and is now a real rotating globe —
// see LivingGlobe.tsx, which also records why it is drawn on a canvas rather
// than in Three.js. Both draw src/lib/worldCoastlines.ts, the same coastline
// data engraved into the security artwork on every certificate this university
// issues: the world on a graduate's diploma and the world on the homepage are
// the same drawing.
//
// WHAT THE MAP MAY AND MAY NOT SHOW.
//
// It shows places the university can name: two campuses, a professional
// development centre, and the fellowship it belongs to. It does NOT show
// "countries where our students live" or "countries where our graduates serve",
// however much stronger those would look — the student register is empty, so
// any such map would be a drawing of a claim rather than a picture of a fact.
// The moment the registry has rows, those layers are a query away; see
// PENDING_MEASURES in institutionalFacts.ts.
//
// A world map with invented pins is the single most checkable lie a university
// can publish, because the first person to ask "which students in Brazil?" ends
// the conversation.
// ---------------------------------------------------------------------------

export default function GlobalNetwork() {
  return (
    <section
      data-chapter="Global network"
      aria-labelledby="network-heading"
      className="relative overflow-hidden bg-brand-purple-dark py-24 text-white sm:py-32"
      // Marks the whole band as a dark surface so the focus ring inverts
      // inside it — see globals.css. Without it a keyboard user tabbing the
      // globe's node list gets an ink-coloured ring on an ink-coloured ground.
      data-on-dark=""
    >
      <Aurora tone="dual" intensity={0.8} fields={2} />
      <Grain opacity={0.05} />
      <Seam />
      <Seam flip />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.25em] text-brand-gold">
              Our global network
            </p>
            <h2
              id="network-heading"
              className="mt-4 font-heading text-display font-bold text-white [text-wrap:balance]"
            >
              One university. Several places. No borders.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-white/80">
              ICOF Global University is global by design rather than by ambition: two campuses in
              Cameroon, a professional development centre in Nigeria, every programme delivered
              online worldwide, and a fellowship of colleges and seminaries on four continents.
            </p>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="mt-16 grid items-center gap-12 sm:mt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-16">
            <LivingGlobe />

            <div>
              <h3 className="font-heading text-2xl font-bold text-white">
                Where the university is
              </h3>
              <p className="mt-4 leading-relaxed text-white/70">
                Two campuses in Cameroon, a professional development centre in Nigeria, every
                programme delivered online, and a fellowship of colleges and seminaries across
                three further continents. Turn the globe, or choose a place.
              </p>

              <dl className="mt-9 space-y-5 border-t border-white/10 pt-8">
                {Array.from(new Set(NETWORK_NODES.map((n) => n.kind))).map((kind) => {
                  const k = NETWORK_KINDS[kind];
                  const n = NETWORK_NODES.filter((x) => x.kind === kind).length;
                  return (
                    <div key={kind} className="flex items-baseline gap-4">
                      <dt className="flex items-center gap-3 font-sans text-[12px] uppercase tracking-[0.14em] text-white/50">
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 rounded-full"
                          style={{ background: k.fill }}
                        />
                        {k.label}
                      </dt>
                      <dd className="ml-auto font-heading text-xl font-bold text-brand-gold">{n}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          </div>
        </Reveal>

        {/* The honest footnote. A university that says what its map does NOT
            show is a university whose map can be believed. */}
        <Reveal delay={220}>
          <p className="mx-auto mt-10 max-w-2xl text-center text-[13px] leading-relaxed text-white/50">
            This map shows the university&rsquo;s own campuses, centres and fellowship. It does not
            plot student or graduate locations: those are published when the registry can evidence
            them, and not before.
          </p>
        </Reveal>

        <Reveal delay={300}>
          <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/accreditation"
              className="group inline-flex items-center gap-2.5 rounded-full bg-brand-gold px-8 py-4 font-heading text-[15px] font-bold text-brand-purple-dark shadow-gold transition duration-300 ease-enter hover:bg-brand-gold-deep active:scale-[0.98] active:duration-75"
            >
              Academic partnerships
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
            <Link
              href="/admissions"
              className="group inline-flex items-center gap-2.5 rounded-full border-2 border-white/35 px-8 py-4 font-heading text-[15px] font-bold text-white transition duration-300 ease-enter hover:border-brand-gold hover:text-brand-gold active:scale-[0.98] active:duration-75"
            >
              International admissions
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
