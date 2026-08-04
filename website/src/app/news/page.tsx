import Image from 'next/image';
import { Section, SectionHeading } from '@/components/Section';
import PageBanner from '@/components/PageBanner';
import Cta from '@/components/Cta';
import Reveal from '@/components/Reveal';
import { getNews, getEvents } from '@/lib/data';

export const metadata = {
  title: 'News & Announcements',
  description: 'News, initiatives and announcements from ICOF Global University.',
};

export default async function NewsPage() {
  const news = await getNews();
  const events = await getEvents();

  return (
    <>
      <PageBanner
        title="News & Announcements"
        subtitle="Initiatives, milestones and important dates from across the university."
        image="/images/wp/g-celebration.jpg"
      />
      <Section>
        <SectionHeading eyebrow="University News">Latest from IGUC</SectionHeading>
        <div className="grid gap-8 md:grid-cols-3">
          {news.map((n, i) => (
            <Reveal key={n.slug} delay={i * 100}>
              <article className="h-full overflow-hidden rounded-2xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <div className="relative h-44">
                  <Image src={n.image} alt={n.title} fill className="object-cover" sizes="(min-width:768px) 33vw, 100vw" />
                </div>
                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold-deep">{n.category}</p>
                  <h2 className="mt-1 font-heading text-lg font-semibold text-brand-purple">{n.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-brand-muted">{n.excerpt}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </Section>
      <Section className="bg-white">
        <SectionHeading eyebrow="Important Dates">Upcoming events</SectionHeading>
        <div className="mx-auto max-w-2xl space-y-4">
          {events.map((ev) => (
            <div key={ev.slug} className="flex items-center gap-5 rounded-2xl border border-brand-sand bg-brand-cream p-5">
              <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-purple text-white">
                <span className="font-heading text-xl font-bold text-brand-gold">{new Date(ev.date).getDate()}</span>
                <span className="text-[9px] font-semibold uppercase tracking-widest">
                  {new Date(ev.date).toLocaleDateString('en-GB', { month: 'short' })}
                </span>
              </div>
              <div>
                <h3 className="font-heading font-semibold text-brand-purple">{ev.title}</h3>
                <p className="text-xs text-brand-muted">{ev.location}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Cta />
    </>
  );
}
