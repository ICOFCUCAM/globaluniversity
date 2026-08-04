import Image from 'next/image';
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
        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {about.items.map((item) => (
            <div key={item.title} className="rounded-xl border-t-4 border-brand-gold bg-white p-6 shadow-sm">
              <h3 className="font-heading text-lg font-semibold text-brand-purple">{item.title}</h3>
              <p className="mt-3 text-sm text-brand-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="bg-white">
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
      <Cta />
    </>
  );
}
