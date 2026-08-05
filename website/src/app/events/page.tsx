import Image from 'next/image';
import Reveal from '@/components/Reveal';
import { IconCampus } from '@/components/Icons';
import { Section, SectionHeading } from '@/components/Section';
import PageBanner from '@/components/PageBanner';
import Cta from '@/components/Cta';
import { getEvents } from '@/lib/data';

export const metadata = { title: 'Events' };

export default async function EventsPage() {
  const events = await getEvents();
  const eventsLd = events.map((ev) => ({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: ev.title,
    startDate: ev.date,
    location: { '@type': 'Place', name: ev.location },
    organizer: { '@type': 'CollegeOrUniversity', name: 'ICOF Global University', url: 'https://iguc.net' },
  }));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventsLd) }} />
      <PageBanner title="Events" image="/images/grand-ceremony.jpg" />
      <Section>
        <SectionHeading eyebrow="Mark Your Calendar">Upcoming events</SectionHeading>
        <div className="mx-auto max-w-4xl space-y-6">
          {events.map((ev) => (
            <article
              key={ev.slug}
              className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-brand-sand/70 transition duration-500 hover:-translate-y-1 hover:shadow-lift-lg hover:ring-brand-gold sm:flex-row"
            >
              <div className="relative h-48 sm:h-auto sm:w-64 sm:shrink-0">
                <Image src={ev.image} alt={ev.title} fill className="object-cover" />
              </div>
              <div className="flex items-center gap-5 p-6">
                <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand-purple text-white transition duration-500 group-hover:bg-brand-gold group-hover:text-brand-purple group-hover:shadow-gold">
                  <span className="font-heading text-2xl font-bold text-brand-gold">
                    {new Date(ev.date).getDate()}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-widest">
                    {new Date(ev.date).toLocaleDateString('en-GB', { month: 'short' })} {new Date(ev.date).getFullYear()}
                  </span>
                </div>
                <div>
                <h3 className="mt-1 font-heading text-xl font-semibold text-brand-purple">{ev.title}</h3>
                <p className="mt-2 text-sm text-brand-muted">{ev.summary}</p>
                <p className="mt-3 text-sm font-medium text-brand-purple"><IconCampus className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {ev.location}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Section>
      <Cta />
    </>
  );
}
