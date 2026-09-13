'use client';

// ---------------------------------------------------------------------------
// ANNOUNCEMENTS — addressed, not broadcast.
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY ASKED FOR
// ---------------------------------------------------------------------------
//
// "The announcement system you showed should feed directly into the student
// portal. But it should be targeted. University: University-wide announcement.
// Faculty: School of Theology announcement. Programme: MA Black Liberation
// Theology announcement. Course: BLT 501 announcement. Student-specific: Your
// registration requires attention. This is much more powerful than one generic
// announcement page."
//
// ---------------------------------------------------------------------------
// WHY THE ORDER IS THE FEATURE
// ---------------------------------------------------------------------------
//
// "Much more powerful" is exactly right, and the power is not in the labels —
// it is in what comes first. A student opening a single undifferentiated feed
// reads the top three items and stops, which is fine when everything is a
// university notice and catastrophic when one of them is "your registration
// requires attention" sitting eleventh.
//
// So the narrowest reach is drawn first and loudest: addressed to you, then
// your course, then your programme, then your School, then everybody. 073's
// `announcement_reach` decides that in SQL so this screen and anything built
// later cannot disagree about it.
//
// ---------------------------------------------------------------------------
// THE EXISTING MODULE IS NOT REPLACED
// ---------------------------------------------------------------------------
//
// `AnnouncementModule` is where the University WRITES announcements — drafting,
// clearance, approval, publication, retraction and the destinations they go
// out to. It stays exactly as it is and staff keep opening it.
//
// This is the reading side, for one student, and it exists because the writing
// screen was what a student was being given.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/portal';
import StudentScreen from './StudentScreen';
import { readMine } from '@/lib/studentReads';
import { AlertTriangle, Megaphone, Pin } from 'lucide-react';

// eslint-disable-next-line max-len
const COLUMNS = 'student_id, announcement_id, title, body, category, pinned, published_at, expires_at, reach, to_student, to_course, to_programme, to_school, course_code';

export interface Notice {
  announcement_id: string;
  title: string;
  body: string;
  category: string;
  pinned: boolean;
  published_at: string | null;
  reach: 'you' | 'course' | 'programme' | 'school' | 'university';
  course_code: string | null;
}

/**
 * How narrowly this was addressed, in words a student reads.
 *
 * `you` IS NOT CALLED "PERSONAL". It is called "For you" and it is drawn in
 * the University's gold, because the whole point of targeting is that this one
 * must not look like the other four.
 */
export const REACH: Record<Notice['reach'], { label: string; order: number }> = {
  you: { label: 'For you', order: 0 },
  course: { label: 'Your course', order: 1 },
  programme: { label: 'Your programme', order: 2 },
  school: { label: 'Your School', order: 3 },
  university: { label: 'University-wide', order: 4 },
};

/**
 * Narrowest first, then pinned, then newest.
 *
 * PINNED DOES NOT OUTRANK REACH. A pinned university notice must not push
 * "your registration requires attention" below it — pinning is the
 * University's emphasis, and being addressed to one person is stronger.
 */
export function inOrder(rows: Notice[]): Notice[] {
  return [...rows].sort((a, b) => REACH[a.reach].order - REACH[b.reach].order
    || (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
    || (b.published_at ?? '').localeCompare(a.published_at ?? ''));
}

export default function MyAnnouncements() {
  const [rows, setRows] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { rows: r, failed: f } = await readMine<Notice>('my_announcements', COLUMNS);
    setRows(r); setFailed(f); setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const ordered = useMemo(() => inOrder(rows), [rows]);
  const forYou = ordered.filter((n) => n.reach === 'you');

  return (
    <StudentScreen
      title="Announcements"
      subtitle={rows.length === 0 ? 'What the University is telling you'
        : `${rows.length} notice${rows.length === 1 ? '' : 's'}`
          + (forYou.length > 0 ? ` · ${forYou.length} for you` : '')}
      loading={loading}
      failed={failed}
      empty={rows.length === 0}
      icon={<Megaphone size={20} />}
      emptyTitle="Nothing to tell you"
      emptyWhy={'The University has published no notices for you, your course, your programme or '
        + 'your School.'}
    >
      <div className="space-y-3">
        {ordered.map((n) => <NoticeCard key={n.announcement_id} n={n} />)}
      </div>
    </StudentScreen>
  );
}

function NoticeCard({ n }: { n: Notice }) {
  const mine = n.reach === 'you';
  // 'emergency' IS THE UNIVERSITY'S OWN CATEGORY and is the one case where a
  // university-wide notice outranks everything visually — it is the category
  // that may be published without clearance, precisely because it is urgent.
  const urgent = n.category === 'emergency';
  return (
    <Card className={`p-4 ${
      urgent ? 'border-red-300 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20'
        : mine ? 'border-[#c5a55a]' : ''
    }`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <h2 className="min-w-0 font-heading text-sm font-bold text-[#33234a] dark:text-[#e4dcf0]">
          {urgent && (
            <AlertTriangle size={14} className="mr-1.5 inline text-red-600 dark:text-red-400" />
          )}
          {n.title}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          {n.pinned && <Pin size={12} className="text-[#a49bb0]" />}
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
            mine ? 'bg-[#422e59] text-white'
              : n.reach === 'course'
                ? 'bg-[#f6f4fa] text-[#422e59] dark:bg-[#2a2333] dark:text-[#c8b6e8]'
                : 'bg-[#f5f1ea] text-[#6b6076] dark:bg-[#241f2c] dark:text-[#9c93ad]'
          }`}>
            {REACH[n.reach].label}
            {n.reach === 'course' && n.course_code ? ` · ${n.course_code}` : ''}
          </span>
        </div>
      </div>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
        {n.body}
      </p>
      {n.published_at && (
        <p className="mt-2 text-[11px] text-[#a49bb0]">
          {new Date(n.published_at).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric',
          })}
          {n.category && n.category !== 'general' ? ` · ${n.category}` : ''}
        </p>
      )}
    </Card>
  );
}
