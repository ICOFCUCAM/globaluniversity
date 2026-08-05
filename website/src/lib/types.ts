// ============================================
// University Management System - Type Definitions
// ============================================

// 'finance' and 'registrar' are the two admissions desks. They are separate
// roles rather than flavours of 'admin' because the whole control in the
// admissions process is that the desk registering the fee is not the desk
// that admits the student.
export type UserRole = 'admin' | 'student' | 'lecturer' | 'finance' | 'registrar';

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
  | 'programme-resources'
  | 'dashboard' 
  | 'students' 
  | 'lecturers' 
  | 'courses' 
  | 'results' 
  | 'transcript' 
  | 'certificate'
  | 'lms' 
  | 'exams'
  | 'documents'
  | 'analytics'
  | 'settings'
  | 'admissions-finance' | 'admissions-registrar'
  | 'audit' | 'assignments' | 'fees' | 'announcements' | 'forum' | 'timetable' | 'insights' | 'gradebook' | 'questionbank';
