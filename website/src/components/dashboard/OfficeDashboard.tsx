'use client';

// ---------------------------------------------------------------------------
// The remaining offices: executive, faculty, admissions support, and services.
//
// Each was being shown the administrator's dashboard, which meant a Dean saw
// Finance's payment queue and the Chancellor was offered a button to open the
// Registrar's desk — an action the Chancellor is deliberately forbidden to take
// (roles.ts withholds 'admit-student' from both executive offices, because an
// institution where the Vice Chancellor can personally admit a student has no
// separation of duties left, whatever its org chart says).
//
// Rather than four near-identical files, this is one screen configured per
// office. What differs between them is genuinely only three things: which
// figures matter, which screens they jump to, and the sentence describing what
// the office may not do. Everything else was the same, and four copies of the
// same thing drift apart within a month.
//
// WHAT NONE OF THEM SHOW: another office's queue. The executive offices see
// totals, because oversight is their work; they do not see the pending list,
// because acting on it is not.
// ---------------------------------------------------------------------------

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { UNIVERSITY } from '@/lib/constants';
import { roleLabels } from '@/lib/roles';
import { Card, Figure, Skeleton } from '@/components/ui/portal';
import { BTN_SECONDARY, FOCUS } from '@/lib/portalTheme';
import type { ViewType, UserRole } from '@/lib/types';
import {
  Users, GraduationCap, BookOpen, Building2, ClipboardList,
  ArrowRight, BarChart3, BookMarked, FolderOpen, Inbox,
} from 'lucide-react';

type MetricKey =
  | 'enrolled' | 'admitted' | 'lecturers' | 'courses'
  | 'departments' | 'resultsDraft' | 'openApplications';

interface OfficeConfig {
  metrics: { key: MetricKey; label: string; hint: string; icon: React.ReactNode }[];
  links: { label: string; view: ViewType; icon: React.ReactNode }[];
  /** What this office may not do. Stated, not left as an absence. */
  boundary: string;
}

const EXECUTIVE: OfficeConfig = {
  metrics: [
    { key: 'enrolled', label: 'Enrolled students', hint: 'Admitted, conditional or active', icon: <Users size={16} /> },
    { key: 'admitted', label: 'Admitted this cycle', hint: 'Offers made', icon: <GraduationCap size={16} /> },
    { key: 'lecturers', label: 'Lecturers', hint: 'On the teaching register', icon: <GraduationCap size={16} /> },
    { key: 'courses', label: 'Courses', hint: 'In the catalogue', icon: <BookOpen size={16} /> },
  ],
  links: [
    { label: 'Analytics', view: 'analytics', icon: <BarChart3 size={15} /> },
    { label: 'Students', view: 'students', icon: <Users size={15} /> },
    { label: 'Announcements', view: 'announcements', icon: <ClipboardList size={15} /> },
  ],
  boundary:
    'This office oversees; it does not admit or verify payment. Neither capability is held by the Chancellor or the Vice Chancellor — an institution where either can personally admit a student has no separation of duties left to speak of.',
};

const FACULTY: OfficeConfig = {
  metrics: [
    { key: 'enrolled', label: 'Enrolled students', hint: 'Across the university', icon: <Users size={16} /> },
    { key: 'courses', label: 'Courses', hint: 'In the catalogue', icon: <BookOpen size={16} /> },
    { key: 'lecturers', label: 'Lecturers', hint: 'On the teaching register', icon: <GraduationCap size={16} /> },
    { key: 'resultsDraft', label: 'Results in draft', hint: 'Entered, not yet approved', icon: <ClipboardList size={16} /> },
  ],
  links: [
    { label: 'Courses', view: 'courses', icon: <BookOpen size={15} /> },
    { label: 'Results', view: 'results', icon: <ClipboardList size={15} /> },
    { label: 'Programme resources', view: 'programme-resources', icon: <BookMarked size={15} /> },
    { label: 'Timetable', view: 'timetable', icon: <ClipboardList size={15} /> },
  ],
  boundary:
    'This office monitors teaching and progress. Admission decisions belong to the Registrar and payment verification to Finance; neither capability is held here.',
};

const ADMISSIONS_SUPPORT: OfficeConfig = {
  metrics: [
    { key: 'openApplications', label: 'Open applications', hint: 'Submitted, not yet decided', icon: <Inbox size={16} /> },
    { key: 'enrolled', label: 'Enrolled students', hint: 'Admitted, conditional or active', icon: <Users size={16} /> },
  ],
  links: [
    { label: 'Students', view: 'students', icon: <Users size={15} /> },
    { label: 'Documents', view: 'documents', icon: <FolderOpen size={15} /> },
  ],
  boundary:
    'This office prepares applications and chases documents. It cannot decide one — that is the Registrar’s — and it cannot register a payment.',
};

const SERVICES: OfficeConfig = {
  metrics: [
    { key: 'enrolled', label: 'Enrolled students', hint: 'Admitted, conditional or active', icon: <Users size={16} /> },
    { key: 'departments', label: 'Departments', hint: 'Across all faculties', icon: <Building2 size={16} /> },
  ],
  links: [
    { label: 'Announcements', view: 'announcements', icon: <ClipboardList size={15} /> },
    { label: 'Discussion forum', view: 'forum', icon: <ClipboardList size={15} /> },
  ],
  boundary: 'This office supports students. It holds no admissions or finance capability.',
};

export function configFor(role: UserRole | undefined): OfficeConfig {
  switch (role) {
    case 'chancellor':
    case 'vice-chancellor':
      return EXECUTIVE;
    case 'dean':
    case 'hod':
    case 'programme-coordinator':
    case 'academic-office':
      return FACULTY;
    case 'admissions-officer':
      return ADMISSIONS_SUPPORT;
    default:
      return SERVICES;
  }
}

export default function OfficeDashboard({ onNavigate }: { onNavigate?: (v: ViewType) => void } = {}) {
  const { user } = useAuth();
  const config = configFor(user?.role);
  const [counts, setCounts] = useState<Record<MetricKey, number>>({
    enrolled: 0, admitted: 0, lecturers: 0, courses: 0,
    departments: 0, resultsDraft: 0, openApplications: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    (async () => {
      const head = (table: string, build?: (q: any) => any) => {
        const base = supabase.from(table).select('id', { count: 'exact', head: true });
        return build ? build(base) : base;
      };
      const [enrolled, admitted, lecturers, courses, departments, resultsDraft, open] = await Promise.all([
        head('students', (q) => q.in('status', ['approved', 'conditional', 'enrolled', 'active'])),
        head('students', (q) => q.eq('status', 'approved')),
        head('lecturers'),
        head('courses'),
        head('departments'),
        head('results', (q) => q.eq('status', 'draft')),
        head('students', (q) => q.eq('status', 'applicant')),
      ]);
      if (!live) return;
      setCounts({
        enrolled: enrolled.count ?? 0,
        admitted: admitted.count ?? 0,
        lecturers: lecturers.count ?? 0,
        courses: courses.count ?? 0,
        departments: departments.count ?? 0,
        resultsDraft: resultsDraft.count ?? 0,
        openApplications: open.count ?? 0,
      });
      setLoading(false);
    })();
    return () => { live = false; };
  }, []);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-[#33234a] p-6 text-white">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#e9c14a]">
          {roleLabels[user?.role ?? 'student']}
        </p>
        <h1 className="mt-1.5 font-heading text-2xl font-bold">
          Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
        <p className="mt-1 text-sm text-white/65">
          {UNIVERSITY.name} ·{' '}
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading
          ? Array.from({ length: config.metrics.length }, (_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-3 h-7 w-16" />
              </Card>
            ))
          : config.metrics.map((m) => (
              <Figure
                key={m.key}
                label={m.label}
                value={counts[m.key].toLocaleString()}
                hint={m.hint}
                icon={m.icon}
                tone={counts[m.key] === 0 ? 'muted' : 'neutral'}
              />
            ))}
      </div>

      <Card>
        <div className="border-b border-[#f0ece4] px-5 py-4 dark:border-[#2a2333]">
          <h2 className="font-heading text-sm font-bold text-[#422e59] dark:text-[#e4dcf0]">Go to</h2>
          <p className="mt-0.5 text-xs text-[#8a8194]">The screens this office uses</p>
        </div>
        <div className="grid grid-cols-1 gap-1.5 p-4 sm:grid-cols-2">
          {config.links.map((l) => (
            <button
              key={l.label}
              onClick={() => onNavigate?.(l.view)}
              disabled={!onNavigate}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[#33234a] transition-colors hover:bg-[#faf6ee] disabled:opacity-40 dark:text-[#e4dcf0] dark:hover:bg-[#241f2c] ${FOCUS}`}
            >
              <span className="text-[#c5a55a]">{l.icon}</span>
              <span className="flex-1 text-left">{l.label}</span>
              <ArrowRight size={13} className="text-[#c9c1d2]" />
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">{config.boundary}</p>
      </Card>
    </div>
  );
}
