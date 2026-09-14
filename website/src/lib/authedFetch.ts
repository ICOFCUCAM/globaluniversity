// ---------------------------------------------------------------------------
// CALLING A GUARDED ROUTE FROM A SCREEN.
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS, AND IT IS AN APOLOGY
// ---------------------------------------------------------------------------
//
// Every route behind `guard()` reads `Authorization: Bearer <access_token>` and
// refuses with `no-token` without it. Cookies are not it: `credentials:
// 'include'` sends the Supabase session cookie, which the route never looks at.
//
// Three screens shipped calling their routes with `credentials: 'include'` and
// no token. Every one of them loaded, drew its whole interface, and then said
// "The register could not be read: Error: no-token" — which reads as a database
// problem and is not one. The Vice-Chancellor saw it on the Correspondence
// screen before anybody else did.
//
// The older screens each solved this inline, four times, with four slightly
// different spellings of the same three lines. That is why a fourth copy got
// it wrong: there was nothing to copy from that was obviously THE way to do it.
//
// So it is one function now. A screen that calls a guarded route uses this, and
// a screen that does not is visibly not doing the normal thing.
// ---------------------------------------------------------------------------

import { supabase } from './supabase';

export interface ApiResult {
  ok: boolean;
  error?: string;
  detail?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// AND THE SECOND THING THAT WENT WRONG HERE: `invalid-token`
// ---------------------------------------------------------------------------
//
// The Vice-Chancellor opened Draft & submit, signed in, name in the sidebar,
// and the screen said:
//
//     invalid-token
//
// Not a database fault and not a permission: the ACCESS TOKEN HAD EXPIRED.
// `getSession()` hands back whatever is in storage without checking whether it
// is still good, and supabase-js only refreshes on a timer that does not run
// while a tab is in the background. A tab left open — and this University works
// with twenty of them — wakes up holding a token Supabase will not accept, and
// the first call made from it is refused before the refresh timer ever fires.
//
// TWO THINGS FIX IT, and neither alone is enough:
//
//   1. REFRESH BEFORE SENDING when the token is at or near its expiry. Cheap,
//      and it removes the race for every call that is about to make one.
//   2. REFRESH AND RETRY ONCE when the route refuses anyway. The clock can be
//      wrong, the token can be revoked server-side, and the window between
//      check and send is real.
//
// AND `invalid-token` NEVER REACHES AN OFFICER AGAIN. If the retry fails too,
// the session is genuinely gone and the screen says so in words that tell them
// what to do — the same apology this file's header is about.
// ---------------------------------------------------------------------------

/** Refresh with this much of the token's life left, in seconds. */
const REFRESH_WITHIN = 60;

/** The route refusals that mean "your session, not your permissions". */
const STALE = new Set(['invalid-token', 'no-token']);

const SESSION_GONE = {
  ok: false as const,
  error: 'not-signed-in',
  detail: 'Your session has expired. Sign in again and try once more — nothing was sent.',
};

/**
 * An access token that is good now, rather than one that was good once.
 *
 * `force` skips the expiry check and refreshes outright, which is what the
 * retry needs: the token looked fine and the server disagreed.
 */
async function freshToken(force = false): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return null;

  const expiresAt = session.expires_at ?? 0;
  const secondsLeft = expiresAt - Math.floor(Date.now() / 1000);

  if (!force && secondsLeft > REFRESH_WITHIN) return session.access_token;

  // REFRESH FAILING IS NOT AN ERROR TO REPORT AS ONE. It means the refresh
  // token is spent too, and the officer is signed out — which the caller turns
  // into a sentence rather than a code.
  const { data: refreshed, error } = await supabase.auth.refreshSession();
  if (error || !refreshed.session) return null;
  return refreshed.session.access_token;
}

/**
 * Fetch a route that sits behind `guard()`.
 *
 * RETURNS THE BODY, NOT THE RESPONSE. Every one of these routes answers with
 * `{ ok, error?, detail? }` whether it succeeded or refused, and a caller that
 * has to check `response.ok` as well as `body.ok` gets one of them wrong.
 *
 * NEVER THROWS on a refusal. A 409 from a route that is telling the officer why
 * it refused is not an exception — it is the answer, and it carries the
 * sentence the screen should show.
 */
export async function authedFetch(
  url: string, init: RequestInit = {},
): Promise<ApiResult> {
  const send = async (token: string): Promise<ApiResult> => {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
        authorization: `Bearer ${token}`,
      },
    });
    const body = await response.json().catch(() => null);
    if (body && typeof body === 'object') return body as ApiResult;
    return {
      ok: false,
      error: `http-${response.status}`,
      detail: 'The server answered with something that was not a result.',
    };
  };

  try {
    const token = await freshToken();
    // SAID IN THE SCREEN'S OWN WORDS, not as `no-token`. The officer is signed
    // out or their session has expired, and "no-token" sends them to look at
    // the database.
    if (!token) return SESSION_GONE;

    const first = await send(token);
    if (!first.ok && STALE.has(String(first.error))) {
      // ONE RETRY, WITH A FORCED REFRESH. The token passed the expiry check and
      // the server refused it anyway — a wrong clock, a revoked session, or the
      // gap between checking and sending. Trying twice costs a round trip;
      // showing `invalid-token` to the Vice-Chancellor costs an afternoon.
      const second = await freshToken(true);
      if (!second) return SESSION_GONE;
      const retried = await send(second);
      // STILL REFUSED MEANS THE SESSION IS GONE. Whatever the route called it,
      // the officer needs the sentence, not the code.
      if (!retried.ok && STALE.has(String(retried.error))) return SESSION_GONE;
      return retried;
    }
    return first;
  } catch (e) {
    return {
      ok: false,
      error: 'unreachable',
      detail: `The server could not be reached: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/** The same, for a POST carrying a JSON body — which is most of them. */
export async function authedPost(
  url: string, payload: Record<string, unknown>,
): Promise<ApiResult> {
  return authedFetch(url, { method: 'POST', body: JSON.stringify(payload) });
}

// ---------------------------------------------------------------------------
// AND THE ONE THAT COMES BACK AS A FILE
// ---------------------------------------------------------------------------
//
// A PDF is bytes, not `{ ok, detail }`, so `authedFetch` cannot carry it — it
// parses the body as JSON and a PDF is not JSON.
//
// THE TOKEN IS WHY THIS EXISTS AT ALL. The obvious way to open a PDF is to
// point a tab at its address, and this system cannot: every route sits behind
// `guard()` reading `Authorization: Bearer …`, a tab navigation carries no
// such header, and `reachability.test.mjs` refuses any screen that navigates
// the browser to an /api/ address. So the bytes are fetched WITH the token and
// turned into a `blob:` URL, which a tab can be pointed at — the browser's own
// PDF viewer opens it, with its own print and download buttons.
//
// A ROUTE THAT REFUSES STILL ANSWERS IN JSON, and this tells the two apart by
// the content type rather than by guessing, so a refusal reaches the screen as
// a sentence instead of a tab full of `{"ok":false}`.

export type AuthedFile =
  | { ok: true; blob: Blob; filename: string | null }
  | { ok: false; error: string; detail?: string };

/** POST a JSON body to a guarded route and take the response as a file. */
export async function authedFile(
  url: string, payload: Record<string, unknown>,
): Promise<AuthedFile> {
  // THE SAME EXPIRY HANDLING AS `authedFetch`. A stale token refuses a PDF
  // exactly as readily as it refuses a register, and an officer who has just
  // been told their letter could not be opened will not think "my session".
  const send = async (token: string): Promise<AuthedFile> => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

    const type = response.headers.get('content-type') ?? '';
    if (type.includes('application/json')) {
      const body = await response.json().catch(() => null) as ApiResult | null;
      return {
        ok: false,
        error: String(body?.error ?? `http-${response.status}`),
        detail: body?.detail as string | undefined,
      };
    }
    if (!response.ok) {
      return { ok: false, error: `http-${response.status}` };
    }

    // THE NAME THE SERVER CHOSE. `content-disposition` carries the reference,
    // so a saved file is called IGUC-HR-APT-2026-0001.pdf and not `download`.
    const disposition = response.headers.get('content-disposition') ?? '';
    const named = /filename="([^"]+)"/.exec(disposition);

    return { ok: true, blob: await response.blob(), filename: named ? named[1] : null };
  };

  try {
    const token = await freshToken();
    if (!token) return SESSION_GONE;

    const first = await send(token);
    if (!first.ok && STALE.has(String(first.error))) {
      const second = await freshToken(true);
      if (!second) return SESSION_GONE;
      const retried = await send(second);
      if (!retried.ok && STALE.has(String(retried.error))) return SESSION_GONE;
      return retried;
    }
    return first;
  } catch (e) {
    return {
      ok: false,
      error: 'unreachable',
      detail: `The server could not be reached: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
