import Image from 'next/image';
import { Crown, Briefcase, ShieldCheck } from 'lucide-react';

// ---------------------------------------------------------------------------
// OUR CONVICTIONS — a triptych on a cream ground.
//
// ===========================================================================
// THE THIRD VERSION, AND WHY THE SECOND ONE STILL NEEDED WORK
// ===========================================================================
//
// Version one: three bordered cards in a row — a motto as a feature table.
// Version two: a sticky scene, one word per viewport, three screens of
// scrolling. Cut because it cost 3.0 screens, and because splitting the motto
// across three screens meant the reader never saw it AS a motto.
//
// Version three — three columns of type on a dark full-bleed photograph —
// fixed both of those and introduced a third fault that only shows when you
// look at the page as a whole rather than at the section: it sat directly above
// the faculties section, which is also dark and also full-viewport. Two
// consecutive dark screens with no ground between them read as one tunnel, and
// the reader loses any sense of having moved from one idea to the next.
//
// ===========================================================================
// WHAT THE UNIVERSITY'S REFERENCE DESIGN GOT RIGHT
// ===========================================================================
//
// It puts this section on a CREAM ground and keeps the darkness inside a
// photographic triptych — three panels butted together as one horizontal block,
// each carrying an engraved icon, the word, the claim and the argument.
//
// That beats a full-bleed dark band for a reason worth writing down: it makes
// the three convictions an OBJECT on the page rather than the page itself. An
// object can be looked at. A full-bleed band is something you are inside, and
// things you are inside are harder to regard as a whole — which is the exact
// quality a motto needs.
//
// It also restores the light-dark rhythm: cream here, dark for the faculties.
// That alternation is what stops a long page from feeling like one
// undifferentiated scroll, and it had been lost.
//
// ===========================================================================
// THE PANELS ARE BUTTED, NOT SPACED
// ===========================================================================
//
// No gaps, no rounded corners on the individual panels, no shadows between
// them — one hairline each. Three separated tiles are three cards however they
// are styled; three panels sharing an edge are one figure divided into three
// parts, which is what a triptych is and what the motto is.
// ---------------------------------------------------------------------------

const CONVICTIONS = [
  {
    word: 'Nobility',
    icon: Crown,
    title: 'Education owed, not sold',
    body:
      'We bring accredited higher education within reach of working adults, ministers and '
      + 'first-generation students — in Cameroon, across Africa, and anywhere a connection reaches.',
    src: '/images/graduation-2024/grad-2024-graduands-scrolls.jpg',
    focal: '50% 32%',
  },
  {
    word: 'Professionalism',
    icon: Briefcase,
    title: 'Taught by people who have done it',
    body:
      'Our faculty hold the highest qualifications and real-world experience. Theory is applied '
      + 'from the first semester because it was practised before it was taught.',
    src: '/images/graduation-2024/grad-2024-faculty-robes.jpg',
    focal: '50% 30%',
  },
  {
    word: 'Godliness',
    icon: ShieldCheck,
    title: 'Character formed alongside competence',
    body:
      'Founded within the International Circle of Faith, we hold that rigorous scholarship and '
      + 'formed character belong together.',
    src: '/images/graduation-2024/grad-2024-hooding.jpg',
    focal: '50% 34%',
  },
];

export default function Formation() {
  return (
    <section
      data-chapter="Formation"
      aria-labelledby="formation-heading"
      className="relative z-10 bg-brand-cream py-24 dark:bg-[#181121] sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brand-gold-ink dark:text-brand-gold">
            Our convictions
          </p>
          {/* Full stops rather than commas. The stops are the point: they make
              three words into three statements without breaking them into three
              sections, which is what the sticky version did wrong. */}
          <h2
            id="formation-heading"
            className="mt-5 font-heading text-[clamp(1.8rem,3.6vw,2.9rem)] font-bold leading-[1.12] tracking-[-0.02em] text-brand-purple dark:text-white [text-wrap:balance]"
          >
            Nobility. Professionalism. Godliness.
          </h2>
          <div
            aria-hidden="true"
            className="mx-auto mt-6 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold"
          />
        </div>

        <div className="mt-16 grid overflow-hidden rounded-sm shadow-lift-lg ring-1 ring-brand-purple/10 sm:mt-20 md:grid-cols-3">
          {CONVICTIONS.map(({ word, icon: Icon, title, body, src, focal }, i) => (
            <article
              key={word}
              className={`relative isolate flex min-h-[22rem] flex-col items-center justify-center px-8 py-14 text-center text-white lg:min-h-[25rem] lg:px-10 ${
                i > 0 ? 'md:border-l md:border-white/15' : ''
              }`}
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="(min-width:768px) 33vw, 100vw"
                quality={78}
                loading="lazy"
                className="-z-20 object-cover"
                style={{ objectPosition: focal }}
              />
              {/* Heavy and even, unlike the directional scrims on the full-bleed
                  bands. Each panel is a third of the width carrying a paragraph
                  at 14px, so there is no part of the picture that is NOT behind
                  text and nowhere for a gradient to open up. */}
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(14,7,30,0.90) 0%, rgba(18,10,36,0.86) 50%, '
                    + 'rgba(14,7,30,0.92) 100%)',
                }}
              />
              <div aria-hidden="true" className="absolute inset-0 -z-10 bg-brand-purple/25 mix-blend-multiply" />

              <Icon size={34} strokeWidth={1.25} aria-hidden="true" className="text-brand-gold" />

              <h3 className="mt-7 font-sans text-[12px] font-semibold uppercase tracking-[0.3em] text-brand-gold">
                {word}
              </h3>

              <p className="mt-5 font-heading text-[19px] font-bold leading-snug text-white [text-wrap:balance]">
                {title}
              </p>

              <p className="mt-5 max-w-xs text-[14px] leading-relaxed text-white/85">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
