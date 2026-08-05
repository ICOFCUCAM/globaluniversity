import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { ViewType } from '@/lib/types';
import LoginScreen from './LoginScreen';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import AdminDashboard from './dashboard/AdminDashboard';
import StudentDashboard from './dashboard/StudentDashboard';
import LecturerDashboard from './dashboard/LecturerDashboard';
import StudentManagement from './students/StudentManagement';
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

export default function AppLayout() {
  const { isAuthenticated, user } = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  function renderView() {
    switch (currentView) {
      case 'dashboard':
        if (user?.role === 'admin') return <AdminDashboard />;
        if (user?.role === 'student') return <StudentDashboard onNavigate={setCurrentView} />;
        if (user?.role === 'lecturer') return <LecturerDashboard onNavigate={setCurrentView} />;
        return <AdminDashboard />;
      case 'students':
        return <StudentManagement />;
      case 'lecturers':
        return <LecturerManagement />;
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
      default:
        return <AdminDashboard />;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <TopBar
        sidebarCollapsed={sidebarCollapsed}
        onMenuToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main
        className={`pt-16 transition-all duration-300 ${
          sidebarCollapsed ? 'ml-[72px]' : 'ml-64'
        }`}
      >
        <div className="p-6">
          {renderView()}
        </div>
      </main>
    </div>
  );
}
