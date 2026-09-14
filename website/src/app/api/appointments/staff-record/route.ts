// ---------------------------------------------------------------------------
// OPENING A STAFF RECORD FROM AN ACCEPTED APPOINTMENT.
//
//   POST /api/appointments/staff-record  { action: 'open', id }
//
// ---------------------------------------------------------------------------
// THE JOIN THAT WAS NEVER THERE
// ---------------------------------------------------------------------------
//
// The University asked: "What about staff accounts, like lecturers and
// professors?"
//
// There were two halves and nothing between them. An appointment was drafted,
// approved, issued and accepted — and then the acceptance page said "Human
// Resources will open your staff record", and somebody OPENED A SEPARATE FORM
// AND RETYPED the name, the email, the title and the department.
//
// That is precisely the fault the appointment letter exists to prevent.
// appointmentLetter.ts opens with it: "a name typed into a letter is a name
// that can differ from the name in the register, and then the University has
// two answers and a signature on the wrong one." Typing it a second time into
// the staff register is the same fault with a different form.
//
// NOTHING HERE IS TYPED. Every field is read from the appointment the
// University already approved. The officer supplies one thing: the decision to
// open it.
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY RULED
// ---------------------------------------------------------------------------
//
//   AN OFFICER OPENS IT, not the acceptance. "An officer opens it" — so
//   accepting puts somebody on a list and a person decides. An account that
//   springs into existence on acceptance is a live login nobody authorised.
//
//   THE ACADEMIC OFFICE, THE REGISTRAR AND THE VICE-CHANCELLOR may do it.
//   Not the Superadministrator alone, which is who could create any account
//   at all before this.
//
//   EVERY APPOINTEE GETS A STAFF NUMBER, whatever their post. The number used
//   to come out of `lecturers`, so a Dean or a Director received an account and
//   no number. 082 moves it to the staff register, which everybody is in.
//
// ---------------------------------------------------------------------------
// AND IT IS RESUMABLE, like every other act in this system
// ---------------------------------------------------------------------------
//
// Four things happen and any of them can fail: the account, the profile, the
// register row, the teaching record. Opening the same appointment twice returns
// what is already there rather than issuing a second staff number — the unique
// index in 082 refuses that anyway, and a route that relied on the constraint
// to say so would hand the officer a wall of SQL.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { guard, audit, generatePassword } from '@/lib/adminAuth';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';
import { send, mailConfigured } from '@/lib/mailer';
import { UNIVERSITY } from '@/lib/constants';
import { roleForFamily, TEACHES } from '@/lib/staffRecords';
import type { Capability } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CAPABILITY: Record<string, Capability> = {
  open: 'open-staff-record' as Capability,
};

// A SINGLE STRING LITERAL. Concatenation collapses the supabase-js row type to
// GenericStringError[], silently and with no error at the call site.
// eslint-disable-next-line max-len
const APPOINTMENT = 'id, full_name, email, phone, postal_address, position_title, position_id, unit_name, faculty, department_id, employment_type, start_date, status, accepted_at';

type Row = Record<string, unknown>;

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  const capability = CAPABILITY[action];
  if (!capability) {
    return bad('unknown-action', 400,
      `Not a staff-record action. They are: ${Object.keys(CAPABILITY).join(', ')}.`);
  }

  const g = await guard(request, capability);
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: 'Opening a staff record is held by the Academic Office, the Registrar and the '
        + 'Vice-Chancellor. It creates a University login, so it is not something the office '
        + 'that drafted the appointment does on its own.',
    }, { status: g.status });
  }
  const { caller } = g;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return bad('service-role-key-missing', 500);
  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const id = String(body.id ?? '');
  if (!id) return bad('no-appointment', 400, 'Which appointment?');

  const { data: found } = await admin.from('appointments').select(APPOINTMENT).eq('id', id).maybeSingle();
  const a = found as Row | null;
  if (!a) return bad('no-such-appointment', 404, 'That appointment is not in the register.');

  // ---- NOT BEFORE THEY HAVE ACCEPTED ------------------------------------
  //
  // 082 refuses this in the database too. Here so the officer gets a sentence
  // rather than a trigger's exception.
  if (!['accepted', 'active'].includes(String(a.status))) {
    return bad('not-accepted', 409,
      `${String(a.full_name)} has not accepted this appointment — it stands at `
      + `"${String(a.status)}". Being appointed and being on the staff register are two `
      + 'separate steps, and the second follows the first.');
  }

  // ---- ALREADY OPEN? Return it rather than issuing a second number -------
  const { data: already } = await admin.from('staff_records')
    .select('id, staff_number, email, auth_user_id')
    .eq('appointment_id', id).maybeSingle();
  if (already) {
    const r = already as Row;
    return NextResponse.json({
      ok: true,
      alreadyOpen: true,
      staffNumber: r.staff_number,
      username: r.email,
      detail: `${String(a.full_name)} is already on the staff register as `
        + `${String(r.staff_number)}. Nothing was changed.`,
    });
  }

  const email = String(a.email ?? '').trim().toLowerCase();
  if (!email) {
    return bad('no-email', 409,
      `The University has no email address for ${String(a.full_name)}, and the username of a `
      + 'staff account is their email. Correct the appointment record first.');
  }

  // ---- THE ROLE COMES FROM THE POST, NOT FROM A DROPDOWN -----------------
  //
  // The family the University filed the post under decides what the account may
  // do. A dropdown here would let somebody appointed to a lectureship be given
  // a Registrar's account without anybody approving that.
  const { data: post } = await admin.from('positions')
    .select('family, job_code').eq('id', String(a.position_id ?? '')).maybeSingle();
  const family = ((post as Row | null)?.family as string | null) ?? null;
  const role = roleForFamily(family);

  // ---- THE NUMBER, FROM THE REGISTER ------------------------------------
  const { data: numbered, error: numErr } = await admin.rpc('next_staff_number', {});
  if (numErr || !numbered) {
    return bad('no-staff-number', 500,
      `A staff number could not be issued: ${numErr?.message ?? 'nothing came back'}. `
      + 'Has migration 082 been run?');
  }
  const staffNumber = String(numbered);

  // ---- THE ACCOUNT ------------------------------------------------------
  //
  // The username is the email; the password is generated once, sent in the
  // welcome email, and never stored. Nothing anywhere in this system can show
  // it again, which is deliberate.
  const password = generatePassword();
  const metadata = { full_name: a.full_name, role, staff_id: staffNumber };

  const { data: made, error: authErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: metadata,
  });

  let authUserId = made?.user?.id ?? null;

  if (authErr) {
    // ALREADY REGISTERED IS NOT A FAILURE. An appointee may already hold an
    // account — they may have been a student, or a previous attempt may have
    // created the account and then failed on the register row. Find it and
    // carry on rather than refusing a second time forever.
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users?.find((u) => (u.email ?? '').toLowerCase() === email);
    if (!existing) {
      return bad('account-not-created', 500, authErr.message);
    }
    authUserId = existing.id;
    await admin.auth.admin.updateUserById(existing.id, {
      password, email_confirm: true, user_metadata: metadata,
    });
  }

  const { error: profErr } = await admin.from('profiles')
    .upsert({ id: authUserId, email, full_name: a.full_name, role }, { onConflict: 'id' });
  if (profErr) {
    return bad('account-created-but-profile-not-created', 500, profErr.message);
  }

  // ---- THE TEACHING RECORD, WHERE THEY TEACH ----------------------------
  //
  // A Dean who lectures has both; a Finance Officer has only the register row.
  // The teaching record is what allocates a course, and it is not what makes
  // somebody staff — which is the distinction 082 exists to draw.
  let lecturerId: string | null = null;
  if (TEACHES.includes(family ?? '')) {
    const [first, ...rest] = String(a.full_name).split(/\s+/);
    const { data: lec } = await admin.from('lecturers').insert({
      staff_id: staffNumber,
      first_name: first,
      last_name: rest.join(' ') || first,
      email,
      phone: a.phone ?? null,
      department_id: a.department_id ?? null,
      status: 'active',
      auth_user_id: authUserId,
      appointment_id: id,
    }).select('id').maybeSingle();
    lecturerId = ((lec as Row | null)?.id as string | null) ?? null;
  }

  // ---- THE REGISTER -----------------------------------------------------
  const { data: rec, error: recErr } = await admin.from('staff_records').insert({
    appointment_id: id,
    auth_user_id: authUserId,
    staff_number: staffNumber,
    full_name: a.full_name,
    email,
    phone: a.phone ?? null,
    postal_address: a.postal_address ?? null,
    position_id: a.position_id ?? null,
    position_title: a.position_title,
    family,
    department_id: a.department_id ?? null,
    faculty: a.faculty ?? null,
    employment_type: a.employment_type ?? null,
    started_on: a.start_date ?? null,
    lecturer_id: lecturerId,
    opened_by: caller.id,
  }).select('id, staff_number').maybeSingle();

  if (recErr) {
    return bad('account-created-but-not-registered', 500,
      `${recErr.message}. The account exists; opening the record again will find it and `
      + 'finish the job rather than creating a second one.');
  }

  // The teaching record, where there is one, is what 042's column names.
  if (lecturerId) {
    await admin.from('appointments')
      .update({ staff_record_id: lecturerId, staff_activated_at: new Date().toISOString() })
      .eq('id', id);
  }

  await audit(admin, {
    action: 'STAFF_RECORD_OPENED',
    entityType: 'staff_record',
    entityId: staffNumber,
    performedBy: caller.id,
    details: { appointmentId: id, role, family, teaches: Boolean(lecturerId) },
  }).catch(() => { /* the register is the record; the log is a courtesy */ });

  // ---- AND TELL THEM ----------------------------------------------------
  let delivered = false;
  let deliveryDetail: string | null = null;
  if (mailConfigured()) {
    const out = await send({
      to: email,
      subject: `Your ${UNIVERSITY.name} staff account`,
      text: [
        `Dear ${String(a.full_name)},`,
        '',
        `Your staff record at ${UNIVERSITY.name} is open.`,
        '',
        `Staff number: ${staffNumber}`,
        `Post: ${String(a.position_title)}`,
        `Username: ${email}`,
        `Temporary password: ${password}`,
        '',
        `Sign in at ${UNIVERSITY.website}/portal and change your password.`,
        'This password is temporary and nobody at the University can see it.',
      ].join('\n'),
    }).then(
      (r) => r as { sent: boolean; detail?: string },
      (e: unknown) => ({ sent: false, detail: String(e) }),
    );
    delivered = Boolean(out.sent);
    deliveryDetail = delivered ? null : String(out.detail ?? 'unknown');
  }

  return NextResponse.json({
    ok: true,
    staffNumber: ((rec as Row | null)?.staff_number) ?? staffNumber,
    username: email,
    role,
    teaches: Boolean(lecturerId),
    delivered,
    // THE PASSWORD COMES BACK ONLY WHERE THE EMAIL DID NOT GO. Otherwise an
    // appointee's credentials would sit in a browser's network log for no
    // reason. Where mail is not configured the officer has to be able to hand
    // it over, or the account is unreachable.
    ...(delivered ? {} : { password, deliveryDetail }),
    detail: `${String(a.full_name)} is on the staff register as ${staffNumber}.`
      + (delivered
        ? ' Their username and a temporary password have been emailed to them.'
        : ' The welcome email could not be sent, so the temporary password is shown here — '
          + 'give it to them directly. It cannot be shown again.'),
  });
}
