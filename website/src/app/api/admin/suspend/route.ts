// ---------------------------------------------------------------------------
// Suspend or reinstate an account. Superadministrator only.
//
// A suspension has to survive the suspended person still holding a valid
// session. Flagging the profile alone would not do it: the browser keeps its
// access token for up to an hour, so an administrator suspended at 09:00 could
// keep working until the token expired — and could spend that hour undoing the
// reason they were suspended.
//
// So suspension is applied in two places:
//
//   1. `ban_duration` on the auth user. Supabase then refuses to issue or
//      refresh a token for that account at all. This is the real lock.
//   2. `suspended_at` on the profile. This is the record — who, when, why, by
//      whom — and it is what the portal checks on the next page load, which
//      closes the gap before the existing token expires.
//
// Reinstating reverses both. Neither is possible against your own account, and
// neither is possible against someone of your own rank or above; see
// mayActOnTarget.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard, mayActOnTarget, audit } from '@/lib/adminAuth';
import { roleLabels } from '@/lib/roles';
import type { UserRole } from '@/lib/types';

export const runtime = 'nodejs';

// Supabase expresses a ban as a duration, not a flag. A hundred years stands in
// for "until reinstated"; 'none' lifts it.
const BAN_UNTIL_REINSTATED = '876000h';

export async function POST(request: Request) {
  const g = await guard(request, 'suspend-account');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin, caller } = g;

  let body: { userId?: string; reason?: string; reinstate?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  const { userId, reason, reinstate = false } = body;
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'missing-user-id' }, { status: 400 });
  }
  // A suspension without a stated reason is an act nobody can review later.
  if (!reinstate && !reason?.trim()) {
    return NextResponse.json({ ok: false, error: 'reason-required' }, { status: 422 });
  }

  const { data: target } = await admin
    .from('profiles')
    .select('id, email, full_name, role, suspended_at')
    .eq('id', userId)
    .single();
  if (!target) {
    return NextResponse.json({ ok: false, error: 'user-not-found' }, { status: 404 });
  }

  const refusal = mayActOnTarget(caller, { id: target.id, role: target.role as UserRole });
  if (refusal) {
    return NextResponse.json({ ok: false, error: refusal.error }, { status: refusal.status });
  }

  // Suspending the last active Superadministrator would leave the university
  // with no one able to reinstate anyone. The database refuses this too — see
  // the guard trigger in the migration — but refusing here gives a usable
  // message rather than a raised exception.
  if (!reinstate && target.role === 'superadmin') {
    const { count } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'superadmin')
      .is('suspended_at', null);
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { ok: false, error: 'last-active-superadmin' },
        { status: 409 },
      );
    }
  }

  // 1. The lock.
  const { error: banErr } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: reinstate ? 'none' : BAN_UNTIL_REINSTATED,
  });
  if (banErr) {
    return NextResponse.json(
      { ok: false, error: `auth-not-updated: ${banErr.message}` },
      { status: 500 },
    );
  }

  // 2. The record. If this fails after the ban succeeded the account is locked
  // but unexplained, which is recoverable; the reverse — explained but not
  // locked — is not, so the order matters.
  const { error: profErr } = await admin
    .from('profiles')
    .update({
      suspended_at: reinstate ? null : new Date().toISOString(),
      suspended_by: reinstate ? null : caller.id,
      suspension_reason: reinstate ? null : reason!.trim(),
    })
    .eq('id', userId);
  if (profErr) {
    return NextResponse.json(
      { ok: false, error: `auth-updated-but-profile-not: ${profErr.message}` },
      { status: 500 },
    );
  }

  const auditErr = await audit(admin, {
    action: reinstate ? 'account.reinstated' : 'account.suspended',
    entityType: 'profile',
    entityId: userId,
    performedBy: caller.id,
    details: {
      target_email: target.email,
      target_role: target.role,
      target_role_label: roleLabels[target.role as UserRole],
      reason: reinstate ? null : reason!.trim(),
      by_email: caller.email,
    },
  });

  return NextResponse.json({
    ok: true,
    suspended: !reinstate,
    email: target.email,
    role: target.role,
    // Surfaced rather than swallowed: an act that is not in the log is an act
    // that did not happen, as far as any later review is concerned.
    auditWarning: auditErr ?? undefined,
  });
}
