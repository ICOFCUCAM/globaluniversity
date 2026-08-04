import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateGrade, calculateGPA, getGradeColor, GRADING_SCALE } from '@/lib/grading';
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

    const resultsToInsert = results
      .filter((r) => r.totalScore > 0)
      .map((r) => ({
        student_id: r.studentId,
        course_id: selectedCourse,
        ca_score: r.caScore,
        exam_score: r.examScore,
        grade: r.grade,
        grade_point: r.gradePoint,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      }));

    if (resultsToInsert.length > 0) {
      const { error } = await supabase.from('results').upsert(resultsToInsert, {
        onConflict: 'student_id,course_id',
      });
      if (!error) {
        setSaved(true);
        // Log audit
        await supabase.from('audit_logs').insert({
          action: 'Results submitted',
          entity_type: 'results',
          performed_by: user?.name || 'Unknown',
          details: { course_id: selectedCourse, count: resultsToInsert.length },
        });
      }
    }
    setSaving(false);
  }

  const selectedCourseData = courses.find((c) => c.id === selectedCourse);
  const classAvg = results.filter((r) => r.totalScore > 0).length > 0
    ? (results.filter((r) => r.totalScore > 0).reduce((s, r) => s + r.totalScore, 0) / results.filter((r) => r.totalScore > 0).length).toFixed(1)
    : '0';
  const passCount = results.filter((r) => r.totalScore >= 40).length;
  const failCount = results.filter((r) => r.totalScore > 0 && r.totalScore < 40).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Result Processing</h2>
          <p className="text-sm text-gray-500">Enter CA and exam scores, grades are calculated automatically</p>
        </div>
        <button onClick={() => setShowGradingScale(!showGradingScale)}
          className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors">
          <Info size={14} /> Grading Scale
        </button>
      </div>

      {/* Grading Scale Panel */}
      {showGradingScale && (
        <div className="bg-white rounded-xl border border-amber-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-3">Grading Scale</h3>
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
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Course</label>
        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs text-gray-500">Course</p>
              <p className="text-lg font-bold text-gray-800">{selectedCourseData?.code}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs text-gray-500">Class Average</p>
              <p className="text-lg font-bold text-blue-600">{classAvg}%</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs text-gray-500">Pass</p>
              <p className="text-lg font-bold text-emerald-600">{passCount}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-xs text-gray-500">Fail</p>
              <p className="text-lg font-bold text-red-600">{failCount}</p>
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-700 text-sm">Score Entry</h3>
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
                  <Save size={14} /> {saving ? 'Saving...' : 'Save Results'}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">S/N</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Matric No</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Student Name</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">CA (40)</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Exam (60)</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Grade</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase">GP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {results.map((entry, i) => (
                    <tr key={entry.studentId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-2.5 text-sm text-gray-500">{i + 1}</td>
                      <td className="px-5 py-2.5 text-sm text-gray-600 font-mono">{entry.matricNo}</td>
                      <td className="px-5 py-2.5 text-sm text-gray-800 font-medium">{entry.studentName}</td>
                      <td className="px-5 py-2.5">
                        <input
                          type="number"
                          min={0}
                          max={40}
                          value={entry.caScore || ''}
                          onChange={(e) => updateScore(i, 'caScore', Math.min(40, Math.max(0, Number(e.target.value))))}
                          className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                      </td>
                      <td className="px-5 py-2.5">
                        <input
                          type="number"
                          min={0}
                          max={60}
                          value={entry.examScore || ''}
                          onChange={(e) => updateScore(i, 'examScore', Math.min(60, Math.max(0, Number(e.target.value))))}
                          className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                      </td>
                      <td className="px-5 py-2.5 text-center">
                        <span className="text-sm font-bold text-gray-800">{entry.totalScore}</span>
                      </td>
                      <td className="px-5 py-2.5 text-center">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${getGradeColor(entry.grade)}`}>
                          {entry.grade}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-center text-sm font-semibold text-gray-700">{entry.gradePoint}</td>
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
