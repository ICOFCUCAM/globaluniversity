import Image from 'next/image';
import Link from 'next/link';
import Cinematic from './Cinematic';
import { chancellor } from '@/content/welcome';

// ---------------------------------------------------------------------------
// THE CHANCELLOR'S WORD.
//
// WHAT THIS REPLACES. A purple band with the Chancellor's portrait in a rounded
// plate on the left and five paragraphs of his address on the right — a
// Chancellor CARD. It was 0.66 of a screen carrying 63 words, sat ninth on the
// page between two academic sections, and read as an item in a list.
//
// The photograph is now the room he is speaking in. The band is a viewport of
// the 2024 congregation in full academic dress, the address is reduced to the
// one sentence that carries the university's whole argument, and the rest of it
// is a click away at /welcome, where somebody who wants five paragraphs will
// read five paragraphs.
//
// ---------------------------------------------------------------------------
// WHY THE ENVIRONMENT IS THE CEREMONY AND NOT THE CHANCELLOR HIMSELF
//
// Because his portrait is 595×600 and a full-bleed band is 1440 CSS pixels
// wide. Stretched to the viewport it would be a 2.4× upscale of a face, and a
// face is the single least forgiving subject there is — the eye has dedicated
// hardware for it and reads softness as something wrong with the person.
//
// So the two photographs do different jobs at the sizes each can carry. The
// congregation, at 1080px, is the ground: scrimmed, grained, behind type, where
// 1080 into 1440 is well within what Cinematic is built for. The portrait, at
// 595px, renders at 88 CSS pixels beside his name, which is sharp with six
// times the pixels to spare.
//
// That is the whole discipline: not "can we use photography", but "at what size
// can THIS photograph be used", answered per image rather than per page.
// ---------------------------------------------------------------------------

// The sentence the address turns on. It is his own line from /welcome — the
// second paragraph — not a strapline written for a homepage.
const PULL = 'We were founded to open that door.';

export default function ChancellorWord() {
  return (
    <Cinematic
      src="/images/graduation-2024/grad-2024-platform-party.jpg"
      // Real alt text, not "". The picture is the university's own congregation
      // in academic dress; a reader who cannot see it is missing something the
      // words on top do not say.
      alt="Faculty and graduands of ICOF Global University in full academic dress at the 2024 congregation"
      anchor="left"
      focal="50% 26%"
      exposure={0.55}
      height="tall"
      chapter="Chancellor"
    >
      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brand-gold">
        A word from our Chancellor
      </p>

      {/* No quotation marks drawn as decoration. blockquote + the actual
          characters, so the mark is in the text where a screen reader will
          announce it, rather than being a giant serif glyph that is invisible
          to everyone not looking at it. */}
      <blockquote className="mt-8">
        <p className="font-heading text-[clamp(2.1rem,5vw,3.9rem)] font-bold leading-[1.06] tracking-[-0.025em] text-white [text-wrap:balance]">
          &ldquo;{PULL}&rdquo;
        </p>
      </blockquote>

      <p className="mt-8 max-w-lg text-[15px] leading-relaxed text-white/90 sm:text-base">
        Across Africa and far beyond it there are men and women with the calling and the
        capacity for higher study who have never been given the door.
      </p>

      <figcaption className="mt-10 flex items-center gap-4">
        <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-1 ring-brand-gold/50">
          <Image
            src={chancellor.image}
            alt=""
            fill
            // 56px at 1x, 112 at 2x, 168 at 3x — all well inside a 595px source.
            sizes="56px"
            className="object-cover object-top"
          />
        </span>
        <span>
          <span className="block font-heading text-[15px] font-bold text-white">{chancellor.name}</span>
          <span className="block font-sans text-[10.5px] font-semibold uppercase tracking-[0.24em] text-white/80">
            {chancellor.role}
          </span>
          {/* Carried over from the band this replaces. It is the title he holds
              in the fellowship the university stands within, and dropping it in
              a rewrite would quietly demote him. */}
          <span className="mt-0.5 block font-sans text-[12px] text-white/75">
            Presiding Bishop, International Circle of Faith
          </span>
        </span>
      </figcaption>

      <Link
        href="/welcome"
        className="group mt-9 inline-flex items-center gap-3 border-b border-brand-gold/40 pb-1 font-heading text-[15px] font-bold text-brand-gold transition duration-300 hover:border-brand-gold hover:text-white"
      >
        Read the full welcome
        <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
          →
        </span>
      </Link>
    </Cinematic>
  );
}
