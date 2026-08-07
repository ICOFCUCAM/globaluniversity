import Link from 'next/link';
import FixedWindow from './FixedWindow';
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
  colour: '#f7dc79',
  inset: 0.92,
  landOpacity: 0.34,
  places: true,
  id: 'presence',
});

export default function GlobalPresence() {
  return (
    <FixedWindow
      src="/images/graduation-2024/grad-2024-procession-hall.jpg"
      alt="The academic procession entering the hall at the ICOF Global University 2024 congregation"
      anchor="left"
      focal="50% 40%"
      exposure={0.48}
      height={118}
      chapter="Where we are"
    >
      {/* The world, behind and to the right of the copy. Decorative here — the
          places it marks are all named in the list below, so a reader who
          cannot see it loses nothing. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-1/2 hidden w-[38rem] -translate-y-1/2 translate-x-[18%] opacity-[0.5] lg:block"
        dangerouslySetInnerHTML={{ __html: WORLD }}
      />

      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brand-gold">
        09 — Where we are
      </p>

      <h2 className="mt-8 font-heading text-[clamp(2.2rem,5.4vw,4.2rem)] font-bold leading-[1.04] tracking-[-0.03em] text-white [text-wrap:balance]">
        One university. No borders.
      </h2>

      <p className="mt-8 max-w-lg text-[15px] leading-relaxed text-white/90 sm:text-base">
        Two campuses in Cameroon, a professional development centre in Nigeria, and every
        programme taught online to students on every continent. Wherever you study with us,
        you are a full member of this university — the same faculty, the same examinations,
        the same degree.
      </p>

      <ul className="mt-10 grid gap-x-10 gap-y-5 sm:grid-cols-2">
        {CAMPUSES.map((c) => (
          <li key={c.city} className="border-l-2 border-brand-gold/40 pl-4">
            <p className="font-heading text-[17px] font-bold leading-tight text-white">
              {c.city}
              <span className="ml-2 font-sans text-[12px] font-normal text-white/60">{c.country}</span>
            </p>
            <p className="mt-1 text-[13px] leading-snug text-white/75">{c.role}</p>
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
          className="group inline-flex items-center gap-3 border-b border-brand-gold/40 pb-1 font-heading text-[15px] font-bold text-brand-gold transition duration-300 hover:border-brand-gold hover:text-white"
        >
          Campus life
          <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </Link>
        <Link
          href="/online-learning"
          className="group inline-flex items-center gap-3 border-b border-white/25 pb-1 font-heading text-[15px] font-bold text-white/85 transition duration-300 hover:border-brand-gold hover:text-brand-gold"
        >
          How online study works
          <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </Link>
      </div>
    </FixedWindow>
  );
}
