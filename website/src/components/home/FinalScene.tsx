import Image from 'next/image';
import Link from 'next/link';
import { Grain } from '@/components/Atmosphere';
import { ALL_PROGRAMMES } from '@/content/programmeCatalogue';
import { TEACHING_NATIONS } from '@/content/institutionalFacts';

// ---------------------------------------------------------------------------
// THE LAST SCENE — the point of decision.
//
// ===========================================================================
// THE WORLD CAME OFF THIS SECTION
// ===========================================================================
//
// It closed on the flat map: "Your Future Starts Here" over the university's
// own projection, argued at the time on the grounds that a photograph of one
// ceremony closes the page on a MEMORY — a particular afternoon, already past —
// while the world says the size of what is on offer.
//
// That argument was sound when this section was the only place on the homepage
// the map appeared. It is not any more. The map now runs pinned behind the
// fellowship and behind the closing statement of the world window, and it is
// drawn again on the locations section. A figure used four times is not a
// signature, it is wallpaper, and the fourth use was the weakest of them:
// centred, at 52% opacity, under a vignette, with every word of the section
// laid across its middle. It was being used as a texture, which is exactly what
// this page has spent its whole redesign refusing to do to a picture.
//
// ===========================================================================
// AND A PHOTOGRAPH IS NOT A MEMORY AT THE POINT OF DECISION
// ===========================================================================
//
// The counter-argument to "a ceremony is past" is that a reader standing at the
// application form is not being shown a nice afternoon. They are being shown
// PEOPLE WHO FINISHED — six graduands in doctoral robes, hoods, tassels and
// scrolls, from this university, photographed at its own congregation. That is
// not nostalgia. It is the only evidence on the page that the thing being
// offered actually completes, and it belongs precisely where somebody decides
// whether to start.
//
// ===========================================================================
// THE COMPOSITION IS THE HERO, MIRRORED
// ===========================================================================
//
// The hero puts copy left and photography right, bleeding off three edges. This
// puts photography LEFT and copy right. The page opens and closes on the same
// device reflected, which is what makes two sections read as a pair of covers
// rather than as two sections that both happen to have a picture in them.
//
// It also solves the problem the old centred layout had: nothing is set ON the
// photograph. Every word here sits on flat purple, so the picture needs no
// vignette, no 52% opacity and no scrim, and it can be shown at full strength
// for the first time on this page.
//
// ===========================================================================
// AND THE PICTURE IS NOW THE ACT ITSELF
// ===========================================================================
//
// It closed on six graduands standing with their scrolls — people who had
// finished, which was the right idea. The university then supplied the moment
// rather than the aftermath: a graduand taking the certificate and shaking the
// hand that confers it, with the Chancellor in blue regalia behind. A group
// standing afterwards says they finished; this says the university conferred
// it, which is the thing a reader at the application form is deciding to trust.
//
// It is also, by some distance, the best FILE in the library. 2048×1536 against
// the 1080×720 everything else is, which means it is the only photograph here
// that carries a 690px panel at 2× without being upscaled at all — and this is
// the panel where that matters most, because faces at close range are what the
// eye is least forgiving about.
// ---------------------------------------------------------------------------

export default function FinalScene() {
  // Counted, never typed — the same catalogue the faculties section counts from,
  // so the figure a reader meets at the form is the figure they were shown.
  const total = ALL_PROGRAMMES.length;

  return (
    <section
      data-on-dark=""
      data-chapter="Apply"
      aria-labelledby="apply-heading"
      className="relative z-10 grid min-h-[88svh] grid-cols-1 overflow-hidden bg-brand-purple-dark text-white lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)]"
    >
      {/* ---- THE PHOTOGRAPH, LEFT ------------------------------------------
          On mobile it is a band above the words rather than a half beside them:
          a 48% column at 390px is 187px, which is not a photograph, it is a
          stripe. */}
      <div className="relative min-h-[46svh] overflow-hidden lg:min-h-0">
        <Image
          src="/images/graduation-2024/grad-conferral-handshake.jpg"
          alt="A graduand of ICOF Global University receiving their certificate and shaking hands at the congregation"
          fill
          sizes="(min-width:1024px) 48vw, 100vw"
          quality={88}
          loading="lazy"
          className="object-cover"
          // The handshake and the certificate are just right of centre and a
          // little below the middle of the frame; the panel is taller than the
          // source, so this keeps them in it rather than cropping to the
          // ceiling and the window glare.
          style={{ objectPosition: '46% 52%' }}
        />
        {/* A light purple multiply only — enough to bind the frame to the
            institution's colour, nowhere near enough to dim it. There is no
            type on this half, so there is nothing to buy contrast for, and the
            robes are the most colourful thing in the whole library. */}
        <div aria-hidden="true" className="absolute inset-0 bg-brand-purple/22 mix-blend-multiply" />
        <div aria-hidden="true" className="absolute inset-0 bg-brand-gold/8 mix-blend-screen" />
        <Grain opacity={0.07} />

        {/* The seam. A hard edge between photograph and panel reads as two
            images pasted together; a long fade reads as one spread. On mobile
            it runs along the bottom instead of the side. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-brand-purple-dark to-transparent lg:inset-y-0 lg:left-auto lg:right-0 lg:h-auto lg:w-32 lg:bg-gradient-to-l"
        />
      </div>

      {/* ---- THE DECISION, RIGHT ------------------------------------------- */}
      <div className="relative flex items-center px-6 py-20 sm:px-10 lg:px-16 lg:py-24">
        <div className="w-full max-w-xl">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brand-gold">
            Admissions
          </p>

          <h2
            id="apply-heading"
            className="mt-8 font-heading text-[clamp(2.4rem,5.6vw,4.4rem)] font-bold leading-[1.02] tracking-[-0.03em] [text-wrap:balance]"
          >
            Your future starts here.
          </h2>

          {/* REWRITTEN. This carried the WordPress-era paragraph — "Position
              yourself for success at an accredited university where you can
              work toward your future one course at a time. Fill out a request
              form and we will help you start on the right track." Forty words
              that say nothing a reader can act on, and a "request form" that is
              not what this university has: it has an application.

              What replaces it is two facts, both already stated on this site
              and both load-bearing at the moment somebody decides. The scale of
              the catalogue, counted rather than typed. And that admission is
              enrolment here — you may begin from the date of your offer, before
              any fee is settled — which is the single most persuasive true
              thing this university can say to a working adult weighing whether
              to start now or next year. */}
          <p className="mt-8 max-w-lg text-[15.5px] leading-relaxed text-white/85 sm:text-[17px]">
            Applications are open across all {total} programmes — on campus in Buea and Douala,
            at our teaching locations in {TEACHING_NATIONS.slice(0, -1).join(', ')} and{' '}
            {TEACHING_NATIONS[TEACHING_NATIONS.length - 1]}, or online from wherever you already are.
            Admission is enrolment: you may begin studying from the date of your offer.
          </p>

          <div className="mt-11 flex flex-wrap items-center gap-4">
            <Link
              href="/apply"
              className="rounded-full bg-brand-gold px-9 py-4 font-heading text-[15px] font-bold text-brand-purple shadow-gold transition duration-300 hover:bg-brand-gold-deep"
            >
              Begin your application
            </Link>
            <Link
              href="/contact"
              className="group inline-flex items-center gap-3 rounded-full border-2 border-white/45 px-9 py-4 font-heading text-[15px] font-bold text-white transition duration-300 hover:border-brand-gold hover:text-brand-gold"
            >
              Talk to an adviser
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>

          {/* The one line of reassurance that belongs at the point of decision,
              and the only place on this page the accreditation is repeated — a
              reader about to fill in a form is entitled to it here even though
              the claim is made in full further up. */}
          {/* THE ACCREDITATION IS CAMEROON'S, AND THIS LINE USED TO IMPLY IT
              WAS EVERYWHERE. It listed five nations immediately after
              "Accredited by the Ministry of Higher Education since 2007",
              which reads as five accreditations by a ministry that grants one.
              The university raised exactly this about the locations section —
              "avoid saying Five nations. One degree unless the university can
              substantiate the accreditation/degree status in each of those
              countries" — and the same objection lands here. The regulator is
              named, its campuses are named, and nothing else is claimed. */}
          <p className="mt-11 border-t border-white/15 pt-7 font-sans text-[12.5px] leading-relaxed text-white/70">
            Accredited by the Ministry of Higher Education since 2007 · Campuses at Buea and
            Douala · Online worldwide
          </p>
        </div>
      </div>
    </section>
  );
}
