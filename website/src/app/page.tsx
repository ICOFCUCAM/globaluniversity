import Image from 'next/image';
import Link from 'next/link';
import { Section, SectionHeading } from '@/components/Section';
import Cta from '@/components/Cta';
import { getHomePage, getPrograms } from '@/lib/data';

const quickIcons: Record<string, string> = {
  calendar: '📅',
  book: '📚',
  award: '🎓',
  laptop: '💻',
  library: '🏛️',
  mail: '✉️',
};

export default async function HomePage() {
  const { hero, quickLinks, stats, about, events, news } = await getHomePage();
  const programs = (await getPrograms()).slice(0, 4);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-purple text-white">
        <Image
          src={hero.image}
          alt="ICOF Global University campus"
          fill
          priority
          className="object-cover opacity-25"
        />
        <div className="relative mx-auto max-w-4xl px-4 py-28 text-center sm:py-36">
          <h1 className="font-heading text-4xl font-extrabold uppercase leading-tight tracking-wide text-brand-gold sm:text-6xl">
            {hero.title}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-white/90">{hero.text}</p>
          <Link
            href={hero.cta.href}
            className="mt-10 inline-block rounded-full bg-brand-gold px-8 py-3 font-heading font-semibold text-brand-purple transition hover:bg-brand-gold-deep"
          >
            🎓 {hero.cta.label}
          </Link>
        </div>
      </section>

      {/* Quick links strip */}
      <div className="border-b-4 border-brand-gold bg-white shadow-sm">
        <div className="mx-auto grid max-w-6xl grid-cols-3 divide-x divide-brand-cream sm:grid-cols-6">
          {quickLinks.map((q) => (
            <Link
              key={q.label}
              href={q.href}
              className="flex flex-col items-center gap-2 py-6 text-center transition hover:bg-brand-cream"
            >
              <span className="text-2xl">{quickIcons[q.icon] ?? '•'}</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-brand-purple">
                {q.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* About */}
      <Section>
        <SectionHeading>About Us</SectionHeading>
        <p className="mx-auto mb-10 max-w-3xl text-center text-brand-muted">{about.intro}</p>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="space-y-3">
            {about.items.map((item) => (
              <details
                key={item.title}
                className="group rounded-lg border border-brand-sand bg-white px-5 py-4 open:shadow-md"
              >
                <summary className="cursor-pointer list-none font-heading font-semibold text-brand-purple">
                  {item.title}
                  <span className="float-right text-brand-gold-deep group-open:rotate-180">⌄</span>
                </summary>
                <p className="mt-3 text-sm text-brand-muted">{item.body}</p>
              </details>
            ))}
          </div>
          <div className="relative h-80 overflow-hidden rounded-xl shadow-lg lg:h-96">
            <Image src={about.image} alt="ICOF Global University hall" fill className="object-cover" />
          </div>
        </div>
      </Section>

      {/* Events */}
      <Section className="bg-white">
        <SectionHeading>Events</SectionHeading>
        <div className="grid gap-8 md:grid-cols-3">
          {events.map((ev) => (
            <article key={ev.slug} className="overflow-hidden rounded-xl bg-brand-cream shadow-sm transition hover:shadow-lg">
              <div className="relative h-44">
                <Image src={ev.image} alt={ev.title} fill className="object-cover" />
                <span className="absolute left-3 top-3 rounded bg-brand-gold px-2 py-1 text-xs font-bold text-brand-purple">
                  {new Date(ev.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </span>
              </div>
              <div className="p-5">
                <h3 className="font-heading font-semibold text-brand-purple">{ev.title}</h3>
                <p className="mt-2 text-xs text-brand-muted">
                  {new Date(ev.date).toLocaleDateString('en-GB', { dateStyle: 'long' })} · {ev.location}
                </p>
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* Stats */}
      <section className="relative bg-brand-purple py-14 text-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 text-center md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="font-heading text-4xl font-extrabold text-brand-gold">{s.value}</p>
              <p className="mt-2 text-sm font-medium text-white/85">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Programs */}
      <Section>
        <SectionHeading>Our Programs</SectionHeading>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {programs.map((p) => (
            <Link
              key={p.slug}
              href={`/programs/${p.slug}`}
              className="group overflow-hidden rounded-xl bg-white shadow-sm transition hover:shadow-lg"
            >
              <div className="relative h-40">
                <Image src={p.image} alt={p.title} fill className="object-cover transition group-hover:scale-105" />
              </div>
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold-deep">{p.level}</p>
                <h3 className="mt-1 font-heading font-semibold text-brand-purple">{p.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-brand-muted">{p.summary}</p>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link
            href="/programs"
            className="inline-block rounded-full border-2 border-brand-purple px-8 py-3 font-heading font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white"
          >
            View Full Catalog
          </Link>
        </div>
      </Section>

      {/* News */}
      <Section className="bg-white">
        <SectionHeading>What&apos;s Happening</SectionHeading>
        <div className="grid gap-8 md:grid-cols-3">
          {news.map((n) => (
            <article key={n.slug} className="overflow-hidden rounded-xl bg-brand-cream shadow-sm transition hover:shadow-lg">
              <div className="relative h-44">
                <Image src={n.image} alt={n.title} fill className="object-cover" />
              </div>
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold-deep">{n.category}</p>
                <h3 className="mt-1 font-heading font-semibold text-brand-purple">{n.title}</h3>
                <p className="mt-2 text-sm text-brand-muted">{n.excerpt}</p>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Cta />
    </>
  );
}
