// ---------------------------------------------------------------------------
// WHO IS ASKING.
//
// THREE MODES, and only the first is a demonstration.
//
//   demo      the switcher: choose whose eyes you are looking through, so the
//             ownership rules can be SEEN refusing things. The default, so the
//             product opens with nothing configured.
//   header    the host authenticated the person and passes them across, signed
//             (ACADEMIC_SESSION_MODE=header, ACADEMIC_SESSION_SECRET).
//   supabase  a Supabase access token, verified against SUPABASE_JWT_SECRET.
//
// AND A FOURTH, WHICH IS WHERE THE DEFAULT WENT. `unconfigured` is what an
// unset ACADEMIC_SESSION_MODE now means on a production build: the switcher
// used to be the fallback, so a deployment that never set the variable let
// whoever opened the Studio choose whose eyes to look through. `demo` is
// still available and is now a thing somebody ASKS for by name.
//
// Outside `demo` there is NO FALLBACK: a misconfigured deployment refuses
// rather than quietly signing everybody in as the lecturer. Nothing else in
// the platform reads a cookie or a header.
// ---------------------------------------------------------------------------

import { cookies, headers } from 'next/headers';
import type { Actor } from './domain/ownership';
import type { Role } from './capabilities';
import { getStore } from './data';
import {
  SESSION_NOT_CONFIGURED, sessionMode, verifyHeaders, verifySupabaseToken,
} from './auth/session';

const COOKIE = 'academic_actor';
const DEFAULT_ACTOR = 'person-lecturer';

export async function currentActor(): Promise<Actor & {
  name: string;
  /** The one language this person's academic environment arrives in. */
  workingLanguage?: string;
  voicePreference?: string;
  audioSpeed?: number;
}> {
  const store = getStore();
  const mode = sessionMode();

  // ---- OR NOBODY SAID HOW TO TELL ---------------------------------------
  //
  // Not a demonstration and not an error on this person's part: an
  // environment variable nobody set. The Studio used to answer this case with
  // the switcher, where the browser's cookie chose who you were; it now
  // refuses, and the message names the variable so that an administrator is
  // not sent looking at their own account.
  if (mode === 'unconfigured') {
    throw new Error(SESSION_NOT_CONFIGURED);
  }

  // ---- MOUNTED BEHIND SOMEBODY ELSE'S LOGIN ----------------------------
  //
  // The host already knows who this is; re-asking would be worse. What is not
  // negotiable is that the claim be verified — a header a browser can set is
  // not authentication, and `auth/session.ts` is where that is enforced.
  if (mode !== 'demo') {
    const incoming = headers();
    const outcome = mode === 'header'
      ? verifyHeaders(incoming, { secret: process.env.ACADEMIC_SESSION_SECRET })
      : verifySupabaseToken(
        incoming.get('authorization')?.replace(/^Bearer /i, ''),
        { secret: process.env.SUPABASE_JWT_SECRET },
      );

    if (!outcome.claim) {
      // NO FALLBACK TO THE DEMONSTRATION SWITCHER. A misconfigured deployment
      // that quietly signed everybody in as the lecturer would be the worst
      // failure this file could have.
      throw new Error(`Not signed in (${outcome.refused ?? 'no session'}).`);
    }

    const person = await store.person(outcome.claim.id);
    if (!person) throw new Error('Signed in, but not a person this university knows.');
    return {
      id: person.id, role: person.role as Role, name: person.name,
      workingLanguage: person.workingLanguage,
      voicePreference: person.voicePreference,
      audioSpeed: person.audioSpeed,
    };
  }

  const id = cookies().get(COOKIE)?.value ?? DEFAULT_ACTOR;
  const person = (await store.person(id)) ?? (await store.person(DEFAULT_ACTOR));
  if (!person) throw new Error('No people are configured in this workspace.');
  return {
    id: person.id,
    role: person.role as Role,
    name: person.name,
    workingLanguage: person.workingLanguage,
    voicePreference: person.voicePreference,
    audioSpeed: person.audioSpeed,
  };
}

export const ACTOR_COOKIE = COOKIE;
