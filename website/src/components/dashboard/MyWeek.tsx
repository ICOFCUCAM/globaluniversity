'use client';

// "My Week" — a student's live agenda assembled from the modules that
// already hold the data: assignment briefs, timetable slots, live classes
// and announcements.
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CalendarClock, ClipboardList, Video, Megaphone } from 'lucide-react';

interface Item {
  kind: 'assignment' | 'class' | 'live' | 'notice';
  title: string;
  meta: string;
  due?: string;
}

const dec = (u: string) => JSON.parse(decodeURIComponent(escape(atob(u.split('base64,')[1]))));

const STYLES: Record<Item['kind'], { icon: React.ReactNode; chip: string; label: string }> = {
  assignment: { icon: <ClipboardList size={15} />, chip: 'bg-amber-50 text-amber-700', label: 'Assignment' },
  class: { icon: <CalendarClock size={15} />, chip: 'bg-[#f6f4fa] text-[#422e59]', label: 'Class' },
  live: { icon: <Video size={15} />, chip: 'bg-red-50 text-red-600', label: 'Live / Recorded' },
  notice: { icon: <Megaphone size={15} />, chip: 'bg-emerald-50 text-emerald-700', label: 'Notice' },
};

export default function MyWeek() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('documents')
        .select('file_name, file_url, document_type, uploaded_at')
        .in('document_type', ['assignment-brief', 'timetable-slot', 'live-class', 'announcement'])
        .order('uploaded_at', { ascending: false })
        .limit(40);

      const list: Item[] = [];
      for (const d of (data ?? []) as any[]) {
        try {
          const j = dec(d.file_url);
          if (d.document_type === 'assignment-brief') {
            list.push({ kind: 'assignment', title: `${j.title}`, meta: j.course ?? '', due: j.due });
          } else if (d.document_type === 'timetable-slot') {
            list.push({ kind: 'class', title: j.course, meta: `${j.day} ${j.start}–${j.end}${j.room ? ' · ' + j.room : ''}` });
          } else if (d.document_type === 'live-class') {
            list.push({ kind: 'live', title: j.title, meta: `${j.course} · ${j.time}${j.lecturer ? ' · ' + j.lecturer : ''}` });
          } else {
            list.push({ kind: 'notice', title: j.title, meta: j.audience ?? 'All' });
          }
        } catch {
          /* skip malformed */
        }
      }

      // Assignments with the nearest due date first, then everything else.
      list.sort((a, b) => {
        if (a.due && b.due) return a.due.localeCompare(b.due);
        if (a.due) return -1;
        if (b.due) return 1;
        return 0;
      });
      setItems(list.slice(0, 8));
      setLoading(false);
    })();
  }, []);

  return (
    <div className="rounded-2xl border border-[#ece7de] dark:border-[#2e2637] bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-[#33234a] dark:text-[#e4dcf0]">My Week</h3>
        <span className="text-xs text-[#a49bb0] dark:text-[#7b7289]">Deadlines, classes and notices</span>
      </div>

      <div className="mt-5 space-y-3">
        {loading && <p className="py-6 text-center text-sm text-[#a49bb0] dark:text-[#7b7289]">Loading…</p>}
        {!loading && items.length === 0 && (
          <p className="rounded-xl border-2 border-dashed border-[#ece7f4] p-8 text-center text-sm text-[#a49bb0] dark:text-[#7b7289]">
            Nothing scheduled yet. Assignments, classes and announcements will appear here.
          </p>
        )}
        {items.map((it, i) => {
          const st = STYLES[it.kind];
          const overdue = it.due ? new Date(it.due) < new Date() : false;
          return (
            <div key={`${it.kind}-${i}`} className="flex items-start gap-3 rounded-xl bg-gray-50 p-3">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${st.chip}`}>{st.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#33234a] dark:text-[#e4dcf0]">{it.title}</p>
                <p className="truncate text-xs text-[#6b6076] dark:text-[#9c93ad]">
                  {st.label}
                  {it.meta ? ` · ${it.meta}` : ''}
                </p>
              </div>
              {it.due && (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    overdue ? 'bg-red-50 text-red-600' : 'bg-[#f7dc79] text-[#422e59]'
                  }`}
                >
                  {overdue ? 'overdue' : `due ${it.due}`}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
