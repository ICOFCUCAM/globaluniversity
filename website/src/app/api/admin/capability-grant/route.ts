// ---------------------------------------------------------------------------
// THE SUPERADMINISTRATOR'S SWITCH — making, listing and revoking a grant.
//
//   POST /api/admin/capability-grant  { action, ... }
//
//   grant   { granteeId, capability, reason, days }   give it, until a date
//   revoke  { id }                                    take it back
//   list    { granteeId? }                            what is in force, and what was
//   mine    {}                                        what *I* have been given
//
// ---------------------------------------------------------------------------
// WHY A GRANT AND NOT A SETTING
// ---------------------------------------------------------------------------
//
// The University asked for a switch it could use to approve or deny an
// office's access. This is that switch, and it is built out of rows rather
// than a boolean for one reason: a setting only ever holds its CURRENT value.
//
// Six months after a letter was written, with the switch off, nothing in the
// database says whether it was on the day the letter was written. A permission
// system that cannot answer "who could do this, and when" has recorded the
// least interesting half of the question.
//
// So: a named person, a named capability, a stated reason, an expiry date.
// 056 refuses a grant with no expiry, refuses one without a reason of at least
// twenty characters, refuses any edit to a grant once made, and refuses a
// delete. Revoking is a new fact with its own timestamp; restoring access is a
// new grant, not an un-revocation.
//
// ---------------------------------------------------------------------------
// WHO MAY USE IT
// ---------------------------------------------------------------------------
//
// 'assign-roles' — the capability that already governs who may change what an
// account is. Handing somebody a capability their office does not carry is the
// same act as changing their role, done narrowly and with an end date, and it
// should not sit behind a lower bar than the blunt version of itself.
//
// AND IT CANNOT BE USED ON YOURSELF. A Superadministrator who may grant
// themselves a capability has not been granted anything — they simply hold
// every capability, with a paper trail that makes it look otherwise. That is
// worse than holding it plainly.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard, audit } from '@/lib/adminAuth';
import { ALL_CAPABILITIES, type Capability } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

// NOT EXPORTED — a Next.js route file may export only its handlers and the
// runtime flags.

/** 056's floor on the stated reason, restated here so the message is useful. */
const MIN_REASON = 20;

/**
 * The longest a grant may run.
 *
 * A YEAR IS NOT A GRANT, IT IS A ROLE CHANGE. The whole point of this table is
 * the exception that ends; something needed for a year should be a role, where
 * it is visible in the matrix rather than buried in a row. Ninety days is long
 * enough to cover a secondment or a sabbatical and short enough that somebody
 * has to look at it again.
 */
const MAX_DAYS = 90;

const CAPABILITY: Record<string, Capability> = {
  grant: 'assign-roles' as Capability,
  revoke: 'assign-roles' as Capability,
  list: 'assign-roles' as Capability,
  // YOUR OWN GRANTS ARE YOUR OWN BUSINESS. Somebody should be able to see what
  // they have been given and when it lapses without asking the person who gave
  // it to them. 056's policy already scopes the rows; this only needs a signed
  // -in caller, so it asks for the lowest bar in the matrix.
  mine: 'track-application' as Capability,
};

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  const capability = CAPABILITY[action];
  if (!capability) {
    return bad('unknown-action', 400,
      `Not a grant action. They are: ${Object.keys(CAPABILITY).join(', ')}.`);
  }

  // ---------------------------------------------------------------------
  // A SECOND, NARROWER AUTHORITY — AND ONLY OVER `studio-*`.
  //
  // The University's ruling of 16 September 2026: "The VC should be able to
  // authorize a lecturer without requiring the Superadmin to manually
  // intervene every time."
  //
  // The lazy way to do that is to hand the Vice-Chancellor `assign-roles`,
  // which governs changing what an account IS. The ruling asked for authority
  // over the Studio's permissions, so that is what this gives: a caller
  // holding `grant-studio-permission` may grant, revoke and list — but the
  // capability in question must actually begin `studio-`.
  //
  // THE CHECK IS ON THE CAPABILITY BEING GRANTED, NOT ON THE CALLER'S ROLE.
  // Reading the role would mean this file holding a second opinion about who
  // the Vice-Chancellor is; reading the target means the narrowing holds for
  // whoever is given `grant-studio-permission` next.
  const studioOnly = (action === 'grant' || action === 'revoke' || action === 'list')
    && String(body.capability ?? '').startsWith('studio-');

  let g = await guard(request, capability);
  if (!g.ok && studioOnly) {
    const narrower = await guard(request, 'grant-studio-permission' as Capability);
    if (narrower.ok) g = narrower;
  }
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: action === 'grant' || action === 'revoke'
        ? 'Handing somebody a capability their office does not carry is a change to what that '
          + 'account is, and is held by the same authority that changes a role. The '
          + 'Vice-Chancellor holds `grant-studio-permission`, which is the same act narrowed to '
          + 'the Academic Studio — and it only answers for capabilities beginning `studio-`.'
        : undefined,
    }, { status: g.status });
  }
  const { caller, admin } = g;

  // =========================================================================
  // MINE — what have I been given?
  // =========================================================================
  if (action === 'mine') {
    const { data } = await admin
      .from('capability_grants_in_force')
      .select('id, capability, reason, granted_at, expires_at')
      .eq('grantee_id', caller.id)
      .order('expires_at', { ascending: true });
    return NextResponse.json({ ok: true, grants: data ?? [] });
  }

  // =========================================================================
  // LIST — including the spent ones, which are the point of the table
  // =========================================================================
  //
  // REVOKED AND EXPIRED ROWS ARE RETURNED. A list of what is in force right
  // now is the setting this table exists instead of. What somebody HELD, and
  // until when, is the thing worth keeping.
  if (action === 'list') {
    let q = admin
      .from('capability_grants')
      // A SINGLE STRING LITERAL, not a concatenation. supabase-js infers the
      // row type from this argument, and a `'a, b, ' + 'c'` collapses it to
      // GenericStringError[] — which shows up as "Property 'revoked_at' does
      // not exist", a long way from the line that caused it.
      .select('id, grantee_id, capability, reason, granted_by, granted_at, expires_at, revoked_at, revoked_by')
      .order('granted_at', { ascending: false })
      .limit(500);
    if (body.granteeId) q = q.eq('grantee_id', String(body.granteeId));
    const { data, error } = await q;
    if (error) return bad('read-failed', 500, error.message);
    const now = Date.now();
    const grants = (data ?? []).map((r) => ({
      ...r,
      inForce: !r.revoked_at && new Date(r.expires_at as string).getTime() > now,
    }));
    return NextResponse.json({ ok: true, grants });
  }

  // =========================================================================
  // REVOKE
  // =========================================================================
  if (action === 'revoke') {
    const id = String(body.id ?? '');
    if (!id) return bad('no-id', 400);

    const { data: row } = await admin
      .from('capability_grants')
      .select('id, grantee_id, capability, revoked_at')
      .eq('id', id)
      .maybeSingle();
    if (!row) return bad('not-found', 404);
    if (row.revoked_at) {
      return bad('already-revoked', 409,
        'This grant has already been revoked. That is part of the record and does not happen '
        + 'twice.');
    }

    const { error } = await admin
      .from('capability_grants')
      .update({ revoked_at: new Date().toISOString(), revoked_by: caller.id })
      .eq('id', id);
    if (error) return bad('revoke-failed', 500, error.message);

    await audit(admin, {
      action: 'capability-grant-revoked',
      entityType: 'capability_grant',
      entityId: id,
      performedBy: caller.id,
      details: { grantee: row.grantee_id, capability: row.capability },
    });
    return NextResponse.json({ ok: true });
  }

  // =========================================================================
  // GRANT
  // =========================================================================
  const granteeId = String(body.granteeId ?? '');
  const wanted = String(body.capability ?? '');
  const reason = String(body.reason ?? '').trim();
  const days = Number(body.days ?? 0);

  if (!granteeId) return bad('no-grantee', 400);

  // NOT TO YOURSELF. See the header: a self-granted capability is not a grant.
  if (granteeId === caller.id) {
    return bad('not-to-yourself', 400,
      'A capability cannot be granted to the account granting it. If the office needs it, it '
      + 'belongs in the role, where it is visible.');
  }

  // A REAL CAPABILITY. 056 deliberately puts no vocabulary in the database —
  // the list moves with the application and a copy in SQL goes stale — so the
  // check has to happen here, and a typo must be refused rather than stored as
  // a grant of something that will never match.
  if (!(ALL_CAPABILITIES as readonly string[]).includes(wanted)) {
    return bad('unknown-capability', 400,
      `“${wanted}” is not a capability this system has. A grant of something that does not `
      + 'exist would sit in the table looking like access and give none.');
  }

  if (reason.length < MIN_REASON) {
    return bad('reason-too-short', 400,
      `Say why, in at least ${MIN_REASON} characters. This row is what answers “who could do `
      + 'this, and when” long after everyone has forgotten.');
  }

  if (!Number.isFinite(days) || days < 1 || days > MAX_DAYS) {
    return bad('bad-duration', 400,
      `A grant runs between 1 and ${MAX_DAYS} days. Anything longer is a role change, and `
      + 'belongs in the role where it can be seen.');
  }

  // THE GRANTEE MUST EXIST AND NOT BE SUSPENDED. Granting a capability to a
  // suspended account is a door left open for whenever it is reinstated.
  const { data: grantee } = await admin
    .from('profiles')
    .select('id, role, suspended_at')
    .eq('id', granteeId)
    .maybeSingle();
  if (!grantee) return bad('no-such-account', 404);
  if (grantee.suspended_at) {
    return bad('grantee-suspended', 409,
      'This account is suspended. Reinstate it first — a grant made now would take effect '
      + 'silently the moment it came back.');
  }

  const expires = new Date(Date.now() + days * 86_400_000).toISOString();
  const { data: made, error } = await admin
    .from('capability_grants')
    .insert({
      grantee_id: granteeId,
      capability: wanted,
      reason,
      granted_by: caller.id,
      expires_at: expires,
    })
    .select('id, capability, expires_at')
    .single();
  if (error) return bad('grant-failed', 500, error.message);

  await audit(admin, {
    action: 'capability-granted',
    entityType: 'capability_grant',
    entityId: made.id as string,
    performedBy: caller.id,
    details: { grantee: granteeId, capability: wanted, expires_at: expires },
  });

  return NextResponse.json({ ok: true, grant: made });
}
