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
  Settings, Shield, BookMarked, Wallet, Stamp, UserCog, Inbox,
  ClipboardCheck, Share2, BadgeCheck, Video, Eye, CalendarClock, TrendingUp,
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
      { id: 'exams', label: 'Question papers', icon: <PenTool size={18} />, roles: ALL },
      // THE LIVE EXAMINATION SYSTEM. Three screens because they are three
      // different jobs, and each role sees only the one that is theirs — a
      // candidate must never see the console, and an invigilator has no
      // business setting a paper.
      {
        id: 'sit-examination',
        label: 'Sit an examination',
        icon: <Video size={18} />,
        roles: ['student'],
      },
      {
        id: 'examiner-console',
        label: 'Examiner console',
        icon: <Eye size={18} />,
        roles: ['superadmin', 'admin', 'exam-officer', 'examiner', 'invigilator', 'moderator'],
      },
      {
        id: 'examination-office',
        label: 'Examination office',
        icon: <CalendarClock size={18} />,
        roles: ['superadmin', 'admin', 'exam-officer', 'moderator', 'registrar'],
      },
      { id: 'questionbank', label: 'Question bank', icon: <PenTool size={18} />, roles: ['superadmin', 'admin', 'lecturer'] },
      { id: 'gradebook', label: 'Grade book', icon: <ClipboardList size={18} />, roles: ['superadmin', 'admin', 'lecturer'] },
    ],
  },
  {
    title: 'Records',
    items: [
      { id: 'results', label: 'Results', icon: <ClipboardList size={18} />, roles: ALL },
      // The four offices of the grade approval chain, and the two system roles.
      // A student is absent: this board shows internal deliberation — which
      // class was sent back and why — and that is not published to the class.
      {
        id: 'result-approval',
        label: 'Result approval',
        icon: <ClipboardCheck size={18} />,
        roles: ['superadmin', 'admin', 'registrar', 'academic-office', 'dean', 'hod', 'lecturer'],
      },
      { id: 'transcript', label: 'Transcript', icon: <FileText size={18} />, roles: ['superadmin', 'admin', 'student'] },
      // ISSUING MOVED TO CREDENTIALS → ISSUE. A student keeps this entry —
      // theirs is a view of their own certificate, not the screen that mints
      // one — and the staff who issue now find it beside the design, the
      // register and the specimen book rather than three groups away from all
      // of them.
      { id: 'certificate', label: 'Certificate', icon: <Award size={18} />, roles: ['student'] },
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
      // The University talking about itself. An administrator's job, so it sits
      // with the other outward-facing screens rather than under System — the
      // Superadministrator connects the accounts, but they do not write the
      // announcements.
      {
        id: 'social',
        label: 'Social command centre',
        icon: <Share2 size={18} />,
        roles: ['superadmin', 'admin'],
      },
    ],
  },
  {
    title: 'Insight',
    items: [
      // TWO ANALYTICS SCREENS THAT ARE NOT THE SAME SCREEN.
      //
      // They were labelled 'Analytics' and 'Learning analytics' and carried the
      // IDENTICAL bar-chart icon, adjacent to each other, so the two rows were
      // indistinguishable at a glance and neither name said what it answered.
      //
      // They answer genuinely different questions and neither could be dropped:
      // one counts the institution, the other flags individual students at
      // risk. So the fix is names that say which, and icons that differ.
      { id: 'analytics', label: 'Institutional analytics', icon: <BarChart3 size={18} />, roles: ['superadmin', 'admin', 'chancellor', 'vice-chancellor', 'registrar', 'finance-director', 'dean'] },
      { id: 'insights', label: 'Student early warning', icon: <TrendingUp size={18} />, roles: ['superadmin', 'admin', 'lecturer'] },
      // 'System' because it is not the only audit surface: credential actions
      // are recorded in their own immutable trail, under Credentials. Naming
      // the scope is what stops "who revoked this" having two answers and no
      // way to choose between them. Each screen points at the other.
      { id: 'audit', label: 'System audit log', icon: <Shield size={18} />, roles: ['superadmin', 'admin'] },
    ],
  },
  {
    // System custody. 'admin' is deliberately absent from both, and that
    // absence is the control — see src/lib/roles.ts.
    title: 'System',
    items: [
      { id: 'accounts', label: 'Accounts', icon: <UserCog size={18} />, roles: ['superadmin'] },
      // ONE ENTRY, FOUR AREAS — design, approval, the register, the specimen
      // book. This was three entries: 'Credential studio', 'Credential
      // approvals' and 'Credential authority'. The first two were the SAME
      // component under two labels, so the search box found two results that
      // opened one screen, and "where do I correct a graduate's name" had no
      // answer anybody could work out from the menu.
      //
      // Consolidating the menu did not consolidate the authority. The
      // workspace draws only the areas a role may use, and every component
      // beneath it still refuses from the inside.
      {
        id: 'credentials',
        label: 'Credentials',
        icon: <BadgeCheck size={18} />,
        roles: ['superadmin', 'vice-chancellor', 'registrar', 'academic-office'],
      },
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
