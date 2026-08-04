import Image from 'next/image';
import Link from 'next/link';
import { getCta } from '@/lib/data';

export default async function Cta() {
  const cta = await getCta();
  return (
    <section className="relative overflow-hidden py-20 text-center text-white sm:py-24">
      <Image src="/images/wp/footer-building.jpg" alt="" fill className="object-cover" sizes="100vw" />
      <div className="absolute inset-0 bg-gradient-to-b from-brand-purple/85 to-brand-purple-dark/95" />
      <div className="relative mx-auto max-w-3xl px-4">
        <p className="mb-4 font-sans text-xs font-semibold uppercase tracking-[0.25em] text-brand-gold">
          Begin Your Journey
        </p>
        <h2 className="font-heading text-4xl font-bold leading-tight tracking-tight sm:text-5xl [text-wrap:balance]">
          {cta.title}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-white/85">{cta.text}</p>
        <div className="mt-9 flex flex-wrap justify-center gap-4">
          <Link
            href={cta.button.href}
            className="rounded-full bg-brand-gold px-8 py-3.5 font-heading font-semibold text-brand-purple shadow-lg transition hover:bg-brand-gold-deep"
          >
            {cta.button.label}
          </Link>
          <Link
            href="/contact"
            className="rounded-full border-2 border-white/60 px-8 py-3.5 font-heading font-semibold text-white transition hover:border-brand-gold hover:text-brand-gold"
          >
            Talk to Admissions
          </Link>
        </div>
      </div>
    </section>
  );
}
