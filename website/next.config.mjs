/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Serve modern formats and cache optimized variants aggressively.
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // The recovered WordPress images are served from /public; remote patterns
    // allow pulling media straight from the live site during content migration.
    remotePatterns: [
      { protocol: 'https', hostname: 'iguc.net' },
      { protocol: 'https', hostname: 'www.iguc.net' },
    ],
  },
  // Two programme entries used to be umbrellas covering several awards each.
  // The university confirmed the awards are separate, so they were split into
  // one page per award. Both routes were live and are in the sitemap, so they
  // redirect permanently to the award each umbrella was named for rather than
  // starting to 404.
  async redirects() {
    return [
      { source: '/programs/ministry', destination: '/programs/master-of-divinity', permanent: true },
      { source: '/programs/theology', destination: '/programs/doctor-of-philosophy-theology', permanent: true },

      // ONE PROGRAMME, ONE URL.
      //
      // The catalogue added /programmes/<slug> pages. Three of its programmes
      // also have a record in site.ts and so were already served, more fully,
      // at /programs/<slug> — the same degree at two addresses, splitting its
      // search ranking between them and leaving an applicant who found one
      // unaware the other says more. The older, richer page wins.
      //
      // WHY HERE AND NOT IN THE PAGE. A `permanentRedirect()` at the top of the
      // page component does throw NEXT_REDIRECT on this version, and Next
      // serves the page anyway — verified against 14.2.35 in both dev and a
      // production build. A redirect that silently does not redirect is worse
      // than none, because it looks handled. This runs before any rendering.
      //
      // KEEPING THIS LIST HONEST. next.config.mjs cannot import the TypeScript
      // catalogue, so the three slugs are written out. The invariant is checked
      // by src/lib/__tests__/programmeRoutes.test.ts, which fails if a
      // programme is ever served at two URLs without a redirect here.
      { source: '/programmes/diploma-in-theology', destination: '/programs/diploma-in-theology', permanent: true },
      { source: '/programmes/diploma-in-ministry', destination: '/programs/diploma-in-ministry', permanent: true },
      { source: '/programmes/diploma-in-christian-leadership', destination: '/programs/diploma-in-christian-leadership', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ];
  },
};

export default nextConfig;
