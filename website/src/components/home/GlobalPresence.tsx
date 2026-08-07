import Link from 'next/link';

import { flatWorldSvg } from '@/lib/flatWorld';
import { CAMPUSES } from '@/content/institutionalFacts';

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
// fact — that this university teaches from Buea, Douala, a centre in Nigeria,
// and online.
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
// WHAT THE MAP IS ALLOWED TO SHOW — carried over verbatim from the globe
// ===========================================================================
//
// Only places the university can name: two campuses and a professional
// development centre. NOT "countries where our students live", NOT "countries
// where our graduates serve", however much stronger a scatter of forty pins
// would look. The student register is empty, so such a map would be a drawing
// of a claim rather than a picture of a fact — and a pin reads as an
// establishment, which makes it the easiest false statement on a website to
// make and the hardest for a reader to catch.
// ---------------------------------------------------------------------------

// Rendered once, on the server. `places` draws the three pins the university
// can actually evidence; see UNIVERSITY_PLACES in src/lib/flatWorld.ts.
const WORLD = flatWorldSvg({
  size: 640,
  colour: '#4a3570',
  inset: 0.92,
  landOpacity: 0.20,
  places: true,
  id: 'presence',
});

export default function GlobalPresence() {
  return (
    <section
      data-chapter="Where we are"
      aria-labelledby="presence-heading"
      className="relative z-10 overflow-hidden bg-brand-cream py-24 dark:bg-[#181121] sm:py-32"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 sm:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-20 lg:px-16">
        {/* ---- the copy, first cell ------------------------------------- */}
        <div>
      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brand-gold-ink dark:text-brand-gold">
        09 — Where we are
      </p>

      <h2 className="mt-8 font-heading text-[clamp(2.2rem,5.4vw,4.2rem)] font-bold leading-[1.04] tracking-[-0.03em] text-brand-purple dark:text-white [text-wrap:balance]">
        One university. No borders.
      </h2>

      <p className="mt-8 max-w-lg text-[15px] leading-relaxed text-brand-muted dark:text-white/80 sm:text-base">
        Two campuses in Cameroon, a professional development centre in Nigeria, and every
        programme taught online to students on every continent. Wherever you study with us,
        you are a full member of this university — the same faculty, the same examinations,
        the same degree.
      </p>

      <ul className="mt-10 grid gap-x-10 gap-y-5 sm:grid-cols-2">
        {CAMPUSES.map((c) => (
          <li key={c.city} className="border-l-2 border-brand-gold-deep pl-4 dark:border-brand-gold/40">
            <p className="font-heading text-[17px] font-bold leading-tight text-brand-purple dark:text-white">
              {c.city}
              <span className="ml-2 font-sans text-[12px] font-normal text-brand-muted dark:text-white/60">{c.country}</span>
            </p>
            <p className="mt-1 text-[13px] leading-snug text-brand-muted dark:text-white/75">{c.role}</p>
          </li>
        ))}
        {/* No hand-written "Online" entry here. CAMPUSES already carries one —
            adding a second rendered the word twice, one under the other, with
            two different descriptions. It survived typecheck, lint, the link
            check and every contrast probe, because none of those can see that a
            list repeats itself; only looking at the picture caught it. */}
      </ul>

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

        {/* ---- the world, second cell --------------------------------------
            Order-first on small screens so the figure introduces the section
            rather than trailing it; on desktop it sits to the right of the
            copy where the reading eye arrives last.

            Decorative: every place it marks is named in the list above, so a
            reader who cannot see it loses nothing. */}
        <div
          aria-hidden="true"
          className="pointer-events-none order-first mx-auto w-full max-w-[26rem] lg:order-none lg:max-w-[32rem] lg:translate-x-[4%]"
          dangerouslySetInnerHTML={{ __html: WORLD }}
        />
      </div>
    </section>
  );
}
