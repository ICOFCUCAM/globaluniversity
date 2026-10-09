// ---------------------------------------------------------------------------
// AN APPOINTEE OPENS THEIR OWN STAFF RECORD.
//
//   POST /api/appointments/join  { action: 'look',  token }
//   POST /api/appointments/join  { action: 'claim', token, email, phone, password }
//
// ---------------------------------------------------------------------------
// THE ONE ROUTE IN THIS SYSTEM WITH NO `guard()`
// ---------------------------------------------------------------------------
//
// Every other write in this application begins by asking who the caller is.
// This one cannot: the person opening it has no account yet — opening one is
// the whole point — so there is nobody to ask about.
//
// THE TOKEN IS THE AUTHORITY, and it is the only authority, which is why 107
// makes it 256 bits, stores only its digest, allows it once, expires it, binds
// it to one appointment and lets it be revoked. The officer who issued it made
// the decision; this route carries it out and decides nothing.
//
// ---------------------------------------------------------------------------
// WHAT IT WILL NOT TAKE FROM THE CALLER
// ---------------------------------------------------------------------------
//
// Anything about the post. Not the title, the faculty, the employment type,
// the start date, the staff number or the role. Every one of those is read
// from the appointment the University approved, and the body is not consulted
// for them — not validated and rejected, NOT READ, because a field that is
// read and then checked is a field one careless edit away from being honoured.
//
// The role, in particular, comes from the family the post is filed under.
// Nobody appoints themselves a Registrar by sending a different JSON.
//
// ---------------------------------------------------------------------------
// AND WHAT IT SAYS WHEN IT REFUSES
// ---------------------------------------------------------------------------
//
// The same thing every time: the invitation cannot be used. Not "expired", not
// "already claimed", not "no such invitation" — those three answers tell
// somebody working through guessed tokens which guesses are worth repeating.
// The DIFFERENCE is recorded in the attempt count, which the issuing office
// can read and the caller cannot.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';
import { audit } from '@/lib/adminAuth';
import { roleForFamily, TEACHES } from '@/lib/staffRecords';
import { MIN_PASSWORD } from '@/lib/invitations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Row = Record<string, unknown>;

// eslint-disable-next-line max-len
const INVITATION = 'id, appointment_id, issued_by, expires_at, claimed_at, revoked_at, attempts';
// eslint-disable-next-line max-len
const APPOINTMENT = 'id, full_name, phone, postal_address, position_title, position_id, unit_name, faculty, department_id, employment_type, start_date, status';

const service = () => createClient(
  SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/** The one refusal. See the note above: it never says which of the five. */
const noGood = () => NextResponse.json({
  ok: false,
  error: 'invitation-not-usable',
  detail: 'This invitation cannot be used. It may have been used already, withdrawn, or run '
    + 'out of time. The University can send you another — reply to whoever sent you this '
    + 'link and ask.',
}, { status: 403 });

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

const looksLikeAnAddress = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  if (action !== 'look' && action !== 'claim') {
    return bad('unknown-action', 400, 'They are: look, claim.');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return bad('service-role-key-missing', 500);

  const token = String(body.token ?? '');
  // A LENGTH CHECK BEFORE A DATABASE CALL. An empty token is somebody opening
  // /join with no query string, which is not worth a round trip or an attempt.
  if (token.length < 20) return noGood();

  const admin = service();
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const { data: found } = await admin
    .from('appointment_invitations')
    .select(INVITATION)
    .eq('token_hash', tokenHash)
    .maybeSingle();

  const inv = found as Row | null;
  if (!inv) return noGood();

  // EVERY TOUCH IS COUNTED, including the ones that fail. A link being worked
  // at and a link being used look identical unless somebody counts.
  await admin.from('appointment_invitations')
    .update({
      attempts: Number(inv.attempts ?? 0) + 1,
      last_attempt_at: new Date().toISOString(),
    })
    .eq('id', String(inv.id));

  if (inv.claimed_at || inv.revoked_at) return noGood();
  if (new Date(String(inv.expires_at)) <= new Date()) return noGood();

  const { data: appointment } = await admin
    .from('appointments').select(APPOINTMENT).eq('id', String(inv.appointment_id)).maybeSingle();
  const a = appointment as Row | null;
  if (!a || !['accepted', 'active'].includes(String(a.status))) return noGood();

  return action === 'look' ? look(a) : claim(body, inv, a);
}


// ---------------------------------------------------------------------------
// LOOK — what the page shows before anybody types anything.
//
// JUST ENOUGH FOR THEM TO KNOW IT IS THEIRS, and no more. Their name and their
// post, which they already know, so the page can prove it is about them. Not
// their address, not their telephone, not their salary: a link forwarded to
// the wrong number should not read out somebody's particulars to a stranger.
// ---------------------------------------------------------------------------

function look(a: Row) {
  return NextResponse.json({
    ok: true,
    fullName: a.full_name,
    positionTitle: a.position_title,
    unitName: a.unit_name ?? null,
    faculty: a.faculty ?? null,
    employmentType: a.employment_type ?? null,
    startDate: a.start_date ?? null,
  });
}


// ---------------------------------------------------------------------------
// CLAIM — the staff record and the account, in one act, on the officer's
// authority and with the appointee's own particulars.
// ---------------------------------------------------------------------------

async function claim(body: Record<string, unknown>, inv: Row, a: Row) {
  const admin = service();

  const email = String(body.email ?? '').trim().toLowerCase();
  const phone = String(body.phone ?? '').trim() || (a.phone as string | null) || null;
  const password = String(body.password ?? '');

  if (!looksLikeAnAddress(email)) {
    return bad('not-an-address', 400,
      'That does not look like an email address. It becomes the username you sign in with, so '
      + 'it has to be one you can actually receive mail at.');
  }
  if (password.length < MIN_PASSWORD) {
    return bad('password-too-short', 400,
      `Choose a password of at least ${MIN_PASSWORD} characters. Nobody at the University can `
      + 'see it, which also means nobody can tell you what it was.');
  }

  // ---- THE ADDRESS MUST NOT ALREADY BE SOMEBODY ------------------------
  //
  // An appointee typing an address that already holds an account would
  // otherwise have their password reset onto somebody else's login. Refused
  // and said plainly, because the honest cause is usually that they already
  // have an account.
  const { data: list } = await admin.auth.admin.listUsers();
  if (list?.users?.some((u) => (u.email ?? '').toLowerCase() === email)) {
    return bad('address-already-in-use', 409,
      'There is already a University account at that address. If it is yours, sign in with it '
      + 'instead; if you think it is not, tell the office that sent you this link.');
  }

  // ---- THE POST IS THE UNIVERSITY'S, NOT THE CALLER'S -------------------
  //
  // Read from the appointment. `body` is not consulted for any of it.
  const { data: post } = await admin.from('positions')
    .select('family').eq('id', String(a.position_id ?? '')).maybeSingle();
  const family = ((post as Row | null)?.family as string | null) ?? null;
  const role = roleForFamily(family);

  const { data: numbered, error: numErr } = await admin.rpc('next_staff_number', {});
  if (numErr || !numbered) {
    return bad('no-staff-number', 500,
      'A staff number could not be issued. Nothing was created; tell the office that sent you '
      + 'this link and they will try again.');
  }
  const staffNumber = String(numbered);

  // ---- THE ACCOUNT, WITH THE PASSWORD THEY CHOSE ------------------------
  const { data: made, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: a.full_name, role, staff_id: staffNumber },
  });
  if (authErr || !made?.user) {
    return bad('account-not-created', 500,
      'The account could not be created. Nothing was changed; the link still works, so please '
      + 'try again.');
  }
  const authUserId = made.user.id;

  const { error: profErr } = await admin.from('profiles')
    .upsert({ id: authUserId, email, full_name: a.full_name, role }, { onConflict: 'id' });
  if (profErr) return bad('account-created-but-incomplete', 500, profErr.message);

  // ---- THE TEACHING RECORD, WHERE THEY TEACH ----------------------------
  let lecturerId: string | null = null;
  if (TEACHES.includes(family ?? '')) {
    const [first, ...rest] = String(a.full_name).split(/\s+/);
    const { data: lec } = await admin.from('lecturers').insert({
      staff_id: staffNumber,
      first_name: first,
      last_name: rest.join(' ') || first,
      email,
      phone,
      department_id: a.department_id ?? null,
      status: 'active',
      auth_user_id: authUserId,
      appointment_id: a.id,
    }).select('id').maybeSingle();
    lecturerId = ((lec as Row | null)?.id as string | null) ?? null;
  }

  // ---- THE REGISTER -----------------------------------------------------
  const { data: rec, error: recErr } = await admin.from('staff_records').insert({
    appointment_id: a.id,
    auth_user_id: authUserId,
    staff_number: staffNumber,
    full_name: a.full_name,
    email,
    phone,
    postal_address: a.postal_address ?? null,
    position_id: a.position_id ?? null,
    position_title: a.position_title,
    family,
    department_id: a.department_id ?? null,
    faculty: a.faculty ?? null,
    employment_type: a.employment_type ?? null,
    started_on: a.start_date ?? null,
    lecturer_id: lecturerId,
    // OPENED BY THE OFFICER WHO INVITED THEM, not by the appointee. The record
    // says whose decision it was, which is the whole of "an officer opens it".
    opened_by: inv.issued_by ?? null,
  }).select('id, staff_number').maybeSingle();

  if (recErr) {
    return bad('account-created-but-not-registered', 500,
      'Your account was created and the staff register could not be written. Tell the office '
      + 'that sent you this link — they can finish it, and you will not need to do this again.');
  }
  const recordId = String((rec as Row).id);

  // ---- THE INVITATION IS SPENT ------------------------------------------
  //
  // 107 refuses a second claim in the database too. This is the row that makes
  // the link dead everywhere it has been forwarded to.
  await admin.from('appointment_invitations')
    .update({
      claimed_at: new Date().toISOString(),
      claimed_email: email,
      staff_record_id: recordId,
    })
    .eq('id', String(inv.id));

  // ---- AND THE APPOINTMENT LEARNS WHO THEY ARE --------------------------
  //
  // 041's policy lets an appointee read their own letter when
  // `appointments.person_id` is their account. Until now there was no account.
  await admin.from('appointments').update({ person_id: authUserId }).eq('id', String(a.id));
  if (lecturerId) {
    await admin.from('appointments')
      .update({ staff_record_id: lecturerId, staff_activated_at: new Date().toISOString() })
      .eq('id', String(a.id));
  }

  // THE INVITING OFFICER IS THE ACTOR, not the appointee. An audit trail that
  // records a new member of staff as the author of their own appointment to
  // the register is a trail that has lost the decision it exists to hold.
  //
  // Where that officer's own account has since been removed, the entry is
  // written against the appointee with `byInvitation` on it rather than
  // skipped: a claim with no audit row at all is worse than one whose actor is
  // the wrong half of the transaction and says so.
  const actor = (inv.issued_by as string | null) ?? authUserId;
  await audit(admin, {
    action: 'STAFF_RECORD_CLAIMED',
    entityType: 'staff_record',
    entityId: staffNumber,
    performedBy: actor,
    details: {
      invitationId: inv.id,
      appointmentId: a.id,
      role,
      byInvitation: true,
      issuingOfficer: (inv.issued_by as string | null) ?? '(no longer an account)',
    },
  }).catch(() => { /* the register is the record; the log is a courtesy */ });

  return NextResponse.json({
    ok: true,
    staffNumber,
    username: email,
    detail: `Thank you. You are on the ${''}staff register as ${staffNumber}, and you can sign `
      + 'in now with the address and password you just chose.',
  });
}
