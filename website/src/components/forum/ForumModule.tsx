'use client';

// Discussion forum — course-scoped threads and replies.
// Stored on the shared documents table: 'forum-thread' and 'forum-reply'
// (reply file_name carries the parent thread id).
import React, { useEffect, useState } from 'react';
import { write } from '@/lib/write';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { MessageSquare, Plus, CornerDownRight, Send } from 'lucide-react';

interface Row {
  id: string;
  file_name: string;
  file_url: string;
  document_type: string;
  uploaded_at: string;
}

interface Thread {
  id: string;
  course: string;
  title: string;
  body: string;
  author: string;
  posted: string;
}

interface Reply {
  id: string;
  threadId: string;
  body: string;
  author: string;
  posted: string;
}

const enc = (o: unknown) => `data:application/json;base64,${btoa(unescape(encodeURIComponent(JSON.stringify(o))))}`;
const dec = (u: string) => JSON.parse(decodeURIComponent(escape(atob(u.split('base64,')[1]))));

export default function ForumModule() {
  const { user } = useAuth();
  const author = user?.name || user?.email || 'Member';
  const [threads, setThreads] = useState<Thread[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ course: '', title: '', body: '' });
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .in('document_type', ['forum-thread', 'forum-reply'])
      .order('uploaded_at', { ascending: true });
    if (!data) return;
    const t: Thread[] = [];
    const r: Reply[] = [];
    for (const row of data as Row[]) {
      try {
        const j = dec(row.file_url);
        if (row.document_type === 'forum-thread') {
          t.push({ id: row.id, posted: row.uploaded_at, ...j });
        } else {
          r.push({ id: row.id, threadId: row.file_name.split('::')[0], posted: row.uploaded_at, ...j });
        }
      } catch {
        /* skip malformed */
      }
    }
    setThreads(t.reverse());
    setReplies(r);
  }
  useEffect(() => {
    load();
  }, []);

  async function createThread(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await write(supabase.from('documents').insert({
      file_name: `${form.course} :: ${form.title}`,
      file_url: enc({ ...form, author }),
      file_type: 'application/json',
      document_type: 'forum-thread',
    }), 'post to the forum');
    setBusy(false);
    setShowNew(false);
    setForm({ course: '', title: '', body: '' });
    load();
  }

  async function postReply(threadId: string) {
    if (!replyText.trim()) return;
    setBusy(true);
    await write(supabase.from('documents').insert({
      file_name: `${threadId}::reply`,
      file_url: enc({ body: replyText, author }),
      file_type: 'application/json',
      document_type: 'forum-reply',
    }), 'post to the forum');
    setBusy(false);
    setReplyText('');
    load();
  }

  const input =
    'w-full px-3 py-2 bg-gray-50 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">Discussion Forum</h2>
          <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">Ask questions and discuss your courses with classmates and lecturers</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-xl bg-[#422e59] px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-purple-900/20 transition-colors hover:bg-[#322244]"
        >
          <Plus size={16} /> New Topic
        </button>
      </div>

      <div className="space-y-4">
        {threads.length === 0 && (
          <p className="rounded-2xl border-2 border-dashed border-[#ece7f4] bg-white p-10 text-center text-sm text-[#a49bb0] dark:text-[#7b7289]">
            No discussions yet — start the first topic.
          </p>
        )}
        {threads.map((t) => {
          const tReplies = replies.filter((r) => r.threadId === t.id);
          const isOpen = openThread === t.id;
          return (
            <article key={t.id} className="rounded-2xl border border-[#ece7de] dark:border-[#2e2637] bg-white shadow-sm">
              <button
                onClick={() => setOpenThread(isOpen ? null : t.id)}
                className="flex w-full items-start gap-4 p-6 text-left"
                aria-expanded={isOpen}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f6f4fa] text-[#422e59]">
                  <MessageSquare size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#33234a] dark:text-[#e4dcf0]">{t.title}</span>
                    {t.course && (
                      <span className="rounded-full bg-[#f6f4fa] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#422e59]">
                        {t.course}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-xs text-[#a49bb0] dark:text-[#7b7289]">
                    {t.author} · {new Date(t.posted).toLocaleDateString('en-GB', { dateStyle: 'medium' })} ·{' '}
                    {tReplies.length} {tReplies.length === 1 ? 'reply' : 'replies'}
                  </span>
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-[#ece7de] dark:border-[#2e2637] px-6 pb-6 pt-4">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">{t.body}</p>
                  <div className="mt-5 space-y-3">
                    {tReplies.map((r) => (
                      <div key={r.id} className="flex gap-3 rounded-xl bg-gray-50 p-4">
                        <CornerDownRight size={15} className="mt-0.5 shrink-0 text-[#422e59]" />
                        <div>
                          <p className="text-sm text-[#4a4155] dark:text-[#c8c1d4]">{r.body}</p>
                          <p className="mt-1 text-xs text-[#a49bb0] dark:text-[#7b7289]">
                            {r.author} · {new Date(r.posted).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <input
                      placeholder="Write a reply…"
                      className={input}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') postReply(t.id);
                      }}
                    />
                    <button
                      disabled={busy}
                      onClick={() => postReply(t.id)}
                      className="flex items-center gap-1.5 rounded-lg bg-[#422e59] px-4 text-sm font-medium text-white hover:bg-[#322244] disabled:opacity-60"
                    >
                      <Send size={14} /> Reply
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowNew(false)}>
          <form onSubmit={createThread} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-6">
            <h3 className="font-heading text-lg font-bold text-[#422e59] dark:text-[#e4dcf0]">New Discussion Topic</h3>
            <input placeholder="Course code (optional)" className={input} value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} />
            <input required placeholder="Topic title" className={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <textarea required rows={5} placeholder="Your question or comment" className={input} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            <button disabled={busy} className="w-full rounded-xl bg-[#422e59] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#322244] disabled:opacity-60">
              {busy ? 'Posting…' : 'Post Topic'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
