// ---------------------------------------------------------------------------
// Grading — the university's own scale.
//
// WHAT WAS WRONG, AND WHY IT WAS THE MOST SERIOUS FAULT IN THIS SYSTEM.
//
// This file carried a scale headed "Standard Nigerian University Grading
// Scale": A at 70–100 worth 5.0 points, and a pass at 40. The university's own
// published scale — in src/content/regulations.ts, reproduced verbatim from the
// document it supplied, and printed in the Student Handbook, the Prospectus and
// every Faculty Handbook — is A at 94–100 worth 4.00 points, with a pass mark
// of 65%.
//
// So the software that computed marks, GPAs, degree classifications and
// transcripts disagreed with the regulations the university publishes to its
// students. A student scoring 50% was told by the portal: "C, Good, 3.0 points,
// pass". Under the university's regulations, 50% is an outright fail — the F
// band runs 0–64%.
//
// That gap is not a rounding difference. It is the difference between a degree
// awarded and a degree refused, computed by the institution's own system,
// against a scale no one at the institution had adopted. It would have been
// found by the first student who read the handbook and then read their
// transcript, and it would have been found by an accreditation reviewer, who
// checks exactly this for internal consistency.
//
// The scale is now derived from regulations.ts. There is one grading scale in
// this codebase and it is the published one; if the university changes its
// regulations, it changes that file and this follows.
//
// GRADE POINTS RUN 0–4.00, NOT 0–5.00. Every consumer of a GPA — the
// classification bands, the transcript, the certificate — had to change with
// it. A 4.2 CGPA is not possible on this scale and never was.
// ---------------------------------------------------------------------------

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

import { gradeScale as publishedScale, passMark as publishedPassMark } from '@/content/regulations';

/**
 * The scale the portal computes on, derived from what the university publishes.
 *
 * `regulations.ts` holds the bands as they are printed — "94–100%", "4.00" —
 * because that file's job is to reproduce the document exactly. This turns
 * those strings into numbers once, here, so no screen has to parse a range.
 */
export const GRADING_SCALE: GradeScale[] = publishedScale.map((band) => {
  // "94–100%" and "0–64%" — an en dash, not a hyphen, as printed.
  const [min, max] = band.range.replace('%', '').split(/[–-]/).map((n) => Number(n.trim()));
  return {
    minScore: min,
    maxScore: max,
    grade: band.grade,
    gradePoint: Number(band.points),
    remark: band.descriptor,
  };
});

/** The lowest mark that earns credit. 65, from the published regulations. */
export const PASS_MARK = Number(publishedPassMark.replace('%', ''));

/** The highest grade point on this scale. 4.00, not 5.00. */
export const MAX_GRADE_POINT = Math.max(...GRADING_SCALE.map((g) => g.gradePoint));

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
  // Bands on the university's 4.00 scale. The previous set was written for a
  // 5.00 scale — it required 4.50 for a First, which on this scale is a mark
  // only the very top of the A band reaches, and it awarded a "Pass" at 1.00,
  // which here is below the pass mark entirely.
  //
  // NOTE FOR THE UNIVERSITY: these bands are a reasonable reading of a 4.00
  // scale, but the university has not published degree classification bands.
  // Until it does, this is the one number on a certificate that is inferred
  // rather than quoted. It should be adopted formally.
  if (cgpa >= 3.60) return 'First Class Honours';
  if (cgpa >= 3.00) return 'Second Class Honours (Upper Division)';
  if (cgpa >= 2.00) return 'Second Class Honours (Lower Division)';
  if (cgpa >= 1.00) return 'Third Class Honours';
  if (cgpa > 0) return 'Pass';
  return 'Fail';
}

/**
 * Get classification short form
 */
export function getClassificationShort(cgpa: number): string {
  if (cgpa >= 3.60) return '1st Class';
  if (cgpa >= 3.00) return '2nd Class Upper';
  if (cgpa >= 2.00) return '2nd Class Lower';
  if (cgpa >= 1.00) return '3rd Class';
  if (cgpa > 0) return 'Pass';
  return 'Fail';
}

/** Whether a mark earns credit. Read from the published pass mark, not 40. */
export function isPass(totalScore: number): boolean {
  return totalScore >= PASS_MARK;
}

/**
 * Get grade color for UI display
 */
export function getGradeColor(grade: string): string {
  // The published scale has eleven grades, not six: A, A-, B+, B, B-, C+, C,
  // C-, D+, D, F. The old switch knew about A–F and an E that does not exist
  // here, so every modified grade — A-, B+, C- — fell through to the default
  // grey and was displayed as though it were unrecognised.
  //
  // Keyed on the first letter, with F treated separately, so a grade added to
  // the regulations renders correctly without another edit here.
  if (grade === 'F') return 'text-red-700 bg-red-100';
  switch (grade.charAt(0)) {
    case 'A': return 'text-emerald-700 bg-emerald-50';
    case 'B': return 'text-blue-700 bg-blue-50';
    case 'C': return 'text-amber-700 bg-amber-50';
    case 'D': return 'text-orange-700 bg-orange-50';
    default: return 'text-[#6b6076] bg-[#f2eee6]';
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
