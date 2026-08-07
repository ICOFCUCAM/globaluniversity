import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Section, SectionHeading, Eyebrow } from '@/components/Section';
import Reveal from '@/components/Reveal';
import { fr } from '@/content/fr';
import { partners } from '@/content/site';

export const metadata: Metadata = {
  title: 'Université Mondiale ICOF — L’Université Communautaire d’Afrique',
  description: fr.home.lead,
  alternates: { canonical: '/fr', languages: { en: '/', fr: '/fr' } },
};

export default function FrenchHome() {
  return (
    <>
      <section className="relative overflow-hidden bg-brand-purple text-white">
        <Image src="/images/home-hero.jpg" alt="" fill priority className="object-cover opacity-40" sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-purple/70 via-brand-purple/55 to-brand-purple-dark/90" />
        <div className="relative mx-auto max-w-4xl px-4 py-32 text-center sm:py-44">
          <h1 className="font-heading text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl [text-wrap:balance]">
            {fr.home.title}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-brand-gold/95">{fr.home.lead}</p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/apply" className="rounded-full bg-brand-gold px-8 py-3 font-heading font-semibold text-brand-purple transition hover:bg-brand-gold-deep">
              {fr.home.ctaPrimary}
            </Link>
            <Link href="/fr/programmes" className="rounded-full border-2 border-white/60 px-8 py-3 font-heading font-semibold text-white transition hover:border-brand-gold hover:text-brand-gold">
              {fr.home.ctaSecondary}
            </Link>
          </div>
        </div>
      </section>

      <Section>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <Eyebrow>{fr.home.aboutEyebrow}</Eyebrow>
            <h2 className="font-heading text-3xl font-bold leading-tight tracking-tight text-brand-purple sm:text-[2.6rem]">
              {fr.home.aboutHeading}
            </h2>
            <div className="mt-4 h-[3px] w-16 rounded bg-brand-gold" />
            <p className="mt-6 leading-relaxed text-brand-muted">{fr.home.aboutBody}</p>
            <Link href="/fr/a-propos" className="mt-8 inline-block rounded-full bg-brand-purple px-7 py-3 font-heading text-sm font-semibold text-white transition hover:bg-brand-purple-dark">
              {fr.common.learnMore}
            </Link>
          </Reveal>
          <Reveal delay={150}>
            <div className="relative h-80 overflow-hidden rounded-2xl shadow-xl lg:h-[420px]">
              <Image src="/images/hall.jpg" alt="" fill className="object-cover" sizes="(min-width:1024px) 50vw, 100vw" />
            </div>
          </Reveal>
        </div>
      </Section>

      <Section className="bg-white">
        <SectionHeading eyebrow={fr.home.pillarsEyebrow}>{fr.home.pillarsHeading}</SectionHeading>
        <div className="grid gap-8 md:grid-cols-3">
          {fr.home.pillars.map((p, i) => (
            <Reveal key={p.title} delay={i * 120}>
              <div className="h-full rounded-2xl border border-brand-sand bg-brand-cream p-8">
                <span className="font-heading text-4xl font-bold text-brand-gold-deep">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-4 font-heading text-xl font-bold text-brand-purple">{p.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-brand-muted">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <section className="bg-brand-purple-dark py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="mb-10 text-center font-sans text-xs font-semibold uppercase tracking-[0.25em] text-brand-gold">
            {fr.home.globalEyebrow}
          </p>
          <div className="grid gap-6 text-center sm:grid-cols-2 lg:grid-cols-4">
            {fr.home.campuses.map((c) => (
              <div key={c.place} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="font-heading text-lg font-bold text-brand-gold">{c.place}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/80">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-brand-purple py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="mb-10 text-center font-sans text-xs font-semibold uppercase tracking-[0.25em] text-brand-gold">
            {fr.home.statsEyebrow}
          </p>
          <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
            {fr.home.stats.map((s) => (
              <div key={s.label}>
                <p className="font-heading text-5xl font-bold text-brand-gold">{s.value}</p>
                <p className="mt-2 text-sm font-medium text-white/85">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Section className="bg-white">
        <SectionHeading eyebrow="Reconnaissance">Une accréditation de confiance</SectionHeading>
        <p className="mx-auto -mt-6 mb-10 max-w-3xl text-center text-brand-muted">{fr.home.accreditation}</p>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-10">
          {partners.map((p) => (
            <div key={p.name} className="relative h-20 w-32 grayscale transition hover:grayscale-0">
              <Image src={p.image} alt={p.name} fill className="object-contain" sizes="128px" />
            </div>
          ))}
        </div>
      </Section>

      <section className="relative overflow-hidden py-20 text-center text-white sm:py-24">
        {/* Voir Cta.tsx : la photographie précédente était un collège de
            Cambridge, héritée du thème WordPress. Remplacée par le fond gravé
            de l'université, qui est vectoriel. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 110% 80% at 20% 15%, rgba(120,102,186,0.45), transparent 62%),'
              + 'radial-gradient(ellipse 95% 75% at 84% 80%, rgba(233,193,74,0.16), transparent 64%)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-purple/85 to-brand-purple-dark/95" />
        <div className="relative mx-auto max-w-3xl px-4">
          <h2 className="font-heading text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Votre avenir commence ici.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-white/85">
            Positionnez-vous pour réussir dans une université accréditée. Remplissez le formulaire de
            candidature et nous vous aiderons à démarrer sur la bonne voie.
          </p>
          <Link href="/apply" className="mt-9 inline-block rounded-full bg-brand-gold px-8 py-3.5 font-heading font-semibold text-brand-purple shadow-lg transition hover:bg-brand-gold-deep">
            {fr.common.applyNow}
          </Link>
        </div>
      </section>
    </>
  );
}
