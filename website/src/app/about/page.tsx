import Image from 'next/image';
import Reveal from '@/components/Reveal';
import { SpotlightGroup, SpotlightCard } from '@/components/Spotlight';
import { Section, SectionHeading } from '@/components/Section';
import Cta from '@/components/Cta';
import PageBanner from '@/components/PageBanner';
import { getAbout, getFaculty } from '@/lib/data';

export const metadata = { title: 'About Us' };

export default async function AboutPage() {
  const about = await getAbout();
  const { leadership } = await getFaculty();

  return (
    <>
      <PageBanner title="About Us" image="/images/global.jpg" />
      <Section>
        <SectionHeading>{about.heading}</SectionHeading>
        <p className="mx-auto max-w-3xl text-center text-brand-muted">{about.intro}</p>
        <SpotlightGroup className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {about.items.map((item) => (
            <SpotlightCard key={item.title} className="h-full overflow-hidden rounded-2xl border border-brand-sand bg-white p-8 transition duration-500 hover:shadow-lift" tone="light">
              <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-gradient-to-r from-brand-gold-deep to-brand-gold transition-transform duration-500 group-hover/sc:scale-x-100" />
              <h3 className="font-heading text-lg font-bold leading-snug text-brand-purple [text-wrap:balance]">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-brand-muted">{item.body}</p>
            </SpotlightCard>
          ))}
        </SpotlightGroup>
      </Section>

      <Section className="bg-white">
        <SectionHeading>University Leadership</SectionHeading>
        <div className="mx-auto grid max-w-3xl gap-10 sm:grid-cols-2">
          {leadership.map((person, i) => (
            <Reveal key={person.name} delay={i * 110}>
              <div className="group text-center">
                <div className="relative mx-auto h-56 w-56 overflow-hidden rounded-full shadow-lift ring-2 ring-transparent transition duration-500 group-hover:-translate-y-1 group-hover:shadow-lift-lg group-hover:ring-brand-gold">
                  <Image
                    src={person.image}
                    alt={person.name}
                    fill
                    className="object-cover object-top transition duration-[900ms] ease-out group-hover:scale-105"
                    sizes="224px"
                  />
                </div>
                <h3 className="mt-5 font-heading text-lg font-bold text-brand-purple">{person.name}</h3>
                <p className="mt-0.5 font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-gold-deep">
                  {person.role}
                </p>
                <p className="mt-2.5 text-sm leading-relaxed text-brand-muted">{person.bio}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>
      <Cta />
    </>
  );
}
