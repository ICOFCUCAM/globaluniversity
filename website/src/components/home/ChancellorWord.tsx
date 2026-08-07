import Link from 'next/link';
import Split from './Split';
import { chancellor } from '@/content/welcome';

// ---------------------------------------------------------------------------
// THE CHANCELLOR — a scene, not a section.
//
// ===========================================================================
// TWO REWRITES, AND WHY THE SECOND ONE WAS NEEDED
// ===========================================================================
//
// FIRST this was a purple band with the portrait in a rounded plate and five
// paragraphs beside it. A Chancellor card: 0.66 of a screen, 63 words, ninth on
// the page between two academic sections.
//
// THEN it became a full-bleed photograph of the 2024 congregation with his
// sentence set into it. Better — the card was gone — but it made the same
// mistake the rest of the page was making, one level up: it was still a band
// you scroll past, and the man himself had shrunk to a 56-pixel dot beside his
// own name. The picture was of a crowd. The Chancellor was furniture in it.
//
// NOW it is half the viewport of him and half the viewport of what he said.
// Nothing else. No paragraph of supporting copy, no second link, no card. The
// quotation is set at the largest size on the page because it carries the
// university's entire argument in eight words, and a reader who takes nothing
// else from this homepage should take that.
//
// ---------------------------------------------------------------------------
// WHY THE PORTRAIT SURVIVES AT THIS SIZE WHEN THE ANALYSIS SAID IT WOULD NOT
//
// It was written here that his portrait could not carry a large panel, because
// 595×600 across a full band is a 2.4× upscale of a face and the eye is
// merciless about faces.
//
// That reasoning assumed a headshot. The photograph is not one: it is the
// Chancellor at a lectern in blue doctoral regalia, arms open, under ceremonial
// light — a figure in a room, where the head is about a seventh of the frame.
// At a half-width panel that puts the face near 100 CSS pixels, which 595px
// carries comfortably. What the panel is really showing at scale is the gesture
// and the robe, and those are broad forms that upscale well.
//
// So the constraint was real and the conclusion drawn from it was too general.
// The right question was never "how many pixels does this file have" but "how
// many pixels does the SUBJECT occupy", and that has to be asked per photograph
// rather than per repository.
// ---------------------------------------------------------------------------

// His own sentence, from the second paragraph of the address at /welcome. Not a
// strapline written for a homepage.
const PULL = 'We were founded to open that door.';

export default function ChancellorWord() {
  return (
    <Split
      src={chancellor.image}
      alt={`${chancellor.name}, Chancellor of ICOF Global University, addressing a congregation`}
      side="left"
      focal="50% 30%"
      chapter="Chancellor"
    >
      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.34em] text-brand-gold">
        A word from our Chancellor
      </p>

      <blockquote className="mt-10">
        <p className="font-heading text-[clamp(2.4rem,5.6vw,4.6rem)] font-bold leading-[1.02] tracking-[-0.03em] text-white [text-wrap:balance]">
          &ldquo;{PULL}&rdquo;
        </p>
      </blockquote>

      <figcaption className="mt-12 border-l-2 border-brand-gold/45 pl-5">
        <span className="block font-heading text-[17px] font-bold text-white">{chancellor.name}</span>
        <span className="mt-1 block font-sans text-[10.5px] font-semibold uppercase tracking-[0.26em] text-brand-gold/85">
          {chancellor.role}
        </span>
        {/* Carried over from the band this replaces. It is the title he holds in
            the fellowship the university stands within, and dropping it in a
            rewrite would quietly demote him. */}
        <span className="mt-1.5 block font-sans text-[12.5px] text-white/75">
          Presiding Bishop, International Circle of Faith
        </span>
      </figcaption>

      <Link
        href="/welcome"
        className="group mt-12 inline-flex items-center gap-3 border-b border-brand-gold/40 pb-1 font-heading text-[15px] font-bold text-brand-gold transition duration-300 hover:border-brand-gold hover:text-white"
      >
        Read the full welcome
        <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">
          →
        </span>
      </Link>
    </Split>
  );
}
