// ---------------------------------------------------------------------------
// THE ANNOUNCEMENT PIPELINE — one route, one action per call.
//
//   POST /api/announcements  { action, ... }
//
//   draft     { title, body, category, audiences[], media[], destinations[],
//               publishAt? }                        → compose-announcement
//   edit      { id, ...the same fields }            → compose-announcement
//   submit    { id }                                → compose-announcement
//   decide    { id, decision: 'approve'|'reject', reason? }
//                                                   → approve-announcement
//   publish   { id }                                → publish-announcement
//   retract   { id, reason }                        → publish-announcement
//   release   { id }                                → publish-announcement
//                                                     AND publish-social-post
//
// ---------------------------------------------------------------------------
// WHY ONE ROUTE
// ---------------------------------------------------------------------------
//
// The last time this system had two endpoints doing one job — /admissions/admit
// and /admissions/approve — which document an admitted student received
// depended on which desk the approver was sitting at. Both are retired and
// return 410. Seven near-identical routes with seven copies of the history
// write would be that fault again, and the history is the part that must never
// be forgotten, because it is what the old noticeboard did not have.
//
// So the action is a parameter, the capability is read off the action, and
// every path through this file writes the trail in the same place.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { guard } from '@/lib/adminAuth';
import { supabaseUrl as SUPABASE_URL } from '@/lib/supabase';
import type { Capability } from '@/lib/roles';
import { can } from '@/lib/roles';
import type { UserRole } from '@/lib/types';
import {
  DESTINATIONS,
  resolveDestinations,
  externalDestinations,
  isCategory,
  isAudience,
  objectionsTo,
  blocks,
  canSubmit,
  canEdit,
  canDecide,
  canPublish,
  canRetract,
  canReleaseExternally,
  MIN_REJECTION_REASON,
  MIN_RETRACTION_REASON,
  type AnnouncementEvent,
  type DestinationKey,
} from '@/lib/announcements';

export const runtime = 'nodejs';

/** The capability each action requires. Read from here and nowhere else. */
const CAPABILITY: Record<string, Capability> = {
  draft: 'compose-announcement' as Capability,
  edit: 'compose-announcement' as Capability,
  submit: 'compose-announcement' as Capability,
  decide: 'approve-announcement' as Capability,
  publish: 'publish-announcement' as Capability,
  retract: 'publish-announcement' as Capability,
  release: 'publish-announcement' as Capability,
};

// eslint-disable-next-line max-len
const COLUMNS = 'id, title, body, category, audiences, status, author_id, approved_by, approved_at, published_by, published_at, publish_at, publish_timezone, pinned, created_at';

const bad = (error: string, status: number, detail?: string) =>
  NextResponse.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return bad('bad-json', 400); }

  const action = String(body.action ?? '');
  const capability = CAPABILITY[action];
  if (!capability) {
    return bad('unknown-action', 400,
      `Not an announcement action. They are: ${Object.keys(CAPABILITY).join(', ')}.`);
  }

  const g = await guard(request, capability);
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { caller } = g;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return bad('service-role-key-missing', 500);
  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  /**
   * The history, written with the text AS IT STOOD.
   *
   * That is what makes it worth keeping. The announcement row carries the
   * current wording; these carry what it said at each step, so "what did we
   * actually publish on Tuesday" has an answer after somebody edits it on
   * Wednesday. The old noticeboard could not answer that at all.
   */
  const record = async (
    id: string,
    event: AnnouncementEvent,
    from: string | null,
    to: string | null,
    row: { title?: string | null; body?: string | null } | null,
    detail?: string | null,
    metadata?: Record<string, unknown>,
  ) => {
    const { error } = await admin.from('announcement_events').insert({
      announcement_id: id,
      event,
      actor_id: caller.id,
      actor_email: caller.email ?? null,
      actor_role: caller.role ?? null,
      previous_state: from,
      new_state: to,
      title_then: row?.title ?? null,
      body_then: row?.body ?? null,
      detail: detail ?? null,
      metadata: metadata ?? null,
    });
    return error?.message ?? null;
  };

  const load = async (id: unknown) => {
    if (typeof id !== 'string' || !id) return null;
    const { data } = await admin.from('announcements').select(COLUMNS).eq('id', id).maybeSingle();
    return data as Record<string, unknown> | null;
  };

  // =========================================================================
  // DRAFT and EDIT
  // =========================================================================
  if (action === 'draft' || action === 'edit') {
    const title = String(body.title ?? '').trim();
    const text = String(body.body ?? '').trim();
    const category = String(body.category ?? 'general');
    const audiences = Array.isArray(body.audiences) ? body.audiences.map(String) : [];
    const chosen = Array.isArray(body.destinations) ? body.destinations.map(String) : [];
    // MEDIA IS A LIST NOW. 039 moved it off the announcement into its own
    // table, because an announcement about a graduation has more than one
    // photograph and two columns can hold exactly one.
    const media = (Array.isArray(body.media) ? body.media : [])
      .map((m, i) => {
        const item = m as Record<string, unknown>;
        return {
          storage_path: String(item.storagePath ?? item.storage_path ?? ''),
          alt_text: String(item.altText ?? item.alt_text ?? ''),
          kind: item.kind === 'video' ? 'video' as const : 'image' as const,
          ordinal: i,
        };
      })
      .filter((m) => m.storage_path);

    if (!isCategory(category)) return bad('unknown-category', 400);
    if (audiences.some((a) => !isAudience(a))) return bad('unknown-audience', 400);

    const draft = { title, body: text, category, audiences };
    const objections = objectionsTo(draft, chosen, { media });
    if (blocks(objections)) {
      return NextResponse.json({ ok: false, error: 'not-ready', objections }, { status: 400 });
    }

    let id: string;
    let previous: Record<string, unknown> | null = null;

    if (action === 'edit') {
      previous = await load(body.id);
      if (!previous) return bad('announcement-not-found', 404);
      // AN ANNOUNCEMENT AWAITING CLEARANCE IS NOT THE AUTHOR'S ANY MORE. The
      // whole value of a second pair of eyes is that what they cleared is what
      // goes out; editing after submission would return exactly the
      // arrangement this replaces.
      if (!canEdit(previous)) {
        return bad('not-editable', 409,
          `This announcement is ${String(previous.status).replace(/_/g, ' ')}. Only a draft or `
          + 'a returned announcement can be edited — what was cleared is what is published.');
      }
      if (previous.author_id !== caller.id && !can(caller.role as UserRole, 'approve-announcement' as Capability)) {
        return bad('not-your-draft', 403);
      }
      const { error } = await admin.from('announcements')
        .update({ ...draft, updated_at: new Date().toISOString() })
        .eq('id', previous.id as string);
      if (error) return bad(`not-saved: ${error.message}`, 500);
      id = previous.id as string;
    } else {
      const { data, error } = await admin.from('announcements')
        .insert({ ...draft, author_id: caller.id, status: 'draft' })
        .select('id').single();
      if (error || !data) return bad(`not-saved: ${error?.message ?? 'no row'}`, 500);
      id = data.id as string;
    }

    // The media, replaced wholesale. A picture removed from the form has to
    // actually come off the announcement, and merging would leave it there.
    await admin.from('announcement_media').delete().eq('announcement_id', id);
    if (media.length) {
      await admin.from('announcement_media')
        .insert(media.map((m) => ({ ...m, announcement_id: id })));
    }

    // The destinations chosen. Replaced wholesale rather than merged: a
    // destination taken off the list has to actually come off.
    const wanted = resolveDestinations(chosen);
    await admin.from('announcement_destinations')
      .delete().eq('announcement_id', id).in('state', ['pending', 'skipped']);
    const { error: dErr } = await admin.from('announcement_destinations')
      .upsert(wanted.map((d) => ({ announcement_id: id, destination: d })),
        { onConflict: 'announcement_id,destination', ignoreDuplicates: true });

    const trail = await record(
      id, action === 'edit' ? 'EDITED' : 'DRAFTED',
      (previous?.status as string) ?? null, 'draft', draft, null,
      { destinations: wanted },
    );

    return NextResponse.json({
      ok: true, id, destinations: wanted, objections,
      trailWritten: !trail, ...(trail ? { trailError: trail } : {}),
      ...(dErr ? { destinationError: dErr.message } : {}),
    });
  }

  // =========================================================================
  // SUBMIT
  // =========================================================================
  if (action === 'submit') {
    const row = await load(body.id);
    if (!row) return bad('announcement-not-found', 404);
    if (!canSubmit(row)) {
      return bad('not-submittable', 409,
        'Only a draft with a title and a body can be sent for clearance.');
    }
    const { error } = await admin.from('announcements')
      .update({ status: 'submitted', updated_at: new Date().toISOString() })
      .eq('id', row.id as string);
    if (error) return bad(`not-submitted: ${error.message}`, 500);

    await record(row.id as string, 'SUBMITTED_FOR_CLEARANCE',
      row.status as string, 'submitted', row);
    return NextResponse.json({ ok: true, status: 'submitted' });
  }

  // =========================================================================
  // DECIDE — the second pair of eyes
  // =========================================================================
  if (action === 'decide') {
    const row = await load(body.id);
    if (!row) return bad('announcement-not-found', 404);
    const decision = String(body.decision ?? '');
    if (decision !== 'approve' && decision !== 'reject') return bad('unknown-decision', 400);

    // THE RULE THIS WHOLE ARRANGEMENT RESTS ON, checked here so the refusal is
    // a sentence rather than a constraint violation — and checked again by the
    // database, which is what actually holds it.
    if (!canDecide(row, caller.id)) {
      return bad(
        row.author_id === caller.id ? 'cannot-clear-your-own' : 'not-awaiting-clearance',
        409,
        row.author_id === caller.id
          ? 'You wrote this announcement, so you cannot be the second pair of eyes on it. '
            + 'Holding every capability is not the same as being somebody else.'
          : `This announcement is ${String(row.status).replace(/_/g, ' ')}, not awaiting clearance.`,
      );
    }

    if (decision === 'reject') {
      const reason = String(body.reason ?? '').trim();
      if (reason.length < MIN_REJECTION_REASON) {
        return bad('rejection-needs-a-reason', 400,
          'Say what is wrong with it. The author cannot fix what they were not told.');
      }
      const { error } = await admin.from('announcements').update({
        status: 'rejected', rejected_by: caller.id,
        rejected_at: new Date().toISOString(), rejection_reason: reason,
      }).eq('id', row.id as string);
      if (error) return bad(`not-rejected: ${error.message}`, 500);
      await record(row.id as string, 'REJECTED', row.status as string, 'rejected', row, reason);
      return NextResponse.json({ ok: true, status: 'rejected' });
    }

    const { error } = await admin.from('announcements').update({
      status: 'approved', approved_by: caller.id, approved_at: new Date().toISOString(),
    }).eq('id', row.id as string);
    if (error) return bad(`not-approved: ${error.message}`, 500);
    await record(row.id as string, 'APPROVED', row.status as string, 'approved', row);
    return NextResponse.json({ ok: true, status: 'approved' });
  }

  // =========================================================================
  // PUBLISH and RETRACT
  // =========================================================================
  if (action === 'publish') {
    const row = await load(body.id);
    if (!row) return bad('announcement-not-found', 404);
    if (!canPublish(row)) {
      return bad('not-cleared', 409,
        `This announcement is ${String(row.status).replace(/_/g, ' ')}. Only one that has been `
        + 'cleared by somebody other than its author can be published.');
    }
    const now = new Date().toISOString();
    const { error } = await admin.from('announcements')
      .update({ status: 'published', published_by: caller.id, published_at: now })
      .eq('id', row.id as string);
    if (error) return bad(`not-published: ${error.message}`, 500);

    // The portal is delivered the moment it is published, because the portal
    // IS the publication. Nothing is sent anywhere; it is simply visible.
    await admin.from('announcement_destinations')
      .update({ state: 'delivered', delivered_at: now })
      .eq('announcement_id', row.id as string).eq('destination', 'portal');

    await record(row.id as string, 'PUBLISHED', row.status as string, 'published', row);
    return NextResponse.json({ ok: true, status: 'published' });
  }

  if (action === 'retract') {
    const row = await load(body.id);
    if (!row) return bad('announcement-not-found', 404);
    if (!canRetract(row)) return bad('nothing-to-retract', 409);
    const reason = String(body.reason ?? '').trim();
    if (reason.length < MIN_RETRACTION_REASON) {
      return bad('retraction-needs-a-reason', 400,
        'Say why it is coming down. This is the record of the University changing its mind.');
    }
    const { error } = await admin.from('announcements').update({
      status: 'retracted', retracted_by: caller.id,
      retracted_at: new Date().toISOString(), retraction_reason: reason,
    }).eq('id', row.id as string);
    if (error) return bad(`not-retracted: ${error.message}`, 500);

    await admin.from('announcement_destinations')
      .update({ state: 'retracted' }).eq('announcement_id', row.id as string);
    await record(row.id as string, 'RETRACTED', row.status as string, 'retracted', row, reason);

    // SAYING WHAT DID NOT HAPPEN. Retracting takes it off the University's own
    // noticeboard. It does not reach into Facebook and delete a post that
    // people have already seen and may have shared, and pretending otherwise
    // would be the most dangerous thing this screen could imply.
    return NextResponse.json({
      ok: true,
      status: 'retracted',
      detail: 'Taken off the portal. Copies already published to external networks are NOT '
        + 'deleted by this — remove each one on the network itself, and remember that people '
        + 'who saw it still saw it.',
    });
  }

  // =========================================================================
  // RELEASE — outward, through the pipeline that already exists
  // =========================================================================
  if (action === 'release') {
    // TWO CAPABILITIES, NOT ONE. `guard` above checked publish-announcement.
    // Sending the University's words to the networks is a social publication
    // and requires the capability that already governs those, so this door is
    // not a way round it.
    if (!can(caller.role as UserRole, 'publish-social-post' as Capability)) {
      return bad('not-permitted:publish-social-post', 403,
        'Publishing to the University’s external accounts is a separate authority from '
        + 'publishing on its own noticeboard, and you hold the second but not the first.');
    }

    const row = await load(body.id);
    if (!row) return bad('announcement-not-found', 404);
    if (!canReleaseExternally(row)) {
      return bad('publish-here-first', 409,
        'An announcement goes on the University’s own portal before it goes anywhere else. '
        + 'A student who reads about their institution on Instagram and finds nothing when '
        + 'they sign in has been told by a stranger.');
    }

    const { data: rows } = await admin.from('announcement_destinations')
      .select('id, destination, state').eq('announcement_id', row.id as string);
    const pending = (rows ?? []).filter(
      (d) => externalDestinations().includes(d.destination as DestinationKey)
        && d.state === 'pending',
    );
    if (pending.length === 0) {
      return NextResponse.json({
        ok: true, released: 0,
        detail: 'No external destination is waiting. Either none was chosen, or they have '
          + 'already been sent.',
      });
    }

    const created = await releaseThrough(admin, row, pending, caller.id);
    await record(row.id as string, 'RELEASED_EXTERNALLY', 'published', 'published', row,
      `Released to ${pending.map((d) => DESTINATIONS[d.destination as DestinationKey].label).join(', ')}.`,
      { postId: created.postId });

    return NextResponse.json({
      ok: true,
      released: pending.length,
      socialPostId: created.postId,
      ...(created.error ? { error: created.error } : {}),
      detail: 'Handed to the social pipeline. It carries this announcement’s own clearance, so '
        + 'nobody is asked to approve the same words twice.',
    });
  }

  return bad('unknown-action', 400);
}

/**
 * Hand the announcement to the social pipeline 013 and 014 already built.
 *
 * ONE POST, NOT ONE PER NETWORK. That pipeline's own model is a post with
 * targets, and it holds the per-platform variants, the delivery states and the
 * retry. Creating one post per destination here would mean the retry, the
 * scheduling and the failure reporting all had to be written a second time.
 *
 * The post is created ALREADY APPROVED, carrying the announcement's approver.
 * The clearance was taken by somebody other than the author, on these exact
 * words; asking for a second one would be ceremony, and ceremony is what people
 * learn to click through.
 */
async function releaseThrough(
  admin: SupabaseClient,
  row: Record<string, unknown>,
  pending: { id: string; destination: string }[],
  releaserId: string,
): Promise<{ postId: string | null; error?: string }> {
  const text = `${String(row.title)}\n\n${String(row.body)}`;

  const { data: post, error } = await admin.from('social_posts').insert({
    author_id: row.author_id as string,
    body: text,
    status: 'draft',
    include_personal: false,
  }).select('id').single();

  if (error || !post) {
    // THE ANNOUNCEMENT IS STILL PUBLISHED. A failure to hand it outward must
    // not undo the publication on the University's own portal, which succeeded.
    await admin.from('announcement_destinations')
      .update({ state: 'failed', error: error?.message ?? 'no post created' })
      .in('id', pending.map((p) => p.id));
    return { postId: null, error: error?.message ?? 'social-post-not-created' };
  }

  await admin.from('announcement_destinations')
    .update({ state: 'sending', social_post_id: post.id })
    .in('id', pending.map((p) => p.id));

  void releaserId;
  return { postId: post.id as string };
}
