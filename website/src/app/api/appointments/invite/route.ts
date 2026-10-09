// ---------------------------------------------------------------------------
// INVITING AN APPOINTEE TO SUPPLY THEIR OWN PARTICULARS.
//
//   POST /api/appointments/invite  { action: 'issue',  id }
//   POST /api/appointments/invite  { action: 'revoke', id, reason }
//
// ---------------------------------------------------------------------------
// WHY
// ---------------------------------------------------------------------------
//
// The University, looking at eight accepted appointments all reading "None
// recorded": "there should be a button to forward to the participant through
// the various means, whatsapp, text etc, so that they can add their emails,
// and passwords and create their staff records."
//
// 104 gave the officer a form to type an address into. It works, and it still
// requires the officer to HAVE the address — so eight people must be
// telephoned and eight addresses written down and typed in. An address
// transcribed from a phone call is an address that can be wrong, and the first
// anybody knows of it is a welcome letter that never arrives.
//
// The person who knows their own email address is the appointee.
//
// ---------------------------------------------------------------------------
// THIS DOES NOT BREAK "AN OFFICER OPENS IT"
// ---------------------------------------------------------------------------
//
// The University's rule when the staff register was built: "an account that
// springs into existence on acceptance is a live login nobody authorised."
//
// THE AUTHORISING ACT IS THE INVITATION, and it is this route. An officer
// holding `open-staff-record` decides, by name, that this appointee may open
// their own record. Nothing reaches anybody who was not invited.
//
// What the appointee supplies is what only they know. They choose nothing
// about the post — not the title, faculty, employment type, start date or
// staff number — and the claim route does not read those fields if they are
// sent.
//
// ---------------------------------------------------------------------------
// THE LINK
// ---------------------------------------------------------------------------
//
// 32 random bytes, base64url. It is returned here ONCE and never stored: 107
// keeps only its SHA-256, and refuses any value that is not a 64-character
// digest, so a route that one day forgot to hash would be stopped by the
// database rather than quietly filing a live credential in plain text.
//
// Good once, expiring, bound to one appointment, revocable, and attempts are
// counted — because a link being guessed at looks exactly like a link being
// used unless somebody is counting.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { guard, audit } from '@/lib/adminAuth';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';
import { UNIVERSITY } from '@/lib/constants';
import { whatsappNumber, whatsappUrl } from '@/lib/whatsapp';
import { invitationMessage, joinUrl, INVITATION_DAYS } from '@/lib/invitations';
import type { Capability } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CAPABILITY: Record<string, Capability> = {
  issue: 'open-staff-record' as Capability,
  revoke: 'open-staff-record' as Capability,
};

// eslint-disable-next-line max-len
const APPOINTMENT = 'id, full_name, email, phone, position_title, unit_name, faculty, employment_type, start_date, status';

type Row = Record<string, unknown>;

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

const service = () => createClient(
  SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  const capability = CAPABILITY[action];
  if (!capability) {
    return bad('unknown-action', 400,
      'An invitation is issued or revoked. They are: issue, revoke.');
  }

  const g = await guard(request, capability);
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: 'Inviting an appointee to open their own staff record is the same authority as '
        + 'opening it for them: the Academic Office, the Registrar and the Vice-Chancellor.',
    }, { status: g.status });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return bad('service-role-key-missing', 500);

  return action === 'issue' ? issue(body, g.caller) : revoke(body, g.caller);
}


// ---------------------------------------------------------------------------

async function issue(body: Record<string, unknown>, caller: { id: string }) {
  const admin = service();
  const id = String(body.id ?? '');
  if (!id) return bad('no-appointment', 400, 'Which appointment?');

  const { data: found } = await admin
    .from('appointments').select(APPOINTMENT).eq('id', id).maybeSingle();
  const a = found as Row | null;
  if (!a) return bad('no-such-appointment', 404, 'That appointment is not in the register.');

  // ---- NOT BEFORE THEY HAVE ACCEPTED ------------------------------------
  if (!['accepted', 'active'].includes(String(a.status))) {
    return bad('not-accepted', 409,
      `${String(a.full_name)} has not accepted this appointment — it stands at `
      + `"${String(a.status)}". Inviting somebody to open a staff record for a post they have `
      + 'not taken up is inviting them to join the University on their own say-so.');
  }

  // ---- NOR AFTER THE RECORD EXISTS --------------------------------------
  const { data: already } = await admin
    .from('staff_records').select('id, staff_number').eq('appointment_id', id).maybeSingle();
  if (already) {
    return bad('already-on-the-register', 409,
      `${String(a.full_name)} is already on the staff register as `
      + `${String((already as Row).staff_number)}. There is nothing for them to open.`);
  }

  // ---- ONE LIVE INVITATION AT A TIME ------------------------------------
  //
  // 107 holds a partial unique index on it. Said here first, because an
  // officer told `unique_violation` learns nothing — and an EXPIRED one is
  // replaced rather than complained about, which is what somebody clicking
  // "invite again" three weeks later means.
  const { data: live } = await admin
    .from('appointment_invitations')
    .select('id, expires_at')
    .eq('appointment_id', id)
    .is('claimed_at', null).is('revoked_at', null)
    .maybeSingle();

  if (live) {
    const expires = new Date(String((live as Row).expires_at));
    if (expires > new Date()) {
      return bad('already-invited', 409,
        `${String(a.full_name)} already has a live invitation, good until `
        + `${expires.toLocaleDateString('en-GB')}. Revoke it before sending another, so there `
        + 'is one link in the world rather than two.');
    }
    // SPENT BY TIME. Revoked rather than deleted: an invitation that expired
    // unused is a thing that happened.
    await admin.from('appointment_invitations')
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by: caller.id,
        revoked_reason: 'Expired unused; replaced by a new invitation.',
      })
      .eq('id', String((live as Row).id));
  }

  // ---- THE SECRET -------------------------------------------------------
  //
  // Returned once, in this response, and never stored. What goes in the table
  // is the digest; 107 refuses anything that is not one.
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const expiresAt = new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000);

  const { data: made, error } = await admin
    .from('appointment_invitations')
    .insert({
      appointment_id: id,
      token_hash: tokenHash,
      issued_by: caller.id,
      expires_at: expiresAt.toISOString(),
    })
    .select('id, expires_at')
    .maybeSingle();

  if (error) return bad('not-issued', 500, error.message);

  await audit(admin, {
    action: 'STAFF_INVITATION_ISSUED',
    entityType: 'appointment',
    entityId: id,
    performedBy: caller.id,
    // THE TOKEN IS NOT IN THE AUDIT EITHER. An audit trail that carries live
    // credentials is a second place they can leak from.
    details: { invitationId: (made as Row | null)?.id, expiresAt: expiresAt.toISOString() },
  }).catch(() => { /* the invitation is the record; the log is a courtesy */ });

  const url = joinUrl(token);
  const message = invitationMessage({
    name: String(a.full_name),
    positionTitle: String(a.position_title),
    unitName: (a.unit_name as string | null) ?? null,
    university: UNIVERSITY.name,
    url,
    days: INVITATION_DAYS,
  });

  // ---- READY TO SEND, BY WHATEVER MEANS ---------------------------------
  //
  // The University asked for "whatsapp, text etc". Each of these is a link the
  // officer's own device opens in its own app — the University sends nothing
  // and claims no delivery, exactly as the letter's WhatsApp handover does.
  const number = whatsappNumber(String(body.phone ?? '').trim() || String(a.phone ?? ''));

  return NextResponse.json({
    ok: true,
    invitationId: (made as Row | null)?.id,
    url,
    message,
    expiresAt: expiresAt.toISOString(),
    share: {
      whatsapp: number ? whatsappUrl(number, message) : null,
      sms: `sms:${number ? `+${number}` : ''}?&body=${encodeURIComponent(message)}`,
      email: `mailto:${String(a.email ?? '')}`
        + `?subject=${encodeURIComponent(`Your ${UNIVERSITY.name} staff account`)}`
        + `&body=${encodeURIComponent(message)}`,
    },
    number,
    detail: `A one-time link for ${String(a.full_name)}, good for ${INVITATION_DAYS} days. `
      + 'Send it by whichever means reaches them. It can be used once, it carries nothing '
      + 'about the post, and the University keeps no copy of it — so if it is lost, revoke it '
      + 'and send another rather than looking it up.',
  });
}


// ---------------------------------------------------------------------------

async function revoke(body: Record<string, unknown>, caller: { id: string }) {
  const admin = service();
  const id = String(body.id ?? '');
  if (!id) return bad('no-appointment', 400, 'Which appointment?');

  const reason = String(body.reason ?? '').trim() || 'Withdrawn by the University.';

  const { data: live } = await admin
    .from('appointment_invitations')
    .select('id')
    .eq('appointment_id', id)
    .is('claimed_at', null).is('revoked_at', null)
    .maybeSingle();

  if (!live) {
    return bad('nothing-live', 409,
      'There is no live invitation for that appointment. One that has already been used '
      + 'cannot be revoked — the account exists, and suspending it is a different act.');
  }

  const { error } = await admin
    .from('appointment_invitations')
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: caller.id,
      revoked_reason: reason,
    })
    .eq('id', String((live as Row).id));

  if (error) return bad('not-revoked', 500, error.message);

  await audit(admin, {
    action: 'STAFF_INVITATION_REVOKED',
    entityType: 'appointment',
    entityId: id,
    performedBy: caller.id,
    details: { invitationId: (live as Row).id, reason },
  }).catch(() => { /* as above */ });

  return NextResponse.json({
    ok: true,
    detail: 'Revoked. The link no longer opens anything, wherever it has been forwarded to. '
      + 'Send another when you are ready.',
  });
}
