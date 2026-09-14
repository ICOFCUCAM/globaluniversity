// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY CHARGES, AND WHETHER A STUDENT IS CLEAR.
//
//   POST /api/finance/fees  { action, ... }
//
//   THE SCHEDULE — the Superadministrator's, and nobody else's
//     schedule-add       { name, sessionLabel, programmeId?, awardLevel?, studyMode?, note? }
//     schedule-set       { scheduleId, ...the same fields }
//     schedule-publish   { scheduleId }
//     schedule-withdraw  { scheduleId, reason }
//     item-add           { scheduleId, label, category, amount, currency, charged, mandatory? }
//     item-set           { itemId, ...the same fields }
//     item-remove        { itemId }
//
//   THE INVOICE — Finance's
//     assess             { studentId, scheduleId, sessionLabel, semester?, itemIds[], dueOn? }
//     waive              { assessmentId, waived, reason }
//     cancel             { assessmentId, reason }
//
//   THE CLEARANCE — Finance's, and it gates a degree
//     clear              { studentId, purpose, reason? }
//     refuse             { studentId, purpose, reason }
//     revoke             { clearanceId, reason }
//
// ---------------------------------------------------------------------------
// THREE CAPABILITIES, BECAUSE THEY ARE THREE DIFFERENT ACTS
// ---------------------------------------------------------------------------
//
// Deciding what the University charges, charging a particular student, and
// saying that a particular student is square with the University are not the
// same power and should not be one.
//
// `set-fee-schedule`            the Superadministrator. The University said so.
// `generate-invoice`            Finance. It already existed and the Finance
//                               Director already held it — charging a student
//                               against somebody else's schedule is exactly
//                               what it is for, and a new capability over the
//                               same act would have been duplication.
// `confirm-financial-clearance` Finance. Separate from the above because it
//                               gates a degree: the office that records a
//                               payment and the office that says a graduand is
//                               clear happen to be the same office, but the
//                               acts are not.
//
// ---------------------------------------------------------------------------
// THE ROUTE NEVER DECIDES WHAT THE DATABASE DECIDES
// ---------------------------------------------------------------------------
//
// Every rule that matters here is a CHECK constraint in 075: a fee must be
// positive, a waiver needs a reason and cannot exceed the bill, a clearance
// against an outstanding balance needs a reason, a refusal needs a reason.
// This file checks the same things first only so the caller gets a sentence
// instead of a constraint name. If the two ever disagree the database wins,
// which is the right way round — a route can be bypassed by anything holding
// the service key.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard, audit } from '@/lib/adminAuth';
import type { Capability } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

const SCHEDULE_ACTIONS = ['schedule-add', 'schedule-set', 'schedule-publish',
  'schedule-withdraw', 'item-add', 'item-set', 'item-remove'];
const INVOICE_ACTIONS = ['assess', 'waive', 'cancel'];
const CLEARANCE_ACTIONS = ['clear', 'refuse', 'revoke'];
// ---------------------------------------------------------------------------
// RECORDING A PAYMENT, WHICH USED TO HAPPEN IN THE BROWSER.
//
// `FeeModule.tsx` inserted straight into `payments` with the publishable key
// and made up its own receipt number from `Date.now()`. Two things were wrong
// with that and 088 closes both: the table is no longer writable from a
// session, and the reference is reserved by the database.
// ---------------------------------------------------------------------------
const PAYMENT_ACTIONS = ['receipt'];
const ACTIONS = [...SCHEDULE_ACTIONS, ...INVOICE_ACTIONS, ...CLEARANCE_ACTIONS,
  ...PAYMENT_ACTIONS];

const CURRENCIES = ['FCFA', 'USD', 'EUR', 'GBP', 'NGN'];
const CATEGORIES = ['tuition', 'registration', 'examination', 'books', 'housing',
  'library', 'technology', 'graduation', 'other'];
const CHARGED = ['per-year', 'per-semester', 'once'];
const AWARD_LEVELS = ['Certificate', 'Diploma', "Bachelor's", 'Postgraduate Diploma',
  "Master's", 'Doctorate'];
const MODES = ['Full-time', 'Part-time'];
const PURPOSES = ['graduation', 'registration', 'transcript', 'general'];

/** The same minimum 075 enforces, so the refusal carries an explanation. */
const MIN_REASON = 10;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  if (!ACTIONS.includes(action)) {
    return bad('unknown-action', 400, `They are: ${ACTIONS.join(', ')}.`);
  }

  // WHICH CAPABILITY THIS ACTION NEEDS, chosen before the guard runs so that
  // the guard is given the real one rather than a lowest common denominator.
  const capability: Capability = (
    SCHEDULE_ACTIONS.includes(action) ? 'set-fee-schedule'
      : INVOICE_ACTIONS.includes(action) ? 'generate-invoice'
        : PAYMENT_ACTIONS.includes(action) ? 'verify-payment'
          : 'confirm-financial-clearance'
  ) as Capability;

  const g = await guard(request, capability);
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: SCHEDULE_ACTIONS.includes(action)
        ? 'Setting the University’s fees is the Superadministrator’s. Charging a student '
          + 'against a schedule, and clearing one, are the Finance Office’s.'
        : CLEARANCE_ACTIONS.includes(action)
          ? 'Financial clearance is recorded by the Finance Office. It gates a degree, so it is '
            + 'a capability of its own rather than part of managing an account.'
          : 'Raising a fee against a student is the Finance Office’s.',
    }, { status: g.status });
  }
  const { caller, admin } = g;

  const reasonOf = (key = 'reason') => String(body[key] ?? '').trim();

  // =========================================================================
  // THE SCHEDULE
  // =========================================================================
  if (action === 'schedule-add' || action === 'schedule-set') {
    const name = body.name === undefined ? undefined : String(body.name).trim();
    const sessionLabel = body.sessionLabel === undefined
      ? undefined : String(body.sessionLabel).trim();

    if (action === 'schedule-add' && (!name || !sessionLabel)) {
      return bad('incomplete', 400,
        'A schedule needs a name and the session it applies to.');
    }
    if (name !== undefined && (name.length < 3 || name.length > 120)) {
      return bad('bad-name', 400, 'A schedule’s name is between 3 and 120 characters.');
    }

    const awardLevel = body.awardLevel === undefined || body.awardLevel === null
      || body.awardLevel === '' ? null : String(body.awardLevel);
    if (awardLevel !== null && !AWARD_LEVELS.includes(awardLevel)) {
      return bad('bad-award-level', 400, `They are: ${AWARD_LEVELS.join(', ')}.`);
    }
    const studyMode = body.studyMode === undefined || body.studyMode === null
      || body.studyMode === '' ? null : String(body.studyMode);
    if (studyMode !== null && !MODES.includes(studyMode)) {
      return bad('bad-study-mode', 400, `They are: ${MODES.join(', ')}.`);
    }

    const fields: Record<string, unknown> = {};
    if (name !== undefined) fields.name = name;
    if (sessionLabel !== undefined) fields.session_label = sessionLabel;
    if (body.programmeId !== undefined) {
      fields.programme_id = body.programmeId ? String(body.programmeId) : null;
    }
    if (body.awardLevel !== undefined) fields.award_level = awardLevel;
    if (body.studyMode !== undefined) fields.study_mode = studyMode;
    if (body.note !== undefined) fields.note = body.note ? String(body.note) : null;

    if (action === 'schedule-set') {
      const id = String(body.scheduleId ?? '');
      if (!id) return bad('no-schedule', 400);
      if (Object.keys(fields).length === 0) return bad('nothing-to-change', 400);
      // EDITING A PUBLISHED SCHEDULE DOES NOT RE-PRICE ANYTHING ALREADY
      // INVOICED — 075's assessments are snapshots — but it does change what
      // the next invoice will say, so it is recorded like any other decision.
      fields.set_by = caller.id;
      fields.set_at = new Date().toISOString();
      const { error } = await admin.from('fee_schedules').update(fields).eq('id', id);
      if (error) return bad('schedule-failed', 409, error.message);
      await audit(admin, {
        action: 'fee-schedule-changed', entityType: 'fee_schedule', entityId: id,
        performedBy: caller.id, details: fields,
      });
      return NextResponse.json({ ok: true });
    }

    const { data, error } = await admin.from('fee_schedules')
      .insert({ ...fields, status: 'draft', set_by: caller.id })
      .select('id').single();
    if (error) return bad('schedule-failed', 409, error.message);
    await audit(admin, {
      action: 'fee-schedule-drafted', entityType: 'fee_schedule',
      entityId: data.id as string, performedBy: caller.id, details: fields,
    });
    return NextResponse.json({ ok: true, id: data.id });
  }

  if (action === 'schedule-publish' || action === 'schedule-withdraw') {
    const id = String(body.scheduleId ?? '');
    if (!id) return bad('no-schedule', 400);
    const publishing = action === 'schedule-publish';

    if (publishing) {
      // A SCHEDULE WITH NO LINES CHARGES NOTHING, and publishing one would
      // produce invoices for zero — which reads to a student as "the
      // University says I owe nothing" rather than "somebody has not finished
      // typing".
      const { count } = await admin.from('fee_items')
        .select('id', { count: 'exact', head: true }).eq('schedule_id', id);
      if ((count ?? 0) === 0) {
        return bad('no-items', 400,
          'This schedule has no fees on it yet. Publishing it would charge every student '
          + 'nothing, which reads as a statement that nothing is owed.');
      }
    } else if (reasonOf().length < MIN_REASON) {
      return bad('withdraw-needs-a-reason', 400,
        'Say why this schedule is being withdrawn. Fees the University has published and then '
        + 'taken back are the ones people ask about.');
    }

    const { error } = await admin.from('fee_schedules').update(
      publishing
        ? { status: 'published', published_by: caller.id,
            published_at: new Date().toISOString() }
        : { status: 'withdrawn' },
    ).eq('id', id);
    if (error) return bad('not-changed', 409, error.message);
    await audit(admin, {
      action: publishing ? 'fee-schedule-published' : 'fee-schedule-withdrawn',
      entityType: 'fee_schedule', entityId: id, performedBy: caller.id,
      details: publishing ? {} : { reason: reasonOf() },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === 'item-add' || action === 'item-set' || action === 'item-remove') {
    if (action === 'item-remove') {
      const id = String(body.itemId ?? '');
      if (!id) return bad('no-item', 400);
      const { error } = await admin.from('fee_items').delete().eq('id', id);
      if (error) return bad('not-removed', 409, error.message);
      await audit(admin, {
        action: 'fee-item-removed', entityType: 'fee_item', entityId: id,
        performedBy: caller.id,
      });
      return NextResponse.json({ ok: true });
    }

    const label = body.label === undefined ? undefined : String(body.label).trim();
    if (action === 'item-add' && !label) return bad('no-label', 400, 'A fee needs a name.');

    let amount: number | undefined;
    if (body.amount !== undefined) {
      amount = Number(body.amount);
      // ZERO AND NEGATIVE BOTH REFUSED, and the message says why rather than
      // repeating the constraint. A fee of zero is a line somebody meant to
      // delete, and it makes a student wonder what it is.
      if (!Number.isFinite(amount) || amount <= 0) {
        return bad('bad-amount', 400,
          'A fee is an amount above zero. A line charging nothing is one to remove rather than '
          + 'to set to zero.');
      }
    }
    if (action === 'item-add' && amount === undefined) {
      return bad('no-amount', 400, 'A fee needs an amount.');
    }

    const currency = body.currency === undefined ? undefined : String(body.currency);
    if (currency !== undefined && !CURRENCIES.includes(currency)) {
      return bad('bad-currency', 400, `They are: ${CURRENCIES.join(', ')}.`);
    }
    const category = body.category === undefined ? undefined : String(body.category);
    if (category !== undefined && !CATEGORIES.includes(category)) {
      return bad('bad-category', 400, `They are: ${CATEGORIES.join(', ')}.`);
    }
    const charged = body.charged === undefined ? undefined : String(body.charged);
    if (charged !== undefined && !CHARGED.includes(charged)) {
      return bad('bad-charged', 400, `They are: ${CHARGED.join(', ')}.`);
    }

    const fields: Record<string, unknown> = {};
    if (label !== undefined) fields.label = label;
    if (amount !== undefined) fields.amount = amount;
    if (currency !== undefined) fields.currency = currency;
    if (category !== undefined) fields.category = category;
    if (charged !== undefined) fields.charged = charged;
    if (body.mandatory !== undefined) fields.mandatory = Boolean(body.mandatory);
    if (body.note !== undefined) fields.note = body.note ? String(body.note) : null;
    if (body.sortOrder !== undefined) fields.sort_order = Number(body.sortOrder) || 0;

    if (action === 'item-set') {
      const id = String(body.itemId ?? '');
      if (!id) return bad('no-item', 400);
      if (Object.keys(fields).length === 0) return bad('nothing-to-change', 400);
      const { error } = await admin.from('fee_items').update(fields).eq('id', id);
      if (error) return bad('not-changed', 409, error.message);
      await audit(admin, {
        action: 'fee-item-changed', entityType: 'fee_item', entityId: id,
        performedBy: caller.id, details: fields,
      });
      return NextResponse.json({ ok: true });
    }

    const scheduleId = String(body.scheduleId ?? '');
    if (!scheduleId) return bad('no-schedule', 400);
    const { data, error } = await admin.from('fee_items')
      .insert({ schedule_id: scheduleId, ...fields }).select('id').single();
    if (error) return bad('not-added', 409, error.message);
    await audit(admin, {
      action: 'fee-item-added', entityType: 'fee_item', entityId: data.id as string,
      performedBy: caller.id, details: { scheduleId, ...fields },
    });
    return NextResponse.json({ ok: true, id: data.id });
  }

  // =========================================================================
  // THE INVOICE
  // =========================================================================
  if (action === 'assess') {
    const studentId = String(body.studentId ?? '');
    const scheduleId = String(body.scheduleId ?? '');
    const sessionLabel = String(body.sessionLabel ?? '').trim();
    const itemIds = Array.isArray(body.itemIds) ? body.itemIds.map(String) : [];
    if (!studentId || !scheduleId || !sessionLabel) {
      return bad('incomplete', 400,
        'Charging a student needs the student, the schedule and the session.');
    }
    if (itemIds.length === 0) {
      return bad('no-items', 400, 'Choose which fees to charge.');
    }

    // ONLY FROM A PUBLISHED SCHEDULE. A draft is somebody still typing, and
    // invoicing from one puts a half-considered figure on a student's account.
    const { data: sched } = await admin.from('fee_schedules')
      .select('id, status').eq('id', scheduleId).maybeSingle();
    if (!sched) return bad('no-such-schedule', 404);
    if ((sched as Record<string, unknown>).status !== 'published') {
      return bad('schedule-not-published', 409,
        'This schedule has not been published, so it is not yet what the University charges.');
    }

    const { data: items, error: itemsErr } = await admin.from('fee_items')
      .select('id, label, category, amount, currency')
      .eq('schedule_id', scheduleId).in('id', itemIds);
    if (itemsErr) return bad('items-unreadable', 500, itemsErr.message);
    if (!items || items.length === 0) {
      return bad('no-such-items', 404, 'None of those fees is on that schedule.');
    }

    const semester = body.semester === undefined || body.semester === null
      ? null : Number(body.semester);
    const dueOn = body.dueOn ? String(body.dueOn) : null;

    // THE SNAPSHOT, and it is the whole reason this is an INSERT of copied
    // values rather than a row pointing at the schedule. See 075's header.
    const rows = (items as Record<string, unknown>[]).map((i) => ({
      student_id: studentId,
      schedule_id: scheduleId,
      item_id: i.id as string,
      session_label: sessionLabel,
      semester,
      label: i.label as string,
      category: i.category as string,
      amount: i.amount as number,
      currency: i.currency as string,
      due_on: dueOn,
      raised_by: caller.id,
    }));

    const { error } = await admin.from('student_fee_assessments').insert(rows);
    if (error) {
      // 075 refuses the same fee twice for the same student and term. Say so
      // in words — a finance office unpicking duplicate invoices is the thing
      // that constraint exists to prevent.
      return bad('not-raised', 409, /duplicate|unique/i.test(error.message)
        ? 'One or more of these fees has already been charged to this student for this session. '
          + 'Nothing was raised; charging the same fee twice is refused.'
        : error.message);
    }
    await audit(admin, {
      action: 'fees-assessed', entityType: 'student', entityId: studentId,
      performedBy: caller.id, details: { sessionLabel, semester, count: rows.length },
    });
    return NextResponse.json({ ok: true, raised: rows.length });
  }

  if (action === 'waive' || action === 'cancel') {
    const id = String(body.assessmentId ?? '');
    if (!id) return bad('no-assessment', 400);
    const reason = reasonOf();
    if (reason.length < MIN_REASON) {
      return bad('needs-a-reason', 400,
        action === 'waive'
          ? 'Say why this is being waived. A reduction with no reason beside it is one nobody '
            + 'can account for later.'
          : 'Say why this charge is being cancelled.');
    }

    if (action === 'cancel') {
      const { error } = await admin.from('student_fee_assessments')
        .update({ status: 'cancelled', cancel_reason: reason }).eq('id', id);
      if (error) return bad('not-cancelled', 409, error.message);
      await audit(admin, {
        action: 'fee-cancelled', entityType: 'fee_assessment', entityId: id,
        performedBy: caller.id, details: { reason },
      });
      return NextResponse.json({ ok: true });
    }

    const waived = Number(body.waived);
    if (!Number.isFinite(waived) || waived <= 0) {
      return bad('bad-waiver', 400, 'A waiver is an amount above zero.');
    }
    const { error } = await admin.from('student_fee_assessments')
      .update({ waived, waiver_reason: reason, waived_by: caller.id }).eq('id', id);
    if (error) {
      return bad('not-waived', 409, /waiver_within/i.test(error.message)
        ? 'That is more than the student was charged. A waiver reduces a bill; it cannot turn '
          + 'one into a credit.'
        : error.message);
    }
    await audit(admin, {
      action: 'fee-waived', entityType: 'fee_assessment', entityId: id,
      performedBy: caller.id, details: { waived, reason },
    });
    return NextResponse.json({ ok: true });
  }

  // =========================================================================
  // THE CLEARANCE
  // =========================================================================
  if (action === 'clear' || action === 'refuse') {
    const studentId = String(body.studentId ?? '');
    if (!studentId) return bad('no-student', 400);
    const purpose = String(body.purpose ?? 'graduation');
    if (!PURPOSES.includes(purpose)) {
      return bad('bad-purpose', 400, `They are: ${PURPOSES.join(', ')}.`);
    }
    const reason = reasonOf();
    const clearing = action === 'clear';

    if (!clearing && reason.length < MIN_REASON) {
      return bad('refusal-needs-a-reason', 400,
        'Say why clearance is refused. A student refused with no explanation cannot do anything '
        + 'about it.');
    }

    // ---- WHAT THE LEDGER SAYS, READ HERE AND COPIED ONTO THE DECISION ----
    //
    // READ SERVER-SIDE, never taken from the request. A balance the caller
    // supplies is a balance the caller can choose, and this figure is the
    // evidence that the decision was taken with the account in view.
    //
    // The largest outstanding line: a student with two currencies has two, and
    // the one that matters to a clearance is the biggest debt.
    const { data: account } = await admin.from('student_fee_account')
      .select('currency, outstanding')
      .eq('student_id', studentId)
      .order('outstanding', { ascending: false })
      .limit(1);
    const line = (account ?? [])[0] as Record<string, unknown> | undefined;
    const outstanding = line ? Number(line.outstanding) : 0;
    const currency = line ? String(line.currency) : null;

    if (clearing && outstanding > 0 && reason.length < MIN_REASON) {
      return bad('clearance-against-a-balance-needs-a-reason', 409,
        `This student still owes ${outstanding} ${currency ?? ''}. Clearing them anyway is a `
        + 'legitimate decision — a waiver, a scholarship, an instalment agreement — but it has '
        + 'to say which.');
    }

    const { data, error } = await admin.from('financial_clearances').insert({
      student_id: studentId,
      purpose,
      cleared: clearing,
      outstanding_at_decision: outstanding,
      currency,
      reason: reason || null,
      decided_by: caller.id,
    }).select('id').single();
    if (error) return bad('not-recorded', 409, error.message);

    await audit(admin, {
      action: clearing ? 'financial-clearance-given' : 'financial-clearance-refused',
      entityType: 'student', entityId: studentId, performedBy: caller.id,
      details: { purpose, outstanding, currency, reason: reason || null },
    });
    return NextResponse.json({
      ok: true,
      id: data.id,
      outstanding,
      currency,
      detail: clearing && outstanding > 0
        ? 'Recorded. The graduation screen will show this clearance WITH the outstanding balance '
          + 'and your reason beside it, rather than as a plain tick.'
        : 'Recorded.',
    });
  }

  if (action === 'revoke') {
    const id = String(body.clearanceId ?? '');
    if (!id) return bad('no-clearance', 400);
    const reason = reasonOf();
    if (reason.length < MIN_REASON) {
      return bad('revoke-needs-a-reason', 400,
        'Say why this clearance no longer stands. Somebody may already have relied on it.');
    }
    // THE ROW IS NOT DELETED. A clearance that was given and taken back is a
    // fact about the University's dealings with a student, and deleting it
    // would leave a graduand who was cleared last month looking as though they
    // never were.
    const { error } = await admin.from('financial_clearances').update({
      revoked_at: new Date().toISOString(),
      revoked_by: caller.id,
      revoke_reason: reason,
    }).eq('id', id);
    if (error) return bad('not-revoked', 409, error.message);
    await audit(admin, {
      action: 'financial-clearance-revoked', entityType: 'financial_clearance',
      entityId: id, performedBy: caller.id, details: { reason },
    });
    return NextResponse.json({ ok: true });
  }

  // =========================================================================
  // TAKING A PAYMENT
  // =========================================================================
  if (action === 'receipt') {
    const studentId = String(body.studentId ?? '').trim();
    const amount = Number(body.amount);
    const currency = String(body.currency ?? '').trim();
    const purpose = String(body.purpose ?? '').trim();
    const method = String(body.method ?? '').trim() || null;

    if (!studentId) return bad('no-student', 400, 'A receipt is made out to somebody.');
    if (!Number.isFinite(amount) || amount <= 0) {
      return bad('bad-amount', 400, 'A payment is an amount above zero.');
    }
    if (!CURRENCIES.includes(currency)) {
      return bad('bad-currency', 400, `They are: ${CURRENCIES.join(', ')}.`);
    }
    if (!purpose) return bad('no-purpose', 400, 'Say what the money is for.');

    // THE REFERENCE IS THE DATABASE'S TO GIVE. 088's counter is incremented
    // inside the statement that reads it, so two officers taking money in the
    // same moment cannot be handed the same number — which `Date.now()` in the
    // browser could not promise, against a UNIQUE column.
    const { data: ref, error: refError } = await admin
      .rpc('reserve_receipt_number', { p_year: new Date().getUTCFullYear() });
    if (refError || !ref) {
      return bad('no-reference', 503, refError?.message
        ?? 'No receipt number could be reserved, so nothing was recorded.');
    }

    const { data: row, error } = await admin.from('payments').insert({
      student_id: studentId,
      reference: ref as string,
      amount,
      currency,
      purpose,
      method,
      received_by: caller.id,
    }).select('id, reference').single();

    // A PAYMENT THAT FAILED TO RECORD MUST NEVER LOOK RECORDED. The officer
    // has the student in front of them and has taken the money.
    if (error) return bad('not-recorded', 409, error.message);

    await audit(admin, {
      action: 'payment-recorded', entityType: 'payment',
      entityId: row.id, performedBy: caller.id,
      details: { reference: row.reference, amount, currency, purpose },
    });
    return NextResponse.json({ ok: true, reference: row.reference });
  }

  // Unreachable: every action in ACTIONS is handled above. Kept so that adding
  // one to the list without writing it fails loudly rather than returning 200.
  return bad('unhandled-action', 500,
    `"${action}" is a known action with no handler. That is a bug in this route.`);
}
