'use client';

// Announcements — university-wide and course notices.
// Stored on the shared documents table (document_type 'announcement')
// until a dedicated table is provisioned; payload is a data-URL JSON.
import React, { useEffect, useState } from 'react';
import { write } from '@/lib/write';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Megaphone, Plus, Pin, Trash2 } from 'lucide-react';

interface Row {
  id: string;
  file_name: string;
  file_url: string;
  verified: boolean;
  uploaded_at: string;
}

interface Notice {
  id: string;
  title: string;
  body: string;
  audience: string;
  pinned: boolean;
  posted: string;
}

const AUDIENCES = ['All', 'Students', 'Lecturers', 'Faculty of Theology', 'Faculty of Education', 'Engineering & Technology', 'GIBMAS'];

function decode(r: Row): Notice | null {
  try {
    const json = JSON.parse(decodeURIComponent(escape(atob(r.file_url.split('base64,')[1]))));
    return { id: r.id, pinned: r.verified, posted: r.uploaded_at, ...json };
  } catch {
    return null;
  }
}

export default function AnnouncementModule() {
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'lecturer';
  const [notices, setNotices] = useState<Notice[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', audience: 'All' });

  async function load() {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('document_type', 'announcement')
      .order('uploaded_at', { ascending: false });
    if (data) {
      const list = (data as Row[]).map(decode).filter(Boolean) as Notice[];
      list.sort((a, b) => Number(b.pinned) - Number(a.pinned));
      setNotices(list);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify(form))));
    await write(supabase.from('documents').insert({
      file_name: `${form.audience} · ${form.title}`,
      file_url: `data:application/json;base64,${payload}`,
      file_type: 'application/json',
      document_type: 'announcement',
    }), 'save the announcement');
    setBusy(false);
    setShowNew(false);
    setForm({ title: '', body: '', audience: 'All' });
    load();
  }

  const input =
    'w-full px-3 py-2 bg-gray-50 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">Announcements</h2>
          <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
            {isStaff ? 'Publish notices to the university community' : 'Notices from the university and your faculty'}
          </p>
        </div>
        {isStaff && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 rounded-xl bg-[#422e59] px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-purple-900/20 transition-colors hover:bg-[#322244]"
          >
            <Plus size={16} /> New Announcement
          </button>
        )}
      </div>

      <div className="space-y-4">
        {notices.length === 0 && (
          <p className="rounded-2xl border-2 border-dashed border-[#ece7f4] bg-white p-10 text-center text-sm text-[#a49bb0] dark:text-[#7b7289]">
            No announcements yet.
          </p>
        )}
        {notices.map((n) => (
          <article
            key={n.id}
            className={`rounded-2xl border bg-white p-6 shadow-sm ${
              n.pinned ? 'border-[#e9c14a]' : 'border-[#ece7de] dark:border-[#2e2637]'
            }`}
          >
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f6f4fa] text-[#422e59]">
                <Megaphone size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-[#33234a] dark:text-[#e4dcf0]">{n.title}</h3>
                  {n.pinned && (
                    <span className="rounded-full bg-[#f7dc79] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#422e59]">
                      Pinned
                    </span>
                  )}
                  <span className="rounded-full bg-[#f6f4fa] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#422e59]">
                    {n.audience}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">{n.body}</p>
                <p className="mt-3 text-xs text-[#a49bb0] dark:text-[#7b7289]">
                  Posted {new Date(n.posted).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                </p>
              </div>
              {isStaff && (
                <div className="flex shrink-0 gap-2">
                  <button
                    aria-label={n.pinned ? 'Unpin' : 'Pin'}
                    onClick={async () => {
                      await write(supabase.from('documents').update({ verified: !n.pinned }).eq('id', n.id), 'save the announcement');
                      load();
                    }}
                    className={`rounded-lg p-2 ${n.pinned ? 'bg-[#f7dc79] text-[#422e59]' : 'bg-gray-100 text-[#6b6076] dark:text-[#9c93ad]'}`}
                  >
                    <Pin size={14} />
                  </button>
                  <button
                    aria-label="Delete announcement"
                    onClick={async () => {
                      await write(supabase.from('documents').delete().eq('id', n.id), 'save the announcement');
                      load();
                    }}
                    className="rounded-lg bg-red-50 p-2 text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowNew(false)}>
          <form onSubmit={post} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-6">
            <h3 className="font-heading text-lg font-bold text-[#422e59] dark:text-[#e4dcf0]">New Announcement</h3>
            <input required placeholder="Title" className={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <textarea required rows={5} placeholder="Message" className={input} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            <select className={input} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
              {AUDIENCES.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
            <button disabled={busy} className="w-full rounded-xl bg-[#422e59] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#322244] disabled:opacity-60">
              {busy ? 'Publishing…' : 'Publish Announcement'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
