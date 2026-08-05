'use client';

// ---------------------------------------------------------------------------
// The audit trail.
//
// This screen invented its own entries. When `audit_logs` came back empty it
// substituted eight fabricated records — "Grade modified … from C to B by
// Dr. Sarah Adeyemi", "Certificate issued … First Class" — with real-looking
// timestamps counted backwards from now, under a heading that read "All actions
// are logged and immutable".
//
// Of everything in this portal that showed sample data as though it were real,
// this was the one that mattered most. An audit log is the record you consult
// precisely when you do not trust what you are being told: after a disputed
// grade, a contested admission, a credential someone denies issuing. A log that
// manufactures entries is worse than no log, because it will be believed. The
// invented "Grade modified from C to B" names a lecturer who does not exist
// altering a mark that was never awarded.
//
// It now shows what is in the table. When the table is empty it says so, and
// says why that is expected on a new installation.
//
// The database backs the claim in the heading: migration 002 puts BEFORE UPDATE
// and BEFORE DELETE triggers on audit_logs that raise for every caller, the
// service role included. Nobody can amend a line — not an administrator, not
// the Superadministrator, not the routes that write it.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { AuditLog } from '@/lib/types';
import { Card, PageHeader, EmptyState, SkeletonRows } from '@/components/ui/portal';
import { INPUT, BTN_GHOST } from '@/lib/portalTheme';
import { Shield, Search, Clock, User, ScrollText, AlertTriangle } from 'lucide-react';

/**
 * How an entry is described to a reader.
 *
 * The routes write dotted machine actions — `account.suspended`,
 * `credential_template.published`. Rendering those raw made the log readable
 * only by whoever wrote the route.
 */
const ACTION_LABELS: Record<string, string> = {
  'account.created': 'Account created',
  'account.suspended': 'Account suspended',
  'account.reinstated': 'Account reinstated',
  'credential_template.published': 'Credential design published',
};

function describe(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  return action.replace(/[._]/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/** Entries that record a change of who may do what get marked. */
function isPrivileged(action: string): boolean {
  return action.startsWith('account.') || action.startsWith('credential_template.');
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    // No fallback. If the read fails, say the read failed.
    setError(err ? err.message : null);
    setLogs((data ?? []) as AuditLog[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      !q
        ? logs
        : logs.filter((l) =>
            `${l.action} ${l.performed_by ?? ''} ${l.entity_type ?? ''} ${JSON.stringify(l.details ?? {})}`
              .toLowerCase()
              .includes(q),
          ),
    [logs, q],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        subtitle={loading ? 'Reading the trail…' : `${logs.length} recorded ${logs.length === 1 ? 'action' : 'actions'}`}
        action={
          <p className="flex items-center gap-1.5 text-xs text-[#8a8194]">
            <Shield size={13} /> Append-only — entries cannot be edited or deleted
          </p>
        }
      />

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <strong>The audit trail could not be read.</strong>
            <p className="mt-0.5">
              {error}. The trail is readable only by the service role; this screen reads it with the
              browser key, so it is empty by design until a server-side reader is added. Nothing
              below is a substitute for it.
            </p>
          </div>
        </div>
      )}

      <div className="relative max-w-md">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a49bb0]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by action, person or record"
          aria-label="Search the audit log"
          className={`${INPUT} pl-9`}
        />
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <SkeletonRows rows={6} cols={3} />
        ) : filtered.length === 0 ? (
          q ? (
            <EmptyState
              icon={<Search size={20} />}
              title={`Nothing matches “${query.trim()}”`}
              description={`${logs.length} entries are recorded; none of them mention that.`}
              action={<button onClick={() => setQuery('')} className={BTN_GHOST}>Clear the search</button>}
            />
          ) : (
            <EmptyState
              icon={<ScrollText size={20} />}
              title="Nothing recorded yet"
              description="Entries are written when accounts are created, suspended or reinstated, and when a credential design is published. On a new installation this is expected — and an empty trail is shown as empty rather than filled in."
            />
          )
        ) : (
          <ul className="divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
            {filtered.map((log) => (
              <li key={log.id} className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-[#faf8f4] dark:hover:bg-[#241f2c]">
                <div
                  className={`mt-0.5 rounded-lg p-1.5 ${
                    isPrivileged(log.action)
                      ? 'bg-[#faf6ee] text-[#c5a55a] dark:bg-[#2a2333]'
                      : 'bg-[#f2eee6] text-[#8a8194] dark:bg-[#241f2c]'
                  }`}
                >
                  <FileIcon privileged={isPrivileged(log.action)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#33234a] dark:text-[#e4dcf0]">
                    {describe(log.action)}
                  </p>
                  {log.details && Object.keys(log.details as object).length > 0 && (
                    // Readable pairs rather than a JSON blob. `{"target_email":
                    // "x@y", "reason": "…"}` is the shape of the data, not a
                    // sentence anyone can act on.
                    <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                      {Object.entries(log.details as Record<string, unknown>)
                        .filter(([, v]) => v !== null && v !== '')
                        .map(([k, v]) => (
                          <div key={k} className="flex gap-1.5 text-xs">
                            <dt className="text-[#a49bb0]">{k.replace(/_/g, ' ')}:</dt>
                            <dd className="text-[#6b6076] dark:text-[#9c93ad]">{String(v)}</dd>
                          </div>
                        ))}
                    </dl>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-[#a49bb0]">
                    <span className="flex items-center gap-1">
                      <User size={10} /> {log.performed_by || 'System'}
                    </span>
                    <span className="flex items-center gap-1 tabular-nums">
                      <Clock size={10} />
                      {new Date(log.created_at).toLocaleString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                    {log.entity_type && (
                      <span className="rounded bg-[#f2eee6] px-1.5 py-0.5 text-[10px] text-[#8a8194] dark:bg-[#241f2c]">
                        {log.entity_type}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function FileIcon({ privileged }: { privileged: boolean }) {
  return privileged ? <Shield size={14} /> : <ScrollText size={14} />;
}
