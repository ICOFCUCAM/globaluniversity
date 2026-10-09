'use client';

// ---------------------------------------------------------------------------
// DELETIONS — asked for by the Superadministrator, decided by the
// Vice-Chancellor, and carried out thirty days later.
//
// ---------------------------------------------------------------------------
// THE UNIVERSITY'S RULING
// ---------------------------------------------------------------------------
//
//   "superadmin should be able to delete these files. when he takes delete, it
//    should appear to the VC approval. if the vc accept delete, it is deleted
//    within 30 days. if he says reject, the file is restored. all the records
//    of these processes are kept in the history."
//
// ---------------------------------------------------------------------------
// ONE SCREEN, TWO OFFICES, AND IT DRAWS ONLY WHAT YOURS CAN DO
// ---------------------------------------------------------------------------
//
// The Superadministrator sees what they have asked for and what is counting
// down. The Vice-Chancellor sees what is waiting on them. Neither is offered
// the other's buttons — not greyed out, absent — and the route refuses them
// regardless, because a hidden button is not a rule.
//
// ---------------------------------------------------------------------------
// THE COUNTDOWN IS THE POINT OF THE SCREEN
// ---------------------------------------------------------------------------
//
// Thirty days is a grace period, and a grace period nobody can see the end of
// is a delay. So an approved record shows the days left and the Restore button
// beside them: the whole purpose of the window is that somebody can still
// change their mind inside it.
// ---------------------------------------------------------------------------

import React from 'react';
import {
  Trash2, ShieldAlert, RefreshCw, Check, X, Undo2, Clock, History, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/roles';
import { authedPost } from '@/lib/authedFetch';
import {
  Card, CardHeader, PageHeader, EmptyState, Skeleton,
} from '@/components/ui/portal';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL } from '@/lib/portalTheme';
import { DELETION_GRACE_DAYS } from '@/lib/deletions';

interface Request {
  id: string;
  entity_type: string;
  entity_label: string;
  reason: string;
  status: string;
  requested_at: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  erase_after: string | null;
  erased_at: string | null;
  restored_at: string | null;
}

interface Event {
  id: string;
  request_id: string;
  event: string;
  actor_role: string | null;
  detail: string | null;
  at: string | null;
}

// eslint-disable-next-line max-len
const COLUMNS = 'id, entity_type, entity_label, reason, status, requested_at, decided_at, decision_reason, erase_after, erased_at, restored_at';

const STATUS: Record<string, { label: string; className: string }> = {
  awaiting_decision: { label: 'With the Vice-Chancellor', className: 'bg-[#fdf3e0] text-[#a86a12]' },
  approved: { label: 'Approved — counting down', className: 'bg-[#fdeaee] text-[#a3283f]' },
  rejected: { label: 'Restored', className: 'bg-[#e7f5ed] text-[#1f7a4d]' },
  erased: { label: 'Erased', className: 'bg-[#f8f6fb] text-[#5c5366]' },
  withdrawn: { label: 'Withdrawn', className: 'bg-[#f8f6fb] text-[#5c5366]' },
};

const when = (iso: string | null) => (iso
  ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—');

const daysLeft = (iso: string | null) => (iso
  ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000))
  : 0);

export default function Deletions() {
  const { user } = useAuth();
  const mayAsk = can(user?.role, 'delete-application');
  const mayDecide = can(user?.role, 'approve-deletion');

  const [rows, setRows] = React.useState<Request[] | null>(null);
  const [events, setEvents] = React.useState<Event[]>([]);
  const [open, setOpen] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [held, setHeld] = React.useState<string[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    setRows(null);
    const { data, error } = await supabase
      .from('deletion_requests')
      .select(COLUMNS)
      .order('requested_at', { ascending: false })
      .limit(300);
    if (error) { setNote({ tone: 'bad', text: error.message }); setRows([]); return; }
    setRows((data ?? []) as Request[]);

    const { data: hist } = await supabase
      .from('deletion_request_events')
      .select('id, request_id, event, actor_role, detail, at')
      .order('at', { ascending: true })
      .limit(1000);
    setEvents((hist ?? []) as Event[]);
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function act(body: Record<string, unknown>, key: string) {
    setBusy(key); setNote(null); setHeld(null);
    const out = await authedPost('/api/admin/deletion', body);
    setBusy(null);
    if (!out.ok && Array.isArray(out.held)) setHeld(out.held as string[]);
    setNote({
      tone: out.ok ? 'ok' : 'bad',
      text: String(out.detail ?? out.error ?? 'Nothing happened.'),
    });
    await load();
  }

  if (!mayAsk && !mayDecide) {
    return (
      <Card className="p-5">
        <p className="flex items-start gap-2 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          <ShieldAlert size={16} className="mt-0.5 flex-shrink-0 text-[#a3283f]" />
          <span>
            Deleting a record of the University is the Superadministrator&rsquo;s to ask for and
            the Vice-Chancellor&rsquo;s to decide.
          </span>
        </p>
      </Card>
    );
  }

  const waiting = (rows ?? []).filter((r) => r.status === 'awaiting_decision');
  const countingDown = (rows ?? []).filter((r) => r.status === 'approved');
  const settled = (rows ?? []).filter(
    (r) => !['awaiting_decision', 'approved'].includes(r.status),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deletions"
        subtitle={`The Superadministrator asks, the Vice-Chancellor decides, and an approved record is erased ${DELETION_GRACE_DAYS} days later`}
      />

      {note && (
        <Card className={`p-4 text-sm ${note.tone === 'ok'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-red-200 bg-red-50 text-red-800'}`}
        >
          <p>{note.text}</p>
          {/* EVERY REASON, NOT THE FIRST. A record is often held by more than
              one thing, and fixing one of three is three visits. */}
          {held && held.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {held.map((h) => <li key={h}>{h}</li>)}
            </ul>
          )}
        </Card>
      )}

      {/* ==================================================================
          WAITING ON THE VICE-CHANCELLOR
          ================================================================== */}
      <Card>
        <CardHeader
          title="With the Vice-Chancellor"
          subtitle={rows ? `${waiting.length} awaiting a decision` : 'Reading…'}
          action={(
            <button type="button" className={BTN_SECONDARY} onClick={() => void load()}>
              <RefreshCw size={14} /> Refresh
            </button>
          )}
        />
        {rows === null && <div className="p-5"><Skeleton className="h-4 w-2/3" /></div>}
        {rows !== null && waiting.length === 0 && (
          <EmptyState
            icon={<Trash2 size={20} />}
            title="Nothing is waiting on a decision"
            description="A record is put up for deletion from the screen it lives on. Nothing is hidden or destroyed until the Vice-Chancellor approves it."
          />
        )}
        {waiting.length > 0 && (
          <ul className="divide-y divide-[#ece7f3] dark:divide-[#332b3d]">
            {waiting.map((r) => (
              <li key={r.id} className="space-y-2 p-5">
                <p className="font-medium text-[#422e59] dark:text-[#e4dcf0]">
                  {r.entity_label}
                  <span className="ml-2 text-xs font-normal text-[#6b6076] dark:text-[#9c93ad]">
                    {r.entity_type} · asked {when(r.requested_at)}
                  </span>
                </p>
                <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">{r.reason}</p>

                {mayDecide ? (
                  <div className="space-y-2">
                    <label className={LABEL} htmlFor={`d-${r.id}`}>
                      Your reason — it is kept whichever way you decide
                    </label>
                    <input
                      id={`d-${r.id}`} className={INPUT} value={reason[r.id] ?? ''}
                      onChange={(e) => setReason({ ...reason, [r.id]: e.target.value })}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button" className={BTN_PRIMARY} disabled={busy === r.id}
                        onClick={() => void act(
                          { action: 'approve', id: r.id, reason: reason[r.id] ?? '' }, r.id,
                        )}
                      >
                        <Check size={14} /> Approve — hide now, erase in {DELETION_GRACE_DAYS} days
                      </button>
                      <button
                        type="button" className={BTN_SECONDARY} disabled={busy === r.id}
                        onClick={() => void act(
                          { action: 'reject', id: r.id, reason: reason[r.id] ?? '' }, r.id,
                        )}
                      >
                        <X size={14} /> Refuse
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {/* THE OFFICE THAT ASKED CAN TAKE IT BACK, and cannot
                        decide it. That is the ruling, drawn. */}
                    <button
                      type="button" className={BTN_SECONDARY} disabled={busy === r.id}
                      onClick={() => void act({ action: 'withdraw', id: r.id }, r.id)}
                    >
                      <Undo2 size={14} /> Take it back
                    </button>
                    <span className="self-center text-xs text-[#6b6076] dark:text-[#9c93ad]">
                      The Vice-Chancellor decides this one.
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ==================================================================
          APPROVED, AND COUNTING DOWN
          ================================================================== */}
      {countingDown.length > 0 && (
        <Card>
          <CardHeader
            title="Approved — inside the grace period"
            subtitle={`Hidden from every screen. Erased when the ${DELETION_GRACE_DAYS} days run out, and restorable until then`}
            action={mayAsk ? (
              <button
                type="button" className={BTN_SECONDARY} disabled={busy === 'erase'}
                onClick={() => void act({ action: 'erase' }, 'erase')}
              >
                <Trash2 size={14} /> Erase what is due
              </button>
            ) : undefined}
          />
          <ul className="divide-y divide-[#ece7f3] dark:divide-[#332b3d]">
            {countingDown.map((r) => {
              const left = daysLeft(r.erase_after);
              return (
                <li key={r.id} className="space-y-2 p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium text-[#422e59] dark:text-[#e4dcf0]">
                      {r.entity_label}
                    </p>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      left === 0 ? 'bg-[#fdeaee] text-[#a3283f]' : 'bg-[#fdf3e0] text-[#a86a12]'
                    }`}
                    >
                      <Clock size={12} />
                      {left === 0 ? 'Due now' : `${left} day${left === 1 ? '' : 's'} left`}
                    </span>
                  </div>
                  <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
                    Approved {when(r.decided_at)} · erased after {when(r.erase_after)}
                    {r.decision_reason ? ` · ${r.decision_reason}` : ''}
                  </p>

                  {mayDecide && (
                    <div className="space-y-2">
                      <input
                        className={INPUT} value={reason[r.id] ?? ''}
                        placeholder="Why it is being brought back"
                        onChange={(e) => setReason({ ...reason, [r.id]: e.target.value })}
                      />
                      <button
                        type="button" className={BTN_SECONDARY} disabled={busy === r.id}
                        onClick={() => void act(
                          { action: 'reject', id: r.id, reason: reason[r.id] ?? '' }, r.id,
                        )}
                      >
                        <Undo2 size={14} /> Restore it
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="flex items-start gap-2 px-5 pb-5 text-xs text-[#6b6076] dark:text-[#9c93ad]">
            <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
            <span>
              Erasing destroys the record. What was asked, who decided it and why stay on the
              register below for ever; the record itself does not come back.
            </span>
          </p>
        </Card>
      )}

      {/* ==================================================================
          THE HISTORY — "all the records of these processes are kept"
          ================================================================== */}
      <Card>
        <CardHeader
          title="The register of deletions"
          subtitle="Everything asked for, decided, restored or erased. Nothing on it can be edited or removed."
        />
        {rows !== null && settled.length === 0 && (
          <EmptyState
            icon={<History size={20} />}
            title="Nothing has been decided yet"
            description="Every request and every decision stays here afterwards, including the ones that were refused."
          />
        )}
        {settled.length > 0 && (
          <ul className="divide-y divide-[#ece7f3] dark:divide-[#332b3d]">
            {settled.map((r) => (
              <li key={r.id} className="p-5">
                <div
                  className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2"
                  onClick={() => setOpen(open === r.id ? null : r.id)}
                >
                  <div>
                    <p className="font-medium text-[#422e59] dark:text-[#e4dcf0]">
                      {r.entity_label}
                    </p>
                    <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
                      {r.entity_type} · asked {when(r.requested_at)}
                      {r.decided_at ? ` · decided ${when(r.decided_at)}` : ''}
                    </p>
                  </div>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[r.status]?.className ?? ''}`}>
                    {STATUS[r.status]?.label ?? r.status}
                  </span>
                </div>

                {open === r.id && (
                  <ol className="mt-3 space-y-1 border-l-2 border-[#ded6c8] pl-3 dark:border-[#3d3349]">
                    {events.filter((e) => e.request_id === r.id).map((e) => (
                      <li key={e.id} className="text-sm">
                        <span className="font-mono text-xs text-[#a49bb0]">
                          {when(e.at)}
                        </span>
                        <span className="ml-2 font-medium text-[#422e59] dark:text-[#e4dcf0]">
                          {e.event}
                        </span>
                        {e.actor_role && (
                          <span className="ml-2 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                            {e.actor_role}
                          </span>
                        )}
                        {e.detail && (
                          <p className="text-[#6b6076] dark:text-[#9c93ad]">{e.detail}</p>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
