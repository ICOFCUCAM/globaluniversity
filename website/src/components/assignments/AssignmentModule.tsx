'use client';

// Assignments.
//
// This used to be "built on the shared documents table until a dedicated
// assignments table is provisioned". It could never have worked:
// documents.student_id is NOT NULL and neither write here set it, so every
// brief and every submission was rejected by the database. It now uses
// module_records — see src/lib/moduleStore.ts.
//
//   brief:      kind 'assignment-brief', body = the brief
//   submission: kind 'assignment-sub',   body.file = data-URL of the work,
//               parent_id = the brief it answers
import React, { useEffect, useState } from 'react';
import { write } from '@/lib/write';
import { listRecords, saveRecord, updateRecord, type ModuleRecord } from '@/lib/moduleStore';
import { useAuth } from '@/contexts/AuthContext';
import { ClipboardList, Plus, Download, CheckCircle2, Clock } from 'lucide-react';

/** A brief or a submission, flattened for the markup below. */
interface Doc {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  verified: boolean;
  uploaded_at: string;
  parent_id: string | null;
}

function flatten(r: ModuleRecord<Record<string, unknown>>): Doc {
  const b = r.body as Record<string, unknown>;
  return {
    id: r.id,
    file_name: r.title,
    file_url: String(b.file ?? ''),
    file_type: (b.fileType as string | null) ?? null,
    // Was documents.verified, a column meaning "the Registry confirmed this
    // document is genuine". Marking a submission as reviewed is a different
    // claim, so it lives in the record's own body now.
    verified: b.reviewed === true,
    uploaded_at: r.created_at,
    parent_id: r.parent_id,
  };
}

const toDataUrl = (file: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });

export default function AssignmentModule() {
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'lecturer';
  const [briefs, setBriefs] = useState<Doc[]>([]);
  const [subs, setSubs] = useState<Doc[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [brief, setBrief] = useState({ course: '', title: '', due: '', instructions: '' });
  const [submitFor, setSubmitFor] = useState<Doc | null>(null);
  const [matric, setMatric] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const rows = await listRecords('assignments', ['assignment-brief', 'assignment-sub']);
    setBriefs(rows.filter((r) => r.kind === 'assignment-brief').map(flatten));
    setSubs(rows.filter((r) => r.kind === 'assignment-sub').map(flatten));
  }
  useEffect(() => {
    load();
  }, []);

  async function createBrief(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await write(saveRecord({
      module: 'assignments',
      kind: 'assignment-brief',
      title: `${brief.course} — ${brief.title} — due ${brief.due}`,
      body: { ...brief },
    }), 'post the assignment');
    setBusy(false);
    if (!ok) return;
    setShowNew(false);
    setBrief({ course: '', title: '', due: '', instructions: '' });
    load();
  }

  async function submitWork(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !submitFor) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Please keep submissions under 2 MB.');
      return;
    }
    setBusy(true);
    const ok = await write(saveRecord({
      module: 'assignments',
      kind: 'assignment-sub',
      title: `${matric} ⟶ ${submitFor.file_name} ⟶ ${file.name}`,
      body: { file: await toDataUrl(file), fileType: file.type, matric, reviewed: false },
      // A real reference, so a submission cannot point at a brief that has been
      // removed. It used to be recovered by substring-matching the brief's
      // title inside the submission's, which counted every submission whose
      // filename happened to contain the same words.
      parentId: submitFor.id,
    }), 'submit your work');
    setBusy(false);
    if (!ok) return;
    setSubmitFor(null);
    setFile(null);
    load();
  }

  const input =
    'w-full px-3 py-2 bg-gray-50 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">Assignments</h2>
          <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
            {isStaff ? 'Publish assignments and review submissions' : 'View assignments and submit your work'}
          </p>
        </div>
        {isStaff && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#422e59] text-white rounded-xl text-sm font-medium hover:bg-[#322244] transition-colors shadow-lg shadow-purple-900/20"
          >
            <Plus size={16} /> New Assignment
          </button>
        )}
      </div>

      {/* Briefs */}
      <div className="grid gap-4 md:grid-cols-2">
        {briefs.length === 0 && (
          <p className="col-span-2 rounded-2xl border-2 border-dashed border-[#ece7f4] bg-white p-10 text-center text-sm text-[#a49bb0] dark:text-[#7b7289]">
            No assignments published yet.
          </p>
        )}
        {briefs.map((b) => {
          const count = subs.filter((s) => s.parent_id === b.id).length;
          return (
            <div key={b.id} className="rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27] p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f6f4fa] text-[#422e59]">
                    <ClipboardList size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0]">{b.file_name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-[#a49bb0] dark:text-[#7b7289]">
                      <Clock size={12} /> Posted {new Date(b.uploaded_at).toLocaleDateString()}
                      {isStaff && ` · ${count} submission${count === 1 ? '' : 's'}`}
                    </p>
                  </div>
                </div>
                {!isStaff && (
                  <button
                    onClick={() => setSubmitFor(b)}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Submit
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Submissions (staff) */}
      {isStaff && subs.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27]">
          <p className="border-b border-[#f0ece4] dark:border-[#2a2333] bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[#6b6076] dark:text-[#9c93ad]">
            Submissions
          </p>
          <div className="divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
            {subs.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <p className="min-w-0 flex-1 truncate text-sm text-[#4a4155] dark:text-[#c8c1d4]">{s.file_name}</p>
                <a
                  href={s.file_url}
                  download={s.file_name.split(' ⟶ ').pop()}
                  className="flex items-center gap-1 text-xs font-medium text-[#422e59] hover:underline"
                >
                  <Download size={13} /> Download
                </a>
                <button
                  onClick={async () => {
                    await write(updateRecord(s.id, {
                      body: { file: s.file_url, fileType: s.file_type, reviewed: !s.verified },
                    }), s.verified ? 'unmark the submission' : 'mark the submission as reviewed');
                    load();
                  }}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                    s.verified ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-[#6b6076] dark:text-[#9c93ad]'
                  }`}
                >
                  <CheckCircle2 size={13} /> {s.verified ? 'Marked' : 'Mark as reviewed'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New assignment modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowNew(false)}>
          <form onSubmit={createBrief} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-6">
            <h3 className="font-heading text-lg font-bold text-[#422e59] dark:text-[#e4dcf0]">New Assignment</h3>
            <input required placeholder="Course code (e.g. THE201)" className={input} value={brief.course} onChange={(e) => setBrief({ ...brief, course: e.target.value })} />
            <input required placeholder="Title" className={input} value={brief.title} onChange={(e) => setBrief({ ...brief, title: e.target.value })} />
            <input required type="date" className={input} value={brief.due} onChange={(e) => setBrief({ ...brief, due: e.target.value })} />
            <textarea rows={3} placeholder="Instructions" className={input} value={brief.instructions} onChange={(e) => setBrief({ ...brief, instructions: e.target.value })} />
            <button disabled={busy} className="w-full rounded-xl bg-[#422e59] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#322244] disabled:opacity-60">
              {busy ? 'Publishing…' : 'Publish Assignment'}
            </button>
          </form>
        </div>
      )}

      {/* Submit modal */}
      {submitFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSubmitFor(null)}>
          <form onSubmit={submitWork} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-6">
            <h3 className="font-heading text-lg font-bold text-[#422e59] dark:text-[#e4dcf0]">Submit Work</h3>
            <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">{submitFor.file_name}</p>
            <input required placeholder="Your matric number" className={input} value={matric} onChange={(e) => setMatric(e.target.value)} />
            <input required type="file" accept=".pdf,.doc,.docx,.txt,.zip,.jpg,.png" className={input} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <p className="text-xs text-[#a49bb0] dark:text-[#7b7289]">PDF/DOC/TXT/ZIP/JPG/PNG · max 2 MB</p>
            <button disabled={busy} className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
              {busy ? 'Uploading…' : 'Submit Assignment'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
