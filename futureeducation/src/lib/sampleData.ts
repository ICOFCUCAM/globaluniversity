// ============================================
// Sample Data for Demo - Complete Academic Records
// ============================================

import type { TranscriptData, TranscriptYear } from './types';

// Sample transcript data for student Adebayo Oluwaseun
export const sampleTranscriptData: TranscriptData = {
  student: {
    id: 'demo-1',
    matric_no: 'UNI/2022/CS/001',
    first_name: 'Adebayo',
    last_name: 'Oluwaseun',
    middle_name: 'Michael',
    email: 'adebayo.o@uni.edu',
    department_id: 'demo-dept',
    program: 'Computer Science',
    degree_type: 'B.Sc.',
    admission_year: 2022,
    expected_graduation: 2026,
    status: 'active',
    gender: 'Male',
    date_of_birth: '2000-05-15',
    nationality: 'Nigerian',
    state_of_origin: 'Lagos',
    created_at: '2022-09-01',
    updated_at: '2026-04-09',
  },
  department: {
    id: 'demo-dept',
    name: 'Computer Science',
    code: 'CS',
    faculty: 'Faculty of Computing',
    head_name: 'Dr. James Okonkwo',
    created_at: '2020-01-01',
  },
  years: [
    {
      year: 1,
      semesters: [
        {
          semester: 1,
          courses: [
            { code: 'CSC 101', title: 'Introduction to Computer Science', creditUnit: 3, grade: 'A', gradePoint: 5.0, qualityPoint: 15.0 },
            { code: 'CSC 102', title: 'Introduction to Programming', creditUnit: 3, grade: 'A', gradePoint: 5.0, qualityPoint: 15.0 },
            { code: 'MTH 101', title: 'Mathematics for Computing I', creditUnit: 3, grade: 'B', gradePoint: 4.0, qualityPoint: 12.0 },
            { code: 'GST 101', title: 'Use of English I', creditUnit: 2, grade: 'B', gradePoint: 4.0, qualityPoint: 8.0 },
            { code: 'CSC 103', title: 'Computer Hardware Fundamentals', creditUnit: 2, grade: 'A', gradePoint: 5.0, qualityPoint: 10.0 },
          ],
          gpa: 4.62,
          totalCredits: 13,
          totalGradePoints: 60.0,
        },
        {
          semester: 2,
          courses: [
            { code: 'CSC 111', title: 'Data Structures', creditUnit: 3, grade: 'A', gradePoint: 5.0, qualityPoint: 15.0 },
            { code: 'CSC 112', title: 'Object-Oriented Programming', creditUnit: 3, grade: 'B', gradePoint: 4.0, qualityPoint: 12.0 },
            { code: 'MTH 102', title: 'Mathematics for Computing II', creditUnit: 3, grade: 'C', gradePoint: 3.0, qualityPoint: 9.0 },
            { code: 'GST 102', title: 'Use of English II', creditUnit: 2, grade: 'A', gradePoint: 5.0, qualityPoint: 10.0 },
            { code: 'CSC 113', title: 'Digital Logic Design', creditUnit: 2, grade: 'B', gradePoint: 4.0, qualityPoint: 8.0 },
          ],
          gpa: 4.15,
          totalCredits: 13,
          totalGradePoints: 54.0,
        },
      ],
    },
    {
      year: 2,
      semesters: [
        {
          semester: 1,
          courses: [
            { code: 'CSC 201', title: 'Algorithms and Complexity', creditUnit: 3, grade: 'A', gradePoint: 5.0, qualityPoint: 15.0 },
            { code: 'CSC 202', title: 'Database Management Systems', creditUnit: 3, grade: 'A', gradePoint: 5.0, qualityPoint: 15.0 },
            { code: 'CSC 203', title: 'Operating Systems', creditUnit: 3, grade: 'B', gradePoint: 4.0, qualityPoint: 12.0 },
            { code: 'CSC 204', title: 'Computer Networks', creditUnit: 3, grade: 'B', gradePoint: 4.0, qualityPoint: 12.0 },
            { code: 'STA 201', title: 'Statistics for Computing', creditUnit: 2, grade: 'A', gradePoint: 5.0, qualityPoint: 10.0 },
          ],
          gpa: 4.57,
          totalCredits: 14,
          totalGradePoints: 64.0,
        },
        {
          semester: 2,
          courses: [
            { code: 'CSC 211', title: 'Software Engineering', creditUnit: 3, grade: 'A', gradePoint: 5.0, qualityPoint: 15.0 },
            { code: 'CSC 212', title: 'Web Technologies', creditUnit: 3, grade: 'A', gradePoint: 5.0, qualityPoint: 15.0 },
            { code: 'CSC 213', title: 'Systems Analysis and Design', creditUnit: 3, grade: 'B', gradePoint: 4.0, qualityPoint: 12.0 },
            { code: 'CSC 214', title: 'Assembly Language', creditUnit: 2, grade: 'C', gradePoint: 3.0, qualityPoint: 6.0 },
            { code: 'CSC 215', title: 'Computer Graphics', creditUnit: 2, grade: 'B', gradePoint: 4.0, qualityPoint: 8.0 },
          ],
          gpa: 4.31,
          totalCredits: 13,
          totalGradePoints: 56.0,
        },
      ],
    },
    {
      year: 3,
      semesters: [
        {
          semester: 1,
          courses: [
            { code: 'CSC 301', title: 'Artificial Intelligence', creditUnit: 3, grade: 'A', gradePoint: 5.0, qualityPoint: 15.0 },
            { code: 'CSC 302', title: 'Compiler Design', creditUnit: 3, grade: 'B', gradePoint: 4.0, qualityPoint: 12.0 },
            { code: 'CSC 303', title: 'Information Security', creditUnit: 3, grade: 'A', gradePoint: 5.0, qualityPoint: 15.0 },
            { code: 'CSC 304', title: 'Mobile App Development', creditUnit: 3, grade: 'A', gradePoint: 5.0, qualityPoint: 15.0 },
            { code: 'CSC 305', title: 'Numerical Computing', creditUnit: 2, grade: 'B', gradePoint: 4.0, qualityPoint: 8.0 },
          ],
          gpa: 4.64,
          totalCredits: 14,
          totalGradePoints: 65.0,
        },
        {
          semester: 2,
          courses: [
            { code: 'CSC 311', title: 'Machine Learning', creditUnit: 3, grade: 'A', gradePoint: 5.0, qualityPoint: 15.0 },
            { code: 'CSC 312', title: 'Cloud Computing', creditUnit: 3, grade: 'A', gradePoint: 5.0, qualityPoint: 15.0 },
            { code: 'CSC 313', title: 'Human-Computer Interaction', creditUnit: 2, grade: 'B', gradePoint: 4.0, qualityPoint: 8.0 },
            { code: 'CSC 314', title: 'Research Methodology', creditUnit: 2, grade: 'A', gradePoint: 5.0, qualityPoint: 10.0 },
            { code: 'CSC 315', title: 'Industrial Training', creditUnit: 6, grade: 'A', gradePoint: 5.0, qualityPoint: 30.0 },
          ],
          gpa: 4.88,
          totalCredits: 16,
          totalGradePoints: 78.0,
        },
      ],
    },
    {
      year: 4,
      semesters: [
        {
          semester: 1,
          courses: [
            { code: 'CSC 401', title: 'Final Year Project I', creditUnit: 3, grade: 'A', gradePoint: 5.0, qualityPoint: 15.0 },
            { code: 'CSC 402', title: 'Advanced Database Systems', creditUnit: 3, grade: 'A', gradePoint: 5.0, qualityPoint: 15.0 },
            { code: 'CSC 403', title: 'Distributed Systems', creditUnit: 3, grade: 'B', gradePoint: 4.0, qualityPoint: 12.0 },
            { code: 'CSC 404', title: 'Data Science', creditUnit: 3, grade: 'A', gradePoint: 5.0, qualityPoint: 15.0 },
            { code: 'CSC 405', title: 'Entrepreneurship', creditUnit: 2, grade: 'A', gradePoint: 5.0, qualityPoint: 10.0 },
          ],
          gpa: 4.79,
          totalCredits: 14,
          totalGradePoints: 67.0,
        },
        {
          semester: 2,
          courses: [
            { code: 'CSC 411', title: 'Final Year Project II', creditUnit: 6, grade: 'A', gradePoint: 5.0, qualityPoint: 30.0 },
            { code: 'CSC 412', title: 'Emerging Technologies', creditUnit: 3, grade: 'A', gradePoint: 5.0, qualityPoint: 15.0 },
            { code: 'CSC 413', title: 'Professional Ethics', creditUnit: 2, grade: 'A', gradePoint: 5.0, qualityPoint: 10.0 },
            { code: 'CSC 414', title: 'Network Security', creditUnit: 3, grade: 'B', gradePoint: 4.0, qualityPoint: 12.0 },
          ],
          gpa: 4.79,
          totalCredits: 14,
          totalGradePoints: 67.0,
        },
      ],
    },
  ],
  totalCredits: 111,
  cgpa: 4.57,
  classification: 'First Class Honours',
};

// Dashboard statistics
export const dashboardStats = {
  totalStudents: 2847,
  totalLecturers: 186,
  totalCourses: 342,
  totalDepartments: 6,
  activeEnrollments: 8541,
  pendingResults: 127,
  graduatedStudents: 4521,
  ongoingExams: 12,
};

// Recent activities for dashboard
export const recentActivities = [
  { id: 1, action: 'Result submitted', detail: 'CSC 301 - Artificial Intelligence', by: 'Dr. James Okonkwo', time: '2 hours ago', type: 'result' },
  { id: 2, action: 'New student registered', detail: 'UNI/2026/CS/045 - Amina Bello', by: 'System', time: '3 hours ago', type: 'student' },
  { id: 3, action: 'Course material uploaded', detail: 'CSC 202 - Database Management', by: 'Dr. Sarah Adeyemi', time: '5 hours ago', type: 'lms' },
  { id: 4, action: 'Transcript generated', detail: 'UNI/2022/CS/001 - Adebayo Oluwaseun', by: 'Registrar Office', time: '6 hours ago', type: 'transcript' },
  { id: 5, action: 'Exam scheduled', detail: 'CSC 404 - Data Science', by: 'Admin', time: '8 hours ago', type: 'exam' },
  { id: 6, action: 'Results approved', detail: 'CSC 212 - Web Technologies (Batch)', by: 'HOD Computer Science', time: '1 day ago', type: 'result' },
  { id: 7, action: 'Certificate issued', detail: 'UNI/2021/SE/012 - First Class', by: 'Registrar', time: '1 day ago', type: 'certificate' },
  { id: 8, action: 'Live class started', detail: 'CSC 311 - Machine Learning', by: 'Prof. Michael Eze', time: '2 days ago', type: 'lms' },
];

// LMS course materials
export const lmsMaterials = [
  { id: 1, courseCode: 'CSC 301', title: 'Introduction to AI - Lecture 1', type: 'pdf', size: '2.4 MB', uploadedAt: '2026-03-15', downloads: 145 },
  { id: 2, courseCode: 'CSC 301', title: 'Search Algorithms Video', type: 'video', size: '156 MB', uploadedAt: '2026-03-18', downloads: 98 },
  { id: 3, courseCode: 'CSC 202', title: 'SQL Tutorial Complete Guide', type: 'pdf', size: '5.1 MB', uploadedAt: '2026-03-20', downloads: 234 },
  { id: 4, courseCode: 'CSC 212', title: 'React Framework Masterclass', type: 'video', size: '320 MB', uploadedAt: '2026-03-22', downloads: 178 },
  { id: 5, courseCode: 'CSC 311', title: 'Neural Networks Deep Dive', type: 'pdf', size: '8.7 MB', uploadedAt: '2026-03-25', downloads: 89 },
  { id: 6, courseCode: 'CSC 303', title: 'Cryptography Fundamentals', type: 'pdf', size: '3.2 MB', uploadedAt: '2026-03-28', downloads: 156 },
];

// Exam data
export const examData = [
  { id: 1, courseCode: 'CSC 301', title: 'AI Mid-Term Exam', duration: 90, questions: 40, status: 'upcoming', date: '2026-04-15', enrolled: 85 },
  { id: 2, courseCode: 'CSC 202', title: 'DBMS Final Exam', duration: 120, questions: 60, status: 'upcoming', date: '2026-04-20', enrolled: 92 },
  { id: 3, courseCode: 'CSC 212', title: 'Web Tech Practical', duration: 180, questions: 5, status: 'ongoing', date: '2026-04-09', enrolled: 78 },
  { id: 4, courseCode: 'CSC 311', title: 'ML Quiz 3', duration: 30, questions: 20, status: 'completed', date: '2026-04-05', enrolled: 67 },
];
