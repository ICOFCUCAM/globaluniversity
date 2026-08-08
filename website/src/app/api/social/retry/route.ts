// ---------------------------------------------------------------------------
// TRYING A FAILED DESTINATION AGAIN.
//
// POST { postId }                 -> re-queue every failed target of this post
// POST { postId, targetId }       -> re-queue one
//
//   "failed-publication handling"
//
// ---------------------------------------------------------------------------
// RETRY IS PER DESTINATION, NEVER PER POST
// ---------------------------------------------------------------------------
//
// When one network refuses an announcement that five accepted, the obvious
// button — "publish again" — is the wrong one. It would put the same
// announcement on the five accounts that already have it, and the University
// would appear to have posted the graduation twice while still not having
// reached the sixth.
//
// So only the failed target rows are re-queued, in place, and the attempt count
// goes up. The five that worked are untouched and their `posted_at` stands.
//
// ---------------------------------------------------------------------------
// A 'SKIPPED' TARGET IS NOT RETRYABLE
// ---------------------------------------------------------------------------
//
// It was skipped because its connection was expired or revoked when the post
// went out. Trying again without reconnecting the account produces the same
// result plus a second failure in the log, and teaches the operator that the
// retry button does not work. The answer is Settings → Connected accounts.
//
// ---------------------------------------------------------------------------
// NO CAP IN THE DATABASE, AND A SOFT ONE HERE
// ---------------------------------------------------------------------------
//
// A network down for a day should be retried tomorrow, so migration 014 counts
// attempts without refusing any. This route warns past a handful rather than
// refusing, because the operator can see the error and knows things the system
// does not — a schema that refused the fourth attempt would turn a temporary
// outage into a permanent gap in the University's record.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';

export const runtime = 'nodejs';

/** Past this, the interface says so. It does not refuse. */
const NOISY_AFTER = 5;

export async function POST(request: Request) {
  const g = await guard(request, 'publish-social-post');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin, caller } = g;

  let input: { postId?: string; targetId?: string };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  if (!input.postId) return NextResponse.json({ ok: false, error: 'no-post' }, { status: 400 });

  let query = admin
    .from('social_post_targets')
    .select('id, status, attempts, last_error, account_id')
    .eq('post_id', input.postId);

  if (input.targetId) query = query.eq('id', input.targetId);

  const { data: targets, error } = await query;

  if (error) {
    return NextResponse.json({ ok: false, error: 'unreadable', detail: error.message }, { status: 500 });
  }

  const failed = (targets ?? []).filter((t) => t.status === 'failed');

  if (failed.length === 0) {
    const skipped = (targets ?? []).filter((t) => t.status === 'skipped');
    return NextResponse.json({
      ok: false,
      error: 'nothing-to-retry',
      detail: skipped.length > 0
        ? `Nothing here failed. ${skipped.length} ${skipped.length === 1 ? 'destination was' : 'destinations were'} `
          + 'skipped because the connection had expired or been revoked — reconnect the account in '
          + 'Settings and publish again, rather than retrying.'
        : 'Every destination on this post either succeeded or is still in progress.',
    }, { status: 422 });
  }

  // ONE WRITE PER ROW, because each carries its own attempt count.
  //
  // PostgREST cannot express `attempts = attempts + 1` in a bulk update, and
  // the obvious workaround — one bulk update setting the status, then a loop
  // setting the counts — is worse than it looks: the first write would put
  // `attempts: 0` on every row, and a failure between the two would leave the
  // register saying these destinations had never been tried. A handful of rows
  // does not justify losing that.
  //
  // COUNTED, NOT RESET. "This has failed six times" is the fact an operator
  // needs; zeroing the count on each retry hides a destination that will never
  // work behind a number that always reads 1.
  const now = new Date().toISOString();
  const results = await Promise.all(failed.map((t) =>
    admin.from('social_post_targets')
      .update({
        status: 'pending',
        attempts: (t.attempts ?? 0) + 1,
        last_attempt_at: now,
      })
      .eq('id', t.id)));

  const writeErr = results.find((r) => r.error)?.error;
  if (writeErr) {
    // PARTIAL SUCCESS IS REPORTED AS PARTIAL. Some rows may already be
    // re-queued; saying "nothing happened" would have the operator press the
    // button again and double the counts on the ones that worked.
    const requeued = results.filter((r) => !r.error).length;
    return NextResponse.json({
      ok: false,
      error: 'partly-requeued',
      detail: writeErr.message.includes('last_attempt_at')
        ? 'Run docs/migrations/014_social_approval_and_retry.sql.'
        : `${requeued} of ${failed.length} destinations were re-queued before this failed: `
          + `${writeErr.message}. Check the publication log before retrying, or the ones that `
          + 'worked will be counted twice.',
    }, { status: 500 });
  }

  // The post is publishing again, whatever it was before.
  await admin.from('social_posts').update({ status: 'publishing' }).eq('id', input.postId);

  await admin.from('audit_logs').insert({
    action: 'social.retried',
    entity_type: 'social_post',
    entity_id: input.postId,
    performed_by: caller.id,
    details: { targets: failed.length, attempts: failed.map((t) => (t.attempts ?? 0) + 1) },
  });

  const stubborn = failed.filter((t) => (t.attempts ?? 0) + 1 > NOISY_AFTER).length;

  return NextResponse.json({
    ok: true,
    requeued: failed.length,
    message:
      `${failed.length} ${failed.length === 1 ? 'destination' : 'destinations'} re-queued. `
      + 'The ones that already published are untouched.'
      + (stubborn > 0
        ? ` ${stubborn} of them ${stubborn === 1 ? 'has' : 'have'} now failed more than `
          + `${NOISY_AFTER} times — the connection is more likely at fault than the network.`
        : '')
      // The same honesty as the publish route. Nothing is dispatched until the
      // University registers its platform applications.
      + ' Nothing leaves the University until a platform application is connected;'
      + ' see docs/SOCIAL-CONNECTIONS.md.',
  });
}
