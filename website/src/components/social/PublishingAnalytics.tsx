'use client';

// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY HAS ACTUALLY SAID.
//
// ---------------------------------------------------------------------------
// THE DISTINCTION THIS PANEL IS BUILT AROUND
// ---------------------------------------------------------------------------
//
// There are two kinds of number a communications dashboard can show, and they
// are not interchangeable.
//
//   WHAT WE DID. How many announcements went out, to which networks, how many
//   were refused, how long review took. Every one of these is a count over this
//   system's own tables and is true the moment there is a single post.
//
//   WHAT IT ACHIEVED. Reach, impressions, engagement, click-through. Every one
//   of these belongs to Facebook, LinkedIn and X, arrives through their APIs,
//   and this deployment has no platform application connected — so there is
//   nothing to count and nothing that can honestly be shown.
//
// This panel shows the first and says plainly why the second is absent. A
// dashboard reporting "0% engagement" would be stating a measurement rather
// than the absence of one, and an institution that publishes a figure it cannot
// evidence on its own internal screens will eventually publish one on its
// prospectus.
//
// ---------------------------------------------------------------------------
// WHY REVIEW TIME IS HERE
// ---------------------------------------------------------------------------
//
// Because it is the number most likely to make the approval workflow fail in
// practice. A separation of duties that adds three days to every announcement
// gets routed around — somebody is given the approval capability "temporarily",
// or the post goes out from a personal account instead. Measuring it is how the
// University finds that out before it happens rather than afterwards.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { runQuery } from '@/lib/runQuery';
import { PLATFORM_PROFILES, type Platform, type TargetState } from '@/lib/social';
import { Info, Loader2 } from 'lucide-react';

interface Row {
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  targets: Array<{ state: TargetState; platform: Platform | null }>;
}

const WINDOW_DAYS = 90;

export default function PublishingAnalytics() {
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 3600 * 1000).toISOString();
    const { data, error } = await runQuery(supabase
      .from('social_posts')
      .select('created_at, submitted_at, approved_at, published_at, social_post_targets(status, social_accounts(platform))')
      .gte('created_at', since)
      .limit(500));

    if (error) { setRows([]); return; }

    setRows((data ?? []).map((p: Record<string, any>) => ({
      createdAt: p.created_at,
      submittedAt: p.submitted_at ?? null,
      approvedAt: p.approved_at ?? null,
      publishedAt: p.published_at ?? null,
      targets: (p.social_post_targets ?? []).map((t: any) => ({
        state: t.status as TargetState,
        platform: (t.social_accounts?.platform ?? null) as Platform | null,
      })),
    })));
  }, []);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => {
    const all = rows ?? [];
    const targets = all.flatMap((r) => r.targets);

    /** Per platform: attempted, posted, failed. */
    const byPlatform = new Map<Platform, { attempted: number; posted: number; failed: number }>();
    for (const t of targets) {
      if (!t.platform) continue;
      const e = byPlatform.get(t.platform) ?? { attempted: 0, posted: 0, failed: 0 };
      e.attempted++;
      if (t.state === 'posted') e.posted++;
      if (t.state === 'failed') e.failed++;
      byPlatform.set(t.platform, e);
    }

    // Review turnaround, in hours, over the posts that completed a review.
    const reviewed = all
      .filter((r) => r.submittedAt && r.approvedAt)
      .map((r) => (Date.parse(r.approvedAt!) - Date.parse(r.submittedAt!)) / 3_600_000)
      .sort((a, b) => a - b);

    return {
      posts: all.length,
      published: all.filter((r) => r.publishedAt).length,
      destinations: targets.length,
      failed: targets.filter((t) => t.state === 'failed').length,
      byPlatform: Array.from(byPlatform.entries()).sort((a, b) => b[1].attempted - a[1].attempted),
      reviewed: reviewed.length,
      // THE MEDIAN, NOT THE MEAN. One announcement approved after a fortnight's
      // annual leave would drag an average past two days and make a workflow
      // that usually takes an hour look broken.
      medianReviewHours: reviewed.length ? reviewed[Math.floor(reviewed.length / 2)] : null,
      slowestReviewHours: reviewed.length ? reviewed[reviewed.length - 1] : null,
    };
  }, [rows]);

  if (rows === null) return <Loader2 size={16} className="animate-spin text-[#9c93ad]" />;

  if (stats.posts === 0) {
    return (
      <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
        Nothing has been published in the last {WINDOW_DAYS} days, so there is nothing to report.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <Figure value={stats.posts} label={`announcement${stats.posts === 1 ? '' : 's'} in ${WINDOW_DAYS} days`} />
        <Figure value={stats.destinations} label="destinations addressed" />
        {stats.failed > 0 && (
          <Figure value={stats.failed} label="refused by a network" tone="warn" />
        )}
        {stats.medianReviewHours !== null && (
          <Figure
            value={formatHours(stats.medianReviewHours)}
            label="typical time in review"
            hint={
              stats.slowestReviewHours && stats.slowestReviewHours > stats.medianReviewHours * 4
                // A long tail matters more than the middle here: it is the post
                // that sat for a week that makes somebody route around the
                // workflow next time.
                ? `Slowest was ${formatHours(stats.slowestReviewHours)}.`
                : undefined
            }
          />
        )}
      </div>

      {stats.byPlatform.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#9c93ad]">By network</h3>
          <ul className="mt-2 space-y-1.5">
            {stats.byPlatform.map(([platform, e]) => {
              const rate = e.attempted ? e.posted / e.attempted : 0;
              return (
                <li key={platform} className="flex items-center gap-3 text-xs">
                  <span className="w-20 flex-shrink-0 text-[#422e59] dark:text-[#e4dcf0]">
                    {PLATFORM_PROFILES[platform]?.name ?? platform}
                  </span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#ece7de] dark:bg-[#2e2637]">
                    <span
                      className="block h-full rounded-full bg-emerald-600/60"
                      style={{ width: `${Math.round(rate * 100)}%` }}
                    />
                  </span>
                  <span className="w-32 flex-shrink-0 text-right text-[#6b6076] dark:text-[#9c93ad]">
                    {e.posted} of {e.attempted} accepted
                    {e.failed > 0 && <span className="text-[#a07c12]"> · {e.failed} refused</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* THE ABSENCE, STATED. See the header — this is the difference between
          a dashboard that has not measured something and one that reports zero. */}
      <p className="flex items-start gap-2 rounded-lg bg-[#faf8f4] p-3 text-xs text-[#6b6076] dark:bg-[#241f2c] dark:text-[#9c93ad]">
        <Info size={13} className="mt-0.5 flex-shrink-0" />
        <span>
          These are the University&apos;s own records of what it published. Reach, impressions and
          engagement belong to the networks and arrive through their APIs — none is connected to
          this deployment, so none is shown. A figure of zero here would report a measurement
          rather than the absence of one. See <code className="font-mono">docs/SOCIAL-CONNECTIONS.md</code>.
        </span>
      </p>
    </div>
  );
}

function Figure({
  value, label, hint, tone,
}: {
  value: number | string; label: string; hint?: string; tone?: 'warn';
}) {
  return (
    <div>
      <p className={`font-heading font-bold text-2xl ${tone === 'warn' ? 'text-[#a07c12]' : 'text-[#422e59] dark:text-[#e4dcf0]'}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">{label}</p>
      {hint && <p className="text-xs text-[#a07c12]">{hint}</p>}
    </div>
  );
}

/** Hours, said the way a person would say them. */
function formatHours(h: number): string {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} days`;
}
