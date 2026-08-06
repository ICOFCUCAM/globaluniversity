import React, { useCallback, useEffect, useState } from 'react';
import ProgrammeResources from './programme/ProgrammeResources';
import { useAuth } from '@/contexts/AuthContext';
import type { ViewType } from '@/lib/types';
import LoginScreen from './LoginScreen';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import AdminDashboard from './dashboard/AdminDashboard';
import FinanceDashboard from './dashboard/FinanceDashboard';
import RegistrarDashboard from './dashboard/RegistrarDashboard';
import OfficeDashboard from './dashboard/OfficeDashboard';
import StudentDashboard from './dashboard/StudentDashboard';
import LecturerDashboard from './dashboard/LecturerDashboard';
import StudentManagement from './students/StudentManagement';
import AdmissionsDesk from './admissions/AdmissionsDesk';
import AdmissionsOffice from './admissions/AdmissionsOffice';
import { isEnrolledRole } from '@/lib/roles';
import { labelForView } from '@/lib/portalNav';
import { UNIVERSITY } from '@/lib/constants';
import LecturerManagement from './lecturers/LecturerManagement';
import CourseManagement from './courses/CourseManagement';
import ResultProcessing from './results/ResultProcessing';
import GradeBook from './results/GradeBook';
import TranscriptGenerator from './transcript/TranscriptGenerator';
import CertificateGenerator from './certificate/CertificateGenerator';
import MyCredentials from './credentials/MyCredentials';
import LMSModule from './lms/LMSModule';
import ExamModule from './exams/ExamModule';
import QuestionBank from './exams/QuestionBank';
import DocumentManagement from './documents/DocumentManagement';
import AssignmentModule from './assignments/AssignmentModule';
import AnnouncementModule from './announcements/AnnouncementModule';
import TimetableModule from './timetable/TimetableModule';
import ForumModule from './forum/ForumModule';
import FeeModule from './fees/FeeModule';
import AnalyticsDashboard from './analytics/AnalyticsDashboard';
import InsightsModule from './insights/InsightsModule';
import SettingsPage from './settings/SettingsPage';
import AuditLogs from './audit/AuditLogs';
import ScreenBoundary from './ScreenBoundary';
import AccountManagement from './accounts/AccountManagement';
import CredentialStudio from './studio/CredentialStudio';

export default function AppLayout() {
  // The Student Portal is exclusively for enrolled students. An applicant who
  // signs in here is turned away rather than shown an empty portal — the
  // specification is explicit that no application forms live in this system.
  const { isAuthenticated, user } = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Separate from `collapsed`, which is the desktop rail width. On a phone the
  // rail is not narrow — it is absent, and slides over the content when opened.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Choosing a destination closes the drawer. Leaving it open over the screen
  // the user just asked for is the most common way a mobile nav goes wrong.
  const navigate = useCallback((v: ViewType) => {
    setCurrentView(v);
    setMobileNavOpen(false);
  }, []);

  // The browser tab, the history entry and the bookmark all read from
  // document.title. It said "Student Portal" on all twenty-five screens, so a
  // registrar with the admissions desk and the student register open in two
  // tabs had two identical tabs and had to click to tell them apart.
  useEffect(() => {
    const label = labelForView(currentView);
    document.title = `${label} · ${UNIVERSITY.shortName} Portal`;
  }, [currentView]);

  // Escape closes it, and the body stops scrolling underneath while it is open
  // — without that, a swipe on the drawer scrolls the page behind it.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileNavOpen(false); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // Signed in, but not as an enrolled member of the university.
  if (!isEnrolledRole(user?.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <div className="max-w-lg rounded-2xl bg-white p-8 text-center shadow-xl">
          <h1 className="font-heading text-2xl font-bold text-[#422e59]">
            This is the Student Portal
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
            You are signed in as an applicant. The Student Portal is for enrolled students only —
            it carries no application forms. Track your application, upload documents and see your
            payment status in the Admissions Portal instead.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
            Your student account is created for you automatically the moment the Office of the
            Registrar approves your application, and your student number, username and temporary
            password are emailed to you.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a
              href="/admissions-portal"
              className="rounded-lg bg-[#422e59] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#33234a]"
            >
              Go to the Admissions Portal
            </a>
            <a
              href="/apply"
              className="rounded-lg border-2 border-[#422e59] px-5 py-2.5 text-sm font-semibold text-[#422e59] transition hover:bg-[#422e59] hover:text-white"
            >
              Continue my application
            </a>
          </div>
        </div>
      </div>
    );
  }

  function renderView() {
    switch (currentView) {
      case 'programme-resources':
        return <ProgrammeResources />;
      case 'dashboard':
        // One dashboard per office, showing that office's own work.
        //
        // Everyone used to land on the administrator's dashboard, which put
        // other people's queues on their screen: the Registrar was shown
        // "Awaiting Finance 1" and a list of unpaid applications, a Dean saw
        // the payment queue, and the Chancellor was offered a button opening
        // the Registrar's desk — an action the Chancellor is forbidden to take.
        //
        // Displaying another office's queue undoes in the interface what the
        // database enforces. An unpaid application is not the Registrar's to
        // decide, and putting it in front of them invites "can you push that
        // one through" — the question the two-desk design exists to make
        // unaskable.
        //
        // Only admin and superadmin see everything.
        switch (user?.role) {
          case 'superadmin':
          case 'admin':
            return <AdminDashboard onNavigate={setCurrentView} />;
          case 'registrar':
            return <RegistrarDashboard onNavigate={setCurrentView} />;
          case 'finance':
          case 'finance-director':
            return <FinanceDashboard onNavigate={setCurrentView} />;
          case 'student':
            return <StudentDashboard onNavigate={setCurrentView} />;
          case 'lecturer':
            return <LecturerDashboard onNavigate={setCurrentView} />;
          default:
            // Executive, faculty, admissions support and student services —
            // one configurable screen rather than four that drift apart.
            return <OfficeDashboard onNavigate={setCurrentView} />;
        }
      case 'admissions-finance':
        return <AdmissionsDesk desk="finance" />;
      case 'admissions-registrar':
        return <AdmissionsDesk desk="registrar" />;
      case 'admissions-office':
        return <AdmissionsOffice />;
      case 'students':
        return <StudentManagement onNavigate={setCurrentView} />;
      case 'lecturers':
        return <LecturerManagement onNavigate={setCurrentView} />;
      case 'courses':
        return <CourseManagement />;
      case 'results':
        return <ResultProcessing />;
      case 'gradebook':
        return <GradeBook />;
      case 'transcript':
        return <TranscriptGenerator />;
      case 'certificate':
        return <CertificateGenerator />;
      case 'my-credentials':
        return <MyCredentials />;
      case 'lms':
        return <LMSModule />;
      case 'exams':
        return <ExamModule />;
      case 'questionbank':
        return <QuestionBank />;
      case 'assignments':
        return <AssignmentModule />;
      case 'announcements':
        return <AnnouncementModule />;
      case 'timetable':
        return <TimetableModule />;
      case 'forum':
        return <ForumModule />;
      case 'fees':
        return <FeeModule />;
      case 'documents':
        return <DocumentManagement />;
      case 'analytics':
        return <AnalyticsDashboard />;
      case 'insights':
        return <InsightsModule />;
      case 'settings':
        return <SettingsPage />;
      case 'audit':
        return <AuditLogs />;
      // Both screens refuse from the inside as well as being hidden from the
      // sidebar. Hiding a menu item is courtesy; the check inside the component
      // and the check in the route are the control.
      case 'accounts':
        return <AccountManagement />;
      case 'studio':
        return <CredentialStudio />;
      default:
        return <AdminDashboard onNavigate={setCurrentView} />;
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f5f0] dark:bg-[#17131d]">
      {/* Scrim. Only on small screens, and only while the drawer is open. */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}
      <Sidebar
        currentView={currentView}
        onViewChange={navigate}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <TopBar
        sidebarCollapsed={sidebarCollapsed}
        onMenuToggle={() => setMobileNavOpen((o) => !o)}
        currentView={currentView}
        onViewChange={navigate}
      />
      {/* A keyboard user starting at the top of the portal otherwise tabs
          through twenty-five navigation items before reaching the screen they
          asked for — on every single navigation. The public site has had this
          since it was built; the portal never did. */}
      <a
        href="#portal-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-[#e9c14a] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#241a30]"
      >
        Skip to content
      </a>
      <main
        id="portal-main"
        tabIndex={-1}
        className={`pt-16 transition-[margin] duration-200 ${
          sidebarCollapsed ? 'lg:ml-[68px]' : 'lg:ml-64'
        }`}
      >
        <div className="p-4 sm:p-6">
          {/* Keyed on the view so moving to another screen resets the boundary
              rather than leaving the last failure on display. */}
          <ScreenBoundary key={currentView} screen={labelForView(currentView)}>
            {renderView()}
          </ScreenBoundary>
        </div>
      </main>
    </div>
  );
}
