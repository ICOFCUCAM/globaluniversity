// ---------------------------------------------------------------------------
// CONNECTING AND DISCONNECTING A SOCIAL ACCOUNT.
//
// GET                                  -> what is connected, and what this
//                                         deployment can connect at all
// POST { scope, platform, ... }        -> begin a connection
// POST { accountId, action:'revoke' }  -> disconnect
//
// ---------------------------------------------------------------------------
// TWO SCOPES, TWO DIFFERENT PEOPLE, AND THE ROUTE KEEPS THEM APART
// ---------------------------------------------------------------------------
//
//   scope 'university' — the institution's own accounts. Connected once by the
//   Superadministrator, and then usable by every administrator without any of
//   them ever holding the credentials. Requires 'connect-university-social',
//   which is a SYSTEM capability and is held by the Superadministrator alone.
//
//   scope 'personal' — an administrator's own accounts. Requires
//   'connect-own-social', which every administrator holds, and the row is
//   written with owner_id = the CALLER. Never a person named in the request.
//
// THE SUPERADMINISTRATOR CANNOT CONNECT SOMEBODY ELSE'S PERSONAL ACCOUNT, and
// this route has no parameter with which to try. There is no `ownerId` in the
// request body. Adding one would be the whole vulnerability, in one line.
//
// Nor may anyone revoke a connection that is not theirs: revoke checks
// ownership against the caller, and the RLS policy on social_accounts checks it
// again for anything reaching the table without this route.
//
// ---------------------------------------------------------------------------
// WHY 'CONNECT' DOES NOT YET COMPLETE
// ---------------------------------------------------------------------------
//
// An OAuth flow needs an application registered with each platform by the
// university, under its own name. This deployment has none, so the route
// REFUSES rather than writing a row that claims a connection it does not have.
//
// A row with status 'connected' and no token would appear in the composer as a
// destination, be resolved as a target, and fail at publication — after the
// administrator believed the announcement had gone out. Refusing at the point
// of connection puts the failure where somebody can act on it, and the message
// names the exact environment variables that are missing.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';
import { PLATFORMS, type Platform } from '@/lib/social';
import { configuredProviders, explainMissing, PROVIDER_REQUIREMENTS } from '@/lib/socialProviders';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  // The lowest capability that has any business on this screen. A person who
  // may connect their own account may see which platforms are connectable.
  const g = await guard(request, 'connect-own-social');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin, caller } = g;

  const { data, error } = await admin
    .from('social_accounts')
    .select('id, scope, owner_id, platform, handle, display_name, status, connected_at, token_expires_at, last_error');

  if (error) {
    return NextResponse.json({
      ok: false,
      error: 'unreadable',
      detail: error.message.includes('does not exist')
        ? 'Run docs/migrations/013_social_and_credential_authority.sql.'
        : error.message,
    }, { status: 500 });
  }

  const rows = (data ?? []) as Array<Record<string, any>>;

  // WHAT THE CALLER MAY SEE. Every university account — those are the
  // institution's, and knowing the University has a LinkedIn page is not a
  // secret. Of the personal ones, THEIRS ONLY. Not a count of other people's,
  // not their handles, not the fact that they exist.
  const university = rows.filter((r) => r.scope === 'university');
  const mine = rows.filter((r) => r.scope === 'personal' && r.owner_id === caller.id);

  const configured = configuredProviders();

  return NextResponse.json({
    ok: true,
    university: university.map(publicShape),
    mine: mine.map(publicShape),
    connectable: configured,
    requirements: PLATFORMS.map((p) => ({
      platform: p,
      configured: configured.includes(p),
      app: PROVIDER_REQUIREMENTS[p].app,
      missing: configured.includes(p) ? [] : PROVIDER_REQUIREMENTS[p].env,
      note: PROVIDER_REQUIREMENTS[p].note,
    })),
  });
}

/** Never token_ref, on any path, to any caller. */
function publicShape(r: Record<string, any>) {
  return {
    id: String(r.id),
    scope: r.scope,
    platform: r.platform,
    handle: r.handle,
    displayName: r.display_name ?? null,
    status: r.status,
    connectedAt: r.connected_at,
    tokenExpiresAt: r.token_expires_at ?? null,
    lastError: r.last_error ?? null,
  };
}

interface Body {
  action?: 'connect' | 'revoke';
  accountId?: string;
  scope?: 'university' | 'personal';
  platform?: Platform;
}

export async function POST(request: Request) {
  let input: Body;
  try {
    input = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  // -------------------------------------------------------------------------
  // REVOKE
  // -------------------------------------------------------------------------
  if (input.action === 'revoke') {
    const g = await guard(request, 'connect-own-social');
    if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
    const { admin, caller } = g;

    if (!input.accountId) {
      return NextResponse.json({ ok: false, error: 'no-account' }, { status: 400 });
    }

    const { data: account } = await admin
      .from('social_accounts')
      .select('id, scope, owner_id, handle')
      .eq('id', input.accountId)
      .maybeSingle();

    if (!account) return NextResponse.json({ ok: false, error: 'not-found' }, { status: 404 });

    // YOUR OWN, OR THE UNIVERSITY'S IF YOU HOLD THAT CAPABILITY. There is no
    // third case: a personal account belonging to somebody else cannot be
    // revoked by anyone, including the Superadministrator. Disconnecting a
    // colleague's private account is not an institutional power.
    if (account.scope === 'personal') {
      if (account.owner_id !== caller.id) {
        return NextResponse.json({
          ok: false,
          error: 'not-yours',
          detail: 'That connection belongs to another administrator. Only they can disconnect it.',
        }, { status: 403 });
      }
    } else {
      const uni = await guard(request, 'connect-university-social');
      if (!uni.ok) {
        return NextResponse.json({
          ok: false,
          error: 'not-permitted',
          detail: 'Disconnecting a University account is held by the Superadministrator.',
        }, { status: 403 });
      }
    }

    const { error } = await admin
      .from('social_accounts')
      .update({ status: 'revoked', revoked_at: new Date().toISOString(), token_ref: null })
      .eq('id', account.id);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // THE ROW SURVIVES. Deleting it would take the publication history with it
    // — every past post that went through this account points at this row —
    // and a communications record with holes in it is worse than one that says
    // "this account was disconnected in August".
    await admin.from('audit_logs').insert({
      actor_id: caller.id,
      action: 'social.disconnected',
      detail: { account_id: account.id, scope: account.scope, handle: account.handle },
    }).select().maybeSingle();

    return NextResponse.json({ ok: true, message: `${account.handle} disconnected.` });
  }

  // -------------------------------------------------------------------------
  // CONNECT
  // -------------------------------------------------------------------------
  const scope = input.scope ?? 'personal';
  const capability = scope === 'university' ? 'connect-university-social' : 'connect-own-social';

  const g = await guard(request, capability);
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: scope === 'university'
        ? 'Connecting a University account is held by the Superadministrator alone. '
          + 'Your own accounts are connected in your settings.'
        : undefined,
    }, { status: g.status });
  }

  const platform = input.platform;
  if (!platform || !PLATFORMS.includes(platform)) {
    return NextResponse.json({ ok: false, error: 'bad-platform' }, { status: 400 });
  }

  // The refusal that keeps the composer honest. See the header.
  const missing = explainMissing(platform);
  if (missing) {
    return NextResponse.json({
      ok: false,
      error: 'provider-not-configured',
      detail: missing,
      requirement: PROVIDER_REQUIREMENTS[platform],
    }, { status: 503 });
  }

  // When the applications exist, this is where the OAuth authorisation URL is
  // built and returned for the browser to follow. The callback writes the row
  // — with owner_id = the caller for a personal scope, and null for a
  // university one — and puts the tokens in the secret store, never here.
  return NextResponse.json({
    ok: false,
    error: 'oauth-not-implemented',
    detail:
      `${platform} is configured, but the authorisation callback has not been built yet. `
      + 'See docs/SOCIAL-CONNECTIONS.md.',
  }, { status: 501 });
}
