'use client';

// ---------------------------------------------------------------------------
// NATIONAL ADMINISTRATIONS — the register, and the four steps to establishing one.
//
// ---------------------------------------------------------------------------
// WHY THE STEPS ARE ON THE SCREEN AND NOT IN SOMEBODY'S HEAD
// ---------------------------------------------------------------------------
//
// 097 refuses to record an administration as `established` without the
// agreement it operates under and the appointment its Rector holds. That is
// the right place for the rule — it holds whatever calls the database — but a
// rule enforced only at the last step is a rule an officer meets as a refusal
// after they thought they had finished.
//
// So the row shows where each administration has got to: proposed, Rector
// named, agreement recorded, established. The button for the next step is the
// only one offered, and the steps already done are ticked.
//
// ---------------------------------------------------------------------------
// AND WHY THE LEDGER IS ON THE SAME SCREEN
// ---------------------------------------------------------------------------
//
// 098's door is invisible otherwise. A nation with no revenue agreement in
// force keeps nothing — every payment goes to the centre and the allocation
// says `no-agreement`. That is correct and it is also the kind of thing that
// is discovered three months later, so `awaiting_an_agreement` is a count on
// the row rather than a report somebody has to think to run.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedPost } from '@/lib/authedFetch';
import { useAuth } from '@/contexts/AuthContext';
import { can, type Capability } from '@/lib/roles';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL } from '@/lib/portalTheme';
import {
  AlertTriangle, Check, Globe2, Loader2, Plus, ShieldCheck, Wallet,
} from 'lucide-react';

interface Administration {
  id: string;
  country: string;
  name: string;
  status: string;
  rector_id: string | null;
  rector_appointment_id: string | null;
  agreement_reference: string | null;
  established_on: string | null;
  note: string | null;
}

interface LedgerRow {
  administration_id: string;
  currency: string | null;
  gross_received: number | null;
  kept_by_the_nation: number | null;
  remitted_to_the_centre: number | null;
  awaiting_an_agreement: number | null;
}

type Note = { kind: 'ok' | 'bad'; text: string } | null;

const STATUS_SKIN: Record<string, string> = {
  proposed: 'border-slate-300 bg-slate-50 text-slate-700',
  established: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  suspended: 'border-amber-300 bg-amber-50 text-amber-800',
  closed: 'border-slate-300 bg-slate-100 text-slate-500',
};

export default function NationalAdministrations() {
  const { user } = useAuth();
  const mayEstablish = can(user?.role, 'establish-national-administration' as Capability);

  const [rows, setRows] = useState<Administration[] | null>(null);
  const [ledger, setLedger] = useState<Record<string, LedgerRow>>({});
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [proposing, setProposing] = useState(false);
  const [country, setCountry] = useState('');
  const [name, setName] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [field, setField] = useState('');
  const [second, setSecond] = useState('');
  const [suspending, setSuspending] = useState<string | null>(null);
  const [why, setWhy] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('national_administrations')
      .select('id, country, name, status, rector_id, rector_appointment_id, '
        + 'agreement_reference, established_on, note')
      .order('country');

    if (error) {
      // A MISSING TABLE IS NOT AN EMPTY REGISTER. Reporting "no administrations
      // yet" when 097 has not been run would tell an officer the work is
      // waiting on them when it is waiting on a migration.
      setNote({
        kind: 'bad',
        text: /does not exist|schema cache/i.test(error.message)
          ? 'Migration 097 has not been run on this database, so there is no register to read. '
            + 'This is not an empty register — it is a missing one.'
          : error.message,
      });
      setRows([]);
      return;
    }
    setRows((data ?? []) as unknown as Administration[]);

    const { data: led } = await supabase
      .from('national_ledger')
      .select('administration_id, currency, gross_received, kept_by_the_nation, '
        + 'remitted_to_the_centre, awaiting_an_agreement');
    const byId: Record<string, LedgerRow> = {};
    for (const r of (led ?? []) as unknown as LedgerRow[]) {
      if (r.currency) byId[r.administration_id] = r;
    }
    setLedger(byId);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (payload: Record<string, unknown>, said: string) => {
    setBusy(String(payload.id ?? 'new')); setNote(null);
    const result = await authedPost('/api/national/administration', payload);
    setBusy(null);
    if (!result.ok) {
      setNote({ kind: 'bad', text: result.detail ?? result.error ?? 'It was not recorded.' });
      return;
    }
    setNote({ kind: 'ok', text: said });
    setOpen(null); setField(''); setSecond(''); setProposing(false);
    setSuspending(null); setWhy('');
    setCountry(''); setName('');
    await load();
  };

  if (!mayEstablish) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle size={16} className="mr-2 inline" />
          Establishing a National Administration commits the University’s name in a country. It
          belongs to the Superadministrator and the Vice-Chancellor.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#57549a]">
            One University. One academic standard. Many nations.
          </p>
          <h1 className="text-2xl font-semibold text-[#322244]">National Administrations</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            The nations this University operates through. An administration cannot begin
            operating until its agreement and its Rector’s appointment are both recorded —
            the database refuses it, and so does this screen.
          </p>
        </div>
        <button type="button" className={BTN_PRIMARY} onClick={() => { setProposing(true); setNote(null); }}>
          <Plus size={14} className="mr-1.5 inline" />Propose a country
        </button>
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

      {proposing && (
        <div className="rounded-lg border border-[#57549a] bg-[#f8f7fc] p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="na-country">Country</label>
              <input id="na-country" className={`${INPUT} mt-1`} value={country}
                onChange={(e) => setCountry(e.target.value)} placeholder="Uganda" />
            </div>
            <div>
              <label className={LABEL} htmlFor="na-name">As it appears on a letterhead</label>
              <input id="na-name" className={`${INPUT} mt-1`} value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ICOF Global University — National Administration of Uganda" />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            A proposed administration has no authority and receives nothing. It is a country
            written down while its agreement is drafted.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className={BTN_PRIMARY}
              disabled={busy === 'new' || country.trim().length < 2 || name.trim().length < 6}
              onClick={() => void act({ action: 'propose', country, name },
                `${country.trim()} is on the register as proposed.`)}>
              {busy === 'new' ? <Loader2 size={14} className="mr-1.5 inline animate-spin" /> : null}
              Propose it
            </button>
            <button type="button" className={BTN_SECONDARY} onClick={() => setProposing(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {rows === null && (
        <p className="text-sm text-slate-500">
          <Loader2 size={14} className="mr-2 inline animate-spin" />Reading the register…
        </p>
      )}

      {rows !== null && rows.length === 0 && !note && (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          <Globe2 size={20} className="mx-auto mb-2 text-slate-400" />
          No National Administration has been established. The register starts empty — 097
          created it and put nothing in it.
        </div>
      )}

      <ul className="space-y-3">
        {(rows ?? []).map((row) => {
          const money = ledger[row.id];
          const steps = [
            { done: true, label: 'Proposed' },
            { done: Boolean(row.rector_id && row.rector_appointment_id), label: 'Rector appointed' },
            { done: Boolean(row.agreement_reference), label: 'Agreement recorded' },
            { done: row.status === 'established', label: 'Established' },
          ];
          const next = steps.findIndex((s) => !s.done);

          return (
            <li key={row.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-[#322244]">{row.country}</h2>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                      STATUS_SKIN[row.status] ?? STATUS_SKIN.proposed}`}>
                      {row.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">{row.name}</p>
                  {row.agreement_reference && (
                    <p className="mt-1 text-xs text-slate-500">
                      Agreement {row.agreement_reference}
                      {row.established_on && ` · established ${row.established_on}`}
                    </p>
                  )}
                  {row.note && <p className="mt-1 text-xs text-amber-800">{row.note}</p>}
                </div>

                {/* THE MONEY, WHERE THERE IS ANY. */}
                {money && (
                  <div className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">
                      <Wallet size={11} className="mr-1 inline" />Kept by the nation
                    </p>
                    <p className="font-semibold tabular-nums text-[#322244]">
                      {money.currency} {Number(money.kept_by_the_nation ?? 0).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      of {money.currency} {Number(money.gross_received ?? 0).toLocaleString()} received
                    </p>
                    {Number(money.awaiting_an_agreement ?? 0) > 0 && (
                      <p className="mt-1 text-[11px] text-amber-700">
                        {money.awaiting_an_agreement} payment(s) went wholly to the centre —
                        no revenue agreement was in force.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* WHERE IT HAS GOT TO. */}
              <ol className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                {steps.map((s) => (
                  <li key={s.label} className={s.done ? 'text-emerald-700' : 'text-slate-400'}>
                    {s.done ? <Check size={12} className="mr-1 inline" />
                      : <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full border border-slate-300 align-middle" />}
                    {s.label}
                  </li>
                ))}
              </ol>

              {/* ---- WITHDRAWING ITS AUTHORITY ------------------------------
                  An established administration can be suspended. Its records
                  stay — 097 keeps every row and only the status moves — and
                  the reason is compulsory because the Rector reads it. */}
              {row.status === 'established' && (
                <div className="mt-3 border-t border-slate-200 pt-3">
                  {suspending === row.id ? (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                      <label className={LABEL} htmlFor={`s-${row.id}`}>
                        Why its authority is being withdrawn (at least 10 characters)
                      </label>
                      <textarea id={`s-${row.id}`} className={`${INPUT} mt-1 min-h-[3.5rem]`}
                        value={why} onChange={(e) => setWhy(e.target.value)} />
                      <p className="mt-1 text-xs text-slate-600">
                        The Rector sees this. Its students, staff and records are untouched.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button type="button" className={BTN_PRIMARY}
                          disabled={busy === row.id || why.trim().length < 10}
                          onClick={() => void act(
                            { action: 'suspend', id: row.id, note: why },
                            `${row.country}'s authority is suspended.`)}>
                          Suspend it
                        </button>
                        <button type="button" className={BTN_SECONDARY}
                          onClick={() => setSuspending(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className={BTN_SECONDARY}
                      onClick={() => { setSuspending(row.id); setWhy(''); }}>
                      <AlertTriangle size={14} className="mr-1.5 inline" />Suspend its authority
                    </button>
                  )}
                </div>
              )}

              {row.status !== 'closed' && next >= 0 && (
                <div className="mt-3 border-t border-slate-200 pt-3">
                  {open === row.id ? (
                    <div className="rounded-lg border border-[#57549a] bg-[#f8f7fc] p-3">
                      {next === 1 && (
                        <>
                          <label className={LABEL} htmlFor={`r-${row.id}`}>
                            The Rector’s account id
                          </label>
                          <input id={`r-${row.id}`} className={`${INPUT} mt-1`} value={field}
                            onChange={(e) => setField(e.target.value)} />
                          <label className={`${LABEL} mt-2 block`} htmlFor={`a-${row.id}`}>
                            The id of the appointment they hold
                          </label>
                          <input id={`a-${row.id}`} className={`${INPUT} mt-1`} value={second}
                            onChange={(e) => setSecond(e.target.value)} />
                          <p className="mt-1 text-xs text-slate-600">
                            A National Rector’s authority reaches a nation’s students, staff and
                            money, so it traces to an appointment — and the appointment to an
                            issued letter.
                          </p>
                          <div className="mt-2 flex gap-2">
                            <button type="button" className={BTN_PRIMARY} disabled={busy === row.id}
                              onClick={() => void act(
                                { action: 'appoint', id: row.id, rectorId: field, appointmentId: second },
                                `The Rector of ${row.country} is recorded.`)}>
                              Name the Rector
                            </button>
                            <button type="button" className={BTN_SECONDARY}
                              onClick={() => setOpen(null)}>Cancel</button>
                          </div>
                        </>
                      )}
                      {next === 2 && (
                        <>
                          <label className={LABEL} htmlFor={`g-${row.id}`}>
                            National Administration Agreement — its reference
                          </label>
                          <input id={`g-${row.id}`} className={`${INPUT} mt-1`} value={field}
                            onChange={(e) => setField(e.target.value)} placeholder="NRA-2026-001" />
                          <p className="mt-1 text-xs text-slate-600">
                            Recorded so that a question about the terms has a document to go to.
                          </p>
                          <div className="mt-2 flex gap-2">
                            <button type="button" className={BTN_PRIMARY} disabled={busy === row.id}
                              onClick={() => void act(
                                { action: 'agree', id: row.id, agreementReference: field },
                                `The agreement for ${row.country} is recorded.`)}>
                              Record it
                            </button>
                            <button type="button" className={BTN_SECONDARY}
                              onClick={() => setOpen(null)}>Cancel</button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {next === 1 && (
                        <button type="button" className={BTN_SECONDARY}
                          onClick={() => { setOpen(row.id); setField(''); setSecond(''); }}>
                          <ShieldCheck size={14} className="mr-1.5 inline" />Name the Rector
                        </button>
                      )}
                      {next === 2 && (
                        <button type="button" className={BTN_SECONDARY}
                          onClick={() => { setOpen(row.id); setField(''); }}>
                          Record the agreement
                        </button>
                      )}
                      {next === 3 && (
                        <button type="button" className={BTN_PRIMARY} disabled={busy === row.id}
                          onClick={() => void act({ action: 'establish', id: row.id },
                            `${row.country} is established. Its Rector can now lead it.`)}>
                          {busy === row.id
                            ? <Loader2 size={14} className="mr-1.5 inline animate-spin" /> : null}
                          Establish it
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
