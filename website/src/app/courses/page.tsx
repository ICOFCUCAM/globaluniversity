import type { Metadata } from 'next';
import PageBanner from '@/components/PageBanner';
import { Section } from '@/components/Section';
import Cta from '@/components/Cta';
import CourseCatalogue from '@/components/CourseCatalogue';
import { courses } from '@/content/courses';

export const metadata: Metadata = {
  title: 'Course Catalogue',
  description:
    'Search every course at ICOF Global University — theology, education, engineering, technology, business and professional development, on campus and online.',
};

export default function CoursesPage() {
  const onlineCount = courses.filter((c) => c.online).length;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'ICOF Global University Course Catalogue',
    numberOfItems: courses.length,
    itemListElement: courses.slice(0, 30).map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Course',
        name: c.title,
        description: c.summary,
        provider: { '@type': 'CollegeOrUniversity', name: 'ICOF Global University', url: 'https://iguc.net' },
      },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <PageBanner
        title="Course Catalogue"
        subtitle={`${courses.length} courses across five faculties — ${onlineCount} available online, worldwide.`}
        image="/images/wp/g-students.jpg"
      />
      <Section>
        <CourseCatalogue />
      </Section>
      <Cta />
    </>
  );
}
