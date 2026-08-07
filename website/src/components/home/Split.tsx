import Image from 'next/image';
import { Grain } from '@/components/Atmosphere';

// ---------------------------------------------------------------------------
// THE SPLIT SCENE — half photograph, half statement.
//
// ===========================================================================
// WHY THIS IS NOT Cinematic WITH A NARROWER COLUMN
// ===========================================================================
//
// Cinematic sets type ON a photograph. That is the right composition when the
// picture is an environment — a room, a crowd, a place — because the words
// belong inside it.
//
// It is the WRONG composition for a portrait. Type laid over a person competes
// with the person: the reader's eye goes to the face, the scrim has to be
// heaviest exactly where the face is, and the result is a darkened human being
// with words in front of them. Both things are diminished.
//
// A split gives each its own half. The photograph is undimmed and uncropped by
// text; the words sit on a clean ground at whatever size they deserve. It is
// how a magazine runs a portrait opposite a pull-quote, and it is the reason
// that spread has survived a century of redesign.
//
// ---------------------------------------------------------------------------
// AND WHY A SPLIT IS KINDER TO THIS ARCHIVE
//
// A half-width panel at 1440 is 720 CSS pixels. The full-bleed bands ask for
// 1080px sources and get them; a portrait at 595px would be a 2.4× upscale
// across a full band and would look it.
//
// At half width, on a photograph where the subject is a figure at a podium
// rather than a face filling the frame, the same source holds — the head is
// about a seventh of the frame, so it lands near 100 CSS pixels, well inside
// what 595px can carry. The `treat` option adds a purple duotone and grain,
// which is a real editorial treatment in its own right and, not by accident,
// the treatment that makes a soft scan read as intentional.
// ---------------------------------------------------------------------------

export interface SplitProps {
  src: string;
  alt: string;
  /** Which side the photograph takes. */
  side?: 'left' | 'right';
  focal?: string;
  /** Purple duotone + grain over the photograph. */
  treat?: boolean;
  chapter?: string;
  /**
   * A small label above the copy. It began life as a scene NUMERAL — "06 — THE
   * PEOPLE" — and every section had one.
   *
   * That was a mistake worth naming. Numbering the sections made the homepage
   * read as a demonstration of its own structure rather than as a university:
   * a reader does not need to be told they have reached section six of eleven,
   * and a page that keeps announcing its own scaffolding is a page more
   * interested in how it was built than in who it is for. The numbers are gone
   * everywhere; this prop survives for the rare case where a genuine label
   * helps orientation.
   */
  index?: string;
  className?: string;
  children: React.ReactNode;
}

export default function Split({
  src,
  alt,
  side = 'left',
  focal = '50% 32%',
  treat = true,
  chapter,
  index,
  className = '',
  children,
}: SplitProps) {
  return (
    <section
      data-on-dark=""
      data-chapter={chapter}
      className={`relative isolate grid min-h-[100svh] grid-cols-1 bg-brand-purple-dark text-white lg:min-h-[92svh] lg:grid-cols-2 ${className}`}
    >
      {/* THE PHOTOGRAPH.
          On mobile it is a band above the words, not a half — a 50/50 split at
          390px gives each side 195px, which is too narrow for either to be
          worth having. */}
      <div
        className={`relative min-h-[52svh] overflow-hidden lg:min-h-0 ${
          side === 'right' ? 'lg:order-2' : 'lg:order-1'
        }`}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(min-width:1024px) 50vw, 100vw"
          quality={86}
          loading="lazy"
          className="object-cover"
          style={{ objectPosition: focal }}
        />
        {treat && (
          <>
            {/* Duotone: a purple multiply pulls the photograph into the
                institution's colour, and a gold screen puts warmth back into
                the highlights so it does not go flat and dead. */}
            <div aria-hidden="true" className="absolute inset-0 bg-brand-purple/35 mix-blend-multiply" />
            <div aria-hidden="true" className="absolute inset-0 bg-brand-gold/10 mix-blend-screen" />
            <Grain opacity={0.08} />
          </>
        )}
        {/* The seam. A hard edge between photograph and panel reads as two
            images pasted together; a short gradient reads as one spread. On
            mobile the seam runs along the bottom instead of the side. */}
        <div
          aria-hidden="true"
          className={`absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-brand-purple-dark to-transparent lg:inset-y-0 lg:h-auto lg:w-28 ${
            side === 'right'
              ? 'lg:left-0 lg:bg-gradient-to-r'
              : 'lg:right-0 lg:left-auto lg:bg-gradient-to-l'
          }`}
        />
      </div>

      {/* THE STATEMENT. */}
      <div
        className={`relative flex items-center px-6 py-20 sm:px-10 lg:px-16 lg:py-24 ${
          side === 'right' ? 'lg:order-1' : 'lg:order-2'
        }`}
      >
        <div className="w-full max-w-xl">
          {index && (
            <p
              aria-hidden="true"
              className="mb-8 font-heading text-[11px] font-bold tracking-[0.4em] text-brand-gold/50"
            >
              {index}
            </p>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}
