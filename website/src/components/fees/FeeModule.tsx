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
  const [payments, setPayments] = useState<any[]>([]);
  const [tableMissing, setTableMissing] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [form, setForm] = useState({ student_id: '', amount: '', currency: 'FCFA', purpose: 'Tuition', method: 'MTN Mobile Money' });

  /**
   * Payments come from `payments` now, with the old document-blob receipts read
   * alongside so nothing recorded before the table existed disappears.
   *
   * The legacy rows are shown, not migrated. Rewriting historic financial
   * records in place is not something to do quietly in a page load — a finance
   * office needs to migrate them deliberately, with someone answerable for the
   * result. They are marked so the two are distinguishable.
   */
  async function load() {
    const [{ data: pay, error: payErr }, { data: legacy }, { data: s }] = await Promise.all([
      supabase.from('payments').select('*').order('received_at', { ascending: false }),
      supabase.from('documents').select('*').eq('document_type', 'fee-receipt').order('uploaded_at', { ascending: false }),
      supabase.from('students').select('id, matric_no, first_name, last_name').order('last_name'),
    ]);
    // The table is absent until the migration is run; say so rather than
    // showing an empty ledger as though no money had been taken.
    setTableMissing(!!payErr);
    setPayments((pay ?? []) as any[]);
    setReceipts(legacy ?? []);
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
    const { error } = await supabase.from('payments').insert({
      student_id: form.student_id || null,
      reference: no,
      amount: Number(form.amount),
      currency: form.currency,
      purpose: form.purpose,
      method: form.method,
    });

    setBusy(false);
    if (error) {
      // A payment that failed to record must never look recorded. The finance
      // officer has the student in front of them and has taken the money.
      setRecordError(
        `Not recorded: ${error.message}. The payment has NOT been saved — do not issue a receipt.`,
      );
      return;
    }
    setRecordError(null);
    setShowNew(false);
    setForm({ student_id: '', amount: '', currency: 'FCFA', purpose: 'Tuition', method: 'MTN Mobile Money' });
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
    'w-full px-3 py-2 bg-gray-50 rounded-lg border border-[#ded6c8] dark:border-[#3d3349] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35';
  // Totals per currency. Currencies are never added together: the university
  // charges an ICOF scholarship rate and a European rate, and one combined
  // figure across both would be a number the finance office could not explain.
  const totals: Record<string, number> = {};
  for (const p of payments) {
    const v = Number(p.amount);
    if (Number.isFinite(v)) totals[p.currency] = (totals[p.currency] ?? 0) + v;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">Fees & Receipts</h2>
          <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">Record tuition payments and issue receipts</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-xl bg-[#422e59] px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-purple-900/20 transition-colors hover:bg-[#322244]"
        >
          <Plus size={16} /> Record Payment
        </button>
      </div>

      {tableMissing && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          <strong>The payments table does not exist yet.</strong> Run
          <code className="mx-1 rounded bg-white/60 px-1 dark:bg-black/20">000_complete.sql</code>
          before taking any payment. Until then nothing can be recorded, and the figures below
          cover only receipts kept under the old document format.
        </div>
      )}

      {recordError && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {recordError}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#a49bb0] dark:text-[#7b7289]">Payments recorded</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[#33234a] dark:text-[#e4dcf0]">{payments.length}</p>
          {receipts.length > 0 && (
            <p className="mt-1 text-xs text-[#a49bb0]">
              plus {receipts.length} under the old document format, shown below but not counted in
              the totals
            </p>
          )}
        </div>
        <div className="rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#a49bb0] dark:text-[#7b7289]">Total collected</p>
          <p className="mt-1 text-xl font-bold text-emerald-600">
            {Object.keys(totals).length === 0
              ? '—'
              : Object.entries(totals)
                  .map(([cur, amt]) => `${amt.toLocaleString()} ${cur}`)
                  .join(' · ')}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27]">
        <div className="divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
          {receipts.length === 0 && (
            <p className="p-10 text-center text-sm text-[#a49bb0] dark:text-[#7b7289]">No payments recorded yet.</p>
          )}
          {receipts.map((r) => (
            <button key={r.id} onClick={() => open(r)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-[#faf8f4] dark:hover:bg-[#241f2c]">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Banknote size={16} />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-[#4a4155] dark:text-[#c8c1d4]">{r.file_name}</span>
              <span className="text-xs text-[#a49bb0] dark:text-[#7b7289]">{new Date(r.uploaded_at).toLocaleDateString()}</span>
            </button>
          ))}
        </div>
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowNew(false)}>
          <form onSubmit={record} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-6">
            <h3 className="font-heading text-lg font-bold text-[#422e59] dark:text-[#e4dcf0]">Record Payment</h3>
            <select required className={input} value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
              <option value="">Select student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.last_name} {s.first_name} — {s.matric_no}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input required type="number" min={1} placeholder="Amount" className={input} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              <select className={input + ' max-w-[110px]'} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                {['FCFA', 'USD', 'EUR', 'GBP', 'NGN'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <select className={input} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
              {['Tuition', 'Registration', 'Accommodation', 'Examination', 'Graduation', 'Other'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select className={input} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              {['MTN Mobile Money', 'Orange Money', 'Bank Transfer', 'Card / Online Payment', 'PayPal', 'Western Union', 'MoneyGram', 'Cash'].map((m) => (
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
                  <div key={k} className="flex justify-between border-b border-[#f0ece4] dark:border-[#2a2333] pb-1.5">
                    <span className="capitalize text-[#6b6076] dark:text-[#9c93ad]">{k.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-[#33234a] dark:text-[#e4dcf0]">{String(v)}</span>
                  </div>
                ))}
                <p className="pt-2 text-center text-[10px] text-[#a49bb0] dark:text-[#7b7289]">Thank you. Keep this receipt for your records.</p>
              </div>
            </div>
            <div className="mt-4 flex justify-center gap-3 print:hidden">
              <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-xl bg-[#f7dc79] px-5 py-2 text-sm font-semibold text-[#422e59]">
                <Printer size={14} /> Print
              </button>
              <button onClick={() => setView(null)} className="rounded-xl bg-white px-5 py-2 text-sm text-[#4a4155] dark:text-[#c8c1d4]">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
