'use client';

// ---------------------------------------------------------------------------
// SITTING AN EXAMINATION.
//
// The candidate's side. Two phases: the checks before, and the paper itself.
//
// ---------------------------------------------------------------------------
// THIS SCREEN IS WRITTEN FOR SOMEBODY FRIGHTENED
// ---------------------------------------------------------------------------
//
// Every design decision here follows from one observation: a person about to
// sit an examination they have prepared months for is not in a state to debug
// anything. So:
//
//   Every failed check says what to DO, not what is wrong. "Camera check
//   failed" sends them to a helpdesk queue twenty minutes before their paper.
//   "Your browser is blocking the camera — click the camera icon in the address
//   bar and choose Allow" is something they can fix alone in ten seconds.
//
//   The clock is never alarming until it should be. A countdown that turns red
//   at thirty minutes teaches candidates to ignore red.
//
//   Every save says so, with the time. "Saving…" that never resolves is the
//   single most stressful thing an examination interface can do, and the whole
//   reason `exam_answers` keeps a revision history is so this screen can make a
//   promise it can actually keep.
//
//   Nothing is ever lost silently. A save refused because time ran out says so
//   plainly and says what IS on the register.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  requirementsFor, mayStart, MODE_PROFILES,
  type ExamMode, type Readiness, type SessionState,
} from '@/lib/examinations';
import {
  Loader2, Camera, Mic, MonitorUp, Wifi, ShieldCheck, AlertTriangle,
  CheckCircle2, XCircle, Clock, Save, Send,
} from 'lucide-react';

interface Exam {
  id: string;
  title: string;
  mode: ExamMode;
  durationMinutes: number | null;
  totalMarks: number;
  courseCode: string | null;
  opensAt: string | null;
  closesAt: string | null;
}

export default function SitExamination() {
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [chosen, setChosen] = useState<Exam | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [state, setState] = useState<SessionState>('created');
  const [readiness, setReadiness] = useState<Partial<Readiness>>({});
  const [remaining, setRemaining] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streams = useRef<MediaStream[]>([]);

  // -------------------------------------------------------------------------
  const load = useCallback(async () => {
    const { data } = await supabase
      .from('examinations')
      .select('id, title, mode, duration_minutes, total_marks, course_code, opens_at, closes_at')
      .in('status', ['published', 'in_progress'])
      .order('opens_at', { ascending: true });

    setExams((data ?? []).map((e: Record<string, any>) => ({
      id: String(e.id), title: e.title, mode: e.mode,
      durationMinutes: e.duration_minutes, totalMarks: e.total_marks,
      courseCode: e.course_code, opensAt: e.opens_at, closesAt: e.closes_at,
    })));
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function call(path: string, body: unknown) {
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch(path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.session?.access_token ?? ''}`,
      },
      body: JSON.stringify(body),
    });
    return res.json().catch(() => ({ ok: false, error: 'no-reply' }));
  }

  /** Report an event. Fire and forget — never block the candidate on it. */
  const report = useCallback((kind: string, detail?: Record<string, unknown>) => {
    if (!sessionId) return;
    void call('/api/exam/event', {
      sessionId,
      // The client's own clock travels as `reported_at` and is labelled as
      // reported. The server stamps the real time.
      events: [{ kind, detail: { ...detail, reported_at: new Date().toISOString() } }],
    });
  }, [sessionId]);

  // -------------------------------------------------------------------------
  // THE CENTRAL CLOCK.
  //
  // Polled from the server, and counted down locally only BETWEEN polls so the
  // display does not stutter. The server's answer always wins — if the two
  // disagree, the candidate sees the server's number, because that is the one
  // the save route will enforce.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!sessionId || state !== 'in_progress') return;

    let alive = true;
    const poll = async () => {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`/api/exam/session?sessionId=${sessionId}`, {
        headers: { authorization: `Bearer ${session.session?.access_token ?? ''}` },
      });
      const out = await res.json().catch(() => null);
      if (alive && out?.ok) {
        setRemaining(out.remainingMs);
        if (out.state !== state) setState(out.state);
      }
    };

    void poll();
    const server = setInterval(poll, 20_000);
    const local = setInterval(() => setRemaining((r) => (r === null ? null : Math.max(0, r - 1000))), 1000);
    return () => { alive = false; clearInterval(server); clearInterval(local); };
  }, [sessionId, state]);

  // -------------------------------------------------------------------------
  // LAYER 3 — the examination environment reports on itself.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (state !== 'in_progress') return;

    const onBlur = () => report('window_blurred');
    const onFocus = () => report('window_focused');
    const onFull = () => report(document.fullscreenElement ? 'fullscreen_entered' : 'fullscreen_exited');
    const onPaste = () => report('paste_detected');
    const onOffline = () => report('connection_lost');
    const onOnline = () => report('connection_restored');

    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('fullscreenchange', onFull);
    document.addEventListener('paste', onPaste);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('fullscreenchange', onFull);
      document.removeEventListener('paste', onPaste);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [state, report]);

  // Release the camera and microphone when this screen goes away. A page that
  // leaves a candidate's webcam running after their examination has ended is
  // not a proctoring system; it is surveillance.
  useEffect(() => () => {
    streams.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
  }, []);

  // -------------------------------------------------------------------------
  async function beginChecks(exam: Exam) {
    setBusy(true); setMessage(null);
    const out = await call('/api/exam/session', { examinationId: exam.id });
    setBusy(false);
    if (!out.ok) { setMessage({ tone: 'bad', text: out.detail ?? out.error }); return; }

    setChosen(exam);
    setSessionId(out.sessionId);
    setState('checks');
    setReadiness({ eligible: true, connectionOk: navigator.onLine });
    if (out.resumed) {
      setMessage({ tone: 'ok', text: 'You already had a sitting open for this paper. This is the same one.' });
    }
  }

  async function grantMedia(kind: 'camera' | 'microphone' | 'screen') {
    try {
      if (kind === 'screen') {
        const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
        streams.current.push(s);
        // THE CANDIDATE MAY STOP SHARING AT ANY TIME, and that is an alert
        // rather than something to prevent — the browser will not let a page
        // prevent it, and pretending otherwise would be a false promise.
        s.getVideoTracks()[0]?.addEventListener('ended', () => {
          setReadiness((r) => ({ ...r, screenShare: false }));
          report('screen_share_stopped');
        });
        setReadiness((r) => ({ ...r, screenShare: true }));
        report('screen_share_started');
        return;
      }

      const s = await navigator.mediaDevices.getUserMedia(
        kind === 'camera' ? { video: true } : { audio: true },
      );
      streams.current.push(s);
      if (kind === 'camera' && videoRef.current) {
        videoRef.current.srcObject = s;
        void videoRef.current.play().catch(() => undefined);
        setReadiness((r) => ({ ...r, camera: true }));
        report('camera_started');
      } else {
        setReadiness((r) => ({ ...r, microphone: true }));
        report('microphone_unmuted');
      }
    } catch {
      setMessage({
        tone: 'bad',
        text: kind === 'screen'
          ? 'Screen sharing was not granted. Choose “Entire screen” rather than a single window.'
          : `Your browser blocked the ${kind}. Click the icon in the address bar and choose Allow.`,
      });
      if (kind === 'camera') report('camera_blocked');
    }
  }

  async function move(action: SessionState, reason?: string) {
    if (!sessionId) return;
    setBusy(true); setMessage(null);
    const out = await call('/api/exam/session', { sessionId, action, reason });
    setBusy(false);
    if (!out.ok) { setMessage({ tone: 'bad', text: out.detail ?? out.error }); return; }
    setState(action);
    if (typeof out.remainingMs === 'number') setRemaining(out.remainingMs);
    setMessage({ tone: 'ok', text: out.message });

    if (action === 'in_progress' && chosen && MODE_PROFILES[chosen.mode].defaults.fullscreen) {
      document.documentElement.requestFullscreen?.().catch(() => undefined);
    }
  }

  /** Autosave. Debounced, and it always reports what happened. */
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function writeAnswer(n: number, text: string) {
    setAnswers((a) => ({ ...a, [n]: text }));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const out = await call('/api/exam/answer', {
        sessionId, questionNumber: n, answer: { text },
      });
      if (out.ok) {
        setSavedAt(out.savedAt);
        if (typeof out.remainingMs === 'number') setRemaining(out.remainingMs);
      } else {
        // NEVER SILENT. See the header.
        setMessage({ tone: 'bad', text: out.detail ?? 'That answer could not be saved.' });
      }
    }, 1200);
  }

  const requirements = useMemo(
    () => (chosen ? requirementsFor(chosen.mode, readiness) : []),
    [chosen, readiness],
  );
  const ready = chosen ? mayStart(chosen.mode, readiness) : false;

  // -------------------------------------------------------------------------
  if (!chosen) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <h1 className="font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">Examinations</h1>
          <p className="mt-1 text-sm text-[#6b6076] dark:text-[#9c93ad]">
            Papers open to you now. Give yourself ten minutes before the start for the checks.
          </p>
        </div>

        {message && <Banner tone={message.tone} text={message.text} />}

        {exams === null ? <Loader2 size={18} className="animate-spin text-[#9c93ad]" />
          : exams.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#ece7de] p-8 text-center text-sm text-[#6b6076] dark:border-[#2e2637] dark:text-[#9c93ad]">
              No examination is open to you at the moment.
            </p>
          ) : (
            <ul className="space-y-3">
              {exams.map((e) => (
                <li key={e.id} className="rounded-xl border border-[#ece7de] bg-white p-4 dark:border-[#2e2637] dark:bg-[#1f1a27]">
                  <p className="font-heading font-bold text-[#422e59] dark:text-[#e4dcf0]">{e.title}</p>
                  <p className="mt-0.5 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                    {e.courseCode ? `${e.courseCode} · ` : ''}{MODE_PROFILES[e.mode].label}
                    {e.durationMinutes ? ` · ${e.durationMinutes} minutes` : ''}
                    {` · ${e.totalMarks} marks`}
                  </p>
                  {e.closesAt && (
                    <p className="mt-0.5 text-xs text-[#9c93ad]">
                      Closes {new Date(e.closesAt).toLocaleString('en-GB')}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void beginChecks(e)}
                    disabled={busy}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#422e59] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-[#c5a55a] dark:text-[#241a30]"
                  >
                    {busy && <Loader2 size={14} className="animate-spin" />}
                    Begin the checks
                  </button>
                </li>
              ))}
            </ul>
          )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // THE CHECKS
  // -------------------------------------------------------------------------
  if (state === 'checks' || state === 'ready') {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <h1 className="font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">
            Before you start — {chosen.title}
          </h1>
          <p className="mt-1 text-sm text-[#6b6076] dark:text-[#9c93ad]">
            {MODE_PROFILES[chosen.mode].note}
          </p>
        </div>

        {message && <Banner tone={message.tone} text={message.text} />}

        <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
          <ul className="space-y-2">
            {requirements.map((r) => (
              <li
                key={r.key}
                className="flex items-start gap-3 rounded-xl border border-[#ece7de] bg-white p-3 dark:border-[#2e2637] dark:bg-[#1f1a27]"
              >
                {r.met
                  ? <CheckCircle2 size={17} className="mt-0.5 flex-shrink-0 text-emerald-600" />
                  : <XCircle size={17} className="mt-0.5 flex-shrink-0 text-[#a07c12]" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[#422e59] dark:text-[#e4dcf0]">{r.label}</p>
                  {/* WHAT TO DO, not what is wrong. See the header. */}
                  {!r.met && r.remedy && (
                    <p className="mt-0.5 text-xs text-[#6b6076] dark:text-[#9c93ad]">{r.remedy}</p>
                  )}
                </div>
                {!r.met && r.key === 'camera' && <Grant icon={<Camera size={13} />} onClick={() => void grantMedia('camera')} />}
                {!r.met && r.key === 'microphone' && <Grant icon={<Mic size={13} />} onClick={() => void grantMedia('microphone')} />}
                {!r.met && r.key === 'screenShare' && <Grant icon={<MonitorUp size={13} />} onClick={() => void grantMedia('screen')} />}
                {!r.met && r.key === 'identityVerified' && (
                  <Grant icon={<ShieldCheck size={13} />} onClick={() => setReadiness((x) => ({ ...x, identityVerified: true }))} label="Confirm" />
                )}
                {!r.met && r.key === 'connectionOk' && (
                  <Grant icon={<Wifi size={13} />} onClick={() => setReadiness((x) => ({ ...x, connectionOk: navigator.onLine }))} label="Recheck" />
                )}
              </li>
            ))}
          </ul>

          <div>
            {/* The candidate sees themselves. Not decoration: it is how they
                know the camera is pointing at them before an examiner tells
                them it is not. */}
            <video
              ref={videoRef}
              muted
              playsInline
              className="aspect-[4/3] w-full rounded-xl bg-[#241f2c] object-cover"
            />
            <p className="mt-1 text-xs text-[#9c93ad]">This is what the examiner will see.</p>
          </div>
        </div>

        <label className="flex items-start gap-2 rounded-xl border border-[#ece7de] bg-[#faf8f4] p-4 text-sm dark:border-[#2e2637] dark:bg-[#241f2c]">
          <input
            type="checkbox"
            className="mt-1"
            checked={Boolean(readiness.consented)}
            onChange={(e) => setReadiness((r) => ({ ...r, consented: e.target.checked }))}
          />
          <span className="text-[#6b6076] dark:text-[#9c93ad]">
            I understand that this examination is supervised: my camera, microphone and screen may
            be watched and recorded, and events such as leaving the examination window are
            recorded. I understand these records are <strong>observations, not accusations</strong>,
            and that any question of misconduct is decided by a person, not by the system.
          </span>
        </label>

        <button
          type="button"
          onClick={() => void move('in_progress')}
          disabled={!ready || busy}
          className="inline-flex items-center gap-2 rounded-lg bg-[#422e59] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40 dark:bg-[#c5a55a] dark:text-[#241a30]"
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          Start the examination
        </button>
        {!ready && (
          <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
            Everything above has to pass first. Nothing here is recorded against you — these checks
            are so that your sitting is not interrupted.
          </p>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // THE PAPER
  // -------------------------------------------------------------------------
  const minutes = remaining === null ? null : Math.floor(remaining / 60000);
  const low = minutes !== null && minutes <= 5;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header className="sticky top-16 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ece7de] bg-white/95 p-3 backdrop-blur dark:border-[#2e2637] dark:bg-[#1f1a27]/95">
        <div>
          <p className="font-heading font-bold text-[#422e59] dark:text-[#e4dcf0]">{chosen.title}</p>
          <p className="text-xs text-[#9c93ad]">
            {savedAt
              ? `Saved at ${new Date(savedAt).toLocaleTimeString('en-GB')}`
              : 'Your work saves automatically as you type.'}
          </p>
        </div>
        {remaining !== null && (
          // AMBER AT FIVE MINUTES, NOT AT THIRTY. A countdown that alarms early
          // teaches candidates to ignore it.
          <p className={`flex items-center gap-2 font-heading text-lg tabular-nums ${
            low ? 'font-bold text-[#a07c12]' : 'text-[#422e59] dark:text-[#e4dcf0]'
          }`}>
            <Clock size={16} />
            {String(Math.floor(remaining / 3600000)).padStart(2, '0')}
            :{String(Math.floor(remaining / 60000) % 60).padStart(2, '0')}
            :{String(Math.floor(remaining / 1000) % 60).padStart(2, '0')}
          </p>
        )}
      </header>

      {message && <Banner tone={message.tone} text={message.text} />}

      {state === 'paused' && (
        <div className="rounded-xl border border-[#e9c14a]/40 bg-[#e9c14a]/10 p-4 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          <strong className="font-semibold text-[#8a6a10]">The examiner has paused your examination.</strong>{' '}
          The clock has stopped and you will not lose this time. Your answers are saved. Wait here.
        </div>
      )}

      {state === 'submitted' ? (
        <div className="rounded-xl border border-emerald-600/30 bg-emerald-600/10 p-6 text-center">
          <CheckCircle2 size={28} className="mx-auto text-emerald-600" />
          <p className="mt-2 font-heading font-bold text-[#422e59] dark:text-[#e4dcf0]">Submitted</p>
          <p className="mt-1 text-sm text-[#6b6076] dark:text-[#9c93ad]">
            Your answers are on the University&apos;s register. You may close this window.
          </p>
        </div>
      ) : (
        <>
          {/* Questions are delivered per paper; until a question set is
              attached, the candidate gets a single answer field rather than an
              empty screen. */}
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded-xl border border-[#ece7de] bg-white p-4 dark:border-[#2e2637] dark:bg-[#1f1a27]">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#9c93ad]">Question {n}</p>
              <textarea
                value={answers[n] ?? ''}
                onChange={(e) => writeAnswer(n, e.target.value)}
                disabled={state !== 'in_progress'}
                rows={6}
                placeholder="Your answer"
                className="mt-2 w-full rounded-lg border border-[#ded6c8] bg-white p-3 text-sm text-[#33234a] disabled:opacity-60 dark:border-[#3d3349] dark:bg-[#241f2c] dark:text-[#e4dcf0]"
              />
              <p className="mt-1 flex items-center gap-1.5 text-xs text-[#9c93ad]">
                <Save size={11} /> Saves automatically
              </p>
            </div>
          ))}

          <button
            type="button"
            onClick={() => void move('submitted')}
            disabled={busy || state !== 'in_progress'}
            className="inline-flex items-center gap-2 rounded-lg bg-[#422e59] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40 dark:bg-[#c5a55a] dark:text-[#241a30]"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Submit the examination
          </button>
          <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
            Once submitted, a paper cannot be reopened.
          </p>
        </>
      )}
    </div>
  );
}

function Grant({ icon, onClick, label = 'Allow' }: { icon: React.ReactNode; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-[#ded6c8] px-2.5 py-1.5 text-xs font-semibold text-[#422e59] dark:border-[#3d3349] dark:text-[#e4dcf0]"
    >
      {icon}{label}
    </button>
  );
}

function Banner({ tone, text }: { tone: 'ok' | 'bad'; text: string }) {
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-xl p-4 text-sm ${
        tone === 'ok'
          ? 'border border-emerald-600/30 bg-emerald-600/10 text-emerald-900 dark:text-emerald-200'
          : 'border border-red-600/30 bg-red-600/10 text-red-900 dark:text-red-200'
      }`}
    >
      {tone === 'ok' ? <CheckCircle2 size={17} className="mt-0.5 flex-shrink-0" />
        : <AlertTriangle size={17} className="mt-0.5 flex-shrink-0" />}
      <span>{text}</span>
    </div>
  );
}
