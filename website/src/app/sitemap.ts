import type { MetadataRoute } from 'next';
import { site, programs } from '@/content/site';
import { contentPages, degreeLevels } from '@/content/pages';
import { facultyList } from '@/content/faculties';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    '',
    '/welcome',
    '/black-liberation-theology',
    '/bachelor-of-theology',
    '/master-of-theology',
    '/roots-of-faith',
    '/about',
    '/programs',
    '/admissions',
    '/apply',
    '/faculty',
    '/campus-life',
    '/events',
    '/tuition',
    '/contact',
    '/portal',
    '/news',
    '/courses',
    '/verify',
    '/documents',
    '/academic-catalog',
    '/academic-regulations',
    '/student-handbook',
    '/prospectus',
    '/admissions-portal',
    '/graduate-school-handbook',
    '/fr',
    '/fr/a-propos',
    '/fr/admission',
    '/fr/programmes',
    '/fr/contact',
  ];
  return [
    ...staticRoutes.map((path) => ({
      url: `${site.url}${path}`,
      changeFrequency: 'weekly' as const,
      priority: path === '' ? 1 : 0.8,
    })),
    ...programs.map((p) => ({
      url: `${site.url}/programs/${p.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    ...facultyList.map((f) => ({
      url: `${site.url}/faculty/${f.slug}/handbook`,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    ...facultyList.map((f) => ({
      url: `${site.url}/faculty/${f.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    ...degreeLevels.map((d) => ({
      url: `${site.url}/degrees/${d.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    ...contentPages.map((c) => ({
      url: `${site.url}/${c.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
