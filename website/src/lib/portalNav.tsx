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
  UserCheck,
  LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardList,
  FileText, Award, Monitor, PenTool, FolderOpen, BarChart3,
  Settings, Shield, BookMarked, Wallet, Stamp, UserCog, Inbox,
  ClipboardCheck, Share2, BadgeCheck, Video, Eye, CalendarClock, TrendingUp,
  CalendarDays, MapPin, Building2,
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
      // ---------------------------------------------------------------------
      // THE DESK THAT WAS MISSING.
      //
      // 'academic-office' held 'admit-student' and its signature is printed on
      // page 1 of every admission letter, and this file put it on none of the
      // three admissions screens — so the office that signs the offer had no
      // way to make it. The capability was granted and the door was not built.
      //
      // It is a desk of its own rather than a seat at the Admissions Office's,
      // because the two do different work: that office verifies documents and
      // eligibility, this one takes the academic decision. Sharing one screen
      // would put the verification controls in front of the deciding office
      // and the decision in front of the verifying one, which is the
      // separation the whole pipeline exists to keep.
      // ---------------------------------------------------------------------
      {
        id: 'academic-admissions',
        label: 'Admissions approval',
        icon: <GraduationCap size={18} />,
        roles: ['superadmin', 'academic-office'],
      },
      // ---------------------------------------------------------------------
      // THE FIFTH STAGE, which had no screen. `enrolled` has been in the
      // vocabulary since 024 and nothing could produce it, so the University
      // could say it had admitted somebody and not whether they turned up.
      // ---------------------------------------------------------------------
      {
        id: 'enrolment',
        label: 'Enrolment',
        icon: <UserCheck size={18} />,
        roles: ['superadmin', 'admin', 'registrar'],
      },
      { id: 'students', label: 'Students', icon: <Users size={18} />, roles: ['superadmin', 'admin', 'registrar', 'admissions-officer', 'finance', 'finance-director', 'dean'] },
    ],
  },
  {
    title: 'Academic',
    items: [
      // ---------------------------------------------------------------
      // THE STRUCTURE FIRST, THEN THE UTILITIES.
      //
      // The University's objection to this section was that it was "organized
      // around isolated utilities — Courses, Course Registration, Timetable,
      // LMS — rather than around the University's actual academic structure."
      //
      // These two are that structure. Programmes is the register of what the
      // University offers; the Curriculum Builder is what fills one. They are
      // first in the group because everything below them hangs off them: a
      // course is taught as part of a programme, a registration is against a
      // curriculum, a timetable schedules a cohort reading one.
      // ---------------------------------------------------------------
      //
      // THE CONTROL CENTRE FIRST. The University asked for "an Academic
      // Overview that acts as a control centre" — and a control centre below
      // the things it controls is a report nobody opens.
      {
        id: 'academic-overview',
        label: 'Academic overview',
        icon: <LayoutDashboard size={18} />,
        roles: ['superadmin', 'admin', 'chancellor', 'vice-chancellor', 'registrar',
          'dean', 'hod', 'programme-coordinator', 'academic-office'],
      },
      // THE TREE, TOP DOWN. Schools and departments come before programmes
      // because a programme belongs to a department and a department to a
      // school — and a navigation that lists the leaves above the branches is
      // the same fault the University raised about this section.
      {
        id: 'academic-structure',
        label: 'Schools & departments',
        icon: <Building2 size={18} />,
        roles: ['superadmin', 'admin', 'chancellor', 'vice-chancellor', 'registrar',
          'dean', 'hod', 'programme-coordinator', 'academic-office'],
      },
      {
        id: 'programmes-register',
        label: 'Programmes',
        icon: <GraduationCap size={18} />,
        roles: ['superadmin', 'admin', 'chancellor', 'vice-chancellor', 'registrar',
          'dean', 'hod', 'programme-coordinator', 'academic-office'],
      },
      {
        id: 'curriculum-builder',
        label: 'Curriculum builder',
        icon: <BookMarked size={18} />,
        roles: ['superadmin', 'admin', 'registrar', 'dean', 'hod',
          'programme-coordinator', 'academic-office'],
      },
      { id: 'programme-resources', label: 'Programme resources', icon: <BookMarked size={18} />, roles: ACADEMIC },
      { id: 'courses', label: 'Courses', icon: <BookOpen size={18} />, roles: ACADEMIC },
      // COURSES IS THE CATALOGUE. THIS IS THE TERM.
      //
      // Two entries because they are two things, which is the distinction the
      // University drew: "separate Course from Course Offering from Class from
      // Student Registration." What BIS 220 is does not change between years;
      // who teaches it, when it meets and how many places it has change every
      // year, and none of them could be recorded at all before 063.
      {
        id: 'course-offerings',
        label: 'Course offerings',
        icon: <CalendarClock size={18} />,
        roles: ['superadmin', 'admin', 'registrar', 'dean', 'hod',
          'programme-coordinator', 'academic-office'],
      },
      // AND THE ROOMS THOSE CLASSES MEET IN. Below offerings because that is
      // the order the work happens in — a room is looked up while scheduling a
      // class, not visited for its own sake. 064 seeds seventeen of them and
      // marks every one a placeholder until somebody edits it.
      {
        id: 'rooms',
        label: 'Rooms',
        icon: <MapPin size={18} />,
        roles: ['superadmin', 'admin', 'registrar', 'dean', 'hod',
          'programme-coordinator', 'academic-office'],
      },
      // REGISTRATION IS NOT COURSE MANAGEMENT. 'Courses' is the catalogue —
      // what the University teaches. This is who is taking what, which is the
      // act that fills `enrollments` and therefore the mark sheet, the
      // transcript and the graduation audit.
      //
      // THE STUDENT SEES IT TOO, and that is the normal case: a student
      // registers themselves, and the Registry registers on their behalf. The
      // route decides whose record may be touched; this only decides who is
      // offered the screen.
      // THE CALENDAR EVERYTHING ELSE IS DATED AGAINST. Above registration
      // because a registration cannot be filed without a term, and the term
      // comes from here.
      {
        id: 'academic-calendar',
        label: 'Academic calendar',
        icon: <CalendarDays size={18} />,
        roles: ['superadmin', 'admin', 'registrar', 'chancellor', 'vice-chancellor',
          'dean', 'hod', 'programme-coordinator', 'academic-office'],
      },
      {
        id: 'course-registration',
        label: 'Course registration',
        icon: <ClipboardList size={18} />,
        roles: ['student', 'superadmin', 'admin', 'registrar', 'hod', 'programme-coordinator'],
      },
      // THE TIMETABLE IS NOW THE CLASSES THAT EXIST, not a list of slots typed
      // in beside them. Attendance keeps its own entry: it was only ever part
      // of this screen because this screen invented the slots it marked
      // against, and those slots matched no course, no lecturer and no room.
      // ONE STUDENT, ONE RECORD. Below registration because it is the thing
      // registration and results ADD UP TO — and the student sees their own.
      {
        id: 'academic-records',
        label: 'Academic records',
        icon: <ClipboardCheck size={18} />,
        roles: ['superadmin', 'admin', 'registrar', 'chancellor', 'vice-chancellor',
          'dean', 'hod', 'programme-coordinator', 'academic-office', 'student'],
      },
      // THE END OF THE CHAIN, below the record it is the conclusion of.
      {
        id: 'graduation',
        label: 'Graduation & awards',
        icon: <Award size={18} />,
        roles: ['superadmin', 'admin', 'registrar', 'chancellor', 'vice-chancellor',
          'dean', 'academic-office'],
      },
      { id: 'timetable', label: 'Timetable', icon: <CalendarDays size={18} />, roles: ACADEMIC },
      {
        id: 'attendance',
        label: 'Attendance',
        icon: <UserCheck size={18} />,
        roles: ['superadmin', 'admin', 'lecturer', 'registrar', 'academic-office'],
      },
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
      // SAME TREATMENT AS THE CERTIFICATE BELOW, which it should have had in
      // the same commit. Issuing a transcript moved to Credentials → Issue;
      // leaving staff on this entry meant they reached the identical component
      // from two places — the precise fault that made three credential menu
      // entries worth consolidating. A student keeps it: theirs is a view of
      // their own record, not the screen that seals one.
      { id: 'transcript', label: 'Transcript', icon: <FileText size={18} />, roles: ['student'] },
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
  // ---------------------------------------------------------------------
  // THE GROUP THAT DID NOT EXIST, AND EVERYTHING IN IT WAS ALREADY BUILT.
  //
  // The Vice-Chancellor signed in and had no Appointments, no Correspondence
  // and no Document Templates in the sidebar. Every one of those screens
  // existed, every route behind them was guarded, and seven migrations had
  // been run for them — and none of it was reachable, because nobody had put
  // a door in.
  //
  // That is the same fault this file already records against the Academic
  // Affairs desk: "the capability was granted and the door was not built."
  // It happened again, at a larger scale, and it is the reason to look at
  // the sidebar rather than at the test suite when asking whether something
  // is finished.
  // ---------------------------------------------------------------------
  {
    title: 'Appointments & Correspondence',
    items: [
      // THE VICE-CHANCELLOR'S OWN SCREEN. Where every appointment in the
      // University stands — nine counters, each one clickable.
      {
        id: 'appointments',
        label: 'Appointments',
        icon: <BarChart3 size={18} />,
        roles: ['superadmin', 'admin', 'chancellor', 'vice-chancellor', 'registrar',
          'hr-officer', 'hr-administrator'],
      },
      // THE BOARD AND THE FORM. HR prepares here; the VC approves and issues.
      // Separate from the dashboard because they are different work: one is
      // "where does everything stand", the other is "draft this appointment".
      {
        id: 'appointments-board',
        label: 'Draft & submit',
        icon: <ClipboardList size={18} />,
        roles: ['superadmin', 'admin', 'registrar', 'hr-officer', 'hr-administrator',
          'vice-chancellor'],
      },
      // THE LETTERS AN OFFICE STARTS AND FINISHES ITSELF. The VC, the
      // Chancellor and the Registrar compose; HR administration may be asked
      // to prepare one and appears here for that reason alone.
      {
        id: 'correspondence',
        label: 'Correspondence',
        icon: <Stamp size={18} />,
        roles: ['superadmin', 'admin', 'chancellor', 'vice-chancellor', 'registrar',
          'hr-administrator'],
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
      // THE WORDING OF EVERY DOCUMENT THE UNIVERSITY ISSUES. Under System with
      // the credential designs rather than under Appointments, because it is
      // the same act as approving a certificate design and holds the same
      // capability — and because the templates cover correspondence and the
      // appointment package alike, so filing it under either would hide it
      // from the other.
      {
        id: 'document-templates',
        label: 'Document templates',
        icon: <BookMarked size={18} />,
        roles: ['superadmin', 'admin', 'chancellor', 'vice-chancellor'],
      },
      // THE REGISTER OF POSTS AND WHAT EACH ONE IS FOR. 048 seeded eight family
      // drafts and there was no screen to read them on, so the University had
      // forty-six job descriptions it could not open.
      {
        id: 'job-descriptions',
        label: 'Job descriptions',
        icon: <UserCog size={18} />,
        roles: ['superadmin', 'admin', 'chancellor', 'vice-chancellor'],
      },
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
