import Image from 'next/image';
import Reveal from '@/components/Reveal';
import { SpotlightGroup, SpotlightCard } from '@/components/Spotlight';
import Link from 'next/link';
import { Section, SectionHeading } from '@/components/Section';
import PageBanner from '@/components/PageBanner';
import Cta from '@/components/Cta';
import { getPrograms } from '@/lib/data';

export const metadata = { title: 'Programs & Degrees' };

export default async function ProgramsPage() {
  const programs = await getPrograms();
  const schools = Array.from(new Set(programs.map((p) => p.school)));

  return (
    <>
      <PageBanner title="Programs & Degrees" image="/images/graduation.jpg" />
      <Section>
        <SectionHeading eyebrow="Degrees & Programs">Course catalog</SectionHeading>
        <p className="mx-auto mb-12 max-w-3xl text-center text-brand-muted">
          From certificates to doctoral degrees — Doctor of Philosophy, Doctor of Theology, Master of
          Arts, Bachelor of Science, Diploma and Certificate programs across our schools.
        </p>
        <div className="mx-auto mb-14 flex max-w-4xl flex-wrap justify-center gap-3">
          {[
            ['Bachelor’s', '/degrees/bachelors-degrees'],
            ['Master’s', '/degrees/masters-degrees'],
            ['Doctoral', '/degrees/doctoral'],
            ['HND', '/degrees/higher-national-diploma-hnd'],
            ['Diploma', '/degrees/diploma-dip'],
            ['Certificates', '/degrees/certificates'],
            ['Study Online', '/online-learning'],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="rounded-full border border-brand-sand bg-white px-5 py-2 font-heading text-sm font-semibold text-brand-purple transition hover:border-brand-gold-deep hover:bg-brand-gold/20"
            >
              {label}
            </Link>
          ))}
        </div>
        {schools.map((school) => (
          <div key={school} className="mb-14">
            <h3 className="mb-6 border-l-4 border-brand-gold pl-4 font-heading text-2xl font-bold text-brand-purple">
              {school}
            </h3>
            <SpotlightGroup className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {programs
                .filter((p) => p.school === school)
                .map((p) => (
                  <Link
                    key={p.slug}
                    href={`/programs/${p.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-brand-sand/70 transition duration-500 hover:-translate-y-1.5 hover:shadow-lift-lg hover:ring-brand-gold"
                  >
                    <div className="relative h-44">
                      <Image src={p.image} alt={p.title} fill loading="lazy" sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover transition duration-[900ms] ease-out group-hover:scale-110" />
                      <span className="absolute left-4 top-4 rounded-full bg-brand-gold px-3 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-brand-purple shadow-sm">
                        {p.level}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <h4 className="font-heading text-lg font-bold leading-snug text-brand-purple [text-wrap:balance]">{p.title}</h4>
                      <p className="mt-2 flex-1 line-clamp-3 text-sm leading-relaxed text-brand-muted">{p.summary}</p>
                      <span className="mt-4 flex items-center gap-1.5 font-heading text-sm font-semibold text-brand-purple">Learn more<span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1.5">→</span></span>
                    </div>
                  </Link>
                ))}
            </SpotlightGroup>
          </div>
        ))}
      </Section>
      <Cta />
    </>
  );
}
