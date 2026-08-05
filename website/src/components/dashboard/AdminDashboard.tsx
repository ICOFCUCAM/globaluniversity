'use client';

// ---------------------------------------------------------------------------
// The administrator's dashboard.
//
// It showed 2,847 students, 4,521 graduates and "+12%" enrolment growth. None
// of those were the university's figures — they were the sample data of the
// template this portal was built from, rendered identically to real data with
// nothing to distinguish them, on the live deployment.
//
// That is not a cosmetic problem. A dashboard is where an administrator gets
// the number they then quote in a meeting, a report, or to a ministry
// inspector. A figure with no provenance that looks exactly like a figure with
// provenance is worse than no dashboard at all.
//
// So every count here is a count. Each tile queries the table it names, with
// `head: true` so the database returns the count without the rows; when a table
// is empty the tile reads zero, because zero is the truth.
//
// The percentage-change badges are gone entirely. They were string literals —
// '+12%', '-5%' — and there is no historical series in the schema to compute a
// real one from. A trend arrow nobody calculated is a lie with a graphic on it.
// The two bar charts went the same way: `[45, 62, 78, …]` was a hardcoded array
// captioned "Monthly enrollment over the past year". Both return when
// enrolments carry dates worth aggregating.
// ---------------------------------------------------------------------------

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { UNIVERSITY, IMAGES } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { roleLabels } from '@/lib/roles';
import { statusMeta, toUniversal } from '@/lib/status';
import {
  Card, CardHeader, Figure, EmptyState, Skeleton, TableShell, THead, TBody, Th, Td,
} from '@/components/ui/portal';
import { BTN_PRIMARY, BTN_SECONDARY, FOCUS } from '@/lib/portalTheme';
import type { ViewType } from '@/lib/types';
import {
  Users, GraduationCap, BookOpen, Building2, ClipboardList,
  Wallet, Stamp, FileText, Award, Inbox, ArrowRight,
} from 'lucide-react';

interface Counts {
  students: number;
  applicants: number;
  awaitingRegistrar: number;
  awaitingFinance: number;
  lecturers: number;
  courses: number;
  departments: number;
  pendingResults: number;
}

const ZERO: Counts = {
  students: 0, applicants: 0, awaitingRegistrar: 0, awaitingFinance: 0,
  lecturers: 0, courses: 0, departments: 0, pendingResults: 0,
};

export default function AdminDashboard({ onNavigate }: { onNavigate?: (v: ViewType) => void } = {}) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Counts>(ZERO);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reachable, setReachable] = useState(true);

  useEffect(() => {
    let live = true;
    (async () => {
      // `head: true` asks for the count without transferring any rows — the
      // difference between a dashboard that loads at once and one that pulls
      // the entire student body across the wire to display its size.
      const count = (table: string, build?: (q: any) => any) => {
        const base = supabase.from(table).select('id', { count: 'exact', head: true });
        return build ? build(base) : base;
      };

      const [
        students, applicants, awaitingRegistrar, awaitingFinance,
        lecturers, courses, departments, pendingResults, recentRows,
      ] = await Promise.all([
        count('students', (q: any) => q.in('status', ['approved', 'conditional', 'enrolled', 'active'])),
        count('students', (q: any) => q.eq('status', 'applicant')),
        count('students', (q: any) => q.in('status', ['fee_paid', 'documents_required'])),
        count('students', (q: any) => q.eq('status', 'applicant').eq('payment_status', 'pending')),
        count('lecturers'),
        count('courses'),
        count('departments'),
        count('results', (q: any) => q.eq('status', 'draft')),
        supabase
          .from('students')
          .select('id, first_name, last_name, program, status, created_at')
          .order('created_at', { ascending: false })
          .limit(6),
      ]);

      if (!live) return;

      // Every count failing at once means the database is unreachable, not that
      // the university has no students. Saying so is the difference between a
      // dashboard that is wrong and one that is honest about not knowing.
      setReachable(![students, lecturers, courses, departments].every((r: any) => r.error));

      setCounts({
        students: students.count ?? 0,
        applicants: applicants.count ?? 0,
        awaitingRegistrar: awaitingRegistrar.count ?? 0,
        awaitingFinance: awaitingFinance.count ?? 0,
        lecturers: lecturers.count ?? 0,
        courses: courses.count ?? 0,
        departments: departments.count ?? 0,
        pendingResults: pendingResults.count ?? 0,
      });
      setRecent(recentRows.data ?? []);
      setLoading(false);
    })();
    return () => { live = false; };
  }, []);

  const go = (v: ViewType) => () => onNavigate?.(v);

  const tiles: Array<{ label: string; value: number; icon: React.ReactNode; hint: string; view?: ViewType }> = [
    { label: 'Enrolled students', value: counts.students, icon: <Users size={16} />, hint: 'Admitted, conditional or active', view: 'students' },
    { label: 'Open applications', value: counts.applicants, icon: <Inbox size={16} />, hint: 'Submitted, not yet decided', view: 'admissions-registrar' },
    { label: 'Awaiting the Registrar', value: counts.awaitingRegistrar, icon: <Stamp size={16} />, hint: 'Fee verified, decision due', view: 'admissions-registrar' },
    { label: 'Awaiting Finance', value: counts.awaitingFinance, icon: <Wallet size={16} />, hint: 'Payment not yet registered', view: 'admissions-finance' },
    { label: 'Lecturers', value: counts.lecturers, icon: <GraduationCap size={16} />, hint: 'On the teaching register', view: 'lecturers' },
    { label: 'Courses', value: counts.courses, icon: <BookOpen size={16} />, hint: 'In the catalogue', view: 'courses' },
    { label: 'Departments', value: counts.departments, icon: <Building2 size={16} />, hint: 'Across all faculties' },
    { label: 'Results in draft', value: counts.pendingResults, icon: <ClipboardList size={16} />, hint: 'Entered, not yet approved', view: 'results' },
  ];

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-[#33234a] p-6 text-white">
        <div className="relative z-10 max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#e9c14a]">
            {roleLabels[user?.role ?? 'admin'] ?? 'Administrator'}
          </p>
          <h1 className="mt-1.5 font-heading text-2xl font-bold">
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="mt-1 text-sm text-white/65">
            {UNIVERSITY.name} ·{' '}
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          {(counts.awaitingRegistrar > 0 || counts.awaitingFinance > 0) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {counts.awaitingFinance > 0 && (
                <button onClick={go('admissions-finance')} className={`${BTN_PRIMARY} bg-[#e9c14a] text-[#241a30] hover:bg-[#f3d27a]`}>
                  <Wallet size={15} /> {counts.awaitingFinance} awaiting Finance
                </button>
              )}
              {counts.awaitingRegistrar > 0 && (
                <button onClick={go('admissions-registrar')} className={`${BTN_SECONDARY} border-white/25 bg-white/10 text-white hover:bg-white/20`}>
                  <Stamp size={15} /> {counts.awaitingRegistrar} awaiting the Registrar
                </button>
              )}
            </div>
          )}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={IMAGES.hero} alt="" className="absolute right-0 top-0 h-full w-1/3 object-cover opacity-15" />
        <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-transparent to-[#33234a]" />
      </div>

      {!reachable && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>The database could not be reached.</strong> The figures below read zero because
          nothing could be counted — not because the university has no records.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 8 }, (_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-3 h-7 w-16" />
                <Skeleton className="mt-2 h-3 w-32" />
              </Card>
            ))
          : tiles.map((t) => {
              const tile = (
                <Figure
                  label={t.label}
                  value={t.value.toLocaleString()}
                  hint={t.hint}
                  icon={t.icon}
                  tone={t.value === 0 ? 'muted' : 'neutral'}
                />
              );
              return t.view && onNavigate ? (
                <button key={t.label} onClick={go(t.view)} className={`rounded-xl text-left ${FOCUS}`}>
                  {tile}
                </button>
              ) : (
                <div key={t.label}>{tile}</div>
              );
            })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Latest applications"
            subtitle="The six most recently submitted"
            action={
              onNavigate ? (
                <button onClick={go('admissions-registrar')} className="inline-flex items-center gap-1 text-xs font-medium text-[#422e59] hover:underline">
                  Admissions desk <ArrowRight size={12} />
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
              icon={<Inbox size={20} />}
              title="No applications yet"
              description="Applications submitted through the public form appear here the moment they arrive."
            />
          ) : (
            <TableShell>
              <THead>
                <tr>
                  <Th>Applicant</Th>
                  <Th>Programme</Th>
                  <Th>Status</Th>
                  <Th align="right">Received</Th>
                </tr>
              </THead>
              <TBody>
                {recent.map((r) => {
                  const meta = statusMeta(toUniversal(r.status));
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-[#faf8f4]">
                      <Td className="font-medium text-[#33234a]">
                        {[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}
                      </Td>
                      <Td className="text-[#6b6076]">{r.program ?? '—'}</Td>
                      <Td>
                        {/* Label and colour together. Several of these greys and
                            dark reds are not separable by colour alone for a
                            large minority of readers — see status.ts. */}
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

        {/* Every one of these navigates. The set they replace were six coloured
            buttons with no handlers at all. */}
        <Card>
          <CardHeader title="Go to" subtitle="The desks you use most" />
          <div className="grid grid-cols-1 gap-1.5 p-4">
            {([
              { label: 'Admissions — Finance', icon: <Wallet size={15} />, view: 'admissions-finance' as ViewType },
              { label: 'Admissions — Registrar', icon: <Stamp size={15} />, view: 'admissions-registrar' as ViewType },
              { label: 'Students', icon: <Users size={15} />, view: 'students' as ViewType },
              { label: 'Courses', icon: <BookOpen size={15} />, view: 'courses' as ViewType },
              { label: 'Results', icon: <ClipboardList size={15} />, view: 'results' as ViewType },
              { label: 'Transcripts', icon: <FileText size={15} />, view: 'transcript' as ViewType },
              { label: 'Certificates', icon: <Award size={15} />, view: 'certificate' as ViewType },
            ]).map((a) => (
              <button
                key={a.label}
                onClick={go(a.view)}
                disabled={!onNavigate}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#33234a] transition-colors hover:bg-[#faf6ee] disabled:opacity-40 ${FOCUS}`}
              >
                <span className="text-[#c5a55a]">{a.icon}</span>
                <span className="flex-1 text-left">{a.label}</span>
                <ArrowRight size={13} className="text-[#c9c1d2]" />
              </button>
            ))}
          </div>
        </Card>
      </div>

      <p className="text-xs text-[#a49bb0]">
        Every figure on this screen is counted from the database when the page loads. There are no
        illustrative numbers here.
      </p>
    </div>
  );
}
