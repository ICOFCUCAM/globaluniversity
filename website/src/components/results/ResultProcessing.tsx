import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateGrade, calculateGPA, getGradeColor, GRADING_SCALE, PASS_MARK } from '@/lib/grading';
import { useAuth } from '@/contexts/AuthContext';
import type { Course, Student } from '@/lib/types';
import {
  Search, Save, CheckCircle2, AlertCircle, Upload, Download,
  ChevronDown, Calculator, X, Info
} from 'lucide-react';

interface ResultEntry {
  studentId: string;
  studentName: string;
  matricNo: string;
  caScore: number;
  examScore: number;
  totalScore: number;
  grade: string;
  gradePoint: number;
}

export default function ResultProcessing() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showGradingScale, setShowGradingScale] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const [coursesRes, studentsRes] = await Promise.all([
        supabase.from('courses').select('*').order('code'),
        supabase.from('students').select('*').order('matric_no'),
      ]);
      if (coursesRes.data) setCourses(coursesRes.data);
      if (studentsRes.data) setStudents(studentsRes.data);
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedCourse && students.length > 0) {
      setResults(
        students.map((s) => ({
          studentId: s.id,
          studentName: `${s.first_name} ${s.last_name}`,
          matricNo: s.matric_no,
          caScore: 0,
          examScore: 0,
          totalScore: 0,
          grade: 'F',
          gradePoint: 0,
        }))
      );
      setSaved(false);
    }
  }, [selectedCourse, students]);

  function updateScore(index: number, field: 'caScore' | 'examScore', value: number) {
    setResults((prev) => {
      const updated = [...prev];
      const entry = { ...updated[index] };
      entry[field] = value;
      entry.totalScore = entry.caScore + entry.examScore;
      const { grade, gradePoint } = calculateGrade(entry.totalScore);
      entry.grade = grade;
      entry.gradePoint = gradePoint;
      updated[index] = entry;
      return updated;
    });
    setSaved(false);
  }

  async function handleSaveResults() {
    if (!selectedCourse) return;
    setSaving(true);
    setSaveError(null);

    const resultsToInsert = results
      .filter((r) => r.totalScore > 0)
      .map((r) => ({
        student_id: r.studentId,
        course_id: selectedCourse,
        ca_score: r.caScore,
        exam_score: r.examScore,
        total_score: r.totalScore,
        grade: r.grade,
        grade_point: r.gradePoint,
        // 'draft', not 'submitted'. The approval chain in lifecycle.ts is
        // lecturer → HOD → Dean → Registrar, and a result is only submitted
        // once the lecturer says it is finished. Writing 'submitted' on every
        // save meant a half-entered class went forward for approval the moment
        // the lecturer saved their work in progress.
        status: 'draft',
      }));

    if (resultsToInsert.length === 0) {
      setSaving(false);
      setSaveError('No marks have been entered, so there was nothing to save.');
      return;
    }

    const { error } = await supabase.from('results').upsert(resultsToInsert, {
      onConflict: 'student_id,course_id',
    });

    if (error) {
      // Previously `if (!error) { … }` with no else: a failed save left the
      // marks on screen, the Save button idle and no message anywhere. A
      // lecturer closed the tab believing a class of marks was recorded.
      setSaving(false);
      setSaveError(
        `Not saved: ${error.message}. Your marks are still on this screen — do not close the tab.`,
      );
      return;
    }

    setSaved(true);

    // performed_by is a uuid column and this was passing user?.name, so every
    // audit write for result entry failed on type — silently, because the
    // result was never checked. The lecturer's identity is their id.
    await supabase.from('audit_logs').insert({
      action: 'results.saved',
      entity_type: 'results',
      entity_id: selectedCourse,
      performed_by: user?.id ?? null,
      details: { course_id: selectedCourse, count: resultsToInsert.length },
    });

    setSaving(false);
  }

  const selectedCourseData = courses.find((c) => c.id === selectedCourse);
  const classAvg = results.filter((r) => r.totalScore > 0).length > 0
    ? (results.filter((r) => r.totalScore > 0).reduce((s, r) => s + r.totalScore, 0) / results.filter((r) => r.totalScore > 0).length).toFixed(1)
    : '0';
  // PASS_MARK, not 40. This screen counted a pass at 40 while the university
  // publishes 65% — so a lecturer reviewing a class saw a pass rate computed
  // against a threshold their own regulations do not use.
  const passCount = results.filter((r) => r.totalScore >= PASS_MARK).length;
  const failCount = results.filter((r) => r.totalScore > 0 && r.totalScore < PASS_MARK).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">Result Processing</h2>
          <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">Enter CA and exam scores, grades are calculated automatically</p>
        </div>
        <button onClick={() => setShowGradingScale(!showGradingScale)}
          className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors">
          <Info size={14} /> Grading Scale
        </button>
      </div>

      {/* Grading Scale Panel */}
      {showGradingScale && (
        <div className="bg-white rounded-xl border border-amber-200 p-5">
          <h3 className="font-semibold text-[#33234a] dark:text-[#e4dcf0] mb-3">Grading Scale</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {GRADING_SCALE.map((g) => (
              <div key={g.grade} className={`p-3 rounded-lg text-center ${getGradeColor(g.grade)}`}>
                <p className="text-2xl font-bold">{g.grade}</p>
                <p className="text-xs font-medium">{g.minScore}-{g.maxScore}%</p>
                <p className="text-xs opacity-75">GP: {g.gradePoint}</p>
                <p className="text-[10px] opacity-60">{g.remark}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Course Selection */}
      <div className="rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27] p-5">
        <label className="block text-sm font-medium text-[#4a4155] dark:text-[#c8c1d4] mb-2">Select Course</label>
        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 border border-[#ded6c8] dark:border-[#3d3349] rounded-xl text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35"
        >
          <option value="">-- Select a course --</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.code} - {c.title} ({c.credit_unit} CU)</option>
          ))}
        </select>
      </div>

      {selectedCourse && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-[#ece7de] dark:border-[#2e2637]">
              <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">Course</p>
              <p className="font-heading text-lg font-bold text-[#422e59] dark:text-[#e4dcf0]">{selectedCourseData?.code}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#ece7de] dark:border-[#2e2637]">
              <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">Class Average</p>
              <p className="text-lg font-bold text-blue-600">{classAvg}%</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#ece7de] dark:border-[#2e2637]">
              <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">Pass</p>
              <p className="text-lg font-bold text-emerald-600">{passCount}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#ece7de] dark:border-[#2e2637]">
              <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">Fail</p>
              <p className="text-lg font-bold text-red-600">{failCount}</p>
            </div>
          </div>

          {/* Results Table */}
          <div className="rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#ece7de] bg-[#faf8f4] dark:border-[#2e2637] dark:bg-[#241f2c] flex items-center justify-between">
              <h3 className="font-semibold text-[#4a4155] dark:text-[#c8c1d4] text-sm">Score Entry</h3>
              <div className="flex items-center gap-2">
                {saved && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 size={14} /> Saved
                  </span>
                )}
                <button
                  onClick={handleSaveResults}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#422e59] text-white rounded-lg text-xs font-medium hover:bg-[#322244] disabled:opacity-50 transition-colors"
                >
                  <Save size={14} /> {saving ? 'Saving…' : 'Save marks'}
                </button>
              </div>
            </div>
            {/* A failed save has to be visible on the screen holding the marks
                that failed. It was silent. */}
            {saveError && (
              <p
                role="alert"
                className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
              >
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                {saveError}
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#f0ece4] dark:border-[#2a2333]">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#6b6076] dark:text-[#9c93ad] uppercase">S/N</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#6b6076] dark:text-[#9c93ad] uppercase">Matric No</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#6b6076] dark:text-[#9c93ad] uppercase">Student Name</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-[#6b6076] dark:text-[#9c93ad] uppercase">CA (40)</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-[#6b6076] dark:text-[#9c93ad] uppercase">Exam (60)</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-[#6b6076] dark:text-[#9c93ad] uppercase">Total</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-[#6b6076] dark:text-[#9c93ad] uppercase">Grade</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-[#6b6076] dark:text-[#9c93ad] uppercase">GP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
                  {results.map((entry, i) => (
                    <tr key={entry.studentId} className="transition-colors hover:bg-[#faf8f4] dark:hover:bg-[#241f2c]">
                      <td className="px-5 py-2.5 text-sm text-[#6b6076] dark:text-[#9c93ad]">{i + 1}</td>
                      <td className="px-5 py-2.5 text-sm text-[#6b6076] dark:text-[#9c93ad] font-mono">{entry.matricNo}</td>
                      <td className="px-5 py-2.5 text-sm text-[#33234a] dark:text-[#e4dcf0] font-medium">{entry.studentName}</td>
                      <td className="px-5 py-2.5">
                        <input
                          type="number"
                          min={0}
                          max={40}
                          value={entry.caScore || ''}
                          onChange={(e) => updateScore(i, 'caScore', Math.min(40, Math.max(0, Number(e.target.value))))}
                          className="w-16 px-2 py-1.5 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35"
                        />
                      </td>
                      <td className="px-5 py-2.5">
                        <input
                          type="number"
                          min={0}
                          max={60}
                          value={entry.examScore || ''}
                          onChange={(e) => updateScore(i, 'examScore', Math.min(60, Math.max(0, Number(e.target.value))))}
                          className="w-16 px-2 py-1.5 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35"
                        />
                      </td>
                      <td className="px-5 py-2.5 text-center">
                        <span className="text-sm font-bold text-[#33234a] dark:text-[#e4dcf0]">{entry.totalScore}</span>
                      </td>
                      <td className="px-5 py-2.5 text-center">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${getGradeColor(entry.grade)}`}>
                          {entry.grade}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-center text-sm font-semibold text-[#4a4155] dark:text-[#c8c1d4]">{entry.gradePoint}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
