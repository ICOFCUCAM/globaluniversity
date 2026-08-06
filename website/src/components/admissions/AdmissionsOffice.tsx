'use client';

// ---------------------------------------------------------------------------
// The Admissions Office — the third and final desk.
//
//   Finance            registers the fee              → fee_paid
//   Registrar          verifies the record, forwards  → registrar_approved
//   Admissions Office  assesses, admits               → approved / conditional
//
// This screen holds the last of those. Admitting from here issues the student
// number, creates the account, and emails the applicant a complete admission
// package — the letter signed by the Head of Admissions, the conditions of the
// offer, the terms of study for their mode and for the other, the fee
// arrangements and the regulations they are accepting.
//
// The queue is `registrar_approved` only. A record the Registrar has not
// forwarded does not appear here and the route refuses it, so this office
// cannot admit an applicant whose documents were never verified.
//
// ADMITTING IS THE ONE ACTION IN THIS SYSTEM THAT CANNOT BE TAKEN BACK. The
// applicant is told. So the button asks for the name to sign under, states
// plainly what is about to happen, and reports what actually happened rather
// than assuming it worked.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { admissionsQueue } from '@/lib/admissions';
import { can } from '@/lib/roles';
import { statusMeta, toUniversal } from '@/lib/status';
import type { Student } from '@/lib/types';
import {
  Card, CardHeader, PageHeader, EmptyState, SkeletonRows, Detail,
} from '@/components/ui/portal';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL, FOCUS } from '@/lib/portalTheme';
import {
  Inbox, Send, ShieldAlert, CheckCircle2, AlertCircle, Plus, Trash2, Loader2, Mail,
} from 'lucide-react';

interface Condition { requirement: string; dueBy: string }

export default function AdmissionsOffice() {
  const { user } = useAuth();
  const allowed = can(user?.role, 'admit-student') && can(user?.role, 'process-applications');

  const [queue, setQueue] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const [signatory, setSignatory] = useState('');
  const [note, setNote] = useState('');
  const [conditions, setConditions] = useState<Condition[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const q = await admissionsQueue();
      setQueue(q);
      setSelected((cur) => (cur ? q.find((s) => s.id === cur.id) ?? null : null));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (allowed) void load(); }, [allowed, load]);
  useEffect(() => { setSignatory((s) => s || user?.name || ''); }, [user?.name]);

  async function admit() {
    if (!selected) return;
    setBusy(true);
    setResult(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setBusy(false);
      setResult({ ok: false, text: 'Your session has expired. Sign in again.' });
      return;
    }

    const res = await fetch('/api/admissions/admit', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        studentId: selected.id,
        note: note.trim() || undefined,
        conditions: conditions.filter((c) => c.requirement.trim() && c.dueBy.trim()),
        headOfAdmissions: signatory.trim() || undefined,
      }),
    }).then((r) => r.json()).catch(() => null);

    setBusy(false);

    if (!res?.ok) {
      setResult({ ok: false, text: explain(res?.error ?? 'no-response') });
      return;
    }
    if (res.emailSent) {
      setResult({
        ok: true,
        text: `Admitted. Student number ${res.studentNumber}. The admission package has been emailed to ${res.email}.`,
      });
    } else {
      // The admission stands; only delivery failed. Say exactly that, because
      // the applicant is now admitted and does not know it.
      setResult({
        ok: false,
        text: `Admitted as ${res.studentNumber}, but the package was NOT emailed (${res.error}). The applicant has not been told. Send it to ${res.email} yourself — the temporary password is ${res.password}.`,
      });
    }
    setNote('');
    setConditions([]);
    void load();
  }

  if (!allowed) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-950/30">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 flex-shrink-0 text-amber-600" size={20} />
          <div>
            <h2 className="font-semibold text-amber-900 dark:text-amber-200">Admissions Office</h2>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
              Admitting is held by the Admissions Office. Finance registers the fee, the Registrar
              verifies the record and forwards it, and this office makes the final assessment. No
              one office does more than one of those.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admissions Office — final assessment"
        subtitle="Records verified and forwarded by the Registrar. Admitting issues the student number, creates the account and emails the full admission package."
        action={
          <button onClick={() => void load()} className={BTN_SECONDARY}>Refresh</button>
        }
      />

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </p>
      )}

      {result && (
        <div
          role="alert"
          className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
            result.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200'
          }`}
        >
          {result.ok ? <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" /> : <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />}
          <p>{result.text}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-[#f0ece4] px-4 py-3 dark:border-[#2a2333]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a8194]">
              Awaiting assessment
            </p>
            <p className="mt-0.5 font-heading text-2xl font-bold tabular-nums text-[#422e59] dark:text-[#e4dcf0]">
              {queue.length}
            </p>
          </div>
          {loading ? (
            <SkeletonRows rows={4} cols={2} />
          ) : queue.length === 0 ? (
            <EmptyState
              icon={<Inbox size={20} />}
              title="Nothing awaiting assessment"
              description="Records appear here once the Office of the Registrar has verified them and forwarded them. Until then they are not yours to assess."
            />
          ) : (
            <ul className="max-h-[32rem] divide-y divide-[#f0ece4] overflow-y-auto dark:divide-[#2a2333]">
              {queue.map((s) => {
                const meta = statusMeta(toUniversal(s.status));
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => { setSelected(s); setResult(null); }}
                      className={`w-full px-4 py-3 text-left transition-colors hover:bg-[#faf8f4] dark:hover:bg-[#241f2c] ${FOCUS} ${
                        selected?.id === s.id ? 'bg-[#faf6ee] dark:bg-[#2a2333]' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 font-medium text-[#33234a] dark:text-[#e4dcf0]">
                          {[s.first_name, s.last_name].filter(Boolean).join(' ')}
                        </span>
                        <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.chip}`}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-[#a49bb0]">{s.matric_no}</p>
                      <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
                        {[s.degree_type, s.program].filter(Boolean).join(' · ')}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          {!selected ? (
            <EmptyState
              icon={<Inbox size={20} />}
              title="Select a record from the queue"
              description="Its details and the admission decision appear here."
            />
          ) : (
            <>
              <CardHeader
                title={[selected.first_name, selected.middle_name, selected.last_name].filter(Boolean).join(' ')}
                subtitle={selected.matric_no}
              />
              <dl className="divide-y divide-[#f0ece4] py-1 dark:divide-[#2a2333]">
                <Detail label="Programme">{[selected.degree_type, selected.program].filter(Boolean).join(' — ') || '—'}</Detail>
                <Detail label="Faculty">{(selected as any).faculty || '—'}</Detail>
                <Detail label="Intake">{(selected as any).intake || selected.admission_year || '—'}</Detail>
                <Detail label="Email">{selected.email || '—'}</Detail>
                <Detail label="Fee">
                  {(selected as any).fee_reference
                    ? `Registered — ${(selected as any).fee_amount ?? ''} ${(selected as any).fee_currency ?? ''} · ref ${(selected as any).fee_reference}`
                    : 'Not recorded'}
                </Detail>
                <Detail label="Registrar's note">{(selected as any).decision_reason || '—'}</Detail>
              </dl>

              <div className="space-y-4 border-t border-[#f0ece4] p-5 dark:border-[#2a2333]">
                <div>
                  <label htmlFor="signatory" className={LABEL}>Signed by (Head of Admissions)</label>
                  <input
                    id="signatory"
                    value={signatory}
                    onChange={(e) => setSignatory(e.target.value)}
                    placeholder="Name as it should appear on the letter"
                    className={`${INPUT} mt-1 max-w-md`}
                  />
                  <p className="mt-1 text-[11px] text-[#a49bb0]">
                    This name is printed under the signature rule on the admission letter. It should
                    be the person holding the office, not the account signed in.
                  </p>
                </div>

                <div>
                  <label htmlFor="note" className={LABEL}>Note to the applicant (optional)</label>
                  <textarea
                    id="note"
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className={`${INPUT} mt-1`}
                  />
                </div>

                <div>
                  <span className={LABEL}>Conditions (leave empty for an unconditional offer)</span>
                  <div className="mt-1.5 space-y-2">
                    {conditions.map((c, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2">
                        <input
                          value={c.requirement}
                          placeholder="e.g. Certified copy of secondary certificate"
                          onChange={(e) => {
                            const next = [...conditions];
                            next[i] = { ...next[i], requirement: e.target.value };
                            setConditions(next);
                          }}
                          className={`${INPUT} min-w-[240px] flex-1`}
                        />
                        <input
                          value={c.dueBy}
                          placeholder="by 30 September 2026"
                          onChange={(e) => {
                            const next = [...conditions];
                            next[i] = { ...next[i], dueBy: e.target.value };
                            setConditions(next);
                          }}
                          className={`${INPUT} w-48`}
                        />
                        <button
                          onClick={() => setConditions(conditions.filter((_, j) => j !== i))}
                          aria-label="Remove condition"
                          className={`rounded-lg p-2 text-[#a49bb0] hover:bg-red-50 hover:text-red-600 ${FOCUS}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setConditions([...conditions, { requirement: '', dueBy: '' }])}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#422e59] hover:underline dark:text-[#c9b6e6]"
                    >
                      <Plus size={13} /> Add a condition
                    </button>
                  </div>
                </div>

                {/* Said before the click, not after. */}
                <div className="flex items-start gap-2 rounded-lg border border-[#e8dcc0] bg-[#faf6ee] px-4 py-3 text-xs leading-relaxed text-[#6b5a2f] dark:border-[#3d3349] dark:bg-[#241f2c] dark:text-[#c3b48f]">
                  <Mail size={14} className="mt-0.5 flex-shrink-0" />
                  <p>
                    Admitting issues the student number, creates the student&apos;s account, and
                    emails <strong>{selected.email}</strong> the full admission package — the letter
                    signed as above, the conditions, the terms for {(selected as any).mode || 'their mode'} study
                    and for the other, the fee arrangements and the academic regulations.
                    <strong> The applicant will have been told. This cannot be taken back.</strong>
                  </p>
                </div>

                <button onClick={admit} disabled={busy || !selected.email} className={BTN_PRIMARY}>
                  {busy
                    ? <><Loader2 size={15} className="animate-spin" /> Admitting…</>
                    : <><Send size={15} /> Admit and send the package</>}
                </button>
                {!selected.email && (
                  <p className="text-xs text-red-700">
                    This application carries no email address, so the package cannot be delivered.
                    Add one before admitting.
                  </p>
                )}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function explain(error: string): string {
  if (error === 'service-role-key-missing') return 'SUPABASE_SERVICE_ROLE_KEY is not set in Vercel. Nothing was changed.';
  if (error.startsWith('not-forwarded-by-registrar')) {
    return 'This record has not been verified and forwarded by the Office of the Registrar, so it cannot be admitted here.';
  }
  if (error === 'no-email-on-application') return 'The application carries no email address.';
  if (error.startsWith('not-permitted:')) return 'Your role does not hold the capability to admit.';
  if (error === 'no-response') return 'The server did not respond. Nothing was changed.';
  return error;
}
