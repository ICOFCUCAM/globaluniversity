'use client';

// ---------------------------------------------------------------------------
// THE AGREEMENT AN ADMINISTRATION OPERATES UNDER.
//
// ---------------------------------------------------------------------------
// THE DOOR THAT WAS MISSING
// ---------------------------------------------------------------------------
//
// 098 built `national_revenue_agreements`. Nothing in the application could
// create or approve one, and the audit found it: with no agreement in force
// every payment stays whole with the centre, so the ledger was empty, the purse
// was nil, and 099's national expenditure could never be authorised. Two
// migrations of machinery behind a wall.
//
// The Rector's own Finance screen said it out loud — "until a national revenue
// agreement is in force, every payment goes wholly to the centre" — and offered
// no way out of that state. This is the way out.
//
// ---------------------------------------------------------------------------
// WHY IT LIVES BESIDE THE REGISTER OF ADMINISTRATIONS
// ---------------------------------------------------------------------------
//
// An agreement is always an agreement OF something. A screen listing agreements
// on their own would make the reader hold a country in their head while reading
// a percentage; here the administration is the row and the agreement is under
// it, which is also the order the two acts happen in.
//
// ---------------------------------------------------------------------------
// TWO ACTS, AND THE SECOND IS NOT THE RECTOR'S
// ---------------------------------------------------------------------------
//
// Drafting records what was agreed. Approving starts money moving. The Rector
// of the administration being paid cannot do the second — refused by 098 in the
// database and said in a sentence by the route, because an officer told
// `check_violation` on `an_agreement_is_not_approved_by_its_rector` learns
// nothing.
// ---------------------------------------------------------------------------

import React from 'react';
import { Handshake, Check, X, RefreshCw, FilePlus2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, EmptyState, Skeleton } from '@/components/ui/portal';
import { BTN_PRIMARY, BTN_SECONDARY, FOCUS } from '@/lib/portalTheme';

interface Agreement {
  id: string;
  administration_id: string;
  reference: string;
  tuition_share_percent: number | null;
  effective_from: string | null;
  effective_to: string | null;
  status: string;
  note: string | null;
}

// eslint-disable-next-line max-len
const COLUMNS = 'id, administration_id, reference, tuition_share_percent, effective_from, effective_to, status, note';

const INPUT = 'w-full rounded-lg border border-[#ded6c8] bg-white px-3 py-2 text-sm '
  + 'text-[#422e59] placeholder:text-[#a49bb0] dark:border-[#3d3349] dark:bg-[#231c2b] '
  + `dark:text-[#e4dcf0] ${FOCUS}`;
const LABEL = 'mb-1 block text-xs uppercase tracking-wide text-[#a49bb0]';

const STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-[#fdf3e0] text-[#a86a12]' },
  in_force: { label: 'In force', className: 'bg-[#e7f5ed] text-[#1f7a4d]' },
  ended: { label: 'Ended', className: 'bg-[#f8f6fb] text-[#5c5366]' },
};

const when = (iso: string | null) => (iso
  ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—');

async function post(body: Record<string, unknown>) {
  const { data: session } = await supabase.auth.getSession();
  const res = await fetch('/api/national/agreement', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session?.session?.access_token ?? ''}`,
    },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{ ok: boolean; error?: string; detail?: string; next?: string }>;
}

export default function RevenueAgreements({
  administrationId, country,
}: { administrationId: string; country: string }) {
  const [rows, setRows] = React.useState<Agreement[] | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [drafting, setDrafting] = React.useState(false);
  const [form, setForm] = React.useState({
    reference: '', tuitionSharePercent: '', effectiveFrom: '', effectiveTo: '', note: '',
  });
  const [endNote, setEndNote] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    setRows(null);
    const { data } = await supabase
      .from('national_revenue_agreements')
      .select(COLUMNS)
      .eq('administration_id', administrationId)
      .order('effective_from', { ascending: false });
    setRows((data ?? []) as Agreement[]);
  }, [administrationId]);

  React.useEffect(() => { void load(); }, [load]);

  async function submit() {
    setBusy(true); setNote(null);
    const r = await post({
      action: 'draft',
      administrationId,
      ...form,
      tuitionSharePercent: Number(form.tuitionSharePercent),
    });
    setBusy(false);
    setNote(r.ok ? (r.next ?? 'Recorded.') : (r.detail ?? r.error ?? 'It was not recorded.'));
    if (r.ok) {
      setForm({
        reference: '', tuitionSharePercent: '', effectiveFrom: '', effectiveTo: '', note: '',
      });
      setDrafting(false);
      await load();
    }
  }

  async function decide(id: string, action: 'approve' | 'end') {
    setBusy(true); setNote(null);
    const r = await post({ action, id, note: endNote[id] ?? '' });
    setBusy(false);
    setNote(r.ok ? (r.next ?? 'Recorded.') : (r.detail ?? r.error ?? 'It was not recorded.'));
    if (r.ok) await load();
  }

  const inForce = (rows ?? []).find((r) => r.status === 'in_force');

  return (
    <Card>
      <CardHeader
        title="Revenue agreement"
        subtitle={inForce
          ? `${country} retains ${inForce.tuition_share_percent}% of tuition under ${inForce.reference}`
          : `${country} operates under no agreement — every payment stays with the centre`}
        action={(
          <div className="flex gap-2">
            <button type="button" className={BTN_SECONDARY} onClick={() => void load()}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button type="button" className={BTN_SECONDARY} onClick={() => setDrafting((d) => !d)}>
              <FilePlus2 size={14} /> Record an agreement
            </button>
          </div>
        )}
      />

      <div className="space-y-4 p-5">
        {note && (
          <p className="rounded-lg border border-[#ded6c8] bg-[#f8f6fb] px-3 py-2 text-sm text-[#422e59] dark:border-[#3d3349] dark:bg-[#2a2233] dark:text-[#e4dcf0]">
            {note}
          </p>
        )}

        {drafting && (
          <div className="space-y-3 rounded-lg border border-[#ded6c8] p-4 dark:border-[#3d3349]">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="ag-ref">Agreement reference</label>
                <input
                  id="ag-ref" className={INPUT} value={form.reference}
                  placeholder="The reference on the signed document"
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="ag-share">Tuition share retained (%)</label>
                <input
                  id="ag-share" className={INPUT} value={form.tuitionSharePercent}
                  inputMode="decimal" placeholder="e.g. 50"
                  onChange={(e) => setForm({ ...form, tuitionSharePercent: e.target.value })}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="ag-from">From</label>
                <input
                  id="ag-from" type="date" className={INPUT} value={form.effectiveFrom}
                  onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="ag-to">Until (optional)</label>
                <input
                  id="ag-to" type="date" className={INPUT} value={form.effectiveTo}
                  onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })}
                />
              </div>
            </div>
            {/* SAID ON THE FORM, not discovered afterwards. Registration money
                is never shared whatever this percentage says — 098 allocates it
                to the centre and a 70% agreement does not touch it. */}
            <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
              This share applies to <strong>tuition only</strong>. Registration money is never
              shared and stays whole with the centre, whatever an agreement says. Nothing moves
              until the agreement is approved into force.
            </p>
            <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => void submit()}>
              <Handshake size={14} /> Record as a draft
            </button>
          </div>
        )}

        {rows === null && <Skeleton className="h-4 w-2/3" />}

        {rows?.length === 0 && !drafting && (
          <EmptyState
            icon={<Handshake size={20} />}
            title="No agreement has been recorded"
            description="Until one is in force, every payment this administration brings in stays whole with the centre and its purse is nil — so no national expenditure can be authorised either."
          />
        )}

        {rows && rows.length > 0 && (
          <ul className="divide-y divide-[#ece7f3] dark:divide-[#332b3d]">
            {rows.map((r) => (
              <li key={r.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-medium text-[#422e59] dark:text-[#e4dcf0]">
                      {r.reference}
                      <span className="ml-2 font-normal text-[#6b6076] dark:text-[#9c93ad]">
                        {r.tuition_share_percent}% of tuition
                      </span>
                    </p>
                    <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
                      {when(r.effective_from)}
                      {r.effective_to ? ` — ${when(r.effective_to)}` : ' onward'}
                    </p>
                  </div>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[r.status]?.className ?? ''}`}>
                    {STATUS[r.status]?.label ?? r.status}
                  </span>
                </div>

                {r.note && (
                  <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">{r.note}</p>
                )}

                {r.status === 'draft' && (
                  <button
                    type="button" className={BTN_PRIMARY} disabled={busy}
                    onClick={() => void decide(r.id, 'approve')}
                  >
                    <Check size={14} /> Approve into force
                  </button>
                )}

                {r.status === 'in_force' && (
                  <div className="space-y-2">
                    <input
                      className={INPUT}
                      placeholder="Required to end it: why the agreement is ending."
                      value={endNote[r.id] ?? ''}
                      onChange={(e) => setEndNote({ ...endNote, [r.id]: e.target.value })}
                    />
                    <button
                      type="button" className={BTN_SECONDARY} disabled={busy}
                      onClick={() => void decide(r.id, 'end')}
                    >
                      <X size={14} /> End it
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
          An agreement cannot be approved by the Rector of the administration it pays, and an
          administration operates under one agreement at a time. Both are refused by the
          database, not only here.
        </p>
      </div>
    </Card>
  );
}
