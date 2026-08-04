import Image from 'next/image';
import { Section, SectionHeading } from '@/components/Section';
import PageBanner from '@/components/PageBanner';
import Cta from '@/components/Cta';
import { getFaculty } from '@/lib/data';

export const metadata = { title: 'Faculty & Leadership' };

export default async function FacultyPage() {
  const { leadership, faculty } = await getFaculty();

  return (
    <>
      <PageBanner title="Faculty & Leadership" image="/images/hall.jpg" />
      <Section>
        <SectionHeading>University Leadership</SectionHeading>
        <div className="mx-auto grid max-w-3xl gap-10 sm:grid-cols-2">
          {leadership.map((person) => (
            <div key={person.name} className="text-center">
              <div className="relative mx-auto h-56 w-56 overflow-hidden rounded-full shadow-lg">
                <Image src={person.image} alt={person.name} fill className="object-cover" />
              </div>
              <h3 className="mt-5 font-heading text-lg font-semibold text-brand-purple">{person.name}</h3>
              <p className="text-sm font-medium text-brand-gold-deep">{person.role}</p>
              <p className="mt-2 text-sm text-brand-muted">{person.bio}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="bg-white">
        <SectionHeading>Our Faculty</SectionHeading>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {faculty.map((person) => (
            <div key={person.name} className="text-center">
              <div className="relative mx-auto h-44 w-44 overflow-hidden rounded-full shadow-md">
                <Image src={person.image} alt={person.name} fill className="object-cover" />
              </div>
              <h3 className="mt-4 font-heading font-semibold text-brand-purple">{person.name}</h3>
              <p className="text-sm text-brand-gold-deep">{person.role}</p>
            </div>
          ))}
        </div>
      </Section>
      <Cta />
    </>
  );
}
