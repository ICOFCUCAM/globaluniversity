import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PageBanner from '@/components/PageBanner';
import { Section } from '@/components/Section';
import Reveal from '@/components/Reveal';
import KineticText from '@/components/KineticText';
import Cta from '@/components/Cta';
import { contentPages, getContentPage } from '@/content/pages';

export const dynamicParams = false;

export function generateStaticParams() {
  return contentPages.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const page = getContentPage(params.slug);
  return {
    title: page ? `${page.title} — ICOF Global University` : 'ICOF Global University',
    description: page?.subtitle,
  };
}

export default function ContentPage({ params }: { params: { slug: string } }) {
  const page = getContentPage(params.slug);
  if (!page) notFound();

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://iguc.net' },
      { '@type': 'ListItem', position: 2, name: page.title, item: `https://iguc.net/${page.slug}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <PageBanner title={page.title} subtitle={page.subtitle} image={page.image} />
      <Section>
        {/* Sections are numbered and separated by rules rather than by
            whitespace alone, so a long content page reads as an argued
            document instead of a run of paragraphs. */}
        <div className="mx-auto max-w-3xl">
          {page.sections.map((s, i) => (
            <Reveal key={s.heading ?? i} delay={i * 50}>
              <article className="border-t border-brand-sand py-9 first:border-t-0 first:pt-0">
                {s.heading && (
                  <div className="flex items-baseline gap-4">
                    <span
                      aria-hidden="true"
                      className="font-heading text-sm font-bold tabular text-brand-gold-ink"
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <KineticText className="font-heading text-display-sm font-bold text-brand-purple [text-wrap:balance]">
                      {s.heading}
                    </KineticText>
                  </div>
                )}
                {s.paragraphs?.map((p) => (
                  <p key={p.slice(0, 40)} className="mt-5 text-[17px] leading-[1.75] text-brand-muted">
                    {p}
                  </p>
                ))}
                {s.list && (
                  <ul className="mt-6 space-y-3">
                    {s.list.map((item) => (
                      <li key={item} className="flex gap-3.5 text-[15px] leading-relaxed text-brand-muted">
                        <span
                          aria-hidden="true"
                          className="mt-[7px] h-1.5 w-1.5 shrink-0 rotate-45 rounded-[1px] bg-brand-gold-deep"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </Reveal>
          ))}
        </div>
      </Section>
      <Cta />
    </>
  );
}
