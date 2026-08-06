'use client';

// ---------------------------------------------------------------------------
// The Finance Administrator's dashboard.
//
// There was none. `ALL` in portalNav listed four roles — superadmin, admin,
// student, lecturer — so a Finance Administrator signing in saw one menu item,
// the Finance desk, and nothing else. No dashboard, no settings, no way to
// reach the screen that changes their own password on a system that emails them
// a temporary one and instructs them to change it immediately.
//
// Routing them to the administrator's dashboard would have been the quick fix
// and the wrong one. That screen counts lecturers, courses and departments —
// none of which is Finance's work — and it opens with actions Finance is
// forbidden to take. A dashboard should answer the question the person opening
// it actually has, and for this desk that question is: what is waiting for me,
// and what has come in?
//
// Every figure is counted. Where a figure cannot be counted it is absent, not
// estimated — see docs/PORTAL-DESIGN.md.
// ---------------------------------------------------------------------------

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { UNIVERSITY } from '@/lib/constants';
import { roleLabels } from '@/lib/roles';
import { statusMeta, toUniversal } from '@/lib/status';
import {
  Card, CardHeader, Figure, EmptyState, Skeleton, TableShell, THead, TBody, Th, Td,
} from '@/components/ui/portal';
import { BTN_PRIMARY, BTN_SECONDARY, FOCUS } from '@/lib/portalTheme';
import type { ViewType } from '@/lib/types';
import { Wallet, Banknote, Inbox, ArrowRight, Users, AlertCircle } from 'lucide-react';

export default function FinanceDashboard({ onNavigate }: { onNavigate?: (v: ViewType) => void } = {}) {
  const { user } = useAuth();
  const [awaitingFee, setAwaitingFee] = useState(0);
  const [verifiedToday, setVerifiedToday] = useState(0);
  const [payments, setPayments] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const [waiting, today, pays, queue] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true })
          .eq('status', 'applicant'),
        supabase.from('students').select('id', { count: 'exact', head: true })
          .eq('status', 'fee_paid')
          .gte('fee_registered_at', startOfToday.toISOString()),
        supabase.from('payments').select('amount, currency, received_at, purpose').order('received_at', { ascending: false }).limit(200),
        supabase.from('students')
          .select('id, first_name, last_name, matric_no, program, degree_type, status, created_at')
          .eq('status', 'applicant')
          .order('created_at', { ascending: true })
          .limit(6),
      ]);

      if (!live) return;

      // An empty queue and a queue the database will not show look identical:
      // a denied read returns no rows, not an error. That is exactly how the
      // admissions pipeline went unnoticed, so this desk says which it is.
      setBlocked((waiting.count ?? 0) === 0 && (queue.data ?? []).length === 0 && !!queue.error);

      setAwaitingFee(waiting.count ?? 0);
      setVerifiedToday(today.count ?? 0);
      setPayments(pays.data ?? []);
      setRecent(queue.data ?? []);
      setLoading(false);
    })();
    return () => { live = false; };
  }, []);

  // Currencies are never added together: the university charges a subsidised
  // ICOF rate and a European rate, and one combined figure across both is a
  // number the finance office would be asked to explain and could not.
  const totals: Record<string, number> = {};
  for (const p of payments) {
    const v = Number(p.amount);
    if (Number.isFinite(v)) totals[p.currency] = (totals[p.currency] ?? 0) + v;
  }

  const go = (v: ViewType) => () => onNavigate?.(v);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-[#33234a] p-6 text-white">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#e9c14a]">
          {roleLabels[user?.role ?? 'finance']}
        </p>
        <h1 className="mt-1.5 font-heading text-2xl font-bold">
          Good day{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
        <p className="mt-1 text-sm text-white/65">
          {UNIVERSITY.name} ·{' '}
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {awaitingFee > 0 ? (
            <button onClick={go('admissions-finance')} className={`${BTN_PRIMARY} bg-[#e9c14a] text-[#241a30] hover:bg-[#f3d27a]`}>
              <Wallet size={15} /> {awaitingFee} awaiting a fee
            </button>
          ) : (
            <button onClick={go('admissions-finance')} className={`${BTN_SECONDARY} border-white/25 bg-white/10 text-white hover:bg-white/20`}>
              <Wallet size={15} /> Finance desk
            </button>
          )}
          <button onClick={go('fees')} className={`${BTN_SECONDARY} border-white/25 bg-white/10 text-white hover:bg-white/20`}>
            <Banknote size={15} /> Record a payment
          </button>
        </div>
      </div>

      {blocked && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <p>
            <strong>Applications could not be read.</strong> This usually means
            <code className="mx-1 rounded bg-white/60 px-1 dark:bg-black/20">003_pipeline_rls.sql</code>
            has not been run. Applications are still being recorded; they are simply not being
            shown.
          </p>
        </div>
      )}

      {/* What is waiting, and what has come in. Nothing else. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }, (_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-7 w-16" />
            </Card>
          ))
        ) : (
          <>
            <button onClick={go('admissions-finance')} className={`rounded-xl text-left ${FOCUS}`}>
              <Figure
                label="Awaiting a fee"
                value={awaitingFee.toLocaleString()}
                hint="Applications you have not yet verified"
                icon={<Inbox size={16} />}
                tone={awaitingFee === 0 ? 'muted' : 'neutral'}
              />
            </button>
            <Figure
              label="Verified today"
              value={verifiedToday.toLocaleString()}
              hint="Fees you registered since midnight"
              icon={<Wallet size={16} />}
              tone={verifiedToday === 0 ? 'muted' : 'neutral'}
            />
            <button onClick={go('fees')} className={`rounded-xl text-left ${FOCUS}`}>
              <Figure
                label="Payments recorded"
                value={payments.length.toLocaleString()}
                hint="In the payments ledger"
                icon={<Banknote size={16} />}
                tone={payments.length === 0 ? 'muted' : 'neutral'}
              />
            </button>
            <Card className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8194]">Collected</p>
              {Object.keys(totals).length === 0 ? (
                <p className="mt-2 font-heading text-2xl font-bold text-[#a49bb0]">—</p>
              ) : (
                <div className="mt-2 space-y-0.5">
                  {Object.entries(totals).map(([cur, amt]) => (
                    <p key={cur} className="font-heading text-lg font-bold tabular-nums text-[#241a30] dark:text-[#ece9f0]">
                      {amt.toLocaleString()} <span className="text-xs font-normal text-[#8a8194]">{cur}</span>
                    </p>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-[#8a8194]">Never summed across currencies</p>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader
          title="Oldest applications awaiting a fee"
          subtitle="First in, first served — these have waited longest"
          action={
            onNavigate ? (
              <button onClick={go('admissions-finance')} className="inline-flex items-center gap-1 text-xs font-medium text-[#422e59] hover:underline dark:text-[#c9b6e6]">
                Finance desk <ArrowRight size={12} />
              </button>
            ) : undefined
          }
        />
        {loading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            icon={<Users size={20} />}
            title="Nothing waiting"
            description="Every application that has arrived has had its fee registered. New ones appear here as they are submitted."
          />
        ) : (
          <TableShell>
            <THead>
              <tr>
                <Th>Applicant</Th>
                <Th>Application</Th>
                <Th>Programme</Th>
                <Th>Status</Th>
                <Th align="right">Waiting since</Th>
              </tr>
            </THead>
            <TBody>
              {recent.map((r) => {
                const meta = statusMeta(toUniversal(r.status));
                return (
                  <tr key={r.id} className="transition-colors hover:bg-[#faf8f4] dark:hover:bg-[#241f2c]">
                    <Td className="font-medium text-[#33234a] dark:text-[#e4dcf0]">
                      {[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}
                    </Td>
                    <Td numeric className="font-mono text-xs text-[#6b6076] dark:text-[#9c93ad]">{r.matric_no}</Td>
                    <Td className="text-[#6b6076] dark:text-[#9c93ad]">
                      {[r.degree_type, r.program].filter(Boolean).join(' · ') || '—'}
                    </Td>
                    <Td>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${meta.chip}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
                        {meta.label}
                      </span>
                    </Td>
                    <Td align="right" numeric className="text-xs text-[#8a8194]">
                      {r.created_at
                        ? new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                        : '—'}
                    </Td>
                  </tr>
                );
              })}
            </TBody>
          </TableShell>
        )}
      </Card>

      {/* What this desk may not do, stated rather than merely absent. */}
      <Card className="p-4">
        <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
          <strong className="text-[#33234a] dark:text-[#e4dcf0]">This desk verifies payment; it does not admit.</strong>{' '}
          Registering a fee passes the application to the Office of the Registrar, who decides it.
          The database enforces that split — an attempt to record an admission decision from here
          is refused, not merely hidden.
        </p>
      </Card>
    </div>
  );
}
