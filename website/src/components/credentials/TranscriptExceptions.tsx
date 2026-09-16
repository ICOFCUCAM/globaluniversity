'use client';

// ---------------------------------------------------------------------------
// THE EXCEPTIONAL PATH, BOTH ENDS OF IT.
//
// One component, two audiences, because it is one conversation:
//
//   raising    the Registrar or the Director of Academic Affairs has evidence
//              that a legitimate student exists and cannot find them
//   deciding   the Vice-Chancellor or the Superadministrator approves, rejects
//              or returns it for correction
//
// ---------------------------------------------------------------------------
// WHY ONE COMPONENT AND NOT TWO
// ---------------------------------------------------------------------------
//
// Because the list is the same list. An officer who raised three requests and
// a Vice-Chancellor deciding them are looking at the same rows, and 100's
// row-level security is what makes them different views of it — the officer
// sees theirs, the two offices see all of them. Two components would have
// meant two readers of one table that could drift about what a status means.
//
// WHAT IS DIFFERENT IS THE CONTROLS, and that is a capability question asked
// once, here.
//
// ---------------------------------------------------------------------------
// THERE IS NO FIELD HERE FOR A COURSE, A CREDIT OR A GRADE
// ---------------------------------------------------------------------------
//
// Deliberately, and it is the most important thing about this screen. The
// University's §7 lists what a request records — name, claimed number,
// programme, year, reason, evidence — and not one of those is an academic
// fact. Approving this does not create a transcript and does not create a
// student; it permits an exception, and the academic content of anything that
// follows comes from the student register or from nowhere.
//
// A form here with a marks table on it would be the exact thing the whole
// ruling exists to prevent, wearing an approval.
// ---------------------------------------------------------------------------

import React from 'react';
import {
  ShieldQuestion, Check, X, Undo2, RefreshCw, Send,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/roles';
import {
  Card, CardHeader, EmptyState, Skeleton,
} from '@/components/ui/portal';
import { BTN_PRIMARY, BTN_SECONDARY, FOCUS } from '@/lib/portalTheme';

interface Request {
  id: string;
  claimed_student_number: string;
  claimed_full_name: string;
  claimed_programme: string | null;
  claimed_year: string | null;
  reason: string;
  status: string;
  requested_role: string | null;
  requested_at: string | null;
  decided_at: string | null;
  decision_note: string | null;
}

// eslint-disable-next-line max-len
const COLUMNS = 'id, claimed_student_number, claimed_full_name, claimed_programme, claimed_year, reason, status, requested_role, requested_at, decided_at, decision_note';

const INPUT = 'w-full rounded-lg border border-[#ded6c8] bg-white px-3 py-2 text-sm '
  + 'text-[#422e59] placeholder:text-[#a49bb0] dark:border-[#3d3349] dark:bg-[#231c2b] '
  + `dark:text-[#e4dcf0] ${FOCUS}`;

const LABEL = 'mb-1 block text-xs uppercase tracking-wide text-[#a49bb0]';

const STATUS: Record<string, { label: string; className: string }> = {
  submitted: { label: 'Awaiting validation', className: 'bg-[#fdf3e0] text-[#a86a12]' },
  approved: { label: 'Approved', className: 'bg-[#e7f5ed] text-[#1f7a4d]' },
  rejected: { label: 'Rejected', className: 'bg-[#fdeaee] text-[#a3283f]' },
  returned: { label: 'Returned for correction', className: 'bg-[#f8f6fb] text-[#5c5366]' },
};

const when = (iso: string | null) => (iso
  ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  : '—');

async function post(body: Record<string, unknown>) {
  const { data: session } = await supabase.auth.getSession();
  const res = await fetch('/api/transcript/validation', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session?.session?.access_token ?? ''}`,
    },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{ ok: boolean; error?: string; detail?: string; next?: string }>;
}

export default function TranscriptExceptions() {
  const { user } = useAuth();
  const mayDecide = can(user?.role, 'validate-transcript-exception');
  const mayRaise = can(user?.role, 'issue-credential');

  const [rows, setRows] = React.useState<Request[] | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState({
    claimedStudentNumber: '', claimedFullName: '', claimedProgramme: '',
    claimedYear: '', reason: '',
  });
  const [notes, setNotes] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    setRows(null);
    const { data } = await supabase
      .from('transcript_validation_requests')
      .select(COLUMNS)
      .order('requested_at', { ascending: false })
      .limit(200);
    setRows((data ?? []) as Request[]);
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function submit() {
    setBusy(true); setNote(null);
    const r = await post({ action: 'raise', ...form });
    setBusy(false);
    if (!r.ok) { setNote(r.detail ?? r.error ?? 'It was not recorded.'); return; }
    setForm({
      claimedStudentNumber: '', claimedFullName: '', claimedProgramme: '',
      claimedYear: '', reason: '',
    });
    setNote('Sent to the Vice-Chancellor and the Superadministrator.');
    await load();
  }

  async function decide(id: string, action: 'approve' | 'reject' | 'return') {
    setBusy(true); setNote(null);
    const r = await post({ action, id, note: notes[id] ?? '' });
    setBusy(false);
    setNote(r.ok ? (r.next ?? 'Recorded.') : (r.detail ?? r.error ?? 'It was not recorded.'));
    if (r.ok) await load();
  }

  const waiting = (rows ?? []).filter((r) => r.status === 'submitted');

  return (
    <div className="space-y-5">
      {note && (
        <p className="rounded-lg border border-[#ded6c8] bg-[#f8f6fb] px-3 py-2 text-sm text-[#422e59] dark:border-[#3d3349] dark:bg-[#2a2233] dark:text-[#e4dcf0]">
          {note}
        </p>
      )}

      {/* ---- RAISING ---------------------------------------------------- */}
      {mayRaise && !mayDecide && (
        <Card>
          <CardHeader
            title="Ask for an exceptional transcript"
            subtitle="Only where you have evidence that a legitimate student exists and cannot be found in the register"
          />
          <div className="space-y-4 p-5">
            <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">
              This does not create a transcript and does not create a student record. It asks the
              Vice-Chancellor or the SuperAdmin to permit an exception. Nothing on this form is an
              academic fact, and none of it appears on any document.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="tvr-number">Claimed student number</label>
                <input
                  id="tvr-number" className={INPUT} value={form.claimedStudentNumber}
                  placeholder="ICOF-UG-2026-00125"
                  onChange={(e) => setForm({ ...form, claimedStudentNumber: e.target.value })}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="tvr-name">Claimed name</label>
                <input
                  id="tvr-name" className={INPUT} value={form.claimedFullName}
                  onChange={(e) => setForm({ ...form, claimedFullName: e.target.value })}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="tvr-programme">Programme</label>
                <input
                  id="tvr-programme" className={INPUT} value={form.claimedProgramme}
                  onChange={(e) => setForm({ ...form, claimedProgramme: e.target.value })}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="tvr-year">Academic year</label>
                <input
                  id="tvr-year" className={INPUT} value={form.claimedYear} placeholder="2025/2026"
                  onChange={(e) => setForm({ ...form, claimedYear: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className={LABEL} htmlFor="tvr-reason">
                The case, and what evidence you hold
              </label>
              <textarea
                id="tvr-reason" className={`${INPUT} min-h-[96px]`} value={form.reason}
                placeholder="Admitted through the Uganda administration in 2023; the paper file and the admission letter are held, but no student record was ever opened."
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>
            <button
              type="button" className={BTN_PRIMARY} disabled={busy}
              onClick={() => void submit()}
            >
              <Send size={14} /> Send for validation
            </button>
          </div>
        </Card>
      )}

      {/* ---- DECIDING ---------------------------------------------------- */}
      <Card>
        <CardHeader
          title={mayDecide ? 'Transcript validation requests' : 'My validation requests'}
          subtitle={mayDecide
            ? `${waiting.length} awaiting your decision`
            : 'What you have asked for, and what was decided'}
          action={(
            <button type="button" className={BTN_SECONDARY} onClick={() => void load()}>
              <RefreshCw size={14} /> Refresh
            </button>
          )}
        />

        {rows === null && (
          <div className="space-y-2 p-5">
            <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {rows?.length === 0 && (
          <EmptyState
            icon={<ShieldQuestion size={20} />}
            title="Nothing is waiting"
            description={mayDecide
              ? 'An exceptional transcript is one nobody should need often. When an officer cannot find a student they have evidence for, their case appears here.'
              : 'You have not asked for an exceptional transcript.'}
          />
        )}

        {rows && rows.length > 0 && (
          <ul className="divide-y divide-[#ece7f3] dark:divide-[#332b3d]">
            {rows.map((r) => (
              <li key={r.id} className="space-y-3 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-medium text-[#422e59] dark:text-[#e4dcf0]">
                      {r.claimed_full_name}
                      <span className="ml-2 font-normal text-[#6b6076] dark:text-[#9c93ad]">
                        {r.claimed_student_number}
                      </span>
                    </p>
                    <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
                      {[r.claimed_programme, r.claimed_year].filter(Boolean).join(' · ')}
                      {r.requested_at ? ` · asked ${when(r.requested_at)}` : ''}
                    </p>
                  </div>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[r.status]?.className ?? ''}`}>
                    {STATUS[r.status]?.label ?? r.status}
                  </span>
                </div>

                <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">{r.reason}</p>

                {r.decision_note && (
                  <p className="rounded-lg border border-[#ded6c8] bg-[#f8f6fb] px-3 py-2 text-sm text-[#422e59] dark:border-[#3d3349] dark:bg-[#2a2233] dark:text-[#e4dcf0]">
                    {r.decision_note}
                  </p>
                )}

                {mayDecide && r.status === 'submitted' && (
                  <div className="space-y-2">
                    <textarea
                      className={`${INPUT} min-h-[64px]`}
                      placeholder="Required to reject or return: what the officer should do next."
                      value={notes[r.id] ?? ''}
                      onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button" className={BTN_PRIMARY} disabled={busy}
                        onClick={() => void decide(r.id, 'approve')}
                      >
                        <Check size={14} /> Approve
                      </button>
                      <button
                        type="button" className={BTN_SECONDARY} disabled={busy}
                        onClick={() => void decide(r.id, 'return')}
                      >
                        <Undo2 size={14} /> Return for correction
                      </button>
                      <button
                        type="button" className={BTN_SECONDARY} disabled={busy}
                        onClick={() => void decide(r.id, 'reject')}
                      >
                        <X size={14} /> Reject
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
