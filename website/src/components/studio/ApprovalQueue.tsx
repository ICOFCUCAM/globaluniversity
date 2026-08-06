'use client';

// ---------------------------------------------------------------------------
// What is waiting for this office to sign.
//
// The approval chain existed as a migration and two routes and nothing else. A
// Registrar had no way to see that a design was waiting for them, no way to
// read it, and no way to sign it — so the governance was real in the database
// and invisible to the three people it was built for, which in practice means a
// design would sit unpublished until somebody asked why.
//
// TWO AUDIENCES, ONE SCREEN.
//
//   An approving office sees what is waiting for it and signs or refuses.
//   The Superadministrator sees the state of every submission and publishes the
//   ones that have cleared.
//
// Which of the two you are is read from your role, not chosen — an approver
// cannot see a publish button and the designer cannot see an approve button,
// because the whole point of the chain is that those are different people.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { withDefaults, type CredentialDesign, type CredentialKind } from '@/lib/credentialTemplate';
import { Card, EmptyState } from '@/components/ui/portal';
import { BTN_SECONDARY, FOCUS, INPUT } from '@/lib/portalTheme';
import {
  Check, X, Loader2, ShieldCheck, Upload, Clock, Eye, ShieldAlert,
} from 'lucide-react';

const OFFICES = ['registrar', 'academic-office', 'vice-chancellor'] as const;
type Office = (typeof OFFICES)[number];

const OFFICE_LABEL: Record<Office, string> = {
  registrar: 'Registrar',
  'academic-office': 'Academic Office',
  'vice-chancellor': 'Vice Chancellor',
};

interface Submission {
  id: string;
  kind: CredentialKind;
  version: number;
  name: string;
  lifecycle: string;
  submitted_at: string | null;
  design: Partial<CredentialDesign>;
  approvals: { office: Office; decision: string; note: string | null; decided_at: string }[];
}

export default function ApprovalQueue({
  onPreview,
}: {
  /** Load a submitted design into the preview pane so it can be read before signing. */
  onPreview?: (kind: CredentialKind, design: CredentialDesign) => void;
}) {
  const { user } = useAuth();
  const role = user?.role ?? '';
  const myOffice = (OFFICES as readonly string[]).includes(role) ? (role as Office) : null;
  const canPublish = role === 'superadmin';

  const [rows, setRows] = useState<Submission[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('credential_templates')
      .select('id, kind, version, name, lifecycle, submitted_at, design, credential_template_approvals(office, decision, note, decided_at)')
      .in('lifecycle', ['submitted', 'approved'])
      .order('submitted_at', { ascending: true });
    if (error) {
      setMessage({ tone: 'bad', text: `The approval queue could not be loaded: ${error.message}` });
      setRows([]);
      return;
    }
    setRows(((data ?? []) as any[]).map((r) => ({
      ...r,
      approvals: r.credential_template_approvals ?? [],
    })));
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function send(templateId: string, body: Record<string, unknown>, verb: string) {
    setBusy(templateId);
    setMessage(null);
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) {
      setMessage({ tone: 'bad', text: 'Your session has expired. Sign in again.' });
      setBusy(null);
      return;
    }
    const res = await fetch('/api/admin/credential-template', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ templateId, ...body }),
    }).then((r) => r.json()).catch(() => null);
    setBusy(null);

    if (!res?.ok) {
      // The database's own message names which offices are still outstanding,
      // which is exactly what the desk needs to read — so it is passed through
      // rather than replaced with something friendlier and less useful.
      setMessage({ tone: 'bad', text: res?.detail ?? res?.error ?? `The ${verb} was refused.` });
      return;
    }
    setMessage({
      tone: 'ok',
      text: body.publish
        ? 'Published. Every credential issued from now on prints under this design; nothing already issued changes.'
        : `Recorded. ${res.outstanding} of 3 offices still to sign.`,
    });
    void load();
  }

  if (!myOffice && !canPublish) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5">
        <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
        <div>
          <p className="font-semibold text-amber-900">Not an approving office</p>
          <p className="mt-1 text-sm leading-relaxed text-amber-800">
            A credential design is approved by the Registrar, the Academic Office and the Vice
            Chancellor, and published by the Superadministrator. This account holds none of those.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#ded6c8] bg-white p-4 dark:border-[#3d3349] dark:bg-[#241d30]">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[#33234a] dark:text-[#e4dcf0]">
          <ShieldCheck size={15} /> Senate approval
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
          A design is submitted by the Superadministrator, approved by the Registrar, the Academic
          Office and the Vice Chancellor, and then published. The database refuses publication until
          all three have signed — this screen is where they do it.
          {myOffice && <> You are signing as the <strong>{OFFICE_LABEL[myOffice]}</strong>.</>}
        </p>
      </div>

      {message && (
        <div className={`rounded-xl border p-3 text-sm ${
          message.tone === 'ok'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {rows === null ? (
        <p className="text-sm text-[#a49bb0]">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Clock size={20} />}
          title="Nothing awaiting approval"
          description="A design appears here once the Superadministrator submits it. Until then the design currently in force stays in force."
        />
      ) : (
        rows.map((r) => {
          const mine = myOffice ? r.approvals.find((a) => a.office === myOffice) : undefined;
          const approvals = r.approvals.filter((a) => a.decision === 'approved');
          const rejected = r.approvals.find((a) => a.decision === 'rejected');
          const cleared = approvals.length === 3 && !rejected;

          return (
            <Card key={r.id}>
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a6d1f]">
                      {r.kind} · v{r.version}
                    </p>
                    <h4 className="mt-0.5 font-heading text-base font-bold text-[#33234a] dark:text-[#e4dcf0]">
                      {r.name}
                    </h4>
                    <p className="text-xs text-[#a49bb0]">
                      Submitted {r.submitted_at ? new Date(r.submitted_at).toLocaleString('en-GB') : '—'}
                    </p>
                  </div>
                  {onPreview && (
                    <button
                      onClick={() => onPreview(r.kind, withDefaults(r.kind, r.design))}
                      className={BTN_SECONDARY}
                    >
                      <Eye size={14} /> Read it
                    </button>
                  )}
                </div>

                {/* Who has signed. Shown to everybody, because an approver
                    deciding whether to sign is entitled to know who already
                    has — and because a chain nobody can inspect is not
                    governance. */}
                <ul className="mt-4 space-y-1.5">
                  {OFFICES.map((office) => {
                    const a = r.approvals.find((x) => x.office === office);
                    return (
                      <li key={office} className="flex items-start gap-2.5 text-sm">
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          !a ? 'bg-[#f2eee6] text-[#a49bb0] dark:bg-[#2a2333]'
                            : a.decision === 'approved' ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-700'
                        }`}>
                          {!a ? <Clock size={11} /> : a.decision === 'approved' ? <Check size={12} /> : <X size={12} />}
                        </span>
                        <span className="min-w-0">
                          <span className="font-medium text-[#33234a] dark:text-[#e4dcf0]">
                            {OFFICE_LABEL[office]}
                          </span>
                          <span className="ml-2 text-[#6b6076] dark:text-[#9c93ad]">
                            {!a ? 'awaiting' : a.decision === 'approved' ? 'approved' : 'refused'}
                          </span>
                          {a?.note && (
                            <span className="block text-xs leading-relaxed text-[#6b6076] dark:text-[#9c93ad]">
                              “{a.note}”
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {rejected && (
                  <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    Refused by the {OFFICE_LABEL[rejected.office]}. This design cannot be published.
                    The Superadministrator must address the objection and submit a new version — an
                    approval cannot be edited, and a refusal cannot be overridden.
                  </p>
                )}

                {/* --- The approving office's own action ------------------ */}
                {myOffice && !mine && !rejected && (
                  <div className="mt-4 border-t border-[#f0ece4] pt-4 dark:border-[#2a2333]">
                    <label className="block text-xs font-medium text-[#6b6076] dark:text-[#9c93ad]">
                      Note (required to refuse)
                    </label>
                    <input
                      value={note[r.id] ?? ''}
                      onChange={(e) => setNote((n) => ({ ...n, [r.id]: e.target.value }))}
                      placeholder="Why, if you are refusing"
                      className={`${INPUT} mt-1.5`}
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => void send(r.id, { decision: 'approved', note: note[r.id] }, 'approval')}
                        disabled={busy === r.id}
                        className={`flex items-center gap-2 rounded-xl bg-[#422e59] px-5 py-2 text-sm font-semibold text-white hover:bg-[#322244] disabled:opacity-40 ${FOCUS}`}
                      >
                        {busy === r.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        Approve as {OFFICE_LABEL[myOffice]}
                      </button>
                      <button
                        onClick={() => void send(r.id, { decision: 'rejected', note: note[r.id] }, 'refusal')}
                        disabled={busy === r.id || !(note[r.id] ?? '').trim()}
                        title={!(note[r.id] ?? '').trim() ? 'A refusal must state its reason' : undefined}
                        className={`flex items-center gap-2 rounded-xl border border-red-300 px-5 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40 ${FOCUS}`}
                      >
                        <X size={14} /> Refuse
                      </button>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-[#a49bb0]">
                      A decision cannot be edited afterwards. A refusal must say why — the designer
                      cannot answer an objection they have not been told.
                    </p>
                  </div>
                )}

                {myOffice && mine && (
                  <p className="mt-3 text-xs text-[#a49bb0]">
                    You {mine.decision === 'approved' ? 'approved' : 'refused'} this on{' '}
                    {new Date(mine.decided_at).toLocaleString('en-GB')}. A decision cannot be changed.
                  </p>
                )}

                {/* --- Publishing ---------------------------------------- */}
                {canPublish && (
                  <div className="mt-4 border-t border-[#f0ece4] pt-4 dark:border-[#2a2333]">
                    <button
                      onClick={() => void send(r.id, { publish: true }, 'publication')}
                      disabled={busy === r.id || !cleared}
                      title={cleared ? undefined : 'All three offices must approve first'}
                      className={`flex items-center gap-2 rounded-xl bg-[#422e59] px-5 py-2 text-sm font-semibold text-white hover:bg-[#322244] disabled:opacity-40 ${FOCUS}`}
                    >
                      {busy === r.id ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      Publish
                    </button>
                    <p className="mt-2 text-xs leading-relaxed text-[#a49bb0]">
                      {cleared
                        ? 'All three offices have approved. Publishing makes this the design for credentials issued from now on; nothing already issued changes.'
                        : `${approvals.length} of 3 approvals. The database refuses publication until all three have signed.`}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
