import type { ReactNode } from 'react';

export function SectionHeading({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <div className="mb-10 text-center">
      <h2
        className={`font-heading text-3xl font-bold uppercase tracking-wide sm:text-4xl ${
          light ? 'text-white' : 'text-brand-purple'
        }`}
      >
        {children}
      </h2>
      <div className="mx-auto mt-3 h-1 w-16 rounded bg-brand-gold" />
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
    <section id={id} className={`py-16 sm:py-20 ${className}`}>
      <div className="mx-auto max-w-7xl px-4">{children}</div>
    </section>
  );
}
