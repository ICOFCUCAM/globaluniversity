'use client';

// ---------------------------------------------------------------------------
// FEE SCHEDULES — what the University charges, set by the Superadministrator.
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY ASKED FOR
// ---------------------------------------------------------------------------
//
// "For the fees, the superadmin should be able to fix it and it is recorded in
// the system. Superadmin should be able to affix the fees."
//
// ---------------------------------------------------------------------------
// WHAT THIS CHANGED FOR EVERY OTHER SCREEN
// ---------------------------------------------------------------------------
//
// Until this existed, nothing in the system recorded what a student was
// CHARGED — only what had been received. So the student's finance page could
// not show a balance, and the graduation audit reported financial clearance as
// permanently unknown. Both of those were honest and both were useless.
//
// A published schedule here is what makes a balance possible. That is worth
// knowing while using this screen: the figures typed here end up on students'
// own screens, and on the audit that decides whether somebody graduates.
//
// ---------------------------------------------------------------------------
// DRAFT UNTIL PUBLISHED, AND PUBLISHED UNDER SOMEBODY'S NAME
// ---------------------------------------------------------------------------
//
// A schedule is typed one line at a time and must not be chargeable while it
// is half finished. 075 refuses a published schedule with nobody recorded as
// having published it, and the route refuses to publish one with no fees on
// it — a schedule charging nothing would produce invoices for zero, which a
// student reads as "the University says I owe nothing" rather than "somebody
// has not finished typing".
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Card, EmptyState, PageHeader, SkeletonRows,
} from '@/components/ui/portal';
import { within } from '@/lib/studentReads';
import { authedPost } from '@/lib/authedFetch';
import { FOCUS } from '@/lib/portalTheme';
import {
  AlertTriangle, CheckCircle2, Plus, Receipt, Trash2, Wallet, X,
} from 'lucide-react';

// eslint-disable-next-line max-len
const SCHEDULES = 'id, name, session_label, programme_id, award_level, study_mode, status, note, set_at, published_at';
// eslint-disable-next-line max-len
const ITEMS = 'id, schedule_id, label, category, amount, currency, charged, mandatory, note, sort_order';

interface Schedule {
  id: string;
  name: string;
  session_label: string;
  programme_id: string | null;
  award_level: string | null;
  study_mode: string | null;
  status: 'draft' | 'published' | 'withdrawn';
  note: string | null;
  set_at: string;
  published_at: string | null;
}

interface Item {
  id: string;
  schedule_id: string;
  label: string;
  category: string;
  amount: number;
  currency: string;
  charged: string;
  mandatory: boolean;
  note: string | null;
  sort_order: number;
}

const CURRENCIES = ['USD', 'FCFA', 'EUR', 'GBP', 'NGN'];
const CATEGORIES = ['tuition', 'registration', 'examination', 'books', 'housing',
  'library', 'technology', 'graduation', 'other'];
const CHARGED = ['per-year', 'per-semester', 'once'];
const AWARD_LEVELS = ['Certificate', 'Diploma', "Bachelor's", 'Postgraduate Diploma',
  "Master's", 'Doctorate'];
const MODES = ['Full-time', 'Part-time'];

/**
 * Who a schedule applies to, in a sentence.
 *
 * THE NULLS ARE THE POINT. A schedule with no programme, no level and no mode
 * applies to everybody, and a screen that printed three empty fields would
 * make the most common case look like the least finished one.
 */
export function appliesTo(s: Schedule, programmeName?: string | null): string {
  const parts = [
    s.programme_id ? (programmeName ?? 'one programme') : null,
    s.award_level,
    s.study_mode,
  ].filter(Boolean);
  return parts.length === 0 ? 'Every student' : parts.join(' · ');
}

/** Totals per currency. Never added across them — there is no exchange rate. */
export function totals(items: Item[]): { currency: string; total: number }[] {
  const by = new Map<string, number>();
  for (const i of items) by.set(i.currency, (by.get(i.currency) ?? 0) + Number(i.amount));
  return Array.from(by.entries())
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => b.total - a.total);
}

export default function FeeSchedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [programmes, setProgrammes] = useState<{ id: string; code: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [newSchedule, setNewSchedule] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, i, p] = await Promise.all([
        within(supabase.from('fee_schedules').select(SCHEDULES)
          .order('session_label', { ascending: false })),
        within(supabase.from('fee_items').select(ITEMS).order('sort_order')),
        within(supabase.from('programmes').select('id, code').order('code')),
      ]);
      if (s.error) { setFailed(s.error.message); setLoading(false); return; }
      setSchedules((s.data ?? []) as unknown as Schedule[]);
      setItems((i.data ?? []) as unknown as Item[]);
      setProgrammes((p.data ?? []) as unknown as { id: string; code: string }[]);
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'The fee schedules could not be read.');
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = useCallback(async (payload: Record<string, unknown>, key: string) => {
    setBusy(key); setProblem(null);
    const r = await authedPost('/api/finance/fees', payload);
    setBusy(null);
    if (!r.ok) {
      setProblem(String(r.detail ?? r.error ?? 'That did not work.'));
      return false;
    }
    await load();
    return true;
  }, [load]);

  const byProgramme = useMemo(
    () => new Map(programmes.map((p) => [p.id, p.code])),
    [programmes],
  );

  if (failed) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title="The fee schedules could not be read"
          description={`${failed}. If migration 075 has not been run on this database, the `
            + 'tables this screen reads do not exist yet.'}
        />
      </Card>
    );
  }

  if (loading) return <Card className="overflow-hidden"><SkeletonRows rows={5} cols={4} /></Card>;

  const live = schedules.filter((s) => s.status === 'published').length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fee schedules"
        subtitle={schedules.length === 0
          ? 'What the University charges. Nothing is set yet.'
          : `${schedules.length} schedule${schedules.length === 1 ? '' : 's'} · ${live} published`}
        action={(
          <button
            onClick={() => setNewSchedule(true)}
            className={`flex items-center gap-2 rounded-lg bg-[#422e59] px-4 py-2 text-sm
                        font-semibold text-white transition hover:bg-[#33234a] ${FOCUS}`}
          >
            <Plus size={15} /> New schedule
          </button>
        )}
      />

      {problem && (
        <Card className="flex items-start gap-3 border-red-300 bg-red-50 p-4
                         dark:border-red-900 dark:bg-red-950/30">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-700 dark:text-red-300" />
          <p className="text-xs text-red-800 dark:text-red-200">{problem}</p>
        </Card>
      )}

      {/* THE CONSEQUENCE, SAID ON THE SCREEN. The figures typed here reach
          students' own pages and the graduation audit. Somebody setting fees
          for the first time should know that before they type one. */}
      <Card className="flex items-start gap-3 border-[#c5a55a] p-4">
        <Wallet size={16} className="mt-0.5 shrink-0 text-[#c5a55a]" />
        <div className="text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
          <p className="font-semibold text-[#33234a] dark:text-[#e4dcf0]">
            What you publish here is what students are charged.
          </p>
          <p className="mt-1">
            A schedule stays a draft until you publish it, and a draft charges nobody. Once it is
            published, the Finance Office can raise these fees against a student — and from that
            moment the student sees a balance on their own Fees page. Changing a published
            schedule afterwards does <strong>not</strong> re-price invoices already raised.
          </p>
        </div>
      </Card>

      {schedules.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Receipt size={20} />}
            title="No fees have been set"
            description={'The University has not recorded what it charges. Until a schedule is '
              + 'published, no student can be invoiced and every student’s Fees page says that '
              + 'Finance holds the account.'}
          />
        </Card>
      ) : schedules.map((s) => {
        const mine = items.filter((i) => i.schedule_id === s.id)
          .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
        return (
          <Card key={s.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-heading text-sm font-bold text-[#422e59] dark:text-[#c8b6e8]">
                  {s.name}
                  <span className={`ml-2 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    s.status === 'published'
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : s.status === 'withdrawn'
                        ? 'bg-[#f5f1ea] text-[#a49bb0] dark:bg-[#241f2c]'
                        : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                  }`}>
                    {s.status}
                  </span>
                </h2>
                <p className="mt-0.5 text-[11px] text-[#a49bb0]">
                  {s.session_label} · {appliesTo(s, s.programme_id
                    ? byProgramme.get(s.programme_id) : null)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => setAddingTo(s.id)}
                  className={`rounded-lg border border-[#ded6c8] px-3 py-1.5 text-xs font-medium
                              text-[#422e59] transition hover:bg-[#f5f1ea] dark:border-[#3d3349]
                              dark:text-[#c8b6e8] dark:hover:bg-[#2a2333] ${FOCUS}`}
                >
                  Add a fee
                </button>
                {s.status === 'draft' && (
                  <button
                    onClick={() => act({ action: 'schedule-publish', scheduleId: s.id }, s.id)}
                    disabled={busy === s.id}
                    className={`rounded-lg bg-[#422e59] px-3 py-1.5 text-xs font-semibold
                                text-white transition hover:bg-[#33234a] disabled:opacity-50
                                ${FOCUS}`}
                  >
                    {busy === s.id ? 'Publishing…' : 'Publish'}
                  </button>
                )}
                {s.status === 'published' && (
                  <button
                    onClick={() => {
                      const reason = window.prompt(
                        'Why is this schedule being withdrawn? Fees the University has published '
                        + 'and then taken back are the ones people ask about.',
                      );
                      if (reason && reason.trim().length >= 10) {
                        void act({ action: 'schedule-withdraw', scheduleId: s.id, reason }, s.id);
                      }
                    }}
                    className="text-xs text-[#a49bb0] underline underline-offset-2
                               hover:text-[#6b6076]"
                  >
                    Withdraw
                  </button>
                )}
              </div>
            </div>

            {mine.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-[#ded6c8] p-3 text-center
                            text-xs text-[#a49bb0] dark:border-[#3d3349]">
                No fees on this schedule yet. It cannot be published until there is at least one.
              </p>
            ) : (
              <>
                <ul className="mt-3 divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
                  {mine.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                      <span className="min-w-0 flex-1 text-sm text-[#33234a] dark:text-[#e4dcf0]">
                        {i.label}
                        {!i.mandatory && (
                          // OPTIONAL IS NOT COSMETIC. An optional line is
                          // offered when an invoice is raised rather than
                          // added to it, so a student living at home is not
                          // charged for housing.
                          <span className="ml-2 text-[11px] text-[#a07c12]">optional</span>
                        )}
                      </span>
                      <span className="shrink-0 text-[11px] text-[#a49bb0]">
                        {i.category} · {i.charged.replace('-', ' ')}
                      </span>
                      <span className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums
                                       text-[#33234a] dark:text-[#e4dcf0]">
                        {Number(i.amount).toLocaleString()} {i.currency}
                      </span>
                      <button
                        onClick={() => act({ action: 'item-remove', itemId: i.id }, i.id)}
                        aria-label={`Remove ${i.label}`}
                        className="shrink-0 rounded p-1 text-[#a49bb0] hover:bg-[#f5f1ea]
                                   hover:text-red-600 dark:hover:bg-[#2a2333]"
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap justify-end gap-x-6 text-xs">
                  {totals(mine).map((t) => (
                    <span key={t.currency} className="text-[#6b6076] dark:text-[#9c93ad]">
                      Total{' '}
                      <strong className="tabular-nums text-[#33234a] dark:text-[#e4dcf0]">
                        {t.total.toLocaleString()} {t.currency}
                      </strong>
                    </span>
                  ))}
                </div>
              </>
            )}

            {addingTo === s.id && (
              <ItemForm
                onCancel={() => setAddingTo(null)}
                onSave={async (fields) => {
                  const ok = await act({ action: 'item-add', scheduleId: s.id, ...fields }, s.id);
                  if (ok) setAddingTo(null);
                }}
                busy={busy === s.id}
              />
            )}
          </Card>
        );
      })}

      {newSchedule && (
        <ScheduleForm
          programmes={programmes}
          onCancel={() => setNewSchedule(false)}
          onSave={async (fields) => {
            const ok = await act({ action: 'schedule-add', ...fields }, 'new');
            if (ok) setNewSchedule(false);
          }}
          busy={busy === 'new'}
        />
      )}
    </div>
  );
}

function ScheduleForm({
  programmes, onCancel, onSave, busy,
}: {
  programmes: { id: string; code: string }[];
  onCancel: () => void;
  onSave: (f: Record<string, unknown>) => void;
  busy: boolean;
}) {
  const [name, setName] = useState('');
  const [sessionLabel, setSessionLabel] = useState('');
  const [programmeId, setProgrammeId] = useState('');
  const [awardLevel, setAwardLevel] = useState('');
  const [studyMode, setStudyMode] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      role="dialog" aria-label="New fee schedule">
      <Card className="my-8 w-full max-w-lg p-6">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="font-heading text-base font-bold text-[#422e59] dark:text-[#c8b6e8]">
            New fee schedule
          </h2>
          <button onClick={onCancel} aria-label="Close"
            className="rounded-lg p-1.5 text-[#a49bb0] hover:bg-[#f5f1ea] dark:hover:bg-[#2a2333]">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3">
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Undergraduate fees 2026/27" className={INPUT} />
          </Field>
          <Field label="Session">
            <input value={sessionLabel} onChange={(e) => setSessionLabel(e.target.value)}
              placeholder="2026/2027" className={INPUT} />
          </Field>
          {/* THE THREE THAT MAY ALL BE LEFT BLANK, and the help text says so.
              A schedule with none of them set is the normal case: one set of
              fees for the whole University. */}
          <Field label="Programme" help="Leave blank to apply to every programme.">
            <select value={programmeId} onChange={(e) => setProgrammeId(e.target.value)}
              className={INPUT}>
              <option value="">Every programme</option>
              {programmes.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
            </select>
          </Field>
          <Field label="Award level" help="Leave blank to apply to every level.">
            <select value={awardLevel} onChange={(e) => setAwardLevel(e.target.value)}
              className={INPUT}>
              <option value="">Every level</option>
              {AWARD_LEVELS.map((a) => <option key={a}>{a}</option>)}
            </select>
          </Field>
          <Field label="Study mode" help="Leave blank to apply to full-time and part-time alike.">
            <select value={studyMode} onChange={(e) => setStudyMode(e.target.value)}
              className={INPUT}>
              <option value="">Both</option>
              {MODES.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onCancel}
            className="text-xs font-medium text-[#6b6076] hover:underline dark:text-[#9c93ad]">
            Cancel
          </button>
          <button
            onClick={() => onSave({
              name, sessionLabel,
              programmeId: programmeId || null,
              awardLevel: awardLevel || null,
              studyMode: studyMode || null,
            })}
            disabled={busy || name.trim().length < 3 || sessionLabel.trim().length < 4}
            className={`rounded-lg bg-[#422e59] px-4 py-2 text-sm font-semibold text-white
                        transition hover:bg-[#33234a] disabled:opacity-50 ${FOCUS}`}
          >
            {busy ? 'Creating…' : 'Create as draft'}
          </button>
        </div>
      </Card>
    </div>
  );
}

function ItemForm({
  onCancel, onSave, busy,
}: { onCancel: () => void; onSave: (f: Record<string, unknown>) => void; busy: boolean }) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [category, setCategory] = useState('tuition');
  const [charged, setCharged] = useState('per-year');
  const [mandatory, setMandatory] = useState(true);

  const bad = amount !== '' && !(Number(amount) > 0);

  return (
    <div className="mt-4 rounded-xl border border-[#ded6c8] p-4 dark:border-[#3d3349]">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="What the fee is">
          <input value={label} onChange={(e) => setLabel(e.target.value)}
            placeholder="Full-time tuition" className={INPUT} />
        </Field>
        <Field label="Amount">
          <div className="flex gap-2">
            <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)}
              className={INPUT} />
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}
              className={`${INPUT} w-28`}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          {bad && (
            <p className="mt-1 text-[11px] text-[#a07c12]">
              A fee is an amount above zero. A line charging nothing is one to leave off.
            </p>
          )}
        </Field>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={INPUT}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Charged">
          <select value={charged} onChange={(e) => setCharged(e.target.value)} className={INPUT}>
            {CHARGED.map((c) => <option key={c}>{c.replace('-', ' ')}</option>)}
          </select>
        </Field>
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs text-[#6b6076] dark:text-[#9c93ad]">
        <input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} />
        Every student pays this. Untick for something like housing, which is offered when an
        invoice is raised rather than added to it.
      </label>
      <div className="mt-3 flex justify-end gap-3">
        <button onClick={onCancel}
          className="text-xs font-medium text-[#6b6076] hover:underline dark:text-[#9c93ad]">
          Cancel
        </button>
        <button
          onClick={() => onSave({ label, amount: Number(amount), currency, category,
            charged, mandatory })}
          disabled={busy || label.trim().length < 2 || !(Number(amount) > 0)}
          className={`flex items-center gap-2 rounded-lg bg-[#422e59] px-4 py-2 text-xs
                      font-semibold text-white transition hover:bg-[#33234a]
                      disabled:opacity-50 ${FOCUS}`}
        >
          <CheckCircle2 size={14} /> {busy ? 'Adding…' : 'Add fee'}
        </button>
      </div>
    </div>
  );
}

const INPUT = 'w-full rounded-lg border border-[#ded6c8] bg-white px-3 py-2 text-sm '
  + 'text-[#33234a] dark:border-[#3d3349] dark:bg-[#241f2c] dark:text-[#e4dcf0]';

function Field({
  label, help, children,
}: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-[#6b6076] dark:text-[#9c93ad]">{label}</label>
      <div className="mt-1">{children}</div>
      {help && <p className="mt-1 text-[11px] text-[#a49bb0]">{help}</p>}
    </div>
  );
}
