// ---------------------------------------------------------------------------
// ESTABLISHING AND LEADING A NATIONAL ADMINISTRATION.
//
//   POST /api/national/administration  { action, ... }
//
//     propose    write a country down. No agreement needed yet.
//     appoint    name the Rector, against the appointment they hold
//     agree      record the National Administration Agreement
//     establish  the administration begins operating
//     suspend    withdraw its authority; its records stay
//
// ---------------------------------------------------------------------------
// WHY THIS ROUTE EXISTS WHEN 097 ALREADY ENFORCES ALL OF IT
// ---------------------------------------------------------------------------
//
// 097 refuses an administration established without its agreement, refuses a
// creator who makes themselves Rector, and refuses two live administrations in
// one country. Those hold whatever calls the database.
//
// This is not a second copy of them. It is the door — there was none — and it
// does the one thing a constraint cannot: it answers in sentences. A browser
// told `check_violation` on
// `national_administration_established_has_an_agreement` learns nothing; an
// officer told "this cannot be established until you record the agreement and
// the Rector's appointment" knows what to do next.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard, audit } from '@/lib/adminAuth';
import type { Capability } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

const ACTIONS = ['propose', 'appoint', 'agree', 'establish', 'suspend'] as const;

export async function POST(request: Request) {
  const g = await guard(request, 'establish-national-administration' as Capability);
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: 'Establishing a National Administration commits the University’s name in a '
        + 'country. It belongs to the Superadministrator and the Vice-Chancellor.',
    }, { status: g.status });
  }
  const { caller, admin } = g;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  if (!(ACTIONS as readonly string[]).includes(action)) {
    return bad('unknown-action', 400,
      `A National Administration is ${ACTIONS.join(', ')}.`);
  }

  // ---- PROPOSE ------------------------------------------------------------
  if (action === 'propose') {
    const country = String(body.country ?? '').trim();
    const name = String(body.name ?? '').trim();
    if (country.length < 2) return bad('no-country', 400, 'Which country?');
    if (name.length < 6) {
      return bad('no-name', 400,
        'Give it the name it will carry on a letterhead — "ICOF Global University — National '
        + 'Administration of …".');
    }

    const { data, error } = await admin
      .from('national_administrations')
      .insert({ country, name, created_by: caller.id })
      .select('id')
      .maybeSingle();

    if (error) {
      // 23505 is a unique violation — the one index that can fire here says a
      // live administration already exists for this country.
      if (error.code === '23505') {
        return bad('already-there', 409,
          `${country} already has a live National Administration. Close it before proposing `
          + 'another.');
      }
      return bad('not-recorded', 500, error.message);
    }

    await audit(admin, {
      action: 'national-administration-proposed',
      entityType: 'national_administration',
      entityId: data?.id,
      performedBy: caller.id,
      details: { country, name },
    });
    return NextResponse.json({ ok: true, id: data?.id });
  }

  // ---- everything else acts on one that exists ----------------------------
  const id = String(body.id ?? '');
  if (!id) return bad('no-administration', 400, 'Which National Administration?');

  const { data: nation, error: readError } = await admin
    .from('national_administrations')
    .select('id, country, name, status, rector_id, rector_appointment_id, agreement_reference')
    .eq('id', id)
    .maybeSingle();

  if (readError) return bad('cannot-read', 500, readError.message);
  if (!nation) return bad('no-such-administration', 404, 'There is no administration with that id.');

  const patch: Record<string, unknown> = {};

  if (action === 'appoint') {
    const rectorId = String(body.rectorId ?? '');
    const appointmentId = String(body.appointmentId ?? '');
    if (!rectorId) return bad('no-rector', 400, 'Who is the Rector?');
    if (!appointmentId) {
      return bad('no-appointment', 400,
        'A National Rector’s authority reaches a nation’s students, staff and money, so it '
        + 'traces to an appointment. Draft and issue the appointment first, then name it here.');
    }
    // 097 REFUSES THIS TOO, and says so in a constraint. Said here first
    // because the officer needs the sentence, not the constraint name.
    if (rectorId === caller.id) {
      return bad('not-yourself', 403,
        'You cannot make yourself the Rector of an administration you are establishing. The '
        + 'University appoints its Rectors.');
    }
    patch.rector_id = rectorId;
    patch.rector_appointment_id = appointmentId;
  }

  if (action === 'agree') {
    const reference = String(body.agreementReference ?? '').trim();
    if (reference.length < 3) {
      return bad('no-reference', 400,
        'Record the National Administration Agreement by its reference, so a question about '
        + 'the terms has a document to go to.');
    }
    patch.agreement_reference = reference;
    if (body.agreementDatedOn) patch.agreement_dated_on = String(body.agreementDatedOn);
  }

  if (action === 'establish') {
    // SAID BEFORE THE DATABASE SAYS IT, in the order an officer would fix it.
    if (!nation.agreement_reference && !patch.agreement_reference) {
      return bad('no-agreement', 409,
        'Record the National Administration Agreement first. An administration that operates '
        + 'without one has nothing to answer a dispute with.');
    }
    if (!nation.rector_id) {
      return bad('no-rector', 409, 'Name the Rector first.');
    }
    if (!nation.rector_appointment_id) {
      return bad('no-appointment', 409,
        'Name the appointment the Rector holds first.');
    }
    patch.status = 'established';
    patch.established_on = new Date().toISOString().slice(0, 10);
  }

  if (action === 'suspend') {
    const reason = String(body.note ?? '').trim();
    if (reason.length < 10) {
      return bad('no-reason', 400,
        'Say why its authority is being withdrawn. The Rector reads this, and a decision '
        + 'nobody explained is one nobody can answer.');
    }
    patch.status = 'suspended';
    patch.note = reason;
  }

  const { error: writeError } = await admin
    .from('national_administrations')
    .update(patch)
    .eq('id', id);

  if (writeError) {
    return bad('not-recorded', 409, writeError.message);
  }

  await audit(admin, {
    action: `national-administration-${action}`,
    entityType: 'national_administration',
    entityId: id,
    performedBy: caller.id,
    details: { country: nation.country, ...patch },
  });

  return NextResponse.json({ ok: true });
}
