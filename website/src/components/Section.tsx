import type { ReactNode } from 'react';
import KineticText from './KineticText';

export function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <p
      className={`mb-3 font-sans text-xs font-semibold uppercase tracking-[0.25em] ${
        light ? 'text-brand-gold' : 'text-brand-gold-deep'
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
            light ? 'text-white' : 'text-brand-purple'
          }`}
        >
          {children}
        </KineticText>
      ) : (
        <h2
          className={`font-heading text-display font-bold [text-wrap:balance] ${
            light ? 'text-white' : 'text-brand-purple'
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
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`py-14 sm:py-20 ${className}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">{children}</div>
    </section>
  );
}
