'use client';

// ---------------------------------------------------------------------------
// ASSESSMENTS — everything with a date on it.
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY ASKED FOR
// ---------------------------------------------------------------------------
//
// "Give the student a dedicated Assessments. Upcoming: BLT 501 Assignment 1,
// Due 24 September. BLT 502 Mid-Semester Examination, 12 October. BLT 503
// Research Paper, 20 October. Submitted: etc. This should eventually connect
// directly to the lecturer's assignment and grading system."
//
// ---------------------------------------------------------------------------
// ONE LIST, TWO TABLES, AND THAT IS THE POINT
// ---------------------------------------------------------------------------
//
// An assignment is a `module_records` row a lecturer typed into a form. An
// examination is an `examinations` row with the whole proctoring apparatus
// behind it. They have almost nothing in common inside this system.
//
// A student holds them as one list — things due, in date order — and the
// existing Assignments screen could not be that list because it knows nothing
// about examinations, while the examination screens know nothing about
// assignments. 071's `my_assessments` unions them, and this screen is the
// reason it exists.
//
// ---------------------------------------------------------------------------
// OVERDUE IS ITS OWN SECTION, ABOVE UPCOMING
// ---------------------------------------------------------------------------
//
// A list sorted by date puts a missed deadline at the top of the past and out
// of sight. The one thing a student most needs to see is the piece of work
// whose date has gone and which they have not submitted, so it is lifted out
// and put first — and nothing else on the screen competes with it.
//
// A date that could not be read is NOT overdue and not hidden either. It sits
// in its own group at the foot, because "no date set" is a thing to ask a
// lecturer about, and quietly dropping those rows is how an assignment goes
// missing.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, EmptyState, PageHeader, SkeletonRows } from '@/components/ui/portal';
import { within } from '@/components/academic/ProgrammeRegister';
import { useJourney } from '@/contexts/JourneyContext';
import { meaningOf } from '@/lib/studentJourney';
import {
  AlertTriangle, CheckCircle2, ClipboardCheck, FileText, PenTool,
} from 'lucide-react';

// eslint-disable-next-line max-len
const COLUMNS = 'student_id, kind, item_id, course_id, course_code, course_title, item_title, due_on, opens_at, closes_at, mode, detail, submitted_at';

export interface Assessment {
  kind: 'assignment' | 'examination';
  item_id: string;
  course_code: string;
  course_title: string;
  item_title: string;
  due_on: string | null;
  opens_at: string | null;
  closes_at: string | null;
  mode: string | null;
  detail: string | null;
  submitted_at: string | null;
}

/** Shared with the dashboard's "Upcoming assessment" card. */
export async function readAssessments(): Promise<
  { items: Assessment[]; failed: string | null }
> {
  try {
    const { data, error } = await within(
      supabase.from('my_assessments').select(COLUMNS),
    );
    if (error) return { items: [], failed: error.message };
    return { items: (data ?? []) as unknown as Assessment[], failed: null };
  } catch (e) {
    return {
      items: [],
      failed: e instanceof Error ? e.message : 'Your assessments could not be read.',
    };
  }
}

export type Bucket = 'overdue' | 'upcoming' | 'submitted' | 'past' | 'undated';

/**
 * Which section an item belongs in.
 *
 * SUBMITTED WINS OVER OVERDUE. A piece of work handed in late is handed in,
 * and telling a student it is still overdue after they have submitted it is
 * both wrong and alarming. Only an UNSUBMITTED item whose date has gone is
 * overdue.
 *
 * AN EXAMINATION IS NEVER SUBMITTED HERE. There is no submission row for one —
 * a sitting is recorded by the examination system — so a paper whose date has
 * passed goes to 'past' rather than accusing the candidate of missing it.
 */
export function bucketOf(a: Assessment, today: string): Bucket {
  if (a.submitted_at) return 'submitted';
  if (!a.due_on) return 'undated';
  if (a.due_on >= today) return 'upcoming';
  return a.kind === 'examination' ? 'past' : 'overdue';
}

/** "24 September", the way the University wrote it. */
export function readableDate(iso: string | null): string {
  if (!iso) return 'No date set';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 'No date set';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

/** How many days off, said in words rather than in a number of days. */
export function howSoon(iso: string | null, today: string): string | null {
  if (!iso) return null;
  const days = Math.round(
    (new Date(`${iso}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime())
    / 86400000,
  );
  if (Number.isNaN(days)) return null;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1 && days <= 14) return `In ${days} days`;
  if (days < -1 && days >= -14) return `${Math.abs(days)} days ago`;
  return null;
}

const SECTIONS: { key: Bucket; title: string; note?: string }[] = [
  { key: 'overdue', title: 'Overdue', note: 'The date has passed and nothing has been submitted.' },
  { key: 'upcoming', title: 'Upcoming' },
  { key: 'submitted', title: 'Submitted' },
  { key: 'past', title: 'Past' },
  {
    key: 'undated',
    title: 'No date set',
    note: 'Your lecturer has not given these a date, or gave one the system could not read. '
      + 'They are shown rather than hidden — ask about them.',
  },
];

export default function MyAssessments() {
  const { stage } = useJourney();
  const [items, setItems] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { items: i, failed: f } = await readAssessments();
    setItems(i); setFailed(f); setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const today = new Date().toISOString().slice(0, 10);

  const grouped = useMemo(() => {
    const out: Record<Bucket, Assessment[]> = {
      overdue: [], upcoming: [], submitted: [], past: [], undated: [],
    };
    for (const a of items) out[bucketOf(a, today)].push(a);
    // Upcoming reads soonest first; everything in the past reads most recent
    // first, because "what did I just hand in" is the question asked of it.
    out.overdue.sort((a, b) => (a.due_on ?? '').localeCompare(b.due_on ?? ''));
    out.upcoming.sort((a, b) => (a.due_on ?? '').localeCompare(b.due_on ?? ''));
    out.past.sort((a, b) => (b.due_on ?? '').localeCompare(a.due_on ?? ''));
    out.submitted.sort((a, b) => (b.submitted_at ?? '').localeCompare(a.submitted_at ?? ''));
    return out;
  }, [items, today]);

  if (failed) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title="Your assessments could not be read"
          description={`${failed}. If migration 071 has not been run on this database, the view `
            + 'this screen reads does not exist yet.'}
        />
      </Card>
    );
  }

  if (loading) return <Card className="overflow-hidden"><SkeletonRows rows={5} cols={3} /></Card>;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Assessments"
        subtitle={items.length === 0
          ? 'Your assignments and examinations, in one list'
          : `${grouped.upcoming.length} upcoming`
            + (grouped.overdue.length > 0 ? ` · ${grouped.overdue.length} overdue` : '')
            + ` · ${grouped.submitted.length} submitted`}
      />

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardCheck size={20} />}
            title="Nothing has been set for you yet"
            description={stage === 'registering' || stage === 'awaiting-programme'
              ? meaningOf(stage).says
              : 'No assignment or examination has been set on the courses you are registered '
                + 'for. This fills up as your lecturers set work.'}
          />
        </Card>
      ) : SECTIONS.map(({ key, title, note }) => {
        const rows = grouped[key];
        if (rows.length === 0) return null;
        return (
          <section key={key} className="space-y-2">
            <h2 className={`text-xs font-bold uppercase tracking-wide ${
              key === 'overdue' ? 'text-red-700 dark:text-red-300' : 'text-[#422e59] dark:text-[#c8b6e8]'
            }`}>
              {title} · {rows.length}
            </h2>
            {note && <p className="text-[11px] text-[#a49bb0] dark:text-[#7b7289]">{note}</p>}
            <Card className="divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
              {rows.map((a) => <Row key={`${a.kind}-${a.item_id}`} a={a} bucket={key} today={today} />)}
            </Card>
          </section>
        );
      })}
    </div>
  );
}

function Row({ a, bucket, today }: { a: Assessment; bucket: Bucket; today: string }) {
  const soon = howSoon(a.due_on, today);
  const isExam = a.kind === 'examination';
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 ${
      bucket === 'overdue' ? 'bg-red-50/60 dark:bg-red-950/20' : ''
    }`}>
      <span className={`shrink-0 ${isExam ? 'text-[#422e59] dark:text-[#c8b6e8]' : 'text-[#a07c12]'}`}>
        {bucket === 'submitted'
          ? <CheckCircle2 size={15} className="text-emerald-600" />
          : isExam ? <PenTool size={15} /> : <FileText size={15} />}
      </span>
      <span className="w-20 shrink-0 text-sm font-semibold text-[#422e59] dark:text-[#c8b6e8]">
        {a.course_code}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-[#33234a] dark:text-[#e4dcf0]">{a.item_title}</p>
        <p className="truncate text-[11px] text-[#a49bb0]">
          {a.course_title}
          {/* THE KIND IS NAMED. A row saying only "Mid-Semester" leaves the
              student guessing whether it is a paper to sit or work to hand in,
              which are different weeks of their life. */}
          {' · '}
          {isExam ? `Examination${a.mode && a.mode !== 'standard' ? ` (${a.mode})` : ''}` : 'Assignment'}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-sm tabular-nums ${
          bucket === 'overdue' ? 'font-semibold text-red-700 dark:text-red-300'
            : 'text-[#33234a] dark:text-[#e4dcf0]'
        }`}>
          {bucket === 'submitted' && a.submitted_at
            ? `Submitted ${readableDate(a.submitted_at.slice(0, 10))}`
            : readableDate(a.due_on)}
        </p>
        {bucket !== 'submitted' && soon && (
          <p className={`text-[11px] ${
            bucket === 'overdue' ? 'text-red-600 dark:text-red-400' : 'text-[#a49bb0]'
          }`}>
            {soon}
          </p>
        )}
      </div>
    </div>
  );
}
