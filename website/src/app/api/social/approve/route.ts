// ---------------------------------------------------------------------------
// MOVING A POST THROUGH REVIEW.
//
// POST { postId, to: 'submitted' | 'approved' | 'rejected' | 'draft', note? }
//
//   "approval workflow"
//
// ---------------------------------------------------------------------------
// THE RULE THIS ROUTE EXISTS FOR
// ---------------------------------------------------------------------------
//
// The author of a post may not approve it. That is the same separation of
// duties the University required of certificate designs in 005 and of grades in
// 009: the office that writes does not sign off its own work.
//
// An announcement is the institution speaking. One person composing, approving
// and publishing it alone is exactly the arrangement that puts an unconsidered
// sentence on six networks under the University's name, at which point the only
// remaining control is a deletion that half the internet has already seen.
//
// Enforced three times over, and the redundancy is deliberate:
//   `canApprove` in src/lib/social.ts, so the button is not drawn;
//   this route, so the button not being drawn is not the only thing stopping it;
//   `social_posts_approval_trg` in migration 014, in the database.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';
import { can, type Capability } from '@/lib/roles';
import { canApprove, type ApprovalState } from '@/lib/social';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  // The lowest capability that has business on this screen. What the caller may
  // actually DO comes from canApprove against their real role.
  const g = await guard(request, 'compose-social-post');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin, caller } = g;

  let input: { postId?: string; to?: ApprovalState; note?: string };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  if (!input.postId || !input.to) {
    return NextResponse.json({ ok: false, error: 'incomplete' }, { status: 400 });
  }

  const { data: post, error } = await admin
    .from('social_posts')
    .select('id, author_id, approval_state, status, body')
    .eq('id', input.postId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({
      ok: false,
      error: 'unreadable',
      detail: error.message.includes('approval_state')
        ? 'The approval columns are not in the database. Run docs/migrations/014_social_approval_and_retry.sql.'
        : error.message,
    }, { status: 500 });
  }
  if (!post) return NextResponse.json({ ok: false, error: 'not-found' }, { status: 404 });

  // A POST THAT HAS ALREADY GONE OUT IS NOT REVIEWABLE. Approving something
  // already on six networks is theatre, and rejecting it does not unpublish it.
  if (['published', 'partially_failed', 'publishing'].includes(post.status)) {
    return NextResponse.json({
      ok: false,
      error: 'already-out',
      detail:
        'This post has already been published. Review happens before publication, not after — '
        + 'if it should not have gone out, that is a deletion on each network rather than a '
        + 'change of state here.',
    }, { status: 409 });
  }

  const verdict = canApprove({
    from: (post.approval_state ?? 'draft') as ApprovalState,
    to: input.to,
    actorId: caller.id,
    authorId: post.author_id,
    holds: (c) => can(caller.role, c as Capability),
    note: input.note,
  });

  if (!verdict.allowed) {
    return NextResponse.json({ ok: false, error: 'refused', detail: verdict.reason }, { status: 403 });
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { approval_state: input.to };

  if (input.to === 'submitted') {
    patch.submitted_by = caller.id;
    patch.submitted_at = now;
  } else if (input.to === 'approved') {
    patch.approved_by = caller.id;
    patch.approved_at = now;
    patch.review_note = input.note?.trim() || null;
  } else if (input.to === 'rejected') {
    patch.review_note = input.note?.trim() || null;
  } else if (input.to === 'draft') {
    // Reopening clears the previous decision rather than leaving a stale
    // approval attached to words that are about to change.
    patch.approved_by = null;
    patch.approved_at = null;
    patch.submitted_at = null;
  }

  const { error: writeErr } = await admin
    .from('social_posts')
    .update(patch)
    .eq('id', post.id);

  if (writeErr) {
    return NextResponse.json({
      ok: false,
      error: 'not-moved',
      detail: writeErr.message.includes('may not approve it')
        // The database refused something this route allowed. That means the two
        // copies of the rule disagree, which is worth reporting rather than
        // working around.
        ? 'The database refused this approval. The route and the trigger disagree about who may '
          + 'approve — this is a fault and should be reported rather than retried.'
        : writeErr.message,
    }, { status: 500 });
  }

  await admin.from('audit_logs').insert({
    action: `social.${input.to}`,
    entity_type: 'social_post',
    entity_id: post.id,
    performed_by: caller.id,
    details: { from: post.approval_state ?? 'draft', to: input.to, note: input.note ?? null },
  });

  const message = input.to === 'approved'
    ? 'Approved. It can now be published or scheduled.'
    : input.to === 'rejected'
      ? 'Sent back to the author with your note.'
      : input.to === 'submitted'
        ? 'Sent for review. Another administrator has to read it before it can go out.'
        : 'Reopened for editing.';

  return NextResponse.json({ ok: true, message });
}
