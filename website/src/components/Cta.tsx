import Link from 'next/link';
import { getCta } from '@/lib/data';

export default async function Cta() {
  const cta = await getCta();
  return (
    <section className="bg-brand-purple py-16 text-center text-white">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="font-heading text-3xl font-bold uppercase tracking-wide text-brand-gold sm:text-4xl">
          {cta.title}
        </h2>
        <p className="mt-4 text-white/85">{cta.text}</p>
        <Link
          href={cta.button.href}
          className="mt-8 inline-block rounded-full bg-brand-gold px-8 py-3 font-heading font-semibold text-brand-purple transition hover:bg-brand-gold-deep"
        >
          {cta.button.label}
        </Link>
      </div>
    </section>
  );
}
