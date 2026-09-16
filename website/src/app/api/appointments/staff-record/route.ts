// ---------------------------------------------------------------------------
// FROM AN ACCEPTED APPOINTMENT TO THE STAFF REGISTER, AND THEN TO A LOGIN.
//
//   POST /api/appointments/staff-record  { action: 'create', id, email, ... }
//   POST /api/appointments/staff-record  { action: 'account', staffRecordId }
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
// NOTHING IS RETYPED HERE. Every field comes from the appointment the
// University already approved. What the officer supplies is what the
// appointment never captured — see below.
//
// ---------------------------------------------------------------------------
// AND THEN THE UNIVERSITY SPLIT IT IN TWO
// ---------------------------------------------------------------------------
//
//   "Appointment → Accepted → Create Staff Record → Staff Record → Staff
//    Account. This preserves the distinction between someone who has merely
//    been considered/appointed and someone who has actually entered the
//    university's staff register."
//
// This route used to have ONE action called `open`, and under that one word it
// did four things: issue a staff number, write the register row, create a login
// and open a teaching record. Two of those are the staff record and two are the
// account.
//
// They are now two actions because they are two decisions, and because the
// state between them is one the University has and could not previously
// express: somebody on the staff register who cannot yet sign in.
//
// ---------------------------------------------------------------------------
// THE EMAIL, WHICH IS WHAT THE UNIVERSITY ACTUALLY ASKED ABOUT
// ---------------------------------------------------------------------------
//
// The list said "No email recorded — correct the appointment first" and offered
// no way to correct anything. Six accepted appointees sat behind a disabled
// button holding an instruction and no instrument.
//
// The address is now supplied on the create form, and written to the STAFF
// RECORD — not back onto the appointment. The appointment is a document that
// was issued, accepted and signed; editing it afterwards to add a field would
// make the record disagree with the paper somebody holds. The University's own
// ruling says which of the two is the live one: "the appointment remains part
// of the person's appointment history, while the staff record becomes their
// ongoing institutional staff identity."
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY RULED EARLIER, AND STILL HOLDS
// ---------------------------------------------------------------------------
//
//   AN OFFICER OPENS IT, not the acceptance. So accepting puts somebody on a
//   list and a person decides. An account that springs into existence on
//   acceptance is a live login nobody authorised.
//
//   THE ACADEMIC OFFICE, THE REGISTRAR AND THE VICE-CHANCELLOR may do it. BOTH
//   STAGES ARE GUARDED THE SAME WAY, deliberately: splitting one act into two
//   was the University asking for two decisions, not for the second one to be
//   taken away from the offices that could already take it.
//
//   EVERY APPOINTEE GETS A STAFF NUMBER, whatever their post. The number used
//   to come out of `lecturers`, so a Dean or a Director received an account and
//   no number. 082 moves it to the staff register, which everybody is in.
//
// ---------------------------------------------------------------------------
// AND BOTH STAGES ARE RESUMABLE
// ---------------------------------------------------------------------------
//
// Creating the same record twice returns what is already there rather than
// issuing a second staff number — the unique index in 082 refuses that anyway,
// and a route that relied on the constraint to say so would hand the officer a
// wall of SQL. The account stage is the same: an appointee may already hold an
// account, or a previous attempt may have created one and failed afterwards.
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

// BOTH STAGES, ONE AUTHORITY. See the note above: the University asked for two
// decisions, not for the second to move to a different office.
const CAPABILITY: Record<string, Capability> = {
  create: 'open-staff-record' as Capability,
  account: 'open-staff-record' as Capability,
};

// A SINGLE STRING LITERAL. Concatenation collapses the supabase-js row type to
// GenericStringError[], silently and with no error at the call site.
// eslint-disable-next-line max-len
const APPOINTMENT = 'id, full_name, email, phone, postal_address, position_title, position_id, unit_name, faculty, department_id, employment_type, start_date, status, accepted_at';
// eslint-disable-next-line max-len
const RECORD = 'id, appointment_id, auth_user_id, staff_number, full_name, email, phone, position_id, position_title, family, department_id, faculty, employment_type, started_on, lecturer_id';

type Row = Record<string, unknown>;

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

/** Not validation for its own sake: the address becomes a username. */
const looksLikeAnAddress = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/** The service key, checked for by the caller before either stage is entered. */
function service() {
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  const capability = CAPABILITY[action];
  if (!capability) {
    return bad('unknown-action', 400,
      'A staff record is created from an accepted appointment, and an account is opened on '
      + `the record afterwards. They are: ${Object.keys(CAPABILITY).join(', ')}.`);
  }

  const g = await guard(request, capability);
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: 'Putting somebody on the staff register is held by the Academic Office, the '
        + 'Registrar and the Vice-Chancellor. It is not something the office that drafted the '
        + 'appointment does on its own.',
    }, { status: g.status });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return bad('service-role-key-missing', 500);

  return action === 'create'
    ? createRecord(body, g.caller)
    : openAccount(body, g.caller);
}


// ---------------------------------------------------------------------------
// STAGE ONE — THE STAFF RECORD
//
// Everything about the post comes from the appointment. Everything about
// REACHING the person comes from the officer, because the appointment form has
// never required it and an appointment can be issued, signed and accepted on
// paper without an email address ever being typed.
// ---------------------------------------------------------------------------

async function createRecord(body: Record<string, unknown>, caller: { id: string }) {
  // BUILT HERE RATHER THAN PASSED IN. A supabase-js client crossing a parameter
  // boundary loses its schema generics — every `.insert()` then takes `never`
  // and every row comes back as `GenericStringError`. Same reason `SELECT` is a
  // single string literal a few lines up.
  const admin = service();
  const id = String(body.id ?? '');
  if (!id) return bad('no-appointment', 400, 'Which appointment?');

  const { data: found } = await admin
    .from('appointments').select(APPOINTMENT).eq('id', id).maybeSingle();
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

  // ---- ALREADY ON THE REGISTER? Return it, never a second number ---------
  const { data: already } = await admin.from('staff_records')
    .select(RECORD).eq('appointment_id', id).maybeSingle();
  if (already) {
    const r = already as Row;
    return NextResponse.json({
      ok: true,
      alreadyOpen: true,
      staffRecordId: r.id,
      staffNumber: r.staff_number,
      hasAccount: Boolean(r.auth_user_id),
      detail: `${String(a.full_name)} is already on the staff register as `
        + `${String(r.staff_number)}. Nothing was changed.`,
    });
  }

  // ---- WHAT THE OFFICER SUPPLIES ----------------------------------------
  //
  // The form arrives pre-filled from the appointment, so in the ordinary case
  // these are the appointment's own values sent straight back. Where the
  // appointment has no address — which is the case the University asked about
  // — this is where it is recorded, and there is nowhere else it could be.
  const email = String(body.email ?? a.email ?? '').trim().toLowerCase();
  if (email && !looksLikeAnAddress(email)) {
    return bad('not-an-address', 400,
      `"${email}" is not an email address. It becomes this person's username, so it has to `
      + 'be one they can actually receive mail at.');
  }

  // AN ADDRESS IS NOT REQUIRED TO BE ON THE REGISTER. It is required to have a
  // login, and that is the next stage. Somebody appointed on paper, whose
  // address the office is still chasing, belongs on the staff register today —
  // that state is the reason the University asked for two stages.
  const phone = String(body.phone ?? a.phone ?? '').trim() || null;
  const postal = String(body.postalAddress ?? a.postal_address ?? '').trim() || null;
  const departmentId = String(body.departmentId ?? a.department_id ?? '').trim() || null;

  // ---- THE FAMILY, FROM THE POST ----------------------------------------
  const { data: post } = await admin.from('positions')
    .select('family, job_code').eq('id', String(a.position_id ?? '')).maybeSingle();
  const family = ((post as Row | null)?.family as string | null) ?? null;

  // ---- THE NUMBER, FROM THE REGISTER ------------------------------------
  const { data: numbered, error: numErr } = await admin.rpc('next_staff_number', {});
  if (numErr || !numbered) {
    return bad('no-staff-number', 500,
      `A staff number could not be issued: ${numErr?.message ?? 'nothing came back'}. `
      + 'Has migration 082 been run?');
  }
  const staffNumber = String(numbered);

  const { data: rec, error: recErr } = await admin.from('staff_records').insert({
    appointment_id: id,
    // NO ACCOUNT YET, AND THAT IS THE POINT. 104 permits this and refuses the
    // reverse: an account on a record with no address.
    auth_user_id: null,
    staff_number: staffNumber,
    full_name: a.full_name,
    email: email || null,
    phone,
    postal_address: postal,
    position_id: a.position_id ?? null,
    position_title: a.position_title,
    family,
    department_id: departmentId,
    faculty: a.faculty ?? null,
    employment_type: a.employment_type ?? null,
    started_on: a.start_date ?? null,
    opened_by: caller.id,
  }).select(RECORD).maybeSingle();

  if (recErr) return bad('not-registered', 500, recErr.message);
  const r = rec as Row;

  await audit(admin, {
    action: 'STAFF_RECORD_CREATED',
    entityType: 'staff_record',
    entityId: staffNumber,
    performedBy: caller.id,
    details: { appointmentId: id, family, hasEmail: Boolean(email) },
  }).catch(() => { /* the register is the record; the log is a courtesy */ });

  return NextResponse.json({
    ok: true,
    staffRecordId: r.id,
    staffNumber,
    ready: Boolean(email),
    detail: `${String(a.full_name)} is on the staff register as ${staffNumber}.`
      + (email
        ? ' They can now be given a staff account.'
        : ' They have no email address recorded, so no account can be opened yet — a staff '
          + 'account is reached at an email address. Add one to the record when you have it.'),
  });
}


// ---------------------------------------------------------------------------
// STAGE TWO — THE ACCOUNT
//
// Opened on the staff record, not on the appointment. By this point the
// register is the authority on who this person is, which is the University's
// own ruling and the reason a correction made to the record after appointment
// is the one that reaches the account.
// ---------------------------------------------------------------------------

async function openAccount(body: Record<string, unknown>, caller: { id: string }) {
  // Built here, not passed in — see the note in createRecord.
  const admin = service();
  const recordId = String(body.staffRecordId ?? '');
  if (!recordId) return bad('no-record', 400, 'Which staff record?');

  const { data: found } = await admin
    .from('staff_records').select(RECORD).eq('id', recordId).maybeSingle();
  const r = found as Row | null;
  if (!r) return bad('no-such-record', 404, 'That staff record is not in the register.');

  if (r.auth_user_id) {
    return NextResponse.json({
      ok: true,
      alreadyOpen: true,
      staffNumber: r.staff_number,
      username: r.email,
      detail: `${String(r.full_name)} already has a staff account. Nothing was changed.`,
    });
  }

  // ---- THE ADDRESS ------------------------------------------------------
  //
  // Correctable here, because this is the stage that needs it and the office
  // may only have obtained it since the record was created. 104 refuses the
  // account without one in the database as well.
  const supplied = String(body.email ?? '').trim().toLowerCase();
  const email = supplied || String(r.email ?? '').trim().toLowerCase();

  if (!email) {
    return bad('no-email', 409,
      `The University has no email address for ${String(r.full_name)}, and the username of a `
      + 'staff account is their email address. Record one on the staff record first.');
  }
  if (!looksLikeAnAddress(email)) {
    return bad('not-an-address', 400,
      `"${email}" is not an email address. It becomes this person's username, so it has to `
      + 'be one they can actually receive mail at.');
  }

  // ---- THE ROLE COMES FROM THE POST, NOT FROM A DROPDOWN -----------------
  //
  // The family the University filed the post under decides what the account may
  // do. A dropdown here would let somebody appointed to a lectureship be given
  // a Registrar's account without anybody approving that.
  const family = (r.family as string | null) ?? null;
  const role = roleForFamily(family);
  const staffNumber = String(r.staff_number);

  // ---- THE ACCOUNT ------------------------------------------------------
  //
  // The username is the email; the password is generated once, sent in the
  // welcome email, and never stored. Nothing anywhere in this system can show
  // it again, which is deliberate.
  const password = generatePassword();
  const metadata = { full_name: r.full_name, role, staff_id: staffNumber };

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
    if (!existing) return bad('account-not-created', 500, authErr.message);
    authUserId = existing.id;
    await admin.auth.admin.updateUserById(existing.id, {
      password, email_confirm: true, user_metadata: metadata,
    });
  }

  const { error: profErr } = await admin.from('profiles')
    .upsert({ id: authUserId, email, full_name: r.full_name, role }, { onConflict: 'id' });
  if (profErr) return bad('account-created-but-profile-not-created', 500, profErr.message);

  // ---- THE TEACHING RECORD, WHERE THEY TEACH ----------------------------
  //
  // A Dean who lectures has both; a Finance Officer has only the register row.
  // The teaching record is what allocates a course, and it is not what makes
  // somebody staff — which is the distinction 082 exists to draw.
  let lecturerId = (r.lecturer_id as string | null) ?? null;
  if (!lecturerId && TEACHES.includes(family ?? '')) {
    const [first, ...rest] = String(r.full_name).split(/\s+/);
    const { data: lec } = await admin.from('lecturers').insert({
      staff_id: staffNumber,
      first_name: first,
      last_name: rest.join(' ') || first,
      email,
      phone: r.phone ?? null,
      department_id: r.department_id ?? null,
      status: 'active',
      auth_user_id: authUserId,
      appointment_id: r.appointment_id ?? null,
    }).select('id').maybeSingle();
    lecturerId = ((lec as Row | null)?.id as string | null) ?? null;
  }

  const { error: linkErr } = await admin.from('staff_records')
    .update({ auth_user_id: authUserId, email, lecturer_id: lecturerId })
    .eq('id', recordId);
  if (linkErr) {
    return bad('account-created-but-not-linked', 500,
      `${linkErr.message}. The account exists; opening it again will find it and finish the `
      + 'job rather than creating a second one.');
  }

  // ---- AND THE APPOINTMENT LEARNS WHO THEY ARE --------------------------
  //
  // 041's read policy on `appointment_letters` lets the appointee read their
  // own letter when `appointments.person_id` is their account. Until the
  // account is open there IS no account, so the column is empty and the letter
  // is unreadable by the one person it is about. Setting it here is what lets a
  // lecturer open their own letter of appointment from their own screen.
  if (r.appointment_id) {
    await admin.from('appointments')
      .update({ person_id: authUserId }).eq('id', String(r.appointment_id));
    if (lecturerId) {
      await admin.from('appointments')
        .update({ staff_record_id: lecturerId, staff_activated_at: new Date().toISOString() })
        .eq('id', String(r.appointment_id));
    }
  }

  await audit(admin, {
    action: 'STAFF_ACCOUNT_OPENED',
    entityType: 'staff_record',
    entityId: staffNumber,
    performedBy: caller.id,
    details: { staffRecordId: recordId, role, family, teaches: Boolean(lecturerId) },
  }).catch(() => { /* the register is the record; the log is a courtesy */ });

  // ---- AND TELL THEM ----------------------------------------------------
  let delivered = false;
  let deliveryDetail: string | null = null;
  if (mailConfigured()) {
    const out = await send({
      to: email,
      subject: `Your ${UNIVERSITY.name} staff account`,
      text: [
        `Dear ${String(r.full_name)},`,
        '',
        `Your staff account at ${UNIVERSITY.name} is open.`,
        '',
        `Staff number: ${staffNumber}`,
        `Post: ${String(r.position_title)}`,
        `Username: ${email}`,
        `Temporary password: ${password}`,
        '',
        `Sign in at ${UNIVERSITY.website}/portal and change your password.`,
        'This password is temporary and nobody at the University can see it.',
      ].join('\n'),
    }).then(
      (out2) => out2 as { sent: boolean; detail?: string },
      (e: unknown) => ({ sent: false, detail: String(e) }),
    );
    delivered = Boolean(out.sent);
    deliveryDetail = delivered ? null : String(out.detail ?? 'unknown');
  }

  return NextResponse.json({
    ok: true,
    staffNumber,
    username: email,
    role,
    teaches: Boolean(lecturerId),
    delivered,
    // THE PASSWORD COMES BACK ONLY WHERE THE EMAIL DID NOT GO. Otherwise an
    // appointee's credentials would sit in a browser's network log for no
    // reason. Where mail is not configured the officer has to be able to hand
    // it over, or the account is unreachable.
    ...(delivered ? {} : { password, deliveryDetail }),
    detail: `${String(r.full_name)} can now sign in as ${email}.`
      + (delivered
        ? ' Their username and a temporary password have been emailed to them.'
        : ' The welcome email could not be sent, so the temporary password is shown here — '
          + 'give it to them directly. It cannot be shown again.'),
  });
}
