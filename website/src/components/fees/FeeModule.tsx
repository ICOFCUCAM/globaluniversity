'use client';

// Fee records & receipts — stored on the shared documents table
// (document_type 'fee-receipt') until a dedicated fees table is
// provisioned. Receipt payload is a data-URL JSON for printing.
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Banknote, Plus, Printer } from 'lucide-react';

interface Receipt {
  id: string;
  student_id: string | null;
  file_name: string;
  file_url: string;
  uploaded_at: string;
}

interface StudentOpt {
  id: string;
  matric_no: string;
  first_name: string;
  last_name: string;
}

export default function FeeModule() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [view, setView] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ student_id: '', amount: '', purpose: 'Tuition', method: 'MTN Mobile Money' });

  async function load() {
    const [{ data: r }, { data: s }] = await Promise.all([
      supabase.from('documents').select('*').eq('document_type', 'fee-receipt').order('uploaded_at', { ascending: false }),
      supabase.from('students').select('id, matric_no, first_name, last_name').order('last_name'),
    ]);
    if (r) setReceipts(r);
    if (s) setStudents(s);
  }
  useEffect(() => {
    load();
  }, []);

  async function record(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const student = students.find((s) => s.id === form.student_id);
    const no = `RCPT-${Date.now().toString(36).toUpperCase()}`;
    const payload = {
      receipt_no: no,
      student: student ? `${student.last_name} ${student.first_name}` : '',
      matric_no: student?.matric_no ?? '',
      amount_fcfa: form.amount,
      purpose: form.purpose,
      method: form.method,
      date: new Date().toISOString().slice(0, 10),
    };
    await supabase.from('documents').insert({
      student_id: form.student_id || null,
      file_name: `${no} · ${payload.matric_no} · ${Number(form.amount).toLocaleString()} FCFA · ${form.purpose} (${form.method})`,
      file_url: `data:application/json;base64,${btoa(unescape(encodeURIComponent(JSON.stringify(payload))))}`,
      file_type: 'application/json',
      document_type: 'fee-receipt',
    });
    setBusy(false);
    setShowNew(false);
    setForm({ student_id: '', amount: '', purpose: 'Tuition', method: 'MTN Mobile Money' });
    load();
  }

  function open(r: Receipt) {
    try {
      const b64 = r.file_url.split('base64,')[1];
      setView(JSON.parse(decodeURIComponent(escape(atob(b64)))));
    } catch {
      /* legacy row */
    }
  }

  const input =
    'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#422e59]/30';
  const total = receipts.reduce((sum, r) => {
    const m = r.file_name.match(/· ([\d,]+) FCFA/);
    return sum + (m ? Number(m[1].replace(/,/g, '')) : 0);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Fees & Receipts</h2>
          <p className="text-sm text-gray-500">Record tuition payments and issue receipts</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-xl bg-[#422e59] px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-purple-900/20 transition-colors hover:bg-[#322244]"
        >
          <Plus size={16} /> Record Payment
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Payments recorded</p>
          <p className="mt-1 text-2xl font-bold text-gray-800">{receipts.length}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total collected</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{total.toLocaleString()} FCFA</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
        <div className="divide-y divide-gray-50">
          {receipts.length === 0 && (
            <p className="p-8 text-center text-sm text-gray-400">No payments recorded yet.</p>
          )}
          {receipts.map((r) => (
            <button key={r.id} onClick={() => open(r)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-gray-50">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Banknote size={16} />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{r.file_name}</span>
              <span className="text-xs text-gray-400">{new Date(r.uploaded_at).toLocaleDateString()}</span>
            </button>
          ))}
        </div>
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowNew(false)}>
          <form onSubmit={record} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-6">
            <h3 className="text-lg font-bold text-gray-800">Record Payment</h3>
            <select required className={input} value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
              <option value="">Select student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.last_name} {s.first_name} — {s.matric_no}
                </option>
              ))}
            </select>
            <input required type="number" min={1} placeholder="Amount (FCFA)" className={input} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <select className={input} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
              {['Tuition', 'Registration', 'Accommodation', 'Examination', 'Graduation', 'Other'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select className={input} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              {['MTN Mobile Money', 'Orange Money', 'Bank Transfer', 'Cash'].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <button disabled={busy} className="w-full rounded-xl bg-[#422e59] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#322244] disabled:opacity-60">
              {busy ? 'Saving…' : 'Save & Issue Receipt'}
            </button>
          </form>
        </div>
      )}

      {view && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:static print:bg-white print:p-0" onClick={() => setView(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm">
            <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="p-5 text-center text-white" style={{ background: 'linear-gradient(135deg, #322244, #422e59)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/site-icon.png" alt="" className="mx-auto h-12 w-12 rounded-full bg-white/90 p-0.5" />
                <p className="mt-2 font-bold">ICOF Global University</p>
                <p className="text-[10px] uppercase tracking-[0.25em] text-[#f7dc79]">Official Receipt</p>
              </div>
              <div className="space-y-2 p-6 text-sm">
                {Object.entries(view).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-gray-100 pb-1.5">
                    <span className="capitalize text-gray-500">{k.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-gray-800">{k === 'amount_fcfa' ? `${Number(v).toLocaleString()} FCFA` : String(v)}</span>
                  </div>
                ))}
                <p className="pt-2 text-center text-[10px] text-gray-400">Thank you. Keep this receipt for your records.</p>
              </div>
            </div>
            <div className="mt-4 flex justify-center gap-3 print:hidden">
              <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-xl bg-[#f7dc79] px-5 py-2 text-sm font-semibold text-[#422e59]">
                <Printer size={14} /> Print
              </button>
              <button onClick={() => setView(null)} className="rounded-xl bg-white px-5 py-2 text-sm text-gray-700">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
