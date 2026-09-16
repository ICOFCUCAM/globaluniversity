// ---------------------------------------------------------------------------
// The one store and the one queue this process is using.
//
// Module state, so a rebuild in development starts from the demonstration
// course again and a deployment points these two functions at its own
// implementations without touching a screen.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE HAD TO CHANGE
// ---------------------------------------------------------------------------
//
// `getStore()` returned the in-memory store on every call, unconditionally.
// `createSupabaseStore` existed, was fully written, and was NEVER CALLED —
// its own header said so: "NOT VERIFIED AGAINST A DATABASE… every query below
// is written from the schema in that migration and has never returned a row."
//
// So the platform could be deployed against a university's Supabase project
// and would quietly serve the demonstration course to everybody, for ever,
// with no error anywhere. Two lines of configuration away from a system that
// looks like it is working and is not connected to anything.
//
// ---------------------------------------------------------------------------
// AND WHY THE CHOICE IS EXPLICIT RATHER THAN CLEVER
// ---------------------------------------------------------------------------
//
// `ACADEMIC_STORE` names the store. It is not inferred from whether a Supabase
// URL happens to be set, because inference is how a deployment ends up on the
// wrong one: a URL present for some other reason, a variable dropped in a
// rename, and the difference between the University's database and a
// demonstration is silent either way.
//
//   ACADEMIC_STORE=supabase   the University's database. Requires the URL and
//                             the publishable key; refuses without them.
//   ACADEMIC_STORE=memory     the demonstration. The default, so the product
//                             still opens with nothing configured.
//
// A REQUEST'S OWN TOKEN, NOT A SHARED CLIENT. Row-level security does the real
// work in this platform — 092, 093 and 094 are written that way on purpose —
// so the store is built per request around the caller's access token and a
// process-wide singleton would be wrong. `getStore()` keeps the demonstration
// singleton; `storeFor(accessToken)` is what a request uses.
// ---------------------------------------------------------------------------

import { createMemoryStore } from './memory';
import { createSupabaseStore } from './supabase';
import { DEMO } from './seed';
import type { Store } from './store';
import { createMemoryQueue, type JobQueue } from '../jobs/queue';
import { UNIVERSITY } from '../university';

declare global {
  // eslint-disable-next-line no-var
  var __academicStore: Store | undefined;
  // eslint-disable-next-line no-var
  var __academicQueue: JobQueue | undefined;
}

export type StoreKind = 'memory' | 'supabase';

export function storeKind(): StoreKind {
  return process.env.ACADEMIC_STORE === 'supabase' ? 'supabase' : 'memory';
}

/**
 * The store for one request.
 *
 * `accessToken` is the caller's own Supabase session. Passing it is what makes
 * every query below run AS THAT PERSON, so the policies decide — no service
 * key, no `bypass`. Omitting it against the Supabase store is legitimate only
 * where nothing personal is read (a public verification page, say).
 */
export function storeFor(accessToken?: string): Store {
  if (storeKind() === 'memory') return getStore();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // NO FALLING BACK TO THE DEMONSTRATION. A misconfigured deployment that
  // quietly served made-up lectures to a real university's students would be
  // the worst failure this file could have — the same reasoning `session.ts`
  // gives for refusing rather than signing everybody in as the lecturer.
  if (!url || !key) {
    throw new Error(
      'ACADEMIC_STORE=supabase, but NEXT_PUBLIC_SUPABASE_URL or '
      + 'NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Refusing to fall back to the demonstration '
      + 'store: that would serve invented lectures to real students with no error anywhere.',
    );
  }

  return createSupabaseStore({ url, key, accessToken, university: UNIVERSITY });
}

/** The demonstration store: one per process, so a rebuild starts over. */
export function getStore(): Store {
  if (!globalThis.__academicStore) {
    globalThis.__academicStore = createMemoryStore(JSON.parse(JSON.stringify(DEMO)));
  }
  return globalThis.__academicStore;
}

export function getQueue(): JobQueue {
  if (!globalThis.__academicQueue) globalThis.__academicQueue = createMemoryQueue();
  return globalThis.__academicQueue;
}
