'use client';

// Timetable & attendance — class scheduling per course/day and attendance
// capture. Stored on the shared documents table:
//   'timetable-slot'  — one scheduled class
//   'attendance'      — one attendance record (slot id + matric + status)
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { CalendarDays, Plus, UserCheck, Trash2 } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Slot {
  id: string;
  day: string;
  start: string;
  end: string;
  course: string;
  lecturer: string;
  room: string;
}

interface Attendance {
  id: string;
  slotId: string;
  matric: string;
  status: 'present' | 'absent';
  date: string;
}

const enc = (o: unknown) => `data:application/json;base64,${btoa(unescape(encodeURIComponent(JSON.stringify(o))))}`;
const dec = (u: string) => JSON.parse(decodeURIComponent(escape(atob(u.split('base64,')[1]))));

export default function TimetableModule() {
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'lecturer';
  const [slots, setSlots] = useState<Slot[]>([]);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [markFor, setMarkFor] = useState<Slot | null>(null);
  const [matric, setMatric] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ day: 'Monday', start: '08:00', end: '10:00', course: '', lecturer: '', room: '' });

  async function load() {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .in('document_type', ['timetable-slot', 'attendance'])
      .order('uploaded_at', { ascending: true });
    if (!data) return;
    const s: Slot[] = [];
    const a: Attendance[] = [];
    for (const row of data as any[]) {
      try {
        const j = dec(row.file_url);
        if (row.document_type === 'timetable-slot') s.push({ id: row.id, ...j });
        else a.push({ id: row.id, date: row.uploaded_at, ...j });
      } catch {
        /* skip */
      }
    }
    setSlots(s);
    setRecords(a);
  }
  useEffect(() => {
    load();
  }, []);

  async function addSlot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await supabase.from('documents').insert({
      file_name: `${form.day} ${form.start} · ${form.course}`,
      file_url: enc(form),
      file_type: 'application/json',
      document_type: 'timetable-slot',
    });
    setBusy(false);
    setShowNew(false);
    setForm({ day: 'Monday', start: '08:00', end: '10:00', course: '', lecturer: '', room: '' });
    load();
  }

  async function mark(status: 'present' | 'absent') {
    if (!markFor || !matric.trim()) return;
    setBusy(true);
    await supabase.from('documents').insert({
      file_name: `${markFor.course} · ${matric} · ${status}`,
      file_url: enc({ slotId: markFor.id, matric: matric.trim().toUpperCase(), status }),
      file_type: 'application/json',
      document_type: 'attendance',
    });
    setBusy(false);
    setMatric('');
    load();
  }

  const byDay = useMemo(
    () => DAYS.map((d) => ({ day: d, items: slots.filter((s) => s.day === d).sort((a, b) => a.start.localeCompare(b.start)) })),
    [slots],
  );

  const rate = useMemo(() => {
    if (records.length === 0) return null;
    const present = records.filter((r) => r.status === 'present').length;
    return Math.round((present / records.length) * 100);
  }, [records]);

  const input =
    'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#422e59]/30';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Timetable &amp; Attendance</h2>
          <p className="text-sm text-gray-500">Weekly class schedule and attendance records</p>
        </div>
        {isStaff && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 rounded-xl bg-[#422e59] px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-purple-900/20 hover:bg-[#322244]"
          >
            <Plus size={16} /> Add Class
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['Scheduled classes', String(slots.length)],
          ['Attendance records', String(records.length)],
          ['Attendance rate', rate === null ? '—' : `${rate}%`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-gray-100 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-800">{value}</p>
          </div>
        ))}
      </div>

      {slots.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-[#ece7f4] bg-white p-10 text-center text-sm text-gray-400">
          No classes scheduled yet.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {byDay
            .filter((d) => d.items.length > 0)
            .map((d) => (
              <div key={d.day} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <p className="flex items-center gap-2 border-b border-gray-100 pb-3 text-sm font-bold text-[#422e59]">
                  <CalendarDays size={15} /> {d.day}
                </p>
                <div className="mt-3 space-y-3">
                  {d.items.map((s) => {
                    const present = records.filter((r) => r.slotId === s.id && r.status === 'present').length;
                    return (
                      <div key={s.id} className="rounded-xl bg-gray-50 p-3">
                        <p className="text-xs font-mono font-bold text-[#422e59]">
                          {s.start}–{s.end}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-gray-800">{s.course}</p>
                        <p className="text-xs text-gray-500">
                          {s.lecturer}
                          {s.room ? ` · ${s.room}` : ''}
                        </p>
                        {isStaff && (
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              onClick={() => setMarkFor(s)}
                              className="flex items-center gap-1 rounded-lg bg-[#f6f4fa] px-2.5 py-1 text-xs font-semibold text-[#422e59]"
                            >
                              <UserCheck size={12} /> Attendance ({present})
                            </button>
                            <button
                              aria-label="Remove class"
                              onClick={async () => {
                                await supabase.from('documents').delete().eq('id', s.id);
                                load();
                              }}
                              className="rounded-lg bg-red-50 p-1.5 text-red-600"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowNew(false)}>
          <form onSubmit={addSlot} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-6">
            <h3 className="text-lg font-bold text-gray-800">Add Class to Timetable</h3>
            <select className={input} value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>
              {DAYS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <input required type="time" className={input} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
              <input required type="time" className={input} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
            </div>
            <input required placeholder="Course (e.g. THE-BA Systematic Theology)" className={input} value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} />
            <input required placeholder="Lecturer" className={input} value={form.lecturer} onChange={(e) => setForm({ ...form, lecturer: e.target.value })} />
            <input placeholder="Room or online link" className={input} value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
            <button disabled={busy} className="w-full rounded-xl bg-[#422e59] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#322244] disabled:opacity-60">
              {busy ? 'Saving…' : 'Add to Timetable'}
            </button>
          </form>
        </div>
      )}

      {markFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setMarkFor(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-6">
            <h3 className="text-lg font-bold text-gray-800">Attendance — {markFor.course}</h3>
            <p className="text-xs text-gray-500">
              {markFor.day} {markFor.start}–{markFor.end}
            </p>
            <input
              placeholder="Student matric number"
              className={input}
              value={matric}
              onChange={(e) => setMatric(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') mark('present');
              }}
            />
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={() => mark('present')}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                Mark Present
              </button>
              <button
                disabled={busy}
                onClick={() => mark('absent')}
                className="flex-1 rounded-xl bg-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-60"
              >
                Mark Absent
              </button>
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto pt-2">
              {records
                .filter((r) => r.slotId === markFor.id)
                .map((r) => (
                  <p key={r.id} className="flex justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-xs">
                    <span className="font-mono text-gray-700">{r.matric}</span>
                    <span className={r.status === 'present' ? 'text-emerald-600' : 'text-gray-400'}>{r.status}</span>
                  </p>
                ))}
            </div>
            <button onClick={() => setMarkFor(null)} className="w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm text-gray-700">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
