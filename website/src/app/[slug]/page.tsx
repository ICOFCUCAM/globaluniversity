import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PageBanner from '@/components/PageBanner';
import { Section } from '@/components/Section';
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

  return (
    <>
      <PageBanner title={page.title} subtitle={page.subtitle} image={page.image} />
      <Section>
        <div className="mx-auto max-w-3xl space-y-10">
          {page.sections.map((s, i) => (
            <div key={s.heading ?? i}>
              {s.heading && (
                <h2 className="font-heading text-2xl font-bold text-brand-purple">{s.heading}</h2>
              )}
              {s.paragraphs?.map((p) => (
                <p key={p.slice(0, 40)} className="mt-4 leading-relaxed text-brand-muted">
                  {p}
                </p>
              ))}
              {s.list && (
                <ul className="mt-4 space-y-2">
                  {s.list.map((item) => (
                    <li key={item} className="flex gap-3 text-brand-muted">
                      <span className="mt-1 text-brand-gold-deep">◆</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Section>
      <Cta />
    </>
  );
}
