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
      {/* THE CAMBRIDGE PHOTOGRAPH IS GONE.
          This band used /images/wp/footer-building.jpg — a 2560px photograph of
          an English collegiate quadrangle, inherited from the WordPress theme.
          It is the highest-resolution image in the repository, which is exactly
          why it kept being reached for, and it is a picture of Cambridge.

          An African university showing an English college as its own backdrop
          is not a stock-photo problem, it is a credibility problem: anyone who
          recognises the building — and Cambridge is among the most recognisable
          architecture on earth — reads it as borrowing someone else's campus.

          Replaced with the university's own engraved ground, which is vector,
          resolves at any size, and is the same artwork as the certificate. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 110% 80% at 20% 15%, rgba(120,102,186,0.45), transparent 62%),'
            + 'radial-gradient(ellipse 95% 75% at 84% 80%, rgba(233,193,74,0.16), transparent 64%)',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: 'repeating-linear-gradient(104deg, #f7dc79 0 1px, transparent 1px 22px)' }}
      />
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
