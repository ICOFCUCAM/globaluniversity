// ---------------------------------------------------------------------------
// WHO IS ASKING, WHEN IT IS NOT A DEMONSTRATION.
//
// Three modes, because a platform that mounts inside somebody else's
// university cannot insist on owning the login:
//
//   demo      the switcher. Labelled as one, and the default, so the product
//             opens and demonstrates with nothing configured.
//   header    the host authenticated the person and passes them across, signed.
//             This is how this platform sits behind a university's own SSO:
//             they already know who it is, and re-asking would be worse.
//   supabase  a Supabase access token, verified here against the project's
//             JWT secret — signature and expiry, not just decoded.
//
// THE DANGEROUS ONE IS `header`, AND IT IS THE POINT OF THE SIGNATURE. A
// header a browser can set is not authentication: `x-academic-user: registry`
// would be an administrator. So the host signs `user:role:issued` with a shared
// secret, the signature is compared in constant time, and anything older than
// the window is refused — a captured header is not a permanent key.
// ---------------------------------------------------------------------------

import { createHmac, timingSafeEqual } from 'node:crypto';

export type SessionMode = 'demo' | 'header' | 'supabase' | 'unconfigured';

export interface SessionClaim {
  id: string;
  role?: string;
}

export interface SessionOutcome {
  claim?: SessionClaim;
  /** Why it was refused, for a log. Never shown to the person verbatim. */
  refused?: string;
}

const constantTimeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
};

export function sign(secret: string, user: string, role: string, issued: number): string {
  return createHmac('sha256', secret).update(`${user}:${role}:${issued}`).digest('hex');
}

/**
 * A person the host has already authenticated. Signed, fresh, and refused
 * otherwise — with no fallback to "well, the header said so".
 */
export function verifyHeaders(
  headers: { get(name: string): string | null },
  options: { secret?: string; windowSeconds?: number; now?: number },
): SessionOutcome {
  if (!options.secret) return { refused: 'no shared secret is configured' };

  const user = headers.get('x-academic-user');
  const role = headers.get('x-academic-role') ?? '';
  const issued = Number(headers.get('x-academic-issued'));
  const signature = headers.get('x-academic-signature');

  if (!user || !signature || !Number.isFinite(issued)) return { refused: 'incomplete' };

  const expected = sign(options.secret, user, role, issued);
  if (!constantTimeEqual(expected, signature)) return { refused: 'bad signature' };

  const now = options.now ?? Math.floor(Date.now() / 1000);
  const window = options.windowSeconds ?? 300;
  // A CAPTURED HEADER IS NOT A PERMANENT KEY. Five minutes by default, and a
  // clock skew of a few seconds in the other direction is tolerated rather
  // than turning a slightly fast host into a locked-out university.
  if (issued > now + 60) return { refused: 'issued in the future' };
  if (now - issued > window) return { refused: 'expired' };

  return { claim: { id: user, role: role || undefined } };
}

/**
 * A Supabase access token: HS256, verified against the project's JWT secret.
 * Decoding without verifying would accept anything anybody typed, which is the
 * mistake this function exists to not make.
 */
export function verifySupabaseToken(
  token: string | undefined,
  options: { secret?: string; now?: number },
): SessionOutcome {
  if (!options.secret) return { refused: 'no JWT secret is configured' };
  if (!token) return { refused: 'no token' };

  const parts = token.split('.');
  if (parts.length !== 3) return { refused: 'malformed' };
  const [header, payload, signature] = parts;

  const expected = createHmac('sha256', options.secret)
    .update(`${header}.${payload}`).digest('base64url');
  if (!constantTimeEqual(expected, signature)) return { refused: 'bad signature' };

  let claims: { sub?: string; exp?: number; role?: string; user_role?: string };
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return { refused: 'unreadable claims' };
  }

  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (claims.exp && claims.exp < now) return { refused: 'expired' };
  if (!claims.sub) return { refused: 'no subject' };

  // The ROLE comes from the university's own records, not from the token: a
  // claim in a JWT the host minted is the host's opinion about authentication,
  // and what somebody may do here is decided by `capabilities.ts`.
  return { claim: { id: claims.sub } };
}

/**
 * Which of the three is in force — and a fourth answer the original three did
 * not have.
 *
 * ---------------------------------------------------------------------------
 * THE DEMONSTRATION SWITCHER IS NOT A PRODUCTION FALLBACK
 * ---------------------------------------------------------------------------
 *
 * This read `mode === 'header' || mode === 'supabase' ? mode : 'demo'`. Every
 * other value fell to `demo`, INCLUDING ABSENCE, and including a typo — and
 * in `demo` the Studio takes its identity from a cookie the browser sets,
 * defaulting to `person-lecturer`. So on a deployment where
 * ACADEMIC_SESSION_MODE had never been set, anybody who could open
 * /academic-studio could choose whose eyes to look through, and every
 * ownership rule in the Studio was advisory.
 *
 * It opened as a demonstration, which was the intention when this platform was
 * a product that had to show itself with nothing configured. It is not that
 * any more: it is mounted inside a university, serving real lecturers'
 * material, and the rest of this system refuses rather than falls back —
 * `adminAuth.ts` will not drop to the publishable key when the service key is
 * missing, for exactly this reason, and says so: "a silent fallback would
 * appear to work and change nothing".
 *
 * SO AN UNSET VARIABLE IS NOW `unconfigured`, AND `unconfigured` REFUSES.
 * Demonstration remains available where it belongs: off the production build,
 * or wherever NEXT_PUBLIC_ENABLE_DEMO is deliberately set — the flag the
 * configuration report already describes as a hazard when present, and the
 * same one that puts the role buttons on the login page.
 */
export function sessionMode(): SessionMode {
  const mode = process.env.ACADEMIC_SESSION_MODE;
  if (mode === 'header' || mode === 'supabase') return mode;

  // ASKED FOR BY NAME, not arrived at. `demo` is a thing somebody chooses.
  if (mode === 'demo') return 'demo';

  // AND WHERE NOBODY CHOSE: a demonstration off the production build, and a
  // refusal on it.
  const demonstrating = process.env.NODE_ENV !== 'production'
    || process.env.NEXT_PUBLIC_ENABLE_DEMO === 'true';
  return demonstrating ? 'demo' : 'unconfigured';
}

/**
 * What to tell somebody who meets `unconfigured`.
 *
 * NAMES THE VARIABLE AND THE VALUE. A refusal that says "not signed in" to an
 * administrator whose deployment is one environment variable short sends them
 * looking at their own account.
 */
export const SESSION_NOT_CONFIGURED =
  'The Academic Studio has no way to tell who you are. Set ACADEMIC_SESSION_MODE=supabase on '
  + 'the deployment (with SUPABASE_JWT_SECRET), or =header behind another host\u2019s sign-in '
  + '(with ACADEMIC_SESSION_SECRET). Until then the Studio refuses every request rather than '
  + 'opening the demonstration switcher, where whoever arrives chooses whose eyes to look '
  + 'through.';
