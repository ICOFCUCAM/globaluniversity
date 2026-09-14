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
import Enrolment from '@/components/admissions/Enrolment';
import AdmissionsOffice from './admissions/AdmissionsOffice';
import AcademicAdmissions from './admissions/AcademicAdmissions';
import { isEnrolledRole } from '@/lib/roles';
import { labelForView } from '@/lib/portalNav';
import { JourneyProvider } from '@/contexts/JourneyContext';
import { GradingProvider } from '@/contexts/GradingContext';
import MyProgramme from './student/MyProgramme';
import MyTimetable from './student/MyTimetable';
import MyAssessments from './student/MyAssessments';
import MyResults from './student/MyResults';
import MyDocuments from './student/MyDocuments';
import MyFinance from './student/MyFinance';
import MyCalendar from './student/MyCalendar';
import MyGraduation from './student/MyGraduation';
import MyAnnouncements from './student/MyAnnouncements';
import MyTranscript from './student/MyTranscript';
import MyProfile from './student/MyProfile';
import StudentServices from './student/StudentServices';
import { UNIVERSITY } from '@/lib/constants';
import LecturerManagement from './lecturers/LecturerManagement';
import CourseRegistration from '@/components/courses/CourseRegistration';
import CourseManagement from './courses/CourseManagement';
import ProgrammeRegister from './academic/ProgrammeRegister';
import CurriculumBuilder from './academic/CurriculumBuilder';
import CourseOfferings from './academic/CourseOfferings';
import TimetableGrid from './academic/TimetableGrid';
import AcademicOverview from './academic/AcademicOverview';
import Rooms from './academic/Rooms';
import AcademicCalendar from './academic/AcademicCalendar';
import AcademicRecords from './academic/AcademicRecords';
import AcademicStructure from './academic/AcademicStructure';
import Graduation from './academic/Graduation';
import CourseShelf from './lms/CourseShelf';
import ResultProcessing from './results/ResultProcessing';
import GradeBook from './results/GradeBook';
import ResultsApproval from './results/ResultsApproval';
import TranscriptGenerator from './transcript/TranscriptGenerator';
import CertificateGenerator from './certificate/CertificateGenerator';
import MyCredentials from './credentials/MyCredentials';
import LMSModule from './lms/LMSModule';
import ExamModule from './exams/ExamModule';
import QuestionBank from './exams/QuestionBank';
import DocumentManagement from './documents/DocumentManagement';
import AssignmentModule from './assignments/AssignmentModule';
import AnnouncementModule from './announcements/AnnouncementModule';
// THE SCREENS THAT HAD NO DOOR. Built, guarded, migrated for — and
// unreachable until they were added to portalNav and to this switch.
import AppointmentDashboard from './hr/AppointmentDashboard';
import Appointments from './hr/Appointments';
import CorrespondenceCenter from './correspondence/CorrespondenceCenter';
import DocumentTemplates from './admin/DocumentTemplates';
import JobDescriptions from './admin/JobDescriptions';
import AppointmentConditions from './hr/AppointmentConditions';
import TimetableModule from './timetable/TimetableModule';
import ForumModule from './forum/ForumModule';
import FeeModule from './fees/FeeModule';
import FeeSchedules from './finance/FeeSchedules';
import StudentRequestQueue from './services/StudentRequestQueue';
import AnalyticsDashboard from './analytics/AnalyticsDashboard';
import InsightsModule from './insights/InsightsModule';
import SettingsPage from './settings/SettingsPage';
import MyCourses from './staff/MyCourses';
import MyRecord from './staff/MyRecord';
import MyStudents from './staff/MyStudents';
import AuditLogs from './audit/AuditLogs';
import ScreenBoundary from './ScreenBoundary';
import AccountManagement from './accounts/AccountManagement';
import SocialCommandCentre from './social/SocialCommandCentre';
// The Studio and the Authority are now reached through the workspace that
// composes them, so neither is imported here.
import CredentialsWorkspace from './credentials/CredentialsWorkspace';
import SitExamination from './exams/SitExamination';
import ExaminerConsole from './exams/ExaminerConsole';
import ExaminationOffice from './exams/ExaminationOffice';

export default function AppLayout() {
  // The Student Portal is exclusively for enrolled students. An applicant who
  // signs in here is turned away rather than shown an empty portal — the
  // specification is explicit that no application forms live in this system.
  const { isAuthenticated, user } = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  // -------------------------------------------------------------------------
  // WHICH CURRICULUM THE BUILDER IS ON.
  //
  // Held here rather than in the builder because the register opens it: a
  // Superadministrator picks a programme from the list and the builder appears
  // on that one. Opening the builder from the sidebar with nothing chosen
  // shows the register instead, which is the only sensible thing it can do —
  // a builder with no programme is a blank screen with a title.
  // -------------------------------------------------------------------------
  const [curriculumVersion, setCurriculumVersion] = useState<string | null>(null);
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
    const label = labelForView(currentView, user?.role);
    document.title = `${label} · ${UNIVERSITY.shortName} Portal`;
  }, [currentView, user?.role]);

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
      // The Head of Academic Affairs' own desk. A screen of its own rather
      // than a seat at the Admissions Office's — see the file's header.
      case 'academic-admissions':
        return <AcademicAdmissions role={user?.role} />;
      // The Registrar records what became of an issued admission. No academic
      // decision is taken here — everything on it has already been decided.
      case 'enrolment':
        return <Enrolment />;
      case 'students':
        return <StudentManagement onNavigate={setCurrentView} />;
      case 'lecturers':
        return <LecturerManagement onNavigate={setCurrentView} />;
      case 'courses':
        return <CourseManagement />;
      case 'course-registration':
        return <CourseRegistration />;
      // THE STUDENT'S OWN DEGREE. Not the programme register filtered to one
      // row — see the header of MyProgramme for why those are two screens.
      case 'my-programme':
        return <MyProgramme onNavigate={navigate} />;
      // ---------------------------------------------------------------
      // THE STUDENT'S OWN SIDE OF WHAT ALREADY EXISTED.
      //
      // Not one of these holds data of its own. Every one reads a view over
      // rows this database has had all along and shown to nobody — the
      // sealed credential register, the payments, the academic calendar the
      // Registry keeps, 069's graduation assessment, the announcements.
      // ---------------------------------------------------------------
      case 'my-documents':
        return <MyDocuments />;
      case 'my-finance':
        return <MyFinance />;
      case 'my-calendar':
        return <MyCalendar />;
      case 'my-graduation':
        return <MyGraduation onNavigate={navigate} />;
      case 'my-announcements':
        return <MyAnnouncements />;
      case 'my-transcript':
        return <MyTranscript onNavigate={navigate} />;
      case 'my-profile':
        return <MyProfile onNavigate={navigate} />;
      case 'student-services':
        return <StudentServices onNavigate={navigate} />;
      // -------------------------------------------------------------------
      // THREE IDS, TWO SCREENS EACH, AND THE ROLE DECIDES WHICH.
      //
      // A student and a lecturer both reach 'results', 'assignments' and
      // 'timetable' — and they want opposite things there. The staff screens
      // are the ones that WRITE: ResultProcessing enters marks,
      // AssignmentModule sets briefs, TimetableGrid builds the schedule. A
      // student opening any of them was being handed the tool that produces
      // the thing rather than the thing.
      //
      // The alternative was three more ViewType ids and three more sidebar
      // entries, which would have put "Results" and "My results" in the same
      // search box meaning almost the same thing. The University's own
      // framing settles it: it is one subject, seen from two sides.
      // -------------------------------------------------------------------
      case 'results':
        return user?.role === 'student' ? <MyResults /> : <ResultProcessing />;
      case 'gradebook':
        return <GradeBook />;
      case 'result-approval':
        return <ResultsApproval role={user?.role} />;
      case 'transcript':
        return <TranscriptGenerator />;
      case 'certificate':
        return <CertificateGenerator />;
      case 'my-credentials':
        return <MyCredentials />;
      case 'programmes-register':
        return (
          <ProgrammeRegister
            onOpen={(id) => { setCurriculumVersion(id); setCurrentView('curriculum-builder'); }}
          />
        );
      case 'curriculum-builder':
        return curriculumVersion
          ? (
            <CurriculumBuilder
              versionId={curriculumVersion}
              onBack={() => { setCurriculumVersion(null); setCurrentView('programmes-register'); }}
            />
          )
          : (
            <ProgrammeRegister
              onOpen={(id) => { setCurriculumVersion(id); setCurrentView('curriculum-builder'); }}
            />
          );
      // THE LMS, REBUILT AROUND COURSES. The old module kept materials in a
      // JSON blob keyed on a course code typed as free text — a string is not
      // a foreign key, so nothing could list the materials OF a course, and
      // 'my courses' had no answer at all. 068 gives a material a course_id.
      case 'lms':
        return <CourseShelf />;
      case 'exams':
        return <ExamModule />;
      case 'questionbank':
        return <QuestionBank />;
      case 'assignments':
        return user?.role === 'student' ? <MyAssessments /> : <AssignmentModule />;
      case 'announcements':
        return <AnnouncementModule />;
      case 'appointments':
        return <AppointmentDashboard />;
      case 'appointments-board':
        return <Appointments />;
      case 'correspondence':
        return <CorrespondenceCenter />;
      case 'document-templates':
        return <DocumentTemplates />;
      case 'job-descriptions':
        return <JobDescriptions />;
      case 'appointment-conditions':
        return <AppointmentConditions />;
      // THE TIMETABLE IS THE CLASSES THAT EXIST. The old module kept its own
      // slots — a day, an hour and the course typed in as free text — which
      // matched no course, no lecturer and no room, so no conflict between two
      // of them could ever be detected. Its attendance half is still real
      // work, and keeps its own entry.
      case 'timetable':
        return user?.role === 'student' ? <MyTimetable /> : <TimetableGrid />;
      case 'attendance':
        return <TimetableModule />;
      case 'course-offerings':
        return <CourseOfferings />;
      case 'rooms':
        return <Rooms />;
      case 'academic-calendar':
        return <AcademicCalendar />;
      case 'academic-records':
        return <AcademicRecords />;
      case 'academic-structure':
        return <AcademicStructure />;
      case 'graduation':
        return <Graduation />;
      case 'academic-overview':
        return <AcademicOverview onNavigate={setCurrentView} />;
      case 'forum':
        return <ForumModule />;
      case 'fees':
        return <FeeModule />;
      case 'fee-schedules':
        return <FeeSchedules />;
      case 'student-request-queue':
        return <StudentRequestQueue />;
      case 'documents':
        return <DocumentManagement />;
      case 'analytics':
        return <AnalyticsDashboard />;
      case 'insights':
        return <InsightsModule />;
      // WHAT THE UNIVERSITY HOLDS ABOUT THE PERSON READING IT, and the roll
      // for the courses they teach. Both were capabilities or records that
      // existed with nothing to open them.
      case 'my-courses':
        return <MyCourses />;
      case 'my-record':
        return <MyRecord />;
      case 'my-students':
        return <MyStudents />;
      case 'settings':
        return <SettingsPage />;
      case 'audit':
        return <AuditLogs />;
      // Both screens refuse from the inside as well as being hidden from the
      // sidebar. Hiding a menu item is courtesy; the check inside the component
      // and the check in the route are the control.
      case 'accounts':
        return <AccountManagement />;
      case 'social':
        return <SocialCommandCentre role={user?.role} userId={user?.id} />;
      // Three view ids, one workspace. 'studio' and 'credential-authority' are
      // still named by dashboard actions and older links; sending them here
      // rather than deleting them means an existing link lands on the right
      // screen instead of the dashboard.
      case 'credentials':
      case 'studio':
      case 'credential-authority':
        return <CredentialsWorkspace role={user?.role} />;
      case 'sit-examination':
        return <SitExamination />;
      case 'examiner-console':
        return <ExaminerConsole role={user?.role} />;
      case 'examination-office':
        return <ExaminationOffice role={user?.role} />;
      default:
        return <AdminDashboard onNavigate={setCurrentView} />;
    }
  }

  return (
    // WHERE THE STUDENT STANDS, READ ONCE, ABOVE EVERYTHING THAT READS IT.
    // The rail, the breadcrumb, the search box and every student screen share
    // one answer rather than each asking the database for their own.
    // THE GRADING SCALE, LOADED ONCE AND ABOVE EVERYTHING THAT COMPUTES A
    // GRADE. Until this existed the University could restate its scale,
    // approve it and publish it, and every screen would go on computing the
    // copy in the repository.
    <GradingProvider>
    <JourneyProvider>
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
          <ScreenBoundary key={currentView} screen={labelForView(currentView, user?.role)}>
            {renderView()}
          </ScreenBoundary>
        </div>
      </main>
    </div>
    </JourneyProvider>
    </GradingProvider>
  );
}
