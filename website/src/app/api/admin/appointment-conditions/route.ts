// ---------------------------------------------------------------------------
// THE CONDITIONS OF APPOINTMENT — editing the wording, and putting it in force.
//
//   POST /api/admin/appointment-conditions  { action, ... }
//
//   preamble { id, preamble }                       → approve-credential-design
//   clause   { id, section, ordinal, body }         → approve-credential-design
//   remove   { id, section, ordinal }               → approve-credential-design
//   activate { id }                                 → approve-credential-design
//   fork     { setId }        a new version to edit → approve-credential-design
//   forkPost { positionId }   a post's own set      → approve-credential-design
//
// ---------------------------------------------------------------------------
// WHY THIS EXISTS SEPARATELY FROM THE JOB DESCRIPTION ROUTE
// ---------------------------------------------------------------------------
//
// They look alike and they are not the same document. A job description says
// what the post-holder DOES. Conditions of appointment say what the University
// and the post-holder OWE EACH OTHER — duration, probation, notice,
// confidentiality, intellectual property. Running both through one route would
// mean one list of sections, and then either "Key Performance Indicators"
// appears in a contract or "Notice of termination" appears in a job
// description.
//
// The same capability decides both, for the reason the job description route
// already gives: 005 settled who decides what the University's documents say,
// and a second answer to that question is worse than a second route.
//
// ---------------------------------------------------------------------------
// WHY THIS ROUTE EXISTS AT ALL
// ---------------------------------------------------------------------------
//
// 078 seeded the conditions and nothing could change a word of them. A set of
// contract terms the University can only amend by writing SQL is not the
// University's document; it is mine. `reachability.test.mjs` said so — it
// found `position_default_conditions` read by a screen and written by nothing
// — and it was right.
//
// ---------------------------------------------------------------------------
// A DRAFT IS EDITABLE AND AN ACTIVE ONE IS NOT
// ---------------------------------------------------------------------------
//
// The same rule 048 applies to a job description, for a stronger reason: an
// active set is what somebody was appointed on. To change it the University
// forks a new version, edits that, and activates it; the old version stays,
// superseded, so an appointee in a dispute can still be shown the conditions
// that were in force on the day they accepted.
//
// THE SEEDED SETS ARE THE ONE EXCEPTION, AND ONLY ONCE. 078's eight sets are
// active with no author, so a fork is the only way to change them — which is
// exactly right, and is what this route makes possible.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { guard, audit } from '@/lib/adminAuth';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';
import type { Capability } from '@/lib/roles';
import { isConditionSection, CONDITION_LABELS, type ConditionSection } from '@/lib/appointmentConditions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

type Row = Record<string, unknown>;

const ACTIONS = ['preamble', 'clause', 'remove', 'activate', 'fork', 'forkPost'];

/** The same minimum 078 enforces on a clause body. */
const MIN_CLAUSE = 10;

/**
 * The sections a set must state before it can be put in force.
 *
 * NOT ALL TWENTY-TWO. A set that says nothing about allowances is a set under
 * which no allowance is payable, which is a coherent position. But a contract
 * silent on how long it lasts, what happens on notice, or what the
 * post-holder is actually for is not a contract anybody can rely on.
 */
const REQUIRED: ConditionSection[] = ['appointment', 'duration', 'duties', 'notice'];

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  if (!ACTIONS.includes(action)) {
    return bad('unknown-action', 400, `They are: ${ACTIONS.join(', ')}.`);
  }

  const g = await guard(request, 'approve-credential-design' as Capability);
  if (!g.ok) {
    return NextResponse.json({
      ok: false,
      error: g.error,
      detail: 'Conditions of appointment say what the University and a member of staff owe '
        + 'each other. Changing them is the same order of act as approving the design of a '
        + 'degree certificate, and the same offices decide it.',
    }, { status: g.status });
  }
  const { caller } = g;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return bad('service-role-key-missing', 500);
  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // =========================================================================
  // FORK — a new version of an existing set, copying its wording to edit
  // =========================================================================
  if (action === 'fork') {
    const setId = String(body.setId ?? '');
    if (!setId) return bad('no-set', 400);

    const { data: src } = await admin.from('appointment_condition_sets')
      .select('id, position_id, family, version, preamble').eq('id', setId).maybeSingle();
    const from = src as Row | null;
    if (!from) return bad('set-not-found', 404);

    // THE NEXT VERSION OF WHATEVER IT BELONGS TO. Asking the table rather
    // than adding one to the source's version, because a draft version 3 may
    // already exist and the unique index would refuse a second.
    const q = admin.from('appointment_condition_sets').select('version');
    const { data: latest } = await (from.position_id
      ? q.eq('position_id', from.position_id as string)
      : q.eq('family', from.family as string).is('position_id', null))
      .order('version', { ascending: false }).limit(1).maybeSingle();
    const version = Number((latest as Row | null)?.version ?? 0) + 1;

    const { data: made, error } = await admin.from('appointment_condition_sets').insert({
      position_id: from.position_id ?? null,
      family: from.family ?? null,
      version,
      status: 'draft',
      preamble: from.preamble ?? null,
      created_by: caller.id,
    }).select('id').single();
    if (error || !made) return bad(`not-created: ${error?.message ?? 'no row'}`, 500);

    // COPIED, NOT STARTED EMPTY. A new version of twenty-two conditions that
    // arrived blank would be retyped from the old one by hand, and the two
    // would differ in a way nobody intended.
    const { data: clauses } = await admin.from('appointment_condition_clauses')
      .select('section, ordinal, body').eq('set_id', setId);
    const rows = (clauses ?? []) as Row[];
    if (rows.length > 0) {
      await admin.from('appointment_condition_clauses').insert(
        rows.map((c) => ({
          set_id: (made as Row).id as string,
          section: c.section as string,
          ordinal: c.ordinal as number,
          body: c.body as string,
        })),
      );
    }

    await audit(admin, {
      action: 'appointment-conditions-forked', entityType: 'appointment_condition_set',
      entityId: (made as Row).id as string, performedBy: caller.id,
      details: { from: setId, version },
    });

    return NextResponse.json({
      ok: true,
      id: (made as Row).id,
      version,
      detail: `Version ${version} is a draft, carrying the ${rows.length} conditions of the `
        + 'version in force. Edit it, then put it in force — the version people were '
        + 'appointed under is kept, superseded, and never rewritten under them.',
    });
  }

  // =========================================================================
  // FORK POST — give one post conditions of its own
  // =========================================================================
  if (action === 'forkPost') {
    const positionId = String(body.positionId ?? '');
    if (!positionId) return bad('no-position', 400);

    const { data: post } = await admin.from('positions')
      .select('id, title, family').eq('id', positionId).maybeSingle();
    if (!post) return bad('position-not-found', 404);

    const { data: latest } = await admin.from('appointment_condition_sets')
      .select('version').eq('position_id', positionId)
      .order('version', { ascending: false }).limit(1).maybeSingle();
    const version = Number((latest as Row | null)?.version ?? 0) + 1;

    const { data, error } = await admin.from('appointment_condition_sets').insert({
      position_id: positionId,
      version,
      status: 'draft',
      created_by: caller.id,
    }).select('id').single();
    if (error || !data) return bad(`not-created: ${error?.message ?? 'no row'}`, 500);

    return NextResponse.json({
      ok: true,
      id: (data as Row).id,
      version,
      detail: `${(post as Row).title} now has a draft set of its own, version ${version}. `
        + 'It INHERITS its family’s conditions; a section you write here replaces the '
        + 'family’s for that section only, and leaves every other section alone.',
    });
  }

  // ---- EVERYTHING ELSE ACTS ON ONE SET ------------------------------------
  const { data: found } = await admin.from('appointment_condition_sets')
    .select('id, position_id, family, version, status, preamble, created_by')
    .eq('id', String(body.id ?? '')).maybeSingle();
  const set = found as Row | null;
  if (!set) return bad('set-not-found', 404);

  const editable = set.status === 'draft';
  const notEditable = () => bad('not-editable', 409,
    'These conditions are in force. Somebody was appointed on them, so they are not edited '
    + 'in place — make a new version instead, and the one people accepted stays on the '
    + 'record exactly as it was.');

  // =========================================================================
  // PREAMBLE
  // =========================================================================
  if (action === 'preamble') {
    if (!editable) return notEditable();
    const text = String(body.preamble ?? '').trim();
    const { error } = await admin.from('appointment_condition_sets')
      .update({ preamble: text || null, updated_at: new Date().toISOString() })
      .eq('id', set.id as string);
    if (error) return bad(`not-saved: ${error.message}`, 500);
    return NextResponse.json({ ok: true });
  }

  // =========================================================================
  // CLAUSE — write or replace one numbered condition
  // =========================================================================
  if (action === 'clause') {
    if (!editable) return notEditable();

    const section = String(body.section ?? '');
    const text = String(body.body ?? '').trim();
    const ordinal = Number(body.ordinal ?? 0);

    if (!isConditionSection(section)) {
      return bad('unknown-section', 400,
        'That is not a section of the conditions of appointment. The list is closed so that '
        + 'two posts cannot state the same term under two different headings — and so that a '
        + 'notice period is always found under "Notice".');
    }
    if (text.length < MIN_CLAUSE) {
      return bad('clause-too-short', 400,
        'A condition of five words is a heading somebody meant to come back to. Write the '
        + 'term, because this is what is read when it is disputed.');
    }
    if (!Number.isInteger(ordinal) || ordinal < 1) {
      return bad('bad-ordinal', 400, 'Conditions are numbered from 1.');
    }

    // UPSERT ON (set, section, ordinal), for the reason the job description
    // route gives: correcting a typo should not raise a conflict.
    const { error } = await admin.from('appointment_condition_clauses').upsert({
      set_id: set.id as string, section, ordinal, body: text,
    }, { onConflict: 'set_id,section,ordinal' });
    if (error) return bad(`not-saved: ${error.message}`, 500);
    return NextResponse.json({ ok: true });
  }

  // =========================================================================
  // REMOVE
  // =========================================================================
  if (action === 'remove') {
    if (!editable) return notEditable();
    const { error } = await admin.from('appointment_condition_clauses').delete()
      .eq('set_id', set.id as string)
      .eq('section', String(body.section ?? ''))
      .eq('ordinal', Number(body.ordinal ?? 0));
    if (error) return bad(`not-removed: ${error.message}`, 500);
    return NextResponse.json({ ok: true });
  }

  // =========================================================================
  // ACTIVATE — put it in force
  // =========================================================================
  if (action === 'activate') {
    if (set.status !== 'draft') {
      return bad('not-a-draft', 409, `These conditions are ${String(set.status)}.`);
    }
    // NOBODY ACTIVATES WHAT THEY WROTE. 078 refuses it at the table; this says
    // it in words first, because a constraint name is not an explanation.
    if (set.created_by && set.created_by === caller.id) {
      return bad('cannot-activate-your-own', 409,
        'You wrote these conditions, so you cannot also be the one who puts them in force. '
        + 'They state what the University may do to somebody’s employment, and one person '
        + 'should not be both the author and the authority.');
    }

    const { data: clauses } = await admin.from('appointment_condition_clauses')
      .select('section, ordinal, body').eq('set_id', set.id as string);
    const rows = (clauses ?? []) as Row[];
    const have = new Set(rows.map((c) => String(c.section)));
    const missing = REQUIRED.filter((s) => !have.has(s));

    if (missing.length > 0) {
      return NextResponse.json({
        ok: false,
        error: 'not-ready',
        missing,
        detail: 'These conditions do not yet say '
          + missing.map((s) => CONDITION_LABELS[s].toLowerCase()).join(', ')
          + '. A contract silent on how long it lasts, what the post-holder is for, or how '
          + 'either side ends it is not one anybody can rely on.',
      }, { status: 409 });
    }

    const now = new Date().toISOString();

    // THE PREVIOUS VERSION IS SUPERSEDED, NOT DELETED — somebody accepted it.
    if (set.position_id) {
      await admin.from('appointment_condition_sets').update({ status: 'superseded' })
        .eq('position_id', set.position_id as string).eq('status', 'active');
    } else if (set.family) {
      await admin.from('appointment_condition_sets').update({ status: 'superseded' })
        .eq('family', set.family as string).is('position_id', null).eq('status', 'active');
    }

    const { error } = await admin.from('appointment_condition_sets').update({
      status: 'active', activated_by: caller.id, activated_at: now,
      effective_from: now.slice(0, 10), updated_at: now,
    }).eq('id', set.id as string);
    if (error) return bad(`not-activated: ${error.message}`, 500);

    await audit(admin, {
      action: 'appointment-conditions-activated', entityType: 'appointment_condition_set',
      entityId: set.id as string, performedBy: caller.id,
      details: { version: set.version, clauses: rows.length },
    });

    return NextResponse.json({
      ok: true,
      detail: `In force from today. Appointments made from now on start from these ${have.size} `
        + 'conditions, and they can no longer be edited — make a new version to change them.',
    });
  }

  return bad('unknown-action', 400);
}
