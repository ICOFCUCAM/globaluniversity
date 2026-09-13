// ---------------------------------------------------------------------------
// THE JOB DESCRIPTIONS — editing the wording, and putting it in force.
//
//   POST /api/admin/job-description  { action, ... }
//
//   purpose  { id, jobPurpose }                     → approve-credential-design
//   clause   { id, section, ordinal, body }         → approve-credential-design
//   remove   { id, section, ordinal }               → approve-credential-design
//   activate { id }                                 → approve-credential-design
//   fork     { positionId }  a post's own profile   → approve-credential-design
//
// ---------------------------------------------------------------------------
// WHY THE SAME CAPABILITY AS A CERTIFICATE DESIGN
// ---------------------------------------------------------------------------
//
// A job description states what its holder may authorise, what they must
// escalate, and what they are assessed on. It is the document produced when a
// dismissal is challenged. That is the same order of act as approving the
// design of a degree certificate, and 005 already settled who may do it —
// inventing a parallel permission would mean two answers to "who decides what
// the University's documents say".
//
// ---------------------------------------------------------------------------
// A DRAFT IS EDITABLE AND AN ACTIVE ONE IS NOT
// ---------------------------------------------------------------------------
//
// 048 permits edits only while `status = 'draft'`. To change an active job
// description the University forks a new version — the old one stays, because
// somebody was appointed under it and `on delete restrict` holds it there.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { guard } from '@/lib/adminAuth';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';
import type { Capability } from '@/lib/roles';
import {
  isJdSection, canActivateProfile, objectionsToProfile, blocksApproval,
  MIN_PURPOSE, MIN_CLAUSE,
} from '@/lib/positions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

type Row = Record<string, unknown>;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  if (!['purpose', 'clause', 'remove', 'activate', 'fork'].includes(action)) {
    return bad('unknown-action', 400, 'They are: purpose, clause, remove, activate, fork.');
  }

  const g = await guard(request, 'approve-credential-design' as Capability);
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { caller } = g;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return bad('service-role-key-missing', 500);
  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // =========================================================================
  // FORK — give a post its own profile on top of its family's
  // =========================================================================
  if (action === 'fork') {
    const positionId = String(body.positionId ?? '');
    if (!positionId) return bad('no-position', 400);

    const { data: post } = await admin.from('positions')
      .select('id, title, family').eq('id', positionId).maybeSingle();
    if (!post) return bad('position-not-found', 404);

    const { data: latest } = await admin.from('position_profiles')
      .select('version').eq('position_id', positionId)
      .order('version', { ascending: false }).limit(1).maybeSingle();
    const version = Number((latest as Row | null)?.version ?? 0) + 1;

    const { data, error } = await admin.from('position_profiles').insert({
      position_id: positionId,
      version,
      status: 'draft',
      created_by: caller.id,
    }).select('id, version').single();
    if (error || !data) return bad(`not-created: ${error?.message ?? 'no row'}`, 500);

    return NextResponse.json({
      ok: true,
      id: (data as Row).id,
      version,
      detail: `${(post as Row).title} now has its own draft job description, version ${version}. `
        + 'It INHERITS its family’s clauses; anything you write here replaces the '
        + 'family’s for that section and leaves the rest.',
    });
  }

  const { data: found } = await admin.from('position_profiles')
    .select('id, position_id, family, version, job_purpose, status, created_by')
    .eq('id', String(body.id ?? '')).maybeSingle();
  const profile = found as Row | null;
  if (!profile) return bad('profile-not-found', 404);

  const editable = profile.status === 'draft';

  // =========================================================================
  // PURPOSE
  // =========================================================================
  if (action === 'purpose') {
    if (!editable) {
      return bad('not-editable', 409,
        'This job description is in force. Somebody was appointed under it, so it is not '
        + 'edited in place — create a new version instead.');
    }
    const purpose = String(body.jobPurpose ?? '').trim();
    if (purpose.length < MIN_PURPOSE) {
      return bad('purpose-too-short', 400,
        'Say why the post exists. It is the first question at any review, and a job '
        + 'description without it is a list of tasks.');
    }
    const { error } = await admin.from('position_profiles')
      .update({ job_purpose: purpose, updated_at: new Date().toISOString() })
      .eq('id', profile.id as string);
    if (error) return bad(`not-saved: ${error.message}`, 500);
    return NextResponse.json({ ok: true });
  }

  // =========================================================================
  // CLAUSE — write or replace one numbered duty
  // =========================================================================
  if (action === 'clause') {
    if (!editable) return bad('not-editable', 409, 'This job description is in force.');

    const section = String(body.section ?? '');
    const text = String(body.body ?? '').trim();
    const ordinal = Number(body.ordinal ?? 0);

    if (!isJdSection(section)) {
      return bad('unknown-section', 400,
        'That is not a section of a job description. The list is closed so that two posts '
        + 'cannot describe the same duty under two different headings.');
    }
    if (text.length < MIN_CLAUSE) return bad('clause-too-short', 400);
    if (!Number.isInteger(ordinal) || ordinal < 1) {
      return bad('bad-ordinal', 400, 'Responsibilities are numbered from 1.');
    }

    // UPSERT ON (profile, section, ordinal). Writing clause 2 twice replaces
    // it rather than producing two number twos — the unique index would refuse
    // the second, and an officer correcting a typo should not see a conflict.
    const { error } = await admin.from('position_profile_clauses').upsert({
      profile_id: profile.id as string,
      section,
      ordinal,
      body: text,
    }, { onConflict: 'profile_id,section,ordinal' });
    if (error) return bad(`not-saved: ${error.message}`, 500);
    return NextResponse.json({ ok: true });
  }

  // =========================================================================
  // REMOVE
  // =========================================================================
  if (action === 'remove') {
    if (!editable) return bad('not-editable', 409, 'This job description is in force.');
    const { error } = await admin.from('position_profile_clauses').delete()
      .eq('profile_id', profile.id as string)
      .eq('section', String(body.section ?? ''))
      .eq('ordinal', Number(body.ordinal ?? 0));
    if (error) return bad(`not-removed: ${error.message}`, 500);
    return NextResponse.json({ ok: true });
  }

  // =========================================================================
  // ACTIVATE — put it in force
  // =========================================================================
  if (action === 'activate') {
    if (!canActivateProfile(profile, caller.id)) {
      return bad(
        profile.created_by === caller.id ? 'cannot-activate-your-own' : 'not-a-draft',
        409,
        profile.created_by === caller.id
          ? 'You wrote this job description, so you cannot also be the one who puts it in '
            + 'force. It states what its holder may authorise and what they are assessed on.'
          : `This job description is ${String(profile.status)}.`,
      );
    }

    const { data: clauses } = await admin.from('position_profile_clauses')
      .select('section, ordinal, body').eq('profile_id', profile.id as string);

    const objections = objectionsToProfile(profile, (clauses ?? []) as Row[]);
    if (blocksApproval(objections)) {
      return NextResponse.json({
        ok: false, error: 'not-ready', objections,
        detail: 'This job description is not complete enough to put in force.',
      }, { status: 409 });
    }

    const now = new Date().toISOString();
    // THE PREVIOUS VERSION IS SUPERSEDED, NOT DELETED. Somebody was appointed
    // under it, and 048's `on delete restrict` holds it there whatever a screen
    // would like to do.
    if (profile.position_id) {
      await admin.from('position_profiles').update({ status: 'superseded' })
        .eq('position_id', profile.position_id as string).eq('status', 'active');
    } else if (profile.family) {
      await admin.from('position_profiles').update({ status: 'superseded' })
        .eq('family', profile.family as string).is('position_id', null).eq('status', 'active');
    }

    const { error } = await admin.from('position_profiles').update({
      status: 'active', activated_by: caller.id, activated_at: now, updated_at: now,
    }).eq('id', profile.id as string);
    if (error) return bad(`not-activated: ${error.message}`, 500);

    return NextResponse.json({
      ok: true,
      detail: 'In force. Appointments made from now on may carry it, and it can no longer be '
        + 'edited — a job description somebody was appointed under is not rewritten under them.',
      warnings: objections.filter((o) => !o.blocking),
    });
  }

  return bad('unknown-action', 400);
}
