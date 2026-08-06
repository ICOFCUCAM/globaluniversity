'use client';

// Grade book — a lecturer picks a course, sees every enrolled student, and
// enters continuous-assessment and examination marks in one grid. Grades and
// grade points are computed with the university grading scale and written to
// the results table, feeding GPA, transcripts and learning analytics.
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateGrade } from '@/lib/grading';
import { BookOpen, Save, CheckCircle2 , AlertCircle} from 'lucide-react';

interface Course {
  id: string;
  code: string;
  title: string;
}

interface Enrolled {
  studentId: string;
  matric: string;
  name: string;
  resultId?: string;
  ca: string;
  exam: string;
}

export default function GradeBook() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('');
  const [rows, setRows] = useState<Enrolled[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);
  const [failures, setFailures] = useState<{ name: string; reason: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('courses').select('id, code, title').order('code');
      if (data) setCourses(data as Course[]);
    })();
  }, []);

  useEffect(() => {
    if (!courseId) {
      setRows([]);
      return;
    }
    (async () => {
      setLoading(true);
      setSaved(null);
      const [{ data: enrolments }, { data: results }] = await Promise.all([
        supabase.from('enrollments').select('student_id, students(id, matric_no, first_name, last_name)').eq('course_id', courseId),
        supabase.from('results').select('id, student_id, ca_score, exam_score').eq('course_id', courseId),
      ]);

      const list: Enrolled[] = ((enrolments ?? []) as any[])
        .map((e) => {
          const s = e.students;
          if (!s) return null;
          const existing = (results ?? []).find((r: any) => r.student_id === s.id);
          return {
            studentId: s.id,
            matric: s.matric_no,
            name: `${s.last_name} ${s.first_name}`,
            resultId: existing?.id,
            ca: existing?.ca_score != null ? String(existing.ca_score) : '',
            exam: existing?.exam_score != null ? String(existing.exam_score) : '',
          } as Enrolled;
        })
        .filter(Boolean) as Enrolled[];

      list.sort((a, b) => a.name.localeCompare(b.name));
      setRows(list);
      setLoading(false);
    })();
  }, [courseId]);

  function update(i: number, key: 'ca' | 'exam', value: string) {
    const clean = value.replace(/[^\d.]/g, '');
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: clean } : r)));
    setSaved(null);
  }

  const computed = useMemo(
    () =>
      rows.map((r) => {
        const ca = Number(r.ca || 0);
        const exam = Number(r.exam || 0);
        const total = Math.min(100, ca + exam);
        const entered = r.ca !== '' || r.exam !== '';
        return { ...r, ca, exam, total, entered, ...calculateGrade(total) };
      }),
    [rows],
  );

  const stats = useMemo(() => {
    const done = computed.filter((c) => c.entered);
    if (done.length === 0) return null;
    const avg = Math.round(done.reduce((t, c) => t + c.total, 0) / done.length);
    const passed = done.filter((c) => c.grade !== 'F').length;
    return { entered: done.length, avg, passRate: Math.round((passed / done.length) * 100) };
  }, [computed]);

  /**
   * Save every entered mark.
   *
   * This counted successes and discarded failures — `if (!error) count++` with
   * no else — then reported the count as though it were the total. Save thirty
   * marks with four rejected by the database and the screen said "26 saved",
   * which reads as success. The four students whose marks vanished were never
   * named, and the lecturer had no way to know which they were.
   *
   * Failures are now collected and reported with the student's name, because
   * "four failed" is not actionable and "Ngwa, Bih and Tabi failed" is.
   */
  async function saveAll() {
    setBusy(true);
    setFailures([]);
    let count = 0;
    const failed: { name: string; reason: string }[] = [];

    for (const r of computed) {
      if (!r.entered) continue;
      const payload = {
        student_id: r.studentId,
        course_id: courseId,
        ca_score: r.ca,
        exam_score: r.exam,
        total_score: r.total,
        grade: r.grade,
        grade_point: r.gradePoint,
        // 'draft' until the lecturer submits deliberately. The approval chain
        // is lecturer → HOD → Dean → Registrar, and writing 'submitted' on
        // every save sent half-entered classes forward for approval.
        status: 'draft',
      };
      const { error } = r.resultId
        ? await supabase.from('results').update(payload).eq('id', r.resultId)
        : await supabase.from('results').insert(payload);
      if (error) failed.push({ name: r.name, reason: error.message });
      else count++;
    }

    setBusy(false);
    setSaved(count);
    setFailures(failed);
  }

  const cell = 'w-20 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] bg-gray-50 px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">Grade Book</h2>
        <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
          Enter continuous assessment and examination marks; grades, points and GPA follow automatically
        </p>
      </div>

      <div className="rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27] p-4">
        <label className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-sm font-medium text-[#4a4155] dark:text-[#c8c1d4]">
            <BookOpen size={15} /> Course
          </span>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="min-w-[280px] rounded-lg border border-[#ded6c8] dark:border-[#3d3349] bg-gray-50 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35"
          >
            <option value="">Select a course…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>
          {stats && (
            <span className="ml-auto flex gap-4 text-xs text-[#6b6076] dark:text-[#9c93ad]">
              <span>
                <strong className="text-[#33234a] dark:text-[#e4dcf0]">{stats.entered}</strong> entered
              </span>
              <span>
                avg <strong className="text-[#33234a] dark:text-[#e4dcf0]">{stats.avg}%</strong>
              </span>
              <span>
                pass rate <strong className="text-emerald-600">{stats.passRate}%</strong>
              </span>
            </span>
          )}
        </label>
      </div>

      {!courseId && (
        <p className="rounded-2xl border-2 border-dashed border-[#ece7f4] bg-white p-10 text-center text-sm text-[#a49bb0] dark:text-[#7b7289]">
          Choose a course to open its grade book.
        </p>
      )}

      {courseId && (
        <div className="overflow-hidden rounded-2xl border border-[#ece7de] dark:border-[#2e2637] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f0ece4] dark:border-[#2a2333] bg-gray-50">
                  {['Student', 'Matric', 'CA (30)', 'Exam (70)', 'Total', 'Grade', 'Point'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6b6076] dark:text-[#9c93ad]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-[#a49bb0] dark:text-[#7b7289]">
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading && computed.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-[#a49bb0] dark:text-[#7b7289]">
                      No students enrolled in this course yet.
                    </td>
                  </tr>
                )}
                {computed.map((r, i) => (
                  <tr key={r.studentId} className="hover:bg-[#faf8f4] dark:hover:bg-[#241f2c]">
                    <td className="px-5 py-2.5 text-sm font-medium text-[#33234a] dark:text-[#e4dcf0]">{r.name}</td>
                    <td className="px-5 py-2.5 font-mono text-xs text-[#a49bb0] dark:text-[#7b7289]">{r.matric}</td>
                    <td className="px-5 py-2.5">
                      <input inputMode="decimal" value={rows[i].ca} onChange={(e) => update(i, 'ca', e.target.value)} className={cell} />
                    </td>
                    <td className="px-5 py-2.5">
                      <input inputMode="decimal" value={rows[i].exam} onChange={(e) => update(i, 'exam', e.target.value)} className={cell} />
                    </td>
                    <td className="px-5 py-2.5 text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0]">{r.entered ? `${r.total}%` : '—'}</td>
                    <td className="px-5 py-2.5">
                      {r.entered && (
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            r.grade === 'F' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {r.grade}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-sm text-[#6b6076] dark:text-[#9c93ad]">{r.entered ? r.gradePoint.toFixed(1) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {computed.length > 0 && (
            <div className="flex items-center justify-between gap-4 border-t border-[#ece7de] dark:border-[#2e2637] bg-gray-50 px-5 py-4">
              {saved !== null ? (
                <div className="min-w-0 text-sm">
                  {failures.length === 0 ? (
                    <p className="flex items-center gap-2 text-emerald-700">
                      <CheckCircle2 size={15} /> Saved {saved} mark{saved === 1 ? '' : 's'} as draft.
                    </p>
                  ) : (
                    // Naming them matters. "4 failed" is not something a
                    // lecturer can act on; a list of names is.
                    <div role="alert" className="text-red-800 dark:text-red-300">
                      <p className="flex items-center gap-2 font-medium">
                        <AlertCircle size={15} />
                        Saved {saved}; {failures.length} could not be saved.
                      </p>
                      <ul className="mt-1 space-y-0.5 text-xs">
                        {failures.map((f) => (
                          <li key={f.name}>
                            <strong>{f.name}</strong> — {f.reason}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1 text-xs">
                        Their marks are still on this screen. Do not close the tab.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[#a49bb0] dark:text-[#7b7289]">
                  Marks save as draft. They go forward for approval only when submitted deliberately.
                </p>
              )}
              <button
                disabled={busy}
                onClick={saveAll}
                className="flex items-center gap-2 rounded-xl bg-[#422e59] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#322244] disabled:opacity-60"
              >
                <Save size={15} /> {busy ? 'Saving…' : 'Save Grades'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
