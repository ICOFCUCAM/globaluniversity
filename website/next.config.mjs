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
