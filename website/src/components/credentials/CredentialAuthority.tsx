'use client';

// ---------------------------------------------------------------------------
// THE CREDENTIAL & CERTIFICATE AUTHORITY.
//
// The register of everything this University has issued, and the only place a
// sealed document can be corrected.
//
//   "He is more of the VC of the university."
//
// ---------------------------------------------------------------------------
// WHY THERE IS NO EDIT BUTTON, ON A SCREEN BUILT TO SATISFY A REQUEST FOR ONE
// ---------------------------------------------------------------------------
//
// The University asked for the privilege to EDIT any version of a certificate.
// The button here says CORRECT, and pressing it issues version 2 rather than
// changing version 1.
//
// That is the request, not a refusal of it. An issued certificate is a
// statement the University made on a date, sealed with a hash that /verify
// checks. Editing the row would change what the University appears to have said
// in 2024, break every printed copy in circulation, and leave no trace that a
// correction happened. The graduate would get a right-looking document and the
// institution would lose the ability to explain itself to an accreditor.
//
// So: version 1 becomes Superseded, version 2 becomes Current, both stay on the
// register, the reason is required, and the trail is append-only. The graduate
// gets a corrected certificate and the University keeps a record it can defend.
// Nobody has to choose.
//
// ---------------------------------------------------------------------------
// WHO SEES WHAT
// ---------------------------------------------------------------------------
//
// One screen, three different halves of it, decided by `actionsFor` rather than
// by this component's own opinion:
//
//   The Authority (Superadministrator / Vice-Chancellor) — correct, revoke,
//   print, email, and the correction queue.
//   The Registrar — print and email. The register is theirs to work from; the
//   power to alter a sealed document is not.
//   Everyone else — view and verify.
//
// A button that is absent is courtesy. The control is /api/credential/amend,
// which checks the capability, and the register's own triggers, which refuse an
// UPDATE to a sealed field no matter who is asking.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { runQuery } from '@/lib/runQuery';
import { can } from '@/lib/roles';
import type { UserRole } from '@/lib/types';
import {
  actionsFor, describeEvent, CATEGORY_PROFILES, CREDENTIAL_CATEGORIES,
  problemsWithType, movesFor, canMove,
  type CredentialVersion, type CredentialCategory, type AuditEvent,
  type CorrectionState,
} from '@/lib/credentialAuthority';
import { PageHeader } from '@/components/ui/portal';
import {
  Loader2, Search, AlertTriangle, History, ShieldCheck, Printer, Mail,
  FileWarning, Plus, ChevronRight, XCircle, CheckCircle2, Inbox, BadgeCheck,
} from 'lucide-react';

interface Row {
  id: string;
  credentialRef: string;
  version: number;
  supersedesId: string | null;
  kind: string;
  holderName: string;
  award: string | null;
  classification: string | null;
  programme: string | null;
  status: string;
  issuedAt: string;
  contentHash: string;
}

interface CorrectionRow {
  id: string;
  credentialId: string;
  description: string;
  proposed: Record<string, string>;
  status: CorrectionState;
  createdAt: string;
}

type Tab = 'register' | 'corrections' | 'types' | 'trail';

export default function CredentialAuthority(
  { role, embedded }: { role?: UserRole; embedded?: boolean },
) {
  const [tab, setTab] = useState<Tab>('register');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [corrections, setCorrections] = useState<CorrectionRow[]>([]);
  const [trail, setTrail] = useState<AuditEvent[]>([]);
  const [notReady, setNotReady] = useState<string | null>(null);
  /** A failure of the correction or audit read, which used to be swallowed. */
  const [secondaryError, setSecondaryError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const isAuthority = can(role, 'amend-issued-credential');

  const load = useCallback(async () => {
    const { data, error } = await runQuery(supabase
      .from('credentials_issued')
      .select('id, credential_id, version, supersedes_id, kind, holder_name, award, classification, programme, status, issued_at, content_hash')
      .order('issued_at', { ascending: false })
      .limit(400));

    if (error) {
      setNotReady(
        error.message.includes('version')
          ? 'The register has no version column. Run docs/migrations/013_social_and_credential_authority.sql.'
          : error.message,
      );
      setRows([]);
      return;
    }
    setNotReady(null);
    setRows((data ?? []).map((r: Record<string, any>) => ({
      id: String(r.id),
      credentialRef: r.credential_id,
      version: r.version ?? 1,
      supersedesId: r.supersedes_id ?? null,
      kind: r.kind,
      holderName: r.holder_name,
      award: r.award,
      classification: r.classification,
      programme: r.programme,
      status: r.status,
      issuedAt: r.issued_at,
      contentHash: r.content_hash,
    })));

    const [c, t] = await Promise.all([
      supabase.from('credential_correction_requests')
        .select('id, credential_id, description, proposed, status, created_at')
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('credential_audit_events')
        .select('id, credential_ref, action, from_version, to_version, reason, actor_role, actor_email, occurred_at')
        .order('occurred_at', { ascending: false }).limit(80),
    ]);

    // THESE TWO ERRORS WERE DISCARDED, and the panes below say "No correction
    // request is waiting" and "Nothing has been recorded yet" from an empty
    // array. So a failed read — a missing table, a policy that does not admit
    // this role, a dropped connection — was reported to the Authority as a
    // clean sheet.
    //
    // On the audit trail that is the worst possible failure mode. The pane
    // exists to answer "what was done to this credential", and answering
    // "nothing" when the truth is "the trail could not be read" is how an
    // amendment goes unnoticed. Empty and unreadable are different states and
    // the screen now distinguishes them.
    const failures = [
      c.error ? `correction requests (${c.error.message})` : null,
      t.error ? `the credential audit trail (${t.error.message})` : null,
    ].filter(Boolean);
    setSecondaryError(
      failures.length > 0
        ? `Could not read ${failures.join(' or ')}. `
          + 'The panes below are not empty — they are unread, and nothing in them should be '
          + 'taken as a statement that no action was recorded.'
        : null,
    );

    setCorrections((c.data ?? []).map((r: Record<string, any>) => ({
      id: String(r.id),
      credentialId: r.credential_id,
      description: r.description,
      proposed: r.proposed ?? {},
      status: r.status,
      createdAt: r.created_at,
    })));

    setTrail((t.data ?? []).map((r: Record<string, any>) => ({
      id: String(r.id),
      credentialRef: r.credential_ref,
      action: r.action,
      fromVersion: r.from_version,
      toVersion: r.to_version,
      reason: r.reason,
      actorRole: r.actor_role,
      actorEmail: r.actor_email,
      occurredAt: r.occurred_at,
    })));
  }, []);

  useEffect(() => { void load(); }, [load]);

  /**
   * Group the flat register into awards.
   *
   * ONE ENTRY PER AWARD, NOT PER DOCUMENT. A corrected certificate is two rows
   * in the register and one thing in the world, and a list that showed both
   * would have a graduate appearing twice with two different spellings of their
   * name — which looks exactly like the University issuing a duplicate.
   */
  const awards = useMemo(() => {
    const byRef = new Map<string, Row[]>();
    for (const r of rows ?? []) {
      const list = byRef.get(r.credentialRef) ?? [];
      list.push(r);
      byRef.set(r.credentialRef, list);
    }
    const out = Array.from(byRef.entries()).map(([ref, versions]) => ({
      ref,
      versions: versions.sort((a, b) => b.version - a.version),
      current: versions.find((v) => v.status !== 'replaced') ?? versions[0],
    }));

    const q = query.trim().toLowerCase();
    if (!q) return out;
    return out.filter((a) =>
      a.ref.toLowerCase().includes(q)
      || a.current.holderName.toLowerCase().includes(q)
      || (a.current.award ?? '').toLowerCase().includes(q));
  }, [rows, query]);

  const chosen = useMemo(
    () => awards.find((a) => a.ref === selected) ?? null,
    [awards, selected],
  );

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode; count?: number }> = [
    { id: 'register', label: 'Register', icon: <BadgeCheck size={15} />, count: notReady ? undefined : awards.length },
    ...(isAuthority ? [{
      id: 'corrections' as Tab,
      label: 'Correction requests',
      icon: <Inbox size={15} />,
      count: corrections.filter((c) => !['approved', 'rejected', 'withdrawn'].includes(c.status)).length,
    }] : []),
    ...(can(role, 'create-credential-type')
      ? [{ id: 'types' as Tab, label: 'Kinds of credential', icon: <Plus size={15} /> }] : []),
    { id: 'trail', label: 'Audit', icon: <History size={15} /> },
  ];

  return (
    <div className={embedded ? 'space-y-5' : 'mx-auto max-w-6xl space-y-5'}>
      {/* SUPPRESSED WHEN EMBEDDED. The workspace above already carries the
          title and this exact sentence; rendering both printed the same line
          twice, four lines apart, under two different headings. */}
      {!embedded && (
        <PageHeader
          title="Credential authority"
          subtitle="Everything the University has issued. Corrections supersede; nothing is overwritten."
        />
      )}

      {notReady && (
        <div className="flex items-start gap-3 rounded-xl border border-[#e9c14a]/40 bg-[#e9c14a]/10 p-4 text-sm">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-[#a07c12]" />
          <span className="text-[#6b6076] dark:text-[#9c93ad]">{notReady}</span>
        </div>
      )}

      {secondaryError && (
        <div className="flex items-start gap-3 rounded-xl border border-[#e9c14a]/40 bg-[#e9c14a]/10 p-4 text-sm">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-[#a07c12]" />
          <span className="text-[#6b6076] dark:text-[#9c93ad]">{secondaryError}</span>
        </div>
      )}

      {message && (
        <div
          role="status"
          className={`flex items-start gap-3 rounded-xl p-4 text-sm ${
            message.tone === 'ok'
              ? 'border border-emerald-600/30 bg-emerald-600/10 text-emerald-900 dark:text-emerald-200'
              : 'border border-red-600/30 bg-red-600/10 text-red-900 dark:text-red-200'
          }`}
        >
          {message.tone === 'ok' ? <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" />
            : <XCircle size={18} className="mt-0.5 flex-shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <nav className="flex flex-wrap gap-1 border-b border-[#ece7de] dark:border-[#2e2637]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm ${
              tab === t.id
                ? 'border-[#422e59] font-semibold text-[#422e59] dark:text-[#e4dcf0]'
                : 'border-transparent text-[#6b6076] dark:text-[#9c93ad]'
            }`}
          >
            {t.icon}{t.label}
            {t.count != null && t.count > 0 && (
              <span className="rounded-full bg-[#422e59]/12 px-1.5 text-xs text-[#422e59] dark:text-[#c5a55a]">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* ------------------------------------------------------------------ */}
      {tab === 'register' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <section>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9c93ad]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, award or credential number"
                className="w-full rounded-xl border border-[#ece7de] bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#422e59] dark:border-[#2e2637] dark:bg-[#1f1a27] dark:text-[#e4dcf0]"
              />
            </div>

            {rows === null ? (
              <Loader2 size={18} className="mt-6 animate-spin text-[#9c93ad]" />
            ) : awards.length === 0 ? (
              <p className="mt-6 text-sm text-[#6b6076] dark:text-[#9c93ad]">
                {/* AN EMPTY LIST AFTER A FAILED READ IS A LIE. "The University
                    has not issued any credential yet" is a statement about the
                    register; "I could not read it" is a statement about the
                    connection, and a registrar needs to know which. */}
                {notReady
                  ? 'The register could not be read, so this is not a statement that it is empty.'
                  : query
                    ? 'Nothing on the register matches that.'
                    : 'The University has not issued any credential yet.'}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {awards.map((a) => (
                  <li key={a.ref}>
                    <button
                      type="button"
                      onClick={() => setSelected(a.ref)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${
                        selected === a.ref
                          ? 'border-[#422e59] bg-[#faf6ee] dark:bg-[#2a2333]'
                          : 'border-[#ece7de] bg-white dark:border-[#2e2637] dark:bg-[#1f1a27]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#422e59] dark:text-[#e4dcf0]">
                          {a.current.holderName}
                        </p>
                        <p className="truncate text-xs text-[#6b6076] dark:text-[#9c93ad]">
                          {a.current.award ?? a.current.kind} · {a.ref}
                        </p>
                      </div>
                      <StatusPill row={a.current} versions={a.versions.length} />
                      <ChevronRight size={15} className="flex-shrink-0 text-[#9c93ad]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside>
            {chosen ? (
              <AwardPanel
                award={chosen}
                role={role}
                onDone={(text) => { setMessage({ tone: 'ok', text }); void load(); }}
                onError={(text) => setMessage({ tone: 'bad', text })}
              />
            ) : (
              <p className="rounded-xl border border-dashed border-[#ece7de] p-6 text-center text-sm text-[#6b6076] dark:border-[#2e2637] dark:text-[#9c93ad]">
                Choose a credential to see its history and what may be done with it.
              </p>
            )}
          </aside>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {tab === 'corrections' && (
        <CorrectionQueue
          requests={corrections}
          rows={rows ?? []}
          role={role}
          onDone={(text) => { setMessage({ tone: 'ok', text }); void load(); }}
          onError={(text) => setMessage({ tone: 'bad', text })}
        />
      )}

      {tab === 'types' && (
        <CredentialTypes
          onDone={(text) => { setMessage({ tone: 'ok', text }); void load(); }}
          onError={(text) => setMessage({ tone: 'bad', text })}
        />
      )}

      {tab === 'trail' && <AuditTrail events={trail} />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function StatusPill({ row, versions }: { row: Row; versions: number }) {
  const tone = row.status === 'revoked'
    ? 'bg-red-600/10 text-red-700 dark:text-red-300'
    : row.status === 'replaced'
      ? 'bg-[#e9c14a]/15 text-[#8a6a10]'
      : 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-300';

  const label = row.status === 'revoked' ? 'Revoked'
    : row.status === 'replaced' ? 'Superseded'
      : versions > 1 ? `Current · v${row.version}` : 'Current';

  return <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{label}</span>;
}

// ---------------------------------------------------------------------------

/**
 * One award: its whole history, and the actions available on it.
 *
 * THE HISTORY IS ALWAYS SHOWN, EVEN WHEN THERE IS ONLY ONE VERSION. A panel
 * that grows a "history" section only after the first correction teaches
 * everybody that history is the exception. It is the record; the single-version
 * case is just a short one.
 */
function AwardPanel({
  award, role, onDone, onError,
}: {
  award: { ref: string; versions: Row[]; current: Row };
  role?: UserRole;
  onDone: (t: string) => void;
  onError: (t: string) => void;
}) {
  const [correcting, setCorrecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});

  const current = award.current;
  const version: CredentialVersion = {
    id: current.id,
    credentialRef: current.credentialRef,
    version: current.version,
    state: current.status === 'revoked' ? 'revoked' : current.status === 'replaced' ? 'superseded' : 'current',
    issuedAt: current.issuedAt,
  };
  const actions = actionsFor(version, role ?? 'student');

  /**
   * Print or email, through the server.
   *
   * NOT window.print(). Producing a copy of a sealed credential is on the
   * University's own list of privileges and must be recorded — a browser print
   * dialogue leaves no trace anywhere. The server writes the audit entry, then
   * returns the document, and the browser prints what it is given.
   */
  async function deliver(action: 'print' | 'email') {
    setBusy(true);
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch('/api/credential/deliver', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ credentialId: current.id, action }),
    });
    const out = await res.json().catch(() => ({ ok: false, error: 'no-reply' }));
    setBusy(false);

    if (!out.ok) { onError(out.detail ?? out.error ?? 'That did not work.'); return; }

    if (action === 'print' && out.html) {
      // A NEW WINDOW, NOT AN IFRAME OR A DATA URL. The document sets @page for
      // A4 landscape, and printing it inside this page would inherit the
      // portal's own print rules — producing a certificate with the sidebar
      // down one side of it.
      const w = window.open('', '_blank');
      if (!w) {
        onError('The browser blocked the print window. Allow pop-ups for this site and try again.');
        return;
      }
      w.document.write(out.html);
      w.document.close();
      // Wait for the QR and fonts to settle before the dialogue opens; printing
      // too early produces a certificate with a blank square where the
      // verification code should be.
      w.addEventListener('load', () => w.print());
      onDone(out.message ?? 'Sent to the printer, and recorded.');
      return;
    }

    onDone(out.message ?? 'Done.');
  }

  async function submit() {
    setBusy(true);
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch('/api/credential/amend', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ credentialId: current.id, changes: fields, reason }),
    });
    const out = await res.json().catch(() => ({ ok: false, error: 'no-reply' }));
    setBusy(false);

    if (!out.ok) { onError(out.detail ?? out.error ?? 'The correction was not made.'); return; }
    setCorrecting(false); setReason(''); setFields({});
    onDone(out.message);
  }

  return (
    <div className="space-y-4 rounded-xl border border-[#ece7de] bg-white p-5 dark:border-[#2e2637] dark:bg-[#1f1a27]">
      <div>
        <p className="font-heading font-bold text-lg text-[#422e59] dark:text-[#e4dcf0]">{current.holderName}</p>
        <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">{current.award ?? current.kind}</p>
        {current.classification && (
          <p className="text-sm text-[#6b6076] dark:text-[#9c93ad]">{current.classification}</p>
        )}
        <p className="mt-1 font-mono text-xs text-[#9c93ad]">{award.ref}</p>
      </div>

      {/* THE HISTORY. Point 4's picture, drawn from the register. */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#9c93ad]">History</h3>
        <ol className="mt-2 space-y-2">
          {award.versions.map((v) => (
            <li key={v.id} className="flex items-baseline gap-2 text-xs">
              <span className={`rounded px-1.5 py-0.5 font-medium ${
                v.status === 'replaced'
                  ? 'bg-[#e9c14a]/15 text-[#8a6a10]'
                  : v.status === 'revoked'
                    ? 'bg-red-600/10 text-red-700 dark:text-red-300'
                    : 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-300'
              }`}>
                Version {v.version}
              </span>
              <span className="text-[#6b6076] dark:text-[#9c93ad]">
                {v.status === 'replaced' ? 'Superseded' : v.status === 'revoked' ? 'Revoked' : 'Current'}
                {' · '}{new Date(v.issuedAt).toLocaleDateString('en-GB')}
              </span>
            </li>
          ))}
        </ol>
        {award.versions.length > 1 && (
          <p className="mt-2 text-xs text-[#6b6076] dark:text-[#9c93ad]">
            A scan of any earlier version reports the correction and points to the current one.
            The award itself is unaffected.
          </p>
        )}
      </div>

      {/* ACTIONS. Drawn from actionsFor, not from this component's opinion. */}
      <div className="flex flex-wrap gap-2 border-t border-[#ece7de] pt-4 dark:border-[#2e2637]">
        {actions.includes('amend') && (
          <button
            type="button"
            onClick={() => setCorrecting((c) => !c)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#c5a55a]/60 px-3 py-1.5 text-xs font-semibold text-[#422e59] dark:text-[#c5a55a]"
          >
            <FileWarning size={13} /> Correct
          </button>
        )}
        {actions.includes('print') && (
          <button
            type="button"
            onClick={() => void deliver('print')}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#ece7de] px-3 py-1.5 text-xs text-[#6b6076] disabled:opacity-40 dark:border-[#2e2637] dark:text-[#9c93ad]"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />} Print
          </button>
        )}
        {actions.includes('email') && (
          <button
            type="button"
            onClick={() => void deliver('email')}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#ece7de] px-3 py-1.5 text-xs text-[#6b6076] disabled:opacity-40 dark:border-[#2e2637] dark:text-[#9c93ad]"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />} Email to student
          </button>
        )}
        <a
          href={`/verify?id=${encodeURIComponent(award.ref)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#ece7de] px-3 py-1.5 text-xs text-[#6b6076] dark:border-[#2e2637] dark:text-[#9c93ad]"
        >
          <ShieldCheck size={13} /> Verify as a stranger would
        </a>
      </div>

      {current.status === 'revoked' && (
        <p className="rounded-lg bg-red-600/5 p-3 text-xs text-[#6b6076] dark:text-[#9c93ad]">
          This credential is revoked. Revocation is final by design — restoring it would let the
          University quietly undo a withdrawal with nothing in the record. If it was revoked in
          error, issue a new award; both facts then stay visible.
        </p>
      )}

      {/* THE CORRECTION FORM. Every field prefilled with what the register
          actually says, so the Authority corrects rather than retypes. */}
      {correcting && (
        <div className="space-y-3 rounded-xl border border-[#c5a55a]/50 bg-[#faf6ee] dark:bg-[#2a2333] p-4">
          <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
            This issues <strong>version {current.version + 1}</strong>. Version {current.version} is
            kept, marked superseded, with its own seal intact.
          </p>

          {(['holder_name', 'award', 'classification', 'programme'] as const).map((f) => (
            <label key={f} className="block">
              <span className="text-xs font-medium text-[#422e59] dark:text-[#e4dcf0]">
                {f === 'holder_name' ? 'Name' : f === 'award' ? 'Award'
                  : f === 'classification' ? 'Classification' : 'Programme'}
              </span>
              <input
                value={fields[f] ?? (current[f === 'holder_name' ? 'holderName' : f] ?? '')}
                onChange={(e) => setFields((s) => ({ ...s, [f]: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#ece7de] bg-white p-2 text-sm dark:border-[#2e2637] dark:bg-[#241f2c] dark:text-[#e4dcf0]"
              />
            </label>
          ))}

          <label className="block">
            <span className="text-xs font-medium text-[#422e59] dark:text-[#e4dcf0]">
              Why — required, and permanent
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. Surname corrected following student request, birth certificate sighted."
              className="mt-1 w-full rounded-lg border border-[#ece7de] bg-white p-2 text-sm dark:border-[#2e2637] dark:bg-[#241f2c] dark:text-[#e4dcf0]"
            />
            <span className="mt-1 block text-xs text-[#9c93ad]">
              This goes on the permanent record and cannot be edited afterwards — by anyone,
              including you.
            </span>
          </label>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !reason.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#422e59] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-[#c5a55a] dark:text-[#241a30]"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Issue version {current.version + 1}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Correction requests from students.
 *
 * "Students should not directly edit their credentials." So a request is a
 * proposal, and the buttons on it come from `movesFor` — the state machine
 * decides what this role may do next, not this component.
 */
function CorrectionQueue({
  requests, rows, role, onDone, onError,
}: {
  requests: CorrectionRow[];
  rows: Row[];
  role?: UserRole;
  onDone: (t: string) => void;
  onError: (t: string) => void;
}) {
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function move(req: CorrectionRow, to: CorrectionState) {
    const check = canMove({ from: req.status, to, role: role ?? 'student', note: note[req.id] });
    if (!check.allowed) { onError(check.reason ?? 'That move is not allowed.'); return; }

    setBusy(req.id);
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch('/api/credential/correction', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ requestId: req.id, to, note: note[req.id] ?? '' }),
    });
    const out = await res.json().catch(() => ({ ok: false, error: 'no-reply' }));
    setBusy(null);
    if (!out.ok) { onError(out.detail ?? out.error ?? 'That did not work.'); return; }
    onDone(out.message ?? 'Updated.');
  }

  const open = requests.filter((r) => !['approved', 'rejected', 'withdrawn'].includes(r.status));

  if (open.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[#ece7de] p-8 text-center text-sm text-[#6b6076] dark:border-[#2e2637] dark:text-[#9c93ad]">
        No correction request is waiting.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {open.map((req) => {
        const target = rows.find((r) => r.id === req.credentialId);
        const moves = movesFor(req.status, role ?? 'student');
        return (
          <li key={req.id} className="rounded-xl border border-[#ece7de] bg-white p-4 dark:border-[#2e2637] dark:bg-[#1f1a27]">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-[#422e59] dark:text-[#e4dcf0]">
                {target ? `${target.holderName} — ${target.credentialRef}` : 'A credential on the register'}
              </p>
              <span className="rounded-full bg-[#422e59]/10 px-2 py-0.5 text-xs text-[#422e59] dark:text-[#c5a55a]">
                {req.status.replace('_', ' ')}
              </span>
            </div>
            <p className="mt-2 text-sm text-[#6b6076] dark:text-[#9c93ad]">{req.description}</p>

            {Object.keys(req.proposed).length > 0 && (
              <dl className="mt-2 space-y-0.5 text-xs">
                {Object.entries(req.proposed).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="text-[#9c93ad]">{k}</dt>
                    <dd className="text-[#422e59] dark:text-[#e4dcf0]">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            )}

            {moves.length > 0 && (
              <>
                <input
                  value={note[req.id] ?? ''}
                  onChange={(e) => setNote((s) => ({ ...s, [req.id]: e.target.value }))}
                  placeholder="A note. Required to reject — a refusal with no reason cannot be appealed."
                  className="mt-3 w-full rounded-lg border border-[#ece7de] bg-[#faf8f4] p-2 text-xs dark:border-[#2e2637] dark:bg-[#241f2c] dark:text-[#e4dcf0]"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {moves.map((m) => (
                    <button
                      key={m.to}
                      type="button"
                      onClick={() => void move(req, m.to)}
                      disabled={busy === req.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#ece7de] px-3 py-1.5 text-xs font-medium text-[#241a30] disabled:opacity-40 dark:border-[#2e2637] dark:text-[#e4dcf0]"
                    >
                      {busy === req.id && <Loader2 size={12} className="animate-spin" />}
                      {m.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------

/**
 * "He can also create other kinds of certificate for different role that may
 * not even be academic."
 *
 * THE CATEGORY FIELD IS THE POINT OF THIS FORM. Everything else is a name and a
 * code. The category decides what a verifier is told the document is, and it is
 * the one thing standing between a Certificate of Appreciation and a fake
 * degree.
 */
function CredentialTypes({ onDone, onError }: { onDone: (t: string) => void; onError: (t: string) => void }) {
  const [types, setTypes] = useState<Array<Record<string, any>>>([]);
  const [form, setForm] = useState({
    name: '', code: '', category: 'institutional' as CredentialCategory,
    isAcademic: false, eligibility: '',
    validity: 'permanent' as 'permanent' | 'expiring', validityMonths: 24,
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await runQuery(supabase.from('credential_types').select('*').order('created_at', { ascending: false }));
    setTypes(data ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const problems = problemsWithType(form);
  const profile = CATEGORY_PROFILES[form.category];

  async function create() {
    setBusy(true);
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch('/api/credential/type', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.session?.access_token ?? ''}`,
      },
      body: JSON.stringify(form),
    });
    const out = await res.json().catch(() => ({ ok: false, error: 'no-reply' }));
    setBusy(false);
    if (!out.ok) { onError(out.detail ?? out.error ?? 'Not created.'); return; }
    setForm({ ...form, name: '', code: '', eligibility: '' });
    onDone(out.message ?? 'Created.');
    void load();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-[#ece7de] bg-white p-5 dark:border-[#2e2637] dark:bg-[#1f1a27]">
        <h2 className="text-sm font-semibold text-[#422e59] dark:text-[#e4dcf0]">A new kind of credential</h2>

        <label className="mt-3 block">
          <span className="text-xs font-medium text-[#422e59] dark:text-[#e4dcf0]">Name</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Certificate of Ordination"
            className="mt-1 w-full rounded-lg border border-[#ece7de] bg-[#faf8f4] p-2 text-sm dark:border-[#2e2637] dark:bg-[#241f2c] dark:text-[#e4dcf0]"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-medium text-[#422e59] dark:text-[#e4dcf0]">
            Code — printed in the credential number
          </span>
          <input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="ORD"
            className="mt-1 w-full rounded-lg border border-[#ece7de] bg-[#faf8f4] p-2 font-mono text-sm dark:border-[#2e2637] dark:bg-[#241f2c] dark:text-[#e4dcf0]"
          />
        </label>

        <fieldset className="mt-3">
          <legend className="text-xs font-medium text-[#422e59] dark:text-[#e4dcf0]">Category</legend>
          <div className="mt-1 space-y-1">
            {CREDENTIAL_CATEGORIES.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={form.category === c}
                  onChange={() => setForm({
                    ...form,
                    category: c,
                    // A category that cannot be academic clears the flag rather
                    // than leaving a contradiction for the validator to catch.
                    isAcademic: CATEGORY_PROFILES[c].mayBeAcademic ? form.isAcademic : false,
                  })}
                />
                <span className="text-[#422e59] dark:text-[#e4dcf0]">{CATEGORY_PROFILES[c].label}</span>
              </label>
            ))}
          </div>
          {/* WHAT A VERIFIER WILL BE TOLD, shown while the choice is being made
              rather than discovered afterwards on somebody's verification page. */}
          <p className="mt-2 rounded-lg bg-[#faf8f4] p-2 text-xs text-[#6b6076] dark:bg-[#241f2c] dark:text-[#9c93ad]">
            <strong className="font-semibold">A verifier will be told:</strong> {profile.verifierNote}
          </p>
        </fieldset>

        {profile.mayBeAcademic && (
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isAcademic}
              onChange={(e) => setForm({ ...form, isAcademic: e.target.checked })}
            />
            <span className="text-[#422e59] dark:text-[#e4dcf0]">
              This is an academic award — it carries credit and appears on a transcript
            </span>
          </label>
        )}

        <label className="mt-3 block">
          <span className="text-xs font-medium text-[#422e59] dark:text-[#e4dcf0]">Who may receive it</span>
          <textarea
            value={form.eligibility}
            onChange={(e) => setForm({ ...form, eligibility: e.target.value })}
            rows={2}
            className="mt-1 w-full rounded-lg border border-[#ece7de] bg-[#faf8f4] p-2 text-sm dark:border-[#2e2637] dark:bg-[#241f2c] dark:text-[#e4dcf0]"
          />
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.validity === 'expiring'}
              onChange={(e) => setForm({ ...form, validity: e.target.checked ? 'expiring' : 'permanent' })}
            />
            <span className="text-[#422e59] dark:text-[#e4dcf0]">It expires</span>
          </label>
          {form.validity === 'expiring' && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="number"
                min={1}
                value={form.validityMonths}
                onChange={(e) => setForm({ ...form, validityMonths: Number(e.target.value) })}
                className="w-20 rounded-lg border border-[#ece7de] bg-[#faf8f4] p-1.5 text-sm dark:border-[#2e2637] dark:bg-[#241f2c] dark:text-[#e4dcf0]"
              />
              <span className="text-[#6b6076] dark:text-[#9c93ad]">months</span>
            </label>
          )}
        </div>

        {problems.length > 0 && (
          <ul className="mt-3 space-y-1">
            {problems.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[#6b6076] dark:text-[#9c93ad]">
                <XCircle size={13} className="mt-0.5 flex-shrink-0 text-red-600" />{p}
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => void create()}
          disabled={busy || problems.length > 0}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#422e59] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-[#c5a55a] dark:text-[#241a30]"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          Create
        </button>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-[#422e59] dark:text-[#e4dcf0]">
          What this University awards
        </h2>
        {types.length === 0 ? (
          <p className="mt-3 text-sm text-[#6b6076] dark:text-[#9c93ad]">
            No credential type has been registered yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {types.map((t) => (
              <li key={t.id} className="rounded-xl border border-[#ece7de] bg-white p-3 dark:border-[#2e2637] dark:bg-[#1f1a27]">
                <p className="text-sm font-medium text-[#422e59] dark:text-[#e4dcf0]">
                  {t.name} <span className="font-mono text-xs text-[#9c93ad]">{t.code}</span>
                </p>
                <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
                  {CATEGORY_PROFILES[t.category as CredentialCategory]?.label}
                  {t.is_academic && ' · carries academic credit'}
                  {t.validity === 'expiring' && ` · valid ${t.validity_months} months`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * The permanent record.
 *
 * READ-ONLY, AND THERE IS NO CONTROL ON THIS SCREEN THAT COULD CHANGE IT. Not
 * because the component is careful, but because the database refuses UPDATE and
 * DELETE on this table for every caller including the Superadministrator. An
 * audit trail the most powerful account can edit is not an audit trail of that
 * account.
 */
function AuditTrail({ events }: { events: AuditEvent[] }) {
  // The reciprocal of the note on the system audit log. Two append-only trails
  // exist and each one says what the other holds, so neither reads as the
  // complete record when it is half of it.
  const scope = (
    <p className="mt-3 text-xs leading-relaxed text-[#8a8194]">
      Actions taken on <em>issued</em> credentials. Account changes, role grants and published
      designs are recorded separately, in the <strong>System audit log</strong>.
    </p>
  );

  if (events.length === 0) {
    return (
      <div>
        <p className="rounded-xl border border-dashed border-[#ece7de] p-8 text-center text-sm text-[#6b6076] dark:border-[#2e2637] dark:text-[#9c93ad]">
          Nothing has been recorded yet.
        </p>
        {scope}
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs text-[#6b6076] dark:text-[#9c93ad]">
        Append-only. Nothing here can be edited or deleted by anyone, including the
        Superadministrator — the database refuses it, not this screen.
      </p>
      {scope}
      <ol className="mt-3 divide-y divide-[#ece7de] dark:divide-[#2e2637]">
        {events.map((e) => (
          <li key={e.id} className="py-2.5">
            <p className="text-sm text-[#422e59] dark:text-[#e4dcf0]">{describeEvent(e)}</p>
            <p className="text-xs text-[#9c93ad]">
              {new Date(e.occurredAt).toLocaleString('en-GB')}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
