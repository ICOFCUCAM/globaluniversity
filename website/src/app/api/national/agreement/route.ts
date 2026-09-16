// ---------------------------------------------------------------------------
// THE AGREEMENT A NATIONAL ADMINISTRATION OPERATES UNDER.
//
//   POST /api/national/agreement  { action, ... }
//
//     draft     the centre records the terms
//     approve   the University puts it in force
//     end       it stops applying from today
//
// ---------------------------------------------------------------------------
// WHY THIS ROUTE EXISTS AT ALL
// ---------------------------------------------------------------------------
//
// It was missing, and the audit found it. 098 built `national_revenue_agreements`
// and NOTHING IN THE APPLICATION COULD CREATE OR APPROVE ONE — so the whole
// national revenue model was inert: with no agreement in force every payment
// stays whole with the centre, no allocation ever names a nation, the ledger
// is empty, the purse is nil and therefore 099's expenditure could never be
// authorised either.
//
// The Rector's own Finance screen said so out loud — "until a national revenue
// agreement is in force, every payment goes wholly to the centre" — and offered
// no way out of that state. Two migrations of machinery with no door.
//
// ---------------------------------------------------------------------------
// THE ONE RULE THAT MATTERS
// ---------------------------------------------------------------------------
//
// A RECTOR CANNOT APPROVE THE AGREEMENT THAT PAYS THEIR OWN ADMINISTRATION.
// 098 refuses it in the database whatever calls it. This route says it in a
// sentence first, because an officer told `check_violation` on
// `an_agreement_is_not_approved_by_its_rector` learns nothing.
//
// ---------------------------------------------------------------------------
// AND APPROVING IS NOT DRAFTING
// ---------------------------------------------------------------------------
//
// Recording the terms is `establish-national-administration` — the same
// institutional authority that opens an administration, because an agreement
// is the document that administration exists under. Putting one IN FORCE is
// the act that starts money moving, and is held to the same two offices that
// hold the University's other financial authorities.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard, audit } from '@/lib/adminAuth';
import type { Capability } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

const MIN_NOTE = 10;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  if (action === 'draft') return draft(request, body);
  if (action !== 'approve' && action !== 'end') {
    return bad('unknown-action', 400,
      'An agreement is drafted, approved into force, or ended.');
  }
  return decide(request, body, action);
}


/** The centre writes down what was agreed. */
async function draft(request: Request, body: Record<string, unknown>) {
  const g = await guard(request, 'establish-national-administration' as Capability);
  if (!g.ok) {
    return NextResponse.json({
      ok: false, error: g.error,
      detail: 'Recording a national revenue agreement is an institutional act and belongs to '
        + 'the offices that establish a National Administration.',
    }, { status: g.status });
  }
  const { caller, admin } = g;

  const administrationId = String(body.administrationId ?? '');
  const reference = String(body.reference ?? '').trim();
  const share = Number(body.tuitionSharePercent);
  const from = String(body.effectiveFrom ?? '').trim();
  const to = String(body.effectiveTo ?? '').trim();

  if (!administrationId) return bad('no-administration', 400, 'Which administration?');
  if (reference.length < 3) {
    return bad('no-reference', 400,
      'Give the agreement its reference — the one on the signed document, so the row and the '
      + 'paper can be put side by side.');
  }
  if (!Number.isFinite(share) || share < 0 || share > 100) {
    return bad('no-share', 400,
      'What share of tuition does the administration retain? A whole percentage between 0 '
      + 'and 100.');
  }
  if (!from) return bad('no-start', 400, 'From what date does it apply?');
  if (to && to <= from) {
    return bad('ends-first', 400, 'An agreement cannot end before it starts.');
  }

  const { data: nation, error: readError } = await admin
    .from('national_administrations')
    .select('id, country, name, status')
    .eq('id', administrationId)
    .maybeSingle();

  if (readError) return bad('cannot-read', 500, readError.message);
  if (!nation) return bad('no-such-administration', 404, 'There is no administration with that id.');

  const { data, error } = await admin
    .from('national_revenue_agreements')
    .insert({
      administration_id: administrationId,
      reference,
      tuition_share_percent: share,
      effective_from: from,
      effective_to: to || null,
      note: String(body.note ?? '').trim() || null,
      created_by: caller.id,
      // DRAFT, ALWAYS. Nothing here can put an agreement into force, whatever
      // the caller sends: that is a second act by a second person, below.
      status: 'draft',
    })
    .select('id')
    .maybeSingle();

  if (error) return bad('not-recorded', 500, error.message);

  await audit(admin, {
    action: 'national-agreement-drafted',
    entityType: 'national_revenue_agreement',
    entityId: data?.id,
    performedBy: caller.id,
    details: { country: nation.country, reference, tuition_share_percent: share, from, to },
  });

  return NextResponse.json({
    ok: true,
    id: data?.id,
    next: `Recorded as a draft for ${nation.country}. Nothing is shared until it is approved `
      + 'into force, and it cannot be approved by the Rector it pays.',
  });
}


/** The University puts it in force, or ends it. */
async function decide(request: Request, body: Record<string, unknown>, action: string) {
  const g = await guard(request, 'establish-national-administration' as Capability);
  if (!g.ok) {
    return NextResponse.json({
      ok: false, error: g.error,
      detail: 'Putting a national revenue agreement in force is the University’s act. It '
        + 'starts money moving to a National Administration.',
    }, { status: g.status });
  }
  const { caller, admin } = g;

  const id = String(body.id ?? '');
  if (!id) return bad('no-agreement', 400, 'Which agreement?');

  const note = String(body.note ?? '').trim();
  if (action === 'end' && note.length < MIN_NOTE) {
    return bad('no-reason', 400,
      `Say why it is ending — at least ${MIN_NOTE} characters. The administration reads this.`);
  }

  const { data: row, error: readError } = await admin
    .from('national_revenue_agreements')
    .select('id, administration_id, reference, status, tuition_share_percent, created_by')
    .eq('id', id)
    .maybeSingle();

  if (readError) return bad('cannot-read', 500, readError.message);
  if (!row) return bad('no-such-agreement', 404, 'There is no agreement with that id.');

  if (action === 'approve') {
    if (row.status !== 'draft') {
      return bad('not-a-draft', 409, `That agreement is at “${row.status}”.`);
    }

    // ---- THE RULE, SAID BEFORE THE DATABASE REFUSES IT -------------------
    const { data: nation } = await admin
      .from('national_administrations')
      .select('country, rector_id')
      .eq('id', row.administration_id)
      .maybeSingle();

    if (nation?.rector_id && nation.rector_id === caller.id) {
      return bad('your-own-administration', 403,
        'You are the Rector of this administration, so you cannot approve the agreement that '
        + 'pays it. That separation is the whole point of the agreement being the '
        + 'University’s act rather than the nation’s.');
    }

    // ONE IN FORCE AT A TIME, and 098 holds a unique index on it. The sentence
    // comes first: an officer told `unique_violation` learns nothing.
    const { data: live } = await admin
      .from('national_revenue_agreements')
      .select('id, reference')
      .eq('administration_id', row.administration_id)
      .eq('status', 'in_force')
      .maybeSingle();

    if (live) {
      return bad('already-in-force', 409,
        `${nation?.country ?? 'That administration'} already operates under ${live.reference}. `
        + 'End that agreement before putting another in force — an administration cannot '
        + 'operate under two at once, and the allocations would not know which to use.');
    }
  } else if (row.status !== 'in_force') {
    return bad('not-in-force', 409, `That agreement is at “${row.status}”.`);
  }

  const { error: writeError } = await admin
    .from('national_revenue_agreements')
    .update(action === 'approve'
      ? { status: 'in_force', approved_by: caller.id, approved_at: new Date().toISOString() }
      : { status: 'ended', effective_to: new Date().toISOString().slice(0, 10), note })
    .eq('id', id)
    .eq('status', action === 'approve' ? 'draft' : 'in_force');

  if (writeError) return bad('not-changed', 409, writeError.message);

  await audit(admin, {
    action: action === 'approve' ? 'national-agreement-approved' : 'national-agreement-ended',
    entityType: 'national_revenue_agreement',
    entityId: id,
    performedBy: caller.id,
    details: {
      reference: row.reference,
      tuition_share_percent: row.tuition_share_percent,
      ...(action === 'end' ? { note } : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    next: action === 'approve'
      // SAID PLAINLY, BECAUSE IT CHANGES WHAT HAPPENS TO MONEY. From this
      // moment the database splits every tuition payment that names this
      // administration. Registration money is never shared, whatever the
      // agreement says.
      ? `In force. From now the University shares ${row.tuition_share_percent}% of every `
        + 'tuition payment that names this administration, at the moment the payment is '
        + 'recorded. Registration money is never shared and stays whole with the centre. '
        + 'Payments already recorded are not revisited.'
      : 'Ended. Tuition recorded from now stays whole with the centre until another '
        + 'agreement is in force. Allocations already made are not revisited.',
  });
}
