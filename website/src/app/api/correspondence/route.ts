// ---------------------------------------------------------------------------
// THE CORRESPONDENCE PIPELINE — one route, one action per call.
//
//   POST /api/correspondence  { action, ... }
//
//   draft     { …the letter }                  → compose-correspondence
//   edit      { id, …the letter }              → compose- or prepare-
//   delegate  { id, preparedBy, brief }        → compose-correspondence
//   handback  { id }                           → prepare-correspondence
//   authorize { id }                           → authorize-correspondence
//   schedule  { id, at }                       → authorize-correspondence
//   return    { id, reason }                   → authorize-correspondence
//   issue     { id }                           → issue-correspondence
//   withdraw  { id, reason }                   → authorize-correspondence
//
// ---------------------------------------------------------------------------
// THE ONE THAT IS DIFFERENT FROM EVERY OTHER PIPELINE HERE
// ---------------------------------------------------------------------------
//
// `authorize` does NOT refuse the person who wrote the letter. That is the
// University's ruling and the whole reason this route exists separately from
// /api/appointments: a letter to a ministry IS the Vice-Chancellor speaking,
// and requiring somebody else to approve it would invent an authority above the
// one the University has.
//
// What it DOES refuse is the person recorded as having PREPARED it — an
// administrator asked to draft, who must not then also decide. 045 refuses the
// same thing in the database, so a future caller that forgets this check is
// still refused.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { guard } from '@/lib/adminAuth';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';
import { can, type Capability } from '@/lib/roles';
import type { UserRole } from '@/lib/types';
import {
  isLetterKind, objectionsTo, blocks, canAuthorize, canEdit, canIssue, canWithdraw,
  reference as buildReference, OFFICE_PREFIX, OFFICES,
  MIN_WITHDRAWAL_REASON, type Office,
} from '@/lib/correspondence';
import { correspondenceLetterHtml } from '@/lib/correspondenceLetter';
import { contentHash } from '@/lib/officialDocument';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CAPABILITY: Record<string, Capability> = {
  draft: 'compose-correspondence' as Capability,
  edit: 'compose-correspondence' as Capability,
  delegate: 'compose-correspondence' as Capability,
  handback: 'prepare-correspondence' as Capability,
  authorize: 'authorize-correspondence' as Capability,
  schedule: 'authorize-correspondence' as Capability,
  return: 'authorize-correspondence' as Capability,
  withdraw: 'authorize-correspondence' as Capability,
  issue: 'issue-correspondence' as Capability,
};

// A SINGLE STRING LITERAL, not a joined array. supabase-js infers the row type
// from this text, and anything it cannot read at compile time collapses the
// result to GenericStringError[] — silently, with no error at the call site.
// eslint-disable-next-line max-len
const COLUMNS = 'id, kind, originating_office, subject, body, recipient_name, recipient_org, recipient_email, recipient_address, status, initiated_by, prepared_by, authorized_by, authorized_at, scheduled_for, issued_at, preparation_brief, preparation_requested_by, withdrawn_reason';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

type Row = Record<string, unknown>;

function fieldsFrom(body: Record<string, unknown>) {
  const text = (k: string) => {
    const v = body[k];
    return v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim();
  };
  return {
    kind: text('kind'),
    originating_office: text('office'),
    subject: text('subject'),
    // NOT TRIMMED TO NULL. An empty body is legitimate while a delegated letter
    // is being prepared — 046 permits it in exactly that one state — so it is
    // stored as the empty string rather than turned into "unset".
    body: body.body === undefined ? null : String(body.body ?? ''),
    recipient_name: text('recipientName'),
    recipient_org: text('recipientOrg'),
    recipient_email: text('recipientEmail'),
    recipient_address: text('recipientAddress'),
  };
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  const capability = CAPABILITY[action];
  if (!capability) {
    return bad('unknown-action', 400,
      `Not a correspondence action. They are: ${Object.keys(CAPABILITY).join(', ')}.`);
  }

  let g = await guard(request, capability);
  // A PREPARER MAY EDIT WHAT THEY WERE ASKED TO PREPARE. Tried second rather
  // than first, so an authority editing their own letter is never told they are
  // acting as a preparer — which would put the wrong name in the history.
  if (!g.ok && action === 'edit') {
    g = await guard(request, 'prepare-correspondence' as Capability);
  }
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { caller } = g;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return bad('service-role-key-missing', 500);
  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const record = async (
    id: string, event: string, from: string | null, to: string | null,
    detail?: string | null, metadata?: Record<string, unknown>,
  ) => {
    const { error } = await admin.from('correspondence_events').insert({
      correspondence_id: id,
      event,
      actor_id: caller.id,
      actor_email: caller.email ?? null,
      actor_role: caller.role ?? null,
      previous_state: from,
      new_state: to,
      detail: detail ?? null,
      metadata: metadata ?? null,
    });
    // THE HISTORY FAILING IS NOT SILENT. It is not fatal either — the act
    // happened and pretending otherwise would be a worse lie than a gap — but
    // the caller is told, because a register with a hole in it is something
    // somebody has to go and look at.
    return error?.message ?? null;
  };

  const load = async (id: unknown): Promise<Row | null> => {
    if (typeof id !== 'string' || !id) return null;
    const { data } = await admin.from('correspondence').select(COLUMNS).eq('id', id).maybeSingle();
    return (data as Row | null) ?? null;
  };

  const stateOf = (row: Row) => String(row.status ?? '').replace(/_/g, ' ');

  // =========================================================================
  // DRAFT and EDIT
  // =========================================================================
  if (action === 'draft' || action === 'edit') {
    const fields = fieldsFrom(body);
    if (fields.kind && !isLetterKind(fields.kind)) {
      return bad('unknown-kind', 400,
        'That is not one of the kinds of letter the University files.');
    }
    if (fields.originating_office
        && !(OFFICES as readonly string[]).includes(fields.originating_office)) {
      return bad('unknown-office', 400, 'That is not an office of the University.');
    }

    let id: string;
    let previous: Row | null = null;

    if (action === 'edit') {
      previous = await load(body.id);
      if (!previous) return bad('letter-not-found', 404);
      if (!canEdit(previous)) {
        return bad('not-editable', 409,
          `This letter is ${stateOf(previous)}. Once it is authorised it is the document that `
          + 'goes out, and once it has gone somebody is holding it — issue a new version rather '
          + 'than changing what was sent.');
      }
      const { error } = await admin.from('correspondence')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', previous.id as string);
      if (error) return bad(`not-saved: ${error.message}`, 500);
      id = previous.id as string;
    } else {
      const { data, error } = await admin.from('correspondence')
        .insert({ ...fields, body: fields.body ?? '', initiated_by: caller.id, status: 'draft' })
        .select('id').single();
      if (error || !data) return bad(`not-saved: ${error?.message ?? 'no row'}`, 500);
      id = (data as Row).id as string;
    }

    const saved = await load(id);
    const historyError = await record(id, action === 'edit' ? 'EDITED' : 'DRAFTED',
      (previous?.status as string) ?? null, (saved?.status as string) ?? 'draft');

    return NextResponse.json({
      ok: true,
      id,
      // EVERYTHING WRONG WITH IT, AT ONCE. Somebody finishing a letter should be
      // told all of it, not sent back for the second thing after fixing the
      // first — and the warnings go with the refusals, because "this leaves the
      // University" is worth reading before it does.
      objections: objectionsTo(saved ?? {}),
      ...(historyError ? { historyError } : {}),
    });
  }

  // =========================================================================
  // DELEGATE — "prepare this letter"
  // =========================================================================
  if (action === 'delegate') {
    const row = await load(body.id);
    if (!row) return bad('letter-not-found', 404);
    if (!canEdit(row)) {
      return bad('not-editable', 409,
        `This letter is ${stateOf(row)}, so there is nothing left to prepare.`);
    }
    const preparedBy = String(body.preparedBy ?? '').trim();
    const brief = String(body.brief ?? '').trim();
    if (!preparedBy) {
      return bad('nobody-to-prepare-it', 400,
        'Say who is to prepare it. A letter handed to nobody sits in a queue no office can see.');
    }
    if (brief.length < 20) {
      return bad('delegation-needs-a-brief', 400,
        'Say what the letter is to say. "You did not ask for that" is otherwise one person’s '
        + 'memory against another’s, and the letter comes back wrong twice.');
    }
    // THE AUTHORITY DOES NOT MOVE WITH THE TYPING. 045 refuses the preparer to
    // authorise what they prepared; this refuses the obvious way round it.
    if (preparedBy === caller.id) {
      return bad('cannot-delegate-to-yourself', 400,
        'Delegating a letter to yourself is writing it. Nothing is gained and the record then '
        + 'says an administrator prepared what you wrote.');
    }

    const { error } = await admin.from('correspondence').update({
      status: 'preparing',
      prepared_by: preparedBy,
      preparation_brief: brief,
      preparation_requested_by: caller.id,
      preparation_requested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', row.id as string);
    if (error) return bad(`not-delegated: ${error.message}`, 500);

    await record(row.id as string, 'PREPARATION_REQUESTED',
      row.status as string, 'preparing', brief);
    return NextResponse.json({
      ok: true,
      status: 'preparing',
      detail: 'Handed over. It remains your letter: whoever prepares it cannot authorise it, '
        + 'and your name is the one on the signature block when it goes.',
    });
  }

  // =========================================================================
  // HANDBACK — the preparer is finished
  // =========================================================================
  if (action === 'handback') {
    const row = await load(body.id);
    if (!row) return bad('letter-not-found', 404);
    if (row.status !== 'preparing') {
      return bad('not-being-prepared', 409, `This letter is ${stateOf(row)}.`);
    }
    if (row.prepared_by !== caller.id) {
      return bad('not-your-preparation', 403,
        'This letter was given to somebody else to prepare.');
    }
    const outstanding = objectionsTo(row);
    if (blocks(outstanding)) {
      return NextResponse.json({
        ok: false,
        error: 'not-finished',
        objections: outstanding,
        detail: 'Finish it before handing it back. The authority reading it should be deciding '
          + 'whether to send it, not discovering it has no recipient.',
      }, { status: 409 });
    }
    const { error } = await admin.from('correspondence').update({
      status: 'awaiting_authority',
      prepared_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', row.id as string);
    if (error) return bad(`not-handed-back: ${error.message}`, 500);
    await record(row.id as string, 'PREPARED', 'preparing', 'awaiting_authority');
    return NextResponse.json({ ok: true, status: 'awaiting_authority' });
  }

  // =========================================================================
  // AUTHORIZE and SCHEDULE
  // =========================================================================
  if (action === 'authorize' || action === 'schedule') {
    const row = await load(body.id);
    if (!row) return bad('letter-not-found', 404);

    if (!canAuthorize(row, caller.id)) {
      return bad(
        row.prepared_by === caller.id ? 'cannot-authorise-what-you-prepared' : 'not-authorisable',
        409,
        row.prepared_by === caller.id
          ? 'You prepared this letter, so you cannot also be the authority for it. Being asked '
            + 'to draft is not being asked to decide.'
          : `This letter is ${stateOf(row)}, so there is nothing to authorise.`,
      );
    }

    const outstanding = objectionsTo(row);
    if (blocks(outstanding)) {
      return NextResponse.json({
        ok: false, error: 'not-ready', objections: outstanding,
        detail: 'This letter is not finished, and an authorised letter is one that goes.',
      }, { status: 409 });
    }

    const now = new Date().toISOString();
    if (action === 'schedule') {
      const at = String(body.at ?? '').trim();
      const when = new Date(at);
      if (!at || Number.isNaN(when.getTime())) {
        return bad('not-a-time', 400, 'Say when it should go.');
      }
      if (when.getTime() <= Date.now()) {
        return bad('already-past', 400,
          'That moment has passed. A letter scheduled for the past either goes now or does not '
          + 'go, and the system should not be guessing which was meant.');
      }
      const { error } = await admin.from('correspondence').update({
        status: 'scheduled', scheduled_for: when.toISOString(),
        authorized_by: caller.id, authorized_at: now, updated_at: now,
      }).eq('id', row.id as string);
      if (error) return bad(`not-scheduled: ${error.message}`, 500);
      await record(row.id as string, 'SCHEDULED', row.status as string, 'scheduled', at);
      return NextResponse.json({ ok: true, status: 'scheduled', scheduledFor: when.toISOString() });
    }

    const { error } = await admin.from('correspondence').update({
      status: 'authorized', authorized_by: caller.id, authorized_at: now, updated_at: now,
    }).eq('id', row.id as string);
    if (error) return bad(`not-authorised: ${error.message}`, 500);
    await record(row.id as string, 'AUTHORIZED', row.status as string, 'authorized');
    return NextResponse.json({
      ok: true,
      status: 'authorized',
      detail: 'Authorised. It has not gone: generating the document and issuing it are the next '
        + 'step, deliberately separate so that clearing a letter is not the same act as sending '
        + 'it.',
    });
  }

  // =========================================================================
  // RETURN — back to whoever prepared it
  // =========================================================================
  if (action === 'return') {
    const row = await load(body.id);
    if (!row) return bad('letter-not-found', 404);
    if (row.status !== 'awaiting_authority') {
      return bad('nothing-to-return', 409, `This letter is ${stateOf(row)}.`);
    }
    const reason = String(body.reason ?? '').trim();
    if (reason.length < 10) {
      return bad('return-needs-a-reason', 400,
        'Say what needs changing. The preparer cannot fix what they were not told.');
    }
    const { error } = await admin.from('correspondence').update({
      status: 'preparing', updated_at: new Date().toISOString(),
    }).eq('id', row.id as string);
    if (error) return bad(`not-returned: ${error.message}`, 500);
    await record(row.id as string, 'RETURNED', 'awaiting_authority', 'preparing', reason);
    return NextResponse.json({ ok: true, status: 'preparing' });
  }

  // =========================================================================
  // ISSUE — generate, archive, then send
  // =========================================================================
  if (action === 'issue') {
    const row = await load(body.id);
    if (!row) return bad('letter-not-found', 404);
    if (!canIssue(row)) {
      return bad('not-authorised-yet', 409,
        `This letter is ${stateOf(row)}. A letter is authorised before it is issued, and the two `
        + 'are different acts by design.');
    }

    const office = String(row.originating_office ?? 'vice-chancellor') as Office;
    const prefix = OFFICE_PREFIX[office];
    if (!prefix) return bad('unknown-office', 400);

    const year = new Date().getUTCFullYear();
    // ALLOCATED BY THE REGISTER, not counted here. Two officers issuing in the
    // same second used to both read "six letters this year" and both write
    // VC-2026-0007; the unique index caught the second, and an officer saw a
    // failure at the moment of issuing an official letter with no idea why.
    const { data: seq, error: seqError } =
      await admin.rpc('next_correspondence_sequence', { prefix, yr: year });
    if (seqError || typeof seq !== 'number') {
      return bad(`no-reference: ${seqError?.message ?? 'no sequence'}`, 500,
        'The register could not allocate a reference. Migration 046 may not have been run.');
    }
    const reference = buildReference(office, year, seq);

    const issuedOn = new Date().toISOString().slice(0, 10);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.iguc.net';

    let generated;
    try {
      generated = await correspondenceLetterHtml({
        correspondence: row,
        reference,
        issuedOn,
        version: 1,
        // THE AUTHORITY SIGNS, NOT THE PREPARER. A letter an administrator
        // typed for the Vice-Chancellor is a Vice-Chancellor's letter.
        signatoryName: String(body.signatoryName ?? caller.email ?? ''),
        signatoryRole: String(body.signatoryRole ?? 'Vice-Chancellor'),
        siteUrl,
      });
    } catch (e) {
      return bad('not-generated', 409, e instanceof Error ? e.message : String(e));
    }

    // ARCHIVED BEFORE IT IS MARKED ISSUED. If this fails the letter is still
    // authorised and can be issued again; the other order would leave a letter
    // recorded as sent with nothing in the archive to show what was sent.
    const { error: archiveError } = await admin.from('correspondence_letters').insert({
      correspondence_id: row.id as string,
      reference,
      version: 1,
      issued_on: issuedOn,
      html: generated.html,
      content_hash: await contentHash(generated.html),
      sealed: !!generated.seal,
      seal_code: generated.seal?.code ?? null,
      signatory_name: String(body.signatoryName ?? caller.email ?? ''),
      signatory_role: String(body.signatoryRole ?? 'Vice-Chancellor'),
      created_by: caller.id,
    });
    if (archiveError) return bad(`not-archived: ${archiveError.message}`, 500);
    await record(row.id as string, 'LETTER_GENERATED', row.status as string,
      row.status as string, reference);

    const now = new Date().toISOString();
    const { error } = await admin.from('correspondence').update({
      status: 'issued', issued_at: now, updated_at: now,
    }).eq('id', row.id as string);
    if (error) return bad(`not-issued: ${error.message}`, 500);
    await record(row.id as string, 'ISSUED', 'authorized', 'issued', reference);

    return NextResponse.json({
      ok: true,
      status: 'issued',
      reference,
      printed: generated.printed,
      sealed: !!generated.seal,
      // SAID OUT LOUD WHEN IT IS NOT SEALED. A letter that carries no
      // verification code must not be reported as though it does.
      ...(generated.seal ? {} : {
        detail: 'Issued and archived, but with no verification seal: the University’s '
          + 'signing secret is not configured in this deployment, so the letter says so on its '
          + 'face rather than showing a code that cannot be checked.',
      }),
    });
  }

  // =========================================================================
  // WITHDRAW
  // =========================================================================
  if (action === 'withdraw') {
    const row = await load(body.id);
    if (!row) return bad('letter-not-found', 404);
    if (!canWithdraw(row)) {
      return bad('already-gone', 409,
        row.status === 'issued'
          ? 'This letter has been issued. Somebody is holding it, and withdrawing the record '
            + 'would not unsend it — issue a further letter saying so.'
          : 'This letter was already withdrawn.');
    }
    const reason = String(body.reason ?? '').trim();
    if (reason.length < MIN_WITHDRAWAL_REASON) {
      return bad('withdrawal-needs-a-reason', 400,
        'Say why. A letter that disappears from the register with no explanation is the thing '
        + 'the register exists to prevent.');
    }
    const { error } = await admin.from('correspondence').update({
      status: 'withdrawn', withdrawn_reason: reason, updated_at: new Date().toISOString(),
    }).eq('id', row.id as string);
    if (error) return bad(`not-withdrawn: ${error.message}`, 500);
    await record(row.id as string, 'WITHDRAWN', row.status as string, 'withdrawn', reason);
    return NextResponse.json({ ok: true, status: 'withdrawn' });
  }

  return bad('unknown-action', 400);
}

// ---------------------------------------------------------------------------
// THE REGISTER, READ BACK
// ---------------------------------------------------------------------------
//
// GET /api/correspondence?status=…  — what the Correspondence Center lists.

export async function GET(request: Request) {
  const g = await guard(request, 'compose-correspondence' as Capability);
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return bad('service-role-key-missing', 500);
  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const status = new URL(request.url).searchParams.get('status');
  let q = admin.from('correspondence').select(COLUMNS).order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q.limit(200);
  if (error) return bad(`not-read: ${error.message}`, 500);

  const rows = (data ?? []) as Row[];
  return NextResponse.json({
    ok: true,
    letters: rows,
    // WHAT THIS CALLER MAY DO WITH EACH, computed once here rather than
    // re-derived by the screen. A button that appears and then refuses is worse
    // than one that was never offered.
    permissions: {
      mayAuthorize: can(g.caller.role as UserRole, 'authorize-correspondence' as Capability),
      mayIssue: can(g.caller.role as UserRole, 'issue-correspondence' as Capability),
      callerId: g.caller.id,
    },
  });
}
