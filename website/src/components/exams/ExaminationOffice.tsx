'use client';

// ---------------------------------------------------------------------------
// THE EXAMINATION OFFICE — setting a diet, and releasing it.
//
// ---------------------------------------------------------------------------
// THE PAPER IS NOT PUBLISHED BY THE PERSON WHO SET IT
// ---------------------------------------------------------------------------
//
// The workflow runs draft → questions approved → published, and the second step
// belongs to a moderator rather than to whoever wrote the paper. This is the
// same separation the University already requires of certificate designs, of
// grades and of announcements, and it matters most here: a paper released by
// its own author has had exactly one reader, and the errors an author cannot
// see in their own questions are the ones that cost a whole cohort marks.
//
// ---------------------------------------------------------------------------
// THE SUPERVISION SETTINGS DEFAULT FROM THE MODE, AND CAN BE OVERRIDDEN
// ---------------------------------------------------------------------------
//
// A viva does not need a screen share and a take-home paper cannot have a
// camera, so the defaults follow the mode rather than a global policy. They
// remain editable because the Examination Office knows things this system does
// not — that this particular practical is being sat in a supervised computer
// room, for instance, where a camera adds nothing.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { can, type Capability } from '@/lib/roles';
import type { UserRole } from '@/lib/types';
import {
  EXAM_MODES, MODE_PROFILES, EXAM_TRANSITIONS,
  type ExamMode, type ExamState,
} from '@/lib/examinations';
import { Loader2, Plus, AlertTriangle, CheckCircle2, XCircle, CalendarClock } from 'lucide-react';

interface Row {
  id: string;
  title: string;
  mode: ExamMode;
  status: ExamState;
  courseCode: string | null;
  durationMinutes: number | null;
  opensAt: string | null;
  closesAt: string | null;
  totalMarks: number;
  sittings: number;
}

export default function ExaminationOffice({ role }: { role?: UserRole }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [notReady, setNotReady] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: '', courseCode: '', mode: 'standard' as ExamMode,
    durationMinutes: 120, totalMarks: 100, passMark: 50,
    opensAt: '', closesAt: '',
  });

  const holds = useCallback((c: string) => can(role, c as Capability), [role]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('examinations')
      .select('id, title, mode, status, course_code, duration_minutes, opens_at, closes_at, total_marks, exam_sessions(id)')
      .order('created_at', { ascending: false })
      .limit(80);

    if (error) {
      setNotReady(
        error.message.includes('does not exist')
          ? 'Run docs/migrations/015_examination_and_proctoring.sql.'
          : error.message,
      );
      setRows([]);
      return;
    }
    setNotReady(null);
    setRows((data ?? []).map((e: Record<string, any>) => ({
      id: String(e.id), title: e.title, mode: e.mode, status: e.status,
      courseCode: e.course_code, durationMinutes: e.duration_minutes,
      opensAt: e.opens_at, closesAt: e.closes_at, totalMarks: e.total_marks,
      sittings: (e.exam_sessions ?? []).length,
    })));
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function call(body: unknown, label: string) {
    setBusy(label); setMessage(null);
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch('/api/exam/paper', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.session?.access_token ?? ''}`,
      },
      body: JSON.stringify(body),
    });
    const out = await res.json().catch(() => ({ ok: false, error: 'no-reply' }));
    setBusy(null);
    if (!out.ok) { setMessage({ tone: 'bad', text: out.detail ?? out.error }); return; }
    setMessage({ tone: 'ok', text: out.message });
    void load();
  }

  const profile = MODE_PROFILES[form.mode];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">Examinations</h1>
          <p className="mt-1 text-sm text-[#6b6076] dark:text-[#9c93ad]">
            Setting the diet, and releasing it to the cohort.
          </p>
        </div>
        {holds('schedule-examination') && (
          <button
            type="button"
            onClick={() => setCreating((c) => !c)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#ded6c8] px-4 py-2 text-sm font-semibold text-[#422e59] dark:border-[#3d3349] dark:text-[#e4dcf0]"
          >
            <Plus size={15} /> New paper
          </button>
        )}
      </div>

      {notReady && (
        <div className="flex items-start gap-3 rounded-xl border border-[#e9c14a]/40 bg-[#e9c14a]/10 p-4 text-sm">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-[#a07c12]" />
          <span className="text-[#6b6076] dark:text-[#9c93ad]">{notReady}</span>
        </div>
      )}

      {message && (
        <div
          role="status"
          className={`flex items-start gap-3 rounded-xl p-4 text-sm ${
            message.tone === 'ok'
              ? 'border border-emerald-600/30 bg-emerald-600/10 text-emerald-900 dark:text-emerald-200'
              : 'border border-red-600/30 bg-red-600/10 text-red-900 dark:text-red-200'
          }`}
        >
          {message.tone === 'ok' ? <CheckCircle2 size={17} className="mt-0.5 flex-shrink-0" />
            : <XCircle size={17} className="mt-0.5 flex-shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {creating && (
        <div className="space-y-3 rounded-xl border border-[#ece7de] bg-white p-5 dark:border-[#2e2637] dark:bg-[#1f1a27]">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
            <Field label="Course code" value={form.courseCode} onChange={(v) => setForm({ ...form, courseCode: v })} />
          </div>

          <fieldset>
            <legend className="text-xs font-medium text-[#6b6076] dark:text-[#9c93ad]">Kind of examination</legend>
            <div className="mt-1.5 space-y-1">
              {EXAM_MODES.map((m) => (
                <label key={m} className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    className="mt-1"
                    checked={form.mode === m}
                    onChange={() => setForm({
                      ...form,
                      mode: m,
                      // A take-home paper has a window, not a duration. Leaving
                      // 120 minutes on it would produce a countdown that
                      // submits three days of work after two hours.
                      durationMinutes: m === 'take-home' ? 0 : form.durationMinutes || 120,
                    })}
                  />
                  <span>
                    <span className="text-[#422e59] dark:text-[#e4dcf0]">{MODE_PROFILES[m].label}</span>
                    <span className="block text-xs text-[#9c93ad]">{MODE_PROFILES[m].note}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* WHAT THIS MODE WILL REQUIRE OF THE CANDIDATE, shown while the
              choice is being made rather than discovered by a cohort at 09:00. */}
          <p className="rounded-lg bg-[#faf8f4] p-2.5 text-xs text-[#6b6076] dark:bg-[#241f2c] dark:text-[#9c93ad]">
            <strong className="font-semibold">Candidates will need:</strong>{' '}
            {[
              profile.defaults.camera && 'a camera',
              profile.defaults.microphone && 'a microphone',
              profile.defaults.screenShare && 'to share their screen',
              profile.defaults.fullscreen && 'to work full screen',
            ].filter(Boolean).join(', ') || 'nothing beyond a browser — this mode is not proctored.'}
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            {form.mode !== 'take-home' && (
              <Field
                label="Minutes"
                value={String(form.durationMinutes)}
                onChange={(v) => setForm({ ...form, durationMinutes: Number(v) || 0 })}
                type="number"
              />
            )}
            <Field label="Total marks" value={String(form.totalMarks)} onChange={(v) => setForm({ ...form, totalMarks: Number(v) || 0 })} type="number" />
            <Field label="Pass mark" value={String(form.passMark)} onChange={(v) => setForm({ ...form, passMark: Number(v) || 0 })} type="number" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Opens" value={form.opensAt} onChange={(v) => setForm({ ...form, opensAt: v })} type="datetime-local" />
            <Field label="Closes" value={form.closesAt} onChange={(v) => setForm({ ...form, closesAt: v })} type="datetime-local" />
          </div>

          <button
            type="button"
            onClick={() => { void call({ action: 'create', ...form }, 'create'); setCreating(false); }}
            disabled={busy === 'create' || !form.title.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#422e59] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-[#c5a55a] dark:text-[#241a30]"
          >
            {busy === 'create' && <Loader2 size={14} className="animate-spin" />}
            Create as a draft
          </button>
          <p className="text-xs text-[#9c93ad]">
            A new paper is a draft. Its questions are approved by a moderator, and only then can it
            be published — the office that sets a paper does not release it.
          </p>
        </div>
      )}

      {rows === null ? <Loader2 size={18} className="animate-spin text-[#9c93ad]" />
        : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#ece7de] p-8 text-center text-sm text-[#6b6076] dark:border-[#2e2637] dark:text-[#9c93ad]">
            No examination has been set yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => {
              const moves = (EXAM_TRANSITIONS[r.status] ?? []).filter((t) => holds(t.capability));
              return (
                <li key={r.id} className="rounded-xl border border-[#ece7de] bg-white p-4 dark:border-[#2e2637] dark:bg-[#1f1a27]">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-heading font-bold text-[#422e59] dark:text-[#e4dcf0]">{r.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.status === 'published' || r.status === 'in_progress'
                        ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-300'
                        : r.status === 'cancelled'
                          ? 'bg-red-600/10 text-red-700 dark:text-red-300'
                          : 'bg-[#ece7de] text-[#6b6076] dark:bg-[#2e2637] dark:text-[#9c93ad]'
                    }`}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                    {r.courseCode ? `${r.courseCode} · ` : ''}{MODE_PROFILES[r.mode].label}
                    {r.durationMinutes ? ` · ${r.durationMinutes} min` : ''} · {r.totalMarks} marks
                    {r.sittings > 0 && ` · ${r.sittings} ${r.sittings === 1 ? 'sitting' : 'sittings'}`}
                  </p>
                  {(r.opensAt || r.closesAt) && (
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#9c93ad]">
                      <CalendarClock size={11} />
                      {r.opensAt ? new Date(r.opensAt).toLocaleString('en-GB') : '—'}
                      {' → '}
                      {r.closesAt ? new Date(r.closesAt).toLocaleString('en-GB') : '—'}
                    </p>
                  )}

                  {moves.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {moves.map((m) => (
                        <button
                          key={m.to}
                          type="button"
                          onClick={() => void call({ action: 'move', examinationId: r.id, to: m.to }, r.id)}
                          disabled={busy === r.id}
                          className="rounded-lg border border-[#ded6c8] px-3 py-1.5 text-xs font-semibold text-[#422e59] disabled:opacity-40 dark:border-[#3d3349] dark:text-[#e4dcf0]"
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {moves.length === 0 && r.status === 'draft' && (
                    <p className="mt-2 text-xs text-[#9c93ad]">
                      Waiting for a moderator to approve the questions. You cannot approve your own paper.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
    </div>
  );
}

function Field({
  label, value, onChange, type = 'text',
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[#6b6076] dark:text-[#9c93ad]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[#ded6c8] bg-white p-2 text-sm text-[#33234a] dark:border-[#3d3349] dark:bg-[#241f2c] dark:text-[#e4dcf0]"
      />
    </label>
  );
}
