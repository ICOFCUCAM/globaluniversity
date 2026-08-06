'use client';

// Question bank — reusable multiple-choice question sets per course, and
// randomized paper generation from them. Stored on the shared documents
// table (document_type 'exam-question') until a dedicated table exists.
import React, { useEffect, useMemo, useState } from 'react';
import { write } from '@/lib/write';
import { listRecords, saveRecord, deleteRecord } from '@/lib/moduleStore';
import { Database, Plus, Shuffle, Trash2, Printer } from 'lucide-react';

interface Question {
  id: string;
  course: string;
  topic: string;
  text: string;
  options: string[];
  answer: number;
  difficulty: 'easy' | 'medium' | 'hard';
}


export default function QuestionBank() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [course, setCourse] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [paper, setPaper] = useState<Question[] | null>(null);
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    course: '',
    topic: '',
    text: '',
    options: ['', '', '', ''],
    answer: 0,
    difficulty: 'medium' as Question['difficulty'],
  });

  async function load() {
    const rows = await listRecords('exams', 'exam-question');
    setQuestions(
      rows.map((r) => ({ id: r.id, ...(r.body as Record<string, unknown>) }) as unknown as Question),
    );
  }
  useEffect(() => {
    load();
  }, []);

  const courses = useMemo(() => Array.from(new Set(questions.map((q) => q.course))).sort(), [questions]);
  const filtered = useMemo(
    () => (course === 'all' ? questions : questions.filter((q) => q.course === course)),
    [questions, course],
  );

  async function addQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (form.options.filter((o) => o.trim()).length < 2) return;
    setBusy(true);
    const ok = await write(saveRecord({
      module: 'exams',
      kind: 'exam-question',
      title: `${form.course} · ${form.topic || 'General'} · ${form.text.slice(0, 60)}`,
      body: { ...form },
    }), 'save the question');
    setBusy(false);
    if (!ok) return;
    setShowNew(false);
    setForm({ course: form.course, topic: '', text: '', options: ['', '', '', ''], answer: 0, difficulty: 'medium' });
    load();
  }

  function generate() {
    const pool = [...filtered];
    // Fisher–Yates shuffle so every paper is genuinely randomized.
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setPaper(pool.slice(0, Math.min(count, pool.length)));
  }

  const input =
    'w-full rounded-lg border border-[#ded6c8] dark:border-[#3d3349] bg-gray-50 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35';
  const tone: Record<Question['difficulty'], string> = {
    easy: 'bg-emerald-50 text-emerald-700',
    medium: 'bg-amber-50 text-amber-700',
    hard: 'bg-red-50 text-red-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">Question Bank</h2>
          <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">Build reusable question sets and generate randomized examination papers</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-xl bg-[#422e59] px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-purple-900/20 hover:bg-[#322244]"
        >
          <Plus size={16} /> Add Question
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27] p-4">
        <span className="flex items-center gap-2 text-sm font-medium text-[#4a4155] dark:text-[#c8c1d4]">
          <Database size={15} /> Bank
        </span>
        <select value={course} onChange={(e) => setCourse(e.target.value)} className={`${input} max-w-[240px]`}>
          <option value="all">All courses ({questions.length})</option>
          {courses.map((c) => (
            <option key={c} value={c}>
              {c} ({questions.filter((q) => q.course === c).length})
            </option>
          ))}
        </select>
        <span className="ml-auto flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className={`${input} w-20`}
            aria-label="Number of questions"
          />
          <button
            onClick={generate}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 rounded-xl border border-[#422e59] px-4 py-2 text-sm font-semibold text-[#422e59] hover:bg-[#f6f4fa] disabled:opacity-40"
          >
            <Shuffle size={15} /> Generate Paper
          </button>
        </span>
      </div>

      {filtered.length === 0 && (
        <p className="rounded-2xl border-2 border-dashed border-[#ece7f4] bg-white p-10 text-center text-sm text-[#a49bb0] dark:text-[#7b7289]">
          No questions in the bank yet. Add questions to build reusable papers.
        </p>
      )}

      <div className="space-y-3">
        {filtered.map((q, i) => (
          <div key={q.id} className="rounded-2xl border border-[#ece7de] dark:border-[#2e2637] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#422e59]">{q.course}</span>
                  {q.topic && <span className="text-xs text-[#a49bb0] dark:text-[#7b7289]">· {q.topic}</span>}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${tone[q.difficulty]}`}>
                    {q.difficulty}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-[#33234a] dark:text-[#e4dcf0]">
                  {i + 1}. {q.text}
                </p>
                <ol className="mt-2 grid gap-1 sm:grid-cols-2">
                  {q.options.filter(Boolean).map((o, oi) => (
                    <li
                      key={oi}
                      className={`rounded-lg px-3 py-1.5 text-xs ${
                        oi === q.answer ? 'bg-emerald-50 font-semibold text-emerald-700' : 'bg-gray-50 text-[#6b6076] dark:text-[#9c93ad]'
                      }`}
                    >
                      {String.fromCharCode(65 + oi)}. {o}
                      {oi === q.answer && ' ✓'}
                    </li>
                  ))}
                </ol>
              </div>
              <button
                aria-label="Delete question"
                onClick={async () => {
                  await write(deleteRecord(q.id), 'remove the question');
                  load();
                }}
                className="shrink-0 rounded-lg bg-red-50 p-2 text-red-600"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add question */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowNew(false)}>
          <form onSubmit={addQuestion} onClick={(e) => e.stopPropagation()} className="max-h-[85vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl bg-white p-6">
            <h3 className="font-heading text-lg font-bold text-[#422e59] dark:text-[#e4dcf0]">Add Question</h3>
            <div className="flex gap-2">
              <input required placeholder="Course code" className={input} value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} />
              <input placeholder="Topic (optional)" className={input} value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
            </div>
            <textarea required rows={3} placeholder="Question text" className={input} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
            <p className="text-xs font-semibold uppercase tracking-wide text-[#a49bb0] dark:text-[#7b7289]">Options — select the correct answer</p>
            {form.options.map((o, i) => (
              <label key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="answer"
                  checked={form.answer === i}
                  onChange={() => setForm({ ...form, answer: i })}
                  aria-label={`Mark option ${String.fromCharCode(65 + i)} correct`}
                />
                <input
                  required={i < 2}
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  className={input}
                  value={o}
                  onChange={(e) => {
                    const opts = [...form.options];
                    opts[i] = e.target.value;
                    setForm({ ...form, options: opts });
                  }}
                />
              </label>
            ))}
            <select className={input} value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value as Question['difficulty'] })}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <button disabled={busy} className="w-full rounded-xl bg-[#422e59] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#322244] disabled:opacity-60">
              {busy ? 'Saving…' : 'Add to Bank'}
            </button>
          </form>
        </div>
      )}

      {/* Generated paper */}
      {paper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:static print:bg-white print:p-0" onClick={() => setPaper(null)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-8">
            <div className="mb-6 border-b border-[#ded6c8] dark:border-[#3d3349] pb-4 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/site-icon.png" alt="" className="mx-auto h-12 w-12" />
              <h3 className="mt-2 font-bold text-[#33234a] dark:text-[#e4dcf0]">ICOF GLOBAL UNIVERSITY</h3>
              <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
                Examination Paper · {course === 'all' ? 'Mixed' : course} · {paper.length} questions
              </p>
              <p className="mt-1 text-xs text-[#a49bb0] dark:text-[#7b7289]">Name: ____________________ Matric No: ____________ Date: __________</p>
            </div>
            <ol className="space-y-5">
              {paper.map((q, i) => (
                <li key={q.id}>
                  <p className="text-sm font-medium text-[#33234a] dark:text-[#e4dcf0]">
                    {i + 1}. {q.text}
                  </p>
                  <div className="mt-1.5 grid gap-1 sm:grid-cols-2">
                    {q.options.filter(Boolean).map((o, oi) => (
                      <p key={oi} className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
                        {String.fromCharCode(65 + oi)}. {o}
                      </p>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex justify-center gap-3 print:hidden">
              <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-xl bg-[#f7dc79] px-5 py-2 text-sm font-semibold text-[#422e59]">
                <Printer size={14} /> Print Paper
              </button>
              <button onClick={generate} className="rounded-xl border border-[#ded6c8] dark:border-[#3d3349] px-5 py-2 text-sm text-[#4a4155] dark:text-[#c8c1d4]">
                Reshuffle
              </button>
              <button onClick={() => setPaper(null)} className="rounded-xl bg-gray-100 px-5 py-2 text-sm text-[#4a4155] dark:text-[#c8c1d4]">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
