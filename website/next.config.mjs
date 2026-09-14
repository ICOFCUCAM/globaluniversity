/** @type {import('next').NextConfig} */
const nextConfig = {
  // -------------------------------------------------------------------------
  // THE LETTER COULD NOT BE MADE INTO A PDF ON VERCEL.
  //
  // "The input directory /vercel/path0/website/node_modules/@sparticuz/
  // chromium/bin does not exist."
  //
  // Chromium is not a library. It is a 67MB brotli-compressed browser in
  // `@sparticuz/chromium/bin`, which the package unpacks to /tmp at runtime
  // and then launches. Webpack does not know that: it saw an `import`, bundled
  // the JavaScript into the route, and left the browser behind. The code then
  // looked for the browser beside itself and found nothing — so every PDF fell
  // back to HTML, which is what the appointee was being shown.
  //
  // TWO THINGS ARE NEEDED, AND ONE ALONE DOES NOTHING.
  //
  //   serverComponentsExternalPackages  stops webpack relocating the package,
  //                                     so `require` resolves to the real one
  //                                     in node_modules at runtime.
  //   outputFileTracingIncludes         puts the .br files in the deployment.
  //                                     Tracing follows `require` calls; the
  //                                     browser is read by a computed path, so
  //                                     nothing points at it and it is dropped.
  //
  // MEASURED, NOT REASONED ABOUT. Before this, the route's `.nft.json` listed
  // 373 files and NOT ONE of them was from @sparticuz. After it, the four
  // archives in bin/ are there. `scripts/check-pdf-tracing.mjs` reads that
  // manifest after every build and fails if they go missing again — this is
  // not the kind of breakage that shows up until somebody downloads a letter.
  // -------------------------------------------------------------------------
  experimental: {
    serverComponentsExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
    // The key is the route, relative to the app directory. Both routes that
    // make a PDF are named: the officer's copy and the appointee's own.
    outputFileTracingIncludes: {
      '/api/appointments/letter': ['./node_modules/@sparticuz/chromium/bin/**'],
      '/api/appointments/accept/letter': ['./node_modules/@sparticuz/chromium/bin/**'],
    },
  },
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
      // DOUALA BECAME THE SCHOOL OF MINISTRY, so its faculty page moved from
      // /faculty/theology-douala. The slug is part of a URL somebody may have
      // bookmarked or linked, and a renamed school is not a reason to break it.
      { source: '/faculty/theology-douala', destination: '/faculty/ministry-douala', permanent: true },
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
