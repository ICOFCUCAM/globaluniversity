// ---------------------------------------------------------------------------
// Server-side authorisation for the Superadministrator's routes.
//
// WHY THIS EXISTS RATHER THAN A ROLE CHECK IN THE COMPONENT.
//
// The portal hides buttons a role may not use. That is courtesy, not security:
// the routes under /api/admin are ordinary HTTP endpoints, and anyone who has
// signed in as a student can call them with curl. If the only check were the
// hidden button, "only the Superadministrator may suspend an administrator"
// would be true of the interface and false of the system.
//
// So every such route starts here. The caller sends the access token it already
// holds; this reads the user back from that token using the service-role key,
// looks the role up in the database rather than trusting anything the caller
// said about itself, and refuses if the role is wrong or the account is
// suspended. A suspended Superadministrator cannot un-suspend themselves.
// ---------------------------------------------------------------------------

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { supabaseUrl as SUPABASE_URL } from './supabase';
import { can, canActOn, type Capability } from './roles';
import type { UserRole } from './types';

export interface Caller {
  id: string;
  email: string | null;
  role: UserRole;
  fullName: string | null;
}

export interface GuardOk {
  ok: true;
  admin: SupabaseClient;
  caller: Caller;
}

export interface GuardFail {
  ok: false;
  status: number;
  error: string;
}

/** The service-role client, or null when the key is absent. */
export function adminClient(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  return createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Establish who is calling and whether they hold `capability`.
 *
 * The token comes from the Authorization header — `Bearer <access_token>` —
 * which the portal reads from its own session. It is never trusted for identity
 * beyond being exchanged for a user id by Supabase itself.
 */
export async function guard(
  request: Request,
  capability: Capability,
): Promise<GuardOk | GuardFail> {
  const admin = adminClient();
  if (!admin) {
    // Refuse rather than fall back. See the comment in the approve route: a
    // silent fallback to the anon key would appear to work and change nothing.
    return { ok: false, status: 500, error: 'service-role-key-missing' };
  }

  const header = request.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return { ok: false, status: 401, error: 'no-token' };

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { ok: false, status: 401, error: 'invalid-token' };
  }

  const { data: prof } = await admin
    .from('profiles')
    .select('id, email, full_name, role, suspended_at')
    .eq('id', userData.user.id)
    .single();

  if (!prof) return { ok: false, status: 403, error: 'no-profile' };
  if (prof.suspended_at) return { ok: false, status: 403, error: 'caller-suspended' };
  if (!can(prof.role as UserRole, capability)) {
    return { ok: false, status: 403, error: `not-permitted:${capability}` };
  }

  return {
    ok: true,
    admin,
    caller: {
      id: prof.id,
      email: prof.email ?? null,
      role: prof.role as UserRole,
      fullName: prof.full_name ?? null,
    },
  };
}

/**
 * Whether the caller may act on this particular account.
 *
 * Separate from `guard` because holding 'suspend-account' says you may suspend
 * someone; it does not say you may suspend *this* someone. Acting on yourself
 * is refused outright — a Superadministrator who suspends their own account has
 * locked the university out of its own system with one click, and there is no
 * one left with the standing to undo it.
 */
export function mayActOnTarget(
  caller: Caller,
  target: { id: string; role: UserRole },
): GuardFail | null {
  if (caller.id === target.id) {
    return { ok: false, status: 409, error: 'cannot-act-on-own-account' };
  }
  if (!canActOn(caller.role, target.role)) {
    return { ok: false, status: 403, error: `outranked:${target.role}` };
  }
  return null;
}

/**
 * Append to the audit trail. Best-effort by design: a suspension that took
 * effect must not be reported as failed because the log write failed, but the
 * failure is surfaced in the response so it is not invisible either.
 */
export async function audit(
  admin: SupabaseClient,
  entry: {
    action: string;
    entityType?: string;
    entityId?: string;
    performedBy: string;
    details?: Record<string, unknown>;
  },
): Promise<string | null> {
  const { error } = await admin.from('audit_logs').insert({
    action: entry.action,
    entity_type: entry.entityType ?? null,
    entity_id: entry.entityId ?? null,
    performed_by: entry.performedBy,
    details: entry.details ?? null,
  });
  return error ? error.message : null;
}

/** Readable, unambiguous initial password — no l/1/O/0. */
export function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(14);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
