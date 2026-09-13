'use client';

// ---------------------------------------------------------------------------
// THE APPOINTMENTS DASHBOARD.
//
// ---------------------------------------------------------------------------
// NINE NUMBERS, AND EACH ONE IS A QUESTION SOMEBODY ASKS
// ---------------------------------------------------------------------------
//
// Not a longer version of the board's five counters. Those answer "what is on
// my desk"; these answer "where is every appointment in the University".
//
// "Awaiting Acceptance" earns its place hardest. It is NOT the same as
// "Issued": it is the subset nobody has replied to. An offer unanswered for six
// weeks is a post the University believes is filled and a candidate who has
// taken another job, and until 050 recorded acceptance as its own act the
// question could not be asked at all.
//
// ---------------------------------------------------------------------------
// EVERY NUMBER IS CLICKABLE, AND THAT IS THE POINT
// ---------------------------------------------------------------------------
//
// A dashboard that shows "Awaiting VC: 6" and cannot say WHICH six is a poster.
// The counters and the list read the same functions in appointments.ts, so the
// number and the rows behind it cannot disagree — which is exactly what happens
// when a screen counts one way and filters another.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/roles';
import { FOCUS } from '@/lib/portalTheme';
import { Loader2, X } from 'lucide-react';
import {
  dashboardCounters, DASHBOARD_LABELS, matching, applyFilters, optionsFor,
  APPOINTMENT_FILTERS, boardStatus, ACTION_LABELS, EMPLOYMENT_LABELS,
  EXPIRING_WINDOW_DAYS,
  type DashboardRow, type DashboardCounters, type FilterKey,
  type AppointmentAction, type EmploymentType,
} from '@/lib/appointments';

// A SINGLE STRING LITERAL. Concatenation makes supabase-js collapse the
// inferred row type to GenericStringError[], silently and with no error here.
// eslint-disable-next-line max-len
const COLUMNS = 'id, full_name, position_title, unit_name, faculty, employment_type, appointment_action, status, start_date, end_date, issued_at, accepted_at, initiated_by_office';

/** The counters that mean somebody has to do something today. */
const NEEDS_ACTION: (keyof DashboardCounters)[] = [
  'awaitingReview', 'awaitingVc', 'lettersReady', 'awaitingAcceptance', 'expiringSoon',
];

export default function AppointmentDashboard() {
  const { user } = useAuth();
  const maySee = can(user?.role, 'draft-appointment')
    || can(user?.role, 'authorize-appointment')
    || can(user?.role, 'view-executive-dashboard');

  const [rows, setRows] = useState<DashboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Partial<Record<FilterKey, string>>>({});
  const [drill, setDrill] = useState<keyof DashboardCounters | null>(null);
  // WHEN SOMEBODY BECOMES A MEMBER OF STAFF. 050 made this a setting rather
  // than an assumption in code, and a setting nothing displays is an
  // assumption again — with an extra table.
  const [rule, setRule] = useState<{ value: string; allowed: string[] } | null>(null);

  const load = useCallback(async () => {
    // THE PAY-FREE VIEW IS NOT NEEDED HERE because no column selected is a
    // salary. A dashboard does not need to know what anybody is paid, so it
    // does not ask — rather than asking and choosing not to display it.
    const { data, error: e } = await supabase.from('appointments')
      .select(COLUMNS).order('start_date', { ascending: false }).limit(1000);
    if (e) {
      // SAID, NOT SWALLOWED. An unreachable database and a University with no
      // appointments draw the same empty dashboard, and only one of those is a
      // reason to do nothing.
      setError(e.message);
      setRows([]);
      return;
    }
    setRows((data ?? []) as DashboardRow[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('institutional_settings')
        .select('value, allowed').eq('key', 'staff_activation_point').maybeSingle();
      if (data) {
        setRule({
          value: String((data as Record<string, unknown>).value ?? ''),
          allowed: ((data as Record<string, unknown>).allowed as string[]) ?? [],
        });
      }
    })();
  }, []);

  // FILTERS APPLY TO THE COUNTERS TOO. A dashboard whose numbers ignore the
  // filter above them is a dashboard that answers a question nobody asked.
  const filtered = useMemo(() => applyFilters(rows ?? [], chosen), [rows, chosen]);
  const counters = useMemo(() => dashboardCounters(filtered), [filtered]);
  const shown = useMemo(
    () => (drill ? matching(filtered, drill) : []), [filtered, drill]);

  if (!maySee) {
    return (
      <div className="p-6 text-sm text-gray-600">
        Your role does not see the University&rsquo;s appointments.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">Appointments</h1>
        <p className="text-sm text-gray-600">
          Where every appointment in the University stands. Click a number to see which.
        </p>
      </header>

      {error && (
        <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          The register could not be read: {error}
        </div>
      )}

      {/* ------------------------------------------------------------------
          THE FILTERS
          ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-end gap-3">
        {APPOINTMENT_FILTERS.map((f) => {
          const options = optionsFor(rows ?? [], f.key);
          // A FILTER WITH NOTHING TO OFFER IS NOT SHOWN. Offering "Faculty" on
          // a register where no appointment names one is a control that can
          // only produce an empty result.
          if (options.length === 0) return null;
          return (
            <div key={f.key}>
              <label
                className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500"
                htmlFor={`f-${f.key}`}
              >
                {f.label}
              </label>
              <select
                id={`f-${f.key}`}
                className={`mt-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm ${FOCUS}`}
                value={chosen[f.key] ?? ''}
                onChange={(e) => setChosen({ ...chosen, [f.key]: e.target.value || undefined })}
              >
                <option value="">All</option>
                {options.map((o) => (
                  <option key={o} value={o}>
                    {f.key === 'action' ? (ACTION_LABELS[o as AppointmentAction] ?? o)
                      : f.key === 'employment' ? (EMPLOYMENT_LABELS[o as EmploymentType] ?? o)
                        : o}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
        {Object.values(chosen).some(Boolean) && (
          <button
            type="button"
            className={`rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 ${FOCUS}`}
            onClick={() => setChosen({})}
          >
            <X className="inline h-3.5 w-3.5" aria-hidden /> Clear
          </button>
        )}
      </div>

      {/* ------------------------------------------------------------------
          THE NINE
          ------------------------------------------------------------------ */}
      {rows === null ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Reading the register&hellip;
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {(Object.keys(DASHBOARD_LABELS) as (keyof DashboardCounters)[]).map((k) => {
            const n = counters[k];
            // AMBER WHERE SOMEBODY HAS TO ACT, and only when there is
            // something to act on. Colouring a zero would teach people to
            // ignore the colour.
            const wants = NEEDS_ACTION.includes(k) && n > 0;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={drill === k}
                className={`rounded-xl border p-3 text-left transition ${FOCUS} ${
                  drill === k
                    ? 'border-purple-700 bg-purple-50'
                    : wants
                      ? 'border-amber-300 bg-amber-50 hover:bg-amber-100'
                      : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                onClick={() => setDrill(drill === k ? null : k)}
              >
                <span className="block text-xs text-gray-600">{DASHBOARD_LABELS[k]}</span>
                <span className="block text-2xl font-semibold text-gray-900">{n}</span>
                {k === 'expiringSoon' && (
                  <span className="block text-[10px] text-gray-500">
                    within {EXPIRING_WINDOW_DAYS} days
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------------
          THE RULE THE UNIVERSITY SET.

          SHOWN BECAUSE IT DECIDES A NUMBER ABOVE. "Active" counts people the
          system says work here, and which appointments reach that state is
          this setting — so reading the dashboard without knowing the rule is
          reading a number whose meaning is elsewhere.
          ------------------------------------------------------------------ */}
      {rule && (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
          An appointee becomes a member of staff{' '}
          <strong className="text-gray-900">
            {rule.value === 'accepted' ? 'when they accept the appointment'
              : rule.value === 'issued' ? 'as soon as the letter is issued'
                : 'on the day the appointment begins'}
          </strong>
          . The Superadministrator changes this in{' '}
          <code>institutional_settings.staff_activation_point</code>; the database enforces
          whichever value it holds.
          {rule.value === 'issued' && (
            <span className="ml-1 text-amber-800">
              Note: under this rule a staff record exists for somebody who may still decline.
            </span>
          )}
        </p>
      )}

      {/* ------------------------------------------------------------------
          AND WHICH ONES
          ------------------------------------------------------------------ */}
      {drill && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">
            {DASHBOARD_LABELS[drill]} — {shown.length}
          </h2>
          {shown.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing under {DASHBOARD_LABELS[drill]}.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Position</th>
                    <th className="px-3 py-2">Faculty or department</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Starts</th>
                    <th className="px-3 py-2">Ends</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {shown.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-medium text-gray-900">{r.full_name}</td>
                      <td className="px-3 py-2">{r.position_title}</td>
                      <td className="px-3 py-2">{r.faculty || r.unit_name || '—'}</td>
                      <td className="px-3 py-2">
                        {ACTION_LABELS[r.appointment_action as AppointmentAction]
                          ?? EMPLOYMENT_LABELS[r.employment_type as EmploymentType]
                          ?? '—'}
                      </td>
                      <td className="px-3 py-2">{boardStatus(r)}</td>
                      <td className="px-3 py-2">{r.start_date ?? '—'}</td>
                      <td className="px-3 py-2">{r.end_date ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
