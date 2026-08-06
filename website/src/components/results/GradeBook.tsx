'use client';

// Grade book — a lecturer picks a course, sees every enrolled student, and
// enters continuous-assessment and examination marks in one grid. Grades and
// grade points are computed with the university grading scale and written to
// the results table, feeding GPA, transcripts and learning analytics.
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateGrade } from '@/lib/grading';
import { BookOpen, Save, CheckCircle2, AlertCircle, Send, Lock } from 'lucide-react';
import { STATUS_LABEL, isEditable, type ResultStatus } from '@/lib/resultsWorkflow';

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
  // Where this class is in the approval chain. Marks may only be edited while
  // it is a draft; after submission a correction means asking for it back.
  const [status, setStatus] = useState<ResultStatus>('draft');
  const [submitNote, setSubmitNote] = useState<string | null>(null);

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
        supabase.from('results').select('id, student_id, ca_score, exam_score, status').eq('course_id', courseId),
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
      // The earliest stage present. A class part-drafted and part-submitted is
      // a fault the API refuses to act on; showing the earliest means the
      // lecturer sees it as editable and can put it right.
      const stages = (results ?? []).map((r: any) => (r.status ?? 'draft') as ResultStatus);
      setStatus(stages.includes('draft') || stages.length === 0 ? 'draft' : stages[0]);
      setSubmitNote(null);
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
    setSubmitNote(null);

    const entered = computed.filter((r) => r.entered);
    if (entered.length === 0) {
      setBusy(false);
      setSaved(0);
      setFailures([{ name: 'Nothing entered', reason: 'No marks were entered, so there was nothing to save.' }]);
      return;
    }

    const { data: session } = await supabase.auth.getSession();
    const res = await fetch('/api/results/save', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.session?.access_token ?? ''}`,
      },
      body: JSON.stringify({
        courseId,
        marks: entered.map((r) => ({
          studentId: r.studentId,
          ca: r.ca,
          exam: r.exam,
          totalScore: r.total,
          grade: r.grade,
          gradePoint: r.gradePoint,
        })),
      }),
    });
    const out = await res.json();
    setBusy(false);

    if (!out.ok) {
      setSaved(null);
      // Named, not counted. The route returns which students are locked; a
      // lecturer told "3 marks are locked" has to go looking for them.
      const locked = (out.locked ?? []) as { studentId: string; status: string }[];
      setFailures(
        locked.length > 0
          ? locked.map((l) => ({
              name: rows.find((r) => r.studentId === l.studentId)?.name ?? l.studentId,
              reason: `Already ${STATUS_LABEL[l.status as ResultStatus]?.toLowerCase() ?? l.status} — no longer editable.`,
            }))
          : [{ name: 'Not saved', reason: out.detail ?? out.error ?? 'The marks were not saved. Do not close this tab.' }],
      );
      return;
    }

    setSaved(out.saved);
  }

  /**
   * Submit the class for moderation.
   *
   * SEPARATE FROM SAVING, and the separation is the point. Saving is work in
   * progress and happens many times; submitting declares the class finished,
   * closes it to further editing and starts a chain that four offices have to
   * sign. Writing 'submitted' on every save — which is what an earlier version
   * of this screen did — sent half-entered classes forward for approval.
   */
  async function submitForModeration() {
    setBusy(true);
    setFailures([]);
    setSubmitNote(null);
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch('/api/results/advance', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ courseId, action: 'advance' }),
    });
    const out = await res.json();
    setBusy(false);

    if (!out.ok) {
      setSubmitNote(
        (out.detail ?? out.error ?? 'The class was not submitted.')
        + (out.awaiting ? ` Waiting on: ${out.awaiting.step}.` : ''),
      );
      return;
    }

    setStatus('submitted');
    setSubmitNote(
      `Submitted. ${out.marks} mark${out.marks === 1 ? '' : 's'} are now with the `
      + `${out.awaiting?.step ?? 'Head of Department'} and can no longer be edited here.`,
    );
  }

  const editable = isEditable(status);

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
                      <input inputMode="decimal" value={rows[i].ca} onChange={(e) => update(i, 'ca', e.target.value)} readOnly={!editable} className={cell} />
                    </td>
                    <td className="px-5 py-2.5">
                      <input inputMode="decimal" value={rows[i].exam} onChange={(e) => update(i, 'exam', e.target.value)} readOnly={!editable} className={cell} />
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
                  {editable
                    ? 'Marks save as draft. They go forward for approval only when you submit them.'
                    : `This class is ${STATUS_LABEL[status].toLowerCase()} and can no longer be edited here. To correct a mark, ask for the class to be sent back \u2014 the return is recorded and the chain restarts.`}
                </p>
              )}
              <div className="flex shrink-0 items-center gap-2">
                {editable ? (
                  <>
                    <button
                      disabled={busy}
                      onClick={saveAll}
                      className="flex items-center gap-2 rounded-xl border border-[#422e59] px-5 py-2.5 text-sm font-medium text-[#422e59] hover:bg-[#f3effa] disabled:opacity-60 dark:border-[#6d5a86] dark:text-[#c8b6e0]"
                    >
                      <Save size={15} /> {busy ? 'Saving\u2026' : 'Save draft'}
                    </button>
                    {/* Submitting is deliberate and one-way: it closes the class
                        to editing and starts a chain four offices must sign.
                        Enabled only once something has actually been saved, so a
                        lecturer cannot submit a class they have not written
                        down. */}
                    <button
                      disabled={busy || saved === null || saved === 0 || failures.length > 0}
                      onClick={submitForModeration}
                      title={
                        saved === null
                          ? 'Save the marks first.'
                          : 'Declares the class finished and sends it to the Head of Department.'
                      }
                      className="flex items-center gap-2 rounded-xl bg-[#422e59] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#322244] disabled:opacity-40"
                    >
                      <Send size={15} /> Submit for moderation
                    </button>
                  </>
                ) : (
                  <span className="flex items-center gap-2 rounded-xl bg-[#efeaf6] px-5 py-2.5 text-sm font-medium text-[#422e59] dark:bg-[#2a2333] dark:text-[#c8b6e0]">
                    <Lock size={15} /> {STATUS_LABEL[status]}
                  </span>
                )}
              </div>
            </div>
          )}

          {submitNote && (
            <p
              role="status"
              className="border-t border-[#ece7de] bg-[#faf7f0] px-5 py-3 text-sm text-[#4a4155] dark:border-[#2e2637] dark:bg-[#1f1a27] dark:text-[#c8c1d4]"
            >
              {submitNote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
