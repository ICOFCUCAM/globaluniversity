import React, { useState } from 'react';
import ProgrammeResources from './programme/ProgrammeResources';
import { useAuth } from '@/contexts/AuthContext';
import type { ViewType } from '@/lib/types';
import LoginScreen from './LoginScreen';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import AdminDashboard from './dashboard/AdminDashboard';
import StudentDashboard from './dashboard/StudentDashboard';
import LecturerDashboard from './dashboard/LecturerDashboard';
import StudentManagement from './students/StudentManagement';
import AdmissionsDesk from './admissions/AdmissionsDesk';
import { isEnrolledRole } from '@/lib/roles';
import LecturerManagement from './lecturers/LecturerManagement';
import CourseManagement from './courses/CourseManagement';
import ResultProcessing from './results/ResultProcessing';
import GradeBook from './results/GradeBook';
import TranscriptGenerator from './transcript/TranscriptGenerator';
import CertificateGenerator from './certificate/CertificateGenerator';
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
import AccountManagement from './accounts/AccountManagement';
import CredentialStudio from './studio/CredentialStudio';

export default function AppLayout() {
  // The Student Portal is exclusively for enrolled students. An applicant who
  // signs in here is turned away rather than shown an empty portal — the
  // specification is explicit that no application forms live in this system.
  const { isAuthenticated, user } = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            You are signed in as an applicant. The Student Portal is for enrolled students only —
            it carries no application forms. Track your application, upload documents and see your
            payment status in the Admissions Portal instead.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
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
        if (user?.role === 'admin' || user?.role === 'superadmin') return <AdminDashboard onNavigate={setCurrentView} />;
        if (user?.role === 'student') return <StudentDashboard onNavigate={setCurrentView} />;
        if (user?.role === 'lecturer') return <LecturerDashboard onNavigate={setCurrentView} />;
        return <AdminDashboard onNavigate={setCurrentView} />;
      case 'admissions-finance':
        return <AdmissionsDesk desk="finance" />;
      case 'admissions-registrar':
        return <AdmissionsDesk desk="registrar" />;
      case 'students':
        return <StudentManagement />;
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
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <TopBar
        sidebarCollapsed={sidebarCollapsed}
        onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        currentView={currentView}
        onViewChange={setCurrentView}
      />
      <main
        className={`pt-16 transition-all duration-300 ${
          sidebarCollapsed ? 'ml-[68px]' : 'ml-64'
        }`}
      >
        <div className="p-6">
          {renderView()}
        </div>
      </main>
    </div>
  );
}
