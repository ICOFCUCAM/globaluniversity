'use client';

// ---------------------------------------------------------------------------
// APPOINTMENTS — the board, and the form that creates one.
//
// ---------------------------------------------------------------------------
// WHAT THIS REPLACES
// ---------------------------------------------------------------------------
//
// Nothing, which is the point. The University had no screen for this because it
// had no record: an appointment lived in a word processor file and the letter
// WAS the record. Ask who reports to whom, or whose probation ends this month,
// and the system could not answer.
//
// ---------------------------------------------------------------------------
// THE FIVE COUNTERS ARE NOT DECORATION
// ---------------------------------------------------------------------------
//
// Each answers a question somebody is actually asking. "Letters to issue" is
// work sitting on a desk. "Expiring soon" is the one that earns its place: a
// fixed-term appointment that lapses because nobody noticed is somebody turning
// up to work at an institution that no longer employs them, and until the
// record existed the question could not be asked at all.
//
// THEY ARE COMPUTED IN THE LIBRARY, not here. A screen working them out inline
// would state the rules a second time, differently, and the two would disagree
// the first time a state was added.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/roles';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL, FOCUS } from '@/lib/portalTheme';
import { Plus, Loader2, Check, X, AlertTriangle, Users } from 'lucide-react';
import {
  EMPLOYMENT_TYPES, EMPLOYMENT_LABELS, CURRENCIES, SALARY_PERIODS, PERIOD_LABELS,
  countersFor, boardStatus, missingFrom, blocked, remunerationLine, probationEnds,
  STATE_LABELS, EXPIRING_WINDOW_DAYS,
  type Appointment, type AppointmentState,
} from '@/lib/appointments';

// A SINGLE STRING LITERAL. Concatenation makes supabase-js collapse the
// inferred type to GenericStringError[], silently.
// eslint-disable-next-line max-len
const COLUMNS = 'id, full_name, position_title, unit_name, employment_type, start_date, end_date, effective_date, probation_months, place_of_duty, reports_to_name, working_hours, appointing_authority, authority_decided_on, terms, status, drafted_by, authorized_by, issued_at';

type Row = Appointment & { id: string; issued_at?: string | null };

export default function Appointments() {
  const { user } = useAuth();
  const mayDraft = can(user?.role, 'draft-appointment');
  const mayApprove = can(user?.role, 'authorize-appointment');
  // WHAT SOMEBODY IS PAID IS NOT ORDINARY INSTITUTIONAL INFORMATION. The
  // screen reads the pay-free view unless the caller holds the authority that
  // sets pay, so a salary is not delivered to a browser that has no business
  // showing it.
  const maySeePay = can(user?.role, 'set-remuneration');

  const [rows, setRows] = useState<Row[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from(maySeePay ? 'appointments' : 'appointments_without_pay')
      .select(COLUMNS)
      .order('start_date', { ascending: false })
      .limit(300);
    setRows((data ?? []) as unknown as Row[]);
  }, [maySeePay]);

  useEffect(() => { void load(); }, [load]);

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setNotice(null);
    const { data: sess } = await supabase.auth.getSession();
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${sess.session?.access_token ?? ''}`,
      },
      body: JSON.stringify(payload),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setBusy(false);

    if (!json?.ok) {
      setNotice({
        tone: 'bad',
        text: json?.detail
          ?? json?.missing?.map((m: { message: string }) => m.message).join(' ')
          ?? json?.error ?? 'Nothing was recorded.',
      });
      return null;
    }
    setNotice({ tone: 'ok', text: json.detail ?? 'Saved.' });
    setReason('');
    await load();
    return json;
  }

  const counters = useMemo(() => countersFor(rows ?? []), [rows]);

  if (creating) {
    return (
      <NewAppointment
        maySetPay={maySeePay}
        busy={busy}
        notice={notice}
        onCancel={() => setCreating(false)}
        onSave={async (payload) => {
          const r = await act({ action: 'draft', ...payload });
          if (r) setCreating(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#422e59] dark:text-[#e9e2f2]">
            Appointments
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#6b6076] dark:text-[#9c93ad]">
            The University appoints somebody, a second officer approves it, the letter is
            generated from the record, and the staff account follows. In that order.
          </p>
        </div>
        {mayDraft && (
          <button onClick={() => { setCreating(true); setNotice(null); }} className={BTN_PRIMARY}>
            <Plus size={15} /> New appointment
          </button>
        )}
      </header>

      {notice && (
        <p className={`rounded-xl px-4 py-3 text-sm ${notice.tone === 'ok'
          ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'}`}>{notice.text}</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Counter label="Pending approval" value={counters.pendingApproval} />
        <Counter label="Approved" value={counters.approved} />
        <Counter label="Letters to issue" value={counters.lettersToIssue} />
        <Counter label="Active appointments" value={counters.active} />
        {/* THE ONE THAT EARNS ITS PLACE. A fixed term that lapses because
            nobody noticed is somebody turning up to work at an institution
            that no longer employs them. */}
        <Counter label={`Expiring within ${EXPIRING_WINDOW_DAYS} days`}
          value={counters.expiringSoon} alarming={counters.expiringSoon > 0} />
      </div>

      {rows === null && <p className="text-sm text-[#6b6076]">Loading…</p>}

      {rows !== null && rows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#ded6c8] p-10 text-center
                        dark:border-[#3d3349]">
          <Users size={22} className="mx-auto mb-3 text-[#a49bb0]" />
          <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
            No appointments recorded yet. Staff who predate this system are not listed here —
            they have no appointment behind them, which is exactly what this page now requires.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {(rows ?? []).map((a) => {
          const missing = missingFrom(a);
          return (
            <article key={a.id}
              className="rounded-2xl border border-[#e8e2f0] bg-white p-5 dark:border-[#332b3d]
                         dark:bg-[#1c1823]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-heading text-base font-bold text-[#422e59]
                                dark:text-[#e9e2f2]">{a.full_name}</p>
                  <p className="mt-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                    {a.position_title}
                    {a.unit_name ? ` · ${a.unit_name}` : ''}
                    {' · '}
                    {EMPLOYMENT_LABELS[a.employment_type as keyof typeof EMPLOYMENT_LABELS]
                      ?? a.employment_type}
                    {a.start_date ? ` · from ${a.start_date}` : ''}
                    {a.end_date ? ` to ${a.end_date}` : ''}
                  </p>
                  {/* THE QUESTION THE RECORD EXISTS TO ANSWER, and could not
                      be asked at all while the answer was in a .docx. */}
                  {probationEnds(a) && (
                    <p className="mt-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                      Probation ends {probationEnds(a)}
                    </p>
                  )}
                  {maySeePay && remunerationLine(a) && (
                    <p className="mt-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                      {remunerationLine(a)}
                    </p>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-[#f2eee6] px-3 py-1 text-xs font-medium
                                 text-[#4a4155] dark:bg-[#2a2333] dark:text-[#c8c1d4]">
                  {boardStatus(a)}
                </span>
              </div>

              {missing.length > 0 && (
                // SAID BEFORE ANYBODY APPROVES IT. All of it at once, so
                // nobody is sent back for the second thing after fixing the
                // first.
                <ul className="mt-3 space-y-1 rounded-lg bg-[#faf6ee] p-3 text-xs
                               text-[#6b5a2f] dark:bg-[#241f2c] dark:text-[#c3b48f]">
                  {missing.map((m) => (
                    <li key={m.key}>{m.blocking ? '' : 'Worth noting: '}{m.message}</li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {a.status === 'draft' && mayDraft && !blocked(missing) && (
                  <button disabled={busy} className={BTN_SECONDARY}
                    onClick={() => void act({ action: 'submit', id: a.id })}>
                    Send for approval
                  </button>
                )}

                {a.status === 'submitted' && mayApprove && (
                  a.drafted_by === user?.id ? (
                    // SAID RATHER THAN HIDDEN. A button that is simply absent
                    // leaves somebody wondering why.
                    <p className="flex items-center gap-2 rounded-lg bg-[#faf6ee] px-3 py-2
                                  text-xs text-[#6b5a2f] dark:bg-[#241f2c] dark:text-[#c3b48f]">
                      <AlertTriangle size={13} />
                      You drafted this, so somebody else has to approve it. An appointment letter
                      commits the University to paying somebody.
                    </p>
                  ) : (
                    <>
                      <button disabled={busy} className={BTN_PRIMARY}
                        onClick={() => void act({ action: 'decide', id: a.id, decision: 'approve' })}>
                        <Check size={14} /> Approve
                      </button>
                      <input value={reason} onChange={(e) => setReason(e.target.value)}
                        placeholder="What needs changing" className={`${INPUT} w-64 text-xs`} />
                      <button disabled={busy || reason.trim().length < 12} className={BTN_SECONDARY}
                        onClick={() => void act({
                          action: 'decide', id: a.id, decision: 'return', reason,
                        })}>
                        <X size={14} /> Return it
                      </button>
                    </>
                  )
                )}

                {['issued', 'accepted', 'active'].includes(String(a.status)) && mayDraft && (
                  <>
                    <input value={reason} onChange={(e) => setReason(e.target.value)}
                      placeholder="What changed" className={`${INPUT} w-64 text-xs`} />
                    <button disabled={busy || reason.trim().length < 12} className={BTN_SECONDARY}
                      onClick={() => void act({ action: 'amend', id: a.id, reason })}>
                      Request an amendment
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Counter({ label, value, alarming }: {
  label: string; value: number; alarming?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${alarming
      ? 'border-amber-300 bg-[#faf6ee] dark:border-[#5a4a2f] dark:bg-[#241f2c]'
      : 'border-[#e8e2f0] bg-white dark:border-[#332b3d] dark:bg-[#1c1823]'}`}>
      <p className="font-heading text-2xl font-bold text-[#422e59] dark:text-[#e9e2f2]">{value}</p>
      <p className="mt-1 text-xs leading-snug text-[#6b6076] dark:text-[#9c93ad]">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// THE FORM
// ---------------------------------------------------------------------------

function NewAppointment({
  maySetPay, busy, notice, onCancel, onSave,
}: {
  maySetPay: boolean;
  busy: boolean;
  notice: { tone: 'ok' | 'bad'; text: string } | null;
  onCancel: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [f, setF] = useState({
    fullName: '', email: '', phone: '', postalAddress: '',
    positionTitle: '', unitName: '', employmentType: 'permanent',
    startDate: '', endDate: '', effectiveDate: '', probationMonths: '',
    placeOfDuty: '', reportsToName: '', workingHours: '', terms: '',
    salaryAmount: '', salaryCurrency: 'FCFA', salaryPeriod: 'month',
    appointingAuthority: '', authorityDecidedOn: '',
  });

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  const asRecord: Appointment = {
    full_name: f.fullName, position_title: f.positionTitle, unit_name: f.unitName,
    employment_type: f.employmentType, start_date: f.startDate, end_date: f.endDate,
    effective_date: f.effectiveDate, place_of_duty: f.placeOfDuty, terms: f.terms,
    reports_to_name: f.reportsToName, postal_address: f.postalAddress,
    probation_months: f.probationMonths ? Number(f.probationMonths) : null,
    salary_amount: f.salaryAmount ? Number(f.salaryAmount) : null,
    salary_currency: f.salaryAmount ? f.salaryCurrency : null,
    salary_period: f.salaryAmount ? f.salaryPeriod : null,
  };
  const missing = missingFrom(asRecord);

  const Field = ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) => (
    <div className="space-y-1.5">
      <label htmlFor={id} className={LABEL}>{label}</label>
      {children}
    </div>
  );

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold text-[#422e59] dark:text-[#e9e2f2]">
          New appointment
        </h1>
        <p className="mt-1 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          Saved as a draft. Somebody other than you approves it, and only then is a letter
          generated — nobody is told anything by this screen.
        </p>
      </header>

      {notice && (
        <p className={`rounded-xl px-4 py-3 text-sm ${notice.tone === 'ok'
          ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'}`}>{notice.text}</p>
      )}

      <section className="space-y-4">
        <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-[#422e59]
                       dark:text-[#c9b6e6]">Person</h2>
        <Field id="a-name" label="Full name">
          <input id="a-name" value={f.fullName} onChange={set('fullName')} className={INPUT} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="a-email" label="Email">
            <input id="a-email" value={f.email} onChange={set('email')} className={INPUT} />
          </Field>
          <Field id="a-phone" label="Phone">
            <input id="a-phone" value={f.phone} onChange={set('phone')} className={INPUT} />
          </Field>
        </div>
        <Field id="a-addr" label="Postal address">
          <input id="a-addr" value={f.postalAddress} onChange={set('postalAddress')} className={INPUT} />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-[#422e59]
                       dark:text-[#c9b6e6]">Appointment</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="a-pos" label="Position">
            <input id="a-pos" value={f.positionTitle} onChange={set('positionTitle')} className={INPUT} />
          </Field>
          <Field id="a-unit" label="Department, faculty or school">
            <input id="a-unit" value={f.unitName} onChange={set('unitName')} className={INPUT} />
          </Field>
          <Field id="a-type" label="Employment type">
            <select id="a-type" value={f.employmentType} onChange={set('employmentType')} className={INPUT}>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>{EMPLOYMENT_LABELS[t]}</option>
              ))}
            </select>
          </Field>
          <Field id="a-hours" label="Working hours">
            <input id="a-hours" value={f.workingHours} onChange={set('workingHours')}
              className={INPUT} placeholder="e.g. 40 hours per week" />
          </Field>
          <Field id="a-start" label="Start date">
            <input id="a-start" type="date" value={f.startDate} onChange={set('startDate')} className={INPUT} />
          </Field>
          <Field id="a-end" label="End date">
            <input id="a-end" type="date" value={f.endDate} onChange={set('endDate')} className={INPUT} />
          </Field>
          <Field id="a-eff" label="Effective date">
            <input id="a-eff" type="date" value={f.effectiveDate} onChange={set('effectiveDate')} className={INPUT} />
          </Field>
          <Field id="a-prob" label="Probation (months)">
            <input id="a-prob" type="number" min="0" max="36" value={f.probationMonths}
              onChange={set('probationMonths')} className={INPUT} />
          </Field>
          <Field id="a-rep" label="Reporting officer">
            <input id="a-rep" value={f.reportsToName} onChange={set('reportsToName')} className={INPUT} />
          </Field>
          <Field id="a-place" label="Place of work">
            <input id="a-place" value={f.placeOfDuty} onChange={set('placeOfDuty')}
              className={INPUT} placeholder="e.g. Buea campus" />
          </Field>
        </div>
        <Field id="a-terms" label="Appointment conditions">
          <textarea id="a-terms" rows={4} value={f.terms} onChange={set('terms')} className={INPUT} />
        </Field>
      </section>

      {/* WHAT SOMEBODY IS PAID IS A SEPARATE AUTHORITY. Not shown at all to a
          role that does not hold it, and the route ignores the fields even if
          they arrive — an HR assistant who may record an appointment should
          not thereby decide a salary. */}
      {maySetPay && (
        <section className="space-y-4">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-[#422e59]
                         dark:text-[#c9b6e6]">Remuneration</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="a-sal" label="Amount">
              <input id="a-sal" type="number" min="0" value={f.salaryAmount}
                onChange={set('salaryAmount')} className={INPUT} />
            </Field>
            <Field id="a-cur" label="Currency">
              <select id="a-cur" value={f.salaryCurrency} onChange={set('salaryCurrency')} className={INPUT}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field id="a-per" label="Period">
              <select id="a-per" value={f.salaryPeriod} onChange={set('salaryPeriod')} className={INPUT}>
                {SALARY_PERIODS.map((p) => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
              </select>
            </Field>
          </div>
          <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
            Leave the amount blank for an unpaid post. A figure without a currency and a period
            is not something anybody can rely on, so all three go together or none do.
          </p>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-[#422e59]
                       dark:text-[#c9b6e6]">Authority</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="a-auth" label="Appointing authority">
            <input id="a-auth" value={f.appointingAuthority} onChange={set('appointingAuthority')}
              className={INPUT} placeholder="e.g. The University Council" />
          </Field>
          <Field id="a-authdate" label="Date that body decided">
            <input id="a-authdate" type="date" value={f.authorityDecidedOn}
              onChange={set('authorityDecidedOn')} className={INPUT} />
          </Field>
        </div>
        {/* THE DISTINCTION THAT IS EASY TO LOSE. Whoever approves this in the
            portal is recorded automatically and is a different fact from the
            body the letter names. */}
        <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
          This is the body the letter names. Who approves it in this system, and the reference
          number, are recorded by the system itself — an administrator&rsquo;s name does not
          belong where a governing body does.
        </p>
      </section>

      {missing.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-[#faf6ee] p-4 text-xs text-[#6b5a2f]
                       dark:bg-[#241f2c] dark:text-[#c3b48f]">
          {missing.map((m) => (
            <li key={m.key}>{m.blocking ? '' : 'Worth noting: '}{m.message}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-3">
        <button disabled={busy || blocked(missing)} className={BTN_PRIMARY}
          onClick={() => onSave({ ...f })}>
          {busy ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : 'Save as draft'}
        </button>
        <button onClick={onCancel} className={BTN_SECONDARY}>Cancel</button>
      </div>
    </div>
  );
}

/** Re-exported so a navigation label and a status chip cannot drift apart. */
export { STATE_LABELS };
export type { AppointmentState };
