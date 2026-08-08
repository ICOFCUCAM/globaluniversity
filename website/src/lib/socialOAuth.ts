// ---------------------------------------------------------------------------
// THE OAUTH HANDSHAKE, PER PLATFORM.
//
// Where a connection is actually made. Everything else in the social pipeline
// has existed since migration 013; this is the piece that turns a configured
// deployment into a working one.
//
// ---------------------------------------------------------------------------
// THE STATE PARAMETER IS NOT DECORATION
// ---------------------------------------------------------------------------
//
// OAuth's `state` exists to stop cross-site request forgery: without it, an
// attacker can send an administrator a link that completes a connection to the
// ATTACKER's account, and the University then publishes to it believing it is
// its own.
//
// So `state` here is signed, carries who started the flow and what scope they
// asked for, and expires. The callback verifies the signature before it
// believes a single field — which matters more than usual, because the fields
// it carries decide whether the resulting row is the UNIVERSITY's account or a
// person's own.
//
// A random string checked against a session would also work and is arguably
// more conventional; it is not used here because this deployment has no
// server-side session store, and a signed value needs none.
// ---------------------------------------------------------------------------

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Platform } from '@/lib/social';

export interface OAuthApp {
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  /** Extra parameters this provider requires on the authorize call. */
  extra?: Record<string, string>;
}

/**
 * The app for one platform, or null when the University has not registered it.
 *
 * READS THE ENVIRONMENT, so it is server-only. The scopes are the ones
 * docs/SOCIAL-CONNECTIONS.md lists, kept here as the single source rather than
 * in prose the code can drift from.
 */
export function appFor(platform: Platform, env: NodeJS.ProcessEnv = process.env): OAuthApp | null {
  const redirect = (fallback: string) => env.SOCIAL_REDIRECT_URI?.trim() || fallback;

  switch (platform) {
    case 'facebook':
    case 'instagram':
    case 'threads': {
      if (!env.META_APP_ID || !env.META_APP_SECRET) return null;
      const scopes = platform === 'facebook'
        ? ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list']
        : platform === 'instagram'
          ? ['instagram_basic', 'instagram_content_publish', 'pages_show_list']
          : ['threads_basic', 'threads_content_publish'];
      return {
        authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
        tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
        clientId: env.META_APP_ID,
        clientSecret: env.META_APP_SECRET,
        redirectUri: redirect(env.META_REDIRECT_URI ?? ''),
        scopes,
      };
    }

    case 'x': {
      if (!env.X_CLIENT_ID || !env.X_CLIENT_SECRET) return null;
      return {
        authorizeUrl: 'https://twitter.com/i/oauth2/authorize',
        tokenUrl: 'https://api.twitter.com/2/oauth2/token',
        clientId: env.X_CLIENT_ID,
        clientSecret: env.X_CLIENT_SECRET,
        redirectUri: redirect(env.X_REDIRECT_URI ?? ''),
        // offline.access is what yields a refresh token. Without it the
        // connection dies in two hours and an administrator reconnects daily
        // until they stop using the system.
        scopes: ['tweet.write', 'tweet.read', 'users.read', 'offline.access'],
        extra: { code_challenge: 'challenge', code_challenge_method: 'plain' },
      };
    }

    case 'linkedin': {
      if (!env.LINKEDIN_CLIENT_ID || !env.LINKEDIN_CLIENT_SECRET) return null;
      return {
        authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
        tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
        clientId: env.LINKEDIN_CLIENT_ID,
        clientSecret: env.LINKEDIN_CLIENT_SECRET,
        redirectUri: redirect(env.LINKEDIN_REDIRECT_URI ?? ''),
        scopes: ['w_member_social', 'w_organization_social', 'r_organization_social'],
      };
    }

    case 'youtube': {
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
      return {
        authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectUri: redirect(env.GOOGLE_REDIRECT_URI ?? ''),
        scopes: ['https://www.googleapis.com/auth/youtube.upload'],
        // Google returns a refresh token ONLY on the first consent unless these
        // are set. Without them a reconnection yields an access token that
        // expires in an hour and nothing to renew it with — a failure that
        // appears weeks later.
        extra: { access_type: 'offline', prompt: 'consent' },
      };
    }

    case 'tiktok': {
      if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) return null;
      return {
        authorizeUrl: 'https://www.tiktok.com/v2/auth/authorize/',
        tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
        clientId: env.TIKTOK_CLIENT_KEY,
        clientSecret: env.TIKTOK_CLIENT_SECRET,
        redirectUri: redirect(env.TIKTOK_REDIRECT_URI ?? ''),
        scopes: ['video.publish', 'user.info.basic'],
      };
    }

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------------

export interface FlowState {
  platform: Platform;
  scope: 'university' | 'personal';
  /** Who began the flow. The callback writes owner_id from THIS, never a param. */
  actorId: string;
  issuedAt: number;
}

function stateKey(): string | null {
  // Reuses the secret store's key rather than adding a sixth secret to the
  // deployment. Different purpose, same trust boundary — and one fewer thing
  // for the University to generate, lose and ask about.
  const k = process.env.SECRET_STORE_KEY?.trim();
  return k && k.length >= 24 ? k : null;
}

/** How long a half-finished connection stays valid. */
const STATE_TTL_MS = 10 * 60 * 1000;

export function signState(state: FlowState): string {
  const k = stateKey();
  if (!k) throw new Error('SECRET_STORE_KEY is not set, so the OAuth state cannot be signed.');
  const body = Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
  const mac = createHmac('sha256', k).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export interface StateVerdict {
  state: FlowState | null;
  reason?: string;
}

/**
 * Verify and read the state.
 *
 * SIGNATURE FIRST, ALWAYS, and with a constant-time comparison. Reading the
 * fields before checking the signature is how a forged state gets acted on —
 * and the field that matters here decides whether the connection becomes the
 * University's or a named person's.
 */
export function readState(raw: string): StateVerdict {
  const k = stateKey();
  if (!k) return { state: null, reason: 'The server cannot verify the state.' };

  const [body, mac] = raw.split('.');
  if (!body || !mac) return { state: null, reason: 'The state parameter is malformed.' };

  const expected = createHmac('sha256', k).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return {
      state: null,
      reason:
        'The state parameter does not verify. This connection attempt did not begin here, and '
        + 'nothing has been connected.',
    };
  }

  let parsed: FlowState;
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as FlowState;
  } catch {
    return { state: null, reason: 'The state parameter could not be read.' };
  }

  if (Date.now() - parsed.issuedAt > STATE_TTL_MS) {
    return {
      state: null,
      reason: 'This connection attempt took too long and has expired. Start it again.',
    };
  }

  return { state: parsed };
}

// ---------------------------------------------------------------------------

export function authorizeUrl(app: OAuthApp, state: string): string {
  const url = new URL(app.authorizeUrl);
  url.searchParams.set('client_id', app.clientId);
  url.searchParams.set('redirect_uri', app.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', app.scopes.join(' '));
  url.searchParams.set('state', state);
  for (const [k, v] of Object.entries(app.extra ?? {})) url.searchParams.set(k, v);
  return url.toString();
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scopes: string[];
  raw: Record<string, unknown>;
}

/**
 * Exchange the authorisation code for tokens.
 *
 * ONE FUNCTION FOR EVERY PROVIDER, because the differences between them are
 * parameters rather than shapes. Where a provider genuinely differs — X wants
 * HTTP Basic auth, TikTok names its client id `client_key` — that is handled
 * here rather than by five near-identical files that drift apart.
 */
export async function exchangeCode(
  app: OAuthApp,
  platform: Platform,
  code: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: app.redirectUri,
  });

  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
    accept: 'application/json',
  };

  if (platform === 'x') {
    // X authenticates the client in the header and rejects credentials in the
    // body — a 401 that reads like a bad code and is not.
    headers.authorization = `Basic ${Buffer.from(`${app.clientId}:${app.clientSecret}`).toString('base64')}`;
    body.set('code_verifier', 'challenge');
  } else if (platform === 'tiktok') {
    body.set('client_key', app.clientId);
    body.set('client_secret', app.clientSecret);
  } else {
    body.set('client_id', app.clientId);
    body.set('client_secret', app.clientSecret);
  }

  const res = await fetch(app.tokenUrl, { method: 'POST', headers, body });
  const text = await res.text();

  let payload: Record<string, any>;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`${platform} returned something that is not JSON: ${text.slice(0, 200)}`);
  }

  if (!res.ok || payload.error) {
    // THE PROVIDER'S OWN WORDS, not a generic failure. "redirect_uri mismatch"
    // is the single commonest cause and is fixable in thirty seconds by
    // whoever registered the app — but only if they are told.
    const detail = payload.error_description ?? payload.error?.message ?? payload.error ?? text.slice(0, 200);
    throw new Error(`${platform} refused the exchange: ${detail}`);
  }

  const token = payload.access_token ?? payload.data?.access_token;
  if (!token) throw new Error(`${platform} returned no access token.`);

  const expiresIn = Number(payload.expires_in ?? payload.data?.expires_in ?? 0);

  return {
    accessToken: String(token),
    refreshToken: (payload.refresh_token ?? payload.data?.refresh_token ?? null) as string | null,
    expiresAt: expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    scopes: typeof payload.scope === 'string' ? payload.scope.split(/[\s,]+/) : app.scopes,
    raw: payload,
  };
}
