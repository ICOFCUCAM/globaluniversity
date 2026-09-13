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
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    // SAID IN THE SCREEN'S OWN WORDS, not as `no-token`. The officer is signed
    // out or their session has expired, and "no-token" sends them to look at
    // the database.
    return {
      ok: false,
      error: 'not-signed-in',
      detail: 'Your session has expired. Sign in again and try once more — nothing was sent.',
    };
  }

  try {
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
