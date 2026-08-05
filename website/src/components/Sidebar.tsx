'use client';

// ---------------------------------------------------------------------------
// Portal navigation.
//
// This was one flat list of up to twenty-five items in the order they happened
// to be written, so finding "Grade Book" meant reading the whole thing. Long
// lists are not navigated, they are scanned — and scanning needs groups.
//
// The groups are the university's own divisions of work rather than the
// software's: Admissions, Academic, Teaching, Records, Administration. A
// registrar looking for the admissions queue looks under Admissions, not under
// whichever screen was built first.
//
// Two details that were bugs rather than taste. The rail is a flex column with
// only the nav scrolling, so the sign-out control cannot be pushed off the
// bottom of the screen — it was, at every viewport under about 900px. And each
// group heading is a real <h2> inside a <nav>, so a screen-reader user can jump
// between sections instead of hearing twenty-five buttons in a row.
// ---------------------------------------------------------------------------

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { IMAGES, UNIVERSITY } from '@/lib/constants';
import type { ViewType, UserRole } from '@/lib/types';
import { roleLabels, SYSTEM_ROLES } from '@/lib/roles';
import { FOCUS } from '@/lib/portalTheme';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardList,
  FileText, Award, Monitor, PenTool, FolderOpen, BarChart3,
  Settings, Shield, LogOut, ChevronLeft, ChevronRight, BookMarked, Wallet, Stamp,
  UserCog, Palette,
} from 'lucide-react';

interface MenuItem {
  id: ViewType;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

interface MenuGroup {
  /** Shown above the group. Null for the first group, which needs no label. */
  title: string | null;
  items: MenuItem[];
}

const ALL: UserRole[] = ['superadmin', 'admin', 'student', 'lecturer'];

const menuGroups: MenuGroup[] = [
  {
    title: null,
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, roles: ALL },
    ],
  },
  {
    title: 'Admissions',
    items: [
      { id: 'admissions-finance', label: 'Finance desk', icon: <Wallet size={18} />, roles: ['superadmin', 'admin', 'finance'] },
      { id: 'admissions-registrar', label: 'Registrar desk', icon: <Stamp size={18} />, roles: ['superadmin', 'admin', 'registrar'] },
      { id: 'students', label: 'Students', icon: <Users size={18} />, roles: ['superadmin', 'admin', 'registrar'] },
    ],
  },
  {
    title: 'Academic',
    items: [
      { id: 'programme-resources', label: 'Programme resources', icon: <BookMarked size={18} />, roles: ALL },
      { id: 'courses', label: 'Courses', icon: <BookOpen size={18} />, roles: ALL },
      { id: 'timetable', label: 'Timetable', icon: <ClipboardList size={18} />, roles: ALL },
      { id: 'lms', label: 'Learning (LMS)', icon: <Monitor size={18} />, roles: ALL },
    ],
  },
  {
    title: 'Teaching',
    items: [
      { id: 'lecturers', label: 'Lecturers', icon: <GraduationCap size={18} />, roles: ['superadmin', 'admin'] },
      { id: 'assignments', label: 'Assignments', icon: <ClipboardList size={18} />, roles: ALL },
      { id: 'exams', label: 'Examinations', icon: <PenTool size={18} />, roles: ALL },
      { id: 'questionbank', label: 'Question bank', icon: <PenTool size={18} />, roles: ['superadmin', 'admin', 'lecturer'] },
      { id: 'gradebook', label: 'Grade book', icon: <ClipboardList size={18} />, roles: ['superadmin', 'admin', 'lecturer'] },
    ],
  },
  {
    title: 'Records',
    items: [
      { id: 'results', label: 'Results', icon: <ClipboardList size={18} />, roles: ALL },
      { id: 'transcript', label: 'Transcript', icon: <FileText size={18} />, roles: ['superadmin', 'admin', 'student'] },
      { id: 'certificate', label: 'Certificate', icon: <Award size={18} />, roles: ['superadmin', 'admin', 'student'] },
      { id: 'documents', label: 'Documents', icon: <FolderOpen size={18} />, roles: ['superadmin', 'admin', 'student'] },
      { id: 'fees', label: 'Fees & receipts', icon: <Wallet size={18} />, roles: ['superadmin', 'admin'] },
    ],
  },
  {
    title: 'Community',
    items: [
      { id: 'announcements', label: 'Announcements', icon: <ClipboardList size={18} />, roles: ALL },
      { id: 'forum', label: 'Discussion forum', icon: <ClipboardList size={18} />, roles: ALL },
    ],
  },
  {
    title: 'Insight',
    items: [
      { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={18} />, roles: ['superadmin', 'admin'] },
      { id: 'insights', label: 'Learning analytics', icon: <BarChart3 size={18} />, roles: ['superadmin', 'admin', 'lecturer'] },
      { id: 'audit', label: 'Audit log', icon: <Shield size={18} />, roles: ['superadmin', 'admin'] },
    ],
  },
  {
    // System custody. 'admin' is deliberately absent from both, and that
    // absence is the control — see src/lib/roles.ts.
    title: 'System',
    items: [
      { id: 'accounts', label: 'Accounts', icon: <UserCog size={18} />, roles: ['superadmin'] },
      { id: 'studio', label: 'Credential studio', icon: <Palette size={18} />, roles: ['superadmin'] },
      { id: 'settings', label: 'Settings', icon: <Settings size={18} />, roles: ALL },
    ],
  },
];

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ currentView, onViewChange, collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuth();

  const groups = menuGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => user && i.roles.includes(user.role)) }))
    .filter((g) => g.items.length > 0);

  const initials = (user?.name ?? '')
    .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-full flex-col bg-[#241a30] text-white transition-[width] duration-200 ${
        collapsed ? 'w-[68px]' : 'w-64'
      }`}
    >
      {/* Masthead */}
      <div className={`flex flex-shrink-0 items-center gap-3 border-b border-white/10 px-4 py-4 ${collapsed ? 'justify-center px-0' : ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={IMAGES.logo} alt="" className="h-9 w-9 flex-shrink-0 rounded-full object-cover ring-1 ring-[#c5a55a]/50" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate font-heading text-sm font-bold leading-tight">{UNIVERSITY.shortName}</p>
            <p className="truncate text-[10px] uppercase tracking-[0.12em] text-[#c5a55a]">Management System</p>
          </div>
        )}
      </div>

      {/* Who is signed in. The role label is the university's own wording —
          "Registrar Administrator", not the raw `registrar`. */}
      {user && (
        <div className={`flex flex-shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3 ${collapsed ? 'justify-center px-0' : ''}`}>
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#422e59] text-[11px] font-bold text-[#e9c14a] ring-1 ring-[#c5a55a]/40">
            {initials || '·'}
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-white/90">{user.name}</p>
              <p className="truncate text-[10px] text-white/45">
                {roleLabels[user.role] ?? user.role}
                {SYSTEM_ROLES.includes(user.role) && (
                  <span className="ml-1 text-[#c5a55a]">·&nbsp;system</span>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Only this scrolls, so the controls below cannot be pushed off-screen. */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {groups.map((group, gi) => (
          <div key={group.title ?? `g${gi}`} className={gi > 0 ? 'mt-4' : ''}>
            {group.title && !collapsed && (
              <h2 className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                {group.title}
              </h2>
            )}
            {group.title && collapsed && <div className="mx-3 mb-2 border-t border-white/10" />}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = currentView === item.id;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => onViewChange(item.id)}
                      aria-current={active ? 'page' : undefined}
                      title={collapsed ? item.label : undefined}
                      className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${FOCUS} ${
                        active
                          ? 'bg-white/10 font-semibold text-[#e9c14a]'
                          : 'text-white/65 hover:bg-white/[0.06] hover:text-white'
                      } ${collapsed ? 'justify-center px-0' : ''}`}
                    >
                      {/* A gold rule marks the current screen. Colour alone
                          would not: on a dark rail the active and inactive
                          weights are close, and the rule survives both
                          greyscale and a colour-blind reader. */}
                      {active && !collapsed && (
                        <span className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-[#e9c14a]" aria-hidden="true" />
                      )}
                      <span className="flex-shrink-0">{item.icon}</span>
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex-shrink-0 space-y-0.5 border-t border-white/10 px-2 py-2.5">
        <button
          onClick={logout}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:bg-red-500/15 hover:text-red-300 ${FOCUS} ${collapsed ? 'justify-center px-0' : ''}`}
        >
          <LogOut size={18} />
          {!collapsed && <span>Sign out</span>}
        </button>
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white ${FOCUS} ${collapsed ? 'justify-center px-0' : ''}`}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
