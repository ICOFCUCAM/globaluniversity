// ---------------------------------------------------------------------------
// THE UNIVERSITY SOCIAL MEDIA COMMAND CENTRE — the rules, held apart from the
// screen that draws them.
//
// "Create once -> review once -> publish everywhere."
//
// WHY THIS IS A LIBRARY AND NOT A COMPONENT. Three things need these rules and
// only one of them is a screen: the composer, which must not offer a
// destination the system will refuse; the publish route, which must refuse it
// again on the server because a form is not a control; and the tests, which
// have no screen at all. When the rules lived in the component, the route
// re-implemented them slightly differently and the difference was the bug.
//
// THE ONE RULE THAT MATTERS MOST. The university wrote it in capitals of its
// own: "An administrator should never receive the credentials or tokens of
// another administrator. These connections belong only to that administrator."
//
// That is enforced in three places on purpose, and the redundancy is the
// design rather than an oversight:
//
//   1. HERE, in `resolveTargets`, so the composer never draws a checkbox for
//      somebody else's account. A control a person cannot see is a control
//      they cannot be confused by.
//   2. In the publish route, because a checkbox that is not drawn can still be
//      posted by anyone with a terminal.
//   3. In the database — migration 013's `social_target_consent_trg` — because
//      a route can be replaced next year by somebody who never read this file.
//
// If any one of the three is removed the other two still hold. That is the
// whole point of writing it three times.
// ---------------------------------------------------------------------------

/**
 * The platforms the Command Centre can speak to.
 *
 * A CLOSED LIST, matching the CHECK constraint in migration 013 exactly. If
 * this list and that constraint ever disagree, the failure is an insert that
 * the interface offered and the database refused — after the administrator
 * pressed Publish, which is the worst moment to discover it.
 */
export const PLATFORMS = [
  'facebook', 'instagram', 'x', 'linkedin', 'youtube', 'tiktok', 'threads',
] as const;

export type Platform = (typeof PLATFORMS)[number];

export interface PlatformProfile {
  id: Platform;
  name: string;
  /**
   * The longest body the platform accepts.
   *
   * THESE ARE THIRD-PARTY FACTS AND THEY CHANGE. X has moved its limit twice;
   * Instagram's caption length differs between the app and the API. They are
   * kept here, named and in one place, so that correcting one is an edit to a
   * single line rather than a search through the composer for a magic number.
   *
   * The consequence of being wrong is mild and visible — the counter says 280
   * when the truth is 4,000, so an administrator writes less than they could —
   * which is the right way round. A limit set too HIGH would let a post be
   * accepted here and rejected by the platform after publication had begun,
   * leaving the same announcement live on four networks and missing from two.
   */
  limit: number;
  /** Does a post to this platform require an image or a video to exist at all? */
  requiresMedia: false | 'image' | 'video';
  /** The conventional number of hashtags. Advisory, not enforced. */
  hashtagGuide: number;
  /** How the university's own voice should sound here, shown in the composer. */
  register: string;
}

export const PLATFORM_PROFILES: Record<Platform, PlatformProfile> = {
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    limit: 63206,
    requiresMedia: false,
    hashtagGuide: 3,
    register: 'Room for the whole announcement. Parents and alumni read here.',
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    limit: 2200,
    requiresMedia: 'image',
    hashtagGuide: 10,
    register: 'The photograph carries it. The caption says what the photograph cannot.',
  },
  x: {
    id: 'x',
    name: 'X',
    limit: 280,
    requiresMedia: false,
    hashtagGuide: 2,
    register: 'One sentence and a link. Anything longer is cut mid-word.',
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    limit: 3000,
    requiresMedia: false,
    hashtagGuide: 3,
    register: 'Where employers and partner institutions read. Formal, and about outcomes.',
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    limit: 5000,
    requiresMedia: 'video',
    hashtagGuide: 3,
    register: 'A description beneath a video. Nothing publishes here without one.',
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    limit: 2200,
    requiresMedia: 'video',
    hashtagGuide: 5,
    register: 'Prospective undergraduates. Plain speech, no institutional throat-clearing.',
  },
  threads: {
    id: 'threads',
    name: 'Threads',
    limit: 500,
    requiresMedia: false,
    hashtagGuide: 1,
    register: 'Short, conversational, and it may be replied to. Someone must be watching.',
  },
};

// ---------------------------------------------------------------------------
// ACCOUNTS
// ---------------------------------------------------------------------------

export type AccountScope = 'university' | 'personal';
export type AccountStatus = 'connected' | 'expired' | 'revoked' | 'error';

export interface SocialAccount {
  id: string;
  scope: AccountScope;
  /** Null for a university account. Required for a personal one. */
  ownerId: string | null;
  platform: Platform;
  handle: string;
  displayName?: string | null;
  status: AccountStatus;
  /**
   * NOT A TOKEN, AND THE NAME SAYS SO.
   *
   * A pointer into the secret store. This type is what the browser receives,
   * and an OAuth refresh token is a standing permission to speak as the
   * university — putting one in a props object means it is in the page source,
   * in the React devtools, and in any error reporter the site ever installs.
   *
   * The publish route resolves the pointer server-side. Nothing in
   * `src/components` should ever need this field, and if a component starts
   * reading it, that is the review comment.
   */
  tokenRef?: string | null;
  tokenExpiresAt?: string | null;
}

/**
 * Is this connection usable right now?
 *
 * A REVOKED OR EXPIRED ACCOUNT IS STILL A ROW. Deleting it would lose the
 * publication history that points at it, so the row survives and the status
 * changes — which means every screen that lists "where can I post" has to ask
 * this question rather than counting rows.
 */
export function isPublishable(account: SocialAccount): boolean {
  if (account.status !== 'connected') return false;
  if (account.tokenExpiresAt && Date.parse(account.tokenExpiresAt) <= Date.now()) return false;
  return true;
}

// ---------------------------------------------------------------------------
// CHANNEL RESOLUTION — the university's three-way choice
// ---------------------------------------------------------------------------

/**
 * "The administrator can then choose: University accounts / My connected
 * accounts / Both."
 */
export type ChannelChoice = 'university' | 'personal' | 'both';

export interface ResolveInput {
  /** Who is publishing. Their own accounts are the only personal ones eligible. */
  authorId: string;
  choice: ChannelChoice;
  /** Every account the system knows about, of every scope and owner. */
  accounts: SocialAccount[];
  /**
   * Restrict to these platforms. Empty means every platform the chosen
   * accounts cover — the "publish everywhere" default.
   */
  platforms?: Platform[];
}

export interface ResolvedTarget {
  account: SocialAccount;
  platform: Platform;
}

export interface Resolution {
  targets: ResolvedTarget[];
  /**
   * Accounts that matched the choice but cannot be published to, with the
   * reason. SHOWN, NOT SWALLOWED: an expired Instagram connection that is
   * silently skipped means the university believes it announced a graduation
   * on Instagram and did not.
   */
  skipped: Array<{ account: SocialAccount; reason: string }>;
  /** True when include_personal must be set on the post. Mirrors migration 013. */
  includePersonal: boolean;
}

/**
 * Which accounts this post may actually go to.
 *
 * THE PERSONAL FILTER IS `ownerId === authorId` AND NOTHING ELSE. Not "an
 * administrator I manage", not "anyone in my department", not "everyone who
 * opted in to university announcements". The university's sentence has no
 * exceptions in it and neither does this function.
 *
 * A superadmin gets no special case here either, and that is deliberate. They
 * may connect the university's accounts and they may govern policy; they may
 * not publish under a colleague's name. The Vice-Chancellor's authority over
 * the institution is not authority over a person's own voice.
 */
export function resolveTargets(input: ResolveInput): Resolution {
  const { authorId, choice, accounts } = input;
  const wanted = input.platforms?.length ? new Set<Platform>(input.platforms) : null;

  const targets: ResolvedTarget[] = [];
  const skipped: Resolution['skipped'] = [];

  for (const account of accounts) {
    // Scope first. An account that fails this is not "skipped" — it was never
    // addressed by this post, and reporting it would fill the summary with
    // every colleague's connections.
    if (account.scope === 'university' && choice === 'personal') continue;
    if (account.scope === 'personal') {
      if (choice === 'university') continue;
      if (account.ownerId !== authorId) continue; // The rule. No exceptions.
    }

    if (wanted && !wanted.has(account.platform)) continue;

    if (!isPublishable(account)) {
      skipped.push({
        account,
        reason:
          account.status === 'connected'
            ? 'The connection has expired and must be reauthorised.'
            : `The connection is ${account.status}.`,
      });
      continue;
    }

    targets.push({ account, platform: account.platform });
  }

  return {
    targets,
    skipped,
    includePersonal: choice !== 'university',
  };
}

// ---------------------------------------------------------------------------
// THE POST, AND WHAT MAKES IT PUBLISHABLE
// ---------------------------------------------------------------------------

export interface PostMedia {
  url: string;
  kind: 'image' | 'video';
  /**
   * REQUIRED, and the database agrees.
   *
   * Alternative text is not a nicety on a university account. A prospective
   * student using a screen reader is exactly the reader the institution is
   * addressing, and a graduation photograph that reaches them as "image" has
   * excluded them from the announcement. Migration 013 makes the column NOT
   * NULL for the same reason.
   */
  altText: string;
}

export interface Variant {
  platform: Platform;
  body: string;
  hashtags: string[];
  /** Did a person write this, or did the assistant draft it? */
  source: 'human' | 'assistant';
  /** Set when a human changed an assistant draft. */
  editedBy?: string | null;
}

export interface DraftPost {
  authorId: string;
  body: string;
  linkUrl?: string | null;
  media: PostMedia[];
  choice: ChannelChoice;
  platforms?: Platform[];
  variants: Variant[];
  scheduledFor?: string | null;
}

export interface Problem {
  /** Which platform it concerns, or null for the post as a whole. */
  platform: Platform | null;
  severity: 'blocking' | 'warning';
  message: string;
}

/** The text that will actually be sent to a platform. */
export function bodyFor(post: DraftPost, platform: Platform): string {
  const variant = post.variants.find((v) => v.platform === platform);
  const base = variant ? variant.body : post.body;
  const tags = variant?.hashtags ?? [];
  return tags.length ? `${base}\n\n${tags.map(withHash).join(' ')}` : base;
}

const withHash = (t: string) => (t.startsWith('#') ? t : `#${t}`);

/**
 * Everything wrong with this post, at the point of publishing.
 *
 * BLOCKING AND WARNING ARE DIFFERENT AND BOTH ARE SHOWN. A body over the limit
 * is blocking, because the platform will truncate mid-sentence and the
 * university will have published half a sentence. Twenty hashtags is a
 * warning, because it is a judgement about tone and the administrator may
 * genuinely mean it.
 *
 * A SILENT PASS IS THE FAILURE THIS GUARDS AGAINST. The alternative design —
 * disable the Publish button when something is wrong — leaves a person looking
 * at a greyed-out button with no idea which of six platforms objected.
 */
export function problemsWith(post: DraftPost, resolution: Resolution): Problem[] {
  const problems: Problem[] = [];

  if (!post.body.trim() && !post.variants.some((v) => v.body.trim())) {
    problems.push({ platform: null, severity: 'blocking', message: 'The post has no text.' });
  }

  if (resolution.targets.length === 0) {
    problems.push({
      platform: null,
      severity: 'blocking',
      message:
        resolution.skipped.length > 0
          ? 'Every account this post was addressed to needs reconnecting.'
          : 'No account is selected, so this post has nowhere to go.',
    });
  }

  for (const { altText } of post.media) {
    if (!altText.trim()) {
      problems.push({
        platform: null,
        severity: 'blocking',
        message: 'Every image and video needs alternative text before it can be published.',
      });
      break;
    }
  }

  // One entry per platform actually being published to — not per platform that
  // exists. Warning an administrator that their X post is too long when they
  // are not posting to X is noise, and noise is how real warnings get ignored.
  const platforms = Array.from(new Set(resolution.targets.map((t) => t.platform)));

  for (const platform of platforms) {
    const profile = PLATFORM_PROFILES[platform];
    const text = bodyFor(post, platform);

    if (text.length > profile.limit) {
      problems.push({
        platform,
        severity: 'blocking',
        message: `${profile.name} accepts ${profile.limit.toLocaleString()} characters; this is ${text.length.toLocaleString()}.`,
      });
    }

    if (profile.requiresMedia) {
      const has = post.media.some((m) => m.kind === profile.requiresMedia);
      if (!has) {
        problems.push({
          platform,
          severity: 'blocking',
          message: `${profile.name} cannot publish without ${profile.requiresMedia === 'video' ? 'a video' : 'an image'}.`,
        });
      }
    }

    const tags = post.variants.find((v) => v.platform === platform)?.hashtags ?? [];
    if (tags.length > profile.hashtagGuide * 2) {
      problems.push({
        platform,
        severity: 'warning',
        message: `${tags.length} hashtags on ${profile.name}. Around ${profile.hashtagGuide} reads as an institution rather than as marketing.`,
      });
    }
  }

  if (post.scheduledFor && Date.parse(post.scheduledFor) <= Date.now()) {
    problems.push({
      platform: null,
      severity: 'blocking',
      message: 'The scheduled time is in the past.',
    });
  }

  return problems;
}

/** Nothing blocking. Warnings do not stop a publication. */
export function canPublish(problems: Problem[]): boolean {
  return !problems.some((p) => p.severity === 'blocking');
}

// ---------------------------------------------------------------------------
// FAN-OUT STATE
// ---------------------------------------------------------------------------

/**
 * What has happened to one destination.
 *
 * THESE ARE THE DATABASE'S WORDS, NOT NICER ONES.
 *
 * This type first read `'queued' | 'publishing' | 'published' | ...` while the
 * column in migration 013 is `status text check (status in ('pending',
 * 'sending', 'posted', 'failed', 'skipped'))`. Both the name of the column and
 * four of its five values were wrong here.
 *
 * The consequence was total: /api/social/publish inserted `state: 'queued'`
 * into a table with no `state` column, so the fan-out insert failed and NOTHING
 * COULD EVER BE PUBLISHED. The publication log and the dashboard read `t.state`
 * and got undefined, so both would have reported every post as still
 * publishing, for ever.
 *
 * `social.test.mjs` cross-checked the PLATFORM list against the migration and
 * caught nothing, because it never checked this one. It does now — see the last
 * section of that file. A vocabulary shared with the database has to be
 * compared against the database, or it is just two lists that happen to have
 * been written by the same person on the same day.
 */
export const TARGET_STATES = ['pending', 'sending', 'posted', 'failed', 'skipped'] as const;

export type TargetState = (typeof TARGET_STATES)[number];
export type PostStatus =
  | 'draft' | 'scheduled' | 'publishing' | 'published' | 'partially_failed' | 'failed' | 'cancelled';

/**
 * What the post's status becomes once every target has reported.
 *
 * 'partially_failed' EXISTS BECAUSE THE HONEST ANSWER IS USUALLY NOT BINARY.
 * Six platforms, one refuses: calling that "published" hides a gap the
 * communications office needs to know about, and calling it "failed" sends
 * somebody to repost five announcements that are already live.
 */
export function statusFromTargets(states: TargetState[]): PostStatus {
  if (states.length === 0) return 'draft';
  if (states.some((s) => s === 'pending' || s === 'sending')) return 'publishing';

  const published = states.filter((s) => s === 'posted').length;
  const failed = states.filter((s) => s === 'failed').length;

  if (failed === 0) return 'published';
  if (published === 0) return 'failed';
  return 'partially_failed';
}

/** A sentence for the publication log, from the same data. */
export function describeOutcome(states: TargetState[]): string {
  const status = statusFromTargets(states);
  const published = states.filter((s) => s === 'posted').length;
  const failed = states.filter((s) => s === 'failed').length;
  const total = states.length;

  switch (status) {
    case 'published':
      return `Published to ${total} ${total === 1 ? 'account' : 'accounts'}.`;
    case 'partially_failed':
      return `Published to ${published} of ${total}. ${failed} did not accept it and can be retried.`;
    case 'failed':
      return `Not published. All ${total} ${total === 1 ? 'attempt' : 'attempts'} failed.`;
    case 'publishing':
      return `Publishing — ${published} of ${total} done.`;
    default:
      return 'Not yet published.';
  }
}

// ---------------------------------------------------------------------------
// WHAT THE ASSISTANT MAY AND MAY NOT DO
// ---------------------------------------------------------------------------

/**
 * "AI should be built into it... The administrator remains in control and
 * approves before publishing."
 *
 * THE ASSISTANT DRAFTS. IT DOES NOT PUBLISH, and it does not invent facts about
 * this university. Both halves are enforced elsewhere — the publish route
 * requires a human actor, and the prompt below is the instruction that keeps
 * the second half true — but the reason is recorded here because this is the
 * file somebody reads when they wonder why the composer will not just send it.
 *
 * The standing rule for this whole project applies with particular force to
 * generated text: no accreditation, no rankings, no student numbers, no
 * partnerships, no awards that the university has not itself stated. A
 * generated sentence is still a statement by the university the moment it is
 * published under its name.
 */
export const ASSISTANT_BRIEF = `You are drafting social media copy for ICOF Global University.

Rules, in order of importance:
1. Invent nothing. Use only facts contained in the administrator's draft. Do not
   add accreditation claims, rankings, student numbers, employment rates,
   partnerships, awards or campus locations. If the draft does not say it, it
   does not go in.
2. Rewrite for the platform, do not summarise into blandness. Keep the specific
   detail — the name, the date, the programme — and cut the throat-clearing.
3. British spelling. The university writes "programme", "organisation",
   "recognised".
4. Never speak for a student, a graduate or a member of staff in the first
   person, and never attribute a quotation that is not in the draft.
5. Respect the platform's character limit exactly. Being under it is fine.

Return only the post text and, separately, the hashtags. No commentary.`;

/**
 * The assistant's output is a DRAFT and the type says so.
 *
 * `source: 'assistant'` travels with the variant all the way into the database,
 * so that the question "who wrote this" has an answer years later. An approval
 * means very little if nobody can tell afterwards which words a person chose
 * and which words they merely failed to delete.
 */
export function asAssistantDraft(platform: Platform, body: string, hashtags: string[]): Variant {
  return { platform, body, hashtags, source: 'assistant' };
}

/** A person changed an assistant draft. Distinct from writing it from scratch. */
export function markEdited(variant: Variant, editorId: string): Variant {
  return { ...variant, editedBy: editorId };
}


/**
 * The destinations of a post that can be tried again.
 *
 * RETRY IS PER TARGET, NOT PER POST. When one network refuses an announcement
 * that five accepted, republishing would duplicate it on the five that worked —
 * so only the failed rows are re-queued, in place.
 *
 * A 'skipped' target is NOT retryable. It was skipped because its connection
 * was expired or revoked at publication time, and trying again without
 * reconnecting the account produces the same result plus a second failure in
 * the log.
 */
export function retryable<T extends { state: TargetState }>(targets: T[]): T[] {
  return targets.filter((t) => t.state === 'failed');
}
