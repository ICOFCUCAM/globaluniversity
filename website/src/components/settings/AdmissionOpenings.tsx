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
import { Loader2, CheckCircle2, AlertTriangle, DoorOpen } from 'lucide-react';

interface Opening {
  kind: 'level' | 'field';
  label: string;
  faculty: string | null;
  open: boolean;
  note: string | null;
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
