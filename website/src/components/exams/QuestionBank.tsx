'use client';

// ---------------------------------------------------------------------------
// THE QUESTION BANK — an authoring repository, and not a student-facing one.
//
// ---------------------------------------------------------------------------
// WHAT THIS SCREEN USED TO BE, AND WHY IT HAD TO CHANGE
// ---------------------------------------------------------------------------
//
// It wrote each question into `module_records` as one JSON blob:
//
//     {"text": "...", "options": ["...", "..."], "answer": 0, "course": "BLT 501"}
//
// The audit of September 2026 signed in as a student and got back the question
// AND the word "Nicaea". Three faults, and the read policy was only the third:
//
//   · THE ANSWER WAS IN THE SAME VALUE AS THE QUESTION, so any rule admitting
//     one admitted the other. No policy and no view can separate them.
//   · `course` WAS A STRING, typed by hand. A string is not a foreign key, so
//     the bank could not be scoped to the lecturer allowed to author in it, and
//     "BLT 501" and "BLT501" were two different courses.
//   · and the store admitted any signed-in account.
//
// The University's ruling: "THE QUESTION BANK IS AN AUTHORING REPOSITORY, NOT A
// STUDENT-FACING REPOSITORY. Students should only receive an assessment
// projection containing the questions they're supposed to answer, without
// answer keys or instructor-only metadata."
//
// ---------------------------------------------------------------------------
// SO: 089'S THREE TABLES, AND A COURSE CHOSEN RATHER THAN TYPED
// ---------------------------------------------------------------------------
//
// The course is picked from `my_teaching` — the courses this person is actually
// allocated to. That is the fix for the string, and it is also what makes the
// row-level policy able to do its job: `may_curate_course(course_id)` has
// something to check.
//
// THE ANSWER IS NOT WRITTEN FROM HERE. `question_bank_key` grants a browser
// session SELECT and nothing else; saving goes through `/api/exam/bank`, which
// checks the course is one this person teaches before it writes. A screen that
// could write the key could write it against a mis-scoped course, into a bank
// its author cannot even read.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedPost } from '@/lib/authedFetch';
import {
  Card, CardHeader, PageHeader, EmptyState, SkeletonRows,
} from '@/components/ui/portal';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/lib/portalTheme';
import { Database, Plus, Trash2, X, AlertTriangle, Archive, Check } from 'lucide-react';

interface Teaching { course_id: string; course_code: string | null; course_title: string | null }
interface Option { id: string; label: string; sort_order: number }
interface Item {
  id: string;
  course_id: string;
  prompt: string;
  topic: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  status: string;
  question_bank_options: Option[];
}
interface KeyRow { item_id: string; option_id: string | null; is_correct: boolean }

// One literal each — supabase-js reads the row type from it, and a
// concatenation collapses it to GenericStringError[] with no error at the call.
const TEACHING = 'course_id, course_code, course_title';
// eslint-disable-next-line max-len
const ITEMS = 'id, course_id, prompt, topic, difficulty, status, question_bank_options(id, label, sort_order)';
const KEYS = 'item_id, option_id, is_correct';

const BLANK = {
  courseId: '', topic: '', prompt: '',
  options: ['', '', '', ''],
  answerIndex: 0,
  difficulty: 'medium' as Item['difficulty'],
};

export default function QuestionBank() {
  const [teaching, setTeaching] = useState<Teaching[] | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  // WHICH OPTION IS RIGHT, held apart from the question in the screen as well
  // as in the database — so that a component rendering a question has to reach
  // for the key deliberately rather than already holding it.
  const [keys, setKeys] = useState<Map<string, string>>(new Map());
  const [courseFilter, setCourseFilter] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: mine }, { data: rows }] = await Promise.all([
      supabase.from('my_teaching').select(TEACHING).order('course_code'),
      supabase.from('question_bank_items').select(ITEMS).order('created_at', { ascending: false }),
    ]);
    // DE-DUPLICATED BY COURSE. `my_teaching` has a row per offering, so a course
    // taught in two terms would otherwise appear twice in the picker.
    // ARRAY.FILTER RATHER THAN A MAP'S ITERATOR: the build target here is
    // below es2015, so spreading `map.values()` does not compile.
    const seenIds = new Set<string>();
    setTeaching(((mine ?? []) as Teaching[]).filter((t) => {
      if (seenIds.has(t.course_id)) return false;
      seenIds.add(t.course_id);
      return true;
    }));

    const list = (rows ?? []) as unknown as Item[];
    setItems(list);

    if (list.length) {
      const { data: k } = await supabase.from('question_bank_key')
        .select(KEYS).in('item_id', list.map((i) => i.id));
      const map = new Map<string, string>();
      for (const row of (k ?? []) as unknown as KeyRow[]) {
        if (row.is_correct && row.option_id) map.set(row.item_id, row.option_id);
      }
      setKeys(map);
    } else {
      setKeys(new Map());
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const courses = useMemo(() => {
    const used = new Set((items ?? []).map((i) => i.course_id));
    return (teaching ?? []).filter((t) => used.has(t.course_id));
  }, [teaching, items]);

  const shown = useMemo(
    () => (items ?? []).filter((i) => courseFilter === 'all' || i.course_id === courseFilter),
    [items, courseFilter],
  );

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await authedPost('/api/exam/bank', {
      action: 'add',
      courseId: form.courseId,
      prompt: form.prompt,
      topic: form.topic,
      difficulty: form.difficulty,
      options: form.options,
      answerIndex: form.answerIndex,
    });
    setBusy(false);
    if (!res.ok) { setError(res.detail ?? res.error ?? 'The question was not saved.'); return; }
    // The course is kept: somebody banking questions is usually banking several.
    setForm({ ...BLANK, courseId: form.courseId });
    setShowNew(false);
    void load();
  }

  async function act(action: 'retire' | 'remove', itemId: string) {
    setError(null);
    const res = await authedPost('/api/exam/bank', { action, itemId });
    if (!res.ok) { setError(res.detail ?? res.error ?? 'That did not work.'); return; }
    void load();
  }

  const input = 'w-full rounded-lg border border-[#ded6c8] dark:border-[#3d3349] bg-gray-50 '
    + 'dark:bg-[#1a1520] px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 '
    + 'focus-visible:ring-[#422e59]/35';
  const tone: Record<Item['difficulty'], string> = {
    easy: 'bg-emerald-50 text-emerald-700',
    medium: 'bg-amber-50 text-amber-700',
    hard: 'bg-red-50 text-red-700',
  };

  if (items === null || teaching === null) {
    return <Card className="p-5"><SkeletonRows rows={4} /></Card>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Question bank"
        subtitle="Questions you author for the courses you teach. Candidates never read this — they are sent a paper built from it."
      />

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" /> {error}
        </p>
      )}

      {teaching.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Database size={20} />}
            title="No courses are allocated to you"
            description="A question belongs to a course. Once the office that keeps the catalogue allocates one to you, you can begin banking questions for it."
          />
        </Card>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center gap-3 p-4">
            <span className="flex items-center gap-2 text-sm font-medium text-[#4a4155] dark:text-[#c8c1d4]">
              <Database size={15} /> Bank
            </span>
            <select
              id="qb-course-filter"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className={`${input} max-w-[280px]`}
              aria-label="Filter by course"
            >
              <option value="all">All my courses ({items.length})</option>
              {courses.map((c) => (
                <option key={c.course_id} value={c.course_id}>
                  {c.course_code} ({items.filter((i) => i.course_id === c.course_id).length})
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`${BTN_PRIMARY} ml-auto`}
              onClick={() => { setForm({ ...BLANK, courseId: teaching[0].course_id }); setShowNew(true); }}
            >
              <Plus size={16} /> Add question
            </button>
          </div>
        </Card>
      )}

      {teaching.length > 0 && shown.length === 0 && (
        <Card>
          <EmptyState
            icon={<Database size={20} />}
            title="Nothing banked yet"
            description="Questions you add here can be drawn into examination papers. Nothing is shared with another lecturer, and no candidate can read them."
          />
        </Card>
      )}

      {shown.length > 0 && (
        <Card>
          <CardHeader
            title="Banked questions"
            subtitle={`${shown.length} question${shown.length === 1 ? '' : 's'}`}
          />
          <ul className="divide-y divide-[#ece7de] dark:divide-[#2e2637]">
            {shown.map((q) => {
              const correct = keys.get(q.id);
              const options = [...(q.question_bank_options ?? [])]
                .sort((a, b) => a.sort_order - b.sort_order);
              return (
                <li key={q.id} className="p-5">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#422e59] dark:text-[#e4dcf0]">{q.prompt}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#a49bb0]">
                        <span className={`rounded px-1.5 py-0.5 font-semibold ${tone[q.difficulty]}`}>
                          {q.difficulty}
                        </span>
                        {q.topic && <span>{q.topic}</span>}
                        {q.status === 'retired' && (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">
                            retired
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="flex flex-none gap-2">
                      {q.status !== 'retired' && (
                        <button
                          type="button"
                          className={BTN_SECONDARY}
                          onClick={() => act('retire', q.id)}
                          title="Take out of circulation, keeping it on the record"
                        >
                          <Archive size={14} /> Retire
                        </button>
                      )}
                      <button
                        type="button"
                        className="rounded-lg p-2 text-[#a49bb0] hover:bg-red-50 hover:text-red-600"
                        onClick={() => act('remove', q.id)}
                        aria-label="Delete this question"
                      >
                        <Trash2 size={15} />
                      </button>
                    </span>
                  </div>

                  <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {options.map((o) => (
                      <li
                        key={o.id}
                        className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${
                          o.id === correct
                            ? 'bg-emerald-50 font-semibold text-emerald-800'
                            : 'bg-gray-50 text-[#6b6076] dark:bg-[#231c2c] dark:text-[#9c93ad]'
                        }`}
                      >
                        {o.id === correct && <Check size={14} className="flex-none" />}
                        <span className="min-w-0 break-words">{o.label}</span>
                      </li>
                    ))}
                  </ol>
                </li>
              );
            })}
          </ul>

          {/* SAID, RATHER THAN ASSUMED. A lecturer looking at the correct answer
              highlighted on their own screen should know why that is safe. */}
          <p className="border-t border-[#ece7de] px-5 py-4 text-xs text-[#6b6076] dark:border-[#2e2637] dark:text-[#9c93ad]">
            The correct answer is shown to you because you author this bank. It is held in a
            separate table that no candidate can read under any condition, and a paper built from
            these questions carries the options without it.
          </p>
        </Card>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <Card className="mt-8 w-full max-w-lg">
            <CardHeader title="Add a question" subtitle="To a course you teach" />
            <form onSubmit={add} className="space-y-4 p-5">
              <div>
                <label htmlFor="qb-course" className="text-xs font-semibold uppercase tracking-wide text-[#a49bb0]">
                  Course
                </label>
                <select
                  id="qb-course"
                  required
                  value={form.courseId}
                  onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                  className={input}
                >
                  {teaching.map((t) => (
                    <option key={t.course_id} value={t.course_id}>
                      {t.course_code} — {t.course_title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="qb-topic" className="text-xs font-semibold uppercase tracking-wide text-[#a49bb0]">
                    Topic
                  </label>
                  <input
                    id="qb-topic"
                    value={form.topic}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                    className={input}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label htmlFor="qb-difficulty" className="text-xs font-semibold uppercase tracking-wide text-[#a49bb0]">
                    Difficulty
                  </label>
                  <select
                    id="qb-difficulty"
                    value={form.difficulty}
                    onChange={(e) => setForm({ ...form, difficulty: e.target.value as Item['difficulty'] })}
                    className={input}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="qb-prompt" className="text-xs font-semibold uppercase tracking-wide text-[#a49bb0]">
                  Question
                </label>
                <textarea
                  id="qb-prompt"
                  required
                  rows={3}
                  value={form.prompt}
                  onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                  className={input}
                />
              </div>

              <fieldset>
                <legend className="text-xs font-semibold uppercase tracking-wide text-[#a49bb0]">
                  Options — choose the correct one
                </legend>
                <div className="mt-2 space-y-2">
                  {form.options.map((o, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="radio"
                        id={`qb-answer-${i}`}
                        name="qb-answer"
                        checked={form.answerIndex === i}
                        onChange={() => setForm({ ...form, answerIndex: i })}
                        aria-label={`Option ${i + 1} is correct`}
                      />
                      <input
                        id={`qb-option-${i}`}
                        value={o}
                        onChange={(e) => {
                          const next = [...form.options];
                          next[i] = e.target.value;
                          setForm({ ...form, options: next });
                        }}
                        className={input}
                        placeholder={`Option ${i + 1}`}
                        aria-label={`Option ${i + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </fieldset>

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" className={BTN_SECONDARY} onClick={() => setShowNew(false)}>
                  <X size={14} /> Cancel
                </button>
                <button type="submit" className={BTN_PRIMARY} disabled={busy}>
                  {busy ? 'Saving…' : 'Bank this question'}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
