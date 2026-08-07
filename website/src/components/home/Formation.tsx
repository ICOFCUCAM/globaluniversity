import Image from 'next/image';
import { Grain } from '@/components/Atmosphere';

// ---------------------------------------------------------------------------
// THE FORMATION — one screen, three words, one motto.
//
// ===========================================================================
// THE SECOND REDESIGN, AND WHY THE FIRST ONE WAS WRONG
// ===========================================================================
//
// This began as three bordered cards in a row — a motto rendered as a feature
// comparison table. That was replaced with a sticky scene: each word held a
// full viewport in turn while the photograph dissolved beneath it, three
// screens of scrolling for three words.
//
// The sticky version worked exactly as designed and was still the wrong idea,
// for two reasons that only became visible once it was on the page.
//
//   IT COST 3.0 SCREENS OF A 25-SCREEN PAGE. Together with the faculties scene
//   next to it, two sections were consuming 7.4 screens — thirty per cent of
//   the entire homepage — to deliver three convictions and four faculty names.
//   That is a rate of about one idea per screen, on a page whose central
//   problem was already length.
//
//   AND IT BROKE THE MOTTO INTO THREE UNRELATED CLAIMS. "Nobility,
//   Professionalism and Godliness" is ONE motto. It is carved on the crest as
//   one line. A reader who sees NOBILITY alone on a screen, scrolls, sees
//   PROFESSIONALISM alone on a screen, scrolls, sees GODLINESS alone on a
//   screen has been shown three separate assertions and never once shown the
//   motto. The device that was meant to give each word weight was quietly
//   dismantling the thing the words belong to.
//
// So: one viewport, all three words present at once, set at a size that makes
// the point the sticky scene was trying to make with time. The reader sees the
// motto — and can read it as a motto — and it costs one screen instead of three.
//
// ===========================================================================
// AND IT SHIPS NO JAVASCRIPT NOW
// ===========================================================================
//
// The sticky version was a client component with a scroll listener, a
// requestAnimationFrame loop, a reduced-motion query and three cross-fading
// images. This is a server component with one image. Nothing to hydrate,
// nothing to listen, nothing to reduce — the composition does the work that
// the interaction was doing, which is the better trade wherever it is
// available.
// ---------------------------------------------------------------------------

const CONVICTIONS = [
  {
    word: 'Nobility',
    title: 'Education owed, not sold',
    body:
      'Accredited higher education within reach of working adults, ministers and '
      + 'first-generation students. A qualification only the comfortable can attempt is not '
      + 'an education system.',
  },
  {
    word: 'Professionalism',
    title: 'Taught by people who have done it',
    body:
      'Our faculty earned their doctorates and senior qualifications in pulpits, classrooms, '
      + 'laboratories and boardrooms before bringing that work into the lecture hall.',
  },
  {
    word: 'Godliness',
    title: 'Character formed alongside competence',
    body:
      'Rigorous scholarship and formed character belong together. A degree that trains a mind '
      + 'and forms no one is only a piece of paper, however well examined.',
  },
];

export default function Formation() {
  return (
    <section
      data-on-dark=""
      data-chapter="Formation"
      aria-labelledby="formation-heading"
      className="relative z-10 flex min-h-[100svh] items-center overflow-hidden bg-brand-purple-dark py-24 text-white sm:py-28"
    >
      <Image
        src="/images/graduation-2024/grad-2024-hooding.jpg"
        alt="A graduate of ICOF Global University being hooded at the 2024 congregation"
        fill
        sizes="100vw"
        quality={82}
        loading="lazy"
        className="-z-20 object-cover"
        style={{ objectPosition: '50% 34%' }}
      />

      {/* Heavier than the fixed-window bands. Those are showing a room; this is
          showing three words at 5rem, and type that size over a busy photograph
          is unreadable however good the picture. The photograph here is
          atmosphere, not subject. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(180deg, rgba(12,6,26,0.92) 0%, rgba(14,7,30,0.86) 45%, '
            + 'rgba(12,6,26,0.93) 100%)',
        }}
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-brand-purple/20 mix-blend-multiply" />
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <Grain opacity={0.07} />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-6 sm:px-10 lg:px-16">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brand-gold">
          03 — Our formation
        </p>

        {/* The motto as ONE line, which is how it is carved. The three words
            below are its expansion, not three separate headings — hence a
            single h2 here and h3s beneath. */}
        <h2
          id="formation-heading"
          className="mt-7 max-w-4xl font-heading text-[clamp(1.9rem,4vw,3.1rem)] font-bold leading-[1.1] tracking-[-0.02em] text-white [text-wrap:balance]"
        >
          Nobility, professionalism and godliness — the three things this
          university means to form.
        </h2>

        <div className="mt-14 grid gap-x-12 gap-y-12 lg:grid-cols-3 lg:gap-y-0">
          {CONVICTIONS.map((c, i) => (
            <div key={c.word} className="relative">
              {/* A hairline above each column rather than a box around it. The
                  rule groups without enclosing, which is the whole difference
                  between an editorial page and a page made of cards. */}
              <div aria-hidden="true" className="mb-7 h-px w-full bg-gradient-to-r from-brand-gold/60 to-transparent" />
              <p
                aria-hidden="true"
                className="mb-4 font-heading text-[11px] font-bold tracking-[0.4em] text-brand-gold/75"
              >
                {String(i + 1).padStart(2, '0')}
              </p>
              {/* SIZED FOR THE LONGEST WORD, NOT THE SHORTEST.
                  At clamp(2.1rem,3.8vw,3.4rem) "PROFESSIONALISM" — fifteen
                  characters — overran its third of the grid and collided with
                  "GODLINESS" in the column beside it. NOBILITY and GODLINESS
                  both fitted, so the fault was invisible in two of three
                  columns and only showed on the page.
                  overflow-wrap:anywhere was the first attempt and it was worse:
                  it stopped the collision by BREAKING the word, so the column
                  read "PROFESSIONALIS / M" with an orphaned letter on its own
                  line. It also fooled the measurement — asking for the text's
                  bounding width returns the widest LINE, so a word that had
                  already wrapped measured as comfortably fitting.
                  The size is now set so the longest word fits on one line at
                  every width the three-column grid applies, and the check is
                  line COUNT rather than width. */}
              <h3 className="font-heading text-[clamp(1.35rem,2.25vw,1.95rem)] font-bold uppercase leading-[1.05] tracking-[-0.02em] text-white">
                {c.word}
              </h3>
              <p className="mt-5 font-heading text-[17px] font-bold leading-snug text-brand-gold">
                {c.title}
              </p>
              <p className="mt-4 text-[14.5px] leading-relaxed text-white/85">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
