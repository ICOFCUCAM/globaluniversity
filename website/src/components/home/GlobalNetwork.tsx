import Link from 'next/link';
import Reveal from '@/components/Reveal';
import { Aurora, Grain, Seam } from '@/components/Atmosphere';
import { WORLD } from '@/lib/worldCoastlines';
import { NETWORK_NODES, NETWORK_KINDS } from '@/content/globalNetwork';

// ---------------------------------------------------------------------------
// The global network — the signature section.
//
// WHY A DRAWN MAP AND NOT AN EMBEDDED ONE. An interactive Google or Mapbox map
// costs several hundred kilobytes and a third-party connection on the busiest
// page of the site, cannot be styled to match a purple-and-gold brand, and sets
// cookies from another origin before a visitor has agreed to anything — which,
// for an institution taking applications from Europe, is a consent problem
// rather than a design preference.
//
// This map is drawn from src/lib/worldCoastlines.ts, the same coastline data
// engraved into the security artwork on every certificate this university
// issues. It weighs a few kilobytes, works offline, matches the brand exactly,
// and is quietly the right metaphor: the same world on the wall of a graduate's
// office is the one on the homepage.
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

// Equirectangular. Not the projection a cartographer would choose, and exactly
// the one to use here: it is linear in both axes, so a latitude and longitude
// become an x and a y with no trigonometry, and every node lands where the
// reader expects it. Antarctica is cut at 60°S, as it is in the coastline data.
const W = 1000;
const H = 500;
const LAT_TOP = 82;
const LAT_BOTTOM = -58;

const px = (lon: number) => ((lon + 180) / 360) * W;
const py = (lat: number) => ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * H;

const ringPath = (ring: [number, number][]) =>
  ring
    .map(([lon, lat], i) => `${i === 0 ? 'M' : 'L'}${px(lon).toFixed(1)} ${py(lat).toFixed(1)}`)
    .join('') + 'Z';

export default function GlobalNetwork() {
  return (
    <section
      data-chapter="Global network"
      aria-labelledby="network-heading"
      className="relative overflow-hidden bg-brand-purple-dark py-24 text-white sm:py-32"
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
          <figure className="mt-16 sm:mt-20">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="h-auto w-full"
              role="img"
              aria-labelledby="map-title map-desc"
            >
              <title id="map-title">Map of ICOF Global University&rsquo;s locations</title>
              <desc id="map-desc">
                {NETWORK_NODES.map((n) => `${n.name}, ${n.kindLabel}`).join('. ')}.
              </desc>

              <defs>
                {/* An engraved ground, as on the certificate: fine parallel
                    rules rather than a flat fill, so the ocean has a surface. */}
                <pattern id="gn-sea" width="7" height="7" patternUnits="userSpaceOnUse">
                  <rect width="7" height="7" fill="transparent" />
                  <path d="M0 7 L7 0" stroke="rgba(247,220,121,0.10)" strokeWidth="0.5" />
                </pattern>
                <radialGradient id="gn-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f7dc79" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#f7dc79" stopOpacity="0" />
                </radialGradient>
              </defs>

              <rect width={W} height={H} fill="url(#gn-sea)" />

              {/* Graticule: every 30° of longitude, 20° of latitude. */}
              <g stroke="rgba(255,255,255,0.07)" strokeWidth="0.6">
                {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((lon) => (
                  <line key={lon} x1={px(lon)} y1={0} x2={px(lon)} y2={H} />
                ))}
                {[60, 40, 20, 0, -20, -40].map((lat) => (
                  <line key={lat} x1={0} y1={py(lat)} x2={W} y2={py(lat)} />
                ))}
              </g>
              {/* The equator, drawn a shade stronger — it runs a few degrees
                  south of Buea and gives the African nodes their reference. */}
              <line x1={0} y1={py(0)} x2={W} y2={py(0)} stroke="rgba(247,220,121,0.18)" strokeWidth="0.8" />

              <g fill="rgba(255,255,255,0.10)" stroke="rgba(247,220,121,0.45)" strokeWidth="0.9">
                {WORLD.map((ring, i) => (
                  <path key={i} d={ringPath(ring)} fillRule="evenodd" />
                ))}
              </g>

              {NETWORK_NODES.map((n) => {
                const x = px(n.lon);
                const y = py(n.lat);
                const kind = NETWORK_KINDS[n.kind];
                return (
                  <g key={n.name}>
                    <circle cx={x} cy={y} r={kind.halo} fill="url(#gn-glow)" />
                    <circle
                      cx={x}
                      cy={y}
                      r={kind.dot}
                      fill={kind.fill}
                      stroke="#1d1428"
                      strokeWidth="1.2"
                    />
                    <text
                      x={x + kind.dot + 6}
                      y={y + 3.5}
                      fill="rgba(255,255,255,0.92)"
                      fontSize="11"
                      fontWeight="600"
                      style={{ fontFamily: 'system-ui, sans-serif' }}
                    >
                      {n.name}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* The legend is DERIVED from the nodes actually plotted, not from
                the list of kinds that exist. Combining Buea and Douala into one
                pin left 'Online, worldwide' in the legend with nothing on the
                map to match it — a swatch for a thing that is not there, which
                is exactly the kind of small incoherence that makes a reader
                stop trusting the rest of the diagram. */}
            <figcaption className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {Array.from(new Set(NETWORK_NODES.map((n) => n.kind)))
                .map((key) => [key, NETWORK_KINDS[key]] as const)
                .map(([key, k]) => (
                <span
                  key={key}
                  className="flex items-center gap-2.5 font-sans text-[12px] text-white/70"
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full ring-1 ring-brand-purple-dark"
                    style={{ background: k.fill }}
                  />
                  {k.label}
                </span>
              ))}
            </figcaption>
          </figure>
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
              className="group inline-flex items-center gap-2.5 rounded-full bg-brand-gold px-8 py-4 font-heading text-[15px] font-bold text-brand-purple-dark shadow-gold transition duration-300 hover:bg-brand-gold-deep"
            >
              Academic partnerships
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
            <Link
              href="/admissions"
              className="group inline-flex items-center gap-2.5 rounded-full border-2 border-white/35 px-8 py-4 font-heading text-[15px] font-bold text-white transition duration-300 hover:border-brand-gold hover:text-brand-gold"
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
