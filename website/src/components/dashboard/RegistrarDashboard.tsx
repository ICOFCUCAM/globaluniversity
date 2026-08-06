'use client';

// ---------------------------------------------------------------------------
// The Office of the Registrar's dashboard.
//
// The Registrar was being shown the administrator's dashboard, which put
// Finance's queue on their screen: a tile reading "Awaiting Finance 1", a
// button offering to open the Finance desk, and a list of applications marked
// "Awaiting payment".
//
// None of that is the Registrar's business, and showing it undoes in the
// interface what the rest of the system is built to enforce. An application
// whose fee has not been registered has not entered the Registrar's workflow;
// `registrarQueue()` deliberately excludes it, migration 003 forbids the
// Registrar to touch a payment field, and roles.ts withholds 'verify-payment'
// from the role entirely. A dashboard that displays the unpaid queue anyway
// invites the question "can you just push that one through" — which is exactly
// the question the two-desk design exists to make unaskable.
//
// So this screen shows the Registrar's own work and nothing else: what is
// waiting on their decision, what they have decided, and the register they
// keep. Counts of lecturers, courses and departments are gone too — those
// belong to the academic office, not this one.
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
import { Stamp, Users, FileText, ArrowRight, Inbox, GraduationCap } from 'lucide-react';

export default function RegistrarDashboard({ onNavigate }: { onNavigate?: (v: ViewType) => void } = {}) {
  const { user } = useAuth();
  const [awaiting, setAwaiting] = useState(0);
  const [documentsRequested, setDocumentsRequested] = useState(0);
  const [admitted, setAdmitted] = useState(0);
  const [conditional, setConditional] = useState(0);
  const [queue, setQueue] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    (async () => {
      const count = (build: (q: any) => any) =>
        build(supabase.from('students').select('id', { count: 'exact', head: true }));

      const [wait, docs, adm, cond, q, recent] = await Promise.all([
        count((x) => x.eq('status', 'fee_paid')),
        count((x) => x.eq('status', 'documents_required')),
        count((x) => x.eq('status', 'approved')),
        count((x) => x.eq('status', 'conditional')),
        // The Registrar's queue is fee-verified applications only. This is the
        // same filter the desk uses, and it is the gate: an unpaid application
        // is not listed here because it is not yet this office's to decide.
        supabase.from('students')
          .select('id, first_name, last_name, matric_no, program, degree_type, status, fee_registered_at')
          .in('status', ['fee_paid', 'documents_required'])
          .order('fee_registered_at', { ascending: true })
          .limit(6),
        supabase.from('students')
          .select('id, first_name, last_name, student_number, program, status, decided_at')
          .not('decided_at', 'is', null)
          .order('decided_at', { ascending: false })
          .limit(5),
      ]);

      if (!live) return;
      setAwaiting(wait.count ?? 0);
      setDocumentsRequested(docs.count ?? 0);
      setAdmitted(adm.count ?? 0);
      setConditional(cond.count ?? 0);
      setQueue(q.data ?? []);
      setDecisions(recent.data ?? []);
      setLoading(false);
    })();
    return () => { live = false; };
  }, []);

  const go = (v: ViewType) => () => onNavigate?.(v);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-[#33234a] p-6 text-white">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#e9c14a]">
          {roleLabels[user?.role ?? 'registrar']}
        </p>
        <h1 className="mt-1.5 font-heading text-2xl font-bold">
          Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
        <p className="mt-1 text-sm text-white/65">
          {UNIVERSITY.name} ·{' '}
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {awaiting + documentsRequested > 0 ? (
            <button onClick={go('admissions-registrar')} className={`${BTN_PRIMARY} bg-[#e9c14a] text-[#241a30] hover:bg-[#f3d27a]`}>
              <Stamp size={15} /> {awaiting + documentsRequested} awaiting your decision
            </button>
          ) : (
            <button onClick={go('admissions-registrar')} className={`${BTN_SECONDARY} border-white/25 bg-white/10 text-white hover:bg-white/20`}>
              <Stamp size={15} /> Registrar desk
            </button>
          )}
          <button onClick={go('students')} className={`${BTN_SECONDARY} border-white/25 bg-white/10 text-white hover:bg-white/20`}>
            <Users size={15} /> Student register
          </button>
        </div>
      </div>

      {/* This office's work. There is no Finance figure here on purpose. */}
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
            <button onClick={go('admissions-registrar')} className={`rounded-xl text-left ${FOCUS}`}>
              <Figure
                label="Awaiting your decision"
                value={awaiting.toLocaleString()}
                hint="Fee verified by Finance"
                icon={<Stamp size={16} />}
                tone={awaiting === 0 ? 'muted' : 'neutral'}
              />
            </button>
            <button onClick={go('admissions-registrar')} className={`rounded-xl text-left ${FOCUS}`}>
              <Figure
                label="Documents requested"
                value={documentsRequested.toLocaleString()}
                hint="Waiting on the applicant"
                icon={<FileText size={16} />}
                tone={documentsRequested === 0 ? 'muted' : 'neutral'}
              />
            </button>
            <Figure
              label="Admitted"
              value={admitted.toLocaleString()}
              hint="Unconditional offers made"
              icon={<GraduationCap size={16} />}
              tone={admitted === 0 ? 'muted' : 'neutral'}
            />
            <Figure
              label="Conditional"
              value={conditional.toLocaleString()}
              hint="Admitted with outstanding conditions"
              icon={<FileText size={16} />}
              tone={conditional === 0 ? 'muted' : 'neutral'}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Awaiting your decision"
            subtitle="Fee verified, longest wait first"
            action={
              onNavigate ? (
                <button onClick={go('admissions-registrar')} className="inline-flex items-center gap-1 text-xs font-medium text-[#422e59] hover:underline dark:text-[#c9b6e6]">
                  Registrar desk <ArrowRight size={12} />
                </button>
              ) : undefined
            }
          />
          {loading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : queue.length === 0 ? (
            <EmptyState
              icon={<Inbox size={20} />}
              title="Nothing awaiting a decision"
              description="Applications appear here once the Finance office has registered the application fee. Until then they are not yours to decide."
            />
          ) : (
            <TableShell>
              <THead>
                <tr>
                  <Th>Applicant</Th>
                  <Th>Programme</Th>
                  <Th>Status</Th>
                  <Th align="right">Fee verified</Th>
                </tr>
              </THead>
              <TBody>
                {queue.map((r) => {
                  const meta = statusMeta(toUniversal(r.status));
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-[#faf8f4] dark:hover:bg-[#241f2c]">
                      <Td className="font-medium text-[#33234a] dark:text-[#e4dcf0]">
                        {[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}
                      </Td>
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
                        {r.fee_registered_at
                          ? new Date(r.fee_registered_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                          : '—'}
                      </Td>
                    </tr>
                  );
                })}
              </TBody>
            </TableShell>
          )}
        </Card>

        <Card>
          <CardHeader title="Your recent decisions" subtitle="The last five recorded" />
          {loading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : decisions.length === 0 ? (
            <EmptyState icon={<Stamp size={18} />} title="No decisions yet" />
          ) : (
            <ul className="divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
              {decisions.map((d) => {
                const meta = statusMeta(toUniversal(d.status));
                return (
                  <li key={d.id} className="px-5 py-3">
                    <p className="text-sm font-medium text-[#33234a] dark:text-[#e4dcf0]">
                      {[d.first_name, d.last_name].filter(Boolean).join(' ')}
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.chip}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
                        {meta.label}
                      </span>
                      <span className="text-[11px] tabular-nums text-[#a49bb0]">
                        {d.decided_at
                          ? new Date(d.decided_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                          : ''}
                      </span>
                    </div>
                    {d.student_number && (
                      <p className="mt-0.5 font-mono text-[11px] tabular-nums text-[#a49bb0]">{d.student_number}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
          <strong className="text-[#33234a] dark:text-[#e4dcf0]">This office admits; it does not verify payment.</strong>{' '}
          Applications reach you only after the Finance office has registered the fee, and the
          database refuses any change to a payment field made from here. Nothing awaiting Finance
          is shown on this screen — it is not yet yours to decide.
        </p>
      </Card>
    </div>
  );
}
