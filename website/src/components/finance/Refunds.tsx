'use client';

// ---------------------------------------------------------------------------
// REFUNDS — money going back, and the record it leaves.
//
// ---------------------------------------------------------------------------
// `approve-refund` HAD NO DOOR
// ---------------------------------------------------------------------------
//
// The audit put it first on the list: "NO DOOR. The Finance Director may
// approve a refund and there is no refund anywhere in this system — no
// request, no screen, no table." The permission has been granted to two
// offices for as long as the matrix has existed, against nothing at all.
//
// ---------------------------------------------------------------------------
// THE SCREEN SHOWS THE DETERMINATION BEFORE IT SHOWS A BUTTON
// ---------------------------------------------------------------------------
//
// Because the University has TWO RULES and they disagree. The refund schedule
// published in the Student Fees Guide allows 25% on day 89; the decision of
// 16 September 2026 allows nothing once studies have commenced. 102 computes
// both, stores both, and takes the lower — and this draws both, side by side,
// so an officer approving a refund is not approving a number whose provenance
// they cannot see.
//
// Where they disagree the higher figure is reachable, and only through an
// exceptional policy that has to be named and authorised. That is the
// University's own carve-out and it is meant to cost something.
//
// ---------------------------------------------------------------------------
// AND RECORDING IS NOT DECIDING
// ---------------------------------------------------------------------------
//
// Two capabilities, drawn separately. `manage-student-accounts` opens a
// request; `approve-refund` decides one. An office holding the first sees no
// decision controls at all — not greyed out, absent — and the route refuses
// them regardless, because a hidden button is not a rule.
// ---------------------------------------------------------------------------

import React from 'react';
import {
  Undo2, RefreshCw, AlertTriangle, ShieldAlert, Check, X, Banknote, Scale,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/roles';
import {
  Card, CardHeader, PageHeader, EmptyState, Skeleton,
} from '@/components/ui/portal';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, LABEL } from '@/lib/portalTheme';

interface Row {
  id: string;
  status: string;
  student_number: string | null;
  student_name: string | null;
  payment_reference: string | null;
  purpose: string | null;
  amount_paid: number | null;
  amount_requested: number | null;
  amount_approved: number | null;
  currency: string | null;
  reason: string | null;
  determination: string | null;
  days_since_enrolment: number | null;
  percent_by_schedule: number | null;
  percent_by_policy: number | null;
  eligible_amount: number | null;
  exceptional_policy: string | null;
  exception_authorised_by_name: string | null;
  destination: string | null;
  decision_reason: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  refund_reference: string | null;
  paid_at: string | null;
  requested_by_name: string | null;
  created_at: string | null;
}

// eslint-disable-next-line max-len
const COLUMNS = 'id, status, student_number, student_name, payment_reference, purpose, amount_paid, amount_requested, amount_approved, currency, reason, determination, days_since_enrolment, percent_by_schedule, percent_by_policy, eligible_amount, exceptional_policy, exception_authorised_by_name, destination, decision_reason, decided_by_name, decided_at, refund_reference, paid_at, requested_by_name, created_at';

const STATUS: Record<string, { label: string; className: string }> = {
  submitted: { label: 'Submitted', className: 'bg-[#fdf3e0] text-[#a86a12]' },
  under_review: { label: 'Under review', className: 'bg-[#eaf0fb] text-[#2f5aa8]' },
  approved: { label: 'Approved', className: 'bg-[#e7f5ed] text-[#1f7a4d]' },
  rejected: { label: 'Rejected', className: 'bg-[#fdeaee] text-[#a3283f]' },
  paid: { label: 'Paid', className: 'bg-[#e7f5ed] text-[#1f7a4d]' },
  withdrawn: { label: 'Withdrawn', className: 'bg-[#f8f6fb] text-[#5c5366]' },
};

const money = (n: number | null | undefined, currency: string | null) =>
  (n === null || n === undefined ? '—' : `${currency ?? ''} ${Number(n).toFixed(2)}`);

const when = (iso: string | null) => (iso
  ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—');

async function post(body: Record<string, unknown>) {
  const { data: session } = await supabase.auth.getSession();
  const res = await fetch('/api/finance/refund', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session?.session?.access_token ?? ''}`,
    },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{ ok: boolean; error?: string; detail?: string; next?: string }>;
}

export default function Refunds() {
  const { user } = useAuth();
  const mayRecord = can(user?.role, 'manage-student-accounts');
  const mayDecide = can(user?.role, 'approve-refund');

  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [field, setField] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    setRows(null);
    const { data, error: e } = await supabase
      .from('refund_audit')
      .select(COLUMNS)
      .order('created_at', { ascending: false })
      .limit(500);
    if (e) { setError(e.message); setRows([]); return; }
    setError(null);
    setRows((data ?? []) as Row[]);
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function act(body: Record<string, unknown>) {
    setBusy(true); setNote(null);
    const r = await post(body);
    setBusy(false);
    setNote(r.ok ? (r.next ?? 'Recorded.') : (r.detail ?? r.error ?? 'It was not recorded.'));
    if (r.ok) await load();
  }

  const set = (id: string, key: string, v: string) =>
    setField((f) => ({ ...f, [`${id}:${key}`]: v }));
  const get = (id: string, key: string) => field[`${id}:${key}`] ?? '';

  if (!mayRecord && !mayDecide) {
    return (
      <Card className="p-5">
        <p className="flex items-start gap-2 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          <ShieldAlert size={16} className="mt-0.5 flex-shrink-0 text-[#a3283f]" />
          <span>Refunds are Finance&rsquo;s.</span>
        </p>
      </Card>
    );
  }

  const disagreeing = (rows ?? []).filter(
    (r) => r.percent_by_schedule !== r.percent_by_policy,
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Refunds"
        subtitle="Money going back, what it was determined against, and who decided it"
      />

      {/* THE TWO RULES, SAID ONCE AT THE TOP. An officer who reads no further
          still knows the number below is the lower of two answers. */}
      <Card className="p-5">
        <p className="flex items-start gap-2 text-sm text-[#6b6076] dark:text-[#9c93ad]">
          <Scale size={16} className="mt-0.5 flex-shrink-0 text-[#6b6076]" />
          <span>
            Eligibility is determined by the system from the payment and the student&rsquo;s
            enrolment date, and it is <strong>two answers</strong>. The refund schedule
            published in the Student Fees Guide allows 100% within 7 days of enrolment, then
            75%, 50% and 25% out to 90 days. The University&rsquo;s decision of 16 September
            2026 allows a refund only where studies have not started or not resumed. Where they
            differ the lower stands, unless an exceptional policy is named and authorised.
            {disagreeing > 0 && (
              <>
                {' '}
                <strong>
                  {disagreeing} of the requests below fall where the two rules disagree.
                </strong>
              </>
            )}
          </span>
        </p>
      </Card>

      <Card>
        <CardHeader
          title="Refund requests"
          subtitle={rows ? `${rows.length} recorded` : 'Reading…'}
          action={(
            <button type="button" className={BTN_SECONDARY} onClick={() => void load()}>
              <RefreshCw size={14} /> Refresh
            </button>
          )}
        />

        {note && (
          <p className="mx-5 mb-4 rounded-lg border border-[#ded6c8] bg-[#f8f6fb] px-3 py-2 text-sm text-[#422e59] dark:border-[#3d3349] dark:bg-[#2a2233] dark:text-[#e4dcf0]">
            {note}
          </p>
        )}

        {error && (
          <p className="mx-5 mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {error}
          </p>
        )}

        {rows === null && (
          <div className="space-y-2 p-5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {rows?.length === 0 && !error && (
          <EmptyState
            icon={<Undo2 size={20} />}
            title="No refund has been asked for"
            description="A refund is recorded against the payment it returns. The payment itself is never edited or deleted — that is refused by the database, for every office and for the server."
          />
        )}

        {rows && rows.length > 0 && (
          <ul className="divide-y divide-[#ece7f3] dark:divide-[#332b3d]">
            {rows.map((r) => {
              const disagree = r.percent_by_schedule !== r.percent_by_policy;
              return (
                <li key={r.id} className="p-5">
                  <div
                    className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2"
                    onClick={() => setOpen(open === r.id ? null : r.id)}
                  >
                    <div>
                      <p className="font-medium text-[#422e59] dark:text-[#e4dcf0]">
                        {r.student_number ?? '—'}
                        <span className="ml-2 font-normal text-[#6b6076] dark:text-[#9c93ad]">
                          {r.student_name}
                        </span>
                      </p>
                      <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
                        {money(r.amount_requested, r.currency)} asked of{' '}
                        {money(r.amount_paid, r.currency)} paid
                        {r.payment_reference ? ` · ${r.payment_reference}` : ''}
                        {' · '}{when(r.created_at)}
                      </p>
                    </div>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[r.status]?.className ?? ''}`}>
                      {STATUS[r.status]?.label ?? r.status}
                    </span>
                  </div>

                  {/* THE DETERMINATION, ALWAYS VISIBLE. Not behind the expander:
                      it is the reason the amount below is what it is. */}
                  <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
                    disagree
                      ? 'border-amber-300 bg-amber-50 text-amber-900'
                      : 'border-[#ded6c8] bg-[#f8f6fb] text-[#6b6076] dark:border-[#3d3349] dark:bg-[#2a2233] dark:text-[#9c93ad]'
                  }`}
                  >
                    {disagree && (
                      <AlertTriangle size={14} className="mr-1 inline-block align-[-2px]" />
                    )}
                    {r.determination}
                    <span className="mt-1 block font-medium">
                      Allowed without an exception: {money(r.eligible_amount, r.currency)}
                    </span>
                  </div>

                  {open === r.id && (
                    <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-3">
                      {([
                        ['Reason given', r.reason],
                        ['Payment purpose', r.purpose],
                        ['Days since enrolment', r.days_since_enrolment],
                        ['Published schedule allows', `${r.percent_by_schedule}%`],
                        ['Decision of 16 Sept allows', `${r.percent_by_policy}%`],
                        ['Refund to', r.destination],
                        ['Requested by', r.requested_by_name],
                        ['Exceptional policy', r.exceptional_policy],
                        ['Authorised by', r.exception_authorised_by_name],
                        ['Approved', money(r.amount_approved, r.currency)],
                        ['Decision reason', r.decision_reason],
                        ['Decided by', r.decided_by_name],
                        ['Decided', r.decided_at ? when(r.decided_at) : null],
                        ['Refund reference', r.refund_reference],
                        ['Paid', r.paid_at ? when(r.paid_at) : null],
                      ] as [string, string | number | null | undefined][])
                        .filter(([, v]) => v !== null && v !== undefined && v !== '')
                        .map(([k, v]) => (
                          <div key={k}>
                            <dt className="text-xs uppercase tracking-wide text-[#a49bb0]">{k}</dt>
                            <dd className="mt-0.5 text-sm text-[#422e59] dark:text-[#e4dcf0]">
                              {v}
                            </dd>
                          </div>
                        ))}
                    </dl>
                  )}

                  {/* ---- WHAT THIS OFFICE MAY DO, AND NOTHING ELSE ---- */}

                  {mayRecord && ['submitted', 'under_review'].includes(r.status) && (
                    <div className="mt-3 flex gap-2">
                      {r.status === 'submitted' && (
                        <button
                          type="button" className={BTN_SECONDARY} disabled={busy}
                          onClick={() => void act({ action: 'review', id: r.id })}
                        >
                          Take up for review
                        </button>
                      )}
                      {/* TAKING IT BACK IS NOT REFUSING IT, and the difference
                          matters on a financial record. A student who changes
                          their mind was refused by nobody; recording that as a
                          rejection would put a decision in the file that no
                          officer made. 102 keeps them as separate states for
                          the same reason 034 separated `withdrawn` from
                          `declined` on an admission. */}
                      <button
                        type="button" className={BTN_SECONDARY} disabled={busy}
                        onClick={() => void act({ action: 'withdraw', id: r.id })}
                      >
                        <X size={14} /> Withdraw the request
                      </button>
                    </div>
                  )}

                  {mayDecide && ['submitted', 'under_review'].includes(r.status) && disagree
                    && !r.exceptional_policy && (
                    <div className="mt-3 space-y-2 rounded-lg border border-amber-300 p-3">
                      <label className={LABEL} htmlFor={`ex-${r.id}`}>
                        Exceptional policy, to allow up to{' '}
                        {money(
                          Number(r.amount_paid ?? 0) * Number(r.percent_by_schedule ?? 0) / 100,
                          r.currency,
                        )}
                      </label>
                      <input
                        id={`ex-${r.id}`} className={INPUT}
                        placeholder="Name the policy being applied. This stays on the record with your name."
                        value={get(r.id, 'policy')}
                        onChange={(e) => set(r.id, 'policy', e.target.value)}
                      />
                      <button
                        type="button" className={BTN_SECONDARY} disabled={busy}
                        onClick={() => void act({
                          action: 'except', id: r.id, exceptionalPolicy: get(r.id, 'policy'),
                        })}
                      >
                        Authorise the exception
                      </button>
                    </div>
                  )}

                  {mayDecide && r.status === 'under_review' && (
                    <div className="mt-3 space-y-2 rounded-lg border border-[#ded6c8] p-3 dark:border-[#3d3349]">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <label className={LABEL} htmlFor={`am-${r.id}`}>Amount approved</label>
                          <input
                            id={`am-${r.id}`} className={INPUT} inputMode="decimal"
                            placeholder={String(r.eligible_amount ?? 0)}
                            value={get(r.id, 'amount')}
                            onChange={(e) => set(r.id, 'amount', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className={LABEL} htmlFor={`dr-${r.id}`}>Reason</label>
                          <input
                            id={`dr-${r.id}`} className={INPUT}
                            placeholder="The student reads this."
                            value={get(r.id, 'decision')}
                            onChange={(e) => set(r.id, 'decision', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button" className={BTN_PRIMARY} disabled={busy}
                          onClick={() => void act({
                            action: 'approve',
                            id: r.id,
                            amountApproved: Number(get(r.id, 'amount')),
                            decisionReason: get(r.id, 'decision'),
                          })}
                        >
                          <Check size={14} /> Approve
                        </button>
                        <button
                          type="button" className={BTN_SECONDARY} disabled={busy}
                          onClick={() => void act({
                            action: 'reject', id: r.id, decisionReason: get(r.id, 'decision'),
                          })}
                        >
                          <X size={14} /> Reject
                        </button>
                      </div>
                    </div>
                  )}

                  {mayRecord && r.status === 'approved' && (
                    <div className="mt-3 space-y-2">
                      <label className={LABEL} htmlFor={`ref-${r.id}`}>
                        The reference the money went out under
                      </label>
                      <input
                        id={`ref-${r.id}`} className={INPUT}
                        placeholder="So the row and the bank can be put side by side."
                        value={get(r.id, 'reference')}
                        onChange={(e) => set(r.id, 'reference', e.target.value)}
                      />
                      <button
                        type="button" className={BTN_PRIMARY} disabled={busy}
                        onClick={() => void act({
                          action: 'pay', id: r.id, refundReference: get(r.id, 'reference'),
                        })}
                      >
                        <Banknote size={14} /> Record as paid
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
        A refund is a transaction related to a payment, never an edit of one. The payment it
        returns cannot be changed or deleted by any office, including this one and including the
        server — that is refused by the database. Submitting a request refunds nobody: a refund
        goes request, review, decision, and only then does money leave.
      </p>
    </div>
  );
}
