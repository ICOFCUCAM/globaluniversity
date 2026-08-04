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
};

export default nextConfig;
