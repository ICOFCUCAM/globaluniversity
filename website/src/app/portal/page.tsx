'use client';

import dynamic from 'next/dynamic';

// The portal is a full client-side application (auth, live data, charts);
// rendering it on the server would serve stale UI, so it loads client-only.
const PortalApp = dynamic(() => import('@/components/PortalApp'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[60vh] items-center justify-center text-brand-muted">
      Loading student portal…
    </div>
  ),
});

export default function PortalPage() {
  return <PortalApp />;
}
