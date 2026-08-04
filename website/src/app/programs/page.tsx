import Image from 'next/image';
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
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {programs
                .filter((p) => p.school === school)
                .map((p) => (
                  <Link
                    key={p.slug}
                    href={`/programs/${p.slug}`}
                    className="group overflow-hidden rounded-2xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="relative h-44">
                      <Image src={p.image} alt={p.title} fill className="object-cover transition group-hover:scale-105" />
                      <span className="absolute left-3 top-3 rounded bg-brand-gold px-2 py-1 text-xs font-bold text-brand-purple">
                        {p.level}
                      </span>
                    </div>
                    <div className="p-5">
                      <h4 className="font-heading font-semibold text-brand-purple">{p.title}</h4>
                      <p className="mt-2 line-clamp-3 text-sm text-brand-muted">{p.summary}</p>
                      <p className="mt-3 text-sm font-semibold text-brand-gold-deep">Learn more →</p>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        ))}
      </Section>
      <Cta />
    </>
  );
}
