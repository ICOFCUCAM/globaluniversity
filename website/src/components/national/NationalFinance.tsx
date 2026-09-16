'use client';

// ---------------------------------------------------------------------------
// NATIONAL FINANCE — the purse, and the two hands on it.
//
// ---------------------------------------------------------------------------
// WHAT THIS SCREEN IS FOR
// ---------------------------------------------------------------------------
//
// The programme's two-level governance, as one page:
//
//     National Rector  — authorizes national operations
//     Financial Secretary — records/processes finances
//
// The Secretary records what the administration spent; the Rector authorises
// it; and 099 refuses the same person to do both. So this screen draws the
// form for one and the buttons for the other, by capability — and a person who
// somehow held both would still be refused by the database, which is where the
// rule actually lives.
//
// ---------------------------------------------------------------------------
// THE PURSE IS NOT A BUDGET
// ---------------------------------------------------------------------------
//
// `available` is what 098 has actually ALLOCATED this administration, less what
// it has already authorised. It is not an allowance somebody set — nobody sets
// it — and it cannot be raised except by the administration receiving money.
//
// That matters most in the case that looks like a bug and is not: a nation with
// no revenue agreement in force has been allocated nothing, so its purse is
// zero however many students have paid. The banner says so, because "you have
// 0 available" is the kind of thing that otherwise gets reported as a broken
// screen.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedPost } from '@/lib/authedFetch';
import { useAuth } from '@/contexts/AuthContext';
import { can, type Capability } from '@/lib/roles';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL } from '@/lib/portalTheme';
import {
  AlertTriangle, Check, Loader2, Plus, Receipt, ThumbsUp, Undo2, Wallet,
} from 'lucide-react';

interface Purse {
  administration_id: string;
  country: string;
  currency: string;
  kept: number;
  authorised: number;
  awaiting_authorisation: number;
  available: number;
}

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  incurred_on: string;
  status: string;
  reference: string | null;
  note: string | null;
}

type Note = { kind: 'ok' | 'bad'; text: string } | null;

const CATEGORIES = [
  'staff', 'academic', 'student-support', 'administration', 'recruitment',
  'technology', 'facilities', 'events', 'marketing', 'operations', 'development',
];

const CURRENCIES = ['USD', 'FCFA', 'EUR', 'GBP', 'NGN'];

const STATUS_SKIN: Record<string, string> = {
  recorded: 'border-amber-300 bg-amber-50 text-amber-800',
  authorised: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  rejected: 'border-rose-300 bg-rose-50 text-rose-800',
};

export default function NationalFinance() {
  const { user } = useAuth();
  const mayRecord = can(user?.role, 'administer-national-finance' as Capability);
  const mayAuthorise = can(user?.role, 'lead-national-administration' as Capability);

  const [purse, setPurse] = useState<Purse[] | null>(null);
  const [rows, setRows] = useState<Expense[]>([]);
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [why, setWhy] = useState('');

  const [category, setCategory] = useState('operations');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [incurredOn, setIncurredOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');

  const load = useCallback(async () => {
    // NEITHER QUERY NAMES AN ADMINISTRATION. 099's policies return this
    // officer's own nation and nobody else's.
    const [{ data: p, error: pe }, { data: e }] = await Promise.all([
      supabase.from('national_purse')
        .select('administration_id, country, currency, kept, authorised, '
          + 'awaiting_authorisation, available'),
      supabase.from('national_expenses')
        .select('id, category, description, amount, currency, incurred_on, status, '
          + 'reference, note')
        .order('incurred_on', { ascending: false }),
    ]);

    if (pe) {
      setNote({
        kind: 'bad',
        text: /does not exist|schema cache/i.test(pe.message)
          ? 'Migration 099 has not been run on this database, so there is no national purse to '
            + 'read. This is not an empty purse — it is a missing one.'
          : pe.message,
      });
      setPurse([]);
      return;
    }
    setPurse((p ?? []) as unknown as Purse[]);
    setRows((e ?? []) as unknown as Expense[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (payload: Record<string, unknown>, said: string) => {
    setBusy(String(payload.id ?? 'new')); setNote(null);
    const result = await authedPost('/api/national/expense', payload);
    setBusy(null);
    if (!result.ok) {
      setNote({ kind: 'bad', text: result.detail ?? result.error ?? 'It was not recorded.' });
      return;
    }
    setNote({ kind: 'ok', text: said });
    setWriting(false); setRejecting(null); setWhy('');
    setDescription(''); setAmount(''); setReference('');
    await load();
  };

  if (!mayRecord && !mayAuthorise) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle size={16} className="mr-2 inline" />
          A National Administration’s finances belong to its Financial Secretary, who records
          them, and its Rector, who authorises them.
        </div>
      </div>
    );
  }

  const nothingAllocated = purse !== null && purse.length === 0;

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#57549a]">
            The Secretary records. The Rector authorises. Never the same person.
          </p>
          <h1 className="text-2xl font-semibold text-[#322244]">National finance</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            What this administration has been allocated, what it has authorised, and what is
            left. The figures are the allocations and the expenses themselves — nothing here is
            a stored balance that could disagree with them.
          </p>
        </div>
        {mayRecord && (
          <button type="button" className={BTN_PRIMARY}
            onClick={() => { setWriting(true); setNote(null); }}>
            <Plus size={14} className="mr-1.5 inline" />Record an expense
          </button>
        )}
      </header>

      {note && (
        <div className={`rounded-lg border p-3 text-sm ${note.kind === 'ok'
          ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
          : 'border-rose-300 bg-rose-50 text-rose-900'}`}>
          {note.kind === 'ok' ? <Check size={16} className="mr-2 inline" />
            : <AlertTriangle size={16} className="mr-2 inline" />}
          {note.text}
        </div>
      )}

      {/* THE CASE THAT LOOKS LIKE A BUG AND IS NOT. */}
      {nothingAllocated && !note && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle size={16} className="mr-2 inline" />
          <span className="font-medium">Nothing has been allocated to this administration yet.</span>
          <p className="mt-1">
            Until a national revenue agreement is in force, every payment goes wholly to the
            centre — so the purse is empty however many students have paid, and nothing can be
            authorised against it. An expense can still be recorded and will wait.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(purse ?? []).map((p) => (
          <div key={`${p.administration_id}-${p.currency}`}
            className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500">
              <Wallet size={14} />{p.country} · {p.currency}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[#322244]">
              {p.currency} {Number(p.available).toLocaleString()}
            </p>
            <p className="text-xs text-slate-500">available</p>
            <dl className="mt-3 space-y-1 border-t border-slate-200 pt-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <dt>Allocated by the University</dt>
                <dd className="tabular-nums">{Number(p.kept).toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Authorised</dt>
                <dd className="tabular-nums">{Number(p.authorised).toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Awaiting authorisation</dt>
                <dd className="tabular-nums">
                  {Number(p.awaiting_authorisation).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      {writing && (
        <div className="rounded-lg border border-[#57549a] bg-[#f8f7fc] p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className={LABEL} htmlFor="ne-cat">What kind of expense</label>
              <select id="ne-cat" className={`${INPUT} mt-1`} value={category}
                onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="ne-amount">Amount</label>
              <input id="ne-amount" type="number" min="0" step="0.01"
                className={`${INPUT} mt-1`} value={amount}
                onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="ne-cur">Currency</label>
              <select id="ne-cur" className={`${INPUT} mt-1`} value={currency}
                onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={LABEL} htmlFor="ne-desc">What it was for</label>
              <input id="ne-desc" className={`${INPUT} mt-1`} value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Office rent, first quarter" />
            </div>
            <div>
              <label className={LABEL} htmlFor="ne-when">When it was incurred</label>
              <input id="ne-when" type="date" className={`${INPUT} mt-1`} value={incurredOn}
                onChange={(e) => setIncurredOn(e.target.value)} />
            </div>
            <div className="md:col-span-3">
              <label className={LABEL} htmlFor="ne-ref">Reference (optional)</label>
              <input id="ne-ref" className={`${INPUT} mt-1`} value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Invoice number, receipt number" />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Recording it does not commit the money. The Rector authorises it, and cannot
            authorise more than the administration has been allocated.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className={BTN_PRIMARY}
              disabled={busy === 'new' || description.trim().length < 4 || !Number(amount)}
              onClick={() => void act(
                { action: 'record', category, description, amount: Number(amount),
                  currency, incurredOn, reference },
                'Recorded. It waits for the Rector to authorise it.')}>
              {busy === 'new' ? <Loader2 size={14} className="mr-1.5 inline animate-spin" /> : null}
              Record it
            </button>
            <button type="button" className={BTN_SECONDARY} onClick={() => setWriting(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {purse === null && (
        <p className="text-sm text-slate-500">
          <Loader2 size={14} className="mr-2 inline animate-spin" />Reading the purse…
        </p>
      )}

      {purse !== null && rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          <Receipt size={20} className="mx-auto mb-2 text-slate-400" />
          No expense has been recorded.
        </div>
      )}

      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#322244]">{row.description}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                    STATUS_SKIN[row.status] ?? STATUS_SKIN.recorded}`}>
                    {row.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {row.category} · {row.incurred_on}
                  {row.reference && ` · ${row.reference}`}
                </p>
                {row.note && (
                  <p className="mt-1 text-xs text-rose-800">{row.note}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-semibold tabular-nums text-[#322244]">
                  {row.currency} {Number(row.amount).toLocaleString()}
                </span>
                {mayAuthorise && row.status === 'recorded' && (
                  <div className="flex gap-2">
                    <button type="button" className={BTN_PRIMARY} disabled={busy === row.id}
                      onClick={() => void act({ action: 'authorise', id: row.id },
                        'Authorised. It now counts against the purse.')}>
                      {busy === row.id ? <Loader2 size={14} className="animate-spin" />
                        : <><ThumbsUp size={14} className="mr-1 inline" />Authorise</>}
                    </button>
                    <button type="button" className={BTN_SECONDARY}
                      onClick={() => { setRejecting(row.id); setWhy(''); }}>
                      <Undo2 size={14} className="mr-1 inline" />Reject
                    </button>
                  </div>
                )}
              </div>
            </div>

            {rejecting === row.id && (
              <div className="mt-3 rounded-lg border border-[#57549a] bg-[#f8f7fc] p-3">
                <label className={LABEL} htmlFor={`x-${row.id}`}>
                  Why it is not being paid (at least 10 characters)
                </label>
                <textarea id={`x-${row.id}`} className={`${INPUT} mt-1 min-h-[3.5rem]`}
                  value={why} onChange={(e) => setWhy(e.target.value)} />
                <p className="mt-1 text-xs text-slate-600">
                  The Financial Secretary reads this and has to answer for the invoice.
                </p>
                <div className="mt-2 flex gap-2">
                  <button type="button" className={BTN_PRIMARY}
                    disabled={busy === row.id || why.trim().length < 10}
                    onClick={() => void act({ action: 'reject', id: row.id, note: why },
                      'Rejected, with your reason.')}>
                    Reject it
                  </button>
                  <button type="button" className={BTN_SECONDARY}
                    onClick={() => setRejecting(null)}>Cancel</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
