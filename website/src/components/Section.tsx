import type { ReactNode } from 'react';

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
    <div className={`mb-12 ${centered ? 'text-center' : 'text-left'}`}>
      {eyebrow && <Eyebrow light={light}>{eyebrow}</Eyebrow>}
      <h2
        className={`font-heading text-3xl font-bold leading-tight tracking-tight sm:text-[2.6rem] ${
          light ? 'text-white' : 'text-brand-purple'
        }`}
      >
        {children}
      </h2>
      <div className={`mt-4 h-[3px] w-16 rounded bg-brand-gold ${centered ? 'mx-auto' : ''}`} />
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
    <section id={id} className={`py-16 sm:py-24 ${className}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">{children}</div>
    </section>
  );
}
