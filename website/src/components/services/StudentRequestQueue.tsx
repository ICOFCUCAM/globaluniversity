'use client';

// ---------------------------------------------------------------------------
// THE OFFICE'S SIDE OF WHAT A STUDENT ASKED FOR.
//
// ---------------------------------------------------------------------------
// THE GAP THIS CLOSES
// ---------------------------------------------------------------------------
//
// 073 built the request and the student's half of it. A student can raise one,
// see its state, and withdraw it. The table refuses a decline with no reason
// and refuses a completion that was never decided.
//
// And nothing could work the queue. No screen, no route, no way off
// 'submitted'. A student could ask the University for academic leave, watch
// their screen say Submitted, and wait for ever — which is worse than the
// emailing it was built to replace, because an email at least lands in
// somebody's inbox.
//
// ---------------------------------------------------------------------------
// OPEN FIRST, OLDEST FIRST
// ---------------------------------------------------------------------------
//
// Not newest first. The oldest unanswered request is the one somebody has been
// waiting on longest, and a queue sorted the other way buries it under today's
// arrivals — which is how a request comes to sit for a month in a system that
// was supposed to stop exactly that.
//
// The days-waiting count is printed beside each one for the same reason.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Card, EmptyState, PageHeader, SkeletonRows,
} from '@/components/ui/portal';
import { authedPost } from '@/lib/authedFetch';
import { within } from '@/lib/studentReads';
import { FOCUS } from '@/lib/portalTheme';
import {
  AlertTriangle, BadgeCheck, CheckCircle2, Clock, Inbox, Send, XCircle,
} from 'lucide-react';

// eslint-disable-next-line max-len
const COLUMNS = 'id, student_id, kind, subject, detail, status, with_office, decision_note, submitted_at, decided_at, completed_at, students(matric_no, student_number, first_name, last_name)';

interface Row {
  id: string;
  student_id: string;
  kind: string;
  subject: string;
  detail: string;
  status: string;
  with_office: string | null;
  decision_note: string | null;
  submitted_at: string;
  decided_at: string | null;
  completed_at: string | null;
  students?: {
    matric_no?: string | null; student_number?: string | null;
    first_name?: string | null; last_name?: string | null;
  } | null;
}

const OFFICES = ['The Registry', 'The Academic Office', 'The Finance Office',
  'Student Affairs', 'The Library'];

/** How long somebody has been waiting, which is the number that should sting. */
export function daysWaiting(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

export function isOpen(status: string): boolean {
  return status === 'submitted' || status === 'under-review';
}

/** Open first, and within that the one waiting longest. */
export function inOrder(rows: Row[]): Row[] {
  return [...rows].sort((a, b) => (isOpen(b.status) ? 1 : 0) - (isOpen(a.status) ? 1 : 0)
    || (isOpen(a.status)
      ? a.submitted_at.localeCompare(b.submitted_at)
      : (b.decided_at ?? b.submitted_at).localeCompare(a.decided_at ?? a.submitted_at)));
}

export default function StudentRequestQueue() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [note, setNote] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const { data, error } = await within(
        supabase.from('student_requests').select(COLUMNS).order('submitted_at'),
      );
      if (error) { setFailed(error.message); setLoading(false); return; }
      setRows((data ?? []) as unknown as Row[]);
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'The queue could not be read.');
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = useCallback(async (payload: Record<string, unknown>, id: string) => {
    setBusy(id); setSaid(null);
    const r = await authedPost('/api/student-services', payload);
    setBusy(null);
    if (!r.ok) {
      setSaid({ ok: false, text: String(r.detail ?? r.error ?? 'That did not work.') });
      return;
    }
    setSaid({ ok: true, text: String(r.detail ?? 'Done.') });
    setNote((n) => ({ ...n, [id]: '' }));
    await load();
  }, [load]);

  const ordered = useMemo(() => inOrder(rows), [rows]);
  const open = ordered.filter((r) => isOpen(r.status));
  const closed = ordered.filter((r) => !isOpen(r.status));
  const oldest = open.length > 0 ? daysWaiting(open[0].submitted_at) : 0;

  if (failed) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle size={20} />}
          title="The queue could not be read"
          description={`${failed}. If migration 073 has not been run on this database, the table `
            + 'this screen reads does not exist yet.'}
        />
      </Card>
    );
  }

  if (loading) return <Card className="overflow-hidden"><SkeletonRows rows={5} cols={4} /></Card>;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Student services"
        subtitle={rows.length === 0
          ? 'What students have asked the University for'
          : `${open.length} open · ${closed.length} closed`
            + (oldest > 0 ? ` · the oldest has waited ${oldest} day${oldest === 1 ? '' : 's'}` : '')}
        action={closed.length > 0 ? (
          <button
            onClick={() => setShowClosed((v) => !v)}
            className={`rounded-lg border border-[#ded6c8] px-3 py-1.5 text-xs font-medium
                        text-[#422e59] transition hover:bg-[#f5f1ea] dark:border-[#3d3349]
                        dark:text-[#c8b6e8] dark:hover:bg-[#2a2333] ${FOCUS}`}
          >
            {showClosed ? 'Hide closed' : `Show closed (${closed.length})`}
          </button>
        ) : undefined}
      />

      {said && (
        <Card className={`flex items-start gap-3 p-4 ${
          said.ok ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
            : 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
        }`}>
          {said.ok
            ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300" />
            : <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-700 dark:text-red-300" />}
          <p className={`text-xs leading-relaxed ${
            said.ok ? 'text-emerald-800 dark:text-emerald-200' : 'text-red-800 dark:text-red-200'
          }`}>
            {said.text}
          </p>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox size={20} />}
            title="Nothing has been asked"
            description={'No student has raised a request. When one does it appears here, oldest '
              + 'first, and the student can see on their own screen that somebody has it.'}
          />
        </Card>
      ) : (
        <>
          {open.length === 0 && (
            <Card>
              <EmptyState
                icon={<BadgeCheck size={20} />}
                title="Nothing is waiting"
                description="Every request has been answered."
              />
            </Card>
          )}

          {open.map((r) => (
            <RequestCard
              key={r.id} r={r} busy={busy === r.id}
              note={note[r.id] ?? ''}
              onNote={(t) => setNote((n) => ({ ...n, [r.id]: t }))}
              act={act}
            />
          ))}

          {showClosed && closed.map((r) => (
            <RequestCard
              key={r.id} r={r} busy={busy === r.id}
              note={note[r.id] ?? ''}
              onNote={(t) => setNote((n) => ({ ...n, [r.id]: t }))}
              act={act}
            />
          ))}
        </>
      )}
    </div>
  );
}

function RequestCard({
  r, busy, note, onNote, act,
}: {
  r: Row; busy: boolean; note: string;
  onNote: (t: string) => void;
  act: (payload: Record<string, unknown>, id: string) => void;
}) {
  const waiting = daysWaiting(r.submitted_at);
  const student = [r.students?.first_name, r.students?.last_name].filter(Boolean).join(' ')
    || 'A student';
  const number = r.students?.student_number ?? r.students?.matric_no ?? null;

  // THE SAME MINIMUM THE TABLE ENFORCES, so the refusal happens here with an
  // explanation rather than there with a constraint name.
  const canDecline = note.trim().length >= 10;

  return (
    <Card className={`p-5 ${
      isOpen(r.status) && waiting >= 7 ? 'border-[#c5a55a]' : ''
    }`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-bold text-[#422e59] dark:text-[#c8b6e8]">
            {r.subject}
          </h2>
          <p className="mt-0.5 text-[11px] text-[#a49bb0]">
            {student}{number ? ` · ${number}` : ''} · {r.kind.replace(/-/g, ' ')}
            {r.with_office ? ` · with ${r.with_office}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
            r.status === 'completed' || r.status === 'approved'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
              : r.status === 'declined' || r.status === 'withdrawn'
                ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
          }`}>
            {r.status.replace('-', ' ')}
          </span>
          {isOpen(r.status) && (
            // THE NUMBER THAT SHOULD STING. A queue that does not say how long
            // somebody has been waiting is one where nobody notices.
            <p className={`mt-1 text-[11px] ${
              waiting >= 7 ? 'font-semibold text-[#a07c12]' : 'text-[#a49bb0]'
            }`}>
              waiting {waiting} day{waiting === 1 ? '' : 's'}
            </p>
          )}
        </div>
      </div>

      <p className="mt-3 whitespace-pre-line rounded-lg bg-[#faf8f4] p-3 text-xs leading-relaxed
                    text-[#33234a] dark:bg-[#241f2c] dark:text-[#e4dcf0]">
        {r.detail}
      </p>

      {r.decision_note && !isOpen(r.status) && (
        <p className="mt-2 text-xs text-[#6b6076] dark:text-[#9c93ad]">
          <strong>Answer given:</strong> {r.decision_note}
        </p>
      )}

      {isOpen(r.status) && (
        <div className="mt-4 space-y-3">
          <textarea
            value={note}
            onChange={(e) => onNote(e.target.value)}
            rows={2}
            aria-label={`Answer to ${r.subject}`}
            placeholder="What you are telling the student. Required to decline."
            className="w-full rounded-lg border border-[#ded6c8] bg-white px-3 py-2 text-sm
                       text-[#33234a] dark:border-[#3d3349] dark:bg-[#241f2c] dark:text-[#e4dcf0]"
          />
          <div className="flex flex-wrap items-center gap-2">
            {r.status === 'submitted' && (
              <button
                onClick={() => act({ action: 'take', requestId: r.id }, r.id)}
                disabled={busy}
                className={`rounded-lg border border-[#ded6c8] px-3 py-1.5 text-xs font-medium
                            text-[#422e59] transition hover:bg-[#f5f1ea] disabled:opacity-50
                            dark:border-[#3d3349] dark:text-[#c8b6e8] ${FOCUS}`}
              >
                <Clock size={13} className="mr-1 inline" /> Take it up
              </button>
            )}
            <button
              onClick={() => act({ action: 'approve', requestId: r.id, note }, r.id)}
              disabled={busy}
              className={`flex items-center gap-1.5 rounded-lg bg-[#422e59] px-3 py-1.5 text-xs
                          font-semibold text-white transition hover:bg-[#33234a]
                          disabled:opacity-50 ${FOCUS}`}
            >
              <CheckCircle2 size={13} /> Approve
            </button>
            <button
              onClick={() => act({ action: 'decline', requestId: r.id, note }, r.id)}
              disabled={busy || !canDecline}
              title={canDecline ? undefined
                : 'Say why. A student told only "declined" has nothing they can act on.'}
              className={`flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5
                          text-xs font-medium text-red-700 transition hover:bg-red-50
                          disabled:opacity-40 dark:border-red-900 dark:text-red-300 ${FOCUS}`}
            >
              <XCircle size={13} /> Decline
            </button>
            <select
              onChange={(e) => {
                if (e.target.value) act({ action: 'route', requestId: r.id, office: e.target.value }, r.id);
              }}
              value=""
              aria-label="Hand to another office"
              className="rounded-lg border border-[#ded6c8] bg-white px-2 py-1.5 text-xs
                         text-[#6b6076] dark:border-[#3d3349] dark:bg-[#241f2c] dark:text-[#9c93ad]"
            >
              <option value="">Hand to…</option>
              {OFFICES.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          {!canDecline && note.length > 0 && (
            <p className="text-[11px] text-[#a07c12]">
              A decline needs at least ten characters of explanation. {note.trim().length}/10
            </p>
          )}
        </div>
      )}

      {/* ---- APPROVED IS NOT FINISHED ---- */}
      {r.status === 'approved' && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => act({ action: 'complete', requestId: r.id, note }, r.id)}
            disabled={busy}
            className={`flex items-center gap-1.5 rounded-lg bg-[#422e59] px-3 py-1.5 text-xs
                        font-semibold text-white transition hover:bg-[#33234a]
                        disabled:opacity-50 ${FOCUS}`}
          >
            <Send size={13} /> Mark completed
          </button>
          <p className="text-[11px] text-[#a49bb0]">
            {/* THE GAP BETWEEN DECIDING AND DOING, said where somebody might
                otherwise close the card and move on. */}
            Approved is not done. The student is holding an approval and no change to their
            record until somebody has actually done the thing.
          </p>
        </div>
      )}
    </Card>
  );
}
