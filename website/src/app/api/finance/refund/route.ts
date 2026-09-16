// ---------------------------------------------------------------------------
// A FEE REFUND.
//
//   POST /api/finance/refund  { action, ... }
//
//     request    Finance records that a refund has been asked for
//     review     it is taken up for review
//     approve    a decision, with an amount and a reason
//     reject     a decision, with a reason
//     except     an exceptional policy is authorised, named and reasoned
//     pay        the money has left the University, with its reference
//     withdraw   the request is taken back before it is decided
//
// ---------------------------------------------------------------------------
// SUBMITTING NEVER REFUNDS ANYBODY
// ---------------------------------------------------------------------------
//
// The University's decision of 16 September 2026, and the reason these are
// seven actions rather than one form with a status dropdown. 102 walks the
// path in the database — submitted → under_review → approved → paid — so a
// caller that skips a step is refused there as well as here. This route says
// it in a sentence first, because an officer told `check_violation` learns
// nothing.
//
// ---------------------------------------------------------------------------
// AND THE DETERMINATION IS NOT THIS ROUTE'S TO MAKE
// ---------------------------------------------------------------------------
//
// Nothing here computes what a student is owed. 102 does it on insert, from
// the payment's own amount and the student's own enrolment date, and refuses
// to let any later hand rewrite it. A determination this route could calculate
// is a determination a different caller could calculate differently.
//
// It is TWO answers, because the University has two rules — the schedule
// published in the Student Fees Guide, and the decision of 16 September. They
// disagree between day 1 and day 90. The lower stands unless an exceptional
// policy is authorised, which is the University's own carve-out and is made to
// cost something: a named policy, an officer, and a time.
//
// ---------------------------------------------------------------------------
// THE PAYMENT IS NEVER TOUCHED
// ---------------------------------------------------------------------------
//
// "The original payment is never modified or deleted. A refund is a
// transaction related to that payment." There is no update to `payments`
// anywhere below, and from 102 there could not be: a trigger refuses one
// whoever asks, including the service key this route holds.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard, audit } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

const MIN_REASON = 20;
const MIN_DECISION = 15;

/** 102's vocabulary. The money goes to a person, and to one of three. */
const DESTINATIONS = ['student', 'parent', 'sponsor'];

const money = (n: number | null | undefined, currency: string) =>
  `${currency} ${Number(n ?? 0).toFixed(2)}`;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  if (action === 'request') return ask(request, body);
  if (!['review', 'approve', 'reject', 'except', 'pay', 'withdraw'].includes(action)) {
    return bad('unknown-action', 400,
      'A refund is requested, reviewed, decided, and then paid. Nothing else happens to one.');
  }
  return act(request, body, action);
}


// ---------------------------------------------------------------------------
// ASKING
// ---------------------------------------------------------------------------

async function ask(request: Request, body: Record<string, unknown>) {
  const g = await guard(request, 'manage-student-accounts');
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: 'Recording a refund request is Finance’s. Approving one is a separate act with a '
        + 'separate authority.',
    }, { status: g.status });
  }
  const { caller, admin } = g;

  const paymentId = String(body.paymentId ?? '');
  const reason = String(body.reason ?? '').trim();
  const destination = String(body.destination ?? 'student');
  const requested = Number(body.amountRequested);

  if (!paymentId) return bad('no-payment', 400, 'Which payment is being refunded?');
  if (reason.length < MIN_REASON) {
    return bad('no-reason', 400,
      `Say why the refund is asked for — at least ${MIN_REASON} characters. This is the part `
      + 'of the record that has to make sense to somebody reading it in five years.');
  }
  if (!DESTINATIONS.includes(destination)) {
    return bad('no-destination', 400,
      'The University refunds electronically to the student’s, parent’s or sponsor’s account, '
      + 'and to nowhere else.');
  }
  if (!Number.isFinite(requested) || requested <= 0) {
    return bad('no-amount', 400, 'How much is being asked for?');
  }

  const { data: payment, error: readError } = await admin
    .from('payments')
    .select('id, student_id, amount, currency, reference, purpose')
    .eq('id', paymentId)
    .maybeSingle();

  if (readError) return bad('cannot-read', 500, readError.message);
  if (!payment) return bad('no-such-payment', 404, 'There is no payment with that id.');
  if (!payment.student_id) {
    return bad('payment-names-nobody', 409,
      'That payment is not attached to a student, so there is nobody to refund it to.');
  }
  if (requested > Number(payment.amount)) {
    return bad('more-than-was-paid', 400,
      `That payment was ${money(payment.amount, payment.currency)}. Nobody is refunded more `
      + 'than they paid.');
  }

  // THE DETERMINATION IS NOT SENT. 102 computes it and would overwrite
  // anything sent anyway; omitting it here is so that a reader of this file is
  // not misled into thinking the browser has a say.
  const { data, error } = await admin
    .from('refund_requests')
    .insert({
      payment_id: paymentId,
      student_id: payment.student_id,
      amount_paid: payment.amount,
      currency: payment.currency,
      amount_requested: requested,
      reason,
      destination,
      requested_by: caller.id,
    })
    // ONE LITERAL — supabase-js reads the row type from it, and a concatenated
    // string comes back as GenericStringError for every column.
    // eslint-disable-next-line max-len
    .select('id, days_since_enrolment, percent_by_schedule, percent_by_policy, eligible_amount, determination, currency, national_share')
    .maybeSingle();

  if (error) {
    // ONE REFUND PER MONTH IS THE UNIVERSITY'S PUBLISHED RULE, and a unique
    // violation is a sentence nobody can act on.
    if (/one_refund_per_student_per_month/.test(error.message)) {
      return bad('already-considered-this-month', 409,
        'This student already has a refund under consideration this month. The University’s '
        + 'published terms consider one refund per month.');
    }
    return bad('not-recorded', 500, error.message);
  }

  await audit(admin, {
    action: 'refund-requested',
    entityType: 'refund_request',
    entityId: data?.id,
    performedBy: caller.id,
    details: {
      payment_reference: payment.reference,
      amount_requested: requested,
      eligible_amount: data?.eligible_amount,
      percent_by_schedule: data?.percent_by_schedule,
      percent_by_policy: data?.percent_by_policy,
    },
  });

  const disagree = data && data.percent_by_schedule !== data.percent_by_policy;

  return NextResponse.json({
    ok: true,
    id: data?.id,
    determination: data?.determination,
    eligibleAmount: data?.eligible_amount,
    rulesDisagree: disagree,
    nationalShare: data?.national_share,
    next: `Recorded, and nothing has been refunded. The determination allows `
      + `${money(data?.eligible_amount, data?.currency ?? '')}`
      + (disagree
        ? ' — and the published schedule and the decision of 16 September 2026 give different '
          + 'answers here, so the lower stands unless an exceptional policy is authorised.'
        : '.'),
  });
}


// ---------------------------------------------------------------------------
// EVERYTHING AFTERWARDS
// ---------------------------------------------------------------------------

async function act(request: Request, body: Record<string, unknown>, action: string) {
  // DECIDING IS NOT RECORDING. `approve-refund` is held by the Finance
  // Director and the Finance Officer; `manage-student-accounts` opens the
  // request. Reviewing and withdrawing sit with the office that asked.
  const capability = ['approve', 'reject', 'except'].includes(action)
    ? 'approve-refund'
    : 'manage-student-accounts';

  const g = await guard(request, capability);
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: capability === 'approve-refund'
        ? 'Deciding a refund is the Finance Director’s or the Finance Officer’s. Recording the '
          + 'request is a separate act, and holding one does not confer the other.'
        : 'This is Finance’s.',
    }, { status: g.status });
  }
  const { caller, admin } = g;

  const id = String(body.id ?? '');
  if (!id) return bad('no-refund', 400, 'Which refund?');

  const { data: row, error: readError } = await admin
    .from('refund_requests')
    // One literal, as above.
    // eslint-disable-next-line max-len
    .select('id, status, amount_paid, amount_requested, eligible_amount, currency, exceptional_policy, national_share, administration_id, student_id')
    .eq('id', id)
    .maybeSingle();

  if (readError) return bad('cannot-read', 500, readError.message);
  if (!row) return bad('no-such-refund', 404, 'There is no refund request with that id.');

  const patch: Record<string, unknown> = {};
  let next = '';

  if (action === 'review') {
    if (row.status !== 'submitted') {
      return bad('not-submitted', 409, `That refund is at “${row.status}”.`);
    }
    patch.status = 'under_review';
    next = 'Under review. Nothing is refunded by reviewing it either.';

  } else if (action === 'withdraw') {
    if (!['submitted', 'under_review'].includes(row.status)) {
      return bad('already-decided', 409,
        `That refund is at “${row.status}” and cannot be taken back.`);
    }
    patch.status = 'withdrawn';
    next = 'Withdrawn. The record stays readable; a further refund is a further request.';

  } else if (action === 'except') {
    // THE CARVE-OUT, MADE TO COST SOMETHING. A named policy, an officer and a
    // time — 102 refuses an exception missing any of the three.
    const policy = String(body.exceptionalPolicy ?? '').trim();
    if (policy.length < MIN_DECISION) {
      return bad('no-policy', 400,
        `Name the exceptional policy being applied — at least ${MIN_DECISION} characters. `
        + 'The University’s decision provides for one; an unnamed exception is not one.');
    }
    if (!['submitted', 'under_review'].includes(row.status)) {
      return bad('already-decided', 409, `That refund is at “${row.status}”.`);
    }
    patch.exceptional_policy = policy;
    patch.exception_authorised_by = caller.id;
    patch.exception_authorised_at = new Date().toISOString();
    next = 'Recorded against the request. An approval above the determination is now possible, '
      + 'and the policy and the officer who authorised it stay on the record.';

  } else if (action === 'approve' || action === 'reject') {
    if (row.status !== 'under_review') {
      return bad('not-under-review', 409,
        `That refund is at “${row.status}”. A refund is reviewed before it is decided — the `
        + 'University’s own order is request → review → decision → refund.');
    }
    const decisionReason = String(body.decisionReason ?? '').trim();
    if (decisionReason.length < MIN_DECISION) {
      return bad('no-decision-reason', 400,
        `Say why — at least ${MIN_DECISION} characters. The student reads this.`);
    }

    if (action === 'reject') {
      patch.status = 'rejected';
      next = 'Rejected, with the reason on the record. Nothing was refunded.';
    } else {
      const amount = Number(body.amountApproved);
      if (!Number.isFinite(amount) || amount < 0) {
        return bad('no-amount', 400, 'How much is approved?');
      }
      if (amount > Number(row.amount_paid)) {
        return bad('more-than-was-paid', 400,
          `That payment was ${money(row.amount_paid, row.currency)}.`);
      }
      // SAID BEFORE THE DATABASE REFUSES IT. 102 holds this too.
      if (amount > Number(row.eligible_amount) && !row.exceptional_policy) {
        return bad('above-the-determination', 409,
          `The determination allows ${money(row.eligible_amount, row.currency)}. Approving `
          + 'more needs an exceptional policy authorised against this request first — the '
          + 'University’s decision of 16 September 2026 provides for one, and it has to be '
          + 'named.');
      }
      patch.status = 'approved';
      patch.amount_approved = amount;
      next = `Approved at ${money(amount, row.currency)}, and nothing has moved yet. Record `
        + 'the bank reference when the money leaves.';
      if (Number(row.national_share) > 0) {
        next += ' NOTE: part of this payment was shared with a National Administration under '
          + 'an agreement in force when it was received. That allocation is not reversed.';
      }
    }
    patch.decision_reason = decisionReason;
    patch.decided_by = caller.id;
    patch.decided_at = new Date().toISOString();

  } else if (action === 'pay') {
    if (row.status !== 'approved') {
      return bad('not-approved', 409,
        `That refund is at “${row.status}”. Only an approved refund is paid.`);
    }
    const reference = String(body.refundReference ?? '').trim();
    if (reference.length < 3) {
      return bad('no-reference', 400,
        'Give the reference the money went out under, so the row and the bank can be put side '
        + 'by side.');
    }
    patch.status = 'paid';
    patch.refund_reference = reference;
    patch.paid_at = new Date().toISOString();
    patch.paid_by = caller.id;
    next = 'Recorded as paid. The refund and the original payment both stay on the record, and '
      + 'neither can now be edited.';
  }

  const { error: writeError } = await admin
    .from('refund_requests')
    .update(patch)
    .eq('id', id)
    .eq('status', row.status);

  if (writeError) return bad('not-changed', 409, writeError.message);

  await audit(admin, {
    action: `refund-${action}`,
    entityType: 'refund_request',
    entityId: id,
    performedBy: caller.id,
    details: { from: row.status, ...patch },
  });

  return NextResponse.json({ ok: true, next });
}
