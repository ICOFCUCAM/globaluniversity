import type { ReactNode } from 'react';
import KineticText from './KineticText';

export function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <p
      className={`mb-3 font-sans text-xs font-semibold uppercase tracking-[0.25em] ${
        light ? 'text-brand-gold' : 'text-brand-gold-ink'
      }`}
    >
      {children}
    </p>
  );
}

export function SectionHeading({
  children,
  eyebrow,
  light = false,
  align = 'center',
}: {
  children: ReactNode;
  eyebrow?: ReactNode;
  light?: boolean;
  align?: 'center' | 'left';
}) {
  const centered = align === 'center';
  return (
    <div className={`mb-10 ${centered ? 'text-center' : 'text-left'}`}>
      {eyebrow && <Eyebrow light={light}>{eyebrow}</Eyebrow>}
      {/* Strings get the kinetic treatment; rich nodes (headings that carry
          markup) fall back to a plain h2 so nothing is silently dropped. */}
      {typeof children === 'string' ? (
        <KineticText
          className={`font-heading text-display font-bold [text-wrap:balance] ${
            light ? 'text-white' : 'text-brand-purple dark:text-white'
          }`}
        >
          {children}
        </KineticText>
      ) : (
        <h2
          className={`font-heading text-display font-bold [text-wrap:balance] ${
            light ? 'text-white' : 'text-brand-purple dark:text-white'
          }`}
        >
          {children}
        </h2>
      )}
      <div
        className={`mt-5 h-[3px] w-16 rounded-full bg-gradient-to-r from-brand-gold-deep to-brand-gold ${
          centered ? 'mx-auto' : ''
        }`}
      />
    </div>
  );
}

export function Section({
  children,
  className = '',
  id,
  chapter,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  /** Label picked up by ScrollRail to build the page index. */
  chapter?: string;
}) {
  return (
    /* WHITESPACE IS THE CHEAPEST SIGNAL OF CONFIDENCE A PAGE HAS.
       This was py-14 / sm:py-20 — about 56px and 80px — which on a 1440px
       screen puts roughly one section-height of content between two headings
       and reads as compressed. Every institution this site is measured against
       runs 120–160px between bands. The cost is scroll length, which is not a
       cost: a visitor who is interested scrolls, and one who is not left at the
       hero either way. */
    /* RELATIVE AND OPAQUE, ALWAYS — this is what lets a section CROSS a pinned
       scene instead of disappearing behind it.

       A scene band (Formation, FacultyScenes, FixedWindow) holds a photograph
       still while the reader scrolls past it, and the following section is
       supposed to rise up over that held frame. That only works if the following section
       paints ABOVE it, and a section with a background but no `position` does
       not: an unpositioned background paints in the block-background layer,
       underneath every positioned element on the page. The pinned frame would
       sit on top of the very section meant to cover it.

       That failure is close to undiagnosable from the symptom — the page looks
       like the sticky is "stuck" or the z-index is wrong, when in fact the
       covering element never entered the positioned layer at all. So `relative
       z-10` lives here rather than being remembered at each call site.

       The default background matters for the same reason and is easier to
       forget: a transparent section crossing a photograph shows the photograph
       through its own text. It is applied only when the caller has not set one,
       so the many sections with deliberate backgrounds are untouched. */
    <section
      id={id}
      data-chapter={chapter}
      className={`relative z-10 py-20 sm:py-28 lg:py-32 ${
        /\bbg-/.test(className) ? '' : 'bg-white dark:bg-[#150f1e] '
      }${className}`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">{children}</div>
    </section>
  );
}
