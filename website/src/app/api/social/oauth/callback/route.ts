// ---------------------------------------------------------------------------
// COMPLETING A CONNECTION.
//
// GET ?code=…&state=…  -> stores the tokens, writes the account, returns to the portal
//
// ---------------------------------------------------------------------------
// EVERY FIELD THAT MATTERS COMES FROM THE SIGNED STATE
// ---------------------------------------------------------------------------
//
// Not from a query parameter, and not from the caller's current session. The
// state was signed when the flow began and says which platform, which scope,
// and WHO started it. That last one becomes `owner_id` on a personal
// connection, and it is the difference between an administrator connecting
// their own account and an attacker connecting theirs to somebody else's name.
//
// The signature is verified before any field is read.
//
// ---------------------------------------------------------------------------
// THE TOKEN NEVER TOUCHES social_accounts
// ---------------------------------------------------------------------------
//
// It is sealed into secret_store and the account row gets a reference. That was
// the promise migration 013 made when it named the column `token_ref`, and this
// is the first code with a real token in its hands, so this is where the
// promise is either kept or quietly broken.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/adminAuth';
import { appFor, exchangeCode, readState } from '@/lib/socialOAuth';
import { putTokens, secretStoreReady } from '@/lib/secretStore';

export const runtime = 'nodejs';

/** Back to the portal, with something the screen can show. */
function back(request: Request, params: Record<string, string>) {
  const url = new URL('/portal', new URL(request.url).origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.hash = 'connected-accounts';
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const rawState = url.searchParams.get('state');

  // The provider's own refusal — the administrator declined, or the app is not
  // approved for a scope. Carried through rather than turned into a generic
  // failure, because it is usually the actual answer.
  const providerError = url.searchParams.get('error_description') ?? url.searchParams.get('error');
  if (providerError) {
    return back(request, { social: 'failed', detail: providerError.slice(0, 300) });
  }

  if (!code || !rawState) {
    return back(request, { social: 'failed', detail: 'The provider returned no authorisation code.' });
  }

  const { state, reason } = readState(rawState);
  if (!state) {
    return back(request, { social: 'failed', detail: reason ?? 'The connection could not be verified.' });
  }

  const admin = adminClient();
  if (!admin) return back(request, { social: 'failed', detail: 'The server is not configured.' });

  if (!secretStoreReady()) {
    return back(request, {
      social: 'failed',
      detail: 'SECRET_STORE_KEY is not set, so the token cannot be stored. Nothing was connected.',
    });
  }

  const app = appFor(state.platform);
  if (!app) {
    return back(request, { social: 'failed', detail: `${state.platform} is no longer configured.` });
  }

  let tokens;
  try {
    tokens = await exchangeCode(app, state.platform, code);
  } catch (e) {
    return back(request, {
      social: 'failed',
      detail: e instanceof Error ? e.message.slice(0, 300) : 'The token exchange failed.',
    });
  }

  // -------------------------------------------------------------------------
  // WHO THE ACCOUNT BELONGS TO.
  //
  // From the signed state. A personal connection is owned by whoever STARTED
  // the flow; a university one is owned by nobody, which is what makes it
  // usable by every administrator without any of them holding its credentials.
  // -------------------------------------------------------------------------
  const ownerId = state.scope === 'personal' ? state.actorId : null;

  // A handle the University can recognise. Providers differ wildly in how they
  // report this and several need a second call; a placeholder that names the
  // platform and the scope is honest until that call is written, and is better
  // than an empty row nobody can identify in a list.
  const handle = String(
    (tokens.raw as Record<string, any>).screen_name
    ?? (tokens.raw as Record<string, any>).username
    ?? `${state.platform}:${state.scope}`,
  );

  const { data: account, error } = await admin
    .from('social_accounts')
    .upsert({
      scope: state.scope,
      owner_id: ownerId,
      platform: state.platform,
      handle,
      status: 'connected',
      scopes: tokens.scopes,
      token_expires_at: tokens.expiresAt,
      connected_by: state.actorId,
      connected_at: new Date().toISOString(),
      revoked_at: null,
      last_error: null,
    }, { onConflict: 'scope,owner_id,platform,external_id' })
    .select('id')
    .single();

  if (error || !account) {
    return back(request, {
      social: 'failed',
      detail: `The account could not be recorded: ${error?.message ?? 'unknown'}`,
    });
  }

  try {
    // SEALED, THEN REFERENCED. In that order: a row pointing at a token that
    // was never stored would appear connected and fail at publication.
    const ref = await putTokens(admin as never, String(account.id), {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
    });
    await admin.from('social_accounts').update({ token_ref: ref }).eq('id', account.id);
  } catch (e) {
    // The account exists but has no usable token. Marked, rather than left
    // looking connected — the composer reads `status` and would otherwise offer
    // it as a destination.
    await admin.from('social_accounts').update({
      status: 'error',
      last_error: e instanceof Error ? e.message : 'The token could not be stored.',
    }).eq('id', account.id);

    return back(request, {
      social: 'failed',
      detail: e instanceof Error ? e.message.slice(0, 300) : 'The token could not be stored.',
    });
  }

  await admin.from('audit_logs').insert({
    action: 'social.connected',
    entity_type: 'social_account',
    entity_id: String(account.id),
    performed_by: state.actorId,
    details: { platform: state.platform, scope: state.scope, handle },
  });

  return back(request, {
    social: 'connected',
    detail: `${handle} is connected. Nothing has been published — the connection is ready to use.`,
  });
}
