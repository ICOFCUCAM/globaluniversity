// ============================================
// University Management System - Grading Engine
// ============================================

export interface GradeScale {
  minScore: number;
  maxScore: number;
  grade: string;
  gradePoint: number;
  remark: string;
}

// Standard Nigerian University Grading Scale
export const GRADING_SCALE: GradeScale[] = [
  { minScore: 70, maxScore: 100, grade: 'A', gradePoint: 5.0, remark: 'Excellent' },
  { minScore: 60, maxScore: 69, grade: 'B', gradePoint: 4.0, remark: 'Very Good' },
  { minScore: 50, maxScore: 59, grade: 'C', gradePoint: 3.0, remark: 'Good' },
  { minScore: 45, maxScore: 49, grade: 'D', gradePoint: 2.0, remark: 'Fair' },
  { minScore: 40, maxScore: 44, grade: 'E', gradePoint: 1.0, remark: 'Pass' },
  { minScore: 0, maxScore: 39, grade: 'F', gradePoint: 0.0, remark: 'Fail' },
];

/**
 * Calculate grade from total score
 */
export function calculateGrade(totalScore: number): { grade: string; gradePoint: number; remark: string } {
  const scale = GRADING_SCALE.find(
    (s) => totalScore >= s.minScore && totalScore <= s.maxScore
  );
  if (!scale) return { grade: 'F', gradePoint: 0.0, remark: 'Fail' };
  return { grade: scale.grade, gradePoint: scale.gradePoint, remark: scale.remark };
}

/**
 * Calculate total score from CA and Exam
 */
export function calculateTotalScore(caScore: number, examScore: number): number {
  return Math.min(caScore + examScore, 100);
}

/**
 * Calculate quality points (grade_point × credit_unit)
 */
export function calculateQualityPoints(gradePoint: number, creditUnit: number): number {
  return Number((gradePoint * creditUnit).toFixed(2));
}

/**
 * Calculate GPA for a semester
 * GPA = Σ(grade_point × credit_unit) / Σ(credit_units)
 */
export function calculateGPA(
  results: Array<{ gradePoint: number; creditUnit: number }>
): number {
  if (results.length === 0) return 0;
  
  const totalQualityPoints = results.reduce(
    (sum, r) => sum + r.gradePoint * r.creditUnit, 0
  );
  const totalCredits = results.reduce((sum, r) => sum + r.creditUnit, 0);
  
  if (totalCredits === 0) return 0;
  return Number((totalQualityPoints / totalCredits).toFixed(2));
}

/**
 * Calculate CGPA across multiple semesters
 */
export function calculateCGPA(
  semesterResults: Array<{
    results: Array<{ gradePoint: number; creditUnit: number }>;
  }>
): number {
  let totalQP = 0;
  let totalCU = 0;
  
  for (const sem of semesterResults) {
    for (const r of sem.results) {
      totalQP += r.gradePoint * r.creditUnit;
      totalCU += r.creditUnit;
    }
  }
  
  if (totalCU === 0) return 0;
  return Number((totalQP / totalCU).toFixed(2));
}

/**
 * Get degree classification based on CGPA
 */
export function getClassification(cgpa: number): string {
  if (cgpa >= 4.50) return 'First Class Honours';
  if (cgpa >= 3.50) return 'Second Class Honours (Upper Division)';
  if (cgpa >= 2.40) return 'Second Class Honours (Lower Division)';
  if (cgpa >= 1.50) return 'Third Class Honours';
  if (cgpa >= 1.00) return 'Pass';
  return 'Fail';
}

/**
 * Get classification short form
 */
export function getClassificationShort(cgpa: number): string {
  if (cgpa >= 4.50) return '1st Class';
  if (cgpa >= 3.50) return '2nd Class Upper';
  if (cgpa >= 2.40) return '2nd Class Lower';
  if (cgpa >= 1.50) return '3rd Class';
  if (cgpa >= 1.00) return 'Pass';
  return 'Fail';
}

/**
 * Get grade color for UI display
 */
export function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'text-emerald-600 bg-emerald-50';
    case 'B': return 'text-blue-600 bg-blue-50';
    case 'C': return 'text-yellow-600 bg-yellow-50';
    case 'D': return 'text-orange-600 bg-orange-50';
    case 'E': return 'text-red-500 bg-red-50';
    case 'F': return 'text-red-700 bg-red-100';
    default: return 'text-gray-600 bg-gray-50';
  }
}

/**
 * Get GPA color indicator
 */
export function getGPAColor(gpa: number): string {
  if (gpa >= 4.5) return 'text-emerald-600';
  if (gpa >= 3.5) return 'text-blue-600';
  if (gpa >= 2.4) return 'text-yellow-600';
  if (gpa >= 1.5) return 'text-orange-600';
  return 'text-red-600';
}

/**
 * Generate unique student matric number
 */
export function generateMatricNo(deptCode: string, year: number, sequence: number): string {
  return `UNI/${year}/${deptCode}/${String(sequence).padStart(3, '0')}`;
}
