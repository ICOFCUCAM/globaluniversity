import Image from 'next/image';
import Link from 'next/link';
import { chancellor, welcomeExcerpt } from '@/content/welcome';

// ---------------------------------------------------------------------------
// THE CHANCELLOR — a compact welcome band.
//
// ===========================================================================
// THIS IS THE THIRD SHAPE AND IT IS A DELIBERATE RETURN
// ===========================================================================
//
// It began as a purple band with the portrait in a rounded plate beside five
// paragraphs. It was then rebuilt as a full-viewport split — half the screen of
// him, half of one sentence at 4.6rem — on the argument that the plate had
// shrunk the man to a 56-pixel dot beside his own name.
//
// The university has asked for the compact band back, and the argument for the
// split does not survive contact with what it actually cost. Half a viewport of
// portrait plus half a viewport of eight words is a whole screen spent on one
// quotation, in the middle of a page whose entire redesign has been about
// giving each idea one moment and no more. The Chancellor's welcome is a
// welcome. It is not the argument of the university, and sizing it as though it
// were pushed the faculties and the fellowship further from a reader who is
// still deciding whether to keep scrolling.
//
// What the earlier card got wrong was not its scale — it was that the portrait
// was tiny, the quotation was five paragraphs, and nothing was composed. Fixed
// here: the portrait is a real portrait at 17rem with a gold plaque carrying
// his name, the quotation is ONE sentence-pair rather than five paragraphs, and
// the band is about a third of a screen instead of a whole one.
//
// ===========================================================================
// THE QUOTATION IS HIS, AND IT IS NOT TRIMMED FOR EFFECT
// ===========================================================================
//
// welcomeExcerpt in content/welcome.ts, which is the second paragraph of the
// address at /welcome with its subordinate clause removed and nothing else
// changed. It says why the institution exists in two sentences, which is why it
// can carry a band this size on its own.
// ---------------------------------------------------------------------------

export default function ChancellorWord() {
  return (
    <section
      data-on-dark=""
      data-chapter="Chancellor"
      aria-labelledby="chancellor-heading"
      className="relative z-10 overflow-hidden bg-brand-purple-dark py-20 text-white sm:py-24"
    >
      {/* A single soft violet field, off-centre. Not an Aurora with two fields
          and not a photograph: this band's job is to hold a portrait, and a
          busy ground behind a portrait is two subjects in one frame. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 70% 90% at 18% 40%, rgba(120,88,196,0.38) 0%, rgba(120,88,196,0) 70%)',
        }}
      />

      <div className="mx-auto max-w-6xl px-6 sm:px-10 lg:px-14">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-16">
          {/* ---- THE PORTRAIT ---------------------------------------------
              A plate, with a rounded corner and a gold plaque across the foot
              of it — the one place on this homepage a rounded container is
              right, because a framed portrait with a name plate under it is
              what a university actually hangs on a wall.

              pb-8 on the wrapper leaves room for the plaque to overlap the
              bottom edge rather than sit inside the frame and crop the
              photograph. */}
          <figure className="relative mx-auto w-full max-w-[17rem] pb-8">
            <div className="relative aspect-[3/4] overflow-hidden rounded-2xl ring-1 ring-white/15">
              <Image
                src={chancellor.image}
                alt={`${chancellor.name}, Chancellor of ICOF Global University`}
                fill
                sizes="17rem"
                quality={88}
                loading="lazy"
                className="object-cover"
                style={{ objectPosition: '50% 22%' }}
              />
            </div>
            <figcaption className="absolute inset-x-4 bottom-0 rounded-xl bg-brand-gold px-4 py-2.5 text-center shadow-gold">
              <span className="block font-heading text-[13.5px] font-bold leading-tight text-brand-purple">
                {chancellor.name}
              </span>
              <span className="mt-0.5 block font-sans text-[9.5px] font-semibold uppercase tracking-[0.22em] text-brand-purple/80">
                {chancellor.role}
              </span>
            </figcaption>
          </figure>

          {/* ---- THE WELCOME ---------------------------------------------- */}
          <div>
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brand-gold">
              Welcome
            </p>

            <h2
              id="chancellor-heading"
              className="mt-4 font-heading text-[clamp(1.8rem,3.6vw,2.7rem)] font-bold leading-[1.1] tracking-[-0.02em] [text-wrap:balance]"
            >
              A word from our Chancellor
            </h2>

            <span aria-hidden="true" className="mt-6 block h-[3px] w-16 rounded-full bg-brand-gold" />

            <blockquote className="relative mt-8 pl-10">
              {/* A quotation mark as a mark, not as punctuation — set large,
                  in gold, outside the measure so the text stays flush. It is
                  aria-hidden because the blockquote already announces itself
                  and a screen reader does not need a decorative glyph read to
                  it as "left double quotation mark". */}
              <span
                aria-hidden="true"
                className="absolute left-0 top-[-0.9rem] font-heading text-[3.6rem] leading-none text-brand-gold/45"
              >
                &ldquo;
              </span>
              <p className="max-w-2xl text-[16px] leading-relaxed text-white/85 sm:text-[18px]">
                {welcomeExcerpt}
              </p>
            </blockquote>

            <div className="mt-9 flex flex-wrap items-center gap-x-10 gap-y-6">
              <div>
                <span className="block font-heading text-[15.5px] font-bold text-brand-gold">
                  {chancellor.name}
                </span>
                {/* Carried through every rewrite of this band. It is the title
                    he holds in the fellowship the university stands within, and
                    dropping it in a redesign would quietly demote him. */}
                <span className="mt-1 block font-sans text-[12.5px] text-white/70">
                  Presiding Bishop, International Circle of Faith
                </span>
              </div>

              <Link
                href="/welcome"
                className="group inline-flex items-center gap-3 rounded-full border-2 border-brand-gold/70 px-7 py-3 font-heading text-[14px] font-bold text-brand-gold transition duration-300 hover:bg-brand-gold hover:text-brand-purple"
              >
                Read the full welcome
                <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
