'use client';

// ---------------------------------------------------------------------------
// Result approval — the queue that was missing.
//
// WHAT WAS HERE BEFORE. Nothing. The Office and Admin dashboards counted marks
// with status 'draft' and labelled the number "pending approval", which pointed
// at a queue that did not exist. Every mark ever entered was a draft, every
// semester average was therefore provisional, and /api/credential/issue refuses
// to issue against a provisional average — so no certificate could be issued to
// anybody, and the reason was a screen nobody had built.
//
// WHOSE SCREEN THIS IS. All four offices in the chain, showing each of them
// only what is theirs to act on. A lecturer sees their drafts and what they
// have submitted; a Head of Department sees what is awaiting moderation; a Dean
// what is awaiting the faculty; the Registrar what is awaiting publication.
// Everyone can see the whole board, because an approval chain in which you
// cannot see where a class is stuck produces a phone call rather than an
// approval.
//
// WHY THE BUTTON IS SOMETIMES ABSENT rather than present and refused. Because
// the person cannot do anything about it. A greyed-out "Moderate" on a Dean's
// screen invites them to ask why it is greyed out; showing them the class with
// "Awaiting the Head of Department" tells them who to chase.
//
// The button being hidden is courtesy, not security. /api/results/advance
// checks the capability, the step and who has already signed — and migration
// 009 checks the last of those again in the database, where nothing holding the
// service-role key can route around it.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { can, type Capability } from '@/lib/roles';
import type { UserRole } from '@/lib/types';
import {
  STAGES, STATUS_LABEL, nextStage, stageIndex, type ResultStatus,
} from '@/lib/resultsWorkflow';
import {
  Loader2, CheckCircle2, AlertTriangle, Undo2, ClipboardCheck, ChevronRight, Info,
} from 'lucide-react';

interface ClassRow {
  courseId: string;
  code: string;
  title: string;
  status: ResultStatus;
  marks: number;
  returnedReason: string | null;
}

export default function ResultsApproval({ role }: { role?: UserRole }) {
  const [rows, setRows] = useState<ClassRow[] | null>(null);
  const [notReady, setNotReady] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [returning, setReturning] = useState<ClassRow | null>(null);
  const [reason, setReason] = useState('');

  const holds = useCallback(
    (c: Capability) => can(role, c),
    [role],
  );

  const load = useCallback(async () => {
    // Grouped in the browser rather than by the database, because Supabase's
    // REST interface has no GROUP BY and the alternative is a view — a
    // migration to display a list. A university's course list is hundreds of
    // rows, not millions.
    const { data, error } = await supabase
      .from('results')
      .select('course_id, status, returned_reason, courses(code, title)');

    if (error) {
      // The most likely cause by far, said plainly. Before migration 009 there
      // was no staff read policy on `results` at all, so this screen would show
      // an empty board and look like "nothing to approve" rather than "you
      // cannot see anything".
      setNotReady(
        error.message.includes('permission') || error.message.includes('policy')
          ? 'Marks cannot be read. Run docs/migrations/009_results_approval.sql — before it, only a student could read their own results and staff could read none.'
          : error.message,
      );
      setRows([]);
      return;
    }

    const byCourse = new Map<string, ClassRow>();
    for (const r of (data ?? []) as unknown as Array<Record<string, any>>) {
      const c = r.courses as { code?: string; title?: string } | null;
      const key = String(r.course_id);
      const existing = byCourse.get(key);
      if (existing) {
        existing.marks += 1;
        // A class showing more than one status is a fault the API refuses to
        // act on; showing the EARLIEST here means it appears in the queue of
        // the office that has to sort it out rather than the one after.
        if (stageIndex(r.status as ResultStatus) < stageIndex(existing.status)) {
          existing.status = r.status as ResultStatus;
        }
        if (r.returned_reason) existing.returnedReason = r.returned_reason;
      } else {
        byCourse.set(key, {
          courseId: key,
          code: c?.code ?? '—',
          title: c?.title ?? 'Untitled course',
          status: r.status as ResultStatus,
          marks: 1,
          returnedReason: r.returned_reason ?? null,
        });
      }
    }

    setRows(Array.from(byCourse.values()).sort(
      (a, b) => stageIndex(b.status) - stageIndex(a.status) || a.code.localeCompare(b.code),
    ));
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function act(row: ClassRow, action: 'advance' | 'return', why = '') {
    setBusy(row.courseId);
    setMessage(null);
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch('/api/results/advance', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ courseId: row.courseId, action, reason: why }),
    });
    const out = await res.json();
    setBusy(null);
    setReturning(null);
    setReason('');

    if (!out.ok) {
      setMessage({
        tone: 'bad',
        text: (out.detail ?? out.error ?? 'The change was not saved.')
          + (out.awaiting ? ` Waiting on: ${out.awaiting.step}.` : ''),
      });
      return;
    }

    if (action === 'return') {
      setMessage({
        tone: 'ok',
        text: `${row.code} sent back to the lecturer. The chain restarts from the beginning, and this is on the record.`,
      });
    } else {
      const g = out.gpa;
      setMessage({
        tone: 'ok',
        text: `${row.code}: ${out.marks} mark${out.marks === 1 ? '' : 's'} → ${STATUS_LABEL[out.to as ResultStatus]}.`
          + (out.awaiting ? ` Now with the ${out.awaiting.step}.` : '')
          + (g ? ` ${g.students} student record${g.students === 1 ? '' : 's'} recomputed; `
              + `${g.approvedTerms} term average${g.approvedTerms === 1 ? '' : 's'} now rest on approved marks.` : '')
          + (g && !g.ok ? ` ${g.detail}` : ''),
      });
    }
    await load();
  }

  const grouped = useMemo(() => {
    const board: { status: ResultStatus; label: string; owner: string | null; list: ClassRow[] }[] =
      (['draft', ...STAGES.map((s) => s.to)] as ResultStatus[]).map((status) => ({
        status,
        label: STATUS_LABEL[status],
        owner: nextStage(status)?.actor ?? null,
        list: (rows ?? []).filter((r) => r.status === status),
      }));
    return board;
  }, [rows]);

  if (rows === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-[#6b6076]">
        <Loader2 className="animate-spin" size={15} /> Loading…
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 font-heading text-xl font-bold text-[#422e59] dark:text-[#e4dcf0]">
          <ClipboardCheck size={19} /> Result approval
        </h2>
        <p className="mt-1 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          A mark becomes part of the academic record only after four offices have seen it. Nothing
          here can be skipped, and no one person may sign the same class twice.
        </p>
      </div>

      {/* The chain, stated once, so nobody has to infer it from the buttons. */}
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 rounded-xl border border-[#ece7de] bg-[#faf7f0] p-4 dark:border-[#2e2637] dark:bg-[#1f1a27]">
        {STAGES.map((s, i) => (
          <li key={s.to} className="flex items-center gap-1">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                holds(s.capability)
                  ? 'bg-[#422e59] text-white'
                  : 'bg-white text-[#6b6076] dark:bg-[#2a2333] dark:text-[#9c93ad]'
              }`}
              title={holds(s.capability) ? 'Your step' : `${s.actor} only`}
            >
              {i + 1}. {s.actor}
            </span>
            {i < STAGES.length - 1 && <ChevronRight size={14} className="text-[#b8afc4]" />}
          </li>
        ))}
      </ol>

      {notReady && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700/50 dark:bg-amber-900/15">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span className="text-[#6b6076] dark:text-[#9c93ad]">{notReady}</span>
        </div>
      )}

      {message && (
        <p className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
          message.tone === 'ok'
            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
            : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'
        }`}>
          {message.tone === 'ok'
            ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
          {message.text}
        </p>
      )}

      {grouped.map((group) => (
        <section key={group.status}>
          <h3 className="flex items-baseline gap-2 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a7d1f]">
            {group.label}
            <span className="font-normal normal-case tracking-normal text-[#9c93ad]">
              {group.list.length === 0
                ? 'nothing here'
                : `${group.list.length} class${group.list.length === 1 ? '' : 'es'}`}
              {group.owner && ` · ${group.owner}`}
            </span>
          </h3>

          {group.list.length > 0 && (
            <div className="mt-2 space-y-2">
              {group.list.map((row) => {
                const stage = nextStage(row.status);
                const mine = stage ? holds(stage.capability) : false;
                // Only the office the class is waiting on may refuse it. A
                // lecturer cannot recall their own class from the Dean — see
                // mayReturn() for why that is the rule and not an oversight.
                const canSendBack = row.status !== 'draft' && mine;

                return (
                  <div
                    key={row.courseId}
                    className="rounded-lg border border-[#ece7de] bg-white p-4 dark:border-[#2e2637] dark:bg-[#1f1a27]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-[#33234a] dark:text-[#e4dcf0]">
                          {row.code} — {row.title}
                        </p>
                        <p className="mt-0.5 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                          {row.marks} mark{row.marks === 1 ? '' : 's'}
                          {stage && ` · waiting on the ${stage.actor}`}
                        </p>
                        {row.returnedReason && (
                          <p className="mt-2 flex items-start gap-1.5 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:bg-amber-900/15 dark:text-amber-200">
                            <Undo2 size={13} className="mt-0.5 shrink-0" />
                            <span><strong>Sent back:</strong> {row.returnedReason}</span>
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        {mine && stage && (
                          <button
                            type="button"
                            onClick={() => act(row, 'advance')}
                            disabled={busy === row.courseId}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#422e59] px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40"
                          >
                            {busy === row.courseId && <Loader2 className="animate-spin" size={14} />}
                            {stage.verb}
                          </button>
                        )}
                        {canSendBack && (
                          <button
                            type="button"
                            onClick={() => { setReturning(row); setReason(''); }}
                            disabled={busy === row.courseId}
                            className="inline-flex items-center gap-2 rounded-lg border border-[#ded6c8] px-3.5 py-2 text-sm font-semibold text-[#6b6076] disabled:opacity-40 dark:border-[#3d3349]"
                          >
                            <Undo2 size={14} /> Send back
                          </button>
                        )}
                      </div>
                    </div>

                    {/* What the person is about to attest to, before they do it,
                        not in a manual they will not read. */}
                    {mine && stage && (
                      <p className="mt-3 flex items-start gap-1.5 border-t border-[#f2eee6] pt-3 text-xs leading-relaxed text-[#6b6076] dark:border-[#2a2333] dark:text-[#9c93ad]">
                        <Info size={13} className="mt-0.5 shrink-0" />
                        {stage.meaning}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ))}

      {/* Sending back. A reason is required — the API refuses without one, and
          it is right to: a class returned with no reason comes back unchanged. */}
      {returning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 dark:bg-[#1f1a27]">
            <h3 className="font-heading text-lg font-bold text-[#422e59] dark:text-[#e4dcf0]">
              Send {returning.code} back to the lecturer
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
              The chain restarts from the beginning — every approval already given on this class is
              withdrawn, because the next one would otherwise rest on a moderation of different
              numbers. What happened stays on the record.
            </p>
            <label className="mt-4 block">
              <span className="text-sm font-medium text-[#4a4155] dark:text-[#c8c1d4]">
                What needs to change?
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                autoFocus
                placeholder="e.g. Four students have no examination mark recorded."
                className="mt-1.5 w-full rounded-lg border border-[#ded6c8] bg-gray-50 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#422e59]/35 dark:border-[#3d3349] dark:bg-[#171320]"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setReturning(null); setReason(''); }}
                className="rounded-lg px-4 py-2 text-sm text-[#6b6076]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reason.trim() || busy === returning.courseId}
                onClick={() => act(returning, 'return', reason)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#8a2f2f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy === returning.courseId && <Loader2 className="animate-spin" size={14} />}
                Send back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
