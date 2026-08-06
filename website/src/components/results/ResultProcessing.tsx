import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  calculateGrade, calculateGPA, getGradeColor, GRADING_SCALE, PASS_MARK,
  weightedTotal, isComplete, schemeForLevel,
} from '@/lib/grading';
import type { Course, Student } from '@/lib/types';
import {
  Search, Save, CheckCircle2, AlertCircle, Upload, Download,
  ChevronDown, Calculator, X, Info
} from 'lucide-react';

interface ResultEntry {
  studentId: string;
  studentName: string;
  matricNo: string;
  /** One mark out of 100 per component of the course's scheme. */
  components: Record<string, number | null>;
  totalScore: number;
  grade: string;
  gradePoint: number;
}

export default function ResultProcessing() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadingRoll, setLoadingRoll] = useState(false);
  const [showGradingScale, setShowGradingScale] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('courses').select('*').order('code');
      setCourses(data ?? []);
    })();
  }, []);

  /**
   * The class, not the university.
   *
   * This screen loaded every student in the register and listed them under
   * whichever course was selected. A lecturer teaching a seminar of nine opened
   * it and was asked to enter marks for the entire student body — and any mark
   * typed against a student who had never registered for that course would have
   * been saved as a result for it.
   *
   * The roll comes from `enrollments`, which is the record of who registered
   * for what. If nobody has registered, the correct answer is an empty roll and
   * a screen that says so, not a list of everybody.
   */
  useEffect(() => {
    if (!selectedCourse) { setResults([]); return; }
    let live = true;
    (async () => {
      setLoadingRoll(true);
      const { data: enrolled } = await supabase
        .from('enrollments')
        .select('student_id, students(id, first_name, last_name, matric_no, student_number)')
        .eq('course_id', selectedCourse);

      // Marks already entered for this course, so reopening the screen shows
      // what was saved rather than a blank sheet inviting re-entry.
      const { data: existing } = await supabase
        .from('results')
        .select('student_id, components, scheme, total_score, grade, grade_point')
        .eq('course_id', selectedCourse);

      if (!live) return;
      const priorBy = new Map((existing ?? []).map((r: any) => [r.student_id, r]));

      setResults(
        (enrolled ?? [])
          .map((e: any) => e.students)
          .filter(Boolean)
          .sort((a: any, b: any) => (a.last_name ?? '').localeCompare(b.last_name ?? ''))
          .map((st: any) => {
            const prior = priorBy.get(st.id);
            // Components as stored; a result saved before the scheme changed
            // has none, and is shown with the fields empty rather than with its
            // old CA/exam marks reinterpreted as something they are not.
            const comps: Record<string, number | null> = {};
            for (const c of scheme.components) {
              const v = prior?.components?.[c.key];
              comps[c.key] = v === undefined || v === null ? null : Number(v);
            }
            return {
              studentId: st.id,
              studentName: `${st.first_name} ${st.last_name}`,
              matricNo: st.student_number || st.matric_no,
              components: comps,
              totalScore: prior?.total_score ?? 0,
              grade: prior?.grade ?? '—',
              gradePoint: prior?.grade_point ?? 0,
            };
          }),
      );
      setLoadingRoll(false);
      setSaved(false);
    })();
    return () => { live = false; };
  }, [selectedCourse]);

  function updateScore(index: number, key: string, value: number | null) {
    setResults((prev) => {
      const updated = [...prev];
      const entry = { ...updated[index], components: { ...updated[index].components } };
      entry.components[key] = value;
      entry.totalScore = weightedTotal(entry.components, scheme);
      const { grade, gradePoint } = calculateGrade(entry.totalScore);
      // A grade is only shown once every component carries a mark. Grading a
      // half-marked student treats their unmarked presentation as a zero and
      // tells the lecturer they have failed.
      const complete = isComplete(entry.components, scheme);
      entry.grade = complete ? grade : '—';
      entry.gradePoint = complete ? gradePoint : 0;
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
        // The components as entered, and the scheme they were entered under.
        // Storing the scheme is what lets a 2026 result still be read correctly
        // after the regulations change — without it a later scheme would
        // re-weight these marks and restate a grade the student never got.
        components: r.components,
        scheme: scheme.id,
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

    // ROUTED, NOT WRITTEN DIRECTLY.
    //
    // This was `supabase.from('results').upsert(...)` from the browser, and it
    // could never have worked: `results` has RLS enabled and, before migration
    // 009, one policy on it — a student may read their own rows. No staff read,
    // no write for anybody. Every save here was refused by the database.
    //
    // /api/results/save holds the service role, is guarded by 'upload-grades',
    // and refuses to touch a class that has left draft. See that route for why
    // writing is not simply opened up in RLS instead.
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch('/api/results/save', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.session?.access_token ?? ''}`,
      },
      body: JSON.stringify({
        courseId: selectedCourse,
        marks: resultsToInsert.map((r) => ({
          studentId: r.student_id,
          components: r.components,
          scheme: r.scheme,
          totalScore: r.total_score,
          grade: r.grade,
          gradePoint: r.grade_point,
        })),
      }),
    });
    const out = await res.json();

    if (!out.ok) {
      // Previously `if (!error) { … }` with no else: a failed save left the
      // marks on screen, the Save button idle and no message anywhere. A
      // lecturer closed the tab believing a class of marks was recorded.
      setSaving(false);
      setSaveError(
        `Not saved: ${out.detail ?? out.error}. Your marks are still on this screen — do not close the tab.`,
      );
      return;
    }

    setSaving(false);
    setSaved(true);

    // THE AUDIT ENTRY IS WRITTEN BY THE ROUTE, NOT HERE.
    //
    // There used to be a `supabase.from('audit_logs').insert(...)` at this
    // point. It is gone for two reasons. /api/results/save already records the
    // save, server-side, attributed to the caller it authenticated — which is a
    // better record than one the browser asks for. And this one would now fail
    // anyway: audit_logs is not writable from a browser, so the only thing it
    // could still produce is the alarming message below it, telling a lecturer
    // their marks were saved without a trace when in fact the trace exists.
  }

  const selectedCourseData = courses.find((c) => c.id === selectedCourse);
  // Which of the university's three published schemes this course is marked
  // under, chosen by its level. Undergraduate, master's, or thesis.
  const scheme = schemeForLevel(selectedCourseData?.level);
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
          {/* Which scheme this course is marked under, and what each
              component is worth. The banner that stood here warned that the
              sheet contradicted the published scheme; the university has since
              adopted the four published components, and the sheet now follows
              the document. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-[#e8dcc0] bg-[#faf6ee] px-4 py-2.5 text-xs text-[#6b5a2f] dark:border-[#3d3349] dark:bg-[#241f2c] dark:text-[#c3b48f]">
            <span className="font-semibold">{scheme.applies}</span>
            {scheme.components.map((c) => (
              <span key={c.key} className="tabular-nums">
                {c.label} {c.weight}%
              </span>
            ))}
            <span className="text-[#a49bb0]">· each marked out of 100</span>
          </div>

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
                    {/* A column per component of this course's scheme, each
                        headed with its weight so a lecturer can see what the
                        mark is worth without leaving the sheet. */}
                    {scheme.components.map((c) => (
                      <th key={c.key} className="px-3 py-3 text-center text-xs font-semibold uppercase text-[#6b6076] dark:text-[#9c93ad]">
                        {c.label}
                        <span className="ml-1 font-normal normal-case text-[#a49bb0]">({c.weight}%)</span>
                      </th>
                    ))}
                    <th className="text-center px-5 py-3 text-xs font-semibold text-[#6b6076] dark:text-[#9c93ad] uppercase">Total</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-[#6b6076] dark:text-[#9c93ad] uppercase">Grade</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-[#6b6076] dark:text-[#9c93ad] uppercase">GP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
                  {loadingRoll && (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-[#a49bb0]">
                      Loading the class roll…
                    </td></tr>
                  )}
                  {!loadingRoll && results.length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-[#6b6076] dark:text-[#9c93ad]">
                      Nobody has registered for this course yet. The roll here is the list of
                      students who registered for it — not the whole register — so marks cannot be
                      entered against someone who is not taking the course.
                    </td></tr>
                  )}
                  {results.map((entry, i) => (
                    <tr key={entry.studentId} className="transition-colors hover:bg-[#faf8f4] dark:hover:bg-[#241f2c]">
                      <td className="px-5 py-2.5 text-sm text-[#6b6076] dark:text-[#9c93ad]">{i + 1}</td>
                      <td className="px-5 py-2.5 text-sm text-[#6b6076] dark:text-[#9c93ad] font-mono">{entry.matricNo}</td>
                      <td className="px-5 py-2.5 text-sm text-[#33234a] dark:text-[#e4dcf0] font-medium">{entry.studentName}</td>
                      {/* One input per component, each out of 100 and weighted
                          per the regulations — replacing the fixed
                          CA-out-of-40 and exam-out-of-60 pair, which weighted
                          the examination at 60% where the university publishes
                          30% and had nowhere to record participation or
                          presentations at all. */}
                      {scheme.components.map((c) => (
                        <td key={c.key} className="px-3 py-2.5 text-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            aria-label={`${c.label} mark for ${entry.studentName}`}
                            value={entry.components[c.key] ?? ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              updateScore(
                                i,
                                c.key,
                                raw === '' ? null : Math.min(100, Math.max(0, Number(raw))),
                              );
                            }}
                            className="w-16 rounded-lg border border-[#ded6c8] px-2 py-1.5 text-center text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35 dark:border-[#3d3349] dark:bg-[#241f2c]"
                          />
                        </td>
                      ))}
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
