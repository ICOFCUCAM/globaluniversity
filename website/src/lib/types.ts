// ============================================
// University Management System - Type Definitions
// ============================================

// 'finance' and 'registrar' are the two admissions desks. They are separate
// roles rather than flavours of 'admin' because the whole control in the
// admissions process is that the desk registering the fee is not the desk
// that admits the student.
/**
 * The university's role hierarchy, top to bottom. Kept in the order the
 * institution states it, because that order IS the hierarchy — `rank()` in
 * roles.ts reads position from this list rather than from a separate number
 * that could drift out of step with it.
 */
export type UserRole =
  // The two system roles, outside the university's hierarchy of offices.
  // 'superadmin' owns the system itself — who exists, who may act, and what an
  // award certificate looks like. 'admin' runs it day to day. The difference is
  // enforced in src/lib/roles.ts, and the powers that separate them are the
  // ones that would let a holder rewrite the rules rather than work within
  // them: assigning roles, suspending accounts, designing credentials.
  | 'superadmin'
  | 'admin'
  | 'chancellor'
  | 'vice-chancellor'
  | 'registrar'
  | 'finance-director'
  | 'dean'
  | 'hod'
  | 'programme-coordinator'
  | 'lecturer'
  | 'finance'
  | 'admissions-officer'
  | 'library-staff'
  | 'student-affairs'
  // ---------------------------------------------------------------------
  // THE TWO HR OFFICES, and they exist because they hold different powers.
  //
  // An HR Officer prepares an appointment and generates its letter. An HR
  // Administrator issues it and manages the employee record. Neither approves:
  // that is the Registrar's, and the database refuses an approval by whoever
  // drafted it regardless of anybody's role.
  //
  // Splitting them is the whole answer to "nobody should be able to click a
  // button and manufacture an official appointment": there is no single role
  // that can draft, approve and issue.
  // ---------------------------------------------------------------------
  | 'hr-officer'
  | 'hr-administrator'
  // ---------------------------------------------------------------------
  // THE TWO NATIONAL OFFICES.
  //
  // A National Rector holds THIS UNIVERSITY'S authority within one nation —
  // an officer of ICOF, not an agent of it and not a franchisee. Which nation
  // is a row in `national_administrations` (097), not a property of the role:
  // the role says what kind of authority, the register says where.
  //
  // The Financial Secretary is separate rather than being `finance` with a
  // nation attached, because the programme asks for financial authority to be
  // separated from the Rector's — and two people cannot be separated while
  // they share a role. It is the same reasoning that split the two HR offices
  // above.
  //
  // NEITHER IS AN ACADEMIC ROLE. A Rector who also teaches is granted the
  // teaching capabilities through `capability_grants` (056) — governed, and
  // with an expiry — because the programme makes it conditional: "where
  // appropriately qualified". A condition is a grant, not a role.
  // ---------------------------------------------------------------------
  | 'national-rector'
  | 'national-financial-secretary'
  | 'student'
  | 'applicant'
  // Retained: 'academic-office' is used by the timetable and course-allocation
  // screens built before the hierarchy was specified.
  | 'academic-office'
  // ---------------------------------------------------------------------
  // THE EXAMINATION OFFICES.
  //
  // Four roles the University named for the Digital Examination & Proctoring
  // System, and each exists because it holds a power the others must not.
  //
  // 'exam-officer'  runs the examination diet: publishes papers, schedules
  //                 sittings, assigns proctors. Does not mark.
  // 'examiner'      marks, and conducts oral and practical examinations.
  //                 Usually also a lecturer, but the capability is separate
  //                 because marking somebody else's paper is a different act
  //                 from teaching them.
  // 'invigilator'   watches a live sitting and records what they see. Records
  //                 incidents; does NOT decide misconduct and does NOT mark.
  //                 The narrowest role in the system, deliberately.
  // 'moderator'     second-marks and moderates. Cannot moderate their own
  //                 marking — the whole point of moderation.
  //
  // A person may hold several of these over a career; they may not hold two of
  // them on the same script. That is checked per examination, not per account.
  | 'exam-officer'
  | 'examiner'
  | 'invigilator'
  | 'moderator';

export interface Department {
  id: string;
  name: string;
  code: string;
  faculty: string;
  head_name: string;
  created_at: string;
}

export interface Student {
  id: string;
  matric_no: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  nationality?: string;
  state_of_origin?: string;
  address?: string;
  department_id: string;
  program: string;
  degree_type: string;
  admission_year: number;
  expected_graduation?: number;
  status: string;
  photo_url?: string;
  created_at: string;
  updated_at: string;
  departments?: Department;
}

export interface Lecturer {
  id: string;
  staff_id: string;
  first_name: string;
  last_name: string;
  title: string;
  email: string;
  phone?: string;
  department_id: string;
  specialization?: string;
  photo_url?: string;
  status: string;
  created_at: string;
  departments?: Department;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  credit_unit: number;
  department_id: string;
  level: number;
  semester: number;
  year: number;
  lecturer_id?: string;
  description?: string;
  is_elective: boolean;
  created_at: string;
  departments?: Department;
  lecturers?: Lecturer;
}

export interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  academic_year: number;
  semester: number;
  status: string;
  enrolled_at: string;
  students?: Student;
  courses?: Course;
}

export interface Result {
  id: string;
  student_id: string;
  course_id: string;
  enrollment_id?: string;
  ca_score: number;
  exam_score: number;
  total_score: number;
  grade: string;
  grade_point: number;
  status: string;
  submitted_by?: string;
  approved_by?: string;
  submitted_at?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  students?: Student;
  courses?: Course;
}

export interface SemesterGPA {
  id: string;
  student_id: string;
  academic_year: number;
  semester: number;
  gpa: number;
  cgpa: number;
  total_credits: number;
  total_cumulative_credits: number;
  created_at: string;
}

export interface Document {
  id: string;
  student_id: string;
  file_name: string;
  file_url: string;
  file_type?: string;
  document_type: string;
  verified: boolean;
  uploaded_at: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  performed_by?: string;
  details?: Record<string, any>;
  ip_address?: string;
  created_at: string;
}

export interface TranscriptData {
  student: Student;
  department: Department;
  years: TranscriptYear[];
  totalCredits: number;
  cgpa: number;
  classification: string;
}

export interface TranscriptYear {
  year: number;
  semesters: TranscriptSemester[];
}

export interface TranscriptSemester {
  semester: number;
  /**
   * The academic session this semester ran in, as the University prints it:
   * "08-2009", "2009", "09-2010".
   *
   * OPTIONAL, AND NEVER DERIVED. The obvious thing is to count forward from the
   * admission year — Year One is 2023/2024, Year Two is 2024/2025 — and it is
   * right for every student who never repeated a year, was never away, and
   * never resumed late. For everyone else it prints a session they did not
   * study in, on a document under seal, and nothing on the sheet shows it was
   * calculated rather than recorded.
   *
   * So it is printed only where the record carries it, and the transcription
   * screen asks for it: whoever is reading the paper register has the sessions
   * in front of them.
   */
  session?: string;
  courses: TranscriptCourse[];
  gpa: number;
  totalCredits: number;
  totalGradePoints: number;
}

export interface TranscriptCourse {
  code: string;
  title: string;
  creditUnit: number;
  grade: string;
  gradePoint: number;
  qualityPoint: number;
}

export type ViewType =
  // THE ACADEMIC STUDIO. A ViewType because the sidebar is typed on this union
  // and an entry has to be a member of it; it is the one entry that LEAVES the
  // portal shell rather than selecting a module, so it also carries an `href`.
  | 'academic-studio'
  // Settings → Academic Studio → Studio Control: who may ask a model to
  // do what. A door onto capability_grants, which 056 built and which has
  // never had one.
  | 'studio-control'
  // The administration's queue: 095 stops every transformation until an
  // office accepts the submission, and this is where they do it.
  | 'studio-submissions'

  // WHAT THE UNIVERSITY HOLDS ABOUT THE PERSON READING IT, and the roll for
  // the courses they teach. A staff record was opened for somebody and was
  // invisible to them; `view-registered-students` was held by every lecturer
  // with no screen gated on it.
  // THE CATALOGUE ENTRY FOR A COURSE SOMEBODY TEACHES, read-only. The
  // University: "a lecturer should be able to teach a course, but should not be
  // able to define the University's course catalogue."
  | 'my-courses'
  | 'my-record'
  | 'my-students'
  // Superadministrator only. See src/lib/roles.ts — SYSTEM_CAPABILITIES.
  | 'accounts'
  | 'studio'
  | 'admissions-office'
  | 'academic-admissions'
  // The Registrar's fifth stage. `enrolled` was declared in migration 024 and
  // unreachable until this screen existed.
  | 'enrolment'
  | 'programme-resources'
  // ---------------------------------------------------------------------
  // APPOINTMENTS AND OFFICIAL CORRESPONDENCE.
  //
  // Declared here LAST of all, and that ordering is the fault: the screens,
  // the routes and seven migrations existed before any of these four ids did,
  // so the Vice-Chancellor signed in to a portal with no Appointments and no
  // Correspondence in the sidebar. A closed union is what caught it — adding
  // the cases to AppLayout without adding them here would not compile.
  // ---------------------------------------------------------------------
  | 'appointments'
  | 'appointments-board'
  | 'correspondence'
  // THE BOOKS THE UNIVERSITY SENDS OUT, as against the letters it writes.
  | 'publications'
  // THE NATIONS. The register is the centre's; the rectorate is the Rector's own.
  | 'national-administrations'
  | 'national-rectorate'
  | 'national-staff'
  | 'national-finance'
  | 'document-templates'
  | 'job-descriptions'
  | 'appointment-conditions'
  | 'dashboard' 
  | 'students' 
  | 'lecturers' 
  | 'courses' 
  // COURSE REGISTRATION. `enrollments` has been read by the results pipeline,
  // the GPA engine and the graduation audit since migration 001 and written by
  // nothing — because this screen did not exist.
  | 'course-registration'

  | 'results' 
  | 'transcript' 
  | 'certificate'
  | 'my-credentials'
  | 'lms' 
  // The academic register, and the builder that fills it. Both read the
  // structure 057 made data — until then there was no list to show.
  | 'programmes-register'
  | 'curriculum-builder'
  // ---------------------------------------------------------------------
  // THE TERM, AS AGAINST THE CATALOGUE.
  //
  // The University drew the line itself: a COURSE is what the catalogue
  // describes, an OFFERING is that course running in a named term with a
  // named lecturer and a ceiling, and a CLASS meets at an hour in a room.
  // 'courses' is the first; this is the second and third, and it is where a
  // term is actually set up.
  //
  // 'academic-overview' is the control centre over both — the four questions
  // the University asked for by name: courses with no lecturer, programmes
  // with incomplete curricula, missing results, pending approvals.
  // ---------------------------------------------------------------------
  | 'course-offerings'
  | 'academic-overview'
  // WHERE THE UNIVERSITY TEACHES. A class can only be checked for a room
  // clash if it is in a room, and until 064 there were no rooms at all.
  | 'rooms'
  // THE YEAR BOUNDARY, WHICH NOTHING COULD MOVE. 059 set every year's
  // status once, on the day it ran, under a comment saying the date decides
  // it — so on 15 August 2027 three screens would have opened on 2026/2027
  // and said nothing. 065 derives it; this is where it is administered.
  | 'academic-calendar'
  // ONE STUDENT, ONE RECORD. The transcript says what was passed; this says
  // what is LEFT, which needs 057's curriculum, 057's programme_version_id on
  // the student, and 067's views over the two.
  | 'academic-records'
  // THE TOP OF THE TREE. `schools` was seeded by 060 and written by nothing;
  // `departments` has existed since 001 with no way to create one. So the
  // portal showed forty-one programmes and not the five schools they hang
  // from — the University's original objection, one level up.
  | 'academic-structure'
  // THE END OF THE CHAIN. `graduation_records` has existed since 019 with a
  // careful design — the Senate's resolution date required, a degree refused
  // if dated before it — and nothing has ever read or written a row into it.
  | 'graduation'
  // THE STUDENT'S OWN VIEW OF THEIR DEGREE. Not the Programme register,
  // which lists forty-one programmes and is the Registry's — this is the
  // one they are reading for, with their own progress through it.
  | 'my-programme'
  // ---------------------------------------------------------------------
  // THE STUDENT'S OWN SIDE OF SEVEN THINGS THAT ALREADY EXISTED.
  //
  // Every one of these opens rows the database has been holding all along
  // and showing to nobody — documents, payments, the calendar, the
  // graduation assessment, announcements, the academic record. They are
  // separate view ids rather than role branches on the staff ids because
  // they are separate ENTRIES in the student's own navigation; where one
  // subject genuinely has two sides (results, assignments, timetable) the
  // id is shared and AppLayout picks the screen by role.
  // ---------------------------------------------------------------------
  | 'my-documents'
  | 'my-finance'
  | 'my-calendar'
  | 'my-graduation'
  | 'my-announcements'
  | 'my-transcript'
  | 'my-profile'
  | 'student-services'
  // WHAT THE UNIVERSITY CHARGES. Until 075 nothing recorded it, so no student
  // could be shown a balance and the graduation audit could never establish
  // financial clearance. The Superadministrator sets it here.
  | 'fee-schedules'
  // THE OFFICE'S SIDE OF A STUDENT'S REQUEST. 073 built the request and the
  // student's half of it; nothing could move one off 'submitted'.
  | 'student-request-queue'
  // ATTENDANCE, SEPARATED FROM THE TIMETABLE. They were one screen because the
  // timetable kept its own invented slots; now that a class is a row every
  // other screen can read, marking who attended one is its own job.
  | 'attendance'
  | 'exams'
  | 'documents'
  | 'analytics'
  | 'settings'
  // The two subsystems of the University Command Centre. See migration 013.
  | 'social'
  // ONE ENTRY OVER THE WHOLE SUBJECT. 'studio' and 'credential-authority' are
  // kept as view ids because links and dashboard actions still name them, and
  // both resolve to the same workspace — but only 'credentials' appears in the
  // navigation. See CredentialsWorkspace for why three menu entries over one
  // subject was worse than one.
  | 'credentials'
  | 'credential-authority'
  // The Digital Examination & Proctoring System. See migration 015.
  //
  // 'exams' is the EXISTING module and is left alone — it is the question bank
  // and paper-drafting screen. These three are the live examination system:
  // one for the candidate, one for whoever is watching, one for the office.
  | 'sit-examination'
  | 'examiner-console'
  | 'examination-office'
  | 'admissions-finance' | 'admissions-registrar'
  | 'audit' | 'assignments' | 'fees' | 'announcements' | 'forum' | 'timetable' | 'insights' | 'gradebook' | 'questionbank' | 'result-approval';
