'use client';

// ---------------------------------------------------------------------------
// REPLACEMENT CERTIFICATES.
//
//   "The system must never allow someone to simply generate unlimited copies.
//    Every reissue is recorded."
//
// Both ends again, and the same reason as TranscriptExceptions: the office
// that asks and the office that authorises are reading one list. What differs
// is the controls, which is one capability question asked once.
//
// ---------------------------------------------------------------------------
// ASKING IS NOT AUTHORISING, AND NEITHER IS SEEING THE DESIGN
// ---------------------------------------------------------------------------
//
// Three separate things, and they were nearly two. In an early draft of 101 the
// authorisation check and the design check were one function, so an officer
// expressly lent the certificate design under the ruling's §4 exception could
// also authorise a replacement certificate. The migration's own proof caught
// it. This screen keeps them apart by asking
// `authorise-certificate-reissue` — never `view-certificate-template`.
//
// NOTHING HERE DRAWS A CERTIFICATE. The list shows a reference, a holder and a
// reason; the document itself is the engine's, and the Registrar who requests
// a replacement never sees the design it will be made from.
// ---------------------------------------------------------------------------

import React from 'react';
import { Stamp, Check, X, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { can } from '@/lib/roles';
import { Card, CardHeader, EmptyState, Skeleton } from '@/components/ui/portal';
import { BTN_PRIMARY, BTN_SECONDARY, FOCUS } from '@/lib/portalTheme';

interface Row {
  id: string;
  original_credential: string;
  reason: string;
  detail: string;
  status: string;
  requested_role: string | null;
  requested_at: string | null;
  decision_note: string | null;
}

// eslint-disable-next-line max-len
const COLUMNS = 'id, original_credential, reason, detail, status, requested_role, requested_at, decision_note';

const INPUT = 'w-full rounded-lg border border-[#ded6c8] bg-white px-3 py-2 text-sm '
  + 'text-[#422e59] placeholder:text-[#a49bb0] dark:border-[#3d3349] dark:bg-[#231c2b] '
  + `dark:text-[#e4dcf0] ${FOCUS}`;

/** 101's vocabulary, in the University's own words. */
const REASONS: [string, string][] = [
  ['lost', 'Lost'],
  ['damaged', 'Damaged'],
  ['legal-name-change', 'Legal name change'],
  ['correction', 'Correction'],
];

const STATUS: Record<string, { label: string; className: string }> = {
  'awaiting-authorisation': { label: 'Awaiting authorisation', className: 'bg-[#fdf3e0] text-[#a86a12]' },
  authorised: { label: 'Authorised', className: 'bg-[#e7f5ed] text-[#1f7a4d]' },
  rejected: { label: 'Rejected', className: 'bg-[#fdeaee] text-[#a3283f]' },
  spent: { label: 'Replacement issued', className: 'bg-[#f8f6fb] text-[#5c5366]' },
};

async function post(body: Record<string, unknown>) {
  const { data: session } = await supabase.auth.getSession();
  const res = await fetch('/api/certificate/reissue', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session?.session?.access_token ?? ''}`,
    },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{ ok: boolean; error?: string; detail?: string; next?: string }>;
}

export default function CertificateReissue({ original }: { original?: string }) {
  const { user } = useAuth();
  const mayAuthorise = can(user?.role, 'authorise-certificate-reissue');
  const mayAsk = can(user?.role, 'issue-credential');

  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [reason, setReason] = React.useState('lost');
  const [detail, setDetail] = React.useState('');
  const [notes, setNotes] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    setRows(null);
    const { data } = await supabase
      .from('certificate_reissue_requests')
      .select(COLUMNS)
      .order('requested_at', { ascending: false })
      .limit(200);
    setRows((data ?? []) as Row[]);
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function ask() {
    setBusy(true); setNote(null);
    const r = await post({ action: 'request', original, reason, detail });
    setBusy(false);
    setNote(r.ok ? 'Sent for authorisation.' : (r.detail ?? r.error ?? 'It was not recorded.'));
    if (r.ok) { setDetail(''); await load(); }
  }

  async function decide(id: string, action: 'authorise' | 'reject') {
    setBusy(true); setNote(null);
    const r = await post({ action, id, note: notes[id] ?? '' });
    setBusy(false);
    setNote(r.ok ? (r.next ?? 'Recorded.') : (r.detail ?? r.error ?? 'It was not recorded.'));
    if (r.ok) await load();
  }

  const waiting = (rows ?? []).filter((r) => r.status === 'awaiting-authorisation');

  return (
    <div className="space-y-5">
      {note && (
        <p className="rounded-lg border border-[#ded6c8] bg-[#f8f6fb] px-3 py-2 text-sm text-[#422e59] dark:border-[#3d3349] dark:bg-[#2a2233] dark:text-[#e4dcf0]">
          {note}
        </p>
      )}

      {/* The form only appears against a certificate, because a replacement
          for nothing in particular is not a request the University can act
          on — 101 refuses one without the register row it replaces. */}
      {mayAsk && original && (
        <Card>
          <CardHeader
            title="Ask for a replacement certificate"
            subtitle="One authorisation permits one replacement"
          />
          <div className="space-y-3 p-5">
            <div className="flex flex-wrap gap-2">
              {REASONS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setReason(value)}
                  className={`rounded-full border px-3 py-1 text-sm ${FOCUS} ${
                    reason === value
                      ? 'border-[#422e59] bg-[#422e59] text-white'
                      : 'border-[#ded6c8] text-[#6b6076] dark:border-[#3d3349] dark:text-[#9c93ad]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <textarea
              className={`${INPUT} min-h-[80px]`}
              placeholder="What happened, and what the graduate has provided."
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
            <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => void ask()}>
              <Stamp size={14} /> Send for authorisation
            </button>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Replacement certificates"
          subtitle={mayAuthorise
            ? `${waiting.length} awaiting your authorisation`
            : 'What has been asked for, and what was decided'}
          action={(
            <button type="button" className={BTN_SECONDARY} onClick={() => void load()}>
              <RefreshCw size={14} /> Refresh
            </button>
          )}
        />

        {rows === null && (
          <div className="space-y-2 p-5"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>
        )}

        {rows?.length === 0 && (
          <EmptyState
            icon={<Stamp size={20} />}
            title="No replacement has been asked for"
            description="A replacement certificate needs a reason and an authorisation, and one authorisation permits exactly one."
          />
        )}

        {rows && rows.length > 0 && (
          <ul className="divide-y divide-[#ece7f3] dark:divide-[#332b3d]">
            {rows.map((r) => (
              <li key={r.id} className="space-y-3 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium capitalize text-[#422e59] dark:text-[#e4dcf0]">
                    {r.reason.replace(/-/g, ' ')}
                  </p>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[r.status]?.className ?? ''}`}>
                    {STATUS[r.status]?.label ?? r.status}
                  </span>
                </div>
                <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">{r.detail}</p>
                {r.decision_note && (
                  <p className="rounded-lg border border-[#ded6c8] bg-[#f8f6fb] px-3 py-2 text-sm text-[#422e59] dark:border-[#3d3349] dark:bg-[#2a2233] dark:text-[#e4dcf0]">
                    {r.decision_note}
                  </p>
                )}

                {mayAuthorise && r.status === 'awaiting-authorisation' && (
                  <div className="space-y-2">
                    <textarea
                      className={`${INPUT} min-h-[56px]`}
                      placeholder="Required to reject: what the officer should tell the graduate."
                      value={notes[r.id] ?? ''}
                      onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button" className={BTN_PRIMARY} disabled={busy}
                        onClick={() => void decide(r.id, 'authorise')}
                      >
                        <Check size={14} /> Authorise
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
