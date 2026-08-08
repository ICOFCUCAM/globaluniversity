// ---------------------------------------------------------------------------
// THE SPECIMEN TRANSCRIPT.
//
// ---------------------------------------------------------------------------
// WHAT IT REPLACES, AND WHY THAT MATTERED
// ---------------------------------------------------------------------------
//
// Every transcript surface previewed `sampleTranscriptData` — Adebayo Oluwaseun,
// B.Sc. Computer Science, "Faculty of Computing", CSC 101 Introduction to
// Computer Science. The University teaches none of that. A registrar opening
// the Studio to approve the transcript design was shown a document for a
// programme this institution does not offer, in a faculty it does not have.
//
// This is built from `bthCurriculum` — the University's own Bachelor of
// Theology, six semesters of six courses at five credits, 180 in total, exactly
// as the programme is published. So the specimen exercises the real thing: a
// three-year record, which is what the University ruled a bachelor's is, and
// which is what makes the sheet paginate the way a real one will.
//
// ---------------------------------------------------------------------------
// THE GRADES ARE INVENTED AND THE HOLDER DOES NOT EXIST
// ---------------------------------------------------------------------------
//
// The courses are real because a specimen that shows courses the University
// does not teach is useless for checking a layout. The MARKS are a fixed
// pattern, and the holder is "Specimen A. Candidate" with the credential number
// spelled out as SPECIMEN — the same convention as the certificate specimens,
// and for the same reason: a specimen must never carry a real graduate's
// identity, and must never be mistakable for an issued document.
//
// The pattern is deterministic, so the specimen does not change between two
// people looking at the same screen and disagreeing about what they saw.
// ---------------------------------------------------------------------------

import { bthCurriculum } from '@/content/bachelorOfTheology';
import { GRADING_SCALE } from '@/lib/grading';
import { getClassification } from '@/lib/grading';
import type { TranscriptCourse, TranscriptSemester, TranscriptYear } from '@/lib/types';
import type { TranscriptMasterData } from '@/lib/transcriptMaster';

/** The same holder the certificate specimens carry. One fiction, not five. */
export const SPECIMEN_HOLDER = { surname: 'Candidate', firstNames: 'Specimen', middleName: 'A.' };
export const SPECIMEN_ID = 'SPECIMEN — NOT AN ISSUED CREDENTIAL';

/** Five ECTS a course, as the programme is published. */
const CREDITS_PER_COURSE = 5;

/**
 * The marks, as a repeating pattern rather than a random draw.
 *
 * Chosen to be plainly a specimen: a clean spread across the upper bands that
 * no real cohort produces, and one C+ so the sheet is seen to handle a lower
 * mark rather than only its best case.
 */
const PATTERN = ['A', 'A-', 'B+', 'A', 'B', 'C+', 'A-'];

function pointFor(grade: string): number {
  return GRADING_SCALE.find((g) => g.grade === grade)?.gradePoint ?? 0;
}

function buildYears(): TranscriptYear[] {
  const byYear = new Map<number, TranscriptSemester[]>();

  bthCurriculum.forEach((block, blockIndex) => {
    const year = Math.floor(blockIndex / 2) + 1;
    const semester = (blockIndex % 2) + 1;

    const courses: TranscriptCourse[] = block.courses.map((c, i) => {
      // SEVEN GRADES AGAINST SIX COURSES A SEMESTER, so each semester draws a
      // different window rather than the same six in a different order. With a
      // six-long pattern every semester was a rotation of the same multiset and
      // all six printed a GPA of 3.17 — which shows nothing about what the
      // sheet does with a record that varies, and every real record varies.
      const grade = PATTERN[(blockIndex * block.courses.length + i) % PATTERN.length];
      const gradePoint = pointFor(grade);
      return {
        code: c.code,
        title: c.title,
        creditUnit: CREDITS_PER_COURSE,
        grade,
        gradePoint,
        qualityPoint: gradePoint * CREDITS_PER_COURSE,
      };
    });

    const totalCredits = courses.reduce((t, c) => t + c.creditUnit, 0);
    const totalGradePoints = courses.reduce((t, c) => t + c.qualityPoint, 0);

    const list = byYear.get(year) ?? [];
    list.push({
      semester,
      courses,
      totalCredits,
      totalGradePoints,
      gpa: totalCredits > 0 ? round2(totalGradePoints / totalCredits) : 0,
    });
    byYear.set(year, list);
  });

  return Array.from(byYear.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, semesters]) => ({ year, semesters }));
}

function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/**
 * The specimen, built once at module load.
 *
 * Every surface that needs "a transcript to look at" uses this one — the Issue
 * screen before a student is chosen, the Studio's design preview, and the
 * specimen book. Three different fake students was three different answers to
 * "what does our transcript look like".
 */
export const SPECIMEN_TRANSCRIPT: TranscriptMasterData = (() => {
  const years = buildYears();
  const all = years.flatMap((y) => y.semesters.flatMap((s) => s.courses));
  const totalCredits = all.reduce((t, c) => t + c.creditUnit, 0);
  const qualityPoints = all.reduce((t, c) => t + c.qualityPoint, 0);
  const cgpa = totalCredits > 0 ? round2(qualityPoints / totalCredits) : 0;
  const earned = all
    .filter((c) => c.gradePoint > 0)
    .reduce((t, c) => t + c.creditUnit, 0);

  return {
    student: {
      first_name: SPECIMEN_HOLDER.firstNames,
      middle_name: SPECIMEN_HOLDER.middleName,
      last_name: SPECIMEN_HOLDER.surname,
      matric_no: 'SPECIMEN',
      program: 'Bachelor of Theology',
      degree_type: 'Bachelor of Theology',
    } as TranscriptMasterData['student'],
    department: {
      name: 'Bachelor of Theology',
      faculty: 'Faculty of Theology',
    } as TranscriptMasterData['department'],
    years,
    totalCredits,
    cgpa,
    classification: getClassification(cgpa),

    credentialId: SPECIMEN_ID,
    sealCode: null,
    qrSvg: null,
    version: 1,
    issuedOn: null,
    studentNumber: 'SPECIMEN',
    creditsEarned: earned,
    dateOfBirth: null,
    placeOfBirth: null,
    sex: null,
    studentAddress: null,
    transcribedFrom: null,
    superseded: false,
  };
})();
