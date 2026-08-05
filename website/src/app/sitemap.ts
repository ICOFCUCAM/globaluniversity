import type { MetadataRoute } from 'next';
import { site, programs } from '@/content/site';
import { contentPages, degreeLevels } from '@/content/pages';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    '',
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
    '/verify',
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
