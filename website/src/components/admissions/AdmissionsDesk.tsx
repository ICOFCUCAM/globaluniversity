'use client';

// ---------------------------------------------------------------------------
// The two admissions desks.
//
// Finance sees only applications awaiting a fee. The Registrar sees only
// applications Finance has already turned blue. That is not a display choice:
// `financeQueue` and `registrarQueue` filter on different statuses, so the
// Registrar's list cannot contain an unpaid applicant even momentarily.
//
// One component serves both desks because the two screens are the same shape —
// a queue, a record, one decision — and keeping them together makes it obvious
// that the only difference between them is which queue they read and which
// transition they may perform.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, Wallet, Loader2, AlertTriangle, Mail, RefreshCw, FileQuestion, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/roles';
import type { Student } from '@/lib/types';
import {
  financeQueue,
  registrarQueue,
  processedApplications,
  registerFeePayment,
  declineApplication,
  approveApplication,
  requestDocuments,
  stageOf,
  stages,
  stageChipClass,
} from '@/lib/admissions';

type Desk = 'finance' | 'registrar';

function StageChip({ student }: { student: Student }) {
  const stage = stageOf(student);
  const meta = stages[stage];
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${stageChipClass[meta.tone]}`}>
      {meta.label}
    </span>
  );
}

/** The full application text is stored in `address` after a marker. */
function applicationDetail(student: Student): { summary: string; contact: string } {
  const raw = student.address ?? '';
  const marker = '--- FULL APPLICATION ---';
  const i = raw.indexOf(marker);
  if (i === -1) return { summary: '', contact: raw };
  return { contact: raw.slice(0, i).trim(), summary: raw.slice(i + marker.length).trim() };
}

export default function AdmissionsDesk({ desk }: { desk: Desk }) {
  const { user } = useAuth();
  const [queue, setQueue] = useState<Student[]>([]);
  const [processed, setProcessed] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ tone: 'ok' | 'warn' | 'bad'; message: string } | null>(null);

  // Finance form
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('FCFA');
  // Registrar form
  const [note, setNote] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [docsMessage, setDocsMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [q, p] = await Promise.all([
        desk === 'finance' ? financeQueue() : registrarQueue(),
        processedApplications(),
      ]);
      setQueue(q);
      setProcessed(p);
      setSelected((cur) => (cur ? q.find((s) => s.id === cur.id) ?? null : null));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [desk]);

  useEffect(() => {
    void load();
  }, [load]);

  const detail = useMemo(() => (selected ? applicationDetail(selected) : null), [selected]);

  async function onRegisterFee() {
    if (!selected || !reference.trim()) return;
    setBusy(true);
    try {
      await registerFeePayment(selected.id, {
        reference: reference.trim(),
        amount: amount.trim(),
        currency,
        byUserId: user?.id ?? '',
      });
      setFlash({
        tone: 'ok',
        message: `Fee registered for ${selected.matric_no}. The record is now blue and has passed to the Office of the Registrar.`,
      });
      setReference('');
      setAmount('');
      setSelected(null);
      await load();
    } catch (e) {
      setFlash({ tone: 'bad', message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function onApprove() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await approveApplication(selected.id, { byUserId: user?.id ?? '', note: note.trim() || undefined });
      if (!res.ok) {
        setFlash({ tone: 'bad', message: `Not approved — ${res.error}` });
      } else if ((res as { emailSent?: boolean }).emailSent === false) {
        // The account exists but the email did not go. Say so precisely: the
        // applicant is admitted and does not yet know it.
        setFlash({
          tone: 'warn',
          message: `Account created for ${res.email}, but the welcome email could not be sent (${res.error}). The applicant has NOT been told. Their password is shown in the response and must be passed on another way.`,
        });
      } else {
        setFlash({ tone: 'ok', message: `Approved. Account created and credentials emailed to ${res.email}.` });
      }
      setNote('');
      setSelected(null);
      await load();
    } catch (e) {
      setFlash({ tone: 'bad', message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function onDecline() {
    if (!selected || !declineReason.trim()) return;
    setBusy(true);
    try {
      await declineApplication(selected.id, { reason: declineReason.trim(), byUserId: user?.id ?? '' });
      setFlash({ tone: 'ok', message: `Application ${selected.matric_no} declined.` });
      setDeclineReason('');
      setSelected(null);
      await load();
    } catch (e) {
      setFlash({ tone: 'bad', message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function onRequestDocuments() {
    if (!selected || !docsMessage.trim()) return;
    setBusy(true);
    try {
      await requestDocuments(selected.id, { message: docsMessage.trim(), byUserId: user?.id ?? '' });
      setFlash({
        tone: 'ok',
        message: `Documents requested from ${selected.first_name} ${selected.last_name}. The record stays in this queue until they respond.`,
      });
      setDocsMessage('');
      setSelected(null);
      await load();
    } catch (e) {
      setFlash({ tone: 'bad', message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const isFinance = desk === 'finance';
  // The role matrix decides, not the desk prop. Finance cannot admit and the
  // Registrar cannot verify payments — those two absences are the separation of
  // duties, so they are checked here rather than assumed from which screen the
  // user happens to be looking at.
  const mayVerifyPayment = can(user?.role, 'verify-payment');
  const mayAdmit = can(user?.role, 'admit-student');
  const mayRequestDocs = can(user?.role, 'request-documents');
  const mayReject = can(user?.role, 'reject-application');

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#422e59]">
            {isFinance ? 'Finance — Application Fees' : 'Office of the Registrar — Admissions'}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            {isFinance
              ? 'Applications awaiting the application fee. Registering a payment turns the record from red to blue and passes it to the Office of the Registrar.'
              : 'Applications whose fee Finance has registered. Approving an application creates the student’s account on their chosen programme and emails them their login details.'}
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </header>

      {flash && (
        <div
          className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm ${
            flash.tone === 'ok'
              ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
              : flash.tone === 'warn'
                ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
                : 'bg-red-50 text-red-800 ring-1 ring-red-200'
          }`}
        >
          {flash.tone === 'ok' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0" />}
          <p className="flex-1">{flash.message}</p>
          <button onClick={() => setFlash(null)} className="shrink-0 text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
          Could not load the queue: {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        {/* Queue */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
              {isFinance ? 'Awaiting fee' : 'Awaiting examination'}
            </p>
            <p className="mt-0.5 text-2xl font-bold text-[#422e59]">{queue.length}</p>
          </div>
          {loading ? (
            <p className="flex items-center gap-2 px-4 py-6 text-sm text-gray-500">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </p>
          ) : queue.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500">
              {isFinance
                ? 'No applications are waiting for a fee to be registered.'
                : 'No applications are waiting. Applications appear here once Finance registers the application fee.'}
            </p>
          ) : (
            <ul className="max-h-[32rem] divide-y divide-gray-100 overflow-y-auto">
              {queue.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => setSelected(s)}
                    className={`w-full px-4 py-3 text-left transition hover:bg-gray-50 ${
                      selected?.id === s.id ? 'bg-[#422e59]/5' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-[#422e59]">
                        {s.first_name} {s.last_name}
                      </span>
                      <StageChip student={s} />
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-gray-500">{s.matric_no}</p>
                    <p className="mt-1 truncate text-xs text-gray-600">
                      {s.degree_type ? `${s.degree_type} · ` : ''}
                      {s.program || 'Programme not stated'}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Record */}
        <div className="rounded-xl border border-gray-200 bg-white">
          {!selected ? (
            <p className="px-6 py-16 text-center text-sm text-gray-500">
              Select an application from the queue.
            </p>
          ) : (
            <div className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-[#422e59]">
                    {selected.first_name} {selected.middle_name} {selected.last_name}
                  </h2>
                  <p className="mt-1 font-mono text-xs text-gray-500">{selected.matric_no}</p>
                </div>
                <StageChip student={selected} />
              </div>

              <dl className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {[
                  ['Programme applied for', selected.program || '—'],
                  ['Level', selected.degree_type || '—'],
                  ['Email', selected.email || '—'],
                  ['Phone', selected.phone || '—'],
                  ['Nationality', selected.nationality || '—'],
                  ['Admission year', String(selected.admission_year ?? '—')],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{k}</dt>
                    <dd className="mt-0.5 text-sm text-gray-800">{v}</dd>
                  </div>
                ))}
              </dl>

              {detail?.summary && (
                <details className="mt-6 rounded-lg border border-gray-200 bg-gray-50">
                  <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold text-[#422e59]">
                    Full application as submitted
                  </summary>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap px-4 pb-4 text-xs leading-relaxed text-gray-700">
                    {detail.summary}
                  </pre>
                </details>
              )}

              {/* Finance action */}
              {isFinance && !mayVerifyPayment && (
                <p className="mt-7 flex items-start gap-2 rounded-xl bg-gray-50 p-5 text-sm text-gray-600 ring-1 ring-gray-200">
                  <Lock size={16} className="mt-0.5 shrink-0" />
                  Your role cannot verify payments. Only the Finance Administrator may do so.
                </p>
              )}
              {isFinance && mayVerifyPayment && (
                <div className="mt-7 rounded-xl bg-[#faf6ee] p-5">
                  <h3 className="flex items-center gap-2 font-bold text-[#422e59]">
                    <Wallet size={18} /> Register the application fee
                  </h3>
                  <p className="mt-1.5 text-xs text-gray-600">
                    Registering the payment turns this record blue and makes it visible to the Office
                    of the Registrar. It does not admit the applicant.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                        Payment reference *
                      </span>
                      <input
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="Receipt or transaction number"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#c9a227] focus:outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                        Amount received
                      </span>
                      <input
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="e.g. 10,000 FCFA"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#c9a227] focus:outline-none"
                      />
                    </label>
                  </div>
                  <button
                    onClick={() => void onRegisterFee()}
                    disabled={busy || !reference.trim()}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#422e59] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#33234a] disabled:opacity-40"
                  >
                    {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                    Register payment — turn blue
                  </button>
                </div>
              )}

              {/* Registrar actions */}
              {!isFinance && !mayAdmit && (
                <p className="mt-7 flex items-start gap-2 rounded-xl bg-gray-50 p-5 text-sm text-gray-600 ring-1 ring-gray-200">
                  <Lock size={16} className="mt-0.5 shrink-0" />
                  Your role cannot admit students. Only the Registrar Administrator may approve,
                  reject or request documents.
                </p>
              )}
              {!isFinance && mayAdmit && (
                <div className="mt-7 space-y-4">
                  <div className="rounded-xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
                    <h3 className="flex items-center gap-2 font-bold text-emerald-900">
                      <CheckCircle2 size={18} /> Approve
                    </h3>
                    <p className="mt-1.5 text-xs text-emerald-800">
                      Approving creates this applicant&rsquo;s account on{' '}
                      <strong>{selected.program || 'the programme they selected'}</strong> and emails
                      them their matriculation number, username and password. This cannot be undone
                      from here.
                    </p>
                    <label className="mt-3 block">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                        Note to include in the welcome email (optional)
                      </span>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                      />
                    </label>
                    <button
                      onClick={() => void onApprove()}
                      disabled={busy}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-40"
                    >
                      {busy ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                      Approve, create account and send credentials
                    </button>
                  </div>

                  {mayRequestDocs && (
                    <div className="rounded-xl bg-amber-50 p-5 ring-1 ring-amber-200">
                      <h3 className="flex items-center gap-2 font-bold text-amber-900">
                        <FileQuestion size={18} /> Request more documents
                      </h3>
                      <p className="mt-1.5 text-xs text-amber-800">
                        The application returns to the applicant. It stays in this queue rather than
                        disappearing, so an applicant who never responds stays visible.
                      </p>
                      <label className="mt-3 block">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-amber-800">
                          What is needed * — name the documents precisely
                        </span>
                        <textarea
                          value={docsMessage}
                          onChange={(e) => setDocsMessage(e.target.value)}
                          rows={2}
                          placeholder="e.g. Certified copy of your A-Level certificate and a clear scan of your passport data page."
                          className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                        />
                      </label>
                      <button
                        onClick={() => void onRequestDocuments()}
                        disabled={busy || !docsMessage.trim()}
                        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:opacity-40"
                      >
                        {busy ? <Loader2 size={15} className="animate-spin" /> : <FileQuestion size={15} />}
                        Request documents
                      </button>
                    </div>
                  )}

                  {mayReject && (
                  <div className="rounded-xl bg-gray-50 p-5 ring-1 ring-gray-200">
                    <h3 className="flex items-center gap-2 font-bold text-gray-800">
                      <XCircle size={18} /> Reject
                    </h3>
                    <label className="mt-3 block">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                        Reason * — a rejected applicant with no reason has no route to reapply
                      </span>
                      <textarea
                        value={declineReason}
                        onChange={(e) => setDeclineReason(e.target.value)}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                      />
                    </label>
                    <button
                      onClick={() => void onDecline()}
                      disabled={busy || !declineReason.trim()}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-400 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-40"
                    >
                      Reject application
                    </button>
                  </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recently processed */}
      {processed.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Recently decided</p>
          </div>
          <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto">
            {processed.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="font-mono text-[11px] text-gray-500">{s.matric_no}</span>
                <span className="flex-1 font-medium text-[#422e59]">
                  {s.first_name} {s.last_name}
                </span>
                <span className="text-xs text-gray-600">{s.program}</span>
                <StageChip student={s} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
