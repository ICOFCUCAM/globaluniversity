'use client';

// Learning analytics — early-warning insights for the registry and faculty.
// Combines three live signals already held by the system:
//   attendance records (documents · 'attendance')
//   academic results   (results table, when populated)
//   fee receipts       (documents · 'fee-receipt')
// Every student is scored and flagged so intervention happens early.
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AlertTriangle, TrendingUp, Users, Wallet } from 'lucide-react';

interface Student {
  id: string;
  matric_no: string;
  first_name: string;
  last_name: string;
  program: string | null;
  status: string;
}

interface Signal {
  student: Student;
  attendanceRate: number | null;
  sessions: number;
  avgScore: number | null;
  paid: boolean;
  risk: 'high' | 'watch' | 'ok';
  reasons: string[];
}

const dec = (u: string) => JSON.parse(decodeURIComponent(escape(atob(u.split('base64,')[1]))));

export default function InsightsModule() {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<{ matric: string; status: string }[]>([]);
  const [receipts, setReceipts] = useState<string[]>([]);
  const [results, setResults] = useState<{ student_id: string; score: number | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [studRes, docRes, resRes] = await Promise.all([
        supabase.from('students').select('id, matric_no, first_name, last_name, program, status'),
        supabase.from('documents').select('file_name, file_url, document_type').in('document_type', ['attendance', 'fee-receipt']),
        supabase.from('results').select('student_id, score').limit(2000),
      ]);
      if (studRes.data) setStudents(studRes.data as Student[]);
      if (docRes.data) {
        const att: { matric: string; status: string }[] = [];
        const rcp: string[] = [];
        for (const d of docRes.data as any[]) {
          if (d.document_type === 'attendance') {
            try {
              const j = dec(d.file_url);
              att.push({ matric: String(j.matric ?? '').toUpperCase(), status: j.status });
            } catch {
              /* skip */
            }
          } else {
            rcp.push(String(d.file_name ?? ''));
          }
        }
        setAttendance(att);
        setReceipts(rcp);
      }
      if (resRes.data) setResults(resRes.data as any[]);
      setLoading(false);
    })();
  }, []);

  const signals: Signal[] = useMemo(() => {
    return students
      .filter((s) => s.status === 'active')
      .map((s) => {
        const mine = attendance.filter((a) => a.matric === s.matric_no.toUpperCase());
        const attendanceRate = mine.length
          ? Math.round((mine.filter((a) => a.status === 'present').length / mine.length) * 100)
          : null;
        const myResults = results.filter((r) => r.student_id === s.id && typeof r.score === 'number');
        const avgScore = myResults.length
          ? Math.round(myResults.reduce((t, r) => t + (r.score as number), 0) / myResults.length)
          : null;
        const paid = receipts.some((r) => r.includes(s.matric_no));

        const reasons: string[] = [];
        if (attendanceRate !== null && attendanceRate < 60) reasons.push(`Attendance ${attendanceRate}%`);
        if (avgScore !== null && avgScore < 50) reasons.push(`Average score ${avgScore}%`);
        if (!paid) reasons.push('No fee payment recorded');

        const risk: Signal['risk'] = reasons.length >= 2 ? 'high' : reasons.length === 1 ? 'watch' : 'ok';
        return { student: s, attendanceRate, sessions: mine.length, avgScore, paid, risk, reasons };
      })
      .sort((a, b) => {
        const order = { high: 0, watch: 1, ok: 2 };
        return order[a.risk] - order[b.risk];
      });
  }, [students, attendance, results, receipts]);

  const counts = {
    total: signals.length,
    high: signals.filter((s) => s.risk === 'high').length,
    watch: signals.filter((s) => s.risk === 'watch').length,
    paid: signals.filter((s) => s.paid).length,
  };

  const badge = {
    high: 'bg-red-50 text-red-700',
    watch: 'bg-amber-50 text-amber-700',
    ok: 'bg-emerald-50 text-emerald-700',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Learning Analytics</h2>
        <p className="text-sm text-gray-500">
          Early-warning insights combining attendance, results and fee status for active students
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Active students', value: counts.total, icon: <Users size={16} />, tone: 'text-gray-800' },
          { label: 'High risk', value: counts.high, icon: <AlertTriangle size={16} />, tone: 'text-red-600' },
          { label: 'Watch list', value: counts.watch, icon: <TrendingUp size={16} />, tone: 'text-amber-600' },
          { label: 'Fees recorded', value: counts.paid, icon: <Wallet size={16} />, tone: 'text-emerald-600' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-gray-100 bg-white p-5">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              {c.icon} {c.label}
            </p>
            <p className={`mt-1 text-2xl font-bold ${c.tone}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Student', 'Programme', 'Attendance', 'Avg. score', 'Fees', 'Status'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && signals.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                    No active students yet. Insights appear as attendance, results and fees are recorded.
                  </td>
                </tr>
              )}
              {signals.map((s) => (
                <tr key={s.student.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-gray-800">
                      {s.student.first_name} {s.student.last_name}
                    </p>
                    <p className="font-mono text-xs text-gray-400">{s.student.matric_no}</p>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">{s.student.program || '—'}</td>
                  <td className="px-5 py-3 text-sm">
                    {s.attendanceRate === null ? (
                      <span className="text-gray-400">no records</span>
                    ) : (
                      <span className={s.attendanceRate < 60 ? 'font-semibold text-red-600' : 'text-gray-700'}>
                        {s.attendanceRate}% <span className="text-xs text-gray-400">({s.sessions})</span>
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-sm">
                    {s.avgScore === null ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <span className={s.avgScore < 50 ? 'font-semibold text-red-600' : 'text-gray-700'}>{s.avgScore}%</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-sm">
                    {s.paid ? <span className="text-emerald-600">recorded</span> : <span className="text-amber-600">none</span>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${badge[s.risk]}`}>
                      {s.risk === 'ok' ? 'on track' : s.risk}
                    </span>
                    {s.reasons.length > 0 && (
                      <p className="mt-1 text-[11px] text-gray-400">{s.reasons.join(' · ')}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Risk is indicative, not disciplinary: two or more signals (attendance below 60%, average score below 50%,
        or no fee payment recorded) flag a student as high risk so that academic advisers can reach out early.
      </p>
    </div>
  );
}
