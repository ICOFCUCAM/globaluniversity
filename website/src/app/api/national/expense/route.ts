// ---------------------------------------------------------------------------
// WHAT A NATIONAL ADMINISTRATION SPENDS.
//
//   POST /api/national/expense  { action, ... }
//
//     record     the Financial Secretary enters it
//     authorise  the Rector authorises it; it counts against the purse
//     reject     it will not be paid, with a reason
//
// ---------------------------------------------------------------------------
// TWO CAPABILITIES, BECAUSE THE PROGRAMME ASKS FOR TWO PEOPLE
// ---------------------------------------------------------------------------
//
// "National Rector — authorizes national operations — Financial Secretary —
// records/processes finances." That is `administer-national-finance` for one
// and `lead-national-administration` for the other, and this route guards each
// action with the one it belongs to.
//
// 099 refuses the same person to do both in the database, and refuses an
// administration to authorise more than 098 allocated it. Both hold whatever
// calls the database. What this adds is the sentence: an officer told
// `check_violation` on `a_nation_spends_what_it_kept` learns nothing; one told
// "this administration has been allocated 500 USD and has already authorised
// 300" knows exactly what to do.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard, audit } from '@/lib/adminAuth';
import type { Capability } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

const MIN_NOTE = 10;

/** 099's vocabulary, and the screen offers exactly these. */
const CATEGORIES = [
  'staff', 'academic', 'student-support', 'administration', 'recruitment',
  'technology', 'facilities', 'events', 'marketing', 'operations', 'development',
];

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  if (action === 'record') return record(request, body);
  if (action !== 'authorise' && action !== 'reject') {
    return bad('unknown-action', 400, 'An expense is recorded, authorised or rejected.');
  }

  // ---- AUTHORISING IS THE RECTOR'S --------------------------------------
  const g = await guard(request, 'lead-national-administration' as Capability);
  if (!g.ok) {
    return NextResponse.json({
      ok: false, error: g.error,
      detail: 'Authorising national expenditure belongs to the Rector who leads the '
        + 'administration. The Financial Secretary records it.',
    }, { status: g.status });
  }
  const { caller, admin } = g;

  const id = String(body.id ?? '');
  if (!id) return bad('no-expense', 400, 'Which expense?');

  const note = String(body.note ?? '').trim();
  if (action === 'reject' && note.length < MIN_NOTE) {
    return bad('no-reason', 400,
      `Say why it is not being paid — at least ${MIN_NOTE} characters. The Financial Secretary `
      + 'reads this and has to answer for the invoice.');
  }

  const { data: row, error: readError } = await admin
    .from('national_expenses')
    .select('id, administration_id, description, amount, currency, status, recorded_by')
    .eq('id', id)
    .maybeSingle();

  if (readError) return bad('cannot-read', 500, readError.message);
  if (!row) return bad('no-such-expense', 404, 'There is no expense with that id.');
  if (row.status !== 'recorded') {
    return bad('not-waiting', 409, `That expense is at “${row.status}”.`);
  }
  // 099 REFUSES THIS TOO. The sentence comes first.
  if (row.recorded_by === caller.id) {
    return bad('your-own', 403,
      'You recorded this expense, so you cannot also authorise it. That separation is what the '
      + 'two national offices are for.');
  }

  // ---- WHAT IT WOULD LEAVE, SAID BEFORE THE DATABASE REFUSES IT ----------
  if (action === 'authorise') {
    const { data: purse } = await admin
      .from('national_purse')
      .select('kept, authorised, available, currency')
      .eq('administration_id', row.administration_id)
      .eq('currency', row.currency)
      .maybeSingle();

    const available = Number(purse?.available ?? 0);
    if (Number(row.amount) > available) {
      return bad('beyond-the-purse', 409,
        `This administration has ${row.currency} ${available.toLocaleString()} available and `
        + `this expense is ${row.currency} ${Number(row.amount).toLocaleString()}. Authorising `
        + 'it would commit money the administration has not received.'
        + (Number(purse?.kept ?? 0) === 0
          ? ' Nothing has been allocated to it yet — check that a national revenue agreement '
            + 'is in force.'
          : ''));
    }
  }

  const { error: writeError } = await admin
    .from('national_expenses')
    .update({
      status: action === 'authorise' ? 'authorised' : 'rejected',
      ...(action === 'authorise'
        ? { authorised_by: caller.id, authorised_at: new Date().toISOString() }
        : { note }),
    })
    .eq('id', id)
    .eq('status', 'recorded');

  if (writeError) return bad('not-recorded', 409, writeError.message);

  await audit(admin, {
    action: action === 'authorise' ? 'national-expense-authorised' : 'national-expense-rejected',
    entityType: 'national_expense',
    entityId: id,
    performedBy: caller.id,
    details: {
      description: row.description, amount: row.amount, currency: row.currency,
      ...(action === 'reject' ? { note } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}


/** The Financial Secretary enters what the administration has spent. */
async function record(request: Request, body: Record<string, unknown>) {
  const g = await guard(request, 'administer-national-finance' as Capability);
  if (!g.ok) {
    return NextResponse.json({
      ok: false, error: g.error,
      detail: 'Recording national expenditure belongs to the administration’s Financial '
        + 'Secretary.',
    }, { status: g.status });
  }
  const { caller, admin } = g;

  const category = String(body.category ?? '');
  const description = String(body.description ?? '').trim();
  const amount = Number(body.amount);
  const currency = String(body.currency ?? '');
  const incurredOn = String(body.incurredOn ?? '').trim();

  if (!CATEGORIES.includes(category)) {
    return bad('no-category', 400, `An expense is one of: ${CATEGORIES.join(', ')}.`);
  }
  if (description.length < 4) return bad('no-description', 400, 'What was it for?');
  if (!Number.isFinite(amount) || amount <= 0) {
    return bad('no-amount', 400, 'How much was it?');
  }
  if (!incurredOn) return bad('no-date', 400, 'When was it incurred?');

  // WHICH NATION IS NOT THE FORM'S TO SAY. Read from the Secretary's own
  // profile, which is where 097 attaches a national officer.
  const { data: me, error: meError } = await admin
    .from('profiles')
    .select('administration_id')
    .eq('id', caller.id)
    .maybeSingle();

  if (meError) return bad('cannot-read', 500, meError.message);
  if (!me?.administration_id) {
    return bad('no-administration', 409,
      'You are not attached to a National Administration, so there is nothing to record this '
      + 'against. The University attaches a national officer to their administration.');
  }

  const { data, error } = await admin
    .from('national_expenses')
    .insert({
      administration_id: me.administration_id,
      category,
      description,
      amount,
      currency,
      incurred_on: incurredOn,
      reference: String(body.reference ?? '').trim() || null,
      recorded_by: caller.id,
    })
    .select('id')
    .maybeSingle();

  if (error) return bad('not-recorded', 500, error.message);

  await audit(admin, {
    action: 'national-expense-recorded',
    entityType: 'national_expense',
    entityId: data?.id,
    performedBy: caller.id,
    details: { category, description, amount, currency },
  });

  return NextResponse.json({ ok: true, id: data?.id });
}
