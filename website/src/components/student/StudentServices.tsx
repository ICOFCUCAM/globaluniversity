'use client';

// ---------------------------------------------------------------------------
// STUDENT SERVICES — asking the University for something, and being able to
// see where it has got to.
//
// ---------------------------------------------------------------------------
// WHAT THE UNIVERSITY ASKED FOR
// ---------------------------------------------------------------------------
//
// "Request transcript · Request enrolment confirmation · Request student ID ·
// Change contact information · Request academic leave · Request deferment ·
// Request programme change · Request course withdrawal · Submit academic
// appeal · Contact Registrar · Contact Finance · Contact Academic Office.
// Every request should have Submitted → Under Review → Approved / Declined →
// Completed rather than students emailing the university for everything."
//
// ---------------------------------------------------------------------------
// THE TRANSCRIPT REQUEST IS THE ONE THAT IS NOT NEW, AND IT IS NOT REBUILT
// ---------------------------------------------------------------------------
//
// The University's warning — "check the system to avoid duplicate as many must
// be in the system and need to be connected" — lands squarely on the first
// item in that list. `transcript_requests` has existed for months, a student
// can already raise one from My credentials, and the Registry has a queue
// behind it that somebody works.
//
// So this screen does NOT offer a transcript form. It reads 074's
// `my_requests`, which unions all three pipelines — student_requests,
// transcript_requests and credential_correction_requests — into one list with
// one vocabulary of statuses, and it sends a student to the screen that
// already raises a transcript request rather than raising a second one here.
//
// If it did offer one, a transcript request would exist in two tables with two
// statuses and the Registry's queue would show one of them.
//
// ---------------------------------------------------------------------------
// THE WRITE GOES STRAIGHT TO THE DATABASE, NOT THROUGH A ROUTE
// ---------------------------------------------------------------------------
//
// Every other write in this portal goes through an API route holding the
// service key, because every other write is somebody acting on somebody else's
// record. This one is a student writing their own row, and 073's row-level
// policies already say exactly what that means: they may insert a request for
// themselves, at status 'submitted', with no decision on it; and afterwards
// the only change they may make is to withdraw it.
//
// Putting a route in front of that would ADD a way to get it wrong — a route
// holding the service key bypasses those policies, so the rule would then live
// in TypeScript instead of in the database. The policies are the stronger
// place for it.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, EmptyState } from '@/components/ui/portal';
import StudentScreen from './StudentScreen';
import { readMine } from '@/lib/studentReads';
import { supabase } from '@/lib/supabase';
import { useJourney } from '@/contexts/JourneyContext';
import { FOCUS } from '@/lib/portalTheme';
import {
  BadgeCheck, Clock, FileText, Inbox, Plus, Send, X, XCircle,
} from 'lucide-react';
import type { ViewType } from '@/lib/types';

// eslint-disable-next-line max-len
const COLUMNS = 'student_id, pipeline, item_id, kind, subject, detail, status, with_office, decision_note, submitted_at, decided_at, completed_at';

export interface RequestRow {
  pipeline: 'request' | 'transcript' | 'correction';
  item_id: string;
  kind: string;
  subject: string | null;
  detail: string | null;
  status: string;
  with_office: string | null;
  decision_note: string | null;
  submitted_at: string;
  decided_at: string | null;
  completed_at: string | null;
}

/**
 * What a student may ask for here, in the University's own words.
 *
 * `transcript` IS DELIBERATELY ABSENT. See the header — it already has a
 * pipeline, and 073's CHECK constraint refuses it at the table so that this
 * list and the database cannot drift apart.
 */
export const KINDS: { kind: string; label: string; help: string; office: string }[] = [
  {
    kind: 'enrolment-confirmation',
    label: 'Enrolment confirmation',
    help: 'A letter confirming you are enrolled — for a visa, a bank, or an employer.',
    office: 'The Registry',
  },
  {
    kind: 'student-id-card',
    label: 'Student ID card',
    help: 'A new card, or a replacement for one lost or damaged.',
    office: 'The Registry',
  },
  {
    kind: 'contact-change',
    label: 'Change my contact details',
    help: 'Where a change needs the University to record it rather than you editing it.',
    office: 'The Registry',
  },
  {
    kind: 'academic-leave',
    label: 'Academic leave',
    help: 'Time away from your studies with your place held.',
    office: 'The Registry',
  },
  {
    kind: 'deferment',
    label: 'Deferment',
    help: 'Deferring your entry or your current year to a later intake.',
    office: 'The Registry',
  },
  {
    kind: 'programme-change',
    label: 'Change of programme',
    help: 'Moving to a different programme. Say which one, and why.',
    office: 'The Academic Office',
  },
  {
    kind: 'course-withdrawal',
    label: 'Withdraw from a course',
    help: 'Dropping a course you are registered on. Name the course and the reason.',
    office: 'The Academic Office',
  },
  {
    kind: 'academic-appeal',
    label: 'Academic appeal',
    help: 'Appealing a decision or a result. Say what you are appealing and on what grounds.',
    office: 'The Academic Office',
  },
  {
    kind: 'message-registrar',
    label: 'Write to the Registrar',
    help: 'Anything about your record, your enrolment or your documents.',
    office: 'The Registry',
  },
  {
    kind: 'message-finance',
    label: 'Write to Finance',
    help: 'Anything about fees, payments or a statement of your account.',
    office: 'The Finance Office',
  },
  {
    kind: 'message-academic-office',
    label: 'Write to the Academic Office',
    help: 'Anything about your programme, your curriculum or your teaching.',
    office: 'The Academic Office',
  },
  {
    kind: 'other',
    label: 'Something else',
    help: 'Where none of the above fits. Say as much as you can.',
    office: 'The Registry',
  },
];

/** One vocabulary of statuses, as 074 translates the three pipelines into. */
export const STATUS_LOOK: Record<string, { label: string; tone: 'open' | 'good' | 'bad' | 'done' }> = {
  submitted: { label: 'Submitted', tone: 'open' },
  'under-review': { label: 'Under review', tone: 'open' },
  approved: { label: 'Approved', tone: 'good' },
  declined: { label: 'Declined', tone: 'bad' },
  completed: { label: 'Completed', tone: 'done' },
  withdrawn: { label: 'Withdrawn', tone: 'bad' },
};

export function look(status: string) {
  // AN UNTRANSLATED STATUS IS SHOWN AS ITSELF rather than forced into one of
  // the six. 074 passes through anything it does not recognise on purpose, so
  // that a status nobody has mapped is visible instead of mislabelled.
  return STATUS_LOOK[status] ?? { label: status, tone: 'open' as const };
}

export function isOpen(status: string): boolean {
  return status === 'submitted' || status === 'under-review';
}

export default function StudentServices({ onNavigate }: { onNavigate?: (v: ViewType) => void }) {
  const { journey } = useJourney();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const load = useCallback(async () => {
    const { rows: r, failed: f } = await readMine<RequestRow>(
      'my_requests', COLUMNS, { column: 'submitted_at', ascending: false },
    );
    setRows(r); setFailed(f); setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const open = useMemo(() => rows.filter((r) => isOpen(r.status)), [rows]);
  const closed = useMemo(() => rows.filter((r) => !isOpen(r.status)), [rows]);

  return (
    <StudentScreen
      title="Student services"
      subtitle={rows.length === 0
        ? 'Ask the University for something, and see where it has got to'
        : `${open.length} open · ${closed.length} closed`}
      loading={loading}
      failed={failed}
      action={(
        <button
          onClick={() => setAsking(true)}
          className={`flex items-center gap-2 rounded-lg bg-[#422e59] px-4 py-2 text-sm
                      font-semibold text-white transition hover:bg-[#33234a] ${FOCUS}`}
        >
          <Plus size={15} /> Make a request
        </button>
      )}
    >
      <div className="space-y-6">
        {rows.length === 0 && (
          <Card>
            <EmptyState
              icon={<Inbox size={20} />}
              title="You have not asked us for anything yet"
              description={'When you do, it appears here with its state — submitted, under '
                + 'review, approved or declined, and finally completed — so you never have to ask '
                + 'whether anybody has seen it.'}
            />
          </Card>
        )}

        {open.length > 0 && (
          <Section title="Open" rows={open} onChanged={load} />
        )}
        {closed.length > 0 && (
          <Section title="Closed" rows={closed} onChanged={load} />
        )}

        {/* ------------------------------------------------------------------
            AND THE ONE THING THIS SCREEN DOES NOT DO, SAID OUT LOUD.

            A student looking for "request transcript" — the first item on the
            University's own list — must be sent somewhere, not left to
            conclude it cannot be done.
            ------------------------------------------------------------------ */}
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#33234a] dark:text-[#e4dcf0]">
              Asking for a transcript
            </p>
            <p className="text-[11px] text-[#a49bb0] dark:text-[#7b7289]">
              Transcripts have their own request, alongside your credentials — any you raise
              there appear in the list above.
            </p>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('my-credentials')}
              className={`shrink-0 rounded-lg border border-[#ded6c8] px-3 py-1.5 text-xs
                          font-medium text-[#422e59] transition hover:bg-[#f5f1ea]
                          dark:border-[#3d3349] dark:text-[#c8b6e8] dark:hover:bg-[#2a2333] ${FOCUS}`}
            >
              Request a transcript
            </button>
          )}
        </Card>
      </div>

      {asking && (
        <AskPanel
          studentId={journey?.student_id ?? null}
          onClose={() => setAsking(false)}
          onDone={() => { setAsking(false); void load(); }}
        />
      )}
    </StudentScreen>
  );
}

function Section({
  title, rows, onChanged,
}: { title: string; rows: RequestRow[]; onChanged: () => void }) {
  return (
    <section className="space-y-2">
      <h2 className="font-heading text-sm font-bold text-[#422e59] dark:text-[#c8b6e8]">
        {title} · {rows.length}
      </h2>
      <Card className="divide-y divide-[#f0ece4] dark:divide-[#2a2333]">
        {rows.map((r) => <Row key={`${r.pipeline}-${r.item_id}`} r={r} onChanged={onChanged} />)}
      </Card>
    </section>
  );
}

function Row({ r, onChanged }: { r: RequestRow; onChanged: () => void }) {
  const l = look(r.status);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // WITHDRAWABLE ONLY WHERE IT IS ACTUALLY THEIRS TO WITHDRAW. The other two
  // pipelines have their own rules and their own screens; offering a button
  // that the database would refuse is worse than not offering one.
  const canWithdraw = r.pipeline === 'request' && isOpen(r.status);

  async function withdraw() {
    setBusy(true); setProblem(null);
    const { error } = await supabase
      .from('student_requests')
      .update({ status: 'withdrawn' })
      .eq('id', r.item_id);
    setBusy(false);
    if (error) { setProblem(error.message); return; }
    onChanged();
  }

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
        <span className="mt-0.5 shrink-0">
          {l.tone === 'good' || l.tone === 'done'
            ? <BadgeCheck size={15} className="text-emerald-600" />
            : l.tone === 'bad' ? <XCircle size={15} className="text-red-600" />
              : <Clock size={15} className="text-[#a07c12]" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#33234a] dark:text-[#e4dcf0]">
            {r.subject ?? KINDS.find((k) => k.kind === r.kind)?.label ?? r.kind}
          </p>
          {r.detail && (
            <p className="mt-0.5 line-clamp-2 text-xs text-[#6b6076] dark:text-[#9c93ad]">
              {r.detail}
            </p>
          )}
          <p className="mt-1 text-[11px] text-[#a49bb0]">
            Submitted {new Date(r.submitted_at).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
            {r.with_office && isOpen(r.status) ? ` · with ${r.with_office}` : ''}
          </p>
          {/* THE REASON, WHERE THERE IS ONE. 073 refuses a decline without
              one, so a declined request always has something to show here. */}
          {r.decision_note && !isOpen(r.status) && (
            <p className="mt-1.5 rounded-lg bg-[#faf8f4] px-3 py-2 text-xs leading-relaxed
                          text-[#33234a] dark:bg-[#241f2c] dark:text-[#e4dcf0]">
              {r.decision_note}
            </p>
          )}
          {problem && (
            <p className="mt-1.5 text-xs text-red-700 dark:text-red-300">{problem}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
            l.tone === 'good' || l.tone === 'done'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
              : l.tone === 'bad'
                ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
          }`}>
            {l.label}
          </span>
          {canWithdraw && (
            <button
              onClick={withdraw}
              disabled={busy}
              className="text-[11px] text-[#a49bb0] underline underline-offset-2
                         hover:text-[#6b6076] disabled:opacity-50"
            >
              {busy ? 'Withdrawing…' : 'Withdraw'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AskPanel({
  studentId, onClose, onDone,
}: { studentId: string | null; onClose: () => void; onDone: () => void }) {
  const [kind, setKind] = useState(KINDS[0].kind);
  const [subject, setSubject] = useState('');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const chosen = KINDS.find((k) => k.kind === kind)!;
  // THE SAME MINIMUM THE DATABASE ENFORCES, so the refusal happens here with
  // an explanation rather than there with a constraint name.
  const tooShort = detail.trim().length < 20;
  const noSubject = subject.trim().length < 3;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId) {
      setProblem('Your account is not linked to a student record, so a request cannot be filed '
        + 'against it. The Registry links the two.');
      return;
    }
    setBusy(true); setProblem(null);
    const { data: session } = await supabase.auth.getSession();
    const { error } = await supabase.from('student_requests').insert({
      student_id: studentId,
      kind,
      subject: subject.trim(),
      detail: detail.trim(),
      with_office: chosen.office,
      submitted_by: session.session?.user?.id ?? null,
    });
    setBusy(false);
    if (error) { setProblem(error.message); return; }
    onDone();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      role="dialog"
      aria-label="Make a request"
    >
      <Card className="my-8 w-full max-w-lg p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-heading text-base font-bold text-[#422e59] dark:text-[#c8b6e8]">
            Make a request
          </h2>
          <button onClick={onClose} aria-label="Close"
            className="rounded-lg p-1.5 text-[#a49bb0] hover:bg-[#f5f1ea] dark:hover:bg-[#2a2333]">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="req-kind" className="text-xs font-medium text-[#6b6076] dark:text-[#9c93ad]">
              What do you need?
            </label>
            <select
              id="req-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#ded6c8] bg-white px-3 py-2 text-sm
                         text-[#33234a] dark:border-[#3d3349] dark:bg-[#241f2c] dark:text-[#e4dcf0]"
            >
              {KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-[#a49bb0]">
              {chosen.help} This goes to {chosen.office}.
            </p>
          </div>

          <div>
            <label htmlFor="req-subject" className="text-xs font-medium text-[#6b6076] dark:text-[#9c93ad]">
              Subject
            </label>
            <input
              id="req-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              className="mt-1 w-full rounded-lg border border-[#ded6c8] bg-white px-3 py-2 text-sm
                         text-[#33234a] dark:border-[#3d3349] dark:bg-[#241f2c] dark:text-[#e4dcf0]"
            />
          </div>

          <div>
            <label htmlFor="req-detail" className="text-xs font-medium text-[#6b6076] dark:text-[#9c93ad]">
              Tell us what you need, and why
            </label>
            <textarea
              id="req-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-lg border border-[#ded6c8] bg-white px-3 py-2 text-sm
                         text-[#33234a] dark:border-[#3d3349] dark:bg-[#241f2c] dark:text-[#e4dcf0]"
            />
            <p className={`mt-1 text-[11px] ${tooShort && detail.length > 0
              ? 'text-[#a07c12]' : 'text-[#a49bb0]'}`}>
              {/* SAID BEFORE THEY PRESS, not after. A request with too little
                  in it is declined and the student has to start again. */}
              Enough for somebody to act on without writing back to you — at least a couple of
              sentences. {detail.trim().length}/20
            </p>
          </div>

          {problem && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700
                          dark:bg-red-950/30 dark:text-red-300">
              {problem}
            </p>
          )}

          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={onClose}
              className="text-xs font-medium text-[#6b6076] hover:underline dark:text-[#9c93ad]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || tooShort || noSubject}
              className={`flex items-center gap-2 rounded-lg bg-[#422e59] px-4 py-2 text-sm
                          font-semibold text-white transition hover:bg-[#33234a]
                          disabled:opacity-50 ${FOCUS}`}
            >
              <Send size={14} /> {busy ? 'Sending…' : 'Submit request'}
            </button>
          </div>

          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[#a49bb0]">
            <FileText size={12} className="mt-0.5 shrink-0" />
            You can withdraw this while nobody has decided it. Once it has been decided, the
            record is the University&apos;s.
          </p>
        </form>
      </Card>
    </div>
  );
}
