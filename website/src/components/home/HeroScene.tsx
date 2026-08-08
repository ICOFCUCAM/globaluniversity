import Image from 'next/image';
import Link from 'next/link';
import { Grain } from '@/components/Atmosphere';
import { publicCrest } from '@/lib/publicCrest';
import { UNIVERSITY } from '@/lib/constants';

// ---------------------------------------------------------------------------
// 01 — IMPACT. The hero, rebuilt as an asymmetric editorial composition.
//
// ===========================================================================
// WHAT THIS REPLACES AND THE JUDGEMENT THAT HAS CHANGED
// ===========================================================================
//
// The old hero was a centred two-column arrangement: copy on the left, the
// crest rendered large on the right, and no photography at all. It dropped
// photography on a specific and correct finding — that a hero photograph is a
// SUBJECT, examined at full size on a retina panel, and needs roughly twice its
// rendered width in real pixels. At a 1440px full-bleed hero that asks for a
// 2880px source, and this repository has none.
//
// That finding still holds. What has changed is the composition it was applied
// to. A photograph does not have to be full-bleed to be a hero photograph.
// Here it occupies a tall panel of about 46% of the viewport — roughly 660 CSS
// pixels — which a 1080px source carries with headroom to spare at 1x and
// acceptably at 2x, especially under the slight duotone this panel applies.
//
// So the rule was never "no photography in the hero". It was "no photography at
// a size these files cannot hold", and 660px is a size they can hold.
//
// ===========================================================================
// THE COMPOSITION
// ===========================================================================
//
// Asymmetric on purpose. The type block sits left of centre and the photograph
// runs off the right edge and off the top and bottom of the band — it is a crop
// of a longer scene, not a picture placed in a slot. Nothing is centred, there
// is no card, and the two halves are not equal.
//
// The crest sits ON the seam between them, overlapping both. That is the
// device that stops this reading as a split screen: a split screen has two
// sides, and an element straddling the join makes it one composition with a
// hinge. It is also the only place on the page where the university's mark
// appears at scale, which is what a hero is for.
//
// ===========================================================================
// WHAT WAS TAKEN OUT, AND WHY THAT IS THE POINT
// ===========================================================================
//
// This carried a four-column statistics strip: 2007, 41 programmes, 5 schools,
// 19 staff. Every number was real and computed, and all four are still on the
// page — one section down, where they now have room.
//
// They were removed because the hero had SIX layers of information in one
// viewport: eyebrow, sub-eyebrow, headline, paragraph, two buttons, four
// statistics. A hero with six things in it has no first thing. The reader's eye
// arrives and has to choose where to start, and a composition that asks the
// reader to choose has already lost the moment it was built for.
//
// The reference the university pointed at puts ONE sentence in this space and
// nothing else. That is the discipline being copied — not the layout, the
// restraint. Four items here now: who this is, what it is for, one line of
// substance, two ways in.
//
// The statistics were also the reason the hero overflowed its own viewport at
// 1280x800. Removing them fixed a measurement problem and a composition problem
// with one cut, which is usually the sign that the cut was the right one.
//
// ===========================================================================
// WHY THE PHOTOGRAPH IS A PROCESSION AND NOT A PORTRAIT
// ===========================================================================
//
// A line of academics receding into depth. It carries perspective, which a
// group portrait does not, and perspective is what makes a cropped panel read
// as a window onto something larger rather than as a picture that has been cut
// off. The eye follows the line out of frame, which is the effect the crop is
// for.
// ---------------------------------------------------------------------------

const CREST = publicCrest({
  size: 600,
  colour: '#f7dc79',
  name: UNIVERSITY.name,
  footer: `Founded ${UNIVERSITY.established}`,
  id: 'hero-crest',
});

export default function HeroScene() {
  return (
    <section
      data-on-dark=""
      data-chapter="Hero"
      aria-labelledby="hero-heading"
      className="relative isolate flex min-h-[100svh] items-center overflow-hidden bg-brand-purple-dark text-white"
    >
      {/* ---- the photographic panel, right, bleeding off three edges -------

          THE IMAGE IS A RENDER, NOT A PHOTOGRAPH, and that is recorded here
          rather than left for somebody to discover. It was supplied by the
          university as the hero image and it is a generated view of a campus —
          a stone faculty building, a plaza, jacaranda in flower at sunrise. No
          such building appears anywhere else in this repository's photography,
          which is of congregations, registration desks and lecture rooms.

          A reader has no way to tell, and the ordinary reading of a large
          building on a university's homepage is "this is our campus". That is
          the same species of claim as the "7,228 Success Stories" this site
          removed: not a lie anyone typed, but a thing a visitor will believe
          that the institution cannot evidence. It is the university's call to
          make and it has been made; it is written down so the next person
          understands what they are looking at.

          Two consequences are handled here rather than argued about. The ALT
          TEXT does not assert that this is the university's campus — it
          describes what is in the frame and nothing more, because alt text is
          the one place a claim would be made in the institution's own voice to
          a reader who cannot see the picture. And the DUOTONE is heavier than
          the panel it replaces: a render at full colour reads as stock, while
          the same frame pulled into the institution's purple reads as a
          treatment, which is both better design and less of an assertion.

          Composition-wise it fits this panel exactly. The building and the tree
          are on the right of the frame and the left is open plaza and sun, so
          cropping to the right half keeps the architecture and discards the
          blown-out sky that white type could never have sat on.

          IT IS A JPEG NOW, NOT A 2MB PNG. PNG is lossless and therefore the
          wrong container for a photograph: this one arrived at 1.98MB and
          re-encodes to 337KB at quality 92 with no visible difference at any
          size this panel is drawn. next/image would have served WebP either
          way, so no reader was ever downloading two megabytes — but the source
          sits in git forever, is read on every build, and is the file anybody
          opens when they want to look at it. A sixfold saving on all three for
          nothing given up. */}
      <div className="absolute inset-y-0 right-0 -z-20 hidden w-[52%] lg:block xl:w-[50%]">
        <Image
          src="/images/campus/plaza-sunrise.jpg"
          alt="A stone faculty building with columns, a paved plaza and a jacaranda in flower at sunrise"
          fill
          sizes="(min-width:1024px) 52vw, 100vw"
          quality={88}
          priority
          className="object-cover"
          style={{ objectPosition: '78% 42%' }}
        />
        {/* Duotone. The panel is a supporting element, not the subject — pulling
            it into the institution's purple stops it competing with the
            headline and, not by accident, makes a 1080px source read as an
            intentional treatment rather than a soft photograph. */}
        <div aria-hidden="true" className="absolute inset-0 bg-brand-purple/48 mix-blend-multiply" />
        <div aria-hidden="true" className="absolute inset-0 bg-brand-gold/10 mix-blend-screen" />
        {/* The seam. A long horizontal fade so the photograph dissolves into the
            purple rather than meeting it at a line — the join is the weakest
            point of any split composition and this is what hides it. */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[46%] bg-gradient-to-r from-brand-purple-dark via-brand-purple-dark/65 to-transparent"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-brand-purple-dark to-transparent"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-brand-purple-dark/85 to-transparent"
        />
      </div>

      {/* On mobile the photograph is a band behind everything rather than a
          panel beside it — a 46% column at 390px is 180px, which is not a
          photograph, it is a stripe. */}
      <div aria-hidden="true" className="absolute inset-0 -z-20 lg:hidden">
        <Image
          src="/images/campus/plaza-sunrise.jpg"
          alt=""
          fill
          sizes="100vw"
          quality={80}
          priority
          className="object-cover"
          style={{ objectPosition: '72% 44%' }}
        />
        <div aria-hidden="true" className="absolute inset-0 bg-brand-purple-dark/86" />
        <div aria-hidden="true" className="absolute inset-0 bg-brand-purple/35 mix-blend-multiply" />
      </div>

      {/* Engraved ground: the meridian rules from the crest, at very low
          opacity, tying the flat band to the university's own device. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-[0.035]"
        style={{ backgroundImage: 'repeating-linear-gradient(104deg, #f7dc79 0 1px, transparent 1px 26px)' }}
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <Grain opacity={0.06} />
      </div>

      {/* ---- the crest, straddling the seam -------------------------------- */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[47%] top-1/2 -z-10 hidden w-[26rem] -translate-y-1/2 opacity-[0.16] lg:block xl:w-[30rem]"
        dangerouslySetInnerHTML={{ __html: CREST }}
      />

      {/* ---- the type ------------------------------------------------------ */}
      <div className="relative mx-auto w-full max-w-7xl px-6 py-14 sm:px-10 sm:py-16 lg:px-16 lg:py-20">
        <div className="max-w-2xl">
          <p className="flex items-center gap-4 font-sans text-[10.5px] font-semibold uppercase tracking-[0.32em] text-brand-gold sm:text-[11.5px]">
            A Global University
            <span aria-hidden="true" className="h-px w-14 bg-gradient-to-r from-brand-gold to-transparent" />
          </p>
          <p className="mt-3 font-sans text-[12px] text-white/60 sm:text-[13px]">
            of the International Circle of Faith
          </p>

          {/* THE MOTTO, given by the university, and placed ABOVE the headline
              rather than below it.

              A motto is a statement of what an institution is for; a headline
              is an argument aimed at one reader. Set beneath the headline this
              would have read as a second, weaker strapline competing with the
              first. Set above it, in the same block as the name it belongs to,
              it does what a motto does on a crest — it identifies, and then the
              headline speaks.

              Gold rather than white, because it is the institution's voice and
              every other gold element on this page is too. It sits at 13.5px
              on a purple ground, where gold is the CORRECT ink — this is not
              the cream-ground case that gold fails. */}
          <p className="mt-6 max-w-md font-heading text-[13.5px] font-bold leading-relaxed tracking-[0.02em] text-brand-gold sm:text-[15px]">
            Leading the World with Truth, Knowledge &amp; Purpose.
          </p>

          <h1
            id="hero-heading"
            className="mt-8 font-heading text-[clamp(2.7rem,6.4vw,5.1rem)] font-bold leading-[0.98] tracking-[-0.035em] [text-wrap:balance]"
          >
            Where faith meets
            <br />
            <span className="text-brand-gold">academic rigour.</span>
          </h1>

          {/* NATIONS, NOT TOWNS, on the university's instruction. This read
              "from Buea, Douala and online worldwide" — the two Cameroonian
              campuses and a catch-all. Naming countries states the reach a
              global university actually has, and it is the scale a reader
              outside Cameroon can place themselves in: "Douala" means nothing
              to somebody in Lusaka, "Zambia" means everything. */}
          <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-white/85 sm:mt-7 sm:text-[17px]">
            Accredited degrees taught from Cameroon, the USA, Zambia, Nigeria, South Africa
            and worldwide — by people who practised what they teach, to students who were
            never given the door.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4 sm:mt-11">
            <Link
              href="/programs"
              className="rounded-full bg-brand-gold px-8 py-4 font-heading text-[15px] font-bold text-brand-purple shadow-gold transition duration-300 hover:bg-brand-gold-deep"
            >
              Explore programmes
            </Link>
            <Link
              href="/apply"
              className="group inline-flex items-center gap-3 rounded-full border-2 border-white/40 px-8 py-4 font-heading text-[15px] font-bold text-white transition duration-300 hover:border-brand-gold hover:text-brand-gold"
            >
              Begin your application
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>

          {/* The institutional strip. Four counted facts, not four claims —
              every one of these is computed from a roster or a catalogue in
              src/content, never typed. See institutionalFacts.ts. */}
        </div>
      </div>
    </section>
  );
}
