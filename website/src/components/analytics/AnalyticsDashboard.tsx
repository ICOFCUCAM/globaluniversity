'use client';

// ---------------------------------------------------------------------------
// Analytics.
//
// Every figure on this screen was invented. It reported six departments —
// Computer Science, Mechanical Engineering, Business Info Systems — that this
// university does not have, each with a fabricated average GPA and pass rate.
// It drew a classification distribution over 2,847 graduates: 156 First Class,
// 890 Second Upper, and so on, none of them counted from anything. And it
// offered an "Export Report" button with no handler, so nobody ever exported
// the numbers and discovered they were fiction.
//
// This is the same failure as the dashboard and the audit log, in the screen
// most likely to be photographed for a board paper. "Average GPA 3.82 in
// Computer Science" is exactly the sort of line that ends up in a strategic
// plan, and this university teaches theology.
//
// What is here now is what can be counted: students by faculty and by status,
// from the register. What cannot yet be computed — grade distributions,
// progression, pass rates — says so and explains what it is waiting for, rather
// than drawing a plausible chart. An empty chart is a smaller failure than a
// convincing wrong one.
// ---------------------------------------------------------------------------

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { statusMeta, toUniversal } from '@/lib/status';
import {
  Card, CardHeader, PageHeader, EmptyState, Skeleton, TableShell, THead, TBody, Th, Td,
} from '@/components/ui/portal';
import { BTN_SECONDARY } from '@/lib/portalTheme';
import { Download, BarChart3, Info } from 'lucide-react';

interface Row { key: string; count: number }

export default function AnalyticsDashboard() {
  const [byFaculty, setByFaculty] = useState<Row[]>([]);
  const [byStatus, setByStatus] = useState<Row[]>([]);
  const [byIntake, setByIntake] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    (async () => {
      // One read, grouped in the browser. The alternative is a view or an RPC;
      // for a register of this size a single select is cheaper than either, and
      // it cannot drift out of step with the table the way a view can.
      const { data } = await supabase
        .from('students')
        .select('faculty, program, status, intake, admission_year');
      if (!live) return;

      const rows = data ?? [];
      const tally = (get: (r: any) => string | null | undefined): Row[] => {
        const m = new Map<string, number>();
        for (const r of rows) {
          const k = (get(r) ?? '').toString().trim() || 'Not recorded';
          m.set(k, (m.get(k) ?? 0) + 1);
        }
        return [...m.entries()]
          .map(([key, count]) => ({ key, count }))
          .sort((a, b) => b.count - a.count);
      };

      setTotal(rows.length);
      setByFaculty(tally((r) => r.faculty || r.program));
      setByStatus(tally((r) => r.status));
      setByIntake(tally((r) => r.intake || r.admission_year));
      setLoading(false);
    })();
    return () => { live = false; };
  }, []);

  const max = useMemo(() => Math.max(1, ...byFaculty.map((r) => r.count)), [byFaculty]);

  function exportCsv() {
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const section = (title: string, rows: Row[]) => [
      esc(title),
      'Group,Students',
      ...rows.map((r) => `${esc(r.key)},${r.count}`),
      '',
    ];
    const csv = [
      `ICOF Global University — student register summary`,
      `Generated,${new Date().toISOString()}`,
      `Total students,${total}`,
      '',
      ...section('By faculty', byFaculty),
      ...section('By status', byStatus),
      ...section('By intake', byIntake),
    ].join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `icof-register-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        subtitle={loading ? 'Reading the register…' : `${total.toLocaleString()} student records`}
        action={
          <button onClick={exportCsv} disabled={loading || total === 0} className={BTN_SECONDARY}>
            <Download size={15} /> Export summary
          </button>
        }
      />

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-4 w-40" />
              {Array.from({ length: 5 }, (_, j) => <Skeleton key={j} className="mt-3 h-5 w-full" />)}
            </Card>
          ))}
        </div>
      ) : total === 0 ? (
        <Card>
          <EmptyState
            icon={<BarChart3 size={20} />}
            title="Nothing to analyse yet"
            description="These figures are counted from the student register. Once applications have been approved, the breakdowns by faculty, status and intake appear here."
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Students by faculty" subtitle="Counted from the register" />
              <div className="space-y-3 p-5">
                {byFaculty.map((r) => (
                  <div key={r.key}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate text-[#33234a] dark:text-[#e4dcf0]">{r.key}</span>
                      <span className="tabular-nums text-[#6b6076] dark:text-[#9c93ad]">{r.count}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#f0ece4] dark:bg-[#2a2333]">
                      {/* Bars are proportional to the largest group, and the
                          number is printed beside every one. A bar with no
                          figure next to it invites the reader to estimate, and
                          they will estimate wrong. */}
                      <div className="h-full rounded-full bg-[#422e59]" style={{ width: `${(r.count / max) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="Students by status" subtitle="Where each record sits in the lifecycle" />
              <TableShell>
                <THead>
                  <tr><Th>Status</Th><Th align="right">Students</Th><Th align="right">Share</Th></tr>
                </THead>
                <TBody>
                  {byStatus.map((r) => {
                    const meta = statusMeta(toUniversal(r.key));
                    return (
                      <tr key={r.key}>
                        <Td>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${meta.chip}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
                            {meta.label}
                          </span>
                        </Td>
                        <Td align="right" numeric>{r.count}</Td>
                        <Td align="right" numeric className="text-[#8a8194]">
                          {((r.count / total) * 100).toFixed(1)}%
                        </Td>
                      </tr>
                    );
                  })}
                </TBody>
              </TableShell>
            </Card>
          </div>

          <Card>
            <CardHeader title="Students by intake" subtitle="Counted from the register" />
            <TableShell>
              <THead><tr><Th>Intake</Th><Th align="right">Students</Th></tr></THead>
              <TBody>
                {byIntake.map((r) => (
                  <tr key={r.key}>
                    <Td numeric>{r.key}</Td>
                    <Td align="right" numeric>{r.count}</Td>
                  </tr>
                ))}
              </TBody>
            </TableShell>
          </Card>
        </>
      )}

      {/* What is deliberately absent, and why. */}
      <Card className="p-4">
        <div className="flex items-start gap-2.5">
          <Info size={16} className="mt-0.5 flex-shrink-0 text-[#c5a55a]" />
          <div className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
            <p className="font-medium text-[#33234a] dark:text-[#e4dcf0]">Not shown yet</p>
            <p className="mt-1 leading-relaxed">
              Grade distribution, classification breakdown, pass rates and progression need approved
              results to compute from. They appear here once results are being approved through the
              Grade Book — not before. This screen previously drew all four from invented numbers.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
