// ---------------------------------------------------------------------------
// THE APPOINTMENT PIPELINE — one route, one action per call.
//
//   POST /api/appointments  { action, ... }
//
//   draft    { …the appointment }              → draft-appointment
//   edit     { id, …the appointment }          → draft-appointment
//   submit   { id }                            → draft-appointment
//   decide   { id, decision:'approve'|'return', reason? }
//                                              → authorize-appointment
//   amend    { id, reason }                    → draft-appointment
//   close    { id, outcome, reason }           → authorize-appointment
//
// ---------------------------------------------------------------------------
// WHY ONE ROUTE
// ---------------------------------------------------------------------------
//
// The same reason as /api/announcements and for the same demonstrated cost:
// when this system had two endpoints doing one job, which document an admitted
// student received depended on which desk the approver was sitting at. The
// history write is the part that must never be forgotten, and six routes means
// six places to forget it.
//
// ---------------------------------------------------------------------------
// THE SALARY IS ITS OWN CAPABILITY
// ---------------------------------------------------------------------------
//
// An HR assistant who may record an appointment should not thereby be able to
// decide what somebody is paid. A caller without 'set-remuneration' can write
// every other field; the pay fields are ignored rather than refused, so the
// rest of their work is saved and the screen tells them what was not.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { guard } from '@/lib/adminAuth';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';
import { can, type Capability } from '@/lib/roles';
import type { UserRole } from '@/lib/types';
import {
  isEmploymentType, missingFrom, blocked, canEdit, canSubmit, canAuthorize,
  canRequestAmendment, canClose, MIN_AMENDMENT_REASON, MIN_CLOSURE_REASON, MIN_RETURN_REASON,
  type AppointmentEvent,
} from '@/lib/appointments';

export const runtime = 'nodejs';

const CAPABILITY: Record<string, Capability> = {
  draft: 'draft-appointment' as Capability,
  edit: 'draft-appointment' as Capability,
  submit: 'draft-appointment' as Capability,
  amend: 'draft-appointment' as Capability,
  decide: 'authorize-appointment' as Capability,
  close: 'authorize-appointment' as Capability,
};

// eslint-disable-next-line max-len
const COLUMNS = 'id, full_name, email, phone, postal_address, position_title, unit_name, employment_type, start_date, end_date, effective_date, probation_months, place_of_duty, reports_to_name, working_hours, appointing_authority, authority_decided_on, terms, salary_amount, salary_currency, salary_period, status, drafted_by, authorized_by, authorized_at, issued_at';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

/** The fields a drafter may set. Pay is handled separately and deliberately. */
function fieldsFrom(body: Record<string, unknown>) {
  const text = (k: string) => {
    const v = body[k];
    return v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim();
  };
  return {
    full_name: text('fullName'),
    email: text('email'),
    phone: text('phone'),
    postal_address: text('postalAddress'),
    position_title: text('positionTitle'),
    unit_name: text('unitName'),
    employment_type: text('employmentType'),
    start_date: text('startDate'),
    end_date: text('endDate'),
    effective_date: text('effectiveDate'),
    probation_months: body.probationMonths == null || body.probationMonths === ''
      ? null : Number(body.probationMonths),
    place_of_duty: text('placeOfDuty'),
    reports_to_name: text('reportsToName'),
    working_hours: text('workingHours'),
    appointing_authority: text('appointingAuthority'),
    authority_decided_on: text('authorityDecidedOn'),
    terms: text('terms'),
  };
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  const capability = CAPABILITY[action];
  if (!capability) {
    return bad('unknown-action', 400,
      `Not an appointment action. They are: ${Object.keys(CAPABILITY).join(', ')}.`);
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
    id: string, event: AppointmentEvent,
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

  const load = async (id: unknown) => {
    if (typeof id !== 'string' || !id) return null;
    const { data } = await admin.from('appointments').select(COLUMNS).eq('id', id).maybeSingle();
    return data as Record<string, unknown> | null;
  };

  // =========================================================================
  // DRAFT and EDIT
  // =========================================================================
  if (action === 'draft' || action === 'edit') {
    const fields = fieldsFrom(body);
    if (fields.employment_type && !isEmploymentType(fields.employment_type)) {
      return bad('unknown-employment-type', 400,
        'That is not one of the employment types the University uses.');
    }

    // THE PAY IS A SEPARATE AUTHORITY. Ignored rather than refused, so an HR
    // assistant's other work is saved and the screen can tell them which part
    // was not — refusing the whole save would teach them to ask somebody else
    // to type the entire record.
    const maySetPay = can(caller.role as UserRole, 'set-remuneration' as Capability);
    const pay = maySetPay ? {
      salary_amount: body.salaryAmount == null || body.salaryAmount === ''
        ? null : Number(body.salaryAmount),
      salary_currency: body.salaryCurrency ? String(body.salaryCurrency) : null,
      salary_period: body.salaryPeriod ? String(body.salaryPeriod) : null,
    } : {};

    let id: string;
    let previous: Record<string, unknown> | null = null;

    if (action === 'edit') {
      previous = await load(body.id);
      if (!previous) return bad('appointment-not-found', 404);
      if (!canEdit(previous)) {
        return bad('not-editable', 409,
          `This appointment is ${String(previous.status).replace(/_/g, ' ')}. Only a draft can `
          + 'be edited — what was approved is what is issued. To change an issued appointment, '
          + 'request an amendment.');
      }
      const { error } = await admin.from('appointments')
        .update({ ...fields, ...pay, updated_at: new Date().toISOString() })
        .eq('id', previous.id as string);
      if (error) return bad(`not-saved: ${error.message}`, 500);
      id = previous.id as string;
    } else {
      const { data, error } = await admin.from('appointments')
        .insert({ ...fields, ...pay, drafted_by: caller.id, status: 'draft' })
        .select('id').single();
      if (error || !data) return bad(`not-saved: ${error?.message ?? 'no row'}`, 500);
      id = data.id as string;
    }

    const saved = await load(id);
    await record(id, action === 'edit' ? 'EDITED' : 'DRAFTED',
      (previous?.status as string) ?? null, 'draft');

    return NextResponse.json({
      ok: true,
      id,
      // SAID BEFORE ANYBODY APPROVES IT, all of it at once. Somebody completing
      // a record should be told everything outstanding, not sent back for the
      // second thing after fixing the first.
      missing: missingFrom(saved ?? {}),
      ...(maySetPay ? {} : {
        payNotSaved: true,
        detail: 'Everything except the remuneration was saved. Setting pay is a separate '
          + 'authority and your role does not hold it.',
      }),
    });
  }

  // =========================================================================
  // SUBMIT
  // =========================================================================
  if (action === 'submit') {
    const row = await load(body.id);
    if (!row) return bad('appointment-not-found', 404);
    if (!canSubmit(row)) {
      const m = missingFrom(row);
      return NextResponse.json({
        ok: false,
        error: blocked(m) ? 'not-complete' : 'not-a-draft',
        missing: m,
        detail: blocked(m)
          ? 'The appointment is not complete, and a letter cannot be generated from it.'
          : `This appointment is ${String(row.status).replace(/_/g, ' ')}.`,
      }, { status: 409 });
    }
    const { error } = await admin.from('appointments')
      .update({ status: 'submitted', updated_at: new Date().toISOString() })
      .eq('id', row.id as string);
    if (error) return bad(`not-submitted: ${error.message}`, 500);
    await record(row.id as string, 'SUBMITTED_FOR_AUTHORITY', 'draft', 'submitted');
    return NextResponse.json({ ok: true, status: 'submitted' });
  }

  // =========================================================================
  // DECIDE — the second pair of eyes
  // =========================================================================
  if (action === 'decide') {
    const row = await load(body.id);
    if (!row) return bad('appointment-not-found', 404);
    const decision = String(body.decision ?? '');
    if (decision !== 'approve' && decision !== 'return') return bad('unknown-decision', 400);

    if (!canAuthorize(row, caller.id)) {
      return bad(
        row.drafted_by === caller.id ? 'cannot-approve-your-own' : 'not-awaiting-approval',
        409,
        row.drafted_by === caller.id
          ? 'You drafted this appointment, so you cannot be the second pair of eyes on it. An '
            + 'appointment letter commits the University to paying somebody.'
          : `This appointment is ${String(row.status).replace(/_/g, ' ')}, not awaiting approval.`,
      );
    }

    if (decision === 'return') {
      const reason = String(body.reason ?? '').trim();
      if (reason.length < MIN_RETURN_REASON) {
        return bad('return-needs-a-reason', 400,
          'Say what needs changing. The drafter cannot fix what they were not told.');
      }
      const { error } = await admin.from('appointments')
        .update({ status: 'draft', updated_at: new Date().toISOString() })
        .eq('id', row.id as string);
      if (error) return bad(`not-returned: ${error.message}`, 500);
      await record(row.id as string, 'RETURNED', row.status as string, 'draft', reason);
      return NextResponse.json({ ok: true, status: 'draft' });
    }

    const { error } = await admin.from('appointments').update({
      status: 'approved', authorized_by: caller.id, authorized_at: new Date().toISOString(),
    }).eq('id', row.id as string);
    if (error) return bad(`not-approved: ${error.message}`, 500);
    await record(row.id as string, 'AUTHORIZED', row.status as string, 'approved');
    return NextResponse.json({
      ok: true,
      status: 'approved',
      detail: 'Approved. The letter has not been generated and nobody has been told — those '
        + 'are separate steps, deliberately.',
    });
  }

  // =========================================================================
  // AMEND — an issued appointment changes
  // =========================================================================
  if (action === 'amend') {
    const row = await load(body.id);
    if (!row) return bad('appointment-not-found', 404);
    if (!canRequestAmendment(row)) {
      return bad('nothing-to-amend', 409,
        `This appointment is ${String(row.status).replace(/_/g, ' ')}. Only one whose letter `
        + 'has been issued can be amended; a draft is simply edited.');
    }
    const reason = String(body.reason ?? '').trim();
    if (reason.length < MIN_AMENDMENT_REASON) {
      return bad('amendment-needs-a-reason', 400,
        'Say what changed. Somebody is holding the letter as it was sent, and they are about '
        + 'to receive a second one.');
    }
    const { error } = await admin.from('appointments').update({
      status: 'amendment_requested',
      amendment_reason: reason,
      amendment_requested_by: caller.id,
      amendment_requested_at: new Date().toISOString(),
    }).eq('id', row.id as string);
    if (error) return bad(`not-amended: ${error.message}`, 500);
    await record(row.id as string, 'EDITED', row.status as string, 'amendment_requested', reason);
    return NextResponse.json({
      ok: true,
      status: 'amendment_requested',
      detail: 'An amendment needs approval by somebody other than whoever asked for it, then a '
        + 'new version of the letter. Version 1 is not touched.',
    });
  }

  // =========================================================================
  // CLOSE
  // =========================================================================
  if (action === 'close') {
    const row = await load(body.id);
    if (!row) return bad('appointment-not-found', 404);
    if (!canClose(row)) return bad('already-closed', 409);

    const outcome = String(body.outcome ?? '');
    if (!['declined', 'withdrawn', 'ended'].includes(outcome)) {
      return bad('unknown-outcome', 400,
        'An appointment closes because the appointee declined, the University withdrew it, or '
        + 'it ran its course. Those are three different facts and the record keeps them apart.');
    }
    const reason = String(body.reason ?? '').trim();
    if (reason.length < MIN_CLOSURE_REASON) return bad('closure-needs-a-reason', 400);

    const now = new Date().toISOString();
    const { error } = await admin.from('appointments').update({
      status: outcome,
      closed_reason: reason,
      closed_at: now,
      ...(outcome === 'declined' ? { declined_at: now } : {}),
    }).eq('id', row.id as string);
    if (error) return bad(`not-closed: ${error.message}`, 500);

    await record(row.id as string,
      outcome === 'declined' ? 'DECLINED' : outcome === 'withdrawn' ? 'WITHDRAWN' : 'ENDED',
      row.status as string, outcome, reason);
    return NextResponse.json({ ok: true, status: outcome });
  }

  return bad('unknown-action', 400);
}
