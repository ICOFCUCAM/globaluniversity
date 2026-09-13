// ---------------------------------------------------------------------------
// BEGINNING A CONNECTION.
//
// POST { platform, scope }  -> { ok: true, url } — the address to send the
//                              administrator to. The SCREEN then navigates.
//
// ---------------------------------------------------------------------------
// WHY THIS IS NOT A LINK, AND WAS, AND COULD NOT WORK
// ---------------------------------------------------------------------------
//
// This route used to answer GET and redirect. The Settings screen started a
// connection with `window.location.href = '…/oauth/start?platform=facebook'`,
// with a comment explaining that the provider's consent screen is a page the
// administrator has to read and cannot be shown inside an XHR.
//
// That reasoning is right. The implementation could never have worked: a
// top-level browser navigation carries no `Authorization` header, `guard()`
// reads nothing else, and so the only thing the Vice-Chancellor ever saw on
// clicking "Facebook" was a blank tab reading
//
//     {"ok":false,"error":"no-token"}
//
// which names a missing token and looks like a broken database.
//
// SO THE TWO HALVES ARE SEPARATED. Minting the authorize URL needs to know who
// is asking, so it happens over a fetch that can carry the token. Going to the
// provider does not need to know anything, so it happens as the full-page
// navigation it has to be — to the provider's own address, which is the page
// the original comment was protecting.
//
// It also means every refusal below — no application registered, no signing
// key, no redirect address — arrives back in the screen as a sentence, instead
// of as JSON in a tab the administrator has to press Back out of.
//
// ---------------------------------------------------------------------------
// THE SCOPE IS NOT A QUERY PARAMETER ON THE WAY BACK
// ---------------------------------------------------------------------------
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

/**
 * Opened directly in a browser.
 *
 * ANSWERED, RATHER THAN LEFT TO REFUSE. An address that used to be navigated
 * to is an address that sits in browser histories and in this file's own git
 * history, and somebody will open it. `no-token` is a true answer and a
 * useless one; this says what to do instead.
 */
export async function GET() {
  return NextResponse.json({
    ok: false,
    error: 'not-a-page',
    detail:
      'A social connection is started from Settings → Connected accounts, not by opening this '
      + 'address. Opening it directly cannot prove who you are, so there is nothing this page '
      + 'could safely do.',
  }, { status: 405 });
}

export async function POST(request: Request) {
  const url = new URL(request.url);

  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { /* both fields fall back below */ }

  const platform = (body.platform ?? url.searchParams.get('platform')) as Platform | null;
  const scope = (body.scope ?? url.searchParams.get('scope')) === 'university'
    ? 'university' : 'personal';

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
    return NextResponse.json({
      ok: false,
      error: 'bad-platform',
      detail: `That is not a network this system publishes to. They are: ${PLATFORMS.join(', ')}.`,
    }, { status: 400 });
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
      detail:
        `The University has no ${platform} application registered on this deployment, so there `
        + 'is no consent screen to send you to. Registering one is the Superadministrator’s step '
        + 'and is written down in docs/SOCIAL-CONNECTIONS.md.',
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

  // THE ADDRESS, NOT A REDIRECT. The screen navigates to it, so the consent
  // page is a real page in the administrator's own browser — and the state
  // above was minted knowing who asked, which is the whole reason this is a
  // POST.
  return NextResponse.json({
    ok: true,
    url: authorizeUrl(app, state),
    platform,
    scope,
  });
}
