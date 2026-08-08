'use client';

// ---------------------------------------------------------------------------
// THE EXAMINER'S CONSOLE.
//
// A completely different interface from the candidate's, as the University
// asked: who is sitting, how long they have left, what the system has observed,
// and what the examiner may do about it.
//
// ---------------------------------------------------------------------------
// THE MOST IMPORTANT THING ON THIS SCREEN IS A SENTENCE
// ---------------------------------------------------------------------------
//
// ALERTS_ARE_NOT_FINDINGS sits above the event list, on every sitting, always.
// It is imported from src/lib/examinations.ts rather than typed here so that it
// cannot be softened on one screen and not another.
//
// A console that lists "second face detected" in red with nothing beside it is
// teaching every proctor who reads it that the system has caught somebody. It
// has not. A camera mistakes reflections, posters, a passing family member and
// a sibling walking through a shared room, and the University was explicit that
// the academic-integrity decision belongs to a person.
//
// ---------------------------------------------------------------------------
// WHY "FLAG" IS CALLED "RECORD WHAT YOU SAW"
// ---------------------------------------------------------------------------
//
// The word `flag` invites a click. "Record what you saw" invites a sentence,
// which is what an incident actually is and what an appeal will read. The
// difference in wording is the difference between a queue of red marks nobody
// can interpret and a record somebody can act on.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { can, type Capability } from '@/lib/roles';
import type { UserRole } from '@/lib/types';
import {
  ALERTS_ARE_NOT_FINDINGS, EVIDENCE_NOTE, DECISION_NOTE,
  describeEvent, sessionMovesFor, INCIDENT_CATEGORIES,
  remainingMs, type SessionState, type EventKind, type EventSource,
  type EventSeverity, type ExamMode,
} from '@/lib/examinations';
import {
  Loader2, AlertTriangle, Camera, MonitorUp, Mic, Clock, Users,
  CheckCircle2, XCircle, FileWarning, Video, Info,
} from 'lucide-react';

interface Live {
  id: string;
  candidate: string;
  studentNumber: string | null;
  state: SessionState;
  startedAt: string | null;
  pausedMs: number;
  pausedAt: string | null;
  extraMinutes: number;
  examTitle: string;
  courseCode: string | null;
  mode: ExamMode;
  durationMinutes: number | null;
  events: Array<{ id: string; kind: EventKind; source: EventSource; severity: EventSeverity; at: string }>;
}

export default function ExaminerConsole({ role }: { role?: UserRole }) {
  const [rows, setRows] = useState<Live[] | null>(null);
  const [notReady, setNotReady] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [proctoring, setProctoring] = useState<{ live: boolean; detail: string } | null>(null);
  // Forces a re-render each second so the countdowns in the list tick. The
  // value is never read — the render is the point.
  const [, setTick] = useState(0);

  const holds = useCallback((c: string) => can(role, c as Capability), [role]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('exam_sessions')
      .select(
        'id, candidate_name, student_number, status, started_at, paused_ms, paused_at, extra_minutes, '
        + 'examinations(title, course_code, mode, duration_minutes), '
        + 'exam_events(id, kind, source, severity, occurred_at)',
      )
      .in('status', ['checks', 'ready', 'in_progress', 'paused'])
      .limit(60);

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

    setRows((data ?? []).map((s: Record<string, any>) => ({
      id: String(s.id),
      candidate: s.candidate_name ?? 'Candidate',
      studentNumber: s.student_number,
      state: s.status,
      startedAt: s.started_at,
      pausedMs: Number(s.paused_ms ?? 0),
      pausedAt: s.paused_at,
      extraMinutes: Number(s.extra_minutes ?? 0),
      examTitle: s.examinations?.title ?? 'Examination',
      courseCode: s.examinations?.course_code ?? null,
      mode: (s.examinations?.mode ?? 'standard') as ExamMode,
      durationMinutes: s.examinations?.duration_minutes ?? null,
      events: (s.exam_events ?? [])
        .map((e: any) => ({
          id: String(e.id), kind: e.kind, source: e.source,
          severity: e.severity, at: e.occurred_at,
        }))
        .sort((a: any, b: any) => Date.parse(b.at) - Date.parse(a.at)),
    })));
  }, []);

  useEffect(() => { void load(); }, [load]);

  // A LIVE CONSOLE HAS TO BE LIVE. Ten seconds is often enough for a room of
  // candidates and gentle enough not to hammer the register.
  useEffect(() => {
    const poll = setInterval(() => { void load(); }, 10_000);
    const clock = setInterval(() => setTick((t) => t + 1), 1000);
    return () => { clearInterval(poll); clearInterval(clock); };
  }, [load]);

  useEffect(() => {
    void (async () => {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch('/api/exam/proctoring', {
        headers: { authorization: `Bearer ${session.session?.access_token ?? ''}` },
      });
      const out = await res.json().catch(() => null);
      if (out?.ok) setProctoring({ live: out.live, detail: out.detail });
    })();
  }, []);

  async function call(path: string, body: unknown, ok: (o: any) => void) {
    setBusy(true); setMessage(null);
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch(path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.session?.access_token ?? ''}`,
      },
      body: JSON.stringify(body),
    });
    const out = await res.json().catch(() => ({ ok: false, error: 'no-reply' }));
    setBusy(false);
    if (!out.ok) { setMessage({ tone: 'bad', text: out.detail ?? out.error }); return; }
    ok(out);
  }

  const chosen = useMemo(() => rows?.find((r) => r.id === selected) ?? null, [rows, selected]);

  // Sittings with an unattended alert first — that is the whole job of this list.
  const ordered = useMemo(() => {
    const score = (r: Live) => r.events.filter((e) => e.severity === 'alert').length;
    return [...(rows ?? [])].sort((a, b) => score(b) - score(a) || a.candidate.localeCompare(b.candidate));
  }, [rows]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">Examiner console</h1>
        <p className="mt-1 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          Sittings under way now. {ordered.length} live.
        </p>
      </div>

      {notReady && (
        <div className="flex items-start gap-3 rounded-xl border border-[#e9c14a]/40 bg-[#e9c14a]/10 p-4 text-sm">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-[#a07c12]" />
          <span className="text-[#6b6076] dark:text-[#9c93ad]">{notReady}</span>
        </div>
      )}

      {/* HONEST ABOUT THE MEDIA. A camera panel with nothing behind it is worse
          than a sentence saying there is nothing behind it: the examiner
          believes they are watching, and nobody finds out for weeks. */}
      {proctoring && !proctoring.live && (
        <div className="flex items-start gap-3 rounded-xl border border-[#ece7de] bg-[#faf8f4] p-4 text-sm dark:border-[#2e2637] dark:bg-[#241f2c]">
          <Video size={17} className="mt-0.5 flex-shrink-0 text-[#9c93ad]" />
          <span className="text-[#6b6076] dark:text-[#9c93ad]">{proctoring.detail}</span>
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

      <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
        {/* ---------------------------------------------------------------- */}
        <section>
          {rows === null ? <Loader2 size={18} className="animate-spin text-[#9c93ad]" />
            : ordered.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#ece7de] p-6 text-center text-sm text-[#6b6076] dark:border-[#2e2637] dark:text-[#9c93ad]">
                No examination is under way.
              </p>
            ) : (
              <ul className="space-y-2">
                {ordered.map((r) => {
                  const alerts = r.events.filter((e) => e.severity === 'alert').length;
                  const left = remainingMs(
                    { id: r.id, state: r.state, startedAt: r.startedAt, submittedAt: null,
                      pausedMs: r.pausedMs, pausedAt: r.pausedAt, extraMinutes: r.extraMinutes },
                    { durationMinutes: r.durationMinutes, opensAt: null, closesAt: null, mode: r.mode },
                  );
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(r.id)}
                        className={`w-full rounded-xl border p-3 text-left ${
                          selected === r.id
                            ? 'border-[#422e59] bg-[#faf6ee] dark:bg-[#2a2333]'
                            : 'border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27]'
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-medium text-[#422e59] dark:text-[#e4dcf0]">
                            {r.candidate}
                          </p>
                          {alerts > 0 && (
                            <span className="flex-shrink-0 rounded-full bg-red-600/10 px-1.5 text-xs font-semibold text-red-700 dark:text-red-300">
                              {alerts}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-[#9c93ad]">
                          {r.studentNumber ?? '—'} · {r.courseCode ?? r.examTitle}
                        </p>
                        <p className="mt-1 flex items-center gap-2 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                          <span className={`rounded px-1.5 py-0.5 ${
                            r.state === 'paused' ? 'bg-[#e9c14a]/20 text-[#8a6a10]'
                              : r.state === 'in_progress' ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-300'
                                : 'bg-[#ece7de] text-[#6b6076] dark:bg-[#2e2637] dark:text-[#9c93ad]'
                          }`}>
                            {r.state.replace('_', ' ')}
                          </span>
                          {left !== null && (
                            <span className="tabular-nums">
                              {Math.floor(left / 60000)} min left
                            </span>
                          )}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          {!chosen ? (
            <p className="rounded-xl border border-dashed border-[#ece7de] p-8 text-center text-sm text-[#6b6076] dark:border-[#2e2637] dark:text-[#9c93ad]">
              Choose a candidate to see their sitting.
            </p>
          ) : (
            <Sitting
              key={chosen.id}
              live={chosen}
              holds={holds}
              busy={busy}
              proctoringLive={proctoring?.live ?? false}
              onAction={(body) => call('/api/exam/session', { sessionId: chosen.id, ...body }, (o) => {
                setMessage({ tone: 'ok', text: o.message }); void load();
              })}
              onIncident={(body) => call('/api/exam/integrity', { sessionId: chosen.id, ...body }, (o) => {
                setMessage({ tone: 'ok', text: o.message }); void load();
              })}
            />
          )}
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Sitting({
  live, holds, busy, proctoringLive, onAction, onIncident,
}: {
  live: Live;
  holds: (c: string) => boolean;
  busy: boolean;
  proctoringLive: boolean;
  onAction: (body: Record<string, unknown>) => void;
  onIncident: (body: Record<string, unknown>) => void;
}) {
  const [reason, setReason] = useState('');
  const [minutes, setMinutes] = useState(10);
  const [category, setCategory] = useState<string>('environment');
  const [observation, setObservation] = useState('');

  const moves = sessionMovesFor(live.state, holds, false);
  const alerts = live.events.filter((e) => e.severity === 'alert');

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#ece7de] bg-white p-4 dark:border-[#2e2637] dark:bg-[#1f1a27]">
        <p className="font-heading text-lg font-bold text-[#422e59] dark:text-[#e4dcf0]">{live.candidate}</p>
        <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
          {live.studentNumber ?? '—'} · {live.examTitle}
        </p>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <Feed icon={<Camera size={15} />} label="Camera" live={proctoringLive} />
          <Feed icon={<MonitorUp size={15} />} label="Screen" live={proctoringLive} />
          <Feed icon={<Mic size={15} />} label="Microphone" live={proctoringLive} />
        </div>
      </div>

      {/* WHAT THE EXAMINER MAY DO. Drawn from sessionMovesFor, so an
          invigilator sees none of these and an Examination Officer sees all. */}
      {(moves.length > 0 || holds('control-exam-session')) && (
        <div className="rounded-xl border border-[#ece7de] bg-white p-4 dark:border-[#2e2637] dark:bg-[#1f1a27]">
          <h3 className="text-sm font-semibold text-[#422e59] dark:text-[#e4dcf0]">This sitting</h3>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why. Required for anything that changes the candidate's examination."
            className="mt-2 w-full rounded-lg border border-[#ded6c8] bg-white p-2 text-xs dark:border-[#3d3349] dark:bg-[#241f2c] dark:text-[#e4dcf0]"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {moves.map((m) => (
              <button
                key={m.to}
                type="button"
                onClick={() => onAction({ action: m.to, reason })}
                disabled={busy || (m.requiresReason && !reason.trim())}
                title={m.requiresReason && !reason.trim() ? 'Say why first.' : undefined}
                className="rounded-lg border border-[#ded6c8] px-3 py-1.5 text-xs font-semibold text-[#422e59] disabled:opacity-40 dark:border-[#3d3349] dark:text-[#e4dcf0]"
              >
                {m.label}
              </button>
            ))}
            {holds('control-exam-session') && live.state === 'in_progress' && (
              <span className="inline-flex items-center gap-1.5">
                <input
                  type="number"
                  value={minutes}
                  min={1}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                  className="w-16 rounded-lg border border-[#ded6c8] p-1.5 text-xs dark:border-[#3d3349] dark:bg-[#241f2c] dark:text-[#e4dcf0]"
                />
                <button
                  type="button"
                  onClick={() => onAction({ action: 'in_progress', minutes, reason })}
                  disabled={busy || !reason.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#ded6c8] px-3 py-1.5 text-xs font-semibold text-[#422e59] disabled:opacity-40 dark:border-[#3d3349] dark:text-[#e4dcf0]"
                >
                  <Clock size={12} /> Grant minutes
                </button>
              </span>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* EVIDENCE                                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-xl border border-[#ece7de] bg-white p-4 dark:border-[#2e2637] dark:bg-[#1f1a27]">
        <h3 className="text-sm font-semibold text-[#422e59] dark:text-[#e4dcf0]">
          What the system observed
        </h3>
        <p className="mt-0.5 text-xs text-[#9c93ad]">{EVIDENCE_NOTE}</p>

        {/* THE SENTENCE. Imported, never retyped — see the header. */}
        <p className="mt-2 flex items-start gap-2 rounded-lg bg-[#faf8f4] p-2.5 text-xs text-[#6b6076] dark:bg-[#241f2c] dark:text-[#9c93ad]">
          <Info size={13} className="mt-0.5 flex-shrink-0" />
          {ALERTS_ARE_NOT_FINDINGS}
        </p>

        {live.events.length === 0 ? (
          <p className="mt-3 text-sm text-[#6b6076] dark:text-[#9c93ad]">Nothing recorded yet.</p>
        ) : (
          <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
            {live.events.slice(0, 60).map((e) => (
              <li key={e.id} className="flex items-baseline gap-2 text-xs">
                <span className="w-14 flex-shrink-0 tabular-nums text-[#9c93ad]">
                  {new Date(e.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className={`rounded px-1.5 ${
                  e.severity === 'alert' ? 'bg-red-600/10 text-red-700 dark:text-red-300'
                    : e.severity === 'notice' ? 'bg-[#e9c14a]/20 text-[#8a6a10]'
                      : 'text-[#6b6076] dark:text-[#9c93ad]'
                }`}>
                  {describeEvent(e.kind, e.source)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* DECISION                                                           */}
      {/* ------------------------------------------------------------------ */}
      {holds('record-exam-incident') && (
        <div className="rounded-xl border border-[#ece7de] bg-white p-4 dark:border-[#2e2637] dark:bg-[#1f1a27]">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[#422e59] dark:text-[#e4dcf0]">
            <FileWarning size={15} /> Record what you saw
          </h3>
          <p className="mt-0.5 text-xs text-[#9c93ad]">{DECISION_NOTE}</p>
          <p className="mt-1 text-xs text-[#6b6076] dark:text-[#9c93ad]">
            This is an observation, not an accusation. Somebody other than you decides whether it
            amounts to misconduct.
          </p>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-2 w-full rounded-lg border border-[#ded6c8] bg-white p-2 text-xs dark:border-[#3d3349] dark:bg-[#241f2c] dark:text-[#e4dcf0]"
          >
            {INCIDENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <textarea
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            rows={3}
            placeholder="e.g. Between 10:40 and 10:45 the candidate looked repeatedly to their right, off camera. I asked them to reposition the camera and they did."
            className="mt-2 w-full rounded-lg border border-[#ded6c8] bg-white p-2 text-sm dark:border-[#3d3349] dark:bg-[#241f2c] dark:text-[#e4dcf0]"
          />

          <button
            type="button"
            onClick={() => {
              onIncident({
                kind: 'incident', category, description: observation,
                eventIds: alerts.map((a) => a.id),
              });
              setObservation('');
            }}
            disabled={busy || !observation.trim()}
            className="mt-2 rounded-lg bg-[#422e59] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40 dark:bg-[#c5a55a] dark:text-[#241a30]"
          >
            Record it
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * One media panel.
 *
 * WHEN THERE IS NO PROVIDER IT SAYS SO, rather than showing a black rectangle.
 * A dark tile reads as "the camera is off" — which is a statement about the
 * candidate — when the truth is that this deployment has no way to carry video.
 * Blaming a candidate for the University's missing subscription is the specific
 * failure this avoids.
 */
function Feed({ icon, label, live }: { icon: React.ReactNode; label: string; live: boolean }) {
  return (
    <div className="rounded-lg border border-[#ece7de] bg-[#faf8f4] p-3 text-center dark:border-[#2e2637] dark:bg-[#241f2c]">
      <span className="inline-flex text-[#9c93ad]">{icon}</span>
      <p className="mt-1 text-xs font-medium text-[#422e59] dark:text-[#e4dcf0]">{label}</p>
      <p className="text-xs text-[#9c93ad]">
        {live ? 'Connecting…' : 'No media provider'}
      </p>
    </div>
  );
}
