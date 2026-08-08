import Link from 'next/link';

import { PLACES_BY_NATION, NATIONS, inWordsCapped } from '@/content/institutionalFacts';

// ---------------------------------------------------------------------------
// ONE UNIVERSITY. NO BORDERS.
//
// ===========================================================================
// THIS IS A MERGE, NOT A NEW SECTION
// ===========================================================================
//
// The homepage said where the university is FOUR times: the utility bar across
// the top, the hero assurances, a Campuses band of three photographic cards
// (1.51 screens), and a Global network band with a rotating globe (1.85
// screens). Three and a half screens, two of them consecutive, to establish one
// fact — where this university teaches from.
//
// Worse, the two big bands were the same argument in two registers: the cards
// said "here are the places" and the globe said "here are the places, on a
// sphere". A reader who scrolled through both learned nothing from the second
// that the first had not already told them, and paid a screen and a half for it.
//
// One scene now. The photograph is a campus; the world sits over it as a
// drawing; the places are named in text beside it. What was 3.36 screens is
// about 1.2.
//
// ===========================================================================
// WHY THE FLAT MAP AND NOT THE ROTATING GLOBE
// ===========================================================================
//
// LivingGlobe is a genuinely good piece of work — a real rotating globe drawn
// on a canvas, no Three.js, no third-party map, no cookies set from another
// origin before a visitor has consented to anything. It now has no caller, and
// that is recorded here rather than hidden: this merge is what removed its last
// one. It is kept because the /campus-life page is where it belongs and putting
// it there is a separate change; if that has not happened by the time somebody
// reads this, it is dead code and should either be placed or deleted.
//
// But a globe shows one hemisphere, and turned to Africa's longitude — the only
// orientation this university would use — it shows Africa, Europe, Arabia and
// very little else. The claim being made here is not "we are in Africa". It is
// "we are a global university that happens to be rooted in Africa", and a
// hemisphere cannot say that: the half of the world it hides is precisely the
// half the sentence is about.
//
// The flat world says it in one figure. Every continent on the disc at once,
// Africa at the foot rather than hidden at the edge, and it is the university's
// OWN mark — the same projection at the centre of the crest in the header and
// engraved on every certificate the university issues. Using it here is not
// decoration; it is the institution's device doing the job it was drawn for.
//
// It also costs nothing at runtime: flatWorldSvg is pure and deterministic, so
// it is called once on the server and inlined as markup. No canvas, no
// animation frame, no JavaScript at all.
//
// ===========================================================================
// WHAT THE MAP IS ALLOWED TO SHOW
// ===========================================================================
//
// Only what the university has stated about itself: the sites it can name, and
// the nations it has said it teaches accredited degrees from. NOT "countries
// where our students live", NOT "countries where our graduates serve", however
// much stronger a scatter of forty pins would look. The student register is
// empty, so such a map would be a drawing of a claim rather than a picture of a
// fact.
//
// The two are marked differently, which is the whole point of allowing the
// second at all: a filled pin says there is an establishment at that spot, and
// an open ring at a country's centre says the country. Six marks now, three of
// each. src/content/universityPlaces.json holds the register and records on
// whose word each entry stands.
// ---------------------------------------------------------------------------

// The words and the marks come from one file, so this list and the map behind
// the page cannot disagree; see src/content/universityPlaces.json.

export default function GlobalPresence() {
  return (
    <section
      data-chapter="Where we are"
      aria-labelledby="presence-heading"
      className="relative z-10 overflow-hidden bg-brand-cream py-24 dark:bg-[#181121] sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-16">
        <div>
      {/* THE HEADING CHANGED BECAUSE THE PAGE STARTED SAYING IT TWICE.
          This read "One university. No borders." Two sections above it, over a
          map of every continent, the window now says "A university without
          borders." — the same claim, in almost the same words, and the second
          time a reader meets it they do not hear emphasis, they hear a page
          that is not listening to itself.

          The statement belongs over the map, where the picture is evidence for
          it. What belongs HERE is the thing the map cannot show: that the
          degree is the same wherever it is taken. That is the harder claim, it
          is the one a distance student actually needs, and the paragraph below
          has been making it all along without a heading that agreed. */}
      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brand-gold-ink dark:text-brand-gold">
        Where we teach from
      </p>

      {/* THE COUNT IS COUNTED. It read "Four places. One degree." while the
          hero two screens above said five nations, because the heading was a
          typed number and the register had grown underneath it. NATIONS.length
          is the register's own answer, so the sentence cannot fall out of step
          with the list printed directly below it. */}
      <h2 className="mt-8 font-heading text-[clamp(2.2rem,5.4vw,4.2rem)] font-bold leading-[1.04] tracking-[-0.03em] text-brand-purple dark:text-white [text-wrap:balance]">
        {inWordsCapped(NATIONS.length)} nations. One degree.
      </h2>

      <p className="mt-8 max-w-2xl text-[15px] leading-relaxed text-brand-muted dark:text-white/80 sm:text-base">
        Two campuses in Cameroon, a professional development centre in Nigeria, accredited
        degrees taught in the United States, Zambia and South Africa, and every programme
        online. Wherever you study with us, you are a full member of this university — the
        same faculty, the same examinations, the same degree.
      </p>

      {/* A REGISTER, NOT A ROW OF CARDS.
          The places were four equal tiles in a four-column grid, which worked
          exactly while there were four of them. Seven entries in that grid is a
          ragged second row, and worse, it flattens a real distinction: Buea and
          Douala are two campuses in ONE country, and printing them as two tiles
          beside "Nigeria" invited a reader to count six countries.

          So the nation is the unit, set in the heading face, with what the
          university has in it listed alongside. It is the shape of an entry in
          a calendar or a charter rather than a pricing table, it holds however
          many sites a nation acquires, and it says the thing the hero says —
          this university teaches from these nations — with the detail underneath
          rather than instead. */}
      <dl className="mt-12 border-t border-brand-purple/12 dark:border-white/12">
        {PLACES_BY_NATION.map(({ country, sites }) => (
          <div
            key={country}
            className="grid gap-x-10 gap-y-2 border-b border-brand-purple/12 py-5 dark:border-white/12 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]"
          >
            <dt className="font-heading text-[17px] font-bold leading-tight text-brand-purple dark:text-white">
              {country}
            </dt>
            <dd className="space-y-1.5">
              {sites.map((s) => (
                <p key={s.role} className="text-[13.5px] leading-snug text-brand-muted dark:text-white/75">
                  {s.name && (
                    <span className="font-heading font-bold text-brand-gold-ink dark:text-brand-gold">
                      {s.name}
                      <span aria-hidden="true"> · </span>
                    </span>
                  )}
                  {s.role}
                </p>
              ))}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-11 flex flex-wrap items-center gap-x-8 gap-y-4">
        <Link
          href="/campus-life"
          className="group inline-flex items-center gap-3 border-b border-brand-gold-deep pb-1 font-heading text-[15px] font-bold text-brand-gold-ink transition duration-300 hover:border-brand-gold-ink hover:text-brand-purple dark:text-brand-gold dark:hover:text-white"
        >
          Campus life
          <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </Link>
        <Link
          href="/online-learning"
          className="group inline-flex items-center gap-3 border-b border-brand-purple/25 pb-1 font-heading text-[15px] font-bold text-brand-purple transition duration-300 hover:border-brand-gold-ink hover:text-brand-gold-ink dark:border-white/25 dark:text-white/85 dark:hover:text-brand-gold"
        >
          How online study works
          <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </Link>
      </div>
        </div>

      </div>
    </section>
  );
}
