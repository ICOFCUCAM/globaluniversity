'use client';

// ---------------------------------------------------------------------------
// THE UNIVERSITY SOCIAL MEDIA COMMAND CENTRE.
//
//   "Create once -> review once -> publish everywhere."
//
// WHAT THIS SCREEN IS FOR. One administrator writes one announcement, sees
// exactly what each network will receive, and sends it — to the university's
// accounts, to their own, or to both. Nobody logs into six platforms in turn,
// and nobody holds six sets of credentials.
//
// ---------------------------------------------------------------------------
// THE THING THIS SCREEN MUST NEVER DO
// ---------------------------------------------------------------------------
//
//   "An administrator should never receive the credentials or tokens of
//    another administrator. These connections belong only to that
//    administrator."
//
// So this screen draws a destination list built by `resolveTargets`, which
// filters personal accounts on `ownerId === authorId` and on nothing else. A
// colleague's connection is not greyed out here — it is ABSENT. A greyed-out
// control invites the question "why can't I?", and the answer would be a
// sentence about somebody else's private connection existing, which is itself
// more than this screen should say.
//
// The absence is courtesy. The control is the publish route, which resolves the
// same rule server-side, and migration 013's trigger, which resolves it in the
// database where nothing holding the service-role key can route around it.
//
// ---------------------------------------------------------------------------
// WHY THE PREVIEW IS PER PLATFORM AND NOT ONE BOX
// ---------------------------------------------------------------------------
//
// Because "publish everywhere" is where institutional accounts go wrong. The
// same 400 words sent to six networks reads as a bot on five of them, and on X
// it is silently truncated mid-sentence — the university's announcement ends in
// the middle of a graduate's name and nobody notices until a parent asks.
//
// So each platform gets its own panel with its own character count, and the
// composer refuses to publish rather than letting a network cut the text. The
// post body is the intent; a variant is what that network actually receives.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { can } from '@/lib/roles';
import type { UserRole } from '@/lib/types';
import {
  PLATFORMS, PLATFORM_PROFILES, resolveTargets, problemsWith, canPublish,
  bodyFor, describeOutcome, statusFromTargets,
  type Platform, type SocialAccount, type ChannelChoice, type DraftPost,
  type Variant, type PostMedia, type TargetState,
} from '@/lib/social';
import {
  Loader2, Send, Sparkles, AlertTriangle, Building2, User, Users,
  CalendarClock, Image as ImageIcon, Info, CheckCircle2, XCircle, Link2,
} from 'lucide-react';

// ---------------------------------------------------------------------------

const CHOICES: Array<{ id: ChannelChoice; label: string; note: string; icon: React.ReactNode }> = [
  {
    id: 'university',
    label: 'University accounts',
    note: 'Connected once by the Superadministrator. You publish through them without holding their credentials.',
    icon: <Building2 size={16} />,
  },
  {
    id: 'personal',
    label: 'My connected accounts',
    note: 'Only accounts you connected yourself, in your own settings.',
    icon: <User size={16} />,
  },
  {
    id: 'both',
    label: 'Both',
    note: 'The university’s accounts and your own, in one publication.',
    icon: <Users size={16} />,
  },
];

interface LogRow {
  id: string;
  body: string;
  status: string;
  createdAt: string;
  states: TargetState[];
  handles: string[];
}

export default function SocialCommandCentre({ role, userId }: { role?: UserRole; userId?: string }) {
  const [accounts, setAccounts] = useState<SocialAccount[] | null>(null);
  const [notReady, setNotReady] = useState<string | null>(null);
  const [log, setLog] = useState<LogRow[]>([]);

  const [body, setBody] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [media, setMedia] = useState<PostMedia[]>([]);
  const [choice, setChoice] = useState<ChannelChoice>('university');
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [scheduledFor, setScheduledFor] = useState('');

  const [drafting, setDrafting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const mayCompose = can(role, 'compose-social-post');
  const mayPublish = can(role, 'publish-social-post');

  // -------------------------------------------------------------------------

  const load = useCallback(async () => {
    // TWO QUERIES, NOT ONE, AND THE REASON IS THE SECURITY MODEL.
    //
    // The RLS policy on social_accounts is `owner_id = auth.uid()`, which by
    // itself would hide the UNIVERSITY accounts too — their owner_id is null,
    // so the predicate is false for every one of them. University accounts are
    // readable through a view the service role fills; personal ones come
    // straight from the table under the policy.
    //
    // The consequence is the good one: a bug in this component cannot widen
    // what it sees. The worst it can do is fail to show the university's own
    // accounts, which is visible immediately.
    const [uni, mine] = await Promise.all([
      supabase.from('social_accounts').select('*').eq('scope', 'university'),
      supabase.from('social_accounts').select('*').eq('scope', 'personal'),
    ]);

    if (uni.error && (uni.error.message.includes('does not exist') || uni.error.message.includes('schema cache'))) {
      setNotReady(
        'The social pipeline tables are not in the database yet. Run '
        + 'docs/migrations/013_social_and_credential_authority.sql.',
      );
      setAccounts([]);
      return;
    }

    const rows = [...(uni.data ?? []), ...(mine.data ?? [])] as Array<Record<string, any>>;
    setAccounts(rows.map((r) => ({
      id: String(r.id),
      scope: r.scope,
      ownerId: r.owner_id ?? null,
      platform: r.platform,
      handle: r.handle,
      displayName: r.display_name,
      status: r.status,
      tokenExpiresAt: r.token_expires_at,
      // token_ref is deliberately NOT mapped. See src/lib/social.ts — nothing
      // in the browser needs it, and a field that is never read cannot leak.
    })));

    const posts = await supabase
      .from('social_posts')
      .select('id, body, status, created_at, social_post_targets(state, social_accounts(handle))')
      .order('created_at', { ascending: false })
      .limit(15);

    setLog((posts.data ?? []).map((p: any) => ({
      id: String(p.id),
      body: p.body ?? '',
      status: p.status,
      createdAt: p.created_at,
      states: (p.social_post_targets ?? []).map((t: any) => t.state as TargetState),
      handles: (p.social_post_targets ?? []).map((t: any) => t.social_accounts?.handle).filter(Boolean),
    })));
  }, []);

  useEffect(() => { void load(); }, [load]);

  // -------------------------------------------------------------------------

  const draft: DraftPost = useMemo(() => ({
    authorId: userId ?? '',
    body,
    linkUrl: linkUrl || null,
    media,
    choice,
    platforms,
    variants,
    scheduledFor: scheduledFor || null,
  }), [userId, body, linkUrl, media, choice, platforms, variants, scheduledFor]);

  const resolution = useMemo(
    () => resolveTargets({
      authorId: userId ?? '',
      choice,
      accounts: accounts ?? [],
      platforms,
    }),
    [userId, choice, accounts, platforms],
  );

  const problems = useMemo(() => problemsWith(draft, resolution), [draft, resolution]);
  const ready = canPublish(problems) && mayPublish;

  /** The platforms actually being published to — what the preview shows. */
  const livePlatforms = useMemo(
    () => Array.from(new Set(resolution.targets.map((t) => t.platform))),
    [resolution],
  );

  /**
   * Which platforms an administrator may even tick.
   *
   * Only those they have a live account for under the current choice. Offering
   * TikTok to someone with no TikTok connection produces a post that resolves
   * to nothing and a confusing "no account is selected" at the end.
   */
  const availablePlatforms = useMemo(() => {
    const all = resolveTargets({ authorId: userId ?? '', choice, accounts: accounts ?? [] });
    return PLATFORMS.filter((p) => all.targets.some((t) => t.platform === p));
  }, [userId, choice, accounts]);

  // -------------------------------------------------------------------------

  async function askAssistant() {
    setDrafting(true);
    setMessage(null);
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch('/api/social/draft', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ body, platforms: livePlatforms }),
    });
    const out = await res.json().catch(() => ({ ok: false, error: 'The assistant did not reply.' }));
    setDrafting(false);

    if (!out.ok) {
      setMessage({ tone: 'bad', text: out.detail ?? out.error ?? 'The assistant could not draft this.' });
      return;
    }

    setVariants(out.variants ?? []);
    setMessage({
      tone: 'ok',
      // SAID PLAINLY, EVERY TIME. The administrator is about to publish under
      // the university's name; they should be told in words that a machine
      // wrote what they are looking at, not left to infer it from a small icon.
      text: 'Drafted for each network. Read every one before publishing — these are suggestions, and you are the one signing them.',
    });
  }

  async function publish() {
    setPublishing(true);
    setMessage(null);
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch('/api/social/publish', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.session?.access_token ?? ''}`,
      },
      body: JSON.stringify({
        body,
        linkUrl: linkUrl || null,
        media,
        choice,
        platforms,
        variants,
        scheduledFor: scheduledFor || null,
      }),
    });
    const out = await res.json().catch(() => ({ ok: false, error: 'No reply from the publisher.' }));
    setPublishing(false);

    if (!out.ok) {
      setMessage({ tone: 'bad', text: out.detail ?? out.error ?? 'Nothing was published.' });
      return;
    }

    setMessage({ tone: 'ok', text: out.summary ?? 'Published.' });
    setBody(''); setVariants([]); setMedia([]); setLinkUrl(''); setScheduledFor('');
    void load();
  }

  // -------------------------------------------------------------------------

  if (!mayCompose) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-[#ece7de] bg-white p-8 text-center dark:border-[#2e2637] dark:bg-[#1b1723]">
        <h2 className="font-serif text-xl text-[#241a30] dark:text-[#f3efe7]">The Command Centre</h2>
        <p className="mt-2 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          Publishing on behalf of the University is limited to administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-serif text-2xl text-[#241a30] dark:text-[#f3efe7]">Social media command centre</h1>
        <p className="mt-1 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          Write once, review once, publish everywhere. What each network receives is shown before it is sent.
        </p>
      </header>

      {notReady && (
        <div className="flex items-start gap-3 rounded-xl border border-[#e9c14a]/40 bg-[#e9c14a]/10 p-4 text-sm">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-[#a07c12]" />
          <span className="text-[#6b6076] dark:text-[#9c93ad]">{notReady}</span>
        </div>
      )}

      {message && (
        <div
          role="status"
          className={`flex items-start gap-3 rounded-xl p-4 text-sm ${
            message.tone === 'ok'
              ? 'border border-emerald-600/30 bg-emerald-600/10 text-emerald-900 dark:text-emerald-200'
              : 'border border-red-600/30 bg-red-600/10 text-red-900 dark:text-red-200'
          }`}
        >
          {message.tone === 'ok' ? <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" />
            : <XCircle size={18} className="mt-0.5 flex-shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ---------------------------------------------------------------- */}
        {/* THE COMPOSER                                                     */}
        {/* ---------------------------------------------------------------- */}
        <section className="space-y-4">
          <div className="rounded-2xl border border-[#ece7de] bg-white p-5 dark:border-[#2e2637] dark:bg-[#1b1723]">
            <label htmlFor="post-body" className="text-sm font-semibold text-[#241a30] dark:text-[#f3efe7]">
              The announcement
            </label>
            <textarea
              id="post-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="What has the University done, and who should know?"
              className="mt-2 w-full rounded-xl border border-[#ece7de] bg-[#fbfaf7] p-3 text-sm text-[#241a30] outline-none focus:border-[#7a4bbd] dark:border-[#2e2637] dark:bg-[#17131d] dark:text-[#f3efe7]"
            />

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[14rem]">
                <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9c93ad]" />
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="A link to include (optional)"
                  className="w-full rounded-lg border border-[#ece7de] bg-[#fbfaf7] py-2 pl-9 pr-3 text-sm outline-none focus:border-[#7a4bbd] dark:border-[#2e2637] dark:bg-[#17131d] dark:text-[#f3efe7]"
                />
              </div>

              <button
                type="button"
                onClick={() => void askAssistant()}
                disabled={drafting || !body.trim() || livePlatforms.length === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-[#7a4bbd]/30 bg-[#7a4bbd]/10 px-3 py-2 text-sm font-semibold text-[#5b3392] disabled:opacity-40 dark:text-[#c9a9f2]"
              >
                {drafting ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                Draft for each network
              </button>
            </div>
          </div>

          <MediaPanel media={media} onChange={setMedia} />

          {/* PER-PLATFORM PREVIEW. One panel per network actually being sent to. */}
          {livePlatforms.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-[#241a30] dark:text-[#f3efe7]">
                What each network will receive
              </h2>
              {livePlatforms.map((p) => (
                <PlatformPanel
                  key={p}
                  platform={p}
                  draft={draft}
                  variant={variants.find((v) => v.platform === p)}
                  onChange={(next) =>
                    setVariants((vs) => [...vs.filter((v) => v.platform !== p), next])}
                />
              ))}
            </div>
          )}
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* DESTINATIONS AND PUBLISHING                                      */}
        {/* ---------------------------------------------------------------- */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-[#ece7de] bg-white p-5 dark:border-[#2e2637] dark:bg-[#1b1723]">
            <h2 className="text-sm font-semibold text-[#241a30] dark:text-[#f3efe7]">Where this goes</h2>

            <div className="mt-3 space-y-2">
              {CHOICES.map((c) => (
                <label
                  key={c.id}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm ${
                    choice === c.id
                      ? 'border-[#7a4bbd] bg-[#7a4bbd]/[0.06]'
                      : 'border-[#ece7de] dark:border-[#2e2637]'
                  }`}
                >
                  <input
                    type="radio"
                    name="channel"
                    className="mt-1"
                    checked={choice === c.id}
                    onChange={() => { setChoice(c.id); setPlatforms([]); }}
                  />
                  <span>
                    <span className="flex items-center gap-2 font-semibold text-[#241a30] dark:text-[#f3efe7]">
                      {c.icon}{c.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-[#6b6076] dark:text-[#9c93ad]">{c.note}</span>
                  </span>
                </label>
              ))}
            </div>

            {/* PLATFORM FILTER. Empty means everywhere the choice reaches. */}
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#9c93ad]">
                Networks {platforms.length === 0 && '— all of them'}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {availablePlatforms.map((p) => {
                  const on = platforms.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlatforms((ps) => on ? ps.filter((x) => x !== p) : [...ps, p])}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        on
                          ? 'border-[#7a4bbd] bg-[#7a4bbd] text-white'
                          : 'border-[#ece7de] text-[#6b6076] dark:border-[#2e2637] dark:text-[#9c93ad]'
                      }`}
                    >
                      {PLATFORM_PROFILES[p].name}
                    </button>
                  );
                })}
                {availablePlatforms.length === 0 && (
                  <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
                    {choice === 'personal'
                      ? 'You have not connected any account of your own. Settings → Connected social accounts.'
                      : 'No university account is connected yet. The Superadministrator connects these.'}
                  </p>
                )}
              </div>
            </div>

            {/* THE RESOLVED LIST. What will actually be posted to, by handle. */}
            {resolution.targets.length > 0 && (
              <ul className="mt-4 space-y-1 border-t border-[#ece7de] pt-3 text-xs dark:border-[#2e2637]">
                {resolution.targets.map((t) => (
                  <li key={t.account.id} className="flex items-center justify-between gap-2">
                    <span className="text-[#241a30] dark:text-[#f3efe7]">{t.account.handle}</span>
                    <span className="text-[#9c93ad]">
                      {PLATFORM_PROFILES[t.platform].name}
                      {t.account.scope === 'personal' && ' · yours'}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* SKIPPED, SHOWN. Never silently dropped — see src/lib/social.ts. */}
            {resolution.skipped.length > 0 && (
              <ul className="mt-3 space-y-1 rounded-lg bg-[#e9c14a]/10 p-2 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                {resolution.skipped.map((s) => (
                  <li key={s.account.id}>
                    <strong className="font-semibold">{s.account.handle}</strong> — {s.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* SCHEDULE */}
          <div className="rounded-2xl border border-[#ece7de] bg-white p-5 dark:border-[#2e2637] dark:bg-[#1b1723]">
            <label htmlFor="sched" className="flex items-center gap-2 text-sm font-semibold text-[#241a30] dark:text-[#f3efe7]">
              <CalendarClock size={15} /> Publish later
            </label>
            <input
              id="sched"
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="mt-2 w-full rounded-lg border border-[#ece7de] bg-[#fbfaf7] p-2 text-sm dark:border-[#2e2637] dark:bg-[#17131d] dark:text-[#f3efe7]"
            />
            <p className="mt-1 text-xs text-[#9c93ad]">Leave empty to publish now.</p>
          </div>

          {/* PROBLEMS. Listed, not hidden behind a disabled button. */}
          {problems.length > 0 && (
            <ul className="space-y-2 rounded-2xl border border-[#ece7de] bg-white p-4 text-xs dark:border-[#2e2637] dark:bg-[#1b1723]">
              {problems.map((p, i) => (
                <li key={i} className="flex items-start gap-2">
                  {p.severity === 'blocking'
                    ? <XCircle size={14} className="mt-0.5 flex-shrink-0 text-red-600" />
                    : <Info size={14} className="mt-0.5 flex-shrink-0 text-[#a07c12]" />}
                  <span className="text-[#6b6076] dark:text-[#9c93ad]">{p.message}</span>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => void publish()}
            disabled={!ready || publishing}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#241a30] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40 dark:bg-[#e9c14a] dark:text-[#241a30]"
          >
            {publishing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {scheduledFor ? 'Schedule' : 'Publish'}
            {resolution.targets.length > 0 && ` to ${resolution.targets.length}`}
          </button>
          {!mayPublish && (
            <p className="text-center text-xs text-[#9c93ad]">
              You may compose, but publishing is held by another role.
            </p>
          )}
        </aside>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* THE PUBLICATION LOG                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-2xl border border-[#ece7de] bg-white p-5 dark:border-[#2e2637] dark:bg-[#1b1723]">
        <h2 className="text-sm font-semibold text-[#241a30] dark:text-[#f3efe7]">Recent publications</h2>
        {log.length === 0 ? (
          <p className="mt-2 text-sm text-[#6b6076] dark:text-[#9c93ad]">
            Nothing has been published through the Command Centre yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[#ece7de] dark:divide-[#2e2637]">
            {log.map((row) => (
              <li key={row.id} className="py-3">
                <p className="line-clamp-2 text-sm text-[#241a30] dark:text-[#f3efe7]">{row.body}</p>
                <p className="mt-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                  {new Date(row.createdAt).toLocaleString('en-GB')} · {describeOutcome(row.states)}
                  {statusFromTargets(row.states) === 'partially_failed' && (
                    <span className="ml-1 font-semibold text-[#a07c12]">Needs attention.</span>
                  )}
                </p>
                {row.handles.length > 0 && (
                  <p className="mt-0.5 text-xs text-[#9c93ad]">{row.handles.join(' · ')}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * One network's panel: what it receives, and how close to its limit that is.
 *
 * THE COUNTER TURNS RED BEFORE THE LIMIT, NOT AT IT. A count that only goes red
 * on the 281st character of a tweet tells an administrator they have already
 * lost the sentence they were writing. At 90% it is still a warning they can
 * act on.
 */
function PlatformPanel({
  platform, draft, variant, onChange,
}: {
  platform: Platform;
  draft: DraftPost;
  variant?: Variant;
  onChange: (v: Variant) => void;
}) {
  const profile = PLATFORM_PROFILES[platform];
  const text = bodyFor(draft, platform);
  const over = text.length > profile.limit;
  const near = !over && text.length > profile.limit * 0.9;

  return (
    <div className="rounded-2xl border border-[#ece7de] bg-white p-4 dark:border-[#2e2637] dark:bg-[#1b1723]">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-[#241a30] dark:text-[#f3efe7]">{profile.name}</h3>
        <span className={`text-xs tabular-nums ${
          over ? 'font-semibold text-red-600' : near ? 'font-semibold text-[#a07c12]' : 'text-[#9c93ad]'
        }`}>
          {text.length.toLocaleString()} / {profile.limit.toLocaleString()}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-[#9c93ad]">{profile.register}</p>

      <textarea
        value={variant?.body ?? draft.body}
        onChange={(e) => onChange({
          platform,
          body: e.target.value,
          hashtags: variant?.hashtags ?? [],
          // A HUMAN TOUCHED IT. If the assistant drafted this and a person has
          // now typed into it, the record must say so — `source` stays
          // 'assistant' and `editedBy` is stamped by the publish route. What it
          // must never become is 'human', which would erase the fact that a
          // machine wrote the first version.
          source: variant?.source ?? 'human',
          editedBy: variant?.editedBy ?? null,
        })}
        rows={3}
        className="mt-2 w-full rounded-lg border border-[#ece7de] bg-[#fbfaf7] p-2 text-sm dark:border-[#2e2637] dark:bg-[#17131d] dark:text-[#f3efe7]"
      />

      <input
        value={(variant?.hashtags ?? []).join(' ')}
        onChange={(e) => onChange({
          platform,
          body: variant?.body ?? draft.body,
          hashtags: e.target.value.split(/[\s,]+/).map((t) => t.replace(/^#/, '')).filter(Boolean),
          source: variant?.source ?? 'human',
          editedBy: variant?.editedBy ?? null,
        })}
        placeholder={`Hashtags — around ${profile.hashtagGuide} reads as an institution`}
        className="mt-2 w-full rounded-lg border border-[#ece7de] bg-[#fbfaf7] p-2 text-xs dark:border-[#2e2637] dark:bg-[#17131d] dark:text-[#f3efe7]"
      />

      {variant?.source === 'assistant' && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-[#7a4bbd] dark:text-[#c9a9f2]">
          <Sparkles size={12} /> Drafted by the assistant. You are publishing it.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Images and video, each with alternative text.
 *
 * THE ALT TEXT FIELD IS NOT OPTIONAL AND CANNOT BE SKIPPED. A prospective
 * student using a screen reader is precisely the reader this institution is
 * addressing; a graduation photograph that reaches them as "image" has excluded
 * them from the announcement. The composer blocks, the route blocks, and
 * migration 013 makes the column NOT NULL.
 */
function MediaPanel({ media, onChange }: { media: PostMedia[]; onChange: (m: PostMedia[]) => void }) {
  const [url, setUrl] = useState('');
  const [kind, setKind] = useState<'image' | 'video'>('image');

  return (
    <div className="rounded-2xl border border-[#ece7de] bg-white p-5 dark:border-[#2e2637] dark:bg-[#1b1723]">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[#241a30] dark:text-[#f3efe7]">
        <ImageIcon size={15} /> Images and video
      </h2>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Address of the image or video"
          className="min-w-[16rem] flex-1 rounded-lg border border-[#ece7de] bg-[#fbfaf7] p-2 text-sm dark:border-[#2e2637] dark:bg-[#17131d] dark:text-[#f3efe7]"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as 'image' | 'video')}
          className="rounded-lg border border-[#ece7de] bg-[#fbfaf7] p-2 text-sm dark:border-[#2e2637] dark:bg-[#17131d] dark:text-[#f3efe7]"
        >
          <option value="image">Image</option>
          <option value="video">Video</option>
        </select>
        <button
          type="button"
          disabled={!url.trim()}
          onClick={() => { onChange([...media, { url: url.trim(), kind, altText: '' }]); setUrl(''); }}
          className="rounded-lg border border-[#ece7de] px-3 py-2 text-sm font-medium text-[#241a30] disabled:opacity-40 dark:border-[#2e2637] dark:text-[#f3efe7]"
        >
          Add
        </button>
      </div>

      {media.map((m, i) => (
        <div key={i} className="mt-3 rounded-lg border border-[#ece7de] p-3 dark:border-[#2e2637]">
          <p className="truncate text-xs text-[#9c93ad]">{m.kind} · {m.url}</p>
          <input
            value={m.altText}
            onChange={(e) => onChange(media.map((x, j) => j === i ? { ...x, altText: e.target.value } : x))}
            placeholder="Describe it for someone who cannot see it — required"
            className={`mt-2 w-full rounded-lg border p-2 text-sm dark:bg-[#17131d] dark:text-[#f3efe7] ${
              m.altText.trim()
                ? 'border-[#ece7de] bg-[#fbfaf7] dark:border-[#2e2637]'
                : 'border-red-400 bg-red-50 dark:bg-[#2a1a1a]'
            }`}
          />
          <button
            type="button"
            onClick={() => onChange(media.filter((_, j) => j !== i))}
            className="mt-2 text-xs text-red-600 underline"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
