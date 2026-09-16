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
import { can, type Capability } from './roles';
import { grantDecides, scopeOf, type Resource, type Action } from './grants';
import { showsAtStage } from './studentJourney';
import {
  UserCheck,
  LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardList, IdCard,
  FileText, Award, Monitor, PenTool, FolderOpen, BarChart3,
  Settings, Shield, ShieldCheck, BookMarked, Wallet, Stamp, UserCog, Inbox,
  ClipboardCheck, Share2, BadgeCheck, Video, Eye, CalendarClock, TrendingUp,
  CalendarDays, MapPin, Building2, Receipt, ScrollText,
} from 'lucide-react';

export interface MenuItem {
  id: ViewType;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[];
  /**
   * A real URL, for the one entry that is not a module.
   *
   * Every other item in this file selects a module inside AppLayout's switch.
   * The Academic Studio is a tree of server-rendered routes with its own
   * layout and its own session, so it is navigated to rather than switched to.
   * When this is set the sidebar follows it and never calls `onViewChange`.
   */
  href?: string;
  /**
   * The capability this entry needs, where a role list is not the whole story.
   *
   * ---------------------------------------------------------------------
   * WHY THIS FIELD EXISTS
   * ---------------------------------------------------------------------
   *
   * The sidebar was gated by ROLE ONLY. A menu item had no capability at all,
   * so what somebody SAW and what somebody MAY DO were never connected, and it
   * leaked in both directions: a lecturer held `view-registered-students` with
   * no screen gated on it, and reached Course management — a write screen for
   * the University's catalogue — holding no `manage-courses`.
   *
   * The University then ruled in capability terms: "a lecturer should be able
   * to teach a course, but should not be able to define the University's
   * course catalogue." A role list cannot say that. This can.
   *
   * BOTH MUST PASS where both are given. The role list stays because it is what
   * decides the SHAPE of somebody's portal — a Finance Officer has no business
   * on a teaching screen whatever they hold — and the capability is what
   * decides whether the door opens.
   */
  capability?: Capability;
  /**
   * The resource this entry is about.
   *
   * ---------------------------------------------------------------------
   * "THEN THE SIDEBAR AUTOMATICALLY KNOWS WHETHER SOMETHING SHOULD BE
   * DISPLAYED."
   * ---------------------------------------------------------------------
   *
   * Where a role has been ruled on in resource/action/scope terms — see
   * `grants.ts` — this is the ONLY thing consulted. The role list and the
   * capability are skipped entirely, because the grant already says both: it
   * names the resource, what may be done to it, and how much of it.
   *
   * Where a role has not been ruled on yet, the role list and the capability
   * decide as before. That is what lets the University rule one office at a
   * time instead of all twenty-three at once.
   */
  resource?: Resource;
  /**
   * What this entry does to that resource.
   *
   * RESOURCE ALONE IS NOT ENOUGH, and the first version of this proved it: a
   * lecturer holds `courses/view:own-courses`, so an entry naming only the
   * resource let them straight back into the Course catalogue — the very
   * screen the University's ruling exists to keep them out of.
   *
   * The catalogue entry is `courses` + `manage`; "My courses" is `courses` +
   * `view`. Same resource, different act, and the ruling is about the act.
   */
  action?: Action;
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
  // ---------------------------------------------------------------------
  // AND IT HAPPENED AGAIN, TO SIX MORE ROLES.
  //
  // The paragraph above was written when this list held four roles. It then
  // held sixteen, and the six below were still missing — so the fault it
  // describes was live the whole time for the two HR offices and all four
  // examination offices.
  //
  // AN INVIGILATOR SIGNED IN AND SAW ONE MENU ITEM. Not one screen too few:
  // one item, "Examiner console", and nothing else. No Dashboard. No
  // Announcements. No Settings — on a system that emails them a temporary
  // password and tells them to change it immediately, they could not reach
  // the screen that changes it.
  //
  // Found by counting menu entries per role rather than by reading this file,
  // which is how it survived being written about directly above.
  //
  // 'applicant' IS STILL ABSENT, and that one is deliberate: AppLayout turns
  // an applicant away from this portal entirely and sends them to the
  // Admissions Portal, so giving them a menu would be giving them a door into
  // a building they are told not to enter.
  // ---------------------------------------------------------------------
  'hr-officer', 'hr-administrator',
  'exam-officer', 'examiner', 'invigilator', 'moderator',
];

/** Everyone whose work is teaching, studying or running a programme. */
const ACADEMIC: UserRole[] = [
  'superadmin', 'admin', 'chancellor', 'vice-chancellor', 'registrar',
  'dean', 'hod', 'programme-coordinator', 'academic-office', 'lecturer', 'student',
];

/**
 * Everybody the University employs.
 *
 * NOT `EVERYONE`, which includes applicants and students. This is the list for
 * the two entries a member of staff has about THEMSELVES — their own record and
 * their own roll — and a student on either would be a mistake of a different
 * kind.
 */
const STAFF: UserRole[] = [
  'superadmin', 'admin', 'chancellor', 'vice-chancellor', 'registrar',
  'finance-director', 'finance', 'admissions-officer', 'dean', 'hod',
  'programme-coordinator', 'academic-office', 'lecturer', 'library-staff',
  'student-affairs', 'hr-officer', 'hr-administrator', 'exam-officer',
  'examiner', 'invigilator', 'moderator',
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
      // THE CATALOGUE, AND IT IS NOT A LECTURER'S. The University: "a lecturer
      // teaching BLT 501 can manage their teaching content for BLT 501, but
      // should not be able to change BLT 501 → 5 credits → Core → Semester 1,
      // because that is curriculum governance." This screen creates and edits
      // courses, so it is gated on the capability that says so. A lecturer
      // gets `my-courses` below instead: the same entries, read-only, and only
      // the ones they teach.
      {
        id: 'courses',
        resource: 'courses',
        action: 'manage',
        label: 'Course catalogue',
        icon: <BookOpen size={18} />,
        roles: ACADEMIC,
        capability: 'manage-courses',
      },
      {
        id: 'my-courses',
        resource: 'courses',
        action: 'view',
        label: 'My courses',
        icon: <BookOpen size={18} />,
        roles: ACADEMIC,
        capability: 'view-own-courses',
      },
      // ---- THE ACADEMIC STUDIO --------------------------------------------
      //
      // The gateway into the AI learning environment: lecturers teach, AI
      // transforms, students learn. Positioned here, immediately after "My
      // courses", because that is the order of the work — these are your
      // courses, and this is what you do inside them.
      //
      // IT IS NOT CALLED "ACADEMIC CAMPUS", and the reason is a ruling the
      // University already gave: delivery is `Campus`, `Online`, or
      // `Online / Campus` — those exact words. "Campus" therefore already
      // means a place a class physically meets. Using it for the ONLINE AI
      // environment would put two meanings of one word on the same screens,
      // and the one a student trusts would be whichever they read first.
      //
      // IT LEAVES THE PORTAL SHELL, which nothing else in this file does.
      // Every other entry is a module rendered inside AppLayout's switch; the
      // Studio is a tree of real routes with its own layout, its own session
      // and its own server components. Rewriting thirty-eight pages into the
      // switch would be a rewrite, not an integration — and it would still be
      // the same app, the same deployment, the same database and the same
      // sign-in, which is what "one system" actually means.
      {
        id: 'academic-studio',
        href: '/academic-studio',
        label: 'Academic Studio',
        icon: <GraduationCap size={18} />,
        roles: ACADEMIC,
        capability: 'access-lms',
      },
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
      // A CAPABILITY THAT HAD NO DOOR. Every lecturer holds
      // `view-registered-students` and not one screen they could open was
      // gated on it — the three that test it all leave `lecturer` out of their
      // role lists, so the roll was visible only incidentally, per course, on
      // the way to entering a mark.
      {
        id: 'my-students',
        resource: 'students',
        action: 'view',
        label: 'My students',
        icon: <Users size={18} />,
        roles: ['lecturer', 'dean', 'hod', 'programme-coordinator'],
        capability: 'view-registered-students',
      },
      { id: 'assignments', label: 'Assignments', icon: <ClipboardList size={18} />, roles: ALL },
      // DRAFT ONLY, FOR THEIR OWN COURSES. The University ruled the paper is a
      // lecturer's to compose and not theirs to approve or publish — those are
      // `schedule-examination` and `publish-examination`, and a lecturer holds
      // neither. The screen enforces the draft; this decides who gets in.
      {
        id: 'exams',
        resource: 'question-papers',
        action: 'create-draft',
        label: 'Question papers',
        icon: <PenTool size={18} />,
        roles: ALL,
        capability: 'draft-question-paper',
      },
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
      {
        id: 'questionbank',
        resource: 'question-bank',
        action: 'manage',
        label: 'Question bank',
        icon: <PenTool size={18} />,
        roles: ['superadmin', 'admin', 'lecturer'],
        capability: 'manage-question-bank',
      },
      {
        id: 'gradebook',
        label: 'Grade book',
        icon: <ClipboardList size={18} />,
        roles: ['superadmin', 'admin', 'lecturer'],
        resource: 'grades',
        action: 'manage',
      },
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
      // WHAT STUDENTS HAVE ASKED FOR, and the offices that answer them. Held
      // by the four a student actually writes to — not by a lecturer, whose
      // work a deferment or a fee query is not.
      {
        id: 'student-request-queue',
        label: 'Student services',
        icon: <Inbox size={18} />,
        roles: ['superadmin', 'admin', 'registrar', 'academic-office',
          'finance-director', 'student-affairs'],
      },
      { id: 'fees', label: 'Fees & receipts', icon: <Wallet size={18} />, roles: ['superadmin', 'admin', 'finance', 'finance-director'] },
      // WHAT THE UNIVERSITY CHARGES, as against what it has received.
      // 'Fees & receipts' is Finance's record of money IN; this is the
      // schedule money is owed against, and the University reserved setting
      // it to the Superadministrator. The Finance Director is here to READ it
      // — they raise invoices from it and cannot publish one.
      {
        id: 'fee-schedules',
        label: 'Fee schedules',
        icon: <Receipt size={18} />,
        roles: ['superadmin', 'admin', 'finance-director'],
      },
    ],
  },
  {
    title: 'Community',
    items: [
      // NO CAPABILITY GATE, AND THAT IS DELIBERATE — I put one here and took it
      // out again. Every CONTROL on this screen is already behind
      // `compose-announcement`, `approve-announcement` and the rest, which a
      // lecturer does not hold; gating the ENTRY on the same capability would
      // have hidden the University's own notices from almost everybody who
      // needs to read them, the Registrar and the Academic Office included.
      //
      // Reading a notice is not composing one. The University's ruling is
      // "create university announcements: no", and that is already true.
      {
        id: 'announcements',
        label: 'Announcements',
        icon: <ClipboardList size={18} />,
        roles: EVERYONE,
        resource: 'announcements',
        action: 'view',
      },
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
      {
        id: 'insights',
        resource: 'early-warning',
        action: 'manage',
        label: 'Student early warning',
        icon: <TrendingUp size={18} />,
        roles: ['superadmin', 'admin', 'lecturer'],
        capability: 'view-own-student-risk',
      },
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
      // WHAT THE UNIVERSITY AND A MEMBER OF STAFF OWE EACH OTHER. A separate
      // entry from the job description on purpose: one says what the
      // post-holder does, the other is the contract. 078 seeded them and only
      // SQL could change a word, which meant they were not the University's
      // conditions at all.
      {
        id: 'appointment-conditions',
        label: 'Conditions of appointment',
        icon: <ScrollText size={18} />,
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
      // WHAT THE UNIVERSITY HOLDS ABOUT THE PERSON READING IT. A staff record
      // was opened for somebody — their number, their post, the letter they
      // signed — and was invisible to the one person it is about, because
      // Appointments and Correspondence are gated to the offices.
      {
        id: 'my-record',
        label: 'My record',
        icon: <IdCard size={18} />,
        roles: STAFF,
        capability: 'view-own-staff-record',
        resource: 'staff-record',
        action: 'view',
      },
      { id: 'settings', label: 'Settings', icon: <Settings size={18} />, roles: EVERYONE },
      // ---- STUDIO CONTROL ------------------------------------------------
      //
      // The University asked for it at Settings → Academic Studio → Studio
      // Control, and it sits beside Settings for that reason.
      //
      // BOTH AUTHORITIES OPEN IT, and the capability named here is the
      // NARROWER one. `grant-studio-permission` is the Vice-Chancellor's;
      // the Superadministrator reaches it too, because `superadmin` is the
      // matrix's only wildcard. Naming `assign-roles` instead would have shut
      // the Vice-Chancellor out of the screen built for their ruling.
      {
        id: 'studio-control',
        label: 'Studio Control',
        icon: <ShieldCheck size={18} />,
        roles: ['superadmin', 'vice-chancellor'],
        capability: 'grant-studio-permission',
      },
    ],
  },
];


// ===========================================================================
// THE STUDENT'S OWN NAVIGATION.
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY ASKED FOR
// ---------------------------------------------------------------------------
//
// "The student web should not simply expose the Superadmin Academic modules.
// It should be a student-facing academic journey, with information and actions
// appearing according to the student's actual status."
//
// The list above is the University's administration, grouped by OFFICE —
// Admissions, Academic, Teaching, Records — because that is how the work is
// divided among the people who do it. Filtering it down to a student's rows
// leaves them reading a filing cabinet: 'Learning (LMS)' under Academic,
// 'Assignments' under Teaching, 'Results' and 'Transcript' under Records, and
// their own degree nowhere at all.
//
// A student has one office and it is their own. So the groups below are the
// four questions they actually have — what am I doing, what is due, what have
// I earned, and what is going on — and the labels are in the first person
// because the screens are theirs.
//
// ---------------------------------------------------------------------------
// AND THE ENTRIES MOVE WITH THE JOURNEY
// ---------------------------------------------------------------------------
//
// `showsAtStage` decides which of them are worth offering today. A person
// whose application is under review does not get a Timetable that opens on an
// empty week, and a graduate is not offered Course registration. That is not a
// permission — roles.ts still decides what may be OPENED — it is the
// difference between a portal that knows where somebody is and one that draws
// every screen it owns and lets them find out.
//
// A NULL STAGE NARROWS NOTHING. While the read is in flight, and after one
// that failed, every entry is offered. Hiding navigation because the network
// was slow is the worse of the two mistakes by a distance.
// ===========================================================================

export const STUDENT_GROUPS: MenuGroup[] = [
  {
    title: null,
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, roles: ['student'] },
    ],
  },
  {
    title: 'My academics',
    items: [
      // THEIR DEGREE, FIRST. Not the programme register — the one they are
      // reading for, with their own progress through it.
      { id: 'my-programme', label: 'My programme', icon: <GraduationCap size={18} />, roles: ['student'] },
      { id: 'lms', label: 'My courses', icon: <BookOpen size={18} />, roles: ['student'] },
      // THE SAME DOOR, FOR THE PEOPLE IT IS FOR. A student reaches the Studio
      // as a reader: published notes, the fifteen-minute audio, the revision
      // set and the Course AI. Same entry, same place in the list, because a
      // lecturer and a student describing it to each other should be talking
      // about the same thing.
      { id: 'academic-studio', href: '/academic-studio', label: 'Academic Studio', icon: <GraduationCap size={18} />, roles: ['student'], capability: 'access-lms' },
      { id: 'course-registration', label: 'Course registration', icon: <ClipboardList size={18} />, roles: ['student'] },
      { id: 'timetable', label: 'My timetable', icon: <CalendarDays size={18} />, roles: ['student'] },
      { id: 'my-calendar', label: 'Academic calendar', icon: <CalendarClock size={18} />, roles: ['student'] },
      { id: 'results', label: 'Results', icon: <BarChart3 size={18} />, roles: ['student'] },
      // 'Transcript' AND NOT ALSO 'Academic records'. The Registry's records
      // screen is a register of five hundred students with a search box over
      // it, and a student was being given it. Their own record is here, and
      // their progress through the curriculum is under My programme — two
      // entries where there had been three, and neither of them staff-shaped.
      { id: 'my-transcript', label: 'Transcript', icon: <FileText size={18} />, roles: ['student'] },
      { id: 'my-graduation', label: 'Graduation', icon: <Award size={18} />, roles: ['student'] },
    ],
  },
  {
    title: 'Learning',
    items: [
      // 'Assessments' rather than 'Assignments': the University named it, and
      // it is the truer word — an assignment, a mid-semester paper and an
      // examination are all things due on a date, and a student thinks of them
      // as one list however differently the system files them.
      { id: 'assignments', label: 'Assessments', icon: <ClipboardCheck size={18} />, roles: ['student'] },
      { id: 'sit-examination', label: 'Sit an examination', icon: <Video size={18} />, roles: ['student'] },
      { id: 'forum', label: 'Discussions', icon: <Share2 size={18} />, roles: ['student'] },
    ],
  },
  {
    title: 'Finance',
    items: [
      { id: 'my-finance', label: 'Fees & payments', icon: <Wallet size={18} />, roles: ['student'] },
    ],
  },
  {
    title: 'Documents',
    items: [
      { id: 'my-documents', label: 'My documents', icon: <FolderOpen size={18} />, roles: ['student'] },
      { id: 'my-credentials', label: 'My credentials', icon: <BadgeCheck size={18} />, roles: ['student'] },
    ],
  },
  {
    title: 'Services',
    items: [
      { id: 'student-services', label: 'Student services', icon: <Inbox size={18} />, roles: ['student'] },
    ],
  },
  {
    title: 'Community',
    items: [
      { id: 'my-announcements', label: 'Announcements', icon: <ClipboardList size={18} />, roles: ['student'] },
    ],
  },
  {
    title: 'Profile',
    items: [
      { id: 'my-profile', label: 'My profile', icon: <UserCog size={18} />, roles: ['student'] },
      { id: 'settings', label: 'Account & security', icon: <Settings size={18} />, roles: ['student'] },
    ],
  },
];

/**
 * The groups a signed-in person is offered.
 *
 * @param stage the student's journey stage, or null to narrow nothing.
 */
export function groupsFor(
  role: UserRole | undefined | null,
  stage?: string | null,
): MenuGroup[] {
  if (!role) return [];
  const source = role === 'student' ? STUDENT_GROUPS : menuGroups;
  return source
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => (
        // ---------------------------------------------------------------
        // THE GRANT DECIDES, WHERE THERE IS ONE.
        //
        // A ruled role's entries are chosen by what it may reach, not by a
        // role list somebody maintained separately. That is the whole point:
        // one answer, read by the sidebar, the page and the route alike,
        // instead of three that drift.
        //
        // An entry with no `resource` is still role-gated for a ruled role —
        // the Dashboard, Settings, the discussion forum: things everybody has
        // that are nobody's resource.
        // ---------------------------------------------------------------
        // ---------------------------------------------------------------
        // THE GRANT DECIDES WHERE THERE IS ONE; OTHERWISE THE CAPABILITY DOES.
        //
        // This read `isRuled(role)` — is this role in the grant table AT ALL —
        // which was right while the lecturer was the only role in it and would
        // have been wrong the moment a second arrived. The University's
        // September 2026 examples give a Dean ONE triple (students/view on
        // their own faculty). Treated as a complete tree it takes a Dean's
        // sidebar from 20 items to 18 — measured, not guessed — and the number
        // grows with every entry that gains a resource and an action.
        //
        // `grantDecides` is true when there is a ruling to apply — and for
        // every resource/action of a role whose tree is complete, because
        // there the silence IS the ruling. The lecturer keeps being refused
        // the Course catalogue; a Dean keeps everything nobody has ruled on.
        // ---------------------------------------------------------------
        i.resource && i.action && grantDecides(role, i.resource, i.action)
          ? scopeOf(role, i.resource, i.action) !== null
          : i.roles.includes(role) && (!i.capability || can(role, i.capability))
      )
        && (role !== 'student' || !stage || showsAtStage(stage, i.id))),
    }))
    .filter((g) => g.items.length > 0);
}

/** Every item the given role may reach, flattened — what search looks through. */
export function navItemsFor(
  role: UserRole | undefined | null,
  stage?: string | null,
): Array<MenuItem & { group: string }> {
  return groupsFor(role, stage)
    .flatMap((g) => g.items.map((i) => ({ ...i, group: g.title ?? 'General' })));
}

/**
 * The label for a view, for the breadcrumb and the browser tab.
 *
 * THE STUDENT'S NAMES WIN WHERE THEY DIFFER, because a student is the only
 * person who reaches those ids by those names: 'lms' is 'My courses' to them
 * and 'Learning (LMS)' to a lecturer, and the tab should say what the sidebar
 * they clicked said.
 */
export function labelForView(view: ViewType, role?: UserRole | null): string {
  const source = role === 'student' ? [...STUDENT_GROUPS, ...menuGroups] : menuGroups;
  for (const g of source) {
    const hit = g.items.find((i) => i.id === view);
    if (hit) return hit.label;
  }
  return 'Dashboard';
}

/** The group a view sits in, for the breadcrumb. */
export function groupForView(view: ViewType, role?: UserRole | null): string | null {
  const source = role === 'student' ? [...STUDENT_GROUPS, ...menuGroups] : menuGroups;
  for (const g of source) {
    if (g.items.some((i) => i.id === view)) return g.title;
  }
  return null;
}
