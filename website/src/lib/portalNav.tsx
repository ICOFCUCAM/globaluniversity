// ---------------------------------------------------------------------------
// The portal's navigation, as data.
//
// Held apart from the sidebar because two things need it: the rail that draws
// it, and the search box that jumps to it. When the list lived inside the
// sidebar component, search could not see it — which is why the search box
// spent its life accepting text and doing nothing with it.
// ---------------------------------------------------------------------------

import React from 'react';
import type { ViewType, UserRole } from './types';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardList,
  FileText, Award, Monitor, PenTool, FolderOpen, BarChart3,
  Settings, Shield, BookMarked, Wallet, Stamp, UserCog, Palette, Inbox, ShieldCheck,
} from 'lucide-react';

export interface MenuItem {
  id: ViewType;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

export interface MenuGroup {
  /** Shown above the group. Null for the first group, which needs no label. */
  title: string | null;
  items: MenuItem[];
}

/**
 * Every role that signs in to this portal.
 *
 * This constant was named ALL and listed four roles: superadmin, admin,
 * student, lecturer. So a Finance Administrator signing in saw exactly one
 * menu item — the Finance desk — and no Dashboard, no Settings, no
 * announcements. They could not reach the screen that changes their own
 * password, on a system that emails them a temporary one and tells them to
 * change it immediately.
 *
 * The same was true of the Registrar, every Dean, every Head of Department and
 * the Chancellor. Four roles had a portal; the other eleven had a page.
 */
const EVERYONE: UserRole[] = [
  'superadmin', 'admin', 'chancellor', 'vice-chancellor', 'registrar',
  'finance-director', 'finance', 'admissions-officer', 'dean', 'hod',
  'programme-coordinator', 'academic-office', 'lecturer', 'library-staff',
  'student-affairs', 'student',
];

/** Everyone whose work is teaching, studying or running a programme. */
const ACADEMIC: UserRole[] = [
  'superadmin', 'admin', 'chancellor', 'vice-chancellor', 'registrar',
  'dean', 'hod', 'programme-coordinator', 'academic-office', 'lecturer', 'student',
];

/** Retained for the entries that genuinely are staff-and-students only. */
const ALL: UserRole[] = ['superadmin', 'admin', 'student', 'lecturer'];

export const menuGroups: MenuGroup[] = [
  {
    title: null,
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, roles: EVERYONE },
    ],
  },
  {
    title: 'Admissions',
    items: [
      { id: 'admissions-finance', label: 'Finance desk', icon: <Wallet size={18} />, roles: ['superadmin', 'admin', 'finance'] },
      { id: 'admissions-registrar', label: 'Registrar desk', icon: <Stamp size={18} />, roles: ['superadmin', 'admin', 'registrar'] },
      { id: 'admissions-office', label: 'Admissions Office', icon: <Inbox size={18} />, roles: ['superadmin', 'admin', 'admissions-officer'] },
      { id: 'students', label: 'Students', icon: <Users size={18} />, roles: ['superadmin', 'admin', 'registrar', 'admissions-officer', 'finance', 'finance-director', 'dean'] },
    ],
  },
  {
    title: 'Academic',
    items: [
      { id: 'programme-resources', label: 'Programme resources', icon: <BookMarked size={18} />, roles: ACADEMIC },
      { id: 'courses', label: 'Courses', icon: <BookOpen size={18} />, roles: ACADEMIC },
      { id: 'timetable', label: 'Timetable', icon: <ClipboardList size={18} />, roles: ACADEMIC },
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
      // The graduate's own wallet: what the university has issued them, and a
      // link they can send to an employer. Students only — staff read the
      // register through the Registrar's screens, not through a wallet.
      { id: 'my-credentials', label: 'My credentials', icon: <Award size={18} />, roles: ['student'] },
      { id: 'documents', label: 'Documents', icon: <FolderOpen size={18} />, roles: ['superadmin', 'admin', 'student'] },
      { id: 'fees', label: 'Fees & receipts', icon: <Wallet size={18} />, roles: ['superadmin', 'admin', 'finance', 'finance-director'] },
    ],
  },
  {
    title: 'Community',
    items: [
      { id: 'announcements', label: 'Announcements', icon: <ClipboardList size={18} />, roles: EVERYONE },
      { id: 'forum', label: 'Discussion forum', icon: <ClipboardList size={18} />, roles: EVERYONE },
    ],
  },
  {
    title: 'Insight',
    items: [
      { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={18} />, roles: ['superadmin', 'admin', 'chancellor', 'vice-chancellor', 'registrar', 'finance-director', 'dean'] },
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
      // The Superadministrator designs; the three approving offices sign. They
      // reach the same screen and see different halves of it — an approver gets
      // the queue and none of the design controls, because the whole point of
      // the chain is that designing and approving are different people.
      { id: 'studio', label: 'Credential studio', icon: <Palette size={18} />, roles: ['superadmin'] },
      { id: 'studio', label: 'Credential approvals', icon: <ShieldCheck size={18} />, roles: ['registrar', 'academic-office', 'vice-chancellor'] },
      { id: 'settings', label: 'Settings', icon: <Settings size={18} />, roles: EVERYONE },
    ],
  },
];


/** Every item the given role may reach, flattened — what search looks through. */
export function navItemsFor(role: UserRole | undefined | null): Array<MenuItem & { group: string }> {
  if (!role) return [];
  return menuGroups.flatMap((g) =>
    g.items.filter((i) => i.roles.includes(role)).map((i) => ({ ...i, group: g.title ?? 'General' })),
  );
}

/** The label for a view, for the breadcrumb. */
export function labelForView(view: ViewType): string {
  for (const g of menuGroups) {
    const hit = g.items.find((i) => i.id === view);
    if (hit) return hit.label;
  }
  return 'Dashboard';
}

/** The group a view sits in, for the breadcrumb. */
export function groupForView(view: ViewType): string | null {
  for (const g of menuGroups) {
    if (g.items.some((i) => i.id === view)) return g.title;
  }
  return null;
}
