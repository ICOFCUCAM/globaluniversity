'use client';

// ---------------------------------------------------------------------------
// THE ACADEMIC CALENDAR — which year it is, and who says so.
//
// ---------------------------------------------------------------------------
// THE FAULT THIS SCREEN EXISTS TO MAKE IMPOSSIBLE
// ---------------------------------------------------------------------------
//
// 059 wrote, under a comment saying the date decides which year is current:
//
//   update academic_years set status = case
//     when current_date between starts_on and ends_on then 'current' ...
//
// The date decided it ONCE, on the day the migration ran. Nothing updated it
// afterwards, and three screens — Course Offerings, the Timetable, the
// Academic Overview — all opened on `status = 'current'`.
//
// So on 15 August 2027 every one of them would have opened on 2026/2027, shown
// last year's offerings, last year's timetable and last year's alerts, and
// said nothing at all. No error, no warning, no red. That is the worst shape a
// bug can take in a system of record: it is not wrong loudly, it is wrong
// quietly, and somebody registers a cohort into it.
//
// ---------------------------------------------------------------------------
// SO THIS SCREEN SHOWS TWO THINGS AND WHETHER THEY AGREE
// ---------------------------------------------------------------------------
//
// WHAT THE CALENDAR SAYS — derived from the dates, by `academic_year_now`,
// every time it is asked. It cannot be stale. This is what the screens should
// and now do open on.
//
// WHAT IS STORED — the `status` column, which is a real administrative record:
// closing a year is something the Registry DOES, after the last board has sat,
// and it is not the same event as the year ending on the calendar.
//
// AND WHERE THEY DISAGREE, loudly, with one button to put them in step. That
// disagreement is the 2027 fault, visible years before it would have bitten.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedPost } from '@/lib/authedFetch';
import { can } from '@/lib/roles';
import { useAuth } from '@/contexts/AuthContext';
import {
  Card, EmptyState, PageHeader, SkeletonRows,
} from '@/components/ui/portal';
import {
  AlertTriangle, CheckCircle2, CalendarDays, Plus, RefreshCw, Info,
} from 'lucide-react';
import { within } from './ProgrammeRegister';

// SINGLE STRING LITERALS — concatenation collapses the inferred row type.
const YEARS = 'id, label, starts_in, starts_on, ends_on, status';
const NOW = 'id, label, starts_in, starts_on, ends_on, status';
const DRIFT = 'id, label, starts_in, starts_on, ends_on, status, should_be';
const TERMS = 'id, academic_year_id, sequence, name, starts_on, ends_on';

interface Year {
  id: string; label: string; starts_in: number;
  starts_on: string; ends_on: string; status: string;
}
interface Drift extends Year { should_be: string; }
interface Term {
  id: string; academic_year_id: string; sequence: number;
  name: string; starts_on: string; ends_on: string;
}

const STATUS_MEANS: Record<string, string> = {
  planning: 'Being set up. Not yet the year the University is in.',
  current: 'The year the University is in.',
  closed: 'Finished with. The Registry has completed its records for it.',
};

/** '15 August 2026'. A date on a calendar screen is read, not parsed. */
function readable(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  return `${day} ${months[m - 1]} ${y}`;
}

export default function AcademicCalendar() {
  const { user } = useAuth();
  const mayEdit = can(user?.role, 'manage-academic-calendar');

  const [years, setYears] = useState<Year[] | null>(null);
  const [now, setNow] = useState<Year | null>(null);
  const [drift, setDrift] = useState<Drift[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ys, nw, df, tm] = await within(Promise.all([
        supabase.from('academic_years').select(YEARS).order('starts_in'),
        supabase.from('academic_year_now').select(NOW).maybeSingle(),
        supabase.from('academic_year_drift').select(DRIFT),
        supabase.from('academic_terms').select(TERMS).order('sequence'),
      ]));
      if (ys.error) { setFailed(ys.error.message); setYears([]); return; }
      setFailed(null);
      setYears((ys.data ?? []) as unknown as Year[]);
      // THE DERIVED VIEW MAY LEGITIMATELY BE EMPTY — today can fall outside
      // every year the calendar covers, and saying so is the honest answer.
      setNow((nw.data ?? null) as unknown as Year | null);
      setDrift((df.data ?? []) as unknown as Drift[]);
      setTerms((tm.data ?? []) as unknown as Term[]);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'The calendar could not be read.');
      setYears([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setNote(null);
    const out = await authedPost('/api/academic/calendar', payload);
    setBusy(false);
    if (!out.ok) {
      setNote({ tone: 'bad', text: String(out.detail ?? out.error ?? 'That did not work.') });
      return false;
    }
    // A WARNING IS NOT A FAILURE. Opening next year's registration in July is
    // a normal thing a University does; it is answered with the disagreement
    // rather than refused.
    setNote(out.warning
      ? { tone: 'bad', text: `${out.detail ?? 'Saved.'} ${out.warning}` }
      : { tone: 'ok', text: String(out.detail ?? 'Saved.') });
    await load();
    return true;
  }

  const termsOf = useMemo(() => {
    const m = new Map<string, Term[]>();
    for (const t of terms) m.set(t.academic_year_id, [...(m.get(t.academic_year_id) ?? []), t]);
    return m;
  }, [terms]);

  const driftIds = useMemo(() => new Map(drift.map((d) => [d.id, d])), [drift]);

  if (failed) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title="The calendar could not be read"
          description={`${failed}. If migrations 059 and 065 have not been run on this database, `
            + 'the academic calendar and the views that keep it honest do not exist yet.'}
        />
      </Card>
    );
  }

  // The four years worth showing in full: last, this, and the next two.
  const anchor = now?.starts_in ?? new Date().getFullYear();
  const near = (years ?? []).filter(
    (y) => y.starts_in >= anchor - 1 && y.starts_in <= anchor + 2,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic calendar"
        subtitle="Which year the University is in, when each semester runs, and whether the records agree."
        action={mayEdit && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 rounded-xl border border-[#ded6c8] px-3 py-2
                       text-sm text-[#6b6076] hover:bg-[#faf8f4]
                       dark:border-[#3d3349] dark:text-[#9c93ad] dark:hover:bg-[#241f2c]"
          >
            <Plus size={14} /> Add a year
          </button>
        )}
      />

      {years === null && <Card className="overflow-hidden"><SkeletonRows rows={5} cols={4} /></Card>}

      {years !== null && (
        <>
          {/* --------------------------------------------------------------
              WHAT THE CALENDAR SAYS. Derived, every time, from the dates.
              This is the answer the screens now open on.
              -------------------------------------------------------------- */}
          <Card className="p-5">
            <p className="text-xs uppercase tracking-wide text-[#a49bb0] dark:text-[#7b7289]">
              Today is in
            </p>
            {now ? (
              <>
                <p className="font-heading text-2xl font-bold text-[#422e59] dark:text-[#c8b6e8]">
                  {now.label}
                </p>
                <p className="mt-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                  {readable(now.starts_on)} to {readable(now.ends_on)}. Worked out from the dates
                  every time this page is opened, so it cannot go stale.
                </p>
              </>
            ) : (
              <>
                <p className="font-heading text-2xl font-bold text-red-600 dark:text-red-400">
                  No academic year at all
                </p>
                <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                  Today falls outside every year in the calendar, so nothing can be dated: a
                  registration cannot be filed and a result cannot be placed in a term. Add the
                  year.
                </p>
              </>
            )}
          </Card>

          {/* --------------------------------------------------------------
              AND WHERE THE STORED RECORD DISAGREES WITH IT.
              -------------------------------------------------------------- */}
          {drift.length > 0 ? (
            <Card className="border-amber-200 bg-amber-50 p-5 dark:border-amber-900
                             dark:bg-amber-950/30">
              <h2 className="flex items-center gap-2 font-heading text-sm font-bold
                             text-amber-800 dark:text-amber-200">
                <AlertTriangle size={16} />
                {drift.length} year{drift.length === 1 ? ' is' : 's are'} out of step with the calendar
              </h2>
              <ul className="mt-3 space-y-1">
                {drift.map((d) => (
                  <li key={d.id} className="text-xs text-amber-800 dark:text-amber-200">
                    <strong>{d.label}</strong> is recorded as <strong>{d.status}</strong>,
                    {' '}but by its dates it is <strong>{d.should_be}</strong>.
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-amber-700 dark:text-amber-300">
                This is what a stale year looks like before it does any harm. Course offerings,
                the timetable and the overview all read the derived answer above, so they are
                already on the right year — but the stored record should be put back in step.
              </p>
              {mayEdit && (
                <button
                  onClick={() => act({ action: 'roll' })}
                  disabled={busy}
                  className="mt-3 flex items-center gap-1.5 rounded-xl bg-[#422e59] px-4 py-2
                             text-sm font-medium text-white hover:bg-[#322244] disabled:opacity-40"
                >
                  <RefreshCw size={14} /> Roll the year over
                </button>
              )}
            </Card>
          ) : (
            <Card className="flex items-start gap-3 border-emerald-200 bg-emerald-50 p-4
                             dark:border-emerald-900 dark:bg-emerald-950/30">
              <CheckCircle2 size={16}
                className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300" />
              <p className="text-xs text-emerald-800 dark:text-emerald-200">
                Every year’s stored status matches its dates. Nothing is out of step.
              </p>
            </Card>
          )}

          {note && (
            <div className={`rounded-xl border p-3 text-sm ${
              note.tone === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
                : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200'
            }`}>
              {note.text}
            </div>
          )}

          {/* --------------------------------------------------------------
              THE YEARS THEMSELVES, and the two semesters in each.
              -------------------------------------------------------------- */}
          <div className="space-y-4">
            {near.map((y) => {
              const d = driftIds.get(y.id);
              const isNow = now?.id === y.id;
              return (
                <Card key={y.id} className={`p-5 ${
                  isNow ? 'border-[#422e59] dark:border-[#c8b6e8]' : ''
                }`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="font-heading text-base font-bold text-[#33234a]
                                     dark:text-[#e4dcf0]">
                        {y.label}
                        {isNow && (
                          <span className="ml-2 rounded-full bg-[#422e59] px-2 py-0.5 text-[10px]
                                           font-medium text-white">
                            Today is in this year
                          </span>
                        )}
                      </h3>
                      <p className="mt-0.5 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                        {readable(y.starts_on)} to {readable(y.ends_on)}
                      </p>
                      <p className="mt-1 text-[11px] text-[#a49bb0] dark:text-[#7b7289]">
                        {STATUS_MEANS[y.status]}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {mayEdit ? (
                        <select
                          value={y.status}
                          disabled={busy}
                          onChange={(e) => act({
                            action: 'year-status', yearId: y.id, status: e.target.value,
                          })}
                          aria-label={`Status of ${y.label}`}
                          className="rounded-xl border border-[#ded6c8] bg-white px-2 py-1.5
                                     text-xs dark:border-[#3d3349] dark:bg-[#241f2c]"
                        >
                          {Object.keys(STATUS_MEANS).map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-[#6b6076]">{y.status}</span>
                      )}
                      {d && (
                        <span className="text-[10px] text-amber-700 dark:text-amber-300">
                          by its dates: {d.should_be}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {(termsOf.get(y.id) ?? []).map((t) => (
                      <TermRow key={t.id} term={t} mayEdit={mayEdit} busy={busy} onSave={act} />
                    ))}
                    {(termsOf.get(y.id) ?? []).length === 0 && (
                      <p className="rounded-lg border border-dashed border-red-300 p-3 text-xs
                                    text-red-700 dark:border-red-800 dark:text-red-300">
                        This year has no semesters, so no date in it can be placed in a term and
                        nothing can be registered against it.
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          <Card className="flex items-start gap-2 p-4 text-xs text-[#6b6076] dark:text-[#9c93ad]">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>
              {years.length} academic years are in the calendar, from {years[0]?.label} to{' '}
              {years[years.length - 1]?.label}. The four around today are shown. The University’s
              rule is 15 August to 14 August, with Semester 1 running to 1 January and Semester 2
              from the 2nd — a year added here follows it.
            </span>
          </Card>
        </>
      )}

      {adding && (
        <AddYear
          years={years ?? []}
          busy={busy}
          onClose={() => setAdding(false)}
          onAdd={async (startsIn) => {
            const ok = await act({ action: 'year-add', startsIn });
            if (ok) setAdding(false);
          }}
        />
      )}
    </div>
  );
}

function TermRow({
  term, mayEdit, busy, onSave,
}: {
  term: Term;
  mayEdit: boolean;
  busy: boolean;
  onSave: (p: Record<string, unknown>) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [startsOn, setStartsOn] = useState(term.starts_on);
  const [endsOn, setEndsOn] = useState(term.ends_on);
  const backwards = endsOn <= startsOn;

  if (!editing) {
    return (
      <div className="rounded-lg bg-[#faf8f4] px-3 py-2 dark:bg-[#241f2c]">
        <p className="text-xs font-semibold text-[#422e59] dark:text-[#c8b6e8]">{term.name}</p>
        <p className="text-[11px] text-[#6b6076] dark:text-[#9c93ad]">
          {readable(term.starts_on)} – {readable(term.ends_on)}
        </p>
        {mayEdit && (
          <button
            onClick={() => setEditing(true)}
            className="mt-1 text-[11px] font-medium text-[#422e59] underline dark:text-[#c8b6e8]"
          >
            Move it
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-[#ded6c8] p-3 dark:border-[#3d3349]">
      <p className="text-xs font-semibold text-[#422e59] dark:text-[#c8b6e8]">{term.name}</p>
      <div className="flex gap-2">
        <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)}
          aria-label={`${term.name} starts on`}
          className="w-full rounded-lg border border-[#ded6c8] px-2 py-1 text-xs
                     dark:border-[#3d3349] dark:bg-[#241f2c]" />
        <input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)}
          aria-label={`${term.name} ends on`}
          className="w-full rounded-lg border border-[#ded6c8] px-2 py-1 text-xs
                     dark:border-[#3d3349] dark:bg-[#241f2c]" />
      </div>
      {backwards && (
        <p className="text-[11px] text-red-600 dark:text-red-400">
          A semester ends after it begins.
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={async () => {
            const ok = await onSave({
              action: 'term-dates', termId: term.id, startsOn, endsOn,
            });
            if (ok) setEditing(false);
          }}
          disabled={busy || backwards}
          className="rounded-lg bg-[#422e59] px-3 py-1 text-xs font-medium text-white
                     hover:bg-[#322244] disabled:opacity-40"
        >
          Save
        </button>
        <button
          onClick={() => {
            setStartsOn(term.starts_on);
            setEndsOn(term.ends_on);
            setEditing(false);
          }}
          className="rounded-lg border border-[#ded6c8] px-3 py-1 text-xs text-[#6b6076]
                     dark:border-[#3d3349] dark:text-[#9c93ad]"
        >
          Cancel
        </button>
      </div>
      <p className="text-[10px] text-[#a49bb0]">
        Two semesters of one year may not overlap — a date in two semesters gives every question
        about it two answers, and the database refuses it.
      </p>
    </div>
  );
}

function AddYear({
  years, busy, onClose, onAdd,
}: {
  years: Year[];
  busy: boolean;
  onClose: () => void;
  onAdd: (startsIn: number) => void;
}) {
  const last = years.length > 0 ? years[years.length - 1].starts_in : new Date().getFullYear();
  const [startsIn, setStartsIn] = useState(String(last + 1));
  const n = Number(startsIn);
  const taken = years.some((y) => y.starts_in === n);
  const bad = !Number.isInteger(n) || n < 1900 || n > 2200;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Add an academic year"
    >
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 dark:bg-[#1f1a27]">
        <div>
          <h3 className="flex items-center gap-2 font-heading text-lg font-bold text-[#422e59]
                         dark:text-[#e4dcf0]">
            <CalendarDays size={18} /> Add an academic year
          </h3>
          <p className="mt-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
            The calendar runs to {years[years.length - 1]?.label ?? '—'}. Both semesters are
            created with it, following the University’s rule.
          </p>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-xs uppercase tracking-wide text-[#a49bb0]">
            Opening year
          </span>
          <input type="number" value={startsIn} onChange={(e) => setStartsIn(e.target.value)}
            className="w-full rounded-xl border border-[#ded6c8] px-3 py-2 text-sm
                       dark:border-[#3d3349] dark:bg-[#241f2c]" />
          <p className="mt-1 text-xs text-[#a49bb0]">
            {!bad && `This creates ${n}/${n + 1}, running 15 August ${n} to 14 August ${n + 1}.`}
            {taken && ' It is already in the calendar.'}
          </p>
        </label>

        <div className="flex gap-2">
          <button
            onClick={() => onAdd(n)}
            disabled={busy || bad || taken}
            className="flex-1 rounded-xl bg-[#422e59] px-4 py-2 text-sm font-medium text-white
                       hover:bg-[#322244] disabled:opacity-40"
          >
            Add it
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-[#ded6c8] px-4 py-2 text-sm text-[#6b6076]
                       dark:border-[#3d3349] dark:text-[#9c93ad]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
