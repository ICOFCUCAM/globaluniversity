import Image from 'next/image';
import Reveal from '@/components/Reveal';
import { Section, SectionHeading } from '@/components/Section';
import PageBanner from '@/components/PageBanner';
import Cta from '@/components/Cta';
import { getCampusLife } from '@/lib/data';

export const metadata = { title: 'Campus Life' };

export default async function CampusLifePage() {
  const campus = await getCampusLife();

  return (
    <>
      <PageBanner title="Campus Life" image="/images/students.jpg" />
      <Section>
        <SectionHeading>{campus.heading}</SectionHeading>
        <p className="mx-auto mb-12 max-w-3xl text-center text-brand-muted">{campus.intro}</p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {campus.gallery.map((item) => (
            <figure key={item.image} className="group overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-brand-sand/70 transition duration-500 hover:-translate-y-1.5 hover:shadow-lift-lg hover:ring-brand-gold">
              <div className="relative h-52">
                <Image
                  src={item.image}
                  alt={item.caption}
                  fill
                  className="object-cover transition group-hover:scale-105"
                />
              </div>
              <figcaption className="p-4 text-center text-sm font-medium text-brand-purple">
                {item.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>
      <Cta />
    </>
  );
}
