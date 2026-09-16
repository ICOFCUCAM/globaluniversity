// ---------------------------------------------------------------------------
// GENERATED. Do not edit — run `npm run handbook`.
//
// Written by scripts/build-handbook.mjs from src/lib/roles.ts,
// src/lib/types.ts, src/lib/portalNav.tsx and docs/migrations/*.sql.
//
// This is the half of the ICOF Global University System Handbook that states
// FACTS ABOUT THE SYSTEM: who may do what, what each office is withheld, which
// screens each role is served, and every rule the database has been watched to
// enforce. None of it is written by hand, because a handbook that restates the
// matrix in prose is a second copy of the matrix — and the second copy is the
// one that goes wrong.
//
// The written half is src/content/systemHandbook.ts and cites this.
// ---------------------------------------------------------------------------

export interface RoleProfile {
  role: string;
  label: string;
  /** Position in the University's hierarchy, 1 = most senior. Null = outside it. */
  rank: number | null;
  capabilities: string[];
  /** What the offices beside this one may do, and it may not. */
  withheld: string[];
  screens: { title: string; items: string[] }[];
}

export interface EnforcedRules {
  migration: string;
  file: string;
  /** Each one printed by a proof that ran, refused something, and rolled back. */
  rules: string[];
}

export const GENERATED_ON = "2026-09-16";

export const ROLE_PROFILES: RoleProfile[] = [
  {
    "role": "superadmin",
    "label": "Superadministrator",
    "rank": null,
    "capabilities": [
      "apply",
      "upload-documents",
      "track-application",
      "verify-payment",
      "approve-refund",
      "generate-invoice",
      "manage-student-accounts",
      "admit-student",
      "decide-admission",
      "reject-application",
      "request-documents",
      "assign-programme",
      "create-student-record",
      "manage-course-offerings",
      "build-timetable",
      "manage-courses",
      "manage-academic-calendar",
      "manage-academic-structure",
      "schedule-examination",
      "publish-examination",
      "assign-proctor",
      "proctor-examination",
      "record-exam-incident",
      "control-exam-session",
      "terminate-examination",
      "mark-examination",
      "moderate-examination",
      "determine-misconduct",
      "sit-examination",
      "compose-social-post",
      "publish-social-post",
      "draft-appointment",
      "authorize-appointment",
      "issue-appointment-letter",
      "set-remuneration",
      "establish-national-administration",
      "lead-national-administration",
      "view-national-students",
      "recommend-national-staff",
      "view-national-finance",
      "administer-national-finance",
      "compose-correspondence",
      "prepare-correspondence",
      "authorize-correspondence",
      "issue-correspondence",
      "compose-announcement",
      "approve-announcement",
      "publish-announcement",
      "override-announcement-clearance",
      "approve-social-post",
      "connect-own-social",
      "recompute-gpa",
      "submit-results",
      "moderate-results",
      "approve-results",
      "publish-results",
      "issue-credential",
      "forward-credential",
      "set-admission-openings",
      "view-admitted-students",
      "approve-transfers",
      "monitor-progress",
      "view-registered-students",
      "change-own-password",
      "view-own-staff-record",
      "view-own-courses",
      "manage-question-bank",
      "draft-question-paper",
      "view-own-student-risk",
      "upload-grades",
      "take-attendance",
      "view-executive-dashboard",
      "view-all-faculties",
      "view-institutional-finance",
      "monitor-teaching",
      "department-reports",
      "process-applications",
      "defer-admission",
      "transfer-programme",
      "manage-library",
      "manage-hostel",
      "manage-student-welfare",
      "register-courses",
      "pay-fees",
      "view-results",
      "download-transcript",
      "access-lms",
      "publish-course-material",
      "studio-submit-lecture",
      "studio-upload-lecture",
      "studio-record-lecture",
      "studio-ai-transcribe",
      "studio-ai-refine",
      "studio-ai-translate",
      "studio-ai-generate-audio",
      "studio-ai-generate-revision",
      "studio-ai-generate-quiz",
      "studio-approve-content",
      "studio-replace-content",
      "studio-manage-ebooks",
      "confer-award",
      "set-fee-schedule",
      "confirm-financial-clearance",
      "handle-student-request",
      "erase-announcement",
      "assign-roles",
      "grant-studio-permission",
      "create-staff-account",
      "open-staff-record",
      "suspend-account",
      "reset-user-password",
      "validate-transcript-exception",
      "view-transcript-audit",
      "design-credentials",
      "publish-credential-template",
      "view-certificate-template",
      "authorise-certificate-reissue",
      "publish-without-senate",
      "revoke-credential",
      "amend-issued-credential",
      "create-credential-type",
      "connect-university-social",
      "delete-application",
      "transcribe-historical-record",
      "approve-credential-design",
      "configure-system",
      "manage-academic-session",
      "maintenance-mode",
      "export-data"
    ],
    "withheld": [],
    "screens": [
      {
        "title": "Dashboard",
        "items": [
          "Dashboard"
        ]
      },
      {
        "title": "Admissions",
        "items": [
          "Finance desk",
          "Registrar desk",
          "Admissions Office",
          "Admissions approval",
          "Enrolment",
          "Students"
        ]
      },
      {
        "title": "Academic",
        "items": [
          "Academic overview",
          "Schools & departments",
          "Programmes",
          "Curriculum builder",
          "Programme resources",
          "Course catalogue",
          "My courses",
          "Academic Studio",
          "Submissions",
          "Course offerings",
          "Rooms",
          "Academic calendar",
          "Course registration",
          "Academic records",
          "Graduation & awards",
          "Timetable",
          "Attendance",
          "Learning (LMS)"
        ]
      },
      {
        "title": "Teaching",
        "items": [
          "Lecturers",
          "Assignments",
          "Question papers",
          "Examiner console",
          "Examination office",
          "Question bank",
          "Grade book"
        ]
      },
      {
        "title": "Records",
        "items": [
          "Results",
          "Result approval",
          "Documents",
          "Student services",
          "Fees & receipts",
          "Fee schedules",
          "Refunds"
        ]
      },
      {
        "title": "Community",
        "items": [
          "Announcements",
          "Discussion forum",
          "Social command centre"
        ]
      },
      {
        "title": "Appointments & Correspondence",
        "items": [
          "Appointments",
          "Draft & submit",
          "Correspondence",
          "Publications"
        ]
      },
      {
        "title": "Insight",
        "items": [
          "Institutional analytics",
          "Student early warning",
          "System audit log"
        ]
      },
      {
        "title": "System",
        "items": [
          "Accounts",
          "Document templates",
          "Job descriptions",
          "Conditions of appointment",
          "Credentials",
          "Transcript",
          "Transcript audit",
          "Certificate audit",
          "My record",
          "Settings",
          "National Rectorate",
          "National staff",
          "National finance",
          "National Administrations",
          "Studio Control"
        ]
      }
    ]
  },
  {
    "role": "admin",
    "label": "System Administrator",
    "rank": null,
    "capabilities": [
      "apply",
      "upload-documents",
      "track-application",
      "verify-payment",
      "approve-refund",
      "generate-invoice",
      "manage-student-accounts",
      "admit-student",
      "decide-admission",
      "reject-application",
      "request-documents",
      "assign-programme",
      "create-student-record",
      "manage-course-offerings",
      "build-timetable",
      "manage-courses",
      "manage-academic-calendar",
      "manage-academic-structure",
      "schedule-examination",
      "publish-examination",
      "assign-proctor",
      "proctor-examination",
      "record-exam-incident",
      "control-exam-session",
      "terminate-examination",
      "mark-examination",
      "moderate-examination",
      "determine-misconduct",
      "sit-examination",
      "compose-social-post",
      "publish-social-post",
      "draft-appointment",
      "authorize-appointment",
      "issue-appointment-letter",
      "set-remuneration",
      "establish-national-administration",
      "lead-national-administration",
      "view-national-students",
      "recommend-national-staff",
      "view-national-finance",
      "administer-national-finance",
      "compose-correspondence",
      "prepare-correspondence",
      "authorize-correspondence",
      "issue-correspondence",
      "compose-announcement",
      "approve-announcement",
      "publish-announcement",
      "override-announcement-clearance",
      "approve-social-post",
      "connect-own-social",
      "recompute-gpa",
      "submit-results",
      "moderate-results",
      "approve-results",
      "publish-results",
      "issue-credential",
      "forward-credential",
      "set-admission-openings",
      "view-admitted-students",
      "approve-transfers",
      "monitor-progress",
      "view-registered-students",
      "change-own-password",
      "view-own-staff-record",
      "view-own-courses",
      "manage-question-bank",
      "draft-question-paper",
      "view-own-student-risk",
      "upload-grades",
      "take-attendance",
      "view-executive-dashboard",
      "view-all-faculties",
      "view-institutional-finance",
      "monitor-teaching",
      "department-reports",
      "process-applications",
      "defer-admission",
      "transfer-programme",
      "manage-library",
      "manage-hostel",
      "manage-student-welfare",
      "register-courses",
      "pay-fees",
      "view-results",
      "download-transcript",
      "access-lms",
      "publish-course-material",
      "studio-submit-lecture",
      "studio-upload-lecture",
      "studio-record-lecture",
      "studio-ai-transcribe",
      "studio-ai-refine",
      "studio-ai-translate",
      "studio-ai-generate-audio",
      "studio-ai-generate-revision",
      "studio-ai-generate-quiz",
      "studio-approve-content",
      "studio-replace-content",
      "studio-manage-ebooks",
      "confer-award",
      "set-fee-schedule",
      "confirm-financial-clearance",
      "handle-student-request"
    ],
    "withheld": [
      "approve-credential-design",
      "authorise-certificate-reissue",
      "grant-studio-permission",
      "open-staff-record",
      "validate-transcript-exception",
      "view-certificate-template",
      "view-transcript-audit"
    ],
    "screens": [
      {
        "title": "Dashboard",
        "items": [
          "Dashboard"
        ]
      },
      {
        "title": "Admissions",
        "items": [
          "Finance desk",
          "Registrar desk",
          "Admissions Office",
          "Enrolment",
          "Students"
        ]
      },
      {
        "title": "Academic",
        "items": [
          "Academic overview",
          "Schools & departments",
          "Programmes",
          "Curriculum builder",
          "Programme resources",
          "Course catalogue",
          "My courses",
          "Academic Studio",
          "Submissions",
          "Course offerings",
          "Rooms",
          "Academic calendar",
          "Course registration",
          "Academic records",
          "Graduation & awards",
          "Timetable",
          "Attendance",
          "Learning (LMS)"
        ]
      },
      {
        "title": "Teaching",
        "items": [
          "Lecturers",
          "Assignments",
          "Question papers",
          "Examiner console",
          "Examination office",
          "Question bank",
          "Grade book"
        ]
      },
      {
        "title": "Records",
        "items": [
          "Results",
          "Result approval",
          "Documents",
          "Student services",
          "Fees & receipts",
          "Fee schedules",
          "Refunds"
        ]
      },
      {
        "title": "Community",
        "items": [
          "Announcements",
          "Discussion forum",
          "Social command centre"
        ]
      },
      {
        "title": "Appointments & Correspondence",
        "items": [
          "Appointments",
          "Draft & submit",
          "Correspondence",
          "Publications"
        ]
      },
      {
        "title": "Insight",
        "items": [
          "Institutional analytics",
          "Student early warning",
          "System audit log"
        ]
      },
      {
        "title": "System",
        "items": [
          "Document templates",
          "Job descriptions",
          "Conditions of appointment",
          "Transcript",
          "My record",
          "Settings",
          "National staff"
        ]
      }
    ]
  },
  {
    "role": "chancellor",
    "label": "Chancellor",
    "rank": 1,
    "capabilities": [
      "compose-correspondence",
      "authorize-correspondence",
      "issue-correspondence",
      "view-admitted-students",
      "monitor-progress",
      "change-own-password",
      "view-own-staff-record",
      "view-executive-dashboard",
      "view-all-faculties",
      "view-institutional-finance",
      "confer-award"
    ],
    "withheld": [
      "admit-student",
      "approve-announcement",
      "approve-credential-design",
      "assign-programme",
      "authorise-certificate-reissue",
      "authorize-appointment",
      "compose-announcement",
      "create-student-record",
      "defer-admission",
      "department-reports",
      "draft-appointment",
      "forward-credential",
      "grant-studio-permission",
      "handle-student-request",
      "issue-appointment-letter",
      "issue-credential",
      "manage-academic-calendar",
      "manage-academic-structure",
      "open-staff-record",
      "override-announcement-clearance",
      "process-applications",
      "publish-announcement",
      "publish-results",
      "recompute-gpa",
      "reject-application",
      "request-documents",
      "set-admission-openings",
      "set-remuneration",
      "transfer-programme",
      "validate-transcript-exception",
      "view-certificate-template",
      "view-transcript-audit"
    ],
    "screens": [
      {
        "title": "Dashboard",
        "items": [
          "Dashboard"
        ]
      },
      {
        "title": "Academic",
        "items": [
          "Academic overview",
          "Schools & departments",
          "Programmes",
          "Programme resources",
          "Academic calendar",
          "Academic records",
          "Graduation & awards",
          "Timetable"
        ]
      },
      {
        "title": "Community",
        "items": [
          "Announcements",
          "Discussion forum"
        ]
      },
      {
        "title": "Appointments & Correspondence",
        "items": [
          "Appointments",
          "Correspondence",
          "Publications"
        ]
      },
      {
        "title": "Insight",
        "items": [
          "Institutional analytics"
        ]
      },
      {
        "title": "System",
        "items": [
          "Document templates",
          "Job descriptions",
          "Conditions of appointment",
          "My record",
          "Settings"
        ]
      }
    ]
  },
  {
    "role": "vice-chancellor",
    "label": "Vice Chancellor",
    "rank": 2,
    "capabilities": [
      "draft-appointment",
      "authorize-appointment",
      "issue-appointment-letter",
      "set-remuneration",
      "compose-correspondence",
      "authorize-correspondence",
      "issue-correspondence",
      "compose-announcement",
      "approve-announcement",
      "publish-announcement",
      "override-announcement-clearance",
      "issue-credential",
      "forward-credential",
      "view-admitted-students",
      "monitor-progress",
      "change-own-password",
      "view-own-staff-record",
      "view-executive-dashboard",
      "view-all-faculties",
      "view-institutional-finance",
      "department-reports",
      "confer-award",
      "grant-studio-permission",
      "open-staff-record",
      "validate-transcript-exception",
      "view-transcript-audit",
      "view-certificate-template",
      "authorise-certificate-reissue",
      "approve-credential-design"
    ],
    "withheld": [
      "admit-student",
      "approve-refund",
      "assign-programme",
      "confirm-financial-clearance",
      "create-student-record",
      "defer-admission",
      "generate-invoice",
      "handle-student-request",
      "manage-academic-calendar",
      "manage-academic-structure",
      "manage-student-accounts",
      "process-applications",
      "publish-results",
      "recompute-gpa",
      "reject-application",
      "request-documents",
      "set-admission-openings",
      "set-fee-schedule",
      "transfer-programme",
      "verify-payment"
    ],
    "screens": [
      {
        "title": "Dashboard",
        "items": [
          "Dashboard"
        ]
      },
      {
        "title": "Academic",
        "items": [
          "Academic overview",
          "Schools & departments",
          "Programmes",
          "Programme resources",
          "Academic calendar",
          "Academic records",
          "Graduation & awards",
          "Timetable"
        ]
      },
      {
        "title": "Community",
        "items": [
          "Announcements",
          "Discussion forum"
        ]
      },
      {
        "title": "Appointments & Correspondence",
        "items": [
          "Appointments",
          "Draft & submit",
          "Correspondence",
          "Publications"
        ]
      },
      {
        "title": "Insight",
        "items": [
          "Institutional analytics"
        ]
      },
      {
        "title": "System",
        "items": [
          "Document templates",
          "Job descriptions",
          "Conditions of appointment",
          "Credentials",
          "Transcript",
          "Transcript audit",
          "Certificate audit",
          "My record",
          "Settings",
          "National staff",
          "Studio Control"
        ]
      }
    ]
  },
  {
    "role": "registrar",
    "label": "Registrar Administrator",
    "rank": 3,
    "capabilities": [
      "admit-student",
      "reject-application",
      "request-documents",
      "assign-programme",
      "create-student-record",
      "manage-academic-calendar",
      "manage-academic-structure",
      "recompute-gpa",
      "publish-results",
      "issue-credential",
      "forward-credential",
      "set-admission-openings",
      "view-admitted-students",
      "change-own-password",
      "view-own-staff-record",
      "process-applications",
      "defer-admission",
      "transfer-programme",
      "confer-award",
      "handle-student-request",
      "open-staff-record",
      "approve-credential-design"
    ],
    "withheld": [
      "approve-announcement",
      "approve-refund",
      "authorise-certificate-reissue",
      "authorize-appointment",
      "authorize-correspondence",
      "compose-announcement",
      "compose-correspondence",
      "confirm-financial-clearance",
      "department-reports",
      "draft-appointment",
      "generate-invoice",
      "grant-studio-permission",
      "issue-appointment-letter",
      "issue-correspondence",
      "lead-national-administration",
      "manage-student-accounts",
      "monitor-progress",
      "override-announcement-clearance",
      "publish-announcement",
      "recommend-national-staff",
      "set-fee-schedule",
      "set-remuneration",
      "validate-transcript-exception",
      "verify-payment",
      "view-all-faculties",
      "view-certificate-template",
      "view-executive-dashboard",
      "view-institutional-finance",
      "view-national-finance",
      "view-national-students",
      "view-registered-students",
      "view-transcript-audit"
    ],
    "screens": [
      {
        "title": "Dashboard",
        "items": [
          "Dashboard"
        ]
      },
      {
        "title": "Admissions",
        "items": [
          "Registrar desk",
          "Enrolment",
          "Students"
        ]
      },
      {
        "title": "Academic",
        "items": [
          "Academic overview",
          "Schools & departments",
          "Programmes",
          "Curriculum builder",
          "Programme resources",
          "Course offerings",
          "Rooms",
          "Academic calendar",
          "Course registration",
          "Academic records",
          "Graduation & awards",
          "Timetable",
          "Attendance"
        ]
      },
      {
        "title": "Teaching",
        "items": [
          "Examination office"
        ]
      },
      {
        "title": "Records",
        "items": [
          "Result approval",
          "Student services"
        ]
      },
      {
        "title": "Community",
        "items": [
          "Announcements",
          "Discussion forum"
        ]
      },
      {
        "title": "Appointments & Correspondence",
        "items": [
          "Appointments",
          "Draft & submit",
          "Correspondence",
          "Publications"
        ]
      },
      {
        "title": "Insight",
        "items": [
          "Institutional analytics"
        ]
      },
      {
        "title": "System",
        "items": [
          "Credentials",
          "Transcript",
          "My record",
          "Settings",
          "National staff"
        ]
      }
    ]
  },
  {
    "role": "finance-director",
    "label": "Finance Director",
    "rank": 4,
    "capabilities": [
      "verify-payment",
      "approve-refund",
      "generate-invoice",
      "manage-student-accounts",
      "change-own-password",
      "view-own-staff-record",
      "view-institutional-finance",
      "set-fee-schedule",
      "confirm-financial-clearance",
      "handle-student-request"
    ],
    "withheld": [
      "admit-student",
      "approve-announcement",
      "approve-credential-design",
      "approve-results",
      "approve-transfers",
      "assign-programme",
      "authorise-certificate-reissue",
      "authorize-appointment",
      "authorize-correspondence",
      "compose-announcement",
      "compose-correspondence",
      "confer-award",
      "create-student-record",
      "defer-admission",
      "department-reports",
      "draft-appointment",
      "forward-credential",
      "grant-studio-permission",
      "issue-appointment-letter",
      "issue-correspondence",
      "issue-credential",
      "lead-national-administration",
      "manage-academic-calendar",
      "manage-academic-structure",
      "monitor-progress",
      "open-staff-record",
      "override-announcement-clearance",
      "process-applications",
      "publish-announcement",
      "publish-results",
      "recommend-national-staff",
      "recompute-gpa",
      "reject-application",
      "request-documents",
      "set-admission-openings",
      "set-remuneration",
      "transfer-programme",
      "validate-transcript-exception",
      "view-admitted-students",
      "view-all-faculties",
      "view-certificate-template",
      "view-executive-dashboard",
      "view-national-finance",
      "view-national-students",
      "view-registered-students",
      "view-transcript-audit"
    ],
    "screens": [
      {
        "title": "Dashboard",
        "items": [
          "Dashboard"
        ]
      },
      {
        "title": "Admissions",
        "items": [
          "Students"
        ]
      },
      {
        "title": "Records",
        "items": [
          "Student services",
          "Fees & receipts",
          "Fee schedules",
          "Refunds"
        ]
      },
      {
        "title": "Community",
        "items": [
          "Announcements",
          "Discussion forum"
        ]
      },
      {
        "title": "Insight",
        "items": [
          "Institutional analytics"
        ]
      },
      {
        "title": "System",
        "items": [
          "My record",
          "Settings",
          "National finance"
        ]
      }
    ]
  },
  {
    "role": "dean",
    "label": "Faculty Dean",
    "rank": 6,
    "capabilities": [
      "approve-results",
      "view-admitted-students",
      "approve-transfers",
      "monitor-progress",
      "change-own-password",
      "view-own-staff-record"
    ],
    "withheld": [
      "approve-refund",
      "authorize-correspondence",
      "compose-correspondence",
      "confirm-financial-clearance",
      "department-reports",
      "generate-invoice",
      "handle-student-request",
      "issue-correspondence",
      "lead-national-administration",
      "manage-course-offerings",
      "manage-courses",
      "manage-student-accounts",
      "moderate-results",
      "monitor-teaching",
      "publish-course-material",
      "recommend-national-staff",
      "set-fee-schedule",
      "verify-payment",
      "view-institutional-finance",
      "view-national-finance",
      "view-national-students",
      "view-registered-students"
    ],
    "screens": [
      {
        "title": "Dashboard",
        "items": [
          "Dashboard"
        ]
      },
      {
        "title": "Admissions",
        "items": [
          "Students"
        ]
      },
      {
        "title": "Academic",
        "items": [
          "Academic overview",
          "Schools & departments",
          "Programmes",
          "Curriculum builder",
          "Programme resources",
          "Course offerings",
          "Rooms",
          "Academic calendar",
          "Academic records",
          "Graduation & awards",
          "Timetable"
        ]
      },
      {
        "title": "Records",
        "items": [
          "Result approval"
        ]
      },
      {
        "title": "Community",
        "items": [
          "Announcements",
          "Discussion forum"
        ]
      },
      {
        "title": "Insight",
        "items": [
          "Institutional analytics"
        ]
      },
      {
        "title": "System",
        "items": [
          "My record",
          "Settings"
        ]
      }
    ]
  },
  {
    "role": "hod",
    "label": "Head of Department",
    "rank": 7,
    "capabilities": [
      "manage-course-offerings",
      "moderate-results",
      "view-admitted-students",
      "view-registered-students",
      "change-own-password",
      "view-own-staff-record",
      "monitor-teaching",
      "department-reports",
      "publish-course-material"
    ],
    "withheld": [
      "approve-results",
      "approve-transfers",
      "assign-proctor",
      "authorize-correspondence",
      "compose-correspondence",
      "control-exam-session",
      "issue-correspondence",
      "lead-national-administration",
      "manage-courses",
      "monitor-progress",
      "publish-examination",
      "recommend-national-staff",
      "schedule-examination",
      "terminate-examination",
      "view-national-finance",
      "view-national-students"
    ],
    "screens": [
      {
        "title": "Dashboard",
        "items": [
          "Dashboard"
        ]
      },
      {
        "title": "Academic",
        "items": [
          "Academic overview",
          "Schools & departments",
          "Programmes",
          "Curriculum builder",
          "Programme resources",
          "Submissions",
          "Course offerings",
          "Rooms",
          "Academic calendar",
          "Course registration",
          "Academic records",
          "Timetable"
        ]
      },
      {
        "title": "Teaching",
        "items": [
          "My students"
        ]
      },
      {
        "title": "Records",
        "items": [
          "Result approval"
        ]
      },
      {
        "title": "Community",
        "items": [
          "Announcements",
          "Discussion forum"
        ]
      },
      {
        "title": "System",
        "items": [
          "My record",
          "Settings"
        ]
      }
    ]
  },
  {
    "role": "programme-coordinator",
    "label": "Programme Coordinator",
    "rank": 8,
    "capabilities": [
      "manage-course-offerings",
      "manage-courses",
      "view-registered-students",
      "change-own-password",
      "view-own-staff-record",
      "monitor-teaching",
      "department-reports"
    ],
    "withheld": [
      "approve-results",
      "approve-transfers",
      "assign-proctor",
      "control-exam-session",
      "determine-misconduct",
      "moderate-examination",
      "moderate-results",
      "monitor-progress",
      "publish-course-material",
      "publish-examination",
      "schedule-examination",
      "terminate-examination",
      "view-admitted-students"
    ],
    "screens": [
      {
        "title": "Dashboard",
        "items": [
          "Dashboard"
        ]
      },
      {
        "title": "Academic",
        "items": [
          "Academic overview",
          "Schools & departments",
          "Programmes",
          "Curriculum builder",
          "Programme resources",
          "Course catalogue",
          "Course offerings",
          "Rooms",
          "Academic calendar",
          "Course registration",
          "Academic records",
          "Timetable"
        ]
      },
      {
        "title": "Teaching",
        "items": [
          "My students"
        ]
      },
      {
        "title": "Community",
        "items": [
          "Announcements",
          "Discussion forum"
        ]
      },
      {
        "title": "System",
        "items": [
          "My record",
          "Settings"
        ]
      }
    ]
  },
  {
    "role": "lecturer",
    "label": "Lecturer",
    "rank": 12,
    "capabilities": [
      "submit-results",
      "view-registered-students",
      "change-own-password",
      "view-own-staff-record",
      "view-own-courses",
      "manage-question-bank",
      "draft-question-paper",
      "view-own-student-risk",
      "upload-grades",
      "take-attendance",
      "access-lms",
      "publish-course-material",
      "studio-submit-lecture",
      "studio-upload-lecture",
      "studio-record-lecture",
      "studio-approve-content",
      "studio-replace-content"
    ],
    "withheld": [
      "approve-refund",
      "control-exam-session",
      "department-reports",
      "determine-misconduct",
      "generate-invoice",
      "manage-student-accounts",
      "mark-examination",
      "moderate-examination",
      "moderate-results",
      "proctor-examination",
      "record-exam-incident",
      "verify-payment"
    ],
    "screens": [
      {
        "title": "Dashboard",
        "items": [
          "Dashboard"
        ]
      },
      {
        "title": "Academic",
        "items": [
          "Programme resources",
          "My courses",
          "Academic Studio",
          "Submissions",
          "Timetable",
          "Attendance",
          "Learning (LMS)"
        ]
      },
      {
        "title": "Teaching",
        "items": [
          "My students",
          "Assignments",
          "Question papers",
          "Question bank",
          "Grade book"
        ]
      },
      {
        "title": "Records",
        "items": [
          "Results",
          "Result approval"
        ]
      },
      {
        "title": "Community",
        "items": [
          "Announcements",
          "Discussion forum"
        ]
      },
      {
        "title": "Insight",
        "items": [
          "Student early warning"
        ]
      },
      {
        "title": "System",
        "items": [
          "My record",
          "Settings"
        ]
      }
    ]
  },
  {
    "role": "finance",
    "label": "Finance Administrator",
    "rank": 14,
    "capabilities": [
      "verify-payment",
      "approve-refund",
      "generate-invoice",
      "manage-student-accounts",
      "change-own-password",
      "view-own-staff-record"
    ],
    "withheld": [
      "access-lms",
      "administer-national-finance",
      "admit-student",
      "defer-admission",
      "draft-question-paper",
      "manage-question-bank",
      "process-applications",
      "proctor-examination",
      "publish-course-material",
      "record-exam-incident",
      "reject-application",
      "request-documents",
      "studio-approve-content",
      "studio-record-lecture",
      "studio-replace-content",
      "studio-submit-lecture",
      "studio-upload-lecture",
      "submit-results",
      "take-attendance",
      "track-application",
      "upload-grades",
      "view-admitted-students",
      "view-national-finance",
      "view-national-students",
      "view-own-courses",
      "view-own-student-risk",
      "view-registered-students"
    ],
    "screens": [
      {
        "title": "Dashboard",
        "items": [
          "Dashboard"
        ]
      },
      {
        "title": "Admissions",
        "items": [
          "Finance desk",
          "Students"
        ]
      },
      {
        "title": "Records",
        "items": [
          "Fees & receipts",
          "Refunds"
        ]
      },
      {
        "title": "Community",
        "items": [
          "Announcements",
          "Discussion forum"
        ]
      },
      {
        "title": "System",
        "items": [
          "My record",
          "Settings"
        ]
      }
    ]
  },
  {
    "role": "admissions-officer",
    "label": "Admissions Officer",
    "rank": 16,
    "capabilities": [
      "track-application",
      "admit-student",
      "reject-application",
      "request-documents",
      "view-admitted-students",
      "change-own-password",
      "view-own-staff-record",
      "process-applications",
      "defer-admission"
    ],
    "withheld": [
      "administer-national-finance",
      "approve-refund",
      "generate-invoice",
      "handle-student-request",
      "manage-hostel",
      "manage-library",
      "manage-student-accounts",
      "manage-student-welfare",
      "studio-manage-ebooks",
      "verify-payment",
      "view-national-finance",
      "view-national-students",
      "view-registered-students"
    ],
    "screens": [
      {
        "title": "Dashboard",
        "items": [
          "Dashboard"
        ]
      },
      {
        "title": "Admissions",
        "items": [
          "Admissions Office",
          "Students"
        ]
      },
      {
        "title": "Community",
        "items": [
          "Announcements",
          "Discussion forum"
        ]
      },
      {
        "title": "System",
        "items": [
          "My record",
          "Settings"
        ]
      }
    ]
  },
  {
    "role": "library-staff",
    "label": "Library Staff",
    "rank": 17,
    "capabilities": [
      "view-registered-students",
      "change-own-password",
      "view-own-staff-record",
      "manage-library",
      "studio-manage-ebooks"
    ],
    "withheld": [
      "administer-national-finance",
      "admit-student",
      "defer-admission",
      "draft-appointment",
      "handle-student-request",
      "manage-hostel",
      "manage-student-welfare",
      "process-applications",
      "reject-application",
      "request-documents",
      "track-application",
      "view-admitted-students",
      "view-national-finance",
      "view-national-students"
    ],
    "screens": [
      {
        "title": "Dashboard",
        "items": [
          "Dashboard"
        ]
      },
      {
        "title": "Community",
        "items": [
          "Announcements",
          "Discussion forum"
        ]
      },
      {
        "title": "System",
        "items": [
          "My record",
          "Settings"
        ]
      }
    ]
  },
  {
    "role": "student-affairs",
    "label": "Student Affairs",
    "rank": 18,
    "capabilities": [
      "view-registered-students",
      "change-own-password",
      "view-own-staff-record",
      "manage-hostel",
      "manage-student-welfare",
      "handle-student-request"
    ],
    "withheld": [
      "admit-student",
      "create-student-record",
      "defer-admission",
      "draft-appointment",
      "manage-library",
      "prepare-correspondence",
      "process-applications",
      "reject-application",
      "request-documents",
      "set-remuneration",
      "studio-manage-ebooks",
      "track-application",
      "view-admitted-students"
    ],
    "screens": [
      {
        "title": "Dashboard",
        "items": [
          "Dashboard"
        ]
      },
      {
        "title": "Records",
        "items": [
          "Student services"
        ]
      },
      {
        "title": "Community",
        "items": [
          "Announcements",
          "Discussion forum"
        ]
      },
      {
        "title": "System",
        "items": [
          "My record",
          "Settings"
        ]
      }
    ]
  },
  {
    "role": "hr-officer",
    "label": "HR Officer",
    "rank": 19,
    "capabilities": [
      "draft-appointment",
      "change-own-password",
      "view-own-staff-record"
    ],
    "withheld": [
      "access-lms",
      "create-student-record",
      "download-transcript",
      "handle-student-request",
      "manage-hostel",
      "manage-library",
      "manage-student-welfare",
      "pay-fees",
      "prepare-correspondence",
      "register-courses",
      "set-remuneration",
      "sit-examination",
      "studio-manage-ebooks",
      "view-registered-students",
      "view-results"
    ],
    "screens": [
      {
        "title": "Dashboard",
        "items": [
          "Dashboard"
        ]
      },
      {
        "title": "Community",
        "items": [
          "Announcements",
          "Discussion forum"
        ]
      },
      {
        "title": "Appointments & Correspondence",
        "items": [
          "Appointments",
          "Draft & submit"
        ]
      },
      {
        "title": "System",
        "items": [
          "My record",
          "Settings",
          "National staff"
        ]
      }
    ]
  },
  {
    "role": "hr-administrator",
    "label": "HR Administrator",
    "rank": 20,
    "capabilities": [
      "create-student-record",
      "draft-appointment",
      "set-remuneration",
      "prepare-correspondence",
      "change-own-password",
      "view-own-staff-record"
    ],
    "withheld": [
      "access-lms",
      "apply",
      "download-transcript",
      "handle-student-request",
      "manage-hostel",
      "manage-student-welfare",
      "pay-fees",
      "register-courses",
      "sit-examination",
      "track-application",
      "upload-documents",
      "view-registered-students",
      "view-results"
    ],
    "screens": [
      {
        "title": "Dashboard",
        "items": [
          "Dashboard"
        ]
      },
      {
        "title": "Community",
        "items": [
          "Announcements",
          "Discussion forum"
        ]
      },
      {
        "title": "Appointments & Correspondence",
        "items": [
          "Appointments",
          "Draft & submit",
          "Correspondence"
        ]
      },
      {
        "title": "System",
        "items": [
          "My record",
          "Settings",
          "National staff"
        ]
      }
    ]
  },
  {
    "role": "national-rector",
    "label": "National Rector",
    "rank": 5,
    "capabilities": [
      "lead-national-administration",
      "view-national-students",
      "recommend-national-staff",
      "view-national-finance",
      "compose-correspondence",
      "authorize-correspondence",
      "issue-correspondence",
      "view-registered-students",
      "change-own-password",
      "view-own-staff-record"
    ],
    "withheld": [
      "admit-student",
      "approve-credential-design",
      "approve-refund",
      "approve-results",
      "approve-transfers",
      "assign-programme",
      "confer-award",
      "confirm-financial-clearance",
      "create-student-record",
      "defer-admission",
      "department-reports",
      "forward-credential",
      "generate-invoice",
      "handle-student-request",
      "issue-credential",
      "manage-academic-calendar",
      "manage-academic-structure",
      "manage-course-offerings",
      "manage-student-accounts",
      "moderate-results",
      "monitor-progress",
      "monitor-teaching",
      "open-staff-record",
      "process-applications",
      "publish-course-material",
      "publish-results",
      "recompute-gpa",
      "reject-application",
      "request-documents",
      "set-admission-openings",
      "set-fee-schedule",
      "transfer-programme",
      "verify-payment",
      "view-admitted-students",
      "view-institutional-finance"
    ],
    "screens": [
      {
        "title": "Dashboard",
        "items": [
          "Dashboard"
        ]
      },
      {
        "title": "Community",
        "items": [
          "Announcements",
          "Discussion forum"
        ]
      },
      {
        "title": "System",
        "items": [
          "My record",
          "Settings",
          "National Rectorate",
          "National staff",
          "National finance"
        ]
      }
    ]
  },
  {
    "role": "national-financial-secretary",
    "label": "National Financial Secretary",
    "rank": 15,
    "capabilities": [
      "view-national-students",
      "view-national-finance",
      "administer-national-finance",
      "change-own-password",
      "view-own-staff-record"
    ],
    "withheld": [
      "admit-student",
      "approve-refund",
      "defer-admission",
      "generate-invoice",
      "manage-library",
      "manage-student-accounts",
      "process-applications",
      "proctor-examination",
      "record-exam-incident",
      "reject-application",
      "request-documents",
      "studio-manage-ebooks",
      "track-application",
      "verify-payment",
      "view-admitted-students",
      "view-registered-students"
    ],
    "screens": [
      {
        "title": "Dashboard",
        "items": [
          "Dashboard"
        ]
      },
      {
        "title": "Community",
        "items": [
          "Announcements",
          "Discussion forum"
        ]
      },
      {
        "title": "System",
        "items": [
          "My record",
          "Settings",
          "National Rectorate",
          "National finance"
        ]
      }
    ]
  },
  {
    "role": "student",
    "label": "Student",
    "rank": 21,
    "capabilities": [
      "sit-examination",
      "change-own-password",
      "register-courses",
      "pay-fees",
      "view-results",
      "download-transcript",
      "access-lms"
    ],
    "withheld": [
      "apply",
      "create-student-record",
      "draft-appointment",
      "prepare-correspondence",
      "set-remuneration",
      "track-application",
      "upload-documents",
      "view-own-staff-record"
    ],
    "screens": [
      {
        "title": "Dashboard",
        "items": [
          "Dashboard"
        ]
      },
      {
        "title": "My academics",
        "items": [
          "My programme",
          "My courses",
          "Academic Studio",
          "Course registration",
          "My timetable",
          "Academic calendar",
          "Results",
          "Transcript",
          "Graduation"
        ]
      },
      {
        "title": "Learning",
        "items": [
          "Assessments",
          "Sit an examination",
          "Discussions"
        ]
      },
      {
        "title": "Finance",
        "items": [
          "Fees & payments"
        ]
      },
      {
        "title": "Documents",
        "items": [
          "My documents",
          "My credentials"
        ]
      },
      {
        "title": "Services",
        "items": [
          "Student services"
        ]
      },
      {
        "title": "Community",
        "items": [
          "Announcements"
        ]
      },
      {
        "title": "Profile",
        "items": [
          "My profile",
          "Account & security"
        ]
      }
    ]
  },
  {
    "role": "applicant",
    "label": "Applicant",
    "rank": 22,
    "capabilities": [
      "apply",
      "upload-documents",
      "track-application",
      "change-own-password"
    ],
    "withheld": [
      "access-lms",
      "create-student-record",
      "download-transcript",
      "draft-appointment",
      "pay-fees",
      "prepare-correspondence",
      "register-courses",
      "set-remuneration",
      "sit-examination",
      "view-own-staff-record",
      "view-results"
    ],
    "screens": []
  },
  {
    "role": "academic-office",
    "label": "Academic Office",
    "rank": null,
    "capabilities": [
      "admit-student",
      "decide-admission",
      "reject-application",
      "request-documents",
      "manage-course-offerings",
      "build-timetable",
      "manage-courses",
      "manage-academic-structure",
      "recompute-gpa",
      "publish-results",
      "issue-credential",
      "forward-credential",
      "set-admission-openings",
      "change-own-password",
      "view-own-staff-record",
      "publish-course-material",
      "studio-ai-transcribe",
      "studio-ai-refine",
      "studio-ai-translate",
      "studio-ai-generate-audio",
      "studio-ai-generate-revision",
      "studio-ai-generate-quiz",
      "studio-manage-ebooks",
      "handle-student-request",
      "open-staff-record",
      "approve-credential-design"
    ],
    "withheld": [
      "approve-announcement",
      "approve-refund",
      "approve-results",
      "approve-transfers",
      "assign-programme",
      "authorise-certificate-reissue",
      "authorize-appointment",
      "authorize-correspondence",
      "compose-announcement",
      "compose-correspondence",
      "confer-award",
      "confirm-financial-clearance",
      "create-student-record",
      "defer-admission",
      "department-reports",
      "draft-appointment",
      "generate-invoice",
      "grant-studio-permission",
      "issue-appointment-letter",
      "issue-correspondence",
      "lead-national-administration",
      "manage-academic-calendar",
      "manage-student-accounts",
      "monitor-progress",
      "override-announcement-clearance",
      "process-applications",
      "publish-announcement",
      "recommend-national-staff",
      "set-fee-schedule",
      "set-remuneration",
      "transfer-programme",
      "validate-transcript-exception",
      "verify-payment",
      "view-admitted-students",
      "view-all-faculties",
      "view-certificate-template",
      "view-executive-dashboard",
      "view-institutional-finance",
      "view-national-finance",
      "view-national-students",
      "view-registered-students",
      "view-transcript-audit"
    ],
    "screens": [
      {
        "title": "Dashboard",
        "items": [
          "Dashboard"
        ]
      },
      {
        "title": "Admissions",
        "items": [
          "Admissions approval"
        ]
      },
      {
        "title": "Academic",
        "items": [
          "Academic overview",
          "Schools & departments",
          "Programmes",
          "Curriculum builder",
          "Programme resources",
          "Course catalogue",
          "Submissions",
          "Course offerings",
          "Rooms",
          "Academic calendar",
          "Academic records",
          "Graduation & awards",
          "Timetable",
          "Attendance"
        ]
      },
      {
        "title": "Records",
        "items": [
          "Result approval",
          "Student services"
        ]
      },
      {
        "title": "Community",
        "items": [
          "Announcements",
          "Discussion forum"
        ]
      },
      {
        "title": "System",
        "items": [
          "Credentials",
          "Transcript",
          "My record",
          "Settings"
        ]
      }
    ]
  },
  {
    "role": "exam-officer",
    "label": "Examination Officer",
    "rank": 9,
    "capabilities": [
      "schedule-examination",
      "publish-examination",
      "assign-proctor",
      "control-exam-session",
      "terminate-examination",
      "view-registered-students",
      "change-own-password",
      "view-own-staff-record",
      "department-reports"
    ],
    "withheld": [
      "access-lms",
      "determine-misconduct",
      "manage-course-offerings",
      "manage-courses",
      "mark-examination",
      "moderate-examination",
      "moderate-results",
      "monitor-teaching",
      "proctor-examination",
      "publish-course-material",
      "record-exam-incident",
      "submit-results",
      "upload-grades",
      "view-admitted-students"
    ],
    "screens": [
      {
        "title": "Dashboard",
        "items": [
          "Dashboard"
        ]
      },
      {
        "title": "Teaching",
        "items": [
          "Examiner console",
          "Examination office"
        ]
      },
      {
        "title": "Community",
        "items": [
          "Announcements",
          "Discussion forum"
        ]
      },
      {
        "title": "System",
        "items": [
          "My record",
          "Settings"
        ]
      }
    ]
  },
  {
    "role": "examiner",
    "label": "Examiner",
    "rank": 11,
    "capabilities": [
      "proctor-examination",
      "record-exam-incident",
      "control-exam-session",
      "mark-examination",
      "submit-results",
      "view-registered-students",
      "change-own-password",
      "view-own-staff-record",
      "upload-grades",
      "access-lms"
    ],
    "withheld": [
      "assign-proctor",
      "department-reports",
      "determine-misconduct",
      "draft-question-paper",
      "manage-question-bank",
      "moderate-examination",
      "moderate-results",
      "publish-course-material",
      "publish-examination",
      "schedule-examination",
      "studio-approve-content",
      "studio-record-lecture",
      "studio-replace-content",
      "studio-submit-lecture",
      "studio-upload-lecture",
      "take-attendance",
      "terminate-examination",
      "view-own-courses",
      "view-own-student-risk"
    ],
    "screens": [
      {
        "title": "Dashboard",
        "items": [
          "Dashboard"
        ]
      },
      {
        "title": "Teaching",
        "items": [
          "Examiner console"
        ]
      },
      {
        "title": "Community",
        "items": [
          "Announcements",
          "Discussion forum"
        ]
      },
      {
        "title": "System",
        "items": [
          "My record",
          "Settings"
        ]
      }
    ]
  },
  {
    "role": "invigilator",
    "label": "Invigilator",
    "rank": 13,
    "capabilities": [
      "proctor-examination",
      "record-exam-incident",
      "change-own-password",
      "view-own-staff-record"
    ],
    "withheld": [
      "access-lms",
      "administer-national-finance",
      "approve-refund",
      "control-exam-session",
      "draft-question-paper",
      "generate-invoice",
      "manage-question-bank",
      "manage-student-accounts",
      "mark-examination",
      "publish-course-material",
      "studio-approve-content",
      "studio-record-lecture",
      "studio-replace-content",
      "studio-submit-lecture",
      "studio-upload-lecture",
      "submit-results",
      "take-attendance",
      "upload-grades",
      "verify-payment",
      "view-national-finance",
      "view-national-students",
      "view-own-courses",
      "view-own-student-risk",
      "view-registered-students"
    ],
    "screens": [
      {
        "title": "Dashboard",
        "items": [
          "Dashboard"
        ]
      },
      {
        "title": "Teaching",
        "items": [
          "Examiner console"
        ]
      },
      {
        "title": "Community",
        "items": [
          "Announcements",
          "Discussion forum"
        ]
      },
      {
        "title": "System",
        "items": [
          "My record",
          "Settings"
        ]
      }
    ]
  },
  {
    "role": "moderator",
    "label": "Moderator",
    "rank": 10,
    "capabilities": [
      "moderate-examination",
      "determine-misconduct",
      "moderate-results",
      "view-registered-students",
      "change-own-password",
      "view-own-staff-record",
      "department-reports"
    ],
    "withheld": [
      "access-lms",
      "assign-proctor",
      "control-exam-session",
      "draft-question-paper",
      "manage-course-offerings",
      "manage-courses",
      "manage-question-bank",
      "mark-examination",
      "monitor-teaching",
      "proctor-examination",
      "publish-course-material",
      "publish-examination",
      "record-exam-incident",
      "schedule-examination",
      "studio-approve-content",
      "studio-record-lecture",
      "studio-replace-content",
      "studio-submit-lecture",
      "studio-upload-lecture",
      "submit-results",
      "take-attendance",
      "terminate-examination",
      "upload-grades",
      "view-own-courses",
      "view-own-student-risk"
    ],
    "screens": [
      {
        "title": "Dashboard",
        "items": [
          "Dashboard"
        ]
      },
      {
        "title": "Teaching",
        "items": [
          "Examiner console",
          "Examination office"
        ]
      },
      {
        "title": "Community",
        "items": [
          "Announcements",
          "Discussion forum"
        ]
      },
      {
        "title": "System",
        "items": [
          "My record",
          "Settings"
        ]
      }
    ]
  }
];

export const CAPABILITY_HOLDERS: { capability: string; roles: string[] }[] =
  [
  {
    "capability": "access-lms",
    "roles": [
      "superadmin",
      "admin",
      "lecturer",
      "student",
      "examiner"
    ]
  },
  {
    "capability": "administer-national-finance",
    "roles": [
      "superadmin",
      "admin",
      "national-financial-secretary"
    ]
  },
  {
    "capability": "admit-student",
    "roles": [
      "superadmin",
      "admin",
      "registrar",
      "admissions-officer",
      "academic-office"
    ]
  },
  {
    "capability": "amend-issued-credential",
    "roles": [
      "superadmin"
    ]
  },
  {
    "capability": "apply",
    "roles": [
      "superadmin",
      "admin",
      "applicant"
    ]
  },
  {
    "capability": "approve-announcement",
    "roles": [
      "superadmin",
      "admin",
      "vice-chancellor"
    ]
  },
  {
    "capability": "approve-credential-design",
    "roles": [
      "superadmin",
      "vice-chancellor",
      "registrar",
      "academic-office"
    ]
  },
  {
    "capability": "approve-refund",
    "roles": [
      "superadmin",
      "admin",
      "finance-director",
      "finance"
    ]
  },
  {
    "capability": "approve-results",
    "roles": [
      "superadmin",
      "admin",
      "dean"
    ]
  },
  {
    "capability": "approve-social-post",
    "roles": [
      "superadmin",
      "admin"
    ]
  },
  {
    "capability": "approve-transfers",
    "roles": [
      "superadmin",
      "admin",
      "dean"
    ]
  },
  {
    "capability": "assign-proctor",
    "roles": [
      "superadmin",
      "admin",
      "exam-officer"
    ]
  },
  {
    "capability": "assign-programme",
    "roles": [
      "superadmin",
      "admin",
      "registrar"
    ]
  },
  {
    "capability": "assign-roles",
    "roles": [
      "superadmin"
    ]
  },
  {
    "capability": "authorise-certificate-reissue",
    "roles": [
      "superadmin",
      "vice-chancellor"
    ]
  },
  {
    "capability": "authorize-appointment",
    "roles": [
      "superadmin",
      "admin",
      "vice-chancellor"
    ]
  },
  {
    "capability": "authorize-correspondence",
    "roles": [
      "superadmin",
      "admin",
      "chancellor",
      "vice-chancellor",
      "national-rector"
    ]
  },
  {
    "capability": "build-timetable",
    "roles": [
      "superadmin",
      "admin",
      "academic-office"
    ]
  },
  {
    "capability": "change-own-password",
    "roles": [
      "superadmin",
      "admin",
      "chancellor",
      "vice-chancellor",
      "registrar",
      "finance-director",
      "dean",
      "hod",
      "programme-coordinator",
      "lecturer",
      "finance",
      "admissions-officer",
      "library-staff",
      "student-affairs",
      "hr-officer",
      "hr-administrator",
      "national-rector",
      "national-financial-secretary",
      "student",
      "applicant",
      "academic-office",
      "exam-officer",
      "examiner",
      "invigilator",
      "moderator"
    ]
  },
  {
    "capability": "compose-announcement",
    "roles": [
      "superadmin",
      "admin",
      "vice-chancellor"
    ]
  },
  {
    "capability": "compose-correspondence",
    "roles": [
      "superadmin",
      "admin",
      "chancellor",
      "vice-chancellor",
      "national-rector"
    ]
  },
  {
    "capability": "compose-social-post",
    "roles": [
      "superadmin",
      "admin"
    ]
  },
  {
    "capability": "confer-award",
    "roles": [
      "superadmin",
      "admin",
      "chancellor",
      "vice-chancellor",
      "registrar"
    ]
  },
  {
    "capability": "configure-system",
    "roles": [
      "superadmin"
    ]
  },
  {
    "capability": "confirm-financial-clearance",
    "roles": [
      "superadmin",
      "admin",
      "finance-director"
    ]
  },
  {
    "capability": "connect-own-social",
    "roles": [
      "superadmin",
      "admin"
    ]
  },
  {
    "capability": "connect-university-social",
    "roles": [
      "superadmin"
    ]
  },
  {
    "capability": "control-exam-session",
    "roles": [
      "superadmin",
      "admin",
      "exam-officer",
      "examiner"
    ]
  },
  {
    "capability": "create-credential-type",
    "roles": [
      "superadmin"
    ]
  },
  {
    "capability": "create-staff-account",
    "roles": [
      "superadmin"
    ]
  },
  {
    "capability": "create-student-record",
    "roles": [
      "superadmin",
      "admin",
      "registrar",
      "hr-administrator"
    ]
  },
  {
    "capability": "decide-admission",
    "roles": [
      "superadmin",
      "admin",
      "academic-office"
    ]
  },
  {
    "capability": "defer-admission",
    "roles": [
      "superadmin",
      "admin",
      "registrar",
      "admissions-officer"
    ]
  },
  {
    "capability": "delete-application",
    "roles": [
      "superadmin"
    ]
  },
  {
    "capability": "department-reports",
    "roles": [
      "superadmin",
      "admin",
      "vice-chancellor",
      "hod",
      "programme-coordinator",
      "exam-officer",
      "moderator"
    ]
  },
  {
    "capability": "design-credentials",
    "roles": [
      "superadmin"
    ]
  },
  {
    "capability": "determine-misconduct",
    "roles": [
      "superadmin",
      "admin",
      "moderator"
    ]
  },
  {
    "capability": "download-transcript",
    "roles": [
      "superadmin",
      "admin",
      "student"
    ]
  },
  {
    "capability": "draft-appointment",
    "roles": [
      "superadmin",
      "admin",
      "vice-chancellor",
      "hr-officer",
      "hr-administrator"
    ]
  },
  {
    "capability": "draft-question-paper",
    "roles": [
      "superadmin",
      "admin",
      "lecturer"
    ]
  },
  {
    "capability": "erase-announcement",
    "roles": [
      "superadmin"
    ]
  },
  {
    "capability": "establish-national-administration",
    "roles": [
      "superadmin",
      "admin"
    ]
  },
  {
    "capability": "export-data",
    "roles": [
      "superadmin"
    ]
  },
  {
    "capability": "forward-credential",
    "roles": [
      "superadmin",
      "admin",
      "vice-chancellor",
      "registrar",
      "academic-office"
    ]
  },
  {
    "capability": "generate-invoice",
    "roles": [
      "superadmin",
      "admin",
      "finance-director",
      "finance"
    ]
  },
  {
    "capability": "grant-studio-permission",
    "roles": [
      "superadmin",
      "vice-chancellor"
    ]
  },
  {
    "capability": "handle-student-request",
    "roles": [
      "superadmin",
      "admin",
      "registrar",
      "finance-director",
      "student-affairs",
      "academic-office"
    ]
  },
  {
    "capability": "issue-appointment-letter",
    "roles": [
      "superadmin",
      "admin",
      "vice-chancellor"
    ]
  },
  {
    "capability": "issue-correspondence",
    "roles": [
      "superadmin",
      "admin",
      "chancellor",
      "vice-chancellor",
      "national-rector"
    ]
  },
  {
    "capability": "issue-credential",
    "roles": [
      "superadmin",
      "admin",
      "vice-chancellor",
      "registrar",
      "academic-office"
    ]
  },
  {
    "capability": "lead-national-administration",
    "roles": [
      "superadmin",
      "admin",
      "national-rector"
    ]
  },
  {
    "capability": "maintenance-mode",
    "roles": [
      "superadmin"
    ]
  },
  {
    "capability": "manage-academic-calendar",
    "roles": [
      "superadmin",
      "admin",
      "registrar"
    ]
  },
  {
    "capability": "manage-academic-session",
    "roles": [
      "superadmin"
    ]
  },
  {
    "capability": "manage-academic-structure",
    "roles": [
      "superadmin",
      "admin",
      "registrar",
      "academic-office"
    ]
  },
  {
    "capability": "manage-course-offerings",
    "roles": [
      "superadmin",
      "admin",
      "hod",
      "programme-coordinator",
      "academic-office"
    ]
  },
  {
    "capability": "manage-courses",
    "roles": [
      "superadmin",
      "admin",
      "programme-coordinator",
      "academic-office"
    ]
  },
  {
    "capability": "manage-hostel",
    "roles": [
      "superadmin",
      "admin",
      "student-affairs"
    ]
  },
  {
    "capability": "manage-library",
    "roles": [
      "superadmin",
      "admin",
      "library-staff"
    ]
  },
  {
    "capability": "manage-question-bank",
    "roles": [
      "superadmin",
      "admin",
      "lecturer"
    ]
  },
  {
    "capability": "manage-student-accounts",
    "roles": [
      "superadmin",
      "admin",
      "finance-director",
      "finance"
    ]
  },
  {
    "capability": "manage-student-welfare",
    "roles": [
      "superadmin",
      "admin",
      "student-affairs"
    ]
  },
  {
    "capability": "mark-examination",
    "roles": [
      "superadmin",
      "admin",
      "examiner"
    ]
  },
  {
    "capability": "moderate-examination",
    "roles": [
      "superadmin",
      "admin",
      "moderator"
    ]
  },
  {
    "capability": "moderate-results",
    "roles": [
      "superadmin",
      "admin",
      "hod",
      "moderator"
    ]
  },
  {
    "capability": "monitor-progress",
    "roles": [
      "superadmin",
      "admin",
      "chancellor",
      "vice-chancellor",
      "dean"
    ]
  },
  {
    "capability": "monitor-teaching",
    "roles": [
      "superadmin",
      "admin",
      "hod",
      "programme-coordinator"
    ]
  },
  {
    "capability": "open-staff-record",
    "roles": [
      "superadmin",
      "vice-chancellor",
      "registrar",
      "academic-office"
    ]
  },
  {
    "capability": "override-announcement-clearance",
    "roles": [
      "superadmin",
      "admin",
      "vice-chancellor"
    ]
  },
  {
    "capability": "pay-fees",
    "roles": [
      "superadmin",
      "admin",
      "student"
    ]
  },
  {
    "capability": "prepare-correspondence",
    "roles": [
      "superadmin",
      "admin",
      "hr-administrator"
    ]
  },
  {
    "capability": "process-applications",
    "roles": [
      "superadmin",
      "admin",
      "registrar",
      "admissions-officer"
    ]
  },
  {
    "capability": "proctor-examination",
    "roles": [
      "superadmin",
      "admin",
      "examiner",
      "invigilator"
    ]
  },
  {
    "capability": "publish-announcement",
    "roles": [
      "superadmin",
      "admin",
      "vice-chancellor"
    ]
  },
  {
    "capability": "publish-course-material",
    "roles": [
      "superadmin",
      "admin",
      "hod",
      "lecturer",
      "academic-office"
    ]
  },
  {
    "capability": "publish-credential-template",
    "roles": [
      "superadmin"
    ]
  },
  {
    "capability": "publish-examination",
    "roles": [
      "superadmin",
      "admin",
      "exam-officer"
    ]
  },
  {
    "capability": "publish-results",
    "roles": [
      "superadmin",
      "admin",
      "registrar",
      "academic-office"
    ]
  },
  {
    "capability": "publish-social-post",
    "roles": [
      "superadmin",
      "admin"
    ]
  },
  {
    "capability": "publish-without-senate",
    "roles": [
      "superadmin"
    ]
  },
  {
    "capability": "recommend-national-staff",
    "roles": [
      "superadmin",
      "admin",
      "national-rector"
    ]
  },
  {
    "capability": "recompute-gpa",
    "roles": [
      "superadmin",
      "admin",
      "registrar",
      "academic-office"
    ]
  },
  {
    "capability": "record-exam-incident",
    "roles": [
      "superadmin",
      "admin",
      "examiner",
      "invigilator"
    ]
  },
  {
    "capability": "register-courses",
    "roles": [
      "superadmin",
      "admin",
      "student"
    ]
  },
  {
    "capability": "reject-application",
    "roles": [
      "superadmin",
      "admin",
      "registrar",
      "admissions-officer",
      "academic-office"
    ]
  },
  {
    "capability": "request-documents",
    "roles": [
      "superadmin",
      "admin",
      "registrar",
      "admissions-officer",
      "academic-office"
    ]
  },
  {
    "capability": "reset-user-password",
    "roles": [
      "superadmin"
    ]
  },
  {
    "capability": "revoke-credential",
    "roles": [
      "superadmin"
    ]
  },
  {
    "capability": "schedule-examination",
    "roles": [
      "superadmin",
      "admin",
      "exam-officer"
    ]
  },
  {
    "capability": "set-admission-openings",
    "roles": [
      "superadmin",
      "admin",
      "registrar",
      "academic-office"
    ]
  },
  {
    "capability": "set-fee-schedule",
    "roles": [
      "superadmin",
      "admin",
      "finance-director"
    ]
  },
  {
    "capability": "set-remuneration",
    "roles": [
      "superadmin",
      "admin",
      "vice-chancellor",
      "hr-administrator"
    ]
  },
  {
    "capability": "sit-examination",
    "roles": [
      "superadmin",
      "admin",
      "student"
    ]
  },
  {
    "capability": "studio-ai-generate-audio",
    "roles": [
      "superadmin",
      "admin",
      "academic-office"
    ]
  },
  {
    "capability": "studio-ai-generate-quiz",
    "roles": [
      "superadmin",
      "admin",
      "academic-office"
    ]
  },
  {
    "capability": "studio-ai-generate-revision",
    "roles": [
      "superadmin",
      "admin",
      "academic-office"
    ]
  },
  {
    "capability": "studio-ai-refine",
    "roles": [
      "superadmin",
      "admin",
      "academic-office"
    ]
  },
  {
    "capability": "studio-ai-transcribe",
    "roles": [
      "superadmin",
      "admin",
      "academic-office"
    ]
  },
  {
    "capability": "studio-ai-translate",
    "roles": [
      "superadmin",
      "admin",
      "academic-office"
    ]
  },
  {
    "capability": "studio-approve-content",
    "roles": [
      "superadmin",
      "admin",
      "lecturer"
    ]
  },
  {
    "capability": "studio-manage-ebooks",
    "roles": [
      "superadmin",
      "admin",
      "library-staff",
      "academic-office"
    ]
  },
  {
    "capability": "studio-record-lecture",
    "roles": [
      "superadmin",
      "admin",
      "lecturer"
    ]
  },
  {
    "capability": "studio-replace-content",
    "roles": [
      "superadmin",
      "admin",
      "lecturer"
    ]
  },
  {
    "capability": "studio-submit-lecture",
    "roles": [
      "superadmin",
      "admin",
      "lecturer"
    ]
  },
  {
    "capability": "studio-upload-lecture",
    "roles": [
      "superadmin",
      "admin",
      "lecturer"
    ]
  },
  {
    "capability": "submit-results",
    "roles": [
      "superadmin",
      "admin",
      "lecturer",
      "examiner"
    ]
  },
  {
    "capability": "suspend-account",
    "roles": [
      "superadmin"
    ]
  },
  {
    "capability": "take-attendance",
    "roles": [
      "superadmin",
      "admin",
      "lecturer"
    ]
  },
  {
    "capability": "terminate-examination",
    "roles": [
      "superadmin",
      "admin",
      "exam-officer"
    ]
  },
  {
    "capability": "track-application",
    "roles": [
      "superadmin",
      "admin",
      "admissions-officer",
      "applicant"
    ]
  },
  {
    "capability": "transcribe-historical-record",
    "roles": [
      "superadmin"
    ]
  },
  {
    "capability": "transfer-programme",
    "roles": [
      "superadmin",
      "admin",
      "registrar"
    ]
  },
  {
    "capability": "upload-documents",
    "roles": [
      "superadmin",
      "admin",
      "applicant"
    ]
  },
  {
    "capability": "upload-grades",
    "roles": [
      "superadmin",
      "admin",
      "lecturer",
      "examiner"
    ]
  },
  {
    "capability": "validate-transcript-exception",
    "roles": [
      "superadmin",
      "vice-chancellor"
    ]
  },
  {
    "capability": "verify-payment",
    "roles": [
      "superadmin",
      "admin",
      "finance-director",
      "finance"
    ]
  },
  {
    "capability": "view-admitted-students",
    "roles": [
      "superadmin",
      "admin",
      "chancellor",
      "vice-chancellor",
      "registrar",
      "dean",
      "hod",
      "admissions-officer"
    ]
  },
  {
    "capability": "view-all-faculties",
    "roles": [
      "superadmin",
      "admin",
      "chancellor",
      "vice-chancellor"
    ]
  },
  {
    "capability": "view-certificate-template",
    "roles": [
      "superadmin",
      "vice-chancellor"
    ]
  },
  {
    "capability": "view-executive-dashboard",
    "roles": [
      "superadmin",
      "admin",
      "chancellor",
      "vice-chancellor"
    ]
  },
  {
    "capability": "view-institutional-finance",
    "roles": [
      "superadmin",
      "admin",
      "chancellor",
      "vice-chancellor",
      "finance-director"
    ]
  },
  {
    "capability": "view-national-finance",
    "roles": [
      "superadmin",
      "admin",
      "national-rector",
      "national-financial-secretary"
    ]
  },
  {
    "capability": "view-national-students",
    "roles": [
      "superadmin",
      "admin",
      "national-rector",
      "national-financial-secretary"
    ]
  },
  {
    "capability": "view-own-courses",
    "roles": [
      "superadmin",
      "admin",
      "lecturer"
    ]
  },
  {
    "capability": "view-own-staff-record",
    "roles": [
      "superadmin",
      "admin",
      "chancellor",
      "vice-chancellor",
      "registrar",
      "finance-director",
      "dean",
      "hod",
      "programme-coordinator",
      "lecturer",
      "finance",
      "admissions-officer",
      "library-staff",
      "student-affairs",
      "hr-officer",
      "hr-administrator",
      "national-rector",
      "national-financial-secretary",
      "academic-office",
      "exam-officer",
      "examiner",
      "invigilator",
      "moderator"
    ]
  },
  {
    "capability": "view-own-student-risk",
    "roles": [
      "superadmin",
      "admin",
      "lecturer"
    ]
  },
  {
    "capability": "view-registered-students",
    "roles": [
      "superadmin",
      "admin",
      "hod",
      "programme-coordinator",
      "lecturer",
      "library-staff",
      "student-affairs",
      "national-rector",
      "exam-officer",
      "examiner",
      "moderator"
    ]
  },
  {
    "capability": "view-results",
    "roles": [
      "superadmin",
      "admin",
      "student"
    ]
  },
  {
    "capability": "view-transcript-audit",
    "roles": [
      "superadmin",
      "vice-chancellor"
    ]
  }
];

/** Held by the Vice-Chancellor and the Superadministrator and by nobody else. */
export const RESTRICTED_TO_THE_TWO: string[] = [
  "amend-issued-credential",
  "assign-roles",
  "authorise-certificate-reissue",
  "configure-system",
  "connect-university-social",
  "create-credential-type",
  "create-staff-account",
  "delete-application",
  "design-credentials",
  "erase-announcement",
  "export-data",
  "grant-studio-permission",
  "maintenance-mode",
  "manage-academic-session",
  "publish-credential-template",
  "publish-without-senate",
  "reset-user-password",
  "revoke-credential",
  "suspend-account",
  "transcribe-historical-record",
  "validate-transcript-exception",
  "view-certificate-template",
  "view-transcript-audit"
];

export const ENFORCED: EnforcedRules[] = [
  {
    "migration": "019",
    "file": "019_academic_record.sql",
    "rules": [
      "— standing is append-only, an accepted credit names its decider, a conferral cannot precede the Senate, a refusal states its reason, the policy cannot claim an unrecorded ruling, and study mode is a closed list."
    ]
  },
  {
    "migration": "020",
    "file": "020_signature_void_and_grading.sql",
    "rules": [
      "— a published scale cannot be edited, the University cannot hold two active scales, an empty scale is refused, voiding requires a stated reason and a named author, and 'voided' is an auditable action."
    ]
  },
  {
    "migration": "021",
    "file": "021_signing_key_in_the_store.sql",
    "rules": [
      "— a signing key may be stored, an unknown kind may not, and a private key written in plaintext is still refused."
    ]
  },
  {
    "migration": "022",
    "file": "022_publication_under_own_authority.sql",
    "rules": [
      "— the Senate is still required, an override still needs a reason in writing, and a real override publishes and is stamped by the database."
    ]
  },
  {
    "migration": "023",
    "file": "023_programme_application_approval.sql",
    "rules": [
      "— the seed opens nothing, the trail accepts a decision, and it refuses to have one rewritten or removed."
    ]
  },
  {
    "migration": "024",
    "file": "024_admission_decision_authority.sql",
    "rules": [
      "— a decision is recorded and cannot be rewritten, an override must say why, and two student numbers reserved in succession differ."
    ]
  },
  {
    "migration": "025",
    "file": "025_state_vocabulary_and_authority.sql",
    "rules": [
      "— a state code cannot be renamed, deleted or invented, its label can be reworded, and the audit log records the office as well as the person."
    ]
  },
  {
    "migration": "026",
    "file": "026_issuance_is_not_the_decision.sql",
    "rules": [
      "— a failed issuance is its own state, the decision survives it, a retry does not re-decide, and the vocabulary is still locked."
    ]
  },
  {
    "migration": "027",
    "file": "027_the_states_the_pipeline_already_wrote.sql",
    "rules": [
      "— the three states the pipeline writes are declared, the two refusals stay distinguishable, an undeclared status is visible, and the vocabulary is still locked."
    ]
  },
  {
    "migration": "028",
    "file": "028_student_numbers_start_above_the_existing_ones.sql",
    "rules": [
      "— a reserved number starts above every number already issued, keeps counting, catches up when the counter has drifted, and ignores legacy numbers in other shapes."
    ]
  },
  {
    "migration": "029",
    "file": "029_the_coverage_view_is_for_operators_only.sql",
    "rules": [
      "— the coverage view is readable by the service role and by nobody else, and candidates can still read their own sitting."
    ]
  },
  {
    "migration": "030",
    "file": "030_functions_pin_their_search_path.sql",
    "rules": [
      "— every function pins its search path, the number reserver is the server's alone, auth_role() is untouched, and the guards still refuse."
    ]
  },
  {
    "migration": "031",
    "file": "031_the_letters_the_university_has_issued.sql",
    "rules": [
      "— a letter survives a failed delivery, is findable as undelivered, counts its attempts, refuses an unknown delivery state, and is not on the API."
    ]
  },
  {
    "migration": "032",
    "file": "032_forwarding_and_returning.sql",
    "rules": [
      "— an application can be forwarded for an academic decision, returned to a named office with a reason, and neither movement can name an office that does not exist."
    ]
  },
  {
    "migration": "033",
    "file": "033_reevaluation.sql",
    "rules": [
      "— a decided application can be put back on the desk with a reason, the decision already taken is untouched, and a second decision sits beside the first rather than over it."
    ]
  },
  {
    "migration": "034",
    "file": "034_enrolment_and_withdrawal.sql",
    "rules": [
      "— an issued admission can be enrolled with a date, an applicant can withdraw without being recorded as refused, and both say what they moved from."
    ]
  },
  {
    "migration": "064",
    "file": "064_the_rooms_to_start_from.sql",
    "rules": [
      "— 17 provisional rooms (9 Buea, 5 Douala, 3 online); none claims a capacity; re-running does not overwrite a corrected room; zero-capacity and duplicate codes are still refused."
    ]
  },
  {
    "migration": "065",
    "file": "065_the_year_that_cannot_lie.sql",
    "rules": [
      "— the current year is derived from the dates and ignores a stale status; drift is reported; rolling the year over corrects it without ever putting two years in charge at once."
    ]
  },
  {
    "migration": "066",
    "file": "066_when_registration_is_open.sql",
    "rules": [
      "— a term with no window recorded is OPEN, a recorded window opens and closes on its dates, a window outside its own semester is refused, a term cannot have two, and a registration can record that it was late."
    ]
  },
  {
    "migration": "067",
    "file": "067_one_student_one_record.sql",
    "rules": [
      "— a student's whole curriculum is visible including what they have not reached; the curriculum's credit governs over the catalogue's; an unapproved mark is not a pass; and a term counts the courses taken in it."
    ]
  },
  {
    "migration": "068",
    "file": "068_the_course_as_a_place_to_learn.sql",
    "rules": [
      "— materials key to a course by foreign key, a term's material cannot land on another course, a material with nothing in it is refused, and deleting a term releases its materials to the course rather than destroying them."
    ]
  },
  {
    "migration": "069",
    "file": "069_the_end_of_the_chain.sql",
    "rules": [
      "— every candidate carries their award's own requirement, a degree cannot be conferred before the Senate resolved, the same award cannot be conferred twice, and a conferral made despite an unmet requirement records the reason in words."
    ]
  },
  {
    "migration": "070",
    "file": "070_where_the_student_stands.sql",
    "rules": [
      "— the stage is decided once and reads correctly at every turn of the journey; a conferral overrules a withdrawal; an applicant is not a student; and all three views return nothing at all to nobody."
    ]
  },
  {
    "migration": "071",
    "file": "071_what_the_student_is_owed.sql",
    "rules": [
      "— a draft mark stays with the lecturer, a submitted one reaches the student marked provisional and named to the desk holding it, an approved one is official; an unreadable due date loses no other row; a draft examination is not announced; and all four views return nothing at all to nobody."
    ]
  },
  {
    "migration": "072",
    "file": "072_the_numbers_to_start_from.sql",
    "rules": [
      "— every teaching room has a starting capacity and every online room still has none; every programme has a credit total and the Bachelor's 180 is untouched; and a figure the University has corrected survives this migration being run again."
    ]
  },
  {
    "migration": "073",
    "file": "073_asking_the_university_for_something.sql",
    "rules": [
      "— a request cannot be made without enough to act on, cannot be declined without a reason, and cannot be completed without ever being decided; a transcript request is refused here because it already has a home; and an announcement with no target is still university-wide."
    ]
  },
  {
    "migration": "074",
    "file": "074_connecting_what_was_already_there.sql",
    "rules": [
      "— six views over rows that were already here and connected to nothing; each returns the student their own rows and another account none of them; a notice reaches them for their own course and not for one they are not on, and never if its audience is staff; financial clearance is reported as unknown rather than ticked; not one of them can be written through; and all three request pipelines are still their own."
    ]
  },
  {
    "migration": "075",
    "file": "075_what_a_student_is_charged.sql",
    "rules": [
      "— a schedule is not chargeable until somebody publishes it under their own name; the narrowest one wins; an invoice already raised does not move when the schedule does; nothing is waived or cleared or refused without a reason; a payment in one currency never touches a balance in another; a student who has never been charged is not reported as paid up; and one clearance stands at a time."
    ]
  },
  {
    "migration": "076",
    "file": "076_one_transcript_one_download.sql",
    "rules": [
      "— a transcript nobody has issued cannot be downloaded; the one granted download is released once and the second attempt is refused, told how to get another, and does not move the counter; the counter cannot be pushed past its allowance even by a direct write; one student cannot claim another's; a fresh request grants a fresh download; and Finance's decision now reaches the graduation audit."
    ]
  },
  {
    "migration": "077",
    "file": "077_a_mark_is_moderated_before_anybody_sees_it.sql",
    "rules": [
      "— a mark nobody has checked does not reach the student: a draft is invisible and so is a submitted one. A moderated mark reaches them as provisional, named to the desk holding it, counting towards no GPA; an approved one is the official result; and the views return nothing at all to nobody."
    ]
  },
  {
    "migration": "097",
    "file": "097_a_nation_the_university_can_see.sql",
    "rules": [
      "the two national roles are accepted by profiles_role_valid",
      "a country can be written down before its agreement exists",
      "and refuses to be established without an agreement and a Rector",
      "…and not without the appointment the Rector holds",
      "with both in place it establishes",
      "whoever creates an administration may not be its Rector",
      "a country has one live administration, case and spacing aside",
      "a Rector reads their own nation's students and not the other's",
      "a national officer cannot move a student to another nation",
      "…and the centre can",
      "a Rector reads their nation's students and writes to none of them"
    ]
  },
  {
    "migration": "098",
    "file": "098_what_the_nation_keeps.sql",
    "rules": [
      "with no agreement in force the whole payment stays with the centre",
      "a Rector cannot approve the agreement that pays their own nation",
      "tuition splits by the agreement in force",
      "registration is the centre's even under a 70% agreement",
      "an allocation cannot be rewritten",
      "an allocation whose halves do not make the whole is refused",
      "the ledger is the allocations and agrees with them"
    ]
  },
  {
    "migration": "099",
    "file": "099_recommending_and_spending.sql",
    "rules": [
      "a recommendation creates no appointment and binds nobody",
      "a Rector cannot decide their own recommendation",
      "…and the University can",
      "declining a recommendation requires a reason the Rector can read",
      "the Financial Secretary can record an expense before it is authorised",
      "a nation cannot authorise what it was never allocated",
      "the purse is what 098 allocated — 500 of 1000 at 50%",
      "whoever records an expense may not authorise it",
      "authorising it leaves 200 of the 500 available",
      "and it cannot authorise 250 with 200 left",
      "a Financial Secretary reads their own nation's expenses"
    ]
  },
  {
    "migration": "100",
    "file": "100_the_transcript_is_issued_to_a_student_we_have.sql",
    "rules": [
      "a transcript cannot be generated for somebody who is not in the register",
      "a transcript names the office that issued it, never \"system\"",
      "a National Rector has no transcript issuance authority",
      "the first transcript for a student is version 1",
      "the generation date is the system's and nobody typed it",
      "generating again is version 2 and the first one is still there",
      "a caller cannot choose its own version number",
      "a generation record can be neither edited nor deleted",
      "an exceptional transcript waits for the validation",
      "only the Vice-Chancellor or the Superadministrator validates, and never the officer who asked",
      "…and the Vice-Chancellor can",
      "an approval covers the student it was given for",
      "and after validation the exceptional transcript is generated",
      "a delivery learns its outcome and nothing else",
      "the audit shows the path taken and whether it was afterwards sent",
      "the Vice-Chancellor reads every transcript ever generated (%)",
      "…and a lecturer reads none of them"
    ]
  },
  {
    "migration": "101",
    "file": "101_the_certificate_design_is_not_everybodys.sql",
    "rules": [
      "the Registrar receives no certificate-template data at all",
      "…and neither does the Director of Academic Affairs",
      "the Vice-Chancellor and the Superadministrator each see all % of them",
      "an express, expiring authorisation from the Vice-Chancellor opens it",
      "a grant that did not come from above opens nothing",
      "the transcript design is untouched and the Registrar still reads it",
      "a replacement certificate is authorised only from above, and being lent the design is not that",
      "…and not issued before it is",
      "one certificate has at most one live authorisation to replace it",
      "the Vice-Chancellor can read the certificate audit trail at last",
      "the audit distinguishes a replacement from an ordinary issue"
    ]
  },
  {
    "migration": "102",
    "file": "102_a_refund_is_not_an_edit.sql",
    "rules": [
      "a payment cannot be edited, not even by the owner of the table",
      "…and cannot be deleted either",
      "the determination is computed from the payment and the enrolment date, and a form cannot supply it",
      "where the published schedule and the 16 September decision disagree, the request says so on its face",
      "…and the University can read every such case in one view",
      "a request cannot jump from submitted to paid",
      "an approval above the determination is refused",
      "…and allowed where an exceptional policy is named and authorised",
      "the determination cannot be rewritten after the answer is known",
      "no cash or cheque refund is accepted",
      "a paid refund is finished; a further refund is a further request",
      "only one refund per student per month is considered",
      "a student whose studies never started is refunded in full, and the two rules agree",
      "a lecturer reads no refund at all",
      "…and the Finance Director reads all of them"
    ]
  },
  {
    "migration": "103",
    "file": "103_the_nation_has_offices_too.sql",
    "rules": [
      "% now admits the national family",
      "the national family job description is seeded, as a draft",
      "the National Rector's job description is seeded, as a draft",
      "the National Financial Secretary's job description is seeded, as a draft",
      "the national family has conditions of appointment, copied from the executive set the University has in force",
      "the National Rector and the National Financial Secretary are posts",
      "the Chancellor is a post too, inheriting the executive family's description and carrying no invented duties",
      "…in a family of their own, not borrowed from the executive",
      "a misspelt family is still refused",
      "every national job description is a draft and can reach nobody",
      "a national post inherits the University's common clauses and adds the office's own",
      "every post in the register still has conditions of appointment and a place of duty, the three new ones included",
      "…and a National Rector is not posted to the central campus"
    ]
  }
];

export const COUNTS = {
  roles: 25,
  capabilities: 129,
  migrations: 0,
  provedRules: 115,
};
