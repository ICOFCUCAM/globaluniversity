// ---------------------------------------------------------------------------
// BEGINNING A CONNECTION.
//
// GET ?platform=…&scope=university|personal  -> 302 to the provider
//
// The scope decides which capability is required and, later, who owns the row.
// It travels inside the SIGNED state rather than as a query parameter on the
// callback, because a parameter the provider hands back is a parameter an
// attacker can choose — and the choice here is between the University's own
// account and a named person's.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';
import { PLATFORMS, type Platform } from '@/lib/social';
import { appFor, authorizeUrl, signState } from '@/lib/socialOAuth';
import { secretStoreReady, SECRET_STORE_MISSING } from '@/lib/secretStore';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const platform = url.searchParams.get('platform') as Platform | null;
  const scope = url.searchParams.get('scope') === 'university' ? 'university' : 'personal';

  const g = await guard(
    request,
    scope === 'university' ? 'connect-university-social' : 'connect-own-social',
  );
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: scope === 'university'
        ? 'Connecting a University account is held by the Superadministrator alone.'
        : undefined,
    }, { status: g.status });
  }

  if (!platform || !PLATFORMS.includes(platform)) {
    return NextResponse.json({ ok: false, error: 'bad-platform' }, { status: 400 });
  }

  // REFUSED BEFORE THE USER LEAVES THE SITE. Sending somebody through a
  // provider's consent screen and only then discovering the tokens cannot be
  // stored wastes their time and leaves a granted permission this system never
  // uses — which is worse than not asking.
  if (!secretStoreReady()) {
    return NextResponse.json({ ok: false, error: 'no-secret-store', detail: SECRET_STORE_MISSING }, { status: 503 });
  }

  const app = appFor(platform);
  if (!app) {
    return NextResponse.json({
      ok: false,
      error: 'not-configured',
      detail: `${platform} has no application registered on this deployment. See docs/SOCIAL-CONNECTIONS.md.`,
    }, { status: 503 });
  }

  if (!app.redirectUri) {
    return NextResponse.json({
      ok: false,
      error: 'no-redirect',
      detail:
        'No redirect address is configured, so the provider has nowhere to send the '
        + 'administrator back to. Set SOCIAL_REDIRECT_URI (or the platform-specific one) to '
        + `${url.origin}/api/social/oauth/callback and register the same address with the provider.`,
    }, { status: 503 });
  }

  const state = signState({
    platform,
    scope,
    // FROM THE TOKEN. This is the field the callback uses as owner_id, and the
    // whole reason state is signed.
    actorId: g.caller.id,
    issuedAt: Date.now(),
  });

  return NextResponse.redirect(authorizeUrl(app, state));
}
