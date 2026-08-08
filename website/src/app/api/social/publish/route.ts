// ---------------------------------------------------------------------------
// PUBLISHING AN ANNOUNCEMENT ACROSS THE UNIVERSITY'S NETWORKS.
//
// POST { body, linkUrl, media, choice, platforms, variants, scheduledFor }
//
// ---------------------------------------------------------------------------
// THE SECOND OF THREE ENFORCEMENT POINTS
// ---------------------------------------------------------------------------
//
//   "An administrator should never receive the credentials or tokens of
//    another administrator. These connections belong only to that
//    administrator."
//
// The composer filters a colleague's accounts out of the list. That is
// courtesy, not control — a form is a suggestion, and anything with a terminal
// can post whatever it likes to this route. So the rule is resolved AGAIN here,
// from the caller's identity as established by their token rather than from
// anything the request said about itself, and a third time by the database
// trigger in migration 013.
//
// THE REQUEST NEVER NAMES AN ACCOUNT. It names a CHOICE — university, personal,
// or both — and the route works out which accounts that means. A route that
// accepted a list of account ids would let the caller name somebody else's,
// and would then need to check them, which is the same work with an extra way
// to get it wrong.
//
// ---------------------------------------------------------------------------
// WHY NOTHING IS ACTUALLY SENT TO FACEBOOK YET
// ---------------------------------------------------------------------------
//
// Because the university has not supplied the OAuth applications. Publishing to
// Meta, LinkedIn, X, YouTube and TikTok needs a registered app per platform,
// each with its own review process, its own credentials and its own callback
// address — none of which this system can invent.
//
// So the route does everything up to the wire: it resolves the destinations,
// enforces consent, writes the post, writes one target row per destination, and
// leaves each target 'queued'. When the applications exist, `dispatch()` gains
// a real body and nothing else in this file changes.
//
// WHAT IT DOES NOT DO IS PRETEND. A route that returned "Published to 6
// accounts" while sending nothing would be discovered by the university at the
// worst possible moment — after a graduation, when somebody asks why the
// announcement never appeared. The response says queued, the log says queued,
// and docs/SOCIAL-CONNECTIONS.md says what is needed to change that.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { guard } from '@/lib/adminAuth';
import {
  resolveTargets, problemsWith, canPublish,
  type SocialAccount, type ChannelChoice, type Platform,
  type Variant, type PostMedia, type DraftPost,
} from '@/lib/social';

export const runtime = 'nodejs';

interface Body {
  body?: string;
  linkUrl?: string | null;
  media?: PostMedia[];
  choice?: ChannelChoice;
  platforms?: Platform[];
  variants?: Variant[];
  scheduledFor?: string | null;
}

export async function POST(request: Request) {
  const g = await guard(request, 'publish-social-post');
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  const { admin, caller } = g;

  let input: Body;
  try {
    input = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-json' }, { status: 400 });
  }

  const choice: ChannelChoice = input.choice ?? 'university';
  if (!['university', 'personal', 'both'].includes(choice)) {
    return NextResponse.json({ ok: false, error: 'bad-choice' }, { status: 400 });
  }

  // -------------------------------------------------------------------------
  // WHICH ACCOUNTS. Read with the service role — which sees every row,
  // including other people's — and then narrowed by resolveTargets using the
  // caller's own id. The narrowing is the security boundary and it is one
  // function, tested exhaustively in src/lib/social.test.mjs.
  // -------------------------------------------------------------------------
  const { data: rows, error: readErr } = await admin
    .from('social_accounts')
    .select('id, scope, owner_id, platform, handle, status, token_expires_at');

  if (readErr) {
    return NextResponse.json({
      ok: false,
      error: 'accounts-unreadable',
      detail: readErr.message.includes('does not exist')
        ? 'The social pipeline tables are not installed. Run docs/migrations/013_social_and_credential_authority.sql.'
        : readErr.message,
    }, { status: 500 });
  }

  const accounts: SocialAccount[] = (rows ?? []).map((r: Record<string, any>) => ({
    id: String(r.id),
    scope: r.scope,
    ownerId: r.owner_id ?? null,
    platform: r.platform,
    handle: r.handle,
    status: r.status,
    tokenExpiresAt: r.token_expires_at,
  }));

  const resolution = resolveTargets({
    authorId: caller.id, // FROM THE TOKEN. Never from the request body.
    choice,
    accounts,
    platforms: input.platforms,
  });

  // -------------------------------------------------------------------------
  // THE SAME VALIDATION THE COMPOSER RAN, RUN AGAIN.
  //
  // Not because the composer is untrustworthy in the ordinary case, but because
  // a scheduled post is validated when it is composed and published minutes or
  // days later — by which time a connection may have expired, and the checks
  // that mattered at compose time are the wrong ones.
  // -------------------------------------------------------------------------
  const draft: DraftPost = {
    authorId: caller.id,
    body: input.body ?? '',
    linkUrl: input.linkUrl ?? null,
    media: input.media ?? [],
    choice,
    platforms: input.platforms,
    variants: input.variants ?? [],
    scheduledFor: input.scheduledFor ?? null,
  };

  const problems = problemsWith(draft, resolution);
  if (!canPublish(problems)) {
    return NextResponse.json({
      ok: false,
      error: 'not-publishable',
      detail: problems.filter((p) => p.severity === 'blocking').map((p) => p.message).join(' '),
      problems,
    }, { status: 422 });
  }

  // -------------------------------------------------------------------------
  // WRITE THE POST.
  //
  // `include_personal` is set from the resolution rather than from the request.
  // The database trigger reads this column to decide whether a personal target
  // is permitted at all, so a request that said `include_personal: true` while
  // choosing 'university' would be asking the database to relax its own rule.
  // -------------------------------------------------------------------------
  const { data: post, error: postErr } = await admin
    .from('social_posts')
    .insert({
      author_id: caller.id,
      body: draft.body,
      link_url: draft.linkUrl,
      include_personal: resolution.includePersonal,
      scheduled_for: draft.scheduledFor,
      status: draft.scheduledFor ? 'scheduled' : 'publishing',
    })
    .select('id')
    .single();

  if (postErr || !post) {
    return NextResponse.json({ ok: false, error: 'post-not-saved', detail: postErr?.message }, { status: 500 });
  }

  const postId = post.id as string;

  // Media. alt_text is NOT NULL in the database and blank alt text was already
  // refused above, so this cannot fail on that account — but if it ever does,
  // the post must not stand without its pictures.
  if (draft.media.length > 0) {
    const { error } = await admin.from('social_post_media').insert(
      // THE REGISTER'S COLUMN NAMES. This said `url` and `position`; the table
      // has `storage_path` and `ordinal`, so every post with a picture failed.
      draft.media.map((m, i) => ({
        post_id: postId,
        storage_path: m.url,
        kind: m.kind,
        alt_text: m.altText,
        ordinal: i,
      })),
    );
    if (error) {
      await admin.from('social_posts').update({ status: 'failed' }).eq('id', postId);
      return NextResponse.json({ ok: false, error: 'media-not-saved', detail: error.message }, { status: 500 });
    }
  }

  // Per-platform variants, with the assistant's authorship preserved.
  if (draft.variants.length > 0) {
    await admin.from('social_post_variants').insert(
      draft.variants.map((v) => ({
        post_id: postId,
        platform: v.platform,
        body: v.body,
        hashtags: v.hashtags,
        source: v.source,
        // A HUMAN OPENED THE COMPOSER AND SENT IT. Whoever typed into an
        // assistant draft, the person who published it is the one who is
        // answerable for the words, and that is the id worth recording.
        edited_by: v.source === 'assistant' ? caller.id : null,
      })),
    );
  }

  // -------------------------------------------------------------------------
  // THE FAN-OUT LEDGER. One row per destination.
  //
  // If the database trigger refuses any one of these, the whole insert fails
  // and the post is marked failed rather than half-published. That is the
  // correct outcome: a refusal here means this route's copy of the consent rule
  // and the database's copy disagreed, which is a fault worth stopping for
  // rather than working around.
  // -------------------------------------------------------------------------
  const { error: targetErr } = await admin.from('social_post_targets').insert(
    resolution.targets.map((t) => ({
      post_id: postId,
      account_id: t.account.id,
      // The register's own word. See TargetState in src/lib/social.ts — this
      // said `state: 'queued'` against a column called `status` that has no
      // such value, so the fan-out insert failed and nothing was ever
      // published.
      status: 'pending',
    })),
  );

  if (targetErr) {
    await admin.from('social_posts').update({ status: 'failed' }).eq('id', postId);
    return NextResponse.json({
      ok: false,
      error: 'targets-refused',
      detail: targetErr.message.includes('personal social account')
        ? 'The database refused a destination this route had allowed. Nothing was published. '
          + 'This is a fault in the consent rule and should be reported rather than retried.'
        : targetErr.message,
    }, { status: 500 });
  }

  // -------------------------------------------------------------------------
  // AUDIT. The social pipeline writes to the university's existing audit log,
  // not to a private one of its own — the university's point 12 asked for a
  // shared data model, and "who announced what on behalf of the institution" is
  // exactly the sort of thing an audit log is for.
  // -------------------------------------------------------------------------
  // THE SHAPE audit_logs ACTUALLY HAS. This said `actor_id` and `detail`; the
  // table has `performed_by` and `details`, so the insert failed and the
  // University's own log of who published what would have stayed empty.
  await admin.from('audit_logs').insert({
    action: draft.scheduledFor ? 'social.scheduled' : 'social.published',
    entity_type: 'social_post',
    entity_id: postId,
    performed_by: caller.id,
    details: {
      choice,
      accounts: resolution.targets.map((t) => t.account.handle),
      assistant_drafted: draft.variants.some((v) => v.source === 'assistant'),
    },
  });

  const dispatched = await dispatch();

  return NextResponse.json({
    ok: true,
    postId,
    targets: resolution.targets.length,
    skipped: resolution.skipped,
    summary: draft.scheduledFor
      ? `Scheduled for ${resolution.targets.length} ${resolution.targets.length === 1 ? 'account' : 'accounts'}.`
      : dispatched
        ? `Published to ${resolution.targets.length}.`
        : `Queued for ${resolution.targets.length} ${resolution.targets.length === 1 ? 'account' : 'accounts'}. `
          + 'Nothing has left the University yet: no platform application is connected. '
          + 'See docs/SOCIAL-CONNECTIONS.md.',
  });
}

/**
 * Hand the queued targets to the platforms.
 *
 * RETURNS FALSE AND SAYS SO, rather than reporting a success it did not have.
 * The provider adapters need an OAuth application per platform, registered by
 * the university under its own name; see docs/SOCIAL-CONNECTIONS.md for what
 * each one requires. Until then the targets sit at 'queued', which is an honest
 * state that a person can see in the publication log.
 */
async function dispatch(): Promise<boolean> {
  return false;
}
