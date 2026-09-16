// ---------------------------------------------------------------------------
// RECOMMENDING SOMEBODY FOR A NATIONAL POST.
//
//   POST /api/national/staff  { action, ... }
//
//     recommend  the Rector puts a name forward
//     accept     the University will appoint; HR drafts from here
//     decline    it will not proceed, with a reason the Rector reads
//
// ---------------------------------------------------------------------------
// THREE PEOPLE, AND THE ROUTE IS WHERE THE FIRST TWO ARE KEPT APART
// ---------------------------------------------------------------------------
//
// The programme: "The National Rector recommends. ICOF University verifies and
// appoints." That is `recommend-national-staff` on one side and
// `draft-appointment` on the other, and they are held by different offices —
// so this route has TWO guards rather than one, and which one applies depends
// on the action.
//
// 099 refuses a Rector to decide their own recommendation in the database. This
// says so in a sentence first, because an officer told `insufficient_privilege`
// learns nothing about whose recommendation it was.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard, audit } from '@/lib/adminAuth';
import type { Capability } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

/** 099 refuses a shorter one, and so does this — with words rather than a code. */
const MIN_NOTE = 10;
const MIN_RATIONALE = 20;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  if (action === 'recommend') return recommend(request, body);
  if (action !== 'accept' && action !== 'decline') {
    return bad('unknown-action', 400,
      'A recommendation is made, accepted or declined.');
  }

  // ---- DECIDING IS THE UNIVERSITY'S -------------------------------------
  //
  // `draft-appointment` is the capability, because accepting a recommendation
  // is the University undertaking to draft the appointment. HR holds it; the
  // Rector does not.
  const g = await guard(request, 'draft-appointment' as Capability);
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: 'A recommendation is verified by the offices that draft the University’s '
        + 'appointments. The Rector recommends; ICOF appoints.',
    }, { status: g.status });
  }
  const { caller, admin } = g;

  const id = String(body.id ?? '');
  if (!id) return bad('no-recommendation', 400, 'Which recommendation?');

  const note = String(body.note ?? '').trim();
  if (action === 'decline' && note.length < MIN_NOTE) {
    return bad('no-reason', 400,
      `Say why it is not proceeding — at least ${MIN_NOTE} characters. The Rector reads this, `
      + 'and needs to know whether to put somebody else forward.');
  }

  const { data: row, error: readError } = await admin
    .from('national_staff_recommendations')
    .select('id, full_name, proposed_position, status, recommended_by, administration_id')
    .eq('id', id)
    .maybeSingle();

  if (readError) return bad('cannot-read', 500, readError.message);
  if (!row) return bad('no-such-recommendation', 404, 'There is no recommendation with that id.');
  if (row.status !== 'submitted') {
    return bad('not-waiting', 409,
      `That recommendation is at “${row.status}”, not waiting for a decision.`);
  }
  // 099 REFUSES THIS TOO. Said here first, in words.
  if (row.recommended_by === caller.id) {
    return bad('your-own', 403,
      'This is your own recommendation. The University decides it — that is what the step '
      + 'is for.');
  }

  const { error: writeError } = await admin
    .from('national_staff_recommendations')
    .update({
      status: action === 'accept' ? 'accepted' : 'declined',
      reviewed_by: caller.id,
      reviewed_at: new Date().toISOString(),
      ...(action === 'decline' ? { decision_note: note } : {}),
    })
    .eq('id', id)
    // NOT MOVED SINCE IT WAS READ.
    .eq('status', 'submitted');

  if (writeError) return bad('not-recorded', 409, writeError.message);

  await audit(admin, {
    action: action === 'accept' ? 'national-recommendation-accepted'
      : 'national-recommendation-declined',
    entityType: 'national_staff_recommendation',
    entityId: id,
    performedBy: caller.id,
    details: {
      name: row.full_name,
      post: row.proposed_position,
      ...(action === 'decline' ? { note } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}


/**
 * A Rector puts a name forward.
 *
 * ONLY INTO THEIR OWN NATION, which 099's `with check` enforces in the
 * database. This does not repeat that check: the route writes with the service
 * key, so the policy would not fire, and duplicating it here would mean two
 * statements of one rule that can drift. What it does instead is read the
 * register and refuse a Rector who leads nothing — which the policy cannot say
 * in words.
 */
async function recommend(request: Request, body: Record<string, unknown>) {
  const g = await guard(request, 'recommend-national-staff' as Capability);
  if (!g.ok) {
    return NextResponse.json({
      ok: false, error: g.error,
      detail: 'Recommending somebody for a national post belongs to the Rector who leads that '
        + 'administration.',
    }, { status: g.status });
  }
  const { caller, admin } = g;

  const fullName = String(body.fullName ?? '').trim();
  const position = String(body.proposedPosition ?? '').trim();
  const rationale = String(body.rationale ?? '').trim();

  if (fullName.length < 3) return bad('no-name', 400, 'Who are you recommending?');
  if (position.length < 3) return bad('no-position', 400, 'For what post?');
  if (rationale.length < MIN_RATIONALE) {
    return bad('no-rationale', 400,
      `Say why, in at least ${MIN_RATIONALE} characters. The office that verifies this reads it, `
      + 'and "good candidate" is not something anybody can verify.');
  }

  // WHICH NATION IS THE REGISTER'S ANSWER, NOT THE FORM'S. A Rector does not
  // get to say which administration a recommendation belongs to.
  const { data: nation, error: nationError } = await admin
    .from('national_administrations')
    .select('id, country, status')
    .eq('rector_id', caller.id)
    .neq('status', 'closed')
    .maybeSingle();

  if (nationError) return bad('cannot-read', 500, nationError.message);
  if (!nation) {
    return bad('no-administration', 409,
      'No National Administration is registered to you, so there is no post to recommend into. '
      + 'The University establishes it first.');
  }
  if (nation.status !== 'established') {
    return bad('not-established', 409,
      `${nation.country} is at “${nation.status}”. An administration recommends staff once it is `
      + 'established.');
  }

  const { data, error } = await admin
    .from('national_staff_recommendations')
    .insert({
      administration_id: nation.id,
      full_name: fullName,
      proposed_position: position,
      rationale,
      qualifications: String(body.qualifications ?? '').trim() || null,
      email: String(body.email ?? '').trim() || null,
      phone: String(body.phone ?? '').trim() || null,
      recommended_by: caller.id,
    })
    .select('id')
    .maybeSingle();

  if (error) return bad('not-recorded', 500, error.message);

  await audit(admin, {
    action: 'national-staff-recommended',
    entityType: 'national_staff_recommendation',
    entityId: data?.id,
    performedBy: caller.id,
    details: { country: nation.country, name: fullName, post: position },
  });

  return NextResponse.json({ ok: true, id: data?.id });
}
