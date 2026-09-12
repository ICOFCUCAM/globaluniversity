'use client';

// ---------------------------------------------------------------------------
// Admission openings — what the university is currently admitting to.
//
// WHOSE SCREEN THIS IS. The Head of Academic Affairs, who decides what the
// faculty is ready to teach. The Registrar holds the same capability so
// admissions cannot stall because one office is unstaffed.
//
// WHAT IT CHANGES. An unchecked programme disappears from the public
// application form. It is NOT removed from the prospectus or from its
// programme page — "we are not admitting to this now" and "we do not teach
// this" are different statements, and a site that conflates them tells
// prospective students the university has closed a department when it has
// only closed an intake.
//
// WHY THERE IS NO SAVE-AS-YOU-TYPE. Closing admissions to a programme is a
// decision, not a preference. Changes are staged and applied together, so the
// person doing it sees the whole picture before any applicant does.
// ---------------------------------------------------------------------------

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { courses, MODE_LABEL } from '@/content/courses';
import { Loader2, CheckCircle2, AlertTriangle, DoorOpen } from 'lucide-react';

interface Opening {
  kind: 'level' | 'field' | 'programme';
  /** For a programme this is the course CODE. */
  label: string;
  faculty: string | null;
  open: boolean;
  note: string | null;
  approved_by_email?: string | null;
  approved_at?: string | null;
  updated_by_email?: string | null;
  updated_at?: string | null;
}

/** The catalogue, by code, so a row can show what it is rather than a code. */
const CATALOGUE = new Map(courses.map((c) => [c.code, c]));

function when(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdmissionOpenings() {
  const [rows, setRows] = useState<Opening[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const key = (o: { kind: string; label: string }) => `${o.kind}:${o.label}`;

  useEffect(() => {
    let live = true;
    fetch('/api/admissions/openings')
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        setConfigured(!!d.configured);
        setRows(d.openings ?? []);
      })
      .catch(() => { if (live) { setConfigured(false); setRows([]); } });
    return () => { live = false; };
  }, []);

  const isOpen = (o: Opening) => draft[key(o)] ?? o.open;
  const dirty = useMemo(
    () => (rows ?? []).filter((o) => key(o) in draft && draft[key(o)] !== o.open),
    [rows, draft],
  );

  async function apply() {
    if (dirty.length === 0) return;
    setSaving(true);
    setMessage(null);
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    const res = await fetch('/api/admissions/openings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token ?? ''}` },
      body: JSON.stringify({
        changes: dirty.map((o) => ({ kind: o.kind, label: o.label, open: draft[key(o)] })),
      }),
    });
    const out = await res.json();
    setSaving(false);
    if (!out.ok) {
      setMessage({ tone: 'bad', text: out.error ?? 'The change was not saved.' });
      return;
    }
    setRows((prev) => (prev ?? []).map((o) => (key(o) in draft ? { ...o, open: draft[key(o)] } : o)));
    setDraft({});
    setMessage({
      tone: 'ok',
      text: `${out.changed} change${out.changed === 1 ? '' : 's'} applied. The application form reflects this within a minute.`
        + (out.unmatched?.length ? ` Not found in the register: ${out.unmatched.join(', ')}.` : ''),
    });
  }

  if (rows === null) {
    return <p className="flex items-center gap-2 text-sm text-[#6b6076]"><Loader2 className="animate-spin" size={15} /> Loading…</p>;
  }

  if (!configured) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700/50 dark:bg-amber-900/15">
        <p className="flex items-center gap-2 font-semibold text-[#33234a] dark:text-[#e4dcf0]">
          <AlertTriangle size={16} /> Not configured
        </p>
        <p className="mt-1.5 leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
          Run <code>docs/migrations/008_admission_openings.sql</code>. Until it is run the
          application form offers every level and every field, which is what it did before this
          screen existed — nothing is closed and nobody is being turned away.
        </p>
      </div>
    );
  }

  const programmes = rows.filter((r) => r.kind === 'programme');
  const levels = rows.filter((r) => r.kind === 'level');
  const byFaculty = rows.filter((r) => r.kind === 'field').reduce<Record<string, Opening[]>>((acc, r) => {
    const f = r.faculty ?? 'Other';
    (acc[f] ??= []).push(r);
    return acc;
  }, {});
  const closedCount = rows.filter((r) => !isOpen(r)).length;

  const Row = ({ o }: { o: Opening }) => (
    <label className="flex items-center gap-3 rounded-lg border border-[#ece7de] px-3 py-2.5 dark:border-[#2e2637]">
      <input
        type="checkbox"
        checked={isOpen(o)}
        onChange={(e) => setDraft((d) => ({ ...d, [key(o)]: e.target.checked }))}
        className="h-4 w-4 accent-[#422e59]"
      />
      <span className={`text-sm ${isOpen(o) ? 'text-[#33234a] dark:text-[#e4dcf0]' : 'text-[#9c93ad] line-through'}`}>
        {o.label}
      </span>
      {key(o) in draft && draft[key(o)] !== o.open && (
        <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
          unsaved
        </span>
      )}
    </label>
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="flex items-center gap-2 font-semibold text-[#33234a] dark:text-[#e4dcf0]">
          <DoorOpen size={17} /> Admission openings
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
          Tick what the university is ready to admit to. Anything unticked disappears from the
          public application form, so applicants apply when the university is ready rather than
          waiting for a reply that has to explain the programme is not running.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
          This does not remove the programme from the prospectus or from its own page. Not
          admitting now and not teaching at all are different statements.
        </p>
      </div>

      {/* ------------------------------------------------------------------
          PROGRAMME MANAGEMENT — the grain the University governs at.

          Award level and field of study are coarse: "Master's" and "Theology"
          together do not say whether the Master of Divinity is admitting while
          the Master of Theology is not. This table is the named programme, and
          it is the one the Admissions Portal reads.

          Absent until migration 023 is run, and its absence is silent on
          purpose — the level and field lists below still work, so a database a
          migration behind is a database with fewer controls, not a broken
          screen.
          ------------------------------------------------------------------ */}
      {programmes.length > 0 && (
        <section>
          <h4 className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a7d1f]">
            Programme management
          </h4>
          <p className="mt-1.5 text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
            {programmes.filter(isOpen).length} of {programmes.length} programmes are open. Only a
            ticked programme is offered in the Admissions Portal.
          </p>

          {programmes.every((o) => !isOpen(o)) && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              {/* THE STATE A FRESHLY-RUN 023 LEAVES THE UNIVERSITY IN, said
                  plainly. Programmes are seeded closed because a control that
                  defaults to permitting everything is not a control — but
                  nobody should have to deduce that from an empty portal. */}
              <span>
                <strong>No programme is open, so the Admissions Portal is offering none.</strong>{' '}
                Programmes arrive closed by design. Tick the ones Academic Affairs has authorised
                and apply the changes.
              </span>
            </p>
          )}

          <div className="mt-3 overflow-x-auto rounded-xl border border-[#ece7de] dark:border-[#2e2637]">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[#ece7de] bg-[#faf8f4] text-[10px] uppercase tracking-[0.12em] text-[#8a8194] dark:border-[#2e2637] dark:bg-[#241f2c]">
                  <th className="px-3 py-2.5 font-semibold">Programme</th>
                  <th className="px-3 py-2.5 font-semibold">Faculty</th>
                  <th className="px-3 py-2.5 font-semibold">Level</th>
                  <th className="px-3 py-2.5 font-semibold">Delivery</th>
                  <th className="px-3 py-2.5 font-semibold">Application</th>
                  <th className="px-3 py-2.5 font-semibold">Approved by</th>
                  <th className="px-3 py-2.5 font-semibold">Open</th>
                </tr>
              </thead>
              <tbody>
                {programmes.map((o) => {
                  const c = CATALOGUE.get(o.label);
                  const open = isOpen(o);
                  const changed = key(o) in draft && draft[key(o)] !== o.open;
                  return (
                    <tr
                      key={key(o)}
                      className={`border-b border-[#f0ece4] last:border-0 dark:border-[#2a2333] ${changed ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}`}
                    >
                      <td className="px-3 py-2.5">
                        <span className="font-medium text-[#33234a] dark:text-[#e4dcf0]">
                          {c?.title ?? o.label}
                        </span>
                        <span className="ml-2 font-mono text-[10px] text-[#a49bb0]">{o.label}</span>
                        {/* A code with no catalogue entry means the table and
                            the content file have drifted. Said, not hidden. */}
                        {!c && (
                          <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-red-800">
                            not in the catalogue
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                        {c?.faculty ?? o.faculty ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                        {c?.level ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                        {c ? MODE_LABEL[c.mode] : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${open ? 'text-emerald-700 dark:text-emerald-400' : 'text-[#a49bb0]'}`}>
                          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${open ? 'bg-emerald-500' : 'bg-[#c9c2b4]'}`} />
                          {open ? 'Open' : 'Closed'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                        {o.approved_by_email ? (
                          <>
                            {o.approved_by_email}
                            <span className="block text-[10px] text-[#a49bb0]">{when(o.approved_at)}</span>
                            {/* Who changed it last, when that is somebody else.
                                The University asked for both questions to be
                                answerable and they have different answers the
                                moment one office reverses another. */}
                            {o.updated_by_email && o.updated_by_email !== o.approved_by_email && (
                              <span className="block text-[10px] text-[#a49bb0]">
                                changed by {o.updated_by_email}, {when(o.updated_at)}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[#a49bb0]">never approved</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          aria-label={`Open ${c?.title ?? o.label} for application`}
                          checked={open}
                          onChange={(e) => setDraft((d) => ({ ...d, [key(o)]: e.target.checked }))}
                          className="h-4 w-4 accent-[#422e59]"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h4 className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a7d1f]">
          Award levels
        </h4>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {levels.map((o) => <Row key={key(o)} o={o} />)}
        </div>
      </section>

      {Object.entries(byFaculty).map(([faculty, list]) => (
        <section key={faculty}>
          <h4 className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a7d1f]">
            {faculty}
          </h4>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((o) => <Row key={key(o)} o={o} />)}
          </div>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-3 border-t border-[#ece7de] pt-4 dark:border-[#2e2637]">
        <button
          type="button"
          onClick={apply}
          disabled={dirty.length === 0 || saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[#422e59] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving && <Loader2 className="animate-spin" size={15} />}
          Apply {dirty.length > 0 ? `${dirty.length} change${dirty.length === 1 ? '' : 's'}` : 'changes'}
        </button>
        {dirty.length > 0 && (
          <button type="button" onClick={() => setDraft({})} className="text-sm text-[#6b6076] underline">
            Discard
          </button>
        )}
        <span className="ml-auto text-xs text-[#6b6076] dark:text-[#9c93ad]">
          {closedCount === 0 ? 'Everything is open' : `${closedCount} closed to admission`}
        </span>
      </div>

      {message && (
        <p className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
          message.tone === 'ok'
            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
            : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'
        }`}>
          {message.tone === 'ok' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
          {message.text}
        </p>
      )}
    </div>
  );
}
