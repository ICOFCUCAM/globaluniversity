'use client';

// ---------------------------------------------------------------------------
// THE PUBLICATION DESK — review, history, and what to do when a network refuses.
//
// Two things that read as one screen because they are one job: what is waiting
// to be read, and what happened to everything that has gone out.
//
// ---------------------------------------------------------------------------
// WHY THE REVIEW QUEUE SHOWS THE AUTHOR'S OWN POSTS TOO, GREYED
// ---------------------------------------------------------------------------
//
// An administrator who submits a post and then sees an empty queue reasonably
// concludes the submission failed. Showing their own post with "you cannot
// approve your own" against it answers the question they were about to ask, and
// makes the rule visible rather than mysterious — which matters, because the
// first time somebody meets this rule is usually the first time they try to
// publish something urgent.
//
// ---------------------------------------------------------------------------
// WHY FAILURES ARE NOT A SEPARATE TAB
// ---------------------------------------------------------------------------
//
// Because nobody visits a failures tab. A partial failure is a line in the
// history with a Retry button on it, in the place somebody is already looking
// after they publish something. A dedicated screen would be checked on the day
// it was built and never again.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { can, type Capability } from '@/lib/roles';
import type { UserRole } from '@/lib/types';
import {
  statusFromTargets, describeOutcome, approvalMovesFor, canApprove,
  PLATFORM_PROFILES,
  type TargetState, type ApprovalState, type Platform,
} from '@/lib/social';
import {
  Loader2, RotateCw, CheckCircle2, XCircle, Send, AlertTriangle, Inbox, Sparkles,
} from 'lucide-react';
import PublishingAnalytics from './PublishingAnalytics';

interface TargetRow {
  id: string;
  state: TargetState;
  handle: string;
  platform: Platform | null;
  attempts: number;
  lastError: string | null;
}

interface PostRow {
  id: string;
  body: string;
  authorId: string;
  authorName: string | null;
  status: string;
  approvalState: ApprovalState;
  reviewNote: string | null;
  scheduledFor: string | null;
  createdAt: string;
  assistantDrafted: boolean;
  targets: TargetRow[];
}

export default function PublicationDesk({
  role, userId,
}: {
  role?: UserRole;
  userId?: string;
}) {
  const [posts, setPosts] = useState<PostRow[] | null>(null);
  const [notReady, setNotReady] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const holds = useCallback((c: string) => can(role, c as Capability), [role]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('social_posts')
      .select(
        'id, body, author_id, status, approval_state, review_note, scheduled_for, created_at, '
        + 'social_post_variants(source), '
        + 'social_post_targets(id, status, attempts, last_error, social_accounts(handle, platform))',
      )
      .order('created_at', { ascending: false })
      .limit(60);

    if (error) {
      setNotReady(
        error.message.includes('approval_state')
          ? 'The approval columns are not in the database. Run docs/migrations/014_social_approval_and_retry.sql.'
          : error.message,
      );
      setPosts([]);
      return;
    }
    setNotReady(null);

    // Author names, in one query rather than one per post.
    const ids = Array.from(new Set((data ?? []).map((p: any) => p.author_id).filter(Boolean)));
    const { data: people } = ids.length
      ? await supabase.from('profiles').select('id, full_name').in('id', ids)
      : { data: [] as Array<{ id: string; full_name: string | null }> };
    const names = new Map((people ?? []).map((p: any) => [p.id, p.full_name]));

    setPosts((data ?? []).map((p: Record<string, any>) => ({
      id: String(p.id),
      body: p.body ?? '',
      authorId: p.author_id,
      authorName: names.get(p.author_id) ?? null,
      status: p.status,
      approvalState: (p.approval_state ?? 'draft') as ApprovalState,
      reviewNote: p.review_note ?? null,
      scheduledFor: p.scheduled_for ?? null,
      createdAt: p.created_at,
      assistantDrafted: (p.social_post_variants ?? []).some((v: any) => v.source === 'assistant'),
      targets: (p.social_post_targets ?? []).map((t: any) => ({
        id: String(t.id),
        state: t.status as TargetState,
        handle: t.social_accounts?.handle ?? '—',
        platform: (t.social_accounts?.platform ?? null) as Platform | null,
        attempts: t.attempts ?? 0,
        lastError: t.last_error ?? null,
      })),
    })));
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function post(url: string, body: unknown, ok: (out: any) => void) {
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.session?.access_token ?? ''}`,
      },
      body: JSON.stringify(body),
    });
    const out = await res.json().catch(() => ({ ok: false, error: 'no-reply' }));
    if (!out.ok) { setMessage({ tone: 'bad', text: out.detail ?? out.error ?? 'That did not work.' }); return; }
    ok(out);
  }

  async function move(p: PostRow, to: ApprovalState) {
    setBusy(p.id); setMessage(null);
    await post('/api/social/approve', { postId: p.id, to, note: note[p.id] ?? '' }, (out) => {
      setMessage({ tone: 'ok', text: out.message });
      setNote((s) => ({ ...s, [p.id]: '' }));
      void load();
    });
    setBusy(null);
  }

  async function retry(p: PostRow) {
    setBusy(p.id); setMessage(null);
    await post('/api/social/retry', { postId: p.id }, (out) => {
      setMessage({ tone: 'ok', text: out.message });
      void load();
    });
    setBusy(null);
  }

  const waiting = useMemo(
    () => (posts ?? []).filter((p) => p.approvalState === 'submitted'),
    [posts],
  );
  const history = useMemo(
    () => (posts ?? []).filter((p) => p.approvalState !== 'submitted'),
    [posts],
  );

  return (
    <div className="space-y-6">
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

      {/* ------------------------------------------------------------------ */}
      {/* WHAT THE UNIVERSITY HAS SAID. At the top of the desk rather than on a
          tab of its own, because a separate analytics screen is visited on the
          day it is built and never again. */}
      <section className="rounded-2xl border border-[#ece7de] bg-white p-5 dark:border-[#2e2637] dark:bg-[#1b1723]">
        <PublishingAnalytics />
      </section>

      <section>
        <h2 className="flex items-center gap-2 font-serif text-lg text-[#241a30] dark:text-[#f3efe7]">
          <Inbox size={17} /> Waiting to be read
        </h2>
        {posts === null ? (
          <Loader2 size={18} className="mt-3 animate-spin text-[#9c93ad]" />
        ) : waiting.length === 0 ? (
          <p className="mt-2 text-sm text-[#6b6076] dark:text-[#9c93ad]">
            Nothing is waiting for review.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {waiting.map((p) => {
              const mine = p.authorId === userId;
              const moves = approvalMovesFor(p.approvalState, holds)
                // The self-approval rule, applied where the button is drawn.
                // The route and migration 014 both refuse it as well.
                .filter((m) => !(m.to === 'approved' && mine));
              return (
                <li key={p.id} className="rounded-2xl border border-[#ece7de] bg-white p-4 dark:border-[#2e2637] dark:bg-[#1b1723]">
                  <PostSummary post={p} />

                  {mine ? (
                    <p className="mt-3 rounded-lg bg-[#fbfaf7] p-2 text-xs text-[#6b6076] dark:bg-[#17131d] dark:text-[#9c93ad]">
                      You wrote this, so you cannot be the one who approves it. Another
                      administrator has to read it first — that is what the review step is for.
                    </p>
                  ) : null}

                  {moves.length > 0 && (
                    <>
                      <input
                        value={note[p.id] ?? ''}
                        onChange={(e) => setNote((s) => ({ ...s, [p.id]: e.target.value }))}
                        placeholder="A note. Required to send back — say what needs to change."
                        className="mt-3 w-full rounded-lg border border-[#ece7de] bg-[#fbfaf7] p-2 text-xs dark:border-[#2e2637] dark:bg-[#17131d] dark:text-[#f3efe7]"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {moves.map((m) => {
                          const verdict = canApprove({
                            from: p.approvalState, to: m.to,
                            actorId: userId ?? '', authorId: p.authorId,
                            holds, note: note[p.id],
                          });
                          return (
                            <button
                              key={m.to}
                              type="button"
                              onClick={() => void move(p, m.to)}
                              disabled={busy === p.id || !verdict.allowed}
                              title={verdict.allowed ? undefined : verdict.reason}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                                m.to === 'approved'
                                  ? 'bg-[#241a30] text-white dark:bg-[#e9c14a] dark:text-[#241a30]'
                                  : 'border border-[#ece7de] text-[#6b6076] dark:border-[#2e2637] dark:text-[#9c93ad]'
                              }`}
                            >
                              {busy === p.id && <Loader2 size={12} className="animate-spin" />}
                              {m.label}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="font-serif text-lg text-[#241a30] dark:text-[#f3efe7]">Publication history</h2>
        {posts === null ? null : history.length === 0 ? (
          <p className="mt-2 text-sm text-[#6b6076] dark:text-[#9c93ad]">
            Nothing has been published through the Command Centre yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {history.map((p) => {
              const outcome = statusFromTargets(p.targets.map((t) => t.state));
              const failed = p.targets.filter((t) => t.state === 'failed');
              return (
                <li key={p.id} className="rounded-2xl border border-[#ece7de] bg-white p-4 dark:border-[#2e2637] dark:bg-[#1b1723]">
                  <PostSummary post={p} />

                  {p.targets.length > 0 && (
                    <>
                      <p className="mt-2 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                        {describeOutcome(p.targets.map((t) => t.state))}
                      </p>
                      <ul className="mt-2 space-y-1">
                        {p.targets.map((t) => (
                          <li key={t.id} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                            <span className={`rounded px-1.5 py-0.5 font-medium ${
                              t.state === 'posted' ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-300'
                                : t.state === 'failed' ? 'bg-red-600/10 text-red-700 dark:text-red-300'
                                  : t.state === 'skipped' ? 'bg-[#ece7de] text-[#6b6076] dark:bg-[#2e2637] dark:text-[#9c93ad]'
                                    : 'bg-[#7a4bbd]/10 text-[#5b3392] dark:text-[#c9a9f2]'
                            }`}>
                              {t.state}
                            </span>
                            <span className="text-[#241a30] dark:text-[#f3efe7]">{t.handle}</span>
                            {t.platform && (
                              <span className="text-[#9c93ad]">{PLATFORM_PROFILES[t.platform]?.name}</span>
                            )}
                            {t.attempts > 1 && (
                              <span className="text-[#9c93ad]">· {t.attempts} attempts</span>
                            )}
                            {/* THE ERROR, IN FULL. A failure the operator cannot
                                read is a failure they cannot fix, and "an error
                                occurred" sends them to a developer. */}
                            {t.lastError && (
                              <span className="w-full text-[#a07c12]">{t.lastError}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  {failed.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void retry(p)}
                        disabled={busy === p.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#7a4bbd]/40 px-3 py-1.5 text-xs font-semibold text-[#5b3392] disabled:opacity-40 dark:text-[#c9a9f2]"
                      >
                        {busy === p.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
                        Try {failed.length === 1 ? 'it' : `those ${failed.length}`} again
                      </button>
                      <span className="text-xs text-[#9c93ad]">
                        Only the ones that failed. The rest are untouched.
                      </span>
                    </div>
                  )}

                  {outcome === 'partially_failed' && (
                    <p className="mt-2 text-xs text-[#8a6a10]">
                      This announcement is live on some networks and missing from others.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

function PostSummary({ post }: { post: PostRow }) {
  return (
    <>
      <p className="whitespace-pre-wrap text-sm text-[#241a30] dark:text-[#f3efe7]">{post.body}</p>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#9c93ad]">
        <span>{post.authorName ?? 'An administrator'}</span>
        <span>·</span>
        <span>{new Date(post.createdAt).toLocaleString('en-GB')}</span>
        {post.scheduledFor && (
          <>
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-[#5b3392] dark:text-[#c9a9f2]">
              <Send size={11} /> scheduled {new Date(post.scheduledFor).toLocaleString('en-GB')}
            </span>
          </>
        )}
        {/* WHO WROTE THE WORDS. An approval means very little if nobody can tell
            afterwards which sentences a person chose and which they merely
            failed to delete. */}
        {post.assistantDrafted && (
          <>
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-[#7a4bbd] dark:text-[#c9a9f2]">
              <Sparkles size={11} /> assistant-drafted
            </span>
          </>
        )}
      </p>
      {post.approvalState === 'rejected' && post.reviewNote && (
        <p className="mt-2 rounded-lg bg-red-600/5 p-2 text-xs text-[#6b6076] dark:text-[#9c93ad]">
          <strong className="font-semibold">Sent back:</strong> {post.reviewNote}
        </p>
      )}
    </>
  );
}
