'use client';

// ---------------------------------------------------------------------------
// THE REGISTRY'S SIDE OF A STUDENT'S REQUEST.
//
// ---------------------------------------------------------------------------
// WHY A QUEUE AND NOT A NOTIFICATION
// ---------------------------------------------------------------------------
//
// A request that arrives as an email to whoever happens to read it is a request
// that is answered when somebody remembers. A queue has a length, and a length
// is a thing an office can be asked about: how many are outstanding, how old is
// the oldest, which were refused and why.
//
// ---------------------------------------------------------------------------
// AND WHY REFUSING NEEDS A REASON
// ---------------------------------------------------------------------------
//
// Migration 019 refuses to store a refusal without one, so this screen cannot
// send a bare no even if it wanted to. A student told no by a system with
// nobody to ask has no way forward; a student told "your fee balance is
// outstanding" knows exactly what to do.
// ---------------------------------------------------------------------------

import React from 'react';
import { Loader2, Check, AlertTriangle, Inbox } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { TRANSCRIPT_PROFILES, type TranscriptKind } from '@/lib/transcriptTypes';
import { INPUT, LABEL, FOCUS, CARD, BTN_SECONDARY } from '@/lib/portalTheme';

interface Row {
  id: string;
  student_id: string;
  kind: string;
  delivery: string;
  status: string;
  requested_at: string;
  note: string | null;
  students: { first_name: string; last_name: string; matric_no: string; student_number: string | null } | null;
}

const MIN_REASON = 8;

export default function TranscriptRequestQueue({
  onChoose,
}: {
  /** Hands the student to the Issue screen, so the queue is a route to the work. */
  onChoose?: (studentId: string) => void;
}) {
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [refusing, setRefusing] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState('');
  const [note, setNote] = React.useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const load = React.useCallback(async () => {
    const { data, error } = await supabase
      .from('transcript_requests')
      .select('id, student_id, kind, delivery, status, requested_at, note, '
        + 'students(first_name, last_name, matric_no, student_number)')
      .in('status', ['requested', 'in-progress'])
      .order('requested_at', { ascending: true });
    if (error) {
      setRows([]);
      setNote({ tone: 'bad', text: `The queue could not be read: ${error.message}` });
      return;
    }
    setRows((data ?? []) as unknown as Row[]);
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function decide(id: string, status: 'in-progress' | 'refused' | 'cancelled', why?: string) {
    setBusy(id);
    setNote(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const { error } = await supabase
        .from('transcript_requests')
        .update({
          status,
          note: why ?? null,
          decided_at: new Date().toISOString(),
          decided_by: session.session?.user?.id ?? null,
        })
        .eq('id', id);
      if (error) { setNote({ tone: 'bad', text: error.message }); return; }
      setRefusing(null);
      setReason('');
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (rows === null) {
    return (
      <div className={`${CARD} p-5`}>
        <p className="flex items-center gap-2 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          <Loader2 size={14} className="animate-spin" /> Reading the queue…
        </p>
      </div>
    );
  }

  return (
    <div className={`${CARD} p-5`}>
      <h3 className="flex items-center gap-2 font-heading text-base font-bold text-[#422e59] dark:text-[#e4dcf0]">
        <Inbox size={17} /> Transcript requests
        {rows.length > 0 && (
          <span className="rounded-full bg-[#422e59] px-2 py-0.5 text-[11px] font-semibold text-white">
            {rows.length}
          </span>
        )}
      </h3>

      {note && (
        <p role="status" className={`mt-3 flex items-start gap-2 rounded-lg p-3 text-xs ${
          note.tone === 'ok'
            ? 'border border-emerald-600/30 bg-emerald-600/10 text-emerald-900 dark:text-emerald-200'
            : 'border border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200'
        }`}>
          {note.tone === 'ok' ? <Check size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
          {note.text}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-[#8a8194]">
          Nothing outstanding. Students request a transcript from their own portal, and it appears
          here.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-[#ece7de] dark:divide-[#2e2637]">
          {rows.map((r) => {
            const s = r.students;
            const waited = Math.floor(
              (Date.now() - new Date(r.requested_at).getTime()) / 86_400_000,
            );
            return (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <strong className="text-[#33234a] dark:text-[#e4dcf0]">
                    {s ? `${s.last_name} ${s.first_name}` : 'Student record unavailable'}
                  </strong>
                  <span className="font-mono text-xs text-[#6b6076] dark:text-[#9c93ad]">
                    {s?.student_number ?? s?.matric_no ?? '—'}
                  </span>
                  <span className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
                    {TRANSCRIPT_PROFILES[r.kind as TranscriptKind]?.label ?? r.kind} · {r.delivery}
                  </span>
                  {/* HOW LONG THEY HAVE WAITED, because that is the number an
                      office is actually accountable for. */}
                  <span className={`text-xs ${waited >= 7 ? 'font-semibold text-red-800 dark:text-red-300' : 'text-[#8a8194]'}`}>
                    {waited === 0 ? 'today' : `${waited} day${waited === 1 ? '' : 's'} waiting`}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {onChoose && (
                    <button
                      onClick={() => onChoose(r.student_id)}
                      className={`${BTN_SECONDARY} text-[11px]`}
                    >
                      Open this student
                    </button>
                  )}
                  {r.status === 'requested' && (
                    <button
                      onClick={() => void decide(r.id, 'in-progress')}
                      disabled={busy === r.id}
                      className={`${BTN_SECONDARY} text-[11px]`}
                    >
                      {busy === r.id ? 'Working…' : 'Take it on'}
                    </button>
                  )}
                  <button
                    onClick={() => { setRefusing(refusing === r.id ? null : r.id); setReason(''); }}
                    className={`${BTN_SECONDARY} text-[11px]`}
                  >
                    Refuse
                  </button>
                </div>

                {refusing === r.id && (
                  <div className="mt-2">
                    <label className="block">
                      <span className={LABEL}>Why it is refused — the student is shown this</span>
                      <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. an outstanding fee balance is held against the record"
                        className={`${INPUT} mt-1`}
                      />
                    </label>
                    <button
                      onClick={() => void decide(r.id, 'refused', reason.trim())}
                      disabled={reason.trim().length < MIN_REASON || busy === r.id}
                      className={`mt-2 inline-flex items-center gap-2 rounded-lg bg-[#422e59] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40 ${FOCUS}`}
                    >
                      Record the refusal
                    </button>
                    {reason.trim().length < MIN_REASON && (
                      <p className="mt-1 text-[11px] text-[#8a8194]">
                        Give a reason. The register refuses a refusal without one, because a
                        student told no with no explanation has no way forward.
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
