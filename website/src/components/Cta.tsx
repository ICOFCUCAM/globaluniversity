import Image from 'next/image';
import Link from 'next/link';
import { getCta } from '@/lib/data';
import { Aurora, Grain, Seam, LightShaft } from './Atmosphere';
import Magnetic from './Magnetic';
import KineticText from './KineticText';

export default async function Cta() {
  const cta = await getCta();
  return (
    <section className="relative overflow-hidden py-20 text-center text-white sm:py-24">
      <Image src="/images/wp/footer-building.jpg" alt="" fill loading="lazy" quality={60} className="object-cover" sizes="100vw" />
      {/* Order matters: atmosphere sits ON the photograph, then a scrim goes
          over the atmosphere. Putting the aurora last washed the whole band
          out — its purple field is lighter than the ground it was tinting. */}
      <Aurora tone="purple" intensity={0.35} fields={2} />
      <LightShaft />
      <div className="absolute inset-0 bg-gradient-to-b from-brand-purple-dark/80 via-brand-purple/70 to-brand-purple-dark/92" />
      <Grain />
      <Seam />
      <div className="relative mx-auto max-w-3xl px-4">
        <p className="mb-4 font-sans text-xs font-semibold uppercase tracking-[0.25em] text-brand-gold">
          Begin Your Journey
        </p>
        <KineticText
          as="h2"
          className="font-heading text-display-lg font-bold [text-wrap:balance]"
          wordClassName="text-transparent [background-image:linear-gradient(175deg,#ffffff_40%,#f7e6b4_82%,#e9c14a_100%)] [background-clip:text] [-webkit-background-clip:text]"
        >
          {cta.title}
        </KineticText>
        <p className="mx-auto mt-5 max-w-xl text-white/85">{cta.text}</p>
        <div className="mt-9 flex flex-wrap justify-center gap-4">
          <Magnetic strength={9}>
            <Link
              href={cta.button.href}
              className="block rounded-full bg-brand-gold px-8 py-3.5 font-heading font-semibold text-brand-purple shadow-gold transition hover:bg-brand-gold-deep"
            >
              {cta.button.label}
            </Link>
          </Magnetic>
          <Magnetic strength={9}>
            <Link
              href="/contact"
              className="block rounded-full border-2 border-white/50 px-8 py-3.5 font-heading font-semibold text-white backdrop-blur-sm transition hover:border-brand-gold hover:text-brand-gold"
            >
              Talk to Admissions
            </Link>
          </Magnetic>
        </div>
      </div>
    </section>
  );
}
