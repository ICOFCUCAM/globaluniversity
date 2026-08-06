// ---------------------------------------------------------------------------
// The ICOF Global University ERP — the seventeen modules, as a register.
//
// The university specified an ERP on the scale of Banner, Workday Student or
// Campus Solutions. Those systems represent hundreds of person-years. This file
// is the blueprint plus an honest account of how much of it stands today, kept
// as data so /erp shows real state rather than a wish list, and so a module
// links the day it exists.
//
// STATUS MEANS THE SAME THING HERE AS IT DOES ON /documents:
//
//   built      the module exists and does the job described
//   partial    some functions work; the ones that do not are named
//   planned    designed, specified, not built
//
// Nothing is marked built because it has a screen. A module is built when the
// functions listed against it actually run — which is why the Student Portal
// below is 'partial' despite being the largest thing in the codebase.
// ---------------------------------------------------------------------------

import type { UserRole } from '@/lib/types';

export type ModuleStatus = 'built' | 'partial' | 'planned';

export interface ErpModule {
  n: number;
  title: string;
  /** Route, once something of it exists. */
  href?: string;
  purpose: string;
  status: ModuleStatus;
  /** Functions the university specified. */
  functions: string[];
  /** What works today, where that is less than the list above. */
  working?: string[];
  /** What must happen next for this module to advance. */
  next?: string[];
  /** Roles that use this module. */
  roles: UserRole[];
}

export const erpModules: ErpModule[] = [
  {
    n: 1,
    title: 'Admissions Portal',
    href: '/admissions-portal',
    purpose: 'Open to anyone. Where an application is created, paid for and tracked.',
    status: 'partial',
    functions: [
      'Create applicant account',
      'Online application',
      'Upload documents',
      'Programme selection',
      'Fee payment',
      'Application tracking',
      'Interview booking',
      'Admission letter download',
    ],
    working: [
      'Online application, six steps, submitting to Admissions and writing a record',
      'Programme selection at application',
      'A published account of the pipeline and what every status means',
    ],
    next: [
      'Applicant accounts backed by auth, so an application can be saved and resumed',
      'Document upload against a Registrar’s request',
      'Online fee payment — currently paid outside the system and verified by Finance',
      'Admission letter as a generated PDF',
    ],
    roles: ['applicant', 'admissions-officer'],
  },
  {
    n: 2,
    title: 'Finance Department',
    href: '/portal',
    purpose: 'Verifies application fees and, in time, owns every financial record in the university.',
    status: 'partial',
    functions: [
      'Verify payment',
      'Reject payment',
      'Issue refund',
      'Generate invoice',
      'Print receipt',
      'Financial reports',
      'Revenue dashboard',
      'Outstanding fees',
    ],
    working: ['Verify payment — reference, amount and currency, turning the record blue'],
    next: [
      'Reject payment with a reason, returning the record to the applicant',
      'Refunds against the published refund schedule',
      'Invoices and receipts',
      'Revenue and outstanding-fee reporting',
    ],
    roles: ['finance', 'finance-director'],
  },
  {
    n: 3,
    title: 'Office of the Registrar',
    href: '/portal',
    purpose: 'Examines applications whose payment is verified, and decides them.',
    status: 'partial',
    functions: [
      'Approve',
      'Reject',
      'Request documents',
      'Defer admission',
      'Transfer programme',
      'Dashboard: waiting, approved today, rejected today, international, transfers, deferred',
    ],
    working: ['Approve', 'Reject with a recorded reason', 'Request documents'],
    next: [
      'Defer admission and transfer programme',
      'The dashboard counts, which need the data before they mean anything',
    ],
    roles: ['registrar'],
  },
  {
    n: 4,
    title: 'Automatic Student Creation',
    purpose: 'What happens the instant the Registrar approves. Nothing here is created by hand.',
    status: 'partial',
    functions: [
      'Student profile',
      'Student number',
      'Username and temporary password',
      'Student email',
      'Programme, department, faculty',
      'Fee structure',
      'Academic calendar',
      'Timetable',
      'LMS account',
      'Library account',
      'Hostel record',
      'Medical record',
      'Digital student ID',
    ],
    working: [
      'Student number in the ICOF{year}{00000} format',
      'Auth account with username and temporary password',
      'Programme carried from the application',
      'Welcome email with all of the above',
    ],
    next: [
      'Everything else on the list. Each needs the module that owns it to exist first — there is no fee structure to attach until the Finance module holds one, and no timetable until the Academic Office builds one.',
    ],
    roles: ['registrar'],
  },
  {
    n: 5,
    title: 'Student Portal',
    href: '/portal',
    purpose: 'For enrolled students only. No application forms live here.',
    status: 'partial',
    functions: [
      'Dashboard',
      'Profile',
      'Programme and current semester',
      'Credit hours',
      'Academic advisor',
      'Announcements',
      'Upcoming exams',
      'Outstanding fees',
      'GPA',
      'Notifications',
    ],
    working: [
      'Dashboard, profile, courses, results and GPA',
      'Transcript and certificate',
      'Announcements, forum, assignments, timetable',
      'Applicants are turned away and sent to the Admissions Portal',
    ],
    next: ['Academic advisor allocation', 'Outstanding fees, once Finance holds a ledger'],
    roles: ['student'],
  },
  {
    n: 6,
    title: 'Course Registration',
    purpose:
      'The student clicks once; the system knows their faculty, programme, level and semester, and checks the rules.',
    status: 'planned',
    functions: [
      'Automatic course list from programme and level',
      'Prerequisite checking',
      'Outstanding fee checking',
      'Programme rules',
      'Maximum credit checking',
      'Automatic approval when valid',
    ],
    next: [
      'Prerequisites are not recorded against any course yet — this module cannot check what does not exist',
      'Maximum credits per level: the regulations give 10–12 subjects a year, which needs expressing in credits',
      'A fee ledger to check against',
    ],
    roles: ['student'],
  },
  {
    n: 7,
    title: 'Lecturer Portal',
    href: '/portal',
    purpose: 'Each lecturer sees only their assigned courses.',
    status: 'partial',
    functions: [
      'Attendance',
      'Upload notes',
      'Assignments',
      'Exams',
      'Marks and grade submission',
      'Student messaging',
      'Office hours',
      'Research',
    ],
    working: ['Grade book', 'Assignments', 'Question bank', 'Learning analytics'],
    next: ['Attendance', 'Course allocation, so "assigned courses" is a real constraint', 'Office hours'],
    roles: ['lecturer'],
  },
  {
    n: 8,
    title: 'Head of Department Portal',
    purpose: 'Allocates teaching and monitors it.',
    status: 'planned',
    functions: [
      'Assign lecturers',
      'Approve course allocation',
      'Monitor teaching',
      'Department reports',
      'Student statistics',
      'Research outputs',
    ],
    next: ['Departments are not yet modelled as records with a head, staff and courses attached'],
    roles: ['hod'],
  },
  {
    n: 9,
    title: 'Dean Portal',
    purpose: 'Faculty-wide view: students, staff, departments, research, revenue, retention.',
    status: 'planned',
    functions: [
      'Total students, lecturers, departments',
      'Research and revenue',
      'Graduation and admissions',
      'Retention',
      'Faculty reports',
    ],
    next: [
      'Every figure here must be derived from records the system holds. Until enrolment, staffing and revenue are real data, a dean’s dashboard would be decoration.',
    ],
    roles: ['dean'],
  },
  {
    n: 10,
    title: 'Examination Office',
    purpose: 'From timetable to degree classification to the graduation list.',
    status: 'partial',
    functions: [
      'Exam timetable',
      'Invigilators',
      'Question papers',
      'Moderation',
      'Grade approval',
      'Transcript generation',
      'Degree classification',
      'Graduation list',
    ],
    working: ['Online examinations', 'Question bank', 'Transcript generation'],
    next: [
      'Degree classification bands have not been adopted — this module cannot classify a degree until the Academic Board says what a first, a merit or a distinction is',
      'Moderation and grade approval workflow',
      'Invigilator scheduling',
    ],
    roles: ['registrar', 'academic-office'],
  },
  {
    n: 11,
    title: 'Library',
    purpose: 'Borrowing and cataloguing for students; inventory and acquisitions for librarians.',
    status: 'planned',
    functions: [
      'Borrow and reserve books',
      'Digital library and research databases',
      'Citation tools',
      'Reading lists',
      'Book inventory and cataloguing',
      'Loans, fines and acquisitions',
      'Digital repository',
    ],
    next: [
      'The university has not yet described what its library holds — see the Academic Catalog, Part X. A library module with no catalogue behind it is a login screen.',
    ],
    roles: ['student', 'library-staff'],
  },
  {
    n: 12,
    title: 'Learning Management System',
    href: '/portal',
    purpose: 'Integrated directly. No second login.',
    status: 'partial',
    functions: [
      'Courses',
      'Assignments',
      'Forums',
      'Videos',
      'Live classes',
      'Quizzes',
      'Grades',
      'Certificates',
    ],
    working: ['Courses, assignments, forum, quizzes, grades and certificates, all inside one login'],
    next: ['Video hosting and live classes', 'Migration of the legacy Chamilo content'],
    roles: ['student', 'lecturer'],
  },
  {
    n: 13,
    title: 'Hostel',
    purpose: 'Applications, allocation, maintenance and inspection.',
    status: 'planned',
    functions: [
      'Applications',
      'Room allocation',
      'Maintenance',
      'Payments',
      'Visitors',
      'Room inspection',
    ],
    next: [
      'The published fee schedule quotes student housing at USD 60–85 a month but the university has not described its housing stock. Rooms must be modelled before they can be allocated.',
    ],
    roles: ['student', 'student-affairs'],
  },
  {
    n: 14,
    title: 'Human Resources',
    purpose: 'Employees, contracts, payroll, leave, performance and promotion.',
    status: 'planned',
    functions: [
      'Employees and recruitment',
      'Contracts',
      'Payroll',
      'Leave',
      'Performance',
      'Promotion',
      'Training',
    ],
    next: [
      'Payroll holds salary and bank data and is the highest-risk module in this list. It should not be built until access control and audit logging are settled, and probably not before an external review.',
    ],
    roles: ['admin'],
  },
  {
    n: 15,
    title: 'Research Office',
    purpose: 'Projects, grants, publications, ethics and postgraduate supervision.',
    status: 'planned',
    functions: [
      'Projects and grants',
      'Publications and journals',
      'Ethics approval',
      'Conferences',
      'Postgraduate supervision',
      'Research repository',
    ],
    next: [
      'Ethics approval needs the procedure and the committee that grants it — recorded as missing in the Academic Catalog',
      'The six proposed journals need editors, boards and ISSNs before the module has anything to manage',
    ],
    roles: ['registrar', 'dean'],
  },
  {
    n: 16,
    title: 'Alumni',
    href: '/alumni',
    purpose: 'Graduation onward: employment, donations, mentorship and credentials.',
    status: 'partial',
    functions: [
      'Graduation records',
      'Employment',
      'Donations',
      'Mentorship',
      'Networking',
      'Certificates',
      'Transcript requests',
    ],
    working: ['Public alumni page', 'Credential verification'],
    next: ['The association itself has no constitution or officers yet — see the documents register'],
    roles: ['student'],
  },
  {
    n: 17,
    title: 'Chancellor and Vice Chancellor Dashboard',
    purpose: 'Real-time institutional statistics for the two executive offices.',
    status: 'planned',
    functions: [
      'Total students, admissions today, pending applications',
      'Revenue today, outstanding fees',
      'Graduation candidates',
      'Academic staff, international students, online students',
      'Campuses, research projects, publications',
    ],
    next: [
      'Every number on this dashboard must be a live count from the system. The figures in the specification are illustrative — 12,845 students, $14,280 revenue today — and must never be typed in as placeholders. A dashboard showing invented numbers to the Chancellor is worse than no dashboard, and the site already carries four unattributed statistics that need the same treatment.',
    ],
    roles: ['chancellor', 'vice-chancellor'],
  },
];

export const erpCounts = {
  total: erpModules.length,
  built: erpModules.filter((m) => m.status === 'built').length,
  partial: erpModules.filter((m) => m.status === 'partial').length,
  planned: erpModules.filter((m) => m.status === 'planned').length,
};
