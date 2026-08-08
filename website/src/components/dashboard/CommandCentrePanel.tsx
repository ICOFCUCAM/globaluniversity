'use client';

// ---------------------------------------------------------------------------
// THE UNIVERSITY COMMAND CENTRE — the panel the University drew in point 11.
//
// Two halves on one row: what the institution is SAYING, and what it has
// ISSUED. They sit together because they are the two things a Vice-Chancellor
// is answerable for in public, and because the University's twelfth point asked
// that these subsystems not be built as isolated pages.
//
// ---------------------------------------------------------------------------
// EVERY NUMBER HERE IS COUNTED, NONE IS TYPED
// ---------------------------------------------------------------------------
//
// This project's standing rule about institutional figures applies to an
// internal dashboard exactly as it applies to the homepage, and for a sharper
// reason: a decorative number on the front page misleads a visitor, and a
// decorative number here misleads the person deciding what to do next.
//
// So a count of zero is shown as zero and said plainly. "No announcement has
// gone out this month" is useful. A placeholder that implies activity there has
// not been is worse than an empty panel.
//
// WHAT IS DELIBERATELY ABSENT. Reach, impressions and engagement rates.
// social_post_metrics exists and will hold them, but nothing has been published
// through the pipeline yet and no platform application is connected, so there
// is nothing to count. A dashboard that showed "0% engagement" would be
// reporting a measurement rather than the absence of one.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ViewType } from '@/lib/types';
import { statusFromTargets, type TargetState } from '@/lib/social';
import {
  Share2, BadgeCheck, ArrowRight, AlertTriangle, Inbox, History,
} from 'lucide-react';

interface Counts {
  /** Publications in the last thirty days. */
  posts: number;
  /** Publications where at least one network refused — these need somebody. */
  partial: number;
  /** Accounts connected and usable. */
  accounts: number;
  credentials: number;
  corrected: number;
  corrections: number;
  auditEvents: number;
  /** Set when the tables are absent, i.e. migration 013 has not been run. */
  notReady: boolean;
}

const EMPTY: Counts = {
  posts: 0, partial: 0, accounts: 0, credentials: 0,
  corrected: 0, corrections: 0, auditEvents: 0, notReady: false,
};

export default function CommandCentrePanel({ onNavigate }: { onNavigate?: (v: ViewType) => void }) {
  const [counts, setCounts] = useState<Counts | null>(null);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const [posts, accounts, credentials, corrections, audit] = await Promise.all([
      supabase.from('social_posts')
        .select('id, status, social_post_targets(status)')
        .gte('created_at', since),
      supabase.from('social_accounts').select('id, status').eq('status', 'connected'),
      // The register is grouped by number in the browser: a corrected award is
      // two rows and one award, and counting rows would report the University
      // as having issued more credentials every time it corrected one.
      supabase.from('credentials_issued').select('credential_id, status'),
      supabase.from('credential_correction_requests').select('id, status'),
      supabase.from('credential_audit_events').select('id'),
    ]);

    if (posts.error?.message.includes('does not exist')
      || accounts.error?.message.includes('does not exist')) {
      setCounts({ ...EMPTY, notReady: true });
      return;
    }

    const postRows = (posts.data ?? []) as Array<{ social_post_targets?: Array<{ status: TargetState }> }>;
    const refs = new Set((credentials.data ?? []).map((r: Record<string, any>) => r.credential_id));
    const superseded = (credentials.data ?? []).filter((r: Record<string, any>) => r.status === 'replaced');

    setCounts({
      posts: postRows.length,
      partial: postRows.filter((p) =>
        statusFromTargets((p.social_post_targets ?? []).map((t) => t.status)) === 'partially_failed').length,
      accounts: (accounts.data ?? []).length,
      credentials: refs.size,
      // Awards that have been corrected at least once — the number a
      // Vice-Chancellor actually wants, because each one is a document the
      // University got wrong first time.
      corrected: new Set(superseded.map((r: Record<string, any>) => r.credential_id)).size,
      corrections: (corrections.data ?? []).filter((r: Record<string, any>) =>
        !['approved', 'rejected', 'withdrawn'].includes(r.status)).length,
      auditEvents: (audit.data ?? []).length,
      notReady: false,
    });
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (counts?.notReady) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-[#e9c14a]/40 bg-[#e9c14a]/10 p-4 text-sm">
        <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-[#a07c12]" />
        <span className="text-[#6b6076] dark:text-[#9c93ad]">
          The Command Centre is not installed. Run
          {' '}<code className="font-mono text-xs">docs/migrations/013_social_and_credential_authority.sql</code>{' '}
          to add the social pipeline and the credential authority.
        </span>
      </div>
    );
  }

  const c = counts ?? EMPTY;

  return (
    <section>
      <h2 className="font-heading font-bold text-lg text-[#422e59] dark:text-[#e4dcf0]">University command centre</h2>
      <p className="mt-0.5 text-sm text-[#6b6076] dark:text-[#9c93ad]">
        What the University is saying, and what it has issued.
      </p>

      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        {/* ---------------------------------------------------------------- */}
        <Half
          icon={<Share2 size={16} />}
          title="Social media"
          action={{ label: 'Command centre', view: 'social' }}
          onNavigate={onNavigate}
        >
          <Line
            value={c.accounts}
            label={c.accounts === 1 ? 'account connected' : 'accounts connected'}
            // The honest empty state. Nothing can be published from a system
            // with no connections, and saying which office fixes that is more
            // use than a zero on its own.
            empty="No account is connected. The Superadministrator connects the University's; each administrator connects their own in Settings."
          />
          <Line
            value={c.posts}
            label={c.posts === 1 ? 'publication in the last 30 days' : 'publications in the last 30 days'}
            empty="Nothing has been published in the last thirty days."
          />
          {c.partial > 0 && (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-[#e9c14a]/10 p-2 text-xs text-[#8a6a10]">
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
              {c.partial} {c.partial === 1 ? 'publication' : 'publications'} reached some networks
              and not others. Each can be retried without republishing the ones that worked.
            </p>
          )}
        </Half>

        {/* ---------------------------------------------------------------- */}
        <Half
          icon={<BadgeCheck size={16} />}
          title="Credentials"
          action={{ label: 'Credential authority', view: 'credential-authority' }}
          onNavigate={onNavigate}
        >
          <Line
            value={c.credentials}
            label={c.credentials === 1 ? 'award on the register' : 'awards on the register'}
            empty="No credential has been issued yet."
          />
          <Line
            value={c.corrected}
            label={c.corrected === 1 ? 'award has been corrected' : 'awards have been corrected'}
            empty="Nothing has needed correcting."
          />
          {c.corrections > 0 && (
            <button
              type="button"
              onClick={() => onNavigate?.('credential-authority')}
              className="mt-2 flex w-full items-start gap-2 rounded-lg bg-[#422e59]/10 p-2 text-left text-xs text-[#422e59] dark:text-[#c5a55a]"
            >
              <Inbox size={13} className="mt-0.5 flex-shrink-0" />
              {c.corrections} correction {c.corrections === 1 ? 'request is' : 'requests are'} waiting
              on the Registry.
            </button>
          )}
          {c.auditEvents > 0 && (
            <p className="mt-2 flex items-start gap-2 text-xs text-[#9c93ad]">
              <History size={13} className="mt-0.5 flex-shrink-0" />
              {c.auditEvents} {c.auditEvents === 1 ? 'entry' : 'entries'} on the permanent record.
              Nothing here can be edited or deleted, by anyone.
            </p>
          )}
        </Half>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Half({
  icon, title, action, onNavigate, children,
}: {
  icon: React.ReactNode;
  title: string;
  action: { label: string; view: ViewType };
  onNavigate?: (v: ViewType) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#ece7de] bg-white p-4 dark:border-[#2e2637] dark:bg-[#1f1a27]">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[#422e59] dark:text-[#e4dcf0]">
          {icon}{title}
        </h3>
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate(action.view)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#422e59] hover:underline dark:text-[#c5a55a]"
          >
            {action.label} <ArrowRight size={11} />
          </button>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/**
 * One figure, or the sentence that replaces it when the figure is zero.
 *
 * A ZERO IS NOT SHOWN AS A ZERO WITH A LABEL. "0 accounts connected" is a
 * measurement; "No account is connected, and here is who connects one" is the
 * thing the reader can act on. Every empty state on this panel says what to do
 * rather than what is missing.
 */
function Line({ value, label, empty }: { value: number; label: string; empty: string }) {
  if (value === 0) {
    return <p className="mt-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">{empty}</p>;
  }
  return (
    <p className="mt-1 text-sm text-[#422e59] dark:text-[#e4dcf0]">
      <span className="font-heading font-bold text-xl">{value.toLocaleString()}</span>
      <span className="ml-1.5 text-xs text-[#6b6076] dark:text-[#9c93ad]">{label}</span>
    </p>
  );
}
