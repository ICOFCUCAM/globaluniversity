import Image from 'next/image';
import { Section, SectionHeading } from '@/components/Section';
import PageBanner from '@/components/PageBanner';
import Cta from '@/components/Cta';
import { getEvents } from '@/lib/data';

export const metadata = { title: 'Events' };

export default async function EventsPage() {
  const events = await getEvents();

  return (
    <>
      <PageBanner title="Events" image="/images/grand-ceremony.jpg" />
      <Section>
        <SectionHeading>Upcoming Events</SectionHeading>
        <div className="mx-auto max-w-4xl space-y-6">
          {events.map((ev) => (
            <article
              key={ev.slug}
              className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm transition hover:shadow-lg sm:flex-row"
            >
              <div className="relative h-48 sm:h-auto sm:w-64 sm:shrink-0">
                <Image src={ev.image} alt={ev.title} fill className="object-cover" />
              </div>
              <div className="flex flex-col justify-center p-6">
                <p className="text-sm font-bold uppercase tracking-wide text-brand-gold-deep">
                  {new Date(ev.date).toLocaleDateString('en-GB', { dateStyle: 'full' })}
                </p>
                <h3 className="mt-1 font-heading text-xl font-semibold text-brand-purple">{ev.title}</h3>
                <p className="mt-2 text-sm text-brand-muted">{ev.summary}</p>
                <p className="mt-3 text-sm font-medium text-brand-purple">📍 {ev.location}</p>
              </div>
            </article>
          ))}
        </div>
      </Section>
      <Cta />
    </>
  );
}
