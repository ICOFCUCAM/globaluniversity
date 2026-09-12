// ---------------------------------------------------------------------------
// THE APPOINTMENT LETTER — generated, archived, issued, delivered.
//
//   POST /api/appointments/letter  { action, id, ... }
//
//   generate { id }            → draft-appointment        HR produces the document
//   issue    { id }            → issue-appointment-letter the VC sends it
//   email    { id }            → issue-appointment-letter retry a failed delivery
//   amend    { id, reason }    → issue-appointment-letter a new version
//
// ---------------------------------------------------------------------------
// THE ORDER OF THESE FOUR OPERATIONS IS THE WHOLE DESIGN
// ---------------------------------------------------------------------------
//
//   1. archive the document        — if this fails, nothing else has happened
//   2. mark the appointment issued — 047 refuses this without step 1
//   3. write the history
//   4. send the email              — and if THIS fails, nothing is undone
//
// The University's rule: "If email fails, do not reverse the appointment." So
// delivery is last and its failure is recorded rather than propagated. An
// appointment reversed because a mail server was down is a person who was
// appointed and then un-appointed by an SMTP timeout.
//
// ---------------------------------------------------------------------------
// AND EVERY STEP IS RESUMABLE WITHOUT DUPLICATING ANYTHING
// ---------------------------------------------------------------------------
//
// Each action asks what is already true before doing anything. `generate` on an
// appointment that already has a current letter returns that letter rather than
// making a second one; `issue` on an issued appointment re-sends rather than
// re-issuing; `email` is the retry and is the same code path as the first
// attempt. A crash between any two steps leaves the next call able to finish
// the job, which is what the University asked for in scenario F.
//
// ---------------------------------------------------------------------------
// NO SECOND DOCUMENT ENGINE
// ---------------------------------------------------------------------------
//
// The letter comes from appointmentLetter.ts, which composes officialDocument.ts
// — the same press the correspondence letter uses. The mail goes through
// lib/mailer.ts, which already sends admission letters and credentials. Nothing
// here is a parallel implementation of anything.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { guard } from '@/lib/adminAuth';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';
import { UNIVERSITY } from '@/lib/constants';
import { send, mailConfigured } from '@/lib/mailer';
import { appointmentLetterHtml } from '@/lib/appointmentLetter';
import { contentHash } from '@/lib/officialDocument';
import {
  letterReference, printedReference, missingFrom, blocked,
  MIN_AMENDMENT_REASON, type AppointmentEvent,
} from '@/lib/appointments';
import type { Capability } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CAPABILITY: Record<string, Capability> = {
  generate: 'draft-appointment' as Capability,
  issue: 'issue-appointment-letter' as Capability,
  email: 'issue-appointment-letter' as Capability,
  amend: 'issue-appointment-letter' as Capability,
};

// A SINGLE STRING LITERAL. Concatenation collapses the supabase-js row type to
// GenericStringError[], silently and with no error at the call site.
// eslint-disable-next-line max-len
const APPOINTMENT = 'id, full_name, email, postal_address, position_title, unit_name, faculty, employment_type, appointment_action, start_date, end_date, effective_date, probation_months, place_of_duty, reports_to_name, working_hours, appointing_authority, authority_decided_on, terms, salary_amount, salary_currency, salary_period, status, drafted_by, authorized_by, authorized_at, issued_at';
// eslint-disable-next-line max-len
const LETTER = 'id, appointment_id, reference, version, issued_on, html, content_hash, sealed, seal_code, to_email, delivery, delivery_detail, attempts, superseded_at, signatory_name, signatory_role';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

type Row = Record<string, unknown>;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  const capability = CAPABILITY[action];
  if (!capability) {
    return bad('unknown-action', 400,
      `Not a letter action. They are: ${Object.keys(CAPABILITY).join(', ')}.`);
  }

  const g = await guard(request, capability);
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { caller } = g;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return bad('service-role-key-missing', 500);
  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const record = async (
    id: string, event: AppointmentEvent | string,
    from: string | null, to: string | null,
    detail?: string | null, metadata?: Record<string, unknown>,
  ) => {
    const { error } = await admin.from('appointment_events').insert({
      appointment_id: id,
      event,
      actor_id: caller.id,
      actor_email: caller.email ?? null,
      actor_role: caller.role ?? null,
      previous_state: from,
      new_state: to,
      detail: detail ?? null,
      metadata: metadata ?? null,
    });
    return error?.message ?? null;
  };

  const loadAppointment = async (id: unknown): Promise<Row | null> => {
    if (typeof id !== 'string' || !id) return null;
    const { data } = await admin.from('appointments').select(APPOINTMENT).eq('id', id)
      .maybeSingle();
    return (data as Row | null) ?? null;
  };

  /** The letter currently in force for this appointment, if there is one. */
  const currentLetter = async (appointmentId: string): Promise<Row | null> => {
    const { data } = await admin.from('appointment_letters').select(LETTER)
      .eq('appointment_id', appointmentId).is('superseded_at', null).maybeSingle();
    return (data as Row | null) ?? null;
  };

  // -------------------------------------------------------------------------
  // THE REFERENCE, ALLOCATED FROM THE REGISTER
  // -------------------------------------------------------------------------
  //
  // Counted in the database for the same reason correspondence is: two officers
  // generating in the same second both read "six letters this year", both wrote
  // APT-2026-0007, and the second saw a unique-constraint failure at the moment
  // of producing an official document with no idea why.
  const nextReference = async (year: number): Promise<string | null> => {
    const { data } = await admin.from('appointment_letters')
      .select('reference')
      .like('reference', `APT-${year}-%`)
      .order('reference', { ascending: false })
      .limit(1)
      .maybeSingle();
    const last = (data as Row | null)?.reference as string | undefined;
    const n = last ? Number(last.slice(last.lastIndexOf('-') + 1)) + 1 : 1;
    return Number.isFinite(n) ? letterReference(year, n) : null;
  };

  /**
   * Produce the document and put it in the archive.
   *
   * RETURNS THE EXISTING ONE IF THERE IS ONE. Generating twice would leave two
   * letters for one appointment and no answer to which was sent — and this is
   * the call a user makes twice when the first response was slow.
   */
  const generateInto = async (
    appointment: Row, version: number, reason: string | null,
  ): Promise<{ letter: Row } | { error: NextResponse }> => {
    const outstanding = missingFrom(appointment);
    if (blocked(outstanding)) {
      return {
        error: NextResponse.json({
          ok: false, error: 'not-complete', missing: outstanding,
          detail: 'Nothing on an appointment letter is typed by hand, so an incomplete record '
            + 'is an incomplete letter.',
        }, { status: 409 }),
      };
    }

    const year = new Date().getUTCFullYear();
    const reference = await nextReference(year);
    if (!reference) return { error: bad('no-reference', 500) };

    const issuedOn = new Date().toISOString().slice(0, 10);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${UNIVERSITY.website}`;

    // A SPECIMEN SIGNATURE, ONLY THE CALLER'S OWN AND ONLY IF ENABLED. 049
    // keeps it switched off until somebody other than its owner turns it on.
    const { data: spec } = await admin.from('signature_specimens')
      .select('id, image, owner_name, owner_role')
      .eq('owner_id', caller.id).eq('enabled', true).is('revoked_at', null).maybeSingle();
    const sig = spec as Row | null;

    let generated;
    try {
      generated = await appointmentLetterHtml({
        appointment,
        reference,
        issuedOn,
        version,
        signatoryName: String(body.signatoryName ?? sig?.owner_name ?? caller.email ?? ''),
        signatoryRole: String(body.signatoryRole ?? sig?.owner_role ?? 'Registrar'),
        siteUrl,
        signatureImage: (sig?.image as string | undefined) ?? null,
        authorizedOn: (appointment.authorized_at as string | null)?.slice(0, 10) ?? null,
      });
    } catch (e) {
      return { error: bad('not-generated', 409, e instanceof Error ? e.message : String(e)) };
    }

    const { data, error } = await admin.from('appointment_letters').insert({
      appointment_id: appointment.id as string,
      reference,
      version,
      issued_on: issuedOn,
      html: generated.html,
      content_hash: await contentHash(generated.html),
      sealed: !!generated.seal,
      seal_code: generated.seal?.code ?? null,
      to_email: (appointment.email as string | null) ?? null,
      signatory_name: String(body.signatoryName ?? sig?.owner_name ?? caller.email ?? ''),
      signatory_role: String(body.signatoryRole ?? sig?.owner_role ?? 'Registrar'),
      signature_mode: sig?.image ? 'specimen' : 'typed',
      signature_specimen_id: sig?.image ? sig.id : null,
      authorized_on: (appointment.authorized_at as string | null)?.slice(0, 10) ?? null,
      ...(reason ? { supersedes_reason: reason, kind: 'amended' } : {}),
      created_by: caller.id,
    }).select(LETTER).single();

    if (error || !data) return { error: bad(`not-archived: ${error?.message ?? 'no row'}`, 500) };

    await admin.from('appointments').update({
      status: 'letter_generated', letter_generated_at: new Date().toISOString(),
    }).eq('id', appointment.id as string)
      // A STATUS THAT HAS MOVED ON IS NOT DRAGGED BACK. An appointment already
      // issued and accepted must not return to `letter_generated` because
      // somebody regenerated a document.
      .in('status', ['approved', 'draft', 'under_review', 'submitted', 'amendment_requested']);

    await record(appointment.id as string, 'LETTER_GENERATED',
      appointment.status as string, 'letter_generated', reference);

    return { letter: data as Row };
  };

  /**
   * Send the letter, and never undo anything if it fails.
   *
   * THE UNIVERSITY'S RULE, IMPLEMENTED LITERALLY. An appointment reversed
   * because a mail server was down is a person who was appointed and then
   * un-appointed by an SMTP timeout. The attempt is counted, the reason is
   * recorded, and `appointment_letters_outbox` lists what is waiting.
   */
  const deliver = async (appointment: Row, letter: Row) => {
    const to = (letter.to_email ?? appointment.email) as string | null;
    const now = new Date().toISOString();

    if (!to) {
      await admin.from('appointment_letters').update({
        delivery: 'failed',
        delivery_detail: 'No email address is recorded for the appointee. The letter is issued '
          + 'and archived; somebody has to send or post it.',
        last_attempt_at: now,
      }).eq('id', letter.id as string);
      await record(appointment.id as string, 'EMAIL_FAILED', null, null, 'no-address');
      return {
        sent: false,
        reason: 'no-address',
        detail: 'No email address is recorded for the appointee.',
      };
    }

    if (!mailConfigured()) {
      await admin.from('appointment_letters').update({
        delivery: 'failed',
        delivery_detail: 'Outbound mail is not configured on this deployment. The letter is '
          + 'issued and archived; nothing has been sent.',
        last_attempt_at: now,
        queued_at: (letter.queued_at as string | null) ?? now,
      }).eq('id', letter.id as string);
      await record(appointment.id as string, 'EMAIL_FAILED', null, null, 'not-configured');
      return {
        sent: false,
        reason: 'not-configured',
        detail: 'Outbound mail is not configured on this deployment.',
      };
    }

    const printed = printedReference(letter.reference as string);
    const result = await send({
      to,
      office: 'Office of the Vice-Chancellor',
      subject: `Letter of appointment — ${printed}`,
      text: [
        `Dear ${appointment.full_name},`,
        '',
        `Please find attached your letter of appointment as ${appointment.position_title}`
        + `${appointment.unit_name ? ` in the ${appointment.unit_name}` : ''}.`,
        '',
        `Reference: ${printed}`,
        '',
        'You may verify this document independently at '
        + `${UNIVERSITY.website}/verify using the reference above.`,
        '',
        'Please confirm your acceptance in writing.',
        '',
        UNIVERSITY.name,
      ].join('\n'),
      html: letter.html as string,
      attachments: [{
        filename: `${letter.reference}.html`,
        content: letter.html as string,
        contentType: 'text/html; charset=utf-8',
      }],
    });

    const attempts = Number(letter.attempts ?? 0) + 1;
    await admin.from('appointment_letters').update({
      delivery: result.sent ? 'sent' : 'failed',
      delivery_detail: result.sent ? null : (result.detail ?? result.reason ?? 'refused'),
      attempts,
      last_attempt_at: now,
      queued_at: (letter.queued_at as string | null) ?? now,
      ...(result.sent ? { delivered_at: now } : {}),
    }).eq('id', letter.id as string);

    await record(appointment.id as string, result.sent ? 'EMAIL_SENT' : 'EMAIL_FAILED',
      null, null, result.sent ? to : (result.detail ?? result.reason ?? null),
      { attempts });

    // NORMALISED TO ONE SHAPE. `send` returns a union whose failure arm carries
    // a detail and whose success arm does not, so every caller had to narrow it
    // before it could say why a delivery failed — and a caller that forgets
    // reports "failed" with no reason, which is the one thing somebody
    // retrying actually needs.
    return {
      sent: result.sent,
      reason: 'reason' in result ? result.reason : null,
      detail: 'detail' in result ? result.detail : null,
    };
  };

  // =========================================================================
  // GENERATE
  // =========================================================================
  if (action === 'generate') {
    const appointment = await loadAppointment(body.id);
    if (!appointment) return bad('appointment-not-found', 404);

    if (!appointment.authorized_by || !appointment.authorized_at) {
      return bad('not-approved', 409,
        'This appointment has not been approved. Approval and the letter are two acts by two '
        + 'people, and this is the second one asking for the first.');
    }

    // ALREADY DONE IS NOT AN ERROR. This is the call somebody makes twice when
    // the first response was slow, and a second letter for one appointment
    // leaves no answer to which was sent.
    const existing = await currentLetter(appointment.id as string);
    if (existing) {
      return NextResponse.json({
        ok: true,
        alreadyGenerated: true,
        reference: existing.reference,
        printed: printedReference(existing.reference as string),
        version: existing.version,
        detail: 'A letter already exists for this appointment and has not been superseded. It '
          + 'is returned rather than a second one being made — regenerating would leave two '
          + 'documents and no answer to which was sent. To change it, request an amendment.',
      });
    }

    const made = await generateInto(appointment, 1, null);
    if ('error' in made) return made.error;

    return NextResponse.json({
      ok: true,
      reference: made.letter.reference,
      printed: printedReference(made.letter.reference as string),
      version: made.letter.version,
      sealed: made.letter.sealed,
      detail: 'Generated and archived. NOTHING HAS BEEN SENT and nobody is appointed yet — '
        + 'issuing is the Vice-Chancellor’s act and it is separate on purpose.',
    });
  }

  // =========================================================================
  // ISSUE — the Vice-Chancellor's act
  // =========================================================================
  if (action === 'issue') {
    const appointment = await loadAppointment(body.id);
    if (!appointment) return bad('appointment-not-found', 404);

    const letter = await currentLetter(appointment.id as string);
    if (!letter) {
      return bad('no-letter', 409,
        'No letter has been generated for this appointment. 047 refuses an appointment to be '
        + 'marked issued with no document behind it — an appointee holding nothing while the '
        + 'register says a letter went out.');
    }

    // ALREADY ISSUED: this becomes a re-send, not a second issue. The
    // University's scenario F — a crash or a failure after issue must be
    // resumable without duplicating the record.
    if (appointment.issued_at) {
      const result = await deliver(appointment, letter);
      return NextResponse.json({
        ok: true,
        alreadyIssued: true,
        reference: letter.reference,
        delivery: result.sent ? 'sent' : 'failed',
        detail: result.sent
          ? 'This appointment was already issued; the letter has been sent again.'
          : 'This appointment was already issued. The letter is in the archive and the send '
            + 'failed again; it stays in the outbox.',
      });
    }

    const now = new Date().toISOString();
    const { error } = await admin.from('appointments').update({
      status: 'issued', issued_at: now, issued_by: caller.id, updated_at: now,
    }).eq('id', appointment.id as string);
    if (error) return bad(`not-issued: ${error.message}`, 500);

    await record(appointment.id as string, 'LETTER_ISSUED',
      appointment.status as string, 'issued', letter.reference as string);

    // LAST, AND ITS FAILURE UNDOES NOTHING.
    const result = await deliver(appointment, letter);

    return NextResponse.json({
      ok: true,
      status: 'issued',
      reference: letter.reference,
      printed: printedReference(letter.reference as string),
      delivery: result.sent ? 'sent' : 'failed',
      ...(result.sent ? {} : {
        detail: 'The appointment is issued and the letter is archived. The email did not go: '
          + `${result.detail ?? result.reason}. Nothing has been reversed — retry the delivery `
          + 'when the cause is fixed.',
      }),
    });
  }

  // =========================================================================
  // EMAIL — the retry
  // =========================================================================
  if (action === 'email') {
    const appointment = await loadAppointment(body.id);
    if (!appointment) return bad('appointment-not-found', 404);
    if (!appointment.issued_at) {
      return bad('not-issued', 409, 'This appointment has not been issued, so there is nothing '
        + 'to deliver.');
    }
    const letter = await currentLetter(appointment.id as string);
    if (!letter) return bad('no-letter', 409);

    const result = await deliver(appointment, letter);
    return NextResponse.json({
      ok: true,
      delivery: result.sent ? 'sent' : 'failed',
      attempts: Number(letter.attempts ?? 0) + 1,
      ...(result.sent ? {} : { detail: result.detail ?? result.reason }),
    });
  }

  // =========================================================================
  // AMEND — a new version; the original is never touched
  // =========================================================================
  if (action === 'amend') {
    const appointment = await loadAppointment(body.id);
    if (!appointment) return bad('appointment-not-found', 404);

    const reason = String(body.reason ?? '').trim();
    if (reason.length < MIN_AMENDMENT_REASON) {
      return bad('amendment-needs-a-reason', 400,
        'Say what changed. Somebody is holding the letter as it was sent, and they are about '
        + 'to receive a second one.');
    }

    const current = await currentLetter(appointment.id as string);
    if (!current) return bad('nothing-to-amend', 409, 'There is no issued letter to amend.');

    // THE ORIGINAL IS MARKED SUPERSEDED, NEVER EDITED OR DELETED. Somebody is
    // holding it; 041's trigger refuses the edit and this does not attempt one.
    // `superseded_by` IS THE REPLACEMENT LETTER, NOT THE PERSON. It was
    // `caller.id` until the scenario run refused it: the column is a foreign key
    // to appointment_letters, so a user id is simply not a value it can hold.
    // Who did it is in the history, where every other actor is.
    //
    // AND THE ORDER IS FORCED. The partial unique index permits one letter per
    // appointment with `superseded_at is null`, so the old one must be marked
    // superseded BEFORE the new one can be inserted — then pointed at it.
    const now = new Date().toISOString();
    const { error: supersede } = await admin.from('appointment_letters')
      .update({ superseded_at: now })
      .eq('id', current.id as string);
    if (supersede) return bad(`not-superseded: ${supersede.message}`, 500);

    const made = await generateInto(
      appointment, Number(current.version ?? 1) + 1, reason);
    if ('error' in made) {
      // PUT IT BACK. A failed amendment must not leave the appointment with its
      // only letter marked superseded and no replacement — that is a record
      // with no current document, which 047 then refuses to issue from.
      await admin.from('appointment_letters')
        .update({ superseded_at: null, superseded_by: null })
        .eq('id', current.id as string);
      return made.error;
    }

    // Now the old letter can name the one that replaced it.
    await admin.from('appointment_letters')
      .update({ superseded_by: made.letter.id as string })
      .eq('id', current.id as string);

    await record(appointment.id as string, 'LETTER_SUPERSEDED', null, null, reason,
      { from: current.reference, to: made.letter.reference });

    return NextResponse.json({
      ok: true,
      reference: made.letter.reference,
      printed: printedReference(made.letter.reference as string),
      version: made.letter.version,
      supersedes: current.reference,
      detail: `Version ${made.letter.version} is generated and archived. Version `
        + `${current.version} is untouched and remains readable — somebody is holding it. `
        + 'It has not been sent: issuing the new version is a separate act.',
    });
  }

  return bad('unknown-action', 400);
}
