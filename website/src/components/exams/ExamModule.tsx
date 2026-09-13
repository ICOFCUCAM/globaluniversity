// ---------------------------------------------------------------------------
// THE EXAMINATION SCHEDULE — what is set, when it opens, and how long it runs.
//
// ---------------------------------------------------------------------------
// WHAT THIS FILE USED TO BE, AND WHY IT IS GONE
// ---------------------------------------------------------------------------
//
// It was a working computer-based test, complete in itself: four invented
// examinations (AI Mid-Term, DBMS Final, Web Tech Practical, ML Quiz 3), ten
// hardcoded multiple-choice questions about MySQL, MongoDB and polymorphism, a
// countdown timer, an answer sheet, a flagging mechanism and a marking routine.
//
// None of it touched the University's examination system.
//
// That system already exists and is the real one: `examinations`,
// `exam_sessions`, `exam_answers`, `exam_events`, the identity and device
// checks of migration 015, the proctoring routes under /api/exam, and
// SitExamination.tsx — six hundred lines of it — reached from "Sit an
// examination" in the sidebar.
//
// So the portal had TWO answers to "how does a student sit an examination".
// One of them was proctored, sealed, audited and refused to mark a paper
// nobody had approved. The other awarded a score in the browser for questions
// about a curriculum the University does not teach. A student who found this
// screen first would have taken the wrong one, and the mark would have gone
// nowhere.
//
// A duplicate implementation of something this consequential is not a
// convenience. It is a second, weaker truth, and this codebase has already
// removed one of those — see the note in /api/credential about there being one
// answer to "is this document genuine".
//
// WHAT REMAINS is the thing the screen is named for in the sidebar: the
// schedule. It reads the real table, shows what is actually set, and sends
// anybody who wants to sit a paper to the screen that can actually invigilate
// one.
// ---------------------------------------------------------------------------

import React, { useEffect, useState } from 'react';
import { Card, EmptyState, SkeletonRows } from '@/components/ui/portal';
import { supabase } from '@/lib/supabase';
import { Clock, FileText, CalendarClock } from 'lucide-react';

// A SINGLE STRING LITERAL. Concatenation makes supabase-js collapse the
// inferred row type to GenericStringError[], silently.
// eslint-disable-next-line max-len
const COLUMNS = 'id, course_code, course_title, title, mode, duration_minutes, opens_at, closes_at, total_marks, pass_mark, status';

interface Examination {
  id: string;
  course_code: string | null;
  course_title: string | null;
  title: string;
  mode: string;
  duration_minutes: number | null;
  opens_at: string | null;
  closes_at: string | null;
  total_marks: number | null;
  pass_mark: number | null;
  status: string;
}

/**
 * The status as a reader should see it.
 *
 * 015's vocabulary is written for the machine — `questions_approved` is a state
 * in a workflow, not a sentence — so it is translated rather than upper-cased.
 */
const STATUS_LABEL: Record<string, string> = {
  draft: 'Being set',
  questions_approved: 'Paper approved',
  published: 'Scheduled',
  in_progress: 'Sitting now',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

const STATUS_TONE: Record<string, string> = {
  in_progress: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300',
  published: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300',
  closed: 'bg-gray-100 text-[#6b6076] dark:bg-[#2e2637] dark:text-[#9c93ad]',
  cancelled: 'bg-gray-100 text-[#6b6076] dark:bg-[#2e2637] dark:text-[#9c93ad]',
};

function when(exam: Examination): string {
  if (!exam.opens_at) return 'No date set';
  const opens = new Date(exam.opens_at);
  return opens.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function ExamModule() {
  const [exams, setExams] = useState<Examination[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('examinations')
        .select(COLUMNS)
        .order('opens_at', { ascending: true, nullsFirst: false })
        .limit(200);
      setExams((data ?? []) as unknown as Examination[]);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">
          Examination schedule
        </h2>
        <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
          What the University has set, and when it runs. Papers are sat under proctoring from
          <span className="font-medium"> Sit an examination</span>.
        </p>
      </div>

      {exams === null && <SkeletonRows rows={3} />}

      {/* ---------------------------------------------------------------
          AN HONEST EMPTY STATE. This screen used to fill itself with four
          invented examinations, which meant it never had one — and nobody
          could tell whether the University had scheduled anything.
          --------------------------------------------------------------- */}
      {exams !== null && exams.length === 0 && (
        <EmptyState
          icon={<CalendarClock size={22} />}
          title="No examinations scheduled"
          description="Examinations are set in the Examination office, where a paper is written, approved and published before it appears here."
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(exams ?? []).map((exam) => (
          <Card key={exam.id}>
            <div className="flex items-start justify-between gap-3">
              <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                STATUS_TONE[exam.status] ?? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
              }`}>
                {(STATUS_LABEL[exam.status] ?? exam.status).toUpperCase()}
              </div>
              <span className="text-xs text-[#a49bb0] dark:text-[#7b7289] text-right">{when(exam)}</span>
            </div>

            <h4 className="text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0] mt-3">
              {exam.course_code ? `${exam.course_code}: ` : ''}{exam.title}
            </h4>
            {exam.course_title && (
              <p className="text-xs text-[#6b6076] dark:text-[#9c93ad] mt-0.5">{exam.course_title}</p>
            )}

            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-[#a49bb0] dark:text-[#7b7289]">
              {exam.duration_minutes != null && (
                <span className="flex items-center gap-1"><Clock size={10} /> {exam.duration_minutes} min</span>
              )}
              {/* MARKS, NOT A QUESTION COUNT. The old card said "40 questions"
                  from an invented field; the table records what a paper is
                  marked out of, and the number of questions belongs to the
                  paper, which this screen deliberately does not open. */}
              {exam.total_marks != null && (
                <span className="flex items-center gap-1"><FileText size={10} /> {exam.total_marks} marks</span>
              )}
              {exam.pass_mark != null && exam.total_marks != null && (
                <span>pass {exam.pass_mark}</span>
              )}
              <span className="capitalize">{exam.mode}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
