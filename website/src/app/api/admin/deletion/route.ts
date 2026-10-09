// ---------------------------------------------------------------------------
// PUTTING A RECORD UP FOR DELETION, AND DECIDING IT.
//
//   POST /api/admin/deletion  { action: 'request',  entityType, entityId, reason }
//   POST /api/admin/deletion  { action: 'approve',  id, reason }
//   POST /api/admin/deletion  { action: 'reject',   id, reason }
//   POST /api/admin/deletion  { action: 'withdraw', id }
//   POST /api/admin/deletion  { action: 'erase' }
//
// ---------------------------------------------------------------------------
// THE UNIVERSITY'S RULING
// ---------------------------------------------------------------------------
//
//   "superadmin should be able to delete these files. when he takes delete, it
//    should appear to the VC approval. if the vc accept delete, it is deleted
//    within 30 days. if he says reject, the file is restored. all the records
//    of these processes are kept in the history."
//
// TWO OFFICES AND TWO DIFFERENT ACTS. The Superadministrator asks; the
// Vice-Chancellor decides. Neither can do the other's half, and the route
// guards them on different capabilities for that reason rather than on one
// capability both happen to hold.
//
// ---------------------------------------------------------------------------
// WHAT IS REFUSED HERE RATHER THAN THIRTY DAYS LATER
// ---------------------------------------------------------------------------
//
// The University chose: a record that cannot be deleted is refused at REQUEST
// time, with the reason named. So `what_holds_this_record` is asked before
// anything is written, and it answers in sentences — an issued credential, a
// transcript, an examination sitting, a refund, or 018's rule that an admitted
// student is no longer an application at all.
//
// Every one of those is a foreign key or a trigger the database already
// enforces. The point is not to invent a policy; it is to say the existing one
// out loud at the moment somebody could still act on it, instead of letting a
// request travel to the Vice-Chancellor, wait thirty days, and fail.
//
// ---------------------------------------------------------------------------
// AND ERASING IS NOT A DECISION
// ---------------------------------------------------------------------------
//
// `erase` carries nothing out that was not approved thirty days ago. It calls
// 108's `erase_what_is_due()`, which does nothing until the time has run and
// chooses the table from a list rather than from the row.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { guard } from '@/lib/adminAuth';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';
import { DELETION_GRACE_DAYS, DELETABLE } from '@/lib/deletions';
import type { Capability } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// THE SUPERADMINISTRATOR ASKS, THE VICE-CHANCELLOR DECIDES. Two capabilities,
// because they are two offices — and because one capability held by both
// would let whoever holds it do the whole thing alone, which is the entire
// point of the ruling.
const CAPABILITY: Record<string, Capability> = {
  request: 'delete-application' as Capability,
  withdraw: 'delete-application' as Capability,
  erase: 'delete-application' as Capability,
  approve: 'approve-deletion' as Capability,
  reject: 'approve-deletion' as Capability,
};

const MIN_REASON = 20;
const MIN_DECISION = 10;

type Row = Record<string, unknown>;

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

const service = () => createClient(
  SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  const capability = CAPABILITY[action];
  if (!capability) {
    return bad('unknown-action', 400,
      `They are: ${Object.keys(CAPABILITY).join(', ')}.`);
  }

  const g = await guard(request, capability);
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: capability === 'approve-deletion'
        ? 'Deciding a deletion is the Vice-Chancellor’s. The office that asks for one does '
          + 'not decide it, which is the whole of the University’s ruling.'
        : 'Putting a record up for deletion is the Superadministrator’s.',
    }, { status: g.status });
  }

  const admin = service();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return bad('service-role-key-missing', 500);

  const note = async (requestId: string, event: string, detail: string) => {
    await admin.from('deletion_request_events').insert({
      request_id: requestId,
      event,
      actor_id: g.caller.id,
      actor_role: g.caller.role ?? null,
      detail,
    });
  };

  // =========================================================================
  // ASKING
  // =========================================================================
  if (action === 'request') {
    const entityType = String(body.entityType ?? '');
    const entityId = String(body.entityId ?? '');
    const reason = String(body.reason ?? '').trim();

    const kind = DELETABLE[entityType];
    if (!kind) {
      return bad('not-deletable', 400,
        `The University does not delete ${entityType || 'that'} through this path. The kinds `
        + `it does are: ${Object.keys(DELETABLE).join(', ')}.`);
    }
    if (!entityId) return bad('no-record', 400, 'Which record?');
    if (reason.length < MIN_REASON) {
      return bad('no-reason', 400,
        `Say why it should be deleted — at least ${MIN_REASON} characters. The `
        + 'Vice-Chancellor reads this, and it is what the history will say in five years.');
    }

    // ---- WHAT THE RECORD IS, COPIED NOW -------------------------------
    //
    // The whole point of the scheme is that the row goes away. A history that
    // then reads "deleted 3f2a…" is a history of nothing.
    const { data: found } = await admin
      .from(kind.table).select(kind.columns).eq('id', entityId).maybeSingle();
    if (!found) return bad('no-such-record', 404, 'There is no record with that id.');
    // THROUGH `unknown`, because `kind.columns` is not a string literal and
    // supabase-js types a row from the literal it was given. The column list
    // has to come from the table map or there would be one per entity kind
    // written out here, which is the duplication the map exists to prevent.
    const label = kind.label(found as unknown as Row);

    // ---- WHAT HOLDS IT, ASKED BEFORE ANYTHING IS WRITTEN --------------
    const { data: held, error: heldErr } = await admin
      .rpc('what_holds_this_record', { kind: entityType, subject: entityId });
    if (heldErr) {
      return bad('cannot-check', 500,
        `Whether this record can be deleted could not be established: ${heldErr.message}. `
        + 'Nothing was requested. Has migration 108 been run?');
    }
    const reasons = (held ?? []) as string[];
    if (reasons.length > 0) {
      return NextResponse.json({
        ok: false,
        error: 'record-is-held',
        held: reasons,
        detail: `${label} cannot be deleted. `
          + reasons.join(' ')
          + ' Nothing has been sent to the Vice-Chancellor, because there is nothing for '
          + 'them to decide.',
      }, { status: 409 });
    }

    const { data: made, error } = await admin
      .from('deletion_requests')
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        entity_label: label,
        requested_by: g.caller.id,
        reason,
      })
      .select('id')
      .maybeSingle();

    if (error) {
      if (/one_live_deletion_per_record/.test(error.message)) {
        return bad('already-requested', 409,
          `${label} is already up for deletion. The Vice-Chancellor decides it once.`);
      }
      return bad('not-requested', 500, error.message);
    }

    await note(String((made as Row).id), 'REQUESTED',
      `${label} put up for deletion. ${reason}`);

    return NextResponse.json({
      ok: true,
      id: (made as Row).id,
      detail: `${label} is with the Vice-Chancellor. Nothing has been hidden or deleted: `
        + 'if they approve it, it leaves every screen at once and is erased '
        + `${DELETION_GRACE_DAYS} days later, and rejecting it inside that window puts it `
        + 'back.',
    });
  }

  // =========================================================================
  // ERASING WHAT IS DUE
  // =========================================================================
  if (action === 'erase') {
    const { data, error } = await admin.rpc('erase_what_is_due', {});
    if (error) return bad('not-erased', 500, error.message);
    const n = Number(data ?? 0);
    return NextResponse.json({
      ok: true,
      erased: n,
      detail: n === 0
        ? `Nothing is due. A record is erased ${DELETION_GRACE_DAYS} days after the `
          + 'Vice-Chancellor approves it and not before.'
        : `${n} record(s) erased. What was asked, who decided it and why are still on the `
          + 'record; the records themselves are gone and nothing brings them back.',
    });
  }

  // =========================================================================
  // DECIDING
  // =========================================================================
  const id = String(body.id ?? '');
  if (!id) return bad('no-request', 400, 'Which request?');

  const { data: found } = await admin
    .from('deletion_requests')
    .select('id, entity_type, entity_id, entity_label, status, requested_by')
    .eq('id', id)
    .maybeSingle();
  const r = found as Row | null;
  if (!r) return bad('no-such-request', 404, 'There is no deletion request with that id.');

  if (action === 'withdraw') {
    if (r.status !== 'awaiting_decision') {
      return bad('already-decided', 409,
        `That request is at “${String(r.status)}” and cannot be taken back.`);
    }
    const { error } = await admin.from('deletion_requests')
      .update({ status: 'withdrawn' }).eq('id', id).eq('status', 'awaiting_decision');
    if (error) return bad('not-withdrawn', 409, error.message);
    await note(id, 'WITHDRAWN', `${String(r.entity_label)} taken back before a decision.`);
    return NextResponse.json({
      ok: true,
      detail: 'Withdrawn. Nothing was hidden or deleted, and the record of the request stays.',
    });
  }

  const reason = String(body.reason ?? '').trim();
  if (reason.length < MIN_DECISION) {
    return bad('no-decision-reason', 400,
      `Say why — at least ${MIN_DECISION} characters. This is the part of the history that `
      + 'explains a decision nobody can undo.');
  }

  if (action === 'approve') {
    if (r.status !== 'awaiting_decision') {
      return bad('not-awaiting', 409, `That request is at “${String(r.status)}”.`);
    }
    const eraseAfter = new Date(Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
    const { error } = await admin.from('deletion_requests')
      .update({
        status: 'approved',
        decided_by: g.caller.id,
        decided_at: new Date().toISOString(),
        decision_reason: reason,
        erase_after: eraseAfter.toISOString(),
      })
      .eq('id', id).eq('status', 'awaiting_decision');
    if (error) return bad('not-approved', 409, error.message);

    await note(id, 'APPROVED',
      `Approved. To be erased after ${eraseAfter.toISOString().slice(0, 10)}. ${reason}`);

    return NextResponse.json({
      ok: true,
      eraseAfter: eraseAfter.toISOString(),
      detail: `${String(r.entity_label)} has left every screen. It is erased after `
        + `${eraseAfter.toLocaleDateString('en-GB')} — until then, rejecting this request `
        + 'puts it back exactly as it was.',
    });
  }

  // ---- REJECT, WHICH RESTORES -----------------------------------------
  //
  // From either state. Rejecting before a decision is refusing it; rejecting
  // AFTER approval, inside the thirty days, is the grace period doing the one
  // thing it exists for.
  if (!['awaiting_decision', 'approved'].includes(String(r.status))) {
    return bad('cannot-reject', 409,
      String(r.status) === 'erased'
        ? 'That record has been erased. Nothing brings it back, and this request is the only '
          + 'account of it that remains.'
        : `That request is at “${String(r.status)}”.`);
  }

  const wasApproved = r.status === 'approved';
  const { error } = await admin.from('deletion_requests')
    .update({
      status: 'rejected',
      decided_by: g.caller.id,
      decided_at: new Date().toISOString(),
      decision_reason: reason,
      ...(wasApproved ? { restored_at: new Date().toISOString() } : {}),
    })
    .eq('id', id).eq('status', String(r.status));
  if (error) return bad('not-rejected', 409, error.message);

  await note(id, wasApproved ? 'RESTORED' : 'REFUSED',
    `${wasApproved ? 'Restored inside its grace period' : 'Refused'}. ${reason}`);

  return NextResponse.json({
    ok: true,
    detail: wasApproved
      ? `${String(r.entity_label)} is back on every screen, exactly as it was. Nothing was `
        + 'lost.'
      : `${String(r.entity_label)} will not be deleted. It was never hidden.`,
  });
}
