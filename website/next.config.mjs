/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // The recovered WordPress images are served from /public; remote patterns
    // allow pulling media straight from the live site during content migration.
    remotePatterns: [
      { protocol: 'https', hostname: 'iguc.net' },
      { protocol: 'https', hostname: 'www.iguc.net' },
    ],
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
