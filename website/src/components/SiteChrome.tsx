'use client';

// ---------------------------------------------------------------------------
// The public site's chrome — masthead, footer, WhatsApp button, reading
// progress bar — suppressed on the routes that are applications rather than
// pages.
//
// The portal is a full-screen management system with its own fixed sidebar and
// its own top bar. Rendering it inside the marketing header meant two headers
// stacked on one screen, the sidebar starting below a bar it knew nothing about
// and running off the bottom, and a floating WhatsApp button over the
// Registrar's desk. It read as a website with an admin page bolted on, which is
// the opposite of what a university management system should look like.
//
// Kept as a wrapper rather than a route group so the marketing pages are
// untouched: they still render exactly as before, and only the listed prefixes
// opt out.
// ---------------------------------------------------------------------------

import { usePathname } from 'next/navigation';

/** Routes that own the whole viewport. */
const BARE_ROUTES = ['/portal'];

export function isBareRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return BARE_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isBareRoute(pathname)) return null;
  return <>{children}</>;
}

/**
 * The <main> wrapper. Marketing pages keep the default flow; a bare route gets
 * the full viewport with no inherited spacing, so the portal's own layout can
 * assume it starts at the top of the window.
 */
export function SiteMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = isBareRoute(pathname);
  return (
    <main id="main" className={bare ? 'min-h-screen' : undefined}>
      {children}
    </main>
  );
}
