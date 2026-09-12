// ============================================
// Sample Data for Demo - Complete Academic Records
// ============================================

import type { TranscriptData, TranscriptYear } from './types';

// ---------------------------------------------------------------------------
// `sampleTranscriptData` USED TO SIT HERE, AND IT IS GONE.
//
// It was a B.Sc. Computer Science record for "Adebayo Oluwaseun" in a "Faculty
// of Computing", with CSC 101 Introduction to Computer Science on it. The
// University teaches none of that, and it was what every transcript surface
// rendered — including the Studio screen where the Superadministrator approves
// the design of the document the University issues.
//
// The specimen is now `SPECIMEN_TRANSCRIPT` in src/lib/transcriptSpecimen.ts,
// built from the University's own Bachelor of Theology curriculum, held by a
// holder plainly marked as a specimen.
// ---------------------------------------------------------------------------

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
