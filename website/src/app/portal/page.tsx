'use client';

import dynamic from 'next/dynamic';

// The portal is a full client-side application (auth, live data, charts);
// rendering it on the server would serve stale UI, so it loads client-only.
//
// The fallback matters more than it looks. This bundle is large, and on a slow
// connection the previous one — the words "Loading student portal…" in grey,
// centred in an otherwise empty page — left a member of staff looking at what
// appears to be a broken site for several seconds. A shell in the shape of what
// is coming reads as loading rather than as failure, and the real interface
// then replaces it in place instead of the whole layout snapping into being.
const PortalApp = dynamic(() => import('@/components/PortalApp'), {
  ssr: false,
  loading: () => (
    <div
      className="flex min-h-screen bg-[#f7f5f0] dark:bg-[#17131d]"
      role="status"
      aria-label="Loading the portal"
    >
      {/* The rail */}
      <div className="hidden w-64 flex-shrink-0 bg-[#241a30] lg:block">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
          <div className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
            <div className="h-2 w-32 animate-pulse rounded bg-white/[0.06]" />
          </div>
        </div>
        <div className="space-y-2 p-3">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-lg bg-white/[0.06]" />
          ))}
        </div>
      </div>

      {/* The workspace */}
      <div className="min-w-0 flex-1">
        <div className="h-16 border-b border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1b1723]" />
        <div className="space-y-6 p-4 sm:p-6">
          <div className="h-32 animate-pulse rounded-2xl bg-[#ece7de] dark:bg-[#241f2c]" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-[#ece7de] dark:bg-[#241f2c]" />
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">Loading the university portal…</span>
    </div>
  ),
});

export default function PortalPage() {
  return <PortalApp />;
}
